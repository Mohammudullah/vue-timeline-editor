<script lang="ts" setup>
import { computed, inject, onUnmounted, Slots, watch } from 'vue';
import { useFeatures } from '../../composables/features/features';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useResize } from '../../composables/features/resize';
import { TimelineFrameByUuidInterface } from '../../types/timeline';
import { BlockedReason, ResizedFrameDataInterface } from '../../composables/features/draggingEvents';
import FrameUI from '../Timeline/UI/FrameUI.vue';

// Same forwarding pattern as <Dnd>: the resize ghost needs to honour the
// user's #frame template from <Timeline>.
const timelineSlots = inject<Slots>('timelineSlots');
const UserFrame = (props: Record<string, unknown>) =>
    timelineSlots?.frame?.(props) ?? null;

const emits = defineEmits<{
    'resizeStart':   [frames: TimelineFrameByUuidInterface[], event: PointerEvent],
    'resizeEnd':     [frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent],
    'resized':       [frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent],
    'resizeCancel':  [frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent],
    // Fires when a resize attempt was rejected (another frame is processing
    // / explicitly locked / etc). Consumers can show a toast or error.
    'resizeBlocked': [reason: BlockedReason, frames: TimelineFrameByUuidInterface[], event: PointerEvent],
}>();

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if (!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if (features.data.resize) {
    console.error('Resize feature is already enabled. Please check if <Resize/> is mounted multiple times.');
} else {
    features.initFeature('resize', () =>
        useResize({ timeline, timelineConfig, frames: features.data.frames }),
    );
}

const resize = computed(() => features?.data.resize ?? null);
const activeHandler = computed(() => features?.data.snapping || features?.data.resize || null);

const handleResizeStart = (frames: TimelineFrameByUuidInterface[], event: PointerEvent) => {
    emits('resizeStart', frames, event);
    console.log('Resize started:', frames);
};
const handleResizeEnd = (frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent) => {
    emits('resizeEnd', frames, frameData, event);
    console.log('Resize ended:', frames, frameData);
};
const handleResizeCancel = (frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent) => {
    emits('resizeCancel', frames, frameData, event);
    console.log('Resize cancelled:', frames, frameData);
};
const handleResizeBlocked = (reason: BlockedReason, frames: TimelineFrameByUuidInterface[], event: PointerEvent) => {
    emits('resizeBlocked', reason, frames, event);
    console.log('Resize blocked:', reason, frames);
};
const handleResized = (frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent) => {
    // Persist FIRST, then emit. See Dnd.vue's handleOnDrop for the rationale —
    // synchronous `revert()` calls in the consumer's @resized handler need the
    // frame to already be at its `current` position.
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
            meta: original.meta,
        });
    });

    emits('resized', frames, frameData, event);
    console.log('Resized:', frames, frameData);
};

watch(activeHandler, (newHandler, oldHandler) => {
    oldHandler?.removeEvent('resizeStart', 'activeHandlerOnResizeStart');
    oldHandler?.removeEvent('resizeEnd', 'activeHandlerOnResizeEnd');
    oldHandler?.removeEvent('resizeCancel', 'activeHandlerOnResizeCancel');
    oldHandler?.removeEvent('resized', 'activeHandlerOnResized');
    oldHandler?.removeEvent('resizeBlocked', 'activeHandlerOnResizeBlocked');

    newHandler?.onResizeStart(handleResizeStart, 'activeHandlerOnResizeStart');
    newHandler?.onResizeEnd(handleResizeEnd, 'activeHandlerOnResizeEnd');
    newHandler?.onResized(handleResized, 'activeHandlerOnResized');
    newHandler?.onResizeCancel(handleResizeCancel, 'activeHandlerOnResizeCancel');
    newHandler?.onResizeBlocked?.(handleResizeBlocked, 'activeHandlerOnResizeBlocked');
}, { immediate: true });

onUnmounted(() => {
    features?.destroyFeature('resize');
});

// Visual link flags for resize ghost entries — delegated to JoinRows.
const ghostLinkFlags = (uuid: string | number) => {
    const jr = features?.data.joinRows;
    if (!jr) return { linkedAbove: false, linkedBelow: false };
    const map = activeHandler.value?.state.resizingPlaceholders ?? {};
    return jr.getGhostLinkFlags(uuid, map);
};
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
                :uuid="entry.uuid"
                :start-ms="entry.start_ms"
                :end-ms="entry.end_ms"
                :title="timeline?.state.sectionFramesByUuid[entry.uuid]?.title ?? null"
                :meta="timeline?.state.sectionFramesByUuid[entry.uuid]?.meta"
                :left="0"
                :width="entry.width"
                :selected="true"
                :linked-above="ghostLinkFlags(entry.uuid).linkedAbove"
                :linked-below="ghostLinkFlags(entry.uuid).linkedBelow"
                show-resize-handle
            >
                <template v-if="timelineSlots?.frame" #frame="slotProps">
                    <UserFrame v-bind="slotProps" />
                </template>
            </FrameUI>
        </div>
    </Teleport>
</template>
