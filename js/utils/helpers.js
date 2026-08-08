export function sanitizeHTML(str = '') {
  const temp = document.createElement('div');
  temp.textContent = String(str);
  return temp.innerHTML;
}

export function generateUUID() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + '-' + Date.now();
}

export function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '';
  if (startDate && endDate && startDate !== endDate) return `${startDate} – ${endDate}`;
  return startDate || endDate || '';
}

export function stars(rating = 0) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return '★'.repeat(value) + '☆'.repeat(5 - value);
}

export function migrateToV2(raw) {
  if (raw?.version === 2 && Array.isArray(raw.places) && Array.isArray(raw.trips)) return raw;

  const legacy = Array.isArray(raw?.trips) ? raw.trips : [];
  const places = legacy.map(item => ({
    id: item.id || generateUUID(),
    name: item.title || 'Untitled place',
    displayName: item.title || '',
    lat: Number(item.lat),
    lng: Number(item.lng),
    status: item.status === 'BUCKET_LIST' ? 'BUCKET_LIST' : 'VISITED',
    favorite: item.status === 'FAVORITE' || item.favorite === true,
    visitDate: item.date || '',
    rating: Number(item.rating) || 0,
    notes: item.notes || '',
    photos: Array.isArray(item.photos) ? item.photos : [],
    tripIds: []
  }));

  return { version: 2, places, trips: [] };
}
