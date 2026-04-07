import { computed, reactive, Ref, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseFeaturesType } from "./features";
import { UseDndType } from "./dnd";
import { start } from "node:repl";

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

    const activeRowCache = {
        emptyAreas: {
            starts: [] as number[],
            ends: [] as number[],
        },
        frames: {
            starts: [] as number[],
            ends: [] as number[],
        },
        rowUuid: null as string | number | null
    } 

    const state = reactive<SnappingStateInterface>({
        draggingPlaceholder: {
            left: 0, 
            top: 0,
            start_ms: 0,
            end_ms: 0,
        },

    });


    const cacheActiveRow = (rowUuid: string | number) => {

        // cache empty areas in the active row to help snapping frames to empty areas and protect from dragging to non-empty areas
        const emptyAreas = timeline.state.sectionRowsByUuid[rowUuid].emptyAreas;
        activeRowCache.emptyAreas.starts = emptyAreas.map(area => area.start_ms);
        activeRowCache.emptyAreas.ends = emptyAreas.map(area => area.end_ms);


        // also cache frames in the active row to help snapping frames to empty areas and protect from dragging to non-empty areas

        activeRowCache.frames.starts = activeRowCache.frames.ends = [];
        Object.values(timeline.state.sectionFramesByUuid).filter(frame => frame.rowUuid === rowUuid).map(frame => {
            activeRowCache.frames.starts.push(frame.start_ms);
            activeRowCache.frames.ends.push(frame.end_ms);
        });

        activeRowCache.rowUuid = rowUuid;
    }


    const snapRows = (top: number | null, left: number | null) => {

        const editorRelativeY = dnd.value?.state.pointer.editorRelativeY ?? 0;
        const pointerOverRow = dnd.value?.state.pointer.over.rowUuid ?? null;

        if(!pointerOverRow) {
            return {
                top: editorRelativeY,
                left,
            }
        }

        const row = timeline.state.sectionRowsByUuid[pointerOverRow];

        return {
            top: row ? row.editorRelativeTop : editorRelativeY,
            left,
        }
    }

    // snap frames to empty areas in the row, this will help users to snap frames to existing empty areas in the row while dragging
    // also, this function will protect frames from being dragged to non-empty areas in the row 

    const snapFrames = ( top: number | null, left: number | null ) => {

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
                left
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
        };
    };


    const snapEdges = (top: number | null, left: number | null) => {
        

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
                : left )
        }

        return data;
    }

    let lastNotOverflowedPosition = {
        top: null as number | null,
        left: null as number | null,
    }

    const protectOverLappingFrames = (top: number | null, left: number | null) => {
        
        // if pointer or frame any of them are over a frame, then return last position which is not overlapping, 

        const pointerOnMs = dnd.value?.state.pointer.on_ms;
        const frameStart = dnd.value?.state.draggingPlaceholder.start_ms;
        const frameEnd = dnd.value?.state.draggingPlaceholder.end_ms;

        if(pointerOnMs === undefined || frameStart === undefined || frameEnd === undefined) {

            lastNotOverflowedPosition.top = top;
            lastNotOverflowedPosition.left = left;

            return {
                top,
                left,
            }
        }
        
        let pointerOverLapping = false;
        let frameOverLapping = false;

        for(let i = 0; i <= activeRowCache.frames.starts.length; i++) {

            const existingFrameStart = activeRowCache.frames.starts[i];
            const existingFrameEnd = activeRowCache.frames.ends[i];

            if(existingFrameStart === undefined || existingFrameEnd === undefined) {
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

                return {
                    top,
                    left: newLeft,
                }
            }
        
        }

        if(pointerOverLapping || frameOverLapping) {


            return {
                top: lastNotOverflowedPosition.top,
                left: lastNotOverflowedPosition.left,
            }
        }

        lastNotOverflowedPosition.top = top;
        lastNotOverflowedPosition.left = left;

        return {
            top,
            left,
        };

    }


    const snapGuides = (top: number | null, left: number | null) => {
        return {
            top,
            left
        }
    }


    const snapTimes = (top: number | null, left: number | null) => {
        return {
            top,
            left
        }
    }


    const pipeline = [
        snapRows,
        snapFrames,
        snapEdges,
        protectOverLappingFrames,
        snapGuides,
        snapTimes,
    ]


    const snapPipeline = () => {
        if(!dnd.value || !dnd.value.state.dragging) return;

        const currentRowUuid = dnd.value.state.pointer.over.rowUuid;

        //first cache if it's new row
        if(currentRowUuid && currentRowUuid != activeRowCache.rowUuid) {
            cacheActiveRow(currentRowUuid);
        }
        
        const snapPosition = {
            top: null as number | null,
            left: null as number | null,
        }

        pipeline.forEach((snapFunction) => {
            const snapResult = snapFunction(snapPosition.top, snapPosition.left) as { top: number | null; left: number | null };

            snapPosition.top = snapResult.top;
            snapPosition.left = snapResult.left;
            
        });


        state.draggingPlaceholder.top = snapPosition.top == null ? dnd?.value?.state.draggingPlaceholder.top ?? 0 : snapPosition.top;
        state.draggingPlaceholder.left = snapPosition.left == null ? dnd.value?.state.draggingPlaceholder.left ?? 0 : snapPosition.left;
    }

    watch([() => dnd.value?.state.pointer], snapPipeline, { deep: true });

    watch(() => dnd.value?.state.dragging, (dragging) => {
        if(!dragging) {
            lastNotOverflowedPosition = {
                top: null,
                left: null,
            }
        }
    });

    return {
        state
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