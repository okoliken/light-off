# Light-Off: A Bolaji Story (prototype v0.5: day and night in Surulere)

A 3D open-world browser game. Bolaji is a street kid from Surulere, Lagos, who takes back the "levy"
agberos extort from traders and returns it to the families it was stolen from. He does it at night, on a
skateboard he built himself, while the police chase him and NEPA keeps taking the light.

See `character-bible.md` for the character and world.

## Run it

```bash
npm install
npm run dev      # then open http://127.0.0.1:5174
npm run build    # production build in dist/
```

Chrome or Edge recommended. A gamepad works (Xbox / PlayStation layout).

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move · Camera | WASD · Mouse | Left stick · Right stick |
| Jump · Ollie · Climb (jump at a wall) · Flip (Space again in the air) | Space | A |
| Sprint · Push harder | Shift | RT |
| Unclip board / strap it on | R | Y |
| Skitch: grab a vehicle / let go | E | RB |
| Strike (the enemy you push toward) · Interact · Board trick in the air | F / left click | X |
| Counter when "!" flashes · Dodge | C | B |
| Launch kick (then F to juggle, 3rd air hit slams) | G | D-pad up |
| Pounce onto an enemy (or spider leap) | V | D-pad down |
| Pick up · Throw junk (or your board) | T | D-pad left |
| Aim a throw · Throw | Hold right mouse · left click | Hold LT · RT |
| Street Sense (hold) | Q | LB |
| Big map · Pause | M · Esc | Back · Start |

## New in v0.5: day and night, transport, bad roads

- **Every day starts at 8 AM:**
  - Bolaji in his own clothes with his board, Mama at the market, Tobi at school.
  - **Mama's note** at the pot gives the day's errand, with the money: tomatoes from Adelabu Market, the NEPA bill, Tobi's uniform, food for Baba Kolade.
  - The suit stays hidden in daylight.
- **News:** newspaper stands (a readable *Lagos Daily*), radio kiosks (Wazobia FM style) and gossiping neighbours. Hearing the **lead** for the next story mission unlocks it for tonight. Tobi is the fallback at night.
- **Discover places:** Adelabu Market, Ojuelegba Motor Park, Ojuelegba Bridge, the stadium pitch, the NEPA office, Sunny Tailoring, Baba Kolade's workshop.
- **Evening:** Mama is back at 6 PM. At home, "wait for night" means dinner, then 10:30 PM with everyone asleep, and the suit comes out of the drum.
- **Bus stops** (Aguda, Ojuelegba, Adelabu, Stadium, Adelabu Market, the motor park, Bode Thomas):
  - Choose a destination and a ride: **danfo, keke or okada**, with fares by distance.
  - Ride along with the conductor shouting. Hold **Space** to hurry, and press **F** to jump off early.
- **Bad roads:** broken laterite streets full of potholes, and two **flooded** stretches that slow the board, your running and the traffic.
- **Daylight:** a hazy Lagos sky, the sun, and a dusk that fades into night.

## v0.4: the jumping spider, health, and home

- **Home is a real room you walk around in:**
  - Mama asleep behind the curtain, and Tobi on the mat (whisper to him for street news and story missions).
  - The black suit is hidden in the water drum, and you change there.
  - Mama's pot to eat from, a chair to rest in, your mat to sleep on.
  - Running wakes Mama and raises her suspicion, especially if she sees the suit.
- **No web shooters.**
  - **Pounce (V):** leap onto an enemy up to about 15 m away and knock them down. With no target, it's a huge spider leap.
  - **Street throws (T):** stones, bricks, bottles, pure water sachets, buckets and tyres, each with its own effect. With nothing to hand he throws his skateboard, and then has to go and get it.
- **Health out of 100, with real damage numbers:** fist 8, stick 12, machete 20, bottle 10, bullet 25, car about 20–35, hard landings.
  - **Injury:** a slice of every hit becomes injury that caps his health until he eats and sleeps.
  - **Visible states:** holding his side, limping, red vision.
- **Getting beaten:**
  - He stays down for about 5 seconds while they gloat, then gets back up.
  - A second knockdown within a minute, or when badly injured, is **critical**: crawl out of their sight to survive.
  - If they catch you crawling, you're robbed and the night ends.
- **Smarter Red Caps:** bottle throwers at range, brutes and Scorpion that block punches from the front, and weaker members who flee when the fight turns.

## v0.3: Chapter 1, The Red Caps

- **The night starts at home** in Aguda while Mama sleeps.
  - **Go out:** start a story mission or patrol the streets.
  - **Eat:** Mama's pot has 2 servings a night.
  - **Sleep:** ends the night.
  - **Deadline:** be back before 5:30 AM.
- **Three story missions:**
  1. **Baba Ade:** stop a beating and return the cash box.
  2. **Under the Bridge:** free three captives from the Red Caps' base under Ojuelegba Bridge.
  3. **The Chairman's Message:** fight through the motor park, beat Scorpion and free Baba Kolade.
