import { Hono, type Context } from 'hono';
import { ORDER_STATUSES, STOCK_HOLDING, STATUS_LABEL, DISTRICTS, normalizePhone, zoneFor, pointsEarned, type OrderStatus, type RewardSettings } from '../../shared/bd';
import { createOrder, priceCart, getSetting, refreshProductStmt, refreshRatingStmt, OrderError, DEFAULT_REWARDS } from '../../shared/orders';
import { sendSms, smsEnabled } from '../../shared/sms';
import { requireAuth, requireRole, hashPassword, checkPassword, passwordProblem, startSession, endSession, type AppEnv, type AdminUser } from './auth';
import { book, status as courierStatus, isDelivered, trackingUrl, CourierError, type CourierName, type CourierSettings } from './courier';

const app = new Hono<AppEnv>().basePath('/admin/api');
type C = Context<AppEnv>;

const BD = "'+6 hours'";
const LOGIN_RE = /^[a-z0-9._@+-]{3,120}$/; // username or email // Bangladesh time offset for date grouping
const now = () => new Date().toISOString();
const int = (v: unknown, d = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };
const str = (v: unknown, max = 500) => (v == null ? '' : String(v).trim().slice(0, max));
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
const page = (c: C) => { const p = Math.max(1, int(c.req.query('page'), 1)); const per = Math.min(100, Math.max(5, int(c.req.query('per'), 25))); return { p, per, off: (p - 1) * per }; };
const bad = (c: C, msg: string, code: 400 | 404 | 409 | 422 = 400) => c.json({ error: msg }, code);
const event = (db: D1Database, orderId: number, type: string, message: string, u?: AdminUser) =>
  db.prepare('INSERT INTO order_events (order_id, type, message, user_id, user_name) VALUES (?,?,?,?,?)').bind(orderId, type, message, u?.id ?? null, u?.name ?? null);

app.onError((e, c) => {
  if (e instanceof OrderError) return c.json({ error: e.message, field: e.field }, 422);
  if (e instanceof CourierError) return c.json({ error: e.message }, 502);
  console.error(e);
  return c.json({ error: 'Something went wrong on the server.' }, 500);
});

// ================= Auth =================
app.get('/auth/setup', async (c) => {
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first<{ n: number }>();
  return c.json({ needed: !n?.n });
});

// First-run: create the owner account (only works while no admin users exist)
app.post('/auth/setup', async (c) => {
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first<{ n: number }>();
  if (n?.n) return bad(c, 'Setup is already complete.', 409);
  const b = await c.req.json().catch(() => ({}));
  const name = str(b.name, 80), email = str(b.email, 120).toLowerCase();
  if (name.length < 2 || !LOGIN_RE.test(email)) return bad(c, 'Enter your name and a username (letters, numbers, . _ -) or email.');
  const pp = passwordProblem(b.password); if (pp) return bad(c, pp);
  const r = await c.env.DB.prepare("INSERT INTO admin_users (name, email, password_hash, role) VALUES (?,?,?, 'owner') RETURNING id, name, email, role")
    .bind(name, email, await hashPassword(b.password)).first<AdminUser>();
  await startSession(c, r!);
  return c.json({ user: r });
});

app.post('/auth/login', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const email = str(b.email, 120).toLowerCase();
  const ip = c.req.header('cf-connecting-ip') || '';
  const db = c.env.DB;
  const fails = await db.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE (email = ? OR ip = ?) AND ok = 0 AND created_at > ?")
    .bind(email, ip, new Date(Date.now() - 15 * 60_000).toISOString()).first<{ n: number }>();
  if ((fails?.n || 0) >= 8) return c.json({ error: 'Too many failed attempts. Please wait 15 minutes and try again.' }, 429);
  const u = await db.prepare("SELECT * FROM admin_users WHERE email = ? AND status = 'active'").bind(email).first<any>();
  const ok = !!u && (await checkPassword(String(b.password || ''), u.password_hash));
  await db.prepare('INSERT INTO login_attempts (email, ip, ok) VALUES (?,?,?)').bind(email, ip, ok ? 1 : 0).run();
  if (!ok) return c.json({ error: 'Incorrect username or password.' }, 401);
  await db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').bind(now(), u.id).run();
  const user = { id: u.id, name: u.name, email: u.email, role: u.role };
  await startSession(c, user);
  return c.json({ user });
});

app.post('/auth/logout', (c) => { endSession(c); return c.json({ ok: true }); });

app.use('/*', async (c, next) => (c.req.path.startsWith('/admin/api/auth/') && c.req.path !== '/admin/api/auth/me' && c.req.path !== '/admin/api/auth/password') ? next() : requireAuth(c, next));

app.get('/auth/me', (c) => c.json({ user: c.var.user, storeUrl: c.env.STORE_URL }));
app.post('/auth/password', async (c) => {
  const b = await c.req.json();
  const u = await c.env.DB.prepare('SELECT password_hash FROM admin_users WHERE id = ?').bind(c.var.user.id).first<any>();
  if (!(await checkPassword(String(b.current || ''), u.password_hash))) return bad(c, 'Your current password is incorrect.');
  const pp = passwordProblem(b.password); if (pp) return bad(c, pp);
  await c.env.DB.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(await hashPassword(b.password), c.var.user.id).run();
  return c.json({ ok: true });
});

// ================= Dashboard =================
app.get('/dashboard', async (c) => {
  const db = c.env.DB;
  const days = Math.min(90, Math.max(7, int(c.req.query('days'), 30)));
  const today = `date('now', ${BD})`;
  const [kpi, series, statuses, recent, top, low] = await db.batch([
    db.prepare(`SELECT
        COUNT(CASE WHEN date(created_at, ${BD}) = ${today} THEN 1 END) AS today_orders,
        COALESCE(SUM(CASE WHEN date(created_at, ${BD}) = ${today} AND status NOT IN ('cancelled','returned') THEN total END), 0) AS today_sales,
        COUNT(CASE WHEN date(created_at, ${BD}) >= date('now', ${BD}, '-${days - 1} days') THEN 1 END) AS period_orders,
        COALESCE(SUM(CASE WHEN date(created_at, ${BD}) >= date('now', ${BD}, '-${days - 1} days') AND status NOT IN ('cancelled','returned') THEN total END), 0) AS period_sales,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
        COUNT(CASE WHEN status IN ('confirmed','processing') THEN 1 END) AS to_ship,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) AS in_transit,
        COALESCE(SUM(CASE WHEN status = 'shipped' THEN total - advance_paid END), 0) AS cod_pending
      FROM orders`),
    db.prepare(`SELECT date(created_at, ${BD}) AS day, COUNT(*) AS orders, COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','returned') THEN total END), 0) AS sales
      FROM orders WHERE date(created_at, ${BD}) >= date('now', ${BD}, '-${days - 1} days') GROUP BY day ORDER BY day`),
    db.prepare(`SELECT status, COUNT(*) AS n FROM orders WHERE date(created_at, ${BD}) >= date('now', ${BD}, '-${days - 1} days') GROUP BY status`),
    db.prepare('SELECT id, order_no, name, phone, district, total, status, created_at FROM orders ORDER BY id DESC LIMIT 8'),
    db.prepare(`SELECT oi.product_id, oi.name, SUM(oi.qty) AS qty, SUM(oi.total) AS sales, MAX(oi.image) AS image FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('cancelled','returned') AND date(o.created_at, ${BD}) >= date('now', ${BD}, '-${days - 1} days') GROUP BY oi.product_id, oi.name ORDER BY qty DESC LIMIT 6`),
    db.prepare(`SELECT (SELECT COUNT(*) FROM variants v JOIN products p ON p.id = v.product_id WHERE v.status = 'active' AND p.status = 'active' AND v.stock BETWEEN 1 AND 3) AS n,
        (SELECT COUNT(*) FROM reviews WHERE status = 'pending') AS reviews,
        (SELECT COUNT(*) FROM checkout_drafts WHERE status = 'open' AND updated_at < ?) AS abandoned,
        (SELECT COUNT(DISTINCT variant_id) FROM stock_alerts WHERE notified_at IS NULL) AS alerts`).bind(new Date(Date.now() - 30 * 60_000).toISOString()),
  ]);
  return c.json({ days, kpi: kpi.results[0], series: series.results, statuses: statuses.results, recent: recent.results, top: top.results, lowStock: (low.results[0] as any).n, pendingReviews: (low.results[0] as any).reviews, abandoned: (low.results[0] as any).abandoned, stockAlerts: (low.results[0] as any).alerts });
});

