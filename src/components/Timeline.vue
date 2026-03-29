<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { TimelineInterface, useTimeline } from '../composables/timeline';
import { TimelineRangeInterface, TimelineSectionInterface } from '../types/timeline';
import { TimelineConfigInterface, useTimelineConfig } from '../composables/timelineConfig';
import XAxis from './Timeline/Axis/XAxis.vue';

import '../styles/style.css';
import '../styles/basic-theme.css';


const props = withDefaults(defineProps<{
    range?: TimelineRangeInterface,
    sections: TimelineSectionInterface[]
}>(), {
    range: () => ({
        start_seconds: 0, //start at 12:00 am
        end_seconds: 24 * 60 * 60 //end at 11:59 pm
    }),
})

const emits = defineEmits<{
    'init': [value: { config: TimelineConfigInterface, timeline: TimelineInterface, container: HTMLDivElement | null }]
}>() 

const timelineContainer = ref<HTMLDivElement | null>(null)

const timelineConfig = useTimelineConfig({
    timelineContainer,
})

const timeline = useTimeline({
    config: timelineConfig,
    range: () => props.range,
    sections: () => props.sections,
});

onMounted(() => {
    emits('init', {
        config: timelineConfig,
        timeline: timeline,
        container: timelineContainer.value
    })
})

</script>
<template>
    <div class="vtd__timeline-container" ref="timelineContainer">
        
        <XAxis
            :config="timelineConfig"
            :timeline="timeline"
        />

        <div class="vtd__timeline-section">
            <div class="vtd__timeline-section-container" >
                {{ timelineConfig.container.width }}
            </div>
        </div>
    </div>
</template>