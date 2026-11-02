import { expect, test, type Page } from "@playwright/test";
import { createDemoState } from "../lib/data";

const storageKey = "ved-scout.public-demo.v1";
const boundary = "-86.99,40.47,0 -86.98,40.47,0 -86.98,40.48,0 -86.99,40.48,0 -86.99,40.47,0";
const polygon = (coordinates = boundary, extra = "") => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs>${extra}</Polygon>`;
const wrap = (body: string) => `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${body}</Document></kml>`;
const multiple = wrap(`<Folder><Placemark><name>North &amp; West</name>${polygon()}</Placemark><Folder><Placemark><name>Scouting areas</name><MultiGeometry>${polygon()}<MultiGeometry>${polygon()}</MultiGeometry></MultiGeometry></Placemark></Folder></Folder><Placemark><Point><coordinates>-86.99,40.47</coordinates></Point></Placemark><NetworkLink><Link><href>https://never-fetch.invalid/linked.kml</href></Link></NetworkLink>`);

async function open(page: Page, section = "overview") {
  await page.goto(`/${section}/`);
  await expect(page.getByRole("button", { name: "Reset demo", exact: true })).toBeEnabled();
}
async function choose(page: Page, text: string, name = "fields.kml") {
  await page.getByLabel("KML file", { exact: true }).setInputFiles({ name, mimeType: "application/vnd.google-earth.kml+xml", buffer: Buffer.from(text) });
}

