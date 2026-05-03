import { reactive, watchEffect } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";

export const useSnapGuideLines = ({
    timeline,
    timelineConfig,
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
}) => {

    // Each position is a tick in ms (relative to range start) plus its absolute
    // pixel offset inside the editor area (already includes paddingLeft so consumers
    // can position elements with `left: <px>` directly).
    const state = reactive<SnapGuideLinesStateInterface>({
        majorGridPositions: [],
        minorGridPositions: [],
        // One { top, height } segment per section — covers only the row area,
        // skipping each section's label bar so grid lines stay invisible there.
        sectionRowAreas: [],
    });

    watchEffect(() => {
        const majorInterval = timelineConfig.cols.majorGridInterval;
        const minorInterval = timelineConfig.cols.minorGridInterval;
        const endMs = (timelineConfig.range.end_seconds ?? 0) * 1000;
        const pixelPerMs = timelineConfig.cols.pixelPerMs;
        const paddingLeft = timelineConfig.editor.paddingLeft;
        const labelHeight = timelineConfig.sections.labelHeight;

        state.sectionRowAreas = timeline.state.sectionUuids
            .map(uuid => {
                const section = timeline.state.sectionsByUuid[uuid];
                if (!section) return null;
                const top = section.editorRelativeTop + labelHeight;
                const height = section.editorRelativeBottom - top;
                return { top, height };
            })
            .filter((a): a is { top: number, height: number } => a !== null && a.height > 0);

        const majorPositions: { ms: number, left: number }[] = [];
        const minorPositions: { ms: number, left: number }[] = [];

        if (endMs <= 0 || pixelPerMs <= 0) {
            state.majorGridPositions = majorPositions;
            state.minorGridPositions = minorPositions;
            return;
        }

        if (majorInterval > 0) {
            for (let ms = 0; ms < endMs; ms += majorInterval) {
                majorPositions.push({
                    ms,
                    left: ms * pixelPerMs + paddingLeft,
                });
            }
        }

        // Minor positions exclude any position that coincides with a major tick,
        // so a consumer can render both layers without overlap.
        if (minorInterval > 0 && minorInterval < majorInterval) {
            for (let ms = 0; ms < endMs; ms += minorInterval) {
                if (majorInterval > 0 && ms % majorInterval === 0) continue;

                minorPositions.push({
                    ms,
                    left: ms * pixelPerMs + paddingLeft,
                });
            }
        }

        state.majorGridPositions = majorPositions;
        state.minorGridPositions = minorPositions;
    });

    return {
        state,
    };
}

export type UseSnapGuideLinesType = ReturnType<typeof useSnapGuideLines>;

export interface SnapGuideLinesStateInterface {
    majorGridPositions: { ms: number, left: number }[],
    minorGridPositions: { ms: number, left: number }[],
    sectionRowAreas: { top: number, height: number }[],
}
