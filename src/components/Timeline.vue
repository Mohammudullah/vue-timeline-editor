<script setup lang="ts">
import { onMounted, provide, ref } from 'vue';
import { TimelineInterface, useTimeline, UseTimelineInterface } from '../composables/timeline';
import { TimelineRangeArgInterface, TimelineSectionInterface } from '../types/timeline';
import { TimelineConfigInterface, useTimelineConfig } from '../composables/timelineConfig';
import XAxis from './Timeline/Axis/XAxis.vue';

import '../styles/style.css';

import { TimeStringTimeFormatOptions } from '../composables/utils';
import YAxis from './Timeline/Axis/YAxis.vue';
import Section from './Timeline/Section/Section.vue';
import { useFeatures } from '../composables/features/features';
import Test from './Test.vue';


const props = withDefaults(defineProps<{
    initialRange?: TimelineRangeArgInterface,
    timeAxisTimeFormat?: TimeStringTimeFormatOptions
}>(), {
    initialRange: () => ({
        start_seconds: 0, //start at 12:00 am
        end_seconds: 24 * 60 * 60 //end at 11:59 pm
    }),
    timeAxisTimeFormat: 'HH:mm:ss'
})

const emits = defineEmits<{
    'init': [value: { config: TimelineConfigInterface, timeline: UseTimelineInterface, container: HTMLDivElement | null }],
    'scroll': [value: Event]
}>() 

const timelineContainer = ref<HTMLDivElement | null>(null)
const timelineEditor = ref<HTMLDivElement | null>(null);
const scrollPaneEl = ref<HTMLDivElement | null>(null);
const scrollLeft = ref(0);
const scrollTop = ref(0);

const timelineConfig = useTimelineConfig({
    timelineContainer,
    timelineEditor,
    scrollPaneEl,
    initialRange: () => props.initialRange,
    timeAxisTimeFormat: props.timeAxisTimeFormat,

})

const timeline = useTimeline({
    config: timelineConfig,
    container: timelineContainer,
    editor: timelineEditor,
    scrollPaneEl: scrollPaneEl,
});

const features = useFeatures({
    timeline,
    timelineConfig,
});

provide('timeline', timeline);
provide('timelineConfig', timelineConfig);
provide('features', features);

const onTimelineScroll = (event: Event) => {
    const target = event.target as HTMLDivElement | null;

    if (!target) return;

    scrollLeft.value = target.scrollLeft;
    scrollTop.value = target.scrollTop;

    emits('scroll', event)
}

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
        @contextmenu.prevent
        :style="{
            height: timelineConfig.container.height + 'px'
        }" 
        ref="timelineContainer"
    
    >

        <div class="vtd__timeline-header">
            <div
                class="vtd__timeline-header-spacer"
                :style="{
                    width: timelineConfig.rows.labelWidth + 'px',
                    height: timelineConfig.cols.labelHeight + 'px'
                }"
            />

            <div class="vtd__timeline-header-main">
                <XAxis
                    :config="timelineConfig"
                    :timeline="timeline"
                    :style="{
                        transform: `translateX(${-scrollLeft}px)`
                    }"
                />
            </div>
        </div>

        <div
            class="vtd__timeline-body"
            :style="{
                height: `calc(100% - ${timelineConfig.cols.labelHeight}px)`
            }"
        >
            <div class="vtd__timeline-y-axis-pane">
                <YAxis
                    :config="timelineConfig"
                    :timeline="timeline"
                    :style="{
                        transform: `translateY(${-scrollTop}px)`
                    }"
                />
            </div>

            <div
                class="vtd__wrapper"
                @scroll="onTimelineScroll"
                ref="scrollPaneEl"
            >
                <div
                    class="vtd__timeline-editor-area"
                    ref="timelineEditor"
                    :style="{
                        width: timelineConfig.editor.width + 'px',
                    }"
                >

                    <div 
                        class="vtd__timeline-sections"
                    >
                        <Section
                            v-for="uuid in timeline.state.sectionUuids"
                            :key="uuid"
                            :uuid="uuid"
                            :config="timelineConfig"
                            :timeline="timeline"
                            :features="features"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="vtd">
        <slot></slot>
    </div>

     <pre>
        {{ features.data.dnd }}
     </pre>
    <br/>
    <pre>
        {{ features.data.frame.state.selected }}
    </pre>

    <button
        @click="() => timeline.updateFrame('frame10', {
            uuid: 'frame10',
            title: 'Frame 11',
            start_ms: 10 * 60 * 60 * 1000,
            end_ms: 12 * 60 * 60 * 1000
        })"
    >
        Update Frame 10
    </button>
    <br>
    <button
        @click="() => timeline.updateRow('row10', {
            uuid: 'row10',
            title: 'Row 11',
        })"
    >
        Update Row 10
    </button>

    <!-- <Test
        v-for="section in timeline.state.sections"
        :key="section.uuid"
        :section="section"
    /> -->
</template>