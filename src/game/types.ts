export type Kind = 'retail' | 'sniper' | 'insider' | 'dev' | 'kol' | 'whale' | 'vbot' | 'player'

export interface Holder {
  id: string
  kind: Kind
  tokens: number
  cost: number // SOL spent on remaining tokens
  t: number
  cluster?: string
  viaCall?: boolean
  label?: string
}

export interface Candle {
  t: number // bucket index since coin birth
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface Trade {
  id: number
  t: number
  side: 'buy' | 'sell'
  sol: number
  tokens: number
  wallet: string
  kind: Kind
  mc: number
  viaCall?: boolean
}

export type MarkType = 'B' | 'S' | 'C' | 'F' | 'D' | 'L' | 'K'
export interface Mark {
  t: number
  type: MarkType
}

export type ScriptKind = 'bundle_rug' | 'dev_dump' | 'kol_pump' | 'organic' | 'slow_bleed' | 'player'

export interface Script {
  kind: ScriptKind
  targetX: number
  dumpAge: number
  dumpRate: number
  maxLife: number
  kolId?: string
  kolCallAge?: number
  kolCalled?: boolean
  kolSellAge?: number
  dumping?: boolean
  dumpAnnounced?: boolean
  vipWarned?: boolean
  runner?: boolean
}

export interface ChatMsg {
  id: number
  from: 'me' | 'them'
  text: string
  rt: number // real ms when it becomes visible
  who?: string
}

export interface Chat {
  id: string
  msgs: ChatMsg[]
  unread: number
}

export interface Scheduled {
  at: number
  ident: { name: string; ticker: string; emoji: string; desc: string }
  kind: Exclude<ScriptKind, 'player'>
  cabal?: boolean
  celeb?: boolean
}

export interface Flags {
  kevNext: number
  kevOwed: number
  vip: boolean
  bribes: number
  autoSnipe: number
  cabal: 'none' | 'member' | 'kicked'
  cabalJob?: CabalJob
  cabalNext: number
  paidOffer?: { coinId: string; sol: number; expires: number; countered?: boolean }
  nextPaidOffer: number
  exNext: number
  nextSpam: number
  spamOffer?: { kind: string; price: number; sender: string }
  drained: number
}

export interface CabalJob {
  ticker: string
  coinId?: string
  stage: 'pending' | 'live' | 'signaled' | 'called' | 'done'
  signalAge: number
  signaledAt?: number
}

export interface WorldEvent {
  id: string
  name: string
  desc: string
  color: 'g' | 'r' | 'a' | 'p' | 'b'
  until: number
  hype: number
  sell: number
  callMult: number
  noSleuth?: boolean
  outage?: boolean
  solDrift: number
}

export interface Flex {
  ticker: string
  emoji: string
  hue: number
  image?: string
  invested: number
  out: number
  pnl: number
  xp: number
  held: number
  rekt: number
  drill: boolean
}

export interface Wave {
  source: string
  viaPlayer: boolean
  perTick: number
  ticks: number
}

export interface PlayerCoinMeta {
  callAt?: number
  callMc?: number
  calls: number
  callSol: number
  launchT?: number
  volBot: boolean
  profit: number
  scanned: boolean
  lastPostAt: number[]
  cringe?: number
  /** call outcome has been judged (printed, flopped, or dumped on) */
  callRewarded?: boolean
  /** tokens you held when you posted the call, and how many you've sold since */
  callTokens?: number
  callSold?: number
  callDumped?: boolean
  paidShill?: boolean
  firstBuyAt?: number
  soldCost?: number
  soldSol?: number
  posXp?: number
  flex?: Flex
}

export interface Coin {
  id: string
  name: string
  ticker: string
  emoji: string
  hue: number
  image?: string
  desc: string
  creator: string
  byPlayer: boolean
  born: number
  vSol: number
  vTok: number
  holders: Record<string, Holder>
  candles: Candle[]
  tape: Trade[]
  marks: Mark[]
  hype: number
  bundlePct: number
  bundleWallets: number
  detect: number
  flagged: boolean
  flaggedAt?: number
  sleuthCheckedMc: number
  script: Script
  waves: Wave[]
  status: 'live' | 'graduated' | 'dead'
  diedAt?: number
  epitaph?: string
  ath: number
  launchMc: number
  buys: number
  sells: number
  volume: number
  lowTicks: number
  pumpPosted: number
  rekt?: number
  pc: PlayerCoinMeta
}

export type PostKind = 'call' | 'fud' | 'shitpost' | 'reply' | 'news' | 'launch' | 'death' | 'callout'

export interface Post {
  id: number
  t: number
  rt: number // real ms timestamp (typing indicator)
  author: string // bot id or 'player'
  text: string
  coinId?: string
  kind: PostKind
  likes: number
  rts: number
  replies: number
  targetLikes: number
  parent?: number
  replyTo?: string
}

export interface LogLine {
  id: number
  t: number
  agent: string
  text: string
  tone?: 'g' | 'r' | 'a' | 'c' | 'p' | 'd'
}

export interface Stats {
  trades: number
  launched: number
  drills: number
  calls: number
  rekt: number
  biggestDrill: number
  bestX: number
  realized: number
  dumpedOwnCall: number
  fudsRight: number
  fudsWrong: number
  graduated: number
  diedHolding: number
  peakSol: number
  posts: number
}

export interface Player {
  handle: string
  sol: number
  xp: number
  followers: number
  trust: number
  bailouts: number
  lastShitpost: number
  stats: Stats
  achievements: Record<string, number>
}

export interface LbEntry {
  handle: string
  xp: number
  rekt: number
  drift: number
}

export interface Pending {
  at: number
  bot: string
  text: string
  parent?: number
  coinId?: string
  kind: PostKind
}

export interface World {
  v: number
  t: number
  seq: number
  player: Player
  coins: Record<string, Coin>
  order: string[]
  feed: Post[]
  log: LogLine[]
  pending: Pending[]
  selected?: string
  nextSpawn: number
  nextSleuth: number
  nextFiller: number
  nextKolCall: number
  leaderboard: LbEntry[]
  speed: number
  paused: boolean
  sound: boolean
  usedTickers: string[]
  chats: Record<string, Chat>
  flags: Flags
  scheduled: Scheduled[]
  solUsd: number
  solOpen: number
  event?: WorldEvent
  nextEvent: number
  crt: boolean
  lastFlex?: string
}
