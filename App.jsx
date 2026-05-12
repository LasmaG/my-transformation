import { useState, useEffect, useRef } from "react";

// ── Constants ──────────────────────────────────────────────
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
const MEAL_EMOJI = { Breakfast: "☀️", Lunch: "🌤️", Dinner: "🌙", Snack: "⚡" };
const MACRO_COLORS = { calories: "#ff8c69", protein: "#43c59e", carbs: "#b388ff", fat: "#ff6b81" };
const START_DATE = new Date("2026-05-11");
const TRAIN_TYPES = ["💪 Weights", "🏃 Cardio", "🚶 Walking", "🧘 Flexibility", "⚽ Sport", "🔄 Mixed"];
const MEASURE_FIELDS = [
  { key: "weight",   label: "Weight",   unit: "kg",  desc: null },
  { key: "bodyFat",  label: "Body Fat", unit: "%",   desc: null },
  { key: "waist",    label: "Waist",    unit: "cm",  desc: "Narrowest point" },
  { key: "abdomen",  label: "Abdomen",  unit: "cm",  desc: "Navel / belly button level" },
  { key: "chest",    label: "Chest",    unit: "cm",  desc: null },
  { key: "hips",     label: "Hips",     unit: "cm",  desc: "Widest point" },
  { key: "arms",     label: "Arms",     unit: "cm",  desc: "Flexed bicep" },
  { key: "thighs",   label: "Thighs",   unit: "cm",  desc: "Widest point" },
];
const TABS = [
  { id: "journal", label: "Journal", icon: "🍽" },
  { id: "train",   label: "Training", icon: "🏋️" },
  { id: "body",    label: "Body",    icon: "📏" },
  { id: "stats",   label: "Trends",  icon: "📈" },
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Helpers ────────────────────────────────────────────────
function getDayNumber(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const s = new Date(START_DATE); s.setHours(0,0,0,0);
  return Math.max(1, Math.floor((d - s) / 86400000) + 1);
}
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function todayStr() { return new Date().toISOString().split("T")[0]; }
function monthKey(dateStr) { return dateStr.slice(0, 7); } // "2026-05"
function monthLabel(mk) { const [y, m] = mk.split("-"); return `${MONTHS[parseInt(m)-1]} ${y}`; }
function getWeekDates(referenceDate) {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  ref.setHours(0,0,0,0);
  const day = ref.getDay();
  const monday = new Date(ref); monday.setDate(ref.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}
function getAllMonths(entries, trainDays, measurements) {
  const dates = [
    ...entries.map(e => e.date),
    ...Object.keys(trainDays),
    ...measurements.map(m => m.date),
  ];
  return [...new Set(dates.map(monthKey))].sort();
}
function sumMacro(list, key) { return list.reduce((s, e) => s + (e[key] || 0), 0); }
function readFile(file) {
  return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); });
}
function avg(arr) { return arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0; }

