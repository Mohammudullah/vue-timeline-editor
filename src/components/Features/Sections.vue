<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useFeatures } from '../../composables/features/features';
import { TimelineFrameByUuidInterface, TimelineSectionInterface } from '../../types/timeline';

/**
 * <Sections/>
 *
 * Initialises the timeline's section/row/frame data, and provides two
 * empty-area interactions:
 *
 *  1. Click-to-add — an empty row area shows a dashed suggestion box;
 *     activating it emits `add-frame`. Per row, the box length is
 *     `row.new_frame_ms` ms (capped by the gap), or the whole gap when the
 *     `rowClickable` prop is on. Touch uses a two-tap latch.
 *
 *  2. Allowlist / slot-picking — when `availableSlots` is passed, the rest of
 *     the editor is dimmed and locked, and only the listed time slots stay
 *     clear and clickable. Clicking one emits `select-slot`; slots present in
 *     `selectedTables` render in a selected style. This mode replaces the
 *     click-to-add interaction while it's active.
 */
const props = withDefaults(defineProps<{
    sections: TimelineSectionInterface[],
    // Global enable for the empty-area suggestion. A row with its own
    // `new_frame_ms` is suggestible even when this is false.
    rowClickable?: boolean,
    // Touch-mode label text. Overridden entirely by the `#label` slot.
    newFrameLabel?: string,
    // Allowlist: per-table (row) time windows the user may pick. When set,
    // the editor dims/locks and only these slots stay interactive. The
    // typical use is joining tables — a join is only valid at the same time,
    // so the allowlist confines picking to the matching slots.
    availableSlots?: AvailableTableSlots[],
    // The currently-picked table+slot pairs — rendered in a selected style.
    selectedTables?: SelectedTableSlot[],
    // Row uuids whose allowed slots render selected — a simpler alternative
    // to `selectedTables` when every pick shares the same time (e.g. a join).
    selectedRowUuids?: (string | number)[],
    // Press-and-hold duration (ms) before `frame-hold` fires.
    frameHoldDuration?: number,
    // Movement tolerance (px) past which a hold is treated as a drag and cancelled.
    frameHoldThreshold?: number,
    // When true, `frame-selected` / `frame-deselected` only fire for user-
    // driven changes (clicks, outside-click deselect). Programmatic changes
    // (selectByUuid, scrollToViewPort(_, _, true), API calls, auto-cleanup
    // after removeFrame, etc.) are silent.
    silentExternalSelection?: boolean,
}>(), {
    rowClickable: false,
    newFrameLabel: '+ Add',
    frameHoldDuration: 600,
    frameHoldThreshold: 8,
    silentExternalSelection: false,
});

export interface NewFrameSuggestion {
    rowUuid: string | number,
    sectionUuid: string | number,
    start_ms: number,
    end_ms: number,
}

// One table (row) and the time windows that are selectable on it.
export interface AvailableTableSlots {
    uuid: string | number,
    available_slots: { start_ms: number, end_ms: number }[],
}

// A picked table+slot pair.
export interface SelectedTableSlot {
    uuid: string | number,
    start_ms: number,
    end_ms: number,
}

