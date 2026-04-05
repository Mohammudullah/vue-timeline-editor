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
    uuid: string | number,
    rows: TimelineRowInterface[]
}


export interface TimelineRowInterface {
    uuid: string | number,
    title: string,
    frames: TimelineFrameInterface[]
}

export interface TimelineFrameInterface {
    uuid: string | number,
    title: string | null,
    start_ms: number,
    end_ms: number
}

export interface TimelineFrameByUuidInterface {
    uuid: string | number,
    title: string | null,
    start_ms: number,
    end_ms: number,
    rowUuid: string | number,
    sectionUuid: string | number,
    editorRelativeLeft: number,
    width: number,
}


export interface TimelineSectionByUuidInterface {
    title: string,
    uuid: string | number,
    editorRelativeTop: number,
    editorRelativeBottom: number,
}


export interface TimelineRowByUuidInterface {
    uuid: string | number,
    title: string,
    sectionUuid: string | number,
    editorRelativeTop: number,
    editorRelativeBottom: number,
}