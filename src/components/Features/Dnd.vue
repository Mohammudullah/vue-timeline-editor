<script setup lang="ts">
import { computed, inject, onUnmounted, Teleport } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useDnd, UseDndType } from '../../composables/features/dnd';
import FrameUI from '../Timeline/UI/FrameUI.vue';
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

if(!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if(features.data.dnd) {
    console.error('Dnd feature is already enabled. Please check if <Dnd/> is mounted multiple times.');
} else {
    features.initFeature('dnd', () => useDnd({ timeline, timelineConfig, frame: features.data.frame }));
}

const frame = computed(() => features?.data.dnd?.state.draggingFrame.data);

const dnd = computed<UseDndType | null>(() => features?.data.dnd ?? null);
const activeHandler = computed(() => features?.data.snapping || features?.data.dnd || null);


const handleOnDragStart = (frame: TimelineFrameByUuidInterface, event: PointerEvent) => {
    emits('dragStart', frame, event);
};

const handleOnDragEnd = (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => {
    emits('dragEnd', frame, frameData, event);
};

const handleOnDragCancel = (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => {
    emits('dragCancel', frame, frameData, event);
};

const handleOnDrop = (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => {
    emits('drop', frame, frameData, event);

    console.log('dropped frame', frame, frameData);

    //update frame position on drop
    timeline?.updateFrame(frame.uuid, {
        start_ms: frameData.current.start_ms,
        end_ms: frameData.current.end_ms,
        uuid: frame.uuid,
        title: frame.title,
        rowUuid: frameData.current.rowUuid ?? frame.rowUuid,
        sectionUuid: frameData.current.sectionUuid ?? frame.sectionUuid,
    });
};


activeHandler.value?.onDragStart(handleOnDragStart);
activeHandler.value?.onDragEnd(handleOnDragEnd);
activeHandler.value?.onDragCancel(handleOnDragCancel);
activeHandler.value?.onDrop(handleOnDrop);

onUnmounted(() => {
    features?.destroyFeature('dnd');
})

</script>

<template>

    <Teleport to="#editorAreaTeleports" defer>
        <div
            :style="{
                transform: `translateY(${activeHandler.state.draggingPlaceholder.top}px)`,
                height: dnd.state.container.height + 'px',
                top: 0,
                left: 0,
                position: 'absolute',
            }"
            v-if="frame && dnd && activeHandler"
            class="vtd__dragging-placeholder"

        >
            <div
                :style="{
                    transform: `translateX(${activeHandler.state.draggingPlaceholder.left}px)`,
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