import { getSetting, activeFlash, flashPrice, type Flash } from '../../shared/orders';

export type Env = { DB: D1Database; MEDIA: R2Bucket; ASSETS: Fetcher; SITE_URL: string; CUSTOMER_SECRET: string; JWT_SECRET: string; DEV_MODE?: string };

export type Category = { id: number; parent_id: number | null; name: string; slug: string; description: string; image: string | null; size_chart: string | null; sort: number; featured: number };
export type ProductCard = {
  id: number; name: string; slug: string; thumbnail: string | null; min_price: number; max_price: number; regular: number; total_stock: number;
  images: string; category: string | null; rating_avg: number; rating_count: number; sold_count: number; created_at: string;
  price: number; flash?: Flash | null;
};
export type Variant = { id: number; sku: string; color: string; size: string; option: string; price: number; sale_price: number; stock: number; images: string[] };

export type StoreSettings = {
  store: { name: string; name_bn?: string; tagline: string; phone: string; phone2?: string; email: string; address: string; facebook?: string; instagram?: string; whatsapp?: string };
  delivery: { inside_dhaka: number; sub_dhaka: number; outside_dhaka: number; free_over?: number; inside_days?: string; outside_days?: string };
  home: { hero: { image: string; title: string; subtitle: string; link: string; button: string }[]; featured_categories: number[] };
  announcement: { text: string; enabled: boolean };
  offers: { enabled: boolean; tiers: { min_qty: number; percent: number }[] };
  rewards: { enabled: boolean; earn_per_100: number; point_value: number; max_redeem_percent: number; min_redeem: number };
};

const DEFAULTS: StoreSettings = {
  store: { name: 'Sutoloka', name_bn: 'সুতোলোকা', tagline: '', phone: '', email: '', address: '' },
  delivery: { inside_dhaka: 70, sub_dhaka: 100, outside_dhaka: 130 },
  home: { hero: [], featured_categories: [] },
  announcement: { text: '', enabled: false },
  offers: { enabled: false, tiers: [] },
  rewards: { enabled: false, earn_per_100: 1, point_value: 1, max_redeem_percent: 20, min_redeem: 50 },
};

export async function loadSettings(db: D1Database): Promise<StoreSettings> {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('store','delivery','home','announcement','offers','rewards')").all<{ key: string; value: string }>();
  const s: any = structuredClone(DEFAULTS);
  for (const r of rows.results) { try { s[r.key] = { ...s[r.key], ...JSON.parse(r.value) }; } catch { /* ignore */ } }
  return s;
}
export { getSetting };

export async function loadCategories(db: D1Database): Promise<Category[]> {
  const r = await db.prepare("SELECT * FROM categories WHERE status = 'active' ORDER BY sort, name").all<Category>();
  return r.results;
}

/** Resizes Unsplash images via URL params; other URLs are returned unchanged. */
export function sized(url: string | null | undefined, w: number, h?: number) {
  if (!url) return '';
  if (!url.includes('images.unsplash.com') && !url.includes('images.pexels.com')) return url;
  const u = new URL(url);
  u.searchParams.set('w', String(w));
  if (h) u.searchParams.set('h', String(h)); else u.searchParams.delete('h');
  return u.toString();
}

const CARD_SELECT = `
  SELECT p.id, p.name, p.slug, p.thumbnail, p.min_price, p.max_price, p.total_stock, p.rating_avg, p.rating_count, p.sold_count, p.created_at, c.name AS category,
         (SELECT MAX(v.price) FROM variants v WHERE v.product_id = p.id AND v.status = 'active' AND v.sale_price = p.min_price) AS regular,
         (SELECT v.images FROM variants v WHERE v.product_id = p.id AND v.status = 'active' ORDER BY v.sort LIMIT 1) AS images
    FROM products p LEFT JOIN categories c ON c.id = p.category_id`;
const LIVE = "p.status = 'active' AND p.max_price > 0";

/** Adds flash-sale prices to card rows. */
export async function withFlash(db: D1Database, rows: any[]): Promise<ProductCard[]> {
  const flash = await activeFlash(db, rows.map((r) => r.id));
  return rows.map((r) => {
    const f = flash.get(r.id) || null;
    const regular = r.regular || r.min_price;
    return { ...r, regular, flash: f, price: flashPrice(regular, r.min_price, f || undefined) };
  });
}

export type ListOptions = {
  categoryIds?: number[]; q?: string; sort?: string; inStock?: boolean; sizes?: string[]; colors?: string[];
  min?: number; max?: number; rating?: number; onSale?: boolean; page?: number; perPage?: number; ids?: number[];
};

