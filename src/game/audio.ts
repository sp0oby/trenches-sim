// Tiny WebAudio synth. No assets.
let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean) {
  enabled = on
}

function ac() {
  if (!enabled) return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.03, slide = 0, delay = 0) {
  const a = ac()
  if (!a) return
  const t0 = a.currentTime + delay
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(a.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

function noise(dur: number, gain = 0.06, lp = 1200) {
  const a = ac()
  if (!a) return
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = lp
  const g = a.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(a.destination)
  src.start()
}

export const sfx = {
  key: () => tone(1800 + Math.random() * 400, 0.015, 'square', 0.008),
  buy: () => {
    tone(660, 0.06, 'square', 0.025)
    tone(990, 0.08, 'square', 0.02, 0, 0.05)
  },
  sell: () => {
    tone(520, 0.06, 'square', 0.025)
    tone(390, 0.09, 'square', 0.02, 0, 0.05)
  },
  drill: () => {
    noise(0.5, 0.09, 900)
    tone(220, 0.5, 'sawtooth', 0.05, -180)
  },
  post: () => tone(1200, 0.04, 'triangle', 0.03, 400),
  achv: () => {
    ;[523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.02, 0, i * 0.07))
  },
  bad: () => {
    tone(180, 0.25, 'sawtooth', 0.04, -60)
  },
  death: () => {
    ;[392, 330, 262].forEach((f, i) => tone(f, 0.18, 'triangle', 0.03, 0, i * 0.12))
  },
  launch: () => {
    tone(200, 0.4, 'sawtooth', 0.03, 800)
    noise(0.25, 0.04, 3000)
  },
  scan: () => {
    for (let i = 0; i < 6; i++) tone(1400 + i * 120, 0.03, 'square', 0.012, 0, i * 0.08)
  },
}
