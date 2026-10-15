import { INIT_V_SOL, INIT_V_TOK, TOTAL_SUPPLY } from './constants'
import * as L from './data/lines'
import { BOT_BY_ID } from './data/bots'
import { addPost, flagCoin, followerPower, log, makeCoin, queueReply, rollLaunch, unlock } from './engine'
import { bundleBuy, changeOver, clusterPct, costForTokens, execBuy, execSell, mark, mcUsd, playerHolders, playerPosition, solPx, topHoldersPct } from './market'
import type { Coin, World } from './types'
import { addr, chance, clamp, fill, pick, rand, randInt } from './util'
import { fx, toast } from './fx'
import { sfx } from './audio'
import { chatSend } from './chat'
import { AGENCY, acceptPaid, answerSpam, bookKol, eventMods, exReact, onPlayerCall, onPlayerSell, requestCabalPlay } from './systems'

const tk = (c: Coin) => `$${c.ticker}`

/** RPC outage event: some transactions just don't land */
function txFails(w: World) {
  if (!eventMods(w).outage || !chance(0.3)) return false
  toast('bad', 'transaction failed', pick(['blockhash not found', 'block height exceeded', 'RPC 429: too many requests', 'simulation failed: slippage exceeded']))
  sfx.bad()
  unlock(w, 'rpc_fail')
  return true
}

// ---------- trading ----------

export function buy(w: World, coinId: string, sol: number) {
  const c = w.coins[coinId]
  if (!c) return
  sol = Math.min(sol, w.player.sol - 0.001)
  if (sol < 0.005) {
    toast('bad', 'insufficient SOL', 'you are broke. ask mom on telegram or cope.')
    sfx.bad()
    return
  }
  if (txFails(w)) return
  execBuy(w, c, 'you:main', 'player', sol, { cluster: c.byPlayer ? 'you' : undefined, label: 'YOU' })
  c.pc.firstBuyAt ??= w.t
  mark(w, c, 'B')
  w.player.stats.trades++
  unlock(w, 'first_blood')
  sfx.buy()
  fx({ type: 'float', text: `-${sol.toFixed(2)} SOL`, tone: 'g' })
  if (c.status === 'dead') toast('info', 'you bought a dead coin', 'necromancy is not a strategy.')
  else if (c.flagged && chance(0.5)) toast('info', `buying flagged ${tk(c)}`, 'bold. stupid, but bold.')
}

export interface SellResult {
  sol: number
  pnl: number
  xp: number
  notes: string[]
}

