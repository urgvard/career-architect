import type { Context, Config } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";

// Primary model, with a fallback used only when the primary stays unavailable.
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";

// A transient error is one worth retrying: model overload (503/UNAVAILABLE),
// rate limiting (429), upstream 5xx, or a dropped connection.
function isTransientError(err: any): boolean {
  const haystack = `${err?.message || ""} ${err?.status || ""} ${(() => {
    try { return JSON.stringify(err); } catch { return String(err); }
  })()}`;
  return /\b(503|502|500|429)\b|UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i.test(
    haystack
  );
}

// Call generateContent with bounded exponential backoff. On a persistent
// transient failure with the primary model, retry once on the fallback model.
async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: any,
  { retries = 3, baseDelayMs = 400 }: { retries?: number; baseDelayMs?: number } = {}
) {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const useFallback = attempt === retries && params.model === PRIMARY_MODEL;
    try {
      return await ai.models.generateContent(
        useFallback ? { ...params, model: FALLBACK_MODEL } : params
      );
    } catch (err: any) {
      lastErr = err;
      if (!isTransientError(err)) throw err;
      if (attempt === retries) break;
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, delay));
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
    const apiKey = process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
    // Prevent Netlify AI Gateway hijacking by deleting platform-injected overrides
    delete process.env.GOOGLE_GEMINI_BASE_URL;
    delete process.env.GEMINI_API_KEY;

    const ai = new GoogleGenAI({ apiKey: apiKey || "" });

    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      for (const h of history) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.message }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await generateContentWithRetry(ai, {
      model: PRIMARY_MODEL,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return Response.json({ reply: response.text || "" });
  } catch (error: any) {
    console.error("Playground function error:", error);
    
    const errStr = error?.message || String(error);
    let friendlyError = errStr;

    if (
      errStr.includes("503") ||
      errStr.includes("UNAVAILABLE") ||
      errStr.includes("overloaded") ||
      errStr.includes("high demand")
    ) {
      friendlyError = `⚠️ **The AI model is temporarily overloaded (Error 503 - UNAVAILABLE)**

Google Gemini is currently experiencing high demand. These spikes are usually short-lived. The request was automatically retried several times before this message.

**How to resolve this:** Wait 20-30 seconds and send your message again — capacity normally recovers within a minute.`;
    } else if (
      errStr.includes("429") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.includes("quota") ||
      errStr.includes("Quota") ||
      errStr.includes("limit")
    ) {
      // Default to English as the Sandbox prompt may be multilingually active
      friendlyError = `⚠️ **Google Gemini Quota Limit Exceeded (Error 429 - RESOURCE_EXHAUSTED)**

You have temporarily exceeded the Google Gemini Free Tier rate limits (which allow a maximum of 15 requests per minute and 250,000 tokens per minute).

**How to easily resolve this:**
1. **Wait 15 seconds**, then type your message again.
2. Avoid sending messages repeatedly in rapid succession.
3. If you have a billing-enabled paid API key, verify that it is properly set up in your Netlify Environment Variables or local .env file.`;
    }
    
    return Response.json({ error: friendlyError }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/playground/chat"
};
