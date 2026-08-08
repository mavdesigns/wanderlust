import { CONFIG } from '../config.js';

let tokenClient = null;
let accessToken = null;

export function initGoogleAuth(onSuccessCallback, onErrorCallback) {
  if (!window.google) return;

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: (response) => {
      if (response.error) {
        console.error('OAuth Error:', response);
        if (onErrorCallback) onErrorCallback(response);
        return;
      }
      if (response && response.access_token) {
            // Save token in memory
            accessToken = response.access_token;
            
            // 1. Update status UI immediately
            updateAuthUI(true, "Connected User");

            // 2. Trigger Cloud Sync & Data Migration
            //await syncAndMigrateData();
        }
      if (onSuccessCallback) onSuccessCallback(accessToken);
    },
  });
}

export function requestAccessToken() {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

export function getAccessToken() {
  return accessToken;
}

// Function to update the Sync / Login UI State
function updateAuthUI(isConnected, userEmail = '') {
    const syncBtn = document.getElementById('auth-btn'); // or your button ID
    const statusLabel = document.getElementById('authStatusLabel'); // or your status div ID

    if (isConnected) {
        if (syncBtn) {
            syncBtn.innerText = "🟢 Connected to Google Drive";
            syncBtn.classList.add("connected-state");
        }
        if (statusLabel) {
            statusLabel.innerHTML = `<span>Logged in as: <strong>${userEmail || 'Google Account'}</strong></span>`;
        }
    } else {
        if (syncBtn) {
            syncBtn.innerText = "Sync Google Drive";
            syncBtn.classList.remove("connected-state");
        }
        if (statusLabel) {
            statusLabel.innerText = "Not Connected (Using Local Cache)";
        }
    }
}