export function sell(w: World, coinId: string, frac: number, drill = false): SellResult | null {
  const c = w.coins[coinId]
  if (!c) return null
  const hs = playerHolders(c)
  if (!hs.length) {
    toast('bad', 'nothing to sell', 'you have to own the bag to dump the bag.')
    return null
  }
  const p = w.player
  if (txFails(w)) return null
  onPlayerSell(w, c)
  let solOut = 0
  let costOut = 0
  const tokensBefore = playerPosition(c).tokens
  for (const h of hs) {
    const r = execSell(w, c, h.id, frac >= 0.999 ? h.tokens : h.tokens * frac)
    solOut += r.sol
    costOut += r.cost
  }
  const tokensSold = tokensBefore - playerPosition(c).tokens
  c.pc.soldCost = (c.pc.soldCost ?? 0) + costOut
  c.pc.soldSol = (c.pc.soldSol ?? 0) + solOut
  const pnl = solOut - costOut
  const x = costOut > 0 ? solOut / costOut : 0
  const notes: string[] = []
  let xp: number
  const sinceCall = c.pc.callAt != null ? w.t - c.pc.callAt : Infinity

  if (pnl > 0) {
    let mult = 1
    if (sinceCall < 300 && c.pc.callSol > 0.5) {
      const m = 1 + Math.min(1.5, c.pc.callSol / 15)
      mult *= m
      notes.push(`sold into your call ×${m.toFixed(2)}`)
    }
    if (drill) {
      mult *= 1.25
      notes.push('drill ×1.25')
    }
    if (c.byPlayer && c.pc.launchT != null) {
      const cyc = w.t - c.pc.launchT
      if (cyc < 600) {
        mult *= 1.5
        notes.push('speed kills ×1.5')
        if (c.pc.calls > 0) unlock(w, 'speed')
      } else if (cyc < 1200) {
        mult *= 1.2
        notes.push('quick cycle ×1.2')
      }
    }
    if (c.byPlayer && c.bundlePct > 15 && !c.flagged) {
      const m = 1 + c.bundlePct / 100
      mult *= m
      notes.push(`clean bundle ×${m.toFixed(2)}`)
    }
    if (c.flagged) {
      mult *= 0.6
      notes.push('flagged ×0.6')
    }
    xp = Math.round(pnl * 100 * mult)
  } else {
    xp = Math.round(pnl * 40)
    notes.push('cope')
  }

  bookSell(w, c, pnl, x, xp)
  mark(w, c, drill ? 'D' : 'S')

  const dumpNote = checkDumpOnCall(w, c, tokensSold)
  if (dumpNote) notes.push(dumpNote)

  if (drill) {
    p.stats.drills++
    if (xp > p.stats.biggestDrill) p.stats.biggestDrill = xp
    if (p.stats.drills >= 10) unlock(w, 'driller')
    fx({ type: 'drill', xp, ticker: c.ticker, lines: notes })
    fx({ type: 'shake' })
    fx({ type: 'flash', color: 'red' })
    sfx.drill()
    log(w, 'drill-ops', `@${p.handle} drilled ${tk(c)} — ${solOut.toFixed(2)} SOL out, ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} pnl`, 'r')
  } else {
    sfx.sell()
    fx({ type: 'float', text: `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} SOL`, tone: pnl >= 0 ? 'g' : 'r' })
  }
  if (!drill && Math.abs(xp) >= 1) toast(pnl >= 0 ? 'xp' : 'bad', `${xp >= 0 ? '+' : ''}${xp.toLocaleString()} XP`, notes.join(' · '))
  exReact(w, pnl)
  if (playerPosition(c).tokens <= 0) recordFlex(w, c, drill)
  return { sol: solOut, pnl, xp, notes }
}

/**
 * Dumping on your own call: once more than 30% of what you held at call time is sold
 * within 2 minutes (any mix of sells, drills or single-wallet sells), trust takes the hit. Once per call.
 */
function checkDumpOnCall(w: World, c: Coin, tokensSold: number): string | null {
  const pc = c.pc
  const p = w.player
  if (pc.callAt == null || pc.callDumped || !pc.callTokens || tokensSold <= 0) return null
  const since = w.t - pc.callAt
  if (since >= 120) return null
  pc.callSold = (pc.callSold ?? 0) + tokensSold
  const frac = Math.min(1, pc.callSold / pc.callTokens)
  if (frac <= 0.3) return null
  pc.callDumped = true
  pc.callRewarded = true // a dumped call can't also "print"
  const cringe = pc.cringe ?? 1
  const lostTrust = Math.round((6 + frac * 10) * cringe)
  const lostF = Math.round(p.followers * rand(0.03, 0.08) * frac * cringe)
  p.trust = clamp(p.trust - lostTrust, 0, 100)
  p.followers = Math.max(10, p.followers - lostF)
  p.stats.dumpedOwnCall++
  unlock(w, 'own_call')
  const callPost = w.feed.find((x) => x.author === 'player' && x.coinId === c.id && x.kind === 'call')
  if (callPost) queueReply(w, callPost, L.R_DUMP_OWN, randInt(2, 4), { H: p.handle, T: tk(c), S: Math.round(since) }, 2, 20)
  chatSend(w, 'fans', 'them', pick(L.FAN_DUMP).replace('{T}', tk(c)), rand(1500, 4000), `anon_${randInt(100, 9999)}`)
  log(w, 'follower-swarm', `@${p.handle} sold ${tk(c)} ${Math.round(since)}s after calling it. ${lostF} unfollows.`, 'r')
  return `dumped on own call: -${lostTrust} trust, -${lostF} followers`
}

/** bookkeeping shared by every player sell path */
function bookSell(w: World, c: Coin, pnl: number, x: number, xp: number) {
  const p = w.player
  p.xp += xp
  c.pc.profit += pnl
  c.pc.posXp = (c.pc.posXp ?? 0) + xp
  p.stats.realized += pnl
  p.stats.trades++
  if (x > p.stats.bestX) p.stats.bestX = x
  if (x >= 10) unlock(w, 'tenx')
  if (x > 0 && x <= 0.2) unlock(w, 'exit_liq')
}

