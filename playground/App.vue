<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import Dnd from '../src/components/Features/Dnd.vue';
import Resize from '../src/components/Features/Resize.vue';
import Sections from '../src/components/Features/Sections.vue';
import SnapGuideLines from '../src/components/Features/SnapGuideLines.vue';
import Snapping from '../src/components/Features/Snapping.vue';
import Timeline from '../src/components/Timeline.vue';
import type { TimelineInitInterface } from '../src/components/Timeline.vue';
import JoinRows from '../src/components/Features/JoinRows.vue';
import PanScroll from '../src/components/Features/PanScroll.vue';
import Playhead from '../src/components/Features/Playhead.vue';
import '../src/styles/basic-theme.css';

// Fake server: resolves after `ms` if `shouldFail` is false; rejects otherwise.
// Toggle the constants below to exercise the success / failure paths.
const SERVER_DELAY_MS = 1500;
const SERVER_SHOULD_FAIL = false;

const fakeServerSave = <T>(payload: T): Promise<T> => new Promise((resolve, reject) => {
    console.log('[fake server] saving:', payload);
    setTimeout(() => {
        if (SERVER_SHOULD_FAIL) {
            console.warn('[fake server] failed — frame will auto-revert');
            reject(new Error('simulated server error'));
        } else {
            console.log('[fake server] saved OK');
            resolve(payload);
        }
    }, SERVER_DELAY_MS);
});

// Captured from <Timeline @init>. shallowRef so Vue doesn't try to deep-watch
// the entire feature graph — we only need the reference itself to be reactive.
const timelineApi = shallowRef<TimelineInitInterface | null>(null);

// ─── Playhead — props/v-model control ───────────────────────────────────
// Position (absolute ms) and playback state are two-way bound to <Playhead>.
// The same playhead can also be driven imperatively via
// timelineApi.value.features.data.playhead.
const playheadMs = ref(2610 * 1000);
const playheadPlaying = ref(false);

const onInit = (api: TimelineInitInterface) => {
    timelineApi.value = api;
    console.log('Timeline ready (rows shown, frames in 2s).');
    // Simulates an async fetch on app start: rows mount immediately (so the
    // user sees the empty grid right away), then the frames are loaded via
    // initSections() 2s later.
    setTimeout(() => {
        api.timeline.initSections(sections);
        console.log('Frames pushed.');
    }, 0);
};

// ─── Reactive slot data ─────────────────────────────────────────────────
// Per-row UI state keyed by row uuid. The `#rowLabel` slot template below
// closes over this ref, so mutating it re-renders the labels live — without
// touching timeline data or re-initialising sections.
const rowAccents = ref<Record<string | number, string>>({});
const tintRowLabels = () => {
    const palette = ['#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa'];
    rowAccents.value = Object.fromEntries(
        ['row1', 'row2', 'row3', 'row4', 'row5'].map(
            (uuid, i) => [uuid, palette[(i + Date.now()) % palette.length]],
        ),
    );
};

