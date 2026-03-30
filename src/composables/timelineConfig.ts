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
        time: {
            
        }
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
        grids: {
            majorGridInterval: 3600,
            minorGridInterval: 900,
            minorGridsPerMajor: 4,
            gridGap: 10,
        }
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

    /**
     * Determine minor tick interval based on major tick interval. 
     * This determines how many minor ticks are shown between major ticks in time axis
     */
    const calculateMinorGrid = () => {
        const rules = [
            [3600, 900], // ≥ 1h → 15m
            [1800, 60],  // ≥ 30m → 1m
            [600, 30],   // ≥ 10m → 30s
            [60, 10],    // ≥ 1m → 10s
        ];

        data.grids.minorGridInterval = rules.find(([threshold]) => data.grids.majorGridInterval >= threshold)?.[1] ?? 1;
        data.grids.minorGridsPerMajor = data.grids.majorGridInterval / data.grids.minorGridInterval;

        calculateGridGap();
    };


    /**
     * calculate grid gap based on minor tick interval. so, if so many minor ticks are shown, the grid gap should be smaller to fit them in
     * This determines the gap between time grid lines in time axis  
     */
    const calculateGridGap = () => {
        const rules = [
            [30, 5],
            [20, 10],
            [10, 20],
            [5, 40],
        ]

        data.grids.gridGap = rules.find(([threshold]) => data.grids.minorGridsPerMajor >= threshold)?.[1] ?? 40;
    }


    watch(timelineContainer, updateContainerSize, { immediate: true })

    // Watch major tick interval changes to update minor tick interval accordingly
    watch(() => data.grids.majorGridInterval, calculateMinorGrid, { immediate: true })


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
    grids: {
        majorGridInterval: number,
        minorGridInterval: number,
        minorGridsPerMajor: number,
        gridGap: number,
    },
}