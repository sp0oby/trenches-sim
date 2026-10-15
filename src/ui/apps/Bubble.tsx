import { useEffect, useMemo, useState } from 'react'
import { act, useWorld } from '../../game/store'
import { scan } from '../../game/actions'
import { clusterPct, mcUsd, playerPosition } from '../../game/market'
import { TOTAL_SUPPLY } from '../../game/constants'
import type { Coin, Holder } from '../../game/types'
import { fmtUsd, hash, shortAddr } from '../../game/util'
import { CoinAvatar, openCoin } from '../shared'
import { compose, setNav, useNav } from '../nav'
import { P } from '../palette'

const KIND_COLOR: Record<string, string> = {
  player: P.up,
  insider: P.down,
  dev: '#ff7a59',
  kol: P.purple,
  sniper: P.cyan,
  whale: P.blue,
  vbot: P.amber,
  retail: '#52525b',
}

interface Node {
  id: string
  x: number
  y: number
  r: number
  color: string
  cluster: string
  h: Holder
}

function layout(c: Coin, W: number, H: number): { nodes: Node[]; links: [Node, Node][] } {
  const hs = Object.values(c.holders).filter((h) => h.tokens > 0).sort((a, b) => b.tokens - a.tokens).slice(0, 60)
  const groups = new Map<string, Holder[]>()
  for (const h of hs) {
    const key = h.cluster && h.kind !== 'retail' ? h.cluster : `solo:${h.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(h)
  }
  const keys = [...groups.keys()].sort((a, b) => groups.get(b)!.reduce((s, h) => s + h.tokens, 0) - groups.get(a)!.reduce((s, h) => s + h.tokens, 0))
  const nodes: Node[] = []
  const links: [Node, Node][] = []
  const cx = W / 2
  const cy = H / 2
  const maxR = Math.min(W, H) * 0.42
  const golden = Math.PI * (3 - Math.sqrt(5))
  keys.forEach((k, gi) => {
    const members = groups.get(k)!
    const rad = gi === 0 ? 0 : maxR * Math.sqrt(gi / keys.length) * 1.05
    const ang = gi * golden + (hash(c.id) % 100) / 16
    const gx = cx + Math.cos(ang) * rad
    const gy = cy + Math.sin(ang) * rad * 0.8
    const gNodes: Node[] = []
    members.forEach((h, mi) => {
      const r = Math.max(4, Math.sqrt(h.tokens / TOTAL_SUPPLY) * 140)
      const ring = members.length > 1 ? 14 + Math.sqrt(members.length) * 12 : 0
      const a = (mi / members.length) * Math.PI * 2
      const n: Node = {
        id: h.id,
        x: gx + Math.cos(a) * ring,
        y: gy + Math.sin(a) * ring,
        r,
        color: KIND_COLOR[h.kind] ?? KIND_COLOR.retail,
        cluster: k,
        h,
      }
      gNodes.push(n)
      nodes.push(n)
    })
    if (gNodes.length > 1) for (let i = 1; i < gNodes.length; i++) links.push([gNodes[0], gNodes[i]])
  })
  return { nodes, links }
}

export default function Bubble() {
  const w = useWorld()
  const nav = useNav()
  const [scanning, setScanning] = useState<string | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [hover, setHover] = useState<Node | null>(null)
  const coins = w.order.map((id) => w.coins[id]).filter(Boolean)
  const cid = nav.bubbleCoin && w.coins[nav.bubbleCoin] ? nav.bubbleCoin : w.selected
  const c = cid ? w.coins[cid] : undefined

  const runScan = (coin: Coin) => {
    setScanning(coin.id)
    const holders = Object.keys(coin.holders).length
    const steps = [
      `fetching ${holders} holders for $${coin.ticker}…`,
      'tracing funding sources (3 hops)…',
      'matching block 0 transactions…',
      'clustering wallets by funder + timing…',
      'rendering bubbles. brace yourself.',
    ]
    setLines([])
    steps.forEach((s, i) => setTimeout(() => setLines((l) => [...l, s]), 240 * i))
    setTimeout(() => {
      act((w) => scan(w, coin.id))
      setScanning(null)
    }, 240 * steps.length + 200)
  }

  // the map is laid out once per scan; sizes still follow live balances
  const [box, setBox] = useState({ W: 800, H: 600 })
  useEffect(() => {
    const el = document.getElementById('bubble-stage')
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ W: el.clientWidth, H: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const holderCount = c ? Object.keys(c.holders).length : 0
  const { nodes, links } = useMemo(() => (c && c.pc.scanned ? layout(c, box.W, box.H) : { nodes: [], links: [] }),
    // relayout when holder set changes meaningfully
    [c?.id, c?.pc.scanned, box.W, box.H, Math.floor(holderCount / 8)])

  const clustered = c ? clusterPct(c) : 0
  const sniperPct = c ? Object.values(c.holders).filter((h) => h.kind === 'sniper').reduce((s, h) => s + h.tokens, 0) / TOTAL_SUPPLY : 0
  const linked = c ? Object.values(c.holders).filter((h) => h.cluster && h.kind !== 'retail' && h.tokens > 0).length : 0
  const verdict = clustered > 0.35 ? ['CABAL OWNED', 'r'] : clustered > 0.18 ? ['BUNDLED', 'r'] : clustered > 0.08 ? ['SUS', 'a'] : ['LOOKS CLEAN', 'g']

  return (
    <div className="bubble">
      <div className="pane">
        <div className="pane-h">
          <span className="t">Bubblemapz</span>
        </div>
        <div className="pane-b">
          {coins.map((x) => (
            <div key={x.id} className={`coinpick${x.id === cid ? ' on' : ''}`} style={{ opacity: x.status === 'dead' ? 0.42 : 1 }} onClick={() => setNav({ bubbleCoin: x.id })}>
              <CoinAvatar c={x} size={22} />
              <span className="b">${x.ticker}</span>
              <span className="grow" />
              {x.pc.scanned ? <span className="c" style={{ fontSize: 10 }}>scanned</span> : <span className="m" style={{ fontSize: 10 }}>—</span>}
              <span className="d num">{fmtUsd(mcUsd(x))}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stage" id="bubble-stage">
        <div className="grid" />
        {c && c.pc.scanned && (
          <svg viewBox={`0 0 ${box.W} ${box.H}`}>
            {links.map(([a, b], i) => (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={a.color} strokeOpacity={0.35} strokeWidth={1} />
            ))}
            {nodes.map((n, i) => {
              const live = c.holders[n.id]
              const r = live ? Math.max(4, Math.sqrt(live.tokens / TOTAL_SUPPLY) * 140) : 3
              return (
                <g key={n.id} className="node" style={{ animation: `nodeIn .6s cubic-bezier(.2,.8,.2,1) ${Math.min(i * 16, 700)}ms both`, transformOrigin: `${n.x}px ${n.y}px` }} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}>
                  <circle cx={n.x} cy={n.y} r={r} fill={n.color} fillOpacity={0.14} stroke={n.color} strokeOpacity={0.9} strokeWidth={1.25} />
                  {r > 14 && (
                    <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize={9} fill={n.color} fontFamily="Geist Mono Variable" fontWeight={500}>
                      {((live?.tokens ?? 0) / TOTAL_SUPPLY * 100).toFixed(1)}%
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
        {hover && (
          <div style={{ position: 'absolute', left: Math.min(hover.x + 14, box.W - 220), top: hover.y + 14, background: '#000', border: '1px solid var(--line-2)', borderRadius: 6, padding: '8px 10px', pointerEvents: 'none', fontSize: 11, width: 200 }}>
            <div style={{ color: hover.color }} className="b">{hover.h.label ?? shortAddr(hover.h.id.replace(/^[a-z]+:/, ''))}</div>
            <div className="d">{hover.h.kind === 'player' ? 'you' : hover.h.kind} {hover.cluster.startsWith('solo') ? '· unlinked' : `· cluster "${hover.cluster}"`}</div>
            <div>{((hover.h.tokens / TOTAL_SUPPLY) * 100).toFixed(2)}% · {hover.h.cost.toFixed(2)} SOL in</div>
          </div>
        )}
        {c && !c.pc.scanned && !scanning && (
          <div className="scanning">
            <div className="box cta">
              <CoinAvatar c={c} size={48} />
              <div style={{ margin: '10px 0 4px' }} className="b">${c.ticker} hasn't been mapped yet</div>
              <div className="d" style={{ marginBottom: 14 }}>{playerPosition(c).tokens > 0 ? 'you already bought it. checking now is very on brand.' : 'scan before you ape. or don\'t. nobody does.'}</div>
              <button className="btn g" onClick={() => runScan(c)}>Run cluster scan</button>
            </div>
          </div>
        )}
        {scanning && (
          <div className="scanning">
            <div className="sweep" />
            <div className="box" style={{ position: 'relative' }}>
              {lines.map((l, i) => (
                <div key={i} className={i === lines.length - 1 ? 'c' : 'd'}>
                  <span className="g">❯</span> {l}
                </div>
              ))}
              <span className="cursor" />
            </div>
          </div>
        )}
        {!c && <div className="scanning d">pick a token</div>}
      </div>

      <div className="pane">
        <div className="pane-h">
          <span className="t">Analysis</span>
        </div>
        <div className="pane-b" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {c && c.pc.scanned ? (
            <>
              <div className="row">
                <CoinAvatar c={c} size={34} />
                <div>
                  <div className="b">${c.ticker}</div>
                  <div className="d">{fmtUsd(mcUsd(c))} · {Object.keys(c.holders).length} holders</div>
                </div>
              </div>
              <div>
                <div className="d up" style={{ fontSize: 10 }}>verdict</div>
                <div className={`verdict ${verdict[1]}`}>{verdict[0]}</div>
              </div>
              <div className="est">
                <span className="k">clustered supply</span><span className="num b">{(clustered * 100).toFixed(1)}%</span>
                <span className="k">linked wallets</span><span className="num">{linked}</span>
                <span className="k">snipers</span><span className="num">{(sniperPct * 100).toFixed(1)}%</span>
                <span className="k">sleuth status</span><span className={c.flagged ? 'a' : 'd'}>{c.flagged ? 'EXPOSED' : 'not yet'}</span>
              </div>
              <div className="col" style={{ gap: 6 }}>
                {Object.entries(KIND_COLOR).map(([k, col]) => (
                  <div key={k} className="row" style={{ gap: 8, fontSize: 11 }}>
                    <span className="cl" style={{ background: col }} /> {k === 'player' ? 'you' : k === 'insider' ? 'bundle wallet' : k}
                  </div>
                ))}
              </div>
              <div className="col" style={{ gap: 6 }}>
                {!c.byPlayer && clustered > 0.18 && <button className="btn r" onClick={() => compose('fud', c.id)}>𝕐 expose it on y.com</button>}
                <button className="btn g" onClick={() => openCoin(c.id)}>▣ open chart</button>
                <button className="btn" onClick={() => runScan(c)}>⟳ rescan</button>
              </div>
            </>
          ) : (
            <div className="d">scan a token to see who actually owns it. spoiler: it's not "the community".</div>
          )}
        </div>
      </div>
    </div>
  )
}
