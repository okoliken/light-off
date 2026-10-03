// The night's systems. Chapter 1 story + side events (story.js), Bolaji's needs and home (life.js),
// free-flow combat against the Red Caps (combat.js, thugs.js), the web shooter, levy collections,
// police heat with officers on foot, NEPA blackouts, Street Sense, Respect, wayfinding, markers, stats.
import * as THREE from 'three';
import { Civilian, makeBag } from './npcs.ts';
import { Thug } from './thugs.ts';
import { Gunman } from './enemies.ts';
import { createCombat } from './combat.ts';
import { createLife } from './life.ts';
import { createStory } from './story.ts';
import { createThrowables } from './throwables.ts';
import { createDay } from './day.ts';
import { createTransport } from './transport.ts';
import { createCheckpoints } from './police.ts';
import { createActivities } from './activities.ts';
import { createRadio } from './radio.ts';
import { nightStart } from './nightreport.ts';
import { OUTFITS, Rig, Pose } from '../player/rig.ts';
import { textSign } from '../core/textures.ts';
import { blockRect, WALK, N, HALF, roadLine } from '../world/layout.ts';

const FAMILIES: any[] = [
  ['Mama Tunde', 'her shop was locked for "unpaid levy"'], ['Baba Ade', 'the shoemaker by the gutter'],
  ['Iya Bose', 'she fries akara every morning'], ['Blessing', 'her hair stall was seized last week'],
  ['Mr. Emeka', "his kids' school fees are due"], ['Mama Grace', "the pastor's widow"],
  ['Alhaji Musa', 'suya seller, three children'], ['Aunty Kemi', 'sells pure water at the junction'],
];
const TIPS: any[] = [
  [2, 'Press <span class="key">R</span> to unclip your board and skate. <span class="key">R</span> again straps it back on.'],
  [14, 'Fighting: <span class="key">F</span> strikes whoever you push toward, <span class="key">C</span> counters when <b>"!"</b> flashes over someone, <span class="key">G</span> launches them into the air (then <span class="key">F</span> to juggle).'],
  [30, '<span class="key">V</span> <b>pounces</b> onto an enemy up to 15 m away, like a cat on a rat. With no target it\'s a huge leap.'],
  [40, '<span class="key">T</span> picks up street junk (stones, bottles, pure water, buckets, tyres) and throws it. With nothing in reach, T throws your <b>board</b> (then go and get it).'],
  [46, 'Watch your <b>hunger</b> and <b>energy</b>. Low means slower, weaker, no flips. Eat at suya / akara / mama-put stands, or Mama\'s pot at home.'],
  [62, '<b>Street Sense</b> wakes up by itself when danger starts: time slows and a green trail shows the way out.'],
  [80, 'Get home before <b>5:30 AM</b>. And never lead anyone to your gate.'],
];

