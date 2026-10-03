// First steps: a hands-on tour for new players. One small task at a time, shown in the controls of
// the device they're actually using (keyboard, touch screen or gamepad); it moves on only when they
// have done it. Skippable from the pause menu, replayable from there too.
const KEY = 'light-off-tutorial-done';

type Dev = 'kb' | 'touch' | 'pad';
type Step = { id: string; title: string; how: Record<Dev, string>; done: (s: any) => boolean };

const STEPS: Step[] = [
  { id: 'move', title: 'Walk around', how: { kb: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move', touch: 'Put your thumb on the <b>left side</b> and drag', pad: 'Left stick to move' }, done: s => s.walked > 8 },
  { id: 'look', title: 'Look around', how: { kb: 'Move the <b>mouse</b>', touch: 'Drag on the <b>right side</b> of the screen', pad: 'Right stick to look' }, done: s => s.looked > 1.2 },
  { id: 'sprint', title: 'Run', how: { kb: 'Hold <kbd>Shift</kbd> while moving', touch: 'Push the joystick <b>all the way out</b>', pad: 'Hold <kbd>RT</kbd> while moving' }, done: s => s.sprinted > 0.8 },
  { id: 'jump', title: 'Jump', how: { kb: 'Press <kbd>Space</kbd>', touch: 'Tap <b>JUMP</b>', pad: 'Press <kbd>A</kbd> / <kbd>✕</kbd>' }, done: s => s.jumped },
  { id: 'board', title: 'Get on your board', how: { kb: 'Press <kbd>R</kbd>', touch: 'Tap <b>BOARD</b>', pad: 'Press <kbd>Y</kbd> / <kbd>△</kbd>' }, done: s => s.mode === 'board' },
  { id: 'ride', title: 'Skate fast', how: { kb: 'Hold <kbd>W</kbd> and <kbd>Shift</kbd> to push', touch: 'Push the joystick forward, all the way', pad: 'Left stick forward, hold <kbd>RT</kbd>' }, done: s => s.mode === 'board' && s.speed > 9 },
  { id: 'ollie', title: 'Ollie', how: { kb: 'Press <kbd>Space</kbd> while skating', touch: 'Tap <b>JUMP</b> while skating', pad: 'Press <kbd>A</kbd> / <kbd>✕</kbd> while skating' }, done: s => s.ollied },
  { id: 'flip', title: 'Do a flip', how: { kb: 'Ollie, then <kbd>Space</kbd> again in the air (pull back for a backflip)', touch: 'Tap <b>JUMP</b>, then <b>JUMP</b> again in the air', pad: '<kbd>A</kbd>, then <kbd>A</kbd> again in the air' }, done: s => s.flipped },
  { id: 'off', title: 'Strap the board on your back', how: { kb: 'Press <kbd>R</kbd> again', touch: 'Tap <b>BOARD</b> again', pad: 'Press <kbd>Y</kbd> / <kbd>△</kbd> again' }, done: s => s.mode === 'foot' && s.wasBoard },
  { id: 'map', title: 'Open the map', how: { kb: 'Press <kbd>M</kbd>. Search a place, pick how to get there. <kbd>M</kbd> closes it', touch: 'Tap <b>MAP</b>. Search a place, pick how to get there', pad: 'Press <kbd>View</kbd>' }, done: s => s.mapped },
  { id: 'pause', title: 'Pause the game', how: { kb: 'Press <kbd>Esc</kbd>, then Resume', touch: 'Tap <b>❚❚</b> at the top, then Resume', pad: 'Press <kbd>Start</kbd>, then Resume' }, done: s => s.paused },
];

export function createTutorial(root: HTMLElement, { game, player, camera, input, touch }: any) {
  const T: any = { active: false };
  const el = document.createElement('div'); el.className = 'tut hidden'; root.appendChild(el);
  let i = 0, s: any = null, lastYaw = 0, holdT = 0;
  const dev = (): Dev => input.usingPad ? 'pad' : touch ? 'touch' : 'kb';
  const fresh = () => ({ walked: 0, looked: 0, sprinted: 0, jumped: false, mode: 'foot', speed: 0, ollied: false, flipped: false, wasBoard: false, mapped: false, paused: false });
  const draw = (tick = false) => {
    const st = STEPS[i];
    el.innerHTML = `<div class="tut-k">FIRST STEPS · ${i + 1} OF ${STEPS.length}</div>
      <div class="tut-t">${tick ? '<span class="tut-ok">✓</span>' : ''}${st.title}</div><div class="tut-h">${st.how[dev()]}</div>
      <div class="tut-bar"><i style="width:${(i / STEPS.length) * 100}%"></i></div><div class="tut-s">${touch ? 'Skip: ❚❚ → Skip tutorial' : 'Skip: Esc → Skip tutorial'}</div>`;
  };
  T.done = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
  T.start = () => { T.active = true; i = 0; s = fresh(); lastYaw = camera.yaw; el.classList.remove('hidden'); draw(); };
  T.stop = (finished = false) => {
    T.active = false; el.classList.add('hidden'); try { localStorage.setItem(KEY, '1'); } catch { /* */ }
    if (finished) game.hud.banner('YOU\'RE READY', 'Lagos is yours. Go anywhere: press M for the map.', 'green', 3.5);
  };
  T.event = (e: string) => { if (!T.active) return; if (e === 'map') s.mapped = true; if (e === 'pause') s.paused = true; };
  T.update = (dt: number, inp: any) => {
    if (!T.active) return;
    const hs = Math.hypot(player.vel.x, player.vel.z);
    if (player.mode === 'foot' && player.onGround) s.walked += hs * dt;
    let dy = camera.yaw - lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.looked += Math.abs(dy); lastYaw = camera.yaw;
    if (inp.held.sprint && hs > 5.5) s.sprinted += dt;
    if (player.mode === 'foot' && !player.onGround) s.jumped = true;
    s.mode = player.mode; s.speed = player.speed || hs;
    if (player.mode === 'board') { s.wasBoard = true; if (!player.onGround) s.ollied = true; if (player.trick) s.flipped = true; }
    if (holdT > 0) { holdT -= dt; if (holdT <= 0) { i++; if (i >= STEPS.length) T.stop(true); else draw(); } return; }
    if (STEPS[i].done(s)) { holdT = 0.9; draw(true); game.audio.pickup?.(); }
  };
  return T;
}
