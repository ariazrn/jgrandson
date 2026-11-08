import { useState } from "react";
export function Landing() {
  const [started, setStarted] = useState(false);

  const handleOnClick = () => {
    setStarted(true);
  };

  return (
    <div style={{ minHeight: "100vh", padding: "28px 6vw 72px", background: "radial-gradient(circle at 12% 10%, #243b6b 0%, #10182e 38%, #070b16 100%)", color: "#f8fafc", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
    <nav style={{ maxWidth: "1180px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "20px", fontWeight: "800px", letterSpacing: "-0.03em" }}>
        <span style={{ width: "38px", height: "38px", display: "grid", placeItems: "center", borderRadius: "12px", background: "linear-gradient(135deg, #7c3aed, #22d3ee)", boxShadow: "0 10px 30px rgba(34, 211, 238, 0.25)" }}>
          {"JG"}
        </span>
        <span>
          {"JGrandson"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <a href={"#features"} style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: "600px" }}>
          {"Features"}
        </a>
        <a href={"#start"} style={{ color: "#07111f", background: "#f8fafc", textDecoration: "none", fontWeight: "800px", padding: "11px 18px", borderRadius: "999px" }}>
          {"Start building"}
        </a>
      </div>
    </nav>
    <main style={{ maxWidth: "1180px", margin: "0 auto" }}>
      <section style={{ minHeight: "68vh", display: "grid", gridTemplateColumns: "1.12fr 0.88fr", alignItems: "center", gap: "64px" }}>
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "8px 13px", marginBottom: "24px", border: "1px solid rgba(125, 211, 252, 0.28)", borderRadius: "999px", background: "rgba(14, 165, 233, 0.08)", color: "#7dd3fc", fontSize: "13px", fontWeight: "800px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {"A simpler way to build interfaces"}
          </span>
          <h1 style={{ maxWidth: "720px", margin: "0 0 24px", fontSize: "clamp(52px, 7vw, 88px)", lineHeight: "0.98", letterSpacing: "-0.065em", background: "linear-gradient(110deg, #ffffff 20%, #a5b4fc 58%, #67e8f9)", backgroundClip: "text", color: "transparent" }}>
            {"Ideas to interfaces, beautifully fast."}
          </h1>
          <p style={{ maxWidth: "610px", margin: "0 0 34px", color: "#aebbd0", fontSize: "19px", lineHeight: "1.75" }}>
            {"JGrandson is a clear, expressive language for creating modern web experiences without drowning in framework code."}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button id={"start"} style={{ border: "0", padding: "15px 24px", borderRadius: "14px", background: "linear-gradient(135deg, #8b5cf6, #06b6d4)", color: "white", fontSize: "16px", fontWeight: "800px", cursor: "pointer", boxShadow: "0 16px 42px rgba(99, 102, 241, 0.35)" }} onClick={handleOnClick}>
              {"Create something great"}
            </button>
            <a href={"#features"} style={{ padding: "14px 20px", color: "#dbeafe", textDecoration: "none", fontWeight: "700px" }}>
              {"Explore the language →"}
            </a>
          </div>
        {started ? (
          <p style={{ marginTop: "20px", color: "#67e8f9", fontWeight: "700px" }}>
            {"Your next idea starts in a .jg file."}
          </p>
        ) : (
          null
        )}
        </div>
        <aside style={{ position: "relative", padding: "1px", borderRadius: "24px", background: "linear-gradient(145deg, rgba(167, 139, 250, 0.8), rgba(34, 211, 238, 0.25), rgba(255,255,255,0.08))", boxShadow: "0 40px 100px rgba(0, 0, 0, 0.48)" }}>
          <div style={{ padding: "18px 20px 24px", borderRadius: "23px", background: "rgba(8, 14, 30, 0.94)", backdropFilter: "blur(22px)" }}>
            <div style={{ display: "flex", gap: "8px", paddingBottom: "18px", borderBottom: "1px solid rgba(148, 163, 184, 0.14)" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: "#fb7185" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: "#fbbf24" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: "#34d399" }} />
            </div>
            <pre style={{ margin: "24px 0 0", color: "#c4b5fd", fontFamily: "JetBrains Mono, Consolas, monospace", fontSize: "15px", lineHeight: "1.8", whiteSpace: "pre-wrap" }}>
              {"page Dream {\n  text {\n    content: \"Build the future\"\n  }\n\n  button {\n    text: \"Launch\"\n  }\n}"}
            </pre>
          </div>
        </aside>
      </section>
      <section id={"features"} style={{ padding: "96px 0 28px" }}>
        <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto 48px" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "42px", letterSpacing: "-0.045em" }}>
            {"Less ceremony. More creation."}
          </h2>
          <p style={{ margin: "0px", color: "#94a3b8", fontSize: "18px", lineHeight: "1.7" }}>
            {"Everything you need to turn readable ideas into responsive experiences."}
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "18px" }}>
          <article style={{ padding: "28px", border: "1px solid rgba(148, 163, 184, 0.16)", borderRadius: "20px", background: "rgba(15, 23, 42, 0.62)" }}>
            <h3 style={{ margin: "0 0 12px", color: "#c4b5fd", fontSize: "20px" }}>
              {"Readable by design"}
            </h3>
            <p style={{ margin: "0px", color: "#94a3b8", lineHeight: "1.7" }}>
              {"Code that reads like the interface you imagined, with state and interaction built in."}
            </p>
          </article>
          <article style={{ padding: "28px", border: "1px solid rgba(148, 163, 184, 0.16)", borderRadius: "20px", background: "rgba(15, 23, 42, 0.62)" }}>
            <h3 style={{ margin: "0 0 12px", color: "#67e8f9", fontSize: "20px" }}>
              {"Instant feedback"}
            </h3>
            <p style={{ margin: "0px", color: "#94a3b8", lineHeight: "1.7" }}>
              {"Save a .jg file and see the browser update immediately while your idea is fresh."}
            </p>
          </article>
          <article style={{ padding: "28px", border: "1px solid rgba(148, 163, 184, 0.16)", borderRadius: "20px", background: "rgba(15, 23, 42, 0.62)" }}>
            <h3 style={{ margin: "0 0 12px", color: "#f0abfc", fontSize: "20px" }}>
              {"Made for the web"}
            </h3>
            <p style={{ margin: "0px", color: "#94a3b8", lineHeight: "1.7" }}>
              {"Compile to React and TypeScript while keeping your source focused and expressive."}
            </p>
          </article>
        </div>
      </section>
    </main>
    </div>
  );
}
