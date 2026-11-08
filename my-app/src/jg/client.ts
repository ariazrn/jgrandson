// Generated JGrandson Browser Client

export async function fetch_post__api_chat(options?: RequestInit) {
  const res = await fetch(`${options?.headers ? "" : ""}/api/chat`, {
    method: "POST",
    ...options
  });
  if (!res.ok) throw new Error("Request failed: " + res.status);
  return res.json();
}
