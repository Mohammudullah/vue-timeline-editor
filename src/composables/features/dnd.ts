import { onBeforeUnmount, reactive, watch } from "vue"
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseTimelineInterface } from "../timeline";
import { UseFrameInterface } from "./frame";
import { DraggedFrameDataInterface, FrameDataItem, useDraggingEvents } from "./draggingEvents";

export const useDnd = ({
    timeline,
    timelineConfig,
    frame,
    edgeSnap = true,
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    frame: UseFrameInterface,
    edgeSnap?: boolean,

}) => {



    const state = reactive<DndStateInterface>({
        dragging: false,
        draggingMoved: false,
        container: {
            width: 0,
            height: 0,

            pointerX: 0,
            pointerY: 0,
        },
        // When true, vertical position is locked to the original row.
        // Set externally by features that enforce row constraints (e.g. JoinRows).
        rowLocked: false,
        draggingFrame: {
            data: null,
            uuid: null,
        },
        // Map of active ghost placeholders keyed by frame uuid.
        // Always contains the primary frame while dragging; external features
        // (e.g. JoinRows) add further entries for group members.
        draggingPlaceholders: {},
    });


    const draggingEvents = useDraggingEvents();


    const getDraggingFrameData = () : DraggedFrameDataInterface => {
        const primaryUuid = state.draggingFrame.uuid;

        const initial: DraggedFrameDataInterface['initial'] = [];
        const current: DraggedFrameDataInterface['current'] = [];

        // Sort so primary is always first; members follow.
        const entries = Object.values(state.draggingPlaceholders).sort((a, b) =>
            a.uuid === primaryUuid ? -1 : b.uuid === primaryUuid ? 1 : 0
        );

        entries.forEach(entry => {
            const originalFrame = timeline.state.sectionFramesByUuid[entry.uuid];
            initial.push({
                uuid: entry.uuid,
                sectionUuid: originalFrame?.sectionUuid ?? null,
                rowUuid: originalFrame?.rowUuid ?? null,
                start_ms: originalFrame?.start_ms ?? 0,
                end_ms: originalFrame?.end_ms ?? 0,
            });
            const isPrimary = entry.uuid === primaryUuid;
            current.push({
                uuid: entry.uuid,
                sectionUuid: isPrimary
                    ? timeline.state.pointer.over.sectionUuid
                    : (originalFrame?.sectionUuid ?? null),
                rowUuid: isPrimary
                    ? timeline.state.pointer.over.rowUuid
                    : entry.rowUuid,
                start_ms: entry.start_ms,
                end_ms: entry.end_ms,
            });
        });

        return { initial, current };
    }


    const setContainer = (container: HTMLDivElement) => {
        state.container = frame.getFramePointerData();
    }


    // Holds the initial pointerdown data for a frame that MIGHT become a drag.
    // Actual drag activation (setPointerCapture, state.dragging) is deferred until
    // the pointer moves more than DRAG_THRESHOLD pixels, so a quick click can
    // still fire the 'click' event on the frame and trigger deselection.
    let pendingDrag: { pointerId: number, clientX: number, clientY: number } | null = null;
    const DRAG_THRESHOLD = 4;

    const startDrag = (event: PointerEvent) => {

        const frameContainer = frame.state.selected.container;

        // If there is no selected frame container, do not start dragging
        if(!frameContainer) return;

        // If there is no selected frame or container, do not start dragging
        if(!frame.state.selected.uuid || !frameContainer) return;

        // If the pointerdown event is not on the selected frame, do not start dragging
        // also check if .no-drag class is present in the event target or its parents, if yes do not start dragging
        if(!frameContainer.contains(event.target as Node) || (event.target as HTMLElement).closest('.no-dragging') || (event.target as HTMLElement).classList.contains('no-dragging')) { 
            return;
        }

        // Record a pending drag — don't activate yet so 'click' can still fire
        // on the frame for a quick tap (which would deselect it).
        pendingDrag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
        setContainer(frameContainer);
    }

    const activateDrag = (event?: PointerEvent) => {
        if (state.dragging || !pendingDrag || !frame.state.selected.frame) return;

        state.dragging = true;
        state.draggingMoved = true;
        state.draggingFrame.data = frame.state.selected.frame;
        state.draggingFrame.uuid = frame.state.selected.uuid;

        setPlaceholderPosition();
        timeline.enableEdgeScrolling();

        if(timeline.state.editor) {
            if(!timeline.state.editor.hasPointerCapture?.(pendingDrag.pointerId)) {
                timeline.state.editor.setPointerCapture(pendingDrag.pointerId);
            }
        }

        draggingEvents.triggerOnDragStart(state.draggingFrame.data!, event ?? new PointerEvent('pointerdown'));
    }

    const cancelDrag = (event: PointerEvent) => {
        pendingDrag = null;
        if(!state.dragging) return;

        draggingEvents.triggerOnDragCancel(state.draggingFrame.data!, getDraggingFrameData(), event);
        dragEnd(event);
    }

    const drop = (event: PointerEvent) => {
        pendingDrag = null;
        if(!state.dragging) return;

        draggingEvents.triggerOnDrop(state.draggingFrame.data!, getDraggingFrameData(), event);

        dragEnd(event);
    }

    const dragEnd = (event: PointerEvent) => {
        if(!state.dragging) return;

        state.dragging = false;
        state.draggingMoved = false;

        if(timeline.state.editor) {

            if(timeline.state.editor?.hasPointerCapture?.(event.pointerId)) {
                timeline.state.editor.releasePointerCapture(event.pointerId);
            }
        }

        draggingEvents.triggerOnDragEnd(state.draggingFrame.data!, getDraggingFrameData(), event);

        //clear dragging frame data
        state.draggingFrame.data = null;
        state.draggingFrame.uuid = null;

        state.draggingPlaceholders = {};

        timeline.disableEdgeScrolling();
    }

    const setPlaceholderPosition = () => {

        if(!state.dragging) return;
        
        let left = timeline.state.pointer.editorRelativeX - state.container.pointerX;
        let top = timeline.state.pointer.editorRelativeY - state.container.pointerY;

        // Row-lock: when rowLocked is true, override top with the original row's
        // editorRelativeTop so the ghost stays on the source row.
        if (state.rowLocked) {
            const originalRowUuid = state.draggingFrame.data?.rowUuid;
            const originalRow = originalRowUuid != null
                ? timeline.state.sectionRowsByUuid[originalRowUuid]
                : null;
            if (originalRow != null) {
                top = originalRow.editorRelativeTop;
            }
        }

        // Clamp the freeform ghost inside the editor bounds.
        if(edgeSnap && state.draggingFrame.data) {
            const frameWidth = state.draggingFrame.data.width;

            const minLeft = timelineConfig.editor.paddingLeft;
            const maxLeft = timelineConfig.editor.width - (timelineConfig.editor.paddingRight + frameWidth);
            const minTop = timelineConfig.sections.labelHeight;
            const maxTop = timelineConfig.editor.height - timelineConfig.rows.height;

            if(left < minLeft) left = minLeft;
            else if(left > maxLeft) left = maxLeft;

            if(top < minTop) top = minTop;
            else if(top > maxTop) top = maxTop;
        }

        const start = left - timelineConfig.editor.paddingLeft;
        const start_ms = start / timelineConfig.cols.pixelPerMs;
        const end_ms = (start + state.draggingFrame.data!.width) / timelineConfig.cols.pixelPerMs;

        if (state.draggingFrame.uuid != null) {
            state.draggingPlaceholders[state.draggingFrame.uuid] = {
                uuid: state.draggingFrame.uuid,
                rowUuid: timeline.state.pointer.over.rowUuid ?? state.draggingFrame.data?.rowUuid ?? null,
                start_ms,
                end_ms,
                left,
                width: state.draggingFrame.data!.width,
                top,
            };
        }
    }
    
    const editorPointerEvents = {
        'pointerdown': startDrag,
        'pointerup': drop,
        'pointercancel': cancelDrag,
    } as const;

    type eventTypes = keyof typeof editorPointerEvents;

    // Watch for changes in the timeline editor reference and update event listeners accordingly
    //this listener is necessary to ensure that pointer events are captured even if the editor element is re-rendered
    //pointer events help to identify the pointer position during dragging
    watch(() => timeline.state.editor, (newEditor, oldEditor) => {

        oldEditor 
        ? Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => oldEditor.removeEventListener(event as eventTypes, handler)
        ) : null

        newEditor 
        ? Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => newEditor.addEventListener(event as eventTypes, handler)
        ) : null

    }, { immediate: true })


    watch([
        () => timeline.state.pointer.clientX,
        () => timeline.state.pointer.clientY,
    ], () => {
        // Activate drag once the pointer moves beyond the threshold. This keeps
        // setPointerCapture away from quick clicks so 'click' can still fire on
        // the frame element and trigger deselection.
        if (pendingDrag && !state.dragging) {
            const dx = Math.abs(timeline.state.pointer.clientX - pendingDrag.clientX);
            const dy = Math.abs(timeline.state.pointer.clientY - pendingDrag.clientY);
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                activateDrag();
            }
        }
        setPlaceholderPosition();
    })

    // Clean up event listeners on component unmount
    onBeforeUnmount(() => {
        timeline.state.editor 
        ? Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => timeline.state.editor?.removeEventListener(event as eventTypes, handler)
        ) : null
    })

    const draggingFrame = (uuid: string | number) =>
        timeline.state.sectionFramesByUuid[uuid] ?? null;

    const dragging = (uuid: string | number): boolean =>
        state.dragging && state.draggingPlaceholders[uuid] != null;

    return {
        state,
        draggingFrame,
        dragging,
        onDragStart: draggingEvents.onDragStart,
        onDragEnd: draggingEvents.onDragEnd,
        onDragCancel: draggingEvents.onDragCancel,
        onDrop: draggingEvents.onDrop,
        removeEvent: draggingEvents.removeEvent,
    };
}

export type UseDndType = ReturnType<typeof useDnd>;

export interface DndStateInterface {
    dragging: boolean,
    // True once the pointer moves more than 4px during the current drag session.
    // Consumers can check this to distinguish a real drag from a quick click.
    draggingMoved: boolean,
    draggingFrame: {
        data: TimelineFrameByUuidInterface | null,
        uuid: string | number | null,
    },
    container: {
        width: number,
        height: number,
        pointerX: number,
        pointerY: number,
    },
    // When true, vertical position is locked to the original row.
    rowLocked: boolean,
    // Map of active ghost placeholders keyed by frame uuid.
    draggingPlaceholders: Record<string | number, DraggingPlaceholderInterface>,
}

export interface DraggingPlaceholderInterface {
    uuid: string | number,
    rowUuid: string | number | null,
    start_ms: number,
    end_ms: number,
    left: number,
    width: number,
    top: number,
}