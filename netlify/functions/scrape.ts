import type { Context, Config } from "@netlify/functions";

// A complete, realistic browser User-Agent. The previous value ended in a
// custom "ClientHelper/1.0" token, which many job boards treat as a bot and
// answer with a 403 — so the crawler effectively never loaded those pages.
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,sv;q=0.8",
};

// Strip HTML down to readable text.
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, " ")
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, " ")
    .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, " ")
    .replace(/<noscript[^>]*>([\s\S]*?)<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Direct fetch of the page HTML.
async function directFetch(urlStr: string): Promise<string> {
  const response = await fetch(urlStr, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return htmlToText(await response.text());
}

// Fallback that renders JavaScript-heavy or bot-protected job boards into clean
// text. Most modern job boards (LinkedIn, Indeed, Greenhouse, Lever, Workday…)
// build their listings client-side, so the raw HTML contains almost no job text
// — the reader executes the page and returns the actual advert content.
async function readerFetch(urlStr: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${urlStr}`, {
    headers: { "Accept": "text/plain", "X-Return-Format": "text" },
    redirect: "follow",
    signal: AbortSignal.timeout(14000),
  });
  if (!response.ok) throw new Error(`Reader HTTP ${response.status}`);
  return (await response.text()).replace(/\s+/g, " ").trim();
}

async function fetchCleanUrl(urlStr: string): Promise<string> {
  const parsed = new URL(urlStr); // validates the URL up front

  let direct = "";
  try {
    direct = await directFetch(parsed.toString());
  } catch {
    // Blocked or unreachable directly — the reader fallback below handles it.
  }

  // Enough real text came back directly: use it (fast path, no third party).
  if (direct.length >= 600) {
    return direct.substring(0, 10000);
  }

  // Little or no text: the page was blocked or is JavaScript-rendered. Render
  // it through the reader and keep whichever result has more usable content.
  try {
    const reader = await readerFetch(parsed.toString());
    if (reader.length > direct.length) {
      return reader.substring(0, 10000);
    }
  } catch {
    // Reader unavailable — fall back to whatever the direct fetch produced.
  }

  if (direct.length > 0) {
    return direct.substring(0, 10000);
  }

  throw new Error(
    "Could not read job text from this page. It may require a login or block automated access — please paste the description manually.",
  );
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const body = await req.json();
    const { jobUrl } = body;

    if (!jobUrl || !jobUrl.trim().startsWith("http")) {
      return Response.json({ error: "Invalid URL provided." }, { status: 400 });
    }

    const crawledText = await fetchCleanUrl(jobUrl.trim());
    return Response.json({ crawledText });
  } catch (error: any) {
    console.error("Scraper endpoint error:", error);
    return Response.json(
      { error: error?.message || "Failed to retrieve job advertisement content." },
      { status: 500 },
    );
  }
};

export const config: Config = {
  path: "/api/scrape",
};
