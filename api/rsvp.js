const kv = require('../lib/kv');
const {
  WEDDING_ID,
  RSVP_EVENTS,
  verifyRsvpToken,
  buildCalendarFile,
  getInvitedEvents,
  normalizeEvents
} = require('../lib/rsvp');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

function normalizeRsvpStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['accepted', 'accept', 'yes', 'attending', 'confirmed'].includes(text)) return 'accepted';
  if (['declined', 'decline', 'no', 'not attending'].includes(text)) return 'declined';
  if (['maybe', 'tentative'].includes(text)) return 'maybe';
  return 'pending';
}

function normalizeEventResponse(value, fallbackStatus) {
  const text = String(value || '').trim().toLowerCase();
  if (['attending', 'yes', 'accepted'].includes(text)) return 'attending';
  if (['not_attending', 'not-attending', 'no', 'declined'].includes(text)) return 'not_attending';
  if (['maybe', 'tentative'].includes(text)) return 'maybe';
  if (fallbackStatus === 'accepted') return 'attending';
  if (fallbackStatus === 'declined') return 'not_attending';
  if (fallbackStatus === 'maybe') return 'maybe';
  return 'pending';
}

function cleanText(value, maxLength = 1000) {
  return String(value || '').trim().slice(0, maxLength);
}

async function findGuestFromToken(token) {
  const payload = verifyRsvpToken(token);
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const index = guests.findIndex(guest => guest.id === payload.guestId);
  if (index === -1) {
    const error = new Error('Guest not found');
    error.statusCode = 404;
    throw error;
  }
  return { guestsKey, guests, guest: guests[index], index };
}

function publicGuest(guest) {
  const invitedEvents = getInvitedEvents(guest);
  const responses = guest.eventResponses || {};
  return {
    id: guest.id,
    name: guest.name || '',
    email: guest.email || '',
    partySize: parseInt(guest.partySize, 10) || 1,
    dietaryRestrictions: guest.dietaryRestrictions || 'none',
    rsvpStatus: guest.rsvpStatus || 'pending',
    rsvpNotes: guest.rsvpNotes || '',
    events: invitedEvents.map(event => ({
      ...event,
      response: responses[event.name] || 'pending'
    }))
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'GET,POST,OPTIONS');
      return res.status(204).end();
    }

    const url = new URL(req.url, 'http://localhost');
    const body = parseBody(req);
    const token = url.searchParams.get('token') || body.token;
    if (!token) {
      return res.status(400).json({ error: 'Missing RSVP token' });
    }

    const { guestsKey, guests, guest, index } = await findGuestFromToken(token);

    if (req.method === 'GET' && url.searchParams.get('action') === 'calendar') {
      const ics = buildCalendarFile(guest);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="akhila-akshay-wedding.ics"');
      return res.status(200).send(ics);
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        guest: publicGuest(guest),
        events: RSVP_EVENTS
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET,POST,OPTIONS');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const rsvpStatus = normalizeRsvpStatus(body.rsvpStatus);
    const invitedEvents = getInvitedEvents(guest);
    const rawResponses = body.eventResponses || {};
    const eventResponses = {};

    invitedEvents.forEach(event => {
      eventResponses[event.name] = normalizeEventResponse(rawResponses[event.name], rsvpStatus);
    });

    const updatedGuest = {
      ...guest,
      partySize: Math.max(1, parseInt(body.partySize, 10) || parseInt(guest.partySize, 10) || 1),
      dietaryRestrictions: cleanText(body.dietaryRestrictions || guest.dietaryRestrictions || 'none', 80),
      rsvpStatus,
      rsvpDate: rsvpStatus === 'pending' ? guest.rsvpDate || null : new Date().toISOString(),
      rsvpNotes: cleanText(body.rsvpNotes || body.notes || ''),
      eventResponses,
      events: normalizeEvents(guest.events || []).length ? normalizeEvents(guest.events) : invitedEvents.map(event => event.name),
      updatedAt: new Date().toISOString()
    };

    guests[index] = updatedGuest;
    await kv.set(guestsKey, guests);

    return res.status(200).json({
      success: true,
      message: 'RSVP received',
      guest: publicGuest(updatedGuest)
    });
  } catch (error) {
    const status = error.statusCode || (/invalid|expired|missing/i.test(error.message) ? 401 : 500);
    return res.status(status).json({ error: error.message || 'Unable to process RSVP' });
  }
};
