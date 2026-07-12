/**
 * Guest Management API Endpoints (No Authentication)
 * GET /api/guests - List guests with filters/search
 * POST /api/guests - Add new guest
 * PUT /api/guests/:id - Update guest or RSVP status
 * DELETE /api/guests/:id - Remove guest
 * POST /api/guests/bulk-invite - Send bulk RSVP invitations
 * POST /api/guests/bulk-reminder - Send accepted guest event reminders
 * GET /api/guests/export - Export guests as CSV
 */

const crypto = require('crypto');
const kv = require('../lib/kv');
const {
  EVENT_TIMEZONE,
  RSVP_EVENTS,
  buildRsvpUrl,
  buildCalendarUrl,
  getInvitedEvents,
  normalizeEvents
} = require('../lib/rsvp');
const { buildGmailRawMessage } = require('../lib/rsvp-confirmations');

// Fixed wedding ID for Akhila & Akshay's wedding
const WEDDING_ID = 'akhila-akshay-2026';

function allGuestEventNames() {
  return RSVP_EVENTS.map(event => event.name);
}

function ensureGuestEvents(events) {
  const normalized = normalizeEvents(events);
  return normalized.length > 0 ? normalized : allGuestEventNames();
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET' && (req.url.includes('action=export') || req.url.includes('/export'))) {
      return handleExportGuests(req, res);
    }

    if (req.method === 'GET' && req.url.includes('action=rsvp-summary')) {
      return handleRsvpSummary(req, res);
    }

    if (req.method === 'DELETE' && (req.url.includes('action=reset') || req.url.includes('/reset'))) {
      return handleResetGuests(req, res);
    }

    if (req.method === 'GET' && req.url.includes('/guests')) {
      return handleListGuests(req, res);
    }

    if (req.method === 'POST' && (req.url.includes('action=bulk-invite') || req.url.includes('/bulk-invite'))) {
      return handleBulkInvite(req, res);
    }

    if (req.method === 'POST' && (req.url.includes('action=bulk-reminder') || req.url.includes('/bulk-reminder'))) {
      return handleBulkReminder(req, res);
    }

    if (req.method === 'POST' && (req.url.includes('action=import') || req.url.includes('/import'))) {
      return handleImportGuests(req, res);
    }

    if (req.method === 'POST' && req.url.includes('/guests') && !req.url.includes('/export')) {
      return handleAddGuest(req, res);
    }

    if (req.method === 'PUT') {
      return handleUpdateGuest(req, res);
    }

    if (req.method === 'DELETE') {
      return handleDeleteGuest(req, res);
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
  // Get all guests for this wedding
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];

  // Apply filters from query string
  const url = new URL(req.url, 'http://localhost');
  const rsvpStatus = url.searchParams.get('rsvpStatus');
  const search = url.searchParams.get('search')?.toLowerCase();
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
      g.phone?.includes(search) ||
      normalizeEvents(g.events || []).join(' ').toLowerCase().includes(search)
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
    stats,
    publicRsvpUrl: getPublicRsvpUrl(req)
  });
}

function normalizeStoredEventResponse(value, fallbackStatus = 'pending') {
  const raw = value && typeof value === 'object' ? value : { response: value };
  const responseValue = String(raw.response || raw.status || '').trim().toLowerCase();
  const response = ['attending', 'yes', 'accepted'].includes(responseValue)
    ? 'attending'
    : ['maybe', 'tentative'].includes(responseValue)
      ? 'maybe'
      : ['not_attending', 'not-attending', 'no', 'declined'].includes(responseValue)
        ? 'not_attending'
        : fallbackStatus === 'accepted' ? 'attending' : fallbackStatus === 'maybe' ? 'maybe' : fallbackStatus === 'declined' ? 'not_attending' : 'pending';
  return {
    response,
    attendanceCount: response === 'attending' ? Math.max(0, parseInt(raw.attendanceCount ?? raw.attendees, 10) || 0) : 0,
    vegetarianCount: response === 'attending' ? Math.max(0, parseInt(raw.vegetarianCount ?? raw.vegetarian, 10) || 0) : 0,
    nonVegetarianCount: response === 'attending' ? Math.max(0, parseInt(raw.nonVegetarianCount ?? raw.nonVegetarian, 10) || 0) : 0
  };
}

