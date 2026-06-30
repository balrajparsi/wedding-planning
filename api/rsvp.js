const crypto = require('crypto');
const kv = require('../lib/kv');
const {
  WEDDING_ID,
  RSVP_EVENTS,
  verifyRsvpToken,
  buildCalendarFile,
  getInvitedEvents,
  normalizeEvents
} = require('../lib/rsvp');
const { sendRsvpConfirmations } = require('../lib/rsvp-confirmations');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

function cleanText(value, maxLength = 1000) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeRsvpStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['accepted', 'accept', 'yes', 'attending', 'confirmed'].includes(text)) return 'accepted';
  if (['declined', 'decline', 'no', 'not attending'].includes(text)) return 'declined';
  if (['maybe', 'tentative'].includes(text)) return 'maybe';
  return 'pending';
}

function normalizeEventResponse(value, fallbackStatus = 'pending') {
  const raw = value && typeof value === 'object' ? value : { response: value };
  const text = String(raw.response || raw.status || '').trim().toLowerCase();
  const response = ['attending', 'yes', 'accepted'].includes(text)
    ? 'attending'
    : ['not_attending', 'not-attending', 'no', 'declined'].includes(text)
      ? 'not_attending'
      : ['maybe', 'tentative'].includes(text)
        ? 'maybe'
        : fallbackStatus === 'accepted'
          ? 'attending'
          : fallbackStatus === 'declined'
            ? 'not_attending'
            : fallbackStatus === 'maybe' ? 'maybe' : 'pending';

  const attendanceCount = response === 'attending'
    ? Math.max(0, parseInt(raw.attendanceCount ?? raw.attendees ?? raw.partySize, 10) || 0)
    : 0;
  return {
    response,
    attendanceCount,
    vegetarianCount: response === 'attending'
      ? Math.max(0, parseInt(raw.vegetarianCount ?? raw.vegetarian, 10) || 0)
      : 0,
    nonVegetarianCount: response === 'attending'
      ? Math.max(0, parseInt(raw.nonVegetarianCount ?? raw.nonVegetarian, 10) || 0)
      : 0
  };
}

function normalizeEventResponses(rawResponses, fallbackStatus = 'pending', events = RSVP_EVENTS) {
  const raw = rawResponses && typeof rawResponses === 'object' ? rawResponses : {};
  return Object.fromEntries(events.map(event => [
    canonicalEventName(event),
    normalizeEventResponse(raw[event.name] ?? raw[canonicalEventName(event)], fallbackStatus)
  ]));
}

function canonicalEventName(event) {
  return RSVP_EVENTS.find(item => item.id === event.id)?.name || event.name;
}

function deriveRsvpStatus(eventResponses) {
  const values = Object.values(eventResponses || {});
  if (values.some(value => value.response === 'attending')) return 'accepted';
  if (values.some(value => value.response === 'maybe')) return 'maybe';
  return 'declined';
}

