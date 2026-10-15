# trenches.sim — design

A single-player satire of crypto twitter and memecoin trenches. It plays like a terminal: you scout coins, ape in, launch and bundle your own, shill to your followers and drill the chart. The world looks like it's full of AI agents. They're all scripted bots running off a content database. Nothing touches a network, and everything saves to `localStorage`.

## What was merged from the two drafts

| Kept | Cut / changed |
|---|---|
| Full loop: scout → ape / launch → bundle → shill → drill | Multiplayer, accounts, server |
| Bonding curve (pump-style virtual reserves, graduation) | Paid boosts, unlocks behind currency |
| CT feed as the main volume driver, follower power and trust | Real AI. Bots are scripted archetypes from a database |
| Bubblemap cluster scan (free, takes a moment) | Scan costs / cooldown economy |
| Detection arms race: sleuth bots expose bundles | Volume bot kept, but it costs in-game SOL only |
| Extraction Points with call/drill/speed/bundle multipliers | Progression gates. Everything's open from minute one |
| Achievements, fake local leaderboard, death epitaphs | |

## Time

- 1 tick = 250 ms real = 3 game seconds (1×). Speed 1×/2×/4×, space to pause.
- Coins live 15–60 game min, which is 75–300 s real. A full cycle fits in a couple of minutes.

## Market model

- Constant-product curve: `vSol = 30`, `vTok = 1.073B`, supply 1B, fee 1%. Start MC ≈ $5k. Graduates at 85 real SOL, then keeps trading as an AMM.
- Each coin has **hype** (attention). Retail buys arrive as a Poisson process `λ = hype·0.55·(flagged ? .35 : 1)`, with log-normal sizes. Hype decays every tick. Momentum (3-candle move) feeds back into hype, up or down.
- Retail holders take profit or panic sell based on their own PnL and recent candles.
- **Waves**: a call (from a KOL bot or from you) queues a stream of follower buys over 10–16 ticks. Buys from your waves are tagged `viaCall`, which is how extraction and the rekt count get attributed to you.

## AI coin scripts (the "agents")

| Script | Bundle | Behaviour |
|---|---|---|
| `bundle_rug` | 22–58% | Insiders sit, maybe a paid KOL calls, then they drill at 2–6× |
| `dev_dump` | 3–12% | Dev sells the first 1.3–2.4× pump in one candle |
| `kol_pump` | 8–22% | KOL front-runs, calls, then sells into their own followers |
| `organic` | 0–6% | Real runner potential, narrative boosts, can graduate |
| `slow_bleed` | 15–35% | Insiders drip-sell from early on |

Snipers grab block 0 on every launch and dump into the first pump. The **sleuth** agent periodically scans coins above $12k. If a coin's detect score clears a random threshold, the sleuth posts a callout: the coin gets **FLAGGED** (hype halved, calls 70% weaker).

The agent log (bottom left) streams what every bot is "thinking". That stream is what sells the illusion.

## Player

- Starts with 25 SOL, 1,337 followers and 50 trust.
- **Follower power** = `√followers / 12 · (0.25 + trust/100)`.
- **Call** wave SOL = `power · 6 · template · degenScore(text) · spam⁻ · holderConcentration⁻ · flagged⁻ · momentum`.
- **FUD** a coin: correct if it's actually bundled (it gets flagged, you gain trust and XP), otherwise you get ratio'd.
- **Shitpost**: farms followers, no market effect.
- Selling more than 30% within 120 s of your own call is a dump on your followers: trust and followers drop, and the replies turn on you.

## Launch and bundle

The inputs are name, ticker, emoji or image, supply % (0–70), wallets (1–20), Jito tip and a fresh-funding toggle. A live `$ pump deploy …` command line previews the deploy.
- Low tip means snipers take 3–9% before you.
- `detect = pct·1.15 + fewWalletsPenalty + bigTipPenalty − fresh − spread ± noise`. The risk meter reads LOW / SUS / OBVIOUS / FEDS WATCHING.

