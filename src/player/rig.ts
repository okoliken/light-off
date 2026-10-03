// Procedural character rig: a bone hierarchy of pivots with primitive meshes, posed every frame by
// small pose functions (run, skate, grind, climb, punch...) and smoothed toward the target pose.
// The character faces +z. Rotation conventions (radians):
//   thigh/shoulder x < 0 swings the limb forward, knee x > 0 bends back, elbow x < 0 bends forward,
//   spine/chest/head x > 0 leans forward, left limbs abduct with +z, right limbs with -z.
import * as THREE from 'three';
import { ankaraTexture } from '../core/textures.ts';

const KEYS = ['hipsY', 'hipsRX', 'hipsRY', 'hipsRZ', 'spineX', 'spineY', 'chestX', 'chestY', 'chestZ', 'neckX', 'headX', 'headY',
  'shLX', 'shLZ', 'elLX', 'shRX', 'shRZ', 'elRX', 'thLX', 'thLZ', 'knLX', 'ftLX', 'thRX', 'thRZ', 'knRX', 'ftRX', 'thLY', 'thRY'];
export const HIP_H = 0.95;

function cloth(color, sheen = '#56637f') {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.92, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(sheen) });
}

export const OUTFITS = {
  // his everyday clothes: faded tee, shorts, bathroom slippers
  bolajiDay: { scale: 1.04, skin: '#5b3a26', top: '#e65100', bottom: '#2b2f36', sock: '#2b2f36', sole: '#1f1f22', glove: null, hood: false, shorts: false, cap: '#e65100', boardOnBack: false, sheen: '#886655' }, // a grown man in his SwiftDrop rider shirt and cap
  bolaji: { scale: 1.04, skin: '#5b3a26', top: '#17181c', bottom: '#141518', sock: '#111113', sole: '#2b2b2e', glove: '#0d0d0f', hood: true, shorts: true, boardOnBack: true, sheen: '#6a7898', cat: true },
  agbero: { skin: '#4a2e1f', top: '#2e7d32', bottom: '#263238', sock: '#4e342e', sole: '#3e2723', glove: null, hood: false, shorts: false, singlet: true, cap: '#b71c1c', scale: 1.08, sheen: '#445544' },
  agbero2: { skin: '#3f2618', top: '#f9a825', bottom: '#1a1a1a', sock: '#3e2723', sole: '#2b2b2b', glove: null, hood: false, shorts: false, singlet: true, cap: null, scale: 1.1, sheen: '#665533' },
  // the Red Caps: an agbero cult. Red berets, black clothes, red bandanas
  redcap: { skin: '#3f2618', top: '#141414', bottom: '#1b1b1b', sock: '#2b2b2b', sole: '#1a1a1a', glove: null, hood: false, shorts: false, singlet: true, beret: '#b71c1c', mask: 'bandana', scale: 1.05, sheen: '#553333' },
  redcap2: { skin: '#4a2e1f', top: '#8e1b1b', bottom: '#1f1f1f', sock: '#2b2b2b', sole: '#1a1a1a', glove: null, hood: false, shorts: false, beret: '#b71c1c', scale: 1.04, sheen: '#664444' },
  brute: { skin: '#352016', top: '#1b1b1b', bottom: '#263238', sock: '#2b2b2b', sole: '#1a1a1a', glove: null, hood: false, shorts: false, singlet: true, beret: '#b71c1c', scale: 1.28, sheen: '#443333' },
  scorpion: { skin: '#3a2317', top: '#b71c1c', bottom: '#111111', sock: '#111', sole: '#0a0a0a', glove: '#111', hood: false, shorts: false, beret: '#111111', mask: 'bandana', scale: 1.12, sheen: '#884444' },
  hawker: { skin: '#3f2618', top: '#00897b', bottom: '#37474f', sock: '#3e2723', sole: '#2b2b2b', glove: null, hood: false, shorts: false, tray: true, scale: 1.02, sheen: '#557766' },
  impostor: { skin: '#3f2618', top: '#1d1e22', bottom: '#1b1b1b', sock: '#222', sole: '#111', glove: null, hood: true, shorts: false, mask: 'bandana', scale: 1.06, sheen: '#555' }, // a cheap copy: hood but no ears, a red rag for a mask
  blade: { skin: '#3a2317', top: '#1c1d22', bottom: '#15161a', sock: '#111', sole: '#0a0a0a', glove: '#111', hood: false, shorts: false, mask: 'bandana', sash: true, scale: 1.0, sheen: '#444a58' },
  egungun: { skin: '#2a1a12', top: '#7b1fa2', bottom: '#1b1b1b', sock: '#111', sole: '#0a0a0a', glove: '#3e2723', hood: false, shorts: false, egungun: true, scale: 1.02, sheen: '#664477' },
  chairman: { skin: '#3a2317', top: '#ddd6c8', bottom: '#d6cfc0', sock: '#222', sole: '#5d4037', glove: null, hood: false, shorts: false, cap: '#b71c1c', scale: 1.14, sheen: '#aaaaaa' },
  elder: { skin: '#4a2e1f', top: '#d7ccc8', bottom: '#5d4037', sock: '#3e2723', sole: '#2b2b2b', glove: null, hood: false, shorts: false, cap: '#5d4037', sheen: '#888877' },
  police: { skin: '#4a2e1f', top: '#13161c', bottom: '#13161c', sock: '#0a0a0a', sole: '#050505', glove: null, hood: false, shorts: false, beret: '#0b0b0b', gun: true, scale: 1.05, sheen: '#3a4458', badge: true },
  thief: { skin: '#3f2618', top: '#4e342e', bottom: '#1f2a36', sock: '#2b2b2b', sole: '#1a1a1a', glove: null, hood: false, shorts: false, mask: 'bandana', gun: true, scale: 1.02, sheen: '#554444' },
};

