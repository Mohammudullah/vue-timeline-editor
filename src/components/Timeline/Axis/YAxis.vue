<script setup lang="ts">
import { UseTimelineInterface } from '../../../composables/timeline';
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
                :config="config"
                :timeline="timeline"
                :sections="timeline.state.sectionsByUuid"
                :rows="timeline.state.sectionRowsByUuid"
            />
        </div>
    </div>
</template>