async function handleRsvpSummary(req, res) {
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const events = RSVP_EVENTS.map(event => ({
    id: event.id,
    name: event.name,
    mealPolicy: event.mealPolicy || 'mixed',
    confirmedGuests: 0,
    vegetarianMeals: 0,
    nonVegetarianMeals: 0,
    maybeGuests: 0,
    respondedGuests: 0
  }));

  guests.forEach(guest => {
    events.forEach(summary => {
      const rawResponse = guest.eventResponses?.[summary.name];
      // Older guest-level RSVPs did not identify individual events or meals;
      // leave them out of catering totals until a per-event response is recorded.
      const response = normalizeStoredEventResponse(rawResponse, rawResponse === undefined ? 'pending' : guest.rsvpStatus);
      if (response.response === 'attending') {
        const attendanceCount = response.attendanceCount || Math.max(1, parseInt(guest.partySize, 10) || 1);
        summary.confirmedGuests += attendanceCount;
        summary.vegetarianMeals += response.vegetarianCount;
        summary.nonVegetarianMeals += response.nonVegetarianCount;
        summary.respondedGuests++;
      } else if (response.response === 'maybe') {
        summary.maybeGuests++;
        summary.respondedGuests++;
      } else if (response.response === 'not_attending') {
        summary.respondedGuests++;
      }
    });
  });

  res.json({ events });
}

async function handleAddGuest(req, res) {
  const { name, email, phone, relationship, partySize, dietaryRestrictions, notes, events, eventResponses, rsvpStatus } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Guest name required' });
  }

  const guestId = crypto.randomBytes(8).toString('hex');
  const guest = {
    id: guestId,
    weddingId: WEDDING_ID,
    name,
    email: email || '',
    phone: phone || '',
    relationship: relationship || '',
    partySize: partySize || 1,
    dietaryRestrictions: dietaryRestrictions || 'none',
    notes: notes || '',
    events: ensureGuestEvents(events),
    eventResponses: eventResponses && typeof eventResponses === 'object' ? eventResponses : {},
    rsvpStatus: rsvpStatus || 'pending',
    invitedDate: null,
    lastInviteAttemptDate: null,
    lastInviteError: '',
    lastReminderAttemptDate: null,
    lastReminderSentDate: null,
    lastReminderError: '',
    rsvpDate: rsvpStatus && rsvpStatus !== 'pending' ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to guests list
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  guests.push(guest);
  await kv.set(guestsKey, guests);

  res.status(201).json(guest);
}

async function handleUpdateGuest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const guestId = url.searchParams.get('id') || req.url.match(/\/guests\/([a-zA-Z0-9_]+)/)?.[1];

  // Get current guest
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const guestIndex = guests.findIndex(g => g.id === guestId);

  if (guestIndex === -1) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  const guest = guests[guestIndex];

  // Update fields
  const { name, email, phone, relationship, partySize, dietaryRestrictions, notes, rsvpStatus, events, eventResponses } = req.body;

  if (name !== undefined) guest.name = name;
  if (email !== undefined) guest.email = email;
  if (phone !== undefined) guest.phone = phone;
  if (relationship !== undefined) guest.relationship = relationship;
  if (partySize !== undefined) guest.partySize = partySize;
  if (dietaryRestrictions !== undefined) guest.dietaryRestrictions = dietaryRestrictions;
  if (notes !== undefined) guest.notes = notes;
  if (events !== undefined) guest.events = ensureGuestEvents(events);
  if (eventResponses !== undefined && eventResponses && typeof eventResponses === 'object') guest.eventResponses = eventResponses;

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

async function handleImportGuests(req, res) {
  const incoming = Array.isArray(req.body?.guests) ? req.body.guests : [];

  if (incoming.length === 0) {
    return res.status(400).json({ error: 'No guests to import' });
  }

  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const now = new Date().toISOString();
  const importedGuests = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  incoming.forEach(rawGuest => {
    const guestData = normalizeImportedGuest(rawGuest);
    if (!guestData.name) {
      skipped++;
      return;
    }

    const existingIndex = guests.findIndex(existing => guestMatches(existing, guestData));

    if (existingIndex !== -1) {
      const current = guests[existingIndex];
      guests[existingIndex] = {
        ...current,
        ...compactGuestFields(guestData),
        id: current.id,
        weddingId: current.weddingId || WEDDING_ID,
        rsvpStatus: guestData.rsvpStatus || current.rsvpStatus || 'pending',
        invitedDate: current.invitedDate || null,
        lastInviteAttemptDate: current.lastInviteAttemptDate || null,
        lastInviteError: current.lastInviteError || '',
        lastReminderAttemptDate: current.lastReminderAttemptDate || null,
        lastReminderSentDate: current.lastReminderSentDate || null,
        lastReminderError: current.lastReminderError || '',
        createdAt: current.createdAt || now,
        updatedAt: now
      };
      importedGuests.push(guests[existingIndex]);
      updated++;
      return;
    }

    const guest = {
      id: crypto.randomBytes(8).toString('hex'),
      weddingId: WEDDING_ID,
      name: guestData.name,
      email: guestData.email || '',
      phone: guestData.phone || '',
      relationship: guestData.relationship || '',
      partySize: guestData.partySize || 1,
      dietaryRestrictions: guestData.dietaryRestrictions || 'none',
      events: guestData.events?.length ? guestData.events : allGuestEventNames(),
      notes: guestData.notes || '',
      rsvpStatus: guestData.rsvpStatus || 'pending',
      invitedDate: null,
      lastInviteAttemptDate: null,
      lastInviteError: '',
      lastReminderAttemptDate: null,
      lastReminderSentDate: null,
      lastReminderError: '',
      rsvpDate: null,
      createdAt: now,
      updatedAt: now
    };

    guests.push(guest);
    importedGuests.push(guest);
    added++;
  });

  await kv.set(guestsKey, guests);

  res.status(200).json({
    success: true,
    added,
    updated,
    skipped,
    importedCount: importedGuests.length,
    guests: importedGuests
  });
}

