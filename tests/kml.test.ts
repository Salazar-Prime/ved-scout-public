import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState, MAX_PLOT_CORNERS } from "../lib/data";
import { appendImportedPlots, MAX_KML_BYTES, parseKml, parseKmlCoordinates, type ImportedPlot } from "../lib/kml";

const rectangle = "-86.99,40.47,0 -86.98,40.47,5 -86.98,40.48,0 -86.99,40.48,0 -86.99,40.47,0";
const plots = (): ImportedPlot[] => [{ name: "Imported north", corners: parseKmlCoordinates(rectangle) }, { name: "Imported south", corners: parseKmlCoordinates(rectangle) }];

test("KML longitude/latitude order is converted and the closing vertex is removed", () => {
  const points = parseKmlCoordinates(rectangle);
  assert.equal(points.length, 4);
  assert.deepEqual(points[0], { lat: 40.47, lng: -86.99 });
  assert.deepEqual(points[1], { lat: 40.47, lng: -86.98 });
});

test("two-dimensional, signed, decimal, and exponent coordinates are accepted", () => {
  const points = parseKmlCoordinates("-8.699e1,+40.47 -86.98,40.47 -86.98,40.48");
  assert.equal(points.length, 3);
  assert.deepEqual(points[0], { lat: 40.47, lng: -86.99 });
});

test("invalid or degenerate coordinates are rejected instead of skipped", () => {
  for (const invalid of ["", "0,0 1,1", "0,0 1,1 2,2", "0,0 0,0 0,0", "0,0 1,0 1,91", "0,0 1,0 181,1", "0,0 1,0 x,1", "0,0 1,0 ,1", "0,0 1,0 1,1,", "0,0 1,0 1,1,Infinity", "0,0 1,0 1,1,0,0", "0,0 1,0 0x10,1"]) {
    assert.throws(() => parseKmlCoordinates(invalid), invalid);
  }
});

test("the point limit excludes a repeated closing vertex but never simplifies a polygon", () => {
  const circle = (length: number) => Array.from({ length }, (_, index) => `${Math.cos(index * 2 * Math.PI / length)},${Math.sin(index * 2 * Math.PI / length)}`);
  const boundary = circle(MAX_PLOT_CORNERS);
  assert.equal(parseKmlCoordinates([...boundary, boundary[0]].join(" ")).length, MAX_PLOT_CORNERS);
  assert.throws(() => parseKmlCoordinates(circle(MAX_PLOT_CORNERS + 1).join(" ")), /at most 100/);
});

test("an entire imported batch receives independent IDs without mutating existing records", () => {
  const state = createDemoState();
  const before = JSON.stringify(state);
  let id = 0;
  const next = appendImportedPlots(state, plots(), () => `local-import-${++id}`);
  assert.equal(next.plots.length, 5);
  assert.deepEqual(next.plots.slice(3).map(plot => plot.id), ["local-import-1", "local-import-2"]);
  assert.deepEqual(next.flights, state.flights);
  assert.deepEqual(next.missions, state.missions);
  assert.deepEqual(next.cameras, state.cameras);
  assert.equal(JSON.stringify(state), before);
});

test("invalid batches and duplicate IDs fail atomically", () => {
  const state = createDemoState();
  const before = JSON.stringify(state);
  const invalid = plots();
  invalid[1].corners[0].lat = 95;
  assert.throws(() => appendImportedPlots(state, invalid));
  assert.throws(() => appendImportedPlots(state, plots(), () => "duplicate"));
  assert.equal(JSON.stringify(state), before);
});

test("the current plot count is checked before committing any imported record", () => {
  const state = createDemoState();
  state.plots = Array.from({ length: 49 }, (_, index) => ({ ...state.plots[0], id: `existing-${index}` }));
  const before = JSON.stringify(state);
  assert.throws(() => appendImportedPlots(state, plots()), /room for 1 more plots/);
  assert.equal(JSON.stringify(state), before);
});

test("oversized XML and entity declarations are rejected before DOM parsing", () => {
  assert.throws(() => parseKml(" ".repeat(MAX_KML_BYTES + 1)), /2 MB/);
  assert.throws(() => parseKml("<!DOCTYPE kml [<!ENTITY example SYSTEM 'https://example.invalid/private'>]><kml/>"), /entity declarations/);
});
