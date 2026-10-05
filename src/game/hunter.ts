// The Hunter: a specialist from Japan the government brought in to bring the boy in black in.
// He moves on the same movement code as Bolaji (run, cat leap, climb, wall-run, roll, flips), fights with
// a katana, and wears armour most of Bolaji's strikes can't get through: counters, heavy hits, slams,
// throws and pepper do. Bolaji's edge is Lagos: the Hunter doesn't know the shortcuts (no wires, no
// hitching a ride), and once Bolaji breaks his line of sight he can only go where he saw him last.
// He only hunts the boy in black: out of the suit, Bolaji is nobody to him.
//
// To combat, the lock-on and the danger warnings he looks like any other enemy (the Thug fields).
import { createPlayer } from '../player/player.ts';
import { OUTFITS, Pose } from '../player/rig.ts';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const G = 24;
const LINES = {
  arrive: ['Boy in black. I was told you run. Run, then.', 'Lagos is small. You will see.', 'They pay me to bring you in. Not to like it.'],
  duel: ['Too slow.', 'Again.', 'Street fighting. Hm.', 'You have no training. Only luck.'],
  lost: ['...Where did he go?', 'These streets...', 'He knows this city. I do not. Yet.'],
  hurt: ['Good. Finally.', 'Hm. That one I felt.'],
};

