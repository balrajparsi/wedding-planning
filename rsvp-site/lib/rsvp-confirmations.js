const DEFAULT_FROM_EMAIL = 'Akhila and Akshay <onboarding@resend.dev>';

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

function getFromEmail() {
  const configured = String(process.env.INVITE_FROM_EMAIL || DEFAULT_FROM_EMAIL)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  const emailMatch = configured.match(/[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+/);

  if (!emailMatch) {
    const displayName = configured.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim() || 'Akhila and Akshay';
    return `${displayName} <onboarding@resend.dev>`;
  }
  if (/^[^<>]+<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>$|^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(configured)) {
    return configured;
  }

  const displayName = configured
    .replace(emailMatch[0], '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return displayName ? `${displayName} <${emailMatch[0]}>` : emailMatch[0];
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

function buildConfirmationEmail(guest, events) {
  const guestName = escapeHtml(guest.name || 'Dear Guest');
  const rows = events.map(event => {
    const status = eventStatus(event);
    return `<tr>
      <td style="padding:14px 0;border-bottom:1px solid #ead6a8;vertical-align:top;">
        <strong style="font-family:Georgia,serif;font-size:19px;color:#281309;">${escapeHtml(event.name)}</strong><br>
        <span style="font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#705843;">${escapeHtml(event.displayDate)} | ${escapeHtml(event.time)}<br>${escapeHtml(event.venue || 'Venue to be confirmed')}</span>
      </td>
      <td style="padding:14px 0;border-bottom:1px solid #ead6a8;text-align:right;vertical-align:top;font-family:Arial,sans-serif;">
        <strong style="display:inline-block;padding:5px 9px;border-radius:999px;background:${status.attending ? '#e4f4e8' : status.label === 'Maybe' ? '#fff0d6' : '#f8e2df'};color:${status.attending ? '#1f6a35' : status.label === 'Maybe' ? '#8c5f11' : '#9f1d22'};font-size:11px;letter-spacing:1px;text-transform:uppercase;">${status.label}</strong><br>
        <span style="display:inline-block;margin-top:7px;font-size:12px;line-height:1.4;color:#705843;max-width:190px;">${escapeHtml(status.detail)}</span>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3dfb7;font-family:Arial,sans-serif;color:#281309;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 16px;background:#f3dfb7;"><tr><td align="center">
    <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff8e8;border:1px solid #c89422;">
      <tr><td style="height:8px;background:linear-gradient(90deg,#8c151a,#c89422,#315a31);"></td></tr>
      <tr><td style="padding:42px 36px 36px;">
        <p style="margin:0 0 12px;color:#9f1d22;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Mana Pelli Veduka</p>
        <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:42px;font-weight:400;line-height:1;color:#281309;">RSVP received</h1>
        <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:19px;line-height:1.55;color:#4f3a28;">Thank you, ${guestName}. We are so happy to celebrate with you.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ead6a8;">${rows}</table>
        <p style="margin:26px 0 0;font-size:13px;line-height:1.65;color:#705843;">Your response has been recorded. For any change, please contact the Chennaboina and Lenkalapally families.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function buildConfirmationSms(guest, events) {
  const attending = events.filter(event => eventStatus(event).attending).map(event => event.name);
  const maybe = events.filter(event => eventStatus(event).label === 'Maybe').map(event => event.name);
  const summary = attending.length
    ? `Confirmed: ${attending.join(', ')}.`
    : maybe.length
      ? `Marked maybe for ${maybe.join(', ')}.`
      : 'We have noted that you cannot attend.';
  return cleanText(`Akhila & Akshay: RSVP received for ${guest.name || 'your family'}. ${summary} Full details are in your email. Reply STOP to opt out.`, 320);
}

async function sendEmailConfirmation(guest, events, attemptedAt) {
  if (!process.env.RESEND_API_KEY) {
    return { status: 'skipped', attemptedAt, error: 'RESEND_API_KEY is not configured.' };
  }
  if (!guest.email) {
    return { status: 'skipped', attemptedAt, error: 'Guest email is unavailable.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: [guest.email],
        subject: `RSVP received - Akhila & Akshay's Wedding`,
        html: buildConfirmationEmail(guest, events)
      })
    });
    if (!response.ok) {
      return { status: 'failed', attemptedAt, error: parseProviderError(await response.text(), 'Resend confirmation failed.') };
    }
    const payload = await response.json().catch(() => ({}));
    return { status: 'sent', attemptedAt, sentAt: new Date().toISOString(), id: cleanText(payload.id, 120) };
  } catch (error) {
    return { status: 'failed', attemptedAt, error: cleanText(error.message || 'Resend confirmation failed.') };
  }
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
  normalizeUsPhone,
  sendRsvpConfirmations
};
