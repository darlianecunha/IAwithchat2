// Helper functions to call serverless routes (no API key in browser)
export async function chat(prompt: string) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  return res.json();
}

export async function editImage(file: File, instruction: string) {
  const form = new FormData();
  form.append("image", file);
  form.append("instruction", instruction || "");
  const res = await fetch("/api/edit-image", { method: "POST", body: form });
  return res.json();
}

export async function chatVoice(blob: Blob, instruction: string) {
  const form = new FormData();
  form.append("audio", blob, "audio.webm");
  form.append("instruction", instruction || "");
  const res = await fetch("/api/chat-voice", { method: "POST", body: form });
  return res.json();
}