- **Side events:** Red Caps beating someone somewhere in Surulere, levy collections to snatch, and cult patrols that grow as the Red Caps take an interest in you.
- **Combat, built for 5–6 enemies at once:**
  - Directional strikes that lunge to the target.
  - Combos ending in a flip kick.
  - **Danger sense:** a "!" appears over whoever is about to hit, so you can counter with C. A red "!" means a machete, which you must dodge.
  - A launcher kick into air juggles and a slam.
  - Takedowns on downed or webbed enemies.
- **Homemade web shooters:** they trap enemies. No swinging. They hold 8 shots and refill slowly.
- **Survival:**
  - A night clock, plus hunger and energy that weaken you when low.
  - Food stalls (suya, akara, mama put, bukka) paid for with your own wallet. People you save sometimes tip you "for food".
  - Low health gives you a limp and red vision.
- **Secret identity:** after a mission, Red Cap lookouts follow you. You can't go in while you're being watched, so lose them first.
- **Surulere:**
  - Real road names (Bode Thomas, Western Avenue, Adeniran Ogunsanya, Stadium Road and more).
  - Areas: Aguda, Ojuelegba, Adelabu Market, National Stadium.
  - The Ojuelegba flyover with the Red Caps' camp underneath.
- **Paused until later chapters:** car chases and the UNILAG race. The Third Mainland Bridge approach is closed "for repairs", and the Suit v2 attire is gone: the costume stays black.

## Earlier (v0.2)

- **Acrobatics:**
  - Front, back and side flips in the air, wall-runs (jump along a wall at an angle), and wall flips.
  - A safety roll: press C just before landing to avoid fall damage.
  - Board tricks: kickflip, heelflip, 360 flip and shove-it. Land clean or slam.
- **Gadgets:**
  - **Catapult ("katapot"):** stones stun people. A stunned collector's bag can be snatched, and stones burst the getaway car's tires.
  - **Ata (pepper) bomb:** a cloud that leaves everyone coughing and helpless. You carry 3, and one ripens every 30 s.
  - **Reflective flash:** unlocked with Suit v2.
- **Police on foot:** officers get out of their cars when you're on foot, on a roof, or out of the car's reach. At 2+ heat they shoot. Every shot is telegraphed by a red laser for about a second, so roll, break line of sight or keep moving fast.
- **Armed-robbery car chases:**
  - A getaway car flees and the passenger shoots back.
  - Stop it by bursting its tires with stones, or by skitching onto it, climbing onto the roof and smashing the windscreen.
  - Then take down the robbers and return the money to the POS lady.
- **Street Sense, reworked:**
  - Bullet-time, and lasers visible through walls.
  - A green **escape route** (the nearest rooftop out of police view) and the nearest transformer to cut.
  - Collector awareness ("UNAWARE: SNATCH IT") and the getaway car's weak points.
- **Respect and Suit v2:** tricks, flips, grinds, takedowns and good deeds earn Respect. At 2,500, Baba Kolade delivers Suit v2: tyre-rubber knee pads, reflective road-sign strips, the Ankara mask, +1 health and the flash.
- **Third Mainland Bridge and UNILAG:**
  - A long bridge over the lagoon with go-slow traffic (danfos, BRT buses, tankers) to skitch, plus a median and railings to grind.
  - Far-shore skyline lights across the lagoon.
  - The UNILAG gate and a small campus: the Senate building, Jaja Hall, Moremi Hall and palms.
- **Race to UNILAG:** start at the blue marker by the bridge and reach Ada at the gate before curfew. Your best time is recorded.

## Code map

```
src/
  main.js              boot, loop, title / pause / end flow
  world/layout.js      grid constants and helpers
  world/city.js        procedural district, collision boxes, rails, ramps, lights, blackout switch
  world/collision.js   spatial hash, ground height, cylinder push-out, line of sight, camera raycast
  world/vehicles.js    vehicle models from primitives
  world/traffic.js     lane graph, traffic AI, police pursuit, skitch / roof-ride queries
  player/rig.js        Bolaji's procedural rig, pose library, the skateboard
  player/player.js     movement modes and physics
  player/input.js      keyboard, mouse, gamepad
  game/game.js         jobs, chases, race, heat, officers, blackouts, Street Sense, gadgets, Respect, combat
  game/enemies.js      gunmen: police on foot and armed robbers (telegraphed shooting)
  game/fx.js           stones, pepper bombs and clouds, sparks, muzzle flashes, tracers, aim lasers
  game/npcs.js         agberos, traders, families, the money bag
  game/crowd.js        instanced pedestrians
  game/env.js          sky, stars, moonlight, bloom and grading
  game/audio.js        WebAudio synthesis
  game/camera.js       third-person camera
  ui/hud.js, style.css HUD and screens
```

## Obvious next steps

- **Replace the primitive Bolaji with a real rigged model** built from the concept art, with proper animation clips.
- **Build the real Surulere road layout** from OpenStreetMap data (Ojuelegba, Bode Thomas, Adeniran Ogunsanya).
- **Story:** Mama, Tobi, Baba Kolade, the Chairman, Inspector Okafor, and the UNILAG day/night split.
- **Movement:** wall-runs, more board tricks, and Gidigbo throws.
- **Suit v2 upgrade.**
