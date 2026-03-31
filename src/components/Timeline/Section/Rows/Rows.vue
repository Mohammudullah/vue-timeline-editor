<script setup lang="ts">
import { TimelineRowInterface } from '../../../../types/timeline';
import Row from './Row.vue';

const props = withDefaults(defineProps<{
    rows: TimelineRowInterface[],
    rowHeight: number,
    rowLabelWidth: number
}>(), {
   
})

</script>

<template>
    <Row 
        v-for="row in props.rows" 
        :key="row.id" 
        :row="row"
        :height="props.rowHeight"
        :row-label-width="props.rowLabelWidth"
    />
</template>