// The big map's look: a night-mode city atlas drawn once into a canvas when the map is first opened.
// Water with a soft wave pattern, every block split into building footprints with a drop shadow
// (so the city reads in 3D), streets as lit lanes with a centre line, parks and pitches in green,
// and each district faintly tinted. Labels and everything live are drawn on top every frame.
import { N, HALF, CELL, ROAD, I0, I1, roadLine } from '../world/layout.ts';

const DISTRICT_TINT = (b) => b.bi >= N ? [70, 110, 190] : b.bi < 0 ? [190, 120, 70] : [150, 150, 175]; // Yaba blue, Mushin amber, Surulere neutral

function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function buildStyledMap(world, { EXT, NZ, W0, H0 }, S = 2) {
  const c = document.createElement('canvas'); c.width = Math.ceil(W0 * S); c.height = Math.ceil(H0 * S);
  const x = c.getContext('2d')!;
  x.scale(S, S);
  const MX = (v: number) => v + EXT, MZ = (v: number) => v + NZ;

  // ---- water: the lagoon, deep blue with a faint wave pattern ----
  const wg = x.createLinearGradient(0, 0, W0 * 0.3, H0);
  wg.addColorStop(0, '#071a2c'); wg.addColorStop(0.5, '#0a2438'); wg.addColorStop(1, '#061522');
  x.fillStyle = wg; x.fillRect(0, 0, W0, H0);
  x.strokeStyle = 'rgba(120,190,255,0.05)'; x.lineWidth = 1;
  for (let y = 0; y < H0; y += 9) { x.beginPath(); for (let i = 0; i <= W0; i += 12) x.lineTo(i, y + Math.sin(i * 0.05 + y * 0.3) * 2); x.stroke(); }

  // ---- land ----
  const landTop = MZ(-HALF - CELL - 4);
  x.fillStyle = '#15171d'; x.fillRect(0, landTop, W0, H0 - landTop);
  // shoreline glow
  const sg = x.createLinearGradient(0, landTop - 14, 0, landTop + 4); sg.addColorStop(0, 'rgba(80,170,255,0)'); sg.addColorStop(1, 'rgba(80,170,255,0.18)');
  x.fillStyle = sg; x.fillRect(0, landTop - 14, W0, 18);

  // ---- streets under everything else: casing, then asphalt, then a centre line ----
  const vRoad = (cx: number, z0: number, len: number, w: number) => { x.fillRect(MX(cx - w / 2), MZ(z0), w, len); };
  const hRoad = (cz: number, x0: number, len: number, w: number) => { x.fillRect(MX(x0), MZ(cz - w / 2), len, w); };
  const gx0 = roadLine(I0), gx1 = roadLine(I1), gz0 = -HALF, len = N * CELL;
  x.fillStyle = '#0c0d11';
  for (let i = I0; i <= I1; i++) vRoad(roadLine(i), gz0 - ROAD, len + ROAD * 2, ROAD + 3);
  for (let j = 0; j <= N; j++) hRoad(roadLine(j), gx0 - ROAD, gx1 - gx0 + ROAD * 2, ROAD + 3);
  x.fillStyle = '#3b4252';
  for (let i = I0; i <= I1; i++) vRoad(roadLine(i), gz0 - ROAD / 2, len + ROAD, ROAD);
  for (let j = 0; j <= N; j++) hRoad(roadLine(j), gx0 - ROAD / 2, gx1 - gx0 + ROAD, ROAD);
  x.strokeStyle = 'rgba(255,213,79,0.28)'; x.lineWidth = 0.8; x.setLineDash([5, 6]);
  for (let i = I0; i <= I1; i++) { x.beginPath(); x.moveTo(MX(roadLine(i)), MZ(gz0)); x.lineTo(MX(roadLine(i)), MZ(gz0 + len)); x.stroke(); }
  for (let j = 0; j <= N; j++) { x.beginPath(); x.moveTo(MX(gx0), MZ(roadLine(j))); x.lineTo(MX(gx1), MZ(roadLine(j))); x.stroke(); }
  x.setLineDash([]);

  // ---- the other mapped shapes (bridge, Lagos Island, UNILAG, stadium, rails) ----
  const ROADC = new Set(['#5d6170', '#6d7180', '#70758a']);
  const rects = world.mapRects || [];
  const areas = rects.filter(r => !ROADC.has(r.color) && r.color !== '#3a3e4a');
  const roads = rects.filter(r => ROADC.has(r.color));
  const bldgs = rects.filter(r => r.color === '#3a3e4a');
  for (const r of areas) {
    const green = /^#2[e-f]3f|^#3d5a/.test(r.color) || r.color === '#2e3f25';
    x.fillStyle = green ? '#16301f' : r.color === '#2c2e36' ? '#1b1d24' : shade(r.color, -0.15);
    x.fillRect(MX(r.x0), MZ(r.z0), r.x1 - r.x0, r.z1 - r.z0);
  }
  for (const r of roads) { x.fillStyle = '#0c0d11'; x.fillRect(MX(r.x0) - 1.5, MZ(r.z0) - 1.5, r.x1 - r.x0 + 3, r.z1 - r.z0 + 3); }
  for (const r of roads) {
    const bridge = r.color !== '#5d6170';
    x.fillStyle = bridge ? '#4a5268' : '#3b4252'; x.fillRect(MX(r.x0), MZ(r.z0), r.x1 - r.x0, r.z1 - r.z0);
    if (bridge) { x.fillStyle = 'rgba(255,213,79,0.22)'; const w = r.x1 - r.x0, h = r.z1 - r.z0; if (h > w) x.fillRect(MX((r.x0 + r.x1) / 2) - 0.5, MZ(r.z0), 1, h); else x.fillRect(MX(r.x0), MZ((r.z0 + r.z1) / 2) - 0.5, w, 1); }
  }
  for (const r of bldgs) building(r.x0, r.z0, r.x1, r.z1, [150, 150, 175], 1);

  // ---- city blocks: split into building footprints ----
  for (const b of world.blocks) {
    const special = { market: '#6b5328', tejuosho: '#6b5328', ladipo: '#4b3d33', hospital: '#3e4c5e', motorpark: '#4d3b26', pitch: null, ring: null }[b.type];
    if (b.type === 'pitch') { // a football pitch: stripes and lines
      x.fillStyle = '#1d4a2a'; x.fillRect(MX(b.x0), MZ(b.z0), b.x1 - b.x0, b.z1 - b.z0);
      x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < b.x1 - b.x0; i += 8) x.fillRect(MX(b.x0) + i, MZ(b.z0), 4, b.z1 - b.z0);
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 0.8; x.strokeRect(MX(b.x0) + 4, MZ(b.z0) + 4, b.x1 - b.x0 - 8, b.z1 - b.z0 - 8);
      continue;
    }
    if (b.type === 'ring') { x.fillStyle = '#1b1d24'; x.fillRect(MX(b.x0), MZ(b.z0), b.x1 - b.x0, b.z1 - b.z0); continue; }
    // sidewalk ring around the block
    x.fillStyle = '#262a33'; x.fillRect(MX(b.x0), MZ(b.z0), b.x1 - b.x0, b.z1 - b.z0);
    if (special) { building(b.x0 + 3, b.z0 + 3, b.x1 - 3, b.z1 - 3, hexRgb(special), 1.1); continue; }
    const R = rng(Math.round(b.x0 * 7 + b.z0 * 13)), tint = DISTRICT_TINT(b);
    const pad = 3.5, X0 = b.x0 + pad, Z0 = b.z0 + pad, X1 = b.x1 - pad, Z1 = b.z1 - pad;
    // a ring of lots facing the streets, a courtyard in the middle
    const depth = Math.min(16, (X1 - X0) * 0.32);
    const lots = (ax0, az0, ax1, az1, alongX) => {
      let p = alongX ? ax0 : az0; const end = alongX ? ax1 : az1;
      while (p < end - 2) { const w = Math.min(end - p, 6 + R() * 10); if (alongX) building(p, az0, p + w - 1, az1, tint, 0.8 + R() * 0.5); else building(ax0, p, ax1, p + w - 1, tint, 0.8 + R() * 0.5); p += w; }
    };
    lots(X0, Z0, X1, Z0 + depth, true); lots(X0, Z1 - depth, X1, Z1, true);
    lots(X0, Z0 + depth + 1, X0 + depth, Z1 - depth - 1, false); lots(X1 - depth, Z0 + depth + 1, X1, Z1 - depth - 1, false);
    if (R() < 0.35) { x.fillStyle = '#15301d'; x.fillRect(MX(X0 + depth + 2), MZ(Z0 + depth + 2), X1 - X0 - depth * 2 - 4, Z1 - Z0 - depth * 2 - 4); } // a yard with trees
  }

  // a footprint with height: shadow down-right, a lit roof, a bright top edge
  function building(x0: number, z0: number, x1: number, z1: number, tint: number[], h: number) {
    const w = x1 - x0, d = z1 - z0; if (w < 1 || d < 1) return;
    const off = 1.6 * h;
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(MX(x0) + off, MZ(z0) + off, w, d);
    const k = 0.16 + 0.1 * h;
    x.fillStyle = `rgb(${Math.round(30 + tint[0] * k)},${Math.round(32 + tint[1] * k)},${Math.round(40 + tint[2] * k)})`;
    x.fillRect(MX(x0), MZ(z0), w, d);
    x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(MX(x0), MZ(z0), w, 0.8); x.fillRect(MX(x0), MZ(z0), 0.8, d);
  }
  return c;
}

function hexRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v * 1.6); }
function shade(h: string, k: number) { const [r, g, b] = hexRgb(h).map(v => v / 1.6); const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
