<script setup lang="ts">
import { computed, onUpdated, useTemplateRef } from 'vue';
import { TimelineFrameByUuidInterface, TimelineFrameInterface } from '../../../../types/timeline';
import usePointerPress, { PointerPressControls } from '../../../../composables/pointerPress';
import FrameUI from '../../UI/FrameUI.vue';
import { UseTimelineInterface } from '../../../../composables/timeline';
import { UseFeaturesType } from '../../../../composables/features/features';
import { TimelineConfigInterface } from '../../../../composables/timelineConfig';
import useUtils from '../../../../composables/utils';


const props = withDefaults(defineProps<{
    uuid: string | number,
    timeline: UseTimelineInterface,
    config: TimelineConfigInterface,
    selected?: boolean,
    draggable?: boolean,
    dragging?: boolean,
}>(), {
    
})

const emits = defineEmits<{
    'click': [value: PointerEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'contextmenu': [value: PointerEvent, container: HTMLDivElement, frame: TimelineFrameByUuidInterface, uuid: string | number],
    'containerUpdate': [value: HTMLDivElement | null, frame: TimelineFrameByUuidInterface, uuid: string | number]
}>()

const { calculateFrameWidth } = useUtils();

const frameUi = useTemplateRef<InstanceType<typeof FrameUI>>('frameUi')
    
const frame = computed<TimelineFrameByUuidInterface>(() => {
    return props.timeline.state.sectionFramesByUuid[props.uuid];
})

const container = computed<HTMLDivElement | null>(() => frameUi.value?.container ?? null);

const position = computed<{ left: number; width: number }>(() => ({
        left: (frame.value.start_ms * props.config.cols.pixelPerMs) + props.config.editor.paddingLeft,
        width: calculateFrameWidth(frame.value.start_ms, frame.value.end_ms, props.config.cols.pixelPerMs)
    })
)

</script>

<template>
    <FrameUI
        ref="frameUi"
        :left="position.left"
        :width="position.width"
        :frame="frame"
        @click="(event) => container ? emits('click', event, container, frame, uuid) : null"
        @container-update="(event) => container ? emits('containerUpdate', event, frame, uuid) : null"
        :style="{
            'touch-action' : selected ? 'none' : 'auto'
        }"
        :selected="props.selected"
        v-if="!dragging"
    >

    </FrameUI>
    
</template>