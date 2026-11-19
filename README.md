# Palmera City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aizen99829/gta6-palmera-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aizen99829/gta6-palmera-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world driving game set in a sunset-drenched coastal
city, built with Three.js and procedural canvas art — no downloaded
assets, no network calls. You are **Luz Vega**, a courier working off a
debt for fixer **Rosa** and dock boss **Marco**, one job at a time,
while the **Palmera PD** does its best to stop you.

## Features

- A full city at golden hour: a 7×7 road grid, lit building facades,
  instanced boulevard palms, two-sided billboards, the **HOTEL
  MIRAMAR**, a beach, a marina and a lighthouse — all generated from
  one seeded RNG, so a given `?seed=` always builds the same city.
- Five story chapters: steal-and-deliver, a two-drop courier run, a
  heat-and-evade job, a final delivery, and the **Paper Trail** coda
  whose last drop only counts if you arrive *unseen*. Chapters 1–4 pay
  exactly $3,700 in total; chapter 5 adds $1,200.
- A real wanted system: heat from witnessed crime, up to five stars,
  up to seven pursuit units, and genuine **roadblocks** — cruisers
  parked across the road ahead of you at three stars or more. A PD
  helicopter orbits with a live searchlight at high heat.
- Two real weapons: the pistol **La Chica** and Rosa's gift, the
  full-auto SMG **La Ráfaga** (32-round magazine), each with its own
  ammunition and reload.
- Paneled, glossy low-poly cars (sedan, hatch, van, taxi, the Alisio
  GT sport coupé, PD interceptors) with arcade physics and a top speed
  of exactly 38.00 m/s.
- A dense HUD: mission card with stage segments and next-step line, a
  live Palmera PD response panel, a round picture minimap drawn from
  the real city, dialog with portraits, the **ONDA ROSA 98.3** radio
  card, vehicle condition and speedometer, wanted IN SIGHT / HIDDEN
  indicator, health, armor and respect.
- Full touch controls on mobile (virtual stick, GAS/BRK pedals, E
  button, drag camera) and a responsive HUD with zero panel overlap at
  390×844, 360×640 and 844×390.
- Adaptive resolution on desktop (2.0 → 1.25 ladder driven by frame
  time), pure WebAudio synth sound — engine, siren, gunfire and a
  radio melody — and a localStorage save that restores money, chapter
  and position exactly.

## Controls

| Input | Action |
|---|---|
| WASD / arrows / stick | Walk or drive |
| Shift | Run |
| E / E button | Enter or exit a car |
| Mouse drag | Orbit camera |
| Mouse hold | Aim and fire |
| R | Reload |
| 1 / 2 | Pistol / SMG |
| F | Punch |
| Space | Brake (and confirm on menus) |
| Esc | Pause |

## Run it locally

```sh
node serve.ts          # serves game/ at http://localhost:8080/
# or open game/index.html directly in a browser
node main.ts           # build the make.fun dossier into /output
```

Deterministic screenshot staging is available through
`game/index.html?shot=chase|street|mission|start&seed=7`, and
`?play=1` skips the start screen.

## License

MIT — see `LICENSE`.
