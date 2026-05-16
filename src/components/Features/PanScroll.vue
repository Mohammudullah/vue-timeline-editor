<script setup lang="ts">
import { inject, onUnmounted } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { usePanScroll } from '../../composables/features/panScroll';

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if (!timeline || !timelineConfig || !features) {
    console.error('PanScroll: Timeline, TimelineConfig, and Features must be provided.');
} else if (features.data.panScroll) {
    console.error('PanScroll feature is already enabled. Please check if <PanScroll/> is mounted multiple times.');
} else {
    features.initFeature('panScroll', () =>
        usePanScroll({ timeline, timelineConfig, frames: features.data.frames }),
    );
}

onUnmounted(() => {
    features?.destroyFeature('panScroll');
});
</script>

<template>
    <!-- Headless feature: no DOM. -->
</template>
