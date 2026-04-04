<script setup lang="ts">
import { PointerPressControls } from '../../../../composables/pointerPress';
import { UseTimelineInterface } from '../../../../composables/timeline';
import { TimelineFrameInterface, TimelineRowInterface } from '../../../../types/timeline';
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


const frameHoldStart = (event : PointerEvent, controls : PointerPressControls, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number) => {

    props.features.data.dnd?.startDrag(event, controls, frame, container, uuid)
}

const frameClick = (event : PointerEvent, frame: TimelineFrameInterface, container: HTMLDivElement, uuid: string | number) => {
    props.features.data.frame.toggleFrame(event, frame, container, uuid)
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
        @frameHoldStart="frameHoldStart"
        @frame-click="frameClick"
        :timeline="props.timeline"
        :config="props.config"
        :features="props.features"
    />
</template>