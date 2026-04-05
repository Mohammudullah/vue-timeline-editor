<script setup lang="ts">
import { computed, inject, onUnmounted } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useSnapping } from '../../composables/features/snapping';


const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

const dnd = computed(() => features?.data.dnd ?? null);

if(!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if(features.data.snapping) {
    console.error('Snapping feature is already enabled. Please check if <Snapping/> is mounted multiple times.');
} else {
    features.initFeature('snapping', () => useSnapping({ timeline, timelineConfig, dnd }));
}

onUnmounted(() => {
    features?.destroyFeature('snapping');
})

</script>

<template>
    {{ features?.data.snapping?.state.draggingPlaceholder }}
</template>