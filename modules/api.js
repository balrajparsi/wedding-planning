/**
 * API Wrapper Utility
 * Provides global apiCall function for all modules
 */

async function apiCall(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(endpoint, options);

  if (!response.ok) {
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
}
