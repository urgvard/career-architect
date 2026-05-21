import type { Context, Config } from "@netlify/functions";
import { GoogleGenAI, Type } from "@google/genai";

async function fetchCleanUrl(urlStr: string): Promise<string> {
  try {
    const parsed = new URL(urlStr);
    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ClientHelper/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(6000),
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    let text = html
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, " ")
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, " ")
      .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text.substring(0, 10000);
  } catch (error: any) {
    return `[Scrape Error: ${error.message}]`;
  }
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { documentsPasted, uploadedFiles, jobDescription, jobUrl, lang } = await req.json();
    const targetLang = lang === "en" ? "English" : "Swedish";

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
      return Response.json({ 
        error: lang === "en" ? "Please enter or upload at least one candidate document." : "Vänligen fyll i eller ladda upp minst ett kandidatdokument." 
      }, { status: 400 });
    }

    let resolvedJobText = jobDescription || "";
    if (jobUrl && jobUrl.trim().startsWith("http")) {
      const crawledText = await fetchCleanUrl(jobUrl.trim());
      resolvedJobText = `URL: ${jobUrl}\nContent crawled:\n${crawledText}\n\n${resolvedJobText}`;
    }

    if (!resolvedJobText.trim()) {
      return Response.json({ 
        error: lang === "en" ? "Please paste a Job Description or enter a valid job page URL." : "Vänligen klistra in en jobbannons eller ange en giltig URL." 
      }, { status: 400 });
    }

    const apiKey = process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({
        error: "USER_GEMINI_API_KEY is not defined in Netlify environment variables."
      }, { status: 500 });
    }

    // Prevent Netlify AI Gateway hijacking by deleting platform-injected overrides
    delete process.env.GOOGLE_GEMINI_BASE_URL;
    delete process.env.GEMINI_API_KEY;

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const systemMetaConfigPrompt = `You are a Principal Technical Recruiter, Executive Career Coach, and Expert Prompt Engineer.
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
            personaSystemPrompt: { type: Type.STRING },
            keyOverlaps: { type: Type.ARRAY, items: { type: Type.STRING } },
            criticalGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
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
            },
            coachingStrategy: { type: Type.STRING }
          }
        }
      }
    });

    return Response.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Architect function error:", error);
    return Response.json({ 
      error: error?.message || "Internal server error occurred during document alignment.",
      stack: error?.stack,
      details: JSON.stringify(error)
    }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/architect"
};
