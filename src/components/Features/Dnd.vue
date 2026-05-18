<script lang="ts" setup>
import { computed, inject, onUnmounted, Slots, watch } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useDnd, UseDndType } from '../../composables/features/dnd';
import FrameUI from '../Timeline/UI/FrameUI.vue';
import { TimelineFrameByUuidInterface } from '../../types/timeline';
import { BlockedReason, DraggedFrameDataInterface } from '../../composables/features/draggingEvents';

// Slots provided by <Timeline>. Used so the drag ghost honours the same
// #frame template the user defined at the Timeline root — without forcing
// them to repeat the template inside <Dnd>.
const timelineSlots = inject<Slots>('timelineSlots');

// Functional component that delegates to the injected `frame` slot. When the
// user didn't pass #frame, this returns null and we omit the slot template
// entirely (FrameUI's default title+time fallback fires instead).
const UserFrame = (props: Record<string, unknown>) =>
    timelineSlots?.frame?.(props) ?? null;

const props = withDefaults(defineProps<{
    edgeSnap?: boolean,
}>(), {
    edgeSnap: true,
});

const emits = defineEmits<{
    'dragStart':   [frames: TimelineFrameByUuidInterface[], event: PointerEvent],
    'dragEnd':     [frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent],
    'dragCancel':  [frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent],
    'drop':        [frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent],
    // Fires when a drag attempt was rejected (another frame is processing /
    // explicitly locked / etc). Consumers can show a toast or error message.
    'dragBlocked': [reason: BlockedReason, frames: TimelineFrameByUuidInterface[], event: PointerEvent],
}>();

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if (!timeline || !timelineConfig || !features) {
    console.error('Timeline, TimelineConfig, and Features must be provided');
} else if (features.data.dnd) {
    console.error('Dnd feature is already enabled. Please check if <Dnd/> is mounted multiple times.');
} else {
    features.initFeature('dnd', () =>
        useDnd({ timeline, timelineConfig, frames: features.data.frames, edgeSnap: props.edgeSnap }),
    );
}

const dnd = computed<UseDndType | null>(() => features?.data.dnd ?? null);
const activeHandler = computed(() => features?.data.snapping || features?.data.dnd || null);

const handleOnDragStart = (frames: TimelineFrameByUuidInterface[], event: PointerEvent) => {
    emits('dragStart', frames, event);
    console.log('Drag started:', frames);
};
const handleOnDragEnd = (frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent) => {
    emits('dragEnd', frames, frameData, event);
    console.log('Drag ended:', frames, frameData);
};
const handleOnDragCancel = (frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent) => {
    emits('dragCancel', frames, frameData, event);
    console.log('Drag cancelled:', frames, frameData);
};
const handleOnDragBlocked = (reason: BlockedReason, frames: TimelineFrameByUuidInterface[], event: PointerEvent) => {
    emits('dragBlocked', reason, frames, event);
    console.log('Drag blocked:', reason, frames);
};
const handleOnDrop = (_frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent) => {
    // Persist FIRST, then emit. Vue emits are synchronous, so a @drop handler
    // that calls `frameData.revert()` synchronously needs the frame to already
    // be at its `current` position — otherwise revert would write `initial`
    // values that are the same as what's already there, and the subsequent
    // updateFrame would still move the frame to `current` (no visible revert).
    // `frameData.current` carries one entry per dragged frame (primary first);
    // persist every entry so all selected frames move together.
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

    emits('drop', _frames, frameData, event);
    console.log('Dropped:', _frames, frameData);
};

watch(activeHandler, (newHandler, oldHandler) => {
    oldHandler?.removeEvent('dragStart', 'activeHandlerOnDragStart');
    oldHandler?.removeEvent('dragEnd', 'activeHandlerOnDragEnd');
    oldHandler?.removeEvent('dragCancel', 'activeHandlerOnDragCancel');
    oldHandler?.removeEvent('drop', 'activeHandlerOnDrop');
    oldHandler?.removeEvent('dragBlocked', 'activeHandlerOnDragBlocked');

    newHandler?.onDragStart(handleOnDragStart, 'activeHandlerOnDragStart');
    newHandler?.onDragEnd(handleOnDragEnd, 'activeHandlerOnDragEnd');
    newHandler?.onDragCancel(handleOnDragCancel, 'activeHandlerOnDragCancel');
    newHandler?.onDrop(handleOnDrop, 'activeHandlerOnDrop');
    newHandler?.onDragBlocked?.(handleOnDragBlocked, 'activeHandlerOnDragBlocked');
}, { immediate: true });

onUnmounted(() => {
    features?.destroyFeature('dnd');
});

// Visual link flags for ghost entries — delegated to JoinRows when present
// so multi-frame visual logic stays in its proper home.
const ghostLinkFlags = (uuid: string | number) => {
    const jr = features?.data.joinRows;
    if (!jr || !dnd.value) return { linkedAbove: false, linkedBelow: false };
    return jr.getGhostLinkFlags(uuid, dnd.value.state.draggingPlaceholders);
};
</script>

<template>
    <!--
        Ghost previews. dnd.state.draggingPlaceholders contains one entry
        per selected frame (primary first); we render them all.
    -->
    <Teleport to="#editorAreaTeleports" defer>
        <div
            v-for="entry in Object.values(dnd?.state.draggingPlaceholders ?? {})"
            :key="'freeform-' + entry.uuid"
            class="vtd__dragging-placeholder"
            :style="{
                transform: `translate(${entry.left}px, ${entry.top}px)`,
                height: timelineConfig?.rows.height + 'px',
                top: 0,
                left: 0,
                position: 'absolute',
                zIndex: 1,
                pointerEvents: 'none',
            }"
        >
            <FrameUI
                :uuid="entry.uuid"
                :start-ms="entry.start_ms"
                :end-ms="entry.end_ms"
                :title="dnd?.draggingFrame(entry.uuid)?.title ?? null"
                :meta="dnd?.draggingFrame(entry.uuid)?.meta"
                :left="0"
                :width="entry.width"
                :selected="true"
                :linked-above="ghostLinkFlags(entry.uuid).linkedAbove"
                :linked-below="ghostLinkFlags(entry.uuid).linkedBelow"
            >
                <template v-if="timelineSlots?.frame" #frame="slotProps">
                    <UserFrame v-bind="slotProps" />
                </template>
            </FrameUI>
        </div>

        <!--
            Drop-target highlighters — validated snapped positions from
            activeHandler. Primary entry gets the user-replaceable slot.
        -->
        <div
            v-for="entry in Object.values(activeHandler?.state.draggingPlaceholders ?? {})"
            :key="'highlight-' + entry.uuid"
            class="vtd__drag-highlighter"
            :style="{
                transform: `translate(${entry.left}px, ${entry.top}px)`,
                width: entry.width + 'px',
                height: timelineConfig?.rows.height + 'px',
                top: 0,
                left: 0,
                position: 'absolute',
                pointerEvents: 'none',
            }"
        >
            <template v-if="entry.uuid === dnd?.state.draggingFrame.uuid">
                <slot
                    name="highlighter"
                    :top="entry.top"
                    :left="entry.left"
                    :width="entry.width"
                    :height="timelineConfig?.rows.height ?? 0"
                    :start-ms="entry.start_ms"
                    :end-ms="entry.end_ms"
                >
                    <div class="vtd__drag-highlighter__default" />
                </slot>
            </template>
            <template v-else>
                <div class="vtd__drag-highlighter__default" />
            </template>
        </div>
    </Teleport>
</template>