// ─── Sections / bookings demo data ──────────────────────────────────────
// 20 bookings spread across two sections, with four joined-row groups
// (rows 1+2, rows 5+6+7, rows 12+13, rows 15+16) — joined entries share a
// `linkGroupUuid` and identical start/end_ms.
//
// `emptySections` (derived below) is what mounts immediately so the rows
// are visible right away; the full `sections` (with frames) is pushed via
// `initSections()` after a 2-second simulated fetch.
const m = (mins: number) => mins * 60 * 1000;
const sections = [
    {
        title: 'Section 1',
        uuid: 'section1',
        rows: [
            {
                uuid: 'row1',
                title: 'Row 1',
                frames: [
                    { uuid: 'b1', title: 'Booking 1', start_ms: m(100), end_ms: m(180) },
                    { uuid: 'b2', title: 'Booking 2 (joined)', start_ms: m(300), end_ms: m(380), linkGroupUuid: 'g1' },
                ],
            },
            {
                uuid: 'row2',
                title: 'Row 2',
                frames: [
                    { uuid: 'b3', title: 'Booking 3 (joined)', start_ms: m(300), end_ms: m(380), linkGroupUuid: 'g1' },
                ],
            },
            {
                uuid: 'row3',
                title: 'Row 3',
                new_frame_ms: 50 * 60 * 1000,
                frames: [
                    { uuid: 'b4', title: 'Booking 4', start_ms: m(80), end_ms: m(140) },
                    { uuid: 'b5', title: 'Booking 5', start_ms: m(500), end_ms: m(580) },
                ],
            },
            {
                uuid: 'row4',
                title: 'Row 4',
                frames: [
                    { uuid: 'b6', title: 'Booking 6', start_ms: m(200), end_ms: m(260) },
                ],
            },
            {
                uuid: 'row5',
                title: 'Row 5',
                frames: [
                    { uuid: 'b7', title: 'Booking 7 (joined)', start_ms: m(450), end_ms: m(510), linkGroupUuid: 'g2' },
                ],
            },
            {
                uuid: 'row6',
                title: 'Row 6',
                frames: [
                    { uuid: 'b8', title: 'Booking 8 (joined)', start_ms: m(450), end_ms: m(510), linkGroupUuid: 'g2' },
                ],
            },
            {
                uuid: 'row7',
                title: 'Row 7',
                frames: [
                    { uuid: 'b9', title: 'Booking 9 (joined)', start_ms: m(450), end_ms: m(510), linkGroupUuid: 'g2' },
                ],
            },
            {
                uuid: 'row8',
                title: 'Row 8',
                frames: [
                    { uuid: 'b10', title: 'Booking 10', start_ms: m(600), end_ms: m(700) },
                ],
            },
            { uuid: 'row9',  title: 'Row 9',  frames: [] },
            { uuid: 'row10', title: 'Row 10', frames: [] },
        ],
    },
    {
        title: 'Section 2',
        uuid: 'section2',
        rows: [
            {
                uuid: 'row11',
                title: 'Row 11',
                frames: [
                    { uuid: 'b11', title: 'Booking 11', start_ms: m(90), end_ms: m(170) },
                ],
            },
            {
                uuid: 'row12',
                title: 'Row 12',
                frames: [
                    { uuid: 'b12', title: 'Booking 12 (joined)', start_ms: m(250), end_ms: m(320), linkGroupUuid: 'g3' },
                ],
            },
            {
                uuid: 'row13',
                title: 'Row 13',
                frames: [
                    { uuid: 'b13', title: 'Booking 13 (joined)', start_ms: m(250), end_ms: m(320), linkGroupUuid: 'g3' },
                ],
            },
            {
                uuid: 'row14',
                title: 'Row 14',
                frames: [
                    { uuid: 'b14', title: 'Booking 14', start_ms: m(400), end_ms: m(480) },
                ],
            },
            {
                uuid: 'row15',
                title: 'Row 15',
                frames: [
                    { uuid: 'b15', title: 'Booking 15 (joined)', start_ms: m(100), end_ms: m(200), linkGroupUuid: 'g4' },
                ],
            },
            {
                uuid: 'row16',
                title: 'Row 16',
                frames: [
                    { uuid: 'b16', title: 'Booking 16 (joined)', start_ms: m(100), end_ms: m(200), linkGroupUuid: 'g4' },
                ],
            },
            {
                uuid: 'row17',
                title: 'Row 17',
                frames: [
                    { uuid: 'b17', title: 'Booking 17', start_ms: m(550), end_ms: m(640) },
                ],
            },
            {
                uuid: 'row18',
                title: 'Row 18',
                frames: [
                    { uuid: 'b18', title: 'Booking 18', start_ms: m(720), end_ms: m(800) },
                ],
            },
            {
                uuid: 'row19',
                title: 'Row 19',
                frames: [
                    { uuid: 'b19', title: 'Booking 19', start_ms: m(850), end_ms: m(940) },
                ],
            },
            {
                uuid: 'row20',
                title: 'Row 20',
                frames: [
                    { uuid: 'b20', title: 'Booking 20', start_ms: m(60), end_ms: m(130) },
                ],
            },
        ],
    },
];

// Same shape as `sections` but with every row's frames stripped — used for
// the immediate mount so the grid renders right away, before initSections()
// is called with the populated data 2s later.
const emptySections = sections.map(s => ({
    ...s,
    rows: s.rows.map(r => ({ ...r, frames: [] })),
}));

// ─── Section filter test ────────────────────────────────────────────────
// Mirrors the real-app pattern: sections are loaded async via initSections(),
// and the filter is applied via the filteredSections prop afterward.
const filteredSectionIds = ref<(string | number)[] | null>(null);
const setFloorFilter = (ids: (string | number)[] | null) => {
    filteredSectionIds.value = ids;
};

