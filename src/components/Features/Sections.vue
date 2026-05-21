<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { TimelineSectionInterface } from '../../types/timeline';

/**
 * <Sections/>
 *
 * Initialises the timeline's section/row/frame data, and — when enabled —
 * provides "click an empty area to add a frame": an empty row area shows a
 * dashed suggestion box; activating it emits `add-frame`.
 *
 * Per row, the box length is:
 *  • `row.new_frame_ms` ms (capped by the available gap), when set;
 *  • otherwise the whole empty gap, when the `rowClickable` prop is on.
 *
 * Interaction:
 *  • Mouse/pen — the box follows the hover; a click on it emits `add-frame`.
 *  • Touch — the first tap latches the box (it stays put); a second tap on
 *    the box emits `add-frame`. The latched box shows a small label, which
 *    can be customised with the `newFrameLabel` prop or the `#label` slot.
 */
const props = withDefaults(defineProps<{
    sections: TimelineSectionInterface[],
    // Global enable for the empty-area suggestion. A row with its own
    // `new_frame_ms` is suggestible even when this is false.
    rowClickable?: boolean,
    // Touch-mode label text. Overridden entirely by the `#label` slot.
    newFrameLabel?: string,
}>(), {
    rowClickable: false,
    newFrameLabel: '+ Add',
});

export interface NewFrameSuggestion {
    rowUuid: string | number,
    sectionUuid: string | number,
    start_ms: number,
    end_ms: number,
}

const emit = defineEmits<{
    'add-frame': [suggestion: NewFrameSuggestion, event: MouseEvent],
}>();

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');
const features = inject<ReturnType<typeof useFeatures>>('features');

if (!timeline || !timelineConfig) {
    console.error('Sections: Timeline and TimelineConfig must be provided.');
}

onMounted(() => {
    timeline?.initSections(props.sections);
});

// `true` while the last pointer interaction was touch — touch has no hover,
// so it uses the latched two-tap flow instead.
const isTouch = ref(false);
// Pointer-over-editor gate for mouse/pen. `timeline.state.pointer` keeps its
// last value after the pointer leaves, so a hover flag is needed.
const hovering = ref(false);
// Latched suggestion for touch — frozen at the tap position; survives until
// the box is tapped (emit), another empty area is tapped, or a frame is tapped.
const touchSuggestion = ref<NewFrameSuggestion | null>(null);

// Pure computation: the suggestion for a given row + pointer-ms, or null when
// that spot isn't a suggestible empty gap. Shared by hover and touch.
const computeSuggestionAt = (
    rowUuid: string | number | null,
    onMs: number,
): NewFrameSuggestion | null => {
    if (!timeline || !timelineConfig) return null;
    if (rowUuid == null) return null;

    const row = timeline.state.sectionRowsByUuid[rowUuid];
    if (!row) return null;

    // Read from row state (set by initSections) so it works whether sections
    // were provided via the `sections` prop or `timeline.initSections(...)`.
    const length = row.new_frame_ms;
    // The row participates only with its own length or the global flag.
    if (length == null && !props.rowClickable) return null;

    // The empty gap under the pointer — null when the pointer is over a frame.
    const area = row.emptyAreas.find(a => onMs >= a.start_ms && onMs < a.end_ms);
    if (!area) return null;

    const areaLen = area.end_ms - area.start_ms;
    if (areaLen <= 0) return null;

    // Fixed length capped by the gap; otherwise the whole gap.
    const len = length != null ? Math.min(length, areaLen) : areaLen;
    // Fixed-length box is centred on the pointer (the clamp below shifts it
    // so it stays inside the gap near the edges); the full-gap box just
    // spans the area.
    let start = length != null ? onMs - len / 2 : area.start_ms;

    // Snap the start to the grid when the Snapping feature is active. Only
    // the fixed-length box — the full-gap box already sits on frame edges.
    const snapping = features?.data.snapping;
    if (length != null && snapping) {
        start = snapping.snapMs(start);
    }

    start = Math.max(area.start_ms, Math.min(start, area.end_ms - len));

    return {
        rowUuid,
        sectionUuid: row.sectionUuid,
        start_ms: start,
        end_ms: start + len,
    };
};

