// Gunmen: police officers who get out of their cars to chase Bolaji on foot, and the armed robbers
// from the getaway car. Every shot is telegraphed: they stop, raise the gun, a red laser tracks him for
// about a second, then they fire. Roll, break line of sight or get far away to make them miss.
import * as THREE from 'three';
import { Rig, Pose, OUTFITS } from '../player/rig.ts';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const pick = a => a[Math.floor(Math.random() * a.length)];
const _c: any[] = [];

export class Gunman {
  [key: string]: any; // TODO(ts): declare fields
  constructor(scene, world, { x, z, y = 0.15, yaw = 0, role = 'police', car = null, post = null, outfit = null }: any) {
    this.scene = scene; this.world = world; this.role = role; this.car = car; this.post = post;
    this.rig = new Rig(outfit || (role === 'police' ? OUTFITS.police : OUTFITS.thief));
    scene.add(this.rig.root);
    this.pos = new THREE.Vector3(x, y, z); this.vel = new THREE.Vector3(); this.yaw = yaw;
    this.maxHp = role === 'police' ? 3 : 2; this.hp = this.maxHp;
    this.state = post ? 'post' : role === 'thief' ? 'flee' : 'chase'; /* a 'hitman' hunts like police but shoots whatever the heat */ this.t = 0; this.anim = Math.random() * 9;
    this.shootCd = 1.2 + Math.random() * 1.5; this.aimT = 0; this.losT = 0; this.bark = 0;
    this.fleeYaw = yaw; this.stuck = 0; this.removed = false;
    this.muzzleW = new THREE.Vector3();
  }
  get alive() { return this.state !== 'down' && !this.removed; }
  hit(dmg, fx, fz, knock) {
    if (!this.alive) return false;
    this.hp -= dmg;
    const dx = this.pos.x - fx, dz = this.pos.z - fz, d = Math.hypot(dx, dz) || 1;
    this.vel.x = (dx / d) * knock; this.vel.z = (dz / d) * knock;
    if (this.hp <= 0) { this.state = 'down'; this.t = 0; return true; }
    this.state = 'stunned'; this.t = 0; this.stunDur = 0.6;
    return false;
  }
  stun(dur) { if (this.alive) { this.state = 'stunned'; this.t = 0; this.stunDur = dur; } }
  blind(dur) { if (this.alive) { this.state = 'blinded'; this.t = 0; this.blindDur = dur; } }
  remove() { this.removed = true; this.scene.remove(this.rig.root); }
  muzzle() { this.rig.root.updateMatrixWorld(true); return (this.rig.muzzle || this.rig.b.haR).getWorldPosition(this.muzzleW); }

