import { reactive, watch } from "vue"
import { TimelineRangeArgInterface, TimelineRangeInterface, TimelineSectionInterface } from '../types/timeline';
import { TimelineConfigInterface } from "./timelineConfig";

export interface TimelineInterface {
    sections: TimelineSectionInterface[],
}

export const useTimeline = (
    {
        config,
        sections = () => [],
    }: {
        config: TimelineConfigInterface,
        sections?: () => TimelineSectionInterface[],
    }
): TimelineInterface => {

    const data = reactive<TimelineInterface>({
        sections: sections(),
    })

    return data;
}