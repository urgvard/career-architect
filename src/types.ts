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

export interface ResumeContact {
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
}

export interface ResumeExperience {
  company: string;
  role: string;
  period: string;
  location?: string;
  bullets: string[];
}

export interface ResumeSkills {
  technical: string[];
  tools: string[];
  soft: string[];
}

export interface ResumeEducation {
  degree: string;
  institution: string;
  year: string;
  gpa?: string;
}

export interface ResumeData {
  name: string;
  targetRole: string;
  contact: ResumeContact;
  summary: string;
  experience: ResumeExperience[];
  skills: ResumeSkills;
  education: ResumeEducation[];
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
