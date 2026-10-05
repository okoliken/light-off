// On-screen controls for phones and tablets. A floating stick on the left (push it all the way to
// sprint), drag anywhere else on the right to look, and a button cluster under the right thumb.
// It produces the same { move, look, held, pressed } shape as the keyboard and gamepad, so the
// game never knows the difference. Kept free of game code so it can grow into the shared pad kit.

type Btn = { id: string; label: string; key: string; cls?: string };

// right-thumb cluster (big actions) and the small row above it
const MAIN: Btn[] = [
  { id: 'jump', label: 'JUMP', key: 'jump', cls: 'big a' },
  { id: 'act', label: 'HIT<br>USE', key: 'act', cls: 'big b' },
  { id: 'roll', label: 'DODGE', key: 'roll', cls: 'c' },
  { id: 'flash', label: 'POUNCE', key: 'flash', cls: 'd' },
];
// the small buttons come in two sets of four, one row at a time, so they never pile up mid-screen
const SETS: { name: string; btns: Btn[] }[] = [
  { name: 'MOVE', btns: [
    { id: 'board', label: 'BOARD', key: 'board' },
    { id: 'skitch', label: 'GRAB', key: 'skitch' },
    { id: 'prone', label: 'BELLY', key: 'prone' },
    { id: 'sense', label: 'SENSE', key: 'sense' },
  ] },
  { name: 'FIGHT', btns: [
    { id: 'gadget', label: 'LAUNCH', key: 'gadget' },
    { id: 'throw', label: 'THROW', key: 'throw' },
    { id: 'g1', label: 'PEPPER', key: 'g1' },
    { id: 'g2', label: 'SMOKE', key: 'g2' },
  ] },
];
const TOP: Btn[] = [
  { id: 'map', label: 'MAP', key: 'map' },
  { id: 'job', label: 'JOB', key: 'patrolBoard' },
  { id: 'radio', label: 'RADIO', key: 'radio' },
  { id: 'change', label: 'SUIT', key: 'change' },
  { id: 'torch', label: 'TORCH', key: 'torch' },
  { id: 'pause', label: '❚❚', key: 'pause' },
  { id: 'unlock', label: '✕ LOCK', key: 'unlock', cls: 'unlock' },
];

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function createTouchPad(root: HTMLElement) {
  const st: any = { active: false, move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {} as Record<string, boolean>, pressed: {} as Record<string, boolean>, tap: null };
  const el = document.createElement('div'); el.className = 'tpad';
  const btn = (b: Btn) => `<button class="tb ${b.cls || ''}" data-k="${b.key}">${b.label}</button>`;
  el.innerHTML = `<div class="tp-stick"><div class="tp-knob"></div></div>
    <div class="tp-top">${TOP.map(btn).join('')}</div>
    <div class="tp-small">${SETS.map((g, n) => `<div class="tp-set${n ? '' : ' on'}">${g.btns.map(btn).join('')}</div>`).join('')}<button class="tb tp-swap">${SETS[1].name}<i>⇄</i></button></div>
    <div class="tp-main">${MAIN.map(btn).join('')}</div>
    <div class="tp-rotate">Turn your phone sideways to play</div>`;
  root.appendChild(el);
  const stick = el.querySelector<HTMLElement>('.tp-stick')!, knob = el.querySelector<HTMLElement>('.tp-knob')!;
  const R = 56; // stick radius in px
  let stickId: number | null = null, sx = 0, sy = 0, lookId: number | null = null, lx = 0, ly = 0, tapStart: any = null;

  // buttons: each touch on a button holds that key until the finger lifts
  el.querySelectorAll<HTMLElement>('[data-k]').forEach(b => {
    const k = b.dataset.k!;
    const down = (e: Event) => { e.preventDefault(); e.stopPropagation(); if (!st.held[k]) st.pressed[k] = true; st.held[k] = true; b.classList.add('on'); };
    const up = (e: Event) => { e.preventDefault(); st.held[k] = false; b.classList.remove('on'); };
    b.addEventListener('touchstart', down, { passive: false }); b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
  });

  // the swap button flips the small row between its two sets
  const sets = Array.from(el.querySelectorAll<HTMLElement>('.tp-set')), swap = el.querySelector<HTMLElement>('.tp-swap')!;
  let setN = 0;
  const showSet = (n: number) => { setN = n; sets.forEach((g, j) => g.classList.toggle('on', j === n)); swap.innerHTML = `${SETS[(n + 1) % SETS.length].name}<i>⇄</i>`; };
  swap.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); showSet((setN + 1) % SETS.length); }, { passive: false });

  // the stick appears under the left thumb; the right side of the screen is a look pad
  const onStart = (e: TouchEvent) => {
    if (!st.active) return;
    for (const t of Array.from(e.changedTouches)) {
      if ((t.target as HTMLElement).closest?.('[data-k], .tp-swap')) continue;
      if (t.clientX < innerWidth * 0.42 && stickId === null) {
        stickId = t.identifier; sx = t.clientX; sy = t.clientY;
        stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on');
      } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; tapStart = { x: t.clientX, y: t.clientY, t: performance.now(), moved: 0 }; }
    }
    if ((e.target as HTMLElement).tagName === 'CANVAS') e.preventDefault();
  };
  const onMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === stickId) {
        let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        st.move.x = dx / R; st.move.y = -dy / R;
        st.held.sprint = d > R * 1.15; // push past the rim to sprint
      } else if (t.identifier === lookId) {
        if (tapStart) tapStart.moved += Math.hypot(t.clientX - lx, t.clientY - ly);
        st.look.dx += (t.clientX - lx) * 1.6; st.look.dy += (t.clientY - ly) * 1.2; lx = t.clientX; ly = t.clientY;
      }
    }
  };
  const onEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === stickId) { stickId = null; st.move.x = st.move.y = 0; st.held.sprint = false; knob.style.transform = ''; stick.classList.remove('on'); }
      if (t.identifier === lookId) { lookId = null; if (tapStart && tapStart.moved < 12 && performance.now() - tapStart.t < 260) st.tap = { x: t.clientX, y: t.clientY }; tapStart = null; }
    }
  };
  addEventListener('touchstart', onStart, { passive: false });
  addEventListener('touchmove', onMove, { passive: false });
  addEventListener('touchend', onEnd); addEventListener('touchcancel', onEnd);

  return {
    state: st,
    show(on: boolean) { st.active = on; el.classList.toggle('on', on); if (!on) { st.move.x = st.move.y = 0; st.held = {}; } },
    // bring up the set that has this button and make it pulse (the tutorial points at buttons this way)
    focus(key: string | null) {
      el.querySelectorAll('.tb.hint').forEach(b => b.classList.remove('hint'));
      if (!key) return;
      const n = SETS.findIndex(g => g.btns.some(b => b.key === key));
      if (n >= 0 && n !== setN) showSet(n);
      el.querySelector(`[data-k="${key}"]`)?.classList.add('hint');
    },
    setLocked(on: boolean) { el.classList.toggle('locked', on); },
    // read and clear the one-frame parts
    take() { const out = { move: { ...st.move }, look: { ...st.look }, held: { ...st.held }, pressed: st.pressed, tap: st.tap }; st.pressed = {}; st.tap = null; st.look.dx = st.look.dy = 0; return out; },
  };
}
