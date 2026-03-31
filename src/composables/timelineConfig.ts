import { h, onBeforeUnmount, onMounted, reactive, Ref, toValue, watch } from "vue"
import { TimeStringTimeFormatOptions } from "./utils"
import { TimelineRangeArgInterface, TimelineRangeInterface } from "../types/timeline"

export const useTimelineConfig = (
    {
        timelineContainer,
        timelineEditor,
        scrollXEl,
        scrollYEl,
        direction = 'horizontal',
        zoom = 1,
        colsLabelHeight = 40,
        rowsLabelWidth = 100,
        timeAxisTimeFormat,
        initialRange,
    }: {
        timelineContainer: Ref<HTMLElement | null>,
        timelineEditor: Ref<HTMLElement | null>,
        scrollXEl: Ref<HTMLElement | null>,
        scrollYEl: Ref<HTMLElement | null>,
        direction?: 'horizontal' | 'vertical',
        zoom?: number,
        colsLabelHeight?: number,
        rowsLabelWidth?: number,
        timeAxisTimeFormat: TimeStringTimeFormatOptions,
        initialRange: () => TimelineRangeArgInterface,
    }
): TimelineConfigInterface => {

    const data = reactive<TimelineConfigInterface>({
        container: {
            width: 0,
            height: 0,
        },
        editor: {
            axis: {
                x: {
                    width: 0,
                    viewPortWidth: 0,
                    viewPortLeft: 0,
                    viewPortRight: 0,
                },
                y: {
                    height: 0,
                    viewPortHeight: 0,
                    viewPortTop: 0,
                    viewPortBottom: 0,
                }
            },
            viewPortRatio: 1,
            wrapper: {
                width: 0,
                height: 0,
            }
        },
        direction,
        zoom,
        cols: {
            majorGridInterval: 3600,
            minorGridInterval: 900,
            minorGridsPerMajor: 4,
            gap: 10,
            pixelPerSecond: 0,
            totalPixels: 0,
            labelHeight: colsLabelHeight,
        },
        rows: {
            height: 100,
            labelWidth: rowsLabelWidth,
        },
        timeAxis: {
            timeFormat: timeAxisTimeFormat,
        },
        range: { start_seconds: 0, end_seconds: 24 * 60 * 60 }
    })


    const updateContainerSize = () => {
        if (timelineContainer.value) {
            data.container = {
                width: timelineContainer.value.clientWidth,
                height: 500,
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

        data.cols.minorGridInterval = rules.find(([threshold]) => data.cols.majorGridInterval >= threshold)?.[1] ?? 1;
        data.cols.minorGridsPerMajor = data.cols.majorGridInterval / data.cols.minorGridInterval;

        calculateTimelineArea();
    };


    /**
     * calculate grid gap based on minor tick interval. so, if so many minor ticks are shown, the grid gap should be smaller to fit them in
     * This determines the gap between time grid lines in time axis  
     */
    const calculateTimelineArea = () => {
        const rules = [
            [30, 5],
            [20, 10],
            [10, 20],
            [5, 40],
        ]

        data.cols.gap = rules.find(([threshold]) => data.cols.minorGridsPerMajor >= threshold)?.[1] ?? 40;
        data.cols.pixelPerSecond = data.cols.gap / data.cols.minorGridInterval;
        data.cols.totalPixels = data.cols.pixelPerSecond * (data.range.end_seconds - data.range.start_seconds);
    }


    const initializeRange = () => {
        const rangeData = initialRange ? initialRange() : { start_seconds: 0, end_seconds: 24 * 60 * 60 };
        data.range = {
            start_seconds: rangeData.start_seconds ?? 0,
            end_seconds: rangeData.end_seconds ?? (24 * 60 * 60),
        };
    }


    const syncEditor = () => {

        if(!data.container.width) return;

        data.editor.axis.x.width = data.cols.totalPixels;
        data.editor.axis.y.height = data.container.height;

        data.editor.wrapper.width = data.editor.axis.x.width + data.rows.labelWidth;
        data.editor.wrapper.height = data.editor.axis.y.height;
    }

    //sync editor viewport size and position based on scroll or intersection observer

    const syncEditorViewPort = () => {

        if(!timelineContainer.value || !timelineEditor.value || !scrollXEl.value || !scrollYEl.value) return;

        // Scroll positions
        const scrollLeft = scrollXEl.value.scrollLeft
        const scrollTop = scrollYEl.value.scrollTop

        // Visible viewport size (contain1er)
        const viewPortWidth = timelineContainer.value.clientWidth
        const viewPortHeight = timelineContainer.value.clientHeight

        // Editor total size
        const editorWidth = timelineEditor.value.scrollWidth
        const editorHeight = timelineEditor.value.scrollHeight

        // Calculate visible range inside editor
        const viewPortLeft = scrollLeft
        const viewPortRight = Math.min(editorWidth, scrollLeft + viewPortWidth)

        const viewPortTop = scrollTop
        const viewPortBottom = Math.min(editorHeight, scrollTop + viewPortHeight)

        // Final assignment
        data.editor.axis.x.viewPortWidth = viewPortRight - viewPortLeft
        data.editor.axis.y.viewPortHeight = viewPortBottom - viewPortTop

        data.editor.axis.x.viewPortLeft = viewPortLeft
        data.editor.axis.x.viewPortRight = viewPortRight

        data.editor.axis.y.viewPortTop = viewPortTop
        data.editor.axis.y.viewPortBottom = viewPortBottom

        // 🔹 Ratio
        const totalArea = editorWidth * editorHeight
        const visibleArea =
            data.editor.axis.x.viewPortWidth * data.editor.axis.y.viewPortHeight

        data.editor.viewPortRatio =
        totalArea === 0 ? 0 : visibleArea / totalArea
    }

    watch(timelineContainer, updateContainerSize, { immediate: true })

    // Watch major tick interval changes to update minor tick interval accordingly
    watch(() => data.cols.majorGridInterval, calculateMinorGrid, { immediate: true })


    //watch and update timeline range when initial range changes
    watch(initialRange, initializeRange, { immediate: true })

    watch([() => data.container, () => data.range], syncEditor, { deep: true })



    //timeline container resize observer
    let timelineContainerObserver: ResizeObserver | null = null;
    watch(timelineContainer, (newEl) => {
        if (!newEl) return

        // disconnect old observer (important)
        timelineContainerObserver?.disconnect()

        timelineContainerObserver = new ResizeObserver(entries => {
            updateContainerSize();
            syncEditorViewPort();
        })

        timelineContainerObserver.observe(newEl)

    }, { immediate: true })


    //sync editor viewport on scroll
    watch([scrollXEl, scrollYEl], ([newScrollXEl, newScrollYEl], [oldScrollXEl, oldScrollYEl]) => {
        oldScrollXEl?.removeEventListener('scroll', syncEditorViewPort)
        oldScrollYEl?.removeEventListener('scroll', syncEditorViewPort)
        newScrollXEl?.addEventListener('scroll', syncEditorViewPort)
        newScrollYEl?.addEventListener('scroll', syncEditorViewPort)
    }, { immediate: true })

    return data
}

export interface TimelineConfigInterface {
    container: {
        width: number,
        height: number,
    },
    editor: {
        axis: {
            x: { 
                width: number,
                viewPortWidth: number,
                viewPortLeft: number,
                viewPortRight: number,
            },
            y: {
                height: number,
                viewPortHeight: number,
                viewPortTop: number,
                viewPortBottom: number,
            }
        }
        viewPortRatio: number,
        wrapper: {
            width: number,
            height: number,
        }
    },
    direction?: 'horizontal' | 'vertical',
    zoom?: number,
    cols: {
        majorGridInterval: number,
        minorGridInterval: number,
        minorGridsPerMajor: number,
        gap: number,
        pixelPerSecond: number,
        totalPixels: number,
        labelHeight: number,
    },
    rows: {
        height: number,
        labelWidth: number,
    }
    timeAxis: {
        timeFormat: TimeStringTimeFormatOptions,
    },
    range: TimelineRangeInterface,
}