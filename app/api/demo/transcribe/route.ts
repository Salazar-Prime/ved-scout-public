import { getDemoApiKey, guardApi, handleApiError, jsonResponse, readBody, RequestError } from "../../../../lib/api-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    await guardApi(request);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data;")) throw new RequestError("Send a microphone recording.", 415);
    const bytes = await readBody(request, 2200000);
    let form: FormData;
    try { form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); } catch { throw new RequestError("The recording could not be read.", 400); }
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size < 100 || audio.size > 2000000) throw new RequestError("Record a short voice command (up to 30 seconds).", 400);
    const mime = audio.type.split(";")[0];
    const extension: Record<string, string> = { "audio/webm": "webm", "video/webm": "webm", "audio/mp4": "mp4", "video/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg" };
    if (!extension[mime]) throw new RequestError("This browser’s recording format is not supported. Try typing your command instead.", 415);
    const upload = new FormData();
    upload.append("file", audio, `command.${extension[mime]}`);
    upload.append("model", "whisper-1");
    upload.append("language", "en");
    upload.append("response_format", "json");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${getDemoApiKey()}` }, body: upload,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(24000)]),
    });
    if (!response.ok) throw new RequestError("Transcription is unavailable. Try again shortly or type your command below.", 502);
    const result = await response.json();
    if (typeof result.text !== "string" || result.text.length > 1500) throw new RequestError("Keep the voice command short and try again.", 400);
    return jsonResponse({ text: result.text.trim() });
  } catch (error) { return handleApiError(error); }
}
