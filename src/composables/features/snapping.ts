import { computed, reactive, Ref, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseFeaturesType } from "./features";
import { DraggingPlaceholderInterface, UseDndType } from "./dnd";
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { DraggedFrameDataInterface, FrameDataItem, ResizedFrameDataInterface, useDraggingEvents } from "./draggingEvents";
import { UseResizeInterface } from "./resize";
import useUtils from "../utils";

export const useSnapping = ({
    timeline,
    timelineConfig,
    dnd,
    resize,
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    dnd: Ref<UseDndType | null>,
    resize: Ref<UseResizeInterface | null>,
}) => {

    const dragging = computed(() => dnd.value?.state.dragging || false);
    const resizing = computed(() => resize.value?.state.resizing || false);
    
    const draggingEvents = useDraggingEvents();
    const { calculateFrameWidth } = useUtils();

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
        // Validated snapped positions for all active drag ghosts, keyed by frame uuid.
        draggingPlaceholders: {},
        // Validated snapped positions for all active resize ghosts, keyed by frame uuid.
        resizingPlaceholders: {},
        // Active snap guide markers populated each pipeline run; consumers (e.g.
        // <SnapGuideLines/>) render highlighted lines while dragging.
        dragSnapGuides: [],
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

        const primaryUuid = dnd.value?.state.draggingFrame.uuid;
        const primaryPlaceholder = primaryUuid != null ? state.draggingPlaceholders[primaryUuid] : null;
        const currentRow = setFrameOverRow(primaryPlaceholder?.top ?? 0);

        const initial: FrameDataItem[] = [];
        const current: FrameDataItem[] = [];

        // Always put the primary first, then the rest.
        const entries = Object.values(state.draggingPlaceholders).sort((a, b) =>
            a.uuid === primaryUuid ? -1 : b.uuid === primaryUuid ? 1 : 0
        );

        entries.forEach(entry => {
            const originalFrame = timeline.state.sectionFramesByUuid[entry.uuid];
            initial.push({
                uuid: entry.uuid,
                sectionUuid: originalFrame?.sectionUuid ?? null,
                rowUuid: originalFrame?.rowUuid ?? null,
                start_ms: originalFrame?.start_ms ?? 0,
                end_ms: originalFrame?.end_ms ?? 0,
            });
            const isPrimary = entry.uuid === primaryUuid;
            current.push({
                uuid: entry.uuid,
                sectionUuid: isPrimary ? currentRow.sectionUuid : (originalFrame?.sectionUuid ?? null),
                rowUuid: isPrimary ? currentRow.rowUuid : entry.rowUuid,
                start_ms: entry.start_ms,
                end_ms: entry.end_ms,
            });
        });

        return { initial, current };
    }
    
    
    const getResizingFrameData = () : ResizedFrameDataInterface => {

        const primaryUuid = resize.value?.state.resizingFrame.uuid;

        const initial: FrameDataItem[] = [];
        const current: FrameDataItem[] = [];

        const entries = Object.values(state.resizingPlaceholders).sort((a, b) =>
            a.uuid === primaryUuid ? -1 : b.uuid === primaryUuid ? 1 : 0
        );

        entries.forEach(entry => {
            const originalFrame = timeline.state.sectionFramesByUuid[entry.uuid];
            initial.push({
                uuid: entry.uuid,
                sectionUuid: originalFrame?.sectionUuid ?? null,
                rowUuid: originalFrame?.rowUuid ?? null,
                start_ms: originalFrame?.start_ms ?? 0,
                end_ms: originalFrame?.end_ms ?? 0,
            });
            current.push({
                uuid: entry.uuid,
                sectionUuid: originalFrame?.sectionUuid ?? null,
                rowUuid: originalFrame?.rowUuid ?? null,
                start_ms: entry.start_ms,
                end_ms: entry.end_ms,
            });
        });

        return { initial, current };
    }


    const snapRows = (dependency: SnapDependencyInterface, top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {

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

    const snapFrames = (dependency: SnapDependencyInterface, top: number | null, left: number | null, startMs: number | null, endMs: number | null ) => {

        const threshold = 150000; // in ms

        if (
            activeRowCache.emptyAreas.starts.length === 0 ||
            activeRowCache.emptyAreas.ends.length === 0 ||
            dependency.frame.start_ms === undefined ||
            dependency.frame.end_ms === undefined
        ) {
            return {
                top,
                left,
                startMs,
                endMs,
            };
        }

        const duration = dependency.frame.end_ms - dependency.frame.start_ms;

        let result: { type: 'start' | 'end'; value: number } | null = null;

        // 🔷 START snap (priority)
        let closestStart: { value: number; distance: number } | null = null;

        for (const s of activeRowCache.emptyAreas.starts) {
            const distance = Math.abs(s - dependency.frame.start_ms);

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
                const distance = Math.abs(e - dependency.frame.end_ms);

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

        let finalStart = dependency.frame.start_ms;

        // 🔥 Apply snapping
        if (result) {
            finalStart =
                result.type === 'start'
                    ? result.value
                    : result.value - duration;

            // Record the snapped edge as an active guide.
            state.dragSnapGuides.push({
                ms: result.value,
                left: (result.value * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                source: 'frame-edge',
            });
        }

        return { 
            top, 
            left: (finalStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
            startMs: finalStart,
            endMs: finalStart + duration,
        };
    };


    let lastNotOverflowedPosition = {
        top: null as number | null,
        left: null as number | null,
        startMs: null as number | null,
        endMs: null as number | null,
    }

    // Tracks the last position where the WHOLE group (primary + every member row)
    // was unblocked. Advanced only after the post-pipeline group overlap check
    // passes. Used to revert atomically when any member would overlap.
    let lastGroupSafeDragPosition = {
        top: null as number | null,
        left: null as number | null,
        startMs: null as number | null,
        endMs: null as number | null,
    }

    let lastGroupSafeResizePosition = {
        top: null as number | null,
        left: null as number | null,
        startMs: null as number | null,
        endMs: null as number | null,
    }

    // Returns frames sharing `primaryUuid`'s linkGroupUuid (excluding the primary
    // itself). Reads directly from timeline state — independent of any feature's
    // reactive update timing, so it's safe to use from tick 1.
    const getLinkedSiblings = (primaryUuid: string | number) => {
        const primary = timeline.state.sectionFramesByUuid[primaryUuid];
        if (!primary || primary.linkGroupUuid == null) return [];
        const linkUuid = primary.linkGroupUuid;
        return Object.values(timeline.state.sectionFramesByUuid).filter(
            f => f.linkGroupUuid === linkUuid && f.uuid !== primaryUuid
        );
    };

    const protectOverLappingFrames = (dependency: SnapDependencyInterface, top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {
        
        // if pointer or frame any of them are over a frame, then return last position which is not overlapping, 

        const pointerOnMs = timeline.state.pointer.on_ms;

        if(pointerOnMs === undefined || dependency.frame.start_ms === undefined || dependency.frame.end_ms === undefined) {

            lastNotOverflowedPosition.top = top;
            lastNotOverflowedPosition.left = left;
            lastNotOverflowedPosition.startMs = startMs;
            lastNotOverflowedPosition.endMs = endMs;

            return lastNotOverflowedPosition;
        }
        
        let pointerOverLapping = false;
        let frameOverLapping = false;
        let overlappingFrameStart: number | undefined;
        let overlappingFrameEnd: number | undefined;

        const currentFrameUuid = dependency.event === 'resize'
            ? resize.value?.state.resizingFrame.frame?.uuid
            : dnd.value?.state.draggingFrame.data?.uuid;

        for(let i = 0; i <= activeRowCache.frames.starts.length; i++) {

            const existingFrameStart = activeRowCache.frames.starts[i];
            const existingFrameEnd = activeRowCache.frames.ends[i];
            const existingFrameUuid = activeRowCache.frames.uuids[i];

            if(existingFrameStart === undefined || existingFrameEnd === undefined || existingFrameUuid === undefined || existingFrameUuid === currentFrameUuid) {
                continue;
            }

            //first check if pointer is over an existing frame
            if(pointerOnMs >= existingFrameStart && pointerOnMs <= existingFrameEnd) {
                pointerOverLapping = true;
                overlappingFrameStart = existingFrameStart;
                overlappingFrameEnd = existingFrameEnd;
                break;
            }

            // then check if dragging frame is over an existing area.
            // Canonical interval-overlap test: touching is allowed
            // (start_ms == existingEnd or end_ms == existingStart returns false),
            // but every true overlap is caught — including exact coincidence
            // and boundary-aligned containment which the previous three-condition
            // form missed when other snap pipelines aligned the frame's edges
            // with an obstacle's edges.
            if(
                dependency.frame.start_ms < existingFrameEnd
                && dependency.frame.end_ms > existingFrameStart
            ) {
                frameOverLapping = true;
                overlappingFrameStart = existingFrameStart;
                overlappingFrameEnd = existingFrameEnd;
                break;
            }

        }

        // handle resize overlap: clamp the resizing edge to the overlapping frame's boundary
        if(dependency.event === 'resize' && (frameOverLapping || pointerOverLapping) && overlappingFrameStart !== undefined && overlappingFrameEnd !== undefined) {
            const side = dependency.interactionDirection;

            if(side === 'right') {
                // resizing from right, clamp endMs to the overlapping frame's start
                const clampedEndMs = overlappingFrameStart;
                lastNotOverflowedPosition.top = top;
                lastNotOverflowedPosition.left = left;
                lastNotOverflowedPosition.startMs = startMs;
                lastNotOverflowedPosition.endMs = clampedEndMs;
            } else if(side === 'left') {
                // resizing from left, clamp startMs to the overlapping frame's end
                const clampedStartMs = overlappingFrameEnd;
                lastNotOverflowedPosition.top = top;
                lastNotOverflowedPosition.left = (clampedStartMs * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft;
                lastNotOverflowedPosition.startMs = clampedStartMs;
                lastNotOverflowedPosition.endMs = endMs;
            }

            return lastNotOverflowedPosition;
        }

        // for drag: block placement if frame duration doesn't fit in the empty area the pointer is over
        if(dependency.event === 'drag') {
            const duration = dependency.frame.end_ms - dependency.frame.start_ms;

            const pointerEmptyAreaIndex = activeRowCache.emptyAreas.starts.findIndex((start, index) => {
                const end = activeRowCache.emptyAreas.ends[index];
                return pointerOnMs >= start && pointerOnMs <= end;
            });

            if(pointerEmptyAreaIndex !== -1) {
                const emptyAreaDuration = activeRowCache.emptyAreas.ends[pointerEmptyAreaIndex] - activeRowCache.emptyAreas.starts[pointerEmptyAreaIndex];

                if(duration > emptyAreaDuration) {
                    return lastNotOverflowedPosition;
                }
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

                const duration = dependency.frame.end_ms - dependency.frame.start_ms;
                const distanceToStart = Math.abs(pointerOnMs - emptyAreaStart);
                const distanceToEnd = Math.abs(pointerOnMs - emptyAreaEnd);
                const closestEdge = distanceToStart < distanceToEnd ? emptyAreaStart : emptyAreaEnd;

                let newStartMs: number;
                let newEndMs: number;

                if(closestEdge === emptyAreaEnd) {
                    // snap frame's end to the empty area's end
                    newEndMs = closestEdge;
                    newStartMs = closestEdge - duration;
                } else {
                    // snap frame's start to the empty area's start
                    newStartMs = closestEdge;
                    newEndMs = closestEdge + duration;
                }

                const newLeft = (newStartMs * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft;

                lastNotOverflowedPosition.top = top;
                lastNotOverflowedPosition.left = newLeft;
                lastNotOverflowedPosition.startMs = newStartMs;
                lastNotOverflowedPosition.endMs = newEndMs;

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


    const snapGuides = (dependency: SnapDependencyInterface, top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {
        return {
            top,
            left,
            startMs,
            endMs
        }
    }


    const snapTimesOnDrag = (dependency: SnapDependencyInterface, top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {

        //if frame is within snapping threshold to a time guide then snap to that time guide
        // the time guide positions are calculated based on timeline config's intervals of major grid and minor grid

        const majorGridIntervalThreshold = 15 * 60 * 1000; // in ms
        const minorGridIntervalThreshold = 15 * 60 * 1000; // in ms

        const majorGridInterval = timelineConfig.cols.majorGridInterval;
        const minorGridInterval = timelineConfig.cols.minorGridInterval;

        if(dependency.frame.start_ms === undefined || dependency.frame.end_ms === undefined) {
            return {
                top,
                left,
                startMs,
                endMs
            }
        }


        // check major grid snapping
        const majorGridStart = Math.round(dependency.frame.start_ms / majorGridInterval) * majorGridInterval;
        const majorGridEnd = Math.round(dependency.frame.end_ms / majorGridInterval) * majorGridInterval;

        const distanceToMajorGridStart = Math.abs(dependency.frame.start_ms - majorGridStart);
        const distanceToMajorGridEnd = Math.abs(dependency.frame.end_ms - majorGridEnd);

        if(distanceToMajorGridStart <= majorGridIntervalThreshold) {
            
            state.dragSnapGuides.push({
                ms: majorGridStart,
                left: (majorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                source: 'grid-major',
            });

            const data = {
                top,
                left: (majorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: majorGridStart,
                endMs: majorGridStart + (dependency.frame.end_ms - dependency.frame.start_ms),
            }

            return data;
        }


        if(distanceToMajorGridEnd <= majorGridIntervalThreshold) {
            state.dragSnapGuides.push({
                ms: majorGridEnd,
                left: (majorGridEnd * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                source: 'grid-major',
            });

            const data = {
                top,
                left: ((majorGridEnd - (dependency.frame.end_ms - dependency.frame.start_ms)) * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: majorGridEnd - (dependency.frame.end_ms - dependency.frame.start_ms),
                endMs: majorGridEnd,
            }

            return data;
        }


        // check minor grid snapping
        const minorGridStart = Math.round(dependency.frame.start_ms / minorGridInterval) * minorGridInterval;
        const minorGridEnd = Math.round(dependency.frame.end_ms / minorGridInterval) * minorGridInterval;


        const distanceToMinorGridStart = Math.abs(dependency.frame.start_ms - minorGridStart);
        const distanceToMinorGridEnd = Math.abs(dependency.frame.end_ms - minorGridEnd);

        if(distanceToMinorGridStart <= minorGridIntervalThreshold) {
            state.dragSnapGuides.push({
                ms: minorGridStart,
                left: (minorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                source: 'grid-minor',
            });

            const data = {
                top,
                left: (minorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: minorGridStart,
                endMs: minorGridStart + (dependency.frame.end_ms - dependency.frame.start_ms),
            }

            return data;
        }

        if(distanceToMinorGridEnd <= minorGridIntervalThreshold) {
            state.dragSnapGuides.push({
                ms: minorGridEnd,
                left: (minorGridEnd * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                source: 'grid-minor',
            });

            const data = {
                top,
                left: ((minorGridEnd - (dependency.frame.end_ms - dependency.frame.start_ms)) * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: minorGridEnd - (dependency.frame.end_ms - dependency.frame.start_ms),
                endMs: minorGridEnd,
            }

            return data;
        }


        return {
            top,
            left,
            startMs,
            endMs
        }
    } 


    const snapTimesOnResize = (dependency: SnapDependencyInterface, top: number | null, left: number | null, startMs: number | null, endMs: number | null) => {

        const majorGridIntervalThreshold = 15 * 60 * 1000;
        const minorGridIntervalThreshold = 15 * 60 * 1000;

        const majorGridInterval = timelineConfig.cols.majorGridInterval;
        const minorGridInterval = timelineConfig.cols.minorGridInterval;

        if(dependency.frame.start_ms === undefined || dependency.frame.end_ms === undefined) {
            return { top, left, startMs, endMs }
        }

        const side = dependency.interactionDirection;

        if(side === 'right') {
            // snap end_ms only, keep start_ms and left unchanged

            const majorGridEnd = Math.round(dependency.frame.end_ms / majorGridInterval) * majorGridInterval;
            const distanceToMajorGridEnd = Math.abs(dependency.frame.end_ms - majorGridEnd);

            if(distanceToMajorGridEnd <= majorGridIntervalThreshold) {
                return { top, left, startMs, endMs: majorGridEnd }
            }

            const minorGridEnd = Math.round(dependency.frame.end_ms / minorGridInterval) * minorGridInterval;
            const distanceToMinorGridEnd = Math.abs(dependency.frame.end_ms - minorGridEnd);

            if(distanceToMinorGridEnd <= minorGridIntervalThreshold) {
                return { top, left, startMs, endMs: minorGridEnd }
            }

        } else if(side === 'left') {
            // snap start_ms only, keep end_ms unchanged

            const majorGridStart = Math.round(dependency.frame.start_ms / majorGridInterval) * majorGridInterval;
            const distanceToMajorGridStart = Math.abs(dependency.frame.start_ms - majorGridStart);

            if(distanceToMajorGridStart <= majorGridIntervalThreshold) {
                return {
                    top,
                    left: (majorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                    startMs: majorGridStart,
                    endMs,
                }
            }

            const minorGridStart = Math.round(dependency.frame.start_ms / minorGridInterval) * minorGridInterval;
            const distanceToMinorGridStart = Math.abs(dependency.frame.start_ms - minorGridStart);

            if(distanceToMinorGridStart <= minorGridIntervalThreshold) {
                return {
                    top,
                    left: (minorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                    startMs: minorGridStart,
                    endMs,
                }
            }
        }

        return { top, left, startMs, endMs }
    }


    // Returns true if [start_ms, end_ms] would overlap any frame in rowUuid
    // (excluding the dragging/resizing frame itself).
    const wouldOverlapInRow = (rowUuid: string | number, start_ms: number, end_ms: number, excludeUuid: string | number): boolean => {
        const rowFrames = Object.values(timeline.state.sectionFramesByUuid)
            .filter(f => f.rowUuid === rowUuid && f.uuid !== excludeUuid);
        for (const f of rowFrames) {
            // Canonical interval-overlap test: touching is allowed (start == otherEnd
            // or end == otherStart returns false), but every true overlap is caught
            // — including exact coincidence ([2h,4h] vs [2h,4h]) and boundary-aligned
            // containment ([2h,5h] vs [2h,4h]) which the previous three-condition
            // form missed when snap functions aligned a sibling's edges with the
            // obstacle's edges.
            if (start_ms < f.end_ms && end_ms > f.start_ms) {
                return true;
            }
        }
        return false;
    };

    const dragSnapPipeline = [
        snapRows,
        snapFrames,
        snapTimesOnDrag,
        snapGuides,
        protectOverLappingFrames,
    ]


    const resizeSnapPipeline = [
        snapTimesOnResize,
        protectOverLappingFrames,
    ]


    const snapOnDragPipeline = () => {
        if(!dnd.value || !dnd.value.state.dragging) return;

        const currentRowUuid = timeline.state.pointer.over.rowUuid;

        //first cache if it's new row
        if(currentRowUuid && currentRowUuid != activeRowCache.rowUuid) {
            cacheActiveRow(currentRowUuid);
        }

        // Reset active snap guide markers each tick; snap functions repopulate them.
        state.dragSnapGuides = [];

        let snapPosition = {
            top: null as number | null,
            left: null as number | null,
            startMs: null as number | null,
            endMs: null as number | null,
        }

        const primaryUuid = dnd.value.state.draggingFrame.uuid;
        if (primaryUuid == null) return;
        const freeformPrimary = dnd.value.state.draggingPlaceholders[primaryUuid];
        if (!freeformPrimary) return;

        const dependency = {
            frame: {
                start_ms: freeformPrimary.start_ms,
                end_ms: freeformPrimary.end_ms,
                left: freeformPrimary.left,
            },
            event: 'drag',
        } as SnapDependencyInterface;

        // When rowLocked (JoinRows), override the row to the original row so the
        // highlighter stays pinned — same logic as dnd.ts setPlaceholderPosition.
        const rowLocked = dnd.value.state.rowLocked;
        const lockedRowUuid = rowLocked ? dnd.value.state.draggingFrame.data?.rowUuid ?? null : null;
        const effectiveRowUuid = lockedRowUuid ?? timeline.state.pointer.over.rowUuid ?? null;
        if (rowLocked && lockedRowUuid && lockedRowUuid !== activeRowCache.rowUuid) {
            cacheActiveRow(lockedRowUuid);
        }

        // Snapshot kept for reference — not used now that we have lastGroupSafeDragPosition.
        // const safePositionSnapshot = { ...lastNotOverflowedPosition };

        dragSnapPipeline.forEach((snapFunction) => {
            snapPosition = snapFunction(dependency, snapPosition.top, snapPosition.left, snapPosition.startMs, snapPosition.endMs) as { top: number | null; left: number | null; startMs: number | null; endMs: number | null };

        });

        // Enforce row lock on the top position after pipeline.
        if (rowLocked && lockedRowUuid) {
            const lockedRow = timeline.state.sectionRowsByUuid[lockedRowUuid];
            if (lockedRow) snapPosition.top = lockedRow.editorRelativeTop;
        }

        state.draggingPlaceholders[primaryUuid] = {
            uuid: primaryUuid,
            rowUuid: effectiveRowUuid,
            top: snapPosition.top ?? freeformPrimary.top,
            left: snapPosition.left ?? freeformPrimary.left,
            start_ms: snapPosition.startMs ?? freeformPrimary.start_ms,
            end_ms: snapPosition.endMs ?? freeformPrimary.end_ms,
            width: freeformPrimary.width,
        };

        // If any LINKED SIBLING would overlap in their own row at the validated
        // primary times, revert primary to the last position the group was fully
        // safe at. Sibling list comes from timeline state directly to avoid any
        // dependency on joinRows watchEffect timing.
        let validatedPrimary = state.draggingPlaceholders[primaryUuid];
        const linkedSiblings = getLinkedSiblings(primaryUuid);
        let anyMemberBlocked = false;

        for (const sibling of linkedSiblings) {
            if (wouldOverlapInRow(sibling.rowUuid, validatedPrimary.start_ms, validatedPrimary.end_ms, sibling.uuid)) {
                anyMemberBlocked = true;
                break;
            }
        }

        if (anyMemberBlocked) {
            const safeLeft = lastGroupSafeDragPosition.left;
            const safeStart = lastGroupSafeDragPosition.startMs;
            const safeEnd = lastGroupSafeDragPosition.endMs;
            state.draggingPlaceholders[primaryUuid] = {
                uuid: primaryUuid,
                rowUuid: validatedPrimary.rowUuid,
                top: validatedPrimary.top,
                left: safeLeft ?? validatedPrimary.left,
                start_ms: safeStart ?? validatedPrimary.start_ms,
                end_ms: safeEnd ?? validatedPrimary.end_ms,
                width: freeformPrimary.width,
            };
            // Roll back protectOverLappingFrames' tracker too so it doesn't keep
            // approving member-blocking positions on subsequent ticks.
            lastNotOverflowedPosition = { ...lastGroupSafeDragPosition };
            validatedPrimary = state.draggingPlaceholders[primaryUuid];
        } else if (linkedSiblings.length > 0) {
            // Group fully safe — advance the group tracker.
            lastGroupSafeDragPosition = {
                top: validatedPrimary.top,
                left: validatedPrimary.left,
                startMs: validatedPrimary.start_ms,
                endMs: validatedPrimary.end_ms,
            };
        }

        // Mirror validated primary times to all linked siblings. Use getLinkedSiblings
        // (reads directly from timeline state) instead of dnd.state.draggingPlaceholders
        // so members are present on tick 1 before joinRows watchEffect fires.
        linkedSiblings.forEach(sibling => {
            const memberRow = timeline.state.sectionRowsByUuid[sibling.rowUuid];
            state.draggingPlaceholders[sibling.uuid] = {
                uuid: sibling.uuid,
                rowUuid: sibling.rowUuid,
                top: memberRow?.editorRelativeTop ?? 0,
                left: (validatedPrimary.start_ms * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                start_ms: validatedPrimary.start_ms,
                end_ms: validatedPrimary.end_ms,
                width: sibling.width,
            };
        });
    }


    const snapOnResizePipeline = () => {
        if(!resize.value || !resize.value.state.resizing) return;

        const currentRowUuid = resize.value.state.resizingFrame.frame?.rowUuid;
        if(currentRowUuid && currentRowUuid != activeRowCache.rowUuid) {
            cacheActiveRow(currentRowUuid);
        }

        let snapPosition = {
            top: null as number | null,
            left: null as number | null,
            startMs: null as number | null,
            endMs: null as number | null,
        }

        const dependency = {
            frame: {
                start_ms: resize.value.state.resizingPlaceholder.start_ms,
                end_ms: resize.value.state.resizingPlaceholder.end_ms,
            },
            event: 'resize',
            interactionDirection: resize.value.state.resizingFrame.side,
        } as SnapDependencyInterface;

        // Snapshot kept for reference — not used now that we have lastGroupSafeResizePosition.
        // const safeResizeSnapshot = { ...lastNotOverflowedPosition };

        resizeSnapPipeline.forEach((snapFunction) => {
            snapPosition = snapFunction(dependency, snapPosition.top, snapPosition.left, snapPosition.startMs, snapPosition.endMs) as { top: number | null; left: number | null; startMs: number | null; endMs: number | null };
        });

        const primaryUuid = resize.value.state.resizingFrame.uuid;
        if (primaryUuid == null) return;

        const start_ms = snapPosition.startMs ?? resize.value.state.resizingPlaceholder.start_ms ?? 0;
        const end_ms = snapPosition.endMs ?? resize.value.state.resizingPlaceholder.end_ms ?? 0;

        state.resizingPlaceholders[primaryUuid] = {
            uuid: primaryUuid,
            rowUuid: resize.value.state.resizingFrame.frame?.rowUuid ?? null,
            top: snapPosition.top ?? resize.value.state.resizingPlaceholder.top ?? 0,
            left: snapPosition.left ?? resize.value.state.resizingPlaceholder.left ?? 0,
            start_ms,
            end_ms,
            width: calculateFrameWidth(start_ms, end_ms, timelineConfig.cols.pixelPerMs),
        };

        // If any LINKED SIBLING would overlap at the validated primary times,
        // revert to the last known safe group position. Sibling list comes from
        // timeline state directly (no joinRows timing dependency).
        let validatedResizePrimary = state.resizingPlaceholders[primaryUuid];
        const linkedResizeSiblings = getLinkedSiblings(primaryUuid);
        let anyResizeMemberBlocked = false;

        for (const sibling of linkedResizeSiblings) {
            if (wouldOverlapInRow(sibling.rowUuid, validatedResizePrimary.start_ms, validatedResizePrimary.end_ms, sibling.uuid)) {
                anyResizeMemberBlocked = true;
                break;
            }
        }

        if (anyResizeMemberBlocked) {
            const safeStart = lastGroupSafeResizePosition.startMs ?? start_ms;
            const safeEnd = lastGroupSafeResizePosition.endMs ?? end_ms;
            state.resizingPlaceholders[primaryUuid] = {
                uuid: primaryUuid,
                rowUuid: validatedResizePrimary.rowUuid,
                top: validatedResizePrimary.top,
                left: lastGroupSafeResizePosition.left ?? validatedResizePrimary.left,
                start_ms: safeStart,
                end_ms: safeEnd,
                width: calculateFrameWidth(safeStart, safeEnd, timelineConfig.cols.pixelPerMs),
            };
            lastNotOverflowedPosition = { ...lastGroupSafeResizePosition };
            validatedResizePrimary = state.resizingPlaceholders[primaryUuid];
        } else if (linkedResizeSiblings.length > 0) {
            lastGroupSafeResizePosition = {
                top: validatedResizePrimary.top,
                left: validatedResizePrimary.left,
                startMs: validatedResizePrimary.start_ms,
                endMs: validatedResizePrimary.end_ms,
            };
        }

        // Mirror validated primary times to all linked siblings. Use getLinkedSiblings
        // (reads directly from timeline state) instead of resize.state.resizingPlaceholders
        // so members are always present on tick 1, before joinRows watchEffect fires.
        linkedResizeSiblings.forEach(sibling => {
            const memberRow = timeline.state.sectionRowsByUuid[sibling.rowUuid];
            const mStart = validatedResizePrimary.start_ms;
            const mEnd = validatedResizePrimary.end_ms;
            state.resizingPlaceholders[sibling.uuid] = {
                uuid: sibling.uuid,
                rowUuid: sibling.rowUuid,
                top: memberRow?.editorRelativeTop ?? 0,
                left: validatedResizePrimary.left,
                start_ms: mStart,
                end_ms: mEnd,
                width: calculateFrameWidth(mStart, mEnd, timelineConfig.cols.pixelPerMs),
            };
        });
    }

    watch([() => timeline.state.pointer.clientX, () => timeline.state.pointer.clientY, () => dnd.value?.state.dragging], snapOnDragPipeline, { deep: true });
    watch([() => timeline.state.pointer.clientX, () => resize.value?.state.resizing], snapOnResizePipeline, { deep: true });

    watch(() => dnd.value?.state.dragging, (dragging) => {
        if(!dragging) {
            lastNotOverflowedPosition = { top: null, left: null, startMs: null, endMs: null }
            lastGroupSafeDragPosition = { top: null, left: null, startMs: null, endMs: null }
            state.dragSnapGuides = [];
            state.draggingPlaceholders = {};
            // Invalidate the cached row so the next drag rebuilds it from fresh
            // timeline state. Without this, dragging frame B right after dragging
            // frame A onto the same row would see A's pre-drag position.
            activeRowCache.rowUuid = null;
        }
        else {
            calculateRowsCenterCache();
            // Seed group safe tracker with the frame's original (pre-drag) position
            // so an early member-row overlap can be detected on tick 1 with a real
            // fallback. Without this, the first member-blocking tick would revert
            // to nulls and `lastNotOverflowedPosition` would be wiped.
            const fd = dnd.value?.state.draggingFrame.data;
            if (fd) {
                lastGroupSafeDragPosition = {
                    top: null,
                    left: fd.editorRelativeLeft,
                    startMs: fd.start_ms,
                    endMs: fd.end_ms,
                };
                lastNotOverflowedPosition = { ...lastGroupSafeDragPosition };
            }
        }
    });

    watch(() => resize.value?.state.resizing, (resizing) => {
        if(!resizing) {
            lastNotOverflowedPosition = { top: null, left: null, startMs: null, endMs: null }
            lastGroupSafeResizePosition = { top: null, left: null, startMs: null, endMs: null }
            state.resizingPlaceholders = {};
            // Invalidate the cached row so the next resize/drag rebuilds it.
            activeRowCache.rowUuid = null;
        } else {
            const fd = resize.value?.state.resizingFrame.frame;
            if (fd) {
                lastGroupSafeResizePosition = {
                    top: null,
                    left: fd.editorRelativeLeft,
                    startMs: fd.start_ms,
                    endMs: fd.end_ms,
                };
                lastNotOverflowedPosition = { ...lastGroupSafeResizePosition };
            }
        }
    });


    //manage dragging events based on dnd event
    watch(dnd, (newDnd, oldDnd) => {
        oldDnd?.removeEvent('dragStart', 'snappingComposableOnDragStart');
        oldDnd?.removeEvent('dragEnd', 'snappingComposableOnDragEnd');
        oldDnd?.removeEvent('dragCancel', 'snappingComposableOnDragCancel');
        oldDnd?.removeEvent('drop', 'snappingComposableOnDrop');

        newDnd?.onDragStart((frame, event) => draggingEvents.triggerOnDragStart(frame, event), 'snappingComposableOnDragStart');
        newDnd?.onDragEnd((frame, frameData, event) => draggingEvents.triggerOnDragEnd(frame, getDraggingFrameData(), event), 'snappingComposableOnDragEnd');
        newDnd?.onDragCancel((frame, frameData, event) => draggingEvents.triggerOnDragCancel(frame, getDraggingFrameData(), event), 'snappingComposableOnDragCancel');
        newDnd?.onDrop((frame, frameData, event) => draggingEvents.triggerOnDrop(frame, getDraggingFrameData(), event), 'snappingComposableOnDrop');
    }, { immediate: true })


    watch(resize, (newResize, oldResize) => {
        oldResize?.removeEvent('resizeStart', 'snappingComposableOnResizeStart');
        oldResize?.removeEvent('resizeEnd', 'snappingComposableOnResizeEnd');
        oldResize?.removeEvent('resizeCancel', 'snappingComposableOnResizeCancel');

        newResize?.onResizeStart((frame, event) => draggingEvents.triggerOnResizeStart(frame, event), 'snappingComposableOnResizeStart');
        newResize?.onResizeEnd((frame, frameData, event) => draggingEvents.triggerOnResizeEnd(frame, getResizingFrameData(), event), 'snappingComposableOnResizeEnd');
        newResize?.onResized((frame, frameData, event) => draggingEvents.triggerOnResized(frame, getResizingFrameData(), event), 'snappingComposableOnResized');
        newResize?.onResizeCancel((frame, frameData, event) => draggingEvents.triggerOnResizeCancel(frame, getResizingFrameData(), event), 'snappingComposableOnResizeCancel');
    }, { immediate: true })


    return {
        state,
        onDragStart: draggingEvents.onDragStart,
        onDragEnd: draggingEvents.onDragEnd,
        onDragCancel: draggingEvents.onDragCancel,
        onDrop: draggingEvents.onDrop,

        onResizeStart: draggingEvents.onResizeStart,
        onResizeEnd: draggingEvents.onResizeEnd,
        onResizeCancel: draggingEvents.onResizeCancel,
        onResized: draggingEvents.onResized,

        removeEvent: draggingEvents.removeEvent,
    }
    
}

export type UseSnappingInterface = ReturnType<typeof useSnapping>;

export interface SnappingStateInterface {
    // Validated snapped positions for all active drag ghosts, keyed by frame uuid.
    draggingPlaceholders: Record<string | number, DraggingPlaceholderInterface>,
    // Validated snapped positions for all active resize ghosts, keyed by frame uuid.
    resizingPlaceholders: Record<string | number, DraggingPlaceholderInterface>,
    dragSnapGuides: { ms: number, left: number, source: 'grid-major' | 'grid-minor' | 'frame-edge' }[],
}


interface SnapDependencyInterface {
    frame: {
        start_ms: number,
        end_ms: number,
        left: number,
        right: number,
    },
    event: 'drag' | 'resize',
    interactionDirection: 'left' | 'right' | null,
}