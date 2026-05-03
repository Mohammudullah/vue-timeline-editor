import { reactive, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { TimelineFrameByUuidInterface } from "../../types/timeline";

export const useFrames = ({
    timeline,
    timelineConfig,
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
}) => {

    const state = reactive<FrameInterface>({
        selected: {
            frame: null,
            uuid: null,
            container: null,
        }
    });

    const selectFrame = (event: PointerEvent, frame: TimelineFrameByUuidInterface, container: HTMLDivElement, uuid: string | number) => {
        state.selected.frame = frame;
        state.selected.uuid = uuid;
        state.selected.container = container;
    }

    const deselectFrame = () => {
        state.selected.frame = null;
        state.selected.uuid = null;
        state.selected.container = null;
    }

    const toggleFrame = (event: PointerEvent, frame: TimelineFrameByUuidInterface, container: HTMLDivElement, uuid: string | number) => {
        if(state.selected.uuid === uuid) {
            deselectFrame();
        } else {
            selectFrame(event, frame, container, uuid);
        }
    }

    const syncSelectedContainer = (container: HTMLDivElement | null, frame: TimelineFrameByUuidInterface, uuid: string | number) => {
        if(state.selected.uuid === uuid) {
            state.selected.container = container;
        }
    }

    const getFramePointerData = () => {

        //calculate the pointer position relative to the container
        const rect = state.selected.container?.getBoundingClientRect();

        return {
            width: state.selected.container?.clientWidth ?? 0,
            height: state.selected.container?.clientHeight ?? 0,
            pointerX: rect ? timeline.state.pointer.clientX - rect.left : 0,
            pointerY: rect ? timeline.state.pointer.clientY - rect.top : 0,
        }
    }

    watch(() => timeline.state.sectionFramesByUuid, (frames) => {
        if(state.selected.uuid) {
            const frame = frames[state.selected.uuid] ?? null;

            if(frame) {
                state.selected.frame = frame;
            }
            else {
                deselectFrame();
            }
        }
    }, { deep: true })

    return {
        state,
        selectFrame,
        deselectFrame,
        toggleFrame,
        syncSelectedContainer,
        getFramePointerData,
    }
}

export interface FrameInterface {
    selected: {
        frame: TimelineFrameByUuidInterface | null,
        uuid: string | number | null,
        container: HTMLDivElement | null,
    }
}

export type UseFrameInterface = ReturnType<typeof useFrames>;