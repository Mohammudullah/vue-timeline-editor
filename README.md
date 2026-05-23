# Vue Timeline Editor

A lightweight, flexible, and interactive timeline editor for Vue 3.

Designed for building booking systems, schedulers, and resource timelines with full control over UI and behavior. Every interactive capability is an **opt-in, tree-shakeable feature component** — you only ship what you mount.

---

## ✨ Features

- 📅 Horizontal, time-based grid with configurable range and zoom
- 🧱 Multi-section / multi-row layout (tables, resources, zones)
- 🖱 Drag frames to move them between times and rows (`<Dnd/>`)
- ↔️ Resize frames from either edge (`<Resize/>`)
- 🎯 Snap to grid, frame edges, and rows (`<Snapping/>`)
- 📏 Static + active snap guide lines (`<SnapGuideLines/>`)
- ➕ Click (or tap) an empty area to create a frame (`<Sections rowClickable/>`)
- 🔗 Linked frames that move/resize together (`<JoinRows/>`)
- ▶️ Playhead with drag, click-seek, and a built-in play loop (`<Playhead/>`)
- ✋ Pan by click-drag (`<PanScroll/>`)
- 🪝 Optimistic add/remove with server-confirm and auto-revert
- 🎨 Fully customizable via slots and a single overridable theme stylesheet
- ⚡ Sticky section headers, transform-based axis rendering

---

## 🚀 Installation

```bash
npm install @mohammadullah/vue-timeline-editor
```

Peer dependency: **Vue ^3.3**.

Import the base theme once in your app entry:

```ts
import '@mohammadullah/vue-timeline-editor/basic-theme.css';
```

---

## ⚡ Quick start

```vue
<script setup lang="ts">
import {
  Timeline, Sections, Dnd, Resize, Snapping, SnapGuideLines,
} from '@mohammadullah/vue-timeline-editor';
import '@mohammadullah/vue-timeline-editor/basic-theme.css';

const sections = [
  {
    title: 'Section 1',
    uuid: 'section1',
    rows: [
      {
        uuid: 'row1',
        title: 'Row 1',
        frames: [
          { uuid: 'frame1', title: 'Booking', start_ms: 0, end_ms: 2 * 60 * 60 * 1000 },
        ],
      },
    ],
  },
];
</script>

<template>
  <Timeline :initial-range="{ start_seconds: 0, end_seconds: 24 * 60 * 60 }">
    <Sections :sections="sections" />
    <Dnd />
    <Resize />
    <Snapping />
    <SnapGuideLines />
  </Timeline>
</template>
```

`<Timeline>` is the only required component. Everything inside it is optional —
mount a feature component to enable that behavior, omit it to drop the code.

---

## 🧩 Components

### `<Timeline>`

Root component. Provides the timeline context to every descendant feature.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialRange` | `{ start_seconds, end_seconds }` | `0 → 24h` | Visible time window. `start_seconds` is a hard left bound. |
| `timeAxisTimeFormat` | `string` | `'HH:mm:ss'` | Time-axis label format (e.g. `'hh:mm a'`). |

| Event | Payload | Description |
|-------|---------|-------------|
| `@init` | `TimelineInitInterface` | Fires once mounted — exposes the imperative API. |
| `@scroll` | `Event` | Editor scrolled. |

| Slot | Props | Description |
|------|-------|-------------|
| `#frame` | `{ uuid, title, startMs, endMs, meta, selected, ... }` | Replaces a frame's inner content. Honored by drag/resize ghosts too. |
| `#rowLabel` | `{ uuid, title, sectionUuid }` | Replaces a row's label content in the row axis. |

**Reactive slot content.** Slot templates render in *your* component's scope,
so they can close over your own reactive state — the timeline only needs to
hand over the `uuid`. Keep a reactive map keyed by uuid and read it inside the
slot; mutating it updates the slot live, with no `meta`, re-init, or extra
props:

