import { onBeforeUnmount, onMounted, reactive, Ref, watch } from "vue"
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
    pointer: {
        clientX: number,
        clientY: number,
        relativeX: number,
        relativeY: number,
        editorRelativeX: number,
        editorRelativeY: number,
        on_ms: number,
        over: {
            sectionUuid: string | number | null,
            rowUuid: string | number | null,
        },
        edgeScroll: boolean,
    }
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

        pointer: {
            clientX: 0,
            clientY: 0,

            relativeX: 0,
            relativeY: 0,

            editorRelativeX: 0,
            editorRelativeY: 0,

            on_ms: 0,

            over: {
                sectionUuid: null,
                rowUuid: null,
            },

            edgeScroll: false,
        }
    })


    const rowsCenterCache = [] as {
        sectionUuid: string | number,
        rowUuid: string | number,
        center: number,
    }[];



    const calculateRowsCenterCache = () => {
        Object.values(state.sectionRowsByUuid).forEach((row) => {
            const center = row.editorRelativeTop + config.rows.height / 2;
            rowsCenterCache.push({
                sectionUuid: row.sectionUuid,
                rowUuid: row.uuid,
                center,
            });
        });
    }


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
            linkGroupUuid: frame.linkGroupUuid,
            meta: frame.meta,
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

        //clear existing data
        state.sectionUuids = [];
        state.sectionRowUuids = {};
        state.sectionFrameUuids = {};
        state.sectionRowsByUuid = {};
        state.sectionFramesByUuid = {};
        state.sectionsByUuid = {};
        rowsCenterCache.length = 0;
        state.sectionsCount = 0;
        state.rowsCount = 0;
        state.framesCount = 0;
        

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


        calculateRowsCenterCache();
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
        // Capture the frame's previous row before re-registering, so we can
        // refresh empty areas for both old and new rows when the frame moves
        // between rows.
        const previousRowUuid = state.sectionFramesByUuid[uuid]?.rowUuid;

        registerFrame(renderFrame(frame, frame.rowUuid, frame.sectionUuid), true);

        // Recompute empty areas for affected rows. Without this, downstream
        // snapping caches would keep using empty areas calculated from the
        // frame's pre-update position, leading to wrong overlap/snap decisions
        // when subsequent frames are dragged onto the same row.
        const rangeEnd = config.range.end_seconds * 1000;
        const refreshRow = (rowUuid: string | number) => {
            const row = state.sectionRowsByUuid[rowUuid];
            if (row) row.emptyAreas = getEmptyAreasOfRow(rowUuid, 0, rangeEnd);
        };
        refreshRow(frame.rowUuid);
        if (previousRowUuid != null && previousRowUuid !== frame.rowUuid) {
            refreshRow(previousRowUuid);
        }
    }


    const updatePointerPosition = (event: PointerEvent) => {

        if(!scrollPaneEl.value) return;

        const rect = scrollPaneEl.value?.getBoundingClientRect();

        if(!rect) return;


        state.pointer.clientX = event.clientX;
        state.pointer.clientY = event.clientY;

        // Pointer position inside the visible scroll pane
        state.pointer.relativeX = event.clientX - rect.left;
        state.pointer.relativeY = event.clientY - rect.top;

        scrollOnPointerEdge(event);

        // Pointer position inside the full editor content
        state.pointer.editorRelativeX = state.pointer.relativeX + scrollPaneEl.value.scrollLeft;
        state.pointer.editorRelativeY = state.pointer.relativeY + scrollPaneEl.value.scrollTop;

        state.pointer.on_ms =
            (state.pointer.editorRelativeX - config.editor.paddingLeft) /
            config.cols.pixelPerMs;

        setPointerOverRow(state.pointer.editorRelativeY);
    }


    // A binary search function to find the closest row center to the given y position
    const setPointerOverRow = (y: number) => {
        let top = 0;
        let bottom = rowsCenterCache.length - 1;

        while (top <= bottom) {
            const mid = (top + bottom) >> 1;
            const center = rowsCenterCache[mid].center;

            if (center < y) top = mid + 1;
            else if (center > y) bottom = mid - 1;
            else {
                const row = rowsCenterCache[mid];
                state.pointer.over.sectionUuid = row.sectionUuid;
                state.pointer.over.rowUuid = row.rowUuid;
                return;
            }
        }

        const l = rowsCenterCache[top];
        const r = rowsCenterCache[bottom];

        const row =
            !l ? r :
            !r ? l :
            Math.abs(l.center - y) < Math.abs(r.center - y) ? l : r;

        if (!row) return;

        state.pointer.over.sectionUuid = row.sectionUuid;
        state.pointer.over.rowUuid = row.rowUuid;
    };


    const scrollOnPointerEdge = (event: PointerEvent) => {;

        if(!scrollPaneEl.value || !state.pointer.edgeScroll) return;

        const rect = scrollPaneEl.value.getBoundingClientRect();

        // Tighter than before (was 50px) so the last visible row isn't fully
        // inside the scroll-trigger zone — the user can drop on it without
        // the pane auto-scrolling away. Speed is ramped linearly with
        // proximity so the very edge still scrolls fast, while just inside
        // the threshold barely moves.
        const scrollThreshold = 15;
        const maxScrollStep = 12;

        const rampedStep = (distance: number) =>
            Math.max(1, Math.round(maxScrollStep * (1 - distance / scrollThreshold)));

        let scrollX = 0;
        let scrollY = 0;

        const distLeft = event.clientX - rect.left;
        const distRight = rect.right - event.clientX;
        const distTop = event.clientY - rect.top;
        const distBottom = rect.bottom - event.clientY;

        if (distLeft < scrollThreshold) scrollX = -rampedStep(distLeft);
        else if (distRight < scrollThreshold) scrollX = rampedStep(distRight);

        if (distTop < scrollThreshold) scrollY = -rampedStep(distTop);
        else if (distBottom < scrollThreshold) scrollY = rampedStep(distBottom);

        if(scrollX !== 0 || scrollY !== 0) {
            scrollPaneEl.value.scrollBy(scrollX, scrollY);
        }

    }


    const enableEdgeScrolling = () => {
        state.pointer.edgeScroll = true;
    }


    const disableEdgeScrolling = () => {
        state.pointer.edgeScroll = false;
    }


    watch([container, editor, scrollPaneEl], ([newContainer, newEditor, newScrollPaneEl]) => {
        state.container = newContainer;
        state.editor = newEditor;
        state.scrollPaneEl = newScrollPaneEl;
    }) 


    onMounted(() => {
        editor.value?.addEventListener('pointermove', updatePointerPosition)
        editor.value?.addEventListener('pointerdown', updatePointerPosition)
    })

    onBeforeUnmount(() => {
        editor.value?.removeEventListener('pointermove', updatePointerPosition)
        editor.value?.removeEventListener('pointerdown', updatePointerPosition)
    })

    return {
        state,
        initSections,
        updateFrame,
        updateRow,
        enableEdgeScrolling,
        disableEdgeScrolling,

    };
}

export type UseTimelineInterface = ReturnType<typeof useTimeline>;