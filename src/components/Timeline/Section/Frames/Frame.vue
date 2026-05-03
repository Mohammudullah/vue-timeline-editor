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

// True when the immediately adjacent row above contains a frame sharing this
// frame's linkGroupUuid. Used to flatten the top edge for a connected look.
const hasLinkedAbove = computed(() => {
    const f = frame.value;
    if (!f?.linkGroupUuid) return false;
    const idx = rowUuids.value.indexOf(f.rowUuid);
    if (idx <= 0) return false;
    const aboveRowUuid = rowUuids.value[idx - 1];
    return Object.values(props.timeline.state.sectionFramesByUuid).some(
        fr => fr.rowUuid === aboveRowUuid && fr.linkGroupUuid === f.linkGroupUuid
    );
});

// True when the immediately adjacent row below contains a frame sharing this
// frame's linkGroupUuid.
const hasLinkedBelow = computed(() => {
    const f = frame.value;
    if (!f?.linkGroupUuid) return false;
    const idx = rowUuids.value.indexOf(f.rowUuid);
    if (idx < 0 || idx >= rowUuids.value.length - 1) return false;
    const belowRowUuid = rowUuids.value[idx + 1];
    return Object.values(props.timeline.state.sectionFramesByUuid).some(
        fr => fr.rowUuid === belowRowUuid && fr.linkGroupUuid === f.linkGroupUuid
    );
});

</script>

<template>
    <FrameUI
        ref="frameUi"
        :left="frame.editorRelativeLeft"
        :width="frame.width"
        :start-ms="frame.start_ms"
        :end-ms="frame.end_ms"
        :title="frame.title"
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
    >

    </FrameUI>
    
</template>