// Hover-driven suggestion (mouse/pen) — recomputes live as the pointer moves.
const hoverSuggestion = computed<NewFrameSuggestion | null>(() => {
    if (isTouch.value || !hovering.value || !timeline) return null;
    // Skip while a drag/resize gesture is in progress.
    if (timeline.state.pointer.edgeScroll) return null;
    return computeSuggestionAt(
        timeline.state.pointer.over.rowUuid,
        timeline.state.pointer.on_ms,
    );
});

// The suggestion currently in effect — latched value on touch, live hover
// value otherwise.
const activeSuggestion = computed<NewFrameSuggestion | null>(() =>
    isTouch.value ? touchSuggestion.value : hoverSuggestion.value,
);

// Editor-relative pixel geometry for the suggestion box — same mapping as
// renderFrame, so the box aligns 1:1 with real frames.
const suggestionStyle = computed(() => {
    const s = activeSuggestion.value;
    if (!s || !timeline || !timelineConfig) return null;

    const row = timeline.state.sectionRowsByUuid[s.rowUuid];
    if (!row) return null;

    const rangeStartMs = (timelineConfig.range.start_seconds ?? 0) * 1000;
    return {
        left: ((s.start_ms - rangeStartMs) * timelineConfig.cols.pixelPerMs
            + timelineConfig.editor.paddingLeft) + 'px',
        width: ((s.end_ms - s.start_ms) * timelineConfig.cols.pixelPerMs) + 'px',
        top: row.editorRelativeTop + 'px',
        height: timelineConfig.rows.height + 'px',
    };
});

// Props exposed to the `#label` slot so consumers can render dynamic content.
const labelSlotProps = computed(() => {
    const s = activeSuggestion.value;
    if (!s) return { rowUuid: '', sectionUuid: '', start_ms: 0, end_ms: 0, length_ms: 0 };
    return {
        rowUuid: s.rowUuid,
        sectionUuid: s.sectionUuid,
        start_ms: s.start_ms,
        end_ms: s.end_ms,
        length_ms: s.end_ms - s.start_ms,
    };
});

// ─── Editor pointer wiring ──────────────────────────────────────────────
const onPointerEnter = () => { hovering.value = true; };
const onPointerLeave = () => { hovering.value = false; };
const onPointerDown = (event: PointerEvent) => {
    isTouch.value = event.pointerType === 'touch';
};

// Touch tap that isn't on the box (the box stops its own click's
// propagation): latch the suggestion at the tap, or clear it when the tap
// isn't on a suggestible empty area.
const onEditorClick = () => {
    if (!isTouch.value || !timeline) return;
    touchSuggestion.value = computeSuggestionAt(
        timeline.state.pointer.over.rowUuid,
        timeline.state.pointer.on_ms,
    );
};

const editorListeners: Record<string, EventListener> = {
    pointerenter: onPointerEnter as EventListener,
    pointerleave: onPointerLeave as EventListener,
    pointerdown: onPointerDown as EventListener,
    click: onEditorClick as EventListener,
};

watch(() => timeline?.state.editor, (el, old) => {
    if (old instanceof HTMLElement) {
        for (const name in editorListeners) old.removeEventListener(name, editorListeners[name]);
    }
    if (el instanceof HTMLElement) {
        for (const name in editorListeners) el.addEventListener(name, editorListeners[name]);
    }
}, { immediate: true });

onBeforeUnmount(() => {
    const el = timeline?.state.editor;
    if (el instanceof HTMLElement) {
        for (const name in editorListeners) el.removeEventListener(name, editorListeners[name]);
    }
});

// Click/tap on the box itself → emit. On touch this is the confirming
// second tap; the latched box is then cleared.
const onSuggestionClick = (event: MouseEvent) => {
    const s = activeSuggestion.value;
    if (!s) return;
    // Don't let the click also clear the frame selection (outside-click).
    event.stopPropagation();
    emit('add-frame', s, event);
    if (isTouch.value) touchSuggestion.value = null;
};
</script>

<template>
    <Teleport to="#editorAreaTeleports" defer>
        <div
            v-if="suggestionStyle"
            class="vtd__new-frame-suggestion"
            :style="suggestionStyle"
            @click="onSuggestionClick"
        >
            <div v-if="isTouch" class="vtd__new-frame-suggestion-label">
                <!-- Overrides the entire touch-mode label content. -->
                <slot name="label" v-bind="labelSlotProps">{{ newFrameLabel }}</slot>
            </div>
        </div>
    </Teleport>
</template>
