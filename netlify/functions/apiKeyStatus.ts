import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const key = process.env.GEMINI_API_KEY || "";
  const hasKey = !!key;
  const maskedKey = key ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : "none";
  return Response.json({ hasKey, maskedKey, nodeVersion: process.version });
};

export const config: Config = {
  path: "/api/apiKeyStatus"
};