// ================= Orders =================
function orderFilters(c: C) {
  const where: string[] = [];
  const args: unknown[] = [];
  const s = c.req.query('status');
  if (s && (ORDER_STATUSES as readonly string[]).includes(s)) { where.push('o.status = ?'); args.push(s); }
  const q = str(c.req.query('q'), 80);
  if (q) {
    const phone = normalizePhone(q);
    where.push('(o.order_no LIKE ? OR o.name LIKE ? OR o.phone LIKE ? OR o.tracking_code = ?)');
    args.push(`%${q}%`, `%${q}%`, `%${phone || q}%`, q);
  }
  const from = c.req.query('from'), to = c.req.query('to');
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { where.push(`date(o.created_at, ${BD}) >= ?`); args.push(from); }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) { where.push(`date(o.created_at, ${BD}) <= ?`); args.push(to); }
  const src = c.req.query('source'); if (src) { where.push('o.source = ?'); args.push(src); }
  const courier = c.req.query('courier'); if (courier) { where.push('o.courier = ?'); args.push(courier); }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
}

app.get('/orders', async (c) => {
  const { p, per, off } = page(c);
  const f = orderFilters(c);
  const db = c.env.DB;
  const [count, rows, counts] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM orders o ${f.sql}`).bind(...f.args),
    db.prepare(`SELECT o.id, o.order_no, o.name, o.phone, o.district, o.zone, o.total, o.advance_paid, o.status, o.payment_status, o.courier, o.tracking_code, o.source, o.created_at,
        (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS items,
        (SELECT COUNT(*) FROM orders o2 WHERE o2.phone = o.phone) AS customer_orders,
        (SELECT COUNT(*) FROM orders o3 WHERE o3.phone = o.phone AND o3.status IN ('cancelled','returned')) AS customer_failed
      FROM orders o ${f.sql} ORDER BY o.id DESC LIMIT ? OFFSET ?`).bind(...f.args, per, off),
    db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status'),
  ]);
  const total = (count.results[0] as any).n;
  return c.json({ rows: rows.results, total, page: p, pages: Math.max(1, Math.ceil(total / per)), counts: Object.fromEntries((counts.results as any[]).map((r) => [r.status, r.n])) });
});

app.get('/orders/export', requireRole('manager'), async (c) => {
  const f = orderFilters(c);
  const rows = await c.env.DB.prepare(`SELECT o.order_no, datetime(o.created_at, ${BD}) AS created, o.status, o.name, o.phone, o.district, o.area, o.address, o.subtotal, o.delivery_fee, o.discount, o.total, o.advance_paid, o.payment_status, o.courier, o.tracking_code, o.source,
      (SELECT GROUP_CONCAT(name || ' [' || COALESCE(color,'') || ' ' || COALESCE(size,'') || '] x' || qty, '; ') FROM order_items WHERE order_id = o.id) AS items
    FROM orders o ${f.sql} ORDER BY o.id DESC LIMIT 20000`).bind(...f.args).all<any>();
  const cols = ['order_no', 'created', 'status', 'name', 'phone', 'district', 'area', 'address', 'items', 'subtotal', 'delivery_fee', 'discount', 'total', 'advance_paid', 'payment_status', 'courier', 'tracking_code', 'source'];
  const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '﻿' + [cols.join(','), ...rows.results.map((r) => cols.map((k) => cell(r[k])).join(','))].join('\n');
  return c.body(csv, 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` });
});

async function loadOrder(db: D1Database, id: number) {
  const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
  if (!o) return null;
  const [items, events, history] = await db.batch([
    db.prepare('SELECT oi.*, v.stock AS current_stock FROM order_items oi LEFT JOIN variants v ON v.id = oi.variant_id WHERE oi.order_id = ? ORDER BY oi.id').bind(id),
    db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id DESC').bind(id),
    db.prepare(`SELECT COUNT(*) AS orders, COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS delivered, COUNT(CASE WHEN status IN ('cancelled','returned') THEN 1 END) AS failed,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN total END), 0) AS spent FROM orders WHERE phone = ?`).bind(o.phone),
  ]);
  return { ...o, items: items.results, events: events.results, customer: history.results[0], tracking_url: o.courier && o.tracking_code ? trackingUrl(o.courier, o.tracking_code) : null };
}

app.get('/orders/:id{[0-9]+}', async (c) => {
  const o = await loadOrder(c.env.DB, int(c.req.param('id')));
  return o ? c.json(o) : bad(c, 'Order not found.', 404);
});

// Manual order (phone / Facebook / WhatsApp)
app.post('/orders', async (c) => {
  const b = await c.req.json();
  const res = await createOrder(c.env.DB, {
    items: b.items || [], name: b.name, phone: b.phone, email: b.email, address: b.address, district: b.district, area: b.area, zone: b.zone, note: b.note,
    coupon: b.coupon || undefined, source: b.source || 'phone', status: 'confirmed', deliveryFeeOverride: b.delivery_fee ?? null,
    extraDiscount: int(b.discount), advancePaid: int(b.advance_paid), userId: c.var.user.id, userName: c.var.user.name,
  });
  const o = await c.env.DB.prepare('SELECT id FROM orders WHERE order_no = ?').bind(res.orderNo).first<{ id: number }>();
  return c.json({ id: o!.id, orderNo: res.orderNo });
});

