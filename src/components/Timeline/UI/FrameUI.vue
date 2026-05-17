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
    // When true, this frame has a linked sibling in the row directly above/below.
    // The shared edge gets flattened corners and a minimal border so the pair
    // feels connected yet distinct.
    linkedAbove?: boolean,
    linkedBelow?: boolean,
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

// Matches DRAG_THRESHOLD in dnd.ts so click-vs-drag is consistent across features.
const CLICK_THRESHOLD = 4;
let pressOrigin: { x: number, y: number } | null = null;
let pressMoved = false;

const onPointerDown = (event: PointerEvent) => {
    pressOrigin = { x: event.clientX, y: event.clientY };
    pressMoved = false;
};

const onPointerMove = (event: PointerEvent) => {
    if (!pressOrigin || pressMoved) return;
    const dx = Math.abs(event.clientX - pressOrigin.x);
    const dy = Math.abs(event.clientY - pressOrigin.y);
    if (dx > CLICK_THRESHOLD || dy > CLICK_THRESHOLD) pressMoved = true;
};

const onClick = (event: PointerEvent) => {
    const moved = pressMoved;
    pressOrigin = null;
    pressMoved = false;
    if (moved) return;
    emits('click', event);
};


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
        <!-- Resize handles sit on the container (outside the frame) so they
             are not clipped by the frame's overflow:hidden -->
        <div
            class="vtd__frame-resize-left-handle vtd__row-frame-resize-handle no-dragging"
            :class="{
                'vtd__row-frame-resize-handle--linked-above': linkedAbove,
                'vtd__row-frame-resize-handle--linked-below': linkedBelow,
            }"
            v-if="showResizeHandle"
        >
            <div class="vtd__row-frame-resize-handle-grip no-dragging"></div>
        </div>

        <div 
            class="vtd__row-frame"
            :class="{
                'vtd__row-frame-selected': selected,
                'vtd__row-frame--linked-above': linkedAbove,
                'vtd__row-frame--linked-below': linkedBelow,
            }"
            style="overflow: hidden;"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @click="onClick"
        >
            <!-- When this frame is stacked under a linked sibling at the same
                 time range, the topmost frame already carries the title+time;
                 hide them here so the joined block reads as one unit. -->
            <template v-if="!linkedAbove">
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
            </template>

            <slot></slot>
        </div>

        <div
            class="vtd__frame-resize-right-handle vtd__row-frame-resize-handle no-dragging"
            :class="{
                'vtd__row-frame-resize-handle--linked-above': linkedAbove,
                'vtd__row-frame-resize-handle--linked-below': linkedBelow,
            }"
            v-if="showResizeHandle"
        >
            <div class="vtd__row-frame-resize-handle-grip no-dragging"></div>
        </div>
    </div>
</template>