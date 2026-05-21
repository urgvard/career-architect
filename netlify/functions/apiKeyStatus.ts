import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  return Response.json({ hasKey });
};

export const config: Config = {
  path: "/api/apiKeyStatus"
};
