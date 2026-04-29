import { useState, useEffect } from 'react';
import { PAIRINGS, PLAYERS, PAR, STROKE_INDEX, DAY_FORMAT } from '../lib/gameData.js';
import { strokesOnHole, stablefordPoints } from '../lib/scoring.js';
import { supabase } from '../lib/supabase.js';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

export default function ScorePage({ player, token, onLogout }) {
  // Determine current round day (1 = Thursday, 2 = Friday)
  const today = new Date();
  const apr30 = new Date('2026-04-30');
  const may1  = new Date('2026-05-01');
  const defaultDay = today.toDateString() === may1.toDateString() ? 2 : 1;

  const [roundDay, setRoundDay] = useState(defaultDay);
  const [currentHole, setCurrentHole] = useState(1);
  const [holeScores, setHoleScores] = useState({}); // { hole: { playerIndex: gross } }
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [existingScores, setExistingScores] = useState({});

  // Find the pairing for this player on this round day
  const pairing = PAIRINGS.find(p =>
    p.day === roundDay &&
    (p.teamA.includes(player.player_index) || p.teamB.includes(player.player_index))
  );

  const isTeamA = pairing?.teamA.includes(player.player_index);
  const pairIndices = pairing ? (isTeamA ? pairing.teamA : pairing.teamB) : [];
  const oppIndices  = pairing ? (isTeamA ? pairing.teamB : pairing.teamA) : [];
  const pairPlayers = pairIndices.map(i => PLAYERS[i]);
  const oppPlayers  = oppIndices.map(i => PLAYERS[i]);

  // Load existing scores from Supabase
  useEffect(() => {
    if (!pairing) return;
    const allIndices = [...pairIndices, ...oppIndices];

    supabase
      .from('scores')
      .select('player_index, hole_number, gross_score')
      .eq('round_day', roundDay)
      .in('player_index', allIndices)
      .then(({ data }) => {
        if (!data) return;
        const lookup = {};
        data.forEach(row => {
          if (!lookup[row.hole_number]) lookup[row.hole_number] = {};
          lookup[row.hole_number][row.player_index] = row.gross_score;
        });
        setExistingScores(lookup);
        setHoleScores(lookup);
      });
  }, [roundDay, pairing]);

  // Real-time subscription for score updates
  useEffect(() => {
    const channel = supabase
      .channel('scores-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, payload => {
        const row = payload.new;
        if (!row) return;
        setHoleScores(prev => ({
          ...prev,
          [row.hole_number]: {
            ...(prev[row.hole_number] || {}),
            [row.player_index]: row.gross_score,
          },
        }));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  function setScore(hole, playerIndex, value) {
    const gross = parseInt(value) || null;
    setHoleScores(prev => ({
      ...prev,
      [hole]: { ...(prev[hole] || {}), [playerIndex]: gross },
    }));
  }

  async function saveHole() {
    if (!pairing) return;
    setSaving(true);
    setSaveMsg('');

    const scores = pairIndices
      .map(idx => ({ playerIndex: idx, grossScore: holeScores[currentHole]?.[idx] }))
      .filter(s => s.grossScore != null && s.grossScore > 0);

    if (scores.length === 0) {
      setSaveMsg('Enter at least one score first');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/scores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roundDay, holeNumber: currentHole, scores }),
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

  const par = PAR[currentHole];
  const si  = STROKE_INDEX[currentHole];

  if (!pairing) {
    return (
      <div style={{ ...styles.page, alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.card}>
          <div style={styles.goldBar} />
          <div style={{ padding: 32, textAlign: 'center', color: 'rgba(245,240,232,0.55)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
            No pairing found for Day {roundDay}.<br />Contact Juan.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.goldBar} />

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.eyebrow}>Stellenbosch Invitational · 2026</div>
          <div style={styles.title}>Score Entry</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            {[1, 2].map(d => (
              <button key={d} onClick={() => { setRoundDay(d); setCurrentHole(1); }}
                style={{ ...styles.dayBtn, ...(roundDay === d ? styles.dayBtnActive : {}) }}>
                Day {d} · {d === 1 ? 'Thu' : 'Fri'}
              </button>
            ))}
          </div>
          <div style={styles.formatTag}>{DAY_FORMAT[roundDay]}</div>
        </div>

        {/* Match info */}
        <div style={styles.matchRow}>
          <div style={styles.teamBlock}>
            <div style={styles.teamLabel}>The A Holes</div>
            {(isTeamA ? pairPlayers : oppPlayers).map(p => (
              <div key={p.index} style={styles.playerName}>
                {p.name} <span style={styles.hcpTag}>({p.playingHcp})</span>
              </div>
            ))}
          </div>
          <div style={styles.vsText}>vs</div>
          <div style={{ ...styles.teamBlock, textAlign: 'right' }}>
            <div style={{ ...styles.teamLabel, color: C.teal }}>Bum Bandits</div>
            {(isTeamA ? oppPlayers : pairPlayers).map(p => (
              <div key={p.index} style={styles.playerName}>
                {p.name} <span style={styles.hcpTag}>({p.playingHcp})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hole selector */}
        <div style={styles.holeNav}>
          <button style={styles.navBtn} onClick={() => setCurrentHole(h => Math.max(1, h - 1))} disabled={currentHole === 1}>‹</button>
          <div style={styles.holeBadge}>
            <div style={styles.holeNum}>Hole {currentHole}</div>
            <div style={styles.holeMeta}>Par {par} · SI {si}</div>
          </div>
          <button style={styles.navBtn} onClick={() => setCurrentHole(h => Math.min(18, h + 1))} disabled={currentHole === 18}>›</button>
        </div>

        {/* Score inputs — your pair */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Your Pair — Enter Scores</div>
          {pairPlayers.map(p => {
            const gross = holeScores[currentHole]?.[p.index];
            const strokes = strokesOnHole(p.playingHcp, currentHole);
            const pts = gross ? stablefordPoints(gross, p.playingHcp, currentHole) : null;
            return (
              <div key={p.index} style={styles.scoreRow}>
                <div style={styles.scoreName}>
                  {p.name}
                  <span style={styles.strokeBadge}>+{strokes} stroke{strokes !== 1 ? 's' : ''}</span>
                </div>
                <div style={styles.scoreInputWrap}>
                  <input
                    type="number"
                    min={1} max={15}
                    value={gross || ''}
                    onChange={e => setScore(currentHole, p.index, e.target.value)}
                    style={styles.scoreInput}
                    placeholder="—"
                    inputMode="numeric"
                  />
                  {pts !== null && (
                    <div style={{ ...styles.ptsTag, color: pts >= 3 ? '#6ad35d' : pts === 0 ? 'rgba(245,240,232,0.25)' : C.gold }}>
                      {pts}pt{pts !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Opponents' scores (read-only) */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Opponents</div>
          {oppPlayers.map(p => {
            const gross = holeScores[currentHole]?.[p.index];
            const strokes = strokesOnHole(p.playingHcp, currentHole);
            const pts = gross ? stablefordPoints(gross, p.playingHcp, currentHole) : null;
            return (
              <div key={p.index} style={{ ...styles.scoreRow, opacity: 0.7 }}>
                <div style={styles.scoreName}>
                  {p.name}
                  <span style={styles.strokeBadge}>+{strokes}</span>
                </div>
                <div style={styles.scoreInputWrap}>
                  <div style={{ ...styles.scoreInput, display: 'flex', alignItems: 'center', justifyContent: 'center', color: gross ? C.text : 'rgba(245,240,232,0.25)' }}>
                    {gross || '—'}
                  </div>
                  {pts !== null && <div style={styles.ptsTag}>{pts}pts</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Save button */}
        <div style={{ padding: '0 24px 24px' }}>
          <button onClick={saveHole} disabled={saving} style={styles.saveBtn}>
            {saving ? 'Saving…' : `Save Hole ${currentHole}`}
          </button>
          {saveMsg && (
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: saveMsg.startsWith('✓') ? '#6ad35d' : 'rgba(220,100,100,0.9)' }}>
              {saveMsg}
            </div>
          )}
        </div>

        {/* Hole progress dots */}
        <div style={styles.progressRow}>
          {Array.from({ length: 18 }, (_, i) => i + 1).map(h => {
            const entered = pairIndices.some(idx => holeScores[h]?.[idx] != null);
            return (
              <div key={h} onClick={() => setCurrentHole(h)} style={{
                ...styles.dot,
                background: h === currentHole ? C.gold : entered ? 'rgba(201,168,76,0.4)' : 'rgba(245,240,232,0.1)',
                cursor: 'pointer',
              }} title={`Hole ${h}`} />
            );
          })}
        </div>

        <div style={{ padding: '8px 24px 12px', textAlign: 'center' }}>
          <button onClick={onLogout} style={styles.logoutBtn}>Sign Out</button>
        </div>
        <div style={styles.goldBar} />
      </div>
    </div>
  );
}

const styles = {
  page: { background: C.darkGreen, minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '20px 16px', fontFamily: "Georgia,'Times New Roman',serif" },
  card: { background: C.green, width: '100%', maxWidth: 480, borderRadius: 3, color: C.text, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' },
  goldBar: { height: 5, background: 'linear-gradient(90deg,#a07830,#c9a84c,#e8c96a,#c9a84c,#a07830)' },
  header: { padding: '20px 24px 14px', textAlign: 'center', borderBottom: '1px solid rgba(201,168,76,0.3)' },
  eyebrow: { color: C.gold, fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 6 },
  title: { fontSize: 20, fontWeight: 'normal' },
  dayBtn: { padding: '5px 14px', borderRadius: 2, border: '1px solid rgba(201,168,76,0.25)', background: 'transparent', color: 'rgba(245,240,232,0.45)', fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5 },
  dayBtnActive: { background: 'rgba(201,168,76,0.15)', color: C.gold, borderColor: 'rgba(201,168,76,0.5)' },
  formatTag: { fontSize: 10, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic', marginTop: 6 },
  matchRow: { display: 'flex', alignItems: 'flex-start', padding: '12px 20px', borderBottom: '1px solid rgba(245,240,232,0.07)', gap: 8 },
  teamBlock: { flex: 1 },
  teamLabel: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', color: C.gold, marginBottom: 4 },
  playerName: { fontSize: 12, color: 'rgba(245,240,232,0.75)', fontFamily: 'Helvetica Neue,Arial,sans-serif', padding: '1px 0' },
  hcpTag: { color: 'rgba(245,240,232,0.3)', fontSize: 11 },
  vsText: { fontSize: 11, color: 'rgba(245,240,232,0.22)', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 2, paddingTop: 18 },
  holeNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(245,240,232,0.07)' },
  navBtn: { background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.2)', color: C.gold, width: 36, height: 36, borderRadius: 3, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  holeBadge: { textAlign: 'center' },
  holeNum: { fontSize: 20, color: C.gold },
  holeMeta: { fontSize: 11, color: 'rgba(245,240,232,0.35)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  section: { padding: '12px 20px', borderBottom: '1px solid rgba(245,240,232,0.07)' },
  sectionLabel: { fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', color: 'rgba(201,168,76,0.55)', marginBottom: 10 },
  scoreRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  scoreName: { fontSize: 13, color: C.text, display: 'flex', alignItems: 'center', gap: 6 },
  strokeBadge: { fontSize: 9, fontFamily: 'Helvetica Neue,Arial,sans-serif', padding: '1px 5px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, color: 'rgba(201,168,76,0.7)' },
  scoreInputWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  scoreInput: { width: 56, height: 40, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 3, color: C.text, fontSize: 20, textAlign: 'center', fontFamily: "Georgia,'Times New Roman',serif", outline: 'none' },
  ptsTag: { fontSize: 11, fontFamily: 'Helvetica Neue,Arial,sans-serif', color: C.gold, minWidth: 32, textAlign: 'right' },
  saveBtn: { width: '100%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.5)', borderRadius: 3, color: C.gold, fontSize: 14, padding: 12, cursor: 'pointer', fontFamily: "Georgia,'Times New Roman',serif", letterSpacing: 1, marginTop: 4 },
  progressRow: { display: 'flex', flexWrap: 'wrap', gap: 4, padding: '10px 20px', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: '50%', transition: 'background 0.2s' },
  logoutBtn: { background: 'transparent', border: 'none', color: 'rgba(245,240,232,0.22)', fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1 },
};
