// Daytime in Surulere: places to discover, Mama's errand of the day, and the news that tells Bolaji where
// help is needed tonight: newspaper stands (headlines), radio kiosks (Wazobia FM style) and gossip on the
// street. Hearing the lead for the next story mission unlocks it for the night.
import * as THREE from 'three';
import { Civilian } from './npcs.js';
import { textSign } from '../core/textures.js';
import { FLY } from '../world/city.js';

import { rng, N } from '../world/layout.js';
const pick = a => a[Math.floor(Math.random() * a.length)];
const SR = rng(7131); const spick = a => a[Math.floor(SR() * a.length)]; // places stay put between sessions

// what the street is saying about each story mission (index = mission number - 1)
const LEADS = {
  babaade: {
    paper: 'PUNCH: Surulere shoemaker beaten for third night by "levy" collectors',
    radio: 'Wazobia FM: Na so dem beat Baba Ade the shoemaker again last night. The people wey dey call themselves Red Caps. Police never talk anything.',
    gossip: ['Una hear wetin happen to Baba Ade?', 'Red Caps again! Them say dem go come back tonight.', 'Wetin that old man do dem? Ah, this Lagos.'],
  },
  roger: {
    paper: 'THE SUN: Danfo drivers groan as Ojuelegba checkpoint "roger" doubles to ₦200',
    radio: 'Wazobia FM: Drivers dey cry for that Ojuelegba checkpoint. Dem say even Red Caps dey carry envelope go meet police there. Na wa.',
    gossip: ['Police collect my ₦200 again this morning.', 'Na Red Caps dey settle them. Everybody know.', 'Who go police the police?'],
  },
  bridge: {
    paper: 'VANGUARD: Traders held under Ojuelegba Bridge over unpaid levy, families plead',
    radio: 'Wazobia FM: Three traders from Adelabu never reach house since yesterday. Them say na under Ojuelegba Bridge dem dey hold them. God help us.',
    gossip: ['Iya Sade no come market today.', 'Dem say na under the bridge dem carry am go.', 'If you no pay Red Caps, na so dem go do you.'],
  },
  egungun: {
    paper: 'PUNCH: Masked "Egúngún" vigilante leads mob justice, police silent',
    radio: 'Wazobia FM: Another mob action last night. People dey talk about one masquerade wey dey catch thief and burn am. That one no be justice o.',
    gossip: ['You see that Egúngún man?', 'Dem say im dey burn thief with tyre.', 'Some people dey clap for am. Me I no like am.'],
  },
  kolade: {
    paper: 'THE NATION: Mechanic dragged from workshop by cult boys, eyewitnesses say',
    radio: 'Wazobia FM: Na Baba Kolade, the mechanic for Ojuelegba. Red Caps drag am comot for im workshop. People dey talk say na because of that "boy in black".',
    gossip: ['Baba Kolade? The mechanic?', 'Dem say Chairman wan send message to the boy in black.', 'That motor park no safe again o.'],
  },
  showdown: {
    paper: 'GUARDIAN: Tension in Surulere as cult gathers under Ojuelegba flyover',
    radio: 'Wazobia FM: Everybody wey dey Ojuelegba, abeg go house early tonight. Dem say Red Caps from everywhere dey gather under the bridge.',
    gossip: ['Red Caps plenty under that bridge now.', 'Dem say na the boy in black dem dey wait for.', 'Tonight na tonight.'],
  },
  levyrun: {
    paper: 'PUNCH: Surulere market women accuse cult of "weekly levy convoy"',
    radio: 'Market women dey cry: one black car dey carry levy from every market go meet Red Caps Chairman. Tonight again.',
    gossip: ['Dem don collect my levy again.', 'Na one black car dey carry am go.', 'If person fit stop that car eh...'],
  },
  stadium: {
    paper: 'VANGUARD: Squatters say cult boys have taken over National Stadium stands',
    radio: 'Squatters for National Stadium say Red Caps dey carry crates enter the old stands every night. Wetin dey inside those crates?',
    gossip: ['That stadium no safe again.', 'Red Caps dey hide something there.', 'My cousin see axes inside one crate!'],
  },
  blackmaria: {
    paper: 'THE SUN: Police raid in Aguda, youths bundled into van, residents protest',
    radio: 'Police don dey pack Aguda boys enter Black Maria. Dem say dem dey find the boy in black. Mothers dey cry for street.',
    gossip: ['Dem carry Dayo last night!', 'Na Okafor men.', 'Anybody wey wear black, dem go carry am.'],
  },
  fire: {
    paper: 'PUNCH: Arson feared as masked vigilante threatens Adelabu Market',
    radio: 'The masquerade man don talk say fire go burn Adelabu because Red Caps dey sleep inside. Market women, abeg be careful.',
    gossip: ['Fire for market? God forbid!', 'That Egúngún man don craze.', 'The boy in black go stop am, you go see.'],
  },
};
const FLAVOUR = {
  paper: ['GUARDIAN: Fuel queues return as scarcity bites Lagos', 'BUSINESSDAY: Electricity tariff up again, supply still epileptic', 'PUNCH: Third Mainland Bridge reopens after repairs, go-slow returns',
    'VANGUARD: JAMB to release results next week', 'COMPLETE SPORTS: Super Eagles camp opens in Abuja', 'THE SUN: Danfo drivers hike fares, blame fuel price', 'PUNCH: Flood alert for low-lying Surulere streets'],
  radio: ['Wazobia FM: Traffic for Western Avenue na wahala this morning, abeg find another road.', 'Wazobia FM: NEPA don promise light for Aguda this week. We dey wait.',
    'Wazobia FM: Fuel don reach new price for some stations. Who we go complain to?', 'Wazobia FM: Na rain go fall this evening. Surulere people, una gutter don clear?'],
  gossip: [['This fuel price go kill person.', 'Na so o. Danfo don add ₦100.'], ['You see Chioma new phone?', 'Na POS money she dey use.'], ['NEPA take light since Monday!', 'Na generator we dey use cook.'],
    ['Super Eagles go win this time.', 'You dey dream.'], ['The road for Lawanson don spoil finish.', 'Na canoe we go dey use soon.']],
  boy: ['PUNCH: Who is the "boy in black" of Surulere? Traders say a masked youth is fighting back', 'Wazobia FM: Na who be this boy in black? Dem say im dey jump like cat!', ['You don hear about the boy in black?', 'Them say im fit jump pass two storey building!']],
};

