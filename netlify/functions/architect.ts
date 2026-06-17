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

    // Shared, non-negotiable writing standard injected into every mode.
    // The single goal of all generated documentation is to earn the candidate an interview,
    // so the language must read as if written by a top-tier native professional, not an AI.
    const writingStandard = `WRITING & LANGUAGE STANDARD (applies to every text field — non-negotiable):
- Write as a fluent native speaker of ${targetLang}. Flawless grammar, spelling, punctuation, idiom and natural word order. Zero translation artifacts, zero anglicisms (unless writing English), zero awkward phrasing.
- Professional recruiting register: confident, warm, precise and credible. Never robotic, never breathless, never salesy.
- Strictly active voice and strong, specific verbs. Cut every filler word, cliché and hollow buzzword ("hardworking team player", "passionate about", "results-driven", "I am writing to apply for").
- Lead with evidence. Quantify impact with concrete numbers, scope and outcomes whenever the source documents support it. Never invent facts, employers, metrics or credentials.
- Mirror the exact terminology, hard skills and keywords used in the job description so the text resonates with both ATS parsers and the human recruiter.
- Vary sentence rhythm so the prose sounds human. Avoid repetitive openings and formulaic AI patterns.
- Use clean, readable Markdown (short paragraphs, bold for emphasis, lists where they aid scanning). Never expose raw schema names, code or meta-commentary to the reader.`;

    let systemMetaConfigPrompt = "";
    let responseSchema: any = null;

    if (mode === "core") {
      systemMetaConfigPrompt = `You are a Principal Technical Recruiter and Executive Career Coach who decides which applicants reach the interview stage.
Your task is to audit the candidate's documents against the target role and produce a sharp, honest, recruiter-grade match analysis that the candidate can act on immediately to secure an interview.

${writingStandard}

CRITICAL INSTRUCTION: Generate ALL human-readable text fields ('title', 'companyName', 'keyOverlaps', 'criticalGaps', 'coachingStrategy') in ${targetLang}.

FIELD-SPECIFIC GUIDANCE:
- "title": The clean, exact job title as a recruiter would write it.
- "companyName": The clean employer/company name only.
- "matchScore": A precise 0-100 integer reflecting genuine fit against the stated requirements — calibrated and defensible, not inflated.
- "keyOverlaps": Up to 5 of the candidate's strongest, most relevant proof points, each phrased as a concrete strength tied to a specific job requirement (not generic praise).
- "criticalGaps": Up to 5 real gaps versus the requirements, each phrased constructively as a risk the candidate must neutralise — never vague.
- "coachingStrategy": A tight, well-structured interview-winning game plan in Markdown (use short bold sub-headings and bullets). Cover: how to frame the strongest overlaps, how to defuse each critical gap, and 2-3 specific talking points or questions that signal the candidate is the obvious hire. Maximum 240 words of genuinely useful, tailored advice — no padding.

Return strictly valid JSON matching the schema. No preamble, no meta-commentary. All human-readable text in ${targetLang}.`;

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
      systemMetaConfigPrompt = `You are an elite Executive Resume Writer and Cover Letter Specialist whose letters consistently get candidates invited to interview.
Your task is to write a compelling, tailored cover letter, sharpen three resume bullet points, and design a realistic mock-interviewer persona — all from the candidate's real documents and the target job.

${writingStandard}

CRITICAL INSTRUCTION: Generate ALL human-readable text fields ('coverLetter', 'personaTitle', and every property inside 'optimizedBulletPoints') in ${targetLang}.
The 'personaSystemPrompt' is a system instruction for a mock-interview chatbot; it may contain configuration language, but instruct that interviewer to converse with the candidate in ${targetLang}.

FIELD-SPECIFIC GUIDANCE:
- "coverLetter": This is the document that wins the interview. Write a complete, properly formatted business letter in Markdown with a genuine structure:
    1. A natural salutation (address the hiring manager/company; use a professional greeting appropriate to ${targetLang} — never "Dear Sir/Madam" boilerplate if a better fit exists).
    2. An opening that hooks in the first sentence by connecting the candidate's single most relevant achievement to what this specific role and company need — no "I am writing to apply for".
    3. One or two body paragraphs of evidence: concrete, quantified accomplishments mapped directly to the job's top requirements and keywords, showing fit and impact.
    4. A short paragraph on motivation/culture fit that is specific to this employer, not generic flattery.
    5. A confident closing with a clear call to action, followed by a professional sign-off and the candidate's name.
  Target roughly 250-350 words of high-quality prose — long enough to persuade, tight enough to respect the reader. Every sentence must earn its place.
- "personaTitle": A specific, credible interviewer identity (e.g. "Senior Engineering Manager, Platform Team").
- "personaSystemPrompt": A concise, high-performance system prompt (max ~180 words) that turns a chatbot into this interviewer for realistic practice, conversing in ${targetLang}.
- "optimizedBulletPoints": Exactly 3 resume bullet upgrades. For each: 'impactArea' (what it strengthens), 'originalSuggestion' (a realistic weak version drawn from the candidate's material), 'optimizedSuggestion' (a strong action-verb-led, quantified, keyword-aligned rewrite), and 'keywordJustification' (which job keywords/competencies it now hits and why a recruiter will notice).

Return strictly valid JSON matching the schema. No preamble, no meta-commentary. All human-readable text in ${targetLang}.`;

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
Your task is to construct a complete, professionally formatted, ATS-optimized resume/CV for the candidate, precisely tailored to the target job so it clears automated screening and earns an interview.

${writingStandard}

CRITICAL EXTRACTION RULES:
- Extract ONLY real information found in the candidate documents. Do NOT invent companies, roles, dates, metrics or qualifications.
- If contact details are missing, use empty strings.
- Generate all professional text (summary, bullet points) in ${targetLang}.

QUALITY RULES:
- Every experience bullet must start with a strong, varied action verb and follow STAR logic (situation/task → action → quantified result) wherever the source supports it. No two bullets should open with the same verb.
- Weave the job description's exact hard skills, tools and keywords naturally into the summary, bullets and skills so ATS parsers score the resume highly — never keyword-stuff.
- "summary": 3-4 sentences — a sharp hook, the candidate's most relevant experience, a quantified value proposition, all tailored to this specific role.
- Capture ALL real experience, skills, education, certifications and achievements present in the documents; phrase each in clean, recruiter-ready language.`;

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
      systemMetaConfigPrompt = `You are a Principal Technical Recruiter, Executive Career Coach, and elite Cover Letter Specialist whose materials consistently get candidates invited to interview.
Your task is to audit the candidate's documents against the target role, produce a recruiter-grade match analysis, write an interview-winning cover letter, sharpen resume bullets, and design a realistic mock-interviewer persona.

${writingStandard}

CRITICAL INSTRUCTION: Generate ALL human-readable text fields ('title', 'companyName', 'personaTitle', 'keyOverlaps', 'criticalGaps', 'coverLetter', 'coachingStrategy', and every property inside 'optimizedBulletPoints') in ${targetLang}.
The 'personaSystemPrompt' is a system instruction for a mock-interview chatbot; it may contain configuration language, but instruct that interviewer to converse in ${targetLang}.

FIELD-SPECIFIC GUIDANCE:
1. "title": The clean, exact job title.
2. "companyName": The clean employer name only.
3. "matchScore": A calibrated, defensible 0-100 integer — never inflated.
4. "personaTitle": A specific, credible interviewer identity (e.g. "Senior Engineering Manager, Platform Team").
5. "personaSystemPrompt": A concise (~180 words) high-performance system prompt that turns a chatbot into this interviewer for realistic practice in ${targetLang}.
6. "keyOverlaps": Up to 5 concrete strengths, each tied to a specific job requirement.
7. "criticalGaps": Up to 5 real gaps versus the requirements, phrased constructively as risks to neutralise.
8. "coverLetter": The document that wins the interview. A complete, properly formatted Markdown business letter — salutation; a first-sentence hook linking the candidate's strongest achievement to this role; one or two evidence paragraphs of quantified, keyword-aligned accomplishments; a specific motivation/fit paragraph; a confident closing with call to action and professional sign-off. Roughly 250-350 words of persuasive, native-fluent prose.
9. "optimizedBulletPoints": Exactly 3 bullet upgrades, each with a weak 'originalSuggestion' and a strong action-verb-led, quantified, keyword-aligned 'optimizedSuggestion' plus 'impactArea' and 'keywordJustification'.
10. "coachingStrategy": A tight Markdown interview game plan (max ~240 words) — how to play the overlaps, defuse each gap, and 2-3 specific talking points that mark the candidate as the obvious hire.

Return strictly valid JSON matching the schema. No preamble, no meta-commentary. Make every output premium, authoritative and immediately usable. All human-readable text in ${targetLang}.`;

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

    const modelingPayload = `Analyse the candidate against this opportunity and produce documentation engineered to win the candidate an interview. Present all reader-facing text in ${targetLang}.

<candidate_documents>
${fullDocumentsContext.trim()}
</candidate_documents>

<job_description>
${resolvedJobText.trim()}
</job_description>

Ground every claim in the candidate documents — never fabricate. Mirror the job description's terminology and keywords. Respond strictly as JSON conforming to the responseSchema, using clean, native-fluent ${targetLang} Markdown inside text fields.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: modelingPayload,
      config: {
        systemInstruction: systemMetaConfigPrompt,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    return Response.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Architect function error:", error);
    
    const errStr = error?.message || String(error);
    let friendlyError = errStr;
    
    if (
      errStr.includes("429") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.includes("quota") ||
      errStr.includes("Quota") ||
      errStr.includes("limit")
    ) {
      if (lang === "en") {
        friendlyError = `⚠️ **Google Gemini Quota Limit Exceeded (Error 429 - RESOURCE_EXHAUSTED)**

You have temporarily exceeded the Google Gemini Free Tier rate limits (which allow a maximum of 15 requests per minute and 250,000 tokens per minute).

**How to easily resolve this:**
1. **Wait 15 seconds**, then click the button again.
2. Avoid clicking the button repeatedly in rapid succession.
3. If your uploaded resume or pasted job description is exceptionally long, try shortening or summarizing the text slightly to reduce the token count.
4. If you have a billing-enabled paid API key, verify that it is properly set up in your Netlify Environment Variables or local .env file.`;
      } else {
        friendlyError = `⚠️ **Begränsning i Google Gemini-kvot (Fel 429 - RESOURCE_EXHAUSTED)**

Du har tillfälligt överskridit gränserna för gratisnivån (som tillåter max 15 anrop per minut och 250 000 ord/tokens per minut).

**Så här löser du det enkelt:**
1. **Vänta 15 sekunder** och klicka sedan på knappen igen.
2. Undvik att klicka på knappen upprepade gånger i snabb följd.
3. Om dina dokument eller din jobbannons är extremt långa, försök att korta ner dem något så att de inte överskrider gränsen.
4. Om du använder en betald API-nyckel, säkerställ att den är korrekt konfigurerad under dina Netlify-miljövariabler eller .env-fil.`;
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
