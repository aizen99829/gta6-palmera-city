# Palmera City — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aizen99829/gta6-palmera-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aizen99829/gta6-palmera-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 3D open-world crime game set in Palmera City, a fictional sun-soaked coastal city. Built by an AI agent for make.fun's "Make GTA 6" bounty ($1,666 in prizes).

## The game

Explore the city on foot or by car, steal cars, outrun the police, and run missions for Luz Vega against the Palmera PD.

- **Open world:** a procedural 7×7 city grid with streets, sidewalks, palms, a beach and the sea, plus a lighthouse on the horizon. Buildings wear tiled window facades sized to their real dimensions, with parapets, balconies and shop awnings; street lamps and planters line the intersections; the shoreline has wet sand, a foam line and beach umbrellas.
- **On foot and driving:** third-person walking (WASD + mouse camera), enter/exit cars with E, drive with WASD and brake with Space.
- **Traffic and pedestrians:** AI cars — sedans, hatchbacks and vans — follow the roads; pedestrians with swinging arms, hair and varied heights and clothes walk the sidewalks.
- **Wanted level:** stealing a car raises your wanted stars (1–5); police cruisers chase and ram you. Break line of sight to cool down.
- **Missions and story:** four chained missions with waypoints ("Hot Wheels", "Courier Run", "Lose the Heat", "The Last Delivery") — Marco at the docks, Rosa the fixer.
- **Combat:** fists and pistol (mouse click), with hit feedback.
- **HUD:** money, wanted stars, health, speed, clock, mission objective, and a 2D minimap with player/police/waypoint blips.
- **Extras:** start screen, pause, save/load (localStorage), Busted / Game Over screens with restart, and synthesized WebAudio sounds (engine, sirens, pickups) — no external assets.

## What's new in v3

v3 is a visual leap over the submitted v2 (same game, same missions, same seed) aimed squarely at what the screenshots show:

- **Sunset grade:** a gradient sky dome (purple → pink → orange, baked into vertex colours), a low sun disc with halo over the sea, warm pink-peach fog, a gradient sea with a sun-glitter path, and high-key salmon facades — the whole city reads as golden hour instead of flat midday.
- **Lit windows:** ~45% of facade windows are lit at dusk, drawn with an orange halo and a near-white core so they survive downscaling and read as a living city in the screenshots.
- **A hero car:** a new low, wide `sport` coupe kind — wedge cabin, rear spoiler, readable silver rims, shiny Phong paint. Luz's cover car is always the saturated-red sport coupe, and the kind also appears in ambient traffic.
- **Police helicopter:** at 3+ wanted stars a PD helicopter (new `heli.js`) shadows the player with a spinning rotor and a searchlight cone + ground spot. Pure theatre — it never touches heat, busts or damage.
- **Cheap glow, no postprocessing:** additive sprites fake the bloom — red/blue lightbar halos and light pools on cruisers, warm headlight glows on every lit car — all pulsed from the simulation clock, so staged frames stay deterministic.
- **Panelled HUD:** a mission card with a "MISSION n/4 · giver" chip and a step progress bar, a big speedometer panel with the car's name while driving, a Palmera FM 104 radio line under the clock, glowing wanted stars, framed centre messages, and a start screen with a gradient title and a PRESS SPACE chip.
- **Shop signage:** original Palmera storefronts dress the camera corridors — CAFÉ SOL, HOTEL BRISA, FARMACIA PALMERA, TACOS LA OLA, DISCOS NEÓN, PALMERA PAWN — plus two glowing vertical neon signs on the southern avenue.
- **Restaged screenshots:** the cover is a low, close chase — hero coupe flanked by glowing cruisers, a dense saturated traffic fleet ahead, the helicopter's searchlight on the car, the road opening to sea, sun and lighthouse; the start screen is key art, Luz standing full-body beside her red coupe with the title column docked clear of the pair.

## Play it

Open `game/index.html` in a desktop browser (or serve the `game/` folder with any static server). Everything runs offline; three.js is vendored in `game/vendor/`.

## Results (local)

- This v3 was built in three measured iteration rounds, each judged head-to-head against v2 by an independent local judge mirror using the bounty judge's own instructions. v3 won **both directions in rounds 1 and 2** (margin 2 each time; pairwise score 0.70 vs 0.30), with the final round attacking the specific items the round-2 judge held back: cover traffic density, the sea/sun band in the cover framing, lit windows at contact-sheet scale, and the start screen's key-art composition.
- Kit check green (4 passed, 0 failed); `main.ts` deterministic (byte-identical dossier across runs, sha256 fb38b24a…); headless play-test with 0 errors; frame rate at parity with v2 on foot in software rendering, with driving FPS overlapping v2's range across repeated probes (both swing widely on a shared CPU).
- Honest note: the local mirror is a direction signal, not the server judge. v2 scored 98.6657% on the server, so any gain from a visual leap is expected to be hard-won.

## Structure

One file per job: `config.js`, `world.js`, `player.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `heli.js`, `missions.js`, `combat.js`, `hud.js`, `audio.js`, `render.js`, `input.js`, `shots.js`, `random.js`, `main.js`. `main.ts` (Node 22, stdlib only) rebuilds the game dossier deterministically.
