import { z } from "zod";

const name = z.string().trim().min(1).max(120);
const id = z.string().min(1).max(100);
const date = z.iso.datetime();
const positive = z.number().finite().positive();
export const MAX_PLOTS = 50;
export const MAX_PLOT_CORNERS = 100;

export const cornerSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
}).strict();

export const plotSchema = z.object({
  id,
  name,
  corners: z.array(cornerSchema).min(3).max(MAX_PLOT_CORNERS),
  hint: z.string().max(240).optional(),
}).strict();

export const cameraSchema = z.object({
  id,
  name,
  imageWidth: positive.int().max(50000),
  imageHeight: positive.int().max(50000),
  focalLength: positive.max(1000),
  sensorWidth: positive.max(100),
  hint: z.string().max(240).optional(),
}).strict();

export const missionTypeSchema = z.enum(["mapping", "dsm", "imagePoint", "recordVideo"]);
export const missionSchema = z.object({
  id,
  name,
  type: missionTypeSchema,
  cameraId: id,
  frontOverlap: z.number().finite().min(0).max(95),
  sideOverlap: z.number().finite().min(0).max(95),
  flightHeight: positive.max(120),
  flightSpeed: positive.max(15),
  hint: z.string().max(240).optional(),
}).strict();

export const flightSchema = z.object({
  id,
  name,
  completedAt: date,
  durationSeconds: positive.int().max(86400),
  speedMetersPerSecond: positive.max(15),
  distanceMeters: positive,
  photoCount: z.number().int().min(0).max(100000),
  aircraft: name,
  plot: plotSchema,
  mission: missionSchema,
  camera: cameraSchema,
}).strict();

export const demoStateSchema = z.object({
  version: z.literal(1),
  plots: z.array(plotSchema).max(MAX_PLOTS),
  missions: z.array(missionSchema).max(50),
  cameras: z.array(cameraSchema).max(50),
  flights: z.array(flightSchema).max(100),
}).strict().superRefine((state, context) => {
  for (const key of ["plots", "missions", "cameras", "flights"] as const) {
    if (new Set(state[key].map((item) => item.id)).size !== state[key].length) {
      context.addIssue({ code: "custom", message: `Duplicate ${key} identifiers.`, path: [key] });
    }
  }
  for (const mission of state.missions) {
    if (!state.cameras.some((camera) => camera.id === mission.cameraId)) {
      context.addIssue({ code: "custom", message: "Choose an existing camera for each mission.", path: ["missions"] });
    }
  }
});

export type Plot = z.infer<typeof plotSchema>;
export type Camera = z.infer<typeof cameraSchema>;
export type Mission = z.infer<typeof missionSchema>;
export type Flight = z.infer<typeof flightSchema>;
export type DemoState = z.infer<typeof demoStateSchema>;
export type Collection = "plots" | "missions" | "cameras";

export const STORAGE_KEY = "ved-scout.public-demo.v1";
export const MAX_STORAGE_LENGTH = 500000;
export const plotColors = ["#cfb991", "#60a5fa", "#34d399", "#f472b6", "#a78bfa", "#fbbf24", "#f87171", "#2dd4bf"];
export const missionTypeLabels = {
  mapping: "Orthomosaic mapping", dsm: "Surface model", imagePoint: "Point photography", recordVideo: "Video survey",
};

const cameras: Camera[] = [
  { id: "camera-1", name: "P1 — try changing my focal length", imageWidth: 8192, imageHeight: 5460, focalLength: 35, sensorWidth: 35.9, hint: "Say: Set camera one's focal length to 50 millimeters." },
  { id: "camera-2", name: "Compact RGB · 20 MP", imageWidth: 5472, imageHeight: 3648, focalLength: 8.8, sensorWidth: 13.2 },
  { id: "camera-3", name: "Wide RGB · 12 MP", imageWidth: 4000, imageHeight: 3000, focalLength: 4.5, sensorWidth: 6.3 },
];

