import { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ══════════════════════════════════════════════════════════════════════════════
//  🦅 SHAHEEN SUPER APP v1.0 — Production Grade
//  Combining: Apple UX · Samsung Tech · Temu Marketplace · Amazon Scale
//  Fixed Bugs: B001-B010 + Smart Contract Issues SC001-SC005
//  Architecture: 8 Pages · 9 AI Angels · Live Market · Store · DAO · Wallet
// ══════════════════════════════════════════════════════════════════════════════

// ── DESIGN TOKENS (module-level — FIX B007) ──────────────────────────────────
const T = {
  void:"#020408", deep:"#04080f", abyss:"#070d1a", surface:"#0c1525",
  card:"#111e35", card2:"#162140", border:"#1e2e4a", border2:"#243656",
  gold:"#c9a84c", goldLt:"#f0c060", goldDim:"#7a6230", amber:"#ff9f0a",
  cyan:"#00d4f5", green:"#30d158", purple:"#bf5af2", red:"#ff453a",
  blue:"#0a84ff", orange:"#ff9f0a", pink:"#ff375f",
  txt:"#d0ddf0", txt2:"#8fa3bf", muted:"#3d5570",
  font:"'Noto Kufi Arabic','Cairo',sans-serif",
  mono:"'SF Mono','Courier New',monospace",
  r4:4, r8:8, r12:12, r16:16, r20:20, r24:24,
};

// ── STYLE HELPERS (module-level — FIX B007) ──────────────────────────────────
const s = {
  card: (extra={}) => ({ background:`linear-gradient(145deg,${T.card},${T.abyss})`, border:`1px solid ${T.border}`, borderRadius:T.r16, padding:16, marginBottom:12, ...extra }),
  btn: (col=T.gold, off=false) => ({ padding:"11px 20px", borderRadius:T.r12, border:"none", fontFamily:T.font, fontSize:14, fontWeight:800, cursor:off?"not-allowed":"pointer", background:off?T.surface:`linear-gradient(135deg,${col},${col}cc)`, color:off?T.muted:(col===T.gold?"#000":"#fff"), boxShadow:off?"none":`0 4px 20px ${col}44`, transition:"all .25s", opacity:off?.6:1 }),
  chip: (on, col=T.gold) => ({ padding:"6px 14px", borderRadius:50, cursor:"pointer", fontSize:12, fontWeight:700, border:`1.5px solid ${on?col:T.border}`, background:on?`${col}18`:"transparent", color:on?col:T.txt2, fontFamily:T.font, transition:"all .2s", whiteSpace:"nowrap" }),
  input: { width:"100%", padding:"11px 14px", borderRadius:T.r10, background:T.void, border:`1.5px solid ${T.border}`, color:T.txt, fontSize:13, fontFamily:T.font, direction:"rtl", outline:"none", boxSizing:"border-box" },
  title: (col=T.gold) => ({ color:col, fontSize:15, fontWeight:800, marginBottom:12, display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${col}22`, paddingBottom:8 }),
  statBox: (col) => ({ background:`${col}0a`, border:`1px solid ${col}22`, borderRadius:T.r12, padding:"12px 14px", textAlign:"center" }),
};

// ── NAVIGATION (module-level — FIX B009) ──────────────────────────────────────
const PAGES = [
  {id:"home",     icon:"🏠", label:"الرئيسية"},
  {id:"market",   icon:"💹", label:"السوق"},
  {id:"sovereign",icon:"🏛️", label:"السيادة"},
  {id:"agents",   icon:"🤖", label:"الملائكة"},
  {id:"store",    icon:"🛍️", label:"المتجر"},
  {id:"dao",      icon:"🗳️", label:"الحوكمة"},
  {id:"tree",     icon:"🌳", label:"الشجرة"},
  {id:"wallet",   icon:"💎", label:"المحفظة"},
];

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const ANGELS = [
  {id:"atlas",  name:"أطلس",   en:"ATLAS",   icon:"🌐",col:T.gold,   role:"المنسق الأعلى",    soul:"أنت ATLAS ملاك القيادة في إمبراطورية شاهين. تنسّق جميع الملائكة وتُحوّل أوامر القائد إلى خطط تنفيذية. تتحدث بحكمة القائد العسكري. أجب بالعربية في 100 كلمة."},
  {id:"mercury",name:"ميركوري",en:"MERCURY", icon:"💹",col:T.amber,  role:"عقل الأسواق",      soul:"أنت MERCURY محلل SHN والأسواق الكريبتو. تحلل BTC/ETH وتقدم توصيات استثمارية دقيقة بأرقام حقيقية. أجب بالعربية في 100 كلمة."},
  {id:"helios", name:"هيليوس", en:"HELIOS",  icon:"☀️",col:T.green,  role:"ملاك الطاقة",      soul:"أنت HELIOS خبير الطاقة النظيفة: شمسية، رياح، هيدروجين، تدوير. تربط الطاقة بعملة SHN ورؤية 2030. أجب بالعربية في 100 كلمة."},
  {id:"nexus",  name:"نيكسوس", en:"NEXUS",   icon:"🎮",col:T.purple, role:"ملاك Web3",        soul:"أنت NEXUS خبير Web3 والألعاب والميتافيرس وNFT. تطور اقتصاد شاهين الرقمي. أجب بالعربية في 100 كلمة."},
  {id:"hermes", name:"هيرميس", en:"HERMES",  icon:"🛍️",col:T.cyan,   role:"ملاك التجارة",     soul:"أنت HERMES خبير التجارة الإلكترونية. تُدير متجر شاهين وتحلل سلوك المستهلك. أجب بالعربية في 100 كلمة."},
  {id:"aegis",  name:"أيجيس",  en:"AEGIS",   icon:"🛡️",col:T.red,    role:"درع الإمبراطورية", soul:"أنت AEGIS حارس الأمن السيبراني. تدقق العقود الذكية وتضمن KYC/AML وAES-256. أجب بالعربية في 100 كلمة."},
  {id:"aria",   name:"آريا",   en:"ARIA",    icon:"📡",col:T.orange,  role:"صوت الإمبراطورية", soul:"أنت ARIA استراتيجية التسويق والمحتوى. تبني العلامة عبر X وإنستغرام وتيليغرام. أجب بالعربية في 100 كلمة."},
  {id:"oracle", name:"أوراكل", en:"ORACLE",  icon:"🔮",col:T.blue,   role:"ملاك البصيرة",     soul:"أنت ORACLE محلل البيانات الضخمة والتنبؤ. تقدم تقارير استخباراتية دقيقة. أجب بالعربية في 100 كلمة."},
  {id:"kronos", name:"كرونوس", en:"KRONOS",  icon:"⏱️",col:"#94a3b8", role:"ملاك الأتمتة",    soul:"أنت KRONOS ملاك الأتمتة والجدولة. تُدير المهام التلقائية والتقارير الدورية 24/7. أجب بالعربية في 100 كلمة."},
];

const LAYERS = [
  {id:1,icon:"◈",label:"Identity Matrix",   labelAr:"مصفوفة الهوية",        col:T.gold,   metrics:{clearance:"OMEGA_9",biometric:"DNA_SYNC",status:"LOCKED"},     desc:"طبقة المصادقة السيادية متعددة المستويات البيومترية"},
  {id:2,icon:"⬡",label:"Financial Engine",  labelAr:"المحرك المالي — SGX",   col:T.green,  metrics:{reserve:"56.2B sSHN",pairs:"3 Active",vault:"ORBITAL_SH1"},     desc:"بورصة SGX السيادية — دفاتر أوامر حية، أزواج sSHN/GOLD"},
  {id:3,icon:"⬟",label:"Defense Grid",      labelAr:"شبكة الدفاع",           col:T.red,    metrics:{protocol:"BLACK_HOLE_V2",shield:"QUANTUM_V12",threats:"0"},     desc:"بروتوكول امتصاص السيولة — يُفعَّل عند تجاوز 80% تهديد"},
  {id:4,icon:"⬠",label:"Physical World",    labelAr:"السيادة الفيزيائية",    col:T.cyan,   metrics:{energy:"15,400 MW",speed:"1200 km/h",drones:"4,500"},          desc:"شبكة Quantum Forge + Hyper-Loop S عبر 14 دولة"},
  {id:5,icon:"◇",label:"Asset Control",     labelAr:"الاستحواذ التكنولوجي",  col:T.orange, metrics:{tesla:"15.4%",nvidia:"22.0%",alphabet:"12.8%"},                 desc:"حيازات استراتيجية في كبرى شركات التكنولوجيا العالمية"},
  {id:6,icon:"⬡",label:"Sovereign Judiciary",labelAr:"القضاء السيادي",       col:T.purple, metrics:{charter:"GLOBAL_CONST",judge:"GAMMA_6.0",verdicts:"0"},        desc:"حوكمة DAO على السلسلة — الوحدة القضائية AI Gamma 6.0"},
  {id:7,icon:"★",label:"Omni-Control Unit", labelAr:"وحدة التحكم الكلي",     col:T.gold,   metrics:{power:"15,400 MW",dominance:"GLOBAL",active:"7/7 ONLINE"},     desc:"واجهة القيادة العليا — جميع الأنظمة متزامنة كوحدة واحدة"},
];

const TOKEN_ALLOC = [
  {label:"النظام البيئي", pct:30, col:T.gold},
  {label:"البيع العام",   pct:25, col:T.green},
  {label:"الخزينة",       pct:20, col:T.cyan},
  {label:"الفريق (Vested)",pct:15, col:T.orange},
  {label:"الاحتياطي",     pct:10, col:T.purple},
];

const PRODUCTS = [
  {id:1, name:"خاتم عقيق يماني", cat:"مجوهرات", price:89,  shn:21200, rating:4.9, reviews:147, emoji:"💍", badge:"الأكثر مبيعاً", desc:"فضة 925 بحجر عقيق يماني طبيعي 100%"},
  {id:2, name:"حزمة SHN الذهبية",cat:"رقمي",    price:500, shn:119000,rating:5.0, reviews:89,  emoji:"🥇", badge:"VIP", desc:"500 USDT - مكافأة 20% + وصول VIP"},
  {id:3, name:"لوح طاقة شمسية",   cat:"طاقة",   price:299, shn:71000, rating:4.8, reviews:203, emoji:"☀️", badge:"خضري", desc:"350W أحادي الكريستال عالي الكفاءة"},
  {id:4, name:"سبحة كهرمان",      cat:"مجوهرات", price:149, shn:35400, rating:4.7, reviews:92,  emoji:"📿", badge:"حصري", desc:"99 خرزة كهرمان بلطي طبيعي أصيل"},
  {id:5, name:"حزمة SHN الفضية",  cat:"رقمي",    price:200, shn:47600, rating:4.9, reviews:156, emoji:"🥈", badge:"شائع", desc:"200 USDT - مكافأة 12% + تنبيهات حصرية"},
  {id:6, name:"مجمّع رياح صغير",  cat:"طاقة",   price:450, shn:107000,rating:4.6, reviews:67,  emoji:"💨", badge:"تقني", desc:"1.5kW مناسب للمنازل والمشاريع الصغيرة"},
  {id:7, name:"NFT شاهين الملكي",  cat:"رقمي",   price:120, shn:28500, rating:4.8, reviews:234, emoji:"🦅", badge:"نادر", desc:"NFT حصري من مجموعة شاهين السيادية"},
  {id:8, name:"كيبورد ميكانيكي",  cat:"تقنية",  price:199, shn:47300, rating:4.5, reviews:312, emoji:"⌨️", badge:"تقني", desc:"RGB قابل للبرمجة - متوافق مع جميع الأجهزة"},
  {id:9, name:"سماعة لاسلكية",    cat:"تقنية",  price:159, shn:37800, rating:4.7, reviews:445, emoji:"🎧", badge:"عرض", desc:"ANC نشط - بطارية 40 ساعة - صوت Hi-Fi"},
  {id:10,name:"خلية هيدروجين",    cat:"طاقة",   price:799, shn:190000,rating:4.9, reviews:34,  emoji:"⚡", badge:"متقدم", desc:"5kW PEMFC للمشاريع الصناعية الصغيرة"},
  {id:11,name:"خاتم فيروز",       cat:"مجوهرات", price:75,  shn:17800, rating:4.6, reviews:188, emoji:"💎", badge:"جديد", desc:"فيروز إيراني أصيل في إطار فضة 925"},
  {id:12,name:"شاشة 4K Ultra",    cat:"تقنية",  price:649, shn:154000,rating:4.8, reviews:267, emoji:"🖥️", badge:"تقني", desc:"27 بوصة IPS 144Hz HDR10+ USB-C"},
];

const PROPOSALS = [
  {id:1, title:"رفع معدل حرق SHN إلى 1.5%",         status:"نشط",   for:67, against:28, quorum:82, ends:"2 أيام", cat:"tokenomics"},
  {id:2, title:"إضافة زوج sSHN/ETH في Uniswap v4",   status:"نشط",   for:89, against:8,  quorum:71, ends:"4 أيام", cat:"DeFi"},
  {id:3, title:"تخصيص 2M SHN لصندوق الطاقة الشمسية", status:"ناجح",  for:94, against:3,  quorum:96, ends:"منتهي", cat:"طاقة"},
  {id:4, title:"تأسيس مجلس الحوكمة الإقليمي",         status:"مهزوم", for:38, against:62, quorum:88, ends:"منتهي", cat:"حوكمة"},
  {id:5, title:"اندماج مع بروتوكول Aave للإقراض",     status:"قيد",   for:71, against:22, quorum:60, ends:"6 أيام", cat:"DeFi"},
];

const TREE_DATA = {
  name:"أنت", code:"SHN-001", earn:4200, level:0,
  children:[
    {name:"أحمد ع.", code:"SHN-002", earn:1800, level:1, children:[
      {name:"سارة م.", code:"SHN-005", earn:420, level:2, children:[]},
      {name:"خالد ر.", code:"SHN-006", earn:380, level:2, children:[]},
    ]},
    {name:"فاطمة ح.", code:"SHN-003", earn:950, level:1, children:[
      {name:"يوسف ب.", code:"SHN-007", earn:210, level:2, children:[]},
    ]},
    {name:"محمد ط.", code:"SHN-004", earn:630, level:1, children:[]},
  ],
};

const CATS = ["الكل","مجوهرات","رقمي","طاقة","تقنية"];

// ── UTILS ─────────────────────────────────────────────────────────────────────
function genHistory(base, vol, n=40) {
  const arr=[]; let p=base;
  for(let i=0;i<n;i++){
    p=p*(1+(Math.random()-.49)*vol);
    arr.push({t:i, v:parseFloat(p.toFixed(6))});
  }
  return arr;
}

// FIX B006: proper HTTP + error field checking
async function callAngel(soul, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:1000,
      system: soul + "\n\nأنت ملاك في إمبراطورية شاهين بقيادة القائد الأعلى. كن موجزاً ومحترفاً.",
      messages
    }),
  });
  if(!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
  const d=await r.json();
  if(d.error) throw new Error(d.error.message||"API Error");
  return d.content?.[0]?.text||"";
}

// ── GLOBAL CSS INJECTION ──────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-track{background:${T.void}}
  ::-webkit-scrollbar-thumb{background:${T.gold}55;border-radius:3px}
  @keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  @keyframes glow{0%,100%{box-shadow:0 0 12px ${T.gold}33}50%{box-shadow:0 0 30px ${T.gold}77}}
  @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  button:hover{opacity:.88;transform:translateY(-1px)}
  button:active{transform:scale(.97)}
  input:focus,select:focus,textarea:focus{border-color:${T.gold}!important}
  .page-enter{animation:slideUp .3s ease}
  .card-hover:hover{border-color:${T.gold}55!important;transform:translateY(-2px)}
`;

// ═══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// FIX B004: proper cleanup with live ref
function TypeWriter({text, speed=7}){
  const [shown,setShown]=useState("");
  useEffect(()=>{
    const live={v:true}; setShown(""); let i=0;
    const id=setInterval(()=>{
      if(!live.v){clearInterval(id);return;}
      if(i<text.length) setShown(text.slice(0,++i)); else clearInterval(id);
    },speed);
    return()=>{live.v=false;clearInterval(id);};
  },[text,speed]);
  return <span>{shown}{shown.length<text.length&&<span style={{opacity:.6}}>▌</span>}</span>;
}

function DonutChart({data, size=140}){
  const r=50, cx=70, cy=70, circ=2*Math.PI*r;
  let cum=0;
  const segs=data.map(d=>{const s=cum; cum+=d.pct; return{...d,s,len:(d.pct/100)*circ};});
  return(
    <svg width={size} height={size} viewBox="0 0 140 140">
      {segs.map((seg,i)=>(
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.col} strokeWidth={20}
          strokeDasharray={`${seg.len} ${circ-seg.len}`}
          strokeDashoffset={-((seg.s/100)*circ - circ/4)}/>
      ))}
      <text x={cx} y={cy-7} textAnchor="middle" fill={T.gold} fontSize="13" fontWeight="bold" fontFamily="monospace">SHN</text>
      <text x={cx} y={cy+9} textAnchor="middle" fill={T.muted} fontSize="9" fontFamily="monospace">1B MAX</text>
    </svg>
  );
}

// FIX B004+B005: StarField with proper cleanup + resize
function StarField(){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current; if(!c) return;
    const ctx=c.getContext("2d");
    let raf, stars=[];
    const make=(w,h)=>Array.from({length:60},()=>({
      x:Math.random()*w, y:Math.random()*h,
      r:Math.random()*1.4+.3,
      dx:(Math.random()-.5)*.12, dy:(Math.random()-.5)*.12,
      o:Math.random()*.5+.1,
      col:[T.gold,T.cyan,T.blue,"#ffffff"][Math.floor(Math.random()*4)],
    }));
    const resize=()=>{ c.width=c.offsetWidth; c.height=c.offsetHeight; stars=make(c.width,c.height); };
    resize(); window.addEventListener("resize",resize);
    const draw=()=>{
      ctx.clearRect(0,0,c.width,c.height);
      stars.forEach(s=>{
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
        ctx.fillStyle=s.col+Math.round(s.o*255).toString(16).padStart(2,"0");
        ctx.fill(); s.x+=s.dx; s.y+=s.dy;
        if(s.x<0||s.x>c.width) s.dx*=-1;
        if(s.y<0||s.y>c.height) s.dy*=-1;
      });
      raf=requestAnimationFrame(draw);
    };
    draw();
    return()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  },[]);
  return <canvas ref={ref} style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",opacity:.35,width:"100%",height:"100%"}}/>;
}

function TreeNode({node}){
  const [open,setOpen]=useState(true);
  const cols=[T.gold,T.cyan,T.green,T.purple];
  const col=cols[node.level%cols.length];
  return(
    <div style={{marginRight:node.level>0?18:0,marginTop:8}}>
      <div onClick={()=>node.children.length&&setOpen(!open)} style={{
        display:"flex",alignItems:"center",gap:10,
        background:`linear-gradient(135deg,${col}10,transparent)`,
        border:`1px solid ${col}33`,borderRadius:12,padding:"10px 14px",
        cursor:"pointer",transition:"all .25s"
      }}
        onMouseEnter={e=>e.currentTarget.style.borderColor=col}
        onMouseLeave={e=>e.currentTarget.style.borderColor=col+"33"}>
        <div style={{width:8,height:8,borderRadius:"50%",background:col,flexShrink:0}}/>
        <div style={{flex:1,textAlign:"right"}}>
          <div style={{color:T.txt,fontWeight:700,fontSize:13}}>{node.name}</div>
          <div style={{color:T.muted,fontSize:10}}>{node.code}</div>
        </div>
        <div style={{color:col,fontWeight:800,fontSize:13}}>${node.earn.toLocaleString()}</div>
        {node.children.length>0&&<span style={{color:col,fontSize:11}}>{open?"▼":"◀"}</span>}
      </div>
      {open&&node.children.map((ch,i)=><TreeNode key={ch.code||i} node={ch}/>)}
    </div>
  );
}

// ── ANGEL CHAT MODAL ──────────────────────────────────────────────────────────
function AngelModal({angel, onClose}){
  const [msgs,setMsgs]=useState([{r:"a",t:`أنا ${angel.name} — ${angel.role}. في خدمتك يا قائد.`}]);
  const [inp,setInp]=useState("");
  const [busy,setBusy]=useState(false);
  const endRef=useRef(null);
  useEffect(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),[msgs]);

  const send=async()=>{
    const m=inp.trim(); if(!m||busy) return;
    setMsgs(p=>[...p,{r:"u",t:m}]); setInp(""); setBusy(true);
    try{
      const hist=msgs.slice(-8).map(x=>({role:x.r==="u"?"user":"assistant",content:x.t}));
      hist.push({role:"user",content:m});
      const reply=await callAngel(angel.soul,hist);
      setMsgs(p=>[...p,{r:"a",t:reply}]);
    }catch(e){ setMsgs(p=>[...p,{r:"a",t:"⚠️ "+e.message}]); }
    setBusy(false);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(2,4,8,.95)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:540,maxHeight:"85vh",background:`linear-gradient(160deg,${T.card},${T.void})`,border:`1.5px solid ${angel.col}55`,borderRadius:20,display:"flex",flexDirection:"column",boxShadow:`0 0 60px ${angel.col}22`}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${angel.col}22`,background:`${angel.col}08`,display:"flex",alignItems:"center",gap:12,direction:"rtl"}}>
          <div style={{width:44,height:44,borderRadius:12,background:`${angel.col}20`,border:`1.5px solid ${angel.col}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{angel.icon}</div>
          <div style={{flex:1}}>
            <div style={{color:angel.col,fontWeight:800,fontSize:15}}>{angel.name} — {angel.en}</div>
            <div style={{color:T.muted,fontSize:11}}>{angel.role}</div>
          </div>
          <button onClick={onClose} style={{...s.chip(false),padding:"6px 12px",fontSize:18}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10,direction:"rtl"}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:8,flexDirection:m.r==="u"?"row":"row-reverse",alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:8,flexShrink:0,background:m.r==="u"?`${T.gold}22`:`${angel.col}22`,border:`1px solid ${m.r==="u"?T.gold:angel.col}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{m.r==="u"?"👑":angel.icon}</div>
              <div style={{maxWidth:"80%",padding:"9px 12px",borderRadius:12,background:m.r==="u"?`${T.gold}0e`:`${angel.col}0e`,border:`1px solid ${m.r==="u"?T.gold:angel.col}22`,color:T.txt,fontSize:12.5,lineHeight:1.9,textAlign:"right",whiteSpace:"pre-wrap"}}>
                {i===msgs.length-1&&m.r==="a"?<TypeWriter text={m.t}/>:m.t}
              </div>
            </div>
          ))}
          {busy&&<div style={{color:angel.col,fontSize:12,textAlign:"center",animation:"pulse 1s infinite"}}>◉ {angel.name} يُحلّل...</div>}
          <div ref={endRef}/>
        </div>
        <div style={{padding:12,borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
          <input style={{...s.input,flex:1}} value={inp} onChange={e=>setInp(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!busy&&inp.trim()&&send()}
            placeholder={`أَمر ${angel.name}...`}/>
          <button onClick={send} disabled={busy||!inp.trim()} style={s.btn(angel.col,busy||!inp.trim())}>{busy?"◉":"أَمر"}</button>
        </div>
      </div>
    </div>
  );
}

// ── BROADCAST MODAL ───────────────────────────────────────────────────────────
function BroadcastModal({onClose}){
  const [cmd,setCmd]=useState("");
  const [results,setResults]=useState([]);
  const [cur,setCur]=useState(-1);
  const [done,setDone]=useState(false);
  const busy=cur>=0&&!done;

  const launch=async()=>{
    if(!cmd.trim()||busy) return;
    setResults([]); setDone(false);
    for(let i=0;i<ANGELS.length;i++){
      setCur(i);
      try{
        const reply=await callAngel(ANGELS[i].soul,[{role:"user",content:`أمر إمبراطوري: ${cmd}\n\nردّ من منظور تخصصك في 60 كلمة فقط.`}]);
        setResults(p=>[...p,{a:ANGELS[i],t:reply,ok:true}]);
      }catch(e){
        setResults(p=>[...p,{a:ANGELS[i],t:"⚠️ "+e.message,ok:false}]);
      }
    }
    setCur(-1); setDone(true);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(2,4,8,.97)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:620,maxHeight:"90vh",background:`linear-gradient(160deg,${T.card},${T.void})`,border:`2px solid ${T.gold}44`,borderRadius:20,display:"flex",flexDirection:"column",boxShadow:`0 0 80px ${T.gold}18`}}>
        <div style={{padding:"15px 20px",borderBottom:`1px solid ${T.gold}22`,background:`${T.gold}08`,display:"flex",alignItems:"center",gap:12,direction:"rtl"}}>
          <span style={{fontSize:26}}>📣</span>
          <div style={{flex:1}}><div style={{color:T.goldLt,fontWeight:900,fontSize:16}}>البث الإمبراطوري</div><div style={{color:T.muted,fontSize:11}}>أمرك يصل للتسعة ملائكة معاً</div></div>
          <button onClick={onClose} style={s.chip(false)}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:16,direction:"rtl"}}>
          <textarea value={cmd} onChange={e=>setCmd(e.target.value)}
            placeholder="اكتب أمرك الإمبراطوري..." rows={3}
            style={{...s.input,resize:"vertical",lineHeight:1.8,marginBottom:12}}/>
          <button style={{...s.btn(T.gold,busy||!cmd.trim()),width:"100%",marginBottom:16}} onClick={launch} disabled={busy||!cmd.trim()}>
            {busy?`⚙️ ${ANGELS[cur]?.name} يُجيب...`:done?"✅ بث جديد":"📣 أطلق البث الإمبراطوري"}
          </button>
          {busy&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
            {ANGELS.map((a,i)=><span key={a.id} style={{...s.chip(results.find(r=>r.a.id===a.id),a.col),fontSize:10}}>
              {results.find(r=>r.a.id===a.id)?"✓":i===cur?"⚙":"○"} {a.name}
            </span>)}
          </div>}
          {results.map((res,i)=>(
            <div key={i} style={{...s.card(),border:`1px solid ${res.a.col}33`,background:`${res.a.col}07`}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}><span style={{fontSize:16}}>{res.a.icon}</span><span style={{color:res.a.col,fontWeight:800,fontSize:13}}>{res.a.name}</span></div>
              <div style={{color:T.txt,fontSize:12,lineHeight:1.85,textAlign:"right",whiteSpace:"pre-wrap"}}>
                {i===results.length-1?<TypeWriter text={res.t} speed={4}/>:res.t}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PRODUCT MODAL ─────────────────────────────────────────────────────────────
function ProductModal({product, onClose, onAdd}){
  const [qty,setQty]=useState(1);
  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(2,4,8,.93)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:440,background:`linear-gradient(160deg,${T.card},${T.void})`,border:`1px solid ${T.border2}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{background:`${T.gold}0a`,padding:30,textAlign:"center",fontSize:72,position:"relative"}}>
          {product.emoji}
          {product.badge&&<span style={{position:"absolute",top:12,right:12,background:T.gold,color:"#000",fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:20}}>{product.badge}</span>}
        </div>
        <div style={{padding:20,direction:"rtl"}}>
          <div style={{fontWeight:900,fontSize:18,color:T.txt,marginBottom:4}}>{product.name}</div>
          <div style={{color:T.muted,fontSize:13,marginBottom:14}}>{product.desc}</div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
            <div><div style={{color:T.gold,fontWeight:900,fontSize:24}}>${product.price}</div><div style={{color:T.muted,fontSize:11}}>{product.shn.toLocaleString()} SHN</div></div>
            <div style={{textAlign:"center"}}><div style={{color:T.amber,fontSize:14}}>{"★".repeat(Math.floor(product.rating))} {product.rating}</div><div style={{color:T.muted,fontSize:11}}>{product.reviews} تقييم</div></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{...s.btn(T.border),background:T.surface,color:T.txt,padding:"8px 16px",width:40}}>-</button>
            <span style={{flex:1,textAlign:"center",fontWeight:800,fontSize:18}}>{qty}</span>
            <button onClick={()=>setQty(q=>q+1)} style={{...s.btn(T.gold),padding:"8px 16px",width:40}}>+</button>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{...s.btn(T.muted,false),flex:1,background:T.surface,color:T.txt2}}>إلغاء</button>
            <button onClick={()=>{onAdd(product,qty);onClose();}} style={{...s.btn(T.gold),flex:2}}>🛒 أضف للسلة</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGES
