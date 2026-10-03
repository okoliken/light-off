// The boy in black's street kit. Not weapons: things to get away with.
//   1  Pepper ("ata") bomb: thrown, bursts into a red cloud. Anyone inside is blinded for a few seconds.
//   2  Ash pouch: a cloud of grey smoke around him. Police can't see into it, so he can vanish.
//   3  Nail plank: dropped behind him across the road. A police car that runs over it is done.
// (and the old one: pull a transformer fuse for a blackout, F at any transformer at night)
import * as THREE from 'three';

export function createGadgets(game) {
  const { scene, hud, audio, player, fx, traffic } = game;
  const L = game.life;
  const Gd: any = { smokes: [], planks: [], bombs: [] };
  const plankMat = new THREE.MeshStandardMaterial({ color: '#6d4c41', roughness: 0.95 }), nailMat = new THREE.MeshStandardMaterial({ color: '#b0bec5', metalness: 0.8, roughness: 0.35 });
  const fwd = () => { const y = player.yaw; return [Math.sin(y), Math.cos(y)]; };
  const out = (what) => hud.toast(`No ${what} left. Buy more at Mama Chi Provisions (malls) or Bright Future Electricals.`, 'red');

  Gd.use = (k) => {
    if (L.inside || game.inMall || player.mode === 'ride' || player.cuffed || game.arrest) return;
    const p = player.pos, [fx0, fz0] = fwd();
    if (k === 1) {
      if (!L.items.pepper) return out('pepper bombs');
      L.items.pepper--;
      // aim at the nearest enemy in front, otherwise a good throw ahead
      const foes = [...game.thugs.filter(t => t.alive), ...game.gunmen.filter(g => g.alive && !g.removed)].filter(e => { const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz); return d < 16 && (dx * fx0 + dz * fz0) / (d || 1) > 0.3; })
        .sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z));
      const tx = foes[0] ? foes[0].pos.x : p.x + fx0 * 9, tz = foes[0] ? foes[0].pos.z : p.z + fz0 * 9, d = Math.hypot(tx - p.x, tz - p.z), T = Math.max(0.35, d / 14);
      fx.bomb(new THREE.Vector3(p.x, p.y + 1.6, p.z), new THREE.Vector3((tx - p.x) / T, 8 * T * 0.5 + 1, (tz - p.z) / T));
      Gd.bombs.push({ x: tx, z: tz, at: game.time + T }); player.startThrow?.(); audio.swing?.();
    } else if (k === 2) {
      if (!L.items.smoke) return out('ash pouches');
      L.items.smoke--;
      const life = player.skills?.smoke2 ? 16 : 9;
      fx.cloud(p.x, p.y, p.z, { r: 6.5, life, c1: 0x5f5f5f, c2: 0x8a8a8a, n: 8 });
      Gd.smokes.push({ x: p.x, z: p.z, r: 6.5, until: game.time + life });
      hud.popup('ASH CLOUD · <b>THEY CAN\'T SEE YOU</b>'); audio.swing?.();
    } else if (k === 3) {
      if (!L.items.nails) return out('nail planks');
      L.items.nails--;
      const x = p.x - fx0 * 1.8, z = p.z - fz0 * 1.8, g = new THREE.Group();
      const pl = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.3), plankMat); g.add(pl);
      for (let n = -4; n <= 4; n++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 4), nailMat); c.position.set(n * 0.45, 0.1, 0); g.add(c); }
      g.position.set(x, game.world.collision.groundHeight(x, z, p.y + 1).h + 0.05, z); g.rotation.y = player.yaw; scene.add(g);
      Gd.planks.push({ x, z, g, until: game.time + 90 }); audio.grab?.(); hud.popup('NAIL PLANK DOWN');
    }
  };
  // hidden from the police inside an ash cloud
  Gd.hidden = (pos) => Gd.smokes.some(s => (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2 < s.r * s.r);
  Gd.update = (dt) => {
    const now = game.time;
    for (let i = Gd.bombs.length - 1; i >= 0; i--) {
      const b = Gd.bombs[i]; if (now < b.at) continue; Gd.bombs.splice(i, 1);
      fx.cloud(b.x, 0.2, b.z, { r: 4.8, life: 6 }); audio.punch?.();
      for (const t of game.thugs) if (t.alive && (t.pos.x - b.x) ** 2 + (t.pos.z - b.z) ** 2 < 4.8 * 4.8) t.blind?.(5);
      for (const g of game.gunmen) if (g.alive && !g.removed && (g.pos.x - b.x) ** 2 + (g.pos.z - b.z) ** 2 < 4.8 * 4.8) g.stun?.(4);
      Gd.smokes.push({ x: b.x, z: b.z, r: 4.2, until: now + 5 });
    }
    for (let i = Gd.smokes.length - 1; i >= 0; i--) if (now > Gd.smokes[i].until) Gd.smokes.splice(i, 1);
    for (let i = Gd.planks.length - 1; i >= 0; i--) {
      const pk = Gd.planks[i];
      const car = traffic.police().find(v => !v.flatT && (v.pos.x - pk.x) ** 2 + (v.pos.z - pk.z) ** 2 < 2.4 * 2.4);
      if (car) { car.flatT = 30; audio.glass?.(); fx.burst(car.pos.x, 0.6, car.pos.z, 0xcccccc, 14, 3); hud.popup('PSSSHH · <b>POLICE TYRES GONE</b>'); }
      if (car || now > pk.until) { scene.remove(pk.g); Gd.planks.splice(i, 1); }
    }
    for (const v of traffic.police()) if (v.flatT > 0) { v.flatT -= dt; v.speed = Math.min(v.speed, 1.1); if (v.police) v.police.sees = false; }
  };
  return Gd;
}