function listWhere(o: ListOptions) {
  const where = [LIVE];
  const args: unknown[] = [];
  if (o.categoryIds?.length) {
    const ph = o.categoryIds.map(() => '?').join(',');
    where.push(`(p.category_id IN (${ph}) OR p.id IN (SELECT product_id FROM product_categories WHERE category_id IN (${ph})))`);
    args.push(...o.categoryIds, ...o.categoryIds);
  }
  if (o.ids) { where.push(`p.id IN (${o.ids.map(() => '?').join(',') || 'NULL'})`); args.push(...o.ids); }
  if (o.q) {
    const words = o.q.toLowerCase().replace(/[%_]/g, '').split(/\s+/).filter(Boolean).slice(0, 5);
    for (const w of words) {
      where.push('(p.name LIKE ? OR p.tags LIKE ? OR p.category_id IN (SELECT id FROM categories WHERE name LIKE ? OR parent_id IN (SELECT id FROM categories WHERE name LIKE ?)) OR p.id IN (SELECT product_id FROM variants WHERE sku LIKE ? OR color LIKE ?))');
      const like = `%${w}%`;
      args.push(like, like, like, like, like, like);
    }
  }
  if (o.inStock) where.push('p.total_stock > 0');
  if (o.sizes?.length) { where.push(`p.id IN (SELECT product_id FROM variants WHERE size IN (${o.sizes.map(() => '?').join(',')}) AND stock > 0 AND status = 'active')`); args.push(...o.sizes); }
  if (o.colors?.length) { where.push(`p.id IN (SELECT product_id FROM variants WHERE color IN (${o.colors.map(() => '?').join(',')}) AND status = 'active')`); args.push(...o.colors); }
  if (o.min) { where.push('p.min_price >= ?'); args.push(o.min); }
  if (o.max) { where.push('p.min_price <= ?'); args.push(o.max); }
  if (o.rating) { where.push('p.rating_avg >= ?'); args.push(o.rating); }
  if (o.onSale) {
    const n = new Date().toISOString();
    where.push("(p.id IN (SELECT product_id FROM variants WHERE sale_price < price AND status = 'active') OR p.id IN (SELECT i.product_id FROM flash_sale_items i JOIN flash_sales f ON f.id = i.flash_sale_id WHERE f.status = 'active' AND f.starts_at <= ? AND f.ends_at > ?))");
    args.push(n, n);
  }
  return { w: where.join(' AND '), args };
}

export async function listProducts(db: D1Database, o: ListOptions) {
  const { w, args } = listWhere(o);
  const order = ({
    new: 'p.created_at DESC, p.id DESC', price_asc: 'p.min_price ASC', price_desc: 'p.min_price DESC',
    popular: 'p.sold_count DESC', rating: 'p.rating_avg DESC, p.rating_count DESC', name: 'p.name ASC',
  } as Record<string, string>)[o.sort || 'new'] || 'p.created_at DESC, p.id DESC';
  const perPage = o.perPage || 24;
  const page = Math.max(1, o.page || 1);
  const [count, rows] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${w}`).bind(...args),
    db.prepare(`${CARD_SELECT} WHERE ${w} ORDER BY (p.total_stock > 0) DESC, ${order} LIMIT ? OFFSET ?`).bind(...args, perPage, (page - 1) * perPage),
  ]);
  const total = (count.results[0] as any).n as number;
  return { products: await withFlash(db, rows.results), total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Sizes, colours and price range available within a set of categories (for the filter sidebar). */
export async function facets(db: D1Database, o: ListOptions) {
  const { w, args } = listWhere({ categoryIds: o.categoryIds, q: o.q, onSale: o.onSale });
  const [sizes, colors, range] = await db.batch([
    db.prepare(`SELECT v.size AS v, COUNT(DISTINCT v.product_id) AS n FROM variants v JOIN products p ON p.id = v.product_id WHERE v.size <> '' AND v.stock > 0 AND v.status = 'active' AND ${w} GROUP BY v.size`).bind(...args),
    db.prepare(`SELECT v.color AS v, COUNT(DISTINCT v.product_id) AS n FROM variants v JOIN products p ON p.id = v.product_id WHERE v.color <> '' AND v.status = 'active' AND ${w} GROUP BY v.color ORDER BY n DESC LIMIT 16`).bind(...args),
    db.prepare(`SELECT MIN(p.min_price) AS lo, MAX(p.min_price) AS hi FROM products p WHERE ${w}`).bind(...args),
  ]);
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size', 'One Size'];
  const sortSize = (a: string, b: string) => {
    const ia = sizeOrder.indexOf(a), ib = sizeOrder.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return (parseInt(a) || 0) - (parseInt(b) || 0);
  };
  return {
    sizes: (sizes.results as any[]).map((x) => x.v as string).sort(sortSize),
    colors: (colors.results as any[]).map((x) => x.v as string),
    lo: (range.results[0] as any)?.lo || 0, hi: (range.results[0] as any)?.hi || 0,
  };
}

export async function getProduct(db: D1Database, slug: string) {
  const p = await db.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.parent_id AS category_parent, c.size_chart AS size_chart, pc.size_chart AS parent_size_chart,
        pc.name AS parent_name, pc.slug AS parent_slug
      FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN categories pc ON pc.id = c.parent_id
     WHERE p.slug = ? AND p.status = 'active'`).bind(slug).first<any>();
  if (!p) return null;
  const [v, flash] = await Promise.all([
    db.prepare("SELECT id, sku, color, size, option, price, sale_price, stock, images FROM variants WHERE product_id = ? AND status = 'active' ORDER BY sort, id").bind(p.id).all<any>(),
    activeFlash(db, [p.id]),
  ]);
  const f = flash.get(p.id);
  const variants: Variant[] = v.results.map((x) => ({ ...x, images: safeJson(x.images, []), sale_price: flashPrice(x.price, x.sale_price, f) }));
  return { ...p, variants, flash: f || null };
}

