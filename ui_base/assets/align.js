// dragging a crop under a fixed guide, wasd 1px nudging, and a live preview of the result - the three
// things only the tune tab could do. lifted out here so any tab that shows a crop can align it
//
// OWNS NO PERSISTENCE ON PURPOSE. tune saved a corrected rect through /api/decide; discard /
// promote does not save one at all. the host is told the rect changed and decides what that means,
// which is the only thing that makes this mountable in more than one place

function alignClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// viewport   the element holding .drag-image and, optionally, .guide-overlay
// rect       {left, top, width, height} in crop-local pixels - the slice that gets extracted
// bounds     {width, height} of the whole crop, also crop-local - the clamp box
// target     {left, top, width, height} the guide sits at and the rect is aligned to. its width
//            is the guide's own drawn width, which need not be the rect's - a guide may be
//            the MIRRORED shape, twice the kept width, while the extracted rect is one half of it
// scale      crop-local pixels to screen pixels
// preview    optional {img, src(rect)} - the live result picture, refetched at most once a frame
// onChange   called with the rect after every drag, nudge or resize; not called on mount
function makeAligner({viewport, rect, bounds, target, scale, preview = null, onChange = () => {}}) {
  const img = viewport.querySelector('.drag-image');
  const guide = viewport.querySelector('.guide-overlay');
  let drag = null, previewPending = false;

  function paint() {
    // the image moves, the guide never does - the guide is pinned at the rect's target position
    // and the picture slides underneath by however far the rect has been dragged off it
    const dx = (target.left - rect.left) * scale, dy = (target.top - rect.top) * scale;
    img.style.transform = `translate(${dx}px, ${dy}px)`;
    if (guide) {
      guide.style.left = target.left * scale + 'px';
      guide.style.top = target.top * scale + 'px';
      guide.style.width = target.width * scale + 'px';
      guide.style.height = target.height * scale + 'px';
    }
  }

  function paintPreview() {
    if (!preview || !preview.img) return;
    const el = preview.img;
    // a rect dragged fully off the frame has no valid crop - hide it rather than show a broken
    // image glyph, which reads as a rendering fault instead of "nothing here yet, align it"
    el.onerror = () => { el.style.visibility = 'hidden'; };
    el.onload = () => { el.style.visibility = 'visible'; };
    el.src = preview.src(rect);
  }

  // at most one fetch per animation frame. one per mousemove returned a differently-sized
  // image dozens of times a drag, and each arriving response reflowed the box - the "jumping"
  function schedulePreview() {
    if (!preview || previewPending) return;
    previewPending = true;
    requestAnimationFrame(() => { paintPreview(); previewPending = false; });
  }

  function moveTo(left, top) {
    rect.left = alignClamp(left, 0, bounds.width - rect.width);
    rect.top = alignClamp(top, 0, bounds.height - rect.height);
    paint();
    schedulePreview();
    onChange(rect);
  }

  const onDown = evt => { drag = {x: evt.clientX, y: evt.clientY, from: {...rect}}; };
  // on window, not the viewport - a fast drag leaves the viewport's bounds constantly, and losing
  // those mousemoves made the box jump when the cursor came back in
  const onMove = evt => {
    if (!drag) return;
    moveTo(drag.from.left - (evt.clientX - drag.x) / scale,
           drag.from.top - (evt.clientY - drag.y) / scale);
  };
  const onUp = () => { drag = null; };

  viewport.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  paint();
  paintPreview();

  return {
    rect,
    // 1px keyboard nudge, through the same clamp the drag uses - for last-pixel corrections that
    // are fiddly to land with a mouse
    nudge(key) {
      if (key === 'w') moveTo(rect.left, rect.top - 1);
      else if (key === 's') moveTo(rect.left, rect.top + 1);
      else if (key === 'a') moveTo(rect.left - 1, rect.top);
      else if (key === 'd') moveTo(rect.left + 1, rect.top);
    },
    // resize AROUND THE CURRENT CENTRE, so whatever alignment is already dragged into place
    // survives - only the size changes, never the position. nextTarget carries the guide's new
    // position and drawn size, which the host works out because only it knows the crop's shape
    resize(width, height, nextTarget = null) {
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      rect.width = width;
      rect.height = height;
      if (nextTarget) Object.assign(target, nextTarget);
      moveTo(cx - width / 2, cy - height / 2);
    },
    // the guide's position depends on the crop's height, so a height change moves it
    setTarget(next) { Object.assign(target, next); paint(); schedulePreview(); },
    setScale(next) { scale = next; paint(); },
    refresh() { paint(); paintPreview(); },
    // MUST be called before dropping the host element. these listeners are on window, so a
    // re-render that only replaced the dom left the old pair behind, one more on every render
    destroy() {
      viewport.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    },
  };
}
