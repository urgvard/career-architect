import type { Context, Config } from "@netlify/functions";
import { buildRoutes, generateContentResilient } from "../lib/gemini";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { systemPrompt, message, history } = await req.json();

    // Resilient routes: the user's direct key first, then the managed Netlify
    // AI Gateway as an automatic fallback when Google's direct endpoint is
    // overloaded.
    const routes = buildRoutes();
    if (!routes.length) {
      return Response.json({
        error: "No Gemini route is configured. Set USER_GEMINI_API_KEY or enable the Netlify AI Gateway."
      }, { status: 500 });
    }

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

    const response = await generateContentResilient(routes, {
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
