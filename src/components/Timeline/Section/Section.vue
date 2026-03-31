<script setup lang="ts">
import { TimelineInterface } from '../../../composables/timeline';
import { TimelineConfigInterface } from '../../../composables/timelineConfig';
import { TimelineSectionInterface } from '../../../types/timeline';
import Rows from './Rows/Rows.vue';

const props = withDefaults(defineProps<{
    section: TimelineSectionInterface
    config: TimelineConfigInterface,
    timeline: TimelineInterface
}>(), {
   
})

</script>
<template>
    <div class="vtd__timeline-section">
        <div class="vtd__timeline-section-container" >
            <Rows
                :row-height="config.rows.height"
                :row-label-width="config.rows.labelWidth"
                :rows="section.rows"
            />
        </div>
    </div>
</template>