## Extraction Points (on every sell)

```
profit: pnl·100 × callMult(≤2.5, sold into your wave within 5m)
                × drill 1.25 × speed (launch→dump <10m 1.5, <20m 1.2)
                × cleanBundle (1+pct/100 if unflagged) × flagged 0.6
loss:   pnl·40  ("cope")
death:  +8 XP per follower left holding a bag from your call
```

## The "browser"

The game is a fake browser. You hop between sites (keys `1`–`6`, back/forward, tab badges), and every action ripples into the other tabs:

| Site | What you do there |
|---|---|
| **trench.term** | Pairs list, candle chart with B/S/CALL/KOL/FLAG/DRILL markers, tape, holders, buy/sell/DRILL, agent log |
| **y.com** | CALL / FUD / SHITPOST composer, the CT feed with drafting indicators, reply guys, trending, callouts |
| **bundl.fun** | Deploy and bundle (live `pump deploy` command preview, detection meter), per-wallet sells, DRILL ALL, vol bot |
| **bubblemapz** | Cluster scan with funding-graph bubbles and a verdict. Scanning a bag you already hold is an achievement |
| **telegrum** | kev (pre-launch and KOL-call leaks for 0.25 SOL), VIP alpha group (1 SOL, warns you ~20 s before KOL calls, admin dumps on members), bribe or snitch to sherlock (55% works, 45% gets screenshotted), mom (bailouts), angry/grateful follower DMs |
| **kolscam** | Stats, achievements, leaderboard, wipe save |

## Systems added in v2

- **Visual system:** Geist and Geist Mono, neutral near-black surfaces, hairline borders, and trading green and red used only to carry meaning. No glows. CRT scanlines are an opt-in setting. Notifications sit at the top center.
- **Live SOL price:** a random walk with event drift. Every mcap is in USD, so SOL moves shift the whole board.
- **World events** (every ~4–6 game min): supercycle, SOL dump, SOL ATH, Sherlock on vacation (no flags), RPC outage (30% of your txs fail), rug season, celebrity coin (an attention vacuum), CTO szn (dead coins revive), KOL payroll leak (your calls hit harder).
- **Telegrum:**
  - TrenchBot auto-snipes every launch.
  - The cabal invites you at 2.5k followers or 2 launches. You get a block-0 allocation, call on their signal and get paid. Selling early gets you kicked and publicly called out.
  - The KOL agency books a KOL onto your coin. The KOL front-runs it, naturally.
  - Anon devs offer SOL for paid shills. Your followers find out when the coin dies, and sometimes Sherlock posts receipts.
  - Unknown senders spam mod, CM, raid and trending services (some deliver, most take the SOL and block you) and drainer links. Clicking a link drains 35–75% of your SOL.
  - Your ex shows up after big wins and losses.
- **PnL card:** every full exit snapshots a shareable 1200×630 card (canvas) with PNG export.

## Screens

- **Boot**: typed terminal boot, handle prompt, loading tips.
- **Main**: top bar (clock, speed, SOL, XP, followers, trust), a ticker tape, and three panes:
  - Left: pairs list (new / trending / bags / graveyard) and the agent log.
  - Center: coin header, canvas candle chart with markers, trade/drill panel, tape and holders.
  - Right: composer (CALL / FUD / SHITPOST) and the CT feed with typing indicators.
- **Modals**: launch (deploy terminal), scan (bubblemap), menu (stats, achievements, leaderboard, settings/reset).
- **FX**: drill glitch overlay, screen shake, red/green flashes, floating XP, synth blips.

## Code layout

```
src/game/      pure-ish sim: types, curve, market, engine (tick), actions, store, fx, audio
src/game/data  coins, bots, lines (all the writing lives here)
src/ui/        React components; chart is canvas + rAF reading the world directly
```
The world is one mutable object. A version counter plus `useSyncExternalStore` re-renders React each tick. Persistence lives under the `trenches.v1` key.
