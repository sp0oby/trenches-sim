# trenches.sim

A single-player satire of memecoin trenches and crypto twitter. You play inside a fake browser. Hop between a trading terminal, a CT feed, a bundler site, bubblemaps, Telegram and a KOL leaderboard. Launch coins, bundle them, shill to your followers, take insider "alpha", get drained by DM links, and drill the chart for Extraction Points.

Everything is simulated locally. The bots, KOLs, sleuths and "AI agents" are scripted, there's no backend, and no real money is involved. Progress saves to `localStorage`.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Controls

| Key | Action |
|---|---|
| `1`–`6` | Switch site |
| `space` | Pause |
| `shift` + `D` | Drill the selected coin |
| `alt` + `←/→` | Back / forward |

## Stack

React 19, Vite, TypeScript and GSAP. The chart is a hand-drawn canvas, and fonts are Geist and Geist Mono. See [DESIGN.md](DESIGN.md) for the game systems, formulas and tuning knobs.

*None of this is financial advice. All of it is financial damage.*
