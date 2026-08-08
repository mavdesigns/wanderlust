import { CONFIG } from "../config.js";

let map = null;
let markersGroup = null;
let lightMapLayer = null;
let darkMapLayer = null;
let routeLayer = null;
let draftMarker = null;
let draftMoveHandler = null;

export function initMap(containerId, onMapClickCallback) {
  map = L.map(containerId).setView(
    CONFIG.DEFAULT_MAP_CENTER,
    CONFIG.DEFAULT_ZOOM,
  );
  lightMapLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    },
  );

  darkMapLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    },
  );

  // Start with the light map.
  lightMapLayer.addTo(map);
  markersGroup = L.layerGroup().addTo(map);
  map.on("click", (e) => onMapClickCallback?.(e.latlng.lat, e.latlng.lng));
}

export function renderMarkers(places, onMarkerClickCallback) {
  if (!markersGroup) return;
  markersGroup.clearLayers();
  places.forEach((place) => {
    const color = place.status === "VISITED" ? "green" : "gold";
    const marker = L.circleMarker([place.lat, place.lng], {
      color,
      fillColor: color,
      fillOpacity: 0.8,
      radius: place.favorite ? 9 : 7,
    });
    marker.bindTooltip(
      `<b>${escapeForTooltip(place.name)}</b><br/>${place.favorite ? "⭐ " : ""}${place.status}`,
    );
    marker.on("click", () => onMarkerClickCallback?.(place));
    markersGroup.addLayer(marker);
  });
}

export function setDraftMarker(lat, lng, onMove, onClick) {
  if (!map) return;
  if (draftMarker) map.removeLayer(draftMarker);
  draftMoveHandler = onMove;
  draftMarker = L.marker([lat, lng], {
    draggable: true,
    autoPan: true,
    zIndexOffset: 1000,
  })
    .addTo(map)
    .bindTooltip("Drag this pin to adjust the exact location", {
      permanent: true,
      direction: "top",
      offset: [0, -12],
    })
    .openTooltip();
  draftMarker.on("dragend", () => {
    const pos = draftMarker.getLatLng();
    draftMoveHandler?.(pos.lat, pos.lng);
  });
  if (onClick)
    draftMarker.on("click", () => {
      const pos = draftMarker.getLatLng();
      onClick(pos.lat, pos.lng);
    });
}

export function updateDraftMarker(lat, lng) {
  if (draftMarker) draftMarker.setLatLng([lat, lng]);
}

export function clearDraftMarker() {
  if (draftMarker && map) map.removeLayer(draftMarker);
  draftMarker = null;
  draftMoveHandler = null;
}

export function renderRoute(route) {
  clearRoute();
  if (!route?.geometry?.coordinates || !map) return;
  const latLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  routeLayer = L.polyline(latLngs, { weight: 5, opacity: 0.85 }).addTo(map);
  map.fitBounds(routeLayer.getBounds(), { padding: [50, 50], maxZoom: 13 });
}

export function clearRoute() {
  if (routeLayer && map) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
}

export function flyToLocation(lat, lng, zoom = 14) {
  if (map) map.flyTo([lat, lng], zoom);
}

export function invalidateMapSize() {
  if (map) setTimeout(() => map.invalidateSize({ pan: false }), 50);
}

function escapeForTooltip(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

export function setMapTheme(theme) {
  if (theme === "dark") {
    if (map.hasLayer(lightMapLayer)) {
      map.removeLayer(lightMapLayer);
    }

    if (!map.hasLayer(darkMapLayer)) {
      darkMapLayer.addTo(map);
    }

    return;
  }

  if (map.hasLayer(darkMapLayer)) {
    map.removeLayer(darkMapLayer);
  }

  if (!map.hasLayer(lightMapLayer)) {
    lightMapLayer.addTo(map);
  }
}
