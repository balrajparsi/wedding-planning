/**
 * Guest Management API Endpoints
 * GET /api/guests - List guests with filters/search
 * POST /api/guests - Add new guest
 * PUT /api/guests/:id - Update guest or RSVP status
 * DELETE /api/guests/:id - Remove guest
 * POST /api/guests/bulk-invite - Send bulk RSVP invitations
 * GET /api/guests/export - Export guests as CSV
 */

const crypto = require('crypto');
const JWT = require('../lib/jwt');
const kv = require('../lib/kv');

const jwt = new JWT();

// Middleware: Verify JWT and check authorization
async function verifyAuth(req, headers) {
  const authToken = headers.authorization?.split(' ')[1];
  if (!authToken) throw new Error('Unauthorized');

  const payload = jwt.verify(authToken);
  const user = await kv.get(`user:${payload.email}`);
  if (!user) throw new Error('User not found');

  return { payload, user };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET' && req.url.includes('/guests') && !req.url.includes('/export')) {
      return handleListGuests(req, res);
    }

    if (req.method === 'POST' && req.url.includes('/guests') && !req.url.includes('/bulk-invite') && !req.url.includes('/export')) {
      return handleAddGuest(req, res);
    }

    if (req.method === 'PUT' && req.url.match(/\/guests\/[a-z0-9]+$/i)) {
      return handleUpdateGuest(req, res);
    }

    if (req.method === 'DELETE' && req.url.match(/\/guests\/[a-z0-9]+$/i)) {
      return handleDeleteGuest(req, res);
    }

    if (req.method === 'POST' && req.url.includes('/bulk-invite')) {
      return handleBulkInvite(req, res);
    }

    if (req.method === 'GET' && req.url.includes('/export')) {
      return handleExportGuests(req, res);
    }

    res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Guests API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleListGuests(req, res) {
  const { payload, user } = await verifyAuth(req, req.headers);

  // Get all guests for this wedding
  const guestsKey = `wedding:${user.weddingId}:guests`;
  const guests = (await kv.get(guestsKey)) || [];

  // Apply filters from query string
  const url = new URL(req.url, 'http://localhost');
  const rsvpStatus = url.searchParams.get('rsvpStatus');
  const search = url.searchParams.get('search')?.toLowerCase();
  const dietary = url.searchParams.get('dietary');
  const sortBy = url.searchParams.get('sortBy') || 'name';
  const sortDir = url.searchParams.get('sortDir') || 'asc';

  let filtered = guests;

  if (rsvpStatus) {
    filtered = filtered.filter(g => g.rsvpStatus === rsvpStatus);
  }

  if (search) {
    filtered = filtered.filter(g =>
      g.name.toLowerCase().includes(search) ||
      g.email?.toLowerCase().includes(search) ||
      g.phone?.includes(search)
    );
  }

  if (dietary && dietary !== 'all') {
    filtered = filtered.filter(g =>
      g.dietaryRestrictions?.toLowerCase().includes(dietary.toLowerCase())
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortBy === 'partySize') {
      aVal = parseInt(aVal) || 1;
      bVal = parseInt(bVal) || 1;
    } else if (sortBy === 'rsvpDate' || sortBy === 'invitedDate') {
      aVal = new Date(aVal) || new Date(0);
      bVal = new Date(bVal) || new Date(0);
    }

    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Attach summary stats
  const stats = {
    total: guests.length,
    accepted: guests.filter(g => g.rsvpStatus === 'accepted').length,
    declined: guests.filter(g => g.rsvpStatus === 'declined').length,
    pending: guests.filter(g => g.rsvpStatus === 'pending').length,
    maybe: guests.filter(g => g.rsvpStatus === 'maybe').length,
    totalPartySize: guests.reduce((sum, g) => sum + (parseInt(g.partySize) || 1), 0)
  };

  res.json({
    guests: filtered,
    stats
  });
}

async function handleAddGuest(req, res) {
  const { payload, user } = await verifyAuth(req, req.headers);

  // Check permission (admin or planner)
  if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can add guests' });
  }

  const { name, email, phone, relationship, partySize, dietaryRestrictions, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Guest name required' });
  }

  const guestId = crypto.randomBytes(8).toString('hex');
  const guest = {
    id: guestId,
    weddingId: user.weddingId,
    name,
    email: email || '',
    phone: phone || '',
    relationship: relationship || '',
    partySize: partySize || 1,
    dietaryRestrictions: dietaryRestrictions || 'none',
    notes: notes || '',
    rsvpStatus: 'pending',
    invitedDate: new Date().toISOString(),
    rsvpDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to guests list
  const guestsKey = `wedding:${user.weddingId}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  guests.push(guest);
  await kv.set(guestsKey, guests);

  res.status(201).json(guest);
}

async function handleUpdateGuest(req, res) {
  const { payload, user } = await verifyAuth(req, req.headers);

  // Extract guest ID from URL
  const guestId = req.url.match(/\/guests\/([a-z0-9]+)$/i)[1];

  // Get current guest
  const guestsKey = `wedding:${user.weddingId}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const guestIndex = guests.findIndex(g => g.id === guestId);

  if (guestIndex === -1) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  const guest = guests[guestIndex];

  // Check permission (admin, planner, or the guest themselves)
  if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can update guests' });
  }

  // Update fields
  const { name, email, phone, relationship, partySize, dietaryRestrictions, notes, rsvpStatus } = req.body;

  if (name !== undefined) guest.name = name;
  if (email !== undefined) guest.email = email;
  if (phone !== undefined) guest.phone = phone;
  if (relationship !== undefined) guest.relationship = relationship;
  if (partySize !== undefined) guest.partySize = partySize;
  if (dietaryRestrictions !== undefined) guest.dietaryRestrictions = dietaryRestrictions;
  if (notes !== undefined) guest.notes = notes;

  if (rsvpStatus !== undefined) {
    guest.rsvpStatus = rsvpStatus;
    if (rsvpStatus !== 'pending') {
      guest.rsvpDate = new Date().toISOString();
    }
  }

  guest.updatedAt = new Date().toISOString();

  // Save updated list
  guests[guestIndex] = guest;
  await kv.set(guestsKey, guests);

  res.json(guest);
}

