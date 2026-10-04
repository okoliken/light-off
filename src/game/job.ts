// Bolaji's day job: a rider for SwiftDrop Dispatch, without a bike. Clock in at the office in the
// morning, take the day's parcels, get each one to the customer before its deadline (skate, walk, or
// pay for danfos, kekes and okadas). Customers leave reviews; late or missing parcels hurt. Pay is
// weekly, per delivery. Rent is weekly too. Fall too low and you're sacked; come back in a couple of
// days and beg for the job. Everything here is saved.
import * as THREE from 'three';
import { Civilian } from './npcs.ts';

const ITEMS = ['iPhone (sealed)', 'HP laptop', 'Jumia shoe box', 'Birthday cake', 'Pharmacy bag', 'Ankara fabric', 'Documents envelope', 'Wig in a box', 'Bluetooth speaker', 'Baby formula', 'Perfume set', 'Phone charger', 'Party jollof (cooler)', 'Agbada', 'Wristwatch'];
const NAMES = ['Mrs Adebayo', 'Chinedu', 'Aunty Funke', 'Mr Okoro', 'Tola', 'Baba Ibeji', 'Ngozi', 'Kunle', 'Mama Tobi', 'Segun', 'Blessing', 'Alhaji Musa', 'Yetunde', 'Emeka', 'Bisi', 'Pastor Femi', 'Zainab', 'Tunde Jr'];
const GOOD = ['On time. Nice one!', 'Fast and polite. 👍', 'Rider was early, God bless.', 'Package intact. Thank you.', 'Very professional.', 'Na so delivery suppose be.'];
const LATE = ['Na now you come?! I don waste my whole afternoon.', 'Late. I called three times.', 'If e late again I go report you.', 'The cake don melt. Thanks for nothing.', 'Very slow. I no go use una again.'];
const NEVER = ['Never came. I want my refund.', 'Rider disappeared with my package??', 'Scam company. Nobody delivered.'];
const RIVALS = ['Kola "Speed" Adeyemi', 'Ifeanyi', 'Sule'];
const PAY_ON_TIME = 1200, PAY_LATE = 600, RENT = 12000;
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
    office, employed: true, hasCycle: false, cycleAt: null, day: 0, clockedIn: false, shiftOver: false, orders: [], reviews: [], weekEarned: 0, weekDone: 0, daysWorked: 0, strikes: 0,
    rehireDay: 0, rentDue: 7, rentDebt: 0, payDay: 7, rivals: RIVALS.map(n => ({ name: n, week: 0, rating: 3.8 + Math.random() * 0.9 })), firedTold: false,
  };
  J.rating = () => { const r = J.reviews.slice(-20); return r.length ? r.reduce((a, q) => a + q.stars, 0) / r.length : 4.2; };
  const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  // the day's parcels: spread over the city, deadlines staggered through the morning and afternoon
  function makeOrders() {
    const n = Math.min(15, 6 + Math.floor(J.daysWorked / 2));
    const pl = game.places().filter(q => !['home', 'food'].includes(q.kind) && !/bus stop|ferry|SwiftDrop/i.test(q.name)).map(q => ({ q, d: Math.hypot(q.x - office.x, q.z - office.z) })).filter(o => o.d > 80 && (o.q.z > -1100 || Math.random() < 0.25));
    const out: any[] = [];
    for (let k = 0; k < n && pl.length; k++) {
      const o = pl.splice(Math.floor(Math.random() * pl.length), 1)[0];
      const due = L.clock + 50 + k * (n > 10 ? 28 : 38) + o.d / 9;
      out.push({ id: k, item: pick(ITEMS), who: pick(NAMES), place: { name: o.q.name, x: o.q.x, z: o.q.z, area: o.q.area }, due: Math.min(due, 19 * 60), status: 'pending' });
    }
    return out.sort((a, b) => a.due - b.due);
  }
  const pending = () => J.orders.filter(o => o.status === 'pending');
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
  const next = () => pending().sort((a, b) => a.due - b.due)[0];
  const routeNext = () => { const o = next(); if (o) game.setWaypoint({ x: o.place.x, z: o.place.z, title: `${o.who} · ${o.place.name}` }); else game.setWaypoint({ x: office.x, z: office.z, title: J.clockedIn ? 'SwiftDrop: all delivered, clock out' : 'SwiftDrop office · clock in' }); };

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
      if (!J.clockedIn && !J.shiftOver) return L.clock >= 6.5 * 60 && L.clock < 12 * 60 ? { kind: 'job', act: 'clockin', text: '<span class="key">F</span>Clock in and collect today\'s parcels' } : { kind: 'none', text: L.clock < 6.5 * 60 ? 'SwiftDrop opens at 6:30 AM.' : 'Too late to clock in today. Shifts start before noon.' };
      if (J.clockedIn && !pending().length) return { kind: 'job', act: 'clockout', text: '<span class="key">F</span>Clock out (all parcels delivered)' };
    }
    const o = pending().find(q => { const c = npcs.get(q.id), t = c && !c.gone ? c.pos : q.place; return Math.hypot(t.x - p.x, t.z - p.z) < 3.2; });
    if (o) return { kind: 'job', act: 'deliver', o, text: `<span class="key">F</span>Hand over <b>${o.item}</b> to ${o.who}${L.clock > o.due ? ' <small style="color:#ff8a80">(LATE)</small>' : ''}` };
    return null;
  };
  J.act = (opt) => {
    if (opt.act === 'clockin') {
      J.clockedIn = true; J.orders = makeOrders(); audio.pickup();
      if (!J.hasCycle) { // first shift: the company bicycle and the delivery box
        J.hasCycle = true; const ax = -s.nz, az = s.nx; player.parkCycle(office.x + ax * 2.2 + s.nx * 1.2, office.z + az * 2.2 + s.nz * 1.2, Math.atan2(ax, az)); game.refreshBag?.();
        setTimeout(() => hud.banner('YOUR SWIFTDROP BICYCLE', 'Mr Tunde hands you a company bicycle and an orange delivery box. F to get on, R to get off. Break it, you pay for it.', 'white', 5), 3400);
      }
      hud.say('Mr Tunde', pick([`${J.orders.length} drops today. Customers dey wait. No story.`, 'Oya, carry your parcels. Last week complain too much o.', `Your rating na ${J.rating().toFixed(1)}. Kola dey do better than you.`]), 3.5);
      hud.banner('SHIFT STARTED', `${J.orders.length} parcels · first one due ${fmt(J.orders[0].due)} · J for the job sheet`, 'white', 3.2);
      if (L.night >= J.payDay && J.weekEarned > 0) payday();
      routeNext(); game.save(); return true;
    }
    if (opt.act === 'deliver') {
      const o = opt.o, late = L.clock > o.due; o.status = late ? 'late' : 'done';
      { const c = npcs.get(o.id); if (c && !c.gone) { c.mood = late ? 'idle' : 'cheer'; c.faceTarget = player.pos; } }
      const r = review(o, late ? 'late' : 'ok'), pay = late ? PAY_LATE : PAY_ON_TIME;
      J.weekEarned += pay; J.weekDone++; audio.pickup();
      hud.say(o.who, late ? pick(['Na now?!', 'Abeg, just give me.', 'Hmm. Late again.']) : pick(['Thank you!', 'Ah, fast! God bless.', 'Nice one, rider.']), 2.5);
      hud.toast(`${stars(r.stars)} <b>${o.who}</b>: "${r.text}"<br><small>+₦${pay.toLocaleString()} this week · rating ${J.rating().toFixed(1)}</small>`, late ? 'red' : 'green');
      routeNext(); game.save(); return true;
    }
    if (opt.act === 'clockout') { endShift(); return true; }
    if (opt.act === 'rehire') {
      J.employed = true; J.strikes = 0; J.reviews = J.reviews.slice(-4).map(r => ({ ...r, stars: Math.max(r.stars, 3) })); J.clockedIn = false; J.shiftOver = false; J.firedTold = false;
      hud.say('Mr Tunde', 'Last chance. If one more customer complain, you go find another work.', 4);
      hud.banner('REHIRED', 'Back on the SwiftDrop roster. Clock in tomorrow morning (or now, before noon).', 'green', 3.5); game.save(); return true;
    }
    return false;
  };
  function payday() {
    L.wallet += J.weekEarned; hud.banner('PAYDAY', `₦${J.weekEarned.toLocaleString()} for ${J.weekDone} deliveries this week.`, 'green', 4); audio.pickup();
    J.weekEarned = 0; J.weekDone = 0; J.payDay = L.night + 7; for (const r of J.rivals) r.week = 0;
  }
  function endShift(timeUp = false) {
    if (!J.clockedIn) return;
    let missed = 0;
    for (const o of J.orders) if (o.status === 'pending') { o.status = 'failed'; review(o, 'never'); missed++; }
    J.clockedIn = false; J.shiftOver = true; J.daysWorked++;
    for (const r of J.rivals) { const d = 6 + Math.floor(Math.random() * 7); r.week += d; r.rating = Math.max(3, Math.min(5, r.rating + (Math.random() - 0.45) * 0.2)); }
    const done = J.orders.filter(o => o.status === 'done').length, late = J.orders.filter(o => o.status === 'late').length;
    hud.banner(timeUp ? 'SHIFT OVER' : 'CLOCKED OUT', `${done} on time · ${late} late · ${missed} never delivered · rating ${J.rating().toFixed(1)}`, missed || late > done ? 'red' : 'green', 4.5);
    if ((J.reviews.length >= 6 && J.rating() < 2.8) || J.strikes >= 3) fire(J.strikes >= 3 ? 'You keep not showing up.' : 'Too many complaints.');
    game.setWaypoint(null); game.save();
  }
  function fire(why) {
    J.employed = false; J.clockedIn = false; J.rehireDay = L.night + 2;
    if (J.hasCycle) { J.hasCycle = false; if (player.mode === 'bike' && player.kind === 'bicycle') { player.mode = 'foot'; } player.cycle = null; player.parkCycle(office.x, office.z, 0); player.cycle = null; game.refreshBag?.(); setTimeout(() => game.player.parkCycle && (game.player.cycle = null), 0); }
    hud.banner('SACKED', `Mr Tunde: "${why} Submit your bag. Go."`, 'red', 5);
    hud.toast('You can go back to SwiftDrop in <b>2 days</b> and beg for the job. Until then: rent still dey come.', 'red');
  }
  function newDay() {
    J.day = L.night; J.clockedIn = false; J.shiftOver = false; J.orders = []; J.noShowTold = false;
    if (L.night >= J.rentDue) {
      if (L.wallet >= RENT + J.rentDebt) { L.wallet -= RENT + J.rentDebt; J.rentDebt = 0; hud.toast(`The landlord collected <b>₦${RENT.toLocaleString()}</b> rent this morning.`, 'blue'); }
      else { J.rentDebt += RENT; hud.say('Landlord', J.rentDebt > RENT ? 'Two weeks now! If I no see my money, I go throw your things outside.' : 'Bolaji, where my rent? I no dey beg you o.', 4); }
      J.rentDue = L.night + 7;
    }
    if (J.employed) hud.notice(`DAY ${L.night}`, `Clock in at SwiftDrop before noon${J.payDay <= L.night ? ' · it\'s PAYDAY' : ''}.`, 'white', 3);
  }

  J.update = (dt) => {
    if (J.day !== L.night) newDay();
    if (!J.employed) return;
    // didn't show up
    if (!J.clockedIn && !J.shiftOver && L.phase === 'day' && L.clock >= 12 * 60 && !J.noShowTold) { J.noShowTold = true; J.strikes++; hud.say('Mr Tunde (phone)', J.strikes >= 3 ? 'Don\'t bother coming tomorrow.' : 'Where are you?! Parcels dey here waiting.', 4); if (J.strikes >= 3) fire('You keep not showing up.'); }
    updateCustomers();
    if (J.clockedIn) {
      for (const o of pending()) if (!o.warned && L.clock > o.due) { o.warned = true; hud.toast(`📞 <b>${o.who}</b> is calling: "Where is my ${o.item.toLowerCase()}?!" (now late)`, 'red'); }
      if (L.clock >= 19.5 * 60 || L.phase !== 'day') endShift(true);
    }
  };
  // ---- what the HUD shows ----
  J.tracker = () => {
    if (!J.employed) return { title: 'Unemployed', sub: `RENT ₦${(RENT + J.rentDebt).toLocaleString()} DUE DAY ${J.rentDue}`, steps: [{ label: L.night >= J.rehireDay ? 'Go back to SwiftDrop and beg for the job' : `SwiftDrop will see you again on day ${J.rehireDay}`, state: 'cur' }] };
    if (!J.clockedIn) return J.shiftOver ? { title: 'SwiftDrop · off duty', sub: `★ ${J.rating().toFixed(1)} · ₦${J.weekEarned.toLocaleString()} THIS WEEK · PAYDAY DAY ${J.payDay}`, steps: [{ label: 'Free time. Rent due day ' + J.rentDue, state: '' }] }
      : L.phase === 'day' && L.clock < 12 * 60 ? { title: 'SwiftDrop Dispatch', sub: `★ ${J.rating().toFixed(1)} · CLOCK IN BEFORE NOON`, steps: [{ label: 'Go to the office at Ojuelegba and clock in', state: 'cur' }] } : null;
    const ps = pending(), done = J.orders.length - ps.length;
    return { title: `SwiftDrop · Day ${L.night}`, sub: `★ ${J.rating().toFixed(1)} · ${done}/${J.orders.length} DELIVERED · J: JOB SHEET`, steps: ps.slice(0, 4).map((o, k) => ({ label: `${o.who} · ${o.item} · ${o.place.name} · ${L.clock > o.due ? 'LATE' : 'by ' + fmt(o.due)}`, state: k === 0 ? 'cur' : '' })) };
  };
  J.markers = (M, MM, dstr) => {
    if (J.employed && !J.clockedIn && !J.shiftOver && L.phase === 'day') { MM.push({ x: office.x, z: office.z, color: '#ff9100' }); M.push({ x: office.x, y: 3.4, z: office.z, kind: 'deliver', label: `SWIFTDROP · CLOCK IN · ${dstr(office.x, office.z)}` }); }
    if (!J.employed && L.night >= J.rehireDay) MM.push({ x: office.x, z: office.z, color: '#ff9100' });
    for (const o of pending()) { MM.push({ x: o.place.x, z: o.place.z, color: L.clock > o.due ? '#ff5252' : '#ffab40' }); if (o === next()) M.push({ x: o.place.x, y: 3, z: o.place.z, kind: 'deliver', label: `${o.who.toUpperCase()} · ${dstr(o.place.x, o.place.z)}` }); }
  };
  J.sheet = () => ({ rating: J.rating(), stars: stars(J.rating()), employed: J.employed, clockedIn: J.clockedIn, orders: J.orders.map(o => ({ ...o, dueStr: fmt(o.due), late: L.clock > o.due })), reviews: J.reviews.slice(-6).reverse(),
    weekEarned: J.weekEarned, weekDone: J.weekDone, payDay: J.payDay, rentDue: J.rentDue, rent: RENT + J.rentDebt, rivals: J.rivals.map(r => ({ ...r })).concat([{ name: 'Bolaji (you)', week: J.weekDone, rating: J.rating(), me: true }]).sort((a, b) => b.week - a.week), day: L.night });
  J.officePlace = () => ({ name: office.name, x: office.x, z: office.z, kind: 'place' });
  J.serialize = () => { const cur = player.mode === 'bike' && player.kind === 'bicycle' ? { x: player.pos.x, z: player.pos.z, yaw: player.heading } : player.cycle; if (cur) J.cycleAt = cur; const { hasCycle, cycleAt, employed, day, clockedIn, shiftOver, orders, reviews, weekEarned, weekDone, daysWorked, strikes, rehireDay, rentDue, rentDebt, payDay, rivals, noShowTold } = J; return { hasCycle, cycleAt, employed, day, clockedIn, shiftOver, orders, reviews: reviews.slice(-30), weekEarned, weekDone, daysWorked, strikes, rehireDay, rentDue, rentDebt, payDay, rivals, noShowTold }; };
  J.load = (d) => { if (!d) return; Object.assign(J, d); if (J.hasCycle) setTimeout(() => { const c = J.cycleAt || { x: world.homeDoor.x + 2, z: world.homeDoor.z + 2, yaw: 0 }; player.parkCycle(c.x, c.z, c.yaw); game.refreshBag?.(); }, 0); };
  J.routeNext = routeNext;
  return J;
}
