import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import gsap from 'gsap'
import { dismissToast, getToasts, subscribeFx, subscribeToasts, type FxEvent } from '../game/fx'
import { DRILL_LINES } from '../game/data/lines'
import { pick } from '../game/util'
import { P } from './palette'

let shakeOn = false
const shakeSubs = new Set<() => void>()

export function useShake() {
  return useSyncExternalStore(
    (f) => {
      shakeSubs.add(f)
      return () => {
        shakeSubs.delete(f)
      }
    },
    () => shakeOn,
  )
}

function setShake(v: boolean) {
  shakeOn = v
  shakeSubs.forEach((f) => f())
}

const FLASH: Record<string, string> = { red: P.down, green: P.up, purple: P.purple, amber: P.amber }
const TONE: Record<string, string> = { g: P.up, r: P.down, p: P.purple }

function DrillFx({ xp, head, ticker, lines }: { xp: number; head: string; ticker: string; lines: string[] }) {
  const root = useRef<HTMLDivElement>(null)
  const xpRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const counter = { v: 0 }
      gsap
        .timeline()
        .fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.15 })
        .fromTo('.big', { scale: 1.6, opacity: 0, filter: 'blur(18px)', letterSpacing: '0.1em' }, { scale: 1, opacity: 1, filter: 'blur(0px)', letterSpacing: '-0.05em', duration: 0.55, ease: 'expo.out' }, 0)
        .fromTo('.sub', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, 0.2)
        .fromTo('.xp', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' }, 0.3)
        .to(counter, {
          v: xp,
          duration: 1,
          ease: 'power3.out',
          onUpdate: () => {
            if (xpRef.current) xpRef.current.textContent = `${counter.v >= 0 ? '+' : ''}${Math.round(counter.v).toLocaleString()} XP`
          },
        }, 0.3)
        .fromTo('.notes span', { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.06 }, 0.5)
        .to(root.current, { opacity: 0, duration: 0.45, ease: 'power2.in' }, 2.1)
    }, root)
    return () => ctx.revert()
  }, [xp])
  return (
    <div ref={root} className="drillfx">
      <div>
        <div className="big">DRILLED</div>
        <div className="sub">{head} · ${ticker}</div>
        <div ref={xpRef} className="xp" style={xp < 0 ? { color: 'var(--red)' } : undefined}>+0 XP</div>
        <div className="notes">{lines.map((l, i) => <span key={i}>{l}</span>)}</div>
      </div>
    </div>
  )
}

function Floater({ text, tone, x, y }: { text: string; tone: string; x: number; y: number }) {
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const t = gsap.fromTo(el.current, { y: 0, opacity: 0, scale: 0.9 }, { y: -64, opacity: 1, scale: 1, duration: 1.3, ease: 'power3.out', keyframes: { opacity: [0, 1, 1, 0] } })
    return () => {
      t.kill()
    }
  }, [])
  return (
    <div ref={el} className="floater" style={{ left: x, top: y, color: TONE[tone] }}>
      {text}
    </div>
  )
}

interface FloaterData { id: number; text: string; tone: string; x: number; y: number }

export function Overlays() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts)
  const [drill, setDrill] = useState<(FxEvent & { type: 'drill'; key: number; head: string }) | null>(null)
  const [flash, setFlash] = useState<{ color: string; key: number } | null>(null)
  const [floaters, setFloaters] = useState<FloaterData[]>([])
  const [death, setDeath] = useState<{ ticker: string; epitaph: string; key: number } | null>(null)
  const deathRef = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      subscribeFx((e) => {
        const key = Date.now() + Math.random()
        if (e.type === 'drill') {
          setDrill({ ...e, key, head: pick(DRILL_LINES) })
          setTimeout(() => setDrill((d) => (d?.key === key ? null : d)), 2600)
        } else if (e.type === 'shake') {
          setShake(true)
          setTimeout(() => setShake(false), 440)
        } else if (e.type === 'flash') {
          setFlash({ color: FLASH[e.color], key })
        } else if (e.type === 'float') {
          const f = { id: key, text: e.text, tone: e.tone, x: window.innerWidth - 300 + Math.random() * 60, y: window.innerHeight * 0.42 + Math.random() * 40 }
          setFloaters((fs) => [...fs.slice(-6), f])
          setTimeout(() => setFloaters((fs) => fs.filter((x) => x.id !== key)), 1400)
        } else if (e.type === 'death') {
          setDeath({ ticker: e.ticker, epitaph: e.epitaph, key })
          setTimeout(() => setDeath((d) => (d?.key === key ? null : d)), 3200)
        }
      }),
    [],
  )

  useLayoutEffect(() => {
    if (!death || !deathRef.current) return
    gsap.fromTo(deathRef.current, { xPercent: -50, y: 16, opacity: 0 }, { xPercent: -50, y: 0, opacity: 1, duration: 0.5, ease: 'expo.out' })
    gsap.to(deathRef.current, { opacity: 0, y: 8, duration: 0.4, delay: 2.6, ease: 'power2.in' })
  }, [death])

  return (
    <>
      <div className="toasts">
        {[...toasts].reverse().map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
            <div className="tt">{t.title}</div>
            {t.body && <div className="tb">{t.body}</div>}
          </div>
        ))}
      </div>
      {flash && <div key={flash.key} className="flash" style={{ background: flash.color }} />}
      {floaters.map((f) => <Floater key={f.id} {...f} />)}
      {death && (
        <div key={death.key} ref={deathRef} className="deathfx">
          <div className="b" style={{ color: 'var(--red)' }}>${death.ticker} is dead</div>
          <div className="d" style={{ fontSize: 12 }}>{death.epitaph}</div>
        </div>
      )}
      {drill && <DrillFx key={drill.key} xp={drill.xp} head={drill.head} ticker={drill.ticker} lines={drill.lines} />}
    </>
  )
}
