<script setup lang="ts">
import { computed } from 'vue';
import { TimelineFrameInterface } from '../../../../types/timeline';
import useUtils from '../../../../composables/utils';
import usePointerPress from '../../../../composables/pointerPress';
import FrameUI from '../../UI/FrameUI.vue';
import { UseDndType } from '../../../../composables/features/dnd';


const props = withDefaults(defineProps<{
    frame: TimelineFrameInterface,
    pixelPerMs: number,
    offsetLeft: number,
    dnd: UseDndType | null
}>(), {
    
})

const emits = defineEmits<{
    'click': [frame: TimelineFrameInterface, event: PointerEvent],
    'dblclick': [frame: TimelineFrameInterface, event: PointerEvent | MouseEvent],
    'holdstart': [frame: TimelineFrameInterface, event: PointerEvent],
    'holdend': [frame: TimelineFrameInterface, event: PointerEvent],
    'contextmenu': [frame: TimelineFrameInterface, event: PointerEvent],
    'mouseenter': [frame: TimelineFrameInterface, event: MouseEvent],
    'mouseleave': [frame: TimelineFrameInterface, event: MouseEvent],
}>()

const position = computed<{ left: number; width: number }>(() => ({
        left: (props.frame.start_ms * props.pixelPerMs) + props.offsetLeft,
        width: (props.frame.end_ms - props.frame.start_ms) * props.pixelPerMs
    })
)


const framePress = usePointerPress({
    onClick: (event) => emits('click', props.frame, event),
    onDoubleClick: (event) => emits('dblclick', props.frame, event),
    onHoldStart: (event) => props.dnd?.onDragStart(event) ,
    onHoldEnd: (event) => props.dnd?.onDragEnd(event),
})

</script>

<template>
    <FrameUI
        :left="position.left"
        :width="position.width"
        :frame="frame"
        @pointerdown="framePress.onPointerdown"
        @pointermove="framePress.onPointermove"
        @pointerup="framePress.onPointerup"
        @pointercancel="framePress.onPointercancel"
        @contextmenu="(event) => emits('contextmenu', frame, event)"
        @mouseenter="(event) => emits('mouseenter', frame, event)"
        @mouseleave="(event) => emits('mouseleave', frame, event)"
    >

    </FrameUI>
    
</template>