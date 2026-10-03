// Inside the mall: one hall shared by Tejuosho and E-Centre (you walk in through either door).
// Polished tiles, glass shopfronts with sellers behind the counters, a food court, a fountain, an
// escalator up to a balcony, AC hum and bright ceiling panels. Like Bolaji's room it sits far outside
// the city, so the fog hides everything else.
import * as THREE from 'three';
import { PrimBatch } from '../core/geo.ts';
import { textSign } from '../core/textures.ts';
import { Rig, Pose } from '../player/rig.ts';

export const MALL = { x: 1100, z: 1000, w: 44, d: 30, h: 7 };

// what each shop sells (ids match game.shopItems) and who's behind the counter
export const MALL_SHOPS = [
  { id: 'electric', name: 'Bright Future Electricals', sign: 'BRIGHT FUTURE ELECTRICALS', bg: '#0d47a1', fg: '#ffeb3b', items: ['torch', 'nails'], seller: 'Mr Emeka', line: 'Torch with battery inside, Chinese but strong. Take am.' },
  { id: 'pharmacy', name: 'GoodHealth Pharmacy', sign: 'GOODHEALTH PHARMACY', bg: '#1b5e20', fg: '#ffffff', items: ['meds'], seller: 'Pharmacist', line: 'Plaster and paracetamol. Who beat you like this?' },
  { id: 'provisions', name: 'Mama Chi Provisions', sign: 'MAMA CHI PROVISIONS', bg: '#b71c1c', fg: '#ffffff', items: ['drink', 'pins', 'pepper', 'smoke'], seller: 'Mama Chi', line: 'My pikin, wetin you want? Energy drink? Hair pin?' },
  { id: 'food', name: 'Mr Bigs Food Court', sign: 'JOLLOF · CHICKEN · SMALL CHOPS', bg: '#e65100', fg: '#ffffff', items: ['jollof', 'chops'], seller: 'Server', line: 'Jollof and chicken? Na the best in Yaba.' },
];

