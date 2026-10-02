// Street throws: Bolaji can't afford gadgets, so he uses what Lagos leaves lying around. Stones and bricks
// hurt, bottles smash and stun, a pure water sachet in the face blinds for a moment, a bucket over the head
// blinds longer, a tyre knocks people flat. With nothing in reach he can throw his skateboard (and must go
// and pick it up). Red Cap throwers use the same projectiles against him.
import * as THREE from 'three';

export const KINDS = {
  stone:  { dmg: 1, effect: 'stagger', stay: true,  label: 'stone' },
  brick:  { dmg: 2, effect: 'stagger', stay: true,  label: 'brick' },
  bottle: { dmg: 1, effect: 'stun', stay: false, label: 'bottle' },
  sachet: { dmg: 0, effect: 'blind', stay: false, label: 'pure water' },
  bucket: { dmg: 0, effect: 'blind', stay: true,  label: 'bucket', blind: 3.2 },
  tyre:   { dmg: 2, effect: 'down', stay: true,  label: 'tyre' },
  board:  { dmg: 2, effect: 'down', stay: true,  label: 'skateboard' },
};
const G = 18;

function meshFor(kind) {
  const m = (geo, color, opts: any = {}) => new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts }));
  switch (kind) {
    case 'stone': return m(new THREE.DodecahedronGeometry(0.1, 0), '#8a857c');
    case 'brick': return m(new THREE.BoxGeometry(0.22, 0.08, 0.11), '#9a4a32');
    case 'bottle': { const g = new THREE.Group(); g.add(m(new THREE.CylinderGeometry(0.04, 0.045, 0.2, 8), '#2e7d32', { transparent: true, opacity: 0.8, roughness: 0.2 })); const n = m(new THREE.CylinderGeometry(0.015, 0.03, 0.08, 6), '#2e7d32', { transparent: true, opacity: 0.8 }); n.position.y = 0.14; g.add(n); return g; }
    case 'sachet': return m(new THREE.SphereGeometry(0.09, 8, 6), '#e8f4ff', { transparent: true, opacity: 0.85, roughness: 0.1 });
    case 'bucket': return m(new THREE.CylinderGeometry(0.17, 0.13, 0.28, 12, 1, true), '#1976d2', { side: THREE.DoubleSide });
    case 'tyre': return m(new THREE.TorusGeometry(0.26, 0.1, 8, 16), '#1a1a1a');
  }
}

