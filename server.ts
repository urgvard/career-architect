import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini SDK. Prefer the Netlify AI Gateway (injected by `netlify dev` and in
// production) so requests are billed to Netlify credits with high account-level limits,
// avoiding the personal free-tier key's 15 RPM / 250k TPM caps that caused 429 errors.
const getGeminiClient = () => {
  if (process.env.GOOGLE_GEMINI_BASE_URL) {
    // Gateway path: the SDK auto-detects GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL.
    // No custom headers — the gateway does not forward them to the provider.
    return new GoogleGenAI({});
  }
  const apiKey = process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("No AI Gateway and no GEMINI_API_KEY available");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(express.json({ limit: "15mb" })); // Increase limit for document uploads

// A complete, realistic browser User-Agent. The previous value ended in a
// custom "ClientHelper/1.0" token, which many job boards treat as a bot and
// answer with a 403 — so the crawler effectively never loaded those pages.
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,sv;q=0.8",
};

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, " ")
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, " ")
    .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, " ")
    .replace(/<noscript[^>]*>([\s\S]*?)<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function directFetch(urlStr: string): Promise<string> {
  const response = await fetch(urlStr, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return htmlToText(await response.text());
}

// Fallback that renders JavaScript-heavy or bot-protected job boards into clean
// text. Most modern job boards (LinkedIn, Indeed, Greenhouse, Lever, Workday…)
// build their listings client-side, so the raw HTML contains almost no job text
// — the reader executes the page and returns the actual advert content.
async function readerFetch(urlStr: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${urlStr}`, {
    headers: { "Accept": "text/plain", "X-Return-Format": "text" },
    redirect: "follow",
    signal: AbortSignal.timeout(14000),
  });
  if (!response.ok) throw new Error(`Reader HTTP ${response.status}`);
  return (await response.text()).replace(/\s+/g, " ").trim();
}

// Helper function to safely crawl public jobs text
async function fetchCleanUrl(urlStr: string): Promise<string> {
  try {
    const parsed = new URL(urlStr);

    let direct = "";
    try {
      direct = await directFetch(parsed.toString());
    } catch {
      // Blocked or unreachable directly — the reader fallback below handles it.
    }

    // Enough real text came back directly: use it (fast path, no third party).
    if (direct.length >= 600) {
      return direct.substring(0, 10000);
    }

    // Little or no text: the page was blocked or is JavaScript-rendered. Render
    // it through the reader and keep whichever result has more usable content.
    try {
      const reader = await readerFetch(parsed.toString());
      if (reader.length > direct.length) {
        return reader.substring(0, 10000);
      }
    } catch {
      // Reader unavailable — fall back to whatever the direct fetch produced.
    }

    if (direct.length > 0) {
      return direct.substring(0, 10000);
    }

    throw new Error("the page may require a login or block automated access");
  } catch (error: any) {
    console.warn("Scraper utility failed on URL:", urlStr, error?.message);
    return `[Scrape Error: Could not load text directly from ${urlStr} due to protection, block, or timeout. ${error.message}. Relying on internal model web parameters.]`;
  }
}

// API: Check status of API Key
app.get("/api/apiKeyStatus", (req, res) => {
  const hasKey = !!(process.env.GOOGLE_GEMINI_BASE_URL || process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
  res.json({ hasKey });
});

// API: Scrape a job advertisement URL
app.post("/api/scrape", async (req, res) => {
  try {
    const { jobUrl } = req.body;
    if (!jobUrl || !jobUrl.trim().startsWith("http")) {
      return res.status(400).json({ error: "Invalid URL provided." });
    }
    const crawledText = await fetchCleanUrl(jobUrl.trim());
    if (crawledText.startsWith("[Scrape Error:")) {
      return res.status(500).json({ error: crawledText });
    }
    res.json({ crawledText });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to retrieve job advertisement content." });
  }
});

// API: Align Documents & System Prompt Synthesis
app.post("/api/architect", async (req, res) => {
  let lang = "sv";
  try {
    lang = req.body.lang || "sv";
    const { documentsPasted, uploadedFiles, jobDescription, mode } = req.body;
    const targetLang = lang === "en" ? "English" : "Swedish";

    // Build raw documents context
    let fullDocumentsContext = "";
    if (documentsPasted) {
      fullDocumentsContext += `### Raw Copied Document Contents:\n${documentsPasted}\n\n`;
    }
    if (uploadedFiles && Array.isArray(uploadedFiles)) {
      uploadedFiles.forEach((f: any) => {
        fullDocumentsContext += `### File: ${f.name}\n${f.content}\n\n`;
      });
    }

    if (!fullDocumentsContext.trim()) {
      return res.status(400).json({ 
        error: lang === "en" ? "Please enter or upload at least one candidate document." : "Vänligen fyll i eller ladda upp minst ett kandidatdokument." 
      });
    }

    // Resolve Job Description
    const resolvedJobText = jobDescription || "";
    if (!resolvedJobText.trim()) {
      return res.status(400).json({
        error: lang === "en" ? "Please paste a Job Description or enter a valid job page URL." : "Vänligen klistra in en jobbannons eller ange en giltig URL."
      });
    }

    // Pre-flight size guard mirroring the deployed function: keep the combined
    // payload well under Gemini's 1,048,576-token input ceiling so oversized input
    // returns an actionable, localized message instead of a raw 400 token error.
    const TOTAL_CHAR_BUDGET = 1_200_000;
    if (fullDocumentsContext.length + resolvedJobText.length > TOTAL_CHAR_BUDGET) {
      return res.status(400).json({
        error: lang === "en"
          ? "⚠️ **Your documents are too large to process**\n\nThe combined candidate documents and job advert are far longer than the AI can read in one request. Keep only the relevant résumé/CV, trim very long pasted text, and if you uploaded a scanned/image PDF, paste the actual text instead."
          : "⚠️ **Dina dokument är för stora för att bearbetas**\n\nDe sammanlagda kandidatdokumenten och jobbannonsen är betydligt längre än vad AI:n kan läsa i en förfrågan. Behåll endast relevant meritförteckning/CV, korta ner mycket lång inklistrad text, och om du laddat upp en inskannad/bild-PDF, klistra in själva texten i stället."
      });
    }

    const ai = getGeminiClient();

    let systemMetaConfigPrompt = "";
    let responseSchema: any = null;

    if (mode === "core") {
      systemMetaConfigPrompt = `You are a Principal Technical Recruiter and Executive Career Coach.
Your core competency is auditing candidate profile documents against specialized roles/job descriptions and creating a deep matching analysis.

CRITICAL INSTRUCTION: You MUST generate all human-readable output text fields (including 'title', 'companyName', 'keyOverlaps', 'criticalGaps', and 'coachingStrategy') in the "${targetLang}" language.

CRITICAL SPEED & CONCISENESS LIMITS:
- "coachingStrategy": Provide extremely actionable, bulleted coaching points (maximum 220 words).

You MUST satisfy the following structural objectives in your response:
1. "title": Estimate or extract the clean Job Title.
2. "companyName": Extract the clean Company/Employer Name.
3. "matchScore": Allocate a precise 0-100 percentage match.
4. "keyOverlaps": Highlight major overlaps or matched strengths (maximum 5 items).
5. "criticalGaps": Highlight critical missing items or requirements gaps (maximum 5 items).
6. "coachingStrategy": Provide strategic guidance and tactical blueprints within the 220-word limit.

Your output must be returned strictly in JSON adhering to the specified schema constraints. Maintain zero meta-introduction filler. All human-readable text must be in ${targetLang}.`;

      responseSchema = {
        type: Type.OBJECT,
        required: [
          "title",
          "companyName",
          "matchScore",
          "keyOverlaps",
          "criticalGaps",
          "coachingStrategy"
        ],
        properties: {
          title: { type: Type.STRING },
          companyName: { type: Type.STRING },
          matchScore: { type: Type.INTEGER },
          keyOverlaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          criticalGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          coachingStrategy: { type: Type.STRING }
        }
      };
    } else if (mode === "materials") {
      systemMetaConfigPrompt = `You are a Technical Resume Writer, Executive Coach, and Expert Prompt Engineer.
Your core competency is auditing candidate profile documents against specialized roles/job descriptions, writing a custom tailored cover letter, optimizing resume bullet points, and synthesizing a specialized Interviewer Persona & System Prompt.

CRITICAL INSTRUCTION: You MUST generate all human-readable output text fields (including 'coverLetter', 'personaTitle', and all properties within 'optimizedBulletPoints') in the "${targetLang}" language.
The system prompt ('personaSystemPrompt') can contain instructions configured for the sandbox, but the mock interviewer in that prompt should also converse in "${targetLang}".

CRITICAL SPEED & CONCISENESS LIMITS:
- "coverLetter": Keep it highly compelling but compact (maximum 220 words, 3 punchy paragraphs).
- "personaSystemPrompt": Keep the instruction set concise, sharp, and high-performance (maximum 160 words).
- "optimizedBulletPoints": Provide exactly 3 high-impact bullet adjustments, keeping each description extremely brief.

You MUST satisfy the following structural objectives in your response:
1. "personaTitle": Design a powerful, highly specialized interviewer persona (e.g. "Senior Staff Staffing Director at Google Workspace").
2. "personaSystemPrompt": Construct a high-performance system prompt that instructs the sandbox workspace to act as this custom persona.
3. "coverLetter": Compose a beautifully tailored standard Cover Letter within the 220-word limit.
4. "optimizedBulletPoints": Provide exactly 3 high-value resume bullet adjustments.

Your output must be returned strictly in JSON adhering to the specified schema constraints. Maintain zero meta-introduction filler. All human-readable text must be in ${targetLang}.`;

      responseSchema = {
        type: Type.OBJECT,
        required: [
          "personaTitle",
          "personaSystemPrompt",
          "coverLetter",
          "optimizedBulletPoints"
        ],
        properties: {
          personaTitle: { type: Type.STRING },
          personaSystemPrompt: { type: Type.STRING },
          coverLetter: { type: Type.STRING },
          optimizedBulletPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["impactArea", "originalSuggestion", "optimizedSuggestion", "keywordJustification"],
              properties: {
                impactArea: { type: Type.STRING },
                originalSuggestion: { type: Type.STRING },
                optimizedSuggestion: { type: Type.STRING },
                keywordJustification: { type: Type.STRING }
              }
            }
          }
        }
      };
    } else {
      // Default: full legacy combined execution
      systemMetaConfigPrompt = `You are a Principal Technical Recruiter, Executive Career Coach, and Expert Prompt Engineer.
Your core competency is auditing candidate profile documents against specialized roles/job descriptions, creating a deep matching analysis, and synthesizing a production-grade custom System Prompt for simulated interview chat sandboxes.

CRITICAL INSTRUCTION: You MUST generate all human-readable output text fields (including 'title', 'companyName', 'personaTitle', 'keyOverlaps', 'criticalGaps', 'coverLetter', 'coachingStrategy', and all properties within 'optimizedBulletPoints') in the "${targetLang}" language. 
The system prompt ('personaSystemPrompt') can contain instructions configured for the sandbox, but the mock interviewer in that prompt should also converse in "${targetLang}".

CRITICAL SPEED & CONCISENESS LIMITS (Essential to prevent system timeouts):
- "coverLetter": Keep it highly compelling but compact (maximum 220 words, 3 punchy paragraphs).
- "coachingStrategy": Provide extremely actionable, bulleted coaching points (maximum 220 words).
- "personaSystemPrompt": Keep the instruction set concise, sharp, and high-performance (maximum 160 words).
- "optimizedBulletPoints": Provide exactly 3 high-impact bullet adjustments, keeping each description extremely brief.

You MUST satisfy the following structural objectives in your response:
1. "title": Estimate or extract the clean Job Title.
2. "companyName": Extract the clean Company/Employer Name.
3. "matchScore": Allocate a precise 0-100 percentage match.
4. "personaTitle": Design a powerful, highly specialized interviewer persona (e.g. "Senior Staff Staffing Director at Google Workspace").
5. "personaSystemPrompt": Construct a high-performance system prompt that instructs the sandbox workspace to act as this custom persona.
6. "keyOverlaps": Highlight major overlaps or matched strengths (maximum 5 items).
7. "criticalGaps": Highlight critical missing items or requirements gaps (maximum 5 items).
8. "coverLetter": Compose a beautifully tailored standard Cover Letter within the 220-word limit.
9. "optimizedBulletPoints": Provide exactly 3 high-value resume bullet adjustments.
10. "coachingStrategy": Provide strategic guidance and tactical blueprints within the 220-word limit.

Your output must be returned strictly in JSON adhering to the specified schema constraints. Maintain zero meta-introduction filler. Let the advice and synthesized system prompts be premium, authoritative, and immediately useful. All human-readable text must be in ${targetLang}.`;

      responseSchema = {
        type: Type.OBJECT,
        required: [
          "title",
          "companyName",
          "matchScore",
          "personaTitle",
          "personaSystemPrompt",
          "keyOverlaps",
          "criticalGaps",
          "coverLetter",
          "optimizedBulletPoints",
          "coachingStrategy"
        ],
        properties: {
          title: { type: Type.STRING },
          companyName: { type: Type.STRING },
          matchScore: { type: Type.INTEGER },
          personaTitle: { type: Type.STRING },
          personaSystemPrompt: { type: Type.STRING, description: "Highly advanced, complete system prompt representing this interview persona for sandbox utilization." },
          keyOverlaps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Matched keyword strengths found between profile and target job description."
          },
          criticalGaps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Crucial requirements or skills missing from candidate background."
          },
          coverLetter: { type: Type.STRING, description: "Customized ready-to-copy Cover Letter in Markdown format." },
          optimizedBulletPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["impactArea", "originalSuggestion", "optimizedSuggestion", "keywordJustification"],
              properties: {
                impactArea: { type: Type.STRING, description: "E.g., System scalability, database speed, client acquisition" },
                originalSuggestion: { type: Type.STRING, description: "A classic generic resume bullet statement." },
                optimizedSuggestion: { type: Type.STRING, description: "Optimized statement incorporating key search phrases and KPI metric metrics." },
                keywordJustification: { type: Type.STRING, description: "Why this change fits the job description query priorities." }
              }
            }
          },
          coachingStrategy: { type: Type.STRING, description: "Bespoke walkthrough guiding the candidate through core behavioral & technical expectations in Markdown format." }
        }
      };
    }

    const modelingPayload = `Please evaluate and align this candidate profile with the specified job opportunity, presenting all outcome text in ${targetLang}:

<candidate_documents>
${fullDocumentsContext.trim()}
</candidate_documents>

<job_description>
${resolvedJobText.trim()}
</job_description>

Construct the response conforming strictly to the responseSchema object. Use clear, engaging Markdown syntax inside appropriate fields.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: modelingPayload,
      config: {
        systemInstruction: systemMetaConfigPrompt,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const parsedResponse = JSON.parse(response.text || "{}");
    res.json(parsedResponse);
  } catch (error: any) {
    console.error("Architect aligner endpoint error:", error);
    
    const errStr = error?.message || String(error);
    let friendlyError = errStr;

    if (
      errStr.includes("token count") ||
      errStr.includes("maximum number of tokens") ||
      errStr.includes("exceeds the maximum") ||
      (errStr.includes("400") && errStr.includes("token"))
    ) {
      friendlyError = lang === "en"
        ? "⚠️ **Your documents are too large to process**\n\nThe combined candidate documents and job advert exceed the amount of text the AI can read in one request. Keep only the relevant résumé/CV, trim very long pasted text, and if you uploaded a scanned/image PDF, paste the actual text instead."
        : "⚠️ **Dina dokument är för stora för att bearbetas**\n\nDe sammanlagda kandidatdokumenten och jobbannonsen överstiger mängden text som AI:n kan läsa i en förfrågan. Behåll endast relevant meritförteckning/CV, korta ner mycket lång inklistrad text, och om du laddat upp en inskannad/bild-PDF, klistra in själva texten i stället.";
    } else if (
      errStr.includes("429") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.includes("quota") ||
      errStr.includes("Quota") ||
      errStr.includes("limit")
    ) {
      if (lang === "en") {
        friendlyError = `⚠️ **The AI service is busy right now (temporary rate limit)**

