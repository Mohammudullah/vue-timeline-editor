import { onBeforeUnmount, reactive, watch } from "vue"
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseTimelineInterface } from "../timeline";
import { UseFramesType } from "./frames";
import { DraggedFrameDataInterface, FrameDataItem, useDraggingEvents } from "./draggingEvents";
import useUtils from "../utils";

/**
 * useDnd
 *
 * Drag-and-drop for selected frames.
 *
 * Selection model: drag operates on `frames.state.selectedUuids`. The
 * primary frame (the one the user clicked / drag-started) drives pointer
 * math (delta calc, container offset, drop target row). Every other
 * selected uuid travels with the same time-delta on its own row.
 *
 * Ghost rendering: this composable owns the entire `state.draggingPlaceholders`
 * map — it writes one entry per selected uuid each tick. JoinRows or other
 * features only need to expand selection; they never write ghosts directly.
 */
export const useDnd = ({
    timeline,
    timelineConfig,
    frames,
    edgeSnap = true,
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    frames: UseFramesType,
    edgeSnap?: boolean,
}) => {

    const { msToEditorLeft } = useUtils();
    // See snapping.ts for rationale — bound msToEditorLeft for this composable.
    const msToLeft = (ms: number) => msToEditorLeft(
        ms,
        (timelineConfig.range.start_seconds ?? 0) * 1000,
        timelineConfig.cols.pixelPerMs,
        timelineConfig.editor.paddingLeft,
    );

    const state = reactive<DndStateInterface>({
        dragging: false,
        draggingMoved: false,
        container: {
            width: 0,
            height: 0,
            pointerX: 0,
            pointerY: 0,
        },
        // When true, vertical position is locked to the original row.
        // Set externally by features that enforce row constraints (e.g. JoinRows).
        rowLocked: false,
        // Primary frame (the one the user pointer-downed on). Mirrors
        // frames.state.primary while a drag is active.
        draggingFrame: {
            data: null,
            uuid: null,
        },
        // Map of active ghost placeholders keyed by frame uuid. Always
        // contains every uuid in the active selection; updated each tick.
        draggingPlaceholders: {},
    });

    const draggingEvents = useDraggingEvents();

    /**
     * Deep, by-value snapshot of every selected frame at the moment the
     * drag activates. Built fresh in `activateDrag`, cleared in `dragEnd`.
     *
     * Why: `timeline.state.sectionFramesByUuid[uuid]` and
     * `frames.state.primary.frame` are live reactive references. The moment
     * `handleOnDrop` calls `timeline.updateFrame(...)` they mutate in place,
     * which means anything reading from them later (e.g. the subsequent
     * `dragEnd` event payload) would see the post-drop values instead of
     * the original pre-drag values. The snapshot is the single source of
     * truth for "what the frame looked like before this drag started".
     */
    let dragSnapshot: Record<string | number, TimelineFrameByUuidInterface> = {};

    const cloneFrame = (f: TimelineFrameByUuidInterface): TimelineFrameByUuidInterface => ({
        uuid: f.uuid,
        title: f.title,
        start_ms: f.start_ms,
        end_ms: f.end_ms,
        rowUuid: f.rowUuid,
        sectionUuid: f.sectionUuid,
        editorRelativeLeft: f.editorRelativeLeft,
        width: f.width,
        linkGroupUuid: f.linkGroupUuid,
        meta: f.meta,
    });

    // Builds a closure that re-applies the pre-drag snapshot via
    // `timeline.updateFrame`. Captures `initial` by reference; that array is
    // re-cloned by `cloneData` before reaching consumers, so each event's
    // `revert` is bound to its own snapshot. Idempotent — calling twice
    // writes the same values twice. Preserves title/meta/linkGroupUuid by
    // reading the current frame, since those aren't carried in `initial`.
    const buildRevert = (initial: FrameDataItem[]) => () => {
        for (const item of initial) {
            const original = timeline.state.sectionFramesByUuid[item.uuid];
            if (!original) continue;
            timeline.updateFrame(item.uuid, {
                uuid: item.uuid,
                title: original.title,
                linkGroupUuid: original.linkGroupUuid,
                meta: original.meta,
                start_ms: item.start_ms,
                end_ms: item.end_ms,
                rowUuid: item.rowUuid ?? original.rowUuid,
                sectionUuid: item.sectionUuid ?? original.sectionUuid,
            });
        }
    };

    // Builds the `process` helper attached to drag event payloads. Wraps an
    // async task with pending + loading-indicator lifecycle:
    //   - mark every affected uuid pending immediately (race protection);
    //   - schedule the loading indicator based on `timeline.state.loadingMode`:
    //       'immediate' → show on tick 0
    //       'delayed'   → show after `loadingDelayMs` (default 1 s)
    //   - on settle: clear pending, hold loading for `loadingMinShowMs`
    //     (default 500 ms) if it was ever shown, then clear it;
    //   - on reject: also call `revert`.
    // De-duped — a second call while the first is still in flight returns
    // the same in-flight promise.
    const buildProcess = (initial: FrameDataItem[], revert: () => void) => {
        const uuids = initial.map(it => it.uuid);
        let inFlight: Promise<unknown> | null = null;

        return <T,>(task: () => Promise<T>): Promise<T> => {
            if (inFlight) return inFlight as Promise<T>;

            uuids.forEach(u => timeline.setPending(u, true));

            let delayTimer: ReturnType<typeof setTimeout> | null = null;
            let loadingShownAt = 0;
            const startedAt = Date.now();

            const showLoading = () => {
                if (loadingShownAt) return;
                loadingShownAt = Date.now();
                uuids.forEach(u => { timeline.state.loadingFrameUuids[u] = true; });
            };

            if (timeline.state.loadingMode === 'immediate') {
                showLoading();
            } else {
                delayTimer = setTimeout(showLoading, timeline.getLoadingDelay());
            }

            const cleanupAfterSettle = async () => {
                if (delayTimer != null) {
                    clearTimeout(delayTimer);
                    delayTimer = null;
                }
                uuids.forEach(u => timeline.setPending(u, false));
                timeline.recordSaveDuration(Date.now() - startedAt);

                if (loadingShownAt) {
                    const remaining = timeline.getLoadingMinShow() - (Date.now() - loadingShownAt);
                    if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
                    uuids.forEach(u => { delete timeline.state.loadingFrameUuids[u]; });
                }
            };

            const run = async (): Promise<T> => {
                try {
                    return await task();
                } catch (err) {
                    revert();
                    throw err;
                } finally {
                    inFlight = null;
                    // Run cleanup async — the user's promise resolves immediately
                    // on task settle; loading-clear may take up to minShow ms
                    // afterwards. Drag/resize unblock the moment pending clears
                    // (synchronous inside cleanupAfterSettle).
                    cleanupAfterSettle();
                }
            };

            inFlight = run();
            return inFlight as Promise<T>;
        };
    };

    const buildDragSnapshot = () => {
        dragSnapshot = {};
        for (const uuid of frames.state.selectedUuids) {
            const f = timeline.state.sectionFramesByUuid[uuid];
            if (f) dragSnapshot[uuid] = cloneFrame(f);
        }
    };


    /**
     * Returns the list of frames currently being dragged (primary first,
     * then everything else in the selection). Used to populate event payloads.
     *
     * Reads from `dragSnapshot` so callers always see the pre-drag values
     * even after `updateFrame` has mutated `sectionFramesByUuid`.
     */
    const getDraggingFrames = (): TimelineFrameByUuidInterface[] => {
        const primaryUuid = state.draggingFrame.uuid;
        const result: TimelineFrameByUuidInterface[] = [];
        if (primaryUuid != null && dragSnapshot[primaryUuid]) {
            result.push(dragSnapshot[primaryUuid]);
        }
        for (const uuid of frames.state.selectedUuids) {
            if (uuid === primaryUuid) continue;
            const snap = dragSnapshot[uuid];
            if (snap) result.push(snap);
        }
        return result;
    };


    /**
     * Builds the `{ initial, current }` snapshot for drag events. One
     * `FrameDataItem` per uuid currently in `state.draggingPlaceholders`,
     * primary first. `initial` reads from timeline state (pre-drag); `current`
     * reads from the placeholder (post-snap).
     */
    const getDraggingFrameData = () : DraggedFrameDataInterface => {
        const primaryUuid = state.draggingFrame.uuid;

        const initial: FrameDataItem[] = [];
        const current: FrameDataItem[] = [];

        const entries = Object.values(state.draggingPlaceholders).sort((a, b) =>
            a.uuid === primaryUuid ? -1 : b.uuid === primaryUuid ? 1 : 0
        );

        entries.forEach(entry => {
            const snap = dragSnapshot[entry.uuid];
            initial.push({
                uuid: entry.uuid,
                sectionUuid: snap?.sectionUuid ?? null,
                rowUuid: snap?.rowUuid ?? null,
                start_ms: snap?.start_ms ?? 0,
                end_ms: snap?.end_ms ?? 0,
            });
            const isPrimary = entry.uuid === primaryUuid;
            current.push({
                uuid: entry.uuid,
                sectionUuid: isPrimary
                    ? timeline.state.pointer.over.sectionUuid
                    : (snap?.sectionUuid ?? null),
                rowUuid: isPrimary
                    ? timeline.state.pointer.over.rowUuid
                    : entry.rowUuid,
                start_ms: entry.start_ms,
                end_ms: entry.end_ms,
            });
        });

        const revert = buildRevert(initial);
        const process = buildProcess(initial, revert);
        return { initial, current, revert, process };
    };


    const setContainer = () => {
        state.container = frames.getFramePointerData();
    };


    // Holds the initial pointerdown data for a frame that MIGHT become a drag.
    // Drag is deferred until the pointer moves more than DRAG_THRESHOLD pixels,
    // so a quick click can still fire 'click' on the frame and trigger deselection.
    let pendingDrag: { pointerId: number, clientX: number, clientY: number, blocked: boolean } | null = null;
    const DRAG_THRESHOLD = 4;


    const startDrag = (event: PointerEvent) => {
        if (!frames.state.primary.uuid) return;

        const target = event.target as HTMLElement;
        if (target.closest('.no-dragging') || target.classList.contains('no-dragging')) return;

        // If pointerdown landed on a non-primary but selected frame (e.g. a
        // linked-group member auto-added by JoinRows), re-target primary to
        // it so pointer math orients around the frame the user grabbed.
        const hitUuid = frames.findSelectedUuidForTarget(target);
        if (hitUuid != null && hitUuid !== frames.state.primary.uuid) {
            frames.setPrimaryFromSelection(hitUuid);
        }

        const primaryContainer = frames.state.primary.container;
        if (!primaryContainer) return;
        if (!primaryContainer.contains(target as Node)) return;

        // Capture whether mutation is blocked NOW; we still register the
        // pending drag so click-to-select keeps working (block in startDrag
        // would also kill the click path). The actual abort + visual flash
        // happens in `activateDrag` once the user crosses the drag threshold —
        // that way a click on a blocked frame just selects it silently, while
        // an actual drag attempt flashes the loading pulse as feedback.
        const blocked = timeline.shouldBlockMutation(frames.state.selectedUuids);

        pendingDrag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, blocked };
        setContainer();
    };


    const activateDrag = (event?: PointerEvent) => {
        if (state.dragging || !pendingDrag || !frames.state.primary.frame) return;

        // User crossed the drag threshold while a pending save is in flight
        // somewhere. Flash the loading pulse on the attempted uuids so they
        // get visible feedback ("can't drag — something is saving"), then
        // bail without activating the drag. The `dragBlocked` event fires
        // synchronously so consumers can show a toast / error message.
        if (pendingDrag.blocked) {
            timeline.signalBlocked(frames.state.selectedUuids);
            const attemptedFrames = frames.state.selectedUuids
                .map(u => timeline.state.sectionFramesByUuid[u])
                .filter((f): f is TimelineFrameByUuidInterface => f != null);
            draggingEvents.triggerOnDragBlocked('in_processing', attemptedFrames, event ?? new PointerEvent('pointerdown'));
            pendingDrag = null;
            return;
        }

        state.dragging = true;
        state.draggingMoved = true;
        state.draggingFrame.data = frames.state.primary.frame;
        state.draggingFrame.uuid = frames.state.primary.uuid;

        // Freeze a deep snapshot of every selected frame BEFORE any external
        // code (event handlers, updateFrame calls) can mutate them.
        buildDragSnapshot();

        writeAllPlaceholders();
        timeline.enableEdgeScrolling();

        if (timeline.state.editor) {
            if (!timeline.state.editor.hasPointerCapture?.(pendingDrag.pointerId)) {
                timeline.state.editor.setPointerCapture(pendingDrag.pointerId);
            }
        }

        draggingEvents.triggerOnDragStart(getDraggingFrames(), event ?? new PointerEvent('pointerdown'));
    };


    const cancelDrag = (event: PointerEvent) => {
        pendingDrag = null;
        if (!state.dragging) return;

        draggingEvents.triggerOnDragCancel(getDraggingFrames(), getDraggingFrameData(), event);
        dragEnd(event);
    };


    const drop = (event: PointerEvent) => {
        pendingDrag = null;
        if (!state.dragging) return;

        draggingEvents.triggerOnDrop(getDraggingFrames(), getDraggingFrameData(), event);
        dragEnd(event);
    };


    const dragEnd = (event: PointerEvent) => {
        if (!state.dragging) return;

        state.dragging = false;
        state.draggingMoved = false;

        if (timeline.state.editor) {
            if (timeline.state.editor.hasPointerCapture?.(event.pointerId)) {
                timeline.state.editor.releasePointerCapture(event.pointerId);
            }
        }

        draggingEvents.triggerOnDragEnd(getDraggingFrames(), getDraggingFrameData(), event);

        state.draggingFrame.data = null;
        state.draggingFrame.uuid = null;
        state.draggingPlaceholders = {};
        dragSnapshot = {};

        timeline.disableEdgeScrolling();
    };


    /**
     * Compute the primary ghost position from the current pointer. Returns
     * { left, top, start_ms, end_ms } or null if drag isn't active.
     */
    const computePrimaryPosition = () => {
        if (!state.dragging || !state.draggingFrame.data) return null;

        let left = timeline.state.pointer.editorRelativeX - state.container.pointerX;
        let top = timeline.state.pointer.editorRelativeY - state.container.pointerY;

        // Row-lock: when rowLocked is true, override top with the original row's
        // editorRelativeTop so the ghost stays on the source row (used by JoinRows).
        if (state.rowLocked) {
            const originalRowUuid = state.draggingFrame.data.rowUuid;
            const originalRow = originalRowUuid != null
                ? timeline.state.sectionRowsByUuid[originalRowUuid]
                : null;
            if (originalRow) top = originalRow.editorRelativeTop;
        }

        // Clamp the freeform ghost inside editor bounds.
        if (edgeSnap) {
            const frameWidth = state.draggingFrame.data.width;
            const minLeft = timelineConfig.editor.paddingLeft;
            const maxLeft = timelineConfig.editor.width - (timelineConfig.editor.paddingRight + frameWidth);
            const minTop = timelineConfig.sections.labelHeight;
            const maxTop = timelineConfig.editor.height - timelineConfig.rows.height;

            if (left < minLeft) left = minLeft;
            else if (left > maxLeft) left = maxLeft;

            if (top < minTop) top = minTop;
            else if (top > maxTop) top = maxTop;
        }

        // Inverse of msToLeft — pixel x → absolute ms (adds `rangeStartMs`
        // so the result lives in the same domain as frame.start_ms).
        const rangeStartMs = (timelineConfig.range.start_seconds ?? 0) * 1000;
        const start_ms = (left - timelineConfig.editor.paddingLeft) / timelineConfig.cols.pixelPerMs + rangeStartMs;
        const end_ms = start_ms + state.draggingFrame.data.width / timelineConfig.cols.pixelPerMs;

        return { left, top, start_ms, end_ms };
    };


    /**
     * Write ghost entries for the primary AND every other selected frame.
     * Members travel with the same time-delta as the primary, on their own row.
     */
    const writeAllPlaceholders = () => {
        if (!state.dragging || !state.draggingFrame.data || state.draggingFrame.uuid == null) return;

        const pos = computePrimaryPosition();
        if (!pos) return;

        const primaryUuid = state.draggingFrame.uuid;
        const primaryFrame = state.draggingFrame.data;

        // Primary
        state.draggingPlaceholders[primaryUuid] = {
            uuid: primaryUuid,
            rowUuid: timeline.state.pointer.over.rowUuid ?? primaryFrame.rowUuid ?? null,
            start_ms: pos.start_ms,
            end_ms: pos.end_ms,
            left: pos.left,
            width: primaryFrame.width,
            top: pos.top,
        };

        // Members — same time-delta, member's own row.
        const delta_ms = pos.start_ms - primaryFrame.start_ms;

        for (const uuid of frames.state.selectedUuids) {
            if (uuid === primaryUuid) continue;
            const memberFrame = timeline.state.sectionFramesByUuid[uuid];
            if (!memberFrame) continue;

            const memberRow = timeline.state.sectionRowsByUuid[memberFrame.rowUuid];
            const m_start = memberFrame.start_ms + delta_ms;
            const m_end = memberFrame.end_ms + delta_ms;
            const m_left = msToLeft(m_start);

            state.draggingPlaceholders[uuid] = {
                uuid,
                rowUuid: memberFrame.rowUuid,
                start_ms: m_start,
                end_ms: m_end,
                left: m_left,
                width: memberFrame.width,
                top: memberRow?.editorRelativeTop ?? 0,
            };
        }

        // Drop ghost entries for any uuids that left the selection mid-drag.
        for (const ghostUuid of Object.keys(state.draggingPlaceholders)) {
            if (ghostUuid === String(primaryUuid)) continue;
            if (!frames.state.selectedUuids.includes(ghostUuid)
                && !frames.state.selectedUuids.includes(Number(ghostUuid))) {
                delete state.draggingPlaceholders[ghostUuid];
            }
        }
    };


    // When an OS-level overlay (screenshot tool, system dialog, alt-tab) takes
    // the pointer mid-drag, the browser fires `lostpointercapture` but no
    // `pointerup`/`pointercancel`. Without handling that, `state.dragging`
    // stays true until the user clicks back into the editor. Treat it as a
    // cancellation — we don't know whether the user released over a valid
    // drop target.
    const onLostPointerCapture = (event: PointerEvent) => {
        if (state.dragging) cancelDrag(event);
        pendingDrag = null;
    };

    const editorPointerEvents = {
        'pointerdown': startDrag,
        'pointerup': drop,
        'pointercancel': cancelDrag,
        'lostpointercapture': onLostPointerCapture,
    } as const;

    type eventTypes = keyof typeof editorPointerEvents;


    // (Re)bind editor pointer listeners whenever the editor element changes.
    watch(() => timeline.state.editor, (newEditor, oldEditor) => {
        oldEditor && Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => oldEditor.removeEventListener(event as eventTypes, handler)
        );
        newEditor && Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => newEditor.addEventListener(event as eventTypes, handler)
        );
    }, { immediate: true });


    // Pointer-move tick: activate pending drag past threshold; refresh ghost positions.
    watch([
        () => timeline.state.pointer.clientX,
        () => timeline.state.pointer.clientY,
    ], () => {
        if (pendingDrag && !state.dragging) {
            const dx = Math.abs(timeline.state.pointer.clientX - pendingDrag.clientX);
            const dy = Math.abs(timeline.state.pointer.clientY - pendingDrag.clientY);
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                activateDrag();
            }
        }
        writeAllPlaceholders();
    });


    // Re-write placeholders when selection changes mid-drag (e.g. JoinRows
    // virtually adds members after a primary becomes available).
    watch(() => frames.state.selectedUuids.slice(), () => {
        if (state.dragging) writeAllPlaceholders();
    });


    onBeforeUnmount(() => {
        timeline.state.editor && Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => timeline.state.editor?.removeEventListener(event as eventTypes, handler)
        );
    });


    const draggingFrame = (uuid: string | number) =>
        timeline.state.sectionFramesByUuid[uuid] ?? null;

    const dragging = (uuid: string | number): boolean =>
        state.dragging && state.draggingPlaceholders[uuid] != null;

    return {
        state,
        draggingFrame,
        dragging,
        getDraggingFrames,
        onDragStart: draggingEvents.onDragStart,
        onDragEnd: draggingEvents.onDragEnd,
        onDragCancel: draggingEvents.onDragCancel,
        onDrop: draggingEvents.onDrop,
        onDragBlocked: draggingEvents.onDragBlocked,
        removeEvent: draggingEvents.removeEvent,
    };
};

export type UseDndType = ReturnType<typeof useDnd>;

export interface DndStateInterface {
    dragging: boolean,
    /** True once the pointer moves more than DRAG_THRESHOLD during the current session. */
    draggingMoved: boolean,
    /** Primary frame data (the one the user pointer-downed on). */
    draggingFrame: {
        data: TimelineFrameByUuidInterface | null,
        uuid: string | number | null,
    },
    container: {
        width: number,
        height: number,
        pointerX: number,
        pointerY: number,
    },
    /** When true, vertical position is locked to the original row. */
    rowLocked: boolean,
    /** Map of active ghost placeholders keyed by frame uuid (one per selected uuid). */
    draggingPlaceholders: Record<string | number, DraggingPlaceholderInterface>,
}

export interface DraggingPlaceholderInterface {
    uuid: string | number,
    rowUuid: string | number | null,
    start_ms: number,
    end_ms: number,
    left: number,
    width: number,
    top: number,
}
