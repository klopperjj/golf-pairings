import { useState, useEffect, useRef } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLAYERS = [
  "Juan Klopper","Rob Arnold","James Leach","David Harrison",
  "Nic Dunn","Justin Garner","Ross Andrews","Byron Roos",
  "Kyle Dunn","Jean-Paul Du Toit","Jason Airey","Mike Du Toit"
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
  return i >= 0 ? i : 0; // default → Weekly
}
function freqLabel(v) { return FREQ[freqIdx(v)].label; }

// ─── Algorithm ────────────────────────────────────────────────────────────────

function makeMatrix(n, v = 0) {
  return Array.from({ length: n }, () => Array(n).fill(v));
}

// Pre-populated from Juan Klopper's survey (page 1).
// All pairs default Weekly (52); exceptions listed below.
// Indices: 0=Juan,1=Rob,2=James,3=David,4=Nic,5=Justin,
//          6=Ross,7=Byron,8=Kyle,9=Jean-Paul,10=Jason,11=Mike
function defaultMatrix() {
  const m = makeMatrix(N, 0);
  // Complete 66-pair history from survey screenshots
  // 0=Juan,1=Rob,2=James,3=David,4=Nic,5=Justin,
  // 6=Ross,7=Byron,8=Kyle,9=JP,10=Jason,11=Mike
  [
    [0,1,52],[0,2,52],[0,3,2],[0,4,4],[0,5,4],[0,6,12],[0,8,.5],
    [1,2,52],[1,3,6],[1,4,6],[1,5,12],[1,6,12],[1,8,4],[1,9,4],[1,11,4],
    [2,3,2],[2,4,4],[2,5,4],[2,6,12],[2,7,.5],[2,8,2],[2,9,2],[2,11,2],
    [3,4,4],[3,5,12],[3,8,2],[3,9,4],[3,10,4],[3,11,4],
    [4,5,4],[4,8,12],[4,9,4],[4,10,4],[4,11,4],
    [5,8,4],[5,9,4],[5,10,12],[5,11,4],
    [6,7,.5],
    [8,9,2],[8,10,2],[8,11,2],
    [9,10,4],[9,11,12],
    [10,11,6],
  ].forEach(([i,j,v])=>{ m[i][j]=v; m[j][i]=v; });
  return m;
}

function exhaustiveMatching(scoreMatrix, maximise) {
  const n = scoreMatrix.length;
  let bestScore = maximise ? -Infinity : Infinity;
  let bestMatching = null;
  function bt(avail, pairs) {
    if (!avail.length) {
      const s = pairs.reduce((acc, [i, j]) => acc + scoreMatrix[i][j], 0);
      if (maximise ? s > bestScore : s < bestScore) {
        bestScore = s; bestMatching = pairs.map(p => [...p]);
      }
      return;
    }
    const [first, ...rest] = avail;
    for (let k = 0; k < rest.length; k++)
      bt(rest.filter((_, x) => x !== k), [...pairs, [first, rest[k]]]);
  }
  bt(Array.from({ length: n }, (_, i) => i), []);
  return bestMatching;
}

function allGroupings(arr) {
  if (!arr.length) return [[]];
  const [h, ...t] = arr;
  const result = [];
  for (let i = 0; i < t.length; i++)
    for (const sub of allGroupings(t.filter((_, j) => j !== i)))
      result.push([[h, t[i]], ...sub]);
  return result;
}

