<script lang="ts" setup>
import { computed, inject, onUnmounted, watch } from 'vue';
import { useFeatures } from '../../composables/features/features';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useResize } from '../../composables/features/resize';
import { DraggingPlaceholderInterface } from '../../composables/features/dnd';
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

const activeHandler = computed(() => features?.data.snapping || features?.data.resize || null);

// Sorted resize ghost entries by vertical position — mirrors the same logic in Dnd.vue.
const sortedResizeEntries = computed(() => {
    return Object.values(activeHandler.value?.state.resizingPlaceholders ?? {}).sort((a, b) => a.top - b.top);
});

const getResizeGhostLinkFlags = (entry: DraggingPlaceholderInterface) => {
    const rowHeight = timelineConfig?.rows.height ?? 0;
    const myGroup = timeline?.state.sectionFramesByUuid[entry.uuid]?.linkGroupUuid;
    if (!myGroup) return { linkedAbove: false, linkedBelow: false };
    const sorted = sortedResizeEntries.value;
    const idx = sorted.findIndex(e => e.uuid === entry.uuid);
    const linkedAbove = idx > 0
        && Math.abs(sorted[idx - 1].top - entry.top) <= rowHeight
        && timeline?.state.sectionFramesByUuid[sorted[idx - 1].uuid]?.linkGroupUuid === myGroup;
    const linkedBelow = idx >= 0 && idx < sorted.length - 1
        && Math.abs(sorted[idx + 1].top - entry.top) <= rowHeight
        && timeline?.state.sectionFramesByUuid[sorted[idx + 1].uuid]?.linkGroupUuid === myGroup;
    return { linkedAbove: !!linkedAbove, linkedBelow: !!linkedBelow };
};

const handleResizeStart = (frame: TimelineFrameByUuidInterface, event: PointerEvent) => {
    emits('resizeStart', frame, event);
};

const handleResizeEnd = (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => {
    emits('resizeEnd', frame, frameData, event);
};

const handleResized = (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => {
    emits('resized', frame, frameData, event);

    // frameData.current is an array — one entry per frame in the group (or just
    // the primary for a non-grouped resize). Update every frame.
    frameData.current.forEach(item => {
        const original = timeline?.state.sectionFramesByUuid[item.uuid];
        if (!original) return;
        timeline?.updateFrame(item.uuid, {
            uuid: item.uuid,
            title: original.title,
            start_ms: item.start_ms,
            end_ms: item.end_ms,
            rowUuid: item.rowUuid ?? original.rowUuid,
            sectionUuid: item.sectionUuid ?? original.sectionUuid,
            linkGroupUuid: original.linkGroupUuid,
        });
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
            v-for="entry in Object.values(activeHandler?.state.resizingPlaceholders ?? {})"
            :key="'resize-' + entry.uuid"
            class="vtd__resize-placeholder"
            :style="{
                height: timelineConfig?.rows.height + 'px',
                top: entry.top + 'px',
                left: entry.left + 'px',
                position: 'absolute',
                cursor: 'ew-resize',
            }"
        >
            <FrameUI
                :start-ms="entry.start_ms"
                :end-ms="entry.end_ms"
                :title="timeline?.state.sectionFramesByUuid[entry.uuid]?.title ?? frame?.title ?? null"
                :left="0"
                :width="entry.width"
                :selected="true"
                :linked-above="getResizeGhostLinkFlags(entry).linkedAbove"
                :linked-below="getResizeGhostLinkFlags(entry).linkedBelow"
                show-resize-handle
            />
        </div>
    </Teleport>
</template>