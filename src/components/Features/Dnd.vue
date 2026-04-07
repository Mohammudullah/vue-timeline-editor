<script setup lang="ts">
import { computed, inject, onUnmounted, Teleport } from 'vue';
import { TimelineInterface, UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useDnd, UseDndType } from '../../composables/features/dnd';
import FrameUI from '../Timeline/UI/FrameUI.vue';
import useUtils from '../../composables/utils';
import { UseSnappingInterface } from '../../composables/features/snapping';

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if(!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if(features.data.dnd) {
    console.error('Dnd feature is already enabled. Please check if <Dnd/> is mounted multiple times.');
} else {
    features.initFeature('dnd', () => useDnd({ timeline, timelineConfig, frame: features.data.frame }));
}

const frame = computed(() => features?.data.dnd?.state.draggingFrame.data);
const dnd = computed<UseDndType | null>(() => features?.data.dnd ?? null);
const snapping = computed<UseSnappingInterface | null>(() => features?.data.snapping ?? null);

onUnmounted(() => {
    features?.destroyFeature('dnd');
})

</script>

<template>

    <Teleport to="#editorAreaTeleports" defer>
        <div
            :style="{
                transform: `translateY(${snapping.state.draggingPlaceholder.top}px)`,
                height: dnd.state.container.height + 'px',
                top: 0,
                left: 0,
                position: 'absolute',
            }"
            v-if="frame && dnd && snapping"
            class="vtd__dragging-placeholder"

        >
            <div
                :style="{
                    transform: `translateX(${snapping.state.draggingPlaceholder.left}px)`,
                    height: '100%',
                }"
            >
                <FrameUI
                    :frame="frame"
                    :left="0"
                    :width="dnd.state.container.width"
                    :selected="true"
                />
            </div>
        </div>
    </Teleport>
</template>