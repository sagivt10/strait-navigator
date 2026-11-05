// Presentation only: the score and the final fictional comparison never change.
const activeEntries = new WeakMap();
const medalClasses = ['medal-gold', 'medal-silver', 'medal-bronze'];
const medalLabels = ['GOLD', 'SILVER', 'BRONZE'];
const medalIcons = ['🏆', '🥈', '🥉'];
const noopController = () => ({ finish() {}, cancel() {} });

export function getRankClimbPositions(finalPosition, rowCount = 7) {
  if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 7 ||
      !Number.isInteger(finalPosition) || finalPosition < 1 || finalPosition > rowCount) {
    throw new RangeError('A demo climb needs 1–7 rows and a valid final position.');
  }
  return Array.from({ length: rowCount - finalPosition + 1 }, (_, index) => rowCount - index);
}

/**
 * Animate at most seven existing, final-position-sorted demo rows. No clones,
 * persistence, focus changes or scrolling. Call cancel() before replacing markup.
 * A newer call on the same container automatically cancels its predecessor.
 * By default the player waits at the bottom until that row becomes visible.
 * Options: reducedMotion, duration (total, capped at 1800ms), waitForVisibility.
 */
export function animateLeaderboardEntry(container, options = {}) {
  if (!container || typeof container.querySelector !== 'function') return noopController();
  activeEntries.get(container)?.cancel();
  const body = container.querySelector('.leaderboard-body');
  if (!body || typeof body.querySelectorAll !== 'function') return noopController();
  const originalRows = Array.from(body.querySelectorAll('.leader-row[data-final-position]'));
  if (!originalRows.length) return noopController();
  const rank = row => Number(row.dataset?.finalPosition ?? row.getAttribute('data-final-position'));
  const finalRows = [...originalRows].sort((a, b) => rank(a) - rank(b));
  const player = finalRows.find(row => row.classList.contains('you'));
  const finalPosition = finalRows.indexOf(player) + 1;
  const validRanks = finalRows.every((row, index) => rank(row) === index + 1);
  const board = container.matches?.('.demo-board') ? container : container.querySelector('.demo-board') || body;
  const skip = container.querySelector('.rank-skip');
  const replay = container.querySelector('.rank-replay');
  const announcement = container.querySelector('.rank-announcement');
  const doc = container.ownerDocument;
  const win = doc?.defaultView || globalThis;
  const setTimer = win.setTimeout.bind(win);
  const clearTimer = win.clearTimeout.bind(win);
  const now = win.performance?.now ? () => win.performance.now() : () => Date.now();
  const timers = new Set();
  const animations = new Set();
  let observer = null;
  let removalObserver = null;
  let cancelled = false;
  let generation = 0;
  let state = 'finished';
  let media = null;
  let currentRows = [...finalRows];
  let deadline = 0;
  try { media = win.matchMedia?.('(prefers-reduced-motion: reduce)') || null; } catch { /* safe static fallback */ }
  const reducedMotion = () => typeof options.reducedMotion === 'boolean' ? options.reducedMotion : Boolean(media?.matches);
  const isRemoved = () => container.isConnected === false || body.isConnected === false;

  function setState(next) {
    state = next;
    board.setAttribute('data-rank-state', next);
    body.setAttribute('aria-busy', next === 'animating' ? 'true' : 'false');
    const running = next === 'animating' || next === 'waiting';
    if (skip) {
      skip.hidden = !running;
      skip.classList.toggle('hidden', !running);
    }
  }

  function updateRows(rows) {
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      body.appendChild(row); // Moving the existing nodes never creates duplicates.
      const position = row.querySelector('.board-position');
      if (position) position.textContent = String(index + 1).padStart(2, '0');
      for (let medal = 0; medal < medalClasses.length; medal++) {
        row.classList.toggle(medalClasses[medal], index === medal);
      }
      const icon = row.querySelector('.medal-icon');
      if (icon) {
        icon.textContent = medalIcons[index] || '';
        icon.hidden = index >= medalIcons.length;
      }
      const marker = row.querySelector('.medal-marker');
      if (marker) {
        marker.textContent = medalLabels[index] || '';
        marker.hidden = index >= medalLabels.length;
      }
    }
    currentRows = [...rows];
  }

  function clearMotion() {
    generation++;
    for (const timer of timers) clearTimer(timer);
    timers.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
    observer?.disconnect();
    observer = null;
  }

  function announce() {
    if (announcement && finalPosition) {
      announcement.textContent = options.announcementText || `Demo position ${finalPosition} of ${finalRows.length}. Fictional leaderboard.`;
    }
  }

  function finish() {
    if (cancelled) return;
    clearMotion();
    updateRows(finalRows);
    setState('finished');
    announce();
  }

  function onVisibility() { if (doc.hidden) finish(); }
  function onMotionChange() { if (reducedMotion()) finish(); }
  function onSkip(event) { event.preventDefault(); finish(); }
  function onReplay(event) { event.preventDefault(); start(false); }

  function cancel() {
    if (cancelled) return;
    clearMotion();
    cancelled = true;
    updateRows(finalRows);
    setState('cancelled');
    skip?.removeEventListener('click', onSkip);
    replay?.removeEventListener('click', onReplay);
    doc?.removeEventListener('visibilitychange', onVisibility);
    if (typeof media?.removeEventListener === 'function') media.removeEventListener('change', onMotionChange);
    else media?.removeListener?.(onMotionChange);
    removalObserver?.disconnect();
    removalObserver = null;
    if (activeEntries.get(container) === controller) activeEntries.delete(container);
  }

  function schedule(callback, delay, token) {
    const timer = setTimer(() => {
      timers.delete(timer);
      if (cancelled || token !== generation) return;
      if (isRemoved()) return cancel();
      if (doc?.hidden || now() >= deadline) return finish();
      callback();
    }, delay);
    timers.add(timer);
  }

  function climb() {
    if (cancelled) return;
    observer?.disconnect();
    observer = null;
    if (isRemoved()) return cancel();
    if (reducedMotion() || doc?.hidden) return finish();
    clearMotion();
    const token = generation;
    const steps = finalRows.length - finalPosition;
    const requestedDuration = Number(options.duration);
    const duration = Number.isFinite(requestedDuration) && requestedDuration > 0
      ? Math.min(1800, Math.max(200, requestedDuration)) : 100 + steps * 220;
    const leadIn = Math.min(100, duration / 5);
    const stepDuration = (duration - leadIn) / steps;
    deadline = now() + duration + 1;
    if (announcement) announcement.textContent = '';
    updateRows([...finalRows.filter(row => row !== player), player]);
    setState('animating');

    function step() {
      const playerIndex = currentRows.indexOf(player);
      if (playerIndex <= finalPosition - 1) return finish();
      const before = new Map(currentRows.map(row => [row, row.getBoundingClientRect().top]));
      for (const animation of animations) animation.cancel();
      animations.clear();
      const next = [...currentRows];
      [next[playerIndex - 1], next[playerIndex]] = [next[playerIndex], next[playerIndex - 1]];
      updateRows(next);
      try {
        for (const row of currentRows) {
          const delta = before.get(row) - row.getBoundingClientRect().top;
          if (!Number.isFinite(delta) || Math.abs(delta) < 0.1) continue;
          animations.add(row.animate([
            { transform: `translateY(${delta}px)` },
            { transform: 'translateY(0)' },
          ], { duration: stepDuration, easing: 'cubic-bezier(.2,.65,.3,1)', fill: 'both' }));
        }
      } catch {
        // A browser without usable Web Animations gets the truthful final table.
        return finish();
      }
      schedule(step, stepDuration, token);
    }
    schedule(step, leadIn, token);
  }

  function start(waitForVisibility) {
    if (cancelled) return;
    clearMotion();
    updateRows(finalRows);
    if (isRemoved()) return cancel();
    const canAnimate = player && validRanks && finalRows.length <= 7 &&
      finalPosition < finalRows.length && finalRows.every(row => typeof row.animate === 'function');
    if (!canAnimate || reducedMotion() || doc?.hidden) return finish();
    if (waitForVisibility && options.waitForVisibility !== false && typeof win.IntersectionObserver === 'function') {
      // The board header can be on screen while its entry point is still below
      // the fold. Observe the actual player row after placing it at the bottom.
      updateRows([...finalRows.filter(row => row !== player), player]);
      if (announcement) announcement.textContent = '';
      setState('waiting');
      const token = generation;
      try {
        observer = new win.IntersectionObserver(entries => {
          if (cancelled || token !== generation || state !== 'waiting') return;
          if (isRemoved()) return cancel();
          if (entries.some(entry => entry.target === player && entry.isIntersecting && entry.intersectionRatio >= 0.2)) climb();
        }, { threshold: 0.2 });
        observer.observe(player);
        return;
      } catch { observer?.disconnect(); observer = null; }
    }
    climb();
  }

  const controller = { finish, cancel };
  activeEntries.set(container, controller);
  skip?.addEventListener('click', onSkip);
  replay?.addEventListener('click', onReplay);
  doc?.addEventListener('visibilitychange', onVisibility);
  if (typeof options.reducedMotion !== 'boolean') {
    if (typeof media?.addEventListener === 'function') media.addEventListener('change', onMotionChange);
    else media?.addListener?.(onMotionChange);
  }
  if (typeof win.MutationObserver === 'function' && doc?.documentElement) {
    removalObserver = new win.MutationObserver(() => { if (isRemoved()) cancel(); });
    removalObserver.observe(doc.documentElement, { childList: true, subtree: true });
  }
  start(true);
  return controller;
}
