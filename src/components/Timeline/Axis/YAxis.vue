<script setup lang="ts">
import { computed } from 'vue';
import { UseTimelineInterface } from '../../../composables/timeline';
import { TimelineConfigInterface } from '../../../composables/timelineConfig';
import { TimelineSectionByUuidInterface } from '../../../types/timeline';
import RowAxis from './RowAxis/RowAxis.vue';


const props = withDefaults(defineProps<{
    config: TimelineConfigInterface,
    timeline: UseTimelineInterface,
}>(), {

})

const visibleSections = computed<Record<string | number, TimelineSectionByUuidInterface>>(() => {
    const filter = props.timeline.state.sectionUuidFilter;
    if (!filter || filter.length === 0) return props.timeline.state.sectionsByUuid;
    const result: Record<string | number, TimelineSectionByUuidInterface> = {};
    filter.forEach(uuid => {
        if (props.timeline.state.sectionsByUuid[uuid]) {
            result[uuid] = props.timeline.state.sectionsByUuid[uuid];
        }
    });
    return result;
});

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
                :sections="visibleSections"
                :rows="timeline.state.sectionRowsByUuid"
            />
        </div>
    </div>
</template>