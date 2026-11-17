/** @jsxImportSource hono/jsx */
import { Hono, type Context } from 'hono';
import { DISTRICTS, normalizePhone, zoneFor } from '../../shared/bd';
import { createOrder, quote, priceCart, OrderError, refreshRatingStmt } from '../../shared/orders';
import {
  loadSettings, loadCategories, listProducts, facets, getProduct, productReviews, relatedProducts, homeSections,
  categoryCovers, cardsByIds, suggest, type Env, type Category, type ListOptions,
} from './data';
import { currentCustomer, sendOtp, verifyOtp, logout, type Customer } from './customer';
import { Grid, type Ctx } from './views/layout';
import adminApp from '../../admin/worker/index';
import {
  Home, Listing, ProductPage, QuickView, CartPage, CheckoutPage, OrderPage, TrackPage, StaticPage, NotFound, SearchPage,
  LoginPage, AccountPage, AccountOrderPage, WishlistPage,
} from './views/pages';

type App = { Bindings: Env; Variables: { ctx: Ctx; customer: Customer | null } };
const app = new Hono<App>();
type C = Context<App>;

const json = async (c: C) => c.req.json().catch(() => ({} as any));
const safeNext = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/account');

// ---------- Admin panel at /admin (API + single-page app built into public/admin) ----------
app.all('/admin/api/*', (c) => {
  const env = { ...c.env, STORE_URL: (c.env.SITE_URL || new URL(c.req.url).origin).replace(/\/$/, '') };
  return adminApp.fetch(c.req.raw, env as any, c.executionCtx);
});
app.get('/admin', (c) => c.redirect('/admin/'));
app.get('/admin/*', async (c) => {
  if (c.req.path.startsWith('/admin/assets/')) return c.text('Not found', 404);
  const res = await c.env.ASSETS.fetch(new URL('/admin/', c.req.url));
  const h = new Headers(res.headers);
  h.set('cache-control', 'no-store');
  h.set('x-robots-tag', 'noindex, nofollow');
  return new Response(res.body, { status: 200, headers: h });
});

// Customer session for every request; page context for HTML routes
app.use('*', async (c, next) => {
  const p = c.req.path;
  if (p.startsWith('/admin')) return next();
  if (p.startsWith('/media/') || p === '/robots.txt' || p === '/sitemap.xml') return next();
  c.set('customer', await currentCustomer(c));
  if (p.startsWith('/api/')) return next();
  const [settings, categories] = await Promise.all([loadSettings(c.env.DB), loadCategories(c.env.DB)]);
  const siteUrl = (c.env.SITE_URL || new URL(c.req.url).origin).replace(/\/$/, '');
  c.set('ctx', { settings, categories, path: p, siteUrl, customer: c.var.customer });
  await next();
  if (c.res.headers.get('content-type')?.includes('text/html') && !c.res.headers.has('cache-control')) {
    c.res.headers.set('cache-control', c.var.customer ? 'private, no-store' : 'public, max-age=0, s-maxage=60');
  }
});

// ---------- Catalogue ----------
app.get('/', async (c) => {
  const ctx = c.var.ctx;
  const featured = ctx.settings.home.featured_categories || [];
  const tops = ctx.categories.filter((x) => !x.parent_id).map((x) => x.id);
  const [sections, covers] = await Promise.all([homeSections(c.env.DB), categoryCovers(c.env.DB, [...new Set([...featured, ...tops])])]);
  return c.html(<Home ctx={ctx} {...sections} covers={covers} />);
});

function listOptions(c: C, base: ListOptions = {}) {
  const q = c.req.query();
  const sizes = (c.req.queries('size') || []).slice(0, 10).map((s) => s.slice(0, 30));
  const colors = (c.req.queries('color') || []).slice(0, 10).map((s) => s.slice(0, 30));
  const opts: ListOptions = {
    ...base, sort: q.sort, sizes, colors, inStock: q.stock === '1', rating: q.rating === '4' ? 4 : undefined,
    min: Number(q.min) > 0 ? Number(q.min) : undefined, max: Number(q.max) > 0 ? Number(q.max) : undefined,
    onSale: base.onSale || q.sale === '1', page: Number(q.page) || 1, q: base.q,
  };
  const query: Record<string, string | string[]> = {};
  for (const k of ['sort', 'stock', 'rating', 'min', 'max', 'sale', 'page', 'q']) if (q[k]) query[k] = String(q[k]).slice(0, 80);
  if (sizes.length) query.size = sizes;
  if (colors.length) query.color = colors;
  return { opts, query };
}

