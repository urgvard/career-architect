// Client-side text extraction for uploaded candidate documents.
//
// Why this exists: the app previously read every uploaded file with
// FileReader.readAsText(). For binary formats (PDF, DOCX) that decodes the raw
// compressed bytes as text, producing megabytes of high-entropy junk. That junk
// tokenizes at roughly one token per character, so a single ordinary PDF résumé
// could balloon the model input past Gemini's 1,048,576-token ceiling and trigger
// "The input token count exceeds the maximum number of tokens allowed".
//
// Here we extract real, readable text per format (pdf.js for PDF, mammoth for
// DOCX, plain decode for text formats), sanitize it, and cap its length so the
// payload sent to the model stays small and clean.

// Hard cap on the extracted text we keep per file. A long multi-page résumé is a
// few thousand characters; 100k is generous while still guaranteeing the combined
// payload stays far below the model's input limit.
export const PER_FILE_CHAR_LIMIT = 100_000;

export interface ExtractedFile {
  text: string;
  /** Human-facing note when extraction was partial, empty, or unsupported. */
  warning?: string;
}

// Lazily load pdf.js (and point it at its worker) only when a PDF is uploaded,
// so the heavy dependency never weighs on the initial page load.
let pdfjsPromise: Promise<any> | null = null;
function loadPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

// Strip control characters (except tab/newline/carriage-return) and the Unicode
// replacement character, collapse runs of blank lines and spaces, and trim. Keeps
// extracted text compact and token-cheap.
function sanitize(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    .replace(/�/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cap(text: string): string {
  return text.length > PER_FILE_CHAR_LIMIT ? text.slice(0, PER_FILE_CHAR_LIMIT) : text;
}

// Heuristic: a meaningful share of non-printable bytes means we were handed binary
// data we could not properly decode (e.g. a scanned/encrypted PDF, or a .doc binary).
function looksBinary(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 4000);
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0xfffd || (c < 32 && c !== 9 && c !== 10 && c !== 13)) bad++;
  }
  return bad / sample.length > 0.1;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsText(file);
  });
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
      .join(" ");
    pages.push(line);
    if (pages.join("\n").length > PER_FILE_CHAR_LIMIT) break;
  }
  try { await pdf.destroy?.(); } catch { /* noop */ }
  return pages.join("\n");
}

async function extractDocx(file: File): Promise<string> {
  // Use mammoth's self-contained prebuilt browser bundle so the bundler never has
  // to resolve mammoth's Node-only internals (which need Buffer/stream polyfills).
  const mod: any = await import("mammoth/mammoth.browser.min.js");
  const mammoth = mod.default || mod;
  const arrayBuffer = await file.arrayBuffer();
  const fn = mammoth.extractRawText || mammoth.default?.extractRawText;
  const result = await fn({ arrayBuffer });
  return result?.value || "";
}

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "rtf", "log", "text", "yaml", "yml", "html", "htm",
]);

/**
 * Extract clean, model-ready text from an uploaded file. Never throws — on failure
 * it returns an empty string with a localized warning so the UI can guide the user.
 */
export async function extractFileText(file: File, lang: string): Promise<ExtractedFile> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const en = lang === "en";

  const unreadable = (): ExtractedFile => ({
    text: "",
    warning: en
      ? `Could not read text from "${file.name}". If it is a scanned or image-based document, please paste its text into the box below.`
      : `Kunde inte läsa text från "${file.name}". Om det är ett inskannat eller bildbaserat dokument, klistra in texten i rutan nedan.`,
  });

  try {
    let text = "";

    if (ext === "pdf") {
      text = await extractPdf(file);
    } else if (ext === "docx") {
      text = await extractDocx(file);
    } else if (ext === "doc") {
      // Legacy binary .doc is not supported by mammoth; guide the user instead of
      // sending decoded binary noise to the model.
      return {
        text: "",
        warning: en
          ? `The old ".doc" format from "${file.name}" can't be read. Please save it as PDF or .docx, or paste the text below.`
          : `Det gamla ".doc"-formatet i "${file.name}" kan inte läsas. Spara om det som PDF eller .docx, eller klistra in texten nedan.`,
      };
    } else if (TEXT_EXTENSIONS.has(ext) || ext === "") {
      text = await readAsText(file);
    } else {
      // Unknown extension: try a plain text read, but reject if it looks binary.
      text = await readAsText(file);
      if (looksBinary(text)) return unreadable();
    }

    const clean = cap(sanitize(text));

    if (!clean) return unreadable();
    if (looksBinary(clean)) return unreadable();

    return { text: clean };
  } catch (err) {
    console.warn(`Text extraction failed for ${file.name}:`, err);
    return unreadable();
  }
}