export class Rig {
  [key: string]: any; // TODO(ts): declare fields
  constructor(outfit: any = OUTFITS.bolaji) {
    this.o = outfit;
    this.root = new THREE.Group();           // at the feet, yaw = facing
    this.body = new THREE.Group();           // lean / extra rotations
    this.root.add(this.body);
    const P = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const b: any = this.b = {};
    b.hips = P(this.body, 0, HIP_H, 0);
    b.spine = P(b.hips, 0, 0.08, 0);
    b.chest = P(b.spine, 0, 0.22, 0);
    b.neck = P(b.chest, 0, 0.3, 0);
    b.head = P(b.neck, 0, 0.09, 0);
    b.shL = P(b.chest, 0.2, 0.25, 0); b.elL = P(b.shL, 0, -0.29, 0); b.haL = P(b.elL, 0, -0.26, 0);
    b.shR = P(b.chest, -0.2, 0.25, 0); b.elR = P(b.shR, 0, -0.29, 0); b.haR = P(b.elR, 0, -0.26, 0);
    b.thL = P(b.hips, 0.1, -0.04, 0); b.knL = P(b.thL, 0, -0.44, 0); b.ftL = P(b.knL, 0, -0.44, 0);
    b.thR = P(b.hips, -0.1, -0.04, 0); b.knR = P(b.thR, 0, -0.44, 0); b.ftR = P(b.knR, 0, -0.44, 0);
    this.build();
    if (outfit.scale) this.root.scale.setScalar(outfit.scale);
    this.t = {}; this.c = {};
    for (const k of KEYS) { this.t[k] = 0; this.c[k] = 0; }
    this.t.hipsY = this.c.hipsY = HIP_H;
  }

