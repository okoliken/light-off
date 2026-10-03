// Light-Off: boot, main loop, title / pause / scene flow, quality settings and frame-rate cap.
import * as THREE from 'three';
import { buildCity } from './world/city.ts';
import { createTraffic } from './world/traffic.ts';
import { createPlayer } from './player/player.ts';
import { createInput } from './player/input.ts';
import { createCamera } from './game/camera.ts';
import { createCrowd } from './game/crowd.ts';
import { createAudio } from './game/audio.ts';
import { createEnv } from './game/env.ts';
import { createGame } from './game/game.ts';
import { createFX } from './game/fx.ts';
import { createNav } from './game/nav.ts';
import { createHUD } from './ui/hud.ts';
import { REGIONS } from './world/layout.ts';
import { buildRoom } from './world/room.ts';
import { buildMall } from './world/mall.ts';
import { nightReport } from './game/nightreport.ts';
import { createCinema } from './game/cinema.ts';
import { loadSettings, saveSettings, preset, PRESETS } from './game/settings.ts';
import { createTouchPad, isTouchDevice } from './player/touch.ts';
import { createTutorial } from './game/tutorial.ts';

const touchDevice = isTouchDevice();
const settings = loadSettings();
if (touchDevice && !localStorage.getItem('light-off-settings')) settings.quality = 'low'; // phones and tablets start on Low
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
buildMall(scene, world);
REGIONS.push(world.mall.region); // inside the mall
REGIONS.push(world.room.region);    // Bolaji's room
REGIONS.push(world.stadium.region); // the National Stadium grounds
const traffic = createTraffic(scene, world);
const player = createPlayer(scene, world, traffic);
const camera = createCamera(innerWidth / innerHeight, world);
const input = createInput(canvas);
const touch = touchDevice ? createTouchPad(document.body) : null;
input.touch = touch;
const audio = createAudio();
const hud = createHUD(hudRoot, world);
const env = createEnv(scene, renderer, camera.cam, { shadows: Q.shadows, shadowSize: Q.shadowSize, bloom: Q.bloom });
const fx = createFX(scene, world);
const nav = createNav(scene, world);
const game = createGame({ scene, world, traffic, player, camera, hud, audio, env, input, fx });
const crowd = createCrowd(scene, world, Q.crowd);
game.crowdPeople = () => { const night = game.life.phase === 'night'; return crowd.peds.filter((p: any) => !(night && p.dayOnly)).map((p: any) => p.pos); }; // pedestrians count as witnesses // after the game, so bus stops exist for people to wait at
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
hud.title(saved ? { night: saved.night, phase: saved.phase, mission: game.story.missions[saved.story.index]?.title, respect: saved.respect } : null, ({ fresh, quality, mode }: any) => {
  if (quality && quality !== settings.quality) applyQuality(quality);
  audio.start();
  hud.setHudVisible(true);
  if (mode === 'patrol') { // endless free roam, its own save
    game.mode = 'patrol';
    if (patrolSaved && !fresh) game.applySave(patrolSaved); else game.clearSave('patrol');
    game.startPatrol();
    if (patrolSaved && !fresh) game.restoreSnap(patrolSaved.snap);
  } else if (saved && !fresh) { game.applySave(saved); if (saved.phase === 'night') { game.startDay(); game.toNight(); } else game.startDay(); game.restoreSnap(saved.snap); }
  else { game.clearSave(); game.startDay(); }
  state = 'play'; input.lock();
  if (!tutorial.done()) setTimeout(() => tutorial.start(), 1200); // first time: learn by doing
  if (game.pendingResume) { const id = game.pendingResume; game.pendingResume = null; setTimeout(() => game.story.resumePending(id), 800); }
  else if (game.interrupted) { hud.notice('MISSION INTERRUPTED', `"${game.interrupted}" was cut short. Start it again from your door tonight.`, 'blue'); game.interrupted = null; }
}, { quality: settings.quality, presets: PRESETS, patrol: patrolSaved ? { night: patrolSaved.night, phase: patrolSaved.phase, respect: patrolSaved.respect } : null });