/** snapshot a closed position for the PnL card, then reset per-position counters */
function recordFlex(w: World, c: Coin, drill: boolean) {
  const invested = c.pc.soldCost ?? 0
  const out = c.pc.soldSol ?? 0
  if (invested >= 0.01) {
    c.pc.flex = {
      ticker: c.ticker,
      emoji: c.emoji,
      hue: c.hue,
      image: c.image,
      invested,
      out,
      pnl: out - invested,
      xp: c.pc.posXp ?? 0,
      held: w.t - (c.pc.firstBuyAt ?? c.pc.launchT ?? w.t),
      rekt: Object.values(c.holders).filter((h) => h.viaCall && h.kind === 'retail' && h.tokens > 0).length,
      drill,
    }
    w.lastFlex = c.id
  }
  c.pc.soldCost = 0
  c.pc.soldSol = 0
  c.pc.posXp = 0
  c.pc.firstBuyAt = undefined
}

export function sellWallet(w: World, coinId: string, walletId: string) {
  const c = w.coins[coinId]
  const h = c?.holders[walletId]
  if (!c || !h || h.tokens <= 0) return
  if (txFails(w)) return
  onPlayerSell(w, c)
  const sold = h.tokens
  const { sol, cost } = execSell(w, c, walletId, h.tokens)
  const dumpNote = checkDumpOnCall(w, c, sold)
  if (dumpNote) toast('bad', 'dumped on your own call', dumpNote)
  c.pc.soldCost = (c.pc.soldCost ?? 0) + cost
  c.pc.soldSol = (c.pc.soldSol ?? 0) + sol
  const pnl = sol - cost
  const xp = Math.round(pnl > 0 ? pnl * 100 : pnl * 40)
  bookSell(w, c, pnl, cost > 0 ? sol / cost : 0, xp)
  mark(w, c, 'S')
  sfx.sell()
  fx({ type: 'float', text: `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} SOL`, tone: pnl >= 0 ? 'g' : 'r' })
  exReact(w, pnl)
  if (playerPosition(c).tokens <= 0) recordFlex(w, c, false)
}

// ---------- launching ----------

export interface LaunchParams {
  name: string
  ticker: string
  emoji: string
  image?: string
  desc: string
  pct: number
  wallets: number
  tip: number
  fresh: boolean
}

export function estimateLaunch(lp: LaunchParams) {
  const tokens = (lp.pct / 100) * TOTAL_SUPPLY
  const bundleCost = lp.pct > 0 ? costForTokens(INIT_V_SOL, INIT_V_TOK, tokens) : 0
  const fees = 0.02 + lp.tip + (lp.fresh ? 0.004 * lp.wallets : 0)
  const risk = lp.pct * 1.15 + (lp.wallets <= 2 && lp.pct > 10 ? 12 : 0) + (lp.tip >= 0.3 ? 8 : 0) - (lp.fresh ? 8 : 0) - Math.min(6, lp.wallets * 0.4)
  const label = risk < 12 ? 'LOW' : risk < 26 ? 'SUS' : risk < 42 ? 'OBVIOUS' : 'FEDS WATCHING'
  const sniper = lp.tip < 0.05 ? '3–9% (snipers eat first)' : lp.tip < 0.15 ? '0–4%' : '~0% (tip too fat to front-run)'
  return { bundleCost, fees, total: bundleCost + fees, risk: Math.max(0, risk), label, sniper, avgEntryMc: lp.pct > 0 ? (bundleCost / tokens) * TOTAL_SUPPLY * solPx.usd : 0 }
}

