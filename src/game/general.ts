// The General's war on Lagos, and Bolaji's case against him.
//
// World (Story and Patrol): the General's boys in black (machetes, knives, an AK) turn up and terrorise
// a street; "one chance" danfos rob their passengers; pickpockets work the crowds. By day every one of
// these costs Bolaji parcel time. By night, in black, the police can't tell him from the General's boys.
//
// The case (Story only): six chapters that unlock as days and nights pass. Leads from the street and
// from his deliveries lead to a warehouse, a payroll ledger, a crooked inspector, an arms shipment at
// Marina, and the General himself. It always continues where you left off; there is no level select.
import * as THREE from 'three';
import { OUTFITS } from '../player/rig.ts';
import { Civilian } from './npcs.ts';
import { roadLine } from '../world/layout.ts';
import { FLY } from '../world/city.ts';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const HAVOC = ['Oya! Everybody bring money! General say make una pay!', 'You dey look? Face down!', 'This street na our own now.', 'Who send you? Comot!'];
const VICTIM = ['Abeg! Abeg! Take everything!', 'Help! Somebody help!', 'Na my whole week sales be this!'];
const LEADS: Record<string, string> = {
  phone: 'A burner phone from one of the boys in black. A message: "General say make una finish Adelabu tonight."',
  receipt: 'A delivery receipt stamped G.S. HOLDINGS, with a gold eagle on a beret. Ladipo warehouse.',
  ledger: 'The payroll ledger: "Insp. Okafor (Ojuelegba) ₦500,000 monthly", six more officers, and a column: "Red Caps levy, 40% to G.S." The Red Caps are his street arm.',
  meeting: 'Okafor, overheard under the bridge: "The shipment lands at Marina jetty. General wan see am himself."',
  photos: 'Photos of AK-47 crates at Marina jetty, stamped G.S. HOLDINGS.',
  general: 'The General: Colonel (rtd) Gbenga Sowande. G.S. Holdings is his.',
};

