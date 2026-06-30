const crypto = require('crypto');

const WEDDING_ID = 'akhila-akshay-2026';
const EVENT_TIMEZONE = process.env.WEDDING_TIMEZONE || 'America/Chicago';
const COMMON_EVENT_ADDRESS = process.env.COMMON_EVENT_ADDRESS || process.env.WEDDING_COMMON_ADDRESS || 'Venue To Be Confirmed';
const SANGEETH_EVENT_ADDRESS = process.env.SANGEETH_EVENT_ADDRESS || 'Metroplex Event Center, 2305 S. 8th St., Rogers, AR 72758';
const SANGEETH_MAP_URL = process.env.SANGEETH_MAP_URL || 'https://maps.app.goo.gl/mthgUzW9rQT5HZrF9';
const RSVP_EVENTS = [
  {
    id: 'haldi',
    name: 'Haldi',
    subtitle: 'Turmeric, blessings, and family ritual',
    date: '2026-08-28',
    displayDate: '28 August 2026',
    time: '11:00 AM',
    startTime: '11:00:00',
    durationMinutes: 120,
    venue: COMMON_EVENT_ADDRESS
  },
  {
    id: 'sangeet',
    name: 'Sangeet',
    displayName: 'Sangeeth',
    subtitle: 'Music, family, and dance',
    date: '2026-08-28',
    displayDate: '28 August 2026',
    time: '6:00 PM',
    startTime: '18:00:00',
    durationMinutes: 240,
    venue: SANGEETH_EVENT_ADDRESS,
    mapUrl: SANGEETH_MAP_URL
  },
  {
    id: 'pellikuthuru',
    name: 'Pellikuthuru',
    displayName: 'Pellikuthuru / Pellikoduku',
    subtitle: 'Nalugu and blessings',
    date: '2026-08-29',
    displayDate: '29 August 2026',
    time: 'Time To Be Decided',
    startTime: null,
    durationMinutes: null,
    venue: COMMON_EVENT_ADDRESS
  },
  {
    id: 'marriage',
    name: 'Marriage',
    mealPolicy: 'vegetarian-only',
    subtitle: 'Jeelakarra Bellam and Talambralu',
    date: '2026-08-30',
    displayDate: '30 August 2026',
    time: '11:00 AM',
    startTime: '11:00:00',
    durationMinutes: 180,
    venue: COMMON_EVENT_ADDRESS
  },
  {
    id: 'satyanarayana-swamy-vratam',
    name: 'Satyanarayana Swamy Vratam',
    mealPolicy: 'vegetarian-only',
    subtitle: 'Post-wedding pooja',
    date: '2026-08-31',
    displayDate: '31 August 2026',
    time: 'Time To Be Decided',
    startTime: null,
    durationMinutes: null,
    venue: COMMON_EVENT_ADDRESS
  }
];

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlDecode(value) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function getRsvpSecret() {
  return process.env.RSVP_SECRET || process.env.JWT_SECRET || 'local-dev-rsvp-secret-change-before-production';
}

function signTokenPayload(payload) {
  return base64url(crypto.createHmac('sha256', getRsvpSecret()).update(payload).digest());
}

function createRsvpToken(guest, options = {}) {
  const expiresInDays = options.expiresInDays || 365;
  const payload = base64url(JSON.stringify({
    typ: 'rsvp',
    weddingId: WEDDING_ID,
    guestId: guest.id,
    exp: Math.floor(Date.now() / 1000) + expiresInDays * 86400
  }));
  const signature = signTokenPayload(payload);
  return `${payload}.${signature}`;
}

function verifyRsvpToken(token) {
  if (!token || !String(token).includes('.')) {
    throw new Error('Invalid RSVP link');
  }

  const [payload, signature] = String(token).split('.');
  const expected = signTokenPayload(payload);
  const providedBuffer = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Invalid RSVP link');
  }

  const decoded = JSON.parse(base64urlDecode(payload));
  if (decoded.typ !== 'rsvp' || decoded.weddingId !== WEDDING_ID || !decoded.guestId) {
    throw new Error('Invalid RSVP link');
  }
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('RSVP link expired');
  }
  return decoded;
}

