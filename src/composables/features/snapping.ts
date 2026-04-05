import { computed, reactive, Ref, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseFeaturesType } from "./features";
import { UseDndType } from "./dnd";

export const useSnapping = ({
    timeline,
    timelineConfig,
    dnd,
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    dnd: Ref<UseDndType | null>,
}) => {

    const dragging = computed(() => dnd.value?.state.dragging || false);


    const state = reactive<SnappingStateInterface>({
        draggingPlaceholder: {
            left: 0, 
            top: 0,
        }

    });


    const snapRows = (pointerRelativeY: number) => {
        const pointerOverRow = dnd.value?.state.pointer.over.rowUuid ?? null;

        if(!pointerOverRow) {
            return {
                top: pointerRelativeY,
                bottom: pointerRelativeY,
            }
        }

        const row = timeline.state.sectionRowsByUuid[pointerOverRow];

        return {
            top: row ? row.editorRelativeTop : pointerRelativeY,
            bottom: row ? row.editorRelativeBottom : pointerRelativeY,
        }
    }


    const snapFrames = () => {

    }


    const snapEdges = () => {

    }


    const snapGuides = () => {

    }


    const snapTimes = () => {

    }


    const pipeline = [
        snapRows,
        snapFrames,
        snapEdges,
        snapGuides,
        snapTimes,
    ]


    const snapPipeline = () => {
        if(!dnd.value || !dnd.value.state.dragging) return;

        const pointerRelativeY = dnd.value.state.pointer.editorRelativeY;
        
        const snapPosition = {
            top: 0,
            left: 0,
        }

        pipeline.forEach((snapFunction) => {
            const snapResult = snapFunction(pointerRelativeY);
            
            snapPosition.top = Math.max(snapPosition.top, snapResult?.top ?? 0);
            
        });

        state.draggingPlaceholder.top = snapPosition.top;
        state.draggingPlaceholder.left = dnd.value.state.draggingPlaceholder.left;
    }

    watch([() => dnd.value?.state.pointer], snapPipeline, { deep: true });

    return {
        state
    }
    
}

export type UseSnappingInterface = ReturnType<typeof useSnapping>;

export interface SnappingStateInterface {
    draggingPlaceholder: {
        left: number,
        top: number,
    }
}