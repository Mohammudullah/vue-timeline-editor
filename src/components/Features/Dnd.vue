<script setup lang="ts">
import { computed, inject, onUnmounted, Teleport } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { useDnd, UseDndType, DraggingPlaceholderInterface } from '../../composables/features/dnd';
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

const dnd = computed<UseDndType | null>(() => features?.data.dnd ?? null);
const activeHandler = computed(() => features?.data.snapping || features?.data.dnd || null);

// Sorted ghost entries by vertical position — used to determine which ghost
// entries are adjacent to a linked sibling so the connected edge style applies.
const sortedGhostEntries = computed(() => {
    return Object.values(dnd.value?.state.draggingPlaceholders ?? {}).sort((a, b) => a.top - b.top);
});

// Returns { linkedAbove, linkedBelow } flags for a given ghost placeholder
// entry. Two entries are considered adjacent when they are vertically one
// row-height apart and share the same linkGroupUuid.
const getGhostLinkFlags = (entry: DraggingPlaceholderInterface) => {
    const rowHeight = timelineConfig?.rows.height ?? 0;
    const myGroup = dnd.value?.draggingFrame(entry.uuid)?.linkGroupUuid;
    if (!myGroup) return { linkedAbove: false, linkedBelow: false };
    const sorted = sortedGhostEntries.value;
    const idx = sorted.findIndex(e => e.uuid === entry.uuid);
    const linkedAbove = idx > 0
        && Math.abs(sorted[idx - 1].top - entry.top) <= rowHeight
        && dnd.value?.draggingFrame(sorted[idx - 1].uuid)?.linkGroupUuid === myGroup;
    const linkedBelow = idx >= 0 && idx < sorted.length - 1
        && Math.abs(sorted[idx + 1].top - entry.top) <= rowHeight
        && dnd.value?.draggingFrame(sorted[idx + 1].uuid)?.linkGroupUuid === myGroup;
    return { linkedAbove: !!linkedAbove, linkedBelow: !!linkedBelow };
};


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

    // frameData.current is an array — one entry per frame in the group (or just
    // the primary for a non-grouped drag). Update every frame so group members
    // are persisted alongside the primary.
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
            linkGroupUuid: original.linkGroupUuid, // preserve link group on drag
        });
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
}, { immediate: true })

onUnmounted(() => {
    features?.destroyFeature('dnd');
})

</script>

<template>

    <!--
        Ghost previews.
        Loop over draggingPlaceholders — always contains the primary frame while
        dragging; external features (e.g. JoinRows) add group-member entries.
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
                :start-ms="entry.start_ms"
                :end-ms="entry.end_ms"
                :title="dnd?.draggingFrame(entry.uuid)?.title ?? null"
                :left="0"
                :width="entry.width"
                :selected="true"
                :linked-above="getGhostLinkFlags(entry).linkedAbove"
                :linked-below="getGhostLinkFlags(entry).linkedBelow"
            />
        </div>

        <!--
            Drop-target highlighters.
            Validated snapped positions from activeHandler (snapping when active,
            dnd otherwise). Primary entry gets the user-replaceable highlighter slot.
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