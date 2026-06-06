import { computed } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";

export interface RowBlockage {
    rowUuids: (string | number)[];
    start_ms?: number | null;
    end_ms?: number | null;
    full_row?: boolean;
    block_ulid: string;
    title?: string | null;
}

export interface SectionBlockage {
    sectionUuid: string | number;
    start_ms?: number | null;
    end_ms?: number | null;
    full_row?: boolean;
    block_ulid: string;
    title?: string | null;
}

export interface ComputedBlock {
    key: string;
    top: number;
    height: number;
    left: number;
    width: number;
    isSection: boolean;
    rowUuids: (string | number)[];
    blockage: RowBlockage | SectionBlockage;
    title: string | null | undefined;
    block_ulid: string;
    full_row: boolean;
}

export const useBlockedAreas = ({
    timeline,
    timelineConfig,
    rowBlockages,
    sectionBlockages,
}: {
    timeline: UseTimelineInterface;
    timelineConfig: TimelineConfigInterface;
    rowBlockages: () => RowBlockage[];
    sectionBlockages: () => SectionBlockage[];
}) => {

    const getHorizontal = (
        startMs: number | null | undefined,
        endMs: number | null | undefined,
        fullRow: boolean | undefined,
    ) => {
        const rangeStartMs = (timelineConfig.range.start_seconds ?? 0) * 1000;
        const rangeEndMs = (timelineConfig.range.end_seconds ?? 0) * 1000;
        const pxPerMs = timelineConfig.cols.pixelPerMs;
        const paddingLeft = timelineConfig.editor.paddingLeft;

        if (fullRow || startMs == null || endMs == null) {
            return { left: paddingLeft, width: (rangeEndMs - rangeStartMs) * pxPerMs };
        }

        const left = (startMs - rangeStartMs) * pxPerMs + paddingLeft;
        const right = (endMs - rangeStartMs) * pxPerMs + paddingLeft;
        return { left, width: Math.max(0, right - left) };
    };

    // Split a sorted array of integers into runs of consecutive values.
    const consecutiveRuns = (sorted: number[]): number[][] => {
        if (!sorted.length) return [];
        const runs: number[][] = [];
        let run = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === sorted[i - 1] + 1) {
                run.push(sorted[i]);
            } else {
                runs.push(run);
                run = [sorted[i]];
            }
        }
        runs.push(run);
        return runs;
    };

    const rowBlocks = computed((): ComputedBlock[] => {
        const blocks: ComputedBlock[] = [];

        for (const blockage of rowBlockages()) {
            // Group rows by section, recording each row's position in its section's ordered list.
            const bySectionUuid = new Map<string | number, Array<{ rowUuid: string | number; index: number }>>();

            for (const rowUuid of blockage.rowUuids) {
                const row = timeline.state.sectionRowsByUuid[rowUuid];
                if (!row) continue;

                const sectionUuid = row.sectionUuid;
                const orderedUuids = timeline.state.sectionRowUuids[sectionUuid];
                if (!orderedUuids) continue;

                const index = orderedUuids.findIndex(u => String(u) === String(rowUuid));
                if (index === -1) continue;

                if (!bySectionUuid.has(sectionUuid)) bySectionUuid.set(sectionUuid, []);
                bySectionUuid.get(sectionUuid)!.push({ rowUuid, index });
            }

            for (const [, entries] of bySectionUuid) {
                entries.sort((a, b) => a.index - b.index);

                // Deduplicate by index in case the same rowUuid appears twice.
                const seen = new Set<number>();
                const deduped = entries.filter(e => {
                    if (seen.has(e.index)) return false;
                    seen.add(e.index);
                    return true;
                });

                const runs = consecutiveRuns(deduped.map(e => e.index));

                for (const run of runs) {
                    const runEntries = run.map(idx => deduped.find(e => e.index === idx)!);
                    const firstRow = timeline.state.sectionRowsByUuid[runEntries[0].rowUuid];
                    const lastRow = timeline.state.sectionRowsByUuid[runEntries[runEntries.length - 1].rowUuid];

                    if (!firstRow || !lastRow) continue;

                    const top = firstRow.editorRelativeTop;
                    const height = lastRow.editorRelativeBottom - top;
                    if (height <= 0) continue;

                    const { left, width } = getHorizontal(blockage.start_ms, blockage.end_ms, blockage.full_row);

                    blocks.push({
                        key: `row-${blockage.block_ulid}-${String(runEntries[0].rowUuid)}`,
                        top,
                        height,
                        left,
                        width,
                        isSection: false,
                        rowUuids: runEntries.map(e => e.rowUuid),
                        blockage,
                        title: blockage.title,
                        block_ulid: blockage.block_ulid,
                        full_row: blockage.full_row ?? false,
                    });
                }
            }
        }

        return blocks;
    });

    const sectionBlocks = computed((): ComputedBlock[] => {
        const blocks: ComputedBlock[] = [];

        for (const blockage of sectionBlockages()) {
            const section = timeline.state.sectionsByUuid[blockage.sectionUuid];
            if (!section) continue;

            const labelHeight = timelineConfig.sections.labelHeight;
            const top = section.editorRelativeTop + labelHeight;
            const height = section.editorRelativeBottom - top;
            if (height <= 0) continue;

            const { left, width } = getHorizontal(blockage.start_ms, blockage.end_ms, blockage.full_row);

            blocks.push({
                key: `section-${blockage.block_ulid}-${String(blockage.sectionUuid)}`,
                top,
                height,
                left,
                width,
                isSection: true,
                rowUuids: timeline.state.sectionRowUuids[blockage.sectionUuid] ?? [],
                blockage,
                title: blockage.title,
                block_ulid: blockage.block_ulid,
                full_row: blockage.full_row ?? false,
            });
        }

        return blocks;
    });

    return { rowBlocks, sectionBlocks };
};

export type UseBlockedAreasType = ReturnType<typeof useBlockedAreas>;
