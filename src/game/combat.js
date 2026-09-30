// Free-flow street combat, built so Bolaji can take on five or six Red Caps at once.
//   F        strike the enemy in the direction you're pushing (he lunges to them). Every 5th hit of an
//            unbroken combo is a flip kick that knocks them down.
//   C        counter: when danger sense flashes "!" over an attacker, press C to spin-kick them first.
//            Machete swings (red "!") can't be countered, so dodge (C with no counter available rolls/flips away).
//   G        launcher: kick an enemy into the air. Then F to leap up and juggle them; the 3rd air hit slams them.
//   F        on a downed or webbed enemy: takedown (knocks them out).
//   V        pounce: a cat's pounce onto an enemy up to 16 m away (knockdown). No target: a long leap.
//   T        pick up / throw street junk (stones, bottles, sachets, buckets, tyres) or, with nothing to hand, the board.
// The director lets only one or two of them attack at a time, the rest circle and wait.

const COMBO = ['jab', 'hook', 'jab', 'knee', 'flipkick'];
const COMBO2 = ['hook', 'spin', 'jab', 'hook', 'flipkick'];

export function createCombat(game) {
  const { player, audio, fx, camera, hud } = game;
  const C = { combo: 0, comboT: 0, chain: 0, attackCd: 1, air: 0, best: 0, lastTele: -9, sweepCd: 0 };
  const dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
  const foes = () => [...game.thugs.filter(t => t.alive), ...game.gunmen.filter(g => g.alive)];
  const hitFoe = (t, dmg, kind, knock = 3) => t.takeHit ? t.takeHit(dmg, player.pos.x, player.pos.z, kind) : t.hit(dmg, player.pos.x, player.pos.z, kind === 'heavy' || kind === 'counter' ? 7 : knock);

  function landed(t, dmg, kind, ko) {
    if (t.lastBlocked && t.evaded) { t.lastBlocked = t.evaded = false; hud.popup('HE FLIPPED AWAY · <b>POUNCE OR THROW</b>'); C.combo = Math.max(0, C.combo - 1); return; }
    if (t.lastBlocked) { t.lastBlocked = false; audio.clank?.(t.pos); fx.burst(t.pos.x, t.pos.y + 1.3, t.pos.z, 0xffe0a0, 6, 2); C.blocks = (C.blocks || 0) + 1; hud.popup(C.blocks < 3 ? 'BLOCKED · <b>COUNTER, POUNCE, THROW OR FLANK</b>' : 'BLOCKED'); C.combo = Math.max(0, C.combo - 1); return; }
    C.combo++; C.comboT = 1.8; C.best = Math.max(C.best, C.combo);
    game.hitStop = Math.max(game.hitStop || 0, kind === 'light' ? 0.045 : 0.09); // a tiny freeze sells the impact
    game.expose?.(kind === 'light' ? 3 : 6);
    audio.punch(); camera.shake = Math.max(camera.shake, kind === 'light' ? 0.18 : 0.45);
    fx.burst(t.pos.x, t.pos.y + 1.3, t.pos.z, 0xffffff, kind === 'light' ? 5 : 12, kind === 'light' ? 2 : 4);
    for (const o of game.thugs) if (o.alive && o !== t && dist(o, t) < 25) o.engage(0.1);
    t.engage?.(0);
    if (ko) game.onKnockout?.(t);
    if (C.combo > 0 && C.combo % 10 === 0) game.addRespect(C.combo * 10, `${C.combo}-HIT COMBO`);
  }

  C.engaged = () => game.thugs.filter(t => t.alive && t.engaged && dist(t, player) < 22);

  C.update = (dt) => {
    C.comboT -= dt; if (C.comboT <= 0) { C.combo = 0; C.chain = 0; }
    const engaged = C.engaged();
    player.fightingNear = engaged.some(t => t.state !== 'alert') || game.gunmen.some(g => g.alive && g.state !== 'post' && dist(g, player) < 15);
    C.attackCd -= dt; C.sweepCd -= dt;
    const attacking = engaged.filter(t => t.state === 'windup' || t.state === 'strike').length;
    // never two blows landing together: a second attacker only starts once the first is well under way
    const maxAtt = engaged.length >= 5 ? 2 : 1;
    const spaced = game.time - C.lastTele > (attacking ? 0.55 : 0.3);
    // losing their nerve: when half a group is down, the weak ones may run
    for (const t of engaged) if (t.group && !t.big && !t.nerveChecked && t.state === 'circle') {
      const down = t.group.filter(o => !o.alive).length;
      if (down * 2 >= t.group.length && t.group.length >= 3) { t.nerveChecked = true; if (Math.random() < 0.35) { t.flee(); game.say(t, ['I no dey again o!', 'Run! Run!', 'This one na spirit!'][Math.floor(Math.random() * 3)], 'Red Cap', 40); } }
    }
    if (attacking < maxAtt && spaced && C.attackCd <= 0 && !['down', 'crawl', 'getup'].includes(player.mode)) {
      const cands = engaged.filter(t => t.canAttack && t.cd <= 0 && dist(t, player) < 5.5 && player.pos.y - t.pos.y < 1.5);
      if (cands.length) {
        const t = cands[Math.floor(Math.random() * cands.length)];
        t.telegraph(); C.lastTele = game.time;
        audio.danger?.(t.unblockable);
        C.attackCd = Math.max(0.5, 1.15 - engaged.length * 0.1) + Math.random() * 0.5;
      }
    }
  };
  C.rangedOk = () => game.thugs.filter(t => t.state === 'throwWind').length === 0 && C.attackCd < 0.6;
  C.hit = () => { // Bolaji got hit: the combo breaks, and the crowd gives him a beat to recover
    C.combo = 0; C.chain = 0; C.comboT = 0; C.attackCd = Math.max(C.attackCd, 0.9);
    for (const t of game.thugs) if (t.alive && t.state === 'windup' && t.t < t.windDur * 0.5) { t.state = 'recover'; t.t = 0; }
  };
  // surrounded: three or more of them close enough for the Cat Sweep
  C.sweepReady = () => C.sweepCd <= 0 && game.thugs.filter(t => t.alive && !t.grounded && !t.airborne && t.engaged && dist(t, player) < 3.8).length >= 3;
  C.sweep = () => {
    if (!['foot', 'board'].includes(player.mode) || !C.sweepReady()) return false;
    C.sweepCd = 8;
    if (player.mode === 'board') player.mode = 'foot';
    player.startAct('sweep', null, () => {
      let n = 0;
      for (const t of game.thugs) {
        if (!t.alive || t.grounded || t.airborne || dist(t, player) > 4.2) continue;
        n++;
        if (t.big) { t.stun(1.1); t.lastBlocked = false; }
        else { const ko = t.takeHit(1, player.pos.x, player.pos.z, 'heavy'); if (ko) game.onKnockout?.(t); }
      }
      audio.punch(); camera.shake = 0.6; fx.dust(player.pos.x, player.pos.y + 0.05, player.pos.z, 16);
      game.hitStop = 0.12; C.combo += n; C.comboT = 1.8; C.best = Math.max(C.best, C.combo);
      game.addRespect(40 * n, `CAT SWEEP x${n}`); game.expose?.(16);
    }, { invuln: true });
    return true;
  };

  // pick the enemy in the direction he's pushing (or facing)
  function pickTarget(dir, range = 7, filter = () => true) {
    let best = null, bs = Infinity;
    for (const t of foes()) {
      if (!filter(t)) continue;
      const d = dist(t, player); if (d > range || Math.abs(t.pos.y - player.pos.y) > (t.airborne ? 4.5 : 1.4)) continue;
      const tx = (t.pos.x - player.pos.x) / (d || 1), tz = (t.pos.z - player.pos.z) / (d || 1);
      const ang = Math.acos(Math.max(-1, Math.min(1, tx * dir[0] + tz * dir[1])));
      const s = d * 0.6 + ang * 3.2 + (t.state === 'stagger' ? -1 : 0) + (t.state === 'windup' ? -0.8 : 0);
      if (s < bs) { bs = s; best = t; }
    }
    return best;
  }

  // F: returns true if it did a combat move
  C.attack = (dir) => {
    if (!['foot', 'board'].includes(player.mode)) return false;
    // silent takedown: creep up on someone who hasn't noticed him (behind them, or in the dark) and drop them without a sound
    const unaware = t => t.takeHit && ['idle', 'patrol', 'return'].includes(t.state) && t.variant !== 'scorpion' && t.variant !== 'chairman' && t.variant !== 'egungun' &&
      (game.power < 0.5 || (Math.sin(t.yaw) * (player.pos.x - t.pos.x) + Math.cos(t.yaw) * (player.pos.z - t.pos.z)) / (dist(t, player) || 1) < 0.2);
    const sneak = pickTarget(dir, 2.8, unaware);
    if (sneak) {
      player.startAct('takedown', sneak, () => {
        if (!sneak.alive) return;
        sneak.takeHit(99, player.pos.x, player.pos.z, 'takedown'); game.onKnockout?.(sneak);
        fx.dust(sneak.pos.x, sneak.pos.y + 0.1, sneak.pos.z, 5); audio.punch();
        game.addRespect(120, 'SILENT TAKEDOWN');
      }, { invuln: true, reach: 0.7 });
      return true;
    }
    // juggle an enemy in the air
    const airT = pickTarget(dir, 4.5, t => t.airborne && t.takeHit);
    if (airT && airT.pos.y - player.pos.y < 4.5) {
      C.air++;
      const slam = C.air >= 3;
      player.startAct(slam ? 'slam' : 'air', airT, () => {
        const ko = hitFoe(airT, slam ? 3 : 1, slam ? 'slam' : 'air');
        landed(airT, slam ? 3 : 1, slam ? 'heavy' : 'light', ko);
        if (slam) { C.air = 0; game.addRespect(120, 'AIR COMBO SLAM'); }
      }, { reach: 0.9, invuln: true });
      return true;
    }
    // takedown on someone down or webbed
    const downT = pickTarget(dir, 2.6, t => t.grounded);
    if (downT && !pickTarget(dir, 2.2, t => t.state === 'windup')) {
      player.startAct('takedown', downT, () => { const ko = hitFoe(downT, 99, 'takedown'); landed(downT, 3, 'heavy', ko); game.addRespect(60, 'TAKEDOWN'); }, { invuln: true, reach: 0.8 });
      return true;
    }
    const t = pickTarget(dir, 7.5, x => !x.grounded || !x.takeHit);
    if (!t) return false;
    const seq = C.combo >= 5 ? COMBO2 : COMBO;
    const kind = seq[C.chain % seq.length]; C.chain++;
    const heavy = kind === 'flipkick';
    player.startAct(kind, t, () => {
      if (dist(t, player) > 2.4 || !t.alive) return;
      const dmg = (heavy ? 2 : 1) * (player.eff < 0.7 ? 0.75 : 1);
      const ko = hitFoe(t, dmg, heavy ? 'heavy' : 'light');
      landed(t, dmg, heavy ? 'heavy' : 'light', ko);
    }, { invuln: heavy });
    return true;
  };

  // C: counter if someone is about to hit him; returns false if there's nothing to counter
  C.counter = () => {
    const threats = game.thugs.filter(t => t.alive && t.state === 'windup' && t.t > 0.08 && dist(t, player) < 3.6);
    const counterable = threats.filter(t => !t.unblockable).sort((a, b) => dist(a, player) - dist(b, player));
    if (!counterable.length) return false;
    const t = counterable[0];
    player.startAct('counter', t, () => { const ko = hitFoe(t, 2, 'counter'); landed(t, 2, 'heavy', ko); game.addRespect(40, 'COUNTER'); }, { invuln: true, reach: 1.1 });
    // everyone else winding up flinches
    for (const o of threats) if (o !== t) { o.state = 'recover'; o.t = 0; }
    return true;
  };

  // V: pounce onto someone far away (or just leap)
  C.pounce = (dir) => {
    if (!['foot', 'board'].includes(player.mode) || !player.onGround || player.leapCd > 0) return false;
    let best = null, bs = Infinity;
    for (const t of foes()) {
      if (t.grounded || t.airborne || t.state === 'tail' && false) continue;
      const d = dist(t, player); if (d < 3 || d > 16 || Math.abs(t.pos.y - player.pos.y) > 4) continue;
      const tx = (t.pos.x - player.pos.x) / d, tz = (t.pos.z - player.pos.z) / d, ang = Math.acos(Math.max(-1, Math.min(1, tx * dir[0] + tz * dir[1])));
      if (ang > 0.8 || game.world.collision.blocked(player.pos.x, player.pos.y + 1.6, player.pos.z, t.pos.x, t.pos.y + 1.4, t.pos.z, 2.2)) continue;
      const sc = d * 0.4 + ang * 6; if (sc < bs) { bs = sc; best = t; }
    }
    if (!best) return player.leap(dir);
    player.leapCd = 1.2; if (player.mode === 'board') player.mode = 'foot';
    player.startAct('pounce', best, () => {
      fx.dust(player.pos.x, player.pos.y + 0.1, player.pos.z, 8);
      if (dist(best, player) > 2.6 || !best.alive) return;
      const ko = hitFoe(best, 2, 'heavy'); landed(best, 2, 'heavy', ko);
      for (const o of game.thugs) if (o !== best && o.alive && !o.grounded && dist(o, player) < 2.2) o.stun?.(0.6);
      game.addRespect(60, 'POUNCE'); game.expose?.(14);
    }, { invuln: true, reach: 1.0 });
    return true;
  };

  // G: launcher
  C.launch = (dir) => {
    if (!['foot', 'board'].includes(player.mode)) return false;
    const t = pickTarget(dir, 3.2, x => x.takeHit && !x.grounded && !x.airborne);
    if (!t) return false;
    C.air = 0;
    player.startAct('launch', t, () => {
      if (dist(t, player) > 2.4) return;
      const ko = hitFoe(t, 1, 'launch'); landed(t, 1, 'heavy', ko);
      if (t.airborne) hud.popup('LAUNCHED · <b>F</b> TO JUGGLE');
    }, { reach: 1.0 });
    return true;
  };
  return C;
}