```vue
<script setup>
const rowAccents = ref({});            // your own reactive state
const tint = () => { rowAccents.value = { row1: '#e53935' }; };
</script>

<template>
  <Timeline>
    <template #rowLabel="{ uuid, title }">
      <span :style="{ color: rowAccents[uuid] }">{{ title }}</span>
    </template>
    <template #frame="{ uuid, title }">
      <span :style="{ color: rowAccents[uuid] }">{{ title }}</span>
    </template>
  </Timeline>
</template>
```

### `<Sections>`

Initializes section/row/frame data and provides click-to-add on empty areas.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sections` | `TimelineSectionInterface[]` | — | The section/row/frame tree. |
| `rowClickable` | `boolean` | `false` | Enable the empty-area new-frame suggestion globally. |
| `newFrameLabel` | `string` | `'+ Add'` | Touch-mode label text in the suggestion box. |
| `availableSlots` | `{ uuid, available_slots: { start_ms, end_ms }[] }[]` | — | Allowlist: per-row time windows the user may pick. When set, the editor dims/locks and only these slots stay interactive. |
| `selectedTables` | `{ uuid, start_ms, end_ms }[]` | — | Picked table+slot pairs — rendered selected. |
| `selectedRowUuids` | `(string \| number)[]` | — | Row uuids whose allowed slots render selected (simpler than `selectedTables` when every pick shares one time). |
| `frameHoldDuration` | `number` | `600` | Press-and-hold time (ms) before `@frame-hold` fires. |
| `frameHoldThreshold` | `number` | `8` | Movement tolerance (px); moving past it cancels the hold. |
| `silentExternalSelection` | `boolean` | `false` | When true, `@frame-selected` / `@frame-deselected` fire only for user-driven changes (clicks). Programmatic changes (`selectByUuid`, `scrollToViewPort(_, _, true)`, etc.) are silent. |

| Event | Payload | Description |
|-------|---------|-------------|
| `@add-frame` | `(suggestion, event)` | Empty area activated. `suggestion = { rowUuid, sectionUuid, start_ms, end_ms }` — the host creates the frame. |
| `@select-slot` | `(slot, event)` | An allowlist slot was clicked. Same shape as `add-frame`'s `suggestion`. |
| `@frame-hold` | `(frame, event)` | A frame was pressed and held in place. |
| `@frame-selected` | `(frame)` | A frame became the selection's primary. |
| `@frame-deselected` | `(frame)` | A frame stopped being the primary. When switching frames, `@frame-deselected` is **always emitted before** `@frame-selected`. |

| Slot | Props | Description |
|------|-------|-------------|
| `#label` | `{ rowUuid, sectionUuid, start_ms, end_ms, length_ms }` | Overrides the touch-mode suggestion label. |

A row may carry an optional `new_frame_ms` — the suggested frame is that long
(capped by the available gap). Without it, `rowClickable` suggests the whole
empty gap. On touch, the first tap latches the box; a second tap on it emits.

**Allowlist mode** — passing `availableSlots` dims and locks the whole editor
except the listed slots, which stay clear and clickable (`@select-slot`).
Typical use: joining tables, where a join is only valid at the same time, so
free clicking anywhere would be wrong. Clearing the prop exits the mode.

### `<Dnd>`

Drag frames to move them. Drags the whole selection together.

- **Prop:** `edgeSnap` (`boolean`, default `true`).
- **Events:** `@dragStart`, `@dragEnd`, `@drop`, `@dragCancel`, `@dragBlocked`.
- **Slot:** `#highlighter` — replaces the drop-target indicator.

### `<Resize>`

Resize a frame from either edge.

- **Events:** `@resizeStart`, `@resizeEnd`, `@resized`, `@resizeCancel`, `@resizeBlocked`.

### `<Snapping>`

Snaps drag/resize to the grid, frame edges, and rows, and protects against
overlap. Each pipeline step is a toggle prop (all default `true`):

`rows`, `frames`, `times`, `guides`, `overlapping`.

```vue
<Snapping :overlapping="false" />  <!-- allow overlapping frames -->
```

Re-emits the drag events so it can be used as the primary event source.

### `<SnapGuideLines>`

Renders grid lines and active snap guides.

- **Props:** `majorGrid` (`true`), `minorGrid` (`false`), `activeSnapGuides` (`true`).
- **Slots:** `#majorGrid`, `#minorGrid`, `#activeSnapGuide`.

