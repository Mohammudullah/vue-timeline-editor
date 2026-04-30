import { reactive } from "vue";
import { UseDndType } from "./dnd";
import { UseSnappingInterface } from "./snapping";
import { useFrames, UseFrameInterface } from "./frame";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseResizeInterface } from "./resize";
import { UseSnapGuideLinesType } from "./snapGuideLines";

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

    const features = reactive<FeaturesInterface>({
        dnd: null,
        snapping: null,
        resize: null,
        snapGuideLines: null,
        frame,
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
    dnd: UseDndType | null,
    snapping: UseSnappingInterface | null,
    resize: UseResizeInterface | null,
    snapGuideLines: UseSnapGuideLinesType | null,
}

export type UseFeaturesType = ReturnType<typeof useFeatures>;

export type InitFeatureType = UseDndType | UseSnappingInterface | UseFrameInterface | UseResizeInterface | UseSnapGuideLinesType;