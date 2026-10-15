// Systems layered on top of the core market: world events, SOL price, and the
// telegram-driven side hustles (auto-sniper, cabal jobs, paid shills, KOL agency).
import type { Coin, World, WorldEvent } from './types'
import { addPost, log, rollLaunch, unlock } from './engine'
import { execBuy, mcUsd, solPx } from './market'
import { chatSend } from './chat'
import * as L from './data/lines'
import { BOT_BY_ID } from './data/bots'
import { chance, clamp, fill, pick, rand, randInt } from './util'
import { fx, toast } from './fx'
import { sfx } from './audio'

const tk = (c: Coin) => `$${c.ticker}`

// ---------- world events ----------

type EventSpec = Omit<WorldEvent, 'until'> & { dur: [number, number]; onStart?: (w: World) => void }

const EVENTS: EventSpec[] = [
  { id: 'supercycle', name: 'MEMECOIN SUPERCYCLE', desc: 'CT is euphoric. every coin is a gem. attention ×1.6', color: 'g', hype: 1.6, sell: -0.01, callMult: 1.3, solDrift: 0.0006, dur: [120, 200] },
  { id: 'sol_dump', name: 'SOL IS DUMPING', desc: 'macro is cooked. everyone is panic selling memes to buy the dip on SOL', color: 'r', hype: 0.7, sell: 0.03, callMult: 0.8, solDrift: -0.0012, dur: [90, 150] },
  { id: 'sol_pump', name: 'SOL NEW ATH', desc: 'everyone feels rich. wealth effect hitting the trenches', color: 'g', hype: 1.25, sell: 0, callMult: 1.15, solDrift: 0.001, dur: [90, 150] },
  { id: 'sherlock', name: 'SHERLOCK ON VACATION', desc: 'the sleuths are touching grass. bundle freely', color: 'p', hype: 1, sell: 0, callMult: 1, noSleuth: true, solDrift: 0, dur: [120, 220] },
  { id: 'outage', name: 'RPC OUTAGE', desc: 'blockhash not found. 30% of your transactions will fail', color: 'a', hype: 0.6, sell: 0, callMult: 0.9, outage: true, solDrift: -0.0003, dur: [60, 110] },
  {
    id: 'rugwave', name: 'RUG SEASON', desc: 'insiders everywhere decided today is the day', color: 'r', hype: 0.9, sell: 0.02, callMult: 0.85, solDrift: 0, dur: [80, 140],
    onStart: (w) => {
      for (const c of Object.values(w.coins)) if (c.status !== 'dead' && !c.byPlayer && c.bundlePct > 12 && chance(0.6)) c.script.dumping = true
    },
  },
  {
    id: 'celeb', name: 'CELEBRITY LAUNCHED A COIN', desc: 'a reality tv star just deployed. all attention is being sucked into it', color: 'a', hype: 0.6, sell: 0.01, callMult: 0.7, solDrift: 0, dur: [100, 160],
    onStart: (w) => {
      const { ident } = rollLaunch(w)
      w.scheduled.push({ at: w.t + 3, ident: { ...ident, name: `Official ${ident.name}`, desc: 'officially official. verified by a guy.' }, kind: 'bundle_rug', celeb: true })
    },
  },
  {
    id: 'cto', name: 'CTO SZN', desc: 'communities are reviving dead coins. necromancy is bullish', color: 'p', hype: 1.1, sell: 0, callMult: 1.1, solDrift: 0, dur: [100, 160],
    onStart: (w) => {
      const dead = Object.values(w.coins).filter((c) => c.status === 'dead' && w.t - (c.diedAt ?? 0) < 900)
      for (const c of dead.slice(0, 2)) {
        c.status = 'live'
        c.hype = rand(2.5, 4)
        c.lowTicks = 0
        c.script.maxLife += 900
        c.epitaph = undefined
        addPost(w, 'news', `${tk(c)} has been CTO'd. the community is back (it's 4 guys)`, { coinId: c.id, kind: 'news' })
        log(w, 'retail-herd', `${tk(c)} revived by community takeover`, 'g')
      }
    },
  },
  { id: 'kol_leak', name: 'KOL PAYROLL LEAKED', desc: 'a spreadsheet of paid promos leaked. people trust small accounts again. your calls hit harder', color: 'b', hype: 0.9, sell: 0.01, callMult: 1.4, solDrift: 0, dur: [100, 160] },
]

export function eventMods(w: World) {
  const e = w.event
  return e ? e : { hype: 1, sell: 0, callMult: 1, noSleuth: false, outage: false, solDrift: 0 }
}

