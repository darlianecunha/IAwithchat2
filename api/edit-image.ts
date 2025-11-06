import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import busboy from "busboy";

function parseMultipart(req: VercelRequest){
  return new Promise<any>((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    const out: any = {};
    const chunks: Buffer[] = [];
    bb.on("file", (_n, file, info) => {
      out.mime = info.mimeType;
      file.on("data", (d: Buffer) => chunks.push(d));
      file.on("end", () => { out.file = Buffer.concat(chunks); });
    });
    bb.on("field", (n, v) => { if (n === "instruction") out.instruction = v; });
    bb.on("close", () => resolve(out));
    bb.on("error", reject);
    (req as any).pipe(bb);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  try {
    const { file, instruction, mime } = await parseMultipart(req);
    if (!file) return res.status(400).json({ error: "Image is required (field 'image')" });

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      { text: instruction || "Improve this image" },
      { inlineData: { mimeType: mime || "image/png", data: file.toString("base64") } },
    ]);

    return res.status(200).json({ result: result.response.text() });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Unknown error" });
  }
}
