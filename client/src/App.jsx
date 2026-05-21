import { useState, useRef, useCallback, useEffect } from "react";
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";

(() => {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(l);
})();

function createSocket() {
  // forceNew: true ensures each browser tab gets its own independent socket
  // This fixes the same-browser state-sharing bug
  return io(SERVER_URL, { transports: ["websocket", "polling"], forceNew: true });
}

// Images are NOT sent over socket (too large, breaks quiz start).
// Host stores them locally keyed by question index and re-injects on display.
const _localImgs = {}; // { `${roomCode}_${qi}` : dataURL }
function saveImg(roomCode, qi, url) { _localImgs[`${roomCode}_${qi}`] = url; }
function getImg(roomCode, qi) { return _localImgs[`${roomCode}_${qi}`] || ""; }

// ── Audio ──────────────────────────────────────────────────────────────────────
let _ac = null;
function tone(f, d, t = "sine", v = 0.2) {
  try {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    o.type = t; o.frequency.value = f;
    g.gain.setValueAtTime(v, _ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + d);
    o.start(); o.stop(_ac.currentTime + d);
  } catch (e) {}
}
const SFX = {
  join:    () => { tone(520,.08); setTimeout(()=>tone(680,.12),80); },
  locked:  () => { tone(600,.08); setTimeout(()=>tone(820,.14),90); },
  correct: () => { tone(523,.08); setTimeout(()=>tone(659,.08),90); setTimeout(()=>tone(784,.2),180); },
  wrong:   () => { tone(180,.1,"sawtooth"); setTimeout(()=>tone(140,.18,"sawtooth"),110); },
  tick:    () => tone(440,.05,"square",.12),
  start:   () => { [0,1,2].forEach(i=>setTimeout(()=>tone(440+i*110,.1),i*130)); },
};

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:      "#f9f9fe",
  white:   "#ffffff",
  navy:    "#222831",
  muted:   "#64748b",
  border:  "#e4e4f0",
  grad:    "linear-gradient(90deg, #7C5CFA, #FF4EC3)",
  gradD:   "linear-gradient(135deg, #7C5CFA 0%, #FF4EC3 100%)",
  purple:  "#7C5CFA",
  purpleD: "#5b3fd4",
  pink:    "#FF4EC3",
  red:     "#FF4D4D",
  blue:    "#4D8AFF",
  yellow:  "#FFB830",
  green:   "#2EC97A",
};

const OPTS = [
  { color: C.red,    bg:"#fff0f0", border:"#FFB3B3", shape:"▲", label:"A" },
  { color: C.blue,   bg:"#f0f5ff", border:"#B3CBFF", shape:"◆", label:"B" },
  { color: C.yellow, bg:"#fffbf0", border:"#FFE0A0", shape:"●", label:"C" },
  { color: C.green,  bg:"#f0fff8", border:"#A0EFD0", shape:"■", label:"D" },
];

const AVATARS = ["🐱","🐶","🦊","🐸","🐼","🦄","🐯","🦁","🐨","🦋","🦀","🐙","🦉","🐧","🦩","🐬"];
const CATEGORIES = [
  {label:"General",emoji:"🌍"},{label:"Science",emoji:"🔬"},{label:"History",emoji:"📜"},
  {label:"Sports",emoji:"⚽"},{label:"Music",emoji:"🎧"},{label:"Movies",emoji:"🎬"},
  {label:"Tech",emoji:"💻"},{label:"Geography",emoji:"🗺️"},{label:"Art",emoji:"🎨"},
  {label:"Food",emoji:"🍕"},{label:"Nature",emoji:"🌿"},{label:"Custom",emoji:"✏️"},
];