async function handleDeleteGuest(req, res) {
  const { payload, user } = await verifyAuth(req, req.headers);

  // Check permission
  if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can delete guests' });
  }

  // Extract guest ID from URL
  const guestId = req.url.match(/\/guests\/([a-z0-9]+)$/i)[1];

  // Remove from guests list
  const guestsKey = `wedding:${user.weddingId}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const filtered = guests.filter(g => g.id !== guestId);

  if (filtered.length === guests.length) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  await kv.set(guestsKey, filtered);

  res.json({ success: true, message: 'Guest deleted' });
}

async function handleBulkInvite(req, res) {
  const { payload, user } = await verifyAuth(req, req.headers);

  // Check permission (admin only for sending invites)
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can send bulk invites' });
  }

  const { guestIds, subject, message } = req.body;

  if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
    return res.status(400).json({ error: 'Guest IDs required' });
  }

  // Get guests
  const guestsKey = `wedding:${user.weddingId}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const selectedGuests = guests.filter(g => guestIds.includes(g.id));

  if (selectedGuests.length === 0) {
    return res.status(404).json({ error: 'No guests found' });
  }

  // In production, send emails via Vercel Resend API
  // For now, just return the guests that would be invited
  const invitedCount = selectedGuests.filter(g => g.email).length;

  res.json({
    success: true,
    message: `Invite would be sent to ${invitedCount} guests`,
    invitedGuests: selectedGuests.filter(g => g.email)
  });
}

async function handleExportGuests(req, res) {
  const { payload, user } = await verifyAuth(req, req.headers);

  // Get all guests
  const guestsKey = `wedding:${user.weddingId}:guests`;
  const guests = (await kv.get(guestsKey)) || [];

  // Generate CSV
  const csv = [
    ['Name', 'Email', 'Phone', 'Relationship', 'Party Size', 'Dietary Restrictions', 'RSVP Status', 'RSVP Date', 'Notes'].join(',')
  ];

  guests.forEach(g => {
    csv.push([
      `"${g.name}"`,
      `"${g.email || ''}"`,
      `"${g.phone || ''}"`,
      `"${g.relationship || ''}"`,
      g.partySize || 1,
      `"${g.dietaryRestrictions || ''}"`,
      g.rsvpStatus,
      g.rsvpDate ? new Date(g.rsvpDate).toLocaleDateString() : '',
      `"${g.notes || ''}"`
    ].join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="guests.csv"');
  res.send(csv.join('\n'));
}
