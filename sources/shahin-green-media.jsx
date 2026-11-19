import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const AGENTS = [
  { id: "analyst",  name: "عميل الاستهداف",    icon: "🔍", color: "#00ff88", role: "يحلّل سوق المستثمرين ويحدد الأهداف عالية القيمة" },
  { id: "strategy", name: "عميل الاستراتيجية",  icon: "♟️", color: "#00d4ff", role: "يبني خطة تمويل محكمة ومختبرة الأثر" },
  { id: "creative", name: "عميل الإبداع",       icon: "🎬", color: "#ff6b35", role: "يصمم محتوى الميديا والإعلانات الاحترافية" },
  { id: "pitch",    name: "عميل العروض",        icon: "💼", color: "#ffd700", role: "يُعدّ ملفات الإقناع المخصصة لكل مستثمر" },
  { id: "outreach", name: "عميل التواصل",       icon: "📡", color: "#c084fc", role: "يُطلق حملات التواصل المتزامن عبر القنوات" },
];

const SECTORS = [
  { id: "solar",    icon: "☀️",  label: "الطاقة الشمسية",      market: "1.2T$" },
  { id: "wind",     icon: "💨",  label: "طاقة الرياح",         market: "850B$" },
  { id: "recycle",  icon: "♻️",  label: "إعادة التدوير",       market: "420B$" },
  { id: "hydrogen", icon: "⚡",  label: "الهيدروجين الأخضر",   market: "300B$" },
  { id: "biogas",   icon: "🌿",  label: "الغاز الحيوي",        market: "180B$" },
  { id: "storage",  icon: "🔋",  label: "تخزين الطاقة",        market: "650B$" },
];

const MEDIA_TYPES = [
  { id: "video_script", label: "سكريبت فيديو إعلاني",  icon: "🎬", duration: "60 ثانية" },
  { id: "documentary",  label: "وثائقي قصير",            icon: "🎞️", duration: "5 دقائق" },
  { id: "pitch_deck",   label: "عرض تقديمي للمستثمرين", icon: "📊", duration: "15 شريحة" },
  { id: "press",        label: "بيان صحفي رسمي",         icon: "📰", duration: "500 كلمة" },
  { id: "social_pack",  label: "حزمة سوشيال ميديا",      icon: "📱", duration: "7 منشورات" },
  { id: "email",        label: "حملة بريد إلكتروني",     icon: "✉️", duration: "سلسلة 5 رسائل" },
];

const INVESTOR_PROFILES = [
  { name: "صناديق الثروة السيادية", budget: "100M$+", interest: "90%", flag: "🏛️", priority: "عالية جداً" },
  { name: "شركات البترول المتحولة",   budget: "50M$+",  interest: "85%", flag: "🛢️", priority: "عالية" },
  { name: "رجال الأعمال التقنيين",    budget: "10M$+",  interest: "92%", flag: "💻", priority: "عالية جداً" },
  { name: "المستثمرون العقاريون",    budget: "5M$+",   interest: "70%", flag: "🏗️", priority: "متوسطة" },
  { name: "المؤسسات الأكاديمية",     budget: "2M$+",   interest: "95%", flag: "🎓", priority: "عالية" },
  { name: "الشركات العائلية الكبرى", budget: "20M$+",  interest: "78%", flag: "👑", priority: "عالية" },
];

// ─── ANIMATED PARTICLE BACKGROUND ────────────────────────────────────────────
function Particles() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      o: Math.random() * 0.5 + 0.2,
    }));
    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,136,${p.o})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, opacity: 0.35 }} />;
}

