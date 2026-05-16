import { reactive } from "vue";
import { UseDndType } from "./dnd";
import { UseSnappingInterface } from "./snapping";
import { useFrames, UseFramesType } from "./frames";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseResizeInterface } from "./resize";
import { UseSnapGuideLinesType } from "./snapGuideLines";
import { UseJoinRowsType } from "./joinRows";
import { UsePanScrollType } from "./panScroll";

/**
 * useFeatures
 *
 * Feature registry. Always-on features (`frames`) are created up-front;
 * opt-in features (`dnd`, `snapping`, `resize`, `joinRows`, `snapGuideLines`)
 * are registered when their corresponding `<Feature/>` component mounts.
 */
export const useFeatures = ({
    timeline,
    timelineConfig,
}: {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
}) => {

    // Always-on multi-select container.
    const frames = useFrames({ timeline, timelineConfig });

    const features = reactive<FeaturesInterface>({
        dnd: null,
        snapping: null,
        resize: null,
        snapGuideLines: null,
        joinRows: null,
        panScroll: null,
        frames,
    });

    const initFeature = (
        feature: keyof FeaturesInterface, value: () => InitFeatureType,
    ): void => {
        if (features[feature] !== null) return;

        if (feature === 'dnd') features.dnd = value() as UseDndType;
        else if (feature === 'snapping') features.snapping = value() as UseSnappingInterface;
        else if (feature === 'resize') features.resize = value() as UseResizeInterface;
        else if (feature === 'snapGuideLines') features.snapGuideLines = value() as UseSnapGuideLinesType;
        else if (feature === 'joinRows') features.joinRows = value() as UseJoinRowsType;
        else if (feature === 'panScroll') features.panScroll = value() as UsePanScrollType;
    };

    const destroyFeature = (feature: keyof FeaturesInterface): void => {
        if (features[feature] === null) return;

        if (feature === 'dnd') features.dnd = null;
        else if (feature === 'snapping') features.snapping = null;
        else if (feature === 'resize') features.resize = null;
        else if (feature === 'snapGuideLines') features.snapGuideLines = null;
        else if (feature === 'joinRows') features.joinRows = null;
        else if (feature === 'panScroll') features.panScroll = null;
    };

    return {
        data: features,
        initFeature,
        destroyFeature,
    };
};

export interface FeaturesInterface {
    frames: UseFramesType,
    dnd: UseDndType | null,
    snapping: UseSnappingInterface | null,
    resize: UseResizeInterface | null,
    snapGuideLines: UseSnapGuideLinesType | null,
    joinRows: UseJoinRowsType | null,
    panScroll: UsePanScrollType | null,
}

export type UseFeaturesType = ReturnType<typeof useFeatures>;

export type InitFeatureType = UseDndType | UseSnappingInterface | UseFramesType | UseResizeInterface | UseSnapGuideLinesType | UseJoinRowsType | UsePanScrollType;
