import { onMounted, reactive, Ref, watch } from "vue"

export const useTimelineConfig = (
    {
        timelineContainer,
        direction = 'horizontal',
        zoom = 1,
        xAxisHeight = 30,
        yAxisWidth = 100,
    }: {
        timelineContainer: Ref<HTMLElement | null>,
        direction?: 'horizontal' | 'vertical',
        zoom?: number,
        xAxisHeight?: number,
        yAxisWidth?: number,
    }
): TimelineConfigInterface => {

    const data = reactive<TimelineConfigInterface>({
        container: {
            width: 0,
        },
        editor: {
            width: 0,
        },
        direction,
        zoom,
        xAxisHeight,
        yAxisWidth,
    })


    const updateContainerSize = () => {
        if (timelineContainer.value) {
            data.container = {
                width: timelineContainer.value.clientWidth,
            }
            data.editor = {
                width: timelineContainer.value.clientWidth,
            }
        }
    }


    watch(timelineContainer, () => {
        updateContainerSize()
    }, { immediate: true })


    onMounted(() => {
        window.addEventListener('resize', updateContainerSize)
    })


    return data
}

export interface TimelineConfigInterface {
    container: {
        width: number,
    },
    editor: {
        width: number,
    },
    direction?: 'horizontal' | 'vertical',
    zoom?: number,
    xAxisHeight?: number,
    yAxisWidth?: number,
}