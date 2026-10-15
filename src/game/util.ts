export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1))
export const chance = (p: number) => Math.random() < p
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

export function weighted<T extends string>(table: Record<T, number>): T {
  const entries = Object.entries(table) as [T, number][]
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0)
  for (const [k, w] of entries) {
    r -= w
    if (r <= 0) return k
  }
  return entries[0][0]
}

export function poisson(lambda: number) {
  if (lambda <= 0) return 0
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= Math.random()
  } while (p > L && k < 50)
  return k - 1
}

export function lognorm(median: number, sigma: number) {
  const u = 1 - Math.random()
  const v = Math.random()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return median * Math.exp(sigma * z)
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function addr(len = 8) {
  let s = ''
  for (let i = 0; i < len; i++) s += B58[Math.floor(Math.random() * B58.length)]
  return s
}
export const shortAddr = (id: string) => (id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : `${id.slice(0, 4)}…${id.slice(4)}`)

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function fill(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}

// ---------- formatting ----------

export function fmtUsd(n: number) {
  const a = Math.abs(n)
  const s = n < 0 ? '-' : ''
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`
  if (a >= 1e4) return `${s}$${(a / 1e3).toFixed(1)}K`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(2)}K`
  return `${s}$${a.toFixed(0)}`
}

export function fmtSol(n: number, d = 2) {
  if (Math.abs(n) < 0.01 && n !== 0) return n.toFixed(4)
  return n.toFixed(d)
}

export function fmtNum(n: number) {
  const a = Math.abs(n)
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString('en-US')
}

export function fmtPct(n: number, d = 1) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)}%`
}

export function fmtAge(sec: number) {
  sec = Math.max(0, Math.floor(sec))
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ${String(sec % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export function fmtClock(t: number) {
  const s = (3 * 3600 + 33 * 60 + Math.floor(t)) % 86400
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