export function createGeneral(game) {
  const { hud, audio, player, world, scene } = game;
  const L = game.life, api = game.api;
  const G: any = { squad: null, squadCd: 70 + Math.random() * 50, oc: null, ocCd: 160 + Math.random() * 80, pp: null, ppCd: 60 + Math.random() * 40 };
  const near = (a, b, r) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r * r;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const story = () => game.mode === 'patrol' && game.sub === 'story';
  const busy = () => L.inside || game.inMall || game.ferry?.ride || player.mode === 'ride' || player.cuffed || game.arrest || G.case.on;

  // ---- spawning helpers ----
  const boy = (x, z, yaw, weapon = pick(['machete', 'knife', 'knife', 'stick'])) => { const t = api.thug({ x, z, yaw, variant: 'gboy', weapon, role: 'guard' }); t.calm = true; t.gboy = true; return t; };
  const ak = (x, z, yaw) => { const g = api.gunman({ x, z, yaw, role: 'hitman', outfit: OUTFITS.gboy, post: { x, z, yaw, cp: { stopped: null } } }); g.name = 'Boy in black'; g.gboy = true; return g; };
  const wake = (grp) => { for (const t of grp.boys) if (t.alive) { t.calm = false; t.engage(0.3 + Math.random() * 0.6); } for (const g of grp.guns) if (g.alive && g.state === 'post') g.state = 'chase'; };
  const alive = (grp) => grp.boys.filter(t => t.alive).length + grp.guns.filter(g => g.alive && !g.removed).length;
  const clear = (grp) => { for (const t of grp.boys) if (t.alive) t.remove(); for (const g of grp.guns) if (!g.removed) g.remove(); };
  const gang = (x, z, n, guns) => {
    const grp = { boys: [], guns: [], x, z };
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; grp.boys.push(boy(x + Math.sin(a) * 2.6, z + Math.cos(a) * 2.6, a + Math.PI)); }
    for (let k = 0; k < guns; k++) { const a = Math.random() * 6.3; grp.guns.push(ak(x + Math.sin(a) * 7, z + Math.cos(a) * 7, a + Math.PI)); }
    return grp;
  };
  const lead = (id) => { if (G.case.leads.includes(id)) return; G.case.leads.push(id); hud.toast(`🗂 <b>New lead.</b> ${LEADS[id]}${story() ? '' : '<br><small>J: job sheet → case file</small>'}`, 'blue'); audio.pickup(); };

  // ---- the boys in black: a street held to ransom ----
  function startSquad() {
    const sp = api.spot(50, 120); if (!sp) return;
    const v = api.victim({ x: sp.x, z: sp.z, yaw: Math.atan2(sp.nx, sp.nz), mood: 'cower' }); v.name = pick(['Mama Kemi', 'Alhaji Sani', 'Uncle Tayo', 'Chioma', 'Mr. Okon']);
    const grp = gang(sp.x + sp.nx * 1.2, sp.z + sp.nz * 1.2, 3, L.phase === 'day' ? 0 : 1); // three boys, one gun at night: a fight, not a massacre
    G.squad = { ...grp, v, t: 0, woke: false, area: world.areaAt(sp.x, sp.z), lineT: 2 };
    hud.notice('MEN IN BLACK', `${G.squad.area}: the General's boys are terrorising ${v.name}'s shop.${L.suit ? '' : ' They leave a rider alone: step in, or keep your head down and walk past.'}`, 'red');
    game.radio?.say(`Caller from ${G.squad.area}: "Boys in black don block our street! Dem get gun! Police no dey come!"`);
    audio.alert();
  }
  function updateSquad(dt) {
    const S = G.squad;
    if (!S) { G.squadCd -= dt * (L.phase === 'day' ? 0.45 : 1); if (G.squadCd <= 0 && !busy() && !player.fightingNear && !game.activities?.anyActive?.()) { G.squadCd = 160 + Math.random() * 120; startSquad(); } return; }
    S.t += dt; S.lineT -= dt;
    const d = dist(S, player.pos);
    if (S.lineT <= 0 && d < 30 && !S.woke) { S.lineT = 4; if (Math.random() < 0.6) hud.say('Boy in black', pick(HAVOC), 2.8); else hud.say(S.v.name, pick(VICTIM), 2.8); }
    // what sets them off: a hit on one of them, or the suit. A rider in uniform is nobody to them: walking
    // past gets him told to move along, and only hanging about within arm's reach starts a fight
    const provoked = !S.cops && (S.boys.some(t => t.alive && t.engaged) || S.boys.some(t => !t.alive) || S.guns.some(g => !g.alive)); // once the police are in, they're the ones it's with
    if (!L.suit && !S.woke) {
      if (d < 10 && !S.warned) { S.warned = true; hud.say('Boy in black', pick(['Rider, comot for here! Dis one no concern you.', 'Face your delivery, rider. Waka pass!', 'You no see wetin dey happen? Commot before e reach you!']), 3); }
      S.nearT = d < 3.2 ? (S.nearT || 0) + dt : 0;
      if (S.nearT > 1.2 && !S.warned2) { S.warned2 = true; hud.say('Boy in black', 'I say commot! Last warning!', 2.4); }
    }
    if (!S.woke && (provoked || (L.suit && d < 9) || (S.nearT || 0) > 2.8)) {
      S.woke = true; S.byPlayer = true; wake(S); hud.say('Boy in black', L.suit ? 'Who be this one wey dress like us?! Finish am!' : 'Rider, you wan die? Oya!', 3);
    }
    if (S.woke && d < 6) S.byPlayer = true; // in the thick of it: whoever finishes it, he helped
    law(S, dt);
    if (S.woke && alive(S) === 0 && !S.byPlayer) { // the police (or the army) cleared the street without him
      S.v.mood = 'idle'; hud.say(S.v.name, S.army ? pick(['Soldiers! God bless Nigeria Army!', 'Na the army finally come!']) : pick(['Thank God for police today!', 'Officer, God bless you!']), 3.5);
      if (d < 120) hud.toast(`${S.army ? 'Soldiers' : 'The police'} cleared the General's boys off ${S.area}.`, 'blue');
      standDown(S); setTimeout(() => S.v.gone || S.v.runHome(S.v.pos.x + 30, S.v.pos.z), 4000); G.squad = null; return;
    }
    if (S.woke && alive(S) === 0) {
      standDown(S);
      S.v.mood = 'idle'; S.v.faceTarget = player.pos; hud.say(S.v.name, pick(['God bless you!', 'Who are you?! Thank you!', 'Those boys... they say na General send them.']), 3.5);
      const tip = 1000 + Math.floor(Math.random() * 4) * 500; L.wallet += tip; hud.toast(`${S.v.name} pressed <b>₦${tip}</b> into your hand.`, 'green'); game.addRespect(400, 'BOYS IN BLACK DOWN');
      if (story() && !G.case.leads.includes('phone') && G.case.ch >= 1) lead('phone');
      setTimeout(() => S.v.gone || S.v.runHome(S.v.pos.x + 30, S.v.pos.z), 4000); G.squad = null; return;
    }
    if ((S.t > 150 && d > 90) || S.t > 300) { clear(S); standDown(S, true); if (!S.v.gone) S.v.runHome(S.v.pos.x + 30, S.v.pos.z); G.squad = null; }
  }

  // ---- the law: the police come for the General's boys, and the army when the police can't hold them ----
  // Somebody always calls: the police arrive after a while (slower at night) and fight the boys; if the
  // boys are too much for them (officers down, or guns at night) soldiers are sent: tougher, quicker on
  // the trigger, rarely miss. In the suit Bolaji looks like one more boy in black to all of them.
  const nearestOf = (list, pos) => { let b = null, bd = Infinity; for (const q of list) { const dd = (q.pos.x - pos.x) ** 2 + (q.pos.z - pos.z) ** 2; if (dd < bd) { bd = dd; b = q; } } return b; };
  const arrival = (S, r0, r1) => { // a street spot near the squad, toward the edge of the action
    const c = world.spots.filter(q => { const dd = Math.hypot(q.x - S.x, q.z - S.z); return dd > r0 && dd < r1; });
    const q = c[Math.floor(Math.random() * c.length)]; return q ? { x: q.x + q.nx * 2, z: q.z + q.nz * 2 } : { x: S.x + r0, z: S.z };
  };
  function callPolice(S) {
    const a = arrival(S, 26, 42); S.cops = [];
    for (let k = 0; k < 2; k++) { const g = api.gunman({ x: a.x + k * 1.4, z: a.z, yaw: Math.atan2(S.x - a.x, S.z - a.z), role: 'police' }); g.duty = true; g.name = 'Police'; S.cops.push(g); }
    S.lawT = 0; game.radio?.say(`Police radio: "All units, armed boys in black at ${S.area}. Move!"`, true);
    if (dist(S, player.pos) < 150) { hud.notice('POLICE ON THE SCENE', `Officers are going in after the General's boys at ${S.area}.`, 'blue', 3); game.say(S.cops[0], 'Police! Drop your weapons! Everybody down!', 'Police', 60); }
    if (!S.woke) { S.woke = true; wake(S); }
  }
  function callArmy(S) {
    S.armyCalled = true; S.armyT = 7;
    game.radio?.say(`Police radio: "We're outgunned at ${S.area}. Requesting army support!"`, true);
    if (dist(S, player.pos) < 150) hud.notice('SOLDIERS ON THE WAY', `The police can't hold ${S.area}. The army is coming in.`, 'red', 3.5);
  }
  function sendArmy(S) {
    const a = arrival(S, 30, 48); S.army = [];
    for (let k = 0; k < 4; k++) {
      const g = api.gunman({ x: a.x + (k % 2) * 1.6, z: a.z + Math.floor(k / 2) * 1.6, yaw: Math.atan2(S.x - a.x, S.z - a.z), role: 'police', outfit: OUTFITS.soldier });
      g.duty = true; g.soldier = true; g.name = 'Soldier'; g.maxHp = g.hp = 7; g.aimTime = 0.8; g.shootCd = 0.6; S.army.push(g);
    }
    game.say(S.army[0], pick(['Army! Nobody move!', 'Drop am! Drop am now!', 'Clear the street! Go, go!']), 'Soldier', 70); audio.alert();
  }
  function law(S, dt) {
    if (!S.cops) { S.callT = (S.callT ?? (L.phase === 'day' ? 20 : 35)) - dt; if (S.callT <= 0) callPolice(S); return; }
    S.lawT += dt;
    if (S.armyT > 0) { S.armyT -= dt; if (S.armyT <= 0) sendArmy(S); }
    const boys = [...S.boys.filter(t => t.alive), ...S.guns.filter(g => g.alive && !g.removed)];
    const lawmen = [...S.cops, ...(S.army || [])].filter(g => g.alive && !g.removed);
    for (const g of [...S.cops, ...(S.army || [])]) g.foe = boys.length ? nearestOf(boys, g.pos) : null;
    for (const t of boys) {
      const o = nearestOf(lawmen, t.pos), dp = dist(t.pos, player.pos);
      // he's in it with them (or in the suit) and closer than any officer: they stay on him
      t.foe = o && !((S.byPlayer || L.suit) && dp < dist(t.pos, o.pos)) ? o : null;
      if (t.foe && t.calm !== undefined && t.calm) { t.calm = false; t.engage?.(0.3); }
      if (t.foe && t.state === 'post') t.state = 'chase';
    }
    // too much for them: officers down, guns at night, or still three boys standing after a long fight
    const copsUp = S.cops.filter(g => g.alive).length;
    if (!S.armyCalled && boys.length && S.lawT > 6 && (copsUp === 0 || (S.guns.some(g => g.alive) && S.lawT > 12) || (boys.length >= 3 && S.lawT > 25) || S.lawT > 40)) callArmy(S);
    // the suit: to the police and the army he's one more of them
    if (L.suit && !S.suitSeen && lawmen.some(g => dist(g.pos, player.pos) < 16)) { S.suitSeen = true; game.addHeat?.(1, `${S.army ? 'Soldier' : 'Police'}: "Another one in black! Him too!"`); }
  }
  // when it's over: the police and soldiers hang about, then go
  G.leaving = [];
  function standDown(S, now = false) {
    for (const g of [...(S.cops || []), ...(S.army || [])]) { if (g.removed) continue; g.foe = null; if (now) g.remove(); else G.leaving.push({ g, t: game.time + 12 }); }
    for (const t of S.boys) t.foe = null;
  }
  function updateLeaving() {
    G.leaving = G.leaving.filter(q => { if (q.g.removed) return false; if (game.time > q.t && (dist(q.g.pos, player.pos) > 40 || game.time > q.t + 30)) { q.g.remove(); return false; } return true; });
  }

  // ---- one chance: a danfo that robs its own passengers ----
  function startOneChance() {
    const sp = api.spot(30, 70); if (!sp) return;
    const car = game.traffic.spawnGetaway(sp.x + sp.nx * 5, sp.z + sp.nz * 5, Math.atan2(-sp.nz, sp.nx), 'danfo'); car.ai.topSpeed = 11; car.ai.health = 4; car.ai.maxHealth = 4;
    G.oc = { car, stage: 'chase', lost: 0, crew: [], victim: null, sp };
    hud.notice('ONE CHANCE!', 'A woman is screaming inside that danfo. They\'re robbing the passengers. Catch it, grab on (E), smash it (F)!', 'red'); audio.alert();
    hud.say('Woman (in the danfo)', 'Help! One chance! Dem don collect my bag!', 3);
  }
  function updateOneChance(dt) {
    const O = G.oc;
    if (!O) { G.ocCd -= dt * (L.phase === 'day' ? 1 : 0.4); if (G.ocCd <= 0 && !busy() && !player.fightingNear && !game.activities?.anyActive?.() && !G.squad) { G.ocCd = 260 + Math.random() * 160; startOneChance(); } return; }
    if (O.stage === 'chase') {
      O.lost = dist(O.car.pos, player.pos) < 150 ? 0 : O.lost + dt;
      if (O.lost > 14) { hud.toast('The one chance danfo got away.', 'red'); setTimeout(() => game.traffic.remove(O.car), 15000); G.oc = null; return; }
      if (O.car.ai.stopped) {
        O.stage = 'fight';
        for (const k of [-1, 1]) O.crew.push(api.gunman({ x: O.car.pos.x + O.car.rt.x * k * 1.8, z: O.car.pos.z + O.car.rt.z * k * 1.8, yaw: O.car.yaw, role: 'thief' }));
        O.victim = api.victim({ x: O.car.pos.x - O.car.rt.x * 2.4, z: O.car.pos.z - O.car.rt.z * 2.4, yaw: 0, mood: 'cower' }); O.victim.name = pick(['Aunty Bisi', 'Blessing', 'Mrs. Adeyemi']);
        api.giveItem(O.crew[0], { label: `${O.victim.name}'s bag`, amount: 15000 + Math.floor(Math.random() * 4) * 5000, owner: O.victim });
        hud.popup('THE ROBBERS JUMP OUT');
      }
    } else {
      const out = game.carrying?.owner === O.victim || game.dropped?.item.owner === O.victim || O.crew.some(g => g.alive && g.item);
      if (!out || O.crew.every(g => !g.alive || g.removed) && !game.carrying && !game.dropped) { setTimeout(() => game.traffic.remove(O.car), 15000); G.oc = null; }
    }
  }

  // ---- pickpockets in the crowd (daytime) ----
  function startPick() {
    const sp = api.spot(14, 30); if (!sp) return;
    const v = api.victim({ x: sp.x, z: sp.z, yaw: Math.atan2(sp.nx, sp.nz), mood: 'idle' }); v.name = pick(['Iya Basira', 'Mr. Emeka', 'Aunty Ronke', 'Baba Sule']);
    const t = api.thug({ x: sp.x - sp.nz * 1.2, z: sp.z + sp.nx * 1.2, variant: 'agbero2', role: 'guard' });
    t.hp = t.maxHp = 2; t.state = 'run'; t.t = 0; t.runSpeed = 3.1; // walking off casually
    const dir = Math.random() < 0.5 ? 1 : -1; t.runTo = { x: sp.x - sp.nz * 90 * dir, z: sp.z + sp.nx * 90 * dir };
    api.giveItem(t, { label: `${v.name}'s wallet`, amount: 4000 + Math.floor(Math.random() * 6) * 1000, owner: v });
    G.pp = { t, v, time: 0, shouted: false };
    hud.toast('👀 That man just slipped a hand into someone\'s pocket. <b>Pickpocket</b>: tackle him (F) before he disappears.', 'blue');
  }
  function updatePick(dt) {
    const P = G.pp;
    if (!P) { G.ppCd -= dt; if (G.ppCd <= 0 && L.phase === 'day' && !busy() && !player.fightingNear && !game.carrying && !game.activities?.anyActive?.()) { G.ppCd = 140 + Math.random() * 100; startPick(); } return; }
    P.time += dt;
    if (!P.shouted && P.time > 4) { P.shouted = true; P.v.mood = 'wave'; hud.say(P.v.name, 'My wallet! Ole! Who touch my pocket?!', 3); P.t.runSpeed = 6; }
    if (P.t.escaped) { hud.toast(`The pickpocket got away with ${P.v.name}'s wallet.`, 'red'); P.v.runHome(P.v.pos.x + 20, P.v.pos.z); G.pp = null; return; }
    const out = game.carrying?.owner === P.v || game.dropped?.item.owner === P.v || (P.t.alive && P.t.item);
    if (!out && P.time > 1) G.pp = null;
  }

  // ======================= THE MISSIONS (Missions mode only) =======================
  // Ten missions, in order (docs/story-bible.md), played one after another from the mission list: each drops
  // Bolaji at its start at the right time, in the right clothes. Some steps run against a clock; failing
  // any of them goes to the retry card.
  G.case = { ch: 0, st: 0, leads: [], on: false, entered: false, data: {} };
  const C = G.case;
  const ladipo = () => { const t = { x: -400, z: 60 }; return world.spots.slice().sort((a, b) => dist(a, t) - dist(b, t))[0]; };
  const cp0 = () => game.police.list[0];
  const meet = () => ({ x: FLY.x - 4, z: roadLine(2) });
  const jetty = () => game.ferry.jetties[1];
  const compound = { x: 140, z: -1400 };
  const hall = { x: 27, z: -1388 };
  // day missions start a little way down the street from SwiftDrop (F at the door itself clocks you in)
  const office = () => { const o = game.job.office; return (C.officeSpot ||= world.spots.filter(q => { const d = dist(q, o); return d > 12 && d < 30; }).sort((a, b) => dist(a, o) - dist(b, o))[0] || { x: o.x + 14, z: o.z }); };
  const stadium = () => world.stadiumGate || world.stadium;
  const tailor = () => game.day?.pois?.tailor;
  const none = { boys: [], guns: [] };
  const gate1 = () => { const m = world.marketSpot; return { x: m.x + m.nx * 6, z: m.z + m.nz * 6 }; };
  const cpSpot = () => (C.cpSpot ||= world.spots.filter(q => { const d = dist(q, cp0()); return d > 40 && d < 70; }).sort((a, b) => dist(a, cp0()) - dist(b, cp0()))[0] || cp0());
  const startNear = (t, a = 160, b = 240) => world.spots.filter(q => { const d = dist(q, t()); return d > a && d < b; }).sort((x, y) => dist(x, t()) - dist(y, t()))[0] || t();
  const talk = (lines, at) => api.scene(lines, at ? { x: at.x, y: 0, z: at.z } : null, null, '');
  const moment = (kicker, title) => game.moment?.(kicker, title);
  // a lookout notices him when he's close and in front of him (from behind, he can be taken quietly)
  const spots = (t, r) => { const dx = player.pos.x - t.pos.x, dz = player.pos.z - t.pos.z, d = Math.hypot(dx, dz); return d < r && (Math.sin(t.yaw) * dx + Math.cos(t.yaw) * dz) / (d || 1) > 0.2; };
  const runner = (x, z, variant = 'agbero2', from = player.pos) => { const away = world.spots.filter(q => dist(q, from) > 130 && dist(q, from) < 180)[0] || { x: x + 140, z }; const t = keep(api.thug({ x, z, yaw: 0, variant, role: 'guard' })); t.calm = true; t.hp = t.maxHp = 3; t.state = 'run'; t.t = 0; t.runSpeed = 6.4; t.runTo = { x: away.x, z: away.z }; return t; };
  const transformerNear = (q) => world.transformers.slice().sort((a, b) => dist(a, q) - dist(b, q))[0];
  const keep = (e: any, name?) => { if (name) e.name = name; (C.data.extra ||= []).push(e); return e; }; // removed when the mission ends
  const gone = (list) => (list || []).every(g => !g.alive || g.removed);
  const MISSIONS: any[] = [
    { title: 'Men in Black', time: 'night', start: () => (C.m1Start ||= world.spots.filter(q => { const d = dist(q, world.marketSpot); return d > 170 && d < 240; }).sort((a, b) => dist(a, world.marketSpot) - dist(b, world.marketSpot))[0] || world.marketSpot),
      brief: 'The General\'s boys are burning Adelabu Market. Iya Basira is screaming down the phone: they\'ve tied the traders to their own stalls.',
      steps: [
        { label: 'Get to Adelabu Market', limit: 90, late: 'Too late. By the time you got there, Adelabu Market was ash.', where: () => gate1(),
          enter: () => game.radio?.say('Caller from Adelabu: "Fire! Men in black don tie the traders for inside! Police no dey come!"', true),
          done: () => near(player.pos, gate1(), 14) },
        { label: 'Break through the boys at the gate', where: () => gate1(),
          enter: () => { const g = gate1(); C.data.g = gang(g.x, g.z, 3, 0); wake(C.data.g); talk([{ who: 'Bolaji', text: '(at the market gate) Smoke over the stalls. Three of them on the gate, laughing.' }, { who: 'Boy in black', text: 'Who be you? Una see am? Na one of us?!' }], g); },
          done: () => alive(C.data.g) === 0 },
        { label: 'Free the traders tied to the stalls', limit: 150, late: 'The fire reached the stalls before you could get everyone out.', where: () => C.data.tied?.find(c => c.mood === 'captive')?.pos || world.marketSpot,
          enter: () => {
            const ms = world.marketSpot, stalls = world.stalls.filter(q => dist(q, ms) < 34 && dist(q, ms) > 6).sort(() => Math.random() - 0.5).slice(0, 3);
            C.data.tied = stalls.map((q, k) => keep(api.victim({ x: q.x, z: q.z + 1.3, yaw: Math.PI, mood: 'captive' }), ['Iya Basira', 'Mama Kemi', 'Alhaji Sani'][k]));
            C.data.watch = stalls.slice(0, 2).map(q => { const t = keep(boy(q.x + 2.5, q.z + 2, 0)); t.patrol = [[q.x - 6, q.z + 2.5], [q.x + 6, q.z + 2.5]]; return t; });
            hud.say('Iya Basira', 'Over here! Untie us before the fire comes!', 3.5);
          },
          tick: () => { for (const t of C.data.watch) if (t.alive && t.calm && dist(t.pos, player.pos) < 7) { t.calm = false; t.engage(0.3); } },
          done: () => C.data.tied.every(c => c.mood !== 'captive'),
          count: () => `${C.data.tied?.filter(c => c.mood !== 'captive').length || 0}/3` },
        { label: 'Their backup is here: fight them off', where: () => C.data.g2 ? { x: C.data.g2.x, z: C.data.g2.z } : null,
          enter: () => { const ms = world.marketSpot, q = world.spots.filter(s2 => { const d = dist(s2, ms); return d > 25 && d < 45; })[0] || gate1(); C.data.g2 = gang(q.x, q.z, 4, 1); wake(C.data.g2); for (const t of C.data.watch) if (t.alive) { t.calm = false; t.engage(0.2); } moment('BACKUP', 'They called for help'); hud.say('Squad leader', 'Na only one man?! Finish am!', 3); },
          done: () => alive(C.data.g2) === 0 && C.data.watch.every(t => !t.alive) },
        { label: 'The squad leader is running: catch him', where: () => C.data.boss?.alive ? C.data.boss.pos : null,
          enter: () => { const ms = world.marketSpot, away = world.spots.filter(q => dist(q, ms) > 150 && dist(q, ms) < 200)[0] || { x: ms.x + 160, z: ms.z };
            const b = keep(boy(ms.x + 4, ms.z - 6, 0, 'machete')); b.name = 'Squad leader'; b.hp = b.maxHp = 6; b.calm = true; b.state = 'run'; b.t = 0; b.runSpeed = 6.6; b.runTo = { x: away.x, z: away.z }; C.data.boss = b;
            moment('HE\'S RUNNING', 'Catch the squad leader'); hud.say('Squad leader', 'Commot! The General go hear this one!', 3); },
          tick: () => { if (C.data.boss?.escaped) fail('The squad leader got away, and the phone with him.'); },
          done: () => C.data.boss && !C.data.boss.alive && !C.data.boss.escaped },
        { label: 'Take his phone (F)', where: () => C.data.boss?.pos, use: 'phone', done: () => C.data.used === 'phone' },
        { label: 'The police think you\'re one of them: lose them', where: () => null, enter: () => { api.addHeat(2, 'Police: "One of the men in black! Na him dey lead them!"'); lead('phone'); }, done: () => game.heat === 0 },
      ] },
    { title: 'The Address', time: 'day', start: office,
      brief: 'The burner phone had an address saved: G.S. Holdings, Ladipo. Today a parcel for that address is on the SwiftDrop sheet.',
      steps: [
        { label: 'Collect the sealed crate from the dispatcher (F)', where: () => game.job.office, use: 'crate',
          enter: () => hud.say('SwiftDrop dispatcher', 'Special one today: sealed crate, G.S. Holdings, Ladipo. Don\'t drop am, don\'t open am.', 4), done: () => C.data.used === 'crate' },
        { label: 'Take the crate towards Ladipo', where: () => ladipo(), enter: () => { C.data.half = dist(player.pos, ladipo()) * 0.55; }, done: () => dist(player.pos, ladipo()) < C.data.half },
        { label: 'A boy snatched the crate: catch him', where: () => C.data.thief?.alive ? C.data.thief.pos : null,
          enter: () => { const q = player.pos; C.data.thief = runner(q.x + 2, q.z + 2, 'agbero2'); C.data.thief.name = 'Crate thief'; moment('SNATCHED', 'Catch him'); hud.say('Crate thief', 'Thank you o, rider!', 2.5); },
          tick: () => { if (C.data.thief?.escaped) fail('He got away with the crate. G.S. Holdings never got it, and neither did you.'); },
          done: () => C.data.thief && !C.data.thief.alive && !C.data.thief.escaped },
        { label: 'Pick the crate up (F)', where: () => C.data.thief?.pos, use: 'crate', enter: () => { C.data.used = null; }, done: () => C.data.used === 'crate' },
        { label: 'Deliver it to G.S. Holdings in Ladipo', limit: 240, late: 'Too late. Dispatch gave the job to another rider, and the address went with it.', where: () => ladipo(), done: () => near(player.pos, ladipo(), 14) },
        { label: 'Hand the crate over at the gate (F)', where: () => ladipo(), use: 'handover2',
          enter: () => { const q = ladipo(); C.data.door = [-1, 1].map(k => keep(boy(q.x - q.nx * 2 - q.nz * 2 * k, q.z - q.nz * 2 + q.nx * 2 * k, Math.atan2(q.nx, q.nz))));
            talk([{ who: 'Man in black', text: 'Rider. Wetin you carry?' }, { who: 'Bolaji', text: 'Delivery for G.S. Holdings.' }, { who: 'Man in black', text: 'Drop am for ground. No look inside. Go.' }], q); },
          done: () => C.data.used === 'handover2' },
        { label: 'Look through the open door (stand close, keep still)', where: () => ladipo(), enter: () => { C.data.t = 0; },
          tick: (dt) => { if (near(player.pos, ladipo(), 7) && Math.hypot(player.vel.x, player.vel.z) < 1.5) C.data.t += dt; },
          count: () => `${Math.min(100, Math.round((C.data.t || 0) / 5 * 100))}%`, done: () => C.data.t > 5 },
        { label: 'They saw you looking: get out of Ladipo', where: () => game.job.office,
          enter: () => { lead('receipt'); hud.toast('Through the door: crates of rifles, men in black counting money. One of them is staring straight at you.', 'blue'); moment('THEY SAW YOU', 'Get out of Ladipo'); for (const t of C.data.door) { t.calm = false; t.engage(0.2); } },
          done: () => dist(player.pos, ladipo()) > 110 || C.data.door.every(t => !t.alive) },
        { label: 'One of them is following you: lose him before SwiftDrop', where: () => C.data.tail?.alive ? C.data.tail.pos : null,
          enter: () => { const t = keep(boy(player.pos.x - 25, player.pos.z - 10, 0, 'knife')); t.calm = true; t.state = 'tail'; C.data.tail = t; moment('FOLLOWED', 'Lose him'); },
          tick: (dt) => { const t = C.data.tail; if (t?.alive) { t.state = 'tail'; const a = Math.atan2(player.pos.x - t.pos.x, player.pos.z - t.pos.z), d = dist(t.pos, player.pos); if (d > 14) { t.pos.x += Math.sin(a) * 5.2 * dt; t.pos.z += Math.cos(a) * 5.2 * dt; } } },
          done: () => !C.data.tail?.alive || dist(C.data.tail.pos, player.pos) > 70 },
        { label: 'Report back at SwiftDrop like nothing happened', where: () => game.job.office, done: () => near(player.pos, game.job.office, 8) },
      ] },
    { title: 'The Warehouse', time: 'night', start: () => (C.s3 ||= startNear(ladipo)),
      brief: 'Back to Ladipo, in black this time. If the General pays people, somebody writes it down.',
      steps: [
        { label: 'Get to the warehouse in Ladipo', where: () => ladipo(), done: () => near(player.pos, ladipo(), 30) },
        { label: 'Kill the lights: pull the fuse on the transformer by the warehouse (F)', where: () => transformerNear(ladipo()),
          enter: () => talk([{ who: 'Bolaji', text: '(across the street, in the dark) Two on the door. If one of them shouts, the whole warehouse comes out. First, the lights.' }], ladipo()),
          done: () => game.power < 0.5 },
        { label: 'Take out the two lookouts before they raise the alarm', where: () => C.data.look?.find(t => t.alive)?.pos || ladipo(),
          enter: () => { const q = ladipo(); C.data.alarm = false;
            C.data.look = [-1, 1].map(k => { const t = keep(boy(q.x - q.nz * 9 * k + q.nx * 3, q.z + q.nx * 9 * k + q.nz * 3, 0)); t.patrol = [[t.pos.x, t.pos.z], [q.x + q.nx * 3, q.z + q.nz * 3]]; return t; });
            hud.say('Boy in black', 'NEPA again! Who get torch?', 3); },
          tick: () => { for (const t of C.data.look) if (t.alive && t.calm && spots(t, 6)) { t.calm = false; t.engage(0.1); }
            if (!C.data.alarm && C.data.look.some(t => t.alive && !t.calm)) { C.data.alarm = true; moment('ALARM', 'The whole warehouse is coming'); } },
          done: () => C.data.look.every(t => !t.alive) },
        { label: 'Clear the warehouse floor', where: () => ladipo(), enter: () => { const q = ladipo(); C.data.g = gang(q.x - q.nx * 3, q.z - q.nz * 3, C.data.alarm ? 6 : 3, C.data.alarm ? 2 : 1); wake(C.data.g); }, done: () => alive(C.data.g) === 0 },
        { label: 'Grab the ledger before they burn it (F at the desk)', limit: 30, late: 'One of them got to the desk first. The ledger went into a drum fire.', where: () => ladipo(), use: 'ledger', done: () => C.data.used === 'ledger' },
        { label: 'They\'ve shut the gate: fight your way out', where: () => ladipo(),
          enter: () => { lead('ledger'); moment('LOCKED IN', 'Fight your way out'); const q = ladipo(); C.data.g2 = gang(q.x + q.nx * 9, q.z + q.nz * 9, 4, 1); wake(C.data.g2); },
          done: () => alive(C.data.g2) === 0 || dist(player.pos, ladipo()) > 60 },
        { label: 'Get away from the police', where: () => null, enter: () => api.addHeat(2, 'Sirens everywhere. The warehouse was paying them to watch it.'), done: () => game.heat === 0 },
        { label: 'Hide the ledger at home', where: () => world.homeDoor, done: () => near(player.pos, world.homeDoor, 6) },
      ] },
    // the marker is round the corner from the checkpoint: walking up to the police in the suit starts a chase
    { title: 'Okafor', time: 'night', start: () => (C.s4 ||= startNear(cpSpot, 120, 200)),
      brief: 'Inspector Okafor runs the Ojuelegba checkpoint, and he\'s first on the General\'s payroll. Tonight he leaves his post. Follow him. Don\'t let him see you.',
      steps: [
        { label: 'Get round the corner from the Ojuelegba checkpoint', where: cpSpot, done: () => near(player.pos, cpSpot(), 12) },
        { label: 'Watch the checkpoint until Okafor moves', where: cpSpot, enter: () => { C.data.t = 0; talk([{ who: 'Bolaji', text: '(round the corner) Okafor. Red beret. When he leaves his post, I follow him.' }], cp0()); },
          tick: (dt) => { C.data.t += dt; }, done: () => C.data.t > 4 },
        { label: 'Tail Okafor: stay close, but not within 8 m', where: () => C.data.ok?.pos, enter: () => {
          const c = cp0(); const ok = new Civilian(scene, world, { x: c.x + 6, z: c.z, yaw: 0, outfit: OUTFITS.police }); ok.name = 'Insp. Okafor'; game.civilians.push(ok); keep(ok);
          C.data.ok = ok; C.data.path = [{ x: c.x, z: (c.z + meet().z) / 2 }, { x: c.x, z: meet().z }, meet()]; C.data.pi = 0; C.data.far = 0; C.data.look = 0; hud.say('Insp. Okafor', 'Hold the post. I dey come.', 3); },
          tick: (dt) => { const ok = C.data.ok; if (!ok || ok.gone) return; const d = dist(ok.pos, player.pos);
            if (C.data.look > 0) { // he stops and looks back down the street: be out of his sight
              C.data.look -= dt; ok.mood = 'idle'; ok.faceTarget = player.pos; // he turns first: a second to get out of sight
              if (C.data.look < 2.3 && d < 30 && !world.collision.blocked(ok.pos.x, 1.6, ok.pos.z, player.pos.x, player.pos.y + 1.2, player.pos.z, 1.2)) { hud.say('Insp. Okafor', 'Who dey follow me?!', 3); fail('Okafor looked back and saw you.'); }
              return; }
            const tgt = C.data.path[C.data.pi]; if (!tgt) { ok.mood = 'idle'; return; } ok.runTo = tgt; ok.mood = 'run'; ok.runT = 0;
            if (near(ok.pos, tgt, 1.5)) { C.data.pi++; if (C.data.pi === 1) { C.data.look = 3.5; moment('HE\'S LOOKING BACK', 'Get out of his sight'); } }
            if (d < 8) { hud.say('Insp. Okafor', 'Who dey follow me?!', 3); fail('Okafor saw you.'); return; }
            C.data.far = d > 60 ? C.data.far + dt : 0; if (C.data.far > 8) fail('You lost Okafor.'); },
          done: () => C.data.ok && C.data.pi >= C.data.path.length },
        { label: 'Listen in (stay unseen, within 18 m)', where: () => meet(), enter: () => { const m = meet(); C.data.g = gang(m.x + 3, m.z, 2, 0); C.data.t = 0; }, tick: (dt) => { if (near(player.pos, meet(), 18)) { C.data.t += dt; if (C.data.t > 1 && C.data.t < 1 + dt * 1.5) hud.say('Insp. Okafor', 'Tell General: the Marina jetty is clear. My boys no go dey there.', 4); if (C.data.t > 5.5 && C.data.t < 5.5 + dt * 1.5) hud.say('Boy in black', 'And that rider wey see the crates for Ladipo? We go carry am tomorrow.', 4); } }, done: () => C.data.t > 10 },
        { label: 'A boy in black spotted you: deal with them', where: () => meet(), enter: () => { lead('meeting'); moment('SPOTTED', 'Deal with them'); const m = meet(); C.data.g2 = gang(m.x - 4, m.z + 6, 3, 0); wake(C.data.g2); wake(C.data.g); hud.say('Boy in black', 'Na the cat! Hold am!', 3); },
          done: () => alive(C.data.g2) === 0 && alive(C.data.g) === 0 },
        { label: 'Slip away before Okafor\'s men come', where: () => null, enter: () => { C.data.t = 0; }, tick: (dt) => { C.data.t += dt; }, done: () => C.data.t > 4 && dist(player.pos, meet()) > 50 },
        { label: 'They\'re going after a rider: get to SwiftDrop and warn Tunde', limit: 150, late: 'By the time you got there, Tunde had gone home. Tomorrow, they come for him.', where: () => game.job.office,
          done: () => near(player.pos, game.job.office, 10), enter: () => hud.say('Bolaji', '(to himself) The rider who saw the crates. Tunde.', 3) },
      ] },
    { title: 'One Chance', time: 'day', start: office,
      brief: 'Tunde, a SwiftDrop rider who saw the crates at Ladipo, is calling you. He thinks someone is following him.',
      steps: [
        { label: 'Tunde is in trouble: get to him on the Ojuelegba road', where: () => (C.s5 ||= startNear(office, 120, 180)),
          enter: () => hud.say('Tunde (on the phone)', 'Bolaji! One danfo don dey follow me since morning. Na the men from Ladipo, I sure. I dey Ojuelegba road. Come quick!', 5),
          done: () => near(player.pos, C.s5, 16) },
        { label: 'Catch the one chance danfo: grab on (E), then smash it (F)', where: () => C.data.car?.pos, enter: () => {
          const sp = api.spot(30, 70) || { x: player.pos.x + 40, z: player.pos.z, nx: 1, nz: 0 };
          const car = game.traffic.spawnGetaway(sp.x + sp.nx * 5, sp.z + sp.nz * 5, Math.atan2(-sp.nz, sp.nx), 'danfo'); car.ai.topSpeed = 11; car.ai.health = 4; car.ai.maxHealth = 4;
          C.data.car = car; C.data.lost = 0; moment('ONE CHANCE', 'They took Tunde'); hud.say('Tunde (in the danfo)', 'Bolaji! Na me! Dem don hold me!', 3); },
          tick: (dt) => { const car = C.data.car; if (!car) return; C.data.lost = dist(car.pos, player.pos) < 150 ? 0 : C.data.lost + dt; if (C.data.lost > 14) fail('The danfo got away with Tunde.'); },
          done: () => C.data.car?.ai.stopped },
        { label: 'Beat the crew', where: () => C.data.car?.pos, enter: () => {
          const car = C.data.car; C.data.g = { boys: [...[-1, 1].map(k => boy(car.pos.x + car.rt.x * k * 1.8, car.pos.z + car.rt.z * k * 1.8, car.yaw)), boy(car.pos.x - car.fwd.x * 3, car.pos.z - car.fwd.z * 3, car.yaw)], guns: [] };
          wake(C.data.g); hud.popup('THE CREW JUMPS OUT'); }, // they stand and fight (a crew that ran off left the mission stuck)
          done: () => alive(C.data.g || none) === 0 },
        { label: 'Untie Tunde (F)', where: () => C.data.tunde?.pos, use: 'tunde', enter: () => { const car = C.data.car; const v = keep(api.victim({ x: car.pos.x - car.rt.x * 2.4, z: car.pos.z - car.rt.z * 2.4, yaw: 0, mood: 'cower' })); v.name = 'Tunde'; C.data.tunde = v; }, done: () => C.data.used === 'tunde' },
        { label: 'Search the danfo for what they took from him (F)', where: () => C.data.car?.pos, use: 'danfo', done: () => C.data.used === 'danfo', enter: () => { C.data.used = null; hud.say('Tunde', 'My phone dey inside! I record them for Ladipo!', 3); } },
        { label: 'Their friends are coming for Tunde: hold them off', limit: 90, late: 'They dragged Tunde back into a car while you were busy.', where: () => C.data.tunde?.pos,
          enter: () => { lead('tunde'); hud.say('Tunde', 'They talk am for inside: the shipment land this week. And one "specialist" dey come for Street Cat. Behind you!', 5); moment('BACKUP', 'Protect Tunde'); const t = C.data.tunde.pos; C.data.g2 = gang(t.x + 10, t.z + 6, 3, 0); wake(C.data.g2); },
          done: () => alive(C.data.g2) === 0 },
        { label: 'Walk Tunde back to SwiftDrop', where: () => game.job.office, enter: () => { const o = game.job.office; C.data.tunde.runHome(o.x, o.z); C.data.tunde.runT = -60; }, done: () => near(player.pos, game.job.office, 10) },
      ] },
    { title: 'The Shipment', time: 'night', start: () => ({ x: 40, z: -1209, nx: 0, nz: 1 }),
      brief: 'Marina jetty, Lagos Island. A boat is unloading tonight. Get pictures of what comes off it.',
      steps: [
        { label: 'Get to Marina jetty', where: () => jetty(), done: () => near(player.pos, jetty(), 25) },
        { label: 'Take out the lookouts on the jetty quietly', where: () => C.data.look?.find(t => t.alive)?.pos || jetty(),
          enter: () => { const j = jetty(); C.data.alarm = false; C.data.look = [[-8, 4], [8, -2]].map(([a, b]) => { const t = keep(boy(j.x + a, j.z + b, 0)); t.patrol = [[t.pos.x, t.pos.z], [j.x, j.z - 6]]; return t; });
            talk([{ who: 'Bolaji', text: '(behind the fence) A boat at the jetty. Men passing crates down a line. Two lookouts.' }], j); },
          tick: () => { for (const t of C.data.look) if (t.alive && t.calm && spots(t, 6)) { t.calm = false; t.engage(0.1); }
            if (!C.data.alarm && C.data.look.some(t => t.alive && !t.calm)) { C.data.alarm = true; moment('ALARM', 'They know you\'re here'); } },
          done: () => C.data.look.every(t => !t.alive) },
        { label: 'Fight the shipment guards before the boat is unloaded', limit: 180, late: 'The crates were on the trucks and gone. No pictures, no proof.', where: () => jetty(), enter: () => { const j = jetty(); C.data.g = gang(j.x + 6, j.z - 6, C.data.alarm ? 6 : 4, 2); wake(C.data.g); hud.say('Boy in black', 'Na the one wey dey follow us! Kill am!', 3); }, done: () => alive(C.data.g || none) === 0 },
        { label: 'Photograph the crate stacks (F)', limit: 60, late: 'The last truck pulled out with the crates.', where: () => { const j = jetty(), k = C.data.shots || 0; return k >= 3 ? null : { x: j.x + [-4, 3, 8][k], z: j.z - [8, 10, 4][k] }; }, use: 'photos',
          enter: () => { C.data.shots = 0; }, tick: () => { if (C.data.used === 'photos') { C.data.used = null; C.data.shots++; audio.pickup?.(); } },
          count: () => `${C.data.shots || 0}/3`, done: () => C.data.shots >= 3 },
        { label: 'The truck is leaving with the crates: stop it (hang on with E, smash with F)', where: () => C.data.truck?.pos,
          enter: () => { const j = jetty(); const car = game.traffic.spawnGetaway(j.x + 12, j.z - 14, 0, 'tanker'); car.ai.topSpeed = 10; car.ai.health = 5; car.ai.maxHealth = 5; C.data.truck = car; C.data.car = car; C.data.lost = 0; moment('THE TRUCK', 'Stop it'); },
          tick: (dt) => { const car = C.data.truck; if (!car) return; C.data.lost = dist(car.pos, player.pos) < 150 ? 0 : C.data.lost + dt; if (C.data.lost > 14) fail('The truck got off the island with the rifles.'); },
          done: () => C.data.truck?.ai.stopped },
        { label: 'The General\'s friends in the police are coming: lose them', where: () => null, enter: () => { lead('photos'); moment('SIRENS', 'Lose the police'); api.addHeat(3, 'Police everywhere. The General\'s friends want those photos back.'); }, done: () => game.heat === 0 },
      ] },
    { title: 'The Hunter', time: 'night', start: () => (C.s7 ||= startNear(stadium, 220, 300)),
      brief: 'The General\'s friends in government brought someone in from Japan for Street Cat. He moves like you. He has a sword. Tonight he wants you at the National Stadium.',
      steps: [
        { label: 'Get to the National Stadium', where: stadium,
          enter: () => { const h = game.hunter, sp = world.spots.filter(q => { const d = dist(q, player.pos); return d > 34 && d < 46; })[0] || { x: player.pos.x + 38, z: player.pos.z };
            h.mission = true; h.bar = false; h.start(sp.x, sp.z); C.data.hs = true; C.data.t = 0; },
          tick: (dt) => { C.data.t += dt; if (C.data.t > 5 && !C.data.seen) { C.data.seen = true; moment('SOMEONE IS FOLLOWING YOU', 'Keep moving'); hud.say('The Hunter', 'Keep walking, Street Cat.', 3); } },
          done: () => near(player.pos, stadium(), 30) },
        { label: 'The Hunter: fight him', where: () => game.hunter.active ? game.hunter.pos : null,
          enter: () => { const h = game.hunter, y = player.yaw, x = player.pos.x + Math.sin(y) * 6, z = player.pos.z + Math.cos(y) * 6; // he drops down right in front of you
            h.body.respawn(x, z, y + Math.PI); h.body.pos.y = world.collision.groundHeight(x, z, 40).h;
            talk([{ who: 'The Hunter', text: 'Street Cat. They told me you were a thief.' }, { who: 'The Hunter', text: 'I followed you across this city. I see a rider who fights for market women.' }, { who: 'Bolaji', text: 'Then go home.' }, { who: 'The Hunter', text: 'I don\'t choose who I hunt. And you don\'t choose who you protect.' }], h.pos);
            h.engageNow(); h.bar = true; },
          done: () => game.hunter.phase >= 2 },
        { label: 'He drew his sword: dodge the red attacks (C)', where: () => game.hunter.pos,
          enter: () => { moment('THE SWORD', 'Dodge the red attacks'); hud.say('The Hunter', 'Enough. You earned the blade.', 3);
            api.addHeat(1, 'Somebody called the police: a sword fight at the stadium.'); game.radio?.say('Police radio: "Fight at the National Stadium, one armed with a sword. Arrest both of them."', true); },
          done: () => game.hunter.phase >= 3 },
        { label: 'Finish it', where: () => game.hunter.pos,
          enter: () => { moment('HE\'S DESPERATE', 'Finish it'); hud.say('The Hunter', 'Not like this. Not in the street.', 3); if (game.heat < 2) api.addHeat(2 - game.heat, 'More units on the way to the stadium.'); },
          done: () => game.hunter.state === 'beaten' },
        { label: 'The police want you too: escape', where: () => null,
          enter: () => { const h = game.hunter; h.bar = false; hud.boss?.(null);
            const ax = h.pos.x - player.pos.x, az = h.pos.z - player.pos.z, al = Math.hypot(ax, az) || 1; // they come in on the far side of the Hunter: a head start for you
            C.data.cops = [-1, 1].map(k => api.gunman({ x: h.pos.x + ax / al * 6 - az / al * k * 2, z: h.pos.z + az / al * 6 + ax / al * k * 2, yaw: Math.atan2(-ax, -az), role: 'police' }));
            api.scene([{ who: 'The Hunter', text: '(on one knee) In my country, when a man beats you fairly, you bow.' }, { who: 'The Hunter', text: 'They will send someone worse. Remember my face, Street Cat.' }, { who: 'Bolaji', text: 'Go home.' }, { who: 'Police', text: 'Nobody move! Both of you, on the ground!' }],
              { x: h.pos.x, y: 0, z: h.pos.z }, () => { h.remove(); C.data.cuffed = true; for (const g of C.data.cops) g.stun(1.2); hud.card('In custody', 'The Hunter', 'blue'); moment('THE POLICE', 'Now they want you'); api.addHeat(Math.max(0, 3 - game.heat), 'They cuffed the Hunter. Now every unit is after Street Cat.'); }, 'THE HUNTER'); },
          done: () => C.data.cuffed && game.heat === 0 },
      ] },
    { title: 'A New Skin', time: 'day', start: () => (C.s8 ||= startNear(tailor)),
      brief: 'Sunny the tailor sent a text: "Come see me. I made something for you. No questions."',
      steps: [
        { label: 'Get to Sunny Tailoring', where: tailor, done: () => near(player.pos, tailor(), 10) },
        { label: 'Someone is watching the shop: find him', where: () => C.data.w?.pos,
          enter: () => { const t0 = tailor(), sp = world.spots.filter(q => { const d = dist(q, t0); return d > 18 && d < 30; })[0] || { x: t0.x + 20, z: t0.z }; const w = keep(api.thug({ x: sp.x, z: sp.z, yaw: 0, variant: 'agbero2', role: 'guard' })); w.calm = true; w.name = 'The watcher'; C.data.w = w;
            hud.say('Sunny (tailor)', 'Don\'t look now. The man by the kiosk has been watching my door since morning.', 4.5); },
          done: () => C.data.w && dist(C.data.w.pos, player.pos) < 7 },
        { label: 'He\'s running: catch him before he tells anyone', where: () => C.data.w?.alive ? C.data.w.pos : null,
          enter: () => { const w = C.data.w, away = world.spots.filter(q => dist(q, w.pos) > 140 && dist(q, w.pos) < 190)[0] || { x: w.pos.x + 150, z: w.pos.z }; w.state = 'run'; w.t = 0; w.runSpeed = 6.4; w.runTo = { x: away.x, z: away.z }; moment('HE\'S RUNNING', 'Catch him'); },
          tick: () => { if (C.data.w?.escaped) fail('He got away. Somebody now knows who visits Sunny.'); },
          done: () => C.data.w && !C.data.w.alive && !C.data.w.escaped },
        { label: 'Collect it from Sunny (F)', where: tailor, use: 'panther', enter: () => hud.say('Sunny (tailor)', 'I see wetin happen to the last one. This one... na different thing.', 4), done: () => C.data.used === 'panther' },
        { label: 'Boys in black are at Sunny\'s door: protect him', limit: 90, late: 'They wrecked the shop and took Sunny away.', where: tailor,
          enter: () => { const t0 = tailor(); C.data.g = gang(t0.x + 6, t0.z + 4, 4, 0); wake(C.data.g); moment('THE WATCHER TALKED', 'Protect Sunny'); hud.say('Sunny (tailor)', 'Bolaji! Behind you!', 3); },
          done: () => alive(C.data.g) === 0 },
        { label: 'Take it home before anybody sees the bag', where: () => world.homeDoor, done: () => near(player.pos, world.homeDoor, 6) },
      ],
      finish: () => { game.catSuit = true; L.suitHP = 100; game.refreshFit?.(); hud.notice('THE PANTHER SUIT', 'Matte black, a helmet with eye slits, silver trim, claws.', 'green', 5); } },
    { title: 'Okafor\'s Last Stand', time: 'night', start: () => (C.s9 ||= startNear(meet)),
      brief: 'The General gave the order: finish Street Cat. Okafor and his crooked officers are waiting under Ojuelegba bridge.',
      steps: [
        { label: 'Get to Ojuelegba bridge', where: () => meet(), done: () => near(player.pos, meet(), 25) },
        { label: 'Beat Okafor\'s officers', where: () => meet(), enter: () => { const m = meet(); C.data.crew = [0, 1, 2].map(k => { const g = api.gunman({ x: m.x + (k - 1) * 3, z: m.z + 6, yaw: Math.PI, role: 'hitman', outfit: OUTFITS.police }); g.name = 'Okafor\'s man'; return g; });
          talk([{ who: 'Insp. Okafor', text: 'Na him. No arrest. Finish am.' }], m); }, done: () => gone(C.data.crew) },
        { label: 'More of them: hold your ground', where: () => meet(), enter: () => { const m = meet(); moment('AMBUSH', 'Hold your ground'); C.data.crew2 = [0, 1].map(k => { const g = api.gunman({ x: m.x + (k ? 8 : -8), z: m.z - 6, yaw: 0, role: 'hitman', outfit: OUTFITS.police }); g.name = 'Okafor\'s man'; return g; }); C.data.g = gang(m.x, m.z - 10, 2, 0); wake(C.data.g); },
          done: () => gone(C.data.crew2) && alive(C.data.g) === 0 },
        { label: 'Okafor is running: catch him', where: () => C.data.ok?.alive ? C.data.ok.pos : null,
          enter: () => { const m = meet(), away = world.spots.filter(q => dist(q, m) > 140 && dist(q, m) < 190)[0] || { x: m.x + 150, z: m.z }; const t = keep(api.thug({ x: m.x, z: m.z + 3, yaw: Math.PI, variant: 'police', weapon: 'stick', role: 'guard' }), 'Insp. Okafor'); t.hp = t.maxHp = 10; t.state = 'run'; t.t = 0; t.runSpeed = 6.2; t.runTo = { x: away.x, z: away.z }; C.data.ok = t; moment('HE\'S RUNNING', 'Catch Okafor'); },
          tick: () => { const t = C.data.ok; if (t?.escaped) fail('Okafor got away to the General.'); else if (t?.alive && t.state === 'run' && dist(t.pos, player.pos) < 4) { t.engage(0); hud.say('Insp. Okafor', 'Twenty years in uniform. You think say I go fear you?', 4); } },
          done: () => C.data.ok && !C.data.ok.alive && !C.data.ok.escaped },
        { label: 'Take Okafor\'s phone before his backup arrives (F)', limit: 30, late: 'His backup arrived and took the phone. Whatever was on it is gone.', where: () => C.data.ok?.pos, use: 'okphone', done: () => C.data.used === 'okphone' },
        { label: 'Lose the police', where: () => null, enter: () => { lead('okphone'); api.addHeat(2, 'Every radio in Surulere: "Officer down under Ojuelegba!"'); }, done: () => game.heat === 0 },
        { label: 'Get the phone home without being seen', where: () => world.homeDoor, done: () => near(player.pos, world.homeDoor, 6) && game.heat === 0 },
      ] },
    { title: 'The General', time: 'night', start: () => ({ x: -60, z: -1328, nx: 1, nz: 0 }),
      brief: 'His compound on Broad Street. Colonel Gbenga Sowande, retired. Trained to kill. He knows you\'re coming.',
      steps: [
        { label: 'Get to the General\'s compound on Broad Street', where: () => compound, done: () => near(player.pos, compound, 30) },
        { label: 'Get through the gate', where: () => compound, enter: () => { C.data.g = gang(compound.x - 6, compound.z, 4, 0); wake(C.data.g); talk([{ who: 'Boy in black', text: 'General say make nobody pass this gate tonight.' }, { who: 'Bolaji', text: 'Then tell him I\'m here.' }], compound); }, done: () => alive(C.data.g) === 0 },
        { label: 'Clear the compound before he escapes', limit: 180, late: 'The General got to his car and was gone. He\'ll be in Abuja by morning.', where: () => compound, enter: () => { moment('THE COMPOUND', 'He\'s getting away'); C.data.g2 = gang(compound.x + 2, compound.z, 4, 2); wake(C.data.g2); }, done: () => alive(C.data.g2) === 0 },
        { label: 'He\'s in his car: stop it (hang on with E, smash with F)', where: () => C.data.car?.pos,
          enter: () => { const car = game.traffic.spawnGetaway(compound.x + 8, compound.z + 6, 0, 'getaway'); car.ai.topSpeed = 13; car.ai.health = 5; car.ai.maxHealth = 5; C.data.car = car; C.data.lost = 0; moment('HE\'S RUNNING', 'Stop the car'); hud.say('The General', 'Drive! DRIVE!', 2.5); },
          tick: (dt) => { const car = C.data.car; if (!car) return; C.data.lost = dist(car.pos, player.pos) < 150 ? 0 : C.data.lost + dt; if (C.data.lost > 14) fail('The General\'s car got away. He\'ll be in Abuja by morning.'); },
          done: () => C.data.car?.ai.stopped },
        { label: 'Beat the General (counter him: he punishes mistakes)', where: () => C.data.gen?.pos, enter: () => { const c0 = C.data.car?.pos || compound; const g = api.thug({ x: c0.x + 3, z: c0.z, yaw: 0, variant: 'general', weapon: null, role: 'guard' }); g.engage(1); C.data.gen = g; hud.say('The General', 'Thirty years in the army. You think say one man in a cat suit go stop me?', 4.5); lead('general'); }, done: () => C.data.gen && !C.data.gen.alive },
        { label: 'Get the evidence to Commissioner Adaeze at City Hall (F)', where: () => hall, use: 'handover', enter: () => { moment('HIS POLICE', 'Get the evidence to City Hall'); api.addHeat(2, 'The General\'s friends in the police want that evidence.'); }, done: () => C.data.used === 'handover' },
      ],
      finish: () => { talk([{ who: 'Commissioner Adaeze', text: 'The ledger. The photos. Okafor\'s phone. This is enough to take him.' }, { who: 'Bolaji', text: 'Then take him.' }, { who: 'Commissioner Adaeze', text: 'Who are you?' }, { who: 'Bolaji', text: 'Nobody. Just Lagos.' }], hall); ending(); } },
  ];
  const CH = MISSIONS;
  G.missions = MISSIONS;
  LEADS.tunde = 'Tunde, a SwiftDrop rider, overheard the kidnappers: the shipment lands this week, and a "specialist" is coming for Street Cat.';
  LEADS.okphone = 'Okafor\'s phone: calls with the General, and the gate code for his compound on Broad Street.';
  const USE: any = { ledger: 'Take the ledger from the desk', photos: 'Photograph the rifle crates', handover: 'Give Commissioner Adaeze the ledger, the photos and the phones', tunde: 'Untie Tunde', panther: 'Take what Sunny made', okphone: 'Take Okafor\'s phone', phone: 'Take the squad leader\'s phone', crate: 'Take the sealed crate', handover2: 'Hand over the crate', danfo: 'Search the danfo' };
  const step = () => CH[C.ch]?.steps[C.st];
  G.caseFile = () => ({ chapter: CH[C.ch] ? `Mission ${C.ch + 1} of ${CH.length}: ${CH[C.ch].title}` : 'All ten missions complete', leads: C.leads.map(id => LEADS[id]).filter(Boolean) });

  function cleanupMission() {
    const D = C.data || {};
    CH[C.ch]?.cleanup?.();
    if (D.g) clear(D.g);
    for (const g of D.crew || []) if (!g.removed) g.remove?.();
    for (const t of [D.gen, D.ok]) if (t && !t.removed && !t.gone) (t.remove ? t.remove(scene) : null);
    if (D.car) { const car = D.car; setTimeout(() => game.traffic.remove(car), 15000); }
    if (D.hs && game.hunter?.active) game.hunter.remove();
    if (D.hs) { game.hunter.mission = false; game.hunter.bar = false; hud.boss?.(null); }
    for (const e of D.extra || []) if (!e.removed && !e.gone) e.remove?.(scene);
  }
  function begin() {
    const m = CH[C.ch]; if (!m || C.on) return;
    C.on = true; C.st = 0; C.entered = false; C.data = {}; C.t0 = game.time;
    hud.card(`Mission ${C.ch + 1}`, m.title);
    audio.alert?.(); game.save();
  }
  function complete() {
    const m = CH[C.ch];
    m.finish?.(); cleanupMission();
    hud.banner('MISSION COMPLETE', '', 'green', 2.4); game.addRespect(1500, m.title.toUpperCase());
    const i = C.ch, secs = game.time - (C.t0 || game.time);
    C.top = Math.max(C.top || 0, i + 1);
    C.on = false; C.st = 0; C.data = {};
    game.save();
    setTimeout(() => game.onMissionDone?.({ i, title: m.title, secs, next: CH[i + 1] ? i + 1 : null }), i === CH.length - 1 ? 14000 : 2500); // the finale waits for the newspaper
  }
  function fail(why) {
    if (!C.on) return;
    cleanupMission(); C.on = false; C.st = 0; C.entered = false; C.data = {};
    audio.alert?.(); game.onMissionFailed?.({ i: C.ch, title: CH[C.ch].title, why });
  }
  G.fail = fail;
  G.play = (i) => { if (C.on) cleanupMission(); C.on = false; C.ch = i; begin(); };
  G.list = () => CH.map((m, i) => ({ title: m.title, brief: m.brief, time: m.time, steps: m.steps.map(q => ({ label: q.label, limit: q.limit || 0 })), done: i < (C.top || 0), open: i <= (C.top || 0) }));
  G.abandon = () => { if (C.on) cleanupMission(); C.on = false; C.st = 0; C.data = {}; };
  function updateCase(dt) {
    if (!story() || !C.on) return;
    const m = CH[C.ch]; if (!m) return;
    if (game.arrest) return fail('You were arrested.');
    if (m.time === 'night' && L.phase !== 'night') return fail('Dawn came.');
    const s = step(); if (!s) return;
    if (!C.entered) { C.entered = true; C.left = s.limit || 0; s.enter?.(); }
    if (s.limit) { C.left -= dt; if (C.left <= 0) return fail(s.late); }
    s.tick?.(dt);
    if (!C.on) return; // the tick failed it
    if (s.done()) {
      C.st++; C.entered = false; audio.pickup?.();
      if (C.st >= m.steps.length) complete(); else game.save();
    }
  }
  function ending() {
    setTimeout(() => hud.banner('THE GENERAL FALLS', 'Colonel Sowande is arrested at dawn. Okafor and six officers are suspended. Nobody knows who Street Cat is.', 'green', 7), 5000);
    setTimeout(() => game.onNewspaper?.(['PUNCH: "G.S. Holdings" boss arrested with arms cache at Marina', 'THE NATION: Inspector Okafor and six officers on General\'s payroll suspended', 'VANGUARD: Who is Street Cat? Lagos asks', 'BUSINESSDAY: Ladipo warehouse sealed by EFCC']), 12500);
  }
  G.option = () => {
    if (!story() || !C.on) return null;
    const s = step(); if (!s?.use) return null;
    const w = s.where?.(); if (!w || !near(player.pos, w, 6)) return null;
    return { kind: 'case', use: s.use, text: `<span class="key">F</span>${USE[s.use]}` };
  };
  G.act = (opt) => { C.data.used = opt.use; return true; };
  G.target = () => {
    if (!story() || !C.on) return null;
    const w = step()?.where?.(); return w ? { x: w.x, z: w.z } : null;
  };
  // during a mission: the step, and its clock if it has one
  const clock = (t) => { const k = Math.max(0, Math.ceil(t)); return `${Math.floor(k / 60)}:${String(k % 60).padStart(2, '0')}`; };
  G.objective = () => { if (!story() || !C.on) return null; const m = CH[C.ch], s = step(); return s ? `${s.label}${s.count ? ` <b>${s.count()}</b>` : ''}${s.limit ? ` <b class="t${C.left < 30 ? ' hot' : ''}">${clock(C.left)}</b>` : ''}` : null; };
  G.tracker = () => {
    if (!story() || !C.on) return null;
    const m = CH[C.ch]; if (!m) return null;
    return { title: `Mission ${C.ch + 1} · ${m.title}`, sub: `MISSION ${C.ch + 1} OF ${CH.length}`, steps: m.steps.map((q, k) => ({ label: q.label, state: k < C.st ? 'done' : k === C.st ? 'cur' : '' })) };
  };
  G.markers = (M, MM, dstr) => {
    const t = G.target(); if (t) { const lbl = CH[C.ch].title.toUpperCase(); MM.push({ x: t.x, z: t.z, color: '#ffd54f' }); M.push({ x: t.x, y: 3.4, z: t.z, kind: 'story', label: `${lbl} · ${dstr(t.x, t.z)}` }); }
    if (G.oc && G.oc.stage === 'chase') MM.push({ x: G.oc.car.pos.x, z: G.oc.car.pos.z, color: '#ff3d3d' });
  };
  G.update = (dt) => {
    if (L.inside) return;
    updateCase(dt);
    updateLeaving();
    if (C.on || story()) return; // during a mission, and in Missions mode, the city waits
    // ordinary street crime only: the General's boys turn up in missions, never at random
    updateOneChance(dt); updatePick(dt);
  };
  G.serialize = () => ({ v: 2, ch: C.top || 0, leads: C.leads });
  G.load = (d) => {
    if (!d) return;
    // saves from the old six-chapter case: carry progress over to the matching mission
    C.ch = d.v === 2 ? (d.ch || 0) : ([0, 1, 2, 3, 5, 9, 10][d.ch || 0] ?? 0);
    C.top = C.ch; C.leads = d.leads || []; C.on = false; C.st = 0; // a mission in progress restarts from its marker
    if (C.ch >= 8) game.catSuit = true; // the panther suit, from Mission 8 on
  };
  return G;
}
