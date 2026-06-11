/**
 * Timeline Management API — No Auth
 */

const kv = require('../lib/kv');
const WEDDING_ID = 'akhila-akshay-2026';

function parseCentralDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value);
}

module.exports = async (req, res) => {
  const method = req.method;
  const url    = new URL(req.url, 'http://localhost');
  const sp     = url.searchParams;
  const id     = sp.get('id') || '';
  const key    = `wedding:${WEDDING_ID}:timeline`;

  try {
    if (method === 'GET') {
      let milestones = await kv.get(key) || [];
      const type = sp.get('type');
      if (type) milestones = milestones.filter(m => m.type === type);
      milestones.sort((a, b) => parseCentralDateOnly(a.date) - parseCentralDateOnly(b.date));
      return res.status(200).json(milestones);
    }

    if (method === 'POST') {
      const { type, title, date, location, description, attendees, notes } = req.body || {};
      if (!type || !title || !date) return res.status(400).json({ error: 'Type, title, and date required' });
      const milestone = {
        id: `timeline_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
        weddingId: WEDDING_ID, type, title, date,
        location: location||'', description: description||'',
        attendees: attendees||[], notes: notes||'',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      let milestones = await kv.get(key) || [];
      milestones.push(milestone);
      await kv.set(key, milestones);
      return res.status(201).json(milestone);
    }

    if (method === 'PUT' && id) {
      let milestones = await kv.get(key) || [];
      const idx = milestones.findIndex(m => m.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Milestone not found' });
      milestones[idx] = { ...milestones[idx], ...(req.body||{}), updatedAt: new Date().toISOString() };
      await kv.set(key, milestones);
      return res.status(200).json(milestones[idx]);
    }

    if (method === 'DELETE' && id) {
      let milestones = await kv.get(key) || [];
      milestones = milestones.filter(m => m.id !== id);
      await kv.set(key, milestones);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Timeline API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
