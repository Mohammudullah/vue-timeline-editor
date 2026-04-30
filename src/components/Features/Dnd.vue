<script setup lang="ts">
import { computed, inject, onUnmounted, Teleport } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useDnd, UseDndType } from '../../composables/features/dnd';
import FrameUI from '../Timeline/UI/FrameUI.vue';
import { TimelineFrameByUuidInterface } from '../../types/timeline';
import { DraggedFrameDataInterface } from '../../composables/features/draggingEvents';
import { watch } from 'vue';

const props = withDefaults(defineProps<{
    edgeSnap?: boolean,
}>(), {
    edgeSnap: true,
});

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
    features.initFeature('dnd', () => useDnd({ timeline, timelineConfig, frame: features.data.frame, edgeSnap: props.edgeSnap }));
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


watch(activeHandler, (newHandler, oldHandler) => {

    oldHandler?.removeEvent('dragStart', 'activeHandlerOnDragStart');
    oldHandler?.removeEvent('dragEnd', 'activeHandlerOnDragEnd');
    oldHandler?.removeEvent('dragCancel', 'activeHandlerOnDragCancel');
    oldHandler?.removeEvent('drop', 'activeHandlerOnDrop');

    newHandler?.onDragStart(handleOnDragStart, 'activeHandlerOnDragStart');
    newHandler?.onDragEnd(handleOnDragEnd, 'activeHandlerOnDragEnd');
    newHandler?.onDragCancel(handleOnDragCancel, 'activeHandlerOnDragCancel');
    newHandler?.onDrop(handleOnDrop, 'activeHandlerOnDrop');
})

onUnmounted(() => {
    features?.destroyFeature('dnd');
})

</script>

<template>

    <!--
        Freeform ghost preview.
        Follows the raw pointer position via dnd.state.draggingPlaceholder; no
        snapping is applied here so the user feels full control while dragging.
    -->
    <Teleport to="#editorAreaTeleports" defer>
        <div
            :style="{
                transform: `translateY(${dnd.state.draggingPlaceholder.top}px)`,
                height: dnd.state.container.height + 'px',
                top: 0,
                left: 0,
                position: 'absolute',
                zIndex: 1
            }"
            v-if="frame && dnd"
            class="vtd__dragging-placeholder"

        >
            <div
                :style="{
                    transform: `translateX(${dnd.state.draggingPlaceholder.left}px)`,
                    height: '100%',
                }"
            >
                <FrameUI
                    :start-ms="dnd.state.draggingPlaceholder.start_ms ?? frame.start_ms"
                    :end-ms="dnd.state.draggingPlaceholder.end_ms ?? frame.end_ms"
                    :title="frame.title"
                    :left="0"
                    :width="dnd.state.container.width"
                    :selected="true"
                />
            </div>
        </div>

        <!--
            Drop-target highlighter.
            Visualizes where the dragged frame will land (suggestion area).
            Exposed as a named slot so consumers can fully replace it.
            For now positioned from activeHandler.state.draggingPlaceholder; will be
            rewired to a dedicated suggestion state in a later step.
        -->
        <div
            v-if="frame && dnd && activeHandler"
            class="vtd__drag-highlighter"
            :style="{
                transform: `translate(${activeHandler.state.draggingPlaceholder.left}px, ${activeHandler.state.draggingPlaceholder.top}px)`,
                width: dnd.state.container.width + 'px',
                height: dnd.state.container.height + 'px',
                top: 0,
                left: 0,
                position: 'absolute',
                pointerEvents: 'none',
            }"
        >
            <slot
                name="highlighter"
                :top="activeHandler.state.draggingPlaceholder.top"
                :left="activeHandler.state.draggingPlaceholder.left"
                :width="dnd.state.container.width"
                :height="dnd.state.container.height"
                :start-ms="activeHandler.state.draggingPlaceholder.start_ms"
                :end-ms="activeHandler.state.draggingPlaceholder.end_ms"
            >
                <div class="vtd__drag-highlighter__default" />
            </slot>
        </div>
    </Teleport>

    
</template>