function buildSchedules(base, jitter=0) {
  const n = base.length;
  // Apply small random jitter so regeneration explores different valid solutions
  const jittered = jitter===0 ? base : base.map(r=>r.map(v=>v+Math.random()*jitter));
  const p1 = exhaustiveMatching(jittered, false);
  const g1s = allGroupings(p1.map((_, i) => i));
  const sG1 = g => g.reduce((s, [pa, pb]) => {
    const [a1,a2]=p1[pa],[b1,b2]=p1[pb];
    return s+jittered[a1][b1]+jittered[a1][b2]+jittered[a2][b1]+jittered[a2][b2];
  }, 0);
  const day1 = g1s.reduce((b,g)=>sG1(g)>sG1(b)?g:b).map(([pa,pb])=>[...p1[pa],...p1[pb]]);

  const w2=base.map(r=>[...r]), against=makeMatrix(n), sameFB=makeMatrix(n,0);
  for (const [a1,a2,b1,b2] of day1) {
    w2[a1][a2]++;w2[a2][a1]++;w2[b1][b2]++;w2[b2][b1]++;
    for (const x of [a1,a2,b1,b2]) for (const y of [a1,a2,b1,b2])
      if (x!==y){against[x][y]++;sameFB[x][y]=1;}
  }

  const PEN=1000;
  // Subtract penalty from w2 for pairs that shared a Day 1 fourball —
  // steers matching away from re-partnering them on Day 2
  const w2m=w2.map(r=>[...r]);
  // Familiar pairs pay a lower penalty — if they must overlap, better it's people who already know each other
  for(let i=0;i<n;i++) for(let j=0;j<n;j++) if(sameFB[i][j]) w2m[i][j]-=(PEN+base[i][j]);

  const p2=exhaustiveMatching(w2m,true);
  const g2s=allGroupings(p2.map((_,i)=>i));

  const sG2=g=>g.reduce((s,[pa,pb])=>{
    const [a1,a2]=p2[pa],[b1,b2]=p2[pb];
    let sc=-(against[a1][b1]+against[a1][b2]+against[a2][b1]+against[a2][b2]);
    // Check ALL 6 pairings within each fourball (partner + opponent pairs)
    const all=[a1,a2,b1,b2];
    for(let i=0;i<4;i++) for(let j=i+1;j<4;j++) sc-=sameFB[all[i]][all[j]]*(PEN+base[all[i]][all[j]]);
    return s+sc;
  },0);
  const day2=g2s.reduce((b,g)=>sG2(g)>sG2(b)?g:b).map(([pa,pb])=>[...p2[pa],...p2[pb]]);

  return {day1,day2,base,w2};
}

// ─── Roller ───────────────────────────────────────────────────────────────────

