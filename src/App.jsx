import { useState, useEffect, useRef } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLAYERS = [
  "Juan Klopper","Rob Arnold","James Leach","David Harrison",
  "Nic Dunn","Justin Garner","Ross Andrews","Byron Roos",
  "Shaheed Mohamed","Jean-Paul Du Toit","Jason Airey","Mike Du Toit"
];
const N = 12;

const FREQ = [
  { label: "Weekly",                value: 52  },
  { label: "Bi-weekly",             value: 26  },
  { label: "Monthly",               value: 12  },
  { label: "Bi-monthly",            value: 6   },
  { label: "Quarterly",             value: 4   },
  { label: "Twice a year",          value: 2   },
  { label: "Once a year",           value: 1   },
  { label: "Only ever once",        value: 0.5 },
  { label: "Never played together", value: 0   },
];

function freqIdx(v) {
  const i = FREQ.findIndex(f => f.value === v);
  return i >= 0 ? i : 0;
}
function freqLabel(v) { return FREQ[freqIdx(v)].label; }

// ─── Default data ─────────────────────────────────────────────────────────────

function makeMatrix(n, v = 0) {
  return Array.from({ length: n }, () => Array(n).fill(v));
}

function defaultMatrix() {
  const m = makeMatrix(N, 0);
  // 0=Juan,1=Rob,2=James,3=David,4=Nic,5=Justin,
  // 6=Ross,7=Byron,8=Shaheed,9=JP,10=Jason,11=Mike
  [
    [0,1,52],[0,2,52],[0,3,2],[0,4,4],[0,5,4],[0,6,12],
    [1,2,52],[1,3,6],[1,4,6],[1,5,12],[1,6,12],[1,9,4],[1,11,4],
    [2,3,2],[2,4,4],[2,5,4],[2,6,12],[2,7,.5],[2,9,2],[2,11,2],
    [3,4,4],[3,5,12],[3,9,4],[3,10,4],[3,11,4],
    [4,5,4],[4,9,4],[4,10,4],[4,11,4],
    [5,9,4],[5,10,12],[5,11,4],
    [6,7,.5],

    [9,10,4],[9,11,12],
    [10,11,6],
  ].forEach(([i,j,v])=>{ m[i][j]=v; m[j][i]=v; });
  return m;
}

// Default teams: first 6 = Team A (0), last 6 = Team B (1)
// Team A: Juan(0),James(2),David(3),Ross(6),Byron(7),JP(9)
// Team B: Rob(1),Nic(4),Justin(5),Shaheed(8),Jason(10),Mike(11)
const defaultTeams = () => [0,1,0,0,1,1,0,0,1,0,1,1];

// ─── Algorithm ────────────────────────────────────────────────────────────────

function withinTeamMatching(scoreMatrix, teamIdx, maximise) {
  let bestScore = maximise ? -Infinity : Infinity;
  let bestMatching = null;
  function bt(avail, pairs) {
    if (!avail.length) {
      const s = pairs.reduce((acc,[i,j]) => acc + scoreMatrix[i][j], 0);
      if (maximise ? s > bestScore : s < bestScore) {
        bestScore = s; bestMatching = pairs.map(p => [...p]);
      }
      return;
    }
    const [first, ...rest] = avail;
    for (let k = 0; k < rest.length; k++)
      bt(rest.filter((_,x) => x !== k), [...pairs, [first, rest[k]]]);
  }
  bt([...teamIdx], []);
  return bestMatching;
}

// All 6 ways to match 3 A-pairs against 3 B-pairs
function crossTeamGroupings(pairsA, pairsB) {
  const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  return perms.map(p => pairsA.map((pa, ai) => [...pa, ...pairsB[p[ai]]]));
}