test("all three question marks explain adding, updating, deleting, and voice controls", async ({ page }) => {
  await open(page);
  for (const [label, heading, content] of [
    ["Help with your plots", "What can I do with plots?", "Import boundaries from KML"],
    ["Help with mission types", "What can I do with mission types?", "front/side overlap"],
    ["Help with camera sensors", "What can I do with camera sensors?", "Before deleting a camera"],
  ]) {
    const trigger = page.getByRole("button", { name: label, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Add, update, or delete", exact: true })).toBeVisible();
    await expect(dialog).toContainText(content);
    await expect(dialog).toContainText("Apply changes");
    await expect(dialog.locator(".help-examples li")).toHaveCount(3);
    if (label === "Help with mission types") await page.screenshot({ path: "test-results/mission-help.png", fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});

test("KML imports every polygon across placemarks and nested MultiGeometry, locally and atomically", async ({ page, browser }) => {
  const requests: string[] = [];
  page.on("request", request => { if (/\/api\/|firebase|firestore|never-fetch\.invalid/i.test(request.url())) requests.push(request.url()); });
  await open(page);
  await page.getByRole("button", { name: "Upload KML", exact: true }).click();
  await choose(page, multiple);
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".kml-preview li")).toHaveCount(3);
  await expect(dialog).toContainText("North & West");
  await expect(dialog).toContainText("Scouting areas (1)");
  await expect(dialog).toContainText("Scouting areas (2)");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).plots.length, storageKey)).toBe(3);
  await page.screenshot({ path: "test-results/kml-preview.png", fullPage: true });
  await dialog.getByRole("button", { name: "Import 3 plots", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Imported 3 plots into your browser.", { exact: true })).toBeVisible();
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(state.plots).toHaveLength(6);
  expect(new Set(state.plots.map((plot: { id: string }) => plot.id)).size).toBe(6);
  expect(state.plots.slice(3).every((plot: { corners: unknown[] }) => plot.corners.length === 4)).toBe(true);
  expect(state.plots[3].corners[0]).toEqual({ lat: 40.47, lng: -86.99 });
  await page.reload();
  await expect(page.getByText("Scouting areas (2)", { exact: true })).toBeVisible();
  const separate = await browser.newContext();
  try {
    const visitor = await separate.newPage();
    await visitor.goto("http://localhost:3100/overview/");
    await expect(visitor.getByRole("region", { name: "Your plots" }).locator(".record")).toHaveCount(3);
  } finally { await separate.close(); }
  expect(requests).toEqual([]);
});

test("prefixed KML and the Add plot upload option work on Your plots", async ({ page }) => {
  await open(page, "your-plots");
  await page.getByRole("button", { name: "Add plot", exact: true }).click();
  await page.getByRole("button", { name: "Upload KML instead", exact: true }).click();
  const prefixed = multiple.replace('xmlns="', 'xmlns:k="').replace(/<(\/?)([A-Za-z][\w]*)/g, "<$1k:$2");
  await choose(page, prefixed);
  await page.getByRole("button", { name: "Import 3 plots", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your plots" }).locator(".record")).toHaveCount(6);
  await page.getByRole("button", { name: "Edit plot 4", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("North & West");
});

test("cancelled imports leave existing data untouched and embedded markup is only text", async ({ page }) => {
  await open(page);
  const before = await page.evaluate(key => localStorage.getItem(key), storageKey);
  await page.getByRole("button", { name: "Upload KML", exact: true }).click();
  await choose(page, wrap(`<Placemark><name>&lt;img src=x onerror=alert(1)&gt;</name>${polygon()}</Placemark>`));
  await expect(page.locator(".kml-preview li")).toHaveText("<img src=x onerror=alert(1)>4 boundary points");
  await expect(page.locator(".kml-preview img")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(before);
});

for (const [label, xml, message] of [
  ["malformed XML", "<kml><Placemark>", "not valid KML XML"],
  ["no polygons", wrap("<Placemark><Point><coordinates>0,0</coordinates></Point></Placemark>"), "No polygons were found"],
  ["one bad polygon in a batch", wrap(`<Placemark>${polygon()}${polygon("0,0 1,0 1,91")}</Placemark>`), "outside the latitude/longitude limits"],
  ["missing outer boundary", wrap("<Placemark><Polygon/></Placemark>"), "Every polygon needs one outer boundary"],
  ["entity declarations", '<!DOCTYPE kml [<!ENTITY example SYSTEM "https://never-fetch.invalid/entity">]><kml/>', "entity declarations"],
  ["inner boundaries", wrap(`<Placemark>${polygon(boundary, `<innerBoundaryIs><LinearRing><coordinates>${boundary}</coordinates></LinearRing></innerBoundaryIs>`)}</Placemark>`), "inner boundaries (holes)"],
]) {
  test(`${label} is rejected without partially importing any plots`, async ({ page }) => {
    await open(page);
    const before = await page.evaluate(key => localStorage.getItem(key), storageKey);
    await page.getByRole("button", { name: "Upload KML", exact: true }).click();
    await choose(page, xml);
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(message);
    await expect(page.getByRole("button", { name: "Import plots", exact: true })).toBeDisabled();
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(before);
  });
}

test("capacity and file-size limits prevent partial imports", async ({ page }) => {
  const state = createDemoState();
  state.plots = Array.from({ length: 48 }, (_, index) => ({ ...state.plots[0], id: `existing-${index}` }));
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: storageKey, state });
  await open(page);
  await page.getByRole("button", { name: "Upload KML", exact: true }).click();
  await choose(page, multiple);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("room for 2 more plots");
  await expect(page.getByRole("button", { name: "Import 3 plots", exact: true })).toBeDisabled();
  await choose(page, " ".repeat(2 * 1024 * 1024 + 1));
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("no larger than 2 MB");
  await expect(page.getByRole("button", { name: "Import plots", exact: true })).toBeDisabled();
  await choose(page, multiple, "fields.kmz");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Compressed .kmz files are not supported");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).plots.length, storageKey)).toBe(48);
});

test("help and KML preview fit a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole("button", { name: "Help with your plots", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("dialog").evaluate(element => element.getBoundingClientRect().width <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Upload KML", exact: true }).click();
  await choose(page, multiple);
  await expect(page.locator(".kml-preview li")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByRole("dialog").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/kml-preview-mobile.png", fullPage: true });
});
