// Bolaji's home: one room in a face-me-I-face-you compound in Aguda. Mama sleeps behind the curtain,
// Tobi on the mat. The black suit hides in the water drum. A kerosene lantern is the only light
// (NEPA, as usual). It sits far outside the city so the fog hides the streets.
import * as THREE from 'three';
import { PrimBatch } from '../core/geo.js';
import { Rig, Pose, HIP_H } from '../player/rig.js';

export const ROOM = { x: 1000, z: 1000, w: 7.4, d: 5.4, h: 3.0 };

export function buildRoom(scene, world) {
  const S = world.collision.solids, X = ROOM.x, Z = ROOM.z, hw = ROOM.w / 2, hd = ROOM.d / 2, H = ROOM.h;
  const B = new PrimBatch(), wall = (x0, z0, x1, z1, y0 = 0, y1 = H, c = '#b7c9a8') => { B.box(x1 - x0, y1 - y0, z1 - z0, { p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, c); S.add(x0, y0, z0, x1, y1, z1, 'roomwall'); };
  const tt = 0.2;
  // floor, ceiling, walls (two-tone paint), door on the south wall, window on the north wall
  B.box(ROOM.w + 0.4, 0.1, ROOM.d + 0.4, { p: [X, -0.05, Z] }, '#6d6258');
  B.box(3.4, 0.01, 2.4, { p: [X - 0.9, 0.005, Z + 0.1] }, '#8d3b2e'); // worn linoleum
  B.box(ROOM.w + 0.4, 0.1, ROOM.d + 0.4, { p: [X, H + 0.05, Z] }, '#d8d2c4');
  S.add(X - hw - 1, -1, Z - hd - 1, X + hw + 1, 0, Z + hd + 1, 'roomfloor');
  const dx0 = X - 1.0, dx1 = X - 0.1; // door gap
  wall(X - hw - tt, Z - hd - tt, X + hw + tt, Z - hd);               // north
  wall(X - hw - tt, Z + hd, dx0, Z + hd + tt); wall(dx1, Z + hd, X + hw + tt, Z + hd + tt); wall(dx0, Z + hd, dx1, Z + hd + tt, 2.1, H); // south + lintel
  wall(X - hw - tt, Z - hd, X - hw, Z + hd); wall(X + hw, Z - hd, X + hw + tt, Z + hd);
  for (const [x0, z0, x1, z1] of [[X - hw, Z - hd, X + hw, Z - hd + 0.02], [X - hw, Z + hd - 0.02, X + hw, Z + hd], [X - hw, Z - hd, X - hw + 0.02, Z + hd], [X + hw - 0.02, Z - hd, X + hw, Z + hd]])
    B.box(x1 - x0, 1.2, z1 - z0, { p: [(x0 + x1) / 2, 0.6, (z0 + z1) / 2] }, '#6f8f73'); // darker lower half
  B.box(0.9, 2.1, 0.06, { p: [(dx0 + dx1) / 2 + 0.42, 1.05, Z + hd + 0.08], ry: -0.9 }, '#5d4037'); // door, ajar
  // window with burglar-proof bars
  B.box(1.2, 0.9, 0.04, { p: [X - 1.2, 1.6, Z - hd + 0.01] }, '#0b1020');
  for (let k = -2; k <= 2; k++) B.box(0.03, 0.9, 0.05, { p: [X - 1.2 + k * 0.24, 1.6, Z - hd + 0.04] }, '#2b2b2b');
  B.box(1.2, 0.03, 0.05, { p: [X - 1.2, 1.6, Z - hd + 0.04] }, '#2b2b2b');
  // Mama's side: bed behind a curtain
  B.box(0.03, 2.0, 2.6, { p: [X + 0.95, 1.15, Z - 0.7] }, '#8e3b6d');
  B.box(1.3, 0.45, 2.0, { p: [X + 2.2, 0.22, Z - 0.9] }, '#5d4037'); B.box(1.25, 0.18, 1.95, { p: [X + 2.2, 0.54, Z - 0.9] }, '#e0d6c2');
  S.add(X + 1.55, 0, Z - 1.9, X + 2.85, 0.6, Z + 0.1, 'bed');
  // Bolaji's corner: mats, the water drum, stove and pot, plastic chair, stool with the lantern
  B.box(1.9, 0.04, 0.9, { p: [X - 1.9, 0.02, Z - 1.4] }, '#c8a86e'); // his mat
  B.box(1.7, 0.04, 0.9, { p: [X - 1.9, 0.02, Z - 0.2] }, '#b89760'); // Tobi's mat
  B.cyl(0.38, 0.36, 0.95, { p: [X - 2.6, 0.48, Z + 1.7] }, '#1e5aa8', 14); B.cyl(0.39, 0.39, 0.05, { p: [X - 2.6, 0.97, Z + 1.7] }, '#154a8a', 14);
  S.add(X - 3.0, 0, Z + 1.3, X - 2.2, 1.0, Z + 2.1, 'drum');
  B.box(0.9, 0.7, 0.55, { p: [X + 0.3, 0.35, Z - 1.95] }, '#6d4c41'); B.cyl(0.2, 0.22, 0.12, { p: [X + 0.3, 0.76, Z - 1.95] }, '#37474f', 10);
  B.cyl(0.19, 0.17, 0.22, { p: [X + 0.3, 0.93, Z - 1.95] }, '#9e9e9e', 12); B.cyl(0.2, 0.2, 0.03, { p: [X + 0.3, 1.05, Z - 1.95] }, '#757575', 12);
  S.add(X - 0.15, 0, Z - 2.25, X + 0.75, 0.75, Z - 1.65, 'stove');
  B.box(0.45, 0.04, 0.45, { p: [X + 0.6, 0.45, Z + 1.0] }, '#e53935'); B.box(0.45, 0.5, 0.04, { p: [X + 0.6, 0.72, Z + 1.21] }, '#e53935');
  for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) B.box(0.03, 0.45, 0.03, { p: [X + 0.6 + a, 0.22, Z + 1.0 + b] }, '#c62828');
  B.box(0.35, 0.45, 0.35, { p: [X + 1.4, 0.22, Z + 1.3] }, '#795548');
  B.box(0.5, 0.35, 0.3, { p: [X + 2.4, 0.95, Z + 1.95] }, '#212121'); B.box(0.44, 0.28, 0.02, { p: [X + 2.4, 0.97, Z + 1.79] }, '#0d1117'); // old TV on a stool
  B.box(0.3, 0.6, 0.3, { p: [X + 2.4, 0.3, Z + 1.95] }, '#6d4c41');
  B.box(0.34, 0.46, 0.02, { p: [X - 0.4, 1.8, Z - hd + 0.03] }, '#fafafa'); // calendar
  B.box(0.36, 0.26, 0.02, { p: [X + 1.9, 1.7, Z + hd - 0.03] }, '#8d6e63'); // framed photo
  B.box(3.8, 0.01, 0.01, { p: [X - 1.0, 2.2, Z + 0.9] }, '#555'); // clothesline
  for (const [x, c] of [[-2.4, '#1565c0'], [-1.6, '#f9a825'], [-0.8, '#ffffff']]) B.box(0.4, 0.5, 0.02, { p: [X + x, 1.93, Z + 0.9] }, c);
  B.box(0.34, 0.18, 0.1, { p: [X - 1.9, 1.2, Z - hd + 0.1] }, '#263238'); B.box(0.12, 0.12, 0.02, { p: [X - 1.97, 1.2, Z - hd + 0.16] }, '#90a4ae'); B.box(0.01, 0.3, 0.01, { p: [X - 1.78, 1.44, Z - hd + 0.1] }, '#9e9e9e'); // the radio on the sill
  B.box(0.6, 0.04, 0.2, { p: [X - 1.9, 1.09, Z - hd + 0.1] }, '#6d4c41');
  const mesh = new THREE.Mesh(B.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  mesh.receiveShadow = true; mesh.castShadow = true; scene.add(mesh);
  // the lantern
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.7, 0.35).multiplyScalar(5), toneMapped: false }));
  lantern.position.set(X + 1.4, 0.55, Z + 1.3); scene.add(lantern);
  const light = new THREE.PointLight(0xffa24a, 0, 9, 1.4); light.position.set(X + 1.4, 0.9, Z + 1.3); scene.add(light);

  // Mama and Tobi asleep
  const sleeper = (outfit, x, z, yaw, y = 0, scale = 1) => {
    const r = new Rig(outfit); r.root.position.set(x, y, z); r.root.rotation.y = yaw; r.root.scale.setScalar(scale);
    Pose.down(r); r.set('hipsRZ', 0); r.set('shLZ', 0.2); r.set('shRZ', -0.2); r.set('thLZ', 0.05); r.snap(); r.update(0.016); scene.add(r.root);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 1.25), new THREE.MeshStandardMaterial({ color: outfit.top, roughness: 0.9 }));
    blanket.position.set(0, 0.28, 0.45); r.root.add(blanket);
    return r;
  };
  const mama = sleeper({ skin: '#4a2e20', top: '#7b1fa2', bottom: '#4a148c', sock: '#3e2723', sole: '#2b2b2b', cap: '#6a1b9a', sheen: '#664477' }, X + 2.2, Z - 1.7, 0, 0.62);
  const tobi = sleeper({ skin: '#5b3a26', top: '#1565c0', bottom: '#263238', sock: '#5b3a26', sole: '#2b2b2b', shorts: true, sheen: '#445577' }, X - 2.6, Z - 0.2, Math.PI / 2, 0.04, 0.72);

  world.room = {
    x: X, z: Z, light, mama, tobi,
    spawn: { x: X - 1.3, z: Z - 0.6, yaw: Math.PI / 2 },
    door: { x: (dx0 + dx1) / 2, z: Z + hd - 0.5 },
    drum: { x: X - 2.3, z: Z + 1.25 }, pot: { x: X + 0.3, z: Z - 1.45 }, mat: { x: X - 1.4, z: Z - 1.4 },
    chair: { x: X + 0.6, z: Z + 0.55 }, radio: { x: X - 1.9, z: Z - hd + 0.55 }, tobiSpot: { x: X - 1.6, z: Z + 0.15 }, mamaSpot: { x: X + 1.4, z: Z - 0.9 },
    corners: [[X - hw + 0.35, Z - hd + 0.35], [X + hw - 0.35, Z - hd + 0.35], [X - hw + 0.35, Z + hd - 0.35], [X + hw - 0.35, Z + hd - 0.35]].map(([x, z]) => ({ x, y: H - 0.25, z })),
    region: { x0: X - hw + 0.35, x1: X + hw - 0.35, z0: Z - hd + 0.35, z1: Z + hd - 0.35 },
    wake(t) { // Mama half wakes: sits up for a moment
      const r = mama; Pose.idle(r, 0, false); r.set('hipsY', 0.5); r.set('thLX', -1.5); r.set('thRX', -1.5); r.set('spineX', 0.2); r.set('headY', -0.8); r.update(Math.min(1, t));
    },
    sleep() { const r = mama; Pose.down(r); r.set('hipsRZ', 0); r.update(0.2); },
    flicker(time) { light.intensity = 5.5 + Math.sin(time * 13) * 0.5 + Math.sin(time * 31) * 0.3; },
  };
  void HIP_H;
  return world.room;
}
