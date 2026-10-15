import { useSyncExternalStore } from 'react'
import type { PostMode } from '../game/actions'

export type AppId = 'term' | 'y' | 'bundl' | 'bubble' | 'tg' | 'kol'

export const APPS: { id: AppId; label: string; short: string; icon: string; host: string }[] = [
  { id: 'term', label: 'Trench Terminal', short: 'Trade', icon: '↗', host: 'trench.term' },
  { id: 'y', label: 'Y', short: 'Y', icon: 'Y', host: 'y.com' },
  { id: 'bundl', label: 'bundl.fun', short: 'Launch', icon: 'B', host: 'bundl.fun' },
  { id: 'bubble', label: 'Bubblemapz', short: 'Bubbles', icon: '◎', host: 'bubblemapz.io' },
  { id: 'tg', label: 'Telegrum', short: 'Chats', icon: '✈', host: 'web.telegrum.org' },
  { id: 'kol', label: 'Kolscam', short: 'Profile', icon: 'K', host: 'kolscam.io' },
]

export interface Nav {
  app: AppId
  back: AppId[]
  fwd: AppId[]
  compose?: { mode: PostMode; coinId?: string; nonce: number }
  tgChat: string
  bubbleCoin?: string
  ySeen: number
  loading: number
  flex?: string
  /** phone layout: a chat thread is open (list hidden) */
  tgOpen?: boolean
}

let nav: Nav = { app: 'term', back: [], fwd: [], tgChat: 'kev', ySeen: 0, loading: 0 }
let ver = 0
const subs = new Set<() => void>()
const emit = () => {
  ver++
  subs.forEach((f) => f())
}

export function useNav() {
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
    () => ver,
  )
  return nav
}

export const getNav = () => nav

export function setNav(p: Partial<Nav>) {
  nav = { ...nav, ...p }
  emit()
}

export function go(app: AppId, extra: Partial<Nav> = {}) {
  if (app === nav.app) return setNav(extra)
  nav = { ...nav, ...extra, app, back: [...nav.back, nav.app].slice(-20), fwd: [], loading: Date.now() }
  emit()
}

export function goBack() {
  const prev = nav.back[nav.back.length - 1]
  if (!prev) return
  nav = { ...nav, app: prev, back: nav.back.slice(0, -1), fwd: [nav.app, ...nav.fwd], loading: Date.now() }
  emit()
}

export function goFwd() {
  const next = nav.fwd[0]
  if (!next) return
  nav = { ...nav, app: next, fwd: nav.fwd.slice(1), back: [...nav.back, nav.app], loading: Date.now() }
  emit()
}

export function compose(mode: PostMode, coinId?: string) {
  go('y', { compose: { mode, coinId, nonce: Date.now() } })
}
