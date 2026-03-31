<script setup lang="ts">
import { TimelineInterface } from '../../../composables/timeline';
import { TimelineConfigInterface } from '../../../composables/timelineConfig';
import RowAxis from './RowAxis/RowAxis.vue';


const props = withDefaults(defineProps<{
    config: TimelineConfigInterface,
    timeline: TimelineInterface,
}>(), {
    
})

</script>

<template>
    <div class="vtd__y-axis" :style="{
        width: config.rows.labelWidth + 'px'
    }">
        <RowAxis
            :sections="timeline.sections"
            :rowLabelWidth="config.rows.labelWidth"
            :rowHeight="config.rows.height"
        />
    </div>
</template>