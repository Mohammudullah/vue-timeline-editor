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
    // Uuids currently flagged for the highlight-blink animation by
    // `scrollToViewPort(uuid, true)`. Cleared automatically when the
    // animation duration expires. Frame.vue reads this and forwards it to
    // FrameUI as a class trigger.
    highlightedFrameUuids: Record<string | number, true>,
    // Uuids currently in a "pending" state — usually meaning an async server
    // save is in flight after a drop/resize/add. Drag and resize gestures
    // are blocked while a frame is pending so a second mutation can't race
    // with the first. Managed by `setPending` / `isPending`, or by the
    // `process()` helper on drag/resize event payloads.
    pendingFrameUuids: Record<string | number, true>,
    // Uuids whose loading INDICATOR should be visible. Distinct from
    // `pendingFrameUuids`: pending = race-protected (always immediate);
    // loading = visual cue (may be delayed). On a fast server response the
    // user never sees loading even though `pendingFrameUuids` was briefly
    // set. Drives the `vtd__frame-processing` class.
    loadingFrameUuids: Record<string | number, true>,
    // Uuids whose "blocked" shake should play — a frame the user just tried
    // to drag/resize but was denied because another frame is processing.
    // Auto-clears after the shake duration. Drives `vtd__frame-blocked`.
    blockedFrameUuids: Record<string | number, true>,
    // Uuids that should pulse to draw attention — typically the currently-
    // processing frames at the moment a blocked attempt happens elsewhere,
    // so the user's eye is pointed at "this is the one to wait for". Drives
    // `vtd__frame-processing--attention`.
    attentionFrameUuids: Record<string | number, true>,
    // Current effective loading mode used by buildProcess. `delayed` waits
    // before showing the indicator; `immediate` shows it on first tick.
    // Adaptive: flips to `immediate` after two consecutive slow saves,
    // back to `delayed` after one fast save. User can force a mode via
    // setLoadingMode('immediate' | 'delayed') instead of 'auto'.
    loadingMode: 'delayed' | 'immediate',
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
        highlightedFrameUuids: {},
        pendingFrameUuids: {},
        loadingFrameUuids: {},
        loadingMode: 'delayed',
        blockedFrameUuids: {},
        attentionFrameUuids: {},

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


    // Pending-frame API.
    //
    // A frame is "pending" while an async operation (typically a server save
    // initiated from the consumer's @drop / @resized / @add handler) is in
    // flight. Drag and resize gestures check this and abort early so the
    // user can't kick off a second mutation while the first is still being
    // persisted — preventing races between competing save requests.
    //
    // Consumers normally don't call these directly; the `process()` helper
    // on event payloads (added in a later step) wraps mark + task + unmark
    // for the common case. `setPending` and `isPending` are exposed for
    // manual imperative control (e.g. external side-panel edits).
    const setPending = (uuid: string | number | (string | number)[], pending: boolean) => {
        const list = Array.isArray(uuid) ? uuid : [uuid];
        for (const u of list) {
            if (pending) state.pendingFrameUuids[u] = true;
            else delete state.pendingFrameUuids[u];
        }
    };

    const isPending = (uuid: string | number): boolean =>
        state.pendingFrameUuids[uuid] === true;


    // Adaptive loading-indicator tuning.
    //
    // `requestedMode` is what the consumer asked for via setLoadingMode.
    // `state.loadingMode` is what's *currently in effect* — equal to
    // requestedMode in 'immediate'/'delayed' override, or auto-flipped
    // between 'delayed' and 'immediate' when the requested mode is 'auto'.
    //
    // `slowStreak` tracks consecutive saves that took >= loadingDelayMs.
    // Two slow saves in a row → flip to immediate. A single fast save
    // resets the streak and flips back to delayed.
    let requestedMode: 'auto' | 'delayed' | 'immediate' = 'auto';
    let slowStreak = 0;
    let loadingDelayMs = 1000;
    let loadingMinShowMs = 500;

    const setLoadingMode = (mode: 'auto' | 'delayed' | 'immediate') => {
        requestedMode = mode;
        if (mode === 'auto') return;  // let current state.loadingMode persist
        state.loadingMode = mode;
        slowStreak = 0;
    };

    const setLoadingDelay = (ms: number) => { loadingDelayMs = Math.max(0, ms); };
    const setLoadingMinShow = (ms: number) => { loadingMinShowMs = Math.max(0, ms); };
    const getLoadingDelay = () => loadingDelayMs;
    const getLoadingMinShow = () => loadingMinShowMs;

    // Called by buildProcess (in dnd/resize/snapping) after each task settles.
    // Updates slowStreak + state.loadingMode when in 'auto' mode. No-op when
    // the consumer has forced a mode via setLoadingMode.
    const recordSaveDuration = (durationMs: number) => {
        if (requestedMode !== 'auto') return;
        if (durationMs >= loadingDelayMs) {
            slowStreak++;
            if (slowStreak >= 2) state.loadingMode = 'immediate';
        } else {
            slowStreak = 0;
            state.loadingMode = 'delayed';
        }
    };


    // Block scope: how broadly a pending frame blocks new mutations.
    //   'global' (default) — ANY pending frame blocks every other frame.
    //                        Conservative; matches "one save at a time" servers.
    //   'frame'           — only the actually-pending uuids (and JoinRows
    //                        members) are blocked. Other rows stay live.
    let pendingBlockScope: 'global' | 'frame' = 'global';
    const setPendingBlockScope = (scope: 'global' | 'frame') => { pendingBlockScope = scope; };

    // Returns true when a drag/resize attempt on `forUuids` should be blocked.
    // In 'global' mode, any frame being pending blocks every attempt; in
    // 'frame' mode only the attempted uuids themselves matter.
    const shouldBlockMutation = (forUuids: (string | number)[]): boolean => {
        if (pendingBlockScope === 'global') {
            for (const _k in state.pendingFrameUuids) return true;
            return false;
        }
        for (const u of forUuids) if (state.pendingFrameUuids[u]) return true;
        return false;
    };

    // Two visual cues fired together when a drag/resize is denied:
    //   1. SHAKE the attempted frame(s) — `vtd__frame-blocked` class for
    //      ~400ms. Says "no, can't do that here." Skipped for any uuid that
    //      is ITSELF processing — that frame already has a spinner; shaking
    //      it would just be noise.
    //   2. PULSE every currently-processing frame — `vtd__frame-processing
    //      --attention` for ~600ms. Pulls the user's eye to "this is what
    //      you're waiting for", so they can tell whose save is in flight.
    //
    // Per-uuid timers are reset on repeat calls, so the user mashing on a
    // blocked frame keeps both animations alive instead of stuttering.
    const blockedTimers: Record<string | number, ReturnType<typeof setTimeout>> = {};
    const attentionTimers: Record<string | number, ReturnType<typeof setTimeout>> = {};
    const BLOCKED_SHAKE_MS = 400;
    const ATTENTION_PULSE_MS = 600;

    const signalBlocked = (attemptedUuids: (string | number)[]) => {
        for (const u of attemptedUuids) {
            // Skip shaking a frame that's already processing — it has a
            // spinner; the attention pulse below is the right cue for it.
            if (state.pendingFrameUuids[u]) continue;
            state.blockedFrameUuids[u] = true;
            if (blockedTimers[u]) clearTimeout(blockedTimers[u]);
            blockedTimers[u] = setTimeout(() => {
                delete blockedTimers[u];
                delete state.blockedFrameUuids[u];
            }, BLOCKED_SHAKE_MS);
        }
        for (const u in state.pendingFrameUuids) {
            state.attentionFrameUuids[u] = true;
            if (attentionTimers[u]) clearTimeout(attentionTimers[u]);
            attentionTimers[u] = setTimeout(() => {
                delete attentionTimers[u];
                delete state.attentionFrameUuids[u];
            }, ATTENTION_PULSE_MS);
        }
    };


    // Per-uuid timeout handles so repeated calls reset the blink window
    // instead of stacking (otherwise the class would clear prematurely if a
    // second call followed a first by less than the animation duration).
    const highlightTimers: Record<string | number, ReturnType<typeof setTimeout>> = {};
    const HIGHLIGHT_DURATION_MS = 1500;

    /**
     * Smooth-scrolls the scroll pane so the given frame is in view (aligned
     * to the left side of the viewport with a small leading margin). When
     * `highlight` is true, also flags the frame for the blink animation —
     * the class is applied via timeline state and cleared automatically when
     * the animation completes.
     *
     * When the targeted frame has a `linkGroupUuid`, every frame sharing the
     * group is highlighted together so a joined booking blinks as one unit
     * regardless of which member uuid was passed in.
     */
    const scrollToViewPort = (uuid: string | number, highlight = false) => {
        const frame = state.sectionFramesByUuid[uuid];
        const pane = state.scrollPaneEl;
        if (!frame || !pane) return;

        const viewportWidth = pane.clientWidth;
        // Leave ~20% of the viewport as leading space so the frame doesn't
        // sit flush against the left edge. Clamp at 0 so very-early frames
        // don't try to scroll negative.
        const targetLeft = Math.max(0, frame.editorRelativeLeft - viewportWidth * 0.2);
        pane.scrollTo({ left: targetLeft, behavior: 'smooth' });

        if (highlight) {
            // Collect every uuid that should blink: the target itself plus
            // any joined siblings. When there's no linkGroup, this is just
            // the single uuid.
            const groupUuid = frame.linkGroupUuid;
            const uuidsToHighlight: (string | number)[] = groupUuid != null
                ? Object.values(state.sectionFramesByUuid)
                    .filter(f => f.linkGroupUuid === groupUuid)
                    .map(f => f.uuid)
                : [uuid];

            for (const u of uuidsToHighlight) {
                if (highlightTimers[u]) clearTimeout(highlightTimers[u]);
                state.highlightedFrameUuids[u] = true;
                highlightTimers[u] = setTimeout(() => {
                    delete state.highlightedFrameUuids[u];
                    delete highlightTimers[u];
                }, HIGHLIGHT_DURATION_MS);
            }
        }
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
        scrollToViewPort,
        setPending,
        isPending,
        setLoadingMode,
        setLoadingDelay,
        setLoadingMinShow,
        getLoadingDelay,
        getLoadingMinShow,
        recordSaveDuration,
        setPendingBlockScope,
        shouldBlockMutation,
        signalBlocked,
    };
}

export type UseTimelineInterface = ReturnType<typeof useTimeline>;