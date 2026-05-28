import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const gatewayKey = process.env.NETLIFY_AI_GATEWAY_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const hasKey = !!(gatewayKey || geminiKey);
  return Response.json({ hasKey, provider: gatewayKey ? "netlify-ai-gateway" : geminiKey ? "gemini-direct" : "none", nodeVersion: process.version });
};

export const config: Config = {
  path: "/api/apiKeyStatus"
};
