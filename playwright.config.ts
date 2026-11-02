import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3100", viewport: { width: 1440, height: 1100 }, screenshot: "only-on-failure", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } },
  webServer: { command: "pnpm dev", url: "http://localhost:3100/overview/", reuseExistingServer: !process.env.CI, timeout: 60000 },
});
