<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { TimelineInterface, useTimeline } from '../composables/timeline';
import { TimelineRangeArgInterface, TimelineSectionInterface } from '../types/timeline';
import { TimelineConfigInterface, useTimelineConfig } from '../composables/timelineConfig';
import XAxis from './Timeline/Axis/XAxis.vue';

import '../styles/style.css';
import { TimeStringTimeFormatOptions } from '../composables/utils';
import YAxis from './Timeline/Axis/YAxis.vue';
import Section from './Timeline/Section/Section.vue';


const props = withDefaults(defineProps<{
    initialRange?: TimelineRangeArgInterface,
    sections: TimelineSectionInterface[],
    timeAxisTimeFormat?: TimeStringTimeFormatOptions
}>(), {
    initialRange: () => ({
        start_seconds: 0, //start at 12:00 am
        end_seconds: 24 * 60 * 60 //end at 11:59 pm
    }),
    timeAxisTimeFormat: 'HH:mm:ss'
})

const emits = defineEmits<{
    'init': [value: { config: TimelineConfigInterface, timeline: TimelineInterface, container: HTMLDivElement | null }],
    'scrollX': [value: Event],
    'scrollY': [value: Event]
}>() 

const timelineContainer = ref<HTMLDivElement | null>(null)
const timelineEditor = ref<HTMLDivElement | null>(null);
const scrollXEl = ref<HTMLDivElement | null>(null);
const scrollYEl = ref<HTMLDivElement | null>(null);

const timelineConfig = useTimelineConfig({
    timelineContainer,
    timelineEditor,
    scrollXEl,
    scrollYEl,
    initialRange: () => props.initialRange,
    timeAxisTimeFormat: props.timeAxisTimeFormat,

})

const timeline = useTimeline({
    config: timelineConfig,
    sections: () => props.sections,
});

onMounted(() => {
    emits('init', {
        config: timelineConfig,
        timeline: timeline,
        container: timelineContainer.value
    })
})

</script>
<template>
    <div 
        class="vtd__timeline-container vtd"
        :style="{
            height: timelineConfig.container.height + 'px'
        }" 
        ref="timelineContainer"
    
    >

        <div 
            class="vtd__timeline-editor-wrapper"
            @scroll="(event) => emits('scrollX', event)"
            ref="scrollXEl"
            :style="{
                width: timelineConfig.editor.wrapper.width + 'px',
            }"
        >
            <XAxis
                :config="timelineConfig"
                :timeline="timeline"
            />

            <div 
                class="vtd__timeline-editor-wrapper-inner"
                @scroll="(event) => emits('scrollY', event)"
                ref="scrollYEl"                                                                                                                                                                                                                                                                                                                                                                                                                                 
                :style="{
                    width: timelineConfig.editor.wrapper.width + 'px',
                    height: `calc(100% - ${timelineConfig.cols.labelHeight}px)`
                }"

            >
                <YAxis
                    :config="timelineConfig"
                    :timeline="timeline"
                />

                <div
                    class="vtd__timeline-editor-area"
                    ref="timelineEditor"
                    :style="{
                        width: timelineConfig.editor.axis.x.width + 'px',
                    }"
                >

                    <div 
                        class="vtd__timeline-sections"
                    >
                        <Section
                            v-for="section in timeline.sections"
                            :key="section.id"
                            :section="section"
                            :config="timelineConfig"
                            :timeline="timeline"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>