// Lagos talk. Conversations on rides (driver and Bolaji go back and forth about whatever Lagos is
// going through today) and overheard lines on the street near stalls, bus stops and crowds.
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// [who, line]: D = the driver / okada man / conductor, B = Bolaji
export const RIDE_TALK: [string, string][][] = [
  [['D', 'Fuel don reach ₦1,200 again. How person go survive this country?'], ['B', 'Na why una fare dey jump every week.'], ['D', 'My brother, na the pump price dey drive me, no be me.']],
  [['D', 'You hear say NEPA take light for Surulere since yesterday?'], ['B', 'Na our side. Generator noise no let person sleep.'], ['D', 'Band A dem dey call am. Band A for where?']],
  [['D', 'Third Mainland don block again. Somebody car spoil for the middle.'], ['B', 'Every day na the same story.'], ['D', 'Na why I no dey cross that bridge after four o\'clock.']],
  [['D', 'You watch Super Eagles yesterday?'], ['B', 'I no see light watch am.'], ['D', 'Better. Them for give you high BP. That defence na open gate.']],
  [['D', 'My guy just japa go Canada last week.'], ['B', 'Everybody dey comot.'], ['D', 'Me sef, if I see visa today, this okada go meet you for road.']],
  [['D', 'You hear about this boy in black? Them say he dey collect money from agberos give market women.'], ['B', 'Na story. Who go do that for Lagos?'], ['D', 'My sister see am with her eye for Ojuelegba! Police dey find am like mad.']],
  [['D', 'Police stop me for Ojuelegba this morning. ₦1,000 roger, before seven.'], ['B', 'Na their own salary.'], ['D', 'If I no give, na "where your particulars" till evening.']],
  [['D', 'Rain go fall today. See as the sky black.'], ['B', 'Then Adelabu go flood again.'], ['D', 'Last time water reach my knee for that junction.']],
  [['D', 'Which way you dey go sef? You get work?'], ['B', 'I dey run delivery. Parcel, food, anything.'], ['D', 'Hustle na hustle. No shame for am.']],
  [['D', 'Big Brother don start again. My wife no dey sleep.'], ['B', 'Na una house be the real Big Brother.'], ['D', 'Hahaha! You no lie.']],
  [['D', 'LASTMA dey that corner, hold well, no let them see say you no wear helmet.'], ['B', 'Na me be the helmet.'], ['D', 'Small boy, you get mouth!']],
  [['D', 'Garri don cost pass rice now. Wetin we go eat?'], ['B', 'Na hustle we go chop.'], ['D', 'Amen o.']],
];

export const STREET_TALK: [string, string][] = [
  ['Trader', 'Tomato don cost again o! ₦3,000 for small basket!'],
  ['Trader', 'Buy your pure water! Cold pure water!'],
  ['Man on phone', 'I dey come, I don reach Ojuelegba... I dey Ojuelegba, I swear.'],
  ['Woman', 'This NEPA people, them no dey tire? Light no stay one hour.'],
  ['Conductor', 'CMS! CMS! Oshodi-Oke! Enter with your change!'],
  ['Young man', 'Guy, the transfer never land. Network dey fall my hand.'],
  ['Mama put', 'Rice and stew, ₦800! Add meat na ₦500 extra.'],
  ['Boy', 'Ball! Ball! Pass am! Oya, goal!'],
  ['Woman', 'You hear say police carry three boys for Yaba yesterday? Them say na Yahoo.'],
  ['Man', 'Who get charger? Abeg, my phone don die.'],
  ['Agbero', 'Owo da?! Driver, where my money?'],
  ['Old man', 'In our time, ₦10 fit buy food for the whole house.'],
  ['Girl', 'Make we go E-Centre this evening, new film don come.'],
  ['Preacher', 'Repent! The end is near! Even NEPA cannot stop the light of God!'],
  ['Vulcanizer', 'Your tyre don flat? Bring am, I go gum am.'],
  ['Woman', 'Them say the boy in black wear cat ears. Na juju or na costume?'],
];

export function createChatter(game) {
  const C: any = { convo: null, streetT: 25 };
  // a ride conversation: one line every few seconds, both sides
  C.startRide = (driverName: string) => { C.convo = { lines: pick(RIDE_TALK), i: 0, t: 3.5, who: driverName }; };
  C.stopRide = () => { C.convo = null; };
  C.update = (dt: number) => {
    const c = C.convo;
    if (c) { c.t -= dt; if (c.t <= 0 && c.i < c.lines.length) { const [w, l] = c.lines[c.i++]; game.hud.say(w === 'B' ? 'Bolaji' : c.who, l, 3.6); c.t = 4.2; if (c.i >= c.lines.length) { c.lines = pick(RIDE_TALK); c.i = 0; c.t = 9; } } return; }
    // overheard on the street: near food stands, bus stops and crowds
    C.streetT -= dt;
    if (C.streetT > 0 || game.life.inside || game.inMall || game.heat > 0 || game.player.fightingNear) return;
    const p = game.player.pos, near = (q, r) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < r * r;
    const busy = game.world.vendors.some(v => near(v, 14)) || (game.world.busStops || []).some(s => near(s, 14)) || (game.crowdPeople?.() || []).filter(q => near(q, 10)).length >= 3;
    if (!busy) { C.streetT = 4; return; }
    const [w, l] = pick(STREET_TALK); game.hud.say(w, l, 3.4); C.streetT = (game.job?.clockedIn ? 40 : 22) + Math.random() * 25;
  };
  return C;
}
