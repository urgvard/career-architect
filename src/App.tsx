import React, { useState, useEffect, useRef } from "react";
import { UploadFile, AlignmentResult, BulletOptimization } from "./types";
import SandboxPlayground from "./components/SandboxPlayground";
import {
  UploadCloud,
  FileText,
  Trash2,
  Link,
  Building,
  Briefcase,
  Zap,
  Copy,
  Check,
  Download,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Compass,
  ShieldCheck,
  Play,
  CheckCircle2,
  RefreshCw,
  Sparkle,
  Globe,
  ArrowRight,
  FileDown,
  Sun,
  Moon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

// COMPLETE TRILINGUAL TRANSLATION REGISTRY FOR HIGH VISUAL DENSITY
const TRANSLATIONS = {
  sv: {
    appTitle: "Karriärarkitekten",
    appSub: "Syra och anpassa ditt CV och personliga brev till perfekta matcha-indikatorer. Skapa interaktiva intervjusimulatorer och optimerade meritpunkter baserat på dina unika filer.",
    demoBtnA: "Demo: Systemutvecklare",
    demoBtnB: "Demo: Marknadsförare",
    orPaste: "Eller klistra in material i klartext",
    pastePlaceholderDocs: "Klistra in information om din bakgrund: yrkeserfarenhet, teknisk stack, mätbara resultat, utbildning, nyckelkompetenser...",
    jobUrlLabel: "URL till jobbannons (Läser av automatiskt)",
    jobDescLabel: "Jobbeskrivningstext i detalj",
    jobDescPlaceholder: "Klistra in kravlistor, arbetsbeskrivning, önskad erfarenhet och företagsvärderingar...",
    alignButton: "Justera & Synkronisera Allt Material",
    aligning: "Analyserar universums parametrar ord för ord...",
    logsHeader: "KOMPILERINGSLOGGAR",
    step1: "Läser in dokumentdatabaser och CV...",
    step2: "Hämtar data från jobbannonsens URL...",
    step3: "Analyserar semantiska nyckelordsöverskott...",
    step4: "Formulerar personliga rekryteringskaraktärer...",
    step5: "Syntetiserar professionella personliga brev...",
    step6: "Extraherar branschspecifika KPI-mål till CV...",
    step7: "Slutför källkodsarkitekturen för sandbox...",
    errorTitle: "Ett fel uppstod under processen",
    activeDocuments: "CV & Yrkeserfarenhet",
    uploadedDocs: "Uppladdade dokumentfiler",
    dragDrop: "Dra och släpp dina dokumentfiler här",
    dragDropSub: "Resumé, portfölj, personligt brev eller bios (.txt, .md eller klartext)",
    browseFiles: "Bläddra filer",
    stepText: "STEG",
    jobSpecs: "Målbefattning & Jobbkrav",
    scorecardTitle: "🎯 Matchningsrapport",
    coverLetterTitle: "✉️ Personligt Brev",
    resumeTitle: "✏️ CV-Bullet Optimerare",
    coachingTitle: "💡 Personlig Intervjucoach",
    sandboxTitle: "💬 Intervjusandbox",
    targetMatch: "Sammanfattning av Målmatchning",
    recruiterScore: "Rekryterarens Matchningspoäng",
    tierS: "S-Tier Matchning",
    tierA: "Stark utmanare",
    tierB: "Kompetensluckor finns",
    overlapsTitle: "Huvudsakliga nyckelordsöverlapp",
    gapsTitle: "Viktiga kompetensluckor & krav som saknas",
    coachingStrategyHeader: "Skräddarsydd intervjuguide & strategi",
    coverLetterSubtitle: "Ett färdigt anpassat personligt brev som kopplar din profil till rollen.",
    downloadBtn: "Ladda ner brev (Markdown)",
    downloadSuccess: "Brev nedladdat!",
    copyText: "Kopiera text",
    copied: "Kopierad!",
    resumeSubtitle: "Förvandla generiska meritpunkter till slagkraftiga och sökordsoptimerade resultat.",
    originalLabel: "Original / Standardformulering:",
    optimizedLabel: "Sökordsoptimerad (Med KPI-mätetal):",
    strategyLabel: "Optimeringsstrategi:",
    systemPromptTitle: "LLM Systeminstruktion",
    systemPromptSubtitle: "Denna systeminstruktion konfigurerar externa språkmodeller för att agera som målföretagets rekryterare.",
    playgroundSubtitle: "Träna på intervjuprocessen interaktivt med",
    demoActive: "Aktiv demonstration aktiv",
    downloadBulletsBtn: "Ladda ner meritpunkter (TXT)",
    downloadCoachingBtn: "Ladda ner intervjuguide (MD)",
    downloadAllBundle: "Ladda ner komplett materialpaket (.MD)",
    skipSplash: "Gå direkt till verktyget",
    splashTitle: "Karriärarkitekten",
    splashSub: "Vintergatan möter din yrkesbana. Stjärnorna anpassas för din nästa karriär.",
    splashTimer: "Källkoden förbereds... Träder in om {seconds} sekunder",
    missingKeyTitle: "Lokal API-nyckel saknas",
    missingKeyMessage: "Applikationen behöver din GEMINI_API_KEY för att analysera din profil. Öppna fliken Inställningar > Hemligheter för att lägga till den.",
    feedbackClear: "Rensa fält",
    clearFiles: "Rensa alla",
    packageDownloadTip: "Ladda ner alla genererade filer i ett enda samlat dokument (.md) till din dator",
    quickTips: "Snabbguide för bästa resultat",
    quickTip1: "För CV: inkludera dina specifika mätetal (t.ex. 'ökade försäljning med 20%' eller 'byggde 5 API:er').",
    quickTip2: "För jobbannonsen: klistra in hela beskrivningen inklusive kravspecifikationen.",
    themeLabel: "Tema",
    themeLight: "Ljust",
    themeDark: "Mörkt",
  },
  en: {
    appTitle: "Career Architect",
    appSub: "Sift and align your CV, resume, and portfolios with target job criteria. Generate tailored interview simulators and highly optimized bullet statements recursively.",
    demoBtnA: "Demo: Software Engineer",
    demoBtnB: "Demo: Digital Marketer",
    orPaste: "Or copy-paste materials in plain text",
    pastePlaceholderDocs: "Paste details of your background: work achievements, technical stack, metrics, education, previous job duties...",
    jobUrlLabel: "Job Board URL (Auto crawler enabled)",
    jobDescLabel: "Job Description Specification Text",
    jobDescPlaceholder: "Paste requirements lists, primary job duties, desired experience, and company values...",
    alignButton: "Align & Synthesize Materials",
    aligning: "Analyzing the stars of the universe, word by word...",
    logsHeader: "ALIGNMENT COMPILER LOGS",
    step1: "Accessing active documents context databases...",
    step2: "Scraping text from public job board description URL...",
    step3: "Analyzing semantic overlap & scoring candidates parameters...",
    step4: "Flesh out career persona interviewer profiles...",
    step5: "Synthesizing high-performance cover letter templates...",
    step6: "Sieving resume bullets to extract industry-specific targets...",
    step7: "Compiling final prompt architecture...",
    errorTitle: "An error occurred during process execution",
    activeDocuments: "CV & Professional Background",
    uploadedDocs: "Uploaded document logs",
    dragDrop: "Drag & drop files here",
    dragDropSub: "Resumes, portfolios, cover letters, or bios (.txt, .md, or plaintext)",
    browseFiles: "Browse Files",
    stepText: "STEP",
    jobSpecs: "Target Job Specification Parameters",
    scorecardTitle: "🎯 Match Scorecard",
    coverLetterTitle: "✉️ Cover Letter",
    resumeTitle: "✏️ Resume Bullet Optimizer",
    coachingTitle: "💡 Custom Interview Coach",
    sandboxTitle: "💬 Interview Sandbox",
    targetMatch: "Target Match Summary",
    recruiterScore: "Recruiter Match Score",
    tierS: "S-Tier Profile Alignment",
    tierA: "Strong Contender",
    tierB: "Requirements Gaps Found",
    overlapsTitle: "Key Keyword Overlaps",
    gapsTitle: "Missing Credentials & requirements gaps",
    coachingStrategyHeader: "Tailored Interview Coaching Strategy",
    coverLetterSubtitle: "Custom tailored standard cover letter mapping your metrics to this opportunity.",
    downloadBtn: "Download Cover Letter (Markdown)",
    downloadSuccess: "Cover letter downloaded!",
    copyText: "Copy Text",
    copied: "Copied!",
    resumeSubtitle: "Transform generic, low-impact statements into keyword-infused bullet points.",
    originalLabel: "Original / Standard Bullet:",
    optimizedLabel: "Optimized (Metric & Keyword Infused):",
    strategyLabel: "Alignment Strategy:",
    systemPromptTitle: "System Prompt",
    systemPromptSubtitle: "This system prompt configures model behaviors to simulate target company selectors.",
    playgroundSubtitle: "Interview with",
    demoActive: "Active demonstration loaded",
    downloadBulletsBtn: "Download Optimized Bullets (TXT)",
    downloadCoachingBtn: "Download Coaching Guide (MD)",
    downloadAllBundle: "Download Package (.MD)",
    skipSplash: "Go direct to workspace",
    splashTitle: "Career Architect",
    splashSub: "Where the stars of the universe align with your vocational journey. Prepared with visual cosmic alignments.",
    splashTimer: "Preparing workspaces... Entering in {seconds} seconds",
    missingKeyTitle: "Missing Local API Key Setting",
    missingKeyMessage: "The application needs your GEMINI_API_KEY to analyze your profile. Go to the Settings > Secrets tab to configure it.",
    feedbackClear: "Clear form",
    clearFiles: "Clear all",
    packageDownloadTip: "Download all generated materials inside a single cohesive portfolio markdown file (.md)",
    quickTips: "Quick Tips for Best Output",
    quickTip1: "For CV material: Include actual quantitative metrics (e.g., 'optimized DB by 40%' or 'managed 3 staff').",
    quickTip2: "For target ad: Paste the entire specification structure to capture important keywords.",
    themeLabel: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
  }
};

export default function App() {
  // Splash Screen State & Countdown
  const [splashActive, setSplashActive] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(9);

  // App Global Language Choice
  const [lang, setLang] = useState<"sv" | "en">("sv");

  // App Global Theme Choice
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark"; // default to dark mode for premium look
  });

  // Sync theme class with document root
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Candidate Documents State
  const [documentsPasted, setDocumentsPasted] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  // Job Opportunity State
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");

  // Alignment Compilation State
  const [isAligning, setIsAligning] = useState(false);
  const [alignStep, setAlignStep] = useState("");
  const [alignError, setAlignError] = useState<string | null>(null);
  const [result, setResult] = useState<AlignmentResult | null>(null);

  // Internal Active TAB Interface View
  const [activeTab, setActiveTab] = useState<"match" | "cover-letter" | "resume-bullets" | "system-prompt" | "playground">("match");
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const t = TRANSLATIONS[lang];

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Check API key configuration status at start
  useEffect(() => {
    fetch("/api/apiKeyStatus")
      .then((res) => res.json())
      .then((data) => setHasApiKey(data.hasKey))
      .catch((err) => console.error("Could not load API status:", err));
  }, []);

  // Splash countdown interval
  useEffect(() => {
    if (!splashActive) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setSplashActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [splashActive]);

  // Cosmic fireworks and glistening stars background simulation
  useEffect(() => {
    if (!splashActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track state on window resize
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particles arrays
    interface Star {
      x: number;
      y: number;
      size: number;
      alpha: number;
      blinkSpeed: number;
    }

    interface FireworkParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      alpha: number;
      decay: number;
      gravity: number;
      resistance: number;
    }

    interface Launcher {
      x: number;
      y: number;
      targetY: number;
      speed: number;
      color: string;
      trail: { x: number; y: number }[];
    }

    const stars: Star[] = Array.from({ length: 120 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random(),
      blinkSpeed: 0.005 + Math.random() * 0.015,
    }));

    let particles: FireworkParticle[] = [];
    let launchers: Launcher[] = [];

    const colors = [
      "#34d399", // Emerald
      "#60a5fa", // Blue star
      "#fbcfe8", // Magenta pink
      "#fef08a", // Soft golden yellow
      "#a78bfa", // Electric Violet
      "#cbd5e1", // Diamond White
    ];

    const launchFirework = () => {
      const x = Math.random() * (width - 160) + 80;
      const y = height;
      const targetY = Math.random() * (height * 0.5) + 60;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      launchers.push({
        x,
        y,
        targetY,
        speed: 4 + Math.random() * 4,
        color,
        trail: [],
      });
    };

    const explode = (x: number, y: number, color: string) => {
      const numParticles = 50 + Math.floor(Math.random() * 40);
      for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 1;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          alpha: 1.0,
          decay: 0.012 + Math.random() * 0.015,
          gravity: 0.08,
          resistance: 0.98,
        });
      }
    };

    // Initialize with a few ambient fireworks right away
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (splashActive) launchFirework();
      }, i * 1600);
    }

    // Interval to spawn new launchers
    const spawnInterval = setInterval(() => {
      launchFirework();
    }, 1200);

    // Main animation loop
    const animate = () => {
      ctx.fillStyle = "rgba(10, 10, 12, 0.25)";
      ctx.fillRect(0, 0, width, height);

      // 1. Twinkling Stars
      stars.forEach((s) => {
        s.alpha += s.blinkSpeed;
        if (s.alpha > 1 || s.alpha < 0.1) {
          s.blinkSpeed = -s.blinkSpeed;
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Launchers tracking
      launchers = launchers.filter((l) => {
        l.y -= l.speed;
        l.trail.push({ x: l.x, y: l.y });
        if (l.trail.length > 8) l.trail.shift();

        // Draw trail
        ctx.beginPath();
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 2.5;
        if (l.trail.length > 0) {
          ctx.moveTo(l.trail[0].x, l.trail[0].y);
          for (let j = 1; j < l.trail.length; j++) {
            ctx.lineTo(l.trail[j].x, l.trail[j].y);
          }
          ctx.stroke();
        }

        // Check target triggers
        if (l.y <= l.targetY) {
          explode(l.x, l.y, l.color);
          return false;
        }
        return true;
      });

      // 3. Explosion Particles tracking
      particles = particles.filter((p) => {
        p.vx *= p.resistance;
        p.vy *= p.resistance;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) return false;

        ctx.fillStyle = p.color;
        // Make particles glitter
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.random() * 2 + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        return true;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(spawnInterval);
      cancelAnimationFrame(animationFrameId);
    };
  }, [splashActive]);

  // Quick helper to read dropped files client-side
  const readAndAddFiles = (filesList: File[]) => {
    filesList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const sizeStr = (file.size / 1024).toFixed(1) + " KB";
        setUploadedFiles((prev) => [
          ...prev,
          { name: file.name, content: text, size: sizeStr },
        ]);
      };
      reader.readAsText(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      readAndAddFiles(Array.from(e.target.files));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      readAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAllFiles = () => {
    setUploadedFiles([]);
  };

  // Run Document-to-Job alignment cognitive pipeline
  const handleAlignAndArchitect = async () => {
    const hasPastedDocs = !!documentsPasted.trim();
    const hasUploaded = uploadedFiles.length > 0;
    if (!hasPastedDocs && !hasUploaded) {
      setAlignError(lang === "en" ? "Please fill or drag candidates profile resume details first." : "Vänligen fyll i eller klistra in din meritförteckning/CV först.");
      return;
    }

    const hasPastedJob = !!jobDescription.trim();
    const hasJobUrl = !!jobUrl.trim();
    if (!hasPastedJob && !hasJobUrl) {
      setAlignError(lang === "en" ? "Please paste target Job specifications or write job URL query." : "Vänligen klistra in en jobbannons eller ange en giltig sökväg.");
      return;
    }

    setAlignError(null);
    setIsAligning(true);

    const stages = [
      t.step1,
      jobUrl ? t.step2 : t.step3,
      t.step4,
      t.step5,
      t.step6,
      t.step7,
    ];

    for (let i = 0; i < stages.length; i++) {
      setAlignStep(stages[i]);
      await new Promise((resolve) => setTimeout(resolve, 310));
    }

    try {
      const [coreRes, matRes] = await Promise.all([
        fetch("/api/architect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentsPasted,
            uploadedFiles,
            jobDescription,
            jobUrl,
            lang,
            mode: "core",
          }),
        }),
        fetch("/api/architect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentsPasted,
            uploadedFiles,
            jobDescription,
            jobUrl,
            lang,
            mode: "materials",
          }),
        })
      ]);

      if (!coreRes.ok) {
        let errMsg = `Pipeline failed: Server status ${coreRes.status}`;
        try {
          const errData = await coreRes.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      if (!matRes.ok) {
        let errMsg = `Pipeline failed: Server status ${matRes.status}`;
        try {
          const errData = await matRes.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const coreData = await coreRes.json();
      const matData = await matRes.json();

      const parsed: AlignmentResult = {
        ...coreData,
        ...matData
      };
      setResult(parsed);
      setActiveTab("match");
    } catch (err: any) {
      console.error("Pipeline failure:", err);
      setAlignError(err?.message || "Error during system alignment calculation.");
    } finally {
      setIsAligning(false);
    }
  };

  // Clipboard copies helper
  const triggerCopy = (key: string, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedStates((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  // Tailored Downloads
  const downloadCoverLetter = () => {
    if (!result) return;
    const blob = new Blob([result.coverLetter], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tailored-Cover-Letter-${result.companyName.replace(/\s+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadOptimizedBullets = () => {
    if (!result) return;
    let textOut = `=== OPTIMERADE MERITPUNKTER (CV-BULLETS) - ${result.title} @ ${result.companyName} ===\n\n`;
    result.optimizedBulletPoints.forEach((b, i) => {
      textOut += `[PUNKTET ${i + 1}: ${b.impactArea}]\n`;
      textOut += `Original: "${b.originalSuggestion}"\n`;
      textOut += `Optimerad: "${b.optimizedSuggestion}"\n`;
      textOut += `Justering: ${b.keywordJustification}\n\n`;
    });
    const blob = new Blob([textOut], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tuned-Resume-Bullets-${result.companyName.replace(/\s+/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadCoachingGuide = () => {
    if (!result) return;
    const blob = new Blob([result.coachingStrategy], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Interview-Preparation-Guide-${result.companyName.replace(/\s+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Beautiful Comprehensive markdown all-in-one bundle file
  const downloadCompleteAllInOnePackage = () => {
    if (!result) return;
    let fullTxt = `# KARRIÄRARKITEKTEN DOSSIER: MATERIALPAKET\n`;
    fullTxt += `Målroll: **${result.title}**\n`;
    fullTxt += `Företag: **${result.companyName}**\n`;
    fullTxt += `Matchningsscore: **${result.matchScore}%**\n`;
    fullTxt += `Språk: **${lang === "sv" ? "Svenska" : "English"}**\n\n`;
    fullTxt += `---\n\n`;
    
    fullTxt += `## 1. ✉️ SKRÄDDARSYTT PERSONLIGT BREV\n\n`;
    fullTxt += `${result.coverLetter}\n\n`;
    fullTxt += `---\n\n`;

    fullTxt += `## 2. ✏️ ARBETSFÖRLOPP: OPTIMERADE MERITPUNKTER (CV)\n\n`;
    result.optimizedBulletPoints.forEach((b, idx) => {
      fullTxt += `### Suggestion ${idx + 1}: ${b.impactArea}\n`;
      fullTxt += `* **Före (Standard)**: _${b.originalSuggestion}_\n`;
      fullTxt += `* **Efter (Slagkraftig)**: **${b.optimizedSuggestion}**\n`;
      fullTxt += `* *Strategisk justering*: ${b.keywordJustification}\n\n`;
    });
    fullTxt += `---\n\n`;

    fullTxt += `## 3. 💡 INTERVJUCOACH & TACKTISK COACHINGSTRATEGI\n\n`;
    fullTxt += `${result.coachingStrategy}\n\n`;
    fullTxt += `---\n\n`;

    fullTxt += `*Skapat automatiskt via Karriärarkitekten - ${new Date().toLocaleDateString()}*\n`;

    const blob = new Blob([fullTxt], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Complete-Career-Package-${result.companyName.replace(/\s+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Preloaded interactive demos
  const loadDemoA = () => {
    if (lang === "sv") {
      setDocumentsPasted(
        "NAMN: Marcus Vance\nROLL: Senior Systemutvecklare\nERFARENHET: 6 års fullstack-utveckling. Byggt relationsdatabaser i PostgreSQL. Ansvarat för arkitekturella beslut vid övergången till AWS lambda mikrotjänster. Expert på TypeScript, Node, React/Next.js och Tailwind CSS. Erfarenhet av teamledarskap och kontinuerlig driftsättning (CI/CD)."
      );
      setJobDescription(
        "Titel: Lead Frontend Engineer\nFöretag: Stripe\nKrav: 5+ års erfarenhet av att bygga distribuerade gränssnitt med extremt hög tillgänglighet. Perfekt kontroll över JavaScript, TypeScript och React. Stort öga för detaljer, CSS, prestandaoptimering och designsystem. Bekant med mikrografer och källkodsintegrering."
      );
    } else {
      setDocumentsPasted(
        "NAME: Marcus Vance\nROLE: Senior Software Engineer\nEXPERIENCE: 6 years full-stack development. Built highly relational databases in Postgres. Guided architectural decisions for an e-commerce platform transitioning to AWS lambda microservices. Experienced in TypeScript, Node, React/Next.js, Tailwind, Jest and Cypress."
      );
      setJobDescription(
        "Job Title: Lead Frontend Engineer\nCompany: Stripe\nRequirements: 5+ years of experience constructing high-availability interfaces. Perfect control over Javascript/Typescript frameworks. Deep attention to layout precision, CSS, and component systems. Familiarity with micro-frontend architectures is a strong plus."
      );
    }
    setJobUrl("");
  };

  const loadDemoB = () => {
    if (lang === "sv") {
      setDocumentsPasted(
        "NAMN: Siobhan Kelly\nSPECIALITET: Growth Marketing Manager / Tillväxtansvarig\nKOMPETENSER: SEO-sökordsanalys, Google AdWords-optimering, kundanskaffning, innehållsstrategi samt budgetansvar.\nHISTORIA: Skalade SaaS-kundregistreringen med 140% månad-för-månad. Ansvarade personligen för 450.000kr i månatliga annonsinvesteringar."
      );
      setJobDescription(
        "Vi söker en Lead Digital Content Specialist som tar över innehålls- och tillväxtpipelines hos ett snabbväxande fintech-startup. Krav: djup sökmotoroptimering, författa polerade texter under strikt varumärkeskontroll, köra målinriktade kampanjrevisioner samt mäta abonnenttillväxt organiskt."
      );
    } else {
      setDocumentsPasted(
        "NAME: Siobhan Kelly\nSPECIALTY: Growth Marketing Manager\nSKILLS: SEO keyword strategies, Google Ad optimization, client acquisition, content marketing strategies, copy deck execution, budget management.\nHISTORY: Scaled SaaS customer registrations by 140% month-over-month. Direct responsibility for $45K monthly ad capital allocation."
      );
      setJobDescription(
        "Looking for a Lead Digital Content Specialist to own the content marketing pipeline at a high-growth fintech startup. Requirements: deep SEO optimization, writing polished, high-density copy decks under strict brand rules, running content audits, and measuring subscriber growth metrics across organic channels."
      );
    }
    setJobUrl("");
  };

  // Skip the intro sequence immediately
  const skipSplashSequence = () => {
    setSecondsLeft(0);
    setSplashActive(false);
  };

  // SPLASH SCREEN OVERLAY (9 SECONDS)
  if (splashActive) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-neutral-950 flex flex-col items-center justify-between p-6 select-none font-sans">
        {/* Render animated stars and burst fireworks */}
        <canvas ref={canvasRef} className="absolute inset-0 block z-0" />

        {/* Header Indicator */}
        <div className="z-10 w-full max-w-6xl flex justify-between items-center text-white/50 font-mono text-xs pt-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>METRIC ALIGNMENT ONLINE</span>
          </div>
          <div className="relative flex items-center bg-neutral-900 border border-neutral-800 p-0.5 rounded-lg select-none">
            {/* Sliding backdrop element */}
            <div 
              className="absolute top-0.5 bottom-0.5 rounded bg-neutral-800 border border-neutral-750 transition-all duration-300 shadow"
              style={{
                left: lang === "sv" ? "2px" : "calc(50% - 1px)",
                width: "calc(50% - 1px)"
              }}
            />
            <button
              type="button"
              onClick={() => setLang("sv")}
              className={`relative z-10 text-[10px] px-3.5 py-1.5 rounded font-black tracking-wide uppercase transition-colors duration-200 select-none cursor-pointer ${
                lang === "sv" ? "text-emerald-400" : "text-neutral-400 hover:text-white"
              }`}
            >
              Svenska
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`relative z-10 text-[10px] px-3.5 py-1.5 rounded font-black tracking-wide uppercase transition-colors duration-200 select-none cursor-pointer ${
                lang === "en" ? "text-emerald-400" : "text-neutral-400 hover:text-white"
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Central Dynamic Timer Presentation */}
        <div className="z-10 text-center space-y-6 max-w-xl px-4 my-auto flex flex-col items-center">
          {/* Animated Glowing Icon */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 animate-bounce">
            <Sparkle className="w-8 h-8 animate-spin" style={{ animationDuration: "6s" }} />
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tight text-white drop-shadow-md">
              {t.splashTitle}
            </h1>
            <p className="text-neutral-400 text-xs md:text-sm font-light leading-relaxed">
              {t.splashSub}
            </p>
          </div>

          {/* Countdown display */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <span className="text-6xl font-serif font-black text-emerald-400 font-mono animate-pulse">
                {secondsLeft}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 uppercase tracking-widest font-mono">
              {t.splashTimer.replace("{seconds}", secondsLeft.toString())}
            </p>
          </div>
        </div>

        {/* Direct Skip Access Button */}
        <div className="z-10 pb-8">
          <button
            type="button"
            onClick={skipSplashSequence}
            className="group px-6 py-2.5 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-full text-xs font-bold text-neutral-200 hover:text-white transition flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur"
          >
            <span>{t.skipSplash}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 font-sans text-neutral-800 dark:text-neutral-200 antialiased relative">
      {/* Visual top dark canvas plate */}
      <div className="absolute top-0 left-0 right-0 h-[340px] bg-neutral-900 border-b border-neutral-800 -z-10" />

      <div className="w-full max-w-7xl mx-auto px-4 py-8 md:py-10">
        
        {/* UPPER CONTROLS & HEADER */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8 text-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-1 px-2 bg-emerald-500/20 text-emerald-300 rounded font-mono text-[9px] font-bold uppercase tracking-wider">
                Svenska standard • Version 2.0
              </span>
              <span className="text-neutral-400 font-mono text-xs">• Stockholm Core API</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight font-serif flex items-center gap-2.5">
              {t.appTitle} <Compass className="w-6 h-6 text-emerald-400 self-center shrink-0" strokeWidth={2.5} />
            </h1>
            <p className="text-neutral-400 text-xs md:text-sm max-w-2xl leading-relaxed mt-4">
              {t.appSub}
            </p>
          </div>

          {/* DUAL TOGGLE HEADERS (LANGUAGE & THEME) */}
          <div className="flex flex-wrap items-center gap-4 bg-neutral-900 border border-neutral-800 rounded-xl p-2 shrink-0 shadow-lg">
            {/* Language Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pl-1.5 hidden sm:inline-flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-neutral-500" /> {lang === "sv" ? "Språk" : "Language"}:
              </span>
              <div className="relative flex items-center bg-neutral-950 border border-neutral-850 p-0.5 rounded-lg select-none">
                <div 
                  className="absolute top-0.5 bottom-0.5 rounded bg-neutral-800 border border-neutral-750 transition-all duration-300 shadow"
                  style={{
                    left: lang === "sv" ? "2px" : "calc(50% - 1px)",
                    width: "calc(50% - 1px)"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setLang("sv")}
                  className={`relative z-10 text-[11px] px-3.5 py-1.5 rounded font-black transition-colors duration-200 select-none cursor-pointer ${
                    lang === "sv" ? "text-emerald-450" : "text-neutral-450 hover:text-neutral-200"
                  }`}
                >
                  Svenska
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  className={`relative z-10 text-[11px] px-3.5 py-1.5 rounded font-black transition-colors duration-200 select-none cursor-pointer ${
                    lang === "en" ? "text-emerald-450" : "text-neutral-450 hover:text-neutral-200"
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Theme Toggle */}
            <div className="flex items-center gap-2 border-l border-neutral-800 pl-4">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pl-0.5 hidden sm:inline-flex items-center gap-1">
                {t.themeLabel}:
              </span>
              <div className="relative flex items-center bg-neutral-950 border border-neutral-850 p-0.5 rounded-lg select-none">
                <div 
                  className="absolute top-0.5 bottom-0.5 rounded bg-neutral-800 border border-neutral-750 transition-all duration-300 shadow"
                  style={{
                    left: theme === "light" ? "2px" : "calc(50% - 1px)",
                    width: "calc(50% - 1px)"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`relative z-10 text-[11px] px-3 py-1.5 rounded font-black transition-colors duration-200 select-none cursor-pointer flex items-center gap-1.5 ${
                    theme === "light" ? "text-white" : "text-neutral-450 hover:text-neutral-200"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>{t.themeLight}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`relative z-10 text-[11px] px-3 py-1.5 rounded font-black transition-colors duration-200 select-none cursor-pointer flex items-center gap-1.5 ${
                    theme === "dark" ? "text-white" : "text-neutral-450 hover:text-neutral-200"
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>{t.themeDark}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* API KEY ALERTS CARD */}
        {hasApiKey === false && (
          <div className="mb-6 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/15 text-yellow-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">{t.missingKeyTitle}</p>
              <p className="text-neutral-300">{t.missingKeyMessage}</p>
            </div>
          </div>
        )}

        {/* SYSTEM WORKSPACE WRAPPER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: SIMPLIFIED TARGET INPUTS (5 columns) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Input Module 1: Material and Resume uploads */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="p-4 border-b border-neutral-150 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    {t.activeDocuments}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-400 font-bold">{t.stepText} 1</span>
                  {uploadedFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllFiles}
                      className="text-[9px] text-red-500 font-bold hover:underline cursor-pointer"
                    >
                      {t.clearFiles}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Drag-and-drop zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
                    isDragActive
                      ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20"
                      : "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/10 hover:bg-neutral-100/30 dark:hover:bg-neutral-950/30"
                  }`}
                >
                  <UploadCloud className="w-6 h-6 text-neutral-400 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 leading-none">{t.dragDrop}</p>
                  <p className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1 leading-normal">{t.dragDropSub}</p>
                  
                  <label className="mt-2.5 inline-block px-3 py-1 bg-white dark:bg-neutral-800 border border-neutral-250 dark:border-neutral-700 text-neutral-600 dark:text-neutral-350 rounded text-[10px] font-bold shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-750 transition cursor-pointer">
                    {t.browseFiles}
                    <input
                      id="file-upload-input"
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* File list indicators */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-1 rounded bg-neutral-50 dark:bg-neutral-950/20 p-2.5 border border-neutral-200 dark:border-neutral-800">
                    <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none mb-1.5">
                      {t.uploadedDocs} ({uploadedFiles.length})
                    </p>
                    {uploadedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-white dark:bg-neutral-850 p-2 rounded border border-neutral-200 dark:border-neutral-750 shadow-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300 truncate">{file.name}</span>
                          <span className="text-[10px] text-neutral-400">({file.size})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="text-neutral-405 hover:text-red-500 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Paste Area */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                      {t.orPaste}
                    </label>
                    {documentsPasted && (
                      <button
                        type="button"
                        onClick={() => setDocumentsPasted("")}
                        className="text-[9px] text-neutral-400 dark:text-neutral-500 hover:text-red-500 hover:underline"
                      >
                        {t.feedbackClear}
                      </button>
                    )}
                  </div>
                  <textarea
                    id="documents-pasted-textarea"
                    rows={5}
                    value={documentsPasted}
                    onChange={(e) => setDocumentsPasted(e.target.value)}
                    placeholder={t.pastePlaceholderDocs}
                    className="w-full text-xs p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-700 focus:bg-white dark:focus:bg-neutral-900 transition-all leading-relaxed font-sans dark:text-neutral-200 custom-scrollbar"
                  />
                </div>
              </div>
            </div>

            {/* Input Module 2: Job description pasting and Web crawler */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="p-4 border-b border-neutral-150 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    {t.jobSpecs}
                  </h2>
                </div>
                <span className="text-[10px] text-neutral-400 font-bold">{t.stepText} 2</span>
              </div>

              <div className="p-4 space-y-4">
                {/* Web Link crawler */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                    {t.jobUrlLabel}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                      <Link className="w-3.5 h-3.5" />
                    </span>
                    <input
                      id="job-url-input"
                      type="url"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="e.g. https://careers.company.com/jobs/role"
                      className="w-full text-xs pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-700 focus:bg-white dark:focus:bg-neutral-900 transition-all dark:text-neutral-200"
                    />
                  </div>
                </div>

                {/* Job description text paste selection */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                      {t.jobDescLabel}
                    </label>
                    {jobDescription && (
                      <button
                        type="button"
                        onClick={() => setJobDescription("")}
                        className="text-[9px] text-neutral-400 dark:text-neutral-500 hover:text-red-500 hover:underline"
                      >
                        {t.feedbackClear}
                      </button>
                    )}
                  </div>
                  <textarea
                    id="job-desc-textarea"
                    rows={5}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder={t.jobDescPlaceholder}
                    className="w-full text-xs p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-700 focus:bg-white dark:focus:bg-neutral-900 transition-all leading-relaxed font-sans dark:text-neutral-200 custom-scrollbar"
                  />
                </div>
              </div>
            </div>

            {/* CORE COMPILATION RUN TRIGGER */}
            <button
              id="align-compile-btn"
              type="button"
              disabled={isAligning || (!documentsPasted.trim() && uploadedFiles.length === 0)}
              onClick={handleAlignAndArchitect}
              className="group relative w-full py-3.5 px-6 bg-neutral-900 dark:bg-emerald-600 border border-neutral-800 dark:border-emerald-500 text-white rounded-xl font-bold font-serif text-sm tracking-wide shadow-md transition-all duration-300 enabled:hover:bg-neutral-850 dark:enabled:hover:bg-emerald-700 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-3 overflow-hidden"
            >
              <Zap className={`w-4 h-4 text-emerald-300 ${isAligning ? "animate-bounce" : "group-hover:scale-110 transition-transform"}`} />
              {isAligning ? t.aligning : t.alignButton}
            </button>

            {/* Quick Demo Assist Links */}
            <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <h4 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none">
                PRELOAD CORE DEMO SAMPLES
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={loadDemoA}
                  className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/60 dark:hover:bg-neutral-850 leading-tight transition select-none cursor-pointer"
                >
                  {t.demoBtnA}
                </button>
                <button
                  type="button"
                  onClick={loadDemoB}
                  className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/60 dark:hover:bg-neutral-850 leading-tight transition select-none cursor-pointer"
                >
                  {t.demoBtnB}
                </button>
              </div>
            </div>

            {/* Compilation status screen logger */}
            {isAligning && alignStep && (
              <div className="p-3 bg-neutral-900 text-emerald-400 border border-neutral-800 rounded-lg font-mono text-[10px] space-y-1.5 animate-pulse shadow-sm">
                <div className="flex justify-between text-neutral-400 text-[8px]">
                  <span>{t.logsHeader}</span>
                  <span>STOCKHOLM CORE</span>
                </div>
                <p className="text-white truncate">&gt; {alignStep}</p>
              </div>
            )}

            {/* Run error logs */}
            {alignError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-1 text-red-600" />
                <div className="text-xs space-y-1.5 flex-1 select-text">
                  <h4 className="font-bold text-[13px] text-red-900 mb-0.5">{t.errorTitle}</h4>
                  <div className="prose prose-red text-red-800 font-sans max-w-none text-[11px] leading-relaxed">
                    <ReactMarkdown>{alignError}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Practical instructions panel */}
            <div className="p-4.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 text-xs text-neutral-500">
              <p className="font-bold text-neutral-600 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Sparkle className="w-3.5 h-3.5 text-emerald-500" /> {t.quickTips}
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-[11px] leading-relaxed">
                <li>{t.quickTip1}</li>
                <li>{t.quickTip2}</li>
              </ul>
            </div>
          </div>

          {/* RIGHT: ALIGNED MATERIALS VIEWPORT & DOWNLOAD SERVICES (7 columns) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-md border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              
              {/* Tab navigation headers */}
              <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/20 px-3 flex items-center justify-between">
                <div className="flex flex-nowrap w-full gap-1 py-1.5 overflow-x-auto select-none no-scrollbar">
                  {[
                    { id: "match", label: t.scorecardTitle },
                    { id: "cover-letter", label: t.coverLetterTitle },
                    { id: "resume-bullets", label: t.resumeTitle },
                    { id: "system-prompt", label: t.systemPromptTitle },
                    { id: "playground", label: t.sandboxTitle },
                  ].map((tab) => {
                    const isSelected = activeTab === tab.id;
                    const isDisabled = !result && tab.id !== "match";
                    return (
                      <button
                        key={tab.id}
                        id={`tab-btn-${tab.id}`}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`text-xs px-3 py-1.5 rounded-md font-semibold font-sans transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-white dark:bg-neutral-800 text-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-700 shadow-sm"
                            : "text-neutral-500 dark:text-neutral-450 hover:text-neutral-800 dark:hover:text-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Central Report Body Container */}
              <div className="p-5 min-h-[520px]">
                
                {/* Empty State Instructions */}
                {!result ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 max-w-md mx-auto">
                    <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-950 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-850 shadow-inner text-neutral-400">
                      <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                        {lang === "sv" ? "Inga material genererade ännu" : "No materials calculated yet"}
                      </h3>
                      <p className="text-xs text-neutral-400 dark:text-neutral-550 leading-normal">
                        {lang === "sv"
                          ? "Skicka din yrkesbeskrivning till vänster och klicka på synkronisera för att automatiskt skräddarsy personliga brev och meritpunkter."
                          : "Upload or paste your professional materials and target job parameters to trigger immediate localized alignments."}
                      </p>
                    </div>

                    <div className="w-full bg-neutral-50 dark:bg-neutral-950/20 p-4 rounded-xl border border-neutral-200 dark:border-neutral-850 text-left text-[11px] text-neutral-500 dark:text-neutral-400 space-y-2">
                      <p className="font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-widest text-[9px]">
                        {lang === "sv" ? "Följande filer kommer skapas:" : "Materials ready to be synthesized:"}
                      </p>
                      <ul className="space-y-1.5">
                        <li className="flex gap-2 items-start">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span><strong className="text-neutral-700 dark:text-neutral-350">{t.scorecardTitle}:</strong> {lang === "sv" ? "Fullständig kompetensrevision och score." : "Detailed gaps and keyword overlapping analysis."}</span>
                        </li>
                        <li className="flex gap-2 items-start">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span><strong className="text-neutral-700 dark:text-neutral-350">{t.coverLetterTitle}:</strong> {lang === "sv" ? "Högpresterande personligt brev direkt anpassat." : "Ready-to-copy matching standard letter."}</span>
                        </li>
                        <li className="flex gap-2 items-start">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span><strong className="text-neutral-700 dark:text-neutral-350">{t.resumeTitle}:</strong> {lang === "sv" ? "Reviderade meritpunkter med optimala sökord." : "Tuned bullet statement metric revisions."}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">

                    {/* UNIFIED SIMPLIFIED DOWNLOAD BANNER - PROMINENT EXPORT OPTION */}
                    <div className="p-4 bg-emerald-50/15 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100 border border-emerald-250 dark:border-emerald-800/60 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1 text-center sm:text-left">
                        <span className="p-0.5 px-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-350 rounded font-mono text-[9px] font-bold uppercase">
                          {lang === "sv" ? "KOMPLETT DOSSIER" : "COMPLETE PACKAGE"}
                        </span>
                        <h4 className="text-xs font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-1.5 justify-center sm:justify-start">
                          {lang === "sv" ? "Hämta allt genererat material" : "Download All Aligned Materials"}
                        </h4>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-450">
                          {t.packageDownloadTip}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={downloadCompleteAllInOnePackage}
                        className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-serif shadow-md transition shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <FileDown className="w-4 h-4" />
                        {t.downloadAllBundle}
                      </button>
                    </div>

                    {/* TAB VIEWPORT: CARD INDEX_1: Match Score & Strategy Details */}
                    {activeTab === "match" && (
                      <div className="space-y-5 animate-fadeIn">
                        
                        {/* Rating block header with radial ring gauge */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-150 dark:border-neutral-800 rounded-xl">
                          <div className="space-y-1 text-center sm:text-left">
                            <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none">
                              {t.targetMatch}
                            </h3>
                            <h2 className="text-lg font-black text-neutral-800 dark:text-white tracking-tight">
                              {result.title}
                            </h2>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-450">
                              {lang === "sv" ? "hos" : "at"}{" "}
                              <strong className="text-neutral-700 dark:text-neutral-355">{result.companyName}</strong>
                            </p>
                          </div>

                          {/* Matching radial feedback diagram */}
                          <div className="flex items-center gap-3 bg-white dark:bg-neutral-800 p-3 border border-neutral-150 dark:border-neutral-750 rounded-lg shadow-sm shrink-0">
                            <div className="relative flex items-center justify-center">
                              <svg className="w-12 h-12 transform -rotate-90">
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  stroke={theme === "dark" ? "#262626" : "#e5e5e5"}
                                  strokeWidth="4"
                                  fill="transparent"
                                />
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  stroke="#10b981"
                                  strokeWidth="4"
                                  fill="transparent"
                                  strokeDasharray={125.6}
                                  strokeDashoffset={125.6 - (125.6 * result.matchScore) / 100}
                                />
                              </svg>
                              <span className="absolute text-xs font-black text-neutral-800 dark:text-neutral-100">
                                {result.matchScore}%
                              </span>
                            </div>
                            <div className="text-right leading-none">
                              <span className="block text-[8px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
                                {t.recruiterScore}
                              </span>
                              <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                                {result.matchScore >= 80 ? t.tierS : result.matchScore >= 60 ? t.tierA : t.tierB}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Keyword overlaps side-by-side layout box */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border border-neutral-200 rounded-lg p-3 bg-emerald-50/10 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold uppercase tracking-wider">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              {t.overlapsTitle} ({result.keyOverlaps.length})
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {result.keyOverlaps.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-white text-emerald-800 px-2 py-0.5 rounded border border-emerald-200/50 font-semibold"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="border border-neutral-200 rounded-lg p-3 bg-red-50/10 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs text-red-800 font-bold uppercase tracking-wider">
                              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                              {t.gapsTitle} ({result.criticalGaps.length})
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {result.criticalGaps.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-white text-red-800 px-2 py-0.5 rounded border border-red-200/50 font-semibold"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Custom interview strategy presentation */}
                        <div className="border border-neutral-200 rounded-xl p-4.5 bg-white space-y-3 shadow-sm">
                          <div className="flex justify-between items-center bg-neutral-50 p-2 border-b border-neutral-150 rounded-t">
                            <h4 className="text-xs font-bold text-neutral-750 uppercase tracking-wider flex items-center gap-1.5">
                              <Compass className="w-4 h-4 text-emerald-500" />
                              {t.coachingStrategyHeader}
                            </h4>
                            <button
                              type="button"
                              onClick={downloadCoachingGuide}
                              className="text-[10px] font-bold text-neutral-600 hover:text-emerald-600 transition flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {t.downloadCoachingBtn}
                            </button>
                          </div>
                          <div className="text-xs text-neutral-600 leading-relaxed font-sans prose prose-neutral max-w-none">
                            <ReactMarkdown>{result.coachingStrategy}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB VIEWPORT: CARD INDEX_2: Tailored Cover Letter */}
                    {activeTab === "cover-letter" && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 bg-neutral-50 p-3 rounded-lg border border-neutral-150">
                          <div>
                            <h4 className="text-xs font-bold text-neutral-850 uppercase tracking-wider">
                              {t.coverLetterTitle} {lang === "en" ? "Draft" : "Utkast"}
                            </h4>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              {t.coverLetterSubtitle}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => triggerCopy("cover-letter", result.coverLetter)}
                              className="px-2.5 py-1.5 border border-neutral-250 hover:bg-neutral-50 transition rounded text-xs font-bold text-neutral-600 flex items-center gap-1 cursor-pointer shadow-sm bg-white"
                            >
                              {copiedStates["cover-letter"] ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  {t.copied}
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  {t.copyText}
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={downloadCoverLetter}
                              className="px-2.5 py-1.5 border border-neutral-250 hover:bg-neutral-100/60 transition rounded text-xs font-bold text-neutral-600 flex items-center gap-1 cursor-pointer shadow-sm bg-white"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {t.downloadBtn}
                            </button>
                          </div>
                        </div>

                        {/* Letter View text panel */}
                        <div className="border border-neutral-200 bg-neutral-50/20 rounded-xl p-6 font-serif text-sm tracking-wide text-neutral-800 max-h-[460px] overflow-y-auto whitespace-pre-wrap select-all shadow-inner leading-relaxed leading-7">
                          <ReactMarkdown>{result.coverLetter}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* TAB VIEWPORT: CARD INDEX_3: Optimized bullet translations */}
                    {activeTab === "resume-bullets" && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 bg-neutral-50 p-3 rounded-lg border border-neutral-150">
                          <div>
                            <h4 className="text-xs font-bold text-neutral-850 uppercase tracking-wider">
                              {t.resumeTitle}
                            </h4>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              {t.resumeSubtitle}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={downloadOptimizedBullets}
                            className="px-3 py-1.5 bg-white border border-neutral-250 hover:bg-neutral-100/60 transition rounded text-xs font-bold text-neutral-600 flex items-center gap-1 cursor-pointer shadow-sm shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {t.downloadBulletsBtn}
                          </button>
                        </div>

                        {/* Side by side adjustments lists */}
                        <div className="space-y-4">
                          {result.optimizedBulletPoints.map((b: BulletOptimization, i: number) => (
                            <div
                              key={i}
                              className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm space-y-3 p-4 bg-neutral-50/20"
                            >
                              {/* Element adjustment details */}
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] bg-neutral-200 text-neutral-700 font-bold uppercase tracking-wider px-2 py-0.5 rounded leading-none">
                                  {lang === "sv" ? "Bulletförslag" : "Bullet Suggestion"} {i + 1}: {b.impactArea}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => triggerCopy(`bullet-${i}`, b.optimizedSuggestion)}
                                  className="text-neutral-500 hover:text-neutral-900 transition flex items-center gap-1 text-[10px] font-bold"
                                >
                                  {copiedStates[`bullet-${i}`] ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      {t.copied}
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      {t.copyText}
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Adjusted elements original vs tuned */}
                              <div className="space-y-2 text-xs">
                                <div className="p-2.5 border border-dashed border-neutral-200 bg-neutral-50 rounded text-neutral-500 line-through italic">
                                  <span className="font-bold block text-[8px] text-neutral-400 uppercase tracking-wider not-italic leading-none mb-1">
                                    {t.originalLabel}
                                  </span>
                                  "{b.originalSuggestion}"
                                </div>
                                <div className="p-3 border border-emerald-100 bg-emerald-50/10 rounded-lg text-neutral-850 font-semibold leading-relaxed">
                                  <span className="font-bold block text-[8px] text-emerald-750 uppercase tracking-wider leading-none mb-1">
                                    {t.optimizedLabel}
                                  </span>
                                  "{b.optimizedSuggestion}"
                                </div>
                              </div>

                              <p className="text-[10px] text-neutral-400 bg-neutral-50 p-2 rounded border border-neutral-150 border-dashed leading-normal">
                                <strong className="text-neutral-600">{t.strategyLabel}</strong> {b.keywordJustification}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TAB VIEWPORT: CARD INDEX_4: System instructions preview code */}
                    {activeTab === "system-prompt" && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex items-center justify-between pb-1">
                          <div>
                            <h4 className="text-xs font-bold text-neutral-750 uppercase tracking-widest">
                              {t.systemPromptTitle}
                            </h4>
                            <p className="text-[10px] text-neutral-400 mt-0.5 font-sans">
                              {t.systemPromptSubtitle}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => triggerCopy("system-prompt", result.personaSystemPrompt)}
                            className="px-2.5 py-1.5 border border-neutral-250 hover:bg-neutral-50 transition rounded text-xs font-bold text-neutral-600 flex items-center gap-1 cursor-pointer shadow-sm bg-white font-sans"
                          >
                            {copiedStates["system-prompt"] ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                {t.copied}
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                {t.copyText}
                              </>
                            )}
                          </button>
                        </div>

                        <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-900 text-neutral-200 font-mono text-[10px] leading-relaxed max-h-[440px] overflow-y-auto whitespace-pre-wrap select-all shadow-inner">
                          {result.personaSystemPrompt}
                        </div>
                      </div>
                    )}

                    {/* TAB VIEWPORT: CARD INDEX_5: Sandbox recruitment interview coach playground */}
                    {activeTab === "playground" && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="bg-neutral-50 px-3 py-2 border border-neutral-150 rounded-lg flex items-center justify-between">
                          <p className="text-[11px] text-neutral-500 leading-tight">
                            {t.playgroundSubtitle} <strong className="text-neutral-700">{result.personaTitle}</strong>
                          </p>
                        </div>

                        <SandboxPlayground systemPrompt={result.personaSystemPrompt} />
                      </div>
                    )}

                  </div>
                )}

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
