// server.js — Convrs AI Backend
// Handles: business email validation, one-use restriction,
//          web voice-agent authorization (Dograh widget),
//          post-conversation Google Form submission,
//          Telegram error alerts for all internal failures

const express            = require('express');
const axios              = require('axios');
const cors               = require('cors');
const { createClient }   = require('@vercel/edge-config');

const app = express();
app.use(express.json({ limit: '32kb' })); // small body — lead form only; rejects oversized payloads

// Restrict CORS to our own sites. The demo form is same-origin, so this only
// blocks other websites from driving the API from a browser.
const ALLOWED_ORIGINS = new Set([
    'https://test.convrsai.com',
    'https://convrsai.com',
    'https://www.convrsai.com',
    'https://webcalls-for-convrs.vercel.app',
    'http://localhost:3000',
    'http://localhost:3999',
]);
app.use(cors({
    origin(origin, cb) {
        // Allow same-origin / server-to-server (no Origin header) and our known sites.
        if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
        return cb(null, false);
    },
}));

// ============================================================
// CONFIGURATION
// ============================================================
const WHITELIST_DOMAINS = new Set(['marketwavegen.com', 'outsourcedemandgen.com']);

// Strict E.164: a leading '+' followed by 8–15 digits. Rejects malformed input,
// letters, and injection attempts before anything reaches the sheet.
const E164_RE = /^\+[1-9]\d{7,14}$/;
function isValidE164(phone) {
    return E164_RE.test(phone);
}

// Telegram alert config — values come ONLY from env vars, never hardcoded
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // set in Vercel env vars
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;   // set in Vercel env vars

// Cloudflare Turnstile — bot protection. Secret comes ONLY from env var.
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

// Shared secret to authenticate the Dograh webhook. When set, the webhook
// rejects any request that doesn't present it via ?secret=…, X-Webhook-Secret,
// or Authorization: Bearer … (use whichever auth type you pick in Dograh).
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * Verifies a Cloudflare Turnstile token against Cloudflare's siteverify API.
 * Returns true only if Cloudflare confirms the token is valid.
 * Fails CLOSED (returns false) so a missing/invalid token never authorizes a session.
 */
async function verifyTurnstile(token, remoteIp) {
    if (!TURNSTILE_SECRET_KEY) {
        console.warn('⚠️  TURNSTILE_SECRET_KEY not set — rejecting call (fail closed)');
        return false;
    }
    if (!token) return false;
    try {
        const params = new URLSearchParams();
        params.append('secret',   TURNSTILE_SECRET_KEY);
        params.append('response', token);
        if (remoteIp) params.append('remoteip', remoteIp);

        const { data } = await axios.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            params.toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
        );
        if (!data.success) {
            console.log(`🤖 Turnstile rejected: ${JSON.stringify(data['error-codes'] || [])}`);
        }
        return data.success === true;
    } catch (err) {
        console.error('⚠️  Turnstile verify request failed:', err.message);
        return false; // fail closed
    }
}

// Google Form config — submitted after the voice agent conversation ends
const GOOGLE_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLScCerKJJK-wjvsoGTUNO3AkvzJExE_YwMCqz4tb2P5GZ4W9sQ/formResponse';
const FORM_ENTRY_IDS = {
    name:         'entry.1324714280',
    company:      'entry.1175518101',
    phone:        'entry.1617780937',
    email:        'entry.1404459620',
    summary:      'entry.2066698575',
    recordingUrl: 'entry.942287297',
};

