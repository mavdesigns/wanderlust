# Wanderlust

Wanderlust is a browser-based personal travel journal for recording
places, visited locations, bucket-list destinations, favourites, trips,
ratings, notes, photographs, and map locations.

The application uses Leaflet for the interactive map,
Nominatim/OpenStreetMap services for place search and reverse geocoding,
and Google Drive for persistent application data and uploaded
photographs.

## Current scope

This README documents the functionality currently implemented in the
project.

### Place management

Wanderlust supports:

-   Searching for locations using the location search box.
-   Viewing search results on the map.
-   Adding a place from a selected/search location.
-   Selecting a location directly on the map.
-   Dragging the place pin to adjust its exact coordinates before
    saving.
-   Editing an existing place.
-   Place name and location coordinates.
-   Visited / Bucket List status.
-   Independent Favourite flag.
-   Visit date.
-   Place rating using a selectable 1--5 star interface.
-   Notes / remarks.
-   Place photographs selected from the user's device.
-   Previewing selected photographs before upload.
-   Storing photographs in Google Drive.
-   Storing photograph metadata and Drive file IDs in the application's
    structured data.
-   Viewing saved places again after reloading the application.

### Trips

The project includes the V2 Trip data model and Trip interface for
functionality that has already been implemented, including:

-   Creating and editing trips.
-   Trip name.
-   Start and end dates.
-   Trip-level rating.
-   Trip-level remarks.
-   Adding existing places to a trip.
-   Removing places from a trip.
-   Reordering places within a trip.
-   Trip photographs.
-   Route display for the places currently associated with a trip.
-   Selecting a trip and navigating the map to its associated places.
-   Compact Trip panel behaviour while route/map interaction is active.

> **Note:** Advanced Trip → Pick on Map → create/edit a new Place as
> part of the Trip workflow is intentionally not documented here because
> that workflow is still under development.

### Map

The application uses an interactive Leaflet map.

Current map functionality includes:

-   Location search and map navigation.
-   Place markers.
-   Selected-place navigation.
-   Draggable draft pins during Place creation/editing.
-   Trip route display.
-   Map resizing when the Travel Journal is hidden or shown.
-   Direct map selection for Place creation.

### Travel Journal

The Travel Journal provides filters/views for:

-   All places
-   Visited places
-   Bucket List places
-   Favourites
-   Trips

The journal can be hidden with a single control so that the map can
occupy the available screen area.

### Ratings

Ratings are stored numerically from 1 to 5 and displayed through
selectable stars rather than a dropdown.

This allows the same rating value to be used for:

-   Places
-   Trips

### Photos

Photographs are handled separately from the structured application data.

The intended storage model is:

``` text
Google Drive
├── wanderlust_data.json
└── photo files
    ├── photo-1.jpg
    ├── photo-2.jpg
    └── ...
```

The JSON stores photograph metadata and Google Drive file IDs rather
than embedding image data as Base64.

This keeps the application data file relatively small and makes photo
uploads and future changes easier to manage.

## Data model

The V2 application uses a structured data object containing separate
collections for Places and Trips.

A simplified representation is:

``` json
{
  "version": 2,
  "places": [],
  "trips": []
}
```

### Place

A Place can contain information such as:

``` json
{
  "id": "place-id",
  "name": "Example Place",
  "lat": 12.9716,
  "lng": 77.5946,
  "status": "VISITED",
  "favorite": true,
  "visitDate": "2026-08-01",
  "rating": 5,
  "notes": "Example notes",
  "photos": []
}
```

A Place exists independently of a Trip.

### Trip

A Trip can contain:

``` json
{
  "id": "trip-id",
  "title": "Example Trip",
  "startDate": "2026-08-01",
  "endDate": "2026-08-05",
  "rating": 5,
  "notes": "Example trip notes",
  "placeIds": [],
  "photos": []
}
```

The Trip stores references to Places through `placeIds`.

Removing a Place from a Trip does not delete the Place itself.

## Google Drive persistence

Google Drive is used as the persistent storage layer.

The application authenticates the user through Google authentication and
uses Drive to store application data and photographs.

The structured application data is maintained separately from image
files.

The application should not store OAuth secrets, access tokens, or other
credentials directly in source control.

## Geocoding

Wanderlust uses Nominatim for location services.

### Forward geocoding

A user can enter a location in the search box and receive location
suggestions/results.

Selecting a result moves the map to the corresponding coordinates.

### Reverse geocoding

Reverse geocoding converts map coordinates into a human-readable nearby
place/address.

It is used by the implemented Place-selection workflow to provide a
useful suggested place name when a user selects a location directly on
the map.

The user remains able to rename the place before saving.

If reverse geocoding does not return a useful result, the coordinates
can still be retained and the user can provide a name manually.

## Routing

Trips can display a route between their associated places.

