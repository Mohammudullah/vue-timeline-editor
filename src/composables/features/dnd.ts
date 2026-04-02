import { onBeforeUnmount, onMounted, reactive, Reactive, Ref, watch } from "vue"
import { TimelineFrameInterface } from "../../types/timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { TimelineInterface } from "../timeline";

export const useDnd = ({
    timeline,
    timelineConfig
} : {
    timeline: TimelineInterface,
    timelineConfig: TimelineConfigInterface

}) : Reactive<DndInterface> => {
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


    const onDragStart = (event: PointerEvent, frame: TimelineFrameInterface, uuid: string) => {
        state.dragging = true;
        state.draggingFrame = frame;
        state.draggingUuid = uuid;

        if(timeline.editor) {
            // timeline.editor.style.touchAction = 'none';
        }
    }

    const onDragEnd = (event: PointerEvent) => {
        state.dragging = false;
        state.draggingFrame = null;
        state.draggingUuid = null;

        if(timeline.editor) {
            timeline.editor.style.touchAction = 'auto';
        }
    }

    const setEditorPointerCapture = (event: PointerEvent) => {

        if (!timeline.editor) return;

        timeline.editor.setPointerCapture(event.pointerId);
    
    }

    const releaseEditorPointerCapture = (event: PointerEvent) => {

        if (!timeline.editor) return;
        
        timeline.editor.releasePointerCapture(event.pointerId);
    }

    const onPointerMove = (event: PointerEvent) => {
        state.pointer.clientX = event.clientX;
        state.pointer.clientY = event.clientY;

        state.pointer.relativeX = event.clientX + timelineConfig.editor.viewPortLeft;
        state.pointer.relativeY = event.clientY + timelineConfig.editor.viewPortTop;
    }
    
    const editorPointerEvents = {
        'pointermove': onPointerMove,
        'pointerdown': setEditorPointerCapture,
        'pointerup': releaseEditorPointerCapture,
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
        onDragStart,
        onDragEnd
    };
}

export type UseDndType = ReturnType<typeof useDnd>;

export interface DndInterface {
    state: DndStateInterface,
    onDragStart: (event: PointerEvent, frame: TimelineFrameInterface, uuid: string) => void,
    onDragEnd: (event: PointerEvent) => void
}

export interface DndStateInterface {
    dragging: boolean,
    draggingFrame: null | TimelineFrameInterface,
    draggingUuid: null | string,
    pointer: {
        clientX: number,
        clientY: number,
        relativeX: number,
        relativeY: number,
    }
}