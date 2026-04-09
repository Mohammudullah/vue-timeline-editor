<script lang="ts" setup>
import { ref, watch } from 'vue';
import useUtils from '../../../composables/utils';


const props = withDefaults(defineProps<{
    left: number,
    width: number,
    startMs: number,
    endMs: number,
    title: string | null,
    selected?: boolean,
    showResizeHandle?: boolean,
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

            <div 
                class="vtd__frame-resize-left-handle vtd__row-frame-resize-handle no-dragging"
                v-if="showResizeHandle"
            >

            </div>

            <div class="vtd__row-frame-title">
                {{ title }}
            </div>
            <div class="vtd__row-frame-time">
                {{ secondsToTimeString({
                    seconds: startMs / 1000,
                    format: 'hh:mm:ss a'
                }) }} - 
                {{ secondsToTimeString({
                    seconds: endMs / 1000,
                    format: 'hh:mm:ss a'
                }) }}

            </div>

            <slot></slot>

            <div 
                class="vtd__frame-resize-right-handle vtd__row-frame-resize-handle no-dragging"
                v-if="showResizeHandle"
            >

            </div>
        </div>
    </div>
</template>