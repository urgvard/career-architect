import type { Context, Config } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";

// Prefer Netlify AI Gateway (account-billed, high shared limits) so the mock
// interview sandbox doesn't hit the personal free-tier 429 ceiling. A
// user-supplied paid key still takes priority when explicitly set.
function getGeminiClient(): GoogleGenAI {
  const userKey = process.env.USER_GEMINI_API_KEY;
  if (userKey) {
    return new GoogleGenAI({ apiKey: userKey });
  }
  return new GoogleGenAI({});
}

async function generateWithRetry(ai: GoogleGenAI, params: any, attempts = 3): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message || String(err);
      const isRateLimited = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
      if (!isRateLimited || i === attempts - 1) throw err;
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

    const ai = getGeminiClient();

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

    const response = await generateWithRetry(ai, {
      model: "gemini-2.5-flash",
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
