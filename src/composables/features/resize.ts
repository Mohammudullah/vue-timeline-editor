import { onBeforeUnmount, reactive, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";
import { UseFramesType } from "./frames";
import { TimelineFrameByUuidInterface } from "../../types/timeline";
import { FrameDataItem, ResizedFrameDataInterface, useDraggingEvents } from "./draggingEvents";
import useUtils from "../utils";
import { DraggingPlaceholderInterface } from "./dnd";

/**
 * useResize
 *
 * Resize for selected frames.
 *
 * Selection model: same as dnd. The primary frame (the one whose handle was
 * clicked) drives pointer-side detection and start/end calc. Every other
 * selected uuid mirrors the primary's start_ms/end_ms on its own row.
 *
 * Ghost rendering: this composable owns the entire `state.resizingPlaceholders`
 * map — it writes one entry per selected uuid each tick.
 */
export const useResize = ({
    timeline,
    timelineConfig,
    frames,
} : {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
    frames: UseFramesType,
}) => {

    const draggingEvents = useDraggingEvents();
    const { calculateFrameWidth } = useUtils();

    /**
     * Deep, by-value snapshot of every selected frame at the moment the
     * resize starts. Built fresh in `startResize`, cleared in `endResize`.
     *
     * Why: `timeline.state.sectionFramesByUuid` is the live, reactive frame
     * map. The `resized` event handler in Resize.vue calls `updateFrame(...)`
     * which mutates that map in place. The subsequent `resizeEnd` event
     * would otherwise see post-resize values when reading `initial`,
     * corrupting the event payload. The snapshot is the canonical pre-resize
     * source of truth used by both `getResizingFrames` and `initial`.
     */
    let resizeSnapshot: Record<string | number, TimelineFrameByUuidInterface> = {};

    const cloneFrame = (f: TimelineFrameByUuidInterface): TimelineFrameByUuidInterface => ({
        uuid: f.uuid,
        title: f.title,
        start_ms: f.start_ms,
        end_ms: f.end_ms,
        rowUuid: f.rowUuid,
        sectionUuid: f.sectionUuid,
        editorRelativeLeft: f.editorRelativeLeft,
        width: f.width,
        linkGroupUuid: f.linkGroupUuid,
        meta: f.meta,
    });

    const buildResizeSnapshot = () => {
        resizeSnapshot = {};
        for (const uuid of frames.state.selectedUuids) {
            const f = timeline.state.sectionFramesByUuid[uuid];
            if (f) resizeSnapshot[uuid] = cloneFrame(f);
        }
    };

    const state = reactive<ResizeInterface>({
        resizing: false,
        container: {
            width: 0,
            height: 0,
            pointerX: 0,
            pointerY: 0,
        },
        resizingFrame: {
            frame: null,
            uuid: null,
            container: null,
            side: 'left',
        },
        // Legacy single placeholder kept so external code that reads it
        // doesn't break. New code should read from `resizingPlaceholders`.
        resizingPlaceholder: {
            start_ms: 0,
            end_ms: 0,
            left: 0,
            width: 0,
            top: 0,
        },
        // Map of active resize ghost placeholders keyed by frame uuid.
        resizingPlaceholders: {},
    });


    /**
     * Returns the list of frames currently being resized (primary first).
     *
     * Reads from `resizeSnapshot` so callers always see the pre-resize values
     * even after `updateFrame` has mutated `sectionFramesByUuid`.
     */
    const getResizingFrames = (): TimelineFrameByUuidInterface[] => {
        const primaryUuid = state.resizingFrame.uuid;
        const result: TimelineFrameByUuidInterface[] = [];
        if (primaryUuid != null && resizeSnapshot[primaryUuid]) {
            result.push(resizeSnapshot[primaryUuid]);
        }
        for (const uuid of frames.state.selectedUuids) {
            if (uuid === primaryUuid) continue;
            const snap = resizeSnapshot[uuid];
            if (snap) result.push(snap);
        }
        return result;
    };


    const startResize = (event: PointerEvent) => {
        if (!frames.state.primary.uuid) return;

        // Block resize when any pending save would conflict (scope decides
        // whether that means global or just the attempted uuids — see
        // timeline.setPendingBlockScope). Resize has no threshold concept
        // (pointerdown on the handle IS the intent), so we flash + bail
        // here directly. The flash adds the attempted uuids to the loading
        // map briefly so the user sees feedback rather than a silent no-op.
        if (timeline.shouldBlockMutation(frames.state.selectedUuids)) {
            timeline.flashBlocked(frames.state.selectedUuids);
            return;
        }

        const target = event.target as HTMLElement;

        // If the resize handle being grabbed belongs to a non-primary but
        // selected frame, re-target primary so resize math + ghosts orient
        // around the frame the user actually grabbed.
        const hitUuid = frames.findSelectedUuidForTarget(target);
        if (hitUuid != null && hitUuid !== frames.state.primary.uuid) {
            frames.setPrimaryFromSelection(hitUuid);
        }

        const primaryContainer = frames.state.primary.container;
        if (!primaryContainer) return;
        if (!primaryContainer.contains(target as Node)) return;

        const handle = target.closest('.vtd__row-frame-resize-handle') as HTMLElement
            || (target.classList.contains('vtd__row-frame-resize-handle')
                ? target.closest('.vtd__row-frame-resize-handle') as HTMLElement
                : null);

        if (!handle) return;

        state.resizing = true;
        state.container = frames.getFramePointerData();

        state.resizingFrame.frame = frames.state.primary.frame;
        state.resizingFrame.uuid = frames.state.primary.uuid;
        state.resizingFrame.container = frames.state.primary.container;
        state.resizingFrame.side = handle.classList.contains('vtd__frame-resize-left-handle') ? 'left' : 'right';

        // Freeze a deep snapshot of every selected frame BEFORE any external
        // code (event handlers, updateFrame calls) can mutate them.
        buildResizeSnapshot();

        copyInitialPlaceholderData();
        writeAllPlaceholders();

        timeline.enableEdgeScrolling();

        // Capture the pointer to the editor for the remainder of the gesture
        // so pointerup/pointercancel reach our listeners even when the cursor
        // leaves the editor's hit area. Without this the user could mouse-up
        // outside the editor and we'd never see the release — leaving
        // `state.resizing` stuck on until the next click inside.
        if (timeline.state.editor && !timeline.state.editor.hasPointerCapture?.(event.pointerId)) {
            timeline.state.editor.setPointerCapture(event.pointerId);
        }

        if (state.resizingFrame.frame) {
            draggingEvents.triggerOnResizeStart(getResizingFrames(), event);
        }
    };


    /**
     * Builds the `{ initial, current }` snapshot for resize events. One
     * `FrameDataItem` per uuid currently in `state.resizingPlaceholders`,
     * primary first.
     */
    const generateResizedFrameData = () : ResizedFrameDataInterface => {
        const primaryUuid = state.resizingFrame.uuid;
        const initial: FrameDataItem[] = [];
        const current: FrameDataItem[] = [];

        const entries = Object.values(state.resizingPlaceholders).sort((a, b) =>
            a.uuid === primaryUuid ? -1 : b.uuid === primaryUuid ? 1 : 0
        );

        entries.forEach(entry => {
            const snap = resizeSnapshot[entry.uuid];
            const originalFrame = snap ?? timeline.state.sectionFramesByUuid[entry.uuid];
            initial.push({
                uuid: entry.uuid,
                sectionUuid: originalFrame?.sectionUuid ?? null,
                rowUuid: originalFrame?.rowUuid ?? entry.rowUuid,
                start_ms: originalFrame?.start_ms ?? 0,
                end_ms: originalFrame?.end_ms ?? 0,
            });
            current.push({
                uuid: entry.uuid,
                sectionUuid: originalFrame?.sectionUuid ?? null,
                rowUuid: originalFrame?.rowUuid ?? entry.rowUuid,
                start_ms: entry.start_ms,
                end_ms: entry.end_ms,
            });
        });

        const revert = buildRevert(initial);
        const process = buildProcess(initial, revert);
        return { initial, current, revert, process };
    };


    // See dnd.ts:buildRevert for the rationale. Re-applies the pre-resize
    // snapshot via `timeline.updateFrame`. Idempotent.
    const buildRevert = (initial: FrameDataItem[]) => () => {
        for (const item of initial) {
            const original = timeline.state.sectionFramesByUuid[item.uuid];
            if (!original) continue;
            timeline.updateFrame(item.uuid, {
                uuid: item.uuid,
                title: original.title,
                linkGroupUuid: original.linkGroupUuid,
                meta: original.meta,
                start_ms: item.start_ms,
                end_ms: item.end_ms,
                rowUuid: item.rowUuid ?? original.rowUuid,
                sectionUuid: item.sectionUuid ?? original.sectionUuid,
            });
        }
    };

    // See dnd.ts:buildProcess. Same shape: pending immediate (race protect),
    // loading delayed/immediate per `timeline.state.loadingMode`, minShow
    // hold, recordSaveDuration for adaptive mode-switching, de-duped reentry.
    const buildProcess = (initial: FrameDataItem[], revert: () => void) => {
        const uuids = initial.map(it => it.uuid);
        let inFlight: Promise<unknown> | null = null;

        return <T,>(task: () => Promise<T>): Promise<T> => {
            if (inFlight) return inFlight as Promise<T>;

            uuids.forEach(u => timeline.setPending(u, true));

            let delayTimer: ReturnType<typeof setTimeout> | null = null;
            let loadingShownAt = 0;
            const startedAt = Date.now();

            const showLoading = () => {
                if (loadingShownAt) return;
                loadingShownAt = Date.now();
                uuids.forEach(u => { timeline.state.loadingFrameUuids[u] = true; });
            };

            if (timeline.state.loadingMode === 'immediate') {
                showLoading();
            } else {
                delayTimer = setTimeout(showLoading, timeline.getLoadingDelay());
            }

            const cleanupAfterSettle = async () => {
                if (delayTimer != null) {
                    clearTimeout(delayTimer);
                    delayTimer = null;
                }
                uuids.forEach(u => timeline.setPending(u, false));
                timeline.recordSaveDuration(Date.now() - startedAt);

                if (loadingShownAt) {
                    const remaining = timeline.getLoadingMinShow() - (Date.now() - loadingShownAt);
                    if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
                    uuids.forEach(u => { delete timeline.state.loadingFrameUuids[u]; });
                }
            };

            const run = async (): Promise<T> => {
                try {
                    return await task();
                } catch (err) {
                    revert();
                    throw err;
                } finally {
                    inFlight = null;
                    cleanupAfterSettle();
                }
            };

            inFlight = run();
            return inFlight as Promise<T>;
        };
    };


    const endResize = (event: PointerEvent) => {
        if (!state.resizing) return;

        if (state.resizingFrame.frame) {
            draggingEvents.triggerOnResizeEnd(getResizingFrames(), generateResizedFrameData(), event);
        }

        timeline.disableEdgeScrolling();
        state.resizing = false;
        state.resizingFrame.frame = null;
        state.resizingFrame.uuid = null;
        state.resizingPlaceholders = {};
        resizeSnapshot = {};
    };


    const cancelResize = (event: PointerEvent) => {
        if (state.resizingFrame.frame) {
            draggingEvents.triggerOnResizeCancel(getResizingFrames(), generateResizedFrameData(), event);
        }
        endResize(event);
    };


    const resized = (event: PointerEvent) => {
        if (!state.resizing) return;

        if (state.resizingFrame.frame) {
            draggingEvents.triggerOnResized(getResizingFrames(), generateResizedFrameData(), event);
        }

        endResize(event);
    };


    const copyInitialPlaceholderData = () => {
        if (!state.resizingFrame.frame) return;

        state.resizingPlaceholder.start_ms = state.resizingFrame.frame.start_ms;
        state.resizingPlaceholder.end_ms = state.resizingFrame.frame.end_ms;
        state.resizingPlaceholder.left = state.resizingFrame.frame.editorRelativeLeft;
        state.resizingPlaceholder.width = state.resizingFrame.frame.width;
        state.resizingPlaceholder.top = timeline.state.pointer.editorRelativeY - state.container.pointerY;
    };


    /**
     * Recomputes primary placeholder times based on the pointer position.
     */
    const updatePrimaryPlaceholder = () => {
        if (!state.resizing) return;

        if (state.resizingFrame.side === 'left') {
            state.resizingPlaceholder.start_ms = Math.min(
                state.resizingFrame.frame?.end_ms ?? 0,
                Math.max(0, timeline.state.pointer.on_ms),
            );
        } else if (state.resizingFrame.side === 'right') {
            state.resizingPlaceholder.end_ms = Math.max(
                state.resizingFrame.frame?.start_ms ?? 0,
                timeline.state.pointer.on_ms,
            );
        }

        state.resizingPlaceholder.left = (state.resizingPlaceholder.start_ms * timelineConfig.cols.pixelPerMs) + timelineConfig.editor.paddingLeft;
        state.resizingPlaceholder.width = calculateFrameWidth(
            state.resizingPlaceholder.start_ms,
            state.resizingPlaceholder.end_ms,
            timelineConfig.cols.pixelPerMs,
        );
    };


    /**
     * Write resize ghost entries for the primary AND every other selected
     * frame. Members share the primary's start/end times on their own row.
     */
    const writeAllPlaceholders = () => {
        if (!state.resizing || !state.resizingFrame.frame || state.resizingFrame.uuid == null) return;

        const primaryUuid = state.resizingFrame.uuid;

        state.resizingPlaceholders[primaryUuid] = {
            uuid: primaryUuid,
            rowUuid: state.resizingFrame.frame.rowUuid,
            start_ms: state.resizingPlaceholder.start_ms,
            end_ms: state.resizingPlaceholder.end_ms,
            left: state.resizingPlaceholder.left,
            width: state.resizingPlaceholder.width,
            top: state.resizingPlaceholder.top,
        };

        for (const uuid of frames.state.selectedUuids) {
            if (uuid === primaryUuid) continue;
            const memberFrame = timeline.state.sectionFramesByUuid[uuid];
            if (!memberFrame) continue;

            const memberRow = timeline.state.sectionRowsByUuid[memberFrame.rowUuid];

            state.resizingPlaceholders[uuid] = {
                uuid,
                rowUuid: memberFrame.rowUuid,
                start_ms: state.resizingPlaceholder.start_ms,
                end_ms: state.resizingPlaceholder.end_ms,
                left: state.resizingPlaceholder.left,
                width: state.resizingPlaceholder.width,
                top: memberRow?.editorRelativeTop ?? 0,
            };
        }

        // Drop ghost entries for any uuids that left the selection mid-resize.
        for (const ghostUuid of Object.keys(state.resizingPlaceholders)) {
            if (ghostUuid === String(primaryUuid)) continue;
            if (!frames.state.selectedUuids.includes(ghostUuid)
                && !frames.state.selectedUuids.includes(Number(ghostUuid))) {
                delete state.resizingPlaceholders[ghostUuid];
            }
        }
    };


    // OS-level interruptions (screenshot tools, system dialogs, alt-tab) fire
    // `lostpointercapture` without a matching `pointerup`/`pointercancel`.
    // Cancel the resize so `state.resizing` doesn't stay stuck on until the
    // user clicks back into the editor.
    const onLostPointerCapture = (event: PointerEvent) => {
        if (state.resizing) cancelResize(event);
    };

    const editorPointerEvents = {
        'pointerdown': startResize,
        'pointerup': resized,
        'pointercancel': cancelResize,
        'lostpointercapture': onLostPointerCapture,
    } as const;

    type eventTypes = keyof typeof editorPointerEvents;


    watch(() => timeline.state.editor, (newEditor, oldEditor) => {
        oldEditor && Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => oldEditor.removeEventListener(event as eventTypes, handler)
        );
        newEditor && Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => newEditor.addEventListener(event as eventTypes, handler)
        );
    }, { immediate: true });


    watch(() => timeline.state.pointer.clientX, () => {
        updatePrimaryPlaceholder();
        writeAllPlaceholders();
    });


    // Re-write placeholders if selection changes mid-resize.
    watch(() => frames.state.selectedUuids.slice(), () => {
        if (state.resizing) writeAllPlaceholders();
    });


    onBeforeUnmount(() => {
        timeline.state.editor && Object.entries(editorPointerEvents).forEach(
            ([event, handler]) => timeline.state.editor?.removeEventListener(event as eventTypes, handler)
        );
    });


    const resizing = (uuid: string | number): boolean =>
        state.resizing && state.resizingPlaceholders[uuid] != null;

    return {
        state,
        resizing,
        getResizingFrames,
        onResizeStart: draggingEvents.onResizeStart,
        onResizeEnd: draggingEvents.onResizeEnd,
        onResizeCancel: draggingEvents.onResizeCancel,
        onResized: draggingEvents.onResized,
        removeEvent: draggingEvents.removeEvent,
    };
};

export interface ResizeInterface {
    resizing: boolean,
    container: {
        width: number,
        height: number,
        pointerX: number,
        pointerY: number,
    },
    resizingFrame: {
        frame: TimelineFrameByUuidInterface | null,
        uuid: string | number | null,
        container: HTMLDivElement | null,
        side: 'left' | 'right',
    },
    resizingPlaceholder: {
        start_ms: number,
        end_ms: number,
        left: number,
        width: number,
        top: number,
    },
    resizingPlaceholders: Record<string | number, DraggingPlaceholderInterface>,
}

export type UseResizeInterface = ReturnType<typeof useResize>;
