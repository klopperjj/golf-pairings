import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { PAR, STROKE_INDEX } from '../lib/gameData.js';
import { useEvent } from '../lib/eventContext.jsx';
import { betterBallPoints, stablefordPoints, computeFourBallMatchPlay, strokesOnHole, netScore } from '../lib/scoring.js';

// Lookup a player object by their player_index in a players array.
const findP = (players, idx) => players.find(p => p.index === idx);

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

// ── Helpers ───────────────────────────────────────────────────────────────────

// Better-ball: max of the two players' Stableford pts each hole (used for team A vs B match)
function pairBetterBallStableford(idx1, idx2, scoreLookup, players) {
  const p1 = findP(players, idx1), p2 = findP(players, idx2);
  if (!p1 || !p2) return { total: 0, holes: 0 };
  const s1 = scoreLookup[idx1] || {};
  const s2 = scoreLookup[idx2] || {};
  let total = 0, holes = 0;
  for (let h = 1; h <= 18; h++) {
    const g1 = s1[h], g2 = s2[h];
    if (g1 == null && g2 == null) continue;
    holes++;
    total += betterBallPoints(p1.playingHcp, g1, p2.playingHcp, g2, h);
  }
  return { total, holes };
}

// Aggregate: sum of both players' Stableford pts each hole (used for pair rankings)
function pairAggregateStableford(idx1, idx2, scoreLookup, players) {
  const a = playerStablefordTotal(idx1, scoreLookup, players);
  const b = playerStablefordTotal(idx2, scoreLookup, players);
  return { total: a.total + b.total, holes: Math.max(a.holes, b.holes) };
}

function playerStablefordTotal(idx, scoreLookup, players) {
  const p = findP(players, idx);
  if (!p) return { total: 0, holes: 0 };
  const s = scoreLookup[idx] || {};
  let total = 0, holes = 0;
  for (let h = 1; h <= 18; h++) {
    if (s[h] == null) continue;
    holes++;
    total += stablefordPoints(s[h], p.playingHcp, h);
  }
  return { total, holes };
}

// Team-vs-team uses better-ball (the cup format)
function teamDayTotal(day, team, scoresByDay, pairings, players) {
  const dayPairings = pairings.filter(p => p.day === day);
  return dayPairings.reduce((sum, p) => {
    const pair = team === 'A' ? p.teamA : p.teamB;
    return sum + pairBetterBallStableford(pair[0], pair[1], scoresByDay[day] || {}, players).total;
  }, 0);
}

// Pair rankings use aggregate (sum) Stableford
function pairsRankingForDay(day, scoresByDay, pairings, players, teamNames) {
  const dayPairings = pairings.filter(p => p.day === day);
  const list = [];
  dayPairings.forEach(p => {
    const a = pairAggregateStableford(p.teamA[0], p.teamA[1], scoresByDay[day] || {}, players);
    list.push({
      key: `${p.teeTime}-A`, team: 'A', teamLabel: teamNames.A, color: C.gold,
      names: p.teamA.map(i => findP(players, i)?.name.split(' ')[0] || ''),
      teeTime: p.teeTime, total: a.total, holes: a.holes,
    });
    const b = pairAggregateStableford(p.teamB[0], p.teamB[1], scoresByDay[day] || {}, players);
    list.push({
      key: `${p.teeTime}-B`, team: 'B', teamLabel: teamNames.B, color: C.teal,
      names: p.teamB.map(i => findP(players, i)?.name.split(' ')[0] || ''),
      teeTime: p.teeTime, total: b.total, holes: b.holes,
    });
  });
  return list.sort((x, y) => y.total - x.total || y.holes - x.holes);
}

