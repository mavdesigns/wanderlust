import { state } from "./state.js";
import { initGoogleAuth, requestAccessToken } from "./auth/googleAuth.js";
import {
  findAppDataFile,
  loadDataFromDrive,
  saveDataToDrive,
  uploadPhoto,
  deleteDriveFile,
  downloadPhotoBlob,
} from "./services/driveService.js";
import {
  searchLocations,
  reverseGeocode,
  getRoute,
} from "./services/placesService.js";
import {
  initMap,
  renderMarkers,
  renderRoute,
  clearRoute,
  flyToLocation,
  setDraftMarker,
  updateDraftMarker,
  clearDraftMarker,
  invalidateMapSize,
} from "./ui/mapManager.js";
import {
  renderPlaceList,
  renderTripList,
  renderPhotoPreviews,
} from "./ui/render.js";
import { showToast } from "./ui/notifications.js";
import { generateUUID, migrateToV2, stars } from "./utils/helpers.js";

const photoDrafts = { place: [], trip: [] };
const removedPhotos = { place: [], trip: [] };
let placeRating = 0;
let tripRating = 0;
let searchTimer = null;
let pendingTripNewPlaceIds = [];
let tripMapPickMode = false;
let journalVisible = true;
let routeVisible = false;

const $ = (id) => document.getElementById(id);

window.addEventListener("DOMContentLoaded", () => {
  const list = $("trip-list");
  initMap("map", (lat, lng) => handleMapClick(lat, lng));

  initGoogleAuth(
    async () => {
      showToast("Authenticated with Google Drive!", "success");
      await syncWithDrive();
    },
    () => showToast("Google authentication failed.", "error"),
  );

  $("auth-btn").addEventListener("click", () => requestAccessToken());
  document.querySelectorAll(".filter-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.setFilter(btn.dataset.filter);
      clearRoute();
    }),
  );

  $("create-trip-btn").addEventListener("click", () => openTripEditor());
  $("journal-toggle-btn").addEventListener("click", toggleJournal);
  $("trip-pick-map-btn").addEventListener("click", activateTripMapPickMode);
  $("trip-map-done-btn").addEventListener("click", finishTripMapPickMode);
  bindCloseButtons();
  document.querySelectorAll(".expand-modal-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const modal = $(btn.dataset.expand);
      setModalExpanded(
        btn.dataset.expand,
        !modal.classList.contains("expanded-mode"),
      );
    }),
  );
  document.querySelectorAll(".modal-header").forEach((header) =>
    header.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const modal = header.closest(".modal-backdrop");
      if (modal?.classList.contains("compact-mode"))
        setModalExpanded(modal.id, true);
    }),
  );
  bindStarPicker("place-rating", (value) => {
    placeRating = value;
  });
  bindStarPicker("trip-rating", (value) => {
    tripRating = value;
  });

  $("place-form").addEventListener("submit", savePlace);
  $("trip-form").addEventListener("submit", saveTrip);
  $("place-delete-btn").addEventListener("click", deleteCurrentPlace);
  $("trip-delete-btn").addEventListener("click", deleteCurrentTrip);
  $("add-existing-place-btn").addEventListener("click", addExistingPlaceToTrip);
  $("add-new-trip-place-btn").addEventListener(
    "click",
    searchAndAddNewPlaceToTrip,
  );
  $("new-trip-place-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchAndAddNewPlaceToTrip();
    }
  });
  $("show-route-btn").addEventListener("click", showCurrentTripRoute);

  bindPhotoInput("place-photo-input", "place-photo-dropzone", "place");
  bindPhotoInput("trip-photo-input", "trip-photo-dropzone", "trip");

  $("location-search-btn").addEventListener("click", () =>
    performLocationSearch(true),
  );
  $("location-search-input").addEventListener("input", () => {
    clearTimeout(searchTimer);
    const query = $("location-search-input").value.trim();
    if (query.length < 3)
      return $("search-suggestions").classList.add("hidden");
    searchTimer = setTimeout(() => performLocationSearch(false), 350);
  });
  $("location-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") performLocationSearch(true);
  });

  document.addEventListener("state:data-updated", updateView);
  document.addEventListener("state:filter-changed", updateView);
  updateView();
});

