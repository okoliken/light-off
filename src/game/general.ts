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
  const story = () => game.mode === 'patrol' && game.sub !== 'free';
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
  const lead = (id) => { if (G.case.leads.includes(id)) return; G.case.leads.push(id); hud.toast(`🗂 <b>New lead.</b> ${LEADS[id]}<br><small>J: job sheet → case file</small>`, 'blue'); audio.pickup(); };

  // ---- the boys in black: a street held to ransom ----
  function startSquad() {
    const sp = api.spot(50, 120); if (!sp) return;
    const v = api.victim({ x: sp.x, z: sp.z, yaw: Math.atan2(sp.nx, sp.nz), mood: 'cower' }); v.name = pick(['Mama Kemi', 'Alhaji Sani', 'Uncle Tayo', 'Chioma', 'Mr. Okon']);
    const grp = gang(sp.x + sp.nx * 1.2, sp.z + sp.nz * 1.2, 3, L.phase === 'day' ? 0 : 1); // three boys, one gun at night: a fight, not a massacre
    G.squad = { ...grp, v, t: 0, woke: false, area: world.areaAt(sp.x, sp.z), lineT: 2 };
    hud.notice('MEN IN BLACK', `${G.squad.area}: the General's boys are terrorising ${v.name}'s shop.`, 'red');
    game.radio?.say(`Caller from ${G.squad.area}: "Boys in black don block our street! Dem get gun! Police no dey come!"`);
    audio.alert();
  }
  function updateSquad(dt) {
    const S = G.squad;
    if (!S) { G.squadCd -= dt * (L.phase === 'day' ? 0.45 : 1); if (G.squadCd <= 0 && !busy() && !player.fightingNear && !game.activities?.anyActive?.()) { G.squadCd = 160 + Math.random() * 120; startSquad(); } return; }
    S.t += dt; S.lineT -= dt;
    const d = dist(S, player.pos);
    if (S.lineT <= 0 && d < 30 && !S.woke) { S.lineT = 4; if (Math.random() < 0.6) hud.say('Boy in black', pick(HAVOC), 2.8); else hud.say(S.v.name, pick(VICTIM), 2.8); }
    if (!S.woke && (d < 9 || S.boys.some(t => t.alive && t.engaged) || S.boys.some(t => !t.alive))) {
      S.woke = true; wake(S); hud.say('Boy in black', L.suit ? 'Who be this one wey dress like us?! Finish am!' : 'Rider, you wan die? Oya!', 3);
      // the police are paid to look away while the General's boys work: no units pile in mid-fight
    }
    if (S.woke && alive(S) === 0) {
      S.v.mood = 'idle'; S.v.faceTarget = player.pos; hud.say(S.v.name, pick(['God bless you!', 'Who are you?! Thank you!', 'Those boys... they say na General send them.']), 3.5);
      const tip = 1000 + Math.floor(Math.random() * 4) * 500; L.wallet += tip; hud.toast(`${S.v.name} pressed <b>₦${tip}</b> into your hand.`, 'green'); game.addRespect(400, 'BOYS IN BLACK DOWN');
      if (story() && !G.case.leads.includes('phone') && G.case.ch >= 1) lead('phone');
      setTimeout(() => S.v.gone || S.v.runHome(S.v.pos.x + 30, S.v.pos.z), 4000); G.squad = null; return;
    }
    if ((S.t > 150 && d > 90) || S.t > 300) { clear(S); if (!S.v.gone) S.v.runHome(S.v.pos.x + 30, S.v.pos.z); G.squad = null; }
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

  // ======================= THE CASE (Story only) =======================
  G.case = { ch: 0, st: 0, leads: [], on: false, entered: false, data: {} };
  const C = G.case;
  const ladipo = () => { const t = { x: -400, z: 60 }; return world.spots.slice().sort((a, b) => dist(a, t) - dist(b, t))[0]; };
  const cp0 = () => game.police.list[0];
  const meet = () => ({ x: FLY.x - 4, z: roadLine(2) });
  const jetty = () => game.ferry.jetties[1];
  const compound = { x: 140, z: -1400 };
  const hall = { x: 27, z: -1388 };
  const night = () => L.phase === 'night' && !L.inside;
  const job = () => game.job;
  // each chapter: when it can start, then its steps. A step: label, where (marker), enter (spawns), done
  const CH: any[] = [
    { title: 'Men in Black', when: () => night() && L.night >= 1,
      intro: () => { hud.banner('CHAPTER 1 · MEN IN BLACK', 'Your phone buzzes: a voice note from Iya Basira at Adelabu Market. "They are burning the stalls!"', 'red', 4.5); },
      steps: [
        { label: 'Get to Adelabu Market', where: () => world.marketSpot, done: () => near(player.pos, world.marketSpot, 22) },
        { label: 'Fight the General\'s boys', where: () => world.marketSpot, enter: () => { C.data.g = gang(world.marketSpot.x, world.marketSpot.z, 4, 1); wake(C.data.g); game.api.scatter?.(world.marketSpot.x, world.marketSpot.z, 4); hud.say('Boy in black', 'Who be you? Una see am? Na one of us?!', 3); }, done: () => C.data.g && alive(C.data.g) === 0 },
        { label: 'The police think you\'re one of them: lose them', where: () => null, enter: () => { api.addHeat(2, 'Police: "One of the men in black! Na him dey lead them!"'); lead('phone'); }, done: () => game.heat === 0 },
      ] },
    { title: 'The Address', when: () => L.phase === 'day' && L.clock < 16 * 60 && (job().clockedIn || !job().employed),
      intro: () => { const s = ladipo(); if (!job().employed) { hud.banner('CHAPTER 2 · THE ADDRESS', 'The burner phone has an address saved: G.S. Holdings, Ladipo. A gold eagle on a beret, the same badge.', 'blue', 5); return; } const o = { id: 99, item: 'Sealed crate (heavy, "machine parts")', who: 'G.S. Holdings', place: { name: 'G.S. Holdings warehouse, Ladipo', x: s.x, z: s.z, area: 'Ladipo' }, due: L.clock + 120, status: 'pending', special: true }; job().orders.push(o); C.data.oid = 99; hud.banner('CHAPTER 2 · THE ADDRESS', 'A new parcel on today\'s sheet: G.S. Holdings, Ladipo. The receipt has a gold eagle on a beret: the same badge as the burner phone.', 'blue', 5); job().routeNext?.(); },
      steps: [
        { label: 'Deliver the crate to G.S. Holdings in Ladipo', where: () => ladipo(), done: () => job().employed ? !job().orders.some(o => o.id === 99 && o.status === 'pending') : near(player.pos, ladipo(), 10) },
        { label: 'Look around the warehouse (don\'t get caught)', where: () => ladipo(), enter: () => { hud.say('Man in black', 'Rider, drop am there. Don\'t look inside. Go.', 3.5); setTimeout(() => hud.toast('Through the door: crates of rifles, men in black counting money. One of them has an AK under his shirt.', 'blue'), 3600); lead('receipt'); C.data.t = 0; }, tick: (dt) => { C.data.t += dt; }, done: () => C.data.t > 6 },
      ] },
    { title: 'The Warehouse', when: () => night(),
      intro: () => hud.banner('CHAPTER 3 · THE WAREHOUSE', 'Back to Ladipo, in black this time. If the General pays people, somebody writes it down.', 'red', 4.5),
      steps: [
        { label: 'Go to the G.S. Holdings warehouse in Ladipo', where: () => ladipo(), done: () => near(player.pos, ladipo(), 25) },
        { label: 'Take out the guards', where: () => ladipo(), enter: () => { const s = ladipo(); C.data.g = gang(s.x - s.nx * 2, s.z - s.nz * 2, 4, 2); wake(C.data.g); }, done: () => alive(C.data.g || { boys: [], guns: [] }) === 0 },
        { label: 'Find the ledger (F at the desk)', where: () => ladipo(), use: 'ledger', done: () => C.data.used === 'ledger' },
        { label: 'Get away from the police', where: () => null, enter: () => { lead('ledger'); api.addHeat(2, 'Sirens everywhere. The warehouse was paying them to watch it.'); }, done: () => game.heat === 0 },
      ] },
    { title: 'Okafor', when: () => night(),
      intro: () => hud.banner('CHAPTER 4 · OKAFOR', 'Inspector Okafor runs the Ojuelegba checkpoint, and he\'s first on the General\'s payroll. Follow him tonight. Don\'t let him see you.', 'blue', 5),
      steps: [
        { label: 'Go to the Ojuelegba checkpoint', where: () => cp0(), done: () => near(player.pos, cp0(), 30) },
        { label: 'Tail Okafor: stay close, but not within 8 m', where: () => C.data.ok?.pos, enter: () => {
          const c = cp0(); const ok = new Civilian(scene, world, { x: c.x + 6, z: c.z, yaw: 0, outfit: OUTFITS.police }); ok.name = 'Insp. Okafor'; game.civilians.push(ok);
          C.data.ok = ok; C.data.path = [{ x: c.x, z: meet().z }, meet()]; C.data.pi = 0; C.data.far = 0; hud.say('Insp. Okafor', 'Hold the post. I dey come.', 3); },
          tick: (dt) => { const ok = C.data.ok; if (!ok || ok.gone) return; const tgt = C.data.path[C.data.pi]; if (!tgt) { ok.mood = 'idle'; return; } ok.runTo = tgt; ok.mood = 'run'; ok.runT = 0; if (near(ok.pos, tgt, 1.5)) C.data.pi++;
            const d = dist(ok.pos, player.pos); if (d < 8) { hud.say('Insp. Okafor', 'Who dey follow me?!', 3); C.data.ok.remove(scene); C.data.ok = null; C.st = 0; C.entered = false; hud.toast('He saw you. Go back to the checkpoint and try again.', 'red'); }
            C.data.far = d > 60 ? C.data.far + dt : 0; if (C.data.far > 8) { C.data.ok?.remove(scene); C.data.ok = null; C.st = 0; C.entered = false; hud.toast('You lost him. Go back to the checkpoint.', 'red'); } },
          done: () => C.data.ok && C.data.pi >= C.data.path.length },
        { label: 'Listen in (stay unseen, within 18 m)', where: () => meet(), enter: () => { const m = meet(); C.data.g = gang(m.x + 3, m.z, 2, 0); C.data.t = 0; }, tick: (dt) => { if (near(player.pos, meet(), 18)) { C.data.t += dt; if (C.data.t > 1 && C.data.t < 1 + dt * 1.5) hud.say('Insp. Okafor', 'Tell General: the Marina jetty is clear. My boys no go dey there.', 4); if (C.data.t > 5.5 && C.data.t < 5.5 + dt * 1.5) hud.say('Boy in black', 'General go come see the load himself. Make nobody near that jetty.', 4); } }, done: () => C.data.t > 10 },
        { label: 'Slip away', where: () => null, enter: () => { lead('meeting'); C.data.t = 0; }, tick: (dt) => { C.data.t += dt; }, done: () => C.data.t > 6 && dist(player.pos, meet()) > 40 },
      ], cleanup: () => { C.data.ok?.remove?.(scene); if (C.data.g) clear(C.data.g); } },
    { title: 'The Shipment', when: () => night(),
      intro: () => hud.banner('CHAPTER 5 · THE SHIPMENT', 'Marina jetty, Lagos Island. Take the ferry, the bridge, whatever. Get pictures of what comes off that boat.', 'red', 5),
      steps: [
        { label: 'Get to Marina Jetty on Lagos Island', where: () => jetty(), done: () => near(player.pos, jetty(), 30) },
        { label: 'Fight the shipment guards', where: () => jetty(), enter: () => { const j = jetty(); C.data.g = gang(j.x + 6, j.z - 6, 4, 2); wake(C.data.g); hud.say('Boy in black', 'Na the one wey dey follow us! Kill am!', 3); }, done: () => alive(C.data.g || { boys: [], guns: [] }) === 0 },
        { label: 'Photograph the crates (F)', where: () => jetty(), use: 'photos', done: () => C.data.used === 'photos' },
        { label: 'Lose the police', where: () => null, enter: () => { lead('photos'); api.addHeat(3, 'Police everywhere. The General\'s friends want those photos back.'); }, done: () => game.heat === 0 },
      ] },
    { title: 'The General', when: () => night(),
      intro: () => hud.banner('CHAPTER 6 · THE GENERAL', 'His compound on Broad Street. Colonel Gbenga Sowande, retired. Trained to kill. He knows you\'re coming.', 'red', 5),
      steps: [
        { label: 'Go to the General\'s compound (Broad Street)', where: () => compound, done: () => near(player.pos, compound, 30) },
        { label: 'Get through his guards', where: () => compound, enter: () => { C.data.g = gang(compound.x, compound.z, 4, 1); wake(C.data.g); }, done: () => alive(C.data.g || { boys: [], guns: [] }) === 0 },
        { label: 'Beat the General (counter him: he punishes mistakes)', where: () => C.data.gen?.pos, enter: () => { const g = api.thug({ x: compound.x + 4, z: compound.z, yaw: 0, variant: 'general', weapon: null, role: 'guard' }); g.engage(1); C.data.gen = g; hud.say('The General', 'Thirty years in the army. You think say na small boy go stop me?', 4.5); lead('general'); }, done: () => C.data.gen && !C.data.gen.alive },
        { label: 'Take the evidence to Commissioner Adaeze at City Hall', where: () => hall, use: 'handover', done: () => C.data.used === 'handover' },
      ] },
  ];
  const USE: any = { ledger: 'Take the ledger from the desk', photos: 'Photograph the rifle crates', handover: 'Give Commissioner Adaeze the ledger, the photos and the phone' };
  const step = () => CH[C.ch]?.steps[C.st];
  G.caseFile = () => ({ chapter: CH[C.ch] ? `Chapter ${C.ch + 1} of ${CH.length}: ${CH[C.ch].title}` : 'Case closed', leads: C.leads.map(id => LEADS[id]) });

  function updateCase(dt) {
    if (!story()) return;
    const ch = CH[C.ch]; if (!ch) return;
    if (!C.on) { if (ch.when() && L.night > (C.lastDay ?? -1) && !player.cuffed && !game.arrest && (C.cool || 0) <= game.time) { C.on = true; C.st = 0; C.entered = false; C.data = {}; ch.intro?.(); game.save(); } return; }
    const s = step(); if (!s) return;
    if (!C.entered) { C.entered = true; s.enter?.(); }
    s.tick?.(dt);
    if (s.done()) {
      C.st++; C.entered = false; audio.pickup?.();
      if (C.st >= ch.steps.length) {
        ch.cleanup?.(); hud.banner(`CHAPTER ${C.ch + 1} COMPLETE`, ch.title, 'green', 3.5); game.addRespect(1500, ch.title.toUpperCase());
        C.ch++; C.on = false; C.cool = game.time + 90; C.data = {}; C.lastDay = L.night;
        if (C.ch >= CH.length) ending();
      }
      game.save();
    }
  }
  // with the General gone, his street arm goes too: no more Red Caps levy points
  G.endRedCaps = () => {
    game.redCapsGone = true;
    for (const s of game.sites || []) { s.state = 'done'; s.respawn = 1e9; for (const t of s.group || []) if (!t.removed) t.remove(); if (s.collector && !s.collector.removed) s.collector.remove(); }
    for (const t of game.thugs) if (/^redcap|agbero/.test(t.variant) && t.role !== 'guard') t.remove?.();
  };
  function ending() {
    G.endRedCaps();
    setTimeout(() => hud.toast('With the General gone, the <b>Red Caps</b> have no one to pay them. Their levy points are empty. Surulere breathes.', 'green'), 9000);
    hud.banner('THE GENERAL FALLS', 'Colonel Sowande is arrested at dawn. Seven officers suspended. Nobody knows who the boy in black is.', 'green', 7);
    setTimeout(() => game.onNewspaper?.(['PUNCH: "G.S. Holdings" boss arrested with arms cache at Marina', 'THE NATION: Seven police officers on General\'s payroll suspended', 'VANGUARD: Who is the boy in black? Lagos asks', 'BUSINESSDAY: Ladipo warehouse sealed by EFCC']), 7500);
  }
  G.option = () => {
    const s = C.on && step(); if (!s?.use) return null;
    const w = s.where?.(); if (!w || !near(player.pos, w, 6)) return null;
    return { kind: 'case', use: s.use, text: `<span class="key">F</span>${USE[s.use]}` };
  };
  G.act = (opt) => { C.data.used = opt.use; return true; };
  G.target = () => { if (!story() || !C.on) return null; const w = step()?.where?.(); return w ? { x: w.x, z: w.z } : null; };
  G.objective = () => { if (!story() || !C.on) return null; const ch = CH[C.ch], s = step(); return s ? `<b>${ch.title}</b> · ${s.label}<small>CHAPTER ${C.ch + 1} OF ${CH.length} · THE CASE AGAINST THE GENERAL</small>` : null; };
  G.tracker = () => { if (!story() || !C.on) return null; const ch = CH[C.ch]; return { title: `Chapter ${C.ch + 1} · ${ch.title}`, sub: 'THE CASE AGAINST THE GENERAL', steps: ch.steps.map((q, k) => ({ label: q.label, state: k < C.st ? 'done' : k === C.st ? 'cur' : '' })) }; };
  G.markers = (M, MM, dstr) => {
    const t = G.target(); if (t) { MM.push({ x: t.x, z: t.z, color: '#ffd54f' }); M.push({ x: t.x, y: 3.4, z: t.z, kind: 'story', label: `${CH[C.ch].title.toUpperCase()} · ${dstr(t.x, t.z)}` }); }
    if (G.squad) { MM.push({ x: G.squad.x, z: G.squad.z, color: '#ff3d3d' }); if (dist(G.squad, player.pos) < 120) M.push({ x: G.squad.x, y: 3, z: G.squad.z, kind: 'cop', label: `MEN IN BLACK · ${dstr(G.squad.x, G.squad.z)}` }); }
    if (G.oc && G.oc.stage === 'chase') MM.push({ x: G.oc.car.pos.x, z: G.oc.car.pos.z, color: '#ff3d3d' });
  };
  G.update = (dt) => {
    if (L.inside) return;
    updateCase(dt);
    if (C.on) return; // during a chapter, the city waits
    updateSquad(dt); updateOneChance(dt); updatePick(dt);
  };
  G.serialize = () => ({ ch: C.ch, leads: C.leads, lastDay: C.lastDay ?? -1 });
  G.load = (d) => { if (!d) return; C.ch = d.ch || 0; C.leads = d.leads || []; C.lastDay = d.lastDay ?? -1; if (C.ch >= 6) setTimeout(() => G.endRedCaps(), 0); C.on = false; C.st = 0; }; // a chapter in progress restarts from its first step
  return G;
}