// ── SVG Icons (no emojis) ──────────────────────────────────────────────────────
const Icon = {
  Build: () => (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect width="52" height="52" rx="16" fill="url(#ig1)"/>
      <defs><linearGradient id="ig1" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7C5CFA"/><stop offset="1" stopColor="#A78BFA"/>
      </linearGradient></defs>
      <rect x="14" y="14" width="24" height="24" rx="4" stroke="white" strokeWidth="2" fill="none"/>
      <line x1="19" y1="20" x2="33" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="19" y1="25" x2="29" y2="25" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="19" y1="30" x2="26" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Share: () => (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect width="52" height="52" rx="16" fill="url(#ig2)"/>
      <defs><linearGradient id="ig2" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF4EC3"/><stop offset="1" stopColor="#7C5CFA"/>
      </linearGradient></defs>
      <circle cx="36" cy="16" r="4" stroke="white" strokeWidth="2" fill="none"/>
      <circle cx="16" cy="26" r="4" stroke="white" strokeWidth="2" fill="none"/>
      <circle cx="36" cy="36" r="4" stroke="white" strokeWidth="2" fill="none"/>
      <line x1="20" y1="24" x2="32" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="20" y1="28" x2="32" y2="34" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Compete: () => (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect width="52" height="52" rx="16" fill="url(#ig3)"/>
      <defs><linearGradient id="ig3" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFB830"/><stop offset="1" stopColor="#FF4EC3"/>
      </linearGradient></defs>
      <path d="M26 14 L28.5 21.5 L36 21.5 L30 26.5 L32.5 34 L26 29.5 L19.5 34 L22 26.5 L16 21.5 L23.5 21.5 Z" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round"/>
    </svg>
  ),
  Speed: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="14" stroke={C.yellow} strokeWidth="2" fill={C.yellow+"18"}/>
      <path d="M18 10 L18 18 L24 18" stroke={C.yellow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="18" cy="18" r="2" fill={C.yellow}/>
    </svg>
  ),
  Lock: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="10" y="17" width="16" height="12" rx="3" stroke={C.red} strokeWidth="2" fill={C.red+"18"}/>
      <path d="M13 17 V14 a5 5 0 0 1 10 0 V17" stroke={C.red} strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="18" cy="23" r="2" fill={C.red}/>
    </svg>
  ),
  Chart: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="8" y="8" width="20" height="20" rx="3" stroke={C.purple} strokeWidth="2" fill={C.purple+"18"}/>
      <line x1="12" y1="24" x2="12" y2="18" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="18" y1="24" x2="18" y2="14" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="24" y1="24" x2="24" y2="20" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  Trophy: () => (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <path d="M22 16 H50 V38 a14 14 0 0 1-28 0 Z" stroke={C.yellow} strokeWidth="2.5" fill={C.yellow+"22"} strokeLinejoin="round"/>
      <path d="M22 22 H12 V30 a10 10 0 0 0 10 8" stroke={C.yellow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M50 22 H60 V30 a10 10 0 0 1-10 8" stroke={C.yellow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <line x1="36" y1="52" x2="36" y2="58" stroke={C.yellow} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="26" y1="58" x2="46" y2="58" stroke={C.yellow} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  QuizBg: () => (
    <svg width="100%" height="100%" viewBox="0 0 400 300" fill="none" style={{position:"absolute",inset:0,pointerEvents:"none",opacity:.07}}>
      <circle cx="60" cy="60" r="40" stroke="white" strokeWidth="3"/>
      <circle cx="340" cy="240" r="55" stroke="white" strokeWidth="3"/>
      <rect x="300" y="30" width="60" height="60" rx="12" stroke="white" strokeWidth="3"/>
      <path d="M30 200 L60 170 L90 200 L120 160" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="200" cy="150" r="8" fill="white"/>
      <circle cx="160" cy="80" r="5" fill="white"/>
      <circle cx="240" cy="220" r="6" fill="white"/>
    </svg>
  ),
};

// ── Global CSS ─────────────────────────────────────────────────────────────────
const gcss = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:${C.bg};font-family:'Fredoka',sans-serif;color:${C.navy};-webkit-font-smoothing:antialiased}
  input,textarea,select,button{font-family:'Fredoka',sans-serif}
  @keyframes fadeUp {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
  @keyframes popIn  {from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
  @keyframes slideL {from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
  @keyframes bounce {0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
  @keyframes pulse  {0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
  @keyframes float  {0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-18px) rotate(6deg)}}
  @keyframes glow   {0%,100%{box-shadow:0 0 12px #7C5CFA44}50%{box-shadow:0 0 28px #7C5CFA88}}
  @keyframes scoreUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes revealOpt{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
  .fu {animation:fadeUp .42s cubic-bezier(.22,1,.36,1) both}
  .pop{animation:popIn  .32s cubic-bezier(.34,1.56,.64,1) both}
  .sl {animation:slideL .32s ease both}
  .btn-h:hover {transform:translateY(-2px) scale(1.03);filter:brightness(1.05)}
  .btn-h:active{transform:scale(.97)}
  .card-h:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(124,92,250,.16)!important}
  .opt-b:hover {transform:scale(1.03);filter:brightness(1.05)}
  .opt-b:active{transform:scale(.97)}
  ::-webkit-scrollbar{width:5px}
  ::-webkit-scrollbar-thumb{background:${C.purpleD}44;border-radius:4px}
  @media(max-width:640px){
    .g2{grid-template-columns:1fr!important}
    .g3{grid-template-columns:1fr!important}
    .g4{grid-template-columns:1fr 1fr!important}
    .hcol{grid-template-columns:1fr!important}
    .hero-h{font-size:clamp(28px,8vw,44px)!important}
    .code-d{font-size:50px!important;letter-spacing:.22em!important}
    .hide-sm{display:none!important}
  }
`;
const GCss = () => <style>{gcss}</style>;

// ── Floating background shapes ─────────────────────────────────────────────────
function BgShapes() {
  const shapes = [
    { w:220, h:220, top:-60,  left:-70,  color:"#7C5CFA0d", delay:0   },
    { w:160, h:160, top:60,   right:-50, color:"#FF4EC30e", delay:2.5 },
    { w:100, h:100, top:220,  left:"40%",color:"#FFB8300a", delay:1.5 },
    { w:180, h:180, bottom:-50,right:60, color:"#7C5CFA0b", delay:1   },
    { w:70,  h:70,  top:80,   left:"65%",color:"#FF4EC30a", delay:3.5 },
  ];
  return (
    <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
      {shapes.map((s,i)=>(
        <div key={i} style={{
          position:"absolute",width:s.w,height:s.h,borderRadius:"50%",
          background:s.color,top:s.top,left:s.left,right:s.right,bottom:s.bottom,
          animation:`float ${9+i*1.8}s ease-in-out ${s.delay}s infinite`,
          filter:"blur(2px)",
        }}/>
      ))}
    </div>
  );
}

// ── Atoms ──────────────────────────────────────────────────────────────────────
const Logo = ({size=28}) => (
  <span style={{fontFamily:"'Fredoka',sans-serif",fontWeight:700,fontSize:size,
    background:C.grad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
    letterSpacing:".02em"}}>EndPlays</span>
);

function Card({children,style={},cls="",hover=false}){
  return(
    <div className={`${cls}${hover?" card-h":""}`} style={{
      background:C.white,borderRadius:22,border:`1.5px solid ${C.border}`,
      boxShadow:"0 2px 18px rgba(124,92,250,.07)",padding:24,
      transition:"all .22s ease",...style}}>
      {children}
    </div>
  );
}

function GCard({children,style={},cls=""}){
  return(
    <div className={cls} style={{
      background:C.gradD,borderRadius:22,border:"none",padding:28,
      boxShadow:"0 8px 32px rgba(124,92,250,.3)",position:"relative",
      overflow:"hidden",...style}}>
      <Icon.QuizBg/>
      <div style={{position:"relative",zIndex:1}}>{children}</div>
    </div>
  );
}

function Btn({children,onClick,v="primary",disabled=false,style={},full=true,sz="md",cls=""}){
  const pad=sz==="sm"?"9px 18px":sz==="lg"?"16px 36px":"12px 26px";
  const fs=sz==="sm"?14:sz==="lg"?19:16;
  const base={border:"none",borderRadius:14,cursor:disabled?"not-allowed":"pointer",
    fontWeight:600,fontSize:fs,padding:pad,opacity:disabled?.5:1,
    width:full?"100%":"auto",display:"inline-block",textAlign:"center",
    transition:"all .18s ease",letterSpacing:".02em"};
  const vs={
    primary:{background:C.grad,color:"#fff",boxShadow:disabled?"none":"0 4px 18px rgba(124,92,250,.38)"},
    outline:{background:"transparent",color:C.purple,border:`2px solid ${C.purple}`},
    ghost:  {background:"transparent",color:C.muted,border:`1.5px solid ${C.border}`},
    white:  {background:"#fff",color:C.purple,boxShadow:"0 4px 18px rgba(0,0,0,.12)"},
    danger: {background:"#fff0f0",color:"#e53e3e",border:`1.5px solid #fca5a5`},
  };
  return(
    <button className={`btn-h ${cls}`} onClick={disabled?undefined:onClick}
      style={{...base,...vs[v],...style}}>
      {children}
    </button>
  );
}

function Inp({ph,val,set,kd,type="text",style={},ml,rows,autoFocus=false}){
  const base={width:"100%",padding:"12px 16px",borderRadius:12,fontSize:16,fontWeight:500,
    border:`2px solid ${C.border}`,background:"#fafaff",color:C.navy,outline:"none",
    transition:"border-color .2s, box-shadow .2s",...style};
  const ev={
    onFocus:e=>{e.target.style.borderColor=C.purple;e.target.style.boxShadow=`0 0 0 3px ${C.purple}18`;},
    onBlur: e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none";},
  };
  if(rows) return <textarea placeholder={ph} value={val} rows={rows} autoFocus={autoFocus}
    onChange={e=>set(e.target.value)} style={{...base,resize:"vertical"}} {...ev}/>;
  return <input type={type} placeholder={ph} value={val} maxLength={ml} autoFocus={autoFocus}
    onChange={e=>set(e.target.value)} onKeyDown={kd} style={base} {...ev}/>;
}

function Lbl({children,color=C.muted,mb=7}){
  return <div style={{fontSize:12,fontWeight:600,color,letterSpacing:".1em",textTransform:"uppercase",marginBottom:mb}}>{children}</div>;
}
function Pill({children,color=C.purple}){
  return <span style={{background:color+"18",color,border:`1.5px solid ${color}33`,
    borderRadius:20,padding:"3px 12px",fontSize:13,fontWeight:600}}>{children}</span>;
}
function ErrBox({msg}){
  if(!msg) return null;
  return <div style={{background:"#fff0f0",border:"1.5px solid #fca5a5",borderRadius:12,
    padding:"12px 16px",fontSize:15,color:"#dc2626",fontWeight:600}}>Warning: {msg}</div>;
}
function Av({name,size=40}){
  const idx=name?(name.charCodeAt(0)+name.length)%AVATARS.length:0;
  return(
    <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,
      background:C.gradD,display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*.44,boxShadow:"0 2px 8px rgba(124,92,250,.2)"}}>
      {AVATARS[idx]}
    </div>
  );
}

// ── Gradient text ──────────────────────────────────────────────────────────────
const GT = ({children,size,weight=700,style={}}) => (
  <span style={{fontWeight:weight,fontSize:size,background:C.grad,
    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",...style}}>
    {children}
  </span>
);

// ── Copy hook ──────────────────────────────────────────────────────────────────
function useCopy(){
  const [done,setDone]=useState(false);
  function copy(txt){
    navigator.clipboard?.writeText(txt).then(()=>{setDone(true);setTimeout(()=>setDone(false),2000);});
  }
  return [done,copy];
}

// ── Image uploader ─────────────────────────────────────────────────────────────
function ImgUp({value,onChange}){
  const ref=useRef();
  const [drag,setDrag]=useState(false);
  function readFile(file){
    if(!file)return;
    if(!file.type.match(/^image\/(png|jpe?g|gif|webp)$/i)){
      alert("Please upload a PNG, JPG, GIF, or WEBP image.");return;
    }
    const r=new FileReader();
    r.onload=ev=>onChange(ev.target.result);
    r.readAsDataURL(file);
  }
  return(
    <div>
      <Lbl>Question Image (optional)</Lbl>
      <div
        onDragOver={e=>{e.preventDefault();setDrag(true);}}
        onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);readFile(e.dataTransfer.files[0]);}}
        onClick={()=>!value&&ref.current.click()}
        style={{border:`2px dashed ${drag?C.purple:value?"#22c55e":C.border}`,
          borderRadius:14,padding:value?"10px":"26px 18px",
          textAlign:"center",cursor:value?"default":"pointer",
          background:drag?"#f0eeff":value?"#f0fff8":"#fafaff",
          transition:"all .2s",minHeight:70,
          display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
        {value
          ? <>
              <img src={value} alt="preview"
                style={{maxHeight:110,maxWidth:"100%",borderRadius:10,objectFit:"contain"}}/>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <Btn v="outline" sz="sm" full={false} onClick={e=>{e.stopPropagation();ref.current.click();}}>Change</Btn>
                <Btn v="danger"  sz="sm" full={false} onClick={e=>{e.stopPropagation();onChange("");}}>Remove</Btn>
              </div>
            </>
          : <div>
              <div style={{fontSize:28,marginBottom:6,color:C.purple}}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{verticalAlign:"middle"}}>
                  <rect x="2" y="6" width="24" height="18" rx="4" stroke={C.purple} strokeWidth="2" fill="none"/>
                  <circle cx="9" cy="12" r="2.5" stroke={C.purple} strokeWidth="1.5" fill="none"/>
                  <path d="M2 20 L8 14 L13 19 L18 15 L26 20" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
              <div style={{fontSize:14,fontWeight:500,color:C.muted}}>Drag & drop or click to upload</div>
              <div style={{fontSize:12,color:C.border,marginTop:4}}>PNG, JPG, GIF, WEBP</div>
            </div>
        }
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        style={{display:"none"}} onChange={e=>readFile(e.target.files[0])}/>
    </div>
  );
}

// ── Question preview ───────────────────────────────────────────────────────────
function QPreview({q}){
  const opts=[...(q.incorrectAnswers||[]),q.correctAnswer||""].filter(Boolean)
    .sort(()=>Math.random()-.5).slice(0,4);
  return(
    <div style={{background:"#fafaff",borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Preview</div>
      {q.image&&<img src={q.image} alt="" style={{width:"100%",maxHeight:90,objectFit:"contain",borderRadius:8,marginBottom:10}}/>}
      <div style={{fontSize:14,fontWeight:600,color:C.navy,marginBottom:10,minHeight:18}}>
        {q.text||<span style={{color:C.border}}>Your question appears here...</span>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
        {OPTS.map((m,i)=>(
          <div key={i} style={{background:m.bg,border:`1.5px solid ${m.border}`,
            borderRadius:7,padding:"6px 8px",fontSize:12,fontWeight:600,
            display:"flex",alignItems:"center",gap:5,minHeight:28}}>
            <span style={{color:m.color,fontSize:11}}>{m.shape}</span>
            <span style={{color:C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {opts[i]||<span style={{color:C.border,fontStyle:"italic"}}>Answer {i+1}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Question builder card ──────────────────────────────────────────────────────
function QCard({q,idx,total,onChange,onRemove}){
  return(
    <Card style={{border:`1.5px solid ${C.purple}33`,padding:0,overflow:"hidden"}} cls="fu">
      <div style={{background:`linear-gradient(90deg,${C.purple}14,${C.pink}0d)`,
        padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",
        borderBottom:`1.5px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:9,background:C.gradD,color:"#fff",
            fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>{idx+1}</div>
          <span style={{fontWeight:600,color:C.navy,fontSize:16}}>Question {idx+1}</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select value={q.timeLimit} onChange={e=>onChange("timeLimit",Number(e.target.value))}
            style={{padding:"6px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,
              fontSize:13,fontWeight:600,background:C.white,color:C.navy,cursor:"pointer",outline:"none"}}>
            {[5,7,10,15,20,30].map(t=><option key={t} value={t}>{t} seconds</option>)}
          </select>
          {total>1&&<Btn v="danger" sz="sm" full={false} onClick={onRemove}>Remove</Btn>}
        </div>
      </div>
      {/* 2-col body */}
      <div className="hcol" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
        {/* Left */}
        <div style={{padding:"20px",borderRight:`1.5px solid ${C.border}`}}>
          <div style={{marginBottom:14}}>
            <Lbl>Question Text</Lbl>
            <Inp ph="Type your question here..." val={q.text} set={v=>onChange("text",v)} rows={2}/>
          </div>
          <div style={{marginBottom:12}}>
            <Lbl color="#16a34a">Correct Answer</Lbl>
            <input value={q.correctAnswer} onChange={e=>onChange("correctAnswer",e.target.value)}
              placeholder="The correct answer..."
              onFocus={e=>{e.target.style.borderColor="#22c55e";e.target.style.boxShadow="0 0 0 3px #22c55e18";}}
              onBlur={e=>{e.target.style.borderColor=q.correctAnswer.trim()?"#22c55e":C.border;e.target.style.boxShadow="none";}}
              style={{width:"100%",padding:"11px 14px",borderRadius:10,outline:"none",fontSize:15,fontWeight:500,
                border:`2px solid ${q.correctAnswer.trim()?"#22c55e":C.border}`,
                background:q.correctAnswer.trim()?"#f0fdf4":"#fafaff",color:C.navy,transition:"all .2s"}}/>
          </div>
          <div>
            <Lbl color={C.red}>Wrong Answers (3)</Lbl>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {q.incorrectAnswers.map((w,wi)=>(
                <input key={wi} value={w}
                  onChange={e=>{const a=[...q.incorrectAnswers];a[wi]=e.target.value;onChange("incorrectAnswers",a);}}
                  placeholder={`Wrong answer ${wi+1}`}
                  onFocus={e=>{e.target.style.borderColor=C.red;e.target.style.boxShadow=`0 0 0 3px ${C.red}15`;}}
                  onBlur={e=>{e.target.style.borderColor=w.trim()?C.red+"66":C.border;e.target.style.boxShadow="none";}}
                  style={{width:"100%",padding:"11px 14px",borderRadius:10,outline:"none",fontSize:14,fontWeight:500,
                    border:`2px solid ${w.trim()?C.red+"66":C.border}`,
                    background:w.trim()?"#fff5f5":"#fafaff",color:C.navy,transition:"all .2s"}}/>
              ))}
            </div>
          </div>
        </div>
        {/* Right */}
        <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
          <ImgUp value={q.image} onChange={v=>onChange("image",v)}/>
          <QPreview q={q}/>
        </div>
      </div>
    </Card>
  );
}

// ── Animated leaderboard row ───────────────────────────────────────────────────
// Rows reveal staggered: rank 1 first, then 2, 3... with score counting up
function LbRow({p, myName, idx}){
  const isMe   = p.name===myName;
  const medals = ["🥇","🥈","🥉"];
  const [vis,  setVis]  = useState(false);
  const [pts,  setPts]  = useState(0);

  useEffect(()=>{
    const t = setTimeout(()=>setVis(true), idx*150);
    return ()=>clearTimeout(t);
  },[idx]);

  // Animate score counting up after row appears
  useEffect(()=>{
    if(!vis) return;
    const target = p.score;
    const steps  = 20;
    const step   = Math.ceil(target/steps);
    let cur = 0;
    const iv = setInterval(()=>{
      cur = Math.min(cur+step, target);
      setPts(cur);
      if(cur>=target) clearInterval(iv);
    }, 40);
    return ()=>clearInterval(iv);
  },[vis, p.score]);

  const badgeColor = p.rank===1?C.yellow:p.rank===2?"#94a3b8":p.rank===3?"#cd7c2f":C.muted;

  return(
    <div style={{
      display:"flex",alignItems:"center",gap:12,padding:"13px 16px",
      background:isMe?`${C.purple}0e`:"#fafaff",
      borderRadius:14,
      border:`2px solid ${isMe?C.purple+"55":C.border}`,
      boxShadow:isMe?`0 0 0 3px ${C.purple}14,0 4px 14px ${C.purple}18`:
                p.rank===1?`0 2px 14px ${C.yellow}22`:undefined,
      opacity: vis?1:0,
      transform: vis?"translateX(0)":"translateX(-24px)",
      transition:"opacity .35s ease, transform .35s ease, background .2s",
    }}>
      <span style={{fontSize:p.rank<=3?26:15,width:34,textAlign:"center",fontWeight:700,color:badgeColor}}>
        {p.rank<=3?medals[p.rank-1]:`#${p.rank}`}
      </span>
      <Av name={p.name} size={36}/>
      <span style={{flex:1,fontWeight:600,fontSize:16,color:isMe?C.purple:C.navy}}>
        {p.name}{isMe?" (you)":""}
      </span>
      <span style={{fontWeight:700,fontSize:22,
        color:p.rank===1?C.yellow:C.navy,
        fontVariantNumeric:"tabular-nums",
        minWidth:60,textAlign:"right"}}>
        {vis ? pts.toLocaleString() : "—"}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [screen,     setScreen]     = useState("home");
  const [role,       setRole]       = useState(null);
  const [roomCode,   setRoomCode]   = useState("");
  const [joinCode,   setJoinCode]   = useState("");
  const [playerName, setPlayerName] = useState("");
  const [hostName,   setHostName]   = useState("");
  const [players,    setPlayers]    = useState([]);
  const [myName,     setMyName]     = useState("");
  const myNameRef = useRef("");

  const [questions,  setQuestions]  = useState([{text:"",correctAnswer:"",incorrectAnswers:["","",""],timeLimit:10,image:""}]);
  const [quizTitle,  setQuizTitle]  = useState("");
  const [category,   setCategory]   = useState("General");

  const [gameState,  setGameState]  = useState("idle");
  const [currentQ,   setCurrentQ]   = useState(null);
  const [timeLeft,   setTimeLeft]   = useState(0);
  const [totalTime,  setTotalTime]  = useState(0);
  // FIXED: separate locked answer from revealed result
  const [lockedAns,  setLockedAns]  = useState(null);   // what player picked
  const [revealed,   setRevealed]   = useState(false);  // whether correct answer is shown
  const [qResult,    setQResult]    = useState(null);
  const [leaderboard,setLeaderboard]= useState([]);
  const [isLast,     setIsLast]     = useState(false);
  const [myScore,    setMyScore]    = useState(0);
  const [feedback,   setFeedback]   = useState("");
  const [fbOk,       setFbOk]       = useState(null);
  const [ptsEarned,  setPtsEarned]  = useState(0);
  const [errMsg,     setErrMsg]     = useState("");

  const socketRef=useRef(null);
  const [codeCopied,copyCode]=useCopy();
  const [linkCopied,copyLink]=useCopy();

  const showErr=m=>{setErrMsg(m);setTimeout(()=>setErrMsg(""),3500);};
  useEffect(()=>{myNameRef.current=myName;},[myName]);

  const setupSocket=useCallback(()=>{
    if(socketRef.current)socketRef.current.disconnect();
    const s=createSocket();
    socketRef.current=s;

    s.on("room_created",    ({roomCode})=>{
      // Re-key images from "pending_N" to "ROOMCODE_N"
      questions.forEach((q,i)=>{
        const img=_localImgs[`pending_${i}`];
        if(img){ saveImg(roomCode,i,img); delete _localImgs[`pending_${i}`]; }
      });
      setRoomCode(roomCode);setScreen("lobby-host");
    });
    s.on("join_success",    ({roomCode,playerName})=>{
      setRoomCode(roomCode);setMyName(playerName);myNameRef.current=playerName;
      setScreen("lobby-player");SFX.join();
    });
    s.on("player_joined",   ({players})=>setPlayers(players));
    s.on("quiz_started",    ()=>{setScreen("game");setGameState("starting");setMyScore(0);SFX.start();});

    s.on("new_question",    q=>{
      // For host: inject the locally stored image back into the question
      const localImg = getImg(roomCode || "pending", q.questionIndex);
      const enriched = { ...q, image: localImg };
      setCurrentQ(enriched);
      setTimeLeft(q.timeLimit);
      setTotalTime(q.timeLimit);
      // CRITICAL: reset reveal state — answers must not show correct/wrong until timer ends
      setLockedAns(null);
      setRevealed(false);
      setQResult(null);
      setFeedback("");
      setFbOk(null);
      setPtsEarned(0);
      setGameState("question");
    });

    s.on("timer_update",    ({timeRemaining})=>{
      setTimeLeft(timeRemaining);
      if(timeRemaining<=3&&timeRemaining>0)SFX.tick();
    });

    // answer_locked: player chose something — show neutral lock, NO reveal yet
    s.on("answer_locked",   ({answer})=>{
      setLockedAns(answer);
      setFeedback("Answer locked — waiting for timer to end...");
      setFbOk(null);   // null = neutral purple, not green or red
      SFX.locked();
    });

    // FIXED: question_result is when reveal happens (timer ended on server)
    s.on("question_result", result=>{
      setQResult(result);
      setRevealed(true);   // NOW show correct/wrong colors
      setGameState("result");
      const me=Object.values(result.results).find(r=>r.name===myNameRef.current);
      if(me){
        const pts=me.pointsEarned||0;
        setPtsEarned(pts);
        setMyScore(s=>s+pts);
        if(me.correct){
          SFX.correct();
          setFbOk(true);
          setFeedback(pts>=900?"Perfect timing!":pts>=600?"Super fast!":"Correct!");
        } else {
          SFX.wrong();
          setFbOk(false);
          setFeedback(me.answer?"Wrong answer!":"Too slow!");
        }
      } else {
        setFeedback("Time is up!");
        setFbOk(false);
      }
    });

    s.on("leaderboard_update",({leaderboard,isLast})=>{
      setLeaderboard(leaderboard);setIsLast(isLast);setGameState("leaderboard");
    });
    s.on("quiz_finished",   ({leaderboard})=>{setLeaderboard(leaderboard);setScreen("finished");});
    s.on("error",           ({message})=>showErr(message));
    s.on("connect_error",   ()=>showErr("Cannot connect to server. Is it running on port 3001?"));
    return s;
  },[]);

  function validateQs(){
    for(let i=0;i<questions.length;i++){
      const q=questions[i];
      if(!q.text.trim()){showErr(`Q${i+1}: Question text is empty`);return false;}
      if(!q.correctAnswer.trim()){showErr(`Q${i+1}: Correct answer is empty`);return false;}
      if(q.incorrectAnswers.some(w=>!w.trim())){showErr(`Q${i+1}: Fill all 3 wrong answers`);return false;}
    }
    return true;
  }
  function updQ(i,f,v){setQuestions(qs=>qs.map((q,ix)=>ix===i?{...q,[f]:v}:q));}
  function addQ(){setQuestions(qs=>[...qs,{text:"",correctAnswer:"",incorrectAnswers:["","",""],timeLimit:10,image:""}]);}

  function doCreate(){
    if(!hostName.trim()){showErr("Enter your name");return;}
    if(!validateQs())return;
    const s=setupSocket();setRole("host");
    // Strip images before sending over socket — images break the quiz start
    // Store them locally so host can display them during gameplay
    const qs=questions.map((q,i)=>{
      if(q.image) saveImg("pending",i,q.image); // stored before roomCode known
      return {
        text:q.text.trim(),
        correctAnswer:q.correctAnswer.trim(),
        incorrectAnswers:q.incorrectAnswers.map(w=>w.trim()),
        timeLimit:q.timeLimit,
        hasImage: !!q.image,   // flag so players know an image exists
        imageIndex: i,          // index to retrieve from local store on host
      };
    });
    s.emit("create_room",{hostName:hostName.trim(),questions:qs});
  }
  function doJoin(){
    if(!playerName.trim()){showErr("Enter your name");return;}
    if(joinCode.trim().length<4){showErr("Enter the room code");return;}
    const s=setupSocket();setRole("player");
    setMyName(playerName.trim());myNameRef.current=playerName.trim();
    s.emit("join_room",{roomCode:joinCode.toUpperCase().trim(),playerName:playerName.trim()});
  }
  function doAnswer(ans){
    if(lockedAns||revealed)return;
    socketRef.current?.emit("submit_answer",{roomCode,answer:ans});
  }
  function doPlayAgain(){
    if(socketRef.current)socketRef.current.disconnect();
    socketRef.current=null;
    setScreen("home");setGameState("idle");setRoomCode("");setPlayers([]);
    setLeaderboard([]);setMyScore(0);setCurrentQ(null);setLockedAns(null);
    setRevealed(false);setQResult(null);setFeedback("");
    setQuestions([{text:"",correctAnswer:"",incorrectAnswers:["","",""],timeLimit:10,image:""}]);
    setQuizTitle("");
  }

  const shareLink=`endplays.xyz/join/${roomCode}`;

  const Nav=({right})=>(
    <nav style={{background:"rgba(255,255,255,.94)",backdropFilter:"blur(12px)",
      borderBottom:`1.5px solid ${C.border}55`,padding:"0 28px",height:64,
      display:"flex",alignItems:"center",justifyContent:"space-between",
      position:"sticky",top:0,zIndex:200,boxShadow:"0 2px 16px rgba(124,92,250,.07)"}}>
      <Logo size={30}/>{right}
    </nav>
  );

  const Footer=()=>(
    <footer style={{background:C.navy,color:"rgba(255,255,255,.5)",
      padding:"24px 28px",textAlign:"center",fontSize:14,fontWeight:400}}>
      <div style={{marginBottom:8}}>
        Built on <span style={{background:C.grad,WebkitBackgroundClip:"text",
          WebkitTextFillColor:"transparent",fontWeight:700}}>EndPlays</span>
        {" "}— Real-time multiplayer quizzes
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:20,fontSize:13}}>
        {["Twitter","Discord","GitHub"].map(s=>(
          <a key={s} href="#" style={{color:"rgba(255,255,255,.4)",textDecoration:"none",transition:"color .2s"}}
            onMouseEnter={e=>e.target.style.color="#fff"}
            onMouseLeave={e=>e.target.style.color="rgba(255,255,255,.4)"}>{s}</a>
        ))}
      </div>
    </footer>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HOME
  // ════════════════════════════════════════════════════════════════════════════
  if(screen==="home") return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column"}}>
      <GCss/>
      <Nav right={
        <div style={{display:"flex",gap:10}}>
          <Btn v="outline" full={false} sz="sm" onClick={()=>setScreen("join")}>Join Game</Btn>
          <Btn v="primary" full={false} sz="sm" onClick={()=>setScreen("host-setup")}>Host a Quiz</Btn>
        </div>
      }/>

      {/* HERO */}
      <div style={{position:"relative",background:C.gradD,padding:"72px 24px 90px",
        textAlign:"center",overflow:"hidden"}}>
        <BgShapes/>
        <div style={{position:"relative",zIndex:1,maxWidth:640,margin:"0 auto"}}>
          <div className="hero-h fu" style={{fontWeight:700,fontSize:54,color:"#fff",
            lineHeight:1.08,marginBottom:18,letterSpacing:".01em"}}>
            Play fun quizzes<br/>with friends
          </div>
          <div className="fu" style={{fontSize:17,color:"rgba(255,255,255,.86)",fontWeight:400,
            lineHeight:1.72,marginBottom:44,animationDelay:".08s"}}>
            Host your own quiz in minutes. No signup required.<br/>
            Speed and accuracy wins the leaderboard.
          </div>

          {/* PIN entry — FIXED: join button inside container, properly aligned */}
          <div className="fu pop" style={{background:"rgba(255,255,255,.18)",
            backdropFilter:"blur(18px)",borderRadius:24,padding:"28px 32px",
            maxWidth:460,margin:"0 auto",border:"1.5px solid rgba(255,255,255,.3)",
            animationDelay:".16s"}}>
            <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.72)",
              letterSpacing:".18em",textTransform:"uppercase",marginBottom:14}}>
              Enter Room Code
            </div>
            {/* FIXED: Flex row with join button properly inside the same container */}
            <div style={{display:"flex",gap:10,alignItems:"stretch"}}>
              <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==="Enter"&&setScreen("join")}
                placeholder="XXXXXX" maxLength={6}
                style={{flex:1,padding:"15px 18px",borderRadius:14,outline:"none",
                  border:"2px solid rgba(255,255,255,.38)",background:"rgba(255,255,255,.22)",
                  color:"#fff",fontSize:26,fontWeight:700,letterSpacing:".35em",
                  textAlign:"center",fontFamily:"'Fredoka',sans-serif",
                  transition:"border-color .2s"}}
                onFocus={e=>{e.target.style.borderColor="rgba(255,255,255,.7)";}}
                onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,.38)";}}
              />
              <button className="btn-h"
                onClick={()=>{if(joinCode.trim().length>=4){setScreen("join");}}}
                style={{padding:"0 28px",borderRadius:14,background:"#fff",color:C.purple,
                  border:"none",fontSize:17,fontWeight:700,cursor:"pointer",
                  boxShadow:"0 4px 18px rgba(0,0,0,.16)",whiteSpace:"nowrap",
                  transition:"all .18s ease",display:"flex",alignItems:"center"}}>
                Join
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS — SVG icons, no emojis */}
      <div style={{maxWidth:820,margin:"0 auto",padding:"60px 24px 12px",width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <GT size={34} style={{display:"block"}}>How it works</GT>
          <div style={{color:C.muted,fontWeight:400,fontSize:16,marginTop:6}}>
            Get a game going in under 2 minutes
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}} className="g3">
          {[
            {Icon:Icon.Build,  title:"Build your quiz",  desc:"Add questions, images, 4 answers and a custom timer for each question."},
            {Icon:Icon.Share,  title:"Share the code",   desc:"Players join on phone or laptop — no app, no account needed."},
            {Icon:Icon.Compete,title:"Compete and win",  desc:"Answer faster for more points. Live leaderboard after every question."},
          ].map((f,i)=>(
            <Card key={i} style={{textAlign:"center",padding:"32px 20px"}} cls="fu" hover>
              <div style={{marginBottom:16,display:"flex",justifyContent:"center"}}><f.Icon/></div>
              <GT size={20} style={{display:"block",marginBottom:10}}>{f.title}</GT>
              <div style={{fontSize:14,color:C.muted,fontWeight:400,lineHeight:1.7}}>{f.desc}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* FEATURES STRIP */}
      <div style={{maxWidth:820,margin:"0 auto",padding:"28px 24px",width:"100%"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}} className="g3">
          {[
            {Icon:Icon.Speed, label:"Speed scoring",    desc:"Faster = more points",       col:C.yellow},
            {Icon:Icon.Lock,  label:"One answer only",  desc:"No switching, no cheating",  col:C.red},
            {Icon:Icon.Chart, label:"Live leaderboard", desc:"Rankings after every round",  col:C.purple},
          ].map(f=>(
            <div key={f.label} style={{background:f.col+"14",border:`2px solid ${f.col}28`,
              borderRadius:18,padding:"20px 18px",display:"flex",alignItems:"center",gap:14}}>
              <div style={{flexShrink:0}}><f.Icon/></div>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:f.col}}>{f.label}</div>
                <div style={{fontSize:13,color:C.muted,fontWeight:400}}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — centered button with glow animation */}
      <div style={{maxWidth:820,margin:"0 auto",padding:"12px 24px 64px",width:"100%"}}>
        <GCard style={{textAlign:"center",padding:"52px 32px"}}>
          <div style={{fontWeight:700,fontSize:32,color:"#fff",marginBottom:12,letterSpacing:".01em"}}>
            Ready to host your own quiz?
          </div>
          <div style={{color:"rgba(255,255,255,.8)",fontWeight:400,fontSize:16,marginBottom:32}}>
            Build it in minutes. Play with anyone, anywhere.
          </div>
          <div style={{display:"flex",justifyContent:"center"}}>
            <button className="btn-h"
              onClick={()=>setScreen("host-setup")}
              style={{padding:"16px 48px",borderRadius:16,background:"#fff",color:C.purple,
                border:"none",fontSize:18,fontWeight:700,cursor:"pointer",
                boxShadow:"0 6px 24px rgba(0,0,0,.18)",
                transition:"all .2s ease",animation:"glow 2.5s ease-in-out infinite",
                display:"inline-block"}}>
              Create a Quiz
            </button>
          </div>
        </GCard>
      </div>
      <Footer/>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // JOIN
  // ════════════════════════════════════════════════════════════════════════════
  if(screen==="join") return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",padding:24,position:"relative"}}>
      <GCss/><BgShapes/>
      <div style={{width:"100%",maxWidth:420,position:"relative",zIndex:1}} className="pop">
        <div style={{textAlign:"center",marginBottom:28}}>
          <Logo size={40}/>
          <div style={{color:C.muted,fontSize:16,fontWeight:400,marginTop:8}}>
            Enter your details to join
          </div>
        </div>
        <Card style={{display:"flex",flexDirection:"column",gap:16}}>
          <ErrBox msg={errMsg}/>
          <div><Lbl>Your Name</Lbl>
            <Inp ph="What's your name?" val={playerName} set={setPlayerName} autoFocus/></div>
          <div><Lbl>Room Code</Lbl>
            <Inp ph="e.g. AB12CD" val={joinCode} set={v=>setJoinCode(v.toUpperCase())}
              kd={e=>e.key==="Enter"&&doJoin()} ml={6}
              style={{textTransform:"uppercase",letterSpacing:".3em",textAlign:"center",fontSize:28,fontWeight:700}}/></div>
          <Btn sz="lg" onClick={doJoin}>Join Game</Btn>
          <Btn v="ghost" onClick={()=>setScreen("home")}>Back to Home</Btn>
        </Card>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HOST SETUP
  // ════════════════════════════════════════════════════════════════════════════
  if(screen==="host-setup") return(
    <div style={{minHeight:"100vh",background:C.bg}}>
      <GCss/>
      <Nav right={<Btn v="ghost" full={false} sz="sm" onClick={()=>setScreen("home")}>Back</Btn>}/>
      <div style={{maxWidth:900,margin:"0 auto",padding:"32px 24px 80px"}}>
        <div style={{marginBottom:26}}>
          <GT size={36} style={{display:"block"}}>Create Your Quiz</GT>
          <div style={{color:C.muted,fontWeight:400,fontSize:16,marginTop:4}}>
            Add questions, upload images, set timers — then launch!
          </div>
        </div>
        <ErrBox msg={errMsg}/>
        <Card style={{marginTop:errMsg?16:0,marginBottom:24}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}} className="g3">
            <div><Lbl>Your Name (Host)</Lbl>
              <Inp ph="Enter your name..." val={hostName} set={setHostName}/></div>
            <div><Lbl>Quiz Title</Lbl>
              <Inp ph="e.g. Science Challenge..." val={quizTitle} set={setQuizTitle}/></div>
            <div><Lbl>Category</Lbl>
              <select value={category} onChange={e=>setCategory(e.target.value)}
                style={{width:"100%",padding:"12px 14px",borderRadius:12,
                  border:`2px solid ${C.border}`,background:"#fafaff",color:C.navy,
                  fontSize:15,fontWeight:500,cursor:"pointer",outline:"none"}}>
                {CATEGORIES.map(c=><option key={c.label} value={c.label}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
          </div>
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          {questions.map((q,i)=>(
            <QCard key={i} q={q} idx={i} total={questions.length}
              onChange={(f,v)=>updQ(i,f,v)}
              onRemove={()=>setQuestions(qs=>qs.filter((_,ix)=>ix!==i))}/>
          ))}
        </div>
        <div style={{display:"flex",gap:14,marginTop:24,flexWrap:"wrap"}}>
          <Btn v="outline" full={false} style={{flex:1,minWidth:160}} onClick={addQ}>
            + Add Question
          </Btn>
          <Btn full={false} style={{flex:2,minWidth:200}} sz="lg" onClick={doCreate}>
            Create Room ({questions.length} question{questions.length!==1?"s":""})
          </Btn>
        </div>
      </div>
      <Footer/>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HOST LOBBY
  // ════════════════════════════════════════════════════════════════════════════
  if(screen==="lobby-host") return(
    <div style={{minHeight:"100vh",background:C.bg}}>
      <GCss/>
      <Nav right={<Pill color="#22c55e">Room Live</Pill>}/>
      <div style={{maxWidth:720,margin:"0 auto",padding:"28px 24px",display:"flex",flexDirection:"column",gap:20}}>

        <GCard cls="pop" style={{textAlign:"center"}}>
          <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.68)",
            letterSpacing:".2em",textTransform:"uppercase",marginBottom:12}}>
            Share this code with players
          </div>
          <div className="code-d" style={{fontFamily:"'Fredoka',sans-serif",fontWeight:700,
            fontSize:76,color:"#fff",letterSpacing:".45em",lineHeight:1,marginBottom:20}}>
            {roomCode}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-h" onClick={()=>copyCode(roomCode)}
              style={{padding:"10px 24px",borderRadius:10,background:"rgba(255,255,255,.22)",
                color:"#fff",border:"1.5px solid rgba(255,255,255,.35)",fontSize:14,
                fontWeight:600,cursor:"pointer",transition:"all .18s"}}>
              {codeCopied?"Copied!":"Copy Code"}
            </button>
            <button className="btn-h" onClick={()=>copyLink(shareLink)}
              style={{padding:"10px 24px",borderRadius:10,background:"rgba(255,255,255,.22)",
                color:"#fff",border:"1.5px solid rgba(255,255,255,.35)",fontSize:14,
                fontWeight:600,cursor:"pointer",transition:"all .18s"}}>
              {linkCopied?"Copied!":"Copy Join Link"}
            </button>
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.45)",marginTop:10}}>
            {shareLink}
          </div>
        </GCard>

        <Card>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <GT size={22}>Players in Lobby</GT>
            <Pill>{players.length} joined</Pill>
          </div>
          {players.length===0
            ? <div style={{textAlign:"center",padding:"32px 0",color:C.muted}}>
                <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
                  <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                    <circle cx="26" cy="20" r="10" stroke={C.purpleD} strokeWidth="2" fill="none"/>
                    <path d="M10 44 a16 16 0 0 1 32 0" stroke={C.purpleD} strokeWidth="2" strokeLinecap="round" fill="none"/>
                    <circle cx="38" cy="38" r="6" fill={C.green}/>
                    <line x1="38" y1="35" x2="38" y2="41" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="35" y1="38" x2="41" y2="38" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{fontWeight:600,fontSize:16}}>Waiting for players...</div>
                <div style={{fontSize:14,marginTop:6}}>Share the code above</div>
              </div>
            : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
                {players.map((p,i)=>(
                  <div key={p.id} className="sl" style={{background:"#fafaff",
                    border:`1.5px solid ${C.border}`,borderRadius:14,
                    padding:"12px 14px",display:"flex",alignItems:"center",gap:8,
                    animationDelay:`${i*.05}s`}}>
                    <Av name={p.name} size={32}/>
                    <span style={{fontWeight:600,fontSize:14,color:C.navy,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                  </div>
                ))}
              </div>
          }
        </Card>

        <Card>
          <GT size={20} style={{display:"block",marginBottom:14}}>
            {quizTitle||"Your Quiz"} — {questions.length} Questions
          </GT>
          {questions.map((q,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
              background:"#fafaff",borderRadius:10,border:`1.5px solid ${C.border}`,marginBottom:8}}>
              <div style={{width:26,height:26,borderRadius:8,background:`${C.purple}18`,color:C.purple,
                fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
              {q.image&&<img src={q.image} alt="" style={{width:32,height:32,borderRadius:6,objectFit:"cover",flexShrink:0}}/>}
              <span style={{flex:1,fontSize:14,fontWeight:500,color:C.navy,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.text||"—"}</span>
              <Pill color={C.muted}>{q.timeLimit}s</Pill>
            </div>
          ))}
        </Card>

        <Btn sz="lg" disabled={players.length===0}
          onClick={()=>socketRef.current?.emit("start_quiz",{roomCode})}>
          {players.length===0?"Waiting for players...":"Start the Quiz"}
        </Btn>
      </div>
      <Footer/>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PLAYER LOBBY
  // ════════════════════════════════════════════════════════════════════════════
  if(screen==="lobby-player") return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",padding:24,position:"relative"}}>
      <GCss/><BgShapes/>
      <div style={{width:"100%",maxWidth:520,display:"flex",flexDirection:"column",
        gap:18,position:"relative",zIndex:1}}>
        <GCard cls="pop" style={{textAlign:"center",padding:"32px 28px"}}>
          <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.68)",
            letterSpacing:".18em",textTransform:"uppercase",marginBottom:10}}>You're in!</div>
          <div className="code-d" style={{fontFamily:"'Fredoka',sans-serif",fontWeight:700,
            fontSize:66,color:"#fff",letterSpacing:".4em",lineHeight:1}}>{roomCode}</div>
          <div style={{marginTop:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            <Av name={myName} size={36}/>
            <span style={{background:"rgba(255,255,255,.22)",color:"#fff",borderRadius:20,
              padding:"5px 18px",fontSize:16,fontWeight:600}}>{myName}</span>
          </div>
        </GCard>

        <Card>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <GT size={20}>Players ({players.length})</GT>
            <Pill color="#22c55e">Online</Pill>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {players.map((p,i)=>{
              const isMe=p.name===myName;
              return(
                <div key={p.id} className="sl"
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                    background:isMe?`${C.purple}0d`:"#fafaff",
                    border:`1.5px solid ${isMe?C.purple+"55":C.border}`,
                    borderRadius:13,animationDelay:`${i*.04}s`,
                    boxShadow:isMe?`0 0 0 2px ${C.purple}22`:undefined}}>
                  <Av name={p.name} size={34}/>
                  <span style={{fontWeight:600,fontSize:15,color:isMe?C.purple:C.navy}}>
                    {p.name}{isMe?" (you)":""}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <div style={{textAlign:"center",padding:"6px 0"}}>
          <div style={{color:C.muted,fontWeight:400,fontSize:16,marginBottom:14}}>
            Waiting for host to start...
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:8}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:10,height:10,borderRadius:"50%",background:C.purple,
                animation:`pulse 1.2s ${i*.38}s infinite`}}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // GAME
  // ════════════════════════════════════════════════════════════════════════════
  if(screen==="game"){
    const myLb=leaderboard.find(p=>p.name===myName);
    const pct=totalTime>0?(timeLeft/totalTime)*100:0;
    const barCol=timeLeft<=3?C.red:timeLeft<=5?C.yellow:C.purple;

    return(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column"}}>
        <GCss/>
        <div style={{background:"rgba(255,255,255,.94)",backdropFilter:"blur(12px)",
          borderBottom:`1.5px solid ${C.border}55`,padding:"0 22px",height:56,
          display:"flex",alignItems:"center",justifyContent:"space-between",
          position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 10px rgba(124,92,250,.06)"}}>
          <Logo size={22}/>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            {currentQ&&<Pill color={C.muted}>Q{currentQ.questionIndex+1}/{currentQ.totalQuestions}</Pill>}
            <Pill color={C.yellow}>{myScore.toLocaleString()} pts</Pill>
            {myLb&&<Pill color={C.purple}>#{myLb.rank}</Pill>}
          </div>
        </div>

        <div style={{maxWidth:680,margin:"0 auto",padding:"18px 18px 40px",
          display:"flex",flexDirection:"column",gap:14,width:"100%"}}>

          {/* Starting */}
          {gameState==="starting"&&(
            <Card style={{textAlign:"center",padding:"72px 24px"}} cls="pop">
              <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
                <Icon.Trophy/>
              </div>
              <GT size={40} style={{display:"block"}}>Get Ready!</GT>
              <div style={{color:C.muted,fontWeight:400,fontSize:17,marginTop:8}}>
                First question incoming...
              </div>
            </Card>
          )}

          {/* Question + options */}
          {(gameState==="question"||gameState==="result")&&currentQ&&(
            <>
              {/* Timer bar */}
              {gameState==="question"&&(
                <div style={{background:C.border,borderRadius:99,height:12,overflow:"hidden",
                  boxShadow:"inset 0 1px 3px rgba(0,0,0,.06)"}}>
                  <div style={{height:"100%",borderRadius:99,
                    background:timeLeft<=3?`linear-gradient(90deg,${C.red},#ff8080)`:
                      timeLeft<=5?`linear-gradient(90deg,${C.yellow},#ffe066)`:C.grad,
                    width:`${pct}%`,transition:"width .95s linear",
                    boxShadow:`0 0 8px ${barCol}55`}}/>
                </div>
              )}

              {/* Question card */}
              <Card cls="pop" style={{padding:"22px 24px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:".12em",
                      textTransform:"uppercase",marginBottom:12}}>
                      Question {currentQ.questionIndex+1}
                    </div>
                    {/* Image: host sees real image (from local store), players see placeholder */}
                    {currentQ.image&&currentQ.image.length>0
                      ? <div style={{marginBottom:14}}>
                          <img src={currentQ.image} alt="question"
                            style={{width:"100%",maxHeight:240,objectFit:"contain",
                              borderRadius:14,border:`1.5px solid ${C.border}`}}/>
                        </div>
                      : currentQ.hasImage
                        ? <div style={{marginBottom:14,background:"#f0f0fa",borderRadius:14,
                            padding:"20px",textAlign:"center",border:`1.5px dashed ${C.border}`,
                            color:C.muted,fontSize:14,fontWeight:500}}>
                            Image question — look at the host's screen
                          </div>
                        : null
                    }
                    <div style={{fontSize:"clamp(18px,3.8vw,26px)",fontWeight:600,
                      color:C.navy,lineHeight:1.35}}>
                      {currentQ.text}
                    </div>
                  </div>
                  {gameState==="question"&&(
                    <div style={{textAlign:"center",flexShrink:0,minWidth:56}}>
                      <div style={{fontSize:52,fontWeight:700,lineHeight:1,
                        color:barCol,transition:"color .3s",
                        textShadow:timeLeft<=3?`0 0 16px ${C.red}88`:undefined}}>
                        {timeLeft}
                      </div>
                      <div style={{fontSize:10,color:C.muted,fontWeight:600,letterSpacing:".1em",textTransform:"uppercase"}}>secs</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Feedback */}
              {feedback&&(
                <div className="pop" style={{textAlign:"center",padding:"14px 22px",borderRadius:16,
                  fontSize:18,fontWeight:600,
                  background:fbOk===null?`${C.purple}12`:fbOk?"#f0fdf4":"#fff0f0",
                  border:`2px solid ${fbOk===null?C.purple+"33":fbOk?"#22c55e44":C.red+"44"}`,
                  color:fbOk===null?C.purple:fbOk?"#16a34a":"#dc2626"}}>
                  {feedback}
                  {fbOk&&ptsEarned>0&&(
                    <span style={{marginLeft:12,fontWeight:700,fontSize:20,color:C.yellow}}>
                      +{ptsEarned} pts
                    </span>
                  )}
                </div>
              )}

              {/* FIXED: Answer options — only show correct/wrong AFTER revealed=true (timer ended) */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}} className="g4">
                {currentQ.options.map((opt,idx)=>{
                  const m=OPTS[idx%4];
                  const isLocked=!!lockedAns||revealed;
                  const isPicked=lockedAns===opt;

                  // FIXED: Colors only change after reveal
                  let bg=m.bg, border=m.border, textCol=C.navy, opacity=1, shape=m.shape;
                  let shadow=`0 2px 10px ${m.color}1a`;

                  if(revealed&&qResult){
                    // After timer: show correct/wrong
                    if(opt===qResult.correctAnswer){
                      bg="#d1fae5";border="#22c55e";textCol="#15803d";shape="✓";
                      shadow="0 4px 18px rgba(34,197,94,.28)";
                    } else if(isPicked){
                      bg="#fee2e2";border=C.red;textCol="#b91c1c";shape="✗";
                      shadow=`0 4px 18px rgba(255,77,77,.22)`;
                    } else {
                      opacity=0.3;
                    }
                  } else if(isPicked){
                    // Locked but not yet revealed: just highlight without correct/wrong
                    bg=m.color+"18"; border=m.color; shape="•";
                    shadow=`0 4px 16px ${m.color}33`;
                  }

                  return(
                    <button key={opt} className={!isLocked?"opt-b":""}
                      onClick={!isLocked?()=>doAnswer(opt):undefined}
                      style={{padding:"clamp(14px,2.5vw,20px) 14px",borderRadius:18,
                        border:`2px solid ${border}`,cursor:isLocked?"default":"pointer",
                        background:bg,opacity,color:textCol,textAlign:"left",
                        display:"flex",alignItems:"center",gap:10,boxShadow:shadow,
                        transition:"all .2s ease",fontFamily:"'Fredoka',sans-serif",
                        animation:revealed?"revealOpt .35s ease both":undefined,
                        animationDelay:revealed?`${idx*.07}s`:undefined}}>
                      <span style={{background:m.color+"24",borderRadius:9,
                        width:32,height:32,flexShrink:0,color:revealed&&opt===qResult?.correctAnswer?"#16a34a":m.color,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:15,fontWeight:700}}>
                        {shape}
                      </span>
                      <span style={{fontSize:"clamp(13px,2.2vw,15px)",fontWeight:600,lineHeight:1.3}}>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Leaderboard — staggered row-by-row, highest scorer first */}
          {gameState==="leaderboard"&&(
            <Card cls="pop" style={{padding:"24px 22px"}}>
              <div style={{textAlign:"center",marginBottom:20}}>
                <GT size={30} style={{display:"block"}}>Leaderboard</GT>
                {ptsEarned>0&&fbOk&&(
                  <div className="pop" style={{marginTop:10,display:"inline-block",
                    background:`${C.yellow}18`,border:`1.5px solid ${C.yellow}55`,
                    borderRadius:12,padding:"6px 18px",fontSize:15,fontWeight:600,color:C.navy}}>
                    You gained <span style={{color:C.yellow,fontWeight:700}}>+{ptsEarned}</span> points this round
                  </div>
                )}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Sort rank 1 at top, animate from highest scorer down */}
                {[...leaderboard].sort((a,b)=>a.rank-b.rank).map((p,i)=>(
                  <LbRow key={p.id||p.name} p={p} myName={myName} idx={i}/>
                ))}
              </div>
              {!isLast&&(
                <div style={{textAlign:"center",marginTop:16,color:C.muted,fontSize:14}}>
                  Next question coming up...
                </div>
              )}
              {role==="host"&&(
                <div style={{marginTop:16}}>
                  <Btn onClick={()=>socketRef.current?.emit("next_question",{roomCode})} sz="lg">
                    {isLast?"See Final Results":"Next Question"}
                  </Btn>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FINISHED
  // ════════════════════════════════════════════════════════════════════════════
  if(screen==="finished"){
    const me=leaderboard.find(p=>p.name===myName);
    return(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",padding:24,position:"relative"}}>
        <GCss/><BgShapes/>
        <div style={{width:"100%",maxWidth:560,display:"flex",flexDirection:"column",
          gap:18,position:"relative",zIndex:1}}>

          <GCard cls="pop" style={{textAlign:"center",padding:"48px 28px"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
              <Icon.Trophy/>
            </div>
            <div style={{fontWeight:700,fontSize:38,color:"#fff",marginBottom:6}}>
              {me?.rank===1?"You Won!":me?.rank===2?"Runner Up!":me?.rank===3?"Third Place!":`Rank #${me?.rank}`}
            </div>
            <div style={{fontWeight:700,fontSize:52,color:"#fef3c7",letterSpacing:".02em"}}>
              {(me?.score||0).toLocaleString()} pts
            </div>
          </GCard>

          <Card>
            <GT size={26} style={{display:"block",marginBottom:18}}>Final Standings</GT>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {leaderboard.map((p,i)=>(
                <LbRow key={p.id} p={p} myName={myName} idx={i}/>
              ))}
            </div>
          </Card>

          <Btn sz="lg" onClick={doPlayAgain}>Play Again</Btn>
          <Btn v="ghost" onClick={doPlayAgain}>Back to Home</Btn>
        </div>
        <div style={{marginTop:32,position:"relative",zIndex:1,width:"100%"}}>
          <Footer/>
        </div>
      </div>
    );
  }

  return null;
}
