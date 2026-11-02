"use client";

import { useState } from "react";
import { Camera as CameraIcon, CircleHelp, Crosshair, MapPin, Pencil, Plus, Upload } from "lucide-react";
import { missionTypeLabels, plotAreaHectares, plotColors, type Camera, type Collection, type Mission, type Plot } from "../lib/data";
import { useDemo } from "../lib/store";
import { Editor } from "./editors";
import { CollectionHelp } from "./collection-help";
import { KmlImport } from "./kml-import";

export function CollectionPanel({ collection, onFocus }: { collection: Collection; onFocus?: (id: string | null) => void }) {
  const { state, ready } = useDemo();
  const [editing, setEditing] = useState<Plot | Mission | Camera | "new" | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const records = state[collection];
  const title = { plots: "Your plots", missions: "Mission types", cameras: "Camera sensors" }[collection];
  const heading = { plots: "Your Plots", missions: "Mission Types", cameras: "Camera Sensors" }[collection];
  const singular = { plots: "plot", missions: "mission", cameras: "camera" }[collection];
  const Icon = { plots: MapPin, missions: Crosshair, cameras: CameraIcon }[collection];
  return <section className={`panel collection-panel ${collection}`} aria-label={title}>
    <div className="panel-heading"><h2>{heading}</h2><div className="panel-tools">{collection === "plots" && <button className="header-action" disabled={!ready} onClick={() => { setImportedCount(0); setImportOpen(true); }}><Upload size={14} />Upload KML</button>}<button className="icon-button" aria-label={`Help with ${title.toLowerCase()}`} title={`Help with ${title.toLowerCase()}`} onClick={() => setHelpOpen(true)}><CircleHelp size={17} /></button></div></div>
    {importedCount > 0 && <p className="import-success" role="status">Imported {importedCount} {importedCount === 1 ? "plot" : "plots"} into your browser.</p>}
    <div className="records">
      {records.length === 0 && <p className="empty">No {title.toLowerCase()} yet. Use + to add one, or reset the demo.</p>}
      {records.map((record, index) => {
        let details = "";
        if (collection === "plots") {
          const plot = record as Plot;
          details = `${plot.corners.length} corners · ${plotAreaHectares(plot).toFixed(2)} ha`;
        } else if (collection === "missions") {
          const mission = record as Mission;
          details = `${missionTypeLabels[mission.type]} · ${mission.flightHeight} m · ${mission.flightSpeed} m/s · ${mission.frontOverlap}/${mission.sideOverlap}% overlap`;
        } else {
          const camera = record as Camera;
          details = `${camera.imageWidth} × ${camera.imageHeight} px · ${camera.focalLength} mm lens · ${camera.sensorWidth} mm sensor`;
        }
        return <div className="record" key={record.id}>
          <span className="record-icon" style={collection === "plots" ? { color: plotColors[index % plotColors.length] } : undefined} aria-hidden="true"><Icon size={16} /></span>
          <button className="record-body" disabled={!ready} onClick={() => collection === "plots" && onFocus ? onFocus(record.id) : setEditing(record)} title={collection === "plots" && onFocus ? "Focus this plot on the map" : `Edit ${singular}`}>
            <span className="record-title">{record.name}</span><span className="record-detail">{details}</span>
            {record.hint && <span className="record-hint">{record.hint}</span>}
            {collection === "missions" && <span className="record-detail camera-link"><CameraIcon size={12} />{state.cameras.find((item) => item.id === (record as Mission).cameraId)?.name}</span>}
          </button>
          <button className="icon-button" disabled={!ready} aria-label={`Edit ${singular} ${index + 1}`} title={`Edit ${singular} ${index + 1}`} onClick={() => setEditing(record)}><Pencil size={14} /></button>
        </div>;
      })}
    </div>
    <button className="add-button" disabled={!ready} aria-label={`Add ${singular}`} title={`Add ${singular}`} onClick={() => setEditing("new")}><Plus size={18} /></button>
    {editing && <Editor collection={collection} record={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onImportKml={collection === "plots" && editing === "new" ? () => { setEditing(null); setImportedCount(0); setImportOpen(true); } : undefined} />}
    {helpOpen && <CollectionHelp collection={collection} onClose={() => setHelpOpen(false)} />}
    {importOpen && <KmlImport onClose={() => setImportOpen(false)} onImported={count => { setImportedCount(count); onFocus?.(null); }} />}
  </section>;
}
