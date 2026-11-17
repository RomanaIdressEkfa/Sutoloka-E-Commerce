/** @jsxImportSource hono/jsx */
import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';
import { taka } from '../../../shared/bd';
import { safeJson, sized, type Category, type ProductCard, type StoreSettings } from '../data';
import type { Customer } from '../customer';

export type Ctx = { settings: StoreSettings; categories: Category[]; path: string; siteUrl: string; customer: Customer | null };

const svg = (d: Child, size = 22, extra = '') => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={extra} aria-hidden="true">{d}</svg>
);
export const Icon = {
  search: (s = 22) => svg(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, s),
  bag: (s = 22) => svg(<><path d="M6 7h12l1 14H5L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></>, s),
  heart: (s = 22) => svg(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />, s),
  user: (s = 22) => svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>, s),
  home: (s = 22) => svg(<><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>, s),
  grid: (s = 22) => svg(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>, s),
  menu: (s = 24) => svg(<path d="M4 7h16M4 12h16M4 17h16" />, s),
  close: (s = 22) => svg(<path d="M6 6l12 12M18 6 6 18" />, s),
  eye: (s = 18) => svg(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>, s),
  truck: (s = 26) => svg(<><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>, s),
  cash: (s = 26) => svg(<><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>, s),
  swap: (s = 26) => svg(<path d="M4 8h13l-3-3M20 16H7l3 3" />, s),
  shield: (s = 26) => svg(<><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>, s),
  bolt: (s = 20) => svg(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />, s),
  filter: (s = 20) => svg(<path d="M4 5h16M7 12h10M10 19h4" />, s),
  phone: (s = 18) => svg(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />, s),
  bell: (s = 18) => svg(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Z" /><path d="M10 21a2 2 0 0 0 4 0" /></>, s),
  gift: (s = 20) => svg(<><rect x="3" y="8" width="18" height="13" rx="1.5" /><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4.5 9 8 12 8Zm0 0s2-5 4.5-3.5S15 8 12 8Z" /></>, s),
};

export function Logo(props: { name: string; bn?: string; class?: string; light?: boolean }) {
  return (
    <span class={`inline-flex items-center gap-2.5 ${props.class || ''}`}>
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><circle cx="24" cy="26" r="13" fill="#b4235a" /><circle cx="40" cy="26" r="13" fill="#f59f00" fill-opacity=".9" /><circle cx="32" cy="40" r="13" fill="#12b886" fill-opacity=".85" /></svg>
      <span class="flex flex-col leading-none">
        <span class={`text-[22px] font-bold tracking-tight ${props.light ? 'text-white' : 'text-ink'}`}>{props.name}</span>
        {props.bn && <span class={`mt-1 font-['Hind_Siliguri'] text-[13px] font-medium ${props.light ? 'text-white/70' : 'text-brand'}`}>{props.bn}</span>}
      </span>
    </span>
  );
}

export function Stars(props: { value: number; size?: number; class?: string }) {
  const v = Math.round((props.value || 0) * 2) / 2;
  const s = props.size || 14;
  return (
    <span class={`inline-flex items-center ${props.class || ''}`} aria-label={`${props.value.toFixed(1)} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
          <defs><linearGradient id={`h${i}`}><stop offset="50%" stop-color="var(--color-star)" /><stop offset="50%" stop-color="#e5e1e6" /></linearGradient></defs>
          <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.8L10 1.5Z" fill={v >= i ? 'var(--color-star)' : v >= i - 0.5 ? `url(#h${i})` : '#e5e1e6'} />
        </svg>
      ))}
    </span>
  );
}

export function Layout(props: { ctx: Ctx; title?: string; description?: string; image?: string | null; children: Child; noindex?: boolean }) {
  const { settings, categories, siteUrl, path, customer } = props.ctx;
  const name = settings.store.name || 'Sutoloka';
  const title = props.title ? `${props.title} | ${name}` : `${name} — ${settings.store.tagline || 'Fashion for the whole family'}`;
  const desc = props.description || `${name}: sarees, salwar kameez, kurtis, panjabis, shirts and kidswear. Cash on delivery all over Bangladesh.`;
  const top = categories.filter((c) => !c.parent_id);
  const kids = (id: number) => categories.filter((c) => c.parent_id === id);
  const freeOver = settings.delivery.free_over || 0;
  return (
    <>
      {raw('<!doctype html>')}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <title>{title}</title>
          <meta name="description" content={desc} />
          <link rel="canonical" href={siteUrl + path} />
          <meta property="og:site_name" content={name} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={desc} />
          {props.image && <meta property="og:image" content={props.image} />}
          <meta property="og:type" content="website" />
          {props.noindex && <meta name="robots" content="noindex" />}
          <meta name="theme-color" content="#17161c" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link rel="preconnect" href="https://images.unsplash.com" />
          <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <link rel="stylesheet" href="/assets/app.css" />
          <script>{raw(`window.__STORE__=${JSON.stringify({ freeOver, loggedIn: !!customer, offers: settings.offers.enabled ? settings.offers.tiers : [] })};`)}</script>
        </head>
        <body class="pb-16 lg:pb-0">
          {settings.announcement.enabled && settings.announcement.text && (
            <div class="bg-ink text-white"><p class="wrap py-2 text-center text-[13px] font-medium tracking-wide sm:text-sm">
              {settings.announcement.text.split('·').map((part, i) => <span class={i > 0 ? 'hidden md:inline' : ''}>{i > 0 ? ' · ' : ''}{part.trim()}</span>)}
            </p></div>
          )}
          <header class="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
            <div class="wrap flex h-16 items-center gap-3 lg:h-[72px]">
              <button class="-ml-2 p-2 lg:hidden" data-open="menu" aria-label="Open menu">{Icon.menu()}</button>
              <a href="/" class="shrink-0" aria-label={`${name} home`}><Logo name={name} bn={settings.store.name_bn} /></a>
              <nav class="ml-4 hidden items-center gap-0.5 lg:flex xl:ml-8" aria-label="Main">
                {top.map((c) => {
                  const sub = kids(c.id);
                  return (
                    <div class="group relative">
                      <a href={`/category/${c.slug}`} class="block whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-medium text-ink/85 hover:bg-cream hover:text-ink">{c.name}</a>
                      {sub.length > 0 && (
                        <div class="invisible absolute left-0 top-full z-50 min-w-56 translate-y-1 rounded-xl border border-line bg-white p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                          <a href={`/category/${c.slug}`} class="block rounded-lg px-3 py-2 text-[15px] font-medium hover:bg-cream">All {c.name}</a>
                          {sub.map((s) => <a href={`/category/${s.slug}`} class="block rounded-lg px-3 py-2 text-[15px] text-ink/80 hover:bg-cream hover:text-ink">{s.name}</a>)}
                        </div>
                      )}
                    </div>
                  );
                })}
                <a href="/sale" class="whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-semibold text-sale hover:bg-sale/10">Sale</a>
              </nav>
              <form action="/search" class="relative ml-auto hidden flex-1 md:block md:max-w-xs xl:max-w-sm" data-suggest-form role="search">
                <input name="q" type="search" autocomplete="off" placeholder="Search sarees, panjabi, kurti…" data-suggest-input
                  class="h-11 w-full rounded-full border border-line bg-cream pl-11 pr-4 text-[15px] focus:border-ink focus:bg-white focus:outline-none" aria-label="Search products" />
                <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{Icon.search(20)}</span>
                <div data-suggest-box class="absolute inset-x-0 top-full z-50 mt-2 hidden overflow-hidden rounded-xl border border-line bg-white shadow-xl"></div>
              </form>
              <div class="ml-auto flex items-center md:ml-2">
                <a href="/search" class="p-2 md:hidden" aria-label="Search">{Icon.search()}</a>
                <a href={customer ? '/account' : '/account/login'} class="hidden p-2 sm:block" aria-label="Account">{Icon.user()}</a>
                <a href="/wishlist" class="relative hidden p-2 sm:block" aria-label="Wishlist">
                  {Icon.heart()}
                  <span data-wish-count class="absolute -right-0.5 -top-0.5 hidden h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold text-white">0</span>
                </a>
                <button class="relative p-2" data-open="cart" aria-label="Open cart">
                  {Icon.bag()}
                  <span data-cart-count class="absolute -right-0.5 -top-0.5 hidden h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white">0</span>
                </button>
              </div>
            </div>
          </header>

          {/* Mobile menu */}
          <div data-panel="menu" class="fixed inset-0 z-50 hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div class="absolute inset-0 bg-black/40" data-close=""></div>
            <aside class="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white">
              <div class="flex h-16 items-center justify-between border-b border-line px-4"><Logo name={name} bn={settings.store.name_bn} /><button class="p-2" data-close="" aria-label="Close menu">{Icon.close()}</button></div>
              <nav class="flex-1 overflow-y-auto p-2">
                {top.map((c) => (
                  <details class="group border-b border-line/70">
                    <summary class="flex cursor-pointer list-none items-center justify-between px-3 py-3.5 text-base font-medium">{c.name}<span class="text-muted transition group-open:rotate-45">+</span></summary>
                    <div class="pb-2">
                      <a href={`/category/${c.slug}`} class="block rounded-lg py-2 pl-6 pr-3 text-[15px] font-medium hover:bg-cream">All {c.name}</a>
                      {kids(c.id).map((s) => <a href={`/category/${s.slug}`} class="block rounded-lg py-2 pl-6 pr-3 text-[15px] text-ink/75 hover:bg-cream">{s.name}</a>)}
                    </div>
                  </details>
                ))}
                <a href="/sale" class="block px-3 py-3.5 text-base font-semibold text-sale">Sale</a>
                <a href="/track" class="block px-3 py-3.5 text-base font-medium">Track your order</a>
                <a href={customer ? '/account' : '/account/login'} class="block px-3 py-3.5 text-base font-medium">{customer ? 'My account' : 'Sign in / Register'}</a>
              </nav>
              {settings.store.phone && <a href={`tel:${settings.store.phone.replace(/[^\d+]/g, '')}`} class="flex items-center gap-2 border-t border-line p-4 text-[15px] font-medium">{Icon.phone()}{settings.store.phone}</a>}
            </aside>
          </div>

          {/* Cart drawer (filled by app.js) */}
          <div data-panel="cart" class="fixed inset-0 z-50 hidden" role="dialog" aria-modal="true" aria-label="Shopping cart">
            <div class="absolute inset-0 bg-black/40" data-close=""></div>
            <aside class="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
              <div class="flex h-16 items-center justify-between border-b border-line px-5"><h2 class="text-lg">Your cart</h2><button class="p-2" data-close="" aria-label="Close cart">{Icon.close()}</button></div>
              <div data-progress class="border-b border-line px-5 py-3"></div>
              <div data-cart-lines class="flex-1 overflow-y-auto px-5"></div>
              <div class="border-t border-line p-5">
                <div class="mb-4 flex items-center justify-between text-base"><span>Subtotal</span><strong data-cart-subtotal>৳0</strong></div>
                <a href="/checkout" class="btn-dark w-full">Checkout</a>
                <a href="/cart" class="mt-2 block py-2 text-center text-[15px] font-medium text-ink/70 underline-offset-4 hover:underline">View cart</a>
              </div>
            </aside>
          </div>

          {/* Quick view (filled by app.js) */}
          <div data-panel="quick" class="fixed inset-0 z-50 hidden items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Quick view">
            <div class="absolute inset-0 bg-black/50" data-close=""></div>
            <div class="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl">
              <button class="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 shadow" data-close="" aria-label="Close">{Icon.close()}</button>
              <div data-quick-body></div>
            </div>
          </div>

          <main>{props.children}</main>

          <section class="mt-16 border-t border-line bg-cream">
            <div class="wrap grid grid-cols-2 gap-6 py-10 lg:grid-cols-4">
              {[
                [Icon.cash, 'Cash on delivery', 'Pay when you receive'],
                [Icon.truck, freeOver ? `Free delivery over ${taka(freeOver)}` : 'Nationwide delivery', `Dhaka ${settings.delivery.inside_days || '1–2 days'}, others ${settings.delivery.outside_days || '2–4 days'}`],
                [Icon.swap, '7-day exchange', 'Wrong size? Swap it easily'],
                [Icon.shield, 'Quality checked', 'Every piece inspected'],
              ].map(([I, t, d]: any) => (
                <div class="flex items-start gap-3"><span class="mt-0.5 text-brand">{I()}</span><div><p class="font-semibold">{t}</p><p class="text-sm text-muted">{d}</p></div></div>
              ))}
            </div>
          </section>

          <footer class="bg-ink text-white/75">
            <div class="wrap grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
              <div class="lg:col-span-2">
                <Logo name={name} bn={settings.store.name_bn} light />
                <p class="mt-4 max-w-sm text-[15px] leading-7">{settings.store.tagline}</p>
                <form data-newsletter class="mt-5 flex max-w-sm gap-2">
                  <input type="tel" name="phone" placeholder="Your mobile for offers" class="h-11 flex-1 rounded-lg border border-white/15 bg-white/5 px-4 text-[15px] text-white placeholder:text-white/40 focus:border-white focus:outline-none" aria-label="Mobile number" />
                  <button class="btn-brand h-11 py-0">Join</button>
                </form>
                <div class="mt-5 flex gap-3 text-sm">
                  {settings.store.facebook && <a class="rounded-full border border-white/20 px-4 py-2 hover:border-white hover:text-white" href={settings.store.facebook} rel="noopener" target="_blank">Facebook</a>}
                  {settings.store.instagram && <a class="rounded-full border border-white/20 px-4 py-2 hover:border-white hover:text-white" href={settings.store.instagram} rel="noopener" target="_blank">Instagram</a>}
                </div>
              </div>
              <div>
                <h3 class="mb-4 text-base text-white">Shop</h3>
                <ul class="space-y-2.5 text-[15px]">{top.map((c) => <li><a class="hover:text-white" href={`/category/${c.slug}`}>{c.name}</a></li>)}<li><a class="hover:text-white" href="/sale">Sale</a></li></ul>
              </div>
              <div>
                <h3 class="mb-4 text-base text-white">Help</h3>
                <ul class="space-y-2.5 text-[15px]">
                  <li><a class="hover:text-white" href="/track">Track your order</a></li>
                  <li><a class="hover:text-white" href="/pages/shipping-policy">Shipping &amp; delivery</a></li>
                  <li><a class="hover:text-white" href="/pages/return-and-exchange">Return &amp; exchange</a></li>
                  <li><a class="hover:text-white" href="/pages/terms-and-conditions">Terms &amp; conditions</a></li>
                  <li><a class="hover:text-white" href="/pages/privacy-policy">Privacy policy</a></li>
                </ul>
              </div>
              <div>
                <h3 class="mb-4 text-base text-white">{name}</h3>
                <ul class="space-y-2.5 text-[15px]">
                  <li><a class="hover:text-white" href="/pages/about">About us</a></li>
                  <li><a class="hover:text-white" href={customer ? '/account' : '/account/login'}>My account</a></li>
                  {settings.store.phone && <li><a class="hover:text-white" href={`tel:${settings.store.phone.replace(/[^\d+]/g, '')}`}>{settings.store.phone}</a></li>}
                  {settings.store.email && <li><a class="hover:text-white" href={`mailto:${settings.store.email}`}>{settings.store.email}</a></li>}
                  {settings.store.address && <li>{settings.store.address}</li>}
                </ul>
              </div>
            </div>
            <div class="border-t border-white/10"><div class="wrap flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-white/55"><p>© {new Date().getFullYear()} {name}. All rights reserved.</p><p>Cash on delivery · All 64 districts</p></div></div>
          </footer>

          {/* Mobile bottom bar */}
          <nav class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Quick navigation">
            {[
              ['/', 'Home', Icon.home], ['#menu', 'Categories', Icon.grid], ['/wishlist', 'Wishlist', Icon.heart], ['#cart', 'Cart', Icon.bag], [customer ? '/account' : '/account/login', 'Account', Icon.user],
            ].map(([href, label, I]: any) => {
              const isPanel = href.startsWith('#');
              const active = !isPanel && (href === '/' ? path === '/' : path.startsWith(href));
              const inner = <><span class="relative">{I(22)}{label === 'Cart' && <span data-cart-count class="absolute -right-2 -top-1.5 hidden h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">0</span>}</span><span class="text-[11px] font-medium">{label}</span></>;
              return isPanel
                ? <button data-open={href.slice(1)} class="flex flex-col items-center gap-0.5 py-2 text-ink/70">{inner}</button>
                : <a href={href} class={`flex flex-col items-center gap-0.5 py-2 ${active ? 'text-brand' : 'text-ink/70'}`}>{inner}</a>;
            })}
          </nav>

          {settings.store.whatsapp && (
            <a href={`https://wa.me/${settings.store.whatsapp}`} target="_blank" rel="noopener" aria-label="Chat on WhatsApp"
              class="fixed bottom-20 right-4 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105 lg:bottom-6 lg:right-6">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.6 2.1 1.1 1 2.1 1.3 2.4 1.4.3.2.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.7-.1 1.3Z" /></svg>
            </a>
          )}
          <div data-toast class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] mx-auto w-fit translate-y-4 rounded-full bg-ink px-5 py-3 text-[15px] font-medium text-white opacity-0 shadow-lg transition lg:bottom-8"></div>
          <script src="/assets/app.js" defer></script>
        </body>
      </html>
    </>
  );
}