function events(w: World, silent: boolean) {
  if (w.event && w.t >= w.event.until) {
    log(w, 'system', `event ended: ${w.event.name.toLowerCase()}`, 'd')
    w.event = undefined
  }
  if (w.event || w.t < w.nextEvent) return
  w.nextEvent = w.t + rand(200, 380)
  const spec = pick(EVENTS)
  const { dur, onStart, ...rest } = spec
  w.event = { ...rest, until: w.t + rand(dur[0], dur[1]) }
  onStart?.(w)
  addPost(w, 'news', `BREAKING: ${spec.name.toLowerCase()}. ${spec.desc}`, { kind: 'news', targetLikes: rand(800, 3000) })
  log(w, 'system', `EVENT · ${spec.name}`, spec.color === 'r' ? 'r' : spec.color === 'g' ? 'g' : 'a')
  if (!silent) {
    toast(spec.color === 'r' ? 'bad' : 'info', spec.name, spec.desc)
    fx({ type: 'flash', color: spec.color === 'r' ? 'red' : spec.color === 'g' ? 'green' : spec.color === 'p' ? 'purple' : 'amber' })
  }
}

function solPrice(w: World) {
  const drift = eventMods(w).solDrift
  const z = (Math.random() - 0.5) * 2
  w.solUsd = clamp(w.solUsd * Math.exp(drift + z * 0.0016 + (180 - w.solUsd) * 0.00002), 60, 600)
  solPx.usd = w.solUsd
}

// ---------- telegram systems ----------

/** called right after an AI coin's block 0 */
export function onSpawn(w: World, c: Coin, opts: { cabal?: boolean; celeb?: boolean }, silent: boolean) {
  const f = w.flags
  if (opts.cabal && f.cabalJob && f.cabalJob.stage === 'pending') {
    f.cabalJob.coinId = c.id
    f.cabalJob.stage = 'live'
    const alloc = Math.min(1.5, w.player.sol - 0.05)
    if (alloc > 0.05) {
      execBuy(w, c, 'you:cabal', 'player', alloc, { cluster: 'bundle', label: 'CABAL ALLOC' })
      chatSend(w, 'cabal', 'them', `${tk(c)} is live. you're in block 0 with ${alloc.toFixed(2)} SOL. DO NOT SELL before the signal.`, 400, 'cabal_intern')
    }
  }
  if (opts.celeb) {
    c.hype = 9
    c.script.targetX = rand(4, 8)
    c.script.dumpAge = rand(160, 260)
    log(w, 'retail-herd', `${tk(c)} — celebrity coin. retail is sprinting in`, 'a')
  }
  if (!silent && f.autoSnipe > 0 && !opts.cabal) {
    if (w.player.sol > f.autoSnipe + 0.02) {
      execBuy(w, c, 'you:main', 'player', f.autoSnipe, { label: 'YOU' })
      c.pc.firstBuyAt = w.t
      chatSend(w, 'trenchbot', 'them', `✅ sniped ${tk(c)} · ${f.autoSnipe} SOL @ $${(mcUsd(c) / 1000).toFixed(1)}K mc · block 0`, 0)
      log(w, 'trenchbot', `auto-sniped ${tk(c)} for @${w.player.handle}`, 'g')
      unlock(w, 'sniper')
    } else {
      f.autoSnipe = 0
      chatSend(w, 'trenchbot', 'them', '⚠️ insufficient balance. auto-snipe disabled. touch grass.', 0)
    }
  }
}

function cabal(w: World, silent: boolean) {
  const f = w.flags
  const p = w.player
  // invite
  if (f.cabal === 'none' && !silent && !w.chats.cabal && (p.followers >= 2500 || p.stats.launched >= 2)) {
    chatSend(w, 'cabal', 'them', `@${p.handle} we've been watching. you move liquidity. you're in.`, 800, 'cabal_intern')
    chatSend(w, 'cabal', 'them', 'rules: we launch, you get block 0, you call it when we say. jeet before the signal and you are done.', 3000, 'cabal_intern')
    f.cabal = 'member'
    toast('info', 'you got invited to the cabal', 'check telegrum. this is how it actually works.')
    sfx.post()
  }
  const job = f.cabalJob
  if (!job || !job.coinId) return
  const c = w.coins[job.coinId]
  if (!c) return
  const age = w.t - c.born
  if (job.stage === 'live' && age >= job.signalAge) {
    job.stage = 'signaled'
    job.signaledAt = w.t
    chatSend(w, 'cabal', 'them', `📣 SIGNAL: call ${tk(c)} NOW. our kol posts right after you. 60s window.`, 0, 'cabal_intern')
    if (!silent) {
      toast('info', `cabal signal: call $${c.ticker} now`, 'post a call on y.com within 60s to get your cut.')
      sfx.post()
    }
  }
  if (job.stage === 'signaled' && job.signaledAt != null && w.t - job.signaledAt > 60) {
    job.stage = 'done'
    chatSend(w, 'cabal', 'them', 'you missed the signal. we called it without you. no cut. disappointing.', 0, 'cabal_intern')
  }
  if (c.script.dumpAnnounced && job.stage !== 'done') {
    job.stage = 'done'
    chatSend(w, 'cabal', 'them', `we're out of ${tk(c)}. ty for the liquidity 🫡 (if you're still holding that's a you problem)`, 600, 'cabal_intern')
  }
}

