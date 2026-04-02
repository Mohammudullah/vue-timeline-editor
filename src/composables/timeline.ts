import { reactive, Ref, watch } from "vue"
import { TimelineRangeArgInterface, TimelineRangeInterface, TimelineSectionInterface } from '../types/timeline';
import { TimelineConfigInterface } from "./timelineConfig";

export interface TimelineInterface {
    sections: TimelineSectionInterface[],
    container: HTMLElement | null,
    editor: HTMLElement | null,
    scrollPaneEl: HTMLElement | null,
}

export const useTimeline = (
    {
        config,
        container,
        editor,
        scrollPaneEl,
        sections = () => [],
    }: {
        config: TimelineConfigInterface,
        container: Ref<HTMLElement | null>,
        editor: Ref<HTMLElement | null>,
        scrollPaneEl: Ref<HTMLElement | null>,
        sections?: () => TimelineSectionInterface[],
    }
): TimelineInterface => {

    const data = reactive<TimelineInterface>({
        container: null,
        editor: null,
        scrollPaneEl: null,
        sections: sections(),
    })


    watch([container, editor, scrollPaneEl], ([newContainer, newEditor, newScrollPaneEl]) => {
        data.container = newContainer;
        data.editor = newEditor;
        data.scrollPaneEl = newScrollPaneEl;
    })

    return data;
}