const ERRANDS = [
  { id: 'tomatoes', poi: 'market', money: 2000, text: 'Buy a basket of tomatoes from Iya Sade at Adelabu Market', act: 'Buy the tomatoes (₦2,000)', done: 'Mama will be pleased.' },
  { id: 'nepa', poi: 'nepa', money: 3500, text: 'Pay the light bill at the NEPA office on Bode Thomas', act: 'Pay the light bill (₦3,500)', done: 'Paid for light you never see. Welcome to Lagos.' },
  { id: 'tailor', poi: 'tailor', money: 1500, text: "Collect Tobi's school uniform from Sunny Tailoring", act: 'Collect the uniform (₦1,500)', done: 'Tobi will be the neatest boy in class.' },
  { id: 'kolade', poi: 'kolade', money: 0, text: 'Take Baba Kolade the food flask Mama packed for him', act: 'Give Baba Kolade the food', done: 'Baba Kolade: "Tell your mama I said thank you. And you... be careful at night."' },
  { id: 'kerosene', poi: 'filling', money: 1800, text: 'Buy a gallon of kerosene at the filling station for the lamp', act: 'Buy kerosene (₦1,800)', done: 'The attendant says there\'s "no fuel" for cars. There\'s always fuel for the black market.' },
  { id: 'lunch', poi: 'school', money: 0, text: "Take Tobi's lunch to his school at break time", act: 'Hand Tobi his lunch', done: 'Tobi (whispering): "Bros, everybody in my class is talking about the boy in black."' },
  { id: 'water', poi: 'borehole', money: 200, text: 'Fetch two kegs of water from the borehole', act: 'Fill the kegs (₦200)', done: 'Heavy. Good for the arms, the borehole man says.' },
  { id: 'recharge', poi: 'recharge', money: 1000, text: 'Buy Mama a ₦1,000 recharge card', act: 'Buy the recharge card (₦1,000)', done: 'Scratch carefully. Last time you scratched off the numbers.' },
  { id: 'bread', poi: 'bakery', money: 800, text: 'Buy a loaf of Agege bread from the bakery', act: 'Buy the bread (₦800)', done: 'Still warm. You eat the end on the way home.' },
  { id: 'drugs', poi: 'pharmacy', money: 2500, text: "Buy Mama's blood-pressure drugs from the pharmacy", act: 'Buy the drugs (₦2,500)', done: 'The pharmacist says Mama should rest more. Mama never rests.' },
];

