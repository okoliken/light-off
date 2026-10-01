// Public transport. Bus stops around Surulere; pick where you're going and how: danfo (cheap, packed),
// keke (cheapest, slow) or okada (fast, you ride pillion). Pay the fare, ride along in real time
// (hold Space to hurry the driver), get dropped at the stop. Press F on the way to jump off early.
import * as THREE from 'three';
import { textSign } from '../core/textures.js';
import { WALK } from '../world/layout.js';

const MODES = {
  danfo: { label: 'Danfo', base: 150, per100: 40, lines: ['Oya enter! Enter with your change o!', 'Shift small, make another person sit!', 'Driver, owa o! Somebody dey drop!', 'Who never pay? I no get change for ₦1000 o!'] },
  keke: { label: 'Keke', base: 100, per100: 30, lines: ['Hold your bag well.', 'This road bad o, hold tight.', 'Na drop you pay? We dey go.'] },
  okada: { label: 'Okada', base: 300, per100: 60, lines: ['Hold me well o!', 'No fear, I sabi road!', 'Police dey front? We go pass back road.'] },
};
const STOP_AREAS = [['Aguda', 'Aguda'], ['Ojuelegba', 'Ojuelegba'], ['Adelabu', 'Adelabu'], ['Stadium', 'National Stadium'],
  ['Yaba', 'Yaba'], ['Sabo (for UNILAG)', 'Sabo, Yaba'], ['Mushin', 'Mushin'], ['Idi-Araba (LUTH)', 'Idi-Araba']];

export function createTransport(game) {
  const { scene, world, hud, audio, player, traffic } = game;
  const L = game.life;
  const stops = [];
  const near = (a, b, r) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r * r;
  const spots = world.spots.filter(s => !(s.bi === 1 && s.bj === 1) && s.bi !== 4);
  const addStop = (name, s) => {
    // shelter on the sidewalk edge, facing the road
    const x = s.x + s.nx * 1.2, z = s.z + s.nz * 1.2, yaw = Math.atan2(s.nx, s.nz);
    const g = new THREE.Group(); g.position.set(x, 0.15, z); g.rotation.y = yaw;
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.3 });
    for (const dx of [-1.3, 1.3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mat('#9e9e9e')); p.position.set(dx, 1.2, -0.4); g.add(p); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1.4), mat('#fbc02d')); roof.position.set(0, 2.45, -0.2); g.add(roof);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.4), mat('#5d4037')); bench.position.set(0, 0.5, -0.6); g.add(bench);
    const t = textSign(`BUS STOP · ${name.toUpperCase()}`, '#f9a825', '#111', 768, 110);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.4), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.3 }));
    sg.position.set(0, 2.72, 0.51); g.add(sg);
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    scene.add(g);
    const road = { x: s.x + s.nx * (WALK * 0.45 + 4.2), z: s.z + s.nz * (WALK * 0.45 + 4.2) }; // lane in front of the stop
    stops.push({ name, x, z, nx: s.nx, nz: s.nz, road, yaw });
  };
  // one stop per area, plus the market and the motor park
  for (const [name, area] of STOP_AREAS) {
    const cands = spots.filter(s => world.areaAt(s.x, s.z) === area && stops.every(q => !near(q, s, 60)) && world.vendors.every(v => !near(v, s, 10)) && game.sites.every(q => !near(q.spot, s, 20)));
    if (!cands.length) continue;
    const c = cands.reduce((a, b) => (Math.abs(a.x) + Math.abs(a.z) < Math.abs(b.x) + Math.abs(b.z) ? a : b));
    addStop(name, c);
  }
  { const m = world.marketSpot; addStop('Adelabu Market', { x: m.x + 11, z: m.z - 1.2, nx: 0, nz: -1 }); }
  { const c = spots.filter(s => stops.every(q => !near(q, s, 40))).sort((a, b) => ((a.x - world.motorparkSpot.x) ** 2 + (a.z - world.motorparkSpot.z) ** 2) - ((b.x - world.motorparkSpot.x) ** 2 + (b.z - world.motorparkSpot.z) ** 2))[0]; if (c) addStop('Ojuelegba Motor Park', c); }
  { const c = spots.filter(s => Math.abs(s.z) < 12 && stops.every(q => !near(q, s, 50)))[0]; if (c) addStop('Bode Thomas', c); }
  world.busStops = stops;

  const T = { stops, ride: null };
  T.stopNear = (p) => stops.find(s => near(s, p, 2.8));
  T.fare = (from, to, mode) => { const d = Math.hypot(to.x - from.x, to.z - from.z), m = MODES[mode]; return Math.round((m.base + m.per100 * d / 100) / 50) * 50; };
  T.options = (from) => stops.filter(s => s !== from).map(s => ({ stop: s, dist: Math.round(Math.hypot(s.x - from.x, s.z - from.z)), fares: Object.fromEntries(Object.keys(MODES).map(k => [k, T.fare(from, s, k)])) }));

  T.board = (from, to, mode) => {
    const fare = T.fare(from, to, mode);
    if (L.wallet < fare) { hud.toast(`You don't have ₦${fare} for the ${MODES[mode].label.toLowerCase()}.`, 'red'); return false; }
    const v = traffic.spawnRide(mode, from, to);
    if (!v) { hud.toast('No driver is going that way right now.', 'red'); return false; }
    L.wallet -= fare;
    T.ride = { v, to, mode, t: 0, lineT: 1.5 };
    player.startRide(v, mode === 'okada');
    hud.say(mode === 'okada' ? 'Okada man' : mode === 'keke' ? 'Keke driver' : 'Conductor', mode === 'danfo' ? `${to.name}! ${to.name}! Enter, enter!` : `${to.name}? Oya climb.`, 2.5);
    audio.horn?.(player.pos);
    return true;
  };
  T.getOff = (atStop) => {
    const r = T.ride; if (!r) return;
    const v = r.v, s = atStop ? r.to : null;
    const x = s ? s.x - s.nx * 0.8 : v.pos.x + v.rt.x * 2.5, z = s ? s.z - s.nz * 0.8 : v.pos.z + v.rt.z * 2.5;
    player.endRide(x, z);
    v.ai.done = true; v.kind = 'traffic'; setTimeout(() => traffic.remove(v), 20000); // it drives off into normal traffic
    if (s) { hud.notice(s.name.toUpperCase(), world.areaAt(s.x, s.z), 'white', 1.8); game.addRespect(10); }
    T.ride = null;
  };
  T.update = (dt, input) => {
    const r = T.ride; if (!r) return;
    r.t += dt; r.lineT -= dt;
    if (r.lineT <= 0) { r.lineT = 7 + Math.random() * 6; hud.say(r.mode === 'okada' ? 'Okada man' : r.mode === 'keke' ? 'Keke driver' : 'Conductor', MODES[r.mode].lines[Math.floor(Math.random() * MODES[r.mode].lines.length)], 3); }
    if (r.v.ai.arrived) T.getOff(true);
    else if (input.pressed.act) T.getOff(false);
  };
  T.hurry = (input) => !!(T.ride && input.held.jump);
  return T;
}