### `<JoinRows>`

Frames sharing a `linkGroupUuid` move and resize as one linked group.
No props — mount it alongside `<Dnd/>` / `<Resize/>`.

### `<PanScroll>`

Click-and-drag panning of the editor (mouse only; touch scrolls natively).

### `<Playhead>`

A draggable position marker with a ruler handle, a full-height line, and an
off-screen edge indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `v-model` | `number` | — | Playhead position in ms. |
| `v-model:playing` | `boolean` | — | Playback running state. |
| `rate` | `number` | `1` | Timeline-ms advanced per real-ms while playing. |
| `loop` | `boolean` | `false` | Wrap to start instead of pausing at the end. |
| `draggable` | `boolean` | `true` | Allow dragging / ruler scrubbing. |
| `clickSeek` | `boolean` | `true` | Allow clicking the ruler to jump. |
| `onTimelineMountedScrollToPlayHead` | `boolean` | `false` | Scroll the playhead into view once after mount. |

Events: `@seek`, `@dragStart`, `@dragEnd` (plus the `update:` events). Out of
range, the playhead hides and an edge arrow points toward it.

---

## 🗂 Data shapes

```ts
interface TimelineSectionInterface {
  uuid: string | number;
  title: string;
  rows: TimelineRowInterface[];
}

interface TimelineRowInterface {
  uuid: string | number;
  title: string;
  frames: TimelineFrameInterface[];
  new_frame_ms?: number;          // optional click-to-add length
}

interface TimelineFrameInterface {
  uuid: string | number;
  title: string | null;
  start_ms: number;               // absolute ms
  end_ms: number;
  linkGroupUuid?: string | number; // links frames for <JoinRows/>
  meta?: unknown;                  // arbitrary payload, passed to #frame
}
```

All times are absolute milliseconds; the visible window is set in seconds via
`initialRange`.

---

## 🔌 Imperative API

`@init` hands back the live API:

```vue
<Timeline @init="onInit">...</Timeline>
```

```ts
import type { TimelineInitInterface } from '@mohammadullah/vue-timeline-editor';

const onInit = (api: TimelineInitInterface) => {
  // api.timeline, api.config, api.container, api.features

  // Frame CRUD (optimistic add with server confirm + auto-revert):
  const handle = api.timeline.addFrame(
    { uuid: 'tmp', title: 'New', start_ms: 0, end_ms: 3600000, rowUuid: 'row1', sectionUuid: 'section1' },
    async (frame) => ({ uuid: await saveToServer(frame) }), // optional sync
  );
  api.timeline.removeFrame('frame1', () => confirmOnServer('frame1'));
  api.timeline.scrollToViewPort('frame1', true);

  // Selection:
  api.features.data.frames.getSelectedFrames();

  // Playhead (when <Playhead/> is mounted):
  api.features.data.playhead?.seek(3600000);
  api.features.data.playhead?.play();
};
```

`addFrame` / `removeFrame` are optimistic: the change applies immediately, and
if the optional sync/confirm callback rejects, it auto-reverts. `syncFrame` /
`syncFrames` provide plain upserts. Sections can also be set imperatively with
`api.timeline.initSections(sections)`.

---

## 🎨 Theming

All visuals come from one stylesheet — `basic-theme.css`. Override any
`.vtd__*` class in your own CSS to restyle. Structural rules live in the
package's bundled `style.css` (injected automatically); colors, borders, and
typography live in `basic-theme.css`, which you import and may override.

---

## 🌳 Tree-shaking

Feature components are also published as individual entry points, so a bundler
can drop unused features entirely:

```ts
import { Timeline } from '@mohammadullah/vue-timeline-editor';
import Dnd from '@mohammadullah/vue-timeline-editor/features/dnd';
import Snapping from '@mohammadullah/vue-timeline-editor/features/snapping';
import Sections from '@mohammadullah/vue-timeline-editor/features/sections';
import Resize from '@mohammadullah/vue-timeline-editor/features/resize';
import Playhead from '@mohammadullah/vue-timeline-editor/features/playhead';
```

---

## 📄 License

MIT
