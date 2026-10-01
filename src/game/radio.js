// Bolaji's pocket radio (N, or the radio on the window sill at home). Lagos runs on radio: this is how he
// hears what is going on. The next story mission, daytime missions, trouble happening right now, and
// the city talking about "the boy in black" all come over the air. A blinking RADIO light means there
// is news he hasn't heard yet.
const pick = a => a[Math.floor(Math.random() * a.length)];
const STATIONS = ['WAZOBIA FM 95.1', 'COOL FM 96.9', 'RADIO LAGOS 107.5', 'NAIJA FM 102.7'];
const FLAVOUR_DAY = [
  'Traffic for Western Avenue na wahala this morning, abeg find another road.',
  'NEPA don promise light for Aguda this week. We dey wait.',
  'Fuel don reach new price for some stations. Who we go complain to?',
  'Na rain go fall this evening. Surulere people, una gutter don clear?',
  'Danfo drivers say the new "roger" for checkpoints don pass their profit. Who dey hear them?',
  'Market women for Adelabu say sales slow. Money no dey anybody hand.',
];
const FLAVOUR_NIGHT = [
  'Late night on the radio. Na only generators and mosquitoes dey talk now.',
  'If you dey drive this night, abeg lock your door. Third Mainland no be joke after midnight.',
  'Callers dey ask: who be this boy in black wey dey jump like cat? Na spirit? Na human?',
  'Police say make everybody stay indoors after 11. Some people say na the police dem dey fear.',
];
const BOY = [
  'The boy in black again! Market women for Adelabu say he return their money. Who is he?',
  'One caller say the boy in black na Surulere pikin. Another one say na spirit. Wetin you think?',
  'Police spokesman say the "boy in black" is a criminal. Traders say he\'s the only one protecting them.',
];

export function createRadio(game) {
  const { hud, audio } = game;
  const R = { pending: false, heard: 0, cd: 0 };
  const station = () => pick(STATIONS);

  // what's worth hearing right now, most important first
  function bulletin() {
    const S = game.story, L = game.life;
    const m = S.upcoming();
    if (m && !S.active && S.unlocked <= S.index && m.radio) return { text: m.radio, lead: () => S.unlockNext('on the radio') };
    const dm = S.dayAvailable?.();
    if (L.phase === 'day' && dm && !S.dayUnlocked) return { text: dm.radio, lead: () => S.unlockDay() };
    if (game.mode === 'patrol' && Math.random() < 0.7) { const e = game.patrolBoard().find(q => q.kind === 'crime' || q.kind === 'police'); if (e) return { text: `Callers from ${game.world.areaAt(e.x, e.z)}: ${e.desc} (${e.dist} m from you. Check your Patrol Board: J.)` }; }
    const side = S.side && !S.side.cleared ? S.side : null;
    if (side) return { text: `Callers dey report trouble for ${game.world.areaAt(side.victim.pos.x, side.victim.pos.z)}: Agberos dey beat ${side.victim.name}. Police never show.` };
    if (game.respect > 1500 && Math.random() < 0.35) return { text: pick(BOY) };
    return { text: pick(L.phase === 'day' ? FLAVOUR_DAY : FLAVOUR_NIGHT) };
  }
  // N: tune in
  R.listen = () => {
    if (R.cd > 0) return;
    R.cd = 1.2;
    const b = bulletin();
    hud.radio(station(), b.text);
    audio.tick?.();
    if (b.lead) b.lead();
    R.pending = !!pendingNews();
  };
  // push a line over the air without the player tuning in (dispatch-style: trouble right now)
  R.say = (text) => hud.radio(station(), text);
  const pendingNews = () => {
    const S = game.story, m = S.upcoming();
    if (m && !S.active && S.unlocked <= S.index && m.radio) return true;
    return game.life.phase === 'day' && S.dayAvailable?.() && !S.dayUnlocked;
  };
  let pingT = 0;
  R.update = (dt) => {
    R.cd -= dt; pingT -= dt;
    const p = !!pendingNews();
    if (p && !R.pending && pingT <= 0) { pingT = 20; hud.notice('RADIO', 'Breaking news on the radio. Press N to listen.', 'blue'); }
    R.pending = p;
  };
  return R;
}
