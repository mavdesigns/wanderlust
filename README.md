# 🗺️ Project Wanderlust v2

Wanderlust v2 is a browser-based travel journal that stores structured travel data and photographs in the user's Google Drive `appDataFolder`.

## What changed in v2

- **Places and Trips are separate entities.** A place can exist without a trip, and a trip can be created before any places are added.
- **Trips can contain zero or many places.** Places can be added, removed, and reordered later.
- **Trip-level metadata:** name, start/end date, overall rating, remarks, and trip photographs.
- **Place-level metadata:** status, favorite flag, visit date, rating, notes, coordinates, and photographs.
- **Google-style star ratings:** ratings are selected directly with clickable stars instead of a dropdown.
- **Device photo picker:** one or many images can be selected from the device, previewed, removed, and uploaded to Google Drive when saved.
- **Drive photo storage:** photographs are separate Drive files; the JSON stores only file IDs and metadata.
- **Dynamic routes:** a trip's ordered places can be sent to OSRM to draw a driving route on the map. Route geometry is not persisted because it can become stale.
- **Search suggestions:** Nominatim results are shown as selectable suggestions.
- **v1 migration:** an old `wanderlust_trips.json` payload containing `trips[]` is migrated into v2 `places[]` automatically when encountered in the configured data file.

## Data layout

The app uses one JSON metadata file:

```text
wanderlust_data.json
  ├── places[]
  └── trips[]
```

Photographs are separate files in the same Drive `appDataFolder`. A photo reference looks like:

```json
{
  "id": "photo-id",
  "fileId": "google-drive-file-id",
  "name": "paris.jpg",
  "mimeType": "image/jpeg",
  "size": 123456
}
```

Keeping images outside the JSON avoids large Base64 payloads, repeated uploads, and fragile full-file writes.

## Architecture

```text
index.html
styles/
  main.css
  components.css
  toast.css
js/
  app.js
  config.js
  state.js
  auth/googleAuth.js
  services/
    driveService.js
    placesService.js
  ui/
    mapManager.js
    render.js
    notifications.js
  utils/helpers.js
```

## Google Drive setup

1. Create/configure a Google Cloud OAuth 2.0 Web application client.
2. Put the client ID in `js/config.js` or move it to your environment/configuration mechanism if your host provides one.
3. The required OAuth scope is:

```text
https://www.googleapis.com/auth/drive.appdata
```

The application stores its metadata and photos in the hidden Drive `appDataFolder` rather than the user's normal Drive root.

## Running locally

Serve the project from a local HTTP server. Do **not** open `index.html` with `file://`, because ES modules, OAuth, and browser security policies require an HTTP origin.

For example, from the project directory:

```bash
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

VS Code Live Server or another static HTTP server can also be used.

## Important external services

- Google Identity Services / Google Drive API for authentication and persistence.
- OpenStreetMap Nominatim for geocoding/search.
- OSRM public routing service for route calculation.
- Leaflet + CARTO tiles for the map.

For production use, review the terms/rate limits of Nominatim and the public OSRM instance and consider a dedicated provider if usage grows.