const missions: Mission[] = [
  { id: "mission-1", name: "Mapping — try changing my height", type: "mapping", cameraId: "camera-1", frontOverlap: 80, sideOverlap: 75, flightHeight: 35, flightSpeed: 3, hint: "Say: Set mission one's flight height to 45 meters." },
  { id: "mission-2", name: "Detailed surface model", type: "dsm", cameraId: "camera-1", frontOverlap: 85, sideOverlap: 80, flightHeight: 25, flightSpeed: 2 },
  { id: "mission-3", name: "Quick RGB scouting", type: "mapping", cameraId: "camera-2", frontOverlap: 70, sideOverlap: 65, flightHeight: 50, flightSpeed: 5 },
  { id: "mission-4", name: "Point inspection", type: "imagePoint", cameraId: "camera-3", frontOverlap: 0, sideOverlap: 0, flightHeight: 15, flightSpeed: 1 },
];

const plots: Plot[] = [
  { id: "plot-1", name: "Plot 1 — rename me by voice", corners: [{ lat: 40.4741, lng: -86.9964 }, { lat: 40.4741, lng: -86.9947 }, { lat: 40.4728, lng: -86.9947 }, { lat: 40.4728, lng: -86.9964 }], hint: 'Tap the mic and say: Rename plot one to "North field".' },
  { id: "plot-2", name: "Plot 2 — give this field a name", corners: [{ lat: 40.4726, lng: -86.9938 }, { lat: 40.4726, lng: -86.9918 }, { lat: 40.4712, lng: -86.9918 }, { lat: 40.4712, lng: -86.9938 }], hint: 'Say: Rename plot two to "South field".' },
  { id: "plot-3", name: "Plot 3 — your next scouting area", corners: [{ lat: 40.4745, lng: -86.9924 }, { lat: 40.4745, lng: -86.9905 }, { lat: 40.4736, lng: -86.9901 }, { lat: 40.4731, lng: -86.9911 }, { lat: 40.4734, lng: -86.9924 }], hint: 'Say: Rename plot three to "East field".' },
];

function withoutHint<T extends { hint?: string }>(value: T): Omit<T, "hint"> {
  const { hint: _hint, ...record } = value;
  return record;
}

function sampleFlight(index: number, plotIndex: number, missionIndex: number, durationSeconds: number, distanceMeters: number, photoCount: number): Flight {
  const mission = missions[missionIndex];
  const camera = cameras.find((item) => item.id === mission.cameraId)!;
  return {
    id: `flight-${index}`, name: ["North field mapping", "Surface detail survey", "South field scouting"][index - 1],
    completedAt: `2026-10-${String(20 - index).padStart(2, "0")}T14:30:00.000Z`,
    durationSeconds, speedMetersPerSecond: mission.flightSpeed, distanceMeters, photoCount,
    aircraft: "DJI Matrice 300 RTK (sample)",
    plot: { ...withoutHint(plots[plotIndex]), name: ["North field", "South field", "East field"][plotIndex] },
    mission: { ...withoutHint(mission), name: ["Standard mapping", "Detailed surface model", "Quick RGB scouting"][missionIndex] },
    camera: { ...withoutHint(camera), name: camera.id === "camera-1" ? "Zenmuse P1 · 35 mm" : camera.name },
  };
}

export function createDemoState(): DemoState {
  return demoStateSchema.parse({ version: 1, plots, missions, cameras, flights: [
    sampleFlight(1, 0, 0, 524, 1260, 168),
    sampleFlight(2, 2, 1, 742, 1140, 246),
    sampleFlight(3, 1, 2, 368, 1430, 112),
  ] });
}

export function readStoredState(raw: string): DemoState {
  if (raw.length > MAX_STORAGE_LENGTH) throw new Error("This saved demo is too large to open.");
  return demoStateSchema.parse(JSON.parse(raw));
}

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function plotAreaHectares(plot: Plot) {
  const latitude = plot.corners.reduce((sum, point) => sum + point.lat, 0) / plot.corners.length;
  const scaleX = 111320 * Math.cos(latitude * Math.PI / 180);
  const origin = plot.corners[0];
  const points = plot.corners.map((point) => ({ x: (point.lng - origin.lng) * scaleX, y: (point.lat - origin.lat) * 111320 }));
  return Math.abs(points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 20000;
}