function Roller({ value, onChange }) {
  const idx = freqIdx(value);
  const [animKey, setAnimKey] = useState(0);
  const dirRef = useRef(null);

  const handleLeft = () => {
    dirRef.current = "bck";
    setAnimKey(k => k + 1);
    onChange(FREQ[(idx - 1 + FREQ.length) % FREQ.length].value);
  };

  const handleRight = () => {
    dirRef.current = "fwd";
    setAnimKey(k => k + 1);
    onChange(FREQ[(idx + 1) % FREQ.length].value);
  };

  const animCls = animKey === 0 ? "" : dirRef.current === "fwd" ? "r-fwd" : "r-bck";

  const arrowStyle = {
    background: "transparent", border: "none",
    color: "rgba(212,168,67,.6)",
    fontSize: "1.7rem", lineHeight: 1,
    padding: "0 .85rem", height: "100%",
    cursor: "pointer",
    fontFamily: "'Cormorant Garamond',serif",
    flexShrink: 0,
    transition: "color .12s, background .12s",
  };

  return (
    <div style={{
      display:"flex", alignItems:"center", flexShrink:0,
      width:196, height:40,
      background:"rgba(0,0,0,.32)",
      border:"1px solid rgba(212,168,67,.26)",
      borderRadius:7, overflow:"hidden",
    }}>
      <button onClick={handleLeft} style={arrowStyle}>‹</button>
      <div style={{
        flex:1, overflow:"hidden", height:"100%",
        display:"flex", alignItems:"center", justifyContent:"center",
        position:"relative",
        borderLeft:"1px solid rgba(212,168,67,.16)",
        borderRight:"1px solid rgba(212,168,67,.16)",
      }}>
        <span
          key={animKey}
          className={animCls}
          style={{
            position:"absolute",
            fontSize:".71rem", color:"#d4a843", fontWeight:500,
            whiteSpace:"nowrap", letterSpacing:".01em",
          }}
        >{FREQ[idx].label}</span>
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
.fb-team+.fb-team{border-top:1px solid rgba(255,255,255,.055)}
.chip{background:rgba(212,168,67,.13);border:1px solid rgba(212,168,67,.24);border-radius:6px;padding:.26rem .62rem;font-size:.82rem;font-weight:500;white-space:nowrap;display:inline-flex;align-items:center;gap:.3rem}
.chip-dup{background:rgba(196,122,58,.18);border-color:rgba(196,122,58,.45);color:#e89060}
.dup-dot{width:6px;height:6px;border-radius:50%;background:#c47a3a;flex-shrink:0;display:inline-block}
.vs-line{text-align:center;padding:.12rem;background:rgba(0,0,0,.18);font-size:.6rem;color:rgba(255,255,255,.1);letter-spacing:.18em}
.fpill{margin-left:auto;font-size:.68rem;color:#6b8c76;background:rgba(107,158,120,.1);border:1px solid rgba(107,158,120,.18);border-radius:99px;padding:.1rem .48rem;white-space:nowrap}
.wpill{font-size:.65rem;color:#c47a3a;background:rgba(196,122,58,.1);border:1px solid rgba(196,122,58,.22);border-radius:99px;padding:.1rem .48rem}
.dayn{font-family:'Cormorant Garamond',serif;font-size:5rem;font-weight:700;color:rgba(212,168,67,.1);line-height:1;margin-right:.6rem;user-select:none}
.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:0}
.pi{display:flex;align-items:center;gap:.5rem;padding:.35rem 0;font-size:.875rem;border-bottom:1px solid rgba(255,255,255,.04)}
.pidx{color:rgba(255,255,255,.18);font-family:'DM Mono',monospace;font-size:.72rem;width:18px;text-align:right;flex-shrink:0}
hr{border:none;border-top:1px solid rgba(255,255,255,.08);margin:1.25rem 0}
.feat{display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.65rem}
.ficon{width:26px;height:26px;border-radius:6px;background:rgba(212,168,67,.15);border:1px solid rgba(212,168,67,.26);display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0;margin-top:.1rem}
.ftxt{font-size:.84rem;color:#9ab8a4;line-height:1.45}
.ftxt b{color:#d4a843;font-weight:500}
@media(max-width:400px){.pgrid{grid-template-columns:1fr}}
`;

// ─── Steps indicator ──────────────────────────────────────────────────────────

function Steps({ cur }) {
  return (
    <div className="steps">
      {[0,1,2].map(i=>(
        <div key={i} className={`step${i===cur?" on":i<cur?" done":""}`}/>
      ))}
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function Welcome({ onStart, onGenerate }) {
  return (
    <div>
      <div style={{textAlign:"center",padding:"1.75rem 0 2rem"}}>
        <div style={{fontSize:"2rem",marginBottom:".6rem"}}>⛳</div>
        <h1 className="display">Golf Pairings</h1>
        <p className="muted" style={{marginTop:".5rem"}}>2-day smart four-ball scheduler</p>
      </div>

      <div className="card card-g" style={{marginBottom:"1.25rem"}}>
        <p className="lbl" style={{marginBottom:".75rem"}}>12 Players</p>
        <div className="pgrid">
          {PLAYERS.map((name,i)=>(
            <div key={i} className="pi">
              <span className="pidx">{i+1}</span>
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{marginBottom:"1.5rem"}}>
        {[
          ["🤝", <><b>Day 1</b> — Least-familiar partners face their most familiar opponents</>],
          ["🏆", <><b>Day 2</b> — Most-familiar partners face fresh opponents</>],
          ["🔄", <><b>No repeats</b> — Same four-ball avoided across both days</>],
        ].map(([icon,text],i)=>(
          <div key={i} className="feat">
            <div className="ficon">{icon}</div>
            <div className="ftxt">{text}</div>
          </div>
        ))}
      </div>

      <button className="btn btn-gold btn-full" onClick={onStart}>
        Update Player History →
      </button>
      <button className="btn btn-ghost btn-full" style={{marginTop:".6rem"}} onClick={onGenerate}>
        Generate Pairings Now ↓
      </button>
    </div>
  );
}

// ─── Survey screen ────────────────────────────────────────────────────────────

function Survey({ saved, onComplete, onBack }) {
  const [matrix, setMatrix] = useState(()=>saved.map(r=>[...r]));
  const [page, setPage] = useState(0);

  const totalPages = N - 1; // pages 0..10
  const isLast = page === totalPages - 1;

  const set = (j, v) => setMatrix(m=>{
    const next=m.map(r=>[...r]);
    next[page][j]=v; next[j][page]=v;
    return next;
  });

  const others = Array.from({length: N-1-page}, (_,k)=>({
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
        <div style={{display:"flex",alignItems:"center",gap:".7rem",marginBottom:"1rem",paddingBottom:".85rem",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
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
        <button className="btn btn-ghost" onClick={()=>page>0?setPage(p=>p-1):onBack()}>
          ← Back
        </button>
        <button className="btn btn-gold" style={{flex:1}}
          onClick={()=>isLast?onComplete(matrix):setPage(p=>p+1)}>
          {isLast?"Generate Schedule →":`Next: ${PLAYERS[page+1]} →`}
        </button>
      </div>
    </div>
  );
}

// ─── Results screen ───────────────────────────────────────────────────────────

function Results({ matrix, onBack, onReset }) {
  const [schedules, setSchedules] = useState(()=>buildSchedules(matrix));
  const [gen, setGen] = useState(0);

  const regenerate = () => {
    setSchedules(buildSchedules(matrix, 0.8));
    setGen(g=>g+1);
  };

  const {day1,day2,base}=schedules;

  // Find every (i,j) pair that appears in the same fourball on BOTH days
  const d1pairs = new Set();
  for(const fb of day1)
    for(let a=0;a<4;a++) for(let b=a+1;b<4;b++)
      d1pairs.add(`${Math.min(fb[a],fb[b])}-${Math.max(fb[a],fb[b])}`);

  const d2pairs = new Set();
  for(const fb of day2)
    for(let a=0;a<4;a++) for(let b=a+1;b<4;b++)
      d2pairs.add(`${Math.min(fb[a],fb[b])}-${Math.max(fb[a],fb[b])}`);

  // Players involved in a cross-day fourball duplicate
  const dupPlayers = new Set();
  for(const key of d1pairs)
    if(d2pairs.has(key)) key.split('-').forEach(p=>dupPlayers.add(Number(p)));

  const isDup = p => dupPlayers.has(p);

  const Chip = ({p, partner}) => (
    <span className={isDup(p)?"chip chip-dup":"chip"}>
      {PLAYERS[p]}
      {isDup(p)&&<span className="dup-dot" title="In same fourball both days"/>}
    </span>
  );

  const days=[
    {key:"d1",n:"1",label:"Day 1",desc:"Least-familiar partners · Familiar opponents",data:day1},
    {key:"d2",n:"2",label:"Day 2",desc:"Most-familiar partners · Fresh opponents",    data:day2},
  ];

  return (
    <div>
      <Steps cur={2}/>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:".2rem"}}>
        <h1 className="display">Schedule</h1>
        <span className="muted" style={{fontSize:".72rem",fontFamily:"'DM Mono',monospace"}}>#{gen+1}</span>
      </div>
      <p className="muted" style={{marginBottom:"1rem"}}>Optimised pairings for the event</p>
      {dupPlayers.size>0&&(
        <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:"1.75rem",padding:".6rem .8rem",background:"rgba(196,122,58,.07)",border:"1px solid rgba(196,122,58,.2)",borderRadius:8}}>
          <span style={{fontSize:"1rem"}}>⚠️</span>
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
                  {hasDup&&<span className="wpill">⚠ repeat players</span>}
                </div>
                <div className="fb-team">
                  <span style={{fontSize:".65rem",color:"#6b8c76",width:12,flexShrink:0}}>A</span>
                  <Chip p={a1}/><span style={{color:"rgba(255,255,255,.15)",fontSize:".78rem"}}>&amp;</span><Chip p={a2}/>
                  <span className="fpill">{freqLabel(base[a1][a2])}</span>
                </div>
                <div className="vs-line">VS</div>
                <div className="fb-team">
                  <span style={{fontSize:".65rem",color:"#6b8c76",width:12,flexShrink:0}}>B</span>
                  <Chip p={b1}/><span style={{color:"rgba(255,255,255,.15)",fontSize:".78rem"}}>&amp;</span><Chip p={b2}/>
                  <span className="fpill">{freqLabel(base[b1][b2])}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <hr/>
      <div style={{display:"flex",gap:".6rem",marginBottom:".6rem"}}>
        <button className="btn btn-gold" style={{flex:1}} onClick={regenerate}>↺ Regenerate</button>
      </div>
      <div style={{display:"flex",gap:".6rem"}}>
        <button className="btn btn-ghost" style={{flex:1}} onClick={onBack}>← Edit History</button>
        <button className="btn btn-ghost"  style={{flex:1}} onClick={onReset}>New Event</button>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,setScreen] = useState("welcome");
  const [matrix,setMatrix] = useState(()=>defaultMatrix());
  const [schedules,setSchedules] = useState(null);
  const [ready,setReady] = useState(false);

  useEffect(()=>{
    (async()=>{
      try {
        const r=await window.storage.get("golf_matrix");
        if(r) setMatrix(JSON.parse(r.value));
      } catch(_){}
      setReady(true);
    })();
  },[]);

  const save=async m=>{
    try{await window.storage.set("golf_matrix",JSON.stringify(m));}catch(_){}
  };

  const handleComplete=m=>{
    setMatrix(m); save(m);
    setScreen("results");
  };

  const handleReset=()=>{
    const blank=defaultMatrix();
    setMatrix(blank); save(blank);
    setSchedules(null); setScreen("survey");
  };

  if(!ready) return(
    <>
      <style>{CSS}</style>
      <div className="wrap" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}>
        <span className="muted">Loading…</span>
      </div>
    </>
  );

  return(
    <>
      <style>{CSS}</style>
      <div className="wrap">
        {screen==="welcome" && <Welcome onStart={()=>setScreen("survey")} onGenerate={()=>setScreen("results")}/>}
        {screen==="survey"  && <Survey saved={matrix} onComplete={handleComplete} onBack={()=>setScreen("welcome")}/>}
        {screen==="results" && <Results matrix={matrix} onBack={()=>setScreen("survey")} onReset={handleReset}/>}
      </div>
    </>
  );
}
