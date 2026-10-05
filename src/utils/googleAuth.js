// Thin wrapper around Google Identity Services (GIS) for the admin app.
//
// The backend (Code.gs) has no reliable way to know who's calling it over
// a plain fetch() - Session.getActiveUser() only works for pages Apps
// Script renders itself. Instead, the admin app signs the user in here,
// gets a Google ID token, and sends it with every admin API call; Code.gs
// verifies it server-side and checks the email against the Admins sheet.

const STORAGE_KEY = 'storaLundbyAdminIdToken';
const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export function decodeJwt(token) {
  try {
    const payloadSegment = token.split('.')[1];
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
}

export function getStoredIdToken() {
  const token = sessionStorage.getItem(STORAGE_KEY);
  if (!token) return null;

  const payload = decodeJwt(token);
  if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return token;
}

export function storeIdToken(token) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearStoredIdToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function loadGsiScript() {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    return Promise.resolve();
  }
  if (document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`)) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Kunde inte ladda Google Sign-In.'));
    document.head.appendChild(script);
  });
}

export async function initGoogleSignIn({ onCredential }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID är inte konfigurerad.');
  }

  await loadGsiScript();

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => onCredential(response.credential)
  });
}

export function renderGoogleSignInButton(element) {
  if (!element || !window.google) return;
  window.google.accounts.id.renderButton(element, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    locale: 'sv'
  });
}

export function googleSignOut() {
  clearStoredIdToken();
  if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.disableAutoSelect();
  }
}
