/**
 * API Wrapper Utility
 * Provides global apiCall function for all modules
 */

const DASHBOARD_EDIT_PASSWORD_KEY = 'dashboardEditPassword';

function isProtectedDashboardMutation(endpoint, method) {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) return false;
  return !(normalizedMethod === 'POST' && endpoint.includes('/api/backups') && endpoint.includes('action=create'));
}

function getDashboardEditPassword() {
  let password = sessionStorage.getItem(DASHBOARD_EDIT_PASSWORD_KEY);
  if (password) return password;

  password = window.prompt('Enter the dashboard password to make changes');
  if (password === null) throw new Error('Dashboard change cancelled');
  password = password.trim();
  if (!password) throw new Error('Dashboard password is required');
  sessionStorage.setItem(DASHBOARD_EDIT_PASSWORD_KEY, password);
  return password;
}

function rememberDashboardEditPassword(password) {
  const normalized = String(password || '').trim();
  if (normalized) sessionStorage.setItem(DASHBOARD_EDIT_PASSWORD_KEY, normalized);
}

async function apiCall(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    }
  };

  if (isProtectedDashboardMutation(endpoint, method)) {
    options.headers['X-Dashboard-Edit-Password'] = getDashboardEditPassword();
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(endpoint, options);

  if (!response.ok) {
    if (response.status === 403 && isProtectedDashboardMutation(endpoint, method)) {
      sessionStorage.removeItem(DASHBOARD_EDIT_PASSWORD_KEY);
    }
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.reload();
      throw new Error('Unauthorized - Session expired');
    }
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// Global notification helper
function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#c0392b' : '#3498db'};
    color: white;
    font-weight: 500;
    max-width: min(760px, calc(100vw - 40px));
    line-height: 1.5;
    white-space: normal;
    z-index: 9999;
    animation: slideInRight 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), type === 'error' ? 9000 : 3000);
}

// Make functions globally available
if (typeof window !== 'undefined') {
  window.apiCall = apiCall;
  window.showNotification = showNotification;
  window.getDashboardEditPassword = getDashboardEditPassword;
  window.rememberDashboardEditPassword = rememberDashboardEditPassword;
  window.isProtectedDashboardMutation = isProtectedDashboardMutation;
}
