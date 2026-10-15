// Single source for colors used in canvas/SVG/JS (CSS mirrors these as custom properties).
export const P = {
  bg: '#09090b',
  panel: '#0f0f11',
  line: 'rgba(255,255,255,0.06)',
  text: '#ececef',
  text2: '#a1a1aa',
  dim: '#71717a',
  mute: '#3f3f46',
  up: '#2ebd85',
  down: '#f6465d',
  amber: '#f0a020',
  blue: '#4c8dff',
  purple: '#8b7cf6',
  cyan: '#38bdf8',
}

export const SANS = "'Geist Variable', ui-sans-serif, system-ui, sans-serif"
export const MONO = "'Geist Mono Variable', ui-monospace, Menlo, Consolas, monospace"

export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
