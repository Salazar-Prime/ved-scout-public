# Public demo publishing

Deploy only this repository. The public demo has its own application, package
manifest, and lockfile. Do not copy private project files, environment files,
operational configurations, field datasets, or flight logs into it.

## Environment

Configure server-only `OPENAI_DEMO_API_KEY` for the intended Vercel environments.
Use a dedicated OpenAI project/key for the public demo. Set appropriate provider
usage limits and monitor them. `OPENAI_DEMO_MODEL` optionally overrides the
default language model (`gpt-4.1-mini`). Transcription uses `whisper-1` to preserve
the existing demo workflow. There is deliberately no fallback to the generic
`OPENAI_API_KEY` used by another application. No Firebase settings are needed.

For migration only, `OPENAI_DEMO_USE_EXISTING_KEY=1` allows the server to read the
existing demo's encrypted `NEXT_PUBLIC_OPENAI_API_KEY` through a dynamic lookup;
it is not imported by client components or embedded into browser scripts. This
bridge is disabled by default. Once the dedicated `OPENAI_DEMO_API_KEY` is added,
it takes priority. Remove the migration flag and old variable and redeploy after
verifying the dedicated key. Do not use a public-prefixed name for any new key.

When replacing a previously exposed public-prefixed key, rotate/revoke the old
credential through OpenAI as well; renaming an environment variable cannot
revoke copies of a key. Do not include key values in issues, commands shown to
visitors, screenshots, or documentation.

## Firewall prerequisite

Before enabling the API, configure a Vercel Firewall SDK rate-limit rule on this
project with rate limit ID `ved-scout-demo-api`. Match `@vercel/firewall` with that
ID, use a fixed window of 60 seconds and 12 requests per source IP, and return
HTTP 429 when exceeded. Both transcription and interpretation count toward that
limit. Publish/activate the rule before testing.

The handlers check this rule before contacting OpenAI and fail closed if it is
missing or unavailable. These are Vercel's regional counters, not a global
financial cap. They reduce abuse; distributed clients can still spend credits.
Use the dedicated provider project's usage controls as an additional limit.
Same-origin checks prevent browser cross-site calls; they are not authentication
against non-browser clients.

The development server uses a process-local limiter for local testing. It is not
the production rate-limit mechanism.

Official references:

- [Vercel rate-limit SDK](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk)
- [Vercel Firewall API](https://vercel.com/docs/vercel-firewall/firewall-api)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)

## Build and publish

1. Run the checks in [README.md](README.md#verify), including the dependency audit.
2. Review the complete file list and staged diff for secrets and private data.
3. Build a Vercel deployment using this repository root with the Next.js preset.
   The only API routes should be `/api/demo/transcribe/` and
   `/api/demo/assistant/`. Do not expose operational API routes.
4. Verify the candidate deployment on desktop and a narrow viewport. Check
   microphone permission/recording, Whisper transcription, command proposals,
   explicit apply, reload persistence, independent browser profiles, reset,
   history snapshots, and About links.
5. Confirm the security headers in `vercel.json` are present, cross-site API
   requests fail, and the rate-limit rule is active. A rate-limit error or model
   failure must leave the local records intact.
6. Promote the tested deployment to the public demo domain, then verify the
   public page and both endpoints. Source should come from this public repository.

Keep Vercel deployment/project IDs, private hosts, account details, and secret
values out of this document. Do not upload `.env.local`, `.vercel`, dependency
folders, test recordings, or browser-storage exports.