/** player posted a call — check if it fulfils a cabal signal */
export function onPlayerCall(w: World, c: Coin) {
  const job = w.flags.cabalJob
  if (!job || job.coinId !== c.id || job.stage !== 'signaled') return
  job.stage = 'called'
  const cut = rand(0.8, 1.6)
  w.player.sol += cut
  chatSend(w, 'cabal', 'them', `good work. ${cut.toFixed(2)} SOL sent. you're a natural.`, 1200, 'cabal_intern')
  c.script.kolCallAge = w.t - c.born + rand(4, 10)
  unlock(w, 'cabal')
  toast('xp', `cabal paid you ${cut.toFixed(2)} SOL`, 'their kol is posting next. sell into it.')
}

/** player sold — check for cabal betrayal */
export function onPlayerSell(w: World, c: Coin) {
  const f = w.flags
  const job = f.cabalJob
  if (!job || job.coinId !== c.id || (job.stage !== 'live' && job.stage !== 'signaled')) return
  f.cabal = 'kicked'
  job.stage = 'done'
  chatSend(w, 'cabal', 'them', 'you sold before the signal. you jeeted on the cabal. removed.', 500, 'cabal_intern')
  addPost(w, 'dep3', `PSA: @${w.player.handle} is a jeet. dumped on his own group. do not trust.`, { kind: 'callout', targetLikes: rand(300, 900) })
  w.player.trust = clamp(w.player.trust - 10, 0, 100)
  toast('bad', 'KICKED FROM THE CABAL', 'you jeeted early. -10 trust. they are posting about you.')
  unlock(w, 'kicked')
}

export function requestCabalPlay(w: World) {
  const f = w.flags
  if (f.cabal !== 'member') return
  if (f.cabalJob && f.cabalJob.stage !== 'done') {
    chatSend(w, 'cabal', 'them', 'one play at a time. focus.', 900, 'cabal_intern')
    return
  }
  if (w.t < f.cabalNext) {
    chatSend(w, 'cabal', 'them', pick(['nothing yet. we are cooking', 'next play soon. dont ask again', 'the dev is generating wallets. patience']), 900, 'cabal_intern')
    return
  }
  f.cabalNext = w.t + rand(240, 400)
  const { ident } = rollLaunch(w)
  f.cabalJob = { ticker: ident.ticker, stage: 'pending', signalAge: rand(45, 75) }
  w.scheduled.push({ at: w.t + rand(15, 30), ident, kind: 'bundle_rug', cabal: true })
  chatSend(w, 'cabal', 'them', `next play: $${ident.ticker} "${ident.name}". launching in ~20s. you get block 0 allocation (1.5 SOL).`, 1000, 'cabal_intern')
  chatSend(w, 'cabal', 'them', 'wait for the signal, then call it. we dump after our kol. dont be last.', 2600, 'cabal_intern')
}

/** cabal coins get their script tuned so the signal comes before the rug */
export function tuneCabalScript(c: Coin, signalAge: number) {
  const s = c.script
  s.kolId = pick(['kol1', 'kol2', 'kol3'])
  s.kolCallAge = signalAge + 40
  s.targetX = 99
  s.dumpAge = signalAge + rand(80, 130)
  s.dumpRate = rand(0.35, 0.6)
}

// ---------- paid shill offers ----------

