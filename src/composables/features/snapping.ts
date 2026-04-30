import { computed, reactive, Ref, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseFeaturesType } from "./features";
import { UseDndType } from "./dnd";
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { DraggedFrameDataInterface, ResizedFrameDataInterface, useDraggingEvents } from "./draggingEvents";
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
        draggingPlaceholder: {
            left: 0, 
            top: 0,
            start_ms: 0,
            end_ms: 0,
        },
        resizingPlaceholder: {
            left: 0,
            top: 0,
            start_ms: 0,
            end_ms: 0,
            width: 0
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
    
    
    const getResizingFrameData = () : ResizedFrameDataInterface => {

        return {
            initial: {
                sectionUuid: resize.value?.state.resizingFrame.frame?.sectionUuid ?? null,
                rowUuid: resize.value?.state.resizingFrame.frame?.rowUuid ?? null,
                start_ms: resize.value?.state.resizingFrame.frame?.start_ms ?? 0,
                end_ms: resize.value?.state.resizingFrame.frame?.end_ms ?? 0,
            },
            current: {
                sectionUuid: resize.value?.state.resizingFrame.frame?.sectionUuid ?? null,
                rowUuid: resize.value?.state.resizingFrame.frame?.rowUuid ?? null,
                start_ms: state.resizingPlaceholder.start_ms,
                end_ms: state.resizingPlaceholder.end_ms,
            }
        }
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

            // then check if dragging frame is over an existing area (strict inequalities so adjacent/touching frames are not considered overlapping)
            if(
                (dependency.frame.start_ms > existingFrameStart && dependency.frame.start_ms < existingFrameEnd) 
                || (dependency.frame.end_ms > existingFrameStart && dependency.frame.end_ms < existingFrameEnd) 
                || (dependency.frame.start_ms < existingFrameStart && dependency.frame.end_ms > existingFrameEnd)
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
            
            const data = {
                top,
                left: (majorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: majorGridStart,
                endMs: majorGridStart + (dependency.frame.end_ms - dependency.frame.start_ms),
            }

            return data;
        }


        if(distanceToMajorGridEnd <= majorGridIntervalThreshold) {
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
            const data = {
                top,
                left: (minorGridStart * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft,
                startMs: minorGridStart,
                endMs: minorGridStart + (dependency.frame.end_ms - dependency.frame.start_ms),
            }

            return data;
        }

        if(distanceToMinorGridEnd <= minorGridIntervalThreshold) {
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
        
        let snapPosition = {
            top: null as number | null,
            left: null as number | null,
            startMs: null as number | null,
            endMs: null as number | null,
        }

        const dependency = {
            frame: {
                start_ms: dnd.value.state.draggingPlaceholder.start_ms,
                end_ms: dnd.value.state.draggingPlaceholder.end_ms,
                left: dnd.value.state.draggingPlaceholder.left,
            },
            event: 'drag',
        } as SnapDependencyInterface;

        dragSnapPipeline.forEach((snapFunction) => {
            snapPosition = snapFunction(dependency, snapPosition.top, snapPosition.left, snapPosition.startMs, snapPosition.endMs) as { top: number | null; left: number | null; startMs: number | null; endMs: number | null };

        });


        state.draggingPlaceholder.top = snapPosition.top == null ? dnd?.value?.state.draggingPlaceholder.top ?? 0 : snapPosition.top;
        state.draggingPlaceholder.left = snapPosition.left == null ? dnd.value?.state.draggingPlaceholder.left ?? 0 : snapPosition.left;
        state.draggingPlaceholder.start_ms = snapPosition.startMs == null ? dnd.value?.state.draggingPlaceholder.start_ms ?? 0 : snapPosition.startMs;
        state.draggingPlaceholder.end_ms = snapPosition.endMs == null ? dnd.value?.state.draggingPlaceholder.end_ms ?? 0 : snapPosition.endMs;
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

        resizeSnapPipeline.forEach((snapFunction) => {
            snapPosition = snapFunction(dependency, snapPosition.top, snapPosition.left, snapPosition.startMs, snapPosition.endMs) as { top: number | null; left: number | null; startMs: number | null; endMs: number | null };
        });

        state.resizingPlaceholder.top = snapPosition.top == null ? resize?.value?.state.resizingPlaceholder.top ?? 0 : snapPosition.top;
        state.resizingPlaceholder.left = snapPosition.left == null ? resize.value?.state.resizingPlaceholder.left ?? 0 : snapPosition.left;
        state.resizingPlaceholder.start_ms = snapPosition.startMs == null ? resize.value?.state.resizingPlaceholder.start_ms ?? 0 : snapPosition.startMs;
        state.resizingPlaceholder.end_ms = snapPosition.endMs == null ? resize.value?.state.resizingPlaceholder.end_ms ?? 0 : snapPosition.endMs;
        state.resizingPlaceholder.width = calculateFrameWidth(state.resizingPlaceholder.start_ms, state.resizingPlaceholder.end_ms, timelineConfig.cols.pixelPerMs);
    }

    watch([() => timeline.state.pointer.clientX, () => timeline.state.pointer.clientY, () => dnd.value?.state.dragging], snapOnDragPipeline, { deep: true });
    watch([() => timeline.state.pointer.clientX, () => resize.value?.state.resizing], snapOnResizePipeline, { deep: true });

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

    watch(() => resize.value?.state.resizing, (resizing) => {
        if(!resizing) {
            lastNotOverflowedPosition = {
                top: null,
                left: null,
                startMs: null,
                endMs: null,
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
    draggingPlaceholder: {
        left: number,
        top: number,
        start_ms: number,
        end_ms: number,
    },
    resizingPlaceholder: {
        left: number,
        top: number,
        start_ms: number,
        end_ms: number,
        width: number,
    }
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