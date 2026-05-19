<script setup lang="ts">
import { computed } from 'vue';
import { UseTimelineInterface } from '../../../../composables/timeline';
import { TimelineConfigInterface } from '../../../../composables/timelineConfig';
import useUtils from '../../../../composables/utils';
import MinorTicks from './MinorTicks.vue';


const props = withDefaults(defineProps<{
    config: TimelineConfigInterface,
    timeline: UseTimelineInterface
}>(), {
   
})

const { secondsToTimeString } = useUtils();

const minorTicks = (majorTick: number): number[] => {
    const ticks: number[] = [];

    if(majorTick >= props.config.range.end_seconds! * 1000) {
        return ticks; // No minor ticks if the major tick is at or beyond the end of the timeline
    }

    for (let i = 1; i < props.config.cols.minorGridsPerMajor; i++) {
        ticks.push(majorTick + i * props.config.cols.minorGridInterval);
    }

    return ticks;
}

const endSeconds = computed<number>(() => {
    return props.config.range.end_seconds ? (props.config.range.end_seconds * 1000) : (24 * 60 * 60 * 1000);
})

// Absolute-time start of the viewport. `start_seconds` is a HARD rule —
// ticks before it aren't rendered and frame positions are offset against it.
// `end_seconds` is currently still a hard upper bound here but is intended
// to become a soft cap (frames past it can render) — when that lands, only
// the loop's upper bound changes; the lower bound stays as-is.
const startMs = computed<number>(() => (props.config.range.start_seconds ?? 0) * 1000);

const majorTicks = computed<number[]>(() => {
    const ticks: number[] = [];

    // First tick anchors at exactly `startMs` so the editor's left edge maps
    // 1:1 to the label that sits there (the flex layout positions ticks by
    // index, so any other anchor would desync labels from real time).
    // Consumers who want a "round" first label should set start_seconds
    // to a value that already aligns to majorGridInterval.
    for (let i = startMs.value; i < endSeconds.value; i += props.config.cols.majorGridInterval) {
        ticks.push(i);
    }

    return ticks;
})


const majorGridsWidth = computed<number>(() => {
    return props.config.cols.width * props.config.cols.minorGridsPerMajor;
})

</script>

<template>
    <div 
        class="vtd__time-axis"
        :style="{
            width: `${config.editor.width}px`,
            paddingLeft: `${config.editor.paddingLeft}px`,
            paddingRight: `${config.editor.paddingRight}px`,
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
                    width: `${config.cols.width}px` 
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
                :gridGap="config.cols.width"
            />
        </div>
    </div>
</template>