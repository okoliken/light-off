// The people of Surulere. Every pedestrian is built from instanced body parts (legs and arms that swing,
// torso, head, hair, skirt/wrapper, gele, fila cap, a basin carried on the head), so a couple of hundred
// people cost about a dozen draw calls. Men and women, children and elders, different heights, builds,
// skin tones and clothes. They walk the sidewalks, wait at bus stops, queue at food stalls, crowd the
// market and the motor park. Busier by day, thinner at night. They scatter from fights and sirens.
import * as THREE from 'three';
import { WALK, blockRect, N, rng } from '../world/layout.ts';

const SKIN = ['#3b2418', '#4a2e20', '#5a3825', '#2f1c12', '#6b4430', '#7a5236', '#44291b'];
const VIVID = ['#c62828', '#1565c0', '#f9a825', '#2e7d32', '#6a1b9a', '#ef6c00', '#00897b', '#ad1457', '#5d4037', '#fdd835', '#8e24aa', '#0277bd', '#d84315', '#558b2f'];
const PLAIN = ['#eeeeee', '#263238', '#37474f', '#795548', '#1a237e', '#4e342e', '#9e9e9e', '#f5f5f5', '#212121', '#90a4ae'];
const PANTS = ['#263238', '#1a237e', '#3e2723', '#212121', '#4e342e', '#37474f', '#5d4037', '#1c2833'];
const PARTS = ['torso', 'pelvis', 'skirt', 'legL', 'legR', 'armL', 'armR', 'head', 'hair', 'gele', 'fila', 'basin'];

function geos() {
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 8);
  const g: any = {};
  g.torso = cap(0.16, 0.34).translate(0, 1.2, 0).scale(1.12, 1, 0.72);
  g.pelvis = new THREE.BoxGeometry(0.32, 0.2, 0.2).translate(0, 0.94, 0);
  g.skirt = new THREE.CylinderGeometry(0.19, 0.29, 0.62, 12, 1, true).translate(0, 0.62, 0); // wrapper / kaftan (scaled per person)
  g.legL = cap(0.07, 0.72).translate(0, -0.44, 0); g.legR = g.legL.clone();                  // pivot at the hip
  g.armL = cap(0.052, 0.46).translate(0, -0.27, 0); g.armR = g.armL.clone();                // pivot at the shoulder
  g.head = new THREE.SphereGeometry(0.105, 12, 10).scale(0.9, 1.08, 1).translate(0, 1.6, 0.01);
  g.hair = new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.92, 1, 1.03).translate(0, 1.62, -0.004);
  g.gele = new THREE.TorusGeometry(0.12, 0.05, 6, 14).rotateX(Math.PI / 2).scale(1.1, 1.6, 1).translate(0, 1.71, -0.01);
  g.fila = new THREE.CylinderGeometry(0.1, 0.11, 0.1, 10).translate(0, 1.7, 0).rotateZ(0.12);
  g.basin = new THREE.CylinderGeometry(0.3, 0.2, 0.14, 14).translate(0, 1.82, 0);
  return g;
}

