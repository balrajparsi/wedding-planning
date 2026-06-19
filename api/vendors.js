/**
 * Vendor Management API — No Auth
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

function normalizeEventTypes(input, fallback = '') {
  const rawValues = Array.isArray(input)
    ? input
    : String(input || '')
        .split(',')
        .map(value => value.trim());

  if ((!rawValues || rawValues.length === 0 || rawValues.every(value => !value)) && fallback) {
    return normalizeEventTypes(fallback);
  }

  const normalized = [];
  rawValues.forEach(rawValue => {
    const value = String(rawValue || '').trim();
    if (!value) return;

    if (/^(all|all events|multiple events)$/i.test(value)) {
      EVENT_TYPES.forEach(eventType => {
        if (!normalized.includes(eventType)) normalized.push(eventType);
      });
      return;
    }

    const knownEvent = EVENT_TYPES.find(eventType => eventType.toLowerCase() === value.toLowerCase());
    const finalValue = knownEvent || value;
    if (!normalized.includes(finalValue)) normalized.push(finalValue);
  });

  return normalized;
}

function getEventTypeLabel(eventTypes) {
  if (!eventTypes || eventTypes.length === 0) return '';
  if (EVENT_TYPES.every(eventType => eventTypes.includes(eventType))) return 'All Events';
  if (eventTypes.length === 1) return eventTypes[0];
  return eventTypes.join(', ');
}

function normalizeVendorRecord(vendor) {
  const eventTypes = normalizeEventTypes(vendor.eventTypes, vendor.eventType);
  return {
    ...vendor,
    eventTypes,
    eventType: getEventTypeLabel(eventTypes)
  };
}

function vendorHasEvent(vendor, eventType) {
  if (!eventType) return true;
  return normalizeEventTypes(vendor.eventTypes, vendor.eventType).includes(eventType);
}

module.exports = async (req, res) => {
  const method = req.method;
  const url    = new URL(req.url, `http://localhost`);
  const sp     = url.searchParams;
  const id     = sp.get('id') || '';
  const action = sp.get('action') || '';
  const key    = `wedding:${WEDDING_ID}:vendors`;

  try {
    // GET — list vendors
    if (method === 'GET') {
      let vendors = (await kv.get(key) || []).map(normalizeVendorRecord);
      const cat   = sp.get('category');
      const stat  = sp.get('status');
      const evt   = sp.get('eventType');
      if (cat)  vendors = vendors.filter(v => v.category  === cat);
      if (stat) vendors = vendors.filter(v => v.status    === stat);
      if (evt)  vendors = vendors.filter(v => vendorHasEvent(v, evt));
      vendors.sort((a, b) => {
        const ord = { paid:-1, confirmed:0, negotiating:1, inquiry:2 };
        const diff = (ord[a.status]||3) - (ord[b.status]||3);
        if (diff !== 0) return diff;
        return (a.serviceDate||'').localeCompare(b.serviceDate||'');
      });
      return res.status(200).json(vendors);
    }

    // POST — create vendor or add document (?action=documents&id=...)
    if (method === 'POST' && action === 'documents' && id) {
      const { documentName, documentUrl } = req.body || {};
      if (!documentName || !documentUrl) return res.status(400).json({ error: 'Document name and URL required' });
      let vendors = await kv.get(key) || [];
      const vendor = vendors.find(v => v.id === id);
      if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
      vendor.documents = vendor.documents || [];
      vendor.documents.push({ name: documentName, url: documentUrl, uploadedAt: new Date().toISOString() });
      vendor.updatedAt = new Date().toISOString();
      await kv.set(key, vendors);
      return res.status(200).json(vendor);
    }

    if (method === 'POST') {
      const { name, category, contactName, email, phone, website, eventType, eventTypes,
              status, bookedDate, serviceDate, costEstimate, notes } = req.body || {};
      if (!name || !category) return res.status(400).json({ error: 'Name and category required' });
      const normalizedEventTypes = normalizeEventTypes(eventTypes, eventType);
      const vendor = {
        id: `vendor_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
        weddingId: WEDDING_ID, name, category,
        contactName: contactName||'', email: email||'', phone: phone||'',
        website: website||'', eventTypes: normalizedEventTypes,
        eventType: getEventTypeLabel(normalizedEventTypes),
        status: status||'inquiry', bookedDate: bookedDate||'',
        serviceDate: serviceDate||'', costEstimate: costEstimate||0,
        costActual: 0, notes: notes||'', documents: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      let vendors = await kv.get(key) || [];
      vendors.push(vendor);
      await kv.set(key, vendors);
      return res.status(201).json(vendor);
    }

    // PUT — update vendor (?id=...)
    if (method === 'PUT' && id) {
      let vendors = await kv.get(key) || [];
      const idx = vendors.findIndex(v => v.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Vendor not found' });
      const updates = { ...(req.body || {}) };
      if ('eventTypes' in updates || 'eventType' in updates) {
        const normalizedEventTypes = normalizeEventTypes(updates.eventTypes, updates.eventType);
        updates.eventTypes = normalizedEventTypes;
        updates.eventType = getEventTypeLabel(normalizedEventTypes);
      }
      vendors[idx] = { ...vendors[idx], ...updates, updatedAt: new Date().toISOString() };
      await kv.set(key, vendors);
      return res.status(200).json(normalizeVendorRecord(vendors[idx]));
    }

    // DELETE — remove vendor or document (?id=...&action=documents&docIndex=N)
    if (method === 'DELETE' && id && action === 'documents') {
      const docIdx = parseInt(sp.get('docIndex') || '0');
      let vendors  = await kv.get(key) || [];
      const vendor = vendors.find(v => v.id === id);
      if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
      vendor.documents = vendor.documents || [];
      vendor.documents.splice(docIdx, 1);
      vendor.updatedAt = new Date().toISOString();
      await kv.set(key, vendors);
      return res.status(200).json(vendor);
    }

    if (method === 'DELETE' && id) {
      let vendors = await kv.get(key) || [];
      vendors = vendors.filter(v => v.id !== id);
      await kv.set(key, vendors);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Vendor API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
