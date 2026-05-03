<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, Teleport } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useSnapGuideLines } from '../../composables/features/snapGuideLines';

withDefaults(defineProps<{
    majorGrid?: boolean,
    minorGrid?: boolean,
    activeSnapGuides?: boolean,
}>(), {
    majorGrid: true,
    minorGrid: false,
    activeSnapGuides: true,
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
const snapping = computed(() => features?.data.snapping ?? null);

const dragSnapGuide = computed(() => {
    return snapping.value?.state.dragSnapGuides[0] ?? null;
})

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
            :sectionRowAreas="snapGuideLines.state.sectionRowAreas"
        >
            <template
                v-for="position in snapGuideLines.state.majorGridPositions"
                :key="`major-${position.ms}`"
            >
                <div
                    v-for="(area, areaIdx) in snapGuideLines.state.sectionRowAreas"
                    :key="`major-${position.ms}-${areaIdx}`"
                    class="vtd__snap-grid-line vtd__snap-grid-line--major"
                    :style="{ left: position.left + 'px', top: area.top + 'px', height: area.height + 'px' }"
                />
            </template>
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
            :sectionRowAreas="snapGuideLines.state.sectionRowAreas"
        >
            <template
                v-for="position in snapGuideLines.state.minorGridPositions"
                :key="`minor-${position.ms}`"
            >
                <div
                    v-for="(area, areaIdx) in snapGuideLines.state.sectionRowAreas"
                    :key="`minor-${position.ms}-${areaIdx}`"
                    class="vtd__snap-grid-line vtd__snap-grid-line--minor"
                    :style="{ left: position.left + 'px', top: area.top + 'px', height: area.height + 'px' }"
                />
            </template>
        </slot>
    </Teleport>

    <!--
        Active snap guide lines.
        Rendered while dragging when the snapping pipeline is engaged on a grid
        tick or an adjacent frame edge. Teleported into the FOREGROUND target so
        the highlighted lines paint above frames.
        Requires <Snapping/> to be mounted; otherwise nothing is shown.
    -->
    <Teleport to="#editorAreaTeleports" defer v-if="activeSnapGuides && snapping">

        <slot
            name="activeSnapGuide"
            :guides="snapping.state.dragSnapGuides"
            :sectionRowAreas="snapGuideLines?.state.sectionRowAreas ?? []"
        >

            <div
                v-for="(area, areaIdx) in (snapGuideLines?.state.sectionRowAreas ?? [])"
                :key="`active-area-${areaIdx}`"
            >
                <div
                    class="vtd__snap-grid-line vtd__snap-grid-line--active"
                    :style="{ 
                        left: (dragSnapGuide?.left ?? timelineConfig?.editor.paddingLeft) + 'px', 
                        top: area.top + 'px', 
                        height: area.height + 'px',
                        opacity: dragSnapGuide ? 1 : 0, 
                    }"
                />
            </div>

            <!-- <template
                v-for="(guide, index) in snapping.state.dragSnapGuides"
                :key="`active-${index}-${guide.ms}`"
            >
                <div
                    v-for="(area, areaIdx) in (snapGuideLines?.state.sectionRowAreas ?? [])"
                    :key="`active-${index}-${guide.ms}-${areaIdx}`"
                    class="vtd__snap-grid-line vtd__snap-grid-line--active"
                    :class="`vtd__snap-grid-line--active-${guide.source}`"
                    :style="{ left: guide.left + 'px', top: area.top + 'px', height: area.height + 'px' }"
                />
            </template> -->
        </slot>
    </Teleport>
</template>
