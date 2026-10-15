// Transient UI events: toasts, screen fx, floating numbers. Never persisted.

export type ToastKind = 'xp' | 'achv' | 'bad' | 'info' | 'good'
export interface Toast {
  id: number
  kind: ToastKind
  title: string
  body?: string
  born: number
}

export type FxEvent =
  | { type: 'drill'; xp: number; ticker: string; lines: string[] }
  | { type: 'shake' }
  | { type: 'flash'; color: 'red' | 'green' | 'purple' | 'amber' }
  | { type: 'float'; text: string; tone: 'g' | 'r' | 'p' }
  | { type: 'death'; ticker: string; epitaph: string }

let seq = 0
let toasts: Toast[] = []
const toastSubs = new Set<() => void>()
const fxSubs = new Set<(e: FxEvent) => void>()

export function toast(kind: ToastKind, title: string, body?: string) {
  toasts = [...toasts, { id: ++seq, kind, title, body, born: Date.now() }].slice(-3)
  toastSubs.forEach((f) => f())
  const id = seq
  setTimeout(() => dismissToast(id), kind === 'achv' ? 6000 : 4200)
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  toastSubs.forEach((f) => f())
}

export const getToasts = () => toasts
export function subscribeToasts(f: () => void) {
  toastSubs.add(f)
  return () => toastSubs.delete(f)
}

export function fx(e: FxEvent) {
  fxSubs.forEach((f) => f(e))
}
export function subscribeFx(f: (e: FxEvent) => void) {
  fxSubs.add(f)
  return () => {
    fxSubs.delete(f)
  }
}
