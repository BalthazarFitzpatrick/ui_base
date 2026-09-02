# Bootstrapping a detector from nothing

You have a pile of frames and you want a model that finds a particular object in them. You have no
labels, and labelling by hand is the expensive part — not the training.

This describes a loop that makes each pass cheaper than the last, and how to build its interface out
of `ui_base`. It is a working shape, not a theory: every design note below is here because the
obvious alternative was tried first and failed in a specific way.

---

## The loop

```
   ┌──────────────────────────────────────────────────────┐
   │                                                      │
   ▼                                                      │
 find  ──▶  discard / promote  ──▶  train  ──▶  sweep  ───┘
proposes      a human decides      a small     where to
  boxes                             model      cut scores
```

**find** proposes boxes. **A human keeps or discards them.** **Promote** turns the kept ones into a
training set. **Train** fits a small model. **Sweep** runs it back over the frames and shows you the
score distribution so you can choose a threshold. Then the model becomes the proposer for the next
round, and the human is correcting rather than labelling.

The whole point is that the human's attention is the scarce resource. Round one asks for a lot of
it. Round four should ask for almost none.

### Round one has a chicken-and-egg problem

`find` needs a detector, and you have none. Break it by hand: draw ten or twenty boxes yourself, cut
them out, and use them as templates for normalised cross-correlation over the rest of the frames.
NCC is crude and it is enough — you are not trying to be right, you are trying to produce candidates
worth a yes/no.

**Masked NCC is not scale invariant.** If your frames come from more than one capture size, a
template cut at one size silently fails at the other — not with an error, with a low score that
reads as "not present". Either keep one template library per capture size, or search a small pyramid
of scales and record which one won. Recording it matters: once a stream locks onto a scale you can
stop searching the others, which is most of the cost back.

---

## The stages, in detail

### find

Input: frames, plus either a template library or a trained model.
Output: one row per candidate — frame path, box, score, and what proposed it.

Write candidates as JSONL, one object per line:

```
{"path": "0000005.jpg", "left": 951, "top": 478, "width": 226, "height": 35,
 "matched_template": "drawn", "score": 1.0}
```

Keep the proposer's identity in the row (`matched_template` above). When you later ask "why is the
model bad at X", the answer is usually "every example of X came from one proposer that was itself
bad at X", and you cannot ask that question if you did not record it.

**Decisions live in a separate file from the boxes.** A sidecar keyed by row index:

```
{"0": {"keep": true, "origin": "drawn"}, "1": {"keep": false, "origin": "drawn"}}
```

Two files rather than one mutable file, because the boxes are expensive and the decisions are cheap.
You will re-decide many times; you should never be rewriting the file that holds coordinates a human
drew. **Closing the review must not overwrite the boxes** — make close non-destructive and archive
rather than replace. Getting this wrong loses hand-drawn work that cannot be regenerated, and it is
the single most expensive mistake available in this pipeline.

### discard / promote

The human sees a candidate, keeps or discards it. Then `promote` turns the kept set into training
rows.

**Promote also generates negatives, and this is free money.** For each kept box, place one box of
the same size somewhere else in the same frame where no kept box sits. That rests on one assumption
— *the reviewer marked every instance visible in that frame* — and given it, everywhere else in that
frame genuinely is background. Without this you have only positives, and hard negatives otherwise
only arrive after a model has fired wrongly and been corrected.

Three details that each cost a debugging session:

- **Seed the placement.** Promoting twice must produce the same negatives, not quietly double them.
- **The negative rectangles must not overlap a positive, but the training crops around them may.**
  A crop is a wide window; demanding disjoint crops leaves nowhere to stand on a busy frame.
- **Verify the overlap is actually zero** rather than assuming. A negative sitting on a positive
  teaches the model that the thing it is looking for is background, and nothing will tell you.

When resolving which candidate file a promote refers to, **do not take the first glob match**.
Sorting is not chronology: a file tagged `cnn-` sorts before one tagged `drawn-`, so a naive match
resolves hand-drawn boxes against a model-generated file and writes zero rows, successfully.

### train

A small heatmap model in the CenterNet style is plenty — on the order of 50k parameters. It predicts,
per class, a low-resolution heatmap whose peaks are object centres, plus a size regression.

**Independent sigmoid channels, not a softmax.** Softmax forces the classes to compete for one
prediction, so two overlapping objects of different classes cannot both be reported, and the model
spends capacity deciding between them instead of deciding whether anything is there at all.

