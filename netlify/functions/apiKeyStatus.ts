import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // A key is "available" if the user supplied one OR Netlify AI Gateway is active.
  const userKey = process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const gatewayKey = process.env.NETLIFY_AI_GATEWAY_KEY || "";
  const key = userKey || gatewayKey;
  const hasKey = !!key;
  const usingGateway = !userKey && !!gatewayKey;
  const maskedKey = key ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : "none";
  return Response.json({ hasKey, usingGateway, maskedKey, nodeVersion: process.version });
};

export const config: Config = {
  path: "/api/apiKeyStatus"
};
