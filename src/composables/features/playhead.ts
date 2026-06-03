import { computed, onBeforeUnmount, reactive, watch } from "vue";
import { UseTimelineInterface } from "../timeline";
import { TimelineConfigInterface } from "../timelineConfig";

/**
 * usePlayhead
 *
 * Source-of-truth for the timeline playhead — a vertical marker indicating
 * the current timeline position. Position is held in `currentMs`, the SAME
 * absolute-ms domain as `frame.start_ms` (so consumer data needs no rebasing).
 *
 * The composable owns position + playback; the `<Playhead/>` component is a
 * thin shell that registers this feature, syncs props, and renders the DOM.
 * The returned object is exposed on `features.data.playhead`, so the host can
 * drive it from outside via `<Timeline @init>`'s `features` payload.
 */
export interface PlayheadOptions {
    // Timeline-ms advanced per real wall-clock ms while playing. 1 = real time.
    rate: number;
    // When the playhead hits the range end: wrap to start (true) or pause.
    loop: boolean;
    // Whether the handle / seek-strip respond to pointer drag.
    draggable: boolean;
    // Whether clicking the ruler jumps the playhead there.
    clickSeek: boolean;
    // Minimum real-time ms between reactive currentMs writes while playing.
    // 0 = update every animation frame (~60fps). 1000 = update once per second.
    updateInterval: number;
}

