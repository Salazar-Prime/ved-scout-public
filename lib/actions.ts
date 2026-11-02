import { z } from "zod";
import { cameraSchema, demoStateSchema, missionSchema, plotSchema, type DemoState } from "./data";

// Null means "leave unchanged". All keys are required for OpenAI strict schemas.
const plotChanges = z.object({ name: plotSchema.shape.name.nullable(), corners: plotSchema.shape.corners.nullable() }).strict();
const cameraChanges = z.object({ name: cameraSchema.shape.name.nullable(), imageWidth: cameraSchema.shape.imageWidth.nullable(), imageHeight: cameraSchema.shape.imageHeight.nullable(), focalLength: cameraSchema.shape.focalLength.nullable(), sensorWidth: cameraSchema.shape.sensorWidth.nullable() }).strict();
const missionChanges = z.object({ name: missionSchema.shape.name.nullable(), type: missionSchema.shape.type.nullable(), cameraId: missionSchema.shape.cameraId.nullable(), frontOverlap: missionSchema.shape.frontOverlap.nullable(), sideOverlap: missionSchema.shape.sideOverlap.nullable(), flightHeight: missionSchema.shape.flightHeight.nullable(), flightSpeed: missionSchema.shape.flightSpeed.nullable() }).strict();

export const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("update_plot"), id: z.string(), changes: plotChanges }).strict(),
  z.object({ kind: z.literal("update_mission"), id: z.string(), changes: missionChanges }).strict(),
  z.object({ kind: z.literal("update_camera"), id: z.string(), changes: cameraChanges }).strict(),
  z.object({ kind: z.literal("add_plot"), record: plotSchema.omit({ id: true, hint: true }) }).strict(),
  z.object({ kind: z.literal("add_mission"), record: missionSchema.omit({ id: true, hint: true }) }).strict(),
  z.object({ kind: z.literal("add_camera"), record: cameraSchema.omit({ id: true, hint: true }) }).strict(),
  z.object({ kind: z.literal("delete_plot"), id: z.string() }).strict(),
  z.object({ kind: z.literal("delete_mission"), id: z.string() }).strict(),
  z.object({ kind: z.literal("delete_camera"), id: z.string() }).strict(),
]);

export const proposalSchema = z.object({
  message: z.string().min(1).max(1800),
  actions: z.array(actionSchema).max(5),
}).strict();
export type Proposal = z.infer<typeof proposalSchema>;
export type DemoAction = z.infer<typeof actionSchema>;

export const assistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(1500),
  state: demoStateSchema,
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1800) }).strict()).max(6).default([]),
}).strict();

export function applyActions(state: DemoState, actions: DemoAction[], makeId = () => `local-${crypto.randomUUID()}`): DemoState {
  let next = demoStateSchema.parse(state);
  for (const action of z.array(actionSchema).max(5).parse(actions)) {
    if (action.kind === "update_plot") {
      if (!next.plots.some((item) => item.id === action.id)) throw new Error("That plot no longer exists. Ask again using the current list.");
      next.plots = next.plots.map((item) => item.id === action.id ? { ...item, ...Object.fromEntries(Object.entries(action.changes).filter(([, value]) => value !== null)), hint: undefined } : item);
    } else if (action.kind === "update_mission") {
      if (!next.missions.some((item) => item.id === action.id)) throw new Error("That mission no longer exists. Ask again using the current list.");
      next.missions = next.missions.map((item) => item.id === action.id ? { ...item, ...Object.fromEntries(Object.entries(action.changes).filter(([, value]) => value !== null)), hint: undefined } : item);
    } else if (action.kind === "update_camera") {
      if (!next.cameras.some((item) => item.id === action.id)) throw new Error("That camera no longer exists. Ask again using the current list.");
      next.cameras = next.cameras.map((item) => item.id === action.id ? { ...item, ...Object.fromEntries(Object.entries(action.changes).filter(([, value]) => value !== null)), hint: undefined } : item);
    } else if (action.kind === "add_plot") {
      next.plots.push({ id: makeId(), ...action.record });
    } else if (action.kind === "add_mission") {
      next.missions.push({ id: makeId(), ...action.record });
    } else if (action.kind === "add_camera") {
      next.cameras.push({ id: makeId(), ...action.record });
    } else {
      const collection = action.kind === "delete_plot" ? "plots" : action.kind === "delete_mission" ? "missions" : "cameras";
      if (!next[collection].some((item) => item.id === action.id)) throw new Error("That record no longer exists. Ask again using the current list.");
      if (collection === "plots") next.plots = next.plots.filter((item) => item.id !== action.id);
      if (collection === "missions") next.missions = next.missions.filter((item) => item.id !== action.id);
      if (collection === "cameras") next.cameras = next.cameras.filter((item) => item.id !== action.id);
    }
  }
  // Validate the whole transaction so a partial batch is never committed.
  return demoStateSchema.parse(next);
}

export function describeAction(action: DemoAction, state: DemoState): string {
  if ("record" in action) return `Add ${action.kind.slice(4)}: ${action.record.name}`;
  const collection = action.kind.endsWith("plot") ? state.plots : action.kind.endsWith("mission") ? state.missions : state.cameras;
  const record = collection.find((item) => item.id === action.id);
  if (!("changes" in action)) return `Delete ${record?.name ?? action.id}`;
  const fields = Object.entries(action.changes).filter(([, value]) => value !== null).map(([key, value]) => `${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${Array.isArray(value) ? `${value.length} corners` : value}`);
  return `${record?.name ?? action.id} → ${fields.join("; ")}`;
}