// ============================================================
// FREE / DISPOSABLE EMAIL BLOCKLIST
// ============================================================
const FREE_EMAIL_DOMAINS = new Set([
    'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.co.in',
    'yahoo.fr','yahoo.de','yahoo.es','yahoo.it','ymail.com',
    'hotmail.com','hotmail.co.uk','hotmail.fr','hotmail.de','hotmail.es',
    'hotmail.it','outlook.com','outlook.co.uk','outlook.fr','outlook.de',
    'live.com','live.co.uk','live.fr','live.de','msn.com',
    'icloud.com','me.com','mac.com','aol.com','aim.com',
    'protonmail.com','proton.me','pm.me','tutanota.com','tutamail.com',
    'tuta.io','keemail.me','zoho.com','zohomail.com',
    'mail.com','gmx.com','gmx.net','gmx.de','gmx.us',
    'inbox.com','fastmail.com','fastmail.fm','hushmail.com',
    'mailinator.com','guerrillamail.com','guerrillamail.net',
    'guerrillamail.org','guerrillamail.biz','guerrillamail.de',
    'trashmail.com','trashmail.me','trashmail.net','trashmail.io',
    'tempmail.com','temp-mail.org','tempail.com','tempr.email',
    '10minutemail.com','10minutemail.net','throwam.com','throwaway.email',
    'yopmail.com','yopmail.fr','cool.fr.nf','jetable.fr.nf',
    'nospam.ze.tc','nomail.xl.cx','mega.zik.dj','speed.1s.fr',
    'courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf',
    'sharklasers.com','guerrillamail.info','spam4.me','dispostable.com',
    'spamgourmet.com','spamgourmet.net','spamgourmet.org',
    'maildrop.cc','emailondeck.com','getairmail.com','filzmail.com',
    'rediffmail.com','rocketmail.com','att.net','sbcglobal.net',
    'verizon.net','cox.net','comcast.net','charter.net',
    'bellsouth.net','earthlink.net','juno.com','netzero.com',
    // --- Disposable domains observed in the Jun 2026 abuse + broader list ---
    'yomail.in','mail2me.co','10mail.org','freeml.net','spymail.one',
    '20minutemail.com','33mail.com','anonbox.net','burnermail.io',
    'dropmail.me','emailfake.com','emailtemporanea.com','fakeinbox.com',
    'fakemail.net','getnada.com','inboxbear.com','inboxkitten.com',
    'mailcatch.com','mailnesia.com','mailsac.com','mintemail.com',
    'mohmal.com','moakt.com','mytemp.email','nada.email','tempmailo.com',
    'temp-mail.io','tempinbox.com','tmail.ws','tmpmail.org','vomoto.com',
    'wegwerfmail.de','mailpoof.com','luxusmail.org','mailto.plus',
    'mail.tm','1secmail.com','1secmail.org','1secmail.net','altmails.com',
    'disposablemail.com','tempmailaddress.com','minuteinbox.com','mailbox.in.ua',
]);

// ============================================================
// TELEGRAM ALERTS — fires on any internal error
// ============================================================
/**
 * Sends a Telegram alert message. Fire-and-forget — never blocks the response
 * and never crashes the server even if Telegram is unreachable.
 *
 * @param {string} errorType  - Short label, e.g. 'Call Dispatch Failed'
 * @param {string} failedAt   - Which service/step failed
 * @param {string} reason     - Error message or status code detail
 * @param {object} [lead]     - Optional lead context { name, company, phone, email }
 */
async function sendTelegramAlert(errorType, failedAt, reason, lead = {}) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('⚠️  Telegram alert skipped — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
        return;
    }

    const now = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const leadSection = (lead.email || lead.phone || lead.name)
        ? `\n👤 *Lead:* ${lead.name     || 'N/A'}` +
          `\n🏢 *Company:* ${lead.company || 'N/A'}` +
          `\n📞 *Phone:* ${lead.phone   || 'N/A'}` +
          `\n📧 *Email:* ${lead.email   || 'N/A'}`
        : '';

    const text =
        `🚨 *Convrs AI — Internal Error*\n\n` +
        `🔴 *Error Type:* ${errorType}\n` +
        `⏰ *Time:* ${now}\n` +
        leadSection +
        `\n\n⚙️ *Failed At:* ${failedAt}` +
        `\n💬 *Reason:* ${reason}`;

    try {
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                chat_id:    TELEGRAM_CHAT_ID,
                text,
                parse_mode: 'Markdown'
            },
            { timeout: 5000 }
        );
        console.log(`📨 Telegram alert sent: [${errorType}]`);
    } catch (tgErr) {
        // Never let Telegram failure bubble up — just log it
        console.error('⚠️  Telegram alert delivery failed:', tgErr.message);
    }
}

