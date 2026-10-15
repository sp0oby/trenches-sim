import { CANDLE_SEC, MAX_DEAD, MAX_LIVE, SEC_PER_TICK, START_FOLLOWERS, START_SOL, START_TRUST } from './constants'
import { generateIdentity, type CoinIdentity } from './data/coins'
import { BOTS, BOT_BY_ID, LEADERBOARD_SEED, botsByRole, type Bot } from './data/bots'
import * as L from './data/lines'
import { ACH_BY_ID } from './data/achievements'
import {
  bundleBuy, changeOver, clusterPct, execBuy, execSell, holderValue, mark, mcUsd, playerPosition, randomWallet, realSol, touchCandle,
} from './market'
import { GRAD_REAL_SOL } from './constants'
import type { Coin, Player, Post, PostKind, Script, ScriptKind, World } from './types'
import { chance, clamp, fill, fmtAge, fmtUsd, hash, lognorm, pick, poisson, rand, randInt, weighted } from './util'
import { fx, toast } from './fx'
import { sfx } from './audio'
import { chatSend, initialChats } from './chat'
import { eventMods, onDeathPaid, onSpawn, systemsTick, tuneCabalScript } from './systems'
import { SOL_USD } from './constants'
import { solPx } from './market'

let silent = false

/** market feel knobs (exported so they can be tweaked live from devtools) */
export const TUNE = {
  decay: 0.965,
  momentum: 0.04,
  narrative: 0.0015,
  lambda: 0.35,
  buyMedian: 0.15,
  sellBase: 0.03,
}

// ---------- helpers ----------

export function followerPower(p: Player) {
  return (Math.sqrt(Math.max(p.followers, 1)) / 12) * (0.25 + p.trust / 100)
}

export function addPost(
  w: World,
  author: string,
  text: string,
  o: { coinId?: string; kind: PostKind; parent?: number; targetLikes?: number; replyTo?: string; delayMs?: number },
): Post {
  const followers = author === 'player' ? w.player.followers : (BOT_BY_ID[author]?.followers ?? 100)
  const p: Post = {
    id: ++w.seq,
    t: w.t,
    rt: Date.now() + (o.delayMs ?? 0),
    author,
    text,
    coinId: o.coinId,
    kind: o.kind,
    likes: 0,
    rts: 0,
    replies: 0,
    targetLikes: Math.round(o.targetLikes ?? followers * rand(0.002, 0.015)),
    parent: o.parent,
    replyTo: o.replyTo,
  }
  w.feed.unshift(p)
  if (w.feed.length > 160) w.feed.pop()
  if (o.parent) {
    const par = w.feed.find((x) => x.id === o.parent)
    if (par) par.replies++
  }
  return p
}

export function log(w: World, agent: string, text: string, tone?: 'g' | 'r' | 'a' | 'c' | 'p' | 'd') {
  w.log.push({ id: ++w.seq, t: w.t, agent, text, tone })
  if (w.log.length > 140) w.log.shift()
}

export function unlock(w: World, id: string) {
  if (w.player.achievements[id]) return
  w.player.achievements[id] = w.t
  const a = ACH_BY_ID[id]
  if (!a || silent) return
  toast('achv', a.name, a.desc)
  sfx.achv()
}

export function queueReply(w: World, parent: Post, pool: readonly string[], n: number, vars: Record<string, string | number>, minDelay = 3, maxDelay = 30) {
  const repliers = BOTS.filter((b) => b.role === 'reply' || b.role === 'ape' || b.role === 'filler')
  for (let i = 0; i < n; i++) {
    const bot = pick(repliers)
    w.pending.push({
      at: w.t + rand(minDelay, maxDelay),
      bot: bot.id,
      text: fill(pick(pool), vars),
      parent: parent.id,
      coinId: parent.coinId,
      kind: 'reply',
    })
  }
}

const tk = (c: Coin) => `$${c.ticker}`

// ---------- world creation ----------

function emptyPlayer(handle: string): Player {
  return {
    handle,
    sol: START_SOL,
    xp: 0,
    followers: START_FOLLOWERS,
    trust: START_TRUST,
    bailouts: 0,
    lastShitpost: -999,
    achievements: {},
    stats: {
      trades: 0, launched: 0, drills: 0, calls: 0, rekt: 0, biggestDrill: 0, bestX: 0, realized: 0, dumpedOwnCall: 0,
      fudsRight: 0, fudsWrong: 0, graduated: 0, diedHolding: 0, peakSol: START_SOL, posts: 0,
    },
  }
}

