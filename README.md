# Light-Off: A Bolaji Story

A 3D open-world street game set in Lagos, Nigeria, built for the browser with Three.js and TypeScript.

Bolaji is a street kid from Aguda, Surulere. By day he runs errands for Mama and listens to the radio. At night, when Mama is asleep, he pulls on a black hoodie with stitched cat ears and goes out on his homemade skateboard. He takes back what the corrupt and powerful have taken from ordinary people, and returns it to its owners, while the police, the agberos and the Red Caps cult try to stop him.

> **Status:** playable prototype. Chapter 1 has 10 story missions; Patrol mode is an endless free roam. Everything (city, characters, vehicles, sound) is generated in code: there are no external art or audio files.

## Play it

Requires [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
npm run dev          # open http://127.0.0.1:5174
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5174 |
| `npm run build` | Type-checks (`tsc`), then builds to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm run preview` | Serves the production build |

Chrome or Edge recommended. Xbox and PlayStation controllers are detected automatically. Graphics have Low / Medium / High presets (title screen → Settings); Low is aimed at laptops without a dedicated graphics card.

## What's in the game

- **Chapter 1, The Red Caps:** 10 connected missions. Each one is unlocked by news on Bolaji's pocket radio, starts from his door at night, opens with an in-engine cutscene, and ends with getting home without being followed. Missions 1 and 4 follow the full *Look → Do → Turn → Run → Morning after* shape: daytime recon, the job, a twist, the getaway, and the city reacting the next morning.
- **Daytime missions:** no mask, so fighting in front of people fills an **Eyes on you** meter. If it fills, he's recognised.
- **Patrol mode:** endless nights with a **Patrol Board** (J) listing everything happening nearby: beatings, armed robberies, phone snatchers, levy points, police checkpoints, Red Caps blockades, the Third Mainland go-slow robbers, rooftop runs and skate challenges.
- **Moving around:**
  - free-flow combat (combos, counters, launch and juggle, flying knee, Cat Sweep, Alley Cat Flurry);
  - cat-like parkour (climb, wall-run, flips, cat leap, landing on his feet);
  - skateboarding (grinds and tricks);
  - skitching onto danfos, kekes and cars;
  - paid rides from bus stops.
- **The police and the Patron:**
  - corrupt checkpoints collect "roger" all over the city;
  - police heat goes up to 3 stars;
  - arrests: kick out of the police car, then escape in handcuffs;
  - a hidden patron sends paid police, then his trained Blades.
- **The city:**
  - Surulere (Aguda, Ojuelegba, Adelabu, the National Stadium);
  - Yaba (Tejuosho, the Red Line station, the bus terminal, Sabo, YabaTech);
  - UNILAG at Akoka;
  - Mushin and Idi-Araba (Ladipo, LUTH, Agege Motor Road, Empire);
  - Third Mainland Bridge out to Lagos Island.
- **Living systems:**
  - day/night clock, hunger, energy and injury;
  - Mama's suspicion;
  - NEPA blackouts, bad roads and floods;
  - newspapers and an end-of-night report;
  - autosave.

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move · camera | WASD · mouse | Left stick · right stick |
| Jump (hold for a cat leap) · climb · flip | Space | A / ✕ |
| Sprint | Shift | RT / R2 |
| Board on / off | R | Y / △ |
| Skitch a vehicle | E | RB / R1 |
| Strike · interact | F / left click | X / □ |
| Counter (on "!") · dodge | C | B / ○ |
| Launch · Cat Sweep · Alley Cat Flurry | G | D-pad ↑ |
| Pounce | V | D-pad ↓ |
| Pick up · throw | T | D-pad ← |
| Pocket radio | N | D-pad → |
| Street Sense (hold) | Q | LB / L1 |
| Map · Patrol Board · pause | M · J · Esc / P | View · Start |

## Project layout

```
src/
  main.ts          boot, main loop, menus, scenes, frame-rate cap
  core/            geometry batching, procedural textures
  world/           city, districts and landmarks, roads and traffic, vehicles, collision, Bolaji's room
  player/          movement, skating, parkour, procedural character rig, input
  game/            game loop, story, combat, enemies, police, radio, Patrol activities, cutscenes, audio
  ui/              HUD, menus, map, CSS
docs/              design documents (story, character, decisions, roadmap)
```

See [`src/README.md`](src/README.md) for how the code fits together, and [`docs/README.md`](docs/README.md) for the design documents.

## Tech

- **Three.js 0.180** for rendering.
- **Vite 7** for the dev server and bundling.
- **TypeScript 5**, currently in loose mode. Fields that are still typed loosely are marked `TODO(ts)`.
- **Everything is procedural.** Buildings, characters and vehicles are built from primitives. Textures are drawn on canvases. Sound is synthesised with the Web Audio API.

## Credits

Created by [@okoliken](https://github.com/okoliken) · Surulere / Lagos.
Built with help from Claude (Anthropic).
