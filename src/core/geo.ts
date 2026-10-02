// Geometry helpers: everything static in the city is baked into a few big merged meshes.
//   GeoBuilder – hand-built quads/boxes with world-space UVs (building walls, roads, sidewalks)
//   PrimBatch  – transformed three.js primitives with a baked vertex colour (props, poles, vehicles)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FACES = [
  // normal, u axis, v axis  (u x v = n, so corners c-u-v, c+u-v, c+u+v, c-u+v are CCW from outside)
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
];

export class GeoBuilder {
  [key: string]: any; // TODO(ts): declare fields
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }

  // c: centre, u/v: half-extent vectors, uvRect: [u0, v0, u1, v1]
  face(c, u, v, n, uvRect, color) {
    const b = this.pos.length / 3;
    const pts: any[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [a, bb] of pts) this.pos.push(c[0] + u[0] * a + v[0] * bb, c[1] + u[1] * a + v[1] * bb, c[2] + u[2] * a + v[2] * bb);
    const [u0, v0, u1, v1] = uvRect || [0, 0, 1, 1];
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let i = 0; i < 4; i++) { this.nor.push(n[0], n[1], n[2]); this.col.push(color.r, color.g, color.b); }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  // Axis-aligned box. opts.uvScale [su, sv] maps world metres to texture units on the side faces
  // (v measured from opts.vBase); opts.uvOff [ou, ov]; opts.faces: subset of 'px nx pz nz py ny'.
  box(x0, y0, z0, x1, y1, z1, color, opts: any = {}) {
    const names = ['px', 'nx', 'pz', 'nz', 'py', 'ny'];
    const want = opts.faces || 'px nx pz nz py';
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2, hy = (y1 - y0) / 2, hz = (z1 - z0) / 2;
    const [su, sv] = opts.uvScale || [1, 1];
    const [ou, ov] = opts.uvOff || [0, 0];
    const vBase = opts.vBase ?? y0;
    FACES.forEach((f, i) => {
      if (!want.includes(names[i])) return;
      const n = f.n;
      const c: any = [cx + n[0] * hx, cy + n[1] * hy, cz + n[2] * hz];
      const ext = a => Math.abs(a[0]) * hx + Math.abs(a[1]) * hy + Math.abs(a[2]) * hz;
      const eu = ext(f.u), ev = ext(f.v);
      const u = f.u.map(k => k * eu), v = f.v.map(k => k * ev);
      let uvRect;
      if (i < 4) uvRect = [ou, ov + (y0 - vBase) / sv, ou + (2 * eu) / su, ov + (y1 - vBase) / sv];
      else uvRect = [(cx - hx) / su, (cz - hz) / su, (cx + hx) / su, (cz + hz) / su];
      this.face(c, u, v, n, uvRect, opts.topColor && i === 4 ? opts.topColor : color);
    });
  }

  // flat horizontal quad (normal up) with world-space UVs scaled by s (or explicit rect)
  flat(x0, z0, x1, z1, y, color, s = 1, uvRect?: number[]) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    this.face([cx, y, cz], [hx, 0, 0], [0, 0, -hz], [0, 1, 0], uvRect || [x0 / s, -z1 / s, x1 / s, -z0 / s], color);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export class PrimBatch {
  [key: string]: any; // TODO(ts): declare fields
  constructor() { this.geos = []; }
  // t: { p:[x,y,z], r:[rx,ry,rz] (euler XYZ) | ry, s:[sx,sy,sz] }
  add(geo, t, color) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    _e.set(t.r ? t.r[0] : 0, t.r ? t.r[1] : (t.ry || 0), t.r ? t.r[2] : 0);
    _q.setFromEuler(_e);
    _p.set(...((t.p || [0, 0, 0]) as [number, number, number]));
    _s.set(...((t.s || [1, 1, 1]) as [number, number, number]));
    _m.compose(_p, _q, _s);
    if (t.pre) _m.multiply(t.pre);
    if (t.post) _m.premultiply(t.post);
    g.applyMatrix4(_m);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    this.geos.push(g);
    return this;
  }
  box(w, h, d, t, color) { return this.add(BOX.clone().scale(w, h, d), t, color); }
  cyl(rt, rb, h, t, color, seg = 10) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), t, color); }
  sphere(r, t, color, ws = 10, hs = 8) { return this.add(new THREE.SphereGeometry(r, ws, hs), t, color); }
  get empty() { return this.geos.length === 0; }
  build() { const g = mergeGeometries(this.geos, false); g.computeBoundingSphere(); return g; }
}
const BOX = new THREE.BoxGeometry(1, 1, 1);

// a mesh from a PrimBatch with a vertex-coloured standard material
export function batchMesh(batch, matOpts: any = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, ...matOpts });
  return new THREE.Mesh(batch.build(), mat);
}