export function newWorld(handle: string): World {
  const w: World = {
    v: 1,
    t: 0,
    seq: 0,
    player: emptyPlayer(handle),
    coins: {},
    order: [],
    feed: [],
    log: [],
    pending: [],
    nextSpawn: 0,
    nextSleuth: 40,
    nextFiller: 2,
    nextKolCall: 90,
    leaderboard: LEADERBOARD_SEED.map((e) => ({ ...e })),
    speed: 1,
    paused: false,
    sound: true,
    usedTickers: [],
    chats: {},
    flags: { kevNext: 0, kevOwed: 0, vip: false, bribes: 0, autoSnipe: 0, cabal: 'none', cabalNext: 0, nextPaidOffer: 200, exNext: 0, nextSpam: 90, drained: 0 },
    scheduled: [],
    solUsd: SOL_USD,
    solOpen: SOL_USD,
    nextEvent: 640,
    crt: false,
  }
  solPx.usd = SOL_USD
  // warm the market up so it's alive on first frame
  silent = true
  for (let i = 0; i < 4; i++) spawnAi(w)
  for (let i = 0; i < 160; i++) tick(w)
  silent = false
  w.log = w.log.slice(-25)
  const live = Object.values(w.coins).filter((c) => c.status !== 'dead')
  live.sort((a, b) => mcUsd(b) - mcUsd(a))
  w.selected = live[0]?.id
  w.solOpen = w.solUsd
  log(w, 'system', `session opened for @${handle}. 25 SOL loaded. good luck (you won't need it, you'll need a miracle)`, 'g')
  initialChats(w)
  return w
}

export function makeCoin(w: World, ident: CoinIdentity, creator: string, byPlayer: boolean, script: Script, image?: string): Coin {
  const id = `${ident.ticker}-${(++w.seq).toString(36)}`
  const c: Coin = {
    id,
    name: ident.name,
    ticker: ident.ticker,
    emoji: ident.emoji,
    hue: hash(ident.ticker) % 360,
    image,
    desc: ident.desc,
    creator,
    byPlayer,
    born: w.t,
    vSol: 30,
    vTok: 1_073_000_000,
    holders: {},
    candles: [],
    tape: [],
    marks: [],
    hype: 0,
    bundlePct: 0,
    bundleWallets: 0,
    detect: 0,
    flagged: false,
    sleuthCheckedMc: 0,
    script,
    waves: [],
    status: 'live',
    ath: 0,
    launchMc: 0,
    buys: 0,
    sells: 0,
    volume: 0,
    lowTicks: 0,
    pumpPosted: -999,
    pc: { calls: 0, callSol: 0, volBot: false, profit: 0, scanned: false, lastPostAt: [] },
  }
  touchCandle(c, w.t)
  w.coins[id] = c
  w.order.unshift(id)
  return c
}

// ---------- AI launches ----------

export function rollLaunch(w: World) {
  const used = new Set([...w.usedTickers, ...Object.values(w.coins).map((c) => c.ticker), ...w.scheduled.map((s) => s.ident.ticker)])
  const ident = generateIdentity(used)
  const kind = weighted<Exclude<ScriptKind, 'player'>>({ bundle_rug: 38, dev_dump: 18, kol_pump: 16, organic: 17, slow_bleed: 11 })
  return { ident, kind }
}

