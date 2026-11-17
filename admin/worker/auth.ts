import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';

export type Role = 'owner' | 'manager' | 'staff';
export type AdminUser = { id: number; name: string; email: string; role: Role };
export type AdminEnv = { DB: D1Database; MEDIA: R2Bucket; ASSETS: Fetcher; JWT_SECRET: string; STORE_URL: string };
export type AppEnv = { Bindings: AdminEnv; Variables: { user: AdminUser } };

const COOKIE = 'sl_admin';
const TTL = 60 * 60 * 12; // 12 hours
const ITER = 100_000; // max PBKDF2 iterations supported by Workers

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await derive(password, salt, ITER))}`;
}

export async function checkPassword(password: string, stored: string) {
  const [alg, iter, salt, hash] = stored.split('$');
  if (alg !== 'pbkdf2') return false;
  const got = new Uint8Array(await derive(password, unb64(salt), Number(iter)));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

export function passwordProblem(p: string) {
  if (!p || p.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

function secret(c: Context<AppEnv>) {
  const s = c.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET is not configured (needs 32+ characters).');
  return s;
}

export async function startSession(c: Context<AppEnv>, u: AdminUser) {
  const token = await sign({ sub: u.id, role: u.role, exp: Math.floor(Date.now() / 1000) + TTL }, secret(c), 'HS256');
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, COOKIE, token, { httpOnly: true, secure, sameSite: 'Strict', path: '/', maxAge: TTL });
}

export function endSession(c: Context<AppEnv>) {
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Requires a valid session; reloads the user so disabled accounts and role changes apply immediately. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return c.json({ error: 'Please sign in.' }, 401);
  let payload: any;
  try { payload = await verify(token, secret(c), 'HS256'); } catch { return c.json({ error: 'Your session has expired. Please sign in again.' }, 401); }
  const u = await c.env.DB.prepare("SELECT id, name, email, role FROM admin_users WHERE id = ? AND status = 'active'").bind(payload.sub).first<AdminUser>();
  if (!u) return c.json({ error: 'Please sign in.' }, 401);
  c.set('user', u);
  // Mutations must be JSON or uploads (blocks simple cross-site form posts; cookie is SameSite=Strict too)
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    const ct = c.req.header('content-type') || '';
    if (!ct.includes('application/json') && !ct.includes('multipart/form-data')) return c.json({ error: 'Unsupported request.' }, 415);
  }
  await next();
};

const RANK: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };
export const requireRole = (min: Role): MiddlewareHandler<AppEnv> => async (c, next) => {
  if (RANK[c.var.user.role] < RANK[min]) return c.json({ error: 'You do not have permission to do this.' }, 403);
  await next();
};
