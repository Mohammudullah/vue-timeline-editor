<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { TimelineSectionInterface } from '../../types/timeline';

/**
 * <Sections/>
 *
 * Initialises the timeline's section/row/frame data, and — when enabled —
 * provides "click an empty area to add a frame": hovering an empty row area
 * shows a dashed suggestion box; clicking it emits `add-frame`.
 *
 * Per row, the box length is:
 *  • `row.new_frame_length` ms (capped by the available gap), when set;
 *  • otherwise the whole empty gap, when the `rowClickable` prop is on.
 */
const props = withDefaults(defineProps<{
    sections: TimelineSectionInterface[],
    // Global enable for the empty-area suggestion. A row with its own
    // `new_frame_length` is suggestible even when this is false.
    rowClickable?: boolean,
}>(), {
    rowClickable: false,
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

if (!timeline || !timelineConfig) {
    console.error('Sections: Timeline and TimelineConfig must be provided.');
}

onMounted(() => {
    timeline?.initSections(props.sections);
});

// Per-row new_frame_length lookup (ms) — read straight from the input data.
const rowFrameLength = computed<Record<string | number, number>>(() => {
    const map: Record<string | number, number> = {};
    for (const section of props.sections) {
        for (const row of section.rows) {
            if (row.new_frame_length != null) map[row.uuid] = row.new_frame_length;
        }
    }
    return map;
});

// Pointer-over-editor gate. `timeline.state.pointer` keeps its last value
// after the pointer leaves the editor, so a hover flag is needed to know
// when to hide the suggestion box.
const hovering = ref(false);
const onPointerEnter = () => { hovering.value = true; };
const onPointerLeave = () => { hovering.value = false; };

watch(() => timeline?.state.editor, (el, old) => {
    if (old instanceof HTMLElement) {
        old.removeEventListener('pointerenter', onPointerEnter);
        old.removeEventListener('pointerleave', onPointerLeave);
    }
    if (el instanceof HTMLElement) {
        el.addEventListener('pointerenter', onPointerEnter);
        el.addEventListener('pointerleave', onPointerLeave);
    }
}, { immediate: true });

onBeforeUnmount(() => {
    const el = timeline?.state.editor;
    if (el instanceof HTMLElement) {
        el.removeEventListener('pointerenter', onPointerEnter);
        el.removeEventListener('pointerleave', onPointerLeave);
    }
});

// The current new-frame suggestion under the pointer, or null when the
// pointer isn't over a suggestible empty area.
const suggestion = computed<NewFrameSuggestion | null>(() => {
    if (!timeline || !timelineConfig) return null;
    if (!hovering.value) return null;
    // Skip while a drag/resize gesture is in progress.
    if (timeline.state.pointer.edgeScroll) return null;

    const rowUuid = timeline.state.pointer.over.rowUuid;
    if (rowUuid == null) return null;

    const row = timeline.state.sectionRowsByUuid[rowUuid];
    if (!row) return null;

    const length = rowFrameLength.value[rowUuid];
    // The row participates only with its own length or the global flag.
    if (length == null && !props.rowClickable) return null;

    // The empty gap under the pointer — null when the pointer is over a frame.
    const onMs = timeline.state.pointer.on_ms;
    const area = row.emptyAreas.find(a => onMs >= a.start_ms && onMs < a.end_ms);
    if (!area) return null;

    const areaLen = area.end_ms - area.start_ms;
    if (areaLen <= 0) return null;

    // Fixed length capped by the gap; otherwise the whole gap.
    const len = length != null ? Math.min(length, areaLen) : areaLen;
    // Fixed-length box follows the pointer (clamped inside the gap); the
    // full-gap box just spans the area.
    let start = length != null ? onMs : area.start_ms;
    start = Math.max(area.start_ms, Math.min(start, area.end_ms - len));

    return {
        rowUuid,
        sectionUuid: row.sectionUuid,
        start_ms: start,
        end_ms: start + len,
    };
});

// Editor-relative pixel geometry for the suggestion box — same mapping as
// renderFrame, so the box aligns 1:1 with real frames.
const suggestionStyle = computed(() => {
    const s = suggestion.value;
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

const onSuggestionClick = (event: MouseEvent) => {
    const s = suggestion.value;
    if (!s) return;
    // Don't let the click also clear the frame selection (outside-click).
    event.stopPropagation();
    emit('add-frame', s, event);
};
</script>

<template>
    <Teleport to="#editorAreaTeleports" defer>
        <div
            v-if="suggestionStyle"
            class="vtd__new-frame-suggestion"
            :style="suggestionStyle"
            @click="onSuggestionClick"
        />
    </Teleport>
</template>
