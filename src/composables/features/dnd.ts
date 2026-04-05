import { onBeforeUnmount, reactive, Reactive, watch } from "vue"
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseTimelineInterface } from "../timeline";
import { PointerPressControls } from "../pointerPress";
import { UseFrameInterface } from "./frame";

export const useDnd = ({
    timeline,
    timelineConfig,
    frame
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    frame: UseFrameInterface

}) : Reactive<DndInterface> => {

    let currentFrameContainer: HTMLDivElement | null = null;

    // The pointer controls first starts on frame then is transferred to the dnd
    // so, we store frame pointer controls here to call onHoldEnd when drag ends
    let pointerControls: PointerPressControls | null = null;

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
        },
        draggingFrame: {
            data: null,
            uuid: null,
            over: {
                sectionUuid: null,
                rowUuid: null,
            }
        },
        pointer: {
            clientX: 0,
            clientY: 0,

            relativeX: 0,
            relativeY: 0,

            editorRelativeX: 0,
            editorRelativeY: 0,

            over: {
                sectionUuid: null as string | number | null,
                rowUuid: null as string | number | null,
            }
        }
    });


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
        let left = 0;
        let right = rowsCenterCache.length - 1;

        while (left <= right) {
            const mid = (left + right) >> 1;
            const center = rowsCenterCache[mid].center;

            if (center < y) left = mid + 1;
            else if (center > y) right = mid - 1;
            else return rowsCenterCache[mid];
        }

        const l = rowsCenterCache[left];
        const r = rowsCenterCache[right];

        if (!l) return r ?? null;
        if (!r) return l;

        const row = Math.abs(l.center - y) < Math.abs(r.center - y) ? l : r;

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
    }

    const dragEnd = (event: PointerEvent) => {
        if(!state.dragging) return;

        pointerControls?.onHoldEnd(event);
        pointerControls = null;

        state.dragging = false;
        state.draggingFrame.data = null;
        state.draggingFrame.uuid = null;
        state.draggingFrame.over.sectionUuid = null;
        state.draggingFrame.over.rowUuid = null;

        if(timeline.state.editor) {

            if(timeline.state.editor?.hasPointerCapture?.(event.pointerId)) {
                timeline.state.editor.releasePointerCapture(event.pointerId);
            }
        }
    }

    const updateDraggingPositions = (event: PointerEvent) => {
        if(!state.dragging) return;

        state.pointer.clientX = event.clientX;
        state.pointer.clientY = event.clientY;

        state.pointer.relativeX = event.clientX + timelineConfig.editor.viewPortLeft;
        state.pointer.relativeY = event.clientY + timelineConfig.editor.viewPortTop;

        state.pointer.editorRelativeX = state.pointer.relativeX - timelineConfig.editor.containerOffset.left;
        state.pointer.editorRelativeY = state.pointer.relativeY - timelineConfig.editor.containerOffset.top;

        setPlaceholderPosition();
        scrollWhileDragging(event);
        setPointerOverRow(state.pointer.editorRelativeY);
    }

    const setPlaceholderPosition = () => {
        
        state.draggingPlaceholder.left = state.pointer.editorRelativeX - state.container.pointerX;
        state.draggingPlaceholder.top = state.pointer.editorRelativeY - state.container.pointerY;
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
        'pointerup': dragEnd,
        'pointercancel': dragEnd,
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
        startDrag,
        dragEnd,
    };
}

export type UseDndType = ReturnType<typeof useDnd>;

export interface DndInterface {
    state: DndStateInterface,
    startDrag: (event: PointerEvent, controls: PointerPressControls, frame: TimelineFrameByUuidInterface, container: HTMLDivElement | null, uuid: string | number ) => void,
    dragEnd: (event: PointerEvent) => void,
}

export interface DndStateInterface {
    dragging: boolean,
    draggingFrame: {
        data: TimelineFrameByUuidInterface | null,
        uuid: string | number | null,
        over: {
            sectionUuid: string | number | null,
            rowUuid: string | number | null,
        }
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
        over: {
            sectionUuid: string | number | null,
            rowUuid: string | number | null,
        }
    },
    draggingPlaceholder: {
        left: number,
        top: number,
    }
}