/** Builds the statements for a status change, including stock release / re-reservation. */
async function statusStatements(db: D1Database, o: any, next: OrderStatus, u: AdminUser, note?: string) {
  const stmts: D1PreparedStatement[] = [];
  const before = STOCK_HOLDING.includes(o.status), after = STOCK_HOLDING.includes(next);
  const items = (await db.prepare('SELECT variant_id, product_id, qty FROM order_items WHERE order_id = ?').bind(o.id).all<any>()).results;
  if (before !== after) {
    const sign = after ? -1 : 1;
    for (const it of items) {
      if (!it.variant_id) continue;
      stmts.push(
        db.prepare('UPDATE variants SET stock = MAX(0, stock + ?) WHERE id = ?').bind(sign * it.qty, it.variant_id),
        db.prepare('INSERT INTO stock_movements (variant_id, change, reason, ref, user_id) VALUES (?,?,?,?,?)').bind(it.variant_id, sign * it.qty, after ? 'order' : next === 'returned' ? 'return' : 'cancel', o.order_no, u.id),
      );
    }
    for (const pid of new Set(items.map((i) => i.product_id).filter(Boolean))) stmts.push(refreshProductStmt(db, pid as number));
  }
  if (before !== after) {
    const sign = after ? 1 : -1;
    for (const it of items) if (it.product_id) stmts.push(db.prepare('UPDATE products SET sold_count = MAX(0, sold_count + ?) WHERE id = ?').bind(sign * it.qty, it.product_id));
  }
  // Reward points: earn on delivery, reverse on return; give back redeemed points when the order fails
  if (o.customer_id) {
    const rewards = await getSetting<RewardSettings>(db, 'rewards', DEFAULT_REWARDS);
    if (next === 'delivered' && !o.points_earned) {
      const pts = pointsEarned(o.total, rewards);
      if (pts > 0) stmts.push(
        db.prepare('UPDATE customers SET points = points + ? WHERE id = ?').bind(pts, o.customer_id),
        db.prepare("INSERT INTO points_ledger (customer_id, change, reason, order_id) VALUES (?, ?, 'earned', ?)").bind(o.customer_id, pts, o.id),
        db.prepare('UPDATE orders SET points_earned = ? WHERE id = ?').bind(pts, o.id),
      );
    }
    if (o.status === 'delivered' && next !== 'delivered' && o.points_earned) stmts.push(
      db.prepare('UPDATE customers SET points = MAX(0, points - ?) WHERE id = ?').bind(o.points_earned, o.customer_id),
      db.prepare("INSERT INTO points_ledger (customer_id, change, reason, order_id) VALUES (?, ?, 'reversed', ?)").bind(o.customer_id, -o.points_earned, o.id),
      db.prepare('UPDATE orders SET points_earned = 0 WHERE id = ?').bind(o.id),
    );
    if (before && !after && o.points_used) stmts.push(
      db.prepare('UPDATE customers SET points = points + ? WHERE id = ?').bind(o.points_used, o.customer_id),
      db.prepare("INSERT INTO points_ledger (customer_id, change, reason, order_id) VALUES (?, ?, 'refund', ?)").bind(o.customer_id, o.points_used, o.id),
    );
    if (!before && after && o.points_used) stmts.push(
      db.prepare('UPDATE customers SET points = MAX(0, points - ?) WHERE id = ?').bind(o.points_used, o.customer_id),
      db.prepare("INSERT INTO points_ledger (customer_id, change, reason, order_id) VALUES (?, ?, 'redeemed', ?)").bind(o.customer_id, -o.points_used, o.id),
    );
  }
  const paid = next === 'delivered' ? ", payment_status = 'paid'" : '';
  stmts.push(db.prepare(`UPDATE orders SET status = ?, updated_at = ?${paid} WHERE id = ?`).bind(next, now(), o.id));
  stmts.push(event(db, o.id, 'status', `Status changed: ${STATUS_LABEL[o.status as OrderStatus]} → ${STATUS_LABEL[next]}${note ? ` — ${note}` : ''}`, u));
  return stmts;
}

app.post('/orders/:id{[0-9]+}/status', async (c) => {
  const db = c.env.DB;
  const b = await c.req.json();
  const next = b.status as OrderStatus;
  if (!ORDER_STATUSES.includes(next)) return bad(c, 'Unknown status.');
  const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(int(c.req.param('id'))).first<any>();
  if (!o) return bad(c, 'Order not found.', 404);
  if (o.status === next) return c.json(await loadOrder(db, o.id));
  await db.batch(await statusStatements(db, o, next, c.var.user, str(b.note, 300)));
  return c.json(await loadOrder(db, o.id));
});

app.post('/orders/bulk-status', async (c) => {
  const db = c.env.DB;
  const b = await c.req.json();
  const next = b.status as OrderStatus;
  if (!ORDER_STATUSES.includes(next)) return bad(c, 'Unknown status.');
  const ids = (Array.isArray(b.ids) ? b.ids : []).map((x: unknown) => int(x)).filter((x: number) => x > 0).slice(0, 200);
  let changed = 0;
  for (const id of ids) {
    const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
    if (!o || o.status === next) continue;
    await db.batch(await statusStatements(db, o, next, c.var.user));
    changed++;
  }
  return c.json({ changed });
});

