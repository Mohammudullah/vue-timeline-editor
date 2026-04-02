<script setup lang="ts">
import { inject } from 'vue';
import { TimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';


const timeline = inject<TimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');

</script>

<template>
{{ timeline }}
</template>