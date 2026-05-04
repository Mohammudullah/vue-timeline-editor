<script setup lang="ts">
import { UseTimelineInterface } from '../../../../composables/timeline';
import { TimelineFrameByUuidInterface } from '../../../../types/timeline';
import Row from './Row.vue';
import { TimelineConfigInterface } from '../../../../composables/timelineConfig';
import { UseFeaturesType } from '../../../../composables/features/features';

const props = withDefaults(defineProps<{
    timeline: UseTimelineInterface,
    config: TimelineConfigInterface,
    features: UseFeaturesType,
    uuids: (string | number)[]
}>(), {
    
})

const frameClick = (event : PointerEvent, frame: TimelineFrameByUuidInterface, container: HTMLDivElement, uuid: string | number) => {
    props.features.data.frames.toggleFrame(event, frame, container, uuid)
}

const frameContainerUpdate = (container: HTMLDivElement | null, frame: TimelineFrameByUuidInterface, uuid: string | number) => {
    props.features.data.frames.syncSelectedContainer(container, frame, uuid)
}



</script>

<template>
    <Row 
        v-for="uuid in props.uuids" 
        :key="uuid" 
        :uuid="uuid"
        :height="config.rows.height ?? 0"
        :row-label-width="config.rows.labelWidth ?? 0"
        :padding-left="config.editor.paddingLeft ?? 0"
        :padding-right="config.editor.paddingRight ?? 0"
        :pixel-per-ms="config.cols.pixelPerMs ?? 0"
        @frame-click="frameClick"
        @frame-container-update="frameContainerUpdate"
        :timeline="props.timeline"
        :config="props.config"
        :features="props.features"
    />
</template>