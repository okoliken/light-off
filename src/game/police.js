// Police checkpoints: Lagos "stop and search" posts where officers wave down danfos, kekes and okadas
// and collect "roger" (a bribe) before letting them go. Traffic queues at the line (traffic.blockers).
// At night Bolaji can knock the collector down or snatch the roger money from behind, but touching
// the police brings heat. Officers at a post chase him when there is heat, then walk back to the post.
import * as THREE from 'three';
import { Gunman } from './enemies.js';
import { textSign } from '../core/textures.js';
import { HALF, CELL, ROAD } from '../world/layout.js';

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
    for (const [lx, lz] of [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), plankMat); leg.position.set(tx + lx, 0.47, tz + lz); g.add(leg); }
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 8), lampMat); lamp.position.set(tx + 0.3, 1.1, tz); g.add(lamp);
    const t = textSign('POLICE · STOP AND SEARCH', '#0d47a1', '#fff', 768, 128);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.43), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
    sign.position.set(tx, 1.5, tz); sign.rotation.y = alongX ? 0 : Math.PI / 2; g.add(sign);
    const cp = { ...d, group: g, x: d.x, z: d.z, active: true, hold: 2.6, cash: 0, stopped: null, officers: [], down: 0, table: { x: d.x + tx, z: d.z + tz } };
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
    traffic.blockers.push(cp);
    world.mapRects?.push({ x0: d.x - 3, z0: d.z - 3, x1: d.x + 3, z1: d.z + 3, color: '#1e88e5' });
    return cp;
  });

  const K = { list: cps };
  let barkT = 0, attacked = false;
  K.update = (dt) => {
    barkT -= dt;
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
  K.take = (cp) => { const amt = cp.cash; cp.cash = 0; return amt; };
  K.markers = (M, MM, dstr) => {
    for (const cp of cps) {
      MM.push({ x: cp.x, z: cp.z, color: '#1e88e5' });
      if (Math.hypot(cp.x - player.pos.x, cp.z - player.pos.z) < 70) M.push({ x: cp.x, y: 3.2, z: cp.z, kind: 'cop', label: `CHECKPOINT${cp.cash && game.life.phase !== 'day' ? ' · ₦' + cp.cash.toLocaleString() + ' ROGER' : ''} · ${dstr(cp.x, cp.z)}`, edge: false });
    }
  };
  // slowly re-fill during the day and night (the post never really closes)
  K.reset = () => { for (const cp of cps) { cp.cash = 0; for (const o of cp.officers) if (!o.removed) { o.hp = o.maxHp; o.state = 'post'; o.pos.set(o.post.x, 0, o.post.z); } } };
  return K;
}
