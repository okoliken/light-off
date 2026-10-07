// Realistic bodies: skinned models made in Blender (docs/bolaji-base.blend), exported to public/models.
// 'human' is the everyday body (skin, shirt, trousers, trainers, hair) and is tinted per character from
// their outfit colours; 'panther' is Bolaji's panther suit. Rig drives the model's skeleton from its own
// pivot groups every frame, so all the existing pose code (run, climb, fight...) moves the real body.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type Kind = 'human' | 'panther' | 'woman';
const bases: Partial<Record<Kind, THREE.Object3D>> = {};
/** Each model's bones: rest orientation and position, relative to the model's root. */
const rest: Partial<Record<Kind, Record<string, { q: THREE.Quaternion; p: THREE.Vector3 }>>> = {};

/** Rig pivot -> skeleton bone. */
export const BONE_OF: Record<string, string> = {
  hips: 'pelvis', spine: 'spine_01', chest: 'spine_03', neck: 'neck_01', head: 'head',
  shL: 'upperarm_l', elL: 'lowerarm_l', haL: 'hand_l', shR: 'upperarm_r', elR: 'lowerarm_r', haR: 'hand_r',
  thL: 'thigh_l', knL: 'calf_l', ftL: 'foot_l', thR: 'thigh_r', knR: 'calf_r', ftR: 'foot_r',
};

export async function loadBodies() {
  const loader = new GLTFLoader();
  await Promise.all((['human', 'panther', 'woman'] as Kind[]).map(async (kind) => {
    try {
      const g = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${kind}.glb`);
      bases[kind] = g.scene;
      const r: any = rest[kind] = {};
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o: any) => {
        if (o.isBone) r[o.name] = { q: o.getWorldQuaternion(new THREE.Quaternion()), p: o.getWorldPosition(new THREE.Vector3()) };
      });
    } catch (e) { console.warn(`body model ${kind} failed to load; using the simple body`, e); }
  }));
}

export const hasBody = (kind: Kind) => !!bases[kind];
export const restPos = (kind: Kind, bone: string) => rest[kind]![bone]?.p;
export const restQuat = (kind: Kind, bone: string) => rest[kind]![bone]?.q;

const matCache = new Map<string, THREE.Material>();
/** A copy of the model, its materials tinted from the outfit (shared between characters with the same colours). */
export function makeBody(kind: Kind, o: any): THREE.Object3D {
  const model = clone(bases[kind]!);
  tintBody(model, kind, o);
  return model;
}

/** Colour a body from an outfit (skin, top, bottom, shoes, hair). Cheap: materials are shared per colour. */
export function tintBody(model: THREE.Object3D, kind: Kind, o: any) {
  const tint: Record<string, string | undefined> = kind === 'panther' ? {}
    : { skin: o.skin, top: o.top, bottom: o.bottom, shoe: o.sole, hair: o.hair && o.hair.startsWith?.('#') ? o.hair : undefined };
  model.traverse((m: any) => {
    if (!m.isMesh) return;
    if (!m.userData.base) m.userData.base = m.material; // the model's own material, kept to tint from
    m.material = m.userData.base;
    if (!m.isMesh) return;
    m.castShadow = true; m.frustumCulled = false;
    const name = m.material.name, col = tint[name];
    if (col) {
      const key = `${name}:${col}`;
      let mat = matCache.get(key);
      if (!mat) { mat = m.material.clone(); (mat as any).color.set(col); matCache.set(key, mat!); }
      m.material = mat;
    }
    if (name === 'suit' && !(m.material as any).userData.done) { // the suit body
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveMap = null; mat.emissive.set('#000000'); mat.emissiveIntensity = 0; mat.needsUpdate = true; mat.userData.done = true; // plain matte black: no violet lines
    }
    if (name === 'shell') { const mat = m.material as THREE.MeshStandardMaterial; mat.metalness = 0.15; mat.roughness = 0.45; } // armour: a satin sheen, not a mirror
    if (name === 'silver') { const mat = m.material as THREE.MeshStandardMaterial; mat.roughness = 0.45; mat.metalness = 0.75; } // brushed, so a streetlight doesn't flare off the chest
    if (name === 'glow') { const mat = m.material as THREE.MeshStandardMaterial; mat.emissive.set('#c79bff'); mat.emissiveIntensity = 3; }
  });
}
