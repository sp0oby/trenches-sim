import { pick } from '../util'

export interface CoinIdentity {
  name: string
  ticker: string
  emoji: string
  desc: string
}

export const COIN_DB: CoinIdentity[] = [
  { name: 'Exit Liquidity', ticker: 'EXIT', emoji: '🚪', desc: 'the only honest coin on the chain. you are the product.' },
  { name: 'Dog With Mortgage', ticker: 'DEBT', emoji: '🐕', desc: '30 year fixed. 0 year conviction.' },
  { name: 'Rug Doctor', ticker: 'RUGMD', emoji: '🩺', desc: 'diagnoses rugs. is a rug.' },
  { name: 'Jeet Repellent', ticker: 'NOJEET', emoji: '🧴', desc: 'apply generously. does not work.' },
  { name: 'Cabal Approved', ticker: 'CABAL', emoji: '🕴️', desc: 'three guys in a discord vc signed off on this.' },
  { name: 'Based Raccoon', ticker: 'TRASH', emoji: '🦝', desc: 'eats garbage. holds garbage. is garbage.' },
  { name: 'Gas Giant', ticker: 'GAS', emoji: '💨', desc: 'mostly air. like your portfolio.' },
  { name: 'Unemployed Penguin', ticker: 'JOBLESS', emoji: '🐧', desc: 'full time trader. part time eater.' },
  { name: 'Literally Nothing', ticker: 'NOTHING', emoji: '⬛', desc: 'no roadmap. no utility. no lies.' },
  { name: 'Dev Is Asleep', ticker: 'SLEEPY', emoji: '😴', desc: 'dev went to bed. the bundle did not.' },
  { name: 'Chart Goes Up', ticker: 'UP', emoji: '📈', desc: 'technically a promise.' },
  { name: 'Dad Went For Milk', ticker: 'MILK', emoji: '🥛', desc: 'he will be back after this pump. trust.' },
  { name: 'Tax Evasion Turtle', ticker: 'IRS', emoji: '🐢', desc: 'slow and steady avoids the audit.' },
  { name: 'Wojak Capital', ticker: 'COPE', emoji: '😩', desc: 'a fund that only buys tops.' },
  { name: 'Regard Finance', ticker: 'REGARD', emoji: '🧠', desc: 'smooth brain, smoother chart.' },
  { name: 'AI Agent Coin', ticker: 'AGENT', emoji: '🤖', desc: 'an autonomous AI agent. it is a cron job.' },
  { name: 'Monke Mortgage', ticker: 'MONKE', emoji: '🐒', desc: 'return to monke. return to rent.' },
  { name: 'Lambo or Food Stamps', ticker: 'LOFS', emoji: '🏎️', desc: 'no third option.' },
  { name: 'Bundle Detector', ticker: 'DETECT', emoji: '🔍', desc: 'detects bundles. 61% bundled.' },
  { name: 'Organic Community', ticker: 'ORGANIC', emoji: '🌱', desc: 'grown in block 0 by 14 wallets.' },
  { name: 'Schrodinger Cat', ticker: 'SCHRO', emoji: '📦', desc: 'both rugged and not until you open the chart.' },
  { name: 'Shrimp DAO', ticker: 'SHRIMP', emoji: '🦐', desc: 'governance by people with 0.1 sol.' },
  { name: 'Pump It Louder', ticker: 'LOUD', emoji: '📢', desc: 'volume is the product.' },
  { name: 'Generational Wealth', ticker: 'GENW', emoji: '💎', desc: 'generational for the dev specifically.' },
  { name: 'Last Coin I Swear', ticker: 'LAST', emoji: '🙏', desc: 'it is never the last coin.' },
  { name: 'Frog In A Suit', ticker: 'SUIT', emoji: '🐸', desc: 'dressed for the funeral of your bags.' },
  { name: 'Not A Rug', ticker: 'NOTRUG', emoji: '🧶', desc: 'see ticker.' },
  { name: 'Cooked', ticker: 'COOKED', emoji: '🍳', desc: 'we are so cooked. buy.' },
  { name: 'Locked In', ticker: 'LOCKIN', emoji: '🔒', desc: 'liquidity is not locked. you are.' },
  { name: 'Bald Eagle Bailout', ticker: 'BAIL', emoji: '🦅', desc: 'too regarded to fail.' },
  { name: 'Abort Mission', ticker: 'ABORT', emoji: '🚀', desc: 'the rocket was a bundle.' },
  { name: 'Liquidity Vampire', ticker: 'VAMP', emoji: '🧛', desc: 'drains liquidity at night. and day.' },
  { name: 'Grindset Hamster', ticker: 'GRIND', emoji: '🐹', desc: 'wheel goes round. chart goes down.' },
  { name: 'Wif Hat But Bigger', ticker: 'BIGHAT', emoji: '🎩', desc: 'derivative of a derivative of a dog.' },
  { name: "Bonk's Landlord", ticker: 'RENT', emoji: '🏠', desc: 'rent is due. so is the dump.' },
  { name: 'Solana Summer 4', ticker: 'SUMMER', emoji: '☀️', desc: 'it is november.' },
  { name: 'Sigma Snail', ticker: 'SIGMA', emoji: '🐌', desc: 'slow grind to zero.' },
  { name: 'Gooner Goose', ticker: 'GOOSE', emoji: '🪿', desc: 'honk if you are down 90%.' },
  { name: 'Trust Fund Cat', ticker: 'TRUST', emoji: '🐈', desc: 'never worked. never sold. never will.' },
  { name: 'Floor Is Lava', ticker: 'LAVA', emoji: '🌋', desc: 'there is no floor.' },
  { name: 'Chud Chicken', ticker: 'CHUD', emoji: '🐔', desc: 'crosses the road. dumps on the other side.' },
  { name: 'Crying Wolf', ticker: 'WOLF', emoji: '🐺', desc: 'called 40 runners. 0 ran.' },
  { name: 'Zero Utility', ticker: 'ZERO', emoji: '0️⃣', desc: 'finally, honesty in crypto.' },
  { name: 'Insider Info', ticker: 'INSIDE', emoji: '🤫', desc: 'you are not inside.' },
  { name: 'Hopium Den', ticker: 'HOPIUM', emoji: '🫧', desc: 'inhale. ape. exhale. cry.' },
  { name: 'Copium Reserve', ticker: 'COPIUM', emoji: '🛢️', desc: 'strategic reserve for bagholders.' },
  { name: 'Ratio King', ticker: 'RATIO', emoji: '👑', desc: 'ratio’d the dev. dev still rugged.' },
  { name: 'Mid Curve Andy', ticker: 'MID', emoji: '📊', desc: 'overthought it. got rugged anyway.' },
  { name: 'Retail Sentiment', ticker: 'RETAIL', emoji: '🐑', desc: 'baaaaa.' },
  { name: 'Block Zero', ticker: 'BLOCK0', emoji: '🧱', desc: 'all supply was bought before you blinked.' },
  { name: 'Possum Playing Dead', ticker: 'POSSUM', emoji: '🐀', desc: 'chart is just pretending. probably.' },
  { name: 'Wen Lambo', ticker: 'WEN', emoji: '⏳', desc: 'never. next question.' },
  { name: 'Dev Paid', ticker: 'DEVPAID', emoji: '💸', desc: 'dex paid. dev paid. you paid.' },
  { name: 'Floor Hamster', ticker: 'FLOOR', emoji: '🐁', desc: 'lives under the floor. like the price.' },
  { name: 'Unrugable', ticker: 'SAFE', emoji: '🛡️', desc: 'dev holds 34%. totally safe.' },
  { name: 'Jeet Season', ticker: 'JEET', emoji: '🏃', desc: 'sell first. ask questions never.' },
  { name: 'Bagholder Anonymous', ticker: 'BAGS', emoji: '🎒', desc: 'step 1: admit you are down 90%.' },
  { name: 'Mom Said No', ticker: 'NOMOM', emoji: '🙅', desc: 'bought it anyway.' },
  { name: 'Liquidity Pool Party', ticker: 'POOL', emoji: '🏊', desc: 'the lifeguard is the dev. he is drowning you.' },
  { name: 'Wen Binance', ticker: 'WENBN', emoji: '🔶', desc: 'never. next question.' },
  { name: 'Ser Pls', ticker: 'SERPLS', emoji: '🥺', desc: 'ser. pls. pump.' },
  { name: 'Cope Harder', ticker: 'COPEH', emoji: '🫠', desc: 'a lifestyle and a ticker.' },
  { name: 'Stop Loss Denier', ticker: 'NOSTOP', emoji: '🛑', desc: 'stop losses are for people who want to keep money.' },
  { name: 'Floor Inspector', ticker: 'INSPECT', emoji: '🔦', desc: 'has inspected every floor. found none.' },
  { name: 'Rent Is Due', ticker: 'DUE', emoji: '📅', desc: 'this one pays rent or eats rent. no middle.' },
  { name: 'Dev Wallet Unlock', ticker: 'UNLOCK', emoji: '🔓', desc: 'unlocks in 5 minutes. totally fine.' },
  { name: 'Burned LP Trust Me', ticker: 'BURNED', emoji: '🔥', desc: 'lp is burned (source: the dev).' },
  { name: 'Gigachad Frog', ticker: 'GIGA', emoji: '🗿', desc: 'jawline: unmatched. chart: matched to every other chart.' },
  { name: 'Hamster Wheel', ticker: 'WHEEL', emoji: '🎡', desc: 'buy, sell, cry, repeat.' },
  { name: 'Emotional Damage', ticker: 'DAMAGE', emoji: '💥', desc: 'the coin and the experience.' },
  { name: 'Group Chat Coin', ticker: 'GC', emoji: '💬', desc: '7 friends. 7 wallets. 1 exit.' },
  { name: 'Volume Bot Inc', ticker: 'VOLBOT', emoji: '📶', desc: '100% of volume is us. transparency.' },
  { name: 'Moonbag', ticker: 'MOONBAG', emoji: '🌕', desc: 'the 10% you keep after the 90% dumps.' },
  { name: 'Fumble', ticker: 'FUMBLE', emoji: '🏈', desc: 'sold at 1.5x. it did 100x. this coin is that feeling.' },
  { name: 'Larping Lion', ticker: 'LARP', emoji: '🦁', desc: 'pretends to be a whale. is a shrimp.' },
  { name: 'Narrative Coin', ticker: 'NARR', emoji: '📰', desc: 'whatever the narrative is, it is this.' },
  { name: 'Ponzi Pigeon', ticker: 'PONZI', emoji: '🕊️', desc: 'early birds eat. late birds are the food.' },
  { name: 'Mint Authority', ticker: 'MINT', emoji: '🖨️', desc: 'mint authority not revoked. vibes revoked.' },
  { name: 'Silent Dev', ticker: 'SILENT', emoji: '🤐', desc: 'dev has not posted in 4 minutes. bearish.' },
  { name: 'Burger Flipper', ticker: 'FLIP', emoji: '🍔', desc: 'plan b for every holder.' },
  { name: 'Crab Market', ticker: 'CRAB', emoji: '🦀', desc: 'sideways until it isnt (down).' },
  { name: 'Liquidation Larry', ticker: 'LARRY', emoji: '🧔', desc: 'got liquidated on perps so he launched this.' },
  { name: 'Peak Delusion', ticker: 'PEAK', emoji: '🏔️', desc: 'you are here. it only goes down from here.' },
  { name: 'Insider Trading Club', ticker: 'ITC', emoji: '🎩', desc: 'membership: 14 wallets. applications: closed.' },
  { name: 'Dexscreener Paid', ticker: 'DEXPAID', emoji: '🧾', desc: 'the most bullish signal known to man ($300).' },
  { name: 'Rugged Again', ticker: 'AGAIN', emoji: '🔁', desc: 'fool me 47 times.' },
  { name: 'Turbo Cat', ticker: 'TURBOCAT', emoji: '🐆', desc: 'fast up. faster down.' },
  { name: 'Ghost Chain', ticker: 'GHOST', emoji: '👻', desc: 'the holders left. the coin stayed.' },
  { name: 'Brainrot', ticker: 'ROT', emoji: '🧟', desc: 'the only asset class that appreciates as you scroll.' },
]

