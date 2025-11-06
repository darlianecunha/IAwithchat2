import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.GOOGLE_API_KEY || "";
  const redacted = key ? key.slice(0, 6) + "…" + key.slice(-4) : "(vazia)";
  return res.status(200).json({
    hasEnv: Boolean(key),
    sample: redacted,
    looksLikeGoogleKey: /^AIza/.test(key),
    length: key.length
  });
}
