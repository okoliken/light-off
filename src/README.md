# Source overview

How the game is put together, for anyone reading or changing the code.

## Frame by frame

`main.ts` owns the loop:
1. Poll input.
2. If playing, call `game.update(dt, input)`; if a cutscene is running, `cinema.update`.
3. Update the camera, crowd and audio.
4. Draw the HUD.
5. Render through the post-processing composer.

The loop caps the frame rate to the graphics preset. While a menu is open, it only renders a couple of frames and then stops.

`game.update` (`game/game.ts`) is the hub. It:
- runs player physics, traffic, enemies and police;
- runs the story, Patrol activities and day systems;
- decides the guide target (`navTarget`) and the markers;
- writes the objective and tracker text.

What the player is currently doing always owns the guide arrow. The priority runs from handcuffs, to the active story step, to goods being returned, to activities he started, to a waypoint he set, and only then to new trouble.

## Modules

| Folder | File | Responsibility |
|---|---|---|
| `world/` | `layout.ts` | Grid constants, the districts (`I0..I1`), special blocks, playable regions |
| | `city.ts` | Builds the whole city: roads, lots, landmarks, the bridge, UNILAG, Lagos Island, area names |
| | `traffic.ts` | Lane graph, car following, checkpoint stops, police driving, getaway cars, bus-ride routing |
| | `vehicles.ts` | Vehicle models built from primitives (danfo, keke, okada, …) |
| | `collision.ts` | Spatial-hash boxes, ramps, ground height, line of sight |
| | `room.ts` | Bolaji's room, with Mama and Tobi |
| `player/` | `player.ts` | Movement modes (foot, board, grind, skitch, climb, wall-run, combat actions, down, crawl, ride), health and injury |
| | `rig.ts` | Procedural skeleton, outfits (including the cat suit) and the pose library |
| | `input.ts` | Keyboard, mouse and gamepad, including the Xbox/PlayStation glyph type |
| `game/` | `story.ts` | The 10 Chapter 1 missions, day missions, recon/turn/morning flow, side beatings |
| | `combat.ts` | Free-flow combat director and player moves |
| | `thugs.ts`, `enemies.ts`, `npcs.ts` | Agberos, Red Caps, Blades and the Egúngún; police and gunmen; civilians |
| | `police.ts` | Checkpoints and roger collection |
| | `activities.ts` | Patrol content: snatchers, robberies, blockades, the Patron's hit squads, rooftop runs, bridge events |
| | `radio.ts` | The pocket radio: news, leads, Patrol calls |
| | `cinema.ts` | In-engine cutscenes: the shot camera, lighting, subtitles |
| | `life.ts`, `day.ts` | Clock, needs, suspicion; daytime places, errands, news |
| | `transport.ts` | Bus stops and paid rides |
| | `nightreport.ts` | The end-of-night report and newspaper |
| | `env.ts`, `fx.ts`, `audio.ts`, `camera.ts`, `crowd.ts`, `nav.ts`, `throwables.ts`, `settings.ts` | Lighting and post-processing, particles, synthesised sound, camera, instanced crowd, guide trail, throwable junk, quality presets |
| `ui/` | `hud.ts` | HUD, the title and pause menus, the map, report screens, cutscene subtitles |

## Saving

Saves go to `localStorage`:
- `light-off-save-v1` holds the story; `light-off-patrol-v1` holds Patrol.
- Saving happens every 20 seconds outside, when pausing, when the tab is hidden, and at night and mission boundaries.
- Each save includes a position snapshot, so Continue resumes where you were.

## Debugging and tests

`window.__game` exposes the game, player, world, traffic and camera for automated tests. Tests drive the game headlessly with Playwright: they call `game.update` directly and check state.

## TypeScript

The code was converted from JavaScript. The first pass is loose:
- classes and the large hub objects have `[key: string]: any` or `any`, marked `TODO(ts)`.
- Tightening means typing the core interfaces (`Game`, `Player`, `Thug`, `Mission`, `SaveData`) first, then enabling `strict` in `tsconfig.json`.
