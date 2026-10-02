// Traffic on the road grid (right-hand driving) plus police cars that leave the lanes to pursue.
// Vehicles follow straight lane segments between intersections and quadratic-bezier turns through them,
// brake for the vehicle ahead and for Bolaji standing in the road. Police drive freely along an L-shaped
// route over the grid, then straight at the player once they have line of sight.
import * as THREE from 'three';
import { N, LANE, INT, HALF, CELL, roadLine, nearestNode, rng, CURB, I0, I1 } from './layout.ts';
import { buildTemplate, vehicleMats, SPECS } from './vehicles.ts';
import { glowTexture } from '../core/textures.ts';

const DIRS: any[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const right = (d) => [-d[1], d[0]];

function straight(A, d) {
  const B = [A[0] + d[0], A[1] + d[1]], r = right(d);
  const [ax, az] = [roadLine(A[0]), roadLine(A[1])], [bx, bz] = [roadLine(B[0]), roadLine(B[1])];
  const p0 = [ax + d[0] * INT + r[0] * LANE, az + d[1] * INT + r[1] * LANE];
  const p2 = [bx - d[0] * INT + r[0] * LANE, bz - d[1] * INT + r[1] * LANE];
  return curve(p0, [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2], p2, { to: B, d });
}
function turn(B, d, nd) {
  const r = right(d), nr = right(nd), [bx, bz] = [roadLine(B[0]), roadLine(B[1])];
  const p0 = [bx - d[0] * INT + r[0] * LANE, bz - d[1] * INT + r[1] * LANE];
  const p2 = [bx + nd[0] * INT + nr[0] * LANE, bz + nd[1] * INT + nr[1] * LANE];
  const p1 = (d[0] === nd[0] && d[1] === nd[1]) ? [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2] : [bx + r[0] * LANE + nr[0] * LANE, bz + r[1] * LANE + nr[1] * LANE];
  return curve(p0, p1, p2, { at: B, d: nd, turn: true });
}
function curve(p0, p1, p2, info) {
  let len = 0, px = p0[0], pz = p0[1];
  for (let k = 1; k <= 12; k++) { const t = k / 12, q = bez(p0, p1, p2, t); len += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }
  return { p0, p1, p2, len, ...info };
}
function bez(p0, p1, p2, t) { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]; }
function bezD(p0, p1, p2, t) { return [2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])]; }
const valid = (i, j) => i >= I0 && j >= 0 && i <= I1 && j <= N;

