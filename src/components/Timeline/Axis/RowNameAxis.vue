<script setup lang="ts">

const props = withDefaults(defineProps<{
    axis: 'x' | 'y'
}>(), {
    axis: 'y'
})

</script>

<template>
    <div>
        TimeAxis
    </div>
</template>