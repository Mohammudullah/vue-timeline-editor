<script setup lang="ts">
import { TimelineRowInterface } from '../../../../types/timeline';


const props = withDefaults(defineProps<{
    row: TimelineRowInterface,
    height: number,
    rowLabelWidth: number
}>(), {
   
})

</script>
<template>
    <div
        class="vtd__timeline-editor-row"
        :style="{
            height: props.height + 'px',
        }"
    >
        
    </div>
</template>