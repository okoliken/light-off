// Static collision: axis-aligned boxes in a spatial hash, plus ramps and the base ground height.
import { CURB, isRoad } from './layout.js';

export const STEP = 0.45; // max height you can walk / roll up without jumping

export class Solids {
  constructor(cell = 12) { this.cell = cell; this.map = new Map(); this.list = []; this.q = 0; }
  key(ix, iz) { return (ix + 2048) * 4096 + (iz + 2048); }
  add(minx, miny, minz, maxx, maxy, maxz, kind = 'wall', extra) {
    const s = { minx, miny, minz, maxx, maxy, maxz, kind, _q: 0, ...extra };
    this.list.push(s);
    const c = this.cell;
    for (let ix = Math.floor(minx / c); ix <= Math.floor(maxx / c); ix++)
      for (let iz = Math.floor(minz / c); iz <= Math.floor(maxz / c); iz++) {
        const k = this.key(ix, iz);
        let a = this.map.get(k); if (!a) this.map.set(k, (a = []));
        a.push(s);
      }
    return s;
  }
  query(minx, minz, maxx, maxz, out = []) {
    out.length = 0;
    const q = ++this.q, c = this.cell;
    for (let ix = Math.floor(minx / c); ix <= Math.floor(maxx / c); ix++)
      for (let iz = Math.floor(minz / c); iz <= Math.floor(maxz / c); iz++) {
        const a = this.map.get(this.key(ix, iz)); if (!a) continue;
        for (const s of a) if (s._q !== q) { s._q = q; if (s.maxx >= minx && s.minx <= maxx && s.maxz >= minz && s.minz <= maxz) out.push(s); }
      }
    return out;
  }
}

const _cand = [];

export class Collision {
  constructor() { this.solids = new Solids(); this.ramps = []; this.fields = []; } // fields: (x, z) => height | null (stadium stands)

  // ground under (x,z) for something whose feet are at feetY: highest surface at or below feetY + STEP
  groundHeight(x, z, feetY, r = 0.22) {
    let h = isRoad(x, z) ? 0 : CURB, top = null;
    for (const s of this.solids.query(x - r, z - r, x + r, z + r, _cand)) {
      if (x < s.minx - r || x > s.maxx + r || z < s.minz - r || z > s.maxz + r) continue;
      if (s.maxy <= feetY + STEP && s.maxy > h) { h = s.maxy; top = s; }
    }
    for (const rp of this.ramps) {
      if (x < rp.x0 || x > rp.x1 || z < rp.z0 || z > rp.z1) continue;
      let t = rp.axis === 'x' ? (x - rp.x0) / (rp.x1 - rp.x0) : (z - rp.z0) / (rp.z1 - rp.z0);
      if (rp.sign < 0) t = 1 - t;
      const y = rp.base + rp.h * t;
      if (y <= feetY + STEP + 0.3 && y > h) { h = y; top = rp; }
    }
    for (const f of this.fields) { const y = f(x, z); if (y != null && y <= feetY + STEP + 0.05 && y > h) { h = y; top = f; } }
    return { h, top };
  }

  // push a vertical cylinder (feet at feetY) out of boxes; returns contacts [{s, nx, nz}]
  resolve(pos, feetY, r, height, contacts = []) {
    contacts.length = 0;
    for (const s of this.solids.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, _cand)) {
      if (s.maxy <= feetY + STEP || s.miny >= feetY + height) continue;
      const cx = Math.max(s.minx, Math.min(pos.x, s.maxx)), cz = Math.max(s.minz, Math.min(pos.z, s.maxz));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let nx, nz, push;
      if (d2 < 1e-9) { // centre inside the box: leave by the nearest side
        const pen = [pos.x - s.minx, s.maxx - pos.x, pos.z - s.minz, s.maxz - pos.z];
        const i = pen.indexOf(Math.min(...pen));
        nx = i === 0 ? -1 : i === 1 ? 1 : 0; nz = i === 2 ? -1 : i === 3 ? 1 : 0;
        push = pen[i] + r;
      } else { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; push = r - d; }
      pos.x += nx * push; pos.z += nz * push;
      contacts.push({ s, nx, nz });
    }
    return contacts;
  }

  // segment a->b (3D) blocked by any box? (line of sight)
  blocked(ax, ay, az, bx, by, bz, minH = 2) {
    const cand = this.solids.query(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), []);
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    for (const s of cand) {
      if (s.maxy - s.miny < minH) continue;
      let t0 = 0, t1 = 1, ok = true;
      for (const [o, d, mn, mx] of [[ax, dx, s.minx, s.maxx], [ay, dy, s.miny, s.maxy], [az, dz, s.minz, s.maxz]]) {
        if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } continue; }
        let ta = (mn - o) / d, tb = (mx - o) / d; if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  // distance along a ray until it hits a box (camera collision). returns t in [0, maxT]
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    const ex = ox + dx * maxT, ez = oz + dz * maxT;
    const cand = this.solids.query(Math.min(ox, ex) - 0.5, Math.min(oz, ez) - 0.5, Math.max(ox, ex) + 0.5, Math.max(oz, ez) + 0.5, []);
    let best = maxT;
    for (const s of cand) {
      let t0 = 0, t1 = best, ok = true;
      for (const [o, d, mn, mx] of [[ox, dx, s.minx, s.maxx], [oy, dy, s.miny, s.maxy], [oz, dz, s.minz, s.maxz]]) {
        if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } continue; }
        let ta = (mn - o) / d, tb = (mx - o) / d; if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }
}
