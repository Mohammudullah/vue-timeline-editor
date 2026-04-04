import { onBeforeUnmount, reactive, Reactive, watch } from "vue"
import { TimelineFrameInterface } from "../../types/timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { TimelineInterface } from "../timeline";
import { PointerPressControls } from "../pointerPress";
import { clear } from "node:console";

export const useDnd = ({
    timeline,
    timelineConfig
} : {
    timeline: TimelineInterface,
    timelineConfig: TimelineConfigInterface

}) : Reactive<DndInterface> => {

    let currentFrameContainer: HTMLDivElement | null = null;

    // The pointer controls first starts on frame then is transferred to the dnd
    // so, we store frame pointer controls here to call onHoldEnd when drag ends
    let pointerControls: PointerPressControls | null = null;

    const state = reactive<DndStateInterface>({
        dragging: false,
        draggingFrame: null,
        draggingUuid: null,
        pointer: {
            clientX: 0,
            clientY: 0,
            relativeX: 0,
            relativeY: 0,
        }
    });


    const startDrag = (event: PointerEvent, controls: PointerPressControls, frame: TimelineFrameInterface, container: HTMLDivElement | null, uuid: string | number) => {

        event.preventDefault();

        currentFrameContainer = container;

        controls.takeover();
        pointerControls = controls;

        state.dragging = true;
        state.draggingFrame = frame;
        state.draggingUuid = uuid;

        if(timeline.editor) {

            if(!timeline.editor.hasPointerCapture?.(event.pointerId)) {
                timeline.editor.setPointerCapture(event.pointerId);
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

        if(timeline.editor) {

            if(timeline.editor?.hasPointerCapture?.(event.pointerId)) {
                timeline.editor.releasePointerCapture(event.pointerId);
            }
        }
    }

    const onPointerMove = (event: PointerEvent) => {
        if(!state.dragging) return;

        state.pointer.clientX = event.clientX;
        state.pointer.clientY = event.clientY;

        state.pointer.relativeX = event.clientX + timelineConfig.editor.viewPortLeft;
        state.pointer.relativeY = event.clientY + timelineConfig.editor.viewPortTop;
    }
    
    const editorPointerEvents = {
        'pointermove': onPointerMove,
        'pointerup': dragEnd,
        'pointercancel': dragEnd,
    } as const;

    type eventTypes = keyof typeof editorPointerEvents;

    // Watch for changes in the timeline editor reference and update event listeners accordingly
    //this listener is necessary to ensure that pointer events are captured even if the editor element is re-rendered
    //pointer events help to identify the pointer position during dragging
    watch(() => timeline.editor, (newEditor, oldEditor) => {
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
        timeline.editor 
        ? Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => timeline.editor?.removeEventListener(event as eventTypes, handler)
        ) : null
    })

    return {
        state,
        startDrag,
    };
}

export type UseDndType = ReturnType<typeof useDnd>;

export interface DndInterface {
    state: DndStateInterface,
    startDrag: (event: PointerEvent, controls: PointerPressControls, frame: TimelineFrameInterface, container: HTMLDivElement | null, uuid: string | number ) => void,
}

export interface DndStateInterface {
    dragging: boolean,
    draggingFrame: null | TimelineFrameInterface,
    draggingUuid: null | string | number,
    pointer: {
        clientX: number,
        clientY: number,
        relativeX: number,
        relativeY: number,
    }
}