export function Price(props: { price: number; regular?: number | null; class?: string }) {
  const on = props.regular && props.regular > props.price;
  return (
    <span class={`flex flex-wrap items-baseline gap-x-2 ${props.class || ''}`}>
      <span class={on ? 'text-sale' : ''}>{taka(props.price)}</span>
      {on && <span class="text-[0.85em] font-normal text-muted line-through">{taka(props.regular!)}</span>}
      {on && <span class="rounded bg-sale/10 px-1.5 py-0.5 text-xs font-semibold text-sale">-{Math.round(((props.regular! - props.price) / props.regular!) * 100)}%</span>}
    </span>
  );
}

const fmtSold = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function Card(props: { p: ProductCard; eager?: boolean }) {
  const p = props.p;
  const imgs = safeJson<string[]>(p.images, []);
  const main = p.thumbnail || imgs[0];
  const alt = imgs.find((i) => i !== main);
  const out = p.total_stock <= 0;
  const isNew = Date.now() - Date.parse(p.created_at) < 14 * 86400000;
  return (
    <div class="group relative" data-card={p.id}>
      <a href={`/product/${p.slug}`} class="block">
        <div class="relative aspect-[3/4] overflow-hidden rounded-xl bg-cream">
          {main && <img src={sized(main, 600, 800)} alt={p.name} loading={props.eager ? 'eager' : 'lazy'} decoding="async" width="600" height="800" class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />}
          {alt && <img src={sized(alt, 600, 800)} alt="" loading="lazy" decoding="async" width="600" height="800" class="absolute inset-0 hidden h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100 md:block" />}
          <div class="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
            {out && <span class="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink">Sold out</span>}
            {!out && p.flash && <span class="flex items-center gap-1 rounded-full bg-sale px-2.5 py-1 text-xs font-semibold text-white">{Icon.bolt(12)}Flash -{p.flash.percent}%</span>}
            {!out && !p.flash && p.regular > p.price && <span class="rounded-full bg-sale px-2.5 py-1 text-xs font-semibold text-white">-{Math.round(((p.regular - p.price) / p.regular) * 100)}%</span>}
            {!out && isNew && <span class="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">New</span>}
          </div>
        </div>
      </a>
      <button type="button" data-wish={p.id} aria-label={`Save ${p.name} to wishlist`} aria-pressed="false"
        class="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm transition hover:scale-105 aria-pressed:text-brand [&[aria-pressed=true]_path]:fill-current">{Icon.heart(18)}</button>
      <div class="pt-3">
        <a href={`/product/${p.slug}`}><h3 class="line-clamp-2 text-[15px] font-medium leading-snug text-ink hover:underline sm:text-base">{p.name}</h3></a>
        <Price price={p.price} regular={p.regular} class="mt-1 text-base font-semibold" />
        <div class="mt-1.5 flex items-center gap-2 text-xs text-muted">
          {p.rating_count > 0 && <span class="flex items-center gap-1"><Stars value={p.rating_avg} size={12} /><span>({p.rating_count})</span></span>}
          {p.sold_count > 0 && <span>{fmtSold(p.sold_count)} sold</span>}
        </div>
        {!out && <button type="button" data-quick={p.slug} class="mt-2.5 hidden w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-sm font-medium transition hover:border-ink md:flex">{Icon.eye(16)} Quick view</button>}
      </div>
    </div>
  );
}

