import type { Context, Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";

// Mock-interview chat runs on Claude through Netlify AI Gateway (account-billed,
// high shared limits) instead of the personal Gemini free-tier key that caused
// the 429 errors. The default constructor auto-detects the gateway config.
const MODEL = "claude-haiku-4-5";
const anthropic = new Anthropic();

function isTransientError(err: any): boolean {
  const status = err?.status;
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 529 ||
    msg.includes("429") ||
    msg.includes("overloaded") ||
    msg.includes("rate") ||
    msg.includes("timeout") ||
    msg.includes("econnreset")
  );
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isTransientError(err) || i === attempts - 1) throw err;
      const backoff = Math.min(800 * 2 ** i, 6000) + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { systemPrompt, message, history } = await req.json();

    const messages: Anthropic.MessageParam[] = [];
    if (history && Array.isArray(history)) {
      for (const h of history) {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.message,
        });
      }
    }
    messages.push({ role: "user", content: message });

    const response = await withRetry(() =>
      anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      })
    );

    const reply = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    return Response.json({ reply });
  } catch (error: any) {
    console.error("Playground function error:", error);

    const errStr = error?.message || String(error);
    const status = error?.status;
    let friendlyError = errStr;

    if (
      status === 429 ||
      status === 529 ||
      errStr.includes("429") ||
      errStr.includes("overloaded") ||
      errStr.includes("quota") ||
      errStr.includes("Quota") ||
      errStr.includes("rate") ||
      errStr.includes("limit")
    ) {
      friendlyError = `⚠️ **The AI service is busy right now**

The request was temporarily rate-limited. Please wait a few seconds, then send your message again, and avoid sending messages in rapid succession.`;
    }

    return Response.json({ error: friendlyError }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/playground/chat"
};
