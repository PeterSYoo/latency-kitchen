# Latency Kitchen

A browser game that teaches engineers to cut p95 and p99 latency by running a simulated restaurant kitchen. Orders are requests, cooks are workers, and the ticket rail is the queue. Each level sets a latency target and teaches one technique for hitting it: hedging, utilization, queue order and load shedding, caching, timeouts with retries and cancellation, fan-out with quorums, and staggered pauses.

The core lesson: tail latency comes from variance and queueing, not average speed. Adding cooks rarely fixes p99, and the game is tuned so that it doesn't.

**Play:** https://petersyoo.github.io/latency-kitchen/

## Levels

| # | Level | Technique | The trap |
| --- | --- | --- | --- |
| 1 | Fix the stragglers | Hedging | Six cooks barely move p99 |
| 2 | Rush hour | Utilization | p99 climbs steeply past ~75% busy |
| 3 | Who goes first | FIFO/LIFO, shedding | LIFO looks great at p50 |
| 4 | The walk-in fridge | Cache | The hit rate drops during a burst |
| 5 | Give up and try again | Timeouts, retries, cancellation | Retries without cancellation start a retry storm |
| 6 | The banquet | Fan-out, quorum | The slowest of ten dishes sets the table's time |
| 7 | Everyone freezes | Shared stalls | Hedging can't help when every cook freezes |
| 8 | Head chef | Everything | Free play, scored |

## How it works

- `src/sim`: a seeded discrete-event simulation in plain TypeScript, with no DOM, React or wall clock. The same seed and controls always give the same result.
- `src/game`: a play session (sampling every 500 simulated ms, goals, hold window, stars), the frame loop, a Zustand store, saved progress and hash routing.
- `src/levels`: one file per level: workload, controls, goals, stars, insight rules and a known solution.
- `src/views` and `src/ui`: Canvas 2D charts and the React screens.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/latency-kitchen/
npm test           # engine, lesson and level tests (Vitest)
npm run test:e2e   # Playwright: every level cleared through the UI
npm run build      # static site in dist/
```

Playwright runs Chromium and Firefox locally. WebKit needs system libraries; CI installs them, or run `PW_ALL=1 npm run test:e2e` once they're present.

Every level has lesson tests that pin its teaching (for example, "LIFO helps p50 and hurts p99"), and CI checks that each level opens failing, clears with its stored solution and that every star is winnable. When a lesson test fails, tune the level config, not the engine, unless the engine is wrong.

## Deploy

Pushes to `main` run the tests, build, and publish to GitHub Pages (`.github/workflows/deploy.yml`). Pull requests run the same checks in `.github/workflows/ci.yml`. Routes use the URL hash (`#/level/3`), so reloads work on a static host.
