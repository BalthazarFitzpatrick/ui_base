# ui_base

The shared web interface for these tools. One stylesheet and three scripts — menus, dropdowns, a tab
shell, sliders, pan/zoom and crop alignment — that a local Python tool serves to get an interface
that looks and behaves like one product.

**No build step, no framework, no npm.** A `<link>` and three `<script>` tags.

```bash
uv sync
uv run python demo/serve.py --port 8770     # every component, on one page
```

## Why this exists as a project rather than a copy

These grew inside one tool, and every behaviour here was paid for by a real failure there:

- a popup with no dismiss handler left a stale selection alive, which the *next* right-click swept
  up and applied — so `Menu` always fires `onDismiss`, even when cancelled
- a shared dismiss handler hardcoded its trigger ids in one selector string, so every new menu had
  to be added to it or it closed on its own opening click
- `reset view` set the scale back to 1 and left the pan alone, which reads as a button that half
  works — so reset centres too
- with shift held, a browser sends the wheel as `deltaX`; reading `deltaY` alone made every
  shift+scroll take the zoom-out branch, so the image only ever shrank

Copying the files into the next project copies the code and loses the reasons. The reasons are most
of the value, so they live in the comments here and travel with it.

## Using it

```python
from ui_base import ASSETS, read_asset, UiBaseError

# in a request handler, for a path like /ui/menu.js
try:
    body = read_asset(name)          # refuses anything outside ASSETS
except UiBaseError:
    ...  # 404
```

Then in the page. **Order matters**: `base.css` first so your own stylesheet can override it, and
`shell.js` before the script that calls `initShell`.

```html
<link rel="stylesheet" href="/ui/base.css">
<link rel="stylesheet" href="/ui/your-layout.css">
<script src="/ui/menu.js"></script>
<script src="/ui/shell.js"></script>
<script src="/ui/align.js"></script>   <!-- only if you need crop alignment -->
```

`read_asset` resolves the path and checks it is still inside `ASSETS`, rather than string-matching
on `..` — the only reliable test, and the classic hole in a route that concatenates a
caller-supplied name onto a directory.

## What is in it

| file | gives you |
|---|---|
| `base.css` | the tokens and the primitives: `.toggle`, dividers, columns, panels, the row height |
| `menu.js` | `Menu`, `listMenu`, `renderTree`, `makeSlider`, `makePanZoom` |
| `shell.js` | `initShell`, `activateTab` — tabs, keyboard nav, and remembering where you were |
| `align.js` | `makeAligner` — drag a crop under a fixed guide, `wasd` nudging, live preview |

### `Menu`

One class for every popup: dropdowns, right-click menus, pickers. Generic sections, so a new menu is
a data structure rather than new code.

```js
new Menu({
  title: 'open a thing',
  columns: false,              // true lays sections side by side, split by a vertical rule
  onDismiss: () => {},         // ALWAYS fires - this is what stops a stale selection surviving
  sections: [...],
}).openAt(triggerElement);     // or .openAt({x, y}) for a right-click
```

| section kind | for |
|---|---|
| `list` | rows with optional `stats`, `on`, `disabled`, and a trailing `action` control |
| `columns` | two or more multi-select axes side by side, split by dividers |
| `add` | a "+ new" row: a text field and a button |
| `field` | a single text input |
| `buttons` | a footer row of actions |
| `node` | the escape hatch — content you built yourself, placed and styled by the panel |

`listMenu(title, items, onPick)` is the one-liner for the common case.

The class owns anchoring, viewport clamping, one-menu-at-a-time, dismissal on outside click and
Escape, and arrow/Enter keyboard navigation. Call sites never repeat any of that.

### `makeSlider`

An axis with ticks rather than a number field, because a threshold is a position in a range. Takes
an optional `distribution` drawn over the axis — the point being that *"no results"* and *"no
results because your cut sits above every value in the data"* look identical until something shows
the shape.

### `makePanZoom`

Wheel zoom anchored on the pointer, drag to pan, `reset(width, height)` to fit and centre. Zooming
about a corner walks whatever you are aiming at off screen, which is the thing zoom exists to
prevent.

### `makeAligner`

For last-pixel work: drag the image under a fixed guide, `wasd` for 1px steps, clamped to the crop,
with an optional live preview of the result. It owns the interaction and the clamping and **owns no
persistence** — the host decides where a corrected rect is saved, which is what makes it reusable.

## The visual language

Six rules carry the whole look. They are in `base.css`'s header too, because that is where someone
about to override something will be looking.

1. **One row height, app-wide** (`--row-height`). Every row and button is that tall, so nothing
   reads as a different size class.
2. **One clickable class**, `.toggle` — buttons, list rows, filter pills, dropdown heads.
3. **Dividers never touch the container edge.** 15px inset, 2px thick — the same weight as a button
   border, because a 1px rule beside 2px buttons reads as a different system.
4. **Selection is bright, rejection is muted.** Rejecting something is a decision, not an
   achievement; giving it the accent makes a wall of rejections look like a wall of wins.
5. **Text stays selectable.** `user-select: none` on controls also makes every name and readout
   uncopyable, which costs more than the stray drag-select it prevents.
6. **Monospace throughout**, because these tools show filenames, counts and coordinates, and those
   line up or they are not readable.

Override by redefining the tokens, not by fighting the rules.

## Status

Extracted from wowtomate's review tool, where all of this is in daily use. wowtomate still carries
its own copies; moving it onto this package is the next step, and is what will prove the seam is
real rather than assumed.
