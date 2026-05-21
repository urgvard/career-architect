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
    return Response.json({ error: error?.message || "Internal error." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/playground/chat"
};
