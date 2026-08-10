import type { Context, Config } from "@netlify/functions";

// Free model via OpenRouter -- $0 cost, subject to OpenRouter's free-tier rate limits.
// Swap this string if the free slug changes or you want a different free model later.
const MODEL = "openai/gpt-oss-20b:free";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { systemPrompt, message, history } = await req.json();
    const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not set in this site's Environment Variables." },
      { status: 500 }
      );
  }

  const messages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    if (history && Array.isArray(history)) {
      for (const h of history) {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.message,
        });
      }
    }
    messages.push({ role: "user", content: message });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://career-architect-urgvard.netlify.app",
      "X-Title": "Karriararkitekten",
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return Response.json(
      { error: `OpenRouter error (${res.status}): ${errText}` },
      { status: 502 }
      );
  }

  const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return Response.json({ reply });
  } catch (error: any) {
    console.error("openrouter-chat function error:", error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/ai/openrouter-chat",
};
