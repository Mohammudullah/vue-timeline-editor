<script setup lang="ts">
import { computed } from 'vue';
import { TimelineFrameByUuidInterface } from '../../../../types/timeline';
import Frame from '../Frames/Frame.vue';
import { UseTimelineInterface } from '../../../../composables/timeline';
import { TimelineConfigInterface } from '../../../../composables/timelineConfig';
import { UseFeaturesType } from '../../../../composables/features/features';


const props = withDefaults(defineProps<{
    uuid: string | number,
    height: number,
    timeline: UseTimelineInterface,
    config: TimelineConfigInterface,
    features: UseFeaturesType,
}>(), {
    
})

const emits = defineEmits<{
    'frameClick': [value: PointerEvent, frame: TimelineFrameByUuidInterface, container: HTMLDivElement, uuid: string | number],
    'frameContextmenu': [value: PointerEvent, frame: TimelineFrameByUuidInterface, container: HTMLDivElement, uuid: string | number],
    'frameContainerUpdate': [value: HTMLDivElement | null, frame: TimelineFrameByUuidInterface, uuid: string | number]
}>()

const frameUuids = computed(() => props.timeline.state.sectionFrameUuids[props.uuid])

</script>
<template>
    <div
        class="vtd__row"
        :style="{
            height: props.height + 'px',
            paddingLeft: props.config.editor.paddingLeft + 'px',
            paddingRight: props.config.editor.paddingRight + 'px'
        }"
    >
        <Frame
            :selected = "features.data.selectedFrames.isFrameSelected(uuid)"
            :draggable="features.data.dnd != null && features.data.frame.state.selected.uuid === uuid"
            :dragging="features.data.dnd?.state.dragging && features.data.dnd.state.draggingFrame.uuid === uuid"
            :resizing="features.data.resize?.state.resizing && features.data.resize.state.resizingFrame.uuid === uuid"
            :resizable="features.data.resize != null"
            v-for="uuid in frameUuids"
            :key="uuid"
            :uuid="uuid"
            :timeline="props.timeline"
            :config="props.config"
            :features="props.features"
            @click="(event, container, frame, uuid) => emits('frameClick', event, frame, container, uuid)"
            @containerUpdate="(container, frame, uuid) => emits('frameContainerUpdate', container, frame, uuid)"
         />
    </div>
</template>