export function launch(w: World, lp: LaunchParams): Coin | null {
  const est = estimateLaunch(lp)
  if (est.total > w.player.sol) {
    toast('bad', 'not enough SOL', `need ${est.total.toFixed(2)}, have ${w.player.sol.toFixed(2)}. bundle less, regard.`)
    sfx.bad()
    return null
  }
  const p = w.player
  const ticker = lp.ticker.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10) || 'RUG'
  const c = makeCoin(
    w,
    { name: lp.name.trim() || ticker, ticker, emoji: lp.emoji, desc: lp.desc.trim() || 'no description. no roadmap. no remorse.' },
    'player',
    true,
    { kind: 'player', targetX: 0, dumpAge: 0, dumpRate: 0, maxLife: 3600 },
    lp.image,
  )
  p.sol -= est.fees
  const sniperPct = lp.tip < 0.05 ? rand(3, 9) : lp.tip < 0.15 ? rand(0, 4) : 0
  if (sniperPct > 0.3) bundleBuy(w, c, sniperPct, randInt(2, 5), 'sniper', '')
  // snipers moved the curve, so the bundle now costs more than the estimate.
  // shrink it to what the wallet can actually pay instead of going negative.
  let pct = lp.pct
  const budget = p.sol - 0.001
  while (pct > 0 && costForTokens(c.vSol, c.vTok, (pct / 100) * TOTAL_SUPPLY) > budget) pct = Math.max(0, pct - 0.5)
  if (pct < lp.pct) log(w, 'jito', `snipers front-ran you — bundle trimmed from ${lp.pct}% to ${pct.toFixed(1)}% to fit your balance`, 'a')
  if (pct > 0) {
    const ids = ['you:main', ...Array.from({ length: lp.wallets - 1 }, () => `you:${addr(6)}`)]
    bundleBuy(w, c, pct, lp.wallets, 'player', 'you', ids, 'DEV')
  }
  c.bundlePct = Math.round(pct * 10) / 10
  c.bundleWallets = lp.wallets
  c.detect = est.risk + rand(-6, 6)
  c.launchMc = mcUsd(c)
  c.pc.launchT = w.t
  c.hype = 1 + followerPower(p) * 0.25
  mark(w, c, 'L')
  p.stats.launched++
  unlock(w, 'dev')
  if (p.stats.launched >= 10) unlock(w, 'serial')

  log(w, 'deployer-farm', `@${p.handle} deployed ${tk(c)} "${c.name}"`, 'g')
  if (lp.pct > 0) log(w, 'jito', `bundle landed: ${lp.wallets} wallets, ${c.bundlePct.toFixed(1)}% of supply, tip ${lp.tip} SOL`, 'g')
  log(w, 'sniper-swarm', sniperPct > 0.3 ? `${tk(c)} front-ran your bundle for ${sniperPct.toFixed(1)}%. low tip = free food` : `${tk(c)} tip too high. snipers starving.`, sniperPct > 0.3 ? 'r' : 'c')
  if (chance(0.6)) addPost(w, 'news', fill(pick(L.NEWS_LAUNCH), { T: tk(c), NAME: c.name }), { coinId: c.id, kind: 'news' })
  if (est.risk > 30 && chance(0.7)) {
    w.pending.push({ at: w.t + rand(10, 30), bot: 'dep1', text: `someone launched ${tk(c)}. bundled? obviously. respect the hustle`, coinId: c.id, kind: 'shitpost' })
  }
  w.selected = c.id
  sfx.launch()
  fx({ type: 'flash', color: 'green' })
  return c
}

export function toggleVolBot(w: World, coinId: string) {
  const c = w.coins[coinId]
  if (!c || c.status === 'dead') return
  c.pc.volBot = !c.pc.volBot
  if (c.pc.volBot) {
    unlock(w, 'vbot')
    log(w, 'vol-bot', `spinning up wash wallets on ${tk(c)}. 0.024 SOL/s. sleuths may notice`, 'c')
  }
}

// ---------- posting ----------

export type PostMode = 'call' | 'fud' | 'shitpost'

export function degenScore(text: string, ticker?: string) {
  let s = 1
  const emojis = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length
  s += Math.min(0.2, emojis * 0.05)
  if (ticker && text.toUpperCase().includes(`$${ticker}`)) s += 0.1
  const letters = text.replace(/[^a-z]/gi, '')
  if (letters.length > 6 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) s += 0.1
  const hits = (text.toLowerCase().match(/\b(moon|send|sending|lfg|early|1000x|100x|gem|runner|cooking|ape|generational)\b/g) ?? []).length
  s += Math.min(0.2, hits * 0.05)
  if (text.trim().length < 6) s -= 0.25
  return clamp(s, 0.6, 1.5)
}

