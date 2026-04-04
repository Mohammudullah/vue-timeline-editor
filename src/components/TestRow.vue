<script lang="ts" setup>
import { onUpdated } from 'vue';
import TestFrame from './TestFrame.vue';


const props = withDefaults(defineProps<{
    row: any
}>(), {
    
})

onUpdated(() => {
    console.trace('row updated', props.row.id)
})

</script>

<template>

<TestFrame
    v-for="frame in row.frames"
    :key="frame.uuid"
    :frame="frame"
/>

</template>