import {
  normalizePhone, zoneFor, priceOrder, couponProblem, DISTRICTS,
  type Coupon, type DeliverySettings, type OfferSettings, type RewardSettings,
} from './bd';

export async function getSetting<T = any>(db: D1Database, key: string, fallback: T): Promise<T> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  if (!row) return fallback;
  try { return { ...(fallback as any), ...JSON.parse(row.value) }; } catch { return fallback; }
}

export const DEFAULT_DELIVERY: DeliverySettings = { inside_dhaka: 70, sub_dhaka: 100, outside_dhaka: 130 };
export const DEFAULT_OFFERS: OfferSettings = { enabled: false, tiers: [] };
export const DEFAULT_REWARDS: RewardSettings = { enabled: false, earn_per_100: 1, point_value: 1, max_redeem_percent: 20, min_redeem: 50 };

export type Flash = { percent: number; ends_at: string; title: string };

/** Active flash-sale discount per product (highest percent wins). */
export async function activeFlash(db: D1Database, productIds?: number[]): Promise<Map<number, Flash>> {
  const nowIso = new Date().toISOString();
  let sql = `SELECT i.product_id, f.percent, f.ends_at, f.title FROM flash_sale_items i JOIN flash_sales f ON f.id = i.flash_sale_id
             WHERE f.status = 'active' AND f.starts_at <= ? AND f.ends_at > ?`;
  const args: unknown[] = [nowIso, nowIso];
  if (productIds) {
    if (!productIds.length) return new Map();
    sql += ` AND i.product_id IN (${productIds.map(() => '?').join(',')})`;
    args.push(...productIds);
  }
  const r = await db.prepare(sql).bind(...args).all<any>();
  const m = new Map<number, Flash>();
  for (const x of r.results) if (!m.has(x.product_id) || m.get(x.product_id)!.percent < x.percent) m.set(x.product_id, { percent: x.percent, ends_at: x.ends_at, title: x.title });
  return m;
}

/** Selling price after an active flash sale (never above the normal sale price). */
export const flashPrice = (regular: number, sale: number, f?: Flash) => (f ? Math.min(sale, Math.round((regular * (100 - f.percent)) / 100 / 10) * 10) : sale);

export type CartInput = { variantId: number; qty: number }[];

export type PricedLine = {
  variantId: number; productId: number; name: string; slug: string; sku: string; color: string; size: string;
  image: string | null; price: number; regular: number; qty: number; stock: number; total: number; available: boolean; flash: boolean;
};

/** Looks up live prices/stock for cart lines. Unknown or inactive variants come back as unavailable. */
export async function priceCart(db: D1Database, items: CartInput): Promise<PricedLine[]> {
  const clean = items
    .map((i) => ({ variantId: Number(i.variantId), qty: Math.max(1, Math.min(20, Math.floor(Number(i.qty) || 1))) }))
    .filter((i) => Number.isInteger(i.variantId) && i.variantId > 0)
    .slice(0, 50);
  if (!clean.length) return [];
  const ids = [...new Set(clean.map((i) => i.variantId))];
  const rows = await db.prepare(
    `SELECT v.id, v.product_id, v.sku, v.color, v.size, v.price, v.sale_price, v.stock, v.images, v.status, p.name, p.slug, p.thumbnail, p.status AS pstatus
       FROM variants v JOIN products p ON p.id = v.product_id
      WHERE v.id IN (${ids.map(() => '?').join(',')})`,
  ).bind(...ids).all<any>();
  const byId = new Map(rows.results.map((r) => [r.id, r]));
  const flash = await activeFlash(db, [...new Set(rows.results.map((r) => r.product_id as number))]);
  return clean.flatMap((i) => {
    const r = byId.get(i.variantId);
    if (!r) return [];
    let image: string | null = r.thumbnail;
    try { image = JSON.parse(r.images)[0] || r.thumbnail; } catch { /* keep thumbnail */ }
    const f = flash.get(r.product_id);
    const price = flashPrice(r.price, r.sale_price, f);
    const available = r.status === 'active' && r.pstatus === 'active' && r.stock >= i.qty;
    return [{
      variantId: r.id, productId: r.product_id, name: r.name, slug: r.slug, sku: r.sku, color: r.color, size: r.size, image,
      price, regular: r.price, qty: i.qty, stock: r.stock, total: price * i.qty, available, flash: !!f && price < r.sale_price,
    }];
  });
}

export async function findCoupon(db: D1Database, code?: string | null): Promise<Coupon | null> {
  if (!code) return null;
  return db.prepare('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE').bind(String(code).trim()).first<Coupon>();
}

export type QuoteInput = { items: CartInput; district?: string; zone?: string; coupon?: string; customerId?: number | null; usePoints?: number };

