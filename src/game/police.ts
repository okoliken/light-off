// Police checkpoints: Lagos "stop and search" posts where officers wave down danfos, kekes and okadas
// and collect "roger" (a bribe) before letting them go. Traffic queues at the line (traffic.blockers).
// At night Bolaji can knock the collector down or snatch the roger money from behind, but touching
// the police brings heat. Officers at a post chase him when there is heat, then walk back to the post.
import * as THREE from 'three';
import { Gunman } from './enemies.ts';
import { Civilian } from './npcs.ts';
import { textSign } from '../core/textures.ts';
import { HALF, CELL, ROAD, WALK } from '../world/layout.ts';

const pick = a => a[Math.floor(Math.random() * a.length)];
const FARE = { danfo: 200, keke: 100, okada: 100, car: 500, tanker: 1000, brt: 0 };
const LINES = ['Oya, roger!', 'Driver, where your particulars?', 'Wetin you carry for back?', 'Park well! Park well!', 'Show me your papers!', 'Clear my road, you dey hear?'];

export function createCheckpoints(game) {
  const { scene, world, traffic, hud, player } = game;
  const col = world.collision;
  // two posts: one on the road beside Ojuelegba, one on the way to the stadium
  const DEFS = [
    { name: 'Ojuelegba checkpoint', x: -HALF + 4 * CELL, z: -HALF + 1.5 * CELL, axis: 'z' },
    { name: 'Adeniran Ogunsanya checkpoint', x: -HALF + 2.5 * CELL, z: -HALF + 4 * CELL, axis: 'x' },
    { name: 'Bode Thomas checkpoint', x: -HALF + 1 * CELL, z: -HALF + 4.5 * CELL, axis: 'z' },
    { name: 'Aguda Road checkpoint', x: -HALF + 2 * CELL, z: -HALF + 0.5 * CELL, axis: 'z' },
    { name: 'Herbert Macaulay checkpoint', x: -HALF + 8 * CELL, z: -HALF + 4.5 * CELL, axis: 'z' },
    { name: 'Sabo checkpoint', x: -HALF + 7.5 * CELL, z: -HALF + 1 * CELL, axis: 'x' },
    { name: 'Agege Motor Road checkpoint', x: -HALF - 3 * CELL, z: -HALF + 2.5 * CELL, axis: 'z' },
    { name: 'Idi-Araba checkpoint', x: -HALF - 1.5 * CELL, z: -HALF + 5 * CELL, axis: 'x' },
  ];
  const drumMat = new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.7 }), plankMat = new THREE.MeshStandardMaterial({ color: '#6d4c41', roughness: 0.95 });
  const nailMat = new THREE.MeshStandardMaterial({ color: '#9e9e9e', metalness: 0.8, roughness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffcc80', emissive: '#ffb74d', emissiveIntensity: 2 });
  const cps = DEFS.map(d => {
    const alongX = d.axis === 'x';
    const ax = alongX ? 1 : 0, az = alongX ? 0 : 1; // road direction
    const sx = az, sz = -ax;                       // across the road
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); scene.add(g);
    for (const s of [-1, 1]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 12), drumMat); drum.position.set(sx * s * 5.4, 0.45, sz * s * 5.4); drum.castShadow = true; g.add(drum);
      col.solids.add(d.x + sx * s * 5.4 - 0.35, 0, d.z + sz * s * 5.4 - 0.35, d.x + sx * s * 5.4 + 0.35, 0.9, d.z + sz * s * 5.4 + 0.35, 'drum');
    }
    // plank studded with nails across the middle (they pull it aside to let a vehicle through)
    const plank = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.3 : 4.2, 0.08, alongX ? 4.2 : 0.3), plankMat); plank.position.set(0, 0.06, 0); g.add(plank);
    for (let k = -4; k <= 4; k++) { const n = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), nailMat); n.position.set(alongX ? 0 : k * 0.45, 0.14, alongX ? k * 0.45 : 0); g.add(n); }
    // a table and a kerosene lamp on the kerb
    const tx = sx * 7.3, tz = sz * 7.3;
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.7), plankMat); table.position.set(tx, 0.95, tz); g.add(table);
    for (const [lx, lz] of <any[]>[[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), plankMat); leg.position.set(tx + lx, 0.47, tz + lz); g.add(leg); }
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 8), lampMat); lamp.position.set(tx + 0.3, 1.1, tz); g.add(lamp);
    const t = textSign('POLICE · STOP AND SEARCH', '#0d47a1', '#fff', 768, 128);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.43), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
    sign.position.set(tx, 1.5, tz); sign.rotation.y = alongX ? 0 : Math.PI / 2; g.add(sign);
    const cp: any = { ...d, group: g, x: d.x, z: d.z, active: true, hold: 2.6, cash: 0, stopped: null, officers: [], down: 0, table: { x: d.x + tx, z: d.z + tz } };
    cp.onPaid = (v) => {
      const amt = FARE[v.type] ?? 200; if (!amt) return;
      cp.cash += amt; cp.lastPay = game.time;
      const c = cp.officers.find(o => o.collector && o.alive);
      if (c && Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 30) game.say(c, pick(['Na ₦' + amt + ' be this?! Oya go.', 'Go! Next!', 'Better. Move!']), 'Police', 30);
      if (player.riding === v) hud.notice('CHECKPOINT', `The conductor squeezed ₦${amt} into the officer's hand. "Roger." Nobody on the bus says a word.`, 'white');
    };
    // two officers stand in the road, the collector on the driver's side
    for (const s of [-1, 1]) {
      const px = d.x + sx * s * 2.2, pz = d.z + sz * s * 2.2, yaw = Math.atan2(ax * -s, az * -s);
      const o = new Gunman(scene, world, { x: px, z: pz, y: 0, yaw, role: 'police', post: { x: px, z: pz, yaw, cp } });
      o.collector = s < 0; o.cp = cp; cp.officers.push(o); game.gunmen.push(o);
    }
    const extra = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let k = 0; k < extra; k++) {
      const px = d.x + tx + ax * (k - 1) * 1.5 + sx * 0.9, pz = d.z + tz + az * (k - 1) * 1.5 + sz * 0.9, yaw = Math.atan2(-sx, -sz) + (Math.random() - 0.5) * 1.2;
      const o = new Gunman(scene, world, { x: px, z: pz, y: 0, yaw, role: 'police', post: { x: px, z: pz, yaw, cp } });
      o.cp = cp; cp.officers.push(o); game.gunmen.push(o);
    }
    traffic.blockers.push(cp);
    world.mapRects?.push({ x0: d.x - 3, z0: d.z - 3, x1: d.x + 3, z1: d.z + 3, color: '#1e88e5' });
    return cp;
  });

  const K: any = { list: cps };
  let barkT = 0, attacked = false;
  K.update = (dt) => {
    barkT -= dt; K.updateRaids(dt);
    for (const cp of cps) {
      const officers = cp.officers.filter(o => !o.removed);
      const standing = officers.filter(o => o.alive && o.state === 'post').length;
      cp.active = standing > 0 && game.heat === 0; // no roger while they're chasing someone
      if (!cp.active) cp.stopped = null;
      const near = Math.hypot(cp.x - player.pos.x, cp.z - player.pos.z) < 30;
      if (near && cp.stopped && barkT <= 0) { barkT = 5; const o = officers.find(q => q.collector && q.alive); if (o) game.say(o, pick(LINES), 'Police', 30); }
      // hitting an officer at the post is assaulting the police
      if (!attacked && officers.some(o => ['stunned', 'down'].includes(o.state))) { attacked = true; game.addHeat(1, 'You attacked the police at the checkpoint!'); }
    }
    if (game.heat === 0) attacked = false;
  };
  // F near the collector (from behind, or while he's stunned): take the roger money
  K.option = () => {
    for (const cp of cps) for (const o of cp.officers) {
      if (!o.collector || !o.alive || cp.cash <= 0 || Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) > 2.2) continue;
      if (game.life.phase === 'day' || !game.life.suit) return { kind: 'none', text: 'Not now. They\'d see your face. <b>Come back at night, in the suit.</b>' };
      const tx = player.pos.x - o.pos.x, tz = player.pos.z - o.pos.z, tl = Math.hypot(tx, tz) || 1;
      const unseen = (Math.sin(o.yaw) * tx + Math.cos(o.yaw) * tz) / tl < 0.1 || ['stunned', 'blinded'].includes(o.state) || game.power < 0.5;
      return unseen ? { kind: 'roger', cp, o, text: `<span class="key">F</span>Snatch the roger money (₦${cp.cash.toLocaleString()})` } : { kind: 'none', text: 'He\'s facing you. <b>Get behind him</b>, blind him, or wait for the lights to go.' };
    }
    return null;
  };
  // ---- raids: a van pulls up and they go through young men's phones looking for "Yahoo boys" ----
  const RAID_COP = ['Oya! Everybody face wall!', 'Bring your phone. Unlock am. Now!', 'Na you be Yahoo boy? Where your laptop?', 'Why your hair be like this? Enter motor!', 'Transfer am now or we go carry you go station.', 'Who get iPhone for here?'];
  const RAID_BOY = ['Officer, I be student! Na school laptop!', 'Abeg, na my brother send me this money!', 'Oga, I no do anything, I dey wait for bus!', 'Na barbing I dey do, see my clipper!', 'Officer, make we settle am here abeg.'];
  const BOY_FITS = [['#212121', '#1565c0', '#f5f5f5'], ['#fafafa', '#263238', '#fafafa'], ['#c62828', '#212121', '#fdd835'], ['#6a1b9a', '#37474f', '#212121']];
  K.raid = null; let raidCd = 70 + Math.random() * 60;
  const startRaid = () => {
    const pp = player.pos;
    const spots = world.spots.filter(sp => { const d = Math.hypot(sp.x - pp.x, sp.z - pp.z); return d > 35 && d < 110 && !(sp.bi === 1 && sp.bj === 1); });
    const sp = spots[Math.floor(Math.random() * spots.length)]; if (!sp) return;
    const nx = sp.nx, nz = sp.nz, rx = -nz, rz = nx, parts: any[] = [], boys: any[] = [], cops: any[] = [];
    // the van, parked half on the kerb
    const van = new THREE.Group(), m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.9, 4.8), m('#0d1b3d')); body.position.y = 1.25; van.add(body);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.3), new THREE.MeshStandardMaterial({ color: '#3d7bff', emissive: '#3d7bff', emissiveIntensity: 2 })); bar.position.set(0, 2.28, 1.2); van.add(bar);
    for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), m('#111')); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.4, wz); van.add(w); }
    const t = textSign('POLICE · SPECIAL SQUAD', '#0d1b3d', '#ffffff', 768, 110);
    for (const sd of [-1, 1]) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.46), new THREE.MeshBasicMaterial({ map: t })); sg.position.set(sd * 1.01, 1.5, 0); sg.rotation.y = sd * Math.PI / 2; van.add(sg); }
    const vx = sp.x + nx * (WALK * 0.45 + 3.2), vz = sp.z + nz * (WALK * 0.45 + 3.2);
    van.position.set(vx, 0.1, vz); van.rotation.y = Math.atan2(rx, rz); scene.add(van); parts.push(van);
    // three young men against the wall, hands up; three officers in front of them
    for (let k = 0; k < 3; k++) {
      const f = BOY_FITS[(k + Math.floor(Math.random() * 4)) % 4];
      const bx = sp.x - nx * 1.6 + rx * (k - 1) * 1.3, bz = sp.z - nz * 1.6 + rz * (k - 1) * 1.3;
      const b = new Civilian(scene, world, { x: bx, z: bz, yaw: Math.atan2(nx, nz), outfit: { skin: ['#4a2e1f', '#5b3a26', '#3e2418'][k], top: f[0], bottom: f[1], sock: '#212121', sole: f[2], cap: null, sheen: '#556070' } });
      b.name = 'Young man'; b.mood = 'scared'; game.civilians.push(b); boys.push(b);
      const ox = sp.x + nx * 0.9 + rx * (k - 1) * 1.5, oz = sp.z + nz * 0.9 + rz * (k - 1) * 1.5, yaw = Math.atan2(-nx, -nz);
      const o = new Gunman(scene, world, { x: ox, z: oz, y: 0, yaw, role: 'police', post: { x: ox, z: oz, yaw, cp: { stopped: null } } });
      o.collector = false; o.raidCop = true; game.gunmen.push(o); cops.push(o);
    }
    K.raid = { x: sp.x, z: sp.z, t: 0, parts, boys, cops, area: world.areaAt(sp.x, sp.z), lineT: 2, told: false };
  };
  const endRaid = () => {
    const R = K.raid; if (!R) return;
    for (const p of R.parts) scene.remove(p);
    for (const b of R.boys) if (!b.gone) b.runHome(b.pos.x + (Math.random() - 0.5) * 60, b.pos.z + (Math.random() - 0.5) * 60);
    for (const o of R.cops) if (!o.removed && o.state === 'post') o.remove?.();
    K.raid = null; raidCd = 160 + Math.random() * 120;
  };
  K.updateRaids = (dt) => {
    if (!K.raid) { for (const o of game.gunmen) if (o.raidCop && !o.removed && o.state === 'post') o.remove(); raidCd -= dt; if (raidCd <= 0 && !game.life.inside && !game.inMall && game.heat === 0) { startRaid(); if (!K.raid) raidCd = 30; } return; }
    const R = K.raid; R.t += dt; R.lineT -= dt;
    const d = Math.hypot(R.x - player.pos.x, R.z - player.pos.z);
    if (!R.told && d < 120) { R.told = true; hud.toast(`<b>Police raid</b> in ${R.area}. They're checking young men's phones for "Yahoo".`, 'blue'); }
    if (R.lineT <= 0 && d < 35) {
      R.lineT = 3.2;
      const cop = R.cops.find(o => o.alive && !o.removed), boy = R.boys.find(b => !b.gone);
      if (cop && boy) { if (Math.random() < 0.55) hud.say('Police', pick(RAID_COP), 3); else hud.say('Young man', pick(RAID_BOY), 3); }
    }
    if (R.t > 75 || (R.t > 40 && d > 140)) endRaid();
  };
  K.raidMarker = (M, MM, dstr) => { const R = K.raid; if (!R) return; MM.push({ x: R.x, z: R.z, color: '#3d7bff' }); if (Math.hypot(R.x - player.pos.x, R.z - player.pos.z) < 90) M.push({ x: R.x, y: 3.2, z: R.z, kind: 'cop', label: `POLICE RAID · ${dstr(R.x, R.z)}` }); };
  K.take = (cp) => { const amt = cp.cash; cp.cash = 0; return amt; };
  K.markers = (M, MM, dstr) => {
    K.raidMarker(M, MM, dstr);
    for (const cp of cps) {
      MM.push({ x: cp.x, z: cp.z, color: '#1e88e5' });
      if (Math.hypot(cp.x - player.pos.x, cp.z - player.pos.z) < 70) M.push({ x: cp.x, y: 3.2, z: cp.z, kind: 'cop', label: `CHECKPOINT${cp.cash && game.life.phase !== 'day' ? ' · ₦' + cp.cash.toLocaleString() + ' ROGER' : ''} · ${dstr(cp.x, cp.z)}`, edge: false });
    }
  };
  // slowly re-fill during the day and night (the post never really closes)
  K.reset = () => { for (const cp of cps) { cp.cash = 0; for (const o of cp.officers) if (!o.removed) { o.hp = o.maxHp; o.state = 'post'; o.pos.set(o.post.x, 0, o.post.z); } } };
  return K;
}
