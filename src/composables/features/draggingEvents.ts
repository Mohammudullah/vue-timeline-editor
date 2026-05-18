import { TimelineFrameByUuidInterface } from "../../types/timeline";

/**
 * useDraggingEvents
 *
 * Tiny pub/sub for drag and resize lifecycle events. Each handler receives
 * the FULL set of frames participating in the operation (primary first),
 * so consumers don't need to look up "the other selected frames" themselves.
 *
 * For drag/resize end + cancel + drop + resized, a `frameData` object is
 * also delivered with `initial` and `current` per-frame snapshots.
 */
export const useDraggingEvents = () => {

    type DragLifecycleHandler = (frames: TimelineFrameByUuidInterface[], event: PointerEvent) => void;
    type DragDataHandler = (frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent) => void;
    type ResizeLifecycleHandler = (frames: TimelineFrameByUuidInterface[], event: PointerEvent) => void;
    type ResizeDataHandler = (frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent) => void;

    const events = {
        'dragStart':    [] as { id: string, handler: DragLifecycleHandler }[],
        'dragEnd':      [] as { id: string, handler: DragDataHandler }[],
        'dragCancel':   [] as { id: string, handler: DragDataHandler }[],
        'drop':         [] as { id: string, handler: DragDataHandler }[],

        'resizeStart':  [] as { id: string, handler: ResizeLifecycleHandler }[],
        'resizeEnd':    [] as { id: string, handler: ResizeDataHandler }[],
        'resized':      [] as { id: string, handler: ResizeDataHandler }[],
        'resizeCancel': [] as { id: string, handler: ResizeDataHandler }[],
    };

    const registerEvent = (type: keyof typeof events, handler: any, id: string) => {
        if (events[type]) {
            (events[type] as any[]).push({ id, handler });
        }
    };

    const removeEvent = (type: keyof typeof events, id: string) => {
        if (events[type]) {
            events[type] = (events[type] as any[]).filter(e => e.id !== id) as any;
        }
    };

    const cloneFrames = (frames: TimelineFrameByUuidInterface[]) =>
        JSON.parse(JSON.stringify(frames)) as TimelineFrameByUuidInterface[];

    // Deep-clone the `initial`/`current` arrays (so handlers can't mutate
    // them across each other) while keeping any function fields on the
    // payload (e.g. `revert`) by reference — functions don't survive JSON
    // serialization and are stateless anyway.
    const cloneData = <T extends { initial: FrameDataItem[], current: FrameDataItem[] }>(data: T): T => ({
        ...data,
        initial: JSON.parse(JSON.stringify(data.initial)),
        current: JSON.parse(JSON.stringify(data.current)),
    });

    const triggerOnDragStart = (frames: TimelineFrameByUuidInterface[], event: PointerEvent) => {
        events.dragStart.forEach(h => h.handler(cloneFrames(frames), event));
    };
    const triggerOnDragEnd = (frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent) => {
        events.dragEnd.forEach(h => h.handler(cloneFrames(frames), cloneData(frameData), event));
    };
    const triggerOnDragCancel = (frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent) => {
        events.dragCancel.forEach(h => h.handler(cloneFrames(frames), cloneData(frameData), event));
    };
    const triggerOnDrop = (frames: TimelineFrameByUuidInterface[], frameData: DraggedFrameDataInterface, event: PointerEvent) => {
        events.drop.forEach(h => h.handler(cloneFrames(frames), cloneData(frameData), event));
    };

    const triggerOnResizeStart = (frames: TimelineFrameByUuidInterface[], event: PointerEvent) => {
        events.resizeStart.forEach(h => h.handler(cloneFrames(frames), event));
    };
    const triggerOnResizeEnd = (frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent) => {
        events.resizeEnd.forEach(h => h.handler(cloneFrames(frames), cloneData(frameData), event));
    };
    const triggerOnResized = (frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent) => {
        events.resized.forEach(h => h.handler(cloneFrames(frames), cloneData(frameData), event));
    };
    const triggerOnResizeCancel = (frames: TimelineFrameByUuidInterface[], frameData: ResizedFrameDataInterface, event: PointerEvent) => {
        events.resizeCancel.forEach(h => h.handler(cloneFrames(frames), cloneData(frameData), event));
    };

    const onDragStart  = (handler: DragLifecycleHandler, id: string) => registerEvent('dragStart',  handler, id);
    const onDragEnd    = (handler: DragDataHandler,      id: string) => registerEvent('dragEnd',    handler, id);
    const onDragCancel = (handler: DragDataHandler,      id: string) => registerEvent('dragCancel', handler, id);
    const onDrop       = (handler: DragDataHandler,      id: string) => registerEvent('drop',       handler, id);

    const onResizeStart  = (handler: ResizeLifecycleHandler, id: string) => registerEvent('resizeStart',  handler, id);
    const onResizeEnd    = (handler: ResizeDataHandler,      id: string) => registerEvent('resizeEnd',    handler, id);
    const onResized      = (handler: ResizeDataHandler,      id: string) => registerEvent('resized',      handler, id);
    const onResizeCancel = (handler: ResizeDataHandler,      id: string) => registerEvent('resizeCancel', handler, id);

    return {
        onDragStart,
        onDragEnd,
        onDragCancel,
        onDrop,
        triggerOnDragStart,
        triggerOnDragEnd,
        triggerOnDragCancel,
        triggerOnDrop,

        onResizeStart,
        onResizeEnd,
        onResized,
        onResizeCancel,
        triggerOnResizeStart,
        triggerOnResizeEnd,
        triggerOnResized,
        triggerOnResizeCancel,

        removeEvent,
    };
};


/**
 * One per-frame snapshot in a drag/resize event. `initial` mirrors
 * pre-interaction state; `current` mirrors the latest validated state.
 */
export interface FrameDataItem {
    uuid: string | number,
    sectionUuid: string | number | null,
    rowUuid: string | number | null,
    start_ms: number,
    end_ms: number,
}

export interface DraggedFrameDataInterface {
    initial: FrameDataItem[],
    current: FrameDataItem[],
    // One-shot helper that re-applies `initial` to the live frame map via
    // `timeline.updateFrame`. Intended for the "server save failed → put
    // the frame back" path. Idempotent. Available on every event payload
    // regardless of which feature components are mounted — does not require
    // a history feature.
    revert: () => void,
    // Wraps an async task with pending-state lifecycle: marks every affected
    // frame as pending before the task runs, clears the flags when it
    // settles, and auto-calls `revert` on rejection. The task's promise is
    // returned so the consumer can still .then/.catch externally. Re-entry
    // is de-duped — calling `process` while a previous call is still in
    // flight returns the same in-flight promise rather than starting a
    // second task.
    process: <T>(task: () => Promise<T>) => Promise<T>,
}

export interface ResizedFrameDataInterface {
    initial: FrameDataItem[],
    current: FrameDataItem[],
    revert: () => void,
    process: <T>(task: () => Promise<T>) => Promise<T>,
}
