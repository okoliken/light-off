// Agberos (touts collecting "levy" from traders), the traders and families Bolaji helps, and the
// money bag. Agberos stand guard, chase on foot, wind up telegraphed punches, get stunned, knocked down.
import * as THREE from 'three';
import { Rig, Pose, OUTFITS, HIP_H } from '../player/rig.ts';

const TRADER_OUTFITS = [
  { skin: '#5a3825', top: '#e65100', bottom: '#6a1b9a', sock: '#3e2723', sole: '#2b2b2b', cap: '#e65100', sheen: '#886655' },
  { skin: '#4a2e20', top: '#00897b', bottom: '#fbc02d', sock: '#3e2723', sole: '#2b2b2b', cap: '#00897b', sheen: '#557766' },
  { skin: '#3b2418', top: '#c2185b', bottom: '#1565c0', sock: '#3e2723', sole: '#2b2b2b', cap: '#c2185b', sheen: '#775566' },
  { skin: '#5b3a26', top: '#eeeeee', bottom: '#5d4037', sock: '#3e2723', sole: '#2b2b2b', cap: null, sheen: '#777777' },
];

export function makeBag() {
  const g = new THREE.Group();
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: '#8d6e3f', roughness: 0.9 }));
  sack.scale.set(1, 1.15, 0.8); g.add(sack);
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.08, 8), new THREE.MeshStandardMaterial({ color: '#5d4a2a' }));
  tie.position.y = 0.19; g.add(tie);
  const note = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.07), new THREE.MeshStandardMaterial({ color: '#7cb342', emissive: '#1b5e20', emissiveIntensity: 0.4 }));
  note.position.set(0.02, 0.24, 0.02); note.rotation.set(0.3, 0.5, 0.2); g.add(note);
  g.traverse(m => { if ((m as any).isMesh) m.castShadow = true; });
  return g;
}

export class Agbero {
  [key: string]: any; // TODO(ts): declare fields
  constructor(scene, world, { x, z, yaw, collector = false, big = false }: any) {
    this.world = world;
    this.rig = new Rig(collector ? OUTFITS.agbero : OUTFITS.agbero2);
    if (big) this.rig.root.scale.setScalar(1.18);
    scene.add(this.rig.root);
    this.home = new THREE.Vector3(x, 0.15, z); this.homeYaw = yaw;
    this.pos = this.home.clone(); this.vel = new THREE.Vector3(); this.yaw = yaw;
    this.maxHp = big ? 4 : collector ? 3 : 2; this.hp = this.maxHp;
    this.state = 'idle'; this.t = 0; this.anim = Math.random() * 9; this.atkCd = 0;
    this.collector = collector; this.big = big;
    this.hasBag = collector; this.bag = null;
    if (collector) { this.bag = makeBag(); this.bag.position.set(0, -0.2, 0.02); this.rig.b.haR.add(this.bag); }
    this.idleGesture = Math.random() * 5;
    this.alertT = 0; this.giveUp = 0; this.bark = 0;
  }
  get alive() { return this.state !== 'down'; }
  stun(dur) { if (this.alive) { this.state = 'stunned'; this.t = 0; this.stunDur = dur; } }
  blind(dur) { if (this.alive) { this.state = 'blinded'; this.t = 0; this.blindDur = dur; } }
  alert(delay = 0.4) { if (this.state === 'idle' || this.state === 'return') { this.state = 'alert'; this.t = -delay; } }
  takeBag() { this.hasBag = false; if (this.bag) { this.bag.parent?.remove(this.bag); this.bag = null; } }
  giveBag() { if (!this.collector) return; this.hasBag = true; if (!this.bag) { this.bag = makeBag(); this.bag.position.set(0, -0.2, 0.02); this.rig.b.haR.add(this.bag); } }

  hit(dmg, fromX, fromZ, knock) {
    if (this.state === 'down') return false;
    this.hp -= dmg;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
    this.vel.x = (dx / d) * knock; this.vel.z = (dz / d) * knock;
    if (this.hp <= 0) { this.state = 'down'; this.t = 0; this.vel.multiplyScalar(1.3); return true; }
    this.state = 'stunned'; this.t = 0; this.stunDur = 0.55;
    return false;
  }

