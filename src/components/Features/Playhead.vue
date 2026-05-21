<script lang="ts" setup>
import { computed, inject, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useFeatures } from '../../composables/features/features';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { usePlayhead } from '../../composables/features/playhead';

/**
 * <Playhead/>
 *
 * Opt-in feature: renders the timeline playhead (a draggable ruler handle, a
 * vertical line through every row, and an off-screen edge indicator).
 *
 * Two control surfaces, both backed by the same `usePlayhead` state:
 *  • props — `v-model` (position ms), `v-model:playing`, `rate`, `loop`,
 *    `draggable`, `clickSeek`, `onTimelineMountedScrollToPlayHead`.
 *  • imperative API — reachable as `features.data.playhead` from the
 *    `<Timeline @init>` payload (seek / play / pause / toggle / ...).
 */
const props = withDefaults(defineProps<{
    // Playhead position in absolute ms (same domain as frame.start_ms).
    modelValue?: number,
    // Playback running state.
    playing?: boolean,
    // Timeline-ms per real-ms while playing (1 = real time).
    rate?: number,
    // Wrap to start instead of pausing at the range end.
    loop?: boolean,
    // Allow dragging the handle / scrubbing the ruler.
    draggable?: boolean,
    // Allow clicking the ruler to jump the playhead.
    clickSeek?: boolean,
    // Scroll the editor so the playhead is in view once, after mount.
    onTimelineMountedScrollToPlayHead?: boolean,
}>(), {
    rate: 1,
    loop: false,
    draggable: true,
    clickSeek: true,
    onTimelineMountedScrollToPlayHead: false,
});

const emit = defineEmits<{
    'update:modelValue': [ms: number],
    'update:playing': [playing: boolean],
    'seek': [ms: number],
    'dragStart': [ms: number],
    'dragEnd': [ms: number],
}>();

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if (!timeline || !timelineConfig || !features) {
    console.error('Playhead: Timeline, TimelineConfig, and Features must be provided.');
} else if (features.data.playhead) {
    console.error('Playhead feature is already enabled. Please check if <Playhead/> is mounted multiple times.');
} else {
    features.initFeature('playhead', () =>
        usePlayhead({ timeline, timelineConfig }),
    );
}

const playhead = computed(() => features?.data.playhead ?? null);

// Last position we emitted via `update:modelValue`. A two-way `v-model`
// echoes our own emit straight back as a prop change — without this guard
// that echo would re-`seek` mid-playback and fight the play loop.
let lastEmitted: number | undefined;

// ---- props → composable ------------------------------------------------
watch(() => props.modelValue, (ms) => {
    if (ms === undefined || !playhead.value) return;
    if (ms === lastEmitted) return;
    if (ms !== playhead.value.state.currentMs) playhead.value.seek(ms);
}, { immediate: true });

watch(() => props.playing, (playing) => {
    if (playing === undefined || !playhead.value) return;
    if (playing && !playhead.value.state.playing) playhead.value.play();
    else if (!playing && playhead.value.state.playing) playhead.value.pause();
}, { immediate: true });

watch(() => props.rate, (rate) => playhead.value?.setRate(rate), { immediate: true });
watch(() => props.loop, (loop) => playhead.value?.setLoop(loop), { immediate: true });
watch(() => props.draggable, (v) => {
    if (playhead.value) playhead.value.options.draggable = v;
}, { immediate: true });
watch(() => props.clickSeek, (v) => {
    if (playhead.value) playhead.value.options.clickSeek = v;
}, { immediate: true });

// ---- composable → props (emits) ----------------------------------------
watch(() => playhead.value?.state.currentMs, (ms) => {
    if (ms === undefined) return;
    lastEmitted = ms;
    emit('update:modelValue', ms);
});

watch(() => playhead.value?.state.playing, (playing) => {
    if (playing === undefined) return;
    emit('update:playing', playing);
});

// ---- pointer interaction ----------------------------------------------
// `seekFirst` jumps the playhead to the pointer immediately (ruler click /
// scrub start); the handle skips it since it's grabbed where it already is.
const beginScrub = (event: PointerEvent, seekFirst: boolean) => {
    const ph = playhead.value;
    if (!ph) return;

    if (seekFirst) {
        if (!ph.options.clickSeek) return;
        ph.seekFromClientX(event.clientX);
        emit('seek', ph.state.currentMs);
    }
    if (!ph.options.draggable) return;

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    ph.state.dragging = true;
    emit('dragStart', ph.state.currentMs);
};

const onScrubMove = (event: PointerEvent) => {
    const ph = playhead.value;
    if (!ph?.state.dragging) return;
    ph.seekFromClientX(event.clientX);
    emit('seek', ph.state.currentMs);
};

const onScrubEnd = (event: PointerEvent) => {
    const ph = playhead.value;
    if (!ph?.state.dragging) return;
    ph.state.dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    emit('dragEnd', ph.state.currentMs);
};

const onHandleDown = (event: PointerEvent) => {
    event.stopPropagation();
    beginScrub(event, false);
};
const onStripDown = (event: PointerEvent) => beginScrub(event, true);

// One-shot: bring the playhead into view after the timeline has laid out.
// Child `onMounted` runs before the parent's, and the editor width is only
// computed once <Timeline> mounts — so wait a tick for layout to settle.
onMounted(async () => {
    if (!props.onTimelineMountedScrollToPlayHead) return;
    await nextTick();
    playhead.value?.scrollIntoView('auto');
});

onUnmounted(() => {
    features?.destroyFeature('playhead');
});
</script>

<template>
    <template v-if="playhead">
        <!-- Handle + click-to-seek strip — lives inside the (scroll-mirrored)
             X-axis so it tracks horizontal scroll for free. -->
        <Teleport to="#xAxisTeleports" defer>
            <div
                class="vtd__playhead-seek-strip"
                @pointerdown="onStripDown"
                @pointermove="onScrubMove"
                @pointerup="onScrubEnd"
                @pointercancel="onScrubEnd"
            />
            <div
                v-if="playhead.view.inRange"
                class="vtd__playhead-handle"
                :class="{ 'vtd__playhead-handle--inert': !playhead.options.draggable }"
                :style="{ left: playhead.view.pixelX + 'px' }"
                @pointerdown="onHandleDown"
                @pointermove="onScrubMove"
                @pointerup="onScrubEnd"
                @pointercancel="onScrubEnd"
            />
        </Teleport>

        <!-- Vertical line — spans the full editor content height. Hidden
             when the playhead is outside the range (edge arrow shows). -->
        <Teleport to="#editorAreaTeleports" defer>
            <div
                v-if="playhead.view.inRange"
                class="vtd__playhead-line"
                :style="{ left: playhead.view.pixelX + 'px' }"
            />
        </Teleport>

        <!-- Off-screen edge indicator — pinned to the viewport edge. -->
        <Teleport to="#editorViewportTeleports" defer>
            <div
                v-if="playhead.view.edgeSide"
                class="vtd__playhead-edge-indicator"
                :class="`vtd__playhead-edge-indicator--${playhead.view.edgeSide}`"
                @click="playhead.scrollIntoView()"
            />
        </Teleport>
    </template>
</template>