// ============================================================
// EDGE CONFIG — persistent email restriction store
// ============================================================
const EDGE_CONFIG_ID = 'ecfg_voqbct32g5zlerryegaao5xgggfo';
// Soft dependency: only build the client if a connection string exists.
// createClient(undefined) throws at module load and would crash the whole
// function on every request, so guard it here.
const edgeConfig = process.env.EDGE_CONFIG ? createClient(process.env.EDGE_CONFIG) : null;

// Always reads live from Edge Config — no stale cache across instances
async function hasUsedEmail(email) {
    if (!edgeConfig) return false; // Edge Config not configured — allow request through
    try {
        const stored = await edgeConfig.get('used_emails');
        return Array.isArray(stored) && stored.includes(email);
    } catch (_) {
        return false; // Edge Config unavailable — allow request through
    }
}

async function markEmailUsed(email) {
    const token = process.env.VERCEL_ACCESS_TOKEN;
    if (!token || !edgeConfig) return;
    try {
        const stored = await edgeConfig.get('used_emails');
        const current = Array.isArray(stored) ? stored : [];
        if (current.includes(email)) return; // already saved
        current.push(email);
        await axios.patch(
            `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`,
            { items: [{ operation: 'upsert', key: 'used_emails', value: current }] },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('Edge Config write failed:', err.message);
        // Non-blocking alert — Edge Config is a soft dependency
        sendTelegramAlert(
            'Edge Config Write Failed',
            'Vercel Edge Config → upsert used_emails',
            err.message,
            { email }
        );
    }
}

// Lead data is sent by the browser after the voice conversation ends, so no
// in-memory state is needed — safe across serverless cold starts.
async function submitLead(lead, recordingUrl, summary) {
    await submitToGoogleForm({ ...lead, summary: summary || '', recordingUrl: recordingUrl || '' });
}

// ============================================================
// HELPERS
// ============================================================
function getEmailDomain(email) {
    return (email.split('@')[1] || '').toLowerCase().trim();
}

function isBusinessEmail(email) {
    const domain = getEmailDomain(email);
    if (!domain || !domain.includes('.')) return false;
    return !FREE_EMAIL_DOMAINS.has(domain);
}

function isWhitelisted(email) {
    return WHITELIST_DOMAINS.has(getEmailDomain(email));
}

// Submit lead data to Google Form — called after the voice agent conversation
async function submitToGoogleForm({ name, company, phone, email, summary, recordingUrl }) {
    const params = new URLSearchParams();
    // Google's built-in email column — requires "Collect email addresses" → "Responder input" in form settings
    params.append('emailAddress',              email        || '');
    params.append(FORM_ENTRY_IDS.name,         name         || '');
    params.append(FORM_ENTRY_IDS.company,      company      || '');
    params.append(FORM_ENTRY_IDS.phone,        phone        || '');
    params.append(FORM_ENTRY_IDS.email,        email        || '');
    params.append(FORM_ENTRY_IDS.summary,      summary      || '');
    params.append(FORM_ENTRY_IDS.recordingUrl, recordingUrl || '');

    try {
        await axios.post(GOOGLE_FORM_ACTION, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            maxRedirects: 0,
            validateStatus: () => true
        });
        console.log(`📊 Lead logged to Google Sheet: ${email} | Summary: ${summary ? 'yes' : 'none'} | Recording: ${recordingUrl || 'none'}`);
    } catch (err) {
        console.warn('⚠️  Google Form submission failed (non-critical):', err.message);
        // Alert even though this is non-critical — data loss risk
        sendTelegramAlert(
            'Google Form Submission Failed',
            'Google Forms API → POST formResponse',
            err.message,
            { name, company, phone, email }
        );
    }
}