// ── Mini sparkline ─────────────────────────────────────────
function Sparkline({ data, color, height = 40 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TrendChart({ points, color, height = 120, unit = "", decimals = 1 }) {
  if (!points || points.length < 2) return null;
  const vals  = points.map(p => p.val);
  const min   = Math.min(...vals);
  const max   = Math.max(...vals);
  const range = max - min || 0.001;
  const PAD_L = 44, PAD_R = 12, PAD_T = 20, PAD_B = 28;
  const W = 300, H = height;
  const cx = i => PAD_L + (i / (points.length - 1)) * (W - PAD_L - PAD_R);
  const cy = v => PAD_T + (1 - (v - min) / range) * (H - PAD_T - PAD_B);

  const pathD = points.map((p, i) => {
    const x = cx(i), y = cy(p.val);
    if (i === 0) return `M${x},${y}`;
    const px = cx(i - 1), py = cy(points[i - 1].val);
    const cpx = (px + x) / 2;
    return `C${cpx},${py} ${cpx},${y} ${x},${y}`;
  }).join(" ");

  const yTicks = range < 0.01 ? [min] : [min, (min + max) / 2, max];
  const dateIdxs = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const shortDate = d => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const gradId = `grad${color.replace(/[^a-z0-9]/gi,"")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height, display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={cy(tick)} x2={W - PAD_R} y2={cy(tick)} stroke="#3d3d55" strokeWidth="1" strokeDasharray="3,3" />
          <text x={PAD_L - 5} y={cy(tick) + 4} textAnchor="end" fontSize="9" fill="#6e6c85" fontFamily="Georgia,serif">
            {tick.toFixed(decimals)}{unit}
          </text>
        </g>
      ))}
      <path d={pathD + ` L${cx(points.length-1)},${H-PAD_B} L${cx(0)},${H-PAD_B} Z`} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const x = cx(i), y = cy(p.val);
        const showVal = points.length <= 8 || i === 0 || i === points.length - 1 || i === Math.floor((points.length-1)/2);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="3.5" fill="#2a2a3d" stroke={color} strokeWidth="2" />
            {showVal && <text x={x} y={y - 9} textAnchor="middle" fontSize="9" fill={color} fontFamily="Georgia,serif">{p.val.toFixed(decimals)}{unit}</text>}
          </g>
        );
      })}
      {dateIdxs.map(i => (
        <text key={i} x={cx(i)} y={H - 5} textAnchor={i===0?"start":i===points.length-1?"end":"middle"} fontSize="8.5" fill="#6e6c85" fontFamily="Georgia,serif">
          {shortDate(points[i].date)}
        </text>
      ))}
    </svg>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const today = todayStr();

  // ── localStorage helpers ──
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  // Core data — persisted
  const [entries, _setEntries]           = useState(() => load("tf_entries", []));
  const [activeBurned, _setActiveBurned] = useState(() => load("tf_burned", {}));
  const [goals, _setGoals]               = useState(() => load("tf_goals", { calories: "", protein: "", carbs: "", fat: "" }));
  const [trainSessions, _setTrainSessions] = useState(() => load("tf_train", {}));
  const [measurements, _setMeasurements] = useState(() => load("tf_measurements", []));
  const [progressPhotos, _setProgressPhotos] = useState(() => load("tf_photos", []));

  // Wrapped setters that also persist
  function setEntries(v) { const next = typeof v === "function" ? v(entries) : v; _setEntries(next); save("tf_entries", next); }
  function setActiveBurned(v) { const next = typeof v === "function" ? v(activeBurned) : v; _setActiveBurned(next); save("tf_burned", next); }
  function setGoals(v) { const next = typeof v === "function" ? v(goals) : v; _setGoals(next); save("tf_goals", next); }
  function setTrainSessions(v) { const next = typeof v === "function" ? v(trainSessions) : v; _setTrainSessions(next); save("tf_train", next); }
  function setMeasurements(v) { const next = typeof v === "function" ? v(measurements) : v; _setMeasurements(next); save("tf_measurements", next); }
  function setProgressPhotos(v) { const next = typeof v === "function" ? v(progressPhotos) : v; _setProgressPhotos(next); save("tf_photos", next); }

  const [showGoalsForm, setShowGoalsForm] = useState(false);
  const [goalsInput, setGoalsInput]     = useState({ calories: "", protein: "", carbs: "", fat: "" });

  // UI state
  const [tab, setTab]               = useState("journal");
  const [lightbox, setLightbox]     = useState(null);

  // Journal
  const [showMealForm, setShowMealForm]   = useState(false);
  const [showBurnForm, setShowBurnForm]   = useState(false);
  const [mealForm, setMealForm]           = useState({ date: today, type: "Breakfast", name: "", calories: "", protein: "", carbs: "", fat: "", notes: "", photo: null });
  const [burnForm, setBurnForm]           = useState({ date: today, active: "", note: "" });
  const [journalFilter, setJournalFilter] = useState("today");
  const mealPhotoRef = useRef();

  // Training
  const [showTrainForm, setShowTrainForm] = useState(false);
  const [trainForm, setTrainForm]         = useState({ date: today, type: "💪 Weights", duration: "", notes: "" });

  // Body
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [showPhotoForm, setShowPhotoForm]     = useState(false);
  const [measureForm, setMeasureForm]         = useState({ date: today, weight: "", bodyFat: "", waist: "", abdomen: "", chest: "", hips: "", arms: "", thighs: "" });
  const [photoForm, setPhotoForm]             = useState({ date: today, photo: null, notes: "" });
  const [bodyView, setBodyView]               = useState("measurements");
  const progressPhotoRef = useRef();

  // Stats
  const [statsView, setStatsView]   = useState("weekly");  // weekly | monthly | trends
  const [weekOffset, setWeekOffset] = useState(0);   // 0 = this week, -1 = last week …
  const [monthOffset, setMonthOffset] = useState(0); // 0 = this month

  // ── Derived ──────────────────────────────────────────────
  const activeDay = journalFilter === "today" || journalFilter === "all" ? today : journalFilter;

  // Active week dates (with offset)
  const weekDates = getWeekDates((() => { const d = new Date(); d.setDate(d.getDate() + weekOffset * 7); return d; })());

  // Active month
  const allAvailMonths = getAllMonths(entries, trainSessions, measurements);
  const thisMonthKey = monthKey(today);
  const allMonthsSorted = [...new Set([...allAvailMonths, thisMonthKey])].sort();
  const activeMonthIdx = Math.max(0, allMonthsSorted.length - 1 + monthOffset);
  const activeMonthKey = allMonthsSorted[activeMonthIdx] || thisMonthKey;

  // Journal computed
  const allMealDates = [...new Set(entries.map(e => e.date))].sort((a,b) => b.localeCompare(a));
  const filteredEntries = journalFilter === "today" ? entries.filter(e => e.date === today)
    : journalFilter === "all" ? entries
    : entries.filter(e => e.date === journalFilter);

  const dayEntries = entries.filter(e => e.date === activeDay);
  const dayCalIn   = sumMacro(dayEntries, "calories");
  const dayActive  = activeBurned[activeDay] || 0;
  const dayDeficit = dayActive - dayCalIn;
  const dayMacros  = { calories: dayCalIn, protein: sumMacro(dayEntries,"protein"), carbs: sumMacro(dayEntries,"carbs"), fat: sumMacro(dayEntries,"fat") };

  // Week computed
  const weekCalIn      = sumMacro(entries.filter(e => weekDates.includes(e.date)), "calories");
  const weekActive     = weekDates.reduce((s,d) => s + (activeBurned[d]||0), 0);
  const weekDeficit    = weekActive - weekCalIn;
  const weekTrainCount = weekDates.filter(d => (trainSessions[d]||[]).length > 0).length;
  const weekMacros     = { calories: weekCalIn, protein: sumMacro(entries.filter(e=>weekDates.includes(e.date)),"protein"), carbs: sumMacro(entries.filter(e=>weekDates.includes(e.date)),"carbs"), fat: sumMacro(entries.filter(e=>weekDates.includes(e.date)),"fat") };

  const weekByDay = weekDates.map(date => {
    const de = entries.filter(e => e.date === date);
    const calIn = sumMacro(de,"calories");
    const active = activeBurned[date]||0;
    return { date, entries: de, calories: calIn, active, totalBurned: active, deficit: active - calIn, protein: sumMacro(de,"protein"), carbs: sumMacro(de,"carbs"), fat: sumMacro(de,"fat"), sessions: trainSessions[date]||[] };
  });
  const maxWeekVal = Math.max(...weekByDay.map(d => Math.max(d.calories, d.active)), 500);

  // Month computed
  const monthEntries   = entries.filter(e => monthKey(e.date) === activeMonthKey);
  const monthDates     = [...new Set(monthEntries.map(e=>e.date))];
  const monthCalIn     = sumMacro(monthEntries,"calories");
  const monthActive    = Object.entries(activeBurned).filter(([d])=>monthKey(d)===activeMonthKey).reduce((s,[,v])=>s+v,0);
  const monthDaysLogged = monthDates.length;
  const monthTrainDays = Object.keys(trainSessions).filter(d=>monthKey(d)===activeMonthKey&&(trainSessions[d]||[]).length>0).length;
  const monthDeficit   = monthActive - monthCalIn;

  // Trend data (all time)
  const weightTrend  = measurements.filter(m=>m.weight).map(m=>({ date:m.date, val:parseFloat(m.weight) })).sort((a,b)=>a.date.localeCompare(b.date));
  const waistTrend   = measurements.filter(m=>m.waist).map(m=>({ date:m.date, val:parseFloat(m.waist) })).sort((a,b)=>a.date.localeCompare(b.date));
  const abdomenTrend  = measurements.filter(m=>m.abdomen).map(m=>({ date:m.date, val:parseFloat(m.abdomen) })).sort((a,b)=>a.date.localeCompare(b.date));
  const bodyFatTrend  = measurements.filter(m=>m.bodyFat).map(m=>({ date:m.date, val:parseFloat(m.bodyFat) })).sort((a,b)=>a.date.localeCompare(b.date));

  // Grouped journal
  const grouped = {};
  filteredEntries.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = {};
    if (!grouped[e.date][e.type]) grouped[e.date][e.type] = [];
    grouped[e.date][e.type].push(e);
  });
  const sortedMealDates = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  // ── Actions ───────────────────────────────────────────────
  function addMeal() {
    if (!mealForm.name.trim()) return;
    setEntries(p => [...p, { ...mealForm, id: Date.now(), calories: mealForm.calories?parseInt(mealForm.calories):null, protein: mealForm.protein?parseInt(mealForm.protein):null, carbs: mealForm.carbs?parseInt(mealForm.carbs):null, fat: mealForm.fat?parseInt(mealForm.fat):null }]);
    setMealForm(f => ({ ...f, name:"", calories:"", protein:"", carbs:"", fat:"", notes:"", photo:null }));
    setShowMealForm(false);
  }
  function deleteMeal(id) { setEntries(e=>e.filter(x=>x.id!==id)); }

  function saveBurn() {
    if (!burnForm.active) return;
    setActiveBurned(b => ({ ...b, [burnForm.date]: parseInt(burnForm.active) }));
    setBurnForm(f => ({ ...f, active:"", note:"" }));
    setShowBurnForm(false);
  }

  function addTrainSession() {
    if (!trainForm.type) return;
    const session = { id: Date.now(), type: trainForm.type, duration: trainForm.duration, notes: trainForm.notes };
    setTrainSessions(t => ({ ...t, [trainForm.date]: [...(t[trainForm.date]||[]), session] }));
    setTrainForm(f => ({ ...f, type:"💪 Weights", duration:"", notes:"" }));
    setShowTrainForm(false);
  }
  function deleteSession(date, id) {
    setTrainSessions(t => ({ ...t, [date]: (t[date]||[]).filter(s=>s.id!==id) }));
  }

  function saveMeasurement() {
    const hasData = MEASURE_FIELDS.some(f=>measureForm[f.key]);
    if (!hasData) return;
    setMeasurements(p => { const filtered = p.filter(m=>m.date!==measureForm.date); return [...filtered,{...measureForm}].sort((a,b)=>a.date.localeCompare(b.date)); });
    setMeasureForm({ date:today, weight:"", bodyFat:"", waist:"", abdomen:"", chest:"", hips:"", arms:"", thighs:"" });
    setShowMeasureForm(false);
  }

  async function handleProgressPhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    const data = await readFile(file);
    setPhotoForm(f=>({...f, photo:data}));
  }
  function saveProgressPhoto() {
    if (!photoForm.photo) return;
    setProgressPhotos(p=>[...p,{...photoForm, id:Date.now()}]);
    setPhotoForm({date:today,photo:null,notes:""});
    setShowPhotoForm(false);
  }

  const latestM = measurements.length>0 ? measurements[measurements.length-1] : null;
  const firstM  = measurements.length>1 ? measurements[0] : null;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#1e1e2e", color:"#eeeaf4", fontFamily:"'Georgia','Times New Roman',serif", paddingBottom:80, background:"#1e1e2e" }}>

      {/* ── Header ── */}
      <div style={{ background:"linear-gradient(135deg,#2a2a3d 0%,#252538 100%)", borderBottom:"1px solid #3d3d55", padding:"20px 20px 0", position:"sticky", top:0, zIndex:20, boxShadow:"0 2px 16px rgba(0,0,0,0.3)" }}>
        <div style={{ maxWidth:520, margin:"0 auto" }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#c4b5a5", textTransform:"uppercase", marginBottom:2 }}>
              Day {getDayNumber(today)} · {new Date().toLocaleDateString("en-US",{month:"long",day:"numeric"})}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h1 style={{ margin:0, fontSize:21, fontWeight:"600", color:"#eeeaf4", letterSpacing:"-0.02em" }}>My Transformation</h1>
              <div style={{ display:"flex", gap:6 }}>
                {tab==="journal" && <>
                  <Btn icon="🎯" active={showGoalsForm} onClick={()=>{setShowGoalsForm(!showGoalsForm);setShowBurnForm(false);setShowMealForm(false);}} title="Set Goals" />
                  <Btn icon="🔥" active={showBurnForm} onClick={()=>{setShowBurnForm(!showBurnForm);setShowMealForm(false);setShowGoalsForm(false);}} />
                  <button onClick={()=>{setShowMealForm(!showMealForm);setShowBurnForm(false);setShowGoalsForm(false);}} style={{ background:showMealForm?"#252538":"#ff8c69", color:showMealForm?"#eeeaf4":"#1e1e2e", border:"none", borderRadius:6, padding:"8px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>{showMealForm?"✕":"+ Meal"}</button>
                </>}
                {tab==="train" && <button onClick={()=>setShowTrainForm(!showTrainForm)} style={{ background:showTrainForm?"#252538":"#43c59e", color:showTrainForm?"#eeeaf4":"#1e1e2e", border:"none", borderRadius:6, padding:"8px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>{showTrainForm?"✕":"+ Session"}</button>}
                {tab==="body" && <div style={{display:"flex",gap:6}}>
                  <Btn icon="📷" active={showPhotoForm} onClick={()=>{setShowPhotoForm(!showPhotoForm);setShowMeasureForm(false);}} />
                  <button onClick={()=>{setShowMeasureForm(!showMeasureForm);setShowPhotoForm(false);}} style={{ background:showMeasureForm?"#252538":"#b388ff", color:showMeasureForm?"#eeeaf4":"#fff", border:"none", borderRadius:6, padding:"8px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>{showMeasureForm?"✕":"+ Measure"}</button>
                </div>}
              </div>
            </div>
          </div>
          <div style={{display:"flex",borderTop:"1px solid #3d3d55"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, background:"none", border:"none", borderBottom:tab===t.id?"2px solid #c8a96e":"2px solid transparent", color:tab===t.id?"#ff8c69":"#6e6c85", padding:"8px 2px 10px", fontSize:9, cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:-1, transition:"all 0.15s" }}>
                <div style={{fontSize:16,marginBottom:3}}>{t.icon}</div>{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:520,margin:"0 auto",padding:"0 20px"}}>

        {/* ══ JOURNAL ══════════════════════════════════════ */}
        {tab==="journal" && <>

          {/* Goals form */}
          {showGoalsForm && <Panel title="🎯 Daily Goals" mt={16}>
            <div style={{fontSize:11,color:"#6e6c85",marginBottom:12}}>Set your daily targets. Progress bars will show on the summary card.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              {[["calories","Calories","kcal","#ff8c69"],["protein","Protein","g","#43c59e"],["carbs","Carbs","g","#b388ff"],["fat","Fat","g","#ff6b81"]].map(([k,l,u,c])=>(
                <div key={k}>
                  <div style={{fontSize:10,color:c,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:5}}>{l} ({u})</div>
                  <input type="number" value={goalsInput[k]||goals[k]||""} onChange={e=>setGoalsInput(g=>({...g,[k]:e.target.value}))} placeholder={`e.g. ${k==="calories"?"2000":k==="protein"?"150":k==="carbs"?"200":"60"}`} style={{width:"100%",background:"#1e1e2e",border:`1px solid ${c}44`,borderRadius:5,padding:"9px 10px",color:"#eeeaf4",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}} />
                </div>
              ))}
            </div>
            <ActionBtn color="#ff8c69" textColor="#1e1e2e" onClick={()=>{setGoals({calories:goalsInput.calories||goals.calories,protein:goalsInput.protein||goals.protein,carbs:goalsInput.carbs||goals.carbs,fat:goalsInput.fat||goals.fat});setShowGoalsForm(false);}}>Save Goals</ActionBtn>
          </Panel>}

          {/* Burn form */}
          {showBurnForm && <Panel title="Log Calories Burned" mt={16}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <Input label="Date" type="date" value={burnForm.date} onChange={v=>setBurnForm(f=>({...f,date:v}))} />
              <Input label="Calories Burned" type="number" value={burnForm.active} onChange={v=>setBurnForm(f=>({...f,active:v}))} placeholder="e.g. 450 kcal" />
            </div>
            <ActionBtn color="#ff6b81" disabled={!burnForm.active} onClick={saveBurn}>🔥 Save Burned Calories</ActionBtn>
          </Panel>}

          {/* Meal form */}
          {showMealForm && <Panel title="New Meal Entry" mt={16}>
            <PhotoUpload photo={mealForm.photo} onPhoto={async e=>{const d=await readFile(e.target.files[0]);setMealForm(f=>({...f,photo:d}));}} onClear={()=>setMealForm(f=>({...f,photo:null}))} fileRef={mealPhotoRef} hint="Add meal photo" />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
              <div style={{gridColumn:"span 2"}}><Input label="Meal name *" value={mealForm.name} onChange={v=>setMealForm(f=>({...f,name:v}))} placeholder="e.g. Crispy Chicken Poke Bowl" /></div>
              <Select label="Type" value={mealForm.type} options={MEALS} onChange={v=>setMealForm(f=>({...f,type:v}))} />
              <Input label="Date" type="date" value={mealForm.date} onChange={v=>setMealForm(f=>({...f,date:v}))} />
              {[["calories","Calories (kcal)","#ff8c69"],["protein","Protein (g)","#43c59e"],["carbs","Carbs (g)","#b388ff"],["fat","Fat (g)","#ff6b81"]].map(([k,l,c])=>(
                <div key={k}>
                  <div style={{fontSize:10,color:"#6e6c85",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:5}}>{l}</div>
                  <input type="number" value={mealForm[k]} onChange={e=>setMealForm(f=>({...f,[k]:e.target.value}))} placeholder="optional" style={{width:"100%",background:"#1e1e2e",border:`1px solid ${c}33`,borderRadius:5,padding:"9px 10px",color:"#eeeaf4",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}} />
                </div>
              ))}
              <div style={{gridColumn:"span 2"}}><Input label="Notes" value={mealForm.notes} onChange={v=>setMealForm(f=>({...f,notes:v}))} placeholder="How did it taste?" /></div>
            </div>
            <ActionBtn color="#ff8c69" textColor="#1e1e2e" disabled={!mealForm.name.trim()} onClick={addMeal} mt={12}>Save Meal</ActionBtn>
          </Panel>}

          {/* Daily summary */}
          {(dayMacros.calories>0||dayActive>0) && <Panel mt={16}>
            <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.2em",marginBottom:12}}>
              {journalFilter==="today"?"Today":`Day ${getDayNumber(activeDay)}`}'s Summary
            </div>
            <MacroGrid macros={dayMacros} />
            {(dayActive>0||dayCalIn>0) && <div style={{borderTop:"1px solid #3d3d55",marginTop:12,paddingTop:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                <StatBox label="Eaten" value={dayCalIn} unit="kcal" color={MACRO_COLORS.calories} />
                <StatBox label="Burned🔥" value={dayActive} unit="kcal" color="#ff6b81" />
                <StatBox label={dayDeficit>=0?"Deficit":"Surplus"} value={Math.abs(dayDeficit)} unit="kcal" color={dayDeficit>=0?"#43c59e":"#b388ff"} />
              </div>
              <div style={{display:"flex",justifyContent:"center"}}><DeficitBadge deficit={dayDeficit} size="large" /></div>
            </div>}
            {/* Goals progress */}
            {(goals.calories||goals.protein||goals.carbs||goals.fat) && <GoalProgress macros={dayMacros} goals={goals} />}
          </Panel>}

          {/* Filter */}
          {allMealDates.length>0 && <div style={{display:"flex",gap:8,marginTop:16,overflowX:"auto",paddingBottom:4}}>
            <FilterChip active={journalFilter==="today"} onClick={()=>setJournalFilter("today")}>Today</FilterChip>
            <FilterChip active={journalFilter==="all"} onClick={()=>setJournalFilter("all")}>All</FilterChip>
            {allMealDates.filter(d=>d!==today).map(d=><FilterChip key={d} active={journalFilter===d} onClick={()=>setJournalFilter(d)}>Day {getDayNumber(d)}</FilterChip>)}
          </div>}

          {/* Meals */}
          {entries.length===0 ? <EmptyState icon="🍽" text="No meals logged yet" sub="Tap '+ Meal' to begin" />
          : sortedMealDates.length===0 ? <EmptyState icon="🍽" text="No entries for this day" />
          : sortedMealDates.map(date=>(
            <div key={date} style={{marginTop:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <span style={{fontSize:13,color:"#ff8c69",fontStyle:"italic"}}>Day {getDayNumber(date)}</span>
                  <span style={{fontSize:11,color:"#6e6c85",marginLeft:8}}>{formatDate(date)}</span>
                  {(trainSessions[date]||[]).length>0 && <span style={{marginLeft:8,fontSize:11,color:"#43c59e"}}>🏋️×{(trainSessions[date]||[]).length}</span>}
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {activeBurned[date]>0 && <span style={{fontSize:11,color:"#ff6b81"}}>🔥{activeBurned[date]}</span>}
                  <span style={{fontSize:11,color:"#6e6c85"}}>{Object.values(grouped[date]).flat().length} meals</span>
                </div>
              </div>
              {MEALS.filter(m=>grouped[date][m]).map(mealType=>(
                <div key={mealType} style={{marginBottom:8}}>
                  <div style={{fontSize:10,color:"#6e6c85",textTransform:"uppercase",letterSpacing:"0.2em",marginBottom:5,display:"flex",alignItems:"center",gap:5}}>{MEAL_EMOJI[mealType]} {mealType}</div>
                  {grouped[date][mealType].map(entry=>(
                    <div key={entry.id} style={{background:"#2a2a3d",border:"1px solid #3d3d55",borderRadius:8,marginBottom:6,overflow:"hidden"}}>
                      {entry.photo && <div style={{cursor:"zoom-in",position:"relative"}} onClick={()=>setLightbox(entry.photo)}>
                        <img src={entry.photo} alt={entry.name} style={{width:"100%",height:150,objectFit:"cover",display:"block"}} />
                        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 40%,rgba(10,10,20,0.65))"}} />
                      </div>}
                      <div style={{padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,color:"#eeeaf4",marginBottom:5}}>{entry.name}</div>
                          <MacroRow calories={entry.calories} protein={entry.protein} carbs={entry.carbs} fat={entry.fat} />
                          {entry.notes && <div style={{fontSize:11,color:"#6e6c85",fontStyle:"italic",marginTop:4}}>{entry.notes}</div>}
                        </div>
                        <button onClick={()=>deleteMeal(entry.id)} style={{background:"none",border:"none",color:"#4e4c65",cursor:"pointer",fontSize:13,flexShrink:0}}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </>}

        {/* ══ TRAINING ══════════════════════════════════════ */}
        {tab==="train" && <>
          {showTrainForm && <Panel title="Log Training Session" mt={16}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <Input label="Date" type="date" value={trainForm.date} onChange={v=>setTrainForm(f=>({...f,date:v}))} />
              <Select label="Type" value={trainForm.type} options={TRAIN_TYPES} onChange={v=>setTrainForm(f=>({...f,type:v}))} />
              <Input label="Duration (min)" type="number" value={trainForm.duration} onChange={v=>setTrainForm(f=>({...f,duration:v}))} placeholder="e.g. 60" />
              <Input label="Notes" value={trainForm.notes} onChange={v=>setTrainForm(f=>({...f,notes:v}))} placeholder="e.g. Chest & Triceps" />
            </div>
            <div style={{fontSize:11,color:"#6e6c85",marginBottom:10}}>💡 You can add multiple sessions per day (e.g. Weights + Cardio)</div>
            <ActionBtn color="#43c59e" textColor="#1e1e2e" onClick={addTrainSession}>🏋️ Add Session</ActionBtn>
          </Panel>}

          {/* Week grid */}
          <Panel mt={16}>
            <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.2em",marginBottom:14}}>
              This Week · {Object.keys(trainSessions).filter(d=>getWeekDates().includes(d)&&(trainSessions[d]||[]).length>0).length} Active Days
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
              {getWeekDates().map(date=>{
                const sessions = trainSessions[date]||[];
                const isToday = date===today;
                const isFuture = date>today;
                const hasWeights = sessions.some(s=>s.type.includes("Weights")||s.type.includes("Mixed"));
                const hasCardio  = sessions.some(s=>s.type.includes("Cardio"));
                const hasOther   = sessions.some(s=>!s.type.includes("Weights")&&!s.type.includes("Mixed")&&!s.type.includes("Cardio"));
                return (
                  <div key={date} style={{textAlign:"center"}}>
                    <div style={{fontSize:9,color:isToday?"#ff8c69":"#6e6c85",marginBottom:3,letterSpacing:"0.04em"}}>{new Date(date).toLocaleDateString("en-US",{weekday:"short"}).slice(0,2)}</div>
                    <div style={{position:"relative",borderRadius:8,overflow:"hidden",border:isToday?"1px solid #c8a96e":"1px solid #3d3d55",aspectRatio:"1",background:sessions.length>0?"#1a3a2e":"#1e1e2e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,padding:3}}>
                      {sessions.length===0 ? <span style={{fontSize:10,color:"#4e4c65"}}>{isFuture?"":date===today?"·":"·"}</span> : <>
                        {hasWeights && <span style={{fontSize:10}}>💪</span>}
                        {hasCardio  && <span style={{fontSize:10}}>🏃</span>}
                        {hasOther   && <span style={{fontSize:10}}>⚡</span>}
                      </>}
                    </div>
                    <div style={{fontSize:9,color:"#6e6c85",marginTop:2}}>{new Date(date).getDate()}</div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Stats */}
          <Panel mt={10}>
            <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.2em",marginBottom:12}}>All Time</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <StatBox label="Sessions" value={Object.values(trainSessions).flat().length} unit="total" color="#43c59e" />
              <StatBox label="Active Days" value={Object.keys(trainSessions).filter(d=>(trainSessions[d]||[]).length>0).length} unit="days" color="#ff8c69" />
              <StatBox label="This Week" value={weekTrainCount} unit="days" color="#b388ff" />
            </div>
          </Panel>

          {/* Session log */}
          <div style={{marginTop:16}}>
            <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.2em",marginBottom:10}}>Session Log</div>
            {Object.keys(trainSessions).filter(d=>(trainSessions[d]||[]).length>0).sort((a,b)=>b.localeCompare(a)).length===0
              ? <EmptyState icon="🏋️" text="No sessions logged" sub="Tap '+ Session' to start" />
              : Object.keys(trainSessions).filter(d=>(trainSessions[d]||[]).length>0).sort((a,b)=>b.localeCompare(a)).map(date=>(
              <div key={date} style={{marginBottom:14}}>
                <div style={{fontSize:11,color:"#ff8c69",fontStyle:"italic",marginBottom:6}}>Day {getDayNumber(date)} · {formatDate(date)}</div>
                {(trainSessions[date]||[]).map(s=>(
                  <div key={s.id} style={{background:"#2a2a3d",border:"1px solid #3d3d55",borderRadius:8,padding:"10px 12px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,color:"#eeeaf4",marginBottom:3}}>{s.type}{s.duration?` · ${s.duration} min`:""}</div>
                      {s.notes && <div style={{fontSize:11,color:"#9896b0",fontStyle:"italic"}}>{s.notes}</div>}
                    </div>
                    <button onClick={()=>deleteSession(date,s.id)} style={{background:"none",border:"none",color:"#4e4c65",cursor:"pointer",fontSize:13}}>✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>}

        {/* ══ BODY ══════════════════════════════════════════ */}
        {tab==="body" && <>
          {showMeasureForm && <Panel title="Log Measurements" mt={16}>
            <div style={{marginBottom:10}}><Input label="Date" type="date" value={measureForm.date} onChange={v=>setMeasureForm(f=>({...f,date:v}))} /></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              {MEASURE_FIELDS.map(({key,label,unit,desc})=>(
                <div key={key}>
                  <div style={{fontSize:10,color:"#6e6c85",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:2}}>{label} ({unit})</div>
                  {desc && <div style={{fontSize:9,color:"#4e4c65",marginBottom:4,fontStyle:"italic"}}>{desc}</div>}
                  <input type="number" value={measureForm[key]} onChange={e=>setMeasureForm(f=>({...f,[key]:e.target.value}))} placeholder="optional" step="0.1" style={{width:"100%",background:"#1e1e2e",border:"1px solid #a87eb833",borderRadius:5,padding:"9px 10px",color:"#eeeaf4",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}} />
                </div>
              ))}
            </div>
            <ActionBtn color="#b388ff" onClick={saveMeasurement}>📏 Save Measurements</ActionBtn>
          </Panel>}

          {showPhotoForm && <Panel title="Progress Photo" mt={16}>
            <PhotoUpload photo={photoForm.photo} onPhoto={handleProgressPhoto} onClear={()=>setPhotoForm(f=>({...f,photo:null}))} fileRef={progressPhotoRef} hint="Tap to add progress photo" />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
              <Input label="Date" type="date" value={photoForm.date} onChange={v=>setPhotoForm(f=>({...f,date:v}))} />
              <Input label="Notes" value={photoForm.notes} onChange={v=>setPhotoForm(f=>({...f,notes:v}))} placeholder="e.g. Front pose" />
            </div>
            <ActionBtn color="#b388ff" disabled={!photoForm.photo} onClick={saveProgressPhoto} mt={12}>📸 Save Photo</ActionBtn>
          </Panel>}

          {/* Latest snapshot */}
          {latestM && <Panel mt={16}>
            <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.2em",marginBottom:12}}>Latest · Day {getDayNumber(latestM.date)} · {formatDate(latestM.date)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {MEASURE_FIELDS.filter(f=>latestM[f.key]).map(({key,label,unit})=>{
                const first = firstM?.[key];
                const cur   = parseFloat(latestM[key]);
                const diff  = first?(cur-parseFloat(first)).toFixed(1):null;
                return (
                  <div key={key} style={{textAlign:"center",background:"#252538",borderRadius:10,padding:"10px 6px",border:"1px solid #3d3d55",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                    <div style={{fontSize:16,color:"#b388ff",lineHeight:1}}>{cur}</div>
                    <div style={{fontSize:9,color:"#6e6c85",marginTop:2}}>{unit}</div>
                    <div style={{fontSize:9,color:"#6e6c85",textTransform:"uppercase",letterSpacing:"0.07em",marginTop:1}}>{label}</div>
                    {diff!==null&&diff!=="0.0"&&<div style={{fontSize:9,color:parseFloat(diff)<0?"#43c59e":"#ff6b81",marginTop:2}}>{parseFloat(diff)>0?"+":""}{diff}</div>}
                  </div>
                );
              })}
            </div>
          </Panel>}

          <div style={{display:"flex",gap:8,marginTop:16}}>
            <FilterChip active={bodyView==="measurements"} onClick={()=>setBodyView("measurements")}>📏 Measurements</FilterChip>
            <FilterChip active={bodyView==="photos"} onClick={()=>setBodyView("photos")}>📸 Photos</FilterChip>
          </div>

          {bodyView==="measurements" && <div style={{marginTop:14}}>
            {measurements.length===0 ? <EmptyState icon="📏" text="No measurements yet" sub="Tap '+ Measure' to start" />
            : [...measurements].reverse().map((m,i)=>(
              <div key={i} style={{background:"#2a2a3d",border:"1px solid #3d3d55",borderRadius:8,padding:"12px 14px",marginBottom:8}}>
                <div style={{fontSize:11,color:"#ff8c69",fontStyle:"italic",marginBottom:8}}>Day {getDayNumber(m.date)} · {formatDate(m.date)}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {MEASURE_FIELDS.filter(f=>m[f.key]).map(({key,label,unit})=>(
                    <span key={key} style={{fontSize:12,color:"#b388ff"}}>{m[key]}<span style={{fontSize:10,color:"#6e6c85"}}>{unit} {label}</span></span>
                  ))}
                </div>
              </div>
            ))}
          </div>}

          {bodyView==="photos" && <div style={{marginTop:14}}>
            {progressPhotos.length===0 ? <EmptyState icon="📸" text="No progress photos yet" sub="Tap 📷 to add your first" />
            : <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[...progressPhotos].reverse().map(p=>(
                <div key={p.id} style={{background:"#2a2a3d",border:"1px solid #3d3d55",borderRadius:8,overflow:"hidden"}}>
                  <div style={{position:"relative",cursor:"zoom-in"}} onClick={()=>setLightbox(p.photo)}>
                    <img src={p.photo} alt="progress" style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",display:"block"}} />
                    <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(10,10,20,0.75))",padding:"20px 8px 8px"}}>
                      <div style={{fontSize:10,color:"#ff8c69"}}>Day {getDayNumber(p.date)}</div>
                      {p.notes && <div style={{fontSize:10,color:"#9896b0"}}>{p.notes}</div>}
                    </div>
                  </div>
                  <button onClick={()=>setProgressPhotos(ph=>ph.filter(x=>x.id!==p.id))} style={{width:"100%",background:"none",border:"none",borderTop:"1px solid #3d3d55",color:"#4e4c65",cursor:"pointer",padding:"6px",fontSize:11,fontFamily:"inherit"}}>Remove</button>
                </div>
              ))}
            </div>}
          </div>}
        </>}

        {/* ══ TRENDS / STATS ════════════════════════════════ */}
        {tab==="stats" && <>
          {/* Sub tabs */}
          <div style={{display:"flex",gap:8,marginTop:16,marginBottom:4}}>
            {[["weekly","📅 Weekly"],["monthly","🗓 Monthly"],["trends","📈 Trends"]].map(([v,l])=>(
              <FilterChip key={v} active={statsView===v} onClick={()=>setStatsView(v)}>{l}</FilterChip>
            ))}
          </div>

          {/* ── WEEKLY view ── */}
          {statsView==="weekly" && <>
            {/* Nav */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,marginBottom:8}}>
              <button onClick={()=>setWeekOffset(o=>o-1)} style={{background:"#2a2a3d",border:"1px solid #3d3d55",borderRadius:6,padding:"6px 12px",color:"#9896b0",cursor:"pointer",fontFamily:"inherit",fontSize:12}}>← Prev</button>
              <div style={{fontSize:12,color:"#ff8c69"}}>{weekOffset===0?"This Week":`Week of ${formatDate(weekDates[0])}`}</div>
              <button onClick={()=>setWeekOffset(o=>Math.min(0,o+1))} disabled={weekOffset===0} style={{background:weekOffset===0?"#1e1e2e":"#2a2a3d",border:"1px solid #3d3d55",borderRadius:6,padding:"6px 12px",color:weekOffset===0?"#4e4c65":"#9896b0",cursor:weekOffset===0?"default":"pointer",fontFamily:"inherit",fontSize:12}}>Next →</button>
            </div>
            <Panel>
              <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.2em",marginBottom:14}}>Weekly Summary</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
                <StatBox label="Eaten" value={weekCalIn} unit="kcal" color={MACRO_COLORS.calories} />
                <StatBox label="Burned🔥" value={weekActive} unit="kcal" color="#ff6b81" />
                <StatBox label={weekDeficit>=0?"Deficit":"Surplus"} value={Math.abs(weekDeficit)} unit="kcal" color={weekDeficit>=0?"#43c59e":"#b388ff"} />
              </div>
              <MacroGrid macros={weekMacros} />
              {(weekActive>0||weekCalIn>0) && <div style={{marginTop:12,display:"flex",justifyContent:"center"}}><DeficitBadge deficit={weekDeficit} size="large" /></div>}
            </Panel>
            {/* Bar chart — clean grouped design */}
            <Panel mt={10}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.15em"}}>Week Overview</div>
                <div style={{display:"flex",gap:12}}>
                  {[["#ff8c69","Eaten"],["#ff6b81","Burned"]].map(([c,l])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:10,height:10,borderRadius:3,background:c,opacity:0.85}} />
                      <span style={{fontSize:10,color:"#9896b0"}}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Chart area */}
              <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100,paddingBottom:0}}>
                {weekByDay.map(({date,calories,totalBurned,sessions})=>{
                  const isToday = date===today;
                  const isFuture = date>today;
                  const maxVal = Math.max(maxWeekVal, 500);
                  const eatH   = Math.max((calories/maxVal)*80, calories>0?6:0);
                  const burnH  = Math.max((totalBurned/maxVal)*80, totalBurned>0?6:0);
                  const deficit = totalBurned>0&&calories>0 ? totalBurned-calories : null;
                  return (
                    <div key={date} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                      {/* Value labels */}
                      <div style={{fontSize:8,color:isToday?"#ff8c69":"#4e4c65",marginBottom:3,textAlign:"center",minHeight:12,lineHeight:1}}>
                        {calories>0?calories:""}
                      </div>
                      {/* Bars side by side, rounded, equal width */}
                      <div style={{width:"100%",display:"flex",gap:3,alignItems:"flex-end",height:80,padding:"0 1px",boxSizing:"border-box"}}>
                        {/* Eaten bar */}
                        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",height:"100%"}}>
                          <div style={{
                            width:"100%",
                            height: isFuture?0:eatH,
                            background: isToday?"#ff8c69":calories>0?"#c8a96e66":"transparent",
                            borderRadius:"4px 4px 2px 2px",
                            transition:"height 0.3s",
                          }} />
                        </div>
                        {/* Burned bar */}
                        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",height:"100%"}}>
                          <div style={{
                            width:"100%",
                            height: isFuture?0:burnH,
                            background: isToday?"#ff6b81":totalBurned>0?"#b87e7e66":"transparent",
                            borderRadius:"4px 4px 2px 2px",
                            transition:"height 0.3s",
                          }} />
                        </div>
                      </div>
                      {/* Gym dot */}
                      <div style={{height:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {sessions.length>0
                          ? <div style={{width:6,height:6,borderRadius:"50%",background:"#43c59e"}} />
                          : <div style={{width:6,height:6}} />}
                      </div>
                      {/* Day label */}
                      <div style={{fontSize:10,color:isToday?"#ff8c69":"#6e6c85",fontWeight:isToday?"bold":"normal",letterSpacing:"0.02em"}}>
                        {new Date(date).toLocaleDateString("en-US",{weekday:"short"}).slice(0,2)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Legend for gym dot */}
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10,justifyContent:"flex-end"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"#43c59e"}} />
                <span style={{fontSize:9,color:"#6e6c85"}}>Gym session</span>
              </div>
            </Panel>
            {weekByDay.filter(d=>d.entries.length>0||d.totalBurned>0||d.sessions.length>0).reverse().map(({date,calories,active,totalBurned,deficit,protein,carbs,fat,sessions})=>(
              <div key={date} style={{background:"#2a2a3d",border:"1px solid #3d3d55",borderRadius:10,padding:14,marginTop:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,color:date===today?"#ff8c69":"#eeeaf4"}}>Day {getDayNumber(date)}</span>
                    <span style={{fontSize:11,color:"#6e6c85"}}>{formatDate(date)}</span>
                    {sessions.length>0 && <span style={{fontSize:11,color:"#43c59e"}}>🏋️×{sessions.length}</span>}
                  </div>
                  <DeficitBadge deficit={active>0||calories>0?deficit:null} />
                </div>
                <MacroRow calories={calories} protein={protein} carbs={carbs} fat={fat} />
                {active>0 && <div style={{marginTop:5,fontSize:11,color:"#ff6b81"}}>🔥 {active} kcal burned</div>}
              </div>
            ))}
          </>}

          {/* ── MONTHLY view ── */}
          {statsView==="monthly" && <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,marginBottom:8}}>
              <button onClick={()=>setMonthOffset(o=>o-1)} style={{background:"#2a2a3d",border:"1px solid #3d3d55",borderRadius:6,padding:"6px 12px",color:"#9896b0",cursor:"pointer",fontFamily:"inherit",fontSize:12}}>← Prev</button>
              <div style={{fontSize:12,color:"#ff8c69"}}>{monthLabel(activeMonthKey)}</div>
              <button onClick={()=>setMonthOffset(o=>Math.min(0,o+1))} disabled={activeMonthIdx>=allMonthsSorted.length-1} style={{background:activeMonthIdx>=allMonthsSorted.length-1?"#1e1e2e":"#2a2a3d",border:"1px solid #3d3d55",borderRadius:6,padding:"6px 12px",color:activeMonthIdx>=allMonthsSorted.length-1?"#4e4c65":"#9896b0",cursor:activeMonthIdx>=allMonthsSorted.length-1?"default":"pointer",fontFamily:"inherit",fontSize:12}}>Next →</button>
            </div>
            <Panel>
              <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.2em",marginBottom:14}}>Monthly Summary · {monthLabel(activeMonthKey)}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                <StatBox label="Days Logged" value={monthDaysLogged} unit="days" color={MACRO_COLORS.calories} />
                <StatBox label="Gym Sessions" value={monthTrainDays} unit="days" color="#43c59e" />
                <StatBox label={monthDeficit>=0?"Deficit":"Surplus"} value={Math.abs(monthDeficit)} unit="kcal" color={monthDeficit>=0?"#43c59e":"#b388ff"} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                <StatBox label="Eaten" value={monthCalIn} unit="kcal" color={MACRO_COLORS.calories} />
                <StatBox label="Burned🔥" value={monthActive} unit="kcal" color="#ff6b81" />
              </div>
              {monthDaysLogged>0 && <>
                <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:8}}>Daily Averages</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                  {[
                    {label:"Calories",val:Math.round(monthCalIn/monthDaysLogged),unit:"kcal",color:MACRO_COLORS.calories},
                    {label:"Protein",val:Math.round(sumMacro(monthEntries,"protein")/monthDaysLogged),unit:"g",color:MACRO_COLORS.protein},
                    {label:"Carbs",val:Math.round(sumMacro(monthEntries,"carbs")/monthDaysLogged),unit:"g",color:MACRO_COLORS.carbs},
                    {label:"Fat",val:Math.round(sumMacro(monthEntries,"fat")/monthDaysLogged),unit:"g",color:MACRO_COLORS.fat},
                  ].map(({label,val,unit,color})=>(
                    <div key={label} style={{textAlign:"center",background:"#1e1e2e",borderRadius:8,padding:"10px 4px",border:`1px solid ${color}30`}}>
                      <div style={{fontSize:16,color,lineHeight:1}}>{val||0}</div>
                      <div style={{fontSize:9,color:"#6e6c85",marginTop:2}}>{unit}</div>
                      <div style={{fontSize:9,color:"#6e6c85",textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
                    </div>
                  ))}
                </div>
              </>}
              {(monthActive>0||monthCalIn>0) && <div style={{marginTop:14,display:"flex",justifyContent:"center"}}><DeficitBadge deficit={monthDeficit} size="large" /></div>}
            </Panel>
          </>}

          {/* ── TRENDS view ── */}
          {statsView==="trends" && <>
            {measurements.length<2 && entries.length<3 ? <EmptyState icon="📈" text="Not enough data yet" sub="Keep logging — trends appear after a few days" /> : <>

              {weightTrend.length>=2 && <Panel mt={14}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}>
                  <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.15em"}}>⚖️ Weight</div>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#6e6c85"}}>{weightTrend[0].val}kg → <span style={{color:"#b388ff"}}>{weightTrend[weightTrend.length-1].val}kg</span></span>
                    <span style={{fontSize:12,fontWeight:"bold",color:weightTrend[weightTrend.length-1].val<=weightTrend[0].val?"#43c59e":"#ff6b81"}}>
                      {(weightTrend[weightTrend.length-1].val-weightTrend[0].val).toFixed(1)}kg
                    </span>
                  </div>
                </div>
                <TrendChart points={weightTrend} color="#b388ff" height={130} unit="kg" decimals={1} />
              </Panel>}

              {waistTrend.length>=2 && <Panel mt={10}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}>
                  <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.15em"}}>📏 Waist</div>
                  <span style={{fontSize:12,fontWeight:"bold",color:waistTrend[waistTrend.length-1].val<=waistTrend[0].val?"#43c59e":"#ff6b81"}}>
                    {waistTrend[0].val} → {waistTrend[waistTrend.length-1].val} cm &nbsp;({(waistTrend[waistTrend.length-1].val-waistTrend[0].val).toFixed(1)})
                  </span>
                </div>
                <TrendChart points={waistTrend} color="#43c59e" height={120} unit="cm" decimals={0} />
              </Panel>}
              {abdomenTrend.length>=2 && <Panel mt={10}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}>
                  <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.15em"}}>📏 Abdomen</div>
                  <span style={{fontSize:12,fontWeight:"bold",color:abdomenTrend[abdomenTrend.length-1].val<=abdomenTrend[0].val?"#43c59e":"#ff6b81"}}>
                    {abdomenTrend[0].val} → {abdomenTrend[abdomenTrend.length-1].val} cm &nbsp;({(abdomenTrend[abdomenTrend.length-1].val-abdomenTrend[0].val).toFixed(1)})
                  </span>
                </div>
                <TrendChart points={abdomenTrend} color="#ff8c69" height={120} unit="cm" decimals={0} />
              </Panel>}

              {bodyFatTrend.length>=2 && <Panel mt={10}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}>
                  <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.15em"}}>💧 Body Fat</div>
                  <span style={{fontSize:12,fontWeight:"bold",color:bodyFatTrend[bodyFatTrend.length-1].val<=bodyFatTrend[0].val?"#43c59e":"#ff6b81"}}>
                    {bodyFatTrend[0].val}% → {bodyFatTrend[bodyFatTrend.length-1].val}% &nbsp;({(bodyFatTrend[bodyFatTrend.length-1].val-bodyFatTrend[0].val).toFixed(1)}%)
                  </span>
                </div>
                <TrendChart points={bodyFatTrend} color="#ff6b81" height={120} unit="%" decimals={1} />
              </Panel>}

              {/* Calorie trend */}
              {(() => {
                const calDates = [...new Set(entries.map(e=>e.date))].sort();
                const calVals  = calDates.map(d=>sumMacro(entries.filter(e=>e.date===d),"calories")).filter(v=>v>0);
                if (calVals.length<3) return null;
                return <Panel mt={10}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                    <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.15em"}}>Daily Calories Trend</div>
                    <span style={{fontSize:11,color:"#6e6c85"}}>avg <span style={{color:MACRO_COLORS.calories}}>{avg(calVals)} kcal</span></span>
                  </div>
                  <Sparkline data={calVals} color={MACRO_COLORS.calories} height={44} />
                </Panel>;
              })()}

              {/* Deficit trend */}
              {(() => {
                const defDates = [...new Set([...entries.map(e=>e.date),...Object.keys(activeBurned)])].sort();
                const defVals  = defDates.map(d=>{
                  const calIn   = sumMacro(entries.filter(e=>e.date===d),"calories");
                  const burned  = activeBurned[d]||0;
                  return burned-calIn;
                }).filter((_,i)=>defDates[i]<=today);
                if (defVals.length<3) return null;
                const cumulative = defVals.reduce((acc,v,i)=>[...acc,(acc[i-1]||0)+v],[]);
                return <Panel mt={10}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                    <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.15em"}}>Cumulative Deficit</div>
                    <span style={{fontSize:11,color:cumulative[cumulative.length-1]>=0?"#43c59e":"#ff6b81"}}>{cumulative[cumulative.length-1]>=0?"-":"+"}  {Math.abs(Math.round(cumulative[cumulative.length-1]))} kcal total</span>
                  </div>
                  <Sparkline data={cumulative} color="#43c59e" height={44} />
                  <div style={{fontSize:10,color:"#6e6c85",marginTop:6,textAlign:"center"}}>≈ {(Math.abs(cumulative[cumulative.length-1])/7700).toFixed(2)} kg fat from deficit</div>
                </Panel>;
              })()}

              {/* Training frequency */}
              {Object.keys(trainSessions).length>=3 && (() => {
                const months = getAllMonths(entries,trainSessions,measurements);
                const vals   = months.map(mk=>Object.keys(trainSessions).filter(d=>monthKey(d)===mk&&(trainSessions[d]||[]).length>0).length);
                return <Panel mt={10}>
                  <div style={{fontSize:10,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:8}}>Training Days / Month</div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:6,height:60}}>
                    {months.map((mk,i)=>{
                      const v   = vals[i];
                      const max = Math.max(...vals,1);
                      return (
                        <div key={mk} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                          <div style={{fontSize:9,color:"#6e6c85"}}>{v||""}</div>
                          <div style={{width:"100%",height:Math.max((v/max)*44,v>0?3:0),background:"#43c59e",borderRadius:"2px 2px 0 0"}} />
                          <div style={{fontSize:8,color:"#6e6c85"}}>{MONTHS[parseInt(mk.split("-")[1])-1]}</div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>;
              })()}
            </>}
          </>}
        </>}
      </div>

      {/* Lightbox */}
      {lightbox && <div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
        <img src={lightbox} alt="" style={{maxWidth:"96vw",maxHeight:"92vh",objectFit:"contain",borderRadius:6}} />
        <button onClick={()=>setLightbox(null)} style={{position:"absolute",top:20,right:20,background:"rgba(255,255,255,0.1)",border:"none",color:"#eeeaf4",borderRadius:"50%",width:36,height:36,cursor:"pointer",fontSize:18}}>✕</button>
      </div>}
    </div>
  );
}

// ── Shared components ──────────────────────────────────────
function GoalProgress({ macros, goals }) {
  const items = [
    { key: "calories", label: "Calories", unit: "kcal", color: MACRO_COLORS.calories },
    { key: "protein",  label: "Protein",  unit: "g",    color: MACRO_COLORS.protein },
    { key: "carbs",    label: "Carbs",    unit: "g",    color: MACRO_COLORS.carbs },
    { key: "fat",      label: "Fat",      unit: "g",    color: MACRO_COLORS.fat },
  ].filter(i => goals[i.key]);
  if (!items.length) return null;
  return (
    <div style={{ borderTop:"1px solid #3d3d55", marginTop:12, paddingTop:14 }}>
      <div style={{ fontSize:10, color:"#9896b0", textTransform:"uppercase", letterSpacing:"0.2em", marginBottom:10 }}>Daily Goals</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {items.map(({ key, label, unit, color }) => {
          const val  = macros[key] || 0;
          const goal = parseInt(goals[key]) || 1;
          const pct  = Math.min((val / goal) * 100, 100);
          const over = val > goal;
          return (
            <div key={key}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                <span style={{ fontSize:11, color:"#9896b0" }}>{label}</span>
                <span style={{ fontSize:11, color: over ? "#ff6b81" : pct>=100 ? "#43c59e" : color }}>
                  {val}{unit !== "kcal" ? "g" : ""} / {goal}{unit !== "kcal" ? "g" : " kcal"}
                  {over && <span style={{ marginLeft:5, fontSize:10 }}>↑ over</span>}
                  {pct>=100 && !over && <span style={{ marginLeft:5, fontSize:10 }}>✓</span>}
                </span>
              </div>
              <div style={{ height:5, background:"#252538", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background: over ? "#ff6b81" : color, borderRadius:3, transition:"width 0.4s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function Panel({children,title,mt=0}){return(<div style={{background:"#2a2a3d",border:"1px solid #3d3d55",borderRadius:12,padding:16,marginTop:mt,boxShadow:"0 2px 12px rgba(0,0,0,0.25)"}}>{title&&<div style={{fontSize:11,color:"#9896b0",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>{title}</div>}{children}</div>);}
function PhotoUpload({photo,onPhoto,onClear,fileRef,hint}){return(<div>{photo?(<div style={{position:"relative"}}><img src={photo} alt="upload" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:8,display:"block"}} /><button onClick={onClear} style={{position:"absolute",top:8,right:8,background:"rgba(10,10,20,0.75)",border:"none",color:"#eeeaf4",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div>):(<div onClick={()=>fileRef.current.click()} style={{border:"1px dashed #4a4a62",borderRadius:8,padding:"18px",textAlign:"center",cursor:"pointer",color:"#6e6c85",fontSize:13,background:"rgba(200,169,110,0.02)"}}><div style={{fontSize:24,marginBottom:4}}>📷</div><div>{hint}</div></div>)}<input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{display:"none"}} /></div>);}
function ActionBtn({children,color,textColor="#fff",disabled,onClick,mt=0}){return(<button onClick={onClick} disabled={disabled} style={{width:"100%",marginTop:mt,background:disabled?"#252538":color,color:disabled?"#6e6c85":textColor,border:"none",borderRadius:6,padding:"11px",fontSize:13,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:"bold",letterSpacing:"0.05em",transition:"all 0.2s"}}>{children}</button>);}
function Btn({icon,active,onClick}){return(<button onClick={onClick} style={{background:active?"#252538":"transparent",color:active?"#eeeaf4":"#9896b0",border:"1px solid #3d3d55",borderRadius:6,padding:"8px 10px",fontSize:15,cursor:"pointer",transition:"all 0.2s"}}>{icon}</button>);}
function EmptyState({icon,text,sub}){return(<div style={{textAlign:"center",padding:"48px 20px"}}><div style={{fontSize:36,marginBottom:12}}>{icon}</div><div style={{fontSize:14,color:"#6e6c85",fontStyle:"italic"}}>{text}</div>{sub&&<div style={{fontSize:12,color:"#4e4c65",marginTop:6}}>{sub}</div>}</div>);}
function DeficitBadge({deficit,size="normal"}){if(deficit===null||deficit===undefined)return null;const isD=deficit>0,isZ=deficit===0;const color=isZ?"#6e6c85":isD?"#43c59e":"#ff6b81";const label=isZ?"Balanced":isD?`−${deficit} deficit`:`+${Math.abs(deficit)} surplus`;return(<div style={{display:"inline-flex",alignItems:"center",gap:5,background:color+"18",border:`1px solid ${color}44`,borderRadius:20,padding:size==="large"?"6px 14px":"4px 10px",color,fontSize:size==="large"?13:11}}>{isZ?"⚖":isD?"↓":"↑"} {label} kcal</div>);}
function StatBox({label,value,unit,color}){return(<div style={{textAlign:"center",background:color+"10",borderRadius:8,padding:"10px 4px",border:`1px solid ${color}30`}}><div style={{fontSize:17,color,fontWeight:"normal",lineHeight:1}}>{value||0}</div><div style={{fontSize:9,color:color+"99",marginTop:2}}>{unit}</div><div style={{fontSize:9,color:"#6e6c85",textTransform:"uppercase",letterSpacing:"0.08em",marginTop:1}}>{label}</div></div>);}
function MacroGrid({macros}){return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>{[["calories","Calories","kcal","#ff8c69"],["protein","Protein","g","#43c59e"],["carbs","Carbs","g","#b388ff"],["fat","Fat","g","#ff6b81"]].map(([k,l,u,c])=>(<div key={k} style={{textAlign:"center"}}><div style={{fontSize:19,color:c,lineHeight:1}}>{macros[k]||0}</div><div style={{fontSize:9,color:"#6e6c85",marginTop:2}}>{u}</div><div style={{fontSize:9,color:"#6e6c85",textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div></div>))}</div>);}
function MacroRow({calories,protein,carbs,fat}){const items=[{val:calories,label:"kcal",color:MACRO_COLORS.calories},{val:protein,label:"pro",color:MACRO_COLORS.protein},{val:carbs,label:"carb",color:MACRO_COLORS.carbs},{val:fat,label:"fat",color:MACRO_COLORS.fat}].filter(x=>x.val);if(!items.length)return null;return(<div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{items.map(({val,label,color})=>(<span key={label} style={{fontSize:11,color}}>{val}{label!=="kcal"?"g":""} <span style={{color:"#6e6c85",fontSize:10}}>{label}</span></span>))}</div>);}
function Input({label,value,onChange,placeholder,type="text"}){return(<div><div style={{fontSize:10,color:"#6e6c85",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:5}}>{label}</div><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",background:"#252538",border:"1px solid #3d3d55",borderRadius:8,padding:"9px 10px",color:"#eeeaf4",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}} /></div>);}
function Select({label,value,options,onChange}){return(<div><div style={{fontSize:10,color:"#6e6c85",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:5}}>{label}</div><select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:"#252538",border:"1px solid #3d3d55",borderRadius:8,padding:"9px 10px",color:"#eeeaf4",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}>{options.map(o=><option key={o}>{o}</option>)}</select></div>);}
function FilterChip({active,onClick,children}){return(<button onClick={onClick} style={{background:active?"#ff8c69":"#252538",color:active?"#1e1e2e":"#9896b0",border:`1px solid ${active?"#ff8c69":"#252538"}`,borderRadius:20,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",letterSpacing:"0.03em",transition:"all 0.15s"}}>{children}</button>);}
