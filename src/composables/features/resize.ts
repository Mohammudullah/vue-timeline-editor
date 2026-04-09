import { onBeforeUnmount, reactive, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseFrameInterface } from "./frame";
import { TimelineFrameByUuidInterface } from "../../types/timeline";

export const useResize = ({
    timeline,
    timelineConfig,
    frame
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    frame: UseFrameInterface
}) => {

    const state = reactive<ResizeInterface>({
        resizing: false,

        resizingFrame: {
            frame: null,
            uuid: null,
            container: null,
        },
        resizingPlaceholder: {
            start_ms: 0,
            end_ms: 0,
            left: 0,
            width: 0,
        }
    });


    const startResize = (event: PointerEvent ) => {
        const frameContainer = frame.state.selected.container;

        // If there is no selected frame container, do not start resizing
        if(!frameContainer) return;

        // If there is no selected frame or container, do not start resizing
        if(!frame.state.selected.uuid || !frameContainer) return;

        console.log('pointer down on resize handle');

        // If the pointerdown event is not on the selected frame and pointer is not inside resize handler, do not start resizing
        if(!frameContainer.contains(event.target as Node) && (!(event.target as HTMLElement).closest('.vtd__row-frame-resize-handle')) && !(event.target as HTMLElement).classList.contains('vtd__row-frame-resize-handle')) { 
            return;
        }

        state.resizing = true;
        state.resizingFrame.frame = frame.state.selected.frame;
        state.resizingFrame.uuid = frame.state.selected.uuid;
        state.resizingFrame.container = frame.state.selected.container;
    }


    const endResize = (event: PointerEvent) => {
        if(!state.resizing) return;
        console.log('end resize');
    }

    const cancelResize = (event: PointerEvent) => {
        if(!state.resizing) return;
        console.log('cancel resize');
    }

    const updateSize = (event: PointerEvent) => {
        if(!state.resizing) return;
        console.log('update size');
    }

    const editorPointerEvents = {
        'pointerdown': startResize,
        'pointermove': updateSize,
        'pointerup': endResize,
        'pointercancel': cancelResize,
    } as const;

    type eventTypes = keyof typeof editorPointerEvents;


    // Watch for changes in the timeline editor reference and update event listeners accordingly
    //this listener is necessary to ensure that pointer events are captured even if the editor element is re-rendered
    //pointer events help to identify the pointer position during resizing
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
    }
}

export interface ResizeInterface {
    resizing: boolean,
    resizingFrame: {
        frame: TimelineFrameByUuidInterface | null,
        uuid: string | number | null,
        container: HTMLDivElement | null,
    },
    resizingPlaceholder: {
        start_ms: number,
        end_ms: number,
        left: number,
        width: number,
    }
}

export type UseResizeInterface = ReturnType<typeof useResize>;