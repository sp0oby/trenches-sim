import { CANDLE_SEC, FEE, GRAD_REAL_SOL, INIT_V_SOL, SOL_USD, TOTAL_SUPPLY } from './constants'
import type { Coin, Holder, Kind, MarkType, World } from './types'
import { addr, clamp } from './util'

// ---------- curve math (constant product with virtual reserves) ----------

export function quoteBuy(vSol: number, vTok: number, sol: number) {
  const k = vSol * vTok
  const nvSol = vSol + sol * (1 - FEE)
  const nvTok = k / nvSol
  return { tokens: vTok - nvTok, nvSol, nvTok }
}

export function quoteSell(vSol: number, vTok: number, tokens: number) {
  const k = vSol * vTok
  const nvTok = vTok + tokens
  const nvSol = k / nvTok
  return { sol: (vSol - nvSol) * (1 - FEE), nvSol, nvTok }
}

/** gross SOL needed to pull `tokens` out of the curve */
export function costForTokens(vSol: number, vTok: number, tokens: number) {
  const k = vSol * vTok
  const nvTok = Math.max(vTok - tokens, 1)
  return (k / nvTok - vSol) / (1 - FEE)
}

/** live SOL/USD, driven by the engine each tick */
export const solPx = { usd: SOL_USD }

export const price = (c: Coin) => c.vSol / c.vTok
export const mcSol = (c: Coin) => price(c) * TOTAL_SUPPLY
export const mcUsd = (c: Coin) => mcSol(c) * solPx.usd
export const realSol = (c: Coin) => c.vSol - INIT_V_SOL
export const curveProgress = (c: Coin) => clamp(realSol(c) / GRAD_REAL_SOL, 0, 1)

export const holderValue = (c: Coin, h: Holder) => (h.tokens > 0 ? quoteSell(c.vSol, c.vTok, h.tokens).sol : 0)

export function playerHolders(c: Coin) {
  return Object.values(c.holders).filter((h) => h.kind === 'player' && h.tokens > 0)
}

export function playerPosition(c: Coin) {
  let tokens = 0
  let cost = 0
  for (const h of playerHolders(c)) {
    tokens += h.tokens
    cost += h.cost
  }
  // value = what selling the whole bag returns right now (price impact + fee included)
  const value = tokens > 0 ? quoteSell(c.vSol, c.vTok, tokens).sol : 0
  // mark = tokens × chart price, i.e. what the chart "says" the bag is worth
  const mark = tokens * price(c)
  const avgEntryMc = tokens > 0 ? (cost / tokens) * TOTAL_SUPPLY * solPx.usd : 0
  return {
    tokens,
    cost,
    value,
    mark,
    pnl: value - cost,
    markPnl: mark - cost,
    impact: mark > 0 ? 1 - value / mark : 0,
    avgEntryMc,
    x: cost > 0 ? value / cost : 0,
    pct: tokens / TOTAL_SUPPLY,
  }
}

/** ratio of current close vs open n candles ago */
export function changeOver(c: Coin, n: number) {
  const cs = c.candles
  if (cs.length < 2) return 1
  const from = cs[Math.max(0, cs.length - 1 - n)].o
  return cs[cs.length - 1].c / Math.max(from, 1)
}

export function topHoldersPct(c: Coin, n = 10) {
  const hs = Object.values(c.holders).sort((a, b) => b.tokens - a.tokens)
  return hs.slice(0, n).reduce((s, h) => s + h.tokens, 0) / TOTAL_SUPPLY
}

export function clusterPct(c: Coin) {
  let t = 0
  for (const h of Object.values(c.holders)) if (h.cluster && h.kind !== 'retail') t += h.tokens
  return t / TOTAL_SUPPLY
}

// ---------- execution ----------

export function touchCandle(c: Coin, t: number, vol = 0) {
  const mc = mcUsd(c)
  const bucket = Math.floor((t - c.born) / CANDLE_SEC)
  const last = c.candles[c.candles.length - 1]
  if (!last || last.t < bucket) {
    const o = last ? last.c : mc
    c.candles.push({ t: bucket, o, h: Math.max(o, mc), l: Math.min(o, mc), c: mc, v: vol })
    if (c.candles.length > 240) c.candles.shift()
  } else {
    last.c = mc
    if (mc > last.h) last.h = mc
    if (mc < last.l) last.l = mc
    last.v += vol
  }
  if (mc > c.ath) c.ath = mc
}

export function mark(w: World, c: Coin, type: MarkType) {
  c.marks.push({ t: w.t, type })
  if (c.marks.length > 60) c.marks.shift()
}

function record(w: World, c: Coin, side: 'buy' | 'sell', sol: number, tokens: number, wallet: string, kind: Kind, viaCall?: boolean) {
  c.tape.unshift({ id: ++w.seq, t: w.t, side, sol, tokens, wallet, kind, mc: mcUsd(c), viaCall })
  if (c.tape.length > 60) c.tape.pop()
  c.volume += sol
  if (side === 'buy') c.buys++
  else c.sells++
  touchCandle(c, w.t, sol)
}

export interface BuyOpts {
  viaCall?: boolean
  cluster?: string
  label?: string
}

export function execBuy(w: World, c: Coin, wallet: string, kind: Kind, sol: number, o: BuyOpts = {}) {
  if (sol <= 0) return 0
  const q = quoteBuy(c.vSol, c.vTok, sol)
  c.vSol = q.nvSol
  c.vTok = q.nvTok
  let h = c.holders[wallet]
  if (!h) h = c.holders[wallet] = { id: wallet, kind, tokens: 0, cost: 0, t: w.t, cluster: o.cluster, viaCall: o.viaCall, label: o.label }
  h.tokens += q.tokens
  h.cost += sol
  if (kind === 'player') w.player.sol -= sol
  record(w, c, 'buy', sol, q.tokens, wallet, kind, o.viaCall)
  return q.tokens
}

export function execSell(w: World, c: Coin, wallet: string, tokens: number) {
  const h = c.holders[wallet]
  if (!h || tokens <= 0 || h.tokens <= 0) return { sol: 0, cost: 0 }
  tokens = Math.min(tokens, h.tokens)
  const q = quoteSell(c.vSol, c.vTok, tokens)
  c.vSol = q.nvSol
  c.vTok = q.nvTok
  const cost = h.cost * (tokens / h.tokens)
  h.tokens -= tokens
  h.cost -= cost
  if (h.tokens < 1) {
    h.tokens = 0
    h.cost = 0
    if (h.kind !== 'player') delete c.holders[wallet]
  }
  if (h.kind === 'player') w.player.sol += q.sol
  record(w, c, 'sell', q.sol, tokens, wallet, h.kind, h.viaCall)
  return { sol: q.sol, cost }
}

/** buys `pct` of supply split randomly over `wallets` wallets in one block */
export function bundleBuy(w: World, c: Coin, pct: number, wallets: number, kind: Kind, cluster: string, ids?: string[], labelFirst?: string) {
  const total = (pct / 100) * TOTAL_SUPPLY
  const weights = Array.from({ length: wallets }, () => 0.5 + Math.random())
  const sum = weights.reduce((a, b) => a + b, 0)
  let spent = 0
  weights.forEach((wt, i) => {
    const tokens = (total * wt) / sum
    const sol = costForTokens(c.vSol, c.vTok, tokens)
    const id = ids?.[i] ?? randomWallet()
    spent += sol
    execBuy(w, c, id, kind, sol, { cluster, label: i === 0 ? labelFirst : undefined })
  })
  return spent
}

export const randomWallet = () => addr(8)
