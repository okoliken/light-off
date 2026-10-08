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
  const gone = (list) => (list || []).every(g => !g.alive || g.removed);
  const MISSIONS: any[] = [
    { title: 'Men in Black', time: 'night', start: () => world.marketSpot,
      brief: 'The General\'s boys are burning Adelabu Market. Iya Basira is screaming down the phone.',
      steps: [
        { label: 'Fight off the General\'s boys before the market burns', limit: 150, late: 'Adelabu Market burned. The General\'s boys held it till the stalls were ash.', where: () => world.marketSpot, enter: () => { C.data.g = gang(world.marketSpot.x, world.marketSpot.z, 4, 1); wake(C.data.g); game.api.scatter?.(world.marketSpot.x, world.marketSpot.z, 4); hud.say('Boy in black', 'Who be you? Una see am? Na one of us?!', 3); }, done: () => C.data.g && alive(C.data.g) === 0 },
        { label: 'The police think you\'re one of them: lose them', where: () => null, enter: () => { api.addHeat(2, 'Police: "One of the men in black! Na him dey lead them!"'); lead('phone'); }, done: () => game.heat === 0 },
      ] },
    { title: 'The Address', time: 'day', start: office,
      brief: 'The burner phone had an address saved: G.S. Holdings, Ladipo. Today a parcel for that address is on the SwiftDrop sheet.',
      steps: [
        { label: 'Take the crate to G.S. Holdings in Ladipo', limit: 300, late: 'Too late. Dispatch gave the crate to another rider, and the address went with it.', where: () => ladipo(), enter: () => hud.say('SwiftDrop dispatcher', 'Special one today: sealed crate, G.S. Holdings, Ladipo. Don\'t drop am.', 3.5), done: () => near(player.pos, ladipo(), 10) },
        { label: 'Hand it over and look around (don\'t start anything)', where: () => ladipo(), enter: () => { hud.say('Man in black', 'Rider, drop am there. Don\'t look inside. Go.', 3.5); setTimeout(() => hud.toast('Through the door: crates of rifles, men in black counting money. One of them has an AK under his shirt.', 'blue'), 3600); lead('receipt'); C.data.t = 0; }, tick: (dt) => { C.data.t += dt; }, done: () => C.data.t > 6 },
      ] },
    { title: 'The Warehouse', time: 'night', start: () => ladipo(),
      brief: 'Back to Ladipo, in black this time. If the General pays people, somebody writes it down.',
      steps: [
        { label: 'Take out the guards', where: () => ladipo(), enter: () => { const q = ladipo(); C.data.g = gang(q.x - q.nx * 2, q.z - q.nz * 2, 4, 2); wake(C.data.g); }, done: () => alive(C.data.g || none) === 0 },
        { label: 'Grab the ledger before they burn it (F at the desk)', limit: 30, late: 'One of them got to the desk first. The ledger went into a drum fire.', where: () => ladipo(), use: 'ledger', done: () => C.data.used === 'ledger' },
        { label: 'Get away from the police', where: () => null, enter: () => { lead('ledger'); api.addHeat(2, 'Sirens everywhere. The warehouse was paying them to watch it.'); }, done: () => game.heat === 0 },
      ] },
    // the marker is round the corner from the checkpoint: walking up to the police in the suit starts a chase
    { title: 'Okafor', time: 'night', start: () => (C.cpSpot ||= world.spots.filter(q => { const d = dist(q, cp0()); return d > 40 && d < 70; }).sort((a, b) => dist(a, cp0()) - dist(b, cp0()))[0] || cp0()),
      brief: 'Inspector Okafor runs the Ojuelegba checkpoint, and he\'s first on the General\'s payroll. He\'s leaving his post: follow him. Don\'t let him see you.',
      steps: [
        { label: 'Tail Okafor: stay close, but not within 8 m', where: () => C.data.ok?.pos, enter: () => {
          const c = cp0(); const ok = new Civilian(scene, world, { x: c.x + 6, z: c.z, yaw: 0, outfit: OUTFITS.police }); ok.name = 'Insp. Okafor'; game.civilians.push(ok);
          C.data.ok = ok; C.data.path = [{ x: c.x, z: meet().z }, meet()]; C.data.pi = 0; C.data.far = 0; hud.say('Insp. Okafor', 'Hold the post. I dey come.', 3); },
          tick: (dt) => { const ok = C.data.ok; if (!ok || ok.gone) return; const tgt = C.data.path[C.data.pi]; if (!tgt) { ok.mood = 'idle'; return; } ok.runTo = tgt; ok.mood = 'run'; ok.runT = 0; if (near(ok.pos, tgt, 1.5)) C.data.pi++;
            const d = dist(ok.pos, player.pos); if (d < 8) { hud.say('Insp. Okafor', 'Who dey follow me?!', 3); fail('Okafor saw you.'); return; }
            C.data.far = d > 60 ? C.data.far + dt : 0; if (C.data.far > 8) fail('You lost Okafor.'); },
          done: () => C.data.ok && C.data.pi >= C.data.path.length },
        { label: 'Listen in (stay unseen, within 18 m)', where: () => meet(), enter: () => { const m = meet(); C.data.g = gang(m.x + 3, m.z, 2, 0); C.data.t = 0; }, tick: (dt) => { if (near(player.pos, meet(), 18)) { C.data.t += dt; if (C.data.t > 1 && C.data.t < 1 + dt * 1.5) hud.say('Insp. Okafor', 'Tell General: the Marina jetty is clear. My boys no go dey there.', 4); if (C.data.t > 5.5 && C.data.t < 5.5 + dt * 1.5) hud.say('Boy in black', 'And that rider wey see the crates for Ladipo? We go carry am tomorrow.', 4); } }, done: () => C.data.t > 10 },
        { label: 'Slip away', where: () => null, enter: () => { lead('meeting'); C.data.t = 0; }, tick: (dt) => { C.data.t += dt; }, done: () => C.data.t > 6 && dist(player.pos, meet()) > 40 },
      ] },
    { title: 'One Chance', time: 'day', start: office,
      brief: 'Tunde, a SwiftDrop rider who saw the crates at Ladipo, just got into the wrong danfo. One chance. They\'re taking him.',
      steps: [
        { label: 'Catch the one chance danfo: grab on (E), then smash it (F)', where: () => C.data.car?.pos, enter: () => {
          const sp = api.spot(30, 70) || { x: player.pos.x + 40, z: player.pos.z, nx: 1, nz: 0 };
          const car = game.traffic.spawnGetaway(sp.x + sp.nx * 5, sp.z + sp.nz * 5, Math.atan2(-sp.nz, sp.nx), 'danfo'); car.ai.topSpeed = 11; car.ai.health = 4; car.ai.maxHealth = 4;
          C.data.car = car; C.data.lost = 0; hud.say('Tunde (in the danfo)', 'Bolaji! Na me! Dem don hold me!', 3); },
          tick: (dt) => { const car = C.data.car; if (!car) return; C.data.lost = dist(car.pos, player.pos) < 150 ? 0 : C.data.lost + dt; if (C.data.lost > 14) fail('The danfo got away with Tunde.'); },
          done: () => C.data.car?.ai.stopped },
        { label: 'Beat the crew', where: () => C.data.car?.pos, enter: () => {
          const car = C.data.car; C.data.crew = [-1, 1].map(k => api.gunman({ x: car.pos.x + car.rt.x * k * 1.8, z: car.pos.z + car.rt.z * k * 1.8, yaw: car.yaw, role: 'thief' }));
          C.data.g = { boys: [boy(car.pos.x - car.fwd.x * 3, car.pos.z - car.fwd.z * 3, car.yaw)], guns: [] }; wake(C.data.g); hud.popup('THE CREW JUMPS OUT'); },
          done: () => gone(C.data.crew) && alive(C.data.g || none) === 0 },
        { label: 'Untie Tunde (F)', where: () => C.data.tunde?.pos, use: 'tunde', enter: () => { const car = C.data.car; const v = api.victim({ x: car.pos.x - car.rt.x * 2.4, z: car.pos.z - car.rt.z * 2.4, yaw: 0, mood: 'cower' }); v.name = 'Tunde'; C.data.tunde = v; }, done: () => C.data.used === 'tunde' },
      ],
      finish: () => { lead('tunde'); hud.say('Tunde', 'They talk am for inside: the shipment land this week. And one "specialist" dey come for the boy in black.', 5); if (C.data.tunde && !C.data.tunde.gone) setTimeout(() => C.data.tunde?.runHome?.(C.data.tunde.pos.x + 30, C.data.tunde.pos.z), 5000); } },
    { title: 'The Shipment', time: 'night', start: () => jetty(),
      brief: 'Marina jetty, Lagos Island. Get pictures of what comes off that boat.',
      steps: [
        { label: 'Fight the shipment guards before the boat is unloaded', limit: 180, late: 'The crates were on the trucks and gone. No pictures, no proof.', where: () => jetty(), enter: () => { const j = jetty(); C.data.g = gang(j.x + 6, j.z - 6, 4, 2); wake(C.data.g); hud.say('Boy in black', 'Na the one wey dey follow us! Kill am!', 3); }, done: () => alive(C.data.g || none) === 0 },
        { label: 'Photograph the crates before the trucks leave (F)', limit: 40, late: 'The last truck pulled out with the crates.', where: () => jetty(), use: 'photos', done: () => C.data.used === 'photos' },
        { label: 'Lose the police', where: () => null, enter: () => { lead('photos'); api.addHeat(3, 'Police everywhere. The General\'s friends want those photos back.'); }, done: () => game.heat === 0 },
      ] },
    { title: 'The Hunter', time: 'night', start: stadium,
      brief: 'The General\'s friends in government brought someone in from Japan for the boy in black. He moves like you. He has a sword. He\'s waiting at the stadium.',
      steps: [
        { label: 'The Hunter: beat him, or lose him (he doesn\'t know Lagos)', where: () => game.hunter?.active ? game.hunter.pos : null, enter: () => { const q = stadium(); game.hunter.start(q.x + 8, q.z); C.data.hs = true; }, done: () => C.data.hs && !game.hunter.active },
        { label: 'Lose the police, if they came', where: () => null, done: () => game.heat === 0 },
      ],
      finish: () => { setTimeout(() => hud.toast('You got away. His blade didn\'t even mark the suit.', 'green'), 4500); } },
    { title: 'A New Skin', time: 'day', start: tailor,
      brief: 'Sunny the tailor sent a text: "Come see me. I made something for you. No questions."',
      steps: [
        { label: 'Collect it from Sunny (F)', where: tailor, use: 'panther', enter: () => hud.say('Sunny (tailor)', 'I see wetin happen to the last one. This one... na different thing.', 4), done: () => C.data.used === 'panther' },
      ],
      finish: () => { game.catSuit = true; L.suitHP = 100; game.refreshFit?.(); hud.notice('THE PANTHER SUIT', 'Matte black, a helmet with eye slits, silver trim, claws. It\'s in your bag: put it on at night.', 'green', 5); } },
    { title: 'Okafor\'s Last Stand', time: 'night', start: () => meet(),
      brief: 'The General gave the order: finish the boy in black. Okafor and his crooked officers are waiting under Ojuelegba bridge.',
      steps: [
        { label: 'Beat Okafor\'s officers', where: () => meet(), enter: () => { const m = meet(); C.data.crew = [0, 1, 2].map(k => { const g = api.gunman({ x: m.x + (k - 1) * 3, z: m.z + 6, yaw: Math.PI, role: 'hitman', outfit: OUTFITS.police }); g.name = 'Okafor\'s man'; return g; }); hud.say('Police', 'Na him! No arrest. Finish am!', 3); }, done: () => gone(C.data.crew) },
        { label: 'Beat Inspector Okafor', where: () => C.data.ok?.pos, enter: () => { const m = meet(); const t = api.thug({ x: m.x, z: m.z + 3, yaw: Math.PI, variant: 'police', weapon: 'stick', role: 'guard' }); t.name = 'Insp. Okafor'; t.hp = t.maxHp = 10; t.engage(0.5); C.data.ok = t; hud.say('Insp. Okafor', 'Twenty years in uniform. You think say I go fear small boy?', 4); }, done: () => C.data.ok && !C.data.ok.alive },
        { label: 'Take Okafor\'s phone before his backup arrives (F)', limit: 30, late: 'His backup arrived and took the phone. Whatever was on it is gone.', where: () => C.data.ok?.pos, use: 'okphone', enter: () => { C.data.okPos = { x: C.data.ok.pos.x, z: C.data.ok.pos.z }; }, done: () => C.data.used === 'okphone' },
        { label: 'Lose the police', where: () => null, enter: () => { lead('okphone'); api.addHeat(2, 'Every radio in Surulere: "Officer down under Ojuelegba!"'); }, done: () => game.heat === 0 },
      ] },
    { title: 'The General', time: 'night', start: () => compound,
      brief: 'His compound on Broad Street. Colonel Gbenga Sowande, retired. Trained to kill. He knows you\'re coming.',
      steps: [
        { label: 'Get through his guards before he escapes', limit: 180, late: 'The General got to his car and was gone. He\'ll be in Abuja by morning.', where: () => compound, enter: () => { C.data.g = gang(compound.x, compound.z, 4, 1); wake(C.data.g); }, done: () => alive(C.data.g || none) === 0 },
        { label: 'Beat the General (counter him: he punishes mistakes)', where: () => C.data.gen?.pos, enter: () => { const g = api.thug({ x: compound.x + 4, z: compound.z, yaw: 0, variant: 'general', weapon: null, role: 'guard' }); g.engage(1); C.data.gen = g; hud.say('The General', 'Thirty years in the army. You think say na small boy go stop me?', 4.5); lead('general'); }, done: () => C.data.gen && !C.data.gen.alive },
        { label: 'Take the evidence to Commissioner Adaeze at City Hall', where: () => hall, use: 'handover', done: () => C.data.used === 'handover' },
      ],
      finish: () => ending() },
  ];
  const CH = MISSIONS;
  G.missions = MISSIONS;
  LEADS.tunde = 'Tunde, a SwiftDrop rider, overheard the kidnappers: the shipment lands this week, and a "specialist" is coming for the boy in black.';
  LEADS.okphone = 'Okafor\'s phone: calls with the General, and the gate code for his compound on Broad Street.';
  const USE: any = { ledger: 'Take the ledger from the desk', photos: 'Photograph the rifle crates', handover: 'Give Commissioner Adaeze the ledger, the photos and the phones', tunde: 'Untie Tunde', panther: 'Take what Sunny made', okphone: 'Take Okafor\'s phone' };
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
  }
  function begin() {
    const m = CH[C.ch]; if (!m || C.on) return;
    C.on = true; C.st = 0; C.entered = false; C.data = {}; C.t0 = game.time;
    hud.banner(`MISSION ${C.ch + 1} · ${m.title.toUpperCase()}`, m.brief, m.time === 'night' ? 'red' : 'blue', 5);
    audio.alert?.(); game.save();
  }
  function complete() {
    const m = CH[C.ch];
    m.finish?.(); cleanupMission();
    hud.banner(`MISSION ${C.ch + 1} COMPLETE`, `${m.title}. The mission is over.`, 'green', 4.5); game.addRespect(1500, m.title.toUpperCase());
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
    setTimeout(() => hud.banner('THE GENERAL FALLS', 'Colonel Sowande is arrested at dawn. Okafor and six officers are suspended. Nobody knows who the boy in black is.', 'green', 7), 5000);
    setTimeout(() => game.onNewspaper?.(['PUNCH: "G.S. Holdings" boss arrested with arms cache at Marina', 'THE NATION: Inspector Okafor and six officers on General\'s payroll suspended', 'VANGUARD: Who is the boy in black? Lagos asks', 'BUSINESSDAY: Ladipo warehouse sealed by EFCC']), 12500);
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
  G.objective = () => { if (!story() || !C.on) return null; const m = CH[C.ch], s = step(); return s ? `<b>Mission ${C.ch + 1} · ${m.title}</b> · ${s.label}${s.limit ? ` <b>${clock(C.left)}</b>` : ''}<small>MISSION ${C.ch + 1} OF ${CH.length}</small>` : null; };
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