export const usePlayhead = ({
    timeline,
    timelineConfig,
}: {
    timeline: UseTimelineInterface,
    timelineConfig: TimelineConfigInterface,
}) => {

    const rangeStartMs = () => (timelineConfig.range.start_seconds ?? 0) * 1000;
    const rangeEndMs = () => (timelineConfig.range.end_seconds ?? 24 * 60 * 60) * 1000;

    const clamp = (ms: number) =>
        Math.min(Math.max(ms, rangeStartMs()), rangeEndMs());

    const state = reactive({
        currentMs: rangeStartMs(),
        playing: false,
        dragging: false,
    });

    const options = reactive<PlayheadOptions>({
        rate: 1,
        loop: false,
        draggable: true,
        clickSeek: true,
        updateInterval: 0,
    });

    // Reactive mirror of the scroll pane's horizontal scroll — DOM scroll
    // properties aren't reactive, so `edgeSide` can't read them directly.
    const viewport = reactive({ scrollLeft: 0, width: 0 });

    const syncViewport = () => {
        const pane = timeline.state.scrollPaneEl;
        if (!pane) return;
        viewport.scrollLeft = pane.scrollLeft;
        viewport.width = pane.clientWidth;
    };

    // Editor-relative pixel X — identical mapping to renderFrame's
    // `editorRelativeLeft`, so the playhead aligns 1:1 with frame positions.
    const pixelX = computed(() =>
        (state.currentMs - rangeStartMs()) * timelineConfig.cols.pixelPerMs
        + timelineConfig.editor.paddingLeft,
    );

    // Which side the playhead has gone off — drives the edge indicator.
    // Out of the timeline RANGE wins (the playhead is hidden then); otherwise
    // it reflects whether the playhead is merely scrolled out of view.
    const edgeSide = computed<'left' | 'right' | null>(() => {
        if (state.currentMs < rangeStartMs()) return 'left';
        if (state.currentMs > rangeEndMs()) return 'right';
        if (viewport.width === 0) return null;
        if (pixelX.value < viewport.scrollLeft) return 'left';
        if (pixelX.value > viewport.scrollLeft + viewport.width) return 'right';
        return null;
    });

    // True while the playhead sits within the timeline range. The line and
    // handle are hidden when false — the edge arrow points toward it instead.
    const inRange = computed(() =>
        state.currentMs >= rangeStartMs() && state.currentMs <= rangeEndMs(),
    );

    // Set the playhead position. NOT clamped — an out-of-range position is a
    // valid state (the playhead hides; an edge arrow points toward it).
    // Pointer gestures go through `seekFromClientX`, which clamps instead.
    const seek = (ms: number) => {
        internalMs = ms;
        state.currentMs = ms;
    };

    // Convert a viewport clientX into an absolute-ms position. The scroll
    // pane's left edge maps to editorRelativeX 0; add scrollLeft back to get
    // the content-space X, then invert renderFrame's positioning.
    const clientXToMs = (clientX: number): number => {
        const pane = timeline.state.scrollPaneEl;
        if (!pane) return state.currentMs;
        const rect = pane.getBoundingClientRect();
        const editorX = clientX - rect.left + pane.scrollLeft;
        return ((editorX - timelineConfig.editor.paddingLeft)
            / timelineConfig.cols.pixelPerMs) + rangeStartMs();
    };

    // Pointer-driven seek (drag / ruler click). Clamped to the range so a
    // drag can't push the handle out of view mid-gesture.
    const seekFromClientX = (clientX: number) => {
        state.currentMs = clamp(clientXToMs(clientX));
    };

    // Scroll the pane so the playhead is centred in the viewport. Defaults
    // to a smooth scroll; pass 'auto' for an instant jump (e.g. on mount).
    const scrollIntoView = (behavior: ScrollBehavior = 'smooth') => {
        const pane = timeline.state.scrollPaneEl;
        if (!pane) return;
        pane.scrollTo({
            left: Math.max(0, pixelX.value - pane.clientWidth / 2),
            behavior,
        });
    };

    // ---- play loop -------------------------------------------------------
    let rafId: number | null = null;
    let lastTs = 0;
    let lastUpdateTs = 0;
    // Tracks the true position every frame; state.currentMs is only written
    // when updateInterval allows, so the internal position never lags.
    let internalMs = state.currentMs;

    const tick = (ts: number) => {
        if (!state.playing) return;
        const delta = lastTs ? ts - lastTs : 0;
        lastTs = ts;

        let next = internalMs + delta * options.rate;
        if (next >= rangeEndMs()) {
            if (options.loop) {
                const span = rangeEndMs() - rangeStartMs();
                next = span > 0
                    ? rangeStartMs() + ((next - rangeStartMs()) % span)
                    : rangeStartMs();
            } else {
                internalMs = rangeEndMs();
                state.currentMs = rangeEndMs();
                pause();
                return;
            }
        }
        internalMs = next;

        const interval = options.updateInterval;
        if (interval <= 0 || (ts - lastUpdateTs) >= interval) {
            state.currentMs = internalMs;
            lastUpdateTs = ts;
        }

        rafId = requestAnimationFrame(tick);
    };

    const play = () => {
        if (state.playing) return;
        // Restart from the beginning if parked at the end.
        if (state.currentMs >= rangeEndMs()) state.currentMs = rangeStartMs();
        internalMs = state.currentMs;
        state.playing = true;
        lastTs = 0;
        lastUpdateTs = 0;
        rafId = requestAnimationFrame(tick);
    };

    const pause = () => {
        if (!state.playing) return;
        state.playing = false;
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
    };

    const toggle = () => (state.playing ? pause() : play());

    const setRate = (rate: number) => { options.rate = rate; };
    const getRate = () => options.rate;
    const setLoop = (loop: boolean) => { options.loop = loop; };
    const setUpdateInterval = (ms: number) => { options.updateInterval = Math.max(0, ms); };

    // Keep the scroll mirror in sync with whichever pane is mounted.
    watch(() => timeline.state.scrollPaneEl, (pane, oldPane) => {
        oldPane?.removeEventListener('scroll', syncViewport);
        pane?.addEventListener('scroll', syncViewport);
        syncViewport();
    }, { immediate: true });

    // Container resize changes the viewport width — refresh the mirror.
    watch(() => timelineConfig.container.width, syncViewport);

    onBeforeUnmount(() => {
        pause();
        timeline.state.scrollPaneEl?.removeEventListener('scroll', syncViewport);
    });

    // Derived values are grouped into a `reactive` object so the feature's
    // public surface has no top-level refs — the feature registry is itself
    // `reactive`, and loose refs would be unwrapped inconsistently there.
    const view = reactive({ pixelX, edgeSide, inRange });

    return {
        state,
        options,
        view,
        seek,
        seekFromClientX,
        scrollIntoView,
        play,
        pause,
        toggle,
        setRate,
        getRate,
        setLoop,
        setUpdateInterval,
    };
};

export type UsePlayheadType = ReturnType<typeof usePlayhead>;
