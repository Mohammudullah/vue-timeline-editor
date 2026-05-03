import { TimelineFrameByUuidInterface } from "../../types/timeline";

export const useDraggingEvents = () => {

    const events = {
        'dragStart': [] as { id: string, handler: (frame: TimelineFrameByUuidInterface, event: PointerEvent) => void }[],
        'dragEnd': [] as { id: string, handler: (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void }[],
        'dragCancel': [] as { id: string, handler: (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void }[],
        'drop': [] as { id: string, handler: (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void }[],

        'resizeStart': [] as { id: string, handler: (frame: TimelineFrameByUuidInterface, event: PointerEvent) => void }[],
        'resizeEnd': [] as { id: string, handler: (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => void }[],
        'resized': [] as { id: string, handler: (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => void }[],
        'resizeCancel': [] as { id: string, handler: (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => void }[],
    }

    const registerEvent = (type: keyof typeof events, handler: ((frame?: TimelineFrameByUuidInterface, frameData?: DraggedFrameDataInterface, event?: PointerEvent) => void), id: string) => {

        if (events[type]) {
            events[type].push({ id, handler } as any);
        }
    }

    const removeEvent = (type: keyof typeof events, id: string) => {
        if (events[type]) {
            events[type] = events[type].filter(event => event.id !== id) as any;
        }
    }

    const triggerOnDragStart = (frame: TimelineFrameByUuidInterface, event: PointerEvent) => {
        events['dragStart'].forEach(handler => handler.handler(JSON.parse(JSON.stringify(frame)), event));
    }

    const triggerOnDragEnd = (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => {
        events['dragEnd'].forEach(handler => handler.handler(JSON.parse(JSON.stringify(frame)), JSON.parse(JSON.stringify(frameData)), event));
    }

    const triggerOnDragCancel = (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => {
        events['dragCancel'].forEach(handler => handler.handler(JSON.parse(JSON.stringify(frame)), JSON.parse(JSON.stringify(frameData)), event));
    }

    const triggerOnDrop = (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => {
        events['drop'].forEach(handler => handler.handler(JSON.parse(JSON.stringify(frame)), JSON.parse(JSON.stringify(frameData)), event));
    }

    const triggerOnResizeStart = (frame: TimelineFrameByUuidInterface, event: PointerEvent) => {
        events['resizeStart'].forEach(handler => handler.handler(JSON.parse(JSON.stringify(frame)), event));
    }

    const triggerOnResizeEnd = (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => {
        events['resizeEnd'].forEach(handler => handler.handler(JSON.parse(JSON.stringify(frame)), JSON.parse(JSON.stringify(frameData)), event));
    }
    
    const triggerOnResized = (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => {
        events['resized'].forEach(handler => handler.handler(JSON.parse(JSON.stringify(frame)), JSON.parse(JSON.stringify(frameData)), event));
    }

    const triggerOnResizeCancel = (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => {
        events['resizeCancel'].forEach(handler => handler.handler(JSON.parse(JSON.stringify(frame)), JSON.parse(JSON.stringify(frameData)), event));
    }

    const onDragStart = (handler: (frame: TimelineFrameByUuidInterface, event: PointerEvent) => void, id: string) => registerEvent('dragStart', handler as any, id);
    const onDragEnd = (handler: (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void, id: string) => registerEvent('dragEnd', handler as any, id);
    const onDragCancel = (handler: (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void, id: string) => registerEvent('dragCancel', handler as any, id);
    const onDrop = (handler: (frame: TimelineFrameByUuidInterface, frameData: DraggedFrameDataInterface, event: PointerEvent) => void, id: string) => registerEvent('drop', handler as any, id);

    const onResizeStart = (handler: (frame: TimelineFrameByUuidInterface, event: PointerEvent) => void, id: string) => registerEvent('resizeStart', handler as any, id);
    const onResizeEnd = (handler: (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => void, id: string) => registerEvent('resizeEnd', handler as any, id);
    const onResized = (handler: (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => void, id: string) => registerEvent('resized', handler as any, id);
    const onResizeCancel = (handler: (frame: TimelineFrameByUuidInterface, frameData: ResizedFrameDataInterface, event: PointerEvent) => void, id: string) => registerEvent('resizeCancel', handler as any, id);


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

        removeEvent
    }
}


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
}

export interface ResizedFrameDataInterface {
    initial: FrameDataItem[],
    current: FrameDataItem[],
}