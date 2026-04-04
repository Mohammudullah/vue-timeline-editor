<script lang="ts" setup>
import { onUpdated } from 'vue';


const props = withDefaults(defineProps<{
    frame: any
}>(), {

})

onUpdated(() => {
    console.trace('frame updated', props.frame.id)
})

</script>

<template>

<div>
    {{ frame.title }}
</div>

</template>