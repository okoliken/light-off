// Bolaji's day job: a rider for SwiftDrop Dispatch, without a bike. Clock in at the office in the
// morning, take the day's parcels, get each one to the customer before its deadline (skate, walk, or
// pay for danfos, kekes and okadas). Customers leave reviews; late or missing parcels hurt. Pay is
// per delivery, paid at the end of each day's shift. Rent is weekly too. Fall too low and you're sacked; come back in a couple of
// days and beg for the job. Everything here is saved.
import * as THREE from 'three';
import { Civilian } from './npcs.ts';
import { Rig, Pose, HIP_H } from '../player/rig.ts';
import { roadLine, I0, I1, N } from '../world/layout.ts';

const ITEMS = ['iPhone (sealed)', 'HP laptop', 'Jumia shoe box', 'Birthday cake', 'Pharmacy bag', 'Ankara fabric', 'Documents envelope', 'Wig in a box', 'Bluetooth speaker', 'Baby formula', 'Perfume set', 'Phone charger', 'Party jollof (cooler)', 'Agbada', 'Wristwatch'];
const NAMES = ['Mrs Adebayo', 'Chinedu', 'Aunty Funke', 'Mr Okoro', 'Tola', 'Baba Ibeji', 'Ngozi', 'Kunle', 'Mama Tobi', 'Segun', 'Blessing', 'Alhaji Musa', 'Yetunde', 'Emeka', 'Bisi', 'Pastor Femi', 'Zainab', 'Tunde Jr'];
const GOOD = ['On time. Nice one!', 'Fast and polite. 👍', 'Rider was early, God bless.', 'Package intact. Thank you.', 'Very professional.', 'Na so delivery suppose be.'];
const LATE = ['Na now you come?! I don waste my whole afternoon.', 'Late. I called three times.', 'If e late again I go report you.', 'The cake don melt. Thanks for nothing.', 'Very slow. I no go use una again.'];
const NEVER = ['Never came. I want my refund.', 'Rider disappeared with my package??', 'Scam company. Nobody delivered.'];
const RIVALS = ['Kola "Speed" Adeyemi', 'Ifeanyi', 'Sule'];
const PAY_ON_TIME = 1200, PAY_LATE = 600, RENT = 12000;
// Three shifts a day. The morning is his rostered shift (miss it and it's a strike); the afternoon and
// the night are extra work for extra money. The night pays best and lands right on top of the boy in
// black's hours, so the two lives fight over the same streets. Times are minutes from midnight (the
// night's run past 24:00, as the clock does).
const SHIFTS: Record<string, any> = {
  morning: { name: 'Morning', open: 6.5 * 60, close: 12 * 60, lastDue: 13.5 * 60, end: 14 * 60, pay: PAY_ON_TIME, late: PAY_LATE, rostered: true },
  afternoon: { name: 'Afternoon', open: 12.5 * 60, close: 16 * 60, lastDue: 18.75 * 60, end: 19.5 * 60, pay: PAY_ON_TIME, late: PAY_LATE },
  night: { name: 'Night', open: 22 * 60, close: 24.5 * 60, lastDue: 26.5 * 60, end: 27 * 60, pay: 1800, late: 900 },
};
const SHIFT_ORDER = ['morning', 'afternoon', 'night'];
const fmt = (m) => { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createJob(game) {
  const { scene, world, hud, player, audio } = game;
  const L = game.life, DAY = game.day;
  // ---- the office: SwiftDrop Dispatch, near Ojuelegba ----
  const want = { x: 60, z: -110 };
  const s = world.spots.filter(q => !(q.bi === 1 && q.bj === 1) && q.bi !== 4 && world.vendors.every(v => Math.hypot(v.x - q.x, v.z - q.z) > 12) && (world.busStops || []).every(b => Math.hypot(b.x - q.x, b.z - q.z) > 15))
    .sort((a, b) => Math.hypot(a.x - want.x, a.z - want.z) - Math.hypot(b.x - want.x, b.z - want.z))[0];
  DAY.sign(s, 'SWIFTDROP DISPATCH · RIDERS', '#e65100', '#ffffff', 4.2);
  const office = { x: s.x - s.nx * 0.2, z: s.z - s.nz * 0.2, name: 'SwiftDrop Dispatch (Ojuelegba)' };
  { // parcel shelves against the wall, and the people there every morning
    const m = new THREE.MeshStandardMaterial({ color: '#8d6e63', roughness: 0.8 }), box = new THREE.MeshStandardMaterial({ color: '#c8a26a', roughness: 0.9 });
    const ax = -s.nz, az = s.nx;
    for (let k = 0; k < 3; k++) { const sh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.6), m); sh.position.set(s.x - s.nx * 1.5 + ax * 2.6, 0.5 + k * 0.6, s.z - s.nz * 1.5 + az * 2.6); sh.rotation.y = Math.atan2(s.nx, s.nz); scene.add(sh);
      for (let b = 0; b < 3; b++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.35), box); p.position.set(sh.position.x + ax * (b - 1) * 0.5, sh.position.y + 0.19, sh.position.z + az * (b - 1) * 0.5); scene.add(p); } }
    const mgr = new Civilian(scene, world, { x: s.x - s.nx * 1.2 - ax * 1.5, z: s.z - s.nz * 1.2 - az * 1.5, yaw: Math.atan2(s.nx, s.nz), outfit: { skin: '#4a2e1f', top: '#fafafa', bottom: '#263238', sock: '#212121', sole: '#212121', cap: null, sheen: '#556070' } });
    mgr.name = 'Mr Tunde'; mgr.mood = 'idle'; game.civilians.push(mgr);
    for (let k = 0; k < 2; k++) { const r = new Civilian(scene, world, { x: s.x + s.nx * 1.5 + ax * (3 + k * 1.2), z: s.z + s.nz * 1.5 + az * (3 + k * 1.2), yaw: Math.atan2(-ax, -az), outfit: { skin: k ? '#3e2418' : '#5b3a26', top: '#e65100', bottom: '#212121', sock: '#212121', sole: '#212121', cap: '#e65100', sheen: '#556070' } }); r.name = RIVALS[k + 1]; r.mood = 'idle'; game.civilians.push(r); }
  }

  const J: any = {
    office, employed: true, hasCycle: false, cycleAt: null, day: 0, clockedIn: false, shiftOver: false, shift: null, shiftsDone: [], orders: [], reviews: [], weekEarned: 0, weekDone: 0, daysWorked: 0, strikes: 0,
    rehireDay: 0, rentDue: 7, rentDebt: 0, payDay: 7, unpaid: 0, rivals: RIVALS.map(n => ({ name: n, week: 0, rating: 3.8 + Math.random() * 0.9 })), firedTold: false,
  };
  J.rating = () => { const r = J.reviews.slice(-20); return r.length ? r.reduce((a, q) => a + q.stars, 0) / r.length : 4.2; };
  const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  // the day's parcels: spread over the city, deadlines staggered through the morning and afternoon
  function makeOrders(sh = SHIFTS.morning) {
    const n = sh.rostered ? Math.min(12, 6 + Math.floor(J.daysWorked / 2)) : 3 + Math.floor(Math.random() * 3);
    const gap = Math.max(14, (sh.lastDue - L.clock - 50) / n);
    const pl = game.places().filter(q => !['home', 'food'].includes(q.kind) && !/bus stop|ferry|SwiftDrop/i.test(q.name)).map(q => ({ q, d: Math.hypot(q.x - office.x, q.z - office.z) })).filter(o => o.d > 80 && (o.q.z > -1100 || Math.random() < 0.25));
    const out: any[] = [];
    for (let k = 0; k < n && pl.length; k++) {
      const o = pl.splice(Math.floor(Math.random() * pl.length), 1)[0];
      const due = L.clock + 50 + k * gap + o.d / 9;
      out.push({ id: k, item: pick(ITEMS), who: pick(NAMES), place: { name: o.q.name, x: o.q.x, z: o.q.z, area: o.q.area }, due: Math.min(due, sh.lastDue), status: 'pending', pay: sh.pay, latePay: sh.late });
    }
    return out.sort((a, b) => a.due - b.due);
  }
  const pending = () => J.orders.filter(o => o.status === 'pending');
  const openShift = () => J.clockedIn ? null : SHIFT_ORDER.find(id => !J.shiftsDone.includes(id) && L.clock >= SHIFTS[id].open && L.clock < SHIFTS[id].close) || null;
  const laterShift = () => SHIFT_ORDER.find(id => !J.shiftsDone.includes(id) && L.clock < SHIFTS[id].open) || null;
  J.shiftName = () => J.shift ? SHIFTS[J.shift].name : null;
  // the customers themselves: they come out and wait at the address when you're close, wave you over,
  // and react when the parcel lands (or doesn't). Spawned near you only, so the city isn't full of them.
  const FITS = [['#c62828', '#212121'], ['#1565c0', '#263238'], ['#fafafa', '#3e2723'], ['#6a1b9a', '#4a148c'], ['#2e7d32', '#212121'], ['#f9a825', '#3e2723'], ['#00838f', '#263238']];
  const npcs = new Map();
  const spawnCustomer = (o) => {
    const [top, bottom] = FITS[o.id % FITS.length], skin = ['#4a2e1f', '#5b3a26', '#3e2418', '#6d4530'][o.id % 4];
    const fem = /Mrs|Aunty|Mama|Ngozi|Tola|Blessing|Yetunde|Bisi|Zainab|Funke/.test(o.who);
    const c = new Civilian(scene, world, { x: o.place.x, z: o.place.z, yaw: Math.random() * 6, outfit: { skin, top, bottom, sock: '#3e2723', sole: '#2b2b2b', cap: fem ? null : (o.id % 3 === 0 ? '#212121' : null), sheen: '#556070' } });
    c.name = o.who; c.mood = 'idle'; c.faceTarget = player.pos; game.civilians.push(c); npcs.set(o.id, c); return c;
  };
  const dropCustomer = (o, leave = true) => { const c = npcs.get(o.id); if (!c) return; npcs.delete(o.id); if (c.gone) return; if (leave) setTimeout(() => c.gone || c.runHome(c.pos.x + (Math.random() - 0.5) * 40, c.pos.z + (Math.random() - 0.5) * 40), 2500); else c.remove(scene); };
  const updateCustomers = () => {
    for (const o of J.orders) {
      const c = npcs.get(o.id), d = Math.hypot(o.place.x - player.pos.x, o.place.z - player.pos.z);
      if (o.status !== 'pending') { if (c) dropCustomer(o, true); continue; }
      if (!c && d < 70) spawnCustomer(o);
      else if (c && d > 110) dropCustomer(o, false);
      else if (c) c.mood = d < 14 ? (L.clock > o.due ? 'chat' : 'wave') : 'idle'; // waving you over (or, late, on the phone complaining)
    }
    for (const [id, c] of npcs) if (!J.orders.some(o => o.id === id)) { npcs.delete(id); if (!c.gone) c.remove(scene); }
  };
  // the parcel to go for: one you're already near (say, after riding out to the Island) before the
  // earliest-due one, so the arrow never turns you round and sends you back across the bridge
  const next = () => {
    const ps = pending(), d = (o) => Math.hypot(o.place.x - player.pos.x, o.place.z - player.pos.z);
    return ps.filter(o => d(o) < 220).sort((a, b) => d(a) - d(b))[0] || ps.sort((a, b) => a.due - b.due)[0];
  };
  const routeNext = () => { const o = next(); if (o) game.setWaypoint({ x: o.place.x, z: o.place.z, title: `${o.who} · ${o.place.name}` }, true); else game.setWaypoint({ x: office.x, z: office.z, title: J.clockedIn ? 'SwiftDrop: all delivered, clock out' : 'SwiftDrop office · clock in' }, true); };

  function review(o, kind) {
    const late = kind === 'late', never = kind === 'never';
    const st = never ? 1 : late ? Math.max(1, 3 - Math.floor((L.clock - o.due) / 40)) : (o.due - L.clock > 20 ? 5 : 4 + (Math.random() < 0.5 ? 1 : 0));
    const r = { who: o.who, stars: Math.min(5, st), text: never ? pick(NEVER) : late ? pick(LATE) : pick(GOOD), day: L.night };
    J.reviews.push(r); return r;
  }

  // ---- interactions ----
  J.option = () => {
    if (L.inside || game.inMall) return null;
    const p = player.pos;
    if (Math.hypot(office.x - p.x, office.z - p.z) < 3.4) {
      if (!J.employed) return L.night >= J.rehireDay ? { kind: 'job', act: 'rehire', text: '<span class="key">F</span>Beg Mr Tunde for your job back' } : { kind: 'none', text: `Mr Tunde: "Come back in ${J.rehireDay - L.night} day${J.rehireDay - L.night > 1 ? 's' : ''}. Make I cool down first."` };
      if (!J.clockedIn) {
        const sh = openShift(), nx = laterShift();
        if (sh && L.suit) return { kind: 'none', text: 'Mr Tunde won\'t let a masked boy near the parcels. Change out of the suit first (<span class="key">U</span>).' };
        if (sh) return { kind: 'job', act: 'clockin', shift: sh, text: `<span class="key">F</span>Clock in for the <b>${SHIFTS[sh].name.toLowerCase()} shift</b> <small style="opacity:.8">(₦${SHIFTS[sh].pay.toLocaleString()} a parcel)</small>` };
        return { kind: 'none', text: nx ? `The ${SHIFTS[nx].name.toLowerCase()} shift starts at ${fmt(SHIFTS[nx].open)}.` : 'No more shifts today. Come back in the morning.' };
      }
      if (J.clockedIn && !pending().length) return { kind: 'job', act: 'clockout', text: '<span class="key">F</span>Clock out (all parcels delivered)' };
    }
    const o = pending().find(q => { const c = npcs.get(q.id), t = c && !c.gone ? c.pos : q.place; return Math.hypot(t.x - p.x, t.z - p.z) < 3.2; });
    if (o && L.suit) return { kind: 'none', text: `${o.who} backs away: a masked boy with their ${o.item.toLowerCase()}? Change out of the suit first (<span class="key">U</span>).` };
    if (o) return { kind: 'job', act: 'deliver', o, text: `<span class="key">F</span>Hand over <b>${o.item}</b> to ${o.who}${L.clock > o.due ? ' <small style="color:#ff8a80">(LATE)</small>' : ''}` };
    return null;
  };
  J.act = (opt) => {
    if (opt.act === 'clockin') {
      const sh = SHIFTS[opt.shift || openShift() || 'morning'];
      J.shift = opt.shift || openShift() || 'morning'; J.clockedIn = true; J.orders = makeOrders(sh); audio.pickup();
      if (L.wear && L.wear !== 'uniform') { L.wear = 'uniform'; hud.popup('UNIFORM ON'); }
      game.refreshFit?.();
      if (!J.hasCycle) { // first shift: the company bicycle and the delivery box
        J.hasCycle = true; const ax = -s.nz, az = s.nx; player.parkCycle(office.x + ax * 2.2 + s.nx * 1.2, office.z + az * 2.2 + s.nz * 1.2, Math.atan2(ax, az)); game.refreshBag?.();
        setTimeout(() => hud.banner('YOUR SWIFTDROP BICYCLE', 'Mr Tunde hands you a company bicycle and an orange delivery box. F to get on, R to get off. Break it, you pay for it.', 'white', 5), 3400);
      }
      hud.say('Mr Tunde', pick([`${J.orders.length} drops today. Customers dey wait. No story.`, 'Oya, carry your parcels. Last week complain too much o.', `Your rating na ${J.rating().toFixed(1)}. Kola dey do better than you.`]), 3.5);
      hud.banner(`${sh.name.toUpperCase()} SHIFT`, `${J.orders.length} parcels · first one due ${fmt(J.orders[0].due)} · J for the job sheet`, 'white', 3.2);
      if (L.night >= J.payDay) newWeek();
      routeNext(); game.save(); return true;
    }
    if (opt.act === 'deliver') {
      const o = opt.o, late = L.clock > o.due; o.status = late ? 'late' : 'done';
      { const c = npcs.get(o.id); if (c && !c.gone) { c.mood = late ? 'idle' : 'cheer'; c.faceTarget = player.pos; } }
      const r = review(o, late ? 'late' : 'ok'), pay = late ? (o.latePay ?? PAY_LATE) : (o.pay ?? PAY_ON_TIME);
      J.weekEarned += pay; J.weekDone++; J.unpaid += pay; audio.pickup();
      hud.say(o.who, late ? pick(['Na now?!', 'Abeg, just give me.', 'Hmm. Late again.']) : pick(['Thank you!', 'Ah, fast! God bless.', 'Nice one, rider.']), 2.5);
      hud.toast(`${stars(r.stars)} <b>${o.who}</b>: "${r.text}"<br><small>+₦${pay.toLocaleString()} · ₦${J.unpaid.toLocaleString()} to collect at clock-out · rating ${J.rating().toFixed(1)}</small>`, late ? 'red' : 'green');
      routeNext(); game.save(); return true;
    }
    if (opt.act === 'clockout') { endShift(false, true); return true; }
    if (opt.act === 'rehire') {
      J.employed = true; J.strikes = 0; J.reviews = J.reviews.slice(-4).map(r => ({ ...r, stars: Math.max(r.stars, 3) })); J.clockedIn = false; J.shift = null; J.firedTold = false;
      game.refreshFit?.(); // uniform back on
      hud.say('Mr Tunde', 'Last chance. If one more customer complain, you go find another work.', 4);
      hud.banner('REHIRED', 'Back on the SwiftDrop roster. Clock in tomorrow morning (or now, before noon).', 'green', 3.5); game.save(); return true;
    }
    return false;
  };
  // turning a parcel down: it goes to whichever SwiftDrop rider is nearest the address. The customer
  // still gets it on time, so no bad review, but the pay goes with it
  const takerFor = (o) => { const by = riders.map(r => ({ r, d: Math.hypot(r.x - o.place.x, r.z - o.place.z) })).sort((a, b) => a.d - b.d)[0]; return by ? by.r.name : RIVALS[0]; };
  J.pass = (id) => {
    const o = J.orders.find(q => q.id === id);
    if (!J.clockedIn || !o || o.status !== 'pending') return false;
    const name = takerFor(o), late = L.clock > o.due;
    o.status = 'passed'; o.by = name; o.lost = o.pay ?? PAY_ON_TIME;
    if (late) J.reviews.push({ who: o.who, stars: 2, text: pick([`${name} finally brought it. Late, but it came.`, 'The first rider gave up on me. Another one came.', 'Waited all morning. At least somebody showed up.']), day: L.night }); // already late: the customer still remembers
    const rv = J.rivals.find(q => q.name === name); if (rv) rv.week++;
    hud.say('Mr Tunde (phone)', pick([`Okay. ${name} dey near ${o.place.name}, he go carry am. That one no go enter your pay o.`, `${name} go take am. Na your money you dash am.`, `Fine. ${name} will do it. Don't make it a habit.`]), 4);
    hud.toast(`<b>${o.item}</b> for ${o.who} passed to <b>${name}</b> · <span style="color:#ff8a80">−₦${o.lost.toLocaleString()} from today's pay</span>`, 'blue');
    routeNext(); game.save(); return true;
  };
  // the weekly table with the other riders starts again (the money itself is paid every day)
  function newWeek() { J.weekEarned = 0; J.weekDone = 0; J.payDay = L.night + 7; for (const r of J.rivals) r.week = 0; }
  // the day's pay: in Mr Tunde's hand at the office, or by transfer when the shift runs out on the road
  function payOut(atOffice) {
    if (!(J.unpaid > 0)) return;
    const got = J.unpaid; L.wallet += got; J.unpaid = 0; audio.pickup();
    setTimeout(() => hud.banner('PAID', atOffice ? `Mr Tunde counts out ₦${got.toLocaleString()} for today's drops.` : `SwiftDrop sent ₦${got.toLocaleString()} for today's drops.`, 'green', 3.5), 4700);
    hud.toast(`<b>+₦${got.toLocaleString()}</b> today's pay · wallet ₦${L.wallet.toLocaleString()}`, 'green');
  }
  function endShift(timeUp = false, atOffice = false) {
    if (!J.clockedIn) return;
    let missed = 0;
    for (const o of J.orders) if (o.status === 'pending') { o.status = 'failed'; review(o, 'never'); missed++; }
    if (J.shift === 'morning') J.daysWorked++;
    if (J.shift && !J.shiftsDone.includes(J.shift)) J.shiftsDone.push(J.shift);
    J.clockedIn = false; J.shiftOver = true; J.shift = null;
    for (const r of J.rivals) { const d = 6 + Math.floor(Math.random() * 7); r.week += d; r.rating = Math.max(3, Math.min(5, r.rating + (Math.random() - 0.45) * 0.2)); }
    const done = J.orders.filter(o => o.status === 'done').length, late = J.orders.filter(o => o.status === 'late').length; missed += J.orders.filter(o => o.status === 'reassigned').length;
    const passed = J.orders.filter(o => o.status === 'passed').length;
    hud.banner(timeUp ? 'SHIFT OVER' : 'CLOCKED OUT', `${done} on time · ${late} late · ${missed} never delivered${passed ? ` · ${passed} passed on (−₦${J.orders.filter(o => o.status === 'passed').reduce((n, o) => n + (o.lost || 0), 0).toLocaleString()})` : ''} · rating ${J.rating().toFixed(1)}`, missed || late > done ? 'red' : 'green', 4.5);
    payOut(atOffice);
    const nx = laterShift();
    if (J.employed) setTimeout(() => hud.toast(`Off duty.${nx ? ` The <b>${SHIFTS[nx].name.toLowerCase()} shift</b> starts at ${fmt(SHIFTS[nx].open)}${nx === 'night' ? ' (better pay, but the night is Street Cat\'s too)' : ''}.` : ''} At home you can change out of the uniform.`, 'blue'), 5200);
    if ((J.reviews.length >= 6 && J.rating() < 2.8) || J.strikes >= 3) fire(J.strikes >= 3 ? 'You keep not showing up.' : 'Too many complaints.');
    game.setWaypoint(null); game.save();
  }
  function fire(why) {
    J.employed = false; J.clockedIn = false; J.rehireDay = L.night + 2;
    if (J.hasCycle) { J.hasCycle = false; if (player.mode === 'bike' && player.kind === 'bicycle') { player.mode = 'foot'; } player.cycle = null; player.parkCycle(office.x, office.z, 0); player.cycle = null; game.refreshBag?.(); setTimeout(() => game.player.parkCycle && (game.player.cycle = null), 0); }
    game.refreshFit?.(); // uniform off
    hud.banner('SACKED', `Mr Tunde: "${why} Submit your bag. Go."`, 'red', 5);
    hud.toast('You can go back to SwiftDrop in <b>2 days</b> and beg for the job. Until then: rent still dey come.', 'red');
  }
  function newDay() {
    if (J.clockedIn) endShift(true);
    J.day = L.night; J.clockedIn = false; J.shiftOver = false; J.shift = null; J.shiftsDone = []; J.orders = []; J.noShowTold = false;
    { const k = L.items, min = { pepper: 2, smoke: 1, nails: 1 }; let got = false; for (const q in min) if ((k[q] || 0) < min[q]) { k[q] = min[q]; got = true; } if (got) hud.toast('You restocked your kit from the stash under your mat: <b>pepper, ash, a nail plank</b>.', 'blue'); } // a new day: the stash at home tops the kit up
    if (L.night >= J.rentDue) {
      if (L.wallet >= RENT + J.rentDebt) { L.wallet -= RENT + J.rentDebt; J.rentDebt = 0; hud.toast(`The landlord collected <b>₦${RENT.toLocaleString()}</b> rent this morning.`, 'blue'); }
      else { J.rentDebt += RENT; hud.say('Landlord', J.rentDebt > RENT ? 'Two weeks now! If I no see my money, I go throw your things outside.' : 'Bolaji, where my rent? I no dey beg you o.', 4); }
      J.rentDue = L.night + 7;
    }
    if (J.employed) hud.notice(`DAY ${L.night}`, `Clock in at SwiftDrop before noon. Extra shifts in the afternoon and at night.`, 'white', 3);
  }

  J.update = (dt) => {
    if (J.day !== L.night) newDay();
    updateRiders(dt);
    if (!J.employed) return;
    // didn't show up
    if (!J.clockedIn && !J.shiftsDone.includes('morning') && L.phase === 'day' && L.clock >= 12 * 60 && !J.noShowTold) { J.noShowTold = true; J.strikes++; hud.say('Mr Tunde (phone)', J.strikes >= 3 ? 'Don\'t bother coming tomorrow.' : 'Where are you?! Parcels dey here waiting.', 4); if (J.strikes >= 3) fire('You keep not showing up.'); }
    updateCustomers();
    if (J.clockedIn) {
      for (const o of pending()) {
        if (!o.warned && L.clock > o.due) { o.warned = true; hud.toast(`📞 <b>${o.who}</b> is calling: "Where is my ${o.item.toLowerCase()}?!" (now late)`, 'red'); }
        if (!o.warned2 && L.clock > o.due + 20) { o.warned2 = true; hud.toast(`📞 <b>${o.who}</b> again: "${pick(['I need this thing TODAY. My shop dey wait.', 'If you no reach in 20 minutes I go cancel and report you!', 'Abeg, na for my mama hospital bill this thing be.'])}"`, 'red'); }
        if (L.clock > o.due + 45) { // too late: the office gives it to someone else
          const r = J.rivals[Math.floor(Math.random() * J.rivals.length)];
          o.status = 'reassigned'; o.by = r.name; r.week++;
          J.reviews.push({ who: o.who, stars: 1, text: pick([`Another rider (${r.name}) finally brought it. Never again.`, 'Had to call the office. Shameful.', 'Your colleague saved you. I\'m reporting the first rider.']), day: L.night });
          hud.say('Mr Tunde (phone)', `I don give ${o.who}'s ${o.item.toLowerCase()} to ${r.name}. You dey sleep?!`, 4);
          hud.toast(`<b>${o.item}</b> for ${o.who} was taken off your list and given to <b>${r.name}</b>. ★☆☆☆☆`, 'red');
          routeNext();
        }
      }
      if (L.clock >= SHIFTS[J.shift || 'morning'].end) endShift(true);
    }
  };
  // ---- what the HUD shows ----
  J.tracker = () => {
    if (!J.employed) return { title: 'Unemployed', sub: `RENT ₦${(RENT + J.rentDebt).toLocaleString()} DUE DAY ${J.rentDue}`, steps: [{ label: L.night >= J.rehireDay ? 'Go back to SwiftDrop and beg for the job' : `SwiftDrop will see you again on day ${J.rehireDay}`, state: 'cur' }] };
    if (!J.clockedIn) {
      const sh = openShift(), nx = laterShift();
      if (sh) return { title: 'SwiftDrop Dispatch', sub: `★ ${J.rating().toFixed(1)} · ${SHIFTS[sh].name.toUpperCase()} SHIFT OPEN TILL ${fmt(SHIFTS[sh].close).toUpperCase()}`, steps: [{ label: SHIFTS[sh].rostered ? 'Go to the office at Ojuelegba and clock in' : `Extra work: clock in at Ojuelegba (₦${SHIFTS[sh].pay.toLocaleString()} a parcel)`, state: 'cur' }] };
      return J.shiftOver || nx ? { title: 'SwiftDrop · off duty', sub: `★ ${J.rating().toFixed(1)} · ₦${J.weekEarned.toLocaleString()} THIS WEEK · PAID EVERY SHIFT`, steps: [{ label: nx ? `${SHIFTS[nx].name} shift at ${fmt(SHIFTS[nx].open)}` : 'Free time. Rent due day ' + J.rentDue, state: '' }] } : null;
    }
    const ps = pending(), done = J.orders.length - ps.length;
    return { title: `SwiftDrop · ${J.shiftName()} shift`, sub: `★ ${J.rating().toFixed(1)} · ${done}/${J.orders.length} DELIVERED · J: JOB SHEET`, steps: ps.slice(0, 4).map((o, k) => ({ label: `${o.who} · ${o.item} · ${o.place.name} · ${L.clock > o.due ? 'LATE' : 'by ' + fmt(o.due)}`, state: k === 0 ? 'cur' : '' })) };
  };
  // what to do right now, for the objective line and the guide arrow
  J.target = () => {
    if (!J.employed) return L.night >= J.rehireDay && L.phase === 'day' ? { x: office.x, z: office.z, label: 'SWIFTDROP · ASK FOR YOUR JOB' } : null;
    if (!J.clockedIn) { const sh = openShift(); return sh && SHIFTS[sh].rostered && !L.suit ? { x: office.x, z: office.z, label: 'SWIFTDROP · CLOCK IN' } : null; } // only the rostered shift pulls the arrow
    const o = next(); if (o) { const c = npcs.get(o.id), t = c && !c.gone ? c.pos : o.place; return { x: t.x, z: t.z, label: `${o.who.toUpperCase()} · ${o.item.toUpperCase()}` }; }
    return { x: office.x, z: office.z, label: 'SWIFTDROP · CLOCK OUT' };
  };
  J.objective = () => {
    if (L.inside) return null;
    if (!J.employed) return L.night >= J.rehireDay && L.phase === 'day' ? `No job. <b>Go to SwiftDrop and ask for it back</b><small>RENT ₦${(RENT + J.rentDebt).toLocaleString()} DUE DAY ${J.rentDue}</small>` : `No job until day ${J.rehireDay}<small>RENT ₦${(RENT + J.rentDebt).toLocaleString()} DUE DAY ${J.rentDue} · THE SUIT COMES OUT AT NIGHT</small>`;
    if (!J.clockedIn) {
      const sh = openShift(), nx = laterShift();
      if (L.suit) return null; // the night is Street Cat's
      if (sh && SHIFTS[sh].rostered) return `Get to <b>SwiftDrop</b> and clock in<small>OJUELEGBA · BEFORE NOON · ON THE BICYCLE OR ON FOOT</small>`;
      if (sh) return `<b>${SHIFTS[sh].name} shift</b> open at SwiftDrop till ${fmt(SHIFTS[sh].close)}<small>EXTRA WORK · ₦${SHIFTS[sh].pay.toLocaleString()} A PARCEL · OR TAKE THE TIME FOR YOURSELF</small>`;
      if (nx) return `Off duty · <b>₦${L.wallet.toLocaleString()}</b> in your pocket<small>${SHIFTS[nx].name.toUpperCase()} SHIFT AT ${fmt(SHIFTS[nx].open)} · RENT ₦${(RENT + J.rentDebt).toLocaleString()} DUE DAY ${J.rentDue}</small>`;
      return `Off duty · <b>₦${L.wallet.toLocaleString()}</b> in your pocket<small>₦${J.weekEarned.toLocaleString()} EARNED THIS WEEK · RENT ₦${(RENT + J.rentDebt).toLocaleString()} DUE DAY ${J.rentDue} · EAT, REST, OR CHANGE INTO THE SUIT (U) WHERE NOBODY SEES</small>`;
    }
    const o = next(), left = pending().length;
    if (!o) return 'All delivered. <b>Clock out at SwiftDrop</b><small>OR KEEP WORKING THE STREETS</small>';
    const late = L.clock > o.due, mins = Math.round(Math.abs(o.due - L.clock));
    return `Deliver <b>${o.item}</b> to <b>${o.who}</b> · ${o.place.name}<small>${late ? `<span style="color:#ff8a80">LATE ${mins} MIN · THEY KEEP CALLING</span>` : `DUE IN ${mins} MIN`} · ${left} PARCEL${left > 1 ? 'S' : ''} LEFT · J: JOB SHEET</small>`;
  };
  J.markers = (M, MM, dstr) => {
    if (J.employed && openShift()) { MM.push({ x: office.x, z: office.z, color: '#ff9100' }); M.push({ x: office.x, y: 3.4, z: office.z, kind: 'deliver', label: `SWIFTDROP · CLOCK IN · ${dstr(office.x, office.z)}` }); }
    if (!J.employed && L.night >= J.rehireDay) MM.push({ x: office.x, z: office.z, color: '#ff9100' });
    for (const o of pending()) { MM.push({ x: o.place.x, z: o.place.z, color: L.clock > o.due ? '#ff5252' : '#ffab40' }); if (o === next()) M.push({ x: o.place.x, y: 3, z: o.place.z, kind: 'deliver', label: `${o.who.toUpperCase()} · ${dstr(o.place.x, o.place.z)}` }); }
  };
  J.sheet = () => ({ rating: J.rating(), stars: stars(J.rating()), employed: J.employed, clockedIn: J.clockedIn, shift: J.shiftName(), orders: J.orders.map(o => ({ ...o, dueStr: fmt(o.due), late: L.clock > o.due, km: Math.hypot(o.place.x - player.pos.x, o.place.z - player.pos.z) / 1000, lateBy: Math.round(L.clock - o.due), canPass: J.clockedIn && o.status === 'pending', takes: o.status === 'pending' ? takerFor(o) : null })),
    rentDays: J.rentDue - L.night,
    pass: (id) => { J.pass(id); return J.sheet(); }, payEach: J.shift ? SHIFTS[J.shift].pay : PAY_ON_TIME, reviews: J.reviews.slice(-6).reverse(),
    weekEarned: J.weekEarned, weekDone: J.weekDone, payDay: J.payDay, unpaid: J.unpaid, rentDue: J.rentDue, rent: RENT + J.rentDebt, rivals: J.rivals.map(r => ({ ...r })).concat([{ name: 'Bolaji (you)', week: J.weekDone, rating: J.rating(), me: true }]).sort((a, b) => b.week - a.week), day: L.night });
  J.officePlace = () => ({ name: office.name, x: office.x, z: office.z, kind: 'place' });
  // ---- the other SwiftDrop riders, out on their bicycles all day ----
  const riders = J.rivals.map((r, k) => {
    const g = new THREE.Group(), m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
    for (const z of [0.55, -0.55]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 18), m('#111')); w.rotation.y = Math.PI / 2; w.position.set(0, 0.34, z); g.add(w); }
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.0), m('#e65100')); fr.position.set(0, 0.62, 0); g.add(fr);
    const rig = new Rig({ skin: ['#5b3a26', '#3e2418', '#6d4530'][k], top: '#e65100', bottom: '#212121', sock: '#212121', sole: '#212121', cap: '#e65100', sheen: '#556070', scale: 1.02 });
    Pose.idle(rig, 0, false); rig.set('hipsY', HIP_H - 0.35); rig.set('thLX', -1.2); rig.set('thRX', -1.2); rig.set('knLX', 1.0); rig.set('knRX', 1.0); rig.set('spineX', 0.35); rig.set('shLX', -1.2); rig.set('shRX', -1.2); rig.snap(); rig.update(0.016);
    rig.root.position.y = 0.42; g.add(rig.root);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.34), m('#e65100')); box.position.set(0, 1.35, -0.35); g.add(box);
    g.visible = false; scene.add(g);
    const i = I0 + 1 + Math.floor(Math.random() * (I1 - I0 - 1)), j = 1 + Math.floor(Math.random() * (N - 1));
    return { name: r.name, g, rig, x: roadLine(i), z: roadLine(j), tx: roadLine(i), tz: roadLine(j), pedal: k, said: 0 };
  });
  const updateRiders = (dt) => {
    const day = L.phase === 'day' && L.clock > 7 * 60 && L.clock < 19.5 * 60, night = L.clock >= SHIFTS.night.open && L.clock < SHIFTS.night.end;
    for (const [k, r] of riders.entries()) {
      const on = game.sub === 'free' && (day || (night && k < 2)); // two of them take night shifts too
      r.g.visible = on; if (!on) continue;
      if (Math.hypot(r.tx - r.x, r.tz - r.z) < 0.5) { // next junction: along one road, then the other (Lagos grid, no shortcuts)
        if (Math.random() < 0.5) r.tx = roadLine(I0 + Math.floor(Math.random() * (I1 - I0 + 1))); else r.tz = roadLine(Math.floor(Math.random() * (N + 1)));
      }
      const goX = Math.abs(r.tx - r.x) > 0.5, dx = goX ? Math.sign(r.tx - r.x) : 0, dz = goX ? 0 : Math.sign(r.tz - r.z), sp = 6.5 * dt;
      r.x += dx * Math.min(sp, Math.abs(r.tx - r.x)); r.z += dz * Math.min(sp, Math.abs(r.tz - r.z));
      const yaw = Math.atan2(dx, dz); const side = 4.6; // keep to the right, near the kerb
      r.g.position.set(r.x - Math.cos(yaw) * side * 0 + (dz ? -dz * side : 0), 0.15, r.z + (dx ? dx * side : 0)); r.g.rotation.y = yaw;
      r.pedal += dt * 7; const a = Math.sin(r.pedal); r.rig.set('thLX', -1.2 + a * 0.4); r.rig.set('thRX', -1.2 - a * 0.4); r.rig.update(dt, 20);
      if (game.time - r.said > 40 && Math.hypot(r.g.position.x - player.pos.x, r.g.position.z - player.pos.z) < 9) { r.said = game.time; hud.say(r.name, pick([`Bolaji! I don do ${J.rivals.find(q => q.name === r.name)?.week ?? 3} this week o!`, 'Oga Tunde dey vex for you. Hurry!', 'Customer for Yaba don call me twice. Make I go!', 'Na today you go learn this job.']), 3); }
    }
  };
  J.serialize = () => { const cur = player.mode === 'bike' && player.kind === 'bicycle' ? { x: player.pos.x, z: player.pos.z, yaw: player.heading } : player.cycle; if (cur) J.cycleAt = cur; const { hasCycle, cycleAt, employed, day, clockedIn, shiftOver, shift, shiftsDone, orders, reviews, weekEarned, weekDone, unpaid, daysWorked, strikes, rehireDay, rentDue, rentDebt, payDay, rivals, noShowTold } = J; return { hasCycle, cycleAt, employed, day, clockedIn, shiftOver, shift, shiftsDone, orders, reviews: reviews.slice(-30), weekEarned, weekDone, unpaid, daysWorked, strikes, rehireDay, rentDue, rentDebt, payDay, rivals, noShowTold }; };
  // older saves were paid weekly: whatever that week earned is still owed, paid at the next clock-out
  J.load = (d) => { if (!d) return; Object.assign(J, d); if (d.unpaid == null) J.unpaid = d.weekEarned || 0; J.shiftsDone ||= d.shiftOver ? ['morning'] : []; if (J.clockedIn && !J.shift) J.shift = 'morning'; if (J.hasCycle) setTimeout(() => { const c = J.cycleAt || { x: world.homeDoor.x + 2, z: world.homeDoor.z + 2, yaw: 0 }; player.parkCycle(c.x, c.z, c.yaw); game.refreshBag?.(); }, 0); };
  J.routeNext = routeNext;
  return J;
}