export function Grid(props: { products: ProductCard[]; eager?: number; cols?: string }) {
  return (
    <div class={`grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 ${props.cols || 'md:grid-cols-3 lg:grid-cols-4'}`}>
      {props.products.map((p, i) => <Card p={p} eager={i < (props.eager || 0)} />)}
    </div>
  );
}

export function Rail(props: { products: ProductCard[] }) {
  return (
    <div class="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:gap-5 sm:px-6 lg:mx-0 lg:px-0">
      {props.products.map((p) => <div class="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%]"><Card p={p} /></div>)}
    </div>
  );
}

export function Breadcrumbs(props: { items: [string, string?][] }) {
  return (
    <nav aria-label="Breadcrumb" class="text-sm text-muted">
      <ol class="flex flex-wrap items-center gap-1.5">
        {props.items.map(([label, href], i) => (
          <li class="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {href ? <a href={href} class="hover:text-ink">{label}</a> : <span class="text-ink">{label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Countdown(props: { to: string; class?: string }) {
  return (
    <span data-countdown={props.to} class={`inline-flex items-center gap-1 font-semibold tabular-nums ${props.class || ''}`}>
      {['d', 'h', 'm', 's'].map((u) => <span class="rounded-md bg-ink px-2 py-1 text-sm text-white" data-unit={u}>--</span>)}
    </span>
  );
}
