import { useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Point {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  distance_km?: number;
}

export function NearbyMap({ origin, agents }: { origin: Point; agents: Point[] }) {
  const [tileFailed, setTileFailed] = useState(false);
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL;
  const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || "Map tiles configured by operator";
  if (!tileUrl || tileFailed) return null;
  return (
    <div className="nearby-map" aria-label="Simulated nearby-agent map">
      <MapContainer
        center={[Number(origin.latitude), Number(origin.longitude)]}
        zoom={13}
        scrollWheelZoom={false}
      >
        <TileLayer
          url={tileUrl}
          attribution={attribution}
          eventHandlers={{ tileerror: () => setTileFailed(true) }}
        />
        <CircleMarker center={[Number(origin.latitude), Number(origin.longitude)]} radius={9}>
          <Popup>{origin.name} (current agent)</Popup>
        </CircleMarker>
        {agents.map((agent) => (
          <CircleMarker
            key={agent.id}
            center={[Number(agent.latitude), Number(agent.longitude)]}
            radius={7}
            pathOptions={{ color: "#0e7490" }}
          >
            <Popup>{agent.name} · {agent.distance_km} km</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
