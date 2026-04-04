import { reactive } from "vue";
import { TimelineInterface, UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { TimelineFrameInterface } from "../../types/timeline";

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
        }
    });

    const selectFrame = (event: PointerEvent, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number) => {
        state.selected.frame = frame;
        state.selected.uuid = uuid;
    }

    const deselectFrame = () => {
        state.selected.frame = null;
        state.selected.uuid = null;
    }

    const toggleFrame = (event: PointerEvent, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number) => {
        if(state.selected.uuid === uuid) {
            deselectFrame();
        } else {
            selectFrame(event, frame, container, uuid);
        }
    }

    return {
        state,
        selectFrame,
        deselectFrame,
        toggleFrame,
    }
}

export interface FrameInterface {
    selected: {
        frame: TimelineFrameInterface | null,
        uuid: string | number | null,
    }
}

export type UseFrameInterface = ReturnType<typeof useFrames>;