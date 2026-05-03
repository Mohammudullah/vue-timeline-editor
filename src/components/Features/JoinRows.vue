<script setup lang="ts">
import { computed, inject, onUnmounted } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useJoinRows } from '../../composables/features/joinRows';

/**
 * <JoinRows/>
 *
 * Tree-shakeable feature component for the linked-row (joined booking) system.
 * Mount inside <Timeline> alongside <Dnd/>, <Resize/>, etc.
 *
 * When mounted:
 *  - Registers the joinRows feature in the feature registry
 *  - Keeps the group map reactive to timeline data changes
 *  - Exposes `features.data.joinRows` to Dnd and Resize for group sync
 *
 * Usage:
 *   <Timeline>
 *     <Sections :sections="..." />
 *     <Dnd />
 *     <Resize />
 *     <JoinRows />
 *   </Timeline>
 *
 * Frame data must include `linkGroupUuid` for frames that should be linked:
 *   { uuid: 'f1', linkGroupUuid: 'group-a', start_ms: 0, end_ms: 3600000, ... }
 *   { uuid: 'f2', linkGroupUuid: 'group-a', start_ms: 0, end_ms: 3600000, ... }
 */

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if (!timeline || !timelineConfig || !features) {
    console.error('JoinRows: Timeline, TimelineConfig, and Features must be provided.');
} else if (features.data.joinRows) {
    console.error('JoinRows feature is already enabled. Please check if <JoinRows/> is mounted multiple times.');
} else {
    features.initFeature('joinRows', () => useJoinRows({ timeline, timelineConfig, getDnd: () => features.data.dnd, getResize: () => features.data.resize }));
}

onUnmounted(() => {
    features?.destroyFeature('joinRows');
});
</script>

<template>
    <!-- This feature component renders no DOM of its own.
         Visual connector bands between linked frames can be added here
         via a named slot or a future prop once the core is stable. -->
</template>