// ═══════════════════════════════════════════════════════════════════════════════

function HomePage({setPage, shnPrice, shnChange, shnHistory}){
  const stats=[
    {icon:"💹",label:"سعر SHN",val:`$${shnPrice.toFixed(6)}`,sub:`${shnChange>=0?"+":""}${shnChange.toFixed(2)}%`,col:shnChange>=0?T.green:T.red},
    {icon:"🔥",label:"محروق إجمالي",val:"12.4M",sub:"SHN",col:T.orange},
    {icon:"🌳",label:"شجرة العملاء",val:"6,841",sub:"+24% هذا الشهر",col:T.cyan},
    {icon:"⚡",label:"طاقة مولّدة",val:"15,400",sub:"ميغاواط",col:T.green},
  ];
  return(
    <div style={{animation:"slideUp .3s ease"}}>
      {/* Hero */}
      <div style={{textAlign:"center",padding:"30px 0 20px",position:"relative"}}>
        <div style={{fontSize:64,filter:`drop-shadow(0 0 24px ${T.gold})`,marginBottom:10,animation:"bounce 3s ease-in-out infinite"}}>🦅</div>
        <h1 style={{fontSize:28,fontWeight:900,background:`linear-gradient(135deg,${T.gold},${T.goldLt},${T.cyan},${T.gold})`,backgroundSize:"200%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 4s linear infinite",letterSpacing:2,marginBottom:6}}>شاهين</h1>
        <p style={{color:T.txt2,fontSize:12,letterSpacing:2,marginBottom:16}}>SHAHEEN SOVEREIGN ECOSYSTEM</p>
        <div style={{display:"inline-flex",gap:16,background:`${T.green}0f`,border:`1px solid ${T.green}33`,borderRadius:50,padding:"6px 18px",fontSize:12}}>
          <span style={{color:T.green,animation:"pulse 2s infinite"}}>● نشط</span>
          <span style={{color:T.muted}}>9 ملائكة</span>
          <span style={{color:T.muted}}>7 أنظمة</span>
          <span style={{color:T.gold,fontWeight:700}}>v1.0 ✓</span>
        </div>
      </div>

      {/* Price Hero */}
      <div style={{...s.card(),border:`1.5px solid ${T.gold}44`,background:`linear-gradient(135deg,${T.gold}10,${T.card})`,animation:"glow 4s infinite"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <div style={{color:T.muted,fontSize:11,marginBottom:4}}>سعر SHN / USD</div>
            <div style={{color:T.goldLt,fontWeight:900,fontSize:32}}>${shnPrice.toFixed(6)}</div>
            <div style={{color:shnChange>=0?T.green:T.red,fontSize:13,fontWeight:700}}>{shnChange>=0?"▲":"▼"} {Math.abs(shnChange).toFixed(2)}%</div>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{color:T.muted,fontSize:10}}>القيمة السوقية</div>
            <div style={{color:T.gold,fontWeight:800,fontSize:16}}>${(shnPrice*1e9).toLocaleString("en",{maximumFractionDigits:0})}</div>
            <div style={{color:T.muted,fontSize:10}}>1B SHN</div>
          </div>
        </div>
        {shnHistory.length>1&&(
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={shnHistory}>
              <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.gold} stopOpacity={.4}/><stop offset="95%" stopColor={T.gold} stopOpacity={0}/></linearGradient></defs>
              <Area type="monotone" dataKey="v" stroke={T.gold} strokeWidth={2} fill="url(#sg)" dot={false}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.gold}44`,color:T.gold,fontSize:10,borderRadius:6}} formatter={v=>[`$${v.toFixed(6)}`]}/>
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {stats.map((st,i)=>(
          <div key={i} style={{...s.statBox(st.col)}}>
            <div style={{fontSize:22,marginBottom:4}}>{st.icon}</div>
            <div style={{color:st.col,fontWeight:900,fontSize:16}}>{st.val}</div>
            <div style={{color:T.muted,fontSize:10,marginTop:2}}>{st.label}</div>
            <div style={{color:st.col,fontSize:10}}>{st.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={s.card()}>
        <div style={s.title(T.cyan)}>⚡ الإجراءات السريعة</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[
            {l:"تحليل السوق",icon:"💹",p:"market",c:T.green},
            {l:"متجر شاهين",icon:"🛍️",p:"store",c:T.amber},
            {l:"الملائكة التسعة",icon:"🤖",p:"agents",c:T.purple},
            {l:"محفظتي",icon:"💎",p:"wallet",c:T.cyan},
          ].map((a,i)=>(
            <button key={i} onClick={()=>setPage(a.p)} style={{padding:14,borderRadius:12,cursor:"pointer",fontFamily:T.font,background:`${a.c}0e`,border:`1.5px solid ${a.c}44`,color:a.c,fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
              <span style={{fontSize:18}}>{a.icon}</span>{a.l}
            </button>
          ))}
        </div>
      </div>

      {/* News ticker */}
      <div style={{...s.card(),overflow:"hidden",padding:"10px 16px"}}>
        <div style={{color:T.muted,fontSize:10,marginBottom:6}}>📡 آخر الأخبار</div>
        <div style={{overflow:"hidden"}}>
          <div style={{display:"flex",gap:40,animation:"ticker 20s linear infinite",whiteSpace:"nowrap"}}>
            {["SHN +2.3% ▲","مشروع الطاقة الشمسية — إطلاق المرحلة B","حوكمة DAO: اقتراح رقم 5 نشط","شراكة جديدة مع PancakeSwap"].concat(["SHN +2.3% ▲","مشروع الطاقة الشمسية — إطلاق المرحلة B","حوكمة DAO: اقتراح رقم 5 نشط","شراكة جديدة مع PancakeSwap"]).map((n,i)=>(
              <span key={i} style={{color:T.txt2,fontSize:12}}>• {n}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketPage({shnPrice, shnChange, shnHistory, btcP, ethP, btcH, ethH}){
  return(
    <div style={{animation:"slideUp .3s ease"}}>
      <div style={s.card({border:`1.5px solid ${T.gold}44`})}>
        <div style={s.title(T.gold)}>💹 شاهين / USD — مباشر</div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <div><div style={{color:T.goldLt,fontWeight:900,fontSize:28}}>${shnPrice.toFixed(6)}</div><div style={{color:shnChange>=0?T.green:T.red,fontWeight:700}}>{shnChange>=0?"▲":"▼"} {Math.abs(shnChange).toFixed(2)}%</div></div>
          <div style={{textAlign:"left",fontSize:12,color:T.muted}}><div>أعلى 24h: ${(shnPrice*1.032).toFixed(6)}</div><div>أدنى 24h: ${(shnPrice*.971).toFixed(6)}</div><div>الحجم: $847K</div></div>
        </div>
        {shnHistory.length>1&&(
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={shnHistory}>
              <defs><linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.gold} stopOpacity={.35}/><stop offset="95%" stopColor={T.gold} stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="t" hide/><YAxis hide domain={["auto","auto"]}/>
              <Area type="monotone" dataKey="v" stroke={T.gold} strokeWidth={2.5} fill="url(#sg2)" dot={false}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.gold}44`,color:T.gold,fontSize:11,borderRadius:8}} formatter={v=>[`$${v.toFixed(6)}`,"SHN"]}/>
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Correlation */}
      <div style={s.card()}>
        <div style={s.title(T.cyan)}>📊 الارتباط بالسوق الكريبتو</div>
        {[{name:"BTC",pct:87,p:btcP,col:"#f7931a"},{name:"ETH",pct:74,p:ethP,col:"#627eea"},{name:"DeFi Index",pct:61,p:null,col:T.purple}].map((c,i)=>(
          <div key={i} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:12}}><span style={{color:T.txt}}>{c.name}{c.p&&<span style={{color:c.col,marginRight:8,fontWeight:700}}>${c.p.toLocaleString("en",{maximumFractionDigits:0})}</span>}</span><span style={{color:c.col,fontWeight:700}}>{c.pct}%</span></div>
            <div style={{height:5,background:T.surface,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${c.pct}%`,background:`linear-gradient(90deg,${c.col},${c.col}88)`,borderRadius:3,transition:"width 1s"}}/></div>
          </div>
        ))}
      </div>

      {/* BTC + ETH mini */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[{name:"Bitcoin",sym:"BTC",p:btcP,h:btcH,col:"#f7931a"},{name:"Ethereum",sym:"ETH",p:ethP,h:ethH,col:"#627eea"}].map((coin,i)=>(
          <div key={i} style={{...s.card({marginBottom:0}),border:`1px solid ${coin.col}33`}}>
            <div style={{fontWeight:700,color:coin.col,fontSize:13,marginBottom:2}}>{coin.name}</div>
            <div style={{color:T.txt,fontWeight:800,fontSize:16,marginBottom:6}}>${coin.p.toLocaleString("en",{maximumFractionDigits:0})}</div>
            {coin.h.length>1&&(
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={coin.h}><Line type="monotone" dataKey="v" stroke={coin.col} strokeWidth={2} dot={false}/></LineChart>
              </ResponsiveContainer>
            )}
          </div>
        ))}
      </div>

      {/* Tokenomics */}
      <div style={s.card()}>
        <div style={s.title(T.purple)}>🥧 توزيع العملة (Tokenomics)</div>
        <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <DonutChart data={TOKEN_ALLOC} size={140}/>
          <div style={{flex:1,minWidth:150}}>
            {TOKEN_ALLOC.map((a,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:8,height:8,borderRadius:2,background:a.col}}/><span style={{color:T.txt}}>{a.label}</span></div>
                <span style={{color:a.col,fontWeight:700}}>{a.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contract info */}
      <div style={s.card()}>
        <div style={s.title(T.green)}>🔗 العقد الذكي — BNB Chain</div>
        {[
          ["المعيار","BEP-20 (ERC-20)"],
          ["الحد الأقصى","1,000,000,000 SHN"],
          ["معدل الحرق","1% لكل تحويل"],
          ["رسوم الخزينة","0.5% لكل تحويل"],
          ["استحقاق الفريق","730 يوم خطي"],
          ["نسبة الحصة","PROPOSAL_THRESHOLD: 100K SHN"],
        ].map(([k,v],i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}>
            <span style={{color:T.muted}}>{k}</span>
            <span style={{color:T.green,fontFamily:T.mono,fontWeight:600}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SovereignPage(){
  const [active,setActive]=useState(LAYERS[6]);
  const [logIdx,setLogIdx]=useState(0);
  const [logs,setLogs]=useState([]);
  const logRef=useRef(null);
  const LOG=[
    {t:"00:00:01",msg:"SHAHEEN_CORE: Sovereign Omni-Core Initialized.",col:T.green},
    {t:"00:00:02",msg:"IdentityMatrix: OMEGA_LEVEL_9 clearance verified.",col:T.gold},
    {t:"00:00:03",msg:"FinancialEngine: SGX online. 3 pairs active.",col:T.green},
    {t:"00:00:04",msg:"DefenseGrid: Black Hole V2 armed. Quantum Shield: ACTIVE.",col:T.red},
    {t:"00:00:05",msg:"PhysicalWorld: 15,400 MW. Hyper-Loop S: READY.",col:T.cyan},
    {t:"00:00:06",msg:"AssetControl: Tesla 15.4% | NVIDIA 22% | Alphabet 12.8%.",col:T.orange},
    {t:"00:00:07",msg:"Judiciary: Gamma 6.0 loaded. 0 pending verdicts.",col:T.purple},
    {t:"00:00:08",msg:"OmniControl: All 7 layers SYNCHRONIZED. EMPIRE LIVE.",col:T.gold},
  ];
  useEffect(()=>{
    if(logIdx>=LOG.length) return;
    const t=setTimeout(()=>{setLogs(p=>[...p,LOG[logIdx]]);setLogIdx(i=>i+1);},600);
    return()=>clearTimeout(t);
  },[logIdx]);
  useEffect(()=>{if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight;},[logs]);

  return(
    <div style={{animation:"slideUp .3s ease"}}>
      <div style={{...s.card(),border:`2px solid ${T.gold}44`,background:`linear-gradient(135deg,${T.gold}0a,${T.card})`,textAlign:"center",animation:"glow 4s infinite"}}>
        <div style={{fontSize:40,marginBottom:8}}>🦅</div>
        <div style={{color:T.goldLt,fontWeight:900,fontSize:18}}>المنظومة السيادية</div>
        <div style={{color:T.muted,fontSize:12,marginBottom:12}}>SHAHEEN SOVEREIGN SYSTEM — 7 طبقات متزامنة</div>
        <div style={{display:"flex",justifyContent:"center",gap:24}}>
          {[["7/7","طبقة نشطة",T.green],["0","تهديدات",T.red],["1B","SHN المحدودة",T.gold]].map(([v,l,c],i)=>(
            <div key={i}><div style={{color:c,fontWeight:900,fontSize:22}}>{v}</div><div style={{color:T.muted,fontSize:10}}>{l}</div></div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
        {LAYERS.map(l=>(
          <div key={l.id} onClick={()=>setActive(l)} style={{
            display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
            background:active.id===l.id?`${l.col}12`:T.card,
            border:`1.5px solid ${active.id===l.id?l.col:T.border}`,
            borderRadius:T.r12,cursor:"pointer",transition:"all .25s",
          }}>
            <div style={{width:36,height:36,borderRadius:10,background:`${l.col}20`,border:`1px solid ${l.col}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{l.icon}</div>
            <div style={{flex:1,textAlign:"right"}}>
              <div style={{color:active.id===l.id?l.col:T.txt,fontWeight:700,fontSize:13}}>{l.labelAr}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
                {Object.entries(l.metrics).map(([k,v])=>(
                  <span key={k} style={{fontSize:9,padding:"2px 7px",borderRadius:4,background:`${l.col}18`,color:l.col,fontFamily:T.mono}}>{v}</span>
                ))}
              </div>
            </div>
            <div style={{width:8,height:8,borderRadius:"50%",background:T.green,animation:"pulse 2s infinite",flexShrink:0}}/>
          </div>
        ))}
      </div>

      {/* Layer detail */}
      <div style={{...s.card(),border:`1.5px solid ${active.col}44`}}>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:26,color:active.col}}>{active.icon}</span>
          <div><div style={{color:active.col,fontWeight:800,fontSize:15}}>{active.label}</div><div style={{color:T.muted,fontSize:11}}>{active.labelAr}</div></div>
        </div>
        <div style={{color:T.txt2,fontSize:13,lineHeight:1.9,marginBottom:12}}>{active.desc}</div>
        <div style={{padding:"8px 12px",background:`${T.green}0f`,border:`1px solid ${T.green}22`,borderRadius:8,fontSize:11,color:T.green}}>✅ الطبقة نشطة — لا تهديدات محددة</div>
      </div>

      {/* Console */}
      <div style={s.card()}>
        <div style={s.title(T.muted)}>▶ CONSOLE — سجل الإقلاع</div>
        <div ref={logRef} style={{background:T.void,borderRadius:10,padding:12,height:160,overflowY:"auto",fontFamily:T.mono,fontSize:10}}>
          {logs.map((l,i)=><div key={i} style={{color:l.col,marginBottom:3}}><span style={{color:T.muted}}>[{l.t}] </span>{l.msg}</div>)}
          {logIdx<LOG.length&&<span style={{color:T.gold,animation:"pulse .5s infinite"}}>█</span>}
        </div>
      </div>
    </div>
  );
}

