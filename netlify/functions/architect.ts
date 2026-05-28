import type { Context, Config } from "@netlify/functions";
import { GoogleGenAI, Type } from "@google/genai";

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

    const MAX_DOC_CHARS = 12000;
    if (fullDocumentsContext.length > MAX_DOC_CHARS) {
      fullDocumentsContext = fullDocumentsContext.slice(0, MAX_DOC_CHARS) + "\n[... truncated for processing speed ...]";
    }

    if (!fullDocumentsContext.trim()) {
      return Response.json({ 
        error: lang === "en" ? "Please enter or upload at least one candidate document." : "Vänligen fyll i eller ladda upp minst ett kandidatdokument." 
      }, { status: 400 });
    }

    let resolvedJobText = jobDescription || "";
    if (!resolvedJobText.trim()) {
      return Response.json({
        error: lang === "en" ? "Please paste a Job Description or enter a valid job page URL." : "Vänligen klistra in en jobbannons eller ange en giltig URL."
      }, { status: 400 });
    }

    const MAX_JOB_CHARS = 8000;
    if (resolvedJobText.length > MAX_JOB_CHARS) {
      resolvedJobText = resolvedJobText.slice(0, MAX_JOB_CHARS) + "\n[... truncated for processing speed ...]";
    }

    const ai = new GoogleGenAI({});

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
    } else if (mode === "resume") {
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
        type: Type.OBJECT,
        required: ["resumeData"],
        properties: {
          resumeData: {
            type: Type.OBJECT,
            required: ["name", "targetRole", "contact", "summary", "experience", "skills", "education", "certifications", "languages", "achievements"],
            properties: {
              name: { type: Type.STRING, description: "Candidate full name extracted from documents. Use 'Your Name' if not found." },
              targetRole: { type: Type.STRING, description: "Target job title, tailored to match the job description." },
              contact: {
                type: Type.OBJECT,
                properties: {
                  email:    { type: Type.STRING },
                  phone:    { type: Type.STRING },
                  location: { type: Type.STRING },
                  linkedin: { type: Type.STRING },
                  website:  { type: Type.STRING }
                }
              },
              summary: { type: Type.STRING, description: "3-4 sentence ATS-optimized professional summary tailored to the job." },
              experience: {
                type: Type.ARRAY,
                description: "All work experience extracted from candidate documents.",
                items: {
                  type: Type.OBJECT,
                  required: ["company", "role", "period", "bullets"],
                  properties: {
                    company:  { type: Type.STRING },
                    role:     { type: Type.STRING },
                    period:   { type: Type.STRING, description: "e.g. Jan 2022 \u2013 Mar 2024" },
                    location: { type: Type.STRING },
                    bullets: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "3-5 achievement-focused ATS-optimized bullets per role with quantified results where possible."
                    }
                  }
                }
              },
              skills: {
                type: Type.OBJECT,
                required: ["technical", "soft", "tools"],
                properties: {
                  technical: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Programming languages, frameworks, methodologies." },
                  tools:     { type: Type.ARRAY, items: { type: Type.STRING }, description: "Software tools, platforms, cloud services." },
                  soft:      { type: Type.ARRAY, items: { type: Type.STRING }, description: "Leadership, communication, management competencies." }
                }
              },
              education: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["degree", "institution", "year"],
                  properties: {
                    degree:      { type: Type.STRING },
                    institution: { type: Type.STRING },
                    year:        { type: Type.STRING },
                    gpa:         { type: Type.STRING }
                  }
                }
              },
              certifications: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Professional certifications and licenses." },
              languages:      { type: Type.ARRAY, items: { type: Type.STRING }, description: "e.g. 'Swedish (Native)', 'English (Fluent)'." },
              achievements:   { type: Type.ARRAY, items: { type: Type.STRING }, description: "Notable awards, recognition, or major accomplishments." }
            }
          }
        }
      };

    } else {
      // Default: full combined object (fallback/legacy)
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
      };
    }

    const modelingPayload = `Please evaluate and align this candidate profile with the specified job opportunity, presenting all outcome text in ${targetLang}:

<candidate_documents>
${fullDocumentsContext.trim()}
</candidate_documents>

<job_description>
${resolvedJobText.trim()}
</job_description>

Construct the response conforming strictly to the responseSchema object. Use clear, engaging Markdown syntax inside appropriate text fields.`;

    const GEMINI_TIMEOUT_MS = 23000;
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: modelingPayload,
        config: {
          systemInstruction: systemMetaConfigPrompt,
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), GEMINI_TIMEOUT_MS)
      )
    ]);

    return Response.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Architect function error:", error);
    
    const errStr = error?.message || String(error);
    let friendlyError = errStr;

    if (errStr.includes("GEMINI_TIMEOUT")) {
      return Response.json({
        error: lang === "en"
          ? "The AI model took too long to respond. Please try again."
          : "AI-modellen tog för lång tid att svara. Försök igen.",
        retryable: true
      }, { status: 503 });
    }

    if (
      errStr.includes("429") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.includes("quota") ||
      errStr.includes("Quota") ||
      errStr.includes("limit")
    ) {
      if (lang === "en") {
        friendlyError = `⚠️ **AI Rate Limit Reached (Error 429)**

The AI service is temporarily rate-limited. This usually resolves itself quickly.

**How to resolve this:**
1. **Wait 15 seconds**, then click the button again.
2. Avoid clicking the button repeatedly in rapid succession.
3. If your documents or job description are very long, try shortening them slightly.`;
      } else {
        friendlyError = `⚠️ **AI-hastighetsgräns nådd (Fel 429)**

AI-tjänsten är tillfälligt hastighetsbegränsad. Detta löser sig vanligtvis snabbt.

**Så här löser du det:**
1. **Vänta 15 sekunder** och klicka sedan på knappen igen.
2. Undvik att klicka på knappen upprepade gånger i snabb följd.
3. Om dina dokument eller din jobbannons är mycket långa, försök att korta ner dem något.`;
      }
    }
    
    return Response.json({ 
      error: friendlyError,
      stack: error?.stack,
      details: JSON.stringify(error)
    }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/architect"
};