export async function productReviews(db: D1Database, productId: number, page = 1) {
  const per = 10;
  const [rows, dist, fit] = await db.batch([
    db.prepare("SELECT id, name, rating, title, body, photos, size_bought, fit, verified, reply, created_at FROM reviews WHERE product_id = ? AND status = 'approved' ORDER BY (photos <> '[]') DESC, id DESC LIMIT ? OFFSET ?").bind(productId, per, (page - 1) * per),
    db.prepare("SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? AND status = 'approved' GROUP BY rating").bind(productId),
    db.prepare("SELECT fit, COUNT(*) AS n FROM reviews WHERE product_id = ? AND status = 'approved' AND fit IS NOT NULL GROUP BY fit").bind(productId),
  ]);
  return {
    rows: (rows.results as any[]).map((r) => ({ ...r, photos: safeJson<string[]>(r.photos, []) })),
    dist: Object.fromEntries((dist.results as any[]).map((d) => [d.rating, d.n])) as Record<number, number>,
    fit: Object.fromEntries((fit.results as any[]).map((d) => [d.fit, d.n])) as Record<string, number>,
  };
}

export async function relatedProducts(db: D1Database, productId: number, categoryId: number | null) {
  const r = await db.prepare(`${CARD_SELECT} WHERE ${LIVE} AND p.total_stock > 0 AND p.id <> ? AND p.category_id IS ? ORDER BY p.sold_count DESC LIMIT 8`).bind(productId, categoryId).all<any>();
  return withFlash(db, r.results);
}

export async function cardsByIds(db: D1Database, ids: number[]) {
  if (!ids.length) return [];
  const r = await db.prepare(`${CARD_SELECT} WHERE ${LIVE} AND p.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<any>();
  const byId = new Map(r.results.map((x) => [x.id, x]));
  return withFlash(db, ids.map((id) => byId.get(id)).filter(Boolean));
}

export async function homeSections(db: D1Database) {
  const n = new Date().toISOString();
  const [latest, best, flashRows, flashInfo] = await db.batch([
    db.prepare(`${CARD_SELECT} WHERE ${LIVE} AND p.total_stock > 0 ORDER BY p.created_at DESC, p.id DESC LIMIT 8`),
    db.prepare(`${CARD_SELECT} WHERE ${LIVE} AND p.total_stock > 0 ORDER BY p.sold_count DESC LIMIT 8`),
    db.prepare(`${CARD_SELECT} WHERE ${LIVE} AND p.total_stock > 0 AND p.id IN (SELECT i.product_id FROM flash_sale_items i JOIN flash_sales f ON f.id = i.flash_sale_id WHERE f.status = 'active' AND f.starts_at <= ?1 AND f.ends_at > ?1) LIMIT 10`).bind(n),
    db.prepare("SELECT title, percent, ends_at FROM flash_sales WHERE status = 'active' AND starts_at <= ?1 AND ends_at > ?1 ORDER BY ends_at LIMIT 1").bind(n),
  ]);
  const [l, b, f] = await Promise.all([withFlash(db, latest.results), withFlash(db, best.results), withFlash(db, flashRows.results)]);
  return { latest: l, best: b, flash: f, flashSale: (flashInfo.results[0] as any) || null };
}

/** Best-selling in-stock product photo per category (used for category tiles without their own image). */
export async function categoryCovers(db: D1Database, ids: number[]): Promise<Record<number, string>> {
  if (!ids.length) return {};
  const res = await db.batch(ids.map((id) => db.prepare(
    `SELECT p.thumbnail FROM products p WHERE ${LIVE} AND p.total_stock > 0 AND p.thumbnail IS NOT NULL
        AND (p.category_id = ?1 OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ?1))
      ORDER BY p.sold_count DESC LIMIT 1`).bind(id)));
  const out: Record<number, string> = {};
  res.forEach((r, i) => { const t = (r.results[0] as any)?.thumbnail; if (t) out[ids[i]] = t; });
  return out;
}

export async function suggest(db: D1Database, q: string) {
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const [p, c] = await db.batch([
    db.prepare(`SELECT p.name, p.slug, p.thumbnail, p.min_price FROM products p WHERE ${LIVE} AND (p.name LIKE ? OR p.tags LIKE ?) ORDER BY p.total_stock > 0 DESC, p.sold_count DESC LIMIT 6`).bind(like, like),
    db.prepare("SELECT name, slug FROM categories WHERE status = 'active' AND name LIKE ? LIMIT 3").bind(like),
  ]);
  return { products: (p.results as any[]).map((x) => ({ ...x, thumbnail: sized(x.thumbnail, 120, 160) })), categories: c.results };
}

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
