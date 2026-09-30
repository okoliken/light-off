// City grid layout: a square of N x N blocks crossed by N+1 roads each way, plus one ring of
// outer blocks for the skyline. Roads run along x (constant z) and along z (constant x).
// Y is up, 1 unit = 1 metre. Nigeria drives on the right.

export const N = 6;            // playable blocks per side
export const ROAD = 12;        // carriageway width (2 lanes)
export const WALK = 3.5;       // sidewalk width (inside the block edge)
export const BLOCK = 60;       // block size including its sidewalks
export const CELL = BLOCK + ROAD;
export const HALF = (N * CELL) / 2;
export const LANE = 3;         // lane centre offset from the road centreline
export const CURB = 0.15;      // blocks sit this high above the road
export const INT = ROAD / 2 + 2; // how far from a node an intersection "box" extends for traffic curves
export const BOUND = HALF + ROAD / 2 + WALK - 0.4; // playable limit: the outer roads and their far sidewalks

export const roadLine = i => -HALF + i * CELL;

// local coordinate inside a cell, 0..CELL, where 0 is a road centreline
const cellLocal = v => (((v + HALF) % CELL) + CELL) % CELL;

export function onRoadX(x) { const l = cellLocal(x); return l < ROAD / 2 || l > CELL - ROAD / 2; }
export function isRoad(x, z) { return z < -HALF - ROAD / 2 || z > HALF + ROAD / 2 || onRoadX(x) || onRoadX(z); } // outside the district (bridge, stadium grounds) the ground is flat // north of the district everything is road-level ground

// Third Mainland Bridge: leaves the district north along x = 0, crosses the lagoon, lands at UNILAG
export const BRIDGE = { x: 0, z0: -HALF - CELL - 2, rampLen: 46, deckY: 9, z1: -1140, half: 8 };
BRIDGE.deck0 = BRIDGE.z0 - BRIDGE.rampLen;          // top of the district-side ramp
BRIDGE.deck1 = BRIDGE.z1 + BRIDGE.rampLen;          // top of the UNILAG-side ramp
export const CAMPUS = { x0: -170, x1: 170, z0: -1420, z1: BRIDGE.z1 };

// playable regions (axis-aligned); anything outside gets pushed back to the nearest one
export const REGIONS = [
  { x0: -BOUND, x1: BOUND, z0: -BOUND, z1: BOUND },                                     // the district
  { x0: -ROAD / 2 + 0.4, x1: ROAD / 2 - 0.4, z0: BRIDGE.z0 - 1, z1: -BOUND + 1 },        // approach road through the ring
  { x0: -BRIDGE.half + 0.9, x1: BRIDGE.half - 0.9, z0: BRIDGE.z1 - 1, z1: BRIDGE.z0 + 1 }, // the bridge
  { x0: CAMPUS.x0 + 4, x1: CAMPUS.x1 - 4, z0: CAMPUS.z0 + 4, z1: CAMPUS.z1 },             // UNILAG
];
export function clampToRegions(pos) {
  let best = null, bd = Infinity;
  for (const r of REGIONS) {
    const x = Math.max(r.x0, Math.min(r.x1, pos.x)), z = Math.max(r.z0, Math.min(r.z1, pos.z));
    const d = (x - pos.x) ** 2 + (z - pos.z) ** 2;
    if (d === 0) return false;
    if (d < bd) { bd = d; best = [x, z]; }
  }
  pos.x = best[0]; pos.z = best[1];
  return true;
}

// block index containing v (can be -1 or N for the ring)
export const blockIndex = v => Math.floor((v + HALF) / CELL);
export function blockRect(bi, bj) {
  return {
    x0: roadLine(bi) + ROAD / 2, x1: roadLine(bi + 1) - ROAD / 2,
    z0: roadLine(bj) + ROAD / 2, z1: roadLine(bj + 1) - ROAD / 2,
  };
}

// nearest road node (intersection) indices
export function nearestNode(x, z) {
  const c = v => Math.max(0, Math.min(N, Math.round((v + HALF) / CELL)));
  return [c(x), c(z)];
}
export const nodePos = (i, j) => [roadLine(i), roadLine(j)];

// Special blocks
export const SPECIAL = {
  '2,3': 'market',
  '3,2': 'motorpark',
  '4,4': 'pitch',
  '1,1': 'home',
};
export const blockType = (bi, bj) => (bi < 0 || bj < 0 || bi >= N || bj >= N) ? 'ring' : (SPECIAL[bi + ',' + bj] || 'regular');

// seeded RNG so the city is the same every run
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
