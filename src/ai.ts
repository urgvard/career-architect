// Reusable client-side helper for calling the free OpenRouter AI proxy.
// Pairs with netlify/functions/openrouter-chat.ts -- never call OpenRouter
// directly from the browser, or the API key would leak into the client bundle.

export interface ChatTurn {
  role: "user" | "assistant";
  message: string;
}

export async function askOpenRouter(
  message: string,
  opts: { systemPrompt?: string; history?: ChatTurn[] } = {}
  ): Promise<string> {
  const res = await fetch("/api/ai/openrouter-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      systemPrompt: opts.systemPrompt,
      history: opts.history || [],
    }),
  });

const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data.reply as string;
}
