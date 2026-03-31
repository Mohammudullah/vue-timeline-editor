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

const { secondsToTimeString } = useUtils();

const minorTicks = (majorTick: number): number[] => {
    const ticks: number[] = [];

    if(majorTick >= props.config.range.end_seconds! * 1000) {
        return ticks; // No minor ticks if the major tick is at or beyond the end of the timeline
    }

    for (let i = 1; i < props.config.cols.minorGridsPerMajor; i++) {
        ticks.push(majorTick + i * props.config.cols.minorGridInterval * 1000);
    }

    return ticks;
}

const endSeconds = computed<number>(() => {
    return props.config.range.end_seconds ? props.config.range.end_seconds : 24 * 60 * 60 * 1000;
})

const majorTicks = computed<number[]>(() => {
    const ticks: number[] = [];

    for (let i = 0; i <= endSeconds.value; i += props.config.cols.majorGridInterval) {
        if(i >= endSeconds.value) {
            break; // Stop if the next major tick exceeds the end of the timeline
        }

        ticks.push(i * 1000); // Convert to milliseconds
    }

    console.log('majorTicks', ticks)
    return ticks;
})


const majorGridsWidth = computed<number>(() => {
    return props.config.cols.gap * props.config.cols.minorGridsPerMajor;
})

</script>

<template>
    <div 
        class="vtd__time-axis"
        :style="{
            width: `${config.cols.totalPixels}px`
        }"
    >
        <div 
            v-for="tick in majorTicks" 
            :key="tick" 
            class="vtd__time-axis-major-tick"
            :style="{
                width: `${majorGridsWidth}px`
            }"
        >
            <div 
                class="vtd__time-axis-major-tick-content"
                :style="{
                    width: `${config.cols.gap}px` 
                }"
            >
                <span 
                    class="vtd__time-axis-major-tick-label"
                    :style="{
                        width: `${majorGridsWidth}px`
                    }"
                >
                    {{ secondsToTimeString({
                        seconds: tick / 1000, // Convert back to seconds
                        format: props.config.timeAxis.timeFormat
                    }) }}
                </span>

            </div>

            <MinorTicks
                v-if="config.cols.minorGridInterval > 0" 
                :ticks="minorTicks(tick)" 
                :gridGap="config.cols.gap"
            />
        </div>
    </div>
</template>