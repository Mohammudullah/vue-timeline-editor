<script setup lang="ts">
import { computed } from 'vue';
import { UseDndType } from '../../../../composables/features/dnd';
import { PointerPressControls } from '../../../../composables/pointerPress';
import { TimelineFrameInterface, TimelineRowInterface } from '../../../../types/timeline';
import Frame from '../Frames/Frame.vue';
import { UseTimelineInterface } from '../../../../composables/timeline';
import { TimelineConfigInterface } from '../../../../composables/timelineConfig';
import { UseFeaturesType } from '../../../../composables/features/features';


const props = withDefaults(defineProps<{
    uuid: string | number,
    height: number,
    rowLabelWidth: number,
    pixelPerMs: number,
    paddingLeft?: number,
    paddingRight?: number,
    timeline: UseTimelineInterface,
    config: TimelineConfigInterface,
    features: UseFeaturesType,
}>(), {
    paddingLeft: 0,
    paddingRight: 0,
})

const emits = defineEmits<{
    'frameClick': [value: PointerEvent, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number],
    'frameDblclick': [value: PointerEvent | MouseEvent, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number],
    'frameHoldStart': [value: PointerEvent, controls: PointerPressControls, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number],
    'frameHoldend': [value: PointerEvent, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number],
    'frameContextmenu': [value: PointerEvent, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number],
    'frameMouseenter': [value: MouseEvent, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number],
    'frameMouseleave': [value: MouseEvent, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number],
}>()

const frameUuids = computed(() => props.timeline.state.sectionFrameUuids[props.uuid])

</script>
<template>
    <div
        class="vtd__row"
        :style="{
            height: props.height + 'px',
            paddingLeft: paddingLeft + 'px',
            paddingRight: paddingRight + 'px'
        }"
    >
        <Frame
            v-for="uuid in frameUuids"
            :key="uuid"
            :uuid="uuid"
            :timeline="props.timeline"
            :config="props.config"
            :features="props.features"
            :pixelPerMs="props.config.cols.pixelPerMs ?? 0"
            :offsetLeft="props.config.editor.paddingLeft ?? 0"
            @click="(event, container, frame, uuid) => emits('frameClick', event, frame, container, uuid)"
            @dblclick="(event, container, frame, uuid) => emits('frameDblclick', event, frame, container, uuid)"
            @holdstart="(event, controls, container, frame, uuid) => emits('frameHoldStart', event, controls, frame, container, uuid)"
            @holdend="(event, container, frame, uuid) => emits('frameHoldend', event, frame, container, uuid)"
            @contextmenu="(event, container, frame, uuid) => emits('frameContextmenu', event, frame, container, uuid)"
            @mouseenter="(event, container, frame, uuid) => emits('frameMouseenter', event, frame, container, uuid)"
            @mouseleave="(event, container, frame, uuid) => emits('frameMouseleave', event, frame, container, uuid)"
         />
    </div>
</template>