export async function quote(db: D1Database, input: QuoteInput) {
  const lines = await priceCart(db, input.items || []);
  const [delivery, offers, rewards] = await Promise.all([
    getSetting<DeliverySettings>(db, 'delivery', DEFAULT_DELIVERY),
    getSetting<OfferSettings>(db, 'offers', DEFAULT_OFFERS),
    getSetting<RewardSettings>(db, 'rewards', DEFAULT_REWARDS),
  ]);
  const district = DISTRICTS.includes(String(input.district)) ? String(input.district) : 'Dhaka';
  const zone = zoneFor(district, input.zone);
  const ok = lines.filter((l) => l.available);
  const subtotal = ok.reduce((s, l) => s + l.total, 0);
  const qty = ok.reduce((s, l) => s + l.qty, 0);
  let coupon: Coupon | null = null;
  let couponError: string | null = null;
  if (input.coupon) {
    coupon = await findCoupon(db, input.coupon);
    couponError = couponProblem(coupon, subtotal);
    if (couponError) coupon = null;
  }
  let pointsAvailable = 0;
  if (input.customerId) {
    const c = await db.prepare('SELECT points FROM customers WHERE id = ?').bind(input.customerId).first<{ points: number }>();
    pointsAvailable = c?.points || 0;
  }
  const priced = priceOrder({ subtotal, qty, zone, delivery, coupon, offers, rewards, pointsAvailable, pointsWanted: input.usePoints || 0 });
  return {
    lines, district, zone, coupon: coupon?.code ?? null, couponError, pointsAvailable,
    rewards: rewards.enabled ? { point_value: rewards.point_value, max_redeem_percent: rewards.max_redeem_percent, min_redeem: rewards.min_redeem } : null,
    offerTiers: offers.enabled ? offers.tiers : [], freeOver: delivery.free_over || 0, ...priced,
  };
}

export type NewOrder = QuoteInput & {
  name: string; phone: string; email?: string; address: string; area?: string; note?: string;
  source?: string; status?: string; deliveryFeeOverride?: number | null; extraDiscount?: number; advancePaid?: number;
  userId?: number | null; userName?: string | null;
};

export class OrderError extends Error { constructor(msg: string, public field?: string) { super(msg); } }

