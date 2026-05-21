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
    frames: TimelineFrameInterface[],
    // Optional. When set, hovering an empty area of this row suggests a
    // new-frame box of this length (ms), capped by the available space.
    // When omitted, the row still suggests the full empty area if the
    // `<Sections rowClickable>` prop is enabled.
    new_frame_length?: number,
}

export interface TimelineFrameInterface {
    uuid: string | number,
    title: string | null,
    start_ms: number,
    end_ms: number,
    linkGroupUuid?: string | number,
    // Arbitrary per-frame payload. Forwarded untouched into the `#frame` slot
    // so consumers can render custom content based on their own data.
    meta?: unknown,
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
    linkGroupUuid?: string | number,
    meta?: unknown,
}

export interface TimelineFrameByUuidBasicInterface {
    uuid: string | number,
    title: string | null,
    start_ms: number,
    end_ms: number,
    rowUuid: string | number,
    sectionUuid: string | number,
    linkGroupUuid?: string | number,
    meta?: unknown,
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
    emptyAreas: { start_ms: number; end_ms: number }[],
}