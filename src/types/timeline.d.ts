export interface TimelineRangeInterface {
    start_seconds: number,
    end_seconds: number
}

export interface TimelineRangeArgInterface {
    start_seconds: number | null,
    end_seconds: number | null
}

export interface TimelineSectionInterface {
    title: string,
    id: string | number,
    rows: TimelineRowInterface[]
}


export interface TimelineRowInterface {
    id: string | number,
    title: string,
    frames: TimelineFrameInterface[]
}

export interface TimelineFrameInterface {
    id: string | number,
    title: string | null,
    start_ms: number,
    end_ms: number
}