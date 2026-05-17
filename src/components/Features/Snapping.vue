<script setup lang="ts">
import { computed, inject, onUnmounted } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useSnapping } from '../../composables/features/snapping';
import { TimelineFrameByUuidInterface } from '../../types/timeline';
import { DraggedFrameDataInterface } from '../../composables/features/draggingEvents';

// Pipeline step toggles. Each defaults to true; pass `false` to remove that
// step from the active pipeline at runtime (e.g. `:overlapping="false"` to
// allow user-overlapping frames). The composable re-reads these reactively
// so flips take effect on the next tick without re-mounting <Snapping/>.
const props = withDefaults(defineProps<{
    rows?: boolean,
    frames?: boolean,
    times?: boolean,
    guides?: boolean,
    overlapping?: boolean,
}>(), {
    rows: true,
    frames: true,
    times: true,
    guides: true,
    overlapping: true,
});

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

const pipelines = computed(() => ({
    rows: props.rows,
    frames: props.frames,
    times: props.times,
    guides: props.guides,
    overlapping: props.overlapping,
}));

if(!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if(features.data.snapping) {
    console.error('Snapping feature is already enabled. Please check if <Snapping/> is mounted multiple times.');
} else {
    features.initFeature('snapping', () => useSnapping({ timeline, timelineConfig, frames: features.data.frames, dnd, resize, pipelines }));
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