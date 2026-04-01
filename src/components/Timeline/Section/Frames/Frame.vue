<script setup lang="ts">
import { computed } from 'vue';
import { TimelineFrameInterface } from '../../../../types/timeline';
import useUtils from '../../../../composables/utils';


const props = withDefaults(defineProps<{
    frame: TimelineFrameInterface,
    pixelPerMs: number,
    offsetLeft: number
}>(), {
    
})

const emits = defineEmits<{
    'click': [frame: TimelineFrameInterface, event: PointerEvent],
    'dblclick': [frame: TimelineFrameInterface, event: PointerEvent | MouseEvent],
    'hold': [frame: TimelineFrameInterface, event: PointerEvent],
    'holdend': [frame: TimelineFrameInterface, event: PointerEvent],
    'contextmenu': [frame: TimelineFrameInterface, event: PointerEvent],
    'mouseenter': [frame: TimelineFrameInterface, event: MouseEvent],
    'mouseleave': [frame: TimelineFrameInterface, event: MouseEvent],
    'drag': [frame: TimelineFrameInterface, event: DragEvent],
    'dragend': [frame: TimelineFrameInterface, event: DragEvent],
    'dragstart': [frame: TimelineFrameInterface, event: DragEvent],
}>()

const { secondsToTimeString } = useUtils()

const position = computed<{ left: number; width: number }>(() => ({
        left: (props.frame.start_ms * props.pixelPerMs) + props.offsetLeft,
        width: (props.frame.end_ms - props.frame.start_ms) * props.pixelPerMs
    })
)

</script>

<template>
    <div
        class="vtd__row-frame-container"
        :style="{
            left: position.left + 'px',
            width: position.width + 'px'
        }"
    >
        <div 
            class="vtd__row-frame"
            @contextmenu="(event) => emits('contextmenu', props.frame, event)"
            @mouseenter="(event) => emits('mouseenter', props.frame, event)"
            @mouseleave="(event) => emits('mouseleave', props.frame, event)"
            @drag="(event) => emits('drag', props.frame, event)"
            @dragend="(event) => emits('dragend', props.frame, event)"
            @dragstart="(event) => emits('dragstart', props.frame, event)"
        >
            <div class="vtd__row-frame-title">
                {{ frame.title }}
            </div>
            <div class="vtd__row-frame-time">
                {{ secondsToTimeString({
                    seconds: frame.start_ms / 1000,
                    format: 'hh:mm:ss a'
                }) }} - 
                {{ secondsToTimeString({
                    seconds: frame.end_ms / 1000,
                    format: 'hh:mm:ss a'
                }) }}

            </div>
        </div>
    </div>
    
</template>