import { TimelineFrameByUuidInterface } from "../../types/timeline";

export const useDraggingEvents = () => {

    const events = {
        'dragStart': [] as ((frame: TimelineFrameByUuidInterface, event: PointerEvent) => void)[],
        'dragEnd': [] as ((frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void)[],
        'dragCancel': [] as ((frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void)[],
        'drop': [] as ((frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void)[],
    }

    const registerEvent = (type: keyof typeof events, handler: ((frame?: TimelineFrameByUuidInterface, frameData?: DraggedFrameDataInterface, event?: PointerEvent) => void)) => {
        if (events[type]) {
            events[type].push(handler as any);
        }
    }

    const triggerOnDragStart = (frame: TimelineFrameByUuidInterface, event: PointerEvent) => {
        events['dragStart'].forEach(handler => handler(JSON.parse(JSON.stringify(frame)), event));
    }

    const triggerOnDragEnd = (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => {
        events['dragEnd'].forEach(handler => handler(JSON.parse(JSON.stringify(frame)), JSON.parse(JSON.stringify(frameData)), event));
    }

    const triggerOnDragCancel = (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => {
        events['dragCancel'].forEach(handler => handler(JSON.parse(JSON.stringify(frame)), JSON.parse(JSON.stringify(frameData)), event));
    }

    const triggerOnDrop = (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => {
        events['drop'].forEach(handler => handler(JSON.parse(JSON.stringify(frame)), JSON.parse(JSON.stringify(frameData)), event));
    }

    const onDragStart = (handler: (frame: TimelineFrameByUuidInterface, event: PointerEvent) => void) => registerEvent('dragStart', handler as any);
    const onDragEnd = (handler: (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void) => registerEvent('dragEnd', handler as any);
    const onDragCancel = (handler: (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void) => registerEvent('dragCancel', handler as any);
    const onDrop = (handler: (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void) => registerEvent('drop', handler as any);

    return {
        onDragStart,
        onDragEnd,
        onDragCancel,
        onDrop,
        triggerOnDragStart,
        triggerOnDragEnd,
        triggerOnDragCancel,
        triggerOnDrop,
    }
}


export interface DraggedFrameDataInterface {
    initial: {
        sectionUuid: string | number | null,
        rowUuid: string | number | null,
        start_ms: number,
        end_ms: number,
    },
    current: {
        sectionUuid: string | number | null,
        rowUuid: string | number | null,
        start_ms: number,
        end_ms: number,

    }
}