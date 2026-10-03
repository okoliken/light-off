// All sound is synthesised with WebAudio: city hum, the neighbourhood's generators (louder when NEPA
// takes light), board wheels on asphalt, grind scrape, wind, police siren, danfo horns, hits and stingers.
export function createAudio() {
  let ctx = null, master = null, L: any = {};
  const listener = { x: 0, z: 0 };
  const A: any = { enabled: false };

  function noiseBuffer(sec = 2, brown = false) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  function loop(buf, filterType, freq, q = 1) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(master); src.start();
    return { src, f, g };
  }

  A.pause = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.start = () => {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(comp);
    const white = noiseBuffer(2), brown = noiseBuffer(3, true);
    L.white = white;
    L.city = loop(brown, 'lowpass', 380);
    L.roll = loop(brown, 'lowpass', 220, 0.7); // wheels: low rumble, not hiss
    L.grind = loop(white, 'bandpass', 2800, 4);
    L.wind = loop(brown, 'bandpass', 500, 0.4);
    // generators: a low sawtooth chugging through an LFO-driven gain
    const gen = ctx.createOscillator(); gen.type = 'sawtooth'; gen.frequency.value = 52;
    const genF = ctx.createBiquadFilter(); genF.type = 'lowpass'; genF.frequency.value = 240;
    const chug = ctx.createGain(); chug.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11; const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG).connect(chug.gain);
    const genOut = ctx.createGain(); genOut.gain.value = 0;
    gen.connect(genF).connect(chug).connect(genOut).connect(master); gen.start(); lfo.start();
    L.gen = { g: genOut };
    // siren: triangle whose pitch is swept by a slow square LFO (wee-woo)
    const sir = ctx.createOscillator(); sir.type = 'triangle'; sir.frequency.value = 760;
    const sl = ctx.createOscillator(); sl.type = 'square'; sl.frequency.value = 1.4; const slg = ctx.createGain(); slg.gain.value = 170;
    sl.connect(slg).connect(sir.frequency);
    const sg = ctx.createGain(); sg.gain.value = 0; sir.connect(sg).connect(master); sir.start(); sl.start();
    L.siren = { g: sg };
    // okada engine: a buzzy two-stroke, pitch follows speed
    const eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 38;
    const engF = ctx.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 700;
    const eg = ctx.createGain(); eg.gain.value = 0; eng.connect(engF).connect(eg).connect(master); eng.start();
    L.engine = { o: eng, g: eg };
    A.enabled = true;
  };

  const now = () => ctx.currentTime;
  const vol = (pos, range = 70) => pos ? Math.max(0, 1 - Math.hypot(pos.x - listener.x, pos.z - listener.z) / range) : 1;
  function tone(type, f0, f1, dur, gain, delay = 0) {
    if ([...arguments].some(v => typeof v === 'number' && !Number.isFinite(v))) return;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    const t = now() + delay;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(type, freq, dur, gain, q = 1, delay = 0) {
    if (!Number.isFinite(gain) || !Number.isFinite(freq)) return; // never let a bad value crash the game
    const src = ctx.createBufferSource(); src.buffer = L.white;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); const t = now() + delay;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  const set = (node, v, k = 0.08) => node.g.gain.setTargetAtTime(v, now(), k);

  A.update = (game) => {
    if (!ctx) return;
    const p = game.player;
    listener.x = game.camera.cam.position.x; listener.z = game.camera.cam.position.z;
    const onBoard = p.mode === 'board' && p.onGround, spd = Math.hypot(p.vel.x, p.vel.z);
    set(L.city, 0.05 + 0.1 * game.power);
    set(L.gen, 0.015 + 0.09 * (1 - game.power));
    set(L.roll, onBoard ? Math.min(0.3, 0.06 + spd / 45) : p.mode === 'skitch' ? 0.22 : 0, 0.15);
    L.roll.f.frequency.setTargetAtTime(160 + Math.min(spd, 30) * 8, now(), 0.2);
    // pavement seams: a soft tick every ~1.8 m of rolling
    if (onBoard || p.mode === 'skitch') { L.seam = (L.seam || 0) + spd / 60; if (L.seam > 1.8) { L.seam = 0; burst('lowpass', 700 + Math.random() * 200, 0.03, 0.05 + Math.min(0.05, spd / 400)); } }
    set(L.grind, p.mode === 'grind' ? 0.22 : 0, 0.03);
    set(L.wind, Math.min(0.14, Math.max(0, (spd - 12) / 70) + (p.onGround ? 0 : Math.min(0.06, -p.vel.y / 200))), 0.3);
    set(L.engine, p.mode === 'bike' ? 0.05 + Math.min(0.06, spd / 400) : 0, 0.1);
    if (p.mode === 'bike') L.engine.o.frequency.setTargetAtTime(38 + spd * 4.2, now(), 0.12);
    let sirV = 0;
    for (const v of game.traffic.vehicles) if (v.police?.siren) sirV = Math.max(sirV, vol(v.pos, 140));
    set(L.siren, sirV * 0.1);
  };

  const guard = fn => (...a) => { if (ctx && A.enabled) fn(...a); };
  Object.assign(A, {
    ollie: guard(() => { burst('highpass', 1800, 0.06, 0.5); tone('sine', 220, 90, 0.08, 0.3); }),
    land: guard((hard = 0.5) => { tone('sine', 120, 40, 0.18, 0.3 + hard * 0.4); burst('lowpass', 500, 0.12, 0.3 * hard); }),
    step: guard(() => burst('bandpass', 1400, 0.03, 0.05, 2)),
    swing: guard(() => burst('bandpass', 900, 0.12, 0.12, 1.5)),
    punch: guard(() => { burst('lowpass', 1300, 0.12, 0.8); tone('sine', 110, 50, 0.15, 0.6); }),
    hurt: guard(() => { burst('lowpass', 900, 0.15, 0.7); tone('sawtooth', 220, 90, 0.25, 0.15); }),
    bail: guard(() => { burst('lowpass', 700, 0.35, 0.6); tone('sine', 90, 40, 0.3, 0.5); burst('bandpass', 2200, 0.25, 0.2, 3, 0.1); }),
    horn: guard((pos) => { const v = vol(pos, 90); if (v <= 0) return; tone('square', 392, 392, 0.22, 0.07 * v); tone('square', 494, 494, 0.22, 0.05 * v); tone('square', 392, 392, 0.3, 0.07 * v, 0.28); }),
    yelp: guard((pos) => { const v = vol(pos, 30); if (v > 0) tone('sine', 700 + Math.random() * 300, 1100, 0.12, 0.05 * v); }),
    powerDown: guard(() => { tone('sawtooth', 240, 30, 1.4, 0.2); burst('lowpass', 300, 1.2, 0.4); for (let i = 0; i < 6; i++) burst('bandpass', 500 + Math.random() * 600, 0.4, 0.08, 1, 0.4 + i * 0.12); }),
    powerUp: guard(() => { tone('sine', 60, 240, 0.9, 0.2); for (let i = 0; i < 14; i++) burst('bandpass', 600 + Math.random() * 900, 0.5, 0.1, 1.2, 0.3 + Math.random() * 0.8); }),
    pickup: guard(() => { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.16, 0.18, i * 0.07)); }),
    deliver: guard(() => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f * 1.01, 0.3, 0.2, i * 0.09)); }),
    busted: guard(() => { [330, 294, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.98, 0.35, 0.12, i * 0.2)); }),
    alert: guard(() => { tone('square', 880, 880, 0.08, 0.08); tone('square', 660, 660, 0.12, 0.08, 0.1); }),
    grab: guard(() => burst('bandpass', 1200, 0.08, 0.3, 2)),
    snatch: guard(() => { burst('highpass', 3000, 0.1, 0.25); [990, 1320].forEach((f, i) => tone('triangle', f, f, 0.1, 0.15, i * 0.06)); }),
    sense: guard((on) => tone('sine', on ? 300 : 500, on ? 120 : 250, 0.35, 0.15)),
    gun: guard((pos) => { const v = Math.max(0.25, vol(pos, 120)); burst('lowpass', 3500, 0.09, 1.1 * v); burst('bandpass', 700, 0.35, 0.4 * v, 0.8, 0.02); tone('square', 160, 50, 0.12, 0.2 * v); }),
    ricochet: guard((pos) => { const v = vol(pos, 40); if (v > 0) tone('sine', 2400, 900, 0.18, 0.06 * v); }),
    stone: guard(() => { burst('bandpass', 2400, 0.08, 0.25, 2); tone('triangle', 900, 300, 0.1, 0.08); }),
    clank: guard((pos) => { const v = Math.max(0.2, vol(pos, 60)); tone('square', 1200, 700, 0.12, 0.08 * v); tone('sine', 2600, 2000, 0.25, 0.05 * v); }),
    glass: guard(() => { for (let i = 0; i < 8; i++) tone('sine', 2500 + Math.random() * 3000, 1800, 0.25, 0.05, i * 0.02); burst('highpass', 4000, 0.3, 0.5); }),
    bomb: guard((pos) => { const v = Math.max(0.3, vol(pos, 60)); burst('lowpass', 500, 0.3, 0.8 * v); burst('highpass', 2500, 1.2, 0.25 * v, 0.5, 0.05); }),
    flash: guard(() => { tone('sine', 400, 3000, 0.25, 0.2); burst('highpass', 5000, 0.2, 0.3); }),
    suit: guard(() => { [262, 330, 392, 523, 659].forEach((f, i) => tone('sawtooth', f, f, 0.5, 0.08, i * 0.12)); [523, 784].forEach((f, i) => tone('triangle', f, f, 0.9, 0.15, 0.7 + i * 0.05)); }),
    splash: guard(() => { burst('lowpass', 1800, 0.25, 0.5); burst('highpass', 3000, 0.15, 0.2, 1, 0.03); }),
    tick: guard(() => tone('square', 1000, 1000, 0.05, 0.08)),
    danger: guard((red) => { tone('sine', red ? 1400 : 1900, red ? 1100 : 2400, 0.09, 0.09); tone('sine', red ? 1400 : 1900, red ? 1100 : 2400, 0.09, 0.06, 0.08); }),
  });
  return A;
}
