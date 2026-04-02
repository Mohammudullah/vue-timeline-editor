import { reactive } from "vue";
import { UseDndType } from "./dnd";
import { SnappingInterface } from "./snapping";

export const useFeatures = () => {

    const features = reactive<FeaturesInterface>({
        dnd: null as UseDndType | null,
        snapping: null as SnappingInterface | null
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
            features.snapping = value() as SnappingInterface;
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
        }
    }

    return {
        data: features,
        initFeature,
        destroyFeature
    };
};

export interface FeaturesInterface {
    dnd: UseDndType | null,
    snapping: SnappingInterface | null
}

export type UseFeaturesType = ReturnType<typeof useFeatures>;

export type InitFeatureType = UseDndType | SnappingInterface;