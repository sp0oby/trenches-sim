import { useEffect, useRef, useState } from 'react'
import { act, useWorld } from '../../game/store'
import { buy, sell } from '../../game/actions'
import { curveProgress, mcUsd, playerPosition } from '../../game/market'
import { TOTAL_SUPPLY } from '../../game/constants'
import { BOT_BY_ID } from '../../game/data/bots'
import type { Coin, Holder, World } from '../../game/types'
import { fmtAge, fmtClock, fmtNum, fmtSol, fmtUsd, shortAddr } from '../../game/util'
import Chart from '../Chart'
import { Chg, CoinAvatar } from '../shared'
import { compose, go, setNav } from '../nav'

type ListTab = 'new' | 'hot' | 'bags' | 'dead'

export default function Terminal() {
  const w = useWorld()
  const c = w.selected ? w.coins[w.selected] : undefined
  return (
    <div className="term">
      <div className="term-left">
        <PairList w={w} />
        <AgentLog w={w} />
      </div>
      <div className="term-mid">
        {c ? <CoinHeader c={c} w={w} /> : <div className="coinhead d">Select a pair</div>}
        <div className="chartwrap">
          <Chart coinId={c?.id} />
        </div>
        <div className="mid-bottom">
          {c ? <Tape c={c} /> : <div className="pane" />}
          {c ? <Holders c={c} /> : <div className="pane" />}
        </div>
      </div>
      {c ? <TradePanel c={c} w={w} /> : <div className="pane" />}
    </div>
  )
}

// ---------- pair list ----------

function PairList({ w }: { w: World }) {
  const [tab, setTab] = useState<ListTab>('new')
  let coins = w.order.map((id) => w.coins[id]).filter(Boolean)
  if (tab === 'new') coins = coins.filter((c) => c.status !== 'dead')
  if (tab === 'hot') coins = coins.filter((c) => c.status !== 'dead').sort((a, b) => mcUsd(b) - mcUsd(a))
  if (tab === 'bags') coins = coins.filter((c) => playerPosition(c).tokens > 0 || (c.byPlayer && c.status !== 'dead'))
  if (tab === 'dead') coins = coins.filter((c) => c.status === 'dead')
  return (
    <div className="pane pairs">
      <div className="pane-h">
        <span className="t">Pairs</span>
        <span className="grow" />
        <div className="seg">
          {(['new', 'hot', 'bags', 'dead'] as ListTab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="pane-b">
        {coins.map((c) => (
          <PairRow key={c.id} c={c} on={c.id === w.selected} w={w} />
        ))}
        {!coins.length && <div className="empty">{tab === 'bags' ? 'No bags. Suspicious restraint.' : tab === 'dead' ? 'Nothing has died yet. Give it a minute.' : 'nothing here'}</div>}
      </div>
    </div>
  )
}

function PairRow({ c, on, w }: { c: Coin; on: boolean; w: World }) {
  const pos = playerPosition(c)
  return (
    <div className={`pr${on ? ' on' : ''}${c.status === 'dead' ? ' dead' : ''}`} onClick={() => act((w) => (w.selected = c.id))}>
      <CoinAvatar c={c} size={30} />
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="tk">${c.ticker}</span>
          {[
            c.byPlayer && <span key="y" className="chip g">YOU</span>,
            pos.tokens > 0 && !c.byPlayer && <span key="b" className="chip c">BAG</span>,
            c.flagged && <span key="f" className="chip a">FLAG</span>,
            c.status === 'graduated' && <span key="g" className="chip g">BONDED</span>,
            c.script.kolCalled && <span key="k" className="chip p">KOL</span>,
          ]
            .filter(Boolean)
            .slice(0, 2)}
        </div>
        <div className="nm ellipsis">
          {c.status === 'dead' ? `☠ ${c.epitaph}` : `${fmtAge(w.t - c.born)} · ${c.name}`}
        </div>
        {c.status !== 'dead' && (
          <div className="minibar">
            <i style={{ width: `${curveProgress(c) * 100}%`, background: c.status === 'graduated' ? 'var(--amber)' : undefined }} />
          </div>
        )}
      </div>
      <div>
        <div className="mc num">{fmtUsd(mcUsd(c))}</div>
        <div className="ch num">
          <Chg c={c} />
        </div>
      </div>
    </div>
  )
}

// ---------- agent log ----------

function AgentLog({ w }: { w: World }) {
  const ref = useRef<HTMLDivElement>(null)
  const lines = w.log.slice(-60)
  const lastId = lines[lines.length - 1]?.id
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId])
  return (
    <div className="pane agents">
      <div className="pane-h">
        <span className="pulse" />
        <span className="t">Agents</span>
        <span className="grow" />
        <span className="num" style={{ fontSize: 11 }}>tail -f agents.log</span>
      </div>
      <div className="pane-b agentlog" ref={ref}>
        {lines.map((l, i) => (
          <div key={l.id} className={`ln ${l.tone ?? 'c'}${i >= lines.length - 2 ? ' new' : ''}`}>
            <span className="ts">{fmtClock(l.t).slice(3)}</span>
            <span className="tx">
              <span className="ag">{l.agent}</span> {l.text}
            </span>
          </div>
        ))}
        <div className="ln prompt">
          <span className="g">❯</span> <span className="cursor" />
        </div>
      </div>
    </div>
  )
}

