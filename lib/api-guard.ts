import { checkRateLimit } from "@vercel/firewall";

export class RequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

// Server routes only. The opt-in bridge preserves an existing encrypted Vercel
// credential until the maintainer adds the dedicated demo key. Dynamic lookup
// prevents Next's public-prefix build-time substitution; no client imports this.
export function getDemoApiKey() {
  if (process.env.OPENAI_DEMO_API_KEY) return process.env.OPENAI_DEMO_API_KEY;
  if (process.env.OPENAI_DEMO_USE_EXISTING_KEY === "1") {
    const existingName = ["NEXT", "PUBLIC", "OPENAI", "API", "KEY"].join("_");
    return process.env[existingName];
  }
  return undefined;
}

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site" || request.headers.get("x-ved-scout-demo") !== "1") {
    throw new RequestError("Open the demo page to use this endpoint.", 403);
  }
}

export async function readBody(request: Request, maxBytes: number) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new RequestError("This request is too large.", 413);
  if (!request.body) throw new RequestError("The request is empty.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestError("This request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

const localRequests = new Map<string, { count: number; until: number }>();
export async function guardApi(request: Request) {
  assertSameOrigin(request);
  // Fail closed in Vercel if the configured regional firewall check fails.
  // Per-region WAF counters survive instance cold starts; see PUBLISHING.md.
  if (process.env.VERCEL) {
    try {
      const result = await checkRateLimit("ved-scout-demo-api", { request, timeout: 3000 });
      if (result.error === "not-found") throw new Error("The rate-limit rule is not configured.");
      if (result.rateLimited) throw new RequestError("Too many demo requests. Please wait a minute and try again.", 429);
    } catch (error) {
      if (error instanceof RequestError) throw error;
      throw new RequestError("Voice commands are temporarily unavailable. You can still edit the sample records manually.", 503);
    }
  } else {
    const now = Date.now();
    for (const [key, value] of localRequests) if (value.until <= now) localRequests.delete(key);
    const key = request.headers.get("x-forwarded-for") ?? "local";
    const current = localRequests.get(key) ?? { count: 0, until: now + 60000 };
    if (current.count >= 12) throw new RequestError("Too many demo requests. Please wait a minute.", 429);
    current.count += 1;
    localRequests.set(key, current);
  }
  if (!getDemoApiKey()) throw new RequestError("Voice commands are being configured. You can still explore and edit every sample record manually.", 503);
}

export function handleApiError(error: unknown) {
  if (error instanceof RequestError) return jsonResponse({ error: error.message }, error.status);
  // Do not log recordings, prompts, local state, API keys, or provider errors.
  return jsonResponse({ error: "The demo could not process that request. Please try again." }, 502);
}
