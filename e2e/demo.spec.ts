import { expect, test, type Page } from "@playwright/test";

const storageKey = "ved-scout.public-demo.v1";
async function open(page: Page) {
  await page.goto("/overview/");
  await expect(page.getByRole("button", { name: "Reset demo", exact: true })).toBeEnabled();
}

async function mockRename(page: Page) {
  await page.route("**/api/demo/assistant/", (route) => route.fulfill({ json: { message: "Rename plot one to North field?", actions: [{ kind: "update_plot", id: "plot-1", changes: { name: "North field", corners: null } }] } }));
}

async function typeCommand(page: Page, command: string) {
  await page.getByText("Or type a command", { exact: true }).click();
  await page.getByRole("textbox", { name: "Type a voice command" }).fill(command);
}

test("the original demo theme, sidebar, and pane layout are preserved", async ({ page }) => {
  await open(page);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(10, 10, 10)");
  await expect(page.locator(".sidebar")).toHaveCSS("width", "64px");
  await expect(page.locator(".sidebar-top")).toHaveCSS("height", "56px");
  await expect(page.locator(".voice-brand")).toHaveCSS("font-size", "30px");
  await expect(page.locator(".voice-brand")).toHaveCSS("letter-spacing", "0.75px");
  await expect(page.locator(".dashboard-top>.panel").first()).toHaveCSS("background-color", "rgba(24, 24, 27, 0.8)");
  await expect(page.locator(".dashboard-top>.panel").first()).toHaveCSS("border-top-color", "rgba(207, 185, 145, 0.4)");
  await expect(page.getByRole("button", { name: "Add plot", exact: true })).toHaveCSS("background-color", "rgb(207, 185, 145)");
  await expect(page.getByRole("button", { name: "Add plot", exact: true })).toHaveCSS("border-radius", "50%");
  await expect(page.locator(".topbar, .demo-notice, .record-number")).toHaveCount(0);
  const panes = await page.locator(".dashboard-top>.panel").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
  expect(Math.abs(panes[0] - panes[1])).toBeLessThan(1);
  await expect(page.locator(".leaflet-tile-pane")).toHaveCSS("filter", "none");
  await page.getByRole("button", { name: "Expand navigation", exact: true }).click();
  await expect(page.getByRole("link", { name: "Voice command", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "About", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Collapse navigation", exact: true }).click();
});

test("the overview has samples, no Firebase requests, and complete flight details", async ({ page }) => {
  const errors: string[] = [];
  const firebaseRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (/firebase|firestore/i.test(request.url())) firebaseRequests.push(request.url()); });
  await open(page);
  await expect(page.getByText("Give your voice commands by tapping here.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your plots" }).locator(".record")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "Mission types" }).locator(".record")).toHaveCount(4);
  await expect(page.getByRole("region", { name: "Camera sensors" }).locator(".record")).toHaveCount(3);
  await page.getByRole("button", { name: "View North field mapping", exact: true }).click();
  const details = page.getByRole("dialog");
  await expect(details.getByText("8 min 44 s", { exact: true })).toBeVisible();
  await expect(details.getByText("3 m/s", { exact: true })).toBeVisible();
  await expect(details.getByText("Standard mapping", { exact: true })).toBeVisible();
  await expect(details.getByText("Zenmuse P1 · 35 mm", { exact: true })).toBeVisible();
  await expect(details.getByText("8192 × 5460 px", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).not.toBeVisible();
  expect(errors).toEqual([]);
  expect(firebaseRequests).toEqual([]);
  await page.screenshot({ path: "test-results/overview-desktop.png", fullPage: true });
});

test("manual edits persist and a different browser keeps its own copy", async ({ page, browser }) => {
  await open(page);
  await page.getByRole("button", { name: "Edit plot 1", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("My private demo field");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await expect(page.getByText("My private demo field", { exact: true })).toBeVisible();
  const separateContext = await browser.newContext();
  const separatePage = await separateContext.newPage();
  await separatePage.goto("http://localhost:3100/overview/");
  await expect(separatePage.getByText("Plot 1 — rename me by voice", { exact: true })).toBeVisible();
  await expect(separatePage.getByText("My private demo field", { exact: true })).toHaveCount(0);
  await separateContext.close();
});

test("camera and mission editors retain changes without rewriting history", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Edit camera 1", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Focal length (mm)", exact: true }).fill("50");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("8192 × 5460 px · 50 mm lens · 35.9 mm sensor", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit mission 1", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Flight height (m)", exact: true }).fill("45");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "View North field mapping", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("35 mm", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("35 m", { exact: true })).toBeVisible();
});

