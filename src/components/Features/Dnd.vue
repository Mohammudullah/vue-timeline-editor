<script setup lang="ts">
import { inject, onUnmounted } from 'vue';
import { TimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useDnd } from '../../composables/features/dnd';
import Frame from '../Timeline/Section/Frames/Frame.vue';


const timeline = inject<TimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if(!timeline || !timelineConfig || !features) {
    throw new Error('Timeline, TimelineConfig, and Features must be provided');
}

if(features.data.dnd) {
    throw new Error('Dnd feature is already enabled. Please check if <Dnd/> is mounted multiple times.');
}

setTimeout(() => {
    features.initFeature('dnd', useDnd);
}, 1000);

onUnmounted(() => {
    features.destroyFeature('dnd');
})

</script>

<template>

    {{ features.data.dnd }}

    <button
        @click="features.destroyFeature('dnd')"
    >
        {{ features.data.dnd ? 'Disable Dnd' : 'Enable Dnd' }}
    </button>

    <div>
        <!-- <Frame
            :
        /> -->
    </div>
</template>