// ─── Example 1 — optimistic add with server-side merge ───────────────────
// Frame appears immediately in row2 with a temp uuid. The server "assigns"
// a real uuid and the timeline swaps it in. If the server rejects, the
// optimistic frame is automatically removed.
let nextLocalId = 1;
const addOptimistic = () => {
    if (!timelineApi.value) return;
    const tempUuid = `temp-${nextLocalId++}`;
    const handle = timelineApi.value.timeline.addFrame(
        {
            uuid:        tempUuid,
            title:       `Optimistic ${nextLocalId}`,
            start_ms:    6 * 60 * 60 * 1000,
            end_ms:      8 * 60 * 60 * 1000,
            rowUuid:     'row2',
            sectionUuid: 'section1',
            meta:        { source: 'optimistic-add' },
        },
        async (frame) => {
            // Pretend the server assigns a real id and snaps the time to
            // the nearest 30 minutes.
            const server = await fakeServerSave({
                tempUuid: frame.uuid,
                start_ms: frame.start_ms,
                end_ms:   frame.end_ms,
            });
            return {
                uuid:     `server-${Date.now()}`,
                start_ms: server.start_ms,
                end_ms:   server.end_ms,
            };
        },
    );
    handle.promise
        .then(() => console.log('add → committed as', handle.uuid))
        .catch(err => console.warn('add → reverted:', err.message));
};

// ─── Example 2 — pure local add (no server) ─────────────────────────────
// CSV-import flavour: data is already trusted, just put it into state.
const addLocal = () => {
    if (!timelineApi.value) return;
    timelineApi.value.timeline.addFrame({
        uuid:        `local-${nextLocalId++}`,
        title:       'Local',
        start_ms:    8 * 60 * 60 * 1000,
        end_ms:      9 * 60 * 60 * 1000,
        rowUuid:     'row3',
        sectionUuid: 'section1',
    });
};

// ─── Example 3 — remove with server confirm + auto-revert ───────────────
const removeConfirmed = (uuid: string) => {
    if (!timelineApi.value) return;
    const handle = timelineApi.value.timeline.removeFrame(uuid, () =>
        fakeServerSave({ deleteUuid: uuid }),
    );
    handle.promise
        .then(() => console.log('remove → confirmed'))
        .catch(err => {
            console.warn('remove → restored:', err.message);
        });
};

// ─── Example 4 — pure local remove (no server) ──────────────────────────
const removeLocal = (uuid: string) => {
    timelineApi.value?.timeline.removeFrame(uuid);
};

// ─── Example 5 — click to add, then join more rows at the same time ─────
// <Sections> emits `add-frame` with the suggested range. Instead of adding
// straight away, this demo opens the "join tables" allowlist: it offers the
// SAME time slot on a few rows, dims the rest, and lets the user pick which
// rows to join. `confirmJoin` then adds a linked frame to each picked row.
type SlotRange = {
    rowUuid: string | number,
    sectionUuid: string | number,
    start_ms: number,
    end_ms: number,
};

let addedFrameId = 1;

// Allowlist state, bound to <Sections>.
const availableSlots = ref<{
    uuid: string | number,
    available_slots: { start_ms: number, end_ms: number }[],
}[]>([]);
const selectedRowUuids = ref<(string | number)[]>([]);
const pendingSlot = ref<SlotRange | null>(null);

const onAddFrame = (suggestion: SlotRange) => {
    console.log('[add-frame] suggestion received:', {
        ...suggestion,
        length_ms: suggestion.end_ms - suggestion.start_ms,
    });
    // Open the allowlist: same slot offered on the first five rows.
    pendingSlot.value = suggestion;
    selectedRowUuids.value = [suggestion.rowUuid];
    availableSlots.value = ['row1', 'row2', 'row3', 'row4', 'row5'].map(uuid => ({
        uuid,
        available_slots: [{ start_ms: suggestion.start_ms, end_ms: suggestion.end_ms }],
    }));
};

const onSelectSlot = (slot: SlotRange) => {
    console.log('[select-slot]', slot);
    selectedRowUuids.value = selectedRowUuids.value.includes(slot.rowUuid)
        ? selectedRowUuids.value.filter(u => u !== slot.rowUuid)
        : [...selectedRowUuids.value, slot.rowUuid];
};

const closeAllowlist = () => {
    availableSlots.value = [];
    selectedRowUuids.value = [];
    pendingSlot.value = null;
};

const confirmJoin = () => {
    const slot = pendingSlot.value;
    if (!slot) return;
    const linkGroupUuid = `join-${Date.now()}`;
    for (const rowUuid of selectedRowUuids.value) {
        timelineApi.value?.timeline.addFrame({
            uuid: `joined-${rowUuid}-${addedFrameId++}`,
            title: 'Joined',
            start_ms: slot.start_ms,
            end_ms: slot.end_ms,
            rowUuid,
            sectionUuid: slot.sectionUuid,
            linkGroupUuid,
        });
    }
    closeAllowlist();
};
</script>

