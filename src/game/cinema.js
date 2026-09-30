// In-engine cutscenes. Each line of dialogue gets its own shot: the camera frames whoever is speaking
// (over the listener's shoulder, or a medium close-up), narration gets a wide establishing shot, and every
// shot slowly pushes in. Shots blend into each other, the scene fades in and out, the text types itself
// and moves on by itself. Space / F / click: finish the line or go to the next one. P: skip the scene.
import * as THREE from 'three';
import { Pose } from '../player/rig.js';

const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const TYPE_CPS = 48;

export function createCinema({ game, camera, hud }) {
  const { player, world } = game;
  const col = world.collision, cam = camera.cam;
  const C = { active: false };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _look = new THREE.Vector3();
  let S = null;
  // a soft warm key light on whoever is in shot, plus a cool rim from behind: night scenes stay readable
  const key = new THREE.PointLight(0xffd9a8, 0, 9, 2), rim = new THREE.PointLight(0x8fb3ff, 0, 8, 2);
  game.scene.add(key, rim);
  C.focus = () => S ? S.lookNow : null;

  // head height depends on the pose: cowering on the ground, kneeling tied up, or standing
  const headY = (e) => e === player ? 1.45 : e.mood === 'cower' ? 0.62 : e.mood === 'captive' ? 1.0 : (e.rig?.root.scale.y || 1) * 1.55;
  const head = (e) => new THREE.Vector3(e.pos.x, e.pos.y + headY(e), e.pos.z);
  const everyone = () => [player, ...game.thugs.filter(t => !t.removed && !t.hidden), ...game.civilians.filter(c => !c.gone), ...game.gunmen.filter(g => !g.removed)];
  const near = (p, list, r = 40) => list.filter(e => e.pos && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < r).sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z));

  // who is talking? names first, then the closest person of the right kind to where the scene is
  function speaker(who, focus) {
    if (!who) return null;
    if (who === 'Bolaji') return near(focus, [player], 60)[0] || null;
    const named = everyone().find(e => e.name === who);
    if (named) return named;
    const w = who.toLowerCase();
    if (w.includes('phone') || w.includes('radio')) return null; // a voice from somewhere else: stay on the scene
    if (w.includes('scorpion')) return near(focus, game.thugs.filter(t => t.variant === 'scorpion'))[0] || null;
    if (w.includes('chairman')) return near(focus, game.thugs.filter(t => t.variant === 'chairman'))[0] || null;
    if (w.includes('egúngún') || w.includes('egungun')) return near(focus, game.thugs.filter(t => t.variant === 'egungun'))[0] || null;
    if (w.includes('officer') || w.includes('police') || w.includes('inspector')) return near(focus, game.gunmen)[0] || null;
    if (w.includes('red cap') || w.includes('bagman') || w.includes('area boy')) return near(focus, game.thugs.filter(t => t.alive))[0] || null;
    return near(focus, game.civilians.filter(c => !c.gone), 25)[0] || null;
  }

  // a point inside a pillar or shack would put the camera in the dark: step out to open ground
  const solidAt = (x, y, z) => col.solids.query(x - 0.3, z - 0.3, x + 0.3, z + 0.3, []).some(b => y > b.miny && y < b.maxy);
  function freePoint(p) {
    if (!solidAt(p.x, p.y, p.z)) return p;
    for (let r = 1; r <= 6; r++) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; if (!solidAt(x, p.y, z)) return new THREE.Vector3(x, p.y, z); }
    return p;
  }
  // pull a camera position in toward `from` if a wall is in the way
  function clear(from, to) {
    _a.subVectors(to, from); const d = _a.length(); _a.normalize();
    const t = col.raycast(from.x, from.y, from.z, _a.x, _a.y, _a.z, d);
    const out = t < d ? from.clone().addScaledVector(_a, Math.max(0.6, t - 0.4)) : to.clone();
    return solidAt(out.x, out.y, out.z) ? freePoint(out) : out;
  }

  // build one shot: where the camera starts, where it drifts to, what it looks at
  function makeShot(line, i, focus) {
    const who = typeof line === 'string' ? null : line.who;
    const sp = speaker(who, focus);
    if (sp) {
      const target = head(sp);
      // the listener: Bolaji if someone else is talking, else whoever is nearest to him
      // the listener: Bolaji if he's in the scene, otherwise whoever is standing nearest (the Red Cap over the victim, etc.)
      const pd = Math.hypot(player.pos.x - sp.pos.x, player.pos.z - sp.pos.z);
      const standing = e => !(e.mood === 'cower' || e.mood === 'captive');
      const others = everyone().filter(e => e !== sp && e !== player && (headY(sp) >= 1.2 || standing(e)));
      const ls = sp !== player && pd < 14 ? player : near(sp.pos, others, 8)[0] || null;
      let dir;
      if (ls) { dir = _b.set(ls.pos.x - sp.pos.x, 0, ls.pos.z - sp.pos.z).normalize().clone(); if (sp.yaw !== undefined && sp !== player) sp.yaw = Math.atan2(dir.x, dir.z); }
      else dir = new THREE.Vector3(Math.sin(sp.yaw || 0), 0, Math.cos(sp.yaw || 0));
      const right = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(i % 2 ? -1 : 1);
      // over the listener's shoulder, or a medium close-up in front of the speaker
      const dist = ls ? Math.min(Math.hypot(ls.pos.x - sp.pos.x, ls.pos.z - sp.pos.z) + 1.2, 5.2) : 3.4;
      const low = headY(sp) < 1.2, d2 = low ? Math.min(dist, 2.6) : dist; // someone on the ground: come down close to them
      const off = ls ? 1.35 : 0.5; // over the shoulder: the listener sits at the edge of the frame, the speaker in the open
      const from = target.clone().addScaledVector(dir, d2).addScaledVector(right, off); from.y = target.y + (low ? 0.35 : 0.2);
      const to = target.clone().addScaledVector(dir, d2 * 0.84).addScaledVector(right, off * 0.85); to.y = target.y + (low ? 0.28 : 0.13);
      const look = target.clone().addScaledVector(right, ls ? -0.25 : 0);
      return { from: clear(target, from), to: clear(target, to), look, lookTo: look.clone(), fov: 50 };
    }
    // narration: a wide shot of the place, from whichever angle has the most room
    const f = freePoint(new THREE.Vector3(focus.x, (focus.y || 0) + 1.2, focus.z));
    let best = new THREE.Vector3(0, 0.3, 1).normalize(), bd = -Infinity; // tight rooms: always end up with some angle
    const facing = focus.dir ? Math.atan2(focus.dir.x, focus.dir.z) : null; // the scene wants to be seen from this side
    for (let k = 0; k < 8; k++) {
      const a = facing !== null ? facing + (k / 7 - 0.5) * 1.6 : (k / 8) * Math.PI * 2 + i * 0.9, d = new THREE.Vector3(Math.sin(a), 0.3, Math.cos(a)).normalize();
      const t = col.raycast(f.x, f.y, f.z, d.x, d.y, d.z, 16);
      const sc = t - (solidAt(f.x + d.x * Math.min(t, 15), f.y + d.y * Math.min(t, 15), f.z + d.z * Math.min(t, 15)) ? 20 : 0);
      if (sc > bd) { bd = sc; best = d; }
    }
    const dist = Math.max(4, Math.min(facing !== null ? 6 : 10, bd - 0.8));
    const from = f.clone().addScaledVector(best, dist), side = new THREE.Vector3(best.z, 0, -best.x);
    const to = f.clone().addScaledVector(best, dist * 0.88).addScaledVector(side, 1.2);
    return { from, to: clear(f, to), look: f.clone(), lookTo: f.clone().addScaledVector(side, 0.6), fov: 56 };
  }

  C.play = (lines, focus, onDone, title = '') => {
    if (!lines?.length) { onDone?.(); return; }
    if (S) { const prev = S.onDone; S.onDone = () => { prev?.(); C.play(lines, focus, onDone, title); }; return; }
    focus = focus || { x: player.pos.x, y: player.pos.y, z: player.pos.z };
    S = { lookNow: new THREE.Vector3(focus.x, focus.y || 0, focus.z), lines, focus, onDone, title, i: -1, t: 0, dur: 0, typed: 0, shot: null, fromPos: cam.position.clone(), fromLook: new THREE.Vector3(), blend: 1, fade: 0, ending: false, fov0: cam.fov };
    cam.getWorldDirection(_a); S.fromLook.copy(cam.position).addScaledVector(_a, 10);
    C.active = true;
    game.sense = false;
    hud.cine.open(title);
    next(true);
  };
  function next(first) {
    S.i++;
    if (S.i >= S.lines.length) { end(); return; }
    const line = S.lines[S.i], text = typeof line === 'string' ? line : line.text;
    // start the new shot from wherever the camera is right now, so cuts become smooth moves
    if (S.shot) { S.fromPos.copy(cam.position); cam.getWorldDirection(_a); S.fromLook.copy(cam.position).addScaledVector(_a, S.shot.look.distanceTo(cam.position)); }
    S.shot = makeShot(line, S.i, S.focus);
    S.blend = first ? 1 : 0; S.t = 0; S.typed = 0; S.text = text; S.who = typeof line === 'string' ? '' : line.who;
    S.dur = Math.min(9, 2.2 + text.length / 19);
    if (first) { cam.position.copy(S.shot.from); cam.lookAt(S.shot.look); }
  }
  function end() {
    if (S.ending) return;
    S.ending = true; S.endT = 0;
  }
  C.skip = () => { if (S) end(); };
  C.advance = () => {
    if (!S || S.ending) return;
    if (S.typed < S.text.length) S.typed = S.text.length; else next();
  };

  // background life: everyone near the scene keeps breathing instead of freezing
  function animate(dt) {
    for (const t of game.thugs) {
      if (t.removed || t.hidden || !t.rig || ['down', 'ko', 'air'].includes(t.state)) continue;
      if (Math.hypot(t.pos.x - S.focus.x, t.pos.z - S.focus.z) > 45) continue;
      Pose.idle(t.rig, game.time + (t.anim || 0), t.state !== 'idle');
      if (t.role === 'beater' && t.victim && t.state === 'idle') { t.kickT = (t.kickT || 0) + dt; if (t.kickT > 1.3) t.kickT = -Math.random() * 0.6; if (t.kickT > 0 && t.kickT < 0.45) Pose.kickDown(t.rig, t.kickT / 0.45); t.yaw = Math.atan2(t.victim.pos.x - t.pos.x, t.victim.pos.z - t.pos.z); }
      t.rig.root.rotation.y += Math.atan2(Math.sin(t.yaw - t.rig.root.rotation.y), Math.cos(t.yaw - t.rig.root.rotation.y)) * Math.min(1, dt * 4);
      t.rig.update(dt, 8); t.rig.root.position.copy(t.pos);
    }
    for (const c of game.civilians) if (!c.gone && c.mood !== 'run' && Math.hypot(c.pos.x - S.focus.x, c.pos.z - S.focus.z) < 45) c.update(dt, game);
    for (const g of game.gunmen) if (!g.removed && g.rig && Math.hypot(g.pos.x - S.focus.x, g.pos.z - S.focus.z) < 45) { Pose.idle(g.rig, game.time, false); g.rig.update(dt, 8); g.rig.root.position.copy(g.pos); g.rig.root.rotation.y = g.yaw; }
    Pose.idle(player.rig, game.time, false); player.rig.update(dt, 8);
  }

  C.update = (dt, inp) => {
    if (!S) return;
    game.time += dt;
    if (inp.pressed.jump || inp.pressed.act) C.advance();
    if (inp.pressed.pause) C.skip();
    animate(dt);
    const gu = game.env.grade.uniforms; gu.hurt.value = 0; gu.sense.value = 0; game.timeScale = 1; // no red / grey filters over a cutscene
    const sh = S.shot;
    if (!sh) { const done = S.onDone; S = null; C.active = false; key.intensity = rim.intensity = 0; hud.cine.close(); done?.(); return; } // never leave the screen black
    // camera: blend from the last position into this shot, then drift slowly (push-in)
    S.t += dt; S.blend = Math.min(1, S.blend + dt / 1.1);
    const k = Math.min(1, S.t / S.dur), b = ease(S.blend);
    _a.lerpVectors(sh.from, sh.to, ease(k)); _look.lerpVectors(sh.look, sh.lookTo, ease(k));
    cam.position.lerpVectors(S.fromPos, _a, b);
    _b.lerpVectors(S.fromLook, _look, b);
    cam.lookAt(_b);
    S.lookNow.copy(_b);
    // light the subject from the camera side, rim from behind
    _a.subVectors(cam.position, _b).setY(0).normalize();
    key.position.set(_b.x + _a.x * 1.6 + _a.z * 0.8, _b.y + 0.9, _b.z + _a.z * 1.6 - _a.x * 0.8);
    rim.position.set(_b.x - _a.x * 2.5, _b.y + 2.2, _b.z - _a.z * 2.5);
    const lit = game.life.phase === 'day' ? 0.25 : 1;
    key.intensity += (7 * lit - key.intensity) * Math.min(1, dt * 3); rim.intensity += (2.5 * lit - rim.intensity) * Math.min(1, dt * 3); // a gentle fill, not a spotlight
    const fov = S.fov0 + (sh.fov - S.fov0) * Math.min(1, (S.i + b) / 1);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
    // text: type it out, then hold long enough to read, then move on by itself
    S.typed = Math.min(S.text.length, S.typed + dt * TYPE_CPS);
    hud.cine.line(S.who, S.text.slice(0, Math.floor(S.typed)), S.typed >= S.text.length, Math.min(1, S.t / S.dur), S.i === 0 && S.t < 3 ? 1 - Math.max(0, S.t - 2.2) / 0.8 : 0);
    // fades
    if (S.ending) {
      S.endT += dt;
      hud.cine.fade(Math.min(1, S.endT / 0.45));
      if (S.endT >= 0.5) {
        const done = S.onDone; S = null; C.active = false; key.intensity = 0; rim.intensity = 0;
        cam.fov = camera.fov || 68; cam.updateProjectionMatrix();
        hud.cine.close();
        done?.();
      }
      return;
    }
    hud.cine.fade(Math.max(0, 1 - S.t / 0.6) * (S.i === 0 ? 1 : 0));
    if (S.t >= S.dur && S.typed >= S.text.length) next();
  };
  return C;
}
