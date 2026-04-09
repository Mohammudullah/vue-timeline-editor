<script lang="ts" setup>
import { computed, inject, onUnmounted, watch } from 'vue';
import { useFeatures } from '../../composables/features/features';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useResize } from '../../composables/features/resize';
import { TimelineFrameByUuidInterface } from '../../types/timeline';
import { ResizedFrameDataInterface } from '../../composables/features/draggingEvents';
import FrameUI from '../Timeline/UI/FrameUI.vue';


const props = withDefaults(defineProps<{
    
}>(), {
    
})

const emits = defineEmits<{
    'resizeStart': [frame: TimelineFrameByUuidInterface, event: PointerEvent],
    'resizeEnd': [frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent],
    'resized': [frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent],
    'resizeCancel': [frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent],
}>()


const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if(!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if(features.data.resize) {
    console.error('Resize feature is already enabled. Please check if <Resize/> is mounted multiple times.');
} else {
    features.initFeature('resize', () => useResize({ timeline, timelineConfig, frame: features.data.frame }));
}

const frame = computed(() => features?.data.frame?.state.selected.frame ?? null);
const resize = computed(() => features?.data.resize ?? null);

const activeHandler = computed(() => features?.data.snapping || null);

const handleResizeStart = (frame: TimelineFrameByUuidInterface, event: PointerEvent) => {
    emits('resizeStart', frame, event);
};

const handleResizeEnd = (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => {
    emits('resizeEnd', frame, frameData, event);
};

const handleResized = (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => {
    emits('resized', frame, frameData, event);

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

const handleResizeCancel = (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => {
    emits('resizeCancel', frame, frameData, event);
};


watch(activeHandler, (newHandler, oldHandler) => {

    oldHandler?.removeEvent('resizeStart', 'activeHandlerOnResizeStart');
    oldHandler?.removeEvent('resizeEnd', 'activeHandlerOnResizeEnd');
    oldHandler?.removeEvent('resizeCancel', 'activeHandlerOnResizeCancel');
    oldHandler?.removeEvent('resized', 'activeHandlerOnResized');

    newHandler?.onResizeStart(handleResizeStart, 'activeHandlerOnResizeStart');
    newHandler?.onResizeEnd(handleResizeEnd, 'activeHandlerOnResizeEnd');
    newHandler?.onResized(handleResized, 'activeHandlerOnResized');
    newHandler?.onResizeCancel(handleResizeCancel, 'activeHandlerOnResizeCancel');
}, { immediate: true })

onUnmounted(() => {
    features?.destroyFeature('resize');
})

</script>

<template>
    <Teleport to="#editorAreaTeleports" defer>
        <div
            :style="{
                height: timelineConfig?.rows.height + 'px',
                top: activeHandler.state.resizingPlaceholder.top + 'px',
                left: activeHandler.state.resizingPlaceholder.left + 'px',
                position: 'absolute',
                cursor: 'ew-resize',
            }"
            v-if="frame && resize && activeHandler && resize.state.resizing"
            class="vtd__resize-placeholder"

        >
            <FrameUI
                :start-ms="activeHandler.state.resizingPlaceholder.start_ms ?? frame.start_ms"
                :end-ms="activeHandler.state.resizingPlaceholder.end_ms ?? frame.end_ms"
                :title="frame.title"
                :left="0"
                :width="activeHandler.state.resizingPlaceholder.width ?? frame.width"
                :selected="true"
            />
        </div>
    </Teleport>

    <pre>
        {{ resize?.state.resizingPlaceholder }}
    </pre>
</template>