// The queue rail.
//
// Each thumbnail shows the *cropped* result, not the source, so the strip is a
// live contact sheet of what you are about to export. Watching it fill in is
// the whole reward loop for a twenty-image batch.

const THUMB_H = 56;

export function createFilmstrip({
  root, rail, bar, text, note, approveAll, enableBatch, onActivate, onApproveAll, onEnableBatch,
}) {
  const cells = new Map();  // item id -> {el, canvas, key}

  function drawThumb(canvas, item, target) {
    const ratio = target.w / target.h;
    const h = THUMB_H;
    const w = Math.max(16, Math.round(h * ratio));
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const f = item.frame;
    if (!f) return;
    ctx.drawImage(item.image, f.cx - f.cropW / 2, f.cy - f.cropH / 2, f.cropW, f.cropH, 0, 0, w, h);
  }

  function build(item, index) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'thumb';
    const canvas = document.createElement('canvas');
    const check = document.createElement('span');
    check.className = 'thumb-check';
    check.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span');
    num.className = 'thumb-num';
    num.textContent = String(index + 1);
    el.append(canvas, check, num);
    el.addEventListener('click', () => onActivate(cells.get(item.id).index));
    return { el, canvas, key: '', index };
  }

  function sync(state) {
    const { items, activeIndex, target, batch } = state;

    // Off, the bar is not a queue: it is the sign that says a queue exists.
    // It stays visible and inert rather than disappearing, because a control
    // nobody can see is a control nobody knows about (DEC-02).
    root.classList.toggle('is-off', !batch);
    note.hidden = batch;
    enableBatch.hidden = batch;
    text.hidden = !batch;
    approveAll.hidden = !batch;
    if (!batch) {
      for (const [, cell] of cells) cell.el.remove();
      cells.clear();
      bar.style.width = '0%';
      root.classList.remove('is-complete');
      root.hidden = false;
      return;
    }

    // Drop cells for items that are gone.
    for (const [id, cell] of cells) {
      if (!items.some((i) => i.id === id)) { cell.el.remove(); cells.delete(id); }
    }

    items.forEach((item, index) => {
      let cell = cells.get(item.id);
      if (!cell) {
        cell = build(item, index);
        cells.set(item.id, cell);
        rail.append(cell.el);
      }
      cell.index = index;
      cell.el.querySelector('.thumb-num').textContent = String(index + 1);

      // Redraw only when the crop or the target actually moved.
      const f = item.frame;
      const key = f ? `${Math.round(f.cx)},${Math.round(f.cy)},${Math.round(f.cropW)},${target.w}x${target.h}` : '';
      if (key !== cell.key) { drawThumb(cell.canvas, item, target); cell.key = key; }

      cell.el.classList.toggle('is-active', index === activeIndex);
      cell.el.classList.toggle('is-approved', item.approved);
      cell.el.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
      cell.el.setAttribute('aria-label',
        `${item.file.name}${item.approved ? ', framed' : ''} — image ${index + 1} of ${items.length}`);
    });

    const done = items.filter((i) => i.approved).length;
    bar.style.width = items.length ? `${(done / items.length) * 100}%` : '0%';
    text.textContent = `${done} / ${items.length} framed`;
    root.classList.toggle('is-complete', items.length > 0 && done === items.length);
    approveAll.disabled = !items.length || done === items.length;
    root.hidden = items.length === 0;
  }

  // Keep the current image in view without yanking the strip around.
  function scrollToActive(state) {
    const item = state.items[state.activeIndex];
    const cell = item && cells.get(item.id);
    if (cell) cell.el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  // A visible acknowledgement that the frame was accepted.
  function celebrate(state) {
    const item = state.items[state.activeIndex];
    const cell = item && cells.get(item.id);
    if (!cell) return;
    cell.el.classList.remove('just-approved');
    void cell.el.offsetWidth;   // restart the animation
    cell.el.classList.add('just-approved');
  }

  // A replace happened while the queue was switched off: say so on the bar that
  // could have caught it, so the offer is made at the moment it is relevant.
  function flashOffer() {
    root.classList.remove('just-offered');
    void root.offsetWidth;    // restart the animation
    root.classList.add('just-offered');
  }

  approveAll.addEventListener('click', onApproveAll);
  enableBatch.addEventListener('click', onEnableBatch);

  return { sync, scrollToActive, celebrate, flashOffer };
}