const LEGACY: Record<string, string> = { saree: 'sarees', kurti: 'kurtis', 'three-piece': 'salwar-kameez', polo: 'polo-t-shirts', 'tshirts': 'polo-t-shirts' };

app.get('/category/:slug', async (c) => {
  const ctx = c.var.ctx;
  const slug = c.req.param('slug').toLowerCase();
  if (LEGACY[slug]) return c.redirect(`/category/${LEGACY[slug]}`, 301);
  const cat = ctx.categories.find((x) => x.slug === slug);
  if (!cat) return c.html(<NotFound ctx={ctx} />, 404);
  const parent = cat.parent_id ? ctx.categories.find((x) => x.id === cat.parent_id) : undefined;
  const top = parent || cat;
  const children = ctx.categories.filter((x) => x.parent_id === top.id);
  const ids = cat.parent_id ? [cat.id] : [cat.id, ...children.map((x) => x.id)];
  const { opts, query } = listOptions(c, { categoryIds: ids });
  const [res, f] = await Promise.all([listProducts(c.env.DB, opts), facets(c.env.DB, opts)]);
  return c.html(<Listing ctx={ctx} title={cat.name} description={cat.description || `Shop ${cat.name} at ${ctx.settings.store.name}.`} category={cat} parent={parent} children={children}
    {...res} facets={f} query={query} basePath={`/category/${cat.slug}`} />);
});

app.get('/shop', async (c) => {
  const { opts, query } = listOptions(c);
  const [res, f] = await Promise.all([listProducts(c.env.DB, opts), facets(c.env.DB, opts)]);
  return c.html(<Listing ctx={c.var.ctx} title="All products" {...res} facets={f} query={query} basePath="/shop" />);
});

app.get('/sale', async (c) => {
  const { opts, query } = listOptions(c, { onSale: true });
  const [res, f] = await Promise.all([listProducts(c.env.DB, opts), facets(c.env.DB, opts)]);
  return c.html(<Listing ctx={c.var.ctx} title="Sale & offers" {...res} facets={f} query={query} basePath="/sale" />);
});

app.get('/search', async (c) => {
  const term = (c.req.query('q') || '').trim().slice(0, 80);
  if (!term) return c.html(<SearchPage ctx={c.var.ctx} popular={c.var.ctx.categories.filter((x) => x.parent_id)} />);
  const { opts, query } = listOptions(c, { q: term });
  const [res, f] = await Promise.all([listProducts(c.env.DB, opts), facets(c.env.DB, opts)]);
  return c.html(<Listing ctx={c.var.ctx} title={`Results for “${term}”`} {...res} facets={f} query={{ ...query, q: term }} basePath="/search" />);
});

app.get('/product/:slug', async (c) => {
  const p = await getProduct(c.env.DB, c.req.param('slug').toLowerCase());
  if (!p) return c.html(<NotFound ctx={c.var.ctx} />, 404);
  const [related, reviews] = await Promise.all([relatedProducts(c.env.DB, p.id, p.category_id), productReviews(c.env.DB, p.id)]);
  return c.html(<ProductPage ctx={c.var.ctx} p={p} related={related} reviews={reviews} />);
});

// HTML fragments loaded by app.js
app.get('/fragments/quick/:slug', async (c) => {
  const p = await getProduct(c.env.DB, c.req.param('slug').toLowerCase());
  if (!p) return c.text('Not found', 404);
  return c.html(<QuickView p={p} />);
});
app.get('/fragments/cards', async (c) => {
  const ids = (c.req.query('ids') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 24);
  const cards = await cardsByIds(c.env.DB, ids);
  if (!cards.length) return c.html('');
  return c.html(<Grid products={cards} />);
});

// ---------- Cart, checkout, orders ----------
app.get('/cart', (c) => c.html(<CartPage ctx={c.var.ctx} />));
app.get('/checkout', async (c) => {
  const cu = c.var.customer;
  const addresses = cu ? (await c.env.DB.prepare('SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC').bind(cu.id).all()).results : [];
  return c.html(<CheckoutPage ctx={c.var.ctx} addresses={addresses as any[]} />);
});

async function findOrder(db: D1Database, orderNo: string, phone: string | null) {
  if (!phone) return null;
  const o = await db.prepare('SELECT * FROM orders WHERE order_no = ? AND phone = ?').bind(orderNo.trim().toUpperCase(), phone).first<any>();
  if (!o) return null;
  const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(o.id).all<any>();
  return { o, items: items.results };
}

