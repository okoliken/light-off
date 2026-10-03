// HUD: status (health, heat, naira returned), objective, heading-up minimap, mode + meters,
// context prompts, subtitles, toasts, banners, on-screen markers, and the title / pause / end screens.
import * as THREE from 'three';
import { N, HALF, CELL, ROAD, CAMPUS, I0, I1, roadLine } from '../world/layout.ts';
import { buildStyledMap } from './mapstyle.ts';

const MODE_NAMES = { foot: 'On foot', board: 'Skating', grind: 'Grinding', skitch: 'Skitching', climb: 'Climbing', wallrun: 'Wall-run', roll: 'Roll', bail: 'Bail!', down: 'Down', act: 'Fighting', bike: 'Okada', ride: 'Riding' };

const FILLER = [
  'Residents say the situation has gone on for too long. "We are tired," said one trader who asked not to be named.',
  'Commuters told our correspondent they now leave home before 5 AM to beat the traffic.',
  'Officials promised action "very soon," but did not say when.',
  'A market leader described the development as "wickedness upon wickedness."',
  'Analysts expect the trend to continue into next month.',
  'Nobody could be reached for comment at the time of going to press.',
];
const CONTROLS: any[] = [
  ['Move', 'W A S D  /  Left stick'], ['Camera', 'Mouse  /  Right stick'],
  ['Jump (hold to charge a cat leap, up to ~5 m) · Climb at a wall', 'Space  /  A'], ['Flip (in the air)', 'Space again  /  A'],
  ['Sprint · Push harder', 'Shift  /  RT'], ['Unclip board / strap it on', 'R  /  Y'],
  ['Skitch: grab a vehicle / let go', 'E  /  RB'], ['Strike (toward where you push) · Interact', 'F or Left click  /  X'],
  ['Counter when "!" flashes · Dodge', 'C  /  B'], ['Launch kick (then F to juggle)', 'G  /  D-pad up'],
  ['Pounce onto an enemy · Cat leap', 'V  /  D-pad down'], ['Pick up · Throw (junk, or your board)', 'T  /  D-pad left'],
  ['Aim a throw · Throw', 'Right mouse · Left click  /  LT · RT'],
  ['Pocket radio: news, leads, trouble nearby', 'N  /  D-pad right'], ['Board trick (in the air)', 'F  /  X'], ['Big map · Pause', 'M · Esc'],
];

