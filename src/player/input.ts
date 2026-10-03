// Keyboard + mouse (pointer lock) + gamepad (standard mapping).
//   action      keyboard          gamepad
//   move        WASD / arrows     left stick
//   camera      mouse             right stick
//   jump/ollie  Space             A / Cross
//   sprint/push Shift             RT / R2
//   board       R                 Y / Triangle   (unclip the board / strap it back on)
//   skitch      E                 RB / R1        (grab / let go of a vehicle)
//   act         F / left mouse    X / Square     (strike, snatch, interact)
//   dodge roll  C                 B / Circle
//   street sense Q (hold)         LB / L1
//   launch kick  G                D-pad up
//   pounce/leap  V                D-pad down
//   pick up / throw T             D-pad left      (hold right mouse / LT to aim a throw, click / RT to throw)
export function createInput(canvas) {
  const keys = new Set(), tapped = new Set();
  const mouse = { dx: 0, dy: 0, down: false, clicked: false, right: false };
  const st: any = {
    move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, locked: false, usingPad: false,
    held: {}, pressed: {},
  };
  const isTyping = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
  addEventListener('keydown', e => {
    if (isTyping(e)) return;
    if (!e.repeat) tapped.add(e.code);
    keys.add(e.code);
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    st.usingPad = false;
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  addEventListener('mousemove', e => { if (st.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
  canvas.addEventListener('mousedown', e => { if (!st.locked) return; if (e.button === 0) { mouse.clicked = true; mouse.down = true; } if (e.button === 2) mouse.right = true; });
  addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.right = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { st.locked = document.pointerLockElement === canvas; });
  st.lock = () => {
    const req = (opts?: any) => { try { const r = canvas.requestPointerLock?.(opts); return r?.catch ? r : Promise.resolve(); } catch (e) { return Promise.reject(e); } };
    req({ unadjustedMovement: true }).catch(() => req().catch(() => {}));
  };

  const padPrev: any = {};
  const MAP = { jump: 0, roll: 1, act: 2, board: 3, sense: 4, skitch: 5, aim: 6, sprint: 7, pause: 9, gadget: 12, flash: 13, throw: 14, map: 8, radio: 15 };
  const dz = v => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);

  st.poll = () => {
    const k = c => keys.has(c), t = c => tapped.has(c);
    let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    let my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const held: any = {
      jump: k('Space'), sprint: k('ShiftLeft') || k('ShiftRight'), board: k('KeyR'), skitch: k('KeyE'),
      act: k('KeyF') || mouse.down, roll: k('KeyC'), sense: k('KeyQ'), pause: false, map: k('KeyM'), aim: mouse.right,
    };
    const pressed: any = {
      jump: t('Space'), board: t('KeyR'), skitch: t('KeyE'), act: t('KeyF') || mouse.clicked, roll: t('KeyC'),
      sense: t('KeyQ'), help: t('KeyH'), pause: t('KeyP'), map: t('KeyM'), gadget: t('KeyG'), flash: t('KeyV'), throw: t('KeyT'), alt: t('KeyG'), radio: t('KeyN'), patrolBoard: t('KeyJ'), change: t('KeyU'), prone: t('KeyX'), torch: t('KeyL'),
    };
    let lx = mouse.dx, ly = mouse.dy;
    mouse.dx = mouse.dy = 0; mouse.clicked = false; tapped.clear();

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = dz(p.axes[0] || 0), ay = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
      st.padType = /054c|playstation|dualsense|dualshock|wireless controller/i.test(p.id) ? 'ps' : 'xbox'; // swap the button labels to match the pad
      if (ax || ay) { mx = ax; my = -ay; st.usingPad = true; }
      if (rx || ry) { lx += rx * 14; ly += ry * 10; st.usingPad = true; }
      for (const [name, i] of Object.entries(MAP)) {
        const b = p.buttons[i]; const v = !!(b && (b.pressed || b.value > 0.35));
        if (v) { held[name] = true; st.usingPad = true; }
        if (v && !padPrev[name]) pressed[name] = true;
        padPrev[name] = v;
      }
      break;
    }
    // on-screen touch controls (phones, tablets)
    if (st.touch?.state.active) {
      const T = st.touch.take();
      if (T.move.x || T.move.y) { mx = T.move.x; my = T.move.y; }
      lx += T.look.dx; ly += T.look.dy;
      for (const [k, v] of Object.entries(T.held)) if (v) held[k] = true;
      for (const [k, v] of Object.entries(T.pressed)) if (v) pressed[k] = true;
    }
    // while aiming, the strike button / RT fires the catapult instead
    if (held.aim) { pressed.fire = pressed.act || (pressed.sprint ?? false); pressed.act = false; held.sprint = false; }
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    st.move.x = mx; st.move.y = my; st.look.dx = lx; st.look.dy = ly;
    st.held = held; st.pressed = pressed;
    return st;
  };
  return st;
}
