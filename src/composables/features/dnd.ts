import { onBeforeUnmount, reactive, Reactive, watch } from "vue"
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseTimelineInterface } from "../timeline";
import { PointerPressControls } from "../pointerPress";
import { UseFrameInterface } from "./frame";
import { DraggedFrameDataInterface, useDraggingEvents } from "./draggingEvents";

export const useDnd = ({
    timeline,
    timelineConfig,
    frame
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    frame: UseFrameInterface

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
        },
        pointer: {
            clientX: 0,
            clientY: 0,

            relativeX: 0,
            relativeY: 0,

            editorRelativeX: 0,
            editorRelativeY: 0,

            on_ms: 0,

            over: {
                sectionUuid: null as string | number | null,
                rowUuid: null as string | number | null,
            }
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
                sectionUuid: state.pointer.over.sectionUuid,
                rowUuid: state.pointer.over.rowUuid,
                start_ms: state.draggingPlaceholder.start_ms,
                end_ms: state.draggingPlaceholder.end_ms,
            }
        }
    }


    const setContainer = (container: HTMLDivElement) => {
        if(container) {
            state.container.width = container.clientWidth;
            state.container.height = container.clientHeight;

            //calculate the pointer position relative to the container
            const rect = container.getBoundingClientRect();

            state.container.pointerX = state.pointer.clientX - rect.left;
            state.container.pointerY = state.pointer.clientY - rect.top;
        }
    }


    const rowsCenterCache = [] as {
        sectionUuid: string | number,
        rowUuid: string | number,
        center: number,
    }[];



    const calculateRowsCenterCache = () => {
        Object.values(timeline.state.sectionRowsByUuid).forEach((row) => {
            const center = row.editorRelativeTop + timelineConfig.rows.height / 2;
            rowsCenterCache.push({
                sectionUuid: row.sectionUuid,
                rowUuid: row.uuid,
                center,
            });
        });
    }

    // A binary search function to find the closest row center to the given y position
    const setPointerOverRow = (y: number) => {
        let top = 0;
        let bottom = rowsCenterCache.length - 1;

        while (top <= bottom) {
            const mid = (top + bottom) >> 1;
            const center = rowsCenterCache[mid].center;

            if (center < y) top = mid + 1;
            else if (center > y) bottom = mid - 1;
            else {
                const row = rowsCenterCache[mid];
                state.pointer.over.sectionUuid = row.sectionUuid;
                state.pointer.over.rowUuid = row.rowUuid;
                return;
            }
        }

        const l = rowsCenterCache[top];
        const r = rowsCenterCache[bottom];

        const row =
            !l ? r :
            !r ? l :
            Math.abs(l.center - y) < Math.abs(r.center - y) ? l : r;

        if (!row) return;

        state.pointer.over.sectionUuid = row.sectionUuid;
        state.pointer.over.rowUuid = row.rowUuid;
    };


    const startDrag = (event: PointerEvent) => {

        const frameContainer = frame.state.selected.container;

        // If there is no selected frame container, do not start dragging
        if(!frameContainer) return;

        // If there is no selected frame or container, do not start dragging
        if(!frame.state.selected.uuid || !frameContainer) return;

        // If the pointerdown event is not on the selected frame, do not start dragging
        if(!frameContainer.contains(event.target as Node)) { 
            return;
        }

        // cache the rows center positions for finding the closest row during dragging
        calculateRowsCenterCache();

        state.dragging = true;
        state.draggingFrame.data = frame.state.selected.frame;
        state.draggingFrame.uuid = frame.state.selected.uuid;

        updateDraggingPositions(event);
        setContainer(frameContainer);
        setPlaceholderPosition();

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

        //clear rows center cache
        rowsCenterCache.length = 0;

        //clear dragging frame data
        state.draggingFrame.data = null;
        state.draggingFrame.uuid = null;

        //clear pointer over data
        state.pointer.over.sectionUuid = null;
        state.pointer.over.rowUuid = null;
    }

    const updateDraggingPositions = (event: PointerEvent) => {
        if(!state.dragging) return;

        const scrollPaneEl = timeline.state.scrollPaneEl;
        if(!scrollPaneEl) return;

        const rect = scrollPaneEl.getBoundingClientRect();

        state.pointer.clientX = event.clientX;
        state.pointer.clientY = event.clientY;

        // Pointer position inside the visible scroll pane
        state.pointer.relativeX = event.clientX - rect.left;
        state.pointer.relativeY = event.clientY - rect.top;

        scrollWhileDragging(event);

        // Pointer position inside the full editor content
        state.pointer.editorRelativeX = state.pointer.relativeX + scrollPaneEl.scrollLeft;
        state.pointer.editorRelativeY = state.pointer.relativeY + scrollPaneEl.scrollTop;

        state.pointer.on_ms =
            (state.pointer.editorRelativeX - timelineConfig.editor.paddingLeft) /
            timelineConfig.cols.pixelPerMs;

        setPointerOverRow(state.pointer.editorRelativeY);
        setPlaceholderPosition();
    }

    const setPlaceholderPosition = () => {
        
        state.draggingPlaceholder.left = state.pointer.editorRelativeX - state.container.pointerX;
        state.draggingPlaceholder.top = state.pointer.editorRelativeY - state.container.pointerY;

        const start = state.draggingPlaceholder.left - timelineConfig.editor.paddingLeft;

        state.draggingPlaceholder.start_ms =  start / timelineConfig.cols.pixelPerMs;
        state.draggingPlaceholder.end_ms = (start + state.draggingFrame.data!.width) / timelineConfig.cols.pixelPerMs;
    }

    const scrollWhileDragging = (event: PointerEvent) => {
        if(!state.dragging) return;

        const scrollPanEl = timeline.state.scrollPaneEl;

        if(!scrollPanEl) return;

        const rect = scrollPanEl.getBoundingClientRect();

        const scrollThreshold = 50;

        let scrollX = 0;
        let scrollY = 0;
        if(event.clientX - rect.left < scrollThreshold) {
            scrollX = -10;
        } else if(rect.right - event.clientX < scrollThreshold) {
            scrollX = 10;
        }

        if(event.clientY - rect.top < scrollThreshold) {
            scrollY = -10;
        } else if(rect.bottom - event.clientY < scrollThreshold) {
            scrollY = 10;
        }

        if(scrollX !== 0 || scrollY !== 0) {
            scrollPanEl.scrollBy(scrollX, scrollY);
        }

    }
    
    const editorPointerEvents = {
        'pointerdown': startDrag,
        'pointermove': updateDraggingPositions,
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
    };
}

export type UseDndType = ReturnType<typeof useDnd>;

export interface DndStateInterface {
    dragging: boolean,
    draggingFrame: {
        data: TimelineFrameByUuidInterface | null,
        uuid: string | number | null,
    }
    container: {
        width: number,
        height: number,
        pointerX: number,
        pointerY: number,
    },
    pointer: {
        clientX: number,
        clientY: number,
        relativeX: number,
        relativeY: number,
        editorRelativeX: number,
        editorRelativeY: number,

        on_ms: number,

        over: {
            sectionUuid: string | number | null,
            rowUuid: string | number | null,
        }
    },
    draggingPlaceholder: {
        left: number,
        top: number,
        start_ms: number,
        end_ms: number,
    }
}