The AI service hit a momentary capacity limit while generating your documents. This is temporary and resets within a minute.

**How to resolve this:**
1. **Wait about 15 seconds**, then click the button again.
2. Avoid clicking repeatedly in quick succession — each run starts several AI requests at once.
3. If your uploaded résumé or pasted job advert is very long, trimming it slightly lowers the load and helps it go through.`;
      } else {
        friendlyError = `⚠️ **AI-tjänsten är upptagen just nu (tillfällig gräns)**

AI-tjänsten nådde en tillfällig kapacitetsgräns när dina dokument skapades. Detta är övergående och återställs inom en minut.

**Så här löser du det:**
1. **Vänta cirka 15 sekunder** och klicka sedan på knappen igen.
2. Undvik att klicka upprepade gånger i snabb följd – varje körning startar flera AI-anrop samtidigt.
3. Om din uppladdade meritförteckning eller jobbannons är mycket lång, korta ner den något för att minska belastningen.`;
      }
    }
    
    res.status(500).json({ error: friendlyError });
  }
});

// API: Sandbox tester chat router
app.post("/api/playground/chat", async (req, res) => {
  try {
    const { systemPrompt, message, history } = req.body;
    if (!systemPrompt || !message) {
      return res.status(400).json({ error: "systemPrompt and message arguments are required" });
    }

    const ai = getGeminiClient();

    // Map chat timeline variables safely
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
      model: GEMINI_MODEL,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    res.json({
      reply: response.text || ""
    });
  } catch (error: any) {
    console.error("Playground sandbox controller error:", error);
    
    const errStr = error?.message || String(error);
    let friendlyError = errStr;
    
    if (
      errStr.includes("429") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.includes("quota") ||
      errStr.includes("Quota") ||
      errStr.includes("limit")
    ) {
      friendlyError = `⚠️ **The AI service is busy right now (temporary rate limit)**

The AI service hit a momentary capacity limit. This is temporary and resets within a minute.

**How to resolve this:**
1. **Wait about 15 seconds**, then send your message again.
2. Avoid sending messages repeatedly in rapid succession.`;
    }
    
    res.status(500).json({ error: friendlyError });
  }
});

// Start application listener
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