function bindCloseButtons() {
  document
    .querySelectorAll("[data-close]")
    .forEach((btn) =>
      btn.addEventListener("click", () => closeModal($(btn.dataset.close))),
    );
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) =>
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    }),
  );
}

function handleMapClick(lat, lng) {
  if (tripMapPickMode) {
    addMapPlaceToCurrentTrip(lat, lng);
    return;
  }
  openNewPlace(lat, lng);
}

function toggleJournal() {
  journalVisible = !journalVisible;
  $("sidebar").classList.toggle("journal-hidden", !journalVisible);
  $("journal-toggle-btn").textContent = journalVisible
    ? "🗂️ Hide Journal"
    : "🗺️ Show Journal";
  invalidateMapSize();
}

function closeModal(modal) {
  if (modal?.id === "trip-modal" && pendingTripNewPlaceIds.length) {
    const currentTripId = $("trip-id").value;
    const savedPlaceIds =
      state.trips.find((t) => t.id === currentTripId)?.placeIds || [];
    state.places = state.places.filter(
      (p) =>
        !pendingTripNewPlaceIds.includes(p.id) || savedPlaceIds.includes(p.id),
    );
    pendingTripNewPlaceIds = [];
  }
  modal.classList.add("hidden");
  modal.classList.remove("map-docked", "route-mode");
  // , "expanded-mode");
  // modal.classList.add("compact-mode");
  setModalExpanded(modal.id, false);
  modal.parentElement?.classList.remove("map-pick-active", "route-active");
  if (modal.id === "trip-modal") {
    tripMapPickMode = false;
    $("trip-map-pick-hint").classList.add("hidden");
    $("trip-map-done-btn").classList.add("hidden");
  }
  clearDraftMarker();
  clearRoute();
  routeVisible = false;
  invalidateMapSize();
}

function setModalExpanded(modalId, expanded) {
  const modal = $(modalId);
  if (!modal) return;
  modal.classList.toggle("compact-mode", !expanded);
  modal.classList.toggle("expanded-mode", expanded);
  const button = modal.querySelector(".expand-modal-btn");
  if (button) button.textContent = expanded ? "Minimize" : "Expand";
  invalidateMapSize();
}

function updateView() {
  const filter = state.activeFilter;
  if (filter === "TRIPS") {
    renderTripList(state.trips, state.places, $("trip-list"), (trip) => {
      focusTripOnMap(trip);
      openTripEditor(trip);
    });
    renderMarkers(state.places, (place) => openPlaceEditor(place));
  } else {
    const places = state.getFilteredPlaces();
    renderPlaceList(places, $("trip-list"), (place) => {
      flyToLocation(place.lat, place.lng);
      openPlaceEditor(place);
    });
    renderMarkers(places, (place) => openPlaceEditor(place));
  }
}

async function syncWithDrive() {
  try {
    let fileId = await findAppDataFile();
    if (!fileId) {
      const created = await saveDataToDrive(null, {
        version: 2,
        places: [],
        trips: [],
      });
      fileId = created.id;
      state.setData({ version: 2, places: [], trips: [] });
    } else {
      const raw = await loadDataFromDrive(fileId);
      const migrated = migrateToV2(raw);
      state.setData(migrated);
      if (raw?.version !== 2) await saveDataToDrive(fileId, migrated);
    }
    state.setAuthState(true, fileId);
    updateView();
  } catch (err) {
    console.error(err);
    showToast(`Drive sync error: ${err.message}`, "error");
  }
}

