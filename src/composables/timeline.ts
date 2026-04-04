import { reactive, Ref, toValue, watch } from "vue"
import { TimelineFrameByUuidInterface, TimelineFrameInterface, TimelineRangeArgInterface, TimelineRangeInterface, TimelineRowByUuidInterface, TimelineRowInterface, TimelineSectionByUuidInterface, TimelineSectionInterface } from '../types/timeline';
import { TimelineConfigInterface } from "./timelineConfig";
import { json } from "node:stream/consumers";

export interface TimelineInterface {
    container: HTMLElement | null,
    editor: HTMLElement | null,
    scrollPaneEl: HTMLElement | null,
    sectionRowsByUuid: Record<string | number, TimelineRowByUuidInterface>,
    sectionFramesByUuid: Record<string | number, TimelineFrameByUuidInterface>,
    sectionsByUuid: Record<string | number, TimelineSectionByUuidInterface>,

    sectionUuids: (string | number)[],
    sectionRowUuids: Record<string | number, (string | number)[]>,
    sectionFrameUuids: Record<string | number, (string | number)[]>,
    sections: TimelineSectionInterface[],
}

export const useTimeline = (
    {
        config,
        container,
        editor,
        scrollPaneEl,
    }: {
        config: TimelineConfigInterface,
        container: Ref<HTMLElement | null>,
        editor: Ref<HTMLElement | null>,
        scrollPaneEl: Ref<HTMLElement | null>,
    }
) => {

    

    const state = reactive<TimelineInterface>({
        container: null,
        editor: null,
        scrollPaneEl: null,
        sectionRowsByUuid: {}, 
        sectionFramesByUuid: {},
        sectionsByUuid: {},

        sectionUuids: [],
        sectionRowUuids: {},
        sectionFrameUuids: {},
        sections: [],
    })


    const initSections = (sections: TimelineSectionInterface[]) => {



        sections.forEach((section, index) => {
            state.sectionsByUuid[section.uuid] = {
                title: section.title,
                uuid: section.uuid,
            }

            state.sectionUuids.push(section.uuid);
            state.sectionRowUuids[section.uuid] = [];

            section.rows.forEach((row, rowIndex) => {
                state.sectionRowsByUuid[row.uuid] = {
                    uuid: row.uuid,
                    title: row.title,
                    sectionUuid: section.uuid,
                }

                state.sectionRowUuids[section.uuid].push(row.uuid);
                state.sectionFrameUuids[row.uuid] = [];

                row.frames.forEach((frame, frameIndex) => {
                    state.sectionFramesByUuid[frame.uuid] = {
                        uuid: frame.uuid,
                        title: frame.title,
                        start_ms: frame.start_ms,
                        end_ms: frame.end_ms,
                        rowUuid: row.uuid,
                        sectionUuid: section.uuid,
                    }

                    state.sectionFrameUuids[row.uuid].push(frame.uuid);
                })
            })
        })

        state.sections = sections;
    }

    const updateRow = (uuid: string | number, row: {title: string, uuid: string | number}) => {
        const existingRow = state.sectionRowsByUuid[uuid];

        if(existingRow) {
            state.sectionRowsByUuid[uuid] = {
                ...existingRow,
                ...row,
            }
        }

        //update the row in the section state
        const sectionUuid = state.sectionRowsByUuid[uuid].sectionUuid;
        const sectionIndex = state.sections.findIndex(s => s.uuid === sectionUuid);
        const rowIndex = state.sections[sectionIndex].rows.findIndex(r => r.uuid === uuid);

        if(sectionIndex !== -1 && rowIndex !== -1) {
            state.sections[sectionIndex].rows[rowIndex] = {
                ...state.sections[sectionIndex].rows[rowIndex],
                ...row,
            }
        }
    }


    const updateFrame = (uuid: string | number, frame: TimelineFrameInterface) => {
        const existingFrame = state.sectionFramesByUuid[uuid];

        if(existingFrame) {
            state.sectionFramesByUuid[uuid] = {
                ...existingFrame,   
                ...frame,
            }
        }


        //update the frame in the section state
        const rowUuid = state.sectionFramesByUuid[uuid].rowUuid;
        const sectionUuid = state.sectionFramesByUuid[uuid].sectionUuid;
        const sectionIndex = state.sections.findIndex(s => s.uuid === sectionUuid);
        const rowIndex = state.sections[sectionIndex].rows.findIndex(r => r.uuid === rowUuid);
        const frameIndex = state.sections[sectionIndex].rows[rowIndex].frames.findIndex(f => f.uuid === uuid);

        if(sectionIndex !== -1 && rowIndex !== -1 && frameIndex !== -1) {
            state.sections[sectionIndex].rows[rowIndex].frames[frameIndex] = {
                ...state.sections[sectionIndex].rows[rowIndex].frames[frameIndex],
                ...frame,
            }
        }
    }


    watch([container, editor, scrollPaneEl], ([newContainer, newEditor, newScrollPaneEl]) => {
        state.container = newContainer;
        state.editor = newEditor;
        state.scrollPaneEl = newScrollPaneEl;
    }) 

    return {
        state,
        initSections,
        updateFrame,
        updateRow,
    };
}

export type UseTimelineInterface = ReturnType<typeof useTimeline>;