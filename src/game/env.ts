// Night sky with Lagos light-pollution glow on the horizon (it fades when NEPA takes light and the stars
// come out), moonlight with a shadow frustum that follows the player, and the post stack:
// bloom for the lamps, plus a grade pass for Street Sense (desaturate, cold tint, vignette) and hits.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { starsTexture } from '../core/textures.ts';

export function createEnv(scene, renderer, camera, opt: any = {}) {
  const { shadows = true, shadowSize = 1024, bloom: useBloom = true } = opt;
  scene.fog = new THREE.FogExp2(0x0c1220, 0.0085);
  scene.background = new THREE.Color(0x05070d);

  // sky dome
  const skyU = { glow: { value: 1 }, day: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float glow, day; varying vec3 vP;
      void main(){ float h = max(vP.y, 0.0);
        vec3 top = vec3(0.012,0.018,0.045), mid = vec3(0.035,0.045,0.09), hor = mix(vec3(0.05,0.05,0.08), vec3(0.32,0.17,0.08), glow);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.15, 0.7, h));
        // Lagos daytime: hazy pale horizon, soft blue overhead, a warm glow toward the sun
        vec3 dh = vec3(0.82, 0.84, 0.86), dm = vec3(0.55, 0.68, 0.86), dt = vec3(0.28, 0.48, 0.82);
        vec3 d = mix(dh, dm, smoothstep(0.0, 0.2, h)); d = mix(d, dt, smoothstep(0.2, 0.8, h));
        d += vec3(1.0, 0.85, 0.6) * pow(max(dot(vP, normalize(vec3(0.3, 0.6, 0.4))), 0.0), 24.0) * 0.8;
        vec3 dusk = mix(vec3(0.95, 0.55, 0.3), dm * 0.7, smoothstep(0.0, 0.35, h));
        d = mix(dusk, d, smoothstep(0.35, 0.8, day));
        gl_FragColor = vec4(mix(c, d, day), 1.0); }`,
  }));
  sky.renderOrder = -10; scene.add(sky);

  // stars
  const N = 1400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random(), v = Math.random() * 0.9 + 0.08, th = u * Math.PI * 2, ph = Math.acos(1 - v);
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * 550; pos[i * 3 + 1] = Math.cos(ph) * 550; pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 550;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, map: starsTexture(), transparent: true, opacity: 0.2, depthWrite: false, fog: false, color: 0xdfe8ff });
  const stars = new THREE.Points(sg, starMat); stars.renderOrder = -9; scene.add(stars);

  // moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8eeff).multiplyScalar(1.6), fog: false, toneMapped: false }));
  moon.position.set(-220, 260, -380); scene.add(moon);

  const hemi = new THREE.HemisphereLight(0x4a5c90, 0x3a2a1a, 1.3); scene.add(hemi);
  const amb = new THREE.AmbientLight(0x202838, 0.9); scene.add(amb);
  const moonL = new THREE.DirectionalLight(0x9fb4ff, 0.55);
  moonL.position.set(-40, 80, -60);
  {
    moonL.castShadow = shadows;
    moonL.shadow.mapSize.set(shadowSize, shadowSize);
    const s = moonL.shadow.camera; s.left = -45; s.right = 45; s.top = 45; s.bottom = -45; s.near = 1; s.far = 220;
    moonL.shadow.bias = -0.0006; moonL.shadow.normalBias = 0.03;
  }
  scene.add(moonL, moonL.target);
  // soft fill that follows the camera so the black hoodie still reads
  const fill = new THREE.PointLight(0x9ab0e0, 9, 16, 1.2); scene.add(fill);

  // post
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.55, 0.82);
  composer.addPass(bloom); bloom.enabled = useBloom;
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, sense: { value: 0 }, hurt: { value: 0 }, dark: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float sense, hurt, dark, time; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float r = dot(d, d);
        float l = dot(c.rgb, vec3(0.299,0.587,0.114));
        c.rgb = mix(c.rgb, vec3(l) * vec3(0.75, 0.95, 1.25) + vec3(0.0,0.01,0.03), sense * 0.8);
        c.rgb *= 1.0 - r * (0.9 + sense * 1.6 + dark * 0.6);
        c.rgb = mix(c.rgb, vec3(0.6,0.02,0.02), hurt * smoothstep(0.08, 0.35, r));
        float g = fract(sin(dot(vUv * (time + 1.0), vec2(12.9898,78.233))) * 43758.5453);
        c.rgb += (g - 0.5) * 0.025;
        gl_FragColor = c; }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  return {
    composer, grade, bloom, hemi, moonL, fill, sky, stars, renderer,
    // one place computes the whole lighting state from: grid power (p), daylight (d), indoors
    _p: 1, _d: 0, _indoor: false,
    apply() {
      const p = this._p, d = this._d, i = this._indoor, L = (a, b, k) => a + (b - a) * k;
      skyU.glow.value = p; skyU.day.value = d;
      starMat.opacity = (0.25 + (1 - p) * 0.75) * (1 - d);
      moon.visible = d < 0.6;
      hemi.color.set(0x4a5c90).lerp(new THREE.Color(0xc8dcff), d); hemi.groundColor.set(0x3a2a1a).lerp(new THREE.Color(0x8a6f4f), d);
      hemi.intensity = i ? L(0.18, 0.9, d) : L(0.8 + 0.5 * p, 1.7, d);
      amb.intensity = i ? L(0.25, 0.5, d) : L(0.9, 0.6, d);
      moonL.color.set(0x9fb4ff).lerp(new THREE.Color(0xfff0d8), d);
      moonL.intensity = i ? L(0.08, 0.35, d) : L(0.55, 2.8, d);
      fill.intensity = i ? L(1.2, 0.4, d) : L(9, 1, d);
      scene.fog.density = L(0.0085 + (1 - p) * 0.004, 0.0032, d);
      const nf = new THREE.Color(0.047 * (0.6 + 0.4 * p), 0.07 * (0.6 + 0.4 * p), 0.125 * (0.7 + 0.3 * p));
      scene.fog.color.copy(nf).lerp(new THREE.Color(0.72, 0.76, 0.8), d);
      scene.background.set(0x05070d).lerp(new THREE.Color(0x9fb8d8), d);
      grade.uniforms.dark.value = (1 - p) * (1 - d);
      renderer.toneMappingExposure = L(1.45, 0.95, d);
      bloom.strength = L(0.85, 0.25, d);
    },
    setIndoor(v) { if (v === this._indoor) return; this._indoor = v; this.apply(); },
    setPower(p) { this._p = p; this.apply(); },
    setDaylight(d) { if (Math.abs(d - this._d) < 0.002) return; this._d = d; this.apply(); },
    update(dt, focus, cam, time) {
      if (this._d > 0.5) moonL.position.set(focus.x + 45, focus.y + 95, focus.z + 55); else moonL.position.set(focus.x - 40, focus.y + 80, focus.z - 60);
      moonL.target.position.set(focus.x, focus.y, focus.z);
      sky.position.copy(cam.position); stars.position.copy(cam.position);
      moon.position.set(cam.position.x - 220, 260, cam.position.z - 380);
      fill.position.set(cam.position.x, cam.position.y + 1, cam.position.z);
      grade.uniforms.time.value = time % 10;
    },
    resize(w, h) { composer.setSize(w, h); bloom.setSize(w, h); },
  };
}
