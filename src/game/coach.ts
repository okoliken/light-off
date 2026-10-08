// Coach Ayo: an old gymnast who taught Lagos street kids acrobatics on the empty track at the National
// Stadium. Bolaji was one of them. He's still there most days, and for a fee (and an hour of sweat)
// he'll teach or sharpen a move. Nothing deep: a light way to grow Street Cat.
import { Civilian } from './npcs.ts';

export const LESSONS = [
  { id: 'wire', name: 'Wire riding', desc: 'Throw your belt over a NEPA line and slide pole to pole. From a roof or a jump, press E near the wire.', price: 1500 },
  { id: 'roll', name: 'Breakfall', desc: 'Land from any height without getting hurt.', price: 2000 },
  { id: 'wallrun2', name: 'Long wall-run', desc: 'Run along walls almost twice as far.', price: 2500 },
  { id: 'smoke2', name: 'Vanishing', desc: 'Your ash cloud lasts twice as long. Police lose you more easily.', price: 2500 },
  { id: 'leap2', name: 'Big cat leap', desc: 'Your charged leap goes higher and farther.', price: 3000 },
];
const LINES = ['Ehen! Look who remember the stadium. Oya, warm up.', 'You still dey land like bag of cement? Again!', 'Shoulder first, then roll. Again!', 'Better. Your mama for proud of this one.'];

export function createCoach(game) {
  const { world, hud, player, scene } = game;
  const L = game.life, g = world.stadiumGate;
  const spot = { x: g.x + 6, z: g.z + 4 };
  const ayo = new Civilian(scene, world, { x: spot.x, z: spot.z, yaw: Math.PI, outfit: { skin: '#3e2418', top: '#1b5e20', bottom: '#1b5e20', sock: '#fafafa', sole: '#fafafa', cap: '#fafafa', sheen: '#556070' } });
  ayo.name = 'Coach Ayo'; ayo.mood = 'idle'; game.civilians.push(ayo);
  const Co: any = { spot };
  const skills = () => (L.items.skills ||= []);
  Co.apply = () => { player.skills = Object.fromEntries(skills().map(s => [s, true])); };
  Co.open = () => L.phase === 'day' && L.clock >= 6 * 60 && L.clock < 19 * 60;
  Co.option = () => {
    if (Math.hypot(player.pos.x - spot.x, player.pos.z - spot.z) > 3) return null;
    if (!Co.open()) return { kind: 'none', text: 'Coach Ayo trains people from 6 AM to 7 PM.' };
    return { kind: 'coach', text: '<span class="key">F</span>Train with Coach Ayo' };
  };
  Co.shop = () => ({ name: 'Coach Ayo · National Stadium', list: () => LESSONS.map(l => ({ ...l, owned: skills().includes(l.id), desc: l.desc + ' (1 hour)' })), buy: (id) => {
    const l = LESSONS.find(q => q.id === id); if (!l || skills().includes(id)) return 'owned';
    if (L.wallet < l.price) return 'broke';
    L.wallet -= l.price; skills().push(id); Co.apply(); L.clock += 60; L.energy = Math.max(0, L.energy - 25);
    hud.say('Coach Ayo', LINES[Math.floor(Math.random() * LINES.length)], 3.5);
    hud.banner('NEW MOVE', `${l.name}: ${l.desc}`, 'green', 4.5); game.save(); return 'ok';
  } });
  Co.place = () => ({ name: 'Coach Ayo (National Stadium)', x: spot.x, z: spot.z, kind: 'place' });
  return Co;
}
