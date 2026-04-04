<script setup lang="ts">
import { inject, onMounted } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineSectionInterface } from '../../types/timeline';


const props = withDefaults(defineProps<{
    sections: TimelineSectionInterface[]
}>(), {
    
})


const timeline = inject<UseTimelineInterface>('timeline');


onMounted(() => {
    timeline?.initSections(props.sections);
})

</script>

<template>

</template>