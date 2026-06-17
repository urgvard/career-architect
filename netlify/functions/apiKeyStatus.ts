import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const key = process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  // The app now runs through the Netlify AI Gateway, which needs no personal key — so the
  // service is "ready" whenever the gateway is available, even without a user-supplied key.
  const hasGateway = !!process.env.GOOGLE_GEMINI_BASE_URL || !!process.env.NETLIFY_AI_GATEWAY_KEY;
  const hasKey = !!key || hasGateway;
  const maskedKey = key ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : (hasGateway ? "ai-gateway" : "none");
  return Response.json({ hasKey, maskedKey, nodeVersion: process.version });
};

export const config: Config = {
  path: "/api/apiKeyStatus"
};
