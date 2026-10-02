// Procedural Surulere-style district at night: painted 1-4 storey buildings with burglar-proof windows,
// compound walls, container shops, a market, a motor park, a football pitch the street kids turned into a
// skate spot, street lights (some broken), transformers, potholes and concrete road medians to grind.
import * as THREE from 'three';
import { GeoBuilder, PrimBatch } from '../core/geo.ts';
import * as T from '../core/textures.ts';
import { N, ROAD, WALK, CURB, CELL, HALF, roadLine, blockRect, blockType, rng, isRoad, BRIDGE, CAMPUS, I0, I1, district, UNI } from './layout.ts';
import { Collision } from './collision.ts';

const YABA_PAINT = ['#e6e2d8', '#cfd8dc', '#d7ccc8', '#f0ead6', '#b0bec5', '#dcd3c0', '#c5cae9', '#e0e0e0'];
const MUSHIN_PAINT = ['#a1887f', '#8d6e63', '#bcaaa4', '#9e8b6e', '#b89b72', '#8a7f6d', '#c2a27c', '#7d6e5d'];
const PAINT = ['#e8dcc0', '#e6d28a', '#b9d6ae', '#a9c4dc', '#e8b890', '#dcdcd6', '#e0b4bc', '#a3a39a', '#d9c7a0', '#c9d9c0', '#f0e6d0', '#bfb3a0'];
// the Ojuelegba flyover runs north-south through the middle of block column 4
export const FLY = { x: 108, half: 7, y: 8, clear: 13 };
const BRIGHT = ['#d32f2f', '#1976d2', '#fbc02d', '#388e3c', '#f57c00', '#7b1fa2', '#00897b', '#e64a19'];