<template>
    <div style="height: 100vh; display: flex; flex-direction: column;">
        <!-- Example bar — demonstrates timeline.addFrame / removeFrame. -->
        <div style="padding: 8px; display: flex; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid #ddd; font-size: 13px;">
            <button @click="addOptimistic" :disabled="!timelineApi">
                + Add (optimistic, server merge)
            </button>
            <button @click="addLocal" :disabled="!timelineApi">
                + Add (pure local)
            </button>
            <button @click="removeConfirmed('frame1')" :disabled="!timelineApi">
                − Remove 'frame1' (server confirm)
            </button>
            <button @click="removeLocal('frame2')" :disabled="!timelineApi">
                − Remove 'frame2' (pure local)
            </button>
            <button @click="playheadPlaying = !playheadPlaying" :disabled="!timelineApi">
                {{ playheadPlaying ? '⏸ Pause' : '▶ Play' }} playhead
            </button>
            <button
                @click="timelineApi?.features.data.playhead?.scrollIntoView()"
                :disabled="!timelineApi"
            >
                ⌖ Scroll to playhead
            </button>
            <span style="align-self: center; color: #666;">
                playhead: {{ (playheadMs / 1000).toFixed(1) }}s
            </span>
            <button @click="tintRowLabels">🎨 Tint row labels</button>
            <span style="align-self:center;color:#666;margin-left:8px;">Floor filter:</span>
            <button @click="setFloorFilter(null)" :style="{ fontWeight: !filteredSectionIds ? 'bold' : 'normal' }">All</button>
            <button @click="setFloorFilter(['section1'])" :style="{ fontWeight: filteredSectionIds?.[0] === 'section1' ? 'bold' : 'normal' }">Section 1</button>
            <button @click="setFloorFilter(['section2'])" :style="{ fontWeight: filteredSectionIds?.[0] === 'section2' ? 'bold' : 'normal' }">Section 2</button>
            <template v-if="availableSlots.length">
                <button @click="confirmJoin">
                    ✓ Confirm join ({{ selectedRowUuids.length }})
                </button>
                <button @click="closeAllowlist">✕ Cancel join</button>
            </template>
        </div>

        <Timeline
            time-axis-time-format="hh:mm a"
            @init="onInit"
            :initial-range="{
                start_seconds: 2610,
                end_seconds: 2610 + 1000 * 60,
            }"
        >
            <!-- Reactive row-label slot: reads the `rowAccents` ref above,
                 so "Tint row labels" updates these live. -->
            <template #rowLabel="{ uuid, title }">
                <span :style="{ color: rowAccents[uuid], fontWeight: 600 }">
                    {{ title }}
                </span>
            </template>

            <Sections
                row-clickable
                @add-frame="onAddFrame"
                @select-slot="onSelectSlot"
                @frame-hold="(frame) => console.log('frame held:', frame.uuid, frame.title)"
                @frame-deselected="(frame) => console.log('deselected:', frame.uuid)"
                @frame-selected="(frame) => console.log('selected:', frame.uuid)"
                :available-slots="availableSlots"
                :selected-row-uuids="selectedRowUuids"
                :sections="emptySections"
                :filtered-sections="filteredSectionIds"
            >
                <!-- Touch-mode label override — shows the proposed length. -->
                <template #label="{ length_ms }">
                    + {{ Math.round(length_ms / 60000) }} min
                </template>
            </Sections>
            <Dnd/>
            <Snapping
                @drop="(_frames, frameData) => {
                    // `process(task)` =
                    //   1. marks every affected frame pending (drag/resize blocked,
                    //      pulse animation, resize handles hidden)
                    //   2. runs `task()`
                    //   3. resolve → clears pending, frame stays at `current`
                    //   4. reject  → clears pending, auto-calls `revert()`, re-throws
                    // Flip SERVER_SHOULD_FAIL in <script setup> to test the failure path.
                    frameData.process(() => fakeServerSave(frameData.current))
                        .catch(err => console.error('drop save failed:', err))
                }"
            />
            <Resize
                @resized="(_frames, frameData) => {
                    frameData.process(() => fakeServerSave(frameData.current))
                        .catch(err => console.error('resize save failed:', err))
                }"
            />
            <SnapGuideLines/>
            <JoinRows/>
            <PanScroll/>
            <Playhead
                v-model="playheadMs"
                v-model:playing="playheadPlaying"
                :rate="60"
                loop
            />
        </Timeline>
    </div>
</template>