export function createThrowables(scene, world) {
  const col = world.collision;
  const items: any[] = [];   // lying around, or held
  const flying: any[] = [];  // in the air
  const R = Math.random;
  const place = (kind, x, z) => {
    const mesh = meshFor(kind); mesh.castShadow = true;
    const g = col.groundHeight(x, z, 3).h;
    mesh.position.set(x, g + 0.09, z); mesh.rotation.set(kind === 'tyre' ? Math.PI / 2 : 0, R() * 6, 0);
    scene.add(mesh);
    const it = { kind, mesh, held: false };
    items.push(it); return it;
  };
  // scatter junk along sidewalks, under the bridge, in the market and the motor park
  const W = ['stone', 'stone', 'brick', 'bottle', 'bottle', 'sachet', 'sachet', 'bucket', 'tyre'];
  for (const s of world.spots) if (R() < 0.35) place(W[Math.floor(R() * W.length)], s.x + (R() - 0.5) * 3, s.z + (R() - 0.5) * 1.2);
  for (const u of world.underBridge || []) for (let k = 0; k < 6; k++) place(W[Math.floor(R() * W.length)], u.x0 + 2 + R() * (u.x1 - u.x0 - 4), u.z0 + 2 + R() * (u.z1 - u.z0 - 4));
  for (const st of world.stalls || []) if (R() < 0.25) place(R() < 0.5 ? 'sachet' : 'bucket', st.x + 1.5, st.z);
  const mp = world.motorparkSpot; for (let k = 0; k < 10; k++) place(k % 3 ? 'tyre' : 'bottle', mp.x - 20 + R() * 35, mp.z - 5 - R() * 15);

  const T: any = {
    items, flying,
    scatter(x, z, n = 4) { for (let k = 0; k < n; k++) place(W[Math.floor(R() * W.length)], x + (R() - 0.5) * 8, z + (R() - 0.5) * 8); },
    nearest(p, r = 2) { let best = null, bd = r * r; for (const it of items) { if (it.held) continue; const d = (it.mesh.position.x - p.x) ** 2 + (it.mesh.position.z - p.z) ** 2; if (d < bd && Math.abs(it.mesh.position.y - p.y) < 1.4) { bd = d; best = it; } } return best; },
    pickUp(it, hand) { it.held = true; hand.add(it.mesh); it.mesh.position.set(0, -0.1, 0.05); it.mesh.rotation.set(0, 0, 0); if (it.kind === 'tyre') it.mesh.scale.setScalar(0.8); },
    drop(it, pos) { it.held = false; it.mesh.parent?.remove(it.mesh); scene.add(it.mesh); it.mesh.scale.setScalar(1); it.mesh.position.set(pos.x, col.groundHeight(pos.x, pos.z, pos.y + 1).h + 0.09, pos.z); },
    // launch an item (or the board, or an enemy bottle) along a lob that lands at `to`
    launch(kind, mesh, from, to, owner, speed = 22) {
      if (mesh.parent) mesh.parent.remove(mesh);
      scene.add(mesh); mesh.position.copy(from); mesh.scale.setScalar(1);
      const dx = to.x - from.x, dz = to.z - from.z, dh = Math.hypot(dx, dz), t = Math.max(0.25, dh / speed);
      const v = new THREE.Vector3(dx / t, (to.y - from.y + 0.5 * G * t * t) / t, dz / t);
      flying.push({ kind, mesh, v, owner, life: 3, spin: new THREE.Vector3(R() * 12, R() * 12, R() * 12) });
    },
    enemyBottle(from, to) { const m = meshFor('bottle'); T.launch('bottle', m, from, to, 'enemy', 15); },
    enemyKnife(from, to) { // a thrown blade: flat, fast, almost no arc
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.32), new THREE.MeshStandardMaterial({ color: '#cfd8dc', metalness: 0.9, roughness: 0.2 }));
      T.launch('knife', m, from, to, 'enemy', 30);
    },
    // hitTest(a, b, owner) -> { t, target } ; onHit(kind, target|null, pos, owner)
    update(dt, hitTest, onHit) {
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i];
        f.life -= dt; f.v.y -= G * dt;
        const a = f.mesh.position.clone(), b = a.clone().addScaledVector(f.v, dt);
        f.mesh.rotation.x += f.spin.x * dt; f.mesh.rotation.y += f.spin.y * dt; f.mesh.rotation.z += f.spin.z * dt;
        const hit = hitTest(a, b, f.owner);
        const L = a.distanceTo(b), d = b.clone().sub(a).normalize();
        const tw = L > 0 ? col.raycast(a.x, a.y, a.z, d.x, d.y, d.z, L) : L;
        const gy = col.groundHeight(b.x, b.z, b.y + 0.5).h;
        let done = false;
        if (hit && hit.t * L <= tw) { f.mesh.position.lerpVectors(a, b, hit.t); onHit(f.kind, hit.target, f.mesh.position.clone(), f.owner); done = true; }
        else if (tw < L - 1e-3 || b.y <= gy || f.life <= 0) { f.mesh.position.copy(a).addScaledVector(d, Math.min(tw, L)); onHit(f.kind, null, f.mesh.position.clone(), f.owner); done = true; }
        else f.mesh.position.copy(b);
        if (done) {
          flying.splice(i, 1);
          const k = KINDS[f.kind];
          if (f.owner === 'player' && k.stay) { // it lies where it fell and can be picked up again
            const p = f.mesh.position; p.y = col.groundHeight(p.x, p.z, p.y + 1).h + 0.09; f.mesh.rotation.set(f.kind === 'tyre' ? Math.PI / 2 : 0, R() * 6, 0);
            if (f.kind === 'board') T.boardOnGround = f.mesh; else items.push({ kind: f.kind, mesh: f.mesh, held: false });
          } else scene.remove(f.mesh);
        }
      }
    },
  };
  return T;
}