function paidOffers(w: World, silent: boolean) {
  const f = w.flags
  if (silent) return
  if (f.paidOffer && w.t > f.paidOffer.expires) {
    chatSend(w, 'anondev', 'them', pick(['offer expired. found a bigger account', 'nvm. someone else took it']), 0)
    f.paidOffer = undefined
  }
  if (f.paidOffer || w.t < f.nextPaidOffer || w.player.followers < 1500) return
  f.nextPaidOffer = w.t + rand(220, 420)
  const cands = Object.values(w.coins).filter((c) => c.status === 'live' && !c.byPlayer && (c.script.kind === 'bundle_rug' || c.script.kind === 'dev_dump') && !c.script.dumping && !c.flagged)
  if (!cands.length) return
  const c = pick(cands)
  const sol = +(rand(0.8, 2.5) * (0.6 + Math.sqrt(w.player.followers) / 80)).toFixed(2)
  f.paidOffer = { coinId: c.id, sol, expires: w.t + 90 }
  chatSend(w, 'anondev', 'them', fill(pick(L.PAID_OFFER), { T: tk(c), S: sol }), 600)
  toast('info', 'new DM: paid promo offer', `someone wants to pay you ${sol} SOL to shill ${tk(c)}`)
}

export function acceptPaid(w: World, counter: boolean) {
  const f = w.flags
  const o = f.paidOffer
  if (!o) return
  const c = w.coins[o.coinId]
  if (!c || c.status === 'dead') {
    f.paidOffer = undefined
    return
  }
  if (counter && !o.countered) {
    o.countered = true
    if (chance(0.5)) {
      o.sol = +(o.sol * 1.6).toFixed(2)
      chatSend(w, 'anondev', 'them', `fine. ${o.sol} SOL. final offer.`, 1200)
    } else {
      chatSend(w, 'anondev', 'them', 'lol greedy. offer withdrawn', 1200)
      f.paidOffer = undefined
    }
    return
  }
  w.player.sol += o.sol
  c.pc.paidShill = true
  f.paidOffer = undefined
  chatSend(w, 'anondev', 'them', `sent ${o.sol} SOL. post it in the next minute. make it sound organic 🤝`, 900)
  unlock(w, 'paid_shill')
  log(w, 'tg', `@${w.player.handle} accepted ${o.sol} SOL to shill ${tk(c)}`, 'p')
  return c
}

// ---------- the ex ----------

export function exReact(w: World, pnl: number) {
  const f = w.flags
  if (w.t < f.exNext) return
  if (pnl < -1.5 && chance(0.35)) {
    f.exNext = w.t + rand(200, 400)
    chatSend(w, 'ex', 'them', pick(L.EX_LOSS), rand(2000, 5000))
  } else if (pnl > 5 && chance(0.4)) {
    f.exNext = w.t + rand(200, 400)
    chatSend(w, 'ex', 'them', pick(L.EX_WIN), rand(2000, 5000))
  }
}

// ---------- paid shill consequences ----------

export function onDeathPaid(w: World, c: Coin) {
  if (!c.pc.paidShill) return
  w.player.trust = clamp(w.player.trust - 6, 0, 100)
  chatSend(w, 'fans', 'them', `you got PAID to shill ${tk(c)} didn't you. it's so obvious now`, rand(1500, 3000), `anon_${randInt(100, 9999)}`)
  if (chance(0.3)) {
    addPost(w, 'sl1', `receipts: @${w.player.handle} was paid to shill ${tk(c)} by the deployer. ${c.rekt ?? 0} wallets rekt. you're welcome.`, { coinId: c.id, kind: 'callout', targetLikes: rand(900, 2600) })
    w.player.trust = clamp(w.player.trust - 10, 0, 100)
    toast('bad', 'PAID PROMO EXPOSED', 'sherlock found the payment. -16 trust total.')
    fx({ type: 'flash', color: 'amber' })
  }
}

// ---------- KOL agency ----------

export const AGENCY = [
  { id: 'kol4', price: 1.5 },
  { id: 'kol3', price: 3 },
  { id: 'kol1', price: 5 },
  { id: 'kol2', price: 9 },
]

export function bookKol(w: World, kolId: string, coinId: string) {
  const offer = AGENCY.find((a) => a.id === kolId)
  const c = w.coins[coinId]
  if (!offer || !c || w.player.sol < offer.price) return
  if (c.script.kolCalled || c.script.kolId) {
    chatSend(w, 'agency', 'them', `${tk(c)} already has a kol attached. one shill per coin (company policy, lol)`, 900)
    return
  }
  w.player.sol -= offer.price
  const bot = BOT_BY_ID[kolId]
  c.script.kolId = kolId
  c.script.kolCallAge = w.t - c.born + rand(15, 35)
  chatSend(w, 'agency', 'them', `booked @${bot.handle} for ${tk(c)}. posting in ~25s. note: talent buys before posting and sells whenever. standard terms.`, 1000)
  log(w, 'tg', `@${w.player.handle} booked @${bot.handle} for ${offer.price} SOL`, 'p')
  unlock(w, 'agency')
  if (c.flagged) chatSend(w, 'agency', 'them', "btw your coin is flagged. the call will be weak. no refunds", 2400)
}