const emit = defineEmits<{
    'add-frame': [suggestion: NewFrameSuggestion, event: MouseEvent],
    'select-slot': [slot: NewFrameSuggestion, event: MouseEvent],
    'clear-allowlist': [event: MouseEvent],
    // Press-and-hold gesture (see `frameHoldDuration` / `frameHoldThreshold`).
    'frame-hold': [frame: TimelineFrameByUuidInterface, event: PointerEvent],
    // Selection-change events. When the user switches from frame A to frame
    // B, `frame-deselected(A)` is always fired BEFORE `frame-selected(B)`.
    'frame-selected': [frame: TimelineFrameByUuidInterface],
    'frame-deselected': [frame: TimelineFrameByUuidInterface],
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

// ─── Frame interaction events ───────────────────────────────────────────
// Press-and-hold — surfaced as `frame-hold`.
if (features) {
    features.data.frames.setHoldDuration(props.frameHoldDuration);
    features.data.frames.setHoldThreshold(props.frameHoldThreshold);
    features.data.frames.onFrameHold((frame, event) => emit('frame-hold', frame, event));
}
watch(() => props.frameHoldDuration, (ms) =>
    features?.data.frames.setHoldDuration(ms));
watch(() => props.frameHoldThreshold, (px) =>
    features?.data.frames.setHoldThreshold(px));

// Selection-change emits. The watcher fires once per primary-uuid change;
// emitting deselected FIRST and selected SECOND inside the same callback
// guarantees the user-facing order (Vue emits are synchronous, so handlers
// run in this exact sequence). When `silentExternalSelection` is on,
// programmatic changes (API calls) are skipped.
watch(
    () => features?.data.frames.state.primary.uuid ?? null,
    (newUuid, oldUuid) => {
        if (newUuid === oldUuid) return;
        if (props.silentExternalSelection
            && features?.data.frames.getLastSelectionSource() === 'programmatic') {
            return;
        }
        if (oldUuid != null) {
            const f = timeline?.state.sectionFramesByUuid[oldUuid];
            if (f) emit('frame-deselected', f);
        }
        if (newUuid != null) {
            const f = timeline?.state.sectionFramesByUuid[newUuid];
            if (f) emit('frame-selected', f);
        }
    },
);

// ─── Allowlist (slot-picking) mode ──────────────────────────────────────
const allowlistActive = computed(() => (props.availableSlots?.length ?? 0) > 0);

interface AllowedSlotRect {
    rowUuid: string | number,
    sectionUuid: string | number,
    start_ms: number,
    end_ms: number,
    left: number,
    top: number,
    width: number,
    height: number,
    selected: boolean,
}

// Editor-relative pixel rectangles for every allowed slot, with their
// selected state resolved against `selectedTables`.
const allowedSlots = computed<AllowedSlotRect[]>(() => {
    if (!timeline || !timelineConfig || !props.availableSlots) return [];

    const rangeStartMs = (timelineConfig.range.start_seconds ?? 0) * 1000;
    const ppms = timelineConfig.cols.pixelPerMs;
    const padLeft = timelineConfig.editor.paddingLeft;
    const rowHeight = timelineConfig.rows.height;
    const selected = props.selectedTables ?? [];
    const selectedRows = props.selectedRowUuids ?? [];

    const out: AllowedSlotRect[] = [];
    for (const table of props.availableSlots) {
        const row = timeline.state.sectionRowsByUuid[table.uuid];
        if (!row) continue;
        for (const slot of table.available_slots) {
            out.push({
                rowUuid: table.uuid,
                sectionUuid: row.sectionUuid,
                start_ms: slot.start_ms,
                end_ms: slot.end_ms,
                left: (slot.start_ms - rangeStartMs) * ppms + padLeft,
                top: row.editorRelativeTop,
                width: (slot.end_ms - slot.start_ms) * ppms,
                height: rowHeight,
                selected: selectedRows.includes(table.uuid)
                    || selected.some(t =>
                        t.uuid === table.uuid
                        && t.start_ms === slot.start_ms
                        && t.end_ms === slot.end_ms),
            });
        }
    }
    return out;
});

const editorWidth = computed(() => timelineConfig?.editor.width ?? 0);
const editorHeight = computed(() => timelineConfig?.editor.height ?? 0);

const onSlotClick = (slot: AllowedSlotRect, event: MouseEvent) => {
    emit('select-slot', {
        rowUuid: slot.rowUuid,
        sectionUuid: slot.sectionUuid,
        start_ms: slot.start_ms,
        end_ms: slot.end_ms,
    }, event);
};

// ─── Click-to-add suggestion ────────────────────────────────────────────
// `true` while the last pointer interaction was touch — touch has no hover,
// so it uses the latched two-tap flow instead.
const isTouch = ref(false);
// Pointer-over-editor gate for mouse/pen. `timeline.state.pointer` keeps its
// last value after the pointer leaves, so a hover flag is needed.
const hovering = ref(false);
// Latched suggestion for touch — frozen at the tap position.
const touchSuggestion = ref<NewFrameSuggestion | null>(null);

// Pure computation: the suggestion for a given row + pointer-ms, or null when
// that spot isn't a suggestible empty gap. Shared by hover and touch.
const computeSuggestionAt = (
    rowUuid: string | number | null,
    onMs: number,
): NewFrameSuggestion | null => {
    if (!timeline || !timelineConfig) return null;
    // Click-to-add is disabled while the allowlist owns the editor.
    if (allowlistActive.value) return null;
    if (rowUuid == null) return null;

    const row = timeline.state.sectionRowsByUuid[rowUuid];
    if (!row) return null;

    // `pointer.over.rowUuid` is the NEAREST row by Y, so it stays set even
    // when the pointer is inside a section-header band between rows. Gate
    // strictly: only suggest when the pointer's Y is actually inside the
    // row's vertical band.
    const py = timeline.state.pointer.editorRelativeY;
    if (py < row.editorRelativeTop || py >= row.editorRelativeBottom) return null;

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
    // Fixed-length box starts at the cursor (left-aligned); the clamp below
    // shifts it left if it would overflow the gap's right edge. Full-gap box
    // spans the whole area unchanged.
    let start = length != null ? onMs : area.start_ms;

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

// The suggestion currently in effect — null while the allowlist is active.
const activeSuggestion = computed<NewFrameSuggestion | null>(() => {
    if (allowlistActive.value) return null;
    return isTouch.value ? touchSuggestion.value : hoverSuggestion.value;
});

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
        <!-- Click-to-add suggestion box -->
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

        <!-- Allowlist mode: dim + lock the editor, keep allowed slots clear -->
        <template v-if="allowlistActive">
            <!-- Lock layer — eats pointer events on the dimmed area. -->
            <div
                class="vtd__allowlist-lock"
                :style="{ width: editorWidth + 'px', height: editorHeight + 'px' }"
                @pointerdown.stop
                @click.stop="emit('clear-allowlist', $event)"
            />

            <!-- Dark mask with the allowed slots punched out as holes. -->
            <svg
                class="vtd__allowlist-mask"
                :width="editorWidth"
                :height="editorHeight"
            >
                <defs>
                    <mask id="vtd-allowlist-mask">
                        <rect :width="editorWidth" :height="editorHeight" fill="white" />
                        <rect
                            v-for="(slot, i) in allowedSlots"
                            :key="`hole-${i}`"
                            :x="slot.left"
                            :y="slot.top"
                            :width="slot.width"
                            :height="slot.height"
                            rx="6"
                            fill="black"
                        />
                    </mask>
                </defs>
                <rect
                    class="vtd__allowlist-mask-fill"
                    :width="editorWidth"
                    :height="editorHeight"
                    mask="url(#vtd-allowlist-mask)"
                />
            </svg>

            <!-- Clickable allowed-slot boxes. -->
            <div
                v-for="(slot, i) in allowedSlots"
                :key="`slot-${i}`"
                class="vtd__allowlist-slot"
                :class="{ 'vtd__allowlist-slot--selected': slot.selected }"
                :style="{
                    left: slot.left + 'px',
                    top: slot.top + 'px',
                    width: slot.width + 'px',
                    height: slot.height + 'px',
                }"
                @pointerdown.stop
                @click.stop="onSlotClick(slot, $event)"
            />
        </template>
    </Teleport>
</template>
