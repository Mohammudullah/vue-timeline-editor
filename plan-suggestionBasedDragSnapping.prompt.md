# Plan: Suggestion-Based Drag Snapping

Refactor the drag snap pipeline in [src/composables/features/snapping.ts](src/composables/features/snapping.ts) from an **enforcement model** (mutating the placeholder, blocking pointer movement) to a **suggestion model**: the ghost follows the pointer freely (clamped only by editor edges via `snapEdges`), while the snap pipeline computes a non-binding suggestion (target row + snapped start/end + validity) visualized as a highlighted empty area + snap guide lines. On drop, the frame commits to the last valid suggestion; if none exists, it reverts. Resize is untouched.

## Decisions (confirmed)
- Ghost fully freeform; only `snapEdges` clamping retained.
- Visuals: highlighted target empty area + snap guide lines (no secondary ghost / row highlight / invalid tint for v1).
- No valid suggestion on drop → revert to initial (still fires `drop` event).
- Snap priority: frame edge > grid (major→minor) > row.
- Scope: drag pipeline only; resize untouched.

## Phases

### Phase 1 — Data model: split "freeform" vs "suggestion"
1. Extend `SnappingStateInterface` in `snapping.ts`:
   - Keep `draggingPlaceholder` but redefine its semantics as the **freeform ghost** position (mirrors `dnd.draggingPlaceholder` after only `snapRows` for Y-locking + `snapEdges` clamping — no time/frame snapping applied).
   - Add `dragSuggestion`: `{ valid: boolean; rowUuid; sectionUuid; start_ms; end_ms; left; top; snapType: 'frame-edge'|'grid-major'|'grid-minor'|'row'|'none'; guides: { start_ms?: number; end_ms?: number }[]; targetEmptyArea: { start_ms; end_ms } | null }`.
2. Replace internal mutable `lastNotOverflowedPosition` (drag side) with a `lastValidSuggestion` cache of the same shape. Keep the resize-side mechanism unchanged.

### Phase 2 — Refactor snap functions into pure evaluators *(parallel within phase)*
Each candidate function becomes a pure evaluator returning `{ snappedStart, snappedEnd, snapType, guides[] } | null`, no shared-state mutation. The orchestrator combines them.
1. `evaluateFrameEdgeSnap` — derived from current `snapFrames` (snap to empty-area edges within 150 000 ms threshold). Returns the candidate plus the empty-area boundary used as a guide.
2. `evaluateGridSnap` — derived from `snapTimesOnDrag`, returning `grid-major` or `grid-minor` candidate; preserves current threshold.
3. `evaluateRowTarget` — derived from `snapRows`; resolves `pointer.over.rowUuid` → row top.
4. `evaluateValidity` — derived from `protectOverLappingFrames` drag branch:
   - returns `valid: false` if pointer is over an existing frame on target row, OR the candidate frame range overlaps any existing frame on that row, OR duration exceeds the empty area the pointer is in.
   - When candidate overlaps but pointer is in empty area, attempt the existing "snap to nearest empty-area edge" rescue (preserve that behavior, but mark snapType `'frame-edge'` and `valid: true`).
5. Keep `snapEdges` as the **only** enforcing function, applied to the freeform ghost (not to suggestion).

### Phase 3 — New orchestrator `computeDragFrame()` *(depends on Phase 2)*
Replaces `snapOnDragPipeline`. Runs on the same watch trigger.
1. Build `freeform` from `dnd.draggingPlaceholder`, then apply only:
   - `snapRows` (row Y lock — keep current behavior so ghost stays on a row).
   - `snapEdges` clamp (boundary protection).
   - Write to `state.draggingPlaceholder`.
2. Compute candidates in priority order: frame-edge → grid-major → grid-minor → row-only fallback. First match wins. Build a tentative `suggestion`.
3. Run `evaluateValidity` against tentative; if invalid and no rescue, set `suggestion.valid = false`.
4. If `suggestion.valid` → assign to `state.dragSuggestion` and update `lastValidSuggestion`. Else → `state.dragSuggestion = lastValidSuggestion ?? { valid:false, snapType:'none', ... }`.
5. Reset `lastValidSuggestion` on drag start/stop watcher (already exists for `lastNotOverflowedPosition`).

