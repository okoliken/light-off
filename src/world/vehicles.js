// Vehicle models built from primitives: yellow danfo buses, okadas, keke NAPEPs, tokunbo cars,
// a fuel tanker and the police Hilux. Local frame: +z is forward, y up, origin on the ground.
// Each template = { body geometry (vertex colours), light geometry, spec }.
import * as THREE from 'three';
import { PrimBatch } from '../core/geo.js';

export const SPECS = {
  danfo:  { len: 4.9, w: 2.0, h: 2.15, speed: [10, 13], grip: 7, skitch: true, platform: true, label: 'Danfo' },
  okada:  { len: 2.0, w: 0.8, h: 1.5, speed: [13, 16.5], grip: 16, skitch: true, platform: false, label: 'Okada' },
  keke:   { len: 2.7, w: 1.4, h: 1.85, speed: [7.5, 9], grip: 4, skitch: true, platform: true, label: 'Keke' },
  car:    { len: 4.4, w: 1.8, h: 1.45, speed: [11, 14], grip: 8, skitch: true, platform: true, label: 'Car' },
  tanker: { len: 9.5, w: 2.5, h: 3.3, speed: [9, 11.5], grip: 9, skitch: true, platform: true, label: 'Tanker' },
  police: { len: 4.8, w: 1.95, h: 1.85, speed: [12, 18], grip: 0, skitch: false, platform: true, label: 'Police' },
  brt:    { len: 11.5, w: 2.55, h: 3.2, speed: [8, 10.5], grip: 6, skitch: true, platform: true, label: 'BRT bus' },
  getaway:{ len: 4.5, w: 1.85, h: 1.45, speed: [17, 19], grip: 9, skitch: true, platform: true, label: 'Getaway car' },
};

const SKIN = ['#3b2418', '#4a2e20', '#5a3825', '#2f1c12'];
const SHIRT = ['#c62828', '#1565c0', '#f9a825', '#2e7d32', '#6a1b9a', '#eeeeee', '#ff7043', '#37474f'];

function wheels(b, len, w, r, zs, width = 0.26) {
  for (const z of zs) for (const s of [-1, 1]) {
    b.cyl(r, r, width, { p: [s * (w / 2 - width / 2 + 0.02), r, z], r: [0, 0, Math.PI / 2] }, '#141414', 12);
    b.cyl(r * 0.55, r * 0.55, width + 0.02, { p: [s * (w / 2 - width / 2 + 0.02), r, z], r: [0, 0, Math.PI / 2] }, '#8a8a8a', 8);
  }
}
function person(b, x, y, z, shirt, skin, ry = 0, seated = true) {
  b.box(0.42, 0.55, 0.26, { p: [x, y + 0.3, z], ry }, shirt);
  b.sphere(0.13, { p: [x, y + 0.72, z], ry }, skin, 8, 6);
  if (!seated) b.box(0.36, 0.7, 0.22, { p: [x, y - 0.35, z], ry }, '#263238');
}

