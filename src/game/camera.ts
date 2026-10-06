// Third-person orbit camera: mouse / right stick look, auto-follows the board's heading when you stop
// steering the camera, pulls back and widens with speed, and never clips into buildings.
import * as THREE from 'three';

export function createCamera(aspect, world) {
  const cam = new THREE.PerspectiveCamera(68, aspect, 0.1, 900);
  const col = world.collision;
  const c: any = { cam, yaw: Math.PI, pitch: 0.28, dist: 5, idle: 9, shake: 0, fov: 68 };
  const target = new THREE.Vector3(), smooth = new THREE.Vector3(), _d = new THREE.Vector3();
  let first = true;

  // indoors: a fixed camera up in a ceiling corner that watches the whole room
  let corner = null;
  const roomCam = (dt, input, player) => {
    const R = world.room, p = player.pos;
    // use the corner farthest from him; only switch when he walks right up to the current one
    const far = R.corners.reduce((a, b) => (Math.hypot(b.x - p.x, b.z - p.z) > Math.hypot(a.x - p.x, a.z - p.z) ? b : a));
    if (!corner || Math.hypot(corner.x - p.x, corner.z - p.z) < 2.2) corner = far;
    if (first) { cam.position.set(corner.x, corner.y, corner.z); first = false; }
    const k = 1 - Math.exp(-dt * 4);
    cam.position.x += (corner.x - cam.position.x) * k; cam.position.y += (corner.y - cam.position.y) * k; cam.position.z += (corner.z - cam.position.z) * k;
    smooth.x += (p.x - smooth.x) * Math.min(1, dt * 8); smooth.y += (p.y + 1.0 - smooth.y) * Math.min(1, dt * 8); smooth.z += (p.z - smooth.z) * Math.min(1, dt * 8);
    // steer relative to this camera: W walks away from it
    c.yaw = Math.atan2(p.x - cam.position.x, p.z - cam.position.z);
    if (Math.abs(cam.fov - 74) > 0.05) { cam.fov = 74; c.fov = 74; cam.updateProjectionMatrix(); }
    cam.lookAt(smooth.x, smooth.y, smooth.z);
    void input;
  };
  let wasInside = false;

  c.update = (dt, input, player, sensitivity = 1) => {
    const inside = !!player.inRoom?.();
    if (inside !== wasInside) { wasInside = inside; first = true; corner = null; if (!inside) { c.pitch = 0.28; c.yaw = player.yaw; } }
    if (inside) { roomCam(dt, input, player); return; }
    const lx = input.look.dx, ly = input.look.dy;
    if (lx || ly) c.idle = 0; else c.idle += dt;
    c.yaw -= lx * 0.0024 * sensitivity;
    c.pitch = Math.max(-0.35, Math.min(1.2, c.pitch + ly * 0.0022 * sensitivity));

    const onBoard = ['board', 'grind', 'skitch', 'ride', 'bike'].includes(player.mode);
    const hs = Math.hypot(player.vel.x, player.vel.z);
    // auto-follow: swing behind the direction of travel when the player isn't steering the camera
    if (c.lockOn && !player.aiming) { // locked on: swing round so the target stays in view, the player can still look away
      const want = Math.atan2(c.lockOn.x - player.pos.x, c.lockOn.z - player.pos.z);
      let d = want - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.hypot(c.lockOn.x - player.pos.x, c.lockOn.z - player.pos.z) > 1.5) c.yaw += d * Math.min(1, dt * (c.idle > 0.5 ? 4 : 1.2));
    } else if (c.idle > 1.1 && (onBoard || hs > 3) && player.mode !== 'climb' && !player.aiming) {
      const want = onBoard ? player.heading : Math.atan2(player.vel.x, player.vel.z);
      let d = want - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      c.yaw += d * Math.min(1, dt * (onBoard ? 1.6 : 0.9) * Math.min(1, hs / 6));
      c.pitch += (0.26 - c.pitch) * Math.min(1, dt * 0.8);
    }
    if (player.mode === 'climb' && c.idle > 0.6) {
      let d = player.yaw - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      c.yaw += d * Math.min(1, dt * 2);
    }
    const wantDist = c.closeUp ? c.closeUp : player.inRoom?.() ? 2.1 : player.aiming ? 2.6 : (onBoard ? 6.2 : 5.6) + Math.min(2.4, hs * 0.12) + (player.mode === 'down' ? 2 : 0);
    c.dist += (wantDist - c.dist) * Math.min(1, dt * 3);
    const wantFov = player.aiming ? 52 : 66 + Math.min(20, Math.max(0, hs - 5) * 1.3);
    c.fov += (wantFov - c.fov) * Math.min(1, dt * (player.aiming ? 10 : 3));
    c.dist += (wantDist - c.dist) * Math.min(1, dt * (player.aiming ? 9 : 0));
    c.sh = (c.sh ?? 0.45) + ((player.aiming ? 0.75 : 0.45) - (c.sh ?? 0.45)) * Math.min(1, dt * 9);
    if (Math.abs(cam.fov - c.fov) > 0.05) { cam.fov = c.fov; cam.updateProjectionMatrix(); }

    target.set(player.pos.x, player.pos.y + (player.mode === 'down' ? 0.6 : 1.55), player.pos.z);
    if (first) { smooth.copy(target); first = false; }
    // soften vertical motion (jumps, curbs) more than horizontal
    const kh = 1 - Math.exp(-dt * 22), kv = 1 - Math.exp(-dt * 9);
    smooth.x += (target.x - smooth.x) * kh; smooth.z += (target.z - smooth.z) * kh; smooth.y += (target.y - smooth.y) * kv;

    // shoulder offset to the right so the character isn't dead centre
    const sx = -Math.cos(c.yaw) * c.sh, sz = Math.sin(c.yaw) * c.sh;
    const ox = smooth.x + sx, oy = smooth.y, oz = smooth.z + sz;
    // if a wall is behind him, rise up over it instead of zooming into his back
    let pitch = c.pitch, dist = c.dist, hit = 0;
    for (const lift of [0, 0.3, 0.6, 0.9]) {
      pitch = Math.min(1.35, c.pitch + lift);
      const cp = Math.cos(pitch);
      _d.set(-Math.sin(c.yaw) * cp, Math.sin(pitch), -Math.cos(c.yaw) * cp);
      hit = col.raycast(ox, oy, oz, _d.x, _d.y, _d.z, c.dist + 0.3);
      if (hit >= c.dist * 0.75) break;
    }
    c.liftP = (c.liftP ?? pitch) + (pitch - (c.liftP ?? pitch)) * Math.min(1, dt * 5);
    { const cp = Math.cos(c.liftP); _d.set(-Math.sin(c.yaw) * cp, Math.sin(c.liftP), -Math.cos(c.yaw) * cp); hit = col.raycast(ox, oy, oz, _d.x, _d.y, _d.z, c.dist + 0.3); }
    dist = Math.max(1.2, Math.min(dist, hit - 0.3));
    cam.position.set(ox + _d.x * dist, Math.max(oy + _d.y * dist, 0.35), oz + _d.z * dist);
    c.shake = Math.max(c.shake - dt * 2.5, player.shake * 0.6);
    if (c.shake > 0) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * c.shake * 0.25, (Math.random() - 0.5) * c.shake * 0.25, 0));
    cam.lookAt(ox, oy, oz);
  };
  c.snapBehind = (yaw) => { c.yaw = yaw; c.pitch = 0.28; first = true; };
  return c;
}
