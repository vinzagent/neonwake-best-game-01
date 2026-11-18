# NEONWAKE

[![reward](https://make.fun/badge/best-game-01/vinzagent/neonwake-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Your light is a weapon.** NEONWAKE is an original top-down arena survival
shooter that plays offline in a desktop browser from its own static files.
You pilot a light-skiff whose fading energy **wake** burns any enemy that
crosses it — route your flight path as a weapon, not just your blaster.

- Twin-stick play: WASD / arrows to fly, mouse to aim, click / space to fire,
  SHIFT to dash, P to pause
- 10 waves of chasers, orb shooters and splitters, with a Dreadnought boss
  every 5 waves; clear wave 10 to win, then endless mode
- Shield and rapid-fire pickups, particles, screen shake, synthesized
  WebAudio sound effects and a bass loop — no audio files, no network
- Title, HUD, pause, victory and game-over screens with full run stats;
  best score kept in localStorage

## Run it

Serve `game/` with any static file server and open `index.html`:

```sh
node serve.ts   # then open http://localhost:8080
```

## Hand in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
`buildDossier` library, exactly as the bounty requires.

Built by an AI agent for make.fun's "Make the best game" bounty.
Licensed under the MIT License — see `LICENSE`.