  build() {
    const o = this.o, b = this.b;
    const skin = new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.55 });
    const top = cloth(o.top, o.sheen), bottom = cloth(o.bottom, o.sheen), sock = cloth(o.sock, o.sheen);
    const sole = new THREE.MeshStandardMaterial({ color: o.sole, roughness: 0.8 });
    const glove = o.glove ? new THREE.MeshStandardMaterial({ color: o.glove, roughness: 0.6 }) : skin;
    const meshes: any[] = [];
    const M = (geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
      m.castShadow = true; parent.add(m); meshes.push(m); return m;
    };
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
    // pelvis + torso: broader shoulders, a narrower waist
    M(cap(0.14, 0.08), bottom, b.hips, 0, -0.02, 0, 1.22, 1, 0.85);
    M(cap(0.135, 0.16), top, b.spine, 0, 0.1, 0, 1.12, 1, 0.78);
    M(cap(0.16, 0.18), top, b.chest, 0, 0.12, 0, 1.2, 1, 0.76);
    M(cap(0.085, 0.3), top, b.chest, 0, 0.25, 0, 1, 1, 0.9, 0, 0, Math.PI / 2); // shoulder line
    if (o.hood) {
      M(new THREE.BoxGeometry(0.26, 0.13, 0.03), cloth('#1f2126', o.sheen), b.spine, 0, 0.06, 0.12); // kangaroo pocket
      const str = new THREE.MeshStandardMaterial({ color: '#d8d8d8', roughness: 0.6 });
      M(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), str, b.chest, 0.04, 0.2, 0.125); M(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 4), str, b.chest, -0.04, 0.19, 0.125);
    }
    if (o.singlet) { M(cap(0.05, 0.05), skin, b.chest, 0.12, 0.3, 0, 1, 1, 1); M(cap(0.05, 0.05), skin, b.chest, -0.12, 0.3, 0, 1, 1, 1); }
    // neck + head: skull, jaw, ears, nose, lips, brows, eyes, hair
    M(new THREE.CylinderGeometry(0.048, 0.056, 0.11, 10), skin, b.neck, 0, 0.02, 0);
    M(new THREE.SphereGeometry(0.1, 18, 14), skin, b.head, 0, 0.115, 0.005, 0.9, 1.05, 1.02);            // cranium
    M(new THREE.SphereGeometry(0.085, 16, 12), skin, b.head, 0, 0.065, 0.028, 0.88, 0.85, 0.9);          // jaw / cheeks
    for (const sx of [1, -1]) M(new THREE.SphereGeometry(0.022, 8, 6), skin, b.head, sx * 0.087, 0.105, 0.0, 0.55, 1, 0.9); // ears
    const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.skin).multiplyScalar(0.62), roughness: 0.6 });
    M(new THREE.SphereGeometry(0.02, 8, 6), skin, b.head, 0, 0.09, 0.104, 1.2, 0.9, 1.1);                // nose
    M(new THREE.BoxGeometry(0.045, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: new THREE.Color(o.skin).multiplyScalar(0.5), roughness: 0.5 }), b.head, 0, 0.052, 0.1); // lips
    for (const sx of [1, -1]) M(new THREE.BoxGeometry(0.03, 0.007, 0.008), dark, b.head, sx * 0.034, 0.138, 0.098, 1, 1, 1, 0, 0, sx * -0.12); // brows
    const eyeW = new THREE.MeshBasicMaterial({ color: '#e8e2d8' }), eyeP = new THREE.MeshBasicMaterial({ color: '#1a100a' });
    for (const sx of [1, -1]) { M(new THREE.SphereGeometry(0.012, 8, 6), eyeW, b.head, sx * 0.034, 0.118, 0.094, 1.2, 0.8, 0.6); M(new THREE.SphereGeometry(0.006, 6, 4), eyeP, b.head, sx * 0.034, 0.118, 0.101); }
    const hair = o.hair ?? (o.hood || o.cap || o.beret ? 'low' : 'low');
    const hairMat = new THREE.MeshStandardMaterial({ color: '#0e0b09', roughness: 1 });
    if (hair === 'low') M(new THREE.SphereGeometry(0.104, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, b.head, 0, 0.125, -0.004, 0.92, 1.0, 1.04); // low cut
    if (hair === 'braids') { M(new THREE.SphereGeometry(0.108, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat, b.head, 0, 0.12, -0.006, 0.94, 1.02, 1.06); M(new THREE.SphereGeometry(0.045, 8, 6), hairMat, b.head, 0, 0.2, -0.07); }
    if (o.hood) {
      M(new THREE.SphereGeometry(0.135, 16, 12), top, b.head, 0, 0.12, -0.025, 1.02, 1.1, 1.1);
      M(new THREE.TorusGeometry(0.096, 0.026, 8, 18), top, b.head, 0, 0.105, 0.075, 0.97, 1.16, 1.2);
      M(cap(0.125, 0.05), top, b.neck, 0, 0.0, -0.05, 1.3, 0.8, 1); // hood gathered at the neck
    }
    if (o.sash) { // the Patron's Blades: a red sash across the chest, a knife holster on the thigh
      M(new THREE.BoxGeometry(0.07, 0.62, 0.3), new THREE.MeshStandardMaterial({ color: '#b71c1c', roughness: 0.8 }), b.chest, 0, 0.08, 0.0, 1, 1, 1.2, 0, 0, 0.75);
      M(new THREE.BoxGeometry(0.06, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: '#2b2b2b' }), b.thR, 0.07, -0.12, 0.02);
    }
    if (o.tray) { // a hawker's tray on the head: pure water sachets and plantain chips (and a knife under it)
      M(new THREE.CylinderGeometry(0.28, 0.24, 0.05, 14), new THREE.MeshStandardMaterial({ color: '#b0bec5', roughness: 0.4, metalness: 0.5 }), b.head, 0, 0.25, 0);
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; M(new THREE.BoxGeometry(0.09, 0.05, 0.12), new THREE.MeshStandardMaterial({ color: k % 2 ? '#e3f2fd' : '#fdd835', roughness: 0.6 }), b.head, Math.sin(a) * 0.15, 0.3, Math.cos(a) * 0.15, 1, 1, 1, 0, a, 0); }
    }
    if (o.cat) { // the cat touches: stitched ears on the hood, a half mask with eye lenses that catch the light, claw-tipped gloves
      for (const sx of [1, -1]) {
        M(new THREE.ConeGeometry(0.036, 0.085, 4), top, b.head, sx * 0.07, 0.262, -0.015, 1, 1, 0.55, 0.12, sx * 0.4, sx * -0.38);
        M(new THREE.ConeGeometry(0.02, 0.05, 4), new THREE.MeshStandardMaterial({ color: '#2a2d35', roughness: 0.9 }), b.head, sx * 0.068, 0.255, 0.0, 1, 1, 0.4, 0.12, sx * 0.4, sx * -0.38);
      }
      M(new THREE.SphereGeometry(0.107, 16, 8, -Math.PI * 0.4, Math.PI * 0.8, Math.PI * 0.36, Math.PI * 0.16), new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.6 }), b.head, 0, 0.1, 0.015, 0.99, 1.1, 1.08);
      const lens = new THREE.MeshStandardMaterial({ color: '#3a2a08', emissive: '#ffb300', emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.5 });
      for (const sx of [1, -1]) M(new THREE.BoxGeometry(0.036, 0.013, 0.006), lens, b.head, sx * 0.034, 0.12, 0.119, 1, 1, 1, 0, 0, sx * 0.28);
      const claw = new THREE.MeshStandardMaterial({ color: '#5f6570', roughness: 0.35, metalness: 0.6 });
      for (const ha of [b.haL, b.haR]) for (const cx of [-0.022, 0, 0.022]) M(new THREE.ConeGeometry(0.006, 0.03, 4), claw, ha, cx, -0.095, 0.028, 1, 1, 1, Math.PI, 0, 0);
    }
    if (o.cap) { M(new THREE.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: o.cap, roughness: 0.8 }), b.head, 0, 0.14, 0.01, 1.05, 0.9, 1.05); M(new THREE.TorusGeometry(0.1, 0.03, 6, 16), new THREE.MeshStandardMaterial({ color: o.cap, roughness: 0.8 }), b.head, 0, 0.2, 0, 1, 1, 0.6, Math.PI / 2, 0, 0.3); } // gele / headtie
    // arms
    for (const [sh, el, ha] of <any[]>[[b.shL, b.elL, b.haL], [b.shR, b.elR, b.haR]]) {
      M(cap(o.singlet ? 0.052 : 0.062, 0.2), o.singlet ? skin : top, sh, 0, -0.14, 0);
      M(cap(o.singlet ? 0.046 : 0.055, 0.2), o.singlet ? skin : top, el, 0, -0.13, 0);
      M(new THREE.SphereGeometry(0.052, 10, 8), glove, ha, 0, -0.03, 0.005, 0.9, 1.15, 0.7);
    }
    // legs
    for (const [th, kn, ft] of <any[]>[[b.thL, b.knL, b.ftL], [b.thR, b.knR, b.ftR]]) {
      if (o.shorts) { M(cap(0.088, 0.2), bottom, th, 0, -0.14, 0); M(cap(0.064, 0.14), skin, th, 0, -0.34, 0.005); }
      else M(cap(0.08, 0.34), bottom, th, 0, -0.22, 0);
      if (o.shorts) { M(cap(0.058, 0.16), skin, kn, 0, -0.12, 0); M(cap(0.056, 0.16), sock, kn, 0, -0.32, 0); }
      else M(cap(0.066, 0.34), bottom, kn, 0, -0.22, 0);
      M(new THREE.BoxGeometry(0.1, 0.075, 0.25), sock, ft, 0, -0.025, 0.06);
      M(new THREE.BoxGeometry(0.105, 0.022, 0.26), sole, ft, 0, -0.065, 0.06);
    }
    // skateboard strapped on his back
    if (o.boardOnBack) {
      const g = new THREE.Group(); g.position.set(0, 0.1, -0.2); g.rotation.set(0.1, 0, 0.42); b.chest.add(g);
      this.backBoard = g;
      const deck = makeBoardMesh();
      deck.rotation.set(Math.PI / 2, 0, 0); deck.position.y = 0.05; deck.scale.setScalar(0.95);
      g.add(deck);
      M(new THREE.BoxGeometry(0.035, 0.62, 0.012), cloth('#2a2c33', o.sheen), b.chest, 0, 0.12, 0.13, 1, 1, 1, 0, 0, 0.6); // strap across the chest
    }
    if (o.strips) { // reflective strips: dull until the flash lights them up
      const sm = this.stripMat = new THREE.MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.3, metalness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.06 });
      M(new THREE.BoxGeometry(0.34, 0.025, 0.2), sm, b.chest, 0, 0.2, 0.02, 1, 1, 1.1);
      for (const sh of [b.shL, b.shR]) M(new THREE.CylinderGeometry(0.066, 0.066, 0.03, 10), sm, sh, 0, -0.2, 0);
      for (const th of [b.thL, b.thR]) M(new THREE.CylinderGeometry(0.092, 0.092, 0.03, 10), sm, th, 0, -0.2, 0);
      M(new THREE.BoxGeometry(0.03, 0.4, 0.012), sm, b.chest, 0.08, 0.1, -0.13, 1, 1, 1, 0, 0, -0.3); M(new THREE.BoxGeometry(0.03, 0.4, 0.012), sm, b.chest, -0.08, 0.1, -0.13, 1, 1, 1, 0, 0, 0.3);
    }
    if (o.kneepads) { const kp = new THREE.MeshStandardMaterial({ color: o.kneepads, roughness: 0.95 }); for (const kn of [b.knL, b.knR]) M(new THREE.SphereGeometry(0.068, 10, 8), kp, kn, 0, 0.0, 0.035, 1, 1.2, 0.8); }
    if (o.mask === 'ankara') M(new THREE.SphereGeometry(0.112, 16, 10, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.5, Math.PI * 0.32), new THREE.MeshStandardMaterial({ map: ankaraTexture(), roughness: 0.8 }), b.head, 0, 0.1, 0.022, 0.96, 1.1, 1.06);
    if (o.mask === 'bandana') M(new THREE.SphereGeometry(0.112, 14, 10, -Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.5, Math.PI * 0.3), new THREE.MeshStandardMaterial({ color: '#b71c1c', roughness: 0.9 }), b.head, 0, 0.1, 0.02, 0.97, 1.1, 1.06);
    if (o.beret) M(new THREE.CylinderGeometry(0.12, 0.125, 0.05, 14), new THREE.MeshStandardMaterial({ color: o.beret, roughness: 0.9 }), b.head, 0.02, 0.21, 0, 1, 1, 1, 0, 0, -0.18);
    if (o.badge) M(new THREE.BoxGeometry(0.05, 0.06, 0.01), new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.8, roughness: 0.3 }), b.chest, 0.09, 0.2, 0.13);
    if (o.gun) { const gm = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.4, metalness: 0.7 }); M(new THREE.BoxGeometry(0.035, 0.2, 0.07), gm, b.haR, 0, -0.12, 0.02); M(new THREE.BoxGeometry(0.03, 0.04, 0.09), gm, b.haR, 0, -0.04, -0.03); this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, -0.23, 0.02); b.haR.add(this.muzzle); }
    if (o.weapon === 'stick') M(new THREE.CylinderGeometry(0.025, 0.035, 0.75, 6), new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.9 }), b.haR, 0, -0.3, 0.05);
    if (o.weapon === 'machete') { const bl = new THREE.MeshStandardMaterial({ color: '#b0b6bc', roughness: 0.25, metalness: 0.9 }); M(new THREE.BoxGeometry(0.02, 0.6, 0.07), bl, b.haR, 0, -0.38, 0.04); M(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 6), new THREE.MeshStandardMaterial({ color: '#3e2723' }), b.haR, 0, -0.05, 0.02); }
    if (o.weapon === 'knife') { M(new THREE.BoxGeometry(0.012, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: '#c9cfd4', roughness: 0.2, metalness: 0.95 }), b.haR, 0, -0.2, 0.05); M(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 6), new THREE.MeshStandardMaterial({ color: '#212121' }), b.haR, 0, -0.06, 0.02); }
    if (o.weapon === 'axe') {
      M(new THREE.CylinderGeometry(0.022, 0.026, 0.8, 6), new THREE.MeshStandardMaterial({ color: '#6d4c41', roughness: 0.9 }), b.haR, 0, -0.3, 0.03);
      M(new THREE.BoxGeometry(0.03, 0.16, 0.2), new THREE.MeshStandardMaterial({ color: '#8d9399', roughness: 0.35, metalness: 0.85 }), b.haR, 0, -0.62, 0.12);
    }
    if (o.egungun) { // the masquerade: layered cloth panels over the whole body, a netted face, a crown of strips
      const cols = ['#7b1fa2', '#c62828', '#f9a825', '#1565c0', '#2e7d32', '#e65100'];
      const cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide });
      M(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 1 }), b.head, 0, 0.09, 0.0, 1.02, 1.12, 1.08);
      M(new THREE.PlaneGeometry(0.13, 0.1), new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: 1, transparent: true, opacity: 0.9 }), b.head, 0, 0.1, 0.14);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; M(new THREE.PlaneGeometry(0.05, 0.28), cloth(cols[k % cols.length]), b.head, Math.sin(a) * 0.1, 0.26, Math.cos(a) * 0.1, 1, 1, 1, 0.35 * Math.cos(a), a, 0); }
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; M(new THREE.PlaneGeometry(0.1, 0.42), cloth(cols[k % cols.length]), b.chest, Math.sin(a) * 0.17, -0.02, Math.cos(a) * 0.13, 1, 1, 1, 0.12, a, 0); }
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; M(new THREE.PlaneGeometry(0.11, 0.5), cloth(cols[(k + 3) % cols.length]), b.hips, Math.sin(a) * 0.18, -0.26, Math.cos(a) * 0.15, 1, 1, 1, 0.1, a, 0); }
    }
    this.meshes = meshes;
  }

  rebuild(outfit) {
    for (const m of this.meshes) m.parent?.remove(m);
    for (const k of ['backBoard', 'muzzle']) { this[k]?.parent?.remove(this[k]); this[k] = null; }
    this.stripMat = null;
    this.o = outfit; this.build();
    this.root.scale.setScalar(outfit.scale || 1);
  }

  set(k, v) { this.t[k] = v; }
  reset() { for (const k of KEYS) this.t[k] = 0; this.t.hipsY = HIP_H; }

  update(dt, rate = 14) {
    const a = 1 - Math.exp(-rate * dt), t = this.t, c = this.c;
    // full-turn rotations (flips, rolls) must not unwind backwards afterwards
    for (const k of ['hipsRX', 'hipsRZ', 'hipsRY']) { const d = c[k] - t[k]; if (Math.abs(d) > Math.PI) c[k] -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); }
    for (const k of KEYS) c[k] += (t[k] - c[k]) * a;
    const b = this.b;
    b.hips.position.y = c.hipsY; b.hips.rotation.set(c.hipsRX, c.hipsRY, c.hipsRZ);
    b.spine.rotation.set(c.spineX, c.spineY, 0); b.chest.rotation.set(c.chestX, c.chestY, c.chestZ);
    b.neck.rotation.x = c.neckX; b.head.rotation.set(c.headX, c.headY, 0);
    b.shL.rotation.set(c.shLX, 0, c.shLZ); b.elL.rotation.x = c.elLX;
    b.shR.rotation.set(c.shRX, 0, c.shRZ); b.elR.rotation.x = c.elRX;
    b.thL.rotation.set(c.thLX, c.thLY, c.thLZ); b.knL.rotation.x = c.knLX; b.ftL.rotation.x = c.ftLX;
    b.thR.rotation.set(c.thRX, c.thRY, c.thRZ); b.knR.rotation.x = c.knRX; b.ftR.rotation.x = c.ftRX;
  }
  snap() { for (const k of KEYS) this.c[k] = this.t[k]; }
}