function spawnAi(w: World, preset?: { ident: CoinIdentity; kind: Exclude<ScriptKind, 'player'>; cabal?: boolean; celeb?: boolean }) {
  const { ident, kind } = preset ?? rollLaunch(w)
  let pct = 0
  let wallets = 1
  const s: Script = { kind, targetX: 2, dumpAge: 600, dumpRate: 0.3, maxLife: rand(900, 3600) }
  const kols = botsByRole('kol')
  switch (kind) {
    case 'bundle_rug':
      pct = rand(22, 55); wallets = randInt(4, 16)
      s.targetX = rand(1.8, 4.5); s.dumpAge = rand(200, 800); s.dumpRate = rand(0.25, 0.6)
      if (chance(0.55)) { s.kolId = pick(kols).id; s.kolCallAge = rand(25, 140) }
      break
    case 'dev_dump':
      pct = rand(3, 12); wallets = 1
      s.targetX = rand(1.3, 2.3); s.dumpAge = rand(60, 280); s.dumpRate = 1
      break
    case 'kol_pump':
      pct = rand(8, 22); wallets = randInt(2, 6)
      s.kolId = pick(kols).id; s.kolCallAge = rand(20, 90)
      s.targetX = rand(2.5, 7); s.dumpAge = rand(300, 1100); s.dumpRate = rand(0.2, 0.4)
      break
    case 'organic':
      pct = rand(0, 6); wallets = 1
      s.targetX = rand(6, 40); s.dumpAge = rand(1500, 3200); s.dumpRate = rand(0.05, 0.15)
      if (chance(0.25)) { s.kolId = pick(kols).id; s.kolCallAge = rand(120, 500) }
      s.runner = chance(0.28)
      break
    case 'slow_bleed':
      pct = rand(15, 35); wallets = randInt(5, 12)
      s.targetX = rand(1.4, 2.6); s.dumpAge = rand(120, 380); s.dumpRate = rand(0.05, 0.12)
      break
  }
  if (preset?.cabal && w.flags.cabalJob) tuneCabalScript({ script: s } as Coin, w.flags.cabalJob.signalAge)
  if (preset?.celeb) pct = rand(40, 60)
  const dep = preset?.cabal ? BOT_BY_ID.dep3 : pick(botsByRole('deployer'))
  const c = makeCoin(w, ident, dep.id, false, s)
  // block 0
  if (wallets === 1) {
    if (pct > 0.5) bundleBuy(w, c, pct, 1, 'dev', 'dev', undefined, 'DEV')
  } else {
    bundleBuy(w, c, rand(1, 3), 1, 'dev', 'bundle', undefined, 'DEV')
    bundleBuy(w, c, pct, wallets, 'insider', 'bundle')
  }
  const sniperPct = rand(1, 7)
  bundleBuy(w, c, sniperPct, randInt(2, 6), 'sniper', '')
  c.bundlePct = pct
  c.bundleWallets = wallets
  c.detect = pct * 1.1 + rand(-8, 8)
  c.launchMc = mcUsd(c)
  c.hype = kind === 'organic' ? rand(1.2, 4) : rand(1.2, 3)
  onSpawn(w, c, { cabal: preset?.cabal, celeb: preset?.celeb }, silent)

  log(w, 'deployer-farm', `@${dep.handle} deployed ${tk(c)} "${c.name}"`, 'c')
  if (wallets > 1) log(w, 'deployer-farm', `${tk(c)} block 0: ${wallets} wallets took ${pct.toFixed(1)}% (funded via "totally random cex")`, 'r')
  log(w, 'sniper-swarm', `${tk(c)} sniped ${sniperPct.toFixed(1)}% in block 0. landed.`, 'c')
  if (chance(0.5)) addPost(w, dep.id, fill(pick(L.DEPLOY), { T: tk(c), N: randInt(4, 31) }), { coinId: c.id, kind: 'launch' })
  else if (chance(0.4)) addPost(w, 'news', fill(pick(L.NEWS_LAUNCH), { T: tk(c), NAME: c.name }), { coinId: c.id, kind: 'news' })
}

// ---------- KOLs ----------

export function kolCall(w: World, c: Coin, bot: Bot) {
  const sol = rand(0.8, 3)
  execBuy(w, c, `kol:${bot.id}`, 'kol', sol, { label: `@${bot.handle}` })
  log(w, 'kol-runner', `@${bot.handle} front-running ${tk(c)} with ${sol.toFixed(2)} SOL before posting`, 'p')
  const flag = c.flagged ? 0.3 : 1
  const total = (Math.sqrt(bot.followers) / 10) * rand(0.6, 1.3) * flag
  const ticks = randInt(10, 16)
  c.waves.push({ source: bot.id, viaPlayer: false, perTick: total / ticks, ticks })
  c.hype += total / 12
  c.script.kolId = bot.id
  c.script.kolCalled = true
  c.script.kolSellAge = w.t - c.born + rand(25, 75)
  mark(w, c, 'K')
  addPost(w, bot.id, fill(pick(L.KOL_CALL), { T: tk(c), MC: fmtUsd(mcUsd(c)) }), {
    coinId: c.id,
    kind: 'call',
    targetLikes: bot.followers * rand(0.004, 0.015),
  })
  log(w, 'follower-swarm', `${fmtCount(total * 4)} of @${bot.handle}'s followers routing ~${total.toFixed(1)} SOL into ${tk(c)}`, 'p')
  if (!silent && playerPosition(c).tokens > 0) toast('good', `@${bot.handle} called your bag`, `${tk(c)} — exit liquidity is on the way.`)
}