app.get('/order/:no', async (c) => {
  const found = await findOrder(c.env.DB, c.req.param('no'), normalizePhone(c.req.query('phone') || ''));
  if (!found) return c.html(<TrackPage ctx={c.var.ctx} error="We couldn't find that order. Check the order and mobile number." />, 404);
  c.header('cache-control', 'private, no-store');
  return c.html(<OrderPage ctx={c.var.ctx} order={found.o} items={found.items} justPlaced={c.req.query('new') === '1'} />);
});

app.get('/track', async (c) => {
  const order = c.req.query('order');
  const phone = c.req.query('phone');
  if (!order && !phone) return c.html(<TrackPage ctx={c.var.ctx} />);
  const found = await findOrder(c.env.DB, order || '', normalizePhone(phone || ''));
  if (!found) return c.html(<TrackPage ctx={c.var.ctx} error="We couldn't find that order. Check the order and mobile number." values={{ order, phone }} />);
  c.header('cache-control', 'private, no-store');
  return c.html(<OrderPage ctx={c.var.ctx} order={found.o} items={found.items} justPlaced={false} />);
});

// ---------- Account ----------
app.get('/account/login', (c) => {
  if (c.var.customer) return c.redirect(safeNext(c.req.query('next')));
  return c.html(<LoginPage ctx={c.var.ctx} next={safeNext(c.req.query('next'))} />);
});
app.post('/account/logout', (c) => { logout(c); return c.redirect('/'); });
app.get('/account', async (c) => {
  const cu = c.var.customer;
  if (!cu) return c.redirect('/account/login?next=/account');
  const db = c.env.DB;
  const [orders, addresses, ledger] = await db.batch([
    db.prepare(`SELECT o.order_no, o.total, o.status, o.created_at, (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS items,
        (SELECT json_group_array(image) FROM (SELECT image FROM order_items WHERE order_id = o.id LIMIT 3)) AS images
      FROM orders o WHERE o.customer_id = ? OR o.phone = ? ORDER BY o.id DESC LIMIT 50`).bind(cu.id, cu.phone),
    db.prepare('SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC').bind(cu.id),
    db.prepare('SELECT * FROM points_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 15').bind(cu.id),
  ]);
  const ords = (orders.results as any[]).map((o) => ({ ...o, images: JSON.parse(o.images || '[]').filter(Boolean) }));
  return c.html(<AccountPage ctx={c.var.ctx} orders={ords} addresses={addresses.results as any[]} ledger={ledger.results as any[]} />);
});
app.get('/account/orders/:no', async (c) => {
  const cu = c.var.customer;
  if (!cu) return c.redirect(`/account/login?next=/account/orders/${encodeURIComponent(c.req.param('no'))}`);
  const found = await findOrder(c.env.DB, c.req.param('no'), cu.phone);
  if (!found) return c.html(<NotFound ctx={c.var.ctx} />, 404);
  return c.html(<AccountOrderPage ctx={c.var.ctx} order={found.o} items={found.items} />);
});
app.get('/wishlist', (c) => c.html(<WishlistPage ctx={c.var.ctx} />));

// ---------- Content ----------
app.get('/pages/:slug', async (c) => {
  const pg = await c.env.DB.prepare('SELECT title, body FROM pages WHERE slug = ?').bind(c.req.param('slug')).first<{ title: string; body: string }>();
  if (!pg) return c.html(<NotFound ctx={c.var.ctx} />, 404);
  return c.html(<StaticPage ctx={c.var.ctx} title={pg.title} body={pg.body} />);
});
for (const [from, to] of Object.entries({ '/about': '/pages/about', '/privacy': '/pages/privacy-policy', '/terms': '/pages/terms-and-conditions', '/returns': '/pages/return-and-exchange', '/shipping': '/pages/shipping-policy' })) {
  app.get(from, (c) => c.redirect(to, 301));
}