// ---------- pose library (write targets into rig.t) ----------
export const Pose = {
  idle(r, time, guard = false) {
    r.reset();
    const br = Math.sin(time * 1.8) * 0.02;
    r.set('chestX', br); r.set('shLZ', 0.1); r.set('shRZ', -0.1); r.set('elLX', -0.2); r.set('elRX', -0.2);
    r.set('thLZ', 0.04); r.set('thRZ', -0.04); r.set('headX', -br);
    if (guard) {
      r.set('hipsY', HIP_H - 0.06); r.set('thLX', -0.25); r.set('knLX', 0.35); r.set('thRX', 0.1); r.set('knRX', 0.25);
      r.set('shLX', -0.95); r.set('elLX', -1.9); r.set('shRX', -0.7); r.set('elRX', -2.0); r.set('shLZ', 0.2); r.set('shRZ', -0.2);
      r.set('spineX', 0.12); r.set('chestY', 0.25);
    }
  },
  run(r, p, s) { // s: 0..1 speed factor (walk -> sprint)
    r.reset();
    const A = 0.35 + 0.55 * s, sn = Math.sin(p), cs = Math.cos(p);
    r.set('thLX', -sn * A); r.set('thRX', sn * A);
    r.set('knLX', 0.15 + Math.max(0, cs) * (0.5 + 1.2 * s)); r.set('knRX', 0.15 + Math.max(0, -cs) * (0.5 + 1.2 * s));
    r.set('ftLX', 0.2 * sn); r.set('ftRX', -0.2 * sn);
    r.set('shLX', sn * (0.3 + 0.6 * s)); r.set('shRX', -sn * (0.3 + 0.6 * s));
    r.set('elLX', -0.5 - 0.8 * s); r.set('elRX', -0.5 - 0.8 * s); r.set('shLZ', 0.12); r.set('shRZ', -0.12);
    r.set('hipsY', HIP_H - 0.03 * s + 0.045 * s * Math.abs(cs)); r.set('spineX', 0.06 + 0.16 * s); r.set('chestY', sn * 0.18 * s);
    r.set('hipsRY', -sn * 0.12 * s); r.set('headX', -0.08 * s);
  },
  air(r, vy) {
    r.reset();
    const up = Math.max(-1, Math.min(1, vy / 6));
    r.set('thLX', -0.9); r.set('knLX', 1.1); r.set('thRX', 0.15 - 0.3 * up); r.set('knRX', 0.6 + 0.3 * up);
    r.set('shLX', -0.5); r.set('shLZ', 0.7); r.set('shRX', 0.3); r.set('shRZ', -0.8); r.set('elLX', -0.6); r.set('elRX', -0.4);
    r.set('spineX', 0.1);
  },
  vault(r) {
    r.reset();
    r.set('thLX', -1.4); r.set('knLX', 1.6); r.set('thRX', -1.1); r.set('knRX', 1.9); r.set('thLZ', 0.4); r.set('thRZ', 0.2);
    r.set('shLX', -1.0); r.set('shRX', -1.0); r.set('shLZ', 0.3); r.set('spineX', 0.45); r.set('hipsY', HIP_H + 0.05);
  },
  skate(r, time, { crouch = 0.3, push = 0, lean = 0, air = false } = {}) {
    r.reset();
    const c = crouch;
    r.set('hipsY', HIP_H - 0.06 - c * 0.22);
    r.set('thLZ', 0.26); r.set('thRZ', -0.26);
    r.set('thLX', -0.5 * c - 0.1); r.set('knLX', 0.95 * c + 0.2); r.set('ftLX', -0.45 * c);
    r.set('thRX', -0.5 * c - 0.1); r.set('knRX', 0.95 * c + 0.2); r.set('ftRX', -0.45 * c);
    r.set('spineX', 0.18 + c * 0.25); r.set('chestY', 0.35); r.set('headY', 1.05); r.set('headX', -0.15);
    r.set('shLZ', 0.45 + lean * 0.4); r.set('shRZ', -0.55 + lean * 0.4); r.set('elLX', -0.35); r.set('elRX', -0.3); r.set('shLX', -0.2); r.set('shRX', 0.15);
    r.set('hipsRZ', lean * 0.18);
    if (push > 0) { // back foot kicks along the ground
      const k = Math.sin(time * 7.5);
      r.set('thRZ', -0.15 - 0.45 * (0.5 + 0.5 * k) * push); r.set('knRX', 0.25); r.set('thRX', -0.1);
      r.set('knLX', 0.95 * c + 0.45 * push); r.set('thLX', -0.5 * c - 0.3 * push); r.set('hipsY', HIP_H - 0.1 - c * 0.22 - 0.06 * push);
      r.set('shRX', -0.4 * k * push); r.set('shLX', 0.4 * k * push);
    }
    if (air) { r.set('thLX', -1.0); r.set('knLX', 1.5); r.set('thRX', -1.0); r.set('knRX', 1.5); r.set('shLZ', 0.9); r.set('shRZ', -0.9); r.set('hipsY', HIP_H - 0.12); }
  },
  grind(r, time) {
    Pose.skate(r, time, { crouch: 0.75 });
    r.set('shLZ', 1.25 + Math.sin(time * 5) * 0.12); r.set('shRZ', -1.25 + Math.sin(time * 5 + 1) * 0.12); r.set('elLX', -0.1); r.set('elRX', -0.1);
  },
  skitch(r, time) {
    r.reset();
    r.set('hipsY', HIP_H - 0.2);
    r.set('thLX', -0.55); r.set('knLX', 1.0); r.set('ftLX', -0.45); r.set('thRX', -0.2); r.set('knRX', 0.7); r.set('ftRX', -0.4); r.set('thLZ', 0.1); r.set('thRZ', -0.15);
    r.set('spineX', 0.35); r.set('shRX', -1.55 + Math.sin(time * 9) * 0.03); r.set('elRX', -0.1); r.set('shLZ', 0.8); r.set('elLX', -0.4); r.set('headX', -0.35);
  },
  climb(r, p) {
    r.reset();
    const s = Math.sin(p);
    r.set('shLX', -2.7 + 0.45 * s); r.set('shRX', -2.7 - 0.45 * s); r.set('elLX', -0.5 - 0.4 * Math.max(0, -s)); r.set('elRX', -0.5 - 0.4 * Math.max(0, s));
    r.set('thLX', -0.8 - 0.5 * s); r.set('knLX', 1.3 + 0.3 * s); r.set('thRX', -0.8 + 0.5 * s); r.set('knRX', 1.3 - 0.3 * s);
    r.set('hipsY', HIP_H - 0.05); r.set('headX', -0.4);
  },
  punch(r, side, k, kick = false) { // overlay on top of the current targets
    const e = Math.sin(Math.min(1, k) * Math.PI);
    if (kick) { r.set('thRX', -1.5 * e); r.set('knRX', 1.4 * (1 - e) + 0.05); r.set('spineX', -0.25 * e); r.set('shLZ', 0.7 * e); r.set('shRZ', -0.7 * e); return; }
    const L = side === 'L';
    r.set(L ? 'shLX' : 'shRX', -1.5 * e - 0.4 * (1 - e)); r.set(L ? 'elLX' : 'elRX', -1.8 * (1 - e) - 0.05);
    r.set(L ? 'shLZ' : 'shRZ', (L ? 1 : -1) * 0.15);
    r.set('chestY', (L ? -0.55 : 0.55) * e); r.set('spineX', 0.15);
  },
  roll(r, k) {
    r.reset();
    r.set('hipsRX', k * Math.PI * 2); r.set('hipsY', 0.55 + 0.25 * Math.abs(Math.cos(k * Math.PI)));
    r.set('thLX', -2.0); r.set('knLX', 2.2); r.set('thRX', -2.0); r.set('knRX', 2.2); r.set('spineX', 0.7); r.set('neckX', 0.5);
    r.set('shLX', -1.2); r.set('shRX', -1.2); r.set('elLX', -1.8); r.set('elRX', -1.8);
  },
  tumble(r, k) {
    r.reset();
    r.set('hipsRX', -Math.min(1, k * 1.8) * 1.45); r.set('hipsY', HIP_H - Math.min(1, k * 1.6) * 0.75);
    r.set('shLZ', 1.6); r.set('shRZ', -1.6); r.set('shLX', -0.5); r.set('thLX', -0.6); r.set('knLX', 0.5); r.set('thRX', -0.2); r.set('knRX', 0.2);
  },
  down(r) {
    r.reset();
    r.set('hipsRX', -1.5); r.set('hipsY', 0.17); r.set('shLZ', 1.3); r.set('shRZ', -1.1); r.set('thLZ', 0.2); r.set('knRX', 0.4); r.set('headY', 0.5);
  },
  flip(r, kind, k) { // k: 0..1 through the flip
    r.reset();
    const e = Math.min(1, k), tuck = Math.sin(e * Math.PI);
    if (kind === 'side') r.set('hipsRZ', (r._flipDir || 1) * e * Math.PI * 2);
    else r.set('hipsRX', (kind === 'back' ? -1 : 1) * e * Math.PI * 2);
    r.set('thLX', -0.4 - 1.5 * tuck); r.set('knLX', 0.4 + 1.8 * tuck); r.set('thRX', -0.4 - 1.5 * tuck); r.set('knRX', 0.4 + 1.8 * tuck);
    r.set('spineX', 0.5 * tuck); r.set('neckX', 0.3 * tuck); r.set('shLX', -1.4 * tuck); r.set('shRX', -1.4 * tuck); r.set('elLX', -1.2); r.set('elRX', -1.2);
    if (kind === 'side') { r.set('shLZ', 1.4); r.set('shRZ', -1.4); r.set('thLZ', 0.4); r.set('thRZ', -0.4); }
  },
  wallrun(r, p, side) { // side: +1 wall on the left, -1 wall on the right
    Pose.run(r, p, 1);
    r.set('hipsRZ', side * 0.5); r.set('spineY', 0); r.set('headY', -side * 0.2);
    r.set(side > 0 ? 'shLZ' : 'shRZ', side * 1.2); r.set(side > 0 ? 'elLX' : 'elRX', -0.3);
  },
  aim(r) { // catapult drawn: left arm out, right hand pulling the band to the cheek
    r.set('shLX', -1.55); r.set('shLZ', 0.05); r.set('elLX', -0.05);
    r.set('shRX', -1.45); r.set('shRZ', 0.35); r.set('elRX', -2.3);
    r.set('chestY', 0.25); r.set('headY', -0.15); r.set('headX', 0);
  },
  throw(r, k) {
    const e = Math.sin(Math.min(1, k) * Math.PI);
    r.set('shRX', -2.6 + 2.2 * k); r.set('elRX', -1.4 * (1 - k)); r.set('chestY', -0.6 * e); r.set('spineX', 0.2 * e);
  },
  flash(r, k) {
    const e = Math.sin(Math.min(1, k) * Math.PI);
    r.set('shLZ', 1.5 * e); r.set('shRZ', -1.5 * e); r.set('chestX', -0.3 * e); r.set('headX', -0.3 * e); r.set('spineX', -0.15 * e);
  },
  trickAir(r, k) {
    const e = Math.sin(Math.min(1, k) * Math.PI);
    r.set('thLX', -1.2 * e - 0.4); r.set('knLX', 1.7); r.set('thRX', -0.9 * e - 0.4); r.set('knRX', 1.6); r.set('hipsY', HIP_H - 0.1 + 0.12 * e);
    r.set('shRX', -0.6 * e); r.set('shRZ', -0.3); r.set('elRX', -0.4);
  },
  cough(r, t) { // blinded by pepper
    Pose.idle(r, t, false);
    const k = Math.abs(Math.sin(t * 9));
    r.set('spineX', 0.5 + 0.2 * k); r.set('shLX', -2.0); r.set('elLX', -2.3); r.set('shRX', -1.9); r.set('elRX', -2.3); r.set('headX', 0.4 * k); r.set('hipsY', HIP_H - 0.08);
  },
  // ---- combat (Bolaji) ----
  strike(r, kind, k) {
    const e = Math.sin(Math.min(1, k) * Math.PI), q = Math.min(1, k);
    switch (kind) {
      case 'jab': Pose.idle(r, 0, true); Pose.punch(r, 'L', k); break;
      case 'hook': Pose.idle(r, 0, true); Pose.punch(r, 'R', k); r.set('chestY', 0.8 * e); break;
      case 'knee': Pose.idle(r, 0, true); r.set('thRX', -1.7 * e); r.set('knRX', 1.9 * e + 0.2); r.set('shLX', -1.4 * e); r.set('shRX', -1.4 * e); r.set('elLX', -1.6); r.set('elRX', -1.6); r.set('spineX', 0.3 * e); break;
      case 'spin': Pose.idle(r, 0, true); r.set('hipsRY', q * Math.PI * 2); r.set('thRZ', -1.45 * e); r.set('thRX', -0.3 * e); r.set('knRX', 0.1); r.set('shLZ', 1.1 * e); r.set('shRZ', -0.9 * e); r.set('hipsY', HIP_H - 0.06); break;
      case 'flipkick': r.reset(); r.set('hipsRX', -q * Math.PI * 2); r.set('thRX', -2.0 * e); r.set('knRX', 0.1); r.set('thLX', -0.5); r.set('knLX', 1.6); r.set('shLZ', 1.3); r.set('shRZ', -1.3); r.set('spineX', -0.3 * e); break;
      case 'launch': Pose.idle(r, 0, true); r.set('thRX', -2.6 * e); r.set('knRX', 0.1); r.set('spineX', -0.35 * e); r.set('shLZ', 1.2 * e); r.set('shRZ', -1.0 * e); r.set('hipsY', HIP_H - 0.1 * e); break;
      case 'air': Pose.flip(r, 'front', 0.15 + 0.2 * q); r.set('hipsRX', 0); r.set('thRX', -1.6 * e); r.set('knRX', 0.3); r.set('shRX', -1.5 * e); r.set('elRX', -0.2); break;
      case 'slam': r.reset(); r.set('hipsRX', 0.9 * e); r.set('shLX', -2.9); r.set('shRX', -2.9); r.set('elLX', -0.3); r.set('elRX', -0.3); r.set('thLX', -1.2); r.set('knLX', 1.4); r.set('thRX', -1.2); r.set('knRX', 1.4); break;
      case 'counter': r.reset(); r.set('hipsRY', q * Math.PI * 2); r.set('hipsY', HIP_H - 0.1); r.set('thRZ', -1.5 * e); r.set('thRX', -0.4 * e); r.set('shLZ', 1.2); r.set('shRZ', -1.0); break;
      case 'takedown': Pose.idle(r, 0, false); r.set('hipsY', HIP_H - 0.45 * e); r.set('thLX', -1.2 * e); r.set('knLX', 2.0 * e); r.set('thRX', -0.2); r.set('knRX', 1.4 * e); r.set('spineX', 0.7 * e); r.set('shRX', -1.2 * e); r.set('elRX', -0.2); r.set('shLX', -0.9 * e); break;
      case 'pounce': r.reset(); { const up = q < 0.8; r.set('hipsY', up ? HIP_H : HIP_H - 0.25); r.set('thLX', up ? -1.5 : -0.6); r.set('knLX', up ? 1.8 : 1.0); r.set('thRX', up ? -1.3 : -1.2); r.set('knRX', up ? 1.9 : 1.3); r.set('spineX', 0.45); r.set('shLX', -2.2 * (up ? 1 : e)); r.set('shRX', up ? -2.4 : -1.6); r.set('elLX', -0.3); r.set('elRX', -0.2); } break;
      case 'throw': Pose.idle(r, 0, false); r.set('shRX', -2.6 + 2.6 * q); r.set('elRX', -1.3 * (1 - q)); r.set('chestY', -0.7 * e); r.set('spineX', 0.25 * e); r.set('thLX', -0.4 * e); r.set('knLX', 0.3); break;
      case 'flurry': { Pose.idle(r, 0, true); const n = q * 9, ph = n % 1, side = Math.floor(n) % 2 ? 'L' : 'R', e2 = Math.sin(ph * Math.PI); Pose.punch(r, side, e2); r.set('chestY', (side === 'L' ? 0.55 : -0.55) * e2); if (q > 0.78) { const k = Math.sin((q - 0.78) / 0.22 * Math.PI); r.set('thRX', -2.2 * k); r.set('knRX', 0.1); r.set('spineX', -0.3 * k); } break; }
      case 'catdrop': { r.reset(); const k = 1 - q * 0.6; r.set('hipsY', HIP_H - 0.5 * k); r.set('thLX', -1.5 * k); r.set('knLX', 2.1 * k); r.set('thRX', -0.4 * k); r.set('knRX', 1.6 * k); r.set('spineX', 0.75 * k); r.set('headX', -0.6 * k); r.set('shRX', -0.55); r.set('elRX', -0.15); r.set('shLX', 0.9 * k); r.set('shLZ', 0.6 * k); break; } // three-point cat landing, one hand down
      case 'sweep': r.reset(); r.set('hipsY', HIP_H - 0.5); r.set('hipsRY', q * Math.PI * 2); r.set('thLX', -1.6); r.set('knLX', 2.3); r.set('thRZ', -1.45); r.set('thRX', 0.1); r.set('knRX', 0.05); r.set('spineX', 0.5); r.set('shLX', -0.3); r.set('shLZ', 0.9); r.set('shRZ', -0.8); r.set('elLX', -0.4); break;
      case 'web': r.set('shRX', -1.55); r.set('elRX', -0.05); r.set('shRZ', 0.1); r.set('chestY', 0.35); r.set('headY', -0.1); break;
    }
  },
  // ---- victims and thugs ----
  cower(r, t) {
    r.reset();
    const k = Math.sin(t * 7) * 0.05;
    r.set('hipsY', 0.36); r.set('thLX', -1.9); r.set('knLX', 2.3); r.set('thRX', -1.8); r.set('knRX', 2.3); r.set('spineX', 0.95 + k); r.set('neckX', 0.4);
    r.set('shLX', -2.5); r.set('elLX', -2.3); r.set('shRX', -2.4); r.set('elRX', -2.3);
  },
  kneelTied(r, t) {
    r.reset();
    const k = Math.sin(t * 1.3) * 0.04;
    r.set('hipsY', 0.52); r.set('thLX', 0.05); r.set('knLX', 1.65); r.set('thRX', 0.05); r.set('knRX', 1.65); r.set('ftLX', 0.6); r.set('ftRX', 0.6);
    r.set('shLX', 0.55); r.set('shRX', 0.55); r.set('shLZ', -0.25); r.set('shRZ', 0.25); r.set('elLX', -1.1); r.set('elRX', -1.1);
    r.set('spineX', 0.2); r.set('headX', 0.45 + k);
  },
  kickDown(r, k) { // a thug stamping / kicking someone on the ground
    const e = Math.sin(Math.min(1, k) * Math.PI);
    r.set('thRX', -1.1 * e); r.set('knRX', 0.6 * (1 - e) + 0.1); r.set('spineX', -0.1); r.set('shLZ', 0.5 * e); r.set('shRZ', -0.3);
  },
  webbed(r, t) {
    r.reset();
    const k = Math.sin(t * 11) * 0.06;
    r.set('shLZ', 0.04); r.set('shRZ', -0.04); r.set('shLX', 0.1 + k); r.set('shRX', 0.1 - k); r.set('thLZ', 0.02); r.set('thRZ', -0.02); r.set('spineX', -0.1); r.set('headX', -0.2 + k);
  },
  crawl(r, p) {
    r.reset();
    const k = Math.sin(p);
    r.set('hipsRX', 1.35); r.set('hipsY', 0.32); r.set('spineX', 0.1); r.set('neckX', -0.9);
    r.set('shLX', -2.4 + 0.5 * k); r.set('shRX', -2.4 - 0.5 * k); r.set('elLX', -0.6); r.set('elRX', -0.6);
    r.set('thLX', 0.3 - 0.5 * k); r.set('knLX', 0.7); r.set('thRX', 0.3 + 0.5 * k); r.set('knRX', 0.9);
  },
  getup(r, k) {
    Pose.idle(r, 0, false);
    const d = 1 - Math.min(1, k);
    r.set('hipsY', HIP_H - 0.55 * d); r.set('thLX', -1.6 * d); r.set('knLX', 2.0 * d); r.set('thRX', -0.8 * d); r.set('knRX', 1.4 * d);
    r.set('spineX', 0.8 * d); r.set('shLX', -0.6 * d); r.set('shRX', -0.9 * d); r.set('elRX', -0.8);
  },
  limp(r, p, s) { // hurt: uneven stride, hunched
    Pose.run(r, p, s * 0.7);
    r.set('knRX', 0.2); r.set('thRX', r.t.thRX * 0.4); r.set('spineX', 0.3); r.set('hipsRZ', Math.sin(p) * 0.08); r.set('shRX', -0.3); r.set('elRX', -1.3);
  },
  stagger(r, k) {
    r.set('spineX', -0.45 * (1 - k)); r.set('chestX', -0.2 * (1 - k)); r.set('headX', -0.4 * (1 - k)); r.set('shLZ', 0.8); r.set('shRZ', -0.8);
  },
};

