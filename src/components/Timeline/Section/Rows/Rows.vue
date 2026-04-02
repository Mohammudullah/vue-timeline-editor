<script setup lang="ts">
import { UseDndType } from '../../../../composables/features/dnd';
import { TimelineRowInterface } from '../../../../types/timeline';
import Row from './Row.vue';

const props = withDefaults(defineProps<{
    rows: TimelineRowInterface[],
    rowHeight: number,
    rowLabelWidth: number,
    colPixelPerMs: number,
    rowPaddingLeft?: number,
    rowPaddingRight?: number,
    rowPaddingTop?: number,
    rowPaddingBottom?: number,
    dnd: UseDndType | null,
}>(), {
   rowPaddingBottom: 0,
    rowPaddingLeft: 0,
    rowPaddingRight: 0,
    rowPaddingTop: 0
})

</script>

<template>
    <Row 
        v-for="row in props.rows" 
        :key="row.id" 
        :row="row"
        :height="props.rowHeight"
        :row-label-width="props.rowLabelWidth"
        :padding-left="props.rowPaddingLeft"
        :padding-right="props.rowPaddingRight"
        :padding-top="props.rowPaddingTop"
        :padding-bottom="props.rowPaddingBottom"
        :pixel-per-ms="props.colPixelPerMs"
        :dnd="props.dnd" 
    />
</template>