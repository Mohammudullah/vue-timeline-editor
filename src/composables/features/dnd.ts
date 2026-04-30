import { onBeforeUnmount, reactive, watch } from "vue"
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseTimelineInterface } from "../timeline";
import { UseFrameInterface } from "./frame";
import { DraggedFrameDataInterface, useDraggingEvents } from "./draggingEvents";

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
        container: {
            width: 0,
            height: 0,

            pointerX: 0,
            pointerY: 0,
        },
        draggingPlaceholder: {
            left: 0, 
            top: 0,
            start_ms: 0,
            end_ms: 0,
        },
        draggingFrame: {
            data: null,
            uuid: null,
        }
    });


    const draggingEvents = useDraggingEvents();


    const getDraggingFrameData = () : DraggedFrameDataInterface => {
        return {
            initial: {
                sectionUuid: state.draggingFrame.data?.sectionUuid ?? null,
                rowUuid: state.draggingFrame.data?.rowUuid ?? null,
                start_ms: state.draggingFrame.data?.start_ms ?? 0,
                end_ms: state.draggingFrame.data?.end_ms ?? 0,
            },
            current: {
                sectionUuid: timeline.state.pointer.over.sectionUuid,
                rowUuid: timeline.state.pointer.over.rowUuid,
                start_ms: state.draggingPlaceholder.start_ms,
                end_ms: state.draggingPlaceholder.end_ms,
            }
        }
    }


    const setContainer = (container: HTMLDivElement) => {
        state.container = frame.getFramePointerData();
    }


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

        state.dragging = true;
        state.draggingFrame.data = frame.state.selected.frame;
        state.draggingFrame.uuid = frame.state.selected.uuid;

        setContainer(frameContainer);
        setPlaceholderPosition();
        timeline.enableEdgeScrolling();

        if(timeline.state.editor) {

            if(!timeline.state.editor.hasPointerCapture?.(event.pointerId)) {
                timeline.state.editor.setPointerCapture(event.pointerId);
            }
        }

        draggingEvents.triggerOnDragStart(state.draggingFrame.data!, event);
    }

    const cancelDrag = (event: PointerEvent) => {

        if(!state.dragging) return;

        draggingEvents.triggerOnDragCancel(state.draggingFrame.data!, getDraggingFrameData(), event);
        dragEnd(event);
    }

    const drop = (event: PointerEvent) => {

        if(!state.dragging) return;

        draggingEvents.triggerOnDrop(state.draggingFrame.data!, getDraggingFrameData(), event);

        dragEnd(event);
    }

    const dragEnd = (event: PointerEvent) => {
        if(!state.dragging) return;

        state.dragging = false;

        if(timeline.state.editor) {

            if(timeline.state.editor?.hasPointerCapture?.(event.pointerId)) {
                timeline.state.editor.releasePointerCapture(event.pointerId);
            }
        }

        draggingEvents.triggerOnDragEnd(state.draggingFrame.data!, getDraggingFrameData(), event);

        //clear dragging frame data
        state.draggingFrame.data = null;
        state.draggingFrame.uuid = null;

        timeline.disableEdgeScrolling();
    }

    const setPlaceholderPosition = () => {

        if(!state.dragging) return;
        
        let left = timeline.state.pointer.editorRelativeX - state.container.pointerX;
        let top = timeline.state.pointer.editorRelativeY - state.container.pointerY;

        // Clamp the freeform ghost inside the editor bounds.
        // Done here (not in snapping) so the ghost preview itself never escapes the
        // editor — both the freeform ghost and the snap suggestion need this.
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

        state.draggingPlaceholder.left = left;
        state.draggingPlaceholder.top = top;

        const start = state.draggingPlaceholder.left - timelineConfig.editor.paddingLeft;

        state.draggingPlaceholder.start_ms =  start / timelineConfig.cols.pixelPerMs;
        state.draggingPlaceholder.end_ms = (start + state.draggingFrame.data!.width) / timelineConfig.cols.pixelPerMs;
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
        setPlaceholderPosition();
    })

    // Clean up event listeners on component unmount
    onBeforeUnmount(() => {
        timeline.state.editor 
        ? Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => timeline.state.editor?.removeEventListener(event as eventTypes, handler)
        ) : null
    })

    return {
        state,
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
    draggingPlaceholder: {
        left: number,
        top: number,
        start_ms: number,
        end_ms: number,
    }
}