import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt);
    return res.status(200).json({ text: result.response.text() });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Unknown error" });
  }
}