export function createTraffic(scene, world) {
  const R = rng(99);
  const col = world.collision;
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffe2b0, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const vehicles: any[] = [];
  const templates: any = {};
  const tpl = (type) => {
    const k = type === 'car' || type === 'okada' || type === 'danfo' || type === 'keke' ? type + Math.floor(R() * 4) : type;
    return templates[k] || (templates[k] = buildTemplate(type, R));
  };

  function makeGroup(type, parked = false) {
    const t = tpl(type), g = new THREE.Group();
    const body = new THREE.Mesh(t.body, vehicleMats.body); body.castShadow = true; body.receiveShadow = true;
    const lights = new THREE.Mesh(t.lights, vehicleMats.lights);
    g.add(body, lights);
    if (!parked) {
      const glow = new THREE.Mesh(glowGeo, glowMat);
      const sp = t.spec; glow.scale.set(sp.w * 2.4, 1, 9); glow.position.set(0, 0.08, sp.len / 2 + 4); glow.renderOrder = 2;
      g.add(glow);
    }
    scene.add(g);
    return { g, t };
  }

  function makeVehicle(type, kind = 'traffic') {
    const { g, t } = makeGroup(type);
    const spec = SPECS[type];
    const v: any = {
      type, kind, spec, group: g, pos: new THREE.Vector3(), yaw: 0, speed: 0, vel: new THREE.Vector3(),
      fwd: new THREE.Vector3(0, 0, 1), rt: new THREE.Vector3(-1, 0, 0), cruise: spec.speed[0] + R() * (spec.speed[1] - spec.speed[0]),
      cur: null, s: 0, honk: 0, yawRate: 0, stuck: 0,
    };
    if (type === 'police') {
      const bar = new THREE.Group();
      v.sirenR = new THREE.MeshBasicMaterial({ color: 0xff1010, toneMapped: false });
      v.sirenB = new THREE.MeshBasicMaterial({ color: 0x1040ff, toneMapped: false });
      const bg = new THREE.BoxGeometry(0.6, 0.14, 0.26);
      const mr = new THREE.Mesh(bg, v.sirenR), mb = new THREE.Mesh(bg, v.sirenB);
      mr.position.set(-0.34, 1.78, 0.7); mb.position.set(0.34, 1.78, 0.7);
      bar.add(mr, mb); g.add(bar);
      v.police = { mode: 'patrol', route: [], routeT: 0, target: new THREE.Vector3(), lastSeen: -99, sees: false, siren: false, flash: 0 };
    }
    vehicles.push(v);
    return v;
  }

  function place(v) {
    const t = v.s / v.cur.len;
    const [x, z] = bez(v.cur.p0, v.cur.p1, v.cur.p2, Math.min(1, t));
    const [dx, dz] = bezD(v.cur.p0, v.cur.p1, v.cur.p2, Math.min(1, t));
    v.pos.set(x, 0, z);
    const ny = Math.atan2(dx, dz);
    let dy = ny - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    v.yaw = ny;
    return dy;
  }

  // spawn lane traffic
  const MIX: any[] = [['danfo', 20], ['okada', 14], ['keke', 9], ['car', 16], ['tanker', 4]]; // Surulere plus Yaba and Mushin
  for (const [type, n] of MIX) for (let k = 0; k < n; k++) {
    const v = makeVehicle(type);
    let A, d;
    do { A = [I0 + Math.floor(R() * (I1 - I0 + 1)), Math.floor(R() * (N + 1))]; d = DIRS[Math.floor(R() * 4)]; } while (!valid(A[0] + d[0], A[1] + d[1]));
    v.cur = straight(A, d); v.s = R() * v.cur.len; v.speed = v.cruise * 0.6;
    place(v);
  }
  // one patrol car from the start
  const patrol = makeVehicle('police', 'police');
  { const [x, z] = [roadLine(5), roadLine(2) + LANE]; patrol.pos.set(x, 0, z); }

  // parked danfos at the motor park (static solids you can climb onto)
  for (const p of world.parked) {
    const type = p.type || 'danfo', { g } = makeGroup(type, true);
    g.position.set(p.x, p.y ?? CURB, p.z); g.rotation.y = p.yaw;
    const sp = SPECS[type], side = Math.abs(Math.sin(p.yaw)) > 0.7; // turned sideways: swap the footprint
    const hw = (side ? sp.len : sp.w) / 2, hl = (side ? sp.w : sp.len) / 2;
    col.solids.add(p.x - hw, 0, p.z - hl, p.x + hw, (p.y ?? CURB) + sp.h, p.z + hl, 'parked');
  }

  function nextCurve(v) {
    const c = v.cur;
    if (!c.turn) { // arriving at node c.to: pick a new direction (no U-turns)
      const B = c.to, opts = DIRS.filter(nd => !(nd[0] === -c.d[0] && nd[1] === -c.d[1]) && valid(B[0] + nd[0], B[1] + nd[1]));
      const straightOn = opts.find(nd => nd[0] === c.d[0] && nd[1] === c.d[1]);
      const nd = straightOn && R() < 0.5 ? straightOn : opts[Math.floor(R() * opts.length)];
      v.cur = turn(B, c.d, nd);
    } else v.cur = straight(c.at, c.d);
  }

  // ---- queries used by the player ----
  const _l = new THREE.Vector3();
  const traffic: any = {
    vehicles,
    local(v, x, z) { const dx = x - v.pos.x, dz = z - v.pos.z, s = Math.sin(v.yaw), c = Math.cos(v.yaw); return [dx * c - dz * s, dx * s + dz * c]; }, // [lateral(+x local), along(+z local)]
    attachPoint(v, lat, out = _l) {
      return out.copy(v.pos).addScaledVector(v.fwd, -v.spec.len / 2 - 0.55).addScaledVector(v.rt, lat);
    },
    nearestSkitch(p) {
      let best = null, bd = 3.0;
      for (const v of vehicles) {
        if (!v.spec.skitch || v.speed < 2) continue;
        const a = this.attachPoint(v, 0, _l);
        const d = Math.hypot(a.x - p.x, a.z - p.z);
        if (d < bd && Math.abs(p.y - v.pos.y) < 1.2) { bd = d; best = v; }
      }
      return best;
    },
    // vehicle roof under a point
    platformAt(x, z, feetY) {
      for (const v of vehicles) {
        if (!v.spec.platform) continue;
        const [lx, lz] = this.local(v, x, z);
        const top = v.pos.y + v.spec.h;
        if (Math.abs(lx) < v.spec.w / 2 && Math.abs(lz) < v.spec.len / 2 && feetY >= top - 0.6 && feetY <= top + 0.5) return { v, top };
      }
      return null;
    },
    // push a player out of vehicle bodies; returns the hardest hit { v, rel } or null
    collide(pos, feetY, r, pvel) {
      let hit = null;
      for (const v of vehicles) {
        const top = v.pos.y + v.spec.h;
        if (feetY >= top - 0.35 || feetY + 1.7 < v.pos.y) continue;
        const [lx, lz] = this.local(v, pos.x, pos.z);
        const hw = v.spec.w / 2 + r, hl = v.spec.len / 2 + r;
        if (Math.abs(lx) >= hw || Math.abs(lz) >= hl) continue;
        const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
        const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
        let nlx = 0, nlz = 0;
        if (px < pz) nlx = Math.sign(lx) || 1; else nlz = Math.sign(lz) || 1;
        const push = Math.min(px, pz);
        // local (lateral, along) -> world: world = lat * (cos, -sin) + along * (sin, cos)
        const wx = nlx * c + nlz * s, wz = -nlx * s + nlz * c;
        pos.x += wx * push; pos.z += wz * push;
        const rel = (v.vel.x - pvel.x) * wx + (v.vel.z - pvel.z) * wz; // closing speed of the vehicle toward the player
        if (!hit || rel > hit.rel) hit = { v, rel, nx: wx, nz: wz };
      }
      return hit;
    },
    police() { return vehicles.filter(v => v.kind === 'police'); },
    spawnPolice(px, pz) {
      // a road node 70-120 m away, ideally out of sight
      let best = null, bestScore = -1e9;
      for (let i = I0; i <= I1; i++) for (let j = 0; j <= N; j++) {
        const x = roadLine(i), z = roadLine(j), d = Math.hypot(x - px, z - pz);
        if (d < 60 || d > 150) continue;
        const hidden = col.blocked(x, 1.5, z, px, 1.5, pz, 2);
        const score = (hidden ? 50 : 0) - Math.abs(d - 90) + R() * 10;
        if (score > bestScore) { bestScore = score; best = [x, z]; }
      }
      if (!best) best = [roadLine(0), roadLine(0)];
      const v = makeVehicle('police', 'police');
      v.pos.set(best[0], 0, best[1]); v.yaw = Math.atan2(px - best[0], pz - best[1]);
      v.police.mode = 'chase';
      return v;
    },
    remove(v) { const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); scene.remove(v.group); },
  };

  // ---- free driving (police, getaway car) ----
  const contacts: any[] = [];
  const _p = new THREE.Vector3();
  const northOf = z => z < -HALF - 8; // on the bridge approach, the bridge or at UNILAG
  function routeTo(v, tx, tz) {
    const pre = [], post = [];
    let sx = v.pos.x, sz = v.pos.z, ex = tx, ez = tz;
    if (northOf(sz)) { pre.push([0, -HALF - 20], [0, -HALF]); sx = 0; sz = -HALF; }
    if (northOf(tz)) { post.push([0, -HALF - 20], [tx, tz]); ex = 0; ez = -HALF; } else post.push([tx, tz]);
    const [ai, aj] = nearestNode(sx, sz), [bi, bj] = nearestNode(ex, ez);
    const pts: any[] = [[roadLine(ai), roadLine(aj)]];
    // L-shaped route over the grid; pick the corner closer to the car's heading
    const c1 = [roadLine(bi), roadLine(aj)], c2 = [roadLine(ai), roadLine(bj)];
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const sc = c => (c[0] - v.pos.x) * fx + (c[1] - v.pos.z) * fz;
    pts.push(sc(c1) > sc(c2) ? c1 : c2, [roadLine(bi), roadLine(bj)]);
    // drop the first node if we're already past it
    if (!pre.length) { const [n0] = pts; if (Math.hypot(n0[0] - v.pos.x, n0[1] - v.pos.z) < 10 || (n0[0] - v.pos.x) * fx + (n0[1] - v.pos.z) * fz < 0) pts.shift(); }
    return [...pre, ...pts, ...post];
  }
  function nextWaypoint(v, route) {
    while (route.length > 1 && Math.hypot(route[0][0] - v.pos.x, route[0][1] - v.pos.z) < 7) route.shift();
    return route[0] || [v.pos.x + Math.sin(v.yaw) * 10, v.pos.z + Math.cos(v.yaw) * 10];
  }
  // steer toward (tx,tz) at up to `target` m/s, swerving around traffic and sliding off buildings
  function freeDrive(v, dt, tx, tz, target, { accel = 6, swerve = true }: any = {}) {
    let want = Math.atan2(tx - v.pos.x, tz - v.pos.z);
    if (swerve) for (const o of vehicles) {
      if (o === v) continue;
      const [lx, lz] = traffic.local(v, o.pos.x, o.pos.z);
      if (lz > 0 && lz < 9 && Math.abs(lx) < 2.2 && Math.abs(o.pos.y - v.pos.y) < 2) { want += (lx >= 0 ? -1 : 1) * 0.5; break; }
    }
    let dy = want - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const maxTurn = 2.2 * Math.min(1, 0.25 + Math.abs(v.speed) / 8);
    const turnAmt = Math.max(-maxTurn * dt, Math.min(maxTurn * dt, dy));
    v.yaw += turnAmt; v.yawRate = dt > 0 ? turnAmt / dt : 0;
    target *= Math.max(0.3, Math.cos(dy));
    v.speed += Math.max(-14 * dt, Math.min(accel * dt, target - v.speed));
    v.pos.x += Math.sin(v.yaw) * v.speed * dt; v.pos.z += Math.cos(v.yaw) * v.speed * dt;
    let bumped = false;
    for (const off of [1.4, -1.4]) {
      _p.set(v.pos.x + Math.sin(v.yaw) * off, 0, v.pos.z + Math.cos(v.yaw) * off);
      const ox = _p.x, oz = _p.z;
      col.resolve(_p, v.pos.y, 1.15, 2, contacts);
      if (contacts.length) { v.pos.x += _p.x - ox; v.pos.z += _p.z - oz; bumped = true; }
    }
    if (bumped) { v.speed *= 0.9; v.stuck += dt; } else v.stuck = Math.max(0, v.stuck - dt);
    if (v.stuck > 1.5) { v.yaw += Math.PI * 0.5; v.stuck = 0; } // unstick
    const g = col.groundHeight(v.pos.x, v.pos.z, v.pos.y + 0.6, 0.5);
    v.pos.y += (g.h - v.pos.y) * Math.min(1, dt * 10);
  }
  function drivePolice(v, dt, game) {
    const P = v.police, pp = game.player.pos;
    const chasing = P.mode === 'chase';
    if (P.mode === 'transport') { // prisoner in the back: drive to the station
      P.routeT -= dt; if (P.routeT <= 0 || !P.route.length) { P.routeT = 3; P.route = routeTo(v, P.dest.x, P.dest.z); }
      const [tx, tz] = nextWaypoint(v, P.route); freeDrive(v, dt, tx, tz, 12); return;
    }
    if (P.parked) { v.speed = Math.max(0, v.speed - 12 * dt); v.yawRate = 0; v.pos.x += Math.sin(v.yaw) * v.speed * dt; v.pos.z += Math.cos(v.yaw) * v.speed * dt; return; }
    const dist = Math.hypot(pp.x - v.pos.x, pp.z - v.pos.z);
    P.routeT -= dt;
    let tx, tz;
    if (chasing) {
      if (P.sees && dist < 34) { P.route = []; tx = pp.x; tz = pp.z; }
      else if (P.routeT <= 0 || !P.route.length) { P.routeT = 1.2; P.route = routeTo(v, P.target.x, P.target.z); }
    } else if (P.routeT <= 0 || !P.route.length) {
      P.routeT = 12; P.route = routeTo(v, roadLine(I0 + Math.floor(R() * (I1 - I0 + 1))), roadLine(Math.floor(R() * (N + 1))));
    }
    if (tx === undefined) [tx, tz] = nextWaypoint(v, P.route);
    let target = chasing ? (game.heat >= 3 ? 19 : 16.5) : 9;
    if (chasing && P.sees && dist < 12) target = Math.min(target, 2.5 + dist * 0.75); // shadow the player instead of ramming
    if (!chasing && Math.hypot(tx - v.pos.x, tz - v.pos.z) < 6 && P.route.length <= 1) target = 0;
    freeDrive(v, dt, tx, tz, target);
    // stuck against a building or kerb for 3 s: back onto the nearest junction, facing the target
    P.slowT = v.speed < 1.2 && target > 3 ? (P.slowT || 0) + dt : 0;
    if (P.slowT > 3) {
      const [i, j] = nearestNode(v.pos.x, v.pos.z), nx = roadLine(i) + LANE, nz = roadLine(j);
      if (Math.hypot(nx - pp.x, nz - pp.z) > 12) { v.pos.set(nx, 0, nz); v.yaw = Math.atan2(tx - nx, tz - nz); v.speed = 4; }
      P.slowT = 0; P.route = []; P.routeT = 0;
    }
  }
  function driveGetaway(v, dt, game) {
    const A = v.ai, pp = game.player.pos;
    if (A.parked) { v.speed = 0; return; } // waiting (a story mission starts it)
    if (A.health <= 0 || A.smashed) { // crashing to a stop
      A.crashT = (A.crashT || 0) + dt;
      v.yaw += (A.spin ?? (A.spin = (R() < 0.5 ? -1 : 1) * 0.9)) * dt * Math.min(1, v.speed / 8);
      v.speed = Math.max(0, v.speed - 11 * dt);
      v.pos.x += Math.sin(v.yaw) * v.speed * dt; v.pos.z += Math.cos(v.yaw) * v.speed * dt;
      _p.set(v.pos.x, 0, v.pos.z); col.resolve(_p, v.pos.y, 1.3, 2, contacts); v.pos.x = _p.x; v.pos.z = _p.z;
      if (v.speed <= 0.05) A.stopped = true;
      return;
    }
    A.routeT -= dt;
    if (A.routeT <= 0 || A.route.length <= 1) {
      A.routeT = 4;
      // flee to a junction far from Bolaji
      let best = null, bs = -1e9;
      for (let i = I0; i <= I1; i++) for (let j = 0; j <= N; j++) {
        const x = roadLine(i), z = roadLine(j);
        const dp = Math.hypot(x - pp.x, z - pp.z), dv = Math.hypot(x - v.pos.x, z - v.pos.z);
        if (dv < 50) continue;
        const sc = dp - dv * 0.35 + R() * 40;
        if (sc > bs) { bs = sc; best = [x, z]; }
      }
      A.route = routeTo(v, best[0], best[1]);
    }
    const [tx, tz] = nextWaypoint(v, A.route);
    freeDrive(v, dt, tx, tz, A.topSpeed, { accel: 7 });
  }

  // ---- the bridge: go-slow traffic looping UNILAG <-> the district ----
  const LZs = -HALF - 56, LZe = -1215, LA = LZs - LZe, LB = Math.PI * LANE, LOOP = 2 * LA + 2 * LB;
  function loopAt(s) {
    s = ((s % LOOP) + LOOP) % LOOP;
    if (s < LA) return [LANE, LZs - s, Math.PI];
    s -= LA;
    if (s < LB) { const t = s / LANE; return [LANE * Math.cos(t), LZe - LANE * Math.sin(t), Math.atan2(-Math.sin(t), -Math.cos(t))]; }
    s -= LB;
    if (s < LA) return [-LANE, LZe + s, 0];
    s -= LA;
    const t = s / LANE; return [-LANE * Math.cos(t), LZs + LANE * Math.sin(t), Math.atan2(Math.sin(t), Math.cos(t))];
  }
  const LOOPBASE = ['danfo', 'car', 'danfo', 'brt', 'car', 'okada', 'danfo', 'car', 'keke', 'tanker', 'car', 'danfo', 'okada', 'car'];
  const LOOPMIX = Array.from({ length: 84 }, (_, k) => LOOPBASE[k % LOOPBASE.length]); // Third Mainland is never empty
  LOOPMIX.forEach((type, k) => {
    const v = makeVehicle(type, 'loop');
    v.cruise = (type === 'okada' ? 10 : 7) + R() * 4;
    v.ls = (k / LOOPMIX.length) * LOOP + R() * 10;
    const [x, z, y] = loopAt(v.ls); v.pos.set(x, 0, z); v.yaw = y;
    v.group.rotation.order = 'YXZ';
  });

  // road route for navigation (the GPS line and the guide arrow)
  traffic.route = (x, z, yaw, tx, tz) => routeTo({ pos: { x, z }, yaw }, tx, tz);

  // ---- rides: a vehicle Bolaji rides in follows the lane network like real traffic ----
  // A stop sits beside one road segment; the ride uses the lane on the stop's side (right-hand traffic,
  // so he steps straight out onto the kerb). We plan a route over the grid, then drive lane curves.
  function stopSegment(st) {
    const nx = Math.round(st.nx), nz = Math.round(st.nz);
    const d = [-nz, nx];                                    // lane direction whose right-hand side is the stop
    const along = d[0] !== 0 ? st.x : st.z, across = d[0] !== 0 ? st.z + nz * 8 : st.x + nx * 8;
    const line = Math.max(0, Math.min(N, Math.round((across + HALF) / CELL)));
    const t = (along + HALF) / CELL, k = d[0] + d[1] > 0 ? Math.floor(t) : Math.ceil(t);
    const A = d[0] !== 0 ? [k, line] : [line, k];
    if (!valid(A[0], A[1]) || !valid(A[0] + d[0], A[1] + d[1])) return null;
    const cv = straight(A, d);
    const s = Math.max(3, Math.min(cv.len - 3, (along - (d[0] !== 0 ? cv.p0[0] : cv.p0[1])) * (d[0] + d[1])));
    return { A, d, s, len: cv.len };
  }
  function planRide(from, to) {
    const s0 = stopSegment(from), s1 = stopSegment(to);
    if (!s0 || !s1) return null;
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];
    const curves = [straight(s0.A, s0.d)];
    if (!(same(s0.A, s1.A) && same(s0.d, s1.d) && s1.s > s0.s + 4)) {
      // breadth-first search over (node, heading): no U-turns
      const key = (n, d) => `${n[0]},${n[1]},${d[0]},${d[1]}`;
      const start = { n: [s0.A[0] + s0.d[0], s0.A[1] + s0.d[1]], d: s0.d, prev: null };
      const q: any = [start], seen = new Set([key(start.n, start.d)]);
      let goal = null;
      while (q.length && !goal) {
        const cur = q.shift();
        for (const nd of DIRS) {
          if (nd[0] === -cur.d[0] && nd[1] === -cur.d[1]) continue;
          if (same(cur.n, s1.A) && same(nd, s1.d)) { goal = { ...cur, last: nd }; break; }
          const nn = [cur.n[0] + nd[0], cur.n[1] + nd[1]];
          if (!valid(nn[0], nn[1]) || seen.has(key(nn, nd))) continue;
          seen.add(key(nn, nd)); q.push({ n: nn, d: nd, prev: cur });
        }
      }
      if (!goal) return null;
      const chain: any[] = []; for (let c = goal; c; c = c.prev) chain.unshift(c);
      // chain[k] = arriving at node chain[k].n heading chain[k].d; then turn toward the next heading
      for (let k = 0; k < chain.length; k++) {
        const c = chain[k], nextD = k + 1 < chain.length ? chain[k + 1].d : goal.last;
        curves.push(turn(c.n, c.d, nextD), straight(c.n, nextD));
      }
    }
    return { curves, startS: s0.s, endS: s1.s };
  }
  traffic.spawnRide = (type, from, to) => {
    const plan = planRide(from, to);
    if (!plan) return null;
    const v = makeVehicle(type, 'ride');
    v.path = plan.curves; v.pi = 0; v.cur = plan.curves[0]; v.s = plan.startS; v.endS = plan.endS;
    v.cruise = type === 'okada' ? 14 : type === 'keke' ? 8.5 : 12; v.speed = 0;
    v.ai = { arrived: false, done: false };
    place(v); v.fwd.set(Math.sin(v.yaw), 0, Math.cos(v.yaw)); v.rt.set(-Math.cos(v.yaw), 0, Math.sin(v.yaw));
    return v;
  };

  traffic.spawnGetaway = (x, z, yaw) => {
    const v = makeVehicle('getaway', 'getaway');
    v.pos.set(x, 0, z); v.yaw = yaw; v.speed = 12;
    v.ai = { route: [], routeT: 0, health: 5, maxHealth: 5, smashed: false, stopped: false, topSpeed: 14 };
    v.group.rotation.order = 'YXZ';
    return v;
  };

  traffic.blockers = [];
  traffic.update = (dt, game) => {
    const player = game.player, pp = player.pos;
    for (const v of vehicles) {
      const oldX = v.pos.x, oldZ = v.pos.z;
      if (v.kind === 'police') drivePolice(v, dt, game);
      else if (v.kind === 'getaway') driveGetaway(v, dt, game);
      else {
        // car following: nearest vehicle ahead in roughly the same direction
        const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
        let gap = 99;
        for (const o of vehicles) {
          if (o === v) continue;
          const rx = o.pos.x - v.pos.x, rz = o.pos.z - v.pos.z;
          const along = rx * fx + rz * fz;
          if (along <= 0 || along > 18) continue;
          const lat = Math.abs(rx * fz - rz * fx);
          if (lat > 1.9 || Math.abs(o.pos.y - v.pos.y) > 2.5) continue;
          if (o.kind !== 'police' && o.kind !== 'getaway' && o.kind !== 'ride' && Math.sin(o.yaw) * fx + Math.cos(o.yaw) * fz < 0.3) continue;
          gap = Math.min(gap, along - (o.spec.len + v.spec.len) / 2);
        }
        // police checkpoints: stop at the line, hand over the "roger", then drive on
        if (v.kind !== 'loop') for (const b of traffic.blockers) {
          if (!b.active) continue;
          const rx = b.x - v.pos.x, rz = b.z - v.pos.z, along = rx * fx + rz * fz;
          if (v.cp === b) { if (along < -8 || along > 40) v.cp = null; continue; }
          if (along < -1 || along > 22 || Math.abs(rx * fz - rz * fx) > 6.5) continue;
          gap = Math.min(gap, along - v.spec.len / 2 - 1.6);
          if (v.speed < 0.6 && along < v.spec.len / 2 + 4) {
            b.stopped = v; v.cpT = (v.cpT || 0) + dt;
            if (v.cpT > b.hold) { v.cp = b; v.cpT = 0; b.stopped = null; b.onPaid?.(v); }
          }
        }
        // Bolaji standing in the road ahead
        let forPlayer = false;
        if (!player.riding || player.riding !== v) {
          const rx = pp.x - v.pos.x, rz = pp.z - v.pos.z, along = rx * fx + rz * fz, lat = Math.abs(rx * fz - rz * fx);
          if (along > 0 && along < 10 + v.spec.len / 2 && lat < 1.7 && Math.abs(pp.y - v.pos.y) < 1.2 && player.mode !== 'skitch') { gap = Math.min(gap, along - v.spec.len / 2 - 1.2); forPlayer = true; }
        }
        const cond = world.roadCond?.(v.pos.x, v.pos.z), slow = cond === 'flood' ? 0.35 : cond === 'bad' ? 0.6 : 1;
        let target = v.cruise * slow * Math.max(0, Math.min(1, (gap - 2) / 9));
        const GS = traffic.goSlow; // a jam on Third Mainland: everything crawls to a stop
        if (GS && v.kind === 'loop' && v.pos.z < GS.z0 && v.pos.z > GS.z1) target = Math.min(target, 0.2);
        if (v.kind === 'ride' && !v.ai.done) { // slow down for the stop at the end of the route
          const last = v.pi === v.path.length - 1;
          if (last) { const rem = v.endS - v.s; target = Math.min(target, Math.max(0, rem * 1.1)); if (rem < 0.6) { v.ai.arrived = true; target = 0; } }
        }
        v.speed += Math.max(-16 * dt, Math.min(4 * dt, target - v.speed));
        if (v.speed < 0) v.speed = 0;
        v.honk = forPlayer && v.speed < 1 ? v.honk + dt : 0;
        if (v.honk > 1.2) { v.honk = -3; game.audio?.horn(v.pos); }
        if (v.kind === 'loop') {
          v.ls += v.speed * dt;
          const [x, z, yaw] = loopAt(v.ls);
          let dy = yaw - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          v.yaw = yaw; v.yawRate = dt > 0 ? dy / dt : 0;
          const half = v.spec.len * 0.4;
          const yf = col.groundHeight(x + Math.sin(yaw) * half, z + Math.cos(yaw) * half, 30).h, yb = col.groundHeight(x - Math.sin(yaw) * half, z - Math.cos(yaw) * half, 30).h;
          v.pos.set(x, (yf + yb) / 2, z);
          v.group.rotation.x = -Math.atan2(yf - yb, half * 2);
        } else {
          v.s += v.speed * dt;
          if (v.kind === 'ride' && !v.ai.done && v.pi === v.path.length - 1) v.s = Math.min(v.s, v.endS);
          while (v.s > v.cur.len) { v.s -= v.cur.len; if (v.kind === 'ride' && !v.ai.done && v.pi < v.path.length - 1) v.cur = v.path[++v.pi]; else nextCurve(v); }
          const dy = place(v);
          v.yawRate = dt > 0 ? dy / dt : 0;
        }
      }
      v.fwd.set(Math.sin(v.yaw), 0, Math.cos(v.yaw));
      v.rt.set(-Math.cos(v.yaw), 0, Math.sin(v.yaw));
      if (dt > 0) v.vel.set((v.pos.x - oldX) / dt, 0, (v.pos.z - oldZ) / dt);
      const g = v.group;
      g.position.copy(v.pos); g.rotation.y = v.yaw;
      if (v.type === 'okada') g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, -Math.max(-0.4, Math.min(0.4, v.yawRate * 0.35)), 0.2);
      if (v.police) {
        const on = v.police.siren; v.police.flash += dt * 9;
        const a = Math.sin(v.police.flash) > 0;
        v.sirenR.color.setRGB(on && a ? 12 : 0.25, 0.05, 0.05);
        v.sirenB.color.setRGB(0.05, 0.1, on && !a ? 14 : 0.3);
      }
    }
  };
  return traffic;
}