function normalizeImportedGuest(rawGuest = {}) {
  const events = normalizeEvents(rawGuest.events);

  return {
    name: String(rawGuest.name || '').trim(),
    email: String(rawGuest.email || '').trim(),
    phone: String(rawGuest.phone || '').trim(),
    relationship: String(rawGuest.relationship || '').trim(),
    partySize: Math.max(1, parseInt(rawGuest.partySize, 10) || 1),
    dietaryRestrictions: normalizeDietary(rawGuest.dietaryRestrictions),
    events,
    notes: String(rawGuest.notes || '').trim(),
    rsvpStatus: normalizeRsvpStatus(rawGuest.rsvpStatus)
  };
}

function compactGuestFields(guest) {
  return Object.fromEntries(
    Object.entries(guest).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    })
  );
}

function guestMatches(existing, guest) {
  const existingEmail = String(existing.email || '').trim().toLowerCase();
  const guestEmail = String(guest.email || '').trim().toLowerCase();
  if (existingEmail && guestEmail && existingEmail === guestEmail) return true;

  const existingPhone = String(existing.phone || '').replace(/\D/g, '');
  const guestPhone = String(guest.phone || '').replace(/\D/g, '');
  if (existingPhone && guestPhone && existingPhone === guestPhone) return true;

  return String(existing.name || '').trim().toLowerCase() === String(guest.name || '').trim().toLowerCase();
}

function normalizeDietary(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'none';
  if (text.includes('non') || text.includes('chicken') || text.includes('meat')) return 'non-vegetarian';
  if (text.includes('vegan')) return 'vegan';
  if (text.includes('veg')) return 'vegetarian';
  if (text.includes('gluten')) return 'gluten-free';
  if (text.includes('apane') || text.includes('family')) return 'apane';
  if (text === 'none' || text === 'no' || text === 'na' || text === 'n/a') return 'none';
  return 'other';
}

function normalizeRsvpStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['accepted', 'accept', 'yes', 'attending', 'confirmed'].includes(text)) return 'accepted';
  if (['declined', 'decline', 'no', 'not attending'].includes(text)) return 'declined';
  if (['maybe', 'tentative'].includes(text)) return 'maybe';
  return 'pending';
}

function getSiteUrl(req) {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/+$/g, '');
  }

  const forwardedHost = req.headers?.['x-forwarded-host'];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers?.host;
  if (host) {
    const forwardedProto = req.headers?.['x-forwarded-proto'];
    const proto = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || (String(host).includes('localhost') ? 'http' : 'https');
    return `${proto}://${host}`.replace(/\/+$/g, '');
  }

  return 'https://wedding-planning-two.vercel.app';
}

function getPublicRsvpUrl(req) {
  const configured = String(process.env.RSVP_SITE_URL || '').trim().replace(/\/+$/g, '');
  return configured ? `${configured}/` : `${getSiteUrl(req)}/rsvp.html`;
}

function getGmailConfiguration() {
  return {
    senderEmail: String(process.env.GMAIL_SENDER_EMAIL || '').trim(),
    senderName: String(process.env.GMAIL_SENDER_NAME || 'Akhila & Akshay').replace(/\s+/g, ' ').trim(),
    clientId: String(process.env.GMAIL_OAUTH_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.GMAIL_OAUTH_CLIENT_SECRET || '').trim(),
    refreshToken: String(process.env.GMAIL_OAUTH_REFRESH_TOKEN || '').trim()
  };
}

