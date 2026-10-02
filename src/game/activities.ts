// Things to do in free roam, day or night, none of them forced:
//   Robberies:       armed robbers hit a shop and flee in a car. Chase it, skitch on, smash it, take the money back.
//   Third Mainland go-slow (patrol): the bridge jams, robbers dressed as hawkers work the stuck cars and
//                    bolt for the railing to drop into Makoko canoes. Catch them first.
//   Third Mainland sprint: skate the bridge from Surulere to the Adeniji Adele interchange against the clock.
//   Rooftop runs:    a chain of glowing rings across the rooftops against the clock (pure cat parkour).
//   Phone snatchers: someone shouts "Ole!" and a thief runs. Knock him down, take the phone back.
//   Delivery jobs:   Mama Nkechi at Adelabu Market pays for fast food deliveries (daytime).
//   Skate challenge: at the Area Pitch, score as many trick points as you can in 45 seconds.
import * as THREE from 'three';
import { textSign } from '../core/textures.ts';
import { BRIDGE } from '../world/layout.ts';

const pick = a => a[Math.floor(Math.random() * a.length)];
const OWNERS = ['Aunty Bisi', 'Mr. Okon', 'Blessing', 'Uncle Tayo', 'Chioma', 'Alhaji Sani', 'Mrs. Adeyemi'];
const FOODS = ['a cooler of jollof', 'two plates of amala', 'a bag of puff-puff', 'a flask of pepper soup', 'a tray of moi-moi'];

