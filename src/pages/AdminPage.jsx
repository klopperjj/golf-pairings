import { useState, useEffect } from 'react';
import { PLAYERS, PAR } from '../lib/gameData.js';
import { stablefordPoints, strokesOnHole } from '../lib/scoring.js';
import { supabase } from '../lib/supabase.js';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

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
  const [roundDay, setRoundDay] = useState(1);
  const [scores, setScores] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

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

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setMsg('');
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
      setMsg('✓ Saved');
      setTimeout(() => { setEditing(null); setMsg(''); }, 700);
    } catch (err) {
      setMsg(`✗ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Access guard — server also enforces this
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
          <div style={{ color: C.gold, fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 6 }}>Admin · Score Editor</div>
          <div style={{ color: C.text, fontSize: 20, marginBottom: 4 }}>Score Management</div>
          <div style={{ color: 'rgba(245,240,232,0.3)', fontSize: 11, fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic' }}>Tap any score cell to edit · Changes save immediately</div>
        </div>

        {/* Day selector */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {[1, 2].map(d => (
            <button key={d} onClick={() => setRoundDay(d)} style={{
              padding: '7px 20px', borderRadius: 2, border: '1px solid rgba(201,168,76,0.3)',
              background: roundDay === d ? 'rgba(201,168,76,0.15)' : 'transparent',
              color: roundDay === d ? C.gold : 'rgba(245,240,232,0.4)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5,
            }}>
              Day {d} · {d === 1 ? 'Thu' : 'Fri'}
            </button>
          ))}
          <button onClick={loadScores} style={{
            padding: '7px 14px', borderRadius: 2, border: '1px solid rgba(245,240,232,0.12)',
            background: 'transparent', color: 'rgba(245,240,232,0.3)', fontSize: 11,
            cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
          }}>↻ Refresh</button>
        </div>

        {/* Score grid */}
        <div style={{ background: C.green, borderRadius: 3, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: 'rgba(201,168,76,0.5)', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', minWidth: 120, position: 'sticky', left: 0, background: C.green, zIndex: 1 }}>
                    Player
                  </th>
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
                    <tr key={`header-${team}`}>
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
                            const bg = diff == null ? 'transparent'
                              : diff <= -1 ? 'rgba(106,211,93,0.12)'
                              : diff === 0 ? 'rgba(201,168,76,0.08)'
                              : diff === 1 ? 'transparent'
                              : 'rgba(220,100,100,0.1)';
                            return (
                              <td key={h}
                                onClick={() => setEditing({ playerIndex: p.index, playerName: p.name, playingHcp: p.playingHcp, hole: h, gross: gross ?? PAR[h] })}
                                style={{ textAlign: 'center', padding: '4px 2px', cursor: 'pointer', background: bg, transition: 'background 0.15s' }}
                                title={`Edit ${p.name} Hole ${h}`}>
                                <span style={{ fontSize: 12, color: scoreColor(diff), fontWeight: gross != null ? '600' : 'normal' }}>
                                  {gross ?? '·'}
                                </span>
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
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setEditing(null); setMsg(''); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: C.green, borderRadius: 3, padding: 28, width: '100%', maxWidth: 300, boxShadow: '0 24px 80px rgba(0,0,0,0.7)', border: '1px solid rgba(201,168,76,0.2)' }}>

            {/* Modal header */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ color: C.gold, fontSize: 13, fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 2 }}>{editing.playerName}</div>
              <div style={{ color: 'rgba(245,240,232,0.4)', fontSize: 11, fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                Hole {editing.hole} · Par {PAR[editing.hole]} · SI {editing.playingHcp}
              </div>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
              <button
                onClick={() => setEditing(e => ({ ...e, gross: Math.max(1, e.gross - 1) }))}
                style={{ width: 48, height: 52, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 3, color: C.gold, fontSize: 26, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>−</button>
              <div style={{ textAlign: 'center', minWidth: 60 }}>
                <div style={{ fontSize: 38, color: scoreColor(editing.gross - PAR[editing.hole]), fontFamily: "Georgia,'Times New Roman',serif", lineHeight: 1 }}>
                  {editing.gross}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: scoreColor(editing.gross - PAR[editing.hole]), opacity: 0.8, marginTop: 3, letterSpacing: 0.5 }}>
                  {scoreName(editing.gross - PAR[editing.hole])}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: C.gold, marginTop: 4 }}>
                  {stablefordPoints(editing.gross, editing.playingHcp, editing.hole)}pts
                </div>
              </div>
              <button
                onClick={() => setEditing(e => ({ ...e, gross: Math.min(15, e.gross + 1) }))}
                style={{ width: 48, height: 52, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 3, color: C.gold, fontSize: 26, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>+</button>
            </div>

            {msg && (
              <div style={{ textAlign: 'center', fontSize: 12, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: msg.startsWith('✓') ? '#6ad35d' : 'rgba(220,100,100,0.9)', marginBottom: 14 }}>
                {msg}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setEditing(null); setMsg(''); }} style={{
                flex: 1, padding: 11, background: 'transparent', border: '1px solid rgba(245,240,232,0.15)',
                borderRadius: 3, color: 'rgba(245,240,232,0.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
              }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{
                flex: 2, padding: 11, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.5)',
                borderRadius: 3, color: C.gold, fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5,
              }}>{saving ? 'Saving…' : 'Save Score'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