### Phase 4 — Drop commit + getDraggingFrameData *(depends on Phase 3)*
1. Update `getDraggingFrameData()` so `current` reflects the **suggestion**, not the freeform ghost:
   - If `state.dragSuggestion.valid` → use its `rowUuid`/`sectionUuid`/`start_ms`/`end_ms`.
   - Else → mirror `initial` (revert).
2. No change required in `Dnd.vue`'s `handleOnDrop`; `frameData.current` already drives `timeline.updateFrame`. Verify revert path produces a no-op update.

### Phase 5 — Visualization *(depends on Phase 1, parallel with Phase 2-4)*
1. In `src/components/Features/Snapping.vue` (currently empty template), render two overlays inside the editor teleport target (`#editorAreaTeleports`):
   - **Target empty-area highlight**: a positioned `<div>` covering `[suggestion.targetEmptyArea.start_ms → end_ms] × [row top → row bottom]`, only when `dragging && suggestion.valid && targetEmptyArea`. Use a subtle tinted background via CSS class.
   - **Snap guide lines**: vertical lines at each `suggestion.guides[i].start_ms`/`end_ms`, full editor height, only while dragging.
2. In `src/components/Features/Dnd.vue`, change `activeHandler` so the rendered ghost reads `snapping.state.draggingPlaceholder` (now the **freeform** position) — same property name, new semantics — so the ghost follows the pointer freely. Add a small CSS hook for an "invalid" class driven by `!suggestion.valid` (left as future styling without functional impact).
3. Add minimal styles in `src/styles/basic-theme.css` for `.timeline-snap-target` and `.timeline-snap-guide`.

### Phase 6 — Verification
1. **Type check**: `npm run build` (or `tsc --noEmit`) to confirm `SnappingStateInterface` extensions compile.
2. **Playground manual checks** (`npm run dev`, open `playground/App.vue`):
   - Drag a frame freely across occupied frames — ghost follows pointer; previously it was clamped.
   - Hover near another frame's edge → empty-area highlight + guide line appear; release → frame snaps to that edge.
   - Hover near a major-grid line → guide line appears at the grid time; release → snaps to grid.
   - Drop while pointer is over an occupied frame and no valid suggestion was ever shown → frame returns to initial position; `drop` still fires.
   - Drop while last valid suggestion is stale (e.g., user moved away after a valid hover) → frame lands at the last valid suggestion. Confirm with user this is desired (otherwise see Further Considerations #1).
   - Drag across rows: row Y switches as pointer crosses rows; suggestion updates to new row's empty areas.
   - Boundary: drag past left/right edges → ghost still clamped by `snapEdges`.
3. **Regression**: resize behavior unchanged — resize a frame against a neighbor; clamp still works.

## Relevant files
- `src/composables/features/snapping.ts` — primary refactor: extend state, replace pipeline with evaluators + `computeDragFrame()`, update `getDraggingFrameData()`.
- `src/components/Features/Snapping.vue` — add suggestion overlays (empty-area highlight + guide lines).
- `src/components/Features/Dnd.vue` — confirm ghost reads freeform `draggingPlaceholder`; no change to `handleOnDrop` logic.
- `src/composables/features/draggingEvents.ts` — `DraggedFrameDataInterface.current` semantics now described as "suggested drop target or initial on revert"; no shape change.
- `src/styles/basic-theme.css` — add `.timeline-snap-target`, `.timeline-snap-guide` styles.
- `src/types/timeline.d.ts` — read-only reference for `emptyAreas` shape.

## Further Considerations
1. **Stale suggestion handling**: should `lastValidSuggestion` expire if the pointer leaves the suggestion area for >N ms or moves to a different row? Recommendation: clear `lastValidSuggestion` whenever pointer enters a new row OR whenever current evaluation produces an explicit invalid (vs missing) state. Confirm before implementation.
2. **Row highlight + invalid-state tint**: deferred. Easy to add later — `dragSuggestion` already carries `rowUuid` and `valid`. Mention in code comments.
3. **Multi-segment snap guides (start AND end)**: current `evaluateGridSnap` only picks one of start/end. We could show both guides; recommendation: keep single-edge (matches current snap math) for v1.