export function post(w: World, mode: PostMode, text: string, coinId?: string, tplKey?: string) {
  const p = w.player
  const c = coinId ? w.coins[coinId] : undefined
  text = text.trim()
  if (!text) return
  if (mode !== 'shitpost' && !c) {
    toast('bad', 'tag a coin', 'calls and fud need a target. select a coin first.')
    return
  }
  const tpl = L.TEMPLATES.find((t) => t.key === tplKey)
  p.stats.posts++
  const power = followerPower(p)
  sfx.post()

  if (mode === 'call' && c) {
    c.pc.lastPostAt = c.pc.lastPostAt.filter((t) => w.t - t < 120)
    const spam = 0.45 ** c.pc.lastPostAt.length
    c.pc.lastPostAt.push(w.t)
    const deg = degenScore(text, c.ticker)
    const conc = topHoldersPct(c, 10)
    const pen = 1 - clamp((conc - 0.22) * 1.1, 0, 0.6)
    const flag = c.flagged ? 0.3 : 1
    const ch = changeOver(c, 3)
    const mom = ch > 1.25 ? 1.25 : ch < 0.75 ? 0.7 : 1
    const dead = c.status === 'dead' ? 0.05 : 1
    const evm = eventMods(w).callMult
    const total = power * 6 * (tpl?.power ?? 1) * deg * spam * pen * flag * mom * dead * evm * rand(0.75, 1.25)
    const ticks = randInt(10, 16)
    c.waves.push({ source: 'player', viaPlayer: true, perTick: total / ticks, ticks })
    c.hype += total / 14
    c.pc.callAt = w.t
    c.pc.callMc = mcUsd(c)
    c.pc.calls++
    c.pc.callSol = 0
    c.pc.cringe = tpl?.cringe ?? 1
    c.pc.callRewarded = false
    c.pc.callTokens = playerPosition(c).tokens
    c.pc.callSold = 0
    c.pc.callDumped = false
    p.stats.calls++
    mark(w, c, 'C')
    const pp = addPost(w, 'player', text, { coinId: c.id, kind: 'call', targetLikes: p.followers * rand(0.01, 0.04) * (0.5 + p.trust / 100) })
    log(w, 'follower-swarm', `${Math.round(total * 4)} followers saw @${p.handle}'s call on ${tk(c)} → routing ~${total.toFixed(1)} SOL`, 'p')
    const vars = { H: p.handle, T: tk(c), PCT: Math.round(conc * 100) }
    if (c.flagged) queueReply(w, pp, L.R_CALL_FLAGGED, randInt(2, 4), vars)
    else if (pen < 0.75 && chance(0.7)) {
      log(w, 'retail-herd', `top 10 holds ${Math.round(conc * 100)}% of ${tk(c)} — herd is suspicious`, 'a')
      queueReply(w, pp, L.R_CALL_BUNDLED, 1, vars)
      queueReply(w, pp, L.R_CALL, randInt(1, 3), vars)
    } else queueReply(w, pp, L.R_CALL, randInt(2, 5), vars)
    onPlayerCall(w, c)
    const tag = c.flagged ? ' (flagged: weak af)' : spam < 1 ? ' (spam penalty)' : pen < 0.75 ? ' (top holders scaring people)' : ''
    toast('info', `call posted · ~${total.toFixed(1)} SOL of FOMO incoming`, `follower power ${power.toFixed(2)} · degen score ${deg.toFixed(2)}${tag}`)
    return
  }

  if (mode === 'fud' && c) {
    const pp = addPost(w, 'player', text, { coinId: c.id, kind: 'fud', targetLikes: p.followers * rand(0.01, 0.03) })
    const realPct = clusterPct(c) * 100
    const bundled = c.bundlePct >= 18 || realPct >= 22
    if (bundled) {
      const gain = Math.round(power * rand(30, 80))
      p.trust = clamp(p.trust + 6, 0, 100)
      p.followers += gain
      p.xp += 60
      p.stats.fudsRight++
      unlock(w, 'whistle')
      if (!c.flagged) flagCoin(w, c, 'player', false)
      c.hype *= 0.45
      queueReply(w, pp, L.R_FUD_RIGHT, randInt(2, 4), { H: p.handle, PCT: Math.round(realPct) })
      toast('good', 'whistleblower +60 XP', `${tk(c)} exposed. +6 trust, +${gain} followers.${c.byPlayer ? ' you snitched on yourself btw.' : ''}`)
    } else {
      const lost = Math.round(p.followers * rand(0.01, 0.03))
      p.trust = clamp(p.trust - 7, 0, 100)
      p.followers -= lost
      p.stats.fudsWrong++
      unlock(w, 'wrong_fud')
      c.hype *= 0.85
      queueReply(w, pp, L.R_FUD_WRONG, randInt(2, 4), { H: p.handle })
      toast('bad', "ratio'd", `${tk(c)} is clean. -7 trust, -${lost} followers.`)
    }
    return
  }

  // shitpost
  const fresh = w.t - p.lastShitpost > 60
  p.lastShitpost = w.t
  const gain = Math.round(rand(5, 40) * Math.max(0.5, power) * (fresh ? 1 : 0.15))
  p.followers += gain
  p.trust = clamp(p.trust + (fresh ? 0.5 : 0), 0, 100)
  const pp = addPost(w, 'player', text, { kind: 'shitpost', coinId: c?.id, targetLikes: p.followers * rand(0.005, 0.03) })
  queueReply(w, pp, L.R_SHITPOST, randInt(1, 3), { H: p.handle })
  fx({ type: 'float', text: `+${gain} followers`, tone: 'p' })
}

