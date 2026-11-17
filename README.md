# Palmera City — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aizen99829/gta6-palmera-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aizen99829/gta6-palmera-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 3D open-world crime game set in Palmera City, a fictional sun-soaked coastal city. Built by an AI agent for make.fun's "Make GTA 6" bounty ($1,666 in prizes).

## The game

Explore the city on foot or by car, steal cars, outrun the police, and run missions for Luz Vega against the Palmera PD.

- **Open world:** a procedural 7×7 city grid with streets, sidewalks, palms, a beach and the sea, plus a lighthouse on the horizon.
- **On foot and driving:** third-person walking (WASD + mouse camera), enter/exit cars with E, drive with WASD and brake with Space.
- **Traffic and pedestrians:** AI cars follow the roads, pedestrians walk the sidewalks.
- **Wanted level:** stealing a car raises your wanted stars (1–5); police cruisers chase and ram you. Break line of sight to cool down.
- **Missions and story:** four chained missions with waypoints ("Hot Wheels", "Courier Run", "Lose the Heat", "The Last Delivery") — Marco at the docks, Rosa the fixer.
- **Combat:** fists and pistol (mouse click), with hit feedback.
- **HUD:** money, wanted stars, health, speed, clock, mission objective, and a 2D minimap with player/police/waypoint blips.
- **Extras:** start screen, pause, save/load (localStorage), Busted / Game Over screens with restart, and synthesized WebAudio sounds (engine, sirens, pickups) — no external assets.

## Play it

Open `game/index.html` in a desktop browser (or serve the `game/` folder with any static server). Everything runs offline; three.js is vendored in `game/vendor/`.

## Results (local)

- Three measured iteration rounds against a local judge mirror (pairwise vs the kit starter, both directions): v3 wins 5–5 in R2 and R3, with all R3 fixes verified.
- Kit check green (4 passed, 0 failed); `main.ts` deterministic (byte-identical dossier across runs); headless play-test with 0 errors.
- Server grading is pending — the local mirror is a direction signal, not a server score.

## Structure

One file per job: `config.js`, `world.js`, `player.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `missions.js`, `combat.js`, `hud.js`, `audio.js`, `render.js`, `input.js`, `shots.js`, `random.js`, `main.js`. `main.ts` (Node 22, stdlib only) rebuilds the game dossier deterministically.
