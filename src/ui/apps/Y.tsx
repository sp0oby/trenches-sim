import { useEffect, useState } from 'react'
import { act, getWorld, useWorld } from '../../game/store'
import { post, type PostMode } from '../../game/actions'
import { followerPower } from '../../game/engine'
import { TEMPLATES } from '../../game/data/lines'
import { BOTS } from '../../game/data/bots'
import { mcUsd } from '../../game/market'
import type { Post } from '../../game/types'
import { fmtNum, fmtUsd } from '../../game/util'
import { PersonAvatar, RichText, TRUST_COLOR, ago, authorInfo, openCoin, CoinAvatar, Chg } from '../shared'
import { setNav, useNav } from '../nav'

type Filter = 'all' | 'mine' | 'coin'

export default function Y() {
  const w = useWorld()
  const nav = useNav()
  const [filter, setFilter] = useState<Filter>('all')

  // mark replies as seen while on this tab
  const top = w.feed[0]?.id ?? 0
  useEffect(() => {
    if (top > nav.ySeen) setNav({ ySeen: top })
  }, [top, nav.ySeen])

  const sel = w.selected ? w.coins[w.selected] : undefined
  let feed = w.feed
  if (filter === 'mine') feed = feed.filter((p) => p.author === 'player' || p.replyTo === w.player.handle)
  if (filter === 'coin' && sel) feed = feed.filter((p) => p.coinId === sel.id)

  const p = w.player
  return (
    <div className="y">
      <div className="side left">
        <div className="logo">Y</div>
        <div className="card">
          <div className="row">
            <PersonAvatar author="player" size={44} />
            <div>
              <div className="b">{p.handle} {p.followers > 10000 && <span className="verified">✓</span>}</div>
              <div className="d">@{p.handle}</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 14 }}>
            <span><b>{fmtNum(p.followers)}</b> <span className="d">followers</span></span>
            <span><b>{p.stats.posts}</b> <span className="d">posts</span></span>
          </div>
          <div style={{ marginTop: 10 }} className="d">
            trust <b style={{ color: TRUST_COLOR(p.trust) }}>{Math.round(p.trust)}</b> · power <b className="p">{followerPower(p).toFixed(2)}</b>
          </div>
          <div className="d" style={{ marginTop: 8, fontSize: 11 }}>
            bio: {p.stats.rekt > 20 ? 'serial extractor. nfa. dyor. ngmi (you)' : p.stats.launched > 0 ? 'dev. not your friend.' : 'just here for the tech 🤝'}
          </div>
        </div>
        <div className="card d" style={{ fontSize: 11 }}>
          <h3 style={{ color: '#e7e9ea', fontSize: 15 }}>How calls work</h3>
          FOMO = power × template × degen score ÷ spam ÷ top-holder concentration ÷ flags × momentum.
          <br /><br />
          dumping within 2 min of your own call costs trust + followers. waiting for the wave then selling into it is the play.
        </div>
      </div>

      <div className="main">
        <Composer />
        <div className="ytabs">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>For you</button>
          <button className={filter === 'mine' ? 'on' : ''} onClick={() => setFilter('mine')}>You + replies</button>
          <button className={filter === 'coin' ? 'on' : ''} onClick={() => setFilter('coin')} disabled={!sel}>{sel ? `$${sel.ticker}` : 'coin'}</button>
        </div>
        <div className="feed">
          {feed.slice(0, 80).map((x) => (
            <Tweet key={x.id} p={x} />
          ))}
          {!feed.length && <div className="empty">nothing. the timeline is as empty as your wallet will be.</div>}
        </div>
      </div>

      <div className="side right">
        <Trending />
        <div className="card">
          <h3>Who to follow</h3><div style={{ color: '#71767b', fontSize: 13, marginTop: -6, marginBottom: 6 }}>(don't)</div>
          {BOTS.filter((b) => b.role === 'kol' || b.role === 'sleuth').map((b) => (
            <div key={b.id} className="row" style={{ padding: '6px 0' }}>
              <PersonAvatar author={b.id} size={30} />
              <div className="grow">
                <div className="b ellipsis">{b.name} {b.verified && <span className="verified" style={{ display: 'inline-grid', verticalAlign: -3 }}>✓</span>}</div>
                <div className="d">@{b.handle} · {fmtNum(b.followers)}</div>
              </div>
              <span className={`chip ${b.role === 'sleuth' ? 'a' : 'p'}`}>{b.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Trending() {
  const w = getWorld()
  const counts = new Map<string, number>()
  for (const p of w.feed.slice(0, 60)) if (p.coinId && w.coins[p.coinId]?.status !== 'dead') counts.set(p.coinId, (counts.get(p.coinId) ?? 0) + 1)
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  return (
    <div className="card">
      <h3>Trending in Trenches</h3>
      {list.map(([id, n], i) => {
        const c = w.coins[id]
        if (!c) return null
        return (
          <div key={id} className="trend row" onClick={() => openCoin(id)}>
            <CoinAvatar c={c} size={26} />
            <div className="grow">
              <div className="d" style={{ fontSize: 10.5 }}>{i + 1} · trending</div>
              <div className="cash">${c.ticker}</div>
              <div className="d" style={{ fontSize: 10.5 }}>{n} posts · {fmtUsd(mcUsd(c))} · <Chg c={c} /></div>
            </div>
          </div>
        )
      })}
      {!list.length && <div className="d">nobody is talking. ominous.</div>}
    </div>
  )
}

function Composer() {
  const w = useWorld()
  const nav = useNav()
  const [mode, setMode] = useState<PostMode>('call')
  const [coinId, setCoinId] = useState<string | undefined>(w.selected)
  const [text, setText] = useState('')
  const [tpl, setTpl] = useState<string | undefined>()

  useEffect(() => {
    if (!nav.compose) return
    setMode(nav.compose.mode)
    if (nav.compose.coinId) setCoinId(nav.compose.coinId)
    const first = TEMPLATES.find((t) => t.mode === nav.compose!.mode)
    const c = nav.compose.coinId ? w.coins[nav.compose.coinId] : undefined
    if (first && c) {
      setText(first.text.replace('{T}', `$${c.ticker}`))
      setTpl(first.key)
    }
  }, [nav.compose?.nonce])

  const live = w.order.map((id) => w.coins[id]).filter((c) => c && c.status !== 'dead')
  const coin = coinId ? w.coins[coinId] : undefined
  const tick = coin ? `$${coin.ticker}` : '$???'
  const needsCoin = mode !== 'shitpost'

  const submit = () => {
    if (!text.trim()) return
    act((w) => post(w, mode, text, coin?.id, tpl))
    setText('')
    setTpl(undefined)
  }

  return (
    <div className="compose">
      <div className="row">
        <PersonAvatar author="player" size={40} />
        <div className="grow col" style={{ gap: 8 }}>
          <div className="modes">
            {(['call', 'fud', 'shitpost'] as PostMode[]).map((m) => (
              <button key={m} className={`${m}${mode === m ? ' on' : ''}`} onClick={() => { setMode(m); setTpl(undefined) }}>
                {m.toUpperCase()}
              </button>
            ))}
            <span className="grow" />
            {needsCoin && (
              <select className="input" style={{ height: 26, fontSize: 11, maxWidth: 200 }} value={coinId ?? ''} onChange={(e) => setCoinId(e.target.value || undefined)}>
                <option value="">tag a coin…</option>
                {live.map((c) => (
                  <option key={c.id} value={c.id}>
                    ${c.ticker} · {fmtUsd(mcUsd(c))}{c.byPlayer ? ' · yours' : ''}{c.flagged ? ' · flagged' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
      <textarea
        className="input"
        placeholder={mode === 'call' ? 'what are we pumping?' : mode === 'fud' ? 'who are we exposing?' : "what's happening (badly)?"}
        value={text}
        maxLength={280}
        onChange={(e) => { setText(e.target.value); setTpl(undefined) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
      />
      <div className="tpls">
        {TEMPLATES.filter((t) => t.mode === mode).map((t) => (
          <button key={t.key} onClick={() => { setText(t.text.replace('{T}', tick)); setTpl(t.key) }}>
            {t.text.replace('{T}', tick).slice(0, 34)}{t.text.length > 34 ? '…' : ''}
          </button>
        ))}
      </div>
      <div className="row">
        <span className="d" style={{ fontSize: 11 }}>
          {mode === 'call' && coin && `→ follower wave into $${coin.ticker}${coin.flagged ? ' (flagged: weak)' : ''}`}
          {mode === 'fud' && coin && `→ if it's really bundled: flag + trust. if not: ratio.`}
          {mode === 'shitpost' && '→ farm followers. no market impact. pure content.'}
          {needsCoin && !coin && <span className="a">tag a coin first</span>}
        </span>
        <span className="grow" />
        <span className="d num">{280 - text.length}</span>
        <button className="postbtn" disabled={!text.trim() || (needsCoin && !coin)} onClick={submit}>
          Post
        </button>
      </div>
    </div>
  )
}

const IC = {
  reply: 'M1.75 10c0-4.42 3.58-8 8-8h4.37c4.48 0 8.13 3.64 8.13 8.13 0 2.96-1.6 5.68-4.19 7.11l-8.06 4.46v-3.69h-.07c-4.49.1-8.18-3.51-8.18-8.01zm8-6c-3.32 0-6 2.69-6 6 0 3.37 2.77 6.08 6.13 6.01l.35-.01h1.77v2.3l5.09-2.81c1.95-1.08 3.16-3.13 3.16-5.36 0-3.39-2.74-6.13-6.13-6.13H9.75z',
  rt: 'M4.5 3.88l4.43 4.14-1.36 1.46L5.5 7.55V16c0 1.1.9 2 2 2H13v2H7.5c-2.21 0-4-1.79-4-4V7.55L1.43 9.48.07 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.21 0 4 1.79 4 4v8.45l2.07-1.93 1.36 1.46-4.43 4.14-4.43-4.14 1.36-1.46 2.07 1.93V8c0-1.1-.9-2-2-2z',
  like: 'M16.7 3.6c-1.83-.06-3.54.84-4.7 2.35-1.16-1.51-2.87-2.41-4.7-2.35C4.12 3.7 1.75 6.3 1.75 9.5c0 3.88 3.06 7.06 9.25 11.85l1 .78 1-.78c6.19-4.79 9.25-7.97 9.25-11.85 0-3.2-2.37-5.8-5.55-5.9z',
  views: 'M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z',
}
const Ico = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d={d} />
  </svg>
)

function Tweet({ p }: { p: Post }) {
  const info = authorInfo(p)
  const typing = p.rt > Date.now()
  const hot = p.likes > 500
  return (
    <div className={`tw${p.author === 'player' ? ' me' : ''}${p.kind === 'callout' ? ' callout' : ''}`}>
      <PersonAvatar author={p.author} />
      <div style={{ minWidth: 0 }}>
        <div className="who">
          <b className="ellipsis">{info.name}</b>
          {info.verified && <span className="verified">✓</span>}
          <span className="h ellipsis">@{info.handle} · {ago(p.t)}</span>
          {p.kind === 'callout' && <span className="chip a" style={{ marginLeft: 'auto' }}>CALLOUT</span>}
          {p.kind === 'call' && p.author !== 'player' && <span className="chip p" style={{ marginLeft: 'auto' }}>CALL</span>}
        </div>
        {p.replyTo && <div className="rep">Replying to <a>@{p.replyTo}</a></div>}
        {typing ? (
          <div className="typing" style={{ margin: '6px 0 8px' }}>
            drafting <i /><i /><i />
          </div>
        ) : (
          <div className="txt"><RichText text={p.text} /></div>
        )}
        <div className="acts">
          <span><Ico d={IC.reply} />{p.replies || ''}</span>
          <span><Ico d={IC.rt} />{p.rts ? fmtNum(p.rts) : ''}</span>
          <span className={`lk${hot ? ' hot' : ''}`}><Ico d={IC.like} />{p.likes ? fmtNum(p.likes) : ''}</span>
          <span><Ico d={IC.views} />{fmtNum(p.likes * 23 + 40)}</span>
        </div>
      </div>
    </div>
  )
}