const fmtCount = (n: number) => Math.round(n).toLocaleString('en-US')

// ---------- flags / death ----------

export function flagCoin(w: World, c: Coin, by: string, announce = true) {
  if (c.flagged) return
  c.flagged = true
  c.flaggedAt = w.t
  c.hype *= 0.5
  const pct = Math.round(clusterPct(c) * 100)
  const n = Object.values(c.holders).filter((h) => h.cluster && h.kind !== 'retail' && h.kind !== 'sniper').length
  mark(w, c, 'F')
  if (announce) {
    const bot = BOT_BY_ID[by]
    addPost(w, by, fill(pick(L.SLEUTH_CALLOUT), { T: tk(c), PCT: pct, N: Math.max(n, 2) }), {
      coinId: c.id,
      kind: 'callout',
      targetLikes: (bot?.followers ?? 5000) * rand(0.01, 0.03),
    })
  }
  log(w, 'sleuth.exe', `FLAGGED ${tk(c)} — ${pct}% clustered across ${n} wallets. herd notified.`, 'a')
  if (silent) return
  if (c.byPlayer) {
    w.player.trust = clamp(w.player.trust - 8, 0, 100)
    toast('bad', 'YOUR BUNDLE GOT EXPOSED', `${tk(c)} flagged. calls are 70% weaker. trust -8.`)
    fx({ type: 'flash', color: 'amber' })
    sfx.bad()
    unlock(w, 'flagged')
  } else if (playerPosition(c).tokens > 0) {
    toast('bad', `${tk(c)} just got flagged`, 'a bag you hold is officially a crime scene.')
  }
}

function kill(w: World, c: Coin) {
  c.status = 'dead'
  c.diedAt = w.t
  c.epitaph = pick(L.EPITAPHS)
  c.waves = []
  c.hype = 0
  c.pc.volBot = false
  let rekt = 0
  let rektCall = 0
  for (const h of Object.values(c.holders)) {
    if (h.kind !== 'retail' || h.cost < 0.02) continue
    if (holderValue(c, h) < h.cost * 0.5) {
      rekt++
      if (h.viaCall) rektCall++
    }
  }
  c.rekt = rekt
  const age = w.t - c.born
  w.usedTickers.push(c.ticker)
  if (w.usedTickers.length > 50) w.usedTickers.shift()
  log(w, 'reaper', `${tk(c)} died at ${fmtAge(age)} — ${rekt} wallets rekt. cause: ${c.epitaph}`, 'd')
  if (chance(0.5)) {
    const b = pick(BOTS.filter((x) => x.role === 'filler' || x.role === 'ape' || x.role === 'reply'))
    addPost(w, b.id, fill(pick(L.DEATH), { T: tk(c), AGE: fmtAge(age), ATH: fmtUsd(c.ath) }), { coinId: c.id, kind: 'death' })
  }
  if (silent) return
  const p = w.player
  const pos = playerPosition(c)
  const involved = pos.tokens > 0 || c.byPlayer || c.pc.calls > 0
  if (rektCall > 0 && c.pc.calls > 0) {
    const xp = rektCall * 8
    p.stats.rekt += rektCall
    p.xp += xp
    chatSend(w, 'fans', 'them', pick(L.FAN_REKT).replace('{T}', tk(c)), rand(800, 3000), `anon_${randInt(100, 9999)}`)
    toast('xp', `+${xp} XP · ${rektCall} followers rekt`, `You turned ${rektCall} people who believed you into exit liquidity.`)
    if (p.stats.rekt >= 47) unlock(w, 'rekt47')
  }
  if (pos.tokens > 0 && pos.cost > 0.01) {
    p.stats.diedHolding++
    toast('bad', `${tk(c)} died in your wallet`, `${c.epitaph}. you held. respect? no.`)
    unlock(w, 'diamond')
  }
  if (c.pc.profit > 0 && age < 900) unlock(w, 'quick_death')
  onDeathPaid(w, c)
  if (involved) {
    fx({ type: 'death', ticker: c.ticker, epitaph: c.epitaph })
    sfx.death()
  }
}

// ---------- per-coin sim ----------

