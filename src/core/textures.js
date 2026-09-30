// Procedural canvas textures: building windows (with burglar-proof bars), roads, sidewalks,
// shop signs, light pools. Everything is drawn at startup, so the game ships no image files.
import * as THREE from 'three';
import { rng } from '../world/layout.js';

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
function noise(ctx, w, h, r, amount, seed = 1) {
  const R = rng(seed);
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(R() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${0.04 + R() * 0.06})`;
    ctx.fillRect(R() * w, R() * h, r * (0.5 + R()), r * (0.5 + R()));
  }
}

// 8 bays x 8 floors; one bay = 3 m wide, one floor = 3.2 m tall -> texture covers 24 m x 25.6 m
export const WIN_U = 24, WIN_V = 25.6;
export function windowTextures() {
  const S = 1024, cell = S / 8, R = rng(7);
  const [ca, a] = canvas(S, S), [ce, e] = canvas(S, S);
  a.fillStyle = '#f2efe8'; a.fillRect(0, 0, S, S);
  noise(a, S, S, 6, 9000, 3);
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  const lit = ['#ffcf8a', '#ffd9a0', '#f4f7ff', '#d8ecff', '#ffb870', '#9fc4ff'];
  for (let fy = 0; fy < 8; fy++) for (let bx = 0; bx < 8; bx++) {
    const x = bx * cell, y = fy * cell;
    // floor slab line
    a.fillStyle = 'rgba(0,0,0,0.12)'; a.fillRect(x, y + cell - 6, cell, 6);
    if (R() < 0.14) continue; // blank wall
    const wx = x + 24, wy = y + 30, ww = cell - 48, wh = cell - 62;
    // rain grime under the sill
    const gr = a.createLinearGradient(0, wy + wh, 0, wy + wh + 40);
    gr.addColorStop(0, 'rgba(60,50,40,0.35)'); gr.addColorStop(1, 'rgba(60,50,40,0)');
    a.fillStyle = gr; a.fillRect(wx + 4, wy + wh, ww - 8, 40);
    // frame + glass
    a.fillStyle = '#6b6258'; a.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
    a.fillStyle = '#15181d'; a.fillRect(wx, wy, ww, wh);
    const on = R() < 0.36;
    if (on) {
      const col = lit[Math.floor(R() * lit.length)];
      const g = e.createLinearGradient(0, wy, 0, wy + wh);
      g.addColorStop(0, col); g.addColorStop(1, shade(col, 0.55));
      e.fillStyle = g; e.fillRect(wx, wy, ww, wh);
      if (R() < 0.5) { e.fillStyle = 'rgba(0,0,0,0.55)'; e.fillRect(wx, wy, ww * (0.3 + R() * 0.4), wh); } // curtain
    }
    // burglar-proof bars
    for (const ctx of [a, e]) {
      ctx.fillStyle = ctx === a ? '#3b3a38' : '#000';
      for (let i = 1; i < 6; i++) ctx.fillRect(wx + (ww * i) / 6 - 2, wy, 4, wh);
      for (let i = 1; i < 3; i++) ctx.fillRect(wx, wy + (wh * i) / 3 - 2, ww, 4);
    }
    // occasional AC unit
    if (R() < 0.12) { a.fillStyle = '#d9d6cf'; a.fillRect(wx + ww - 30, wy + wh + 6, 34, 20); a.fillStyle = '#9a968e'; a.fillRect(wx + ww - 26, wy + wh + 10, 26, 3); }
  }
  return { albedo: tex(ca), emissive: tex(ce) };
}
function shade(hex, k) {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return '#' + c.getHexString();
}

// road: u across the 12 m carriageway, v along it (one repeat = 12 m)
export function roadTexture() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#2c2c2e'; x.fillRect(0, 0, 256, 256);
  noise(x, 256, 256, 2, 7000, 11);
  const R = rng(5);
  for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(${R() < 0.5 ? 15 : 60},${R() < 0.5 ? 15 : 55},${R() < 0.5 ? 15 : 50},0.35)`; x.fillRect(R() * 256, R() * 256, 20 + R() * 60, 10 + R() * 40); }
  // faded edge lines + dashed centre
  x.fillStyle = 'rgba(230,225,210,0.55)'; x.fillRect(10, 0, 4, 256); x.fillRect(242, 0, 4, 256);
  x.fillStyle = 'rgba(240,200,60,0.7)'; x.fillRect(126, 0, 5, 150);
  return tex(c);
}
export function asphaltTexture() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#2d2d2f'; x.fillRect(0, 0, 256, 256);
  noise(x, 256, 256, 2, 7000, 13);
  return tex(c);
}
// sidewalk slabs, one repeat = 3 m
export function sidewalkTexture() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#8d877c'; x.fillRect(0, 0, 256, 256);
  noise(x, 256, 256, 3, 5000, 17);
  x.strokeStyle = 'rgba(40,35,30,0.45)'; x.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  const R = rng(19);
  for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(50,40,30,${0.1 + R() * 0.2})`; x.beginPath(); x.arc(R() * 256, R() * 256, 6 + R() * 18, 0, 7); x.fill(); }
  return tex(c);
}
export function dirtTexture(base = '#6e5a42', seed = 23) {
  const [c, x] = canvas(256, 256);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  noise(x, 256, 256, 3, 9000, seed);
  return tex(c);
}

// radial glow, used for street-light pools, headlights and beacons
export function glowTexture() {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return tex(c, { repeat: false, srgb: false });
}
export function beamTexture() {
  const [c, x] = canvas(64, 256);
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  const h = x.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 256);
  return tex(c, { repeat: false, srgb: false });
}

// shop signs atlas: 2 columns x 8 rows, each 512 x 128
export const SIGNS = [
  ['MAMA NKECHI PROVISIONS', '#c62828', '#fff'],
  ["GOD'S GRACE PHONE REPAIRS", '#1565c0', '#fff'],
  ['BLESSED CHILD BARBING SALOON', '#fdd835', '#111'],
  ['BUKKA 24/7  AMALA & EWEDU', '#2e7d32', '#fff'],
  ['NO JAMB NO GAIN LESSONS', '#6a1b9a', '#fff'],
  ['OJUELEGBA POOLS & BETS', '#ef6c00', '#111'],
  ['JESUS IS LORD MOTOR SPARES', '#f5f5f5', '#b71c1c'],
  ['AJEBO FASHION HOUSE', '#111', '#ffca28'],
  ['EKO CHEMIST & PATENT MEDS', '#00897b', '#fff'],
  ['UNITY VULCANIZER', '#37474f', '#ffeb3b'],
  ['SPACE FOR RENT  CALL 0803', '#fafafa', '#222'],
  ['IYA SADE PEPPER & TOMATO', '#d84315', '#fff'],
  ['SURULERE SUYA SPOT', '#4e342e', '#ffcc80'],
  ['BIG BOY CYBER CAFE', '#0d47a1', '#80d8ff'],
  ['FAITH HAIR & NAILS', '#ad1457', '#fff'],
  ['POS  CASH OUT HERE', '#1b5e20', '#ffee58'],
];
export function signAtlas() {
  const [c, x] = canvas(1024, 1024);
  SIGNS.forEach(([text, bg, fg], i) => {
    const col = i % 2, row = Math.floor(i / 2), X = col * 512, Y = row * 128;
    x.fillStyle = bg; x.fillRect(X, Y, 512, 128);
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 8; x.strokeRect(X + 4, Y + 4, 504, 120);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 58; x.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
    while (x.measureText(text).width > 470 && size > 20) { size -= 2; x.font = `900 ${size}px Impact, 'Arial Black', sans-serif`; }
    x.fillText(text, X + 256, Y + 66);
    noise(x, 512, 128, 2, 300, i + 40);
  });
  const t = tex(c, { repeat: false }); t.flipY = true;
  return t;
}
export const signUV = i => { const col = i % 2, row = Math.floor(i / 2); return [col * 0.5, 1 - (row + 1) / 8, col * 0.5 + 0.5, 1 - row / 8]; };

export function starsTexture() {
  const [c, x] = canvas(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return tex(c, { repeat: false, srgb: false });
}

// a single sign with custom text (UNILAG gate, hostel names)
export function textSign(text, bg = '#1b3a6b', fg = '#ffffff', w = 1024, h = 160, sub = '') {
  const [c, x] = canvas(w, h);
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = sub ? h * 0.42 : h * 0.55; x.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
  while (x.measureText(text).width > w - 60 && size > 12) { size -= 2; x.font = `900 ${size}px Impact, 'Arial Black', sans-serif`; }
  x.fillText(text, w / 2, sub ? h * 0.4 : h / 2 + 4);
  if (sub) { x.font = `700 ${h * 0.2}px Inter, Arial, sans-serif`; x.fillText(sub, w / 2, h * 0.78); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// wavy normal map for the lagoon
export function waterNormals() {
  const S = 256, [c, x] = canvas(S, S), img = x.createImageData(S, S), R = rng(77);
  const waves = Array.from({ length: 7 }, () => ({ kx: Math.round((R() * 2 - 1) * 6), kz: Math.round((R() * 2 - 1) * 6), p: R() * 6.28, a: 0.3 + R() * 0.5 }));
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let dx = 0, dz = 0;
    for (const w of waves) { const ph = (w.kx * i + w.kz * j) / S * Math.PI * 2 + w.p; const d = Math.cos(ph) * w.a; dx += d * w.kx; dz += d * w.kz; }
    const k = (i + j * S) * 4, nx = dx * 0.04, nz = dz * 0.04, l = Math.hypot(nx, nz, 1);
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (nz / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

// Ankara wax-print pattern (Bolaji's mask, cut from his mother's wrapper)
export function ankaraTexture() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#e65100'; x.fillRect(0, 0, 128, 128);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const cx = i * 32 + 16, cy = j * 32 + 16;
    x.fillStyle = (i + j) % 2 ? '#00897b' : '#1a237e'; x.beginPath(); x.arc(cx, cy, 13, 0, 7); x.fill();
    x.fillStyle = '#fdd835'; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill();
    x.fillStyle = '#fdd835'; x.save(); x.translate(i * 32, j * 32); x.rotate(Math.PI / 4); x.fillRect(-3, -3, 6, 6); x.restore();
  }
  return tex(c);
}

// a broken Lagos road: red laterite showing through patches of old asphalt, tyre ruts, puddle stains
export function badRoadTexture() {
  const [c, x] = canvas(256, 256), R = rng(91);
  x.fillStyle = '#7a4a32'; x.fillRect(0, 0, 256, 256);
  noise(x, 256, 256, 3, 9000, 92);
  for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(45,45,47,${0.75 + R() * 0.2})`; x.beginPath(); const cx = R() * 256, cy = R() * 256; x.moveTo(cx, cy); for (let k = 0; k < 7; k++) x.lineTo(cx + (R() - 0.5) * 120, cy + (R() - 0.5) * 120); x.fill(); }
  x.strokeStyle = 'rgba(40,25,15,0.35)'; x.lineWidth = 10; for (const u of [70, 186]) { x.beginPath(); x.moveTo(u, 0); x.bezierCurveTo(u + 12, 90, u - 12, 170, u, 256); x.stroke(); }
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(20,15,10,0.35)'; x.beginPath(); x.ellipse(R() * 256, R() * 256, 8 + R() * 20, 5 + R() * 12, R() * 3, 0, 7); x.fill(); }
  return tex(c);
}
