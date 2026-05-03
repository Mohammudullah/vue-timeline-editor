import { reactive } from "vue";
import { UseDndType } from "./dnd";
import { UseSnappingInterface } from "./snapping";
import { useFrames, UseFrameInterface } from "./frame";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseResizeInterface } from "./resize";
import { UseSnapGuideLinesType } from "./snapGuideLines";
import { UseJoinRowsType } from "./joinRows";
import { useSelectedFrames, UseSelectedFramesType } from "./selectedFrames";

export const useFeatures = ({
    timeline,
    timelineConfig,
}: {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
}) => {

    //init default and required features here,
    const frame = useFrames({
        timeline,
        timelineConfig,
    });

    // Phase 1: create the reactive features object.
    // selectedFrames is set in phase 2 so the getJoinRows getter closure is safe.
    const features = reactive<FeaturesInterface>({
        dnd: null,
        snapping: null,
        resize: null,
        snapGuideLines: null,
        joinRows: null,
        frame,
        selectedFrames: null as unknown as UseSelectedFramesType,
    });

    // Phase 2: initialize selectedFrames now that `features` exists.
    features.selectedFrames = useSelectedFrames({
        frame,
        getJoinRows: () => features.joinRows,
    });

    const initFeature = (
        feature: keyof FeaturesInterface, value: () => InitFeatureType
    ) : void => {
        
        if(features[feature] !== null) {
            return;
        }

        if(feature === 'dnd') {
            features.dnd = value() as UseDndType;
        } else if(feature === 'snapping') {
            features.snapping = value() as UseSnappingInterface;
        } else if(feature === 'resize') {
            features.resize = value() as UseResizeInterface;
        } else if(feature === 'snapGuideLines') {
            features.snapGuideLines = value() as UseSnapGuideLinesType;
        } else if(feature === 'joinRows') {
            features.joinRows = value() as UseJoinRowsType;
        }
    }

    const destroyFeature = (feature: keyof FeaturesInterface) : void => {
        if(features[feature] === null) {
            return;
        }
     
        if(feature === 'dnd') {
            features.dnd = null;
        } else if(feature === 'snapping') {
            features.snapping = null;
        } else if(feature === 'resize') {
            features.resize = null;
        } else if(feature === 'snapGuideLines') {
            features.snapGuideLines = null;
        } else if(feature === 'joinRows') {
            features.joinRows = null;
        }
    }

    return {
        data: features,
        initFeature,
        destroyFeature
    };
};

export interface FeaturesInterface {
    frame: UseFrameInterface,
    selectedFrames: UseSelectedFramesType,
    dnd: UseDndType | null,
    snapping: UseSnappingInterface | null,
    resize: UseResizeInterface | null,
    snapGuideLines: UseSnapGuideLinesType | null,
    joinRows: UseJoinRowsType | null,
}

export type UseFeaturesType = ReturnType<typeof useFeatures>;

export type InitFeatureType = UseDndType | UseSnappingInterface | UseFrameInterface | UseResizeInterface | UseSnapGuideLinesType | UseJoinRowsType;