<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref, useSlots } from 'vue';
import { useTimeline, UseTimelineInterface } from '../composables/timeline';
import { TimelineRangeArgInterface } from '../types/timeline';
import { TimelineConfigInterface, useTimelineConfig } from '../composables/timelineConfig';
import XAxis from './Timeline/Axis/XAxis.vue';

import '../styles/style.css';

import { TimeStringTimeFormatOptions } from '../composables/utils';
import YAxis from './Timeline/Axis/YAxis.vue';
import Section from './Timeline/Section/Section.vue';
import { useFeatures, UseFeaturesType } from '../composables/features/features';


const props = withDefaults(defineProps<{
    initialRange?: TimelineRangeArgInterface,
    timeAxisTimeFormat?: TimeStringTimeFormatOptions,
}>(), {
    initialRange: () => ({
        start_seconds: 0, //start at 12:00 am
        end_seconds: 24 * 60 * 60 //end at 11:59 pm
    }),
    timeAxisTimeFormat: 'HH:mm:ss',
})

export interface TimelineInitInterface {
    config: TimelineConfigInterface;
    timeline: UseTimelineInterface;
    container: HTMLDivElement | null;
    // Feature registry — exposes selection API (`features.data.frames`),
    // dnd, resize, snapping, and any other feature composable that's been
    // initialised by a mounted feature component. Use this from App.vue to
    // call methods like `features.data.frames.selectFrame(...)` or read
    // `features.data.frames.state.selectedUuids`.
    features: UseFeaturesType;
}

const emits = defineEmits<{
    'init': [value: TimelineInitInterface],
    'scroll': [value: Event]
}>() 

const timelineContainer = ref<HTMLDivElement | null>(null);
const timelineContainerParent = ref<HTMLDivElement | null>(null);

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
// Expose our own slots to descendant feature components (e.g. <Dnd/> renders
// drag ghosts and needs to honour the same #frame template the user passed
// here). Vue slots aren't naturally accessible from child components, so we
// hand them out via inject.
provide('timelineSlots', useSlots());

const onTimelineScroll = (event: Event) => {
    const target = event.target as HTMLDivElement | null;

    if (!target) return;

    scrollLeft.value = target.scrollLeft;
    scrollTop.value = target.scrollTop;

    emits('scroll', event)
}


const setContainerHeight = () => {
    timelineConfig.container.height = timelineContainerParent.value?.clientHeight ?? timelineConfig.container.height;
}

onMounted(() => {
    setContainerHeight();

    timelineContainerParent.value?.addEventListener('resize', setContainerHeight);

    emits('init', {
        config: timelineConfig,
        timeline: timeline,
        container: timelineContainer.value,
        features: features,
    })
})

onBeforeUnmount(() => {
    timelineContainerParent.value?.removeEventListener('resize', setContainerHeight);
})



</script>
<template>
    <div ref="timelineContainerParent" style="height: 100%;">
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
                    id="editorViewportTeleports"
                    class="vtd__editor-viewport-teleports"
                    :style="{
                        left: timelineConfig.rows.labelWidth + 'px'
                    }"
                ></div>

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

                        <div id="editorBackgroundTeleports" class="vtd__editor-background-teleports"></div>

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
                            >
                                <template #frame="slotProps">
                                    <slot name="frame" v-bind="slotProps" />
                                </template>
                            </Section>
                        </div>

                        <div id="editorAreaTeleports"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="vtd">
            <slot></slot>
        </div>
    </div>
</template>