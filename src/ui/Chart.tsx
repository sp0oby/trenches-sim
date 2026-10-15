import { useEffect, useRef } from 'react'
import { getWorld } from '../game/store'
import { CANDLE_SEC } from '../game/constants'
import { fmtUsd } from '../game/util'
import type { MarkType } from '../game/types'
import { MONO, P, SANS, alpha } from './palette'

const GRID = 'rgba(255,255,255,0.04)'

const MARK: Record<MarkType, { c: string; label: string; above: boolean }> = {
  B: { c: P.up, label: 'B', above: false },
  S: { c: P.down, label: 'S', above: true },
  D: { c: P.down, label: 'Drill', above: true },
  C: { c: P.purple, label: 'Call', above: true },
  K: { c: P.blue, label: 'KOL', above: true },
  F: { c: P.amber, label: 'Flag', above: true },
  L: { c: P.up, label: 'Launch', above: false },
}
const MONOF = (w: number, s: number) => `${w} ${s}px ${MONO}`
const SANSF = (w: number, s: number) => `${w} ${s}px ${SANS}`

export default function Chart({ coinId }: { coinId?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const mouse = useRef<{ x: number; y: number } | null>(null)
  const disp = useRef<{ id?: string; close: number; lo: number; hi: number }>({ close: 0, lo: 0, hi: 0 })

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let raf = 0
    let W = 0
    let H = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const r = cv.getBoundingClientRect()
      W = r.width
      H = r.height
      cv.width = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    resize()

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const w = getWorld()
      const c = coinId ? w.coins[coinId] : undefined
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      if (!c || !c.candles.length || W < 50) return

      const axisW = 70
      const volH = H * 0.14
      const top = 34
      const plotH = H - volH - top - 14
      const cw = 9
      const n = Math.max(10, Math.floor((W - axisW - 16) / cw))
      const cs = c.candles.slice(-n)
      const last = cs[cs.length - 1]

      let lo = Infinity
      let hi = -Infinity
      let vmax = 0
      for (const k of cs) {
        lo = Math.min(lo, k.l)
        hi = Math.max(hi, k.h)
        vmax = Math.max(vmax, k.v)
      }
      const L = (v: number) => Math.log(Math.max(v, 1))

      // smooth the live close and the y-range so the chart glides instead of jumping
      const d = disp.current
      if (d.id !== c.id) Object.assign(d, { id: c.id, close: last.c, lo: L(lo), hi: L(hi) })
      d.close += (last.c - d.close) * 0.2
      const liveClose = d.close
      let tlo = Math.min(L(lo), L(liveClose))
      let thi = Math.max(L(hi), L(liveClose))
      if (thi - tlo < 0.25) {
        const mid = (thi + tlo) / 2
        tlo = mid - 0.125
        thi = mid + 0.125
      }
      const pad = (thi - tlo) * 0.12
      d.lo += (tlo - pad - d.lo) * 0.15
      d.hi += (thi + pad - d.hi) * 0.15
      const llo = d.lo
      const lhi = d.hi
      const y = (v: number) => top + (1 - (L(v) - llo) / (lhi - llo)) * plotH
      const plotR = W - axisW

      // grid + axis labels
      ctx.textBaseline = 'middle'
      ctx.font = MONOF(400, 10.5)
      for (let i = 0; i <= 4; i++) {
        const yy = Math.round(top + (plotH * i) / 4) + 0.5
        ctx.strokeStyle = GRID
        ctx.beginPath()
        ctx.moveTo(0, yy)
        ctx.lineTo(plotR, yy)
        ctx.stroke()
        const v = Math.exp(lhi - ((lhi - llo) * i) / 4)
        ctx.fillStyle = P.dim
        ctx.fillText(fmtUsd(v), plotR + 10, yy)
      }

      // ATH line
      if (c.ath > 0 && L(c.ath) < lhi && L(c.ath) > llo) {
        const ya = Math.round(y(c.ath)) + 0.5
        ctx.strokeStyle = alpha(P.amber, 0.3)
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(0, ya)
        ctx.lineTo(plotR, ya)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = alpha(P.amber, 0.75)
        ctx.font = SANSF(500, 10.5)
        ctx.fillText(`ATH ${fmtUsd(c.ath)}`, 10, ya - 9)
      }

      const x0 = plotR - cs.length * cw - 8
      const xOf = (i: number) => x0 + i * cw + cw / 2

      // area glow under closes
      ctx.beginPath()
      cs.forEach((k, i) => {
        const yy = y(i === cs.length - 1 ? liveClose : k.c)
        if (i === 0) ctx.moveTo(xOf(i), yy)
        else ctx.lineTo(xOf(i), yy)
      })
      const up0 = liveClose >= cs[0].o
      ctx.lineTo(xOf(cs.length - 1), top + plotH)
      ctx.lineTo(xOf(0), top + plotH)
      ctx.closePath()
      const grad = ctx.createLinearGradient(0, top, 0, top + plotH)
      grad.addColorStop(0, alpha(up0 ? P.up : P.down, 0.08))
      grad.addColorStop(1, alpha(up0 ? P.up : P.down, 0))
      ctx.fillStyle = grad
      ctx.fill()

      // candles + volume
      cs.forEach((k, i) => {
        const isLast = i === cs.length - 1
        const close = isLast ? liveClose : k.c
        const up = close >= k.o
        const col = up ? P.up : P.down
        const x = Math.round(xOf(i))
        ctx.strokeStyle = col
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + 0.5, y(Math.max(k.h, close)))
        ctx.lineTo(x + 0.5, y(Math.min(k.l, close)))
        ctx.stroke()
        const yo = y(k.o)
        const yc = y(close)
        ctx.fillStyle = col
        ctx.fillRect(x - 3, Math.min(yo, yc), 7, Math.max(1, Math.abs(yc - yo)))
        if (vmax > 0) {
          const vh = (k.v / vmax) * (volH - 4)
          ctx.fillStyle = alpha(col, 0.22)
          ctx.fillRect(x - 3, H - 8 - vh, 7, vh)
        }
      })

      // event markers (pills)
      const firstT = cs[0].t
      const stack: Record<string, number> = {}
      ctx.font = SANSF(600, 10)
      ctx.textAlign = 'center'
      for (const m of c.marks) {
        const i = Math.floor((m.t - c.born) / CANDLE_SEC) - firstT
        if (i < 0 || i >= cs.length) continue
        const spec = MARK[m.type]
        const k = cs[i]
        const key = `${i}${spec.above}`
        const s = (stack[key] = (stack[key] ?? 0) + 1)
        const x = xOf(i)
        const yy = spec.above ? y(k.h) - 12 - (s - 1) * 18 : y(k.l) + 12 + (s - 1) * 18
        const tw = ctx.measureText(spec.label).width + 12
        ctx.fillStyle = alpha(spec.c, 0.16)
        ctx.beginPath()
        ctx.roundRect(x - tw / 2, yy - 7.5, tw, 15, 7.5)
        ctx.fill()
        ctx.fillStyle = spec.c
        ctx.fillText(spec.label, x, yy + 0.5)
      }
      ctx.textAlign = 'left'

      // live price line + tag
      const yl = Math.round(y(liveClose)) + 0.5
      const upNow = liveClose >= last.o
      const lc = upNow ? P.up : P.down
      ctx.strokeStyle = alpha(lc, 0.45)
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(xOf(cs.length - 1), yl)
      ctx.lineTo(plotR, yl)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = lc
      ctx.beginPath()
      ctx.roundRect(plotR + 4, yl - 9, axisW - 8, 18, 4)
      ctx.fill()
      ctx.fillStyle = '#050506'
      ctx.font = MONOF(600, 10.5)
      ctx.fillText(fmtUsd(liveClose), plotR + 10, yl + 0.5)
      // pulsing dot at the live candle
      const pulse = (Math.sin(performance.now() / 260) + 1) / 2
      ctx.fillStyle = alpha(lc, 0.25 * pulse)
      ctx.beginPath()
      ctx.arc(xOf(cs.length - 1), yl, 7, 0, Math.PI * 2)
      ctx.fill()

      // header / crosshair readout
      const mm = mouse.current
      ctx.font = SANSF(500, 11.5)
      if (mm && mm.x < plotR) {
        const i = Math.round((mm.x - x0 - cw / 2) / cw)
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(mm.x + 0.5, top)
        ctx.lineTo(mm.x + 0.5, H)
        ctx.moveTo(0, mm.y + 0.5)
        ctx.lineTo(plotR, mm.y + 0.5)
        ctx.stroke()
        ctx.setLineDash([])
        const k = cs[i]
        if (k) {
          const parts: [string, string][] = [['O', fmtUsd(k.o)], ['H', fmtUsd(k.h)], ['L', fmtUsd(k.l)], ['C', fmtUsd(k.c)]]
          let x = 14
          ctx.font = MONOF(500, 11)
          for (const [lbl, v] of parts) {
            ctx.fillStyle = P.dim
            ctx.fillText(lbl, x, 16)
            x += ctx.measureText(lbl).width + 5
            ctx.fillStyle = k.c >= k.o ? P.up : P.down
            ctx.fillText(v, x, 16)
            x += ctx.measureText(v).width + 14
          }
        }
      } else {
        ctx.fillStyle = P.text2
        ctx.fillText(`${c.ticker} / SOL`, 14, 16)
        const wd = ctx.measureText(`${c.ticker} / SOL`).width
        ctx.fillStyle = P.dim
        ctx.fillText('  ·  30s  ·  market cap', 14 + wd, 16)
      }

      // dead overlay
      if (c.status === 'dead') {
        ctx.fillStyle = 'rgba(9,9,11,0.6)'
        ctx.fillRect(0, 0, plotR, H)
        ctx.textAlign = 'center'
        ctx.font = SANSF(700, 30)
        ctx.fillStyle = P.down
        ctx.fillText('Dead', plotR / 2, H / 2 - 12)
        ctx.font = SANSF(400, 13)
        ctx.fillStyle = P.text2
        ctx.fillText(c.epitaph ?? '', plotR / 2, H / 2 + 16)
        ctx.textAlign = 'left'
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [coinId])

  return (
    <canvas
      ref={ref}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }
      }}
      onMouseLeave={() => (mouse.current = null)}
    />
  )
}
