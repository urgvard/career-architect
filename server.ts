import express from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Claude through Netlify AI Gateway (account-billed, high shared limits). The
// zero-config constructor auto-detects the ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL
// that Netlify injects, so local dev under `netlify dev` matches production.
const MODEL = "claude-haiku-4-5";
const anthropic = new Anthropic();

// Force a strict JSON object out of Claude via a single required tool call.
async function generateStructured(opts: {
  system: string;
  user: string;
  schema: any;
  maxTokens: number;
}): Promise<any> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    tools: [
      {
        name: "submit_result",
        description: "Return the structured result for the candidate analysis.",
        input_schema: opts.schema,
      },
    ],
    tool_choice: { type: "tool", name: "submit_result" },
    messages: [{ role: "user", content: opts.user }],
  });
  const toolUse = message.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolUse || !toolUse.input) {
    throw new Error("Model did not return structured output.");
  }
  return toolUse.input;
}

app.use(express.json({ limit: "15mb" })); // Increase limit for document uploads

// Helper function to safely crawl public jobs text
async function fetchCleanUrl(urlStr: string): Promise<string> {
  try {
    const parsed = new URL(urlStr);
    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ClientHelper/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(6000), // 6-second threshold
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Status Code ${response.status}`);
    }
    
    const html = await response.text();
    // Clean header, footer, script & style blocks to retrieve text content
    let text = html
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, " ")
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, " ")
      .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text.substring(0, 10000); // Truncate content for reasoning context safety
  } catch (error: any) {
    console.warn("Scraper utility failed on URL:", urlStr, error?.message);
    return `[Scrape Error: Could not load text directly from ${urlStr} due to protection, block, or timeout. ${error.message}. Relying on internal model web parameters.]`;
  }
}

// API: Check status of API Key
app.get("/api/apiKeyStatus", (req, res) => {
  const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY || process.env.GEMINI_API_KEY);
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
        type: "object",
        required: [
          "title",
          "companyName",
          "matchScore",
          "keyOverlaps",
          "criticalGaps",
          "coachingStrategy"
        ],
        properties: {
          title: { type: "string" },
          companyName: { type: "string" },
          matchScore: { type: "integer" },
          keyOverlaps: { type: "array", items: { type: "string" } },
          criticalGaps: { type: "array", items: { type: "string" } },
          coachingStrategy: { type: "string" }
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
        type: "object",
        required: [
          "personaTitle",
          "personaSystemPrompt",
          "coverLetter",
          "optimizedBulletPoints"
        ],
        properties: {
          personaTitle: { type: "string" },
          personaSystemPrompt: { type: "string" },
          coverLetter: { type: "string" },
          optimizedBulletPoints: {
            type: "array",
            items: {
              type: "object",
              required: ["impactArea", "originalSuggestion", "optimizedSuggestion", "keywordJustification"],
              properties: {
                impactArea: { type: "string" },
                originalSuggestion: { type: "string" },
                optimizedSuggestion: { type: "string" },
                keywordJustification: { type: "string" }
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
        type: "object",
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
          title: { type: "string" },
          companyName: { type: "string" },
          matchScore: { type: "integer" },
          personaTitle: { type: "string" },
          personaSystemPrompt: { type: "string", description: "Highly advanced, complete system prompt representing this interview persona for sandbox utilization." },
          keyOverlaps: {
            type: "array",
            items: { type: "string" },
            description: "Matched keyword strengths found between profile and target job description."
          },
          criticalGaps: {
            type: "array",
            items: { type: "string" },
            description: "Crucial requirements or skills missing from candidate background."
          },
          coverLetter: { type: "string", description: "Customized ready-to-copy Cover Letter in Markdown format." },
          optimizedBulletPoints: {
            type: "array",
            items: {
              type: "object",
              required: ["impactArea", "originalSuggestion", "optimizedSuggestion", "keywordJustification"],
              properties: {
                impactArea: { type: "string", description: "E.g., System scalability, database speed, client acquisition" },
                originalSuggestion: { type: "string", description: "A classic generic resume bullet statement." },
                optimizedSuggestion: { type: "string", description: "Optimized statement incorporating key search phrases and KPI metric metrics." },
                keywordJustification: { type: "string", description: "Why this change fits the job description query priorities." }
              }
            }
          },
          coachingStrategy: { type: "string", description: "Bespoke walkthrough guiding the candidate through core behavioral & technical expectations in Markdown format." }
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

Call the submit_result tool with the structured result. Use clear, engaging Markdown syntax inside appropriate fields.`;

    const parsedResponse = await generateStructured({
      system: systemMetaConfigPrompt,
      user: modelingPayload,
      schema: responseSchema,
      maxTokens: mode === "core" || mode === "materials" ? 2048 : 4096,
    });
    res.json(parsedResponse);
  } catch (error: any) {
    console.error("Architect aligner endpoint error:", error);
    
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
      if (lang === "en") {
        friendlyError = `⚠️ **The AI service is busy right now**

The request was temporarily rate-limited. This usually clears within a few seconds.

**How to resolve this:**
1. **Wait a few seconds**, then click the button again.
2. Avoid clicking the button repeatedly in rapid succession.
3. If your uploaded resume or pasted job description is exceptionally long, try shortening it slightly.`;
      } else {
        friendlyError = `⚠️ **AI-tjänsten är upptagen just nu**

Förfrågan begränsades tillfälligt. Detta brukar lösa sig inom några sekunder.

**Så här löser du det:**
1. **Vänta några sekunder** och klicka sedan på knappen igen.
2. Undvik att klicka på knappen upprepade gånger i snabb följd.
3. Om dina dokument eller din jobbannons är extremt långa, försök att korta ner dem något.`;
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

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    res.json({ reply });
  } catch (error: any) {
    console.error("Playground sandbox controller error:", error);

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
