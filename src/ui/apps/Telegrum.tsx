import { useEffect, useRef } from 'react'
import { act, useWorld } from '../../game/store'
import { chatAct, chatOptions } from '../../game/actions'
import { clickDrainer } from '../../game/systems'
import { CONTACTS } from '../../game/chat'
import { RichText } from '../shared'
import { compose, setNav, useNav } from '../nav'

const LINK = /([a-z0-9-]+\.(?:xyz|app|site|live|top|io)\/[^\s]*)/gi

/** message text with $TICKERs and (always malicious) links */
function MsgText({ text }: { text: string }) {
  const parts = text.split(LINK)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href="#" style={{ color: '#6ab3f3', textDecoration: 'underline', textUnderlineOffset: 2 }} onClick={(e) => { e.preventDefault(); act((w) => clickDrainer(w, p)) }}>
            {p}
          </a>
        ) : (
          <RichText key={i} text={p} />
        ),
      )}
    </>
  )
}

function Avatar({ hue, emoji, size }: { hue: number; emoji: string; size: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(160deg, hsl(${hue} 55% 55%), hsl(${hue + 25} 50% 38%))`, fontSize: size * 0.46 }}>
      {emoji}
    </div>
  )
}

export default function Telegrum() {
  const w = useWorld()
  const nav = useNav()
  const chatId = nav.tgChat
  const chat = w.chats[chatId]
  const contact = CONTACTS.find((c) => c.id === chatId) ?? CONTACTS[1]
  const now = Date.now()
  const visible = chat ? chat.msgs.filter((m) => m.rt <= now) : []
  const typing = chat ? chat.msgs.some((m) => m.rt > now) : false
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chat && chat.unread) chat.unread = 0
  })
  const lastChat = useRef('')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const switched = lastChat.current !== chatId
    lastChat.current = chatId
    // only follow new messages if the reader is already at the bottom
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140
    if (switched) el.scrollTop = el.scrollHeight
    else if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [visible.length, typing, chatId])

  const opts = chatOptions(w, chatId)
  const contacts = CONTACTS.filter((ct) => !ct.lazy || w.chats[ct.id]?.msgs.length)
    .map((ct) => ({ ct, last: w.chats[ct.id]?.msgs.filter((m) => m.rt <= now).slice(-1)[0] }))
    .sort((a, b) => (b.last?.id ?? 0) - (a.last?.id ?? 0))

  return (
    <div className="tg">
      <div className="list">
        <div className="search">Search</div>
        {contacts.map(({ ct, last }) => {
          const ch = w.chats[ct.id]
          return (
            <div key={ct.id} className={`chatrow${ct.id === chatId ? ' on' : ''}`} onClick={() => setNav({ tgChat: ct.id })}>
              <Avatar hue={ct.hue} emoji={ct.avatar} size={48} />
              <div style={{ minWidth: 0 }}>
                <div className="nm ellipsis">{ct.name}</div>
                <div className="prev ellipsis">{last ? `${last.from === 'me' ? 'You: ' : last.who ? `${last.who}: ` : ''}${last.text}` : ct.sub}</div>
              </div>
              {ch && ch.unread > 0 && ct.id !== chatId ? <span className={`ubadge${ct.id === 'spam' ? ' muted' : ''}`}>{ch.unread}</span> : <span />}
            </div>
          )
        })}
      </div>

      <div className="thread">
        <div className="thead">
          <Avatar hue={contact.hue} emoji={contact.avatar} size={40} />
          <div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{contact.name}</div>
            <div style={{ color: typing ? '#6ab3f3' : '#7f91a4', fontSize: 13 }}>{typing ? 'typing…' : contact.sub}</div>
          </div>
        </div>
        <div className="msgs" ref={ref}>
          {chatId === 'spam' && (
            <div className="bub sys">These senders aren't in your contacts. Be careful with links (you won't be).</div>
          )}
          {visible.map((m) =>
            m.text.startsWith('(') && m.text.endsWith(')') ? (
              <div key={m.id} className="bub sys">{m.text.slice(1, -1)}</div>
            ) : (
              <div key={m.id} className={`bub ${m.from}`}>
                {m.who && m.from === 'them' && <div className="who">{m.who}</div>}
                <MsgText text={m.text} />
              </div>
            ),
          )}
          {typing && (
            <div className="bub them typing" style={{ width: 64 }}>
              <i /><i /><i />
            </div>
          )}
          {!visible.length && !typing && <div style={{ margin: 'auto', color: '#7f91a4' }}>No messages here yet</div>}
        </div>
        <div className="opts">
          {opts.length ? (
            opts.map((o, i) => (
              <button
                key={o.key}
                className={i === opts.length - 1 && opts.length > 1 ? 'ghost' : ''}
                disabled={o.disabled}
                onClick={() => {
                  const r = act((w) => chatAct(w, chatId, o.key))
                  if (r && r.compose) compose('call', r.compose)
                }}
              >
                {o.label}
              </button>
            ))
          ) : (
            <span style={{ color: '#7f91a4', fontSize: 13 }}>
              {chatId === 'fans' ? "You can't reply to these. You wouldn't know what to say anyway." : chatId === 'cabal' && w.flags.cabal === 'kicked' ? 'You were removed from this group.' : 'Nothing to say right now.'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
