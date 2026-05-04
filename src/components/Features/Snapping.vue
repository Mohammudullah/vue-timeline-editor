<script setup lang="ts">
import { computed, inject, onUnmounted } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useSnapping } from '../../composables/features/snapping';
import { TimelineFrameByUuidInterface } from '../../types/timeline';
import { DraggedFrameDataInterface } from '../../composables/features/draggingEvents';

const emits = defineEmits<{
    'dragStart':  [frames: TimelineFrameByUuidInterface[], event: PointerEvent],
    'dragEnd':    [frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent],
    'dragCancel': [frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent],
    'drop':       [frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent],
}>()

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

const dnd = computed(() => features?.data.dnd ?? null);
const resize = computed(() => features?.data.resize ?? null);

if(!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if(features.data.snapping) {
    console.error('Snapping feature is already enabled. Please check if <Snapping/> is mounted multiple times.');
} else {
    features.initFeature('snapping', () => useSnapping({ timeline, timelineConfig, frames: features.data.frames, dnd, resize }));
}

const snapping = computed(() => features?.data.snapping ?? null);

onUnmounted(() => {
    features?.destroyFeature('snapping');
})

snapping.value?.onDragStart((frames, event) => emits('dragStart', frames, event), 'snappingComponentOnDragStart');
snapping.value?.onDragEnd((frames, frameData, event) => emits('dragEnd', frames, frameData, event), 'snappingComponentOnDragEnd');
snapping.value?.onDragCancel((frames, frameData, event) => emits('dragCancel', frames, frameData, event), 'snappingComponentOnDragCancel');
snapping.value?.onDrop((frames, frameData, event) => emits('drop', frames, frameData, event), 'snappingComponentOnDrop');

</script>

<template>
    
</template>