export function buildMall(scene, world) {
  const S = world.collision.solids, X = MALL.x, Z = MALL.z, hw = MALL.w / 2, hd = MALL.d / 2, H = MALL.h;
  const B = new PrimBatch(), E = new PrimBatch(), P = new PrimBatch(); // P: ceiling light panels // E: glowing bits (lights, signs' frames)
  const solid = (x0, z0, x1, z1, y1 = H, tag = 'mallwall') => S.add(x0, 0, z0, x1, y1, z1, tag);
  const wall = (x0, z0, x1, z1, c = '#e8e2d4') => { B.box(x1 - x0, H, z1 - z0, { p: [(x0 + x1) / 2, H / 2, (z0 + z1) / 2] }, c); solid(x0, z0, x1, z1); };
  const t = 0.3;

  // polished floor tiles (two tones) and the ceiling
  for (let i = 0; i < MALL.w / 2; i++) for (let j = 0; j < MALL.d / 2; j++) B.box(2, 0.1, 2, { p: [X - hw + 1 + i * 2, -0.05, Z - hd + 1 + j * 2] }, (i + j) % 2 ? '#d9d4ca' : '#bfb8ab');
  S.add(X - hw - 1, -1, Z - hd - 1, X + hw + 1, 0, Z + hd + 1, 'mallfloor');
  B.box(MALL.w, 0.2, MALL.d, { p: [X, H + 0.1, Z] }, '#f2efe8');
  // ceiling light panels and a long skylight strip
  for (let i = -3; i <= 3; i++) for (const zz of [-hd + 9, 0, hd - 6]) P.box(3, 0.05, 1, { p: [X + i * 6, H - 0.02, Z + zz] }, '#fffbe8');
  // walls; the entrance is a glass door in the middle of the south wall
  wall(X - hw - t, Z - hd - t, X + hw + t, Z - hd);
  wall(X - hw - t, Z - hd, X - hw, Z + hd); wall(X + hw, Z - hd, X + hw + t, Z + hd);
  wall(X - hw - t, Z + hd, X - 2.2, Z + hd + t); wall(X + 2.2, Z + hd, X + hw + t, Z + hd + t);
  B.box(4.4, H - 3, t, { p: [X, 3 + (H - 3) / 2, Z + hd + t / 2] }, '#e8e2d4'); // over the door
  E.box(4.2, 2.9, 0.05, { p: [X, 1.45, Z + hd + 0.25] }, '#4f7f9a'); // glass doors
  B.box(0.1, 2.9, 0.12, { p: [X, 1.45, Z + hd + 0.2] }, '#90a4ae');
  // the shops along the north wall: glass fronts, counters, shelves, a sign each
  const shops: any[] = [];
  const sw = MALL.w / MALL_SHOPS.length;
  MALL_SHOPS.forEach((sh, k) => {
    const cx = X - hw + sw * (k + 0.5), fz = Z - hd + 7;
    // side walls between shops
    if (k > 0) wall(X - hw + sw * k - 0.15, Z - hd, X - hw + sw * k + 0.15, fz);
    // shelves of goods on the back wall
    for (let r = 0; r < 3; r++) {
      B.box(sw - 2, 0.06, 0.5, { p: [cx, 0.8 + r * 0.7, Z - hd + 0.6] }, '#8d6e63');
      for (let g = 0; g < 12; g++) B.box(0.35, 0.4, 0.3, { p: [cx - sw / 2 + 1.4 + g * ((sw - 2.8) / 11), 1.05 + r * 0.7, Z - hd + 0.6] }, ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fafafa', '#8e24aa'][(g + r + k) % 6]);
    }
    // the counter
    B.box(sw - 4, 1.05, 0.9, { p: [cx, 0.52, fz - 2.2] }, sh.id === 'food' ? '#5d4037' : '#37474f'); B.box(sw - 4, 0.06, 1.0, { p: [cx, 1.07, fz - 2.2] }, '#cfd8dc');
    S.add(cx - (sw - 4) / 2, 0, fz - 2.7, cx + (sw - 4) / 2, 1.1, fz - 1.7, 'counter');
    if (sh.id === 'food') for (let p = 0; p < 4; p++) { B.cyl(0.3, 0.3, 0.25, { p: [cx - 2.4 + p * 1.6, 1.22, fz - 2.2] }, '#b0bec5', 12); B.cyl(0.26, 0.26, 0.05, { p: [cx - 2.4 + p * 1.6, 1.33, fz - 2.2] }, ['#e64a19', '#ffb300', '#6d4c41', '#c62828'][p], 12); }
    // glass front with an opening
    E.box((sw - 5) / 2, 2.8, 0.06, { p: [cx - sw / 2 + (sw - 5) / 4 + 0.2, 1.4, fz] }, '#3c6478');
    E.box((sw - 5) / 2, 2.8, 0.06, { p: [cx + sw / 2 - (sw - 5) / 4 - 0.2, 1.4, fz] }, '#3c6478');
    solid(cx - sw / 2, fz - 0.05, cx - 2.3, fz + 0.05, 2.8); solid(cx + 2.3, fz - 0.05, cx + sw / 2, fz + 0.05, 2.8);
    B.box(sw, H - 3.2, 0.25, { p: [cx, 3.2 + (H - 3.2) / 2, fz] }, '#e8e2d4');
    // sign above the shopfront
    const tex = textSign(sh.sign, sh.bg, sh.fg, 1024, 128);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(sw - 1.5, (sw - 1.5) / 8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    sg.position.set(cx, 3.7, fz + 0.14); scene.add(sg);
    // the seller
    const r = new Rig({ skin: ['#4a2e1f', '#5b3a26', '#6d4530', '#3e2418'][k], top: ['#1565c0', '#fafafa', '#ad1457', '#e65100'][k], bottom: '#263238', sock: '#3e2723', sole: '#2b2b2b', cap: k === 3 ? '#fafafa' : null, sheen: '#556070' });
    r.root.position.set(cx, 0, fz - 3.3); r.root.rotation.y = 0; Pose.idle(r, k, false); r.snap(); r.update(0.016); scene.add(r.root);
    shops.push({ ...sh, x: cx, z: fz - 1.1, seller: r });
  });

  // the middle of the hall: a fountain, planters, benches
  B.cyl(2.6, 2.8, 0.6, { p: [X, 0.3, Z + 3] }, '#cfc8bb', 24); E.cyl(2.3, 2.3, 0.05, { p: [X, 0.58, Z + 3] }, '#4fc3f7', 24); B.cyl(0.25, 0.35, 1.6, { p: [X, 1.1, Z + 3] }, '#e0dacb', 12);
  S.add(X - 2.6, 0, Z + 0.4, X + 2.6, 0.6, Z + 5.6, 'fountain');
  for (const dx of [-12, 12]) {
    B.box(3, 0.7, 1.4, { p: [X + dx, 0.35, Z + 3] }, '#6d4c41'); for (let q = 0; q < 5; q++) B.sphere(0.45, { p: [X + dx - 1.1 + q * 0.55, 1.0, Z + 3] }, '#2e7d32');
    S.add(X + dx - 1.5, 0, Z + 2.3, X + dx + 1.5, 0.8, Z + 3.7, 'planter');
    B.box(2.4, 0.45, 0.6, { p: [X + dx, 0.22, Z + 6] }, '#455a64'); S.add(X + dx - 1.2, 0, Z + 5.7, X + dx + 1.2, 0.45, Z + 6.3, 'bench');
  }
  // escalator up to a balcony (the upper floor is closed: "CINEMA · OPENING SOON")
  const ex = X + hw - 4;
  for (let s = 0; s < 14; s++) B.box(1.4, 0.25, 0.45, { p: [ex, 0.12 + s * 0.28, Z + hd - 4 - s * 0.45] }, s % 2 ? '#9e9e9e' : '#bdbdbd');
  for (const dx of [-0.85, 0.85]) B.box(0.15, 1.1, 7, { p: [ex + dx, 2.4, Z + hd - 7.1], r: [0.56, 0, 0] }, '#263238');
  S.add(ex - 1, 0, Z + hd - 10.5, ex + 1, 4, Z + hd - 3.5, 'escalator');
  B.box(MALL.w, 0.3, 4, { p: [X, 4.2, Z + hd - 2] }, '#e8e2d4'); E.box(MALL.w, 0.9, 0.05, { p: [X, 4.8, Z + hd - 4] }, '#7aa7bf');
  const ct = textSign('CINEMA · UPSTAIRS · OPENING SOON', '#111', '#ff4081', 1024, 128);
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.25), new THREE.MeshBasicMaterial({ map: ct, toneMapped: false })); cs.position.set(X - 8, 5.6, Z + hd - 4.05); cs.rotation.y = Math.PI; scene.add(cs);
  // ad banners and an EXIT sign
  const ad = (txt, bg, fg, x, y, z, ry) => { const tx = textSign(txt, bg, fg, 1024, 160); const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.95), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); };
  ad('DATA 1GB ₦350 · RECHARGE NOW', '#fdd835', '#111', X - hw + 0.2, 3.4, Z + 4, Math.PI / 2);
  ad('INDOMIE · EAT RIGHT', '#c62828', '#fff', X + hw - 0.2, 3.4, Z - 2, -Math.PI / 2);
  ad('EXIT', '#1b5e20', '#ffffff', X, 3.4, Z + hd - 0.2, Math.PI);

  // shoppers and a security guard at the door
  const people: any[] = [];
  const person = (o, x, z, yaw) => { const r = new Rig(o); r.root.position.set(x, 0, z); r.root.rotation.y = yaw; Pose.idle(r, x, false); r.snap(); r.update(0.016); scene.add(r.root); people.push(r); return r; };
  person({ skin: '#3e2418', top: '#212121', bottom: '#212121', sock: '#111', sole: '#111', cap: '#212121', sheen: '#333' }, X + 3.2, Z + hd - 1.6, Math.PI); // security
  const looks = [['#6a1b9a', '#4a148c'], ['#00838f', '#263238'], ['#f9a825', '#3e2723'], ['#c62828', '#1a237e'], ['#2e7d32', '#212121']];
  const spots = [[-9, -2, 0.4], [6, -1, -0.6], [-4, 8, 2.6], [10, 9, 3.4], [-15, -3, 0.2]];
  spots.forEach(([dx, dz, yaw], i) => person({ skin: ['#4a2e1f', '#5b3a26', '#6d4530', '#3e2418', '#5b3a26'][i], top: looks[i][0], bottom: looks[i][1], sock: '#3e2723', sole: '#2b2b2b', cap: null, sheen: '#556070' }, X + dx, Z + dz, yaw));

  const mesh = new THREE.Mesh(B.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 }));
  mesh.receiveShadow = true; scene.add(mesh);
  const glow = new THREE.Mesh(E.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.06, transparent: true, opacity: 0.55 }));
  scene.add(glow);
  scene.add(new THREE.Mesh(P.build(), new THREE.MeshBasicMaterial({ color: 0xfffbe8 })));
  const light = new THREE.PointLight(0xfff4e0, 0, 60, 1.1); light.position.set(X, H - 1, Z); scene.add(light);

  world.mall = {
    x: X, z: Z, shops, light, people,
    spawn: { x: X, z: Z + hd - 5, yaw: Math.PI },
    door: { x: X, z: Z + hd - 0.7 },
    region: { x0: X - hw + 0.4, x1: X + hw - 0.4, z0: Z - hd + 0.4, z1: Z + hd - 0.4 },
  };
  return world.mall;
}
