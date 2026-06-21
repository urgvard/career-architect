import type { Context, Config } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { systemPrompt, message, history } = await req.json();

    // Route through the Netlify AI Gateway (billed to Netlify credits, high account-level
    // limits) instead of a personal free-tier Gemini key whose per-minute caps cause 429s.
    // The SDK auto-detects the gateway-injected GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL;
    // fall back to a direct key only when the gateway is unavailable.
    const ai = process.env.GOOGLE_GEMINI_BASE_URL
      ? new GoogleGenAI({})
      : new GoogleGenAI({ apiKey: process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "" });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

    const response = await ai.models.generateContent({
      model: model,
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
      friendlyError = `⚠️ **The AI service is busy right now (temporary rate limit)**

The AI service hit a momentary capacity limit. This is temporary and resets within a minute.

**How to resolve this:**
1. **Wait about 15 seconds**, then send your message again.
2. Avoid sending messages repeatedly in rapid succession.`;
    }
    
    return Response.json({ error: friendlyError }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/playground/chat"
};
