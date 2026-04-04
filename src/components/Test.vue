<script lang="ts" setup>
import { onUpdated } from 'vue';
import TestRow from './TestRow.vue';


const props = withDefaults(defineProps<{
    section: any
}>(), {
    
})

onUpdated(() => {
    console.trace('section updated', props.section.id)
})

</script>

<template>

<TestRow
    v-for="row in section.rows"
    :key="row.uuid"
    :row="row"
/>

</template>