export function createDay(game) {
  const { scene, world, hud, audio, player } = game;
  const L = game.life, spots = world.spots.filter(s => !(s.bi === 1 && s.bj === 1) && s.bi !== 4 && s.bi >= 0 && s.bi < N); // Mama's errands and Kolade stay in Surulere
  const used = [];
  const near = (a, b, r) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r * r;
  const takeSpot = (minSep = 45, avoid = []) => {
    for (let t = 0; t < 300; t++) { const s = spick(spots); if ([...used, ...avoid].every(u => !near(u, s, minSep)) && game.sites.every(q => !near(q.spot, s, 25)) && world.vendors.every(v => !near(v, s, 12))) { used.push(s); return s; } }
    return spick(spots);
  };
  const sign = (s, text, bg, fg = '#fff', w = 3.6) => {
    const t = textSign(text, bg, fg, 768, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 6), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35 }));
    m.position.set(s.x - s.nx * 1.95, 3.4, s.z - s.nz * 1.95); m.rotation.y = Math.atan2(s.nx, s.nz); scene.add(m);
  };

  // ---- places to discover ----
  const P = {};
  const poi = (id, name, x, z, extra = {}) => (P[id] = { id, name, x, z, found: false, ...extra });
  poi('market', 'Adelabu Market', world.marketSpot.x, world.marketSpot.z);
  poi('motorpark', 'Ojuelegba Motor Park', world.motorparkSpot.x, world.motorparkSpot.z);
  poi('bridge', 'Ojuelegba Bridge', FLY.x, -50);
  poi('stadium', 'National Stadium', world.stadiumGate.x, world.stadiumGate.z);
  poi('pitch', 'Area Pitch', world.pitchCenter.x, world.pitchCenter.z);
  { const s = takeSpot(); poi('nepa', 'NEPA Office', s.x, s.z); sign(s, 'PHCN · NEPA OFFICE', '#1b5e20'); }
  { const s = takeSpot(); poi('tailor', 'Sunny Tailoring', s.x, s.z); sign(s, 'SUNNY TAILORING', '#6a1b9a'); }
  { const s = takeSpot(); poi('kolade', "Baba Kolade's Workshop", s.x, s.z); sign(s, 'KOLADE AUTO & VULCANIZER', '#37474f', '#ffeb3b');
    for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 8, 14), new THREE.MeshStandardMaterial({ color: '#161616' })); t.rotation.x = Math.PI / 2; t.position.set(s.x + s.nz * 1.5, 0.28 + k * 0.22, s.z - s.nx * 1.5); scene.add(t); } }
  { const s = takeSpot(); poi('filling', 'Filling Station', s.x, s.z); sign(s, 'NIPCO · FILLING STATION', '#c62828');
    for (const k of [-1, 1]) { const pump = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.5), new THREE.MeshStandardMaterial({ color: '#eeeeee' })); pump.position.set(s.x + s.nz * k * 2.4, 0.95, s.z - s.nx * k * 2.4); scene.add(pump); } }
  { const s = takeSpot(); poi('school', 'Aguda Primary School', s.x, s.z); sign(s, 'AGUDA PRIMARY SCHOOL', '#1565c0'); }
  { const s = takeSpot(); poi('borehole', 'Borehole', s.x, s.z); sign(s, 'PURE BOREHOLE WATER ₦100', '#00838f');
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 14), new THREE.MeshStandardMaterial({ color: '#212121' })); tank.position.set(s.x - s.nx * 1.4, 3.6, s.z - s.nz * 1.4); scene.add(tank); }
  { const s = takeSpot(); poi('recharge', 'Recharge Card Kiosk', s.x, s.z); sign(s, 'MTN · AIRTEL · GLO · RECHARGE', '#f9a825', '#111'); }
  { const s = takeSpot(); poi('bakery', 'Agege Bread Bakery', s.x, s.z); sign(s, 'GOD IS GOOD BAKERY', '#6d4c41'); }
  { const s = takeSpot(); poi('pharmacy', 'Pharmacy', s.x, s.z); sign(s, 'GOODHEALTH PHARMACY', '#2e7d32'); }
  { // Baba Kolade himself, at his workshop: grey overalls, standing by the tyres
    const k = P.kolade, c = new Civilian(scene, world, { x: k.x + 1.2, z: k.z, yaw: 0, outfit: { skin: '#4a2e1f', top: '#37474f', bottom: '#263238', sock: '#3e2723', sole: '#2b2b2b', cap: null, sheen: '#556070' } });
    c.name = 'Baba Kolade'; c.mood = 'idle'; game.civilians.push(c); world.kolade = c;
  }
  world.pois = Object.values(P);

  // ---- news sources ----
  const sources = [];
  const civ = (x, z, yaw) => { const c = new Civilian(scene, world, { x, z, yaw }); c.mood = 'chat'; game.civilians.push(c); return c; };
  for (let k = 0; k < 3; k++) { // newspaper stands
    const s = takeSpot(60), x = s.x + s.nz * 1.2, z = s.z - s.nx * 1.2;
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 1.0), new THREE.MeshStandardMaterial({ color: '#d7ccc8' })); mat.position.set(x, 0.18, z); scene.add(mat);
    for (let n = 0; n < 6; n++) { const pg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.44), new THREE.MeshStandardMaterial({ color: pick(['#fafafa', '#fff8e1', '#e3f2fd']), emissive: '#222', emissiveIntensity: 0.2 })); pg.position.set(x - 0.6 + (n % 3) * 0.42, 0.21, z - 0.22 + Math.floor(n / 3) * 0.46); pg.rotation.y = (Math.random() - 0.5) * 0.2; scene.add(pg); }
    const v = civ(x - s.nx * 0.8, z - s.nz * 0.8, Math.atan2(s.nx, s.nz)); v.mood = 'idle';
    sources.push({ kind: 'paper', x, z, heard: -1 });
  }
  for (let k = 0; k < 2; k++) { // radio kiosks
    const s = takeSpot(60), x = s.x, z = s.z;
    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.2), new THREE.MeshStandardMaterial({ color: pick(['#1565c0', '#c62828', '#2e7d32']) })); kiosk.position.set(x - s.nx * 1.2, 1.1 + 0.15, z - s.nz * 1.2); scene.add(kiosk);
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.14), new THREE.MeshStandardMaterial({ color: '#212121' })); radio.position.set(x - s.nx * 0.55, 1.2, z - s.nz * 0.55); scene.add(radio);
    world.collision.solids.add(x - s.nx * 1.2 - 0.7, 0, z - s.nz * 1.2 - 0.7, x - s.nx * 1.2 + 0.7, 2.4, z - s.nz * 1.2 + 0.7, 'kiosk');
    sources.push({ kind: 'radio', x, z, heard: -1, t: 0 });
  }
  for (let k = 0; k < 3; k++) { // gossip on the street
    const s = takeSpot(50), x = s.x, z = s.z, group = [];
    for (let n = 0; n < 3; n++) { const a = (n / 3) * Math.PI * 2; group.push(civ(x + Math.sin(a) * 0.8, z + Math.cos(a) * 0.8, a + Math.PI)); }
    sources.push({ kind: 'gossip', x, z, heard: -1, t: 0, group });
  }
  world.newsSources = sources;

  const D = { errand: null, sources, pois: P, lastHeadlines: null };
  const lead = () => { const m = game.story.upcoming(); return !game.story.active && m ? LEADS[m.id] || null : null; }; // the street is always talking about what's next
  const unlockLead = (how) => {
    game.story.unlockNext(how);
  };
  const boyNews = () => game.respect > 1500;

  // ---- newspaper panel ----
  D.headlines = () => {
    const l = lead(), heads = [];
    if (l) heads.push(l.paper);
    if (boyNews()) heads.push(FLAVOUR.boy[0]);
    while (heads.length < 4) { const h = pick(FLAVOUR.paper); if (!heads.includes(h)) heads.push(h); }
    return heads;
  };

  D.interactOption = () => {
    if (L.phase !== 'day') return null;
    const p = player.pos;
    const src = sources.find(s => s.kind === 'paper' && near(s, p, 2.4));
    if (src) return { kind: 'paper', text: '<span class="key">F</span>Read the headlines (free to read, ₦200 to buy)' };
    const e = D.errand;
    if (e && e.step === 'go' && near(P[e.poi], p, 3.2)) return { kind: 'errand', text: `<span class="key">F</span>${e.act}` };
    return null;
  };
  D.doInteraction = (opt) => {
    if (opt.kind === 'paper') {
      const heads = D.headlines();
      game.onNewspaper ? game.onNewspaper(heads) : hud.newspaper(heads);
      if (lead()) unlockLead('from the newspapers');
      return true;
    }
    if (opt.kind === 'errand') {
      const e = D.errand;
      if (e.money && L.wallet < e.money) { hud.toast('Not enough money. (You spent what Mama gave you.)', 'red'); return true; }
      L.wallet -= e.money; e.step = 'return'; audio.pickup(); hud.toast(`${e.done} Now take it home.`, 'green');
      return true;
    }
    return false;
  };

  // ---- the day's errand (from Mama's note) ----
  D.newErrand = () => {
    const e = { ...ERRANDS[(L.night - 1) % ERRANDS.length], step: 'go' };
    D.errand = e; L.wallet += e.money;
    return e;
  };
  D.errandHome = () => { // called when he's home with the errand done
    const e = D.errand; if (!e || e.step !== 'return') return false;
    e.step = 'done'; L.suspicion = Math.max(0, L.suspicion - 10); L.meals += 1; game.addRespect(100, 'ERRAND DONE');
    hud.toast('Errand done. Mama\'s mood improves (suspicion down), and she left extra food.', 'green');
    return true;
  };
  D.target = () => { const e = D.errand; if (!e || L.phase !== 'day') return null; if (e.step === 'go') return { x: P[e.poi].x, z: P[e.poi].z, label: P[e.poi].name }; if (e.step === 'return') return { x: world.homeDoor.x, z: world.homeDoor.z, label: 'HOME' }; return null; };

  // ---- ambient news (radio, gossip) and discovery, every frame outdoors ----
  D.update = (dt) => {
    if (L.inside) return;
    const p = player.pos;
    for (const q of Object.values(P)) if (!q.found && near(q, p, 16)) { q.found = true; hud.popup(`DISCOVERED · <b>${q.name.toUpperCase()}</b>`); game.addRespect(40); audio.tick?.(); }
    if (L.phase !== 'day') return;
    for (const s of sources) {
      if (s.kind === 'paper') continue;
      s.t = (s.t || 0) - dt;
      const r = s.kind === 'radio' ? 9 : 6;
      if (!near(s, p, r) || s.t > 0) continue;
      s.t = 9;
      const l = lead();
      if (s.kind === 'radio') {
        const line = l && Math.random() < 0.7 ? l.radio : boyNews() && Math.random() < 0.3 ? FLAVOUR.boy[1] : pick(FLAVOUR.radio);
        hud.say('Radio', line, 6.5);
        if (l && line === l.radio) unlockLead('on the radio');
      } else {
        const conv = l && Math.random() < 0.65 ? l.gossip : boyNews() && Math.random() < 0.3 ? FLAVOUR.boy[2] : pick(FLAVOUR.gossip);
        conv.forEach((line, i) => setTimeout(() => { if (near(s, player.pos, 10)) hud.say(i % 2 ? 'Woman' : 'Man', line, 2.6); }, i * 2700));
        if (l && conv === l.gossip) setTimeout(() => { if (near(s, player.pos, 10)) unlockLead('from street gossip'); }, conv.length * 2700);
      }
    }
  };
  D.markers = (M, MM, dstr) => {
    if (L.phase !== 'day') return;
    for (const s of sources) {
      const d2 = (s.x - player.pos.x) ** 2 + (s.z - player.pos.z) ** 2;
      if (d2 < 45 * 45) M.push({ x: s.x, y: 2.4, z: s.z, kind: 'news', label: s.kind === 'paper' ? 'NEWSPAPERS' : s.kind === 'radio' ? 'RADIO' : 'GOSSIP', edge: false });
      MM.push({ x: s.x, z: s.z, color: '#b39ddb' });
    }
    const t = D.target();
    if (t) { M.push({ x: t.x, y: 2.6, z: t.z, kind: 'errand', label: `${t.label.toUpperCase()} · ${dstr(t.x, t.z)}` }); MM.push({ x: t.x, z: t.z, color: '#80deea' }); }
  };
  return D;
}
