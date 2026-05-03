import { onBeforeUnmount, reactive, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseFrameInterface } from "./frame";
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { ResizedFrameDataInterface, useDraggingEvents } from "./draggingEvents";
import useUtils from "../utils";

export const useResize = ({
    timeline,
    timelineConfig,
    frame
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    frame: UseFrameInterface
}) => {

    const draggingEvents = useDraggingEvents();
    const { calculateFrameWidth } = useUtils();

    const state = reactive<ResizeInterface>({
        resizing: false,
        container: {
            width: 0,
            height: 0,

            pointerX: 0,
            pointerY: 0,
        },
        resizingFrame: {
            frame: null,
            uuid: null,
            container: null,
            side: 'left',
        },
        resizingPlaceholder: {
            start_ms: 0,
            end_ms: 0,
            left: 0,
            width: 0,
            top: 0,
        }
    });


    const startResize = (event: PointerEvent ) => {
        const frameContainer = frame.state.selected.container;

        // If there is no selected frame container, do not start resizing
        if(!frameContainer) return;

        // If there is no selected frame or container, do not start resizing
        if(!frame.state.selected.uuid || !frameContainer) return;

        // If the pointerdown event is not on the selected frame and pointer is not inside resize handler, do not start resizing
        if(!frameContainer.contains(event.target as Node)) { 
            return;
        }

        // find the handle element
        const handle = (event.target as HTMLElement).closest('.vtd__row-frame-resize-handle') as HTMLElement 
        || (
            (event.target as HTMLElement).classList.contains('vtd__row-frame-resize-handle') 
            ? (event.target as HTMLElement).closest('.vtd__row-frame-resize-handle') as HTMLElement 
            : null
        );

        if(!handle) {
            return;
        }

        state.resizing = true;
        
        // Set the container data for the resizing frame
        state.container = frame.getFramePointerData();

        state.resizingFrame.frame = frame.state.selected.frame;
        state.resizingFrame.uuid = frame.state.selected.uuid;
        state.resizingFrame.container = frame.state.selected.container;
        state.resizingFrame.side = handle.classList.contains('vtd__frame-resize-left-handle') ? 'left' : 'right';

        //update the resizing placeholder position
        copyInitialPlaceholderData();


        timeline.enableEdgeScrolling();

        if(state.resizingFrame.frame) {
            draggingEvents.triggerOnResizeStart(state.resizingFrame.frame, event);
        }
    }


    const generateResizedFrameData = () : ResizedFrameDataInterface => {
        return {
            initial: {
                sectionUuid: state.resizingFrame.frame?.sectionUuid ?? null,
                rowUuid: state.resizingFrame.frame?.rowUuid ?? null,
                start_ms: state.resizingFrame.frame?.start_ms ?? 0,
                end_ms: state.resizingFrame.frame?.end_ms ?? 0,           
            },
            current: {
                sectionUuid: state.resizingFrame.frame?.sectionUuid ?? null,
                rowUuid: state.resizingFrame.frame?.rowUuid ?? null,
                start_ms: state.resizingPlaceholder.start_ms,
                end_ms: state.resizingPlaceholder.end_ms,
            }
        }
    }


    const endResize = (event: PointerEvent) => {
        if(!state.resizing) return;

        if(state.resizingFrame.frame) {
            draggingEvents.triggerOnResizeEnd(state.resizingFrame.frame, generateResizedFrameData(), event);
        }

        timeline.disableEdgeScrolling();
        state.resizing = false;
    }

    const cancelResize = (event: PointerEvent) => {
        if(state.resizingFrame.frame) {
            draggingEvents.triggerOnResizeCancel(state.resizingFrame.frame, generateResizedFrameData(), event);
        }
        endResize(event);
    }

    const resized = (event: PointerEvent) => {
        if(!state.resizing) return;

        if(state.resizingFrame.frame) {
            draggingEvents.triggerOnResized(state.resizingFrame.frame, generateResizedFrameData(), event);
        }

        endResize(event);
    }

    const copyInitialPlaceholderData = () => {
        if(!state.resizingFrame.frame) return;

        state.resizingPlaceholder.start_ms = state.resizingFrame.frame.start_ms;
        state.resizingPlaceholder.end_ms = state.resizingFrame.frame.end_ms;
        state.resizingPlaceholder.left = state.resizingFrame.frame.editorRelativeLeft;
        state.resizingPlaceholder.width = state.resizingFrame.frame.width;
        state.resizingPlaceholder.top = timeline.state.pointer.editorRelativeY - state.container.pointerY;
    }

    const setPlaceholderSize = () => {
        if(!state.resizing) return;


        if(state.resizingFrame.side === 'left') {
            state.resizingPlaceholder.start_ms = Math.min(state.resizingFrame.frame?.end_ms ?? 0, Math.max(0, timeline.state.pointer.on_ms));
        }

        if(state.resizingFrame.side === 'right') {
            state.resizingPlaceholder.end_ms = Math.max(state.resizingFrame.frame?.start_ms ?? 0, timeline.state.pointer.on_ms);
        }

        state.resizingPlaceholder.left = (state.resizingPlaceholder.start_ms * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft;
        state.resizingPlaceholder.width = calculateFrameWidth(state.resizingPlaceholder.start_ms, state.resizingPlaceholder.end_ms, timelineConfig.cols.pixelPerMs);

    }

    const editorPointerEvents = {
        'pointerdown': startResize,
        'pointerup': resized,
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


    watch([
        () => timeline.state.pointer.clientX,
    ], setPlaceholderSize)
    
    // Clean up event listeners on component unmount
    onBeforeUnmount(() => {
        timeline.state.editor 
        ? Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => timeline.state.editor?.removeEventListener(event as eventTypes, handler)
        ) : null
    })

    return {
        state,
        onResizeStart: draggingEvents.onResizeStart,
        onResizeEnd: draggingEvents.onResizeEnd,
        onResizeCancel: draggingEvents.onResizeCancel,
        onResized: draggingEvents.onResized,
        removeEvent: draggingEvents.removeEvent,
    }
}

export interface ResizeInterface {
    resizing: boolean,
    container: {
        width: number,
        height: number,
        pointerX: number,
        pointerY: number,
    },
    resizingFrame: {
        frame: TimelineFrameByUuidInterface | null,
        uuid: string | number | null,
        container: HTMLDivElement | null,
        side: 'left' | 'right',
    },
    resizingPlaceholder: {
        start_ms: number,
        end_ms: number,
        left: number,
        width: number,
        top: number,
    },
}

export type UseResizeInterface = ReturnType<typeof useResize>;