// ============================================================
// API: POST /api/start-agent
// Validates the lead, enforces the one-use restriction, and authorizes the
// in-browser voice agent. Does NOT submit the Google Sheet — that happens
// after the conversation via the Dograh webhook (POST /api/webhook/dograh).
// ============================================================
app.post('/api/start-agent', async (req, res) => {
    let { name, company, phone, email, turnstileToken } = req.body;

    // 1. Basic presence + type check
    if (!name || !company || !phone || !email ||
        typeof name    !== 'string' || typeof company !== 'string' ||
        typeof phone   !== 'string' || typeof email   !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: name, company, phone, email'
        });
    }

    // Normalise + cap lengths so oversized junk never reaches the sheet.
    name    = name.trim().slice(0, 100);
    company = company.trim().slice(0, 100);
    phone   = phone.trim().slice(0, 20);

    // 1b. Bot protection — verify Cloudflare Turnstile before doing anything else.
    //     Fails closed: no valid human token → no agent session.
    // Use forwarded header only — req.ip can throw in serverless (no standard socket).
    // remoteip is optional for Turnstile siteverify, so an empty value is fine.
    const remoteIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const humanVerified = await verifyTurnstile(turnstileToken, remoteIp);
    if (!humanVerified) {
        return res.status(403).json({
            success: false,
            error: 'Verification failed. Please complete the verification check and try again.'
        });
    }

    email = email.toLowerCase().trim();

    // 2. Business email validation
    if (!isBusinessEmail(email)) {
        return res.status(400).json({
            success: false,
            error: 'Please use a business email address. Gmail, Yahoo, and other personal/disposable addresses are not accepted.'
        });
    }

    // 3. One-use restriction (skip for whitelisted domains)
    if (!isWhitelisted(email) && await hasUsedEmail(email)) {
        console.log(`🚫 Restricted: ${email} already used a session.`);
        return res.status(200).json({ success: false, restricted: true });
    }

    // 4. Light phone-format validation (informational only — nothing is dialed)
    phone = phone.replace(/[\s\-().]/g, '');
    if (!phone.startsWith('+')) {
        phone = '+' + phone;
    }
    if (!isValidE164(phone)) {
        return res.status(400).json({
            success: false,
            error: 'Please enter a valid phone number.'
        });
    }

    // 5. Mark email as used (Edge Config — persistent across restarts).
    //    Consistent with the previous behaviour: the allowance is consumed when
    //    the session is authorized, whitelisted domains excepted.
    if (!isWhitelisted(email)) {
        await markEmailUsed(email);
    }

    console.log(`✅ Agent session authorized: ${name} (${company}) | ${email} | ${phone}`);
    res.json({ success: true });
});