app.patch('/orders/:id{[0-9]+}', async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
  if (!o) return bad(c, 'Order not found.', 404);
  const b = await c.req.json();
  const phone = b.phone !== undefined ? normalizePhone(b.phone) : o.phone;
  if (!phone) return bad(c, 'Enter a valid Bangladeshi mobile number.');
  const district = b.district !== undefined ? String(b.district) : o.district;
  if (!DISTRICTS.includes(district)) return bad(c, 'Choose a valid district.');
  const zone = zoneFor(district, b.zone ?? o.zone);
  const delivery_fee = b.delivery_fee !== undefined ? Math.max(0, int(b.delivery_fee)) : o.delivery_fee;
  const afterOffer = o.subtotal - o.offer_discount;
  const discount = b.discount !== undefined ? Math.max(0, Math.min(afterOffer, int(b.discount))) : o.discount;
  const total = afterOffer + delivery_fee - discount;
  const advance = b.advance_paid !== undefined ? Math.max(0, Math.min(total, int(b.advance_paid))) : Math.min(o.advance_paid, total);
  const payment_status = b.payment_status && ['unpaid', 'partial', 'paid', 'refunded'].includes(b.payment_status) ? b.payment_status
    : advance >= total ? 'paid' : advance > 0 ? 'partial' : o.payment_status === 'paid' && o.status === 'delivered' ? 'paid' : 'unpaid';
  const fields = {
    name: b.name !== undefined ? str(b.name, 100) : o.name, phone, email: b.email !== undefined ? str(b.email, 120) || null : o.email,
    address: b.address !== undefined ? str(b.address) : o.address, district, area: b.area !== undefined ? str(b.area, 100) || null : o.area, zone,
    note: b.note !== undefined ? str(b.note) || null : o.note, delivery_fee, discount, total, advance_paid: advance, payment_status,
    courier: b.courier !== undefined ? str(b.courier, 30) || null : o.courier, tracking_code: b.tracking_code !== undefined ? str(b.tracking_code, 80) || null : o.tracking_code,
  };
  const changed = Object.entries(fields).filter(([k, v]) => String(v ?? '') !== String(o[k] ?? '')).map(([k]) => k.replace('_', ' '));
  if (!changed.length) return c.json(await loadOrder(db, id));
  await db.batch([
    db.prepare(`UPDATE orders SET ${Object.keys(fields).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...Object.values(fields), now(), id),
    event(db, id, 'edit', `Updated ${changed.join(', ')}`, c.var.user),
  ]);
  return c.json(await loadOrder(db, id));
});

// Replace the items of an order (size/colour change on confirmation call). Adjusts stock by the difference.
app.put('/orders/:id{[0-9]+}/items', async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
  if (!o) return bad(c, 'Order not found.', 404);
  if (!['pending', 'confirmed', 'processing'].includes(o.status)) return bad(c, 'Items can only be changed before the order is shipped.');
  const b = await c.req.json();
  const wanted: { variantId: number; qty: number; price?: number }[] = (b.items || []).map((i: any) => ({ variantId: int(i.variantId), qty: Math.max(1, Math.min(50, int(i.qty, 1))), price: i.price != null ? Math.max(0, int(i.price)) : undefined }));
  if (!wanted.length) return bad(c, 'An order needs at least one item. Cancel the order instead.');
  const old = (await db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all<any>()).results;
  const oldQty = new Map<number, number>();
  old.forEach((i) => i.variant_id && oldQty.set(i.variant_id, (oldQty.get(i.variant_id) || 0) + i.qty));
  const lines = await priceCart(db, wanted.map((w) => ({ variantId: w.variantId, qty: w.qty })));
  if (lines.length !== wanted.length) return bad(c, 'One of the products no longer exists.');
  for (const l of lines) if (l.stock + (oldQty.get(l.variantId) || 0) < l.qty) return bad(c, `Not enough stock for ${l.name} (${l.color} ${l.size}). Available: ${l.stock + (oldQty.get(l.variantId) || 0)}.`);
  const newQty = new Map<number, number>();
  lines.forEach((l) => newQty.set(l.variantId, (newQty.get(l.variantId) || 0) + l.qty));
  const stmts: D1PreparedStatement[] = [db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(id)];
  let subtotal = 0;
  lines.forEach((l, i) => {
    const price = wanted[i].price ?? l.price;
    subtotal += price * l.qty;
    stmts.push(db.prepare('INSERT INTO order_items (order_id, product_id, variant_id, name, sku, color, size, image, price, qty, total) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, l.productId, l.variantId, l.name, l.sku, l.color, l.size, l.image, price, l.qty, price * l.qty));
  });
  const touched = new Set<number>([...oldQty.keys(), ...newQty.keys()]);
  const products = new Set<number>([...old.map((i) => i.product_id), ...lines.map((l) => l.productId)].filter(Boolean));
  for (const vid of touched) {
    const diff = (oldQty.get(vid) || 0) - (newQty.get(vid) || 0); // positive → back to stock
    if (!diff) continue;
    stmts.push(db.prepare('UPDATE variants SET stock = MAX(0, stock + ?) WHERE id = ?').bind(diff, vid),
      db.prepare('INSERT INTO stock_movements (variant_id, change, reason, ref, user_id) VALUES (?,?,?,?,?)').bind(vid, diff, 'order-edit', o.order_no, c.var.user.id));
  }
  for (const pid of products) stmts.push(refreshProductStmt(db, pid));
  const offer = Math.min(o.offer_discount, subtotal);
  const discount = Math.min(o.discount, subtotal - offer);
  const total = subtotal - offer + o.delivery_fee - discount;
  stmts.push(db.prepare('UPDATE orders SET subtotal = ?, offer_discount = ?, discount = ?, total = ?, advance_paid = MIN(advance_paid, ?), updated_at = ? WHERE id = ?').bind(subtotal, offer, discount, total, total, now(), id));
  stmts.push(event(db, id, 'edit', `Items updated: ${lines.map((l) => `${l.name} (${[l.color, l.size].filter(Boolean).join(' ')}) ×${l.qty}`).join(', ')}`, c.var.user));
  await db.batch(stmts);
  return c.json(await loadOrder(db, id));
});

app.post('/orders/:id{[0-9]+}/notes', async (c) => {
  const b = await c.req.json();
  const msg = str(b.message, 1000);
  if (!msg) return bad(c, 'Write a note first.');
  const id = int(c.req.param('id'));
  await event(c.env.DB, id, 'note', msg, c.var.user).run();
  return c.json(await loadOrder(c.env.DB, id));
});

app.post('/orders/:id{[0-9]+}/courier', async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
  if (!o) return bad(c, 'Order not found.', 404);
  if (o.consignment_id) return bad(c, `Already booked with ${o.courier} (${o.tracking_code}).`, 409);
  if (!['confirmed', 'processing'].includes(o.status)) return bad(c, 'Confirm the order before booking a courier.');
  const b = await c.req.json();
  const courier = b.courier as CourierName;
  if (!['steadfast', 'pathao', 'redx'].includes(courier)) return bad(c, 'Choose a courier.');
  const cfg = await getSetting<CourierSettings>(db, 'courier', { steadfast: { api_key: '', secret_key: '' }, pathao: { client_id: '', client_secret: '', username: '', password: '', store_id: '' }, redx: { token: '' } });
  const items = (await db.prepare('SELECT name, qty FROM order_items WHERE order_id = ?').bind(id).all<any>()).results;
  const res = await book(courier, cfg, {
    invoice: o.order_no, name: o.name, phone: o.phone, address: o.address, district: o.district, area: o.area,
    cod: Math.max(0, o.total - o.advance_paid), note: b.note ?? o.note, items: items.reduce((s, i) => s + i.qty, 0), description: items.map((i) => `${i.name} x${i.qty}`).join(', '),
  });
  const o2 = { ...o };
  const stmts = [
    db.prepare('UPDATE orders SET courier = ?, consignment_id = ?, tracking_code = ?, courier_status = ?, updated_at = ? WHERE id = ?').bind(courier, res.consignment_id, res.tracking_code, res.status, now(), id),
    event(db, id, 'courier', `Booked with ${courier} — tracking ${res.tracking_code}`, c.var.user),
  ];
  if (o2.status !== 'shipped') stmts.push(...(await statusStatements(db, o2, 'shipped', c.var.user, 'handed to courier')));
  await db.batch(stmts);
  return c.json(await loadOrder(db, id));
});

app.post('/orders/:id{[0-9]+}/courier/refresh', async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const o = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
  if (!o?.consignment_id || !o.courier) return bad(c, 'This order has not been booked with a courier.');
  const cfg = await getSetting<CourierSettings>(db, 'courier', {} as any);
  const st = await courierStatus(o.courier, cfg, o.consignment_id);
  const stmts = [db.prepare('UPDATE orders SET courier_status = ?, updated_at = ? WHERE id = ?').bind(st, now(), id)];
  if (st !== o.courier_status) stmts.push(event(db, id, 'courier', `Courier status: ${st}`, c.var.user));
  if (isDelivered(st) && o.status === 'shipped') stmts.push(...(await statusStatements(db, o, 'delivered', c.var.user, 'confirmed by courier')));
  await db.batch(stmts);
  return c.json(await loadOrder(db, id));
});

// ================= Products =================
app.get('/products', async (c) => {
  const { p, per, off } = page(c);
  const where: string[] = [];
  const args: unknown[] = [];
  const q = str(c.req.query('q'), 80);
  if (q) { where.push('(p.name LIKE ? OR p.id IN (SELECT product_id FROM variants WHERE sku LIKE ?))'); args.push(`%${q}%`, `%${q}%`); }
  const cat = int(c.req.query('category'));
  if (cat) { where.push('(p.category_id = ? OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ?) OR p.id IN (SELECT product_id FROM product_categories WHERE category_id = ?))'); args.push(cat, cat, cat); }
  const st = c.req.query('status');
  if (st && ['active', 'draft', 'archived'].includes(st)) { where.push('p.status = ?'); args.push(st); } else where.push("p.status <> 'archived'");
  const stock = c.req.query('stock');
  if (stock === 'out') where.push('p.total_stock = 0');
  if (stock === 'low') where.push('p.id IN (SELECT product_id FROM variants WHERE stock BETWEEN 1 AND 3 AND status = \'active\')');
  const sql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sort = ({ new: 'p.id DESC', name: 'p.name', price: 'p.min_price', stock: 'p.total_stock', updated: 'p.updated_at DESC' } as Record<string, string>)[c.req.query('sort') || 'new'] || 'p.id DESC';
  const db = c.env.DB;
  const [count, rows] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM products p ${sql}`).bind(...args),
    db.prepare(`SELECT p.id, p.name, p.slug, p.thumbnail, p.status, p.featured, p.min_price, p.max_price, p.total_stock, p.updated_at, c.name AS category,
        (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.id AND v.status = 'active') AS variant_count,
        (SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled','returned')) AS sold
      FROM products p LEFT JOIN categories c ON c.id = p.category_id ${sql} ORDER BY ${sort} LIMIT ? OFFSET ?`).bind(...args, per, off),
  ]);
  const total = (count.results[0] as any).n;
  return c.json({ rows: rows.results, total, page: p, pages: Math.max(1, Math.ceil(total / per)) });
});

app.get('/products/:id{[0-9]+}', async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const p = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<any>();
  if (!p) return bad(c, 'Product not found.', 404);
  const [v, pc] = await db.batch([
    db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY sort, id').bind(id),
    db.prepare('SELECT category_id FROM product_categories WHERE product_id = ?').bind(id),
  ]);
  return c.json({ ...p, variants: (v.results as any[]).map((x) => ({ ...x, images: JSON.parse(x.images || '[]') })), extra_categories: (pc.results as any[]).map((x) => x.category_id) });
});

// Variant lookup for building manual orders / editing order items
app.get('/variants/search', async (c) => {
  const q = str(c.req.query('q'), 80);
  if (q.length < 2) return c.json([]);
  const r = await c.env.DB.prepare(`SELECT v.id, v.sku, v.color, v.size, v.sale_price, v.stock, p.name, p.thumbnail FROM variants v JOIN products p ON p.id = v.product_id
     WHERE v.status = 'active' AND p.status = 'active' AND (p.name LIKE ? OR v.sku LIKE ?) ORDER BY v.stock = 0, p.name, v.sort LIMIT 40`).bind(`%${q}%`, `%${q}%`).all();
  return c.json(r.results);
});

