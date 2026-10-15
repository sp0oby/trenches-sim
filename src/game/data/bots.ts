export type BotRole = 'kol' | 'sleuth' | 'deployer' | 'ape' | 'reply' | 'filler' | 'whale' | 'news'

export interface Bot {
  id: string
  handle: string
  name: string
  emoji: string
  role: BotRole
  followers: number
  verified?: boolean
  hue: number
}

export const BOTS: Bot[] = [
  { id: 'kol1', handle: 'trustmebro_calls', name: 'TrustMeBro', emoji: '🤝', role: 'kol', followers: 48200, verified: true, hue: 265 },
  { id: 'kol2', handle: '0xDegenMommy', name: 'degen mommy', emoji: '💅', role: 'kol', followers: 112000, verified: true, hue: 320 },
  { id: 'kol3', handle: 'alpha_leaker', name: 'alpha leaker', emoji: '🫗', role: 'kol', followers: 22400, verified: true, hue: 190 },
  { id: 'kol4', handle: 'chart_astrologer', name: 'chart astrologer ✨', emoji: '🔮', role: 'kol', followers: 15800, hue: 280 },
  { id: 'sl1', handle: 'onchain_sherlock', name: 'on-chain sherlock', emoji: '🕵️', role: 'sleuth', followers: 67000, verified: true, hue: 40 },
  { id: 'sl2', handle: 'bubblemap_enjoyer', name: 'bubblemap enjoyer', emoji: '🫧', role: 'sleuth', followers: 9100, hue: 50 },
  { id: 'dep1', handle: 'serial_deployer', name: 'serial deployer', emoji: '🏭', role: 'deployer', followers: 3100, hue: 0 },
  { id: 'dep2', handle: 'not_a_dev', name: 'definitely not the dev', emoji: '🙈', role: 'deployer', followers: 880, hue: 15 },
  { id: 'dep3', handle: 'cabal_intern', name: 'cabal intern', emoji: '🕴️', role: 'deployer', followers: 5400, hue: 350 },
  { id: 'ape1', handle: 'justaped', name: 'just aped', emoji: '🦍', role: 'ape', followers: 412, hue: 120 },
  { id: 'ape2', handle: 'bagholder_dad', name: 'bagholder dad', emoji: '👨‍👧', role: 'ape', followers: 233, hue: 140 },
  { id: 'ape3', handle: 'exitliq_enjoyer', name: 'exit liquidity enjoyer', emoji: '🫠', role: 'ape', followers: 96, hue: 160 },
  { id: 'ape4', handle: 'rent_money_sol', name: 'rent money', emoji: '🏚️', role: 'ape', followers: 57, hue: 100 },
  { id: 'rg1', handle: 'replyguy_9000', name: 'reply guy 9000', emoji: '🗣️', role: 'reply', followers: 1900, hue: 210 },
  { id: 'rg2', handle: 'ser_pls', name: 'ser pls', emoji: '🙏', role: 'reply', followers: 610, hue: 230 },
  { id: 'rg3', handle: 'ratio_merchant', name: 'ratio merchant', emoji: '📉', role: 'reply', followers: 2700, hue: 0 },
  { id: 'f1', handle: 'gm_frens_420', name: 'gm frens', emoji: '☀️', role: 'filler', followers: 3300, hue: 45 },
  { id: 'f2', handle: 'crypto_therapist', name: 'crypto therapist', emoji: '🛋️', role: 'filler', followers: 12800, hue: 300 },
  { id: 'f3', handle: 'rugpull_survivor', name: 'rug survivor (x47)', emoji: '🩹', role: 'filler', followers: 4100, hue: 20 },
  { id: 'w1', handle: 'based_whale', name: 'based whale', emoji: '🐋', role: 'whale', followers: 31000, verified: true, hue: 200 },
  { id: 'kol5', handle: 'sigma_signals', name: 'sigma signals 📈', emoji: '🗿', role: 'kol', followers: 33500, verified: true, hue: 30 },
  { id: 'dep4', handle: 'deployooor', name: 'deployooor', emoji: '🧪', role: 'deployer', followers: 1200, hue: 100 },
  { id: 'ape5', handle: 'wife_doesnt_know', name: 'wife doesnt know', emoji: '🤫', role: 'ape', followers: 188, hue: 300 },
  { id: 'ape6', handle: 'down_bad_daily', name: 'down bad daily', emoji: '📉', role: 'ape', followers: 742, hue: 0 },
  { id: 'rg4', handle: 'actually_um', name: 'actually, um', emoji: '🤓', role: 'reply', followers: 860, hue: 60 },
  { id: 'rg5', handle: 'lfg_larry', name: 'LFG larry', emoji: '🚀', role: 'reply', followers: 1450, hue: 15 },
  { id: 'f4', handle: 'pnl_poet', name: 'pnl poet', emoji: '🪶', role: 'filler', followers: 7300, hue: 250 },
  { id: 'f5', handle: 'touch_grass_dao', name: 'touch grass dao', emoji: '🌿', role: 'filler', followers: 2100, hue: 120 },
  { id: 'news', handle: 'trenches_wire', name: 'TRENCHES WIRE', emoji: '📡', role: 'news', followers: 88000, verified: true, hue: 180 },
]

export const BOT_BY_ID: Record<string, Bot> = Object.fromEntries(BOTS.map((b) => [b.id, b]))
export const botsByRole = (role: BotRole) => BOTS.filter((b) => b.role === role)

export const LEADERBOARD_SEED = [
  { handle: 'cabal_intern', xp: 48210, rekt: 2113, drift: 3 },
  { handle: 'serial_deployer', xp: 39877, rekt: 1840, drift: 2.5 },
  { handle: '0xDegenMommy', xp: 31004, rekt: 3302, drift: 2 },
  { handle: 'trustmebro_calls', xp: 22450, rekt: 1210, drift: 1.6 },
  { handle: 'insider_tradoor', xp: 18320, rekt: 640, drift: 1.2 },
  { handle: 'bundle_bandit', xp: 12910, rekt: 488, drift: 0.9 },
  { handle: 'not_a_dev', xp: 8404, rekt: 301, drift: 0.6 },
  { handle: 'chart_astrologer', xp: 2210, rekt: 97, drift: 0.2 },
  { handle: 'justaped', xp: -2330, rekt: 0, drift: -0.4 },
  { handle: 'bagholder_dad', xp: -9120, rekt: 0, drift: -0.7 },
]
