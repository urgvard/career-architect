import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini SDK with custom user agent and key from env
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not defined");
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
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({ hasKey });
});

// API: Align Documents & System Prompt Synthesis
app.post("/api/architect", async (req, res) => {
  try {
    const { documentsPasted, uploadedFiles, jobDescription, jobUrl, lang } = req.body;
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
    let resolvedJobText = jobDescription || "";
    if (jobUrl && jobUrl.trim().startsWith("http")) {
      const crawledText = await fetchCleanUrl(jobUrl.trim());
      resolvedJobText = `URL: ${jobUrl}\nContent crawled:\n${crawledText}\n\n${resolvedJobText}`;
    }

    if (!resolvedJobText.trim()) {
      return res.status(400).json({ 
        error: lang === "en" ? "Please paste a Job Description or enter a valid job page URL." : "Vänligen klistra in en jobbannons eller ange en giltig URL." 
      });
    }

    const ai = getGeminiClient();

    // Constructing Meta prompting to synthesize target outputs and the playground instruction prompt
    const systemMetaConfigPrompt = `You are a Principal Technical Recruiter, Executive Career Coach, and Expert Prompt Engineer.
Your core competency is auditing candidate profile documents (resumes, cover letters, portfolios) against specialized roles/job descriptions, creating a deep matching analysis, and synthesizing a production-grade custom System Prompt for simulated interview chat sandboxes.

CRITICAL INSTRUCTION: You MUST generate all human-readable output text fields (including 'title', 'companyName', 'personaTitle', 'keyOverlaps', 'criticalGaps', 'coverLetter', 'coachingStrategy', and all properties within 'optimizedBulletPoints') in the "${targetLang}" language. 
The system prompt ('personaSystemPrompt') can contain instructions configured for the sandbox, but the mock interviewer in that prompt should also converse in "${targetLang}".

You MUST satisfy the following structural objectives in your response:
1. "title": Estimate or extract the clean Job Title.
2. "companyName": Extract the clean Company/Employer Name.
3. "matchScore": Allocate a precise 0-100 percentage match.
4. "personaTitle": Design a powerful, highly specialized interviewer persona (e.g. "Senior Staff Staffing Director at Google Workspace").
5. "personaSystemPrompt": Construct a high-performance system prompt that instructs the sandbox workspace to act as this custom persona. This simulated persona must conduct a realistic, challenging, conversational-style interview tailored exactly to the target job and candidate's experience. It should use <thinking> block tags to plan its next drill questions based on candidate weaknesses, enforce high-density technical directness, and ban conversational fluff.
6. "keyOverlaps": Highlight major overlaps or matched strengths.
7. "criticalGaps": Highlight critical missing items, mismatch warnings, and requirements gaps.
8. "coverLetter": Compose a highly compelling, beautifully tailored, standard one-page Cover Letter demonstrating absolute alignment.
9. "optimizedBulletPoints": Provide exactly 3 or 4 high-value resume bullet adjustments, replacing generic text with impact statements infused with job-specific keywords.
10. "coachingStrategy": Provide strategic guidance and tactical blueprints on how the candidate can crush the interview.

Your output must be returned strictly in JSON adhering to the specified schema constraints. Maintain zero meta-introduction filler. Let the advice and synthesized system prompts be premium, authoritative, and immediately useful. All human-readable text must be in ${targetLang}.`;

    const modelingPayload = `Please evaluate and align this candidate profile with the specified job opportunity, presenting all outcome text in ${targetLang}:

<candidate_documents>
${fullDocumentsContext.trim()}
</candidate_documents>

<job_description>
${resolvedJobText.trim()}
</job_description>

Construct the response conforming strictly to the responseSchema object. Use clear, engaging Markdown syntax inside the 'coverLetter' and 'coachingStrategy' fields. Keep the synthesized 'personaSystemPrompt' extremely rigorous, containing clear parameters, expert instructions, interview behaviors, and XML structure tags so the sandbox works flawlessly.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: modelingPayload,
      config: {
        systemInstruction: systemMetaConfigPrompt,
        responseMimeType: "application/json",
        responseSchema: {
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
        }
      }
    });

    const parsedResponse = JSON.parse(response.text || "{}");
    res.json(parsedResponse);
  } catch (error: any) {
    console.error("Architect aligner endpoint error:", error);
    res.status(500).json({ error: error?.message || "Internal server error occurred during document alignment." });
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
      model: "gemini-2.5-flash",
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
    res.status(500).json({ error: error?.message || "Internal sandbox simulation error." });
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
