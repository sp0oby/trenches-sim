import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { BOOT_LINES, LOADING_TIPS } from '../game/data/lines'
import { continueGame, peekSave, startNew, wipe } from '../game/store'
import { sfx } from '../game/audio'
import { pick } from '../game/util'

export default function Boot({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0)
  const [handle, setHandle] = useState('')
  const [tip] = useState(() => pick(LOADING_TIPS))
  const [save] = useState(() => peekSave())
  const [mode, setMode] = useState<'choose' | 'new'>(save ? 'choose' : 'new')
  const input = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const done = n >= BOOT_LINES.length

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.wordmark', { y: 18, opacity: 0, filter: 'blur(8px)', duration: 0.9, ease: 'expo.out' })
      gsap.from('.tag', { y: 8, opacity: 0, duration: 0.7, delay: 0.15, ease: 'power3.out' })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 500 : 110 + Math.random() * 160)
    return () => clearTimeout(t)
  }, [n, done])

  useEffect(() => {
    if (done && mode === 'new') input.current?.focus()
  }, [done, mode])

  useEffect(() => {
    if (!done || mode !== 'choose') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        continueGame()
        sfx.launch()
        onDone()
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setMode('new')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, mode, onDone])

  const start = () => {
    wipe()
    startNew(handle || 'anon')
    sfx.launch()
    onDone()
  }

  return (
    <div className="boot" ref={root} onClick={() => input.current?.focus()}>
      <div className="box">
        <h1 className="wordmark">trenches<span>.sim</span></h1>
        <div className="tag">A memecoin trenches simulator. Launch, bundle, shill, drill. None of this is financial advice — all of it is financial damage.</div>
        <div className="lines">
          {BOOT_LINES.slice(0, n).map(([s, t], i) => (
            <div key={i} style={{ animation: 'logIn .35s var(--ease)' }}>
              <span className={s === 'ok' ? 'ok' : 'warn'}>{s === 'ok' ? '✓' : '!'}</span>&nbsp;&nbsp;<span className={s === 'ok' ? '' : 'warn'}>{t}</span>
            </div>
          ))}
        </div>

        {done && mode === 'choose' && save && (
          <div style={{ marginTop: 22, animation: 'cardIn .4s var(--ease)' }}>
            <div className="d" style={{ marginBottom: 12 }}>
              Welcome back <span style={{ color: 'var(--text)' }}>@{save.handle}</span> · <span className="num">{save.sol.toFixed(2)} SOL</span> · <span className="num">{Math.round(save.xp).toLocaleString()} XP</span>
            </div>
            <div className="row">
              <button className="btn solid" style={{ height: 40, padding: '0 18px' }} onClick={() => { continueGame(); onDone() }}>
                Continue <kbd style={{ marginLeft: 6 }}>↵</kbd>
              </button>
              <button className="btn" style={{ height: 40 }} onClick={() => setMode('new')}>
                New life <kbd style={{ marginLeft: 6 }}>N</kbd>
              </button>
            </div>
          </div>
        )}
        {done && mode === 'new' && (
          <form className="prompt" style={{ animation: 'cardIn .4s var(--ease)' }} onSubmit={(e) => { e.preventDefault(); start() }}>
            <span className="d">@</span>
            <input
              ref={input}
              value={handle}
              maxLength={15}
              spellCheck={false}
              placeholder="pick a handle"
              onChange={(e) => { setHandle(e.target.value.replace(/[^a-z0-9_]/gi, '')); sfx.key() }}
            />
            <button className="btn solid sm" type="submit">Enter the trenches →</button>
          </form>
        )}
        <div className="tip">
          <span style={{ color: 'var(--text-2)' }}>Tip</span> · {tip}
        </div>
      </div>
    </div>
  )
}