  // returns 'hitPlayer' when a punch lands
  update(dt, game) {
    const p = game.player, col = this.world.collision;
    this.t += dt; this.atkCd -= dt; this.bark -= dt;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    const toP = Math.atan2(dx, dz);
    let moveSpeed = 0, faceYaw = this.yaw, result = null;
    const r = this.rig;
    const playerReachable = p.pos.y - this.pos.y < 1.6 && p.mode !== 'down';

    switch (this.state) {
      case 'idle': {
        this.idleGesture -= dt;
        Pose.idle(r, game.time + this.anim, false);
        if (this.collector) { r.set('shRX', -0.5); r.set('elRX', -1.2); }
        if (this.idleGesture < 0) { this.idleGesture = 3 + Math.random() * 4; this.gestT = 0; }
        this.gestT = (this.gestT ?? 9) + dt;
        if (this.gestT < 1.2) { r.set('shLX', -1.1 + Math.sin(this.gestT * 9) * 0.3); r.set('elLX', -0.9); } // pointing / arguing
        faceYaw = this.homeYaw;
        break;
      }
      case 'alert': {
        faceYaw = toP; Pose.idle(r, game.time, true);
        if (this.t > 0) { this.state = 'chase'; this.t = 0; this.giveUp = 0; if (this.bark <= 0) { this.bark = 6; game.say(this, pick(['Ole! Thief!', 'Catch am!', 'Oya come here!', 'You dey craze?'])); } }
        break;
      }
      case 'chase': {
        faceYaw = toP;
        if (!playerReachable || dist > 45) this.giveUp += dt; else this.giveUp = Math.max(0, this.giveUp - dt);
        if (this.giveUp > 5 || game.player.mode === 'down') { this.state = 'return'; this.t = 0; if (this.bark <= 0 && dist < 40) { this.bark = 8; game.say(this, pick(['We go see you!', 'Chairman go hear this!', 'Run, you hear?'])); } break; }
        if (dist < 1.35 && playerReachable) { if (this.atkCd <= 0) { this.state = 'windup'; this.t = 0; } else Pose.idle(r, game.time, true); }
        else { moveSpeed = playerReachable ? (this.big ? 5.4 : 6.3) : 1.5; }
        break;
      }
      case 'windup': {
        faceYaw = toP; Pose.idle(r, game.time, true);
        r.set('shRX', 0.9); r.set('elRX', -1.8); r.set('chestY', 0.6); // telegraph: arm drawn back
        if (this.t > (this.big ? 0.6 : 0.45)) {
          this.state = 'strike'; this.t = 0;
          const fwd = Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz;
          if (dist < 1.9 && fwd > 0 && playerReachable) result = 'hitPlayer';
        }
        break;
      }
      case 'strike': {
        faceYaw = this.yaw; Pose.idle(r, game.time, true); Pose.punch(r, 'R', 0.5);
        if (this.t > 0.35) { this.state = 'chase'; this.atkCd = this.big ? 1.3 : 1.0; }
        break;
      }
      case 'stunned': {
        const sd = this.stunDur || 0.55;
        Pose.idle(r, game.time, false); Pose.stagger(r, this.t / sd);
        if (this.t > sd) { this.state = 'chase'; this.atkCd = 0.4; this.stunDur = 0; }
        break;
      }
      case 'blinded': {
        Pose.cough(r, game.time);
        if (this.t > this.blindDur) { this.state = 'chase'; this.atkCd = 0.6; }
        break;
      }
      case 'down': {
        Pose.down(r);
        if (this.t > 22) { this.hp = this.maxHp; this.state = 'return'; this.t = 0; }
        break;
      }
      case 'return': {
        const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z, hd = Math.hypot(hx, hz);
        faceYaw = Math.atan2(hx, hz); moveSpeed = 2.2;
        if (hd < 0.6) { this.state = 'idle'; this.pos.x = this.home.x; this.pos.z = this.home.z; moveSpeed = 0; }
        break;
      }
    }
    // steer
    this.yaw += wrap(faceYaw - this.yaw) * Math.min(1, dt * 10);
    if (moveSpeed > 0) {
      const tx = Math.sin(faceYaw) * moveSpeed, tz = Math.cos(faceYaw) * moveSpeed;
      this.vel.x += (tx - this.vel.x) * Math.min(1, dt * 8); this.vel.z += (tz - this.vel.z) * Math.min(1, dt * 8);
      this.anim += dt * (1.3 * moveSpeed + 1.5);
      Pose.run(r, this.anim, Math.min(1, moveSpeed / 8));
    } else { const f = Math.max(0, 1 - dt * 6); this.vel.x *= f; this.vel.z *= f; }
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    col.resolve(this.pos, this.pos.y, 0.36, 1.8, _c);
    const g = col.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.2);
    this.pos.y += (g.h - this.pos.y) * Math.min(1, dt * 12);
    r.update(dt, this.state === 'strike' ? 30 : 12);
    r.root.position.copy(this.pos); r.root.rotation.y = this.yaw;
    return result;
  }
}
const _c: any[] = [];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const pick = a => a[Math.floor(Math.random() * a.length)];

