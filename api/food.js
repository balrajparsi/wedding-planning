/**
 * Food & Menu Management API — No Auth
 */

const kv = require('../lib/kv');
const WEDDING_ID = 'akhila-akshay-2026';

module.exports = async (req, res) => {
  const method = req.method;
  const url    = new URL(req.url, 'http://localhost');
  const sp     = url.searchParams;
  const id     = sp.get('id') || '';
  const action = sp.get('action') || '';
  const key    = `wedding:${WEDDING_ID}:food`;

  try {
    if (method === 'GET') {
      let items = await kv.get(key) || [];
      const evt  = sp.get('eventType');
      const crs  = sp.get('courseType');
      if (evt) items = items.filter(m => m.eventType  === evt);
      if (crs) items = items.filter(m => m.courseType === crs);
      return res.status(200).json(items);
    }

    if (method === 'POST' && action === 'accommodation' && id) {
      const { guestId, modification } = req.body || {};
      if (!guestId || !modification) return res.status(400).json({ error: 'guestId and modification required' });
      let items = await kv.get(key) || [];
      const item = items.find(m => m.id === id);
      if (!item) return res.status(404).json({ error: 'Menu item not found' });
      item.guestAccommodations = item.guestAccommodations || [];
      const existing = item.guestAccommodations.findIndex(a => a.guestId === guestId);
      if (existing !== -1) item.guestAccommodations[existing].modification = modification;
      else item.guestAccommodations.push({ guestId, modification });
      item.updatedAt = new Date().toISOString();
      await kv.set(key, items);
      return res.status(200).json(item);
    }

    if (method === 'POST') {
      const { eventType, courseType, dish, vegNonVeg, cost, portionSize, preparedBy, cuisine, notes } = req.body || {};
      if (!dish || !eventType || !courseType) return res.status(400).json({ error: 'Dish, event type, and course type required' });
      const item = {
        id: `food_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
        weddingId: WEDDING_ID, eventType, eventDate: '', courseType, dish,
        vegNonVeg: vegNonVeg||'both', cost: cost||0,
        portionSize: portionSize||'1 plate', preparedBy: preparedBy||'',
        cuisine: cuisine||'', guestAccommodations: [], notes: notes||'',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      let items = await kv.get(key) || [];
      items.push(item);
      await kv.set(key, items);
      return res.status(201).json(item);
    }

    if (method === 'PUT' && id) {
      let items = await kv.get(key) || [];
      const idx  = items.findIndex(m => m.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Menu item not found' });
      items[idx] = { ...items[idx], ...(req.body||{}), updatedAt: new Date().toISOString() };
      await kv.set(key, items);
      return res.status(200).json(items[idx]);
    }

    if (method === 'DELETE' && id) {
      let items = await kv.get(key) || [];
      items = items.filter(m => m.id !== id);
      await kv.set(key, items);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Food API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
