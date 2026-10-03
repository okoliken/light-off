// The Red Caps: an agbero cult. Out of combat they do harm in plain sight (beating people, guarding
// captives, collecting "levy", patrolling). In combat they circle Bolaji and take turns attacking.
// Every attack is announced by his danger sense, so he can counter it. They can be staggered, knocked
// down, launched and juggled in the air, slammed, webbed to the ground, and knocked out.
import * as THREE from 'three';
import { Rig, Pose, OUTFITS, HIP_H } from '../player/rig.ts';
import { makeBag } from './npcs.ts';

const G = 22;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const pick = a => a[Math.floor(Math.random() * a.length)];
const _c: any[] = [];
const HP = { gboy: 5, general: 34, impostor: 6, redcap: 4, redcap2: 4, brute: 8, scorpion: 14, egungun: 12, chairman: 10, blade: 7 };

let webGeo = null, webMat = null;
function webBlob() {
  if (!webGeo) { webGeo = new THREE.IcosahedronGeometry(0.42, 1); webMat = new THREE.MeshStandardMaterial({ color: '#e8ecf0', roughness: 0.5, transparent: true, opacity: 0.88, emissive: '#223', emissiveIntensity: 0.3 }); }
  const g = new THREE.Group();
  const a = new THREE.Mesh(webGeo, webMat); a.scale.set(0.9, 1.9, 0.75); a.position.y = 1.0; g.add(a);
  const b = new THREE.Mesh(webGeo, webMat); b.scale.set(1.4, 0.25, 1.4); b.position.y = 0.05; g.add(b);
  return g;
}

