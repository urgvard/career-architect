import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // The app can reach a model either via the Netlify AI Gateway (injected
  // GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL) or a direct user key. Report only
  // a boolean — never expose key material or the environment listing.
  const gatewayReady = !!(process.env.GEMINI_API_KEY && process.env.GOOGLE_GEMINI_BASE_URL);
  const hasUserKey = !!process.env.USER_GEMINI_API_KEY;
  const hasKey = gatewayReady || hasUserKey;
  const provider = gatewayReady ? "gateway" : hasUserKey ? "user-key" : "none";
  return Response.json({ hasKey, provider });
};

export const config: Config = {
  path: "/api/apiKeyStatus"
};
