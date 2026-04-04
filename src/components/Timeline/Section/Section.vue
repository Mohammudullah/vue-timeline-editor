<script setup lang="ts">
import { computed, inject } from 'vue';
import { UseFeaturesType } from '../../../composables/features/features';
import { UseTimelineInterface } from '../../../composables/timeline';
import { TimelineConfigInterface } from '../../../composables/timelineConfig';
import { TimelineSectionByUuidInterface, TimelineSectionInterface } from '../../../types/timeline';
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

</script>
<template>
    <div class="vtd__timeline-section">
        <div class="vtd__timeline-section-container">
            <Rows
                :uuids="rowsUuids"
                :timeline="timeline"
                :config="config"
                :features="features"
            />
        </div>
    </div>
</template>