The route is calculated from the ordered Place references in the Trip
rather than storing a permanent route geometry as the primary source of
truth.

This means the route can be recalculated when the Trip's places or order
changes.

## Project structure

``` text
Project Wanderlust/
│
├── index.html
│
├── js/
│   ├── app.js
│   │
│   ├── auth/
│   │   └── googleAuth.js
│   │
│   ├── services/
│   │   ├── driveService.js
│   │   └── placesService.js
│   │
│   ├── ui/
│   │   ├── mapManager.js
│   │   ├── notifications.js
│   │   └── render.js
│   │
│   ├── utils/
│   │   └── helpers.js
│   │
│   ├── config.js
│   └── state.js
│
├── styles/
│   ├── main.css
│   ├── components.css
│   └── toast.css
│
└── README.md
```

### Main responsibilities

  -----------------------------------------------------------------------
  File                                Responsibility
  ----------------------------------- -----------------------------------
  `index.html`                        Application UI structure and
                                      controls

  `js/app.js`                         Application orchestration, event
                                      handlers and workflows

  `js/state.js`                       Application state and Place/Trip
                                      data operations

  `js/services/placesService.js`      Location search, reverse geocoding
                                      and routing services

  `js/services/driveService.js`       Google Drive persistence and file
                                      operations

  `js/auth/googleAuth.js`             Google authentication

  `js/ui/mapManager.js`               Leaflet map, markers, pins and map
                                      interaction

  `js/ui/render.js`                   Rendering Place/Trip lists and
                                      details

  `js/ui/notifications.js`            Toast/notification behaviour

  `js/utils/helpers.js`               Shared utility functions

  `js/config.js`                      Application configuration

  `styles/main.css`                   Main layout and application styling

  `styles/components.css`             Component-specific styling

  `styles/toast.css`                  Notification styling
  -----------------------------------------------------------------------

## Running the application

Wanderlust is a browser application that should be served through a
local HTTP development server rather than opened directly with
`file://`.

A typical development workflow is:

``` bash
npm install
npm run dev
```

Then open the local URL printed by the development server.

If the project does not use the Vite scripts in your local copy, use the
project's configured development server instead.

## Google configuration

Google authentication and Drive access require the appropriate Google
Cloud configuration.

Keep credentials outside the source-controlled application.

Typical configuration values may include:

-   Google Client ID
-   Google API key where required
-   OAuth scopes
-   Google Drive application-data access configuration

Do not commit:

``` text
.env
*.env
client secrets
service-account private keys
access tokens
refresh tokens
```

Use a `.env.example` or equivalent template containing placeholder
values when documenting required configuration.

## Browser permissions and external services

The application depends on external services for some functionality:

-   Google authentication
-   Google Drive
-   Nominatim/OpenStreetMap geocoding
-   Routing service used by the application

Network access is therefore required for authentication, geocoding,
routing and Drive persistence.

## Development principles

The V2 implementation follows these principles:

1.  Keep Places and Trips as separate entities.
2.  Allow a Place to exist independently of a Trip.
3.  Reference Places from Trips by ID.
4.  Do not delete a Place merely because it is removed from a Trip.
5.  Keep photographs outside the main JSON data file.
6.  Store Drive file references/metadata in the structured data.
7.  Keep map state and application data state separate.
8.  Use reusable service functions for geocoding and routing.
9.  Use a reusable star-rating UI rather than rating dropdowns.
10. Preserve existing user data when the data model evolves.

## Data migration

The V2 data model is designed to support migration from the earlier
single-collection data structure.

When modifying the data schema:

-   preserve existing Place information;
-   avoid silently deleting existing records;
-   increment the data version when a breaking schema change is
    introduced;
-   migrate older records into the current `places` and `trips`
    collections before normal application operations continue.

## Current limitations / future work

The following areas are intentionally not described as completed
functionality:

-   Trip-level map selection that opens the full Place editor and
    attaches the newly created Place to the Trip in one workflow.
-   Further refinement of reverse-geocoding suggestions after a Trip map
    selection.
-   Additional route interaction improvements beyond the currently
    implemented route display.
-   Future enhancements to photo galleries, metadata and upload
    progress.

These should be treated as future development rather than assumed to be
part of the currently completed workflow.

## Development approach

When extending Wanderlust:

1.  Inspect the existing state model before changing UI behaviour.
2.  Keep Drive persistence consistent with the current data schema.
3.  Reuse existing services instead of duplicating API calls.
4.  Keep Place creation independent from Trip creation.
5.  Test map interactions after every change because modal state,
    Leaflet map sizing and map selection are interdependent.
6.  Test with an existing Drive data file before considering a
    data-model migration complete.
7.  Test both creation and editing workflows.
8.  Verify that failed photo uploads do not leave inconsistent metadata
    behind.
