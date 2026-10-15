import type { World } from './types'

export interface Contact {
  id: string
  name: string
  sub: string
  avatar: string
  hue: number
  channel?: boolean
  /** only listed once a conversation exists */
  lazy?: boolean
}

export const CONTACTS: Contact[] = [
  { id: 'cabal', name: 'the cabal 🕴️', sub: '6 members · invite only', avatar: '🕴️', hue: 0, channel: true, lazy: true },
  { id: 'kev', name: 'kev 🐀', sub: 'knows a guy', avatar: '🐀', hue: 30 },
  { id: 'trenchbot', name: 'TrenchBot', sub: 'bot · fastest sniper on sol (allegedly)', avatar: '🤖', hue: 150 },
  { id: 'vip', name: 'VIP ALPHA 💎 (no jeets)', sub: '412 members', avatar: '💎', hue: 270, channel: true },
  { id: 'agency', name: 'kol agency 💼', sub: 'paid promos · "organic" reach', avatar: '💼', hue: 210 },
  { id: 'anondev', name: 'anon dev 🥷', sub: 'pays for shills', avatar: '🥷', hue: 260, lazy: true },
  { id: 'sherlock', name: 'onchain_sherlock', sub: 'sleuth · dms open (for a price)', avatar: '🕵️', hue: 45 },
  { id: 'mom', name: 'mom', sub: 'last seen checking your phantom', avatar: '👩', hue: 330 },
  { id: 'ex', name: 'ex 💔', sub: 'you should not reply', avatar: '💔', hue: 340, lazy: true },
  { id: 'spam', name: 'Unknown senders', sub: 'not in your contacts', avatar: '❓', hue: 40, lazy: true },
  { id: 'fans', name: 'message requests', sub: 'people who followed your calls', avatar: '📨', hue: 200 },
]

/** push a message into a chat. `delayMs` fakes typing latency */
export function chatSend(w: World, chatId: string, from: 'me' | 'them', text: string, delayMs = 0, who?: string) {
  let c = w.chats[chatId]
  if (!c) c = w.chats[chatId] = { id: chatId, msgs: [], unread: 0 }
  c.msgs.push({ id: ++w.seq, from, text, rt: Date.now() + delayMs, who })
  if (c.msgs.length > 80) c.msgs.shift()
  if (from === 'them') c.unread++
}

export function initialChats(w: World) {
  chatSend(w, 'kev', 'them', 'yo. heard you got back in the trenches lol')
  chatSend(w, 'kev', 'them', "hmu if you want alpha. i know a guy who knows the guys. small fee")
  chatSend(w, 'mom', 'them', 'Are you eating? Your father says the "solana" is a scam')
  chatSend(w, 'vip', 'them', '🔒 VIP ALPHA. 1 SOL lifetime access. calls BEFORE they hit the timeline. no jeets. no refunds.', 0, 'admin')
  chatSend(w, 'sherlock', 'them', 'i see everything above $12k. everything.')
  chatSend(w, 'trenchbot', 'them', '🤖 TrenchBot online. set an auto-snipe and every new launch gets bought in block 0. 1% fee (we also front-run you, but politely)')
  chatSend(w, 'agency', 'them', 'need reach? we represent the top voices in the trenches. pick a package. results not guaranteed. dumps are.')
  for (const c of Object.values(w.chats)) c.unread = c.id === 'kev' ? 2 : 0
}
