<script setup lang="ts">
import { computed } from 'vue';
import { UseFeaturesType } from '../../../composables/features/features';
import { UseTimelineInterface } from '../../../composables/timeline';
import { TimelineConfigInterface } from '../../../composables/timelineConfig';
import { TimelineSectionByUuidInterface } from '../../../types/timeline';
import Rows from './Rows/Rows.vue';

const props = withDefaults(defineProps<{
    config: TimelineConfigInterface,
    timeline: UseTimelineInterface,
    features: UseFeaturesType,
    uuid: string | number,
}>(), {
   
})

const rowsUuids = computed<(string | number)[]>(() => {
    return props.timeline.state.sectionRowUuids[props.uuid];
})

const section = computed<TimelineSectionByUuidInterface | null>(() => {
    return props.timeline.state.sectionsByUuid[props.uuid] || null;
})

</script>
<template>
    <div class="vtd__timeline-section">
        <div class="vtd__timeline-section-container">

            <div 
                class="vtd__section-label"
                :style="{
                    height: config.sections.labelHeight + 'px',
                    paddingLeft: config.editor.paddingLeft + 'px',
                    paddingRight: config.editor.paddingRight + 'px'
                }"
            >
                {{ section?.title }}
            </div>

            <Rows
                :uuids="rowsUuids"
                :timeline="timeline"
                :config="config"
                :features="features"
            />
        </div>
    </div>
</template>