// Projectiles and effects: catapult stones, pepper ("ata") bombs and their clouds, sparks, gun muzzle
// flashes, bullet tracers and the red aim lasers that telegraph every shot.
// Light count is fixed at startup (two flash lights) so no shader ever recompiles mid-game.
import * as THREE from 'three';
import { glowTexture } from '../core/textures.ts';

const MAXP = 600;

export function createFX(scene, world) {
  const col = world.collision;
  const glow = glowTexture();

  // ---- particles: one additive system (sparks, flashes) and one soft system (smoke, pepper) ----
  function particleSystem(additive, size) {
    const pos = new Float32Array(MAXP * 3), colr = new Float32Array(MAXP * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    const m = new THREE.PointsMaterial({ size, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: additive ? 1 : 0.55, toneMapped: !additive });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    const list: any[] = [];
    return {
      emit(x, y, z, vx, vy, vz, life, c, grav = 9) { if (list.length >= MAXP) list.shift(); list.push({ x, y, z, vx, vy, vz, life, max: life, c: new THREE.Color(c), grav }); },
      update(dt) {
        let n = 0;
        for (let i = list.length - 1; i >= 0; i--) {
          const q = list[i]; q.life -= dt;
          if (q.life <= 0) { list.splice(i, 1); continue; }
          q.vy -= q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
          if (q.grav > 0 && q.y < 0.05) { q.y = 0.05; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
        }
        for (const q of list) {
          const k = q.life / q.max;
          pos[n * 3] = q.x; pos[n * 3 + 1] = q.y; pos[n * 3 + 2] = q.z;
          colr[n * 3] = q.c.r * k; colr[n * 3 + 1] = q.c.g * k; colr[n * 3 + 2] = q.c.b * k; n++;
        }
        g.setDrawRange(0, n);
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      },
    };
  }
  const sparks = particleSystem(true, 0.22);
  const smoke = particleSystem(false, 2.8);

  // ---- flash lights (fixed pool) ----
  const flashes = [0, 1].map(() => { const l = new THREE.PointLight(0xffc070, 0, 14, 1.5); scene.add(l); return { l, t: 0 }; });
  let fi = 0;
  function flash(x, y, z, color = 0xffc070, power = 60) { const f = flashes[fi++ % flashes.length]; f.l.position.set(x, y, z); f.l.color.set(color); f.l.intensity = power; f.t = 0.08; }

  // ---- lines: tracers (brief) and aim lasers (per shooter, reused) ----
  const lineMat = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, toneMapped: false });
  const tracers: any[] = [];
  function tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const l = new THREE.Line(g, lineMat(new THREE.Color(3, 2.4, 1.2), 0.9)); scene.add(l);
    tracers.push({ l, t: 0.07 });
  }
  const lasers = new Map();
  function laser(owner, a, b, strength, xray) {
    let l = lasers.get(owner);
    if (!l) { l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lineMat(new THREE.Color(4, 0.1, 0.1), 0.6)); l.renderOrder = 5; scene.add(l); lasers.set(owner, l); }
    const p = l.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; l.geometry.computeBoundingSphere();
    l.material.opacity = 0.25 + 0.7 * strength; l.material.depthTest = !xray; l.visible = true; l._seen = true;
  }

  // ---- stones and bombs ----
  const stoneGeo = new THREE.SphereGeometry(0.05, 6, 5), stoneMat = new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.9 });
  const bombGeo = new THREE.SphereGeometry(0.1, 8, 6), bombMat = new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.6, emissive: '#5a0a00', emissiveIntensity: 0.6 });
  const webGeoP = new THREE.IcosahedronGeometry(0.12, 0), webMatP = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.3, 2.5), toneMapped: false });
  const webLineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1.6, 1.7, 1.9), transparent: true, opacity: 0.7, toneMapped: false });
  const shots: any[] = [];
  const clouds: any[] = [];
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();

  const fx = {
    sparks, smoke, flash, tracer, laser, clouds,
    // hitTest(p0, p1) -> { t, target } | null, supplied by the game each frame
    stone(from, dir, speed = 58) {
      const m = new THREE.Mesh(stoneGeo, stoneMat); m.position.copy(from); scene.add(m);
      shots.push({ kind: 'stone', m, v: dir.clone().multiplyScalar(speed), life: 1.6, grav: 6 });
    },
    web(from, dir, speed = 42) {
      const m = new THREE.Mesh(webGeoP, webMatP); m.position.copy(from); scene.add(m);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from.clone(), from.clone()]), webLineMat); scene.add(line);
      shots.push({ kind: 'web', m, v: dir.clone().multiplyScalar(speed), life: 1.2, grav: 2, line, origin: from.clone() });
    },
    bomb(from, vel) {
      const m = new THREE.Mesh(bombGeo, bombMat); m.position.copy(from); scene.add(m);
      shots.push({ kind: 'bomb', m, v: vel.clone(), life: 3, grav: 16 });
    },
    burst(x, y, z, color = 0xffd27a, n = 12, speed = 5) {
      for (let i = 0; i < n; i++) sparks.emit(x, y, z, (Math.random() - 0.5) * speed, Math.random() * speed * 0.7, (Math.random() - 0.5) * speed, 0.25 + Math.random() * 0.3, color);
    },
    dust(x, y, z, n = 6) { for (let i = 0; i < n; i++) smoke.emit(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), (Math.random() - 0.5) * 1.5, 0.9, 0x6b6258, -0.3); },
    cloud(x, y, z, o: any = {}) { clouds.push({ x, y, z, r: o.r || 4.6, t: 0, life: o.life || 6.5, c1: o.c1 ?? 0xe64a19, c2: o.c2 ?? 0xff8a50, n: o.n || 3 }); },
    update(dt, hitTest, onHit) {
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.life -= dt; s.v.y -= s.grav * dt;
        _a.copy(s.m.position); _b.copy(_a).addScaledVector(s.v, dt);
        // world
        const d = _b.clone().sub(_a), L = d.length();
        const tw = L > 0 ? col.raycast(_a.x, _a.y, _a.z, d.x / L, d.y / L, d.z / L, L) : L;
        const gy = col.groundHeight(_b.x, _b.z, _b.y + 0.5).h;
        const hit = hitTest(_a, _b, s.kind);
        let done = s.life <= 0;
        if (hit && (hit.t * L <= tw)) { s.m.position.lerpVectors(_a, _b, hit.t); onHit(s.kind, hit.target, s.m.position.clone(), s.v.clone()); done = true; }
        else if (tw < L - 1e-3 || _b.y <= gy) {
          if (tw < L - 1e-3) s.m.position.copy(_a).addScaledVector(d, tw / L); else { s.m.position.copy(_b); s.m.position.y = gy + 0.05; }
          onHit(s.kind, null, s.m.position.clone(), s.v.clone()); done = true;
        } else s.m.position.copy(_b);
        if (s.line) { const pa = s.line.geometry.attributes.position; pa.setXYZ(0, s.origin.x, s.origin.y, s.origin.z); pa.setXYZ(1, s.m.position.x, s.m.position.y, s.m.position.z); pa.needsUpdate = true; s.line.geometry.computeBoundingSphere(); }
        if (s.kind === 'bomb') smoke.emit(s.m.position.x, s.m.position.y, s.m.position.z, 0, 0.3, 0, 0.35, 0xd84315, -0.2);
        if (done) { scene.remove(s.m); if (s.line) { const l = s.line; setTimeout(() => { scene.remove(l); l.geometry.dispose(); }, 120); } shots.splice(i, 1); }
      }
      for (let i = clouds.length - 1; i >= 0; i--) {
        const c = clouds[i]; c.t += dt;
        if (c.t > c.life) { clouds.splice(i, 1); continue; }
        const k = 1 - c.t / c.life;
        for (let j = 0; j < c.n; j++) { const a = Math.random() * 6.28, r = Math.random() * c.r * Math.min(1, c.t * 3); smoke.emit(c.x + Math.cos(a) * r, c.y + 0.3 + Math.random() * 1.6, c.z + Math.sin(a) * r, (Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6, 1.4 * k + 0.3, Math.random() < 0.5 ? c.c1 : c.c2, -0.15); }
      }
      for (const f of flashes) { if (f.t > 0) { f.t -= dt; if (f.t <= 0) f.l.intensity = 0; } }
      for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t -= dt; if (t.t <= 0) { scene.remove(t.l); t.l.geometry.dispose(); tracers.splice(i, 1); } }
      for (const l of lasers.values()) { if (!l._seen) l.visible = false; l._seen = false; }
      sparks.update(dt); smoke.update(dt);
    },
    clearLaser(owner) { const l = lasers.get(owner); if (l) l.visible = false; },
  };
  return fx;
}
