// Bolaji has to live. A night runs 10:30 PM to 5:30 AM (about 24 real minutes). Hunger and energy drain,
// faster when he sprints and fights; when they run low he slows down, hits softer, can't flip, and heals
// slowly. He eats at suya / akara / mama-put stands or from Mama's pot at home, and ends the night by
// sleeping at home. He must never lead anyone home: if a Red Cap lookout is following him, lose them first.
export const NIGHT_START = 22 * 60 + 30, NIGHT_END = 29 * 60 + 30; // minutes; 29:30 = 5:30 AM next day
export const DAY_START = 8 * 60, DUSK = 17 * 60 + 30, EVENING = 19 * 60;
const NIGHT_RATE = (NIGHT_END - NIGHT_START) / (24 * 60); // a night is ~24 real minutes
const DAY_RATE = (EVENING - DAY_START) / (14 * 60);       // a day is ~14 real minutes

export function createLife(game) {
  const L: any = {
    night: 1, phase: 'day', clock: DAY_START, eveningWarned: false, lateHome: false, hunger: 75, energy: 100, wallet: 3000, meals: 2, wanted: 0,
    dawnWarned: false, lateWarned: false, caught: false, tails: [], inside: true, suspicion: 0, suit: false, bag: false, items: { torch: false, pins: 0, meds: 0, drinks: 0, pepper: 3, smoke: 2, nails: 2, skills: [] }, noise: 0,
  };
  L.timeStr = () => {
    const m = Math.floor(L.clock) % (24 * 60), h = Math.floor(m / 60), mm = m % 60;
    return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  L.eff = () => {
    const low = Math.min(L.hunger, L.energy);
    return low >= 45 ? 1 : 0.55 + 0.45 * (low / 45);
  };
  L.update = (dt) => {
    const p = game.player;
    if (L.inside) return;
    L.clock += dt * (L.phase === 'day' ? DAY_RATE : NIGHT_RATE);
    if (L.phase === 'day' && game.mode === 'patrol' && L.clock >= NIGHT_START) { L.phase = 'night'; L.dawnWarned = true; game.hud.notice(L.timeStr(), 'Night. The suit is in your bag (U to change where nobody sees).', 'blue', 3); }
    if (L.phase === 'day') {
      if (game.mode !== 'patrol' && !L.eveningWarned && L.clock > 18 * 60) { L.eveningWarned = true; game.hud.notice('6:00 PM', 'Mama is back from the market. Go home for dinner.', 'white', 3); }
      if (game.mode !== 'patrol' && !L.lateHome && L.clock > 20 * 60) { L.lateHome = true; L.suspicion = Math.min(100, L.suspicion + 10); game.hud.toast('Mama is asking where you are. <b>Go home.</b>', 'red'); }
    }
    const spd = Math.hypot(p.vel.x, p.vel.z), fighting = p.mode === 'act' || p.fightingNear;
    L.hunger = Math.max(0, L.hunger - dt * (0.045 + (spd > 7 ? 0.03 : 0) + (fighting ? 0.05 : 0)));
    L.energy = Math.max(0, L.energy - dt * (0.03 + (spd > 7 && p.mode === 'foot' ? 0.06 : 0) + (fighting ? 0.09 : 0) + (p.mode === 'climb' || p.mode === 'wallrun' ? 0.08 : 0)));
    p.eff = L.eff(); p.energy = L.energy;
    if (L.hunger <= 0 && p.hp > 20 && Math.random() < dt * 0.05) { p.hp -= 3; game.hud.toast('You\'re starving. <b>Eat something.</b>', 'red'); }
    if (L.phase === 'night' && game.mode !== 'patrol' && !L.dawnWarned && L.clock > 28 * 60 + 45) { L.dawnWarned = true; game.hud.notice('4:45 AM', 'Mama wakes at 5:30 for the market. Get home.', 'white', 3); }
    if (L.phase === 'night' && !L.caught && L.clock >= NIGHT_END) { L.caught = true; game.onDawn?.(); }
  };
  L.eat = (fill, label) => { const p = game.player; L.hunger = Math.min(100, L.hunger + fill); p.injury = Math.max(0, p.injury - 4); p.hp = Math.min(p.cap(), p.hp + 8); game.hud.popup(`${label} <b>+${fill}</b>`); game.audio.pickup(); };
  // daylight 0..1 from the clock
  L.daylight = () => {
    if (L.phase === 'night') return 0;
    if (L.clock < DUSK) return 1;
    return Math.max(game.mode === 'patrol' && L.clock > EVENING + 60 ? 0.04 : 0.12, 1 - (L.clock - DUSK) / (EVENING - DUSK) * 0.88);
  };
  L.label = () => `${L.phase === 'day' ? 'DAY' : 'NIGHT'} ${L.night}`;
  // after dinner, Mama and Tobi fall asleep: night begins
  L.toNight = () => { L.phase = 'night'; L.clock = NIGHT_START; L.hunger = Math.min(100, L.hunger + 30); L.meals = 2; L.dawnWarned = false; L.caught = false; };
  // sleep through the morning: a new day
  L.newNight = () => {
    L.night++; L.phase = 'day'; L.clock = DAY_START; L.dawnWarned = false; L.caught = false; L.eveningWarned = false; L.lateHome = false;
    L.energy = 100; L.hunger = Math.max(20, L.hunger - 25); L.meals = 1; L.wanted = Math.max(0, L.wanted - 1);
    const p = game.player; p.injury *= 0.4; p.hp = p.cap(); p.lastDownT = -99; // sleep heals most injuries
  };
  L.followers = () => game.thugs.filter(t => t.alive && t.state === 'tail');
  L.watched = () => L.followers().some(t => t.sees && Math.hypot(t.pos.x - game.player.pos.x, t.pos.z - game.player.pos.z) < 60);
  return L;
}