function buildRsvpUrl(siteUrl, guest) {
  const publicRsvpSiteUrl = String(process.env.RSVP_SITE_URL || '').trim();
  const base = String(publicRsvpSiteUrl || siteUrl || '').replace(/\/+$/g, '') || 'http://localhost:3000';
  const token = createRsvpToken(guest);
  const path = publicRsvpSiteUrl ? '/' : '/rsvp.html';
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

function buildCalendarUrl(siteUrl, guest) {
  const publicRsvpSiteUrl = String(process.env.RSVP_SITE_URL || '').trim();
  const base = String(publicRsvpSiteUrl || siteUrl || '').replace(/\/+$/g, '') || 'http://localhost:3000';
  const token = createRsvpToken(guest);
  return `${base}/api/rsvp?action=calendar&token=${encodeURIComponent(token)}`;
}

function normalizeEventName(value) {
  const text = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return '';
  if (text.includes('haldi')) return 'Haldi';
  if (text.includes('sangeeth') || text.includes('sangeet')) return 'Sangeet';
  if (text.includes('pellikoduku') || text.includes('pelli koduku') || text.includes('pellikuthuru') || text.includes('pelli kuthuru') || text.includes('nalugu') || text.includes('mehendi')) return 'Pellikuthuru';
  if (text.includes('satyanarayana') || text.includes('vratam')) return 'Satyanarayana Swamy Vratam';
  if (text.includes('marriage') || text.includes('wedding') || text.includes('ceremony')) return 'Marriage';
  return '';
}

function getAllEventNames() {
  return RSVP_EVENTS.map(event => event.name);
}

const EVENT_ALIASES = [
  { name: 'Haldi', pattern: /\bhaldi\b/i },
  { name: 'Sangeet', pattern: /\bsangeeth?\b/i },
  { name: 'Pellikuthuru', pattern: /\b(pellikuthuru|pelli\s*kuthuru|pellikoduku|pelli\s*koduku|nalugu|mehendi)\b/i },
  { name: 'Marriage', pattern: /\b(marriage|wedding|ceremony|muhurtham)\b/i },
  { name: 'Satyanarayana Swamy Vratam', pattern: /\b(satyanarayana|vratam)\b/i }
];

function normalizeEvents(events) {
  if (Array.isArray(events)) {
    return [...new Set(events.flatMap(event => normalizeEvents(event)))];
  }

  const text = String(events || '').trim();
  if (!text) return [];

  if (/^(all|all events|all ceremonies|all functions|all festivities|every event|full)$/i.test(text)) {
    return getAllEventNames();
  }

  const found = EVENT_ALIASES
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => name);
  if (found.length > 0) return [...new Set(found)];

  return [...new Set(
    text
      .split(/[|;,+/&\n]/)
      .map(normalizeEventName)
      .filter(Boolean)
  )];
}

function getInvitedEvents(guest) {
  const names = normalizeEvents(guest?.events || []);
  const events = names.length === 0
    ? RSVP_EVENTS
    : RSVP_EVENTS.filter(event => names.includes(event.name));

  return events.map(event => {
    if (event.id !== 'pellikuthuru') return event;
    return {
      ...event,
      displayName: 'Pellikuthuru / Pellikoduku',
      subtitle: 'Nalugu and blessings'
    };
  });
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatIcsDate(date) {
  return date.replace(/-/g, '');
}

function formatIcsTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function addMinutes(date, time, minutes) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));
  local.setUTCMinutes(local.getUTCMinutes() + minutes);
  return `${local.getUTCFullYear()}${String(local.getUTCMonth() + 1).padStart(2, '0')}${String(local.getUTCDate()).padStart(2, '0')}T${String(local.getUTCHours()).padStart(2, '0')}${String(local.getUTCMinutes()).padStart(2, '0')}${String(local.getUTCSeconds()).padStart(2, '0')}`;
}

function buildCalendarFile(guest) {
  const stamp = formatIcsTimestamp();
  const events = getInvitedEvents(guest);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Akhila Akshay Wedding//RSVP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText('Akhila & Akshay Wedding')}`
  ];

  events.forEach(event => {
    const uid = `${event.id}-${guest.id}@akhila-akshay-wedding`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    const eventName = event.displayName || event.name;
    lines.push(`SUMMARY:${escapeIcsText(`Akhila & Akshay: ${eventName}`)}`);
    if (event.startTime) {
      const start = `${formatIcsDate(event.date)}T${event.startTime.replace(/:/g, '')}`;
      const end = addMinutes(event.date, event.startTime, event.durationMinutes || 120);
      lines.push(`DTSTART;TZID=${EVENT_TIMEZONE}:${start}`);
      lines.push(`DTEND;TZID=${EVENT_TIMEZONE}:${end}`);
    } else {
      const start = formatIcsDate(event.date);
      const endDate = new Date(`${event.date}T00:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const end = `${endDate.getUTCFullYear()}${String(endDate.getUTCMonth() + 1).padStart(2, '0')}${String(endDate.getUTCDate()).padStart(2, '0')}`;
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${end}`);
    }
    lines.push(`LOCATION:${escapeIcsText(event.venue)}`);
    const mapLine = event.mapUrl ? `\nMap: ${event.mapUrl}` : '';
    lines.push(`DESCRIPTION:${escapeIcsText(`${event.displayDate} · ${event.time}\n${event.subtitle}\nVenue: ${event.venue}${mapLine}`)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

module.exports = {
  WEDDING_ID,
  RSVP_EVENTS,
  EVENT_TIMEZONE,
  createRsvpToken,
  verifyRsvpToken,
  buildRsvpUrl,
  buildCalendarUrl,
  buildCalendarFile,
  getInvitedEvents,
  normalizeEventName,
  normalizeEvents
};