function individualsRankingForDay(day, scoresByDay, players) {
  return players.map(p => {
    const { total, holes } = playerStablefordTotal(p.index, scoresByDay[day] || {}, players);
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

function DayTeamBanner({ day, aTotal, bTotal, teamNames }) {
  const diff = aTotal - bTotal;
  const status = diff === 0
    ? (aTotal === 0 ? 'No scores yet' : 'All Square')
    : diff > 0 ? `${teamNames.A} lead +${diff}` : `${teamNames.B} lead +${Math.abs(diff)}`;
  const statusColor = diff === 0 ? 'rgba(245,240,232,0.4)' : diff > 0 ? C.gold : C.teal;
  return (
    <div style={styles.dayBanner}>
      <div style={styles.dayBannerLabel}>Day {day} · Team Better-Ball Stableford</div>
      <div style={styles.dayBannerRow}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{teamNames.A}</div>
          <div style={{ fontSize: 24, color: C.gold, fontWeight: 'bold', lineHeight: 1, marginTop: 2 }}>{aTotal}<span style={{ fontSize: 10, marginLeft: 3, fontWeight: 'normal', opacity: 0.6 }}>pts</span></div>
        </div>
        <div style={{ flex: 0, minWidth: 110, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: statusColor, fontWeight: 'bold', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{status}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: C.teal, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{teamNames.B}</div>
          <div style={{ fontSize: 24, color: C.teal, fontWeight: 'bold', lineHeight: 1, marginTop: 2 }}>{bTotal}<span style={{ fontSize: 10, marginLeft: 3, fontWeight: 'normal', opacity: 0.6 }}>pts</span></div>
        </div>
      </div>
    </div>
  );
}

function PairsList({ pairs, dayTeamA, dayTeamB, day, teamNames }) {
  const hasScores = pairs.length && pairs.some(p => p.holes > 0);
  return (
    <div>
      <DayTeamBanner day={day} aTotal={dayTeamA} bTotal={dayTeamB} teamNames={teamNames} />
      {hasScores && (
        <div style={styles.subSectionLabel}>Pair Rankings · Aggregate Stableford</div>
      )}
      {!hasScores ? (
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

function IndividualsList({ players, teamNames }) {
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
                  {p.team === 'A' ? teamNames.A : teamNames.B}
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

function matchStatusText(holesUp, status, holesPlayed, holesRemaining, teamNames) {
  if (holesPlayed === 0) return 'Not started';
  const lead = Math.abs(holesUp);
  const winner = holesUp > 0 ? teamNames.A : teamNames.B;
  if (status === 'final') {
    if (holesUp === 0) return 'Halved';
    return `${lead} up · ${winner} won`;
  }
  if (status === 'closed') return `${lead}&${holesRemaining} · ${winner} won`;
  if (status === 'dormie') return `Dormie ${lead} · ${winner}`;
  if (holesUp === 0) return `All Square · thru ${holesPlayed}`;
  return `${lead} up ${winner} · thru ${holesPlayed}`;
}

function MatchPlayCard({ pairing, scoreLookup, players, teamNames }) {
  const findHcp = idx => findP(players, idx)?.playingHcp ?? 0;
  const teamAHcps = pairing.teamA.map(findHcp);
  const teamBHcps = pairing.teamB.map(findHcp);
  const teamAScores = pairing.teamA.map(i => scoreLookup[i] || {});
  const teamBScores = pairing.teamB.map(i => scoreLookup[i] || {});

  const { holes, teamAHolesUp, holesPlayed, holesRemaining, status } =
    computeFourBallMatchPlay(teamAScores, teamBScores, teamAHcps, teamBHcps);

  const namesOf = pair => pair.map(i => findP(players, i)?.name.split(' ')[0] || '').join(' & ');
  const teamANames = namesOf(pairing.teamA);
  const teamBNames = namesOf(pairing.teamB);

  const leadColor = teamAHolesUp > 0 ? C.gold : teamAHolesUp < 0 ? C.teal : 'rgba(245,240,232,0.5)';
  const statusText = matchStatusText(teamAHolesUp, status, holesPlayed, holesRemaining, teamNames);

  return (
    <div style={styles.mpCard}>
      <div style={styles.mpHeader}>
        <span style={{ fontSize: 11, color: C.gold, fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1 }}>{pairing.teeTime}</span>
        <span style={{ fontSize: 9, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', textTransform: 'uppercase', letterSpacing: 1 }}>
          {status === 'final' ? 'Final' : status === 'closed' ? 'Closed Out' : status === 'dormie' ? 'Dormie' : `Through ${holesPlayed}`}
        </span>
      </div>
      <div style={styles.mpMatchup}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: C.gold, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{teamNames.A}</div>
          <div style={{ fontSize: 12, color: C.text, marginTop: 2 }}>{teamANames}</div>
        </div>
        <div style={{ minWidth: 90, textAlign: 'center', padding: '0 8px' }}>
          <div style={{ fontSize: 11, color: leadColor, fontWeight: 'bold', fontFamily: 'Helvetica Neue,Arial,sans-serif', lineHeight: 1.3 }}>
            {statusText}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: C.teal, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{teamNames.B}</div>
          <div style={{ fontSize: 12, color: C.text, marginTop: 2 }}>{teamBNames}</div>
        </div>
      </div>
      {holesPlayed > 0 && (
        <div style={styles.mpHoleStrip}>
          {holes.map(h => {
            const bg = h.winner === 'A' ? 'rgba(201,168,76,0.45)'
              : h.winner === 'B' ? 'rgba(78,207,176,0.4)'
              : h.winner === 'H' ? 'rgba(245,240,232,0.12)'
              : 'rgba(0,0,0,0.18)';
            const label = h.winner === 'A' ? 'A' : h.winner === 'B' ? 'B' : h.winner === 'H' ? '½' : '';
            return (
              <div key={h.hole} style={{ ...styles.mpHoleCell, background: bg }} title={`Hole ${h.hole}`}>
                <div style={{ fontSize: 7, color: 'rgba(245,240,232,0.5)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{h.hole}</div>
                <div style={{ fontSize: 9, fontWeight: 'bold', color: 'rgba(245,240,232,0.85)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatchPlayList({ scoresByDay, pairings, players, teamNames, dayCount }) {
  return (
    <div>
      {Array.from({ length: dayCount }, (_, i) => i + 1).map(day => {
        const dayPairings = pairings.filter(p => p.day === day);
        return (
          <div key={day} style={{ marginBottom: 14 }}>
            <div style={styles.mpDayLabel}>Day {day}</div>
            {dayPairings.map((p, i) => (
              <MatchPlayCard
                key={`${day}-${i}`}
                pairing={p}
                scoreLookup={scoresByDay[day] || {}}
                players={players}
                teamNames={teamNames}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ScorecardView({ player, scoresByDay, players, teamNames, event, dayCount }) {
  const initialIdx = player?.player_index ?? (players[0]?.index ?? 0);
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [day, setDay] = useState(() => {
    if (!event?.start_date) return 1;
    const start = new Date(event.start_date);
    const day2 = new Date(start); day2.setDate(start.getDate() + 1);
    const today = new Date();
    return today.toDateString() === day2.toDateString() ? 2 : 1;
  });

  const p = findP(players, selectedIdx) || players[0];
  if (!p) return <div style={styles.emptyState}>No players for this event.</div>;
  const dayScores = scoresByDay[day]?.[selectedIdx] || {};
  const teamColor = p.team === 'A' ? C.gold : C.teal;

  // Compute per-hole metrics
  const rows = Array.from({ length: 18 }, (_, i) => {
    const h = i + 1;
    const par = PAR[h];
    const si = STROKE_INDEX[h];
    const stk = strokesOnHole(p.playingHcp, h);
    const gross = dayScores[h];
    if (gross == null) return { h, par, si, stk, gross: null, net: null, pts: 0, diff: null };
    const net = netScore(gross, p.playingHcp, h);
    const pts = stablefordPoints(gross, p.playingHcp, h);
    return { h, par, si, stk, gross, net, pts, diff: gross - par };
  });

  const front = rows.slice(0, 9);
  const back = rows.slice(9, 18);
  const sum = (rs, key) => rs.reduce((a, r) => a + (r[key] ?? 0), 0);
  const sumIfPlayed = (rs, key) => rs.filter(r => r.gross != null).reduce((a, r) => a + r[key], 0);
  const playedFront = front.filter(r => r.gross != null).length;
  const playedBack = back.filter(r => r.gross != null).length;

  function colorForDiff(diff) {
    if (diff == null) return 'rgba(245,240,232,0.2)';
    if (diff <= -1) return '#6ad35d';
    if (diff === 0) return C.gold;
    if (diff === 1) return 'rgba(245,240,232,0.6)';
    return 'rgba(220,100,100,0.85)';
  }

  return (
    <div>
      {/* Player picker — by team */}
      <div style={styles.scTeamGroup}>
        <div style={{ ...styles.scTeamLabel, color: C.gold }}>{teamNames.A}</div>
        <div style={styles.scPickerRow}>
          {players.filter(pl => pl.team === 'A').map(pl => (
            <button key={pl.index} onClick={() => setSelectedIdx(pl.index)}
              style={{ ...styles.scPill, ...(selectedIdx === pl.index ? { ...styles.scPillActive, borderColor: C.gold, color: C.gold } : {}) }}>
              {pl.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.scTeamGroup}>
        <div style={{ ...styles.scTeamLabel, color: C.teal }}>{teamNames.B}</div>
        <div style={styles.scPickerRow}>
          {players.filter(pl => pl.team === 'B').map(pl => (
            <button key={pl.index} onClick={() => setSelectedIdx(pl.index)}
              style={{ ...styles.scPill, ...(selectedIdx === pl.index ? { ...styles.scPillActive, borderColor: C.teal, color: C.teal } : {}) }}>
              {pl.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Day toggle */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '8px 12px 4px', flexWrap: 'wrap' }}>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
          <button key={d} onClick={() => setDay(d)}
            style={{
              padding: '5px 16px', borderRadius: 2,
              border: '1px solid rgba(201,168,76,0.3)',
              background: day === d ? 'rgba(201,168,76,0.18)' : 'transparent',
              color: day === d ? C.gold : 'rgba(245,240,232,0.45)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
            }}>
            Day {d}
          </button>
        ))}
      </div>

      {/* Player header */}
      <div style={styles.scPlayerHeader}>
        <div>
          <div style={{ fontSize: 16, color: C.text }}>{p.name}</div>
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 2 }}>
            <span style={{ color: teamColor }}>{p.team === 'A' ? teamNames.A : teamNames.B}</span>
            <span> · Course HCP {p.courseHcp} · Playing {p.playingHcp}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, color: teamColor, fontWeight: 'bold', lineHeight: 1 }}>
            {sumIfPlayed(rows, 'pts')}
            <span style={{ fontSize: 10, marginLeft: 3, fontWeight: 'normal', opacity: 0.6 }}>pts</span>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 3 }}>
            {playedFront + playedBack}/18 holes
          </div>
        </div>
      </div>

      {/* Scorecard table */}
      <div style={{ padding: '8px 8px 4px' }}>
        <table style={styles.scTable}>
          <thead>
            <tr style={styles.scHeadRow}>
              <th style={styles.scTh}>H</th>
              <th style={styles.scTh}>Par</th>
              <th style={styles.scTh}>SI</th>
              <th style={styles.scTh}>+</th>
              <th style={{ ...styles.scTh, textAlign: 'right' }}>Gross</th>
              <th style={{ ...styles.scTh, textAlign: 'right' }}>Net</th>
              <th style={{ ...styles.scTh, textAlign: 'right' }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {front.map(r => (
              <tr key={r.h} style={styles.scTr}>
                <td style={styles.scTd}>{r.h}</td>
                <td style={styles.scTd}>{r.par}</td>
                <td style={styles.scTd}>{r.si}</td>
                <td style={styles.scTd}>{r.stk > 0 ? r.stk : ''}</td>
                <td style={{ ...styles.scTd, textAlign: 'right', color: colorForDiff(r.diff), fontWeight: r.gross != null ? 'bold' : 'normal' }}>{r.gross ?? '–'}</td>
                <td style={{ ...styles.scTd, textAlign: 'right', color: 'rgba(245,240,232,0.55)' }}>{r.net ?? '–'}</td>
                <td style={{ ...styles.scTd, textAlign: 'right', color: r.pts >= 3 ? '#6ad35d' : r.pts === 0 && r.gross != null ? 'rgba(220,100,100,0.6)' : C.gold, fontWeight: 'bold' }}>{r.gross != null ? r.pts : ''}</td>
              </tr>
            ))}
            <tr style={styles.scSumRow}>
              <td style={styles.scTd} colSpan={4}>OUT</td>
              <td style={{ ...styles.scTd, textAlign: 'right', color: C.gold }}>{playedFront > 0 ? sumIfPlayed(front, 'gross') : '–'}</td>
              <td style={styles.scTd}></td>
              <td style={{ ...styles.scTd, textAlign: 'right', color: C.gold, fontWeight: 'bold' }}>{sumIfPlayed(front, 'pts')}</td>
            </tr>
            {back.map(r => (
              <tr key={r.h} style={styles.scTr}>
                <td style={styles.scTd}>{r.h}</td>
                <td style={styles.scTd}>{r.par}</td>
                <td style={styles.scTd}>{r.si}</td>
                <td style={styles.scTd}>{r.stk > 0 ? r.stk : ''}</td>
                <td style={{ ...styles.scTd, textAlign: 'right', color: colorForDiff(r.diff), fontWeight: r.gross != null ? 'bold' : 'normal' }}>{r.gross ?? '–'}</td>
                <td style={{ ...styles.scTd, textAlign: 'right', color: 'rgba(245,240,232,0.55)' }}>{r.net ?? '–'}</td>
                <td style={{ ...styles.scTd, textAlign: 'right', color: r.pts >= 3 ? '#6ad35d' : r.pts === 0 && r.gross != null ? 'rgba(220,100,100,0.6)' : C.gold, fontWeight: 'bold' }}>{r.gross != null ? r.pts : ''}</td>
              </tr>
            ))}
            <tr style={styles.scSumRow}>
              <td style={styles.scTd} colSpan={4}>IN</td>
              <td style={{ ...styles.scTd, textAlign: 'right', color: C.gold }}>{playedBack > 0 ? sumIfPlayed(back, 'gross') : '–'}</td>
              <td style={styles.scTd}></td>
              <td style={{ ...styles.scTd, textAlign: 'right', color: C.gold, fontWeight: 'bold' }}>{sumIfPlayed(back, 'pts')}</td>
            </tr>
            <tr style={styles.scTotalRow}>
              <td style={styles.scTd} colSpan={4}>TOTAL</td>
              <td style={{ ...styles.scTd, textAlign: 'right', color: C.text }}>{(playedFront + playedBack) > 0 ? sumIfPlayed(rows, 'gross') : '–'}</td>
              <td style={styles.scTd}></td>
              <td style={{ ...styles.scTd, textAlign: 'right', color: teamColor, fontWeight: 'bold' }}>{sumIfPlayed(rows, 'pts')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ padding: '4px 12px 10px', fontSize: 9, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', textAlign: 'center', fontStyle: 'italic' }}>
        Gross = strokes taken · Net = gross − strokes received · Pts = Stableford (max(0, 2 + par − net))
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage({ player }) {
  const { event, eventId, players, pairings, dayFormat, teamNames, hcpAllowance, isArchived, dayCount } = useEvent();

  // Default view: day 2 if today is on/after the second day, else day 1
  const defaultView = (() => {
    if (!event?.start_date) return 'pairs1';
    const start = new Date(event.start_date);
    const day2 = new Date(start); day2.setDate(start.getDate() + 1);
    const today = new Date();
    return today >= day2 ? 'pairs2' : 'pairs1';
  })();

  const [view, setView] = useState(defaultView);
  const [scoresByDay, setScoresByDay] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  async function loadAllScores() {
    if (!eventId) return;
    const { data } = await supabase
      .from('scores')
      .select('player_index, hole_number, gross_score, round_day')
      .eq('event_id', eventId);
    if (!data) return;
    const byDay = {};
    for (let d = 1; d <= dayCount; d++) byDay[d] = {};
    for (const row of data) {
      const d = row.round_day;
      if (!byDay[d]) byDay[d] = {};
      if (!byDay[d][row.player_index]) byDay[d][row.player_index] = {};
      byDay[d][row.player_index][row.hole_number] = row.gross_score;
    }
    setScoresByDay(byDay);
    setLastUpdate(new Date());
  }

  useEffect(() => { loadAllScores(); }, [eventId, dayCount]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`leaderboard-live-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `event_id=eq.${eventId}` },
        () => loadAllScores())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [eventId]);

  // Cumulative across all days
  const dayTotals = {};
  for (let d = 1; d <= dayCount; d++) {
    dayTotals[`a${d}`] = teamDayTotal(d, 'A', scoresByDay, pairings, players);
    dayTotals[`b${d}`] = teamDayTotal(d, 'B', scoresByDay, pairings, players);
  }
  const aDay1 = dayTotals.a1 || 0, aDay2 = dayTotals.a2 || 0;
  const bDay1 = dayTotals.b1 || 0, bDay2 = dayTotals.b2 || 0;
  const aTotal = Object.keys(dayTotals).filter(k => k.startsWith('a')).reduce((s, k) => s + dayTotals[k], 0);
  const bTotal = Object.keys(dayTotals).filter(k => k.startsWith('b')).reduce((s, k) => s + dayTotals[k], 0);

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
          <div style={styles.eyebrow}>Live Leaderboard · {event?.short_name || event?.name || ''}</div>
          <div style={styles.title}>🏆 The Match</div>
          <div style={styles.formatTag}>Four-Ball Better Ball Stableford · {hcpAllowance}% allowance</div>
          {isArchived && <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(245,240,232,0.5)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>🗄 Archived event</div>}
        </div>

        {/* CUMULATIVE TEAM TOTAL — both days combined */}
        <div style={styles.tallyRow}>
          <div style={styles.tallyTeam}>
            <div style={styles.tallyName}>{teamNames.A}</div>
            <div style={{ ...styles.tallyScore, color: C.gold }}>{aTotal}</div>
            <div style={styles.tallyBreakdown}>
              {Array.from({ length: dayCount }, (_, i) => `D${i+1}: ${dayTotals[`a${i+1}`] || 0}`).join(' · ')}
            </div>
          </div>
          <div style={styles.tallyMid}>
            <div style={{ color: 'rgba(245,240,232,0.3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.2)', marginTop: 2 }}>both days</div>
            <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.2)' }}>combined</div>
          </div>
          <div style={{ ...styles.tallyTeam, textAlign: 'right' }}>
            <div style={{ ...styles.tallyName, color: C.teal }}>{teamNames.B}</div>
            <div style={{ ...styles.tallyScore, color: C.teal }}>{bTotal}</div>
            <div style={styles.tallyBreakdown}>
              {Array.from({ length: dayCount }, (_, i) => `D${i+1}: ${dayTotals[`b${i+1}`] || 0}`).join(' · ')}
            </div>
          </div>
        </div>

        {/* VIEW TABS */}
        <div style={styles.tabRow}>
          {[
            { id: 'pairs1', label: 'Pairs · D1' },
            { id: 'pairs2', label: 'Pairs · D2' },
            { id: 'matchplay', label: 'Match Play' },
            { id: 'individuals2', label: 'Indiv · D2' },
            { id: 'cards', label: 'Cards' },
          ].map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              style={{ ...styles.tabBtn, ...(view === t.id ? styles.tabBtnActive : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div style={{ padding: '4px 8px 12px' }}>
          {view === 'pairs1' && <PairsList day={1} pairs={pairsRankingForDay(1, scoresByDay, pairings, players, teamNames)} dayTeamA={aDay1} dayTeamB={bDay1} teamNames={teamNames} />}
          {view === 'pairs2' && <PairsList day={2} pairs={pairsRankingForDay(2, scoresByDay, pairings, players, teamNames)} dayTeamA={aDay2} dayTeamB={bDay2} teamNames={teamNames} />}
          {view === 'matchplay' && <MatchPlayList scoresByDay={scoresByDay} pairings={pairings} players={players} teamNames={teamNames} dayCount={dayCount} />}
          {view === 'individuals2' && <IndividualsList players={individualsRankingForDay(dayCount, scoresByDay, players)} teamNames={teamNames} />}
          {view === 'cards' && <ScorecardView player={player} scoresByDay={scoresByDay} players={players} teamNames={teamNames} event={event} dayCount={dayCount} />}
        </div>

        {/* Day format reminder */}
        <div style={styles.dayHint}>
          {view === 'pairs1' && (dayFormat[1] || '')}
          {view === 'pairs2' && (dayFormat[2] || '')}
          {view === 'matchplay' && 'Four-Ball Better-Ball Match Play · per fourball, all days'}
          {view === 'individuals2' && `Individual Stableford · Day ${dayCount}`}
          {view === 'cards' && 'Full hole-by-hole scorecard · any player, any day'}
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
  subSectionLabel: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(201,168,76,0.5)', fontFamily: 'Helvetica Neue,Arial,sans-serif', textAlign: 'center', padding: '12px 8px 4px', borderTop: '1px solid rgba(245,240,232,0.04)', marginTop: 6 },
  dayBanner: { margin: '6px 8px 10px', padding: '12px 14px', background: 'rgba(0,0,0,0.28)', borderRadius: 3, border: '1px solid rgba(201,168,76,0.18)' },
  dayBannerLabel: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)', fontFamily: 'Helvetica Neue,Arial,sans-serif', textAlign: 'center', marginBottom: 8 },
  dayBannerRow: { display: 'flex', alignItems: 'center' },
  rankRow: { display: 'flex', alignItems: 'center', padding: '10px 14px', margin: '4px 8px', background: 'rgba(0,0,0,0.18)', borderRadius: 3, border: '1px solid rgba(245,240,232,0.05)' },
  mpDayLabel: { fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(201,168,76,0.55)', fontFamily: 'Helvetica Neue,Arial,sans-serif', padding: '8px 14px 4px', textAlign: 'center', borderTop: '1px solid rgba(201,168,76,0.1)' },
  mpCard: { margin: '6px 8px', background: 'rgba(0,0,0,0.22)', borderRadius: 3, border: '1px solid rgba(245,240,232,0.05)', overflow: 'hidden' },
  mpHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(0,0,0,0.18)', borderBottom: '1px solid rgba(245,240,232,0.05)' },
  mpMatchup: { display: 'flex', alignItems: 'center', padding: '10px 12px' },
  mpHoleStrip: { display: 'flex', flexWrap: 'wrap', gap: 2, padding: '6px 8px 10px', borderTop: '1px solid rgba(245,240,232,0.04)' },
  mpHoleCell: { width: 22, height: 26, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  scTeamGroup: { padding: '4px 8px 0' },
  scTeamLabel: { fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 4, opacity: 0.7 },
  scPickerRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  scPill: { padding: '4px 10px', fontSize: 11, borderRadius: 3, border: '1px solid rgba(245,240,232,0.15)', background: 'rgba(0,0,0,0.18)', color: 'rgba(245,240,232,0.55)', cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  scPillActive: { background: 'rgba(0,0,0,0.35)', fontWeight: 'bold' },
  scPlayerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', margin: '6px 8px 4px', background: 'rgba(0,0,0,0.22)', borderRadius: 3, border: '1px solid rgba(201,168,76,0.15)' },
  scTable: { width: '100%', borderCollapse: 'collapse', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  scHeadRow: { background: 'rgba(0,0,0,0.3)' },
  scTh: { fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(201,168,76,0.65)', padding: '6px 4px', textAlign: 'left', borderBottom: '1px solid rgba(201,168,76,0.2)' },
  scTr: { borderBottom: '1px solid rgba(245,240,232,0.04)' },
  scSumRow: { background: 'rgba(0,0,0,0.18)', fontSize: 11, fontWeight: 'bold', borderTop: '1px solid rgba(201,168,76,0.18)', borderBottom: '1px solid rgba(201,168,76,0.18)' },
  scTotalRow: { background: 'rgba(201,168,76,0.08)', fontSize: 12, fontWeight: 'bold', borderTop: '2px solid rgba(201,168,76,0.4)' },
  scTd: { padding: '6px 4px', fontSize: 11, color: 'rgba(245,240,232,0.7)' },
  medal: { fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 },
  rankNum: { fontSize: 13, color: 'rgba(245,240,232,0.4)', width: 24, textAlign: 'center', flexShrink: 0, fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  ptsBig: { fontSize: 22, fontWeight: 'bold', fontFamily: "Georgia,'Times New Roman',serif", lineHeight: 1 },
  ptsLbl: { fontSize: 9, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1, marginTop: 2 },
  emptyState: { textAlign: 'center', padding: '32px 20px', color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 12, fontStyle: 'italic' },
  dayHint: { textAlign: 'center', padding: '4px 16px 10px', fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic' },
  updateRow: { textAlign: 'center', padding: '6px 20px 12px', fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
};
