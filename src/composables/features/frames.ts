import { onBeforeUnmount, reactive, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { TimelineFrameByUuidInterface } from "../../types/timeline";

/**
 * useFrames
 *
 * Multi-frame selection container — single source of truth for
 * "which frames are selected" across the whole package.
 *
 * Conceptually:
 *  • `state.primary` is the frame the user directly interacted with
 *    (clicked / drag-started / resize-started). It owns the HTMLDivElement
 *    container that pointer-math (drag delta, resize side detection) needs.
 *  • `state.selectedUuids` is the full set of selected frames, primary
 *    included. Order: primary first, then anything added by features
 *    (e.g. JoinRows) or future shift-click multi-select.
 *
 * Drag/Resize and Snapping iterate `selectedUuids` to operate on the
 * entire selection. They never need to know whether the extra members
 * came from JoinRows, multi-select, or anywhere else.
 *
 * Also owns two always-on editor interactions: clearing the selection on an
 * outside click, and the press-and-hold gesture surfaced via `onFrameHold`
 * (wired to `<Timeline @frameHold>`).
 */
export const useFrames = ({
    timeline,
    // timelineConfig kept in signature for parity with other features even though
    // it isn't read here — future selection helpers (e.g. marquee select) will need it.
    timelineConfig,
}: {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
}) => {
    void timelineConfig;

    const state = reactive<FramesStateInterface>({
        primary: {
            uuid: null,
            frame: null,
            container: null,
        },
        selectedUuids: [],
    });

    // Live per-frame container map. Frame.vue calls syncSelectedContainer
    // whenever its DOM node mounts / updates / unmounts. Stored on a plain
    // record (still reactive — we only need shallow tracking).
    const containers = reactive<Record<string | number, HTMLDivElement>>({});

    // ─── Selection api ──────────────────────────────────────────────────────

    const isFrameSelected = (uuid: string | number): boolean =>
        state.selectedUuids.includes(uuid);

    const _setPrimary = (
        uuid: string | number,
        frame: TimelineFrameByUuidInterface,
        container: HTMLDivElement,
    ) => {
        state.primary.uuid = uuid;
        state.primary.frame = frame;
        state.primary.container = container;
    };

    const _clearPrimary = () => {
        state.primary.uuid = null;
        state.primary.frame = null;
        state.primary.container = null;
    };

    // Source of the most recent selection change. `selectFrame` flips this
    // based on whether a real PointerEvent was provided; internal callers
    // that bypass selectFrame use `_clearAllAs(...)` to mark explicitly.
    // Consumers (e.g. <Sections/>) read it to decide whether to surface the
    // change as a `frame-selected` / `frame-deselected` event.
    let lastSelectionSource: 'user' | 'programmatic' = 'programmatic';
    const getLastSelectionSource = () => lastSelectionSource;

    /**
     * Replace the entire selection with a single frame and make it primary.
     * Called by click-to-select. The source is 'user' when a PointerEvent
     * is provided, otherwise 'programmatic'.
     */
    const selectFrame = (
        event: PointerEvent | null,
        frame: TimelineFrameByUuidInterface,
        container: HTMLDivElement,
        uuid: string | number,
    ) => {
        lastSelectionSource = event ? 'user' : 'programmatic';
        _setPrimary(uuid, frame, container);
        state.selectedUuids = [uuid];
    };

    // Shared clear used by both the public deselectAll (programmatic by
    // default) and the editor outside-click handler (which marks 'user').
    const _clearAllAs = (source: 'user' | 'programmatic') => {
        lastSelectionSource = source;
        _clearPrimary();
        state.selectedUuids = [];
    };

    /**
     * Convenience: select a frame by uuid alone. Resolves the frame data and
     * live container internally. Returns false when the frame isn't in state
     * or its container hasn't mounted yet. Pairs naturally with
     * `timeline.scrollToViewPort(uuid)` for a "jump-and-select" effect.
     */
    const selectByUuid = (uuid: string | number): boolean => {
        const frame = timeline.state.sectionFramesByUuid[uuid];
        const container = containers[uuid];
        if (!frame || !container) return false;
        selectFrame(null, frame, container, uuid);
        return true;
    };

    // Register with the timeline so `scrollToViewPort(uuid, _, true)` can
    // select the target. Late-bound because useFrames is created after
    // useTimeline; cleared on unmount to avoid leaks.
    timeline.setFrameSelector(selectByUuid);
    onBeforeUnmount(() => timeline.setFrameSelector(null));

    /**
     * Clear all selection — primary and members. Marks the change as
     * 'programmatic'; the editor outside-click handler uses `_clearAllAs`
     * with 'user' directly so it can be distinguished from API calls.
     */
    const deselectAll = () => {
        _clearAllAs('programmatic');
    };

    // Backwards-compatible alias.
    const deselectFrame = deselectAll;

    /**
     * Click toggle: if the clicked frame is already primary, clear all.
     * Otherwise replace the selection with this frame.
     *
     * When the click is the tail of a press-and-hold (the hold timer fired
     * during the gesture), the toggle is suppressed — the frame stays
     * selected so the host's `frame-hold` handler can act on it without it
     * being immediately deselected by the release click.
     */
    const toggleFrame = (
        event: PointerEvent,
        frame: TimelineFrameByUuidInterface,
        container: HTMLDivElement,
        uuid: string | number,
    ) => {
        if (holdJustFired) {
            holdJustFired = false;
            selectFrame(event, frame, container, uuid);
            return;
        }
        if (state.primary.uuid === uuid) {
            _clearAllAs('user');
        } else {
            selectFrame(event, frame, container, uuid);
        }
    };

    /**
     * Re-target `primary` to a uuid that's already in the selection, without
     * altering `selectedUuids`. Used by dnd/resize when the user pointer-downs
     * on a non-primary but already-selected frame (e.g. linked group member)
     * so that pointer math, ghost rendering and event payloads orient around
     * the frame they actually grabbed.
     *
     * No-op if `uuid` is the current primary or isn't in the selection / has
     * no live container yet.
     */
    const setPrimaryFromSelection = (uuid: string | number): boolean => {
        if (state.primary.uuid === uuid) return false;
        if (!state.selectedUuids.includes(uuid)) return false;
        const frame = timeline.state.sectionFramesByUuid[uuid];
        const container = containers[uuid];
        if (!frame || !container) return false;
        _setPrimary(uuid, frame, container);
        // Keep primary first in selectedUuids ordering.
        state.selectedUuids = [uuid, ...state.selectedUuids.filter(u => u !== uuid)];
        return true;
    };

    /**
     * Find which selected uuid (if any) owns the given DOM target. Returns
     * null when the target is outside every selected frame's container.
     */
    const findSelectedUuidForTarget = (target: Node): string | number | null => {
        for (const uuid of state.selectedUuids) {
            const c = containers[uuid];
            if (c && c.contains(target)) return uuid;
        }
        return null;
    };

    /**
     * Add frame uuids to the selection (primary unchanged). Used by features
     * like JoinRows to virtually expand the selection set so that drag /
     * resize automatically operate on every member.
     */
    const addToSelection = (uuids: (string | number)[]) => {
        for (const u of uuids) {
            if (!state.selectedUuids.includes(u)) state.selectedUuids.push(u);
        }
    };

    /**
     * Remove frame uuids from the selection. Primary itself can't be removed
     * by this call — use deselectAll for that.
     */
    const removeFromSelection = (uuids: (string | number)[]) => {
        const primary = state.primary.uuid;
        state.selectedUuids = state.selectedUuids.filter(
            u => !uuids.includes(u) || u === primary,
        );
    };

    /**
     * Returns the currently-selected frames' raw data (primary first).
     * Reactive: safe to call from computed / templates.
     */
    const getSelectedFrames = (): TimelineFrameByUuidInterface[] => {
        const list: TimelineFrameByUuidInterface[] = [];
        for (const u of state.selectedUuids) {
            const f = timeline.state.sectionFramesByUuid[u];
            if (f) list.push(f);
        }
        return list;
    };

    // ─── Container api ──────────────────────────────────────────────────────

    /**
     * Frame.vue calls this whenever its DOM container mounts / updates /
     * unmounts. Stored per-uuid; primary's container is also mirrored on
     * `state.primary.container` for direct use by drag/resize.
     */
    const syncSelectedContainer = (
        container: HTMLDivElement | null,
        frame: TimelineFrameByUuidInterface,
        uuid: string | number,
    ) => {
        if (container) {
            containers[uuid] = container;
            if (state.primary.uuid === uuid) {
                state.primary.container = container;
                state.primary.frame = frame;
            }
        } else {
            delete containers[uuid];
            if (state.primary.uuid === uuid) {
                state.primary.container = null;
            }
        }
    };

    const getContainer = (uuid: string | number): HTMLDivElement | null =>
        containers[uuid] ?? null;

    /**
     * Pointer-relative metrics for the primary frame's container.
     * dnd/resize use this to compute drag/resize math.
     */
    const getFramePointerData = () => {
        const c = state.primary.container;
        const rect = c?.getBoundingClientRect();
        return {
            width: c?.clientWidth ?? 0,
            height: c?.clientHeight ?? 0,
            pointerX: rect ? timeline.state.pointer.clientX - rect.left : 0,
            pointerY: rect ? timeline.state.pointer.clientY - rect.top : 0,
        };
    };

    // ─── Frame interaction: long-press + outside-click deselect ─────────────

    type FrameHoldHandler = (
        frame: TimelineFrameByUuidInterface,
        event: PointerEvent,
    ) => void;

    const holdHandlers = new Set<FrameHoldHandler>();

    /**
     * Register a press-and-hold listener. Fires when the pointer is held on a
     * frame for `holdDurationMs` without moving past `holdThresholdPx`.
     * Returns an unregister function.
     */
    const onFrameHold = (handler: FrameHoldHandler): (() => void) => {
        holdHandlers.add(handler);
        return () => holdHandlers.delete(handler);
    };

    // Hold duration (ms) and the movement tolerance (px) past which the
    // gesture is treated as a drag and the pending hold is cancelled.
    let holdDurationMs = 600;
    let holdThresholdPx = 8;
    const setHoldDuration = (ms: number) => { holdDurationMs = Math.max(0, ms); };
    const setHoldThreshold = (px: number) => { holdThresholdPx = Math.max(0, px); };

    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let holdGesture: {
        pointerId: number,
        x: number,
        y: number,
        uuid: string | number,
        event: PointerEvent,
    } | null = null;
    // True between the hold timer firing and the next click/pointerdown.
    // `toggleFrame` reads this to suppress the deselect that would otherwise
    // happen on the release click after a long-press.
    let holdJustFired = false;

    const cancelHold = () => {
        if (holdTimer !== null) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }
        holdGesture = null;
    };

    // Resolve the frame uuid owning a DOM node — ANY frame, not just selected
    // ones (that's the difference from findSelectedUuidForTarget).
    const frameUuidForTarget = (target: Node | null): string | number | null => {
        const container = (target as HTMLElement | null)
            ?.closest?.('.vtd__row-frame-container');
        if (!container) return null;
        for (const uuid in containers) {
            if (containers[uuid] === container) return uuid;
        }
        return null;
    };

    const onEditorPointerDown = (event: PointerEvent) => {
        cancelHold();
        // Fresh gesture — clear any stale flag from a previous hold whose
        // release click never reached us (e.g. pointer lifted off-frame).
        holdJustFired = false;
        if (holdHandlers.size === 0 || holdDurationMs <= 0) return;

        const uuid = frameUuidForTarget(event.target as Node | null);
        if (uuid == null) return;

        holdGesture = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            uuid,
            event,
        };
        holdTimer = setTimeout(() => {
            holdTimer = null;
            const gesture = holdGesture;
            holdGesture = null;
            if (!gesture) return;
            const frame = timeline.state.sectionFramesByUuid[gesture.uuid];
            if (!frame) return;
            // Mark so the imminent release click doesn't toggle-off the
            // frame. Consumed (reset) by the next toggleFrame or cleared
            // on the next pointerdown if no click follows.
            holdJustFired = true;
            holdHandlers.forEach(handler => handler(frame, gesture.event));
        }, holdDurationMs);
    };

    const onEditorPointerMove = (event: PointerEvent) => {
        if (!holdGesture || event.pointerId !== holdGesture.pointerId) return;
        const dx = Math.abs(event.clientX - holdGesture.x);
        const dy = Math.abs(event.clientY - holdGesture.y);
        if (dx > holdThresholdPx || dy > holdThresholdPx) cancelHold();
    };

    const onEditorPointerUp = (event: PointerEvent) => {
        if (holdGesture && event.pointerId !== holdGesture.pointerId) return;
        cancelHold();
    };

    // A click anywhere that isn't a frame clears the selection. Clicking a
    // frame is handled by the frame's own click → selectFrame, so it's
    // skipped here. Panning suppresses the trailing click (see panScroll),
    // so a pan won't deselect.
    const onEditorClick = (event: MouseEvent) => {
        const onFrame = (event.target as HTMLElement | null)
            ?.closest?.('.vtd__row-frame-container');
        // User clicked outside a frame — clear as a user-driven deselect so
        // <Sections silentExternalSelection> still surfaces this case.
        if (!onFrame) _clearAllAs('user');
    };

    const editorListeners: Record<string, EventListener> = {
        pointerdown: onEditorPointerDown as EventListener,
        pointermove: onEditorPointerMove as EventListener,
        pointerup: onEditorPointerUp as EventListener,
        pointercancel: onEditorPointerUp as EventListener,
        click: onEditorClick as EventListener,
    };

    const attachEditor = (el: HTMLElement) => {
        for (const name in editorListeners) {
            el.addEventListener(name, editorListeners[name]);
        }
    };

    const detachEditor = (el: HTMLElement) => {
        cancelHold();
        for (const name in editorListeners) {
            el.removeEventListener(name, editorListeners[name]);
        }
    };

    watch(() => timeline.state.editor, (newEditor, oldEditor) => {
        if (oldEditor instanceof HTMLElement) detachEditor(oldEditor);
        if (newEditor instanceof HTMLElement) attachEditor(newEditor);
    }, { immediate: true });

    onBeforeUnmount(() => {
        const editor = timeline.state.editor;
        if (editor instanceof HTMLElement) detachEditor(editor);
    });

    // ─── Reactive sync ──────────────────────────────────────────────────────

    // Refresh primary's frame data + drop deleted uuids whenever the timeline
    // frame map changes (e.g. updateFrame after drop, frame removal).
    watch(() => timeline.state.sectionFramesByUuid, (frames) => {
        if (state.primary.uuid != null) {
            const f = frames[state.primary.uuid] ?? null;
            if (f) {
                state.primary.frame = f;
            } else {
                deselectAll();
                return;
            }
        }
        state.selectedUuids = state.selectedUuids.filter(u => frames[u] != null);
    }, { deep: true });

    return {
        state,
        containers,
        // selection api
        selectFrame,
        selectByUuid,
        deselectFrame,
        getLastSelectionSource,
        deselectAll,
        toggleFrame,
        addToSelection,
        removeFromSelection,
        isFrameSelected,
        getSelectedFrames,
        setPrimaryFromSelection,
        findSelectedUuidForTarget,
        // container api
        syncSelectedContainer,
        getContainer,
        getFramePointerData,
        // interaction api
        onFrameHold,
        setHoldDuration,
        setHoldThreshold,
    };
};

export interface FramesStateInterface {
    primary: {
        uuid: string | number | null,
        frame: TimelineFrameByUuidInterface | null,
        container: HTMLDivElement | null,
    },
    /**
     * All currently-selected frame uuids (primary first).
     * Mutate via the api; never assign directly from outside.
     */
    selectedUuids: (string | number)[],
}

export type UseFramesType = ReturnType<typeof useFrames>;