function danfo(R) {
  const b = new PrimBatch(), l = new PrimBatch();
  const Y = '#f2b705', K = '#161616', G = '#1b2330';
  b.box(2.0, 0.85, 4.9, { p: [0, 0.87, 0] }, Y);                 // lower body
  b.box(1.96, 0.82, 4.6, { p: [0, 1.7, -0.1] }, Y);               // upper cabin
  b.box(2.02, 0.52, 4.3, { p: [0, 1.7, -0.15] }, G);              // side windows band
  b.box(1.7, 0.55, 0.05, { p: [0, 1.68, 2.18], r: [-0.25, 0, 0] }, G); // windscreen
  b.box(2.03, 0.1, 4.92, { p: [0, 1.3, 0] }, K);                  // black stripes
  b.box(2.03, 0.08, 4.92, { p: [0, 0.78, 0] }, K);
  b.box(2.05, 0.2, 0.2, { p: [0, 0.5, 2.46] }, '#2a2a2a');       // bumpers
  b.box(2.05, 0.2, 0.2, { p: [0, 0.5, -2.46] }, '#2a2a2a');
  b.box(1.7, 0.06, 3.6, { p: [0, 2.16, -0.2] }, '#3a3a3a');       // roof rack
  for (const z of [-1.9, -0.6, 0.7]) b.box(1.72, 0.14, 0.05, { p: [0, 2.24, z] }, '#3a3a3a');
  b.box(0.05, 0.95, 1.1, { p: [-1.02, 1.3, 0.4] }, '#0c0c0c');    // open side door
  person(b, -1.18, 0.55, 0.45, SHIRT[Math.floor(R() * SHIRT.length)], SKIN[0], Math.PI / 2, false); // conductor hanging on
  wheels(b, 4.9, 2.0, 0.4, [1.55, -1.55]);
  l.box(0.3, 0.2, 0.05, { p: [-0.7, 0.9, 2.47] }, '#fff4d6'); l.box(0.3, 0.2, 0.05, { p: [0.7, 0.9, 2.47] }, '#fff4d6');
  l.box(0.22, 0.28, 0.05, { p: [-0.82, 0.95, -2.47] }, '#ff2a1a'); l.box(0.22, 0.28, 0.05, { p: [0.82, 0.95, -2.47] }, '#ff2a1a');
  return { b, l };
}
function okada(R) {
  const b = new PrimBatch(), l = new PrimBatch();
  const c = ['#8e1b1b', '#1a237e', '#212121', '#bf360c'][Math.floor(R() * 4)];
  b.cyl(0.33, 0.33, 0.1, { p: [0, 0.33, 0.72], r: [0, 0, Math.PI / 2] }, '#111', 12);
  b.cyl(0.33, 0.33, 0.12, { p: [0, 0.33, -0.7], r: [0, 0, Math.PI / 2] }, '#111', 12);
  b.box(0.28, 0.35, 1.2, { p: [0, 0.62, 0] }, c);
  b.box(0.3, 0.12, 0.8, { p: [0, 0.86, -0.2] }, '#111');           // seat
  b.box(0.7, 0.05, 0.05, { p: [0, 1.05, 0.62] }, '#999');          // handlebar
  b.box(0.08, 0.5, 0.08, { p: [0, 0.78, 0.66], r: [0.3, 0, 0] }, '#666');
  person(b, 0, 0.9, -0.1, SHIRT[Math.floor(R() * SHIRT.length)], SKIN[Math.floor(R() * 4)]);
  if (R() < 0.5) person(b, 0, 0.95, -0.55, SHIRT[Math.floor(R() * SHIRT.length)], SKIN[Math.floor(R() * 4)]);
  b.box(0.5, 0.12, 0.3, { p: [0.28, 0.9, -0.1], r: [0, 0, 0.4] }, '#263238'); b.box(0.5, 0.12, 0.3, { p: [-0.28, 0.9, -0.1], r: [0, 0, -0.4] }, '#263238'); // legs
  l.box(0.18, 0.14, 0.05, { p: [0, 0.95, 0.83] }, '#fff4d6');
  l.box(0.14, 0.08, 0.04, { p: [0, 0.78, -0.82] }, '#ff2a1a');
  return { b, l };
}
function keke(R) {
  const b = new PrimBatch(), l = new PrimBatch();
  const Y = '#f6c21c', Gn = '#2e7d32';
  b.box(1.3, 0.7, 2.3, { p: [0, 0.75, -0.15] }, Y);
  b.box(1.32, 0.12, 2.32, { p: [0, 0.95, -0.15] }, Gn);
  b.box(1.2, 0.5, 0.3, { p: [0, 1.1, 1.0] }, Y);
  b.box(1.15, 0.45, 0.04, { p: [0, 1.45, 1.05], r: [-0.2, 0, 0] }, '#1b2330');
  for (const [x, z] of [[-0.62, 1.05], [0.62, 1.05], [-0.62, -1.25], [0.62, -1.25]]) b.box(0.05, 0.75, 0.05, { p: [x, 1.45, z] }, '#222');
  b.box(1.4, 0.06, 2.5, { p: [0, 1.84, -0.1] }, '#1d1d1d');       // canopy
  b.box(1.42, 0.14, 2.52, { p: [0, 1.76, -0.1] }, Gn);
  b.cyl(0.25, 0.25, 0.14, { p: [0, 0.25, 1.1], r: [0, 0, Math.PI / 2] }, '#111', 10);
  for (const s of [-1, 1]) b.cyl(0.26, 0.26, 0.16, { p: [s * 0.62, 0.26, -0.95], r: [0, 0, Math.PI / 2] }, '#111', 10);
  person(b, 0, 0.9, 0.55, SHIRT[Math.floor(R() * SHIRT.length)], SKIN[Math.floor(R() * 4)]);
  l.box(0.2, 0.16, 0.05, { p: [0, 1.0, 1.17] }, '#fff4d6');
  l.box(0.16, 0.12, 0.04, { p: [-0.5, 0.7, -1.32] }, '#ff2a1a'); l.box(0.16, 0.12, 0.04, { p: [0.5, 0.7, -1.32] }, '#ff2a1a');
  return { b, l };
}
function car(R) {
  const b = new PrimBatch(), l = new PrimBatch();
  const c = ['#b0b3b8', '#1c1c1f', '#26418f', '#8e1b1b', '#e8e8e8', '#2f4f3f', '#6b4f2a'][Math.floor(R() * 7)];
  b.box(1.8, 0.55, 4.4, { p: [0, 0.62, 0] }, c);
  b.box(1.66, 0.5, 2.3, { p: [0, 1.15, -0.25] }, c);
  b.box(1.68, 0.36, 2.1, { p: [0, 1.16, -0.25] }, '#1b2330');
  b.box(1.5, 0.4, 0.05, { p: [0, 1.12, 0.93], r: [-0.6, 0, 0] }, '#1b2330');
  b.box(1.84, 0.14, 0.14, { p: [0, 0.45, 2.2] }, '#222'); b.box(1.84, 0.14, 0.14, { p: [0, 0.45, -2.2] }, '#222');
  wheels(b, 4.4, 1.8, 0.34, [1.35, -1.35], 0.22);
  l.box(0.36, 0.14, 0.05, { p: [-0.62, 0.72, 2.21] }, '#fff4d6'); l.box(0.36, 0.14, 0.05, { p: [0.62, 0.72, 2.21] }, '#fff4d6');
  l.box(0.34, 0.12, 0.05, { p: [-0.66, 0.74, -2.21] }, '#ff2a1a'); l.box(0.34, 0.12, 0.05, { p: [0.66, 0.74, -2.21] }, '#ff2a1a');
  return { b, l };
}
function tanker() {
  const b = new PrimBatch(), l = new PrimBatch();
  b.box(2.4, 1.6, 2.3, { p: [0, 1.45, 3.4] }, '#e0e0e0');         // cab
  b.box(2.42, 0.6, 1.8, { p: [0, 1.9, 3.45] }, '#1b2330');
  b.box(2.3, 0.25, 7.2, { p: [0, 0.75, -1.1] }, '#333');           // chassis
  b.cyl(1.2, 1.2, 6.8, { p: [0, 2.05, -1.2], r: [Math.PI / 2, 0, 0] }, '#e65100', 16); // tank
  b.cyl(1.22, 1.22, 0.3, { p: [0, 2.05, -1.2], r: [Math.PI / 2, 0, 0] }, '#fafafa', 16);
  b.box(0.8, 0.2, 5.5, { p: [0, 3.3, -1.2] }, '#555');             // walkway on top
  wheels(b, 9.5, 2.4, 0.5, [3.6, -2.4, -3.6, -4.3], 0.3);
  l.box(0.4, 0.2, 0.05, { p: [-0.8, 1.1, 4.56] }, '#fff4d6'); l.box(0.4, 0.2, 0.05, { p: [0.8, 1.1, 4.56] }, '#fff4d6');
  l.box(0.3, 0.2, 0.05, { p: [-1.0, 0.9, -4.76] }, '#ff2a1a'); l.box(0.3, 0.2, 0.05, { p: [1.0, 0.9, -4.76] }, '#ff2a1a');
  return { b, l };
}
function police() {
  const b = new PrimBatch(), l = new PrimBatch();
  const Bk = '#15171c', Bl = '#1f3f8f';
  b.box(1.95, 0.7, 4.8, { p: [0, 0.75, 0] }, Bk);
  b.box(1.97, 0.18, 4.82, { p: [0, 0.9, 0] }, Bl);
  b.box(1.85, 0.62, 2.0, { p: [0, 1.4, 0.7] }, Bk);
  b.box(1.87, 0.42, 1.8, { p: [0, 1.45, 0.7] }, '#1b2330');
  b.box(1.9, 0.35, 2.2, { p: [0, 1.25, -1.35] }, '#101115');       // open bed
  b.box(1.6, 0.05, 2.0, { p: [0, 1.09, -1.35] }, '#2b2b2b');
  b.box(2.0, 0.16, 0.16, { p: [0, 0.5, 2.42] }, '#222');
  wheels(b, 4.8, 1.95, 0.4, [1.5, -1.5], 0.26);
  l.box(0.36, 0.16, 0.05, { p: [-0.65, 0.95, 2.41] }, '#fff4d6'); l.box(0.36, 0.16, 0.05, { p: [0.65, 0.95, 2.41] }, '#fff4d6');
  l.box(0.3, 0.14, 0.05, { p: [-0.72, 0.95, -2.41] }, '#ff2a1a'); l.box(0.3, 0.14, 0.05, { p: [0.72, 0.95, -2.41] }, '#ff2a1a');
  return { b, l };
}

