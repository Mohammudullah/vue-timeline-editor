import { computed, reactive, Ref, watch } from "vue"
import { TimeStringTimeFormatOptions } from "./utils"
import { TimelineRangeArgInterface, TimelineRangeInterface } from "../types/timeline"

export const useTimelineConfig = (
    {
        timelineContainer,
        timelineEditor,
        scrollPaneEl,
        direction = 'horizontal',
        zoom = 1,
        colsLabelHeight = 40,
        rowsLabelWidth = 100,
        timeAxisTimeFormat,
        initialRange,
    }: {
        timelineContainer: Ref<HTMLElement | null>,
        timelineEditor: Ref<HTMLElement | null>,
        scrollPaneEl: Ref<HTMLElement | null>,
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
            width: 0,
            viewPortWidth: 0,
            rawViewPortLeft: 0,
            rawViewPortRight: 0,
            viewPortLeft: 0,
            viewPortRight: 0,
            
            height: 0,
            viewPortHeight: 0,
            rawViewPortTop: 0,
            rawViewPortBottom: 0,
            viewPortTop: 0,
            viewPortBottom: 0,
            viewPortRatio: 1,
            
            paddingLeft: 10,
            paddingRight: 10,

            containerOffset: {
                left: rowsLabelWidth,
                top: colsLabelHeight,
            },

            wrapper: {
                width: 0,
                height: 0,
            }
        },
        direction,
        zoom,
        cols: {
            width: 10,
            majorGridInterval: 3600000,
            minorGridInterval: 900000,
            minorGridsPerMajor: 4,
            pixelPerMs: 0,
            totalPixels: 0,
            labelHeight: colsLabelHeight,
        },
        rows: {
            height: 60,
            labelWidth: rowsLabelWidth,
        },
        sections: {
            labelHeight: 30,
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
            [3600000, 900000], // ≥ 1h → 15m in ms
            [1800000, 60000],  // ≥ 30m → 1m in ms
            [600000, 30000],   // ≥ 10m → 30s in ms
            [60000, 10000],    // ≥ 1m → 10s in ms
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

        data.cols.width = rules.find(([threshold]) => data.cols.minorGridsPerMajor >= threshold)?.[1] ?? 40;
        
        data.cols.pixelPerMs = data.cols.width / data.cols.minorGridInterval;

        //an integer value of total pixel in editor area
        data.cols.totalPixels = Math.trunc(data.cols.pixelPerMs * ((data.range.end_seconds - data.range.start_seconds) * 1000));
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

        data.editor.width = data.cols.totalPixels + data.editor.paddingLeft + data.editor.paddingRight;
        data.editor.height = timelineEditor.value?.scrollHeight ?? data.container.height;

        data.editor.wrapper.width = data.editor.width + data.rows.labelWidth;
        data.editor.wrapper.height = data.editor.height;
    }

    //sync editor viewport size and position based on scroll or intersection observer

    const syncEditorViewPort = () => {
        if (!timelineContainer.value || !timelineEditor.value || !scrollPaneEl.value) return;

        const offsetX = data.editor.containerOffset.left
        const offsetY = data.editor.containerOffset.top

        // 🔹 Scroll positions
        const scrollLeft = scrollPaneEl.value.scrollLeft
        const scrollTop = scrollPaneEl.value.scrollTop

        // 🔹 Visible viewport (adjusted for axis labels)
        const viewPortWidth = timelineContainer.value.clientWidth - offsetX
        const viewPortHeight = timelineContainer.value.clientHeight - offsetY

        // Editor size
        const editorWidth = timelineEditor.value.scrollWidth
        const editorHeight = timelineEditor.value.scrollHeight

        // use RAW positions (with offset)
        const rawLeft = scrollLeft - offsetX
        const rawTop = scrollTop - offsetY

        // 🔹 Clamp only final values
        const viewPortLeft = Math.max(0, rawLeft)
        const viewPortTop = Math.max(0, rawTop)

        const viewPortRight = Math.min(editorWidth, rawLeft + viewPortWidth)
        const viewPortBottom = Math.min(editorHeight, rawTop + viewPortHeight)

        // 🔹 Assign
        data.editor.viewPortWidth = Math.max(0, viewPortRight - viewPortLeft)
        data.editor.viewPortHeight = Math.max(0, viewPortBottom - viewPortTop)

        data.editor.viewPortLeft = viewPortLeft
        data.editor.viewPortRight = viewPortRight
        data.editor.rawViewPortLeft = rawLeft
        data.editor.rawViewPortRight = rawLeft + viewPortWidth

        data.editor.viewPortTop = viewPortTop
        data.editor.viewPortBottom = viewPortBottom
        data.editor.rawViewPortTop = rawTop
        data.editor.rawViewPortBottom = rawTop + viewPortHeight

        // 🔹 Ratio
        const totalArea = editorWidth * editorHeight
        const visibleArea =
            data.editor.viewPortWidth * data.editor.viewPortHeight

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
    watch([scrollPaneEl], ([newScrollPaneEl], [oldScrollPaneEl]) => {
        oldScrollPaneEl?.removeEventListener('scroll', syncEditorViewPort)
        newScrollPaneEl?.addEventListener('scroll', syncEditorViewPort)
    }, { immediate: true })

    //sync editor viewport on offset change (for example, when label width changes)
    watch([() => data.editor.containerOffset, timelineEditor], syncEditorViewPort)

    return data
}

export interface TimelineConfigInterface {
    container: {
        width: number,
        height: number,
    },
    editor: {
        
        width: number,
        viewPortWidth: number,
        rawViewPortLeft: number,
        rawViewPortRight: number,
        viewPortLeft: number,
        viewPortRight: number,

        height: number,
        viewPortHeight: number,
        rawViewPortTop: number,
        rawViewPortBottom: number,
        viewPortTop: number,
        viewPortBottom: number,

        paddingLeft: number,
        paddingRight: number,

        viewPortRatio: number,
        containerOffset: {
            left: number,
            top: number,
        },
        wrapper: {
            width: number,
            height: number,
        }
    },
    direction?: 'horizontal' | 'vertical',
    zoom?: number,
    cols: {
        width: number,
        majorGridInterval: number,
        minorGridInterval: number,
        minorGridsPerMajor: number,
        pixelPerMs: number,
        totalPixels: number,
        labelHeight: number,
    },
    rows: {
        height: number,
        labelWidth: number,
    }
    sections: {
        labelHeight: number,
    },
    timeAxis: {
        timeFormat: TimeStringTimeFormatOptions,
    },
    range: TimelineRangeInterface,
}