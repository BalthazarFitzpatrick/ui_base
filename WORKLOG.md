# ui_base worklog

## 2026-09-02 — extracted from wowtomate's review tool

One stylesheet and three scripts, lifted out of `wowtomate/tools/review_ui` where they are in daily
use. The code was already generic — the only project-specific content was **comments**, so those
were rewritten to carry the principle rather than one project's nouns.

**Renamed on the way out:** `--keep-on` / `--discard-on` became `--accent-on` / `--muted-on`. Keep
and discard are one review tool's verbs; "the selecting colour" and "the rejecting colour" are the
general idea, and a framework should not make every consumer inherit someone else's vocabulary.

**Added:** `Menu` gained a `node` section kind earlier the same day — an escape hatch for
caller-built content, so a slider pair inside a menu did not need a bespoke section type. That is
the sort of generic primitive this package exists to hold.

**The demo serves assets exactly the way a real tool does** (`/` plus `/ui/`), which means the
README's integration instructions cannot drift from reality without the demo breaking.

**`read_asset` resolves then checks containment** rather than string-matching on `..` — the only
reliable test, and the classic hole in any route that concatenates a caller-supplied name onto a
directory. Verified by hand: `../pyproject.toml` and a url-encoded traversal both 404.

**Deliberately not done:** migrating wowtomate onto this package. It had just been heavily refactored
and was in daily use; changing it again the same day would confuse a regression with the migration.
That is task 1, and it is what will prove the seam is real rather than assumed.

## 2026-09-02 — first consumer, and the lichen corrected

**wowtomate now consumes this package** (task 1). It takes `ui-base` as an editable path dependency
and serves `/ui/` local-first: its own `review_ui/` wins, ui_base fills in the rest. `menu.js`,
`shell.js` and `align.js` are deleted from wowtomate.

**The extraction held.** The three copies differed only in *comments* — wowtomate's named kernels and
nameplates where ui_base's are generalised — and every line of code was identical. Nothing had to be
reconciled, which is the outcome task 1 existed to test. The only friction was `requires-python`:
this package said 3.12 for no reason and wowtomate supports 3.11, so a floor above a consumer's made
it uninstallable there. Lowered.

CSS is deliberately not merged. wowtomate has `app.css` + `tabs.css` where this has `base.css`;
unifying them is a visual change nobody asked for.

**The lichen is now a correction, not a sample.** Fabian, on the sampled `#bcbf88`: *"much more
vibrant, like a pale lime, the photos dont do it justice."* He was right and the median was wrong —
faithful to the photograph rather than to the lichen. Overcast light and phone processing meant no
pixel in the image was both vibrant and pale: the most saturated is dark (`#6c6e3b`, value 0.43),
the brightest washed out (`#fcfebb`, saturation 0.26). Nine candidates went on the colour board; he
picked at hue 76. `--lichen` is `#c7ed5f`, `--lichen-deep` followed it to `#788f39`.

The README now says the hue was measured and the saturation corrected by the person who was there,
because a palette that says "sampled" invites the next person to trust the number over the witness.

**A false claim found while doing it:** `--lichen-deep`'s comment said it was "a fill that carries
cream text". Cream on it is **3.00**, well under the 4.5 text needs — the 4.88 it cited was contrast
against the *ground*, mislabelled. Anyone trusting it would have shipped unreadable text.

**Test suite added** (task 3): 16 tests over the three failures this package can have — serving what
it should not, failing to serve what a consumer links, and shipping broken CSS or JS.
