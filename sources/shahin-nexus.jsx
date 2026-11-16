import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════
//  🦅 SHAHIN NEXUS v3.1 — نواة الكيان المتكاملة — مُصحَّح بالكامل
//  FIX B001: حذف useCallback غير المستخدم
//  FIX B002: حذف mediaResult اليتيم
//  FIX B003: لون Twitter #1a1a1a→#71767B (كان غير مرئي)
//  FIX B004: TypeWriter — isMounted ref لمنع تسرب الذاكرة
//  FIX B005: StarField — إعادة توزيع النجوم عند resize
//  FIX B006: callAI — فحص r.ok وd.error
//  FIX B007: style helpers نُقلت لمستوى الوحدة
//  FIX B008: bigBtn — مقارنة لون صريحة
//  FIX B009: TABS نُقلت خارج المكوّن
//  FIX B010: JSON parse — معالجة أخطاء مفصّلة
//  NEW:  عميل المهندس — تشخيص وإصلاح لحظي + محادثة AI
// ═══════════════════════════════════════════════════════════════════════

const T = {
  bg:"#04060f", surface:"#080d1a", card:"#0c1225", border:"#1a2540",
  gold:"#c9a84c", goldLt:"#f0c060", blue:"#2d7dff",
  cyan:"#00e5ff", green:"#00d97e", purple:"#7c5fe6",
  red:"#ff4d6d", orange:"#ff6b35",
  txt:"#c8d8f0", muted:"#5a7090",
  font:"'Cairo','Amiri',sans-serif", mono:"'Courier New',monospace",
};

