import assert from "node:assert/strict";
import test from "node:test";
import { applyActions, proposalSchema } from "../lib/actions";
import { createDemoState, demoStateSchema, readStoredState, MAX_STORAGE_LENGTH } from "../lib/data";

test("each visitor receives an independent sample copy", () => {
  const first = createDemoState();
  const second = createDemoState();
  first.plots[0].name = "My north field";
  first.cameras[0].focalLength = 50;
  assert.notEqual(second.plots[0].name, first.plots[0].name);
  assert.equal(second.cameras[0].focalLength, 35);
});

test("storage round-trip preserves edits and deliberately empty collections", () => {
  const state = createDemoState();
  state.plots = [];
  state.missions = [];
  state.cameras = [];
  assert.deepEqual(readStoredState(JSON.stringify(state)), state);
});

test("invalid, oversized, extra-field, and obsolete stored states are rejected", () => {
  const state = createDemoState();
  for (const raw of ["{", JSON.stringify({ ...state, version: 0 }), JSON.stringify({ ...state, credential: "unexpected" }), " ".repeat(MAX_STORAGE_LENGTH + 1)]) {
    assert.throws(() => readStoredState(raw));
  }
  state.cameras[0].imageWidth = Infinity;
  assert.equal(demoStateSchema.safeParse(state).success, false);
});

test("plot rename preserves boundary and sample flight history", () => {
  const state = createDemoState();
  const next = applyActions(state, [{ kind: "update_plot", id: "plot-1", changes: { name: "North field", corners: null } }]);
  assert.equal(next.plots[0].name, "North field");
  assert.deepEqual(next.plots[0].corners, state.plots[0].corners);
  assert.deepEqual(next.flights, state.flights);
  assert.notEqual(state.plots[0].name, "North field");
});

test("camera and mission updates preserve unrelated configuration and history snapshots", () => {
  const state = createDemoState();
  const next = applyActions(state, [
    { kind: "update_camera", id: "camera-1", changes: { name: null, imageWidth: null, imageHeight: null, focalLength: 50, sensorWidth: null } },
    { kind: "update_mission", id: "mission-1", changes: { name: null, type: null, cameraId: null, frontOverlap: null, sideOverlap: null, flightHeight: 45, flightSpeed: null } },
  ]);
  assert.equal(next.cameras[0].focalLength, 50);
  assert.equal(next.cameras[0].sensorWidth, 35.9);
  assert.equal(next.missions[0].flightHeight, 45);
  assert.equal(next.missions[0].flightSpeed, 3);
  assert.equal(next.flights[0].camera.focalLength, 35);
  assert.equal(next.flights[0].mission.flightHeight, 35);
});

test("unknown IDs, out-of-range changes, and real-flight actions cannot apply", () => {
  const state = createDemoState();
  assert.throws(() => applyActions(state, [{ kind: "delete_plot", id: "unknown" }]));
  assert.throws(() => applyActions(state, [{ kind: "update_mission", id: "mission-1", changes: { name: null, type: null, cameraId: null, frontOverlap: null, sideOverlap: null, flightHeight: 130, flightSpeed: null } }]));
  assert.equal(proposalSchema.safeParse({ message: "Fly", actions: [{ kind: "takeoff", altitude: 10 }] }).success, false);
  assert.equal(proposalSchema.safeParse({ message: "Edit", actions: [{ kind: "delete_plot", id: "plot-1", path: "/arbitrary" }] }).success, false);
});

test("linked-camera deletion fails atomically without changing the original", () => {
  const state = createDemoState();
  assert.throws(() => applyActions(state, [
    { kind: "update_plot", id: "plot-1", changes: { name: "Should not commit", corners: null } },
    { kind: "delete_camera", id: "camera-1" },
  ]));
  assert.notEqual(state.plots[0].name, "Should not commit");
  assert.equal(state.cameras.length, 3);
});

test("record additions use generated local IDs and reject oversized collections", () => {
  const state = createDemoState();
  const next = applyActions(state, [{ kind: "add_camera", record: { name: "My RGB", imageWidth: 4000, imageHeight: 3000, focalLength: 8.8, sensorWidth: 13.2 } }], () => "local-test-id");
  assert.equal(next.cameras.at(-1)?.id, "local-test-id");
  state.plots = Array.from({ length: 51 }, (_, index) => ({ ...state.plots[0], id: `plot-${index}` }));
  assert.equal(demoStateSchema.safeParse(state).success, false);
});
