<script lang="ts" setup>
import useUtils from '../../../composables/utils';
import { TimelineFrameInterface } from '../../../types/timeline';


const props = withDefaults(defineProps<{
    left: number,
    width: number,
    frame: TimelineFrameInterface
}>(), {
    
})


const { secondsToTimeString } = useUtils()


const emits = defineEmits<{
    'pointerdown': [value: PointerEvent],
    'pointermove': [value: PointerEvent],
    'pointerup': [value: PointerEvent],
    'pointercancel': [value: PointerEvent],
    'contextmenu': [value: PointerEvent],
    'mouseenter': [value: MouseEvent],
    'mouseleave': [value: MouseEvent],
}>()


</script>

<template>
    <div
        class="vtd__row-frame-container"
        :style="{
            left: left + 'px',
            width: width + 'px'
        }"
    >
        <div 
            class="vtd__row-frame"
            @pointerdown="$emit('pointerdown', $event)"
            @pointermove="$emit('pointermove', $event)"
            @pointerup="$emit('pointerup', $event)"
            @pointercancel="$emit('pointercancel', $event)"
            @contextmenu="$emit('contextmenu', $event)"
            @mouseenter="$emit('mouseenter', $event)"
            @mouseleave="$emit('mouseleave', $event)"
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