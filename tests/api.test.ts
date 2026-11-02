import assert from "node:assert/strict";
import test from "node:test";
import { POST as assistant } from "../app/api/demo/assistant/route";
import { POST as transcribe } from "../app/api/demo/transcribe/route";
import { assertSameOrigin, getDemoApiKey, readBody, RequestError } from "../lib/api-guard";
import { createDemoState } from "../lib/data";

const origin = "http://localhost:3100";
function request(path: string, body: BodyInit, contentType?: string) {
  return new Request(`${origin}${path}`, { method: "POST", headers: { origin, "x-ved-scout-demo": "1", ...(contentType ? { "Content-Type": contentType } : {}) }, body });
}

test("cross-site, missing-origin, and simple-form API requests fail closed", async () => {
  const cases: Record<string, string>[] = [{}, { origin: "https://elsewhere.example", "x-ved-scout-demo": "1" }, { origin }, { origin, "x-ved-scout-demo": "1", "sec-fetch-site": "cross-site" }];
  for (const headers of cases) {
    assert.throws(() => assertSameOrigin(new Request(`${origin}/api/demo/assistant/`, { method: "POST", headers })), RequestError);
  }
  const response = await assistant(new Request(`${origin}/api/demo/assistant/`, { method: "POST", body: "{}" }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("body reader enforces limits with and without Content-Length", async () => {
  await assert.rejects(readBody(request("/", "x".repeat(11)), 10), RequestError);
  await assert.rejects(readBody(new Request(`${origin}/`, { method: "POST", headers: { "Content-Length": "999" }, body: "x" }), 10), RequestError);
  assert.equal((await readBody(request("/", "1234567890"), 10)).length, 10);
});

test("the demo does not fall back to an operational OpenAI key", async () => {
  const oldDemo = process.env.OPENAI_DEMO_API_KEY;
  const oldKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_DEMO_API_KEY;
  process.env.OPENAI_API_KEY = "test-operational-key-must-not-be-used";
  try {
    assert.equal((await assistant(request("/api/demo/assistant/", "{}", "application/json"))).status, 503);
  } finally {
    if (oldDemo === undefined) delete process.env.OPENAI_DEMO_API_KEY; else process.env.OPENAI_DEMO_API_KEY = oldDemo;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});

test("the existing demo credential requires opt-in and never overrides a dedicated key", () => {
  const names = ["OPENAI_DEMO_API_KEY", "OPENAI_DEMO_USE_EXISTING_KEY", "NEXT_PUBLIC_OPENAI_API_KEY"];
  const before = names.map(name => process.env[name]);
  try {
    delete process.env.OPENAI_DEMO_API_KEY;
    delete process.env.OPENAI_DEMO_USE_EXISTING_KEY;
    process.env.NEXT_PUBLIC_OPENAI_API_KEY = "test-existing-demo";
    assert.equal(getDemoApiKey(), undefined);
    process.env.OPENAI_DEMO_USE_EXISTING_KEY = "1";
    assert.equal(getDemoApiKey(), "test-existing-demo");
    process.env.OPENAI_DEMO_API_KEY = "test-dedicated-demo";
    assert.equal(getDemoApiKey(), "test-dedicated-demo");
  } finally {
    names.forEach((name, index) => { if (before[index] === undefined) delete process.env[name]; else process.env[name] = before[index]; });
  }
});

test("assistant validates the provider action and never persists or mutates browser data", async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_DEMO_API_KEY;
  process.env.OPENAI_DEMO_API_KEY = "test-demo-only";
  const state = createDemoState();
  const before = JSON.stringify(state);
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.store, false);
    assert.equal(payload.max_output_tokens, 1800);
    assert.ok(payload.text.format.strict);
    const schema = payload.text.format.schema;
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, false);
    assert.equal(JSON.stringify(schema).includes('"oneOf"'), false);
    assert.equal(schema.properties.actions.items.anyOf.length, 9);
    return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ message: "Rename plot one?", actions: [{ kind: "update_plot", id: "plot-1", changes: { name: "North field", corners: null } }] }) }] }] });
  };
  try {
    const response = await assistant(request("/api/demo/assistant/", JSON.stringify({ message: "Rename plot one to North field", state }), "application/json"));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).actions[0].changes.name, "North field");
    assert.equal(JSON.stringify(state), before);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.OPENAI_DEMO_API_KEY; else process.env.OPENAI_DEMO_API_KEY = oldKey;
  }
});

test("malformed input and model-produced hardware actions never escape the allowlist", async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_DEMO_API_KEY;
  process.env.OPENAI_DEMO_API_KEY = "test-demo-only";
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ message: "Fly", actions: [{ kind: "takeoff" }] }) }] }] }); };
  try {
    assert.equal((await assistant(request("/api/demo/assistant/", "{", "application/json"))).status, 400);
    assert.equal(calls, 0);
    const response = await assistant(request("/api/demo/assistant/", JSON.stringify({ message: "Fly", state: createDemoState() }), "application/json"));
    assert.equal(response.status, 502);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.OPENAI_DEMO_API_KEY; else process.env.OPENAI_DEMO_API_KEY = oldKey;
  }
});

test("Whisper 1 transcription accepts a bounded recording and returns only text", async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_DEMO_API_KEY;
  process.env.OPENAI_DEMO_API_KEY = "test-demo-only";
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
    assert.equal((init?.body as FormData).get("model"), "whisper-1");
    assert.ok((init?.body as FormData).get("file") instanceof File);
    return Response.json({ text: "Rename plot one to North field", extraProviderData: "not returned" });
  };
  try {
    const form = new FormData();
    form.set("audio", new File([new Uint8Array(1000)], "command.webm", { type: "audio/webm" }));
    const response = await transcribe(request("/api/demo/transcribe/", form));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { text: "Rename plot one to North field" });
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.OPENAI_DEMO_API_KEY; else process.env.OPENAI_DEMO_API_KEY = oldKey;
  }
});

test("empty recordings and provider errors do not leak credentials or upstream details", async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_DEMO_API_KEY;
  process.env.OPENAI_DEMO_API_KEY = "test-demo-only";
  globalThis.fetch = async () => Response.json({ error: { message: "SensitiveProviderDetails" } }, { status: 401 });
  try {
    assert.equal((await transcribe(request("/api/demo/transcribe/", new FormData()))).status, 400);
    const response = await assistant(request("/api/demo/assistant/", JSON.stringify({ message: "List plots", state: createDemoState() }), "application/json"));
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.ok(!text.includes("SensitiveProviderDetails"));
    assert.ok(!text.includes("test-demo-only"));
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.OPENAI_DEMO_API_KEY; else process.env.OPENAI_DEMO_API_KEY = oldKey;
  }
});
