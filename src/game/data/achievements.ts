export interface Achievement {
  id: string
  name: string
  desc: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', name: 'First Blood', desc: 'Make your first trade. It only gets worse.' },
  { id: 'dev', name: 'Dev Mode', desc: 'Launch your first coin.' },
  { id: 'serial', name: 'Serial Deployer', desc: 'Launch 10 coins. Seek help.' },
  { id: 'organic', name: 'Organic Community™', desc: 'Bundle 40%+ and hit 3x without getting flagged.' },
  { id: 'own_call', name: 'Dumped On My Own Call', desc: 'Sell within 2 minutes of calling it.' },
  { id: 'speed', name: 'Speed Kills', desc: 'Launch → call → dump in profit within 10 game minutes.' },
  { id: 'rekt47', name: 'Exit Liquidity Farmer', desc: 'Leave 47 followers holding bags.' },
  { id: 'flagged', name: 'Caught In 4K', desc: 'Get your bundle exposed by a sleuth.' },
  { id: 'whistle', name: 'Whistleblower', desc: 'Correctly FUD a bundled coin.' },
  { id: 'wrong_fud', name: 'Just Jealous', desc: 'FUD a clean coin. Get ratioed.' },
  { id: 'grad', name: 'Graduated', desc: 'Have a coin you launched migrate.' },
  { id: 'diamond', name: 'Diamond Hands, Empty Wallet', desc: 'Hold a coin all the way to its death.' },
  { id: 'tenx', name: 'Generational (For A Day)', desc: 'Realize a 10x on a position.' },
  { id: 'exit_liq', name: 'You Are The Exit Liquidity', desc: 'Sell a position at -80% or worse.' },
  { id: 'ratioed', name: "Ratio'd Into Oblivion", desc: 'Drop trust below 10.' },
  { id: 'kol', name: 'Thought Leader', desc: 'Reach 10,000 followers.' },
  { id: 'mom', name: "Mom's Credit Card", desc: 'Take a bailout.' },
  { id: 'driller', name: 'Drill Sergeant', desc: 'Drill 10 times.' },
  { id: 'whale', name: 'Whale Behavior', desc: 'Hold 100 SOL at once.' },
  { id: 'quick_death', name: 'Survived a 15-Minute Coin', desc: 'Profit on a coin that died within 15 minutes.' },
  { id: 'vbot', name: 'Wash Trader', desc: 'Run a volume bot.' },
  { id: 'xp10k', name: 'Professional Extractor', desc: 'Reach 10,000 Extraction Points.' },
  { id: 'scan_after', name: 'Scanned It After Buying', desc: 'Scan a coin you already hold. Classic.' },
  { id: 'sniper', name: 'Bot Did It', desc: 'Get a block 0 fill from TrenchBot.' },
  { id: 'cabal', name: 'Made Man', desc: 'Call a cabal coin on the signal and get paid.' },
  { id: 'kicked', name: 'Jeeted On The Cabal', desc: 'Sell a cabal allocation before the signal.' },
  { id: 'paid_shill', name: 'Sponsored Content', desc: 'Accept money to shill a coin. No disclosure.' },
  { id: 'agency', name: 'Bought Reach', desc: 'Book a KOL to call your coin.' },
  { id: 'rpc_fail', name: 'Blockhash Not Found', desc: 'Have a transaction fail during an RPC outage.' },
  { id: 'drained', name: 'Verified (Drained)', desc: 'Click a link from a stranger in your DMs.' },
  { id: 'hired_spam', name: 'Outsourced The Community', desc: 'Hire a mod, CM or "trending service" from your DMs.' },
  { id: 'flex', name: 'Screenshot Or It Didn’t Happen', desc: 'Save a PnL card.' },
]

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))
