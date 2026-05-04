import { reactive, watchEffect } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseDndType, DraggingPlaceholderInterface } from "./dnd";
import { UseResizeInterface } from "./resize";
import { UseFramesType } from "./frames";

/**
 * useJoinRows
 *
 * Linked-frame groups (joined bookings). Frames sharing the same
 * `linkGroupUuid` belong to one logical booking that spans multiple rows.
 *
 * Responsibilities (post-refactor):
 *  1. Maintain a reactive group map: groupUuid → frame uuids[]
 *  2. **Selection expansion** — when a frame is selected (becomes primary)
 *     and that frame belongs to a group, every other group member is
 *     auto-added to `frames.state.selectedUuids`. From there, dnd/resize
 *     pick up the rest of the group automatically; this composable no
 *     longer writes ghost placeholders.
 *  3. Drive `dnd.state.rowLocked` so a grouped drag stays on its row.
 *  4. Provide visual helpers (`getGhostLinkFlags`) so Vue templates can
 *     render the connected-edge style without doing the math themselves.
 */
export const useJoinRows = ({
    timeline,
    timelineConfig,
    frames,
    getDnd = () => null,
    getResize = () => null,
}: {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    frames: UseFramesType,
    getDnd?: () => UseDndType | null,
    getResize?: () => UseResizeInterface | null,
}) => {
    void getResize;

    const state = reactive<JoinRowsStateInterface>({
        groups: {},
        frameGroupMap: {},
    });

    // Keep group maps in sync with timeline frame data.
    watchEffect(() => {
        const groups: Record<string | number, (string | number)[]> = {};
        const frameGroupMap: Record<string | number, string | number> = {};

        Object.values(timeline.state.sectionFramesByUuid).forEach(frame => {
            if (frame.linkGroupUuid == null) return;
            if (!groups[frame.linkGroupUuid]) groups[frame.linkGroupUuid] = [];
            groups[frame.linkGroupUuid].push(frame.uuid);
            frameGroupMap[frame.uuid] = frame.linkGroupUuid;
        });

        state.groups = groups;
        state.frameGroupMap = frameGroupMap;
    });

    // Selection expansion: when primary changes and the primary belongs to a
    // group, add every other group member to the selection.
    watchEffect(() => {
        const primaryUuid = frames.state.primary.uuid;
        if (primaryUuid == null) return;
        const members = getGroupMembers(primaryUuid);
        const others = members.filter(u => u !== primaryUuid);
        if (others.length > 0) frames.addToSelection(others);
    });

    // Drive dnd.row_locked: true while the dragging primary belongs to a group.
    watchEffect(() => {
        const dnd = getDnd();
        if (!dnd) return;
        const uuid = dnd.state.draggingFrame.uuid;
        dnd.state.rowLocked = uuid != null && isLinked(uuid);
    });

    /**
     * Returns all frame uuids in the same link group as `frameUuid`.
     * Empty array if not part of any group.
     */
    const getGroupMembers = (frameUuid: string | number): (string | number)[] => {
        const groupUuid = state.frameGroupMap[frameUuid];
        if (groupUuid == null) return [];
        return state.groups[groupUuid] ?? [];
    };

    const isLinked = (frameUuid: string | number): boolean =>
        state.frameGroupMap[frameUuid] != null;

    const getGroupUuid = (frameUuid: string | number): string | number | null =>
        state.frameGroupMap[frameUuid] ?? null;

    /**
     * Visual helper for ghost rendering. Given a ghost-placeholder map and a
     * uuid, returns whether the entry has a linked sibling immediately
     * above / below it. Templates use these flags to flatten the shared
     * border so adjacent ghosts look connected.
     *
     * @param uuid     frame uuid to inspect
     * @param ghostMap the active placeholder map (e.g. dnd.state.draggingPlaceholders)
     */
    const getGhostLinkFlags = (
        uuid: string | number,
        ghostMap: Record<string | number, DraggingPlaceholderInterface>,
    ): { linkedAbove: boolean, linkedBelow: boolean } => {
        const rowHeight = timelineConfig.rows.height ?? 0;
        const myGroup = state.frameGroupMap[uuid];
        if (myGroup == null) return { linkedAbove: false, linkedBelow: false };

        const me = ghostMap[uuid];
        if (!me) return { linkedAbove: false, linkedBelow: false };

        const sorted = Object.values(ghostMap).sort((a, b) => a.top - b.top);
        const idx = sorted.findIndex(e => e.uuid === uuid);

        const linkedAbove = idx > 0
            && Math.abs(sorted[idx - 1].top - me.top) <= rowHeight
            && state.frameGroupMap[sorted[idx - 1].uuid] === myGroup;

        const linkedBelow = idx >= 0 && idx < sorted.length - 1
            && Math.abs(sorted[idx + 1].top - me.top) <= rowHeight
            && state.frameGroupMap[sorted[idx + 1].uuid] === myGroup;

        return { linkedAbove: !!linkedAbove, linkedBelow: !!linkedBelow };
    };

    /**
     * Returns whether a static (non-ghost) frame has a linked sibling on
     * the row immediately above / below it. Used by Frame.vue to flatten
     * the shared border for the resting connected look.
     */
    const getStaticLinkFlags = (
        uuid: string | number,
    ): { linkedAbove: boolean, linkedBelow: boolean } => {
        const f = timeline.state.sectionFramesByUuid[uuid];
        if (!f?.linkGroupUuid) return { linkedAbove: false, linkedBelow: false };

        const sectionUuid = f.sectionUuid;
        if (sectionUuid == null) return { linkedAbove: false, linkedBelow: false };
        const rowUuids = timeline.state.sectionRowUuids[sectionUuid] ?? [];
        const idx = rowUuids.indexOf(f.rowUuid);
        if (idx < 0) return { linkedAbove: false, linkedBelow: false };

        const linkUuid = f.linkGroupUuid;
        const groupMembers = state.groups[linkUuid] ?? [];

        const hasMemberInRow = (rowUuid: string | number) =>
            groupMembers.some(memberUuid => {
                const mf = timeline.state.sectionFramesByUuid[memberUuid];
                return mf && mf.rowUuid === rowUuid;
            });

        const linkedAbove = idx > 0 && hasMemberInRow(rowUuids[idx - 1]);
        const linkedBelow = idx < rowUuids.length - 1 && hasMemberInRow(rowUuids[idx + 1]);

        return { linkedAbove, linkedBelow };
    };

    return {
        state,
        getGroupMembers,
        isLinked,
        getGroupUuid,
        getGhostLinkFlags,
        getStaticLinkFlags,
    };
};

export type UseJoinRowsType = ReturnType<typeof useJoinRows>;

export interface JoinRowsStateInterface {
    groups: Record<string | number, (string | number)[]>,
    frameGroupMap: Record<string | number, string | number>,
}