export function createCrowd(scene, world, count = 230) {
  const R = rng(4242), pick = a => a[Math.floor(R() * a.length)];
  const G = geos(), mesh = {};
  for (const k of PARTS) {
    const m = new THREE.InstancedMesh(G[k], new THREE.MeshStandardMaterial({ roughness: 0.85, side: k === 'skirt' ? THREE.DoubleSide : THREE.FrontSide }), count);
    m.castShadow = k !== 'hair' && k !== 'fila'; m.frustumCulled = false; scene.add(m); mesh[k] = m;
  }
  const c = new THREE.Color();
  const blocks = world.blocks.filter(b => b.bj >= 0 && b.bj < N && b.type !== 'ring'); // Surulere, Yaba and Mushin
  const peds: any[] = [];
  // where people gather and stand: bus stops, food stalls, news stands, the market, the motor park
  const hangouts: any[] = [];
  for (const s of world.busStops || []) for (let k = 0; k < 3; k++) hangouts.push({ x: s.x - s.nx * 0.9 + (R() - 0.5) * 2.4, z: s.z - s.nz * 0.9 + (R() - 0.5) * 2.4 });
  for (const v of world.vendors || []) for (let k = 0; k < 2; k++) hangouts.push({ x: v.x + (R() - 0.5) * 2, z: v.z + (R() - 0.5) * 2 });
  for (const st of world.stalls || []) if (R() < 0.5) hangouts.push({ x: st.x + (R() - 0.5) * 1.5, z: st.z + (R() < 0.5 ? 1.1 : -1.1) });
  { const m = world.motorparkSpot; for (let k = 0; k < 10; k++) hangouts.push({ x: m.x - 18 + R() * 30, z: m.z - 4 - R() * 16 }); }
  for (const h of world.stadium?.hangouts || []) hangouts.push(h);
  for (const h of world.island?.hangouts || []) hangouts.push(h);
  for (const h of world.districtHangouts || []) hangouts.push(h);

  for (let i = 0; i < count; i++) {
    const female = R() < 0.5, age = R(), child = age < 0.08, elder = age > 0.88;
    const h = child ? 0.62 + R() * 0.12 : (female ? 0.9 : 0.95) + R() * 0.12, w = child ? 0.75 : 0.88 + R() * 0.32;
    const p: any = {
      female, child, elder, h, w, stand: false, dayOnly: R() < 0.62, phase: R() * 9, scare: 0, side: 0, pos: new THREE.Vector3(),
      speed: (elder ? 0.7 : child ? 1.3 : 1.05) + R() * 0.5, yaw: R() * 6.28,
      skirt: female ? (R() < 0.6 ? (R() < 0.5 ? 'long' : 'knee') : null) : (elder && R() < 0.5 ? 'kaftan' : null),
      gele: female && !child && R() < 0.45, fila: !female && !child && R() < 0.25, basin: female && !child && !elder && R() < 0.14,
      shorts: !female && R() < 0.2, hairless: !female && R() < 0.3,
    };
    if (i < hangouts.length && R() < 0.92) { const hgo = hangouts[i]; p.stand = true; p.pos.set(hgo.x, 0.15, hgo.z); p.dayOnly = R() < 0.7; }
    else {
      const b = pick(blocks), r = blockRect(b.bi, b.bj), inset = WALK * (0.25 + R() * 0.5);
      p.rect = { x0: r.x0 + inset, x1: r.x1 - inset, z0: r.z0 + inset, z1: r.z1 - inset };
      p.W = p.rect.x1 - p.rect.x0; p.H = p.rect.z1 - p.rect.z0; p.P = 2 * (p.W + p.H); p.u = R() * p.P; p.dir = R() < 0.5 ? 1 : -1;
    }
    const top = female && R() < 0.6 ? pick(VIVID) : R() < 0.5 ? pick(VIVID) : pick(PLAIN);
    const bottom = p.skirt === 'kaftan' ? top : female && p.skirt ? pick(VIVID) : pick(PANTS);
    const skin = pick(SKIN);
    p.col = { torso: top, pelvis: bottom, skirt: bottom, legL: p.shorts || p.skirt === 'knee' ? skin : p.skirt === 'long' || p.skirt === 'kaftan' ? skin : bottom, armL: R() < 0.6 ? skin : top, head: skin, hair: '#0e0b09', gele: pick(VIVID), fila: pick([...VIVID, '#5d4037', '#212121']), basin: pick(['#b0bec5', '#1976d2', '#e53935', '#fbc02d']) };
    p.col.legR = p.col.legL; p.col.armR = p.col.armL;
    for (const k of PARTS) mesh[k].setColorAt(i, c.set(p.col[k]));
    peds.push(p);
  }
  for (const k of PARTS) mesh[k].instanceColor.needsUpdate = true;
  // everywhere people can walk a loop: mainland blocks and the Island's buildings
  const walkRects: any[] = blocks.map(b => { const r = blockRect(b.bi, b.bj), inset = WALK * 0.5; return { x0: r.x0 + inset, x1: r.x1 - inset, z0: r.z0 + inset, z1: r.z1 - inset }; });
  for (const b of world.island?.blocks || []) walkRects.push({ x0: b.x0 - 1.6, x1: b.x1 + 1.6, z0: b.z0 - 1.6, z1: b.z1 + 1.6 });
  // people far behind the camera quietly move to wherever Bolaji is now (so the Island isn't empty)
  const relocate = (p, cx, cz) => {
    const near = (o, a, b) => { const d = (o.x - cx) ** 2 + (o.z - cz) ** 2; return d > a * a && d < b * b; };
    if (p.stand) { const c = hangouts.filter(h => near(h, 70, 150)); if (c.length) { const h = c[Math.floor(Math.random() * c.length)]; p.pos.set(h.x + (Math.random() - 0.5), 0.15, h.z + (Math.random() - 0.5)); return true; } return false; }
    const c = walkRects.filter(r => near({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }, 70, 155)); if (!c.length) return false;
    const r = c[Math.floor(Math.random() * c.length)];
    p.rect = r; p.W = r.x1 - r.x0; p.H = r.z1 - r.z0; p.P = 2 * (p.W + p.H); p.u = Math.random() * p.P; const [x, z] = at(p, p.u); p.pos.set(x, 0.15, z); return true;
  };

  const at = (p, u) => {
    const { rect, W, H } = p; u = ((u % p.P) + p.P) % p.P;
    if (u < W) return [rect.x0 + u, rect.z0, 1, 0];
    if (u < W + H) return [rect.x1, rect.z0 + (u - W), 0, 1];
    if (u < 2 * W + H) return [rect.x1 - (u - W - H), rect.z1, -1, 0];
    return [rect.x0, rect.z1 - (u - 2 * W - H), 0, -1];
  };
  const body = new THREE.Matrix4(), part = new THREE.Matrix4(), tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const hide = i => { for (const k of PARTS) mesh[k].setMatrixAt(i, zero); };

  return {
    peds,
    update(dt, game) {
      const pl = game.player.pos, danger = game.dangers, night = game.life?.phase === 'night' || game.life?.inside;
      const pSpeed = Math.hypot(game.player.vel.x, game.player.vel.z);
      const cam = game.camera?.cam.position || pl;
      for (let i = 0; i < peds.length; i++) {
        const p = peds[i];
        if ((night && p.dayOnly) || ((cam.x - p.pos.x) ** 2 + (cam.z - p.pos.z) ** 2 > 170 * 170 && p.pos.lengthSq() > 0)) { // off-screen: keep walking, skip the drawing
          hide(i); if (!p.stand) { p.u += p.dir * p.speed * dt; const [x, z] = at(p, p.u); p.pos.set(x, 0.15, z); }
          p.farT = (p.farT || 0) + dt; if (p.farT > 1.5 + (i % 7) * 0.4) { p.farT = 0; if (!(night && p.dayOnly)) relocate(p, cam.x, cam.z); }
          continue;
        }
        let scared = false;
        for (const d of danger) if ((p.pos.x - d.x) ** 2 + (p.pos.z - d.z) ** 2 < d.r * d.r) { scared = true; break; }
        const dpx = p.pos.x - pl.x, dpz = p.pos.z - pl.z;
        if (dpx * dpx + dpz * dpz < 1.0 && pSpeed > 3 && p.scare <= 0) { p.scare = 2; p.side = 0.9; game.audio?.yelp(p.pos); }
        if (scared) p.scare = 3;
        p.scare = Math.max(0, p.scare - dt);
        let spd = 0;
        if (p.stand) {
          if (p.scare > 0) { p.pos.x += Math.sin(p.yaw) * 3.5 * dt; p.pos.z += Math.cos(p.yaw) * 3.5 * dt; spd = 3.5; }
          else p.yaw += Math.sin(game.time * 0.3 + p.phase) * dt * 0.4;
        } else {
          spd = p.scare > 0 ? 4.2 : p.speed;
          p.u += p.dir * spd * dt;
          p.side *= Math.max(0, 1 - dt * 1.5);
          const [x, z, dx, dz] = at(p, p.u);
          const fx = dx * p.dir, fz = dz * p.dir;
          p.pos.set(x - fz * p.side, 0.15, z + fx * p.side);
          p.yaw = Math.atan2(fx, fz);
        }
        p.phase += dt * (spd > 0 ? spd * 3.4 / p.h : 0.8);
        const walk = spd > 0 ? Math.min(1, spd / 2) : 0, sn = Math.sin(p.phase);
        const bob = walk * Math.abs(Math.cos(p.phase)) * 0.04 * p.h;
        const hunch = p.elder ? 0.18 : 0;
        e.set(hunch + (p.scare > 0 ? 0.12 : 0), p.yaw, 0); q.setFromEuler(e);
        body.compose(v.set(p.pos.x, p.pos.y + bob, p.pos.z), q, sc.set(p.w, p.h, p.w));
        const put = (k, m) => mesh[k].setMatrixAt(i, m);
        const limb = (k, px, py, rx) => { part.makeRotationX(rx); part.setPosition(px, py, 0); tmp.multiplyMatrices(body, part); put(k, tmp); };
        put('torso', body); put('head', body); put('pelvis', body);
        const legA = 0.5 * walk * (p.elder ? 0.6 : 1), armA = (p.basin ? 0.1 : 0.45) * walk;
        const longSkirt = p.skirt === 'long' || p.skirt === 'kaftan';
        limb('legL', 0.09, 0.92, -sn * legA * (longSkirt ? 0.5 : 1)); limb('legR', -0.09, 0.92, sn * legA * (longSkirt ? 0.5 : 1));
        if (p.basin) { part.makeRotationZ(2.7); part.setPosition(0.2, 1.42, 0); tmp.multiplyMatrices(body, part); put('armL', tmp); } // one hand steadying the basin
        else limb('armL', 0.21, 1.42, sn * armA);
        limb('armR', -0.21, 1.42, -sn * armA);
        if (p.skirt) { part.makeScale(1, p.skirt === 'knee' ? 0.75 : 1.3, 1); part.setPosition(0, p.skirt === 'knee' ? 0.18 : -0.2, 0); tmp.multiplyMatrices(body, part); put('skirt', tmp); } else put('skirt', zero);
        put('hair', p.hairless || p.gele || p.fila ? zero : body);
        put('gele', p.gele ? body : zero); put('fila', p.fila ? body : zero); put('basin', p.basin ? body : zero);
      }
      for (const k of PARTS) mesh[k].instanceMatrix.needsUpdate = true;
    },
  };
}
