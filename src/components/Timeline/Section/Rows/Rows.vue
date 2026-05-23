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
    // Toggle: clicking a selected frame deselects it. A click that's the tail
    // of a press-and-hold doesn't toggle (handled inside toggleFrame via the
    // hold-just-fired flag) so frame-hold consumers can keep the selection.
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
        @frame-click="frameClick"
        @frame-container-update="frameContainerUpdate"
        :timeline="props.timeline"
        :config="props.config"
        :features="props.features"
    >
        <template #frame="slotProps">
            <slot name="frame" v-bind="slotProps" />
        </template>
    </Row>
</template>