function simCoin(w: World, c: Coin) {
  const age = w.t - c.born
  const ch = changeOver(c, 3)
  const ch1 = changeOver(c, 1)

  // attention dynamics
  c.hype *= TUNE.decay
  const runner = !!c.script.runner
  if (ch > 1.4 && c.hype < (runner ? 6 : 3)) c.hype += runner ? TUNE.momentum * 3 : TUNE.momentum
  if (ch < 0.65) c.hype *= 0.9
  if (chance(TUNE.narrative * (runner ? 5 : 1))) narrative(w, c)
  c.hype = clamp(c.hype, 0, 10)

  // call waves
  for (const wave of c.waves) {
    const n = 1 + poisson(1.2)
    for (let i = 0; i < n; i++) {
      const sol = (wave.perTick / n) * rand(0.5, 1.5)
      execBuy(w, c, randomWallet(), 'retail', sol, { viaCall: wave.viaPlayer })
      if (wave.viaPlayer) c.pc.callSol += sol
    }
    wave.ticks--
    c.hype += 0.04
  }
  c.waves = c.waves.filter((x) => x.ticks > 0)

  // organic retail flow
  const ev = eventMods(w)
  const fl = (c.flagged ? 0.35 : 1) * ev.hype * (ev.outage ? 0.6 : 1)
  const nb = poisson(Math.min(runner ? 6 : 4, c.hype * TUNE.lambda * fl * (runner ? 1.6 : 1)))
  for (let i = 0; i < nb; i++) {
    let sol = clamp(lognorm(TUNE.buyMedian, 1.0), 0.01, 12)
    let kind: 'retail' | 'whale' = 'retail'
    if (chance(0.015)) {
      sol = rand(4, 18)
      kind = 'whale'
    }
    execBuy(w, c, randomWallet(), kind, sol)
  }

  // holders take profit / panic
  const sellers = Object.values(c.holders).filter((h) => h.kind === 'retail' || h.kind === 'sniper' || h.kind === 'whale')
  const k = Math.min(sellers.length, 10)
  for (let i = 0; i < k; i++) {
    const h = sellers[Math.floor(Math.random() * sellers.length)]
    if (!h || h.tokens <= 0) continue
    const r = holderValue(c, h) / Math.max(h.cost, 1e-6) - 1
    let p = TUNE.sellBase + ev.sell + (c.flagged ? 0.03 : 0) + (c.hype < 0.5 ? 0.03 : 0)
    if (h.kind === 'sniper') p += r > 0.3 ? 0.3 : 0.03
    if (r > 0.5) p += 0.08
    if (r > 1.5) p += 0.15
    if (r > 4) p += 0.2
    if (r < -0.4 && ch1 < 0.8) p += 0.12
    if (r < -0.85) p *= 0.3 // bagholders gonna bag
    if (runner && h.kind !== 'sniper') p *= 0.5 // diamond hands (for now)
    if (chance(p)) execSell(w, c, h.id, h.tokens * (r > 1 ? rand(0.3, 0.8) : rand(0.6, 1)))
  }

  runScript(w, c, age)

  // volume bot
  if (c.pc.volBot) {
    if (w.player.sol < 0.02) {
      c.pc.volBot = false
      if (!silent) toast('bad', 'volume bot stopped', 'out of SOL. the bot has unionized.')
    } else {
      w.player.sol -= 0.006
      const sol = rand(0.2, 0.7)
      const id = `vbot:${randInt(1, 6)}`
      const got = execBuy(w, c, id, 'vbot', sol, { cluster: 'vbot' })
      execSell(w, c, id, got)
      if (!c.flagged) c.hype += 0.05
      c.detect += 0.12
      if (chance(0.03)) log(w, 'vol-bot', `${tk(c)} washing ${sol.toFixed(2)} SOL. looks super organic.`, 'c')
    }
  }

  touchCandle(c, w.t)

  // feed reactions to big moves
  const mc = mcUsd(c)
  if (w.t - c.pumpPosted > 100) {
    if (changeOver(c, 4) > 2.4 && mc > 14000) {
      c.pumpPosted = w.t
      const b = pick(BOTS.filter((x) => x.role === 'ape' || x.role === 'filler' || x.role === 'reply'))
      addPost(w, b.id, fill(pick(L.PUMP), { T: tk(c), MC: fmtUsd(mc), X: changeOver(c, 4).toFixed(1) }), { coinId: c.id, kind: 'shitpost' })
    } else if (ch1 < 0.55 && c.ath > 12000) {
      c.pumpPosted = w.t
      const b = pick(BOTS.filter((x) => x.role === 'ape' || x.role === 'reply'))
      addPost(w, b.id, fill(pick(L.DUMP), { T: tk(c), PCT: randInt(20, 60) }), { coinId: c.id, kind: 'shitpost' })
    }
  }

  // graduation
  if (c.status === 'live' && realSol(c) >= GRAD_REAL_SOL) {
    c.status = 'graduated'
    c.hype += 2
    addPost(w, 'news', fill(pick(L.NEWS_GRAD), { T: tk(c), MC: fmtUsd(mc) }), { coinId: c.id, kind: 'news', targetLikes: rand(300, 1400) })
    log(w, 'system', `${tk(c)} migrated to PumpSwap at ${fmtUsd(mc)}`, 'g')
    if (c.byPlayer && !silent) {
      w.player.stats.graduated++
      unlock(w, 'grad')
      toast('good', `${tk(c)} GRADUATED`, 'your coin bonded. the cabal is proud of you.')
      fx({ type: 'flash', color: 'green' })
    }
  }

  // organic community achievement
  if (c.byPlayer && !c.flagged && c.bundlePct >= 40 && mc >= c.launchMc * 3) unlock(w, 'organic')

  // death
  const lowMc = c.status === 'graduated' ? 15000 : 8000
  if (age > 120 && c.hype < 0.6 && (mc < lowMc || (age > 300 && mc < c.ath * 0.15))) c.lowTicks++
  else c.lowTicks = Math.max(0, c.lowTicks - 1)
  if (c.lowTicks > 20 || (age > c.script.maxLife && c.hype < 0.8 && mc < c.ath * 0.4)) kill(w, c)
}

