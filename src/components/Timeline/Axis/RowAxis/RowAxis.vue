<script setup lang="ts">
import { computed, inject } from 'vue';
import type { Slots } from 'vue';
import { TimelineRowByUuidInterface, TimelineSectionByUuidInterface } from '../../../../types/timeline';
import { UseTimelineInterface } from '../../../../composables/timeline';
import { TimelineConfigInterface } from '../../../../composables/timelineConfig';


const props = withDefaults(defineProps<{
    sections: Record<string | number, TimelineSectionByUuidInterface>,
    rows: Record<string | number, TimelineRowByUuidInterface>,
    timeline: UseTimelineInterface,
    config: TimelineConfigInterface
}>(), {

})

// Slots passed to <Timeline>. The `rowLabel` slot lets consumers fully
// replace a row's label. It re-renders reactively when state the consumer's
// slot template closes over changes — only `uuid` needs to come from here.
const timelineSlots = inject<Slots>('timelineSlots');
const RowLabel = (slotProps: Record<string, unknown>) =>
    timelineSlots?.rowLabel?.(slotProps) ?? null;

const rowGroupedBySection = computed<Record<string | number, TimelineRowByUuidInterface[]>>(() => {
    const grouped: Record<string | number, TimelineRowByUuidInterface[]> = {};

    Object.values(props.sections).forEach(section => {
        grouped[section.uuid] = [];

        Object.values(props.rows).forEach(row => {
            if(row.sectionUuid === section.uuid) {
                grouped[section.uuid].push(row);
            }
        })
    })

    return grouped;
})

</script>

<template>
    <div class="vtd__row-axis">
        <div 
            class="vtd__row-axis-sections"
        >
            <div 
                class="vtd__row-axis-section"
                v-for="section in sections"
                :key="section.uuid"
            >

                <div 
                    class="vtd__row-axis-section-label"
                    :style="{
                        height: config.sections.labelHeight + 'px'
                    }"
                >

                </div>

                <div
                    class="vtd__row-label"
                    :style="{
                        height: config.rows.height + 'px'
                    }"
                    v-for="row in rowGroupedBySection[section.uuid]"
                    :key="row.uuid"
                >
                    <RowLabel
                        v-if="timelineSlots?.rowLabel"
                        :uuid="row.uuid"
                        :title="row.title"
                        :section-uuid="section.uuid"
                    />
                    <span v-else class="vtd__row-label-text">
                        {{ row.title }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>