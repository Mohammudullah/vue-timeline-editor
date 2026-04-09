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
        v-if="!dragging"
        :show-resize-handle="props.selected && !props.dragging"
    >

    </FrameUI>
    
</template>