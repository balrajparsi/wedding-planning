/**
 * Venue Management API — No Auth
 */

const kv = require('../lib/kv');
const { RSVP_EVENTS } = require('../lib/rsvp');
const WEDDING_ID = 'akhila-akshay-2026';

function isPlaceholderVenue(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  return [
    'bride side address',
    'shared event address',
    'venue to be confirmed',
    'location to be confirmed',
    'to be confirmed',
    'tbd'
  ].includes(normalized);
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function defaultVenueName(event, location = null) {
  if (event.id === 'sangeet') return 'Metroplex Event Center';
  if (event.id === 'marriage') return 'Osage House';
  if (event.id === 'pellikuthuru' && location?.label === 'Pellikuthuru') return 'Pellikuthuru - Bride-side residence';
  if (event.id === 'haldi') return 'Haldi - Bride-side residence';
  if (event.id === 'satyanarayana-swamy-vratam') return 'Satyanarayana Swamy Vratam - Bride-side residence';
  return event.displayName || event.name;
}

function defaultVenueForEvent(event, location = null) {
  const venue = location?.venue || event.venue;
  const mapUrl = location?.mapUrl || event.mapUrl || '';
  const label = location?.label || event.name;
  return {
    id: `default_${event.id}_${slug(label) || 'venue'}`,
    weddingId: WEDDING_ID,
    name: defaultVenueName(event, location),
    eventType: event.name,
    location: venue,
    address: venue,
    phone: '',
    contactPerson: '',
    email: '',
    capacity: 0,
    costEstimate: 0,
    costActual: 0,
    status: 'confirmed',
    bookedDate: '',
    eventDate: event.date || '',
    amenities: [],
    notes: mapUrl ? `Map: ${mapUrl}` : '',
    mapUrl,
    documents: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z'
  };
}

function getDefaultVenues() {
  return RSVP_EVENTS.flatMap(event => {
    if (Array.isArray(event.locations) && event.locations.length) {
      return event.locations
        .filter(location => !isPlaceholderVenue(location.venue))
        .map(location => defaultVenueForEvent(event, location));
    }

    return isPlaceholderVenue(event.venue) ? [] : [defaultVenueForEvent(event)];
  });
}

async function getStoredVenues(key) {
  const venues = await kv.get(key);
  if (Array.isArray(venues) && venues.length) return venues;

  const defaults = getDefaultVenues();
  if (defaults.length) await kv.set(key, defaults);
  return defaults;
}

module.exports = async (req, res) => {
  const method = req.method;
  const url    = new URL(req.url, 'http://localhost');
  const sp     = url.searchParams;
  const id     = sp.get('id') || '';
  const action = sp.get('action') || '';
  const key    = `wedding:${WEDDING_ID}:venues`;

  try {
    if (method === 'GET') {
      let venues = await getStoredVenues(key);
      const evt  = sp.get('eventType');
      const stat = sp.get('status');
      if (evt)  venues = venues.filter(v => v.eventType === evt);
      if (stat) venues = venues.filter(v => v.status    === stat);
      venues.sort((a, b) => (a.eventDate||'').localeCompare(b.eventDate||''));
      return res.status(200).json(venues);
    }

    if (method === 'POST' && action === 'documents' && id) {
      const { documentName, documentUrl } = req.body || {};
      if (!documentName || !documentUrl) return res.status(400).json({ error: 'Document name and URL required' });
      let venues = await kv.get(key) || [];
      const venue = venues.find(v => v.id === id);
      if (!venue) return res.status(404).json({ error: 'Venue not found' });
      venue.documents = venue.documents || [];
      venue.documents.push({ name: documentName, url: documentUrl, uploadedAt: new Date().toISOString() });
      venue.updatedAt = new Date().toISOString();
      await kv.set(key, venues);
      return res.status(200).json(venue);
    }

    if (method === 'POST') {
      const { name, eventType, location, address, phone, contactPerson, email,
              capacity, costEstimate, status, eventDate, notes } = req.body || {};
      if (!name || !eventType) return res.status(400).json({ error: 'Name and event type required' });
      const venue = {
        id: `venue_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
        weddingId: WEDDING_ID, name, eventType,
        location: location||'', address: address||'', phone: phone||'',
        contactPerson: contactPerson||'', email: email||'',
        capacity: capacity||0, costEstimate: costEstimate||0, costActual: 0,
        status: status||'inquiry', bookedDate: '', eventDate: eventDate||'',
        amenities: [], notes: notes||'', documents: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      let venues = await kv.get(key) || [];
      venues.push(venue);
      await kv.set(key, venues);
      return res.status(201).json(venue);
    }

    if (method === 'PUT' && id) {
      let venues = await kv.get(key) || [];
      const idx  = venues.findIndex(v => v.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Venue not found' });
      venues[idx] = { ...venues[idx], ...(req.body||{}), updatedAt: new Date().toISOString() };
      await kv.set(key, venues);
      return res.status(200).json(venues[idx]);
    }

    if (method === 'DELETE' && id) {
      let venues = await kv.get(key) || [];
      venues = venues.filter(v => v.id !== id);
      await kv.set(key, venues);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Venue API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