function makeOrderNo() {
  const d = new Date(Date.now() + 6 * 3600_000); // Bangladesh time (UTC+6)
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  return `SL${ymd}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}

/** Validates, prices and saves an order; decrements stock, redeems points and records events, all in one D1 batch. */
export async function createOrder(db: D1Database, o: NewOrder) {
  const name = String(o.name || '').trim().slice(0, 100);
  const phone = normalizePhone(o.phone);
  const address = String(o.address || '').trim().slice(0, 500);
  if (name.length < 2) throw new OrderError('Please enter your full name.', 'name');
  if (!phone) throw new OrderError('Please enter a valid Bangladeshi mobile number (01XXXXXXXXX).', 'phone');
  if (address.length < 8) throw new OrderError('Please enter your full delivery address.', 'address');
  if (!DISTRICTS.includes(String(o.district))) throw new OrderError('Please choose your district.', 'district');
  if ((o.items || []).some((i) => Number(i.qty) > 20)) throw new OrderError('You can order at most 20 pieces of one item. For bulk orders please call us.');
  const blocked = await db.prepare('SELECT blocked FROM customers WHERE phone = ?').bind(phone).first<{ blocked: number }>();
  if (blocked?.blocked && (o.source || 'web') === 'web') throw new OrderError('We could not place this order online. Please call us to order.');

  const q = await quote(db, o);
  if (!q.lines.length) throw new OrderError('Your cart is empty.');
  const bad = q.lines.find((l) => !l.available);
  if (bad) throw new OrderError(`${bad.name} (${[bad.color, bad.size].filter(Boolean).join(', ')}) has only ${Math.max(0, bad.stock)} left. Please update your cart.`);
  if (o.coupon && q.couponError) throw new OrderError(q.couponError, 'coupon');

  const deliveryFee = o.deliveryFeeOverride != null ? Math.max(0, Math.round(o.deliveryFeeOverride)) : q.deliveryFee;
  const afterOffer = q.subtotal - q.offerDiscount;
  const discount = Math.min(afterOffer, q.discount + Math.max(0, Math.round(o.extraDiscount || 0)));
  const total = afterOffer - discount + deliveryFee;
  const advance = Math.max(0, Math.min(total, Math.round(o.advancePaid || 0)));
  const status = o.status === 'confirmed' ? 'confirmed' : 'pending';
  const source = ['web', 'phone', 'facebook', 'admin', 'whatsapp'].includes(String(o.source)) ? String(o.source) : 'web';

  for (let attempt = 0; attempt < 4; attempt++) {
    const orderNo = makeOrderNo();
    const exists = await db.prepare('SELECT 1 FROM orders WHERE order_no = ?').bind(orderNo).first();
    if (exists) continue;
    const oid = `(SELECT id FROM orders WHERE order_no = '${orderNo}')`;
    const stmts: D1PreparedStatement[] = [
      db.prepare(`INSERT INTO customers (name, phone, email, address, district) VALUES (?,?,?,?,?)
                  ON CONFLICT(phone) DO UPDATE SET name = excluded.name, email = COALESCE(excluded.email, customers.email), address = excluded.address, district = excluded.district`)
        .bind(name, phone, o.email || null, address, q.district),
      db.prepare(`INSERT INTO orders (order_no, customer_id, name, phone, email, address, district, area, zone, note, subtotal, delivery_fee, discount, offer_discount, points_used, total, advance_paid,
                    coupon_code, payment_method, payment_status, status, source)
                  VALUES (?, ${o.customerId ? '?' : '(SELECT id FROM customers WHERE phone = ?)'}, ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'cod', ?, ?, ?)`)
        .bind(orderNo, o.customerId || phone, name, phone, o.email || null, address, q.district, o.area || null, q.zone, (o.note || '').slice(0, 500) || null,
          q.subtotal, deliveryFee, discount, q.offerDiscount, q.pointsUsed, total, advance, q.coupon, advance >= total ? 'paid' : advance > 0 ? 'partial' : 'unpaid', status, source),
    ];
    for (const l of q.lines) {
      stmts.push(
        db.prepare(`INSERT INTO order_items (order_id, product_id, variant_id, name, sku, color, size, image, price, qty, total) VALUES (${oid},?,?,?,?,?,?,?,?,?,?)`)
          .bind(l.productId, l.variantId, l.name, l.sku, l.color, l.size, l.image, l.price, l.qty, l.total),
        db.prepare('UPDATE variants SET stock = MAX(0, stock - ?) WHERE id = ?').bind(l.qty, l.variantId),
        db.prepare('INSERT INTO stock_movements (variant_id, change, reason, ref, user_id) VALUES (?,?,?,?,?)').bind(l.variantId, -l.qty, 'order', orderNo, o.userId ?? null),
        db.prepare('UPDATE products SET sold_count = sold_count + ? WHERE id = ?').bind(l.qty, l.productId),
      );
    }
    for (const pid of new Set(q.lines.map((l) => l.productId))) stmts.push(refreshProductStmt(db, pid));
    if (q.coupon) stmts.push(db.prepare('UPDATE coupons SET used = used + 1 WHERE code = ? COLLATE NOCASE').bind(q.coupon));
    if (q.pointsUsed && o.customerId) {
      stmts.push(
        db.prepare('UPDATE customers SET points = MAX(0, points - ?) WHERE id = ?').bind(q.pointsUsed, o.customerId),
        db.prepare(`INSERT INTO points_ledger (customer_id, change, reason, order_id) VALUES (?, ?, 'redeemed', ${oid})`).bind(o.customerId, -q.pointsUsed),
      );
    }
    stmts.push(db.prepare("UPDATE checkout_drafts SET status = 'converted', updated_at = ? WHERE phone = ?").bind(new Date().toISOString(), phone));
    stmts.push(db.prepare(`INSERT INTO order_events (order_id, type, message, user_id, user_name) VALUES (${oid}, 'status', ?, ?, ?)`)
      .bind(source === 'web' ? 'Order placed on website' : `Order created (${source})`, o.userId ?? null, o.userName ?? null));
    await db.batch(stmts);
    return { orderNo, total, deliveryFee, discount, subtotal: q.subtotal, pointsUsed: q.pointsUsed };
  }
  throw new OrderError('Could not create the order, please try again.');
}

/** Recomputes a product's cached min/max price, total stock and units sold. */
export function refreshProductStmt(db: D1Database, productId: number) {
  return db.prepare(`UPDATE products SET
      min_price = COALESCE((SELECT MIN(sale_price) FROM variants WHERE product_id = ?1 AND status = 'active'), 0),
      max_price = COALESCE((SELECT MAX(sale_price) FROM variants WHERE product_id = ?1 AND status = 'active'), 0),
      total_stock = COALESCE((SELECT SUM(stock) FROM variants WHERE product_id = ?1 AND status = 'active'), 0),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?1`).bind(productId);
}

/** Recomputes rating average/count from approved reviews. */
export function refreshRatingStmt(db: D1Database, productId: number) {
  return db.prepare(`UPDATE products SET
      rating_avg = COALESCE((SELECT ROUND(AVG(rating), 2) FROM reviews WHERE product_id = ?1 AND status = 'approved'), 0),
      rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ?1 AND status = 'approved')
    WHERE id = ?1`).bind(productId);
}
