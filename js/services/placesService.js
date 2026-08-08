import { CONFIG } from "../config.js";

export async function searchLocations(query) {
  const url = `${CONFIG.NOMINATIM_URL}?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  return data.map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name,
    name: item.name || item.display_name.split(",")[0],
  }));
}

export async function reverseGeocode(lat, lng) {
  const url =
    `${CONFIG.NOMINATIM_URL}/reverse` +
    `?format=jsonv2` +
    `&addressdetails=1` +
    `&zoom=18` +
    `&lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lng)}`;

  const res = await fetch(url, {
    headers: {
      "Accept-Language": "en",
    },
  });

  if (!res.ok) {
    throw new Error("Reverse geocoding request failed");
  }

  const item = await res.json();
  const address = item.address || {};

  const name =
    item.name ||
    address.amenity ||
    address.tourism ||
    address.shop ||
    address.leisure ||
    address.building ||
    address.road ||
    address.neighbourhood ||
    address.suburb ||
    address.city ||
    address.town ||
    address.village ||
    item.display_name?.split(",")[0] ||
    "Unnamed place";

  return {
    lat,
    lng,

    // Best human-readable result from Nominatim
    displayName: item.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,

    // Suggested name shown to the user
    name,

    // Keep structured address information available
    address: {
      road: address.road || "",
      neighbourhood: address.neighbourhood || "",
      suburb: address.suburb || "",
      city: address.city || address.town || address.village || "",
      state: address.state || "",
      country: address.country || "",
      postcode: address.postcode || "",
    },
  };
}

export async function searchLocation(query) {
  const results = await searchLocations(query);
  return results[0] || null;
}

export async function getRoute(places) {
  if (!places || places.length < 2)
    throw new Error("At least two places are required for a route");
  const coordinates = places.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${CONFIG.ROUTING_URL}/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing request failed");
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.[0])
    throw new Error("No route found");
  return data.routes[0];
}
