import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { PAIRINGS, PLAYERS, DAY_FORMAT } from '../lib/gameData.js';
import { betterBallPoints, stablefordPoints } from '../lib/scoring.js';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function pairStablefordTotal(idx1, idx2, scoreLookup) {
  const hcp1 = PLAYERS[idx1].playingHcp;
  const hcp2 = PLAYERS[idx2].playingHcp;
  const s1 = scoreLookup[idx1] || {};
  const s2 = scoreLookup[idx2] || {};
  let total = 0, holes = 0;
  for (let h = 1; h <= 18; h++) {
    const g1 = s1[h], g2 = s2[h];
    if (g1 == null && g2 == null) continue;
    holes++;
    total += betterBallPoints(hcp1, g1, hcp2, g2, h);
  }
  return { total, holes };
}

function playerStablefordTotal(idx, scoreLookup) {
  const hcp = PLAYERS[idx].playingHcp;
  const s = scoreLookup[idx] || {};
  let total = 0, holes = 0;
  for (let h = 1; h <= 18; h++) {
    if (s[h] == null) continue;
    holes++;
    total += stablefordPoints(s[h], hcp, h);
  }
  return { total, holes };
}

function teamDayTotal(day, team, scoresByDay) {
  const dayPairings = PAIRINGS.filter(p => p.day === day);
  return dayPairings.reduce((sum, p) => {
    const pair = team === 'A' ? p.teamA : p.teamB;
    return sum + pairStablefordTotal(pair[0], pair[1], scoresByDay[day] || {}).total;
  }, 0);
}

function pairsRankingForDay(day, scoresByDay) {
  const dayPairings = PAIRINGS.filter(p => p.day === day);
  const list = [];
  dayPairings.forEach(p => {
    const a = pairStablefordTotal(p.teamA[0], p.teamA[1], scoresByDay[day] || {});
    list.push({
      key: `${p.teeTime}-A`, team: 'A', teamLabel: 'A Holes', color: C.gold,
      names: p.teamA.map(i => PLAYERS[i].name.split(' ')[0]),
      teeTime: p.teeTime, total: a.total, holes: a.holes,
    });
    const b = pairStablefordTotal(p.teamB[0], p.teamB[1], scoresByDay[day] || {});
    list.push({
      key: `${p.teeTime}-B`, team: 'B', teamLabel: 'Bum Bandits', color: C.teal,
      names: p.teamB.map(i => PLAYERS[i].name.split(' ')[0]),
      teeTime: p.teeTime, total: b.total, holes: b.holes,
    });
  });
  return list.sort((x, y) => y.total - x.total || y.holes - x.holes);
}

