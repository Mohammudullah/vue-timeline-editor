import { reactive, watch } from "vue";
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

    /**
     * Replace the entire selection with a single frame and make it primary.
     * Called by click-to-select.
     */
    const selectFrame = (
        event: PointerEvent | null,
        frame: TimelineFrameByUuidInterface,
        container: HTMLDivElement,
        uuid: string | number,
    ) => {
        void event;
        _setPrimary(uuid, frame, container);
        state.selectedUuids = [uuid];
    };

    /**
     * Clear all selection — primary and members.
     */
    const deselectAll = () => {
        _clearPrimary();
        state.selectedUuids = [];
    };

    // Backwards-compatible alias.
    const deselectFrame = deselectAll;

    /**
     * Click toggle: if the clicked frame is already primary, clear all.
     * Otherwise replace the selection with this frame.
     */
    const toggleFrame = (
        event: PointerEvent,
        frame: TimelineFrameByUuidInterface,
        container: HTMLDivElement,
        uuid: string | number,
    ) => {
        if (state.primary.uuid === uuid) {
            deselectAll();
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
        deselectFrame,
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
