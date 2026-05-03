import { reactive, watchEffect } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { UseDndType } from "./dnd";
import { UseResizeInterface } from "./resize";

/**
 * useJoinRows
 *
 * Manages linked-frame groups (joined rows). Frames sharing the same
 * `linkGroupUuid` belong to one logical booking that spans multiple rows.
 *
 * Responsibilities:
 *  - Maintains a reactive group map: groupUuid → frame uuids[]
 *  - Exposes helpers consumed by Dnd and Resize to keep all members in sync
 *  - Exposes group membership so Row/Frame can highlight all members together
 *
 * Design rules (per spec):
 *  - All members always share the same start_ms / end_ms
 *  - Row assignment never changes when dragging — only time shifts
 */
export const useJoinRows = ({
    timeline,
    timelineConfig,
    getDnd = () => null,
    getResize = () => null,
}: {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    getDnd?: () => UseDndType | null,
    getResize?: () => UseResizeInterface | null,
}) => {

    const state = reactive<JoinRowsStateInterface>({
        // groupUuid → array of frame uuids belonging to that group
        groups: {},
        // frameUuid → groupUuid (reverse index for O(1) lookup)
        frameGroupMap: {},
    });

    // Keep group maps in sync whenever timeline frame data changes.
    watchEffect(() => {
        const groups: Record<string | number, (string | number)[]> = {};
        const frameGroupMap: Record<string | number, string | number> = {};

        Object.values(timeline.state.sectionFramesByUuid).forEach(frame => {
            if (frame.linkGroupUuid == null) return;

            if (!groups[frame.linkGroupUuid]) {
                groups[frame.linkGroupUuid] = [];
            }
            groups[frame.linkGroupUuid].push(frame.uuid);
            frameGroupMap[frame.uuid] = frame.linkGroupUuid;
        });

        state.groups = groups;
        state.frameGroupMap = frameGroupMap;
    });

    // Drive dnd.row_locked: true while the dragging frame belongs to a link group.
    // Cleared automatically when dragging stops (draggingFrame.uuid becomes null).
    watchEffect(() => {
        const dnd = getDnd();
        if (!dnd) return;
        const uuid = dnd.state.draggingFrame.uuid;
        dnd.state.rowLocked =
            uuid != null && isLinked(uuid);
    });

    // Write drag ghost entries for all group members while the primary frame is dragging.
    // Each member ghost tracks the same time delta as the primary but stays on its own row.
    watchEffect(() => {
        const dnd = getDnd();
        if (!dnd) return;
        const primaryUuid = dnd.state.draggingFrame.uuid;
        if (primaryUuid == null) return;

        const primaryEntry = dnd.state.draggingPlaceholders[primaryUuid];
        if (!primaryEntry) return;

        const primaryFrameData = dnd.state.draggingFrame.data;
        if (!primaryFrameData) return;

        const delta_ms = primaryEntry.start_ms - primaryFrameData.start_ms;

        getGroupMembers(primaryUuid).forEach(memberUuid => {
            if (memberUuid === primaryUuid) return;

            const memberFrame = timeline.state.sectionFramesByUuid[memberUuid];
            if (!memberFrame) return;

            const memberRow = timeline.state.sectionRowsByUuid[memberFrame.rowUuid];
            const start_ms = memberFrame.start_ms + delta_ms;
            const end_ms = memberFrame.end_ms + delta_ms;
            const left = (start_ms * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft;

            dnd.state.draggingPlaceholders[memberUuid] = {
                uuid: memberUuid,
                rowUuid: memberFrame.rowUuid,
                start_ms,
                end_ms,
                left,
                width: memberFrame.width,
                top: memberRow?.editorRelativeTop ?? 0,
            };
        });
    });

    // Write resize ghost entries for all group members while the primary frame is resizing.
    // All members share the same start/end times as the primary; only top differs per row.
    watchEffect(() => {
        const resize = getResize();
        if (!resize) return;
        const primaryUuid = resize.state.resizingFrame.uuid;
        if (primaryUuid == null) return;

        const primaryEntry = resize.state.resizingPlaceholders[primaryUuid];
        if (!primaryEntry) return;

        getGroupMembers(primaryUuid).forEach(memberUuid => {
            if (memberUuid === primaryUuid) return;

            const memberFrame = timeline.state.sectionFramesByUuid[memberUuid];
            if (!memberFrame) return;

            const memberRow = timeline.state.sectionRowsByUuid[memberFrame.rowUuid];

            resize.state.resizingPlaceholders[memberUuid] = {
                uuid: memberUuid,
                rowUuid: memberFrame.rowUuid,
                start_ms: primaryEntry.start_ms,
                end_ms: primaryEntry.end_ms,
                left: primaryEntry.left,
                width: primaryEntry.width,
                top: memberRow?.editorRelativeTop ?? 0,
            };
        });
    });

    /**
     * Returns all frame uuids in the same link group as `frameUuid`.
     * Returns an empty array if the frame is not part of any group.
     */
    const getGroupMembers = (frameUuid: string | number): (string | number)[] => {
        const groupUuid = state.frameGroupMap[frameUuid];
        if (groupUuid == null) return [];
        return state.groups[groupUuid] ?? [];
    };

    /**
     * Returns true if the frame belongs to a link group.
     */
    const isLinked = (frameUuid: string | number): boolean => {
        return state.frameGroupMap[frameUuid] != null;
    };

    /**
     * Returns the groupUuid for a frame, or null if not linked.
     */
    const getGroupUuid = (frameUuid: string | number): string | number | null => {
        return state.frameGroupMap[frameUuid] ?? null;
    };

    /**
     * Syncs all other group members to the given start/end times.
     * Called by Dnd and Resize after the primary frame is updated.
     * Skips `sourceFrameUuid` itself (already updated by the caller).
     */
    const syncGroupTimes = (
        sourceFrameUuid: string | number,
        start_ms: number,
        end_ms: number,
    ): void => {
        const members = getGroupMembers(sourceFrameUuid);
        members.forEach(uuid => {
            if (uuid === sourceFrameUuid) return;
            const frame = timeline.state.sectionFramesByUuid[uuid];
            if (!frame) return;
            timeline.updateFrame(uuid, {
                ...frame,
                start_ms,
                end_ms,
            });
        });
    };

    return {
        state,
        getGroupMembers,
        isLinked,
        getGroupUuid,
        syncGroupTimes,
    };
};

export type UseJoinRowsType = ReturnType<typeof useJoinRows>;

export interface JoinRowsStateInterface {
    groups: Record<string | number, (string | number)[]>,
    frameGroupMap: Record<string | number, string | number>,
}
