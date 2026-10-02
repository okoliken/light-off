// Vehicle models built from primitives: yellow danfo buses, okadas, keke NAPEPs, tokunbo cars,
// a fuel tanker and the police Hilux. Local frame: +z is forward, y up, origin on the ground.
// Each template = { body geometry (vertex colours), light geometry, spec }.
import * as THREE from 'three';
import { PrimBatch } from '../core/geo.ts';

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
  // the classic Lagos danfo: a VW T3 bus, boxy, yellow with two black stripes, black grille band with round lamps
  const b = new PrimBatch(), l = new PrimBatch();
  const Y = ['#f2b705', '#f0b000', '#e9ad0c'][Math.floor(R() * 3)], K = '#161616', G = '#1b2330', RUST = '#7a4a22';
  b.box(1.98, 1.02, 4.7, { p: [0, 0.98, -0.05] }, Y);                   // lower body
  b.box(1.94, 0.82, 4.55, { p: [0, 1.88, -0.1] }, Y);                   // upper body
  b.box(1.9, 0.08, 4.5, { p: [0, 2.32, -0.1] }, Y);                     // roof
  b.box(1.94, 1.6, 0.22, { p: [0, 1.25, 2.27], r: [-0.08, 0, 0] }, Y);  // flat, slightly raked nose
  b.box(1.66, 0.62, 0.05, { p: [0, 1.95, 2.24], r: [-0.12, 0, 0] }, G); // big windscreen
  b.box(1.9, 0.34, 0.06, { p: [0, 0.98, 2.4] }, K);                     // black grille band
  b.box(2.02, 0.22, 0.24, { p: [0, 0.52, 2.42] }, K);                   // bumpers
  b.box(2.02, 0.22, 0.24, { p: [0, 0.52, -2.4] }, K);
  // side windows: front door, then three panes, on both sides
  for (const sx of [-1, 1]) {
    for (const [z, w] of <any[]>[[1.55, 0.8], [0.45, 1.05], [-0.7, 1.05], [-1.75, 0.8]]) b.box(0.03, 0.56, w, { p: [sx * 0.985, 1.92, z] }, G);
    b.box(0.03, 0.07, 4.6, { p: [sx * 1.0, 1.36, -0.05] }, K);         // the two black stripes
    b.box(0.03, 0.07, 4.6, { p: [sx * 1.0, 1.22, -0.05] }, K);
    b.box(0.08, 0.16, 0.1, { p: [sx * 1.08, 1.9, 1.95] }, K);          // mirror
    for (let k = 0; k < 4; k++) if (R() < 0.6) b.box(0.03, 0.12 + R() * 0.2, 0.15 + R() * 0.3, { p: [sx * 1.0, 0.6 + R() * 0.8, -2 + R() * 4] }, RUST); // rust and dents
  }
  b.box(0.04, 1.6, 1.05, { p: [1.0, 1.35, 0.25] }, '#0c0c0c');          // the sliding door, open (passenger side)
  b.box(1.82, 0.5, 0.04, { p: [0, 1.95, -2.38] }, G);                   // rear window
  b.box(0.3, 0.1, 0.4, { p: [-0.6, 0.52, -2.6] }, '#2a2a2a');           // step where boys stand
  // roof rack with bags
  b.box(1.75, 0.05, 3.4, { p: [0, 2.45, -0.3] }, '#3a3a3a');
  for (const z of [-1.8, -0.3, 1.2]) b.box(1.78, 0.12, 0.05, { p: [0, 2.52, z] }, '#3a3a3a');
  if (R() < 0.6) b.box(0.9, 0.35, 0.8, { p: [(R() - 0.5) * 0.6, 2.66, -0.5] }, ['#6d4c41', '#1565c0', '#c62828'][Math.floor(R() * 3)]);
  person(b, 1.18, 0.55, 0.3, SHIRT[Math.floor(R() * SHIRT.length)], SKIN[0], -Math.PI / 2, false); // conductor in the door
  if (R() < 0.4) person(b, -0.5, 0.95, -2.75, SHIRT[Math.floor(R() * SHIRT.length)], SKIN[1], 0, false); // a boy hanging off the back
  wheels(b, 4.9, 1.98, 0.38, [1.5, -1.5], 0.24);
  l.sphere(0.13, { p: [-0.68, 0.98, 2.44], s: [1, 1, 0.4] }, '#fff4d6', 10, 6); l.sphere(0.13, { p: [0.68, 0.98, 2.44], s: [1, 1, 0.4] }, '#fff4d6', 10, 6);
  l.box(0.12, 0.08, 0.04, { p: [-0.92, 0.72, 2.45] }, '#ffa000'); l.box(0.12, 0.08, 0.04, { p: [0.92, 0.72, 2.45] }, '#ffa000');
  l.box(0.16, 0.3, 0.05, { p: [-0.84, 1.0, -2.43] }, '#ff2a1a'); l.box(0.16, 0.3, 0.05, { p: [0.84, 1.0, -2.43] }, '#ff2a1a');
  return { b, l };
}
function okada(R) {
  const b = new PrimBatch(), l = new PrimBatch();
  const c: any = ['#8e1b1b', '#1a237e', '#212121', '#bf360c'][Math.floor(R() * 4)];
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
  // keke NAPEP (Bajaj RE): narrow rounded yellow nose, black face with two round lamps, one front wheel under a
  // yellow mudguard, open sides, a wider rear tub with fenders over the back wheels, and a black canvas hood
  const b = new PrimBatch(), l = new PrimBatch();
  const Y = '#f6b81c', K = '#151515', C = '#2a2a2a';
  // nose and cockpit
  b.box(0.95, 1.0, 0.55, { p: [0, 1.0, 1.05] }, Y);
  b.sphere(0.5, { p: [0, 0.95, 1.2], s: [0.95, 0.8, 0.6] }, Y, 12, 8);
  b.box(0.98, 0.32, 0.06, { p: [0, 0.98, 1.5] }, K);                   // black face band
  b.box(0.12, 0.08, 0.04, { p: [0.36, 0.8, 1.5] }, '#ff9800');
  b.box(0.95, 0.62, 0.04, { p: [0, 1.6, 1.25], r: [-0.18, 0, 0] }, '#1b2330'); // windscreen
  b.box(0.02, 0.04, 0.55, { p: [0, 1.6, 1.25], r: [-0.18, 0.5, 0] }, '#111'); // wiper
  b.box(1.0, 0.08, 0.6, { p: [0, 1.93, 1.05] }, Y);                    // roof over the driver
  for (const sx of [-1, 1]) b.box(0.08, 0.16, 0.1, { p: [sx * 0.6, 1.7, 1.3] }, K); // mirrors
  // front wheel and mudguard
  b.cyl(0.24, 0.24, 0.12, { p: [0, 0.24, 1.25], r: [0, 0, Math.PI / 2] }, '#111', 12);
  b.cyl(0.29, 0.29, 0.16, { p: [0, 0.32, 1.25], r: [0, 0, Math.PI / 2], s: [1, 1, 0.55] }, Y, 12);
  // floor, the driver's bench and the rear tub
  b.box(1.0, 0.1, 1.3, { p: [0, 0.42, 0.25] }, C);
  b.box(1.38, 0.75, 1.15, { p: [0, 0.78, -0.75] }, Y);                 // rear body
  b.box(1.36, 0.12, 0.9, { p: [0, 1.18, -0.75] }, '#222');             // passenger bench
  b.box(1.36, 0.55, 0.12, { p: [0, 1.45, -1.25] }, '#222');            // backrest
  for (const sx of [-1, 1]) {
    b.cyl(0.3, 0.3, 0.16, { p: [sx * 0.64, 0.42, -0.85], r: [0, 0, Math.PI / 2], s: [1, 1, 0.6] }, Y, 12); // rear fenders
    b.cyl(0.25, 0.25, 0.14, { p: [sx * 0.64, 0.25, -0.85], r: [0, 0, Math.PI / 2] }, '#111', 12);
    b.box(0.04, 0.25, 0.8, { p: [sx * 0.68, 0.95, -0.15] }, Y);        // half-door sill
    b.box(0.05, 0.05, 2.1, { p: [sx * 0.66, 1.95, -0.2] }, '#1d1d1d'); // canopy rail
    b.box(0.05, 1.1, 0.05, { p: [sx * 0.66, 1.4, 0.5] }, '#1d1d1d');   // pillar
  }
  // black canvas hood, rounded at the back
  b.box(1.42, 0.06, 1.9, { p: [0, 2.0, -0.35] }, K);
  b.cyl(0.6, 0.6, 1.42, { p: [0, 1.5, -1.25], r: [0, 0, Math.PI / 2], s: [1, 1, 0.55] }, K, 12);
  b.box(1.42, 0.05, 0.05, { p: [0, 1.96, -0.35] }, Y);                 // yellow piping
  person(b, 0, 0.85, 0.45, SHIRT[Math.floor(R() * SHIRT.length)], SKIN[Math.floor(R() * 4)]);
  if (R() < 0.6) person(b, 0.35, 1.0, -0.75, SHIRT[Math.floor(R() * SHIRT.length)], SKIN[Math.floor(R() * 4)]);
  if (R() < 0.4) person(b, -0.35, 1.0, -0.75, SHIRT[Math.floor(R() * SHIRT.length)], SKIN[Math.floor(R() * 4)]);
  l.sphere(0.09, { p: [-0.3, 0.98, 1.53], s: [1, 1, 0.4] }, '#fff4d6', 10, 6); l.sphere(0.09, { p: [0.3, 0.98, 1.53], s: [1, 1, 0.4] }, '#fff4d6', 10, 6);
  l.box(0.12, 0.14, 0.04, { p: [-0.6, 0.85, -1.34] }, '#ff2a1a'); l.box(0.12, 0.14, 0.04, { p: [0.6, 0.85, -1.34] }, '#ff2a1a');
  return { b, l };
}
function car(R) {
  const b = new PrimBatch(), l = new PrimBatch();
  const c: any = ['#b0b3b8', '#1c1c1f', '#26418f', '#8e1b1b', '#e8e8e8', '#2f4f3f', '#6b4f2a'][Math.floor(R() * 7)];
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
