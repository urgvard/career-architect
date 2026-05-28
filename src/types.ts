export interface UploadFile {
  name: string;
  content: string;
  size: string;
}

export interface BulletOptimization {
  impactArea: string;
  originalSuggestion: string;
  optimizedSuggestion: string;
  keywordJustification: string;
}

export interface ResumeData {
  name: string;
  targetRole: string;
  contact: {
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    website: string;
  };
  summary: string;
  experience: Array<{
    company: string;
    role: string;
    period: string;
    location?: string;
    bullets: string[];
  }>;
  skills: {
    technical: string[];
    tools: string[];
    soft: string[];
  };
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    gpa?: string;
  }>;
  certifications: string[];
  languages: string[];
  achievements: string[];
}

export interface AlignmentResult {
  title: string;
  companyName: string;
  matchScore: number;
  personaTitle: string;
  personaSystemPrompt: string;
  keyOverlaps: string[];
  criticalGaps: string[];
  coverLetter: string;
  optimizedBulletPoints: BulletOptimization[];
  coachingStrategy: string;
  resumeData?: ResumeData;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  message: string;
  timestamp: string;
}