export function createGame(ctx) {
  const { scene, world, traffic, player, camera, hud, audio, env, fx } = ctx;
  const R = Math.random;
  const home = world.home, col = world.collision;

  const game = {
    ...ctx, time: 0, heat: 0, heatTimer: 0, seenTime: 0, catchMeter: 0, assaultCd: 0,
    power: 1, blackout: { state: 'on', t: 0, next: 80, dur: 0 },
    sense: false, senseMeter: 100, senseCd: 0, timeScale: 1, senseTaught: false, escape: null, escapeT: 0,
    thugs: [], gunmen: [], sites: [], civilians: [], delivery: null, carrying: null, dropped: null,
    respect: 0,
    stats: { returned: 0, families: 0, knockdowns: 0, blackouts: 0, topSpeed: 0, skitchDist: 0, longestGrind: 0, busted: 0, time: 0, tricks: 0, saved: 0, bestCombo: 0 },
    markers: [], mapMarkers: [], dangers: [], prompt: null, policeRange: 55, gunDanger: [],
    respawnT: 0, tipI: 0, spawnCd: 3, grindLen: 0, patrolT: 3, areaName: '',
  };
  game.logNight = (k, o: any = {}) => (game.nightLog ||= []).push({ k, ...o });
  game.say = (npc, text, who = 'Red Cap', range = 45) => { if (!npc || !npc.pos || npc.pos.distanceTo(player.pos) < range) hud.say(who, text); };
  game.addRespect = (n, label) => { if (label && game.missionMoves) game.missionMoves.add(String(label).replace(/ X?\d+.*$/, '').replace(/^\d+-HIT /, '')); if (n <= 0) return; game.respect += Math.round(n); if (label) hud.popup(`${label} <b>+${Math.round(n)}</b>`); };
  game.life = createLife(game);
  game.combat = createCombat(game);
  const L = game.life, combat = game.combat;

  // ---------- helpers ----------
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
  const addHeat = (n, why) => { const old = game.heat; game.heat = Math.min(3, Math.max(game.heat, 0) + n); game.heatTimer = 0; if (game.heat > old) { audio.alert(); if (why) hud.toast(why, 'red'); } };
  game.addHeat = (n, why) => addHeat(n, why);
  // ---------- daylight: people can see his face ----------
  // In his own clothes by day, fighting and cat moves in front of people fill EYES ON YOU.
  // Full: he's recognised. Mama hears about it, the police want a word, and a daytime mission fails.
  game.exposure = 0; game.recognisedAt = -1; let exposeT = 0;
  game.expose = (n) => {
    if (game.life.phase !== 'day' || game.life.inside || game.life.suit || n <= 0) return;
    game.exposure = Math.min(100, game.exposure + n); exposeT = 0;
    if (game.exposure >= 100) {
      game.exposure = 35; game.recognisedAt = game.time;
      game.life.suspicion = Math.min(100, game.life.suspicion + 30);
      hud.banner('RECOGNISED', 'People saw Bolaji from Aguda fight like the boy in black. Mama will hear about this.', 'red', 4);
      addHeat(1, 'Police: "You! Aguda boy! Come here, we want to ask you questions."');
    }
  };
  const updateExposure = (dt) => { exposeT += dt; if (exposeT > 3) game.exposure = Math.max(0, game.exposure - dt * 5); if (game.life.phase !== 'day' || game.life.inside) game.exposure = 0; };
  const policeSeeing = () => traffic.police().some(v => v.police.sees);
  const bagOnHip = makeBag(); bagOnHip.position.set(0.2, -0.02, -0.12); bagOnHip.scale.setScalar(0.85); bagOnHip.visible = false; player.rig.b.hips.add(bagOnHip);
  const removeCiv = (civ, delay = 0) => { const f = () => { civ.remove(scene); const i = game.civilians.indexOf(civ); if (i >= 0) game.civilians.splice(i, 1); }; delay ? setTimeout(f, delay) : f(); };
  function spawnThug(o) { const t = new Thug(scene, world, o); game.thugs.push(t); return t; }
  function spawnVictim({ x, z, yaw = 0, outfit, mood = 'idle' }: any) { const c = new Civilian(scene, world, { x, z, yaw, outfit }); c.mood = mood; game.civilians.push(c); return c; }
  function moveDir(inp) {
    const m = inp.move, cy = camera.yaw;
    if (Math.hypot(m.x, m.y) > 0.2) { const x = Math.sin(cy) * m.y - Math.cos(cy) * m.x, z = Math.cos(cy) * m.y + Math.sin(cy) * m.x, l = Math.hypot(x, z); return [x / l, z / l]; }
    const y = ['board', 'bike'].includes(player.mode) ? player.heading : player.yaw; return [Math.sin(y), Math.cos(y)];
  }
  function findSpot(minD, maxD) {
    const c = world.spots.filter(s => { const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z); return d > minD && d < maxD && !(s.bi === 1 && s.bj === 1) && s.bi !== 4 && game.sites.every(q => dist2(q.spot, s) > 30 * 30) && world.vendors.every(v => dist2(v, s) > 15 * 15); });
    return c[Math.floor(R() * c.length)] || null;
  }

  // ---------- levy collection points (side missions) ----------
  function makeSite(spot, name, { guards = 1, amount }: any) {
    const nx = spot.nx, nz = spot.nz, ax = -nz, az = nx, group = [];
    const collector = spawnThug({ x: spot.x, z: spot.z, yaw: Math.atan2(-nx, -nz), variant: 'agbero', role: 'collector', group });
    collector.giveBag(); group.push(collector);
    const site: any = { name, spot, amount, collector, group, state: 'active', alarmT: -1, respawn: 0 };
    collector.site = site;
    for (let k = 0; k < guards; k++) { const off = k ? -2.2 : 2.2; group.push(spawnThug({ x: spot.x + ax * off + nx * 0.8, z: spot.z + az * off + nz * 0.8, yaw: Math.atan2(nx, nz), variant: 'agbero2', weapon: k ? 'stick' : null, role: 'guard', group })); }
    site.trader = spawnVictim({ x: spot.x - nx * 1.5, z: spot.z - nz * 1.5, yaw: Math.atan2(nx, nz), mood: 'scared' });
    return site;
  }
  {
    const spots = world.spots.filter(s => !(s.bi === 1 && s.bj === 1) && s.bi !== 4 && Math.hypot(s.x - home.x, s.z - home.z) > 75);
    const chosen: any[] = [];
    for (let tries = 0; tries < 400 && chosen.length < 2; tries++) { const s = spots[Math.floor(R() * spots.length)]; if (chosen.every(c => dist2(c, s) > 110 * 110) && dist2(s, world.marketSpot) > 80 * 80 && dist2(s, world.motorparkSpot) > 90 * 90) chosen.push(s); }
    game.sites.push(makeSite(world.marketSpot, 'Adelabu Market gate', { guards: 1, amount: 45000 }));
    for (const s of chosen) game.sites.push(makeSite(s, 'Street corner', { guards: R() < 0.5 ? 1 : 2, amount: 30000 + Math.floor(R() * 4) * 5000 }));
  }

  // ---------- carrying / delivering (levy bags and stolen items) ----------
  function startCarry(item) {
    game.carrying = item; bagOnHip.visible = true;
    if (item.site) item.site.state = 'carried';
    audio.pickup();
    if (item.keep) { game.delivery = null; }
    else if (item.returnTo) { const r = item.returnTo, civ = spawnVictim({ x: r.x, z: r.z, yaw: 0, mood: 'wave' }); civ.name = r.name; game.delivery = { civ, name: r.name, why: r.why, x: r.x, z: r.z, amount: item.amount, own: true }; }
    else if (item.owner) {
      const o = item.owner;
      game.delivery = { civ: o, name: o.name || 'the owner', why: 'give back what they stole', get x() { return o.pos.x; }, get z() { return o.pos.z; }, amount: item.amount, own: false };
      o.mood = 'wave'; o.faceTarget = player.pos;
    } else {
      const cands = world.spots.filter(q => { const d = Math.hypot(q.x - player.pos.x, q.z - player.pos.z); return d > 110 && d < 260 && !(q.bi === 1 && q.bj === 1); });
      const s = cands[Math.floor(R() * cands.length)] || world.spots[0];
      const [name, why] = FAMILIES[Math.floor(R() * FAMILIES.length)];
      const civ = spawnVictim({ x: s.x, z: s.z, yaw: Math.atan2(s.nx, s.nz), mood: 'wave' }); civ.name = name;
      game.delivery = { civ, name, why, x: s.x, z: s.z, amount: item.amount, own: true };
    }
    hud.toast(`Got <b>${item.label}</b>${item.amount ? ` (₦${item.amount.toLocaleString()})` : ''}.`, 'green');
  }
  function loseItem() {
    const item = game.carrying || game.dropped?.item;
    if (game.dropped) { scene.remove(game.dropped.mesh); game.dropped = null; }
    if (!item) return;
    if (item.site) { item.site.collector.giveBag(); item.site.state = 'active'; }
    game.carrying = null; bagOnHip.visible = false;
    if (game.delivery?.own) removeCiv(game.delivery.civ);
    game.delivery = null;
  }
  function deliver() {
    const d = game.delivery, item = game.carrying;
    game.stats.returned += d.amount || 0; game.stats.families++;
    d.civ.mood = 'cheer'; d.civ.faceTarget = player.pos;
    hud.notice(item.amount ? `₦${item.amount.toLocaleString()} RETURNED` : 'RETURNED', `${d.name}: "God bless you, whoever you are!"`, 'green', 3);
    audio.deliver();
    if (d.civ.tip) { L.wallet += d.civ.tip; hud.toast(`${d.name} pressed <b>₦${d.civ.tip.toLocaleString()}</b> into your hand.`, 'green'); d.civ.tip = 0; }
    game.addRespect(300 + (d.amount || 0) / 200, 'GOOD DEED');
    if (item.site) { item.site.state = 'done'; item.site.respawn = 240; }
    if (d.own) removeCiv(d.civ, 7000); else { const civ = d.civ; setTimeout(() => { if (!civ.gone) civ.runHome(civ.pos.x + 35, civ.pos.z + 10); }, 4000); }
    game.logNight('returned', { name: d.name, amount: d.amount });
    game.story.onReturned(d.civ);
    game.carrying = null; game.delivery = null; bagOnHip.visible = false;
  }
  function dropItem(pos, item) {
    if (game.dropped) { scene.remove(game.dropped.mesh); }
    const m = makeBag(); m.position.set(pos.x, pos.y + 0.2, pos.z); scene.add(m);
    game.dropped = { mesh: m, item }; if (item.site) item.site.state = 'dropped';
    hud.toast(`<b>${item.label}</b> hit the ground: grab it <span class="key">F</span>`, 'green');
  }
  const rogerItem = (amount) => ({ label: 'the roger money', amount, returnTo: { x: world.motorparkSpot.x + 4, z: world.motorparkSpot.z + 6, name: 'the danfo drivers', why: 'give the drivers back the roger the police took' } });
  game.onKnockout = (t) => {
    game.stats.knockdowns++;
    game.expose(8);
    game.addRespect(50, 'KO');
    if (t.item) { const it = t.item; t.item = null; t.takeBag?.(); dropItem(t.pos, it); }
    else if (t.cp && t.collector && t.cp.cash > 0) dropItem(t.pos, rogerItem(game.police.take(t.cp)));
    else if (t.hasBag && t.site) { t.takeBag(); dropItem(t.pos, { label: 'the levy bag', amount: t.site.amount, site: t.site }); }
    if (policeSeeing() && game.assaultCd <= 0) { game.assaultCd = 15; addHeat(1, 'Police saw the fight!'); }
  };

  // ---------- story ----------
  const api = {
    spot: findSpot, thug: spawnThug, victim: spawnVictim,
    giveItem: (t, item) => { t.giveBag?.(); t.item = item; },
    droppedPos: () => game.dropped?.mesh.position || null,
    carrying: (label) => game.carrying?.label === label,
    itemFor: (v) => game.carrying?.owner === v || game.dropped?.item.owner === v || game.thugs.some(t => t.alive && t.item?.owner === v),
    tails: (n) => spawnTails(n),
    get home() { return world.homeDoor; }, traffic,
    underBridge: (bj) => world.underBridge.find(u => u.bj === bj) || world.underBridge[0],
    motorpark: { x: world.motorparkSpot.x, z: world.motorparkSpot.z + 10 },
    scatter: (x, z, n) => game.throwables?.scatter(x, z, n),
    say: (who, text) => hud.say(who, text, 3.5), banner: (...a) => hud.banner(...a), toast: (...a) => hud.toast(...a), notice: (...a) => hud.notice(...a),
    gunman: (o) => { const g = new Gunman(scene, world, { role: 'police', ...o }); game.gunmen.push(g); return g; },
    checkpoint: (i) => game.police.list[i],
    policeAlert: (secs) => { game.policeAlertT = secs; game.spawnCd = 0; },
    recarry: (item) => { game.carrying = null; game.delivery = null; startCarry(item); },
    addHeat: (n, why) => addHeat(n, why),
    scene: (lines, focus, onDone, title) => { if (lines?.length && game.playScene) game.playScene(lines, focus, onDone, title); else onDone?.(); },
  };
  game.story = createStory(game, api);

  game.day = createDay(game);
  game.transport = createTransport(game);
  game.police = createCheckpoints(game);
  game.radio = createRadio(game);
  game.activities = createActivities(game, { spot: findSpot, victim: spawnVictim, thug: spawnThug, giveItem: api.giveItem, gunman: api.gunman });
  const DAY = game.day, TR = game.transport;

  // ---------- lookouts following him home ----------
  function spawnTails(n) {
    for (let k = 0; k < n; k++) {
      // a spot on open ground 22-38 m away that can see him (they start out watching)
      let x = 0, z = 0, fallback = null;
      for (let tries = 0; tries < 80; tries++) {
        const a = R() * Math.PI * 2, d = 22 + R() * 16, cx = player.pos.x + Math.sin(a) * d, cz = player.pos.z + Math.cos(a) * d;
        if (Math.abs(cx) > HALF || Math.abs(cz) > HALF || col.solids.query(cx - 0.5, cz - 0.5, cx + 0.5, cz + 0.5, []).some(s => s.maxy > 1)) continue;
        fallback ||= [cx, cz];
        if (!col.blocked(cx, 1.6, cz, player.pos.x, player.pos.y + 1.2, player.pos.z, 1.2)) { x = cx; z = cz; fallback = null; break; }
      }
      if (fallback) [x, z] = fallback;
      const t = spawnThug({ x, z, variant: 'redcap', role: 'tail' }); t.state = 'tail';
      t.lastSeen = player.pos.clone(); t.lost = 0;
    }
    hud.toast(`<b>You're being followed.</b> ${n > 1 ? n + ' lookouts want' : 'A lookout wants'} to see where you live. Lose them before you go home.`, 'red');
  }
  game.onTailLost = () => { hud.toast(L.followers().length > 1 ? 'You lost one of them. ' + (L.followers().length - 1) + ' left.' : '<b>You lost them.</b> Now go home.', 'green'); game.addRespect(80, 'LOST THE TAIL'); };

  // ---------- cult patrols (grow with the Red Caps' interest in you) ----------
  function updatePatrols(dt) {
    game.patrolT -= dt; if (game.patrolT > 0) return;
    game.patrolT = 8;
    const want = L.wanted * 2;
    const patrols = game.thugs.filter(t => t.alive && t.role === 'patrol');
    if (patrols.length >= want) return;
    const cands = world.blocks.filter(q => q.bi >= 0 && q.bj >= 0 && q.bi < N && q.bj < N && q.type === 'regular' && !(q.bi === 1 && q.bj === 1));
    const b = cands[Math.floor(R() * cands.length)];
    if (!b) return;
    const r = blockRect(b.bi, b.bj), i = WALK * 0.5;
    const route: any[] = [[r.x0 + i, r.z0 + i], [r.x1 - i, r.z0 + i], [r.x1 - i, r.z1 - i], [r.x0 + i, r.z1 - i]];
    if (route.some(([x, z]) => Math.hypot(x - player.pos.x, z - player.pos.z) < 50)) return;
    const group: any[] = [];
    for (let k = 0; k < 2; k++) { const t = spawnThug({ x: route[0][0] + k * 1.2, z: route[0][1], variant: k ? 'agbero2' : 'agbero', weapon: R() < 0.3 ? 'stick' : null, role: 'patrol', group }); t.patrol = route; t.state = 'patrol'; group.push(t); }
  }

  // ---------- shooting at Bolaji (police officers) ----------
  const _chest = new THREE.Vector3(), _miss = new THREE.Vector3(), _t = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
  function resolveShot(from) {
    if (game.arrest || player.mode === 'ride') return; // he's in the back of a car: nobody shoots
    _chest.set(player.pos.x, player.pos.y + 1.2, player.pos.z);
    const d = from.distanceTo(_chest);
    const los = !col.blocked(from.x, from.y, from.z, _chest.x, _chest.y, _chest.z, 1.2);
    const dodging = player.mode === 'roll' || player.invuln > 0 || player.mode === 'down';
    let chance = Math.max(0.2, Math.min(0.8, 1 - d / 40));
    if (Math.hypot(player.vel.x, player.vel.z) > 7) chance *= 0.55;
    if (!player.onGround || player.mode === 'wallrun') chance *= 0.7;
    const hit = los && !dodging && R() < chance;
    if (hit) _miss.copy(_chest);
    else { _miss.copy(_chest).sub(from).normalize().multiplyScalar(d + 6).add(from); _miss.x += (R() - 0.5) * 3; _miss.y += (R() - 0.3) * 2; _miss.z += (R() - 0.5) * 3; }
    fx.tracer(from, _miss); fx.flash(from.x, from.y, from.z); audio.gun(from);
    game.gunDanger.push({ x: from.x, z: from.z, t: 3 });
    if (hit) { if (player.hurt(25, from.x, from.z, 2)) { combat.hit(); audio.hurt(); env.grade.uniforms.hurt.value = 1; camera.shake = 0.5; } }
    else { const y = col.groundHeight(_miss.x, _miss.z, _miss.y).h; if (_miss.y < y + 2) fx.burst(_miss.x, Math.max(y, _miss.y), _miss.z, 0xffe0a0, 6, 3); audio.ricochet?.(_miss); }
  }

  // ---------- street throws (T) ----------
  const TH = game.throwables = createThrowables(scene, world);
  const KIND_FX = { stone: 0xbdb6a6, brick: 0xc0703f, bottle: 0x9ccc65, sachet: 0xe3f2fd, bucket: 0x42a5f5, tyre: 0x444444, board: 0xd7a86e };
  player.dropHeld = () => { if (player.holding) { TH.drop(player.holding, player.pos); player.holding = null; } };
  function throwTarget(dir) {
    if (player.aiming) { const cam = camera.cam; cam.getWorldDirection(_d); const hitT = col.raycast(cam.position.x, cam.position.y, cam.position.z, _d.x, _d.y, _d.z, 40); return _t.copy(cam.position).addScaledVector(_d, Math.min(hitT, 40)).clone(); }
    let best = null, bs = Infinity;
    for (const t of [...game.thugs, ...game.gunmen]) {
      if (!t.alive || t.state === 'tail' && !t.sees) continue;
      const dx = t.pos.x - player.pos.x, dz = t.pos.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d > 22 || d < 1) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * dir[0] + dz * dir[1]) / d)));
      if (ang > 1.1 || col.blocked(player.pos.x, player.pos.y + 1.5, player.pos.z, t.pos.x, t.pos.y + 1.2, t.pos.z, 1.2)) continue;
      const sc = d + ang * 10 + (t.state === 'throwWind' ? -8 : 0);
      if (sc < bs) { bs = sc; best = t; }
    }
    if (best) return new THREE.Vector3(best.pos.x + best.vel.x * 0.3, best.pos.y + 1.2, best.pos.z + best.vel.z * 0.3);
    return null;
  }
  function doThrow(dir) {
    if (player.cuffed) { hud.popup('HANDS CUFFED'); return; }
    if (!['foot', 'board'].includes(player.mode)) return;
    if (player.holding) {
      const to = throwTarget(dir) || new THREE.Vector3(player.pos.x + dir[0] * 12, player.pos.y, player.pos.z + dir[1] * 12);
      player.handPos(_o); const it = player.holding; player.holding = null;
      player.yaw = Math.atan2(to.x - player.pos.x, to.z - player.pos.z); player.startThrow();
      TH.launch(it.kind, it.mesh, _o.clone(), to, 'player', it.kind === 'tyre' ? 16 : 22);
      TH.items.splice(TH.items.indexOf(it), 1); audio.swing();
      return;
    }
    const it = TH.nearest(player.pos, 2.2);
    if (it) { player.holding = it; TH.pickUp(it, player.rig.b.haR); audio.grab(); hud.popup(`${it.kind === 'sachet' ? 'PURE WATER' : it.kind.toUpperCase()} · <b>T</b> TO THROW`); return; }
    if (!player.boardLost && player.mode === 'foot') {
      const to = throwTarget(dir);
      if (!to) { hud.popup('NOTHING TO THROW'); return; }
      player.handPos(_o); player.startThrow(); player.boardLost = true;
      const m = player.board.clone(); m.visible = true;
      TH.launch('board', m, _o.clone(), to, 'player', 20); audio.swing();
      hud.toast('You threw your board. <b>Go and pick it up</b> before you can skate again.', 'blue');
      return;
    }
    hud.popup('NOTHING TO THROW');
  }
  function hitTest(a, b, owner) {
    let best = null;
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const list = owner === 'enemy' ? [player] : [...game.thugs, ...game.gunmen].filter(f => f.alive).concat(traffic.vehicles.filter(v => v.kind === 'getaway' && v.ai && !v.ai.stopped).map(v => ({ pos: v.pos, alive: true, car: v })));
    for (const f of list) {
      const t = Math.max(0, Math.min(1, ((f.pos.x - a.x) * abx + (f.pos.z - a.z) * abz) / Math.max(1e-6, abx * abx + abz * abz)));
      const px = a.x + abx * t, py = a.y + aby * t, pz = a.z + abz * t;
      const rr = f.car ? 1.6 : 0.6;
      if ((px - f.pos.x) ** 2 + (pz - f.pos.z) ** 2 < rr * rr && py > f.pos.y - 0.2 && py < f.pos.y + 2 && (!best || t < best.t)) best = { t, target: f };
    }
    return best;
  }
  function onThrowHit(kind, target, pos, owner) {
    fx.burst(pos.x, pos.y, pos.z, KIND_FX[kind] || 0xffffff, kind === 'bottle' || kind === 'sachet' ? 16 : 7, 3);
    if (kind === 'bottle') audio.glass(); else if (kind === 'sachet') audio.splash?.(); else audio.clank?.(pos);
    if (owner === 'enemy') { if (target === player && player.hurt(kind === 'knife' ? 15 : 10, pos.x, pos.z, 2)) { combat.hit(); env.grade.uniforms.hurt.value = 1; camera.shake = 0.35; } return; }
    if (!target) return;
    if (target.car) { // a stone through the windscreen
      const v = target.car; v.ai.health -= kind === 'brick' || kind === 'tyre' || kind === 'board' ? 2 : 1; audio.glass(); camera.shake = 0.2;
      hud.popup(v.ai.health > 0 ? `WINDSCREEN · <b>${v.ai.health} MORE</b>` : '<b>THE DRIVER LOST IT</b>');
      if (v.ai.health <= 0) { v.ai.smashed = true; game.addRespect(300, 'CAR STOPPED'); }
      return;
    }
    const eff = { stone: ['light', 1, 'stun', 1.0], brick: ['light', 2, 'stun', 1.4], bottle: ['light', 1, 'stun', 1.8], sachet: [null, 0, 'blind', 2.4], bucket: [null, 0, 'blind', 3.4], tyre: ['heavy', 2, null], board: ['heavy', 2, null] }[kind];
    let ko = false;
    if (eff[0]) ko = target.takeHit ? target.takeHit(eff[1], player.pos.x, player.pos.z, eff[0] === 'light' && target.big ? 'heavy' : eff[0]) : target.hit(eff[1], player.pos.x, player.pos.z, 5);
    if (!ko && eff[2] === 'stun') target.stun?.(eff[3]);
    if (eff[2] === 'blind') { if (target.blind) target.blind(eff[3]); else target.stun?.(eff[3]); hud.popup(kind === 'sachet' ? 'PURE WATER IN THE FACE' : 'BUCKET ON HIS HEAD'); }
    if (ko) game.onKnockout?.(target);
    game.addRespect(kind === 'bucket' || kind === 'sachet' ? 40 : 30, 'STREET THROW');
    for (const o of game.thugs) if (o.alive && dist2(o.pos, target.pos) < 20 * 20) o.engage(0.2);
  }

  // ---------- interactions (F) ----------
  const R0 = world.room;
  function roomOption() {
    const near = (q, r = 1.3) => dist2(q, player.pos) < r * r;
    const isDay = L.phase === 'day';
    if (isDay) {
      if (near(R0.door, 1.2)) return { kind: 'out', story: false, text: '<span class="key">F</span>Go out into Surulere (daytime, your own clothes)' };
      if (near(R0.radio, 0.8)) return { kind: 'radio', text: '<span class="key">F</span>Turn on the radio' };
      if (near(R0.drum, 1.2)) return { kind: 'bag', text: L.bag ? '<span class="key">F</span>Put the suit back in the drum' : '<span class="key">F</span>Roll the suit into your backpack (change anywhere nobody can see you: <span class="key">U</span>)' };
      if (near(R0.pot, 1.1)) return { kind: 'note', text: `<span class="key">F</span>Read Mama's note${L.meals ? ' · eat what she left' : ''}` };
      if (near(R0.mat, 1.0) || near(R0.chair, 1.0)) return { kind: 'wait', text: '<span class="key">F</span>Wait for night (dinner with Mama and Tobi, then they sleep)' };
      return null;
    }
    if (near(R0.door, 1.2)) {
      if (!L.suit && !L.bag) return { kind: 'none', text: 'Put on the black suit first, or pack it in your backpack (it\'s hidden in the <b>water drum</b>)' };
      const m = game.story.next();
      if (m && L.clock > 27 * 60) return { kind: 'out', story: false, text: `<span class="key">F</span>Go out and patrol <small style="opacity:.8">(too close to dawn for ${m.title}: go tomorrow night)</small>` };
      if (!m && game.story.upcoming()) return { kind: 'out', story: false, text: '<span class="key">F</span>Go out and patrol <small style="opacity:.8">(no lead yet: listen to the radio, N)</small>' };
      return m ? { kind: 'out', story: true, text: `<span class="key">F</span>Go out: <b>${m.title}</b> (story) &nbsp; <span class="key">G</span>Just patrol` } : { kind: 'out', story: false, text: '<span class="key">F</span>Go out into Surulere' };
    }
    if (near(R0.drum, 1.2)) return L.suit ? { kind: 'suit', text: '<span class="key">F</span>Take off the suit and hide it in the drum' } : { kind: 'suit', text: '<span class="key">F</span>Put on the black suit' };
    if (near(R0.pot, 1.1)) return L.meals ? { kind: 'eat', text: `<span class="key">F</span>Eat from Mama's pot of jollof (${L.meals} left)` } : { kind: 'none', text: 'The pot is empty. Mama will cook tomorrow.' };
    if (near(R0.chair, 1.0)) return { kind: 'rest', text: '<span class="key">F</span>Sit and rest a while (30 min)' };
    if (near(R0.radio, 0.8)) return { kind: 'radio', text: '<span class="key">F</span>Turn on the radio (quietly)' };
    if (near(R0.tobiSpot, 1.1)) return { kind: 'tobi', text: 'Tobi is fast asleep. Let him sleep.' };
    if (near(R0.mat, 1.0)) return { kind: 'sleep', text: `<span class="key">F</span>Sleep (end the night)${L.suit ? ' <small style="opacity:.8">(still in the suit!)</small>' : ''}` };
    if (near(R0.mamaSpot, 1.2)) return { kind: 'none', text: 'Mama is asleep. Tread softly.' };
    return null;
  }
  // taking an okada: the rider goes into the gutter shouting, and whoever saw it calls the police
  function stealOkada(v) {
    const yaw = v.yaw, x = v.pos.x, z = v.pos.z;
    traffic.remove(v);
    const c = new Civilian(scene, world, { x: x + Math.cos(yaw) * 1.4, z: z - Math.sin(yaw) * 1.4, yaw, outfit: { skin: '#4a2e1f', top: '#6d4c41', bottom: '#263238', sock: '#3e2723', sole: '#2b2b2b', cap: null, sheen: '#556070' } });
    c.name = 'Okada man'; c.mood = 'scared'; game.civilians.push(c);
    setTimeout(() => { if (!c.gone) c.runHome(c.pos.x + (Math.random() - 0.5) * 60, c.pos.z + 40); }, 2500);
    if (player.mode === 'board') player.mode = 'foot';
    player.pos.set(x, player.pos.y, z); player.mountBike(yaw);
    audio.punch(); camera.shake = 0.3;
    hud.say('Okada man', ['Ole! Ole! My okada!', 'Thief! Somebody hold am!', 'Na my daily bread you carry o!'][Math.floor(Math.random() * 3)], 3);
    if (policeSeeing()) addHeat(1, 'Police saw you take the okada.');
    else if (witnesses().length && Math.random() < 0.5) addHeat(1, 'Somebody is on the phone to the police.');
  }
  // ---------- the mall: walk in through the door, shop at the counters, walk out ----------
  game.inMall = false;
  const mallOpen = () => L.phase === 'day' && L.clock >= 9 * 60 && L.clock < 21 * 60;
  function enterMall(shop) {
    if (!mallOpen()) { hud.toast(`<b>${shop.name}</b> is closed. Open 9 AM to 9 PM.`, 'red'); return; }
    if (game.heat > 0) { hud.say('Security', 'Oga, police dey find you? Go back. You no dey enter here.', 3); return; }
    if (player.mode === 'board') player.mode = 'foot';
    game.mallFrom = { x: player.pos.x, z: player.pos.z, yaw: player.yaw + Math.PI, name: shop.name };
    const M = world.mall; game.inMall = true; M.light.visible = true; M.light.intensity = 9;
    player.respawn(M.spawn.x, M.spawn.z, M.spawn.yaw); player.pos.y = 0; camera.snapBehind(M.spawn.yaw);
    audio.grab(); hud.notice(shop.name.toUpperCase(), 'Cold AC hits you at the door.', 'white', 2.2);
    hud.say('Security', ['Welcome. No running inside o.', 'Bag check... ok, enter.', 'Small boy, you dey buy or you dey look?'][Math.floor(Math.random() * 3)], 2.6);
  }
  function leaveMall() {
    const f = game.mallFrom || { x: world.homeDoor.x, z: world.homeDoor.z, yaw: 0 };
    game.inMall = false; world.mall.light.visible = false;
    player.respawn(f.x, f.z, f.yaw); camera.snapBehind(f.yaw); hud.notice('OUTSIDE', f.name || '', 'white', 1.6);
  }
  world.mall.light.visible = false;
  function mallOption() {
    const M = world.mall;
    if (dist2(M.door, player.pos) < 2.6 * 2.6) return { kind: 'leaveMall', text: '<span class="key">F</span>Leave the mall' };
    const sh = M.shops.find(q => dist2(q, player.pos) < 2.4 * 2.4);
    if (sh) return { kind: 'mallshop', shop: sh, text: `<span class="key">F</span>Buy at <b>${sh.name}</b>` };
    return null;
  }
  function interactOption() {
    if (game.inMall) return mallOption();
    if (L.inside) return roomOption();
    if (!['foot', 'board'].includes(player.mode) || (player.mode === 'board' && !player.onGround)) return null;
    const busy = game.thugs.some(t => t.alive && (t.state === 'windup' || t.state === 'strike') && dist2(t.pos, player.pos) < 9);
    if (game.dropped && dist2(game.dropped.mesh.position, player.pos) < 2.4 * 2.4) return { kind: 'pickup', text: `<span class="key">F</span>Pick up ${game.dropped.item.label}` };
    if (game.carrying && game.delivery && dist2(game.delivery, player.pos) < 3.6 * 3.6) return { kind: 'deliver', text: `<span class="key">F</span>Give it back to ${game.delivery.name}` };
    if (busy) return null;
    // okadas: his own (where he left it), or somebody else's
    if (player.mode === 'foot' && !player.cuffed && player.nearBike()) return { kind: 'mount', text: '<span class="key">F</span>Get on the okada' };
    if (!player.cuffed && !player.bike) { const ok = traffic.vehicles.find(v => v.type === 'okada' && (v.kind === 'traffic' || v.kind === 'loop') && dist2(v.pos, player.pos) < 2.6 * 2.6 && (v.speed < 8 || player.mode === 'board')); if (ok) return { kind: 'steal', v: ok, text: '<span class="key">F</span>Pull the okada man off and take the bike' }; }
    const ds = game.story.dayStart(); if (ds && dist2(ds, player.pos) < 5 * 5) { const d = game.story.dayAvailable(); return { kind: 'dayMission', text: `<span class="key">F</span>Start: <b>${d.title}</b> (daytime mission)` }; }
    if (game.nepa && !game.nepa.cut && dist2(game.nepa.boss.pos, player.pos) < 2.6 * 2.6) return { kind: 'nepaBribe', text: `<span class="key">F</span>"Settle" the NEPA man to leave your light (₦1,000)` };
    const dopt = DAY.interactOption(); if (dopt) return dopt;
    const stop = TR.stopNear(player.pos);
    if (stop && !player.fightingNear) return { kind: 'bus', stop, text: `<span class="key">F</span>Take a ride from <b>${stop.name}</b> bus stop` };
    const cap = game.civilians.find(c => c.mood === 'captive' && dist2(c.pos, player.pos) < 2 * 2);
    if (cap) return { kind: 'free', civ: cap, text: `<span class="key">F</span>Untie ${cap.name || 'them'}` };
    for (const site of game.sites) {
      const cl = site.collector;
      if (!cl.hasBag || !cl.alive || game.carrying || dist2(cl.pos, player.pos) > 2.1 * 2.1) continue;
      const tx = player.pos.x - cl.pos.x, tz = player.pos.z - cl.pos.z, tl = Math.hypot(tx, tz) || 1;
      const unseen = (Math.sin(cl.yaw) * tx + Math.cos(cl.yaw) * tz) / tl < 0.1 || game.power < 0.5 || ['stagger', 'blinded', 'down'].includes(cl.state);
      if (unseen && ['idle', 'return', 'stagger', 'blinded', 'down'].includes(cl.state)) return { kind: 'snatch', site, text: '<span class="key">F</span>Snatch the levy bag' };
    }
    const pk = game.thugs.find(t => t.alive && t.item && ['idle', 'patrol', 'return'].includes(t.state) && dist2(t.pos, player.pos) < 1.8 * 1.8);
    if (pk) { const tx = player.pos.x - pk.pos.x, tz = player.pos.z - pk.pos.z, tl = Math.hypot(tx, tz) || 1; if ((Math.sin(pk.yaw) * tx + Math.cos(pk.yaw) * tz) / tl < 0.1) return { kind: 'pickpocket', t: pk, text: `<span class="key">F</span>Pick his pocket (${pk.item.label})` }; }
    if (player.cuffed && !game.arrest && L.items.pins > 0 && game.story.flags.canPick) return { kind: 'pickhint', text: `<span class="key">F</span>Hold to pick the cuffs (${L.items.pins} pin${L.items.pins > 1 ? 's' : ''}) · nobody watching` };
    const co = game.cuffOption(); if (co) return co;
    const shop = (world.shops || []).find(q => dist2(q, player.pos) < 4 * 4);
    if (shop && !player.cuffed) return { kind: 'shop', shop, text: mallOpen() ? `<span class="key">F</span>Go into <b>${shop.name}</b>` : `<b>${shop.name}</b> · closed (9 AM to 9 PM)` };
    const ro = game.police.option(); if (ro) return ro;
    const so = game.story.option?.(); if (so) return so;
    const ao = game.activities.option(); if (ao) return ao;
    if (dist2(world.homeDoor, player.pos) < 2.8 * 2.8) {
      if (L.watched()) return { kind: 'none', text: '<b>Someone is watching you.</b> Lose them before you go in.' };
      if (player.fightingNear) return { kind: 'none', text: '<b>Deal with the Red Caps first.</b> Don\'t fight at your own gate.' };
      if (player.boardLost) return { kind: 'none', text: 'Your board is still out there. Go and get it.' };
      if (player.cuffed) return { kind: 'none', text: 'You can\'t walk in on Mama in <b>handcuffs</b>. Get them cut at Baba Kolade\'s workshop.' };
      return { kind: 'home', text: L.phase === 'day' ? '<span class="key">F</span>Go inside (nobody is home)' : '<span class="key">F</span>Go inside quietly (Mama is asleep)' };
    }
    const v = world.vendors.find(q => dist2(q, player.pos) < 2.4 * 2.4);
    if (v) return { kind: 'food', v, text: `<span class="key">F</span>Buy ${v.food} · ₦${v.price.toLocaleString()} <small style="opacity:.7">(you have ₦${L.wallet.toLocaleString()})</small>` };
    const tf = world.transformers.find(t => dist2(t, player.pos) < 3 * 3);
    if (tf && game.power > 0.5 && tf.cool <= 0 && game.blackout.state === 'on') return { kind: 'fuse', tf, text: '<span class="key">F</span>Pull the transformer fuse (blackout)' };
    return null;
  }
  function doInteraction(opt) {
    switch (opt.kind) {
      case 'pickup': { const it = game.dropped.item; scene.remove(game.dropped.mesh); game.dropped = null; startCarry(it); return true; }
      case 'deliver': deliver(); return true;
      case 'mount': player.mountBike(player.bike.yaw); return true;
      case 'steal': stealOkada(opt.v); return true;
      case 'free': { const c = opt.civ; c.mood = 'idle'; game.stats.saved++; game.logNight('freed', { name: c.name }); game.addRespect(150, 'FREED ' + (c.name || '').toUpperCase()); audio.grab(); hud.say(c.name || 'Captive', ['God bless you!', 'Thank you! Thank you!', 'Who are you?!'][Math.floor(R() * 3)], 2.5); game.story.onFreed(c); setTimeout(() => { if (!c.gone) c.runHome(c.pos.x + (R() - 0.5) * 60, c.pos.z + 40); }, 1200); return true; }
      case 'snatch': { const site = opt.site, stealth = ['idle', 'return'].includes(site.collector.state); site.collector.takeBag(); audio.snatch(); startCarry({ label: 'the levy bag', amount: site.amount, site }); site.alarmT = stealth ? 2.6 : 0.2; game.addRespect(stealth ? 150 : 60, stealth ? 'SILENT SNATCH' : 'SNATCH'); return true; }
      case 'home': game.enterHome(); return true;
      case 'shop': enterMall(opt.shop); return true;
      case 'mallshop': hud.say(opt.shop.seller, opt.shop.line, 3); game.onShop?.(opt.shop); return true;
      case 'leaveMall': leaveMall(); return true;
      case 'nepaBribe': {
        if (L.wallet < 1000) { hud.say('NEPA man', 'Wetin you hold? Comot here, small boy.', 3); return true; }
        L.wallet -= 1000; audio.pickup(); hud.say('NEPA man', ['Ehen! I no see this street today.', 'You get sense. Oya, we dey go.', 'Tell your people make una pay bill o.'][Math.floor(R() * 3)], 3.5);
        game.nepa.cut = true; game.nepa.t = 31; hud.toast('The crew packs up. <b>The light stays on</b>, for now.', 'green'); return true;
      }
      case 'pickhint': return true;
      case 'uncuff': if (!game.story.flags.canPick) { game.story.flags.canPick = true; setTimeout(() => hud.toast('Baba Kolade showed you how: <b>a bent hair pin and two minutes of patience.</b> Buy pins at a mall, and next time you can <b>pick the cuffs yourself</b> (hold F where no police can see you).', 'blue'), 2500); }
        player.cuffed = false; audio.clank?.(player.pos); hud.notice('CUFFS OFF', 'Baba Kolade: "I did not see you. I did not see these. Go home."', 'green'); game.addRespect(200, 'ESCAPED CUSTODY'); return true;
      case 'roger': { game.logNight('roger'); const amt = game.police.take(opt.cp); audio.snatch(); startCarry(rogerItem(amt)); game.addRespect(200, 'ROGER SNATCHED'); game.say(opt.o, 'Thief! Na the boy in black! Catch am!', 'Police', 60); addHeat(1, 'The police want their roger back.'); return true; }
      case 'story': return game.story.doOption(opt);
      case 'activity': return game.activities.doOption(opt);
      case 'food': { const v = opt.v; if (L.wallet < v.price) { hud.toast(`Not enough money for ${v.food}. People you help sometimes give you something "for food".`, 'red'); return true; } L.wallet -= v.price; L.eat(v.fill, v.food.toUpperCase()); hud.say(v.label === 'SUYA' ? 'Mallam' : 'Mama', ['Enjoy, my son.', 'You look tired o. Eat well.', 'Extra pepper for you.'][Math.floor(R() * 3)], 2); return true; }
      case 'fuse': opt.tf.cool = 120; startBlackout(38, true); return true;
      // at home
      case 'out': game.leaveHome(opt.story); return true;
      case 'bag': L.bag = !L.bag; updateBackpack(); audio.grab(); hud.popup(L.bag ? 'SUIT PACKED' : 'SUIT IN THE DRUM'); return true;
      case 'suit': L.suit = !L.suit; player.setOutfit(L.suit ? OUTFITS.bolaji : OUTFITS.bolajiDay); reattachBag(); audio.grab(); hud.popup(L.suit ? 'SUITED UP' : 'SUIT HIDDEN'); return true;
      case 'eat': L.meals--; L.eat(45, "MAMA'S JOLLOF"); return true;
      case 'rest': L.clock += 30; L.energy = Math.min(100, L.energy + 22); player.hp = Math.min(player.cap(), player.hp + 12); hud.notice(L.timeStr(), 'You sit in the dark and let your body settle.', 'white', 1.8); return true;
      case 'radio': game.radio.listen(); return true;
      case 'pickpocket': { const t = opt.t, it = t.item; t.item = null; t.takeBag?.(); audio.snatch(); startCarry(it); game.addRespect(150, 'PICKPOCKETED'); setTimeout(() => { if (t.alive && dist2(t.pos, player.pos) < 9 * 9) { game.say(t, 'Where the money?! Na this boy!', 'Red Cap', 30); t.calm = false; t.engage(0); for (const o of t.group || []) { o.calm = false; } } else game.say(t, 'Who take the money?!', 'Red Cap', 40); }, 2500); return true; }
      case 'dayMission': game.story.beginDay(); return true;
      case 'tobi': {
        if (game.story.unlocked <= game.story.index && game.story.upcoming()) game.story.unlocked = game.story.index + 1;
        const m = game.story.next();
        const lines = m ? [m.intro] : ['Tobi (half asleep): "Bro... everybody is talking about the boy in black. Is it you?" You tell him to go back to sleep.', 'Tobi: "The Red Caps are asking questions in the market. Be careful."'];
        hud.say('Tobi', lines[Math.floor(R() * lines.length)], 7); return true;
      }
      case 'sleep': game.sleep(); return true;
      case 'note': { const e = DAY.errand; hud.say("Mama's note", e ? `"${e.text}. ${e.money ? `I left ₦${e.money.toLocaleString()} on the table.` : ''} Don't go and play football all day. — Mama"` : '"Stay out of trouble. — Mama"', 7); if (L.meals) { L.meals--; L.eat(30, 'LEFTOVER RICE'); } return true; }
      case 'wait': game.toNight(); return true;
      case 'paper': case 'errand': return DAY.doInteraction(opt);
      case 'bus': game.onRideMenu?.(opt.stop); return true;
    }
    return false;
  }
  // ---------- the backpack: change anywhere nobody can see you ----------
  let backpack = null;
  function updateBackpack() {
    if (!backpack) { backpack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.9 })); backpack.position.set(0, 0.0, -0.17); }
    backpack.parent?.remove(backpack);
    if (L.bag && !L.suit) player.rig.b.chest.add(backpack); // the suit is on him, so the bag hangs empty out of sight
  }
  function witnesses() { // anyone within 16 m with a clear line of sight
    const P = player.pos, see = (q) => q && !q.gone && !q.removed && dist2(q.pos, P) < 16 * 16 && !col.blocked(q.pos.x, q.pos.y + 1.5, q.pos.z, P.x, P.y + 1.2, P.z, 1.2);
    let n = game.civilians.filter(see).length + game.thugs.filter(t => t.alive && see(t)).length + game.gunmen.filter(g => g.alive && see(g)).length;
    for (const c of game.crowdPeople?.() || []) if (dist2(c, P) < 14 * 14 && !col.blocked(c.x, 1.5, c.z, P.x, P.y + 1.2, P.z, 1.2)) n++;
    return n;
  }
  function changeClothes() {
    if (L.inside || !(L.bag || L.suit) || !['foot'].includes(player.mode) || player.cuffed) { if (!L.inside && !L.bag && !L.suit) hud.popup('NO SUIT WITH YOU'); return; }
    const n = witnesses();
    if (L.suit) { L.suit = false; L.bag = true; player.setOutfit(OUTFITS.bolajiDay); } else { L.suit = true; player.setOutfit(OUTFITS.bolaji); }
    reattachBag(); updateBackpack(); audio.grab(); fx.dust(player.pos.x, player.pos.y + 0.1, player.pos.z, 6);
    if (n > 0) {
      // somebody saw Bolaji from Aguda turn into the boy in black (or back)
      game.exposure = 0; L.suspicion = Math.min(100, L.suspicion + 12); game.recognisedAt = game.time;
      hud.banner('SEEN CHANGING', `${n === 1 ? 'Somebody' : n + ' people'} saw you change. Your face and the boy in black, in the same moment.`, 'red', 3.5);
      addHeat(1, 'Somebody is on the phone to the police.');
    } else hud.popup(L.suit ? 'SUITED UP · NOBODY SAW' : 'CHANGED BACK · NOBODY SAW');
  }
  game.changeClothes = changeClothes;
  // ---------- shopping, the torch, picking cuffs ----------
  game.shopItems = () => [
    { id: 'torch', name: 'Torchlight', desc: 'L to switch on and off. Lights the dark streets, but makes you easier to spot.', price: 1500, owned: L.items.torch },
    { id: 'pins', name: 'Hair pins (×3)', desc: L.items.pins ? `You have ${L.items.pins}.` : 'For picking handcuffs, once someone shows you how.', price: 500 },
    { id: 'meds', name: 'Plaster & paracetamol', desc: 'Patches you up: heals some injury and health.', price: 800 },
    { id: 'drink', name: 'Energy drink', desc: '+35 energy.', price: 400 },
    { id: 'jollof', name: 'Jollof rice & chicken', desc: 'A proper plate. Fills you up.', price: 1500 },
    { id: 'chops', name: 'Small chops', desc: 'Puff-puff, samosa, spring roll.', price: 700 },
  ];
  game.buy = (id) => {
    const it = game.shopItems().find(q => q.id === id); if (!it || it.owned) return 'owned';
    if (L.wallet < it.price) return 'broke';
    L.wallet -= it.price; audio.pickup();
    if (id === 'torch') { L.items.torch = true; hud.toast('Got a <b>torchlight</b>. Press <span class="key">L</span> to switch it on.', 'green'); }
    if (id === 'pins') L.items.pins += 3;
    if (id === 'meds') { player.injury = Math.max(0, player.injury - 18); player.hp = Math.min(player.cap(), player.hp + 30); }
    if (id === 'drink') L.energy = Math.min(100, L.energy + 35);
    if (id === 'jollof') L.eat(50, 'Jollof & chicken');
    if (id === 'chops') L.eat(22, 'Small chops');
    game.save(); return 'ok';
  };
  let torch = null; game.torchOn = false;
  function toggleTorch() {
    if (!L.items.torch) { hud.popup('NO TORCHLIGHT · BUY ONE AT A MALL'); return; }
    if (!torch) { torch = new THREE.SpotLight(0xfff2d6, 0, 34, 0.42, 0.45, 1.4); const tgt = new THREE.Object3D(); tgt.position.set(0, 0.2, 8); torch.position.set(0.15, 1.35, 0.25); torch.target = tgt; player.rig.root.add(torch, tgt); }
    game.torchOn = !game.torchOn; torch.intensity = game.torchOn ? 38 : 0; audio.tick?.();
  }
  let pickT = 0;
  function updatePick(dt, input) {
    if (!player.cuffed || game.arrest || !L.items.pins || !game.story.flags.canPick || !input.held.act) { if (pickT > 0 && !input.held.act) pickT = 0; return; }
    const watched = traffic.police().some(v => v.police.sees) || game.gunmen.some(g => g.alive && g.role === 'police' && dist2(g.pos, player.pos) < 25 * 25 && !col.blocked(g.pos.x, g.pos.y + 1.5, g.pos.z, player.pos.x, player.pos.y + 1.2, player.pos.z, 1.2));
    if (watched) { if (pickT > 0.3) hud.popup('THEY CAN SEE YOU · GET OUT OF SIGHT FIRST'); pickT = 0; return; }
    pickT += dt; game.hudMeter = pickT / 3.5; game.catchLabel = 'PICKING THE CUFFS · KEEP HOLDING F';
    if (pickT >= 3.5) { pickT = 0; player.cuffed = false; L.items.pins--; game.hudMeter = null; game.catchLabel = null; audio.clank?.(player.pos); hud.notice('CUFFS OFF', 'Click. You pocket the cuffs. They might be useful.', 'green'); game.addRespect(250, 'PICKED THE CUFFS'); }
  }
  let dayAttT = 0, dayToldT = -999;
  function updateDaySuit(dt) { // the boy in black in broad daylight draws a crowd and the police
    if (!(L.suit && !L.inside && L.daylight() > 0.5)) { dayAttT = 0; return; }
    dayAttT += dt;
    if (game.time - dayToldT > 120) { dayToldT = game.time; hud.notice('BROAD DAYLIGHT', 'People are stopping to point their phones at the boy in black.', 'red'); game.radio?.say('Una see am? The boy in black, for afternoon! Na film o. Police dey come.'); }
    if (dayAttT > 12 && game.heat === 0) { dayAttT = 0; addHeat(1, 'A crowd is following you, and somebody called the police.'); }
  }
  function reattachBag() { bagOnHip.parent?.remove(bagOnHip); player.rig.b.hips.add(bagOnHip); }
  game.inRoom = () => L.inside;
  // pause menu: jump straight into any story mission (night, suited up, outside the gate)
  game.jumpToMission = (i) => {
    if (L.phase === 'day') { L.toNight(); nightStart(game); setOccupants(true); }
    loseItem(); player.dropHeld(); for (const t of game.thugs) if (t.state === 'tail') t.remove();
    L.inside = false; L.suit = true; player.setOutfit(OUTFITS.bolaji); reattachBag();
    player.hp = player.cap(); player.mode = 'foot';
    player.respawn(world.home.x, world.home.z, world.home.yaw); camera.snapBehind(world.home.yaw);
    env.setDaylight(L.daylight()); applyLights(true);
    game.story.jump(i);
  };
  player.inRoom = () => L.inside;
  function setOccupants(home) { R0.mama.root.visible = home; R0.tobi.root.visible = home; }
  game.startDay = () => {
    player.cuffed = false; game.arrest = null; game.catchLabel = null;
    L.inside = true; L.suit = false; L.bag = false; player.setOutfit(OUTFITS.bolajiDay); reattachBag(); updateBackpack(); setOccupants(false);
    player.respawn(R0.spawn.x, R0.spawn.z, R0.spawn.yaw); player.pos.y = 0; camera.snapBehind(R0.spawn.yaw);
    const e = DAY.newErrand();
    hud.notice(L.timeStr(), `Day ${L.night} · Mama is at the market, Tobi is at school`, 'white', 3);
    if (game.story.morning) setTimeout(() => game.story.playMorning(), 900);
    setTimeout(() => hud.toast(`<b>Mama's note:</b> ${e.text}.${e.money ? ` (She left ₦${e.money.toLocaleString()}.)` : ''} Then explore, and listen for news.`, 'blue'), 1500);
    applyLights(true);
  };
  game.toNight = () => {
    if (DAY.errand?.step === 'return') DAY.errandHome();
    L.toNight(); nightStart(game); player.nineLives = 1; setOccupants(true); game.save();
    player.respawn(R0.spawn.x, R0.spawn.z, R0.spawn.yaw); player.pos.y = 0; camera.snapBehind(R0.spawn.yaw);
    hud.notice(L.timeStr(), 'Dinner is done. Mama and Tobi are asleep. The suit is in the drum.', 'white', 3.5);
    applyLights(true);
  };
  game.startNight = () => game.toNight();
  let lightsDay = null;
  function applyLights(force) {
    const day = L.phase === 'day' && L.daylight() > 0.5;
    if (!force && day === lightsDay) return;
    lightsDay = day;
    if (day) { world.setPower(0, 0); env.setPower(1); } else { world.setPower(game.power, 1); env.setPower(game.power); }
  }
  game.enterHome = () => {
    if (game.carrying && !game.carrying.site && !game.carrying.keep) { hud.toast('Return what you\'re carrying first.', 'red'); return; }
    loseItem();
    game.story.onEnterHome();
    game.story.update(0);
    for (const t of game.thugs) if (t.state === 'tail') t.remove();
    player.dropHeld();
    L.inside = true;
    player.respawn(R0.door.x, R0.door.z - 0.5, Math.PI); player.pos.y = 0; camera.snapBehind(Math.PI);
    if (L.phase === 'day') { DAY.errandHome(); hud.notice('HOME', 'Nobody home. Mama is at the market.', 'white', 1.8); }
    else hud.notice('HOME', 'Quietly now. Mama is asleep.', 'white', 1.8);
    game.save();
    game.onEnterHome?.();
  };
  game.leaveHome = (storyMission) => {
    L.inside = false;
    player.respawn(world.home.x, world.home.z, world.home.yaw); camera.snapBehind(world.home.yaw);
    reattachBag();
    env.setDaylight(L.daylight()); applyLights(true);
    if (storyMission && game.story.next()) game.story.begin();
    else hud.notice(L.timeStr(), `${L.phase === 'day' ? 'Day' : 'Night'} ${L.night} · Surulere`, 'white', 2.2);
  };
  game.sleep = () => {
    game.sleptInSuit = L.suit;
    if (L.suit) { L.suspicion = Math.min(100, L.suspicion + 30); hud.toast('You fell asleep in the suit. <b>Mama saw the black hoodie in the morning.</b>', 'red'); }
    game.onSleep?.();
  };
  game.onDawn = () => {
    if (game.mode === 'patrol') { // free roam: dawn just becomes the next day
      L.caught = false; L.phase = 'day'; L.clock = 5.5 * 60; L.night++; L.eveningWarned = true; L.lateHome = true;
      hud.notice('5:30 AM', `Day ${L.night}. The sky goes grey and Lagos wakes up.`, 'white'); applyLights(true); game.save(); return;
    }
    if (L.inside) return;
    hud.notice('5:30 AM', 'Mama is up for the market... and your mat is empty.', 'red', 4);
    L.energy = Math.max(0, L.energy - 30); L.suspicion = Math.min(100, L.suspicion + 25);
    setTimeout(() => { if (!L.inside) { game.enterHome(); game.sleep(); } }, 3000);
  };
  // noise inside: running around the room can wake Mama
  let mamaAwakeT = 0;
  function updateRoom(dt) {
    R0.flicker(game.time);
    R0.light.intensity *= L.inside ? 1 : 0;
    env.setIndoor(L.inside);
    if (!L.inside) return;
    const spd = Math.hypot(player.vel.x, player.vel.z);
    L.noise = Math.max(0, L.noise + (spd > 4.5 || player.mode === 'act' || !player.onGround ? dt * 0.7 : -dt * 0.35));
    if (L.noise >= 1 && mamaAwakeT <= 0) {
      L.noise = 0; mamaAwakeT = 4; L.suspicion = Math.min(100, L.suspicion + (L.suit ? 35 : 12));
      hud.say('Mama', L.suit ? 'Bolaji?! What is that black thing you are wearing?! ...hmm. Go and sleep.' : 'Bolaji? Why are you walking up and down this night? Lie down!', 4);
      audio.alert();
    }
    if (mamaAwakeT > 0) { mamaAwakeT -= dt; R0.wake(1); if (mamaAwakeT <= 0) R0.sleep(); }
  }

  // ---------- blackout ----------
  function startBlackout(dur, fuse = false) {
    const b = game.blackout;
    if (b.state !== 'on') return;
    b.state = 'flickerOff'; b.t = 0; b.dur = dur; game.stats.blackouts++;
    if (fuse) hud.toast('You yanked the fuse. <b>The whole street goes dark.</b>', 'blue');
  }
  // ---------- NEPA: a PHCN crew pulls up at a transformer and cuts the light ----------
  // One man up the ladder, one watching from the pickup. At night the street goes dark when he's done.
  // You can "settle" the one on the ground, or just watch Lagos happen.
  const NEPA_FIT = { skin: '#4a2e1f', top: '#fdd835', bottom: '#1a237e', sock: '#3e2723', sole: '#2b2b2b', cap: '#1a237e', sheen: '#556070' };
  game.nepa = null; game.nepaNext = 90 + R() * 60;
  function startNepa(tf) {
    const px = tf.x - 0.8, pz = tf.z - 0.9, parts: any[] = [];
    const truck = new THREE.Group(), m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 4.6), m('#f5f5f5')); body.position.y = 0.95; truck.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.9), m('#f5f5f5')); cab.position.set(0, 1.85, 0.9); truck.add(cab);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 4.62), m('#1565c0')); stripe.position.y = 1.0; truck.add(stripe);
    for (const [wx, wz] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12), m('#111')); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); truck.add(w); }
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.45), new THREE.MeshBasicMaterial({ map: textSign('PHCN · NEPA', '#1565c0', '#ffeb3b', 512, 90) }));
    sg.position.set(0.97, 1.35, -0.6); sg.rotation.y = Math.PI / 2; truck.add(sg);
    const sg2 = sg.clone(); sg2.position.x = -0.97; sg2.rotation.y = -Math.PI / 2; truck.add(sg2);
    truck.position.set(px - 1.5, 0.15, pz - 5.6); truck.rotation.y = Math.PI / 2; scene.add(truck); parts.push(truck);
    // the ladder against the pole, and the man at the top of it
    const lad = new THREE.Group();
    for (const dx of [-0.25, 0.25]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.6, 0.06), m('#b0bec5')); r.position.set(dx, 2.3, 0); lad.add(r); }
    for (let k = 0; k < 11; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.05), m('#b0bec5')); r.position.set(0, 0.3 + k * 0.4, 0); lad.add(r); }
    lad.position.set(px, 0.15, pz - 0.9); lad.rotation.x = 0.2; scene.add(lad); parts.push(lad);
    const up = new Rig(NEPA_FIT); up.root.position.set(px, 2.9, pz - 0.6); up.root.rotation.y = 0; scene.add(up.root); parts.push(up.root);
    const boss = new Civilian(scene, world, { x: px - 2.2, z: pz - 2.6, yaw: 0.6, outfit: { ...NEPA_FIT, top: '#1565c0' } });
    boss.name = 'NEPA man'; boss.mood = 'idle'; game.civilians.push(boss);
    game.nepa = { tf, x: px, z: pz, t: 0, parts, up, boss, told: false, cut: false, area: world.areaAt(px, pz) };
    if (Math.hypot(px - player.pos.x, pz - player.pos.z) < 160) hud.toast(`<b>NEPA</b> pickup at ${game.nepa.area}. Somebody is about to lose light.`, 'blue');
  }
  function endNepa() { const n = game.nepa; if (!n) return; for (const o of n.parts) scene.remove(o); n.boss.remove(scene); game.nepa = null; game.nepaNext = 150 + R() * 120; }
  function updateNepa(dt) {
    const n = game.nepa;
    if (!n) {
      game.nepaNext -= dt;
      if (game.nepaNext <= 0 && !L.inside && !game.inMall && game.power > 0.5 && game.blackout.state === 'on') {
        const tf = world.transformers.map(t => ({ t, d: Math.hypot(t.x - player.pos.x, t.z - player.pos.z) })).filter(q => q.d > 35 && q.d < 150).sort((a, b) => a.d - b.d)[0];
        if (tf) startNepa(tf.t); else game.nepaNext = 30;
      }
      return;
    }
    n.t += dt; Pose.climb(n.up, n.t * 2); n.up.update(dt, 10);
    const d = Math.hypot(n.x - player.pos.x, n.z - player.pos.z);
    if (!n.told && d < 40) { n.told = true; hud.say('Woman', ['NEPA! Una don come again?! We pay last month!', 'Ah! No cut am o! My freezer full!', 'Oga NEPA, abeg, my pikin dey write exam tomorrow!'][Math.floor(R() * 3)], 3.5); setTimeout(() => game.nepa && hud.say('NEPA man', ['Una street never pay. Na order from above.', 'Settle me, make I go another street.', 'Na estimated billing. No be my problem.'][Math.floor(R() * 3)], 3.5), 3800); }
    if (!n.cut && Math.random() < dt * 3) fx.burst(n.x, CURB_Y + 4.3, n.z - 0.2, 0xfff2a0, 3, 2);
    if (!n.cut && n.t > 20) {
      n.cut = true; fx.burst(n.x, CURB_Y + 4.3, n.z, 0xfff2a0, 26, 5); audio.glass?.(); camera.shake = Math.max(camera.shake, d < 40 ? 0.2 : 0);
      if (L.phase !== 'day' || L.daylight() < 0.5) startBlackout(55 + R() * 35);
      else hud.notice('NEPA CUT THE LIGHT', `${n.area}: generators start coughing all over the street.`, 'white', 3);
      game.blackout.next = Math.max(game.blackout.next, 200);
    }
    if (n.t > 30 && d > 25) endNepa();
  }
  const CURB_Y = 0.15;
  function updateBlackout(dt) {
    const b = game.blackout;
    b.t += dt;
    let p = game.power;
    if (b.state === 'on') { p = 1; b.next -= dt; if (b.next <= 0) { const near = !game.nepa && world.transformers.some(t => { const d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z); return d > 35 && d < 150; }); if (near) { game.nepaNext = 0; b.next = 60; } else if (game.nepa) b.next = 30; else startBlackout(28 + R() * 14); } }
    else if (b.state === 'flickerOff') {
      p = b.t < 1.3 ? (Math.sin(b.t * 37) > 0.2 ? 1 : 0.15) * (1 - b.t / 1.6) : 0;
      if (b.t > 1.4) { b.state = 'off'; b.t = 0; audio.powerDown(); hud.notice('NEPA DON TAKE LIGHT!', 'The grid is down. Harder for anyone to see you. Generators start coughing.', 'white', 3); }
    } else if (b.state === 'off') { p = 0; if (b.t > b.dur) { b.state = 'flickerOn'; b.t = 0; } }
    else if (b.state === 'flickerOn') {
      p = b.t < 0.8 ? (Math.sin(b.t * 29) > 0.4 ? 0.7 : 0) : 1;
      if (b.t > 0.9) { b.state = 'on'; b.t = 0; b.next = 80 + R() * 60; audio.powerUp(); hud.notice('UP NEPA!', 'The whole street shouts as the light comes back.', 'green', 2.2); }
    }
    if (p !== game.power) { game.power = p; world.setPower(p, 1); env.setPower(p); }
    for (const t of world.transformers) t.cool -= dt;
  }

  // ---------- police ----------
  let visT = 0;
  const onFoot = () => ['foot', 'climb', 'wallrun', 'roll', 'down', 'act'].includes(player.mode);
  function updatePolice(dt) {
    game.policeRange = (game.power > 0.5 ? 58 : 22) * (player.pos.y > 4 ? 0.6 : 1) * (player.prone ? 0.35 : 1) * (game.torchOn ? 1.35 : 1); // flat on the board: hard to spot; a torch: easy
    visT -= dt; game.assaultCd -= dt;
    const pol = traffic.police();
    if (visT <= 0) {
      visT = 0.2;
      for (const v of pol) {
        const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
        v.police.sees = player.mode !== 'down' && !L.inside && d < game.policeRange && !col.blocked(v.pos.x, v.pos.y + 1.6, v.pos.z, player.pos.x, player.pos.y + 1.2, player.pos.z, 1.2);
        if (v.police.sees) v.police.target.copy(player.pos);
      }
    }
    const offSee = game.gunmen.some(o => o.alive && o.role === 'police' && Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) < game.policeRange * 0.7 && !col.blocked(o.pos.x, o.pos.y + 1.5, o.pos.z, player.pos.x, player.pos.y + 1.2, player.pos.z, 1.2));
    const seen = pol.some(v => v.police.sees) || offSee;
    if (seen && game.heat === 0 && game.carrying?.site) addHeat(1, 'Police spotted you with the levy bag. (The agberos pay them their cut.)');
    game.grudgeCd = (game.grudgeCd || 0) - dt;
    if (seen && game.heat === 0 && L.suit && L.phase !== 'day' && game.story.progress() >= 2 && !game.story.active && game.grudgeCd <= 0) { game.grudgeCd = 90; addHeat(1, 'Police: "Na the boy in black! Oga Okafor say make we carry am!"'); }
    if (game.heat >= 2) game.wasHot = true;
    if (game.heat === 0 && game.wasHot) { // he shook off a serious chase: the man paying the police is losing patience
      game.wasHot = false; const F = game.story.flags; F.policeFails = (F.policeFails || 0) + 1;
      if (F.policeFails === 3) hud.banner('THE PATRON', 'His police keep failing. He is done using police.', 'red', 3.5);
      else hud.notice('SOMEWHERE, A PHONE RINGS', `Somebody important just heard the police lost you again (${F.policeFails}).`, 'blue');
    }
    if (game.heat > 0) {
      if (seen) { game.heatTimer = 0; game.seenTime += dt; if (game.seenTime > 16 && game.heat < 3) { game.seenTime = 0; addHeat(1, 'More units joining the chase!'); } }
      else { game.heatTimer += dt; game.seenTime = Math.max(0, game.seenTime - dt); if (game.heatTimer > (player.cuffed ? 16 : 10)) { game.heatTimer = 0; game.heat--; hud.toast(game.heat ? 'They\'re losing you…' : '<b>You lost the police.</b>', game.heat ? 'blue' : 'green'); } }
    }
    for (const v of pol) { if (v.police.mode === 'transport') continue; const chasing = game.heat > 0; v.police.mode = chasing ? 'chase' : 'patrol'; v.police.siren = chasing; }
    for (const v of pol) {
      const P = v.police, d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
      if (!P.crew && game.heat > 0 && d < 26 && (onFoot() || player.pos.y > 2.5 || v.speed < 2) && player.mode !== 'down') {
        P.parked = true; P.crew = [];
        for (const side of [-1, 1]) { const g = new Gunman(scene, world, { x: v.pos.x + v.rt.x * side * 1.6, z: v.pos.z + v.rt.z * side * 1.6, y: v.pos.y, yaw: v.yaw, role: 'police', car: v }); P.crew.push(g); game.gunmen.push(g); }
        game.say(P.crew[0], ['Get out! Catch am!', 'Oya come down from there!', 'You no fit run!'][Math.floor(R() * 3)], 'Police');
      }
      if (P.crew && P.crew.every(g => g.removed)) { P.crew = null; P.parked = false; }
    }
    game.policeAlertT = Math.max(0, (game.policeAlertT || 0) - dt);
    const want = game.heat === 0 ? (game.policeAlertT > 0 ? 3 : 1) : Math.min(player.cuffed ? 5 : 4, game.heat + (player.cuffed ? 2 : 1)); // an escaped prisoner: every unit out // an alert (a crashed levy car...) puts more cars on the street
    game.spawnCd -= dt;
    if (pol.length < want && game.spawnCd <= 0) { const v = traffic.spawnPolice(player.pos.x, player.pos.z); v.police.target.copy(player.pos); game.spawnCd = 5; }
    if (pol.length > want) for (const v of pol) { if (v.police.mode === 'transport') continue; if (!v.police.crew && !v.police.sees && Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) > 95) { traffic.remove(v); break; } }
    let grabbing = false;
    const ps = Math.hypot(player.vel.x, player.vel.z);
    if (!game.arrest && game.heat > 0 && player.mode !== 'skitch' && player.mode !== 'down' && ps < 4.8 && player.pos.y < 1.3) for (const v of pol) if (Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) < 4 && v.speed < 6) { grabbing = true; break; }
    if (game.officerGrab) grabbing = true;
    game.officerGrab = false;
    game.catchMeter = Math.max(0, game.catchMeter + (grabbing ? dt * 0.85 : -dt * 0.7));
    if (grabbing && R() < dt * 0.8) hud.say('Police', ['Oya stop there!', 'Where you dey run go?', 'Hold am! Hold am!'][Math.floor(R() * 3)], 1.6);
    if (game.catchMeter >= 1) { game.catchMeter = 0; busted(); }
  }
  function busted() { arrest(); }
  // ---------- arrested: cuffed in the back of a police car on the way to the station ----------
  // Mash F / Space to kick the door out; the healthier he is, the harder he kicks. Break out and he runs
  // in handcuffs (no fighting, no board, no climbing) with every unit in Surulere after him, until Baba
  // Kolade cuts the cuffs. Fail, and it's a night in the cell.
  game.arrest = null;
  function arrest() {
    if (game.arrest || game.respawnT > 0) return;
    game.stats.busted++; audio.busted();
    player.dropHeld(); loseItem();
    let car = traffic.police().filter(v => !v.police.crew?.length || true).sort((a, b) => dist2(a.pos, player.pos) - dist2(b.pos, player.pos))[0];
    if (!car || dist2(car.pos, player.pos) > 60 * 60) car = traffic.spawnPolice(player.pos.x, player.pos.z);
    for (const g of car.police.crew || []) g.remove(); car.police.crew = null; car.police.parked = false;
    // the station: the far corner of the district
    const corners: any[] = [[0, 0], [N, 0], [0, N], [N, N]].map(([i, j]) => ({ x: roadLine(i), z: roadLine(j) }));
    const dest = corners.sort((a, b) => dist2(b, player.pos) - dist2(a, player.pos))[0];
    car.police.mode = 'transport'; car.police.dest = dest; car.police.route = []; car.police.siren = true;
    player.mode = 'foot'; player.getupT = 0; player.critical = false; player.hp = Math.max(player.hp, 25); player.adren = 0;
    player.startRide(car, false);
    L.wallet = 0;
    game.arrest = { car, t: 0, struggle: 0, second: !!player.cuffed };
    for (const g of game.gunmen) if (g.alive && g.role === 'police' && !g.post) { g.state = 'return'; g.t = 0; }
    for (const t of game.thugs) if (t.alive && t.engaged) t.state = 'return'; // the fight is over
    hud.banner('ARRESTED', player.cuffed ? 'Caught again. They tightened the cuffs. Kick harder.' : 'Cuffed in the back of a police car. <b>Mash F / Space to kick the door out.</b>', 'red', 3.5);
    game.say(null, ['Oya siddon there! Station!', 'You think say you fit run? Station!', 'Okafor go like this one.'][Math.floor(R() * 3)], 'Police');
  }
  function updateArrest(dt, input) {
    const A = game.arrest; if (!A) return;
    const v = A.car;
    A.t += dt;
    const window = v.speed < 4; // the car slows at a junction: that's when a kick really counts
    if (input.pressed.act || input.pressed.jump) { A.struggle += (A.second ? 0.045 : 0.06) * (0.7 + 0.5 * player.hp / Math.max(1, player.cap())) * (window ? 2 : 1); camera.shake = 0.25; audio.clank?.(v.pos); }
    A.struggle = Math.max(0, A.struggle - dt * 0.1);
    game.hudMeter = A.struggle; game.catchMeter = 0; game.catchLabel = window ? 'THE CAR IS SLOWING · KICK NOW!' : `KICK THE DOOR: MASH F / SPACE · ${Math.max(0, Math.ceil(50 - A.t))}s TO THE STATION`;
    if (A.struggle >= 1) {
      // the door gives: out onto the road, still in cuffs
      const side = R() < 0.5 ? 1 : -1;
      player.endRide(v.pos.x + v.rt.x * side * 2.2, v.pos.z + v.rt.z * side * 2.2);
      player.cuffed = true; player.invuln = 1.5; game.catchMeter = 0; game.hudMeter = null; game.catchLabel = null;
      v.police.mode = 'chase'; v.police.parked = true; v.police.target.copy(player.pos);
      game.arrest = null; game.cuffT = 0;
      game.heat = 3; game.heatTimer = 0; audio.alert(); camera.shake = 0.8;
      hud.banner('YOU\'RE OUT', 'Still in handcuffs. No fighting, no board, no climbing. <b>Lose them, then get to Baba Kolade\'s workshop.</b>', 'red', 4);
      game.say(null, 'E don escape! Block the road! Block am!', 'Police');
      return;
    }
    if (A.t > 50) { game.arrest = null; game.catchMeter = 0; game.hudMeter = null; game.catchLabel = null; player.endRide(v.pos.x, v.pos.z); player.cuffed = false; v.police.mode = 'patrol'; game.heat = 0; jailed(); }
  }
  function jailed() {
    game.respawnT = 999;
    for (const t of game.thugs) if (t.state === 'tail') t.remove();
    L.suspicion = Math.min(100, L.suspicion + 30);
    setTimeout(() => { game.respawnT = 0; player.mode = 'foot'; L.inside = true; player.respawn(R0.mat.x, R0.mat.z, 0); player.pos.y = 0; game.onJailed?.(); }, 300);
  }
  // Kolade (or any mechanic with bolt cutters) takes the cuffs off
  game.cuffOption = () => {
    if (!player.cuffed) return null;
    const k = DAY.pois.kolade; if (!k || dist2(k, player.pos) > 4.5 * 4.5) return null;
    if (game.heat > 0) return { kind: 'none', text: 'Baba Kolade won\'t open the gate with sirens on the street. <b>Lose the police first.</b>' };
    return { kind: 'uncuff', text: '<span class="key">F</span>Knock for Baba Kolade: he has bolt cutters' };
  };
  // beaten: down for a while then back up; critical: crawl away or wake up robbed at dawn
  let crawlSafeT = 0;
  function hostilesNear() { return [...game.thugs.filter(t => t.alive && t.engaged), ...game.gunmen.filter(g => g.alive)]; }
  function updateDowned(dt) {
    if (game.respawnT > 0) return;
    if (player.mode !== 'crawl') { crawlSafeT = 0; return; }
    const hs = hostilesNear();
    const close = hs.some(h => dist2(h.pos, player.pos) < 1.7 * 1.7);
    const seen = hs.some(h => dist2(h.pos, player.pos) < 14 * 14 && !col.blocked(h.pos.x, h.pos.y + 1.5, h.pos.z, player.pos.x, player.pos.y + 0.5, player.pos.z, 1.0));
    crawlSafeT = seen ? 0 : crawlSafeT + dt;
    if (game.heat > 0 && game.gunmen.some(g => g.alive && g.role === 'police' && dist2(g.pos, player.pos) < 2.2 * 2.2)) { arrest(); return; }
    if (!hs.length || crawlSafeT > 2.5) { player.getUp(15); hud.notice('YOU GOT AWAY', 'Barely. Get somewhere safe and eat something.', 'green', 2.5); game.addRespect(100, 'SURVIVED'); return; }
    if (close || player.crawlT > 14) beatenOut();
  }
  function beatenOut() {
    game.respawnT = 999; audio.busted();
    game.beatenHeat = game.heat; // where he wakes up depends on how hot things were
    hud.banner('BEATEN', 'They kicked you until you stopped moving, emptied your pockets and left you in the gutter.', 'red', 4);
    setTimeout(() => {
      L.wallet = 0; player.injury = Math.min(55, player.injury + 25); player.hp = 10;
      L.suspicion = Math.min(100, L.suspicion + 8); // he comes home wrecked, and Mama notices
      game.heat = 0; game.catchMeter = 0; loseItem(); player.dropHeld();
      for (const t of game.thugs) if (t.alive && t.engaged) t.state = 'return';
      for (const t of game.thugs) if (t.state === 'tail') t.remove();
      if (player.boardLost && TH.boardOnGround) { scene.remove(TH.boardOnGround); TH.boardOnGround = null; player.boardLost = false; }
      game.respawnT = 0; player.mode = 'foot';
      L.inside = true; player.respawn(R0.mat.x, R0.mat.z, 0); player.pos.y = 0;
      game.onBeaten?.();
    }, 3500);
  }
  function respawn() {
    loseItem();
    game.heat = 0; game.catchMeter = 0; game.heatTimer = 0;
    for (const v of traffic.police()) { v.police.mode = 'patrol'; v.police.siren = false; v.police.route = []; }
    for (const t of game.thugs) if (t.alive && t.engaged) t.state = 'return';
    for (const t of game.thugs) if (t.state === 'tail') t.remove();
    player.mode = 'foot'; player.hp = Math.max(20, player.cap() * 0.4);
    L.energy = Math.max(0, L.energy - 20);
    game.enterHome();
  }

  // ---------- Street Sense: escape route ----------
  const _cand: any[] = [];
  // ---------- Street Sense: automatic, at the moment danger first starts ----------
  // Not on every punch: when police first spot him, a gun is first raised, an ambush or blockade closes in,
  // he's surrounded, or a lookout starts tailing him. Time slows for a breath and a trail shows the way out.
  // Then it rests for a while before it can fire again.
  const SS = { t: 0, cd: 0, hold: 0, prevHeat: 0, prevRing: 0, prevTails: 0, seen: new WeakSet() };
  function senseFire(reason) {
    if (SS.cd > 0 || L.inside || game.respawnT > 0 || ['down', 'crawl', 'ride'].includes(player.mode)) return;
    SS.t = 2.4; SS.cd = 22; SS.hold = 6; game.escapeT = 0;
    audio.sense(true); setTimeout(() => audio.sense(false), 2400);
    hud.popup(`STREET SENSE · <b>${reason}</b>`);
    if (!game.senseTaught) { game.senseTaught = true; hud.toast('<b>Street Sense</b> kicks in by itself when danger starts: time slows and a green trail shows you where to go.', 'blue'); }
  }
  function updateStreetSense(dt) {
    SS.cd = Math.max(0, SS.cd - dt); SS.t = Math.max(0, SS.t - dt); SS.hold = Math.max(0, SS.hold - dt);
    game.sense = SS.t > 0;
    game.senseMeter = 100 - (SS.cd / 22) * 100; // the HUD bar now shows when it's ready again
    if (!L.inside) {
      if (game.heat > SS.prevHeat && SS.prevHeat === 0) senseFire('POLICE');
      const ring = game.thugs.filter(t => t.alive && t.engaged && dist2(t.pos, player.pos) < 15 * 15).length;
      if (ring >= 3 && SS.prevRing < 3) senseFire('SURROUNDED');
      for (const g of game.gunmen) if (g.alive && g.state === 'aim' && !SS.seen.has(g) && dist2(g.pos, player.pos) < 35 * 35) { SS.seen.add(g); senseFire('GUN'); }
      const A = game.activities;
      if (A.hit && !SS.seen.has(A.hit)) { SS.seen.add(A.hit); senseFire('AMBUSH'); }
      if (A.block && !SS.seen.has(A.block) && dist2(A.block.c, player.pos) < 70 * 70) { SS.seen.add(A.block); senseFire('BLOCKADE AHEAD'); }
      const tails = L.followers().length; if (tails > 0 && SS.prevTails === 0) senseFire('BEING FOLLOWED');
      SS.prevRing = ring; SS.prevTails = tails;
    }
    SS.prevHeat = game.heat;
    if (SS.hold > 0) { game.escapeT -= dt; if (game.escapeT <= 0) { game.escapeT = 0.4; computeEscape(); } } else game.escape = null;
  }
  function computeEscape() {
    game.escape = null;
    const hunters = [...traffic.police().filter(v => v.police.siren).map(v => v.pos), ...game.thugs.filter(t => t.alive && (t.state === 'tail' || t.engaged)).map(t => t.pos), ...game.gunmen.filter(g => g.alive && g.state !== 'post').map(g => g.pos)];
    if (!hunters.length) return;
    game.escape = findHide(hunters);
  }
  // a nearby rooftop to climb, away from whoever is hunting him (climbing breaks line of sight)
  function findHide(hunters) {
    let best = null, bs = Infinity;
    for (const s of col.solids.query(player.pos.x - 45, player.pos.z - 45, player.pos.x + 45, player.pos.z + 45, _cand)) {
      if (s.kind !== 'building' || s.maxy < 3 || s.maxy > 14 || s.maxy <= player.pos.y + 1) continue;
      const x = Math.max(s.minx, Math.min(player.pos.x, s.maxx)), z = Math.max(s.minz, Math.min(player.pos.z, s.maxz));
      const d = Math.hypot(x - player.pos.x, z - player.pos.z);
      let exposed = 0; for (const t of hunters) if (Math.hypot(t.x - x, t.z - z) < 30) exposed++;
      const sc = d + exposed * 30 - s.maxy * 0.5;
      if (sc < bs) { bs = sc; best = { x, z, y: s.maxy }; }
    }
    return best;
  }
  let hideT = 0;
  function updateHide(dt) {
    hideT -= dt;
    const tails = L.followers();
    if (!tails.length) { game.hide = null; return; }
    if (hideT <= 0) { hideT = 0.6; game.hide = findHide(tails.map(t => t.pos)); }
  }
  game.homeObjective = () => {
    const tails = L.followers();
    if (!tails.length) return 'You lost them. <b>Go home</b>: press <span class="key">F</span> at your gate<small>THE WHITE MARKER</small>';
    const lost = Math.max(...tails.map(t => t.lost || 0)), seen = tails.some(t => t.sees);
    return `<b>Lose the lookout${tails.length > 1 ? 's' : ''} (${tails.length})</b> before going home<small>${seen ? 'THEY CAN SEE YOU · GET OUT OF SIGHT: CLIMB THE GREEN ROOF, TURN CORNERS, OR KNOCK THEM OUT' : `OUT OF SIGHT · STAY HIDDEN ${Math.max(0, 6 - lost).toFixed(1)}s MORE`}</small>`;
  };

  // ---------- main update ----------
  game.update = (dt, input) => {
    game.time += dt; game.stats.time += dt;
    updateStreetSense(dt);
    game.timeScale += ((game.sense ? 0.45 : TR.hurry(input) ? 3 : 1) - game.timeScale) * Math.min(1, dt * 8);
    env.grade.uniforms.sense.value += ((game.sense ? 1 : 0) - env.grade.uniforms.sense.value) * Math.min(1, dt * 6);
    const lowHp = player.hp < 35 ? 0.35 : player.hp < 15 ? 0.55 : 0;
    env.grade.uniforms.hurt.value = Math.max(lowHp, env.grade.uniforms.hurt.value - dt * 1.5);
    let sdt = dt * game.timeScale;
    if (game.hitStop > 0) { game.hitStop -= dt; sdt *= 0.06; }

    // input
    const dir = moveDir(input);
    const opt = game.respawnT > 0 ? null : interactOption();
    let prompt = opt?.text || null;
    if (!prompt && game.thugs.some(t => t.alive && t.state === 'run' && dist2(t.pos, player.pos) < 2.8 * 2.8)) prompt = '<span class="key">F</span>Tackle him';
    if (!prompt && !L.inside && ['foot', 'board'].includes(player.mode) && player.onGround && !player.aiming && !player.fightingNear) {
      const v = traffic.nearestSkitch(player.pos);
      if (v) prompt = `<span class="key">E</span>Skitch the ${v.spec.label.toLowerCase()}`;
    }
    game.prompt = prompt;
    if (game.arrest) { updateArrest(dt, input); input.pressed = {}; }
    else if (player.mode === 'ride') { TR.update(dt, input); input.pressed = {}; }
    else if (game.pendingTrip && player.mode === 'foot') TR.checkPending();
    if (player.mode === 'bike') prompt = game.prompt = '<span class="key">R</span>Get off · <span class="key">Space</span>Brake · <span class="key">Shift</span>Full throttle';
    if (game.respawnT <= 0 && player.mode !== 'down' && player.mode !== 'bike') {
      if ((input.pressed.fire && player.aiming) || input.pressed.throw) { if (!L.inside) doThrow(dir); }
      else if (input.pressed.act && ['foot', 'board'].includes(player.mode) && game.thugs.some(t => t.alive && t.state === 'run' && dist2(t.pos, player.pos) < 2.8 * 2.8)) {
        const t = game.thugs.filter(q => q.alive && q.state === 'run').sort((a, b) => dist2(a.pos, player.pos) - dist2(b.pos, player.pos))[0];
        if (player.mode === 'board') player.mode = 'foot';
        player.startAct('pounce', t, () => { t.takeHit(99, player.pos.x, player.pos.z, 'takedown'); game.onKnockout(t); camera.shake = 0.5; fx.dust(t.pos.x, t.pos.y + 0.1, t.pos.z, 10); audio.punch(); game.addRespect(200, 'TACKLED'); }, { invuln: true, reach: 0.6 });
      }
      else if (input.pressed.act && player.mode === 'skitch' && player.skitch?.v?.kind === 'getaway') {
        // holding onto a getaway car: F smashes the windows until the driver loses it
        const v = player.skitch.v; v.ai.health--; audio.glass(); camera.shake = 0.35; fx.burst(v.pos.x, v.pos.y + 1.3, v.pos.z, 0xb3e5fc, 12, 3);
        hud.popup(v.ai.health > 0 ? `SMASH · <b>${v.ai.health} MORE</b>` : '<b>THE DRIVER LOST IT</b>');
        if (v.ai.health <= 0) { v.ai.smashed = true; game.addRespect(300, 'CAR STOPPED'); }
      }
      else if (input.pressed.act) {
        if (opt && opt.kind !== 'none' && doInteraction(opt)) { /* handled */ }
        else if (player.mode === 'board' && !player.onGround) player.tryTrick();
        else if (!combat.attack(dir, { sprint: input.held.sprint, moving: Math.hypot(input.move.x, input.move.y) > 0.3 })) { player.tryPunch(); audio.swing(); }
      }
      if (input.pressed.roll && combat.counter()) input.pressed.roll = false;
      if (input.pressed.gadget) { if (opt?.kind === 'out' && opt.story) game.leaveHome(false); else if (!L.inside && !combat.flurry(dir) && !combat.sweep()) combat.launch(dir); }
      if (input.pressed.flash && !L.inside) combat.pounce(dir);
      if (input.pressed.radio) game.radio.listen();
      if (input.pressed.change) changeClothes();
      if (input.pressed.torch) toggleTorch();
    }

    player.update(sdt, input, camera.yaw, game.time);
    for (const e of player.events) handleEvent(e);
    traffic.update(sdt, game);
    fx.update(sdt, () => null, () => {});
    TH.update(sdt, hitTest, onThrowHit);
    if (TH.boardOnGround && player.boardLost && dist2(TH.boardOnGround.position, player.pos) < 1.8 * 1.8) { scene.remove(TH.boardOnGround); TH.boardOnGround = null; player.boardLost = false; audio.grab(); hud.popup('GOT YOUR BOARD BACK'); }
    updateRoom(dt);
    // evening rolls into night: once it's dark and he's home, Mama and Tobi eat and go to sleep (no need to 'wait')
    if (L.phase === 'day' && L.inside && L.clock >= 20 * 60 && !game.story.active) game.toNight();
    combat.update(sdt);

    // Red Caps
    for (const t of game.thugs) {
      if (t.hidden) continue;
      const r = t.update(sdt, game);
      if (r?.hit) { if (player.hurt(r.hit, t.pos.x, t.pos.z, 3.5)) { combat.hit(); audio.hurt(); env.grade.uniforms.hurt.value = 1; camera.shake = 0.4; } }
      if (r?.slam) { for (const o of game.thugs) if (o !== t && o.alive && !o.grounded && dist2(o.pos, t.pos) < 3.5 * 3.5) o.takeHit(0, t.pos.x, t.pos.z, 'light'); camera.shake = 0.6; }
      if (r?.throwBottle) (t.variant === 'blade' ? TH.enemyKnife : TH.enemyBottle)(r.throwBottle.from, r.throwBottle.to);
      if (t.state === 'ko' && !t.koCounted) { t.koCounted = true; game.onKnockout(t); }
    }
    for (let i = game.thugs.length - 1; i >= 0; i--) if (game.thugs[i].removed) game.thugs.splice(i, 1);
    // officers
    for (const g of game.gunmen) {
      if (g.removed) continue;
      const r = g.update(sdt, game);
      if (g.state === 'aim') { const m = g.muzzle(); fx.laser(g, m, _t.set(player.pos.x, player.pos.y + 1.2, player.pos.z), g.aimT / 1.0, game.sense); }
      if (r?.shoot && !game.arrest) resolveShot(g.muzzle().clone());
      if (r?.grab) game.officerGrab = true;
    }
    for (let i = game.gunmen.length - 1; i >= 0; i--) if (game.gunmen[i].removed) game.gunmen.splice(i, 1);

    for (let i = game.civilians.length - 1; i >= 0; i--) { const c = game.civilians[i]; if (c.gone) { game.civilians.splice(i, 1); continue; } c.update(sdt, game); }
    for (const site of game.sites) {
      if (site.alarmT > 0) { site.alarmT -= sdt; if (site.alarmT <= 0) { for (const a of site.group) a.engage(0.1); game.say(site.collector, 'Where the money? OLE!'); } }
      if (site.state === 'done') { site.respawn -= sdt; if (site.respawn <= 0 && site.collector.alive) { site.state = 'active'; site.collector.giveBag(); } }
      if (site.trader && !site.trader.gone) site.trader.mood = site.state === 'active' ? 'scared' : 'cheer';
    }
    if (game.dropped) { const m = game.dropped.mesh; m.rotation.y += sdt * 2; m.position.y = col.groundHeight(m.position.x, m.position.z, m.position.y + 1).h + 0.25 + Math.sin(game.time * 3) * 0.06; }

    const isDay = L.phase === 'day';
    env.setDaylight(L.daylight());
    applyLights(false);
    for (const t of game.thugs) { const h = isDay && (t.role === 'collector' || (t.role === 'guard' && t.group?.some(o => o.site)) || t.role === 'patrol') && !t.engaged; if (h !== !!t.hidden) { t.hidden = h; t.rig.root.visible = !h; } }
    if (!isDay) updateBlackout(sdt);
    updateNepa(sdt);
    updatePolice(sdt);
    if (!isDay) updatePatrols(sdt);
    DAY.update(dt);
    game.police.update(sdt);
    game.radio.update(dt);
    updateExposure(dt);
    updateDaySuit(dt);
    updatePick(dt, input);
    game.activities?.update(sdt);
    game.story.update(sdt);
    L.update(sdt);
    if (game.carrying && game.delivery && dist2(game.delivery, player.pos) < 2.2 * 2.2 && Math.hypot(player.vel.x, player.vel.z) < 3 && ['foot', 'board'].includes(player.mode)) deliver();

    updateDowned(dt);
    if (['down', 'crawl'].includes(player.mode) && !game.arrest) { game.hudMeter = Math.max(0.02, player.adren); game.catchLabel = player.adren > 0.03 ? 'ADRENALINE · KEEP MASHING SPACE' : 'DOWN · MASH SPACE FOR AN ADRENALINE BURST'; }
    else if (!game.arrest && game.hudMeter != null) { game.hudMeter = null; game.catchLabel = null; }
    if (!game.injuryTold && player.cap() < 88) { game.injuryTold = true; hud.toast('<b>Injury:</b> hits leave damage that caps your health (the striped part of the bar). Health refills up to the cap on its own; <b>food and sleep</b> heal the injury itself.', 'blue'); }
    if (game.respawnT > 0) { game.respawnT -= dt; if (game.respawnT <= 0) respawn(); }

    const spd = Math.hypot(player.vel.x, player.vel.z);
    if (player.mode !== 'down') game.stats.topSpeed = Math.max(game.stats.topSpeed, Math.min(spd, 30));
    if (player.mode === 'skitch') game.stats.skitchDist += spd * sdt;
    if (player.mode === 'grind') { game.grindLen += spd * sdt; game.stats.longestGrind = Math.max(game.stats.longestGrind, game.grindLen); }
    game.stats.bestCombo = Math.max(game.stats.bestCombo, combat.best);
    if (!L.inside) game.outT = (game.outT || 0) + dt;
    game.autoT = (game.autoT || 0) + dt; if (game.autoT > 20 && !game.arrest && player.mode !== 'ride') { game.autoT = 0; game.save(); }
    if (!L.inside && game.tipI < TIPS.length && game.outT > TIPS[game.tipI][0]) hud.toast(TIPS[game.tipI++][1], 'blue');
    if (game.inMall && !mallOpen()) { hud.say('Security', 'We don close! Oya, everybody out.', 3); leaveMall(); }
    const area = game.inMall ? (game.mallFrom?.name || 'Mall') : world.areaAt(player.pos.x, player.pos.z);
    if (area !== game.areaName) { if (game.areaName) hud.area?.(area); game.areaName = area; }

    game.dangers.length = 0;
    for (const v of traffic.police()) if (v.police.siren) game.dangers.push({ x: v.pos.x, z: v.pos.z, r: 18 });
    for (const t of game.thugs) if (t.alive && t.engaged) game.dangers.push({ x: t.pos.x, z: t.pos.z, r: 12 });
    for (let i = game.gunDanger.length - 1; i >= 0; i--) { const g = game.gunDanger[i]; g.t -= sdt; if (g.t <= 0) game.gunDanger.splice(i, 1); else game.dangers.push({ x: g.x, z: g.z, r: 28 }); }

    updateHide(dt);
    updateNav(dt);
    buildMarkers();
    const so = game.story.objective();
    const ao = L.inside ? null : game.activities.objective();
    if (game.arrest) hud.objective('<b>Arrested.</b> Kick the door out before you reach the station<small>MASH F / SPACE · THE MORE HEALTH YOU HAVE, THE HARDER YOU KICK</small>');
    else if (player.cuffed) hud.objective(game.heat > 0 ? `<b>Handcuffed and hunted.</b> Break their line of sight and stay hidden ${Math.max(0, 16 - game.heatTimer).toFixed(0)}s per star<small>NO FIGHTING, NO BOARD, NO CLIMBING · ALLEYS, CORNERS, CROWDS, SKITCHING IS OFF · DARKNESS HELPS</small>` : '<b>Handcuffed.</b> Get to <b>Baba Kolade\'s workshop</b> to cut them<small>DON\'T GET SEEN BY ANOTHER PATROL</small>');
    else if (game.carrying && game.delivery && !game.story.active) hud.objective(`Return <b>${game.carrying.label}</b> to <b>${game.delivery.name}</b><small>${(game.delivery.why || '').toUpperCase()} · THE GREEN MARKER</small>`);
    else if (ao) hud.objective(ao);
    else if (game.inMall) hud.objective(`<b>${game.mallFrom?.name || 'The mall'}</b> · ${L.timeStr()}<small>WALK UP TO A COUNTER AND PRESS F TO BUY · THE GLASS DOORS TO LEAVE</small>`);
    else if (game.mode === 'patrol' && !L.inside) hud.objective(`<b>${game.areaName || 'Lagos'}</b> · ${L.timeStr()}<small>M: MAP · PICK A PLACE AND HOW TO GET THERE${game.waypoint ? ' · ' + game.waypoint.label.toUpperCase() : ''}</small>`);
    else if (so && game.story.active?.m.day) hud.objective(so);
    else if (!L.inside && game.story.reconObjective()) hud.objective(game.story.reconObjective());
    else if (L.phase === 'day' && !L.inside && L.clock >= 20 * 60) hud.objective('It\'s dark. <b>Go home</b>: Mama is back and dinner is waiting<small>NIGHT STARTS WHEN YOU\'RE HOME</small>');
    else if (L.phase === 'day') { const e = DAY.errand, lead = game.story.next(); hud.objective(L.inside ? 'Home (daytime) · <b>read Mama\'s note</b> at the pot, go out, or wait for night<small>THE SUIT STAYS HIDDEN IN DAYLIGHT</small>' : `${e && e.step !== 'done' ? `Errand: <b>${e.step === 'go' ? e.text : 'take it home'}</b>` : 'Explore Surulere'}<small>${lead ? 'LEAD FOUND: ' + lead.title.toUpperCase() + ' TONIGHT · ' : 'LISTEN FOR NEWS (PURPLE): NEWSPAPERS, RADIO, GOSSIP · '}BUS STOPS (YELLOW) · HOME BY 6 PM</small>`); }
    else if (L.inside) hud.objective(L.suit ? 'Home · <b>go out through the door</b>, or hide the suit in the drum before you sleep<small>WALK SOFTLY: RUNNING WAKES MAMA</small>' : `Home · <b>${game.story.upcoming() && !game.story.next() ? 'turn on the radio (window sill) for news' : game.story.next() ? 'you have a lead: ' + game.story.next().title : 'rest'}</b>. The black suit is in the water drum<small>EAT FROM THE POT · REST ON THE CHAIR · SLEEP ON YOUR MAT · WALK SOFTLY</small>`);
    else if (so) hud.objective(so);
    else if (game.carrying && game.delivery && !game.story.active) hud.objective(`Return <b>${game.carrying.label}</b> to <b>${game.delivery.name}</b><small>${(game.delivery.why || '').toUpperCase()}</small>`);
    else if (game.story.side && !game.story.side.cleared) hud.objective(`Stop the Red Caps beating <b>${game.story.side.victim.name}</b><small>SIDE EVENT · FOLLOW THE ARROW</small>`);
    else if (game.mode === 'patrol') hud.objective(`<b>${game.areaName || 'Lagos'}</b> · ${L.timeStr()}<small>M: MAP · PICK A PLACE AND HOW TO GET THERE${game.waypoint ? ' · ' + game.waypoint.label.toUpperCase() : ''}</small>`);
    else { const left = game.sites.filter(s => s.state === 'active').length; hud.objective(left ? `Patrol Surulere · <b>${left}</b> Red Cap levy point${left > 1 ? 's' : ''} active<small>OR GO HOME (WHITE) TO START THE NEXT STORY MISSION</small>` : 'Patrol Surulere<small>GO HOME TO REST OR START THE NEXT STORY MISSION</small>'); }
    hud.tracker(player.cuffed || game.arrest ? { title: 'In handcuffs', sub: game.arrest ? 'IN THE BACK OF A POLICE CAR' : `${game.heat} STAR${game.heat === 1 ? '' : 'S'} · ${Math.round(Math.hypot(DAY.pois.kolade.x - player.pos.x, DAY.pois.kolade.z - player.pos.z))} M TO KOLADE`, steps: [{ label: 'Kick the door out', state: game.arrest ? 'cur' : 'done' }, { label: 'Lose the police', state: game.arrest ? '' : game.heat > 0 ? 'cur' : 'done' }, { label: 'Get to Baba Kolade\'s workshop', state: !game.arrest && game.heat === 0 ? 'cur' : '' }] } : game.activities?.tracker() || (game.mode === 'patrol' ? null : game.story.tracker()));
  };

  // ---------- navigation ----------
  function navTarget() {
    if (player.cuffed) { const k = DAY.pois.kolade; return { x: k.x, z: k.z, color: 0xff8a80, label: 'BABA KOLADE · BOLT CUTTERS' }; } // in cuffs only one place matters
    // what he's in the middle of always owns the arrow: the story mission, then whatever he's carrying back
    const sm = game.story.active && game.story.target(); if (sm) return { x: sm.x, z: sm.z, color: 0xffd54f, label: 'STORY', moving: true };
    if (game.dropped) { const m = game.dropped.mesh.position; return { x: m.x, z: m.z, color: 0xf2b705, label: 'PICK IT UP' }; }
    if (game.carrying && game.delivery) return { x: game.delivery.x, z: game.delivery.z, color: 0x43e04a, label: `RETURN TO ${game.delivery.name.toUpperCase()}`, moving: true };
    const aa = game.activities.activeTarget(); if (aa) return { x: aa.x, z: aa.z, color: 0x80deea, label: aa.label, moving: aa.moving };
    // then a waypoint he picked; only then new trouble that popped up
    if (game.waypoint) { if (dist2(game.waypoint, player.pos) < 10 * 10) game.waypoint = null; else return { x: game.waypoint.x, z: game.waypoint.z, color: 0x80deea, label: game.waypoint.label }; }
    const at = game.activities.target();
    if (at) return { x: at.x, z: at.z, color: 0x80deea, label: at.label, moving: at.moving };
    if (L.phase === 'day') {
      const st = game.story.target(); if (st) return { x: st.x, z: st.z, color: 0xffd54f, label: 'STORY', moving: true };
      const ds = game.story.dayStart(); if (ds) return { x: ds.x, z: ds.z, color: 0xffd54f, label: 'DAYTIME MISSION' };
      const rc = game.story.reconTarget(); if (rc) return { x: rc.x, z: rc.z, color: 0xffd54f, label: 'LOOK' };
      const t = DAY.target(); return t ? { x: t.x, z: t.z, color: 0x80deea, label: t.label } : null;
    }
    if (game.escape) return { x: game.escape.x, z: game.escape.z, color: 0x69f0ae, label: 'ESCAPE' };
    if (game.hide) return { x: game.hide.x, z: game.hide.z, color: 0x69f0ae, label: 'HIDE' };
    if (game.dropped) { const m = game.dropped.mesh.position; return { x: m.x, z: m.z, color: 0xf2b705, label: 'ITEM' }; }
    if (game.carrying && game.delivery) return { x: game.delivery.x, z: game.delivery.z, color: 0x43e04a, label: game.delivery.name, moving: true };
    const st = game.story.target();
    if (st) return { x: st.x, z: st.z, color: 0xffd54f, label: 'STORY', moving: true };
    const sd = game.story.sideTarget();
    if (sd) return { x: sd.x, z: sd.z, color: 0xff3d3d, label: 'HELP' };
    if (L.clock > 28 * 60) return { x: world.homeDoor.x, z: world.homeDoor.z, color: 0xffffff, label: 'HOME' };
    let best = null, bd = Infinity;
    for (const s of game.sites) if (s.state === 'active' && s.collector.hasBag && s.collector.alive) { const d = dist2(s.collector.pos, player.pos); if (d < bd) { bd = d; best = s.collector.pos; } }
    return best ? { x: best.x, z: best.z, color: 0xff9100, label: 'LEVY' } : { x: world.homeDoor.x, z: world.homeDoor.z, color: 0xffffff, label: 'HOME' };
  }
  let navT = 0;
  function updateNav(dt) {
    navT -= dt;
    const t = L.inside ? null : navTarget();
    game.nav = t;
    if (!t) { game.navRoute = null; return; }
    if (navT <= 0 || !game.navRoute) {
      navT = t.moving ? 0.3 : 0.6;
      const d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z);
      const direct = d < 35 || !col.blocked(player.pos.x, player.pos.y + 1.5, player.pos.z, t.x, player.pos.y + 1.5, t.z, 3);
      const yaw = ['board', 'grind', 'skitch'].includes(player.mode) ? player.heading : player.yaw;
      game.navRoute = direct ? [[t.x, t.z]] : traffic.route(player.pos.x, player.pos.z, yaw, t.x, t.z);
    }
    const r = game.navRoute;
    while (r.length > 1 && Math.hypot(r[0][0] - player.pos.x, r[0][1] - player.pos.z) < 9) r.shift();
    r[r.length - 1] = [t.x, t.z];
  }

  function buildMarkers() {
    const M = game.markers; M.length = 0; const MM = game.mapMarkers; MM.length = 0;
    if (L.inside) return;
    if (player.cuffed) { // nothing else matters: just Kolade and the police on your tail
      const dstr = (x, z) => Math.round(Math.hypot(x - player.pos.x, z - player.pos.z)) + 'm', k = DAY.pois.kolade;
      M.push({ x: k.x, y: 3.2, z: k.z, kind: 'deliver', label: `BABA KOLADE · BOLT CUTTERS · ${dstr(k.x, k.z)}` }); MM.push({ x: k.x, z: k.z, color: '#ff8a80' });
      for (const g of game.gunmen) if (g.alive && g.role === 'police') M.push({ x: g.pos.x, y: g.pos.y + 2.2, z: g.pos.z, kind: 'cop', label: '', edge: false });
      return;
    }
    const dstr = (x, z) => Math.round(Math.hypot(x - player.pos.x, z - player.pos.z)) + 'm';
    DAY.markers(M, MM, dstr);
    game.police.markers(M, MM, dstr);
    { const rc = game.story.reconTarget(); if (rc) { M.push({ x: rc.x, y: 3, z: rc.z, kind: 'story', label: `LOOK · ${rc.label.toUpperCase()} · ${dstr(rc.x, rc.z)}` }); MM.push({ x: rc.x, z: rc.z, color: '#ffd54f' }); } }
    { const ds = game.story.dayStart(); if (ds) { const d = game.story.dayAvailable(); M.push({ x: ds.x, y: 3, z: ds.z, kind: 'story', label: `DAYTIME · ${d.title.toUpperCase()} · ${dstr(ds.x, ds.z)}` }); MM.push({ x: ds.x, z: ds.z, color: '#ffd54f' }); } }
    game.activities?.markers(M, MM, dstr);
    for (const b of TR.stops) { if (Math.hypot(b.x - player.pos.x, b.z - player.pos.z) < 40) M.push({ x: b.x, y: 3.2, z: b.z, kind: 'bus', label: 'BUS STOP', edge: false }); MM.push({ x: b.x, z: b.z, color: '#fbc02d' }); }
    // danger sense: always on for anyone about to hit him
    for (const t of game.thugs) if (t.alive && t.state === 'windup') M.push({ x: t.pos.x, y: t.pos.y + 2.35, z: t.pos.z, kind: t.unblockable ? 'dangerRed' : 'danger', label: t.unblockable ? 'DODGE' : 'C', edge: false });
    for (const g of game.gunmen) if (g.alive && g.state === 'aim') M.push({ x: g.pos.x, y: g.pos.y + 2.3, z: g.pos.z, kind: 'dangerRed', label: 'GUN', edge: false });
    const st = game.story.target();
    if (st) { M.push({ x: st.x, y: 2.6, z: st.z, kind: 'story', label: `${game.story.active?.m.title.toUpperCase() || 'STORY'} · ${dstr(st.x, st.z)}` }); MM.push({ x: st.x, z: st.z, color: '#ffd54f' }); }
    const sd = game.story.sideTarget();
    if (sd) { M.push({ x: sd.x, y: 2.4, z: sd.z, kind: 'site', label: `HELP · ${dstr(sd.x, sd.z)}` }); MM.push({ x: sd.x, z: sd.z, color: '#ff3d3d' }); }
    if (!game.carrying) for (const s of game.sites) if (s.state === 'active' && s.collector.hasBag && s.collector.alive) {
      const c = s.collector;
      let label = `LEVY · ${dstr(c.pos.x, c.pos.z)}`;
      if (game.sense && dist2(c.pos, player.pos) < 40 * 40) { const tx = player.pos.x - c.pos.x, tz = player.pos.z - c.pos.z; label = ((Math.sin(c.yaw) * tx + Math.cos(c.yaw) * tz) < 0 || game.power < 0.5) ? 'UNAWARE: SNATCH IT' : 'WATCHING'; }
      M.push({ x: c.pos.x, y: c.pos.y + 2.5, z: c.pos.z, kind: 'levy', label });
      MM.push({ x: c.pos.x, z: c.pos.z, color: '#ff9100' });
    }
    if (game.delivery) { const d = game.delivery; M.push({ x: d.x, y: 2.6, z: d.z, kind: 'deliver', label: `${d.name.toUpperCase()} · ${dstr(d.x, d.z)}` }); MM.push({ x: d.x, z: d.z, color: '#43a047' }); }
    if (game.dropped) { const m = game.dropped.mesh.position; M.push({ x: m.x, y: m.y + 0.8, z: m.z, kind: 'bag', label: 'PICK UP' }); MM.push({ x: m.x, z: m.z, color: '#f2b705' }); }
    for (const c of game.civilians) if (c.mood === 'captive') { M.push({ x: c.pos.x, y: 1.8, z: c.pos.z, kind: 'captive', label: dist2(c.pos, player.pos) < 30 * 30 ? 'FREE' : '', edge: false }); MM.push({ x: c.pos.x, z: c.pos.z, color: '#40c4ff' }); }
    for (const t of game.thugs) if (t.alive && t.state === 'tail') { M.push({ x: t.pos.x, y: t.pos.y + 2.2, z: t.pos.z, kind: 'tail', label: t.sees ? 'WATCHING YOU' : '', edge: !!t.sees }); MM.push({ x: t.pos.x, z: t.pos.z, color: '#ff5252' }); }
    for (const v of world.vendors) if (dist2(v, player.pos) < 60 * 60 || L.hunger < 30) { if (dist2(v, player.pos) < 50 * 50) M.push({ x: v.x, y: 2.2, z: v.z, kind: 'food', label: v.label, edge: false }); MM.push({ x: v.x, z: v.z, color: '#ffab40' }); }
    if (game.sense) {
      for (const t of game.thugs) if (t.alive && t.state !== 'tail' && dist2(t.pos, player.pos) < 70 * 70) M.push({ x: t.pos.x, y: t.pos.y + 2.2, z: t.pos.z, kind: 'enemy', label: '', edge: false });
      for (const g of game.gunmen) if (g.alive) M.push({ x: g.pos.x, y: g.pos.y + 2.2, z: g.pos.z, kind: 'cop', label: '', edge: false });
      for (const v of traffic.police()) M.push({ x: v.pos.x, y: v.pos.y + 2.6, z: v.pos.z, kind: 'cop', label: v.police.sees ? 'SEES YOU' : '', edge: false });
    }
    if (game.escape) { const e = game.escape; M.push({ x: e.x, y: 1.6, z: e.z, kind: 'escape', label: `STREET SENSE · GO HERE · ${dstr(e.x, e.z)}` }); MM.push({ x: e.x, z: e.z, color: '#69f0ae' }); }
    if (game.hide && !game.escape) { const e = game.hide; M.push({ x: e.x, y: 1.6, z: e.z, kind: 'escape', label: `CLIMB · BREAK THEIR SIGHT · ${dstr(e.x, e.z)}` }); MM.push({ x: e.x, z: e.z, color: '#69f0ae' }); }
    MM.push({ x: world.homeDoor.x, z: world.homeDoor.z, color: '#ffffff' });
    if (L.clock > 28 * 60 || (game.story.active && !L.followers().length && game.story.homeStep()) || dist2(world.homeDoor, player.pos) < 60 * 60) M.push({ x: world.homeDoor.x, y: 2.8, z: world.homeDoor.z, kind: 'home', label: `HOME · ${dstr(world.homeDoor.x, world.homeDoor.z)}` });
  }

  function handleEvent(ev) {
    switch (ev.e) {
      case 'bikeOn': audio.horn?.(player.pos); break;
      case 'bikeOff': if (ev.crash) { audio.land(1); camera.shake = 0.6; hud.popup('CRASHED'); } break;
      case 'jump': audio.ollie(); if (ev.power > 0.6) { fx.dust(player.pos.x, player.pos.y + 0.05, player.pos.z, 10); camera.shake = 0.2; } break;
      case 'ollie': audio.ollie(); break;
      case 'land': audio.land(Math.min(1, -ev.vy / 14)); if (ev.vy < -13) camera.shake = 0.35; break;
      case 'grind': game.grindLen = 0; audio.grab(); break;
      case 'grindEnd': if (game.grindLen > 3) game.addRespect(game.grindLen * 6, `GRIND ${game.grindLen.toFixed(0)}M`); break;
      case 'bail': audio.bail(); camera.shake = 0.5; break;
      case 'hurt': game.hitsTaken = (game.hitsTaken || 0) + 1; audio.hurt(); env.grade.uniforms.hurt.value = 1; combat.hit(); break;
      case 'carhit': hud.toast(`Hit by a ${ev.v.spec.label.toLowerCase()}!`, 'red'); break;
      case 'skitch': audio.grab(); if (ev.v.type === 'danfo') hud.say('Conductor', ['Ehn? Who dey hold my motor?', 'Oya! Oshodi, Oshodi!', 'Wetin you dey do for back there?'][Math.floor(R() * 3)], 2); break;
      case 'conductor': hud.say('Conductor', 'Comot for my motor! You wan die?!', 1.8); audio.horn(player.pos); break;
      case 'swatted': hud.toast('The conductor knocked your hand off!', 'red'); break;
      case 'wallhit': camera.shake = 0.6; break;
      case 'pothole': audio.land(0.6); break;
      case 'vault': case 'mantle': case 'grab': case 'boardOn': case 'boardOff': audio.grab(); break;
      case 'swing': case 'roll': case 'flip': case 'act': audio.swing(); break;
      case 'flipLand': if (player.fightingNear) game.expose(5); game.addRespect(ev.kind === 'side' ? 40 : 30, ev.kind === 'back' ? 'BACKFLIP' : ev.kind === 'side' ? 'SIDE FLIP' : 'FRONT FLIP'); break;
      case 'wallrun': if (player.fightingNear) game.expose(5); audio.grab(); game.addRespect(40, 'WALL-RUN'); break;
      case 'walljump': audio.ollie(); game.addRespect(30, 'WALL FLIP'); break;
      case 'landRoll': audio.swing(); game.addRespect(20, 'SAFETY ROLL'); break;
      case 'hardland': hud.toast('Hard landing. Press <span class="key">C</span> just before you land to roll.', 'red'); break;
      case 'trick': audio.swing(); break;
      case 'trickLand': game.stats.tricks += ev.names.length; game.addRespect(ev.pts, ev.names.map(t => t.name.toUpperCase()).join(' + ')); audio.land(0.3); break;
      case 'trickFail': hud.popup('SLAM'); break;
      case 'leap': audio.ollie(); break;
      case 'splash': fx.burst(player.pos.x, player.pos.y + 0.1, player.pos.z, 0x8d7b62, 6, 3); audio.splash?.(); break;
      case 'down': camera.shake = 0.7; if (ev.critical) hud.banner('CRITICAL', 'You can barely move. <b>Crawl away</b> and get out of their sight!', 'red', 3); else hud.notice('DOWN', 'stay down a moment, then get back up', 'red'); break;
      case 'getup': audio.grab(); break;
      case 'catDrop': {
        // the cat landing: a low three-point crouch, a ring of dust, everyone near flinches; land on someone and he's down
        player.startAct('catdrop', null, () => {}, { invuln: true });
        fx.dust(player.pos.x, player.pos.y + 0.05, player.pos.z, 22); camera.shake = 0.55; game.hitStop = 0.15; audio.land(1);
        let n = 0;
        for (const t of game.thugs) {
          if (!t.alive || t.grounded) continue;
          const d = Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
          if (d < 1.6 && t.takeHit) { t.takeHit(99, player.pos.x, player.pos.z, 'takedown'); game.onKnockout(t); n += 2; }
          else if (d < 5) { t.stun?.(0.9); n++; }
        }
        game.addRespect(n ? 80 + n * 40 : 40, n ? 'CAT DROP' : 'CAT LANDING');
        break;
      }
      case 'nineLives': camera.shake = 0.6; game.hitStop = 0.2; audio.alert(); hud.banner('NINE LIVES', 'He twists out of it and lands on his feet. That was the one for tonight.', 'green', 2.6); break;
      case 'proneOn': audio.grab(); hud.popup('BELLY BOARD · <b>LOW AND HARD TO SPOT</b>'); break;
      case 'proneOff': audio.grab(); break;
      case 'proneSlow': hud.popup('GO FASTER FIRST, THEN X'); break;
      case 'adrenaline': audio.alert(); camera.shake = 0.6; hud.popup('ADRENALINE · <b>RUN</b>'); fx.dust(player.pos.x, player.pos.y + 0.1, player.pos.z, 12); break;
    }
  }

  // ---------- patrol mode: endless free roam, separate from the story ----------
  game.mode = 'story';
  const RANKS: any[] = [[0, 'Nobody'], [2000, 'Known face'], [6000, 'Street name'], [15000, 'Talk of Surulere'], [35000, 'Lagos legend']];
  game.rank = () => { let r = RANKS[0], next = null; for (const q of RANKS) { if (game.respect >= q[0]) r = q; else { next = q; break; } } return { name: r[1], next: next ? next[1] : null, toNext: next ? next[0] - game.respect : 0 }; };
  // free roam: the clock just runs, day into night into day. He goes where he likes.
  game.startPatrol = () => {
    L.phase = 'day'; L.clock = 10 * 60; setOccupants(false);
    L.suit = false; L.bag = true; player.setOutfit(OUTFITS.bolajiDay); reattachBag(); updateBackpack();
    game.leaveHome(false);
    hud.notice('LAGOS', 'Go anywhere. <b>M</b> for the map: pick a place and how to get there.', 'white', 4);
    game.save();
  };
  game.wakeUp = () => { L.inside = true; L.phase = 'day'; L.clock = 8 * 60; L.suit = false; player.setOutfit(OUTFITS.bolajiDay); reattachBag(); updateBackpack(); setOccupants(false); game.leaveHome(false); game.save(); };
  // everything happening right now that he could go and deal with, nearest first
  game.patrolBoard = () => {
    const d = (x, z) => Math.round(Math.hypot(x - player.pos.x, z - player.pos.z));
    const out: any[] = [];
    const sd = game.story.side; if (sd && !sd.cleared) out.push({ kind: 'crime', title: 'Beating in progress', desc: `Red Caps are beating ${sd.victim.name} in ${world.areaAt(sd.victim.pos.x, sd.victim.pos.z)}.`, x: sd.victim.pos.x, z: sd.victim.pos.z, reward: 'Respect · a tip', urgent: true });
    out.push(...game.activities.board());
    for (const site of game.sites) if (site.state === 'active' && site.collector.alive) out.push({ kind: 'crime', title: 'Red Cap levy point', desc: `${site.name}: snatch the levy bag (from behind is quietest).`, x: site.collector.pos.x, z: site.collector.pos.z, reward: `₦${site.amount.toLocaleString()} back to the people` });
    for (const cp of game.police.list) if (cp.cash > 0 && L.phase !== 'day') out.push({ kind: 'police', title: 'Police checkpoint', desc: `${cp.name}: ₦${cp.cash.toLocaleString()} of roger in the collector's pocket. Police heat if you take it.`, x: cp.x, z: cp.z, reward: 'Roger back to the drivers' });
    const undiscovered = Object.values(DAY.pois as Record<string, any>).filter(q => !q.found).sort((a, b) => d(a.x, a.z) - d(b.x, b.z)).slice(0, 2);
    for (const q of undiscovered) out.push({ kind: 'explore', title: `Explore: ${q.name}`, desc: 'Somewhere you haven\'t been yet.', x: q.x, z: q.z, reward: 'Respect' });
    if (L.hunger < 40) { const v = world.vendors.slice().sort((a, b) => d(a.x, a.z) - d(b.x, b.z))[0]; if (v) out.push({ kind: 'need', title: `Eat: ${v.label}`, desc: `You're hungry. ${v.food}, ₦${v.price}.`, x: v.x, z: v.z, reward: 'Hunger' }); }
    if (L.energy < 30) out.push({ kind: 'need', title: 'Go home and rest', desc: 'You\'re exhausted. Rest on the chair or sleep.', x: world.homeDoor.x, z: world.homeDoor.z, reward: 'Energy' });
    for (const e of out) e.dist = d(e.x, e.z);
    return out.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || a.dist - b.dist);
  };
  game.waypoint = null;
  // every named place he knows, for the map's place list
  game.places = () => {
    const out: any[] = [{ name: 'Home (Aguda)', x: world.homeDoor.x, z: world.homeDoor.z, kind: 'home' }];
    for (const q of Object.values(DAY.pois as Record<string, any>)) out.push({ name: q.name, x: q.x, z: q.z, kind: 'place' });
    for (const s of world.shops || []) out.push({ name: s.name, x: s.x, z: s.z, kind: 'shop' });
    for (const s of TR.stops) out.push({ name: s.name + ' bus stop', x: s.x, z: s.z, kind: 'bus' });
    const seen = new Set(); for (const v of world.vendors) { if (seen.has(v.label)) continue; seen.add(v.label); out.push({ name: v.label, x: v.x, z: v.z, kind: 'food' }); }
    for (const p of out) p.area = world.areaAt(p.x, p.z);
    return out;
  };
  game.travel = (place, mode) => mode === 'skate' ? (game.setWaypoint({ x: place.x, z: place.z, title: place.name }), true) : TR.trip(place, mode);
  game.setWaypoint = (e) => { game.waypoint = e ? { x: e.x, z: e.z, label: e.title } : null; if (e) hud.notice('WAYPOINT', e.title, 'blue'); };
  game.patrolTracker = () => {
    const b = game.patrolBoard().slice(0, 3), r = game.rank();
    return { title: 'Patrol', sub: `NIGHT ${L.night} · ${r.name.toUpperCase()}${r.next ? ` · ${r.toNext.toLocaleString()} TO ${r.next.toUpperCase()}` : ''}`, steps: [...b.map(e => ({ label: `${e.title} · ${e.dist}m`, state: e.urgent ? 'cur' : '' })), { label: 'J: Patrol Board', state: '' }] };
  };

  // ---------- saving: progress survives a page refresh ----------
  const saveKey = (m = game.mode) => m === 'patrol' ? 'light-off-patrol-v1' : 'light-off-save-v1';
  game.save = () => {
    try {
      const data = {
        v: 1, night: L.night, phase: L.phase,
        story: { homePending: game.story.homePending || null, midMission: game.story.active && !game.story.active.m.day ? game.story.active.m.title : null, index: game.story.progress(), unlocked: Math.max(game.story.unlocked, game.story.saved?.unlocked ?? 0), dayDone: game.story.dayDone, dayUnlocked: game.story.dayUnlocked, recon: game.story.recon, flags: game.story.flags, places: game.story.places },
        respect: game.respect, stats: game.stats,
        life: { items: L.items, wallet: L.wallet, suspicion: L.suspicion, wanted: L.wanted, hunger: L.hunger, energy: L.energy },
        player: { injury: player.injury, hp: player.hp },
        pois: Object.values(DAY.pois as Record<string, any>).filter(q => q.found).map(q => q.id),
        // where he is right now, so a reload puts him back on the street (not at home)
        snap: { x: game.inMall ? game.mallFrom.x : player.pos.x, z: game.inMall ? game.mallFrom.z : player.pos.z, yaw: player.yaw, inside: L.inside, clock: L.clock, suit: L.suit, bag: L.bag, cuffed: !!player.cuffed, heat: game.heat },
      };
      localStorage.setItem(saveKey(), JSON.stringify(data));
    } catch { /* storage unavailable (private window): the game still plays, it just won't remember */ }
  };
  game.restoreSnap = (sn) => {
    if (!sn || sn.inside || game.story.active) return;
    L.clock = sn.clock; L.suit = sn.suit; L.bag = !!sn.bag; player.setOutfit(sn.suit ? OUTFITS.bolaji : OUTFITS.bolajiDay); reattachBag(); updateBackpack();
    L.inside = false; player.respawn(sn.x, sn.z, sn.yaw || 0); camera.snapBehind(sn.yaw || 0);
    player.cuffed = !!sn.cuffed; game.heat = sn.cuffed ? Math.max(1, sn.heat || 0) : 0;
    env.setDaylight(L.daylight()); applyLights(true);
    hud.notice(L.timeStr(), 'Back where you left off.', 'white');
  };
  game.loadSave = (m) => { try { return JSON.parse(localStorage.getItem(saveKey(m)) || 'null'); } catch { return null; } };
  game.clearSave = (m) => { try { localStorage.removeItem(saveKey(m)); } catch { /* ignore */ } };
  game.applySave = (d) => {
    game.pendingResume = d.story?.homePending || null; game.interrupted = !d.story?.homePending && d.story?.midMission;
    L.night = d.night; L.phase = d.phase === 'night' ? 'night' : 'day';
    game.story.index = d.story.index; game.story.unlocked = d.story.unlocked; game.story.dayDone = d.story.dayDone || 0; game.story.dayUnlocked = !!d.story.dayUnlocked; game.story.recon = d.story.recon || {}; game.story.flags = d.story.flags || {}; game.story.places = d.story.places || {};
    game.respect = d.respect; Object.assign(game.stats, d.stats);
    Object.assign(L, d.life); player.injury = d.player.injury; player.hp = Math.max(20, Math.min(player.cap(), d.player.hp));
    for (const id of d.pois || []) if (DAY.pois[id]) DAY.pois[id].found = true;
  };

  game.hudInfo = () => ({
    respect: game.respect, holding: player.holding ? (player.holding.kind === 'sachet' ? 'PURE WATER' : player.holding.kind.toUpperCase()) : null, boardLost: player.boardLost,
    hp: player.hp, cap: player.cap(), cuffed: player.cuffed, sweep: combat.sweepReady(), flurry: combat.flurryReady(), charge: player.charge, label: L.label(), inside: L.inside, noise: L.noise, suspicion: L.suspicion, suit: L.suit, critical: player.mode === 'crawl', downT: player.mode === 'down' ? player.downT : -1, aiming: player.aiming, combo: combat.combo, clock: L.timeStr(), night: L.night,
    hunger: L.hunger, energy: L.energy, wallet: L.wallet, wanted: L.wanted, followed: L.followers().length > 0, watched: L.watched(),
  });
  return game;
}