function buildSchedules(base, teams, jitter = 0) {
  const n = base.length;
  const jittered = jitter === 0 ? base : base.map(r => r.map(v => v + Math.random() * jitter));

  const teamA = PLAYERS.map((_,i) => i).filter(i => teams[i] === 0);
  const teamB = PLAYERS.map((_,i) => i).filter(i => teams[i] === 1);

  // Day 1: min-weight within-team matching
  const p1A = withinTeamMatching(jittered, teamA, false);
  const p1B = withinTeamMatching(jittered, teamB, false);

  // Cross-team grouping: maximise opponent familiarity
  const g1s = crossTeamGroupings(p1A, p1B);
  const sG1 = g => g.reduce((s, [a1,a2,b1,b2]) =>
    s + jittered[a1][b1] + jittered[a1][b2] + jittered[a2][b1] + jittered[a2][b2], 0);
  const day1 = g1s.reduce((b, g) => sG1(g) > sG1(b) ? g : b);

  // Update matrices
  const w2 = base.map(r => [...r]), against = makeMatrix(n), sameFB = makeMatrix(n, 0);
  for (const [a1,a2,b1,b2] of day1) {
    w2[a1][a2]++; w2[a2][a1]++; w2[b1][b2]++; w2[b2][b1]++;
    for (const x of [a1,a2,b1,b2]) for (const y of [a1,a2,b1,b2])
      if (x !== y) { against[x][y]++; sameFB[x][y] = 1; }
  }

  // Day 2: max-weight within-team matching with sameFB penalty
  const PEN = 1000;
  const w2m = w2.map(r => [...r]);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    if (sameFB[i][j]) w2m[i][j] -= (PEN + base[i][j]);

  const p2A = withinTeamMatching(w2m, teamA, true);
  const p2B = withinTeamMatching(w2m, teamB, true);

  // Cross-team grouping: minimise against + penalise sameFB
  const g2s = crossTeamGroupings(p2A, p2B);
  const sG2 = g => g.reduce((s, fb) => {
    const [a1,a2,b1,b2] = fb;
    let sc = -(against[a1][b1] + against[a1][b2] + against[a2][b1] + against[a2][b2]);
    const all = [a1,a2,b1,b2];
    for (let i = 0; i < 4; i++) for (let j = i+1; j < 4; j++)
      sc -= sameFB[all[i]][all[j]] * (PEN + base[all[i]][all[j]]);
    return s + sc;
  }, 0);
  const day2 = g2s.reduce((b, g) => sG2(g) > sG2(b) ? g : b);

  return { day1, day2, base, w2, teams };
}

// ─── Roller ───────────────────────────────────────────────────────────────────

