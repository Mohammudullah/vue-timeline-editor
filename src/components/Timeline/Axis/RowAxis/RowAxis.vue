<script setup lang="ts">
import { computed } from 'vue';
import { TimelineRowByUuidInterface, TimelineSectionByUuidInterface, TimelineSectionInterface } from '../../../../types/timeline';


const props = withDefaults(defineProps<{
    sections: Record<string | number, TimelineSectionByUuidInterface>,
    rows: Record<string | number, TimelineRowByUuidInterface>,
    rowLabelWidth: number,
    rowHeight: number
}>(), {
    
})

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
                    class="vtd__row-label"
                    :style="{
                        height: rowHeight + 'px'
                    }"
                    v-for="row in rowGroupedBySection[section.uuid]"
                    :key="row.uuid"
                >
                    <span class="vtd__row-label-text">
                        {{ row.title }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>