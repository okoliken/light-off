// The end-of-night report: how the night ended, what Bolaji actually did tonight (not lifetime totals),
// and the headline Lagos wakes up to tomorrow.
const pick = a => a[Math.floor(Math.random() * a.length)];
const money = n => '₦' + Math.round(n).toLocaleString();
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

const MISSION_HEADLINES = {
  babaade: 'PUNCH: Masked youth rescues Surulere shoemaker from cult boys',
  roger: 'THE SUN: Ojuelegba checkpoint "robbed" of envelope, Inspector vows arrest',
  bridge: 'VANGUARD: Missing Adelabu traders return home, say "boy in black" freed them',
  egungun: 'PUNCH: Mob justice stopped in Surulere as masked vigilantes clash',
  kolade: 'THE NATION: Cult enforcer "Scorpion" flees motor park battle',
  levyrun: 'PUNCH: Cult "levy car" crashes on Adelabu Road, market women get their money back',
  stadium: 'VANGUARD: Axes and machetes found scattered across National Stadium track',
  blackmaria: 'THE SUN: Aguda youths escape police van in the dark, Inspector Okafor fumes',
  fire: 'PUNCH: Adelabu Market fire put out by "boy in black" before fire service arrives',
  showdown: 'GUARDIAN: "Surulere is not for sale": message painted under Ojuelegba Bridge',
};

export function nightStart(game) {
  game.nightLog = [];
  game.nightBase = { ...game.stats, respect: game.respect }; game.sleptInSuit = false;
  if (game.combat) game.combat.best = 0;
}

