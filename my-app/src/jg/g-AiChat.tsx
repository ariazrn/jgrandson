import { useState } from "react";
export function AiChat() {
  const [activePrompt, setActivePrompt] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleOnClick = () => {
    setActivePrompt("ایده‌های استارتاپی");
  };
  const handleOnClick2 = () => {
    setActivePrompt("کامپایلر نیتیو");
  };
  const handleOnClick3 = () => {
    setActivePrompt("نوشتن ابزار");
  };
  const handleOnClick4 = () => {
    setIsTyping(true);
  };

  return (
    <div style={{ minHeight: "100vh", padding: "32px 20px", background: "radial-gradient(circle at 15% 15%, #4f46e5 0%, #1e1b4b 35%, #09090b 100%)", color: "#f8fafc", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
    <header style={{ width: "100%", maxWidth: "900px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", marginBottom: "20px", background: "rgba(255, 255, 255, 0.04)", backdropFilter: "blur(24px)", borderRadius: "20px", border: "1px solid rgba(255, 255, 255, 0.1)", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "linear-gradient(135deg, #a855f7, #6366f1)", boxShadow: "0 0 25px rgba(168, 85, 247, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>
          <span>
            {"✨"}
          </span>
        </div>
        <div>
          <div style={{ fontSize: "18px", fontWeight: "700px", letterSpacing: "-0.02em" }}>
            <span>
              {"JGrandson AI Agent"}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            <span>
              {"Online • JGrandson 1.0 Core"}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ padding: "6px 14px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.12)", fontSize: "13px", fontWeight: "600px", color: "#cbd5e1" }}>
          <span>
            {"LLM / Neural Endpoint"}
          </span>
        </span>
      </div>
    </header>
    <main style={{ width: "100%", maxWidth: "900px", height: "600px", display: "flex", flexDirection: "column", background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(30px)", borderRadius: "28px", border: "1px solid rgba(255, 255, 255, 0.14)", boxShadow: "0 25px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15)", overflow: "hidden" }}>
      <div style={{ flex: "1px", overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "18px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "16px", fontWeight: "700px", color: "#e2e8f0" }}>
            <span>
              {"سلام! چطور می‌تونم کمکت کنم؟"}
            </span>
          </div>
          <div style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.6px" }}>
            <span>
              {"من دستیار هوشمند Nova هستم که مستقیماً روی موتور نیتیو JGrandson اجرا می‌شوم. از ایده‌پردازی گرفته تا کدنویسی، پاسخ‌های سریع و دقیق در اختیارت می‌گذارم."}
            </span>
          </div>
        </div>
        <div style={{ alignSelf: "flex-start", maxWidth: "80%", display: "flex", gap: "12px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "linear-gradient(135deg, #a855f7, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: "0px" }}>
            <span>
              {"🤖"}
            </span>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.12)", backdropFilter: "blur(12px)", borderRadius: "4px 20px 20px 20px", padding: "16px 20px", color: "#f1f5f9", fontSize: "15px", lineHeight: "1.6px", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)" }}>
            <span>
              {"طراحی شیشه‌ای مدرن (Glassmorphism) به همراه نورپردازی ملایم نئونی برای رابط کاربری پیاده‌سازی شده است. آماده دریافت سوال شما هستم!"}
            </span>
          </div>
        </div>
        <div style={{ alignSelf: "flex-end", maxWidth: "75%", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.85), rgba(168, 85, 247, 0.85))", border: "1px solid rgba(255, 255, 255, 0.25)", backdropFilter: "blur(16px)", borderRadius: "20px 20px 4px 20px", padding: "14px 20px", color: "#ffffff", fontSize: "15px", lineHeight: "1.5px", boxShadow: "0 10px 25px rgba(99, 102, 241, 0.35)" }}>
          <span>
            {"یک الگوریتم مرتب‌سازی سریع در زبان جدید JGrandson چطور تعریف می‌شود؟"}
          </span>
        </div>
      </div>
      <div style={{ padding: "0 24px 14px", display: "flex", gap: "10px", overflowX: "auto" }}>
        <button style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "20px", padding: "8px 16px", color: "#cbd5e1", fontSize: "13px", cursor: "pointer", backdropFilter: "blur(8px)", whiteSpace: "nowrap" }} onClick={handleOnClick}>
          {"💡 ایده‌های استارتاپی ۲۰۲۶"}
        </button>
        <button style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "20px", padding: "8px 16px", color: "#cbd5e1", fontSize: "13px", cursor: "pointer", backdropFilter: "blur(8px)", whiteSpace: "nowrap" }} onClick={handleOnClick2}>
          {"⚡ توضیح کامپایلر نیتیو"}
        </button>
        <button style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "20px", padding: "8px 16px", color: "#cbd5e1", fontSize: "13px", cursor: "pointer", backdropFilter: "blur(8px)", whiteSpace: "nowrap" }} onClick={handleOnClick3}>
          {"🛠 نوشتن ابزار با JGrandson"}
        </button>
      </div>
      <div style={{ padding: "16px 24px", background: "rgba(0, 0, 0, 0.25)", borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", alignItems: "center", gap: "14px" }}>
        <input style={{ flex: "1px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "16px", padding: "14px 20px", color: "#ffffff", fontSize: "15px", outline: "none" }} placeholder={"پیامی برای Nova بنویسید..."} />
        <button style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", borderRadius: "16px", padding: "14px 24px", color: "#ffffff", fontWeight: "600px", fontSize: "15px", cursor: "pointer", boxShadow: "0 0 20px rgba(99, 102, 241, 0.4)", display: "flex", alignItems: "center", gap: "8px" }} onClick={handleOnClick4}>
          {"ارسال 🚀"}
        </button>
      </div>
    </main>
    </div>
  );
}
