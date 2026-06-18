import type { Context, Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";

// Mock-interview chat runs on Claude through Netlify AI Gateway (account-billed,
// high shared limits) instead of the personal Gemini free-tier key that caused
// the 429 errors. The default constructor auto-detects the gateway config.
const MODEL = "claude-haiku-4-5";
const anthropic = new Anthropic();

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status;
      const msg = err?.message || String(err);
      const isTransient =
        status === 429 || status === 529 || msg.includes("429") || msg.includes("overloaded") || msg.includes("rate");
      if (!isTransient || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
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