// ---------- header ----------

function CoinHeader({ c, w }: { c: Coin; w: World }) {
  const creator = c.byPlayer ? `@${w.player.handle} (you)` : `@${BOT_BY_ID[c.creator]?.handle ?? 'anon'}`
  const holders = Object.values(c.holders).filter((h) => h.tokens > 0).length
  return (
    <div className="coinhead">
      <CoinAvatar c={c} size={42} />
      <div style={{ minWidth: 0 }}>
        <div className="title">
          <h1>{c.name}</h1>
          <span className="d">${c.ticker}</span>
          {c.status === 'dead' && <span className="chip r">DEAD</span>}
          {c.status === 'graduated' && <span className="chip g">MIGRATED</span>}
          {c.flagged && <span className="chip a">⚑ BUNDLE FLAGGED</span>}
          {c.pc.volBot && <span className="chip c">VOL BOT</span>}
        </div>
        <div className="d ellipsis" style={{ fontSize: 11 }}>
          {c.desc} · by {creator} · {fmtAge(w.t - c.born)} old
        </div>
      </div>
      <div className="kv">
        <div>
          <div className="k">Market cap</div>
          <div className="v big num">{fmtUsd(mcUsd(c))}</div>
        </div>
        <div>
          <div className="k">5m</div>
          <div className="v num"><Chg c={c} /></div>
        </div>
        <div>
          <div className="k">ATH</div>
          <div className="v num a">{fmtUsd(c.ath)}</div>
        </div>
        <div>
          <div className="k">Holders</div>
          <div className="v num">{holders}</div>
        </div>
        <div style={{ width: 110 }}>
          <div className="k">Bonding {Math.round(curveProgress(c) * 100)}%</div>
          <div className="minibar" style={{ height: 5, marginTop: 7 }}>
            <i style={{ width: `${curveProgress(c) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- tape / holders ----------

function walletTag(c: Coin, h: { kind: Holder['kind']; label?: string }, scanned: boolean) {
  if (h.kind === 'player') return <span className="g b">YOU</span>
  if (h.label?.startsWith('@')) return <span className={h.kind === 'kol' ? 'p' : 'c'}>{h.label}</span>
  if (h.kind === 'vbot') return <span className="a">{scanned ? 'vol bot' : '—'}</span>
  if (!scanned) return <span className="m">—</span>
  if (h.kind === 'insider') return <span className="r">bundle</span>
  if (h.kind === 'dev') return <span className="r">dev</span>
  if (h.kind === 'sniper') return <span className="c">sniper</span>
  if (h.kind === 'whale') return <span className="c">whale</span>
  return <span className="m">{c.byPlayer ? 'retail' : 'retail'}</span>
}

function Tape({ c }: { c: Coin }) {
  return (
    <div className="pane tape">
      <div className="pane-h">
        <span className="t">Trades</span>
        <span className="grow" />
        <span>{c.buys} buys · {c.sells} sells · vol {fmtSol(c.volume, 1)} SOL</span>
      </div>
      <div className="pane-b">
        {c.tape.slice(0, 40).map((t) => (
          <div key={t.id} className={`tr ${t.side}${t.kind === 'player' ? ' you' : ''}`}>
            <span className="d">{fmtClock(t.t).slice(3)}</span>
            <span className={t.side === 'buy' ? 'g' : 'r'}>{t.side === 'buy' ? 'BUY' : 'SELL'}</span>
            <span className="num">{fmtSol(t.sol)} SOL</span>
            <span className="num d">{fmtUsd(t.mc)}</span>
            <span className="ellipsis">
              {walletTag(c, { kind: t.kind, label: c.holders[t.wallet]?.label }, c.pc.scanned)}
              {t.viaCall && <span className="p"> 📣</span>}
            </span>
          </div>
        ))}
        {!c.tape.length && <div className="empty">no trades</div>}
      </div>
    </div>
  )
}

const CLUSTER_COLOR: Record<string, string> = { you: 'var(--green)', bundle: 'var(--red)', dev: 'var(--red)', vbot: 'var(--amber)', vip: 'var(--purple)' }

function Holders({ c }: { c: Coin }) {
  const hs = Object.values(c.holders).filter((h) => h.tokens > 0).sort((a, b) => b.tokens - a.tokens).slice(0, 30)
  const scanned = c.pc.scanned
  return (
    <div className="pane holders">
      <div className="pane-h">
        <span className="t">Top holders</span>
        <span className="grow" />
        {!scanned && (
          <button className="btn sm" onClick={() => go('bubble', { bubbleCoin: c.id })}>
            Scan holders
          </button>
        )}
        {scanned && <span className="c">Scanned</span>}
      </div>
      <div className="pane-b">
        {hs.map((h, i) => {
          const col = scanned && h.cluster ? CLUSTER_COLOR[h.cluster] : undefined
          return (
            <div key={h.id} className="hr">
              <span className="d">{i + 1}</span>
              <span className="ellipsis">
                {col && <span className="cl" style={{ background: col }} />}
                <span className={h.kind === 'player' ? 'g' : ''}>{shortAddr(h.id.replace(/^[a-z]+:/, ''))}</span>{' '}
                {walletTag(c, h, scanned)}
              </span>
              <span className="num">{((h.tokens / TOTAL_SUPPLY) * 100).toFixed(2)}%</span>
              <span className="num d">{fmtSol(h.cost)} in</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- trade panel ----------

function TradePanel({ c, w }: { c: Coin; w: World }) {
  const [amt, setAmt] = useState('0.5')
  const pos = playerPosition(c)
  const has = pos.tokens > 0
  const sinceCall = c.pc.callAt != null ? w.t - c.pc.callAt : null
  return (
    <div className="pane tradepane">
      <div className="pane-h">
        <span className="t">Trade</span>
        <span className="grow" />
        <span className="g">{fmtSol(w.player.sol)} SOL</span>
      </div>
      <div className="pane-b trade">
        <div className="field">
          <label>
            <span>Buy</span>
            <span>SOL</span>
          </label>
          <div className="quick">
            {[0.1, 0.5, 1, 5].map((v) => (
              <button key={v} className="btn g" onClick={() => act((w) => buy(w, c.id, v))}>
                {v}
              </button>
            ))}
          </div>
          <div className="row">
            <input className="input grow num" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} />
            <button className="btn solid-g" onClick={() => act((w) => buy(w, c.id, Number(amt) || 0))}>
              BUY
            </button>
          </div>
        </div>

        <div className="field">
          <label>
            <span>Sell</span>
            <span>{has ? `${fmtNum(pos.tokens)} tkn · ${(pos.pct * 100).toFixed(2)}% supply` : 'no bag'}</span>
          </label>
          <div className="quick" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[0.25, 0.5, 1].map((f) => (
              <button key={f} className="btn r" disabled={!has} onClick={() => act((w) => sell(w, c.id, f))}>
                {f * 100}%
              </button>
            ))}
          </div>
          <button className="drill" disabled={!has} onClick={() => act((w) => sell(w, c.id, 1, true))} title="sell everything from every wallet in one block (shift+D)">
            DRILL
          </button>
        </div>

        <div className="pos">
          <div title="Your bag at the current chart price">
            <div className="k">Value</div>
            <div className="v num">{has ? `${fmtSol(pos.mark)} SOL` : '—'}</div>
          </div>
          <div title="Value minus what you paid (fees included). Green exactly when the chart is above your avg entry.">
            <div className="k">PnL</div>
            <div className={`v num ${has ? (pos.markPnl >= 0 ? 'g' : 'r') : ''}`}>
              {has ? `${pos.markPnl >= 0 ? '+' : ''}${fmtSol(pos.markPnl)} (${pos.markPnl >= 0 ? '+' : ''}${((pos.markX - 1) * 100).toFixed(0)}%)` : '—'}
            </div>
          </div>
          <div title="Average market cap you bought at, fees included. Shown as the dashed line on the chart.">
            <div className="k">Avg entry</div>
            <div className="v num">{has ? fmtUsd(pos.avgEntryMc) : '—'}</div>
          </div>
          <div title="Current market cap">
            <div className="k">Now</div>
            <div className={`v num ${has ? (pos.markPnl >= 0 ? 'g' : 'r') : ''}`}>{fmtUsd(mcUsd(c))}</div>
          </div>
          <div title="What you'd actually receive selling the whole bag in one go: your own sell pushes the price down, plus the 1% fee">
            <div className="k">If dumped now</div>
            <div className={`v num ${has ? (pos.pnl >= 0 ? 'g' : 'r') : ''}`} style={{ opacity: has ? 0.8 : 1 }}>
              {has ? `${fmtSol(pos.value)} (${pos.pnl >= 0 ? '+' : ''}${fmtSol(pos.pnl)})` : '—'}
            </div>
          </div>
          <div title="How much selling the whole bag at once would push the price down">
            <div className="k">Price impact</div>
            <div className={`v num ${pos.impact > 0.1 ? 'a' : ''}`}>{has ? `-${(pos.impact * 100).toFixed(1)}%` : '—'}</div>
          </div>
          <div>
            <div className="k">Realized</div>
            <div className={`v num ${c.pc.profit >= 0 ? 'g' : 'r'}`}>{fmtSol(c.pc.profit)}</div>
          </div>
          <div>
            <div className="k">Your call</div>
            <div className="v num p">{sinceCall != null ? `${fmtAge(sinceCall)} ago` : '—'}</div>
          </div>
        </div>

        {has && pos.markPnl > 0 && pos.pnl < 0 && (
          <div className="hint" style={{ background: 'var(--amber-bg)', boxShadow: 'inset 0 0 0 1px rgba(240,160,32,.2)' }}>
            You're up on the chart, but your bag is big for this pool: dumping it all at once moves the price{' '}
            <span className="a num">{(pos.impact * 100).toFixed(0)}%</span> and would lock in a loss. Scale out in chunks, or wait for more buyers.
          </div>
        )}

        {sinceCall != null && sinceCall < 300 && (
          <div className="hint">
            <span className="p num">{fmtSol(c.pc.callSol)} SOL</span> of follower money has come in since your call.{' '}
            {sinceCall < 120 ? <span className="r">Selling now means dumping on your own call.</span> : <span className="g">Window's open — sell into it.</span>}
          </div>
        )}

        {c.pc.flex && !has && (
          <button className="btn" onClick={() => setNav({ flex: c.id })}>
            Share PnL card · <span className={c.pc.flex.pnl >= 0 ? 'g num' : 'r num'}>{c.pc.flex.pnl >= 0 ? '+' : ''}{fmtSol(c.pc.flex.pnl)} SOL</span>
          </button>
        )}

        <div className="field">
          <label>
            <span>Other tabs</span>
          </label>
          <div className="linkbtns">
            <button className="btn sm" onClick={() => compose('call', c.id)}>Shill on Y</button>
            <button className="btn sm" onClick={() => compose('fud', c.id)}>FUD on Y</button>
            <button className="btn sm" onClick={() => go('bubble', { bubbleCoin: c.id })}>Bubblemap</button>
            <button className="btn sm" onClick={() => go('tg', { tgChat: 'kev', tgOpen: true })}>Ask kev</button>
            {c.byPlayer && <button className="btn sm" onClick={() => go('bundl')}>Bundle wallets</button>}
            {c.byPlayer && <button className="btn sm" onClick={() => go('tg', { tgChat: 'agency', tgOpen: true })}>Book a KOL</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
