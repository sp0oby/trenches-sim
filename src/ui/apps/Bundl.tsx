import { useRef, useState } from 'react'
import { act, useWorld } from '../../game/store'
import { estimateLaunch, launch, sell, sellWallet, toggleVolBot, type LaunchParams } from '../../game/actions'
import { EMOJI_PICKER, generateIdentity } from '../../game/data/coins'
import { holderValue, mcUsd, playerPosition } from '../../game/market'
import { TOTAL_SUPPLY } from '../../game/constants'
import type { Coin, World } from '../../game/types'
import { fmtAge, fmtSol, fmtUsd, hash, shortAddr } from '../../game/util'
import { CoinAvatar, openCoin } from '../shared'
import { compose, go } from '../nav'

const TIPS = [0.01, 0.05, 0.1, 0.3, 0.5]
const RISK_COLOR: Record<string, string> = { LOW: 'var(--green)', SUS: 'var(--amber)', OBVIOUS: '#ff7a3c', 'FEDS WATCHING': 'var(--red)' }

export default function Bundl() {
  const w = useWorld()
  return (
    <div className="bundl">
      <DeployForm w={w} />
      <Deployments w={w} />
    </div>
  )
}

function DeployForm({ w }: { w: World }) {
  const [lp, setLp] = useState<LaunchParams>(() => {
    const id = generateIdentity(new Set())
    return { name: id.name, ticker: id.ticker, emoji: id.emoji, desc: id.desc, pct: 25, wallets: 8, tip: 0.1, fresh: true }
  })
  const [deploying, setDeploying] = useState<string[] | null>(null)
  const [done, setDone] = useState<Coin | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const est = estimateLaunch(lp)
  const set = (p: Partial<LaunchParams>) => setLp((x) => ({ ...x, ...p }))
  const ticker = lp.ticker.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10)
  const afford = est.total <= w.player.sol

  const onFile = (f?: File) => {
    if (!f) return
    const img = new Image()
    img.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 96
      const ctx = cv.getContext('2d')!
      const s = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96)
      set({ image: cv.toDataURL('image/jpeg', 0.8) })
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(f)
  }

  const deploy = () => {
    const lines = [
      `minting $${ticker || 'RUG'} (1,000,000,000 supply)…`,
      lp.fresh ? `funding ${lp.wallets} fresh wallets via 4 hops through "definitely_not_me.sol"…` : `funding ${lp.wallets} wallets straight from your main. bold.`,
      `building jito bundle: create + ${lp.wallets} buys, tip ${lp.tip} SOL…`,
      `submitting to block engine…`,
    ]
    setDeploying([])
    setDone(null)
    lines.forEach((l, i) => setTimeout(() => setDeploying((d) => [...(d ?? []), l]), 260 * (i + 1)))
    setTimeout(() => {
      const c = act((w) => launch(w, lp))
      if (!c) {
        setDeploying((d) => [...(d ?? []), '✗ bundle failed: insufficient SOL'])
        return
      }
      setDeploying((d) => [...(d ?? []), `✓ landed in block 0. ${lp.pct}% secured across ${lp.wallets} wallets.`])
      setDone(c)
      const id = generateIdentity(new Set([c.ticker]))
      set({ name: id.name, ticker: id.ticker, emoji: id.emoji, desc: id.desc, image: undefined })
    }, 260 * (lines.length + 1) + 200)
  }

  const cmd = `pump deploy --name "${lp.name}" --ticker ${ticker || '???'} \\\n  --bundle ${lp.pct}% --wallets ${lp.wallets} --jito-tip ${lp.tip}${lp.fresh ? ' --fresh-funding' : ''}`

  return (
    <div className="form">
      <div className="brand">
        <h2>bundl<span style={{ color: 'var(--amber)' }}>.fun</span></h2>
        <span className="d">Launch it. Bundle it. Deny it.</span>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <button onClick={() => file.current?.click()} title="upload image">
          <CoinAvatar c={{ emoji: lp.emoji, image: lp.image, hue: hash(ticker || 'X') % 360 }} size={64} />
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="grow col" style={{ gap: 8 }}>
          <div className="row">
            <input className="input grow" placeholder="name" value={lp.name} maxLength={32} onChange={(e) => set({ name: e.target.value })} />
            <input className="input" style={{ width: 110 }} placeholder="TICKER" value={lp.ticker} maxLength={10} onChange={(e) => set({ ticker: e.target.value.toUpperCase() })} />
          </div>
          <input className="input" placeholder="description (lie here)" value={lp.desc} maxLength={80} onChange={(e) => set({ desc: e.target.value })} />
        </div>
      </div>

      <div className="emojis">
        {EMOJI_PICKER.map((e) => (
          <button key={e} className={!lp.image && lp.emoji === e ? 'on' : ''} onClick={() => set({ emoji: e, image: undefined })}>
            {e}
          </button>
        ))}
      </div>

      <div className="field">
        <label>
          <span>Block 0 supply</span>
          <span className="a">{lp.pct}%</span>
        </label>
        <input type="range" min={0} max={70} style={{ ['--fill' as string]: `${(lp.pct / 70) * 100}%` }} value={lp.pct} onChange={(e) => set({ pct: Number(e.target.value) })} />
      </div>
      <div className="field">
        <label>
          <span>Bundle wallets</span>
          <span className="a">{lp.wallets}</span>
        </label>
        <input type="range" min={1} max={20} style={{ ['--fill' as string]: `${((lp.wallets - 1) / 19) * 100}%` }} value={lp.wallets} onChange={(e) => set({ wallets: Number(e.target.value) })} />
      </div>
      <div className="field">
        <label>
          <span>Jito tip</span>
          <span>Snipers: {est.sniper}</span>
        </label>
        <div className="seg">
          {TIPS.map((t) => (
            <button key={t} className={lp.tip === t ? 'on' : ''} onClick={() => set({ tip: t })}>
              {t} SOL
            </button>
          ))}
        </div>
      </div>
      <button className="row" onClick={() => set({ fresh: !lp.fresh })} style={{ textAlign: 'left' }}>
        <span className={`toggle${lp.fresh ? ' on' : ''}`} />
        <span>
          Fresh-fund wallets <span className="d">(+{(0.004 * lp.wallets).toFixed(3)} SOL, looks less linked)</span>
        </span>
      </button>

      <div className="field">
        <label>
          <span>Detection risk</span>
          <span style={{ color: RISK_COLOR[est.label] }}>{est.label}</span>
        </label>
        <div className="risk">
          <i style={{ width: `${Math.min(100, (est.risk / 70) * 100)}%`, background: RISK_COLOR[est.label] }} />
        </div>
      </div>

      <div className="est">
        <span className="k">Bundle buy</span><span className="num">{fmtSol(est.bundleCost)} SOL</span>
        <span className="k">Fees + tip{lp.fresh ? ' + funding' : ''}</span><span className="num">{fmtSol(est.fees, 3)} SOL</span>
        <span className="k">Avg entry market cap</span><span className="num">{lp.pct ? fmtUsd(est.avgEntryMc) : '—'}</span>
        <span className="k b" style={{ color: 'var(--text)' }}>Total</span><span className={`num b ${afford ? '' : 'r'}`}>{fmtSol(est.total)} / {fmtSol(w.player.sol)} SOL</span>
      </div>

      <div className="cmd">
        <span className="pr">$ </span>
        {cmd}
      </div>

      <button className="btn solid-g" style={{ height: 40, fontSize: 13, letterSpacing: '.15em' }} disabled={!afford || !!(deploying && !done && deploying.length < 6)} onClick={deploy}>
        Deploy + bundle
      </button>

      {deploying && (
        <div className="deploy-log">
          {deploying.map((l, i) => (
            <div key={i} className={l.startsWith('✓') ? 'g' : l.startsWith('✗') ? 'r' : 'd'}>
              <span className="g">❯</span> {l}
            </div>
          ))}
          {!done && deploying.length < 5 && <span className="cursor" />}
          {done && (
            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn g sm" onClick={() => openCoin(done.id)}>Open chart</button>
              <button className="btn p sm" onClick={() => compose('call', done.id)}>Shill on Y</button>
              <button className="btn sm" onClick={() => go('tg', { tgChat: 'sherlock', tgOpen: true })}>Pay off the sleuth</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Deployments({ w }: { w: World }) {
  const mine = w.order.map((id) => w.coins[id]).filter((c) => c && c.byPlayer)
  const live = mine.filter((c) => c.status !== 'dead' || playerPosition(c).tokens > 0)
  const dead = mine.filter((c) => !live.includes(c))
  return (
    <div className="deploys">
      <div className="section-h">Your deployments · {live.length} live · {w.player.stats.launched} total</div>
      {live.map((c) => (
        <DeployCard key={c.id} c={c} w={w} />
      ))}
      {!live.length && (
        <div className="empty" style={{ border: '1px dashed var(--line-2)', borderRadius: 10 }}>
          No live coins. The form on the left is a crime waiting to happen.
        </div>
      )}
      {dead.length > 0 && (
        <>
          <div className="section-h" style={{ marginTop: 10 }}>Graveyard</div>
          {dead.slice(0, 12).map((c) => (
            <div key={c.id} className="row d" style={{ padding: '4px 0' }}>
              <CoinAvatar c={c} size={20} /> ${c.ticker} · ath {fmtUsd(c.ath)} · {c.rekt ?? 0} rekt · realized{' '}
              <span className={c.pc.profit >= 0 ? 'g' : 'r'}>{fmtSol(c.pc.profit)} SOL</span> · {c.epitaph}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function DeployCard({ c, w }: { c: Coin; w: World }) {
  const wallets = Object.values(c.holders).filter((h) => h.kind === 'player').sort((a, b) => b.tokens - a.tokens)
  const pos = playerPosition(c)
  const age = w.t - c.born
  return (
    <div className="dcard">
      <div className="top">
        <CoinAvatar c={c} size={36} />
        <div className="grow">
          <div className="row">
            <b>${c.ticker}</b>
            <span className="d ellipsis">{c.name}</span>
            {c.status === 'dead' && <span className="chip r">DEAD</span>}
            {c.status === 'graduated' && <span className="chip g">BONDED</span>}
            {c.flagged ? <span className="chip a">⚑ EXPOSED</span> : <span className="chip g">UNDETECTED</span>}
          </div>
          <div className="d" style={{ fontSize: 11 }}>
            {fmtAge(age)} · bundled {c.bundlePct}% / {c.bundleWallets} wallets · {fmtUsd(mcUsd(c))} mcap · ath {fmtUsd(c.ath)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="b num">{fmtSol(pos.value)} SOL</div>
          <div className={`num ${pos.pnl >= 0 ? 'g' : 'r'}`} style={{ fontSize: 11 }}>
            {pos.tokens > 0 ? `${pos.pnl >= 0 ? '+' : ''}${fmtSol(pos.pnl)} unrealized` : 'no bag'}
          </div>
        </div>
      </div>
      <div className="wallets">
        <div className="wr head">
          <span>Wallet</span>
          <span>Supply</span>
          <span>Value</span>
          <span>Cost</span>
          <span />
        </div>
        {wallets.map((h) => (
          <div key={h.id} className="wr">
            <span className="ellipsis">
              <span className="g">{shortAddr(h.id.replace('you:', ''))}</span> {h.label && <span className="chip g">{h.label}</span>}
            </span>
            <span className="num">{((h.tokens / TOTAL_SUPPLY) * 100).toFixed(2)}%</span>
            <span className="num">{fmtSol(holderValue(c, h))}</span>
            <span className="num d">{fmtSol(h.cost)}</span>
            <button className="btn r sm" disabled={h.tokens <= 0} onClick={() => act((w) => sellWallet(w, c.id, h.id))}>
              sell
            </button>
          </div>
        ))}
      </div>
      <div className="acts">
        <button className="drill" style={{ width: 'auto', padding: '0 22px', height: 32, fontSize: 12 }} disabled={pos.tokens <= 0} onClick={() => act((w) => sell(w, c.id, 1, true))}>
          DRILL ALL
        </button>
        <button className="btn r" disabled={pos.tokens <= 0} onClick={() => act((w) => sell(w, c.id, 0.25))}>Scale out 25%</button>
        <button className="btn p" onClick={() => compose('call', c.id)}>Shill</button>
        <button className="btn g" onClick={() => openCoin(c.id)}>Chart</button>
        <span className="grow" />
        {c.status !== 'dead' && (
          <button className="row" onClick={() => act((w) => toggleVolBot(w, c.id))} title="fake volume. attracts retail. raises detection.">
            <span className={`toggle${c.pc.volBot ? ' on' : ''}`} />
            <span className={c.pc.volBot ? 'c' : 'd'}>Volume bot {c.pc.volBot ? '(0.024 SOL/s)' : ''}</span>
          </button>
        )}
      </div>
    </div>
  )
}
