import { GoogleGenAI } from "@google/genai";

// Primary model, plus a lighter fallback used when the primary stays unavailable.
// Both IDs are valid on the direct Google API *and* the Netlify AI Gateway.
export const PRIMARY_MODEL = "gemini-2.5-flash";
export const FALLBACK_MODEL = "gemini-2.5-flash-lite";

// A transient error is one worth retrying / failing over: model overload
// (503/UNAVAILABLE), rate limiting (429), upstream 5xx, or a dropped connection.
export function isTransientError(err: any): boolean {
  const haystack = `${err?.message || ""} ${err?.status || ""} ${(() => {
    try { return JSON.stringify(err); } catch { return String(err); }
  })()}`;
  return /\b(503|502|500|429)\b|UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i.test(
    haystack
  );
}

type Route = { label: string; ai: GoogleGenAI };

// Default Gemini endpoint, set explicitly on the direct route so it can never
// inherit GOOGLE_GEMINI_BASE_URL (which points at the gateway) from the env.
const GOOGLE_DIRECT_BASE_URL = "https://generativelanguage.googleapis.com/";

// Build the ordered list of routes the request can travel over.
//
// 1. The user-provided key talking directly to Google (respects the user's own
//    quota/billing when it is healthy).
// 2. The managed Netlify AI Gateway, which runs on separate, load-balanced
//    capacity. This is the safety net: when Google's direct endpoint is
//    momentarily overloaded (the recurring 503 "high demand" spike), the
//    gateway keeps the feature working instead of surfacing a hard failure.
//
// Each client is given an explicit base URL so it uses exactly the route we
// hand it. Crucially we do NOT mutate process.env — those mutations persist
// across warm function invocations, which would silently drop the gateway
// route on the second request.
export function buildRoutes(): Route[] {
  const userKey = process.env.USER_GEMINI_API_KEY;
  const gatewayKey = process.env.GEMINI_API_KEY;
  const gatewayBaseUrl = process.env.GOOGLE_GEMINI_BASE_URL;

  const routes: Route[] = [];

  if (userKey) {
    routes.push({
      label: "direct",
      ai: new GoogleGenAI({ apiKey: userKey, httpOptions: { baseUrl: GOOGLE_DIRECT_BASE_URL } }),
    });
  }

  if (gatewayKey && gatewayBaseUrl) {
    routes.push({
      label: "ai-gateway",
      ai: new GoogleGenAI({ apiKey: gatewayKey, httpOptions: { baseUrl: gatewayBaseUrl } }),
    });
  }

  return routes;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Run generateContent resiliently: for each route, try the primary model with
// bounded exponential backoff; if it stays transiently unavailable, try the
// fallback model once; then fail over to the next route. Only a persistent
// transient failure across *every* route surfaces an error to the caller.
export async function generateContentResilient(
  routes: Route[],
  params: any,
  { retriesPerModel = 2, baseDelayMs = 400 }: { retriesPerModel?: number; baseDelayMs?: number } = {}
) {
  if (!routes.length) {
    throw new Error("No Gemini route available: set USER_GEMINI_API_KEY or enable the Netlify AI Gateway.");
  }

  let lastErr: any;
  for (const { ai } of routes) {
    for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
      for (let attempt = 0; attempt <= retriesPerModel; attempt++) {
        try {
          return await ai.models.generateContent({ ...params, model });
        } catch (err: any) {
          lastErr = err;
          // Non-transient errors (bad request, model unknown on this route,
          // auth) won't be fixed by retrying — move on to the next model/route.
          if (!isTransientError(err)) break;
          if (attempt < retriesPerModel) {
            await sleep(baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250));
          }
        }
      }
    }
  }
  throw lastErr;
}
