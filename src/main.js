// Light-Off: boot, main loop, title / pause / scene flow, quality settings and frame-rate cap.
import * as THREE from 'three';
import { buildCity } from './world/city.js';
import { createTraffic } from './world/traffic.js';
import { createPlayer } from './player/player.js';
import { createInput } from './player/input.js';
import { createCamera } from './game/camera.js';
import { createCrowd } from './game/crowd.js';
import { createAudio } from './game/audio.js';
import { createEnv } from './game/env.js';
import { createGame } from './game/game.js';
import { createFX } from './game/fx.js';
import { createNav } from './game/nav.js';
import { createHUD } from './ui/hud.js';
import { REGIONS } from './world/layout.js';
import { buildRoom } from './world/room.js';
import { nightReport } from './game/nightreport.js';
import { createCinema } from './game/cinema.js';
import { loadSettings, saveSettings, preset, PRESETS } from './game/settings.js';

const settings = loadSettings();
let Q = preset(settings);

const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.pixelRatio >= 1, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const t0 = performance.now();
const world = buildCity(scene, { lights: Q.lights });
buildRoom(scene, world);
REGIONS.push(world.room.region);    // Bolaji's room
REGIONS.push(world.stadium.region); // the National Stadium grounds
const traffic = createTraffic(scene, world);
const player = createPlayer(scene, world, traffic);
const camera = createCamera(innerWidth / innerHeight, world);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHUD(hudRoot, world);
const env = createEnv(scene, renderer, camera.cam, { shadows: Q.shadows, shadowSize: Q.shadowSize, bloom: Q.bloom });
const fx = createFX(scene, world);
const nav = createNav(scene, world);
const game = createGame({ scene, world, traffic, player, camera, hud, audio, env, input, fx });
const crowd = createCrowd(scene, world, Q.crowd); // after the game, so bus stops exist for people to wait at
world.setPower(1); env.setPower(1);
console.log(`[light-off] world built in ${Math.round(performance.now() - t0)} ms · quality ${settings.quality}`);

let state = 'title'; // title | play | paused | overlay | scene
const L = game.life;

function applyQuality(q) {
  settings.quality = q; saveSettings(settings); Q = preset(settings);
  renderer.setPixelRatio(Q.pixelRatio); renderer.setSize(innerWidth, innerHeight);
  env.bloom.enabled = Q.bloom; env.moonL.castShadow = Q.shadows; env.resize(innerWidth, innerHeight);
}

hud.setHudVisible(false);
const saved = game.loadSave();
const patrolSaved = game.loadSave('patrol');
hud.title(saved ? { night: saved.night, phase: saved.phase, mission: game.story.missions[saved.story.index]?.title, respect: saved.respect } : null, ({ fresh, quality, mode }) => {
  if (quality && quality !== settings.quality) applyQuality(quality);
  audio.start();
  hud.setHudVisible(true);
  if (mode === 'patrol') { // endless free roam, its own save
    game.mode = 'patrol';
    if (patrolSaved && !fresh) game.applySave(patrolSaved); else game.clearSave('patrol');
    game.startPatrol();
  } else if (saved && !fresh) { game.applySave(saved); if (saved.phase === 'night') { game.startDay(); game.toNight(); } else game.startDay(); }
  else { game.clearSave(); game.startDay(); }
  state = 'play'; input.lock();
}, { quality: settings.quality, presets: PRESETS, patrol: patrolSaved ? { night: patrolSaved.night, respect: patrolSaved.respect } : null });

// menus opened from inside the game pause it
function openMenu(show) { state = 'overlay'; document.exitPointerLock?.(); show(() => { state = 'play'; input.lock(); }); }
game.onRideMenu = (stop) => openMenu(done => hud.rideMenu(stop, game.transport.options(stop), (to, mode) => { done(); game.transport.board(stop, to, mode); }, done));
game.onNewspaper = (heads) => openMenu(done => hud.newspaper(heads, done));

// cutscenes (game/cinema.js): the camera frames whoever is talking, lines type and advance by themselves
const cinema = createCinema({ game, camera, hud });
const pendingScenes = [];
game.playScene = (lines, focus, onDone, title = '') => {
  if (!lines?.length) { onDone?.(); return; }
  // a menu or report is open: hold the scene until we're back in the game
  if (state !== 'play' && state !== 'scene') { pendingScenes.push([lines, focus, onDone, title]); return; }
  state = 'scene';
  cinema.play(lines, focus, () => { state = 'play'; input.lock(); camera.snapBehind(player.yaw); onDone?.(); }, title);
};
canvas.addEventListener('click', () => { if (state === 'scene') cinema.advance(); });

