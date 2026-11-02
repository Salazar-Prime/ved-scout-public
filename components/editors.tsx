"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, Save, Trash2, Upload } from "lucide-react";
import { cameraSchema, missionSchema, missionTypeLabels, plotSchema, type Camera, type Collection, type Mission, type Plot } from "../lib/data";
import { useDemo } from "../lib/store";
import { Dialog } from "./dialog";

function Field({ label, name, value, min, max, step = "any" }: { label: string; name: string; value: number; min: number; max: number; step?: string }) {
  return <label className="field">{label}<input type="number" name={name} defaultValue={value} min={min} max={max} step={step} required /></label>;
}

export function Editor({ collection, record, onClose, onImportKml }: { collection: Collection; record?: Plot | Mission | Camera; onClose: () => void; onImportKml?: () => void }) {
  const { state, update } = useDemo();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const label = { plots: "plot", missions: "mission type", cameras: "camera sensor" }[collection];
  const id = record?.id ?? `local-${crypto.randomUUID()}`;
  const mission = record as Mission | undefined;
  const camera = record as Camera | undefined;
  const plot = record as Plot | undefined;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      let next: Plot | Mission | Camera;
      if (collection === "plots") {
        next = plotSchema.parse({ id, name, corners: JSON.parse(String(form.get("corners"))) });
      } else if (collection === "missions") {
        next = missionSchema.parse({ id, name, type: form.get("type"), cameraId: form.get("cameraId"),
          frontOverlap: Number(form.get("frontOverlap")), sideOverlap: Number(form.get("sideOverlap")),
          flightHeight: Number(form.get("flightHeight")), flightSpeed: Number(form.get("flightSpeed")) });
      } else {
        next = cameraSchema.parse({ id, name, imageWidth: Number(form.get("imageWidth")), imageHeight: Number(form.get("imageHeight")),
          focalLength: Number(form.get("focalLength")), sensorWidth: Number(form.get("sensorWidth")) });
      }
      update((current) => ({ ...current, [collection]: record ? current[collection].map((item) => item.id === id ? next : item) : [...current[collection], next] }));
      onClose();
    } catch {
      setError("Check the values. Plots need at least three valid coordinates; missions need a linked camera; all dimensions must be positive.");
    }
  }

  function remove() {
    try {
      update((current) => ({ ...current, [collection]: current[collection].filter((item) => item.id !== record?.id) }));
      onClose();
    } catch {
      setError("This camera is linked to a mission. Choose a different camera in that mission before deleting it.");
      setConfirmDelete(false);
    }
  }

  return <Dialog title={`${record ? "Edit" : "Add"} ${label}`} onClose={onClose}>
    <form onSubmit={save} className="editor">
      <p className="muted">Changes are saved to your browser’s demo copy.</p>
      {onImportKml && <button type="button" className="button secondary" onClick={onImportKml}><Upload size={15} />Upload KML instead</button>}
      <label className="field">Name<input name="name" defaultValue={record?.name ?? ""} maxLength={120} required autoFocus /></label>
      {collection === "plots" && <label className="field">Boundary coordinates<textarea name="corners" rows={8} required defaultValue={JSON.stringify(plot?.corners ?? [
        { lat: 40.471, lng: -86.997 }, { lat: 40.471, lng: -86.996 }, { lat: 40.470, lng: -86.996 }, { lat: 40.470, lng: -86.997 },
      ], null, 2)} spellCheck={false} /><span className="muted small">JSON array of latitude/longitude pairs in boundary order. Example: {`[{"lat":40.47,"lng":-86.99}, …]`}</span></label>}
      {collection === "missions" && <>
        <label className="field">Mission type<select name="type" defaultValue={mission?.type ?? "mapping"}>{Object.entries(missionTypeLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label className="field">Camera sensor<select name="cameraId" defaultValue={mission?.cameraId ?? state.cameras[0]?.id} required>{state.cameras.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.name}</option>)}</select></label>
        <div className="form-grid">
          <Field label="Flight height (m)" name="flightHeight" value={mission?.flightHeight ?? 35} min={0.5} max={120} />
          <Field label="Flight speed (m/s)" name="flightSpeed" value={mission?.flightSpeed ?? 3} min={0.1} max={15} />
          <Field label="Front overlap (%)" name="frontOverlap" value={mission?.frontOverlap ?? 80} min={0} max={95} />
          <Field label="Side overlap (%)" name="sideOverlap" value={mission?.sideOverlap ?? 75} min={0} max={95} />
        </div>
      </>}
      {collection === "cameras" && <div className="form-grid">
        <Field label="Image width (px)" name="imageWidth" value={camera?.imageWidth ?? 8192} min={1} max={50000} step="1" />
        <Field label="Image height (px)" name="imageHeight" value={camera?.imageHeight ?? 5460} min={1} max={50000} step="1" />
        <Field label="Focal length (mm)" name="focalLength" value={camera?.focalLength ?? 35} min={0.1} max={1000} />
        <Field label="Sensor width (mm)" name="sensorWidth" value={camera?.sensorWidth ?? 35.9} min={0.1} max={100} />
      </div>}
      {error && <p className="error" role="alert"><AlertCircle size={16} />{error}</p>}
      {confirmDelete && <div className="delete-confirm"><p>Delete this {label} from your browser? Sample flight records keep their original details.</p><button type="button" className="button danger" onClick={remove}>Delete {label}</button><button type="button" className="button secondary" onClick={() => setConfirmDelete(false)}>Keep it</button></div>}
      <div className="dialog-actions">{record && <button type="button" className="icon-button delete-button" aria-label={`Delete ${label}`} onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></button>}
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button"><Save size={16} />Save changes</button></div>
    </form>
  </Dialog>;
}