// ---------- the skateboard ----------
let boardGeo = null;
export function makeBoardMesh() {
  if (!boardGeo) {
    const wood = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.75 });
    const grip = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 1 });
    const paint = new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.7 });
    const metal = new THREE.MeshStandardMaterial({ color: '#9ea3a8', roughness: 0.35, metalness: 0.8 });
    const wheel = new THREE.MeshStandardMaterial({ color: '#efe6c8', roughness: 0.5 });
    boardGeo = { wood, grip, paint, metal, wheel };
  }
  const { wood, grip, paint, metal, wheel } = boardGeo;
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m; };
  // deck (length along z), cut from an old door: plain wood underside with a red painted stripe
  add(new THREE.BoxGeometry(0.22, 0.02, 0.56), wood, 0, 0.1, 0);
  add(new THREE.BoxGeometry(0.221, 0.004, 0.56), grip, 0, 0.112, 0);
  add(new THREE.BoxGeometry(0.22, 0.02, 0.14), wood, 0, 0.118, 0.34, -0.3);
  add(new THREE.BoxGeometry(0.22, 0.02, 0.14), wood, 0, 0.118, -0.34, 0.3);
  add(new THREE.BoxGeometry(0.06, 0.003, 0.5), paint, 0, 0.088, 0);
  add(new THREE.BoxGeometry(0.03, 0.004, 0.04), metal, 0.07, 0.087, 0.2); add(new THREE.BoxGeometry(0.03, 0.004, 0.04), metal, 0.07, 0.087, -0.2); // old hinge plates
  for (const z of [0.2, -0.2]) {
    add(new THREE.BoxGeometry(0.16, 0.03, 0.04), metal, 0, 0.07, z);
    for (const x of [0.085, -0.085]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.035, 10), wheel, x, 0.035, z, 0, Math.PI / 2);
  }
  return g;
}
