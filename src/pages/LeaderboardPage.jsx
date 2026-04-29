import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { PAIRINGS, PLAYERS, DAY_FORMAT } from '../lib/gameData.js';
import { computeFourBallMatch, buildScoreLookup } from '../lib/scoring.js';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

function HolesUpDisplay({ n }) {
  if (n === 0) return <span style={{ color: 'rgba(245,240,232,0.4)', fontSize: 12 }}>A/S</span>;
  const isA = n > 0;
  return (
    <span style={{ color: isA ? C.gold : C.teal, fontWeight: 'bold', fontSize: 13 }}>
      {Math.abs(n)} up {isA ? '(A)' : '(B)'}
    </span>
  );
}

function FourBallCard({ pairing, scoreLookup, day }) {
  const teamAHcps = pairing.teamA.map(i => PLAYERS[i].playingHcp);
  const teamBHcps = pairing.teamB.map(i => PLAYERS[i].playingHcp);
  const teamAScores = pairing.teamA.map(i => {
    const s = scoreLookup[i] || {};
    return Object.fromEntries(Object.entries(s).map(([h, g]) => [h, g]));
  });
  const teamBScores = pairing.teamB.map(i => {
    const s = scoreLookup[i] || {};
    return Object.fromEntries(Object.entries(s).map(([h, g]) => [h, g]));
  });

  const { holes, teamAHolesUp } = computeFourBallMatch(teamAScores, teamBScores, teamAHcps, teamBHcps);
  const holesPlayed = holes.filter(h => h.winner !== null).length;
  const teamANames = pairing.teamA.map(i => PLAYERS[i].name.split(' ')[0]);
  const teamBNames = pairing.teamB.map(i => PLAYERS[i].name.split(' ')[0]);

  return (
    <div style={styles.fourBallCard}>
      <div style={styles.fbHeader}>
        <div style={styles.teeTimeBadge}>{pairing.teeTime}</div>
        <div style={styles.holesPlayed}>{holesPlayed}/18 holes</div>
      </div>

      <div style={styles.matchupRow}>
        {/* Team A */}
        <div style={styles.teamSide}>
          <div style={styles.teamNameTag}><span style={styles.goldDot} />A Holes</div>
          {teamANames.map((n, i) => <div key={i} style={styles.playerSmall}>{n}</div>)}
        </div>

        {/* Score */}
        <div style={styles.matchScore}>
          <HolesUpDisplay n={teamAHolesUp} />
        </div>

        {/* Team B */}
        <div style={{ ...styles.teamSide, textAlign: 'right' }}>
          <div style={{ ...styles.teamNameTag, justifyContent: 'flex-end' }}><span style={styles.tealDot} />Bum Bandits</div>
          {teamBNames.map((n, i) => <div key={i} style={styles.playerSmall}>{n}</div>)}
        </div>
      </div>

      {/* Hole-by-hole mini tracker */}
      {holesPlayed > 0 && (
        <div style={styles.holeTrack}>
          {holes.map(h => (
            <div key={h.hole} style={{
              ...styles.holeCell,
              background: h.winner === 'A' ? 'rgba(201,168,76,0.25)' :
                          h.winner === 'B' ? 'rgba(78,207,176,0.2)' :
                          h.winner === 'H' ? 'rgba(245,240,232,0.08)' : 'rgba(0,0,0,0.2)',
            }}>
              <div style={styles.holeCellNum}>{h.hole}</div>
              {h.winner && <div style={styles.holeCellWinner}>
                {h.winner === 'H' ? '½' : h.winner}
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage({ player }) {
  const today = new Date();
  const may1 = new Date('2026-05-01');
  const defaultDay = today.toDateString() === may1.toDateString() ? 2 : 1;

  const [roundDay, setRoundDay] = useState(defaultDay);
  const [scoreLookup, setScoreLookup] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  const dayPairings = PAIRINGS.filter(p => p.day === roundDay);

  async function loadScores() {
    const { data } = await supabase
      .from('scores')
      .select('player_index, hole_number, gross_score')
      .eq('round_day', roundDay);
    if (data) {
      setScoreLookup(buildScoreLookup(data));
      setLastUpdate(new Date());
    }
  }

  useEffect(() => { loadScores(); }, [roundDay]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        loadScores();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [roundDay]);

  // Overall team tally: A Holes wins vs Bum Bandits wins
  let teamATally = 0, teamBTally = 0, halfTally = 0;
  dayPairings.forEach(p => {
    const { teamAHolesUp } = computeFourBallMatch(
      p.teamA.map(i => scoreLookup[i] || {}),
      p.teamB.map(i => scoreLookup[i] || {}),
      p.teamA.map(i => PLAYERS[i].playingHcp),
      p.teamB.map(i => PLAYERS[i].playingHcp),
    );
    if (teamAHolesUp > 0) teamATally++;
    else if (teamAHolesUp < 0) teamBTally++;
    else halfTally++;
  });

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.goldBar} />

        {/* Header */}
        <div style={styles.header}>
          <svg width="24" height="24" viewBox="0 0 30 30" style={{ display: 'block', margin: '0 auto 10px' }}>
            <circle cx="15" cy="26" r="2.8" fill="rgba(201,168,76,0.3)" />
            <rect x="14.2" y="6" width="1.6" height="20" fill="#c9a84c" />
            <polygon points="15.8,6 25,11 15.8,16" fill="#c9a84c" />
          </svg>
          <div style={styles.eyebrow}>Live Leaderboard · Stellenbosch 2026</div>
          <div style={styles.title}>🏆 The Match</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            {[1, 2].map(d => (
              <button key={d} onClick={() => setRoundDay(d)}
                style={{ ...styles.dayBtn, ...(roundDay === d ? styles.dayBtnActive : {}) }}>
                Day {d} · {d === 1 ? 'Thu 30 Apr' : 'Fri 1 May'}
              </button>
            ))}
          </div>
          <div style={styles.formatTag}>{DAY_FORMAT[roundDay]}</div>
        </div>

        {/* Overall tally */}
        <div style={styles.tallyRow}>
          <div style={styles.tallyTeam}>
            <div style={styles.tallyName}>The A Holes</div>
            <div style={{ ...styles.tallyScore, color: C.gold }}>{teamATally}</div>
          </div>
          <div style={styles.tallyMid}>
            <div style={{ color: 'rgba(245,240,232,0.2)', fontSize: 11, marginBottom: 2 }}>fourball wins</div>
            {halfTally > 0 && <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.2)' }}>{halfTally} all square</div>}
          </div>
          <div style={{ ...styles.tallyTeam, textAlign: 'right' }}>
            <div style={{ ...styles.tallyName, color: C.teal }}>Bum Bandits</div>
            <div style={{ ...styles.tallyScore, color: C.teal }}>{teamBTally}</div>
          </div>
        </div>

        {/* Four-ball cards */}
        <div style={{ padding: '0 0 8px' }}>
          {dayPairings.map((p, i) => (
            <FourBallCard key={i} pairing={p} scoreLookup={scoreLookup} day={roundDay} />
          ))}
        </div>

        {/* Last update */}
        {lastUpdate && (
          <div style={styles.updateRow}>
            🔴 Live · Updated {lastUpdate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}

        <div style={styles.goldBar} />
      </div>
    </div>
  );
}

const styles = {
  page: { background: C.darkGreen, minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '20px 16px', fontFamily: "Georgia,'Times New Roman',serif" },
  card: { background: C.green, width: '100%', maxWidth: 480, borderRadius: 3, color: C.text, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' },
  goldBar: { height: 5, background: 'linear-gradient(90deg,#a07830,#c9a84c,#e8c96a,#c9a84c,#a07830)' },
  header: { padding: '18px 24px 14px', textAlign: 'center', borderBottom: '1px solid rgba(201,168,76,0.3)' },
  eyebrow: { color: C.gold, fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 6 },
  title: { fontSize: 20 },
  dayBtn: { padding: '5px 12px', borderRadius: 2, border: '1px solid rgba(201,168,76,0.25)', background: 'transparent', color: 'rgba(245,240,232,0.45)', fontSize: 10, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  dayBtnActive: { background: 'rgba(201,168,76,0.15)', color: C.gold, borderColor: 'rgba(201,168,76,0.5)' },
  formatTag: { fontSize: 10, color: 'rgba(245,240,232,0.3)', fontStyle: 'italic', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 5 },
  tallyRow: { display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid rgba(201,168,76,0.2)', background: 'rgba(0,0,0,0.15)' },
  tallyTeam: { flex: 1 },
  tallyMid: { textAlign: 'center', flex: 0, minWidth: 80 },
  tallyName: { fontSize: 13, color: C.gold, marginBottom: 4 },
  tallyScore: { fontSize: 36, fontWeight: 'bold' },
  fourBallCard: { margin: '10px 16px', background: 'rgba(0,0,0,0.18)', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(245,240,232,0.06)' },
  fbHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(245,240,232,0.05)' },
  teeTimeBadge: { fontSize: 13, color: C.gold, fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1 },
  holesPlayed: { fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  matchupRow: { display: 'flex', alignItems: 'center', padding: '10px 12px' },
  teamSide: { flex: 1 },
  teamNameTag: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', color: C.gold, marginBottom: 4 },
  goldDot: { width: 6, height: 6, borderRadius: '50%', background: C.gold, display: 'inline-block', flexShrink: 0 },
  tealDot: { width: 6, height: 6, borderRadius: '50%', background: C.teal, display: 'inline-block', flexShrink: 0 },
  playerSmall: { fontSize: 11, color: 'rgba(245,240,232,0.65)', fontFamily: 'Helvetica Neue,Arial,sans-serif', padding: '1px 0' },
  matchScore: { textAlign: 'center', minWidth: 80, fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  holeTrack: { display: 'flex', flexWrap: 'wrap', gap: 2, padding: '6px 10px 10px' },
  holeCell: { width: 22, height: 26, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  holeCellNum: { fontSize: 7, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  holeCellWinner: { fontSize: 9, fontWeight: 'bold', color: 'rgba(245,240,232,0.8)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  updateRow: { textAlign: 'center', padding: '6px 20px 12px', fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
};
