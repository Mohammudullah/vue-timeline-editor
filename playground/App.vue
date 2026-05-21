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
    console.log('Timeline ready. Try the buttons above the editor.');
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

// ─── Example 5 — click an empty row area to add a frame ─────────────────
// <Sections> emits `add-frame` with the suggested range; the host owns
// uuid / title / sync, so just push it into the timeline here.
let addedFrameId = 1;
const onAddFrame = (suggestion: {
    rowUuid: string | number,
    sectionUuid: string | number,
    start_ms: number,
    end_ms: number,
}) => {
    console.log('[add-frame] suggestion received:', {
        rowUuid: suggestion.rowUuid,
        sectionUuid: suggestion.sectionUuid,
        start_ms: suggestion.start_ms,
        end_ms: suggestion.end_ms,
        length_ms: suggestion.end_ms - suggestion.start_ms,
    });
    timelineApi.value?.timeline.addFrame({
        uuid: `added-${addedFrameId++}`,
        title: 'New Frame',
        start_ms: suggestion.start_ms,
        end_ms: suggestion.end_ms,
        rowUuid: suggestion.rowUuid,
        sectionUuid: suggestion.sectionUuid,
    });
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
        </div>

        <Timeline
            time-axis-time-format="hh:mm a"
            @init="onInit"
            @frame-hold="(frame) => console.log('frame held:', frame.uuid, frame.title)"
            :initial-range="{
                start_seconds: 2610,
                end_seconds: 2610 + 1000 * 60,
            }"
        >
            <Sections
                row-clickable
                @add-frame="onAddFrame"
                :sections="[{
                    title: 'Section 1',
                    uuid: 'section1',
                    rows: [
                        {   
                            uuid: 'row1',
                            title: 'Row 1',
                            frames: [{
                                uuid: 'frame1',
                                title: 'Frame 1',
                                start_ms: 0,
                                end_ms: 2 * 60 * 60 * 1000,
                                linkGroupUuid: 'group-a'
                            }]
                        },
                        {
                            uuid: 'row2',
                            title: 'Row 2',
                            frames: [
                                {
                                    uuid: 'frame2',
                                    title: 'Frame 2',
                                    start_ms: 2 * 60 * 60 * 1000,
                                    end_ms: 4 * 60 * 60 * 1000
                                },
                                {
                                    uuid: 'row2-frame3',
                                    title: 'Frame 3',
                                    start_ms: 0,
                                    end_ms: 2 * 60 * 60 * 1000,
                                    linkGroupUuid: 'group-a'
                                }
                            ]
                        },
                        {
                            uuid: 'row3',
                            title: 'Row 3',
                            // Fixed-length suggestion: hovering an empty area
                            // proposes a 2-minute frame (capped by the gap).
                            // Kept well under the ~9.8-min timeline range so
                            // the box is visibly shorter than the full row.
                            new_frame_ms: 50 * 60 * 1000,
                            frames: [{
                                uuid: 'frame3',
                                title: 'Frame 3',
                                start_ms: 4 * 60 * 60 * 1000,
                                end_ms: 6 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row4',
                            title: 'Row 4',
                            frames: [{
                                uuid: 'frame4',
                                title: 'Frame 4',
                                start_ms: 6 * 60 * 60 * 1000,
                                end_ms: 8 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row5',
                            title: 'Row 5',
                            frames: [{
                                uuid: 'frame5',
                                title: 'Frame 5',
                                start_ms: 8 * 60 * 60 * 1000,
                                end_ms: 10 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row6',
                            title: 'Row 6',
                            frames: [{
                                uuid: 'frame6',
                                title: 'Frame 6',
                                start_ms: 10 * 60 * 60 * 1000,
                                end_ms: 12 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row7',
                            title: 'Row 7',
                            frames: [{
                                uuid: 'frame7',
                                title: 'Frame 7',
                                start_ms: 8 * 60 * 60 * 1000,
                                end_ms: 10 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row8',
                            title: 'Row 8',
                            frames: [{
                                uuid: 'frame8',
                                title: 'Frame 8',
                                start_ms: 2 * 60 * 60 * 1000,
                                end_ms: 6 * 60 * 60 * 1000,
                                linkGroupUuid: 'group-b'
                            }]
                        },
                        {
                            uuid: 'row9',
                            title: 'Row 9',
                            frames: [{
                                uuid: 'frame9',
                                title: 'Frame 9',
                                start_ms: 2 * 60 * 60 * 1000,
                                end_ms: 6 * 60 * 60 * 1000,
                                linkGroupUuid: 'group-b'
                            }]
                        },
                        {
                            uuid: 'row10',
                            title: 'Row 10',
                            frames: [{
                                uuid: 'frame10',
                                title: 'Frame 10',
                                start_ms: 10 * 60 * 60 * 1000,
                                end_ms: 12 * 60 * 60 * 1000
                            }]
                        }
                    ]
                },
                {
                    title: 'Section 2',
                    uuid: 'section2',
                    rows: [
                        {
                            uuid: 'row11',
                            title: 'Row 11',
                            frames: [{
                                uuid: 'frame1-row11',
                                title: 'Frame 1',
                                start_ms: 0,
                                end_ms: 2 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row12',
                            title: 'Row 12',
                            frames: [
                                {
                                    uuid: 'frame2-row12',
                                    title: 'Frame 2',
                                    start_ms: 2 * 60 * 60 * 1000,
                                    end_ms: 4 * 60 * 60 * 1000
                                },
                                {
                                    uuid: 'frame3-row12',
                                    title: 'Frame 3',
                                    start_ms: 0,
                                    end_ms: 2 * 60 * 60 * 1000
                                }
                            ]
                        },
                        {
                            uuid: 'row13',
                            title: 'Row 13',
                            frames: [{
                                uuid: 'frame3-row13',
                                title: 'Frame 3',
                                start_ms: 4 * 60 * 60 * 1000,
                                end_ms: 6 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row14',
                            title: 'Row 14',
                            frames: [{
                                uuid: 'frame4-row14',
                                title: 'Frame 4',
                                start_ms: 6 * 60 * 60 * 1000,
                                end_ms: 8 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row15',
                            title: 'Row 15',
                            frames: [{
                                uuid: 'frame5-row15',
                                title: 'Frame 5',
                                start_ms: 8 * 60 * 60 * 1000,
                                end_ms: 10 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row16',
                            title: 'Row 16',
                            frames: [{
                                uuid: 'frame6-row16',
                                title: 'Frame 6',
                                start_ms: 10 * 60 * 60 * 1000,
                                end_ms: 12 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row17',
                            title: 'Row 17',
                            frames: [{
                                uuid: 'frame7-row17',
                                title: 'Frame 7',
                                start_ms: 8 * 60 * 60 * 1000,
                                end_ms: 10 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row18',
                            title: 'Row 18',
                            frames: [{
                                uuid: 'frame8-row18',
                                title: 'Frame 8',
                                start_ms: 2 * 60 * 60 * 1000,
                                end_ms: 6 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row19',
                            title: 'Row 19',
                            frames: [{
                                uuid: 'frame9-row19',
                                title: 'Frame 9',
                                start_ms: 8 * 60 * 60 * 1000,
                                end_ms: 9 * 60 * 60 * 1000
                            }]
                        },
                        {
                            uuid: 'row20',
                            title: 'Row 20',
                            frames: [{
                                uuid: 'frame10-row20',
                                title: 'Frame 10',
                                start_ms: 10 * 60 * 60 * 1000,
                                end_ms: 12 * 60 * 60 * 1000
                            }]
                        }
                    ]
                }]"
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