  // returns { shoot: true } on the frame they fire, { grab: true } while holding onto him, else null
  update(dt, game) {
    if (this.removed) return null;
    const p = game.player, col = this.world.collision, r = this.rig;
    this.t += dt; this.shootCd -= dt; this.bark -= dt;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dist = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    const reachable = p.pos.y - this.pos.y < 1.6 && p.mode !== 'down';
    const canShoot = this.role === 'thief' || this.role === 'hitman' || game.heat >= 2;
    let face = this.yaw, speed = 0, out = null;
    const eye = () => !col.blocked(this.pos.x, this.pos.y + 1.5, this.pos.z, p.pos.x, p.pos.y + 1.2, p.pos.z, 1.2);

    switch (this.state) {
      case 'post': { // manning a checkpoint: face the traffic, wave cars down, collect "roger"
        const P = this.post;
        const hx = P.x - this.pos.x, hz = P.z - this.pos.z;
        if (Math.hypot(hx, hz) > 0.6) { this.postT = (this.postT || 0) + dt; if (this.postT > 5) { this.pos.set(P.x, this.pos.y, P.z); this.postT = 0; } face = Math.atan2(hx, hz); speed = 2.2; break; }
        this.postT = 0;
        Pose.idle(r, game.time + this.anim, false);
        const v = P.cp.stopped;
        if (v && this.collector) { face = Math.atan2(v.pos.x - this.pos.x, v.pos.z - this.pos.z); r.set('shRX', -1.4); r.set('elRX', -0.2); r.set('shRZ', -0.2); }
        else { face = P.yaw; if (Math.sin(game.time * 1.3 + this.anim) > 0.6) { r.set('shLX', -1.6); r.set('shLZ', 0.5); r.set('elLX', -0.3 + Math.sin(game.time * 9) * 0.3); } }
        if (game.heat > 0 && dist < 45) { this.state = 'chase'; break; }
        break;
      }
      case 'chase': {
        if (game.arrest && this.role !== 'thief') { this.state = 'return'; break; } // he's already in the car
        face = toP;
        if (game.heat <= 0 && this.role === 'police') { this.state = 'return'; break; }
        if (this.post && dist > 60) { this.state = 'return'; break; }
        if (canShoot && this.shootCd <= 0 && dist > 5 && dist < 32 && eye()) { this.state = 'aim'; this.t = 0; this.aimT = 0; this.losT = 0; if (this.bark <= 0) { this.bark = 5; game.say(this, pick(this.role === 'police' ? ['Stop or I shoot!', 'Freeze there!', 'Hands up!'] : ['Back off!', 'You wan die?!', 'Commot for road!']), this.role === 'police' ? 'Police' : 'Robber'); } break; }
        if (dist < 1.3 && reachable && this.role === 'police') { out = { grab: true }; Pose.idle(r, game.time, false); r.set('shLX', -1.3); r.set('shRX', -1.3); r.set('elLX', -0.3); r.set('elRX', -0.3); break; }
        speed = reachable ? 7.6 : 0; // faster than his jog, slower than his sprint: he gets away on his feet, not by strolling
        if (!reachable && dist < 6) { face = toP + Math.PI; speed = 2; } // back off the wall so they can see up
        if (!reachable) { Pose.idle(r, game.time, false); r.set('shRX', -1.2); r.set('headX', -0.5); } // shouting up at the roof
        break;
      }
      case 'flee': {
        const away = toP + Math.PI;
        this.fleeYaw += wrap(away - this.fleeYaw) * Math.min(1, dt * 1.5);
        face = this.fleeYaw; speed = 6.5;
        if (this.shootCd <= 0 && dist < 22 && dist > 4 && eye()) { this.state = 'aim'; this.t = 0; this.aimT = 0; this.losT = 0; }
        break;
      }
      case 'aim': {
        if (game.arrest) { this.state = this.role === 'thief' ? 'flee' : 'return'; break; }
        face = toP; Pose.idle(r, game.time, false);
        r.set('shRX', -1.55); r.set('elRX', 0); r.set('shRZ', 0.1); r.set('chestY', -0.2); r.set('shLX', -1.2); r.set('elLX', -0.9); r.set('shLZ', -0.3);
        this.aimT += dt;
        if (!eye()) this.losT += dt; else this.losT = 0;
        if (this.losT > 0.35) { this.state = this.role === 'thief' ? 'flee' : 'chase'; this.shootCd = 0.8; break; }
        if (this.aimT >= (this.role === 'police' ? 1.7 : 1.4)) { out = { shoot: true, dist }; this.state = 'recover'; this.t = 0; this.shootCd = 2.3 + Math.random() * 1.6; }
        break;
      }
      case 'recover': {
        face = toP; Pose.idle(r, game.time, false); r.set('shRX', -1.2); r.set('elRX', -0.4);
        if (this.t > 0.45) this.state = this.role === 'thief' ? 'flee' : 'chase';
        break;
      }
      case 'stunned': {
        Pose.idle(r, game.time, false); Pose.stagger(r, this.t / (this.stunDur || 0.6));
        if (this.t > (this.stunDur || 0.6)) this.state = this.role === 'thief' ? 'flee' : 'chase';
        break;
      }
      case 'blinded': {
        Pose.cough(r, game.time);
        if (this.t > this.blindDur) this.state = this.role === 'thief' ? 'flee' : 'chase';
        break;
      }
      case 'down': {
        Pose.down(r);
        if (this.role === 'police' && this.t > 16) { this.hp = this.maxHp; this.state = game.heat > 0 ? 'chase' : 'return'; }
        break;
      }
      case 'return': {
        if (this.post) { if (game.heat > 0 && dist < 45 && !game.arrest) { this.state = 'chase'; break; } this.state = 'post'; break; }
        if (!this.car) { this.remove(); return null; }
        const cx = this.car.pos.x - this.pos.x, cz = this.car.pos.z - this.pos.z, cd = Math.hypot(cx, cz);
        face = Math.atan2(cx, cz); speed = 3.2;
        if (game.heat > 0 && !game.arrest) { this.state = 'chase'; break; }
        if (cd < 2.6) { this.remove(); return null; }
        break;
      }
    }
    this.yaw += wrap(face - this.yaw) * Math.min(1, dt * 10);
    if (speed > 0) {
      const tx = Math.sin(face) * speed, tz = Math.cos(face) * speed;
      this.vel.x += (tx - this.vel.x) * Math.min(1, dt * 8); this.vel.z += (tz - this.vel.z) * Math.min(1, dt * 8);
      this.anim += dt * (1.3 * speed + 1.5); Pose.run(r, this.anim, Math.min(1, speed / 8));
    } else { const f = Math.max(0, 1 - dt * 6); this.vel.x *= f; this.vel.z *= f; }
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    col.resolve(this.pos, this.pos.y, 0.36, 1.8, _c);
    // fleeing into a wall: pick a new direction
    if (this.state === 'flee' && _c.length && Math.hypot(this.pos.x - ox, this.pos.z - oz) < speed * dt * 0.4) { this.stuck += dt; if (this.stuck > 0.3) { this.fleeYaw += (Math.random() < 0.5 ? 1 : -1) * 1.6; this.stuck = 0; } }
    const g = col.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.3);
    if (g.h < this.pos.y - 0.5) { this.vel.y = (this.vel.y || 0) - 24 * dt; this.pos.y = Math.max(g.h, this.pos.y + this.vel.y * dt); } else { this.vel.y = 0; this.pos.y += (g.h - this.pos.y) * Math.min(1, dt * 12); }
    r.update(dt, this.state === 'aim' ? 20 : 12);
    r.root.position.copy(this.pos); r.root.rotation.y = this.yaw;
    return out;
  }
}
