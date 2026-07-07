const { RSVP_EVENTS } = require('./rsvp');

const DEFAULT_PELLIKUTHURU_ADDRESS = '510 Peach Ave, Centerton, AR 72719';
const DEFAULT_PELLIKUTHURU_MAP_URL = 'https://maps.app.goo.gl/Nx2cUKVUo1EL6Tgx6';

function cleanText(value, maxLength = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getGmailConfiguration() {
  return {
    senderEmail: String(process.env.GMAIL_SENDER_EMAIL || '').trim(),
    senderName: cleanText(process.env.GMAIL_SENDER_NAME || 'Akhila & Akshay', 120),
    clientId: String(process.env.GMAIL_OAUTH_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.GMAIL_OAUTH_CLIENT_SECRET || '').trim(),
    refreshToken: String(process.env.GMAIL_OAUTH_REFRESH_TOKEN || '').trim()
  };
}

function buildGmailRawMessage({ from, to, subject, html }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${from}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf8').toString('base64')
  ].join('\r\n');

  return Buffer.from(message, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizeUsPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

function parseProviderError(body, fallback) {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message = parsed.message || parsed.error?.message || parsed.error || body;
  } catch (_) {
    // Providers can return plain text for some failures.
  }
  return cleanText(message || fallback);
}

function eventStatus(event) {
  const response = String(event.response || '').toLowerCase();
  if (response === 'attending') {
    const attendance = Math.max(1, parseInt(event.attendanceCount, 10) || 1);
    const vegetarian = Math.max(0, parseInt(event.vegetarianCount, 10) || 0);
    const nonVegetarian = Math.max(0, parseInt(event.nonVegetarianCount, 10) || 0);
    const meals = event.mealPolicy === 'vegetarian-only'
      ? `${attendance} vegetarian`
      : `${attendance} attending (${vegetarian} vegetarian, ${nonVegetarian} non-vegetarian)`;
    return { label: 'Yes', detail: meals, attending: true };
  }
  if (response === 'maybe') return { label: 'Maybe', detail: 'Awaiting final confirmation', attending: false };
  return { label: 'No', detail: 'Unable to attend', attending: false };
}

function eventDisplayName(event) {
  return event.displayName || event.name;
}

function normalizeEventLookupValue(value) {
  return cleanText(value, 180).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
}

function isPlaceholderVenue(value) {
  const normalized = normalizeEventLookupValue(value);
  return [
    'bride side address',
    'groom side address',
    'shared event address',
    'venue to be confirmed',
    'location to be confirmed',
    'to be confirmed',
    'tbd'
  ].includes(normalized);
}

function isBrideSideVenue(value) {
  return normalizeAddress(value) === normalizeAddress(DEFAULT_PELLIKUTHURU_ADDRESS);
}

function isPellikuthuruLocation(value) {
  const normalized = normalizeEventLookupValue(value);
  return normalized === 'pellikuthuru' || normalized === 'pelli kuthuru';
}

function isPellikodukuLocation(value) {
  const normalized = normalizeEventLookupValue(value);
  return normalized === 'pellikoduku' || normalized === 'pelli koduku';
}

function canonicalEventFor(event) {
  const candidates = [
    event.id,
    event.name,
    event.displayName
  ].map(normalizeEventLookupValue).filter(Boolean);

  return RSVP_EVENTS.find(item => {
    const aliases = [
      item.id,
      item.name,
      item.displayName
    ].map(normalizeEventLookupValue).filter(Boolean);
    return aliases.some(alias => candidates.some(candidate => candidate === alias || candidate.includes(alias) || alias.includes(candidate)));
  }) || null;
}

function cleanVenue(value) {
  return cleanText(value || 'Location to be confirmed', 180).replace(/^["']|["']$/g, '');
}

function eventLocations(event) {
  const canonical = canonicalEventFor(event);
  const canonicalLocations = Array.isArray(canonical?.locations) ? canonical.locations : [];
  const eventSourceLocations = Array.isArray(event.locations) ? event.locations : [];
  const sourceLocations = canonicalLocations.length ? canonicalLocations : eventSourceLocations;

  if (!sourceLocations.length) return [];

  return sourceLocations.map(location => {
    const canonicalLocation = canonicalLocations.length ? location : null;
    const submittedLocation = eventSourceLocations.find(item => normalizeEventLookupValue(item.label) === normalizeEventLookupValue(location.label)) || location;
    const venue = cleanVenue(submittedLocation.venue);
    const canonicalVenue = cleanVenue(canonicalLocation?.venue);
    const label = cleanText(location.label || 'Location', 80);
    let resolvedVenue = canonicalLocation
      ? canonicalVenue && !isPlaceholderVenue(canonicalVenue)
        ? canonicalVenue
        : 'Location to be confirmed'
      : !isPlaceholderVenue(venue)
          ? venue
          : 'Location to be confirmed';

    if (isPellikuthuruLocation(label) && isPlaceholderVenue(resolvedVenue)) {
      resolvedVenue = DEFAULT_PELLIKUTHURU_ADDRESS;
    }
    if (isPellikodukuLocation(label) && isBrideSideVenue(resolvedVenue)) {
      resolvedVenue = 'Location to be confirmed';
    }

    let mapUrl = isPlaceholderVenue(resolvedVenue)
      ? ''
      : String(canonicalLocation?.mapUrl || submittedLocation.mapUrl || '').trim();
    if (isPellikuthuruLocation(label) && !mapUrl) {
      mapUrl = DEFAULT_PELLIKUTHURU_MAP_URL;
    }
    return {
      label,
      venue: resolvedVenue,
      mapUrl
    };
  });
}

function eventVenueText(event) {
  const venue = cleanVenue(event.venue);
  if (!venue || !isPlaceholderVenue(venue)) return venue;

  const canonicalVenue = canonicalEventFor(event)?.venue;
  const cleanCanonicalVenue = cleanVenue(canonicalVenue);
  return cleanCanonicalVenue && !isPlaceholderVenue(cleanCanonicalVenue)
    ? cleanCanonicalVenue
    : 'Location to be confirmed';
}

function eventMapUrl(event) {
  const explicit = String(event.mapUrl || '').trim();
  if (explicit) return explicit;

  const canonicalMapUrl = String(canonicalEventFor(event)?.mapUrl || '').trim();
  if (canonicalMapUrl) return canonicalMapUrl;

  const venue = eventVenueText(event);
  if (/location to be confirmed/i.test(venue)) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

function locationMapButton(mapUrl) {
  return mapUrl
    ? `<a href="${escapeHtml(mapUrl)}" style="display:inline-block;margin-top:7px;padding:7px 10px;background:#ffffff;border:1px solid #d8d1c6;border-radius:6px;color:#1a5fd0;font-family:Arial,sans-serif;font-size:12px;font-weight:700;text-decoration:none;">Open in Maps</a>`
    : `<span style="display:inline-block;margin-top:7px;padding:7px 10px;background:#f6f1e7;border:1px solid #ded4c4;border-radius:6px;color:#705843;font-family:Arial,sans-serif;font-size:12px;">Map link coming soon</span>`;
}

function locationDetailsHtml(event) {
  const locations = eventLocations(event);
  if (!locations.length) {
    return `<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#111820;">${escapeHtml(eventVenueText(event))}</p>`;
  }

  return locations.map(location => `<div style="margin:0 0 14px;padding:0 0 14px;border-bottom:1px solid #eadfcf;">
    <p style="margin:0 0 5px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;line-height:1.35;color:#1f2a2e;">${escapeHtml(location.label)}</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111820;">${escapeHtml(location.venue)}</p>
    ${locationMapButton(location.mapUrl)}
  </div>`).join('');
}

function eventCardHtml(event) {
  const status = eventStatus(event);
  const locations = eventLocations(event);
  const mapUrl = eventMapUrl(event);
  const mapButton = mapUrl
    ? `<a href="${escapeHtml(mapUrl)}" style="display:inline-block;margin-top:12px;padding:9px 12px;background:#ffffff;border:1px solid #d8d1c6;border-radius:6px;color:#1a5fd0;font-family:Arial,sans-serif;font-size:13px;font-weight:700;text-decoration:none;">Open in Maps</a>`
    : `<span style="display:inline-block;margin-top:12px;padding:9px 12px;background:#f6f1e7;border:1px solid #ded4c4;border-radius:6px;color:#705843;font-family:Arial,sans-serif;font-size:13px;">Map link coming soon</span>`;
  const mapPreview = locations.length
    ? ''
    : `<table width="100%" cellpadding="0" cellspacing="0" style="background:#eaf0ea;border:1px solid #d5ddd5;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="height:142px;padding:16px;text-align:center;background:linear-gradient(135deg,#edf3ec 0%,#edf3ec 30%,#f7f0df 30%,#f7f0df 45%,#dcefe4 45%,#dcefe4 100%);">
                  <div style="display:inline-block;width:34px;height:34px;border-radius:50% 50% 50% 0;background:#d83b2d;transform:rotate(-45deg);box-shadow:0 5px 12px rgba(80,38,10,.22);"></div>
                  <div style="margin-top:10px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#4c4f53;letter-spacing:1px;text-transform:uppercase;">Location map</div>
                  ${mapButton}
                </td>
              </tr>
            </table>`;

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#fffdf8;border:1px solid #ead6a8;border-radius:10px;">
    <tr><td style="padding:24px 24px 20px;">
      <h2 style="margin:0 0 18px;font-family:Georgia,serif;font-size:28px;font-weight:700;line-height:1.1;color:#1f2a2e;">${escapeHtml(eventDisplayName(event))}</h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="42%" style="padding:0 20px 0 0;vertical-align:top;">
            <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4c4f53;">Date &amp; Time</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111820;">${escapeHtml(event.displayDate)}<br>${escapeHtml(event.time)}</p>
            <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#705843;">${escapeHtml(status.detail)}</p>
          </td>
          <td width="58%" style="padding:0;vertical-align:top;">
            <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4c4f53;">Location</p>
            ${locationDetailsHtml(event)}
            ${mapPreview}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>`;
}

function buildConfirmationEmail(guest, events) {
  const guestName = escapeHtml(guest.name || 'Dear Guest');
  const acceptedEvents = events.filter(event => eventStatus(event).attending);
  const eventCards = acceptedEvents.map(eventCardHtml).join('');
  const acceptedBlock = acceptedEvents.length
    ? `<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#9f1d22;">Accepted events</p>
        ${eventCards}`
    : `<p style="margin:0;padding:16px 0;border-top:1px solid #ead6a8;border-bottom:1px solid #ead6a8;font-size:14px;line-height:1.6;color:#705843;">We have recorded that you are unable to attend the wedding celebrations.</p>`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3dfb7;font-family:Arial,sans-serif;color:#281309;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 16px;background:#f3dfb7;"><tr><td align="center">
    <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff8e8;border:1px solid #c89422;">
      <tr><td style="height:8px;background:linear-gradient(90deg,#8c151a,#c89422,#315a31);"></td></tr>
      <tr><td style="padding:42px 36px 36px;">
        <p style="margin:0 0 12px;color:#9f1d22;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Mana Pelli Veduka</p>
        <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:42px;font-weight:400;line-height:1;color:#281309;">RSVP received</h1>
        <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:19px;line-height:1.55;color:#4f3a28;">Thank you, ${guestName}. We are so happy to celebrate with you.</p>
        ${acceptedBlock}
        <p style="margin:26px 0 0;font-size:13px;line-height:1.65;color:#705843;">Your response has been recorded. For any change, please contact the Chennaboina and Lenkalapally families.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function buildConfirmationSms(guest, events) {
  const attending = events.filter(event => eventStatus(event).attending).map(event => eventDisplayName(event));
  const maybe = events.filter(event => eventStatus(event).label === 'Maybe').map(event => eventDisplayName(event));
  const summary = attending.length
    ? `Confirmed: ${attending.join(', ')}.`
    : maybe.length
      ? `Marked maybe for ${maybe.join(', ')}.`
      : 'We have noted that you cannot attend.';
  return cleanText(`Akhila & Akshay: RSVP received for ${guest.name || 'your family'}. ${summary} Full details are in your email. Reply STOP to opt out.`, 320);
}

async function sendGmailConfirmation(guest, events, attemptedAt) {
  const config = getGmailConfiguration();
  const missing = [
    ['GMAIL_SENDER_EMAIL', config.senderEmail],
    ['GMAIL_OAUTH_CLIENT_ID', config.clientId],
    ['GMAIL_OAUTH_CLIENT_SECRET', config.clientSecret],
    ['GMAIL_OAUTH_REFRESH_TOKEN', config.refreshToken]
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    return { status: 'skipped', attemptedAt, error: `Gmail confirmation is missing: ${missing.join(', ')}.` };
  }
  if (!guest.email) {
    return { status: 'skipped', attemptedAt, error: 'Guest email is unavailable.' };
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token'
      }).toString()
    });
    if (!tokenResponse.ok) {
      return { status: 'failed', attemptedAt, error: parseProviderError(await tokenResponse.text(), 'Unable to refresh Gmail authorization.') };
    }
    const tokenPayload = await tokenResponse.json();
    if (!tokenPayload.access_token) {
      return { status: 'failed', attemptedAt, error: 'Gmail did not return an access token.' };
    }

    const senderName = config.senderName.replace(/[\r\n<>]/g, '').trim() || 'Akhila & Akshay';
    const sender = `${senderName} <${config.senderEmail}>`;
    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: buildGmailRawMessage({
          from: sender,
          to: guest.email,
          subject: `RSVP received - Akhila & Akshay's Wedding`,
          html: buildConfirmationEmail(guest, events)
        })
      })
    });
    if (!sendResponse.ok) {
      return { status: 'failed', attemptedAt, error: parseProviderError(await sendResponse.text(), 'Gmail confirmation failed.') };
    }
    const payload = await sendResponse.json().catch(() => ({}));
    return { status: 'sent', attemptedAt, sentAt: new Date().toISOString(), id: cleanText(payload.id, 120) };
  } catch (error) {
    return { status: 'failed', attemptedAt, error: cleanText(error.message || 'Gmail confirmation failed.') };
  }
}

