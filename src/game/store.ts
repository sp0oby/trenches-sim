import { useSyncExternalStore } from 'react'
import { SAVE_KEY, SOL_USD, TICK_MS } from './constants'
import { solPx } from './market'
import { newWorld, tick } from './engine'
import type { Coin, World } from './types'
import { setSoundEnabled } from './audio'

let world: World | null = null
let version = 0
const subs = new Set<() => void>()
let timer: number | undefined
let ticks = 0

export function getWorld() {
  return world!
}

export function bump() {
  version++
  subs.forEach((f) => f())
}

function subscribe(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

/** re-renders the caller every tick and returns the (mutable) world */
export function useWorld(): World {
  useSyncExternalStore(subscribe, () => version)
  return world!
}

/** run a mutation then re-render */
export function act<T>(fn: (w: World) => T): T {
  const r = fn(world!)
  bump()
  return r
}

// ---------- persistence ----------

function compact(w: World): World {
  const coins: Record<string, Coin> = {}
  for (const [id, c] of Object.entries(w.coins)) {
    if (c.status !== 'dead') coins[id] = c
    else {
      const holders = Object.fromEntries(Object.entries(c.holders).filter(([, h]) => h.kind === 'player'))
      coins[id] = { ...c, holders, tape: [], candles: c.candles.slice(-80) }
    }
  }
  return { ...w, coins, feed: w.feed.slice(0, 80), log: w.log.slice(-60) }
}

let wiped = false

export function save() {
  if (!world || wiped) return
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(compact(world)))
  } catch {
    // quota: drop dead coin history and retry once
    try {
      const w = compact(world)
      for (const [id, c] of Object.entries(w.coins)) if (c.status === 'dead' && !Object.keys(c.holders).length) delete w.coins[id]
      w.order = w.order.filter((id) => w.coins[id])
      localStorage.setItem(SAVE_KEY, JSON.stringify(w))
    } catch {
      /* give up silently */
    }
  }
}

export function peekSave(): { handle: string; xp: number; sol: number } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const w = JSON.parse(raw) as World
    if (w.v !== 1 || !w.chats) return null
    return { handle: w.player.handle, xp: w.player.xp, sol: w.player.sol }
  } catch {
    return null
  }
}

/** fill fields added after a save was written */
function migrate(w: World): World {
  const defaults: Partial<World['flags']> = { autoSnipe: 0, cabal: 'none', cabalNext: 0, nextPaidOffer: w.t + 200, exNext: 0, nextSpam: w.t + 60, drained: 0 }
  w.flags = Object.assign(defaults, w.flags) as World['flags']
  w.solUsd ??= SOL_USD
  w.solOpen ??= w.solUsd
  w.nextEvent ??= w.t + 300
  w.crt ??= false
  for (const id of ['trenchbot', 'agency']) {
    if (!w.chats[id]) w.chats[id] = { id, msgs: [], unread: 0 }
  }
  solPx.usd = w.solUsd
  return w
}

export function continueGame() {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return false
  world = migrate(JSON.parse(raw) as World)
  // real-time stamps from the last session are stale
  for (const c of Object.values(world.chats)) for (const m of c.msgs) m.rt = 0
  for (const p of world.feed) p.rt = 0
  world.paused = false
  world.solOpen = world.solUsd // header SOL % is relative to this session
  setSoundEnabled(world.sound)
  bump()
  return true
}

export function startNew(handle: string) {
  wiped = false
  world = newWorld(handle.replace(/[^a-z0-9_]/gi, '').slice(0, 15) || 'anon')
  setSoundEnabled(world.sound)
  save()
  bump()
}

export function wipe() {
  wiped = true
  localStorage.removeItem(SAVE_KEY)
}

// ---------- loop ----------

export function startLoop() {
  if (timer) return
  timer = window.setInterval(() => {
    if (!world || world.paused || document.hidden) return
    for (let i = 0; i < world.speed; i++) tick(world)
    bump()
    if (++ticks % 20 === 0) save()
  }, TICK_MS)
  window.addEventListener('beforeunload', save)
}