export class Thug {
  [key: string]: any; // TODO(ts): declare fields
  constructor(scene, world, { x, z, y = 0, yaw = 0, variant = 'redcap', weapon = null, role = 'guard', group = null }: any) {
    this.scene = scene; this.world = world; this.variant = variant; this.weapon = weapon; this.role = role;
    this.rig = new Rig({ ...OUTFITS[variant], weapon: weapon === 'bottles' ? null : weapon });
    scene.add(this.rig.root);
    const g = world.collision.groundHeight(x, z, y + 2); // y: spawn on a raised surface (the bridge deck)
    this.pos = new THREE.Vector3(x, g.h, z); this.vel = new THREE.Vector3(); this.yaw = yaw;
    this.home = this.pos.clone(); this.homeYaw = yaw;
    this.maxHp = HP[variant] || 4; this.hp = this.maxHp;
    this.state = 'idle'; this.t = 0; this.anim = Math.random() * 9; this.cd = 0;
    this.ringR = 2.8 + Math.random() * 1.6; this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.group = group; this.big = variant === 'brute' || variant === 'scorpion' || variant === 'chairman' || variant === 'general';
    this.acro = variant === 'egungun' || variant === 'blade' || variant === 'general'; // trained: they flip away from plain strikes
    this.hasBag = false; this.bag = null; this.victim = null; this.patrol = null; this.pi = 0;
    this.kickT = Math.random(); this.removed = false; this.koT = 0; this.web = null; this.lost = 0;
    this.thrower = weapon === 'bottles' || variant === 'blade'; // the Patron's Blades throw knives from range
    if (this.thrower) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.24, 8), new THREE.MeshStandardMaterial({ color: '#2e7d32', transparent: true, opacity: 0.85, roughness: 0.2 })); b.position.set(0, -0.12, 0.03); this.rig.b.haR.add(b); }
  }
  get alive() { return this.state !== 'ko' && this.state !== 'fled' && !this.removed && !this.hidden; }
  get engaged() { return ['circle', 'windup', 'strike', 'recover', 'stagger', 'air', 'down', 'getup', 'webbed', 'alert', 'blinded', 'throwWind', 'evade'].includes(this.state); }
  get canAttack() { return this.state === 'circle'; }
  get airborne() { return this.state === 'air'; }
  get grounded() { return this.state === 'down' || this.state === 'webbed'; }
  get unblockable() { return this.weapon === 'machete' || this.weapon === 'axe' || this.state === 'throwWind'; }
  get damage() { return this.variant === 'general' ? 26 : this.variant === 'blade' ? 15 : this.variant === 'scorpion' ? 24 : this.weapon === 'axe' ? 22 : this.weapon === 'machete' ? 20 : this.variant === 'egungun' ? 14 : this.weapon === 'stick' ? 12 : this.weapon === 'knife' ? 10 : this.big ? 14 : 8; }
  stun(dur) { if (this.alive && !['air', 'down', 'ko'].includes(this.state)) { this.state = 'stagger'; this.t = 0; this.stagDur = dur; } }
  blind(dur) { if (this.alive && !['air', 'down', 'ko'].includes(this.state)) { this.state = 'blinded'; this.t = 0; this.blindDur = dur; } }
  flee() { this.state = 'fled'; this.t = 0; this.fleeYaw = this.yaw + Math.PI; }
  giveBag() { this.hasBag = true; if (!this.bag) { this.bag = makeBag(); this.bag.position.set(0, -0.2, 0.02); this.rig.b.haL.add(this.bag); } }
  takeBag() { this.hasBag = false; if (this.bag) { this.bag.parent?.remove(this.bag); this.bag = null; } }

  engage(delay = 0.3) {
    if (!this.alive) return;
    if (['idle', 'return', 'tail', 'patrol'].includes(this.state)) { this.state = 'alert'; this.t = -delay; if (this.group) for (const o of this.group) if (o !== this && o.alive && ['idle', 'return', 'patrol'].includes(o.state)) { o.state = 'alert'; o.t = -delay - Math.random() * 0.4; } }
  }
  telegraph() { this.state = 'windup'; this.t = 0; this.windDur = this.variant === 'blade' ? 0.42 : this.weapon === 'axe' ? 1.0 : this.weapon === 'machete' ? 0.85 : this.weapon === 'knife' ? 0.45 : this.big ? 0.8 : 0.62; }

  // kind: light | heavy | launch | air | slam | counter | takedown
  takeHit(dmg, fx, fz, kind = 'light') {
    if (!this.alive) return false;
    const dx = this.pos.x - fx, dz = this.pos.z - fz, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
    this.lastBlocked = false;
    // brutes and Scorpion guard against light hits from the front
    const facing = (Math.sin(this.yaw) * -nx + Math.cos(this.yaw) * -nz);
    if (this.big && kind === 'light' && facing > 0.35 && ['circle', 'recover', 'idle', 'alert'].includes(this.state)) {
      this.lastBlocked = true; this.vel.set(nx * 1.5, 0, nz * 1.5); this.state = 'circle'; return false;
    }
    // the Egúngún is an acrobat: he flips away from a lot of plain strikes
    if (this.acro && (kind === 'light' || kind === 'launch') && ['circle', 'recover', 'alert'].includes(this.state) && Math.random() < 0.45) {
      this.lastBlocked = true; this.evaded = true; this.state = 'evade'; this.t = 0; this.vel.set(nx * 7, 0, nz * 7); return false;
    }
    this.hp -= dmg;
    this.clearWeb();
    if (kind === 'takedown') { this.hp = 0; this.state = 'ko'; this.t = 0; return true; }
    if (kind === 'launch' && !(this.big && this.hp > 3)) { this.state = 'air'; this.t = 0; this.vel.set(nx * 0.8, 10.5, nz * 0.8); return this.hp <= 0; }
    if (kind === 'air' && this.state === 'air') { this.vel.set(nx * 0.6, 4.2, nz * 0.6); this.t = 0; this.juggle = 0.6; return this.hp <= 0; }
    if (kind === 'slam') { this.state = 'air'; this.t = 0; this.vel.set(nx * 2, -16, nz * 2); this.slammed = true; return this.hp <= 0; }
    if (kind === 'heavy' || kind === 'counter' || this.hp <= 0) {
      if (this.big && this.hp > 0 && kind === 'heavy') { this.state = 'stagger'; this.t = 0; this.stagDur = 0.5; this.vel.set(nx * 3, 0, nz * 3); return false; }
      this.state = 'down'; this.t = 0; this.vel.set(nx * 6, 0, nz * 6); return this.hp <= 0;
    }
    if (this.big && Math.random() < 0.5) { this.vel.set(nx * 1.2, 0, nz * 1.2); return false; } // brutes shrug off some jabs
    this.state = 'stagger'; this.t = 0; this.stagDur = 0.38; this.vel.set(nx * 2.4, 0, nz * 2.4);
    return false;
  }
  webUp(dur = 6) {
    if (!this.alive) return;
    this.state = 'webbed'; this.t = 0; this.webDur = dur; this.vel.set(0, 0, 0);
    if (!this.web) { this.web = webBlob(); this.rig.root.add(this.web); }
  }
  clearWeb() { if (this.web) { this.rig.root.remove(this.web); this.web = null; } }
  remove() { this.removed = true; this.clearWeb(); this.scene.remove(this.rig.root); }

  update(dt, game) {
    if (this.removed) return null;
    const p = game.player, col = this.world.collision, r = this.rig;
    this.t += dt; this.cd -= dt;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dist = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    const reachable = p.pos.y - this.pos.y < 1.6 && p.mode !== 'down';
    let face = this.yaw, speed = 0, out = null, rate = 12, ax = 0, az = 0;

    switch (this.state) {
      case 'idle': case 'patrol': {
        Pose.idle(r, game.time + this.anim, false);
        if (this.role === 'beater' && this.victim) {
          face = Math.atan2(this.victim.pos.x - this.pos.x, this.victim.pos.z - this.pos.z);
          this.kickT += dt;
          if (this.kickT > 1.3) { this.kickT = -Math.random() * 0.6; this.victim.hurtFlash?.(); game.fx?.dust(this.victim.pos.x, 0.3, this.victim.pos.z, 2); if (dist < 30) game.audio?.punch(); } // only heard up close
          if (this.kickT > 0 && this.kickT < 0.45) Pose.kickDown(r, this.kickT / 0.45);
          if (Math.random() < dt * 0.15) game.say(this, pick(['You no go pay?!', 'Na Red Caps own this street!', 'Shut up there!', 'Where the money?!']), 'Red Cap', 60);
        } else if (this.role === 'collector') { r.set('shLX', -0.4); r.set('elLX', -1.1); face = this.homeYaw; }
        else if (this.role === 'guard') { face = this.homeYaw + Math.sin(game.time * 0.4 + this.anim) * 0.6; if (this.weapon) { r.set('shRX', -0.3); r.set('elRX', -0.6); } }
        if (this.patrol) {
          const w = this.patrol[this.pi % this.patrol.length], wx = w[0] - this.pos.x, wz = w[1] - this.pos.z;
          const arrived = Math.hypot(wx, wz) < 1.5;
          if (arrived && this.patrol.length > 1) this.pi++;
          if (!(arrived && this.patrol.length === 1)) { face = Math.atan2(wx, wz); speed = 1.6; }
        }
        // do they notice him?
        const sight = (game.power < 0.5 ? 9 : 16) * (p.prone ? 0.4 : 1) * (game.torchOn ? 1.6 : 1);
        const facing = (Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz) / (dist || 1);
        if (!this.calm && reachable && dist < sight && (facing > -0.2 || dist < 4) && !col.blocked(this.pos.x, this.pos.y + 1.5, this.pos.z, p.pos.x, p.pos.y + 1.2, p.pos.z, 1.2)) this.engage(0.35);
        if (game.player.fightingNear && dist < 22) this.engage(0.2);
        break;
      }
      case 'alert': {
        face = toP; Pose.idle(r, game.time, true);
        if (this.t > 0) { this.state = 'circle'; this.t = 0; if (Math.random() < 0.5) game.say(this, pick(['Na him be that! Catch am!', 'Who be this one?!', 'You dey find trouble?', 'Surround am!']), 'Red Cap', 50); }
        break;
      }
      case 'circle': {
        face = toP;
        if (p.mode === 'down' || p.mode === 'getup') { // he's down: gloat, don't hit a man on the ground
          Pose.idle(r, game.time, false); r.set('shRX', -2.2 + Math.sin(game.time * 6) * 0.3); r.set('elRX', -0.6);
          if (dist < 3.5) { ax = -Math.sin(toP) * 2; az = -Math.cos(toP) * 2; }
          if (Math.random() < dt * 0.3) game.say(this, pick(['Na so! Stay there!', 'Where your power now?', 'Oya get up make we finish am!', 'Boy in black, abi?']), 'Red Cap', 40);
          break;
        }
        if (p.mode === 'crawl') { speed = 1.9; Pose.idle(r, game.time, true); break; } // closing in on him
        if (this.thrower && this.cd <= 0 && dist > 6 && dist < 17 && game.combat?.rangedOk?.() && !col.blocked(this.pos.x, this.pos.y + 1.6, this.pos.z, p.pos.x, p.pos.y + 1.2, p.pos.z, 1.2)) { this.state = 'throwWind'; this.t = 0; game.audio?.danger?.(true); break; }
        if (this.thrower) this.ringR = this.variant === 'blade' ? 4.5 : 9; // blades close in, throwing when you back off
        if (!reachable) { Pose.idle(r, game.time, true); r.set('shRX', -1.3); r.set('headX', -0.4); if (this.t > 8 && dist > 12) { this.state = 'return'; } break; }
        if (dist > 30) { this.lost += dt; if (this.lost > 6) { this.state = 'return'; this.lost = 0; } } else this.lost = 0;
        Pose.idle(r, game.time, true);
        if (dist > this.ringR + 1.2) { speed = dist > 8 ? 6.2 : 4.2; }
        else if (dist < this.ringR - 1) { ax = -Math.sin(toP) * 2.2; az = -Math.cos(toP) * 2.2; }
        else { if (Math.random() < dt * 0.4) this.strafe *= -1; const tx = -Math.cos(toP) * this.strafe, tz = Math.sin(toP) * this.strafe; ax = tx * 1.4; az = tz * 1.4; this.anim += dt * 3; }
        break;
      }
      case 'windup': {
        face = toP; Pose.idle(r, game.time, true);
        r.set('shRX', 0.9); r.set('elRX', -1.6); r.set('chestY', 0.7); r.set('spineX', -0.1); // arm drawn back
        if (this.weapon === 'knife') { r.set('shRX', 0.6); r.set('elRX', -1.9); r.set('chestY', 0.5); }
        else if (this.weapon === 'axe') { r.set('shRX', -2.9); r.set('shLX', -2.7); r.set('elRX', -0.5); r.set('elLX', -0.7); r.set('spineX', -0.3); }
        else if (this.weapon) { r.set('shRX', -2.7); r.set('elRX', -0.4); }
        if (dist > (this.weapon === 'axe' ? 2.5 : 2.2)) speed = this.weapon === 'knife' ? 4.5 : 3; // close in while winding up
        if (this.t >= this.windDur) { this.state = 'strike'; this.t = 0; this.hitDone = false; }
        break;
      }
      case 'strike': {
        face = this.yaw; Pose.idle(r, game.time, true);
        if (this.weapon === 'knife') { Pose.punch(r, 'R', Math.min(1, this.t / 0.15) * 0.6); }
        else if (this.weapon === 'axe') { const k = Math.min(1, this.t / 0.18); r.set('shRX', -2.9 + 2.6 * k); r.set('shLX', -2.7 + 2.4 * k); r.set('spineX', -0.3 + 0.7 * k); }
        else if (this.weapon) { r.set('shRX', -2.7 + 2.4 * Math.min(1, this.t / 0.15)); r.set('elRX', -0.1); r.set('chestY', -0.4); }
        else Pose.punch(r, 'R', Math.min(1, this.t / 0.25) * 0.5);
        if (this.t < 0.12) { ax = Math.sin(this.yaw) * 7; az = Math.cos(this.yaw) * 7; }
        if (!this.hitDone && this.t >= 0.12) {
          this.hitDone = true;
          const fwd = (Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz);
          if (dist < (this.weapon === 'axe' ? 2.4 : 1.9) && fwd > 0 && reachable && !['down', 'crawl', 'getup'].includes(p.mode)) out = { hit: this.damage };
        }
        if (this.t > 0.35) { this.state = 'recover'; this.t = 0; }
        rate = 28;
        break;
      }
      case 'throwWind': {
        face = toP; Pose.idle(r, game.time, false); r.set('shRX', -2.7); r.set('elRX', -1.2); r.set('chestY', 0.6);
        if (this.t > 0.85) {
          this.state = 'recover'; this.t = 0; this.cd = 3 + Math.random() * 2;
          r.root.updateMatrixWorld(true); const from = this.rig.b.haR.getWorldPosition(new THREE.Vector3());
          const lead = 0.5; out = { throwBottle: { from, to: new THREE.Vector3(p.pos.x + p.vel.x * lead, p.pos.y + 1.1, p.pos.z + p.vel.z * lead) } };
        }
        break;
      }
      case 'evade': { // backflip out of reach
        const k = Math.min(1, this.t / 0.5); Pose.flip(r, 'back', k); this.pos.y = Math.max(this.pos.y, col.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.3).h + Math.sin(k * Math.PI) * 1.4);
        const f = Math.max(0, 1 - dt * 3); this.vel.x *= f; this.vel.z *= f;
        this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; col.resolve(this.pos, this.pos.y, 0.36, 1.8, _c);
        if (this.t > 0.5) { this.state = 'circle'; this.t = 0; this.cd = 0; }
        r.update(dt, 20); r.root.position.copy(this.pos); r.root.rotation.y = this.yaw;
        return null;
      }
      case 'run': { // a thief running with something: along the streets (not into walls), glancing back
        this.routeT = (this.routeT || 0) - dt;
        if (!this.route || this.routeT <= 0) { this.routeT = 2; this.route = game.traffic?.route(this.pos.x, this.pos.z, this.yaw, this.runTo.x, this.runTo.z) || [[this.runTo.x, this.runTo.z]]; }
        while (this.route.length > 1 && Math.hypot(this.route[0][0] - this.pos.x, this.route[0][1] - this.pos.z) < 4) this.route.shift();
        const wp = this.route[0] || [this.runTo.x, this.runTo.z];
        const tx = wp[0] - this.pos.x, tz = wp[1] - this.pos.z;
        face = Math.atan2(tx, tz);
        // he speeds up when you're close, and tires over a long chase
        speed = (this.runSpeed || 6.4) * (dist < 10 ? 1.12 : 1) * Math.max(0.78, 1 - this.t / 140);
        this.anim += dt * 11; Pose.run(r, this.anim, 1);
        if (Math.sin(game.time * 1.7 + this.anim) > 0.93) r.set('headY', 2.4); // a look over his shoulder
        if (Math.hypot(this.runTo.x - this.pos.x, this.runTo.z - this.pos.z) < 3 || this.t > 50) { this.escaped = true; this.remove(); return null; }
        break;
      }
      case 'blinded': { Pose.cough(r, game.time); if (this.t > this.blindDur) { this.state = 'circle'; this.t = 0; } break; }
      case 'fled': {
        this.anim += dt * 11; Pose.run(r, this.anim, 1); face = this.fleeYaw; speed = this.fleeSpeed || (this.acro ? 10 : 7);
        if (this.fleeTo) { face = Math.atan2(this.fleeTo.x - this.pos.x, this.fleeTo.z - this.pos.z); }
        if (this.t > (this.fleeTime || 9)) { this.remove(); return null; }
        break;
      }
      case 'recover': { face = toP; Pose.idle(r, game.time, true); r.set('spineX', 0.25); if (this.t > 0.5) { this.state = 'circle'; this.t = 0; this.cd = 1.2 + Math.random(); } break; }
      case 'stagger': { Pose.idle(r, game.time, false); Pose.stagger(r, this.t / this.stagDur); if (this.t > this.stagDur) { this.state = 'circle'; this.t = 0; } break; }
      case 'air': {
        Pose.tumble(r, 0.6); r.set('hipsRX', -1.2 + Math.sin(this.t * 6) * 0.3);
        this.juggle = Math.max(0, (this.juggle || 0) - dt);
        this.vel.y -= (this.juggle > 0 ? G * 0.45 : G) * dt;
        this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
        const gh = col.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.3).h;
        if (this.pos.y <= gh && this.vel.y < 0) {
          this.pos.y = gh;
          if (this.slammed) { this.slammed = false; out = { slam: true }; game.fx?.dust(this.pos.x, gh + 0.1, this.pos.z, 12); }
          this.state = this.hp <= 0 ? 'ko' : 'down'; this.t = 0; this.vel.set(0, 0, 0);
        }
        r.update(dt, 14); r.root.position.copy(this.pos); r.root.rotation.y = this.yaw;
        return out;
      }
      case 'down': { Pose.down(r); rate = 10; if (this.hp <= 0) { this.state = 'ko'; this.t = 0; } else if (this.t > (this.big ? 1.6 : 2.3)) { this.state = 'getup'; this.t = 0; } break; }
      case 'getup': { Pose.idle(r, game.time, true); r.set('hipsY', HIP_H - 0.35 * (1 - this.t / 0.6)); rate = 8; if (this.t > 0.6) { this.state = 'circle'; this.t = 0; } break; }
      case 'webbed': { Pose.webbed(r, game.time); if (this.t > this.webDur) { this.clearWeb(); this.state = 'circle'; this.t = 0; } break; }
      case 'ko': { Pose.down(r); rate = 8; this.koT += dt; if (this.koT > 50 && dist > 45) this.remove(); break; }
      case 'return': {
        const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z;
        face = Math.atan2(hx, hz); speed = 2.2;
        if (Math.hypot(hx, hz) < 0.8) { this.state = this.patrol ? 'patrol' : 'idle'; speed = 0; }
        break;
      }
      case 'tail': { // following him at a distance to find out where he lives
        Pose.idle(r, game.time, false);
        const range = (game.power < 0.5 ? 26 : 55) * (p.prone ? 0.45 : 1) * (game.torchOn ? 1.4 : 1);
        const seeing = dist < range && !col.blocked(this.pos.x, this.pos.y + 1.6, this.pos.z, p.pos.x, p.pos.y + 1.2, p.pos.z, 1.2);
        this.sees = seeing;
        if (seeing) {
          this.lost = 0; (this.lastSeen ||= new THREE.Vector3()).copy(p.pos);
          face = toP;
          if (dist > 16) speed = Math.min(6.6, 2 + dist * 0.2); else if (dist < 10) { ax = -Math.sin(toP) * 2; az = -Math.cos(toP) * 2; }
        } else {
          // he doesn't know where Bolaji is now: go to where he was last seen and look around
          this.lost += dt;
          const ls = this.lastSeen || p.pos, lx = ls.x - this.pos.x, lz = ls.z - this.pos.z, ld = Math.hypot(lx, lz);
          if (ld > 1.5) { face = Math.atan2(lx, lz); speed = 4.4; }
          else { face = this.yaw + dt * 1.8; r.set('headY', Math.sin(game.time * 2) * 0.8); }
        }
        if (dist < 5 && reachable && seeing) { this.state = 'circle'; this.t = 0; game.say(this, 'Na you! I don see you!', 'Red Cap', 30); break; }
        if (this.lost > 6 || dist > 120) { game.onTailLost?.(this); this.remove(); return null; }
        break;
      }
    }
    // move
    this.yaw += wrap(face - this.yaw) * Math.min(1, dt * (this.state === 'windup' ? 14 : 9));
    let tx = ax, tz = az;
    if (speed > 0) { tx += Math.sin(face) * speed; tz += Math.cos(face) * speed; }
    if (!['down', 'ko', 'webbed', 'stagger', 'blinded'].includes(this.state)) { this.vel.x += (tx - this.vel.x) * Math.min(1, dt * 8); this.vel.z += (tz - this.vel.z) * Math.min(1, dt * 8); }
    else { const f = Math.max(0, 1 - dt * 5); this.vel.x *= f; this.vel.z *= f; }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 1 && ['circle', 'return', 'patrol', 'idle', 'tail'].includes(this.state) && this.state !== 'fled') { this.anim += dt * (1.3 * hs + 1.5); Pose.run(r, this.anim, Math.min(1, hs / 8)); }
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    col.resolve(this.pos, this.pos.y, 0.36, 1.8, _c);
    const g = col.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.3);
    this.pos.y += (g.h - this.pos.y) * Math.min(1, dt * 12);
    r.update(dt, rate);
    r.root.position.copy(this.pos); r.root.rotation.y = this.yaw;
    return out;
  }
}
