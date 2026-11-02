"use client";

import { useState } from "react";
import { Camera, ChevronRight, Clock3, Gauge, MapPin } from "lucide-react";
import { formatDate, formatDuration, missionTypeLabels, type Flight } from "../lib/data";
import { useDemo } from "../lib/store";
import { Dialog } from "./dialog";

export function FlightHistory() {
  const { state } = useDemo();
  const [selected, setSelected] = useState<Flight | null>(null);
  return <section className="panel history-panel" aria-label="Flight history">
    <div className="panel-heading"><h2>Flight History</h2><span className="sample-label">Sample records</span></div>
    <p className="panel-intro">Total flight time: <strong>{formatDuration(state.flights.reduce((sum, flight) => sum + flight.durationSeconds, 0))}</strong></p>
    <div className="records">{state.flights.map((flight) => <button className="flight-record" key={flight.id} onClick={() => setSelected(flight)} aria-label={`View ${flight.name}`}>
      <span className="flight-record-top"><span className="record-title">{flight.name}</span><ChevronRight size={17} /></span>
      <span className="record-detail">{formatDate(flight.completedAt)} · {missionTypeLabels[flight.mission.type]}</span>
      <span className="flight-metrics"><span><Clock3 size={13} />{formatDuration(flight.durationSeconds)}</span><span><Gauge size={13} />{flight.speedMetersPerSecond} m/s</span><span className="completed-dot">Completed</span></span>
    </button>)}</div>
    {selected && <Dialog title={selected.name} onClose={() => setSelected(null)}><div className="flight-detail">
      <p className="muted">Illustrative flight record · {formatDate(selected.completedAt)}. This is sample data, not a flight run by this public demo.</p>
      <div className="detail-metrics"><div><span>Flight time</span><strong>{formatDuration(selected.durationSeconds)}</strong></div><div><span>Flight speed</span><strong>{selected.speedMetersPerSecond} m/s</strong></div><div><span>Route distance</span><strong>{selected.distanceMeters.toLocaleString()} m</strong></div><div><span>Photos</span><strong>{selected.photoCount}</strong></div></div>
      <section className="detail-section"><h3><MapPin size={16} />Plot & aircraft</h3><dl><dt>Plot</dt><dd>{selected.plot.name}</dd><dt>Boundary</dt><dd>{selected.plot.corners.length} corners</dd><dt>Aircraft</dt><dd>{selected.aircraft}</dd></dl></section>
      <section className="detail-section"><h3>Mission configuration</h3><dl><dt>Mission</dt><dd>{selected.mission.name}</dd><dt>Type</dt><dd>{missionTypeLabels[selected.mission.type]}</dd><dt>Height</dt><dd>{selected.mission.flightHeight} m</dd><dt>Front / side overlap</dt><dd>{selected.mission.frontOverlap}% / {selected.mission.sideOverlap}%</dd></dl></section>
      <section className="detail-section"><h3><Camera size={16} />Camera at time of flight</h3><dl><dt>Sensor</dt><dd>{selected.camera.name}</dd><dt>Image size</dt><dd>{selected.camera.imageWidth} × {selected.camera.imageHeight} px</dd><dt>Focal length</dt><dd>{selected.camera.focalLength} mm</dd><dt>Sensor width</dt><dd>{selected.camera.sensorWidth} mm</dd></dl></section>
      <p className="muted small">The record keeps its original configuration when you edit the current missions or cameras.</p>
    </div></Dialog>}
  </section>;
}
