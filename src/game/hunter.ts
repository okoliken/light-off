// The Hunter: a specialist from Japan the government brought in to bring Street Cat in.
// He moves on the same movement code as Bolaji (run, cat leap, climb, wall-run, roll, flips), fights with
// a katana, and wears armour most of Bolaji's strikes can't get through: counters, heavy hits, slams,
// throws and pepper do. Bolaji's edge is Lagos: the Hunter doesn't know the shortcuts (no wires, no
// hitching a ride), and once Bolaji breaks his line of sight he can only go where he saw him last.
// He only hunts Street Cat: out of the suit, Bolaji is nobody to him.
//
// To combat, the lock-on and the danger warnings he looks like any other enemy (the Thug fields).
import { createPlayer } from '../player/player.ts';
import { OUTFITS, Pose } from '../player/rig.ts';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const G = 24;
const LINES = {
  arrive: ['Street Cat. I was told you run. Run, then.', 'Lagos is small. You will see.', 'They pay me to bring you in. Not to like it.'],
  duel: ['Too slow.', 'Again.', 'Street fighting. Hm.', 'You have no training. Only luck.'],
  lost: ['...Where did he go?', 'These streets...', 'He knows this city. I do not. Yet.'],
  hurt: ['Good. Finally.', 'Hm. That one I felt.'],
  // in the mission: what he says as the fight turns
  p1: ['Show me what Lagos taught you.', 'You fight like you have something to lose.', 'Breathe. You are wasting yourself.'],
  p2: ['You hit like a man who has been hungry.', 'Who are you protecting, Street Cat?', 'I was told you were a thief. Thieves run.'],
  p3: ['They will send someone worse than me.', 'Not like this. Not in the street.', 'Again. AGAIN.'],
  stalk: ['Keep walking.', 'I see you.', 'Lagos is small, Street Cat.'],
};