export function createHunter(game) {
  const { scene, world, player, hud, audio, fx, traffic } = game;
  const col = world.collision, L = game.life;
  const body = createPlayer(scene, world, traffic);
  body.rig.rebuild(OUTFITS.hunter);
  Object.assign(body, { noBoard: true, eff: 1, energy: 100, hp: 1e6, maxHp: 1e6, skills: { leap2: true, wallrun2: true, roll: true } });
  body.rig.root.visible = false; body.pos.set(0, -80, 0);

  const H: any = { hunter: true, name: 'THE HUNTER', variant: 'hunter', active: false, hp: 40, maxHp: 40, state: 'gone', t: 0, cd: 0, big: true, group: null, lastBlocked: false, evaded: false, koCounted: true };
  Object.defineProperty(H, 'pos', { get: () => body.pos });
  Object.defineProperty(H, 'yaw', { get: () => body.yaw });
  Object.defineProperty(H, 'vel', { get: () => body.vel });
  Object.defineProperty(H, 'alive', { get: () => H.active && H.state !== 'gone' });
  Object.defineProperty(H, 'engaged', { get: () => H.active && ['duel', 'windup', 'strike', 'stagger', 'down', 'pin'].includes(H.state) });
  Object.defineProperty(H, 'airborne', { get: () => false });
  Object.defineProperty(H, 'grounded', { get: () => H.state === 'down' });
  Object.defineProperty(H, 'unblockable', { get: () => H.state === 'windup' && H.attack === 'katana' });
  Object.defineProperty(H, 'canAttack', { get: () => false }); // he picks his own moments
  H.telegraph = () => {}; H.flee = () => {}; H.engage = () => {};
  H.stun = (d) => { if (H.engaged && H.state !== 'down') { H.state = 'stagger'; H.t = 0; H.stagDur = d; } };
  H.blind = (d) => { if (H.active && H.state !== 'down') { H.state = 'stagger'; H.t = 0; H.stagDur = d * 0.7; hud.popup('THE PEPPER GOT INTO HIS MASK'); } }; // pepper works: the mask isn't sealed
  const say = (k) => { if (game.time - (H.saidT || -9) > 6) { H.saidT = game.time; hud.say('The Hunter', pick(LINES[k]), 3); } };
  const dist = () => Math.hypot(player.pos.x - H.pos.x, player.pos.z - H.pos.z);

  // his armour: plain strikes from the front mostly glance off; counters, heavy hits, slams, throws get through
  H.takeHit = (dmg, fx0, fz0, kind = 'light') => {
    if (!H.alive || H.state === 'gone') return false;
    H.lastBlocked = false; H.evaded = false;
    const side = Pose.hitSide(H.pos.x, H.pos.z, H.yaw, fx0, fz0), heavy = ['heavy', 'counter', 'launch', 'slam', 'takedown', 'air'].includes(kind);
    if (!heavy && H.state !== 'down' && H.state !== 'stagger') {
      if (side !== 2 && Math.random() < 0.75) { H.lastBlocked = true; fx?.burst(H.pos.x, H.pos.y + 1.3, H.pos.z, 0xbfd4ff, 7, 3); audio.clank?.(H.pos); return false; } // it glances off the plates
      if (Math.random() < 0.25) { H.lastBlocked = true; H.evaded = true; H.evade = true; return false; } // he slips it
    }
    const real = (heavy ? (kind === 'takedown' ? 8 : Math.max(2, dmg) * 1.5) : dmg * (side === 2 ? 0.8 : 0.5));
    H.hp -= real;
    body.hurt(0.0001, fx0, fz0, heavy ? 5 : 2); // the body shows it (and is knocked back)
    if (H.hp <= 0) { H.state = 'down'; H.t = 0; say('hurt'); return false; }
    if (heavy) { H.state = 'stagger'; H.t = 0; H.stagDur = 0.8; if (Math.random() < 0.4) say('hurt'); }
    return false; // nobody knocks him out in one
  };

  // ---- getting around: he drives the same body Bolaji does ----
  const leapTo = (q) => {
    const p = body.pos, dy = q.y - p.y, d = Math.hypot(q.x - p.x, q.z - p.z);
    if (dy > 7 || d < 2) return null;
    const h = Math.max(dy, 0) + 1.2 + d * 0.05, vy = Math.sqrt(2 * G * h), t = vy / G + Math.sqrt(2 * Math.max(0.05, h - dy) / G);
    if (d / t > 16) return null;
    return { x: (q.x - p.x) / t, y: vy, z: (q.z - p.z) / t, t };
  };
  let route = null, routeT = 0, stuckT = 0, jumpCd = 0, lastSeen = null, unseenT = 0, searchT = 0, atkCd = 1.6, pinT = 0;
  function drive(dt, goal, run, face = null, strafe = 0) {
    const p = body.pos, dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz), dy = (goal.y ?? p.y) - p.y;
    const heading = face ?? Math.atan2(dx, dz);
    const inp: any = { move: { x: strafe, y: face != null ? 0 : d > 0.9 ? 1 : 0 }, look: { dx: 0, dy: 0 }, held: { sprint: run && d > 4 }, pressed: {} };
    jumpCd -= dt;
    const moving = Math.hypot(body.vel.x, body.vel.z);
    stuckT = inp.move.y && moving < 1 && body.onGround ? stuckT + dt : 0;
    if (body.mode === 'climb') { inp.move.y = 1; inp.held.jump = true; } // keep going up
    else if (body.onGround && jumpCd <= 0) {
      const lp = Math.abs(dy) > 1.2 && d < 17 ? leapTo(goal) : null;
      const ahead = col.groundHeight(p.x + Math.sin(heading) * 2.4, p.z + Math.cos(heading) * 2.4, p.y + 0.4).h;
      if (lp && !col.blocked(p.x, p.y + 1.4, p.z, goal.x, (goal.y ?? 0) + 0.8, goal.z, 0.6)) { body.lockLeap = lp; inp.pressed.jump = true; jumpCd = 1.2; } // up onto his roof, or across to it
      else if ((body.lastWallT < 0.15 && (dy > 1 || stuckT > 0.4)) || stuckT > 1.2) { inp.pressed.jump = true; inp.held.jump = true; jumpCd = 0.8; } // a wall: go up it
      else if (ahead < p.y - 1.5 && dy < -1.5) { /* the edge of a roof: just run off it, he lands like Bolaji does */ }
    }
    body.update(dt, inp, heading, game.time);
    body.lockLeap = null;
  }
  // around the buildings by road when he can't see him (he doesn't know the alleys)
  function chase(dt, target, run) {
    const seesIt = !col.blocked(body.pos.x, body.pos.y + 1.6, body.pos.z, target.x, (target.y ?? 0) + 1.2, target.z, 1.2);
    const near = Math.hypot(target.x - body.pos.x, target.z - body.pos.z) < 28;
    if (seesIt || near || Math.abs((target.y ?? 0) - body.pos.y) > 1.5) { route = null; drive(dt, target, run); return; }
    routeT -= dt;
    if (!route || routeT <= 0) { routeT = 2.5; route = traffic.route(body.pos.x, body.pos.z, body.yaw, target.x, target.z); }
    while (route.length > 1 && Math.hypot(route[0][0] - body.pos.x, route[0][1] - body.pos.z) < 5) route.shift();
    drive(dt, { x: route[0][0], z: route[0][1], y: body.pos.y }, run);
  }

  // ---- arriving and leaving ----
  H.start = (fromX?, fromZ?) => {
    if (H.active) return;
    const spots = world.spots.filter(q => { const d = Math.hypot(q.x - player.pos.x, q.z - player.pos.z); return d > 45 && d < 75; });
    const s = fromX != null ? { x: fromX, z: fromZ, nx: 0, nz: 0 } : spots[Math.floor(Math.random() * spots.length)] || { x: player.pos.x + 50, z: player.pos.z, nx: 0, nz: 0 };
    body.respawn?.(s.x + s.nx * 2, s.z + s.nz * 2, 0); body.pos.set(s.x + s.nx * 2, col.groundHeight(s.x, s.z, 40).h, s.z + s.nz * 2);
    body.mode = 'foot'; body.vel.set(0, 0, 0); body.rig.root.visible = true;
    Object.assign(H, { active: true, hp: H.maxHp, state: 'hunt', t: 0, removed: false }); lastSeen = { x: player.pos.x, y: player.pos.y, z: player.pos.z }; unseenT = 0; searchT = 0; pinT = 0;
    if (!game.thugs.includes(H)) game.thugs.push(H);
    game.radio?.say('Police radio: "The specialist is on the ground. All units: stay out of his way."', true);
    hud.banner('THE HUNTER', H.met ? 'He\'s back. And he\'s learning the streets.' : 'The government brought someone in from Japan for the boy in black. He moves like you. He has a sword. Lose him: he doesn\'t know Lagos.', 'red', 4.5);
    H.met = true; audio.alert();
  };
  const leave = (why) => {
    H.active = false; H.state = 'gone'; H.removed = true; body.rig.root.visible = false; body.pos.set(0, -80, 0); game.hunterPin = null;
    H.cd = 300 + Math.random() * 240;
    if (why === 'lost') { hud.banner('YOU LOST HIM', 'He doesn\'t know Lagos the way you do. He\'ll be back.', 'green', 3.5); game.addRespect?.(800, 'LOST THE HUNTER'); }
    if (why === 'beaten') { hud.banner('HE PULLED BACK', 'Hurt, over the rooftops and gone. Next time, catch him.', 'green', 3.5); game.addRespect?.(1500, 'THE HUNTER RETREATS'); }
  };
  H.remove = () => leave('quiet');

  // ---- every frame (called from the game's enemy loop, like any other enemy) ----
  H.update = (dt) => {
    if (!H.active) return null;
    H.t += dt; atkCd -= dt;
    const d = dist(), dy = player.pos.y - H.pos.y;
    const P = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
    const range = game.power > 0.5 ? 60 : 32;
    const sees = L.suit && !L.inside && !player.ride && d < range && !col.blocked(H.pos.x, H.pos.y + 1.6, H.pos.z, P.x, P.y + 1.2, P.z, 1.2);
    if (sees) { lastSeen = { ...P }; unseenT = 0; } else unseenT += dt;
    if (player.mode === 'zip' || player.mode === 'skitch' || player.mode === 'bike' || player.mode === 'ride') unseenT += dt * 2; // the shortcuts he doesn't know

    switch (H.state) {
      case 'hunt': {
        if (!L.suit && unseenT > 2) { H.state = 'search'; searchT = 0; say('lost'); break; } // out of the suit: just another face in Lagos
        if (unseenT > 9) { H.state = 'search'; searchT = 0; say('lost'); break; }
        if (sees && d < 4.5 && Math.abs(dy) < 1.6) { H.state = 'duel'; H.t = 0; if (H.t < 1) say('arrive'); break; }
        chase(dt, sees ? P : lastSeen, true);
        break;
      }
      case 'search': { // he goes where he last saw him, and looks
        searchT += dt;
        if (sees && L.suit) { H.state = 'hunt'; break; }
        const dl = Math.hypot(lastSeen.x - H.pos.x, lastSeen.z - H.pos.z);
        if (dl > 3) chase(dt, lastSeen, true);
        else drive(dt, { x: lastSeen.x + Math.sin(searchT) * 6, z: lastSeen.z + Math.cos(searchT * 0.7) * 6 }, false);
        if (searchT > 14) leave('lost');
        break;
      }
      case 'duel': {
        if (!sees && unseenT > 1.2) { H.state = 'hunt'; break; }
        if (d > 6 || Math.abs(dy) > 1.8) { H.state = 'hunt'; break; }
        if (['down', 'crawl'].includes(player.mode) && d < 2.2) { H.state = 'pin'; pinT = 0; hud.say('The Hunter', 'Stay down.', 2); break; } // he's down: pin him
        const toP = Math.atan2(P.x - H.pos.x, P.z - H.pos.z);
        if (H.evade) { H.evade = false; body.update(dt, { move: { x: Math.random() < 0.5 ? 1 : -1, y: -1 }, look: { dx: 0, dy: 0 }, held: {}, pressed: { roll: true } }, toP, game.time); break; } // slips it with a roll
        if (atkCd <= 0 && d < 3.2) { // he picks his moment: the sword (dodge it) or a kick (counter it)
          H.attack = Math.random() < 0.5 ? 'katana' : 'kick'; H.state = 'windup'; H.t = 0; H.windDur = H.attack === 'katana' ? 0.55 : 0.42;
          audio.danger?.(H.attack === 'katana'); break;
        }
        // circle him at sword's length
        if (d > 2.6) drive(dt, P, false); else body.update(dt, { move: { x: Math.sin(H.t * 0.8) > 0 ? 1 : -1, y: d < 1.8 ? -1 : 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, toP, game.time);
        if (Math.random() < dt * 0.08) say('duel');
        break;
      }
      case 'windup': { // the "!" over him: red for the sword (dodge), yellow for a kick (counter)
        body.update(dt, { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, Math.atan2(P.x - H.pos.x, P.z - H.pos.z), game.time);
        const r = body.rig; if (H.attack === 'katana') { r.set('shRX', -2.8); r.set('elRX', -0.3); r.set('chestY', 0.6); } else { r.set('thRX', -0.8); r.set('knRX', 1.4); } r.update(dt, 25);
        if (H.t >= H.windDur) {
          H.state = 'strike'; H.t = 0;
          const kind = H.attack === 'katana' ? pick(['spin', 'hook']) : pick(['flipkick', 'knee', 'sweep']);
          body.startAct(kind, player, () => {
            if (dist() > 2.7 || Math.abs(player.pos.y - H.pos.y) > 1.6) return;
            game.lastHitKatana = H.attack === 'katana';
            const hit = player.hurt(H.attack === 'katana' ? 22 : 11, H.pos.x, H.pos.z, H.attack === 'katana' ? 4.5 : 6);
            if (hit) { game.combat?.hit?.(); audio.hurt?.(); if (game.env) game.env.grade.uniforms.hurt.value = 1; }
            if (hit && H.attack === 'katana') { fx?.burst(player.pos.x, player.pos.y + 1.2, player.pos.z, 0xff4040, 10, 3); audio.clank?.(player.pos); }
            game.lastHitKatana = false;
          }, { reach: 1.4 });
          atkCd = 1.1 + Math.random() * 1.2;
        }
        break;
      }
      case 'strike': {
        body.update(dt, { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, body.yaw, game.time);
        if (body.mode !== 'act') { H.state = 'duel'; H.t = 0; }
        break;
      }
      case 'stagger': {
        body.update(dt, { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, body.yaw, game.time);
        if (H.t > (H.stagDur || 0.6)) { H.state = 'duel'; H.t = 0; atkCd = Math.min(atkCd, 0.4); }
        break;
      }
      case 'pin': { // standing over him: Bolaji has a few seconds to throw him off
        body.update(dt, { move: { x: 0, y: d > 1.2 ? 1 : 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, Math.atan2(P.x - H.pos.x, P.z - H.pos.z), game.time);
        const r = body.rig; r.set('spineX', 0.6); r.set('shLX', -1.3); r.set('shRX', -1.5); r.update(dt, 20);
        if (!['down', 'crawl'].includes(player.mode)) { game.hunterPin = null; H.state = 'stagger'; H.t = 0; H.stagDur = 1.2; hud.popup('THREW HIM OFF'); break; }
        pinT += dt; game.hunterPin = { k: pinT / 3.5 };
        if (pinT >= 3.5) { game.hunterPin = null; leave('quiet'); game.capturedByHunter?.(); }
        break;
      }
      case 'down': { // hurt enough: he goes down, then pulls back over the rooftops
        body.update(dt, { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, body.yaw, game.time);
        const r = body.rig; Pose.down(r); r.update(dt, 14);
        if (H.t > 2.5) { H.state = 'retreat'; H.t = 0; hud.say('The Hunter', 'This is not finished.', 3); }
        break;
      }
      case 'retreat': { // away from him, fast; gone once out of sight
        const away = Math.atan2(H.pos.x - P.x, H.pos.z - P.z);
        drive(dt, { x: H.pos.x + Math.sin(away) * 30, z: H.pos.z + Math.cos(away) * 30, y: H.pos.y }, true);
        if ((d > 40 && !sees) || H.t > 25) leave('beaten');
        break;
      }
    }
    if (H.state !== 'pin' && game.hunterPin) game.hunterPin = null;
    return null;
  };

  // ---- when he comes: at night, for the boy in black, more likely once the police are after him ----
  H.cd = 200 + Math.random() * 120;
  H.tick = (dt) => {
    if (H.active || game.mode !== 'patrol' || !L.suit || L.inside || L.phase !== 'night' || game.story?.active || game.arrest) return;
    H.cd -= dt * (game.heat > 0 ? 2.5 : 1);
    if (H.cd <= 0) H.start();
  };
  return H;
}
