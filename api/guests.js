/**
 * Guest Management API Endpoints (No Authentication)
 * GET /api/guests - List guests with filters/search
 * POST /api/guests - Add new guest
 * PUT /api/guests/:id - Update guest or RSVP status
 * DELETE /api/guests/:id - Remove guest
 * POST /api/guests/bulk-invite - Send bulk RSVP invitations
 * GET /api/guests/export - Export guests as CSV
 */

const crypto = require('crypto');
const kv = require('../lib/kv');

// Fixed wedding ID for Akhila & Akshay's wedding
const WEDDING_ID = 'akhila-akshay-2026';

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET' && (req.url.includes('action=export') || req.url.includes('/export'))) {
      return handleExportGuests(req, res);
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
  const { name, email, phone, relationship, partySize, dietaryRestrictions, notes, events } = req.body;

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
    events: Array.isArray(events) ? events : [],
    rsvpStatus: 'pending',
    invitedDate: new Date().toISOString(),
    rsvpDate: null,
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
  const { name, email, phone, relationship, partySize, dietaryRestrictions, notes, rsvpStatus, events } = req.body;

  if (name !== undefined) guest.name = name;
  if (email !== undefined) guest.email = email;
  if (phone !== undefined) guest.phone = phone;
  if (relationship !== undefined) guest.relationship = relationship;
  if (partySize !== undefined) guest.partySize = partySize;
  if (dietaryRestrictions !== undefined) guest.dietaryRestrictions = dietaryRestrictions;
  if (notes !== undefined) guest.notes = notes;
  if (events !== undefined) guest.events = Array.isArray(events) ? events : [];

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
        invitedDate: current.invitedDate || now,
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
      events: guestData.events || [],
      notes: guestData.notes || '',
      rsvpStatus: guestData.rsvpStatus || 'pending',
      invitedDate: now,
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
  const events = Array.isArray(rawGuest.events)
    ? rawGuest.events.filter(Boolean)
    : String(rawGuest.events || '').split(/[|;,]/).map(e => e.trim()).filter(Boolean);

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

  // ── Attempt to actually send via Resend (if API key present) ──
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL     = process.env.INVITE_FROM_EMAIL || 'Akhila & Akshay <onboarding@resend.dev>';
  const SITE_URL       = process.env.SITE_URL || 'https://wedding-planning-two.vercel.app';

  let sent = 0;
  let failed = 0;
  const errors = [];

  if (RESEND_API_KEY && withEmail.length > 0) {
    for (const g of withEmail) {
      const finalSubject = subject || `You're invited — Akhila & Akshay's Wedding · 30 August 2026`;
      const html = buildInviteHtml(g, message, SITE_URL);
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [g.email],
            subject: finalSubject,
            html
          })
        });
        if (r.ok) {
          sent++;
        } else {
          const errText = await r.text();
          failed++;
          errors.push({ email: g.email, error: errText.slice(0, 200) });
        }
      } catch (e) {
        failed++;
        errors.push({ email: g.email, error: e.message });
      }
    }
  }

  // Mark invitedDate on the guests we attempted (or just prepared)
  withEmail.forEach(g => {
    const idx = guests.findIndex(x => x.id === g.id);
    if (idx !== -1) {
      guests[idx].invitedDate = now;
      guests[idx].updatedAt = now;
    }
  });
  await kv.set(guestsKey, guests);

  const wasSent = !!RESEND_API_KEY;
  res.json({
    success: true,
    sendingEnabled: wasSent,
    message: wasSent
      ? `Sent ${sent} of ${withEmail.length} invites${failed ? ` (${failed} failed)` : ''}`
      : `Preview only — ${withEmail.length} invites prepared. Add RESEND_API_KEY env var on Vercel to actually send.`,
    invitedCount: withEmail.length,
    totalMatched: selectedGuests.length,
    sent, failed,
    errors: errors.slice(0, 5),
    invitedGuests: withEmail.map(g => ({ id: g.id, name: g.name, email: g.email }))
  });
}

function buildInviteHtml(guest, customMessage, siteUrl) {
  const greeting = guest.name ? `Dear ${guest.name},` : 'Dear friend,';
  const extra = customMessage
    ? `<p style="font-size:15px;line-height:1.7;color:#444;margin:18px 0;">${customMessage.replace(/\n/g,'<br>')}</p>`
    : '';
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5e6c8;font-family:Georgia,'Cormorant Garamond',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5e6c8;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fffaf0;border:1px solid #d4a017;border-radius:6px;box-shadow:0 8px 30px rgba(0,0,0,0.1);">
        <tr><td style="padding:8px;background:linear-gradient(90deg,#b8860b,#d4a017,#b8860b);"></td></tr>
        <tr><td align="center" style="padding:40px 36px 24px;">
          <div style="font-size:32px;color:#b8860b;margin-bottom:6px;">☸</div>
          <p style="font-size:11px;letter-spacing:4px;color:#a0644e;text-transform:uppercase;margin:0 0 14px;">You are cordially invited</p>
          <h1 style="font-family:Georgia,serif;font-size:42px;color:#1a3a52;margin:0 0 8px;font-weight:400;letter-spacing:0.02em;">
            Akhila <em style="color:#c0392b;">&amp;</em> Akshay
          </h1>
          <p style="font-size:13px;letter-spacing:3px;color:#b8860b;text-transform:uppercase;margin:0 0 24px;">30 August 2026</p>
          <div style="height:1px;background:linear-gradient(90deg,transparent,#d4a017,transparent);width:60%;margin:0 auto 24px;"></div>
          <p style="font-size:16px;line-height:1.7;color:#333;text-align:left;margin:18px 0;">${greeting}</p>
          <p style="font-size:16px;line-height:1.7;color:#333;text-align:left;margin:0 0 18px;">
            With hearts full of joy, we invite you to share in our celebration as we begin this beautiful journey together.
          </p>
          ${extra}
          <p style="font-size:15px;line-height:1.7;color:#555;text-align:left;margin:18px 0;">
            Please RSVP at your earliest convenience so we can plan every detail.
          </p>
          <a href="${siteUrl}" style="display:inline-block;margin:20px 0 8px;padding:14px 36px;background:#1a3a52;color:#f4d27a;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;border-radius:2px;">
            View Wedding Details
          </a>
          <p style="font-size:11px;color:#999;margin:28px 0 0;">With love · The Parsi Family</p>
        </td></tr>
        <tr><td style="padding:6px;background:linear-gradient(90deg,#b8860b,#d4a017,#b8860b);"></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function handleResetGuests(req, res) {
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  await kv.set(guestsKey, []);
  res.json({ success: true, message: 'All guests cleared' });
}

async function handleExportGuests(req, res) {
  

  // Get all guests
  const guestsKey = `wedding:${WEDDING_ID}:guests`;
  const guests = (await kv.get(guestsKey)) || [];

  // Generate CSV
  const csv = [
    ['Name', 'Email', 'Phone', 'Relationship', 'Party Size', 'Dietary Restrictions', 'Events', 'RSVP Status', 'RSVP Date', 'Notes'].join(',')
  ];

  guests.forEach(g => {
    csv.push([
      `"${g.name}"`,
      `"${g.email || ''}"`,
      `"${g.phone || ''}"`,
      `"${g.relationship || ''}"`,
      g.partySize || 1,
      `"${g.dietaryRestrictions || ''}"`,
      `"${(g.events || []).join('|')}"`,
      g.rsvpStatus,
      g.rsvpDate ? new Date(g.rsvpDate).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }) : '',
      `"${g.notes || ''}"`
    ].join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="guests.csv"');
  res.send(csv.join('\n'));
}
