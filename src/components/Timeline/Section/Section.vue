<script setup lang="ts">
import { inject } from 'vue';
import { FeaturesInterface, UseFeaturesType } from '../../../composables/features/features';
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

const features = inject<UseFeaturesType>('features');

</script>
<template>
    <div class="vtd__timeline-section">
        <div class="vtd__timeline-section-container" >
            <Rows
                :row-height="config.rows.height"
                :row-label-width="config.rows.labelWidth"
                :row-padding-right="config.editor.paddingRight"
                :row-padding-left="config.editor.paddingLeft"
                :rows="section.rows"
                :col-pixel-per-ms="config.cols.pixelPerMs"
                :dnd="features?.data.dnd || null"
            />
        </div>
    </div>
</template>