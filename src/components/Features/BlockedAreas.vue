<script setup lang="ts">
import { inject } from 'vue';
import { UseTimelineInterface } from '../../composables/timeline';
import { TimelineConfigInterface } from '../../composables/timelineConfig';
import { useBlockedAreas, RowBlockage, SectionBlockage, ComputedBlock } from '../../composables/features/blockedAreas';

const props = defineProps<{
    rowBlockages?: RowBlockage[] | null;
    sectionBlockages?: SectionBlockage[] | null;
}>();

defineSlots<{
    blockage(props: ComputedBlock): any;
}>();

const timeline = inject<UseTimelineInterface>('timeline');
const timelineConfig = inject<TimelineConfigInterface>('timelineConfig');

if (!timeline || !timelineConfig) {
    console.error('BlockedAreas: timeline and timelineConfig must be provided.');
}

const { rowBlocks, sectionBlocks } = useBlockedAreas({
    timeline: timeline!,
    timelineConfig: timelineConfig!,
    rowBlockages: () => props.rowBlockages ?? [],
    sectionBlockages: () => props.sectionBlockages ?? [],
});
</script>

<template>
    <Teleport to="#editorAreaTeleports" defer>
        <div
            v-for="block in rowBlocks"
            :key="block.key"
            class="vtd__blockage vtd__blockage--row"
            :style="{
                position: 'absolute',
                top: `${block.top}px`,
                left: `${block.left}px`,
                width: `${block.width}px`,
                height: `${block.height}px`,
            }"
        >
            <slot name="blockage" v-bind="block">
                <div class="vtd__blockage-default">
                    <span v-if="block.title" class="vtd__blockage-default-title">{{ block.title }}</span>
                </div>
            </slot>
        </div>
        <div
            v-for="block in sectionBlocks"
            :key="block.key"
            class="vtd__blockage vtd__blockage--section"
            :style="{
                position: 'absolute',
                top: `${block.top}px`,
                left: `${block.left}px`,
                width: `${block.width}px`,
                height: `${block.height}px`,
            }"
        >
            <slot name="blockage" v-bind="block">
                <div class="vtd__blockage-default">
                    <span v-if="block.title" class="vtd__blockage-default-title">{{ block.title }}</span>
                </div>
            </slot>
        </div>
    </Teleport>
</template>
