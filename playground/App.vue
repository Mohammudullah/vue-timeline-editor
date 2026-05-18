<script setup lang="ts">
import Dnd from '../src/components/Features/Dnd.vue';
import Resize from '../src/components/Features/Resize.vue';
import Sections from '../src/components/Features/Sections.vue';
import SnapGuideLines from '../src/components/Features/SnapGuideLines.vue';
import Snapping from '../src/components/Features/Snapping.vue';
import Timeline from '../src/components/Timeline.vue';
import JoinRows from '../src/components/Features/JoinRows.vue';
import PanScroll from '../src/components/Features/PanScroll.vue';
import '../src/styles/basic-theme.css';

</script>

<template>
    <div style="height: 100vh;">
        <Timeline 
            time-axis-time-format="hh:mm a"
        >
            <Sections
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
            />
            <Dnd/>
            <Snapping
                @drop="(frames, frameData, event) => {
                    frameData.revert()
                }"
            />
            <Resize/>
            <SnapGuideLines/>
            <JoinRows/>
            <PanScroll/>
        </Timeline>
    </div>
</template>