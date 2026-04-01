<script setup lang="ts">
import { TimelineSectionInterface } from '../../../../types/timeline';


const props = withDefaults(defineProps<{
    sections: TimelineSectionInterface[],
    rowLabelWidth: number,
    rowHeight: number
}>(), {
    
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
                :key="section.id"
            >
                <div
                    class="vtd__row-label"
                    :style="{
                        height: rowHeight + 'px'
                    }"
                    v-for="row in section.rows"
                    :key="row.id"
                >
                    <span class="vtd__row-label-text">
                        {{ row.title }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>