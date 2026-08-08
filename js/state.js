/**
 * Wanderlust v2 state: places are independent entities; trips reference places.
 */
class StateManager {
  constructor() {
    this.places = [];
    this.trips = [];
    this.activeFilter = 'ALL';
    this.driveFileId = null;
    this.isAuthenticated = false;
  }

  setData(data) {
    this.places = Array.isArray(data.places) ? data.places : [];
    this.trips = Array.isArray(data.trips) ? data.trips : [];
    this.notify('state:data-updated', this.getData());
  }

  getData() {
    return { version: 2, places: this.places, trips: this.trips };
  }

  addPlace(place) {
    this.places.push(place);
    this.notify('state:data-updated', this.getData());
  }

  updatePlace(updatedPlace) {
    const index = this.places.findIndex(p => p.id === updatedPlace.id);
    if (index !== -1) {
      this.places[index] = updatedPlace;
      this.notify('state:data-updated', this.getData());
    }
  }

  deletePlace(placeId) {
    this.places = this.places.filter(p => p.id !== placeId);
    this.trips = this.trips.map(trip => ({
      ...trip,
      placeIds: (trip.placeIds || []).filter(id => id !== placeId)
    }));
    this.notify('state:data-updated', this.getData());
  }

  addTrip(trip) {
    this.trips.push(trip);
    this.notify('state:data-updated', this.getData());
  }

  updateTrip(updatedTrip) {
    const index = this.trips.findIndex(t => t.id === updatedTrip.id);
    if (index !== -1) {
      this.trips[index] = updatedTrip;
      this.notify('state:data-updated', this.getData());
    }
  }

  deleteTrip(tripId) {
    this.trips = this.trips.filter(t => t.id !== tripId);
    this.notify('state:data-updated', this.getData());
  }

  setFilter(filter) {
    this.activeFilter = filter;
    this.notify('state:filter-changed', this.activeFilter);
  }

  setAuthState(isAuthenticated, fileId = null) {
    this.isAuthenticated = isAuthenticated;
    this.driveFileId = fileId;
    this.notify('state:auth-changed', { isAuthenticated, fileId });
  }

  getFilteredPlaces() {
    if (this.activeFilter === 'ALL') return this.places;
    if (this.activeFilter === 'VISITED') return this.places.filter(p => p.status === 'VISITED');
    if (this.activeFilter === 'BUCKET_LIST') return this.places.filter(p => p.status === 'BUCKET_LIST');
    if (this.activeFilter === 'FAVORITE') return this.places.filter(p => p.favorite === true);
    return [];
  }

  notify(eventName, data) {
    document.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }
}

export const state = new StateManager();