function narrative(w: World, c: Coin) {
  const boost = rand(1, 2.6)
  c.hype += boost
  addPost(w, 'news', fill(pick(L.NEWS_NARRATIVE), { T: tk(c) }), { coinId: c.id, kind: 'news' })
  log(w, 'retail-herd', `narrative detected on ${tk(c)} → attention +${boost.toFixed(1)}`, 'g')
}

function runScript(w: World, c: Coin, age: number) {
  const s = c.script
  if (s.kind === 'player') {
    if (s.kolId && !s.kolCalled && age >= (s.kolCallAge ?? 0)) kolCall(w, c, BOT_BY_ID[s.kolId])
    kolExit(w, c, age)
    return
  }
  if (s.kolId && !s.kolCalled && !s.vipWarned && age >= (s.kolCallAge ?? 0) - 24) {
    s.vipWarned = true
    if (w.flags.vip && !silent) {
      chatSend(w, 'vip', 'them', `🚨 NEXT CALL: ${tk(c)} — @${BOT_BY_ID[s.kolId].handle} posting in ~20s. load up. DO NOT SHARE`, 0, 'admin')
      sfx.post()
    }
  }
  if (s.kolId && !s.kolCalled && age >= (s.kolCallAge ?? 0)) kolCall(w, c, BOT_BY_ID[s.kolId])
  kolExit(w, c, age)

  const mc = mcUsd(c)
  if (!s.dumping && (mc >= c.launchMc * s.targetX || age >= s.dumpAge)) s.dumping = true
  if (!s.dumping) return
  const ins = Object.values(c.holders).filter((h) => (h.kind === 'insider' || h.kind === 'dev') && h.tokens > 0)
  if (!ins.length) return
  if (!s.dumpAnnounced) {
    s.dumpAnnounced = true
    const pct = (ins.reduce((a, h) => a + h.tokens, 0) / 1e7).toFixed(1)
    const who = s.kind === 'dev_dump' ? 'dev' : `${ins.length} insider wallets`
    log(w, 'insider-ops', `${tk(c)} ${who} unloading ${pct}% of supply into ${fmtUsd(mc)}`, 'r')
    mark(w, c, 'D')
  }
  const n = s.dumpRate >= 1 ? ins.length : Math.min(ins.length, randInt(1, 3))
  for (let i = 0; i < n; i++) {
    const h = ins[i]
    execSell(w, c, h.id, s.dumpRate >= 1 ? h.tokens : h.tokens * rand(s.dumpRate * 0.5, s.dumpRate))
  }
}

