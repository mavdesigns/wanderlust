import { sanitizeHTML, stars, formatDateRange } from '../utils/helpers.js';

export function renderPlaceList(places, container, onClick) {
  container.innerHTML = '';
  if (!places.length) {
    container.innerHTML = `<div class="empty-state"><p>No places found under this filter.</p></div>`;
    return;
  }
  places.forEach(place => {
    const card = document.createElement('div');
    card.className = 'trip-card';
    card.innerHTML = `
      <div class="trip-card-header">
        <span class="trip-card-title">${sanitizeHTML(place.name)}</span>
        <span class="trip-card-date">${sanitizeHTML(place.visitDate || '')}</span>
      </div>
      <div class="card-meta">
        <span>${place.status === 'VISITED' ? '🟢 Visited' : '🟡 Bucket List'}</span>
        ${place.favorite ? '<span>⭐ Favorite</span>' : ''}
      </div>
      <div class="star-display" aria-label="${place.rating || 0} out of 5">${stars(place.rating)}</div>
      <p class="trip-card-notes">${sanitizeHTML(place.notes || '')}</p>`;
    card.addEventListener('click', () => onClick(place));
    container.appendChild(card);
  });
}

export function renderTripList(trips, places, container, onClick) {
  container.innerHTML = '';
  if (!trips.length) {
    container.innerHTML = `<div class="empty-state"><p>No trips yet. Create a trip first, then add places whenever you like.</p></div>`;
    return;
  }
  trips.forEach(trip => {
    const count = (trip.placeIds || []).length;
    const card = document.createElement('div');
    card.className = 'trip-card trip-summary-card';
    card.innerHTML = `
      <div class="trip-card-header">
        <span class="trip-card-title">${sanitizeHTML(trip.title)}</span>
        <span class="trip-card-date">${sanitizeHTML(formatDateRange(trip.startDate, trip.endDate))}</span>
      </div>
      <div class="star-display">${stars(trip.rating)}</div>
      <div class="card-meta"><span>${count} place${count === 1 ? '' : 's'}</span><span>📷 ${(trip.photos || []).length}</span></div>
      <p class="trip-card-notes">${sanitizeHTML(trip.notes || '')}</p>`;
    card.addEventListener('click', () => onClick(trip));
    container.appendChild(card);
  });
}

export function renderPhotoPreviews(container, photos, onRemove) {
  container.innerHTML = '';
  (photos || []).forEach((photo, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-thumb';
    wrapper.innerHTML = `<img alt="${sanitizeHTML(photo.name || 'Travel photo')}"><button type="button" class="photo-remove" aria-label="Remove photo">×</button>`;
    wrapper.querySelector('.photo-remove').addEventListener('click', () => onRemove(index));
    container.appendChild(wrapper);
    if (photo.previewUrl) wrapper.querySelector('img').src = photo.previewUrl;
  });
}
