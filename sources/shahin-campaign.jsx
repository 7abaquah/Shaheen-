import { useState, useEffect, useRef } from "react";

const TABS = [
  { id: "campaign", label: "🎯 الحملة الإعلانية", icon: "🎯" },
  { id: "offers", label: "💎 العروض المسبقة", icon: "💎" },
  { id: "tree", label: "🌳 شجرة العملاء", icon: "🌳" },
  { id: "bank", label: "🏦 الربط البنكي", icon: "🏦" },
];

const PLATFORMS = [
  { id: "twitter", name: "X / تويتر", icon: "𝕏", color: "#1a1a1a" },
  { id: "instagram", name: "إنستغرام", icon: "📸", color: "#C13584" },
  { id: "telegram", name: "تيليغرام", icon: "✈️", color: "#2CA5E0" },
  { id: "youtube", name: "يوتيوب", icon: "▶️", color: "#FF0000" },
  { id: "tiktok", name: "تيك توك", icon: "🎵", color: "#010101" },
  { id: "email", name: "البريد الإلكتروني", icon: "📧", color: "#D44638" },
];

const OFFER_TEMPLATES = [
  { tier: "ذهبي", price: 500, bonus: "20%", perks: ["أولوية الإطلاق", "مكافأة إحالة 15%", "دخول VIP"], color: "#FFD700" },
  { tier: "فضي", price: 200, bonus: "12%", perks: ["مكافأة إحالة 10%", "تنبيهات حصرية"], color: "#C0C0C0" },
  { tier: "برونزي", price: 50, bonus: "6%", perks: ["مكافأة إحالة 5%", "دخول مبكر"], color: "#CD7F32" },
];

const TREE_DATA = {
  name: "أنت",
  code: "SHN-001",
  earnings: 4200,
  children: [
    {
      name: "أحمد ع.", code: "SHN-002", earnings: 1800,
      children: [
        { name: "سارة م.", code: "SHN-005", earnings: 420, children: [] },
        { name: "خالد ر.", code: "SHN-006", earnings: 380, children: [] },
      ]
    },
    {
      name: "فاطمة ح.", code: "SHN-003", earnings: 950,
      children: [
        { name: "يوسف ب.", code: "SHN-007", earnings: 210, children: [] },
      ]
    },
    {
      name: "محمد ط.", code: "SHN-004", earnings: 630,
      children: []
    }
  ]
};

function TreeNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const colors = ["#FFD700", "#C0C0C0", "#CD7F32", "#4ecdc4"];
  const color = colors[depth % colors.length];

  return (
    <div style={{ marginRight: depth > 0 ? 24 : 0, marginTop: depth > 0 ? 8 : 0 }}>
      <div
        onClick={() => node.children.length > 0 && setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          background: `linear-gradient(135deg, ${color}18, transparent)`,
          border: `1px solid ${color}44`,
          borderRadius: 12, padding: "10px 16px", cursor: "pointer",
          transition: "all 0.3s", marginBottom: 4,
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = color}
        onMouseLeave={e => e.currentTarget.style.borderColor = `${color}44`}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{node.name}</div>
          <div style={{ color: "#aaa", fontSize: 11 }}>{node.code}</div>
        </div>
        <div style={{ color: color, fontWeight: 700, fontSize: 14 }}>{node.earnings.toLocaleString()} $</div>
        {node.children.length > 0 && (
          <div style={{ color: color, fontSize: 16 }}>{expanded ? "▼" : "◀"}</div>
        )}
      </div>
      {expanded && node.children.length > 0 && (
        <div style={{ borderRight: `2px solid ${color}33`, paddingRight: 12 }}>
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShahinCampaign() {
  const [activeTab, setActiveTab] = useState("campaign");
  const [selectedPlatforms, setSelectedPlatforms] = useState(["twitter", "telegram"]);
  const [campaignGoal, setCampaignGoal] = useState("زيادة المستثمرين");
  const [tone, setTone] = useState("احترافي وموثوق");
  const [generatedContent, setGeneratedContent] = useState({});
  const [loading, setLoading] = useState(false);
  const [bankLinked, setBankLinked] = useState(false);
  const [bankStep, setBankStep] = useState(0);
  const [bankData, setBankData] = useState({ iban: "", bankName: "", holder: "" });
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [agentLog, setAgentLog] = useState([]);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [agentLog]);

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const addLog = (msg) => {
    setAgentLog(prev => [...prev, { time: new Date().toLocaleTimeString("ar"), msg }]);
  };

  const generateCampaign = async () => {
    if (selectedPlatforms.length === 0) return;
    setLoading(true);
    setGeneratedContent({});
    setAgentLog([]);

    const platformNames = selectedPlatforms.map(id => PLATFORMS.find(p => p.id === id)?.name).join(" و ");
    addLog(`🚀 بدء تشغيل عميل التسويق الذكي لشاهين...`);
    addLog(`📊 تحليل المنصات: ${platformNames}`);
    addLog(`🎯 الهدف: ${campaignGoal} | النبرة: ${tone}`);
    addLog(`⚙️ توليد المحتوى الإعلاني المتكامل...`);

    const prompt = `أنت عميل تسويق ذكاء اصطناعي متخصص في العملات الرقمية. قم بإنشاء حملة إعلانية متكاملة وجذابة لعملة "شاهين" الرقمية الذكية.

المعلومات:
- هدف الحملة: ${campaignGoal}
- النبرة المطلوبة: ${tone}
- المنصات المستهدفة: ${platformNames}

أنشئ محتوى إعلانياً احترافياً لكل منصة مذكورة. رد بـ JSON فقط بهذا الشكل:
{
  "headline": "العنوان الرئيسي للحملة",
  "tagline": "الشعار الإعلاني",
  "summary": "ملخص الحملة الاستراتيجية في 3 جمل",
  "platforms": {
    ${selectedPlatforms.map(id => {
      const p = PLATFORMS.find(pl => pl.id === id);
      return `"${id}": { "post": "نص المنشور المتكيف مع ${p?.name} (150-200 كلمة)، مع هاشتاقات وCTA", "visual_idea": "فكرة التصميم المرئي" }`;
    }).join(",\n    ")}
  },
  "cta": "نداء للعمل الرئيسي",
  "kpis": ["مقياس 1", "مقياس 2", "مقياس 3"]
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setGeneratedContent(parsed);
      addLog(`✅ تم توليد ${selectedPlatforms.length} منشورات إعلانية`);
      addLog(`📈 تم تحليل ${parsed.kpis?.length || 0} مؤشرات أداء رئيسية`);
      addLog(`🎉 الحملة جاهزة للنشر!`);
    } catch (e) {
      addLog("❌ خطأ في توليد المحتوى، حاول مرة أخرى");
    }
    setLoading(false);
  };

  const styles = {
    app: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #0a0a0f 100%)",
      fontFamily: "'Cairo', 'Tajawal', sans-serif",
      color: "#fff",
      direction: "rtl",
      padding: 16,
    },
    header: {
      textAlign: "center",
      marginBottom: 24,
      position: "relative",
      overflow: "hidden",
    },
    logo: {
      fontSize: 52,
      filter: "drop-shadow(0 0 20px #FFD700)",
      display: "block",
      marginBottom: 4,
    },
    title: {
      fontSize: 28,
      fontWeight: 900,
      background: "linear-gradient(90deg, #FFD700, #FFA500, #FFD700)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundSize: "200%",
      animation: "shimmer 2s infinite",
      margin: 0,
    },
    subtitle: { color: "#888", fontSize: 13, marginTop: 4 },
    tabs: {
      display: "flex",
      gap: 8,
      marginBottom: 20,
      overflowX: "auto",
      paddingBottom: 4,
    },
    tab: (active) => ({
      padding: "10px 18px",
      borderRadius: 50,
      border: `1.5px solid ${active ? "#FFD700" : "#333"}`,
      background: active ? "linear-gradient(135deg, #FFD700, #FFA500)" : "transparent",
      color: active ? "#000" : "#aaa",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 13,
      whiteSpace: "nowrap",
      transition: "all 0.3s",
      fontFamily: "inherit",
    }),
    card: {
      background: "linear-gradient(135deg, #141420, #1a1a2e)",
      border: "1px solid #2a2a3e",
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    },
    sectionTitle: {
      color: "#FFD700",
      fontSize: 16,
      fontWeight: 700,
      marginBottom: 12,
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    btn: (active, color = "#FFD700") => ({
      padding: "8px 16px",
      borderRadius: 8,
      border: `1.5px solid ${active ? color : "#333"}`,
      background: active ? `${color}22` : "transparent",
      color: active ? color : "#777",
      cursor: "pointer",
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "inherit",
      transition: "all 0.2s",
    }),
    primaryBtn: {
      width: "100%",
      padding: "14px",
      borderRadius: 12,
      border: "none",
      background: loading ? "#333" : "linear-gradient(135deg, #FFD700, #FFA500)",
      color: loading ? "#666" : "#000",
      fontSize: 15,
      fontWeight: 800,
      cursor: loading ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      transition: "all 0.3s",
    },
    input: {
      width: "100%",
      padding: "12px",
      borderRadius: 10,
      border: "1.5px solid #2a2a3e",
      background: "#0d0d1a",
      color: "#fff",
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box",
      direction: "rtl",
      transition: "border-color 0.2s",
    },
    label: { color: "#aaa", fontSize: 12, marginBottom: 6, display: "block" },
    log: {
      background: "#050510",
      border: "1px solid #1a1a2e",
      borderRadius: 10,
      padding: 12,
      height: 110,
      overflowY: "auto",
      fontSize: 12,
      fontFamily: "monospace",
    },
    resultCard: {
      background: "linear-gradient(135deg, #0d0d1a, #141420)",
      border: "1px solid #FFD70033",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    badge: (color) => ({
      display: "inline-block",
      background: `${color}22`,
      border: `1px solid ${color}66`,
      borderRadius: 20,
      padding: "2px 10px",
      fontSize: 11,
      color: color,
      fontWeight: 700,
    }),
  };

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        @keyframes shimmer { 0%,100%{background-position:0%} 50%{background-position:100%} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #FFD70066; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>🦅</span>
        <h1 style={styles.title}>عميل شاهين الإعلاني</h1>
        <p style={styles.subtitle}>ذكاء اصطناعي متخصص في حملات العملات الرقمية</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map(tab => (
          <button key={tab.id} style={styles.tab(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====== CAMPAIGN TAB ====== */}
      {activeTab === "campaign" && (
        <div>
          <div style={styles.card}>
            <div style={styles.sectionTitle}>🎯 إعدادات الحملة</div>

            <div style={{ marginBottom: 14 }}>
              <label style={styles.label}>📱 اختر المنصات</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PLATFORMS.map(p => (
                  <button key={p.id}
                    style={styles.btn(selectedPlatforms.includes(p.id), p.color)}
                    onClick={() => togglePlatform(p.id)}
                  >
                    {p.icon} {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={styles.label}>🎯 هدف الحملة</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["زيادة المستثمرين", "الوعي بالعملة", "الشراء المسبق", "بناء المجتمع"].map(g => (
                  <button key={g} style={styles.btn(campaignGoal === g)} onClick={() => setCampaignGoal(g)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>🎨 نبرة الإعلان</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["احترافي وموثوق", "حماسي وجريء", "علمي وتقني", "قصصي وإنساني"].map(t => (
                  <button key={t} style={styles.btn(tone === t)} onClick={() => setTone(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button style={styles.primaryBtn} onClick={generateCampaign} disabled={loading}>
              {loading ? "⏳ العميل يعمل..." : "🚀 أطلق الحملة الذكية"}
            </button>
          </div>

          {/* Agent Log */}
          {agentLog.length > 0 && (
            <div style={styles.card}>
              <div style={styles.sectionTitle}>🤖 سجل العميل الذكي</div>
              <div style={styles.log} ref={logRef}>
                {agentLog.map((l, i) => (
                  <div key={i} style={{ color: "#4ecdc4", marginBottom: 4 }}>
                    <span style={{ color: "#555" }}>[{l.time}]</span> {l.msg}
                  </div>
                ))}
                {loading && <div style={{ color: "#FFD700", animation: "pulse 1s infinite" }}>● يعالج...</div>}
              </div>
            </div>
          )}

          {/* Results */}
          {generatedContent.headline && (
            <div>
              <div style={{ ...styles.card, border: "1px solid #FFD70055" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#FFD700", marginBottom: 6 }}>
                  {generatedContent.headline}
                </div>
                <div style={{ color: "#FFA500", fontSize: 14, marginBottom: 10 }}>
                  "{generatedContent.tagline}"
                </div>
                <div style={{ color: "#ccc", fontSize: 13, lineHeight: 1.8 }}>
                  {generatedContent.summary}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {generatedContent.kpis?.map((k, i) => (
                    <span key={i} style={styles.badge("#FFD700")}>📊 {k}</span>
                  ))}
                </div>
              </div>

              {selectedPlatforms.map(pid => {
                const p = PLATFORMS.find(pl => pl.id === pid);
                const content = generatedContent.platforms?.[pid];
                if (!content) return null;
                return (
                  <div key={pid} style={styles.resultCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 20 }}>{p.icon}</span>
                      <span style={{ fontWeight: 700, color: "#fff" }}>{p.name}</span>
                      <span style={styles.badge(p.color || "#4ecdc4")}>محتوى جاهز</span>
                    </div>
                    <div style={{ color: "#ddd", fontSize: 13, lineHeight: 1.9, marginBottom: 10, background: "#ffffff08", padding: 12, borderRadius: 8 }}>
                      {content.post}
                    </div>
                    <div style={{ color: "#777", fontSize: 11 }}>
                      💡 <strong style={{ color: "#FFD70099" }}>فكرة بصرية:</strong> {content.visual_idea}
                    </div>
                    <button style={{ ...styles.btn(true, p.color || "#4ecdc4"), marginTop: 10, width: "100%" }}>
                      📋 نسخ المحتوى
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====== OFFERS TAB ====== */}
      {activeTab === "offers" && (
        <div>
          <div style={styles.card}>
            <div style={styles.sectionTitle}>💎 عروض الشراء المسبق</div>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
              احجز موقعك في شجرة المستثمرين وضمن مكافآت الإحالة التلقائية
            </p>
            {OFFER_TEMPLATES.map((offer, i) => (
              <div key={i}
                onClick={() => setSelectedOffer(i)}
                style={{
                  background: selectedOffer === i ? `${offer.color}18` : "#0d0d1a",
                  border: `2px solid ${selectedOffer === i ? offer.color : offer.color + "33"}`,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ color: offer.color, fontWeight: 900, fontSize: 18 }}>
                      الباقة {offer.tier}
                    </div>
                    <div style={{ color: "#aaa", fontSize: 12 }}>مكافأة فورية {offer.bonus}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ color: offer.color, fontWeight: 900, fontSize: 24 }}>${offer.price}</div>
                    <div style={{ color: "#555", fontSize: 11 }}>USDT</div>
                  </div>
                </div>
                {offer.perks.map((p, j) => (
                  <div key={j} style={{ color: "#ccc", fontSize: 12, marginBottom: 4 }}>
                    ✓ {p}
                  </div>
                ))}
                {selectedOffer === i && (
                  <button style={{ ...styles.primaryBtn, marginTop: 12, background: `linear-gradient(135deg, ${offer.color}, ${offer.color}99)` }}
                    onClick={(e) => { e.stopPropagation(); setActiveTab("bank"); }}>
                    💳 اشترِ الآن وارتبط بحسابك البنكي
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>🔗 آلية شجرة العملاء</div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { icon: "1️⃣", text: "تشتري الباقة وتحصل على كود إحالة فريد" },
                { icon: "2️⃣", text: "تشارك كودك مع أصدقائك ومعارفك" },
                { icon: "3️⃣", text: "كل من ينضم عبر كودك يصبح فرعاً في شجرتك" },
                { icon: "4️⃣", text: "تحصل على عمولة تلقائية من كل عملية في شجرتك" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px", background: "#ffffff05", borderRadius: 10 }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ color: "#ccc", fontSize: 13 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====== TREE TAB ====== */}
      {activeTab === "tree" && (
        <div>
          <div style={styles.card}>
            <div style={styles.sectionTitle}>🌳 شجرة عملائي</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "إجمالي الأرباح", value: "$4,200", color: "#FFD700" },
                { label: "عدد الأفرع", value: "6", color: "#4ecdc4" },
                { label: "مستوى الشجرة", value: "3", color: "#C0C0C0" },
              ].map((s, i) => (
                <div key={i} style={{ background: "#0d0d1a", borderRadius: 10, padding: 12, textAlign: "center" }}>
                  <div style={{ color: s.color, fontWeight: 900, fontSize: 18 }}>{s.value}</div>
                  <div style={{ color: "#666", fontSize: 11 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12, padding: 12, background: "#FFD70011", borderRadius: 10, border: "1px solid #FFD70033" }}>
              <div style={{ color: "#FFD700", fontSize: 12, marginBottom: 4 }}>🔗 كود الإحالة الخاص بك</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, background: "#000", padding: "8px 12px", borderRadius: 8, color: "#FFD700", fontFamily: "monospace", fontSize: 14 }}>
                  SHN-REF-7A2B9X
                </div>
                <button style={{ ...styles.btn(true), padding: "8px 12px" }}>نسخ</button>
              </div>
            </div>

            <TreeNode node={TREE_DATA} depth={0} />
          </div>
        </div>
      )}

      {/* ====== BANK TAB ====== */}
      {activeTab === "bank" && (
        <div>
          {!bankLinked ? (
            <div style={styles.card}>
              <div style={styles.sectionTitle}>🏦 ربط الحساب البنكي</div>

              <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "#0d0d1a", borderRadius: 10, overflow: "hidden" }}>
                {["بيانات الحساب", "التحقق", "تم الربط"].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, padding: "10px 0", textAlign: "center",
                    background: bankStep === i ? "#FFD70022" : "transparent",
                    borderBottom: `2px solid ${bankStep >= i ? "#FFD700" : "#333"}`,
                    color: bankStep >= i ? "#FFD700" : "#555",
                    fontSize: 12, fontWeight: 700
                  }}>{s}</div>
                ))}
              </div>

              {bankStep === 0 && (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={styles.label}>🏛️ اسم البنك</label>
                    <select style={{ ...styles.input }} value={bankData.bankName}
                      onChange={e => setBankData({ ...bankData, bankName: e.target.value })}>
                      <option value="">اختر البنك</option>
                      <option>بنك الراجحي</option>
                      <option>البنك الأهلي</option>
                      <option>بنك الإمارات دبي الوطني</option>
                      <option>بنك القاهرة</option>
                      <option>البنك التجاري الدولي</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={styles.label}>📋 رقم IBAN</label>
                    <input style={styles.input} placeholder="SA00 0000 0000 0000 0000 0000"
                      value={bankData.iban} onChange={e => setBankData({ ...bankData, iban: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={styles.label}>👤 اسم صاحب الحساب</label>
                    <input style={styles.input} placeholder="الاسم كما في البنك"
                      value={bankData.holder} onChange={e => setBankData({ ...bankData, holder: e.target.value })} />
                  </div>
                  <button style={styles.primaryBtn}
                    onClick={() => bankData.bankName && bankData.iban && bankData.holder && setBankStep(1)}>
                    التالي ←
                  </button>
                </div>
              )}

              {bankStep === 1 && (
                <div>
                  <div style={{ padding: 16, background: "#0d0d1a", borderRadius: 12, marginBottom: 16 }}>
                    <div style={{ color: "#aaa", fontSize: 12, marginBottom: 8 }}>📋 مراجعة البيانات</div>
                    {[
                      ["البنك", bankData.bankName],
                      ["IBAN", bankData.iban || "SA00 0000 0000 0000 0000 0000"],
                      ["صاحب الحساب", bankData.holder],
                    ].map(([k, v], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a2e" }}>
                        <span style={{ color: "#666" }}>{k}</span>
                        <span style={{ color: "#fff", fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 12, background: "#FFD70011", borderRadius: 10, marginBottom: 16, fontSize: 12, color: "#aaa" }}>
                    🔒 بياناتك مشفرة بالكامل. ستصل مدفوعاتك تلقائياً خلال 24 ساعة.
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={{ ...styles.btn(false), flex: 1 }} onClick={() => setBankStep(0)}>← رجوع</button>
                    <button style={{ ...styles.primaryBtn, flex: 2 }} onClick={() => { setBankStep(2); setTimeout(() => setBankLinked(true), 800); }}>
                      ✅ تأكيد الربط
                    </button>
                  </div>
                </div>
              )}

              {bankStep === 2 && !bankLinked && (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: 40, animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</div>
                  <div style={{ color: "#FFD700", marginTop: 16 }}>جارٍ ربط الحساب...</div>
                </div>
              )}
            </div>
          ) : (
            <div style={styles.card}>
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 60 }}>✅</div>
                <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 20, marginTop: 12 }}>
                  تم ربط الحساب البنكي
                </div>
                <div style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>{bankData.bankName}</div>
                <div style={{ color: "#666", fontSize: 12 }}>ستصل مدفوعاتك تلقائياً مع كل عملية</div>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                {[
                  { label: "آخر دفعة", value: "$120.50", date: "اليوم 14:30", color: "#4ecdc4" },
                  { label: "قيد التحويل", value: "$85.00", date: "خلال 2 ساعة", color: "#FFD700" },
                  { label: "إجمالي هذا الشهر", value: "$4,200.00", date: "أبريل 2026", color: "#C0C0C0" },
                ].map((t, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d0d1a", padding: 14, borderRadius: 10 }}>
                    <div>
                      <div style={{ color: "#aaa", fontSize: 12 }}>{t.label}</div>
                      <div style={{ color: "#555", fontSize: 11 }}>{t.date}</div>
                    </div>
                    <div style={{ color: t.color, fontWeight: 900, fontSize: 18 }}>{t.value}</div>
                  </div>
                ))}
              </div>

              <button style={{ ...styles.primaryBtn, marginTop: 16, background: "linear-gradient(135deg, #ff4444, #cc0000)" }}
                onClick={() => { setBankLinked(false); setBankStep(0); setBankData({ iban: "", bankName: "", holder: "" }); }}>
                🔌 فصل الحساب
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