function kolExit(w: World, c: Coin, age: number) {
  const s = c.script
  if (!s.kolId || s.kolSellAge == null || age < s.kolSellAge) return
  const bot = BOT_BY_ID[s.kolId]
  const h = c.holders[`kol:${s.kolId}`]
  if (!h || h.tokens <= 0) {
    s.kolSellAge = undefined
    return
  }
  const full = chance(0.5)
  const { sol, cost } = execSell(w, c, h.id, full ? h.tokens : h.tokens * 0.6)
  log(w, 'kol-runner', `@${bot.handle} sold ${full ? '100' : '60'}% of ${tk(c)} into followers (+${(sol - cost).toFixed(2)} SOL)`, 'r')
  if (chance(0.45)) addPost(w, bot.id, fill(pick(L.KOL_EXIT), { T: tk(c) }), { coinId: c.id, kind: 'shitpost' })
  s.kolSellAge = full ? undefined : age + rand(30, 90)
}

// ---------- world agents ----------

function sleuth(w: World) {
  if (w.t < w.nextSleuth) return
  w.nextSleuth = w.t + rand(14, 32)
  if (eventMods(w).noSleuth) return
  const cands = Object.values(w.coins).filter((c) => c.status !== 'dead' && !c.flagged && mcUsd(c) > 12000 && mcUsd(c) > c.sleuthCheckedMc * 1.8)
  if (!cands.length) return
  cands.sort((a, b) => mcUsd(b) - mcUsd(a))
  const c = cands[0]
  c.sleuthCheckedMc = mcUsd(c)
  const bot = chance(0.7) ? BOT_BY_ID.sl1 : BOT_BY_ID.sl2
  log(w, 'sleuth.exe', `@${bot.handle} pulling holders for ${tk(c)} (${fmtUsd(mcUsd(c))})…`, 'a')
  const threshold = 26 + rand(0, 18)
  if (c.detect > threshold) flagCoin(w, c, bot.id)
  else {
    log(w, 'sleuth.exe', `${tk(c)} distribution passes. moving on.`, 'd')
    if (chance(0.3)) addPost(w, bot.id, fill(pick(L.SLEUTH_CLEAN), { T: tk(c) }), { coinId: c.id, kind: 'shitpost' })
  }
}

function filler(w: World) {
  if (w.t < w.nextFiller) return
  w.nextFiller = w.t + rand(4, 11)
  const live = Object.values(w.coins).filter((c) => c.status !== 'dead')
  const roll = Math.random()
  if (roll < 0.36) {
    const b = pick(BOTS.filter((x) => x.role === 'filler'))
    addPost(w, b.id, b.id === 'f2' && chance(0.6) ? pick(L.THERAPIST) : pick(L.FILLER), { kind: 'shitpost' })
  } else if (roll < 0.7 && live.length) {
    const c = pick(live)
    const b = pick(botsByRole('ape'))
    const sol = rand(0.1, 1.2)
    execBuy(w, c, `ape:${b.id}`, 'retail', sol, { label: `@${b.handle}` })
    c.hype += 0.08
    addPost(w, b.id, fill(pick(L.APE), { T: tk(c), MC: fmtUsd(mcUsd(c)) }), { coinId: c.id, kind: 'call' })
  } else if (roll < 0.78 && live.length) {
    const c = pick(live)
    const sol = rand(2, 9)
    execBuy(w, c, 'whale:w1', 'whale', sol, { label: '@based_whale' })
    c.hype += 0.4
    log(w, 'whale-watch', `@based_whale bought ${sol.toFixed(1)} SOL of ${tk(c)}`, 'c')
    if (chance(0.5)) addPost(w, 'w1', `bought some ${tk(c)}. don't read into it. (read into it)`, { coinId: c.id, kind: 'call' })
  }
  if (chance(0.45)) {
    const [agent, text] = pick(L.AGENT_IDLE)
    log(w, agent, text, 'd')
  }
}

function randomKolCall(w: World) {
  if (w.t < w.nextKolCall) return
  w.nextKolCall = w.t + rand(70, 170)
  const cands = Object.values(w.coins).filter((c) => c.status !== 'dead' && !c.script.kolCalled && w.t - c.born < 700 && mcUsd(c) < 70000 && !(c.flagged && chance(0.8)))
  if (!cands.length) return
  kolCall(w, pick(cands), pick(botsByRole('kol')))
}

