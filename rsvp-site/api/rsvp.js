const crypto = require('crypto');

const WEDDING_ID = 'akhila-akshay-2026';
const RSVP_EVENTS = [
  { id: 'haldi', name: 'Haldi', date: '2026-08-28', displayDate: '28 August 2026', time: '11:00 AM', subtitle: 'Turmeric, blessings, and family ritual', venue: process.env.COMMON_EVENT_ADDRESS || 'Venue To Be Confirmed' },
  { id: 'sangeet', name: 'Sangeet', date: '2026-08-28', displayDate: '28 August 2026', time: '6:00 PM', subtitle: 'Music, family, and dance', venue: process.env.COMMON_EVENT_ADDRESS || 'Venue To Be Confirmed' },
  { id: 'pellikuthuru', name: 'Pellikuthuru', date: '2026-08-29', displayDate: '29 August 2026', time: 'Time To Be Decided', subtitle: 'Nalugu and blessings', venue: process.env.COMMON_EVENT_ADDRESS || 'Venue To Be Confirmed' },
  { id: 'marriage', name: 'Marriage', date: '2026-08-30', displayDate: '30 August 2026', time: '11:00 AM', subtitle: 'Jeelakarra Bellam and Talambralu', venue: process.env.COMMON_EVENT_ADDRESS || 'Venue To Be Confirmed', mealPolicy: 'vegetarian-only' },
  { id: 'satyanarayana-swamy-vratam', name: 'Satyanarayana Swamy Vratam', date: '2026-08-31', displayDate: '31 August 2026', time: 'Time To Be Decided', subtitle: 'Post-wedding pooja', venue: process.env.COMMON_EVENT_ADDRESS || 'Venue To Be Confirmed', mealPolicy: 'vegetarian-only' }
];

function getStorageConfig() {
  return {
    url: process.env.VERCEL_KV_REST_API_URL || process.env.KV_REST_API_URL,
    token: process.env.VERCEL_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN
  };
}

async function getGuests() {
  const { url, token } = getStorageConfig();
  if (!url || !token) throw httpError('RSVP storage is not configured yet.', 503);
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['GET', `wedding:${WEDDING_ID}:guests`]])
  });
  if (!response.ok) throw httpError('Unable to load guest records.', 503);
  const result = await response.json();
  const value = result[0]?.result;
  return value ? JSON.parse(value) : [];
}

async function saveGuests(guests) {
  const { url, token } = getStorageConfig();
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', `wedding:${WEDDING_ID}:guests`, JSON.stringify(guests)]])
  });
  if (!response.ok) throw httpError('Unable to save your RSVP. Please try again.', 503);
}

function clean(value, length = 1000) { return String(value || '').trim().slice(0, length); }
function email(value) { return clean(value, 254).toLowerCase(); }
function phone(value) { return clean(value, 40).replace(/\D/g, ''); }
function nameKey(value) { return clean(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function count(value) { return Math.max(0, parseInt(value, 10) || 0); }
function httpError(message, statusCode) { const error = new Error(message); error.statusCode = statusCode; return error; }

function validate(body) {
  const name = clean(body.name, 160), guestEmail = email(body.email), guestPhone = phone(body.phone);
  if (!name || !guestEmail || !guestPhone) throw httpError('Name, phone number, and email are required.', 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)) throw httpError('Enter a valid email address.', 400);
  if (guestPhone.length < 7) throw httpError('Enter a valid phone number.', 400);
  const source = body.eventResponses || {};
  const eventResponses = {};
  RSVP_EVENTS.forEach(event => {
    const raw = source[event.name];
    if (!raw) throw httpError(`Please answer for ${event.name}.`, 400);
    const response = String(raw.response || '').toLowerCase();
    if (!['attending', 'maybe', 'not_attending'].includes(response)) throw httpError(`Choose Yes, Maybe, or No for ${event.name}.`, 400);
    const attendanceCount = response === 'attending' ? count(raw.attendanceCount) : 0;
    let vegetarianCount = response === 'attending' ? count(raw.vegetarianCount) : 0;
    let nonVegetarianCount = response === 'attending' ? count(raw.nonVegetarianCount) : 0;
    if (response === 'attending' && attendanceCount < 1) throw httpError(`Enter the number attending ${event.name}.`, 400);
    if (event.mealPolicy === 'vegetarian-only') { vegetarianCount = attendanceCount; nonVegetarianCount = 0; }
    if (response === 'attending' && vegetarianCount + nonVegetarianCount !== attendanceCount) {
      throw httpError(`Vegetarian and non-vegetarian meals must equal the attendees for ${event.name}.`, 400);
    }
    eventResponses[event.name] = { response, attendanceCount, vegetarianCount, nonVegetarianCount };
  });
  return { name, email: guestEmail, phone: guestPhone, eventResponses, rsvpNotes: clean(body.rsvpNotes, 1000) };
}

function findMatch(guests, submission) {
  const matches = new Set();
  guests.forEach(guest => {
    if (email(guest.email) === submission.email) matches.add(guest.id);
    if (phone(guest.phone) === submission.phone) matches.add(guest.id);
    if (nameKey(guest.name) === nameKey(submission.name)) matches.add(guest.id);
  });
  if (matches.size > 1) throw httpError('We found more than one guest record with these details. Please contact the family.', 409);
  return matches.size ? guests.find(guest => guest.id === [...matches][0]) : null;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); return res.status(204).end(); }
    if (req.method === 'GET') return res.status(200).json({ success: true, events: RSVP_EVENTS });
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET,POST,OPTIONS'); return res.status(405).json({ error: 'Method not allowed' }); }
    const submission = validate(typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {});
    const guests = await getGuests();
    const existing = findMatch(guests, submission);
    if (existing?.rsvpLockedAt) return res.status(409).json({ error: 'Your RSVP has already been received. Please contact the family for any changes.' });
    const now = new Date().toISOString();
    const responses = Object.values(submission.eventResponses);
    const rsvpStatus = responses.some(item => item.response === 'attending') ? 'accepted' : responses.some(item => item.response === 'maybe') ? 'maybe' : 'declined';
    const updates = { ...submission, partySize: Math.max(1, ...responses.map(item => item.attendanceCount)), rsvpStatus, rsvpDate: now, lastRsvpSource: 'public_rsvp', rsvpLockedAt: now, updatedAt: now };
    let guest;
    if (existing) {
      const index = guests.findIndex(item => item.id === existing.id);
      guest = { ...existing, ...updates };
      guests[index] = guest;
    } else {
      guest = { id: crypto.randomBytes(8).toString('hex'), weddingId: WEDDING_ID, relationship: '', side: '', dietaryRestrictions: 'none', notes: '', events: RSVP_EVENTS.map(event => event.name), invitedDate: null, source: 'public_rsvp', createdAt: now, ...updates };
      guests.push(guest);
    }
    await saveGuests(guests);
    return res.status(200).json({ success: true, message: 'Your RSVP has been received. Thank you for celebrating with Akhila and Akshay.' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Unable to process RSVP' });
  }
};