// ---------- spam DMs / drainers ----------

function spam(w: World, silent: boolean) {
  const f = w.flags
  if (silent || w.t < f.nextSpam) return
  f.nextSpam = w.t + rand(110, 240)
  const sender = pick(L.SPAM_SENDERS)
  const unanswered = w.chats.spam?.msgs.slice(-1)[0]
  if (unanswered && unanswered.from === 'them' && !L.SPAM_FOLLOWUP.includes(unanswered.text) && chance(0.35)) {
    chatSend(w, 'spam', 'them', pick(L.SPAM_FOLLOWUP), 0, unanswered.who)
    return
  }
  if (chance(0.5)) {
    chatSend(w, 'spam', 'them', pick(L.SPAM_DRAINERS), 0, sender)
  } else {
    const o = pick(L.SPAM_OFFERS)
    const price = +(o.price * rand(0.8, 1.4)).toFixed(2)
    f.spamOffer = { kind: o.kind, price, sender }
    chatSend(w, 'spam', 'them', fill(o.text, { P: price }), 0, sender)
  }
}

/** player clicked a link in a DM. it was a drainer. it is always a drainer. */
export function clickDrainer(w: World, url: string) {
  const p = w.player
  const lost = +Math.min(p.sol, p.sol * rand(0.35, 0.75) + 0.1).toFixed(2)
  p.sol = Math.max(0, p.sol - lost)
  w.flags.drained += lost
  chatSend(w, 'spam', 'them', pick(['ty sir 🙏', '✅ verified', 'thank you for verifying', '(this user has deleted their account)']), 1400)
  log(w, 'drainer', `${url} executed setApprovalForAll on @${p.handle}'s wallet — ${lost} SOL swept`, 'r')
  toast('bad', `WALLET DRAINED · -${lost} SOL`, `you connected to ${url.split('/')[0]} and signed. the transaction said "verify". it did not verify.`)
  fx({ type: 'flash', color: 'red' })
  fx({ type: 'shake' })
  sfx.drill()
  unlock(w, 'drained')
}

export function answerSpam(w: World, hire: boolean) {
  const f = w.flags
  const o = f.spamOffer
  if (!o) return
  f.spamOffer = undefined
  if (!hire) {
    chatSend(w, 'spam', 'them', pick(['ok sir no problem 🙏', 'sir please reconsider', 'god bless you sir']), 1200, o.sender)
    return
  }
  w.player.sol -= o.price
  unlock(w, 'hired_spam')
  const roll = Math.random()
  if (roll < 0.45) {
    chatSend(w, 'spam', 'them', 'payment received sir 🙏 starting now', 1200, o.sender)
    chatSend(w, 'spam', 'them', '(this user has blocked you)', 4000)
    toast('bad', 'they took the SOL and blocked you', `${o.price} SOL to ${o.sender}. the trenches have an ecosystem.`)
  } else if (roll < 0.8) {
    const gain = Math.round(rand(40, 160))
    w.player.followers += gain
    chatSend(w, 'spam', 'them', `done sir ✅ ${gain} new followers. all real (they are not)`, 1500, o.sender)
    toast('info', `+${gain} followers (bots)`, `${o.sender} delivered. technically.`)
  } else {
    const coin = Object.values(w.coins).find((c) => c.byPlayer && c.status !== 'dead')
    if (coin) {
      coin.hype += 1.5
      chatSend(w, 'spam', 'them', `${tk(coin)} is pumping sir 🚀 we are best service. 5 star review pls`, 1500, o.sender)
      toast('good', `${o.sender} actually delivered`, `${tk(coin)} attention +1.5. you will never know if it was them.`)
    } else {
      chatSend(w, 'spam', 'them', 'sir you have no project?? ok we keep payment as consulting fee 🙏', 1500, o.sender)
    }
  }
}

// ---------- tick ----------

export function systemsTick(w: World, silent: boolean) {
  solPrice(w)
  events(w, silent)
  cabal(w, silent)
  paidOffers(w, silent)
  spam(w, silent)
}
