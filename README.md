# Palmera City — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aizen99829/gta6-palmera-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aizen99829/gta6-palmera-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 3D open-world crime game set in Palmera City, a fictional sun-soaked coastal city. Built by an AI agent for make.fun's "Make GTA 6" bounty ($1,666 in prizes).

## The game

Explore the city on foot or by car, steal cars, outrun the police, and run missions for Luz Vega against the Palmera PD.

- **Open world:** a procedural 7×7 city grid with streets, sidewalks, palms, a beach and the sea, plus a lighthouse on the horizon. Buildings wear tiled window facades sized to their real dimensions, with parapets, balconies and shop awnings; street lamps and planters line the intersections; the shoreline has wet sand, a foam line and beach umbrellas. Roads carry a procedural asphalt texture — aggregate grain, repair patches, hairline cracks and polished tyre bands — with wet streaks and glossy puddles on the hero streets.
- **On foot and driving:** third-person walking (WASD + mouse camera), enter/exit cars with E, drive with WASD and brake with Space. Cars are modelled, not boxes: sloped hood and trunk panels, a glass cabin band with pillars, mirrors, bumpers, grilles, side skirts and spinning hubcaps.
- **Touch controls:** on coarse-pointer devices a virtual joystick, GAS/BRK pedals, an enter/exit button and drag camera take over, with a responsive HUD audited at 390×844, 360×640 and 844×390 with zero overlaps.
- **Traffic and pedestrians:** AI cars — sedans, hatchbacks and vans — follow the roads; pedestrians with swinging arms, hair and varied heights and clothes walk the sidewalks.
- **Wanted level:** stealing a car raises your wanted stars (1–5, all five now reachable); up to 7 police units chase and ram you, park across the road as real roadblocks at high heat, and a helicopter with a searchlight joins the hunt. Break line of sight to cool down.
- **Missions and story:** five chained missions with waypoints ("Hot Wheels", "Courier Run", "Lose the Heat", "The Last Delivery", "Paper Trail") — Marco at the docks, Rosa the fixer. A full run pays $4,900.
- **Combat:** fists, a pistol, and the "La Ráfaga" SMG (unlocks in chapter 3, 32-round magazine, automatic fire), with hit feedback.
- **HUD:** money, wanted stars, health, speed, clock, mission objective, and a bright 2D minimap with player/police/waypoint blips.
- **Adaptive sharpness:** on fine pointers the renderer starts at pixel ratio 2.0 and steps down (1.75 → 1.5 → 1.25) only as frame time demands, stepping back up when it can; touch devices keep a static 1.5 cap.
- **Extras:** start screen, pause, save/load (localStorage), Busted / Game Over screens with restart, and synthesized WebAudio sounds (engine, sirens, pickups) — no external assets.

## Play it

Open `game/index.html` in a desktop browser (or serve the `game/` folder with any static server). Everything runs offline; three.js is vendored in `game/vendor/`.

## Results (local)

- This v5.3 is the fifth major pass over the scored v2 (server judge 98.6657%): a full mobile/touch fix, a parity pass (lighting and gloss, brighter minimap, 7 police units with real roadblocks, a real SMG, a fifth mission), a sharpness pass, and a final visual pass (car remodel, procedural wet-look asphalt, adaptive resolution).
- Regression contract held across every pass: top speed exactly 38.00 m/s, busted fine exactly −$100, full touch playthrough of chapters 1–4 pays exactly $3,700 with 0 busts, save/restore restores exactly, 0 page errors in every test suite, forbidden-name sweep 0 hits.
- Dossier screenshots are 1920×1080 PNG; `game/` totals 888,396 bytes (cap 48 MiB).
- Honest note: local measurements are direction signals, not the server judge. Cars remain low-poly by design (about 14 small meshes per car is the cheap ceiling before draw calls threaten frame rate), streets are wet-look rather than full mirrors, and buildings stay uniform boxes whose positions are tied to gameplay colliders.

## Structure

One file per job: `config.js`, `world.js`, `textures.js`, `player.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `heli.js`, `missions.js`, `combat.js`, `hud.js`, `audio.js`, `render.js`, `input.js`, `shots.js`, `random.js`, `main.js`. `main.ts` (Node 22, stdlib only) rebuilds the game dossier deterministically.
