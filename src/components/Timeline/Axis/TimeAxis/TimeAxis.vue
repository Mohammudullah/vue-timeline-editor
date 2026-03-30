<script setup lang="ts">
import { computed } from 'vue';
import { TimelineInterface } from '../../../../composables/timeline';
import { TimelineConfigInterface } from '../../../../composables/timelineConfig';
import useUtils from '../../../../composables/utils';
import MinorTicks from './MinorTicks.vue';


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
                <span 
                    class="vtd__time-axis-major-tick-label"
                    :style="{
                        width: `${config.grids.gridGap * props.config.grids.minorGridsPerMajor}px`
                    }"
                >
                    {{ secondsToTimeString(tick / 1000) }}
                </span>

            </div>

            <MinorTicks
                v-if="config.grids.minorGridInterval > 0" 
                :ticks="minorTicks(tick)" 
                :gridGap="config.grids.gridGap"
            />
        </div>
    </div>
</template>