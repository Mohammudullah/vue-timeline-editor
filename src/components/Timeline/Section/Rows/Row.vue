<script setup lang="ts">
import { TimelineRowInterface } from '../../../../types/timeline';
import Frame from '../Frames/Frame.vue';


const props = withDefaults(defineProps<{
    row: TimelineRowInterface,
    height: number,
    rowLabelWidth: number,
    pixelPerMs: number,
    paddingLeft?: number
    paddingRight?: number
    paddingTop?: number
    paddingBottom?: number
}>(), {
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0
})

</script>
<template>
    <div
        class="vtd__row"
        :style="{
            height: props.height + 'px',
            paddingLeft: paddingLeft + 'px',
            paddingRight: paddingRight + 'px',
            paddingTop: paddingTop + 'px',
            paddingBottom: paddingBottom + 'px'
        }"
    >
        <Frame
            v-for="frame in row.frames"
            :pixelPerMs="pixelPerMs"
            :key="frame.id"
            :frame="frame"
            :offsetLeft="paddingLeft"
         />
    </div>
</template>