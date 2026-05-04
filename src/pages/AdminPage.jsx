import { useState, useEffect } from 'react';
import { PAR } from '../lib/gameData.js';
import { useEvent } from '../lib/eventContext.jsx';
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

function FieldRow({ label, value, onChange, type = 'text', multiline = false }) {
  const C = { gold: '#c9a84c', text: '#f5f0e8' };
  return (
    <div style={{ marginBottom: 10, flex: 1 }}>
      <label style={{ display: 'block', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 4 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          rows={6}
          style={{
            width: '100%', boxSizing: 'border-box', fontSize: 11,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,240,232,0.15)',
            borderRadius: 2, color: C.text, padding: '6px 10px',
            fontFamily: 'monospace', resize: 'vertical',
          }}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', fontSize: 12,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,240,232,0.15)',
            borderRadius: 2, color: C.text, padding: '7px 10px',
            fontFamily: 'Helvetica Neue,Arial,sans-serif',
          }}
        />
      )}
    </div>
  );
}

const SAMPLE_EVENT_JSON = `{
  "slug": "spier-2027",
  "name": "Spier Invitational 2027",
  "short_name": "Spier 2027",
  "start_date": "2027-04-29",
  "end_date": "2027-04-30",
  "course_name": "Spier Golf Estate",
  "par_json":          { "1":4,"2":4,"3":4,"4":4,"5":5,"6":4,"7":3,"8":5,"9":3,"10":4,"11":4,"12":5,"13":3,"14":5,"15":3,"16":4,"17":4,"18":4 },
  "stroke_index_json": { "1":3,"2":9,"3":7,"4":5,"5":11,"6":1,"7":17,"8":15,"9":13,"10":6,"11":10,"12":18,"13":16,"14":12,"15":8,"16":2,"17":14,"18":4 },
  "team_a_name": "Eagles",
  "team_b_name": "Birdies",
  "team_a_color": "#c9a84c",
  "team_b_color": "#4ecfb0",
  "day_format_json": {
    "1": "Scramble Drive · Four-Ball Better Ball Stableford",
    "2": "Normal Play · Four-Ball Better Ball Stableford"
  },
  "hcp_allowance": 85,
  "set_active": false,
  "players": [
    { "player_index": 0, "name": "Juan Klopper",   "team": "B", "mobile": "0820000001", "course_hcp": 22, "playing_hcp": 19, "is_admin": true },
    { "player_index": 1, "name": "Player Two",     "team": "A", "mobile": "0820000002", "course_hcp": 10, "playing_hcp": 9 }
    /* ...add the rest of the players... */
  ],
  "pairings": [
    { "round_day": 1, "tee_time": "10:00", "team": "A", "player1_index": 1, "player2_index": 4 },
    { "round_day": 1, "tee_time": "10:00", "team": "B", "player1_index": 0, "player2_index": 3 }
    /* ...add the rest of the pairings... */
  ]
}`;

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
  const { event, eventId, players: eventPlayers, teamNames, isArchived, dayCount, hcpAllowance: eventAllowance } = useEvent();

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

  // ── PINs tab state ────────────────────────────────────────
  const [pinEdits, setPinEdits] = useState({});       // { playerIndex: { mobile, newPin } }
  const [pinSaving, setPinSaving] = useState(null);
  const [pinMsgs, setPinMsgs] = useState({});         // { playerIndex: msg }

  // ── Events tab state ──────────────────────────────────────
  const [allEvents, setAllEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState(null);     // which event card is expanded for editing
  const [eventEdits, setEventEdits] = useState({});                  // { eventId: { field: newValue } }
  const [eventBusy, setEventBusy] = useState(null);                  // eventId being acted upon
  const [eventMsg, setEventMsg] = useState({});                      // { eventId: msg }
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createJson, setCreateJson] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [activateConfirm, setActivateConfirm] = useState(null);     // eventId being confirmed

  // ── Load scores ───────────────────────────────────────────
  useEffect(() => { if (eventId) loadScores(); }, [eventId, roundDay]);

  async function loadScores() {
    const { data } = await supabase
      .from('scores')
      .select('player_index, hole_number, gross_score')
      .eq('event_id', eventId)
      .eq('round_day', roundDay);
    if (!data) return;
    const lookup = {};
    data.forEach(row => {
      if (!lookup[row.player_index]) lookup[row.player_index] = {};
      lookup[row.player_index][row.hole_number] = row.gross_score;
    });
    setScores(lookup);
  }

  // ── Load players (handicaps + PINs tabs) ──────────────────
  useEffect(() => {
    if (!eventId) return;
    supabase
      .from('players')
      .select('player_index, name, team, course_hcp, playing_hcp, mobile')
      .eq('event_id', eventId)
      .order('player_index')
      .then(({ data }) => {
        if (!data) return;
        setDbPlayers(data);
        const edits = {};
        const pinE = {};
        data.forEach(p => {
          edits[p.player_index] = { courseHcp: p.course_hcp, playingHcp: p.playing_hcp };
          pinE[p.player_index] = { mobile: p.mobile || '', newPin: '' };
        });
        setHcpEdits(edits);
        setPinEdits(pinE);
        // Use the event's configured allowance, falling back to inferring from data
        if (eventAllowance) {
          setAllowance(eventAllowance);
        } else {
          const sample = data.find(p => p.course_hcp > 0);
          if (sample) {
            const inferred = Math.round((sample.playing_hcp / sample.course_hcp) * 100);
            if (!isNaN(inferred) && inferred > 0) setAllowance(inferred);
          }
        }
      });
  }, [eventId, eventAllowance]);

  // ── PIN management ────────────────────────────────────────
  async function callPinApi(playerIndex, body, successMsg) {
    setPinSaving(playerIndex);
    setPinMsgs(prev => ({ ...prev, [playerIndex]: '' }));
    try {
      const res = await fetch('/api/admin/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ playerIndex, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPinMsgs(prev => ({ ...prev, [playerIndex]: `✓ ${successMsg}` }));
      // refresh local mobile from server
      if (body.mobile) {
        setDbPlayers(prev => prev.map(p => p.player_index === playerIndex ? { ...p, mobile: body.mobile } : p));
      }
      // Clear PIN input after successful set
      if (body.newPin) {
        setPinEdits(prev => ({ ...prev, [playerIndex]: { ...prev[playerIndex], newPin: '' } }));
      }
      setTimeout(() => setPinMsgs(prev => ({ ...prev, [playerIndex]: '' })), 2500);
    } catch (err) {
      setPinMsgs(prev => ({ ...prev, [playerIndex]: `✗ ${err.message}` }));
    } finally {
      setPinSaving(null);
    }
  }

  function setPinForPlayer(playerIndex) {
    const edit = pinEdits[playerIndex];
    if (!edit?.newPin || !/^\d{4}$/.test(edit.newPin)) {
      setPinMsgs(prev => ({ ...prev, [playerIndex]: '✗ PIN must be 4 digits' }));
      return;
    }
    callPinApi(playerIndex, { newPin: edit.newPin }, `PIN set to ${edit.newPin}`);
  }

  function resetPinForPlayer(playerIndex) {
    callPinApi(playerIndex, { newPin: '1234' }, 'Reset to 1234');
  }

  function saveMobileForPlayer(playerIndex) {
    const edit = pinEdits[playerIndex];
    if (!edit?.mobile) return;
    callPinApi(playerIndex, { mobile: edit.mobile.trim() }, 'Mobile saved');
  }

  // ── Events management ─────────────────────────────────────
  useEffect(() => {
    if (tab !== 'events') return;
    loadAllEvents();
  }, [tab]);

  async function loadAllEvents() {
    setEventsLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: false });
    setAllEvents(data || []);
    // Seed eventEdits with current values
    const edits = {};
    (data || []).forEach(e => {
      edits[e.id] = {
        name: e.name || '',
        short_name: e.short_name || '',
        start_date: e.start_date || '',
        end_date: e.end_date || '',
        course_name: e.course_name || '',
        team_a_name: e.team_a_name || '',
        team_b_name: e.team_b_name || '',
        hcp_allowance: e.hcp_allowance ?? 85,
        rules_md: e.rules_md || '',
        fines_md: e.fines_md || '',
        transport_md: e.transport_md || '',
        bios_md: e.bios_md || '',
      };
    });
    setEventEdits(edits);
    setEventsLoading(false);
  }

  async function setEventField(eventId, field, value) {
    setEventEdits(prev => ({ ...prev, [eventId]: { ...prev[eventId], [field]: value } }));
  }

  async function saveEventEdits(eventId) {
    setEventBusy(eventId);
    setEventMsg(prev => ({ ...prev, [eventId]: '' }));
    try {
      const updates = eventEdits[eventId];
      const res = await fetch('/api/admin/event-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventMsg(prev => ({ ...prev, [eventId]: '✓ Saved' }));
      await loadAllEvents();
      setTimeout(() => setEventMsg(prev => ({ ...prev, [eventId]: '' })), 2000);
    } catch (err) {
      setEventMsg(prev => ({ ...prev, [eventId]: `✗ ${err.message}` }));
    } finally {
      setEventBusy(null);
    }
  }

  async function activateEvent(eventId) {
    setEventBusy(eventId);
    setEventMsg(prev => ({ ...prev, [eventId]: '' }));
    try {
      const res = await fetch('/api/admin/event-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, archivePrevious: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventMsg(prev => ({ ...prev, [eventId]: '✓ Activated · previous event archived' }));
      setActivateConfirm(null);
      await loadAllEvents();
      setTimeout(() => setEventMsg(prev => ({ ...prev, [eventId]: '' })), 3000);
    } catch (err) {
      setEventMsg(prev => ({ ...prev, [eventId]: `✗ ${err.message}` }));
    } finally {
      setEventBusy(null);
    }
  }

  async function archiveEvent(eventId) {
    setEventBusy(eventId);
    setEventMsg(prev => ({ ...prev, [eventId]: '' }));
    try {
      const res = await fetch('/api/admin/event-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, updates: { is_archived: true } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventMsg(prev => ({ ...prev, [eventId]: '✓ Archived' }));
      await loadAllEvents();
      setTimeout(() => setEventMsg(prev => ({ ...prev, [eventId]: '' })), 2000);
    } catch (err) {
      setEventMsg(prev => ({ ...prev, [eventId]: `✗ ${err.message}` }));
    } finally {
      setEventBusy(null);
    }
  }

  async function createNewEvent() {
    setCreateBusy(true);
    setCreateMsg('');
    try {
      let payload;
      try {
        payload = JSON.parse(createJson);
      } catch {
        throw new Error('Invalid JSON — check your braces and commas');
      }
      const res = await fetch('/api/admin/event-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreateMsg(`✓ Created event "${data.slug}" with ${data.players} players, ${data.pairings} pairings. Default PIN: ${data.defaultPin}`);
      setCreateJson('');
      await loadAllEvents();
    } catch (err) {
      setCreateMsg(`✗ ${err.message}`);
    } finally {
      setCreateBusy(false);
    }
  }

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
  if (!player || !player.is_admin) {
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
          <div style={{ color: C.gold, fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 6 }}>Admin · {event?.name || 'Golf Pairings'}</div>
          <div style={{ color: C.text, fontSize: 20 }}>Tournament Management</div>
          {isArchived && <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(245,240,232,0.5)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>🗄 Archived event · read-only</div>}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', marginBottom: 20, background: 'rgba(0,0,0,0.25)', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(201,168,76,0.25)' }}>
          {[
            ['scores',    '⛳', 'Scores'],
            ['handicaps', '📋', 'Handicaps'],
            ['pins',      '🔑', 'PINs'],
            ['events',    '🗓', 'Events'],
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
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
              {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
                <button key={d} onClick={() => setRoundDay(d)} style={{
                  padding: '7px 20px', borderRadius: 2, border: '1px solid rgba(201,168,76,0.3)',
                  background: roundDay === d ? 'rgba(201,168,76,0.15)' : 'transparent',
                  color: roundDay === d ? C.gold : 'rgba(245,240,232,0.4)',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
                }}>Day {d}</button>
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
                              {team === 'A' ? teamNames.A : teamNames.B}
                            </span>
                          </td>
                        </tr>
                        {eventPlayers.filter(p => p.team === team).map(p => {
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
                      {team === 'A' ? teamNames.A : teamNames.B}
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
                            {team === 'A' ? teamNames.A : teamNames.B}
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

        {/* ══════════════ PINs TAB ══════════════ */}
        {tab === 'pins' && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 3, padding: '12px 16px', marginBottom: 16, fontSize: 11, color: 'rgba(245,240,232,0.6)', fontFamily: 'Helvetica Neue,Arial,sans-serif', lineHeight: 1.5 }}>
              <div style={{ color: C.gold, fontSize: 12, marginBottom: 4 }}>🔑 PIN & Mobile Management</div>
              All players default to PIN <strong style={{ color: C.gold }}>1234</strong>. Set custom 4-digit PINs and WhatsApp them privately. Mobile numbers are how players sign in — keep them in <code style={{ color: C.gold }}>0821234567</code> format.
            </div>

            {dbPlayers.map(p => {
              const edit = pinEdits[p.player_index] || { mobile: '', newPin: '' };
              const teamColor = p.team === 'A' ? C.gold : C.teal;
              const msg = pinMsgs[p.player_index];
              const isSaving = pinSaving === p.player_index;
              return (
                <div key={p.player_index} style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(245,240,232,0.06)', borderRadius: 3, padding: '12px 14px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: teamColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: C.text, flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: 'rgba(245,240,232,0.3)', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 1 }}>idx {p.player_index}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'end' }}>
                    {/* Mobile */}
                    <div>
                      <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)', fontFamily: 'Helvetica Neue,Arial,sans-serif', display: 'block', marginBottom: 4 }}>Mobile</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="tel"
                          value={edit.mobile}
                          onChange={e => setPinEdits(prev => ({ ...prev, [p.player_index]: { ...prev[p.player_index], mobile: e.target.value } }))}
                          placeholder="0821234567"
                          style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 3, color: C.text, fontSize: 13, padding: '7px 10px', fontFamily: 'Helvetica Neue,Arial,sans-serif', outline: 'none' }}
                        />
                        <button
                          onClick={() => saveMobileForPlayer(p.player_index)}
                          disabled={isSaving || edit.mobile === p.mobile}
                          style={{ padding: '7px 10px', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 3, color: C.gold, fontSize: 11, cursor: edit.mobile === p.mobile ? 'default' : 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', opacity: edit.mobile === p.mobile ? 0.4 : 1 }}>
                          Save
                        </button>
                      </div>
                    </div>

                    {/* PIN */}
                    <div>
                      <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(201,168,76,0.6)', fontFamily: 'Helvetica Neue,Arial,sans-serif', display: 'block', marginBottom: 4 }}>Set PIN</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          value={edit.newPin}
                          onChange={e => setPinEdits(prev => ({ ...prev, [p.player_index]: { ...prev[p.player_index], newPin: e.target.value.replace(/\D/g, '').slice(0, 4) } }))}
                          placeholder="4 digits"
                          inputMode="numeric"
                          maxLength={4}
                          style={{ width: 80, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 3, color: C.text, fontSize: 14, padding: '7px 10px', fontFamily: 'Helvetica Neue,Arial,sans-serif', outline: 'none', textAlign: 'center', letterSpacing: '0.2em' }}
                        />
                        <button
                          onClick={() => setPinForPlayer(p.player_index)}
                          disabled={isSaving || edit.newPin.length !== 4}
                          style={{ padding: '7px 10px', background: 'rgba(106,211,93,0.12)', border: '1px solid rgba(106,211,93,0.35)', borderRadius: 3, color: '#6ad35d', fontSize: 11, cursor: edit.newPin.length !== 4 ? 'default' : 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', opacity: edit.newPin.length !== 4 ? 0.4 : 1 }}>
                          Set
                        </button>
                        <button
                          onClick={() => resetPinForPlayer(p.player_index)}
                          disabled={isSaving}
                          style={{ padding: '7px 10px', background: 'rgba(245,240,232,0.05)', border: '1px solid rgba(245,240,232,0.2)', borderRadius: 3, color: 'rgba(245,240,232,0.55)', fontSize: 11, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif', whiteSpace: 'nowrap' }}>
                          ↺ 1234
                        </button>
                      </div>
                    </div>
                  </div>

                  {msg && (
                    <div style={{ marginTop: 8, fontSize: 11, color: msg.startsWith('✓') ? '#6ad35d' : 'rgba(220,100,100,0.9)', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                      {msg}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: 3, fontSize: 10, color: 'rgba(245,240,232,0.4)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic', textAlign: 'center' }}>
              Setting a new PIN clears the player's device binding so they can sign in fresh.
            </div>
          </div>
        )}

        {/* ══════════════ EVENTS TAB ══════════════ */}
        {tab === 'events' && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* Intro */}
            <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 3, padding: '12px 16px', marginBottom: 16, fontSize: 11, color: 'rgba(245,240,232,0.6)', fontFamily: 'Helvetica Neue,Arial,sans-serif', lineHeight: 1.6 }}>
              <div style={{ color: C.gold, fontSize: 12, marginBottom: 4 }}>🗓 Tournament events</div>
              Manage every tournament. Edit metadata, set the active event (which switches the live app), archive past events, or create a new one with the JSON-paste form below.
            </div>

            {/* Create new event */}
            {!showCreateForm ? (
              <button onClick={() => setShowCreateForm(true)} style={{
                width: '100%', padding: '12px 16px', marginBottom: 16,
                background: 'rgba(106,211,93,0.12)', border: '1px solid rgba(106,211,93,0.4)',
                borderRadius: 3, color: '#6ad35d', fontSize: 13, cursor: 'pointer',
                fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5,
              }}>
                ➕ Create New Event
              </button>
            ) : (
              <div style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(106,211,93,0.3)', borderRadius: 3, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: '#6ad35d', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>➕ Create New Event</span>
                  <button onClick={() => { setShowCreateForm(false); setCreateJson(''); setCreateMsg(''); }}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(245,240,232,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>✕ Cancel</button>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 8, lineHeight: 1.5 }}>
                  Paste a JSON event spec. Required: <code style={{ color: C.gold }}>slug, name, start_date, end_date, par_json, stroke_index_json, day_format_json, players, pairings</code>. Set <code style={{ color: C.gold }}>"set_active": true</code> to switch the live app to this event.
                </div>
                <textarea
                  value={createJson}
                  onChange={e => setCreateJson(e.target.value)}
                  placeholder={SAMPLE_EVENT_JSON}
                  style={{
                    width: '100%', boxSizing: 'border-box', minHeight: 240, fontSize: 11,
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,240,232,0.15)',
                    borderRadius: 2, color: C.text, padding: 10, fontFamily: 'monospace', resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => setCreateJson(SAMPLE_EVENT_JSON)} style={{
                    flex: 1, padding: 8, background: 'rgba(245,240,232,0.05)', border: '1px solid rgba(245,240,232,0.15)',
                    borderRadius: 2, color: 'rgba(245,240,232,0.55)', fontSize: 11, cursor: 'pointer',
                    fontFamily: 'Helvetica Neue,Arial,sans-serif',
                  }}>📋 Insert template</button>
                  <button onClick={createNewEvent} disabled={createBusy || !createJson.trim()} style={{
                    flex: 2, padding: 8,
                    background: createBusy ? 'rgba(106,211,93,0.05)' : 'rgba(106,211,93,0.18)',
                    border: '1px solid rgba(106,211,93,0.4)', borderRadius: 2, color: '#6ad35d',
                    fontSize: 12, cursor: createBusy ? 'default' : 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
                    opacity: !createJson.trim() ? 0.4 : 1,
                  }}>
                    {createBusy ? 'Creating…' : '✓ Create event'}
                  </button>
                </div>
                {createMsg && (
                  <div style={{ marginTop: 10, fontSize: 11, padding: 8, borderRadius: 2,
                    background: createMsg.startsWith('✓') ? 'rgba(106,211,93,0.08)' : 'rgba(220,60,60,0.1)',
                    color: createMsg.startsWith('✓') ? '#6ad35d' : 'rgba(220,100,100,0.95)',
                    fontFamily: 'Helvetica Neue,Arial,sans-serif',
                  }}>{createMsg}</div>
                )}
              </div>
            )}

            {/* Existing events list */}
            {eventsLoading && <div style={{ textAlign: 'center', color: 'rgba(245,240,232,0.4)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 12, padding: 20 }}>Loading events…</div>}
            {!eventsLoading && allEvents.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(245,240,232,0.4)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 12, padding: 20 }}>
                No events yet.
              </div>
            )}

            {allEvents.map(ev => {
              const expanded = expandedEventId === ev.id;
              const edits = eventEdits[ev.id] || {};
              const busy = eventBusy === ev.id;
              const msg = eventMsg[ev.id];
              const status = ev.is_active ? 'Active' : ev.is_archived ? 'Archived' : 'Draft';
              const statusColor = ev.is_active ? '#6ad35d' : ev.is_archived ? 'rgba(245,240,232,0.4)' : 'rgba(201,168,76,0.7)';
              const statusBg = ev.is_active ? 'rgba(106,211,93,0.12)' : ev.is_archived ? 'rgba(245,240,232,0.04)' : 'rgba(201,168,76,0.08)';
              return (
                <div key={ev.id} style={{
                  background: 'rgba(0,0,0,0.18)', border: `1px solid ${ev.is_active ? 'rgba(106,211,93,0.3)' : 'rgba(245,240,232,0.06)'}`,
                  borderRadius: 3, marginBottom: 10, overflow: 'hidden',
                }}>
                  {/* Compact header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: C.text }}>{ev.name}</span>
                        <span style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 2, background: statusBg, color: statusColor, border: `1px solid ${statusColor}40`, fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>{status}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.45)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 3 }}>
                        {ev.slug} · {ev.start_date} → {ev.end_date}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!ev.is_active && (
                        <button onClick={() => activateConfirm === ev.id ? activateEvent(ev.id) : setActivateConfirm(ev.id)}
                          disabled={busy}
                          style={{
                            padding: '6px 10px', fontSize: 11, borderRadius: 2,
                            background: activateConfirm === ev.id ? 'rgba(106,211,93,0.3)' : 'rgba(106,211,93,0.12)',
                            border: '1px solid rgba(106,211,93,0.4)', color: '#6ad35d',
                            cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
                          }}>
                          {activateConfirm === ev.id ? '⚠️ Tap again — confirm switch' : '⚡ Set Active'}
                        </button>
                      )}
                      {!ev.is_archived && !ev.is_active && (
                        <button onClick={() => archiveEvent(ev.id)} disabled={busy}
                          style={{
                            padding: '6px 10px', fontSize: 11, borderRadius: 2,
                            background: 'rgba(245,240,232,0.05)', border: '1px solid rgba(245,240,232,0.2)',
                            color: 'rgba(245,240,232,0.55)', cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
                          }}>
                          🗄 Archive
                        </button>
                      )}
                      <button onClick={() => { setExpandedEventId(expanded ? null : ev.id); setActivateConfirm(null); }}
                        style={{
                          padding: '6px 10px', fontSize: 11, borderRadius: 2,
                          background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
                          color: C.gold, cursor: 'pointer', fontFamily: 'Helvetica Neue,Arial,sans-serif',
                        }}>
                        {expanded ? '▴ Close' : '▾ Edit'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded edit form */}
                  {expanded && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(245,240,232,0.06)' }}>
                      <FieldRow label="Name" value={edits.name} onChange={v => setEventField(ev.id, 'name', v)} />
                      <FieldRow label="Short name" value={edits.short_name} onChange={v => setEventField(ev.id, 'short_name', v)} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <FieldRow label="Start date" value={edits.start_date} onChange={v => setEventField(ev.id, 'start_date', v)} type="date" />
                        <FieldRow label="End date" value={edits.end_date} onChange={v => setEventField(ev.id, 'end_date', v)} type="date" />
                      </div>
                      <FieldRow label="Course" value={edits.course_name} onChange={v => setEventField(ev.id, 'course_name', v)} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <FieldRow label="Team A name" value={edits.team_a_name} onChange={v => setEventField(ev.id, 'team_a_name', v)} />
                        <FieldRow label="Team B name" value={edits.team_b_name} onChange={v => setEventField(ev.id, 'team_b_name', v)} />
                      </div>
                      <FieldRow label="HCP allowance %" value={edits.hcp_allowance} onChange={v => setEventField(ev.id, 'hcp_allowance', parseInt(v) || 0)} type="number" />

                      <FieldRow label="Rules (markdown)" value={edits.rules_md} onChange={v => setEventField(ev.id, 'rules_md', v)} multiline />
                      <FieldRow label="Fines (markdown)" value={edits.fines_md} onChange={v => setEventField(ev.id, 'fines_md', v)} multiline />
                      <FieldRow label="Travel & stay (markdown)" value={edits.transport_md} onChange={v => setEventField(ev.id, 'transport_md', v)} multiline />
                      <FieldRow label="Player bios (markdown)" value={edits.bios_md} onChange={v => setEventField(ev.id, 'bios_md', v)} multiline />

                      <button onClick={() => saveEventEdits(ev.id)} disabled={busy} style={{
                        marginTop: 10, width: '100%', padding: 10,
                        background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)',
                        borderRadius: 3, color: C.gold, fontSize: 12, cursor: 'pointer',
                        fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5,
                      }}>
                        {busy ? 'Saving…' : '💾 Save changes'}
                      </button>
                    </div>
                  )}

                  {msg && (
                    <div style={{
                      padding: '8px 14px', fontSize: 11,
                      background: msg.startsWith('✓') ? 'rgba(106,211,93,0.08)' : 'rgba(220,60,60,0.1)',
                      color: msg.startsWith('✓') ? '#6ad35d' : 'rgba(220,100,100,0.95)',
                      fontFamily: 'Helvetica Neue,Arial,sans-serif',
                    }}>{msg}</div>
                  )}
                </div>
              );
            })}
          </div>
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

            {/* Per-day resets — driven by event's dayCount */}
            {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
              <ResetBlock
                key={d}
                label={`Day ${d}`}
                subtitle={event?.day_format_json?.[d] || `Round ${d}`}
                day={String(d)}
                confirmKey={resetConfirm}
                setConfirm={setResetConfirm}
                onConfirm={() => doReset(d)}
                resetting={resetting}
              />
            ))}

            {/* Reset All */}
            <ResetBlock
              label="Reset Entire Tournament"
              subtitle="Clears all scores — every day"
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
              <button onClick={() => setEditing(e => ({ ...e, gross: Math.max(1, e.gross - 1) }))} style={{ width: 48, height: 52, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 3, color: C.gold, fontSize: 26, cursor: 'pointer' }}>−</button>
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
