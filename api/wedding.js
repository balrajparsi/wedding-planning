/**
 * Wedding Config API
 * GET /api/wedding - Get wedding details
 * PUT /api/wedding - Update wedding config
 */

const kv = require('../lib/kv');

const WEDDING_ID = 'akhila-akshay-2026';

const DEFAULT_CONFIG = {
  id: WEDDING_ID,
  coupleName: 'Akhila & Akshay',
  weddingDate: '2026-08-15',
  location: 'Udaipur, Rajasthan',
  currency: 'INR',
  createdAt: new Date().toISOString()
};

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const config = await kv.get(`wedding:${WEDDING_ID}:config`);
      return res.status(200).json(config || DEFAULT_CONFIG);
    }

    if (req.method === 'PUT') {
      const updates = req.body || {};
      const current = await kv.get(`wedding:${WEDDING_ID}:config`) || DEFAULT_CONFIG;
      const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
      await kv.set(`wedding:${WEDDING_ID}:config`, updated);
      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Wedding API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
