import { useEffect, useMemo, useState } from 'react'
import { act, startLoop, useWorld, save } from '../game/store'
import { changeOver, mcUsd } from '../game/market'
import { fmtClock, fmtNum, fmtSol } from '../game/util'
import { setSoundEnabled } from '../game/audio'
import { followerPower } from '../game/engine'
import { sell } from '../game/actions'
import { APPS, go, goBack, goFwd, useNav, type AppId } from './nav'
import { TRUST_COLOR, openCoin } from './shared'
import { Overlays, useShake } from './Overlays'
import Tween from './Tween'
import FlexModal from './FlexCard'
import Terminal from './apps/Terminal'
import Y from './apps/Y'
import Bundl from './apps/Bundl'
import Bubble from './apps/Bubble'
import Telegrum from './apps/Telegrum'
import Kolscam from './apps/Kolscam'

export const ACCENT: Record<AppId, string> = {
  term: '#2ebd85',
  y: '#e7e9ea',
  bundl: '#f0a020',
  bubble: '#38bdf8',
  tg: '#4e9ad6',
  kol: '#8b7cf6',
}

const EV_COLOR = { g: '#2ebd85', r: '#f6465d', a: '#f0a020', p: '#8b7cf6', b: '#4c8dff' }

export default function Shell() {
  const w = useWorld()
  const nav = useNav()
  const shake = useShake()

  useEffect(() => startLoop(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key >= '1' && e.key <= '6' && !e.metaKey && !e.ctrlKey) {
        go(APPS[Number(e.key) - 1].id)
      } else if (e.key === ' ') {
        e.preventDefault()
        act((w) => (w.paused = !w.paused))
      } else if (e.key === 'D' && e.shiftKey && w.selected) {
        act((w) => sell(w, w.selected!, 1, true))
      } else if (e.altKey && e.key === 'ArrowLeft') goBack()
      else if (e.altKey && e.key === 'ArrowRight') goFwd()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [w])

  const sel = w.selected ? w.coins[w.selected] : undefined
  const ySeenUnread = w.feed.filter((p) => p.id > nav.ySeen && p.replyTo === w.player.handle).length
  const tgUnread = Object.values(w.chats).reduce((s, c) => s + c.unread, 0)
  const myLive = Object.values(w.coins).filter((c) => c.byPlayer && c.status !== 'dead').length
  const badges: Partial<Record<AppId, number>> = { y: nav.app === 'y' ? 0 : ySeenUnread, tg: tgUnread, bundl: myLive }

  const path = useMemo(() => {
    switch (nav.app) {
      case 'term': return sel ? `/sol/${sel.ticker.toLowerCase()}` : '/'
      case 'y': return '/home'
      case 'bundl': return '/create'
      case 'bubble': return nav.bubbleCoin ? `/sol/token/${w.coins[nav.bubbleCoin]?.ticker.toLowerCase() ?? ''}` : '/sol'
      case 'tg': return `/#@${nav.tgChat}`
      case 'kol': return `/u/${w.player.handle}`
    }
  }, [nav.app, nav.bubbleCoin, nav.tgChat, sel, w])

  const host = APPS.find((a) => a.id === nav.app)!.host
  const hot = Object.values(w.coins)
    .filter((c) => c.status !== 'dead')
    .sort((a, b) => mcUsd(b) - mcUsd(a))
    .slice(0, 12)

  const p = w.player
  const solChg = w.solUsd / (w.solOpen || w.solUsd) - 1
  const ev = w.event
  return (
    <div className={`shell${shake ? ' shake' : ''}${w.crt ? ' crt-on' : ''}`} style={{ ['--tab-accent' as string]: ACCENT[nav.app] }}>
      <div className="tabs">
        <div className="dots"><i /><i /><i /></div>
        {APPS.map((a, i) => (
          <button key={a.id} className={`tab${nav.app === a.id ? ' on' : ''}`} style={{ ['--tab-accent' as string]: ACCENT[a.id] }} onClick={() => go(a.id)} title={`${a.label} (${i + 1})`}>
            <span className="ic">{a.icon}</span>
            <span className="lbl ellipsis">{a.label}</span>
            <span className="lbl-s">{a.short}</span>
            {badges[a.id] ? <span className="badge">{badges[a.id]}</span> : <span className="k">{i + 1}</span>}
          </button>
        ))}
      </div>

      <div className="addr">
        <span className="m-brand">
          trenches<span>.sim</span>
        </span>
        <button className="nav-btn" onClick={goBack} disabled={!nav.back.length} title="Back (alt+←)">‹</button>
        <button className="nav-btn" onClick={goFwd} disabled={!nav.fwd.length} title="Forward (alt+→)">›</button>
        <button className="nav-btn" onClick={() => go(nav.app, { loading: Date.now() })} title="Reload">↻</button>
        <div className="url">
          <span className="lock">⌁</span>
          <span>{host}</span>
          <span className="path">{path}</span>
          <span key={nav.loading} className="loadbar" />
        </div>
        <span className="clock num">{fmtClock(w.t)}</span>
        <div className="speed">
          <button className={w.paused ? 'on' : ''} onClick={() => act((w) => (w.paused = !w.paused))} title="Pause (space)">{w.paused ? '▶' : '❚❚'}</button>
          {[1, 2, 4].map((s) => (
            <button key={s} className={!w.paused && w.speed === s ? 'on' : ''} onClick={() => act((w) => { w.speed = s; w.paused = false })}>{s}×</button>
          ))}
        </div>
        <button className="nav-btn" title="Sound" onClick={() => act((w) => { w.sound = !w.sound; setSoundEnabled(w.sound) })}>
          {w.sound ? '♪' : '–'}
        </button>
      </div>

      <div className="hud">
        <div className="stat"><span className="l">Balance</span><Tween className="v" value={p.sol} format={(n) => `${fmtSol(n)} SOL`} /></div>
        <div className="stat"><span className="l">Extraction</span><Tween className={`v ${p.xp >= 0 ? 'g' : 'r'}`} value={p.xp} format={(n) => `${Math.round(n).toLocaleString()} XP`} /></div>
        <div className="stat"><span className="l">Followers</span><Tween className="v" value={p.followers} format={fmtNum} /></div>
        <div className="stat" title="Trust scales how hard your calls hit">
          <span className="l">Trust</span>
          <div className="trustbar"><i style={{ width: `${p.trust}%`, background: TRUST_COLOR(p.trust) }} /></div>
          <span className="v" style={{ color: TRUST_COLOR(p.trust) }}>{Math.round(p.trust)}</span>
        </div>
        <div className="stat" title="Follower power: how much SOL your calls move"><span className="l">Power</span><span className="v p">{followerPower(p).toFixed(2)}</span></div>
        <div className="stat"><span className="l">SOL</span><span className="v">${w.solUsd.toFixed(2)}</span><span className={`num ${solChg >= 0 ? 'g' : 'r'}`} style={{ fontSize: 11.5 }}>{solChg >= 0 ? '+' : ''}{(solChg * 100).toFixed(1)}%</span></div>
        {ev && (
          <div className="eventbar" key={ev.id + ev.until} title={ev.desc} style={{ ['--ev' as string]: EV_COLOR[ev.color], ['--ev-bg' as string]: `${EV_COLOR[ev.color]}22` }}>
            <span className="pulse" style={{ background: EV_COLOR[ev.color] }} />
            <b>{ev.name}</b>
            <span className="ev-time">{Math.max(0, Math.ceil(ev.until - w.t))}s</span>
          </div>
        )}
        <div className="marquee">
          <div className="track">
            {[...hot, ...hot].map((c, i) => {
              const r = changeOver(c, 10) - 1
              return (
                <span key={c.id + i} className="item" onClick={() => openCoin(c.id)}>
                  {c.emoji} ${c.ticker} <span className={r >= 0 ? 'g' : 'r'}>{r >= 0 ? '+' : ''}{(r * 100).toFixed(0)}%</span>
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <div className="view" key={nav.app}>
        <div style={{ height: '100%', animation: 'fadeIn .25s ease-out' }}>
          {nav.app === 'term' && <Terminal />}
          {nav.app === 'y' && <Y />}
          {nav.app === 'bundl' && <Bundl />}
          {nav.app === 'bubble' && <Bubble />}
          {nav.app === 'tg' && <Telegrum />}
          {nav.app === 'kol' && <Kolscam />}
        </div>
      </div>

      <StatusBar paused={w.paused} />
      <Overlays />
      <FlexModal />
    </div>
  )
}

function StatusBar({ paused }: { paused: boolean }) {
  const [saved, setSaved] = useState(false)
  return (
    <div className="statusbar">
      <span className="row" style={{ gap: 8 }}>
        <span className="pulse" style={paused ? { background: 'var(--amber)' } : undefined} />
        {paused ? 'Paused' : '29 agents online'}
      </span>
      <span>sleuth.exe watching</span>
      <span className="grow" />
      <span><kbd>1</kbd>–<kbd>6</kbd> switch site</span>
      <span><kbd>space</kbd> pause</span>
      <span><kbd>⇧</kbd><kbd>D</kbd> drill</span>
      <button
        className="d"
        onClick={() => {
          save()
          setSaved(true)
          setTimeout(() => setSaved(false), 1200)
        }}
      >
        {saved ? 'Saved ✓' : 'Autosave on'}
      </button>
    </div>
  )
}
