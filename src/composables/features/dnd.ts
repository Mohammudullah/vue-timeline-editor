import { onBeforeUnmount, reactive, Reactive, watch } from "vue"
import { TimelineFrameByUuidInterface, TimelineFrameInterface } from "../../types/timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { TimelineInterface, UseTimelineInterface } from "../timeline";
import { PointerPressControls } from "../pointerPress";
import { clear } from "node:console";
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
        draggingFrame: null,
        draggingUuid: null,
        container: {
            width: 0,
            height: 0,

            pointerX: 0,
            pointerY: 0,
        },
        draggingPlaceholder: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
        },
        pointer: {
            clientX: 0,
            clientY: 0,

            relativeX: 0,
            relativeY: 0,
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

        state.dragging = true;
        state.draggingFrame = frame.state.selected.frame;
        state.draggingUuid = frame.state.selected.uuid;

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
        state.draggingFrame = null;
        state.draggingUuid = null;

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

        setPlaceholderPosition();
        scrollWhileDragging(event);
    }

    const setPlaceholderPosition = () => {
        
        state.draggingPlaceholder.left = state.pointer.clientX - state.container.pointerX;
        state.draggingPlaceholder.top = state.pointer.clientY - state.container.pointerY;
        state.draggingPlaceholder.right = state.draggingPlaceholder.left + (state.container.width || 0);
        state.draggingPlaceholder.bottom = state.draggingPlaceholder.top + (state.container.height || 0);
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
        console.log('timeline editor changed:', { newEditor, oldEditor });
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
    draggingFrame: null | TimelineFrameByUuidInterface,
    draggingUuid: null | string | number,
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
    },
    draggingPlaceholder: {
        left: number,
        right: number,
        top: number,
        bottom: number,
    }
}