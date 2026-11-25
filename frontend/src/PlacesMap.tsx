import { useRef, useState, useEffect } from "react";
import {
  Plus,
  Minus,
  Maximize,
  MapPin,
  LocateFixed,
  ArrowRight,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Entity, Media } from "./types";
import { src } from "./types";
export default function PlacesMap({
  entities,
  media = [],
  navigate,
}: {
  entities: Entity[];
  media?: Media[];
  navigate: (to: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    mapRef = useRef<L.Map | null>(null),
    [offline, setOffline] = useState(false),
    [expanded, setExpanded] = useState(false);
  const points = entities.filter(
    (e) => e.latitude !== null && e.longitude !== null,
  );
  useEffect(() => {
    const map = L.map(ref.current!, {
      scrollWheelZoom: false,
      fadeAnimation: false,
      zoomControl: false,
    }).setView([48, 40], 3);
    mapRef.current = map;
    map.attributionControl.setPrefix(false);
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        maxZoom: 18,
      },
    ).addTo(map);
    tiles.on("tileerror", () => setOffline(true));
    tiles.on("tileload", () => setOffline(false));
    const clusters = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
    });
    map.addLayer(clusters);
    for (const e of points) {
      const image = e.cover?.startsWith("/assets/")
        ? e.cover
        : media.find((m) => m.id === e.cover) ||
          media.find((m) => m.entities.includes(e.id));
      const photo = typeof image === "string" ? image : image ? src(image) : "";
      const icon = document.createElement("span");
      icon.className = "map-pin-content";
      if (photo) {
        const img = document.createElement("img");
        img.src = photo;
        img.alt = "";
        icon.append(img);
      } else {
        icon.textContent = e.name.slice(0, 1);
      }
      const marker = L.marker([e.latitude!, e.longitude!], {
        title: e.name,
        icon: L.divIcon({
          className: "place-marker",
          html: icon.outerHTML,
          iconSize: [46, 46],
          iconAnchor: [23, 46],
        }),
      });
      clusters.addLayer(marker);
      const popup = document.createElement("div");
      popup.className = "place-popup";
      if (photo) {
        const img = document.createElement("img");
        img.src = photo;
        img.alt = "";
        popup.append(img);
      }
      const strong = document.createElement("strong");
      strong.textContent = e.name;
      popup.append(strong);
      const count = document.createElement("small");
      count.textContent =
        media.filter((m) => m.entities.includes(e.id)).length + " фотографий";
      popup.append(count);
      const button = document.createElement("button");
      button.textContent = "Открыть фотографии →";
      button.onclick = () => navigate("/places/" + e.id);
      popup.append(button);
      marker.bindPopup(popup, { maxWidth: 240, className: "themed-map-popup" });
    }
    if (points.length)
      map.fitBounds(
        L.latLngBounds(
          points.map((e) => [e.latitude!, e.longitude!] as L.LatLngTuple),
        ),
        { padding: [60, 60], maxZoom: 10 },
      );
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [
    entities
      .map((e) => e.id + e.name + e.cover + e.latitude + e.longitude)
      .join(),
    media.length,
    navigate,
  ]);
  useEffect(() => {
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 220);
    return () => clearTimeout(id);
  }, [expanded]);
  return (
    <section className={"map-card " + (expanded ? "expanded" : "")}>
      <div className="map-card-header">
        <div>
          <MapPin size={20} />
          <strong>Карта ваших воспоминаний</strong>
          <span>{points.length} мест с координатами</span>
        </div>
        <button className="secondary" onClick={() => setExpanded((v) => !v)}>
          <Maximize size={16} />
          {expanded ? "Свернуть" : "Развернуть карту"}
        </button>
      </div>
      <div className="map-canvas">
        <div ref={ref} className="places-map" />
        <div className="map-controls">
          <button
            aria-label="Приблизить карту"
            title="Приблизить"
            onClick={() => mapRef.current?.zoomIn()}
          >
            <Plus size={20} />
          </button>
          <button
            aria-label="Отдалить карту"
            title="Отдалить"
            onClick={() => mapRef.current?.zoomOut()}
          >
            <Minus size={20} />
          </button>
          <button
            aria-label="Показать все места"
            title="Показать все места"
            onClick={() => {
              if (points.length)
                mapRef.current?.fitBounds(
                  L.latLngBounds(
                    points.map(
                      (e) => [e.latitude!, e.longitude!] as L.LatLngTuple,
                    ),
                  ),
                  { padding: [60, 60], maxZoom: 10 },
                );
              else mapRef.current?.setView([48, 40], 3);
            }}
          >
            <LocateFixed size={20} />
          </button>
        </div>
        {!points.length && (
          <div className="map-empty">
            <span>
              <MapPin size={24} />
            </span>
            <strong>Здесь будут ваши места</strong>
            <p>Добавьте место с координатами и свяжите его с фотографиями.</p>
          </div>
        )}
        {offline && (
          <p className="map-offline">
            Не удалось загрузить фон карты. Места доступны в карточках.
          </p>
        )}
      </div>
    </section>
  );
}