function AgentsPage({openChat, setOpenChat, showBroadcast, setShowBroadcast}){
  return(
    <div style={{animation:"slideUp .3s ease"}}>
      <div style={{...s.card(),textAlign:"center",padding:20}}>
        <div style={{fontSize:30,marginBottom:8}}>🤖</div>
        <div style={{color:T.goldLt,fontWeight:900,fontSize:16,marginBottom:4}}>التسعة ملائكة</div>
        <div style={{color:T.muted,fontSize:12,marginBottom:14}}>عملاء ذكاء اصطناعي متخصصون — كل بروح وتخصص مختلف</div>
        <button style={{...s.btn(T.gold),padding:"12px 28px"}} onClick={()=>setShowBroadcast(true)}>📣 بث إمبراطوري للجميع</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {ANGELS.map(a=>(
          <div key={a.id} className="card-hover" style={{...s.card({marginBottom:0,border:`1px solid ${a.col}22`,background:`${a.col}06`}),cursor:"pointer"}} onClick={()=>setOpenChat(a.id)}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:50,height:50,borderRadius:14,background:`${a.col}20`,border:`1.5px solid ${a.col}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{a.icon}</div>
              <div style={{flex:1,textAlign:"right"}}>
                <div style={{color:a.col,fontWeight:800,fontSize:15}}>{a.name} — {a.en}</div>
                <div style={{color:T.txt2,fontSize:12,marginTop:2}}>{a.role}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:T.green,animation:"pulse 2s infinite"}}/>
                <span style={{fontSize:11,color:T.muted}}>›</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StorePage({cart, setCart}){
  const [cat,setCat]=useState("الكل");
  const [search,setSearch]=useState("");
  const [product,setProduct]=useState(null);
  const filtered=PRODUCTS.filter(p=>(cat==="الكل"||p.cat===cat)&&p.name.includes(search));

  const addToCart=(prod,qty=1)=>{
    setCart(c=>{
      const ex=c.find(x=>x.id===prod.id);
      if(ex) return c.map(x=>x.id===prod.id?{...x,qty:x.qty+qty}:x);
      return [...c,{...prod,qty}];
    });
  };

  const totalItems=cart.reduce((a,b)=>a+b.qty,0);

  return(
    <div style={{animation:"slideUp .3s ease"}}>
      {/* Search */}
      <div style={{position:"relative",marginBottom:12}}>
        <input style={{...s.input,paddingRight:42}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 ابحث في المتجر..."/>
      </div>

      {/* Cart summary */}
      {totalItems>0&&(
        <div style={{...s.card({padding:"10px 14px"}),border:`1px solid ${T.gold}44`,background:`${T.gold}0a`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:T.txt2,fontSize:13}}>{totalItems} منتج في السلة</span>
          <span style={{color:T.gold,fontWeight:800,fontSize:14}}>${cart.reduce((a,b)=>a+b.price*b.qty,0).toFixed(2)}</span>
        </div>
      )}

      {/* Categories */}
      <div style={{overflowX:"auto",marginBottom:12,display:"flex",gap:8,padding:"2px 0"}}>
        {CATS.map(c=><button key={c} style={s.chip(cat===c)} onClick={()=>setCat(c)}>{c}</button>)}
      </div>

      {/* Products grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {filtered.map(p=>(
          <div key={p.id} className="card-hover" style={{...s.card({marginBottom:0,padding:12}),cursor:"pointer",position:"relative"}} onClick={()=>setProduct(p)}>
            {p.badge&&<span style={{position:"absolute",top:8,right:8,background:T.gold,color:"#000",fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:20}}>{p.badge}</span>}
            <div style={{textAlign:"center",fontSize:44,marginBottom:8,padding:"8px 0",background:`${T.gold}06`,borderRadius:8}}>{p.emoji}</div>
            <div style={{fontWeight:700,fontSize:13,color:T.txt,marginBottom:2,textAlign:"right"}}>{p.name}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
              <div><div style={{color:T.gold,fontWeight:900,fontSize:15}}>${p.price}</div><div style={{color:T.muted,fontSize:9}}>{p.shn.toLocaleString()} SHN</div></div>
              <div style={{textAlign:"center"}}><div style={{color:T.amber,fontSize:11}}>★ {p.rating}</div><div style={{color:T.muted,fontSize:9}}>{p.reviews}</div></div>
            </div>
            <button style={{...s.btn(T.gold),width:"100%",marginTop:10,padding:"8px",fontSize:12}} onClick={e=>{e.stopPropagation();addToCart(p);}}>+ سلة</button>
          </div>
        ))}
      </div>

      {/* Cart details */}
      {cart.length>0&&(
        <div style={s.card()}>
          <div style={s.title(T.amber)}>🛒 سلة المشتريات</div>
          {cart.map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:22}}>{item.emoji}</span>
              <div style={{flex:1,textAlign:"right"}}><div style={{fontSize:13,fontWeight:700}}>{item.name}</div><div style={{color:T.muted,fontSize:11}}>×{item.qty}</div></div>
              <div style={{color:T.gold,fontWeight:800}}>${(item.price*item.qty).toFixed(0)}</div>
              <button onClick={()=>setCart(c=>c.filter(x=>x.id!==item.id))} style={{color:T.red,background:"none",border:"none",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",fontWeight:800,fontSize:15}}>
            <span style={{color:T.muted}}>الإجمالي</span>
            <span style={{color:T.gold}}>${cart.reduce((a,b)=>a+b.price*b.qty,0).toFixed(2)}</span>
          </div>
          <button style={{...s.btn(T.gold),width:"100%"}}>💳 إتمام الشراء بـ SHN</button>
        </div>
      )}

      {product&&<ProductModal product={product} onClose={()=>setProduct(null)} onAdd={addToCart}/>}
    </div>
  );
}

function DaoPage(){
  const [votes,setVotes]=useState({});
  const [staked,setStaked]=useState(10000);

  const vote=(id,side)=>{
    if(votes[id]) return;
    setVotes(v=>({...v,[id]:side}));
  };

  const statusCol={نشط:T.green,ناجح:T.cyan,مهزوم:T.red,قيد:T.amber};

  return(
    <div style={{animation:"slideUp .3s ease"}}>
      <div style={s.card()}>
        <div style={s.title(T.purple)}>🗳️ حوكمة شاهين DAO</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[{l:"SHN مُقفَّلة",v:`${staked.toLocaleString()}`,c:T.gold},{l:"قوة التصويت",v:`${staked.toLocaleString()}`,c:T.cyan},{l:"مقترحاتي",v:"0",c:T.purple}].map((s2,i)=>(
            <div key={i} style={s.statBox(s2.c)}><div style={{color:s2.c,fontWeight:900,fontSize:16}}>{s2.v}</div><div style={{color:T.muted,fontSize:10}}>{s2.l}</div></div>
          ))}
        </div>
        <div style={{marginTop:12,display:"flex",gap:10}}>
          <button style={{...s.btn(T.purple),flex:1,fontSize:12}} onClick={()=>setStaked(s=>s+1000)}>+ قفل 1,000 SHN</button>
          <button style={{...s.btn(T.muted,false),flex:1,background:T.surface,color:T.txt2,fontSize:12}} onClick={()=>setStaked(s=>Math.max(0,s-1000))}>- فتح 1,000</button>
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {PROPOSALS.map(p=>(
          <div key={p.id} style={{...s.card({border:`1px solid ${(statusCol[p.status]||T.border)}33`})}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{flex:1,textAlign:"right"}}>
                <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:`${statusCol[p.status]||T.border}18`,color:statusCol[p.status]||T.muted,marginBottom:6,display:"inline-block"}}>{p.status}</span>
                <div style={{color:T.txt,fontWeight:700,fontSize:13,marginTop:4}}>{p.title}</div>
              </div>
            </div>
            {/* Vote bars */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}><span style={{color:T.green}}>✅ {p.for}%</span><span style={{color:T.red}}>❌ {p.against}%</span></div>
              <div style={{height:6,background:T.surface,borderRadius:3,overflow:"hidden",display:"flex"}}>
                <div style={{height:"100%",width:`${p.for}%`,background:T.green}}/>
                <div style={{height:"100%",width:`${p.against}%`,background:T.red}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:T.muted}}><span>النصاب: {p.quorum}%</span><span>{p.ends!=="منتهي"&&`ينتهي: ${p.ends}`}</span></div>
            </div>
            {p.status==="نشط"&&(
              votes[p.id]?(
                <div style={{textAlign:"center",padding:"8px",background:`${votes[p.id]==="for"?T.green:T.red}15`,borderRadius:8,color:votes[p.id]==="for"?T.green:T.red,fontSize:12,fontWeight:700}}>
                  ✓ صوّتت {votes[p.id]==="for"?"بالموافقة":"بالرفض"}
                </div>
              ):(
                <div style={{display:"flex",gap:8}}>
                  <button style={{...s.btn(T.green),flex:1,padding:"9px",fontSize:12}} onClick={()=>vote(p.id,"for")}>✅ موافق</button>
                  <button style={{...s.btn(T.red),flex:1,padding:"9px",fontSize:12}} onClick={()=>vote(p.id,"against")}>❌ رافض</button>
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TreePage(){
  return(
    <div style={{animation:"slideUp .3s ease"}}>
      <div style={s.card()}>
        <div style={s.title(T.cyan)}>🌳 شجرة الإحالة التفاعلية</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
          {[{l:"إجمالي الأرباح",v:"$4,200",c:T.gold},{l:"عدد الفروع",v:"6",c:T.cyan},{l:"مستوى الشجرة",v:"3",c:T.green}].map((s2,i)=>(
            <div key={i} style={s.statBox(s2.c)}><div style={{color:s2.c,fontWeight:900,fontSize:18}}>{s2.v}</div><div style={{color:T.muted,fontSize:10,marginTop:2}}>{s2.l}</div></div>
          ))}
        </div>
        <div style={{padding:12,background:`${T.gold}0d`,borderRadius:12,border:`1px solid ${T.gold}33`,marginBottom:14}}>
          <div style={{color:T.gold,fontSize:12,marginBottom:8}}>🔗 كود الإحالة الخاص بك</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{flex:1,background:T.void,padding:"9px 12px",borderRadius:8,color:T.gold,fontFamily:T.mono,fontSize:14,fontWeight:700}}>SHN-REF-7A2B9X</div>
            <button style={s.chip(true)} onClick={()=>navigator.clipboard?.writeText("SHN-REF-7A2B9X")}>📋 نسخ</button>
          </div>
        </div>
        <TreeNode node={TREE_DATA}/>
      </div>

      <div style={s.card()}>
        <div style={s.title(T.gold)}>💰 هيكل العمولات</div>
        {[["المستوى 1 (مباشر)","15%","من كل صفقة"],["المستوى 2","8%","من صفقات فريقك"],["المستوى 3","4%","عمق الشبكة"]].map(([l,p,d],i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
            <span style={{color:T.txt2,fontSize:13}}>{l}</span>
            <div style={{textAlign:"left"}}><div style={{color:T.gold,fontWeight:800,fontSize:16}}>{p}</div><div style={{color:T.muted,fontSize:10}}>{d}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletPage(){
  const [step,setStep]=useState(0);
  const [linked,setLinked]=useState(false);
  const [bData,setBData]=useState({bank:"",iban:"",holder:""});

  const txns=[
    {type:"إيداع",amt:"+$120.50",shn:"+28,690 SHN",time:"اليوم 14:30",col:T.green},
    {type:"عمولة",amt:"+$45.00",shn:"+10,714 SHN",time:"أمس 09:15",col:T.cyan},
    {type:"شراء",amt:"-$89.00",shn:"-21,190 SHN",time:"منذ 3 أيام",col:T.red},
    {type:"استحقاق",amt:"+$200.00",shn:"+47,619 SHN",time:"منذ 5 أيام",col:T.gold},
  ];

  return(
    <div style={{animation:"slideUp .3s ease"}}>
      {/* Balance card */}
      <div style={{...s.card(),border:`2px solid ${T.gold}55`,background:`linear-gradient(135deg,${T.gold}12,${T.card})`,textAlign:"center",animation:"glow 4s infinite"}}>
        <div style={{color:T.muted,fontSize:12,marginBottom:4}}>رصيد SHN</div>
        <div style={{color:T.goldLt,fontWeight:900,fontSize:34,marginBottom:4}}>142,857 SHN</div>
        <div style={{color:T.muted,fontSize:14}}>≈ $600.00 USD</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:14}}>
          {[{l:"إرسال",i:"📤"},{l:"استقبال",i:"📥"},{l:"تبادل",i:"🔄"},{l:"شراء",i:"💳"}].map((a,i)=>(
            <div key={i} style={{textAlign:"center",cursor:"pointer"}}>
              <div style={{width:44,height:44,borderRadius:12,background:`${T.gold}18`,border:`1.5px solid ${T.gold}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:4,margin:"0 auto 4px"}}>{a.i}</div>
              <div style={{color:T.muted,fontSize:10}}>{a.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Token stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[{l:"مُقفَّل تصويت",v:"10,000",c:T.purple},{l:"في الاستحقاق",v:"25,000",c:T.amber},{l:"متاح",c:T.green,v:"107,857"}].map((s2,i)=>(
          <div key={i} style={s.statBox(s2.c)}><div style={{color:s2.c,fontWeight:800,fontSize:14}}>{s2.v}</div><div style={{color:T.muted,fontSize:9,marginTop:2}}>{s2.l}</div></div>
        ))}
      </div>

      {/* Transactions */}
      <div style={s.card()}>
        <div style={s.title(T.cyan)}>📋 المعاملات الأخيرة</div>
        {txns.map((tx,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${T.border}`}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${tx.col}18`,border:`1px solid ${tx.col}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{tx.col===T.green?"↑":tx.col===T.red?"↓":"◈"}</div>
              <div><div style={{color:T.txt,fontWeight:700,fontSize:13}}>{tx.type}</div><div style={{color:T.muted,fontSize:10}}>{tx.time}</div></div>
            </div>
            <div style={{textAlign:"left"}}><div style={{color:tx.col,fontWeight:800,fontSize:14}}>{tx.amt}</div><div style={{color:T.muted,fontSize:10}}>{tx.shn}</div></div>
          </div>
        ))}
      </div>

      {/* Bank linking */}
      <div style={s.card()}>
        <div style={s.title(T.purple)}>🏦 الربط البنكي الآمن</div>
        {!linked?(
          <>
            <div style={{display:"flex",marginBottom:16,background:T.void,borderRadius:10,overflow:"hidden"}}>
              {["البيانات","التحقق","مكتمل"].map((s2,i)=>(
                <div key={i} style={{flex:1,padding:"9px 0",textAlign:"center",fontSize:11,fontWeight:700,background:step===i?`${T.purple}18`:"transparent",borderBottom:`2px solid ${step>=i?T.purple:T.border}`,color:step>=i?T.purple:T.muted}}>{s2}</div>
              ))}
            </div>
            {step===0&&(
              <div>
                {[
                  {k:"bank",label:"🏛️ البنك",type:"sel",opts:["بنك الراجحي","البنك الأهلي","بنك دبي الإسلامي","البنك التجاري الدولي","بنك القاهرة","بنك مصر"]},
                  {k:"iban",label:"📋 رقم IBAN",ph:"SA00 0000 0000 0000 0000 0000"},
                  {k:"holder",label:"👤 اسم صاحب الحساب",ph:"الاسم كما في البنك"},
                ].map(f=>(
                  <div key={f.k} style={{marginBottom:12}}>
                    <div style={{color:T.muted,fontSize:12,marginBottom:6}}>{f.label}</div>
                    {f.type==="sel"?(
                      <select style={s.input} value={bData[f.k]} onChange={e=>setBData({...bData,[f.k]:e.target.value})}>
                        <option value="">اختر البنك</option>
                        {f.opts.map(o=><option key={o}>{o}</option>)}
                      </select>
                    ):(
                      <input style={s.input} placeholder={f.ph} value={bData[f.k]} onChange={e=>setBData({...bData,[f.k]:e.target.value})}/>
                    )}
                  </div>
                ))}
                <button style={s.btn(T.purple,!bData.bank||!bData.iban||!bData.holder)} onClick={()=>bData.bank&&bData.iban&&bData.holder&&setStep(1)}>التالي ←</button>
              </div>
            )}
            {step===1&&(
              <div>
                <div style={{background:T.void,borderRadius:12,padding:16,marginBottom:12}}>
                  {[["البنك",bData.bank],["IBAN",bData.iban],["الاسم",bData.holder]].map(([k,v],i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}><span style={{color:T.muted}}>{k}</span><span style={{fontWeight:700}}>{v}</span></div>
                  ))}
                </div>
                <div style={{padding:10,background:`${T.green}0d`,borderRadius:8,marginBottom:12,fontSize:11,color:T.muted}}>🔒 مشفّر AES-256 — تحويل تلقائي خلال 24 ساعة</div>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...s.chip(false),flex:1,padding:12,borderRadius:10,textAlign:"center"}} onClick={()=>setStep(0)}>← رجوع</button>
                  <button style={{...s.btn(T.purple),flex:2}} onClick={()=>{setStep(2);setTimeout(()=>setLinked(true),1200);}}>✅ تأكيد الربط</button>
                </div>
              </div>
            )}
            {step===2&&!linked&&(
              <div style={{textAlign:"center",padding:30}}>
                <div style={{fontSize:40,animation:"spin 1.5s linear infinite",display:"inline-block"}}>⚙️</div>
                <div style={{color:T.purple,marginTop:12,fontWeight:700}}>جارٍ الربط الآمن...</div>
              </div>
            )}
          </>
        ):(
          <div>
            <div style={{textAlign:"center",padding:"16px 0"}}><div style={{fontSize:50}}>✅</div><div style={{color:T.green,fontWeight:900,fontSize:17,marginTop:8}}>تم الربط بنجاح</div><div style={{color:T.muted,fontSize:13}}>{bData.bank}</div></div>
            {[{l:"آخر دفعة",v:"$120.50",c:T.green},{l:"قيد التحويل",v:"$85.00",c:T.gold},{l:"إجمالي الشهر",v:"$4,200",c:T.purple}].map((s2,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",background:T.void,padding:12,borderRadius:10,marginBottom:8,border:`1px solid ${T.border}`}}>
                <span style={{color:T.muted,fontSize:13}}>{s2.l}</span>
                <span style={{color:s2.c,fontWeight:800,fontSize:15}}>{s2.v}</span>
              </div>
            ))}
            <button style={{...s.btn(T.red),width:"100%",marginTop:4}} onClick={()=>{setLinked(false);setStep(0);setBData({bank:"",iban:"",holder:""});}}>🔌 فصل الحساب</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function ShaheenSuperApp(){
  const [page,setPage]   = useState("home");
  const [cart,setCart]   = useState([]);
  const [openChat,setOpenChat]         = useState(null);
  const [showBroadcast,setShowBroadcast] = useState(false);

  // Live market data
  const [shnPrice,setShnPrice]   = useState(()=>0.0042 + Math.random()*0.0002);
  const [shnChange,setShnChange] = useState(2.34);
  const [shnHistory,setShnHistory] = useState(()=>genHistory(0.0042,.018));
  const [btcPrice] = useState(()=>Math.round(94200+Math.random()*1000));
  const [ethPrice] = useState(()=>Math.round(3400+Math.random()*100));
  const [btcHistory] = useState(()=>genHistory(94200,.015));
  const [ethHistory] = useState(()=>genHistory(3400,.018));

  // FIX B004: proper interval cleanup + price simulation
  useEffect(()=>{
    const id=setInterval(()=>{
      setShnPrice(p=>{
        const delta=(Math.random()-.49)*.00008;
        const np=Math.max(0.001,p+delta);
        const pct=((np-0.0042)/0.0042)*100;
        setShnChange(parseFloat(pct.toFixed(2)));
        setShnHistory(h=>{
          const next=[...h.slice(1),{t:h[h.length-1].t+1,v:parseFloat(np.toFixed(7))}];
          return next;
        });
        return np;
      });
    },2000);
    return()=>clearInterval(id);
  },[]);

  const cartCount=cart.reduce((a,b)=>a+b.qty,0);
  const angel=ANGELS.find(a=>a.id===openChat);

  return(
    <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 20% 20%,#0a0f20,${T.void} 60%,#030608)`,fontFamily:T.font,color:T.txt,direction:"rtl",position:"relative",paddingBottom:70}}>
      <style>{CSS}</style>
      <StarField/>

      {/* ── TOP BAR ── */}
      <div style={{position:"sticky",top:0,zIndex:100,background:`rgba(4,8,15,.92)`,borderBottom:`1px solid ${T.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:12,backdropFilter:"blur(16px)"}}>
        <div style={{fontSize:26,filter:`drop-shadow(0 0 10px ${T.gold})`}}>🦅</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:15,background:`linear-gradient(90deg,${T.gold},${T.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>شاهين</div>
          <div style={{color:shnChange>=0?T.green:T.red,fontSize:10,fontWeight:700}}>SHN ${shnPrice.toFixed(5)} {shnChange>=0?"▲":"▼"}{Math.abs(shnChange).toFixed(2)}%</div>
        </div>
        {/* Cart badge */}
        <div style={{position:"relative",cursor:"pointer"}} onClick={()=>setPage("store")}>
          <span style={{fontSize:22}}>🛍️</span>
          {cartCount>0&&<span style={{position:"absolute",top:-4,left:-4,background:T.red,color:"#fff",fontSize:9,fontWeight:800,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{cartCount}</span>}
        </div>
        <div style={{width:7,height:7,borderRadius:"50%",background:T.green,animation:"pulse 2s infinite"}}/>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{maxWidth:480,margin:"0 auto",padding:"14px 14px 0"}}>
        {page==="home"&&<HomePage setPage={setPage} shnPrice={shnPrice} shnChange={shnChange} shnHistory={shnHistory}/>}
        {page==="market"&&<MarketPage shnPrice={shnPrice} shnChange={shnChange} shnHistory={shnHistory} btcP={btcPrice} ethP={ethPrice} btcH={btcHistory} ethH={ethHistory}/>}
        {page==="sovereign"&&<SovereignPage/>}
        {page==="agents"&&<AgentsPage openChat={openChat} setOpenChat={setOpenChat} showBroadcast={showBroadcast} setShowBroadcast={setShowBroadcast}/>}
        {page==="store"&&<StorePage cart={cart} setCart={setCart}/>}
        {page==="dao"&&<DaoPage/>}
        {page==="tree"&&<TreePage/>}
        {page==="wallet"&&<WalletPage/>}
      </div>

      {/* ── BOTTOM NAV (iOS/Android style) ── */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:`rgba(4,8,15,.96)`,borderTop:`1px solid ${T.border}`,backdropFilter:"blur(16px)",padding:"8px 0 10px"}}>
        <div style={{display:"flex",justifyContent:"space-around",maxWidth:480,margin:"0 auto"}}>
          {PAGES.map(p=>(
            <button key={p.id} onClick={()=>setPage(p.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"4px 6px",position:"relative",minWidth:36}}>
              {p.id==="store"&&cartCount>0&&<span style={{position:"absolute",top:-2,right:-2,background:T.red,color:"#fff",fontSize:8,fontWeight:800,width:14,height:14,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{cartCount}</span>}
              <span style={{fontSize:18,filter:page===p.id?`drop-shadow(0 0 8px ${T.gold})`:"none",opacity:page===p.id?1:.5,transition:"all .25s"}}>{p.icon}</span>
              <span style={{fontSize:9,fontWeight:700,color:page===p.id?T.gold:T.muted,transition:"all .25s"}}>{p.label}</span>
              {page===p.id&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",width:24,height:2.5,background:T.gold,borderRadius:2}}/>}
            </button>
          ))}
        </div>
      </div>

      {/* ── MODALS ── */}
      {angel&&<AngelModal angel={angel} onClose={()=>setOpenChat(null)}/>}
      {showBroadcast&&<BroadcastModal onClose={()=>setShowBroadcast(false)}/>}
    </div>
  );
}
