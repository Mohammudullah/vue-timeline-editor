import { reactive, Ref, watch } from "vue"
import { TimelineFrameByUuidBasicInterface, TimelineFrameByUuidInterface, TimelineFrameInterface, TimelineRowByUuidInterface, TimelineSectionByUuidInterface, TimelineSectionInterface } from '../types/timeline';
import { TimelineConfigInterface } from "./timelineConfig";
import useUtils from "./utils";

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
    sectionsCount: number,
    rowsCount: number,
    framesCount: number,
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

    const { calculateFrameWidth } = useUtils();

    const state = reactive<TimelineInterface>({
        container: null,
        editor: null,
        scrollPaneEl: null,
        sectionRowsByUuid: {}, 
        sectionFramesByUuid: {},
        sectionsByUuid: {},

        sectionsCount: 0,
        rowsCount: 0,
        framesCount: 0,

        sectionUuids: [],
        sectionRowUuids: {},
        sectionFrameUuids: {},
    })


    const renderFrame = (frame: TimelineFrameByUuidBasicInterface | TimelineFrameByUuidInterface | TimelineFrameInterface, rowUuid: string | number, sectionUuid: string | number) => {
        //calculate frame left and width which will help in hit pointer interactions
        const frameLeft = (frame.start_ms * config.cols.pixelPerMs) + config.editor.paddingLeft;
        const width  = calculateFrameWidth(frame.start_ms, frame.end_ms, config.cols.pixelPerMs);
        
        return {
            uuid: frame.uuid,
            title: frame.title,
            start_ms: frame.start_ms,
            end_ms: frame.end_ms,
            rowUuid: rowUuid,
            sectionUuid: sectionUuid,
            editorRelativeLeft: frameLeft,
            width: width,
        }
    }


    const registerFrame = (renderedFrame: ReturnType<typeof renderFrame>, updating: boolean = false) => {

        if(updating) {
            const existingFrame = state.sectionFramesByUuid[renderedFrame.uuid];

            //clear existing frame uuid from the row's frame uuid array to avoid duplicates, it will be added again later in the function
            if(existingFrame) {
                const existingRowFrameUuids = state.sectionFrameUuids[existingFrame.rowUuid];
                if(existingRowFrameUuids) {
                    state.sectionFrameUuids[existingFrame.rowUuid] = existingRowFrameUuids.filter(uuid => uuid !== renderedFrame.uuid);
                }
            }
        }

        state.sectionFramesByUuid[renderedFrame.uuid] = renderedFrame;

        if(!state.sectionFrameUuids[renderedFrame.rowUuid]) {
            state.sectionFrameUuids[renderedFrame.rowUuid] = [];
        }

        state.sectionFrameUuids[renderedFrame.rowUuid].push(renderedFrame.uuid);

        
    }


    const initSections = (sections: TimelineSectionInterface[]) => {



        sections.forEach((section, index) => {

            //initialize section row and frame uuids
            state.sectionUuids.push(section.uuid);
            state.sectionRowUuids[section.uuid] = [];

            //update counts
            state.sectionsCount++;

            let firstRowTop = 0;
            let lastRowBottom = 0;

            section.rows.forEach((row, rowIndex) => {

                //update counts and create array to store row uuids
                state.rowsCount++;
                state.sectionFrameUuids[row.uuid] = [];
                
                row.frames.forEach((frame, frameIndex) => {

                    //update counts
                    state.framesCount++;

                    registerFrame(renderFrame(frame, row.uuid, section.uuid));
                })


                //store section row meta, calculate row top and bottom which will help in hit pointer interactions
                //like dragging and clicking to add frame
                
                const rowBottom = state.rowsCount * config.rows.height + (state.sectionsCount * config.sections.labelHeight);
                const rowTop = rowBottom - config.rows.height;

                if(rowIndex === 0) {
                    firstRowTop = rowTop;
                }
                if(rowIndex === section.rows.length - 1) {
                    lastRowBottom = rowBottom;
                }

                state.sectionRowsByUuid[row.uuid] = {
                    uuid: row.uuid,
                    title: row.title,
                    sectionUuid: section.uuid,
                    editorRelativeTop: rowTop,
                    editorRelativeBottom: rowBottom,
                    emptyAreas: getEmptyAreasOfRow(row.uuid, 0, config.range.end_seconds * 1000),
                }

                state.sectionRowUuids[section.uuid].push(row.uuid);
            })

            //store section data
            state.sectionsByUuid[section.uuid] = {
                title: section.title,
                uuid: section.uuid,
                editorRelativeTop: firstRowTop - config.sections.labelHeight,
                editorRelativeBottom: lastRowBottom,
            }

        })
    }


    const getEmptyAreasOfRow = (rowUuid: string | number, start_ms: number, end_ms: number) => {
        const emptyAreas: { start_ms: number; end_ms: number }[] = [];

        const frames = Object.values(state.sectionFramesByUuid).filter(frame => frame.rowUuid === rowUuid);
        const sortedFrames = frames.sort((a, b) => a.start_ms - b.start_ms);

        let cursor = start_ms;

        for (const frame of sortedFrames) {
            if (frame.start_ms > cursor) {
                emptyAreas.push({ start_ms: cursor, end_ms: frame.start_ms });
            }
            cursor = Math.max(cursor, frame.end_ms);
        }

        if (cursor < end_ms) {
            emptyAreas.push({ start_ms: cursor, end_ms });
        }

        return emptyAreas;
    }

    const updateRow = (uuid: string | number, row: {title: string, uuid: string | number}) => {
        const existingRow = state.sectionRowsByUuid[uuid];

        if(existingRow) {
            state.sectionRowsByUuid[uuid] = {
                ...existingRow,
                ...row,
            }
        }
    }


    const updateFrame = (uuid: string | number, frame: TimelineFrameByUuidBasicInterface) => {
        registerFrame(renderFrame(frame, frame.rowUuid, frame.sectionUuid), true);

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