export function createHunter(game) {
  const { scene, world, player, hud, audio, fx, traffic } = game;
  const col = world.collision, L = game.life;
  const body = createPlayer(scene, world, traffic);
  body.rig.rebuild(OUTFITS.hunter);
  Object.assign(body, { eff: 1, energy: 100, hp: 1e6, maxHp: 1e6, skills: { leap2: true, wallrun2: true, roll: true } });
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
    if (!H.alive || H.state === 'gone' || H.state === 'beaten') return false;
    H.lastBlocked = false; H.evaded = false;
    const side = Pose.hitSide(H.pos.x, H.pos.z, H.yaw, fx0, fz0), heavy = ['heavy', 'counter', 'launch', 'slam', 'takedown', 'air'].includes(kind);
    if (!heavy && H.state !== 'down' && H.state !== 'stagger') {
      if (side !== 2 && Math.random() < 0.75) { H.lastBlocked = true; fx?.burst(H.pos.x, H.pos.y + 1.3, H.pos.z, 0xbfd4ff, 7, 3); audio.clank?.(H.pos); return false; } // it glances off the plates
      if (Math.random() < 0.2) { H.lastBlocked = true; H.evaded = true; H.evade = true; return false; } // a backflip out of it
      if (Math.random() < [0.15, 0.15, 0.3, 0.38][H.phase || 1]) { H.lastBlocked = true; H.parry = true; return false; } // a karate block, then straight back at him (more often as he reads you)
    }
    const real = (heavy ? (kind === 'takedown' ? 8 : Math.max(2, dmg) * 1.5) : dmg * (side === 2 ? 0.8 : 0.5));
    H.hp -= real;
    body.hurt(0.0001, fx0, fz0, heavy ? 5 : 2); // the body shows it (and is knocked back)
    if (H.hp <= 0) { H.hp = 0; H.state = H.mission ? 'beaten' : 'down'; H.t = 0; if (!H.mission) say('hurt'); return false; } // in the mission he never runs: he goes to one knee
    if (heavy) { H.state = 'stagger'; H.t = 0; H.stagDur = 0.8; if (Math.random() < 0.4) say('hurt'); }
    return false; // nobody knocks him out in one
  };

  // ---- how he fights: a karate champion and a gymnast; the sword is a last resort ----
  function startCombo(list, wind) { H.combo = [...list]; H.attack = 'hands'; H.state = 'windup'; H.t = 0; H.windDur = wind; audio.danger?.(false); }
  function gymnast(toP) { // a backflip or a cartwheel out of reach
    const side = Math.random() < 0.5 ? 1 : -1, back = Math.random() < 0.6, dir = back ? toP + Math.PI : toP + side * Math.PI / 2;
    body.vel.set(Math.sin(dir) * 6, 6.5, Math.cos(dir) * 6); body.onGround = false; body.yaw = toP;
    body.flip = { kind: back ? 'back' : 'side', t: 0, dur: 0.6 }; body.airFlips = 1;
  }
  H.sword = false; H.swordT = 0;
  // shot at: the blade comes out and turns the bullet away
  H.deflect = (from) => { H.swordT = 1.4; body.yaw = Math.atan2(from.x - H.pos.x, from.z - H.pos.z); fx?.burst(H.pos.x, H.pos.y + 1.3, H.pos.z, 0xfff1c4, 12, 4); audio.clank?.(H.pos); if (Math.random() < 0.3) hud.say('The Hunter', pick(['Not today.', 'Hm.']), 1.6); };
  // something thrown at him: often he cuts it out of the air
  H.cutThrow = () => { if (!H.active || ['down', 'stagger', 'pin'].includes(H.state) || Math.random() > 0.55) return false; H.swordT = 1.0; fx?.burst(H.pos.x, H.pos.y + 1.4, H.pos.z, 0xffffff, 10, 4); audio.clank?.(H.pos); hud.popup('HE CUT IT OUT OF THE AIR'); return true; };

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

  // an officer gets a hand on him: a flip out of it, or the officer goes down
  let resistCd = 0, fightT = 0;
  H.resist = (g) => {
    if (resistCd > 0 || ['down', 'pin', 'beaten'].includes(H.state)) return;
    resistCd = 1.2;
    const toG = Math.atan2(g.pos.x - H.pos.x, g.pos.z - H.pos.z);
    if (Math.random() < 0.5) gymnast(toG); else { body.yaw = toG; g.takeHit(1, H.pos.x, H.pos.z, 'heavy'); fx?.dust(g.pos.x, g.pos.y + 0.2, g.pos.z, 6); audio.clank?.(g.pos); }
    if (Math.random() < 0.35) hud.say('The Hunter', pick(['Stay out of this.', 'Not you. Him.', 'Go home, officer.']), 2);
  };

  // ---- arriving and leaving ----
  H.start = (fromX?, fromZ?) => {
    if (H.active) return;
    const spots = world.spots.filter(q => { const d = Math.hypot(q.x - player.pos.x, q.z - player.pos.z); return d > 45 && d < 75; });
    const s = fromX != null ? { x: fromX, z: fromZ, nx: 0, nz: 0 } : spots[Math.floor(Math.random() * spots.length)] || { x: player.pos.x + 50, z: player.pos.z, nx: 0, nz: 0 };
    body.respawn?.(s.x + s.nx * 2, s.z + s.nz * 2, 0); body.pos.set(s.x + s.nx * 2, col.groundHeight(s.x, s.z, 40).h, s.z + s.nz * 2);
    body.mode = 'foot'; body.vel.set(0, 0, 0); body.rig.root.visible = true;
    Object.assign(H, { active: true, hp: H.maxHp, state: H.mission ? 'stalk' : 'hunt', t: 0, removed: false, sword: false, swordT: 0, drewT: 0, phase: 1 }); fightT = 0; lastSeen = { x: player.pos.x, y: player.pos.y, z: player.pos.z }; unseenT = 0; searchT = 0; pinT = 0;
    if (!game.thugs.includes(H)) game.thugs.push(H);
    if (!H.mission) hud.card('He\'s here', 'The Hunter');
    H.met = true; audio.alert();
  };
  const leave = (why) => {
    H.active = false; H.state = 'gone'; H.removed = true; body.rig.root.visible = false; body.pos.set(0, -80, 0); game.hunterPin = null;
    H.cd = 300 + Math.random() * 240;
    if (why === 'lost') { hud.banner('YOU LOST HIM', 'He doesn\'t know Lagos the way you do. He\'ll be back.', 'green', 3.5); game.addRespect?.(800, 'LOST THE HUNTER'); }
    if (why === 'beaten') { hud.banner('HE PULLED BACK', 'Hurt, over the rooftops and gone. Next time, catch him.', 'green', 3.5); game.addRespect?.(1500, 'THE HUNTER RETREATS'); }
  };
  H.remove = () => { leave('quiet'); hud.boss?.(null); };
  // the mission says when the fight starts (he's been following until then)
  H.engageNow = () => { if (H.active) { H.state = 'duel'; H.t = 0; atkCd = 1.2; } };

  // ---- demo (?demo=hunter): he runs a route of his own, rooftops and all, so you can watch him move ----
  H.body = body;
  let goal = null, goalT = 0, flourishT = 0;
  function nextGoal() {
    const p = body.pos, roofs: any[] = [];
    for (const s of col.solids.query(p.x - 20, p.z - 20, p.x + 20, p.z + 20, [])) {
      if (s.maxx - s.minx < 2.5 || s.maxz - s.minz < 2.5 || s.maxy < 2 || s.maxy > 8.5) continue;
      const x = Math.min(Math.max(p.x, s.minx + 1), s.maxx - 1), z = Math.min(Math.max(p.z, s.minz + 1), s.maxz - 1), d = Math.hypot(x - p.x, z - p.z);
      if (d < 5 || d > 16 || Math.abs(s.maxy - p.y) < 0.6) continue;
      if (col.solids.query(x - 0.4, z - 0.4, x + 0.4, z + 0.4, []).some(o => o !== s && o.maxy > s.maxy + 0.3 && o.miny < s.maxy + 1.9)) continue;
      roofs.push({ x, y: s.maxy, z });
    }
    const onRoof = p.y > 1.5;
    if (roofs.length && (!onRoof || Math.random() < 0.6)) return roofs[Math.floor(Math.random() * roofs.length)]; // up a wall, or across to the next roof
    const st = world.spots.filter(q => { const d = Math.hypot(q.x - p.x, q.z - p.z); return d > 8 && d < 22; });
    const q = st[Math.floor(Math.random() * st.length)] || { x: p.x + 10, z: p.z, nx: 0, nz: 0 };
    return { x: q.x + q.nx * 2, y: 0.15, z: q.z + q.nz * 2 }; // down to the street (he drops like a cat)
  }
  H.demo = () => {
    H.start(player.pos.x + 6, player.pos.z); H.state = 'demo'; H.demoing = true; goal = null;
  };

  // ---- every frame (called from the game's enemy loop, like any other enemy) ----
  H.update = (dt) => {
    if (!H.active) return null;
    H.t += dt; atkCd -= dt;
    const d = dist(), dy = player.pos.y - H.pos.y;
    const P = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
    const range = game.power > 0.5 ? 60 : 32;
    const sees = L.suit && !L.inside && !player.ride && d < range && !col.blocked(H.pos.x, H.pos.y + 1.6, H.pos.z, P.x, P.y + 1.2, P.z, 1.2);
    if (sees) { lastSeen = { ...P }; unseenT = 0; } else unseenT += dt;
    // armed robbers and the General's gunmen take him for a threat and open fire (he turns the bullets)
    for (const g of game.gunmen) if (g.alive && !g.foe && g.role !== 'police' && Math.hypot(g.pos.x - H.pos.x, g.pos.z - H.pos.z) < 20) g.foe = H;
    // a sword fight in the street gets the police called, and they try to bring in both of them
    resistCd -= dt;
    const fighting = ['duel', 'windup', 'strike', 'stagger'].includes(H.state) && d < 10;
    if (fighting) fightT += dt;
    if (fighting && game.heat > 0) { game.heatTimer = 0; game.policeLastSeen?.copy(player.pos); } // the callers keep calling while it goes on
    if (fightT > 10 && game.heat === 0 && !game.arrest) { fightT = 0; game.addHeat?.(1, 'Somebody called the police: two men fighting in the street, one with a sword.', true); game.radio?.say('Police radio: "Fight in progress, one armed with a sword. Arrest both of them."', true); }
    if (game.heat > 0) { // half of the officers on foot go for him, the rest for Bolaji
      const cops = game.gunmen.filter(g => g.alive && g.role === 'police' && !g.foe && g.state === 'chase');
      let mine = cops.filter(g => g.arrestee === H).length;
      for (const g of cops) if (!g.arrestee && mine < Math.floor(cops.length / 2) && Math.hypot(g.pos.x - H.pos.x, g.pos.z - H.pos.z) < Math.hypot(g.pos.x - player.pos.x, g.pos.z - player.pos.z) + 3) { g.arrestee = H; mine++; }
    }
    if (player.mode === 'zip' || player.mode === 'skitch' || player.mode === 'bike' || player.mode === 'ride') unseenT += dt * (H.mission ? 0.5 : 2); // the shortcuts he doesn't know (in the mission he's studied them)
    if (H.mission && H.state !== 'stalk' && H.state !== 'beaten') { // the fight turns at 60% and 30%
      const ph = H.hp > H.maxHp * 0.6 ? 1 : H.hp > H.maxHp * 0.3 ? 2 : 3;
      if (ph !== H.phase) { H.phase = ph; if (ph >= 2) H.sword = true; H.onPhase?.(ph); }
    }
    hud.boss?.(H.mission && H.bar && H.state !== 'beaten' ? { name: 'THE HUNTER', k: H.hp / H.maxHp } : null);
    const toP0 = Math.atan2(P.x - H.pos.x, P.z - H.pos.z), idle = { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} };
    const flyingKick = () => { H.combo = ['pounce']; H.attack = 'hands'; H.state = 'windup'; H.t = 0; H.windDur = 0.35; H.feint = false; audio.danger?.(false); };

    switch (H.state) {
      case 'stalk': { // following him across the city: high up where he can, never closing in (yet)
        if (d > 34 || !sees) chase(dt, sees ? P : lastSeen, true);
        else if (d < 20) drive(dt, { x: H.pos.x + (H.pos.x - P.x) / (d || 1) * 8, z: H.pos.z + (H.pos.z - P.z) / (d || 1) * 8, y: H.pos.y }, true); // too close: he melts back
        else { goalT += dt; if (!goal || goalT > 6 || (Math.hypot(goal.x - H.pos.x, goal.z - H.pos.z) < 1.6 && Math.abs(goal.y - H.pos.y) < 0.8)) { goal = nextGoal(); goalT = 0; } drive(dt, goal, false); } // roof to roof while he watches
        if (Math.random() < dt * 0.06) say('stalk');
        break;
      }
      case 'beaten': { // on one knee: it's over, and he knows it
        body.update(dt, idle, toP0, game.time);
        const r = body.rig; r.set('hipsY', r.t.hipsY - 0.42); r.set('thLX', -1.5); r.set('knLX', 2.1); r.set('thRX', 0.25); r.set('knRX', 1.7); r.set('spineX', 0.45); r.set('headX', 0.35); r.set('shLX', -0.3); r.set('shRX', -0.3); r.update(dt, 10);
        H.sword = false;
        break;
      }
      case 'hunt': {
        if (!L.suit && unseenT > 2 && !H.mission) { H.state = 'search'; searchT = 0; say('lost'); break; } // out of the suit: just another face in Lagos
        if (unseenT > (H.mission ? 20 : 9)) { H.state = 'search'; searchT = 0; say('lost'); break; }
        if (sees && d < 4.5 && Math.abs(dy) < 1.6) { H.state = 'duel'; H.t = 0; if (H.t < 1) say('arrive'); break; }
        if (H.mission && sees && d > 5 && d < 10 && body.onGround && atkCd <= 0 && Math.abs(dy) < 2 && Math.random() < dt * 2) { flyingKick(); break; } // your pounce, used on you
        chase(dt, sees ? P : lastSeen, true);
        break;
      }
      case 'search': { // he goes where he last saw him, and looks
        searchT += dt;
        if (sees && L.suit) { H.state = 'hunt'; break; }
        const dl = Math.hypot(lastSeen.x - H.pos.x, lastSeen.z - H.pos.z);
        if (dl > 3) chase(dt, lastSeen, true);
        else drive(dt, { x: lastSeen.x + Math.sin(searchT) * 6, z: lastSeen.z + Math.cos(searchT * 0.7) * 6 }, false);
        if (searchT > (H.mission ? 12 : 14)) { if (H.mission) { lastSeen = { ...P }; H.state = 'hunt'; hud.say('The Hunter', 'There you are.', 2); } else leave('lost'); } // in the mission he always finds you again
        break;
      }
      case 'duel': {
        if (!sees && unseenT > 1.2) { H.state = 'hunt'; break; }
        if (d > 6 || Math.abs(dy) > 1.8) { H.state = 'hunt'; break; }
        if (['down', 'crawl'].includes(player.mode) && d < 2.2) { H.state = 'pin'; pinT = 0; hud.say('The Hunter', 'Stay down.', 2); break; } // he's down: pin him
        const toP = Math.atan2(P.x - H.pos.x, P.z - H.pos.z);
        if (H.evade) { H.evade = false; gymnast(toP); break; } // a backflip or a cartwheel out of it
        if (H.parry) { H.parry = false; startCombo(['jab'], 0.12); break; } // blocked it: straight back with a punch
        const ph = H.phase || 1;
        // a swing that missed: he's straight into the gap
        if (H.mission && player.mode === 'act' && player.act && player.act.t > player.act.hitAt && d < 2.8 && atkCd < 1.1) { startCombo(['hook'], 0.14); H.feint = false; atkCd = 0; break; }
        if (atkCd <= 0 && d < 3.4) { // he picks his moment
          const blade = H.mission ? ph >= 2 && Math.random() < (ph === 3 ? 0.6 : 0.45) : H.hp < H.maxHp * 0.4;
          if (blade) { H.sword = true; H.attack = 'katana'; H.state = 'windup'; H.t = 0; H.windDur = ph === 3 ? 0.42 : 0.55; H.feint = false; audio.danger?.(true); if (!H.drewT) { H.drewT = 1; hud.say('The Hunter', 'Enough.', 2); } break; } // the blade
          startCombo(pick([['jab', 'hook', 'spin'], ['flipkick'], ['knee', 'hook'], ['sweep', 'jab'], ['jab', 'jab', 'flipkick'], ['spin']]), ph === 3 ? 0.3 : 0.38);
          H.feint = H.mission && Math.random() < (ph === 1 ? 0.12 : 0.24); // sometimes it's a fake, to draw your dodge
          break;
        }
        if (H.mission && d > 4 && atkCd <= 0 && Math.random() < dt * 1.2) { flyingKick(); break; }
        // light on his feet, circling at a kick's length, bouncing
        if (d > 2.6) drive(dt, P, false); else body.update(dt, { move: { x: Math.sin(H.t * 1.1) > 0 ? 1 : -1, y: d < 1.6 ? -1 : 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, toP, game.time);
        if (Math.random() < dt * 0.08) say(H.mission ? (['p1', 'p1', 'p2', 'p3'][ph]) : 'duel');
        break;
      }
      case 'windup': { // the "!" over him: yellow for hands and feet (counter it), red for the sword (dodge)
        body.update(dt, { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, Math.atan2(P.x - H.pos.x, P.z - H.pos.z), game.time);
        const r = body.rig, k = H.combo?.[0];
        if (H.attack === 'katana') { r.set('shRX', -2.8); r.set('elRX', -0.3); r.set('chestY', 0.6); }
        else if (k === 'flipkick' || k === 'spin' || k === 'sweep') { r.set('hipsY', r.t.hipsY - 0.15); r.set('chestY', 0.5); r.set('shLX', -1.2); r.set('shRX', -0.6); } // coiling for a kick
        else { r.set('shLX', -1.4); r.set('elLX', -1.8); r.set('shRX', -1.0); r.set('elRX', -2.0); r.set('chestY', -0.3); } // fists up, karate guard
        r.update(dt, 25);
        if (H.feint && H.t >= H.windDur * 0.6) { // the fake: he pulls it, steps out, and comes again sooner
          H.feint = false; H.state = 'duel'; H.t = 0; atkCd = 0.28; const back = Math.atan2(H.pos.x - P.x, H.pos.z - P.z); body.vel.x += Math.sin(back) * 3; body.vel.z += Math.cos(back) * 3; break;
        }
        if (H.t >= H.windDur) {
          H.state = 'strike'; H.t = 0;
          const kind = H.attack === 'katana' ? pick(['spin', 'hook']) : H.combo.shift();
          const DMG = { jab: 7, hook: 9, knee: 10, spin: 12, flipkick: 14, sweep: 8, pounce: 12 };
          body.startAct(kind, player, () => {
            if (dist() > 2.7 || Math.abs(player.pos.y - H.pos.y) > 1.6) return;
            game.lastHitKatana = H.attack === 'katana';
            const hit = player.hurt(H.attack === 'katana' ? 22 : DMG[kind] || 9, H.pos.x, H.pos.z, H.attack === 'katana' ? 4.5 : kind === 'flipkick' || kind === 'spin' ? 7 : 3);
            if (hit) { game.combat?.hit?.(); audio.hurt?.(); if (game.env) game.env.grade.uniforms.hurt.value = 1; }
            if (hit && H.attack === 'katana') { fx?.burst(player.pos.x, player.pos.y + 1.2, player.pos.z, 0xff4040, 10, 3); audio.clank?.(player.pos); }
            game.lastHitKatana = false;
          }, { reach: 1.3 });
          const ph = H.phase || 1; atkCd = ph === 3 ? 0.55 + Math.random() * 0.6 : ph === 2 ? 0.8 + Math.random() * 0.9 : 1.0 + Math.random() * 1.1;
        }
        break;
      }
      case 'strike': {
        body.update(dt, { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, body.yaw, game.time);
        if (body.mode !== 'act') {
          if (H.attack !== 'katana' && H.combo?.length && dist() < 3) { H.state = 'windup'; H.t = 0; H.windDur = 0.2; } // the next blow of the combination, quick
          else { H.state = 'duel'; H.t = 0; }
        }
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
      case 'down': { // hurt enough: he goes down, then pulls back over the rooftops (never in the mission)
        body.update(dt, { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, body.yaw, game.time);
        const r = body.rig; Pose.down(r); r.update(dt, 14);
        if (H.t > 2.5) { H.state = 'retreat'; H.t = 0; hud.say('The Hunter', 'This is not finished.', 3); }
        break;
      }
      case 'demo': {
        goalT += dt; flourishT -= dt;
        const gd = goal ? Math.hypot(goal.x - H.pos.x, goal.z - H.pos.z) : 0;
        if (!goal || (gd < 1.6 && Math.abs(goal.y - H.pos.y) < 0.8) || goalT > 9) { goal = nextGoal(); goalT = 0; if (Math.random() < 0.35) flourishT = 0.9; } // a new mark, sometimes a flourish with the blade first
        if (flourishT > 0) { body.update(dt, { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, held: {}, pressed: {} }, body.yaw, game.time); const r = body.rig; r.set('shRX', -2.8 + (0.9 - flourishT) * 3); r.set('chestY', 0.6 - (0.9 - flourishT) * 1.2); r.update(dt, 22); break; }
        if (body.onGround && Math.random() < dt * 0.25 && gd > 6) { body.update(dt, { move: { x: 0, y: 1 }, look: { dx: 0, dy: 0 }, held: { sprint: true }, pressed: { roll: true } }, Math.atan2(goal.x - H.pos.x, goal.z - H.pos.z), game.time); break; } // a roll, for the flow of it
        drive(dt, goal, true);
        if (!body.onGround && body.airFlips < 1 && body.vel.y > 2 && Math.random() < dt * 1.2) body.update(0.0001, { move: { x: 0, y: 1 }, look: { dx: 0, dy: 0 }, held: {}, pressed: { jump: true } }, body.yaw, game.time); // and a flip off the top
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
    H.swordT = Math.max(0, H.swordT - dt);
    body.rig.drawKatana(H.sword || H.swordT > 0 || (H.state === 'windup' && H.attack === 'katana') || (H.state === 'demo' && flourishT > 0));
    return null;
  };

  // ---- when he comes: at night, for Street Cat, more likely once the police are after him ----
  H.cd = 200 + Math.random() * 120;
  H.tick = (dt) => {
    return; // he only comes in Mission 7 (docs/story-bible.md): never at random
    if (H.demoing || H.active || game.mode !== 'patrol' || !L.suit || L.inside || L.phase !== 'night' || game.story?.active || game.arrest) return;
    H.cd -= dt * (game.heat > 0 ? 2.5 : 1);
    if (H.cd <= 0) H.start();
  };
  return H;
}
