import { onBeforeUnmount } from 'vue';

type PointerPressHandler = (event: PointerEvent) => void;
type PointerPressHoldStartHandler = (event: PointerEvent, controls: PointerPressControls) => void;

export interface PointerPressControls {
    takeover: () => void,
    onHoldEnd: (event: PointerEvent) => void,
}

export const usePointerPress = (
    {
        onClick,
        onDoubleClick,
        onHoldStart,
        onHoldEnd,
        holdDelay = 500,
        doubleClickDelay = 250,
        moveTolerance = 6,
    }: {
        onClick?: PointerPressHandler,
        onDoubleClick?: PointerPressHandler,
        onHoldStart?: PointerPressHoldStartHandler,
        onHoldEnd?: PointerPressHandler,
        holdDelay?: number,
        doubleClickDelay?: number,
        moveTolerance?: number,
    }
) => {
    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let holdTriggered = false;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingClickEvent: PointerEvent | null = null;
    let pendingClickTarget: EventTarget | null = null;
    let pendingPointerType: string | null = null;
    let pendingButton: number | null = null;
    let ownershipTransferred = false;

    const clearHoldTimer = () => {
        if (!holdTimer) return;

        clearTimeout(holdTimer);
        holdTimer = null;
    };

    const clearPendingClick = () => {
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
        }

        pendingClickEvent = null;
        pendingClickTarget = null;
        pendingPointerType = null;
        pendingButton = null;
    };

    const resetPress = () => {
        clearHoldTimer();
        activePointerId = null;
        moved = false;
        holdTriggered = false;
        ownershipTransferred = false;
    };

    const hasMoved = (event: PointerEvent) => {
        return Math.hypot(event.clientX - startX, event.clientY - startY) > moveTolerance;
    };

    const releasePointerCapture = (event: PointerEvent) => {
        const target = event.currentTarget as HTMLElement | null;

        if (!target?.hasPointerCapture?.(event.pointerId)) return;

        target.releasePointerCapture(event.pointerId);
    };

    const finalizeTakeover = (event: PointerEvent) => {
        ownershipTransferred = true;
        clearHoldTimer();
        clearPendingClick();
        releasePointerCapture(event);
        activePointerId = null;
        moved = false;
        holdTriggered = false;
    };

    const onPointerdown = (event: PointerEvent) => {

        if (!event.isPrimary || event.button !== 0) return;

        activePointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        moved = false;
        holdTriggered = false;
        ownershipTransferred = false;

        const target = event.currentTarget as HTMLElement | null;
        target?.setPointerCapture?.(event.pointerId);

        clearHoldTimer();
        holdTimer = setTimeout(() => {
            if (activePointerId !== event.pointerId || moved || holdTriggered) return;

            holdTriggered = true;
            onHoldStart?.(event, {
                takeover: () => finalizeTakeover(event),
                onHoldEnd: (holdEndEvent: PointerEvent) => {
                    onHoldEnd?.(holdEndEvent)
                }
            });
        }, holdDelay);
    };

    const onPointermove = (event: PointerEvent) => {
        if (event.pointerId !== activePointerId || moved || holdTriggered) return;

        if (!hasMoved(event)) return;

        moved = true;
        clearHoldTimer();
    };

    const onPointerup = (event: PointerEvent) => {
        if (ownershipTransferred) return;

        if (event.pointerId !== activePointerId) return;

        releasePointerCapture(event);
        clearHoldTimer();

        const target = event.currentTarget;
        const shouldIgnorePress = moved || !event.isPrimary || event.button !== 0;

        if (holdTriggered) {
            onHoldEnd?.(event);
            resetPress();
            return;
        }

        resetPress();

        if (shouldIgnorePress) return;

        if (
            pendingClickEvent &&
            pendingClickTarget === target &&
            pendingPointerType === event.pointerType &&
            pendingButton === event.button
        ) {
            clearPendingClick();
            onDoubleClick?.(event);
            return;
        }

        pendingClickEvent = event;
        pendingClickTarget = target;
        pendingPointerType = event.pointerType;
        pendingButton = event.button;

        clickTimer = setTimeout(() => {
            if (!pendingClickEvent) return;

            onClick?.(pendingClickEvent);
            clearPendingClick();
        }, doubleClickDelay);
    };

    const onPointercancel = (event: PointerEvent) => {
        if (ownershipTransferred) return;

        if (event.pointerId !== activePointerId) return;

        releasePointerCapture(event);
        clearHoldTimer();

        if (holdTriggered) {
            onHoldEnd?.(event);
        }

        resetPress();
    };

    onBeforeUnmount(() => {
        clearHoldTimer();
        clearPendingClick();
    });

    return {
        onPointerdown,
        onPointermove,
        onPointerup,
        onPointercancel,
    };
};

export default usePointerPress;