export function createActivities(game, h) {
  const { scene, world, hud, audio, player } = game;
  const L = game.life;
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
  const A: any = { snatch: null, job: null, skate: null, robbery: null, run: null, course: null, nextSnatch: 50 + Math.random() * 40, nextRobbery: 150 + Math.random() * 90 };
  const col = world.collision;

  // Mama Nkechi's food stall at the market (delivery jobs) and the pitch challenge board
  const ms = world.marketSpot, stall = { x: ms.x + 9, z: ms.z - 2 };
  const pitch = world.pitchCenter;
  const board = (x, z, text, bg, ry = 0) => {
    const t = textSign(text, bg, '#fff', 768, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
    m.position.set(x, 2.6, z); m.rotation.y = ry; scene.add(m);
  };
  board(stall.x, stall.z, "MAMA NKECHI'S · DELIVERY", '#e65100');
  board(pitch.x, pitch.z - 6, 'SKATE CHALLENGE · 45 SEC', '#1565c0');

  // ---- phone snatchers ----
  function startSnatch() {
    const spot = h.spot(22, 45);
    if (!spot) return;
    const name = pick(OWNERS);
    const victim = h.victim({ x: spot.x, z: spot.z, yaw: Math.atan2(spot.nx, spot.nz), mood: 'wave' }); victim.name = name; victim.faceTarget = player.pos; victim.tip = 800 + Math.floor(Math.random() * 3) * 400;
    const thief = h.thug({ x: spot.x + spot.nz * 1.5, z: spot.z - spot.nx * 1.5, variant: 'agbero2', role: 'guard' });
    thief.hp = thief.maxHp = 2; thief.state = 'run'; thief.t = 0; thief.runSpeed = 6.2;
    const dir = Math.random() < 0.5 ? 1 : -1;
    thief.runTo = { x: spot.x - spot.nz * 120 * dir + spot.nx * 4, z: spot.z + spot.nx * 120 * dir + spot.nz * 4 };
    h.giveItem(thief, { label: `${name}'s phone`, amount: 0, owner: victim });
    A.snatch = { thief, victim, t: 0 };
    hud.notice('OLE!', `A phone snatcher grabbed ${name}'s phone. Catch him!`, 'red');
    hud.say(name, pick(['Ole! Ole! My phone!', 'Thief! Catch am! My phone!', 'Help! He took my phone!']), 2.6);
    audio.alert();
  }
  function updateSnatch(dt) {
    const s = A.snatch;
    if (!s) {
      if (!L.inside && !game.story.active && !player.fightingNear && player.mode !== 'ride' && !game.carrying) A.nextSnatch -= dt;
      if (A.nextSnatch <= 0) { A.nextSnatch = 120 + Math.random() * 90; startSnatch(); }
      return;
    }
    s.t += dt;
    if (s.thief.escaped) { hud.toast(`The thief got away with ${s.victim.name}'s phone.`, 'red'); s.victim.runHome(s.victim.pos.x + 30, s.victim.pos.z + 20); A.snatch = null; return; }
    // done once the phone is back with its owner (or lost)
    const itemOut = game.carrying?.owner === s.victim || game.dropped?.item.owner === s.victim || (s.thief.alive && s.thief.item);
    if (!itemOut && s.t > 1) { A.snatch = null; }
  }

  // ---- delivery jobs (day) ----
  function startJob() {
    const cands = world.spots.filter(q => { const d = Math.hypot(q.x - stall.x, q.z - stall.z); return d > 90 && d < 230 && !(q.bi === 1 && q.bj === 1); });
    const to = pick(cands);
    const dist = Math.hypot(to.x - stall.x, to.z - stall.z);
    A.job = { to: { x: to.x, z: to.z }, name: pick(OWNERS), food: pick(FOODS), time: Math.round(40 + dist / 3.2), pay: 1000 + Math.round(dist / 50) * 250 };
    const cust = h.victim({ x: to.x, z: to.z, yaw: Math.atan2(to.nx, to.nz), mood: 'wave' }); cust.name = A.job.name; A.job.cust = cust;
    hud.say('Mama Nkechi', `Take ${A.job.food} to ${A.job.name} in ${world.areaAt(to.x, to.z)}. ₦${A.job.pay.toLocaleString()} if it's still hot!`, 4);
    audio.pickup();
  }
  function updateJob(dt) {
    const j = A.job; if (!j) return;
    j.time -= dt;
    if (d2(j.to, player.pos) < 3 * 3) {
      L.wallet += j.pay; game.addRespect(150, 'DELIVERED');
      hud.notice(`₦${j.pay.toLocaleString()} EARNED`, `${j.name}: "Still hot! Tell Mama Nkechi thank you."`, 'green');
      audio.deliver(); j.cust.mood = 'cheer'; const c = j.cust; setTimeout(() => c.remove(scene), 5000); A.job = null; return;
    }
    if (j.time <= 0) { hud.notice('TOO LATE', `${j.name}'s food is cold. No pay this time.`, 'red'); j.cust.remove(scene); A.job = null; }
  }

  // ---- skate challenge ----
  function updateSkate(dt) {
    const k = A.skate; if (!k) return;
    k.t -= dt;
    if (k.t <= 0) {
      const pts = game.respect - k.start, best = Math.max(A.best || 0, pts); A.best = best;
      const pay = pts >= 1500 ? 1500 : pts >= 800 ? 700 : 0;
      L.wallet += pay;
      hud.notice(`SKATE CHALLENGE · ${pts} PTS`, pay ? `The pitch boys pay up: ₦${pay.toLocaleString()}. Best: ${best}` : `Not enough to win anything. Best: ${best}. Try grinds and flips.`, pay ? 'green' : 'white');
      A.skate = null;
    }
  }

  // ---- armed robbery: a getaway car ----
  const SHOPS = ["Mama Kemi's POS stand", "Alhaji's phone shop", "Blessing's provisions store", "the Mr. Biggs counter", "Uncle Tunde's pharmacy"];
  function startRobbery() {
    const spot = h.spot(70, 150); if (!spot) return;
    const shop = pick(SHOPS), who = shop.split("'")[0].replace('the ', '').trim() || 'The owner';
    const owner = h.victim({ x: spot.x, z: spot.z, yaw: Math.atan2(spot.nx, spot.nz), mood: 'wave' }); owner.name = who; owner.tip = 2000 + Math.floor(Math.random() * 4) * 500;
    const yaw = Math.atan2(-spot.nz, spot.nx);
    const car = game.traffic.spawnGetaway(spot.x + spot.nx * 5, spot.z + spot.nz * 5, yaw); car.ai.topSpeed = 12; car.ai.health = 4; car.ai.maxHealth = 4;
    A.robbery = { car, owner, shop, stage: 'chase', lostT: 0, t: 0, crew: [] };
    hud.notice('ARMED ROBBERY', `Robbers just hit ${shop}. Chase the car!`, 'red');
    game.radio?.say(`Breaking: armed robbers don attack ${shop} for ${world.areaAt(spot.x, spot.z)}! Dem dey run for black car!`);
    audio.alert();
  }
  function endRobbery(keepCar = 20000) { const r = A.robbery; if (!r) return; const car = r.car; setTimeout(() => game.traffic.remove(car), keepCar); A.robbery = null; }
  function updateRobbery(dt) {
    const r = A.robbery;
    if (!r) {
      if (!L.inside && !game.story.active && L.phase !== 'day' && !player.fightingNear && player.mode !== 'ride' && !game.carrying && !game.dropped) A.nextRobbery -= dt * (game.mode === 'patrol' ? 1.6 : 1);
      if (A.nextRobbery <= 0) { A.nextRobbery = 200 + Math.random() * 120; startRobbery(); }
      return;
    }
    r.t += dt;
    if (r.stage === 'chase') {
      r.lostT = d2(r.car.pos, player.pos) < 160 * 160 ? 0 : r.lostT + dt;
      if (r.lostT > 15) { hud.notice('THEY GOT AWAY', `The robbers escaped with ${r.shop}'s money.`, 'red'); r.owner.runHome(r.owner.pos.x + 30, r.owner.pos.z); endRobbery(0); return; }
      if (r.car.ai.stopped) {
        r.stage = 'fight';
        for (const k of [-1, 1]) { const g = h.gunman({ x: r.car.pos.x + r.car.rt.x * k * 1.8, z: r.car.pos.z + r.car.rt.z * k * 1.8, yaw: r.car.yaw, role: 'thief' }); r.crew.push(g); }
        h.giveItem(r.crew[0], { label: `${r.owner.name}'s takings`, amount: 25000 + Math.floor(Math.random() * 6) * 5000, owner: r.owner });
        hud.popup('ROBBERS BAILING OUT · <b>THEY HAVE GUNS</b>');
      }
    } else {
      const out = game.carrying?.owner === r.owner || game.dropped?.item.owner === r.owner || r.crew.some(g => g.alive && g.item);
      if (!out) { endRobbery(); }
      else if (r.crew.every(g => !g.alive || g.removed) && !game.carrying && !game.dropped) endRobbery();
    }
  }
  // ---- rooftop runs: rings across the roofs ----
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1, 0.55).multiplyScalar(1.6), transparent: true, opacity: 0.75, toneMapped: false });
  const roofs = (x, z, r) => col.solids.query(x - r, z - r, x + r, z + r, []).filter(q => q.kind === 'building' && q.maxy > 3 && q.maxy < 13 && q.maxx - q.minx > 3 && q.maxz - q.minz > 3);
  function makeCourse() {
    const near = roofs(player.pos.x, player.pos.z, 70).sort((a, b) => Math.hypot((a.minx + a.maxx) / 2 - player.pos.x, (a.minz + a.maxz) / 2 - player.pos.z) - Math.hypot((b.minx + b.maxx) / 2 - player.pos.x, (b.minz + b.maxz) / 2 - player.pos.z));
    if (!near.length) return null;
    const pts = [], used = new Set();
    let cur = near[Math.min(2, near.length - 1)];
    const ctr = q => ({ x: (q.minx + q.maxx) / 2, z: (q.minz + q.maxz) / 2, y: q.maxy });
    for (let k = 0; k < 6 && cur; k++) {
      used.add(cur); const c = ctr(cur); pts.push(c);
      const cand = roofs(c.x, c.z, 26).filter(q => !used.has(q)).map(q => ({ q, c: ctr(q) })).filter(o => { const d = Math.hypot(o.c.x - c.x, o.c.z - c.z); return d > 7 && d < 24 && Math.abs(o.c.y - c.y) < 4.5; });
      cur = cand.length ? pick(cand).q : null;
    }
    if (pts.length < 4) return null;
    const rings = pts.map((p, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 8, 28), ringMat); m.position.set(p.x, p.y + 1.4, p.z); m.visible = i === 0; scene.add(m); return { ...p, m }; });
    return { rings, par: Math.round(10 + pts.length * 7) };
  }
  function clearCourse() { if (A.course) for (const r of A.course.rings) scene.remove(r.m); A.course = null; A.run = null; }
  function updateRun(dt) {
    if (L.inside) return;
    if (!A.course || (!A.run && d2(A.course.rings[0], player.pos) > 170 * 170)) { clearCourse(); A.course = makeCourse(); if (!A.course) return; }
    const C = A.course;
    for (const r of C.rings) r.m.rotation.y += dt * 1.5;
    const hit = (r) => d2(r, player.pos) < 2.4 * 2.4 && Math.abs(player.pos.y - r.y) < 2.5;
    if (!A.run) {
      if (hit(C.rings[0])) { A.run = { i: 1, t: C.par }; C.rings[0].m.visible = false; C.rings[1].m.visible = true; hud.notice('ROOFTOP RUN', `${C.rings.length - 1} rings · ${C.par}s · don't touch the ground if you can help it`, 'blue'); audio.pickup(); }
      return;
    }
    const R = A.run; R.t -= dt;
    const ring = C.rings[R.i];
    if (hit(ring)) {
      ring.m.visible = false; R.i++; audio.tick?.();
      if (R.i >= C.rings.length) { const pay = 800 + Math.round(R.t) * 40; L.wallet += pay; game.addRespect(400 + Math.round(R.t) * 20, 'ROOFTOP RUN'); hud.notice(`ROOFTOP RUN · ${Math.round(C.par - R.t)}s`, `Clean. The rooftop boys pay up: ₦${pay.toLocaleString()}.`, 'green'); clearCourse(); return; }
      C.rings[R.i].m.visible = true;
    }
    if (R.t <= 0) { hud.notice('TOO SLOW', 'The rooftop run timed out. The rings reset.', 'red'); for (const [i, r] of C.rings.entries()) r.m.visible = i === 0; A.run = null; }
  }

  // ---- Third Mainland go-slow robbers ----
  const DY = BRIDGE.deckY, BH = BRIDGE.half, onDeck = () => player.pos.y > DY - 1.5 && player.pos.z < BRIDGE.deck0 && player.pos.z > BRIDGE.deck1;
  A.goslow = null; A.goslowCd = 0;
  const LOOT = ['a phone and a wallet', 'a laptop bag', 'a handbag', 'two phones', 'a gold chain', 'the day\'s sales, ₦40,000', 'a wristwatch and ₦15,000'];
  function startGoslow() {
    const pz = player.pos.z;
    game.traffic.goSlow = { z0: pz + 60, z1: pz - 170 };
    // wait for the cars to bunch up a little, then the "hawkers" go to work beside them
    const cars = game.traffic.vehicles.filter(v => v.kind === 'loop' && v.pos.z < pz - 12 && v.pos.z > pz - 200).sort((a, b) => b.pos.z - a.pos.z);
    const pickCars: any[] = []; for (const v of cars) if (pickCars.every(q => Math.abs(q.pos.z - v.pos.z) > 12)) pickCars.push(v);
    // not enough cars nearby yet? some of them work the lanes further up
    while (pickCars.length < 4) pickCars.push({ pos: { x: (pickCars.length % 2 ? 3 : -3), z: pz - 30 - pickCars.length * 28 } });
    const robbers = pickCars.slice(0, 4).map((v, k) => {
      const side = v.pos.x > 0 ? 1 : -1, x = v.pos.x + side * 1.8, z = v.pos.z;
      const t = h.thug({ x, z, y: DY, yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2, variant: 'hawker', weapon: k % 2 ? 'knife' : null, role: 'guard' });
      t.calm = true; t.hp = t.maxHp = 3; t.robT = 10 + k * 7; t.loot = pick(LOOT); t.car = v;
      return t;
    });
    A.goslow = { robbers, caught: 0, escaped: 0, t: 0 };
    hud.notice('GO-SLOW ON THIRD MAINLAND', 'Traffic has stopped. Men with hawkers\' trays are walking between the cars. Watch them.', 'red');
    game.radio?.say('Third Mainland don hold! Na go-slow from Oworonshoki reach Adeniji Adele. Motorists, lock your doors: dem say "hawkers" dey rob people for inside the traffic!');
    audio.alert();
  }
  function updateGoslow(dt) {
    A.goslowCd -= dt;
    const G = A.goslow;
    if (!G) { if (game.mode === 'patrol' && L.phase !== 'day' && A.goslowCd <= 0 && onDeck() && !game.story.active) startGoslow(); return; }
    G.t += dt;
    for (const t of G.robbers) {
      if (t.done) continue;
      if (t.state === 'ko' || (t.hp <= 0 && !t.alive && !t.escaped)) {
        t.done = true; G.caught++; game.addRespect(200, 'ROBBER CAUGHT'); hud.popup(`RETURNED · <b>${t.loot.toUpperCase()}</b>`); game.stats.returned += 15000; game.logNight?.('returned', { name: 'the stuck motorists', amount: 15000 });
        continue;
      }
      if (t.escaped || t.removed) { t.done = true; G.escaped++; game.fx.burst((t.pos.x > 0 ? 1 : -1) * (BH + 3), 0.2, t.pos.z, 0x90caf9, 20, 4); audio.splash?.(); hud.popup('HE JUMPED · <b>A CANOE FROM MAKOKO WAS WAITING</b>'); continue; }
      if (t.state === 'idle') {
        // robbing: leaning into the car window, until he's done or someone comes
        t.rig.set('shRX', -1.4); t.rig.set('elRX', -0.4); t.rig.set('spineX', 0.35);
        t.robT -= dt;
        const close = Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z) < 9 && player.pos.y > DY - 2;
        if (t.robT <= 0 || close) { t.state = 'run'; t.t = 0; t.runSpeed = 5.4; t.runTo = { x: (t.pos.x > 0 ? 1 : -1) * (BH - 0.7), z: t.pos.z - 8 - Math.random() * 10 }; /* the railing on his side: a canoe waits below */ if (close) game.say(t, pick(['Na police?!', 'Run! Run!', 'E don cast!']), 'Hawker', 30); }
      }
    }
    if (G.robbers.every(t => t.done)) {
      const n = G.robbers.length;
      hud.notice(`GO-SLOW CLEARED · ${G.caught}/${n} CAUGHT`, G.caught === n ? 'Not one of them made it to the canoes. The horns start up again.' : `${G.escaped} got away over the railing, into Makoko.`, G.caught === n ? 'green' : 'white');
      if (G.caught === n) game.addRespect(500, 'CLEAN SWEEP');
      A.goslow = null; A.goslowCd = 240; setTimeout(() => { game.traffic.goSlow = null; }, 6000);
    }
  }
  // ---- Third Mainland sprint: Surulere end to the Adeniji Adele interchange ----
  const SPRINT = { start: { x: 0, z: BRIDGE.z0 + 10, y: 0 }, end: { x: 0, z: world.gate?.z ?? BRIDGE.z1 - 20, y: 0 }, gold: 62, par: 80 };
  const sRing = (p) => { const m = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.14, 8, 36), ringMat); m.position.set(p.x, p.y + 2.2, p.z); scene.add(m); return m; };
  let sStart = null, sEnd = null;
  A.sprint = null;
  function updateSprint(dt) {
    if (game.mode !== 'patrol' || L.inside) return;
    sStart ||= sRing(SPRINT.start); sEnd ||= sRing(SPRINT.end);
    sStart.rotation.y += dt; sEnd.rotation.y += dt;
    sStart.visible = !A.sprint; sEnd.visible = !!A.sprint;
    const at = (p, r) => d2(p, player.pos) < r * r && player.pos.y < 3;
    if (!A.sprint && at(SPRINT.start, 3.5)) { A.sprint = { t: 0 }; hud.notice('THIRD MAINLAND SPRINT', `To the Adeniji Adele interchange. ${SPRINT.gold}s for gold, ${SPRINT.par}s to get paid. Skitch if you dare.`, 'blue'); audio.pickup(); }
    if (!A.sprint) return;
    A.sprint.t += dt;
    if (at(SPRINT.end, 4.5)) {
      const t = A.sprint.t, pay = t <= SPRINT.gold ? 2500 : t <= SPRINT.par ? 1200 : 300, best = game.stats.bridgeBest ? Math.min(game.stats.bridgeBest, t) : t;
      game.stats.bridgeBest = best; L.wallet += pay; game.addRespect(t <= SPRINT.gold ? 700 : 350, 'BRIDGE SPRINT');
      hud.notice(`WELCOME TO LAGOS ISLAND · ${t.toFixed(1)}s`, `${t <= SPRINT.gold ? 'GOLD. ' : ''}₦${pay.toLocaleString()} · best ${best.toFixed(1)}s`, t <= SPRINT.par ? 'green' : 'white');
      A.sprint = null;
    } else if (A.sprint.t > 240) A.sprint = null;
  }

  // ---- the Patron's hit squads: once he's known, a powerful man starts paying to have him removed ----
  A.hit = null; A.hitCd = 240 + Math.random() * 120;
  function startPoliceHit() { // stage 1: the Patron's police do his dirty work. No siren, no arrest: they shoot
    const p = player.pos, squad = [];
    for (let k = 0; k < 3; k++) { const a = k * 2.1; const g = h.gunman({ x: p.x + Math.sin(a) * 22, z: p.z + Math.cos(a) * 22, role: 'hitman' }); g.name = 'Police'; squad.push(g); }
    A.hit = { squad: [], gun: null, cops: squad, t: 0, police: true };
    hud.banner('SET UP', 'Police with no siren, no warrant, no questions. Somebody paid them to finish you.', 'red', 3.5);
    game.say(squad[0], 'Na him! Oga say make we no carry am go station.', 'Police', 60); audio.alert();
  }
  function startHit() {
    const p = player.pos, squad = [];
    const n = game.respect > 15000 ? 4 : 3;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      let x = p.x + Math.sin(a) * 14, z = p.z + Math.cos(a) * 14;
      if (col.solids.query(x - 0.5, z - 0.5, x + 0.5, z + 0.5, []).some(q => q.maxy > 1)) { x = p.x + Math.sin(a) * 6; z = p.z + Math.cos(a) * 6; }
      const t = h.thug({ x, z, variant: 'blade', weapon: 'knife', role: 'guard' }); t.engage(0.6 + k * 0.3); squad.push(t);
    }
    // the dirty part: a plainclothes policeman who shoots whatever the heat
    const gun = game.respect > 6000 ? h.gunman({ x: p.x + 18, z: p.z - 10, role: 'hitman' }) : null; if (gun) gun.name = 'Plainclothes';
    A.hit = { squad, gun, t: 0 };
    hud.banner('THE BLADES', 'Somebody with a lot of money wants you gone.', 'red', 3);
    game.radio?.say('...'); audio.alert();
    game.say(squad[0], 'Boy in black. The man sends his greetings.', 'Blade', 60);
  }
  function updateHit(dt) {
    A.hitCd -= dt;
    if (!A.hit) {
      const fails = game.story.flags.policeFails || 0;
      if (A.hitCd <= 0 && fails >= 1 && fails < 3 && game.respect >= 2000 && L.phase !== 'day' && L.suit && !L.inside && !game.story.active && !game.carrying && !player.cuffed && player.mode !== 'ride') { A.hitCd = 300 + Math.random() * 200; startPoliceHit(); return; }
      if (A.hitCd <= 0 && fails >= 3 && L.phase !== 'day' && L.suit && !L.inside && !game.story.active && !player.fightingNear && !game.carrying && !player.cuffed && player.mode !== 'ride') { A.hitCd = 360 + Math.random() * 240; startHit(); }
      return;
    }
    const H = A.hit; H.t += dt;
    if (H.police) {
      if (H.cops.every(g => !g.alive || g.removed)) { game.addRespect(500, 'SURVIVED THE SETUP'); hud.notice('PAID POLICE', 'One of them had a fat envelope in his shirt, sealed with a gold crest: a lion holding a key.', 'blue'); A.hit = null; }
      else if (H.t > 90 && H.cops.every(g => Math.hypot(g.pos.x - player.pos.x, g.pos.z - player.pos.z) > 70)) { for (const g of H.cops) g.remove(); A.hit = null; }
      return;
    }
    if (H.squad.every(t => !t.alive) && (!H.gun || !H.gun.alive)) {
      game.addRespect(800, 'SURVIVED THE BLADES');
      hud.notice('A CALLING CARD', 'One of them had a card in his pocket: no name, no number. Just a gold crest of a lion holding a key.', 'blue');
      game.story.flags.patronCards = (game.story.flags.patronCards || 0) + 1;
      A.hit = null;
    } else if (H.t > 120 && H.squad.every(t => !t.alive || Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z) > 60)) { for (const t of H.squad) t.remove(); A.hit = null; }
  }
  // ---- Red Caps cult blockade: they seal a whole junction, stop every vehicle, hold people ----
  A.block = null; A.blockCd = 200 + Math.random() * 150;
  function startBlockade() {
    const cands: any[] = [];
    for (let i = -4; i <= 10; i++) for (let j = 1; j <= 5; j++) { const x = -216 + i * 72, z = -216 + j * 72, d = Math.hypot(x - player.pos.x, z - player.pos.z); if (d > 90 && d < 260) cands.push({ x, z }); }
    const c = pick(cands); if (!c) return;
    const blocker = { x: c.x, z: c.z, active: true, hold: Infinity, cash: 0, stopped: null, cult: true };
    game.traffic.blockers.push(blocker);
    const cult = [], hostages = [], props = [];
    const W = ['machete', 'machete', 'axe', 'machete', 'knife', 'machete', 'axe'];
    W.forEach((w, k) => { const a = k / W.length * 6.28; cult.push(h.thug({ x: c.x + Math.sin(a) * 7, z: c.z + Math.cos(a) * 7, variant: k === 2 ? 'brute' : k % 2 ? 'redcap2' : 'redcap', weapon: w, role: 'guard', group: cult })); });
    for (let k = 0; k < 3; k++) { const v = h.victim({ x: c.x - 2 + k * 2, z: c.z + 1, yaw: 0, mood: 'captive' }); v.name = ['a danfo driver', 'a trader', 'a student'][k]; hostages.push(v); }
    for (const [dx, dz] of <any[]>[[-5, -5], [5, -5], [-5, 5], [5, 5]]) { // burning tyres at the corners
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.16, 6, 12), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ff6d00', emissiveIntensity: 0.6 })); m.rotation.x = Math.PI / 2; m.position.set(c.x + dx, 0.2, c.z + dz); scene.add(m); props.push(m);
    }
    A.block = { c, blocker, cult, hostages, props, area: world.areaAt(c.x, c.z) };
    hud.banner('RED CAPS BLOCKADE', `${A.block.area} is sealed. Cutlasses, burning tyres, people held. Nobody passes.`, 'red', 4);
    game.radio?.say(`Red Caps don block ${A.block.area}! No motor fit pass, dem dey hold people. Police? Police dey watch from far.`); audio.alert();
  }
  function updateBlockade(dt) {
    A.blockCd -= dt;
    if (!A.block) { if (A.blockCd <= 0 && !game.story.active && !game.carrying && !player.cuffed && !L.inside) { A.blockCd = 420 + Math.random() * 300; startBlockade(); } return; }
    const B2 = A.block;
    for (const m of B2.props) game.fx && Math.random() < dt * 4 && game.fx.burst(m.position.x, 0.8, m.position.z, 0x333333, 2, 1);
    if (B2.cult.every(t => !t.alive) && B2.hostages.every(v => v.mood !== 'captive')) {
      const i = game.traffic.blockers.indexOf(B2.blocker); if (i >= 0) game.traffic.blockers.splice(i, 1);
      for (const m of B2.props) scene.remove(m);
      game.addRespect(1200, 'BLOCKADE BROKEN'); game.life.wallet += 2000;
      hud.notice('ROAD OPEN', `${B2.area} is moving again. The horns start up like a celebration.`, 'green');
      A.block = null;
    }
  }
  A.update = (dt) => {
    updateBlockade(dt);
    updateHit(dt); updateSnatch(dt); updateJob(dt); updateSkate(dt); updateRobbery(dt); updateRun(dt); updateGoslow(dt); updateSprint(dt); };
  A.option = () => {
    if (L.inside || !['foot', 'board'].includes(player.mode)) return null;
    if (!A.job && L.phase === 'day' && d2(stall, player.pos) < 3.2 * 3.2) return { kind: 'activity', what: 'job', text: '<span class="key">F</span>Take a delivery job from Mama Nkechi (paid, timed)' };
    if (!A.skate && d2({ x: pitch.x, z: pitch.z - 6 }, player.pos) < 4 * 4) return { kind: 'activity', what: 'skate', text: '<span class="key">F</span>Start the skate challenge (45 seconds: tricks, grinds, flips)' };
    return null;
  };
  A.doOption = (opt) => {
    if (opt.what === 'job') { startJob(); return true; }
    if (opt.what === 'skate') { A.skate = { t: 45, start: game.respect }; hud.notice('SKATE CHALLENGE', '45 seconds. 800 points pays, 1,500 pays well. Go!', 'blue'); audio.pickup(); return true; }
    return false;
  };
  // what he started himself (job, challenge, run, sprint, the go-slow he walked into) vs trouble that just popped up
  A.activeTarget = () => {
    if (A.sprint) return { x: SPRINT.end.x, z: SPRINT.end.z, label: 'ADENIJI ADELE' };
    if (A.goslow) { const t = A.goslow.robbers.filter(q => !q.done).sort((a, b) => d2(a.pos, player.pos) - d2(b.pos, player.pos))[0]; if (t) return { x: t.pos.x, z: t.pos.z, label: 'ROBBER', moving: true }; }
    if (A.run && A.course) { const r = A.course.rings[A.run.i]; return { x: r.x, z: r.z, label: 'RING' }; }
    if (A.job) return { x: A.job.to.x, z: A.job.to.z, label: A.job.name };
    return null;
  };
  A.target = () => {
    if (A.block) { const t = A.block.cult.find(q => q.alive) || A.block.hostages.find(v => v.mood === 'captive'); if (t) return { x: t.pos.x, z: t.pos.z, label: 'BLOCKADE' }; }
    if (A.sprint) return { x: SPRINT.end.x, z: SPRINT.end.z, label: 'ADENIJI ADELE' };
    if (A.goslow) { const t = A.goslow.robbers.filter(q => !q.done).sort((a, b) => d2(a.pos, player.pos) - d2(b.pos, player.pos))[0]; if (t) return { x: t.pos.x, z: t.pos.z, label: 'ROBBER', moving: true }; }
    if (A.run && A.course) { const r = A.course.rings[A.run.i]; return { x: r.x, z: r.z, label: 'RING', moving: false }; }
    if (A.robbery) { const r = A.robbery; if (r.stage === 'chase') return { x: r.car.pos.x, z: r.car.pos.z, label: 'ROBBERS', moving: true }; const g = r.crew.find(q => q.alive && q.item); if (g) return { x: g.pos.x, z: g.pos.z, label: 'ROBBER', moving: true }; }
    if (A.job) return { x: A.job.to.x, z: A.job.to.z, label: A.job.name };
    if (A.snatch && A.snatch.thief.alive && A.snatch.thief.item) return { x: A.snatch.thief.pos.x, z: A.snatch.thief.pos.z, label: 'THIEF', moving: true };
    return null;
  };
  A.objective = () => {
    if (A.block && Math.hypot(A.block.c.x - player.pos.x, A.block.c.z - player.pos.z) < 60) { const n = A.block.cult.filter(t => t.alive).length, hs = A.block.hostages.filter(v => v.mood === 'captive').length; return `<b>Red Caps blockade</b> at ${A.block.area}: ${n} cultists, ${hs} people held<small>CUTLASSES AND AXES: DODGE THE RED "!" · FREE THE HOSTAGES (F)</small>`; }
    if (A.sprint) return `Third Mainland sprint · <b>${A.sprint.t.toFixed(1)}s</b> <small>TO THE ADENIJI ADELE INTERCHANGE · GOLD ${SPRINT.gold}s · SKITCH THE TRAFFIC</small>`;
    if (A.goslow) { const left = A.goslow.robbers.filter(q => !q.done).length; return `<b>Go-slow robbers</b> on Third Mainland · <b>${left} left</b><small>THE "HAWKERS" ROB THE STUCK CARS, THEN RUN FOR THE RAILING TO DROP INTO CANOES · CATCH THEM FIRST</small>`; }
    if (A.run && A.course) return `Rooftop run: ring <b>${A.run.i} of ${A.course.rings.length - 1}</b> · <b>${Math.ceil(A.run.t)}s</b><small>LEAP (HOLD SPACE), WALL-RUN, POUNCE (V) BETWEEN ROOFS</small>`;
    if (A.robbery?.stage === 'chase') return `<b>Stop the robbers' car</b> <small>SKATE AFTER IT · SKITCH ON (E) · F SMASHES IT (${A.robbery.car.ai.health} MORE)</small>`;
    if (A.robbery?.stage === 'fight' && A.robbery.crew.some(g => g.alive && g.item)) return '<b>Take the money back</b> from the robbers<small>THEY SHOOT: WATCH FOR THE RED LASER AND ROLL (C) · BREAK THEIR LINE OF SIGHT</small>';
    if (A.skate) return `Skate challenge: <b>${game.respect - A.skate.start} pts</b> · ${Math.ceil(A.skate.t)}s left<small>TRICKS IN THE AIR (F) · GRINDS · FLIPS · WALL-RUNS</small>`;
    if (A.job) return `Deliver ${A.job.food} to <b>${A.job.name}</b> · <b>${Math.ceil(A.job.time)}s</b><small>SKATE (R) OR SKITCH (E) · THE CYAN MARKER</small>`;
    if (A.snatch && A.snatch.thief.alive && A.snatch.thief.item) return `<b>Catch the phone snatcher!</b><small>SPRINT, POUNCE (V) OR THROW SOMETHING (T) · KNOCK HIM DOWN</small>`;
    return null;
  };
  A.tracker = () => {
    if (A.job) return { title: 'Delivery job', sub: `₦${A.job.pay.toLocaleString()} · ${Math.ceil(A.job.time)}S LEFT`, steps: [{ label: `Take ${A.job.food} to ${A.job.name}`, state: 'cur' }] };
    if (A.skate) return { title: 'Skate challenge', sub: `${Math.ceil(A.skate.t)}S LEFT`, steps: [{ label: '800 pts: ₦700', state: game.respect - A.skate.start >= 800 ? 'done' : 'cur' }, { label: '1,500 pts: ₦1,500', state: game.respect - A.skate.start >= 1500 ? 'done' : '' }] };
    return null;
  };
  A.markers = (M, MM, dstr) => {
    if (A.goslow) for (const t of A.goslow.robbers) if (!t.done && !t.removed) { M.push({ x: t.pos.x, y: t.pos.y + 2.5, z: t.pos.z, kind: 'site', label: t.state === 'idle' ? 'HAWKER?' : 'ROBBER', edge: t.state !== 'idle' }); MM.push({ x: t.pos.x, z: t.pos.z, color: '#ff3d3d' }); }
    if (game.mode === 'patrol' && !L.inside) { const p = A.sprint ? SPRINT.end : SPRINT.start; MM.push({ x: p.x, z: p.z, color: '#69f0ae' }); if (A.sprint || d2(p, player.pos) < 80 * 80) M.push({ x: p.x, y: 5, z: p.z, kind: 'escape', label: `${A.sprint ? 'FINISH' : 'BRIDGE SPRINT'} · ${dstr(p.x, p.z)}`, edge: !!A.sprint }); }
    if (A.course) { const r0 = A.course.rings[0]; if (!A.run) { MM.push({ x: r0.x, z: r0.z, color: '#69f0ae' }); if (d2(r0, player.pos) < 60 * 60) M.push({ x: r0.x, y: r0.y + 2.6, z: r0.z, kind: 'escape', label: `ROOFTOP RUN · ${dstr(r0.x, r0.z)}`, edge: false }); } else { const r = A.course.rings[A.run.i]; M.push({ x: r.x, y: r.y + 2.6, z: r.z, kind: 'escape', label: `RING ${A.run.i} · ${dstr(r.x, r.z)}` }); MM.push({ x: r.x, z: r.z, color: '#69f0ae' }); } }
    if (A.robbery) { const r = A.robbery, v = r.stage === 'chase' ? r.car : r.crew.find(g => g.alive && g.item); if (v) { M.push({ x: v.pos.x, y: v.pos.y + 2.4, z: v.pos.z, kind: 'site', label: `ROBBERS · ${dstr(v.pos.x, v.pos.z)}` }); MM.push({ x: v.pos.x, z: v.pos.z, color: '#ff3d3d' }); } }
    if (L.phase === 'day') { MM.push({ x: stall.x, z: stall.z, color: '#ff9800' }); if (d2(stall, player.pos) < 50 * 50) M.push({ x: stall.x, y: 3.2, z: stall.z, kind: 'errand', label: 'DELIVERY JOBS', edge: false }); }
    MM.push({ x: pitch.x, z: pitch.z, color: '#42a5f5' });
    if (d2(pitch, player.pos) < 60 * 60 && !A.skate) M.push({ x: pitch.x, y: 3.2, z: pitch.z - 6, kind: 'errand', label: 'SKATE CHALLENGE', edge: false });
    if (A.job) { M.push({ x: A.job.to.x, y: 2.6, z: A.job.to.z, kind: 'errand', label: `${A.job.name.toUpperCase()} · ${dstr(A.job.to.x, A.job.to.z)}` }); MM.push({ x: A.job.to.x, z: A.job.to.z, color: '#80deea' }); }
    const s = A.snatch;
    if (s && s.thief.alive && s.thief.item) { M.push({ x: s.thief.pos.x, y: s.thief.pos.y + 2.3, z: s.thief.pos.z, kind: 'site', label: `THIEF · ${dstr(s.thief.pos.x, s.thief.pos.z)}` }); MM.push({ x: s.thief.pos.x, z: s.thief.pos.z, color: '#ff3d3d' }); }
  };
  // entries for the Patrol Board
  A.board = (dist) => {
    const out: any[] = [];
    if (A.block) out.push({ kind: 'crime', title: `Red Caps blockade · ${A.block.area}`, desc: 'The cult has sealed the junction with cutlasses and burning tyres, and is holding people.', x: A.block.c.x, z: A.block.c.z, reward: '₦2,000 · huge respect', urgent: true });
    if (A.robbery) { const v = A.robbery.stage === 'chase' ? A.robbery.car : A.robbery.crew.find(g => g.alive) || A.robbery.car; out.push({ kind: 'crime', title: 'Armed robbery', desc: `Robbers hit ${A.robbery.shop}. Stop the car and take the money back.`, x: v.pos.x, z: v.pos.z, reward: 'Cash tip · big respect', urgent: true }); }
    if (A.snatch && A.snatch.thief.alive) out.push({ kind: 'crime', title: 'Phone snatcher', desc: `Catch the thief who grabbed ${A.snatch.victim.name}'s phone.`, x: A.snatch.thief.pos.x, z: A.snatch.thief.pos.z, reward: 'Tip · respect', urgent: true });
    if (A.course) { const r = A.course.rings[0]; out.push({ kind: 'run', title: 'Rooftop run', desc: `${A.course.rings.length - 1} rings across the roofs in ${A.course.par}s.`, x: r.x, z: r.z, reward: '₦800+ · respect' }); }
    if (game.mode === 'patrol') {
      if (A.goslow) { const t = A.goslow.robbers.find(q => !q.done); if (t) out.push({ kind: 'crime', title: 'Go-slow robbers · Third Mainland', desc: 'Robbers dressed as hawkers are working the stuck cars. Catch them before they drop into Makoko canoes.', x: t.pos.x, z: t.pos.z, reward: 'Big respect', urgent: true }); }
      else if (L.phase !== 'day' && A.goslowCd <= 0) out.push({ kind: 'crime', title: 'Third Mainland go-slow', desc: 'Callers say the bridge is jammed and "hawkers" are robbing motorists. Get up onto the bridge.', x: 0, z: BRIDGE.deck0 - 40, reward: 'Big respect' });
      out.push({ kind: 'run', title: 'Third Mainland sprint', desc: `Skate the bridge to the Adeniji Adele interchange on Lagos Island. Gold under ${SPRINT.gold}s.${game.stats.bridgeBest ? ` Best: ${game.stats.bridgeBest.toFixed(1)}s.` : ''}`, x: SPRINT.start.x, z: SPRINT.start.z, reward: 'Up to ₦2,500' });
    }
    out.push({ kind: 'run', title: 'Skate challenge', desc: 'Score trick points at the Area Pitch in 45 seconds.', x: pitch.x, z: pitch.z - 6, reward: 'Up to ₦1,500' });
    if (L.phase === 'day') out.push({ kind: 'job', title: 'Delivery job', desc: "Mama Nkechi pays for hot food, delivered fast.", x: stall.x, z: stall.z, reward: '₦1,000+' });
    return out;
  };
  return A;
}
