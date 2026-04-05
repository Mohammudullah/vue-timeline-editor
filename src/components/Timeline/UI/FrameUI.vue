<script lang="ts" setup>
import { ref, watch } from 'vue';
import useUtils from '../../../composables/utils';
import { TimelineFrameByUuidInterface, TimelineFrameInterface } from '../../../types/timeline';


const props = withDefaults(defineProps<{
    left: number,
    width: number,
    frame: TimelineFrameByUuidInterface,
    selected?: boolean,
}>(), {
    
})


const { secondsToTimeString } = useUtils()

const container = ref<HTMLDivElement | null>(null);


const emits = defineEmits<{
    'click': [value: PointerEvent],
    'containerUpdate': [value: HTMLDivElement | null]
}>()


defineExpose({
    container
})

watch(container, (newContainer) => {
    emits('containerUpdate', newContainer);
})


</script>

<template>
    <div
        class="vtd__row-frame-container"
        ref="container"
        :style="{
            left: left + 'px',
            width: width + 'px',
        }"
    >
        <div 
            class="vtd__row-frame"
            :class="{
                'vtd__row-frame-selected': selected
            }"
            @click="emits('click', $event)"
        >
            <div class="vtd__frame-drag-handle">

            </div>
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

            <slot></slot>
        </div>
    </div>
</template>