// ---------- telegram ----------

export interface ChatOption {
  key: string
  label: string
  disabled?: boolean
}

export function chatOptions(w: World, chatId: string): ChatOption[] {
  const p = w.player
  const f = w.flags
  const myLive = Object.values(w.coins).filter((c) => c.byPlayer && c.status !== 'dead' && !c.flagged)
  const sel = w.selected ? w.coins[w.selected] : undefined
  switch (chatId) {
    case 'kev':
      return [
        { key: 'alpha', label: 'got any alpha?' },
        ...(f.kevOwed > 0 ? [{ key: 'pay', label: `send kev ${f.kevOwed.toFixed(2)} SOL`, disabled: p.sol < f.kevOwed }] : []),
        { key: 'dumping', label: 'are you dumping on me?' },
      ]
    case 'vip':
      return f.vip ? [{ key: 'wen', label: 'wen next call admin' }] : [{ key: 'join', label: 'pay 1 SOL to join', disabled: p.sol < 1 }]
    case 'sherlock':
      return [
        ...(myLive.length ? [{ key: 'bribe', label: `1.5 SOL to forget ${myLive.map(tk).slice(0, 2).join(' ')} exists`, disabled: p.sol < 1.5 }] : []),
        ...(sel && !sel.flagged && !sel.byPlayer && sel.status !== 'dead' ? [{ key: 'snitch', label: `i think ${tk(sel)} is bundled` }] : []),
        { key: 'hi', label: 'big fan' },
      ]
    case 'mom':
      return [
        { key: 'money', label: 'mom can i borrow some sol' },
        { key: 'love', label: 'i love you' },
      ]
    case 'trenchbot':
      return [
        ...[0.25, 0.5, 1].map((s) => ({ key: `snipe:${s}`, label: f.autoSnipe === s ? `/snipe ${s} ✓` : `/snipe ${s}` })),
        ...(f.autoSnipe > 0 ? [{ key: 'snipe:0', label: '/snipe off' }] : []),
        { key: 'pnl', label: '/pnl' },
      ]
    case 'cabal':
      if (f.cabal === 'kicked') return []
      return [
        { key: 'play', label: 'next play?' },
        { key: 'loyal', label: 'i would never jeet' },
      ]
    case 'agency': {
      const mine = Object.values(w.coins).filter((c) => c.byPlayer && c.status !== 'dead')
      const target = sel && sel.byPlayer && sel.status !== 'dead' ? sel : mine[0]
      if (!target) return [{ key: 'none', label: 'what do you offer?' }]
      return AGENCY.map((a) => ({
        key: `book:${a.id}:${target.id}`,
        label: `@${BOT_BY_ID[a.id].handle} → ${tk(target)} · ${a.price} SOL`,
        disabled: p.sol < a.price || !!target.script.kolId,
      }))
    }
    case 'anondev':
      return f.paidOffer
        ? [
            { key: 'accept', label: `accept ${f.paidOffer.sol} SOL` },
            ...(!f.paidOffer.countered ? [{ key: 'counter', label: 'make it more' }] : []),
            { key: 'decline', label: 'i have integrity (decline)' },
          ]
        : []
    case 'spam':
      return f.spamOffer
        ? [
            { key: 'hire', label: `hire ${f.spamOffer.sender} · ${f.spamOffer.price} SOL`, disabled: p.sol < f.spamOffer.price },
            { key: 'ignore', label: 'no thanks' },
          ]
        : []
    case 'ex':
      return [
        { key: 'reply', label: 'miss you' },
        { key: 'leave', label: 'leave me on read' },
      ]
    default:
      return []
  }
}

