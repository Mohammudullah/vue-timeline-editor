<script setup lang="ts">
import { TimelineInterface } from '../../../composables/timeline';
import { TimelineConfigInterface } from '../../../composables/timelineConfig';
import TimeAxis from './TimeAxis/TimeAxis.vue';


const props = withDefaults(defineProps<{
    config: TimelineConfigInterface,
    timeline: TimelineInterface
}>(), {
    
})

</script>

<template>
    <div class="vtd__x-axis" :style="{
        height: config.cols.labelHeight + 'px',
        width: config.editor.wrapper.width + 'px'
    }">
        <div class="vtd__x-axis-y-axis-spacing"
            :style="{
                width: config.rows.labelWidth + 'px'
            }"
        >

        </div>
        <TimeAxis 
            :config="config"
            :timeline="timeline"
        />
    </div>
</template>