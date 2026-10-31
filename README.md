# drAGhts

drAGhts — draughts that missed U! 

Chaotic checkers with toggleable rule variations, playable player vs player (hot-seat) or against the computer.

This is the standalone development build of a game for the annoyinggoods.com playground, ported into the AG-web-2 website.

## Run it

Requires Node 20 or newer.

```
npm install
npm run build
npm run serve
```

Then open http://127.0.0.1:8080.

## Development

- `npm run build` — compile TypeScript in `src/` to plain ESM in `scripts/`.
- `npm run lint` — type-check without emitting.
- `npm test` — build, then run the engine test suite (`node --test`).
- `npm run test:ui` — build, then run Playwright UI tests (first time: `npx playwright install chromium`).


The alpha-beta search in the computer player is adapted from [rapid-draughts](https://github.com/loks0n/rapid-draughts) by loks0n (MIT).
