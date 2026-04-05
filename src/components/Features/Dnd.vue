<script setup lang="ts">
import { computed, inject, onUnmounted } from 'vue';
import { TimelineInterface, UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useDnd, UseDndType } from '../../composables/features/dnd';
import FrameUI from '../Timeline/UI/FrameUI.vue';
import useUtils from '../../composables/utils';


const { calculateFrameWidth } = useUtils();

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if(!timeline || !timelineConfig || !features) {
    throw new Error('Timeline, TimelineConfig, and Features must be provided');
}

if(features.data.dnd) {
    throw new Error('Dnd feature is already enabled. Please check if <Dnd/> is mounted multiple times.');
}

features.initFeature('dnd', () => useDnd({ timeline, timelineConfig, frame: features.data.frame }));

const frame = computed(() => features.data.dnd?.state.draggingFrame);
const dnd = computed<UseDndType | null>(() => features.data.dnd ?? null);

onUnmounted(() => {
    features.destroyFeature('dnd');
})

</script>

<template>

    <div
        :style="{
            left: `${dnd.state.draggingPlaceholder.left}px`,
            top: `${dnd.state.draggingPlaceholder.top}px`,
            height: dnd.state.container.height + 'px',
            position: 'fixed',
        }"
        v-if="frame && dnd"

    >
        <FrameUI
            :frame="frame"
            :left="0"
            :width="dnd.state.container.width"
            :selected="true"
        />
    </div>
</template>