<script setup lang="ts">
import useUtils from '../../../../composables/utils';


const props = withDefaults(defineProps<{
    ticks: number[],
    gridGap: number,
}>(), {
    
})

const { secondsToTimeString } = useUtils();

</script>

<template>
    <div class="vtd__time-axis-minor-ticks">
        <div 
            v-for="(minorTick, index) in ticks" 
            :key="minorTick" 
            class="vtd__time-axis-minor-tick"
            :class="{
                'vtd__time-axis-minor-center-tick': index === Math.floor(ticks.length / 2)
            }"
            :style="{
                width: `${gridGap}px` 
            }"
        >
            <div 
                class="vtd__time-axis-minor-tick-content"
            >
                <span 
                    class="vtd__time-axis-minor-tick-label"
                >
                    
                </span>

            </div>
        </div>
    </div>
</template>