// ============================================================
// WEBHOOK: POST /api/webhook/dograh
// Fired by the Dograh "Webhook Node" after a voice conversation ends. Carries
// the recording_url + transcript_url and our passed-in lead data (nested under
// initial_context). This is the authoritative writer to the Google Sheet — it
// is the only place that has the recording URL.
//
// Configure in Dograh: add a Webhook Node to the workflow pointing at
//   https://webcalls-for-convrs.vercel.app/api/webhook/dograh?secret=<WEBHOOK_SECRET>
// (or use a Bearer/Custom-Header credential carrying the same secret).
//
// Also mounted at /api/webhook/call-ended for backward-compatibility with the
// previously-configured webhook URL — both paths run the same handler.
// ============================================================
async function handleDograhWebhook(req, res) {
    // Auth: reject only an *explicitly wrong* secret. A request with no secret
    // is allowed through (so an existing webhook URL keeps working) but logged —
    // add the secret to the URL/credential to lock it down.
    if (WEBHOOK_SECRET) {
        const bearer   = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
        const provided = req.query.secret || req.headers['x-webhook-secret'] || bearer;
        if (provided && provided !== WEBHOOK_SECRET) {
            console.warn('🚫 Dograh webhook rejected — wrong secret provided');
            return res.status(401).json({ ok: false });
        }
        if (!provided) {
            console.warn('⚠️  Dograh webhook has no secret — processing anyway (add ?secret=… to authenticate)');
        }
    }

    const body          = req.body || {};
    // Log the raw payload so the exact shape Dograh sends stays visible in logs.
    try { console.log('📦 Dograh webhook payload:', JSON.stringify(body).slice(0, 1500)); } catch (_) {}

    const ic       = body.initial_context  || {};   // present only on the standard after-call webhook
    const gathered = body.gathered_context || {};

    // Be liberal about where each field might live across payload variants.
    const pick = (...vals) => { for (const v of vals) { if (v != null && String(v).trim() !== '') return String(v).trim(); } return ''; };

    const callId        = pick(body.call_id, body.workflow_run_id, body.workflowRunId, body.run_id);
    const duration      = pick(body.duration, body.duration_seconds, body.call_duration);
    const recordingUrl  = pick(body.recording_url, body.recordingUrl, ic.recording_url, gathered.recording_url);
    const userRecording = pick(body.user_recording_url);
    const botRecording  = pick(body.bot_recording_url);
    const transcriptUrl = pick(body.transcript_url, body.transcriptUrl, ic.transcript_url);

    // Lead identity — Dograh's Webhook Node only includes these if the workflow
    // maps them into the payload (e.g. email/customer_name/company_name/phone).
    const name    = pick(body.customer_name, body.name, body.full_name, body.first_name, ic.customer_name, ic.name).slice(0, 100);
    const company = pick(body.company_name, body.company, ic.company_name, ic.company).slice(0, 100);
    const phone   = pick(body.phone, body.phone_number, ic.phone).slice(0, 20);
    const email   = pick(body.business_email, body.email, ic.business_email, ic.email).toLowerCase();

    console.log(`📩 Dograh webhook: call=${callId || 'n/a'} | ${email || 'no-email'} | recording=${recordingUrl ? 'yes' : 'none'}`);

    // A real Dograh webhook always has a call_id and/or recording — write it.
    // (Drop only truly empty payloads.)
    if (!callId && !recordingUrl && !email) {
        console.warn('⚠️  Empty webhook payload — nothing to write');
        return res.json({ ok: true });
    }

    // Summary column: duration + transcript + per-speaker recordings + call id.
    const summary = [
        duration ? `Duration ${duration}s` : '',
        transcriptUrl ? `Transcript: ${transcriptUrl}` : '',
        botRecording ? `Agent audio: ${botRecording}` : '',
        userRecording ? `Caller audio: ${userRecording}` : '',
        callId ? `Dograh call #${callId}` : ''
    ].filter(Boolean).join(' — ') || 'Web voice-agent conversation.';

    await submitLead({ name, company, phone, email }, recordingUrl, summary);
    console.log(`✅ Webhook → sheet: ${email || '(no email)'} | recording=${recordingUrl ? 'yes' : 'no'}`);

    return res.json({ ok: true });
}

app.post('/api/webhook/dograh', handleDograhWebhook);
// Back-compat: the previously-configured Dograh webhook URL.
app.post('/api/webhook/call-ended', handleDograhWebhook);

// ============================================================
// SERVE STATIC FILES + HEALTH CHECK
// ============================================================
app.use(express.static(__dirname));

app.get('/health', (req, res) => res.json({ status: 'OK' }));

// ============================================================
// GLOBAL SAFETY NET — catch any unhandled crash and alert via Telegram
// ============================================================
process.on('unhandledRejection', (reason, promise) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error('🔥 Unhandled Promise Rejection:', msg);
    sendTelegramAlert(
        'Unhandled Promise Rejection',
        'Node.js process — unhandledRejection',
        msg
    );
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message);
    sendTelegramAlert(
        'Uncaught Exception — Server May Crash',
        'Node.js process — uncaughtException',
        err.message
    ).finally(() => process.exit(1)); // Exit after alert is sent
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Convrs AI server running on http://localhost:${PORT}`);
        console.log(`🎙️  Web voice agent: Dograh embed widget`);
        console.log(`🔒 Whitelist domains: ${[...WHITELIST_DOMAINS].join(', ')}`);
        console.log(`🔑 Agent gate: POST /api/start-agent  |  Sheet writer: POST /api/webhook/dograh`);
        console.log(`🪝  Dograh webhook auth: ${WEBHOOK_SECRET ? '✅ secret set' : '⚠️  UNAUTHENTICATED (set WEBHOOK_SECRET)'}`);
        console.log(`📨 Telegram alerts: ${TELEGRAM_BOT_TOKEN ? '✅ configured' : '⚠️  NOT configured (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)'}`);
    });
}

module.exports = app;