async function sendEmailConfirmation(guest, events, attemptedAt) {
  const gmailResult = await sendGmailConfirmation(guest, events, attemptedAt);
  return { provider: 'gmail', ...gmailResult };
}

async function sendSmsConfirmation(guest, events, attemptedAt) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from = normalizeUsPhone(process.env.TWILIO_FROM_NUMBER);
  const to = normalizeUsPhone(guest.phone);

  if (!accountSid || !authToken || !from) {
    return { status: 'skipped', attemptedAt, error: 'Twilio sender credentials are not configured.' };
  }
  if (!to) {
    return { status: 'failed', attemptedAt, error: 'Guest phone number must be a 10-digit US number.' };
  }

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: to, From: from, Body: buildConfirmationSms(guest, events) }).toString()
    });
    if (!response.ok) {
      return { status: 'failed', attemptedAt, error: parseProviderError(await response.text(), 'Twilio confirmation failed.') };
    }
    const payload = await response.json().catch(() => ({}));
    return { status: 'sent', attemptedAt, sentAt: new Date().toISOString(), id: cleanText(payload.sid, 120) };
  } catch (error) {
    return { status: 'failed', attemptedAt, error: cleanText(error.message || 'Twilio confirmation failed.') };
  }
}

async function sendRsvpConfirmations(guest, events) {
  const attemptedAt = new Date().toISOString();
  const [email, sms] = await Promise.all([
    sendEmailConfirmation(guest, events, attemptedAt),
    sendSmsConfirmation(guest, events, attemptedAt)
  ]);

  return { attemptedAt, email, sms };
}

module.exports = {
  buildGmailRawMessage,
  buildConfirmationEmail,
  normalizeUsPhone,
  sendEmailConfirmation,
  sendRsvpConfirmations
};
