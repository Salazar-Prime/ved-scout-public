import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import config from "../vercel.json";

test("deployment headers allow the actual map host without exposing full referrers", () => {
  const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key.toLowerCase(), value]));
  const mapSource = readFileSync(new URL("../components/field-map.tsx", import.meta.url), "utf8");
  const tileUrl = mapSource.match(/url="(https:\/\/[^\"]+)"/)?.[1];
  assert.ok(tileUrl);
  const tileOrigin = new URL(tileUrl).origin;
  const directives = Object.fromEntries(headers["content-security-policy"].split(";").map(part => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values];
  }));
  assert.ok(directives["img-src"].includes(tileOrigin));
  assert.ok(directives["connect-src"].includes(tileOrigin));
  assert.deepEqual(directives["frame-ancestors"], ["'none'"]);
  assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["permissions-policy"], "camera=(), microphone=(self), geolocation=(), display-capture=()");
});
