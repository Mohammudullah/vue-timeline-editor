<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { TimelineFrameByUuidInterface } from '../../../../types/timeline';
import FrameUI from '../../UI/FrameUI.vue';
import { UseTimelineInterface } from '../../../../composables/timeline';
import { TimelineConfigInterface } from '../../../../composables/timelineConfig';


const props = withDefaults(defineProps<{
    uuid: string | number,
    timeline: UseTimelineInterface,
    config: TimelineConfigInterface,
    selected?: boolean,
    draggable?: boolean,
    dragging?: boolean,
    resizing?: boolean,
    resizable?: boolean,
}>(), {
    
})

const emits = defineEmits<{
    'click': [value: PointerEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'contextmenu': [value: PointerEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'containerUpdate': [value: HTMLDivElement | null, frame: TimelineFrameByUuidInterface, uuid: string | number]
}>()

const frameUi = useTemplateRef<InstanceType<typeof FrameUI>>('frameUi')
    
const frame = computed<TimelineFrameByUuidInterface>(() => {
    return props.timeline.state.sectionFramesByUuid[props.uuid];
})

const container = computed<HTMLDivElement | null>(() => frameUi.value?.container ?? null);

// Ordered row UUIDs for the section this frame belongs to.
const rowUuids = computed(() => {
    const sectionUuid = frame.value?.sectionUuid;
    return sectionUuid != null ? props.timeline.state.sectionRowUuids[sectionUuid] ?? [] : [];
});

// True when this frame is visually stacked with a linked sibling in the row
// directly above — same linkGroupUuid AND same start/end. Used to flatten the
// top edge and to hide redundant title/time on all but the topmost frame of a
// connected group. Linked frames that share a group but sit in non-adjacent
// rows, or have different time ranges, are "joined but not together" and
// continue to render their own header.
const hasLinkedAbove = computed(() => {
    const f = frame.value;
    if (!f?.linkGroupUuid) return false;
    const idx = rowUuids.value.indexOf(f.rowUuid);
    if (idx <= 0) return false;
    const aboveRowUuid = rowUuids.value[idx - 1];
    return Object.values(props.timeline.state.sectionFramesByUuid).some(
        fr => fr.rowUuid === aboveRowUuid
            && fr.linkGroupUuid === f.linkGroupUuid
            && fr.start_ms === f.start_ms
            && fr.end_ms === f.end_ms
    );
});

// Symmetric check for the row directly below.
const hasLinkedBelow = computed(() => {
    const f = frame.value;
    if (!f?.linkGroupUuid) return false;
    const idx = rowUuids.value.indexOf(f.rowUuid);
    if (idx < 0 || idx >= rowUuids.value.length - 1) return false;
    const belowRowUuid = rowUuids.value[idx + 1];
    return Object.values(props.timeline.state.sectionFramesByUuid).some(
        fr => fr.rowUuid === belowRowUuid
            && fr.linkGroupUuid === f.linkGroupUuid
            && fr.start_ms === f.start_ms
            && fr.end_ms === f.end_ms
    );
});

// True while `timeline.scrollToViewPort(uuid, true)` is animating this
// frame's blink — the timeline composable manages the timing and clears the
// flag automatically. Just a reactive pass-through here.
const isHighlighted = computed(() =>
    props.timeline.state.highlightedFrameUuids[props.uuid] === true
);

// True when another frame in the SAME row shares any part of this frame's
// time range. Surfaces the overlap state to the UI so a stacked frame can
// render semi-transparent and not visually swallow what's underneath.
// Touching edges (start == otherEnd or end == otherStart) is not overlap.
const isOverlapping = computed(() => {
    const f = frame.value;
    if (!f) return false;
    const all = props.timeline.state.sectionFramesByUuid;
    for (const key in all) {
        const other = all[key];
        if (other.uuid === f.uuid) continue;
        if (other.rowUuid !== f.rowUuid) continue;
        if (other.start_ms < f.end_ms && other.end_ms > f.start_ms) return true;
    }
    return false;
});

</script>

<template>
    <FrameUI
        ref="frameUi"
        :uuid="uuid"
        :left="frame.editorRelativeLeft"
        :width="frame.width"
        :start-ms="frame.start_ms"
        :end-ms="frame.end_ms"
        :title="frame.title"
        :meta="frame.meta"
        @click="(event) => container ? emits('click', event, container, frame, uuid) : null"
        @container-update="(event) => container ? emits('containerUpdate', event, frame, uuid) : null"
        :style="{
            'touch-action' : selected ? 'none' : 'auto'
        }"
        :selected="props.selected"
        v-if="!dragging && !resizing"
        :show-resize-handle="props.selected && !props.dragging && props.resizable"
        :linked-above="hasLinkedAbove"
        :linked-below="hasLinkedBelow"
        :overlapping="isOverlapping"
        :highlighted="isHighlighted"
    >
        <!-- Re-expose the `frame` slot to consumers further up the tree. -->
        <template #frame="slotProps">
            <slot name="frame" v-bind="slotProps" />
        </template>
    </FrameUI>
    
</template>