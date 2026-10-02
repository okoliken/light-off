// Wayfinding: a glowing guide arrow floating over Bolaji that points along the road route to wherever
// help is needed (getaway car, robbers, money, family, UNILAG gate, the nearest levy point), and, while
// Street Sense is held, a trail of chevrons on the ground leading there.
import * as THREE from 'three';

const TRAIL = 36, SPACING = 3.2;

export function createNav(scene, world) {
  const col = world.collision;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.95); shape.lineTo(0.6, 0.12); shape.lineTo(0.22, 0.12); shape.lineTo(0.22, -0.6);
  shape.lineTo(-0.22, -0.6); shape.lineTo(-0.22, 0.12); shape.lineTo(-0.6, 0.12); shape.closePath();
  const arrowGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false }).rotateX(Math.PI / 2);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthTest: false, toneMapped: false });
  const arrow = new THREE.Mesh(arrowGeo, arrowMat);
  arrow.renderOrder = 20; arrow.scale.setScalar(0.55); arrow.visible = false;
  const holder = new THREE.Group(); holder.add(arrow); scene.add(holder);

  const chev = new THREE.Shape();
  chev.moveTo(0, 0.5); chev.lineTo(0.55, -0.1); chev.lineTo(0.35, -0.3); chev.lineTo(0, 0.1); chev.lineTo(-0.35, -0.3); chev.lineTo(-0.55, -0.1); chev.closePath();
  const chevGeo = new THREE.ShapeGeometry(chev).rotateX(-Math.PI / 2);
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const trail = new THREE.InstancedMesh(chevGeo, trailMat, TRAIL);
  trail.frustumCulled = false; trail.renderOrder = 3; scene.add(trail);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let yawS = 0, fade = 0, scroll = 0;
  const col3 = new THREE.Color();

  return {
    get trailCount() { return trail.count; },
    update(dt, game, time) {
      const p = game.player, t = game.nav, route = game.navRoute;
      const show = t && route && route.length && p.mode !== 'down';
      const d = show ? Math.hypot(t.x - p.pos.x, t.z - p.pos.z) : 0;
      fade += ((show && d > 6 ? 1 : 0) - fade) * Math.min(1, dt * 6);
      holder.visible = arrow.visible = fade > 0.02;
      if (show) {
        col3.set(t.color).multiplyScalar(1.5);
        arrowMat.color.copy(col3); trailMat.color.set(t.color).multiplyScalar(1.6);
        const [nx, nz] = route[0];
        const want = Math.atan2(nx - p.pos.x, nz - p.pos.z);
        yawS += Math.atan2(Math.sin(want - yawS), Math.cos(want - yawS)) * Math.min(1, dt * 10);
        const bob = Math.sin(time * 4) * 0.06;
        holder.position.set(p.pos.x + Math.sin(yawS) * 1.5, p.pos.y + 2.0 + bob, p.pos.z + Math.cos(yawS) * 1.5);
        holder.rotation.set(0, yawS, 0);
        arrow.rotation.x = -0.25; // tilt toward the camera so it reads from behind
        const pulse = 1 + Math.sin(time * 6) * 0.06;
        arrow.scale.setScalar(0.42 * pulse);
        arrowMat.opacity = 0.92 * fade;
      }
      // Street Sense trail along the route
      let n = 0;
      if (show && game.sense) {
        scroll = (scroll + dt * 6) % SPACING;
        const pts: any[] = [[p.pos.x, p.pos.z], ...route];
        let carry = SPACING - scroll + 2;
        for (let i = 0; i < pts.length - 1 && n < TRAIL; i++) {
          const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
          const L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
          const ux = (bx - ax) / L, uz = (bz - az) / L, yaw = Math.atan2(ux, uz);
          let s = carry;
          for (; s < L && n < TRAIL; s += SPACING) {
            const x = ax + ux * s, z = az + uz * s;
            const y = col.groundHeight(x, z, p.pos.y + 2).h + 0.08;
            e.set(0, yaw, 0); q.setFromEuler(e);
            const k = 1 - n / TRAIL;
            m4.compose(v.set(x, y, z), q, sc.set(0.9 * (0.6 + 0.4 * k), 1, 0.9 * (0.6 + 0.4 * k)));
            trail.setMatrixAt(n++, m4);
          }
          carry = s - L;
        }
      }
      trail.count = n;
      trail.instanceMatrix.needsUpdate = true;
    },
  };
}
