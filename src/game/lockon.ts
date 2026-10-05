// Lock-on: pick one thing and stay on it. Never required.
//   Tab (R3 on a pad, a tap on the screen on a phone): lock the thing he's looking at; again for the next one
//   Hold Tab (tap empty space on a phone): let go
// Locked on someone, the camera keeps them in frame and his strikes and pounces go to them, even in a crowd.
// Locked on a place (a rooftop, a ledge, the roof of a car), a jump is a leap that lands on it, if it's in reach.
import * as THREE from 'three';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _v = new THREE.Vector3();
const _s: any[] = [], _o: any[] = [];
const G = 24; // the player's gravity (player.ts)

export function createLockOn(game) {
  const { player, world, camera } = game, col = world.collision;
  const L: any = { target: null, holdT: 0, toldT: -99 };
  const P = () => player.pos;

  // where a candidate is right now (people move, cars move, roofs don't)
  const posOf = (c) => c.ref ? { x: c.ref.pos.x, y: c.kind === 'place' ? c.ref.pos.y + (c.ref.spec?.h || 1.5) : c.ref.pos.y, z: c.ref.pos.z } : c.at;
  const aliveOf = (c) => !c.ref || (c.ref.alive !== false && !c.ref.removed && !c.ref.gone && !c.ref.hidden);

  // everything worth locking onto around him
  function candidates() {
    const out: any[] = [], p = P();
    for (const t of game.thugs) if (t.alive && !t.hidden) out.push({ kind: 'foe', ref: t, name: t.variant === 'general' ? 'THE GENERAL' : t.gboy ? 'BOY IN BLACK' : 'RED CAP', engaged: t.engaged });
    for (const g of game.gunmen) if (g.alive) { const cop = g.role === 'police'; out.push({ kind: cop && game.heat <= 0 ? 'person' : 'foe', ref: g, name: g.soldier ? 'SOLDIER' : cop ? 'POLICE' : g.gboy ? 'BOY IN BLACK' : 'GUNMAN' }); }
    for (const c of game.civilians) if (!c.gone) out.push({ kind: 'person', ref: c, name: (c.name || 'SOMEONE').toUpperCase() });
    for (const v of game.traffic?.vehicles || []) if (v.spec?.platform && Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 26) out.push({ kind: 'place', ref: v, name: `${v.spec.label.toUpperCase()} ROOF` });
    // rooftops and ledges: the near edge of every flat top in reach he could stand on
    for (const s of col.solids.query(p.x - 22, p.z - 22, p.x + 22, p.z + 22, _s)) {
      const w = s.maxx - s.minx, d = s.maxz - s.minz;
      if (w < 1.2 || d < 1.2 || s.maxy < 1.2 || s.maxy - p.y > 9 || s.maxy - p.y < -12) continue;
      const x = Math.min(Math.max(p.x, s.minx + 0.7), s.maxx - 0.7), z = Math.min(Math.max(p.z, s.minz + 0.7), s.maxz - 0.7);
      if (Math.abs(p.y - s.maxy) < 0.4 && p.x > s.minx && p.x < s.maxx && p.z > s.minz && p.z < s.maxz) continue; // he's standing on it
      if (col.solids.query(x - 0.4, z - 0.4, x + 0.4, z + 0.4, _o).some(o => o !== s && o.maxy > s.maxy + 0.3 && o.miny < s.maxy + 1.9)) continue; // a taller block stands on this spot: no room
      out.push({ kind: 'place', at: { x, y: s.maxy, z }, name: s.maxy - p.y > 2 ? 'ROOFTOP' : s.maxy - p.y < -2 ? 'DROP' : 'LEDGE', key: s });
    }
    return out;
  }
  // how good a pick it is, looking where the camera looks: lower is better
  function score(c) {
    const p = P(), q = posOf(c), dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    const range = c.kind === 'foe' ? 30 : c.kind === 'person' ? 22 : 20;
    if (d > range || d < (c.kind === 'place' ? 1.5 : 0.8)) return Infinity;
    const ang = Math.abs(wrap(Math.atan2(dx, dz) - camera.yaw));
    if (ang > 1.05) return Infinity;
    if (c.kind === 'place' && col.blocked(p.x, p.y + 1.6, p.z, q.x, q.y + 0.4, q.z, 0.8)) return Infinity;
    return ang * 9 + d * 0.22 + (c.kind === 'foe' ? (c.engaged ? -4 : -1) : c.kind === 'person' ? 1.5 : leapTo(q) ? 2.5 : 25); // places he can't reach still lock, but last
  }
  const same = (a, b) => a && b && (a.ref ? a.ref === b.ref : a.key === b.key);

  function lock(c) {
    L.target = c;
    if (game.time - L.toldT > 120) { L.toldT = game.time; game.hud.toast(game.input?.touch?.state.active ? '<b>Locked on.</b> Tap someone else to switch, tap empty space to let go.' : '<b>Locked on.</b> <span class="key">TAB</span> next target · hold <span class="key">TAB</span> to let go. Locked on a roof or ledge, <span class="key">SPACE</span> leaps to it.', 'blue'); }
  }
  L.release = () => { L.target = null; };
  // Tab: lock what he's looking at, or step to the next one of the same kind, left to right
  L.next = () => {
    const all = candidates().map(c => ({ c, s: score(c) })).filter(o => o.s < Infinity);
    if (!all.length) { L.release(); return; }
    if (!L.target) { all.sort((a, b) => a.s - b.s); lock(all[0].c); return; }
    const p = P(), kind = L.target.kind, pool = all.filter(o => o.c.kind === kind || (kind === 'person' && o.c.kind === 'foe') || (kind === 'foe' && o.c.kind === 'person'));
    const list = (pool.length ? pool : all).map(o => { const q = posOf(o.c); return { c: o.c, a: wrap(Math.atan2(q.x - p.x, q.z - p.z) - camera.yaw) }; }).sort((a, b) => b.a - a.a);
    const i = list.findIndex(o => same(o.c, L.target));
    lock(list[(i + 1) % list.length].c);
  };
  // a tap on the screen (phones): lock whatever is under the finger, or let go
  L.tapAt = (sx, sy) => {
    const cam = camera.cam, W = innerWidth, H = innerHeight;
    let best = null, bd = 70;
    for (const c of candidates()) {
      const q = posOf(c); _v.set(q.x, q.y + (c.kind === 'place' ? 0.2 : 1.1), q.z).project(cam);
      if (_v.z > 1) continue;
      const d = Math.hypot((_v.x * 0.5 + 0.5) * W - sx, (-_v.y * 0.5 + 0.5) * H - sy);
      if (d < bd && Math.hypot(q.x - P().x, q.z - P().z) < 30) { bd = d; best = c; }
    }
    if (!best || same(best, L.target)) L.release(); else lock(best);
  };

  // a leap that lands on the locked place: up and over, or down onto it
  L.leapVel = () => { const c = L.target; return c && c.kind === 'place' ? leapTo(posOf(c)) : null; };
  function leapTo(q) {
    const p = P(), dy = q.y - p.y, dist = Math.hypot(q.x - p.x, q.z - p.z);
    const h = Math.max(dy, 0) + 1.2 + dist * 0.05, vy = Math.sqrt(2 * G * h);
    if (dy > 6.5 * (player.skills?.leap2 ? 1.15 : 1)) return null; // too high to reach
    const t = vy / G + Math.sqrt(2 * Math.max(0.05, h - dy) / G), v = dist / t;
    if (v > 16) return null; // too far
    return { x: (q.x - p.x) / t, y: vy, z: (q.z - p.z) / t, t };
  }

  L.update = (dt, input) => {
    // a tap (even one that starts and ends in the same frame) locks / switches; holding lets go
    if (input.pressed.lock) { L.down = true; L.holdT = 0; }
    if (L.down) {
      if (input.held.lock) { L.holdT += dt; if (L.holdT > 0.45) { L.down = false; if (L.target) { L.release(); game.hud.popup('LOCK OFF'); } } }
      else { L.down = false; L.next(); }
    }
    if (input.pressed.lockTap) L.tapAt(input.pressed.lockTap.x, input.pressed.lockTap.y);
    const c = L.target;
    if (c) { // gone, down or out of reach: in a fight, slide on to the next one; otherwise let go
      const q = posOf(c), d = Math.hypot(q.x - P().x, q.z - P().z);
      if (!aliveOf(c) || d > 40 || (c.ref?.grounded && c.ref.state === 'ko')) {
        const next = c.kind === 'foe' ? candidates().filter(o => o.kind === 'foe' && o.engaged).map(o => ({ o, d: Math.hypot(posOf(o).x - P().x, posOf(o).z - P().z) })).sort((a, b) => a.d - b.d)[0] : null;
        L.target = next && next.d < 20 ? next.o : null;
      }
    }
    player.lockLeap = L.leapVel(); // the jump reads this
    camera.lockOn = L.target ? posOf(L.target) : null;
  };
  L.debug = () => candidates().map(c => { const p = P(), q = posOf(c); return { kind: c.kind, name: c.name, y: +q.y.toFixed(2), s: +score(c).toFixed(2), ang: +Math.abs(wrap(Math.atan2(q.x - p.x, q.z - p.z) - camera.yaw)).toFixed(2), d: +Math.hypot(q.x - p.x, q.z - p.z).toFixed(1), los: !col.blocked(p.x, p.y + 1.6, p.z, q.x, q.y + 0.4, q.z, 0.8) }; }); // for tests
  // the foe he's locked on, for combat
  L.foe = () => L.target && L.target.kind !== 'place' && aliveOf(L.target) ? L.target.ref : null;
  // the reticle
  L.marker = (M) => {
    const c = L.target; if (!c) return;
    const q = posOf(c), d = Math.hypot(q.x - P().x, q.z - P().z);
    const place = c.kind === 'place', reach = place ? !!player.lockLeap : true;
    M.push({ x: q.x, y: q.y + (place ? 0.15 : 2.15), z: q.z, kind: `lock ${c.kind}${reach ? '' : ' far'}`, label: `${c.name} · ${Math.round(d)}m${place ? (reach ? ' · JUMP TO LEAP' : ' · OUT OF REACH') : ''}`, edge: true });
  };
  return L;
}
