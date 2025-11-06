import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.GOOGLE_API_KEY || "";
  if (!key) return res.status(500).json({ ok: false, reason: "GOOGLE_API_KEY missing" });

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const r = await model.generateContent("Diga 'ok' em uma palavra.");
    return res.status(200).json({ ok: true, text: r.response.text() });
  } catch (e: any) {
    return res.status(500).json({ ok: false, reason: e?.message || String(e) });
  }
}
