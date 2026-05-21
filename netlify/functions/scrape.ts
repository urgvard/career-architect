import type { Context, Config } from "@netlify/functions";

async function fetchCleanUrl(urlStr: string): Promise<string> {
  try {
    const parsed = new URL(urlStr);
    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ClientHelper/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(6000), // 6-second max threshold
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
    throw new Error(`Scrape failure: ${error.message}`);
  }
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
    return Response.json({ error: error?.message || "Failed to retrieve job advertisement content." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/scrape"
};