**Train on whole frames plus centre coordinates — never on pre-cut crops.** Cutting crops in advance
freezes one framing of each object into the dataset, and the model learns that framing. Take a
window around the object at load time with random jitter (40% of the box size is a reasonable start).
The window must be large enough that a jittered object still fits entirely inside it; derive that
minimum from the box size and the jitter rather than hardcoding it, or large objects silently train
on partial views.

**If you use Apple's MPS backend, it is not thread safe.** Two threads touching tensors will segfault
inside the Metal kernels rather than raising. One lock around all model access, and make status
reads non-blocking so the UI does not hang behind a training step.

### sweep

Run the trained model over the frames, keep everything above a low floor, and **plot the score
distribution**.

This is the stage people skip, and it is the one that makes the threshold choosable. A slider showing
"0 results" and a slider showing "0 results because your cut sits above every score in the data" look
identical until something draws the shape. Keep the floor low enough that the distribution has a
shape to look at, high enough that an untrained model's noise floor is not the entire picture.

Then the kept candidates go back to `find`'s review queue, and the loop closes.

---

## Building the interface with `ui_base`

Three tabs — **find**, **review**, **train** — and almost no bespoke interface code.

```html
<link rel="stylesheet" href="/ui/base.css">
<link rel="stylesheet" href="/ui/your-layout.css">
<script src="/ui/menu.js"></script>
<script src="/ui/shell.js"></script>
<script src="/ui/align.js"></script>
```

Order matters: `base.css` first so your own stylesheet can override it, and `shell.js` before the
script that calls `initShell`.

Serve them from your Python process:

```python
from ui_base import UiBaseError, read_asset

# in a request handler, for a path like /ui/menu.js
try:
    body = read_asset(name)   # refuses anything outside the assets directory
except UiBaseError:
    ...                       # 404
```

Serve your own files first and fall back to `ui_base`, so a tool can override a shared file by
dropping one of the same name beside its own without editing the package everyone else reads.

### What maps to what

| you need | use |
|---|---|
| the three tabs, keyboard nav, remembering where you were | `initShell`, `activateTab` |
| dataset / model / recording pickers | `listMenu(title, items, onPick)` |
| a filter popup with several axes | `Menu` with a `columns` section |
| "+ new dataset" inline | `Menu` with an `add` section |
| the score threshold, with the distribution drawn on it | `makeSlider(..., {distribution})` |
| the frame viewer | `makePanZoom` |
| nudging a box to the pixel | `makeAligner` |

`Menu` owns anchoring, viewport clamping, one-menu-at-a-time, dismissal on outside click and Escape,
and arrow/Enter navigation. Call sites never repeat any of it. It **always** fires `onDismiss`, even
when cancelled — a popup that returns nothing on cancel leaves a stale selection alive, which the
next interaction picks up and applies to the wrong thing.

`makeAligner` owns the dragging, the `wasd` nudging and the clamping, and deliberately owns **no
persistence**. The host decides where a corrected box is saved. That is what makes it reusable.

### The parts you write yourself

**A status endpoint per long-running job.** Sweeping and training take minutes. Run them on a thread,
expose `{running, done, total, error, finished, ...}`, and poll it.

**Buttons that exist before they work.** The control that consumes a sweep's output should be visible
and greyed from the start, not absent until the sweep finishes. A button that appears late reads as a
bug; a greyed button reads as a sequence.

**Return the whole state from every write, not a delta.** There is one small state object and
re-sending it costs nothing, and it means the page cannot drift out of step with the server after a
failed request. Then have exactly one function that repaints everything the state drives, and call it
from every place that assigns state — otherwise the next view someone adds gets forgotten by half the
write paths, and you get a page showing "nothing marked yet" beside a list of marks.

**Read your paths through the module, never `from ... import SESSIONS_DIR`.** An importing module
binds a copy at import time, so a test that patches the path is patching a name the code no longer
reads — and the suite passes while writing to your real data directory. Reference them as
`paths.SESSIONS_DIR` at call time, and add a test that greps the source for the by-value form.

---

## The failure this whole shape is built against

A value that is valid in one context, used in another, where nothing objects.

A box measured against one capture size, applied to a different one — every coordinate is a plausible
number and every one is wrong. A profile that describes a different screen than the one being
captured: each individual check passes, because one verifies the boxes fit inside the declared size
and another verifies the frames are consistent with each other, and neither asks whether the
declaration matches reality.

Nothing raises. The run completes. The data is worthless and looks fine.

So: **record what a measurement was taken against, and check it at the point of use.** Not because
the check is clever, but because it is the only kind of error here that a green test suite and a
clean log will both happily endorse.