const PREFIX = ['Baby', 'Based', 'Giga', 'Dark', 'Regarded', 'Turbo', 'Lil', 'Big', 'Mega', 'Sad', 'Rich', 'Broke', 'Sigma', 'Feral', 'Unhinged', 'Evil', 'Wet', 'Bald', 'Jacked', 'Haunted', 'Sleepy', 'Angry', 'Divorced', 'Unemployed', 'Rugged', 'Cursed', 'Delusional', 'Retired', 'Sober', 'Leveraged', 'Bankrupt', 'Woke', 'Chill']
const NOUNS: [string, string][] = [
  ['Pepe', '🐸'], ['Doge', '🐕'], ['Hamster', '🐹'], ['Goat', '🐐'], ['Cat', '🐈'], ['Penguin', '🐧'],
  ['Toad', '🐸'], ['Possum', '🐀'], ['Llama', '🦙'], ['Shrimp', '🦐'], ['Pigeon', '🐦'], ['Raccoon', '🦝'],
  ['Monke', '🐒'], ['Duck', '🦆'], ['Bear', '🐻'], ['Bull', '🐂'], ['Frog', '🐸'], ['Capybara', '🦫'],
  ['Shark', '🦈'], ['Octopus', '🐙'], ['Snail', '🐌'], ['Bat', '🦇'], ['Wizard', '🧙'], ['Goblin', '👺'],
]
const GEN_DESC = [
  'community driven (the community is the dev).',
  'no roadmap. no team. no problem.',
  'fair launch* (*not fair, barely a launch)',
  'the next 1000x according to my uncle.',
  'cto incoming (it is not).',
  'meme of the cycle. cycle lasts 9 minutes.',
  'dev doxxed (it was a burner).',
  'chart clean. vibes cleaner. bundle cleanest.',
]

export function generateIdentity(used: Set<string>): CoinIdentity {
  const fresh = COIN_DB.filter((c) => !used.has(c.ticker))
  if (fresh.length && Math.random() < 0.65) return pick(fresh)
  for (let i = 0; i < 20; i++) {
    const p = pick(PREFIX)
    const [n, e] = pick(NOUNS)
    const ticker = (Math.random() < 0.5 ? p.slice(0, 3) + n.slice(0, 4) : n.toUpperCase().slice(0, 6)).toUpperCase()
    if (used.has(ticker)) continue
    return { name: `${p} ${n}`, ticker, emoji: e, desc: pick(GEN_DESC) }
  }
  const [n, e] = pick(NOUNS)
  return { name: `${n} ${Math.floor(Math.random() * 999)}`, ticker: `${n.slice(0, 3).toUpperCase()}${Math.floor(Math.random() * 99)}`, emoji: e, desc: pick(GEN_DESC) }
}

export const EMOJI_PICKER = ['🐸', '🐕', '🐈', '🦍', '🐹', '🦝', '🐧', '🦐', '🐋', '🦈', '🐌', '🪿', '🧠', '💀', '🔥', '🚀', '💎', '🍳', '🤡', '👺', '🧙', '🤖', '🥛', '🍆']