function Roller({ value, onChange }) {
  const idx = freqIdx(value);
  const [animKey, setAnimKey] = useState(0);
  const dirRef = useRef(null);

  const handleLeft = () => {
    dirRef.current = "bck"; setAnimKey(k => k+1);
    onChange(FREQ[(idx - 1 + FREQ.length) % FREQ.length].value);
  };
  const handleRight = () => {
    dirRef.current = "fwd"; setAnimKey(k => k+1);
    onChange(FREQ[(idx + 1) % FREQ.length].value);
  };
  const animCls = animKey === 0 ? "" : dirRef.current === "fwd" ? "r-fwd" : "r-bck";
  const arrowStyle = {
    background:"transparent", border:"none", color:"rgba(212,168,67,.6)",
    fontSize:"1.7rem", lineHeight:1, padding:"0 .85rem", height:"100%",
    cursor:"pointer", fontFamily:"'Cormorant Garamond',serif", flexShrink:0,
  };

  return (
    <div style={{display:"flex",alignItems:"center",flexShrink:0,width:196,height:40,
      background:"rgba(0,0,0,.32)",border:"1px solid rgba(212,168,67,.26)",borderRadius:7,overflow:"hidden"}}>
      <button onClick={handleLeft} style={arrowStyle}>‹</button>
      <div style={{flex:1,overflow:"hidden",height:"100%",display:"flex",alignItems:"center",
        justifyContent:"center",position:"relative",
        borderLeft:"1px solid rgba(212,168,67,.16)",borderRight:"1px solid rgba(212,168,67,.16)"}}>
        <span key={animKey} className={animCls} style={{position:"absolute",fontSize:".71rem",
          color:"#d4a843",fontWeight:500,whiteSpace:"nowrap",letterSpacing:".01em"}}>
          {FREQ[idx].label}
        </span>
      </div>
      <button onClick={handleRight} style={arrowStyle}>›</button>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500&display=swap');
@keyframes rFwd{from{transform:translateY(60%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes rBck{from{transform:translateY(-60%);opacity:0}to{transform:translateY(0);opacity:1}}
.r-fwd{animation:rFwd .22s ease forwards}
.r-bck{animation:rBck .22s ease forwards}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#0c1e12;color:#e8dfc8;font-family:'Outfit',sans-serif;min-height:100vh}
.wrap{max-width:620px;margin:0 auto;padding:2rem 1.25rem 5rem}
.display{font-family:'Cormorant Garamond',serif;font-size:clamp(2.2rem,8vw,3.2rem);font-weight:700;color:#d4a843;line-height:1;letter-spacing:-.02em}
.heading{font-family:'Cormorant Garamond',serif;font-size:clamp(1.35rem,4.5vw,1.8rem);font-weight:600;color:#d4a843;line-height:1.15}
.lbl{font-size:.7rem;font-weight:500;text-transform:uppercase;letter-spacing:.1em;color:#6b8c76}
.muted{color:#6b8c76;font-size:.83rem;font-weight:300}
.card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:1.2rem;margin-bottom:1rem}
.card-g{background:rgba(18,40,25,.6);border-color:rgba(90,150,110,.2)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;font-family:'Outfit',sans-serif;font-size:.875rem;font-weight:500;border:none;border-radius:8px;padding:.7rem 1.2rem;cursor:pointer;transition:all .15s;white-space:nowrap}
.btn-gold{background:#d4a843;color:#0c1e12}
.btn-gold:hover{background:#e8c060;transform:translateY(-1px);box-shadow:0 4px 16px rgba(212,168,67,.25)}
.btn-gold:disabled{opacity:.28;cursor:default;transform:none;box-shadow:none}
.btn-teal{background:#4a8a6a;color:#e8dfc8}
.btn-teal:hover{background:#5a9e7a;transform:translateY(-1px)}
.btn-ghost{background:transparent;color:#6b8c76;border:1px solid rgba(107,140,120,.28)}
.btn-ghost:hover{border-color:#6b9e78;color:#a0c8b0}
.btn-full{width:100%;padding:.88rem;font-size:.93rem}
.steps{display:flex;gap:5px;margin-bottom:2rem}
.step{flex:1;height:2px;border-radius:99px;background:rgba(255,255,255,.07);transition:background .35s}
.step.on{background:#d4a843}.step.done{background:rgba(212,168,67,.35)}
.pbar{height:1px;background:rgba(255,255,255,.07);border-radius:99px;margin-bottom:1.5rem;overflow:hidden}
.pfill{height:100%;background:#d4a843;border-radius:99px;transition:width .35s ease}
.avatar{width:38px;height:38px;border-radius:50%;background:rgba(212,168,67,.15);border:1px solid rgba(212,168,67,.28);display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:700;color:#d4a843;flex-shrink:0}
.s-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.55rem 0;border-bottom:1px solid rgba(255,255,255,.05)}
.s-row:last-child{border-bottom:none}
.fb{border:1px solid rgba(255,255,255,.08);border-radius:11px;overflow:hidden;margin-bottom:.85rem}
.fb.warn{border-color:rgba(196,122,58,.38)}
.fb-head{background:rgba(255,255,255,.035);padding:.36rem .9rem;display:flex;justify-content:space-between;align-items:center}
.fb-team{display:flex;align-items:center;gap:.42rem;padding:.82rem .9rem;flex-wrap:wrap}
.fb-team-a{background:rgba(212,168,67,.05)}
.fb-team-b{background:rgba(74,138,106,.05)}
.fb-team+.fb-team{border-top:1px solid rgba(255,255,255,.055)}
.chip{background:rgba(212,168,67,.13);border:1px solid rgba(212,168,67,.24);border-radius:6px;padding:.26rem .62rem;font-size:.82rem;font-weight:500;white-space:nowrap;display:inline-flex;align-items:center;gap:.3rem}
.chip-b{background:rgba(74,138,106,.15);border-color:rgba(74,138,106,.35);color:#8ecfb0}
.chip-dup{background:rgba(196,122,58,.18);border-color:rgba(196,122,58,.45);color:#e89060}
.dup-dot{width:6px;height:6px;border-radius:50%;background:#c47a3a;flex-shrink:0;display:inline-block}
.vs-line{text-align:center;padding:.12rem;background:rgba(0,0,0,.18);font-size:.6rem;color:rgba(255,255,255,.1);letter-spacing:.18em}
.fpill{margin-left:auto;font-size:.68rem;color:#6b8c76;background:rgba(107,158,120,.1);border:1px solid rgba(107,158,120,.18);border-radius:99px;padding:.1rem .48rem;white-space:nowrap}
.wpill{font-size:.65rem;color:#c47a3a;background:rgba(196,122,58,.1);border:1px solid rgba(196,122,58,.22);border-radius:99px;padding:.1rem .48rem}
.team-pill-a{font-size:.65rem;color:#d4a843;background:rgba(212,168,67,.12);border:1px solid rgba(212,168,67,.25);border-radius:99px;padding:.1rem .5rem;font-weight:500}
.team-pill-b{font-size:.65rem;color:#8ecfb0;background:rgba(74,138,106,.15);border:1px solid rgba(74,138,106,.3);border-radius:99px;padding:.1rem .5rem;font-weight:500}
.dayn{font-family:'Cormorant Garamond',serif;font-size:5rem;font-weight:700;color:rgba(212,168,67,.1);line-height:1;margin-right:.6rem;user-select:none}
.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:0}
.pi{display:flex;align-items:center;gap:.5rem;padding:.35rem 0;font-size:.875rem;border-bottom:1px solid rgba(255,255,255,.04)}
.pidx{color:rgba(255,255,255,.18);font-family:'DM Mono',monospace;font-size:.72rem;width:18px;text-align:right;flex-shrink:0}
hr{border:none;border-top:1px solid rgba(255,255,255,.08);margin:1.25rem 0}
.feat{display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.65rem}
.ficon{width:26px;height:26px;border-radius:6px;background:rgba(212,168,67,.15);border:1px solid rgba(212,168,67,.26);display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0;margin-top:.1rem}
.ftxt{font-size:.84rem;color:#9ab8a4;line-height:1.45}
.ftxt b{color:#d4a843;font-weight:500}
.team-col{flex:1;min-width:0}
.team-header-a{background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.22);border-radius:8px 8px 0 0;padding:.5rem .75rem;display:flex;align-items:center;justify-content:space-between}
.team-header-b{background:rgba(74,138,106,.1);border:1px solid rgba(74,138,106,.22);border-radius:8px 8px 0 0;padding:.5rem .75rem;display:flex;align-items:center;justify-content:space-between}
.team-body{border:1px solid rgba(255,255,255,.07);border-top:none;border-radius:0 0 8px 8px;min-height:200px;padding:.4rem}
.player-token{display:flex;align-items:center;justify-content:space-between;padding:.4rem .55rem;border-radius:6px;margin-bottom:.3rem;cursor:pointer;transition:background .12s;font-size:.82rem;user-select:none}
.player-token-a{background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.15)}
.player-token-a:hover{background:rgba(212,168,67,.14)}
.player-token-b{background:rgba(74,138,106,.08);border:1px solid rgba(74,138,106,.15)}
.player-token-b:hover{background:rgba(74,138,106,.14)}
.token-arrow{font-size:.9rem;opacity:.4}
.score-bar{display:flex;gap:.5rem;margin-bottom:1.5rem;padding:.75rem 1rem;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);align-items:center}
.score-num{font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700;line-height:1}
@media(max-width:400px){.pgrid{grid-template-columns:1fr}}
`;

// ─── Steps indicator ──────────────────────────────────────────────────────────

function Steps({ cur }) {
  return (
    <div className="steps">
      {[0,1,2,3].map(i => (
        <div key={i} className={`step${i===cur?" on":i<cur?" done":""}`}/>
      ))}
    </div>
  );
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

function Welcome({ onStart, onGenerate }) {
  return (
    <div>
      <div style={{textAlign:"center",padding:"1.75rem 0 2rem"}}>
        <div style={{fontSize:"2rem",marginBottom:".6rem"}}>⛳</div>
        <h1 className="display">Golf Pairings</h1>
        <p className="muted" style={{marginTop:".5rem"}}>2-day team four-ball scheduler</p>
      </div>

      <div className="card" style={{marginBottom:"1.5rem"}}>
        {[
          ["🤝", <><b>Day 1</b> — Least-familiar partners · Familiar opponents</>],
          ["🏆", <><b>Day 2</b> — Most-familiar partners · Fresh opponents</>],
          ["👕", <><b>Team format</b> — 2 teams of 6, every four-ball is Team A vs Team B</>],
          ["🔄", <><b>No repeats</b> — Same four-ball avoided across both days</>],
        ].map(([icon,text],i) => (
          <div key={i} className="feat">
            <div className="ficon">{icon}</div>
            <div className="ftxt">{text}</div>
          </div>
        ))}
      </div>

      <button className="btn btn-gold btn-full" onClick={onGenerate}>
        Generate Pairings Now ↓
      </button>
      <button className="btn btn-ghost btn-full" style={{marginTop:".6rem"}} onClick={onStart}>
        Update Player History →
      </button>
    </div>
  );
}

// ─── Team Assignment ──────────────────────────────────────────────────────────

function TeamAssign({ teams, matrix, onChange, onGenerate, onBack }) {
  const [t, setT] = useState([...teams]);

  const toggle = (i) => {
    const next = [...t];
    next[i] = next[i] === 0 ? 1 : 0;
    setT(next);
    onChange(next);
  };

  const autoBalance = () => {
    // Sort players by total familiarity, alternate A/B
    const totals = PLAYERS.map((_,i) => ({i, sum: matrix[i].reduce((a,b)=>a+b,0)}));
    totals.sort((a,b) => b.sum - a.sum);
    const next = [...t];
    totals.forEach(({i}, rank) => { next[i] = rank % 2 === 0 ? 0 : 1; });
    setT(next);
    onChange(next);
  };

  const countA = t.filter(x => x===0).length;
  const countB = t.filter(x => x===1).length;
  const valid = countA === 6 && countB === 6;

  const teamA = PLAYERS.map((_,i)=>i).filter(i=>t[i]===0);
  const teamB = PLAYERS.map((_,i)=>i).filter(i=>t[i]===1);

  return (
    <div>
      <Steps cur={2}/>
      <h2 className="heading" style={{marginBottom:".2rem"}}>Assign Teams</h2>
      <p className="muted" style={{marginBottom:"1.25rem"}}>
        Tap a player to move them · Each team needs exactly 6
      </p>

      <div style={{display:"flex",gap:".6rem",marginBottom:"1rem"}}>
        <div className="team-col">
          <div className="team-header-a">
            <span style={{fontSize:".78rem",fontWeight:600,color:"#d4a843"}}>Team A</span>
            <span style={{fontSize:".72rem",color:countA===6?"#d4a843":"#c47a3a",fontFamily:"'DM Mono',monospace"}}>{countA}/6</span>
          </div>
          <div className="team-body">
            {teamA.map(i => (
              <div key={i} className="player-token player-token-a" onClick={()=>toggle(i)}>
                <span>{PLAYERS[i]}</span>
                <span className="token-arrow">→</span>
              </div>
            ))}
          </div>
        </div>

        <div className="team-col">
          <div className="team-header-b">
            <span style={{fontSize:".78rem",fontWeight:600,color:"#8ecfb0"}}>Team B</span>
            <span style={{fontSize:".72rem",color:countB===6?"#8ecfb0":"#c47a3a",fontFamily:"'DM Mono',monospace"}}>{countB}/6</span>
          </div>
          <div className="team-body">
            {teamB.map(i => (
              <div key={i} className="player-token player-token-b" onClick={()=>toggle(i)}>
                <span className="token-arrow">←</span>
                <span>{PLAYERS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="btn btn-ghost btn-full" style={{marginBottom:".6rem"}} onClick={autoBalance}>
        ⚖ Auto-balance by familiarity
      </button>

      <div style={{display:"flex",gap:".6rem"}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-gold" style={{flex:1}} disabled={!valid} onClick={onGenerate}>
          {valid ? "Generate Schedule →" : `Need ${6-countA} more in A / ${6-countB} more in B`}
        </button>
      </div>
    </div>
  );
}

// ─── Survey ───────────────────────────────────────────────────────────────────

function Survey({ saved, onComplete, onBack, onSave }) {
  const [matrix, setMatrix] = useState(()=>saved.map(r=>[...r]));
  const [page, setPage] = useState(0);

  const totalPages = N - 1;
  const isLast = page === totalPages - 1;

  const set = (j, v) => setMatrix(m=>{
    const next=m.map(r=>[...r]);
    next[page][j]=v; next[j][page]=v;
    return next;
  });

  const others = Array.from({length: N-1-page}, (_,k) => ({
    name: PLAYERS[page+1+k], j: page+1+k,
  }));

  return (
    <div>
      <Steps cur={1}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".2rem"}}>
        <h2 className="heading">Playing History</h2>
        <span style={{color:"#6b8c76",fontFamily:"'DM Mono',monospace",fontSize:".78rem"}}>
          {page+1}/{totalPages}
        </span>
      </div>
      <p className="muted" style={{marginBottom:"1.25rem"}}>
        How often have these pairs played together?
      </p>
      <div className="pbar">
        <div className="pfill" style={{width:`${(page/totalPages)*100}%`}}/>
      </div>
      <div className="card card-g">
        <div style={{display:"flex",alignItems:"center",gap:".7rem",marginBottom:"1rem",
          paddingBottom:".85rem",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          <div className="avatar">{PLAYERS[page].charAt(0)}</div>
          <div>
            <div style={{fontWeight:500,fontSize:".95rem"}}>{PLAYERS[page]}</div>
            <div className="muted">has played together with…</div>
          </div>
        </div>
        {others.map(({name,j})=>(
          <div key={j} className="s-row">
            <span style={{fontSize:".88rem"}}>{name}</span>
            <Roller value={matrix[page][j]} onChange={v=>set(j,v)}/>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:".6rem",marginTop:".75rem"}}>
        <button className="btn btn-ghost" onClick={()=>page>0?setPage(p=>p-1):onBack()}>← Back</button>
        <button className="btn btn-gold" style={{flex:1}}
          onClick={()=>{
            onSave && onSave(matrix);
            isLast ? onComplete(matrix) : setPage(p=>p+1);
          }}>
          {isLast?"Save & Set Teams →":`Next: ${PLAYERS[page+1]} →`}
        </button>
      </div>
    </div>
  );
}


// ─── Manual Draw ──────────────────────────────────────────────────────────────

function ManualDraw({ matrix, teams, onBack }) {
  // 3 four-balls, each = [a1, a2, b1, b2] or nulls
  const teamA = PLAYERS.map((_,i)=>i).filter(i=>teams[i]===0);
  const teamB = PLAYERS.map((_,i)=>i).filter(i=>teams[i]===1);

  const emptyFBs = () => [[null,null,null,null],[null,null,null,null],[null,null,null,null]];
  const [day1, setDay1] = useState(emptyFBs);
  const [day2, setDay2] = useState(emptyFBs);

  const usedInDay = (fbs) => {
    const used = new Set();
    fbs.forEach(fb => fb.forEach(p => { if(p!==null) used.add(p); }));
    return used;
  };

  const setPlayer = (day, fbIdx, slot, player) => {
    const setter = day===1 ? setDay1 : setDay2;
    setter(prev => {
      const next = prev.map(fb=>[...fb]);
      // Clear player from any other slot first
      next.forEach((fb,fi) => fb.forEach((p,si) => {
        if(p===player && !(fi===fbIdx && si===slot)) next[fi][si]=null;
      }));
      next[fbIdx][slot] = player;
      return next;
    });
  };

  const clearSlot = (day, fbIdx, slot) => {
    const setter = day===1 ? setDay1 : setDay2;
    setter(prev => { const next=prev.map(fb=>[...fb]); next[fbIdx][slot]=null; return next; });
  };

  const isComplete = (fbs) => fbs.every(fb => fb.every(p=>p!==null));

  const SlotPicker = ({day, fbIdx, slot, label, teamIdx, color}) => {
    const fbs = day===1 ? day1 : day2;
    const current = fbs[fbIdx][slot];
    const used = usedInDay(fbs);
    const pool = teamIdx===0 ? teamA : teamB;

    return (
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:".6rem",color:"#6b8c76",marginBottom:".25rem",
          textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
        <select
          value={current ?? ""}
          onChange={e => e.target.value==="" ? clearSlot(day,fbIdx,slot) : setPlayer(day,fbIdx,slot,Number(e.target.value))}
          style={{
            width:"100%", background:"rgba(0,0,0,.35)",
            border:`1px solid ${color}40`,
            borderRadius:6, color: current!==null ? color : "#6b8c76",
            fontSize:".78rem", padding:".38rem .45rem",
            fontFamily:"'Outfit',sans-serif", cursor:"pointer",
            appearance:"none", WebkitAppearance:"none",
          }}
        >
          <option value="">— pick —</option>
          {pool.map(p => (
            <option key={p} value={p}
              disabled={used.has(p) && p!==current}
              style={{color: used.has(p)&&p!==current ? "#4a4a4a":"#e8dfc8"}}>
              {PLAYERS[p]}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const FBCard = ({day, fbIdx, fbs}) => {
    const [a1,a2,b1,b2] = fbs[fbIdx];
    const partnerTagA = a1!==null&&a2!==null ? freqLabel(matrix[a1][a2]) : null;
    const partnerTagB = b1!==null&&b2!==null ? freqLabel(matrix[b1][b2]) : null;

    return (
      <div className="fb" style={{marginBottom:".85rem"}}>
        <div className="fb-head">
          <span className="lbl">Tee Time {fbIdx+1}</span>
          {partnerTagA && <span className="fpill">{partnerTagA}</span>}
        </div>
        <div className="fb-team fb-team-a" style={{gap:".5rem",flexWrap:"wrap"}}>
          <span className="team-pill-a">A</span>
          <SlotPicker day={day} fbIdx={fbIdx} slot={0} label="Partner 1" teamIdx={0} color="#d4a843"/>
          <span style={{color:"rgba(255,255,255,.2)",alignSelf:"flex-end",paddingBottom:".4rem"}}>&amp;</span>
          <SlotPicker day={day} fbIdx={fbIdx} slot={1} label="Partner 2" teamIdx={0} color="#d4a843"/>
        </div>
        <div className="vs-line">VS</div>
        <div className="fb-team fb-team-b" style={{gap:".5rem",flexWrap:"wrap"}}>
          <span className="team-pill-b">B</span>
          <SlotPicker day={day} fbIdx={fbIdx} slot={2} label="Partner 1" teamIdx={1} color="#8ecfb0"/>
          <span style={{color:"rgba(255,255,255,.2)",alignSelf:"flex-end",paddingBottom:".4rem"}}>&amp;</span>
          <SlotPicker day={day} fbIdx={fbIdx} slot={3} label="Partner 2" teamIdx={1} color="#8ecfb0"/>
          {partnerTagB && <span className="fpill" style={{marginLeft:"auto"}}>{partnerTagB}</span>}
        </div>
      </div>
    );
  };

  // Cross-day duplicate detection
  const allPairsInDay = (fbs) => {
    const pairs = new Set();
    fbs.forEach(fb => {
      const players = fb.filter(p=>p!==null);
      for(let a=0;a<players.length;a++) for(let b=a+1;b<players.length;b++)
        pairs.add(`${Math.min(players[a],players[b])}-${Math.max(players[a],players[b])}`);
    });
    return pairs;
  };

  const d1pairs = allPairsInDay(day1);
  const d2pairs = allPairsInDay(day2);
  const dupCount = [...d1pairs].filter(k=>d2pairs.has(k)).length;

  return (
    <div>
      <Steps cur={3}/>
      <h1 className="display" style={{marginBottom:".2rem"}}>Manual Draw</h1>
      <p className="muted" style={{marginBottom:"1.5rem"}}>
        Pick partners for each tee time · history tags update automatically
      </p>

      {/* Day 1 */}
      <div style={{marginBottom:"2rem"}}>
        <div style={{display:"flex",alignItems:"flex-end",marginBottom:"1rem"}}>
          <span className="dayn">1</span>
          <div style={{paddingBottom:".55rem"}}>
            <h2 className="heading">Day 1</h2>
            <p className="muted" style={{marginTop:".15rem"}}>Least-familiar partners · Familiar opponents</p>
          </div>
        </div>
        {[0,1,2].map(i=><FBCard key={i} day={1} fbIdx={i} fbs={day1}/>)}
      </div>

      {/* Day 2 */}
      <div style={{marginBottom:"1.5rem"}}>
        <div style={{display:"flex",alignItems:"flex-end",marginBottom:"1rem"}}>
          <span className="dayn">2</span>
          <div style={{paddingBottom:".55rem"}}>
            <h2 className="heading">Day 2</h2>
            <p className="muted" style={{marginTop:".15rem"}}>Most-familiar partners · Fresh opponents</p>
          </div>
        </div>
        {[0,1,2].map(i=><FBCard key={i} day={2} fbIdx={i} fbs={day2}/>)}
      </div>

      {dupCount > 0 && isComplete(day1) && isComplete(day2) && (
        <div style={{display:"flex",gap:".5rem",marginBottom:"1rem",padding:".6rem .8rem",
          background:"rgba(196,122,58,.07)",border:"1px solid rgba(196,122,58,.2)",borderRadius:8}}>
          <span>⚠️</span>
          <span style={{fontSize:".78rem",color:"#c47a3a"}}>
            <b style={{fontWeight:600}}>{dupCount} pair{dupCount!==1?"s":""}</b> appear in the same four-ball on both days
          </span>
        </div>
      )}

      <hr/>
      <button className="btn btn-ghost btn-full" onClick={onBack}>← Back to Auto Schedule</button>
    </div>
  );
}

// ─── Results ─────────────────────────────────────────────────────────────────

function Results({ matrix, teams, onEditTeams, onEditHistory, onReset, onManual }) {
  const [schedules, setSchedules] = useState(()=>buildSchedules(matrix, teams));
  const [gen, setGen] = useState(0);

  const regenerate = () => {
    setSchedules(buildSchedules(matrix, teams, 0.8));
    setGen(g=>g+1);
  };

  const {day1, day2, base} = schedules;

  // Find cross-day duplicate players
  const d1pairs = new Set();
  for (const fb of day1)
    for (let a=0; a<4; a++) for (let b=a+1; b<4; b++)
      d1pairs.add(`${Math.min(fb[a],fb[b])}-${Math.max(fb[a],fb[b])}`);
  const d2pairs = new Set();
  for (const fb of day2)
    for (let a=0; a<4; a++) for (let b=a+1; b<4; b++)
      d2pairs.add(`${Math.min(fb[a],fb[b])}-${Math.max(fb[a],fb[b])}`);
  const dupPlayers = new Set();
  for (const key of d1pairs)
    if (d2pairs.has(key)) key.split('-').forEach(p=>dupPlayers.add(Number(p)));

  const isDup = p => dupPlayers.has(p);
  const isA = p => teams[p] === 0;

  const Chip = ({p}) => (
    <span className={`chip${!isA(p)?" chip-b":""}${isDup(p)?" chip-dup":""}`}>
      {PLAYERS[p]}
      {isDup(p) && <span className="dup-dot"/>}
    </span>
  );

  const days = [
    {key:"d1",n:"1",label:"Day 1",desc:"Least-familiar partners · Familiar opponents",data:day1},
    {key:"d2",n:"2",label:"Day 2",desc:"Most-familiar partners · Fresh opponents",    data:day2},
  ];

  return (
    <div>
      <Steps cur={3}/>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:".2rem"}}>
        <h1 className="display">Schedule</h1>
        <span className="muted" style={{fontSize:".72rem",fontFamily:"'DM Mono',monospace"}}>#{gen+1}</span>
      </div>
      <p className="muted" style={{marginBottom:"1rem"}}>12 matches across 2 days · 6 pts per day</p>

      {/* Team legend */}
      <div style={{display:"flex",gap:".5rem",marginBottom:"1rem",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:".4rem",padding:".35rem .65rem",
          background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",borderRadius:7}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:"#d4a843",display:"inline-block"}}/>
          <span style={{fontSize:".78rem",color:"#d4a843",fontWeight:500}}>Team A</span>
          <span className="muted" style={{fontSize:".72rem"}}>
            {PLAYERS.filter((_,i)=>teams[i]===0).map(n=>n.split(" ")[0]).join(", ")}
          </span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:".4rem",padding:".35rem .65rem",
          background:"rgba(74,138,106,.08)",border:"1px solid rgba(74,138,106,.22)",borderRadius:7}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:"#8ecfb0",display:"inline-block"}}/>
          <span style={{fontSize:".78rem",color:"#8ecfb0",fontWeight:500}}>Team B</span>
          <span className="muted" style={{fontSize:".72rem"}}>
            {PLAYERS.filter((_,i)=>teams[i]===1).map(n=>n.split(" ")[0]).join(", ")}
          </span>
        </div>
      </div>

      {dupPlayers.size > 0 && (
        <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:"1.5rem",
          padding:".6rem .8rem",background:"rgba(196,122,58,.07)",
          border:"1px solid rgba(196,122,58,.2)",borderRadius:8}}>
          <span>⚠️</span>
          <span style={{fontSize:".78rem",color:"#c47a3a"}}>
            <b style={{fontWeight:600}}>{dupPlayers.size} player{dupPlayers.size!==1?"s":""}</b> share a four-ball on both days — unavoidable with 12 players
          </span>
        </div>
      )}

      {days.map(({key,n,label,desc,data})=>(
        <div key={key} style={{marginBottom:"2.5rem"}}>
          <div style={{display:"flex",alignItems:"flex-end",marginBottom:"1rem"}}>
            <span className="dayn">{n}</span>
            <div style={{paddingBottom:".55rem"}}>
              <h2 className="heading">{label}</h2>
              <p className="muted" style={{marginTop:".15rem"}}>{desc}</p>
            </div>
          </div>

          {data.map((fb,i)=>{
            const [a1,a2,b1,b2]=fb;
            const hasDup=[a1,a2,b1,b2].some(isDup);
            return (
              <div key={`${key}-${i}-${gen}`} className={`fb${hasDup?" warn":""}`}>
                <div className="fb-head">
                  <span className="lbl">Tee Time {i+1}</span>
                  <div style={{display:"flex",gap:".35rem",alignItems:"center"}}>
                    {hasDup && <span className="wpill">⚠ repeat players</span>}
                  </div>
                </div>
                <div className="fb-team fb-team-a">
                  <span className="team-pill-a">A</span>
                  <Chip p={a1}/>
                  <span style={{color:"rgba(255,255,255,.15)",fontSize:".78rem"}}>&amp;</span>
                  <Chip p={a2}/>
                  <span className="fpill">{freqLabel(base[a1][a2])}</span>
                </div>
                <div className="vs-line">VS</div>
                <div className="fb-team fb-team-b">
                  <span className="team-pill-b">B</span>
                  <Chip p={b1}/>
                  <span style={{color:"rgba(255,255,255,.15)",fontSize:".78rem"}}>&amp;</span>
                  <Chip p={b2}/>
                  <span className="fpill">{freqLabel(base[b1][b2])}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <hr/>
      <button className="btn btn-gold btn-full" style={{marginBottom:".6rem"}} onClick={regenerate}>
        ↺ Regenerate
      </button>
      <button className="btn btn-teal btn-full" style={{marginBottom:".6rem"}} onClick={onManual}>
        ✏️ Manual Draw
      </button>
      <div style={{display:"flex",gap:".6rem"}}>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onEditTeams}>← Edit Teams</button>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onEditHistory}>Edit History</button>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}

// ─── Storage abstraction ─────────────────────────────────────────────────────
// Uses window.storage in Claude artifact, falls back to localStorage on Vercel

const store = {
  async get(key) {
    try {
      if (typeof window.storage !== 'undefined') {
        const r = await window.storage.get(key);
        return r ? r.value : null;
      }
    } catch(_) {}
    try { return localStorage.getItem(key); } catch(_) { return null; }
  },
  async set(key, value) {
    try {
      if (typeof window.storage !== 'undefined') {
        await window.storage.set(key, value); return;
      }
    } catch(_) {}
    try { localStorage.setItem(key, value); } catch(_) {}
  },
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("welcome"); // welcome|survey|teams|results|manual
  const [matrix, setMatrix] = useState(()=>defaultMatrix());
  const [teams, setTeams] = useState(()=>defaultTeams());
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    (async()=>{
      const r = await store.get("golf_matrix");
      if (r) { try { setMatrix(JSON.parse(r)); } catch(_){} }
      const t = await store.get("golf_teams");
      if (t) { try { setTeams(JSON.parse(t)); } catch(_){} }
      setReady(true);
    })();
  },[]);

  const saveMatrix = async m => { await store.set("golf_matrix", JSON.stringify(m)); };
  const saveTeams = async t => { await store.set("golf_teams", JSON.stringify(t)); };

  const handleHistoryComplete = m => {
    setMatrix(m); saveMatrix(m);
    setScreen("teams");
  };

  const handleTeamsChange = t => {
    setTeams(t); saveTeams(t);
  };

  const handleReset = () => {
    const m = defaultMatrix(), t = defaultTeams();
    setMatrix(m); setTeams(t);
    saveMatrix(m); saveTeams(t);
    setScreen("welcome");
  };

  if (!ready) return (
    <>
      <style>{CSS}</style>
      <div className="wrap" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}>
        <span className="muted">Loading…</span>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="wrap">
        {screen==="welcome"  && <Welcome onStart={()=>setScreen("survey")} onGenerate={()=>setScreen("teams")}/>}
        {screen==="survey"   && <Survey saved={matrix} onComplete={handleHistoryComplete} onBack={()=>setScreen("welcome")} onSave={m=>{setMatrix(m);saveMatrix(m);}}/>}
        {screen==="teams"    && <TeamAssign teams={teams} matrix={matrix} onChange={handleTeamsChange}
                                  onGenerate={()=>setScreen("results")} onBack={()=>setScreen("welcome")}/>}
        {screen==="results"  && <Results matrix={matrix} teams={teams}
                                  onEditTeams={()=>setScreen("teams")}
                                  onEditHistory={()=>setScreen("survey")}
                                  onManual={()=>setScreen("manual")}
                                  onReset={handleReset}/>}
        {screen==="manual"   && <ManualDraw matrix={matrix} teams={teams} onBack={()=>setScreen("results")}/>}
      </div>
    </>
  );
}