async function persistToDrive(extraCleanup = []) {
  if (!state.isAuthenticated || !state.driveFileId) return;
  try {
    await saveDataToDrive(state.driveFileId, state.getData());
    for (const fileId of extraCleanup) await deleteDriveFile(fileId);
    showToast("Saved to Google Drive!", "success");
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function openNewPlace(lat, lng, defaultTitle = "") {
  resetPlaceDraft();
  $("place-id").value = "";
  $("place-lat").value = lat;
  $("place-lng").value = lng;
  updatePlaceCoordinatesLabel(lat, lng);
  $("place-name").value = defaultTitle;
  $("place-status").value = "VISITED";
  $("place-favorite").checked = false;
  $("place-date").value = "";
  $("place-notes").value = "";
  placeRating = 0;
  setStarPicker("place-rating", 0);
  $("place-modal-title").textContent = "Add Place";
  $("place-delete-btn").classList.add("hidden");
  renderPhotoPreviews(
    $("place-photo-gallery"),
    photoDrafts.place,
    removePlacePhotoDraft,
  );
  setDraftMarker(lat, lng, async (newLat, newLng) => {
    $("place-lat").value = newLat;
    $("place-lng").value = newLng;
    updatePlaceCoordinatesLabel(newLat, newLng);

    const nameInput = $("place-name");
    const currentName = nameInput.value.trim();
    const geocodedName = nameInput.dataset.geocodedName || "";

    // Don't overwrite a name the user has deliberately changed.
    if (currentName && currentName !== geocodedName) {
      return;
    }

    try {
      const result = await reverseGeocode(newLat, newLng);

      const suggestedName = result.name || result.displayName || "";

      if (suggestedName) {
        nameInput.value = suggestedName;
        nameInput.dataset.geocodedName = suggestedName;
      }
    } catch (err) {
      console.warn("Reverse geocoding after moving place pin failed:", err);
    }
  });
  $("place-modal").classList.remove("hidden");
  setModalExpanded("place-modal", false);
  flyToLocation(lat, lng);
  invalidateMapSize();
  if (!defaultTitle) suggestPlaceName(lat, lng);
}

async function suggestPlaceName(lat, lng) {
  try {
    const result = await reverseGeocode(lat, lng);

    const currentLat = Number($("place-lat").value);
    const currentLng = Number($("place-lng").value);

    // Only apply the suggestion if the pin has not moved
    // while the reverse-geocoding request was running.
    const sameLocation =
      Math.abs(currentLat - lat) < 0.00001 &&
      Math.abs(currentLng - lng) < 0.00001;

    if (!sameLocation) return;

    const name = result.name || result.displayName || "";

    if (!$("place-name").value.trim() && name) {
      $("place-name").value = name;

      // Mark this as a geocoded suggestion, not a user-entered name.
      $("place-name").dataset.geocodedName = name;
    }
  } catch (err) {
    console.warn("Could not suggest place name:", err);
  }
}

function openPlaceEditor(place) {
  resetPlaceDraft();
  $("place-id").value = place.id;
  $("place-lat").value = place.lat;
  $("place-lng").value = place.lng;
  updatePlaceCoordinatesLabel(place.lat, place.lng);
  $("place-name").value = place.name || "";
  $("place-status").value = place.status || "VISITED";
  $("place-favorite").checked = !!place.favorite;
  $("place-date").value = place.visitDate || "";
  $("place-notes").value = place.notes || "";
  placeRating = Number(place.rating) || 0;
  setStarPicker("place-rating", placeRating);
  photoDrafts.place = (place.photos || []).map((p) => ({
    ...p,
    existing: true,
  }));
  $("place-modal-title").textContent = "Edit Place";
  $("place-delete-btn").classList.remove("hidden");
  renderPhotoPreviews(
    $("place-photo-gallery"),
    photoDrafts.place,
    removePlacePhotoDraft,
  );
  hydratePhotoPreviews($("place-photo-gallery"), photoDrafts.place);
  setDraftMarker(place.lat, place.lng, (newLat, newLng) => {
    $("place-lat").value = newLat;
    $("place-lng").value = newLng;
    updatePlaceCoordinatesLabel(newLat, newLng);
  });
  $("place-modal").classList.remove("hidden");
  setModalExpanded("place-modal", false);
  flyToLocation(place.lat, place.lng);
  invalidateMapSize();
}

function updatePlaceCoordinatesLabel(lat, lng) {
  $("place-coordinates").textContent =
    `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

async function savePlace(e) {
  e.preventDefault();
  const id = $("place-id").value || generateUUID();
  const existing = state.places.find((p) => p.id === id);
  const place = {
    id,
    name: $("place-name").value.trim(),
    displayName: $("place-name").value.trim(),
    lat: Number($("place-lat").value),
    lng: Number($("place-lng").value),
    status: $("place-status").value,
    favorite: $("place-favorite").checked,
    visitDate: $("place-date").value,
    rating: placeRating,
    notes: $("place-notes").value.trim(),
    photos: [],
    tripIds: existing?.tripIds || [],
  };

  const newlyUploaded = [];
  try {
    place.photos = [];
    for (const photo of photoDrafts.place) {
      if (photo.existing) place.photos.push(stripPhotoPreview(photo));
      else {
        const uploaded = await uploadPhoto(photo.file);
        const meta = {
          id: generateUUID(),
          fileId: uploaded.id,
          name: uploaded.name,
          mimeType: uploaded.mimeType || photo.file.type,
          size: uploaded.size || photo.file.size,
        };
        place.photos.push(meta);
        newlyUploaded.push(uploaded.id);
      }
    }
    if (existing) state.updatePlace(place);
    else state.addPlace(place);
    await persistToDrive(removedPhotos.place.map((p) => p.fileId));
    resetPlaceDraft();
    closeModal($("place-modal"));
  } catch (err) {
    for (const fileId of newlyUploaded) {
      try {
        await deleteDriveFile(fileId);
      } catch {}
    }
    showToast(`Could not save place: ${err.message}`, "error");
  }
}

async function deleteCurrentPlace() {
  const id = $("place-id").value;
  if (
    !id ||
    !confirm(
      "Delete this place? It will also be removed from any trips, but other trip records will remain.",
    )
  )
    return;
  const place = state.places.find((p) => p.id === id);
  state.deletePlace(id);
  try {
    await persistToDrive((place?.photos || []).map((p) => p.fileId));
    closeModal($("place-modal"));
  } catch (err) {
    showToast(`Could not delete place: ${err.message}`, "error");
  }
}

function openTripEditor(trip = null) {
  resetTripDraft();
  $("trip-id").value = trip?.id || "";
  $("trip-title").value = trip?.title || "";
  $("trip-start-date").value = trip?.startDate || "";
  $("trip-end-date").value = trip?.endDate || "";
  $("trip-notes").value = trip?.notes || "";
  tripRating = Number(trip?.rating) || 0;
  setStarPicker("trip-rating", tripRating);
  photoDrafts.trip = (trip?.photos || []).map((p) => ({
    ...p,
    existing: true,
  }));
  pendingTripNewPlaceIds = [];
  $("trip-modal-title").textContent = trip ? "Edit Trip" : "Create Trip";
  $("trip-delete-btn").classList.toggle("hidden", !trip);
  $("show-route-btn").disabled = !(trip && (trip.placeIds || []).length >= 2);
  $("route-summary").textContent = trip
    ? `${(trip.placeIds || []).length} place${(trip.placeIds || []).length === 1 ? "" : "s"}`
    : "Save the trip first to build its route.";
  renderTripPlaceEditor(trip?.placeIds || []);
  renderPhotoPreviews(
    $("trip-photo-gallery"),
    photoDrafts.trip,
    removeTripPhotoDraft,
  );
  if (trip) hydratePhotoPreviews($("trip-photo-gallery"), photoDrafts.trip);
  refreshExistingPlaceSelect(trip?.placeIds || []);
  $("trip-modal").classList.remove("hidden");
  $("trip-modal").classList.remove("map-docked", "route-mode");
  // , "expanded-mode");
  // $("trip-modal").classList.add("compact-mode");
  setModalExpanded("trip-modal", false);
  if (trip) focusTripOnMap(trip);
  invalidateMapSize();
}

async function saveTrip(e) {
  e.preventDefault();
  const id = $("trip-id").value || generateUUID();
  const existing = state.trips.find((t) => t.id === id);
  const placeIds = getTripPlaceIdsFromEditor();
  const trip = {
    id,
    title: $("trip-title").value.trim(),
    startDate: $("trip-start-date").value,
    endDate: $("trip-end-date").value,
    rating: tripRating,
    notes: $("trip-notes").value.trim(),
    placeIds,
    photos: [],
  };
  const newlyUploaded = [];
  try {
    for (const photo of photoDrafts.trip) {
      if (photo.existing) trip.photos.push(stripPhotoPreview(photo));
      else {
        const uploaded = await uploadPhoto(photo.file);
        const meta = {
          id: generateUUID(),
          fileId: uploaded.id,
          name: uploaded.name,
          mimeType: uploaded.mimeType || photo.file.type,
          size: uploaded.size || photo.file.size,
        };
        trip.photos.push(meta);
        newlyUploaded.push(uploaded.id);
      }
    }

    // Maintain the inverse place -> trip relationship.
    const oldIds = existing?.placeIds || [];
    state.places = state.places.map((place) => {
      let tripIds = Array.isArray(place.tripIds) ? [...place.tripIds] : [];
      if (oldIds.includes(place.id) && !placeIds.includes(place.id))
        tripIds = tripIds.filter((tid) => tid !== id);
      if (placeIds.includes(place.id) && !tripIds.includes(id))
        tripIds.push(id);
      return { ...place, tripIds };
    });
    if (existing) state.updateTrip(trip);
    else state.addTrip(trip);
    await persistToDrive(removedPhotos.trip.map((p) => p.fileId));
    pendingTripNewPlaceIds = [];
    resetTripDraft();
    closeModal($("trip-modal"));
  } catch (err) {
    for (const fileId of newlyUploaded) {
      try {
        await deleteDriveFile(fileId);
      } catch {}
    }
    state.places = state.places.filter(
      (p) => !pendingTripNewPlaceIds.includes(p.id),
    );
    pendingTripNewPlaceIds = [];
    showToast(`Could not save trip: ${err.message}`, "error");
  }
}

async function deleteCurrentTrip() {
  const id = $("trip-id").value;
  if (
    !id ||
    !confirm(
      "Delete this trip? Its places and place photos will not be deleted.",
    )
  )
    return;
  const trip = state.trips.find((t) => t.id === id);
  state.deleteTrip(id);
  state.places = state.places.map((place) => ({
    ...place,
    tripIds: (place.tripIds || []).filter((tid) => tid !== id),
  }));
  try {
    await persistToDrive((trip?.photos || []).map((p) => p.fileId));
    closeModal($("trip-modal"));
  } catch (err) {
    showToast(`Could not delete trip: ${err.message}`, "error");
  }
}

function focusTripOnMap(trip) {
  const firstId = (trip?.placeIds || [])[0];
  const place = state.places.find((p) => p.id === firstId);
  if (place) flyToLocation(place.lat, place.lng);
}

function renderTripPlaceEditor(placeIds) {
  const container = $("trip-place-list");
  container.innerHTML = "";
  placeIds.forEach((id, index) => {
    const place = state.places.find((p) => p.id === id);
    if (!place) return;
    const row = document.createElement("div");
    row.className = "trip-place-row";
    row.innerHTML = `<span class="place-order">${index + 1}</span><span class="place-row-name">${escapeText(place.name)}</span><button type="button" data-up title="Move up">↑</button><button type="button" data-down title="Move down">↓</button><button type="button" data-remove title="Remove from trip">×</button>`;
    row.querySelector("[data-up]").disabled = index === 0;
    row.querySelector("[data-down]").disabled = index === placeIds.length - 1;
    row
      .querySelector("[data-up]")
      .addEventListener("click", () => moveTripPlace(index, -1));
    row
      .querySelector("[data-down]")
      .addEventListener("click", () => moveTripPlace(index, 1));
    row
      .querySelector("[data-remove]")
      .addEventListener("click", () => removeTripPlace(index));
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      flyToLocation(place.lat, place.lng);
    });
    row.dataset.placeId = id;
    container.appendChild(row);
  });
}

function getTripPlaceIdsFromEditor() {
  return [...document.querySelectorAll("#trip-place-list .trip-place-row")]
    .map((row) => row.dataset.placeId)
    .filter(Boolean);
}

const originalRenderTripPlaceEditor = renderTripPlaceEditor;

function moveTripPlace(index, delta) {
  const ids = getTripPlaceIdsFromEditor();
  const target = index + delta;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  originalRenderTripPlaceEditor(ids);
  [...document.querySelectorAll("#trip-place-list .trip-place-row")].forEach(
    (row, i) => {
      row.dataset.placeId = ids[i];
    },
  );
  $("show-route-btn").disabled = ids.length < 2;
  $("route-summary").textContent =
    `${ids.length} place${ids.length === 1 ? "" : "s"}`;
}

function removeTripPlace(index) {
  const ids = getTripPlaceIdsFromEditor();
  ids.splice(index, 1);
  originalRenderTripPlaceEditor(ids);
  [...document.querySelectorAll("#trip-place-list .trip-place-row")].forEach(
    (row, i) => {
      row.dataset.placeId = ids[i];
    },
  );
  refreshExistingPlaceSelect(ids);
  $("show-route-btn").disabled = ids.length < 2;
  $("route-summary").textContent =
    `${ids.length} place${ids.length === 1 ? "" : "s"}`;
}

function addExistingPlaceToTrip() {
  const id = $("existing-place-select").value;
  if (!id) return;
  const ids = getTripPlaceIdsFromEditor();
  if (!ids.includes(id)) ids.push(id);
  originalRenderTripPlaceEditor(ids);
  [...document.querySelectorAll("#trip-place-list .trip-place-row")].forEach(
    (row, i) => {
      row.dataset.placeId = ids[i];
    },
  );
  refreshExistingPlaceSelect(ids);
  $("show-route-btn").disabled = ids.length < 2;
  $("route-summary").textContent =
    `${ids.length} place${ids.length === 1 ? "" : "s"}`;
}

async function searchAndAddNewPlaceToTrip() {
  const query = $("new-trip-place-input").value.trim();
  if (!query) return;
  try {
    const results = await searchLocations(query);
    renderInlineSuggestions(results);
    if (results[0]) flyToLocation(results[0].lat, results[0].lng);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderInlineSuggestions(results) {
  const box = $("trip-place-suggestions");
  box.innerHTML = "";
  results.forEach((result) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = result.displayName;
    btn.addEventListener("click", () => addNewPlaceResultToTrip(result));
    box.appendChild(btn);
  });
  box.classList.toggle("hidden", results.length === 0);
}

function addNewPlaceResultToTrip(result) {
  const place = {
    id: generateUUID(),
    name: result.name || result.displayName.split(",")[0],
    displayName: result.displayName,
    lat: result.lat,
    lng: result.lng,
    status: "VISITED",
    favorite: false,
    visitDate: "",
    rating: 0,
    notes: "",
    photos: [],
    tripIds: [],
  };
  state.places.push(place);
  renderMarkers(state.places, (p) => openPlaceEditor(p));
  pendingTripNewPlaceIds.push(place.id);
  const ids = getTripPlaceIdsFromEditor();
  ids.push(place.id);
  originalRenderTripPlaceEditor(ids);
  [...document.querySelectorAll("#trip-place-list .trip-place-row")].forEach(
    (row, i) => {
      row.dataset.placeId = ids[i];
    },
  );
  refreshExistingPlaceSelect(ids);
  $("trip-place-suggestions").classList.add("hidden");
  $("new-trip-place-input").value = "";
  $("show-route-btn").disabled = ids.length < 2;
  $("route-summary").textContent =
    `${ids.length} place${ids.length === 1 ? "" : "s"}`;
}

function refreshExistingPlaceSelect(selectedIds = []) {
  const select = $("existing-place-select");
  select.innerHTML = '<option value="">Add an existing place…</option>';
  state.places
    .filter((p) => !selectedIds.includes(p.id))
    .forEach((place) => {
      const option = document.createElement("option");
      option.value = place.id;
      option.textContent = place.name;
      select.appendChild(option);
    });
}

function activateTripMapPickMode() {
  // Pick-on-map should always start with the Trip panel minimized
  setModalExpanded("trip-modal", false);

  tripMapPickMode = true;
  $("trip-modal").classList.add("map-docked");
  $("trip-modal").parentElement.classList.add("map-pick-active");
  $("trip-map-pick-hint").classList.remove("hidden");
  $("trip-map-done-btn").classList.remove("hidden");
  showToast(
    "Click anywhere on the map to add that location to this trip.",
    "info",
  );
  invalidateMapSize();
}

function finishTripMapPickMode() {
  tripMapPickMode = false;
  $("trip-map-pick-hint").classList.add("hidden");
  $("trip-map-done-btn").classList.add("hidden");
  $("trip-modal").classList.remove("map-docked");
  $("trip-modal").parentElement.classList.remove("map-pick-active");
  invalidateMapSize();
}

async function addMapPlaceToCurrentTrip(lat, lng) {
  try {
    const result = await reverseGeocode(lat, lng);

    const place = {
      ...result,
      id: generateUUID(),
      status: "VISITED",
      favorite: false,
      visitDate: "",
      rating: 0,
      notes: "",
      photos: [],
      tripIds: [],
    };

    addNewPlaceResultToTrip(place);
    flyToLocation(lat, lng);
    showToast(
      'Added "${place.name}" to this trip. You can rename and edit it later.',
      "success",
    );
  } catch (err) {
    const fallback = {
      id: generateUUID(),
      lat,
      lng,
      name: "Unnamed place",
      displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      status: "VISITED",
      favorite: false,
      visitDate: "",
      rating: 0,
      notes: "",
      photos: [],
      tripIds: [],
    };
    addNewPlaceResultToTrip(fallback);
    flyToLocation(lat, lng);
    showToast("Location added. Rename it in the trip if needed.", "info");
  }
}

async function showCurrentTripRoute() {
  setModalExpanded("trip-modal", false);
  const ids = getTripPlaceIdsFromEditor();
  if (ids.length < 2)
    return showToast("Add at least two places to build a route.", "info");
  try {
    const route = await getRoute(
      ids.map((id) => state.places.find((p) => p.id === id)).filter(Boolean),
    );
    renderRoute(route);
    routeVisible = true;
    $("trip-modal").classList.add("route-mode");
    $("trip-modal").parentElement.classList.add("route-active");
    $("route-summary").textContent =
      `${(route.distance / 1000).toFixed(1)} km • ${(route.duration / 3600).toFixed(1)} hr estimated driving`;
  } catch (err) {
    showToast(`Route unavailable: ${err.message}`, "error");
  }
}

async function performLocationSearch(showSuggestions = true) {
  const query = $("location-search-input").value.trim();
  if (!query) return;
  try {
    const results = await searchLocations(query);
    const box = $("search-suggestions");
    box.innerHTML = "";
    results.forEach((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = result.displayName;
      button.addEventListener("click", () => {
        box.classList.add("hidden");
        focusSearchResult(result);
      });
      box.appendChild(button);
    });
    box.classList.toggle("hidden", !showSuggestions || results.length === 0);
    if (results[0]) focusSearchResult(results[0]);
    if (!results.length) showToast("Location not found", "error");
  } catch (err) {
    showToast(`Search failed: ${err.message}`, "error");
  }
}

function focusSearchResult(result) {
  flyToLocation(result.lat, result.lng);
  setDraftMarker(
    result.lat,
    result.lng,
    (lat, lng) => {
      // Keep the search marker draggable without opening the editor.
      flyToLocation(lat, lng);
    },
    (lat, lng) => {
      openNewPlace(
        lat,
        lng,
        result.name || result.displayName?.split(",")[0] || "",
      );
    },
  );
}

function bindPhotoInput(inputId, dropzoneId, kind) {
  const input = $(inputId);
  const zone = $(dropzoneId);
  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => addPhotoFiles(kind, [...input.files]));
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    addPhotoFiles(
      kind,
      [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")),
    );
  });
}

function addPhotoFiles(kind, files) {
  files.forEach((file) => {
    photoDrafts[kind].push({
      id: generateUUID(),
      name: file.name,
      mimeType: file.type,
      size: file.size,
      file,
      previewUrl: URL.createObjectURL(file),
      existing: false,
    });
  });
  const gallery = $(
    kind === "place" ? "place-photo-gallery" : "trip-photo-gallery",
  );
  renderPhotoPreviews(
    gallery,
    photoDrafts[kind],
    kind === "place" ? removePlacePhotoDraft : removeTripPhotoDraft,
  );
}

function removePlacePhotoDraft(index) {
  removePhotoDraft("place", index);
}
function removeTripPhotoDraft(index) {
  removePhotoDraft("trip", index);
}
function removePhotoDraft(kind, index) {
  const photo = photoDrafts[kind][index];
  if (photo?.existing && photo.fileId) removedPhotos[kind].push(photo);
  if (photo?.previewUrl && !photo.existing)
    URL.revokeObjectURL(photo.previewUrl);
  photoDrafts[kind].splice(index, 1);
  const gallery = $(
    kind === "place" ? "place-photo-gallery" : "trip-photo-gallery",
  );
  renderPhotoPreviews(
    gallery,
    photoDrafts[kind],
    kind === "place" ? removePlacePhotoDraft : removeTripPhotoDraft,
  );
}

function hydratePhotoPreviews(gallery, photos) {
  photos.forEach(async (photo) => {
    if (
      !photo.existing ||
      photo.previewUrl ||
      !photo.fileId ||
      !state.isAuthenticated
    )
      return;
    try {
      const blob = await downloadPhotoBlob(photo.fileId);
      photo.previewUrl = URL.createObjectURL(blob);
      renderPhotoPreviews(
        gallery,
        photos,
        photos === photoDrafts.place
          ? removePlacePhotoDraft
          : removeTripPhotoDraft,
      );
    } catch (err) {
      console.warn("Could not load photo", photo.fileId, err);
    }
  });
}

function stripPhotoPreview(photo) {
  return {
    id: photo.id || generateUUID(),
    fileId: photo.fileId,
    name: photo.name,
    mimeType: photo.mimeType,
    size: photo.size,
  };
}

function resetPlaceDraft() {
  photoDrafts.place.forEach((p) => {
    if (!p.existing && p.previewUrl) URL.revokeObjectURL(p.previewUrl);
  });
  photoDrafts.place = [];
  removedPhotos.place = [];
  $("place-photo-input").value = "";
}

function resetTripDraft() {
  photoDrafts.trip.forEach((p) => {
    if (!p.existing && p.previewUrl) URL.revokeObjectURL(p.previewUrl);
  });
  photoDrafts.trip = [];
  removedPhotos.trip = [];
  $("trip-photo-input").value = "";
  $("trip-place-suggestions").classList.add("hidden");
}

function bindStarPicker(id, callback) {
  const container = $(id);
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "star-btn";
    button.textContent = "☆";
    button.dataset.value = i;
    button.addEventListener("mouseenter", () => previewStars(id, i));
    button.addEventListener("mouseleave", () =>
      previewStars(id, id === "place-rating" ? placeRating : tripRating),
    );
    button.addEventListener("click", () => {
      callback(i);
      setStarPicker(id, i);
    });
    container.appendChild(button);
  }
}

function previewStars(id, value) {
  [...$(id).querySelectorAll(".star-btn")].forEach(
    (btn, i) => (btn.textContent = i < value ? "★" : "☆"),
  );
}
function setStarPicker(id, value) {
  previewStars(id, value);
}

function escapeText(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}