function normalizeIdentity(value) {
  return cleanText(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function normalizePhone(value) {
  return cleanText(value, 40).replace(/\D/g, '');
}

function validatePublicSubmission(body) {
  const name = cleanText(body.name, 160);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  if (!name || !email || !phone) throw publicError('Name, phone number, and email are required.', 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw publicError('Enter a valid email address.', 400);
  if (phone.length < 7) throw publicError('Enter a valid phone number.', 400);

  const rawResponses = body.eventResponses;
  if (!rawResponses || typeof rawResponses !== 'object') throw publicError('Please answer for every event.', 400);

  const eventResponses = {};
  RSVP_EVENTS.forEach(event => {
    const responseKey = Object.prototype.hasOwnProperty.call(rawResponses, event.name)
      ? event.name
      : event.displayName && Object.prototype.hasOwnProperty.call(rawResponses, event.displayName)
        ? event.displayName
        : '';
    const eventLabel = event.displayName || event.name;
    if (!responseKey) {
      throw publicError(`Please answer for ${eventLabel}.`, 400);
    }
    const response = normalizeEventResponse(rawResponses[responseKey]);
    if (response.response === 'pending' || response.response === 'maybe') throw publicError(`Choose Yes or No for ${eventLabel}.`, 400);
    if (response.response === 'attending') {
      if (response.attendanceCount < 1) throw publicError(`Enter the number attending ${eventLabel}.`, 400);
      if (event.mealPolicy === 'vegetarian-only') {
        response.vegetarianCount = response.attendanceCount;
        response.nonVegetarianCount = 0;
      } else if (response.vegetarianCount + response.nonVegetarianCount !== response.attendanceCount) {
        throw publicError(`Vegetarian and non-vegetarian meals must equal the attendees for ${eventLabel}.`, 400);
      }
    }
    eventResponses[event.name] = response;
  });

  return { name, email, phone, eventResponses, rsvpNotes: cleanText(body.rsvpNotes || body.notes, 1000) };
}

function publicError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function findPublicGuestMatch(guests, submission) {
  const ids = new Set();
  const name = normalizeIdentity(submission.name);

  guests.forEach(guest => {
    if (normalizeEmail(guest.email) === submission.email) ids.add(guest.id);
    if (normalizePhone(guest.phone) === submission.phone) ids.add(guest.id);
    if (normalizeIdentity(guest.name) === name) ids.add(guest.id);
  });

  if (ids.size > 1) {
    throw publicError('We found more than one guest record with these details. Please contact the family so we can record your RSVP correctly.', 409);
  }
  return ids.size === 1 ? guests.find(guest => guest.id === [...ids][0]) : null;
}

function getPublicEvents(guest = null) {
  const responses = normalizeEventResponses(guest?.eventResponses, guest?.rsvpStatus || 'pending');
  return RSVP_EVENTS.map(event => ({ ...event, ...responses[event.name] }));
}

function getGuestEvents(guest) {
  const responses = normalizeEventResponses(guest.eventResponses, guest.rsvpStatus);
  return getInvitedEvents(guest).map(event => ({
    ...event,
    ...responses[canonicalEventName(event)]
  }));
}

function publicGuest(guest, allEvents = false) {
  const events = allEvents ? getPublicEvents(guest) : getGuestEvents(guest);
  return {
    id: guest.id,
    name: guest.name || '',
    email: guest.email || '',
    phone: guest.phone || '',
    partySize: parseInt(guest.partySize, 10) || 1,
    dietaryRestrictions: guest.dietaryRestrictions || 'none',
    rsvpStatus: guest.rsvpStatus || 'pending',
    rsvpNotes: guest.rsvpNotes || '',
    rsvpLocked: Boolean(guest.rsvpLockedAt),
    events
  };
}

function getPublicRsvpEvents() {
  return getInvitedEvents({ events: RSVP_EVENTS.map(event => event.name) });
}

async function findGuestFromToken(token) {
  const payload = verifyRsvpToken(token);
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const index = guests.findIndex(guest => guest.id === payload.guestId);
  if (index === -1) throw publicError('Guest not found', 404);
  return { guestsKey, guests, guest: guests[index], index };
}

async function sendAndStoreRsvpConfirmations(guestsKey, guests, guest) {
  const confirmations = await sendRsvpConfirmations(guest, getGuestEvents(guest));
  const index = guests.findIndex(item => item.id === guest.id);
  if (index === -1) return guest;

  const updatedGuest = { ...guest, rsvpConfirmations: confirmations };
  guests[index] = updatedGuest;
  try {
    await kv.set(guestsKey, guests);
  } catch (error) {
    console.error('Unable to save RSVP confirmation results:', error);
  }
  return updatedGuest;
}

async function handlePublicRsvp(req, res, body) {
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, events: getPublicRsvpEvents() });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const submission = validatePublicSubmission(body);
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const existing = findPublicGuestMatch(guests, submission);
  if (existing?.rsvpLockedAt) {
    return res.status(409).json({
      error: 'Your RSVP has already been received. Please contact the family for any changes.'
    });
  }
  const now = new Date().toISOString();
  const rsvpStatus = deriveRsvpStatus(submission.eventResponses);
  const partySize = Math.max(1, ...Object.values(submission.eventResponses).map(response => response.attendanceCount || 0));
  const rsvpDate = rsvpStatus === 'pending' ? null : now;
  const updates = {
    name: submission.name,
    email: submission.email,
    phone: submission.phone,
    partySize,
    rsvpStatus,
    rsvpDate,
    rsvpNotes: submission.rsvpNotes,
    eventResponses: submission.eventResponses,
    lastRsvpSource: 'public_rsvp',
    rsvpLockedAt: now,
    updatedAt: now
  };

  let guest;
  let updatedExisting = false;
  if (existing) {
    const index = guests.findIndex(item => item.id === existing.id);
    guest = { ...existing, ...updates };
    guests[index] = guest;
    updatedExisting = true;
  } else {
    guest = {
      id: crypto.randomBytes(8).toString('hex'),
      weddingId: WEDDING_ID,
      relationship: '',
      dietaryRestrictions: 'none',
      notes: '',
      events: RSVP_EVENTS.map(event => event.name),
      invitedDate: null,
      lastInviteAttemptDate: null,
      lastInviteError: '',
      source: 'public_rsvp',
      createdAt: now,
      ...updates
    };
    guests.push(guest);
  }

  await kv.set(guestsKey, guests);
  guest = await sendAndStoreRsvpConfirmations(guestsKey, guests, guest);
  return res.status(200).json({
    success: true,
    message: 'Your RSVP has been received. Thank you for celebrating with Akhila and Akshay.',
    updatedExisting,
    guest: publicGuest(guest, true)
  });
}

async function handleTokenRsvp(req, res, url, body, token) {
  const { guestsKey, guests, guest, index } = await findGuestFromToken(token);
  if (req.method === 'GET' && url.searchParams.get('action') === 'calendar') {
    const ics = buildCalendarFile(guest);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="akhila-akshay-wedding.ics"');
    return res.status(200).send(ics);
  }
  if (req.method === 'GET') return res.status(200).json({ success: true, guest: publicGuest(guest), events: getPublicRsvpEvents() });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (guest.rsvpLockedAt) {
    throw publicError('Your RSVP has already been received. Please contact the family for any changes.', 409);
  }

  const fallbackStatus = normalizeRsvpStatus(body.rsvpStatus);
  const invitedEvents = getInvitedEvents(guest);
  const eventResponses = normalizeEventResponses(body.eventResponses, fallbackStatus, invitedEvents);
  if (body.eventResponses) {
    invitedEvents.forEach(event => {
      const eventLabel = event.displayName || event.name;
      const response = eventResponses[canonicalEventName(event)];
      if (!response || response.response === 'pending' || response.response === 'maybe') {
        throw publicError(`Choose Yes or No for ${eventLabel}.`, 400);
      }
    });
  }
  const rsvpStatus = body.eventResponses ? deriveRsvpStatus(eventResponses) : fallbackStatus;
  const now = new Date().toISOString();
  let updatedGuest = {
    ...guest,
    partySize: Math.max(1, parseInt(body.partySize, 10) || parseInt(guest.partySize, 10) || 1),
    dietaryRestrictions: cleanText(body.dietaryRestrictions || guest.dietaryRestrictions || 'none', 80),
    rsvpStatus,
    rsvpDate: rsvpStatus === 'pending' ? guest.rsvpDate || null : now,
    rsvpNotes: cleanText(body.rsvpNotes || body.notes || ''),
    eventResponses: { ...(guest.eventResponses || {}), ...eventResponses },
    events: normalizeEvents(guest.events || []).length ? normalizeEvents(guest.events) : invitedEvents.map(event => event.name),
    rsvpLockedAt: now,
    updatedAt: now
  };
  guests[index] = updatedGuest;
  await kv.set(guestsKey, guests);
  updatedGuest = await sendAndStoreRsvpConfirmations(guestsKey, guests, updatedGuest);
  return res.status(200).json({ success: true, message: 'RSVP received', guest: publicGuest(updatedGuest) });
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
    if (!token) return await handlePublicRsvp(req, res, body);
    return await handleTokenRsvp(req, res, url, body, token);
  } catch (error) {
    const status = error.statusCode || (/invalid|expired|missing/i.test(error.message) ? 401 : 500);
    return res.status(status).json({ error: error.message || 'Unable to process RSVP' });
  }
};
