import { createHash } from 'node:crypto';
import { head, put } from '@vercel/blob';

/* Beta signup endpoint for the nestup.best landing page.
 *
 * Design goal: a submitted email must never be lost, even if notification is
 * misconfigured. So the two jobs are deliberately split and ordered:
 *
 *   1. Persist the lead to Blob storage. This is the source of truth.
 *   2. Try to notify. Best-effort — a notification failure is logged and
 *      swallowed, because the lead is already safe and the person on the
 *      other end should not see an error for our mail problem.
 *
 * No secret is ever sent to the client. BLOB_READ_WRITE_TOKEN and
 * RESEND_API_KEY are read from the server environment only.
 */

const NOTIFY_TO = 'nimrodshamir@nestup.best';
const SOURCE = 'NestUp landing page / beta signup';

// Deliberately conservative. It is better to accept a rare oddity and let a
// human look at it than to reject a real parent's real address.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const MAX_EMAIL = 254; // RFC 5321

// Best-effort only: serverless instances are recycled, so this throttles a
// naive flood against a warm instance and nothing more. It is a courtesy
// guard, not a security control — the real protections are the honeypot,
// the timing check, and the fact that a duplicate is a no-op.
const RATE = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function rateLimited(ip) {
  const now = Date.now();
  const hits = (RATE.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  RATE.set(ip, hits);
  if (RATE.size > 5000) RATE.clear(); // bound memory on a long-lived instance
  return hits.length > RATE_MAX;
}

function composeNotification({ email, at, ip, userAgent }) {
  const local = new Date(at).toLocaleString('en-GB', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return {
    subject: `NestUp beta signup — ${email}`,
    text: [
      `New NestUp beta signup`,
      ``,
      `Email:      ${email}`,
      `Timestamp:  ${local} (Israel)`,
      `            ${at} (UTC)`,
      `Source:     ${SOURCE}`,
      ``,
      `IP:         ${ip ?? 'unknown'}`,
      `User agent: ${userAgent ?? 'unknown'}`,
      ``,
      `Reply directly to this email to reach them.`,
    ].join('\n'),
  };
}

/* Two delivery routes, either of which is a single configuration step:
 *
 *   SMTP   — uses the existing Spacemail mailbox on nestup.best. No new
 *            account, and mail leaves from the real domain, so the existing
 *            SPF/DKIM records do the authenticating.
 *   Resend — an HTTPS API, no SMTP connection to hold open.
 *
 * SMTP is tried first because sending from the actual domain is the better
 * outcome; Resend is the fallback if only that is configured. Whichever is
 * present wins — configuring both is fine but unnecessary.
 */

async function sendViaSmtp({ subject, text }, replyTo) {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;

  const host = process.env.SMTP_HOST || 'mail.spacemail.com';
  const port = Number(process.env.SMTP_PORT || 465);

  // Imported lazily so a Resend-only deployment never pays to load it.
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587 upgrades via STARTTLS instead
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transport.sendMail({
    from: `NestUp <${SMTP_USER}>`,
    to: NOTIFY_TO,
    replyTo,
    subject,
    text,
  });
  return { sent: true, via: 'smtp' };
}

async function sendViaResend({ subject, text }, replyTo) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      // Overridable so the sender can move to a verified nestup.best address
      // later without a code change.
      from: process.env.RESEND_FROM || 'NestUp <onboarding@resend.dev>',
      to: [NOTIFY_TO],
      reply_to: replyTo,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    console.error('[subscribe] resend rejected the send', res.status, await res.text());
    return { sent: false, reason: `resend_${res.status}` };
  }
  return { sent: true, via: 'resend' };
}

async function notify(lead) {
  const message = composeNotification(lead);

  for (const send of [sendViaSmtp, sendViaResend]) {
    let result;
    try {
      result = await send(message, lead.email);
    } catch (err) {
      console.error(`[subscribe] ${send.name} threw`, err);
      continue; // fall through to the other route rather than giving up
    }
    if (result) return result; // null means "not configured", so keep looking
  }

  console.warn(
    '[subscribe] lead stored but no mail route is configured; ' +
      'set SMTP_USER/SMTP_PASS or RESEND_API_KEY',
  );
  return { sent: false, reason: 'not_configured' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({ ok: false, error: 'bad_json' });
    }
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ ok: false, error: 'bad_json' });
  }

  // Honeypot: a field hidden from people but tempting to a form-filling bot.
  // Answer 200 rather than 400 so a bot gets no signal that it was caught.
  if (typeof payload.company === 'string' && payload.company.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  // Nobody reads the page, decides to join, and types an address in under a
  // second and a half. Same reasoning: succeed silently.
  const elapsed = Number(payload.elapsed);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 1500) {
    return res.status(200).json({ ok: true });
  }

  const email = String(payload.email ?? '').trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  if (rateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  // Deterministic pathname: the same address always maps to the same object,
  // so a double submit overwrites rather than creating a second lead. The
  // hash keeps raw addresses out of object names.
  const id = createHash('sha256').update(email).digest('hex').slice(0, 32);
  const pathname = `leads/${id}.json`;
  const at = new Date().toISOString();

  let duplicate = false;
  try {
    await head(pathname);
    duplicate = true;
  } catch {
    duplicate = false; // not found — a genuinely new signup
  }

  try {
    await put(
      pathname,
      JSON.stringify(
        {
          email,
          at,
          source: SOURCE,
          ip,
          userAgent: req.headers['user-agent'] ?? null,
          referer: req.headers.referer ?? null,
        },
        null,
        2,
      ),
      {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      },
    );
  } catch (err) {
    console.error('[subscribe] could not store lead', err);
    return res.status(500).json({ ok: false, error: 'storage_failed' });
  }

  // Only notify for genuinely new addresses, so a repeat submit does not send
  // a second email.
  if (!duplicate) {
    try {
      await notify({ email, at, ip, userAgent: req.headers['user-agent'] });
    } catch (err) {
      console.error('[subscribe] notification threw', err);
    }
  }

  return res.status(200).json({ ok: true, duplicate });
}
