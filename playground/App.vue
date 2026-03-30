<script setup lang="ts">
import Timeline from '../src/components/Timeline.vue';
import '../src/styles/basic-theme.css';

</script>

<template>
    <Timeline 
        :sections="[{
            title: 'Section 1',
            rows: [{
                id: 'row1',
                title: 'Row 1',
                frames: [{
                    id: 'frame1',
                    title: 'Frame 1',
                    start_seconds: 0,
                    end_seconds: 60 * 60 * 1000
                }]
            }]
        }]"
    />
</template>