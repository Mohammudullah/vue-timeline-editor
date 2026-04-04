<script setup lang="ts">
import Dnd from '../src/components/Features/Dnd.vue';
import Sections from '../src/components/Features/Sections.vue';
import UseSnapping from '../src/components/Features/UseSnapping.vue';
import Timeline from '../src/components/Timeline.vue';
import '../src/styles/basic-theme.css';

</script>

<template>
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
                            end_ms: 2 * 60 * 60 * 1000
                        }]
                    },
                    {
                        uuid: 'row2',
                        title: 'Row 2',
                        frames: [{
                            uuid: 'frame2',
                            title: 'Frame 2',
                            start_ms: 2 * 60 * 60 * 1000,
                            end_ms: 4 * 60 * 60 * 1000
                        }]
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
                            end_ms: 6 * 60 * 60 * 1000
                        }]
                    },
                    {
                        uuid: 'row9',
                        title: 'Row 9',
                        frames: [{
                            uuid: 'frame9',
                            title: 'Frame 9',
                            start_ms: 8 * 60 * 60 * 1000,
                            end_ms: 9 * 60 * 60 * 1000
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
            }]"
        />
        <Dnd/>
        <UseSnapping/>
    </Timeline>
</template>