let world_bad = null;
export function buildCity(scene, opt: any = {}) {
  const R = rng(20240917);
  const col = new Collision();
  const S = col.solids;
  const pick = a => a[Math.floor(R() * a.length)];
  const color = h => new THREE.Color(h);

  const win = T.windowTextures();
  const mats = {
    wall: new THREE.MeshStandardMaterial({ map: win.albedo, emissiveMap: win.emissive, emissive: 0xffffff, emissiveIntensity: 1, vertexColors: true, roughness: 0.92 }),
    wallGen: new THREE.MeshStandardMaterial({ map: win.albedo, emissiveMap: win.emissive, emissive: 0xffffff, emissiveIntensity: 1, vertexColors: true, roughness: 0.92 }),
    roof: new THREE.MeshStandardMaterial({ map: T.dirtTexture('#77736b', 29), vertexColors: true, roughness: 1 }),
    road: new THREE.MeshStandardMaterial({ map: T.roadTexture(), roughness: 0.95 }),
    asphalt: new THREE.MeshStandardMaterial({ map: T.asphaltTexture(), roughness: 0.95 }),
    walk: new THREE.MeshStandardMaterial({ map: T.sidewalkTexture(), vertexColors: true, roughness: 0.95 }),
    dirt: new THREE.MeshStandardMaterial({ map: T.dirtTexture(), vertexColors: true, roughness: 1 }),
    misc: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6 }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.62, 0.3).multiplyScalar(5), toneMapped: false }),
    pool: new THREE.MeshBasicMaterial({ map: T.glowTexture(), color: 0xff9440, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    hole: new THREE.MeshBasicMaterial({ map: T.glowTexture(), color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    sign: new THREE.MeshStandardMaterial({ map: T.signAtlas(), roughness: 0.7 }),
  };
  mats.sign.emissiveMap = mats.sign.map; mats.sign.emissive = new THREE.Color(0xffffff); mats.sign.emissiveIntensity = 0.55;
  mats.wallGen.userData.gen = true;

  const badMat = new THREE.MeshStandardMaterial({ map: T.badRoadTexture(), roughness: 1 });
  const waterMatF = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.82 });
  // not every road in Lagos is good: these stretches are broken laterite, and two of them are flooded
  const BAD = new Set(['x5_0', 'x5_1', 'z1_4', 'z1_5', 'x1_4', 'z5_2', 'x6_3', 'z0_2']);
  const FLOOD = new Set(['x5_1', 'z1_4']);
  world_bad = { segs: [], floods: [] };
  const G = { bad: new GeoBuilder(), flood: new GeoBuilder(), wall: new GeoBuilder(), wallGen: new GeoBuilder(), roof: new GeoBuilder(), road: new GeoBuilder(), asphalt: new GeoBuilder(), walk: new GeoBuilder(), dirt: new GeoBuilder(), pool: new GeoBuilder(), hole: new GeoBuilder(), sign: new GeoBuilder() };
  const B = { misc: new PrimBatch(), metal: new PrimBatch(), lamp: new PrimBatch() };
  const white = color('#ffffff');

  const world: any = {
    collision: col, rails: [], potholes: [], transformers: [], lights: [], generators: [], spots: [], parked: [],
    blocks: [], stalls: [], home: null, marketSpot: null, motorparkSpot: null, pitchCenter: null,
  };

  const wedge = (() => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(1, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g;
  })();

  // ---------- roads ----------
  for (let j = 0; j <= N; j++) for (let i = I0; i < I1; i++) {
    // road along x at z = roadLine(j)
    const zc = roadLine(j), xa = roadLine(i) + ROAD / 2, xb = roadLine(i + 1) - ROAD / 2, L = xb - xa;
    const kx = `x${j}_${i}`;
    (BAD.has(kx) ? G.bad : G.road).face([(xa + xb) / 2, 0, zc], [0, 0, ROAD / 2], [L / 2, 0, 0], [0, 1, 0], [0, xa / 12, 1, xb / 12], white);
    if (BAD.has(kx)) world_bad.segs.push({ x0: xa, x1: xb, z0: zc - ROAD / 2, z1: zc + ROAD / 2, flood: FLOOD.has(kx), along: 'x' });
  }
  for (let i = I0; i <= I1; i++) for (let j = 0; j < N; j++) {
    // road along z at x = roadLine(i)
    const xc = roadLine(i), za = roadLine(j) + ROAD / 2, zb = roadLine(j + 1) - ROAD / 2, L = zb - za;
    const kz = `z${i}_${j}`;
    (BAD.has(kz) ? G.bad : G.road).face([xc, 0, (za + zb) / 2], [ROAD / 2, 0, 0], [0, 0, -L / 2], [0, 1, 0], [0, -zb / 12, 1, -za / 12], white);
    if (BAD.has(kz)) world_bad.segs.push({ x0: xc - ROAD / 2, x1: xc + ROAD / 2, z0: za, z1: zb, flood: FLOOD.has(kz), along: 'z' });
  }
  for (const sg of world_bad.segs) {
    // extra potholes on broken roads, and brown flood water pooled in the middle of flooded ones
    for (let k = 0; k < 9; k++) { const x = sg.x0 + 1 + R() * (sg.x1 - sg.x0 - 2), z = sg.z0 + 1 + R() * (sg.z1 - sg.z0 - 2), r = 0.7 + R() * 0.9; G.hole.flat(x - r, z - r * 0.8, x + r, z + r * 0.8, 0.03, white, 1, [0, 0, 1, 1]); world.potholes.push({ x, z, r: r * 0.75 }); }
    if (sg.flood) {
      const ax = sg.along === 'x', mid = ax ? (sg.x0 + sg.x1) / 2 : (sg.z0 + sg.z1) / 2, half = 13;
      const f = ax ? { x0: mid - half, x1: mid + half, z0: sg.z0 + 0.5, z1: sg.z1 - 0.5 } : { x0: sg.x0 + 0.5, x1: sg.x1 - 0.5, z0: mid - half, z1: mid + half };
      G.flood.flat(f.x0, f.z0, f.x1, f.z1, 0.07, white, 1, [0, 0, 1, 1]);
      world_bad.floods.push(f);
    }
  }
  for (let i = I0; i <= I1; i++) for (let j = 0; j <= N; j++) {
    const x = roadLine(i), z = roadLine(j);
    G.asphalt.flat(x - ROAD / 2, z - ROAD / 2, x + ROAD / 2, z + ROAD / 2, 0, white, 12);
  }
  // under-everything ground plane (lagoon-side dirt beyond the ring)
  G.dirt.flat(roadLine(I0) - CELL * 3, BRIDGE.z0 - 2, roadLine(I1) + CELL * 3, HALF + CELL * 3, -0.05, color('#5d5347'), 10);

  // ---------- blocks ----------
  for (let bi = I0 - 1; bi <= I1; bi++) for (let bj = -1; bj <= N; bj++) {
    const r = blockRect(bi, bj), type = blockType(bi, bj);
    if (bj === N && bi >= 4 && bi <= 6) continue; // the National Stadium grounds are here
    if (bj === -1 && bi >= N && bi < I1) continue;  // UNILAG, Akoka: built as its own campus
    world.blocks.push({ bi, bj, type, ...r });
    // raised slab: sidewalk top + curb sides
    G.walk.box(r.x0, -0.05, r.z0, r.x1, CURB, r.z1, color('#ffffff'), { faces: 'px nx pz nz', uvScale: [3, 3] });
    const tint = color(type === 'ring' ? '#8a8478' : '#ffffff');
    if (type === 'market' || type === 'motorpark' || type === 'pitch' || type === 'ladipo' || type === 'ojuwoye') {
      // sidewalk band only, interior is dirt
      G.walk.flat(r.x0, r.z0, r.x1, r.z0 + WALK, CURB, tint, 3);
      G.walk.flat(r.x0, r.z1 - WALK, r.x1, r.z1, CURB, tint, 3);
      G.walk.flat(r.x0, r.z0 + WALK, r.x0 + WALK, r.z1 - WALK, CURB, tint, 3);
      G.walk.flat(r.x1 - WALK, r.z0 + WALK, r.x1, r.z1 - WALK, CURB, tint, 3);
      G.dirt.flat(r.x0 + WALK, r.z0 + WALK, r.x1 - WALK, r.z1 - WALK, CURB + 0.005, color(type === 'pitch' ? '#b59a6a' : type === 'market' ? '#8e8577' : type === 'ladipo' ? '#4a4038' : type === 'ojuwoye' ? '#6e6255' : '#7d6c58'), 6);
    } else G.walk.flat(r.x0, r.z0, r.x1, r.z1, CURB, tint, 3);

    if (type === 'market') buildMarket(r);
    else if (type === 'motorpark') buildMotorpark(r);
    else if (type === 'pitch') buildPitch(r);
    else if (type === 'tejuosho') buildTejuosho(r);
    else if (type === 'ladipo') buildLadipo(r);
    else if (type === 'hospital') buildLUTH(r);
    else if (type === 'busterminal') buildBusTerminal(r);
    else if (type === 'ecentre') buildECentre(r);
    else if (type === 'ojuwoye') buildOjuwoye(r);
    else if (type === 'empire') buildEmpire(r);
    else buildLots(r, type, bi, bj);
  }

  // ---------- lots & buildings ----------
  function buildLots(r, type, bi, bj) {
    const ring = type === 'ring';
    const dN = 13 + R() * 6, dS = 13 + R() * 6, dW = 13 + R() * 5, dE = 13 + R() * 5;
    const sides = [
      { a: r.x0 + WALK, b: r.x1 - WALK, axis: 'x', front: r.z0 + WALK, depth: dN, n: [0, -1] },
      { a: r.x0 + WALK, b: r.x1 - WALK, axis: 'x', front: r.z1 - WALK, depth: dS, n: [0, 1] },
      { a: r.z0 + WALK + dN + 0.5, b: r.z1 - WALK - dS - 0.5, axis: 'z', front: r.x0 + WALK, depth: dW, n: [-1, 0] },
      { a: r.z0 + WALK + dN + 0.5, b: r.z1 - WALK - dS - 0.5, axis: 'z', front: r.x1 - WALK, depth: dE, n: [1, 0] },
    ];
    // outer ring blocks only need the side that faces the playable city
    for (const sd of sides) {
      if (bi === 8 && sd.n[0] === 1) continue; // the Red Line railway runs down this edge
      if (ring) {
        const fx = sd.axis === 'x' ? 0 : sd.front, fz = sd.axis === 'x' ? sd.front : 0;
        const faceIn = sd.axis === 'x' ? Math.abs(fz + sd.n[1] * 12) < HALF + 1 : Math.abs(fx + sd.n[0] * 12) < HALF + 1;
        if (!faceIn) { // back side: one tall slab to fill the silhouette
          continue;
        }
      }
      let t = sd.a;
      while (sd.b - t > 5) {
        let w = 8 + R() * 8; if (sd.b - (t + w) < 7) w = sd.b - t;
        // leave the strip under the Ojuelegba flyover open
        const [lx0, , lx1] = lotRect(sd, t, t + w, 0, sd.depth);
        if (bi === 4 && lx1 > FLY.x - FLY.clear && lx0 < FLY.x + FLY.clear) { t += w; continue; }
        if (bi === 8 && lx1 > roadLine(9) - ROAD / 2 - WALK - 12) { t += w; continue; } // keep the railway corridor clear
        lot(sd, t, t + w, ring, bi, bj);
        t += w;
      }
    }
    if (ring && bi !== 4) { // fill the middle of ring blocks with a mass so there are no see-through holes
      const m = 14;
      addBuilding(r.x0 + WALK + m, r.z0 + WALK + m, r.x1 - WALK - m, r.z1 - WALK - m, 4 + Math.floor(R() * 4), pick(PAINT), false, [0, 1], false);
    }
  }

  function lotRect(sd, a0, a1, d0, d1) {
    // along-axis range a0..a1, depth from front d0..d1 (measured inward)
    if (sd.axis === 'x') {
      const inward = -sd.n[1];
      const z0 = sd.front + inward * d0, z1 = sd.front + inward * d1;
      return [a0, Math.min(z0, z1), a1, Math.max(z0, z1)];
    }
    const inward = -sd.n[0];
    const x0 = sd.front + inward * d0, x1 = sd.front + inward * d1;
    return [Math.min(x0, x1), a0, Math.max(x0, x1), a1];
  }

  function lot(sd, a0, a1, ring, bi, bj) {
    const gap = R() < 0.4 ? 0.8 + R() * 1.4 : 0.05;
    const w = a1 - a0, mid = (a0 + a1) / 2;
    const frontPt = sd.axis === 'x' ? [mid, sd.front] : [sd.front, mid];
    const out = sd.n;
    const roll = R();
    if (!ring) world.spots.push({ x: frontPt[0] + out[0] * (WALK * 0.55), z: frontPt[1] + out[1] * (WALK * 0.55), nx: out[0], nz: out[1], bi, bj });
    if (ring || roll < 0.58) {
      const [x0, z0, x1, z1] = lotRect(sd, a0 + gap / 2, a1 - gap / 2, 0, sd.depth);
      // each district has its own look: Yaba taller and paler (students, offices), Mushin low, rusty and tight
      const D = district(bi);
      const floors = ring ? 3 + Math.floor(R() * 5) : D === 'yaba' ? pick([2, 3, 3, 4, 4, 5, 6]) : D === 'mushin' ? pick([1, 1, 1, 2, 2, 3]) : pick([1, 2, 2, 2, 3, 3, 3, 4]);
      const gen = !ring && R() < (D === 'mushin' ? 0.4 : 0.28);
      const paint = D === 'yaba' ? pick(YABA_PAINT) : D === 'mushin' ? pick(MUSHIN_PAINT) : pick(PAINT);
      addBuilding(x0, z0, x1, z1, floors, paint, gen, out, !ring && w > 6 && R() < (D === 'surulere' ? 0.6 : 0.75), D);
      if (D === 'mushin' && !ring && R() < 0.5) leanTo(sd, a0, a1, out); // zinc lean-to workshops spill onto the walk
      if (gen) generator(frontPt, out, sd, w);
    } else if (roll < 0.85) {
      // compound: wall on the front line with a gate, house set back
      const [fx0, fz0, fx1, fz1] = lotRect(sd, a0 + 0.1, a1 - 0.1, 0, 0.25);
      const wallC = pick(['#d8d0bc', '#bdb6a6', '#e6d6a8', '#b8c6b0']);
      const gw = 3.2, g0 = mid - gw / 2, g1 = mid + gw / 2;
      const segs: any[] = [[a0 + 0.1, g0], [g1, a1 - 0.1]];
      for (const [s0, s1] of segs) {
        const [x0, z0, x1, z1] = lotRect(sd, s0, s1, 0, 0.25);
        B.misc.box(x1 - x0, 2.2, z1 - z0, { p: [(x0 + x1) / 2, CURB + 1.1, (z0 + z1) / 2] }, wallC);
        B.misc.box(x1 - x0 + 0.06, 0.12, z1 - z0 + 0.06, { p: [(x0 + x1) / 2, CURB + 2.26, (z0 + z1) / 2] }, '#5a5249');
        S.add(x0, 0, z0, x1, CURB + 2.32, z1, 'fence');
      }
      { // closed black gate
        const [x0, z0, x1, z1] = lotRect(sd, g0, g1, 0.05, 0.2);
        B.metal.box(x1 - x0, 2.0, z1 - z0, { p: [(x0 + x1) / 2, CURB + 1.0, (z0 + z1) / 2] }, '#1d1f22');
        S.add(x0, 0, z0, x1, CURB + 2.0, z1, 'gate');
      }
      void fx0; void fz0; void fx1; void fz1;
      const [x0, z0, x1, z1] = lotRect(sd, a0 + gap / 2 + 0.6, a1 - gap / 2 - 0.6, 4.5, sd.depth);
      addBuilding(x0, z0, x1, z1, R() < 0.6 ? 1 : 2, pick(PAINT), R() < 0.25, out, false);
    } else {
      // container shop on the front line, open dirt yard behind
      const cl = Math.min(6, w - 1);
      const [x0, z0, x1, z1] = lotRect(sd, mid - cl / 2, mid + cl / 2, 0.2, 2.6);
      const c = pick(['#1e5aa8', '#a8321e', '#2e7d32', '#b08a1e', '#6d4c41']);
      B.metal.box(x1 - x0, 2.6, z1 - z0, { p: [(x0 + x1) / 2, CURB + 1.3, (z0 + z1) / 2] }, c);
      S.add(x0, 0, z0, x1, CURB + 2.6, z1, 'container');
      const [yx0, yz0, yx1, yz1] = lotRect(sd, a0 + 0.2, a1 - 0.2, 2.8, sd.depth);
      G.dirt.flat(yx0, yz0, yx1, yz1, CURB + 0.01, color('#6a5a48'), 6);
      signOn(x0, z0, x1, z1, out, CURB + 2.65, CURB + 3.35, Math.min(cl, 5));
    }
  }

  function leanTo(sd, a0, a1, out) {
    const mid = (a0 + a1) / 2, lw = Math.min(4, a1 - a0 - 1);
    const [x0, z0, x1, z1] = lotRect(sd, mid - lw / 2, mid + lw / 2, -1.6, 0);
    B.metal.box(x1 - x0 + 0.3, 0.06, z1 - z0 + 0.3, { p: [(x0 + x1) / 2, CURB + 2.3, (z0 + z1) / 2], r: [out[1] * 0.12, 0, -out[0] * 0.12] }, pick(['#8b6a4a', '#7a7064', '#9c7a5a']));
    for (const [px, pz] of <any[]>[[x0, z0], [x1, z1]]) B.metal.cyl(0.05, 0.05, 2.3, { p: [px, CURB + 1.15, pz] }, '#4a4038', 5);
  }
  function addBuilding(x0, z0, x1, z1, floors, paint, gen, out, sign, D = 'surulere') {
    const H = floors * 3.2, y0 = CURB, y1 = CURB + H;
    const c = color(paint).multiplyScalar(0.85 + R() * 0.15);
    const g = gen ? G.wallGen : G.wall;
    g.box(x0, y0, z0, x1, y1, z1, c, { faces: 'px nx pz nz', uvScale: [T.WIN_U, T.WIN_V], uvOff: [Math.floor(R() * 8) / 8, Math.floor(R() * 8) / 8], vBase: y0 });
    G.roof.box(x0, y1 - 0.01, z0, x1, y1, z1, color('#9a958b').multiplyScalar(0.8 + R() * 0.3), { faces: 'py', uvScale: [6, 6] });
    // parapet
    const p = 0.35, t = 0.18, pc = c.clone().multiplyScalar(0.9);
    B.misc.box(x1 - x0, p, t, { p: [(x0 + x1) / 2, y1 + p / 2, z0 + t / 2] }, pc).box(x1 - x0, p, t, { p: [(x0 + x1) / 2, y1 + p / 2, z1 - t / 2] }, pc)
      .box(t, p, z1 - z0, { p: [x0 + t / 2, y1 + p / 2, (z0 + z1) / 2] }, pc).box(t, p, z1 - z0, { p: [x1 - t / 2, y1 + p / 2, (z0 + z1) / 2] }, pc);
    S.add(x0, 0, z0, x1, y1, z1, 'building', { roof: true });
    // rooftop clutter
    const w = x1 - x0, d = z1 - z0;
    if (w > 5 && d > 5) {
      if (R() < 0.5) { // black "Geepee" water tank on a stand
        const tx = x0 + 1.5 + R() * (w - 3), tz = z0 + 1.5 + R() * (d - 3);
        B.metal.box(1.4, 0.8, 1.4, { p: [tx, y1 + 0.4, tz] }, '#4a4a4a');
        B.misc.cyl(0.75, 0.8, 1.5, { p: [tx, y1 + 1.55, tz] }, '#141414', 14);
        S.add(tx - 0.8, y1, tz - 0.8, tx + 0.8, y1 + 2.3, tz + 0.8, 'tank');
      }
      if (floors > 1 && R() < 0.35) { // stair bulkhead
        const bx = x0 + 1 + R() * (w - 4), bz = z0 + 1 + R() * (d - 4);
        B.misc.box(2.4, 2.3, 2.4, { p: [bx + 1.2, y1 + 1.15, bz + 1.2] }, c.clone().multiplyScalar(0.8));
        S.add(bx, y1, bz, bx + 2.4, y1 + 2.3, bz + 2.4, 'bulkhead');
      }
      if (R() < 0.3) { // satellite dish
        const sx = x0 + 1 + R() * (w - 2), sz = z0 + 1 + R() * (d - 2);
        B.metal.cyl(0.03, 0.03, 0.8, { p: [sx, y1 + 0.4, sz] }, '#888');
        B.misc.cyl(0.45, 0.05, 0.18, { p: [sx, y1 + 0.9, sz], r: [0.9, R() * 6, 0] }, '#ddd', 12);
      }
    }
    if (sign) signOn(x0, z0, x1, z1, out, CURB + 2.55, CURB + 3.35, Math.min(Math.max(x1 - x0, z1 - z0) - 1.5, 7), D);
  }

  function signOn(x0, z0, x1, z1, out, ya, yb, w, D = 'surulere') {
    // each district's shop signs: 0-15 Surulere, 16-23 Yaba, 24-31 Mushin (a few Surulere ones everywhere)
    const idx = D === 'yaba' && R() < 0.8 ? 16 + Math.floor(R() * 8) : D === 'mushin' && R() < 0.8 ? 24 + Math.floor(R() * 8) : Math.floor(R() * 16), uv = T.signUV(idx), off = 0.08;
    const cy = (ya + yb) / 2, hy = (yb - ya) / 2;
    let c, u;
    if (out[1] !== 0) { const z = out[1] < 0 ? z0 - off : z1 + off; c = [(x0 + x1) / 2, cy, z]; u = [out[1] > 0 ? w / 2 : -w / 2, 0, 0]; }
    else { const x = out[0] < 0 ? x0 - off : x1 + off; c = [x, cy, (z0 + z1) / 2]; u = [0, 0, out[0] > 0 ? -w / 2 : w / 2]; }
    G.sign.face(c, u, [0, hy, 0], [out[0], 0, out[1]], uv, white);
  }

  function generator(frontPt, out, sd, w) {
    const along = sd.axis === 'x' ? [1, 0] : [0, 1];
    const k = (R() - 0.5) * (w - 2);
    const x = frontPt[0] + along[0] * k + out[0] * 0.9, z = frontPt[1] + along[1] * k + out[1] * 0.9;
    const c = pick(['#c62828', '#f9a825', '#1565c0', '#2e7d32']);
    B.misc.box(0.9, 0.62, 0.62, { p: [x, CURB + 0.31, z], ry: sd.axis === 'x' ? 0 : Math.PI / 2 }, c);
    B.metal.box(0.95, 0.08, 0.66, { p: [x, CURB + 0.66, z], ry: sd.axis === 'x' ? 0 : Math.PI / 2 }, '#222');
    S.add(x - 0.48, 0, z - 0.48, x + 0.48, CURB + 0.7, z + 0.48, 'generator');
    world.generators.push({ x, z });
  }

  // ---------- market ----------
  function buildMarket(r) {
    const ix0 = r.x0 + WALK, ix1 = r.x1 - WALK, iz0 = r.z0 + WALK, iz1 = r.z1 - WALK;
    // lock-up shops along north and south edges, with entrances
    for (const [zf, dir] of <any[]>[[iz0, 1], [iz1, -1]]) {
      let x = ix0;
      while (x < ix1 - 2) {
        const w = Math.min(4 + Math.floor(R() * 2) * 2, ix1 - x);
        const isGate = Math.abs(x + w / 2 - (ix0 + ix1) / 2) < 5;
        if (!isGate) {
          const z0 = dir > 0 ? zf : zf - 4, z1 = dir > 0 ? zf + 4 : zf;
          B.misc.box(w - 0.15, 3.0, 4, { p: [x + w / 2, CURB + 1.5, (z0 + z1) / 2] }, pick(['#cfc3a8', '#d6b98a', '#b7c4b0']));
          B.metal.box(w - 0.3, 2.4, 0.08, { p: [x + w / 2, CURB + 1.2, dir > 0 ? z0 - 0.04 : z1 + 0.04] }, pick(['#2a4d7a', '#7a2a2a', '#4d4d4d', '#2a6a4a']));
          B.metal.box(w + 0.2, 0.08, 4.8, { p: [x + w / 2, CURB + 3.05, (z0 + z1) / 2 + (dir > 0 ? -0.3 : 0.3)], r: [dir * 0.08, 0, 0] }, '#8a6a4a');
          S.add(x, 0, z0, x + w - 0.15, CURB + 3.1, z1, 'shop');
          if (R() < 0.5) signOn(x, z0, x + w, z1, [0, -dir], CURB + 2.3, CURB + 2.9, w - 0.6);
        }
        x += w;
      }
    }
    // stall grid
    const umb = BRIGHT;
    for (let x = ix0 + 5; x < ix1 - 4; x += 5.2) for (let z = iz0 + 8; z < iz1 - 7; z += 5.5) {
      if (Math.abs(x - (ix0 + ix1) / 2) < 2.2) continue; // main aisle
      const tx = x + (R() - 0.5) * 0.4, tz = z + (R() - 0.5) * 0.4;
      B.misc.box(2.4, 0.08, 1.2, { p: [tx, CURB + 0.9, tz] }, '#7a5c3e');
      for (const [ox, oz] of <any[]>[[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) B.misc.box(0.08, 0.9, 0.08, { p: [tx + ox, CURB + 0.45, tz + oz] }, '#5a4430');
      // produce
      for (let k = 0; k < 5; k++) B.misc.sphere(0.12 + R() * 0.06, { p: [tx - 0.9 + k * 0.45, CURB + 1.02, tz + (R() - 0.5) * 0.6], s: [1.6, 0.6, 1.6] }, pick(['#d32f2f', '#e65100', '#fbc02d', '#558b2f', '#6d4c41']));
      B.metal.cyl(0.03, 0.03, 2.2, { p: [tx, CURB + 1.1, tz] }, '#666');
      B.misc.add(new THREE.ConeGeometry(1.6, 0.6, 8, 1, true), { p: [tx, CURB + 2.4, tz] }, pick(umb));
      S.add(tx - 1.2, 0, tz - 0.6, tx + 1.2, CURB + 0.95, tz + 0.6, 'stall');
      world.stalls.push({ x: tx, z: tz });
    }
    // grind rails along the main aisle
    const mx = (ix0 + ix1) / 2;
    for (const side of [-1.7, 1.7]) rail(mx + side, iz0 + 9, mx + side, iz0 + 21, 0.85, '#9e9e9e');
    world.marketSpot = { x: mx, z: iz0 + 5, nx: 0, nz: -1 };
  }

  // ---------- motor park ----------
  function buildMotorpark(r) {
    const ix0 = r.x0 + WALK, ix1 = r.x1 - WALK, iz0 = r.z0 + WALK, iz1 = r.z1 - WALK;
    for (let k = 0; k < 6; k++) world.parked.push({ type: 'danfo', x: ix0 + 8 + k * 6.5, z: iz0 + 12, yaw: 0 });
    for (let k = 0; k < 5; k++) world.parked.push({ type: 'danfo', x: ix0 + 10 + k * 7, z: iz0 + 24, yaw: Math.PI });
    // zinc shed on posts
    const sx = ix1 - 16, sz = iz1 - 14, sw = 12, sd = 7;
    for (const [px, pz] of <any[]>[[0, 0], [sw, 0], [0, sd], [sw, sd]]) { B.metal.cyl(0.08, 0.08, 3.4, { p: [sx + px, CURB + 1.7, sz + pz] }, '#555'); S.add(sx + px - 0.1, 0, sz + pz - 0.1, sx + px + 0.1, CURB + 3.3, sz + pz + 0.1, 'post'); }
    B.metal.box(sw + 1, 0.1, sd + 1, { p: [sx + sw / 2, CURB + 3.45, sz + sd / 2], r: [0.06, 0, 0] }, '#8b7a66');
    S.add(sx - 0.5, CURB + 3.2, sz - 0.5, sx + sw + 0.5, CURB + 3.5, sz + sd + 0.5, 'shed');
    for (let k = 0; k < 3; k++) { B.misc.box(3, 0.45, 0.5, { p: [sx + 2 + k * 4, CURB + 0.23, sz + 3.5] }, '#6d4c41'); S.add(sx + 0.5 + k * 4, 0, sz + 3.25, sx + 3.5 + k * 4, CURB + 0.45, sz + 3.75, 'bench'); }
    ramp(ix0 + 6, iz1 - 10, 'x', 1, 2.6, 1.6, 0.75);
    ramp(ix0 + 16, iz1 - 6, 'x', -1, 2.6, 1.6, 0.75);
    world.motorparkSpot = { x: sx + sw / 2, z: sz - 3, nx: 0, nz: -1 };
  }

  // ---------- pitch / skate spot ----------
  function buildPitch(r) {
    const ix0 = r.x0 + WALK, ix1 = r.x1 - WALK, iz0 = r.z0 + WALK, iz1 = r.z1 - WALK;
    const cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
    for (const gz of [iz0 + 2, iz1 - 2]) {
      for (const dx of [-3.6, 3.6]) { B.misc.cyl(0.07, 0.07, 2.4, { p: [cx + dx, CURB + 1.2, gz] }, '#eeeeee'); S.add(cx + dx - 0.08, 0, gz - 0.08, cx + dx + 0.08, CURB + 2.4, gz + 0.08, 'post'); }
      B.misc.cyl(0.07, 0.07, 7.2, { p: [cx, CURB + 2.4, gz], r: [0, 0, Math.PI / 2] }, '#eeeeee');
    }
    ramp(cx - 12, cz - 8, 'x', 1, 3, 2, 0.9);
    ramp(cx + 9, cz - 8, 'x', -1, 3, 2, 0.9);
    ramp(cx - 4, cz + 10, 'z', -1, 3, 2.2, 1.1);
    ramp(cx + 14, cz + 6, 'z', 1, 2.5, 1.6, 0.7);
    rail(cx - 10, cz + 2, cx + 2, cz + 2, 0.7, '#b0bec5');
    rail(cx + 6, cz - 2, cx + 6, cz + 12, 0.6, '#b0bec5');
    // concrete ledge (grind its edge)
    B.misc.box(8, 0.5, 1.2, { p: [cx - 14, CURB + 0.25, cz + 12] }, '#9e9a90');
    S.add(cx - 18, 0, cz + 11.4, cx - 10, CURB + 0.5, cz + 12.6, 'ledge');
    world.rails.push({ a: [cx - 18, CURB + 0.5, cz + 11.45], b: [cx - 10, CURB + 0.5, cz + 11.45] });
    world.pitchCenter = { x: cx, z: cz };
  }

  function rail(x0, z0, x1, z1, h, c) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    B.metal.cyl(0.05, 0.05, L, { p: [(x0 + x1) / 2, CURB + h, (z0 + z1) / 2], r: [Math.PI / 2, yaw, 0] }, c, 8);
    const n = Math.max(2, Math.round(L / 3));
    for (let k = 0; k <= n; k++) { const t = k / n; B.metal.cyl(0.04, 0.04, h, { p: [x0 + dx * t, CURB + h / 2, z0 + dz * t] }, '#555', 6); }
    world.rails.push({ a: [x0, CURB + h, z0], b: [x1, CURB + h, z1] });
    S.add(Math.min(x0, x1) - 0.05, 0, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, CURB + h, Math.max(z0, z1) + 0.05, 'rail');
  }

  // (x,z) is the low end, centred across the ramp
  function ramp(x, z, axis, sign, len, width, h) {
    const yaw = axis === 'x' ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? -Math.PI / 2 : Math.PI / 2);
    B.misc.add(wedge, { p: [x, CURB, z], ry: yaw, s: [len, h, width] }, '#8d6e4c');
    const ax = axis === 'x', x0 = ax ? Math.min(x, x + sign * len) : x - width / 2, x1 = ax ? Math.max(x, x + sign * len) : x + width / 2;
    const z0 = ax ? z - width / 2 : Math.min(z, z + sign * len), z1 = ax ? z + width / 2 : Math.max(z, z + sign * len);
    col.ramps.push({ x0, x1, z0, z1, axis, sign, h, base: CURB });
  }

  // ---------- road medians (grindable ledges) ----------
  const MED = 3;
  for (let k = 0; k < N; k++) {
    // along x on the central east-west road, along z on the central north-south road
    for (const alongX of [true, false]) {
      const c = roadLine(3), a = roadLine(k) + ROAD / 2 + 3, b = roadLine(k + 1) - ROAD / 2 - 3;
      const segs = Math.round((b - a) / 2);
      for (let s = 0; s < segs; s++) {
        const p0 = a + ((b - a) * s) / segs, p1 = a + ((b - a) * (s + 1)) / segs, pm = (p0 + p1) / 2;
        const cc = s % 2 ? '#1f1f1f' : '#e0c030';
        if (alongX) B.misc.box(p1 - p0, 0.8, 0.5, { p: [pm, 0.4, c] }, cc); else B.misc.box(0.5, 0.8, p1 - p0, { p: [c, 0.4, pm] }, cc);
      }
      if (alongX) { S.add(a, 0, c - 0.25, b, 0.8, c + 0.25, 'median'); world.rails.push({ a: [a, 0.8, c], b: [b, 0.8, c] }); }
      else { S.add(c - 0.25, 0, a, c + 0.25, 0.8, b, 'median'); world.rails.push({ a: [c, 0.8, a], b: [c, 0.8, b] }); }
    }
  }
  void MED;

  // ---------- street lights ----------
  const poolGeo = G.pool;
  function streetlight(x, z, ax, az) { // (ax, az): unit vector from pole toward the road
    const working = R() > 0.16;
    B.metal.cyl(0.09, 0.12, 7.4, { p: [x, CURB + 3.7, z] }, '#4a4d50', 8);
    B.metal.box(0.08, 0.08, 1.8, { p: [x + ax * 0.9, CURB + 7.3, z + az * 0.9], ry: ax !== 0 ? Math.PI / 2 : 0 }, '#4a4d50');
    const hx = x + ax * 1.7, hz = z + az * 1.7;
    (working ? B.lamp : B.misc).box(0.55, 0.14, 0.3, { p: [hx, CURB + 7.2, hz], ry: ax !== 0 ? Math.PI / 2 : 0 }, working ? '#ffffff' : '#3a3a3a');
    S.add(x - 0.13, 0, z - 0.13, x + 0.13, CURB + 7.4, z + 0.13, 'pole');
    if (working) {
      const r = 7.5;
      poolGeo.flat(hx - r, hz - r, hx + r, hz + r, 0.06, white, 1, [0, 0, 1, 1]);
      world.lights.push({ x: hx, y: CURB + 7.0, z: hz });
    }
  }
  for (let j = 0; j <= N; j++) for (let i = I0; i < I1; i++) { // along x
    const c = roadLine(j), a = roadLine(i) + ROAD / 2 + 4, b = roadLine(i + 1) - ROAD / 2 - 4, off = ROAD / 2 + 0.6, sp = district(i) === 'mushin' ? 28 : 21;
    let k = 0;
    for (let t = a; t <= b; t += sp, k++) { const side = k % 2 ? 1 : -1; streetlight(t, c + side * off, 0, -side); }
  }
  for (let i = I0; i <= I1; i++) for (let j = 0; j < N; j++) { // along z
    const c = roadLine(i), a = roadLine(j) + ROAD / 2 + 4, b = roadLine(j + 1) - ROAD / 2 - 4, off = ROAD / 2 + 0.6, sp = district(Math.min(i, I1 - 1)) === 'mushin' ? 28 : 21;
    let k = 1;
    for (let t = a + 10; t <= b; t += sp, k++) { const side = k % 2 ? 1 : -1; streetlight(c + side * off, t, -side, 0); }
  }

  // ---------- potholes ----------
  for (let k = 0; k < 40; k++) {
    const alongX = R() < 0.5, line = roadLine(Math.floor(R() * (N + 1))), t = -HALF + 10 + R() * (N * CELL - 20);
    const x = alongX ? t : line + (R() - 0.5) * 9, z = alongX ? line + (R() - 0.5) * 9 : t;
    if (!isRoad(x, z)) continue;
    const r = 0.6 + R() * 0.7;
    G.hole.flat(x - r, z - r * 0.8, x + r, z + r * 0.8, 0.03, white, 1, [0, 0, 1, 1]);
    world.potholes.push({ x, z, r: r * 0.75 });
  }

  // ---------- transformers ----------
  const TF: any[] = [[1, 2], [3, 4], [4, 1], [2, 5], [5, 3], [7, 1], [9, 4], [-2, 3], [-4, 1], [-5, 5]];
  for (const [i, j] of TF) {
    const x = roadLine(i) + ROAD / 2 + 1.2, z = roadLine(j) + ROAD / 2 + 1.2;
    for (const [px, pz] of <any[]>[[0, 0], [1.6, 0]]) B.metal.cyl(0.1, 0.12, 5.2, { p: [x + px, CURB + 2.6, z + pz] }, '#5d5d5d', 8);
    B.metal.box(2.2, 0.12, 1.2, { p: [x + 0.8, CURB + 2.5, z] }, '#444');
    B.misc.box(1.1, 1.3, 0.9, { p: [x + 0.8, CURB + 3.2, z] }, '#78807a');
    for (let f = -2; f <= 2; f++) B.metal.box(0.04, 1.0, 1.0, { p: [x + 0.8 + f * 0.18, CURB + 3.2, z] }, '#5f6660');
    for (const bx of [-0.3, 0, 0.3]) B.misc.cyl(0.05, 0.08, 0.5, { p: [x + 0.8 + bx, CURB + 4.1, z] }, '#6d4c41', 6);
    B.misc.box(0.5, 0.35, 0.03, { p: [x + 0.8, CURB + 1.6, z + 0.14] }, '#fdd835');
    S.add(x - 0.15, 0, z - 0.15, x + 0.15, CURB + 5.2, z + 0.15, 'pole');
    S.add(x + 1.45, 0, z - 0.15, x + 1.75, CURB + 5.2, z + 0.15, 'pole');
    S.add(x - 0.3, CURB + 2.4, z - 0.6, x + 1.9, CURB + 3.85, z + 0.6, 'transformer');
    world.transformers.push({ x: x + 0.8, z: z + 0.9, cool: 0 });
  }


  // ---------- Third Mainland Bridge, the lagoon, Lagos Island ----------
  world.mapRects = [];
  const B0 = BRIDGE, BH = B0.half, DY = B0.deckY;
  // approach road through the ring
  { const za = BRIDGE.z0, zb = -HALF - ROAD / 2; G.road.face([0, 0, (za + zb) / 2], [ROAD / 2, 0, 0], [0, 0, -(zb - za) / 2], [0, 1, 0], [0, -zb / 12, 1, -za / 12], white); }
  // concrete ramps (solid wedges) with a road surface on top
  const rampSurf = (zLow, zHigh) => {
    const L = Math.abs(zHigh - zLow), zc = (zLow + zHigh) / 2, dir = Math.sign(zHigh - zLow);
    const n = new THREE.Vector3(0, L, -dir * DY).normalize();
    G.road.face([0, DY / 2 + 0.03, zc], [BH, 0, 0].map(v => v * (dir < 0 ? 1 : -1)), [0, DY / 2, (zHigh - zLow) / 2], [n.x, n.y, n.z], [0, 0, 1.33, L / 12], white);
  };
  B.misc.add(wedge, { p: [0, 0, B0.z0], ry: Math.PI / 2, s: [B0.rampLen, DY, BH * 2] }, '#8f8a80');
  col.ramps.push({ x0: -BH, x1: BH, z0: B0.deck0, z1: B0.z0, axis: 'z', sign: -1, h: DY, base: 0 });
  rampSurf(B0.z0, B0.deck0);
  B.misc.add(wedge, { p: [0, 0, B0.z1], ry: -Math.PI / 2, s: [B0.rampLen, DY, BH * 2] }, '#8f8a80');
  col.ramps.push({ x0: -BH, x1: BH, z0: B0.z1, z1: B0.deck1, axis: 'z', sign: 1, h: DY, base: 0 });
  rampSurf(B0.z1, B0.deck1);
  // deck
  B.misc.box(BH * 2, 0.7, B0.deck0 - B0.deck1, { p: [0, DY - 0.35, (B0.deck0 + B0.deck1) / 2] }, '#8f8a80');
  { const za = B0.deck1, zb = B0.deck0; G.road.face([0, DY + 0.01, (za + zb) / 2], [BH, 0, 0], [0, 0, -(zb - za) / 2], [0, 1, 0], [0, -zb / 12, 1.33, -za / 12], white); }
  S.add(-BH, DY - 0.7, B0.deck1, BH, DY, B0.deck0, 'deck');
  // centre median (grind it) and side barriers with a steel rail on top (grind those too)
  for (let z = B0.deck1 + 6; z < B0.deck0 - 6; z += 4) B.misc.box(0.5, 0.75, 3.9, { p: [0, DY + 0.375, z + 2] }, Math.round(z / 4) % 2 ? '#1f1f1f' : '#e0c030');
  S.add(-0.25, DY, B0.deck1 + 6, 0.25, DY + 0.75, B0.deck0 - 6, 'median');
  world.rails.push({ a: [0, DY + 0.75, B0.deck0 - 6], b: [0, DY + 0.75, B0.deck1 + 6] });
  for (const sx of [-1, 1]) {
    const x = sx * (BH - 0.25);
    B.misc.box(0.4, 0.9, B0.deck0 - B0.deck1, { p: [x, DY + 0.45, (B0.deck0 + B0.deck1) / 2] }, '#a9a398');
    B.metal.cyl(0.07, 0.07, B0.deck0 - B0.deck1, { p: [x, DY + 1.15, (B0.deck0 + B0.deck1) / 2], r: [Math.PI / 2, 0, 0] }, '#9aa0a6', 6);
    for (let z = B0.deck1; z <= B0.deck0; z += 6) B.metal.cyl(0.04, 0.04, 0.3, { p: [x, DY + 1.0, z] }, '#777', 5);
    S.add(x - 0.25, DY - 1, B0.deck1, x + 0.25, DY + 1.2, B0.deck0, 'railing');
    world.rails.push({ a: [x, DY + 1.2, B0.deck0 - 1], b: [x, DY + 1.2, B0.deck1 + 1] });
  }
  // piers
  for (let z = B0.deck1 + 10; z < B0.deck0; z += 38) {
    for (const x of [-4.5, 4.5]) B.misc.cyl(0.9, 1.1, DY + 3, { p: [x, DY / 2 - 2.2, z] }, '#6f6a62', 10);
    B.misc.box(BH * 2 - 1, 0.9, 1.6, { p: [0, DY - 1.1, z] }, '#6f6a62');
  }
  // lamps on alternating sides
  { let k = 0; for (let z = B0.deck1 + 12; z < B0.deck0 - 5; z += 32, k++) {
    const sx = k % 2 ? 1 : -1, x = sx * (BH - 0.25);
    B.metal.cyl(0.09, 0.12, 8, { p: [x, DY + 4, z] }, '#4a4d50', 8);
    B.metal.box(0.08, 0.08, 1.8, { p: [x - sx * 0.9, DY + 7.9, z], ry: Math.PI / 2 }, '#4a4d50');
    B.lamp.box(0.55, 0.14, 0.3, { p: [x - sx * 1.7, DY + 7.8, z], ry: Math.PI / 2 }, '#ffffff');
    const hx = x - sx * 1.7, r = 7.5;
    G.pool.flat(hx - r, z - r, hx + r, z + r, DY + 0.06, white, 1, [0, 0, 1, 1]);
    world.lights.push({ x: hx, y: DY + 7.6, z });
    S.add(x - 0.12, DY, z - 0.12, x + 0.12, DY + 8, z + 0.12, 'pole');
  } }
  world.mapRects.push({ x0: -BH, z0: B0.z1, x1: BH, z1: B0.z0, color: '#6d7180' }, { x0: -ROAD / 2, z0: B0.z0, x1: ROAD / 2, z1: -HALF, color: '#5d6170' });

  // far shores: Lagos Island / Ikoyi lights across the lagoon, and the mainland to the west
  for (let k = 0; k < 26; k++) {
    const east = k % 2 === 0, x = (east ? 640 : -700) + (east ? 1 : -1) * R() * 260, z = (east ? -520 : -380) - R() * 800;
    const w = 18 + R() * 30, d = 18 + R() * 30;
    addBuilding(x, z, x + w, z + d, 4 + Math.floor(R() * (east ? 16 : 6)), pick(PAINT), false, [east ? -1 : 1, 0], false);
    B.misc.box(w, 1.4, d, { p: [x + w / 2, -0.55, z + d / 2] }, '#2a2622');
  }

  // ---------- Lagos Island: the bridge comes down at the Adeniji Adele interchange ----------
  // (the real Third Mainland Bridge runs 11.8 km from Oworonshoki to Adeniji Adele on Lagos Island)
  const C = CAMPUS;
  world.extraMeshes ||= [];
  const sign3 = (text, bg, fg, w, h, x, y, z, ry = 0, sub?: string) => {
    const t = T.textSign(text, bg, fg, 1024, 150, sub);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.45 }));
    m.position.set(x, y, z); m.rotation.y = ry; world.extraMeshes.push(m); return m;
  };
  G.walk.flat(C.x0 - 30, C.z0 - 30, C.x1 + 30, C.z1, 0.004, color('#6e6a62'), 4);            // paving everywhere: the Island is all concrete
  const ISL_ROADS: any[] = [[-6, C.z0 + 6, 6, C.z1], [C.x0 + 8, -1296, C.x1 - 8, -1284], [C.x0 + 8, -1376, C.x1 - 8, -1366], [-96, C.z0 + 8, -88, C.z1 - 6], [88, C.z0 + 8, 96, C.z1 - 6]];
  for (const [x0, z0, x1, z1] of ISL_ROADS) { G.asphalt.flat(x0, z0, x1, z1, 0.012, white, 12); world.mapRects.push({ x0, z0, x1, z1, color: '#5d6170' }); }
  world.mapRects.push({ x0: C.x0, z0: C.z0, x1: C.x1, z1: C.z1, color: '#2c2e36' });
  // the interchange gantry where the bridge lands
  const GZ = -1162;
  for (const x of [-9.5, 9.5]) { B.metal.cyl(0.25, 0.3, 7.6, { p: [x, 3.8, GZ] }, '#6b7076', 8); S.add(x - 0.3, 0, GZ - 0.3, x + 0.3, 7.6, GZ + 0.3, 'gate'); }
  B.metal.box(20, 0.5, 0.5, { p: [0, 7.4, GZ] }, '#6b7076');
  sign3('WELCOME TO LAGOS ISLAND', '#1b5e20', '#ffffff', 11, 1.8, -4.2, 6.2, GZ + 0.3, 0, 'ADENIJI ADELE INTERCHANGE');
  sign3('← IDUMOTA · BALOGUN', '#1b5e20', '#ffffff', 7.5, 1.3, 5.2, 6.2, GZ + 0.3, 0);
  sign3('OBALENDE · CMS · MARINA →', '#1b5e20', '#ffffff', 7.5, 1.3, 5.2, 4.9, GZ + 0.3, 0);
  world.gate = { x: 0, z: GZ };
  // dense old Island blocks between the roads, with a few towers toward Marina (east)
  const inRoad = (x0, z0, x1, z1) => ISL_ROADS.some(([a, b, c, d]) => x1 > a - 3 && x0 < c + 3 && z1 > b - 3 && z0 < d + 3);
  const islB: any[] = [];
  for (let z = C.z0 + 10; z < C.z1 - 26; z += 26) for (let x = C.x0 + 10; x < C.x1 - 10; x += 22) {
    const w = 15 + R() * 5, d = 17 + R() * 6, x0 = x, z0 = z, x1 = x + w, z1 = z + d;
    if (inRoad(x0, z0, x1, z1) || (Math.abs(x0 + w / 2) < 24 && z1 > -1215)) continue; // keep the landing open
    const tower = x0 > 30 && R() < 0.3, fl = tower ? 9 + Math.floor(R() * 10) : 3 + Math.floor(R() * 4);
    addBuilding(x0, z0, x1, z1, fl, pick(PAINT), R() < 0.4, [0, 1], false);
    world.mapRects.push({ x0, z0, x1, z1, color: '#3a3e4a' }); islB.push({ x0, z0, x1, z1 });
  }
  // Idumota-style market along Adeniji Adele Road: stalls, umbrellas, goods
  world.island = { hangouts: [] };
  for (let x = C.x0 + 14; x < C.x1 - 14; x += 3.4) {
    if (Math.abs(x) < 16 || Math.abs(x + 92) < 5 || Math.abs(x - 92) < 5) continue;
    for (const side of [-1, 1]) {
      const z = side < 0 ? -1300.5 : -1279.5;
      B.misc.box(2.2, 0.9, 1.2, { p: [x, 0.45, z] }, pick(['#6d4c41', '#8d6e63', '#5d4037']));
      B.misc.box(2.0, 0.25, 1.0, { p: [x, 1.02, z] }, pick(['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#f5f5f5']));
      B.misc.cyl(0.03, 0.03, 2.2, { p: [x, 1.9, z] }, '#bbb', 4);
      B.misc.cyl(1.3, 0.05, 0.35, { p: [x, 3.0, z] }, pick(['#e53935', '#1e88e5', '#fdd835', '#43a047', '#ffffff']), 10);
      S.add(x - 1.1, 0, z - 0.6, x + 1.1, 1.2, z + 0.6, 'stall');
      if (R() < 0.6) world.island.hangouts.push({ x: x + (R() - 0.5) * 1.5, z: z - side * 1.2 });
    }
  }
  sign3('IDUMOTA MARKET', '#b71c1c', '#fff59d', 9, 1.5, -60, 4.2, -1303.2, 0);
  sign3('BALOGUN · TRADE FAIR', '#0d47a1', '#ffffff', 9, 1.5, 60, 4.2, -1303.2, 0);
  // a danfo park by the landing: "Obalende! CMS! Oshodi!"
  for (let k = 0; k < 3; k++) world.parked.push({ type: 'danfo', x: -30 - k * 6.5, z: -1225, yaw: Math.PI / 2 });
  for (let k = 0; k < 14; k++) world.island.hangouts.push({ x: -38 + (k % 7) * 2.8, z: -1219 - Math.floor(k / 7) * 2 });
  { let k = 0; for (let z = C.z1 - 30; z > C.z0 + 12; z -= 17, k++) if (k % 2 === 0) { streetlight(-8.4, z - 4, 1, 0); streetlight(8.4, z - 12, -1, 0); } }
  B.misc.box(C.x1 - C.x0, 0.6, 0.4, { p: [0, 0.3, C.z1 + 0.2] }, '#9a958b'); // lagoon-front wall

  // ---------- seen from the bridge: Makoko on its stilts, and UNILAG on the far shore ----------
  // Makoko: the fishing settlement built on stilts in the lagoon, beside the mainland end of the bridge
  world.makoko = { x: -95, z: -560 };
  for (let k = 0; k < 70; k++) {
    const x = -40 - R() * 130, z = -430 - R() * 280, w = 3 + R() * 2.5, d = 3 + R() * 2.5, h = 2.2 + R() * 0.8;
    if (Math.abs(x) < 20) continue;
    B.misc.box(w, h, d, { p: [x, 0.9 + h / 2, z] }, pick(['#6d5c4a', '#5d4a3a', '#7a6650', '#4e4034']));
    B.metal.box(w + 0.6, 0.08, d + 0.6, { p: [x, 0.95 + h + 0.05, z], r: [0, 0, (R() - 0.5) * 0.12] }, pick(['#8b7a66', '#6f6a62', '#9c8870']));
    if (R() < 0.45) B.lamp.box(0.5, 0.45, 0.05, { p: [x + (R() - 0.5) * w * 0.5, 0.9 + h * 0.55, z + d / 2 + 0.03] }, pick(['#ffffff', '#ffe0a0'])); // kerosene lamps in the windows
    for (const [sx, sz] of <any[]>[[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.misc.cyl(0.07, 0.07, 1.5, { p: [x + sx * w * 0.4, 0.3, z + sz * d * 0.4] }, '#3e2f24', 4);
    if (R() < 0.35) B.misc.box(0.7, 0.18, 3.4, { p: [x + w * 0.7, -0.3, z + (R() - 0.5) * 3], ry: R() * 3 }, '#4e342e'); // a canoe
  }
  // (UNILAG itself is now on the shore beside Yaba: see buildUNILAG)
  world.raceStart = { x: 0, z: -HALF - ROAD / 2 - 14 };
  world.raceEnd = { x: 0, z: GZ + 6 };


  // ---------- Ojuelegba flyover (the Red Caps live underneath) ----------
  {
    const F = FLY, x0 = F.x - F.half, x1 = F.x + F.half, za = -HALF - 40, zb = HALF + 40;
    B.misc.box(F.half * 2, 0.6, zb - za, { p: [F.x, F.y - 0.3, (za + zb) / 2] }, '#8a857b');
    G.road.face([F.x, F.y + 0.01, (za + zb) / 2], [F.half, 0, 0], [0, 0, -(zb - za) / 2], [0, 1, 0], [0, -zb / 12, 1.17, -za / 12], white);
    S.add(x0, F.y - 0.6, za, x1, F.y, zb, 'deck');
    // side barriers with a steel rail (grindable); a gap on the east side where the stair ramp arrives
    const RZ = roadLine(3) + ROAD / 2 + 8, RL = 26; // stair ramp in block (4,3): rises toward +z
    for (const sx of [-1, 1]) {
      const x = F.x + sx * (F.half - 0.2);
      const segs = sx > 0 ? [[za, RZ + RL - 0.5], [RZ + RL + 3.5, zb]] : [[za, zb]];
      for (const [a, b] of segs) {
        B.misc.box(0.35, 0.9, b - a, { p: [x, F.y + 0.45, (a + b) / 2] }, '#a39d92');
        B.metal.cyl(0.06, 0.06, b - a, { p: [x, F.y + 1.05, (a + b) / 2], r: [Math.PI / 2, 0, 0] }, '#8f959a', 6);
        S.add(x - 0.2, F.y - 1, a, x + 0.2, F.y + 1.1, b, 'railing');
        world.rails.push({ a: [x, F.y + 1.1, a + 1], b: [x, F.y + 1.1, b - 1] });
      }
    }
    // pillars (not on the roads, not on the pitch)
    for (let z = za + 8; z < zb - 4; z += 16) {
      if (isRoad(F.x + 20, z) || Math.abs(z) > HALF + 30) continue;
      const pb = blockRect(4, Math.floor((z + HALF) / CELL));
      if (blockType(4, Math.floor((z + HALF) / CELL)) === 'pitch' && z > pb.z0 && z < pb.z1) continue;
      for (const dx of [-4.5, 4.5]) { B.misc.box(1.3, F.y, 1.3, { p: [F.x + dx, F.y / 2, z] }, '#7d786f'); S.add(F.x + dx - 0.65, 0, z - 0.65, F.x + dx + 0.65, F.y, z + 0.65, 'pillar'); }
      B.misc.box(F.half * 2 - 1, 0.8, 1.4, { p: [F.x, F.y - 1, z] }, '#7d786f');
    }
    // stair ramp up from the ground on the east side
    B.misc.add(wedge, { p: [x1 + 1.6, CURB, RZ], ry: -Math.PI / 2, s: [RL, F.y - CURB, 3.2] }, '#6f6a62');
    col.ramps.push({ x0: x1, x1: x1 + 3.2, z0: RZ, z1: RZ + RL, axis: 'z', sign: 1, h: F.y - CURB, base: CURB });
    S.add(x1 - 0.1, F.y - 0.6, RZ + RL - 0.5, x1 + 3.2, F.y, RZ + RL + 3.5, 'deck'); // landing
    B.misc.box(3.3, 0.6, 4, { p: [x1 + 1.6, F.y - 0.3, RZ + RL + 1.5] }, '#8a857b');
    // lamps
    let k = 0;
    for (let z = za + 20; z < zb - 20; z += 30, k++) {
      const sx = k % 2 ? 1 : -1, x = F.x + sx * (F.half - 0.2), hx = x - sx * 1.7;
      B.metal.cyl(0.09, 0.12, 7, { p: [x, F.y + 3.5, z] }, '#4a4d50', 8);
      B.metal.box(0.08, 0.08, 1.8, { p: [x - sx * 0.9, F.y + 6.9, z], ry: Math.PI / 2 }, '#4a4d50');
      if (R() < 0.75) { B.lamp.box(0.55, 0.14, 0.3, { p: [hx, F.y + 6.8, z], ry: Math.PI / 2 }, '#ffffff'); G.pool.flat(hx - 7, z - 7, hx + 7, z + 7, F.y + 0.06, white, 1, [0, 0, 1, 1]); world.lights.push({ x: hx, y: F.y + 6.6, z }); }
    }
    // broken-down trucks up on the deck
    for (const z of [-120, 30, 150]) { B.misc.box(2.4, 2.6, 7, { p: [F.x - 3, F.y + 1.5, z] }, pick(['#6d4c41', '#37474f', '#8d6e63'])); S.add(F.x - 4.2, F.y, z - 3.5, F.x - 1.8, F.y + 2.8, z + 3.5, 'wreck'); }
    // "OJUELEGBA" sign on the side
    world.mapRects.push({ x0, z0: -HALF - 6, x1, z1: HALF + 6, color: '#70758a' });
    // under the bridge: dirt, shacks and fire barrels in every block along it
    world.underBridge = [];
    for (let bj = 0; bj < N; bj++) {
      const r = blockRect(4, bj); if (blockType(4, bj) === 'pitch') continue;
      const u0 = F.x - F.clear + 0.5, u1 = F.x + F.clear - 0.5, v0 = r.z0 + WALK, v1 = r.z1 - WALK;
      G.dirt.flat(u0, v0, u1, v1, CURB + 0.006, color('#4a3f33'), 6);
      world.underBridge.push({ bj, x0: u0, x1: u1, z0: v0, z1: v1, cx: F.x, cz: (v0 + v1) / 2 });
      for (let n = 0; n < 3; n++) { // shacks against the edges
        const side = n % 2 ? 1 : -1, sz = v0 + 8 + R() * (v1 - v0 - 16), sw = 3 + R() * 2;
        const sx = F.x + side * (F.clear - 2.2);
        B.misc.box(3.2, 2.4, sw, { p: [sx, CURB + 1.2, sz] }, pick(['#6d5c4a', '#5c6770', '#7a5a3a']));
        B.metal.box(3.6, 0.08, sw + 0.4, { p: [sx, CURB + 2.5, sz], r: [0, 0, side * 0.12] }, '#8b7a66');
        S.add(sx - 1.6, 0, sz - sw / 2, sx + 1.6, CURB + 2.5, sz + sw / 2, 'shack');
      }
      for (let n = 0; n < 2; n++) fireBarrel(F.x + (R() - 0.5) * 8, v0 + 6 + R() * (v1 - v0 - 12));
    }
  }
  function fireBarrel(x, z) {
    B.metal.cyl(0.32, 0.3, 0.9, { p: [x, CURB + 0.45, z] }, '#3b3530', 10);
    B.lamp.cyl(0.26, 0.26, 0.06, { p: [x, CURB + 0.9, z] }, '#ffffff', 8);
    G.pool.flat(x - 4, z - 4, x + 4, z + 4, CURB + 0.03, white, 1, [0, 0, 1, 1]);
    S.add(x - 0.32, 0, z - 0.32, x + 0.32, CURB + 0.9, z + 0.32, 'barrel');
    (world.fires ||= []).push({ x, z });
  }


  // ---------- the National Stadium, Surulere (opened 1972; decaying since the early 2000s) ----------
  {
    const SX = 170, SZ = 336, AX = 1.35, R0 = 44, TIERS = 16, TW = 0.8, TH = 0.45, R1 = R0 + TIERS * TW;
    const GR = { x0: 62, x1: 262, z0: HALF + ROAD / 2, z1: 430 };
    const toCircle = (x, z) => { const dx = (x - SX) / AX, dz = z - SZ; return [Math.hypot(dx, dz), Math.atan2(dz, dx)]; };
    const GATES = [0, Math.PI / 2, Math.PI, -Math.PI / 2], GAP = 0.09;
    const inGap = a => GATES.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < GAP);
    // grounds: cracked concrete, a patch of car park asphalt
    G.dirt.flat(GR.x0, GR.z0, GR.x1, GR.z1, 0.004, color('#8a8378'), 8);
    G.asphalt.flat(SX - 60, GR.z0 + 4, SX + 60, SZ - R1 - 4, 0.01, white, 12);
    // the stepped concrete bowl (lathe profile, stretched into an ellipse), split by four entrance tunnels
    const prof = [new THREE.Vector2(R0, 0)];
    for (let k = 0; k < TIERS; k++) { prof.push(new THREE.Vector2(R0 + k * TW, (k + 1) * TH), new THREE.Vector2(R0 + (k + 1) * TW, (k + 1) * TH)); }
    prof.push(new THREE.Vector2(R1, TIERS * TH + 1.1), new THREE.Vector2(R1 + 0.4, TIERS * TH + 1.1), new THREE.Vector2(R1 + 0.4, 0));
    const concrete = new THREE.MeshStandardMaterial({ color: '#9a958a', roughness: 1, side: THREE.DoubleSide });
    const seats = new THREE.MeshStandardMaterial({ color: '#4a7a55', roughness: 0.9, side: THREE.DoubleSide });
    for (let g = 0; g < 4; g++) {
      const a0 = GATES[g] + GAP, len = Math.PI / 2 - 2 * GAP;
      // three.js lathes sweep from +z; convert our x-z angle to theirs
      const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 24, Math.PI / 2 - a0 - len, len), concrete);
      bowl.scale.set(AX, 1, 1); bowl.position.set(SX, 0, SZ); bowl.castShadow = bowl.receiveShadow = true; scene.add(bowl);
      const sprof: any[] = []; for (let k = 2; k < TIERS; k += 2) sprof.push(new THREE.Vector2(R0 + k * TW + 0.05, (k + 1) * TH + 0.02), new THREE.Vector2(R0 + k * TW + 0.35, (k + 1) * TH + 0.14));
      for (let k = 0; k + 1 < sprof.length; k += 2) { const sm = new THREE.Mesh(new THREE.LatheGeometry([sprof[k], sprof[k + 1]], 24, Math.PI / 2 - a0 - len, len), seats); sm.scale.set(AX, 1, 1); sm.position.set(SX, 0, SZ); scene.add(sm); }
    }
    // walkable steps: a height field over the stands, open at the tunnels
    col.fields.push((x, z) => {
      if (x < SX - AX * R1 - 1 || x > SX + AX * R1 + 1 || z < SZ - R1 - 1 || z > SZ + R1 + 1) return null;
      const [r, a] = toCircle(x, z);
      if (r < R0 || r > R1 + 0.4 || inGap(a)) return null;
      return Math.min(TIERS, Math.floor((r - R0) / TW) + 1) * TH;
    });
    // outer wall so you can't walk into the stands from outside (climb it instead)
    for (let k = 0; k < 64; k++) {
      const a = (k + 0.5) / 64 * Math.PI * 2; if (GATES.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < GAP + 0.07)) continue; // leave the tunnels open
      const x = SX + Math.cos(a) * (R1 + 0.2) * AX, z = SZ + Math.sin(a) * (R1 + 0.2), hw = Math.PI * 2 * (R1 + 0.2) / 64 * 0.5 * (Math.abs(Math.cos(a)) > 0.7 ? AX : 1);
      S.add(x - hw, 0, z - hw, x + hw, TIERS * TH, z + hw, 'stadiumwall');
    }
    // pitch (patchy, overgrown), goals, red running track
    const pitchMat = new THREE.MeshStandardMaterial({ map: T.dirtTexture('#4f7a3a', 57), roughness: 1 });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(100, 64), pitchMat); pitch.rotation.x = -Math.PI / 2; pitch.position.set(SX, 0.02, SZ); pitch.receiveShadow = true; scene.add(pitch);
    for (let k = 0; k < 14; k++) { const pm = new THREE.Mesh(new THREE.CircleGeometry(2 + R() * 5, 10), new THREE.MeshStandardMaterial({ color: '#7a6246', roughness: 1 })); pm.rotation.x = -Math.PI / 2; pm.position.set(SX - 45 + R() * 90, 0.025, SZ - 28 + R() * 56); scene.add(pm); }
    const track = new THREE.Mesh(new THREE.RingGeometry(38, R0, 64), new THREE.MeshStandardMaterial({ color: '#8e3b2a', roughness: 1 }));
    track.rotation.x = -Math.PI / 2; track.scale.set(AX, 1, 1); track.position.set(SX, 0.015, SZ); scene.add(track);
    for (const gx of [SX - 50, SX + 50]) { for (const dz of [-3.7, 3.7]) { B.metal.cyl(0.08, 0.08, 2.44, { p: [gx, 1.22, SZ + dz] }, '#b8a888'); S.add(gx - 0.1, 0, SZ + dz - 0.1, gx + 0.1, 2.44, SZ + dz + 0.1, 'post'); } B.metal.cyl(0.08, 0.08, 7.4, { p: [gx, 2.44, SZ], r: [Math.PI / 2, 0, 0] }, '#b8a888'); }
    // west stand roof canopy on columns
    { const roof = new THREE.Mesh(new THREE.RingGeometry(R0 - 3, R1 + 2, 24, 1, Math.PI - 0.55, 1.1), new THREE.MeshStandardMaterial({ color: '#6f6a62', roughness: 0.9, side: THREE.DoubleSide }));
      roof.rotation.x = -Math.PI / 2; roof.scale.set(AX, 1, 1); roof.position.set(SX, 17, SZ); roof.castShadow = true; scene.add(roof);
      for (let k = 0; k <= 6; k++) { const a = Math.PI - 0.5 + k / 6 * 1.0, x = SX + Math.cos(a) * (R1 + 1) * AX, z = SZ - Math.sin(a) * (R1 + 1); B.misc.box(1.2, 17, 1.2, { p: [x, 8.5, z] }, '#7d786f'); S.add(x - 0.6, 0, z - 0.6, x + 0.6, 17, z + 0.6, 'pillar'); } }
    // floodlight towers: only one still works, and it flickers
    world.floodlight = null;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], k) => {
      const x = SX + sx * (R1 * AX - 4), z = SZ + sz * (R1 - 2);
      B.metal.box(1.2, 36, 1.2, { p: [x, 18, z] }, '#5d6166'); S.add(x - 0.6, 0, z - 0.6, x + 0.6, 36, z + 0.6, 'pole');
      for (let y = 4; y < 36; y += 4) B.metal.box(1.8, 0.1, 0.1, { p: [x, y, z], ry: (y % 8) ? 0.8 : -0.8 }, '#4a4d50');
      const panel = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 0.5), k === 2 ? new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(4), toneMapped: false }) : new THREE.MeshStandardMaterial({ color: '#2b2b2b' }));
      panel.position.set(x, 37.5, z); panel.lookAt(SX, 0, SZ); scene.add(panel);
      if (k === 2) world.floodlight = { panel, x, z };
    });
    // broken scoreboard behind the south stand
    { const t = T.textSign('NATIONAL STADIUM · SURULERE', '#1b5e20', '#f5f5f5', 1024, 140, 'EST. 1972');
      B.misc.box(22, 8, 1.2, { p: [SX, R1 * 0 + 12, SZ + R1 + 5] }, '#2b2b2b'); B.misc.box(1, 12, 1, { p: [SX - 9, 6, SZ + R1 + 5] }, '#5d6166'); B.misc.box(1, 12, 1, { p: [SX + 9, 6, SZ + R1 + 5] }, '#5d6166');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(20, 2.7), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.15 })); m.position.set(SX, 14.5, SZ + R1 + 5.61); world.extraMeshes.push(m);
      const m2 = m.clone(); m2.position.z = SZ + R1 + 4.39; m2.rotation.y = Math.PI; world.extraMeshes.push(m2); }
    // main gate on the road
    { const gz = GR.z0 + 3, t = T.textSign('NATIONAL STADIUM', '#1b5e20', '#ffffff', 1024, 150, 'SURULERE · LAGOS');
      for (const gx of [SX - 9, SX + 9]) { B.misc.box(1.6, 7, 1.6, { p: [gx, 3.5, gz] }, '#e0d8c4'); S.add(gx - 0.8, 0, gz - 0.8, gx + 0.8, 7, gz + 0.8, 'gate'); }
      B.misc.box(20, 1.4, 1.2, { p: [SX, 6.6, gz] }, '#e0d8c4');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.2), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.3 })); m.position.set(SX, 6.6, gz - 0.62); m.rotation.y = Math.PI; world.extraMeshes.push(m);
      world.stadiumGate = { x: SX, z: gz + 3 }; }
    // the drained Olympic pool (closed 1999) and the Indoor Sports Hall
    { const px = SX + 112, pz = SZ - 30;
      B.misc.box(54, 0.5, 25, { p: [px, 0.25, pz] }, '#bdb6a6'); S.add(px - 27, 0, pz - 12.5, px + 27, 0.5, pz + 12.5, 'pooldeck');
      B.misc.box(50, 0.05, 21, { p: [px, 0.52, pz] }, '#6f8f8f');
      for (let k = 0; k < 6; k++) B.misc.box(3 + R() * 6, 0.03, 2 + R() * 4, { p: [px - 20 + R() * 40, 0.56, pz - 8 + R() * 16] }, '#3f5a3a'); // green scum puddles
      B.metal.box(0.8, 3, 0.8, { p: [px - 22, 1.5 + 0.5, pz - 11] }, '#8a8a8a'); B.misc.box(0.6, 0.1, 4, { p: [px - 22, 3.1, pz - 9] }, '#e0e0e0'); // diving board
      const hx = SX + 112, hz = SZ + 34;
      B.misc.box(56, 14, 36, { p: [hx, 7, hz] }, '#cfc6b0'); S.add(hx - 28, 0, hz - 18, hx + 28, 14, hz + 18, 'building', { roof: true });
      B.misc.cyl(18, 18, 56, { p: [hx, 14, hz], r: [0, 0, Math.PI / 2], s: [1, 1, 0.45] }, '#8b8577', 18);
      const t = T.textSign('INDOOR SPORTS HALL', '#37474f', '#fff', 768, 110); const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.7), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.2 })); m.position.set(hx, 10, hz - 18.06); m.rotation.y = Math.PI; world.extraMeshes.push(m); }
    // squatters' shacks along the outer wall, a crusade tent in the car park
    const hang: any[] = [];
    for (let k = 0; k < 12; k++) {
      const a = 0.35 + k * 0.42; if (inGap(a)) continue;
      const x = SX + Math.cos(a) * (R1 + 4) * AX, z = SZ + Math.sin(a) * (R1 + 4);
      B.misc.box(3, 2.3, 3, { p: [x, 1.15, z], ry: a }, pick(['#6d5c4a', '#5c6770', '#7a5a3a'])); B.metal.box(3.4, 0.08, 3.4, { p: [x, 2.35, z], ry: a }, '#8b7a66');
      S.add(x - 1.5, 0, z - 1.5, x + 1.5, 2.4, z + 1.5, 'shack'); hang.push({ x: x + 2, z: z + 1 });
    }
    { const tx = SX - 34, tz = GR.z0 + 26;
      B.misc.box(24, 0.1, 14, { p: [tx, 4.2, tz] }, '#f5f5f5'); for (const [dx, dz] of <any[]>[[-12, -7], [12, -7], [-12, 7], [12, 7]]) B.metal.cyl(0.08, 0.08, 4.2, { p: [tx + dx, 2.1, tz + dz] }, '#bbb');
      B.misc.add(wedge, { p: [tx - 12, 4.2, tz], ry: 0, s: [12, 2.2, 14] }, '#fafafa'); B.misc.add(wedge, { p: [tx + 12, 4.2, tz], ry: Math.PI, s: [12, 2.2, 14] }, '#fafafa');
      for (let rr = 0; rr < 6; rr++) for (let cc = 0; cc < 8; cc++) B.misc.box(0.45, 0.45, 0.45, { p: [tx - 8 + cc * 2.1, 0.23, tz - 4 + rr * 1.5] }, '#e53935');
      B.misc.box(4, 0.9, 1.5, { p: [tx, 0.45, tz - 6] }, '#6d4c41'); // the pulpit
      const t = T.textSign('HOLY GHOST FIRE CRUSADE', '#b71c1c', '#fff59d', 1024, 140, 'NIGHT OF MIRACLES · ALL ARE WELCOME');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.65), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.4 })); m.position.set(tx, 5.2, tz - 7.2); m.rotation.y = Math.PI; world.extraMeshes.push(m);
      for (let k = 0; k < 22; k++) hang.push({ x: tx - 8 + (k % 8) * 2.1, z: tz - 3.4 + Math.floor(k / 8) * 1.5 }); }
    for (let k = 0; k < 4; k++) world.parked.push({ type: 'danfo', x: SX + 20 + k * 6.5, z: GR.z0 + 20, yaw: 0 }); // abandoned buses
    for (let k = 0; k < 6; k++) hang.push({ x: SX - 6 + k * 2.4, z: GR.z0 + 7 }); // traders at the gate
    world.stadium = { x: SX, z: SZ, region: GR, hangouts: hang };
    world.mapRects.push({ x0: GR.x0, z0: GR.z0, x1: GR.x1, z1: GR.z1, color: '#3a3830' }, { x0: SX - R1 * AX, z0: SZ - R1, x1: SX + R1 * AX, z1: SZ + R1, color: '#5a574e' }, { x0: SX - 50, z0: SZ - 32, x1: SX + 50, z1: SZ + 32, color: '#3d5a2e' });
  }

  // ---------- food: suya, akara, mama put, bukka ----------
  world.vendors = [];
  {
    const kinds: any[] = [['SUYA', '#4e342e', 'Suya', 900, 40], ['AKARA', '#f9a825', 'Akara & pap', 500, 25], ['MAMA PUT', '#2e7d32', 'Rice & stew', 1200, 55], ['BUKKA', '#1565c0', 'Amala & ewedu', 1000, 50]];
    const used: any[] = [];
    for (const [label, bg, food, price, fill] of [...kinds, kinds[0], kinds[2]]) {
      let sp = null;
      for (let tries = 0; tries < 200 && !sp; tries++) { const c = world.spots[Math.floor(R() * world.spots.length)]; if ((c.bi === 1 && c.bj === 1) || c.bi === 4 || used.some(u => Math.hypot(u.x - c.x, u.z - c.z) < 90)) continue; sp = c; }
      if (!sp) continue; used.push(sp);
      const ax = -sp.nz, az = sp.nx, x = sp.x + ax * 3, z = sp.z + az * 3;
      B.misc.box(1.4, 0.9, 0.8, { p: [x, CURB + 0.45, z] }, '#5d4037');
      B.metal.box(1.2, 0.05, 0.6, { p: [x, CURB + 0.93, z] }, '#222');
      B.lamp.box(0.9, 0.04, 0.35, { p: [x, CURB + 0.97, z] }, '#ffffff');
      B.metal.cyl(0.03, 0.03, 2.2, { p: [x - 0.6, CURB + 1.1, z] }, '#666');
      B.misc.add(new THREE.ConeGeometry(1.4, 0.5, 8, 1, true), { p: [x - 0.6, CURB + 2.3, z] }, bg);
      G.pool.flat(x - 3, z - 3, x + 3, z + 3, CURB + 0.03, white, 1, [0, 0, 1, 1]);
      S.add(x - 0.7, 0, z - 0.4, x + 0.7, CURB + 0.95, z + 0.4, 'vendor');
      const st = T.textSign(label, bg, '#fff', 512, 120);
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.33), new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 0.6 }));
      sm.position.set(x + sp.nx * 0.42, CURB + 0.6, z + sp.nz * 0.42); sm.rotation.y = Math.atan2(sp.nx, sp.nz); world.extraMeshes.push(sm);
      world.vendors.push({ x: x + sp.nx * 1.3, z: z + sp.nz * 1.3, sx: x - sp.nx * 0.9, sz: z - sp.nz * 0.9, nx: sp.nx, nz: sp.nz, label, food, price, fill });
    }
  }

  // ================= unique places in the new districts =================
  function board(text, bg, fg, w, h, x, y, z, ry = 0, sub, lit = 0.45) {
    world.extraMeshes ||= [];
    const t = T.textSign(text, bg, fg, 1024, 150, sub);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: lit, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; world.extraMeshes.push(m); return m;
  }
  // Tejuosho Market, Yaba: the rebuilt multi-storey shopping complex, phone kiosks out front
  function buildTejuosho(r) {
    // four storeys, cream and light beige with deep grey bands along the structure; wide steps, steel gates, big glass
    const i = WALK + 9, x0 = r.x0 + i, z0 = r.z0 + i, x1 = r.x1 - i - 6, z1 = r.z1 - i;
    addBuilding(x0, z0, x1, z1, 4, '#e9e1cf', true, [0, -1], false, 'yaba');
    for (let f = 1; f <= 4; f++) for (const [cx, cz, w, d] of <any[]>[[(x0 + x1) / 2, z0 - 0.06, x1 - x0 + 0.3, 0.25], [(x0 + x1) / 2, z1 + 0.06, x1 - x0 + 0.3, 0.25], [x0 - 0.06, (z0 + z1) / 2, 0.25, z1 - z0], [x1 + 0.06, (z0 + z1) / 2, 0.25, z1 - z0]])
      B.misc.box(w, 0.35, d, { p: [cx, CURB + f * 3.2 - 0.1, cz] }, '#4b4f55');
    const ex = (x0 + x1) / 2;
    for (let k = 0; k < 4; k++) B.misc.box(16 - k * 1.5, 0.22, 1.1, { p: [ex, CURB + 0.11 + k * 0.22, z0 - 4.3 + k * 1.05] }, '#cfc8b8'); // wide steps up to the gates
    B.lamp.box(12, 5.5, 0.1, { p: [ex, CURB + 3.6, z0 - 0.1] }, '#9fd3ff'); // the glass front of the atrium
    for (let k = -5; k <= 5; k++) B.metal.box(0.08, 2.8, 0.08, { p: [ex + k * 1.1, CURB + 2.2, z0 - 0.3] }, '#5f6368'); // steel security gate
    board('TEJUOSHO MARKET', '#e9e1cf', '#3e4247', 20, 2.8, ex, CURB + 11.2, z0 - 0.14, Math.PI, 'ULTRA-MODERN SHOPPING CENTRE · OJUELEGBA-ITIRE ROAD', 0.4);
    // ramp to the underground car park, west side
    B.misc.box(4.5, 0.2, 10, { p: [x0 - 4, CURB + 0.05, (z0 + z1) / 2], r: [0.12, 0, 0] }, '#3a3a3a'); board('CAR PARK ↓', '#263238', '#ffeb3b', 3, 0.7, x0 - 4, CURB + 2.6, (z0 + z1) / 2 - 5.2, Math.PI, null, 0.6);
    // the overflow outside: clothes racks, second-hand shoes on mats, roasted plantain (boli) and corn on grills
    for (let x = x0; x < x1; x += 4.2) {
      const z = z0 - 7.5, kind = Math.floor((x - x0) / 4.2) % 3;
      if (kind === 0) { B.metal.box(2.4, 0.05, 0.05, { p: [x, CURB + 1.8, z] }, '#9e9e9e'); for (let c = 0; c < 6; c++) B.misc.box(0.35, 0.8, 0.05, { p: [x - 1 + c * 0.4, CURB + 1.35, z] }, pick(['#1565c0', '#fafafa', '#212121', '#c62828', '#2e7d32', '#6d4c41'])); for (const dx of [-1.2, 1.2]) B.metal.cyl(0.03, 0.03, 1.8, { p: [x + dx, CURB + 0.9, z] }, '#9e9e9e', 4); }
      else if (kind === 1) { B.misc.box(2.2, 0.03, 1.4, { p: [x, CURB + 0.02, z] }, '#5d4037'); for (let c = 0; c < 8; c++) B.misc.box(0.28, 0.12, 0.12, { p: [x - 0.9 + (c % 4) * 0.6, CURB + 0.1, z - 0.4 + Math.floor(c / 4) * 0.7] }, pick(['#111', '#6d4c41', '#fafafa', '#8d6e63'])); }
      else { B.metal.box(1.2, 0.7, 0.6, { p: [x, CURB + 0.35, z] }, '#3e2723'); B.lamp.box(1.0, 0.05, 0.45, { p: [x, CURB + 0.72, z] }, '#ffab40'); for (let c = 0; c < 4; c++) B.misc.box(0.14, 0.06, 0.5, { p: [x - 0.35 + c * 0.24, CURB + 0.78, z] }, '#d7a84e'); }
      S.add(x - 1.2, 0, z - 0.7, x + 1.2, CURB + 1.0, z + 0.7, 'stall'); world.stalls.push({ x, z: z - 1.3 });
    }
    world.tejuosho = { x: ex, z: z0 - 9 };
    (world.shops ||= []).push({ x: ex, z: z0 - 5, name: 'Tejuosho Market' });
  }
  // Ladipo, Mushin: the auto spare-parts market. Sheds of zinc, tyres, engines, doors, stripped cars, oil
  function buildLadipo(r) {
    const cx = (r.x0 + r.x1) / 2, iz = r.z0 + WALK;
    // entrance arch on the north side
    for (const dx of [-6, 6]) { B.misc.box(1.2, 6.5, 1.2, { p: [cx + dx, CURB + 3.25, iz + 0.8] }, '#8d8272'); S.add(cx + dx - 0.6, 0, iz + 0.2, cx + dx + 0.6, CURB + 6.5, iz + 1.4, 'pillar'); }
    B.misc.box(13.4, 1.4, 1.0, { p: [cx, CURB + 6.4, iz + 0.8] }, '#8d8272');
    board('LADIPO CENTRAL AUTO SPARE PARTS MARKET', '#b71c1c', '#ffffff', 12.6, 1.3, cx, CURB + 6.4, iz + 0.25, Math.PI, null, 0.55);
    // oil stains on the dirt
    for (let k = 0; k < 18; k++) { const x = r.x0 + 8 + R() * (r.x1 - r.x0 - 16), z = r.z0 + 8 + R() * (r.z1 - r.z0 - 16), q = 1 + R() * 2; G.hole.flat(x - q, z - q * 0.7, x + q, z + q * 0.7, CURB + 0.012, white, 1, [0, 0, 1, 1]); }
    // rows of open sheds
    for (let row = 0; row < 3; row++) for (let k = 0; k < 5; k++) {
      const x = r.x0 + WALK + 7 + k * 10, z = r.z0 + WALK + 12 + row * 14;
      for (const [px, pz] of <any[]>[[-4, -2.5], [4, -2.5], [-4, 2.5], [4, 2.5]]) B.metal.cyl(0.06, 0.06, 3, { p: [x + px, CURB + 1.5, z + pz] }, '#5d5347', 5);
      B.metal.box(9, 0.07, 6, { p: [x, CURB + 3.05, z], r: [0.08, 0, 0] }, pick(['#8e8e8e', '#a1887f', '#7b7b7b', '#9e8b6e']));
      // the goods: a counter of parts, tyre stacks, an engine block, a car door, a bumper
      B.misc.box(7, 0.9, 1.1, { p: [x, CURB + 0.45, z + 1.6] }, '#5d4037'); S.add(x - 3.5, 0, z + 1.05, x + 3.5, CURB + 0.95, z + 2.15, 'stall');
      for (let t = 0; t < 3 + Math.floor(R() * 3); t++) B.misc.cyl(0.36, 0.36, 0.24, { p: [x - 3 + (t % 2) * 0.1, CURB + 0.12 + t * 0.25, z - 1.6] }, '#161616', 12);
      B.metal.box(0.9, 0.7, 0.7, { p: [x + 1.5, CURB + 0.35, z - 1.2] }, '#5f6368');
      B.misc.box(1.1, 0.9, 0.08, { p: [x - 1, CURB + 0.6, z - 2.2], r: [0, 0, 0.15] }, pick(['#c62828', '#1565c0', '#f5f5f5', '#fbc02d', '#212121']));
      B.misc.box(1.8, 0.25, 0.25, { p: [x + 2.2, CURB + 1.1, z + 1.6] }, pick(['#bdbdbd', '#212121', '#e0e0e0']));
      if (R() < 0.5) for (let e = 0; e < 3; e++) B.metal.cyl(0.04, 0.04, 1.2, { p: [x - 2 + e * 0.5, CURB + 2.3, z + 2.3], r: [0, 0, Math.PI / 2] }, '#757575', 5); // exhausts hanging
      world.stalls.push({ x, z: z + 2.8 });
    }
    // stripped car shells
    for (const [dx, dz, ry] of <any[]>[[-14, 22, 0.3], [12, 30, -0.6], [0, 40, 1.4]]) {
      const x = cx + dx, z = r.z0 + dz;
      B.misc.box(1.8, 0.8, 4.2, { p: [x, CURB + 0.55, z], ry }, pick(['#6d4c41', '#8d6e63', '#795548']));
      B.misc.box(1.6, 0.6, 2.0, { p: [x, CURB + 1.2, z], ry }, '#4e342e');
      S.add(x - 1.4, 0, z - 1.4, x + 1.4, CURB + 1.5, z + 1.4, 'wreck');
    }
    world.ladipo = { x: cx, z: iz + 3 };
  }
  // LUTH, Idi-Araba: the teaching hospital, an island of white light at night
  function buildLUTH(r) {
    const i = WALK + 4;
    addBuilding(r.x0 + i, r.z0 + i + 8, r.x0 + i + 26, r.z1 - i, 7, '#f2f2ee', true, [0, -1], false, 'mushin');
    addBuilding(r.x0 + i + 30, r.z0 + i + 8, r.x1 - i, r.z0 + i + 26, 4, '#eceff1', true, [0, -1], false, 'mushin');
    addBuilding(r.x0 + i + 30, r.z1 - i - 16, r.x1 - i, r.z1 - i, 3, '#eceff1', true, [0, 1], false, 'mushin');
    board('LAGOS UNIVERSITY TEACHING HOSPITAL', '#f5f5f5', '#0d47a1', 16, 1.9, r.x0 + i + 13, CURB + 23, r.z0 + i + 7.9, Math.PI, 'LUTH · IDI-ARABA', 0.7);
    board('+', '#ffffff', '#d32f2f', 2.2, 2.2, r.x0 + i + 27.5, CURB + 12, r.z0 + i + 7.9, Math.PI, null, 0.8);
    // ambulance at the emergency bay
    const ax = r.x0 + i + 36, az = r.z0 + i + 3;
    B.misc.box(2.1, 2.2, 5, { p: [ax, CURB + 1.2, az], ry: Math.PI / 2 }, '#fafafa'); B.misc.box(2.12, 0.3, 5.02, { p: [ax, CURB + 1.3, az], ry: Math.PI / 2 }, '#d32f2f');
    S.add(ax - 2.5, 0, az - 1.1, ax + 2.5, CURB + 2.3, az + 1.1, 'parked');
    for (let k = 0; k < 8; k++) (world.districtHangouts ||= []).push({ x: ax - 8 + k * 1.6, z: az + 3 });
    world.hospital = { x: ax - 4, z: az + 3 }; // the clinic bench
  }
  // Yaba Bus Terminal: danfos and koropes lined up, callers, floor traders under the footbridge
  function buildBusTerminal(r) {
    G.asphalt.flat(r.x0 + WALK, r.z0 + WALK, r.x1 - WALK, r.z1 - WALK, CURB + 0.004, color('#8a8a8a'), 12);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) world.parked.push({ type: 'danfo', x: r.x0 + WALK + 6 + k * 7.5, z: r.z0 + WALK + 12 + row * 12, yaw: 0 });
    B.metal.box(r.x1 - r.x0 - 12, 0.15, 5, { p: [(r.x0 + r.x1) / 2, CURB + 3.4, r.z1 - WALK - 6] }, '#546e7a');
    for (let x = r.x0 + WALK + 4; x < r.x1 - WALK; x += 8) B.metal.cyl(0.08, 0.08, 3.4, { p: [x, CURB + 1.7, r.z1 - WALK - 6] }, '#455a64', 6);
    board('YABA BUS TERMINAL', '#fdd835', '#111', 12, 1.4, (r.x0 + r.x1) / 2, CURB + 4.3, r.z1 - WALK - 3.5, Math.PI, null, 0.5);
    // "bend-down-select": okrika spread on the floor along the east walk, by the footbridge
    for (let z = r.z0 + WALK + 3; z < r.z1 - WALK; z += 3) { B.misc.box(1.6, 0.03, 1.6, { p: [r.x1 - 1.8, CURB + 0.02, z] }, pick(['#1565c0', '#c62828', '#fdd835', '#2e7d32', '#6a1b9a'])); for (let c = 0; c < 5; c++) B.misc.box(0.4, 0.06, 0.3, { p: [r.x1 - 2.3 + (c % 3) * 0.45, CURB + 0.06, z - 0.4 + Math.floor(c / 3) * 0.6] }, pick(['#fafafa', '#212121', '#1565c0', '#795548'])); (world.districtHangouts ||= []).push({ x: r.x1 - 3.2, z }); }
    for (let k = 0; k < 14; k++) (world.districtHangouts ||= []).push({ x: r.x0 + WALK + 4 + (k % 7) * 7.5, z: r.z0 + WALK + 7 + Math.floor(k / 7) * 12 });
    world.busTerminal = { x: (r.x0 + r.x1) / 2, z: r.z0 + WALK + 6 };
  }
  // E-Centre, Sabo: the tinted-glass mall and cinema where students and techies hang out
  function buildECentre(r) {
    const i = WALK + 6;
    addBuilding(r.x0 + i, r.z0 + i + 6, r.x1 - i, r.z1 - i, 4, '#37474f', true, [0, 1], false, 'yaba');
    B.lamp.box(r.x1 - r.x0 - 2 * i - 2, 9, 0.1, { p: [(r.x0 + r.x1) / 2, CURB + 6, r.z1 - i + 0.08] }, '#4f6f8a'); // tinted glass
    (world.shops ||= []).push({ x: (r.x0 + r.x1) / 2, z: r.z1 - WALK - 1, name: 'E-Centre Mall' });
    board('E-CENTRE', '#111', '#ff4081', 10, 2, (r.x0 + r.x1) / 2, CURB + 11, r.z1 - i + 0.2, Math.PI, 'CINEMA · MALL · SABO', 0.7);
    for (let k = 0; k < 16; k++) (world.districtHangouts ||= []).push({ x: r.x0 + i + 4 + (k % 8) * 5, z: r.z1 - WALK - 2 - Math.floor(k / 8) * 1.4 });
  }
  // Ojuwoye Market, Mushin: dense, claustrophobic, tarps shoulder to shoulder, narrow aisles
  function buildOjuwoye(r) {
    for (let x = r.x0 + WALK + 2.5; x < r.x1 - WALK - 2; x += 3.6) for (let z = r.z0 + WALK + 2.5; z < r.z1 - WALK - 2; z += 3.2) {
      if (((x - r.x0) | 0) % 18 < 2) continue; // an aisle
      B.misc.box(2.8, 0.8, 2.2, { p: [x, CURB + 0.4, z] }, pick(['#6d4c41', '#8d6e63', '#5d4037']));
      B.misc.box(2.6, 0.3, 2.0, { p: [x, CURB + 0.95, z] }, pick(['#e53935', '#fdd835', '#43a047', '#fb8c00', '#f5f5f5', '#8e24aa', '#6d4c41']));
      B.metal.box(3.4, 0.05, 3.0, { p: [x, CURB + 2.5, z], r: [(z % 2) * 0.1, 0, 0.05] }, pick(['#1e88e5', '#e53935', '#fdd835', '#43a047', '#9e9e9e']));
      S.add(x - 1.4, 0, z - 1.1, x + 1.4, CURB + 1.1, z + 1.1, 'stall'); world.stalls.push({ x: x + 1.8, z });
    }
    board('OJUWOYE MARKET', '#1b5e20', '#ffeb3b', 10, 1.4, (r.x0 + r.x1) / 2, CURB + 4.5, r.z0 + WALK + 0.2, Math.PI, 'MUSHIN', 0.5);
  }
  // Empire, Mushin: packed face-me-I-face-you blocks, balconies heavy with washing
  function buildEmpire(r) {
    const i = WALK + 2, w = (r.x1 - r.x0 - 2 * i - 8) / 3;
    for (let k = 0; k < 3; k++) for (const [za, zb] of <any[]>[[r.z0 + i, r.z0 + i + 18], [r.z1 - i - 18, r.z1 - i]]) {
      const x0 = r.x0 + i + k * (w + 4), x1 = x0 + w, front = za === r.z0 + i ? -1 : 1, fz = front < 0 ? za : zb;
      addBuilding(x0, za, x1, zb, 3, pick(MUSHIN_PAINT), true, [0, front], false, 'mushin');
      for (let f = 1; f <= 2; f++) {
        B.misc.box(x1 - x0, 0.15, 1.2, { p: [(x0 + x1) / 2, CURB + f * 3.2, fz + front * 0.6] }, '#8d8272');
        B.metal.box(x1 - x0, 0.9, 0.05, { p: [(x0 + x1) / 2, CURB + f * 3.2 + 0.5, fz + front * 1.18] }, '#5d5347');
        for (let c = 0; c < (x1 - x0) / 0.7; c++) if (R() < 0.7) B.misc.box(0.45, 0.6, 0.02, { p: [x0 + 0.4 + c * 0.7, CURB + f * 3.2 + 1.9, fz + front * 0.9] }, pick(['#e53935', '#1e88e5', '#fdd835', '#fafafa', '#43a047', '#8e24aa', '#fb8c00'])); // laundry
      }
    }
    board('EMPIRE', '#b71c1c', '#fff', 5, 1, (r.x0 + r.x1) / 2, CURB + 3.2, r.z0 + WALK + 0.2, Math.PI, null, 0.5);
  }
  // district landmarks placed on regular blocks
  {
    // Yaba bus stop under the pedestrian footbridge on Herbert Macaulay Way (x = roadLine(8))
    const hx = roadLine(8), hz = roadLine(3) - 20, y = 6.2;
    for (const sx of [-1, 1]) { const x = hx + sx * (ROAD / 2 + 2.2); B.misc.box(2.4, y, 3.6, { p: [x, y / 2, hz] }, '#9e9e9e'); S.add(x - 1.2, 0, hz - 1.8, x + 1.2, y, hz + 1.8, 'stairs'); }
    B.misc.box(ROAD + 7, 0.5, 2.6, { p: [hx, y + 0.25, hz] }, '#8a8a8a'); B.metal.box(ROAD + 7, 1.1, 0.08, { p: [hx, y + 1.0, hz - 1.3] }, '#607d8b'); B.metal.box(ROAD + 7, 1.1, 0.08, { p: [hx, y + 1.0, hz + 1.3] }, '#607d8b');
    S.add(hx - ROAD / 2 - 3.4, y, hz - 1.3, hx + ROAD / 2 + 3.4, y + 0.5, hz + 1.3, 'deck');
    board('YABA', '#fdd835', '#111', 4.5, 1.1, hx, y + 1.9, hz - 1.35, 0, null, 0.5);
    for (let k = 0; k < 12; k++) (world.districtHangouts ||= []).push({ x: hx + ROAD / 2 + 2 + (k % 3), z: hz - 8 + k * 1.3 });
    // the glass tech hub on Herbert Macaulay
    { const r = blockRect(8, 1), x0 = r.x0 + WALK + 2, z0 = r.z1 - WALK - 22, x1 = x0 + 20, z1 = r.z1 - WALK - 2;
      addBuilding(x0, z0, x1, z1, 7, '#4fc3f7', true, [1, 0], false, 'yaba');
      board('TECH HUB · HERBERT MACAULAY WAY', '#0d1b2a', '#4fc3f7', 11, 1.3, x1 + 0.12, CURB + 4.2, (z0 + z1) / 2, Math.PI / 2, null, 0.7); }
    // Yaba Tech: the college wall and gate
    { const r = blockRect(9, 4), gx = (r.x0 + r.x1) / 2, gz = r.z0 + WALK + 0.2;
      for (const [a, b] of <any[]>[[r.x0 + WALK, gx - 3], [gx + 3, r.x1 - WALK]]) { B.misc.box(b - a, 2.6, 0.3, { p: [(a + b) / 2, CURB + 1.3, gz] }, '#e0d6bf'); S.add(a, 0, gz - 0.2, b, CURB + 2.6, gz + 0.2, 'fence'); }
      for (const dx of [-3.4, 3.4]) B.misc.box(0.8, 4.2, 0.8, { p: [gx + dx, CURB + 2.1, gz] }, '#1b5e20');
      board('YABA COLLEGE OF TECHNOLOGY', '#1b5e20', '#ffffff', 9, 1.1, gx, CURB + 4.6, gz - 0.2, Math.PI, null, 0.5);
      // the grand historic administrative block: white with green accents
      const bx0 = r.x0 + WALK + 8, bz0 = gz + 10, bx1 = r.x1 - WALK - 8, bz1 = r.z1 - WALK - 8;
      addBuilding(bx0, bz0, bx1, bz1, 3, '#f5f5f0', false, [0, -1], false, 'yaba');
      for (let f = 1; f <= 3; f++) B.misc.box(bx1 - bx0 + 0.3, 0.3, 0.3, { p: [(bx0 + bx1) / 2, CURB + f * 3.2 - 0.15, bz0 - 0.1] }, '#1b5e20');
      B.misc.add(wedge, { p: [(bx0 + bx1) / 2, CURB + 9.9, bz0 + 3], ry: Math.PI / 2, s: [6, 2.4, 14] }, '#1b5e20'); // pediment over the entrance
      for (let k = -2; k <= 2; k++) B.misc.cyl(0.35, 0.35, 6.4, { p: [(bx0 + bx1) / 2 + k * 2.8, CURB + 3.2, bz0 - 1.4] }, '#fafafa', 10); }
    // the Red Line: railway down the east edge of column 8, with Yaba Station by Tejuosho
    { const rx = roadLine(9) - ROAD / 2 - WALK - 4.5, za = roadLine(0) - ROAD / 2, zb = roadLine(N) + ROAD / 2;
      G.dirt.flat(rx - 3, za, rx + 3, zb, 0.03, color('#6e675c'), 4); // ballast
      for (let z = za; z < zb; z += 1.2) B.misc.box(2.6, 0.08, 0.25, { p: [rx, 0.07, z] }, '#4e342e');
      for (const dx of [-0.72, 0.72]) B.metal.box(0.08, 0.14, zb - za, { p: [rx + dx, 0.16, (za + zb) / 2] }, '#9e9e9e');
      world.mapRects.push({ x0: rx - 2.5, z0: za, x1: rx + 2.5, z1: zb, color: '#8d6e63' });
      // Yaba Station (block 8,3): a long modern platform and canopy, a train waiting
      const sz0 = roadLine(3) + ROAD / 2 + WALK + 4, sz1 = roadLine(4) - ROAD / 2 - WALK - 4, px = rx - 4.2;
      B.misc.box(3.2, 1.0, sz1 - sz0, { p: [px, 0.5, (sz0 + sz1) / 2] }, '#bdbdbd'); S.add(px - 1.6, 0, sz0, px + 1.6, 1.0, sz1, 'platform');
      B.metal.box(9, 0.3, sz1 - sz0 + 4, { p: [rx - 1.5, 5.6, (sz0 + sz1) / 2] }, '#eceff1');
      for (let z = sz0; z <= sz1; z += 8) B.metal.cyl(0.18, 0.18, 4.8, { p: [px - 1.2, 3.2, z] }, '#90a4ae', 8);
      board('YABA STATION', '#b71c1c', '#ffffff', 10, 1.6, px - 1.3, 4.4, (sz0 + sz1) / 2, -Math.PI / 2, 'LAGOS RAIL MASS TRANSIT · RED LINE', 0.7);
      for (let k = 0; k < 3; k++) { const z = sz0 + 3 + k * 14; B.misc.box(2.8, 3.4, 13, { p: [rx, 1.9, z + 6.5] }, '#f5f5f5'); B.misc.box(2.84, 0.6, 13, { p: [rx, 1.4, z + 6.5] }, '#c62828'); B.lamp.box(2.86, 0.8, 11, { p: [rx, 2.6, z + 6.5] }, '#9fd3ff'); }
      S.add(rx - 1.4, 0, sz0 + 3, rx + 1.4, 3.6, sz0 + 44, 'train');
      for (let k = 0; k < 10; k++) (world.districtHangouts ||= []).push({ x: px, z: sz0 + 4 + k * 4 });
      world.yabaStation = { x: px, z: (sz0 + sz1) / 2 }; }
    // Herbert Macaulay Way: a dual carriageway, with a centre median down its length through Yaba
    { const c = roadLine(8);
      for (let j = 0; j < N; j++) { const a = roadLine(j) + ROAD / 2 + 3, b = roadLine(j + 1) - ROAD / 2 - 3;
        if (j === 2) continue; // under the footbridge the buses need the whole road
        B.misc.box(0.5, 0.6, b - a, { p: [c, 0.3, (a + b) / 2] }, '#b0a999'); S.add(c - 0.25, 0, a, c + 0.25, 0.6, b, 'median'); world.rails.push({ a: [c, 0.6, a], b: [c, 0.6, b] }); } }
    // Ikorodu Road along the north edge of Yaba: big corporate billboards overhead
    for (const [x, t, bg] of <any[]>[[300, 'MTN · EVERYWHERE YOU GO', '#fdd835'], [440, 'GLO · UNLIMITED NIGHT PLAN', '#2e7d32'], [540, 'INDOMIE · MAMA DO GOOD', '#e65100']]) {
      const z = roadLine(0) - ROAD / 2 - 3;
      for (const dx of [-3, 3]) B.metal.cyl(0.25, 0.3, 10, { p: [x + dx, 5, z] }, '#607d8b', 8);
      board(t, bg, '#111', 10, 3.6, x, 11.5, z + 0.3, 0, null, 0.6);
    }
    // Agege Motor Road through Mushin (x = roadLine(-3)): the skyway flyover's concrete pillars overhead
    { const c = roadLine(-3), za = roadLine(0) - 20, zb = roadLine(N) + 20, y = 9;
      for (let z = za; z <= zb; z += 24) { B.misc.box(1.6, y, 1.6, { p: [c, y / 2, z] }, '#8a857b'); S.add(c - 0.8, 0, z - 0.8, c + 0.8, y, z + 0.8, 'pillar'); }
      B.misc.box(11, 0.9, zb - za, { p: [c, y + 0.45, (za + zb) / 2] }, '#7d786f');
      world.mapRects.push({ x0: c - 5.5, z0: za, x1: c + 5.5, z1: zb, color: '#6d7180' }); }
    // Idi-Oro junction (roadLine(-1), roadLine(1)): power lines strung overhead, a keke rank loading
    { const jx = roadLine(-1), jz = roadLine(1);
      for (const [dx, dz] of <any[]>[[-9, -9], [9, -9], [-9, 9], [9, 9]]) { B.metal.cyl(0.12, 0.15, 9, { p: [jx + dx, 4.5, jz + dz] }, '#5d4037', 6); S.add(jx + dx - 0.15, 0, jz + dz - 0.15, jx + dx + 0.15, 9, jz + dz + 0.15, 'pole'); }
      for (let w = 0; w < 5; w++) for (const [ax, az, bx, bz] of <any[]>[[-9, -9, 9, -9], [9, -9, 9, 9], [9, 9, -9, 9], [-9, 9, -9, -9], [-9, -9, 9, 9]]) {
        const x0 = jx + ax, z0 = jz + az, x1 = jx + bx, z1 = jz + bz, L = Math.hypot(x1 - x0, z1 - z0);
        B.metal.box(0.03, 0.03, L, { p: [(x0 + x1) / 2, 8.6 - w * 0.25 - (w % 2) * 0.3, (z0 + z1) / 2], ry: Math.atan2(x1 - x0, z1 - z0) }, '#111');
      }
      for (let k = 0; k < 7; k++) world.parked.push({ type: 'keke', x: jx - ROAD / 2 - 1.8, z: jz + ROAD / 2 + 6 + k * 3.2, yaw: Math.PI / 2 });
      board('IDI-ORO', '#fdd835', '#111', 4, 0.9, jx + ROAD / 2 + 2, CURB + 3.4, jz - ROAD / 2 - 1, Math.PI, null, 0.5); }
    // district landmarks placed on regular blocks
    // Mushin: a mosque with a green dome and a minaret
    { const r = blockRect(-4, 2), cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      addBuilding(cx - 10, cz - 8, cx + 10, cz + 8, 2, '#f5f0e1', false, [0, -1], false, 'mushin');
      B.misc.sphere(6, { p: [cx, CURB + 6.4 + 1, cz], s: [1, 0.8, 1] }, '#2e7d32', 16, 10);
      B.misc.cyl(1, 1.2, 18, { p: [cx + 12, CURB + 9, cz - 6] }, '#f5f0e1', 10); B.misc.cyl(1.4, 0.2, 2.6, { p: [cx + 12, CURB + 19.3, cz - 6] }, '#2e7d32', 10);
      S.add(cx + 11, 0, cz - 7, cx + 13, CURB + 18, cz - 5, 'pillar'); }
  }
  // UNILAG, Akoka: the campus on the lagoon shore north of Yaba
  function buildUNILAG() {
    const U = UNI, mx = roadLine(8) + CELL / 2; // the main drive comes up from Yaba
    B.misc.box(U.x1 - U.x0 + 12, 1.2, U.z1 - U.z0, { p: [(U.x0 + U.x1) / 2, -0.6, (U.z0 + U.z1) / 2] }, '#4a4436'); // the land
    G.dirt.flat(U.x0, U.z0, U.x1, U.z1, 0.004, color('#41602f'), 8);                    // lawns
    const roads: any[] = [[mx - 6, U.z0 + 8, mx + 6, U.z1 + 2], [U.x0 + 10, -350, U.x1 - 10, -338]];
    for (const [a, b, c, d] of roads) { G.asphalt.flat(a, b, c, d, 0.012, white, 12); world.mapRects.push({ x0: a, z0: b, x1: c, z1: d, color: '#5d6170' }); }
    world.mapRects.push({ x0: U.x0, z0: U.z0, x1: U.x1, z1: U.z1, color: '#2e3f25' }, ...roads.map(([a, b, c, d]) => ({ x0: a, z0: b, x1: c, z1: d, color: '#5d6170' })));
    // gate
    const GZ = U.z1 - 10;
    for (const x of [mx - 9, mx + 9]) { B.misc.box(1.8, 7, 1.8, { p: [x, 3.5, GZ] }, '#e8e0cc'); S.add(x - 0.9, 0, GZ - 0.9, x + 0.9, 7, GZ + 0.9, 'gate'); }
    B.misc.box(20, 1.5, 1.3, { p: [mx, 7, GZ] }, '#e8e0cc');
    board('UNIVERSITY OF LAGOS', '#1b3a6b', '#ffd54f', 16, 2.4, mx, 7, GZ + 0.7, 0, 'AKOKA · IN DEED AND IN TRUTH', 0.55);
    world.uniGate = { x: mx, z: GZ + 4 };
    // Senate building: 13 floors of 1980s brutalism, mosaic tiles and horizontal concrete sun-shades
    { const x0 = mx + 14, z0 = -432, x1 = mx + 40, z1 = -408;
      addBuilding(x0, z0, x1, z1, 13, '#d8cbb0', false, [0, 1], false, 'yaba');
      for (let f = 1; f <= 13; f++) B.misc.box(x1 - x0 + 1.6, 0.25, z1 - z0 + 1.6, { p: [(x0 + x1) / 2, CURB + f * 3.2 - 0.6, (z0 + z1) / 2] }, '#b0a58c');
      board('SENATE BUILDING', '#6d1b1b', '#fff', 9, 1.4, (x0 + x1) / 2, 4, z1 + 0.9, 0, null, 0.5);
      world.mapRects.push({ x0, z0, x1, z1, color: '#3a3e4a' });
      // the Love Garden beside it: lawn, shade trees, benches
      G.dirt.flat(x1 + 6, -440, x1 + 44, -404, 0.009, color('#4f7a38'), 6);
      for (let k = 0; k < 6; k++) { const tx = x1 + 12 + (k % 3) * 12, tz = -432 + Math.floor(k / 3) * 16; B.misc.cyl(0.25, 0.32, 3, { p: [tx, 1.5, tz] }, '#5b4636', 7); B.misc.sphere(3.2, { p: [tx, 4.6, tz], s: [1.2, 0.7, 1.2] }, '#2f5a2a', 9, 7); S.add(tx - 0.3, 0, tz - 0.3, tx + 0.3, 3, tz + 0.3, 'tree'); B.misc.box(2.2, 0.45, 0.6, { p: [tx, 0.45, tz + 3.5] }, '#9e9e9e'); (world.districtHangouts ||= []).push({ x: tx, z: tz + 4.6 }); }
      board('LOVE GARDEN', '#2e7d32', '#fff', 5, 0.9, x1 + 25, 1.6, -403.5, 0, null, 0.4); }
    // Main Library: four storeys around an open quadrangle
    { const x0 = mx - 72, z0 = -440, x1 = mx - 22, z1 = -392, t = 11;
      for (const [a, b, c, d] of <any[]>[[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0 + t, x0 + t, z1 - t], [x1 - t, z0 + t, x1, z1 - t]]) addBuilding(a, b, c, d, 4, '#d9d2bf', true, [0, 1], false, 'yaba');
      board('MAIN LIBRARY', '#6d1b1b', '#fff', 8, 1.4, (x0 + x1) / 2, 4, z1 + 0.1, 0, null, 0.5);
      world.mapRects.push({ x0, z0, x1, z1, color: '#3a3e4a' }); }
    // Moremi Hall: a sprawling courtyard complex, laundry on every balcony rail
    { const x0 = U.x0 + 6, z0 = -336, x1 = U.x0 + 74, z1 = -282, t = 12;
      for (const [a, b, c, d] of <any[]>[[x0, z0, x1, z0 + t], [x0, z0 + t, x0 + t, z1], [x1 - t, z0 + t, x1, z1]]) {
        addBuilding(a, b, c, d, 3, '#e6c8c8', true, [0, 1], false, 'yaba');
        for (let c2 = 0; c2 < (c - a) / 1.1; c2++) if (R() < 0.6) B.misc.box(0.5, 0.65, 0.02, { p: [a + 0.5 + c2 * 1.1, CURB + 5.4, d + 0.35] }, pick(['#e53935', '#f48fb1', '#fdd835', '#fafafa', '#7e57c2', '#26a69a']));
      }
      board('MOREMI HALL', '#6d1b1b', '#fff', 8, 1.4, (x0 + x1) / 2, 4, z0 + t + 0.1, 0, null, 0.5);
      for (let k = 0; k < 8; k++) (world.districtHangouts ||= []).push({ x: (x0 + x1) / 2 - 7 + k * 2, z: z1 + 3 }); // suitors at the gate
      world.mapRects.push({ x0, z0, x1, z1, color: '#3a3e4a' }); }
    // Jaja Hall faces the Sports Centre: track, pitch, courts
    { addBuilding(U.x1 - 64, -440, U.x1 - 8, -412, 4, '#d8d0b8', true, [0, 1], false, 'yaba');
      board('JAJA HALL', '#6d1b1b', '#fff', 7, 1.4, U.x1 - 36, 4, -411.9, 0, null, 0.5);
      const sx0 = U.x1 - 118, sz0 = -330, sx1 = U.x1 - 10, sz1 = -236;
      G.dirt.flat(sx0, sz0, sx1, sz1, 0.01, color('#a0513a'), 6);               // the running track
      G.dirt.flat(sx0 + 8, sz0 + 8, sx1 - 8, sz1 - 8, 0.014, color('#3f7a2e'), 6); // the pitch
      for (const gz of [sz0 + 9, sz1 - 9]) { B.metal.box(7.3, 0.12, 0.12, { p: [(sx0 + sx1) / 2, 2.4, gz] }, '#fafafa'); for (const dx of [-3.6, 3.6]) B.metal.cyl(0.06, 0.06, 2.4, { p: [(sx0 + sx1) / 2 + dx, 1.2, gz] }, '#fafafa', 6); }
      G.asphalt.flat(sx0 - 38, sz0 + 36, sx0 - 6, sz0 + 66, 0.012, white, 8); // basketball / tennis courts
      board('UNILAG SPORTS CENTRE', '#1565c0', '#fff', 10, 1.5, (sx0 + sx1) / 2, 3.5, sz1 + 0.5, Math.PI, null, 0.5);
      for (let k = 0; k < 16; k++) (world.districtHangouts ||= []).push({ x: sx0 + 12 + (k % 8) * 11, z: sz0 + 20 + Math.floor(k / 8) * 50 });
      world.mapRects.push({ x0: sx0, z0: sz0, x1: sx1, z1: sz1, color: '#6b3a2e' }); }
    // faculties by the gate
    for (const [x0, z0, x1, z1, name] of <any[]>[[mx - 70, -300, mx - 30, -276, 'FACULTY OF SCIENCE'], [mx + 14, -330, mx + 60, -306, 'FACULTY OF ARTS']]) {
      addBuilding(x0, z0, x1, z1, 4, '#d6d0c0', R() < 0.5, [0, 1], false, 'yaba');
      board(name, '#6d1b1b', '#fff', 9, 1.6, (x0 + x1) / 2, 4, z1 + 0.08, 0, null, 0.5);
      world.mapRects.push({ x0, z0, x1, z1, color: '#3a3e4a' });
    }
    // the Lagoon Front: paved walk, lawns, almond and palm trees, benches facing the water and Third Mainland
    G.walk.flat(U.x0 + 4, U.z0 + 1, U.x1 - 4, U.z0 + 7, 0.02, color('#b8b0a0'), 3);
    for (let x = U.x0 + 14; x < U.x1 - 14; x += 22) { B.misc.cyl(0.3, 0.38, 3.2, { p: [x, 1.6, U.z0 + 10] }, '#5b4636', 7); B.misc.sphere(3.6, { p: [x, 5, U.z0 + 10], s: [1.4, 0.55, 1.4] }, '#2d5226', 9, 7); S.add(x - 0.35, 0, U.z0 + 9.65, x + 0.35, 3.2, U.z0 + 10.35, 'tree'); }
    board('LAGOON FRONT', '#1b3a6b', '#fff', 6, 1, mx, 2, U.z0 + 8, Math.PI, null, 0.5);
    // palms along the drive, the lagoon-front wall and benches (open air after Surulere's alleys)
    for (let z = U.z1 - 20; z > U.z0 + 14; z -= 16) for (const sx of [-1, 1]) {
      const x = mx + sx * 10, h = 6 + R() * 2.5;
      B.misc.cyl(0.14, 0.2, h, { p: [x, h / 2, z] }, '#7a6450', 7);
      for (let f = 0; f < 7; f++) { const a = (f / 7) * Math.PI * 2; B.misc.box(0.35, 0.05, 2.6, { p: [x + Math.sin(a) * 1.1, h + 0.1, z + Math.cos(a) * 1.1], r: [0.45, a, 0] }, '#2f5a2a'); }
      S.add(x - 0.2, 0, z - 0.2, x + 0.2, h, z + 0.2, 'tree');
    }
    { let k = 0; for (let z = U.z1 - 26; z > U.z0 + 12; z -= 34, k++) { streetlight(mx - 8.4, z, 1, 0); streetlight(mx + 8.4, z - 17, -1, 0); } }
    B.misc.box(U.x1 - U.x0, 0.7, 0.4, { p: [(U.x0 + U.x1) / 2, 0.35, U.z0 + 0.2] }, '#9a958b');
    S.add(U.x0, 0, U.z0, U.x1, 0.9, U.z0 + 0.4, 'fence');
    for (let x = U.x0 + 20; x < U.x1 - 20; x += 24) { B.misc.box(2.4, 0.45, 0.6, { p: [x, 0.45, U.z0 + 3] }, '#6d4c41'); (world.districtHangouts ||= []).push({ x, z: U.z0 + 4.4 }); }
    for (let k = 0; k < 16; k++) (world.districtHangouts ||= []).push({ x: mx - 14 + (k % 4) * 2, z: GZ + 6 + Math.floor(k / 4) * 1.6 }); // students at the gate
  }
  buildUNILAG();

  // ---------- Surulere names ----------
  world.roadNamesX = ['Ojuelegba Road', 'Adeniran Ogunsanya Street', 'Stadium Road', 'Bode Thomas Street', 'Akerele Street', 'Ogunlana Drive', 'Aguda Road']; // constant z
  world.roadNamesZ = ['Randle Avenue', 'Lawanson Road', 'Itire Road', 'Western Avenue', 'Adelabu Street', 'Masha Road', 'Eric Moore Road'];   // constant x
  world.areaAt = (x, z) => {
    if (z < CAMPUS.z1) return Math.abs(z + 1290) < 16 ? 'Idumota, Lagos Island' : 'Adeniji Adele, Lagos Island';
    if (z < UNI.z1 + 2 && x > UNI.x0 - 4 && z > UNI.z0 - 4) return 'UNILAG, Akoka';
    if (z < -HALF - ROAD / 2 - 6) return 'Third Mainland Bridge';
    if (Math.abs(x - FLY.x) < FLY.clear && Math.abs(z) < HALF + 6) return 'Under Ojuelegba Bridge';
    const bi = Math.floor((x + HALF) / CELL), bj = Math.floor((z + HALF) / CELL), t = blockType(bi, bj);
    if (z < UNI.z1 + 2 && x > UNI.x0 - 4) return 'UNILAG, Akoka';
    if (t === 'tejuosho') return 'Tejuosho Market, Yaba';
    if (t === 'busterminal') return 'Yaba Bus Terminal';
    if (t === 'ecentre') return 'E-Centre, Sabo';
    if (t === 'ojuwoye') return 'Ojuwoye Market, Mushin';
    if (t === 'empire') return 'Empire, Mushin';
    if (bi >= N && Math.abs(z - roadLine(0)) < 9) return 'Ikorodu Road';
    if (bi >= N && Math.abs(x - roadLine(10)) < 9) return 'Murtala Muhammed Way';
    if (bi === 8 && x > roadLine(9) - ROAD / 2 - WALK - 9 && bj === 3) return 'Yaba Station';
    if (bi < 0 && Math.abs(x - roadLine(-3)) < 9) return 'Agege Motor Road';
    if (bi < 0 && Math.hypot(x - roadLine(-1), z - roadLine(1)) < 22) return 'Idi-Oro';
    if (t === 'ladipo') return 'Ladipo Spare Parts, Mushin';
    if (t === 'hospital') return 'LUTH, Idi-Araba';
    if (bi >= N) return bi === 8 && Math.abs(x - roadLine(8)) < 10 ? 'Herbert Macaulay Way, Yaba' : bj <= 1 ? 'Sabo, Yaba' : 'Yaba';
    if (bi < 0) return bi >= -2 ? 'Idi-Araba' : 'Mushin';
    if (t === 'market') return 'Adelabu Market';
    if (t === 'motorpark') return 'Ojuelegba Motor Park';
    if (t === 'pitch') return 'Area Pitch';
    if (world.stadium && z > HALF + ROAD / 2) return 'National Stadium';
    if (bi <= 2 && bj <= 2) return 'Aguda';
    if (bi >= 3 && bj <= 2) return 'Ojuelegba';
    if (bi <= 2) return 'Adelabu';
    return 'National Stadium';
  };

  // ---------- home ----------
  { const r = blockRect(1, 1); world.home = { x: (r.x0 + r.x1) / 2 + 2, z: r.z0 + WALK * 0.5, yaw: Math.PI / 2 };
    // Bolaji's compound gate: green metal with a small lantern
    const gx = world.home.x, gz = r.z0 + WALK + 0.15;
    B.metal.box(2.2, 2.1, 0.1, { p: [gx, CURB + 1.05, gz] }, '#1f5c3a');
    B.lamp.box(0.18, 0.18, 0.18, { p: [gx + 1.5, CURB + 2.5, gz - 0.1] }, '#ffffff');
    world.homeDoor = { x: gx, z: gz - 1.2 };
  }

  // ---------- meshes ----------
  const meshes: any[] = [];
  const add = (geo, mat, opts: any = {}) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.receiveShadow = opts.receive ?? true; m.castShadow = opts.cast ?? false; m.matrixAutoUpdate = false; m.updateMatrix(); if (opts.order != null) m.renderOrder = opts.order; scene.add(m); meshes.push(m); return m; };
  add(G.road.build(), mats.road); add(G.bad.build(), badMat);
  const floodMesh = add(G.flood.build(), waterMatF, { order: 1 }); if (floodMesh) floodMesh.receiveShadow = false; add(G.asphalt.build(), mats.asphalt); add(G.walk.build(), mats.walk); add(G.dirt.build(), mats.dirt);
  add(G.wall.build(), mats.wall, { cast: true }); add(G.wallGen.build(), mats.wallGen, { cast: true }); add(G.roof.build(), mats.roof);
  add(B.misc.build(), mats.misc, { cast: true }); add(B.metal.build(), mats.metal, { cast: true }); add(B.lamp.build(), mats.lamp, { receive: false });
  add(G.sign.build(), mats.sign);
  add(G.hole.build(), mats.hole, { receive: false, order: 1 });
  const poolMesh = add(G.pool.build(), mats.pool, { receive: false, order: 2 });
  void poolMesh;
  for (const m of world.extraMeshes) { m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); }
  // the lagoon
  const wn = T.waterNormals(); wn.repeat.set(60, 60);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshStandardMaterial({ color: 0x0a1624, roughness: 0.18, metalness: 0.55, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6) }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.4, -700); water.receiveShadow = false; scene.add(water);
  world.water = water;

  // street-light point lights: a small pool re-assigned to the lights nearest the player
  const PL: any[] = [];
  for (let k = 0; k < (opt.lights ?? 10); k++) { const l = new THREE.PointLight(0xffa24a, 0, 26, 1.6); scene.add(l); PL.push(l); }
  let plTimer = 0, power = 1;

  world.mats = mats;
  world.setPower = (p, gen = 1) => {
    power = p;
    mats.lamp.color.setRGB(1, 0.62, 0.3).multiplyScalar(0.02 + 5 * p);
    mats.pool.opacity = 0.5 * p;
    mats.wall.emissiveIntensity = 0.02 + 0.98 * p;
    mats.wallGen.emissiveIntensity = gen;
    mats.sign.emissiveIntensity = 0.55 * p;
    for (const m of world.extraMeshes) m.material.emissiveIntensity = 0.5 * p + 0.05;
  };
  let flT = 0;
  world.update = (dt, fx, fz) => {
    if (world.floodlight) { flT += dt; const on = power > 0.5 && (Math.sin(flT * 17) + Math.sin(flT * 5.3)) > -0.9; world.floodlight.panel.material.color.setRGB(1, 0.95, 0.85).multiplyScalar(on ? 4 : 0.05); }
    wn.offset.x += dt * 0.004; wn.offset.y += dt * 0.0025;
    plTimer -= dt;
    if (plTimer <= 0) {
      plTimer = 0.3;
      const near = world.lights.map(l => [l, (l.x - fx) ** 2 + (l.z - fz) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, PL.length);
      near.forEach(([l], k) => PL[k].position.set(l.x, l.y - 0.3, l.z));
    }
    for (const l of PL) l.intensity = 70 * power;
  };
  world.badRoads = world_bad;
  world.roadCond = (x, z) => {
    for (const f of world_bad.floods) if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) return 'flood';
    for (const g of world_bad.segs) if (x > g.x0 && x < g.x1 && z > g.z0 && z < g.z1) return 'bad';
    return null;
  };
  return world;
}
