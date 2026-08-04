const crypto = require('crypto');

const DEFAULT_EDIT_PASSWORD = '29101997';

function getEditPassword() {
  return String(process.env.DASHBOARD_EDIT_PASSWORD || DEFAULT_EDIT_PASSWORD);
}

function passwordsMatch(provided, expected) {
  const providedBuffer = Buffer.from(String(provided || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  return providedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function requireDashboardEditPassword(req, res) {
  const provided = req.headers?.['x-dashboard-edit-password'];
  if (passwordsMatch(provided, getEditPassword())) return true;

  res.status(403).json({
    error: 'Dashboard edit password required',
    code: 'DASHBOARD_EDIT_PASSWORD_REQUIRED'
  });
  return false;
}

module.exports = {
  DEFAULT_EDIT_PASSWORD,
  getEditPassword,
  requireDashboardEditPassword
};