// ---- the end of a night: sleep (or get found in a gutter) ----
function endNight(ending) {
  state = 'overlay'; document.exitPointerLock?.(); hud.setHudVisible(false);
  hud.nightOver(nightReport(game, ending), () => {
    L.newNight(); hud.setHudVisible(true);
    if (game.mode === 'patrol') game.startPatrol(); else { game.startDay(); game.save(); }
    state = 'play'; input.lock();
  });
}
game.onSleep = () => endNight(L.caught ? 'dawn' : 'sleep');
game.onBeaten = () => endNight('beaten');
game.onChapterComplete = () => { state = 'overlay'; document.exitPointerLock?.(); hud.setHudVisible(false); hud.chapter(() => { state = 'play'; hud.setHudVisible(true); input.lock(); }); };

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'play' && !input.usingPad && !hudRoot.querySelector('.overlay')) pause();
});
function pause(openBoard = false) {
  state = 'paused';
  hud.setHudVisible(false);
  const S = game.story, list = S.missions.map((m, i) => ({ title: m.title, done: i < S.progress(), current: i === S.progress(), unlocked: i < S.unlocked }));
  const resume = () => { state = 'play'; hud.setHudVisible(true); input.lock(); audio.start(); };
  hud.pause(resume, list, (i) => { resume(); game.jumpToMission(i); }, { quality: settings.quality, presets: PRESETS, onQuality: applyQuality,
    mode: game.mode, board: () => game.patrolBoard(), onWaypoint: (e) => { game.setWaypoint(e); resume(); }, openBoard, rank: game.rank() });
}
canvas.addEventListener('click', () => { if (state === 'play' && !document.pointerLockElement) input.lock(); });

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.cam.aspect = innerWidth / innerHeight; camera.cam.updateProjectionMatrix();
  env.resize(innerWidth, innerHeight);
});

// attract mode: slow orbit over the street while the title is up
function attract(time) {
  const h = world.home, a = time * 0.05;
  camera.cam.position.set(h.x + Math.sin(a) * 38, 16, h.z + Math.cos(a) * 38);
  camera.cam.lookAt(h.x, 3, h.z);
}

let audioState = null, lastState = null, stillFrames = 0, last = performance.now() / 1000, nextAt = 0;
function frame() {
  requestAnimationFrame(frame);
  // frame-rate cap: skip display refreshes until the next frame is due (keeps the laptop cooler).
  // Frames are scheduled on a fixed grid, so a 45 fps cap averages 45 even on a 60 Hz screen.
  const now = performance.now() / 1000, iv = 1 / (state === 'play' || state === 'scene' ? Q.fps : 30);
  if (now < nextAt - 0.004) return;
  nextAt = now - nextAt > iv ? now + iv : nextAt + iv;
  const dt = Math.min(now - last, 1 / 20); last = now;
  if (state === 'play' && cinema.active) state = 'scene';                // never leave a scene half-open behind a menu
  if (state === 'play' && pendingScenes.length) game.playScene(...pendingScenes.shift());
  const playing = state === 'play' || state === 'title' || state === 'scene';
  if (playing !== audioState) { audioState = playing; if (playing) { if (state !== 'title') audio.start(); } else audio.pause(); }
  const inp = input.poll();
  if (state === 'play') {
    if (inp.pressed.pause) { document.exitPointerLock?.(); pause(); }
    if (inp.pressed.map) hud.toggleMap();
    if (inp.pressed.patrolBoard && !game.life.inside) { document.exitPointerLock?.(); pause(true); }
    if (inp.pressed.help) hud.help();
    game.update(dt, inp);
    camera.update(dt, inp, player);
    nav.update(dt, game, game.time);
  } else if (state === 'scene') {
    cinema.update(dt, inp);
    traffic.update(dt * 0.5, game);
  } else if (state === 'title') {
    player.update(0.0001, { move: { x: 0, y: 0 }, held: {}, pressed: {} }, camera.yaw, game.time);
    game.time += dt;
    traffic.update(dt, game);
    attract(game.time);
  }
  // while a menu is open the picture doesn't change: draw it a couple of times, then stop rendering
  if (state === 'paused' || state === 'overlay') { stillFrames = state === lastState ? stillFrames + 1 : 0; lastState = state; if (stillFrames > 2) return; }
  else { lastState = state; stillFrames = 0; }
  if (state !== 'paused' && state !== 'overlay') {
    crowd.update(dt * game.timeScale, game);
    audio.update(game);
  }
  const focus = (state === 'scene' && cinema.focus()) || player.pos; // street lights and shadows follow the cutscene
  world.update(dt, focus.x, focus.z);
  env.update(dt, focus, camera.cam, game.time);
  if (state === 'play' || state === 'paused') hud.update(dt, game);
  env.composer.render();
}
frame();

// debug hooks (used by the automated smoke test)
import('./game/thugs.js').then(m => { window.__ThugClass = m.Thug; });
window.__game = { game, player, traffic, world, camera, input, fx, nav, hud, state: () => state, start: () => hudRoot.querySelector('[data-start]')?.click() };
