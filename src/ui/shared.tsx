import type { Coin, Post } from '../game/types'
import { BOT_BY_ID } from '../game/data/bots'
import { changeOver, mcUsd } from '../game/market'
import { fmtPct, fmtUsd } from '../game/util'
import { getWorld } from '../game/store'
import { go } from './nav'

export function CoinAvatar({ c, size = 28 }: { c: Pick<Coin, 'image' | 'emoji' | 'hue'>; size?: number }) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.56,
        background: `hsl(${c.hue} 45% 13%)`,
        boxShadow: `inset 0 0 0 1px hsl(${c.hue} 50% 24%)`,
      }}
    >
      {c.image ? <img src={c.image} alt="" /> : c.emoji}
    </div>
  )
}

export function PersonAvatar({ author, size = 40 }: { author: string; size?: number }) {
  const w = getWorld()
  if (author === 'player') {
    return (
      <div className="avatar" style={{ width: size, height: size, borderRadius: '50%', background: '#0b2a18', boxShadow: 'inset 0 0 0 1px #1c7a45', fontSize: size * 0.42, color: 'var(--green)', fontWeight: 800 }}>
        {w.player.handle.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  const b = BOT_BY_ID[author]
  return (
    <div className="avatar" style={{ width: size, height: size, borderRadius: '50%', background: `hsl(${b?.hue ?? 0} 35% 14%)`, fontSize: size * 0.5 }}>
      {b?.emoji ?? '👤'}
    </div>
  )
}

export function authorInfo(p: Post) {
  const w = getWorld()
  if (p.author === 'player') return { name: w.player.handle, handle: w.player.handle, verified: w.player.followers > 10000 }
  const b = BOT_BY_ID[p.author]
  return { name: b?.name ?? 'anon', handle: b?.handle ?? 'anon', verified: !!b?.verified }
}

export function Chg({ c, n = 10 }: { c: Coin; n?: number }) {
  const r = changeOver(c, n) - 1
  return <span className={r >= 0 ? 'g' : 'r'}>{fmtPct(r, 0)}</span>
}

export const Mc = ({ c }: { c: Coin }) => <>{fmtUsd(mcUsd(c))}</>

/** renders text with $TICKERs as clickable cashtags */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\$[A-Z0-9]{2,10})/g)
  return (
    <>
      {parts.map((p, i) =>
        /^\$[A-Z0-9]{2,10}$/.test(p) ? (
          <span key={i} className="cash" onClick={() => openTicker(p.slice(1))}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export function openTicker(ticker: string) {
  const w = getWorld()
  const c = w.order.map((id) => w.coins[id]).find((x) => x && x.ticker === ticker)
  if (!c) return
  w.selected = c.id
  go('term')
}

export function openCoin(id: string) {
  getWorld().selected = id
  go('term')
}

export function ago(t: number) {
  const s = Math.max(0, getWorld().t - t)
  if (s < 60) return `${Math.floor(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

export const TRUST_COLOR = (t: number) => (t < 20 ? 'var(--red)' : t < 45 ? 'var(--amber)' : 'var(--green)')
