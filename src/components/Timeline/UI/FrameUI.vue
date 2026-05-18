<script lang="ts" setup>
import { ref, watch } from 'vue';
import useUtils from '../../../composables/utils';


const props = withDefaults(defineProps<{
    uuid?: string | number,
    left: number,
    width: number,
    startMs: number,
    endMs: number,
    title: string | null,
    // Arbitrary per-frame payload, forwarded to the `frame` slot so consumers
    // can render custom content based on their own data.
    meta?: unknown,
    selected?: boolean,
    showResizeHandle?: boolean,
    // When true, this frame has a linked sibling in the row directly above/below.
    // The shared edge gets flattened corners and a minimal border so the pair
    // feels connected yet distinct.
    linkedAbove?: boolean,
    linkedBelow?: boolean,
    // True when this frame's time range overlaps another frame's in the same
    // row. Triggers a semi-transparent style so the stacked frames are both
    // visible. Used when overlap protection is disabled.
    overlapping?: boolean,
    // True while a `scrollToViewPort(uuid, true)` blink is active. Applies a
    // class that the theme animates; cleared automatically by the composable.
    highlighted?: boolean,
    // True while async work registered via the event payload's `process()`
    // is in flight (typically a server save). Applies a theme class and
    // hides the resize handle so the user can't kick off a competing
    // mutation — drag/resize are also blocked at the composable level.
    pending?: boolean,
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
        :class="{ 'vtd__row-frame-container--selected': selected }"
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
            v-if="showResizeHandle && !pending"
        >
            <div class="vtd__row-frame-resize-handle-grip no-dragging"></div>
        </div>

        <div
            class="vtd__row-frame"
            :class="{
                'vtd__row-frame-selected': selected,
                'vtd__row-frame--linked-above': linkedAbove,
                'vtd__row-frame--linked-below': linkedBelow,
                'vtd__row-frame--overlapping': overlapping,
                'vtd__row-frame--highlight-blink': highlighted,
                'vtd__frame-processing': pending,
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
                <!-- `frame` slot replaces the inner content while keeping the
                     container, borders, resize handles, and all interactive
                     behaviour intact. Default fallback is the built-in
                     title+time block so existing consumers don't change. -->
                <slot
                    name="frame"
                    :uuid="uuid"
                    :title="title"
                    :startMs="startMs"
                    :endMs="endMs"
                    :meta="meta"
                    :selected="selected"
                    :linkedAbove="linkedAbove"
                    :linkedBelow="linkedBelow"
                    :overlapping="overlapping"
                >
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
                </slot>
            </template>

            <slot></slot>
        </div>

        <div
            class="vtd__frame-resize-right-handle vtd__row-frame-resize-handle no-dragging"
            :class="{
                'vtd__row-frame-resize-handle--linked-above': linkedAbove,
                'vtd__row-frame-resize-handle--linked-below': linkedBelow,
            }"
            v-if="showResizeHandle && !pending"
        >
            <div class="vtd__row-frame-resize-handle-grip no-dragging"></div>
        </div>
    </div>
</template>