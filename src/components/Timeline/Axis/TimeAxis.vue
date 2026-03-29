<script setup lang="ts">
import { computed } from 'vue';
import { TimelineInterface } from '../../../composables/timeline';
import { TimelineConfigInterface } from '../../../composables/timelineConfig';
import useUtils from '../../../composables/utils';


const props = withDefaults(defineProps<{
    config: TimelineConfigInterface,
    timeline: TimelineInterface
}>(), {
   
})

const { secondsToTimeString, secondsToDayTimeString } = useUtils();

const minorTicks = (majorTick: number): number[] => {
    const ticks: number[] = [];
    for (let i = 1; i < props.config.grids.minorGridsPerMajor; i++) {
        ticks.push(majorTick + i * props.config.grids.minorGridInterval * 1000);
    }
    return ticks;
}

const endSeconds = computed<number>(() => {
    return props.timeline.range.end_seconds ? props.timeline.range.end_seconds : 24 * 60 * 60 * 1000;
})

const majorTicks = computed<number[]>(() => {
    const ticks: number[] = [];

    for (let i = 0; i <= endSeconds.value; i += props.config.grids.majorGridInterval) {
        ticks.push(i * 1000); // Convert to milliseconds
    }
    return ticks;
})

</script>

<template>
    <div class="vtd__time-axis">
        <div 
            v-for="tick in majorTicks" 
            :key="tick" 
            class="vtd__time-axis-major-tick"
            :style="{
                width: `${config.grids.gridGap * props.config.grids.minorGridsPerMajor}px`
            }"
        >
            <div 
                class="vtd__time-axis-major-tick-content"
                :style="{
                    width: `${config.grids.gridGap}px` 
                }"
            >
                | <span 
                    class="vtd__time-axis-major-tick-label"
                    :style="{
                        width: `${config.grids.gridGap * props.config.grids.minorGridsPerMajor}px`
                    }"
                >
                    {{ secondsToTimeString(tick / 1000) }}
                </span>

            </div>

            <div v-if="config.grids.minorGridInterval > 0" class="vtd__time-axis-minor-ticks">
                <div 
                    v-for="minorTick in minorTicks(tick)" 
                    :key="minorTick" 
                    class="vtd__time-axis-minor-tick"
                    :style="{
                        width: `${config.grids.gridGap}px` 
                    }"
                >
                    |
                </div>
            </div>
        </div>
    </div>
</template>