async function saveProduct(c: C, id: number | null) {
  const db = c.env.DB;
  const b = await c.req.json();
  const name = str(b.name, 160);
  if (name.length < 2) return bad(c, 'Product name is required.');
  let slug = slugify(str(b.slug, 160) || name);
  if (!slug) return bad(c, 'Enter a valid URL slug.');
  const clash = await db.prepare('SELECT id FROM products WHERE slug = ? AND id IS NOT ?').bind(slug, id).first();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const variants: any[] = Array.isArray(b.variants) ? b.variants : [];
  if (!variants.length) return bad(c, 'Add at least one variant (size/colour) with a price.');
  for (const v of variants) {
    if (int(v.price) <= 0) return bad(c, 'Every variant needs a price.');
    if (int(v.sale_price, int(v.price)) > int(v.price)) return bad(c, 'Sale price cannot be higher than the regular price.');
  }
  const status = ['active', 'draft', 'archived'].includes(b.status) ? b.status : 'draft';
  const category_id = int(b.category_id) || null;
  const images = (x: unknown) => JSON.stringify((Array.isArray(x) ? x : []).map((s) => str(s, 500)).filter(Boolean).slice(0, 12));
  const u = c.var.user;

  const stmts: D1PreparedStatement[] = [];
  let pid = id;
  if (pid == null) {
    const r = await db.prepare('INSERT INTO products (name, slug, category_id, description, thumbnail, featured, status, seo_title) VALUES (?,?,?,?,?,?,?,?) RETURNING id')
      .bind(name, slug, category_id, str(b.description, 5000), str(b.thumbnail, 500) || null, b.featured ? 1 : 0, status, str(b.seo_title, 160) || null).first<{ id: number }>();
    pid = r!.id;
  } else {
    stmts.push(db.prepare('UPDATE products SET name = ?, slug = ?, category_id = ?, description = ?, thumbnail = ?, featured = ?, status = ?, seo_title = ? WHERE id = ?')
      .bind(name, slug, category_id, str(b.description, 5000), str(b.thumbnail, 500) || null, b.featured ? 1 : 0, status, str(b.seo_title, 160) || null, pid));
  }
  stmts.push(db.prepare('DELETE FROM product_categories WHERE product_id = ?').bind(pid));
  for (const cid of new Set((b.extra_categories || []).map((x: unknown) => int(x)).filter((x: number) => x && x !== category_id))) {
    stmts.push(db.prepare('INSERT OR IGNORE INTO product_categories (product_id, category_id) VALUES (?,?)').bind(pid, cid));
  }

  const existing = (await db.prepare('SELECT id, stock FROM variants WHERE product_id = ?').bind(pid).all<any>()).results;
  const exStock = new Map(existing.map((v) => [v.id, v.stock]));
  const keep = new Set<number>();
  variants.forEach((v, i) => {
    const price = int(v.price), sale = int(v.sale_price, price) || price, stock = Math.max(0, int(v.stock));
    const sku = str(v.sku, 80) || `${slug.toUpperCase().slice(0, 20)}-${i + 1}`;
    const vid = int(v.id);
    if (vid && exStock.has(vid)) {
      keep.add(vid);
      stmts.push(db.prepare('UPDATE variants SET sku = ?, color = ?, size = ?, option = ?, price = ?, sale_price = ?, stock = ?, images = ?, status = ?, sort = ? WHERE id = ?')
        .bind(sku, str(v.color, 60), str(v.size, 60), str(v.option, 60), price, sale, stock, images(v.images), v.status === 'inactive' ? 'inactive' : 'active', i, vid));
      const diff = stock - (exStock.get(vid) as number);
      if (diff) stmts.push(db.prepare('INSERT INTO stock_movements (variant_id, change, reason, ref, user_id) VALUES (?,?,?,?,?)').bind(vid, diff, 'adjust', 'product edit', u.id));
    } else {
      stmts.push(db.prepare('INSERT INTO variants (product_id, sku, color, size, option, price, sale_price, stock, images, status, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(pid, sku, str(v.color, 60), str(v.size, 60), str(v.option, 60), price, sale, stock, images(v.images), v.status === 'inactive' ? 'inactive' : 'active', i));
    }
  });
  for (const ex of existing) {
    if (keep.has(ex.id)) continue;
    // Variants used in orders are deactivated, not deleted, so order history stays intact
    stmts.push(db.prepare(`UPDATE variants SET status = 'inactive', stock = 0 WHERE id = ?1 AND EXISTS (SELECT 1 FROM order_items WHERE variant_id = ?1)`).bind(ex.id));
    stmts.push(db.prepare('DELETE FROM variants WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM order_items WHERE variant_id = ?1)').bind(ex.id));
  }
  stmts.push(refreshProductStmt(db, pid));
  await db.batch(stmts);
  return c.json({ id: pid, slug });
}

app.post('/products', requireRole('manager'), (c) => saveProduct(c, null));
app.put('/products/:id{[0-9]+}', requireRole('manager'), (c) => saveProduct(c, int(c.req.param('id'))));
app.delete('/products/:id{[0-9]+}', requireRole('manager'), async (c) => {
  await c.env.DB.prepare("UPDATE products SET status = 'archived', updated_at = ? WHERE id = ?").bind(now(), int(c.req.param('id'))).run();
  return c.json({ ok: true });
});

// ================= Inventory =================
app.get('/inventory', async (c) => {
  const { p, per, off } = page(c);
  const where = ["v.status = 'active'", "p.status <> 'archived'"];
  const args: unknown[] = [];
  const f = c.req.query('filter');
  if (f === 'low') where.push('v.stock BETWEEN 1 AND 3');
  if (f === 'out') where.push('v.stock = 0');
  const q = str(c.req.query('q'), 80);
  if (q) { where.push('(p.name LIKE ? OR v.sku LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  const sql = where.join(' AND ');
  const db = c.env.DB;
  const [count, rows] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM variants v JOIN products p ON p.id = v.product_id WHERE ${sql}`).bind(...args),
    db.prepare(`SELECT v.id, v.sku, v.color, v.size, v.stock, v.sale_price, p.id AS product_id, p.name, p.thumbnail FROM variants v JOIN products p ON p.id = v.product_id
      WHERE ${sql} ORDER BY v.stock, p.name LIMIT ? OFFSET ?`).bind(...args, per, off),
  ]);
  const total = (count.results[0] as any).n;
  return c.json({ rows: rows.results, total, page: p, pages: Math.max(1, Math.ceil(total / per)) });
});

app.post('/variants/:id{[0-9]+}/stock', requireRole('manager'), async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const b = await c.req.json();
  const v = await db.prepare('SELECT id, product_id, stock FROM variants WHERE id = ?').bind(id).first<any>();
  if (!v) return bad(c, 'Variant not found.', 404);
  const next = b.set !== undefined ? Math.max(0, int(b.set)) : Math.max(0, v.stock + int(b.change));
  const diff = next - v.stock;
  if (diff) {
    await db.batch([
      db.prepare('UPDATE variants SET stock = ? WHERE id = ?').bind(next, id),
      db.prepare('INSERT INTO stock_movements (variant_id, change, reason, ref, user_id) VALUES (?,?,?,?,?)').bind(id, diff, ['restock', 'adjust', 'damage', 'return'].includes(b.reason) ? b.reason : 'adjust', str(b.ref, 100) || null, c.var.user.id),
      refreshProductStmt(db, v.product_id),
    ]);
  }
  return c.json({ id, stock: next });
});

app.get('/variants/:id{[0-9]+}/movements', async (c) => {
  const r = await c.env.DB.prepare('SELECT m.*, u.name AS user_name FROM stock_movements m LEFT JOIN admin_users u ON u.id = m.user_id WHERE variant_id = ? ORDER BY m.id DESC LIMIT 50').bind(int(c.req.param('id'))).all();
  return c.json(r.results);
});

// ================= Categories =================
app.get('/categories', async (c) => {
  const r = await c.env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status <> 'archived') AS products FROM categories c ORDER BY COALESCE(c.parent_id, c.id), c.parent_id IS NOT NULL, c.sort, c.name`).all();
  return c.json(r.results);
});
async function saveCategory(c: C, id: number | null) {
  const b = await c.req.json();
  const name = str(b.name, 80);
  if (name.length < 2) return bad(c, 'Category name is required.');
  const slug = slugify(str(b.slug, 80) || name);
  const clash = await c.env.DB.prepare('SELECT id FROM categories WHERE slug = ? AND id IS NOT ?').bind(slug, id).first();
  if (clash) return bad(c, 'Another category already uses this URL slug.', 409);
  const parent = int(b.parent_id) || null;
  if (parent && parent === id) return bad(c, 'A category cannot be its own parent.');
  const vals = [parent, name, slug, str(b.description, 1000), str(b.image, 500) || null, str(b.size_chart, 500) || null, int(b.sort), b.featured ? 1 : 0, b.status === 'hidden' ? 'hidden' : 'active'];
  if (id == null) {
    const r = await c.env.DB.prepare('INSERT INTO categories (parent_id, name, slug, description, image, size_chart, sort, featured, status) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id').bind(...vals).first<{ id: number }>();
    return c.json({ id: r!.id });
  }
  await c.env.DB.prepare('UPDATE categories SET parent_id = ?, name = ?, slug = ?, description = ?, image = ?, size_chart = ?, sort = ?, featured = ?, status = ? WHERE id = ?').bind(...vals, id).run();
  return c.json({ id });
}
app.post('/categories', requireRole('manager'), (c) => saveCategory(c, null));
app.put('/categories/:id{[0-9]+}', requireRole('manager'), (c) => saveCategory(c, int(c.req.param('id'))));
app.delete('/categories/:id{[0-9]+}', requireRole('manager'), async (c) => {
  const id = int(c.req.param('id'));
  const used = await c.env.DB.prepare('SELECT (SELECT COUNT(*) FROM products WHERE category_id = ?1) + (SELECT COUNT(*) FROM categories WHERE parent_id = ?1) AS n').bind(id).first<{ n: number }>();
  if (used?.n) return bad(c, 'Move its products and sub-categories first, or hide the category instead.', 409);
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ================= Coupons =================
app.get('/coupons', async (c) => c.json((await c.env.DB.prepare('SELECT * FROM coupons ORDER BY id DESC').all()).results));
async function saveCoupon(c: C, id: number | null) {
  const b = await c.req.json();
  const code = str(b.code, 30).toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return bad(c, 'Coupon code must be 3–30 letters or numbers.');
  if (!['percent', 'fixed', 'free_delivery'].includes(b.type)) return bad(c, 'Choose a discount type.');
  const value = Math.max(0, int(b.value));
  if (b.type === 'percent' && (value < 1 || value > 90)) return bad(c, 'Percentage must be between 1 and 90.');
  if (b.type === 'fixed' && value < 1) return bad(c, 'Enter the discount amount.');
  const clash = await c.env.DB.prepare('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE AND id IS NOT ?').bind(code, id).first();
  if (clash) return bad(c, 'This code already exists.', 409);
  const vals = [code, b.type, value, Math.max(0, int(b.min_order)), b.max_discount ? int(b.max_discount) : null, b.starts_at || null, b.ends_at || null, b.usage_limit ? int(b.usage_limit) : null, b.status === 'inactive' ? 'inactive' : 'active'];
  if (id == null) await c.env.DB.prepare('INSERT INTO coupons (code, type, value, min_order, max_discount, starts_at, ends_at, usage_limit, status) VALUES (?,?,?,?,?,?,?,?,?)').bind(...vals).run();
  else await c.env.DB.prepare('UPDATE coupons SET code = ?, type = ?, value = ?, min_order = ?, max_discount = ?, starts_at = ?, ends_at = ?, usage_limit = ?, status = ? WHERE id = ?').bind(...vals, id).run();
  return c.json({ ok: true });
}
app.post('/coupons', requireRole('manager'), (c) => saveCoupon(c, null));
app.put('/coupons/:id{[0-9]+}', requireRole('manager'), (c) => saveCoupon(c, int(c.req.param('id'))));
app.delete('/coupons/:id{[0-9]+}', requireRole('manager'), async (c) => { await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(int(c.req.param('id'))).run(); return c.json({ ok: true }); });

// ================= Customers =================
app.get('/customers', async (c) => {
  const { p, per, off } = page(c);
  const q = str(c.req.query('q'), 80);
  const where = q ? 'WHERE (cu.name LIKE ? OR cu.phone LIKE ? OR cu.email LIKE ?)' : '';
  const args = q ? [`%${q}%`, `%${normalizePhone(q) || q}%`, `%${q}%`] : [];
  const sort = ({ recent: 'last_order DESC', spent: 'spent DESC', orders: 'orders DESC', name: 'cu.name' } as Record<string, string>)[c.req.query('sort') || 'recent'] || 'last_order DESC';
  const db = c.env.DB;
  const [count, rows] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM customers cu ${where}`).bind(...args),
    db.prepare(`SELECT cu.*, COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total END), 0) AS spent,
        COUNT(CASE WHEN o.status IN ('cancelled','returned') THEN 1 END) AS failed, MAX(o.created_at) AS last_order
      FROM customers cu LEFT JOIN orders o ON o.customer_id = cu.id ${where} GROUP BY cu.id ORDER BY ${sort} LIMIT ? OFFSET ?`).bind(...args, per, off),
  ]);
  const total = (count.results[0] as any).n;
  return c.json({ rows: rows.results, total, page: p, pages: Math.max(1, Math.ceil(total / per)) });
});
app.get('/customers/:id{[0-9]+}', async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const cu = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
  if (!cu) return bad(c, 'Customer not found.', 404);
  const [orders, ledger] = await db.batch([
    db.prepare('SELECT id, order_no, total, status, created_at, (SELECT SUM(qty) FROM order_items WHERE order_id = orders.id) AS items FROM orders WHERE customer_id = ? ORDER BY id DESC').bind(id),
    db.prepare('SELECT * FROM points_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 30').bind(id),
  ]);
  return c.json({ ...cu, orders: orders.results, points_history: ledger.results });
});
app.patch('/customers/:id{[0-9]+}', async (c) => {
  const b = await c.req.json();
  const id = int(c.req.param('id'));
  await c.env.DB.prepare('UPDATE customers SET notes = COALESCE(?, notes), blocked = COALESCE(?, blocked) WHERE id = ?')
    .bind(b.notes !== undefined ? str(b.notes, 1000) : null, b.blocked !== undefined ? (b.blocked ? 1 : 0) : null, id).run();
  return c.json({ ok: true });
});

// ================= Reports =================
app.get('/reports', requireRole('manager'), async (c) => {
  const db = c.env.DB;
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const to = valid(c.req.query('to')) || new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
  const from = valid(c.req.query('from')) || new Date(Date.parse(to) - 29 * 86400_000).toISOString().slice(0, 10);
  const group = c.req.query('group') === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const range = `date(o.created_at, ${BD}) BETWEEN ?1 AND ?2`;
  const ok = "o.status NOT IN ('cancelled','returned')";
  const [summary, series, byStatus, top, byCat, byDistrict, bySource] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN ${ok} THEN o.total END), 0) AS gross, COALESCE(SUM(CASE WHEN ${ok} THEN o.delivery_fee END), 0) AS delivery,
        COALESCE(SUM(CASE WHEN ${ok} THEN o.discount END), 0) AS discount, COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total END), 0) AS delivered_value,
        COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) AS delivered, COUNT(CASE WHEN o.status IN ('cancelled','returned') THEN 1 END) AS failed,
        COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${range} AND ${ok}), 0) AS units
      FROM orders o WHERE ${range}`).bind(from, to),
    db.prepare(`SELECT strftime('${group}', o.created_at, ${BD}) AS period, COUNT(*) AS orders, COALESCE(SUM(CASE WHEN ${ok} THEN o.total END), 0) AS sales
      FROM orders o WHERE ${range} GROUP BY period ORDER BY period`).bind(from, to),
    db.prepare(`SELECT o.status, COUNT(*) AS n, SUM(o.total) AS value FROM orders o WHERE ${range} GROUP BY o.status`).bind(from, to),
    db.prepare(`SELECT oi.product_id, oi.name, SUM(oi.qty) AS qty, SUM(oi.total) AS sales FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE ${range} AND ${ok} GROUP BY oi.product_id, oi.name ORDER BY sales DESC LIMIT 15`).bind(from, to),
    db.prepare(`SELECT COALESCE(pc.name, c.name, 'Uncategorised') AS category, SUM(oi.qty) AS qty, SUM(oi.total) AS sales FROM order_items oi JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE ${range} AND ${ok} GROUP BY 1 ORDER BY sales DESC`).bind(from, to),
    db.prepare(`SELECT o.district, COUNT(*) AS orders, SUM(o.total) AS sales FROM orders o WHERE ${range} AND ${ok} GROUP BY o.district ORDER BY orders DESC LIMIT 15`).bind(from, to),
    db.prepare(`SELECT o.source, COUNT(*) AS orders, SUM(o.total) AS sales FROM orders o WHERE ${range} GROUP BY o.source ORDER BY orders DESC`).bind(from, to),
  ]);
  return c.json({ from, to, summary: summary.results[0], series: series.results, byStatus: byStatus.results, top: top.results, byCategory: byCat.results, byDistrict: byDistrict.results, bySource: bySource.results });
});

