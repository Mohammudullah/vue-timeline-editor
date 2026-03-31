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
    <div class="vtd__timeline-editor-row-axis">
        <div 
            class="vtd__timeline-editor-row-axis-sections"
        >
            <div 
                class="vtd__timeline-editor-row-axis-section"
                v-for="section in sections"
                :key="section.id"
            >
                <div
                    class="vtd__timeline-editor-row-label"
                    :style="{
                        width: rowLabelWidth + 'px',
                        height: rowHeight + 'px'
                    }"
                    v-for="row in section.rows"
                    :key="row.id"
                >
                    {{ row.title }}
                </div>
            </div>
        </div>
    </div>
</template>