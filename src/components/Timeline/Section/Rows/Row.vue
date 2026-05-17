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

// True when SnapGuideLines is mounted AND the pointer is currently over this
// row. The class is applied unconditionally here; the gate is whether the
// feature is even providing a non-null `hoveredRowUuid`. Color/styling lives
// in basic-theme.css under `.vtd__row--hovered`.
const isHovered = computed(() =>
    props.features.data.snapGuideLines?.state.hoveredRowUuid === props.uuid
)

</script>
<template>
    <div
        class="vtd__row"
        :class="{ 'vtd__row--hovered': isHovered }"
        :style="{
            height: props.height + 'px',
            paddingLeft: props.config.editor.paddingLeft + 'px',
            paddingRight: props.config.editor.paddingRight + 'px'
        }"
    >
        <Frame
            :selected = "features.data.frames.isFrameSelected(uuid)"
            :draggable="features.data.dnd != null && features.data.frames.isFrameSelected(uuid)"
            :dragging="features.data.dnd?.dragging(uuid)"
            :resizing="features.data.resize?.resizing(uuid)"
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