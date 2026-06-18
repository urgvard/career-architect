import type { Context, Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";

// Model served through Netlify AI Gateway. Claude on the gateway is billed to
// Netlify account credits with high, account-scoped rate limits, so we avoid the
// personal Gemini free-tier ceiling (15 req/min) that produced the 429 errors.
const MODEL = "claude-haiku-4-5";

// Zero-config client. Netlify injects ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL in
// every compute context so the SDK routes through AI Gateway with no key wiring.
const anthropic = new Anthropic();

// Retry transient rate-limit / overload responses with exponential backoff +
// jitter so brief per-minute spikes on the shared AI Gateway resolve themselves
// instead of surfacing as errors.
function isTransientError(err: any): boolean {
  const status = err?.status;
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 529 ||
    msg.includes("429") ||
    msg.includes("overloaded") ||
    msg.includes("rate") ||
    msg.includes("timeout") ||
    msg.includes("econnreset")
  );
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isTransientError(err) || i === attempts - 1) throw err;
      const backoff = Math.min(800 * 2 ** i, 6000) + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

// Force a strict JSON object out of Claude by exposing a single tool whose input
// schema is the desired shape and requiring the model to call it.
async function generateStructured(opts: {
  system: string;
  user: string;
  schema: any;
  maxTokens: number;
}): Promise<any> {
  const message = await withRetry(() =>
    anthropic.messages.create({
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
    })
  );

  const toolUse = message.content.find((b: any) => b.type === "tool_use") as any;
  if (!toolUse || !toolUse.input) {
    throw new Error("Model did not return structured output.");
  }
  return toolUse.input;
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  let lang = "sv";
  try {
    const body = await req.json();
    lang = body.lang || "sv";
    const { documentsPasted, uploadedFiles, jobDescription, mode } = body;
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

    const resolvedJobText = jobDescription || "";
    if (!resolvedJobText.trim()) {
      return Response.json({
        error: lang === "en" ? "Please paste a Job Description or enter a valid job page URL." : "Vänligen klistra in en jobbannons eller ange en giltig URL."
      }, { status: 400 });
    }

    let systemMetaConfigPrompt = "";
    let responseSchema: any = null;
    let maxTokens = 2048;

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

Maintain zero meta-introduction filler. All human-readable text must be in ${targetLang}.`;

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

Maintain zero meta-introduction filler. All human-readable text must be in ${targetLang}.`;

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
    } else if (mode === "resume") {
      maxTokens = 4096;
      systemMetaConfigPrompt = `You are an expert Resume Writer and ATS Optimization Specialist with 15+ years of executive recruiting experience.
Your task is to construct a complete, professionally formatted, ATS-optimized resume/CV for the candidate, precisely tailored to the target job.

CRITICAL EXTRACTION RULES:
- Extract ONLY real information found in the candidate documents. Do NOT invent companies, roles, or qualifications.
- If contact details are missing, use empty strings.
- Generate all professional text (summary, bullet points) in "${targetLang}".
- Bullet points must be achievement-focused and keyword-rich based on the job description (use STAR format where possible).
- Summary must be 3-4 sentences: hook, key experience, value proposition, tailored to the role.
- Extract and include ALL available experience, skills, education from the documents.`;

      responseSchema = {
        type: "object",
        required: ["resumeData"],
        properties: {
          resumeData: {
            type: "object",
            required: ["name", "targetRole", "contact", "summary", "experience", "skills", "education", "certifications", "languages", "achievements"],
            properties: {
              name: { type: "string", description: "Candidate full name extracted from documents. Use 'Your Name' if not found." },
              targetRole: { type: "string", description: "Target job title, tailored to match the job description." },
              contact: {
                type: "object",
                properties: {
                  email:    { type: "string" },
                  phone:    { type: "string" },
                  location: { type: "string" },
                  linkedin: { type: "string" },
                  website:  { type: "string" }
                }
              },
              summary: { type: "string", description: "3-4 sentence ATS-optimized professional summary tailored to the job." },
              experience: {
                type: "array",
                description: "All work experience extracted from candidate documents.",
                items: {
                  type: "object",
                  required: ["company", "role", "period", "bullets"],
                  properties: {
                    company:  { type: "string" },
                    role:     { type: "string" },
                    period:   { type: "string", description: "e.g. Jan 2022 – Mar 2024" },
                    location: { type: "string" },
                    bullets: {
                      type: "array",
                      items: { type: "string" },
                      description: "3-5 achievement-focused ATS-optimized bullets per role with quantified results where possible."
                    }
                  }
                }
              },
              skills: {
                type: "object",
                required: ["technical", "soft", "tools"],
                properties: {
                  technical: { type: "array", items: { type: "string" }, description: "Programming languages, frameworks, methodologies." },
                  tools:     { type: "array", items: { type: "string" }, description: "Software tools, platforms, cloud services." },
                  soft:      { type: "array", items: { type: "string" }, description: "Leadership, communication, management competencies." }
                }
              },
              education: {
                type: "array",
                items: {
                  type: "object",
                  required: ["degree", "institution", "year"],
                  properties: {
                    degree:      { type: "string" },
                    institution: { type: "string" },
                    year:        { type: "string" },
                    gpa:         { type: "string" }
                  }
                }
              },
              certifications: { type: "array", items: { type: "string" }, description: "Professional certifications and licenses." },
              languages:      { type: "array", items: { type: "string" }, description: "e.g. 'Swedish (Native)', 'English (Fluent)'." },
              achievements:   { type: "array", items: { type: "string" }, description: "Notable awards, recognition, or major accomplishments." }
            }
          }
        }
      };

    } else {
      // Default: full combined object (fallback/legacy)
      maxTokens = 4096;
      systemMetaConfigPrompt = `You are a Principal Technical Recruiter, Executive Career Coach, and Expert Prompt Engineer.
Your core competency is auditing candidate profile documents against specialized roles/job descriptions, creating a deep matching analysis, and synthesizing a production-grade custom System Prompt for simulated interview chat sandboxes.

CRITICAL INSTRUCTION: You MUST generate all human-readable output text fields (including 'title', 'companyName', 'personaTitle', 'keyOverlaps', 'criticalGaps', 'coverLetter', 'coachingStrategy', and all properties within 'optimizedBulletPoints') in the "${targetLang}" language.
The system prompt ('personaSystemPrompt') can contain instructions configured for the sandbox, but the mock interviewer in that prompt should also converse in "${targetLang}".

CRITICAL SPEED & CONCISENESS LIMITS:
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

Maintain zero meta-introduction filler. Let the advice and synthesized system prompts be premium, authoritative, and immediately useful. All human-readable text must be in ${targetLang}.`;

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
          personaSystemPrompt: { type: "string" },
          keyOverlaps: { type: "array", items: { type: "string" } },
          criticalGaps: { type: "array", items: { type: "string" } },
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
          },
          coachingStrategy: { type: "string" }
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

Call the submit_result tool with the structured result. Use clear, engaging Markdown syntax inside appropriate text fields.`;

    const result = await generateStructured({
      system: systemMetaConfigPrompt,
      user: modelingPayload,
      schema: responseSchema,
      maxTokens,
    });

    return Response.json(result);
  } catch (error: any) {
    console.error("Architect function error:", error);

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
3. If your uploaded resume or pasted job description is exceptionally long, try shortening it slightly to reduce the request size.`;
      } else {
        friendlyError = `⚠️ **AI-tjänsten är upptagen just nu**

Förfrågan begränsades tillfälligt. Detta brukar lösa sig inom några sekunder.

**Så här löser du det:**
1. **Vänta några sekunder** och klicka sedan på knappen igen.
2. Undvik att klicka på knappen upprepade gånger i snabb följd.
3. Om dina dokument eller din jobbannons är extremt långa, försök att korta ner dem något.`;
      }
    }

    return Response.json({
      error: friendlyError
    }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/architect"
};
