# VAULTBREAK — Five Heists, One Night

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Eizdy-ez/heist-protocol/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Eizdy-ez/heist-protocol/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist game for the make.fun "Make the best heist game" bounty. Five buildings, one night: sneak past guards with vision cones and sweeping cameras, crack every vault, and run for the green EXIT before the alarm meter hits 100.

## How to play

- **Move:** WASD / arrow keys, or click anywhere to walk there
- **Goal:** crack every vault in the building, then reach the green EXIT
- **[1] Smoke Pellet — $150:** blinds guards and cameras inside its cloud for 4.5s
- **[2] Decoy Coin — $100:** tossed ahead of you; the nearest guard walks over to look
- **[3] Sonar Pulse — 2 per heist:** reveals every guard's patrol route through walls for 5s — but guards within earshot hear it and come looking
- **Tall grass** hides you unless a guard is very close (48 px). **Lamp light** exposes you. The HUD shows your visibility: SEEN / HIDDEN / SHADOW / EXPOSED
- **P** pause, **R** retry the heist, **1–5** on the title screen picks a heist

## The five heists

1. **The Corner Bank** — 2 guards, 1 camera, 1 vault
2. **The Sapphire Gallery** — 3 guards, 2 cameras, 2 vaults
3. **The Emerald Casino** — 3 guards, 3 cameras, 2 vaults
4. **The Crimson Museum** — 4 guards, 3 cameras, 3 vaults
5. **The Obsidian Vault** — 5 guards, 4 cameras, 3 vaults

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Static files only — no build step, no network requests. Built with Node 22 and a desktop browser. Entry for the make.fun bounty at https://make.fun/bounty/best-heist-game-20261122-0559
