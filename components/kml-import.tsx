"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Upload } from "lucide-react";
import { MAX_PLOT_CORNERS, MAX_PLOTS } from "../lib/data";
import { appendImportedPlots, MAX_KML_BYTES, parseKml, type ImportedPlot } from "../lib/kml";
import { useDemo } from "../lib/store";
import { Dialog } from "./dialog";

export function KmlImport({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const { state, ready, update } = useDemo();
  const [polygons, setPolygons] = useState<ImportedPlot[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const selection = useRef(0);
  useEffect(() => () => { selection.current += 1; }, []);
  const remaining = MAX_PLOTS - state.plots.length;
  const capacityError = polygons.length > remaining ? `This file has ${polygons.length} polygons, but there is room for ${remaining} more plots. Remove some plots first; nothing has been imported.` : "";

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const epoch = ++selection.current;
    setPolygons([]); setError(""); setFilename(file?.name ?? ""); setReading(false);
    if (!file) return;
    try {
      if (!/\.kml$/i.test(file.name)) throw new Error("Choose a .kml file. Compressed .kmz files are not supported.");
      if (file.size > MAX_KML_BYTES) throw new Error("Choose a KML file no larger than 2 MB.");
      setReading(true);
      const text = await file.text();
      if (selection.current !== epoch) return;
      setPolygons(parseKml(text));
    } catch (caught) {
      if (selection.current === epoch) setError(caught instanceof Error ? caught.message : "The KML file could not be read.");
    } finally { if (selection.current === epoch) setReading(false); }
  }

  function importAll() {
    setError("");
    try {
      update(current => appendImportedPlots(current, polygons));
      onImported(polygons.length);
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The plots could not be imported. Nothing was changed."); }
  }

  return <Dialog title="Import plots from KML" onClose={onClose}><div className="editor kml-import">
    <p className="muted">Each polygon becomes a separate plot. Existing plots are kept. Multiple placemarks, nested folders, and MultiGeometry polygons are supported.</p>
    <label className="field">KML file<input type="file" accept=".kml,application/vnd.google-earth.kml+xml" onChange={event => void chooseFile(event)} disabled={!ready} /></label>
    {filename && <p className="small import-filename">Selected: {filename}</p>}
    {reading && <p className="muted small" role="status">Reading KML…</p>}
    {polygons.length > 0 && <><p role="status">Found {polygons.length} {polygons.length === 1 ? "polygon" : "polygons"}. Review the plots below, then import them all.</p><ul className="kml-preview" aria-label="Plots to import">{polygons.map((polygon, index) => <li key={index}><strong>{polygon.name}</strong><span>{polygon.corners.length} boundary points</span></li>)}</ul></>}
    {(error || capacityError) && <p className="error" role="alert"><AlertCircle size={16} />{error || capacityError}</p>}
    <p className="muted small">Limits: 2 MB per file, {MAX_PLOTS} plots in total, and {MAX_PLOT_CORNERS} boundary points per polygon. Polygons with inner boundaries (holes) are not supported. Invalid files are rejected without importing any plots.</p>
    <p className="muted small">The file is read in this browser, not uploaded. Imported plot coordinates may be sent to OpenAI if you later submit a voice or text command.</p>
    <div className="dialog-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button" onClick={importAll} disabled={!ready || reading || !polygons.length || !!capacityError}><Upload size={15} />{polygons.length ? `Import ${polygons.length} ${polygons.length === 1 ? "plot" : "plots"}` : "Import plots"}</button></div>
  </div></Dialog>;
}