test("typed model proposals require Apply and persist only after application", async ({ page }) => {
  await open(page);
  await mockRename(page);
  await typeCommand(page, "Rename plot one to North field");
  await page.getByRole("button", { name: "Send command", exact: true }).click();
  await expect(page.getByRole("button", { name: "Apply changes", exact: true })).toBeVisible();
  await expect(page.getByText("Plot 1 — rename me by voice", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply changes", exact: true }).click();
  await expect(page.getByText("Saved to your browser", { exact: true })).toBeVisible();
  await expect(page.getByText("North field", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("North field", { exact: true })).toBeVisible();
});

test("recording flows through transcription, interpretation, and local apply", async ({ page }) => {
  await open(page);
  await page.route("**/api/demo/transcribe/", (route) => route.fulfill({ json: { text: "Rename plot one to North field" } }));
  await mockRename(page);
  await page.getByRole("button", { name: "Record a voice command", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop recording and send command" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Stop recording and send command" }).click();
  await expect(page.getByRole("button", { name: "Apply changes", exact: true })).toBeVisible();
  await expect(page.locator(".heard")).toContainText("Rename plot one to North field");
  await page.getByRole("button", { name: "Apply changes", exact: true }).click();
  await expect(page.getByText("North field", { exact: true })).toBeVisible();
});

test("discard and stale proposals cannot overwrite a manual edit", async ({ page }) => {
  await open(page); await mockRename(page);
  await typeCommand(page, "Rename plot one to North field");
  await page.getByRole("button", { name: "Send command", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByText("Plot 1 — rename me by voice", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Send command", exact: true }).click();
  await expect(page.getByRole("button", { name: "Apply changes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit plot 1", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Newer manual edit");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Apply changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Voice commands" }).getByRole("alert")).toContainText("data changed");
  await expect(page.getByText("Newer manual edit", { exact: true })).toBeVisible();
});

test("reset restores the sample and only changes the demo storage key", async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.setItem("unrelated-key", "keep"));
  await page.getByRole("button", { name: "Edit plot 1", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Reset this edit");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.getByText("Plot 1 — rename me by voice", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("unrelated-key"))).toBe("keep");
});

test("About keeps profile links and privacy details without the university card", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.getByRole("heading", { name: "Varun Aggarwal", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Purdue University", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "About Purdue", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Purdue ECE", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "How to use and data privacy", exact: true })).toBeVisible();
  await expect(page.locator("#demo-data > p")).toHaveCount(3);
  await expect(page.locator("#demo-data")).toContainText("Your edits do not change another visitor’s copy.");
  await expect(page.locator("#demo-data")).toContainText("On submission, the recording is sent through the demo server to OpenAI for transcription with Whisper 1.");
  await expect(page.getByRole("link", { name: "LinkedIn", exact: true })).toHaveAttribute("href", "https://www.linkedin.com/in/aggarwal-v/");
  await expect(page.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute("href", "https://github.com/Salazar-Prime");
  await expect(page.getByRole("link", { name: "Demo source", exact: true })).toHaveAttribute("href", "https://github.com/Salazar-Prime/ved-scout-public");
  expect(await page.content()).not.toMatch(/\bEURO\b|Engineering Undergraduate Research Office|First-Time Researcher Fellowship|Summer Undergraduate Research Fellowships/i);
  await page.screenshot({ path: "test-results/about-desktop.png", fullPage: true });
});

test("the footer only keeps right-aligned Reset demo and About, with the voice notice unchanged", async ({ page }) => {
  await open(page);
  const footer = page.locator(".workspace-footer");
  await expect(footer).toHaveCSS("justify-content", "flex-end");
  await expect(footer.getByRole("button", { name: "Reset demo", exact: true })).toBeEnabled();
  await expect(footer.getByRole("link", { name: "About", exact: true })).toHaveAttribute("href", "/about/");
  await expect(footer.locator("button, a")).toHaveCount(2);
  await expect(footer).not.toContainText(/Public demo|Your browser copy|How it works/i);
  await expect(page.locator(".voice-privacy")).toHaveText("Voice and text commands are processed by OpenAI. Data details");
  await expect(page.locator(".voice-privacy a")).toHaveAttribute("href", "/about/#demo-data");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(footer).toHaveCSS("justify-content", "flex-end");
});

test("mobile overview has no horizontal overflow and usable dialogs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/overview-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "View North field mapping", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("dialog").evaluate((element) => element.getBoundingClientRect().width <= window.innerWidth)).toBe(true);
});

test("corrupt storage reports a recoverable warning", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "broken-json"), storageKey);
  await open(page);
  await expect(page.locator(".storage-warning")).toContainText("temporary sample copy");
  await expect(page.getByText("Plot 1 — rename me by voice", { exact: true })).toBeVisible();
});