// traders and the families Bolaji delivers to: they stand, gesture, cheer
export class Civilian {
  [key: string]: any; // TODO(ts): declare fields
  constructor(scene, world, { x, z, yaw, outfit }: any) {
    this.rig = new Rig(outfit || TRADER_OUTFITS[Math.floor(Math.random() * TRADER_OUTFITS.length)]);
    for (const m of this.rig.meshes) m.castShadow = false;
    this.rig.root.position.set(x, 0.15, z);
    this.world = world;
    const g = world.collision.groundHeight(x, z, 1);
    this.rig.root.position.y = g.h;
    this.rig.root.rotation.y = yaw; this.yaw = yaw;
    this.pos = this.rig.root.position;
    scene.add(this.rig.root);
    this.mood = 'idle'; this.t = 0; this.seed = Math.random() * 10;
  }
  update(dt, game) {
    this.t += dt;
    const r = this.rig;
    Pose.idle(r, game.time + this.seed, false);
    if (this.mood === 'scared') { r.set('shLX', -1.3); r.set('elLX', -2.0); r.set('shRX', -1.3); r.set('elRX', -2.0); r.set('spineX', 0.3); r.set('hipsY', HIP_H - 0.15); r.set('knLX', 0.5); r.set('knRX', 0.5); r.set('thLX', -0.3); r.set('thRX', -0.3); }
    if (this.mood === 'cheer') { const k = Math.sin(this.t * 10); r.set('shLX', -2.8 + k * 0.2); r.set('shRX', -2.8 - k * 0.2); r.set('elLX', -0.3); r.set('elRX', -0.3); r.set('hipsY', HIP_H + Math.max(0, k) * 0.08); }
    if (this.mood === 'wave') { r.set('shRX', -2.6); r.set('shRZ', -0.4); r.set('elRX', -0.4 + Math.sin(this.t * 8) * 0.5); }
    if (this.mood === 'chat') { const k = Math.sin((game.time + this.seed) * 2.3); if (k > 0.3) { r.set('shRX', -0.9 - k * 0.4); r.set('elRX', -1.2); } if (Math.sin((game.time + this.seed) * 1.7) > 0.5) { r.set('shLX', -0.7); r.set('elLX', -1.5); } r.set('headY', Math.sin((game.time + this.seed) * 0.9) * 0.4); }
    if (this.mood === 'cower') { Pose.cower(r, game.time + this.seed); if (this.flinch > 0) { this.flinch -= dt; r.set('spineX', 1.25); r.set('headX', 0.7); } }
    if (this.mood === 'captive') Pose.kneelTied(r, game.time + this.seed);
    if (this.mood === 'run' && this.runTo) {
      const dx = this.runTo.x - this.pos.x, dz = this.runTo.z - this.pos.z, d = Math.hypot(dx, dz);
      this.runT = (this.runT || 0) + dt;
      if (d < 1 || this.runT > 14) { this.gone = true; this.remove(game.scene); return; }
      this.yaw = Math.atan2(dx, dz); r.root.rotation.y = this.yaw;
      this.pos.x += dx / d * 4.6 * dt; this.pos.z += dz / d * 4.6 * dt;
      this.world.collision.resolve(this.pos, this.pos.y, 0.3, 1.7, []);
      this.pos.y = this.world.collision.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.3).h;
      this.anim = (this.anim || 0) + dt * 8; Pose.run(r, this.anim, 0.7);
    }
    if (this.faceTarget) { const d = Math.atan2(this.faceTarget.x - this.pos.x, this.faceTarget.z - this.pos.z); this.yaw += wrap(d - this.yaw) * Math.min(1, dt * 4); r.root.rotation.y = this.yaw; }
    r.update(dt, 10);
  }
  hurtFlash() { this.flinch = 0.25; }
  runHome(x, z) { this.mood = 'run'; this.runTo = { x, z }; this.runT = 0; }
  remove(scene) { this.gone = true; scene.remove(this.rig.root); }
}
