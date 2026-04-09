<script lang="ts" setup>
import { computed, inject } from 'vue';
import { useFeatures } from '../../composables/features/features';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useResize } from '../../composables/features/resize';


const props = withDefaults(defineProps<{
    
}>(), {
    
})


const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if(!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if(features.data.resize) {
    console.error('Resize feature is already enabled. Please check if <Resize/> is mounted multiple times.');
} else {
    features.initFeature('resize', () => useResize({ timeline, timelineConfig, frame: features.data.frame }));
}

const frame = computed(() => features?.data.frame?.state.selected.frame ?? null);
const resize = computed(() => features?.data.resize ?? null);

</script>

<template>
    <Teleport to="#editorAreaTeleports" defer>
        <div
            :style="{
                height: timelineConfig?.rows.height + 'px',
                top: 0,
                left: 0,
                position: 'absolute',
            }"
            v-if="frame && resize"
            class="vtd__resize-placeholder"

        >
            <FrameUI
                :start-ms="resize.state.resizingPlaceholder.start_ms ?? frame.start_ms"
                :end-ms="resize.state.resizingPlaceholder.end_ms ?? frame.end_ms"
                :title="frame.title"
                :left="0"
                :width="resize.state.resizingPlaceholder.width ?? frame.width"
                :selected="true"
            />
        </div>
    </Teleport>
</template>