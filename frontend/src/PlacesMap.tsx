import { useRef, useState, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Entity } from "./types";
export default function PlacesMap({
  entities,
  navigate,
}: {
  entities: Entity[];
  navigate: (to: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [offline, setOffline] = useState(false);
  useEffect(() => {
    const map = L.map(ref.current!, { scrollWheelZoom: false }).setView(
      [45, 45],
      2,
    );
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "© OpenStreetMap contributors", maxZoom: 18 },
    ).addTo(map);
    tiles.on("tileerror", () => setOffline(true));
    const points: L.LatLngTuple[] = [];
    const clusters = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
    });
    map.addLayer(clusters);
    for (const e of entities) {
      if (e.latitude === null || e.longitude === null) continue;
      points.push([e.latitude, e.longitude]);
      const marker = L.marker([e.latitude, e.longitude], {
        icon: L.divIcon({
          className: "place-marker",
          html: "<span></span>",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      });
      clusters.addLayer(marker);
      const button = document.createElement("button");
      button.textContent = e.name + " →";
      button.onclick = () => navigate("/places/" + e.id);
      marker.bindPopup(button);
    }
    if (points.length)
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 9 });
    return () => {
      map.remove();
    };
  }, [entities.map((e) => e.id + e.latitude + e.longitude).join(), navigate]);
  return (
    <div className="map-wrap">
      <div ref={ref} className="places-map" />
      {offline && (
        <small>
          Картографический фон недоступен. Сохранённые места доступны в
          карточках выше.
        </small>
      )}
    </div>
  );
}
