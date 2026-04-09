import { computed, reactive, Ref, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseFeaturesType } from "./features";
import { UseDndType } from "./dnd";
import { start } from "node:repl";
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { DraggedFrameDataInterface, useDraggingEvents } from "./draggingEvents";

export const useSnapping = ({
    timeline,
    timelineConfig,
    dnd,
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    dnd: Ref<UseDndType | null>,
}) => {

    const dragging = computed(() => dnd.value?.state.dragging || false);
    
    const draggingEvents = useDraggingEvents();

    const activeRowCache = {
        emptyAreas: {
            starts: [] as number[],
            ends: [] as number[],
        },
        frames: {
            starts: [] as number[],
            ends: [] as number[],
            uuids: [] as (string | number)[],
        },
        rowUuid: null as string | number | null
    } 

    const state = reactive<SnappingStateInterface>({
        draggingPlaceholder: {
            left: 0, 
            top: 0,
            start_ms: 0,
            end_ms: 0,
        }
    });


    const cacheActiveRow = (rowUuid: string | number) => {

        // cache empty areas in the active row to help snapping frames to empty areas and protect from dragging to non-empty areas
        const emptyAreas = timeline.state.sectionRowsByUuid[rowUuid].emptyAreas;
        activeRowCache.emptyAreas.starts = emptyAreas.map(area => area.start_ms);
        activeRowCache.emptyAreas.ends = emptyAreas.map(area => area.end_ms); 


        // also cache frames in the active row to help snapping frames to empty areas and protect from dragging to non-empty areas

        activeRowCache.frames.starts = [];
        activeRowCache.frames.ends = [];
        activeRowCache.frames.uuids = [];

        Object.values(timeline.state.sectionFramesByUuid).filter(frame => frame.rowUuid === rowUuid).map(frame => {
            activeRowCache.frames.starts.push(frame.start_ms);
            activeRowCache.frames.ends.push(frame.end_ms);
            activeRowCache.frames.uuids.push(frame.uuid);
        });

        activeRowCache.rowUuid = rowUuid;
    }

    const rowsCache = [] as {
        sectionUuid: string | number,
        rowUuid: string | number,
        top: number,
    }[];


    const calculateRowsCenterCache = () => {
        Object.values(timeline.state.sectionRowsByUuid).forEach((row) => {
            const top = row.editorRelativeTop;
            rowsCache.push({
                sectionUuid: row.sectionUuid,
                rowUuid: row.uuid,
                top,
            });
        });
    }


    const setFrameOverRow = (frameTop: number) => {
        let top = 0;
        let bottom = rowsCache.length - 1;

        while (top <= bottom) {
            const mid = (top + bottom) >> 1;
            const topPosition = rowsCache[mid].top;

            if (topPosition < frameTop) {
                top = mid + 1;
            } else if (topPosition > frameTop) {
                bottom = mid - 1;
            } else {
                const row = rowsCache[mid];
                return {
                    sectionUuid: row.sectionUuid,
                    rowUuid: row.rowUuid,
                };
            }
        }

        // ❌ No fallback — only exact match allowed
        return {
            sectionUuid: null,
            rowUuid: null,
        };
    };


    const getDraggingFrameData = () : DraggedFrameDataInterface => {

        const currentRow = setFrameOverRow(state.draggingPlaceholder.top);

        return {
            initial: {
                sectionUuid: dnd.value?.state.draggingFrame.data?.sectionUuid ?? null,
                rowUuid: dnd.value?.state.draggingFrame.data?.rowUuid ?? null,
                start_ms: dnd.value?.state.draggingFrame.data?.start_ms ?? 0,
                end_ms: dnd.value?.state.draggingFrame.data?.end_ms ?? 0,
            },
            current: {
                sectionUuid: currentRow.sectionUuid,
                rowUuid: currentRow.rowUuid,
                start_ms: state.draggingPlaceholder.start_ms,
                end_ms: state.draggingPlaceholder.end_ms,
            }
        }
    }


    const snapRows = (top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {

        const editorRelativeY = timeline.state.pointer.editorRelativeY ?? 0;
        const pointerOverRow = timeline.state.pointer.over.rowUuid ?? null;

        if(!pointerOverRow) {
            return {
                top: editorRelativeY,
                left,
                startMs,
                endMs,
            }
        }

        const row = timeline.state.sectionRowsByUuid[pointerOverRow];

        return {
            top: row ? row.editorRelativeTop : editorRelativeY,
            left,
            startMs,
            endMs,
        }
    }

    // snap frames to empty areas in the row, this will help users to snap frames to existing empty areas in the row while dragging
    // also, this function will protect frames from being dragged to non-empty areas in the row 

    const snapFrames = ( top: number | null, left: number | null, startMs: number | null, endMs: number | null ) => {

        const threshold = 150000; // in ms

        const frameStartMs = dnd.value?.state.draggingPlaceholder.start_ms;
        const frameEndMs = dnd.value?.state.draggingPlaceholder.end_ms;

        if (
            activeRowCache.emptyAreas.starts.length === 0 ||
            activeRowCache.emptyAreas.ends.length === 0 ||
            frameStartMs === undefined ||
            frameEndMs === undefined
        ) {
            return {
                top,
                left,
                startMs,
                endMs,
            };
        }

        const duration = frameEndMs - frameStartMs;

        let result: { type: 'start' | 'end'; value: number } | null = null;

        // 🔷 START snap (priority)
        let closestStart: { value: number; distance: number } | null = null;

        for (const s of activeRowCache.emptyAreas.starts) {
            const distance = Math.abs(s - frameStartMs);

            if (distance <= threshold && (!closestStart || distance < closestStart.distance)) {
                closestStart = { value: s, distance };
            }
        }

        if (closestStart) {
            result = {
                type: 'start',
                value: closestStart.value,
            };
        } else {
            // 🔷 END snap
            let closestEnd: { value: number; distance: number } | null = null;

            for (const e of activeRowCache.emptyAreas.ends) {
                const distance = Math.abs(e - frameEndMs);

                if (distance <= threshold && (!closestEnd || distance < closestEnd.distance)) {
                    closestEnd = { value: e, distance };
                }
            }

            if (closestEnd) {
                result = {
                    type: 'end',
                    value: closestEnd.value,
                };
            }
        }

        let finalStart = frameStartMs;

        // 🔥 Apply snapping
        if (result) {
            finalStart =
                result.type === 'start'
                    ? result.value
                    : result.value - duration;
        }

        return { 
            top, 
            left: (finalStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
            startMs: finalStart,
            endMs: finalStart + duration,
        };
    };


    const snapEdges = (top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {
        

        // edges calculates based on current timeline config and dragging frame dimensions
        // this helps to snap to edges of editor container and also prevent dragging frame out of bounds
        const edges = {
            top: timelineConfig.sections.labelHeight,
            bottom: timelineConfig.editor.height - timelineConfig.rows.height,
            left: timelineConfig.editor.paddingLeft,
            right: timelineConfig.editor.width - (timelineConfig.editor.paddingRight + (dnd.value?.state.draggingFrame.data?.width ?? 0)),
        }


        // snap to edges if pointer is within threshold distance from edges
        // the top checks if the pointer is within the top and bottom edges, and left checks for left and right edges
        // the ultimate goal is to keep the dragging frame within the bounds of the editor container
        const data = {
            top: (dnd.value?.state.draggingPlaceholder.top ?? 0) < edges.top 
            ? edges.top 
            : ((dnd.value?.state.draggingPlaceholder.top ?? 0) > edges.bottom
                ? edges.bottom
                : top ),

            left: (dnd.value?.state.draggingPlaceholder.left ?? 0) < edges.left
            ? edges.left
            : ((dnd.value?.state.draggingPlaceholder.left ?? 0) > edges.right
                ? edges.right
                : left ),
            startMs,
            endMs,
        }

        return data;
    }

    let lastNotOverflowedPosition = {
        top: null as number | null,
        left: null as number | null,
        startMs: null as number | null,
        endMs: null as number | null,
    }

    const protectOverLappingFrames = (top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {
        
        // if pointer or frame any of them are over a frame, then return last position which is not overlapping, 

        const pointerOnMs = timeline.state.pointer.on_ms;
        const frameStart = dnd.value?.state.draggingPlaceholder.start_ms;
        const frameEnd = dnd.value?.state.draggingPlaceholder.end_ms;

        if(pointerOnMs === undefined || frameStart === undefined || frameEnd === undefined) {

            lastNotOverflowedPosition.top = top;
            lastNotOverflowedPosition.left = left;
            lastNotOverflowedPosition.startMs = startMs;
            lastNotOverflowedPosition.endMs = endMs;

            return lastNotOverflowedPosition;
        }
        
        let pointerOverLapping = false;
        let frameOverLapping = false;

        for(let i = 0; i <= activeRowCache.frames.starts.length; i++) {

            const existingFrameStart = activeRowCache.frames.starts[i];
            const existingFrameEnd = activeRowCache.frames.ends[i];
            const existingFrameUuid = activeRowCache.frames.uuids[i];

            if(existingFrameStart === undefined || existingFrameEnd === undefined || existingFrameUuid === undefined || existingFrameUuid === dnd.value?.state.draggingFrame.data?.uuid) {
                continue;
            }

            //first check if pointer is over an existing frame
            if(pointerOnMs >= existingFrameStart && pointerOnMs <= existingFrameEnd) {
                pointerOverLapping = true;
                break;
            }

            // then check if dragging frame is over an existing area
            if(
                (frameStart >= existingFrameStart && frameStart <= existingFrameEnd) 
                || (frameEnd >= existingFrameStart && frameEnd <= existingFrameEnd) 
                || (frameStart <= existingFrameStart && frameEnd >= existingFrameEnd)
            ) {
                frameOverLapping = true;
                break;
            }

        }

        //if frame is overlapping but point is in empty area try to snap to closest empty area edge based on pointer position
        if(frameOverLapping && !pointerOverLapping) {
        
            //find the empty area pointer is in
            const emptyAreaIndex = activeRowCache.emptyAreas.starts.findIndex((start, index) => {
                const end = activeRowCache.emptyAreas.ends[index];
                return pointerOnMs >= start && pointerOnMs <= end;
            });

            if(emptyAreaIndex !== -1) {

                const emptyAreaStart = activeRowCache.emptyAreas.starts[emptyAreaIndex];
                const emptyAreaEnd = activeRowCache.emptyAreas.ends[emptyAreaIndex];

                const distanceToStart = Math.abs(pointerOnMs - emptyAreaStart);
                const distanceToEnd = Math.abs(pointerOnMs - emptyAreaEnd);
                const closestEdge = distanceToStart < distanceToEnd ? emptyAreaStart : emptyAreaEnd;

                let newLeft = (closestEdge * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft;

                if(closestEdge === emptyAreaEnd) {
                    newLeft -= dnd.value?.state.draggingFrame.data?.width ?? 0;
                }

                lastNotOverflowedPosition.top = top;
                lastNotOverflowedPosition.left = newLeft;
                lastNotOverflowedPosition.startMs = closestEdge;
                lastNotOverflowedPosition.endMs = closestEdge + (frameEnd - frameStart);

                return lastNotOverflowedPosition;
            }
        
        }

        //if pointer or frame is overlapping, return last not overlapping position to protect from overlapping frames
        // the previous checks ensure that if only the pointer is in empty area.
        if(pointerOverLapping || frameOverLapping) {


            return lastNotOverflowedPosition;
        }

        lastNotOverflowedPosition.top = top;
        lastNotOverflowedPosition.left = left;
        lastNotOverflowedPosition.startMs = startMs;
        lastNotOverflowedPosition.endMs = endMs;

        return lastNotOverflowedPosition;

    }


    const snapGuides = (top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {
        return {
            top,
            left,
            startMs,
            endMs
        }
    }


    const snapTimes = (top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {

        //if frame is within snapping threshold to a time guide then snap to that time guide
        // the time guide positions are calculated based on timeline config's intervals of major grid and minor grid

        const majorGridIntervalThreshold = 15 * 60 * 1000; // in ms
        const minorGridIntervalThreshold = 15 * 60 * 1000; // in ms

        const majorGridInterval = timelineConfig.cols.majorGridInterval;
        const minorGridInterval = timelineConfig.cols.minorGridInterval;

        const frameStart = dnd.value?.state.draggingPlaceholder.start_ms;
        const frameEnd = dnd.value?.state.draggingPlaceholder.end_ms;

        if(frameStart === undefined || frameEnd === undefined) {
            return {
                top,
                left,
                startMs,
                endMs
            }
        }


        // check major grid snapping
        const majorGridStart = Math.round(frameStart / majorGridInterval) * majorGridInterval;
        const majorGridEnd = Math.round(frameEnd / majorGridInterval) * majorGridInterval;

        const distanceToMajorGridStart = Math.abs(frameStart - majorGridStart);
        const distanceToMajorGridEnd = Math.abs(frameEnd - majorGridEnd);

        if(distanceToMajorGridStart <= majorGridIntervalThreshold) {
            return {
                top,
                left: (majorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: majorGridStart,
                endMs: majorGridStart + (frameEnd - frameStart),
            }
        }


        if(distanceToMajorGridEnd <= majorGridIntervalThreshold) {
            return {
                top,
                left: ((majorGridEnd - (frameEnd - frameStart)) * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: majorGridEnd - (frameEnd - frameStart),
                endMs: majorGridEnd,
            }
        }


        // check minor grid snapping
        const minorGridStart = Math.round(frameStart / minorGridInterval) * minorGridInterval;
        const minorGridEnd = Math.round(frameEnd / minorGridInterval) * minorGridInterval;


        const distanceToMinorGridStart = Math.abs(frameStart - minorGridStart);
        const distanceToMinorGridEnd = Math.abs(frameEnd - minorGridEnd);

        if(distanceToMinorGridStart <= minorGridIntervalThreshold) {
            return {
                top,
                left: (minorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: minorGridStart,
                endMs: minorGridStart + (frameEnd - frameStart),
            }
        }

        if(distanceToMinorGridEnd <= minorGridIntervalThreshold) {
            return {
                top,
                left: ((minorGridEnd - (frameEnd - frameStart)) * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: minorGridEnd - (frameEnd - frameStart),
                endMs: minorGridEnd,
            }
        }


        return {
            top,
            left,
            startMs,
            endMs
        }
    }


    const pipeline = [
        snapRows,
        snapFrames,
        snapTimes,
        snapGuides,
        snapEdges,
        protectOverLappingFrames,
    ]


    const snapPipeline = () => {
        if(!dnd.value || !dnd.value.state.dragging) return;

        const currentRowUuid = timeline.state.pointer.over.rowUuid;

        //first cache if it's new row
        if(currentRowUuid && currentRowUuid != activeRowCache.rowUuid) {
            cacheActiveRow(currentRowUuid);
        }
        
        let snapPosition = {
            top: null as number | null,
            left: null as number | null,
            startMs: null as number | null,
            endMs: null as number | null,
        }

        pipeline.forEach((snapFunction) => {
            snapPosition = snapFunction(snapPosition.top, snapPosition.left, snapPosition.startMs, snapPosition.endMs) as { top: number | null; left: number | null; startMs: number | null; endMs: number | null };

        });


        state.draggingPlaceholder.top = snapPosition.top == null ? dnd?.value?.state.draggingPlaceholder.top ?? 0 : snapPosition.top;
        state.draggingPlaceholder.left = snapPosition.left == null ? dnd.value?.state.draggingPlaceholder.left ?? 0 : snapPosition.left;
        state.draggingPlaceholder.start_ms = snapPosition.startMs == null ? dnd.value?.state.draggingPlaceholder.start_ms ?? 0 : snapPosition.startMs;
        state.draggingPlaceholder.end_ms = snapPosition.endMs == null ? dnd.value?.state.draggingPlaceholder.end_ms ?? 0 : snapPosition.endMs;
    }

    watch([() => timeline.state.pointer.clientX, () => timeline.state.pointer.clientY], snapPipeline, { deep: true });

    watch(() => dnd.value?.state.dragging, (dragging) => {
        if(!dragging) {
            lastNotOverflowedPosition = {
                top: null,
                left: null,
                startMs: null,
                endMs: null,
            }
        }
        else {
            calculateRowsCenterCache();
        }
    });


    //manage dragging events based on dnd event
    dnd.value?.onDragStart((frame, event) => draggingEvents.triggerOnDragStart(frame, event), 'snappingComposableOnDragStart');
    dnd.value?.onDragEnd((frame, frameData, event) => draggingEvents.triggerOnDragEnd(frame, getDraggingFrameData(), event), 'snappingComposableOnDragEnd');
    dnd.value?.onDragCancel((frame, frameData, event) => draggingEvents.triggerOnDragCancel(frame, getDraggingFrameData(), event), 'snappingComposableOnDragCancel');
    dnd.value?.onDrop((frame, frameData, event) => draggingEvents.triggerOnDrop(frame, getDraggingFrameData(), event), 'snappingComposableOnDrop');


    return {
        state,
        onDragStart: draggingEvents.onDragStart,
        onDragEnd: draggingEvents.onDragEnd,
        onDragCancel: draggingEvents.onDragCancel,
        onDrop: draggingEvents.onDrop,
        removeEvent: draggingEvents.removeEvent,
    }
    
}

export type UseSnappingInterface = ReturnType<typeof useSnapping>;

export interface SnappingStateInterface {
    draggingPlaceholder: {
        left: number,
        top: number,
        start_ms: number,
        end_ms: number,
    }
}