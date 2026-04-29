import { useState, useEffect } from 'react';
import { PLAYERS, PAR } from '../lib/gameData.js';
import { stablefordPoints } from '../lib/scoring.js';
import { supabase } from '../lib/supabase.js';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

function ResetBlock({ label, subtitle, day, confirmKey, setConfirm, onConfirm, resetting, danger }) {
  const isConfirming = confirmKey === day;
  const borderColor = danger ? 'rgba(220,60,60,0.4)' : 'rgba(220,60,60,0.25)';
  const btnBg = isConfirming
    ? (danger ? 'rgba(220,60,60,0.3)' : 'rgba(220,60,60,0.2)')
    : 'rgba(220,60,60,0.08)';
  const btnColor = isConfirming ? 'rgba(255,120,120,0.95)' : 'rgba(220,100,100,0.7)';
  return (
    <div style={{ background: C.green, border: `1px solid ${borderColor}`, borderRadius: 3, padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.8)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{label}</div>
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic', marginTop: 2 }}>{subtitle}</div>
        </div>
        <button
          disabled={resetting}
          onClick={() => {
            if (!isConfirming) { setConfirm(day); }
            else { onConfirm(); }
          }}
          style={{
            padding: '9px 16px', borderRadius: 3, border: `1px solid ${borderColor}`,
            background: btnBg, color: btnColor,
            fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
            whiteSpace: 'nowrap', minWidth: 140, textAlign: 'center',
          }}>
          {resetting && isConfirming ? 'Resetting…' : isConfirming ? '⚠️ Tap again to confirm' : '🗑 Reset Scores'}
        </button>
      </div>
      {isConfirming && (
        <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(220,100,100,0.6)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic' }}>
          This will permanently delete all scores{day !== 'all' ? ` for Day ${day}` : ' for the entire tournament'} and all approvals. Tap the button again to confirm, or switch tabs to cancel.
        </div>
      )}
    </div>
  );
}

function scoreName(diff) {
  if (diff <= -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double';
  return `+${diff}`;
}
function scoreColor(diff) {
  if (diff == null) return 'rgba(245,240,232,0.15)';
  if (diff <= -1) return '#6ad35d';
  if (diff === 0) return C.gold;
  if (diff === 1) return 'rgba(245,240,232,0.55)';
  return 'rgba(220,100,100,0.85)';
}

export default function AdminPage({ player, token }) {
  const [tab, setTab] = useState('scores');

  // ── Scores tab state ──────────────────────────────────────
  const [roundDay, setRoundDay] = useState(1);
  const [scores, setScores] = useState({});
  const [editing, setEditing] = useState(null);
  const [savingScore, setSavingScore] = useState(false);
  const [scoreMsg, setScoreMsg] = useState('');

  // ── Handicaps tab state ───────────────────────────────────
  const [dbPlayers, setDbPlayers] = useState([]);
  const [allowance, setAllowance] = useState(85);
  const [hcpEdits, setHcpEdits] = useState({});
  const [savingHcp, setSavingHcp] = useState(null);

  // ── Reset tab state ───────────────────────────────────────
  const [resetConfirm, setResetConfirm] = useState(null); // null | '1' | '2' | 'all'
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [hcpMsgs, setHcpMsgs] = useState({});       // { playerIndex: '✓ Saved' | '✗ ...' }

  // ── Load scores ───────────────────────────────────────────
  useEffect(() => { loadScores(); }, [roundDay]);

  async function loadScores() {
    const { data } = await supabase
      .from('scores')
      .select('player_index, hole_number, gross_score')
      .eq('round_day', roundDay);
    if (!data) return;
    const lookup = {};
    data.forEach(row => {
      if (!lookup[row.player_index]) lookup[row.player_index] = {};
      lookup[row.player_index][row.hole_number] = row.gross_score;
    });
    setScores(lookup);
  }

  // ── Load players (handicaps tab) ──────────────────────────
  useEffect(() => {
    supabase
      .from('players')
      .select('player_index, name, team, course_hcp, playing_hcp')
      .order('player_index')
      .then(({ data }) => {
        if (!data) return;
        setDbPlayers(data);
        const edits = {};
        data.forEach(p => {
          edits[p.player_index] = { courseHcp: p.course_hcp, playingHcp: p.playing_hcp };
        });
        setHcpEdits(edits);
        // Infer current allowance from first player with course_hcp > 0
        const sample = data.find(p => p.course_hcp > 0);
        if (sample) {
          const inferred = Math.round((sample.playing_hcp / sample.course_hcp) * 100);
          if (!isNaN(inferred) && inferred > 0) setAllowance(inferred);
        }
      });
  }, []);

  // Recompute all playing_hcps when allowance changes
  function applyAllowance(pct) {
    setAllowance(pct);
    setHcpEdits(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(idx => {
        next[idx] = {
          ...next[idx],
          playingHcp: Math.round(next[idx].courseHcp * pct / 100),
        };
      });
      return next;
    });
  }

  function setCourseHcp(playerIndex, val) {
    const courseHcp = Math.max(0, Math.min(54, parseInt(val) || 0));
    const playingHcp = Math.round(courseHcp * allowance / 100);
    setHcpEdits(prev => ({ ...prev, [playerIndex]: { courseHcp, playingHcp } }));
  }

  function setPlayingHcp(playerIndex, val) {
    const playingHcp = Math.max(0, Math.min(54, parseInt(val) || 0));
    setHcpEdits(prev => ({ ...prev, [playerIndex]: { ...prev[playerIndex], playingHcp } }));
  }

  async function saveHcp(playerIndex) {
    const edit = hcpEdits[playerIndex];
    if (!edit) return;
    setSavingHcp(playerIndex);
    setHcpMsgs(prev => ({ ...prev, [playerIndex]: '' }));
    try {
      const res = await fetch('/api/admin/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ playerIndex, courseHcp: edit.courseHcp, playingHcp: edit.playingHcp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHcpMsgs(prev => ({ ...prev, [playerIndex]: '✓' }));
      setTimeout(() => setHcpMsgs(prev => ({ ...prev, [playerIndex]: '' })), 2000);
    } catch (err) {
      setHcpMsgs(prev => ({ ...prev, [playerIndex]: `✗ ${err.message}` }));
    } finally {
      setSavingHcp(null);
    }
  }

  async function saveAllHcps() {
    for (const p of dbPlayers) {
      await saveHcp(p.player_index);
    }
  }

  // ── Reset scoreboard ──────────────────────────────────────
  async function doReset(roundDay) {
    setResetting(true);
    setResetMsg('');
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roundDay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetMsg(`✓ ${data.message}`);
      setResetConfirm(null);
      if (roundDay === 'all' || roundDay === roundDay) loadScores();
    } catch (err) {
      setResetMsg(`✗ ${err.message}`);
    } finally {
      setResetting(false);
    }
  }

  // ── Score editing ─────────────────────────────────────────
  async function saveEdit() {
    if (!editing) return;
    setSavingScore(true);
    setScoreMsg('');
    try {
      const res = await fetch('/api/admin/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          roundDay,
          holeNumber: editing.hole,
          playerIndex: editing.playerIndex,
          grossScore: editing.gross,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScores(prev => ({
        ...prev,
        [editing.playerIndex]: { ...(prev[editing.playerIndex] || {}), [editing.hole]: editing.gross },
      }));
      setScoreMsg('✓ Saved');
      setTimeout(() => { setEditing(null); setScoreMsg(''); }, 700);
    } catch (err) {
      setScoreMsg(`✗ ${err.message}`);
    } finally {
      setSavingScore(false);
    }
  }

  // ── Access guard ──────────────────────────────────────────
  if (!player || player.player_index !== 0) {
    return (
      <div style={{ background: C.darkGreen, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 13 }}>Access denied.</div>
      </div>
    );
  }

  const holes = Array.from({ length: 18 }, (_, i) => i + 1);

  return (
    <div style={{ background: C.darkGreen, minHeight: '100vh', padding: '20px 12px', fontFamily: "Georgia,'Times New Roman',serif" }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ color: C.gold, fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 6 }}>Admin · Stellenbosch Invitational 2026</div>
          <div style={{ color: C.text, fontSize: 20 }}>Tournament Management</div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', marginBottom: 20, background: 'rgba(0,0,0,0.25)', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(201,168,76,0.25)' }}>
          {[
            ['scores',    '⛳', 'Scores'],
            ['handicaps', '📋', 'Handicaps'],
            ['reset',     '⚠️', 'Reset'],
          ].map(([key, icon, label]) => {
            const active = tab === key;
            const isReset = key === 'reset';
            return (
              <button key={key} onClick={() => { setTab(key); setResetConfirm(null); setResetMsg(''); }} style={{
                flex: 1, padding: '13px 6px', border: 'none', cursor: 'pointer',
                background: active ? (isReset ? 'rgba(220,60,60,0.15)' : 'rgba(201,168,76,0.15)') : 'transparent',
                color: active ? (isReset ? 'rgba(220,100,100,0.95)' : C.gold) : 'rgba(245,240,232,0.4)',
                fontSize: 11, fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.3,
                borderBottom: active ? `2px solid ${isReset ? 'rgba(220,60,60,0.7)' : C.gold}` : '2px solid transparent',
                borderRight: key !== 'reset' ? '1px solid rgba(201,168,76,0.1)' : 'none',
                transition: 'all 0.15s', lineHeight: 1.3,
              }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
                <div>{label}</div>
              </button>
            );
          })}
        </div>

        {/* ══════════════ SCORES TAB ══════════════ */}
        {tab === 'scores' && (
          <>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
              {[1, 2].map(d => (
                <button key={d} onClick={() => setRoundDay(d)} style={{
                  padding: '7px 20px', borderRadius: 2, border: '1px solid rgba(201,168,76,0.3)',
                  background: roundDay === d ? 'rgba(201,168,76,0.15)' : 'transparent',
                  color: roundDay === d ? C.gold : 'rgba(245,240,232,0.4)',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
                }}>Day {d} · {d === 1 ? 'Thu' : 'Fri'}</button>
              ))}
              <button onClick={loadScores} style={{
                padding: '7px 14px', borderRadius: 2, border: '1px solid rgba(245,240,232,0.12)',
                background: 'transparent', color: 'rgba(245,240,232,0.3)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
              }}>↻ Refresh</button>
            </div>

            <div style={{ background: C.green, borderRadius: 3, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: 'rgba(201,168,76,0.5)', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', minWidth: 120, position: 'sticky', left: 0, background: C.green, zIndex: 1 }}>Player</th>
                      {holes.map(h => (
                        <th key={h} style={{ padding: '6px 2px', textAlign: 'center', minWidth: 30 }}>
                          <div style={{ color: 'rgba(245,240,232,0.4)', fontSize: 10 }}>{h}</div>
                          <div style={{ color: 'rgba(245,240,232,0.18)', fontSize: 8 }}>p{PAR[h]}</div>
                        </th>
                      ))}
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: 'rgba(245,240,232,0.3)', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', minWidth: 50 }}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['A', 'B'].map(team => (
                      <>
                        <tr key={`hdr-${team}`}>
                          <td colSpan={20} style={{ padding: '6px 12px 3px', background: 'rgba(0,0,0,0.15)' }}>
                            <span style={{ fontSize: 8, letterSpacing: 2.5, textTransform: 'uppercase', color: team === 'A' ? 'rgba(201,168,76,0.5)' : 'rgba(78,207,176,0.5)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                              {team === 'A' ? 'The A Holes' : 'Bum Bandits'}
                            </span>
                          </td>
                        </tr>
                        {PLAYERS.filter(p => p.team === team).map(p => {
                          const totalPts = holes.reduce((sum, h) => {
                            const g = scores[p.index]?.[h];
                            return sum + (g != null ? stablefordPoints(g, p.playingHcp, h) : 0);
                          }, 0);
                          const holesEntered = holes.filter(h => scores[p.index]?.[h] != null).length;
                          return (
                            <tr key={p.index} style={{ borderTop: '1px solid rgba(245,240,232,0.04)' }}>
                              <td style={{ padding: '7px 12px', position: 'sticky', left: 0, background: C.green, zIndex: 1, whiteSpace: 'nowrap' }}>
                                <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.8)' }}>{p.name.split(' ')[0]} <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 10 }}>{p.name.split(' ').slice(1).join(' ')}</span></div>
                                <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.3)', marginTop: 1 }}>hcp {p.playingHcp} · {holesEntered}/18</div>
                              </td>
                              {holes.map(h => {
                                const gross = scores[p.index]?.[h];
                                const diff = gross != null ? gross - PAR[h] : null;
                                const bg = diff == null ? 'transparent' : diff <= -1 ? 'rgba(106,211,93,0.12)' : diff === 0 ? 'rgba(201,168,76,0.08)' : diff === 1 ? 'transparent' : 'rgba(220,100,100,0.1)';
                                return (
                                  <td key={h}
                                    onClick={() => setEditing({ playerIndex: p.index, playerName: p.name, playingHcp: p.playingHcp, hole: h, gross: gross ?? PAR[h] })}
                                    style={{ textAlign: 'center', padding: '4px 2px', cursor: 'pointer', background: bg }}
                                    title={`Edit ${p.name} Hole ${h}`}>
                                    <span style={{ fontSize: 12, color: scoreColor(diff), fontWeight: gross != null ? '600' : 'normal' }}>{gross ?? '·'}</span>
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: 'center', padding: '4px 8px' }}>
                                <span style={{ fontSize: 12, color: C.gold, fontWeight: 'bold' }}>{holesEntered > 0 ? totalPts : '—'}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[['#6ad35d', 'Birdie or better'], [C.gold, 'Par'], ['rgba(245,240,232,0.5)', 'Bogey'], ['rgba(220,100,100,0.85)', 'Double+']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 10, color: 'rgba(245,240,232,0.35)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══════════════ HANDICAPS TAB ══════════════ */}
        {tab === 'handicaps' && (
          <>
            {/* Allowance control */}
            <div style={{ background: C.green, borderRadius: 3, padding: '16px 20px', marginBottom: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 8, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(201,168,76,0.55)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 6 }}>Handicap Allowance</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min={50} max={100} value={allowance}
                      onChange={e => applyAllowance(parseInt(e.target.value) || 85)}
                      style={{ width: 64, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 3, color: C.gold, fontSize: 18, textAlign: 'center', fontFamily: "Georgia,'Times New Roman',serif", outline: 'none' }}
                    />
                    <span style={{ color: 'rgba(245,240,232,0.5)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 18 }}>%</span>
                  </div>
                </div>
                <div style={{ flex: 1, fontSize: 11, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic', lineHeight: 1.5 }}>
                  Changing the allowance recalculates all playing handicaps automatically.<br />
                  Playing HCP = <span style={{ color: C.gold }}>round(Course HCP × {allowance}%)</span>. Save All to apply to database.
                </div>
                <button onClick={saveAllHcps} style={{
                  padding: '10px 20px', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.5)',
                  borderRadius: 3, color: C.gold, fontSize: 12, cursor: 'pointer',
                  fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5, whiteSpace: 'nowrap',
                }}>Save All Players</button>
              </div>
            </div>

            {/* Player handicap table */}
            <div style={{ background: C.green, borderRadius: 3, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              {['A', 'B'].map(team => (
                <div key={team}>
                  <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(245,240,232,0.05)' }}>
                    <span style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', color: team === 'A' ? 'rgba(201,168,76,0.55)' : 'rgba(78,207,176,0.55)' }}>
                      {team === 'A' ? 'The A Holes' : 'Bum Bandits'}
                    </span>
                  </div>
                  {dbPlayers.filter(p => p.team === team).map((p, i) => {
                    const edit = hcpEdits[p.player_index] ?? { courseHcp: p.course_hcp, playingHcp: p.playing_hcp };
                    const msg = hcpMsgs[p.player_index];
                    const isSaving = savingHcp === p.player_index;
                    const changed = edit.courseHcp !== p.course_hcp || edit.playingHcp !== p.playing_hcp;
                    return (
                      <div key={p.player_index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i === 0 ? 'none' : '1px solid rgba(245,240,232,0.05)', flexWrap: 'wrap' }}>

                        {/* Name */}
                        <div style={{ minWidth: 140, flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.85)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{p.name}</div>
                          <div style={{ fontSize: 9, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 1 }}>
                            {team === 'A' ? 'A Holes' : 'Bum Bandits'}
                          </div>
                        </div>

                        {/* Course HCP */}
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 4 }}>Course HCP</div>
                          <input
                            type="number" min={0} max={54}
                            value={edit.courseHcp}
                            onChange={e => setCourseHcp(p.player_index, e.target.value)}
                            style={{ width: 56, padding: '6px 4px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(245,240,232,0.15)', borderRadius: 3, color: C.text, fontSize: 16, textAlign: 'center', fontFamily: "Georgia,'Times New Roman',serif", outline: 'none' }}
                          />
                        </div>

                        {/* Arrow */}
                        <div style={{ color: 'rgba(245,240,232,0.2)', fontSize: 16, paddingTop: 14 }}>→</div>

                        {/* Playing HCP */}
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(201,168,76,0.5)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 4 }}>Playing HCP</div>
                          <input
                            type="number" min={0} max={54}
                            value={edit.playingHcp}
                            onChange={e => setPlayingHcp(p.player_index, e.target.value)}
                            style={{ width: 56, padding: '6px 4px', background: 'rgba(0,0,0,0.25)', border: `1px solid rgba(201,168,76,${changed ? '0.5' : '0.2'})`, borderRadius: 3, color: C.gold, fontSize: 16, textAlign: 'center', fontFamily: "Georgia,'Times New Roman',serif", outline: 'none' }}
                          />
                        </div>

                        {/* Allowance display */}
                        <div style={{ textAlign: 'center', minWidth: 44 }}>
                          <div style={{ fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(245,240,232,0.25)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 4 }}>Allow.</div>
                          <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.4)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                            {edit.courseHcp > 0 ? Math.round((edit.playingHcp / edit.courseHcp) * 100) : '—'}%
                          </div>
                        </div>

                        {/* Save button + status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => saveHcp(p.player_index)} disabled={isSaving} style={{
                            padding: '8px 16px', borderRadius: 3,
                            background: changed ? 'rgba(201,168,76,0.15)' : 'rgba(0,0,0,0.15)',
                            border: `1px solid ${changed ? 'rgba(201,168,76,0.45)' : 'rgba(245,240,232,0.1)'}`,
                            color: changed ? C.gold : 'rgba(245,240,232,0.3)',
                            fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
                            whiteSpace: 'nowrap',
                          }}>{isSaving ? 'Saving…' : 'Save'}</button>
                          {msg && (
                            <span style={{ fontSize: 11, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: msg.startsWith('✓') ? '#6ad35d' : 'rgba(220,100,100,0.9)' }}>{msg}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, textAlign: 'center', fontSize: 10, color: 'rgba(245,240,232,0.25)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic' }}>
              Playing HCP inputs highlighted in gold when unsaved changes are pending
            </div>
          </>
        )}

        {/* ══════════════ RESET TAB ══════════════ */}
        {tab === 'reset' && (
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            {/* Warning banner */}
            <div style={{ background: 'rgba(220,60,60,0.1)', border: '1px solid rgba(220,60,60,0.3)', borderRadius: 3, padding: '14px 16px', marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>⚠️</div>
              <div style={{ color: 'rgba(220,100,100,0.9)', fontSize: 13, fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 4 }}>Danger Zone</div>
              <div style={{ color: 'rgba(245,240,232,0.4)', fontSize: 11, fontFamily: 'Helvetica Neue,Arial,sans-serif', lineHeight: 1.5, fontStyle: 'italic' }}>
                Resetting scores permanently deletes all hole entries and approvals. This cannot be undone.
              </div>
            </div>

            {/* Reset Day 1 */}
            <ResetBlock
              label="Day 1 · Thursday"
              subtitle="Scramble Drive — Four-Ball Better Ball"
              day="1"
              confirmKey={resetConfirm}
              setConfirm={setResetConfirm}
              onConfirm={() => doReset(1)}
              resetting={resetting}
            />

            {/* Reset Day 2 */}
            <ResetBlock
              label="Day 2 · Friday"
              subtitle="Normal Play — Four-Ball Better Ball"
              day="2"
              confirmKey={resetConfirm}
              setConfirm={setResetConfirm}
              onConfirm={() => doReset(2)}
              resetting={resetting}
            />

            {/* Reset All */}
            <ResetBlock
              label="Reset Entire Tournament"
              subtitle="Clears all scores — both days"
              day="all"
              confirmKey={resetConfirm}
              setConfirm={setResetConfirm}
              onConfirm={() => doReset('all')}
              resetting={resetting}
              danger
            />

            {resetMsg && (
              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: resetMsg.startsWith('✓') ? '#6ad35d' : 'rgba(220,100,100,0.9)', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 3 }}>
                {resetMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════ SCORE EDIT MODAL ══════════════ */}
      {editing && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setEditing(null); setScoreMsg(''); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: C.green, borderRadius: 3, padding: 28, width: '100%', maxWidth: 300, boxShadow: '0 24px 80px rgba(0,0,0,0.7)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ color: C.gold, fontSize: 13, fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 2 }}>{editing.playerName}</div>
              <div style={{ color: 'rgba(245,240,232,0.4)', fontSize: 11, fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                Hole {editing.hole} · Par {PAR[editing.hole]}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
              <button onClick={() => setEditing(e => ({ ...e, gross: Math.max(1, e.gross - 1) })}
              } style={{ width: 48, height: 52, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 3, color: C.gold, fontSize: 26, cursor: 'pointer' }}>−</button>
              <div style={{ textAlign: 'center', minWidth: 60 }}>
                <div style={{ fontSize: 38, color: scoreColor(editing.gross - PAR[editing.hole]), fontFamily: "Georgia,'Times New Roman',serif", lineHeight: 1 }}>{editing.gross}</div>
                <div style={{ fontSize: 10, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: scoreColor(editing.gross - PAR[editing.hole]), opacity: 0.8, marginTop: 3 }}>
                  {scoreName(editing.gross - PAR[editing.hole])}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: C.gold, marginTop: 4 }}>
                  {stablefordPoints(editing.gross, editing.playingHcp, editing.hole)}pts
                </div>
              </div>
              <button onClick={() => setEditing(e => ({ ...e, gross: Math.min(15, e.gross + 1) }))} style={{ width: 48, height: 52, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 3, color: C.gold, fontSize: 26, cursor: 'pointer' }}>+</button>
            </div>
            {scoreMsg && <div style={{ textAlign: 'center', fontSize: 12, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: scoreMsg.startsWith('✓') ? '#6ad35d' : 'rgba(220,100,100,0.9)', marginBottom: 14 }}>{scoreMsg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setEditing(null); setScoreMsg(''); }} style={{ flex: 1, padding: 11, background: 'transparent', border: '1px solid rgba(245,240,232,0.15)', borderRadius: 3, color: 'rgba(245,240,232,0.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>Cancel</button>
              <button onClick={saveEdit} disabled={savingScore} style={{ flex: 2, padding: 11, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.5)', borderRadius: 3, color: C.gold, fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                {savingScore ? 'Saving…' : 'Save Score'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