function showControls(first = false) { openMenu(done => hud.controlsCard(done, first)); }
hud.onHelpBar((k) => { if (state !== 'play') return; if (k === 'pause') { document.exitPointerLock?.(); pause(); } else if (k === 'controls') showControls(); else { tutorial.event('map'); state = 'overlay'; document.exitPointerLock?.(); hud.openMap(game, () => { input.poll(); state = 'play'; input.lock(); }); } });
document.addEventListener('pointerlockchange', () => document.body.classList.toggle('locked', !!document.pointerLockElement));
const tutorial = createTutorial(hudRoot, { game, player, camera, input, touch });
// menus opened from inside the game pause it
function openMenu(show) { state = 'overlay'; document.exitPointerLock?.(); show(() => { state = 'play'; input.lock(); }); }
game.onRideMenu = (stop) => openMenu(done => hud.rideMenu(stop, game.transport.options(stop), (to, mode) => { done(); game.transport.board(stop, to, mode); }, done));
game.onMissionComplete = (r) => { if (state === 'play') openMenu(done => hud.missionReport(r, done)); else pendingReports.push(r); };
const pendingReports: any[] = [];
game.onShop = (shop) => openMenu(done => hud.shop(shop, () => game.shopItems().filter((it: any) => !shop.items || shop.items.includes(it.id)), () => game.life.wallet, (id) => game.buy(id), done));
game.onNewspaper = (heads) => openMenu(done => hud.newspaper(heads, done));

// cutscenes (game/cinema.js): the camera frames whoever is talking, lines type and advance by themselves
const cinema = createCinema({ game, camera, hud });
const pendingScenes: any[] = [];
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
    if (game.mode === 'patrol') game.wakeUp(); else { game.startDay(); game.save(); }
    state = 'play'; input.lock();
  });
}
game.onSleep = () => endNight(L.caught ? 'dawn' : 'sleep');
game.onBeaten = () => endNight('beaten');
game.onJailed = () => endNight('arrested');
game.onChapterComplete = () => { state = 'overlay'; document.exitPointerLock?.(); hud.setHudVisible(false); hud.chapter(() => { state = 'play'; hud.setHudVisible(true); input.lock(); }); };

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'play' && !input.usingPad && !hudRoot.querySelector('.overlay')) pause();
});
function pause(openBoard = false) {
  state = 'paused'; tutorial.event('pause');
  game.save(); // pausing is a save point
  hud.setHudVisible(false);
  const S = game.story, list = S.missions.map((m, i) => ({ title: m.title, done: i < S.progress(), current: i === S.progress(), unlocked: i < S.unlocked }));
  const resume = () => { state = 'play'; hud.setHudVisible(true); input.lock(); audio.start(); };
  hud.pause(resume, list, (i) => { resume(); game.jumpToMission(i); }, { quality: settings.quality, presets: PRESETS, onQuality: applyQuality,
    mode: game.mode, tutorial: { active: tutorial.active, skip: () => { tutorial.stop(); resume(); }, replay: () => { resume(); tutorial.start(); } }, board: () => game.patrolBoard(), onWaypoint: (e) => { game.setWaypoint(e); resume(); }, openBoard, rank: game.rank() });
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
  else if (state === 'play' && pendingReports.length) game.onMissionComplete(pendingReports.shift());
  const playing = state === 'play' || state === 'title' || state === 'scene';
  if (playing !== audioState) { audioState = playing; if (playing) { if (state !== 'title') audio.start(); } else audio.pause(); }
  touch?.show(state === 'play');
  const inp = input.poll();
  if (state === 'play') {
    if (inp.pressed.pause) { document.exitPointerLock?.(); pause(); }
    if (inp.pressed.map) { tutorial.event('map'); state = 'overlay'; document.exitPointerLock?.(); hud.openMap(game, () => { input.poll(); state = 'play'; input.lock(); }); }
    if (inp.pressed.help) showControls();
    game.update(dt, inp);
    tutorial.update(dt, inp);
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

// leaving the tab (or the laptop going to sleep) saves too
document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'play' || state === 'paused')) game.save(); });

// debug hooks (used by the automated smoke test)
import('./game/thugs.js').then(m => { window.__ThugClass = m.Thug; });
window.__game = { game, player, traffic, world, camera, input, fx, nav, hud, tutorial, state: () => state, start: () => hudRoot.querySelector<HTMLElement>('[data-start]')?.click() };
