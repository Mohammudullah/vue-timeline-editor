<script setup lang="ts">
import { computed, onUpdated, useTemplateRef } from 'vue';
import { TimelineFrameByUuidInterface, TimelineFrameInterface } from '../../../../types/timeline';
import usePointerPress, { PointerPressControls } from '../../../../composables/pointerPress';
import FrameUI from '../../UI/FrameUI.vue';
import { UseTimelineInterface } from '../../../../composables/timeline';
import { UseFeaturesType } from '../../../../composables/features/features';
import { TimelineConfigInterface } from '../../../../composables/timelineConfig';


const props = withDefaults(defineProps<{
    uuid: string | number,
    pixelPerMs: number,
    offsetLeft: number,
    timeline: UseTimelineInterface,
    features: UseFeaturesType,
    config: TimelineConfigInterface,
}>(), {
    
})

const emits = defineEmits<{
    'click': [value: PointerEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'dblclick': [value: PointerEvent | MouseEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'holdstart': [value: PointerEvent, controls: PointerPressControls, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'holdend': [value: PointerEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'contextmenu': [value: PointerEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'mouseenter': [value: MouseEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'mouseleave': [value: MouseEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
}>()

//render a uuid to identify this component
const frameUi = useTemplateRef<InstanceType<typeof FrameUI>>('frameUi')
    
const frame = computed<TimelineFrameByUuidInterface>(() => {
    return props.timeline.state.sectionFramesByUuid[props.uuid];
})

const container = computed<HTMLDivElement | null>(() => frameUi.value?.container ?? null);

const position = computed<{ left: number; width: number }>(() => ({
        left: (frame.value.start_ms * props.pixelPerMs) + props.offsetLeft,
        width: (frame.value.end_ms - frame.value.start_ms) * props.pixelPerMs
    })
)


const framePress = usePointerPress({
    onClick: (event) => container.value ? emits('click', event, container.value, frame.value, props.uuid) : null,
    onDoubleClick: (event) => container.value ? emits('dblclick', event, container.value, frame.value, props.uuid) : null,
    onHoldStart: (event, controls) => container.value ? emits('holdstart', event, controls, container.value, frame.value, props.uuid) : null,
    onHoldEnd: (event) => container.value ? emits('holdend', event, container.value, frame.value, props.uuid) : null,
    holdDelay: 300
})

</script>

<template>
    <FrameUI
        ref="frameUi"
        :left="position.left"
        :width="position.width"
        :frame="frame"
        @pointerdown="framePress.onPointerdown"
        @pointermove="framePress.onPointermove"
        @pointerup="framePress.onPointerup"
        @pointercancel="framePress.onPointercancel"
        @contextmenu.prevent="(event) => container ? emits('contextmenu', event, container, frame, uuid) : null"
        @mouseenter="(event) => container ? emits('mouseenter', event, container, frame, uuid) : null"
        @mouseleave="(event) => container ? emits('mouseleave', event, container, frame, uuid) : null"
    >

    </FrameUI>
    
</template>