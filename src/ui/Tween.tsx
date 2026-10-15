import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { P } from './palette'

/** number that tweens to its new value and pulses green/red on change */
export default function Tween({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const el = useRef<HTMLSpanElement>(null)
  const state = useRef({ v: value })
  const fmt = useRef(format)
  fmt.current = format

  useEffect(() => {
    const node = el.current
    if (!node) return
    const from = state.current.v
    if (Math.abs(value - from) < 1e-9) {
      node.textContent = fmt.current(value)
      return
    }
    const up = value > from
    const big = Math.abs(value - from) > Math.max(Math.abs(from) * 0.02, 0.05)
    gsap.to(state.current, {
      v: value,
      duration: big ? 0.6 : 0.25,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => {
        node.textContent = fmt.current(state.current.v)
      },
    })
    if (big) {
      gsap.fromTo(
        node,
        { color: up ? P.up : P.down },
        { color: P.text, duration: 0.9, ease: 'power1.out', clearProps: 'color' },
      )
    }
  }, [value])

  return <span ref={el} className={className}>{format(value)}</span>
}