export function createHUD(root, world) {
  root.innerHTML = `
    <div class="status">
      <div class="brand">LIGHT-OFF<small>SURULERE · NIGHT 1</small></div>
      <div class="health"><div class="hbar"><i class="cap"></i><b></b></div><span class="hv">100</span></div>
      <div class="heat"><span class="lbl">HEAT</span><i class="star"></i><i class="star"></i><i class="star"></i></div>
      <div class="naira">₦0<span>RETURNED</span></div>
      <div class="wanted"><span class="lbl">RED CAPS</span><i></i><i></i><i></i></div>
      <div class="respect"><span class="lbl">REP</span> <b class="rv">0</b></div>
      <div class="needs">
        <div><span class="lbl">HUNGER</span><div class="meter hunger"><b></b></div></div>
        <div><span class="lbl">ENERGY</span><div class="meter energy"><b></b></div></div>
      </div>
    </div>
    <div class="clock"><b class="ct">10:30 PM</b><span class="cn">NIGHT 1</span><span class="cw">₦3,000</span></div>
    <div class="followed hidden">BEING FOLLOWED</div>
    <div class="eyes hidden"><div class="meterlbl">EYES ON YOU · PEOPLE CAN SEE YOUR FACE</div><div class="meter"><b></b></div></div>
    <div class="radiobox hidden"><div class="st"></div><div class="tx"></div></div>
    <div class="radiolight hidden">RADIO · NEWS <i>N</i></div>
    <div class="roommeters hidden"><div><span class="lbl">NOISE</span><div class="meter noise"><b></b></div></div><div><span class="lbl">MAMA'S SUSPICION</span><div class="meter susp"><b></b></div></div></div>
    <div class="combo hidden"><b></b><span>COMBO</span></div>
    <div class="areaname"></div>
    <div class="crosshair hidden"><i></i></div>
    <div class="popups"></div>
    <div class="notices"></div>
    <div class="objective hidden"></div>
    <div class="tracker hidden"></div>
    <div class="cine hidden"><div class="cbar top"><div class="ctitle"></div></div><div class="cbar bot"><div class="csub"><b class="cwho"></b><span class="ctext"></span></div><div class="chint">SPACE · NEXT &nbsp;&nbsp; P · SKIP</div><i class="cprog"></i></div><div class="cfade"></div></div>
    <div class="minimap"><canvas width="400" height="400"></canvas></div>
    <div class="power">GRID: ON</div>
    <div class="modebox">
      <div class="gadgets"><span>POUNCE <i>V</i></span><span class="g-throw">THROW <b class="held"></b> <i>T</i></span><span>COUNTER <i>C</i></span><span class="g-launch">LAUNCH <i>G</i></span></div>
      <div class="chargewrap hidden"><div class="meterlbl">CAT LEAP · RELEASE SPACE</div><div class="meter charge"><b></b></div></div>
      <div class="mode">On foot</div>
      <div class="gripwrap hidden"><div class="meterlbl">GRIP</div><div class="meter grip"><b></b></div></div>
      <div><div class="meterlbl">STREET SENSE</div><div class="meter sense"><b></b></div></div>
    </div>
    <div class="catch hidden"><div class="meterlbl">OFFICER GRABBING YOU — MOVE!</div><div class="meter"><b></b></div></div>
    <div class="prompt hidden"></div>
    <div class="say hidden"></div>
    <div class="toasts"></div>
    <div class="markers"></div>
    <div class="help"><button data-hb="pause">❚❚ Pause <kbd>Esc</kbd></button><button data-hb="controls">Controls <kbd>H</kbd></button><button data-hb="map">Map <kbd>M</kbd></button></div>
    <div class="aimdot"></div>
    <div class="bannerwrap"></div>
    <div class="overlays"></div>`;
  const $ = s => root.querySelector(s);
  const el = {
    hbar: $('.health .hbar b'), hcap: $('.health .hbar .cap'), hv: $('.health .hv'), held: $('.gadgets .held'), gThrow: $('.gadgets .g-throw'), gLaunch: $('.gadgets .g-launch'),
    roomM: $('.roommeters'), noise: $('.meter.noise b'), susp: $('.meter.susp b'), stars: [...root.querySelectorAll('.heat .star')], naira: $('.naira'), objective: $('.objective'), map: $('.minimap canvas'),
    mapWrap: $('.minimap'), power: $('.power'), mode: $('.mode'), grip: $('.gripwrap'), gripB: $('.meter.grip b'), sense: $('.meter.sense b'),
    catchW: $('.catch'), catchB: $('.catch .meter b'), prompt: $('.prompt'), say: $('.say'), toasts: $('.toasts'), markers: $('.markers'),
    banner: $('.bannerwrap'), overlays: $('.overlays'), help: $('.help'),
    chargeW: $('.chargewrap'), chargeB: $('.meter.charge b'),
    brandSub: $('.brand small'),
    rv: $('.respect .rv'), cross: $('.crosshair'), popups: $('.popups'),
    wanted: [...root.querySelectorAll('.wanted i')], hunger: $('.meter.hunger b'), energy: $('.meter.energy b'), ct: $('.clock .ct'), cn: $('.clock .cn'), cw: $('.clock .cw'),
    followed: $('.followed'), eyes: $('.eyes'), eyesB: $('.eyes .meter b'), radio: $('.radiobox'), radioSt: $('.radiobox .st'), radioTx: $('.radiobox .tx'), radioLight: $('.radiolight'), tracker: $('.tracker'), cine: $('.cine'), cTitle: $('.cine .ctitle'), cWho: $('.cine .cwho'), cText: $('.cine .ctext'), cProg: $('.cine .cprog'), cFade: $('.cine .cfade'), combo: $('.combo'), comboB: $('.combo b'), area: $('.areaname'),
  };


  // ---- pre-rendered map (1 px = 1 m): the district, the bridge, UNILAG ----
  const EXT = -roadLine(I0) + CELL * 1.2, NZ = -CAMPUS.z0 + 20, W0 = Math.ceil(EXT + roadLine(I1) + CELL * 1.2), H0 = Math.ceil(NZ + 460); // Mushin to Yaba, Lagos Island to the stadium
  const mapC = document.createElement('canvas'); mapC.width = W0; mapC.height = H0;
  const MX = x => x + EXT, MZ = z => z + NZ; // world -> map pixels
  {
    const x = mapC.getContext('2d');
    x.fillStyle = '#0d1a2a'; x.fillRect(0, 0, W0, H0); // lagoon
    x.fillStyle = '#1a1c22'; x.fillRect(0, MZ(-HALF - CELL - 4), W0, H0);
    for (const b of world.blocks) {
      x.fillStyle = b.type === 'market' || b.type === 'tejuosho' ? '#5a4a2a' : b.type === 'ladipo' ? '#3e3530' : b.type === 'hospital' ? '#46505c' : b.type === 'motorpark' ? '#4a3a2a' : b.type === 'pitch' ? '#3d5a2e' : b.type === 'ring' ? '#1f2128' : b.bi >= N ? '#2e3140' : b.bi < 0 ? '#302b28' : '#2b2e38';
      x.fillRect(MX(b.x0), MZ(b.z0), b.x1 - b.x0, b.z1 - b.z0);
    }
    x.fillStyle = '#5d6170';
    for (let i = I0; i <= I1; i++) { const c = roadLine(i); x.fillRect(MX(c - ROAD / 2), MZ(-HALF - ROAD / 2), ROAD, N * CELL + ROAD); }
    for (let j = 0; j <= N; j++) { const c = roadLine(j); x.fillRect(MX(roadLine(I0) - ROAD / 2), MZ(c - ROAD / 2), roadLine(I1) - roadLine(I0) + ROAD, ROAD); }
    for (const r of world.mapRects || []) { x.fillStyle = r.color; x.fillRect(MX(r.x0), MZ(r.z0), r.x1 - r.x0, r.z1 - r.z0); }
    x.fillStyle = '#f2b705';
    for (const t of world.transformers) x.fillRect(MX(t.x) - 2, MZ(t.z) - 2, 4, 4);
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = 'bold 16px Inter, sans-serif'; x.textAlign = 'center';
    x.fillText('THIRD MAINLAND BRIDGE', MX(60), MZ(-700)); x.fillText('NATIONAL STADIUM', MX(170), MZ(420)); x.fillText('LAGOS ISLAND', MX(0), MZ(-1360)); x.fillText('MAKOKO', MX(-95), MZ(-560)); x.fillText('UNILAG · AKOKA', MX(420), MZ(-380)); x.fillText('YABA', MX(400), MZ(-20)); x.fillText('MUSHIN', MX(-450), MZ(40)); x.fillText('IDI-ARABA', MX(-300), MZ(-130)); x.fillText('LAGOS LAGOON', MX(190), MZ(-640));
  }
  const mctx = el.map.getContext('2d');
  let styled: HTMLCanvasElement = null; // the big map's artwork, drawn the first time it opens

  const H: any = {};
  // controller glyphs: when a pad is in use, keyboard keys in prompts become that pad's buttons
  let padType = null;
  const PAD = {
    xbox: { F: 'X', C: 'B', SPACE: 'A', R: 'Y', E: 'RB', G: 'D-PAD ↑', V: 'D-PAD ↓', T: 'D-PAD ←', N: 'D-PAD →', Q: 'LB', M: 'VIEW', J: 'MENU', P: 'MENU', SHIFT: 'RT' },
    touch: { F: 'HIT/USE', C: 'DODGE', SPACE: 'JUMP', R: 'BOARD', E: 'GRAB', G: 'LAUNCH', V: 'POUNCE', T: 'THROW', N: 'RADIO', Q: 'SENSE', M: 'MAP', J: '❚❚', P: '❚❚', ESC: '❚❚', SHIFT: 'STICK ALL THE WAY', U: 'SUIT', L: 'TORCH', X: 'BELLY', H: '❚❚' },
    ps: { F: '□', C: '○', SPACE: '✕', R: '△', E: 'R1', G: 'D-PAD ↑', V: 'D-PAD ↓', T: 'D-PAD ←', N: 'D-PAD →', Q: 'L1', M: 'SHARE', J: 'OPTIONS', P: 'OPTIONS', SHIFT: 'R2' },
  };
  const glyph = (html) => {
    if (!padType || !html) return html;
    const m = PAD[padType];
    return html.replace(/(<span class="key">)([^<]+)(<\/span>)/g, (all, a, k, b) => a + (m[k.trim().toUpperCase()] || k) + b)
      .replace(/\((F|C|G|V|T|E|Q|N|J|R|SHIFT|U|L|X|M)\)/g, (all, k) => `(${m[k] || k})`);
  };
  H.setPad = (t) => { padType = t; };
  let toastN = 0, sayT = 0, bannerT = 0, bigMap = false;

  H.toast = (text, kind = '') => {
    const d = document.createElement('div'); d.className = 'toast ' + kind; d.innerHTML = glyph(text); el.toasts.appendChild(d);
    const id = ++toastN; void id;
    setTimeout(() => d.remove(), 4800);
    while (el.toasts.children.length > 5) el.toasts.firstChild.remove();
  };
  H.banner = (title, sub = '', kind = '', dur = 2.6) => {
    el.banner.innerHTML = `<div class="banner ${kind}"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>`;
    bannerT = dur;
  };
  H.say = (who, text, dur = 2.8) => { el.say.innerHTML = who ? `<b>${who}:</b> ${text}` : text; el.say.classList.remove('hidden'); sayT = dur; };
  H.notice = (title, text = '', kind = '') => {
    const box = root.querySelector('.notices'); if (!box) return;
    const d = document.createElement('div'); d.className = 'notice ' + kind; d.innerHTML = glyph(`<b>${title}</b>${text ? ' · ' + text : ''}`); box.appendChild(d);
    setTimeout(() => d.classList.add('out'), 3200); setTimeout(() => d.remove(), 3800);
    while (box.children.length > 2) box.firstChild.remove();
  };
  H.popup = (html) => {
    const d = document.createElement('div'); d.className = 'popup'; d.innerHTML = html; el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1500);
    while (el.popups.children.length > 3) el.popups.firstChild.remove();
  };
  // mission tracker: the mission name and a checklist of its steps (right side, under the clock)
  let trackerHTML = '';
  H.tracker = (info) => {
    const html = info ? `<div class="tt">${info.title}</div>${info.sub ? `<div class="ts">${info.sub}</div>` : ''}<ul>${info.steps.map(st => `<li class="${st.state}">${st.label}</li>`).join('')}</ul>` : '';
    if (html === trackerHTML) return;
    trackerHTML = html; el.tracker.innerHTML = html; el.tracker.classList.toggle('hidden', !info);
  };
  // cutscenes: letterbox bars slide in, subtitles type themselves (driven by game/cinema.js)
  let cineWho = null;
  H.cine = {
    open(title) { H.setHudVisible(false); el.cine.classList.remove('hidden', 'closing'); void el.cine.offsetWidth; el.cine.classList.add('on'); el.cTitle.textContent = title || ''; el.cFade.style.opacity = 1; cineWho = null; },
    line(who, text, done, prog, titleAlpha) {
      if (who !== cineWho) { cineWho = who; el.cWho.textContent = who || ''; el.cWho.style.display = who ? '' : 'none'; }
      el.cText.textContent = text; el.cText.classList.toggle('narr', !who); el.cText.classList.toggle('typing', !done);
      el.cProg.style.transform = `scaleX(${prog})`; el.cTitle.style.opacity = titleAlpha;
    },
    fade(a) { el.cFade.style.opacity = a; },
    close() {
      el.cine.classList.remove('on'); el.cine.classList.add('closing'); el.cWho.textContent = ''; el.cText.textContent = '';
      H.setHudVisible(true);
      setTimeout(() => { if (el.cine.classList.contains('closing')) { el.cine.classList.add('hidden'); el.cine.classList.remove('closing'); } }, 700);
    },
  };
  // the pocket radio: a station name and the bulletin, typed out
  let radioT = 0, radioFull = '', radioShown = 0;
  H.radio = (station, text) => { el.radio.classList.remove('hidden'); el.radioSt.textContent = 'RADIO · ' + station; radioFull = text; radioShown = 0; el.radioTx.textContent = ''; radioT = 5 + text.length * 0.045; };
  let areaT = 0;
  H.area = (name) => { el.area.textContent = name; el.area.classList.add('show'); areaT = 2.6; };
  H.objective = (html) => { el.objective.innerHTML = glyph(html) || ''; el.objective.classList.toggle('hidden', !html); };

  // ---- markers ----
  const markerPool: any[] = [];
  const _v = new THREE.Vector3();
  function drawMarkers(list, cam, w, h) {
    while (markerPool.length < list.length) { const d = document.createElement('div'); d.className = 'marker'; d.innerHTML = '<div class="pin"></div><div class="t"></div>'; el.markers.appendChild(d); markerPool.push(d); }
    cam.updateMatrixWorld();
    const L = 70, Rr = w - 70, T = 140, B = h - 150, cx = w / 2, cy = h / 2;
    const used: any[] = [];
    markerPool.forEach((d, i) => {
      const m = list[i];
      if (!m) { d.style.display = 'none'; return; }
      _v.set(m.x, m.y, m.z).applyMatrix4(cam.matrixWorldInverse); // camera space: -z is forward
      const inFront = _v.z < -0.5;
      let sx, sy, edge = false;
      if (inFront) { _v.set(m.x, m.y, m.z).project(cam); sx = (_v.x * 0.5 + 0.5) * w; sy = (-_v.y * 0.5 + 0.5) * h; }
      if (!inFront || sx < L || sx > Rr || sy < T || sy > B) {
        if (m.edge === false) { d.style.display = 'none'; return; }
        // push to the screen edge along the direction of the target
        _v.set(m.x, m.y, m.z).applyMatrix4(cam.matrixWorldInverse);
        let dx = _v.x, dy = -_v.y; if (!inFront) { dy = Math.abs(dy) + Math.abs(dx) * 0.2 + 1; }
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const k = Math.min(dx ? ((dx > 0 ? Rr : L) - cx) / dx : Infinity, dy ? ((dy > 0 ? B : T) - cy) / dy : Infinity);
        sx = cx + dx * k; sy = cy + dy * k; edge = true;
        if (sx > w - 250 && sy < 260) sy = 260;
        if (sx < 280 && sy > h - 170) sx = 280;
      }
      // keep labels from piling up
      let label = m.label || '';
      if (edge) { const dm = label.match(/\d+m/); label = dm ? dm[0] : ''; }
      for (const [ux, uy] of used) if (Math.abs(ux - sx) < 70 && Math.abs(uy - sy) < 26) { label = ''; break; }
      used.push([sx, sy]);
      d.style.display = '';
      d.className = 'marker ' + m.kind + (edge ? ' edge' : '');
      d.style.left = sx + 'px'; d.style.top = sy + 'px';
      d.querySelector('.t').textContent = label;
    });
  }

  // ---- minimap ----
  function drawMap(game) {
    const W = el.map.width, c = mctx, p = game.player.pos;
    const scale = bigMap ? 0.55 : 1.9, yaw = game.camera.yaw;
    c.save();
    c.fillStyle = '#0b0d12'; c.fillRect(0, 0, W, W);
    c.translate(W / 2, W / 2);
    if (!bigMap) c.rotate(yaw - Math.PI);
    c.scale(scale, scale);
    c.translate(-p.x - EXT, -p.z - NZ);
    c.drawImage(mapC, 0, 0);
    c.translate(EXT, NZ);
    const dot = (x, z, r, col, stroke?: string) => { c.beginPath(); c.arc(x, z, r / scale, 0, 7); c.fillStyle = col; c.fill(); if (stroke) { c.lineWidth = 1.5 / scale; c.strokeStyle = stroke; c.stroke(); } };
    // police vision in street sense
    for (const v of game.traffic.vehicles) {
      if (v.kind !== 'police') continue;
      if (game.sense) { c.beginPath(); c.arc(v.pos.x, v.pos.z, game.policeRange, 0, 7); c.fillStyle = 'rgba(229,57,53,0.12)'; c.fill(); }
      const blink = v.police.siren && Math.floor(game.time * 6) % 2;
      dot(v.pos.x, v.pos.z, 5, blink ? '#3d7bff' : '#e53935', '#fff');
    }
    if (game.sense) for (const a of game.thugs) if (a.alive) dot(a.pos.x, a.pos.z, 3.5, '#ff9800');
    // GPS route
    if (game.nav && game.navRoute?.length) {
      c.beginPath(); c.moveTo(p.x, p.z);
      for (const [x, z] of game.navRoute) c.lineTo(x, z);
      c.strokeStyle = '#' + new THREE.Color(game.nav.color).getHexString(); c.lineWidth = 4 / scale; c.lineJoin = 'round'; c.globalAlpha = 0.9; c.stroke(); c.globalAlpha = 1;
    }
    const lim = (W / 2) / scale - 7 / scale;
    for (const m of game.mapMarkers) {
      let mx = m.x, mz = m.z;
      { const dx = mx - p.x, dz = mz - p.z, d = Math.hypot(dx, dz); if (d > lim) { mx = p.x + dx / d * lim; mz = p.z + dz / d * lim; } }
      dot(mx, mz, 6, m.color, '#fff');
    }
    c.restore();
    // player arrow (always centre, pointing up in heading-up mode)
    c.save(); c.translate(W / 2, W / 2);
    if (bigMap) c.rotate(-(game.player.yaw) + Math.PI);
    else c.rotate(-(game.player.mode === 'board' || game.player.mode === 'grind' || game.player.mode === 'skitch' ? game.player.heading : game.player.yaw) + yaw);
    c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath();
    c.fillStyle = '#f2b705'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#000'; c.stroke();
    c.restore();
  }

  // ---- the big map (M): pan, zoom, legend, click to set a waypoint ----
  H.openMap = (game, onClose) => {
    const wrap = document.createElement('div'); wrap.className = 'bigmap overlay';
    wrap.innerHTML = `<canvas></canvas><button class="bm-close" data-close>✕ CLOSE</button><div class="bm-head"><span>LIGHT-OFF · CITY MAP</span><b>LAGOS</b><em>${game.areaName || 'Surulere'} · ${game.life.timeStr()}</em></div>
      <div class="bm-legend"><div><i style="background:#ffd54f"></i>You</div><div><i style="background:#4fc3f7"></i>Places</div><div><i style="background:#fbc02d"></i>Bus stops</div><div><i style="background:#ce93d8"></i>Shops</div><div><i style="background:#ff4d4d"></i>Police</div><div><i style="background:#ff3d3d;box-shadow:0 0 6px #ff3d3d"></i>Trouble</div></div>
      <div class="bm-side"><input class="bm-search" placeholder="Where to? (search places)"><div class="bm-pick"></div><div class="bm-list"></div></div>
      <div class="bm-hint">DRAG · MOVE &nbsp; SCROLL / PINCH · ZOOM &nbsp; TAP · PICK A PLACE &nbsp; M / ESC · CLOSE</div>`;
    el.overlays.appendChild(wrap);
    const cv = wrap.querySelector('canvas'), cx2 = cv.getContext('2d');
    // ---- places: search, pick one, choose how to get there ----
    const places = game.places(), P0 = game.player.pos;
    const dist = (q) => Math.round(Math.hypot(q.x - P0.x, q.z - P0.z));
    const ICON: any = { home: '🏠', place: '📍', shop: '🛍', bus: '🚌', food: '🍲', spot: '✚' };
    const mins = (s) => s < 60 ? `${s}s` : `${Math.round(s / 60)} min`;
    const listEl = wrap.querySelector('.bm-list'), pickEl = wrap.querySelector('.bm-pick'), search = wrap.querySelector<HTMLInputElement>('.bm-search');
    let picked = null;
    const renderList = () => {
      const f = search.value.trim().toLowerCase();
      const L2 = places.filter(q => !f || q.name.toLowerCase().includes(f) || (q.area || '').toLowerCase().includes(f)).sort((a, b) => dist(a) - dist(b)).slice(0, 40);
      listEl.innerHTML = L2.map((q, i) => `<button class="bm-pl" data-p="${places.indexOf(q)}"><span>${ICON[q.kind] || '📍'}</span><b>${q.name}</b><i>${q.area || ''} · ${dist(q)} m</i></button>`).join('') || '<p class="bm-none">Nothing called that around here.</p>';
      listEl.querySelectorAll<HTMLElement>('[data-p]').forEach(b => b.onclick = () => pick(places[+b.dataset.p], true));
    };
    const pick = (q, centre = false) => {
      picked = q; if (centre) { v.x = q.x; v.z = q.z; }
      const Q = game.transport.quote(q);
      const opt = (m, label, sub, ok, extra = '') => `<button class="bm-go ${ok ? '' : 'off'}" data-go="${m}" ${ok ? '' : 'disabled'}><b>${label}</b><i>${sub}</i>${extra}</button>`;
      const ride = (m, label) => Q[m].no ? opt(m, label, Q[m].no, false) : opt(m, label, `₦${Q[m].fare} · about ${mins(Q[m].secs)}${m === 'danfo' && Q.danfo.stopDist > 6 ? ` · from ${Q.danfo.stop.name} stop (${Q.danfo.stopDist} m)` : ''}`, true);
      pickEl.innerHTML = `<div class="bm-card"><div class="bm-ct"><span>${ICON[q.kind] || '📍'}</span><div><b>${q.name}</b><i>${q.area || ''} · ${Q.dist} m away</i></div><button class="bm-x" data-x>✕</button></div>
        <div class="bm-how">HOW DO YOU WANT TO GET THERE?</div>
        ${opt('skate', 'Skate / walk', `Free · about ${mins(Q.skate.secs)} on the board · follow the trail`, true)}
        ${Q.ferry ? (Q.ferry.no ? opt('ferry', 'Ferry', Q.ferry.no, false) : opt('ferry', 'Ferry across the lagoon', `₦${Q.ferry.fare} · from ${Q.ferry.jetty.name} (${Q.ferry.jettyDist} m) · skip the bridge traffic`, true)) : ''}${ride('okada', 'Okada')}${ride('keke', 'Keke')}${ride('danfo', 'Danfo')}</div>`;
      pickEl.querySelector<HTMLElement>('[data-x]').onclick = () => { picked = null; pickEl.innerHTML = ''; };
      pickEl.querySelectorAll<HTMLElement>('[data-go]').forEach(b => b.onclick = () => { const m = b.dataset.go; close(); game.travel(q, m); });
    };
    search.oninput = renderList; search.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') { search.blur(); } if (e.key === 'Enter') { const b = listEl.querySelector<HTMLElement>('[data-p]'); b?.click(); } };
    renderList();
    wrap.querySelector<HTMLElement>('[data-close]').onclick = () => close();
    const P = game.player.pos, v = { x: P.x, z: P.z, zoom: 1.4 };
    let raf = 0, drag = null, moved = false;
    const resize = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; };
    resize();
    const toWorld = (sx, sy) => ({ x: v.x + (sx * devicePixelRatio - cv.width / 2) / (v.zoom * devicePixelRatio), z: v.z + (sy * devicePixelRatio - cv.height / 2) / (v.zoom * devicePixelRatio) });
    const SS = matchMedia('(pointer: coarse)').matches ? 1.25 : 2;
    styled ||= buildStyledMap(world, { EXT, NZ, W0, H0 }, SS);
    let tz = v.zoom; v.zoom = 4.2; const t0 = performance.now(); // open with a zoom-out from Bolaji
    const PINC: any = { home: '#ffffff', place: '#4fc3f7', shop: '#ce93d8', bus: '#fbc02d', food: '#ffab40', spot: '#ffd54f' };
    const DISTRICTS: any[] = [['SURULERE', 0, 30, 1], ['AGUDA', -110, -110, 0], ['OJUELEGBA', 60, -130, 0], ['ADELABU', -110, 110, 0], ['YABA', 400, -40, 1], ['SABO', 330, -170, 0], ['TEJUOSHO', 420, 10, 0], ['UNILAG', 420, -350, 1], ['MUSHIN', -470, 40, 1], ['IDI-ARABA', -300, -150, 0], ['LADIPO', -400, 60, 0], ['NATIONAL STADIUM', 170, 250, 0], ['THIRD MAINLAND BRIDGE', 60, -700, 1], ['LAGOS ISLAND', 0, -1360, 1], ['MAKOKO', -95, -560, 0]];
    const draw = () => {
      const now = performance.now(), W = cv.width, Hh = cv.height, dpr = devicePixelRatio;
      if (now - t0 < 700) { const e = 1 - Math.pow(1 - (now - t0) / 700, 3); v.zoom = 4.2 + (tz - 4.2) * e; } else v.zoom += (tz - v.zoom) * 0.25;
      const k = v.zoom * dpr, z = v.zoom;
      cx2.setTransform(1, 0, 0, 1, 0, 0); cx2.fillStyle = '#061522'; cx2.fillRect(0, 0, W, Hh);
      cx2.setTransform(k, 0, 0, k, W / 2 - (v.x + EXT) * k, Hh / 2 - (v.z + NZ) * k);
      { const lt = -HALF - CELL - 4 + NZ; cx2.fillStyle = '#071a2c'; cx2.fillRect(-4000, -4000, 9000, lt + 4000); cx2.fillStyle = '#15171d'; cx2.fillRect(-4000, lt, 9000, 6000); } // the city carries on past the edges
      cx2.imageSmoothingEnabled = true; cx2.drawImage(styled, 0, 0, styled.width / SS, styled.height / SS);
      cx2.translate(EXT, NZ);
      const t = now / 1000;
      // live traffic: faint moving lights
      for (const q of game.traffic.vehicles) { if (q.kind === 'police') continue; cx2.fillStyle = q.type === 'danfo' ? 'rgba(255,202,40,0.75)' : 'rgba(255,255,255,0.45)'; const r = (q.type === 'danfo' ? 2.2 : 1.5) / Math.sqrt(z); cx2.fillRect(q.pos.x - r, q.pos.z - r, r * 2, r * 2); }
      // route: a glowing animated trail
      if (game.nav && game.navRoute?.length) {
        const col = '#' + new THREE.Color(game.nav.color).getHexString();
        cx2.beginPath(); cx2.moveTo(P.x, P.z); for (const [x, zz] of game.navRoute) cx2.lineTo(x, zz);
        cx2.lineJoin = 'round'; cx2.lineCap = 'round';
        cx2.strokeStyle = col + '33'; cx2.lineWidth = 12 / z; cx2.stroke();
        cx2.strokeStyle = col; cx2.lineWidth = 4 / z; cx2.stroke();
        cx2.setLineDash([6 / z, 10 / z]); cx2.lineDashOffset = -t * 40 / z; cx2.strokeStyle = 'rgba(255,255,255,0.9)'; cx2.lineWidth = 1.6 / z; cx2.stroke(); cx2.setLineDash([]);
      }
      const pin = (x, zz, col, r, label?: string, sel = false) => {
        const R = r / z;
        cx2.beginPath(); cx2.arc(x, zz, R * 1.9, 0, 7); cx2.fillStyle = col + (sel ? '55' : '22'); cx2.fill();
        cx2.beginPath(); cx2.arc(x, zz, R, 0, 7); cx2.fillStyle = col; cx2.fill(); cx2.lineWidth = 1.5 / z; cx2.strokeStyle = '#0a0c10'; cx2.stroke();
        if (label) { cx2.font = `700 ${11 / z}px Inter, sans-serif`; cx2.textAlign = 'left'; cx2.lineWidth = 3 / z; cx2.strokeStyle = 'rgba(5,8,14,0.9)'; cx2.strokeText(label, x + R * 1.8, zz + 4 / z); cx2.fillStyle = '#e8eef6'; cx2.fillText(label, x + R * 1.8, zz + 4 / z); }
      };
      for (const m of game.mapMarkers) pin(m.x, m.z, m.color, 4.5);
      if (z > 0.8) for (const q of places) if (q.kind !== 'food' || z > 2.4) pin(q.x, q.z, PINC[q.kind] || '#4fc3f7', q.kind === 'home' ? 5.5 : 3.6, z > 2.2 || q.kind === 'home' ? q.name : undefined);
      for (const q of game.traffic.vehicles) if (q.kind === 'police') { const on = q.police.siren && Math.floor(now / 160) % 2; pin(q.pos.x, q.pos.z, on ? '#3d7bff' : '#ff4d4d', 4); }
      if (game.waypoint) { const w = game.waypoint; cx2.save(); cx2.translate(w.x, w.z); cx2.rotate(Math.PI / 4); cx2.fillStyle = '#80deea'; const s2 = 7 / z; cx2.shadowColor = '#80deea'; cx2.shadowBlur = 12; cx2.fillRect(-s2, -s2, s2 * 2, s2 * 2); cx2.restore(); }
      if (picked) { const pr = (10 + Math.sin(t * 5) * 3) / z; cx2.beginPath(); cx2.arc(picked.x, picked.z, pr, 0, 7); cx2.strokeStyle = '#ffd54f'; cx2.lineWidth = 2.5 / z; cx2.stroke(); pin(picked.x, picked.z, '#ffd54f', 5, picked.name, true); }
      // district names: big, spaced, fading in as you zoom out
      cx2.textAlign = 'center';
      for (const [n, x, zz, major] of DISTRICTS) {
        const a = major ? Math.min(1, Math.max(0.25, 2.6 - z)) : Math.min(0.85, Math.max(0, (z - 0.7) * 1.2)) * Math.min(1, Math.max(0.2, 3.2 - z));
        if (a <= 0.02) continue;
        const fs = (major ? 22 : 13) / Math.pow(z, 0.75);
        cx2.font = `800 ${fs}px Inter, sans-serif`; (cx2 as any).letterSpacing = `${fs * 0.35}px`;
        cx2.fillStyle = `rgba(255,255,255,${a * (major ? 0.55 : 0.6)})`; cx2.fillText(n, x, zz);
        (cx2 as any).letterSpacing = '0px';
      }
      // Bolaji: a pulsing beacon with a view cone
      const yaw = -game.player.yaw + Math.PI, pr = (14 + (t * 18) % 16) / z;
      cx2.beginPath(); cx2.arc(P.x, P.z, pr, 0, 7); cx2.strokeStyle = `rgba(255,213,79,${0.6 * (1 - ((t * 18) % 16) / 16)})`; cx2.lineWidth = 2 / z; cx2.stroke();
      cx2.save(); cx2.translate(P.x, P.z); cx2.rotate(yaw);
      const cg = cx2.createRadialGradient(0, 0, 0, 0, 0, 46 / z); cg.addColorStop(0, 'rgba(255,213,79,0.35)'); cg.addColorStop(1, 'rgba(255,213,79,0)');
      cx2.beginPath(); cx2.moveTo(0, 0); cx2.arc(0, 0, 46 / z, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); cx2.closePath(); cx2.fillStyle = cg; cx2.fill();
      const a = 9 / z; cx2.beginPath(); cx2.moveTo(0, -a * 1.3); cx2.lineTo(a * 0.85, a); cx2.lineTo(0, a * 0.45); cx2.lineTo(-a * 0.85, a); cx2.closePath();
      cx2.shadowColor = '#ffd54f'; cx2.shadowBlur = 14; cx2.fillStyle = '#ffd54f'; cx2.fill(); cx2.shadowBlur = 0; cx2.lineWidth = 1.5 / z; cx2.strokeStyle = '#000'; cx2.stroke(); cx2.restore();
      // screen space: compass and scale bar
      cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vw = W / dpr, vh = Hh / dpr, bx = 46, by = 150;
      cx2.beginPath(); cx2.arc(bx, by, 17, 0, 7); cx2.fillStyle = 'rgba(8,10,16,0.75)'; cx2.fill(); cx2.strokeStyle = 'rgba(255,255,255,0.2)'; cx2.lineWidth = 1; cx2.stroke();
      cx2.beginPath(); cx2.moveTo(bx, by - 12); cx2.lineTo(bx + 5, by); cx2.lineTo(bx - 5, by); cx2.closePath(); cx2.fillStyle = '#ff5252'; cx2.fill();
      cx2.beginPath(); cx2.moveTo(bx, by + 12); cx2.lineTo(bx + 5, by); cx2.lineTo(bx - 5, by); cx2.closePath(); cx2.fillStyle = '#ccc'; cx2.fill();
      cx2.font = '800 9px Inter, sans-serif'; cx2.textAlign = 'center'; cx2.fillStyle = '#fff'; cx2.fillText('N', bx, by - 20);
      const m = [25, 50, 100, 200, 500, 1000].find(q => q * z > 70) || 1000, sw = m * z;
      cx2.fillStyle = 'rgba(8,10,16,0.75)'; cx2.fillRect(bx + 30, by - 6, sw + 16, 18);
      cx2.fillStyle = '#fff'; cx2.fillRect(bx + 38, by + 4, sw, 2); cx2.fillRect(bx + 38, by, 2, 6); cx2.fillRect(bx + 36 + sw, by, 2, 6);
      cx2.font = '700 9px Inter, sans-serif'; cx2.fillText(m >= 1000 ? '1 km' : m + ' m', bx + 38 + sw / 2, by - 0);
      void vw;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    cv.onmousedown = (e) => { drag = { x: e.clientX, y: e.clientY, vx: v.x, vz: v.z }; moved = false; };
    // touch: one finger pans, two fingers pinch to zoom, a tap picks a place
    let pinch = null;
    cv.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.touches;
      if (t.length === 1) { drag = { x: t[0].clientX, y: t[0].clientY, vx: v.x, vz: v.z }; moved = false; pinch = null; }
      else if (t.length === 2) { pinch = { d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), z: v.zoom }; moved = true; } }, { passive: false });
    cv.addEventListener('touchmove', (e) => { e.preventDefault(); const t = e.touches;
      if (pinch && t.length === 2) tz = v.zoom = Math.max(0.35, Math.min(6, pinch.z * Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) / pinch.d));
      else if (t.length === 1) onMove({ clientX: t[0].clientX, clientY: t[0].clientY }); }, { passive: false });
    cv.addEventListener('touchend', (e) => { if (e.touches.length) return; const c = e.changedTouches[0]; onUp({ clientX: c.clientX, clientY: c.clientY, button: 0 }); pinch = null; });
    const onMove = (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; v.x = drag.vx - dx / v.zoom; v.z = drag.vz - dy / v.zoom; };
    const onUp = (e) => { if (drag && !moved && e.button === 0) { const w = toWorld(e.clientX, e.clientY), r = 18 / v.zoom; const near = places.filter(q => Math.hypot(q.x - w.x, q.z - w.z) < r).sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z))[0]; pick(near || { name: 'This spot', x: w.x, z: w.z, kind: 'spot', area: game.world.areaAt(w.x, w.z) }); } drag = null; };
    cv.oncontextmenu = (e) => { e.preventDefault(); game.setWaypoint(null); };
    cv.onwheel = (e) => { e.preventDefault(); const before = toWorld(e.clientX, e.clientY); tz = Math.max(0.35, Math.min(6, tz * (e.deltaY < 0 ? 1.18 : 0.85))); const z0 = v.zoom; v.zoom = tz; const after = toWorld(e.clientX, e.clientY); v.zoom = z0; v.x += before.x - after.x; v.z += before.z - after.z; };
    const close = () => { cancelAnimationFrame(raf); removeEventListener('mousemove', onMove); removeEventListener('mouseup', onUp); document.removeEventListener('keydown', onKey, true); removeEventListener('resize', resize); wrap.remove(); onClose?.(); };
    const onKey = (e) => {
      if (e.target === search) return;
      const step = 40 / v.zoom;
      if (e.code === 'KeyM' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } // don't let the same key reopen it
      else if (e.code === 'KeyW' || e.code === 'ArrowUp') v.z -= step; else if (e.code === 'KeyS' || e.code === 'ArrowDown') v.z += step;
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') v.x -= step; else if (e.code === 'KeyD' || e.code === 'ArrowRight') v.x += step;
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') tz = Math.min(6, tz * 1.25); else if (e.code === 'Minus' || e.code === 'NumpadSubtract') tz = Math.max(0.35, tz / 1.25);
      else if (e.code === 'KeyC') { v.x = P.x; v.z = P.z; }
    };
    addEventListener('mousemove', onMove); addEventListener('mouseup', onUp); document.addEventListener('keydown', onKey, true); addEventListener('resize', resize);
  };
  H.toggleMap = () => {
    bigMap = !bigMap;
    Object.assign(el.mapWrap.style, bigMap ? { width: 'min(78vh, 78vw)', height: 'min(78vh, 78vw)', borderRadius: '8px', right: '50%', top: '50%', transform: 'translate(50%, -50%)' } : { width: '', height: '', borderRadius: '', right: '', top: '', transform: '' });
  };

  H.update = (dt, game) => {
    const p = game.player;
    el.hbar.style.width = Math.max(0, p.hp) + '%'; el.hcap.style.width = (100 - p.cap()) + '%';
    el.hbar.className = p.hp < 15 ? 'crit' : p.hp < 35 ? 'hurt' : '';
    el.hv.textContent = Math.ceil(Math.max(0, p.hp));
    el.stars.forEach((s, i) => s.classList.toggle('on', game.heat > i));
    el.naira.innerHTML = game.mode === 'patrol' ? `₦${game.life.wallet.toLocaleString()}<span>CASH</span>` : `₦${game.stats.returned.toLocaleString()}<span>RETURNED</span>`;
    const spd = Math.round(Math.hypot(p.vel.x, p.vel.z) * 3.6);
    el.mode.innerHTML = `${game.arrest ? 'Arrested' : p.cuffed && p.mode === 'foot' ? 'Handcuffed' : MODE_NAMES[p.mode] || p.mode}<small>${p.mode === 'grind' ? 'SPACE JUMP OFF · C HOP OFF' : spd + ' KM/H'}</small>`;
    const sk = p.mode === 'skitch' && p.skitch;
    el.grip.classList.toggle('hidden', !sk);
    if (sk) el.gripB.style.width = Math.max(0, p.skitch.grip) + '%';
    el.sense.style.width = game.senseMeter + '%';
    el.power.textContent = game.power > 0.5 ? 'GRID: ON' : 'NEPA TOOK LIGHT';
    el.power.classList.toggle('off', game.power <= 0.5);
    const meterV = game.hudMeter ?? game.catchMeter;
    el.catchW.classList.toggle('hidden', meterV <= 0.01);
    { const lbl = el.catchW.querySelector('.meterlbl'), want = game.catchLabel || 'OFFICER GRABBING YOU · MOVE!'; if (lbl.textContent !== want) lbl.textContent = want; }
    el.catchB.style.width = Math.min(100, meterV * 100) + '%';
    el.prompt.classList.toggle('hidden', !game.prompt);
    H.setPad(game.input?.usingPad ? game.input.padType || 'xbox' : game.input?.touch?.state.active ? 'touch' : null);
    if (game.prompt) el.prompt.innerHTML = glyph(game.prompt);
    if (sayT > 0) { sayT -= dt; if (sayT <= 0) el.say.classList.add('hidden'); }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) el.banner.innerHTML = ''; }
    const hi = game.hudInfo();
    el.rv.textContent = hi.respect.toLocaleString();
    el.cross.classList.toggle('hidden', !hi.aiming);
    el.chargeW.classList.toggle('hidden', hi.charge == null || hi.charge < 0.1);
    if (hi.charge != null) el.chargeB.style.width = Math.min(100, (hi.charge - 0.08) / 0.5 * 100) + '%';
    el.held.textContent = hi.holding ? '· ' + hi.holding : hi.boardLost ? '· BOARD IS OUT THERE' : '';
    el.gThrow.classList.toggle('on', !!hi.holding);
    { const g = hi.flurry ? 'FLURRY' : hi.sweep ? 'SWEEP' : 'LAUNCH'; if (g !== el.gLaunch._sw) { el.gLaunch._sw = g; el.gLaunch.innerHTML = (g === 'FLURRY' ? 'ALLEY CAT FLURRY' : g === 'SWEEP' ? 'CAT SWEEP' : 'LAUNCH') + ' <i>G</i>'; el.gLaunch.classList.toggle('on', g !== 'LAUNCH'); } }
    el.roomM.classList.toggle('hidden', !hi.inside);
    if (hi.inside) { el.noise.style.width = Math.min(100, hi.noise * 100) + '%'; el.susp.style.width = hi.suspicion + '%'; }
    el.mapWrap.style.visibility = hi.inside ? 'hidden' : '';
    el.wanted.forEach((w, i) => w.classList.toggle('on', hi.wanted > i));
    el.hunger.style.width = hi.hunger + '%'; el.hunger.classList.toggle('low', hi.hunger < 25);
    el.energy.style.width = hi.energy + '%'; el.energy.classList.toggle('low', hi.energy < 25);
    el.ct.textContent = hi.clock; el.cn.textContent = hi.label; el.brandSub.textContent = `SURULERE · ${hi.label}`; el.cw.textContent = `₦${hi.wallet.toLocaleString()}`;
    el.followed.classList.toggle('hidden', !hi.followed);
    el.followed.textContent = hi.watched ? 'BEING WATCHED · LOSE THEM' : 'BEING FOLLOWED';
    el.combo.classList.toggle('hidden', hi.combo < 2);
    if (hi.combo >= 2) el.comboB.textContent = 'x' + hi.combo;
    if (radioT > 0) { radioT -= dt; if (radioShown < radioFull.length) { radioShown = Math.min(radioFull.length, radioShown + dt * 70); el.radioTx.textContent = radioFull.slice(0, Math.floor(radioShown)); } if (radioT <= 0) el.radio.classList.add('hidden'); }
    el.radioLight.classList.toggle('hidden', !game.radio?.pending || hi.inside === undefined);
    el.eyes.classList.toggle('hidden', !(game.exposure > 0.5));
    if (game.exposure > 0.5) { el.eyesB.style.width = game.exposure + '%'; el.eyes.classList.toggle('hot', game.exposure > 65); }
    if (areaT > 0) { areaT -= dt; if (areaT <= 0) el.area.classList.remove('show'); }
    drawMap(game);
    drawMarkers(game.markers, game.camera.cam, innerWidth, innerHeight);
  };

  // ---- overlays ----
  const controlsHTML = `<div class="controls">${CONTROLS.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('')}</div>`;
  // ================= menus: title screen and pause =================
  // One shell for both: the city keeps moving behind, a vertical menu on the left, and sub-screens that
  // slide in from the right. Mouse, keyboard (arrows/WASD, Enter, Esc) and gamepad (D-pad/stick, A, B).
  const CONTROL_GROUPS: any[] = [
    ['Game', [['Pause · menu', 'Esc · P', 'Start'], ['Map: search a place, pick how to get there', 'M', 'View'], ['This controls card', 'H', '—']]],
    ['Moving', [['Move', 'W A S D', 'L-Stick'], ['Look around', 'Mouse', 'R-Stick'], ['Jump · climb a wall', 'Space', 'A'], ['Hold: charge a cat leap', 'Space', 'A'], ['Sprint', 'Shift', 'RT']]],
    ['Skating', [['Board on / off', 'R', 'Y'], ['Ollie (faster or holding Shift = higher)', 'Space', 'A'], ['In the air: board flip (+ a direction)', 'F', 'X'], ['In the air: backflip / frontflip / 360 spin (pull back / push forward / sideways)', 'Space', 'A'],
      ['Lie on your belly (when fast) · X again to get up', 'X', '—'], ['Skitch: grab a vehicle', 'E', 'RB']]],
    ['Okada', [['Take one (get close, or catch it on the board)', 'F', 'X'], ['Ride · full throttle', 'W A S D · Shift', 'L-Stick · RT'], ['Brake', 'Space', 'A'], ['Get off', 'R', 'Y']]],
    ['Fighting', [['Strike (toward where you push)', 'F · Click', 'X'], ['Counter when "!" flashes · Dodge', 'C', 'B'], ['Launch kick · Cat Sweep (3+ close)', 'G', 'D-Pad ↑'],
      ['Pounce onto an enemy', 'V', 'D-Pad ↓'], ['Pick up · Throw', 'T', 'D-Pad ←'], ['Aim a throw', 'Right click', 'LT']]],
    ['The street', [['Interact · buy · talk', 'F', 'X'], ['Change into / out of the suit (nobody watching)', 'U', '—'], ['Pocket radio', 'N', 'D-Pad →'], ['Torch', 'L', '—'], ['Street Sense (hold)', 'Q', 'LB']]],
  ];
  // the short version, shown the first time and on H
  H.controlsCard = (onDone, first = false) => {
    const wrap = document.createElement('div'); wrap.className = 'overlay ccard';
    const row = (k, t) => `<div><kbd>${k}</kbd><span>${t}</span></div>`;
    wrap.innerHTML = `<div class="cc-box"><div class="cc-k">${first ? 'BEFORE YOU GO OUT' : 'CONTROLS'}</div><h1>HOW TO PLAY</h1>
      <div class="cc-grid">
        <section><h3>Move</h3>${row('W A S D', 'Move')}${row('Mouse', 'Look around')}${row('Space', 'Jump · climb')}${row('Shift', 'Sprint')}</section>
        <section><h3>Skate</h3>${row('R', 'Board on / off')}${row('Space', 'Ollie, then Space again to flip')}${row('F', 'Board trick in the air')}${row('X', 'Belly-board (when fast)')}${row('E', 'Grab a car')}</section>
        <section><h3>Street</h3>${row('F', 'Hit · use · take an okada')}${row('C', 'Dodge · counter')}${row('M', 'Map: pick a place, pick a ride')}${row('U', 'Change into the suit')}</section>
        <section class="cc-hot"><h3>Menu</h3>${row('Esc', 'Pause (any time)')}${row('H', 'This card')}</section>
      </div>
      <button class="cc-go">${first ? 'Got it · click to play' : 'Back to the game'}</button><p class="cc-note">The mouse is captured while you play so it can turn the camera. Press <b>Esc</b> to get your cursor back (it pauses the game).</p></div>`;
    el.overlays.appendChild(wrap);
    const done = () => { wrap.remove(); removeEventListener('keydown', key, true); onDone?.(); };
    const key = (e) => { if (['Enter', 'Escape', 'KeyH', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); done(); } };
    addEventListener('keydown', key, true);
    wrap.querySelector<HTMLElement>('.cc-go').onclick = done;
  };
  const keycaps = (k) => k.split(' · ').map(x => `<kbd>${x}</kbd>`).join('<i>or</i>');
  const PSN = { A: '✕', B: '○', X: '□', Y: '△', RB: 'R1', LB: 'L1', RT: 'R2', LT: 'L2', Back: 'Share', Start: 'Options' };
  const padLabel = (k) => padType === 'ps' ? (PSN[k] || k) : k;
  const controlsPanel = () => `<div class="mm-controls">${CONTROL_GROUPS.map(([g, rows]) => `<section><h3>${g}</h3>${rows.map(([what, kb, pad]) => `<div class="cr"><span>${what}</span><span class="kb">${keycaps(kb)}</span><span class="pad"><kbd class="p">${padLabel(pad)}</kbd></span></div>`).join('')}</section>`).join('')}</div>`;
  const settingsPanel = (o: any) => `<div class="mm-quality">${Object.entries(o.presets).map(([k, p]: [string, any]) => `<button class="qcard ${k === o.quality ? 'on' : ''}" data-q="${k}" data-nav><b>${k.toUpperCase()}</b><span>${p.label.split(' · ')[1] || ''}</span>
      <ul><li>${p.fps} fps cap</li><li>${p.shadows ? `Shadows ${p.shadowSize}` : 'No shadows'}</li><li>${p.bloom ? 'Glow on' : 'No glow'}</li><li>${p.crowd} people</li></ul></button>`).join('')}</div>
    <p class="mm-note">Resolution, shadows, glow and frame rate change right away. The crowd size and street lights change the next time the game loads. If your laptop runs hot, pick Low.</p>`;
  const storyPanel = () => `<p class="mm-story">The <em>Red Caps</em>, a cult of agberos, have taken over Surulere from under Ojuelegba Bridge: beating traders, taking what little they have, holding people who refuse to pay.</p>
    <p class="mm-story">Bolaji is a street kid who lives with his mother and little brother in Aguda. By day he runs errands and hustles. At night, when Mama is asleep, he pulls on the black hoodie, straps his board to his back, and trusts gifts he doesn't understand: he moves like a cat: he climbs anything, lands on his feet, slips away from anyone, and feels danger before it comes.</p>
    <p class="mm-story">Nobody can know who he is. <em>Not even Mama.</em></p>`;

  let menuCleanup = null;
  function menuShell({ kind, header, items, hints = true }: any) {
    menuCleanup?.();
    el.overlays.innerHTML = `<div class="overlay mm mm-${kind}"><div class="mm-shade"></div>
      <div class="mm-left">${header}<nav class="mm-items">${items.map((it, i) => `<button class="mm-item" data-i="${i}" ${it.attr || ''}><span class="n">0${i + 1}</span><span class="l">${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}</span></button>`).join('')}</nav></div>
      <aside class="mm-panel"><div class="mm-ph"><h2></h2><button class="mm-back">ESC · BACK</button></div><div class="mm-pb"></div></aside>
      ${hints ? `<div class="mm-hints"><span><kbd>↑</kbd><kbd>↓</kbd> Select</span><span><kbd>Enter</kbd> / <kbd class="p">${padType === 'ps' ? '✕' : 'A'}</kbd> Confirm</span><span><kbd>Esc</kbd> / <kbd class="p">${padType === 'ps' ? '○' : 'B'}</kbd> Back</span></div>` : ''}</div>`;
    const root = el.overlays.querySelector('.mm'), btns = [...root.querySelectorAll('.mm-item')], panel = root.querySelector('.mm-panel');
    let sel = 0, inPanel = false, pSel = 0;
    const pItems = () => [...panel.querySelectorAll('[data-nav]')];
    const paint = () => {
      btns.forEach((b, i) => b.classList.toggle('sel', i === sel && !inPanel));
      pItems().forEach((b, i) => b.classList.toggle('focus', inPanel && i === pSel));
    };
    const M: any = {
      root,
      open(title, html, wire) {
        panel.querySelector('h2').textContent = title; panel.querySelector('.mm-pb').innerHTML = html;
        root.classList.add('panel-open'); inPanel = true; pSel = Math.max(0, pItems().findIndex(b => b.matches('.on, [data-default]')));
        panel.querySelector('.mm-back').onclick = M.close;
        wire?.(panel); paint();
      },
      close() { root.classList.remove('panel-open'); inPanel = false; paint(); },
      back: null,
    };
    btns.forEach((b, i) => { b.onmouseenter = () => { if (!inPanel) { sel = i; paint(); } }; b.onclick = () => { sel = i; inPanel = false; items[i].action(M); }; });
    const move = (d) => {
      if (inPanel) { const n = pItems().length; if (n) pSel = (pSel + d + n) % n; }
      else sel = (sel + d + btns.length) % btns.length;
      paint();
    };
    const confirm = () => { if (inPanel) pItems()[pSel]?.click(); else btns[sel]?.click(); };
    const back = () => { if (inPanel) M.close(); else M.back?.(); };
    const onKey = (e) => {
      if (!root.isConnected) return;
      const k = e.code;
      if (k === 'ArrowUp' || k === 'KeyW' || (inPanel && k === 'ArrowLeft')) { move(-1); e.preventDefault(); }
      else if (k === 'ArrowDown' || k === 'KeyS' || (inPanel && k === 'ArrowRight')) { move(1); e.preventDefault(); }
      else if (k === 'Enter' || k === 'Space') { confirm(); e.preventDefault(); }
      else if (k === 'Escape' || k === 'Backspace') { back(); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    // gamepad: poll while the menu is up
    let raf = 0; const prev: any = {};
    const pad = () => {
      if (!root.isConnected) return;
      const gp = [...(navigator.getGamepads?.() || [])].find(g => g && g.connected);
      if (gp) {
        const pt = /054c|playstation|dualsense|dualshock|wireless controller/i.test(gp.id) ? 'ps' : 'xbox';
        if (pt !== padType) { padType = pt; const hb = root.querySelector('.mm-hints'); if (hb) hb.innerHTML = `<span><kbd>↑</kbd><kbd>↓</kbd> Select</span><span><kbd>Enter</kbd> / <kbd class="p">${pt === 'ps' ? '✕' : 'A'}</kbd> Confirm</span><span><kbd>Esc</kbd> / <kbd class="p">${pt === 'ps' ? '○' : 'B'}</kbd> Back</span>`; }
        const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ay = gp.axes[1] || 0, ax = gp.axes[0] || 0;
        const st: any = { up: b(12) || ay < -0.6 || (inPanel && (b(14) || ax < -0.6)), down: b(13) || ay > 0.6 || (inPanel && (b(15) || ax > 0.6)), a: b(0), b: b(1) || b(9) && inPanel };
        if (st.up && !prev.up) move(-1); if (st.down && !prev.down) move(1);
        if (st.a && !prev.a) confirm(); if (st.b && !prev.b) back();
        Object.assign(prev, st);
      }
      raf = requestAnimationFrame(pad);
    };
    raf = requestAnimationFrame(pad);
    menuCleanup = () => { document.removeEventListener('keydown', onKey); cancelAnimationFrame(raf); menuCleanup = null; };
    M.destroy = () => { menuCleanup?.(); el.overlays.innerHTML = ''; };
    paint();
    return M;
  }
  const qualityWire = (o, onPick) => (panel) => panel.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    panel.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === b)); o.quality = b.dataset.q; onPick(b.dataset.q);
  });
  const logo = (small) => `<div class="mm-logo ${small ? 'small' : ''}"><div class="mm-kicker">A BOLAJI STORY</div><h1><span class="fl">LIGHT</span><span class="dash">-</span><span class="fl2">OFF</span></h1>
    <div class="mm-chapter">SURULERE <b>·</b> YABA <b>·</b> MUSHIN <b>·</b> LAGOS</div></div>`;

  H.title = (save, onStart, opts) => {
    const o = opts || { quality: 'medium', presets: {} };
    let q = o.quality;
    const start = (fresh) => { M.destroy(); onStart({ quality: q, fresh }); };
    const items: any[] = [];
    // free roam is the whole game for now: no missions, no board, just Lagos
    const go = (fresh) => { M.destroy(); onStart({ quality: q, fresh, mode: 'patrol' }); };
    if (o.patrol) items.push({ label: 'Continue', sub: `${o.patrol.phase === 'night' ? 'Night' : 'Day'} ${o.patrol.night}`, attr: 'data-start', action: () => go(false) });
    items.push({ label: o.patrol ? 'New game' : 'Play', sub: 'Free roam · Surulere, Yaba, Mushin, the bridge', attr: o.patrol ? 'data-new' : 'data-start', action: (m) => {
      if (!o.patrol) return go(true);
      m.open('START OVER?', '<p class="mm-note big">Your saved game will be erased: money, items, everything.</p><div class="mm-row"><button class="mm-btn danger" data-nav data-yes>Yes, start over</button><button class="mm-btn" data-nav data-no data-default>Keep my save</button></div>',
        (p) => { p.querySelector('[data-yes]').onclick = () => go(true); p.querySelector('[data-no]').onclick = m.close; });
    } });
    items.push({ label: 'The story', action: (m) => m.open('THE STORY SO FAR', storyPanel()) });
    items.push({ label: 'Controls', action: (m) => m.open('CONTROLS', controlsPanel()) });
    items.push({ label: 'Settings', action: (m) => m.open('GRAPHICS', settingsPanel({ ...o, quality: q }), qualityWire(o, v => { q = v; })) });
    const M = menuShell({ kind: 'title', header: logo(false), items });
  };

  H.pause = (onResume, missions, onJump, opts) => {
    const resume = () => { M.destroy(); onResume(); };
    const done = missions.filter(m => m.done).length;
    const boardPanel = (m) => {
      const list = opts.board();
      const K: any = { crime: '#ff5252', police: '#64b5f6', run: '#69f0ae', job: '#80deea', explore: '#ffd54f', need: '#ffab40' };
      m.open('PATROL BOARD', `<p class="mm-note" style="margin-top:0">${opts.rank ? `Street rank: <b style="color:#ffd54f">${opts.rank.name}</b>${opts.rank.next ? ` · ${opts.rank.toNext.toLocaleString()} respect to ${opts.rank.next}` : ''}` : ''}</p>
        <div class="mm-missions">${list.length ? list.map((e, i) => `<div class="mmr ${e.urgent ? 'cur' : ''}"><span class="n" style="color:${K[e.kind] || '#aaa'};font-size:14px;width:auto;min-width:64px">${e.dist}m</span><span class="t"><b>${e.title}</b><i>${e.desc} · ${e.reward}</i></span><button class="mm-btn ${e.urgent ? 'hot' : ''}" data-nav data-w="${i}">Go</button></div>`).join('') : '<p class="mm-note big">Quiet right now. Give it a minute: Lagos never stays quiet for long.</p>'}</div>`,
        (p) => p.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { M.destroy(); opts.onWaypoint(list[+b.dataset.w]); }));
    };
    const items = [
      { label: 'Resume', attr: 'data-go', action: resume },
      opts.mode !== 'patrol' && { label: 'Missions', sub: `${done} of ${missions.length} complete`, attr: 'data-ms', action: (m) => m.open('CHAPTER 1 · MISSIONS',
        `<div class="mm-missions">${missions.map((ms, i) => `<div class="mmr ${ms.done ? 'done' : ms.current ? 'cur' : 'locked'}"><span class="n">${i + 1}</span><span class="t"><b>${ms.current || ms.done ? ms.title : 'Locked'}</b><i>${ms.done ? 'Completed' : ms.current ? (ms.unlocked ? 'Current · ready tonight' : 'Current · listen to the radio for a lead') : 'Finish the current mission first'}</i></span>${ms.done ? `<button class="mm-btn" data-nav data-m="${i}">Replay</button>` : ms.current ? `<button class="mm-btn hot" data-nav data-m="${i}">Play now</button>` : '<span class="lock">LOCKED</span>'}</div>`).join('')}</div>`,
        (p) => p.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { M.destroy(); onJump(+b.dataset.m); })) },
      opts.tutorial?.active ? { label: 'Skip tutorial', sub: 'You can replay it from here later', action: () => { M.destroy(); opts.tutorial.skip(); } } : { label: 'Replay tutorial', sub: 'First steps: move, skate, flip, map', action: () => { M.destroy(); opts.tutorial?.replay(); } },
      !opts.tutorial?.active && { label: 'Boy in black tutorial', sub: 'Climb, wall-run, cat drop, fight a group', action: () => { M.destroy(); opts.tutorial?.replayNight(); } },
      { label: 'Controls', attr: 'data-ct', action: (m) => m.open('CONTROLS', controlsPanel()) },
      { label: 'Settings', attr: 'data-st', action: (m) => m.open('GRAPHICS', settingsPanel(opts), qualityWire(opts, v => opts.onQuality(v))) },
      { label: 'Quit to title', sub: 'Progress is saved', action: (m) => m.open('QUIT TO TITLE?', '<p class="mm-note big">Your progress is saved at the last checkpoint (waking up, going home, finishing a mission).</p><div class="mm-row"><button class="mm-btn danger" data-nav data-yes>Quit to title</button><button class="mm-btn" data-nav data-no data-default>Keep playing</button></div>',
        (p) => { p.querySelector('[data-yes]').onclick = () => location.reload(); p.querySelector('[data-no]').onclick = m.close; }) },
    ];
    const M = menuShell({ kind: 'pause', header: `<div class="mm-logo small"><div class="mm-kicker">LIGHT-OFF</div><h1>PAUSED</h1></div>`, items: items.filter(Boolean) });
    M.back = resume;
    if (opts.openBoard) boardPanel(M);
  };
  H.onHelpBar = (fn) => (root as any).querySelectorAll('[data-hb]').forEach((b: any) => b.onclick = (e) => { e.stopPropagation(); fn(b.dataset.hb); });
  H.end = (stats, onContinue) => {
    const S = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    el.overlays.innerHTML = `<div class="overlay"><div class="card">
      <h1 class="title" style="font-size:clamp(48px,9vw,110px)">NIGHT COMPLETE</h1>
      <div class="subtitle">Surulere will talk about this for weeks</div>
      <div class="stats">${S('₦' + stats.returned.toLocaleString(), 'Returned to the people')}${S(stats.families, 'Families helped')}${S(stats.knockdowns, 'Agberos put down')}
        ${S(stats.blackouts, 'Blackouts survived')}${S(Math.round(stats.topSpeed * 3.6) + ' km/h', 'Top speed')}${S(Math.round(stats.skitchDist) + ' m', 'Skitched')}
        ${S(stats.longestGrind.toFixed(1) + ' m', 'Longest grind')}${S(stats.busted, 'Times busted')}${S(fmtTime(stats.time), 'Time')}</div>
      <p class="intro">Tomorrow he has an 8 AM lecture at UNILAG. Tonight, the street is quiet for once.</p>
      <div class="row"><button class="btn" data-go>Keep roaming</button></div></div></div>`;
    el.overlays.querySelector('[data-go]').onclick = () => { el.overlays.innerHTML = ''; onContinue(); };
  };
  H.home = (info, h) => {
    const m = info.mission;
    el.overlays.innerHTML = `<div class="overlay home"><div class="card">
      <div class="subtitle">${info.clock} · Night ${info.night} · Bolaji's room, Aguda</div>
      <h1 class="title" style="font-size:clamp(44px,8vw,92px)">HOME</h1>
      <p class="intro">${info.text}</p>
      <div class="homestats"><span>Health <b>${info.hp}</b></span><span>Hunger <b>${Math.round(info.hunger)}%</b></span><span>Energy <b>${Math.round(info.energy)}%</b></span><span>Wallet <b>₦${info.wallet.toLocaleString()}</b></span><span>Mama's pot <b>${info.meals} left</b></span></div>
      ${m ? `<div class="missioncard"><div class="mlabel">STORY · CHAPTER 1 · MISSION ${m.n}</div><h2>${m.title}</h2><p>${m.intro}</p></div>` : ''}
      <div class="row">
        ${info.late ? '' : m ? '<button class="btn" data-story>Go out: story mission</button>' : ''}
        ${info.late ? '' : `<button class="btn ${m ? 'ghost' : ''}" data-free>${m ? 'Go out: patrol the streets' : 'Go out'}</button>`}
        <button class="btn ghost" data-eat ${info.meals ? '' : 'disabled'}>Eat from Mama's pot</button>
        <button class="btn ghost" data-sleep>Sleep (end the night)</button>
      </div></div></div>`;
    const on = (k, f) => { const b = el.overlays.querySelector(`[data-${k}]`); if (b) b.onclick = f; };
    on('story', () => { el.overlays.innerHTML = ''; h.out(true); });
    on('free', () => { el.overlays.innerHTML = ''; h.out(false); });
    on('eat', () => h.eat());
    on('sleep', () => h.sleep());
  };
  // end of the night: how it ended, what he did tonight, and tomorrow's paper
  H.nightOver = (r, onNext) => {
    const S = (v, l) => `<div class="rs"><b>${v}</b><span>${l}</span></div>`, t = r.tonight;
    const [src, ...rest] = r.headline.split(':');
    el.overlays.innerHTML = `<div class="overlay mm mm-report ${r.tone}"><div class="mm-shade"></div>
      <div class="rp-left">
        <div class="mm-kicker">${r.kicker}</div>
        <h1 class="rp-title">${r.title}</h1>
        <p class="rp-story">${r.story}</p>
        <div class="rp-label">TONIGHT</div>
        <div class="rp-stats">${S('₦' + t.returned.toLocaleString(), 'Returned')}${S(t.helped, 'People helped')}${S(t.down, 'Red Caps down')}${S(t.combo ? 'x' + t.combo : '–', 'Best combo')}${S('+' + t.respect.toLocaleString(), 'Respect')}</div>
        <p class="rp-deeds">${r.deeds}</p>
        ${r.mama ? `<p class="rp-mama">${r.mama}</p>` : ''}
        ${r.next ? `<p class="rp-next">${r.next}</p>` : ''}
        <div class="rp-foot"><button class="mm-btn hot" data-go>${r.ending === 'beaten' || r.ending === 'arrested' ? 'Wake up' : 'Sleep till morning'}</button>
          <span class="rp-total">All time · ₦${r.totals.returned.toLocaleString()} returned · ${r.totals.down} Red Caps down · ${r.totals.respect.toLocaleString()} respect</span></div>
      </div>
      <div class="rp-paper"><div class="pm">THE LAGOS DAILY · TOMORROW</div><h2>${rest.join(':').trim()}</h2><div class="ps">${src}</div><div class="pl"></div><div class="pl"></div><div class="pl short"></div></div>
    </div>`;
    const go = () => { document.removeEventListener('keydown', key); el.overlays.innerHTML = ''; onNext(); };
    const key = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); go(); } };
    document.addEventListener('keydown', key);
    el.overlays.querySelector('[data-go]').onclick = go;
  };
  H.chapter = (onGo) => {
    el.overlays.innerHTML = `<div class="overlay"><div class="card">
      <div class="subtitle">Chapter 1 complete</div>
      <h1 class="title" style="font-size:clamp(44px,8vw,100px)">THE RED CAPS</h1>
      <p class="intro">Baba Ade, the traders under the bridge, Kayode, Baba Kolade: all home. Inspector Okafor's envelope is gone, the Egúngún is still out there, and under Ojuelegba Bridge
      five words are painted on a pillar: <em>SURULERE IS NOT FOR SALE.</em> The Chairman has lost his street. Now he wants a name.<br><br>And in Mama's handbag, an envelope from JAMB is waiting to be opened...</p>
      <p class="intro" style="opacity:.7">To be continued. Surulere is yours to patrol: side missions, levy points and Red Cap patrols keep coming.</p>
      <div class="row"><button class="btn" data-go>Keep patrolling</button></div></div></div>`;
    el.overlays.querySelector('[data-go]').onclick = () => { el.overlays.innerHTML = ''; onGo(); };
  };
  H.newspaper = (heads, onClose) => {
    const [main, ...rest] = heads;
    el.overlays.innerHTML = `<div class="overlay"><div class="paper">
      <div class="masthead">THE LAGOS DAILY <span>₦200 · ${new Date(2026, 8, 28).toDateString().toUpperCase()}</span></div>
      <h1>${main.replace(/^[A-Z ]+:\s*/, '')}</h1><div class="src">${(main.match(/^[A-Z ]+/) || [''])[0]}</div>
      <div class="cols">${rest.map((h, i) => `<div><h3>${h.replace(/^[A-Z ]+:\s*/, '')}</h3><div class="src">${(h.match(/^[A-Z ]+/) || [''])[0]}</div><p>${FILLER[(i + heads.length) % FILLER.length]}</p></div>`).join('')}</div>
      <button class="btn" data-go>Fold the paper</button></div></div>`;
    el.overlays.querySelector('[data-go]').onclick = () => { el.overlays.innerHTML = ''; onClose?.(); };
  };
  H.missionReport = (r, onDone) => {
    const S = (v, l) => `<div class="rs"><b>${v}</b><span>${l}</span></div>`;
    el.overlays.innerHTML = `<div class="overlay mm mm-report green"><div class="mm-shade"></div>
      <div class="rp-left">
        <div class="mm-kicker">${r.sub}</div>
        <h1 class="rp-title">${r.title}</h1>
        <div class="stars">${[1, 2, 3].map(i => `<i class="${i <= r.stars ? 'on' : ''}">★</i>`).join('')}</div>
        <p class="rp-story">${r.finish}</p>
        <div class="rp-stats">${S(r.time, 'Time')}${S(r.kos, 'Down')}${S(r.hits, 'Hits taken')}${S(r.best ? 'x' + r.best : '–', 'Best combo')}${S('₦' + r.returned.toLocaleString(), 'Returned')}</div>
        <div class="dbf">${r.well.length ? `<div><b class="ok">WHAT YOU DID WELL</b>${r.well.map(x => `<p>✓ ${x}</p>`).join('')}</div>` : ''}${r.better.length ? `<div><b class="tip">DO BETTER NEXT TIME</b>${r.better.map(x => `<p>→ ${x}</p>`).join('')}</div>` : ''}</div>
        <div class="unl">${r.unlocks.map(u => `<span>${u}</span>`).join('')}</div>
        <div class="rp-foot"><button class="mm-btn hot" data-go>Continue</button></div>
      </div></div>`;
    const go = () => { document.removeEventListener('keydown', key); el.overlays.innerHTML = ''; onDone(); };
    const key = (e) => { if (e.code === 'Enter') { e.preventDefault(); go(); } };
    document.addEventListener('keydown', key);
    (el.overlays.querySelector('[data-go]') as any).onclick = go;
  };
  H.shop = (shop, items, wallet, onBuy, onClose) => {
    const draw = (msg = '') => {
      el.overlays.innerHTML = `<div class="overlay"><div class="card ridemenu">
        <div class="subtitle">${shop.name} · you have ₦${wallet().toLocaleString()}</div><h1 class="title" style="font-size:56px">SHOP</h1>
        <div class="rides">${items().map(it => `<div class="ride"><div><b>${it.name}</b><span>${it.desc}</span></div><div class="modes"><button class="btn ${it.owned ? 'ghost' : ''}" data-buy="${it.id}" ${it.owned ? 'disabled' : ''}>${it.owned ? 'Owned' : '₦' + it.price.toLocaleString()}</button></div></div>`).join('')}</div>
        <p class="intro" style="font-size:13px;opacity:.8">${msg}</p>
        <button class="btn ghost" data-close>Leave</button></div></div>`;
      el.overlays.querySelectorAll('[data-buy]').forEach((b: any) => b.onclick = () => { const r = onBuy(b.dataset.buy); draw(r === 'broke' ? 'Not enough money.' : r === 'ok' ? 'Bought.' : ''); });
      (el.overlays.querySelector('[data-close]') as any).onclick = () => { el.overlays.innerHTML = ''; onClose(); };
    };
    draw();
  };
  // J: the SwiftDrop job sheet. Today's parcels, reviews, the weekly race against the other riders, rent
  H.jobSheet = (j, onClose) => {
    const wrap = document.createElement('div'); wrap.className = 'overlay ccard';
    const ord = j.orders.length ? j.orders.map(o => `<div class="js-o ${o.status}"><b>${o.status === 'pending' ? (o.late ? '⚠' : '○') : o.status === 'failed' ? '✕' : '✓'}</b><span><b>${o.who}</b> · ${o.item}<i>${o.place.name}${o.place.area ? ' · ' + o.place.area : ''}</i></span><em>${o.status === 'pending' ? (o.late ? 'LATE' : 'by ' + o.dueStr) : o.status.toUpperCase()}</em></div>`).join('')
      : `<p class="cc-note">${j.employed ? (j.clockedIn ? '' : 'No parcels yet. Clock in at the SwiftDrop office (Ojuelegba) before noon.') : 'You don\'t work at SwiftDrop right now.'}</p>`;
    wrap.innerHTML = `<div class="cc-box"><div class="cc-k">SWIFTDROP DISPATCH · DAY ${j.day}</div><h1>JOB SHEET</h1>
      <div class="js-top"><div><b>${j.stars}</b><i>RATING ${j.rating.toFixed(1)}</i></div><div><b>₦${j.weekEarned.toLocaleString()}</b><i>THIS WEEK · PAYDAY DAY ${j.payDay}</i></div><div><b>₦${j.rent.toLocaleString()}</b><i>RENT DUE DAY ${j.rentDue}</i></div></div>
      <div class="cc-grid"><section style="grid-column: span 2"><h3>Today's parcels</h3>${ord}</section>
      <section><h3>Riders this week</h3>${j.rivals.map((r, k) => `<div class="js-r ${r.me ? 'me' : ''}"><b>${k + 1}</b><span>${r.name}</span><em>${r.week} · ★${r.rating.toFixed(1)}</em></div>`).join('')}</section>
      <section><h3>Latest reviews</h3>${j.reviews.length ? j.reviews.map(r => `<div class="js-v"><b>${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</b><span>${r.who}: "${r.text}"</span></div>`).join('') : '<p class="cc-note">No reviews yet.</p>'}</section></div>
      <button class="cc-go">Back to work</button></div>`;
    el.overlays.appendChild(wrap);
    const done = () => { wrap.remove(); removeEventListener('keydown', key, true); onClose?.(); };
    const key = (e) => { if (['Escape', 'KeyJ', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); done(); } };
    addEventListener('keydown', key, true); wrap.querySelector<HTMLElement>('.cc-go').onclick = done;
  };
  H.rideMenu = (from, opts, onPick, onCancel) => {
    const LBL = { danfo: 'Danfo', keke: 'Keke', okada: 'Okada' };
    el.overlays.innerHTML = `<div class="overlay"><div class="card ridemenu">
      <div class="subtitle">Bus stop · ${from.name}</div><h1 class="title" style="font-size:56px">WHERE TO?</h1>
      <div class="rides">${opts.map((o, i) => `<div class="ride"><div><b>${o.stop.name}</b><span>${o.dist} m</span></div><div class="modes">${Object.entries(o.fares).map(([m, f]) => `<button class="btn ghost" data-i="${i}" data-m="${m}">${LBL[m]} ₦${f}</button>`).join('')}</div></div>`).join('')}</div>
      <p class="intro" style="font-size:13px;opacity:.75">Danfo: cheap and packed. Keke: cheapest, slow. Okada: fastest, you ride pillion. Hold Space to hurry the driver, F to jump off early.</p>
      <button class="btn ghost" data-cancel>Walk instead</button></div></div>`;
    el.overlays.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { el.overlays.innerHTML = ''; onPick(opts[+b.dataset.i].stop, b.dataset.m); });
    el.overlays.querySelector('[data-cancel]').onclick = () => { el.overlays.innerHTML = ''; onCancel(); };
  };
  H.loading = (on) => { if (on) el.overlays.innerHTML = '<div class="loading">BUILDING SURULERE…</div>'; else el.overlays.innerHTML = ''; };
  H.hasOverlay = () => !!el.overlays.innerHTML;
  H.setHudVisible = (v) => { for (const k of ['.status', '.objective', '.minimap', '.power', '.modebox', '.help', '.toasts', '.markers', '.bannerwrap', '.say', '.prompt', '.catch', '.popups', '.notices', '.crosshair', '.clock', '.followed', '.combo', '.areaname', '.roommeters', '.tracker', '.eyes', '.radiobox', '.radiolight']) { const n = root.querySelector(k); if (n) n.style.visibility = v ? '' : 'hidden'; } };
  return H;
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