function individualsRankingForDay(day, scoresByDay) {
  return PLAYERS.map(p => {
    const { total, holes } = playerStablefordTotal(p.index, scoresByDay[day] || {});
    return { ...p, total, holes };
  }).sort((a, b) => b.total - a.total || b.holes - a.holes);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RankBadge({ rank }) {
  if (rank === 1) return <span style={styles.medal}>🥇</span>;
  if (rank === 2) return <span style={styles.medal}>🥈</span>;
  if (rank === 3) return <span style={styles.medal}>🥉</span>;
  return <span style={styles.rankNum}>{rank}</span>;
}

function DayTeamBanner({ day, aTotal, bTotal }) {
  const diff = aTotal - bTotal;
  const status = diff === 0
    ? (aTotal === 0 ? 'No scores yet' : 'All Square')
    : diff > 0 ? `A Holes lead +${diff}` : `Bum Bandits lead +${Math.abs(diff)}`;
  const statusColor = diff === 0 ? 'rgba(245,240,232,0.4)' : diff > 0 ? C.gold : C.teal;
  return (
    <div style={styles.dayBanner}>
      <div style={styles.dayBannerLabel}>Day {day} · Team Better-Ball Stableford</div>
      <div style={styles.dayBannerRow}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>A Holes</div>
          <div style={{ fontSize: 24, color: C.gold, fontWeight: 'bold', lineHeight: 1, marginTop: 2 }}>{aTotal}<span style={{ fontSize: 10, marginLeft: 3, fontWeight: 'normal', opacity: 0.6 }}>pts</span></div>
        </div>
        <div style={{ flex: 0, minWidth: 110, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: statusColor, fontWeight: 'bold', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{status}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: C.teal, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>Bum Bandits</div>
          <div style={{ fontSize: 24, color: C.teal, fontWeight: 'bold', lineHeight: 1, marginTop: 2 }}>{bTotal}<span style={{ fontSize: 10, marginLeft: 3, fontWeight: 'normal', opacity: 0.6 }}>pts</span></div>
        </div>
      </div>
    </div>
  );
}

function PairsList({ pairs, dayTeamA, dayTeamB, day }) {
  return (
    <div>
      <DayTeamBanner day={day} aTotal={dayTeamA} bTotal={dayTeamB} />
      {!pairs.length || pairs.every(p => p.holes === 0) ? (
        <div style={styles.emptyState}>No pair scores entered yet</div>
      ) : pairs.map((p, i) => (
        <div key={p.key} style={styles.rankRow}>
          <RankBadge rank={i + 1} />
          <div style={{ flex: 1, marginLeft: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color }} />
              <span style={{ fontSize: 9, color: p.color, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{p.teamLabel}</span>
              <span style={{ fontSize: 9, color: 'rgba(245,240,232,0.25)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginLeft: 'auto' }}>{p.teeTime}</span>
            </div>
            <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{p.names.join(' & ')}</div>
            <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 1 }}>{p.holes}/18 holes</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...styles.ptsBig, color: p.color }}>{p.total}</div>
            <div style={styles.ptsLbl}>pts</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function IndividualsList({ players }) {
  if (!players.length || players.every(p => p.holes === 0)) {
    return <div style={styles.emptyState}>No scores entered yet for Day 2</div>;
  }
  return (
    <div>
      {players.map((p, i) => {
        const color = p.team === 'A' ? C.gold : C.teal;
        return (
          <div key={p.index} style={styles.rankRow}>
            <RankBadge rank={i + 1} />
            <div style={{ flex: 1, marginLeft: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 9, color, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                  {p.team === 'A' ? 'A Holes' : 'Bum Bandits'}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(245,240,232,0.25)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginLeft: 'auto' }}>HCP {p.playingHcp}</span>
              </div>
              <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{p.name}</div>
              <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 1 }}>{p.holes}/18 holes</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...styles.ptsBig, color }}>{p.total}</div>
              <div style={styles.ptsLbl}>pts</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage({ player }) {
  const today = new Date();
  const may1 = new Date('2026-05-01');
  const isDay2OrLater = today >= may1;
  const defaultView = isDay2OrLater ? 'pairs2' : 'pairs1';

  const [view, setView] = useState(defaultView); // 'pairs1' | 'pairs2' | 'individuals2'
  const [scoresByDay, setScoresByDay] = useState({ 1: {}, 2: {} });
  const [lastUpdate, setLastUpdate] = useState(null);

  async function loadAllScores() {
    const { data } = await supabase
      .from('scores')
      .select('player_index, hole_number, gross_score, round_day');
    if (!data) return;
    const byDay = { 1: {}, 2: {} };
    for (const row of data) {
      const d = row.round_day;
      if (!byDay[d]) continue;
      if (!byDay[d][row.player_index]) byDay[d][row.player_index] = {};
      byDay[d][row.player_index][row.hole_number] = row.gross_score;
    }
    setScoresByDay(byDay);
    setLastUpdate(new Date());
  }

  useEffect(() => { loadAllScores(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => loadAllScores())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Cumulative across both days
  const aDay1 = teamDayTotal(1, 'A', scoresByDay);
  const aDay2 = teamDayTotal(2, 'A', scoresByDay);
  const bDay1 = teamDayTotal(1, 'B', scoresByDay);
  const bDay2 = teamDayTotal(2, 'B', scoresByDay);
  const aTotal = aDay1 + aDay2;
  const bTotal = bDay1 + bDay2;

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
          <div style={styles.formatTag}>Four-Ball Better Ball Stableford · 85% allowance</div>
        </div>

        {/* CUMULATIVE TEAM TOTAL — Day 1 + Day 2 */}
        <div style={styles.tallyRow}>
          <div style={styles.tallyTeam}>
            <div style={styles.tallyName}>The A Holes</div>
            <div style={{ ...styles.tallyScore, color: C.gold }}>{aTotal}</div>
            <div style={styles.tallyBreakdown}>D1: {aDay1} · D2: {aDay2}</div>
          </div>
          <div style={styles.tallyMid}>
            <div style={{ color: 'rgba(245,240,232,0.3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.2)', marginTop: 2 }}>both days</div>
            <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.2)' }}>combined</div>
          </div>
          <div style={{ ...styles.tallyTeam, textAlign: 'right' }}>
            <div style={{ ...styles.tallyName, color: C.teal }}>Bum Bandits</div>
            <div style={{ ...styles.tallyScore, color: C.teal }}>{bTotal}</div>
            <div style={styles.tallyBreakdown}>D1: {bDay1} · D2: {bDay2}</div>
          </div>
        </div>

        {/* VIEW TABS */}
        <div style={styles.tabRow}>
          {[
            { id: 'pairs1', label: 'Pairs · Day 1' },
            { id: 'pairs2', label: 'Pairs · Day 2' },
            { id: 'individuals2', label: 'Individuals · Day 2' },
          ].map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              style={{ ...styles.tabBtn, ...(view === t.id ? styles.tabBtnActive : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div style={{ padding: '4px 8px 12px' }}>
          {view === 'pairs1' && <PairsList day={1} pairs={pairsRankingForDay(1, scoresByDay)} dayTeamA={aDay1} dayTeamB={bDay1} />}
          {view === 'pairs2' && <PairsList day={2} pairs={pairsRankingForDay(2, scoresByDay)} dayTeamA={aDay2} dayTeamB={bDay2} />}
          {view === 'individuals2' && <IndividualsList players={individualsRankingForDay(2, scoresByDay)} />}
        </div>

        {/* Day format reminder */}
        <div style={styles.dayHint}>
          {view === 'pairs1' && DAY_FORMAT[1]}
          {view === 'pairs2' && DAY_FORMAT[2]}
          {view === 'individuals2' && 'Individual Stableford · Day 2 only'}
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
  formatTag: { fontSize: 10, color: 'rgba(245,240,232,0.3)', fontStyle: 'italic', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 8 },
  tallyRow: { display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,0.2)', background: 'rgba(0,0,0,0.18)' },
  tallyTeam: { flex: 1 },
  tallyMid: { textAlign: 'center', flex: 0, minWidth: 70, fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  tallyName: { fontSize: 12, color: C.gold, marginBottom: 2, fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  tallyScore: { fontSize: 34, fontWeight: 'bold', lineHeight: 1 },
  tallyBreakdown: { fontSize: 9, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 4, letterSpacing: 0.5 },
  tabRow: { display: 'flex', gap: 0, padding: '10px 12px 6px', borderBottom: '1px solid rgba(245,240,232,0.05)' },
  tabBtn: { flex: 1, padding: '8px 4px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: 'rgba(245,240,232,0.4)', fontSize: 10, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5 },
  tabBtnActive: { color: C.gold, borderBottom: '2px solid #c9a84c' },
  dayBanner: { margin: '6px 8px 10px', padding: '12px 14px', background: 'rgba(0,0,0,0.28)', borderRadius: 3, border: '1px solid rgba(201,168,76,0.18)' },
  dayBannerLabel: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)', fontFamily: 'Helvetica Neue,Arial,sans-serif', textAlign: 'center', marginBottom: 8 },
  dayBannerRow: { display: 'flex', alignItems: 'center' },
  rankRow: { display: 'flex', alignItems: 'center', padding: '10px 14px', margin: '4px 8px', background: 'rgba(0,0,0,0.18)', borderRadius: 3, border: '1px solid rgba(245,240,232,0.05)' },
  medal: { fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 },
  rankNum: { fontSize: 13, color: 'rgba(245,240,232,0.4)', width: 24, textAlign: 'center', flexShrink: 0, fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  ptsBig: { fontSize: 22, fontWeight: 'bold', fontFamily: "Georgia,'Times New Roman',serif", lineHeight: 1 },
  ptsLbl: { fontSize: 9, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1, marginTop: 2 },
  emptyState: { textAlign: 'center', padding: '32px 20px', color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 12, fontStyle: 'italic' },
  dayHint: { textAlign: 'center', padding: '4px 16px 10px', fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic' },
  updateRow: { textAlign: 'center', padding: '6px 20px 12px', fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
};
