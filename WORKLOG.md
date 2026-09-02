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
