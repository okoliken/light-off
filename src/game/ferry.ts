// LagFerry: a jetty on the mainland's north shore and one at Marina on Lagos Island. Buy a ticket at
// the terminal, sit in the boat with everybody else, and cross the lagoon past Makoko instead of
// fighting Third Mainland traffic. Hold Space to tell the driver to hurry.
import * as THREE from 'three';
import { textSign } from '../core/textures.ts';
import { Rig, Pose } from '../player/rig.ts';
import { HALF, ROAD, WALK, CAMPUS } from '../world/layout.ts';

const FARE = 500;
const LINES = ['Wear your life jacket! I no go talk am two times!', 'Sit down for middle, make the boat balance.', 'Water calm today. God dey.', 'Who never pay? Ticket! Ticket!'];

export function createFerry(game) {
  const { scene, world, hud, player, audio } = game;
  const m = (c, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, ...o });
  const mainZ = -HALF - ROAD / 2 - WALK / 2;
  const J: any[] = [
    { id: 'main', name: 'Ebute-Metta Jetty', x: -150, z: mainZ, dock: { x: -150, z: -304 }, face: Math.PI },
    { id: 'island', name: 'Marina Jetty', x: -80, z: CAMPUS.z1 - 3, dock: { x: -80, z: CAMPUS.z1 + 14 }, face: 0 },
  ];
  // the crossing, mainland to Island: wide of Makoko, then down the lagoon
  const ROUTE = [[-150, -304], [-235, -440], [-250, -760], [-180, -1040], [-80, CAMPUS.z1 + 14]];

  // terminals: a shelter, benches, a ticket booth and the LagFerry sign; a pier into the water
  for (const j of J) {
    const g = new THREE.Group(); g.position.set(j.x, 0.15, j.z); g.rotation.y = j.face; scene.add(g);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 3), m('#1565c0')); roof.position.set(0, 2.8, 0); g.add(roof);
    for (const dx of [-3.2, 3.2]) for (const dz of [-1.3, 1.3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 6), m('#9e9e9e', { metalness: 0.6 })); p.position.set(dx, 1.4, dz); g.add(p); }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 0.5), m('#6d4c41')); bench.position.set(-0.5, 0.5, -1); g.add(bench);
    const booth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.2), m('#fdd835')); booth.position.set(2.6, 1.1, -0.6); g.add(booth);
    const t = textSign(`LAGFERRY · ${j.name.toUpperCase()}`, '#0d47a1', '#ffeb3b', 1024, 128);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 0.82), new THREE.MeshBasicMaterial({ map: t })); sg.position.set(0, 3.35, 1.55); g.add(sg);
    const sg2 = sg.clone(); sg2.rotation.y = Math.PI; sg2.position.z = -1.55; g.add(sg2);
    // the pier at the dock
    const pier = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 16), m('#5d4037')); pier.position.set(j.dock.x, 0.05, j.dock.z + (j.id === 'main' ? 6 : -6)); scene.add(pier);
    world.collision.solids.add(j.x - 2.6, 0, j.z - 1.2, j.x + 2.6, 0.55, j.z - 0.8, 'bench');
  }

  // the boat: a covered fibreglass ferry with passengers already sitting
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 11), m('#f5f5f5')); hull.position.y = 0.1; boat.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 4), m('#f5f5f5')); nose.rotation.x = Math.PI / 2; nose.rotation.y = Math.PI / 4; nose.scale.set(1, 1, 0.5); nose.position.set(0, 0.1, 6.6); boat.add(nose);
  const band = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.25, 11.05), m('#1565c0')); band.position.y = 0.35; boat.add(band);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 7), m('#fdd835')); canopy.position.set(0, 2.3, -0.5); boat.add(canopy);
  for (const dx of [-1.4, 1.4]) for (const dz of [-3.8, 2.8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), m('#9e9e9e')); p.position.set(dx, 1.45, dz); boat.add(p); }
  for (let r = 0; r < 4; r++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.45), m('#1565c0')); s.position.set(0, 0.75, -3 + r * 1.6); boat.add(s); }
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.6), m('#212121')); motor.position.set(0, 0.6, -5.8); boat.add(motor);
  const FITS = [['#c62828', '#212121'], ['#6a1b9a', '#4a148c'], ['#2e7d32', '#263238'], ['#f9a825', '#3e2723'], ['#00838f', '#212121']];
  FITS.forEach(([top, bottom], i) => {
    const r = new Rig({ skin: ['#4a2e1f', '#5b3a26', '#3e2418', '#6d4530', '#5b3a26'][i], top, bottom, sock: '#3e2723', sole: '#2b2b2b', cap: i === 1 ? '#6a1b9a' : null, sheen: '#556070' });
    Pose.idle(r, i, false); r.set('hipsY', 0.62); r.set('thLX', -1.5); r.set('thRX', -1.5); r.set('knLX', 1.5); r.set('knRX', 1.5); r.snap(); r.update(0.016);
    r.root.position.set(i % 2 ? 0.7 : -0.7, 0.2, -3 + Math.floor(i / 2) * 1.6 + (i === 4 ? 1.6 : 0)); r.root.rotation.y = 0; r.root.scale.setScalar(0.95); boat.add(r.root);
  });
  // a life-jacketed driver at the back
  const drv = new Rig({ skin: '#3e2418', top: '#ff6d00', bottom: '#212121', sock: '#111', sole: '#111', cap: null, sheen: '#333' });
  Pose.idle(drv, 0, false); drv.snap(); drv.update(0.016); drv.root.position.set(0.5, 0.6, -5.2); boat.add(drv.root);
  boat.visible = false; scene.add(boat);

  // the ride itself looks like any other vehicle to the player code
  const v: any = { type: 'ferry', pos: new THREE.Vector3(), fwd: new THREE.Vector3(0, 0, 1), rt: new THREE.Vector3(-1, 0, 0), vel: new THREE.Vector3(), yaw: 0, yawRate: 0, ai: {} };
  const F: any = { jetties: J, ride: null };
  const pathLen = (pts) => { let L = 0; for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return L; };
  const at = (pts, s) => { for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (s <= L) { const t = s / L; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1])]; } s -= L; } const e = pts[pts.length - 1], p = pts[pts.length - 2]; return [e[0], e[1], Math.atan2(e[0] - p[0], e[1] - p[1])]; };

  F.near = (p) => J.find(j => Math.hypot(j.x - p.x, j.z - p.z) < 3.2);
  F.other = (j) => J.find(q => q !== j);
  F.option = () => { if (F.ride || player.cuffed) return null; const j = F.near(player.pos); if (!j) return null; const to = F.other(j); return { kind: 'ferry', j, text: `<span class="key">F</span>Ferry to <b>${to.name}</b> · ₦${FARE} <small style="opacity:.7">(about a minute)</small>` }; };
  F.board = (j) => {
    if (game.heat > 0) { hud.say('LagFerry staff', 'Police dey behind you? No. Find another way.', 3); return; }
    if (game.life.wallet < FARE) { hud.say('LagFerry staff', `Ticket na ₦${FARE}. You no get am? Comot for line.`, 3); return; }
    game.life.wallet -= FARE; audio.pickup();
    const to = F.other(j), pts = j.id === 'main' ? ROUTE : ROUTE.slice().reverse();
    F.ride = { pts, L: pathLen(pts), s: 0, from: j, to, lineT: 2 };
    if (player.mode === 'board') player.mode = 'foot';
    boat.visible = true; F.place();
    player.startRide(v, true);
    hud.notice('LAGFERRY', `${j.name} → ${to.name}`, 'blue', 2.5);
    game.chatter?.startRide('Boat driver');
    setTimeout(() => F.ride && hud.say('Boat driver', LINES[0], 3), 600);
  };
  F.place = () => {
    const r = F.ride; const [x, z, yaw] = at(r.pts, r.s);
    const bob = Math.sin(game.time * 1.7) * 0.06;
    v.pos.set(x, -0.15 + bob, z); v.yaw = yaw; v.fwd.set(Math.sin(yaw), 0, Math.cos(yaw)); v.rt.set(-Math.cos(yaw), 0, Math.sin(yaw));
    boat.position.copy(v.pos); boat.rotation.set(Math.sin(game.time * 1.3) * 0.02, yaw, Math.sin(game.time * 1.1) * 0.03, 'YXZ');
  };
  F.update = (dt, input) => {
    const r = F.ride; if (!r) return;
    const sp = (r.s < 25 || r.L - r.s < 30 ? 7 : 17) * (input.held.jump ? 1.8 : 1);
    r.s = Math.min(r.L, r.s + sp * dt); v.vel.set(v.fwd.x * sp, 0, v.fwd.z * sp);
    F.place();
    if (Math.random() < dt * 4) game.fx?.burst(v.pos.x - v.fwd.x * 6, 0, v.pos.z - v.fwd.z * 6, 0xe3f2fd, 3, 2); // wake
    if (r.s >= r.L) {
      const t = r.to; F.ride = null; boat.visible = false; game.chatter?.stopRide();
      player.endRide(t.x + (t.id === 'main' ? 0 : 0), t.z + (t.id === 'main' ? 0.6 : -0.6));
      hud.notice(t.name.toUpperCase(), t.id === 'island' ? 'Lagos Island. Idumota is up the road.' : 'Back on the mainland.', 'white', 2.4);
    }
  };
  return F;
}
