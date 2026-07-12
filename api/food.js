/**
 * Food & Menu Management API — No Auth
 */

const kv = require('../lib/kv');
const WEDDING_ID = 'akhila-akshay-2026';

const EVENT_TYPES = [
  'Haldi',
  'Sangeet',
  'Pellikuthuru',
  'Marriage',
  'Satyanarayana Swamy Vratam'
];

const COURSE_TYPES = ['breakfast', 'lunch', 'dinner'];
const VEG_TYPES = ['veg', 'non-veg', 'both'];

function cleanText(value, maxLength = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeEventType(value) {
  const text = cleanText(value).toLowerCase();
  return EVENT_TYPES.find(event => event.toLowerCase() === text) || '';
}

function normalizeCourseType(value) {
  const rawText = cleanText(value).toLowerCase();
  if (/\b(breakfast|brunch|morning|snacks?)\b/.test(rawText)) return 'breakfast';
  if (/\b(dinner|supper|evening)\b/.test(rawText)) return 'dinner';
  if (/\b(lunch|noon|afternoon)\b/.test(rawText)) return 'lunch';
  const text = rawText.replace(/[^a-z]/g, '');
  const aliases = {
    breakfast: 'breakfast',
    brunch: 'breakfast',
    morning: 'breakfast',
    snack: 'breakfast',
    snacks: 'breakfast',
    lunch: 'lunch',
    noon: 'lunch',
    afternoon: 'lunch',
    appetizer: 'lunch',
    appetizers: 'lunch',
    starter: 'lunch',
    starters: 'lunch',
    main: 'lunch',
    mains: 'lunch',
    entree: 'lunch',
    entrees: 'lunch',
    curry: 'lunch',
    curries: 'lunch',
    side: 'lunch',
    sides: 'lunch',
    dessert: 'lunch',
    desserts: 'lunch',
    sweet: 'lunch',
    sweets: 'lunch',
    beverage: 'lunch',
    beverages: 'lunch',
    drink: 'lunch',
    drinks: 'lunch',
    dinner: 'dinner',
    supper: 'dinner',
    evening: 'dinner'
  };
  return aliases[text] || (COURSE_TYPES.includes(text) ? text : '');
}

function normalizeVegType(value) {
  const text = cleanText(value).toLowerCase().replace(/[\s_]+/g, '-');
  if (['veg', 'vegetarian', 'pure-veg', 'v'].includes(text)) return 'veg';
  if (['non-veg', 'nonveg', 'non-vegetarian', 'nv', 'meat', 'chicken', 'fish', 'egg'].includes(text)) return 'non-veg';
  if (['both', 'shared', 'veg-and-non-veg', 'veg/non-veg'].includes(text)) return 'both';
  return VEG_TYPES.includes(text) ? text : 'both';
}

function normalizeCost(value) {
  const parsed = parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeMenuPayload(data = {}) {
  return {
    eventType: normalizeEventType(data.eventType) || cleanText(data.eventType, 80),
    courseType: normalizeCourseType(data.courseType) || cleanText(data.courseType, 80).toLowerCase() || 'lunch',
    dish: cleanText(data.dish, 160),
    vegNonVeg: normalizeVegType(data.vegNonVeg),
    cost: normalizeCost(data.cost),
    portionSize: cleanText(data.portionSize, 80) || '1 plate',
    preparedBy: cleanText(data.preparedBy, 160),
    cuisine: cleanText(data.cuisine, 80),
    notes: cleanText(data.notes, 1000)
  };
}

function makeMenuItem(data) {
  return {
    id: `food_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
    weddingId: WEDDING_ID,
    eventDate: '',
    guestAccommodations: [],
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function itemKey(item) {
  return [item.eventType, normalizeCourseType(item.courseType) || item.courseType, item.dish]
    .map(value => cleanText(value).toLowerCase())
    .join('|');
}

function normalizeStoredItems(items) {
  let changed = false;
  const normalizedItems = items.map(item => {
    const normalizedCourseType = normalizeCourseType(item.courseType);
    if (normalizedCourseType && normalizedCourseType !== item.courseType) {
      changed = true;
      return { ...item, courseType: normalizedCourseType };
    }
    return item;
  });
  return { items: normalizedItems, changed };
}

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
      const normalized = normalizeStoredItems(items);
      items = normalized.items;
      if (normalized.changed) await kv.set(key, items);
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

    if (method === 'POST' && action === 'import') {
      const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!incoming.length) return res.status(400).json({ error: 'No menu items to import' });
      if (incoming.length > 500) return res.status(400).json({ error: 'Import up to 500 menu items at a time' });

      let items = await kv.get(key) || [];
      const seen = new Set(items.map(itemKey));
      const created = [];
      const skipped = [];

      incoming.forEach((raw, index) => {
        const normalized = normalizeMenuPayload(raw);
        if (!normalized.dish || !normalized.eventType || !normalized.courseType) {
          skipped.push({ index, reason: 'Missing dish, event, or meal', item: raw });
          return;
        }
        const key = itemKey(normalized);
        if (seen.has(key)) {
          skipped.push({ index, reason: 'Duplicate dish for event/course', item: raw });
          return;
        }
        seen.add(key);
        const item = makeMenuItem(normalized);
        items.push(item);
        created.push(item);
      });

      if (created.length) await kv.set(key, items);
      return res.status(200).json({ success: true, created, skipped, imported: created.length, skippedCount: skipped.length });
    }

    if (method === 'POST') {
      const data = normalizeMenuPayload(req.body || {});
      if (!data.dish || !data.eventType || !data.courseType) return res.status(400).json({ error: 'Dish, event type, and meal type required' });
      const item = makeMenuItem(data);
      let items = await kv.get(key) || [];
      items.push(item);
      await kv.set(key, items);
      return res.status(201).json(item);
    }

    if (method === 'PUT' && id) {
      let items = await kv.get(key) || [];
      const idx  = items.findIndex(m => m.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Menu item not found' });
      const data = normalizeMenuPayload({ ...items[idx], ...(req.body || {}) });
      items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
      await kv.set(key, items);
      return res.status(200).json(items[idx]);
    }

    if (method === 'DELETE' && action === 'reset') {
      const resetPasscode = String(req.body?.passcode || '').trim();
      if (resetPasscode !== '291097') {
        return res.status(403).json({ error: 'Invalid reset passcode' });
      }

      await kv.set(key, []);
      return res.status(200).json({ success: true, cleared: true });
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
