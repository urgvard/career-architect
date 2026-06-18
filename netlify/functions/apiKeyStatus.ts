import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // Access is available when Netlify AI Gateway is active (Anthropic/Claude) or
  // the user supplied their own key. We never return the key value itself.
  const gatewayActive = !!(process.env.ANTHROPIC_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY);
  const userKey = !!(process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
  const hasKey = gatewayActive || userKey;
  const usingGateway = gatewayActive && !userKey;
  return Response.json({ hasKey, usingGateway });
};

export const config: Config = {
  path: "/api/apiKeyStatus"
};
