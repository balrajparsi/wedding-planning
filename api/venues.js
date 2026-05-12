/**
 * Venue Management API
 * Handles venue CRUD for ceremony, rehearsal, sangeet, mehendi, reception, pre-wedding
 */

const { getKV } = require('../lib/kv');
const { verifyJWT } = require('../lib/jwt');

module.exports = async (req, res) => {
  const kv = getKV();

  // JWT verification middleware
  const token = req.headers.authorization?.replace('Bearer ', '');
  let user;
  try {
    user = verifyJWT(token);
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const weddingId = user.weddingId;
  const method = req.method;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const searchParams = url.searchParams;

  try {
    // GET /api/venues - List all venues with optional filters
    if (method === 'GET' && path === '/api/venues') {
      const eventType = searchParams.get('eventType');
      const status = searchParams.get('status');

      const venuesKey = `wedding:${weddingId}:venues`;
      let venues = await kv.get(venuesKey) || [];

      // Apply filters
      if (eventType) {
        venues = venues.filter(v => v.eventType === eventType);
      }
      if (status) {
        venues = venues.filter(v => v.status === status);
      }

      // Sort by event date
      venues = venues.sort((a, b) => {
        const aDate = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
        const bDate = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
        return aDate - bDate;
      });

      return res.status(200).json(venues);
    }

    // POST /api/venues - Create new venue
    if (method === 'POST' && path === '/api/venues') {
      const { name, eventType, location, address, phone, contactPerson, email,
              capacity, costEstimate, status, eventDate, notes } = req.body;

      if (!name || !eventType) {
        return res.status(400).json({ error: 'Name and event type required' });
      }

      const venue = {
        id: `venue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        weddingId,
        name,
        eventType, // ceremony, rehearsal, sangeet, mehendi, reception, pre-wedding
        location: location || '',
        address: address || '',
        phone: phone || '',
        contactPerson: contactPerson || '',
        email: email || '',
        capacity: capacity || 0,
        costEstimate: costEstimate || 0,
        costActual: 0,
        status: status || 'inquiry', // inquiry, negotiating, confirmed, paid
        bookedDate: '',
        eventDate: eventDate || '',
        amenities: [], // Array of amenity strings
        notes: notes || '',
        documents: [], // Array of {name, url}
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const venuesKey = `wedding:${weddingId}:venues`;
      let venues = await kv.get(venuesKey) || [];
      venues.push(venue);
      await kv.set(venuesKey, venues);

      return res.status(201).json(venue);
    }

    // PUT /api/venues/:id - Update venue
    if (method === 'PUT' && path.startsWith('/api/venues/')) {
      const venueId = path.split('/')[3];
      const updates = req.body;

      const venuesKey = `wedding:${weddingId}:venues`;
      let venues = await kv.get(venuesKey) || [];
      const index = venues.findIndex(v => v.id === venueId);

      if (index === -1) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      venues[index] = {
        ...venues[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(venuesKey, venues);
      return res.status(200).json(venues[index]);
    }

    // DELETE /api/venues/:id - Delete venue
    if (method === 'DELETE' && path.startsWith('/api/venues/')) {
      const venueId = path.split('/')[3];

      const venuesKey = `wedding:${weddingId}:venues`;
      let venues = await kv.get(venuesKey) || [];
      venues = venues.filter(v => v.id !== venueId);
      await kv.set(venuesKey, venues);

      return res.status(200).json({ success: true });
    }

    // POST /api/venues/:id/documents - Add document to venue
    if (method === 'POST' && path.includes('/documents')) {
      const venueId = path.split('/')[3];
      const { documentName, documentUrl } = req.body;

      if (!documentName || !documentUrl) {
        return res.status(400).json({ error: 'Document name and URL required' });
      }

      const venuesKey = `wedding:${weddingId}:venues`;
      let venues = await kv.get(venuesKey) || [];
      const venue = venues.find(v => v.id === venueId);

      if (!venue) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      venue.documents.push({
        name: documentName,
        url: documentUrl,
        uploadedAt: new Date().toISOString()
      });

      venue.updatedAt = new Date().toISOString();
      await kv.set(venuesKey, venues);

      return res.status(200).json(venue);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Venue API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

