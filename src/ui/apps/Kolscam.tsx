import { useState } from 'react'
import { act, useWorld, wipe } from '../../game/store'
import { ACHIEVEMENTS } from '../../game/data/achievements'
import { bailout } from '../../game/actions'
import { followerPower } from '../../game/engine'
import { setSoundEnabled } from '../../game/audio'
import { fmtNum, fmtSol } from '../../game/util'
import { PersonAvatar, TRUST_COLOR } from '../shared'
import { setNav } from '../nav'

export default function Kolscam() {
  const w = useWorld()
  const [confirm, setConfirm] = useState(false)
  const p = w.player
  const s = p.stats
  const lb = [...w.leaderboard.map((e) => ({ ...e, me: false })), { handle: p.handle, xp: p.xp, rekt: s.rekt, drift: 0, me: true }].sort((a, b) => b.xp - a.xp)
  const rank = lb.findIndex((e) => e.me) + 1
  const unlocked = ACHIEVEMENTS.filter((a) => p.achievements[a.id]).length
  const title =
    p.xp > 40000 ? 'Cabal member' : p.xp > 15000 ? 'Professional extractor' : p.xp > 5000 ? 'Mid-tier KOL' : p.xp > 1000 ? 'Aspiring dev' : p.xp >= 0 ? 'Fresh meat' : 'Exit liquidity'
  const flexCoin = w.lastFlex ? w.coins[w.lastFlex] : undefined

  const stats: [string, string, string?][] = [
    ['Extraction', `${Math.round(p.xp).toLocaleString()} XP`, p.xp >= 0 ? 'g' : 'r'],
    ['Realized PnL', `${s.realized >= 0 ? '+' : ''}${fmtSol(s.realized)} SOL`, s.realized >= 0 ? 'g' : 'r'],
    ['Followers', fmtNum(p.followers)],
    ['Trust', String(Math.round(p.trust))],
    ['Coins launched', String(s.launched)],
    ['Calls posted', String(s.calls)],
    ['People rekt', String(s.rekt), 'r'],
    ['Drills', String(s.drills)],
    ['Biggest drill', `${s.biggestDrill.toLocaleString()} XP`],
    ['Best trade', `${s.bestX.toFixed(2)}x`],
    ['Dumped own call', String(s.dumpedOwnCall), 'a'],
    ['Died holding', String(s.diedHolding)],
    ['FUD right / wrong', `${s.fudsRight} / ${s.fudsWrong}`],
    ['Lost to drainers', `${fmtSol(w.flags.drained)} SOL`, w.flags.drained ? 'r' : undefined],
    ['Peak balance', `${fmtSol(s.peakSol)} SOL`],
    ['Mom bailouts', String(p.bailouts), p.bailouts ? 'a' : undefined],
  ]

  return (
    <div className="kol">
      <div className="col" style={{ gap: 22 }}>
        <div className="row" style={{ gap: 16 }}>
          <PersonAvatar author="player" size={64} />
          <div className="grow">
            <div className="label">kolscam.io · on-chain reputation (lol)</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>@{p.handle}</div>
            <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="chip p">{title}</span>
              <span className="chip">Rank #{rank}</span>
              <span className="chip" style={{ color: TRUST_COLOR(p.trust) }}>Trust {Math.round(p.trust)}</span>
              <span className="chip">Power {followerPower(p).toFixed(2)}</span>
              {w.flags.cabal === 'member' && <span className="chip r">Cabal</span>}
            </div>
          </div>
          {flexCoin?.pc.flex && <button className="btn" onClick={() => setNav({ flex: flexCoin.id })}>Last PnL card</button>}
          {p.sol < 1 && <button className="btn a" onClick={() => act((w) => bailout(w))}>Call mom (+5 SOL)</button>}
        </div>

        <div className="kgrid">
          {stats.map(([k, v, cls]) => (
            <div key={k}>
              <div className="k">{k}</div>
              <div className={`v ${cls ?? ''}`}>{v}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="section-h">
            Achievements <span className="chip">{unlocked} / {ACHIEVEMENTS.length}</span>
          </div>
          <div className="achs">
            {ACHIEVEMENTS.map((a) => {
              const got = !!p.achievements[a.id]
              return (
                <div key={a.id} className={`ach${got ? '' : ' locked'}`}>
                  <div className="ico">{got ? '★' : '☆'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="n">{a.name}</div>
                    <div className="ds">{a.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 22 }}>
        <div>
          <div className="section-h">Most efficient extractors</div>
          <div className="lb">
            {lb.map((e, i) => (
              <div key={e.handle + i} className={`lr${e.me ? ' me' : ''}`}>
                <span className={`num ${i < 3 ? 'a' : 'd'}`}>#{i + 1}</span>
                <span className="ellipsis" style={{ fontWeight: e.me ? 600 : 400 }}>@{e.handle}</span>
                <span className={`num ${e.xp >= 0 ? '' : 'r'}`} style={{ textAlign: 'right' }}>{Math.round(e.xp).toLocaleString()}</span>
                <span className="num d" style={{ textAlign: 'right' }}>{e.rekt} rekt</span>
              </div>
            ))}
          </div>
          <div className="d" style={{ fontSize: 12, marginTop: 8 }}>"Rekt" = people left holding the bag. Higher is "better".</div>
        </div>

        <div>
          <div className="section-h">Settings</div>
          <div className="col" style={{ gap: 12 }}>
            <button className="row" style={{ textAlign: 'left' }} onClick={() => act((w) => { w.sound = !w.sound; setSoundEnabled(w.sound) })}>
              <span className={`toggle${w.sound ? ' on' : ''}`} /> Sound effects
            </button>
            <button className="row" style={{ textAlign: 'left' }} onClick={() => act((w) => (w.crt = !w.crt))}>
              <span className={`toggle${w.crt ? ' on' : ''}`} /> CRT mode <span className="d">(scanlines, for the nostalgic)</span>
            </button>
            <div className="d" style={{ fontSize: 12 }}>Everything saves to this browser. No accounts, no servers, no real money.</div>
            {!confirm ? (
              <button className="btn r" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirm(true)}>Start a new life (wipe save)</button>
            ) : (
              <div className="row">
                <span className="r">Wipe everything?</span>
                <button className="btn r" onClick={() => { wipe(); location.reload() }}>Yes, wipe</button>
                <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