export function nightReport(game, ending) {
  const L = game.life, st = game.stats, b = game.nightBase || { ...st, respect: game.respect }, log = game.nightLog || [];
  const d = k => Math.max(0, (st[k] || 0) - (b[k] || 0));
  const tonight = { returned: d('returned'), helped: d('families') + d('saved'), down: d('knockdowns'), combo: game.combat?.best || 0, respect: Math.max(0, game.respect - b.respect) };
  const missions = log.filter(e => e.k === 'mission'), people = [...new Set(log.filter(e => e.k === 'returned' || e.k === 'saved' || e.k === 'freed').map(e => e.name).filter(Boolean))];

  // what he did tonight, in plain words
  const deeds: any[] = [];
  if (missions.length) deeds.push(`You finished <b>${list(missions.map(m => m.title))}</b>.`);
  if (tonight.returned) deeds.push(`You put <b>${money(tonight.returned)}</b> back in the hands it was taken from${people.length ? ` (${list(people.slice(0, 3))}${people.length > 3 ? ' and others' : ''})` : ''}.`);
  else if (people.length) deeds.push(`You helped ${list(people.slice(0, 3))}.`);
  if (tonight.down) deeds.push(tonight.down === 1 ? 'One Red Cap will wake up with a headache.' : `<b>${tonight.down}</b> Red Caps went down${tonight.combo >= 8 ? `, ${tonight.combo} hits in one unbroken combo` : ''}.`);
  if (log.some(e => e.k === 'roger')) deeds.push('And the police lost their roger money.');
  if (!deeds.length && ending === 'dawn') deeds.push('You stayed out until the sky went grey, and have nothing to show for it.');
  else if (!deeds.length && ending === 'beaten') deeds.push('Whatever you went out to do tonight, it didn\'t happen.');
  else if (!deeds.length) deeds.push(pick(['A quiet night. You watched the streets from the rooftops and came home. Some nights Lagos just breathes.', 'Nothing happened tonight, and that\'s not nothing. The street slept.', 'You patrolled, you watched, you came home. The Red Caps stayed in their holes.']));

  const S = game.story, next = S.next(), up = S.upcoming();
  const nextLine = S.complete ? 'Surulere is quieter than it has been in years. For now.' : next ? `Tomorrow night: <b>${next.title}</b>.` : up ? 'Keep your radio on tomorrow. Lagos will tell you what\'s next.' : '';
  // he lives alone in a face-me-I-face-you: it's the compound that notices
  const mamaLine = L.suspicion > 70 ? 'The woman across the corridor has started watching your door at night. She knows something.' : L.suspicion > 40 ? (tonight.down ? 'Your knuckles are scraped again. You tell the neighbours it was football.' : 'The compound gate creaks every time you go out at night. Somebody is going to ask.') : '';

  let kicker, title, story, tone;
  if (ending === 'beaten') {
    tone = 'red'; title = 'Left in the gutter'; kicker = `Night ${L.night} · They took everything`;
    // where he wakes up depends on the night: police still hunting (a clinic bench), a friend in Kolade, or the gutter
    const kolade = (game.story.progress?.() ?? 0) >= 7;
    if ((game.beatenHeat || 0) > 0) { title = 'The clinic bench'; kicker = `Night ${L.night} · Police still out looking`; story = 'You woke on a bench outside the clinic by the stadium. The night nurse cleaned your cuts and asked no questions, because the police were asking enough of them outside. You walked home the long way, through the back roads.'; }
    else if (kolade && Math.random() < 0.5) { title = "Kolade's floor"; kicker = `Night ${L.night} · Picked up and hidden`; story = 'You woke on the oily floor of Baba Kolade\'s workshop with a jacket over you. "The street talks," he said, handing you tea. "Tonight it said a boy in black was lying in a gutter. Drink, then go home before your mother wakes."'; }
    else story = pick([
      'Iya Bose, on her way to fry akara, found you by the gutter at first light. She asked no questions, just helped you back to your room.',
      'A keke driver starting his early run saw you on the roadside. He carried you to your gate and drove off before you could thank him.',
      'The night guard from the next compound found you at dawn and dragged you to your door. He said nothing. In Lagos, that is a kindness.',
      'The mallam who sells suya found you at dawn, poured water on your face and walked you home, muttering prayers the whole way.',
    ]) + ' Your pockets are empty. Your ribs will remember this for days.';
  } else if (ending === 'arrested') {
    tone = 'red'; title = 'A night in the cell'; kicker = `Night ${L.night} · Surulere Division`;
    story = pick([
      'They held you in the cell until 6 AM with nine other boys and one bucket. Nobody asked your name twice. At dawn an officer took ₦20,000 "for bail" that you did not have, and pushed you out of the back gate.',
      'An officer wrote "suspected cultist" on a sheet and forgot about you. At six they let you out through the back because the morning shift wanted the space. Nobody was waiting at the gate. Nobody ever is.',
    ]);
  } else if (ending === 'dawn') {
    tone = 'red'; title = 'Caught at dawn'; kicker = `Night ${L.night} · The compound was already up`;
    story = pick([
      'The landlord is sweeping the compound when you slip in: "Bolaji! Where are you coming from this early?" You say you went to ease yourself. He doesn\'t believe you.',
      'The woman across the corridor is at her door with her market basket when you slip in. She says nothing at all. That\'s worse.',
      '"Na this hour you dey come back?" the landlord asks, looking at the dust on your shoes. You mumble something about a night shift.',
    ]);
  } else {
    tone = 'green'; title = 'Home safe'; kicker = `Night ${L.night} · Nobody saw you come in`;
    story = game.sleptInSuit
      ? 'You fell asleep still in the black hoodie, with the door half open. In the morning the landlord\'s son is standing in the corridor, looking at it. He doesn\'t say anything. Yet.'
      : pick(['The door creaks. The compound is asleep. You roll the suit into the bag and lie down on your mat.',
        'You slip into your room and lie down on your mat. Next door, the generator coughs itself to sleep.',
        'The suit goes back in the drum. The lantern goes out. Somewhere outside, a danfo conductor is already shouting "Oshodi!"']);
    if (game.sleptInSuit) { tone = 'red'; title = 'Slept in the suit'; kicker = `Night ${L.night} · Somebody saw the hoodie`; }
  }

  let headline;
  const top = missions[missions.length - 1];
  if (top && MISSION_HEADLINES[top.id]) headline = MISSION_HEADLINES[top.id];
  else if (ending === 'arrested') headline = 'THE SUN: Police round up "suspected cultists" in overnight Surulere raid';
  else if (ending === 'beaten') headline = 'VANGUARD: Young man found beaten near Aguda gutter, police say "no report"';
  else if (tonight.returned >= 10000) headline = `PUNCH: "Boy in black" returns ${money(tonight.returned)} to Surulere families`;
  else if (tonight.down >= 3) headline = `THE SUN: ${tonight.down} cult boys beaten in overnight street fights, residents say`;
  else headline = pick(['BUSINESSDAY: Fuel queues return as scarcity bites Lagos', 'PUNCH: NEPA promises 18 hours of light for Surulere', 'THE SUN: Danfo drivers hike fares again, blame fuel']);

  return { ending, tone, kicker, title, story, deeds: deeds.join(' '), next: nextLine, mama: mamaLine, tonight, totals: { returned: st.returned, respect: game.respect, down: st.knockdowns }, headline };
}
