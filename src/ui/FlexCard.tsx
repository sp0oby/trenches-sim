import { useEffect, useRef } from 'react'
import { act, getWorld, useWorld } from '../game/store'
import { unlock } from '../game/engine'
import type { Flex } from '../game/types'
import { fmtAge, pick } from '../game/util'
import { MONO, P, SANS, alpha } from './palette'
import { setNav, useNav } from './nav'

const W = 1200
const H = 630

function caption(f: Flex) {
  const x = f.out / f.invested
  if (x >= 5) return pick(['generational (for a day)', 'the cabal sends its regards', 'retail paid for this'])
  if (x >= 1.5) return f.rekt > 0 ? `extracted from ${f.rekt} believers` : pick(['getting paid', 'in and out. clean.', 'sold into the fomo'])
  if (x >= 1) return pick(['scalped it', 'technically profit', 'fees ate the alpha'])
  if (x >= 0.4) return pick(['donated to the cabal', 'learning experience (expensive)', 'exit liquidity, respectfully'])
  return pick(['held to zero like a legend', 'the chart lied', 'i was the exit liquidity'])
}

function draw(ctx: CanvasRenderingContext2D, f: Flex, handle: string, img?: HTMLImageElement) {
  const up = f.pnl >= 0
  const col = up ? P.up : P.down
  const pct = (f.out / f.invested - 1) * 100

  ctx.fillStyle = '#0a0a0c'
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.75)
  g.addColorStop(0, alpha(col, 0.28))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // grid texture
  ctx.fillStyle = 'rgba(255,255,255,0.035)'
  for (let x = 0; x < W; x += 28) for (let y = 0; y < H; y += 28) ctx.fillRect(x, y, 1.5, 1.5)
  // frame
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, W - 2, H - 2)

  // coin badge
  const bx = 72
  const by = 72
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(bx, by, 84, 84, 18)
  ctx.clip()
  ctx.fillStyle = `hsl(${f.hue} 40% 14%)`
  ctx.fillRect(bx, by, 84, 84)
  if (img) ctx.drawImage(img, bx, by, 84, 84)
  else {
    ctx.font = `48px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(f.emoji, bx + 42, by + 46)
  }
  ctx.restore()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = P.text
  ctx.font = `600 40px ${SANS}`
  ctx.fillText(`$${f.ticker}`, bx + 108, by + 46)
  ctx.fillStyle = P.dim
  ctx.font = `400 22px ${SANS}`
  ctx.fillText(f.drill ? 'drilled · full exit' : 'full exit', bx + 108, by + 78)

  // big pnl
  ctx.fillStyle = col
  ctx.font = `600 150px ${MONO}`
  ctx.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(pct > 999 ? 0 : 1)}%`, 66, 340)
  ctx.font = `500 40px ${MONO}`
  ctx.fillText(`${up ? '+' : ''}${f.pnl.toFixed(2)} SOL`, 72, 400)

  // stats row
  const stats: [string, string][] = [
    ['Invested', `${f.invested.toFixed(2)} SOL`],
    ['Realized', `${f.out.toFixed(2)} SOL`],
    ['Held', fmtAge(f.held)],
    ['Extraction', `${f.xp >= 0 ? '+' : ''}${Math.round(f.xp).toLocaleString()} XP`],
  ]
  stats.forEach(([k, v], i) => {
    const x = 72 + i * 270
    ctx.fillStyle = P.dim
    ctx.font = `500 20px ${SANS}`
    ctx.fillText(k, x, 480)
    ctx.fillStyle = P.text
    ctx.font = `500 30px ${MONO}`
    ctx.fillText(v, x, 518)
  })

  // footer
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(72, 556, W - 144, 1)
  ctx.fillStyle = P.text2
  ctx.font = `500 22px ${SANS}`
  ctx.fillText(`@${handle}`, 72, 594)
  ctx.fillStyle = P.dim
  ctx.font = `italic 400 22px ${SANS}`
  const cap = `“${caption(f)}”`
  ctx.fillText(cap, 72 + ctx.measureText(`@${handle}`).width + 24, 594)
  ctx.textAlign = 'right'
  ctx.fillStyle = P.text
  ctx.font = `700 26px ${SANS}`
  ctx.fillText('trenches', W - 72 - ctx.measureText('.sim').width, 594)
  ctx.fillStyle = P.dim
  ctx.font = `400 26px ${SANS}`
  ctx.fillText('.sim', W - 72, 594)
}

export default function FlexModal() {
  const nav = useNav()
  const w = useWorld()
  const ref = useRef<HTMLCanvasElement>(null)
  const coin = nav.flex ? w.coins[nav.flex] : undefined
  const f = coin?.pc.flex
  const key = f ? `${coin!.id}:${f.out}` : ''

  useEffect(() => {
    if (!f || !ref.current) return
    const cv = ref.current
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')!
    const handle = getWorld().player.handle
    if (f.image) {
      const img = new Image()
      img.onload = () => draw(ctx, f, handle, img)
      img.src = f.image
    } else draw(ctx, f, handle)
    // eslint-disable-next-line
  }, [key])

  useEffect(() => {
    if (!nav.flex) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNav({ flex: undefined })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nav.flex])

  if (!f) return null

  const download = () => {
    const a = document.createElement('a')
    a.download = `trenches-${f.ticker.toLowerCase()}-pnl.png`
    a.href = ref.current!.toDataURL('image/png')
    a.click()
    act((w) => unlock(w, 'flex'))
  }

  return (
    <div className="modal-bg" onClick={() => setNav({ flex: undefined })}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 760 }}>
        <div className="row" style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 15 }}>PnL card</b>
          <span className="d">· ${f.ticker}</span>
          <span className="grow" />
          <button className="nav-btn" onClick={() => setNav({ flex: undefined })}>✕</button>
        </div>
        <canvas ref={ref} style={{ width: '100%', aspectRatio: `${W}/${H}`, borderRadius: 12, display: 'block', boxShadow: 'inset 0 0 0 1px var(--line-2)' }} />
        <div className="row" style={{ marginTop: 14 }}>
          <span className="d" style={{ fontSize: 12 }}>Post it. Nobody will check the other 40 trades.</span>
          <span className="grow" />
          <button className="btn" onClick={() => setNav({ flex: undefined })}>Close</button>
          <button className="btn solid" onClick={download}>Save PNG</button>
        </div>
      </div>
    </div>
  )
}