// ─── TYPEWRITER ───────────────────────────────────────────────────────────────
function TypeWriter({ text, speed = 12 }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      if (i < text.length) { setShown(text.slice(0, ++i)); }
      else clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text]);
  return <span>{shown}<span style={{ opacity: shown.length < text.length ? 1 : 0 }}>▌</span></span>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function ShahinGreenMedia() {
  const [tab, setTab] = useState("studio");
  const [selectedSectors, setSelectedSectors] = useState(["solar", "recycle"]);
  const [selectedMedia, setSelectedMedia] = useState("video_script");
  const [selectedInvestors, setSelectedInvestors] = useState([0, 2]);
  const [agentPhase, setAgentPhase] = useState(-1); // -1=idle, 0-4=agent index, 5=done
  const [agentOutputs, setAgentOutputs] = useState({});
  const [agentLogs, setAgentLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState(null);
  const [campaignTitle, setCampaignTitle] = useState("مستقبل نظيف — شاهين للطاقة المتجددة");
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [agentLogs]);

  const addLog = (msg, type = "info") => {
    const colors = { info: "#00ff88", warn: "#ffd700", error: "#ff4444", agent: "#00d4ff" };
    setAgentLogs(prev => [...prev, { msg, color: colors[type] || "#00ff88", time: new Date().toLocaleTimeString("ar") }]);
  };

  const callAgent = async (agentId, prompt) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "";
  };

  const runPipeline = async () => {
    setLoading(true);
    setAgentOutputs({});
    setAgentLogs([]);
    setAgentPhase(-1);
    setActiveResult(null);

    const sectors = selectedSectors.map(s => SECTORS.find(x => x.id === s)?.label).join("، ");
    const investors = selectedInvestors.map(i => INVESTOR_PROFILES[i]?.name).join("، ");
    const mediaType = MEDIA_TYPES.find(m => m.id === selectedMedia);

    try {
      // ── Agent 0: Analyst ──
      setAgentPhase(0);
      addLog("🔍 عميل الاستهداف يحلل السوق...", "agent");
      const analystOut = await callAgent("analyst", `أنت عميل ذكاء اصطناعي متخصص في تحليل سوق الطاقة المتجددة لعملة شاهين الرقمية.
حلل هذه القطاعات: ${sectors}
فئات المستثمرين المستهدفين: ${investors}
عنوان الحملة: ${campaignTitle}

أنتج تقرير استهداف موجزاً يشمل:
1. أبرز 3 نقاط ألم لدى هؤلاء المستثمرين
2. أقوى 3 فرص استثمارية فورية
3. التوقيت المثالي للتواصل
4. توقعات العائد والمخاطر

اكتب بالعربية، موجز ومؤثر، بدون ترقيم مفرط.`);
      setAgentOutputs(p => ({ ...p, analyst: analystOut }));
      addLog("✅ اكتمل تحليل السوق", "info");

      // ── Agent 1: Strategy ──
      setAgentPhase(1);
      addLog("♟️ عميل الاستراتيجية يضع الخطة...", "agent");
      const strategyOut = await callAgent("strategy", `أنت عميل استراتيجية تمويل محترف لمشاريع الطاقة النظيفة ضمن عملة شاهين.
بناءً على هذه البيانات:
- القطاعات: ${sectors}
- المستثمرون: ${investors}
- نتائج التحليل: ${analystOut.slice(0, 300)}

ضع خطة تمويل متكاملة بـ 4 مراحل خلال 90 يوماً تشمل:
- الأهداف القابلة للقياس لكل مرحلة
- القنوات والأدوات لكل مرحلة
- مؤشرات النجاح (KPIs)
- خطة احتواء المخاطر

اكتب بالعربية، احترافي ومقنع، مناسب لكبار رجال الأعمال.`);
      setAgentOutputs(p => ({ ...p, strategy: strategyOut }));
      addLog("✅ اكتملت خطة التمويل التسعينية", "info");

      // ── Agent 2: Creative ──
      setAgentPhase(2);
      addLog(`🎬 عميل الإبداع ينتج ${mediaType?.label}...`, "agent");
      const creativeOut = await callAgent("creative", `أنت مخرج إبداعي ومدير محتوى لحملات الطاقة النظيفة والمتجددة.
المطلوب: إنتاج ${mediaType?.label} (${mediaType?.duration})
العنوان: ${campaignTitle}
القطاعات: ${sectors}
الجمهور: ${investors}

أنتج المحتوى الكامل والاحترافي مع:
- المقدمة التي تخطف الانتباه خلال 5 ثوان
- السرد العاطفي والمنطقي المتوازن
- البيانات والأرقام الموثوقة
- النداء للعمل القوي والواضح
- اقتراحات للمؤثرات البصرية والصوتية

اكتب المحتوى كاملاً باللغة العربية، احترافي وجذاب على أعلى مستوى.`);
      setAgentOutputs(p => ({ ...p, creative: creativeOut }));
      addLog(`✅ تم إنتاج ${mediaType?.label} بالكامل`, "info");

      // ── Agent 3: Pitch ──
      setAgentPhase(3);
      addLog("💼 عميل العروض يُعدّ ملفات الإقناع...", "agent");
      const pitchOut = await callAgent("pitch", `أنت خبير عروض استثمار عالمي متخصص في الطاقة النظيفة والعملات الرقمية.
المستثمرون المستهدفون: ${investors}
القطاعات: ${sectors}
الاستراتيجية: ${strategyOut.slice(0, 250)}

أعد عرض إقناع مخصصاً يشمل:
1. العنوان الصاعق المناسب لكبار المستثمرين
2. المشكلة والفرصة (بأرقام عالمية)
3. حل شاهين الفريد وميزته التنافسية
4. نموذج العائد على الاستثمار (ROI)
5. الفريق والشراكات الاستراتيجية
6. دعوة للعمل VIP حصرية

اكتب بأسلوب يناسب مجالس الإدارة والمستثمرين من الطبقة الأولى.`);
      setAgentOutputs(p => ({ ...p, pitch: pitchOut }));
      addLog("✅ تم إعداد ملفات الإقناع المخصصة", "info");

      // ── Agent 4: Outreach ──
      setAgentPhase(4);
      addLog("📡 عميل التواصل يُطلق الحملة...", "agent");
      const outreachOut = await callAgent("outreach", `أنت مدير تواصل استراتيجي محترف لحملات استقطاب المستثمرين.
الهدف: استقطاب تمويل لمشاريع الطاقة النظيفة ضمن عملة شاهين
المستثمرون: ${investors}

أعد حزمة تواصل متكاملة تشمل:
1. رسالة LinkedIn شخصية موجزة (150 كلمة) لكل فئة
2. بريد إلكتروني احترافي للإقناع الأولي
3. رسالة متابعة بعد 3 أيام
4. نص مكالمة هاتفية افتتاحية (30 ثانية)
5. جدول زمني مثالي للتواصل المتسلسل

اكتب بأسلوب راقٍ يليق بمخاطبة أصحاب القرار والمستثمرين الكبار.`);
      setAgentOutputs(p => ({ ...p, outreach: outreachOut }));
      addLog("✅ حزمة التواصل جاهزة للنشر", "info");

      setAgentPhase(5);
      addLog("🎉 اكتملت الحملة الكاملة! 5 وكلاء، مخرجات متكاملة.", "warn");
    } catch (e) {
      addLog("❌ خطأ في المعالجة: " + e.message, "error");
    }

    setLoading(false);
  };

  // ─── STYLES ─────────────────────────────────────────────────────────────────
  const C = {
    bg: "#020c07",
    card: "#071a0f",
    border: "#0d3d1f",
    green: "#00ff88",
    blue: "#00d4ff",
    gold: "#ffd700",
    orange: "#ff6b35",
    purple: "#c084fc",
    text: "#d4e8d4",
    muted: "#5a8a6a",
  };

  const s = {
    app: {
      minHeight: "100vh",
      background: `radial-gradient(ellipse at 20% 20%, #041a0a 0%, ${C.bg} 50%, #020a10 100%)`,
      fontFamily: "'Noto Kufi Arabic', 'Cairo', sans-serif",
      color: C.text,
      direction: "rtl",
      position: "relative",
    },
    inner: { position: "relative", zIndex: 1, padding: 16, maxWidth: 900, margin: "0 auto" },
    header: { textAlign: "center", paddingTop: 24, paddingBottom: 20 },
    heroIcon: {
      display: "flex", justifyContent: "center", gap: 8, fontSize: 32, marginBottom: 12,
      filter: "drop-shadow(0 0 12px #00ff88)",
    },
    title: {
      fontSize: 24, fontWeight: 900, margin: 0,
      background: `linear-gradient(135deg, ${C.green}, ${C.blue}, ${C.gold})`,
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      backgroundSize: "200%", animation: "hgrad 4s ease infinite",
    },
    sub: { color: C.muted, fontSize: 12, marginTop: 6 },
    tabs: { display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 2 },
    tab: (a) => ({
      padding: "9px 18px", borderRadius: 50, border: `1.5px solid ${a ? C.green : C.border}`,
      background: a ? `${C.green}18` : "transparent",
      color: a ? C.green : C.muted,
      cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
      fontFamily: "inherit", transition: "all 0.25s",
    }),
    card: {
      background: `linear-gradient(135deg, ${C.card}, #0a2010)`,
      border: `1px solid ${C.border}`,
      borderRadius: 16, padding: 18, marginBottom: 14,
    },
    secTitle: (color = C.green) => ({
      color, fontSize: 15, fontWeight: 800, marginBottom: 12,
      display: "flex", alignItems: "center", gap: 8,
      borderBottom: `1px solid ${color}22`, paddingBottom: 8,
    }),
    chip: (active, color = C.green) => ({
      padding: "7px 14px", borderRadius: 50, cursor: "pointer", fontSize: 12, fontWeight: 700,
      border: `1.5px solid ${active ? color : C.border}`,
      background: active ? `${color}18` : "transparent",
      color: active ? color : C.muted,
      fontFamily: "inherit", transition: "all 0.2s",
    }),
    bigBtn: (disabled) => ({
      width: "100%", padding: 14, borderRadius: 12, border: "none", fontFamily: "inherit",
      fontSize: 15, fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer",
      background: disabled
        ? "#1a2a1a"
        : `linear-gradient(135deg, ${C.green}, #00b86b)`,
      color: disabled ? C.muted : "#000",
      boxShadow: disabled ? "none" : `0 0 24px ${C.green}44`,
      transition: "all 0.3s",
    }),
    agentRow: (phase, idx) => ({
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 12, marginBottom: 8,
      border: `1.5px solid ${phase === idx ? AGENTS[idx].color : phase > idx ? C.border : C.border}`,
      background: phase === idx ? `${AGENTS[idx].color}0d` : phase > idx ? `${C.green}08` : "transparent",
      transition: "all 0.4s",
    }),
    log: {
      background: "#010d05", border: `1px solid ${C.border}`, borderRadius: 10,
      padding: 12, height: 120, overflowY: "auto",
      fontSize: 11, fontFamily: "monospace",
    },
    resultTab: (a, color = C.green) => ({
      flex: 1, padding: "8px 4px", textAlign: "center", fontSize: 11, fontWeight: 700,
      borderBottom: `2px solid ${a ? color : "transparent"}`,
      color: a ? color : C.muted, cursor: "pointer", background: "transparent",
      border: "none", fontFamily: "inherit", borderBottom: `2px solid ${a ? color : "transparent"}`,
    }),
    resultBox: {
      background: "#010d05", border: `1px solid ${C.border}`, borderRadius: 10,
      padding: 16, maxHeight: 340, overflowY: "auto", fontSize: 13,
      lineHeight: 2, color: C.text, whiteSpace: "pre-wrap",
    },
  };

  const toggleSector = id => setSelectedSectors(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleInvestor = i => setSelectedInvestors(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]);

  return (
    <div style={s.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700;900&display=swap');
        @keyframes hgrad { 0%,100%{background-position:0%} 50%{background-position:100%} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes glow { 0%,100%{box-shadow:0 0 8px #00ff8844} 50%{box-shadow:0 0 24px #00ff88aa} }
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:#010d05}
        ::-webkit-scrollbar-thumb{background:#00ff8866;border-radius:4px}
        textarea:focus,input:focus,select:focus{outline:none}
      `}</style>

      <Particles />

      <div style={s.inner}>
        {/* ── HEADER ── */}
        <div style={s.header}>
          <div style={s.heroIcon}>
            <span>☀️</span><span>♻️</span><span>🦅</span><span>💨</span><span>⚡</span>
          </div>
          <h1 style={s.title}>منصة شاهين للطاقة النظيفة — استوديو الميديا الذكي</h1>
          <p style={s.sub}>5 عملاء ذكاء اصطناعي متخصصون يعملون بالتوازي لاستقطاب كبار المستثمرين</p>
        </div>

        {/* ── TABS ── */}
        <div style={s.tabs}>
          {[
            { id: "studio",    label: "🎬 استوديو الميديا" },
            { id: "agents",    label: "🤖 لوحة العملاء" },
            { id: "investors", label: "👑 المستثمرون" },
            { id: "results",   label: "📦 المخرجات" },
          ].map(t => (
            <button key={t.id} style={s.tab(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB: STUDIO
        ══════════════════════════════════════════════════════ */}
        {tab === "studio" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            {/* Campaign title */}
            <div style={s.card}>
              <div style={s.secTitle()}>✍️ عنوان الحملة</div>
              <input
                value={campaignTitle}
                onChange={e => setCampaignTitle(e.target.value)}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10,
                  background: "#010d05", border: `1.5px solid ${C.border}`,
                  color: C.text, fontSize: 14, fontFamily: "inherit",
                  direction: "rtl", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Sectors */}
            <div style={s.card}>
              <div style={s.secTitle(C.green)}>⚡ قطاعات الطاقة المستهدفة</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SECTORS.map(sec => (
                  <button key={sec.id} style={s.chip(selectedSectors.includes(sec.id))} onClick={() => toggleSector(sec.id)}>
                    {sec.icon} {sec.label}
                    <span style={{ color: C.muted, fontWeight: 400, marginRight: 4, fontSize: 10 }}>({sec.market})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Media type */}
            <div style={s.card}>
              <div style={s.secTitle(C.blue)}>🎬 نوع الميديا المطلوبة</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {MEDIA_TYPES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMedia(m.id)}
                    style={{
                      ...s.chip(selectedMedia === m.id, C.blue),
                      borderRadius: 10, padding: "10px 12px",
                      textAlign: "right", display: "flex", gap: 8, alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: 12 }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{m.duration}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Launch button */}
            <button style={s.bigBtn(loading || selectedSectors.length === 0)} onClick={runPipeline} disabled={loading || selectedSectors.length === 0}>
              {loading
                ? "⏳ العملاء يعملون بالتوازي..."
                : "🚀 أطلق خط الإنتاج الكامل — 5 عملاء ذكاء اصطناعي"}
            </button>

            {/* Log */}
            {agentLogs.length > 0 && (
              <div style={s.card}>
                <div style={s.secTitle(C.muted)}>📡 سجل العمليات المباشر</div>
                <div style={s.log} ref={logRef}>
                  {agentLogs.map((l, i) => (
                    <div key={i} style={{ color: l.color, marginBottom: 4 }}>
                      <span style={{ color: "#2a4a2a" }}>[{l.time}]</span> {l.msg}
                    </div>
                  ))}
                  {loading && (
                    <div style={{ color: C.green, animation: "pulse 1s infinite" }}>● يعالج العميل...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: AGENTS
        ══════════════════════════════════════════════════════ */}
        {tab === "agents" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            <div style={s.card}>
              <div style={s.secTitle()}>🤖 فريق العملاء المتخصصين</div>
              {AGENTS.map((agent, idx) => {
                const done = agentPhase > idx;
                const active = agentPhase === idx;
                const idle = agentPhase < idx;
                return (
                  <div key={agent.id} style={s.agentRow(agentPhase, idx)}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: active ? `${agent.color}22` : done ? `${C.green}11` : "#0a1a0a",
                      border: `2px solid ${active ? agent.color : done ? C.green : C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                      animation: active ? "glow 1.5s infinite" : "none",
                    }}>
                      {active ? <span style={{ animation: "spin 2s linear infinite", display: "block" }}>⚙️</span> : agent.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: active ? agent.color : done ? C.green : C.text }}>
                        {agent.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>{agent.role}</div>
                    </div>
                    <div style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: done ? `${C.green}18` : active ? `${agent.color}18` : "#0a1a0a",
                      border: `1px solid ${done ? C.green : active ? agent.color : C.border}`,
                      color: done ? C.green : active ? agent.color : C.muted,
                    }}>
                      {done ? "✓ مكتمل" : active ? "● يعمل" : "انتظار"}
                    </div>
                  </div>
                );
              })}

              {agentPhase === 5 && (
                <div style={{
                  textAlign: "center", padding: 20,
                  background: `${C.green}0a`, borderRadius: 12,
                  border: `1px solid ${C.green}33`, marginTop: 8,
                }}>
                  <div style={{ fontSize: 36 }}>🎉</div>
                  <div style={{ color: C.green, fontWeight: 900, fontSize: 16, marginTop: 8 }}>
                    اكتمل خط الإنتاج بنجاح!
                  </div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                    5 مخرجات جاهزة — انتقل لتبويب "المخرجات"
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline visual */}
            <div style={s.card}>
              <div style={s.secTitle(C.gold)}>🔄 تدفق خط الإنتاج</div>
              <div style={{ display: "flex", alignItems: "center", overflowX: "auto", gap: 4 }}>
                {AGENTS.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <div style={{
                      padding: "8px 12px", borderRadius: 8, textAlign: "center",
                      background: agentPhase > i ? `${C.green}18` : agentPhase === i ? `${a.color}18` : "#0a1a0a",
                      border: `1px solid ${agentPhase > i ? C.green : agentPhase === i ? a.color : C.border}`,
                      minWidth: 80,
                    }}>
                      <div style={{ fontSize: 16 }}>{a.icon}</div>
                      <div style={{ fontSize: 9, color: agentPhase >= i ? a.color : C.muted, marginTop: 2 }}>
                        {a.name.split("عميل ")[1] || a.name}
                      </div>
                    </div>
                    {i < AGENTS.length - 1 && (
                      <div style={{ color: C.green, fontSize: 16, padding: "0 4px", opacity: agentPhase > i ? 1 : 0.2 }}>←</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: INVESTORS
        ══════════════════════════════════════════════════════ */}
        {tab === "investors" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            <div style={s.card}>
              <div style={s.secTitle(C.gold)}>👑 فئات المستثمرين المستهدفين</div>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>
                اختر الفئات التي تريد من عميل التواصل مخاطبتها بحزمة مخصصة
              </p>
              {INVESTOR_PROFILES.map((inv, i) => (
                <div
                  key={i}
                  onClick={() => toggleInvestor(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 12, marginBottom: 8,
                    border: `1.5px solid ${selectedInvestors.includes(i) ? C.gold : C.border}`,
                    background: selectedInvestors.includes(i) ? `${C.gold}0a` : "transparent",
                    cursor: "pointer", transition: "all 0.25s",
                  }}
                >
                  <div style={{ fontSize: 24, flexShrink: 0 }}>{inv.flag}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{inv.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>حجم استثمار: {inv.budget}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                      background: inv.priority === "عالية جداً" ? `${C.green}22` : `${C.gold}22`,
                      color: inv.priority === "عالية جداً" ? C.green : C.gold,
                      border: `1px solid ${inv.priority === "عالية جداً" ? C.green : C.gold}44`,
                    }}>
                      {inv.priority}
                    </div>
                    <div style={{ color: C.blue, fontSize: 12, fontWeight: 700, marginTop: 4, textAlign: "center" }}>
                      {inv.interest}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sectors market size */}
            <div style={s.card}>
              <div style={s.secTitle(C.green)}>📊 حجم أسواق قطاعات الطاقة 2025</div>
              {SECTORS.map(sec => (
                <div key={sec.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{sec.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: C.text }}>{sec.label}</span>
                      <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{sec.market}</span>
                    </div>
                    <div style={{ height: 4, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        background: `linear-gradient(90deg, ${C.green}, ${C.blue})`,
                        width: `${Math.random() * 40 + 40}%`,
                        transition: "width 1s ease",
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: RESULTS
        ══════════════════════════════════════════════════════ */}
        {tab === "results" && (
          <div style={{ animation: "slideIn .3s ease" }}>
            {Object.keys(agentOutputs).length === 0 ? (
              <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
                <div style={{ color: C.muted, fontSize: 14 }}>
                  لم تُشغَّل الحملة بعد. انتقل لـ "استوديو الميديا" وأطلق خط الإنتاج.
                </div>
              </div>
            ) : (
              <div>
                {/* Result tabs */}
                <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex", overflowX: "auto", background: "#010d05", borderBottom: `1px solid ${C.border}` }}>
                    {Object.keys(agentOutputs).map((key, i) => {
                      const agent = AGENTS.find(a => a.id === key);
                      return (
                        <button key={key} style={s.resultTab(activeResult === key || (activeResult === null && i === 0), agent?.color)}
                          onClick={() => setActiveResult(key)}>
                          {agent?.icon} {agent?.name?.split("عميل ")[1] || agent?.name}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ padding: 16 }}>
                    {(() => {
                      const key = activeResult || Object.keys(agentOutputs)[0];
                      const agent = AGENTS.find(a => a.id === key);
                      const content = agentOutputs[key];
                      if (!content) return null;
                      return (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            <span style={{ fontSize: 22 }}>{agent?.icon}</span>
                            <div>
                              <div style={{ color: agent?.color, fontWeight: 800, fontSize: 15 }}>{agent?.name}</div>
                              <div style={{ color: C.muted, fontSize: 11 }}>{agent?.role}</div>
                            </div>
                          </div>
                          <div style={s.resultBox}>
                            <TypeWriter text={content} speed={4} />
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <button
                              onClick={() => navigator.clipboard?.writeText(content)}
                              style={{
                                ...s.chip(true, agent?.color), padding: "8px 16px", flex: 1,
                                borderRadius: 8, textAlign: "center",
                              }}
                            >
                              📋 نسخ المحتوى
                            </button>
                            <button style={{ ...s.chip(false), padding: "8px 16px", flex: 1, borderRadius: 8, textAlign: "center" }}>
                              💾 حفظ PDF
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Summary stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "عملاء عملوا", value: `${Object.keys(agentOutputs).length}/5`, color: C.green },
                    { label: "الكلمات المنتجة", value: `${Object.values(agentOutputs).join("").length.toLocaleString()}+`, color: C.blue },
                    { label: "جاهزية الحملة", value: `${Math.round(Object.keys(agentOutputs).length / 5 * 100)}%`, color: C.gold },
                  ].map((st, i) => (
                    <div key={i} style={{ ...s.card, textAlign: "center", padding: 14 }}>
                      <div style={{ color: st.color, fontWeight: 900, fontSize: 18 }}>{st.value}</div>
                      <div style={{ color: C.muted, fontSize: 10 }}>{st.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
