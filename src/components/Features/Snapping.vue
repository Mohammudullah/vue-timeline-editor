<script setup lang="ts">
import { computed, inject, onUnmounted } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useSnapping } from '../../composables/features/snapping';
import { TimelineFrameByUuidInterface } from '../../types/timeline';
import { DraggedFrameDataInterface } from '../../composables/features/draggingEvents';

const emits = defineEmits<{
    'dragStart': [frame: TimelineFrameByUuidInterface, event: PointerEvent],
    'dragEnd': [frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent],
    'dragCancel': [frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent],
    'drop': [frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent],
}>()

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

const snapping = computed(() => features?.data.snapping ?? null);

onUnmounted(() => {
    features?.destroyFeature('snapping');
})

snapping.value?.onDragStart((frame, event) => emits('dragStart', frame, event), 'snappingComponentOnDragStart');
snapping.value?.onDragEnd((frame, frameData, event) => emits('dragEnd', frame, frameData, event), 'snappingComponentOnDragEnd');
snapping.value?.onDragCancel((frame, frameData, event) => emits('dragCancel', frame, frameData, event), 'snappingComponentOnDragCancel');
snapping.value?.onDrop((frame, frameData, event) => emits('drop', frame, frameData, event), 'snappingComponentOnDrop');

</script>

<template>
    {{ features?.data.snapping?.state.draggingPlaceholder }}
</template>