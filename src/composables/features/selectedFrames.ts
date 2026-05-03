import { reactive, watchEffect } from "vue";
import { UseFrameInterface } from "./frame";
import { UseJoinRowsType } from "./joinRows";

/**
 * useSelectedFrames
 *
 * Single source of truth for which frames are visually "selected".
 * Always active — no feature component required.
 *
 * When JoinRows is not mounted: selectedUuids contains at most one uuid
 * (the directly-clicked frame).
 *
 * When JoinRows is mounted: selectedUuids contains the clicked frame AND
 * every other frame in the same link group, kept in sync reactively.
 *
 * Consumers (e.g. Row.vue) call isFrameSelected(uuid) without needing to
 * know whether JoinRows is active.
 */
export const useSelectedFrames = ({
    frame,
    getJoinRows,
}: {
    frame: UseFrameInterface,
    getJoinRows: () => UseJoinRowsType | null,
}) => {

    // Reactive Set — Vue 3 tracks .has(), .add(), .clear() on reactive Sets.
    const selectedUuids = reactive(new Set<string | number>());

    // Re-runs whenever:
    //   • frame.state.selected.uuid changes (user selects / deselects)
    //   • features.joinRows changes (JoinRows mounts or unmounts)
    //   • joinRows.state.groups changes (frame linkGroupUuid data updates)
    watchEffect(() => {
        const uuid = frame.state.selected.uuid;

        selectedUuids.clear();
        if (uuid == null) return;

        selectedUuids.add(uuid);

        const joinRows = getJoinRows();
        if (joinRows) {
            joinRows.getGroupMembers(uuid).forEach(u => selectedUuids.add(u));
        }
    });

    /**
     * Returns true if the given frame uuid is part of the current selection
     * (either directly selected or a group member of the selected frame).
     * Reactive: safe to call from templates and computed properties.
     */
    const isFrameSelected = (uuid: string | number): boolean => {
        return selectedUuids.has(uuid);
    };

    return {
        selectedUuids,
        isFrameSelected,
    };
};

export type UseSelectedFramesType = ReturnType<typeof useSelectedFrames>;
