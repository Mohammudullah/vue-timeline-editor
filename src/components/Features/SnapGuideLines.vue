<script setup lang="ts">
import { computed, inject, onUnmounted, Teleport } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useSnapGuideLines } from '../../composables/features/snapGuideLines';

withDefaults(defineProps<{
    majorGrid?: boolean,
    minorGrid?: boolean,
}>(), {
    majorGrid: true,
    minorGrid: false,
});

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if(!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if(features.data.snapGuideLines) {
    console.error('SnapGuideLines feature is already enabled. Please check if <SnapGuideLines/> is mounted multiple times.');
} else {
    features.initFeature('snapGuideLines', () => useSnapGuideLines({ timeline, timelineConfig }));
}

const snapGuideLines = computed(() => features?.data.snapGuideLines ?? null);

onUnmounted(() => {
    features?.destroyFeature('snapGuideLines');
});
</script>

<template>
    <!--
        Static major-tick grid lines.
        Rendered into the editor BACKGROUND teleport target so they paint behind
        frames without z-index hacks. Positioned with absolute `left` (px) which
        already includes the editor paddingLeft.
    -->
    <Teleport to="#editorBackgroundTeleports" defer v-if="majorGrid && snapGuideLines">
        <slot
            name="majorGrid"
            :positions="snapGuideLines.state.majorGridPositions"
        >
            <div
                v-for="position in snapGuideLines.state.majorGridPositions"
                :key="`major-${position.ms}`"
                class="vtd__snap-grid-line vtd__snap-grid-line--major"
                :style="{ left: position.left + 'px' }"
            />
        </slot>
    </Teleport>

    <!--
        Static minor-tick grid lines.
        Same teleport target so they paint behind frames. Excludes positions that
        coincide with major ticks (handled in the composable) to avoid overlap.
    -->
    <Teleport to="#editorBackgroundTeleports" defer v-if="minorGrid && snapGuideLines">
        <slot
            name="minorGrid"
            :positions="snapGuideLines.state.minorGridPositions"
        >
            <div
                v-for="position in snapGuideLines.state.minorGridPositions"
                :key="`minor-${position.ms}`"
                class="vtd__snap-grid-line vtd__snap-grid-line--minor"
                :style="{ left: position.left + 'px' }"
            />
        </slot>
    </Teleport>
</template>
