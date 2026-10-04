// First steps: a hands-on tour for new players. One small task at a time, shown in the controls of
// the device they're actually using (keyboard, touch screen or gamepad); it moves on only when they
// have done it. Skippable from the pause menu, replayable from there too.
const KEY = 'light-off-tutorial-done', NKEY = 'light-off-tutorial-night-done';

type Dev = 'kb' | 'touch' | 'pad';
type Step = { id: string; title: string; how: Record<Dev, string>; done: (s: any) => boolean; fight?: boolean };

const STEPS: Step[] = [
  { id: 'move', title: 'Walk around', how: { kb: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move', touch: 'Put your thumb on the <b>left side</b> and drag', pad: 'Left stick to move' }, done: s => s.walked > 8 },
  { id: 'look', title: 'Look around', how: { kb: 'Move the <b>mouse</b>', touch: 'Drag on the <b>right side</b> of the screen', pad: 'Right stick to look' }, done: s => s.looked > 1.2 },
  { id: 'sprint', title: 'Run', how: { kb: 'Hold <kbd>Shift</kbd> while moving', touch: 'Push the joystick <b>all the way out</b>', pad: 'Hold <kbd>RT</kbd> while moving' }, done: s => s.sprinted > 0.8 },
  { id: 'jump', title: 'Jump', how: { kb: 'Press <kbd>Space</kbd>', touch: 'Tap <b>JUMP</b>', pad: 'Press <kbd>A</kbd> / <kbd>✕</kbd>' }, done: s => s.jumped },
  { id: 'job', title: 'Check your job sheet', how: { kb: 'Press <kbd>J</kbd>: today\'s parcels, your rating, rent. <kbd>J</kbd> closes it', touch: 'Tap <b>JOB</b> at the top', pad: 'Keyboard J (pad: coming)' }, done: s => s.jobbed || s.free },
  { id: 'map', title: 'Open the map', how: { kb: 'Press <kbd>M</kbd>. Search a place, pick how to get there. <kbd>M</kbd> closes it', touch: 'Tap <b>MAP</b>. Search a place, pick how to get there', pad: 'Press <kbd>View</kbd>' }, done: s => s.mapped },
  { id: 'pause', title: 'Pause the game', how: { kb: 'Press <kbd>Esc</kbd>, then Resume', touch: 'Tap <b>❚❚</b> at the top, then Resume', pad: 'Press <kbd>Start</kbd>, then Resume' }, done: s => s.paused },
];

// the boy in black: the night skills (taught the first time he's out in the suit)
const NIGHT: Step[] = [
  { id: 'board', title: 'Get on your board', how: { kb: 'Press <kbd>R</kbd>', touch: 'Tap <b>BOARD</b>', pad: 'Press <kbd>Y</kbd> / <kbd>△</kbd>' }, done: s => s.mode === 'board' },
  { id: 'ride', title: 'Skate fast', how: { kb: 'Hold <kbd>W</kbd> and <kbd>Shift</kbd> to push', touch: 'Push the joystick forward, all the way', pad: 'Left stick forward, hold <kbd>RT</kbd>' }, done: s => s.mode === 'board' && s.speed > 9 },
  { id: 'ollie', title: 'Ollie', how: { kb: 'Press <kbd>Space</kbd> while skating', touch: 'Tap <b>JUMP</b> while skating', pad: 'Press <kbd>A</kbd> / <kbd>✕</kbd> while skating' }, done: s => s.ollied },
  { id: 'flip', title: 'Board flip', how: { kb: 'Ollie, then <kbd>Space</kbd> again in the air (pull back for a backflip)', touch: 'Tap <b>JUMP</b>, then <b>JUMP</b> again in the air', pad: '<kbd>A</kbd>, then <kbd>A</kbd> again in the air' }, done: s => s.flipped },
  { id: 'belly', title: 'Belly-board', how: { kb: 'Going fast, press <kbd>X</kbd> to lie flat (hard to spot). <kbd>X</kbd> again to get up', touch: 'Going fast, tap <b>BELLY</b>', pad: 'Going fast, lie flat (keyboard X)' }, done: s => s.ev.has('proneOn') },
  { id: 'off', title: 'Strap the board on your back', how: { kb: 'Press <kbd>R</kbd> again', touch: 'Tap <b>BOARD</b> again', pad: 'Press <kbd>Y</kbd> / <kbd>△</kbd> again' }, done: s => s.mode === 'foot' && s.wasBoard },
  { id: 'climb', title: 'Climb a wall', how: { kb: 'Run at a wall and press <kbd>Space</kbd>. Keep <kbd>W</kbd> held to climb', touch: 'Run at a wall and tap <b>JUMP</b>. Keep pushing up', pad: 'Run at a wall, press <kbd>A</kbd>, keep pushing' }, done: s => s.ev.has('climb') || s.mode === 'climb' },
  { id: 'roof', title: 'Get onto a roof', how: { kb: 'Climb to the top: he pulls himself over', touch: 'Keep climbing to the top', pad: 'Keep climbing to the top' }, done: s => s.ev.has('mantle') || s.highUp },
  { id: 'catdrop', title: 'Drop like a cat', how: { kb: 'Jump off the roof. He lands on his feet (no damage)', touch: 'Walk off the roof. He lands on his feet', pad: 'Jump off the roof' }, done: s => s.ev.has('catDrop') || s.ev.has('landRoll') || !!s.landedLow },
  { id: 'wallrun', title: 'Run along a wall', how: { kb: 'Sprint (<kbd>Shift</kbd>) beside a wall and press <kbd>Space</kbd> toward it', touch: 'Run beside a wall, stick all the way, tap <b>JUMP</b> toward it', pad: 'Sprint beside a wall, <kbd>A</kbd> toward it' }, done: s => s.ev.has('wallrun') || s.mode === 'wallrun' },
  { id: 'flip', title: 'Flip in the air', how: { kb: 'Jump, then <kbd>Space</kbd> again in the air', touch: 'Tap <b>JUMP</b>, then <b>JUMP</b> again in the air', pad: '<kbd>A</kbd>, then <kbd>A</kbd> again' }, done: s => s.ev.has('flip') },
  { id: 'leap', title: 'Cat leap', how: { kb: 'Hold <kbd>Space</kbd> to crouch, let go to leap far', touch: 'Hold <b>JUMP</b>, then let go', pad: 'Hold <kbd>A</kbd>, then let go' }, done: s => s.ev.has('leap') || s.charged },
  { id: 'sense', title: 'Street Sense', how: { kb: 'Hold <kbd>Q</kbd>: see danger and enemies through walls', touch: 'Hold <b>SENSE</b>', pad: 'Hold <kbd>LB</kbd>' }, done: s => s.sensed > 0.6 },
  { id: 'skitch', title: 'Hitch a ride', how: { kb: 'Get close behind a moving car and press <kbd>E</kbd>', touch: 'Get close to a moving car and tap <b>GRAB</b>', pad: 'Get close to a moving car, <kbd>RB</kbd>' }, done: s => s.mode === 'skitch' || s.ev.has('skitch') },
  { id: 'strike', title: 'Fight: strike', how: { kb: 'Three agberos don\'t like the mask. <kbd>F</kbd> (or click) toward one to hit', touch: 'Three agberos are coming. Tap <b>HIT/USE</b>', pad: 'Three agberos are coming. <kbd>X</kbd> to hit' }, done: s => s.cb.attack >= 3, fight: true },
  { id: 'counter', title: 'Fight: counter', how: { kb: 'When <b>"!"</b> flashes over one, press <kbd>C</kbd> to counter', touch: 'When <b>"!"</b> flashes, tap <b>DODGE</b>', pad: 'When <b>"!"</b> flashes, <kbd>B</kbd>' }, done: s => s.cb.counter >= 1, fight: true },
  { id: 'launch', title: 'Fight: launch kick', how: { kb: '<kbd>G</kbd> kicks one into the air, then <kbd>F</kbd> to juggle', touch: 'Tap <b>LAUNCH</b>, then <b>HIT/USE</b>', pad: '<kbd>D-Pad ↑</kbd>, then <kbd>X</kbd>' }, done: s => s.cb.launch >= 1, fight: true },
  { id: 'pounce', title: 'Fight: pounce', how: { kb: '<kbd>V</kbd> leaps onto an enemy from far away, like a cat', touch: 'Tap <b>POUNCE</b>', pad: '<kbd>D-Pad ↓</kbd>' }, done: s => s.cb.pounce >= 1, fight: true },
  { id: 'finish', title: 'Fight: finish them', how: { kb: 'Keep moving. Hit the one in front, counter the one behind. Crowded? <kbd>G</kbd> does a Cat Sweep', touch: 'Keep moving, counter, sweep with <b>LAUNCH</b> when they crowd you', pad: 'Keep moving, counter, sweep with <kbd>D-Pad ↑</kbd>' }, done: s => s.sparDone, fight: true },
];

export function createTutorial(root: HTMLElement, { game, player, camera, input, touch }: any) {
  const T: any = { active: false };
  const el = document.createElement('div'); el.className = 'tut hidden'; root.appendChild(el);
  let i = 0, s: any = null, lastYaw = 0, holdT = 0, list: Step[] = STEPS, kind = 'day', spar: any[] = [];
  // count the combat moves that actually land, without touching the combat code
  const C = game.combat; const cb: any = {};
  for (const k of ['attack', 'counter', 'launch', 'pounce', 'sweep', 'flurry']) { const f = C[k]; C[k] = (...a) => { const r = f(...a); if (r && T.active) cb[k] = (cb[k] || 0) + 1; return r; }; }
  const spawnSpar = () => {
    const p = player.pos, y = player.yaw;
    for (let k = 0; k < 3; k++) { const a = y + (k - 1) * 0.9, t = game.spawnThug({ x: p.x + Math.sin(a) * 7, z: p.z + Math.cos(a) * 7, yaw: a + Math.PI, variant: k ? 'agbero2' : 'agbero', role: 'guard', group: spar }); t.hp = Math.min(t.hp, 6); spar.push(t); t.engage(0.6 + k * 0.4); }
    game.hud.say('Agbero', 'Who be this one wey cover face?! Oya, come here!', 3);
  };
  const dev = (): Dev => input.usingPad ? 'pad' : touch ? 'touch' : 'kb';
  const fresh = () => ({ ev: new Set(), cb, sensed: 0, highUp: false, wasHigh: false, onGround: true, sparDone: false, walked: 0, looked: 0, sprinted: 0, jumped: false, mode: 'foot', speed: 0, ollied: false, flipped: false, wasBoard: false, mapped: false, paused: false });
  const draw = (tick = false) => {
    const st = list[i];
    el.innerHTML = `<div class="tut-k">${kind === 'night' ? 'THE BOY IN BLACK' : 'FIRST STEPS'} · ${i + 1} OF ${list.length}</div>
      <div class="tut-t">${tick ? '<span class="tut-ok">✓</span>' : ''}${st.title}</div><div class="tut-h">${st.how[dev()]}</div>
      <div class="tut-bar"><i style="width:${(i / list.length) * 100}%"></i></div><div class="tut-s">${touch ? 'Skip: ❚❚ → Skip tutorial' : 'Skip: Esc → Skip tutorial'}</div>`;
  };
  T.done = (k = 'day') => { try { return !!localStorage.getItem(k === 'night' ? NKEY : KEY); } catch { return false; } };
  T.kind = () => kind;
  // only show over the game itself: never on top of the map, menus, the job sheet or cutscenes
  T.show = (on: boolean) => { if (T.active) el.classList.toggle('hidden', !on); };
  T.jump = (n: number) => { i = n; draw(); }; // for tests
  T.start = (k = 'day') => { kind = k; list = k === 'night' ? NIGHT : STEPS; for (const q in cb) delete cb[q]; spar = []; T.active = true; game.tutorialOn = true; document.body.classList.add('tut-on'); i = 0; s = fresh(); lastYaw = camera.yaw; el.classList.remove('hidden'); draw(); };
  T.stop = (finished = false) => {
    T.active = false; game.tutorialOn = false; document.body.classList.remove('tut-on'); game.outT = 0; el.classList.add('hidden'); try { localStorage.setItem(kind === 'night' ? NKEY : KEY, '1'); } catch { /* */ }
    if (finished) game.hud.banner(kind === 'night' ? 'THE BOY IN BLACK' : 'YOU\'RE READY', kind === 'night' ? 'The rooftops are yours. The police will chase the suit on sight: stay quick.' : 'Lagos is yours. Go anywhere: press M for the map.', 'green', 3.5);
  };
  T.event = (e: string) => { if (!T.active) return; if (e === 'map') s.mapped = true; if (e === 'job') s.jobbed = true; if (e === 'pause') s.paused = true; };
  T.update = (dt: number, inp: any) => {
    if (!T.active) return;
    const hs = Math.hypot(player.vel.x, player.vel.z);
    if (player.mode === 'foot' && player.onGround) s.walked += hs * dt;
    let dy = camera.yaw - lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.looked += Math.abs(dy); lastYaw = camera.yaw;
    if (inp.held.sprint && hs > 5.5) s.sprinted += dt;
    if (player.mode === 'foot' && !player.onGround) s.jumped = true;
    s.mode = player.mode; s.speed = player.speed || hs;
    s.free = game.sub === 'free';
    for (const e of player.events || []) { s.ev.add(e.e); if (e.e === 'jump' && (e.power || 0) > 0.35) s.charged = true; }
    if (game.sense) s.sensed += dt;
    s.onGround = player.onGround; if (player.pos.y > 4 && player.onGround) { s.highUp = true; s.wasHigh = true; }
    if (s.wasHigh && player.onGround && player.pos.y < 1) s.landedLow = true;
    if (list[i].fight && !spar.length) spawnSpar();
    if (spar.length && spar.every(t => !t.alive || t.state === 'ko' || t.removed)) s.sparDone = true;
    if (player.mode === 'board') { s.wasBoard = true; if (!player.onGround) s.ollied = true; if (player.trick) s.flipped = true; }
    if (holdT > 0) { holdT -= dt; if (holdT <= 0) { i++; if (i >= list.length) T.stop(true); else draw(); } return; }
    if (list[i].done(s)) { holdT = 0.9; draw(true); game.audio.pickup?.(); }
  };
  return T;
}
