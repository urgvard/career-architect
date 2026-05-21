import type { Context, Config } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";

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

    const response = await ai.models.generateContent({
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
