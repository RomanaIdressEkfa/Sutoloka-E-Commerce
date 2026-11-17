import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { normalizePhone } from '../../shared/bd';
import { sendSms, smsEnabled } from '../../shared/sms';
import type { Env } from './data';

export type Customer = { id: number; name: string; phone: string; email: string | null; points: number; address: string | null; district: string | null };
type C = Context<{ Bindings: Env; Variables: any }>;

const COOKIE = 'sl_customer';
const TTL = 60 * 60 * 24 * 60; // 60 days
const OTP_TTL = 5 * 60_000;

function secret(c: C) {
  const s = c.env.CUSTOMER_SECRET;
  if (!s || s.length < 32) throw new Error('CUSTOMER_SECRET is not configured (needs 32+ characters).');
  return s;
}

async function sha(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function currentCustomer(c: C): Promise<Customer | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  try {
    const p: any = await verify(token, secret(c), 'HS256');
    return await c.env.DB.prepare('SELECT id, name, phone, email, points, address, district FROM customers WHERE id = ? AND blocked = 0').bind(p.sub).first<Customer>();
  } catch { return null; }
}

/** Step 1: send a 6-digit login code by SMS. */
export async function sendOtp(c: C, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: 'Enter a valid Bangladeshi mobile number (01XXXXXXXXX).' };
  const db = c.env.DB;
  const prev = await db.prepare('SELECT created_at, sent_count FROM customer_otps WHERE phone = ?').bind(phone).first<{ created_at: string; sent_count: number }>();
  const windowStart = Date.now() - 15 * 60_000;
  if (prev && Date.parse(prev.created_at) > windowStart && prev.sent_count >= 3) return { error: 'Too many codes requested. Please try again in 15 minutes.' };
  if (prev && Date.now() - Date.parse(prev.created_at) < 45_000 && prev.sent_count >= 1) return { error: 'Please wait a few seconds before requesting another code.' };

  const sms = await smsEnabled(db);
  const dev = c.env.DEV_MODE === '1';
  if (!sms && !dev) return { error: 'SMS login is not available right now. You can still check out as a guest.' };

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  const hash = await sha(`${phone}:${code}:${secret(c)}`);
  const count = prev && Date.parse(prev.created_at) > windowStart ? prev.sent_count + 1 : 1;
  await db.prepare(`INSERT INTO customer_otps (phone, code_hash, expires_at, attempts, sent_count, created_at) VALUES (?,?,?,0,?,?)
      ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_count = excluded.sent_count, created_at = excluded.created_at`)
    .bind(phone, hash, new Date(Date.now() + OTP_TTL).toISOString(), count, new Date().toISOString()).run();
  const store = await db.prepare("SELECT value FROM settings WHERE key = 'store'").first<{ value: string }>();
  const name = (() => { try { return JSON.parse(store!.value).name; } catch { return 'Sutoloka'; } })();
  if (sms) await sendSms(db, phone, `${code} is your ${name} login code. It expires in 5 minutes. Do not share it with anyone.`);
  return { ok: true, phone, devCode: !sms && dev ? code : undefined };
}

/** Step 2: verify the code, create the customer if new, and start a session. */
export async function verifyOtp(c: C, rawPhone: string, code: string, name?: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone || !/^\d{6}$/.test(String(code || ''))) return { error: 'Enter the 6-digit code.' };
  const db = c.env.DB;
  const row = await db.prepare('SELECT * FROM customer_otps WHERE phone = ?').bind(phone).first<any>();
  if (!row || Date.parse(row.expires_at) < Date.now()) return { error: 'This code has expired. Please request a new one.' };
  if (row.attempts >= 5) return { error: 'Too many wrong attempts. Please request a new code.' };
  if ((await sha(`${phone}:${code}:${secret(c)}`)) !== row.code_hash) {
    await db.prepare('UPDATE customer_otps SET attempts = attempts + 1 WHERE phone = ?').bind(phone).run();
    return { error: 'That code is not correct.' };
  }
  await db.prepare('DELETE FROM customer_otps WHERE phone = ?').bind(phone).run();
  const cleanName = String(name || '').trim().slice(0, 100);
  const cu = await db.prepare(`INSERT INTO customers (name, phone, last_login_at) VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET last_login_at = excluded.last_login_at, name = CASE WHEN ? <> '' THEN ? ELSE customers.name END
      RETURNING id, name, phone, blocked`).bind(cleanName || 'Customer', phone, new Date().toISOString(), cleanName, cleanName).first<any>();
  if (cu.blocked) return { error: 'This account is not available. Please contact us.' };
  const token = await sign({ sub: cu.id, exp: Math.floor(Date.now() / 1000) + TTL }, secret(c), 'HS256');
  setCookie(c, COOKIE, token, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Lax', path: '/', maxAge: TTL });
  return { ok: true, customer: { id: cu.id, name: cu.name, phone: cu.phone }, isNew: cu.name === 'Customer' };
}

export function logout(c: C) { deleteCookie(c, COOKIE, { path: '/' }); }
