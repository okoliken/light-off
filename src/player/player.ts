// Bolaji's movement: two modes he switches between at will, on foot (run, jump, vault, climb, roll,
// fight) and on the board (push, carve, ollie, grind, skitch onto vehicles). Plus bail / down states.
import * as THREE from 'three';
import { Rig, Pose, makeBoardMesh, HIP_H } from './rig.ts';
import { clampToRegions } from '../world/layout.ts';
import { STEP } from '../world/collision.ts';

const G = 24;
const R_BODY = 0.34, H_BODY = 1.75;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const _c = new THREE.Vector3(), _c2 = new THREE.Vector3(), _qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
export function createPlayer(scene, world, traffic) {
  const col = world.collision;
  const rig = new Rig();
  scene.add(rig.root);
  const board = makeBoardMesh();
  board.visible = false; scene.add(board);

  const home = world.home;
  const p: any = {
    rig, board,
    pos: new THREE.Vector3(home.x, 0.15, home.z), vel: new THREE.Vector3(),
    yaw: home.yaw, heading: home.yaw, speed: 0,
    mode: 'foot', onGround: true, t: 0, anim: 0,
    hp: 100, maxHp: 100, nineLives: 1, injury: 0, hurtT: 99, invuln: 0, downs: 0, lastDownT: -99, critical: false, crawlT: 0, getupT: 0, leapCd: 0,
    holding: null, boardLost: false,
    riding: null, grind: null, skitch: null, climb: null,
    punch: { t: 9, side: 'R', combo: 0, cd: 0, kick: false },
    lastWall: null, lastWallT: 9, vaultT: 9, rollT: 0, bailT: 0, downT: 0, staggerT: 9,
    slopeVy: 0, lastGround: 0.15, airT: 0, shake: 0, holeCd: 0,
    events: [], guard: 0, carrying: null, sense: false,
    aiming: false, flip: null, airFlips: 0, wallrun: null, trick: null, airTricks: [], rollBuf: 9, throwT: 9, flashT: 9,
    lastMove: { x: 0, y: 0 }, wallrunCd: 0,
    act: null, eff: 1, energy: 100, fightingNear: false,
  };
  const emit = (e: string, data: any = {}) => p.events.push({ e, ...data });
  const contacts: any[] = [];
  const _w = new THREE.Vector3(), _a = new THREE.Vector3();

  p.respawn = (x = home.x, z = home.z, yaw = home.yaw) => {
    p.pos.set(x, 0.15, z); p.vel.set(0, 0, 0); p.yaw = p.heading = yaw; p.speed = 0;
    p.mode = 'foot'; p.hp = Math.max(p.hp, p.cap() * 0.5); p.invuln = 1.5; p.riding = p.grind = p.skitch = p.climb = p.wallrun = p.flip = p.trick = null; p.critical = false;
    rig.root.rotation.set(0, yaw, 0);
  };

  // health is out of 100; a slice of every hit becomes injury that only food and sleep heal
  p.cap = () => p.maxHp - p.injury;
  p.hurt = (dmg, fx, fz, knock = 3) => {
    if (p.invuln > 0 || ['roll', 'down', 'crawl', 'getup'].includes(p.mode)) return false;
    if (p.mode === 'act') { if (p.act.invuln) return false; p.mode = 'foot'; p.act = null; p.onGround = p.pos.y <= p.lastGround + 0.05; }
    p.hp -= dmg; p.hurtT = 0; p.invuln = 0.45; p.staggerT = 0;
    p.injury = Math.min(55, p.injury + dmg * 0.22); // injury never caps him below 45
    emit('hurt', { dmg });
    const dx = p.pos.x - fx, dz = p.pos.z - fz, d = Math.hypot(dx, dz) || 1;
    p.vel.x += (dx / d) * knock; p.vel.z += (dz / d) * knock;
    if (p.hp <= 0 && p.nineLives > 0 && !p.cuffed) { // once a night, a cat twists out of it and lands on his feet
      p.nineLives--; p.hp = 14; p.mode = 'roll'; p.rollT = 0; p.invuln = 1.6; emit('nineLives'); return true;
    }
    if (p.hp <= 0) { p.hp = 0; startDown(); return true; }
    if (p.mode === 'board' || p.mode === 'grind' || p.mode === 'skitch') startBail(0.5);
    return true;
  };
  function startDown() {
    // a second knockdown within a minute, or when already badly injured, is critical: he has to crawl away
    p.critical = (p.t - p.lastDownT < 60) || p.cap() < 30;
    p.lastDownT = p.t; p.downs++;
    p.mode = 'down'; p.downT = 0; p.skitch = p.grind = p.climb = p.wallrun = p.flip = p.trick = p.act = null;
    if (p.holding) p.dropHeld?.();
    emit('down', { critical: p.critical });
  }
  p.getUp = (hp) => { p.mode = 'getup'; p.getupT = 0; p.hp = Math.min(p.cap(), hp); p.critical = false; emit('getup'); };
  function startBail(up = 3) {
    p.mode = 'bail'; p.bailT = 0; p.grind = p.skitch = p.trick = null; p.riding = null; p.airTricks = [];
    p.vel.y = Math.max(p.vel.y, up); p.onGround = false;
    p.boardFly = { x: p.pos.x, y: p.pos.y + 0.1, z: p.pos.z, vx: p.vel.x * 0.6, vy: 4, vz: p.vel.z * 0.6, spin: 0 };
    emit('bail');
  }

  p.tryPunch = () => {
    const pu = p.punch;
    if (pu.cd > 0 || !['foot', 'board'].includes(p.mode) || p.climb) return null;
    pu.combo = pu.t < 0.7 ? pu.combo + 1 : 0;
    pu.kick = pu.combo % 3 === 2;
    pu.side = pu.side === 'R' ? 'L' : 'R';
    pu.t = 0; pu.cd = pu.kick ? 0.45 : 0.28;
    p.guard = 2.5;
    emit('swing');
    return { reach: pu.kick ? 2.0 : 1.75, dmg: 1, knock: pu.kick ? 7 : 3.5, kick: pu.kick };
  };

  const TRICKS = { right: ['Kickflip', 0.42, 0, 1, 60], left: ['Heelflip', 0.42, 0, -1, 60], up: ['360 Flip', 0.55, 2, 1, 120], down: ['Shove-it', 0.36, 1, 0, 50], none: ['Kickflip', 0.42, 0, 1, 60] };
  // body flips on the board: Space again in the air. Pull back = backflip, push forward = frontflip,
  // left/right = 360 spin. Like a cat he finds a bit more air for it.
  const BODY = { down: ['Backflip', 0.62, 0, -1, 150], none: ['Backflip', 0.62, 0, -1, 150], up: ['Frontflip', 0.62, 0, 1, 150], left: ['360 Spin', 0.5, -1, 0, 110], right: ['360 Spin', 0.5, 1, 0, 110] };
  p.tryBodyFlip = () => {
    if (p.mode !== 'board' || p.onGround || (p.trick && p.trick.t < p.trick.dur) || p.airT < 0.06 || p.prone) return false;
    const m = p.lastMove, dir = Math.hypot(m.x, m.y) < 0.4 ? 'none' : Math.abs(m.x) > Math.abs(m.y) ? (m.x > 0 ? 'right' : 'left') : (m.y > 0 ? 'up' : 'down');
    const [name, dur, spin, flip, pts] = BODY[dir];
    p.vel.y = Math.max(p.vel.y, 0) + 4.2;
    p.trick = { name, dur, spins: 0, flips: 0, body: true, bspin: spin, bflip: flip, pts, t: 0 };
    p.airTricks.push({ name, pts });
    emit('trick', { name });
    return true;
  };
  p.tryTrick = () => {
    if (p.mode !== 'board' || p.onGround || (p.trick && p.trick.t < p.trick.dur) || p.airT < 0.05 || p.prone) return false;
    const m = p.lastMove, dir = Math.hypot(m.x, m.y) < 0.4 ? 'none' : Math.abs(m.x) > Math.abs(m.y) ? (m.x > 0 ? 'right' : 'left') : (m.y > 0 ? 'up' : 'down');
    const [name, dur, spins, flips, pts] = TRICKS[dir];
    p.trick = { name, dur, spins, flips, pts, t: 0 };
    p.airTricks.push({ name, pts });
    emit('trick', { name });
    return true;
  };
  // combat actions: lunge to the target, hit at the right frame of the animation, then recover
  const ACT = {
    jab: [0.26, 0.11], hook: [0.3, 0.13], knee: [0.32, 0.14], spin: [0.42, 0.22], flipkick: [0.55, 0.24],
    launch: [0.42, 0.16], air: [0.3, 0.1], slam: [0.45, 0.18], counter: [0.42, 0.14], takedown: [0.62, 0.34], web: [0.22, 0.05],
    pounce: [0.62, 0.5], throw: [0.32, 0.14], sweep: [0.55, 0.2], flurry: [1.0, 0.82], catdrop: [0.6, 0.06],
  };
  p.startAct = (kind, target, onHit, { invuln = false, reach = 1.15 } = {}) => {
    const [dur, hitAt] = ACT[kind];
    const act: any = { kind, t: 0, dur: dur / Math.max(0.75, p.eff), hitAt: hitAt / Math.max(0.75, p.eff), target, onHit, hit: false, invuln, air: kind === 'air' || kind === 'slam' };
    act.fx = p.pos.x; act.fz = p.pos.z; act.fy = p.pos.y;
    if (target) {
      const dx = target.pos.x - p.pos.x, dz = target.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
      const stop = Math.max(0, d - reach);
      act.tx = p.pos.x + dx / d * stop; act.tz = p.pos.z + dz / d * stop;
      act.ty = act.air ? target.pos.y + 0.1 : null;
      act.lunge = Math.min(0.28, stop / 18 + 0.02);
      p.yaw = Math.atan2(dx, dz);
      if (kind === 'pounce') { act.lunge = act.hitAt; act.arc = 1.4 + d * 0.12; act.tyg = target.pos.y; }
      if (kind === 'throw') { act.tx = p.pos.x; act.tz = p.pos.z; act.lunge = 0; }
    } else { act.tx = p.pos.x; act.tz = p.pos.z; act.lunge = 0; }
    if (p.mode === 'board') { p.boardFly = null; }
    p.mode = 'act'; p.act = act; p.vel.set(0, 0, 0);
    if (invuln) p.invuln = Math.max(p.invuln, act.dur);
    emit('act', { kind });
  };
  function actUpdate(dt) {
    const a = p.act;
    a.t += dt;
    const k = a.lunge > 0 ? Math.min(1, a.t / a.lunge) : 1, e = 1 - (1 - k) * (1 - k);
    p.pos.x = a.fx + (a.tx - a.fx) * e; p.pos.z = a.fz + (a.tz - a.fz) * e;
    if (a.kind === 'pounce') { const k2 = Math.min(1, a.t / a.lunge); p.pos.x = a.fx + (a.tx - a.fx) * k2; p.pos.z = a.fz + (a.tz - a.fz) * k2; p.pos.y = a.fy + (a.tyg - a.fy) * k2 + Math.sin(k2 * Math.PI) * a.arc; }
    else if (a.air) { if (a.ty != null) p.pos.y = a.fy + (a.ty - a.fy) * e; }
    else { const g = col.groundHeight(p.pos.x, p.pos.z, p.pos.y + 0.4).h; p.pos.y = g; }
    if (a.kind === 'pounce' && a.t >= a.lunge) { const g = col.groundHeight(p.pos.x, p.pos.z, p.pos.y + 0.4).h; p.pos.y = g; }
    if (a.target && a.target.pos) p.yaw = Math.atan2(a.target.pos.x - p.pos.x, a.target.pos.z - p.pos.z);
    clampToRegions(p.pos);
    col.resolve(p.pos, p.pos.y, R_BODY, H_BODY, contacts);
    if (a.kind === 'pounce' && a.t < a.lunge) { /* in the air: skip ground snapping */ }
    if (!a.hit && a.t >= a.hitAt) { a.hit = true; a.onHit?.(); }
    if (a.t >= a.dur) {
      p.mode = 'foot'; p.act = null;
      if (a.air) { p.onGround = false; p.vel.set(0, a.kind === 'slam' ? -14 : 2.5, 0); p.airFlips = 1; }
      else { p.onGround = true; p.guard = 2; }
    }
  }
  // the cat leap: a long, high jump in the direction he's facing
  p.leap = (dir) => {
    if (!['foot', 'board'].includes(p.mode) || !p.onGround || p.leapCd > 0 || p.energy < 8) return false;
    if (p.mode === 'board') { p.mode = 'foot'; }
    const y = dir ? Math.atan2(dir[0], dir[1]) : p.yaw; p.yaw = y;
    const f = 0.8 + 0.2 * p.eff;
    p.vel.set(Math.sin(y) * 14 * f, 11 * f, Math.cos(y) * 14 * f); p.onGround = false; p.riding = null;
    p.leapCd = 1.1; p.airFlips = 0; p.flip = { kind: 'front', t: 0, dur: 0.75 };
    emit('leap');
    return true;
  };
  // riding public transport
  p.startRide = (v, visible) => { p.mode = 'ride'; p.ride = { v, visible }; p.riding = v; p.vel.set(0, 0, 0); p.holding && p.dropHeld?.(); emit('ride'); };
  p.endRide = (x, z) => { p.mode = 'foot'; p.ride = null; p.riding = null; p.pos.set(x, col.groundHeight(x, z, 3).h, z); p.vel.set(0, 0, 0); p.onGround = true; rig.root.visible = true; };
  p.startThrow = () => { p.throwT = 0; };
  p.startFlash = () => { p.flashT = 0; };
  p.handPos = (out) => { rig.root.updateMatrixWorld(true); return rig.b.haR.getWorldPosition(out); };
  p.setOutfit = (o, maxHp) => { rig.rebuild(o); if (maxHp) { p.maxHp = maxHp; p.hp = maxHp; } };

  function wishDir(inp, camYaw) {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    _w.set(fx * inp.move.y + rx * inp.move.x, 0, fz * inp.move.y + rz * inp.move.x);
    return _w;
  }

  // ---- shared physics: integrate, collide with the city and vehicles, find the ground ----
  function physics(dt, { snap = 0.35, onBoard = false }: any = {}) {
    // stand on a moving vehicle roof
    if (p.riding && p.onGround && p.mode !== 'skitch') {
      const v = p.riding;
      const rx = p.pos.x - v.pos.x, rz = p.pos.z - v.pos.z, a = v.yawRate * dt, c = Math.cos(a), s = Math.sin(a);
      p.pos.x = v.pos.x + rx * c + rz * s + v.vel.x * dt; p.pos.z = v.pos.z - rx * s + rz * c + v.vel.z * dt;
      if (onBoard) p.heading += a; else p.yaw += a;
    }
    if (!p.onGround) p.vel.y -= G * dt;
    p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; p.pos.y += p.vel.y * dt;
    // world bounds: the district, the bridge approach, the bridge, UNILAG
    clampToRegions(p.pos);
    col.resolve(p.pos, p.pos.y, R_BODY, H_BODY, contacts);
    for (const c of contacts) { p.lastWall = c; p.lastWallT = 0; }
    const hit = traffic.collide(p.pos, p.pos.y, R_BODY, p.vel);
    // ground
    const g = col.groundHeight(p.pos.x, p.pos.z, p.pos.y);
    let gh = g.h, plat = null;
    const pl = traffic.platformAt(p.pos.x, p.pos.z, p.pos.y);
    if (pl && pl.top > gh) { gh = pl.top; plat = pl.v; }
    const wasGround = p.onGround;
    if (p.vel.y <= 0.01 && p.pos.y <= gh + (wasGround ? snap : 0.02)) {
      if (!wasGround) { p.landVy = p.vel.y; emit('land', { vy: p.vel.y, h: p.airT }); }
      if (wasGround && dt > 0) p.slopeVy = clamp((gh - p.lastGround) / dt, -6, 8); else p.slopeVy = 0;
      p.pos.y = gh; p.vel.y = 0; p.onGround = true; p.riding = plat; p.airT = 0;
    } else {
      if (wasGround && p.slopeVy > 0.5) p.vel.y = p.slopeVy; // launched off the top of a ramp
      p.onGround = false; p.riding = null; p.airT += dt;
    }
    p.lastGround = gh;
    return { contacts, hit, landed: !wasGround && p.onGround };
  }

  function vehicleHit(hit, onBoard) {
    if (!hit || p.invuln > 0) return;
    if (hit.rel > 5.5 && hit.v.speed > 4) {
      const dmg = 14 + Math.min(20, hit.rel * 1.2);
      p.vel.set(hit.v.vel.x * 0.7 + hit.nx * 4, 5, hit.v.vel.z * 0.7 + hit.nz * 4);
      p.hurt(dmg, p.pos.x - hit.nx, p.pos.z - hit.nz, 0);
      emit('carhit', { v: hit.v });
      if (p.mode !== 'down') startBail(5);
    } else if (onBoard && hit.rel > 3) startBail(2);
  }

  // ---------------- modes ----------------
  function foot(dt, inp, camYaw) {
    const w = wishDir(inp, camYaw), mag = Math.min(1, w.length());
    const sprint = inp.held.sprint && mag > 0.5 && !p.aiming;
    const cond = world.roadCond?.(p.pos.x, p.pos.z);
    const max = (p.adrenT > 0 ? 1.15 : 1) * (p.cuffed ? 0.88 : 1) * (cond === 'flood' && p.onGround ? 0.55 : 1) * (p.aiming ? 3.2 * mag : sprint ? 9.2 : 6.4 * Math.max(0.35, mag)) * (0.7 + 0.3 * p.eff) * (p.hp < 35 ? 0.8 : p.hp < 15 ? 0.7 : 1);
    const acc = p.onGround ? (p.guard > 0 ? 28 : 42) : 7;
    const tx = mag > 0.05 ? (w.x / (w.length() || 1)) * max * mag : 0, tz = mag > 0.05 ? (w.z / (w.length() || 1)) * max * mag : 0;
    if (p.onGround || mag > 0.05) { // in the air with no input he keeps his momentum (leaps carry)
      p.vel.x += clamp(tx - p.vel.x, -acc * dt, acc * dt);
      p.vel.z += clamp(tz - p.vel.z, -acc * dt, acc * dt);
    }
    if (p.aiming) p.yaw += clamp(wrap(camYaw - p.yaw), -16 * dt, 16 * dt);
    else if (mag > 0.1) { const want = Math.atan2(w.x, w.z); p.yaw += clamp(wrap(want - p.yaw), -(p.onGround ? 13 : 5) * dt, (p.onGround ? 13 : 5) * dt); }
    if (p.onGround) { p.airFlips = 0; p.flip = null; }
    if (p.flip) p.flip.t += dt;

    if (inp.pressed.jump) {
      const wall = p.lastWallT < 0.2 && p.lastWall;
      const facing = wall && (Math.sin(p.yaw) * wall.nx + Math.cos(p.yaw) * wall.nz) < -0.5;
      if (facing && wall.s.maxy - p.pos.y > 1.3) { startClimb(wall); return; }
      if (p.onGround) p.charge = 0; // start crouching: a tap is a high jump, holding charges a cat leap
      else if (p.airFlips < 1 && p.airT > 0.06 && !p.aiming && (p.energy <= 3 || p.hp <= 8)) emit('tooTired');
      else if (p.airFlips < 1 && p.airT > 0.06 && !p.aiming && p.energy > 3 && p.hp > 8) { // acrobatic air flip (a small second jump)
        const hs = Math.hypot(p.vel.x, p.vel.z);
        const kind = Math.abs(inp.move.x) > 0.6 && Math.abs(inp.move.y) < 0.5 ? 'side' : (hs > 2.5 || inp.move.y > 0.3) ? 'front' : 'back';
        p.airFlips++; p.vel.y = Math.max(p.vel.y, 6.4);
        if (kind === 'back') { p.vel.x -= Math.sin(p.yaw) * 2; p.vel.z -= Math.cos(p.yaw) * 2; }
        if (kind === 'side') { const s2 = Math.sign(inp.move.x); p.vel.x += -Math.cos(p.yaw) * s2 * 2.5; p.vel.z += Math.sin(p.yaw) * s2 * 2.5; rig._flipDir = -s2; }
        p.flip = { kind, t: 0, dur: 0.6 };
        emit('flip', { kind });
      }
    }
    // wall-run: hit a tall wall at a glancing angle while moving fast in the air
    p.wallrunCd -= dt;
    if (!p.onGround && p.lastWallT < 0.05 && p.lastWall && p.wallrunCd <= 0 && !p.aiming) {
      const wall = p.lastWall, hs = Math.hypot(p.vel.x, p.vel.z);
      const into = hs > 0.1 ? (p.vel.x * wall.nx + p.vel.z * wall.nz) / hs : 0;
      if (hs > 4.5 && into > -0.75 && into < 0.3 && wall.s.maxy - p.pos.y > 2.2 && p.vel.y > -7 && (Math.abs(wall.nx) > 0.9 || Math.abs(wall.nz) > 0.9)) { startWallrun(wall, hs); return; }
    }
    // cat leap: release to launch; the longer he crouched, the higher he goes (up to ~5 m)
    if (p.charge != null) {
      if (!p.onGround) p.charge = null;
      else if (inp.held.jump && p.charge < 0.6) { p.charge += dt; p.vel.x *= 1 - Math.min(1, dt * 6); p.vel.z *= 1 - Math.min(1, dt * 6); }
      else {
        const k = Math.max(0, Math.min(1, (p.charge - 0.08) / 0.5)), f = 0.8 + 0.2 * p.eff;
        p.vel.y = (9.2 + 6.4 * k) * f * (p.skills.leap2 ? 1.15 : 1);
        const hs = Math.hypot(p.vel.x, p.vel.z);
        if (hs > 2 || k > 0.3) { const boost = 1 + k * 0.6; p.vel.x = (hs > 2 ? p.vel.x : Math.sin(p.yaw) * 2) * boost; p.vel.z = (hs > 2 ? p.vel.z : Math.cos(p.yaw) * 2) * boost; }
        p.onGround = false; p.riding = null; p.charge = null; p.airFlips = 0;
        emit('jump', { power: k });
      }
    }
    // grab a wall while falling / jumping into it with jump held
    if (!p.onGround && inp.held.jump && p.lastWallT < 0.05 && p.lastWall) {
      const wall = p.lastWall, facing = (Math.sin(p.yaw) * wall.nx + Math.cos(p.yaw) * wall.nz) < -0.5;
      if (facing && wall.s.maxy - p.pos.y > 1.0) { startClimb(wall); return; }
    }
    if (inp.pressed.roll && !p.onGround) p.rollBuf = 0;
    if (inp.pressed.roll && p.onGround) { p.mode = 'roll'; p.rollT = 0; const d = mag > 0.1 ? Math.atan2(w.x, w.z) : p.yaw; p.yaw = d; p.vel.x = Math.sin(d) * 9.5; p.vel.z = Math.cos(d) * 9.5; p.invuln = 0.45; emit('roll'); return; }
    if (inp.pressed.board && p.onGround && p.noBoard) emit('noBoard'); // by day the board stays hidden with the suit
    else if (inp.pressed.board && p.onGround && !p.boardLost && !p.cuffed) { toBoard(); return; }
    if (inp.pressed.skitch && p.onGround && (p.noBoard || !p.boardLost) && !p.cuffed) { const v = traffic.nearestSkitch(p.pos); if (v) { if (!p.noBoard) toBoard(); startSkitch(v); return; } }

    const ph = physics(dt, { snap: 0.4 });
    if (ph.landed) {
      if (p.flip && p.flip.t < p.flip.dur * 0.7) { p.flip = null; p.vel.x *= 0.3; p.vel.z *= 0.3; p.staggerT = 0; emit('sloppy'); }
      else if (p.flip) { emit('flipLand', { kind: p.flip.kind }); p.flip = null; }
      if (p.landVy < -10 && p.rollBuf < 0.35) { p.mode = 'roll'; p.rollT = 0; p.invuln = 0.4; emit('landRoll'); return; }
      // like a cat, he lands on his feet: only a really big drop hurts, and less than it would
      if (p.landVy < (p.skills.roll ? -60 : -30)) { p.hurt(Math.min(25, (-p.landVy - 28) * 4), p.pos.x, p.pos.z, 0); emit('hardland'); }
      else if (p.landVy < -15 && !p.cuffed) { emit('catDrop', { vy: p.landVy }); return; } // a big drop: the cat landing
    }
    // auto-vault low obstacles when running into them
    if (p.onGround && mag > 0.5 && Math.hypot(p.vel.x, p.vel.z) > 1.5) {
      for (const c of ph.contacts) {
        const h = c.s.maxy - p.pos.y;
        const into = (w.x * c.nx + w.z * c.nz) / (w.length() || 1);
        if (h > STEP && h < 1.5 && into < -0.5) { p.vel.y = Math.sqrt(2 * G * (h + 0.35)); p.onGround = false; p.vaultT = 0; emit('vault'); break; }
      }
    }
    vehicleHit(ph.hit, false);
  }

  function toBoard() {
    p.mode = 'board';
    const hs = Math.hypot(p.vel.x, p.vel.z);
    p.heading = hs > 1 ? Math.atan2(p.vel.x, p.vel.z) : p.yaw;
    p.speed = Math.max(hs, 3.5);
    emit('boardOn');
  }
  function toFoot() {
    p.mode = 'foot';
    p.yaw = p.heading;
    const s = Math.min(p.speed, 9);
    p.vel.x = Math.sin(p.heading) * s; p.vel.z = Math.cos(p.heading) * s;
    emit('boardOff');
  }

  function skate(dt, inp, camYaw) {
    const w = wishDir(inp, camYaw), mag = Math.min(1, w.length());
    let pushing = 0;
    // lying on the board: only once he's going fast; low, hard to spot, steer with the hands
    if (inp.pressed.prone && p.onGround) { if (p.prone) { p.prone = false; emit('proneOff'); } else if (p.speed > 9) { p.prone = true; emit('proneOn'); } else emit('proneSlow'); }
    if (p.prone && (p.speed < 2.2 || !p.onGround)) { p.prone = false; emit('proneOff'); }
    if (p.prone && p.onGround) {
      if (mag > 0.2) { const diff = wrap(Math.atan2(w.x, w.z) - p.heading); p.heading += clamp(diff, -2.6 * dt, 2.6 * dt); if (Math.cos(diff) > 0.5 && p.speed < 7) p.speed += 1.6 * dt; } // hands paddling
      p.speed -= (0.12 + p.speed * 0.006) * dt; // less drag lying flat
      p.speed = Math.max(0, p.speed);
      p.vel.x = Math.sin(p.heading) * p.speed; p.vel.z = Math.cos(p.heading) * p.speed;
    }
    else if (p.onGround) {
      if (mag > 0.2) {
        const want = Math.atan2(w.x, w.z), diff = wrap(want - p.heading);
        if (Math.abs(diff) > 2.3) p.speed -= 11 * dt; // pulling back = brake (foot drag)
        else {
          const rate = 3.4 - 1.7 * Math.min(1, p.speed / 16);
          p.heading += clamp(diff, -rate * dt, rate * dt);
          const fwd = Math.cos(diff) * mag;
          const target = (inp.held.sprint ? 16.5 : 11.5) * (0.75 + 0.25 * p.eff);
          if (fwd > 0.3 && p.speed < target) { p.speed += (p.speed < 6 ? 7 : inp.held.sprint ? 3.2 : 4) * dt * fwd; pushing = 1; }
        }
      }
      p.speed -= (0.3 + p.speed * 0.012) * dt;
      const cond = world.roadCond?.(p.pos.x, p.pos.z);
      if (cond === 'flood') { p.speed -= p.speed * 1.6 * dt; if (Math.random() < dt * 6) emit('splash'); }
      else if (cond === 'bad' && p.speed > 9) p.speed -= (p.speed - 9) * 1.2 * dt; // rough surface
      p.speed = Math.max(0, p.speed);
      p.vel.x = Math.sin(p.heading) * p.speed; p.vel.z = Math.cos(p.heading) * p.speed;
      if (inp.pressed.jump) { p.vel.y = 7.6 + Math.min(1.8, p.speed * 0.1) + (inp.held.sprint ? 1.2 : 0); p.onGround = false; p.riding = null; p.airTricks = []; emit('ollie'); }
      // potholes
      p.holeCd -= dt;
      if (p.speed > 4 && p.holeCd <= 0) for (const h of world.potholes) {
        if ((p.pos.x - h.x) ** 2 + (p.pos.z - h.z) ** 2 < h.r * h.r) {
          p.holeCd = 0.8; p.shake = 0.5; emit('pothole');
          if (p.speed > 14) { startBail(3); return; }
          p.speed *= 0.62; break;
        }
      }
    } else {
      // air: small rotation control, look for rails
      if (mag > 0.2) { const want = Math.atan2(w.x, w.z); p.heading += clamp(wrap(want - p.heading), -2 * dt, 2 * dt); }
      if (inp.pressed.jump && p.tryBodyFlip()) { /* flipping */ }
      if (p.vel.y < 2 && tryGrind()) return;
    }
    if (inp.pressed.board && p.onGround) { p.prone = false; toFoot(); return; }
    if (inp.pressed.skitch) { const v = traffic.nearestSkitch(p.pos); if (v) { startSkitch(v); return; } }
    p.pushing = pushing;

    if (p.trick) p.trick.t += dt;
    if (p.onGround) { if (p.trick && p.trick.t >= p.trick.dur) p.trick = null; }
    const ph = physics(dt, { snap: p.speed > 6 ? 0.25 : 0.35, onBoard: true });
    if (ph.landed) {
      const hs = Math.hypot(p.vel.x, p.vel.z);
      const along = hs > 0.1 ? (p.vel.x * Math.sin(p.heading) + p.vel.z * Math.cos(p.heading)) / hs : 1;
      if (p.trick && p.trick.t < p.trick.dur * (p.trick.body ? 0.85 : 0.7)) { emit('trickFail', { name: p.trick.name }); startBail(1); return; }
      if (p.landVy < -16 || along < 0.3) { startBail(1); return; }
      p.speed = hs * Math.max(0.5, along);
      if (p.airTricks.length) { emit('trickLand', { names: p.airTricks.slice(), pts: p.airTricks.reduce((a, t) => a + t.pts, 0) + Math.round(p.airT * 40) }); p.airTricks = []; }
      p.trick = null;
    }
    for (const c of ph.contacts) {
      if (c.s.maxy - p.pos.y <= STEP) continue;
      const into = -(Math.sin(p.heading) * c.nx + Math.cos(p.heading) * c.nz);
      if (p.speed > 8.5 && into > 0.72) { emit('wallhit'); startBail(2); return; }
      if (into > 0) {
        p.speed *= 1 - into * 0.7 * Math.min(1, dt * 20);
        // turn to slide along the wall
        const tx = -c.nz, tz = c.nx, side = Math.sin(p.heading) * tx + Math.cos(p.heading) * tz >= 0 ? 1 : -1;
        const along = Math.atan2(tx * side, tz * side);
        p.heading += clamp(wrap(along - p.heading), -4 * dt, 4 * dt);
      }
    }
    vehicleHit(ph.hit, true);
  }

  function tryGrind() {
    if (p.grindCd > 0) return false;
    for (const r of world.rails) {
      if (r === p.lastRail && p.t - p.leftRailT < 0.9) continue;
      const ax = r.a[0], az = r.a[2], bx = r.b[0], bz = r.b[2], y = r.a[1];
      if (p.pos.y < y - 0.6 || p.pos.y > y + 0.95) continue;
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
      let t = ((p.pos.x - ax) * dx + (p.pos.z - az) * dz) / L2;
      if (t < 0.02 || t > 0.98) continue;
      const cx = ax + dx * t, cz = az + dz * t;
      if ((p.pos.x - cx) ** 2 + (p.pos.z - cz) ** 2 > 0.95 * 0.95) continue;
      const ux = dx / L, uz = dz / L, va = p.vel.x * ux + p.vel.z * uz;
      const dir = va >= 0 ? 1 : -1;
      p.mode = 'grind';
      p.grind = { r, s: t * L, L, ux, uz, y, dir, speed: Math.max(Math.abs(va), 5) };
      p.heading = Math.atan2(ux * dir, uz * dir);
      p.vel.y = 0; p.onGround = true; emit('grind');
      return true;
    }
    return false;
  }

  function grind(dt, inp, camYaw) {
    const g = p.grind;
    g.s += g.dir * g.speed * dt; g.speed = Math.max(4, g.speed - 0.5 * dt);
    p.pos.set(g.r.a[0] + g.ux * g.s, g.y, g.r.a[2] + g.uz * g.s);
    p.speed = g.speed; p.vel.set(g.ux * g.dir * g.speed, 0, g.uz * g.dir * g.speed);
    const off = g.s < 0 || g.s > g.L;
    // ways off the rail: Space ollies off (steer to hop sideways), C hops off to the side, R steps off onto your feet
    const hop = inp.pressed.jump, side = inp.pressed.roll, step = inp.pressed.board;
    if (hop || side || step || off) {
      const fx = g.ux * g.dir, fz = g.uz * g.dir;          // along the rail
      let rx = -fz, rz = fx;                                 // one side of the rail
      const m = inp.move, mag = Math.hypot(m.x, m.y);
      let lat = 0;
      if (mag > 0.2) { // which side is the player steering toward (camera-relative)?
        const wx = Math.sin(camYaw) * m.y - Math.cos(camYaw) * m.x, wz = Math.cos(camYaw) * m.y + Math.sin(camYaw) * m.x;
        lat = (wx * rx + wz * rz) / mag;
      }
      if (Math.abs(lat) < 0.3) lat = side || step ? 1 : 0.7; // no steering: still hop clear of the rail
      const push = side || step ? 4.2 * Math.sign(lat || 1) : lat * 4.5;
      p.grind = null; p.onGround = false; p.grindCd = 0.5; p.lastRail = g.r; p.leftRailT = p.t;
      p.vel.x += rx * push; p.vel.z += rz * push;
      p.vel.y = hop ? 6.8 : side || step ? 4.2 : 1.5;
      p.mode = 'board';
      if (hop) emit('ollie');
      emit('grindEnd');
    }
  }

  function startSkitch(v) {
    p.mode = 'skitch';
    p.skitch = { v, lat: 0, grip: 100, t: 0, swatAt: v.type === 'danfo' ? 3 + Math.random() * 3.5 : 99, warned: false };
    p.riding = v; emit('skitch', { v });
  }
  function skitch(dt, inp, camYaw) {
    const s = p.skitch, v = s.v;
    const w = wishDir(inp, camYaw);
    s.t += dt;
    s.lat = clamp(s.lat + (w.x * v.rt.x + w.z * v.rt.z) * 2.2 * dt, -0.95, 0.95);
    // no grip limit: he holds on as long as he likes (E or Space to let go)
    if (s.t > s.swatAt && !s.warned) { s.warned = true; emit('conductor'); }
    if (inp.pressed.jump && v.spec.platform) { // bolekaja: climb up onto the roof and ride it
      const back = v.spec.len * 0.25;
      p.mode = 'foot'; p.skitch = null; p.pos.set(v.pos.x - v.fwd.x * back, v.pos.y + v.spec.h + 0.05, v.pos.z - v.fwd.z * back);
      p.vel.copy(v.vel); p.vel.y = 0; p.onGround = true; p.riding = v; p.yaw = v.yaw; emit('roofride'); return;
    }
    const letGo = inp.pressed.skitch || (inp.pressed.jump && !v.spec.platform);
    const lost = !traffic.vehicles.includes(v) || (v.speed < 1 && s.t > 4);
    // the conductor shouts, but he can't shake you off
    if (letGo || lost) {
      p.mode = p.noBoard ? 'foot' : 'board'; p.skitch = null; p.riding = null;
      p.heading = v.yaw; p.yaw = v.yaw; p.speed = v.speed + (letGo ? 2.5 : 0);
      p.vel.set(Math.sin(p.heading) * p.speed, 0, Math.cos(p.heading) * p.speed);
      if (inp.pressed.jump) { p.vel.y = 7; p.onGround = false; emit('ollie'); }
      emit('skitchEnd', { sling: letGo });
      return;
    }
    traffic.attachPoint(v, s.lat, _a);
    const k = Math.min(1, dt * 14);
    p.pos.x += (_a.x - p.pos.x) * k; p.pos.z += (_a.z - p.pos.z) * k;
    const g = col.groundHeight(p.pos.x, p.pos.z, p.pos.y + 0.3);
    p.pos.y = g.h + (p.noBoard ? 0.45 : 0); p.onGround = true; // on foot he hangs off the back ladder, feet up
    p.heading = v.yaw; p.speed = v.speed; p.vel.copy(v.vel);
  }

  function startWallrun(wall, hs) {
    if (p.cuffed) return;
    const nx = Math.round(wall.nx), nz = Math.round(wall.nz);
    let tx = -nz, tz = nx;
    if (p.vel.x * tx + p.vel.z * tz < 0) { tx = -tx; tz = -tz; }
    // is the wall on his left or right?  right(facing) = (-tz, tx)
    const side = (nx * -tz + nz * tx) > 0 ? 1 : -1;
    p.mode = 'wallrun'; p.wallrun = { s: wall.s, nx, nz, tx, tz, t: 0, speed: Math.max(hs, 7.5), side };
    p.vel.y = Math.max(p.vel.y, 3.8); p.yaw = Math.atan2(tx, tz); p.flip = null;
    emit('wallrun');
  }
  function wallrun(dt, inp) {
    const w = p.wallrun, s = w.s;
    w.t += dt; p.anim += dt * 14;
    p.vel.y -= G * (p.skills.wallrun2 ? 0.2 : 0.32) * dt;
    p.pos.x += w.tx * w.speed * dt; p.pos.z += w.tz * w.speed * dt; p.pos.y += p.vel.y * dt;
    if (w.nx > 0) p.pos.x = s.maxx + R_BODY; else if (w.nx < 0) p.pos.x = s.minx - R_BODY;
    if (w.nz > 0) p.pos.z = s.maxz + R_BODY; else if (w.nz < 0) p.pos.z = s.minz - R_BODY;
    p.vel.x = w.tx * w.speed; p.vel.z = w.tz * w.speed;
    const offEdge = w.nx !== 0 ? (p.pos.z < s.minz - 0.1 || p.pos.z > s.maxz + 0.1) : (p.pos.x < s.minx - 0.1 || p.pos.x > s.maxx + 0.1);
    const end = () => { p.mode = 'foot'; p.wallrun = null; p.onGround = false; p.wallrunCd = 0.4; };
    if (p.pos.y + 1.3 >= s.maxy && p.vel.y > -1) { // run up and over onto the roof
      p.pos.x -= w.nx * 0.75; p.pos.z -= w.nz * 0.75; p.pos.y = s.maxy; p.mode = 'foot'; p.wallrun = null; p.onGround = true; p.vaultT = 0; emit('mantle'); return;
    }
    if (inp.pressed.jump) { // leap off the wall with a flip
      end(); p.vel.set(w.tx * 6.5 + w.nx * 6, 7.6, w.tz * 6.5 + w.nz * 6); p.yaw = Math.atan2(p.vel.x, p.vel.z);
      p.flip = { kind: 'front', t: 0, dur: 0.6 }; p.airFlips = 1; emit('walljump'); return;
    }
    const g = col.groundHeight(p.pos.x, p.pos.z, p.pos.y);
    if (w.t > (p.skills.wallrun2 ? 2.2 : 1.25) || offEdge || inp.pressed.roll || p.pos.y <= g.h + 0.05) { end(); if (p.pos.y <= g.h + 0.05) { p.pos.y = g.h; p.onGround = true; } }
  }

  // on the ground: mash Space / F for an adrenaline burst that throws him back on his feet
  p.adren = 0;
  function adrenaline(dt, inp) {
    if (inp.pressed.jump || inp.pressed.act) p.adren += 0.1 + 0.05 * p.eff;
    p.adren = Math.max(0, p.adren - dt * 0.18);
    if (p.adren < 1) return false;
    p.adren = 0; p.getUp(Math.max(p.hp, 25)); p.critical = false; p.invuln = 2.2; p.adrenT = 4; emit('adrenaline');
    return true;
  }
  function startClimb(wall) {
    if (p.cuffed) return; // hands cuffed behind him: no climbing
    p.mode = 'climb'; p.climb = { s: wall.s, nx: Math.round(wall.nx), nz: Math.round(wall.nz) };
    if (p.climb.nx === 0 && p.climb.nz === 0) p.climb.nx = 1;
    p.vel.set(0, 0, 0); p.onGround = false; p.yaw = Math.atan2(-p.climb.nx, -p.climb.nz);
    emit('grab');
  }
  function climb(dt, inp) {
    const c = p.climb, s = c.s;
    const tx = -c.nz, tz = c.nx; // along the wall
    const up = inp.move.y > 0.2 || inp.held.jump ? 1 : inp.move.y < -0.3 ? -1 : 0;
    const side = -inp.move.x; // camera faces the wall, so screen-right is -tangent
    p.pos.y += (up > 0 ? 4.6 : up < 0 ? -3.5 : 0) * dt;
    p.pos.x += tx * side * 2 * dt; p.pos.z += tz * side * 2 * dt;
    if (up !== 0 || side !== 0) p.anim += dt * 7;
    // stick to the face
    if (c.nx > 0) p.pos.x = s.maxx + R_BODY; else if (c.nx < 0) p.pos.x = s.minx - R_BODY;
    if (c.nz > 0) p.pos.z = s.maxz + R_BODY; else if (c.nz < 0) p.pos.z = s.minz - R_BODY;
    const offEdge = c.nx !== 0 ? (p.pos.z < s.minz - 0.2 || p.pos.z > s.maxz + 0.2) : (p.pos.x < s.minx - 0.2 || p.pos.x > s.maxx + 0.2);
    const g = col.groundHeight(p.pos.x, p.pos.z, p.pos.y);
    if (p.pos.y + 1.35 >= s.maxy) { // mantle onto the roof
      p.pos.x -= c.nx * 0.75; p.pos.z -= c.nz * 0.75; p.pos.y = s.maxy;
      p.mode = 'foot'; p.climb = null; p.onGround = true; p.vel.set(0, 0, 0); p.vaultT = 0; emit('mantle');
      return;
    }
    if (inp.pressed.jump && inp.move.y < 0.2) { // kick off the wall
      p.mode = 'foot'; p.climb = null; p.vel.set(c.nx * 5.5, 6.8, c.nz * 5.5); p.yaw = Math.atan2(c.nx, c.nz); p.flip = { kind: 'back', t: 0, dur: 0.6 }; p.airFlips = 1; emit('walljump'); return;
    }
    if (inp.pressed.roll || offEdge || (up < 0 && p.pos.y <= g.h + 0.02)) {
      p.mode = 'foot'; p.climb = null; p.vel.set(c.nx * 1.5, 0, c.nz * 1.5); p.onGround = p.pos.y <= g.h + 0.02; if (p.onGround) p.pos.y = g.h; return;
    }
  }

  function roll(dt) {
    p.rollT += dt;
    const k = Math.max(0, 1 - p.rollT / 0.5);
    p.vel.x *= 1 - dt * 1.5; p.vel.z *= 1 - dt * 1.5;
    physics(dt, { snap: 0.4 });
    if (p.rollT > 0.5) { p.mode = 'foot'; void k; }
  }
  function bail(dt) {
    p.bailT += dt;
    if (p.onGround) { const f = Math.max(0, 1 - dt * 5); p.vel.x *= f; p.vel.z *= f; }
    physics(dt, { snap: 0.4 });
    const b = p.boardFly;
    if (b) { b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.spin += dt * 9; if (b.y < p.lastGround) { b.y = p.lastGround; b.vy = Math.abs(b.vy) * 0.3; b.vx *= 0.6; b.vz *= 0.6; } }
    if (p.bailT > 1.15) { p.mode = 'foot'; p.boardFly = null; p.yaw = p.heading; emit('recover'); }
  }

  // ---------------- okada (stolen) ----------------
  // He rides it himself: throttle toward where you push, brake by pulling back, R to get off.
  // A hard crash throws him off; the bike stays where it fell and he can pick it up again.
  const bikeMesh = (() => {
    const g = new THREE.Group(), m = (c, mt = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: mt });
    const col0 = ['#8e1b1b', '#1a237e', '#212121', '#bf360c'][Math.floor(Math.random() * 4)];
    for (const z of [0.72, -0.7]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.11, 14), m('#111', 0)); w.rotation.z = Math.PI / 2; w.position.set(0, 0.33, z); g.add(w); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 1.2), m(col0)); body.position.set(0, 0.62, 0); g.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.8), m('#111', 0)); seat.position.set(0, 0.86, -0.2); g.add(seat);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), m('#999', 0.8)); bar.position.set(0, 1.05, 0.62); g.add(bar);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), m('#666', 0.8)); fork.position.set(0, 0.78, 0.66); fork.rotation.x = 0.3; g.add(fork);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#fff4d6', emissiveIntensity: 1.5 })); lamp.position.set(0, 0.95, 0.83); g.add(lamp);
    g.traverse(o => { if ((o as any).isMesh) o.castShadow = true; });
    g.visible = false; scene.add(g); return g;
  })();
  p.skills = {}; // taught by Coach Ayo: wire, wallrun2, leap2, roll, smoke2
  p.bike = null; // { x, z, yaw } where the bike stands when he's not on it
  p.bikeMesh = bikeMesh;
  // his SwiftDrop bicycle: a sturdy black roadster with a rack, given out with the job
  const cycleMesh = (() => {
    const g = new THREE.Group(), m = (c, mt = 0.4) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: mt });
    for (const z of [0.55, -0.55]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 20), m('#111', 0)); w.rotation.y = Math.PI / 2; w.position.set(0, 0.34, z); g.add(w); }
    const bar = (len, x, y, z, rx) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), m('#e65100')); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); };
    bar(0.75, 0, 0.62, 0.05, 1.2); bar(0.6, 0, 0.55, -0.25, -0.5); bar(0.55, 0, 0.6, 0.45, 0.25);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.26), m('#111', 0)); seat.position.set(0, 0.86, -0.3); g.add(seat);
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.03), m('#999', 0.8)); hb.position.set(0, 0.92, 0.5); g.add(hb);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.35), m('#333', 0.6)); rack.position.set(0, 0.7, -0.6); g.add(rack);
    g.traverse(o => { if ((o as any).isMesh) o.castShadow = true; }); g.visible = false; scene.add(g); return g;
  })();
  p.cycle = null; p.kind = 'okada'; // what he's riding: a stolen okada, or the company bicycle
  p.parkCycle = (x, z, yaw) => { p.cycle = { x, z, yaw }; cycleMesh.visible = true; cycleMesh.position.set(x, col.groundHeight(x, z, 2).h, z); cycleMesh.rotation.set(0, yaw, 0.25, 'YXZ'); };
  p.nearCycle = () => p.cycle && Math.hypot(p.cycle.x - p.pos.x, p.cycle.z - p.pos.z) < 2.2;
  p.mountCycle = () => { const y = p.cycle?.yaw ?? p.yaw; p.cycle = null; p.mountBike(y, 'bicycle'); };
  p.mountBike = (yaw, kind = 'okada') => { p.kind = kind; p.mode = 'bike'; p.heading = yaw ?? p.yaw; p.speed = Math.hypot(p.vel.x, p.vel.z) * 0.5; p.bike = null; p.lean = 0; p.dropHeld?.(); emit('bikeOn'); };
  p.parkBike = (x, z, yaw) => { p.bike = { x, z, yaw }; bikeMesh.visible = true; bikeMesh.position.set(x, col.groundHeight(x, z, 2).h, z); bikeMesh.rotation.set(0, yaw, 0.25, 'YXZ'); };
  p.nearBike = () => p.bike && Math.hypot(p.bike.x - p.pos.x, p.bike.z - p.pos.z) < 2.2;
  function getOffBike(crash = false) {
    const side = crash ? 0 : 0.9;
    if (p.kind === 'bicycle') p.parkCycle(p.pos.x, p.pos.z, p.heading); else p.parkBike(p.pos.x, p.pos.z, p.heading);
    p.pos.x -= Math.cos(p.heading) * side; p.pos.z += Math.sin(p.heading) * side;
    if (crash) { p.vel.set(Math.sin(p.heading) * p.speed * 0.5, 4, Math.cos(p.heading) * p.speed * 0.5); startBail(4); }
    else { p.mode = 'foot'; p.yaw = p.heading; p.vel.set(0, 0, 0); }
    emit('bikeOff', { crash });
  }
  function bike(dt, inp, camYaw) {
    const w = wishDir(inp, camYaw), mag = Math.min(1, w.length());
    let steer = 0;
    if (inp.pressed.board) { getOffBike(); return; }
    if (mag > 0.2) {
      const diff = wrap(Math.atan2(w.x, w.z) - p.heading);
      if (Math.abs(diff) > 2.4) p.speed -= 16 * dt; // pull back: brake
      else {
        const rate = 2.6 - 1.4 * Math.min(1, p.speed / 26);
        steer = clamp(diff, -rate * dt, rate * dt); p.heading += steer;
        const cyc = p.kind === 'bicycle', top = cyc ? (inp.held.sprint ? 9.5 : 7) : (inp.held.sprint ? 27 : 21), fwd = Math.cos(diff) * mag;
        if (fwd > 0.2 && p.speed < top) p.speed += (cyc ? 4.5 : p.speed < 8 ? 9 : 5) * fwd * dt;
      }
    }
    if (inp.held.jump) p.speed -= 10 * dt; // Space: brake hard
    p.speed -= (0.4 + p.speed * 0.01) * dt;
    const cond = world.roadCond?.(p.pos.x, p.pos.z);
    if (cond === 'flood') p.speed -= p.speed * 1.2 * dt; else if (cond === 'bad' && p.speed > 12) p.speed -= (p.speed - 12) * 1.5 * dt;
    p.speed = Math.max(0, p.speed);
    p.vel.x = Math.sin(p.heading) * p.speed; p.vel.z = Math.cos(p.heading) * p.speed;
    p.lean += (clamp(-steer / Math.max(dt, 1e-3) * 0.18 * Math.min(1, p.speed / 10), -0.5, 0.5) - p.lean) * Math.min(1, dt * 6);
    const before = p.speed;
    const { contacts, hit } = physics(dt, { onBoard: true });
    if (hit && hit.rel > 6) { vehicleHit(hit, false); if (p.mode !== 'bike') { if (p.kind === 'bicycle') p.parkCycle(p.pos.x, p.pos.z, p.heading); else p.parkBike(p.pos.x, p.pos.z, p.heading); emit('bikeOff', { crash: true }); } return; }
    if (contacts.length) {
      const c = contacts[0], into = -(Math.sin(p.heading) * c.nx + Math.cos(p.heading) * c.nz);
      if (into > 0.6 && before > 13) { getOffBike(true); return; }
      p.speed *= 1 - 0.6 * Math.max(0, into);
      p.heading = Math.atan2(p.vel.x, p.vel.z) || p.heading;
    }
  }

  // ---------------- riding the NEPA wires (a belt over the line, slide pole to pole) ----------------
  const wireAt = (sp, t) => [sp.a[0] + (sp.b[0] - sp.a[0]) * t, sp.a[1] + (sp.b[1] - sp.a[1]) * t - sp.sag * 4 * t * (1 - t), sp.a[2] + (sp.b[2] - sp.a[2]) * t];
  p.wireNear = () => {
    if (!p.skills.wire || !['foot', 'climb', 'wallrun'].includes(p.mode)) return null;
    let best = null, bd = 1.6;
    for (const sp of world.wireSpans || []) {
      const ax = sp.a[0], az = sp.a[2], dx = sp.b[0] - ax, dz = sp.b[2] - az, L2 = dx * dx + dz * dz;
      const t = Math.max(0.04, Math.min(0.96, ((p.pos.x - ax) * dx + (p.pos.z - az) * dz) / L2));
      const w = wireAt(sp, t), lat = Math.hypot(w[0] - p.pos.x, w[2] - p.pos.z), dy = w[1] - (p.pos.y + 2.0);
      if (lat < bd && Math.abs(dy) < 1.4) { bd = lat; best = { sp, t }; }
    }
    return best;
  };
  p.startZip = (hit) => {
    const sp = hit.sp, dx = sp.b[0] - sp.a[0], dz = sp.b[2] - sp.a[2], fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const dir = fx * dx + fz * dz >= 0 ? 1 : -1;
    p.mode = 'zip'; p.zip = { sp, t: hit.t, dir, speed: Math.max(7, Math.hypot(p.vel.x, p.vel.z)), yaw: Math.atan2(dx * dir, dz * dir) };
    p.onGround = false; p.riding = null; p.flip = null; emit('zip');
  };
  function zip(dt, inp) {
    const z = p.zip, sp = z.sp, L = Math.hypot(sp.b[0] - sp.a[0], sp.b[2] - sp.a[2]);
    z.speed = Math.min(17, z.speed + 6 * dt); z.t += z.dir * z.speed * dt / L;
    const end = z.dir > 0 ? z.t >= 1 : z.t <= 0;
    if (end) { // the next span along the same street, or let go
      const ep = z.dir > 0 ? sp.b : sp.a, fx = Math.sin(z.yaw), fz = Math.cos(z.yaw);
      const nx = (world.wireSpans || []).find(q => q !== sp && Math.hypot(q.a[0] - ep[0], q.a[2] - ep[2]) < 0.6 && ((q.b[0] - q.a[0]) * fx + (q.b[2] - q.a[2]) * fz) > 0);
      if (nx) { z.sp = nx; z.t = 0.02; z.dir = 1; }
      else { p.mode = 'foot'; p.zip = null; p.vel.set(Math.sin(z.yaw) * z.speed * 0.8, 3, Math.cos(z.yaw) * z.speed * 0.8); p.onGround = false; emit('zipEnd'); return; }
    }
    const w = wireAt(z.sp, Math.max(0, Math.min(1, z.t)));
    p.vel.set(Math.sin(z.yaw) * z.speed, 0, Math.cos(z.yaw) * z.speed);
    p.pos.set(w[0], w[1] - 2.05, w[2]); p.yaw = p.heading = z.yaw;
    if (inp.pressed.jump || inp.pressed.skitch) { p.mode = 'foot'; p.zip = null; p.vel.y = 4.5; p.onGround = false; p.flip = { kind: 'front', t: 0, dur: 0.6 }; emit('zipEnd'); }
  }

  // ---------------- main update ----------------
  p.update = (dt, inp, camYaw, time) => {
    p.events.length = 0;
    p.t += dt; p.grindCd = Math.max(0, (p.grindCd || 0) - dt); p.invuln = Math.max(0, p.invuln - dt); p.hurtT += dt; p.lastWallT += dt; p.vaultT += dt; p.staggerT += dt;
    p.punch.t += dt; p.punch.cd -= dt; p.guard = Math.max(0, p.guard - dt); p.shake = Math.max(0, p.shake - dt);
    p.rollBuf += dt; p.throwT += dt; p.flashT += dt; p.webT = (p.webT ?? 9) + dt;
    p.lastMove.x = inp.move.x; p.lastMove.y = inp.move.y;
    p.aiming = !!inp.held.aim && !!p.holding && ['foot', 'board'].includes(p.mode);
    p.aimYaw = camYaw;
    p.leapCd -= dt;
    if (p.hurtT > 6 && p.hp < p.cap() && !['down', 'crawl'].includes(p.mode)) p.hp = Math.min(p.cap(), p.hp + dt * 2.2 * Math.max(0.6, p.eff)); // even hungry, he heals (slowly)
    p.adrenT = Math.max(0, (p.adrenT || 0) - dt);
    if (inp.pressed.skitch && !p.cuffed && ['foot', 'climb', 'wallrun'].includes(p.mode) && (!p.onGround || p.pos.y > 3)) { const h = p.wireNear(); if (h) { p.climb = null; p.wallrun = null; p.startZip(h); inp.pressed.skitch = false; } }
    switch (p.mode) {
      case 'foot': foot(dt, inp, camYaw); break;
      case 'board': skate(dt, inp, camYaw); break;
      case 'grind': grind(dt, inp, camYaw); break;
      case 'skitch': skitch(dt, inp, camYaw); break;
      case 'climb': climb(dt, inp); break;
      case 'wallrun': wallrun(dt, inp); break;
      case 'act': actUpdate(dt); break;
      case 'ride': { const v = p.ride.v; p.pos.set(v.pos.x - v.fwd.x * (v.type === 'okada' ? 0.45 : 0), v.pos.y + (v.type === 'okada' ? 0.55 : 0.2), v.pos.z - v.fwd.z * (v.type === 'okada' ? 0.45 : 0)); p.vel.copy(v.vel); p.heading = p.yaw = v.yaw; p.onGround = true; break; }
      case 'bike': bike(dt, inp, camYaw); break;
      case 'zip': zip(dt, inp); break;
      case 'roll': roll(dt); break;
      case 'bail': bail(dt); break;
      case 'down': {
        if (adrenaline(dt, inp)) break;
        p.downT += dt; p.vel.x *= 0.9; p.vel.z *= 0.9; physics(dt);
        if (p.critical && p.downT > 1.4) { p.mode = 'crawl'; p.crawlT = 0; emit('crawl'); }
        else if (!p.critical && p.downT > 4.5) p.getUp(30);
        break;
      }
      case 'crawl': { // critical: drag himself away before they reach him
        if (adrenaline(dt, inp)) break;
        p.crawlT += dt;
        p.hp = Math.min(p.cap(), p.hp + dt * 1.2); // the body keeps fighting even here
        const w = wishDir(inp, camYaw), m = Math.min(1, w.length());
        if (m > 0.1) { p.yaw += clamp(wrap(Math.atan2(w.x, w.z) - p.yaw), -3 * dt, 3 * dt); p.anim += dt * 5; }
        p.vel.x = Math.sin(p.yaw) * 1.4 * m; p.vel.z = Math.cos(p.yaw) * 1.4 * m;
        physics(dt);
        break;
      }
      case 'getup': p.getupT += dt; p.vel.x *= 0.8; p.vel.z *= 0.8; physics(dt); if (p.getupT > 0.9) { p.mode = 'foot'; p.invuln = 1.6; } break;
    }
    pose(dt, time);
  };

  // ---------------- animation ----------------
  function pose(dt, time) {
    const hs = Math.hypot(p.vel.x, p.vel.z);
    let rate = 14, bodyYaw = p.yaw, lift = 0;
    const onBoard = p.mode === 'board' || p.mode === 'grind' || p.mode === 'skitch';
    switch (p.mode) {
      case 'foot':
        if (!p.onGround) {
          if (p.flip) { Pose.flip(rig, p.flip.kind, p.flip.t / p.flip.dur); rate = 30; }
          else if (p.vaultT < 0.35) Pose.vault(rig); else Pose.air(rig, p.vel.y);
        }
        else if (hs > 0.4) { p.anim += dt * (1.3 * hs + 1.5); if (p.hp < 35) Pose.limp(rig, p.anim, Math.min(1, hs / 9)); else Pose.run(rig, p.anim, Math.min(1, hs / 9)); rate = 18; }
        else Pose.idle(rig, time, p.guard > 0);
        if (p.charge != null) { const k = Math.min(1, p.charge / 0.58); rig.set('hipsY', HIP_H - 0.08 - 0.32 * k); rig.set('thLX', -0.6 - 0.9 * k); rig.set('knLX', 0.9 + 1.2 * k); rig.set('thRX', -0.5 - 0.9 * k); rig.set('knRX', 0.9 + 1.2 * k); rig.set('ftLX', -0.3 * k); rig.set('ftRX', -0.3 * k); rig.set('spineX', 0.3 + 0.3 * k); rig.set('shLX', 0.5 * k); rig.set('shRX', 0.5 * k); rate = 20; }
        break;
      case 'board': {
        if (p.prone) { // flat on his belly on the board, hands out to steer
          // face down, head forward, chest on the deck, hands gripping the front edges, feet up behind: ready to pop up
          rig.reset(); rig.set('hipsY', 0.3); rig.set('hipsRX', 1.45); rig.set('neckX', -0.95); rig.set('headX', -0.35);
          const pad = Math.sin(time * 9) * (p.speed < 7 ? 0.25 : 0);
          rig.set('shLX', -1.25 + pad); rig.set('shRX', -1.25 - pad); rig.set('shLZ', 0.35); rig.set('shRZ', -0.35); rig.set('elLX', -1.0); rig.set('elRX', -1.0);
          rig.set('thLX', 0.05); rig.set('thRX', 0.05); rig.set('thLZ', 0.12); rig.set('thRZ', -0.12); rig.set('knLX', 0.9); rig.set('knRX', 0.9);
          bodyYaw = p.heading; lift = 0.115; rate = 14; break;
        }
        const air = !p.onGround;
        const lean = clamp(wrap(p.heading - (p.prevHeading ?? p.heading)) / Math.max(dt, 1e-3) * 0.25, -1, 1);
        Pose.skate(rig, time, { crouch: air ? 0.6 : 0.25 + Math.min(0.35, p.speed / 40), push: p.pushing ? 1 : 0, lean, air });
        if (p.trick && p.trick.t < p.trick.dur) { Pose.trickAir(rig, p.trick.t / p.trick.dur); rate = 24; }
        bodyYaw = p.heading - Math.PI / 2 + (p.pushing ? 0.55 : 0);
        lift = 0.115;
        break;
      }
      case 'grind': Pose.grind(rig, time); bodyYaw = p.heading - Math.PI / 2; lift = 0.115; break;
      case 'skitch': if (p.noBoard) { Pose.climb(rig, 0.4); bodyYaw = p.heading; lift = 0; } else { Pose.skitch(rig, time); bodyYaw = p.heading - 0.3; lift = 0.115; } break;
      case 'zip': rig.reset(); rig.set('hipsY', HIP_H); rig.set('shLX', -3.05); rig.set('shRX', -3.05); rig.set('elLX', -0.15); rig.set('elRX', -0.15); rig.set('thLX', -0.9); rig.set('thRX', -0.7); rig.set('knLX', 1.3); rig.set('knRX', 1.1); rig.set('spineX', -0.15 + Math.sin(time * 8) * 0.04); bodyYaw = p.zip ? p.zip.yaw : p.yaw; rate = 16; break;
      case 'climb': Pose.climb(rig, p.anim); bodyYaw = p.yaw; break;
      case 'wallrun': Pose.wallrun(rig, p.anim, p.wallrun?.side || 1); bodyYaw = p.yaw; rate = 18; break;
      case 'act': Pose.strike(rig, p.act.kind, p.act.t / p.act.dur); bodyYaw = p.yaw; rate = 34; break;
      case 'ride': Pose.idle(rig, time, false); rig.set('hipsY', HIP_H - 0.35); rig.set('thLX', -1.4); rig.set('thRX', -1.4); rig.set('knLX', 1.3); rig.set('knRX', 1.3); rig.set('thLZ', 0.35); rig.set('thRZ', -0.35); rig.set('shLX', -0.8); rig.set('shRX', -0.8); rig.set('elLX', -0.6); rig.set('elRX', -0.6); bodyYaw = p.yaw; break;
      case 'bike': Pose.idle(rig, time, false); rig.set('hipsY', HIP_H - 0.35); rig.set('thLX', -1.3); rig.set('thRX', -1.3); rig.set('knLX', 1.2); rig.set('knRX', 1.2); rig.set('thLZ', 0.3); rig.set('thRZ', -0.3); rig.set('spineX', 0.35); rig.set('shLX', -1.2); rig.set('shRX', -1.2); rig.set('elLX', -0.3); rig.set('elRX', -0.3); rig.set('hipsRZ', p.lean || 0); bodyYaw = p.heading; lift = 0.5; rate = 20;
        if (p.kind === 'bicycle') { p.pedal = (p.pedal || 0) + dt * Math.min(12, p.speed * 1.1); const a = Math.sin(p.pedal); rig.set('thLX', -1.2 + a * 0.45); rig.set('thRX', -1.2 - a * 0.45); rig.set('knLX', 1.0 - a * 0.4); rig.set('knRX', 1.0 + a * 0.4); rig.set('thLZ', 0.08); rig.set('thRZ', -0.08); lift = 0.42; }
        break;
      case 'roll': Pose.roll(rig, Math.min(1, p.rollT / 0.5)); rate = 40; break;
      case 'bail': Pose.tumble(rig, p.bailT); rate = 10; bodyYaw = p.heading; break;
      case 'down': Pose.down(rig); rate = 8; break;
      case 'crawl': Pose.crawl(rig, p.anim); rate = 10; break;
      case 'getup': Pose.getup(rig, p.getupT / 0.9); rate = 12; break;
    }
    if (p.punch.t < 0.3 && (p.mode === 'foot' || p.mode === 'board')) { Pose.punch(rig, p.punch.side, p.punch.t / 0.28, p.punch.kick); rate = 30; }
    if (p.staggerT < 0.4 && p.mode === 'foot') Pose.stagger(rig, p.staggerT / 0.4);
    if (p.holding && ['foot', 'board'].includes(p.mode)) { rig.set('shRX', p.aiming ? -2.6 : -2.1); rig.set('elRX', -1.3); rig.set('shRZ', -0.2); if (p.aiming) { bodyYaw = p.yaw; rig.set('chestY', -0.4); } }
    if (p.hp < p.cap() * 0.6 && p.mode === 'foot' && p.onGround && hs < 0.4 && p.guard <= 0) { rig.set('spineX', 0.25); rig.set('shLX', -0.5); rig.set('elLX', -1.4); } // holding his side
    if (p.throwT < 0.35) { Pose.throw(rig, p.throwT / 0.35); rate = 30; }
    if (p.flashT < 0.5) Pose.flash(rig, p.flashT / 0.5);
    if (rig.stripMat) rig.stripMat.emissiveIntensity = p.flashT < 0.6 ? 6 * (1 - p.flashT / 0.6) : 0.06;
    p.prevHeading = p.heading;
    if (p.cuffed && ['foot', 'roll', 'bail'].includes(p.mode)) { rig.set('shLX', 0.55); rig.set('shRX', 0.55); rig.set('shLZ', -0.3); rig.set('shRZ', 0.3); rig.set('elLX', -1.0); rig.set('elRX', -1.0); } // wrists cuffed behind his back
    rig.update(dt, rate);
    rig.root.position.set(p.pos.x, p.pos.y + lift, p.pos.z);
    if (p.prone && p.mode === 'board') { rig.root.position.x -= Math.sin(p.heading) * 0.35; rig.root.position.z -= Math.cos(p.heading) * 0.35; } // chest over the deck
    const cur = rig.root.rotation.y;
    rig.root.rotation.y = cur + wrap(bodyYaw - cur) * Math.min(1, dt * (onBoard ? 14 : 18));
    const bt = p.mode === 'board' && p.trick?.body && p.trick.t < p.trick.dur ? p.trick : null;
    if (bt) {
      const k = Math.min(1, bt.t / bt.dur), e = k * k * (3 - 2 * k);
      rig.root.rotation.order = 'YXZ';
      rig.root.rotation.y = p.heading - Math.PI / 2 + bt.bspin * Math.PI * 2 * e;
      rig.root.rotation.z = -bt.bflip * Math.PI * 2 * e;
      _c.set(0, 0.85, 0); _c2.copy(_c).applyEuler(rig.root.rotation); rig.root.position.x += _c.x - _c2.x; rig.root.position.y += _c.y - _c2.y; rig.root.position.z += _c.z - _c2.z;
    } else if (rig.root.rotation.z) rig.root.rotation.z = 0;
    // flicker while invulnerable after a hit
    rig.root.visible = p.mode === 'ride' ? !!p.ride?.visible : !(p.invuln > 0 && p.hurtT < 1 && Math.floor(p.t * 20) % 2 === 0);
    const onCycle = p.mode === 'bike' && p.kind === 'bicycle', onOkada = p.mode === 'bike' && !onCycle;
    if (onOkada) { bikeMesh.visible = true; bikeMesh.position.set(p.pos.x, p.pos.y, p.pos.z); bikeMesh.rotation.set(0, p.heading, -(p.lean || 0), 'YXZ'); }
    else if (!p.bike) bikeMesh.visible = false;
    if (onCycle) { cycleMesh.visible = true; cycleMesh.position.set(p.pos.x, p.pos.y, p.pos.z); cycleMesh.rotation.set(0, p.heading, -(p.lean || 0), 'YXZ'); }
    else if (!p.cycle) cycleMesh.visible = false;
    // board
    const flying = p.mode === 'bail' && p.boardFly;
    board.visible = onBoard || !!flying;
    if (rig.backBoard) rig.backBoard.visible = !board.visible && !p.boardLost && !p.noBoard;
    if (onBoard) {
      board.position.set(p.pos.x, p.pos.y, p.pos.z);
      let ry = 0, rz = 0;
      if (p.trick && p.trick.t < p.trick.dur) { const k = Math.min(1, p.trick.t / p.trick.dur); ry = p.trick.spins * Math.PI * k; rz = p.trick.flips * Math.PI * 2 * k; }
      board.rotation.set(!p.onGround && p.mode === 'board' ? -Math.max(-0.35, Math.min(0.35, p.vel.y * 0.06)) : 0, p.heading + ry, rz, 'YXZ');
      if (bt) { board.quaternion.copy(rig.root.quaternion).multiply(_qy); board.position.copy(rig.root.position); }
      if (rz) board.position.y += 0.18 * Math.sin(Math.min(1, p.trick.t / p.trick.dur) * Math.PI);
    } else if (flying) {
      const b = p.boardFly; board.position.set(b.x, b.y, b.z); board.rotation.set(b.spin, b.spin * 0.7, b.spin * 0.3);
    }
  }

  void HIP_H;
  return p;
}
