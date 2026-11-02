"use client";

import { useEffect } from "react";
import { MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { plotColors } from "../lib/data";
import { useDemo } from "../lib/store";

function Focus({ plotId }: { plotId: string | null }) {
  const map = useMap();
  const { state } = useDemo();
  useEffect(() => {
    const selected = plotId ? state.plots.filter((plot) => plot.id === plotId) : state.plots;
    const points = selected.flatMap((plot) => plot.corners.map((corner) => [corner.lat, corner.lng] as [number, number]));
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 17, animate: false });
  }, [map, plotId, state.plots]);
  return null;
}

export default function FieldMap({ focusedPlotId }: { focusedPlotId: string | null }) {
  const { state } = useDemo();
  return <MapContainer center={[40.4725, -86.9935]} zoom={15} className="field-map" scrollWheelZoom={false}>
    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
    <Focus plotId={focusedPlotId} />
    {state.plots.map((plot, index) => <Polygon key={plot.id} positions={plot.corners.map(({ lat, lng }) => [lat, lng] as [number, number])}
      pathOptions={{ color: plotColors[index % plotColors.length], weight: focusedPlotId === plot.id ? 4 : 2, fillOpacity: .22 }}>
      <Tooltip sticky>{plot.name}</Tooltip>
    </Polygon>)}
  </MapContainer>;
}
