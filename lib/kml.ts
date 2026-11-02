import { z } from "zod";
import { cornerSchema, demoStateSchema, MAX_PLOT_CORNERS, MAX_PLOTS, MAX_STORAGE_LENGTH, plotAreaHectares, plotSchema, type DemoState } from "./data";

export const MAX_KML_BYTES = 2 * 1024 * 1024;
const importedPlotSchema = plotSchema.omit({ id: true, hint: true });
export type ImportedPlot = z.infer<typeof importedPlotSchema>;
const namespaces = new Set(["", "http://www.opengis.net/kml/2.2", "http://earth.google.com/kml/2.0", "http://earth.google.com/kml/2.1", "http://earth.google.com/kml/2.2"]);
const isKml = (element: Element, name: string) => element.localName === name && namespaces.has(element.namespaceURI ?? "");
const children = (element: Element, name: string) => Array.from(element.children).filter(child => isKml(child, name));

export function parseKmlCoordinates(text: string): ImportedPlot["corners"] {
  const tuples = text.trim().split(/\s+/).filter(Boolean);
  if (tuples.length > MAX_PLOT_CORNERS + 1) throw new Error(`Each polygon can have at most ${MAX_PLOT_CORNERS} boundary points. No plots were imported.`);
  const corners = tuples.map(tuple => {
    const parts = tuple.split(",");
    if (parts.length < 2 || parts.length > 3 || parts.some(part => !part.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(part))) {
      throw new Error("A polygon contains invalid coordinates. Use longitude,latitude with an optional altitude.");
    }
    if (parts.some(part => !Number.isFinite(Number(part)))) throw new Error("Polygon coordinates must be finite numbers.");
    const parsed = cornerSchema.safeParse({ lng: Number(parts[0]), lat: Number(parts[1]) });
    if (!parsed.success) throw new Error("Polygon coordinates are outside the latitude/longitude limits.");
    return parsed.data;
  });
  const first = corners[0];
  const last = corners.at(-1);
  if (corners.length > 1 && first.lat === last?.lat && first.lng === last.lng) corners.pop();
  if (corners.length < 3 || new Set(corners.map(point => `${point.lat},${point.lng}`)).size < 3) throw new Error("Every polygon needs at least three distinct boundary points.");
  if (corners.length > MAX_PLOT_CORNERS) throw new Error(`Each polygon can have at most ${MAX_PLOT_CORNERS} boundary points. No plots were imported.`);
  if (plotAreaHectares({ id: "check", name: "check", corners }) === 0) throw new Error("A polygon has no area. Check its boundary coordinates.");
  return corners;
}

export function parseKml(text: string): ImportedPlot[] {
  if (text.length > MAX_KML_BYTES || new TextEncoder().encode(text).length > MAX_KML_BYTES) throw new Error("Choose a KML file no larger than 2 MB.");
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text)) throw new Error("KML files with document types or entity declarations are not supported.");
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.getElementsByTagNameNS("*", "parsererror").length || !isKml(document.documentElement, "kml")) throw new Error("This is not valid KML XML. Check the file and try again.");
  const polygons = Array.from(document.getElementsByTagNameNS("*", "Polygon")).filter(element => isKml(element, "Polygon"));
  if (!polygons.length) throw new Error("No polygons were found. Points, lines, and network links are not imported.");
  if (polygons.length > MAX_PLOTS) throw new Error(`This file has ${polygons.length} polygons. The demo supports ${MAX_PLOTS} plots in total; no plots were imported.`);

  // Group by the nearest Placemark so every MultiGeometry polygon is included,
  // not just the first polygon of each Placemark.
  const placemarkFor = (polygon: Element) => {
    let parent = polygon.parentElement;
    while (parent && !isKml(parent, "Placemark")) parent = parent.parentElement;
    return parent;
  };
  const groups = new Map<Element | null, Element[]>();
  for (const polygon of polygons) {
    const placemark = placemarkFor(polygon);
    groups.set(placemark, [...groups.get(placemark) ?? [], polygon]);
  }
  const usedNames = new Set<string>();
  return polygons.map((polygon, index) => {
    if (children(polygon, "innerBoundaryIs").length) throw new Error("A polygon has inner boundaries (holes), which this demo cannot represent. No plots were imported.");
    const outer = children(polygon, "outerBoundaryIs");
    const rings = outer.length === 1 ? children(outer[0], "LinearRing") : [];
    const coordinates = rings.length === 1 ? children(rings[0], "coordinates") : [];
    if (coordinates.length !== 1) throw new Error("Every polygon needs one outer boundary with a LinearRing and coordinates. No plots were imported.");
    const placemark = placemarkFor(polygon);
    const base = (placemark ? children(placemark, "name")[0]?.textContent : "")?.replace(/\s+/g, " ").trim() || `Imported plot ${index + 1}`;
    const group = groups.get(placemark)!;
    let suffix = group.length > 1 && placemark ? ` (${group.indexOf(polygon) + 1})` : "";
    let name = `${base.slice(0, 120 - suffix.length)}${suffix}`;
    let duplicate = 2;
    while (usedNames.has(name)) {
      suffix = ` (${duplicate++})`;
      name = `${base.slice(0, 120 - suffix.length)}${suffix}`;
    }
    usedNames.add(name);
    return importedPlotSchema.parse({ name, corners: parseKmlCoordinates(coordinates[0].textContent ?? "") });
  });
}

export function appendImportedPlots(state: DemoState, polygons: ImportedPlot[], makeId = () => `local-${crypto.randomUUID()}`): DemoState {
  const valid = z.array(importedPlotSchema).min(1).max(MAX_PLOTS).parse(polygons);
  if (state.plots.length + valid.length > MAX_PLOTS) throw new Error(`There is room for ${MAX_PLOTS - state.plots.length} more plots, but this file has ${valid.length}. Remove some plots first; nothing was imported.`);
  const next = demoStateSchema.parse({ ...state, plots: [...state.plots, ...valid.map(polygon => ({ ...polygon, id: makeId() }))] });
  if (JSON.stringify(next).length > MAX_STORAGE_LENGTH) throw new Error("These plots would exceed the demo's storage limit. Nothing was imported.");
  return next;
}
