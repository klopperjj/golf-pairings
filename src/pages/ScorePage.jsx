import { useState, useEffect } from 'react';
import { PAR, STROKE_INDEX } from '../lib/gameData.js';
import { useEvent } from '../lib/eventContext.jsx';
import { strokesOnHole, stablefordPoints } from '../lib/scoring.js';
import { supabase } from '../lib/supabase.js';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

function scoreLabelColor(diff) {
  if (diff <= -1) return '#6ad35d';
  if (diff === 0) return C.gold;
  if (diff === 1) return 'rgba(245,240,232,0.6)';
  return 'rgba(220,100,100,0.85)';
}
function scoreLabel(diff) {
  if (diff <= -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double';
  return `+${diff}`;
}

export default function ScorePage({ player, token, onLogout }) {
  const { event, eventId, players: eventPlayers, pairings, dayFormat, teamNames, isReadOnly, dayCount } = useEvent();

  // Default day: if today is on or after the second day, default to day 2; else day 1
  const defaultDay = (() => {
    if (!event?.start_date) return 1;
    const start = new Date(event.start_date);
    const day2 = new Date(start); day2.setDate(start.getDate() + 1);
    const today = new Date();
    return today.toDateString() === day2.toDateString() ? 2 : 1;
  })();

  const [roundDay, setRoundDay] = useState(defaultDay);
  const [currentHole, setCurrentHole] = useState(1);
  const [holeScores, setHoleScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [approvals, setApprovals] = useState([]); // player_index[]
  const [approving, setApproving] = useState(false);

  // Find pairing for this player in this event
  const pairing = pairings.find(p =>
    p.day === roundDay &&
    (p.teamA.includes(player.player_index) || p.teamB.includes(player.player_index))
  );

  const playerByIdx = (idx) => eventPlayers.find(p => p.index === idx);
  const teamAPlayers = pairing ? pairing.teamA.map(playerByIdx).filter(Boolean) : [];
  const teamBPlayers = pairing ? pairing.teamB.map(playerByIdx).filter(Boolean) : [];
  const allFourIndices = pairing ? [...pairing.teamA, ...pairing.teamB] : [];

  // Load existing scores
  useEffect(() => {
    if (!pairing || !eventId) return;
    supabase
      .from('scores')
      .select('player_index, hole_number, gross_score')
      .eq('event_id', eventId)
      .eq('round_day', roundDay)
      .in('player_index', allFourIndices)
      .then(({ data }) => {
        if (!data) return;
        const lookup = {};
        data.forEach(row => {
          if (!lookup[row.hole_number]) lookup[row.hole_number] = {};
          lookup[row.hole_number][row.player_index] = row.gross_score;
        });
        setHoleScores(lookup);
      });
  }, [eventId, roundDay, pairing?.teeTime]);

  // Load approvals
  useEffect(() => {
    if (!pairing || !eventId) return;
    supabase
      .from('approvals')
      .select('player_index')
      .eq('event_id', eventId)
      .eq('round_day', roundDay)
      .eq('tee_time', pairing.teeTime)
      .then(({ data }) => {
        if (data) setApprovals(data.map(a => a.player_index));
      });
  }, [eventId, roundDay, pairing?.teeTime]);

  // Real-time scores (filtered to this event)
  useEffect(() => {
    if (!eventId) return;
    const ch = supabase
      .channel(`scores-live-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `event_id=eq.${eventId}` },
        payload => {
          const row = payload.new;
          if (!row) return;
          setHoleScores(prev => ({
            ...prev,
            [row.hole_number]: { ...(prev[row.hole_number] || {}), [row.player_index]: row.gross_score },
          }));
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [eventId]);

  // Real-time approvals (filtered to this event)
  useEffect(() => {
    if (!pairing || !eventId) return;
    const ch = supabase
      .channel(`approvals-live-${eventId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'approvals', filter: `event_id=eq.${eventId}` },
        payload => {
          const row = payload.new;
          if (row?.round_day === roundDay && row?.tee_time === pairing.teeTime) {
            setApprovals(prev => [...new Set([...prev, row.player_index])]);
          }
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [eventId, roundDay, pairing?.teeTime]);

  function setScore(hole, playerIndex, gross) {
    setHoleScores(prev => ({
      ...prev,
      [hole]: { ...(prev[hole] || {}), [playerIndex]: gross },
    }));
  }

  function resetHole() {
    setHoleScores(prev => {
      const updated = { ...prev };
      const cleared = { ...(updated[currentHole] || {}) };
      allFourIndices.forEach(idx => { delete cleared[idx]; });
      updated[currentHole] = cleared;
      return updated;
    });
  }

  async function saveHole() {
    if (!pairing) return;
    setSaving(true);
    setSaveMsg('');
    const par = PAR[currentHole];
    try {
      const res = await fetch('/api/scores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          roundDay,
          holeNumber: currentHole,
          scores: allFourIndices.map(idx => ({
            playerIndex: idx,
            grossScore: holeScores[currentHole]?.[idx] ?? par,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaveMsg(`✓ Hole ${currentHole} saved`);
      if (currentHole < 18) setTimeout(() => { setCurrentHole(h => h + 1); setSaveMsg(''); }, 800);
    } catch (err) {
      setSaveMsg(`✗ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function approveScorecard() {
    setApproving(true);
    try {
      const res = await fetch('/api/scores/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roundDay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApprovals(data.approvedBy || []);
    } catch (err) {
      console.error(err);
    } finally {
      setApproving(false);
    }
  }

  const par = PAR[currentHole];

  if (!pairing) {
    return (
      <div style={{ ...S.page, alignItems: 'center', justifyContent: 'center' }}>
        <div style={S.card}>
          <div style={S.goldBar} />
          <div style={{ padding: 32, textAlign: 'center', color: 'rgba(245,240,232,0.55)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
            No pairing found for Day {roundDay}.<br />Contact Juan.
          </div>
        </div>
      </div>
    );
  }

  // Approval state
  const teamAApproved = pairing.teamA.some(i => approvals.includes(i));
  const teamBApproved = pairing.teamB.some(i => approvals.includes(i));
  const fullyApproved = teamAApproved && teamBApproved;
  const iHaveApproved = approvals.includes(player.player_index);
  const myTeam = pairing.teamA.includes(player.player_index) ? 'A' : 'B';

  // Hole completion
  const holes18 = Array.from({ length: 18 }, (_, i) => i + 1);
  const holesComplete = holes18.filter(h => allFourIndices.every(idx => holeScores[h]?.[idx] != null)).length;

  // Running Stableford totals
  const { pairPts, oppPts, holesWithScores } = (() => {
    let a = 0, b = 0, count = 0;
    holes18.forEach(h => {
      const aScores = pairing.teamA.map(idx => holeScores[h]?.[idx]).filter(g => g != null);
      const bScores = pairing.teamB.map(idx => holeScores[h]?.[idx]).filter(g => g != null);
      if (!aScores.length && !bScores.length) return;
      count++;
      a += Math.max(0, ...pairing.teamA.map(idx => {
        const pl = playerByIdx(idx);
        return holeScores[h]?.[idx] != null && pl ? stablefordPoints(holeScores[h][idx], pl.playingHcp, h) : 0;
      }));
      b += Math.max(0, ...pairing.teamB.map(idx => {
        const pl = playerByIdx(idx);
        return holeScores[h]?.[idx] != null && pl ? stablefordPoints(holeScores[h][idx], pl.playingHcp, h) : 0;
      }));
    });
    return { pairPts: a, oppPts: b, holesWithScores: count };
  })();

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.goldBar} />

        {/* Header */}
        <div style={S.header}>
          <div style={S.eyebrow}>{event?.name || 'Golf Pairings'}</div>
          <div style={S.title}>Score Entry</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
              <button key={d} onClick={() => { setRoundDay(d); setCurrentHole(1); }}
                style={{ ...S.dayBtn, ...(roundDay === d ? S.dayBtnActive : {}) }}>
                Day {d}
              </button>
            ))}
          </div>
          <div style={S.formatTag}>{dayFormat[roundDay] || ''}</div>
          {isReadOnly && <div style={S.archivedTag}>🗄 Archived event · read-only</div>}
        </div>

        {/* Cumulative Stableford scoreboard */}
        {holesWithScores > 0 && (() => {
          const diff = pairPts - oppPts;
          const statusText = diff === 0 ? 'All Square' : diff > 0 ? `${teamNames.A} +${diff}` : `${teamNames.B} +${Math.abs(diff)}`;
          const statusColor = diff === 0 ? 'rgba(245,240,232,0.45)' : diff > 0 ? C.gold : C.teal;
          return (
            <div style={{ padding: '8px 20px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(245,240,232,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 9, color: C.gold, fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1, opacity: 0.7 }}>{teamNames.A}</div>
                <div style={{ fontSize: 18, color: C.gold, fontFamily: "Georgia,'Times New Roman',serif" }}>{pairPts}<span style={{ fontSize: 10, marginLeft: 2 }}>pts</span></div>
              </div>
              <div style={{ textAlign: 'center', flex: 1.2 }}>
                <div style={{ fontSize: 8, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>{holesWithScores} holes</div>
                <div style={{ fontSize: 11, color: statusColor, fontFamily: 'Helvetica Neue,Arial,sans-serif', fontWeight: 'bold' }}>{statusText}</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 9, color: C.teal, fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1, opacity: 0.7 }}>{teamNames.B}</div>
                <div style={{ fontSize: 18, color: C.teal, fontFamily: "Georgia,'Times New Roman',serif" }}>{oppPts}<span style={{ fontSize: 10, marginLeft: 2 }}>pts</span></div>
              </div>
            </div>
          );
        })()}

        {/* Hole selector */}
        <div style={S.holeNav}>
          <button style={S.navBtn} onClick={() => setCurrentHole(h => Math.max(1, h - 1))} disabled={currentHole === 1}>‹</button>
          <div style={S.holeBadge}>
            <div style={S.holeNum}>Hole {currentHole}</div>
            <div style={S.holeMeta}>Par {par} · SI {STROKE_INDEX[currentHole]}</div>
          </div>
          <button style={S.navBtn} onClick={() => setCurrentHole(h => Math.min(18, h + 1))} disabled={currentHole === 18}>›</button>
        </div>

        {/* Score entry — both teams, all 4 players editable */}
        {[
          { label: teamNames.A, color: C.gold, players: teamAPlayers },
          { label: teamNames.B, color: C.teal,  players: teamBPlayers },
        ].map(({ label, color, players }) => (
          <div key={label} style={{ ...S.section, borderBottom: '1px solid rgba(245,240,232,0.07)' }}>
            <div style={{ ...S.sectionLabel, color: `${color}88` }}>{label}</div>
            {players.map(p => {
              const gross = holeScores[currentHole]?.[p.index] ?? par;
              const isDefault = holeScores[currentHole]?.[p.index] == null;
              const strokes = strokesOnHole(p.playingHcp, currentHole);
              const pts = stablefordPoints(gross, p.playingHcp, currentHole);
              const diff = gross - par;
              const col = isDefault ? 'rgba(245,240,232,0.25)' : scoreLabelColor(diff);
              return (
                <div key={p.index} style={{ ...S.scoreRow, marginBottom: 14 }}>
                  <div>
                    <div style={S.scoreName}>{p.name}</div>
                    <span style={S.strokeBadge}>+{strokes} stroke{strokes !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <button style={S.stepBtn} onClick={() => setScore(currentHole, p.index, Math.max(1, gross - 1))}>−</button>
                    <div style={{ width: 56, textAlign: 'center' }}>
                      <div style={{ fontSize: 26, color: col, fontFamily: "Georgia,'Times New Roman',serif", lineHeight: 1 }}>{gross}</div>
                      <div style={{ fontSize: 9, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: col, marginTop: 2, letterSpacing: 0.5 }}>{scoreLabel(diff)}</div>
                    </div>
                    <button style={S.stepBtn} onClick={() => setScore(currentHole, p.index, Math.min(15, gross + 1))}>+</button>
                    <div style={{ ...S.ptsTag, color: pts >= 3 ? '#6ad35d' : pts === 0 ? 'rgba(245,240,232,0.2)' : C.gold, opacity: isDefault ? 0.4 : 1 }}>
                      {pts}pt{pts !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Save / Reset */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={resetHole} style={S.resetBtn}>↺ Reset</button>
            <button onClick={saveHole} disabled={saving || isReadOnly} style={{ ...S.saveBtn, flex: 1, marginTop: 0, opacity: isReadOnly ? 0.4 : 1, cursor: isReadOnly ? 'default' : 'pointer' }}>
              {isReadOnly ? '🗄 Archived — read-only' : saving ? 'Saving…' : `Save Hole ${currentHole}`}
            </button>
          </div>
          {saveMsg && (
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: saveMsg.startsWith('✓') ? '#6ad35d' : 'rgba(220,100,100,0.9)' }}>
              {saveMsg}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div style={S.progressRow}>
          {holes18.map(h => {
            const entered = allFourIndices.every(idx => holeScores[h]?.[idx] != null);
            const partial = !entered && allFourIndices.some(idx => holeScores[h]?.[idx] != null);
            return (
              <div key={h} onClick={() => setCurrentHole(h)} style={{
                ...S.dot,
                background: h === currentHole ? C.gold : entered ? 'rgba(201,168,76,0.45)' : partial ? 'rgba(201,168,76,0.2)' : 'rgba(245,240,232,0.1)',
                cursor: 'pointer',
              }} title={`Hole ${h}`} />
            );
          })}
        </div>
        <div style={{ textAlign: 'center', fontSize: 9, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: 'rgba(245,240,232,0.2)', marginTop: 2, marginBottom: 8 }}>
          {holesComplete}/18 holes complete
        </div>

        {/* ── Scorecard Approval — only after all 18 holes are entered ── */}
        <div style={{ margin: '0 24px 24px', background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '14px 16px', border: `1px solid ${fullyApproved ? 'rgba(106,211,93,0.3)' : holesComplete === 18 ? 'rgba(201,168,76,0.3)' : 'rgba(245,240,232,0.08)'}` }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', color: 'rgba(201,168,76,0.5)', marginBottom: 10 }}>
            End-of-Round Scorecard Approval
          </div>

          {holesComplete < 18 ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 18, opacity: 0.4 }}>🔒</div>
              <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 6 }}>
                Locked until all 18 holes are entered
              </div>
              <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 4, fontStyle: 'italic' }}>
                {holesComplete}/18 holes complete · {18 - holesComplete} to go
              </div>
            </div>
          ) : fullyApproved ? (
            <div style={{ textAlign: 'center', padding: '6px 0' }}>
              <div style={{ fontSize: 20 }}>✅</div>
              <div style={{ fontSize: 13, color: '#6ad35d', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 4 }}>Scorecard finalised</div>
              <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 2, fontStyle: 'italic' }}>Both teams have approved</div>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(106,211,93,0.7)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 10 }}>
                ✓ Round complete — ready to certify
              </div>

              {/* Team approval rows */}
              {[
                { team: 'A', label: teamNames.A, color: C.gold, players: pairing.teamA },
                { team: 'B', label: teamNames.B, color: C.teal, players: pairing.teamB },
              ].map(({ team, label, color, players }) => {
                const approved = players.some(i => approvals.includes(i));
                const approvedName = approved
                  ? (playerByIdx(players.find(i => approvals.includes(i)))?.name.split(' ')[0] || '')
                  : null;
                return (
                  <div key={team} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 10, color, fontFamily: 'Helvetica Neue,Arial,sans-serif', opacity: 0.7 }}>{label}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: approved ? '#6ad35d' : 'rgba(245,240,232,0.3)' }}>
                        {approved ? `✓ ${approvedName} approved` : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Approve button for current player */}
              {iHaveApproved ? (
                <div style={{ textAlign: 'center', marginTop: 4, fontSize: 11, color: '#6ad35d', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                  ✓ You have approved · waiting for {myTeam === 'A' ? teamNames.B : teamNames.A}
                </div>
              ) : (
                <button onClick={approveScorecard} disabled={approving || isReadOnly} style={{
                  width: '100%', marginTop: 6,
                  background: 'rgba(106,211,93,0.12)', border: '1px solid rgba(106,211,93,0.35)',
                  borderRadius: 3, color: '#6ad35d', fontSize: 13, padding: '10px 0',
                  cursor: isReadOnly ? 'default' : 'pointer', fontFamily: "Georgia,'Times New Roman',serif", letterSpacing: 0.5,
                  opacity: isReadOnly ? 0.4 : 1,
                }}>
                  {isReadOnly ? '🗄 Read-only' : approving ? 'Approving…' : '✓ Approve Full Scorecard'}
                </button>
              )}

              <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(245,240,232,0.2)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic', textAlign: 'center' }}>
                One certification covers all 18 holes · at least one player from each team must approve
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '0 24px 12px', textAlign: 'center' }}>
          <button onClick={onLogout} style={S.logoutBtn}>Sign Out</button>
        </div>
        <div style={S.goldBar} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: { background: C.darkGreen, minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '20px 16px', fontFamily: "Georgia,'Times New Roman',serif" },
  card: { background: C.green, width: '100%', maxWidth: 480, borderRadius: 3, color: C.text, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' },
  goldBar: { height: 5, background: 'linear-gradient(90deg,#a07830,#c9a84c,#e8c96a,#c9a84c,#a07830)' },
  header: { padding: '20px 24px 14px', textAlign: 'center', borderBottom: '1px solid rgba(201,168,76,0.3)' },
  eyebrow: { color: C.gold, fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 6 },
  title: { fontSize: 20, fontWeight: 'normal' },
  dayBtn: { padding: '5px 14px', borderRadius: 2, border: '1px solid rgba(201,168,76,0.25)', background: 'transparent', color: 'rgba(245,240,232,0.45)', fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  dayBtnActive: { background: 'rgba(201,168,76,0.15)', color: C.gold, borderColor: 'rgba(201,168,76,0.5)' },
  formatTag: { fontSize: 10, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic', marginTop: 6 },
  archivedTag: { fontSize: 10, color: 'rgba(245,240,232,0.5)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 6, padding: '4px 8px', background: 'rgba(245,240,232,0.06)', border: '1px solid rgba(245,240,232,0.15)', borderRadius: 2, display: 'inline-block', letterSpacing: 1 },
  holeNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(245,240,232,0.07)' },
  navBtn: { background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.2)', color: C.gold, width: 36, height: 36, borderRadius: 3, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  holeBadge: { textAlign: 'center' },
  holeNum: { fontSize: 20, color: C.gold },
  holeMeta: { fontSize: 11, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  section: { padding: '10px 20px' },
  sectionLabel: { fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 10 },
  scoreRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  scoreName: { fontSize: 13, color: C.text },
  strokeBadge: { fontSize: 9, fontFamily: 'Helvetica Neue,Arial,sans-serif', padding: '1px 5px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, color: 'rgba(201,168,76,0.7)' },
  stepBtn: { width: 40, height: 48, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 3, color: C.gold, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Helvetica Neue,Arial,sans-serif', userSelect: 'none' },
  ptsTag: { fontSize: 11, fontFamily: 'Helvetica Neue,Arial,sans-serif', minWidth: 36, textAlign: 'right' },
  saveBtn: { width: '100%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.5)', borderRadius: 3, color: C.gold, fontSize: 14, padding: 12, cursor: 'pointer', fontFamily: "Georgia,'Times New Roman',serif", letterSpacing: 1, marginTop: 4 },
  resetBtn: { background: 'rgba(245,240,232,0.05)', border: '1px solid rgba(245,240,232,0.15)', borderRadius: 3, color: 'rgba(245,240,232,0.4)', fontSize: 12, padding: '12px 14px', cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 4, whiteSpace: 'nowrap' },
  progressRow: { display: 'flex', flexWrap: 'wrap', gap: 4, padding: '10px 20px 4px', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: '50%', transition: 'background 0.2s' },
  logoutBtn: { background: 'transparent', border: 'none', color: 'rgba(245,240,232,0.22)', fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1 },
};
