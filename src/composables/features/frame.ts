import { reactive } from "vue";
import { TimelineInterface, UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { TimelineFrameByUuidInterface, TimelineFrameInterface } from "../../types/timeline";

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

    return {
        state,
        selectFrame,
        deselectFrame,
        toggleFrame,
        syncSelectedContainer,
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