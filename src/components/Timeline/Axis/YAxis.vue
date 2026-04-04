<script setup lang="ts">
import { TimelineInterface, UseTimelineInterface } from '../../../composables/timeline';
import { TimelineConfigInterface } from '../../../composables/timelineConfig';
import RowAxis from './RowAxis/RowAxis.vue';


const props = withDefaults(defineProps<{
    config: TimelineConfigInterface,
    timeline: UseTimelineInterface,
}>(), {
    
})

</script>

<template>
    <div class="vtd__y-axis" :style="{
        width: config.rows.labelWidth + 'px'
    }">
        <div 
            class="vtd__y-axis-row-axis"
            
        >
            <RowAxis
                :sections="timeline.state.sectionsByUuid"
                :rows="timeline.state.sectionRowsByUuid"
                :rowLabelWidth="config.rows.labelWidth"
                :rowHeight="config.rows.height"
            />
        </div>
    </div>
</template>