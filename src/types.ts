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
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  message: string;
  timestamp: string;
}