function engagement(w: World) {
  for (let i = 0; i < Math.min(40, w.feed.length); i++) {
    const p = w.feed[i]
    if (p.likes < p.targetLikes) {
      p.likes += Math.max(1, Math.ceil((p.targetLikes - p.likes) * rand(0.06, 0.18)))
      p.rts = Math.round(p.likes * 0.14)
    }
  }
  if (!w.pending.length) return
  const due = w.pending.filter((p) => p.at <= w.t)
  if (!due.length) return
  w.pending = w.pending.filter((p) => p.at > w.t)
  for (const d of due) {
    if (d.bot === '__vipdump') {
      const c = w.coins[d.text]
      const h = c?.holders['vip:admin']
      if (c && h) {
        execSell(w, c, h.id, h.tokens)
        log(w, 'insider-ops', `VIP admin dumped ${tk(c)} on 412 paying members`, 'r')
        if (w.flags.vip) chatSend(w, 'vip', 'them', `took profits on ${tk(c)}. hold if you want, i'm not your dad`, 0, 'admin')
      }
      continue
    }
    const par = d.parent ? w.feed.find((x) => x.id === d.parent) : undefined
    addPost(w, d.bot, d.text, {
      coinId: d.coinId,
      kind: d.kind,
      parent: d.parent,
      replyTo: par ? (par.author === 'player' ? w.player.handle : BOT_BY_ID[par.author]?.handle) : undefined,
      delayMs: rand(300, 1400),
    })
  }
}

function playerPassive(w: World) {
  const p = w.player
  if (p.sol > p.stats.peakSol) p.stats.peakSol = p.sol
  if (chance(0.05)) p.followers += randInt(0, 2)
  if (Math.floor(w.t / SEC_PER_TICK) % 4 !== 0) return
  if (p.followers >= 10000) unlock(w, 'kol')
  if (p.sol >= 100) unlock(w, 'whale')
  if (p.xp >= 10000) unlock(w, 'xp10k')
  if (p.trust < 10) unlock(w, 'ratioed')
}

function prune(w: World) {
  const dead = w.order.filter((id) => w.coins[id]?.status === 'dead')
  if (dead.length <= MAX_DEAD) return
  for (const id of dead.slice(MAX_DEAD)) {
    const c = w.coins[id]
    if (id === w.selected || playerPosition(c).tokens > 0) continue
    delete w.coins[id]
  }
  w.order = w.order.filter((id) => w.coins[id])
}

// ---------- main tick ----------

function vipAdmin(w: World) {
  if (!w.flags.vip || !chance(0.006)) return
  const live = Object.values(w.coins).filter((c) => c.status !== 'dead' && w.t - c.born < 600)
  if (!live.length) return
  const c = pick(live)
  const sol = rand(1, 4)
  execBuy(w, c, 'vip:admin', 'insider', sol, { label: 'VIP admin', cluster: 'vip' })
  const ticks = randInt(6, 10)
  c.waves.push({ source: 'vip', viaPlayer: false, perTick: rand(3, 7) / ticks, ticks })
  chatSend(w, 'vip', 'them', pick(L.VIP_SHILL).replace('{T}', tk(c)), 0, 'admin')
  // the admin dumps on the members a bit later
  w.pending.push({ at: w.t + rand(30, 60), bot: '__vipdump', text: c.id, kind: 'reply' })
}

export function tick(w: World) {
  w.t += SEC_PER_TICK
  if (w.scheduled.length) {
    const due = w.scheduled.filter((s) => s.at <= w.t)
    w.scheduled = w.scheduled.filter((s) => s.at > w.t)
    for (const s of due) spawnAi(w, s)
  }
  vipAdmin(w)
  systemsTick(w, silent)
  const live = w.order.filter((id) => w.coins[id].status !== 'dead')
  if (w.t >= w.nextSpawn && live.length < MAX_LIVE) {
    spawnAi(w)
    w.nextSpawn = w.t + rand(18, 46)
  }
  for (const id of live) simCoin(w, w.coins[id])
  sleuth(w)
  filler(w)
  randomKolCall(w)
  engagement(w)
  for (const e of w.leaderboard) {
    e.xp += e.drift * rand(-0.5, 2)
    if (chance(0.01 * Math.max(0, e.drift))) e.rekt++
  }
  playerPassive(w)
  if (w.t % (CANDLE_SEC * 4) === 0) prune(w)
}