function getMissingGmailConfig(config) {
  return [
    ['GMAIL_SENDER_EMAIL', config.senderEmail],
    ['GMAIL_OAUTH_CLIENT_ID', config.clientId],
    ['GMAIL_OAUTH_CLIENT_SECRET', config.clientSecret],
    ['GMAIL_OAUTH_REFRESH_TOKEN', config.refreshToken]
  ].filter(([, value]) => !value).map(([name]) => name);
}

function parseEmailProviderError(errorText, fallback = 'Email send failed') {
  let message = errorText;

  try {
    const parsed = JSON.parse(errorText);
    message = parsed.message || parsed.error?.message || parsed.error || errorText;
  } catch (_) {
    // Email providers can return plain text for some failures.
  }

  return String(message || fallback).replace(/\s+/g, ' ').trim().slice(0, 220);
}

function buildInviteError(guest, error) {
  return {
    id: guest.id,
    name: guest.name || '',
    email: guest.email || '',
    error
  };
}

async function getGmailAccessToken(config) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  });

  if (!response.ok) {
    throw new Error(parseEmailProviderError(await response.text(), 'Unable to refresh Gmail authorization.'));
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error('Gmail did not return an access token.');
  }

  return payload.access_token;
}

async function sendGmailInviteEmail({ accessToken, config, guest, subject, html }) {
  const senderName = config.senderName.replace(/[\r\n<>]/g, '').trim() || 'Akhila & Akshay';
  const sender = `${senderName} <${config.senderEmail}>`;
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: buildGmailRawMessage({
        from: sender,
        to: guest.email,
        subject,
        html
      })
    })
  });

  if (!response.ok) {
    throw new Error(parseEmailProviderError(await response.text(), 'Gmail email send failed.'));
  }
}

async function handleDeleteGuest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const guestId = url.searchParams.get('id') || req.url.match(/\/guests\/([a-zA-Z0-9_]+)/)?.[1];

  // Remove from guests list
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];
  const filtered = guests.filter(g => g.id !== guestId);

  if (filtered.length === guests.length) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  await kv.set(guestsKey, filtered);

  res.json({ success: true, message: 'Guest deleted' });
}

async function handleBulkReminder(req, res) {
  const body = req.body || {};
  const reminderPasscode = String(body.passcode || '').trim();
  if (reminderPasscode !== '291097') {
    return res.status(403).json({ error: 'Invalid bulk reminder passcode' });
  }

  const { subject = '', message = '' } = body;
  const guestIds = body.guestIds;

  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];

  let selectedGuests;
  if (Array.isArray(guestIds) && guestIds.length > 0) {
    selectedGuests = guests.filter(g => guestIds.includes(g.id) && g.rsvpStatus === 'accepted');
  } else {
    selectedGuests = guests.filter(g => g.rsvpStatus === 'accepted');
  }

  if (selectedGuests.length === 0) {
    return res.status(404).json({ error: 'No accepted guests to remind' });
  }

  const withEmail = selectedGuests.filter(g => String(g.email || '').trim());
  const now = new Date().toISOString();
  const SITE_URL = getSiteUrl(req);
  const gmailConfig = getGmailConfiguration();
  const missingGmailConfig = getMissingGmailConfig(gmailConfig);
  const sendingEnabled = missingGmailConfig.length === 0;

  let sent = 0;
  let failed = 0;
  const sentGuestIds = new Set();
  const sentGuests = [];
  const errors = [];

  if (sendingEnabled && withEmail.length > 0) {
    try {
      const accessToken = await getGmailAccessToken(gmailConfig);
      for (const guest of withEmail) {
        const finalSubject = subject || `Wedding details reminder - Akhila & Akshay`;
        const calendarUrl = buildCalendarUrl(SITE_URL, guest);
        const html = buildReminderHtml(guest, message, { calendarUrl });
        try {
          await sendGmailInviteEmail({
            accessToken,
            config: gmailConfig,
            guest,
            subject: finalSubject,
            html
          });
          sent++;
          sentGuestIds.add(guest.id);
          sentGuests.push({ id: guest.id, name: guest.name, email: guest.email });
        } catch (error) {
          failed += 1;
          errors.push(buildInviteError(guest, error.message));
        }
      }
    } catch (error) {
      failed = withEmail.length;
      withEmail.forEach(guest => errors.push(buildInviteError(guest, error.message)));
    }
  }

  withEmail.forEach(guest => {
    const index = guests.findIndex(item => item.id === guest.id);
    if (index === -1) return;

    const guestError = errors.find(error => error.id === guest.id);
    guests[index].lastReminderAttemptDate = now;

    if (sentGuestIds.has(guest.id)) {
      guests[index].lastReminderSentDate = now;
      guests[index].lastReminderError = '';
      guests[index].updatedAt = now;
      return;
    }

    if (guestError) {
      guests[index].lastReminderError = guestError.error || 'Reminder failed';
      guests[index].updatedAt = now;
    }
  });
  await kv.set(guestsKey, guests);

  const skippedNoEmail = selectedGuests.length - withEmail.length;
  const firstError = errors[0];
  const failedWho = firstError ? firstError.name || firstError.email : '';
  const sentMessage = failed
    ? `Sent ${sent} of ${withEmail.length} reminders. ${failed} failed${failedWho ? `: ${failedWho}` : ''}${firstError?.error ? ` - ${firstError.error}` : ''}`
    : `Sent ${sent} of ${withEmail.length} reminders${skippedNoEmail ? `; skipped ${skippedNoEmail} without email` : ''}`;
  const missingConfigMessage = `Preview only - ${withEmail.length} reminders prepared${skippedNoEmail ? `; skipped ${skippedNoEmail} without email` : ''}. Add Gmail env vars on Vercel to actually send: ${missingGmailConfig.join(', ')}.`;

  res.json({
    success: sendingEnabled ? failed === 0 : true,
    sendingEnabled,
    provider: 'gmail',
    configError: missingGmailConfig.length ? 'GMAIL' : '',
    message: sendingEnabled ? sentMessage : missingConfigMessage,
    reminderCount: withEmail.length,
    totalMatched: selectedGuests.length,
    skippedNoEmail,
    sent,
    failed,
    errors: errors.slice(0, 5),
    sentGuests,
    remindedGuests: withEmail.map(g => ({ id: g.id, name: g.name, email: g.email }))
  });
}

