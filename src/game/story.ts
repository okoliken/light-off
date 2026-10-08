// Chapter 1: The Red Caps. Six missions that lead into each other; each one ends with a scene that
// points at the next. They always start from Bolaji's house at night (the door), but they are never
// forced: he can patrol, do side jobs or sleep instead. Side events (beatings in progress) happen around
// them at night. Every mission ends the same way: get home without being followed.
import * as THREE from 'three';
import { OUTFITS } from '../player/rig.ts';
import { textSign } from '../core/textures.ts';

const ELDER = OUTFITS.elder;
const TRADERS = [
  { skin: '#5a3825', top: '#e65100', bottom: '#6a1b9a', sock: '#3e2723', sole: '#2b2b2b', cap: '#e65100', sheen: '#886655' },
  { skin: '#4a2e20', top: '#00897b', bottom: '#fbc02d', sock: '#3e2723', sole: '#2b2b2b', cap: '#00897b', sheen: '#557766' },
  { skin: '#3b2418', top: '#c2185b', bottom: '#1565c0', sock: '#3e2723', sole: '#2b2b2b', cap: '#c2185b', sheen: '#775566' },
];
const YOUTH = { skin: '#4a2e1f', top: '#fafafa', bottom: '#37474f', sock: '#3e2723', sole: '#2b2b2b', sheen: '#777777' };
const VICTIM_NAMES = ['Oga Femi', 'Mama Ibeji', 'Brother Sunday', 'Iya Tolu', 'Uncle Jide', 'Aunty Nkem'];
const B = (who, text) => ({ who, text });
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createStory(game, api) {
  const S: any = { index: 0, unlocked: 0, dayDone: 0, dayUnlocked: false, recon: {}, flags: {}, places: {}, morning: null, active: null, complete: false, side: null, nextSide: 70, sideDone: 0 };
  const alive = list => list.filter(t => t.alive).length;
  const P = () => game.player.pos;
  const near = (p, r) => Math.hypot(p.x - P().x, p.z - P().z) < r;
  // everything a mission spawns is remembered, so it can be cleaned up on a replay or a failure
  let spawned: any[] = [];
  const T = (o) => { const t = api.thug(o); spawned.push(t); return t; };
  const V = (o) => { const v = api.victim(o); spawned.push(v); return v; };
  const G = (o) => { const g = api.gunman(o); spawned.push(g); return g; };
  const mesh = (m) => { game.scene.add(m); spawned.push({ mesh: m }); return m; };
  function cleanup() {
    for (const e of spawned) { if (e.mesh) game.scene.remove(e.mesh); else if (e.remove && !e.removed && !e.gone) e.remove(game.scene); }
    spawned = [];
  }

  // a fixed place for a mission, chosen once (so the daytime look and the night job happen at the same stall)
  const placeSpot = (id, minD, maxD) => {
    if (S.places[id]) return S.places[id];
    const h = game.world.homeDoor;
    const c = game.world.spots.filter(q => { const d = Math.hypot(q.x - h.x, q.z - h.z); return d > minD && d < maxD && !(q.bi === 1 && q.bj === 1) && q.bi !== 4 && game.world.vendors.every(v => Math.hypot(v.x - q.x, v.z - q.z) > 15); });
    const q = c[Math.floor(Math.random() * c.length)] || game.world.spots[0];
    return (S.places[id] = { x: q.x, z: q.z, nx: q.nx, nz: q.nz });
  };
  // a knot of Red Caps beating someone on the ground; one of them holds what they took
  function beatingScene(spot, n, victimOutfit, victimName, loot, extra: any = {}, keep = false) {
    const gang = extra.gang === 'agbero' ? ['agbero', 'agbero2'] : ['redcap', 'redcap2'];
    const vx = spot.x, vz = spot.z;
    const mk = keep ? T : api.thug, mv = keep ? V : api.victim;
    const victim = mv({ x: vx, z: vz, yaw: Math.atan2(spot.nx, spot.nz), outfit: victimOutfit, mood: 'cower' });
    victim.name = victimName;
    const group: any[] = [];
    const W = extra.weapons || [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.4, x = vx + Math.sin(a) * 1.5, z = vz + Math.cos(a) * 1.5;
      const t = mk({ x, z, yaw: a + Math.PI, variant: k === 0 && extra.brute ? 'brute' : gang[k % 2], weapon: W[k] ?? (k === 1 && extra.stick ? 'stick' : null), role: 'beater', group });
      t.victim = victim; group.push(t);
    }
    if (loot) api.giveItem(group[0], { ...loot, owner: victim });
    return { victim, group };
  }
  const ring = (c, list, r0, variant = null) => list.map(([v, w], k) => {
    const a = (k / list.length) * Math.PI * 2, x = c.x + Math.sin(a) * r0, z = c.z + Math.cos(a) * r0;
    return { x, z, yaw: a + Math.PI, variant: variant || v, weapon: w };
  });
  // a wave running in from one end of the camp under the bridge (the camp is long and narrow)
  function wave(c, list, dz, into) {
    list.forEach(([v, w], k) => into.push(T({ x: c.x + (k - (list.length - 1) / 2) * 2.2, z: c.z + dz + (k % 2) * 1.5, yaw: dz > 0 ? Math.PI : 0, variant: v, weapon: w, role: 'guard', group: into })));
    for (const t of into) t.engage(0.3 + Math.random() * 0.5);
    return into;
  }

  // ---------------- the six missions ----------------
  const MISSIONS = [
    // 1 ------------------------------------------------------------------------------------------
    {
      id: 'babaade', title: 'Baba Ade', hint: 'Baba Ade the shoemaker',
      radio: 'Na so dem beat Baba Ade the shoemaker again last night. Third night! The people wey dey call themselves Red Caps, dem take im cash box. Neighbours say dem go come back tonight. Police never talk anything.',
      intro: 'The radio said it: the Red Caps have beaten Baba Ade, the old shoemaker, three nights in a row and taken his cash box. They\'re back at his stall tonight.',
      // LOOK (day, no mask): carry Mama's basket past his stall and watch
      recon: {
        label: "Baba Ade's stall", task: 'Walk past <b>Baba Ade\'s stall</b> with Mama\'s basket and watch', watch: 8,
        where: () => placeSpot('babaade', 70, 150),
        setup(w) {
          const ade = api.victim({ x: w.x, z: w.z, yaw: Math.atan2(w.nx, w.nz), outfit: ELDER, mood: 'idle' }); ade.name = 'Baba Ade';
          const caps = [0, 1].map(k => { const t = api.thug({ x: w.x - w.nz * (6 + k * 3), z: w.z + w.nx * (6 + k * 3), variant: k ? 'redcap2' : 'redcap', role: 'guard' }); t.calm = true; t.patrol = [[w.x - w.nz * 8, w.z + w.nx * 8], [w.x + w.nz * 8, w.z - w.nx * 8]]; return t; });
          return [ade, ...caps];
        },
        scene: w => [
          'Noon. Mama\'s basket of tomatoes on your head. Baba Ade is hammering a sole at his stall, one eye swollen shut.',
          'Two red berets walk past his stall. Then past it again. They never buy anything.',
          B('Baba Ade', '(quietly, to a customer) I paid them twice this week. Twice. They say the Chairman\'s price went up.'),
          B('Bolaji', '(to himself) The gutter side. That\'s where they\'ll come from tonight.'),
        ],
        notes: 'Two of them circle his stall. He has paid twice already. Tonight they\'ll come from the gutter side, and one of them won\'t see you coming.',
        intel: c => { const t = c.group[c.group.length - 1]; t.yaw = Math.atan2(-(P().x - t.pos.x), -(P().z - t.pos.z)); t.role = 'guard'; t.victim = null; t.pos.x += c.spot.nz * 3; t.pos.z -= c.spot.nx * 3; t.home.copy(t.pos); t.homeYaw = Math.atan2(c.spot.nz, -c.spot.nx); api.toast('<b>From your daytime look:</b> one of them is keeping watch facing the road. Come in from the gutter side and drop him with a <b>silent takedown</b> (F from behind).', 'blue'); },
      },
      setup() {
        const spot = placeSpot('babaade', 70, 150);
        const sc = beatingScene(spot, 3, ELDER, 'Baba Ade', { label: "Baba Ade's cash box", amount: 18000 }, { stick: true }, true);
        api.scatter(spot.x, spot.z, 5);
        return { ...sc, spot, tails: 1 };
      },
      morning: f => [
        'Morning. Mama is tying her wrapper for the market when a boy knocks with a basket of tomatoes.',
        B('Mama', 'From Baba Ade? For free? That man has never given anybody free anything in his life.'),
        B('Mama', '(looking at you) Bolaji. Why is Baba Ade sending us tomatoes?'),
        B('Bolaji', 'Maybe he\'s happy, Mama.'),
        ...(f.clip ? ['On the radio, a caller says there is a video of "Street Cat" going round the viewing centres. Blurry. But it exists.'] : ['The radio is full of rumours about Street Cat. Just rumours. Nobody has a picture.']),
      ],
      scene: c => [
        'Aguda, after midnight. The streetlights hum. Somewhere a generator coughs.',
        B('Red Cap', 'Old man, na the last time we go ask you. Where the money?'),
        B('Baba Ade', 'Please... I don pay. I don pay everything.'),
        B('Bolaji', '(under his breath) Not tonight.'),
      ],
      steps: [
        { label: 'Stop the beating', text: () => 'Stop the Red Caps beating <b>Baba Ade</b>', sub: () => 'F STRIKE · C COUNTER WHEN "!" FLASHES · G SWEEP WHEN SURROUNDED', target: c => c.victim.pos, check: c => alive(c.group) === 0 },
        // THE TURN: one of them filmed it
        { label: 'The phone', text: c => `One of them <b>filmed you</b> on a cracked phone. Catch him and smash it, or let it go <b>${Math.max(0, Math.ceil(25 - c.phoneT))}s</b>`, sub: () => 'HE\'S RUNNING · POUNCE (V) OR THROW (T) · OR LET THE CLIP EXIST',
          target: c => c.filmer.alive ? c.filmer.pos : null,
          enter: c => {
            const sp = c.spot, f = T({ x: sp.x - sp.nz * 12, z: sp.z + sp.nx * 12, variant: 'redcap2', role: 'guard' });
            f.hp = f.maxHp = 2; f.calm = true; c.filmer = f; c.phoneT = 0;
            const ph = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.01), new THREE.MeshStandardMaterial({ color: '#222', emissive: '#90caf9', emissiveIntensity: 0.8 })); ph.position.set(0, -0.1, 0.05); f.rig.b.haR.add(ph);
            c.runTo = { x: sp.x - sp.nz * 120, z: sp.z + sp.nx * 120 };
            api.say('Red Cap', 'I don record am! Chairman go see this one!');
          },
          tick: (c, dt) => { c.phoneT += dt; const f = c.filmer; if (c.phoneT > 1.2 && f.alive && f.state === 'idle') { f.state = 'run'; f.t = 0; f.runSpeed = 5.8; f.runTo = c.runTo; } },
          check: c => !c.filmer.alive || c.filmer.escaped || c.phoneT > 25,
          done: c => { const smashed = c.filmer.state === 'ko' || (c.filmer.hp <= 0 && !c.filmer.escaped); S.flags.clip = !smashed; if (smashed) { api.notice('PHONE SMASHED', 'No video. Street Cat stays a rumour.', 'green'); game.addRespect(150, 'NO EVIDENCE'); } else api.notice('THE CLIP EXISTS', 'Somewhere in Surulere, a blurry video of Street Cat is being copied onto flash drives.', 'red'); } },
        { label: 'Get the cash box', text: () => 'Pick up <b>Baba Ade\'s cash box</b>', target: () => api.droppedPos(), check: c => api.carrying('Baba Ade\'s cash box'), enter: c => { c.victim.mood = 'idle'; c.victim.faceTarget = P(); } },
        { label: 'Return it', text: () => 'Give the cash box back to <b>Baba Ade</b>', target: c => c.victim.pos, check: c => c.returned },
        {
          home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home,
          enter: c => api.scene([
            B('Baba Ade', 'Whoever you are... God will reward you.'),
            B('Baba Ade', 'But hear me. These boys are not afraid of police. Every week their bagman takes an envelope to the checkpoint by Ojuelegba. The police collect from the danfos, and from the Red Caps too.'),
            B('Bolaji', 'The police are on their payroll?'),
            B('Baba Ade', 'Go and see with your own eyes. Tomorrow night, if you are brave.'),
          ], c.victim.pos, () => { api.tails(c.tails); api.toast('A danfo conductor on his last run slowed down to stare at the <b>black hoodie</b>. Lose anyone watching before you go home.', 'red'); game.life.suspicion = Math.min(100, game.life.suspicion + 4); }, 'BABA ADE'),
        },
      ],
      finish: 'Baba Ade is safe. His warning: the Red Caps pay the police at the Ojuelegba checkpoint.',
    },
    // 2 ------------------------------------------------------------------------------------------
    {
      id: 'roger', title: 'Roger', hint: 'the Ojuelegba police checkpoint',
      morning: () => [
          'Morning. The radio is talking about the Ojuelegba checkpoint: the officers were shouting at each other at dawn, each one saying the other took the envelope.',
          B('Mama', 'Police and Red Caps quarrelling in public. Hm. When thieves fight, the owner of the goat finds his goat.'),
      ],
      radio: 'Drivers dey cry for that Ojuelegba checkpoint. Roger don double! And one caller say im see Red Caps carry envelope go meet the Inspector there, every Friday night. Na wa for this country.',
      intro: 'Baba Ade said the Red Caps\' bagman takes an envelope to the police checkpoint near Ojuelegba every week. Tonight you watch the handover and take that envelope.',
      setup() {
        const cp = api.checkpoint(0);
        const okafor = G({ x: cp.table.x, z: cp.table.z + 1.2, yaw: Math.PI, outfit: { ...OUTFITS.police, beret: '#b71c1c' }, post: { x: cp.table.x, z: cp.table.z + 1.2, yaw: Math.PI, cp } });
        okafor.name = 'Inspector Okafor'; okafor.maxHp = okafor.hp = 5;
        return { cp, okafor, bag: [], watchT: 0, tails: 0 };
      },
      scene: c => [
        'The Ojuelegba checkpoint. Two drums, a plank of nails, a kerosene lamp. Every danfo stops. Every conductor pays.',
        B('Officer', 'Oya, roger! Driver, you no see me?'),
        B('Inspector Okafor', 'Keep collecting. The Chairman\'s boy will soon come with our own.'),
        B('Bolaji', '(from the dark) So it\'s true.'),
      ],
      focus: c => c.cp,
      steps: [
        { label: 'Reach the checkpoint', text: () => 'Get close to the <b>Ojuelegba checkpoint</b> without being seen', sub: () => 'STAY ON THE ROOFS OR IN THE DARK · THE BLUE MARKER', target: c => c.cp, check: c => near(c.cp, 45) },
        {
          label: 'Watch the handover', text: c => `Watch the <b>handover</b>${c.bagman.alive ? '' : ''}`, sub: () => 'KEEP YOUR DISTANCE · THE RED CAPS\' BAGMAN IS COMING', target: c => c.bagman.alive ? c.bagman.pos : c.cp,
          enter: c => {
            // the bagman walks down the road from the bridge with a knife boy beside him
            const sx = c.cp.x + 3, sz = c.cp.z + 38, dest = [[c.cp.table.x - 1.2, c.cp.table.z + 2.4]];
            c.bagman = T({ x: sx, z: sz, yaw: Math.PI, variant: 'redcap', role: 'patrol', group: c.bag }); c.bag.push(c.bagman);
            c.guard = T({ x: sx + 1.3, z: sz + 0.8, yaw: Math.PI, variant: 'redcap2', weapon: 'knife', role: 'patrol', group: c.bag }); c.bag.push(c.guard);
            api.giveItem(c.bagman, { label: "the Chairman's envelope", amount: 0, keep: true });
            c.bagman.patrol = dest; c.guard.patrol = [[dest[0][0] + 1.4, dest[0][1] + 0.8]];
            api.notice('THE BAGMAN', 'A Red Cap with an envelope is walking down from the bridge.', 'blue');
          },
          check: c => !c.bagman.alive || Math.hypot(c.bagman.pos.x - c.okafor.pos.x, c.bagman.pos.z - c.okafor.pos.z) < 3.2,
        },
        {
          label: 'Take the envelope', text: () => 'Take the <b>Chairman\'s envelope</b>', sub: c => c.okafor.item ? 'OKAFOR HAS IT · KNOCK HIM DOWN (HE WILL CALL FOR BACKUP)' : 'THE BAGMAN HAS IT', target: c => api.droppedPos() || (c.okafor.item ? c.okafor.pos : c.bagman.pos),
          enter: c => {
            if (c.bagman.alive && c.bagman.item) {
              const it = c.bagman.item; c.bagman.item = null; c.bagman.takeBag(); c.okafor.item = it;
              for (const t of c.bag) { t.patrol = null; t.state = 'idle'; }
              if (near(c.cp, 60)) api.scene([
                B('Bagman', 'Oga Okafor. From the Chairman. Complete.'),
                B('Inspector Okafor', 'Hmm. And the traders you are holding under the bridge? Nobody will come to my station about them?'),
                B('Bagman', 'Nobody. Chairman say make una no see anything till market people pay.'),
                B('Inspector Okafor', 'I see nothing. Go.'),
              ], c.okafor.pos, null, 'THE HANDOVER');
            }
          },
          check: c => api.carrying("the Chairman's envelope"),
        },
        { label: 'Lose the police', text: () => '<b>Lose the police</b>', sub: () => 'BREAK LINE OF SIGHT · CLIMB · SKITCH A DANFO', target: () => null, check: () => game.heat === 0, enter: () => { api.addHeat(2, 'Inspector Okafor: "GET HIM! Nobody leaves with that envelope!"'); } },
        {
          home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home,
          enter: () => api.scene([
            'Bolaji opens the envelope under a dead streetlight. Cash, and a list in blue biro.',
            'OKAFOR ₦250,000 · DIVISION ₦100,000 · "UNDER BRIDGE: IYA SADE, MAMA CHIOMA, OGA EMEKA. HOLD TILL MARKET PAYS."',
            B('Bolaji', 'Three traders. Under Ojuelegba Bridge. And the police won\'t come.'),
          ], P(), null, 'THE ENVELOPE'),
        },
      ],
      finish: 'The police are on the Red Caps\' payroll, and three traders are being held under Ojuelegba Bridge. The police will remember Street Cat.',
    },
    // 3 ------------------------------------------------------------------------------------------
    {
      id: 'bridge', title: 'Under the Bridge', hint: 'the traders held under Ojuelegba Bridge',
      morning: () => [
          'Morning. Iya Sade is back at her stall. Half of Adelabu has gone to greet her.',
          B('Mama', 'They say Street Cat carried them out from under Ojuelegba. God knows his mother.'),
          B('Bolaji', '(chewing slowly) God knows.'),
      ],
      radio: 'Three traders from Adelabu Market never reach house since two days. Iya Sade, Mama Chioma, Oga Emeka. Families beg police, police say dem never see anything. Some people say na under Ojuelegba Bridge dem dey.',
      intro: 'The envelope named them: Iya Sade, Mama Chioma and Oga Emeka, held under Ojuelegba Bridge until the market pays. The police won\'t come. You will.',
      setup() {
        const u = api.underBridge(2);
        const captives: any[] = [];
        for (let k = 0; k < 3; k++) { const v = V({ x: u.cx - 3 + k * 3, z: u.cz + 4, yaw: Math.PI, outfit: TRADERS[k], mood: 'captive' }); v.name = ['Iya Sade', 'Mama Chioma', 'Oga Emeka'][k]; captives.push(v); }
        const group: any[] = [];
        const GG: any[] = [[-5, 8, 'redcap', 'knife'], [5, 8, 'redcap2', 'stick'], [-4, -2, 'redcap', 'machete'], [4, -3, 'redcap2', 'bottles'], [0, 12, 'brute', null], [0, -8, 'redcap', 'knife']];
        for (const [dx, dz, v, w] of GG) group.push(T({ x: u.cx + dx, z: u.cz + dz, yaw: Math.random() * 6.28, variant: v, weapon: w, role: 'guard', group }));
        api.scatter(u.cx, u.cz, 6);
        return { u, captives, group, freed: 0, tails: 2 };
      },
      scene: c => [
        'Under Ojuelegba Bridge. The flyover roars overhead. Red berets around a fire.',
        B('Red Cap', 'Chairman say if market no pay by Friday, we go start with this one.'),
        B('Iya Sade', 'My children never eat since yesterday... please...'),
        'Six of them. Knives, a machete, bottles. Bolaji tightens his gloves.',
      ],
      focus: c => ({ x: c.u.cx, z: c.u.cz }),
      steps: [
        { label: 'Get to the bridge', text: () => 'Get to <b>Ojuelegba Bridge</b>', sub: () => 'THE RED CAPS\' CAMP IS UNDER THE FLYOVER', target: c => ({ x: c.u.cx, z: c.u.cz }), check: c => near({ x: c.u.cx, z: c.u.cz }, 35) },
        { label: 'Free the traders', text: c => `Free the traders <b>(${c.freed}/3)</b>`, sub: () => 'POUNCE (V) ON THE BOTTLE THROWER · MACHETES (RED "!") CAN\'T BE COUNTERED: DODGE', target: c => c.captives.find(v => v.mood === 'captive')?.pos, check: c => c.freed >= 3 },
        { label: 'Clear the camp', text: c => `Clear out the Red Caps <b>(${alive(c.group)} left)</b>`, target: c => c.group.find(t => t.alive)?.pos, check: c => alive(c.group) === 0 },
        {
          home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home,
          enter: c => api.scene([
            B('Iya Sade', 'You are Street Cat. God bless your mother.'),
            B('Iya Sade', 'Hear this. Every Thursday night they collect the levy from every market in Surulere and drive it to the Chairman in one car.'),
            B('Mama Chioma', 'A black car, no plate. It leaves Adelabu after midnight. That is our money inside it.'),
            B('Bolaji', 'Then it\'s not getting to the Chairman.'),
          ], c.captives[0].pos, () => api.tails(c.tails), 'IYA SADE'),
        },
      ],
      finish: 'The traders are home. And now you know about the levy car: every market\'s money, in one car, every Thursday.',
    },
    // 4 (new) -----------------------------------------------------------------------------------
    {
      id: 'levyrun', title: 'The Levy Run', hint: 'the Red Caps\' levy car',
      radio: 'Market women dey cry: Red Caps don collect levy from Adelabu, Lawanson, Ojuelegba, all of them. One black car go carry the money go meet their Chairman tonight. Na our sweat dem dey carry.',
      intro: 'Every market\'s levy, in one black car, driving to the Chairman tonight. Catch it, stop it, and give the money back.',
      // LOOK (day): from a rooftop over the market, time the levy car
      recon: {
        label: 'a rooftop over Adelabu Market', task: 'Get up on a <b>rooftop near Adelabu Market</b> and watch the black car', watch: 10,
        where: () => ({ x: game.world.marketSpot.x + 6, z: game.world.marketSpot.z - 14 }),
        ok: w => near(w, 45) && P().y > 3 && !game.life.suit,
        setup(w) {
          const car = api.traffic.spawnGetaway(w.x, w.z, Math.PI / 2); car.ai.parked = true;
          const t = api.thug({ x: w.x + 2.5, z: w.z + 1.5, variant: 'redcap', role: 'guard' }); t.calm = true;
          return [{ remove: () => api.traffic.remove(car) }, t];
        },
        scene: w => [
          'From the roof of a pepper warehouse, Adelabu Market looks like a map. The black car sits by the gate all afternoon, windows up.',
          'A Red Cap chalks a mark on every sack before it goes in the boot. A red X.',
          B('Bolaji', '(to himself) Marked money. If I just hand it back, they\'ll know exactly whose stall it came from.'),
          B('Bolaji', 'And the car... it\'ll have to slow down at the flooded corner on Adelabu Road. Everybody does.'),
        ],
        notes: 'The car will be slow through the flooded corner. The sacks are chalk-marked: the money has to be changed before it goes back.',
        intel: c => { c.car.ai.topSpeed = 9.2; c.car.ai.health = 3; api.toast('<b>From your rooftop look:</b> the car is slower than it looks and the windows are old. It will crack after <b>3</b> hits.', 'blue'); },
      },
      setup() {
        const ms = game.world.marketSpot;
        const car = api.traffic.spawnGetaway(ms.x + 6, ms.z - 14, Math.PI / 2);
        car.ai.topSpeed = 10.5; car.ai.health = 4; car.ai.maxHealth = 4; car.ai.parked = true;
        spawned.push({ remove: () => api.traffic.remove(car) });
        const women = V({ x: ms.x - 2, z: ms.z + 2, yaw: 0, outfit: TRADERS[1], mood: 'idle' }); women.name = 'the market women'; women.tip = 2500;
        const pos = V({ x: ms.x + 26, z: ms.z + 4, yaw: -Math.PI / 2, outfit: TRADERS[2], mood: 'idle' }); pos.name = 'Iya POS';
        const umb = mesh(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.05, 0.35, 10), new THREE.MeshStandardMaterial({ color: '#fdd835' }))); umb.position.set(ms.x + 26, 2.6, ms.z + 4);
        return { car, women, pos, crew: [], lostT: 0, tails: 1, victim: women };
      },
      morning: f => [
        'Morning. Mama comes back from the market early, laughing, which never happens.',
        B('Mama', 'The market women are singing today! Somebody gave them back their levy. Every naira. Iya Sade even paid for my tomatoes.'),
        B('Mama', 'And the police have blocked every road around Adelabu since 3 AM. Somebody crashed a car there.'),
        B('Mama', '(tying her wrapper) Stay away from that area today, you hear?'),
      ],
      scene: c => [
        'Adelabu Market, after midnight. The stalls are dark. A black car with no plate idles by the gate.',
        B('Red Cap', 'Load am quick! Chairman dey wait. Every kobo dey inside.'),
        B('Bolaji', '(on a rooftop, strapping his board tight) Every kobo. Good.'),
      ],
      focus: c => c.car.pos,
      steps: [
        { label: 'Get to Adelabu Market', text: () => 'Get to <b>Adelabu Market</b> before the car leaves', target: c => c.car.pos, check: c => near(c.car.pos, 30),
          done: c => { c.car.ai.parked = false; api.say('Red Cap', 'Na him! Drive! DRIVE!'); } },
        { label: 'Chase the levy car', text: c => `<b>Chase the levy car</b>, then skitch onto it (E) and smash it (F) <b>(${Math.max(0, c.car.ai.health)} hits)</b>`, sub: c => c.lostT > 0 ? `YOU'RE LOSING IT · ${Math.ceil(12 - c.lostT)}s` : 'SKATE (R) AND PUSH (SHIFT) · SKITCH IT (E) · WHILE HOLDING ON, F SMASHES THE WINDOWS',
          target: c => c.car.pos,
          tick: (c, dt) => { c.lostT = near(c.car.pos, 140) ? 0 : c.lostT + dt; },
          fail: c => c.lostT > 12 && 'The levy car got away. The Chairman gets paid this week.',
          check: c => c.car.ai.stopped },
        { label: 'Beat the crew', text: c => `The car is down. Beat the <b>crew</b> <b>(${alive(c.crew)} left)</b>`, target: c => c.crew.find(t => t.alive)?.pos,
          enter: c => {
            const v = c.car;
            for (const [dx, w] of <any[]>[[-2, 'knife'], [2, 'stick'], [0, 'axe']]) { const t = T({ x: v.pos.x + v.rt.x * dx + v.fwd.x * -1, z: v.pos.z + v.rt.z * dx + v.fwd.z * -1, variant: 'redcap', weapon: w, role: 'guard', group: c.crew }); c.crew.push(t); t.engage(0.3); }
            api.giveItem(c.crew[0], { label: 'the levy money', amount: 60000, keep: true });
            api.say('Red Cap', 'You wan die for market women money?!');
          },
          check: c => alive(c.crew) === 0 },
        { label: 'Get the money', text: () => 'Pick up <b>the levy money</b>', target: () => api.droppedPos(), check: () => api.carrying('the levy money') },
        // THE TURN: the money is marked
        { label: 'Change the marked money', text: () => 'The sacks have <b>red chalk X marks</b>. Change the money at <b>Iya POS</b> first, or the Red Caps will trace it to the women', sub: () => 'IYA POS UNDER THE YELLOW UMBRELLA · F',
          target: c => c.pos.pos, enter: () => api.say('Bolaji', '(looking at the sacks) Red X on every one. They\'ll know.'),
          option: c => near(c.pos.pos, 2.4) && { kind: 'story', text: '<span class="key">F</span>Change ₦60,000 of marked notes with Iya POS (she keeps ₦3,000 "for the risk")' },
          act: c => { c.changed = true; api.recarry({ label: 'the clean money', amount: 57000, owner: c.women }); api.say('Iya POS', 'I no see you. I no see this money. Go.'); game.audio.pickup(); },
          check: c => c.changed },
        { label: 'Return it to the market women', text: () => 'Take the clean money back to <b>the market women</b> at Adelabu', target: c => c.women.pos, check: c => c.returned },
        {
          home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home,
          enter: c => api.scene([
            B('Market woman', 'Sixty thousand! All of it! Sisters, come and see!'),
            B('Market woman', 'But be careful, my son. This morning a man in Egúngún cloth came asking for YOU. He says Surulere needs a real protector, and it is him.'),
            B('Market woman', 'They say he catches thieves and burns them. With tyres. In front of everybody.'),
            B('Bolaji', 'That\'s not protection. That\'s just another gang.'),
          ], c.women.pos, () => {
            api.tails(c.tails);
            // RUN: a crashed "levy car" brings the police out
            api.policeAlert(150);
            api.notice('POLICE', 'Sirens. The crashed levy car has the police setting up checkpoints all round Adelabu. Keep off the main roads.', 'red');
          }, 'THE MARKET WOMEN'),
        },
      ],
      finish: 'The levy is back with the markets. And a masked Egúngún is out there, calling himself Surulere\'s protector.',
    },
    // 5 (was 4) -------------------------------------------------------------------------------
    {
      id: 'egungun', title: 'The Masquerade', hint: 'the Egúngún and a crowd with a tyre',
      morning: () => [
          'Morning. The newspaper says a masquerade and Street Cat fought in the street over a phone thief.',
          B('Mama', 'In my time, masquerades danced. Now they burn people. What kind of Lagos is this?'),
      ],
      radio: 'Breaking! Crowd don gather for street, dem say dem catch phone thief. One man for Egúngún costume dey lead them, dem don bring tyre and petrol! Somebody, anybody, do something!',
      intro: 'A boy accused of stealing a phone is tied up in the street. A crowd, a tyre, a jerrycan of petrol, and a masked Egúngún leading them. You have minutes.',
      setup() {
        const spot = api.spot(90, 190);
        const kayode = V({ x: spot.x, z: spot.z, yaw: Math.atan2(spot.nx, spot.nz), outfit: YOUTH, mood: 'captive' }); kayode.name = 'Kayode';
        const tyre = mesh(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 8, 18), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 })));
        tyre.position.set(spot.x, 0.95, spot.z); tyre.rotation.x = Math.PI / 2;
        const crowd: any[] = [];
        for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, v = V({ x: spot.x + Math.sin(a) * 4.2, z: spot.z + Math.cos(a) * 4.2, yaw: a + Math.PI, mood: 'cheer' }); crowd.push(v); }
        const boys: any[] = [];
        for (const [dx, dz, w] of <any[]>[[-2.5, 2.5, 'knife'], [2.5, 2.5, 'knife'], [0, -3, 'stick']]) boys.push(T({ x: spot.x + dx, z: spot.z + dz, variant: 'agbero2', weapon: w, role: 'guard', group: boys }));
        const eg = T({ x: spot.x + 1.4, z: spot.z - 1.2, variant: 'egungun', role: 'guard', group: [] }); eg.name = 'The Egúngún';
        // the road runs across the spot's normal: he escapes along it
        const rx = -spot.nz, rz = spot.nx;
        return { spot, kayode, tyre, crowd, boys, eg, timer: 150, tails: 1, flee: { x: spot.x + rx * 110 + spot.nx * 5, z: spot.z + rz * 110 + spot.nz * 5 } };
      },
      scene: c => [
        'A crowd has formed. Someone is shouting "Ole! Ole!" A boy in a white shirt is tied up, a tyre around his chest.',
        B('The Egúngún', 'Lagos! The police collect roger. The Red Caps collect levy. Who protects you? I do!'),
        B('Kayode', 'I didn\'t take anything! Check my pocket! Please!'),
        B('The Egúngún', 'Bring the petrol.'),
        B('Bolaji', 'He\'s going to burn him. Move!'),
      ],
      focus: c => c.spot,
      steps: [
        {
          label: 'Get there in time', text: c => `Get to <b>Kayode</b> before they light the tyre <b>${fmt(c.timer)}</b>`, sub: () => 'SKITCH, POUNCE, LEAP ROOFTOPS · EVERY SECOND COUNTS', target: c => c.spot,
          tick: (c, dt) => { c.timer -= dt; }, fail: c => c.timer <= 0 && 'Too late. The crowd dragged Kayode away into the dark. Try again from home.',
          check: c => near(c.spot, 14),
          done: c => { for (const b of c.boys) b.engage(0.2); for (const v of c.crowd) v.mood = 'scared'; api.say('The Egúngún', 'Another one who wants to be a hero. Boys!'); },
        },
        { label: "Beat the Egúngún's boys", text: c => `Stop the Egúngún's boys <b>(${alive(c.boys)} left)</b>`, sub: () => 'KNIVES ARE FAST BUT YOU CAN COUNTER THEM (C)', target: c => c.boys.find(t => t.alive)?.pos, check: c => alive(c.boys) === 0 },
        {
          label: 'Fight the Egúngún', text: () => 'Fight <b>the Egúngún</b>', sub: () => 'HE FLIPS AWAY FROM PLAIN STRIKES · COUNTER HIM, POUNCE (V), OR THROW SOMETHING (T)', target: c => c.eg.pos,
          enter: c => { c.eg.engage(0); api.banner('THE EGÚNGÚN', 'He does what you do, the wrong way', 'red', 2.6); },
          check: c => c.eg.hp <= 5 || !c.eg.alive,
        },
        {
          label: 'Chase him', text: c => `<b>Chase the Egúngún</b> <small>${Math.max(0, 30 - (c.chaseT || 0)).toFixed(0)}s</small>`, sub: () => 'SPRINT (SHIFT), POUNCE (V), SKITCH · GET CLOSE', target: c => c.eg.removed ? null : c.eg.pos,
          enter: c => { const e = c.eg; e.state = 'fled'; e.t = 0; e.fleeTo = c.flee; e.fleeTime = 60; e.fleeSpeed = 7.4; c.chaseT = 0; api.say('The Egúngún', 'You no fit catch spirit!'); },
          tick: (c, dt) => { c.chaseT += dt; },
          check: c => c.eg.removed || c.chaseT > 30 || near(c.eg.pos, 3.2),
          done: c => {
            const caught = !c.eg.removed && near(c.eg.pos, 3.2), at = { x: c.eg.pos.x, y: c.eg.pos.y, z: c.eg.pos.z };
            const vanish = () => { if (!c.eg.removed) { game.fx.burst(c.eg.pos.x, c.eg.pos.y + 1, c.eg.pos.z, 0x9e9e9e, 30, 4); c.eg.remove(); } };
            if (caught) api.scene([
              B('The Egúngún', 'You and I want the same thing, Street Cat. A Lagos where nobody is afraid.'),
              B('Bolaji', 'You made them afraid of you instead.'),
              B('The Egúngún', 'Fear is the only language this city understands. The Red Caps will learn it. And so will you.'),
              'A cloud of dust and coloured cloth. When it clears, he is gone.',
            ], at, vanish, 'THE EGÚNGÚN');
            else { vanish(); api.toast('He\'s gone, over a wall and into the dark. You\'ll see him again.', 'blue'); }
          },
        },
        { label: 'Free Kayode', text: () => 'Free <b>Kayode</b>', sub: () => 'TAKE THE TYRE OFF HIM · F', target: c => c.kayode.pos, check: c => c.kayode.mood !== 'captive', done: c => { game.scene.remove(c.tyre); for (const v of c.crowd) { v.mood = 'run'; v.runHome?.(v.pos.x + (Math.random() - 0.5) * 60, v.pos.z + 40); } } },
        {
          home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home,
          enter: c => api.scene([
            B('Kayode', 'I work at Baba Kolade\'s workshop. I didn\'t steal anything, I swear.'),
            B('Kayode', 'Bros... I know where the Red Caps keep their weapons. The old National Stadium. I saw them carry crates of axes and machetes up the stands.'),
            B('Kayode', 'They are arming for something big.'),
            B('Bolaji', 'Then the crates go first.'),
          ], c.kayode.pos, () => api.tails(c.tails), 'KAYODE'),
        },
      ],
      finish: 'Kayode lives. The Egúngún escaped. And the Red Caps are hiding weapons at the National Stadium.',
    },
    // 6 (new) -----------------------------------------------------------------------------------
    {
      id: 'stadium', title: 'The Stadium', hint: 'the Red Caps\' weapons at the National Stadium',
      morning: () => [
          'Morning. The squatters at the National Stadium are selling scattered machetes as scrap. Nobody asks where they came from.',
          B('Mama', 'Your trousers have stadium dust on them. You went to play football again? At night?'),
      ],
      radio: 'Squatters for National Stadium dey complain: Red Caps don take over the old stands. Dem dey carry crates in and out at night. Nobody fit go near there again.',
      intro: 'The Red Caps are stockpiling axes and machetes in the old National Stadium. Get in quietly, take out the lookouts, and wreck the crates.',
      setup() {
        const st = game.world.stadium, gate = game.world.stadiumGate;
        const stash = { x: st.x - 12, z: st.z + 18 };
        const crates: any[] = [];
        for (let k = 0; k < 3; k++) {
          const x = stash.x + (k - 1) * 2.4, z = stash.z, y = game.world.collision.groundHeight(x, z, 3).h;
          const m = mesh(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: '#6d4c41', roughness: 0.9 })));
          m.position.set(x, y + 0.4, z); m.rotation.y = (k - 1) * 0.3; crates.push({ m, x, z, done: false });
        }
        const look: any[] = [];
        const posts: any[] = [[gate.x - 3, gate.z + 10], [gate.x + 4, gate.z + 14], [st.x - 20, st.z + 4], [st.x + 6, st.z + 22], [stash.x + 4, stash.z - 4]];
        for (const [x, z] of posts) { const t = T({ x, z, yaw: Math.random() * 6.28, variant: Math.random() < 0.5 ? 'redcap' : 'redcap2', weapon: pick(['knife', 'axe', 'stick', null]), role: 'guard', group: look }); look.push(t); }
        return { st, gate, stash, crates, look, backup: [], alarm: false, tails: 2 };
      },
      scene: c => [
        'The National Stadium. Built for 85,000 fans. Tonight, five Red Caps with torches and a stack of crates on the old track.',
        B('Red Cap', 'Chairman say na for Friday. Every boy go get axe.'),
        B('Bolaji', '(on the rim of the stands) Five of them. If one shouts, twenty come. Quiet, then.'),
      ],
      focus: c => c.stash,
      steps: [
        { label: 'Get into the stadium', text: () => 'Get into the <b>National Stadium</b>', sub: () => 'CLIMB THE OUTER WALL OR SLIP THROUGH A TUNNEL', target: c => c.gate, check: c => near(c.gate, 30) || near(c.stash, 60) },
        { label: 'Take out the lookouts', text: c => `Take out the lookouts <b>(${alive(c.look)} left)</b>${c.alarm ? ' · <b>THEY RAISED THE ALARM</b>' : ''}`, sub: c => c.alarm ? 'MORE ARE COMING · FINISH THEM' : 'SNEAK UP BEHIND ONE AND PRESS F: A SILENT TAKEDOWN · IF ONE SEES YOU, THEY CALL FOR BACKUP',
          target: c => c.look.find(t => t.alive)?.pos,
          tick: c => {
            if (!c.alarm && c.look.some(t => t.alive && t.engaged && t.state !== 'alert')) {
              c.alarm = true; api.say('Red Cap', 'INTRUDER! Everybody come!');
              for (let k = 0; k < 3; k++) { const t = T({ x: c.gate.x + (k - 1) * 2, z: c.gate.z + 4, variant: 'redcap2', weapon: pick(['knife', 'stick', 'machete']), role: 'guard', group: c.look }); c.look.push(t); t.engage(0.5); }
            }
          },
          check: c => alive(c.look) === 0 },
        { label: 'Wreck the crates', text: c => `Wreck the weapon crates <b>(${c.crates.filter(k => k.done).length}/3)</b>`, target: c => c.crates.find(k => !k.done),
          option: c => { const k = c.crates.find(q => !q.done && near(q, 2.2)); return k && { kind: 'story', text: '<span class="key">F</span>Smash the crate and scatter the machetes' }; },
          act: c => { const k = c.crates.find(q => !q.done && near(q, 2.2)); if (!k) return; k.done = true; game.scene.remove(k.m); game.fx.burst(k.x, 0.8, k.z, 0x8d6e63, 18, 4); game.audio.punch(); game.addRespect(150, 'CRATE WRECKED'); },
          check: c => c.crates.every(k => k.done),
          done: c => api.scene([
            'Under the last crate, a school notebook. Names, and next to one of them, in red biro: "KOLADE. MECHANIC. FIXES STREET CAT\'S BOARD."',
            B('Bolaji', 'They know about Baba Kolade.'),
          ], c.stash, null, 'THE NOTEBOOK') },
        { home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home, enter: c => api.tails(c.alarm ? c.tails + 1 : c.tails) },
      ],
      finish: 'The Red Caps\' weapons are scattered across the stadium track. But their notebook had a name in it: Baba Kolade.',
    },
    // 7 (was 5) -------------------------------------------------------------------------------
    {
      id: 'kolade', title: "The Chairman's Message", hint: 'Baba Kolade at the motor park',
      morning: () => [
          'Morning. Baba Kolade\'s workshop is open like nothing happened. A new padlock on the door. A new board strap left on your step, no note.',
          B('Mama', 'Kolade the mechanic sent you something. Since when are you and that old man friends?'),
      ],
      radio: 'Eyewitnesses say Red Caps drag Baba Kolade, the Ojuelegba mechanic, comot for im workshop go the motor park. Dem dey shout say na message for "Street Cat".',
      intro: 'The radio said it: the Red Caps dragged Baba Kolade (the mechanic who helped build your board) out of his workshop to the motor park. The Chairman wants to send a message to "Street Cat".',
      setup() {
        const m = api.motorpark;
        const kolade = V({ x: m.x, z: m.z + 5, yaw: Math.PI, outfit: { ...ELDER, top: '#37474f', cap: null }, mood: 'captive' }); kolade.name = 'Baba Kolade';
        const wave1 = [], wave2 = [];
        const W1: any[] = [[-8, -6, 'redcap', 'stick'], [8, -6, 'redcap2', 'bottles'], [-10, 4, 'redcap', 'knife'], [10, 4, 'redcap2', 'machete'], [0, -10, 'brute', null], [-4, 10, 'redcap', 'axe']];
        for (const [dx, dz, v, w] of W1) wave1.push(T({ x: m.x + dx, z: m.z + dz, yaw: Math.PI, variant: v, weapon: w, role: 'guard', group: wave1 }));
        api.scatter(m.x, m.z, 8);
        return { m, kolade, wave1, wave2, tails: 3 };
      },
      scene: c => [
        'Ojuelegba Motor Park. The danfos are parked for the night. Baba Kolade is on his knees in the middle of it all.',
        B('Red Cap', 'Old man, who be Street Cat? Who fix im board?'),
        B('Baba Kolade', 'I fix every board in Surulere. Ask them.'),
        B('Red Cap', 'Scorpion go soon come. Then you go talk.'),
      ],
      focus: c => c.m,
      steps: [
        { label: 'Get to the motor park', text: () => 'Get to the <b>Ojuelegba motor park</b>', target: c => c.m, check: c => near(c.m, 40) },
        { label: 'Fight through', text: c => `Fight through the Red Caps <b>(${alive(c.wave1)} left)</b>`, sub: () => 'AXES (RED "!") HIT HARD: DODGE · G SWEEPS WHEN 3 ARE CLOSE', target: c => c.wave1.find(t => t.alive)?.pos, check: c => alive(c.wave1) === 0, enter: c => { for (const t of c.wave1) t.engage(0.2); } },
        {
          label: 'Beat Scorpion', text: () => '<b>Scorpion</b>, the Chairman\'s enforcer. Take him down', sub: () => 'HE BLOCKS FROM THE FRONT AND SWINGS A MACHETE · DODGE, THEN POUNCE, THROW, OR HIT HIM FROM BEHIND', target: c => c.wave2[0]?.pos,
          enter: c => {
            const m = c.m;
            c.wave2.push(T({ x: m.x, z: m.z - 16, yaw: 0, variant: 'scorpion', weapon: 'machete', role: 'guard', group: c.wave2 }));
            c.wave2.push(T({ x: m.x - 5, z: m.z - 15, yaw: 0, variant: 'redcap', weapon: 'knife', role: 'guard', group: c.wave2 }));
            c.wave2.push(T({ x: m.x + 5, z: m.z - 15, yaw: 0, variant: 'redcap2', weapon: 'stick', role: 'guard', group: c.wave2 }));
            api.scene([B('Scorpion', 'So you be Street Cat. Small boy like this?'), B('Scorpion', 'Chairman say make I bring your head.')], c.wave2[0].pos, () => { for (const t of c.wave2) t.engage(0.6); }, 'SCORPION');
          },
          check: c => c.wave2[0].hp <= 4 || !c.wave2[0].alive,
          done: c => {
            const sc = c.wave2[0]; const at = { x: sc.pos.x, y: sc.pos.y, z: sc.pos.z };
            for (const t of c.wave2) if (t.alive) { t.flee(); t.fleeTime = 12; }
            api.scene([
              B('Scorpion', '(bleeding, backing away) You think say you don win?'),
              B('Scorpion', 'Chairman don call Okafor. Police go turn Aguda upside down tonight. Every boy for your street go enter Black Maria until somebody talk!'),
              'He limps into the dark. Nobody follows him.',
            ], at, null, 'SCORPION');
          },
        },
        { label: 'Free Baba Kolade', text: () => 'Free <b>Baba Kolade</b>', target: c => c.kolade.pos, check: c => c.kolade.mood !== 'captive' },
        {
          home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home,
          enter: c => api.scene([
            B('Baba Kolade', 'Bolaji. I know it is you. I know my own board.'),
            B('Baba Kolade', 'If the police are coming to Aguda, they are coming for your street. Your mother\'s street.'),
            B('Bolaji', 'Then I\'ll be there first.'),
          ], c.kolade.pos, () => api.tails(c.tails), 'BABA KOLADE'),
        },
      ],
      finish: 'Baba Kolade is safe. Scorpion fled, and he let it slip: Okafor\'s police are coming to Aguda.',
    },
    // 8 (new) -----------------------------------------------------------------------------------
    {
      id: 'blackmaria', title: 'Black Maria', hint: 'Okafor\'s police raid in Aguda',
      morning: () => [
          'Morning. Dayo\'s mother is crying on the street, happy crying. Three boys came home last night that the police had already written down.',
          B('Mama', '(at the window) Okafor\'s men were on THIS street last night. On our street, Bolaji. Where were you?'),
          B('Bolaji', 'Sleeping, Mama.'),
          B('Mama', 'Hmm.'),
      ],
      radio: 'Aguda people, stay inside! Police don block one street, dem dey pack young boys enter Black Maria. Dem say dem dey find "Street Cat". Anybody wey wear black, dem go carry am.',
      intro: 'Okafor\'s men are rounding up the young men of Aguda into a police van, to beat a name out of them. Get them out before the van leaves.',
      setup() {
        const sp = api.spot(45, 110), vx = sp.x + sp.nx * 3.5, vz = sp.z + sp.nz * 3.5, vyaw = Math.atan2(-sp.nz, sp.nx);
        const van = mesh(new THREE.Group()); van.position.set(vx, 0, vz); van.rotation.y = vyaw;
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 5.2), new THREE.MeshStandardMaterial({ color: '#10151f', roughness: 0.6 })); body.position.y = 1.35; van.add(body);
        const t = textSign('POLICE', '#10151f', '#e3f2fd', 512, 128); const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.3 }));
        for (const sx of [1, -1]) { const q = sg.clone(); q.position.set(sx * 1.11, 1.9, 0); q.rotation.y = sx * Math.PI / 2; van.add(q); }
        for (const [x, z] of <any[]>[[-0.9, 1.8], [0.9, 1.8], [-0.9, -1.8], [0.9, -1.8]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), new THREE.MeshStandardMaterial({ color: '#111' })); w.rotation.z = Math.PI / 2; w.position.set(x * 1.2, 0.42, z); van.add(w); }
        const bx = Math.sin(vyaw), bz = Math.cos(vyaw), back = { x: vx - bx * 3.4, z: vz - bz * 3.4 };
        game.world.collision.solids.add(vx - 2.2, 0, vz - 2.2, vx + 2.2, 2.5, vz + 2.2, 'van');
        const boys: any[] = [];
        for (let k = 0; k < 3; k++) { const v = V({ x: back.x + (k - 1) * 1.1 - bz * 0.5, z: back.z + (k - 1) * 1.1 * 0 + bx * (k - 1) * 1.1, yaw: vyaw + Math.PI, outfit: { ...YOUTH, top: ['#fafafa', '#263238', '#1565c0'][k] }, mood: 'captive' }); v.name = ['Dayo', 'Chuks', 'Segun'][k]; boys.push(v); }
        const cops: any[] = [];
        const posts: any[] = [[back.x - bx * 3, back.z - bz * 3, vyaw + Math.PI], [vx + bz * 3, vz - bx * 3, vyaw + Math.PI / 2], [vx - bz * 3, vz + bx * 3, vyaw - Math.PI / 2], [vx + bx * 4, vz + bz * 4, vyaw]];
        posts.forEach(([x, z, yaw], k) => { const g = G({ x, z, yaw, outfit: k === 0 ? { ...OUTFITS.police, beret: '#b71c1c' } : null, post: { x, z, yaw, cp: { stopped: null } } }); if (k === 0) { g.name = 'Inspector Okafor'; g.maxHp = g.hp = 5; } cops.push(g); });
        return { van: { x: vx, z: vz }, back, boys, cops, freed: 0, seen: false, timer: 180, tails: 0, captives: boys };
      },
      scene: c => [
        'Your own street. A black police van, doors open, and three boys you grew up with on their knees behind it.',
        B('Inspector Okafor', 'One of you is Street Cat. Or one of you knows him. At the station we will find out which.'),
        B('Dayo', 'Oga, I sell recharge card! I don\'t know anything!'),
        B('Bolaji', '(from the rooftop) Four officers. Guns. If they see me, they shoot. Quiet. Or dark.'),
      ],
      focus: c => c.back,
      steps: [
        { label: 'Get close to the van', text: () => 'Get close to the <b>police van</b> without being seen', target: c => c.back, check: c => near(c.back, 25) },
        { label: 'Free the boys', text: c => `Free the boys <b>(${c.freed}/3)</b> before the van leaves <b>${fmt(c.timer)}</b>`, sub: c => c.seen ? 'THEY SAW YOU · FREE THEM FAST, THEN RUN' : 'OFFICERS SEE WHAT\'S IN FRONT OF THEM · PULL A TRANSFORMER FUSE (F) TO KILL THE LIGHTS · UNTIE: F',
          target: c => c.boys.find(v => v.mood === 'captive')?.pos,
          tick: (c, dt) => {
            c.timer -= dt;
            if (c.seen) return;
            const pp = P(), dark = game.power < 0.5;
            for (const g of c.cops) {
              if (!g.alive || g.state !== 'post') continue;
              const dx = pp.x - g.pos.x, dz = pp.z - g.pos.z, d = Math.hypot(dx, dz);
              if (d > (dark ? 6 : 13) || (Math.sin(g.yaw) * dx + Math.cos(g.yaw) * dz) / (d || 1) < 0.25) continue;
              if (game.world.collision.blocked(g.pos.x, g.pos.y + 1.6, g.pos.z, pp.x, pp.y + 1.2, pp.z, 1.2)) continue;
              c.seen = true; api.addHeat(2, 'Inspector Okafor: "THERE HE IS! SHOOT!"'); break;
            }
          },
          fail: c => c.timer <= 0 && c.freed < 3 && 'The van drove off with them. By morning they will say anything Okafor wants.',
          check: c => c.freed >= 3 },
        { label: 'Lose the police', text: () => '<b>Lose the police</b>', sub: () => 'BREAK LINE OF SIGHT · CLIMB · SKITCH', target: () => null, check: () => game.heat === 0, enter: c => { if (!c.seen) api.addHeat(1, 'Okafor: "The boys are gone! Search the street!"'); } },
        {
          home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home,
          enter: c => api.scene([
            B('Chuks', '(at the corner, out of breath) Whoever you are... thank you.'),
            B('Chuks', 'One more thing. The masquerade man was watching the raid from a roof. He said: "Tonight Adelabu burns, and the Red Caps who sleep in it."'),
            B('Bolaji', 'Adelabu. The market women sleep there too.'),
          ], c.boys[0].pos, null, 'CHUKS'),
        },
      ],
      finish: 'Three Aguda boys are home instead of in a cell. But the Egúngún is going to set Adelabu Market on fire.',
    },
    // 9 (new) -----------------------------------------------------------------------------------
    {
      id: 'fire', title: 'Fire at Adelabu', hint: 'the Egúngún\'s fire at Adelabu Market',
      morning: () => [
          'Morning. Mama sniffs the air near your mat.',
          B('Mama', 'Why do you smell of smoke? Of kerosene?'),
          B('Bolaji', 'Adelabu was burning last night, Mama. Everybody in Aguda smells like it.'),
          'She lets it go. For now.',
      ],
      radio: 'Fire! Fire for Adelabu Market! People say na the masquerade man pour petrol. Market women dey inside! Fire service no come! Anybody wey dey near, help!',
      intro: 'The Egúngún has set Adelabu Market on fire to burn out the Red Caps who sleep there, and the market women with them. Put out the fires, and face him.',
      setup() {
        const ms = game.world.marketSpot;
        const fires: any[] = [];
        const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.45, 0.1).multiplyScalar(2.2), transparent: true, opacity: 0.85, toneMapped: false });
        for (const [dx, dz] of <any[]>[[-8, 6], [6, 10], [0, 16], [10, 3]]) {
          const g = mesh(new THREE.Group()); const x = ms.x + dx, z = ms.z + dz; g.position.set(x, 0.15, z);
          for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.5 - k * 0.1, 1.6 - k * 0.3, 6), flameMat); f.position.set((k - 1) * 0.35, 0.8, (k % 2) * 0.3); g.add(f); }
          fires.push({ g, x, z, out: false, size: 1 });
        }
        const women: any[] = []; for (let k = 0; k < 2; k++) { const v = V({ x: ms.x - 3 + k * 2, z: ms.z + 12, yaw: 0, outfit: TRADERS[k], mood: 'cower' }); women.push(v); }
        const boys: any[] = [];
        for (const [dx, dz, w] of <any[]>[[-4, 2, 'knife'], [4, 2, 'knife'], [0, -2, 'stick'], [-6, 12, 'machete']]) boys.push(T({ x: ms.x + dx, z: ms.z + dz, variant: 'agbero2', weapon: w, role: 'guard', group: boys }));
        const eg = T({ x: ms.x + 2, z: ms.z + 8, variant: 'egungun', role: 'guard', group: [] }); eg.name = 'The Egúngún'; eg.calm = true;
        return { ms, fires, women, boys, eg, timer: 160, tails: 1 };
      },
      scene: c => [
        'Adelabu Market is burning. Smoke over the stalls, women screaming inside, and the masquerade standing in the middle of it.',
        B('The Egúngún', 'You again. Look at it, Street Cat. The Red Caps sleep in this market. Tonight, they burn with it.'),
        B('Bolaji', 'So do the women who sell here!'),
        B('The Egúngún', 'Every war has a price. Boys, keep him busy.'),
      ],
      focus: c => c.ms,
      steps: [
        { label: 'Put out the fires', text: c => `Put out the fires <b>(${c.fires.filter(f => f.out).length}/4)</b> before the market goes up <b>${fmt(c.timer)}</b>`, sub: () => 'F AT A FIRE TO BEAT IT OUT · HIS BOYS WILL TRY TO STOP YOU',
          target: c => c.fires.filter(f => !f.out).sort((a, b) => Math.hypot(a.x - P().x, a.z - P().z) - Math.hypot(b.x - P().x, b.z - P().z))[0],
          enter: c => { for (const b of c.boys) b.engage(0.5); },
          tick: (c, dt) => { c.timer -= dt; for (const f of c.fires) if (!f.out) { f.size = Math.min(2.2, f.size + dt * 0.006); const k = f.size * (1 + Math.sin(game.time * 9 + f.x) * 0.08); f.g.scale.set(f.size, k, f.size); if (Math.random() < dt * 3) game.fx.burst(f.x, 1.8 * f.size, f.z, 0x555555, 2, 1); } },
          fail: c => c.timer <= 0 && 'The fire took the market. Everyone got out, but years of stock are ash.',
          option: c => { const f = c.fires.find(q => !q.out && near(q, 2.4)); return f && { kind: 'story', text: '<span class="key">F</span>Beat out the fire' }; },
          act: c => { const f = c.fires.find(q => !q.out && near(q, 2.4)); if (!f) return; f.out = true; game.scene.remove(f.g); game.fx.burst(f.x, 1, f.z, 0x9e9e9e, 24, 4); game.audio.splash?.(); game.addRespect(120, 'FIRE OUT'); },
          check: c => c.fires.every(f => f.out),
          done: c => { for (const w of c.women) { w.mood = 'run'; w.runHome(w.pos.x + 40, w.pos.z - 30); } } },
        { label: "Stop the Egúngún's boys", text: c => `Stop the Egúngún's boys <b>(${alive(c.boys)} left)</b>`, target: c => c.boys.find(t => t.alive)?.pos, check: c => alive(c.boys) === 0 },
        { label: 'Beat the Egúngún', text: () => 'Beat <b>the Egúngún</b>', sub: () => 'HE FLIPS AWAY FROM PLAIN STRIKES · COUNTER HIM (C), POUNCE (V), THROW (T)', target: c => c.eg.pos,
          enter: c => { c.eg.calm = false; c.eg.maxHp = c.eg.hp = 12; c.eg.engage(0); api.banner('THE EGÚNGÚN', 'Round two', 'red', 2.2); },
          check: c => c.eg.hp <= 4 || !c.eg.alive,
          done: c => {
            const e = c.eg, at = { x: e.pos.x, y: e.pos.y, z: e.pos.z };
            api.scene([
              B('The Egúngún', '(on one knee, breathing hard) Hm. You are better than me. Faster. Maybe you are right.'),
              B('The Egúngún', 'Listen. Friday night, every Red Cap in Lagos meets under Ojuelegba Bridge. The Chairman himself will be there. Scorpion has been calling them for days.'),
              B('The Egúngún', 'I will not stop you. I will not help you. I will watch.'),
              'A burst of coloured cloth, and he is gone over the stalls.',
            ], at, () => { if (!e.removed) { game.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, 0x9e9e9e, 30, 4); e.remove(); } }, 'THE EGÚNGÚN');
          } },
        { home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home, enter: c => api.tails(c.tails) },
      ],
      finish: 'Adelabu is saved. The Egúngún stepped aside, and told you where to find every Red Cap in Lagos: Friday, Ojuelegba.',
    },
    // 10 (was 6) ------------------------------------------------------------------------------
    {
      id: 'showdown', title: 'Showdown at Ojuelegba', hint: 'the Red Caps gathering under Ojuelegba Bridge',
      morning: () => [
          'Morning. Five words on a pillar under Ojuelegba, and all of Lagos is reading them on their phones.',
          B('Mama', '(holding her handbag very carefully) Bolaji. Something came for you. From JAMB.'),
      ],
      radio: 'Everybody wey dey Ojuelegba, abeg go house early tonight. Red Caps from everywhere dey gather under the bridge. Dem say dem dey wait for Street Cat. Tonight na tonight.',
      intro: 'Every Red Cap in Surulere is under Ojuelegba Bridge tonight: axes, knives, machetes. The Chairman is there. End it, and leave him a message.',
      setup() {
        const u = api.underBridge(2), c0 = { x: u.cx, z: u.cz };
        const chairman = T({ x: u.cx, z: u.cz - 9, yaw: 0, variant: 'chairman', role: 'guard', group: [] }); chairman.name = 'The Chairman';
        // the Red Caps' flag on a pole, where the message goes
        const pole = mesh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 5, 8), new THREE.MeshStandardMaterial({ color: '#5d4037' }))); pole.position.set(u.cx + 3, 2.5, u.cz - 10);
        const flag = mesh(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ color: '#b71c1c', side: THREE.DoubleSide, roughness: 0.9 }))); flag.position.set(u.cx + 3.92, 4.35, u.cz - 10);
        const idle: any[] = [];
        for (const o of ring(c0, [['redcap', 'axe'], ['redcap2', 'knife'], ['redcap', 'stick'], ['redcap2', 'knife'], ['redcap', 'machete'], ['redcap2', 'bottles']], 7)) idle.push(T({ ...o, role: 'guard', group: idle }));
        api.scatter(u.cx, u.cz, 12);
        return { u, c0, chairman, pole, flag, w1: idle, w2: [], w3: [], tails: 0, wave: 1 };
      },
      scene: c => [
        'Friday night. Ojuelegba. Fires under the flyover, and more red berets than Bolaji has ever seen in one place.',
        B('The Chairman', 'So this is Street Cat. The one who takes my money, my traders, my police envelope.'),
        B('The Chairman', 'Surulere has a landlord, boy. And rent is due.'),
        B('Bolaji', 'Surulere doesn\'t belong to you.'),
        B('The Chairman', '(walking away) Finish him. All of you.'),
      ],
      focus: c => c.c0,
      steps: [
        { label: 'Get to Ojuelegba', text: () => 'Get to <b>Ojuelegba Bridge</b>', sub: () => 'EAT AND REST FIRST IF YOU NEED TO · THIS IS THE BIG ONE', target: c => c.c0, check: c => near(c.c0, 38),
          done: c => { const ch = c.chairman; ch.state = 'fled'; ch.t = 0; ch.fleeTime = 10; ch.fleeTo = { x: c.u.cx, z: c.u.cz - 120 }; for (const t of c.w1) t.engage(0.3); api.banner('WAVE 1 OF 3', 'Knives and sticks', 'red', 2.2); } },
        { label: 'Wave 1: knives and sticks', text: c => `Survive <b>wave 1 of 3</b> <b>(${alive(c.w1)} left)</b>`, sub: () => 'KNIVES: COUNTER (C) · AXES AND MACHETES: DODGE · G: CAT SWEEP WHEN SURROUNDED', target: c => c.w1.find(t => t.alive)?.pos, check: c => alive(c.w1) === 0,
          done: c => { game.player.hp = Math.min(game.player.cap(), game.player.hp + 25); api.toast('<b>Second wind.</b> +25 health. More are coming from the other side.', 'green'); api.scatter(c.u.cx, c.u.cz, 6); } },
        { label: 'Wave 2: axes and machetes', text: c => `Survive <b>wave 2 of 3</b> <b>(${alive(c.w2)} left)</b>`, sub: () => 'THE RED "!" MEANS DODGE (C WITH NOTHING TO COUNTER ROLLS)', target: c => c.w2.find(t => t.alive)?.pos,
          enter: c => { wave({ x: c.u.cx, z: c.u.cz }, [['redcap', 'axe'], ['redcap2', 'machete'], ['brute', null], ['redcap', 'knife'], ['redcap2', 'axe'], ['redcap', 'knife']], 24, c.w2); api.banner('WAVE 2 OF 3', 'Axes and machetes', 'red', 2.2); },
          check: c => alive(c.w2) === 0,
          done: c => { game.player.hp = Math.min(game.player.cap(), game.player.hp + 25); api.toast('<b>Second wind.</b> +25 health. Scorpion is back.', 'green'); api.scatter(c.u.cx, c.u.cz, 6); } },
        { label: 'Wave 3: Scorpion', text: c => `Final wave: <b>Scorpion</b> and his crew <b>(${alive(c.w3)} left)</b>`, sub: () => 'SCORPION BLOCKS FROM THE FRONT: POUNCE, THROW, OR FLANK HIM', target: c => c.w3.find(t => t.alive)?.pos,
          enter: c => {
            const at = { x: c.u.cx, z: c.u.cz - 22 };
            c.w3.push(T({ x: at.x, z: at.z, variant: 'scorpion', weapon: 'machete', role: 'guard', group: c.w3 }));
            for (const [dx, v, w] of <any[]>[[-3, 'brute', null], [3, 'redcap', 'axe'], [-6, 'redcap2', 'knife'], [6, 'redcap', 'knife']]) c.w3.push(T({ x: at.x + dx, z: at.z - 1, variant: v, weapon: w, role: 'guard', group: c.w3 }));
            api.scene([B('Scorpion', '(a bandage around his head) I told you. Every Red Cap.'), B('Bolaji', 'Then you\'re the last of them.')], at, () => { for (const t of c.w3) t.engage(0.5); }, 'FINAL WAVE');
          },
          check: c => alive(c.w3) === 0 },
        {
          label: "Leave the Chairman a message", text: () => 'Leave <b>the Chairman</b> a message', sub: () => 'GO TO THE RED CAPS\' FLAG · F', target: c => ({ x: c.pole.position.x, z: c.pole.position.z }), check: c => c.message,
          option: c => near({ x: c.pole.position.x, z: c.pole.position.z }, 2.6) && { kind: 'story', text: '<span class="key">F</span>Tear down the Red Caps\' flag and leave your message' },
          act: c => {
            c.message = true; game.scene.remove(c.flag);
            // spray-paint the message on the nearest flyover pillar, on the side facing the camp
            const P = c.pole.position;
            const pil = game.world.collision.solids.query(P.x - 14, P.z - 14, P.x + 14, P.z + 14, []).filter(q => q.kind === 'pillar')
              .sort((q1, q2) => Math.hypot((q1.minx + q1.maxx) / 2 - P.x, (q1.minz + q1.maxz) / 2 - P.z) - Math.hypot((q2.minx + q2.maxx) / 2 - P.x, (q2.minz + q2.maxz) / 2 - P.z))[0];
            const cv = document.createElement('canvas'); cv.width = 512; cv.height = 680; const x2 = cv.getContext('2d');
            x2.fillStyle = '#f4f1ea'; x2.textAlign = 'center'; x2.font = 'bold 118px Anton, Impact, sans-serif';
            ['SURULERE', 'IS NOT', 'FOR SALE'].forEach((w, k) => { x2.save(); x2.translate(256, 170 + k * 190); x2.rotate((k - 1) * -0.03); x2.fillText(w, 0, 0); x2.restore(); });
            for (let k = 0; k < 14; k++) { const dx = 60 + Math.random() * 390, dy = 190 + Math.floor(Math.random() * 3) * 190; x2.fillRect(dx, dy - 10, 5, 20 + Math.random() * 55); } // paint drips
            const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
            const m = mesh(new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.66), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.08, polygonOffset: true, polygonOffsetFactor: -2 })));
            if (pil) {
              const cx = (pil.minx + pil.maxx) / 2, cz = (pil.minz + pil.maxz) / 2, side = c.u.cx > cx ? 1 : -1; // the face looking into the camp
              m.position.set(side > 0 ? pil.maxx + 0.02 : pil.minx - 0.02, 2.3, cz); m.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
              c.paint = { x: m.position.x, y: 1.1, z: cz, dir: { x: side, z: 0 } };
            } else { m.position.set(P.x, 2.3, P.z - 0.5); c.paint = { x: P.x, z: P.z }; }
            game.audio.pickup();
          },
          done: c => api.scene([
            'The red flag burns in the Red Caps\' own fire. On the pillar beside it, in white spray paint, five words.',
            'SURULERE IS NOT FOR SALE.',
            'Across Lagos, a phone rings in a big house. The Chairman listens for a long time and says nothing.',
            B('The Chairman, on the phone', '(finally) Find out who he is. Find his mother.'),
          ], c.paint || { x: c.pole.position.x, z: c.pole.position.z }, null, 'THE MESSAGE'),
        },
        { home: true, label: 'Get home to finish the mission', text: () => game.homeObjective(), target: () => api.home, check: c => c.home },
      ],
      finish: 'The Red Caps are broken in Surulere. The Chairman has lost his street, and now he wants a name.',
    },
  ];

  // ---------------- daytime missions ----------------
  // No mask, no suit: Bolaji in his own clothes, in daylight, in front of people who know his face.
  // He can still help, but every cat move and knockout fills EYES ON YOU. If it fills, he's
  // recognised and the mission fails (and Mama and the police hear about it).
  const TOBI = { skin: '#5b3a26', top: '#1565c0', bottom: '#263238', sock: '#5b3a26', sole: '#2b2b2b', shorts: true, sheen: '#445577', scale: 0.74 };
  const DAY_MISSIONS = [
    {
      id: 'daylevy', title: 'Levy in Broad Daylight', where: 'Adelabu Market', day: true, quiet: true,
      radio: 'Red Caps no dey wait for night again o! Dem dey collect "levy" for Adelabu Market this afternoon, in front of everybody. Iya Sade stall na their target today.',
      start: () => ({ x: game.world.marketSpot.x, z: game.world.marketSpot.z }),
      setup() {
        const ms = game.world.marketSpot, x = ms.x + 4, z = ms.z + 3;
        const sade = V({ x: x + 1.6, z, yaw: -Math.PI / 2, outfit: TRADERS[0], mood: 'scared' }); sade.name = 'Iya Sade'; sade.tip = 1500;
        const group: any[] = [];
        const col = T({ x, z, yaw: Math.PI / 2, variant: 'redcap', role: 'guard', group }); group.push(col);
        group.push(T({ x: x - 1.5, z: z + 1.6, yaw: Math.PI / 2, variant: 'redcap2', weapon: 'stick', role: 'guard', group }));
        group.push(T({ x: x - 1.5, z: z - 1.6, yaw: Math.PI / 2, variant: 'redcap', role: 'guard', group }));
        for (const t of group) t.calm = true;
        api.giveItem(col, { label: "Iya Sade's money", amount: 12000, owner: sade });
        return { sade, group, col, victim: sade };
      },
      scene: c => [
        'Adelabu Market at noon. Pepper, tomatoes, a thousand voices. And three red berets at Iya Sade\'s stall.',
        B('Red Cap', 'Mama, your levy. Chairman say market no dey free again.'),
        B('Iya Sade', 'I paid last week! Take it, take it, just go.'),
        B('Bolaji', '(to himself) Everybody here knows my face. No cat tricks. Get behind him and take it back.'),
      ],
      focus: c => c.col.pos,
      steps: [
        { label: 'Get to Iya Sade\'s stall', text: () => 'Get to <b>Iya Sade\'s stall</b> at Adelabu Market', target: c => c.col.pos, check: c => near(c.col.pos, 12) },
        { label: 'Get the money back', text: () => 'Get <b>Iya Sade\'s money</b> back', sub: () => 'SNEAK BEHIND THE COLLECTOR AND PICK HIS POCKET (F) · FIGHTING IN DAYLIGHT FILLS "EYES ON YOU"', target: c => api.droppedPos() || c.col.pos, check: c => api.carrying("Iya Sade's money") },
        { label: 'Return it quietly', text: () => 'Give the money back to <b>Iya Sade</b>', sub: () => 'WALK, DON\'T RUN', target: c => c.sade.pos, check: c => c.returned },
      ],
      finish: 'Iya Sade has her money. Nobody saw anything, just a boy from Aguda buying pepper.', reward: 1500,
    },
    {
      id: 'bagsnatch', title: 'Bag Snatchers of Bode Thomas', where: 'Bode Thomas', day: true, quiet: true,
      radio: 'Women for Bode Thomas, hold your bag well! Two boys dey snatch bag and run inside the crowd this afternoon. One woman lose her shop money this morning.',
      start: () => { const s0 = S.dayStartSpot ||= api.spot(60, 140) || { x: 0, z: 0, nx: 0, nz: 1 }; return { x: s0.x, z: s0.z }; },
      setup() {
        const s0 = S.dayStartSpot || api.spot(60, 140);
        const woman = V({ x: s0.x, z: s0.z, yaw: 0, outfit: TRADERS[2], mood: 'idle' }); woman.name = 'Mrs. Okonkwo'; woman.tip = 2000;
        return { s0, woman, victim: woman, thieves: [] };
      },
      steps: [
        { label: 'Get to Bode Thomas', text: () => 'Get to <b>Bode Thomas</b>', target: c => c.s0, check: c => near(c.s0, 18),
          done: c => {
            const s0 = c.s0, rx = -s0.nz, rz = s0.nx;
            for (const k of [1, -1]) {
              const t = T({ x: s0.x + rx * k * 1.2, z: s0.z + rz * k * 1.2, variant: 'agbero2', role: 'guard' });
              t.hp = t.maxHp = 2; t.state = 'run'; t.t = 0; t.runSpeed = 5.8; t.runTo = { x: s0.x + rx * k * 130 + s0.nx * 4, z: s0.z + rz * k * 130 + s0.nz * 4 };
              c.thieves.push(t);
            }
            api.giveItem(c.thieves[0], { label: "Mrs. Okonkwo's bag", amount: 20000, owner: c.woman });
            c.woman.mood = 'wave'; api.say('Mrs. Okonkwo', 'My bag! My shop money! Thief! THIEF!');
          } },
        { label: 'Catch the one with the bag', text: () => 'Catch the thief <b>with the bag</b>', sub: () => 'TWO RAN: THE BAG IS ON THE ONE WITH THE RED MARKER · TRIP HIM WITH A THROW (T) · NO POUNCING IN FRONT OF PEOPLE',
          target: c => api.droppedPos() || (c.thieves[0].alive ? c.thieves[0].pos : null), check: c => api.carrying("Mrs. Okonkwo's bag"),
          fail: c => c.thieves[0].escaped && !api.carrying("Mrs. Okonkwo's bag") && !api.droppedPos() && 'He disappeared into the crowd with the bag.' },
        { label: 'Return the bag', text: () => 'Give the bag back to <b>Mrs. Okonkwo</b>', target: c => c.woman.pos, check: c => c.returned },
      ],
      finish: 'Mrs. Okonkwo has her shop money. "Na ordinary boy catch am!" the crowd says. Good. Ordinary.', reward: 2000,
    },
    {
      id: 'fees', title: "Tobi's School Fees", where: 'Aguda Primary School', day: true, quiet: true,
      radio: 'Parents for Aguda Primary dey complain: area boys dey rob small pikin of their school fees for the school gate. This afternoon again! Where are the police?',
      start: () => { const q = game.day.pois.school; return { x: q.x, z: q.z }; },
      setup() {
        const q = game.day.pois.school;
        const tobi = V({ x: q.x + 2, z: q.z + 2, yaw: 0, outfit: TOBI, mood: 'cower' }); tobi.name = 'Tobi';
        const group: any[] = [];
        for (let k = 0; k < 3; k++) { const a = k * 2.1; const t = T({ x: q.x + 2 + Math.sin(a) * 1.6, z: q.z + 2 + Math.cos(a) * 1.6, yaw: a + Math.PI, variant: 'agbero2', weapon: k === 1 ? 'stick' : null, role: 'beater', group }); t.victim = tobi; group.push(t); }
        api.giveItem(group[0], { label: "Tobi's school fees", amount: 8000, owner: tobi });
        return { q, tobi, group, victim: tobi };
      },
      scene: c => [
        'Aguda Primary School, closing time. Three area boys have a small boy in a blue shirt against the wall.',
        B('Area boy', 'Small boy, bring the money. Your mama no go know.'),
        B('Tobi', 'Leave me! Na my school fees! BOLAJI!'),
        B('Bolaji', '(to himself) My brother. Everybody here knows us. Just fists. Nothing they can talk about.'),
      ],
      focus: c => c.tobi.pos,
      steps: [
        { label: 'Get to the school', text: () => 'Get to <b>Aguda Primary School</b>', target: c => c.tobi.pos, check: c => near(c.tobi.pos, 14) },
        { label: 'Deal with the area boys', text: c => `Deal with the area boys <b>(${alive(c.group)} left)</b>`, sub: () => 'PLAIN STRIKES AND COUNTERS ONLY · CAT MOVES FILL "EYES ON YOU" FAST', target: c => c.group.find(t => t.alive)?.pos, check: c => alive(c.group) === 0 },
        { label: 'Get the school fees', text: () => 'Pick up <b>Tobi\'s school fees</b>', target: () => api.droppedPos(), check: () => api.carrying("Tobi's school fees"), enter: c => { c.tobi.mood = 'idle'; c.tobi.faceTarget = P(); } },
        { label: 'Give them to Tobi', text: () => 'Give the money back to <b>Tobi</b>', target: c => c.tobi.pos, check: c => c.returned,
          done: c => api.scene([B('Tobi', 'Bros... you fought three of them. Like... like...'), B('Bolaji', 'Like somebody\'s big brother. Go home. Don\'t tell Mama.'), B('Tobi', '(grinning) I won\'t tell anybody anything.')], c.tobi.pos, null, 'TOBI') },
      ],
      finish: 'Tobi\'s fees are safe. He looks at you differently now.', reward: 500,
    },
  ];
  S.dayMissions = DAY_MISSIONS;
  S.dayAvailable = () => game.mode === 'patrol' ? null : DAY_MISSIONS[S.dayDone] || null;
  S.unlockDay = () => { if (S.dayUnlocked || !S.dayAvailable()) return; S.dayUnlocked = true; S.dayStartSpot = null; const d = S.dayAvailable(); api.notice('DAYTIME MISSION', `${d.title}: ${d.where}. Go now, in daylight. Keep your face out of it.`, 'green'); game.audio.pickup(); };
  S.dayStart = () => { const d = S.dayAvailable(); return d && S.dayUnlocked && game.life.phase === 'day' && !S.active ? d.start() : null; };
  S.beginDay = () => { const d = S.dayAvailable(); if (!d || S.active) return; S.begin(d); };

  // ---------------- mission flow ----------------
  S.unlockNext = (how) => {
    const i = S.index; if (S.unlocked > i || i >= MISSIONS.length) return;
    S.unlocked = i + 1;
    api.notice('NEW LEAD', `${MISSIONS[i].title}: you heard it ${how}. Start it from your door at night.`, 'green');
    game.audio.pickup(); game.save?.();
  };
  S.next = () => game.mode === 'patrol' ? null : (S.unlocked > S.index ? MISSIONS[S.index] : null) || null;
  S.upcoming = () => game.mode === 'patrol' ? null : MISSIONS[S.index] || null;
  S.begin = (dm) => {
    const m = dm || S.next(); if (!m || S.active) return;
    cleanup();
    const c = m.setup();
    S.active = { m, c, i: 0, startT: game.time, s0: { ...game.stats, respect: game.respect, hits: game.hitsTaken || 0, best: game.combat.best, wanted: game.life.wanted, rank: game.rank?.().name } };
    game.missionMoves = new Set(); game.combat.best = 0;
    if (m.recon) { if (S.recon[m.id]) { m.recon.intel?.(c); api.notice('INTEL', m.recon.notes, 'blue'); } else api.notice('GOING IN BLIND', 'You never looked at the place in daylight. No intel tonight.', 'red'); }
    const focus = m.focus?.(c) || m.steps[0].target?.(c);
    api.scene(m.scene?.(c), focus ? { x: focus.x, y: focus.y || 0, z: focus.z } : null, () => m.steps[0].enter?.(c), m.day ? `DAYTIME · ${m.title.toUpperCase()}` : `MISSION ${S.index + 1} · ${m.title.toUpperCase()}`);
  };
  const step = () => S.active && S.active.m.steps[S.active.i];
  S.target = () => { const a = S.active; if (!a) return null; const t = step().target?.(a.c); return t ? { x: t.x, z: t.z } : null; };
  S.objective = () => {
    const a = S.active; if (!a) return null;
    const st = step();
    return `${st.text(a.c)}${st.sub ? `<small>${st.sub(a.c)}</small>` : ''}`;
  };
  // the checklist on the right of the screen
  S.tracker = () => {
    const a = S.active;
    if (a) return { title: a.m.title, sub: a.m.day ? 'DAYTIME MISSION · NO MASK' : `MISSION ${S.index + 1} OF ${MISSIONS.length}`, steps: a.m.steps.map((st, i) => ({ label: st.label, state: i < a.i ? 'done' : i === a.i ? 'cur' : '' })) };
    if (S.complete) return null;
    const m = S.upcoming(); if (!m) return null;
    const L = game.life;
    const how = L.phase === 'day' ? 'Tonight: leave through the door at home' : L.inside ? (L.suit ? 'Go out through the door' : 'Put on the suit (water drum), then the door') : 'Go home, then out through the door';
    const dm = S.dayAvailable(), L2 = game.life;
    if (L2.phase === 'day' && dm && S.dayUnlocked) return { title: dm.title, sub: 'DAYTIME MISSION · NO MASK', steps: [{ label: `Go to ${dm.where}`, state: 'cur' }, { label: 'Keep your face out of it: no cat moves in front of people', state: '' }] };
    if (S.next() && m.recon) return { title: m.title, sub: `NEXT STORY MISSION · ${S.index + 1} OF ${MISSIONS.length}`, steps: [
      { label: `Look (day, no mask): ${m.recon.label}`, state: S.recon[m.id] ? 'done' : L.phase === 'day' ? 'cur' : '' },
      { label: 'Do (night): leave through your door', state: S.recon[m.id] || L.phase !== 'day' ? 'cur' : '' },
      { label: 'Run: get home unseen', state: '' }] };
    return { title: S.next() ? m.title : '???', sub: `NEXT STORY MISSION · ${S.index + 1} OF ${MISSIONS.length}`, steps: [{ label: S.next() ? how : 'Listen to the radio (N) for news', state: 'cur' }, { label: 'Or: patrol, side jobs, explore', state: '' }] };
  };
  S.homeStep = () => !!step()?.home;
  S.onEnterHome = () => { if (S.active) S.active.c.home = true; };
  S.onReturned = (owner) => { if (S.active && S.active.c.victim === owner) S.active.c.returned = true; };
  S.onFreed = (v) => { if (S.active && S.active.c.captives?.includes(v)) S.active.c.freed++; };
  S.option = () => { const a = S.active, st = step(); return (a && st.option?.(a.c)) || null; };
  S.doOption = () => { const a = S.active, st = step(); if (a && st.act) { st.act(a.c); return true; } return false; };
  S.fail = (msg) => {
    const a = S.active; if (!a) return;
    cleanup(); S.active = null;
    api.banner('MISSION FAILED', msg, 'red', 5);
    game.addRespect(0);
  };
  // after a reload: if the job was already done and only "get home" was left, count it now
  S.resumePending = (hp) => {
    if (typeof hp === 'string') hp = { id: hp };
    const i = MISSIONS.findIndex(m => m.id === hp.id); if (i < 0 || i !== S.index) return false;
    const m = MISSIONS[i];
    const s0 = hp.s0 || { ...game.stats, respect: game.respect, rank: game.rank?.().name };
    s0.hits = (game.hitsTaken || 0) - (hp.hits || 0);
    S.active = { m, c: { home: true }, i: m.steps.length - 1, startT: game.time - (hp.secs || 0), s0 };
    game.missionMoves = new Set(hp.moves || []); game.combat.best = hp.best || 0; complete(); return true;
  };
  function complete() {
    S.homePending = null;
    const a = S.active;
    const report = missionReport(a);
    setTimeout(() => game.onMissionComplete?.(report), 1800); // a beat to breathe, then the debrief
    if (a.m.morning) S.morning = a.m.id; // the city reacts the next morning
    api.banner('MISSION COMPLETE', '', 'green', 1.6);
    game.logNight?.('mission', { id: a.m.id, title: a.m.title });
    if (a.m.day) { // daytime missions run alongside the story
      game.addRespect(500, a.m.title.toUpperCase()); if (a.m.reward) game.life.wallet += a.m.reward;
      S.active = null; S.dayDone++; S.dayUnlocked = false; spawned = []; setTimeout(() => game.save?.(), 0);
      return;
    }
    game.addRespect(1000, a.m.title.toUpperCase());
    game.calmUntil = game.time + 240; // four quiet minutes after a story mission: breathe
    game.life.wanted = Math.min(3, game.life.wanted + 1);
    S.active = null; S.index++;
    if (S.saved) { S.index = Math.max(S.index, S.saved.index); S.unlocked = Math.max(S.unlocked, S.saved.unlocked); S.saved = null; }
    const nx = MISSIONS[S.index];
    if (nx) setTimeout(() => api.toast('Keep your <b>radio</b> on (<span class="key">N</span>). When Lagos talks about the next thing, you\'ll hear it. Till then: patrol, do jobs, explore.', 'blue'), 5500);
    setTimeout(() => game.save?.(), 0);
    if (S.index >= MISSIONS.length) { S.complete = true; setTimeout(() => game.onChapterComplete?.(), 5500); }
  }
  // ---- LOOK: the daytime recon before a story mission ----
  S.reconFor = () => { const m = S.next(); return m && m.recon && !S.recon[m.id] && !S.active && game.life.phase === 'day' ? m : null; };
  S.reconTarget = () => { const m = S.reconFor(); if (!m) return null; const w = m.recon.where(); return { x: w.x, z: w.z, label: m.recon.label }; };
  let reconEnts = [], staleEnts = [], reconT = 0, reconOf = null;
  S.reconObjective = () => { const m = S.reconFor(); if (!m) return null; return `Look · ${m.recon.task}${reconT > 0 ? ` <b>${Math.round(reconT / m.recon.watch * 100)}%</b>` : ''}<small>DAYTIME RECON FOR TONIGHT'S ${m.title.toUpperCase()} · STAND AND WATCH · NO MASK, SO DON'T START ANYTHING</small>`; };
  function updateRecon(dt) {
    const m = S.reconFor();
    if (m !== reconOf) { staleEnts.push(...reconEnts); reconEnts = []; reconT = 0; reconOf = m; }
    // leftover recon people disappear once he's gone (or at night)
    if (staleEnts.length && (game.life.phase !== 'day' || staleEnts.every(e => !e.pos || !near(e.pos, 70)))) { for (const e of staleEnts) e.remove?.(game.scene); staleEnts = []; }
    if (!m || game.life.inside) return;
    const w = m.recon.where();
    if (!reconEnts.length && near(w, 80)) reconEnts = m.recon.setup?.(w) || [];
    const ok = m.recon.ok ? m.recon.ok(w) : near(w, 11) && Math.hypot(game.player.vel.x, game.player.vel.z) < 2.6 && !game.life.suit;
    reconT = ok ? reconT + dt : Math.max(0, reconT - dt * 0.4);
    if (reconT >= m.recon.watch) {
      S.recon[m.id] = true; reconT = 0;
      api.scene(m.recon.scene(w), { x: w.x, y: 0, z: w.z }, () => { api.notice('YOU\'VE SEEN ENOUGH', m.recon.notes, 'green'); game.addRespect(100, 'RECON'); game.save?.(); }, `LOOK · ${m.title.toUpperCase()}`);
    }
  }
  // ---- the morning after: the city (and Mama) react ----
  S.playMorning = () => {
    const id = S.morning; S.morning = null;
    const m = MISSIONS.find(q => q.id === id); if (!m?.morning) return;
    const R = game.world.room;
    api.scene(m.morning(S.flags), { x: R.x, y: 0, z: R.z }, null, 'THE MORNING AFTER');
  };
  // ---- the debrief: what you did, how well, what's next ----
  const PAR = { babaade: 240, roger: 360, bridge: 300, levyrun: 420, egungun: 300, stadium: 420, kolade: 360, blackmaria: 300, fire: 360, showdown: 540 };
  const SIGS = ['CAT DROP', 'ROOFTOP AMBUSH', 'CAT CHAIN', 'WALL SPRING', 'CAT SWEEP', 'ALLEY CAT FLURRY', 'SILENT TAKEDOWN', 'FLYING KNEE', 'AXE KICK', 'TACKLED', 'NINE LIVES'];
  function missionReport(a) {
    const s0 = a.s0, st = game.stats, secs = game.time - a.startT;
    const kos = st.knockdowns - s0.knockdowns, hits = (game.hitsTaken || 0) - s0.hits, returned = st.returned - s0.returned, best = game.combat.best;
    const moves = [...(game.missionMoves || [])].filter(m => SIGS.includes(m));
    const par = PAR[a.m.id] || 300, fast = secs < par, scouted = a.m.recon ? !!S.recon[a.m.id] : null;
    const well = [], better = [];
    if (hits <= 2) well.push('Barely touched: ' + (hits ? `only ${hits} hit${hits > 1 ? 's' : ''} taken.` : 'not a scratch.')); else if (hits > 8) better.push(`You took ${hits} hits. Watch for the "!" and counter (C), dodge the red ones.`);
    if (moves.length) well.push('Signature moves: ' + moves.slice(0, 4).map(m => m.toLowerCase()).join(', ') + '.'); else better.push('Try a signature move: drop from a roof for a Cat Drop, pounce (V) from above, chain pounces.');
    if (secs < 5) {} else if (fast) well.push(`Quick: done in ${fmt(secs)} (par ${fmt(par)}).`); else better.push(`Took ${fmt(secs)}. Skitch, skate or ride a danfo to get there faster.`);
    if (scouted === true) well.push('You scouted it in daylight first.'); else if (scouted === false) better.push('Next time look at the place in daylight first: the intel makes the night easier.');
    if (best >= 10) well.push(`A ${best}-hit combo.`);
    if (returned > 0) well.push(`₦${returned.toLocaleString()} back where it belongs.`);
    const stars = Math.max(1, Math.min(3, 1 + (hits <= 4 ? 1 : 0) + (moves.length || (fast && secs >= 5) ? 1 : 0)));
    const rank = game.rank?.().name, nx = MISSIONS[S.index + 1];
    const unlocks = [`+${(game.respect - s0.respect + (a.m.day ? 500 : 1000)).toLocaleString()} respect`];
    if (rank && rank !== s0.rank) unlocks.push(`New street rank: ${rank}`);
    if (!a.m.day && nx) unlocks.push(`Next: listen to the radio for "${nx.title}"`);
    if (!a.m.day && !nx) unlocks.push('Chapter 1 complete');
    return { title: a.m.title, sub: a.m.day ? 'Daytime mission' : `Chapter 1 · Mission ${S.index + 1} of ${MISSIONS.length}`, finish: a.m.finish, stars, time: secs < 5 ? '-' : fmt(secs), kos, hits, best, returned, well, better, unlocks };
  }
  S.update = (dt) => {
    updateRecon(dt);
    const a = S.active;
    if (a) {
      const st = step();
      st.tick?.(a.c, dt);
      const f = st.fail?.(a.c) || (a.m.quiet && game.recognisedAt > a.startT && 'People recognised you. By tonight all of Aguda will be talking about Mama Bolaji\'s son.');
      if (f) S.fail(f);
      else if (st.check(a.c)) {
        st.done?.(a.c);
        a.i++;
        if (a.i >= a.m.steps.length) complete();
        else {
          step().enter?.(a.c);
          if (step().home) { S.homePending = { id: a.m.id, s0: a.s0, secs: game.time - a.startT, moves: [...(game.missionMoves || [])], hits: (game.hitsTaken || 0) - a.s0.hits, best: game.combat.best }; api.banner('JOB DONE', 'Now get home without being followed to finish the mission.', 'white', 3.5); game.save?.(); }
        }
      }
    }
    // side events: a beating in progress somewhere nearby
    if (game.life.phase === 'night' && !S.complete && game.mode !== 'patrol') S.nextSide -= dt;
    if (!S.side && S.nextSide <= 0 && !game.player.fightingNear && !S.active && !game.carrying && !game.dropped && !(game.activities?.anyActive?.() && !S.side)) {
      const spot = api.spot(70, 170);
      if (spot) {
        const outfit = TRADERS[Math.floor(Math.random() * TRADERS.length)], name = VICTIM_NAMES[Math.floor(Math.random() * VICTIM_NAMES.length)];
        api.scatter(spot.x, spot.z, 3);
        const W = [null, 'stick', 'knife', null, 'knife'].sort(() => Math.random() - 0.5);
        const sc = beatingScene(spot, 2 + Math.floor(Math.random() * 3), outfit, name, Math.random() < 0.6 ? { label: `${name}'s money`, amount: 5000 + Math.floor(Math.random() * 6) * 2500 } : null, { weapons: W, brute: Math.random() < 0.25, gang: 'agbero' });
        S.side = { ...sc, t: 0 };
        game.radio.say(`Caller for ${game.world.areaAt(spot.x, spot.z)}: "Agberos dey beat ${name} for my street right now! Somebody help!"`); api.notice('TROUBLE', `${game.world.areaAt(spot.x, spot.z)}: follow the red marker.`, 'red');
        game.audio.alert();
      }
      S.nextSide = game.mode === 'patrol' ? 55 + Math.random() * 40 : 110 + Math.random() * 70;
    }
    if (S.side) {
      const sd = S.side; sd.t += dt;
      if (alive(sd.group) === 0 && !sd.cleared) {
        sd.cleared = true; sd.victim.mood = 'idle'; sd.victim.faceTarget = game.player.pos;
        game.addRespect(300, 'SAVED ' + sd.victim.name.toUpperCase()); game.logNight?.('saved', { name: sd.victim.name });
        api.say(sd.victim.name, ['God bless you, my son!', 'Who are you?! Thank you, thank you!', 'Jesus! You saved my life!'][Math.floor(Math.random() * 3)]);
        const tip = 500 + Math.floor(Math.random() * 3) * 500; game.life.wallet += tip; api.toast(`${sd.victim.name} pressed <b>₦${tip}</b> into your hand "for food".`, 'green');
        setTimeout(() => { if (!sd.victim.gone && !api.itemFor(sd.victim)) sd.victim.runHome(sd.victim.pos.x + 30, sd.victim.pos.z); }, 5000);
      }
      if (sd.cleared && !api.itemFor(sd.victim) && sd.t > 5) S.side = null;
      else if (!sd.cleared && sd.t > 150 && !near(sd.victim.pos, 60)) { api.toast(`You were too late for ${sd.victim.name}.`, 'red'); for (const t of sd.group) t.remove(); sd.victim.remove(game.scene); S.side = null; }
    }
  };
  S.sideTarget = () => { const sd = S.side; if (!sd || sd.cleared) return null; return sd.victim.pos; };
  S.missions = MISSIONS;
  S.progress = () => Math.max(S.index, S.saved?.index ?? 0);
  S.jump = (i) => {
    cleanup();
    // replaying an earlier mission must not rewind the story: remember where we really are
    if (i < S.progress()) { S.saved ||= { index: S.index, unlocked: S.unlocked }; }
    S.active = null; S.index = i; S.unlocked = Math.max(S.unlocked, i + 1); S.complete = false;
    S.begin();
  };
  return S;
}