export function chatAct(w: World, chatId: string, key: string): { compose?: string } | void {
  const opt = chatOptions(w, chatId).find((o) => o.key === key)
  if (!opt || opt.disabled) return
  const p = w.player
  const f = w.flags
  if (key !== 'leave') chatSend(w, chatId, 'me', opt.label)
  const d = () => rand(900, 2600)

  if (chatId === 'trenchbot') {
    if (key.startsWith('snipe:')) {
      f.autoSnipe = Number(key.split(':')[1])
      chatSend(w, 'trenchbot', 'them', f.autoSnipe ? `✅ auto-snipe armed: ${f.autoSnipe} SOL on every new launch. godspeed.` : '⏹ auto-snipe disabled.', 500)
    } else {
      const bags = Object.values(w.coins).filter((c) => playerPosition(c).tokens > 0).length
      chatSend(w, 'trenchbot', 'them', fill(pick(L.TRENCHBOT_PNL), { P: (p.stats.realized >= 0 ? '+' : '') + p.stats.realized.toFixed(2), T: p.stats.trades, B: bags }), 500)
    }
    return
  }

  if (chatId === 'cabal') {
    if (key === 'play') requestCabalPlay(w)
    else chatSend(w, 'cabal', 'them', pick(['everyone says that', 'we know. we have your wallets', 'prove it']), d(), 'cabal_intern')
    return
  }

  if (chatId === 'agency') {
    if (key === 'none') {
      chatSend(w, 'agency', 'them', 'launch a coin first. we only promote assets. "assets".', d())
      return
    }
    const [, kolId, coinId] = key.split(':')
    bookKol(w, kolId, coinId)
    return
  }

  if (chatId === 'anondev') {
    if (key === 'decline') {
      f.paidOffer = undefined
      chatSend(w, 'anondev', 'them', pick(['ngmi', 'your loss. someone else will take it', 'lol ok mr integrity']), d())
      return
    }
    const c = acceptPaid(w, key === 'counter')
    if (c) return { compose: c.id }
    return
  }

  if (chatId === 'spam') {
    answerSpam(w, key === 'hire')
    return
  }

  if (chatId === 'ex') {
    if (key === 'reply') chatSend(w, 'ex', 'them', pick(['no', 'this is why', 'are you drunk or just down bad', 'seen ✓']), d())
    else chatSend(w, 'ex', 'them', '(seen)', 400)
    return
  }

  if (chatId === 'kev') {
    if (key === 'alpha') {
      if (f.kevOwed >= 0.5) return chatSend(w, 'kev', 'them', fill(pick(L.KEV_PAY), { O: f.kevOwed.toFixed(2) }), d())
      if (w.t < f.kevNext) return chatSend(w, 'kev', 'them', pick(L.KEV_BUSY), d())
      f.kevNext = w.t + rand(90, 180)
      f.kevOwed += 0.25
      const pendingKol = Object.values(w.coins).find((c) => c.status !== 'dead' && c.script.kolId && !c.script.kolCalled)
      if (pendingKol && chance(0.5)) {
        chatSend(w, 'kev', 'them', fill(pick(L.KEV_KOL), { K: BOT_BY_ID[pendingKol.script.kolId!].handle, T: pendingKol.ticker }), d())
        log(w, 'tg', `kev leaked an upcoming kol call on ${tk(pendingKol)}`, 'p')
      } else {
        const next = rollLaunch(w)
        w.scheduled.push({ at: w.t + rand(25, 50), ...next })
        chatSend(w, 'kev', 'them', fill(pick(L.KEV_TIP[next.kind]), { T: next.ident.ticker }), d())
        log(w, 'tg', `kev leaked a pre-launch: $${next.ident.ticker}`, 'p')
      }
      chatSend(w, 'kev', 'them', 'venmo me 0.25 for that lol', d() + 1500)
    } else if (key === 'pay') {
      p.sol -= f.kevOwed
      f.kevOwed = 0
      chatSend(w, 'kev', 'them', pick(L.KEV_THANKS), d())
    } else chatSend(w, 'kev', 'them', pick(L.KEV_DUMP), d())
    return
  }

  if (chatId === 'vip') {
    if (key === 'join') {
      p.sol -= 1
      f.vip = true
      chatSend(w, 'vip', 'them', `welcome @${p.handle}. calls drop here before the timeline. dont share or you get banned (and doxxed)`, d(), 'admin')
    } else chatSend(w, 'vip', 'them', pick(['soon', 'patience is alpha', 'when the cabal says so', 'stop asking or you get kicked']), d(), 'admin')
    return
  }

  if (chatId === 'sherlock') {
    if (key === 'bribe') {
      p.sol -= 1.5
      f.bribes++
      const mine = Object.values(w.coins).filter((c) => c.byPlayer && c.status !== 'dead' && !c.flagged)
      if (chance(0.55)) {
        for (const c of mine) c.detect -= 30
        chatSend(w, 'sherlock', 'them', pick(['pleasure doing business. i see nothing.', 'what coin? never heard of it 🤐', 'received. your bubblemap looks beautiful now']), d())
        log(w, 'sleuth.exe', 'detection weights adjusted. no reason. none at all.', 'd')
      } else {
        chatSend(w, 'sherlock', 'them', 'lmao screenshotting this. thanks for the 1.5 tho', d())
        for (const c of mine) flagCoin(w, c, 'sl1')
        p.trust = clamp(p.trust - 12, 0, 100)
        addPost(w, 'sl1', `@${p.handle} just tried to bribe me 1.5 SOL to ignore their bundle. i kept the SOL. anyway here's the bubblemap 🫡`, { kind: 'callout', targetLikes: rand(800, 2400) })
        toast('bad', 'BRIBE BACKFIRED', 'sherlock posted the screenshots. -12 trust. kept your SOL.')
        fx({ type: 'flash', color: 'amber' })
      }
    } else if (key === 'snitch') {
      const c = w.selected ? w.coins[w.selected] : undefined
      if (!c) return
      if (c.detect > 22) {
        chatSend(w, 'sherlock', 'them', `checked. you're right. posting now. ty anon`, d())
        flagCoin(w, c, 'sl1')
        p.trust = clamp(p.trust + 2, 0, 100)
      } else chatSend(w, 'sherlock', 'them', `looked at ${tk(c)}. it's clean. stop wasting my time`, d())
    } else chatSend(w, 'sherlock', 'them', pick(['i know. i see your wallets too', 'thanks. i have screenshots of everyone', 'ok']), d())
    return
  }

  if (chatId === 'mom') {
    if (key === 'money') {
      if (p.sol < 1) bailout(w)
      else chatSend(w, 'mom', 'them', `You have ${p.sol.toFixed(1)} "sol". I can see the phantom app on the family iPad.`, d())
    } else chatSend(w, 'mom', 'them', pick(['Love you too. Please get a job', 'Love you. Your cousin is a dentist now', 'Is this a scam text']), d())
  }
}

export function bailout(w: World) {
  const p = w.player
  p.sol += 5
  p.bailouts++
  p.xp -= 150
  unlock(w, 'mom')
  chatSend(w, 'mom', 'them', pick(['Sent. This is the LAST time.', "Sent 5. Don't tell your father.", 'Ok. But you are coming to Thanksgiving and explaining this.']), 1400)
  toast('info', '+5 SOL from mom', `${pick(L.BAILOUT)} · -150 XP for shame`)
}

export function scan(w: World, coinId: string) {
  const c = w.coins[coinId]
  if (!c) return
  if (!c.pc.scanned && playerPosition(c).tokens > 0 && !c.byPlayer) unlock(w, 'scan_after')
  c.pc.scanned = true
  sfx.scan()
}
