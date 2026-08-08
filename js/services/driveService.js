import { CONFIG } from '../config.js';
import { getAccessToken } from '../auth/googleAuth.js';

function authHeaders() {
  const token = getAccessToken();
  if (!token) throw new Error('Unauthenticated');
  return { Authorization: `Bearer ${token}` };
}

async function assertOk(res, context) {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${context}: ${res.status} ${body}`);
  }
}

export async function findAppDataFile() {
  const names = [CONFIG.DRIVE_FILE_NAME, ...(CONFIG.LEGACY_DRIVE_FILE_NAMES || [])];
  const nameQuery = names.map(name => `name = '${name}'`).join(' or ');
  const query = encodeURIComponent(`(${nameQuery}) and 'appDataFolder' in parents and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&orderBy=createdTime&fields=files(id,name,createdTime)`, {
    headers: authHeaders()
  });
  await assertOk(res, 'Find app data file');
  const data = await res.json();
  const current = data.files?.find(file => file.name === CONFIG.DRIVE_FILE_NAME);
  return current?.id || data.files?.[0]?.id || null;
}

export async function loadDataFromDrive(fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: authHeaders()
  });
  await assertOk(res, 'Load app data');
  return res.json();
}

export async function saveDataToDrive(fileId, data) {
  const metadata = {
    name: CONFIG.DRIVE_FILE_NAME,
    mimeType: 'application/json',
    ...(fileId ? {} : { parents: ['appDataFolder'] })
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name';

  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: authHeaders(),
    body: form
  });
  await assertOk(res, 'Save app data');
  return res.json();
}

export async function uploadPhoto(file) {
  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    parents: ['appDataFolder']
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file, file.name);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size', {
    method: 'POST',
    headers: authHeaders(),
    body: form
  });
  await assertOk(res, `Upload photo ${file.name}`);
  return res.json();
}

export async function deleteDriveFile(fileId) {
  if (!fileId) return;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!res.ok && res.status !== 404) await assertOk(res, 'Delete Drive file');
}

export async function downloadPhotoBlob(fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: authHeaders()
  });
  await assertOk(res, 'Load photo');
  return res.blob();
}