// ================= Staff =================
app.get('/staff', requireRole('owner'), async (c) => c.json((await c.env.DB.prepare('SELECT id, name, email, role, status, last_login_at, created_at FROM admin_users ORDER BY id').all()).results));
app.post('/staff', requireRole('owner'), async (c) => {
  const b = await c.req.json();
  const name = str(b.name, 80), email = str(b.email, 120).toLowerCase();
  if (name.length < 2 || !LOGIN_RE.test(email)) return bad(c, 'Enter a name and a username (letters, numbers, . _ -) or email.');
  if (!['owner', 'manager', 'staff'].includes(b.role)) return bad(c, 'Choose a role.');
  const pp = passwordProblem(b.password); if (pp) return bad(c, pp);
  const clash = await c.env.DB.prepare('SELECT id FROM admin_users WHERE email = ?').bind(email).first();
  if (clash) return bad(c, 'A user with this username already exists.', 409);
  await c.env.DB.prepare('INSERT INTO admin_users (name, email, password_hash, role) VALUES (?,?,?,?)').bind(name, email, await hashPassword(b.password), b.role).run();
  return c.json({ ok: true });
});
app.put('/staff/:id{[0-9]+}', requireRole('owner'), async (c) => {
  const id = int(c.req.param('id'));
  const b = await c.req.json();
  if (id === c.var.user.id && (b.role && b.role !== 'owner' || b.status === 'disabled')) return bad(c, 'You cannot demote or disable your own account.');
  const sets: string[] = [], args: unknown[] = [];
  if (b.name) { sets.push('name = ?'); args.push(str(b.name, 80)); }
  if (['owner', 'manager', 'staff'].includes(b.role)) { sets.push('role = ?'); args.push(b.role); }
  if (['active', 'disabled'].includes(b.status)) { sets.push('status = ?'); args.push(b.status); }
  if (b.password) { const pp = passwordProblem(b.password); if (pp) return bad(c, pp); sets.push('password_hash = ?'); args.push(await hashPassword(b.password)); }
  if (sets.length) await c.env.DB.prepare(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`).bind(...args, id).run();
  return c.json({ ok: true });
});

// ================= Settings & pages =================
const SETTING_KEYS = ['store', 'delivery', 'home', 'announcement', 'courier', 'offers', 'rewards', 'sms'];
app.get('/settings', requireRole('manager'), async (c) => {
  const rows = (await c.env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()).results;
  const out: Record<string, any> = {};
  for (const r of rows) { try { out[r.key] = JSON.parse(r.value); } catch { /* skip */ } }
  if (c.var.user.role !== 'owner' && out.courier) {
    // Managers see whether courier keys are set, not the secrets themselves
    out.courier = { default: out.courier.default, configured: Object.fromEntries(['steadfast', 'pathao', 'redx'].map((k) => [k, Object.values(out.courier[k] || {}).some((v) => v && v !== true)])) };
    if (out.sms) out.sms = { provider: out.sms.provider, configured: !!out.sms.api_key || !!out.sms.url_template };
  }
  return c.json(out);
});
app.put('/settings/:key', requireRole('manager'), async (c) => {
  const key = c.req.param('key');
  if (!SETTING_KEYS.includes(key)) return bad(c, 'Unknown setting.');
  if ((key === 'courier' || key === 'sms') && c.var.user.role !== 'owner') return c.json({ error: 'Only the owner can change API credentials.' }, 403);
  const value = await c.req.json();
  if (typeof value !== 'object' || value === null) return bad(c, 'Invalid value.');
  if (key === 'delivery') for (const k of ['inside_dhaka', 'sub_dhaka', 'outside_dhaka']) if (!(int(value[k]) >= 0)) return bad(c, 'Delivery charges must be numbers.');
  await c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, JSON.stringify(value)).run();
  return c.json({ ok: true });
});
app.get('/pages', async (c) => c.json((await c.env.DB.prepare('SELECT slug, title, body, updated_at FROM pages ORDER BY title').all()).results));
app.put('/pages/:slug', requireRole('manager'), async (c) => {
  const slug = slugify(c.req.param('slug'));
  const b = await c.req.json();
  const title = str(b.title, 120);
  if (!slug || !title) return bad(c, 'Title is required.');
  await c.env.DB.prepare('INSERT INTO pages (slug, title, body, updated_at) VALUES (?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, body = excluded.body, updated_at = excluded.updated_at')
    .bind(slug, title, String(b.body || '').slice(0, 50000), now()).run();
  return c.json({ ok: true });
});

// ================= Uploads (R2) =================
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
app.post('/upload', requireRole('manager'), async (c) => {
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return bad(c, 'Choose an image to upload.');
  const ext = TYPES[file.type];
  if (!ext) return bad(c, 'Only JPG, PNG, WebP, AVIF or GIF images are allowed.');
  if (file.size > 5 * 1024 * 1024) return bad(c, 'Images must be 5 MB or smaller.');
  const folder = ['products', 'categories', 'banners'].includes(String(form.get('folder'))) ? String(form.get('folder')) : 'products';
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID().slice(0, 12)}.${ext}`;
  await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' } });
  return c.json({ key, url: `${c.env.STORE_URL.replace(/\/$/, '')}/media/${key}` });
});

// ================= Reviews =================
app.get('/reviews', async (c) => {
  const { p, per, off } = page(c);
  const st = c.req.query('status');
  const where = st && ['pending', 'approved', 'hidden'].includes(st) ? 'WHERE r.status = ?' : '';
  const args = where ? [st] : [];
  const db = c.env.DB;
  const [count, rows, pending] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM reviews r ${where}`).bind(...args),
    db.prepare(`SELECT r.*, p.name AS product_name, p.slug AS product_slug, p.thumbnail FROM reviews r JOIN products p ON p.id = r.product_id ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`).bind(...args, per, off),
    db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'"),
  ]);
  const total = (count.results[0] as any).n;
  return c.json({ rows: (rows.results as any[]).map((r) => ({ ...r, photos: JSON.parse(r.photos || '[]') })), total, page: p, pages: Math.max(1, Math.ceil(total / per)), pending: (pending.results[0] as any).n });
});
app.patch('/reviews/:id{[0-9]+}', requireRole('manager'), async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const b = await c.req.json();
  const r = await db.prepare('SELECT product_id FROM reviews WHERE id = ?').bind(id).first<{ product_id: number }>();
  if (!r) return bad(c, 'Review not found.', 404);
  await db.batch([
    db.prepare('UPDATE reviews SET status = COALESCE(?, status), reply = COALESCE(?, reply) WHERE id = ?')
      .bind(['pending', 'approved', 'hidden'].includes(b.status) ? b.status : null, b.reply !== undefined ? str(b.reply, 1000) : null, id),
    refreshRatingStmt(db, r.product_id),
  ]);
  return c.json({ ok: true });
});
app.delete('/reviews/:id{[0-9]+}', requireRole('manager'), async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const r = await db.prepare('SELECT product_id FROM reviews WHERE id = ?').bind(id).first<{ product_id: number }>();
  if (!r) return bad(c, 'Review not found.', 404);
  await db.batch([db.prepare('DELETE FROM reviews WHERE id = ?').bind(id), refreshRatingStmt(db, r.product_id)]);
  return c.json({ ok: true });
});

// ================= Flash sales =================
app.get('/flash-sales', async (c) => {
  const r = await c.env.DB.prepare('SELECT f.*, (SELECT COUNT(*) FROM flash_sale_items WHERE flash_sale_id = f.id) AS products FROM flash_sales f ORDER BY f.id DESC').all();
  return c.json(r.results);
});
app.get('/flash-sales/:id{[0-9]+}', async (c) => {
  const db = c.env.DB;
  const id = int(c.req.param('id'));
  const f = await db.prepare('SELECT * FROM flash_sales WHERE id = ?').bind(id).first();
  if (!f) return bad(c, 'Flash sale not found.', 404);
  const items = await db.prepare('SELECT p.id, p.name, p.thumbnail, p.min_price FROM flash_sale_items i JOIN products p ON p.id = i.product_id WHERE i.flash_sale_id = ?').bind(id).all();
  return c.json({ ...f, items: items.results });
});
async function saveFlash(c: C, id: number | null) {
  const db = c.env.DB;
  const b = await c.req.json();
  const title = str(b.title, 80);
  const percent = int(b.percent);
  if (title.length < 2) return bad(c, 'Give the sale a title.');
  if (percent < 1 || percent > 90) return bad(c, 'Discount must be between 1% and 90%.');
  const starts = new Date(b.starts_at), ends = new Date(b.ends_at);
  if (isNaN(+starts) || isNaN(+ends) || ends <= starts) return bad(c, 'The end time must be after the start time.');
  const products = [...new Set((b.product_ids || []).map((x: unknown) => int(x)).filter((x: number) => x > 0))].slice(0, 500) as number[];
  if (!products.length) return bad(c, 'Add at least one product.');
  let fid = id;
  if (fid == null) {
    fid = (await db.prepare('INSERT INTO flash_sales (title, percent, starts_at, ends_at, status) VALUES (?,?,?,?,?) RETURNING id')
      .bind(title, percent, starts.toISOString(), ends.toISOString(), b.status === 'inactive' ? 'inactive' : 'active').first<{ id: number }>())!.id;
  } else {
    await db.prepare('UPDATE flash_sales SET title = ?, percent = ?, starts_at = ?, ends_at = ?, status = ? WHERE id = ?')
      .bind(title, percent, starts.toISOString(), ends.toISOString(), b.status === 'inactive' ? 'inactive' : 'active', fid).run();
  }
  await db.batch([db.prepare('DELETE FROM flash_sale_items WHERE flash_sale_id = ?').bind(fid), ...products.map((pid) => db.prepare('INSERT OR IGNORE INTO flash_sale_items VALUES (?, ?)').bind(fid, pid))]);
  return c.json({ id: fid });
}
app.post('/flash-sales', requireRole('manager'), (c) => saveFlash(c, null));
app.put('/flash-sales/:id{[0-9]+}', requireRole('manager'), (c) => saveFlash(c, int(c.req.param('id'))));
app.delete('/flash-sales/:id{[0-9]+}', requireRole('manager'), async (c) => { await c.env.DB.prepare('DELETE FROM flash_sales WHERE id = ?').bind(int(c.req.param('id'))).run(); return c.json({ ok: true }); });

// ================= Back-in-stock requests =================
app.get('/stock-alerts', async (c) => {
  const r = await c.env.DB.prepare(`SELECT v.id AS variant_id, v.color, v.size, v.stock, p.id AS product_id, p.name, p.slug, p.thumbnail,
      COUNT(a.id) AS waiting, MAX(a.created_at) AS last_request
    FROM stock_alerts a JOIN variants v ON v.id = a.variant_id JOIN products p ON p.id = a.product_id
    WHERE a.notified_at IS NULL GROUP BY v.id ORDER BY waiting DESC LIMIT 200`).all();
  return c.json({ rows: r.results, sms: !!(await smsEnabled(c.env.DB)) });
});
app.post('/stock-alerts/:variantId{[0-9]+}/notify', requireRole('manager'), async (c) => {
  const db = c.env.DB;
  const vid = int(c.req.param('variantId'));
  const v = await db.prepare('SELECT v.stock, v.color, v.size, p.name, p.slug FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?').bind(vid).first<any>();
  if (!v) return bad(c, 'Variant not found.', 404);
  if (v.stock <= 0) return bad(c, 'Restock this item before notifying customers.');
  if (!(await smsEnabled(db))) return bad(c, 'Set up an SMS provider first (Settings → SMS).');
  const store = await getSetting<any>(db, 'store', { name: 'Our store' });
  const rows = (await db.prepare('SELECT id, phone FROM stock_alerts WHERE variant_id = ? AND notified_at IS NULL').bind(vid).all<any>()).results;
  let sent = 0;
  for (const a of rows) {
    const ok = await sendSms(db, a.phone, `${store.name}: ${v.name} (${[v.color, v.size].filter(Boolean).join(' ')}) is back in stock! Order now: ${c.env.STORE_URL}/product/${v.slug}`);
    if (ok) { sent++; await db.prepare('UPDATE stock_alerts SET notified_at = ? WHERE id = ?').bind(now(), a.id).run(); }
  }
  return c.json({ sent, total: rows.length });
});

// ================= Abandoned checkouts =================
app.get('/abandoned', async (c) => {
  const st = ['open', 'contacted', 'dismissed', 'converted'].includes(String(c.req.query('status'))) ? String(c.req.query('status')) : 'open';
  const r = await c.env.DB.prepare('SELECT * FROM checkout_drafts WHERE status = ? AND updated_at < ? ORDER BY updated_at DESC LIMIT 200')
    .bind(st, new Date(Date.now() - 30 * 60_000).toISOString()).all<any>();
  return c.json(r.results.map((x) => ({ ...x, items: JSON.parse(x.items || '[]') })));
});
app.patch('/abandoned/:phone{0[0-9]{10}}', async (c) => {
  const b = await c.req.json();
  if (!['open', 'contacted', 'dismissed'].includes(b.status)) return bad(c, 'Unknown status.');
  await c.env.DB.prepare('UPDATE checkout_drafts SET status = ? WHERE phone = ?').bind(b.status, c.req.param('phone')).run();
  return c.json({ ok: true });
});

// ================= Customer points =================
app.post('/customers/:id{[0-9]+}/points', requireRole('manager'), async (c) => {
  const id = int(c.req.param('id'));
  const b = await c.req.json();
  const change = int(b.change);
  if (!change) return bad(c, 'Enter the number of points to add or remove.');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE customers SET points = MAX(0, points + ?) WHERE id = ?').bind(change, id),
    c.env.DB.prepare("INSERT INTO points_ledger (customer_id, change, reason) VALUES (?, ?, 'adjust')").bind(id, change),
  ]);
  return c.json({ ok: true });
});

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default app;
