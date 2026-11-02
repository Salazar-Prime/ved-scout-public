# VED-SCOUT public demo

Try voice-driven agricultural drone mission configuration with a separate copy
of the sample data in your browser.

[Open the demo](https://ved-scout.vercel.app/overview/) ·
[About the project and researcher](https://ved-scout.vercel.app/about/)

This repository contains the public demonstration interface. It includes three
illustrative plots, four mission configurations, three camera configurations,
and three sample flight records. It has no Firebase connection or aircraft
control endpoints.

## Try it

On Overview, tap the microphone, speak a short command, and tap again to submit.
Review the proposed changes and select **Apply changes** to save them. You can
also expand **Or type a command** or use each record's edit button.

- “Rename plot one to North field.”
- “Set mission one's flight height to 45 meters.”
- “Change mission three's speed to four meters per second.”
- “Set camera one's focal length to 50 millimeters.”
- “List the configured cameras.”

Open any flight-history row to view its duration, speed, mission, and camera
snapshot. **Reset demo** restores the original samples in your browser.

## Card help and KML import

Select the question mark on **Your Plots**, **Mission Types**, or **Camera
Sensors** for the available actions, editable fields, and example voice commands.

Use **Upload KML** on the plots card, or **Upload KML instead** inside **Add
plot**. Review the preview, then import all polygons as separate plots. This
includes multiple polygons within a single MultiGeometry, as well as polygons
in separate placemarks and nested folders. Existing plots are retained.

The demo accepts files up to 2 MB, with at most 50 plots in total and 100 boundary
points per polygon. Invalid polygons, inner boundaries (holes), and batches that
exceed those limits are rejected without importing a partial batch. Points,
lines, and network links are not imported; external links are not fetched.

KML files are read locally in the browser, not uploaded by the importer. Imported
plot coordinates become part of the demo configuration sent to OpenAI if you
subsequently submit a voice or text command.

## Local development

Use Node.js 22 and pnpm 10.8.1. From this repository's root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open <http://localhost:3100/overview/>. Set `OPENAI_DEMO_API_KEY` in `.env.local`
to use voice and language interpretation. Manual editing and all sample records
work without a key. The key is read only by server routes; never add it to a
public environment variable or commit it.

The microphone uses the browser's recording permission and requires HTTPS
outside localhost. Recordings stop automatically after 30 seconds. Whisper 1
transcribes the audio, and the language model proposes validated configuration
changes. The server does not apply them or connect to any operational system.

## Verify

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:browser
pnpm audit --prod
```

API unit tests mock OpenAI and do not consume API credits. Browser tests exercise
local data isolation, persistence, editing, history details, microphone handling,
command review, reset, and mobile layout, with mocked transcription/model calls.

## Data and privacy

The `ved-scout.public-demo.v1` local-storage key contains plots, missions, camera
sensors, and sample flight-history records. It is scoped to this browser profile
and site origin. Another visitor has an independent copy; tabs in the same
profile share the copy. Clear the site's browser data to remove it. Reset changes
only this demo's key. Local storage is not encrypted; use sample information.

After you submit a recording, the demo sends it to OpenAI through its server.
Text commands, recent conversation context, and the current demo configuration
are also sent for interpretation. The app does not write requests to a database,
retain recordings, or log their contents. Transcripts/replies remain in tab
memory until navigation or reload. Responses requests use `store: false`, which
is not a claim of zero provider retention. See
[OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
for the provider's policy.

OpenStreetMap receives map-tile requests. Vercel hosts the app and may retain
standard request/security logs. The app includes no analytics or tracking scripts.

The public API uses same-origin/custom-header checks, request-size limits,
timeouts, strict schemas, an action allowlist, and Vercel WAF rate limiting.
The browser validates proposed changes again and requires an explicit apply.
See [PUBLISHING.md](PUBLISHING.md) for the required firewall configuration and
deployment verification.

## About

Created by [Varun Aggarwal](https://github.com/Salazar-Prime),
a PhD candidate in Purdue University's Elmore School of Electrical and Computer
Engineering. His research explores language models and UAVs for agricultural
weed scouting.

[GitHub](https://github.com/Salazar-Prime) ·
[LinkedIn](https://www.linkedin.com/in/aggarwal-v/) ·
[Purdue University](https://www.purdue.edu/home/about/)
