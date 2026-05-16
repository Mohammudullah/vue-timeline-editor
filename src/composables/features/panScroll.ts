import { onBeforeUnmount, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseFramesType } from "./frames";

/**
 * usePanScroll
 *
 * Left-button click-and-drag panning of the scroll pane (both axes).
 * Mouse pointer only — touch and pen are ignored.
 *
 * Coexistence rules:
 *  • Middle mouse button (button 1) is left alone so the browser's native
 *    autoscroll continues to work.
 *  • If pointerdown lands on a frame that's already selected, pan bails
 *    so dnd can take over. Pressing an unselected frame still pans —
 *    dnd is dormant in that case (it requires `primary.uuid`).
 *  • 4 px activation threshold (matches DRAG_THRESHOLD in dnd.ts) so a
 *    quick click on an unselected frame can still select it.
 */
export const usePanScroll = ({
    timeline,
    timelineConfig,
    frames,
}: {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    frames: UseFramesType,
}) => {
    void timelineConfig;

    const PAN_THRESHOLD = 4;

    let pending: { pointerId: number, x: number, y: number } | null = null;
    let active = false;
    let lastX = 0;
    let lastY = 0;
    let prevCursor: string | null = null;
    let suppressNextClick = false;

    const startPan = () => {
        if (!pending) return;
        active = true;
        lastX = pending.x;
        lastY = pending.y;

        const editor = timeline.state.editor;
        if (editor instanceof HTMLElement) {
            if (!editor.hasPointerCapture?.(pending.pointerId)) {
                editor.setPointerCapture(pending.pointerId);
            }
            prevCursor = editor.style.cursor;
            editor.style.cursor = 'grabbing';
        }
    };

    const endPan = () => {
        const wasActive = active;
        const editor = timeline.state.editor;

        if (editor instanceof HTMLElement) {
            if (pending && editor.hasPointerCapture?.(pending.pointerId)) {
                editor.releasePointerCapture(pending.pointerId);
            }
            if (prevCursor !== null) editor.style.cursor = prevCursor;
        }

        prevCursor = null;
        pending = null;
        active = false;

        // Eat the trailing click so it doesn't trigger select/deselect handlers.
        if (wasActive) suppressNextClick = true;
    };

    const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        if (event.button !== 0) return;
        if (pending || active) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (frames.findSelectedUuidForTarget(target) != null) return;

        if (target.closest('.no-dragging') || target.classList.contains('no-dragging')) return;

        pending = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent) => {
        if (!pending) return;
        if (event.pointerId !== pending.pointerId) return;

        if (!active) {
            const dx = Math.abs(event.clientX - pending.x);
            const dy = Math.abs(event.clientY - pending.y);
            if (dx <= PAN_THRESHOLD && dy <= PAN_THRESHOLD) return;
            startPan();
        }

        const el = timeline.state.scrollPaneEl;
        if (!el) return;

        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        el.scrollBy(-dx, -dy);
    };

    const onPointerUp = (event: PointerEvent) => {
        if (!pending) return;
        if (event.pointerId !== pending.pointerId) return;
        endPan();
    };

    const onClickCapture = (event: MouseEvent) => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        event.stopPropagation();
        event.preventDefault();
    };

    const editorEvents = {
        pointerdown: onPointerDown,
        pointermove: onPointerMove,
        pointerup: onPointerUp,
        pointercancel: onPointerUp,
    } as const;

    type EventName = keyof typeof editorEvents;

    const attach = (el: HTMLElement) => {
        (Object.entries(editorEvents) as [EventName, EventListener][])
            .forEach(([name, handler]) => el.addEventListener(name, handler));
        el.addEventListener('click', onClickCapture, true);
    };

    const detach = (el: HTMLElement) => {
        (Object.entries(editorEvents) as [EventName, EventListener][])
            .forEach(([name, handler]) => el.removeEventListener(name, handler));
        el.removeEventListener('click', onClickCapture, true);
    };

    watch(() => timeline.state.editor, (newEditor, oldEditor) => {
        if (oldEditor instanceof HTMLElement) detach(oldEditor);
        if (newEditor instanceof HTMLElement) attach(newEditor);
    }, { immediate: true });

    onBeforeUnmount(() => {
        const editor = timeline.state.editor;
        if (editor instanceof HTMLElement) detach(editor);
    });

    const isPanning = () => active;

    return {
        isPanning,
    };
};

export type UsePanScrollType = ReturnType<typeof usePanScroll>;
