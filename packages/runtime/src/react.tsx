import * as React from "react";
import type { AiMessage } from "./ai";

export function useAiChat(endpoint: string, sessionId?: string) {
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [input, setInput] = React.useState("");

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    
    const userMsg: AiMessage = { role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content, sessionId })
      });
      
      const text = await res.text();
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    } catch (err) {
      console.error("Chat error", err);
    } finally {
      setLoading(false);
    }
  };

  return { messages, input, setInput, sendMessage, loading };
}

export function AiChat(props: { endpoint: string; sessionId?: string; title?: string }) {
  const { messages, input, setInput, sendMessage, loading } = useAiChat(props.endpoint, props.sessionId);

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", height: "400px", border: "1px solid #ccc", borderRadius: "8px", overflow: "hidden" } },
    props.title ? React.createElement("div", { style: { padding: "10px", background: "#f0f0f0", fontWeight: "bold" } }, props.title) : null,
    React.createElement(
      "div",
      { style: { flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: "10px" } },
      messages.map((msg, i) =>
        React.createElement(
          "div",
          {
            key: i,
            style: {
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              background: msg.role === "user" ? "#007bff" : "#e9ecef",
              color: msg.role === "user" ? "white" : "black",
              padding: "8px 12px",
              borderRadius: "16px",
              maxWidth: "80%",
            },
          },
          msg.role === "tool" ? React.createElement("i", null, `🛠 ${msg.name}: ${msg.content}`) : msg.content
        )
      ),
      loading ? React.createElement("div", { style: { alignSelf: "flex-start", color: "gray" } }, "Typing...") : null
    ),
    React.createElement(
      "div",
      { style: { display: "flex", padding: "10px", borderTop: "1px solid #ccc" } },
      React.createElement("input", {
        style: { flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" },
        value: input,
        onChange: (e: any) => setInput(e.target.value),
        onKeyDown: (e: any) => e.key === "Enter" && sendMessage(input),
        placeholder: "Type a message...",
        disabled: loading,
      }),
      React.createElement(
        "button",
        {
          style: { marginLeft: "10px", padding: "8px 16px", background: "#007bff", color: "white", border: "none", borderRadius: "4px" },
          onClick: () => sendMessage(input),
          disabled: loading,
        },
        "Send"
      )
    )
  );
}
