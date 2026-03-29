import { reactive } from "vue"
import { TimelineRangeInterface, TimelineSectionInterface } from '../types/timeline';
import { TimelineConfigInterface } from "./timelineConfig";

export const useTimeline = (
    {
        config,
        range = () => ({
            start_seconds: 0,
            end_seconds: 24 * 60 * 60
        }),
        sections = () => [],
    }: {
        config: TimelineConfigInterface,
        range?: () => TimelineRangeInterface,
        sections?: () => TimelineSectionInterface[],
    }
): TimelineInterface => {

    const data = reactive<TimelineInterface>({
        range: range(),
        sections: sections()
    })

    return data
}

export interface TimelineInterface {
    range: TimelineRangeInterface,
    sections: TimelineSectionInterface[]
}