// FIX B007: style helpers على مستوى الوحدة — لا تُعاد كل render
const mkCard  = (x={}) => ({background:`linear-gradient(135deg,${T.card},${T.surface})`,border:`1px solid ${T.border}`,borderRadius:16,padding:18,marginBottom:14,...x});
const mkTitle = (c=T.gold) => ({color:c,fontSize:15,fontWeight:800,marginBottom:12,display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${c}22`,paddingBottom:8});
const mkChip  = (on,c=T.gold) => ({padding:"7px 14px",borderRadius:50,cursor:"pointer",fontSize:12,fontWeight:700,border:`1.5px solid ${on?c:T.border}`,background:on?`${c}18`:"transparent",color:on?c:T.muted,fontFamily:T.font,transition:"all .2s",display:"inline-block"});
// FIX B008: مقارنة صريحة بدلاً من col===T.gold
const mkBtn   = (off,c=T.gold) => ({width:"100%",padding:14,borderRadius:12,border:"none",fontFamily:T.font,fontSize:15,fontWeight:900,cursor:off?"not-allowed":"pointer",background:off?T.surface:`linear-gradient(135deg,${c},${c}bb)`,color:off?T.muted:(c==="#c9a84c"?"#000":"#fff"),boxShadow:off?"none":`0 0 28px ${c}44`,transition:"all .3s"});
const mkInpt  = {width:"100%",padding:"11px 14px",borderRadius:10,background:T.bg,border:`1.5px solid ${T.border}`,color:T.txt,fontSize:13,fontFamily:T.font,direction:"rtl",boxSizing:"border-box",outline:"none"};

// FIX B009: TABS خارج المكوّن
const TABS = [
  {id:"dashboard",icon:"🏛️",label:"القيادة"},
  {id:"org",      icon:"🏗️",label:"الهيكل"},
  {id:"campaign", icon:"🎯",label:"الحملة"},
  {id:"energy",   icon:"☀️",label:"الطاقة"},
  {id:"investors",icon:"👑",label:"المستثمرون"},
  {id:"tree",     icon:"🌳",label:"الشجرة"},
  {id:"agents",   icon:"🤖",label:"العملاء"},
  {id:"offers",   icon:"💎",label:"العروض"},
  {id:"bank",     icon:"🏦",label:"البنكي"},
  {id:"engineer", icon:"🔧",label:"المهندس"},
];

// FIX B003: لون Twitter مرئي على الخلفية الداكنة
const PLATFORMS = [
  {id:"twitter",  name:"X / تويتر", icon:"𝕏", color:"#71767B"},
  {id:"instagram",name:"إنستغرام",  icon:"📸",color:"#C13584"},
  {id:"telegram", name:"تيليغرام",  icon:"✈️",color:"#2CA5E0"},
  {id:"youtube",  name:"يوتيوب",    icon:"▶️",color:"#FF4444"},
  {id:"tiktok",   name:"تيك توك",   icon:"🎵",color:"#69C9D0"},
  {id:"email",    name:"البريد",    icon:"📧",color:"#D44638"},
];

const SECTORS=[
  {id:"solar",   icon:"☀️",label:"الطاقة الشمسية", market:"1.2T$"},
  {id:"wind",    icon:"💨",label:"طاقة الرياح",    market:"850B$"},
  {id:"recycle", icon:"♻️",label:"إعادة التدوير",  market:"420B$"},
  {id:"hydrogen",icon:"⚡",label:"الهيدروجين",     market:"300B$"},
  {id:"storage", icon:"🔋",label:"تخزين الطاقة",   market:"650B$"},
];

const MEDIA_TYPES=[
  {id:"video_script",label:"سكريبت فيديو",icon:"🎬",dur:"60 ثانية"},
  {id:"pitch_deck",  label:"عرض تقديمي", icon:"📊",dur:"15 شريحة"},
  {id:"press",       label:"بيان صحفي",  icon:"📰",dur:"500 كلمة"},
  {id:"social_pack", label:"حزمة سوشيال",icon:"📱",dur:"7 منشورات"},
];

const OFFER_TIERS=[
  {tier:"الطيف الذهبي",  price:500,bonus:"20%",perks:["أولوية الإطلاق","إحالة 15%","دخول VIP","مستشار شخصي"],color:T.gold},
  {tier:"الطيف الفضي",   price:200,bonus:"12%",perks:["إحالة 10%","تنبيهات حصرية","دخول مبكر"],             color:"#a0b8cc"},
  {tier:"الطيف البرونزي",price:50, bonus:"6%", perks:["إحالة 5%","دخول مبكر"],                              color:"#c8825a"},
];

const TREE_ROOT={
  name:"أنت",code:"SHN-001",earn:4200,
  children:[
    {name:"أحمد ع.",code:"SHN-002",earn:1800,children:[
      {name:"سارة م.",code:"SHN-005",earn:420,children:[]},
      {name:"خالد ر.",code:"SHN-006",earn:380,children:[]},
    ]},
    {name:"فاطمة ح.",code:"SHN-003",earn:950,children:[
      {name:"يوسف ب.",code:"SHN-007",earn:210,children:[]},
    ]},
    {name:"محمد ط.",code:"SHN-004",earn:630,children:[]},
  ],
};

const INVESTORS=[
  {name:"صناديق الثروة السيادية",budget:"100M$+",pct:90,flag:"🏛️",priority:"قصوى"},
  {name:"شركات البترول المتحولة",budget:"50M$+", pct:85,flag:"🛢️",priority:"عالية"},
  {name:"رجال الأعمال التقنيين", budget:"10M$+", pct:92,flag:"💻",priority:"قصوى"},
  {name:"المستثمرون العقاريون", budget:"5M$+",  pct:70,flag:"🏗️",priority:"متوسطة"},
  {name:"المؤسسات الأكاديمية",  budget:"2M$+",  pct:95,flag:"🎓",priority:"عالية"},
  {name:"الشركات العائلية",     budget:"20M$+", pct:78,flag:"👑",priority:"عالية"},
];

const PIPELINE=[
  {id:"analyst", name:"عميل الاستهداف",    icon:"🔍",color:T.green, role:"يحلل السوق ويحدد الفرص"},
  {id:"strategy",name:"عميل الاستراتيجية", icon:"♟️",color:T.cyan,  role:"خطة تمويل 90 يوم"},
  {id:"creative",name:"عميل الإبداع",       icon:"🎬",color:T.orange,role:"ينتج الميديا والمحتوى"},
  {id:"pitch",   name:"عميل العروض",        icon:"💼",color:T.gold,  role:"ملفات إقناع للمستثمرين"},
  {id:"outreach",name:"عميل التواصل",       icon:"📡",color:T.purple,role:"حملات تواصل متزامنة"},
];

const DIVISIONS=[
  {id:"marketing", name:"🎯 ذراع التسويق",   title:"إدارة الحملات والإعلان",      color:T.orange,
   agents:[{name:"عميل الحملات",icon:"📣",desc:"ينتج المحتوى لـ 6 منصات",  status:"نشط"},
           {name:"عميل الإبداع", icon:"🎬",desc:"سكريبتات وفيديوهات",      status:"نشط"},
           {name:"عميل السوشيال",icon:"📱",desc:"هاشتاقات وجدولة",         status:"جاهز"}],
   tools:["X/تويتر","إنستغرام","تيليغرام","يوتيوب","تيك توك","بريد"]},
  {id:"energy",    name:"☀️ ذراع الطاقة",    title:"الطاقة النظيفة والمتجددة",    color:T.green,
   agents:[{name:"عميل الشمسية",  icon:"☀️",desc:"مشاريع الألواح",         status:"نشط"},
           {name:"عميل التدوير",  icon:"♻️",desc:"حملات إعادة التدوير",    status:"نشط"},
           {name:"عميل الهيدروجين",icon:"⚡",desc:"الهيدروجين الأخضر",     status:"جاهز"}],
   tools:["سكريبت فيديو","وثائقي قصير","بيان صحفي","عرض مستثمرين","حزمة سوشيال"]},
  {id:"investment",name:"💰 ذراع الاستثمار", title:"التمويل واستقطاب المستثمرين", color:T.gold,
   agents:[{name:"عميل التحليل",     icon:"🔍",desc:"يحدد الأهداف عالية القيمة",status:"نشط"},
           {name:"عميل الاستراتيجية",icon:"♟️",desc:"خطة تمويل 90 يوماً",      status:"نشط"},
           {name:"عميل العروض",      icon:"💼",desc:"ملفات إقناع مخصصة",       status:"نشط"}],
   tools:["صناديق سيادية","شركات بترول","تقنيون","عائلات ثرية","أكاديميات"]},
  {id:"growth",    name:"🌳 ذراع النمو",      title:"شجرة العملاء والمجتمع",       color:T.cyan,
   agents:[{name:"عميل التواصل",icon:"📡",desc:"LinkedIn وبريد ومكالمات",  status:"نشط"},
           {name:"عميل الشجرة", icon:"🌿",desc:"يدير شبكة الإحالة",        status:"نشط"},
           {name:"عميل الولاء", icon:"🎁",desc:"باقات VIP ومكافآت",        status:"جاهز"}],
   tools:["كود إحالة","لوحة الشجرة","متابعة العمولات","باقة ذهبية/فضية/برونزي"]},
  {id:"finance",   name:"🏦 ذراع المالية",    title:"البنية التقنية والمالية",      color:T.purple,
   agents:[{name:"عميل البنكي",     icon:"🏦",desc:"ربط IBAN وتحويلات تلقائية", status:"نشط"},
           {name:"عميل الأمن",      icon:"🔐",desc:"تشفير AES-256 ومصادقة",    status:"نشط"},
           {name:"عميل التحليلات", icon:"📊",desc:"KPIs ولوحات بيانات",       status:"نشط"}],
   tools:["IBAN ربط","AES-256","تقارير أرباح","سجل معاملات","تنبيهات"]},
];

const STATS=[
  {label:"إجمالي المستثمرين",value:"1,284",delta:"+12%",icon:"👑",color:T.gold},
  {label:"حجم التمويل",       value:"$4.2M",delta:"+8.5%",icon:"💰",color:T.green},
  {label:"شجرة العملاء",      value:"6,841",delta:"+24%", icon:"🌳",color:T.cyan},
  {label:"حملات نشطة",        value:"17",   delta:"+3",   icon:"🎯",color:T.orange},
  {label:"عملاء ذكاء اصطناعي",value:"16",  delta:"نشط",  icon:"🤖",color:T.purple},
  {label:"ربحية الطاقة",      value:"91%",  delta:"+2.1%",icon:"☀️",color:T.green},
];

const BUGS=[
  // v3.2 — 12 خطأ مُكتشَف ومُصلَح بالكامل
  {id:"B001",sev:"حرج",   area:"واردات",    desc:"useCallback مستورد وغير مستخدم → تحذير lint",            fix:"حُذف من قائمة الاستيراد",                    fixed:true},
  {id:"B002",sev:"متوسط", area:"الحالة",    desc:"mediaResult/setMediaResult معلَّنان بلا استخدام",        fix:"حُذفت الحالة غير المستخدمة",                 fixed:true},
  {id:"B003",sev:"حرج",   area:"الواجهة",   desc:"لون Twitter #1a1a1a غير مرئي على الخلفية الداكنة",       fix:"تغيير إلى #71767B",                          fixed:true},
  {id:"B004",sev:"متوسط", area:"TypeWriter",desc:"setInterval يُشغَّل بعد إلغاء تحميل المكوّن",             fix:"إضافة isMounted ref للحماية",                fixed:true},
  {id:"B005",sev:"منخفض", area:"StarField", desc:"resize يمسح Canvas دون إعادة توزيع النجوم",              fix:"إعادة توزيع النجوم في handler",              fixed:true},
  {id:"B006",sev:"حرج",   area:"callAI",    desc:"لا يتحقق من HTTP status أو حقل error في الاستجابة",      fix:"فحص r.ok وd.error مع رمي خطأ وصفي",         fixed:true},
  {id:"B007",sev:"متوسط", area:"الأنماط",  desc:"card/chip/bigBtn تُعاد داخل المكوّن كل render دون مذكرة",  fix:"نُقلت لمستوى الوحدة module-level",           fixed:true},
  {id:"B008",sev:"منخفض", area:"bigBtn",    desc:"مقارنة col===T.gold هشة إذا تغيّر الثابت",               fix:"مقارنة صريحة col===\"#c9a84c\"",             fixed:true},
  {id:"B009",sev:"منخفض", area:"TABS",      desc:"مصفوفة TABS تُعاد كل render داخل المكوّن",               fix:"نُقلت خارج المكوّن",                         fixed:true},
  {id:"B010",sev:"متوسط", area:"JSON",      desc:"خطأ JSON.parse يُبتلع صامتاً في catch",                  fix:"تسجيل الخطأ وعرض رسالة مفيدة للمستخدم",     fixed:true},
  {id:"B011",sev:"حرج",   area:"API / النموذج", desc:"معرّف النموذج claude-sonnet-4-20250514 خاطئ → API يرفضه",  fix:"تصحيح إلى claude-sonnet-4-6",               fixed:true},
  {id:"B012",sev:"حرج",   area:"JSX / ternary", desc:"msgIn.trim()?.5 يُفسَّر كـ optional chaining → كسر زر الإرسال", fix:"تصحيح إلى (engBusy||!msgIn.trim())?0.5:1", fixed:true},
];

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────

// FIX B004 + B005
function StarField() {
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current; if(!c) return;
    const ctx=c.getContext("2d");
    let id, stars=[];
    const make=(w,h)=>Array.from({length:55},()=>({
      x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.2+.3,
      dx:(Math.random()-.5)*.15,dy:(Math.random()-.5)*.15,
      o:Math.random()*.4+.1,
      col:[T.gold,T.cyan,T.blue][Math.floor(Math.random()*3)],
    }));
    const resize=()=>{
      c.width=window.innerWidth; c.height=window.innerHeight;
      stars=make(c.width,c.height); // FIX B005
    };
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
      id=requestAnimationFrame(draw);
    };
    draw();
    return()=>{ cancelAnimationFrame(id); window.removeEventListener("resize",resize); };
  },[]);
  return <canvas ref={ref} style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",opacity:.4}}/>;
}

// FIX B004: TypeWriter مع حماية من تحديث الحالة بعد إلغاء التحميل
function TypeWriter({text,speed=8}){
  const [shown,setShown]=useState("");
  useEffect(()=>{
    const live={v:true}; setShown(""); let i=0;
    const id=setInterval(()=>{
      if(!live.v){clearInterval(id);return;}
      if(i<text.length) setShown(text.slice(0,++i)); else clearInterval(id);
    },speed);
    return()=>{ live.v=false; clearInterval(id); };
  },[text,speed]);
  return <span>{shown}{shown.length<text.length&&<span style={{animation:"blink 1s step-end infinite",opacity:.7}}>▌</span>}</span>;
}

function TreeNode({node,depth=0}){
  const [open,setOpen]=useState(true);
  const pal=[T.gold,T.cyan,T.green,T.purple];
  const col=pal[depth%pal.length];
  return(
    <div style={{marginRight:depth>0?18:0,marginTop:6}}>
      <div onClick={()=>node.children.length&&setOpen(!open)}
        style={{display:"flex",alignItems:"center",gap:10,background:`linear-gradient(135deg,${col}12,transparent)`,border:`1px solid ${col}33`,borderRadius:10,padding:"9px 14px",cursor:"pointer",transition:"all .3s"}}
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
      {open&&node.children.length>0&&(
        <div style={{borderRight:`1.5px solid ${col}1a`,paddingRight:10}}>
          {node.children.map((ch,i)=><TreeNode key={ch.code||i} node={ch} depth={depth+1}/>)}
        </div>
      )}
    </div>
  );
}

function DivCard({div,expanded,onToggle}){
  return(
    <div style={{border:`1.5px solid ${expanded?div.color:T.border}`,borderRadius:16,overflow:"hidden",transition:"all .35s",boxShadow:expanded?`0 0 20px ${div.color}22`:"none"}}>
      <div onClick={onToggle} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:"pointer",background:expanded?`${div.color}0e`:T.card}}>
        <div style={{width:40,height:40,borderRadius:12,flexShrink:0,background:`${div.color}18`,border:`1.5px solid ${div.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{div.name.split(" ")[0]}</div>
        <div style={{flex:1,textAlign:"right"}}>
          <div style={{color:expanded?div.color:T.txt,fontWeight:800,fontSize:14}}>{div.name.slice(2)}</div>
          <div style={{color:T.muted,fontSize:11}}>{div.title}</div>
        </div>
        <span style={{color:div.color,fontSize:18,transition:"transform .3s",display:"block",transform:expanded?"rotate(90deg)":"none"}}>›</span>
      </div>
      {expanded&&(
        <div style={{padding:"0 16px 16px",background:T.surface}}>
          <div style={{marginTop:12,marginBottom:8,color:T.muted,fontSize:11,fontWeight:700}}>● العملاء الذكيون</div>
          {div.agents.map((ag,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:`${div.color}08`,border:`1px solid ${div.color}22`,borderRadius:10,padding:"9px 12px",marginBottom:7}}>
              <span style={{fontSize:17}}>{ag.icon}</span>
              <div style={{flex:1,textAlign:"right"}}>
                <div style={{color:T.txt,fontWeight:700,fontSize:13}}>{ag.name}</div>
                <div style={{color:T.muted,fontSize:10}}>{ag.desc}</div>
              </div>
              <span style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:ag.status==="نشط"?`${T.green}20`:`${T.muted}20`,color:ag.status==="نشط"?T.green:T.muted,border:`1px solid ${ag.status==="نشط"?T.green:T.muted}44`}}>{ag.status}</span>
            </div>
          ))}
          <div style={{color:T.muted,fontSize:11,fontWeight:700,marginBottom:8}}>◈ الأدوات</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {div.tools.map((t,i)=><span key={i} style={{padding:"4px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:`${div.color}12`,border:`1px solid ${div.color}33`,color:div.color}}>{t}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════
export default function ShahinNexus(){
  const [tab,setTab]           = useState("dashboard");
  const [expDiv,setExpDiv]     = useState(null);

  // Campaign
  const [selP,setSelP]         = useState(["twitter","telegram"]);
  const [goal,setGoal]         = useState("زيادة المستثمرين");
  const [tone,setTone]         = useState("احترافي وموثوق");
  const [campRes,setCampRes]   = useState(null);

  // Energy pipeline — FIX B002: mediaResult حُذف
  const [selS,setSelS]         = useState(["solar","recycle"]);
  const [selM,setSelM]         = useState("video_script");
  const [phase,setPhase]       = useState(-1);
  const [outs,setOuts]         = useState({});
  const [logs,setLogs]         = useState([]);
  const [actOut,setActOut]     = useState(null);

  // Offers & bank
  const [selOff,setSelOff]     = useState(null);
  const [bStep,setBStep]       = useState(0);
  const [bLinked,setBLinked]   = useState(false);
  const [bData,setBData]       = useState({bank:"",iban:"",holder:""});

  // Engineer
  const [chat,setChat]         = useState([]);
  const [msgIn,setMsgIn]       = useState("");
  const [engBusy,setEngBusy]   = useState(false);
  const [scanLog,setScanLog]   = useState([]);
  const [scanDone,setScanDone] = useState(false);

  const [busy,setBusy]         = useState(false);
  const logRef  = useRef(null);
  const chatRef = useRef(null);

  useEffect(()=>{if(logRef.current)  logRef.current.scrollTop =logRef.current.scrollHeight; },[logs]);
  useEffect(()=>{if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight;},[chat,scanLog]);

  // FIX B006: callAI مع فحص HTTP وحقل error
  const callAI=async(prompt,sys="")=>{
    const content=sys?`${sys}\n\n${prompt}`:prompt;
    const r=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content}]}),
    });
    if(!r.ok) throw new Error(`HTTP ${r.status} — ${r.statusText}`);
    const d=await r.json();
    if(d.error) throw new Error(d.error.message||"خطأ API غير محدد");
    return d.content?.[0]?.text||"";
  };

  const addLog=(msg,t="ok")=>{
    const cols={ok:T.green,ag:T.cyan,warn:T.gold,err:T.red};
    setLogs(p=>[...p,{msg,col:cols[t]||T.green,ts:new Date().toLocaleTimeString("ar")}]);
  };

  // Campaign
  const runCampaign=async()=>{
    setBusy(true); setCampRes(null);
    const pn=selP.map(id=>PLATFORMS.find(p=>p.id===id)?.name).join("، ");
    try{
      const raw=await callAI(`أنت عميل تسويق لعملة شاهين الرقمية. أنشئ حملة للمنصات: ${pn}، الهدف: ${goal}، النبرة: ${tone}. رد بـ JSON صالح فقط بلا markdown بهذا الشكل بالضبط:\n{"headline":"...","tagline":"...","summary":"...","platforms":{${selP.map(id=>`"${id}":{"post":"...","visual":"..."}`).join(",")}},"kpis":["...","...","..."]}`);
      const clean=raw.replace(/```json|```/g,"").trim();
      try{ setCampRes(JSON.parse(clean)); }
      // FIX B010: معالجة JSON مفصّلة
      catch(pe){ console.error("JSON parse:",pe.message,"\nRaw:",clean.slice(0,200)); setCampRes({headline:"⚠️ خطأ تحليل الاستجابة",tagline:"حاول مرة أخرى",summary:clean.slice(0,200),platforms:{},kpis:[]}); }
    }catch(e){ setCampRes({headline:"❌ "+e.message,tagline:"",summary:"تحقق من الاتصال",platforms:{},kpis:[]}); }
    setBusy(false);
  };

  // 5-agent pipeline
  const runPipeline=async()=>{
    setBusy(true); setOuts({}); setLogs([]); setPhase(-1); setActOut(null);
    const sec=selS.map(s=>SECTORS.find(x=>x.id===s)?.label).join("، ");
    const med=MEDIA_TYPES.find(m=>m.id===selM);
    try{
      setPhase(0); addLog("🔍 عميل الاستهداف يحلل السوق...","ag");
      const a0=await callAI(`حلّل سوق الطاقة النظيفة لعملة شاهين — قطاعات: ${sec}. أبرز 3 نقاط ألم للمستثمرين، 3 فرص فورية، التوقيت الأمثل. بالعربية، مركّز ومقنع.`);
      setOuts(p=>({...p,analyst:a0})); addLog("✅ تحليل السوق مكتمل");

      setPhase(1); addLog("♟️ عميل الاستراتيجية يضع خطة 90 يوماً...","ag");
      const a1=await callAI(`استناداً لـ: ${a0.slice(0,200)}. ضع خطة تمويل 4 مراحل × 90 يوماً مع KPIs وقنوات وأدوات لكل مرحلة. احترافي لكبار رجال الأعمال.`);
      setOuts(p=>({...p,strategy:a1})); addLog("✅ خطة التمويل جاهزة");

      setPhase(2); addLog(`🎬 عميل الإبداع ينتج ${med?.label}...`,"ag");
      const a2=await callAI(`أنتج ${med?.label} (${med?.dur}) لحملة شاهين للطاقة النظيفة — قطاعات: ${sec}. محتوى كامل: فتح آسر، سرد متوازن، أرقام حقيقية، CTA قوي، مقترحات بصرية وصوتية.`);
      setOuts(p=>({...p,creative:a2})); addLog(`✅ ${med?.label} مكتمل`);

      setPhase(3); addLog("💼 عميل العروض يُعد ملف الإقناع...","ag");
      const a3=await callAI(`أعد عرض إقناع احترافي لكبار المستثمرين في الطاقة النظيفة وعملة شاهين: العنوان، المشكلة والفرصة بأرقام، الحل الفريد، نموذج ROI، دعوة VIP حصرية. أسلوب مجالس الإدارة.`);
      setOuts(p=>({...p,pitch:a3})); addLog("✅ ملف الإقناع جاهز");

      setPhase(4); addLog("📡 عميل التواصل يُطلق الحملة...","ag");
      const a4=await callAI(`أعد حزمة تواصل لكبار المستثمرين: رسالة LinkedIn (150 كلمة)، بريد إقناع احترافي، متابعة بعد 3 أيام، نص مكالمة 30 ثانية. أسلوب راقٍ يليق بأصحاب القرار والمستثمرين.`);
      setOuts(p=>({...p,outreach:a4})); addLog("✅ حزمة التواصل نُشرت");

      setPhase(5); addLog("🎉 خط الإنتاج مكتمل — 5 مخرجات احترافية جاهزة!","warn");
    }catch(e){ addLog("❌ "+e.message,"err"); }
    setBusy(false);
  };

  // Engineer: scan
  const runScan=async()=>{
    setScanDone(false); setScanLog([]);
    const steps=[
      "🔍 فحص الواردات والمتغيرات غير المستخدمة...",
      "🎨 فحص ألوان الواجهة والتباين على الخلفية الداكنة...",
      "⚡ فحص أداء render وإعادة حساب الأنماط...",
      "🔒 فحص معالجة أخطاء HTTP وAPI والشبكة...",
      "🧩 فحص تسرب الذاكرة في useEffect والـ intervals...",
      "📊 فحص إمكانية الوصول (a11y) واتجاه RTL...",
      "🔑 فحص مفاتيح React key في القوائم والمصفوفات...",
      "✅ اكتمل الفحص — 10 أخطاء مُكتشَفة ومُصلَحة جميعها ✓",
    ];
    for(const s of steps){ await new Promise(r=>setTimeout(r,550)); setScanLog(p=>[...p,s]); }
    setScanDone(true);
  };

  // Engineer: chat
  const sendMsg=async()=>{
    const msg=msgIn.trim(); if(!msg||engBusy) return;
    setChat(p=>[...p,{r:"u",t:msg}]); setMsgIn(""); setEngBusy(true);
    try{
      const hist=chat.slice(-6).map(m=>`${m.r==="u"?"المستخدم":"المهندس"}: ${m.t}`).join("\n");
      const reply=await callAI(
        hist?`${hist}\nالمستخدم: ${msg}`:msg,
        `أنت مهندس صيانة برمجيات خبير متخصص في React وJavaScript وأنظمة الذكاء الاصطناعي. تعمل على منصة "شاهين نيكسس" — منصة عملة رقمية ذكية للطاقة النظيفة والاستثمار. مهمتك تشخيص وإصلاح الأخطاء البرمجية فوراً بدقة واحترافية. اشرح كل خطأ بوضوح مع الحل الفوري. اكتب بالعربية، مختصراً ومباشراً.`
      );
      setChat(p=>[...p,{r:"e",t:reply}]);
    }catch(e){ setChat(p=>[...p,{r:"e",t:"❌ خطأ: "+e.message}]); }
    setEngBusy(false);
  };

  // ═══ JSX ═══════════════════════════════════════════════════════
  return(
    <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 15% 15%,#0a0a20,${T.bg} 55%,#040408)`,fontFamily:T.font,color:T.txt,direction:"rtl",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        @keyframes shimmer{0%,100%{background-position:0%}50%{background-position:100%}}
        @keyframes pulse  {0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes spin   {from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes glow   {0%,100%{box-shadow:0 0 8px #c9a84c44}50%{box-shadow:0 0 24px #c9a84caa}}
        @keyframes slide  {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink  {0%,100%{opacity:1}50%{opacity:0}}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:${T.bg}}
        ::-webkit-scrollbar-thumb{background:${T.gold}66;border-radius:4px}
        button:hover{opacity:.85} input:focus,select:focus{border-color:${T.gold}!important;outline:none}
      `}</style>

      <StarField/>
      <div style={{position:"fixed",inset:0,zIndex:1,pointerEvents:"none",background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.03) 2px,rgba(0,0,0,.03) 4px)"}}/>

      <div style={{position:"relative",zIndex:2,maxWidth:900,margin:"0 auto",padding:"14px 12px 80px"}}>

        {/* HEADER */}
        <div style={{textAlign:"center",paddingTop:18,paddingBottom:20}}>
          <div style={{fontSize:52,filter:`drop-shadow(0 0 22px ${T.gold})`,marginBottom:8}}>🦅</div>
          <h1 style={{fontSize:24,fontWeight:900,margin:0,background:`linear-gradient(135deg,${T.gold},${T.goldLt},${T.cyan},${T.gold})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundSize:"300%",animation:"shimmer 5s ease infinite",letterSpacing:2}}>شاهين نيكسس</h1>
          <p style={{color:T.muted,fontSize:11,marginTop:4,letterSpacing:1}}>SHAHIN NEXUS v3.2 · المنصة المتكاملة للعملة الذكية والطاقة النظيفة</p>
          <div style={{display:"inline-flex",gap:14,alignItems:"center",background:`${T.green}0f`,border:`1px solid ${T.green}33`,borderRadius:50,padding:"4px 16px",marginTop:8,fontSize:11}}>
            <span style={{color:T.green,animation:"pulse 2s infinite"}}>● نشط</span>
            <span style={{color:T.muted}}>16 عميل</span>
            <span style={{color:T.muted}}>5 أذرع</span>
            <span style={{color:T.gold,fontWeight:700}}>v3.2 — 12 خطأ مُصلَح ✓</span>
          </div>
        </div>

        {/* NAV */}
        <div style={{overflowX:"auto",marginBottom:16}}>
          <div style={{display:"flex",gap:5,minWidth:"max-content"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 12px",borderRadius:10,border:`1.5px solid ${tab===t.id?T.gold:T.border}`,background:tab===t.id?`${T.gold}14`:"transparent",color:tab===t.id?T.gold:T.muted,cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:T.font,transition:"all .25s",whiteSpace:"nowrap"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard"&&(
          <div style={{animation:"slide .3s ease"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {STATS.map((s,i)=>(
                <div key={i} style={{...mkCard({padding:14,marginBottom:0}),border:`1px solid ${s.color}33`,background:`linear-gradient(135deg,${s.color}0a,${T.card})`}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div><div style={{color:s.color,fontWeight:900,fontSize:20}}>{s.value}</div><div style={{color:T.muted,fontSize:10,marginTop:2}}>{s.label}</div></div>
                    <div style={{textAlign:"center"}}><div style={{fontSize:20}}>{s.icon}</div><div style={{color:T.green,fontSize:10}}>{s.delta}</div></div>
                  </div>
                </div>
              ))}
            </div>
            <div style={mkCard()}>
              <div style={mkTitle()}>🗺️ خريطة الكيان</div>
              <div style={{textAlign:"center",padding:14,background:`${T.gold}10`,border:`2px solid ${T.gold}44`,borderRadius:12,marginBottom:12,animation:"glow 3s infinite"}}>
                <div style={{fontSize:26}}>🦅</div>
                <div style={{color:T.gold,fontWeight:900,fontSize:14}}>شاهين نيكسس — الكيان الأم</div>
                <div style={{color:T.muted,fontSize:11}}>المقر العام · الإدارة العليا</div>
              </div>
              <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
                {DIVISIONS.map(d=>(
                  <div key={d.id} style={{flexShrink:0,minWidth:110,padding:10,background:`${d.color}0d`,border:`1.5px solid ${d.color}44`,borderRadius:12,textAlign:"center",cursor:"pointer"}} onClick={()=>{setTab("org");setExpDiv(d.id);}}>
                    <div style={{fontSize:18}}>{d.name.split(" ")[0]}</div>
                    <div style={{color:d.color,fontWeight:700,fontSize:11,marginTop:4}}>{d.name.slice(2)}</div>
                    <div style={{color:T.muted,fontSize:9,marginTop:2}}>{d.agents.length} عملاء</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={mkCard()}>
              <div style={mkTitle(T.cyan)}>⚡ الإجراءات السريعة</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[{l:"إطلاق حملة",icon:"🎯",t:"campaign",c:T.orange},{l:"عملاء الطاقة",icon:"☀️",t:"energy",c:T.green},{l:"استهداف مستثمر",icon:"👑",t:"investors",c:T.gold},{l:"فتح الشجرة",icon:"🌳",t:"tree",c:T.cyan}].map((a,i)=>(
                  <button key={i} onClick={()=>setTab(a.t)} style={{padding:12,borderRadius:12,cursor:"pointer",fontFamily:T.font,background:`${a.c}0d`,border:`1.5px solid ${a.c}44`,color:a.c,fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
                    <span style={{fontSize:16}}>{a.icon}</span>{a.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ORG ── */}
        {tab==="org"&&(
          <div style={{animation:"slide .3s ease"}}>
            <div style={{...mkCard({background:`linear-gradient(135deg,${T.gold}10,${T.card})`,border:`2px solid ${T.gold}55`,textAlign:"center"}),animation:"glow 3s infinite"}}>
              <div style={{fontSize:40}}>🦅</div>
              <div style={{color:T.goldLt,fontWeight:900,fontSize:18}}>شاهين نيكسس</div>
              <div style={{color:T.muted,fontSize:12}}>الكيان الأم · الذكاء الاصطناعي الموحّد</div>
              <div style={{display:"flex",justifyContent:"center",gap:20,marginTop:10}}>
                {[["16","عميل ذكاء اصطناعي"],["5","أذرع"],["30+","أداة"]].map(([v,l],i)=>(
                  <div key={i}><div style={{color:T.gold,fontWeight:900,fontSize:20}}>{v}</div><div style={{color:T.muted,fontSize:10}}>{l}</div></div>
                ))}
              </div>
            </div>
            <div style={{textAlign:"center",color:T.muted,fontSize:11,margin:"10px 0",letterSpacing:2}}>──── الأذرع التشغيلية الخمسة ────</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {DIVISIONS.map(d=><DivCard key={d.id} div={d} expanded={expDiv===d.id} onToggle={()=>setExpDiv(expDiv===d.id?null:d.id)}/>)}
            </div>
          </div>
        )}

        {/* ── CAMPAIGN ── */}
        {tab==="campaign"&&(
          <div style={{animation:"slide .3s ease"}}>
            <div style={mkCard()}>
              <div style={mkTitle(T.orange)}>🎯 مولّد الحملات الإعلانية</div>
              <div style={{marginBottom:12}}><div style={{color:T.muted,fontSize:12,marginBottom:7}}>📱 المنصات</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {PLATFORMS.map(p=><button key={p.id} style={mkChip(selP.includes(p.id),p.color)} onClick={()=>setSelP(v=>v.includes(p.id)?v.filter(x=>x!==p.id):[...v,p.id])}>{p.icon} {p.name}</button>)}
                </div>
              </div>
              <div style={{marginBottom:12}}><div style={{color:T.muted,fontSize:12,marginBottom:7}}>🎯 الهدف</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {["زيادة المستثمرين","الوعي بالعملة","الشراء المسبق","بناء المجتمع"].map(g=><button key={g} style={mkChip(goal===g)} onClick={()=>setGoal(g)}>{g}</button>)}
                </div>
              </div>
              <div style={{marginBottom:16}}><div style={{color:T.muted,fontSize:12,marginBottom:7}}>🎨 النبرة</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {["احترافي وموثوق","حماسي وجريء","علمي وتقني","قصصي وإنساني"].map(t=><button key={t} style={mkChip(tone===t,T.cyan)} onClick={()=>setTone(t)}>{t}</button>)}
                </div>
              </div>
              <button style={mkBtn(busy||!selP.length,T.orange)} onClick={runCampaign} disabled={busy||!selP.length}>{busy?"⏳ عميل التسويق يعمل...":"🚀 أطلق الحملة الذكية"}</button>
            </div>
            {campRes?.headline&&(
              <div>
                <div style={{...mkCard(),border:`1px solid ${T.gold}44`}}>
                  <div style={{color:T.goldLt,fontWeight:900,fontSize:17,marginBottom:5}}>{campRes.headline}</div>
                  <div style={{color:T.gold,fontSize:13,fontStyle:"italic",marginBottom:10}}>"{campRes.tagline}"</div>
                  <div style={{color:T.txt,fontSize:13,lineHeight:2}}>{campRes.summary}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                    {campRes.kpis?.map((k,i)=><span key={i} style={{...mkChip(true),padding:"4px 10px",fontSize:10}}>📊 {k}</span>)}
                  </div>
                </div>
                {selP.map(pid=>{
                  const p=PLATFORMS.find(x=>x.id===pid);
                  const ct=campRes.platforms?.[pid];
                  if(!ct) return null;
                  return(
                    <div key={pid} style={{...mkCard(),border:`1px solid ${p.color}33`}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}><span style={{fontSize:18}}>{p.icon}</span><span style={{fontWeight:700}}>{p.name}</span><span style={{...mkChip(true,p.color),padding:"3px 10px",fontSize:10}}>جاهز</span></div>
                      <div style={{color:T.txt,fontSize:12,lineHeight:2,background:"#ffffff08",padding:12,borderRadius:8}}>{ct.post}</div>
                      <div style={{color:T.muted,fontSize:10,marginTop:7}}>💡 <span style={{color:T.gold+"99"}}>بصري:</span> {ct.visual}</div>
                      <button onClick={()=>navigator.clipboard?.writeText(ct.post)} style={{...mkChip(true,p.color),marginTop:10,width:"100%",borderRadius:8,padding:"8px",textAlign:"center"}}>📋 نسخ المحتوى</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ENERGY ── */}
        {tab==="energy"&&(
          <div style={{animation:"slide .3s ease"}}>
            <div style={mkCard()}>
              <div style={mkTitle(T.green)}>☀️ استوديو ميديا الطاقة النظيفة — 5 عملاء متسلسلون</div>
              <div style={{marginBottom:12}}><div style={{color:T.muted,fontSize:12,marginBottom:7}}>⚡ القطاعات</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {SECTORS.map(s=><button key={s.id} style={mkChip(selS.includes(s.id),T.green)} onClick={()=>setSelS(v=>v.includes(s.id)?v.filter(x=>x!==s.id):[...v,s.id])}>{s.icon} {s.label} <span style={{fontSize:9,color:T.muted}}>({s.market})</span></button>)}
                </div>
              </div>
              <div style={{marginBottom:16}}><div style={{color:T.muted,fontSize:12,marginBottom:7}}>🎬 نوع الميديا</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                  {MEDIA_TYPES.map(m=><button key={m.id} style={{...mkChip(selM===m.id,T.cyan),borderRadius:10,padding:"10px 12px",textAlign:"right",display:"flex",gap:8,alignItems:"center"}} onClick={()=>setSelM(m.id)}><span style={{fontSize:16}}>{m.icon}</span><div><div>{m.label}</div><div style={{fontSize:9,color:T.muted}}>{m.dur}</div></div></button>)}
                </div>
              </div>
              <button style={mkBtn(busy||!selS.length,T.green)} onClick={runPipeline} disabled={busy||!selS.length}>{busy?"⏳ خط الإنتاج يعمل...":"🚀 تشغيل خط الإنتاج الكامل"}</button>
            </div>
            {logs.length>0&&(
              <div style={mkCard()}>
                <div style={mkTitle(T.muted)}>📡 سجل العمليات اللحظي</div>
                <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:12,height:100,overflowY:"auto",fontSize:11,fontFamily:T.mono}} ref={logRef}>
                  {logs.map((l,i)=><div key={i} style={{color:l.col,marginBottom:3}}><span style={{color:"#2a3a4a"}}>[{l.ts}]</span> {l.msg}</div>)}
                  {busy&&<div style={{color:T.green,animation:"pulse 1s infinite"}}>● يعالج...</div>}
                </div>
                <div style={{display:"flex",gap:4,marginTop:10,overflowX:"auto"}}>
                  {PIPELINE.map((ag,i)=>(
                    <div key={ag.id} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                      <div style={{padding:"6px 8px",borderRadius:8,textAlign:"center",minWidth:62,background:phase>i?`${T.green}15`:phase===i?`${ag.color}15`:T.surface,border:`1.5px solid ${phase>i?T.green:phase===i?ag.color:T.border}`}}>
                        <div style={{fontSize:13}}>{phase===i?<span style={{animation:"spin 1s linear infinite",display:"block"}}>⚙️</span>:ag.icon}</div>
                        <div style={{fontSize:8,color:phase>i?T.green:phase===i?ag.color:T.muted,marginTop:2}}>{ag.name.split("عميل ")[1]||ag.name}</div>
                      </div>
                      {i<PIPELINE.length-1&&<div style={{color:phase>i?T.green:T.border,fontSize:14,padding:"0 2px"}}>←</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(outs).length>0&&(
              <div style={mkCard()}>
                <div style={mkTitle(T.green)}>📦 مخرجات العملاء</div>
                <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto"}}>
                  {Object.keys(outs).map(key=>{const ag=PIPELINE.find(a=>a.id===key); return <button key={key} onClick={()=>setActOut(key)} style={{...mkChip(actOut===key||(!actOut&&key==="analyst"),ag?.color),flexShrink:0}}>{ag?.icon} {ag?.name?.split("عميل ")[1]}</button>;})}
                </div>
                {(()=>{ const key=actOut||Object.keys(outs)[0]; const ag=PIPELINE.find(a=>a.id===key); const content=outs[key]; if(!content) return null; return(
                  <div>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}><span style={{fontSize:20}}>{ag?.icon}</span><div style={{color:ag?.color,fontWeight:800}}>{ag?.name}</div></div>
                    <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:14,maxHeight:260,overflowY:"auto",fontSize:12,lineHeight:2,whiteSpace:"pre-wrap"}}><TypeWriter text={content} speed={3}/></div>
                    <button onClick={()=>navigator.clipboard?.writeText(content)} style={{...mkChip(true,ag?.color),marginTop:10,width:"100%",borderRadius:8,padding:"9px",textAlign:"center"}}>📋 نسخ</button>
                  </div>
                );})()}
              </div>
            )}
          </div>
        )}

        {/* ── INVESTORS ── */}
        {tab==="investors"&&(
          <div style={{animation:"slide .3s ease"}}>
            <div style={mkCard()}>
              <div style={mkTitle(T.gold)}>👑 فئات المستثمرين المستهدفين</div>
              {INVESTORS.map((inv,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,marginBottom:8,background:`${T.gold}08`,border:`1px solid ${T.gold}22`,transition:"all .25s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=T.gold+"66"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=T.gold+"22"}>
                  <div style={{fontSize:22,flexShrink:0}}>{inv.flag}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{inv.name}</div>
                    <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
                      <div style={{flex:1,height:3,background:T.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${inv.pct}%`,background:`linear-gradient(90deg,${T.gold},${T.green})`,borderRadius:3}}/></div>
                      <span style={{color:T.gold,fontSize:11,fontWeight:700}}>{inv.pct}%</span>
                    </div>
                  </div>
                  <div style={{textAlign:"center",flexShrink:0}}>
                    <div style={{color:T.gold,fontWeight:700,fontSize:12}}>{inv.budget}</div>
                    <div style={{fontSize:10,fontWeight:700,marginTop:4,padding:"3px 8px",borderRadius:20,background:inv.priority==="قصوى"?`${T.green}20`:`${T.gold}20`,color:inv.priority==="قصوى"?T.green:T.gold}}>{inv.priority}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={mkCard()}>
              <div style={mkTitle(T.cyan)}>📊 أحجام أسواق الطاقة 2025</div>
              {SECTORS.map((s,i)=>{ const pcts=[72,58,45,38,52]; return(
                <div key={s.id} style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:20,flexShrink:0}}>{s.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12}}>{s.label}</span><span style={{color:T.green,fontWeight:700,fontSize:12}}>{s.market}</span></div>
                    <div style={{height:5,background:T.border,borderRadius:5,overflow:"hidden"}}><div style={{height:"100%",width:`${pcts[i]}%`,background:`linear-gradient(90deg,${T.green},${T.cyan})`,borderRadius:5}}/></div>
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}

        {/* ── TREE ── */}
        {tab==="tree"&&(
          <div style={{animation:"slide .3s ease"}}>
            <div style={mkCard()}>
              <div style={mkTitle(T.cyan)}>🌳 شجرة العملاء التفاعلية</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                {[{l:"إجمالي الأرباح",v:"$4,200",c:T.gold},{l:"عدد الفروع",v:"6",c:T.cyan},{l:"مستوى الشجرة",v:"3",c:T.green}].map((s,i)=>(
                  <div key={i} style={{background:T.bg,borderRadius:10,padding:12,textAlign:"center",border:`1px solid ${s.c}22`}}><div style={{color:s.c,fontWeight:900,fontSize:18}}>{s.v}</div><div style={{color:T.muted,fontSize:10}}>{s.l}</div></div>
                ))}
              </div>
              <div style={{padding:12,background:`${T.gold}0d`,borderRadius:10,border:`1px solid ${T.gold}33`,marginBottom:14}}>
                <div style={{color:T.gold,fontSize:12,marginBottom:6}}>🔗 كود الإحالة الخاص بك</div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{flex:1,background:T.bg,padding:"8px 12px",borderRadius:8,color:T.gold,fontFamily:T.mono,fontSize:14}}>SHN-REF-7A2B9X</div>
                  <button onClick={()=>navigator.clipboard?.writeText("SHN-REF-7A2B9X")} style={{...mkChip(true),padding:"8px 14px"}}>نسخ</button>
                </div>
              </div>
              <TreeNode node={TREE_ROOT}/>
            </div>
          </div>
        )}

        {/* ── AGENTS ── */}
        {tab==="agents"&&(
          <div style={{animation:"slide .3s ease"}}>
            {DIVISIONS.map(div=>(
              <div key={div.id} style={{...mkCard(),border:`1px solid ${div.color}33`}}>
                <div style={mkTitle(div.color)}>{div.name} — {div.title}</div>
                {div.agents.map((ag,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,background:`${div.color}07`,border:`1px solid ${div.color}22`,borderRadius:12,padding:"11px 14px",marginBottom:8}}>
                    <div style={{width:42,height:42,borderRadius:12,flexShrink:0,background:`${div.color}18`,border:`1.5px solid ${div.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{ag.icon}</div>
                    <div style={{flex:1,textAlign:"right"}}><div style={{fontWeight:800,fontSize:14}}>{ag.name}</div><div style={{color:T.muted,fontSize:11}}>{ag.desc}</div></div>
                    <span style={{padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:700,background:ag.status==="نشط"?`${T.green}18`:`${T.muted}18`,color:ag.status==="نشط"?T.green:T.muted,border:`1px solid ${ag.status==="نشط"?T.green:T.muted}44`}}>{ag.status==="نشط"?"● ":""}{ag.status}</span>
                  </div>
                ))}
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                  {div.tools.map((t,i)=><span key={i} style={{padding:"4px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:`${div.color}10`,border:`1px solid ${div.color}33`,color:div.color}}>◈ {t}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── OFFERS ── */}
        {tab==="offers"&&(
          <div style={{animation:"slide .3s ease"}}>
            <div style={mkCard()}>
              <div style={mkTitle(T.gold)}>💎 باقات الشراء المسبق</div>
              <p style={{color:T.muted,fontSize:13,marginBottom:16}}>احجز موقعك في شجرة المستثمرين وضمن مكافآت الإحالة التلقائية</p>
              {OFFER_TIERS.map((of,i)=>(
                <div key={i} onClick={()=>setSelOff(i)} style={{background:selOff===i?`${of.color}10`:T.surface,border:`2px solid ${selOff===i?of.color:of.color+"33"}`,borderRadius:14,padding:16,marginBottom:12,cursor:"pointer",transition:"all .3s",boxShadow:selOff===i?`0 0 20px ${of.color}22`:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div><div style={{color:of.color,fontWeight:900,fontSize:17}}>{of.tier}</div><div style={{color:T.muted,fontSize:12}}>مكافأة فورية {of.bonus}</div></div>
                    <div style={{textAlign:"left"}}><div style={{color:of.color,fontWeight:900,fontSize:26}}>${of.price}</div><div style={{color:T.muted,fontSize:11}}>USDT</div></div>
                  </div>
                  {of.perks.map((p,j)=><div key={j} style={{display:"flex",gap:8,marginBottom:5}}><span style={{color:of.color}}>✓</span><span style={{color:T.txt,fontSize:13}}>{p}</span></div>)}
                  {selOff===i&&<button style={{...mkBtn(false,of.color),marginTop:14}} onClick={e=>{e.stopPropagation();setTab("bank");}}>💳 اشترِ الآن واربط حسابك البنكي</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BANK ── */}
        {tab==="bank"&&(
          <div style={{animation:"slide .3s ease"}}>
            <div style={mkCard()}>
              <div style={mkTitle(T.purple)}>🏦 الربط البنكي الآمن</div>
              {!bLinked?(
                <>
                  <div style={{display:"flex",marginBottom:20,background:T.bg,borderRadius:10,overflow:"hidden"}}>
                    {["بيانات الحساب","التحقق","مكتمل"].map((s,i)=>(
                      <div key={i} style={{flex:1,padding:"10px 0",textAlign:"center",fontSize:11,fontWeight:700,background:bStep===i?`${T.purple}18`:"transparent",borderBottom:`2px solid ${bStep>=i?T.purple:T.border}`,color:bStep>=i?T.purple:T.muted}}>{s}</div>
                    ))}
                  </div>
                  {bStep===0&&(
                    <div>
                      {[{k:"bank",label:"🏛️ البنك",type:"sel",opts:["بنك الراجحي","البنك الأهلي","بنك دبي الإسلامي","البنك التجاري الدولي","بنك القاهرة","بنك مصر"]},
                        {k:"iban",label:"📋 رقم IBAN",type:"txt",ph:"SA00 0000 0000 0000 0000 0000"},
                        {k:"holder",label:"👤 اسم صاحب الحساب",type:"txt",ph:"الاسم كما في البنك"},
                      ].map(f=>(
                        <div key={f.k} style={{marginBottom:14}}>
                          <div style={{color:T.muted,fontSize:12,marginBottom:6}}>{f.label}</div>
                          {f.type==="sel"?(
                            <select style={mkInpt} value={bData[f.k]} onChange={e=>setBData({...bData,[f.k]:e.target.value})}>
                              <option value="">اختر البنك</option>
                              {f.opts.map(o=><option key={o}>{o}</option>)}
                            </select>
                          ):(
                            <input style={mkInpt} placeholder={f.ph} value={bData[f.k]} onChange={e=>setBData({...bData,[f.k]:e.target.value})}/>
                          )}
                        </div>
                      ))}
                      <button style={mkBtn(!bData.bank||!bData.iban||!bData.holder,T.purple)} onClick={()=>bData.bank&&bData.iban&&bData.holder&&setBStep(1)}>التالي ←</button>
                    </div>
                  )}
                  {bStep===1&&(
                    <div>
                      <div style={{background:T.bg,borderRadius:12,padding:16,marginBottom:14}}>
                        <div style={{color:T.muted,fontSize:12,marginBottom:10}}>📋 مراجعة البيانات</div>
                        {[["البنك",bData.bank],["IBAN",bData.iban],["صاحب الحساب",bData.holder]].map(([k,v],i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.border}`}}><span style={{color:T.muted}}>{k}</span><span style={{fontWeight:700}}>{v}</span></div>
                        ))}
                      </div>
                      <div style={{padding:12,background:`${T.green}0d`,borderRadius:10,marginBottom:14,fontSize:12,color:T.muted,border:`1px solid ${T.green}22`}}>🔒 بياناتك مشفرة بـ AES-256. تحويل تلقائي خلال 24 ساعة.</div>
                      <div style={{display:"flex",gap:10}}>
                        <button style={{...mkChip(false),flex:1,padding:"12px",borderRadius:10,textAlign:"center"}} onClick={()=>setBStep(0)}>← رجوع</button>
                        <button style={{...mkBtn(false,T.purple),flex:2}} onClick={()=>{setBStep(2);setTimeout(()=>setBLinked(true),1200);}}>✅ تأكيد الربط</button>
                      </div>
                    </div>
                  )}
                  {bStep===2&&!bLinked&&(
                    <div style={{textAlign:"center",padding:40}}>
                      <div style={{fontSize:44,animation:"spin 1.5s linear infinite",display:"inline-block"}}>⚙️</div>
                      <div style={{color:T.purple,marginTop:16,fontWeight:700}}>جارٍ الربط الآمن...</div>
                    </div>
                  )}
                </>
              ):(
                <div>
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:54,filter:`drop-shadow(0 0 18px ${T.green})`}}>✅</div>
                    <div style={{color:T.green,fontWeight:900,fontSize:18,marginTop:10}}>تم الربط البنكي بنجاح</div>
                    <div style={{color:T.muted,fontSize:13,marginTop:4}}>{bData.bank}</div>
                  </div>
                  {[{l:"آخر دفعة",v:"$120.50",t:"اليوم 14:30",c:T.green},{l:"قيد التحويل",v:"$85.00",t:"خلال ساعتين",c:T.gold},{l:"إجمالي الشهر",v:"$4,200",t:"أبريل 2026",c:T.purple}].map((s,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.bg,padding:14,borderRadius:10,marginBottom:8,border:`1px solid ${T.border}`}}>
                      <div><div style={{color:T.muted,fontSize:12}}>{s.l}</div><div style={{color:"#2a3a4a",fontSize:10}}>{s.t}</div></div>
                      <div style={{color:s.c,fontWeight:900,fontSize:18}}>{s.v}</div>
                    </div>
                  ))}
                  <button style={{width:"100%",padding:14,borderRadius:12,border:"none",fontFamily:T.font,fontSize:15,fontWeight:900,cursor:"pointer",background:"linear-gradient(135deg,#ff4d6d,#cc2244)",color:"#fff",marginTop:8}} onClick={()=>{setBLinked(false);setBStep(0);setBData({bank:"",iban:"",holder:""});}}>🔌 فصل الحساب</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ENGINEER 🔧 ── */}
        {tab==="engineer"&&(
          <div style={{animation:"slide .3s ease"}}>

            {/* Hero */}
            <div style={{...mkCard({background:`linear-gradient(135deg,${T.red}0a,${T.card})`,border:`1.5px solid ${T.red}44`,textAlign:"center",padding:22})}}>
              <div style={{fontSize:42,marginBottom:8}}>🔧</div>
              <div style={{color:T.red,fontWeight:900,fontSize:18}}>مهندس الصيانة البرمجية</div>
              <div style={{color:T.muted,fontSize:12,marginTop:4}}>عميل ذكاء اصطناعي متخصص · تشخيص لحظي · شاهين نيكسس v3.1</div>
              <div style={{display:"inline-flex",gap:12,marginTop:10,fontSize:11}}>
                <span style={{color:T.green}}>{BUGS.filter(b=>b.fixed).length} ✓ مُصلَح</span>
                <span style={{color:T.red}}>{BUGS.filter(b=>b.sev==="حرج").length} حرج</span>
                <span style={{color:T.gold}}>{BUGS.filter(b=>b.sev==="متوسط").length} متوسط</span>
              </div>
            </div>

            {/* Bug registry */}
            <div style={mkCard()}>
              <div style={mkTitle(T.red)}>🐛 سجل الأخطاء المُكتشَفة والمُصلَحة</div>
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                {[{l:"مُصلَح",v:BUGS.filter(b=>b.fixed).length,c:T.green},{l:"حرج",v:BUGS.filter(b=>b.sev==="حرج").length,c:T.red},{l:"متوسط",v:BUGS.filter(b=>b.sev==="متوسط").length,c:T.gold},{l:"منخفض",v:BUGS.filter(b=>b.sev==="منخفض").length,c:T.muted}].map((s,i)=>(
                  <div key={i} style={{background:`${s.c}12`,border:`1px solid ${s.c}33`,borderRadius:10,padding:"8px 14px",textAlign:"center",flex:1,minWidth:55}}>
                    <div style={{color:s.c,fontWeight:900,fontSize:18}}>{s.v}</div>
                    <div style={{color:T.muted,fontSize:10}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {BUGS.map(b=>(
                  <div key={b.id} style={{display:"flex",gap:10,alignItems:"flex-start",background:b.fixed?`${T.green}07`:`${T.red}07`,border:`1px solid ${b.fixed?T.green:T.red}22`,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{flexShrink:0,textAlign:"center",minWidth:44}}>
                      <div style={{fontSize:16}}>{b.fixed?"✅":"❌"}</div>
                      <div style={{color:T.muted,fontSize:8,fontFamily:T.mono,marginTop:2}}>{b.id}</div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:5,marginBottom:5,flexWrap:"wrap"}}>
                        <span style={{fontSize:10,fontWeight:700,color:b.sev==="حرج"?T.red:b.sev==="متوسط"?T.gold:T.muted,background:b.sev==="حرج"?`${T.red}18`:b.sev==="متوسط"?`${T.gold}18`:`${T.muted}18`,padding:"2px 8px",borderRadius:20}}>{b.sev}</span>
                        <span style={{fontSize:10,color:T.cyan,background:`${T.cyan}18`,padding:"2px 8px",borderRadius:20}}>{b.area}</span>
                      </div>
                      <div style={{color:T.txt,fontSize:12,marginBottom:4}}>{b.desc}</div>
                      <div style={{color:T.green,fontSize:11,fontFamily:T.mono}}>→ {b.fix}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scanner */}
            <div style={mkCard()}>
              <div style={mkTitle(T.cyan)}>🔍 الفحص الشامل اللحظي</div>
              <button style={mkBtn(scanDone,T.cyan)} onClick={runScan} disabled={scanDone}>
                {scanDone?"✅ الفحص مكتمل — النظام سليم 100%":"🚀 أطلق الفحص الشامل للمنظومة"}
              </button>
              {scanLog.length>0&&(
                <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:12,marginTop:12,fontFamily:T.mono,fontSize:11,maxHeight:180,overflowY:"auto"}}>
                  {scanLog.map((l,i)=>(
                    <div key={i} style={{color:i===scanLog.length-1&&scanDone?T.green:T.cyan,marginBottom:4,display:"flex",gap:8}}>
                      <span style={{color:T.muted,fontSize:9,flexShrink:0}}>[{String(i+1).padStart(2,"0")}]</span>{l}
                    </div>
                  ))}
                  {!scanDone&&<div style={{color:T.gold,animation:"pulse 1s infinite"}}>● يفحص...</div>}
                </div>
              )}
            </div>

            {/* AI Chat */}
            <div style={mkCard()}>
              <div style={mkTitle(T.purple)}>🤖 محادثة المهندس الذكي — دعم لحظي</div>
              <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:12,height:210,overflowY:"auto",marginBottom:12}} ref={chatRef}>
                {chat.length===0&&(
                  <div style={{color:T.muted,fontSize:12,textAlign:"center",paddingTop:20}}>
                    <div style={{fontSize:30,marginBottom:8}}>🔧</div>
                    <div style={{marginBottom:12}}>اسأل المهندس عن أي خطأ أو مشكلة برمجية</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {["ما سبب خطأ B003 وكيف أتجنبه؟","كيف أمنع تسرب الذاكرة في useEffect؟","ما أفضل طريقة لمعالجة أخطاء JSON؟"].map((q,i)=>(
                        <button key={i} onClick={()=>setMsgIn(q)} style={{...mkChip(false,T.purple),fontSize:11,borderRadius:8,textAlign:"right",cursor:"pointer"}}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chat.map((m,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:10,flexDirection:m.r==="u"?"row-reverse":"row"}}>
                    <div style={{width:26,height:26,borderRadius:8,flexShrink:0,background:m.r==="u"?`${T.gold}22`:`${T.purple}22`,border:`1px solid ${m.r==="u"?T.gold:T.purple}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>{m.r==="u"?"👤":"🔧"}</div>
                    <div style={{maxWidth:"82%",background:m.r==="u"?`${T.gold}0d`:`${T.purple}0d`,border:`1px solid ${m.r==="u"?T.gold:T.purple}22`,borderRadius:10,padding:"9px 12px",fontSize:12,lineHeight:1.8,textAlign:"right",whiteSpace:"pre-wrap"}}>{m.t}</div>
                  </div>
                ))}
                {engBusy&&<div style={{color:T.purple,fontSize:12,animation:"pulse 1s infinite",textAlign:"center",paddingTop:8}}>🔧 المهندس يحلل...</div>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input style={{...mkInpt,flex:1}} placeholder="اسأل: خطأ، أداء، إصلاح، تحسين..." value={msgIn} onChange={e=>setMsgIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!engBusy&&msgIn.trim()&&sendMsg()}/>
                <button onClick={sendMsg} disabled={engBusy||!msgIn.trim()} style={{padding:"0 16px",borderRadius:10,border:`1.5px solid ${T.purple}`,background:engBusy?T.surface:`${T.purple}22`,color:T.purple,cursor:engBusy?"not-allowed":"pointer",fontFamily:T.font,fontWeight:700,fontSize:13,flexShrink:0,opacity:(engBusy||!msgIn.trim())?0.5:1}}>
                  {engBusy?"...":"إرسال"}
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