function brt() {
  const b = new PrimBatch(), l = new PrimBatch();
  b.box(2.55, 1.1, 11.5, { p: [0, 1.0, 0] }, '#1f4fa8');            // lower body
  b.box(2.5, 1.2, 11.3, { p: [0, 2.15, 0] }, '#1f4fa8');
  b.box(2.57, 0.85, 10.6, { p: [0, 2.2, -0.2] }, '#1b2330');         // windows
  b.box(2.58, 0.25, 11.52, { p: [0, 1.5, 0] }, '#c62828');           // red band
  b.box(2.3, 0.9, 0.05, { p: [0, 2.15, 5.76] }, '#1b2330');
  b.box(2.4, 0.12, 10.5, { p: [0, 2.82, 0] }, '#e8e8e8');           // roof
  wheels(b, 11.5, 2.55, 0.5, [4.2, -3.6, -4.8], 0.3);
  l.box(0.4, 0.2, 0.05, { p: [-0.85, 0.9, 5.76] }, '#fff4d6'); l.box(0.4, 0.2, 0.05, { p: [0.85, 0.9, 5.76] }, '#fff4d6');
  l.box(1.6, 0.25, 0.05, { p: [0, 2.72, 5.77] }, '#ffb300');           // destination board
  l.box(0.3, 0.3, 0.05, { p: [-1.0, 1.0, -5.76] }, '#ff2a1a'); l.box(0.3, 0.3, 0.05, { p: [1.0, 1.0, -5.76] }, '#ff2a1a');
  return { b, l };
}
function getaway() {
  const b = new PrimBatch(), l = new PrimBatch();
  const c = '#0e0f12';
  b.box(1.85, 0.55, 4.5, { p: [0, 0.62, 0] }, c);
  b.box(1.7, 0.5, 2.4, { p: [0, 1.15, -0.25] }, c);
  b.box(1.72, 0.38, 2.2, { p: [0, 1.16, -0.25] }, '#050608');
  b.box(1.5, 0.4, 0.05, { p: [0, 1.12, 0.97], r: [-0.6, 0, 0] }, '#0a0c10');
  b.box(1.9, 0.14, 0.14, { p: [0, 0.45, 2.25] }, '#8a8a8a'); b.box(1.9, 0.14, 0.14, { p: [0, 0.45, -2.25] }, '#8a8a8a');
  wheels(b, 4.5, 1.85, 0.35, [1.4, -1.4], 0.23);
  l.box(0.4, 0.14, 0.05, { p: [-0.62, 0.72, 2.26] }, '#dff3ff'); l.box(0.4, 0.14, 0.05, { p: [0.62, 0.72, 2.26] }, '#dff3ff');
  l.box(0.5, 0.1, 0.05, { p: [-0.6, 0.76, -2.26] }, '#ff2a1a'); l.box(0.5, 0.1, 0.05, { p: [0.6, 0.76, -2.26] }, '#ff2a1a');
  return { b, l };
}

const BUILD = { danfo, okada, keke, car, tanker, police, brt, getaway };
export function buildTemplate(type, R) {
  const { b, l } = BUILD[type](R);
  return { body: b.build(), lights: l.build(), spec: SPECS[type], type };
}

export const vehicleMats = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 }),
  lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
};
vehicleMats.lights.color.setScalar(4);
