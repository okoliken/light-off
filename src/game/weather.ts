// Rain. Some days the sky goes black over Lagos and it pours: streaks of rain around the camera, a
// darker, foggier city, the hiss of it on zinc roofs. Police see less in a downpour; customers still
// want their parcels.
import * as THREE from 'three';

export function createWeather(game, { lowQuality = false } = {}) {
  const { scene, env, hud, audio } = game;
  const L = game.life;
  const N = lowQuality ? 600 : 1600, BOX = 34, H = 26;
  const pos = new Float32Array(N * 6), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seed[i * 3] = (Math.random() - 0.5) * BOX * 2; seed[i * 3 + 1] = Math.random() * H; seed[i * 3 + 2] = (Math.random() - 0.5) * BOX * 2; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xaec4d8, transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; scene.add(lines);
  const W: any = { k: 0, target: 0, nextChange: 120 + Math.random() * 240, raining: false };
  W.start = (heavy = Math.random() < 0.5) => { W.raining = true; W.target = heavy ? 1 : 0.6; W.nextChange = 150 + Math.random() * 240; hud.notice('RAIN', heavy ? 'The sky opens. Lagos floods in minutes.' : 'It starts to drizzle.', 'blue', 3); };
  W.stop = () => { W.raining = false; W.target = 0; W.nextChange = 200 + Math.random() * 360; };
  W.update = (dt, cam) => {
    // the weather changes by itself: about one in three spells is rain
    W.nextChange -= dt;
    if (W.nextChange <= 0) { if (W.raining) W.stop(); else if (Math.random() < 0.38) W.start(); else W.nextChange = 150 + Math.random() * 240; }
    W.k += (W.target - W.k) * Math.min(1, dt * 0.4);
    env.setRain?.(W.k); audio.setRain?.(L.inside ? W.k * 0.4 : W.k);
    mat.opacity = L.inside || game.inMall ? 0 : 0.5 * W.k; lines.visible = mat.opacity > 0.01;
    if (!lines.visible) return;
    const t = game.time, fall = 24, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    for (let i = 0; i < N; i++) {
      const sx = seed[i * 3], sz = seed[i * 3 + 2];
      const y = H - ((seed[i * 3 + 1] + t * fall) % H);
      const x = cx + ((sx - cx * 0.0) % (BOX * 2) + BOX * 3) % (BOX * 2) - BOX, z = cz + ((sz) % (BOX * 2) + BOX * 3) % (BOX * 2) - BOX;
      const o = i * 6; pos[o] = x; pos[o + 1] = cy - 6 + y; pos[o + 2] = z; pos[o + 3] = x + 0.08; pos[o + 4] = cy - 6 + y - 0.9; pos[o + 5] = z + 0.05;
    }
    geo.attributes.position.needsUpdate = true;
  };
  W.visionScale = () => 1 - 0.35 * W.k; // police see less through heavy rain
  return W;
}