app.get('/sitemap.xml', async (c) => {
  const base = (c.env.SITE_URL || new URL(c.req.url).origin).replace(/\/$/, '');
  const [cats, prods, pages] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT slug FROM categories WHERE status = 'active'"),
    c.env.DB.prepare("SELECT slug, updated_at FROM products WHERE status = 'active' AND max_price > 0"),
    c.env.DB.prepare('SELECT slug FROM pages'),
  ]);
  const urls = [`${base}/`, `${base}/shop`, `${base}/sale`, ...(cats.results as any[]).map((r) => `${base}/category/${r.slug}`), ...(pages.results as any[]).map((r) => `${base}/pages/${r.slug}`)].map((u) => `<url><loc>${u}</loc></url>`);
  for (const r of prods.results as any[]) urls.push(`<url><loc>${base}/product/${encodeURIComponent(r.slug)}</loc><lastmod>${String(r.updated_at).slice(0, 10)}</lastmod></url>`);
  return c.body(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`, 200, { 'content-type': 'application/xml' });
});
app.get('/robots.txt', (c) => {
  const base = (c.env.SITE_URL || new URL(c.req.url).origin).replace(/\/$/, '');
  return c.text(`User-agent: *\nDisallow: /cart\nDisallow: /checkout\nDisallow: /order/\nDisallow: /account\nDisallow: /api/\nDisallow: /fragments/\nSitemap: ${base}/sitemap.xml\n`);
});

// ================= Public API =================
app.post('/api/cart', async (c) => {
  const body = await json(c);
  const lines = await priceCart(c.env.DB, Array.isArray(body.items) ? body.items : []);
  return c.json({ lines, subtotal: lines.filter((l) => l.available).reduce((s, l) => s + l.total, 0), qty: lines.filter((l) => l.available).reduce((s, l) => s + l.qty, 0) });
});

app.post('/api/quote', async (c) => {
  const body = await json(c);
  return c.json(await quote(c.env.DB, {
    items: Array.isArray(body.items) ? body.items : [], district: body.district, zone: body.zone, coupon: body.coupon,
    customerId: c.var.customer?.id, usePoints: body.usePoints ? 1e9 : 0,
  }));
});

app.post('/api/orders', async (c) => {
  const body = await json(c);
  if (body.website) return c.json({ error: 'Invalid request.' }, 400); // honeypot
  const cu = c.var.customer;
  try {
    const res = await createOrder(c.env.DB, {
      items: Array.isArray(body.items) ? body.items : [], name: body.name, phone: body.phone, email: body.email, address: body.address,
      district: body.district, area: body.area, zone: body.zone, note: body.note, coupon: body.coupon || undefined, source: 'web',
      customerId: cu?.id ?? null, usePoints: cu && body.usePoints ? 1e9 : 0,
    });
    const phone = normalizePhone(body.phone)!;
    if (cu && body.save_address) {
      const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM addresses WHERE customer_id = ?').bind(cu.id).first<{ n: number }>();
      if ((n?.n || 0) < 10) {
        await c.env.DB.prepare('INSERT INTO addresses (customer_id, label, name, phone, district, area, zone, address, is_default) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(cu.id, n?.n ? `Address ${n.n + 1}` : 'Home', String(body.name).slice(0, 100), phone, body.district, String(body.area || '').slice(0, 100) || null, zoneFor(body.district, body.zone), String(body.address).slice(0, 500), n?.n ? 0 : 1).run();
      }
    }
    return c.json({ ok: true, orderNo: res.orderNo, phone, total: res.total });
  } catch (e) {
    if (e instanceof OrderError) return c.json({ error: e.message, field: e.field }, 422);
    console.error('order failed', e);
    return c.json({ error: 'Something went wrong. Please try again or call us.' }, 500);
  }
});

// Abandoned checkout capture: saved when a shopper types their phone at checkout
app.post('/api/draft', async (c) => {
  const b = await json(c);
  const phone = normalizePhone(b.phone || '');
  if (!phone) return c.json({ ok: false });
  const lines = await priceCart(c.env.DB, Array.isArray(b.items) ? b.items : []);
  if (!lines.length) return c.json({ ok: false });
  const items = lines.map((l) => ({ variantId: l.variantId, name: l.name, color: l.color, size: l.size, qty: l.qty, price: l.price, image: l.image }));
  await c.env.DB.prepare(`INSERT INTO checkout_drafts (phone, name, district, items, subtotal, status, updated_at) VALUES (?,?,?,?,?, 'open', ?)
      ON CONFLICT(phone) DO UPDATE SET name = excluded.name, district = excluded.district, items = excluded.items, subtotal = excluded.subtotal, updated_at = excluded.updated_at,
        status = CASE WHEN checkout_drafts.status = 'converted' THEN 'open' ELSE checkout_drafts.status END`)
    .bind(phone, String(b.name || '').slice(0, 100) || null, DISTRICTS.includes(b.district) ? b.district : null, JSON.stringify(items), lines.reduce((s, l) => s + l.total, 0), new Date().toISOString()).run();
  return c.json({ ok: true });
});

app.get('/api/suggest', async (c) => {
  const q = (c.req.query('q') || '').trim().slice(0, 60);
  if (q.length < 2) return c.json({ products: [], categories: [] });
  c.header('cache-control', 'public, max-age=60');
  return c.json(await suggest(c.env.DB, q));
});

// --- Login with SMS code ---
app.post('/api/auth/otp', async (c) => {
  const b = await json(c);
  const r = await sendOtp(c, b.phone);
  return c.json(r, r.error ? 400 : 200);
});
app.post('/api/auth/verify', async (c) => {
  const b = await json(c);
  const r = await verifyOtp(c, b.phone, b.code, b.name);
  if (r.error) return c.json(r, 400);
  // Merge the guest wishlist into the account
  const ids = (Array.isArray(b.wishlist) ? b.wishlist : []).map(Number).filter((n: number) => n > 0).slice(0, 100);
  if (ids.length && r.customer) await c.env.DB.batch(ids.map((id: number) => c.env.DB.prepare('INSERT OR IGNORE INTO wishlists (customer_id, product_id) SELECT ?, id FROM products WHERE id = ?').bind(r.customer!.id, id)));
  return c.json(r);
});

// --- Wishlist (account) ---
app.get('/api/wishlist', async (c) => {
  const cu = c.var.customer;
  if (!cu) return c.json({ ids: [] });
  const r = await c.env.DB.prepare('SELECT product_id FROM wishlists WHERE customer_id = ? ORDER BY created_at DESC').bind(cu.id).all<{ product_id: number }>();
  return c.json({ ids: r.results.map((x) => x.product_id) });
});
app.post('/api/wishlist', async (c) => {
  const cu = c.var.customer;
  if (!cu) return c.json({ error: 'Sign in to sync your wishlist.' }, 401);
  const b = await json(c);
  const pid = Number(b.productId);
  if (!(pid > 0)) return c.json({ error: 'Invalid product.' }, 400);
  if (b.on) await c.env.DB.prepare('INSERT OR IGNORE INTO wishlists (customer_id, product_id) SELECT ?, id FROM products WHERE id = ?').bind(cu.id, pid).run();
  else await c.env.DB.prepare('DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?').bind(cu.id, pid).run();
  return c.json({ ok: true });
});

// --- Addresses ---
app.delete('/api/addresses/:id{[0-9]+}', async (c) => {
  const cu = c.var.customer;
  if (!cu) return c.json({ error: 'Please sign in.' }, 401);
  await c.env.DB.prepare('DELETE FROM addresses WHERE id = ? AND customer_id = ?').bind(Number(c.req.param('id')), cu.id).run();
  return c.json({ ok: true });
});

// --- Reorder: items from a past order that are still available ---
app.get('/api/reorder/:no', async (c) => {
  const cu = c.var.customer;
  if (!cu) return c.json({ error: 'Please sign in.' }, 401);
  const o = await c.env.DB.prepare('SELECT id FROM orders WHERE order_no = ? AND (customer_id = ? OR phone = ?)').bind(c.req.param('no'), cu.id, cu.phone).first<{ id: number }>();
  if (!o) return c.json({ error: 'Order not found.' }, 404);
  const items = (await c.env.DB.prepare('SELECT variant_id, qty FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL').bind(o.id).all<any>()).results;
  const lines = await priceCart(c.env.DB, items.map((i) => ({ variantId: i.variant_id, qty: i.qty })));
  return c.json({ items: lines.filter((l) => l.stock > 0).map((l) => ({ variantId: l.variantId, qty: Math.min(l.qty, l.stock) })), skipped: lines.filter((l) => l.stock <= 0).length + (items.length - lines.length) });
});

// --- Reviews (signed-in customers; auto-approved when they bought the product) ---
const IMG_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
app.post('/api/reviews', async (c) => {
  const cu = c.var.customer;
  if (!cu) return c.json({ error: 'Please sign in to write a review.' }, 401);
  const form = await c.req.formData();
  const pid = Number(form.get('product_id'));
  const rating = Number(form.get('rating'));
  const body = String(form.get('body') || '').trim().slice(0, 1000);
  if (!(pid > 0) || !(rating >= 1 && rating <= 5)) return c.json({ error: 'Please choose a star rating.' }, 400);
  if (body.length < 10) return c.json({ error: 'Please write at least a sentence about the product.' }, 400);
  const db = c.env.DB;
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE customer_id = ? AND product_id = ?').bind(cu.id, pid).first<{ n: number }>();
  if ((recent?.n || 0) >= 2) return c.json({ error: 'You have already reviewed this product.' }, 409);
  const bought = await db.prepare(`SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE (o.customer_id = ? OR o.phone = ?) AND oi.product_id = ? AND o.status = 'delivered' LIMIT 1`).bind(cu.id, cu.phone, pid).first<{ id: number }>();
  const photos: string[] = [];
  for (const f of form.getAll('photos').slice(0, 3)) {
    if (!(f instanceof File) || !f.size) continue;
    const ext = IMG_TYPES[f.type];
    if (!ext) return c.json({ error: 'Photos must be JPG, PNG or WebP.' }, 400);
    if (f.size > 4 * 1024 * 1024) return c.json({ error: 'Each photo must be 4 MB or smaller.' }, 400);
    const key = `reviews/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID().slice(0, 12)}.${ext}`;
    await c.env.MEDIA.put(key, f.stream(), { httpMetadata: { contentType: f.type, cacheControl: 'public, max-age=31536000, immutable' } });
    photos.push(`/media/${key}`);
  }
  const fit = ['small', 'true', 'large'].includes(String(form.get('fit'))) ? String(form.get('fit')) : null;
  const status = bought ? 'approved' : 'pending';
  const first = cu.name.split(' ')[0];
  const last = cu.name.split(' ')[1]?.[0];
  await db.batch([
    db.prepare('INSERT INTO reviews (product_id, customer_id, order_id, name, rating, title, body, photos, size_bought, fit, verified, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(pid, cu.id, bought?.id ?? null, last ? `${first} ${last}.` : first, rating, String(form.get('title') || '').trim().slice(0, 80) || null, body, JSON.stringify(photos),
        String(form.get('size_bought') || '').slice(0, 30) || null, fit, bought ? 1 : 0, status),
    refreshRatingStmt(db, pid),
  ]);
  return c.json({ ok: true, status, message: status === 'approved' ? 'Thank you! Your review is now live.' : 'Thank you! Your review will appear after a quick check.' });
});

// --- Back in stock alert ---
app.post('/api/stock-alert', async (c) => {
  const b = await json(c);
  const phone = normalizePhone(b.phone || '');
  if (!phone) return c.json({ error: 'Enter a valid mobile number (01XXXXXXXXX).' }, 400);
  const v = await c.env.DB.prepare('SELECT id, product_id FROM variants WHERE id = ?').bind(Number(b.variantId)).first<{ id: number; product_id: number }>();
  if (!v) return c.json({ error: 'Product not found.' }, 404);
  await c.env.DB.prepare('INSERT OR IGNORE INTO stock_alerts (variant_id, product_id, phone) VALUES (?,?,?)').bind(v.id, v.product_id, phone).run();
  return c.json({ ok: true });
});

// --- Newsletter / offers sign-up (stored as a customer with marketing note) ---
app.post('/api/subscribe', async (c) => {
  const b = await json(c);
  const phone = normalizePhone(b.phone || '');
  if (!phone) return c.json({ error: 'Enter a valid mobile number (01XXXXXXXXX).' }, 400);
  await c.env.DB.prepare("INSERT INTO customers (name, phone, notes) VALUES ('Subscriber', ?, 'Joined offers list') ON CONFLICT(phone) DO NOTHING").bind(phone).run();
  return c.json({ ok: true });
});

// Images uploaded from the admin panel or with reviews (R2)
app.get('/media/*', async (c) => {
  const key = decodeURIComponent(c.req.path.slice('/media/'.length));
  if (!key || key.includes('..')) return c.notFound();
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('cache-control', 'public, max-age=31536000, immutable');
  h.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers: h });
});

app.notFound((c) => {
  const ctx = c.get('ctx');
  return ctx ? c.html(<NotFound ctx={ctx} />, 404) : c.json({ error: 'Not found' }, 404);
});
app.onError((e, c) => {
  console.error(e);
  return c.req.path.startsWith('/api/') ? c.json({ error: 'Something went wrong. Please try again.' }, 500) : c.text('Something went wrong. Please refresh the page.', 500);
});

export default app;
export type { Category };