async function handleBulkInvite(req, res) {
  const body = req.body || {};
  const { filterStatus = 'all', subject = '', message = '' } = body;
  let guestIds = body.guestIds;

  // Get guests
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];

  // If no explicit IDs, derive from filter
  let selectedGuests;
  if (Array.isArray(guestIds) && guestIds.length > 0) {
    selectedGuests = guests.filter(g => guestIds.includes(g.id));
  } else {
    selectedGuests = filterStatus === 'all'
      ? guests
      : guests.filter(g => g.rsvpStatus === filterStatus);
  }

  if (selectedGuests.length === 0) {
    return res.status(404).json({ error: 'No matching guests' });
  }

  const withEmail = selectedGuests.filter(g => g.email);
  const now = new Date().toISOString();

  const SITE_URL = getSiteUrl(req);
  const gmailConfig = getGmailConfiguration();
  const missingGmailConfig = getMissingGmailConfig(gmailConfig);
  const sendingEnabled = missingGmailConfig.length === 0;

  let sent = 0;
  let failed = 0;
  const sentGuestIds = new Set();
  const sentGuests = [];
  const errors = [];

  if (sendingEnabled && withEmail.length > 0) {
    try {
      const accessToken = await getGmailAccessToken(gmailConfig);
      for (const g of withEmail) {
        const finalSubject = subject || `RSVP requested - Akhila & Akshay's Wedding`;
        const rsvpUrl = buildRsvpUrl(SITE_URL, g);
        const calendarUrl = buildCalendarUrl(SITE_URL, g);
        const html = buildInviteHtml(g, message, { rsvpUrl, calendarUrl });
        try {
          await sendGmailInviteEmail({
            accessToken,
            config: gmailConfig,
            guest: g,
            subject: finalSubject,
            html
          });
          sent++;
          sentGuestIds.add(g.id);
          sentGuests.push({ id: g.id, name: g.name, email: g.email });
        } catch (error) {
          failed += 1;
          errors.push(buildInviteError(g, error.message));
        }
      }
    } catch (error) {
      failed = withEmail.length;
      withEmail.forEach(g => errors.push(buildInviteError(g, error.message)));
    }
  }

  // Track invite attempts; invitedDate means the email actually sent.
  withEmail.forEach(g => {
    const idx = guests.findIndex(x => x.id === g.id);
    if (idx === -1) return;

    const guestError = errors.find(error => error.id === g.id);
    guests[idx].lastInviteAttemptDate = now;

    if (sentGuestIds.has(g.id)) {
      guests[idx].invitedDate = now;
      guests[idx].lastInviteError = '';
      guests[idx].updatedAt = now;
      return;
    }

    if (guestError) {
      guests[idx].lastInviteError = guestError.error || 'Invite failed';
      guests[idx].updatedAt = now;
    }
  });
  await kv.set(guestsKey, guests);

  const firstError = errors[0];
  const failedWho = firstError ? firstError.name || firstError.email : '';
  const sentMessage = failed
    ? `Sent ${sent} of ${withEmail.length} invites. ${failed} failed${failedWho ? `: ${failedWho}` : ''}${firstError?.error ? ` - ${firstError.error}` : ''}`
    : `Sent ${sent} of ${withEmail.length} invites`;
  const missingConfigMessage = `Preview only - ${withEmail.length} invites prepared. Add Gmail env vars on Vercel to actually send: ${missingGmailConfig.join(', ')}.`;
  res.json({
    success: sendingEnabled ? failed === 0 : true,
    sendingEnabled,
    provider: 'gmail',
    configError: missingGmailConfig.length ? 'GMAIL' : '',
    message: sendingEnabled
      ? sentMessage
      : missingConfigMessage,
    invitedCount: withEmail.length,
    totalMatched: selectedGuests.length,
    sent, failed,
    errors: errors.slice(0, 5),
    sentGuests,
    invitedGuests: withEmail.map(g => ({ id: g.id, name: g.name, email: g.email }))
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function eventDisplayName(event) {
  return event.displayName || event.name;
}

function appendUrlParam(url, key, value) {
  const separator = String(url || '').includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function cleanGoogleText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatGoogleDate(date) {
  return String(date || '').replace(/-/g, '');
}

function nextGoogleDate(date) {
  const endDate = new Date(`${date}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return `${endDate.getUTCFullYear()}${String(endDate.getUTCMonth() + 1).padStart(2, '0')}${String(endDate.getUTCDate()).padStart(2, '0')}`;
}

function eventVenueText(event) {
  const locations = Array.isArray(event.locations) ? event.locations : [];
  if (!locations.length) return event.venue || 'Location to be confirmed';
  return locations
    .map(location => `${location.label}: ${location.venue || 'Location to be confirmed'}`)
    .join(' | ');
}

function eventMapText(event) {
  const locations = Array.isArray(event.locations) ? event.locations : [];
  if (!locations.length) return event.mapUrl ? `\nMap: ${event.mapUrl}` : '';
  const mapLines = locations
    .filter(location => location.mapUrl)
    .map(location => `${location.label} map: ${location.mapUrl}`);
  return mapLines.length ? `\n${mapLines.join('\n')}` : '';
}

function getEventResponse(guest, event) {
  const responses = guest?.eventResponses && typeof guest.eventResponses === 'object' ? guest.eventResponses : {};
  const raw = responses[event.name] || responses[event.displayName];
  return raw && typeof raw === 'object' ? raw.response : raw;
}

function getReminderEvents(guest) {
  const invitedEvents = getInvitedEvents(guest);
  const attendingEvents = invitedEvents.filter(event => getEventResponse(guest, event) === 'attending');
  return attendingEvents.length ? attendingEvents : invitedEvents;
}

function buildGoogleCalendarUrl(events) {
  const firstDate = events[0]?.date || RSVP_EVENTS[0].date;
  const lastDate = events[events.length - 1]?.date || firstDate;
  const details = events.map(event => {
    const eventName = eventDisplayName(event);
    const venue = eventVenueText(event);
    return `${eventName}\n${event.displayDate} ${event.time}\n${event.subtitle || ''}\nLocation: ${venue}${eventMapText(event)}`;
  }).join('\n\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Akhila & Akshay Wedding Celebrations`,
    dates: `${formatGoogleDate(firstDate)}/${nextGoogleDate(lastDate)}`,
    details: cleanGoogleText(details),
    location: 'Wedding events - see details',
    ctz: EVENT_TIMEZONE
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function calendarButtonHtml(url, label, variant = 'primary') {
  const primary = variant === 'primary';
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:10px 6px 0 0;padding:${primary ? '12px 18px' : '11px 16px'};background:${primary ? 'linear-gradient(135deg,#8c151a,#c89422)' : '#fff8e8'};border:1px solid #c89422;color:${primary ? '#fff8e8' : '#8c5f11'};text-decoration:none;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">${escapeHtml(label)}</a>`;
}

function buildReminderHtml(guest, customMessage, links) {
  const greeting = guest.name ? `Dear ${escapeHtml(guest.name)},` : 'Dear friend,';
  const extra = customMessage
    ? `<p style="font-size:15px;line-height:1.7;color:#4f3a28;margin:18px 0;">${escapeHtml(customMessage).replace(/\n/g,'<br>')}</p>`
    : '';
  const events = getReminderEvents(guest);
  const googleCalendarUrl = buildGoogleCalendarUrl(events);
  const eventRows = events.map(event => {
    return `<tr>
      <td style="padding:18px 0;border-bottom:1px solid rgba(184,134,11,0.18);vertical-align:top;">
        <strong style="font-family:Georgia,serif;font-size:22px;color:#281309;">${escapeHtml(eventDisplayName(event))}</strong><br>
        <span style="font-family:Arial,sans-serif;font-size:13px;line-height:1.65;color:#705843;">${escapeHtml(event.subtitle || '')}</span><br>
        <span style="display:block;margin-top:10px;font-family:Arial,sans-serif;font-size:13px;line-height:1.55;color:#4f3a28;">${escapeHtml(eventVenueText(event))}</span>
      </td>
      <td style="padding:18px 0;border-bottom:1px solid rgba(184,134,11,0.18);font-family:Arial,sans-serif;font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#8c5f11;text-align:right;vertical-align:top;white-space:nowrap;">
        ${escapeHtml(event.displayDate)}<br>${escapeHtml(event.time)}
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3dfb7;font-family:Georgia,'Cormorant Garamond',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3dfb7;padding:40px 20px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff8e8;border:1px solid #c89422;box-shadow:0 18px 46px rgba(70,35,10,0.18);">
        <tr><td style="padding:8px;background:linear-gradient(90deg,#8c151a,#c89422,#315a31);"></td></tr>
        <tr><td align="center" style="padding:42px 40px 28px;">
          <p style="font-family:Georgia,serif;font-size:15px;letter-spacing:0;color:#9f1d22;text-transform:none;margin:0 0 14px;">మా పెళ్లి వేడుక</p>
          <h1 style="font-family:Georgia,serif;font-size:44px;line-height:0.98;color:#281309;margin:0 0 10px;font-weight:400;letter-spacing:0;">
            Akhila <em style="color:#9f1d22;">&amp;</em> Akshay
          </h1>
          <p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:2.8px;color:#8c5f11;text-transform:uppercase;margin:0 0 24px;">28-31 August 2026</p>
          <div style="height:1px;background:linear-gradient(90deg,transparent,#c89422,transparent);width:70%;margin:0 auto 26px;"></div>
          <p style="font-size:17px;line-height:1.7;color:#281309;text-align:left;margin:18px 0;">${greeting}</p>
          <p style="font-size:17px;line-height:1.7;color:#4f3a28;text-align:left;margin:0 0 18px;">
            This is a warm reminder for the wedding celebrations you confirmed for Akhila and Akshay.
          </p>
          ${extra}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 24px;border-top:1px solid rgba(184,134,11,0.18);">
${eventRows}
          </table>
          <div style="text-align:left;margin:20px 0 0;">
            ${calendarButtonHtml(googleCalendarUrl, 'Add to Google Calendar')}
            ${calendarButtonHtml(links.calendarUrl, 'Add to Apple / Outlook Calendar')}
          </div>
          <p style="font-size:14px;line-height:1.7;color:#705843;text-align:left;margin:24px 0 0;">
            If anything changes, please contact the Chennaboina and Lenkalapally families so we can update the arrangements.
          </p>
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#9d8061;margin:28px 0 0;">With love, Chennaboina &amp; Lenkalapally Families</p>
        </td></tr>
        <tr><td style="padding:6px;background:linear-gradient(90deg,#8c151a,#c89422,#315a31);"></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildInviteHtml(guest, customMessage, links) {
  const greeting = guest.name ? `Dear ${escapeHtml(guest.name)},` : 'Dear friend,';
  const extra = customMessage
    ? `<p style="font-size:15px;line-height:1.7;color:#4f3a28;margin:18px 0;">${escapeHtml(customMessage).replace(/\n/g,'<br>')}</p>`
    : '';
  const yesUrl = appendUrlParam(links.rsvpUrl, 'quick', 'attending');
  const noUrl = appendUrlParam(links.rsvpUrl, 'quick', 'not_attending');
  const eventRows = getInvitedEvents(guest).map(event => `
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid rgba(184,134,11,0.18);vertical-align:top;">
                <strong style="font-family:Georgia,serif;font-size:19px;color:#281309;">${escapeHtml(eventDisplayName(event))}</strong><br>
                <span style="font-family:Arial,sans-serif;font-size:12px;line-height:1.55;color:#705843;">${escapeHtml(event.subtitle || '')}</span>
              </td>
              <td style="padding:14px 0;border-bottom:1px solid rgba(184,134,11,0.18);font-family:Arial,sans-serif;font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#8c5f11;text-align:right;vertical-align:top;">${escapeHtml(event.displayDate)}<br>${escapeHtml(event.time)}<br>
                <span style="display:inline-block;margin-top:8px;letter-spacing:1.2px;color:#705843;">RSVP</span><br>
                <a href="${escapeHtml(yesUrl)}" style="display:inline-block;margin-top:6px;padding:5px 8px;background:#e4f4e8;color:#1f6a35;text-decoration:none;letter-spacing:1px;">Yes</a>
                <a href="${escapeHtml(noUrl)}" style="display:inline-block;margin-top:6px;margin-left:4px;padding:5px 8px;background:#f8e2df;color:#9f1d22;text-decoration:none;letter-spacing:1px;">No</a>
              </td>
            </tr>`).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3dfb7;font-family:Georgia,'Cormorant Garamond',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3dfb7;padding:40px 20px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff8e8;border:1px solid #c89422;box-shadow:0 18px 46px rgba(70,35,10,0.18);">
        <tr><td style="padding:8px;background:linear-gradient(90deg,#8c151a,#c89422,#315a31);"></td></tr>
        <tr><td align="center" style="padding:42px 40px 28px;">
          <p style="font-family:Georgia,serif;font-size:15px;letter-spacing:0;color:#9f1d22;text-transform:none;margin:0 0 14px;">మా పెళ్లి వేడుక</p>
          <h1 style="font-family:Georgia,serif;font-size:48px;line-height:0.95;color:#281309;margin:0 0 10px;font-weight:400;letter-spacing:0;">
            Akhila <em style="color:#9f1d22;">&amp;</em> Akshay
          </h1>
          <p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:2.8px;color:#8c5f11;text-transform:uppercase;margin:0 0 24px;">28-31 August 2026</p>
          <div style="height:1px;background:linear-gradient(90deg,transparent,#c89422,transparent);width:70%;margin:0 auto 26px;"></div>
          <p style="font-size:17px;line-height:1.7;color:#281309;text-align:left;margin:18px 0;">${greeting}</p>
          <p style="font-size:17px;line-height:1.7;color:#4f3a28;text-align:left;margin:0 0 18px;">
            With hearts full of joy, we invite you to join the Telugu wedding celebrations of Akhila and Akshay.
          </p>
          ${extra}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 28px;border-top:1px solid rgba(184,134,11,0.18);">
${eventRows}
          </table>
          <p style="font-size:15px;line-height:1.7;color:#705843;text-align:left;margin:18px 0;">
            Please confirm your RSVP using your private link. You can also add the invited events to Apple / Outlook Calendar.
          </p>
          <a href="${escapeHtml(links.rsvpUrl)}" style="display:inline-block;margin:18px 6px 8px;padding:15px 30px;background:linear-gradient(135deg,#8c151a,#c89422);color:#fff8e8;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;">
            RSVP Now
          </a>
          <a href="${escapeHtml(links.calendarUrl)}" style="display:inline-block;margin:18px 6px 8px;padding:14px 24px;border:1px solid #c89422;color:#8c5f11;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2.4px;text-transform:uppercase;">
            Add To Apple / Outlook Calendar
          </a>
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#9d8061;margin:28px 0 0;">With love, Chennaboina &amp; Lenkalapally Families</p>
        </td></tr>
        <tr><td style="padding:6px;background:linear-gradient(90deg,#8c151a,#c89422,#315a31);"></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function handleResetGuests(req, res) {
  const resetPasscode = String(req.body?.passcode || '').trim();
  if (resetPasscode !== '291097') {
    return res.status(403).json({ error: 'Invalid reset passcode' });
  }

  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  await kv.set(guestsKey, []);
  res.json({ success: true, message: 'All guests cleared' });
}

async function handleExportGuests(req, res) {
  const csvValue = value => `"${String(value || '').replace(/"/g, '""')}"`;

  // Get all guests
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];

  // Generate CSV
  const csv = [
    ['Name', 'Email', 'Phone', 'Relationship', 'Party Size', 'Dietary Restrictions', 'Events', 'RSVP Status', 'RSVP Date', 'Notes', 'RSVP Notes'].join(',')
  ];

  guests.forEach(g => {
    csv.push([
      csvValue(g.name),
      csvValue(g.email),
      csvValue(g.phone),
      csvValue(g.relationship),
      g.partySize || 1,
      csvValue(g.dietaryRestrictions),
      csvValue((g.events || []).join('|')),
      g.rsvpStatus,
      g.rsvpDate ? new Date(g.rsvpDate).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }) : '',
      csvValue(g.notes),
      csvValue(g.rsvpNotes)
    ].join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="guests.csv"');
  res.send(csv.join('\n'));
}
