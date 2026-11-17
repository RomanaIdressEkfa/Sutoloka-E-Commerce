/** @jsxImportSource hono/jsx */
import { raw } from 'hono/html';
import { DISTRICTS, taka, STATUS_LABEL, type OrderStatus } from '../../../shared/bd';
import { sized, type Category, type ProductCard, type Variant } from '../data';
import { Layout, Grid, Rail, Price, Breadcrumbs, Icon, Stars, Countdown, Floral, type Ctx } from './layout';

const json = (v: unknown) => raw(JSON.stringify(v).replace(/</g, '\\u003c'));

export const COLOR_HEX: Record<string, string> = {
  black: '#1b1b1b', white: '#ffffff', 'off-white': '#f4efe6', beige: '#d9c7a7', maroon: '#7a1f2b', olive: '#6b6b2a', navy: '#1f2a4d', mustard: '#d4a017',
  peach: '#f5b895', teal: '#14796f', rose: '#d9718b', 'sky blue': '#7cc3ea', 'bottle green': '#145a32', lavender: '#b9a3d9', rust: '#b5502b',
  red: '#c0392b', blue: '#2e5fa3', green: '#2f8f4e', pink: '#e58fb0', yellow: '#f1c40f', grey: '#8d8d8d', gray: '#8d8d8d', brown: '#7b4f2c', purple: '#6c3b8f', orange: '#e67e22',
};
const swatch = (name: string) => COLOR_HEX[name.toLowerCase()] || '#cfc8cc';

function SectionHead(props: { title: string; sub?: string; href?: string; link?: string; children?: any }) {
  return (
    <div class="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div><h2 class="font-display text-[28px] font-semibold text-[#2d2a26] sm:text-[34px]">{props.title}</h2>{props.sub && <p class="mt-1 text-muted">{props.sub}</p>}</div>
      <div class="flex items-center gap-4">{props.children}{props.href && <a href={props.href} class="text-[15px] font-medium underline-offset-4 hover:underline">{props.link || 'View all'} →</a>}</div>
    </div>
  );
}

// ---------- Home ----------
export function Home(props: { ctx: Ctx; latest: ProductCard[]; best: ProductCard[]; flash: ProductCard[]; flashSale: any; covers: Record<number, string> }) {
  const { settings, categories } = props.ctx;
  const slides = settings.home.hero;
  const tiles = (settings.home.featured_categories || []).map((id) => categories.find((c) => c.id === id)).filter(Boolean) as Category[];
  const tiers = settings.offers.enabled ? settings.offers.tiers : [];
  const top = categories.filter((c) => !c.parent_id && c.slug !== 'accessories').slice(0, 3);
  return (
    <Layout ctx={props.ctx} image={slides[0]?.image}>
      {slides.length > 0 && (() => {
        const s = slides[0];
        const accents = slides.slice(1, 3).map((x) => x.image).filter(Boolean);
        return (
          <section class="relative overflow-hidden bg-sand">
            <Floral class="absolute -left-16 -top-16 w-40 text-sand-line sm:w-52 lg:-left-20 lg:w-64" />
            <Floral flip class="absolute -right-16 top-6 hidden w-72 text-sand-line md:block lg:w-[26rem]" />
            <div class="wrap relative grid items-center gap-10 pb-28 pt-10 sm:pt-14 md:grid-cols-[1.15fr_1fr] md:pb-32 lg:gap-6">
              <div class="max-w-xl">
                <p class="text-sm font-semibold uppercase tracking-[0.22em] text-brand">{settings.store.name_bn || settings.store.name} · New season</p>
                <h1 class="mt-4 font-display text-[40px] font-semibold leading-[1.08] text-[#2d2a26] sm:text-[52px] lg:text-[64px]">{s.title}</h1>
                <p class="mt-5 max-w-md text-base leading-7 text-ink/65 sm:text-lg">{s.subtitle}</p>
                <div class="mt-9 flex flex-wrap items-center gap-4">
                  <a href={s.link} class="btn rounded-full bg-brand px-8 py-3.5 text-base text-white shadow-lg shadow-brand/25 hover:bg-brand-dark">{s.button}</a>
                  <a href="/sale" class="group inline-flex items-center gap-3 text-[15px] font-medium text-ink/80 hover:text-ink">
                    <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand shadow-md transition group-hover:scale-105">{Icon.bolt(18)}</span>Today's offers
                  </a>
                </div>
              </div>
              <div class="relative mx-auto w-full max-w-[420px] md:mr-0">
                <div class="relative mx-auto aspect-[4/5] w-[78%] overflow-hidden rounded-t-[999px] rounded-b-[40px] bg-[#e9573f] shadow-2xl shadow-brand/15 ring-8 ring-white/70">
                  <img src={sized(s.image, 720, 900)} alt="" width="720" height="900" fetchpriority="high" class="h-full w-full object-cover" />
                </div>
                {accents[0] && <img src={sized(accents[0], 240, 300)} alt="" width="240" height="300" class="absolute -left-2 top-6 aspect-[4/5] w-[26%] rounded-full object-cover shadow-xl ring-4 ring-white sm:-left-6" />}
                {accents[1] && <img src={sized(accents[1], 240, 300)} alt="" width="240" height="300" class="absolute -left-4 bottom-4 aspect-[4/5] w-[24%] rounded-full object-cover shadow-xl ring-4 ring-white sm:-left-10" />}
                <svg viewBox="0 0 160 60" class="absolute -left-24 top-1/2 hidden w-32 text-sand-line lg:block" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M155 45 C 120 5 85 5 75 25 C 68 40 95 42 92 25 C 88 8 50 8 12 22" /><path d="M24 12 L 10 22 L 26 30" /></svg>
              </div>
            </div>
            <div class="absolute inset-x-0 bottom-0">
              <div class="wrap">
                <div class="relative -mb-px grid max-w-2xl grid-cols-3 gap-4 rounded-t-3xl bg-white px-6 py-5 sm:px-8">
                  {[['64', 'Districts we deliver to'], ['7-day', 'Easy size exchange'], ['COD', 'Pay on delivery']].map(([n, l]) => (
                    <div><p class="font-display text-2xl font-semibold text-[#2d2a26] sm:text-[32px]">{n}</p><p class="mt-1 text-xs text-muted sm:text-sm">{l}</p></div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {tiers.length > 0 && (
        <section class="border-b border-line bg-brand-soft">
          <div class="wrap flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-3 text-center text-[15px] font-medium text-brand-dark">
            <span class="flex items-center gap-2">{Icon.gift(18)} Buy more, save more:</span>
            {tiers.map((t) => <span>Buy {t.min_qty}+ items — <strong>{t.percent}% off</strong></span>)}
            {settings.delivery.free_over ? <span>Free delivery over <strong>{taka(settings.delivery.free_over)}</strong></span> : null}
          </div>
        </section>
      )}

      {tiles.length > 0 && (
        <section class="wrap mt-12">
          <SectionHead title="Shop by category" href="/shop" link="All products" />
          <div class="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0 lg:grid-cols-9">
            {tiles.map((c) => (
              <a href={`/category/${c.slug}`} class="group w-24 shrink-0 text-center sm:w-auto">
                <div class="mx-auto aspect-square w-full overflow-hidden rounded-full border-2 border-transparent bg-cream transition group-hover:border-brand">
                  {(c.image || props.covers[c.id]) && <img src={sized(c.image || props.covers[c.id], 300, 300)} alt="" loading="lazy" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                </div>
                <p class="mt-2.5 text-sm font-medium sm:text-[15px]">{c.name}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {props.flashSale && props.flash.length > 0 && (
        <section class="wrap mt-14">
          <div class="rounded-2xl bg-gradient-to-br from-[#fff4ec] to-brand-soft p-4 sm:p-6">
            <SectionHead title={props.flashSale.title} href="/sale" link="See all">
              <div class="flex items-center gap-2 text-sm font-medium text-ink/70"><span class="flex items-center gap-1 text-sale">{Icon.bolt(18)} Ends in</span><Countdown to={props.flashSale.ends_at} /></div>
            </SectionHead>
            <Rail products={props.flash} />
          </div>
        </section>
      )}

      <section class="wrap mt-14">
        <SectionHead title="New arrivals" sub="Fresh styles, added this week" href="/shop?sort=new" />
        <Grid products={props.latest} eager={4} />
      </section>

      {top.length > 0 && (
        <section class="wrap mt-16 grid gap-4 sm:grid-cols-3">
          {top.map((c) => (
            <a href={`/category/${c.slug}`} class="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-cream sm:aspect-[3/4]">
              {props.covers[c.id] && <img src={sized(props.covers[c.id], 700, 930)} alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
              <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
              <div class="absolute inset-x-0 bottom-0 p-6 text-white"><p class="text-3xl font-semibold">{c.name}</p><span class="mt-2 inline-block text-[15px] font-medium underline underline-offset-4">Shop now</span></div>
            </a>
          ))}
        </section>
      )}

      <section class="wrap mt-16">
        <SectionHead title="Best sellers" sub="Most loved by our customers" href="/shop?sort=popular" />
        <Rail products={props.best} />
      </section>

      <section class="wrap mt-16">
        <h2 class="mb-5 font-display text-[28px] font-semibold text-[#2d2a26] sm:text-[34px]">Shop by budget</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Under ৳1,000', '/shop?max=999'], ['৳1,000 – ৳2,000', '/shop?min=1000&max=2000'], ['৳2,000 – ৳5,000', '/shop?min=2000&max=5000'], ['Premium ৳5,000+', '/shop?min=5000']].map(([l, h]) => (
            <a href={h} class="rounded-xl border border-line bg-white px-4 py-6 text-center text-base font-semibold transition hover:border-brand hover:text-brand">{l}</a>
          ))}
        </div>
      </section>

      <section class="wrap mt-16 hidden" data-recent-wrap>
        <SectionHead title="Recently viewed" />
        <div data-recent></div>
      </section>
    </Layout>
  );
}

// ---------- Listing (category / shop / search / sale) ----------
type ListingProps = {
  ctx: Ctx; title: string; description?: string; category?: Category; parent?: Category; children?: Category[];
  products: ProductCard[]; total: number; page: number; pages: number; facets: { sizes: string[]; colors: string[]; lo: number; hi: number };
  query: Record<string, string | string[]>; basePath: string;
};

function Filters(props: { f: ListingProps['facets']; q: ListingProps['query']; idp: string }) {
  const sel = (k: string) => ([] as string[]).concat((props.q[k] as any) || []);
  const one = (k: string) => String(props.q[k] || '');
  return (
    <div class="space-y-6">
      {props.f.sizes.length > 0 && (
        <fieldset>
          <legend class="mb-3 text-[15px] font-semibold">Size</legend>
          <div class="flex flex-wrap gap-2">
            {props.f.sizes.map((s) => (
              <label class="cursor-pointer"><input type="checkbox" name="size" value={s} checked={sel('size').includes(s)} class="peer sr-only" /><span class="opt block peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2">{s}</span></label>
            ))}
          </div>
        </fieldset>
      )}
      {props.f.colors.length > 0 && (
        <fieldset>
          <legend class="mb-3 text-[15px] font-semibold">Colour</legend>
          <div class="grid grid-cols-2 gap-x-3 gap-y-2">
            {props.f.colors.map((c) => (
              <label class="flex cursor-pointer items-center gap-2 text-[15px]">
                <input type="checkbox" name="color" value={c} checked={sel('color').includes(c)} class="h-4 w-4 accent-ink" />
                <span class="h-4 w-4 shrink-0 rounded-full border border-black/10" style={`background:${swatch(c)}`}></span>{c}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend class="mb-3 text-[15px] font-semibold">Price (৳)</legend>
        <div class="flex items-center gap-2">
          <input type="number" name="min" inputmode="numeric" min="0" placeholder={String(props.f.lo || 0)} value={one('min')} class="field py-2" aria-label="Minimum price" />
          <span class="text-muted">–</span>
          <input type="number" name="max" inputmode="numeric" min="0" placeholder={String(props.f.hi || '')} value={one('max')} class="field py-2" aria-label="Maximum price" />
        </div>
      </fieldset>
      <fieldset class="space-y-2.5">
        <legend class="mb-3 text-[15px] font-semibold">More filters</legend>
        <label class="flex cursor-pointer items-center gap-2 text-[15px]"><input type="checkbox" name="rating" value="4" checked={one('rating') === '4'} class="h-4 w-4 accent-ink" /><Stars value={4} size={14} /> &amp; up</label>
        <label class="flex cursor-pointer items-center gap-2 text-[15px]"><input type="checkbox" name="stock" value="1" checked={one('stock') === '1'} class="h-4 w-4 accent-ink" />In stock only</label>
        <label class="flex cursor-pointer items-center gap-2 text-[15px]"><input type="checkbox" name="sale" value="1" checked={one('sale') === '1'} class="h-4 w-4 accent-ink" />On sale</label>
      </fieldset>
    </div>
  );
}

export function Listing(props: ListingProps) {
  const q = props.query;
  const link = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...q, ...patch })) for (const x of ([] as (string | undefined)[]).concat(v as any)) if (x) u.append(k, x);
    const s = u.toString();
    return props.basePath + (s ? `?${s}` : '');
  };
  const removeLink = (k: string | string[], v?: string) => {
    const keys = ([] as string[]).concat(k);
    const u = new URLSearchParams();
    for (const [kk, vv] of Object.entries(q)) for (const x of ([] as string[]).concat(vv as any)) if (x && kk !== 'page' && !(keys.includes(kk) && (v === undefined || x === v))) u.append(kk, x);
    const s = u.toString();
    return props.basePath + (s ? `?${s}` : '');
  };
  const chips: [string, string][] = [];
  for (const s of ([] as string[]).concat((q.size as any) || [])) chips.push([`Size ${s}`, removeLink('size', s)]);
  for (const c of ([] as string[]).concat((q.color as any) || [])) chips.push([c, removeLink('color', c)]);
  if (q.min || q.max) chips.push([`${q.min ? taka(Number(q.min)) : '৳0'} – ${q.max ? taka(Number(q.max)) : 'any'}`, removeLink(['min', 'max'])]);
  if (q.rating) chips.push(['4★ & up', removeLink('rating')]);
  if (q.stock) chips.push(['In stock', removeLink('stock')]);
  if (q.sale && props.basePath !== '/sale') chips.push(['On sale', removeLink('sale')]);
  const hidden = <>{q.q !== undefined && <input type="hidden" name="q" value={String(q.q)} />}{q.sort && <input type="hidden" name="sort" value={String(q.sort)} />}</>;
  return (
    <Layout ctx={props.ctx} title={props.title} description={props.description}>
      <section class="wrap pt-6">
        <Breadcrumbs items={[['Home', '/'], ...(props.parent ? [[props.parent.name, `/category/${props.parent.slug}`] as [string, string]] : []), [props.title]]} />
        <div class="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div><h1 class="text-3xl sm:text-4xl">{props.title}</h1><p class="mt-1 text-muted">{props.total} {props.total === 1 ? 'product' : 'products'}</p></div>
        </div>
        {props.children && props.children.length > 0 && (
          <div class="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <a href={`/category/${(props.parent || props.category)!.slug}`} class={`chip shrink-0 ${!props.parent ? 'chip-on' : ''}`}>All</a>
            {props.children.map((c) => <a href={`/category/${c.slug}`} class={`chip shrink-0 ${props.category?.id === c.id ? 'chip-on' : ''}`}>{c.name}</a>)}
          </div>
        )}
      </section>

      <section class="wrap mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
        <aside class="hidden lg:block">
          <form method="get" action={props.basePath} data-filter-form class="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            {hidden}
            <Filters f={props.facets} q={q} idp="d" />
            <button class="btn-dark mt-6 w-full">Apply filters</button>
            {chips.length > 0 && <a href={props.basePath + (q.q ? `?q=${encodeURIComponent(String(q.q))}` : '')} class="mt-3 block text-center text-sm font-medium underline">Clear all</a>}
          </form>
        </aside>

        <div>
          <div class="flex items-center justify-between gap-3 border-y border-line py-3 lg:border-t-0 lg:pt-0">
            <button type="button" data-open="filters" class="btn-line py-2 lg:hidden">{Icon.filter(18)} Filters{chips.length ? ` (${chips.length})` : ''}</button>
            <div class="hidden flex-wrap gap-2 lg:flex">
              {chips.map(([l, h]) => <a href={h} class="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-sm font-medium hover:bg-line">{l}<span aria-hidden="true">×</span><span class="sr-only">Remove filter</span></a>)}
            </div>
            <form method="get" action={props.basePath} class="ml-auto">
              {Object.entries(q).filter(([k]) => k !== 'sort' && k !== 'page').flatMap(([k, v]) => ([] as string[]).concat(v as any).map((x) => <input type="hidden" name={k} value={x} />))}
              <label class="flex items-center gap-2 text-[15px]">
                <span class="hidden text-muted sm:inline">Sort by</span>
                <select name="sort" class="rounded-lg border border-line bg-white px-3 py-2 text-[15px]" onchange="this.form.submit()" aria-label="Sort products">
                  {[['new', 'Newest'], ['popular', 'Best selling'], ['rating', 'Top rated'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low']].map(([v, l]) => <option value={v} selected={(q.sort || 'new') === v}>{l}</option>)}
                </select>
              </label>
            </form>
          </div>

          <div class="mt-6">
            {props.products.length ? <Grid products={props.products} eager={4} cols="md:grid-cols-3 xl:grid-cols-4" /> : (
              <div class="rounded-2xl bg-cream py-16 text-center">
                <p class="text-lg font-medium">No products match these filters</p>
                <p class="mt-1 text-muted">Try removing a filter or searching for something else.</p>
                <a href={props.basePath} class="btn-dark mt-6">Clear filters</a>
              </div>
            )}
            {props.pages > 1 && (
              <nav class="mt-12 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                {props.page > 1 && <a class="chip" href={link({ page: String(props.page - 1) })}>← Previous</a>}
                {pageList(props.page, props.pages).map((n) => n === 0 ? <span class="px-2 text-muted">…</span>
                  : <a class={`chip min-w-11 justify-center ${n === props.page ? 'chip-on' : ''}`} href={link({ page: n === 1 ? undefined : String(n) })} aria-current={n === props.page ? 'page' : undefined}>{n}</a>)}
                {props.page < props.pages && <a class="chip" href={link({ page: String(props.page + 1) })}>Next →</a>}
              </nav>
            )}
          </div>
        </div>
      </section>

      <div data-panel="filters" class="fixed inset-0 z-50 hidden" role="dialog" aria-modal="true" aria-label="Filters">
        <div class="absolute inset-0 bg-black/40" data-close=""></div>
        <form method="get" action={props.basePath} class="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-white">
          <div class="flex h-16 items-center justify-between border-b border-line px-5"><h2 class="text-lg">Filters</h2><button type="button" class="p-2" data-close="" aria-label="Close filters">{Icon.close()}</button></div>
          <div class="flex-1 overflow-y-auto p-5">{hidden}<Filters f={props.facets} q={q} idp="m" /></div>
          <div class="grid grid-cols-2 gap-3 border-t border-line p-4">
            <a href={props.basePath} class="btn-line">Clear</a>
            <button class="btn-dark">Show results</button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

function pageList(cur: number, total: number) {
  const s = new Set([1, total, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= total));
  const arr = [...s].sort((a, b) => a - b);
  const out: number[] = [];
  arr.forEach((n, i) => { if (i && n - arr[i - 1] > 1) out.push(0); out.push(n); });
  return out;
}

export function SearchPage(props: { ctx: Ctx; popular: Category[] }) {
  return (
    <Layout ctx={props.ctx} title="Search">
      <section class="wrap max-w-2xl py-10">
        <h1 class="text-3xl">Search</h1>
        <form action="/search" class="relative mt-6" data-suggest-form>
          <input name="q" type="search" autofocus autocomplete="off" placeholder="Saree, panjabi, kurti, kids dress…" class="field h-14 pl-12 text-base" data-suggest-input aria-label="Search products" />
          <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{Icon.search(20)}</span>
          <div data-suggest-box class="absolute inset-x-0 top-full z-50 mt-2 hidden overflow-hidden rounded-xl border border-line bg-white shadow-xl"></div>
        </form>
        <h2 class="mt-10 text-lg">Popular categories</h2>
        <div class="mt-3 flex flex-wrap gap-2">{props.popular.map((c) => <a class="chip" href={`/category/${c.slug}`}>{c.name}</a>)}</div>
      </section>
    </Layout>
  );
}

// ---------- Product ----------
export function ProductPage(props: { ctx: Ctx; p: any; related: ProductCard[]; reviews: { rows: any[]; dist: Record<number, number>; fit: Record<string, number> } }) {
  const p = props.p;
  const variants: Variant[] = p.variants;
  const gallery = [...new Set([p.thumbnail, ...variants.flatMap((v) => v.images)].filter(Boolean))] as string[];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const first = variants.find((v) => v.stock > 0) || variants[0];
  const sizeChart = p.size_chart || p.parent_size_chart;
  const { settings } = props.ctx;
  const delivery = settings.delivery;
  const inStock = variants.some((v) => v.stock > 0);
  const totalReviews = Object.values(props.reviews.dist).reduce((a, b) => a + b, 0);
  const fitTotal = Object.values(props.reviews.fit).reduce((a, b) => a + b, 0);
  const url = `${props.ctx.siteUrl}/product/${p.slug}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: gallery.slice(0, 5), description: p.description, sku: first?.sku,
    brand: { '@type': 'Brand', name: settings.store.name },
    ...(p.rating_count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating_avg, reviewCount: p.rating_count } } : {}),
    offers: { '@type': 'AggregateOffer', priceCurrency: 'BDT', lowPrice: Math.min(...variants.map((v) => v.sale_price)), highPrice: Math.max(...variants.map((v) => v.sale_price)), availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  };
  return (
    <Layout ctx={props.ctx} title={p.seo_title || p.name} description={(p.description || '').slice(0, 160)} image={gallery[0]}>
      <script type="application/ld+json">{json(ld)}</script>
      <div class="wrap pt-5"><Breadcrumbs items={[['Home', '/'], ...(p.parent_slug ? [[p.parent_name, `/category/${p.parent_slug}`] as [string, string]] : []), ...(p.category_slug ? [[p.category_name, `/category/${p.category_slug}`] as [string, string]] : []), [p.name]]} /></div>
      <section class="wrap mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
        <div class="lg:sticky lg:top-24 lg:self-start">
          <div class="flex flex-col-reverse gap-3 sm:flex-row">
            <div class="no-scrollbar hidden gap-3 sm:flex sm:max-h-[680px] sm:w-20 sm:flex-col sm:overflow-y-auto">
              {gallery.map((src, i) => (
                <button type="button" data-thumb={i} aria-label={`Show image ${i + 1}`} class={`aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg border-2 ${i === 0 ? 'border-ink' : 'border-transparent'}`}>
                  <img src={sized(src, 160, 214)} alt="" loading={i < 5 ? "eager" : "lazy"} class="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <div class="relative flex-1">
              <div data-gallery class="no-scrollbar flex aspect-[3/4] snap-x snap-mandatory overflow-x-auto rounded-2xl bg-cream">
                {gallery.map((src, i) => <img src={sized(src, 1000, 1333)} alt={i === 0 ? p.name : ''} width="1000" height="1333" loading={i === 0 ? 'eager' : 'lazy'} fetchpriority={i === 0 ? 'high' : 'auto'} class="h-full w-full shrink-0 snap-center object-cover" />)}
              </div>
              <span data-gallery-count class="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white sm:hidden">1 / {gallery.length}</span>
              <button type="button" data-wish={p.id} aria-pressed="false" aria-label="Save to wishlist" class="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-sm aria-pressed:text-brand [&[aria-pressed=true]_path]:fill-current">{Icon.heart(20)}</button>
            </div>
          </div>
        </div>

        <div>
          {p.category_name && <a href={`/category/${p.category_slug}`} class="text-sm font-semibold uppercase tracking-wider text-brand">{p.category_name}</a>}
          <h1 class="mt-2 text-[28px] leading-tight sm:text-4xl">{p.name}</h1>
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-muted">
            {p.rating_count > 0 && <a href="#reviews" class="flex items-center gap-1.5 hover:text-ink"><Stars value={p.rating_avg} size={16} /><span class="font-medium text-ink">{Number(p.rating_avg).toFixed(1)}</span>({p.rating_count} reviews)</a>}
            {p.sold_count > 0 && <span>{p.sold_count} sold</span>}
          </div>

          {p.flash && (
            <div class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-sale to-brand px-4 py-3 text-white">
              <span class="flex items-center gap-2 font-semibold">{Icon.bolt(18)} {p.flash.title} · {p.flash.percent}% off</span>
              <span class="flex items-center gap-2 text-sm">Ends in <Countdown to={p.flash.ends_at} class="[&_span]:bg-white/20" /></span>
            </div>
          )}
          <div class="mt-5 text-[26px] font-semibold" data-price><Price price={first?.sale_price ?? 0} regular={first?.price} /></div>
          <p class="mt-1 text-sm text-muted">Inclusive of VAT · SKU <span data-sku>{first?.sku}</span></p>
          {settings.offers.enabled && settings.offers.tiers.length > 0 && (
            <p class="mt-4 flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-[15px] text-brand-dark">{Icon.gift(18)}<span>{settings.offers.tiers.map((t) => `Buy ${t.min_qty}+ get ${t.percent}% off`).join(' · ')}</span></p>
          )}

          <form data-buy class="mt-7 space-y-6">
            {colors.length > 0 && (
              <fieldset>
                <legend class="mb-2.5 text-[15px] font-medium">Colour: <span data-color-label class="font-normal text-muted">{first?.color}</span></legend>
                <div class="flex flex-wrap gap-2">{colors.map((c) => (
                  <button type="button" class="opt flex items-center gap-2" data-color={c} aria-pressed={c === first?.color ? 'true' : 'false'}><span class="h-4 w-4 rounded-full border border-black/10" style={`background:${swatch(c)}`}></span>{c}</button>
                ))}</div>
              </fieldset>
            )}
            {sizes.length > 0 && (
              <fieldset>
                <div class="mb-2.5 flex items-center justify-between">
                  <legend class="text-[15px] font-medium">Size: <span data-size-label class="font-normal text-muted">{first?.size}</span></legend>
                  {sizeChart && <button type="button" data-open="sizechart" class="text-sm font-medium underline underline-offset-4">Size guide</button>}
                </div>
                <div class="flex flex-wrap gap-2">{sizes.map((s) => <button type="button" class="opt" data-size={s} aria-pressed={s === first?.size ? 'true' : 'false'}>{s}</button>)}</div>
                {fitTotal >= 3 && <p class="mt-2.5 text-sm text-muted">Fit: {Math.round(((props.reviews.fit.true || 0) / fitTotal) * 100)}% of buyers say it fits true to size</p>}
              </fieldset>
            )}
            <p data-stock class="text-[15px] font-medium"></p>
            <div data-buy-row class="flex flex-wrap gap-3">
              <div class="flex h-[50px] items-center rounded-lg border border-line">
                <button type="button" data-qty="-1" class="h-full px-4 text-lg" aria-label="Decrease quantity">−</button>
                <input data-qty-input type="number" min="1" max="20" value="1" class="h-full w-12 border-0 text-center [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" aria-label="Quantity" />
                <button type="button" data-qty="1" class="h-full px-4 text-lg" aria-label="Increase quantity">+</button>
              </div>
              <button type="submit" data-add class="btn-line min-w-40 flex-1">Add to cart</button>
              <button type="button" data-buynow class="btn-dark min-w-40 flex-1">Buy now</button>
            </div>
            <div data-notify class="hidden rounded-xl border border-line p-4">
              <p class="flex items-center gap-2 font-medium">{Icon.bell()} Get an SMS when it's back in stock</p>
              <div class="mt-3 flex gap-2">
                <input type="tel" inputmode="numeric" name="notify_phone" placeholder="01XXXXXXXXX" class="field py-2.5" aria-label="Mobile number" />
                <button type="button" data-notify-btn class="btn-dark py-2.5">Notify me</button>
              </div>
            </div>
          </form>

          <div class="mt-5 flex flex-wrap gap-4 text-sm font-medium">
            <a href={`https://wa.me/?text=${encodeURIComponent(`${p.name} ${url}`)}`} target="_blank" rel="noopener" class="underline-offset-4 hover:underline">Share on WhatsApp</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener" class="underline-offset-4 hover:underline">Share on Facebook</a>
            <button type="button" data-copy={url} class="underline-offset-4 hover:underline">Copy link</button>
          </div>

          <div class="mt-7 grid gap-3 rounded-xl bg-cream p-5 text-[15px] sm:grid-cols-2">
            <p class="flex items-center gap-2"><span class="text-brand">{Icon.truck(22)}</span>Dhaka {taka(delivery.inside_dhaka)} · {delivery.inside_days || '1–2 days'}</p>
            <p class="flex items-center gap-2"><span class="text-brand">{Icon.truck(22)}</span>Outside {taka(delivery.outside_dhaka)} · {delivery.outside_days || '2–4 days'}</p>
            <p class="flex items-center gap-2"><span class="text-brand">{Icon.cash(22)}</span>Cash on delivery</p>
            <p class="flex items-center gap-2"><span class="text-brand">{Icon.swap(22)}</span>7-day easy exchange</p>
          </div>

          <div class="mt-6 divide-y divide-line border-y border-line">
            {p.description && (
              <details open class="group py-4">
                <summary class="flex cursor-pointer list-none items-center justify-between text-base font-semibold">Description<span class="transition group-open:rotate-45">+</span></summary>
                <div class="mt-3 space-y-3 text-[15px] leading-7 text-ink/80">{String(p.description).split(/\n{2,}/).map((para: string) => <p>{para}</p>)}</div>
              </details>
            )}
            <details class="group py-4">
              <summary class="flex cursor-pointer list-none items-center justify-between text-base font-semibold">Delivery &amp; exchange<span class="transition group-open:rotate-45">+</span></summary>
              <ul class="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-ink/80">
                <li>We call to confirm your order before shipping.</li>
                <li>Inside Dhaka {delivery.inside_days || '1–2 days'}, outside Dhaka {delivery.outside_days || '2–4 days'}.</li>
                {delivery.free_over ? <li>Free delivery on orders over {taka(delivery.free_over)}.</li> : null}
                <li>Exchange size or colour within 7 days. <a class="underline" href="/pages/return-and-exchange">Read the policy</a></li>
              </ul>
            </details>
          </div>
        </div>
      </section>

      {sizeChart && (
        <div data-panel="sizechart" class="fixed inset-0 z-50 hidden items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Size guide">
          <div class="absolute inset-0 bg-black/50" data-close=""></div>
          <div class="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-4">
            <div class="mb-3 flex items-center justify-between"><h2 class="text-lg">Size guide</h2><button class="p-2" data-close="" aria-label="Close">{Icon.close()}</button></div>
            <img src={sizeChart} alt="Size chart" class="w-full" />
          </div>
        </div>
      )}

      <section id="reviews" class="wrap mt-16 scroll-mt-24">
        <h2 class="text-2xl sm:text-[28px]">Customer reviews</h2>
        <div class="mt-6 grid gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            <div class="flex items-center gap-4">
              <p class="text-5xl font-semibold">{totalReviews ? Number(p.rating_avg).toFixed(1) : '–'}</p>
              <div><Stars value={p.rating_avg || 0} size={18} /><p class="mt-1 text-sm text-muted">{totalReviews} reviews</p></div>
            </div>
            <div class="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((r) => {
                const n = props.reviews.dist[r] || 0;
                return <div class="flex items-center gap-3 text-sm"><span class="w-8">{r} ★</span><div class="h-2 flex-1 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-star" style={`width:${totalReviews ? (n / totalReviews) * 100 : 0}%`}></div></div><span class="w-8 text-right text-muted">{n}</span></div>;
              })}
            </div>
            <button type="button" data-open="review" class="btn-line mt-6 w-full">Write a review</button>
          </div>
          <div class="divide-y divide-line">
            {props.reviews.rows.length === 0 && <p class="py-6 text-muted">No reviews yet. Be the first to share your thoughts.</p>}
            {props.reviews.rows.map((r) => (
              <article class="py-5 first:pt-0">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} size={15} />
                  {r.title && <h3 class="text-[15px] font-semibold">{r.title}</h3>}
                </div>
                <p class="mt-1.5 text-sm text-muted">{r.name}{r.verified ? <span class="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">✓ Verified buyer</span> : null}{r.size_bought ? ` · Size ${r.size_bought}` : ''} · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <p class="mt-2 text-[15px] leading-7 text-ink/85">{r.body}</p>
                {r.photos.length > 0 && <div class="mt-3 flex gap-2">{r.photos.map((ph: string) => <a href={ph} target="_blank" rel="noopener"><img src={ph} alt="Customer photo" loading="lazy" class="h-20 w-20 rounded-lg object-cover" /></a>)}</div>}
                {r.reply && <p class="mt-3 rounded-lg bg-cream p-3 text-sm"><strong>{settings.store.name} replied:</strong> {r.reply}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <div data-panel="review" class="fixed inset-0 z-50 hidden items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Write a review">
        <div class="absolute inset-0 bg-black/50" data-close=""></div>
        <form data-review-form class="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl" enctype="multipart/form-data">
          <div class="mb-4 flex items-center justify-between"><h2 class="text-xl">Review {p.name}</h2><button type="button" class="p-2" data-close="" aria-label="Close">{Icon.close()}</button></div>
          {props.ctx.customer ? (
            <div class="space-y-4">
              <input type="hidden" name="product_id" value={String(p.id)} />
              <fieldset><legend class="label">Your rating *</legend>
                <div class="flex flex-row-reverse justify-end gap-1 text-3xl">{[5, 4, 3, 2, 1].map((n) => <><input type="radio" name="rating" value={String(n)} id={`rt${n}`} class="peer sr-only" required /><label for={`rt${n}`} class="cursor-pointer text-line peer-checked:text-star hover:text-star [&:hover~label]:text-star peer-checked:[&~label]:text-star">★</label></>)}</div>
              </fieldset>
              <div><label class="label" for="rv-title">Title</label><input id="rv-title" name="title" class="field" maxlength={80} placeholder="Sum it up in a few words" /></div>
              <div><label class="label" for="rv-body">Your review *</label><textarea id="rv-body" name="body" rows={4} class="field" required minlength={10} maxlength={1000} placeholder="Fabric, fit, colour, delivery…"></textarea></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="label" for="rv-size">Size bought</label><select id="rv-size" name="size_bought" class="field"><option value="">—</option>{sizes.map((s) => <option>{s}</option>)}</select></div>
                <div><label class="label" for="rv-fit">How did it fit?</label><select id="rv-fit" name="fit" class="field"><option value="">—</option><option value="small">Runs small</option><option value="true">True to size</option><option value="large">Runs large</option></select></div>
              </div>
              <div><label class="label" for="rv-photos">Photos (up to 3)</label><input id="rv-photos" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple class="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cream file:px-4 file:py-2 file:font-medium" /></div>
              <p data-review-msg class="hidden rounded-lg p-3 text-[15px]" role="status"></p>
              <button class="btn-dark w-full">Submit review</button>
            </div>
          ) : (
            <div class="py-4 text-center"><p class="text-[15px] text-muted">Please sign in with your mobile number to write a review.</p><a href={`/account/login?next=${encodeURIComponent(`/product/${p.slug}#reviews`)}`} class="btn-dark mt-5">Sign in</a></div>
          )}
        </form>
      </div>

      {props.related.length > 0 && (
        <section class="wrap mt-16">
          <SectionHead title="You may also like" />
          <Rail products={props.related} />
        </section>
      )}
      <section class="wrap mt-16 hidden" data-recent-wrap><SectionHead title="Recently viewed" /><div data-recent></div></section>
      <script>{raw(`window.__PRODUCT__=${JSON.stringify({ id: p.id, name: p.name, slug: p.slug, variants, gallery }).replace(/</g, '\\u003c')};`)}</script>
    </Layout>
  );
}

/** Body of the quick-view modal (rendered as an HTML fragment). */
export function QuickView(props: { p: any }) {
  const p = props.p;
  const variants: Variant[] = p.variants;
  const gallery = [...new Set([p.thumbnail, ...variants.flatMap((v) => v.images)].filter(Boolean))] as string[];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const first = variants.find((v) => v.stock > 0) || variants[0];
  return (
    <div class="grid gap-6 p-5 sm:grid-cols-2 sm:p-6" data-quick-product={JSON.stringify({ id: p.id, slug: p.slug, variants })}>
      <div class="no-scrollbar flex aspect-[3/4] snap-x snap-mandatory overflow-x-auto rounded-xl bg-cream">{gallery.map((g) => <img src={sized(g, 700, 933)} alt="" class="h-full w-full shrink-0 snap-center object-cover" />)}</div>
      <form data-buy-quick class="space-y-5">
        <div>
          <h2 class="pr-10 text-2xl leading-tight">{p.name}</h2>
          {p.rating_count > 0 && <p class="mt-2 flex items-center gap-1.5 text-sm text-muted"><Stars value={p.rating_avg} />({p.rating_count})</p>}
          <div class="mt-3 text-2xl font-semibold" data-price><Price price={first?.sale_price ?? 0} regular={first?.price} /></div>
        </div>
        {colors.length > 0 && <fieldset><legend class="mb-2 text-[15px] font-medium">Colour</legend><div class="flex flex-wrap gap-2">{colors.map((c) => <button type="button" class="opt" data-color={c} aria-pressed={c === first?.color ? 'true' : 'false'}>{c}</button>)}</div></fieldset>}
        {sizes.length > 0 && <fieldset><legend class="mb-2 text-[15px] font-medium">Size</legend><div class="flex flex-wrap gap-2">{sizes.map((s) => <button type="button" class="opt" data-size={s} aria-pressed={s === first?.size ? 'true' : 'false'}>{s}</button>)}</div></fieldset>}
        <p data-stock class="text-[15px] font-medium"></p>
        <button type="submit" data-add class="btn-dark w-full">Add to cart</button>
        <a href={`/product/${p.slug}`} class="block text-center text-[15px] font-medium underline underline-offset-4">View full details</a>
      </form>
    </div>
  );
}

// ---------- Cart & checkout ----------
export function CartPage(props: { ctx: Ctx }) {
  return (
    <Layout ctx={props.ctx} title="Cart" noindex>
      <section class="wrap py-10">
        <h1 class="text-3xl">Your cart</h1>
        <div class="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <div data-progress class="mb-4"></div>
            <div data-cart-page class="divide-y divide-line border-y border-line"><p class="py-10 text-muted">Loading…</p></div>
          </div>
          <aside class="h-fit rounded-2xl bg-cream p-6">
            <h2 class="text-lg">Order summary</h2>
            <div class="mt-4 flex justify-between text-base"><span>Subtotal</span><strong data-cart-subtotal>৳0</strong></div>
            <p class="mt-1 text-sm text-muted">Offers, coupons and delivery are calculated at checkout.</p>
            <a href="/checkout" data-checkout-link class="btn-dark mt-6 w-full">Proceed to checkout</a>
            <a href="/shop" class="mt-3 block text-center text-[15px] font-medium underline-offset-4 hover:underline">Continue shopping</a>
          </aside>
        </div>
      </section>
    </Layout>
  );
}

export function CheckoutPage(props: { ctx: Ctx; addresses: any[] }) {
  const d = props.ctx.settings.delivery;
  const cu = props.ctx.customer;
  const def = props.addresses.find((a) => a.is_default) || props.addresses[0];
  return (
    <Layout ctx={props.ctx} title="Checkout" noindex>
      <section class="wrap py-10">
        <h1 class="text-3xl">Checkout</h1>
        <p class="mt-1 text-muted">Cash on delivery — pay when you receive your parcel.{!cu && <> <a href="/account/login?next=/checkout" class="font-medium text-brand underline">Sign in</a> to use saved addresses and reward points.</>}</p>
        <form data-checkout novalidate class="mt-8 grid gap-10 lg:grid-cols-[1fr_420px]">
          <div class="space-y-5">
            {props.addresses.length > 0 && (
              <fieldset>
                <legend class="mb-3 text-lg font-semibold">Saved addresses</legend>
                <div class="grid gap-3 sm:grid-cols-2">
                  {props.addresses.map((a) => (
                    <label class="flex cursor-pointer gap-3 rounded-xl border border-line p-4 has-[:checked]:border-ink">
                      <input type="radio" name="saved_address" value={String(a.id)} checked={a === def} data-address={JSON.stringify(a)} class="mt-1 accent-ink" />
                      <span class="text-[15px]"><strong>{a.label}</strong> · {a.name}<span class="block text-sm text-muted">{a.address}{a.area ? `, ${a.area}` : ''}, {a.district} · {a.phone}</span></span>
                    </label>
                  ))}
                  <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line p-4 has-[:checked]:border-ink"><input type="radio" name="saved_address" value="new" class="accent-ink" /><span class="text-[15px] font-medium">+ Use a new address</span></label>
                </div>
              </fieldset>
            )}
            <h2 class="text-lg">Delivery details</h2>
            <div class="grid gap-5 sm:grid-cols-2">
              <div><label class="label" for="name">Full name *</label><input class="field" id="name" name="name" autocomplete="name" required value={def?.name || cu?.name || ''} /></div>
              <div><label class="label" for="phone">Mobile number *</label><input class="field" id="phone" name="phone" type="tel" inputmode="numeric" placeholder="01XXXXXXXXX" autocomplete="tel" required value={def?.phone || cu?.phone || ''} /></div>
            </div>
            <div class="grid gap-5 sm:grid-cols-2">
              <div>
                <label class="label" for="district">District *</label>
                <select class="field" id="district" name="district" required>
                  <option value="">Select district</option>
                  {DISTRICTS.map((x) => <option value={x} selected={(def?.district || cu?.district) === x}>{x}</option>)}
                </select>
              </div>
              <div><label class="label" for="area">Area / Thana</label><input class="field" id="area" name="area" placeholder="e.g. Mirpur 10" value={def?.area || ''} /></div>
            </div>
            <fieldset data-zone-box class="hidden">
              <legend class="label">Delivery area *</legend>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-4 has-[:checked]:border-ink"><input type="radio" name="zone" value="inside_dhaka" checked={def?.zone !== 'sub_dhaka'} class="accent-ink" /><span>Inside Dhaka city <span class="block text-sm text-muted">{taka(d.inside_dhaka)}</span></span></label>
                <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-4 has-[:checked]:border-ink"><input type="radio" name="zone" value="sub_dhaka" checked={def?.zone === 'sub_dhaka'} class="accent-ink" /><span>Savar, Keraniganj, Dhamrai… <span class="block text-sm text-muted">{taka(d.sub_dhaka)}</span></span></label>
              </div>
            </fieldset>
            <div><label class="label" for="address">Full address *</label><textarea class="field" id="address" name="address" rows={3} placeholder="House, road, area" required>{def?.address || cu?.address || ''}</textarea></div>
            <div><label class="label" for="email">Email (optional)</label><input class="field" id="email" name="email" type="email" autocomplete="email" value={cu?.email || ''} /></div>
            <div><label class="label" for="note">Order note (optional)</label><textarea class="field" id="note" name="note" rows={2} placeholder="Delivery time, landmark…"></textarea></div>
            {cu && <label class="flex items-center gap-2 text-[15px]"><input type="checkbox" name="save_address" value="1" checked={!props.addresses.length} class="h-4 w-4 accent-ink" />Save this address to my account</label>}
            <input type="text" name="website" tabindex={-1} autocomplete="off" class="hidden" aria-hidden="true" />
          </div>

          <aside class="h-fit rounded-2xl bg-cream p-6 lg:sticky lg:top-24">
            <h2 class="text-lg">Your order</h2>
            <div data-summary-lines class="mt-4 max-h-80 space-y-4 overflow-y-auto"></div>
            <div data-progress class="mt-4"></div>
            <div class="mt-4 flex gap-2">
              <input name="coupon" placeholder="Coupon code" class="field bg-white py-2.5 uppercase" aria-label="Coupon code" />
              <button type="button" data-apply-coupon class="btn-line py-2.5">Apply</button>
            </div>
            <p data-coupon-msg class="mt-2 text-sm"></p>
            {cu && <label data-points-box class="mt-3 hidden items-center gap-2 rounded-lg border border-line bg-white p-3 text-[15px]"><input type="checkbox" name="use_points" value="1" class="h-4 w-4 accent-ink" /><span data-points-label></span></label>}
            <dl class="mt-5 space-y-2.5 border-t border-line pt-5 text-[15px]">
              <div class="flex justify-between"><dt>Subtotal</dt><dd data-q="subtotal">৳0</dd></div>
              <div data-row="offer" class="hidden justify-between text-emerald-700"><dt data-offer-label>Bundle offer</dt><dd data-q="offerDiscount"></dd></div>
              <div data-row="coupon" class="hidden justify-between text-emerald-700"><dt>Coupon</dt><dd data-q="couponDiscount"></dd></div>
              <div data-row="points" class="hidden justify-between text-emerald-700"><dt>Reward points</dt><dd data-q="pointsDiscount"></dd></div>
              <div class="flex justify-between"><dt>Delivery</dt><dd data-q="deliveryFee">—</dd></div>
              <div class="flex justify-between border-t border-line pt-3 text-lg font-semibold"><dt>Total</dt><dd data-q="total">৳0</dd></div>
            </dl>
            <div class="mt-5 rounded-lg border border-line bg-white p-4 text-[15px]">
              <label class="flex items-center gap-3"><input type="radio" checked class="accent-ink" /> <span><strong>Cash on delivery</strong><span class="block text-sm text-muted">Pay in cash when the parcel arrives</span></span></label>
            </div>
            <p data-error class="mt-4 hidden rounded-lg bg-red-50 p-3 text-[15px] text-red-700" role="alert"></p>
            <button type="submit" data-place class="btn-dark mt-5 w-full py-4 text-base">Place order</button>
            <p class="mt-3 text-center text-sm text-muted">By placing your order you agree to our <a class="underline" href="/pages/terms-and-conditions">terms</a>.</p>
          </aside>
        </form>
      </section>
    </Layout>
  );
}

// ---------- Order confirmation / tracking ----------
const STEPS: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export function OrderSummary(props: { order: any; items: any[]; name: string }) {
  const o = props.order;
  const stepIdx = STEPS.indexOf(o.status);
  return (
    <>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div><p class="text-sm text-muted">Order number</p><p class="text-2xl font-semibold">{o.order_no}</p><p class="text-sm text-muted">{new Date(o.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' })}</p></div>
        <span class={`rounded-full px-4 py-1.5 text-sm font-semibold ${o.status === 'cancelled' || o.status === 'returned' ? 'bg-red-50 text-red-700' : 'bg-cream text-ink'}`}>{STATUS_LABEL[o.status as OrderStatus]}</span>
      </div>
      {stepIdx >= 0 && (
        <ol class="mt-8 grid grid-cols-5 gap-2">
          {STEPS.map((s, i) => <li class="text-center"><div class={`h-1.5 rounded-full ${i <= stepIdx ? 'bg-brand' : 'bg-line'}`}></div><p class={`mt-2 text-xs sm:text-sm ${i <= stepIdx ? 'font-medium text-ink' : 'text-muted'}`}>{STATUS_LABEL[s]}</p></li>)}
        </ol>
      )}
      {o.tracking_code && <p class="mt-6 rounded-lg bg-cream p-4 text-[15px]">Courier: <strong class="capitalize">{o.courier}</strong> · Tracking: <strong>{o.tracking_code}</strong></p>}
      <div class="mt-8 divide-y divide-line rounded-2xl border border-line">
        {props.items.map((it) => (
          <div class="flex gap-4 p-4">
            {it.image && <img src={sized(it.image, 160, 214)} alt="" class="h-20 w-16 rounded-lg object-cover" />}
            <div class="flex-1"><p class="font-medium">{it.name}</p><p class="text-sm text-muted">{[it.color, it.size].filter(Boolean).join(' · ')} · Qty {it.qty}</p></div>
            <p class="font-medium">{taka(it.total)}</p>
          </div>
        ))}
        <dl class="space-y-2 p-4 text-[15px]">
          <div class="flex justify-between"><dt>Subtotal</dt><dd>{taka(o.subtotal)}</dd></div>
          {o.offer_discount > 0 && <div class="flex justify-between text-emerald-700"><dt>Bundle offer</dt><dd>−{taka(o.offer_discount)}</dd></div>}
          {o.discount > 0 && <div class="flex justify-between text-emerald-700"><dt>Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}{o.points_used ? ` incl. ${o.points_used} points` : ''}</dt><dd>−{taka(o.discount)}</dd></div>}
          <div class="flex justify-between"><dt>Delivery</dt><dd>{o.delivery_fee ? taka(o.delivery_fee) : 'Free'}</dd></div>
          <div class="flex justify-between border-t border-line pt-2 text-lg font-semibold"><dt>Total (cash on delivery)</dt><dd>{taka(o.total - o.advance_paid)}</dd></div>
        </dl>
      </div>
      <div class="mt-6 rounded-2xl border border-line p-4 text-[15px]">
        <p class="font-medium">Delivery to</p>
        <p class="mt-1 text-ink/75">{o.name} · {o.phone}<br />{o.address}{o.area ? `, ${o.area}` : ''}, {o.district}</p>
      </div>
    </>
  );
}

export function OrderPage(props: { ctx: Ctx; order: any; items: any[]; justPlaced: boolean }) {
  const o = props.order;
  return (
    <Layout ctx={props.ctx} title={`Order ${o.order_no}`} noindex>
      <section class="wrap max-w-5xl py-12">
        {props.justPlaced && (
          <div class="mb-8 rounded-2xl bg-emerald-50 p-6 text-center">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 5 5 9-10" /></svg></div>
            <h1 class="mt-4 text-2xl sm:text-3xl">Thank you, {o.name.split(' ')[0]}!</h1>
            <p class="mt-2 text-[15px] text-ink/75 sm:text-base">Your order has been placed. We will call <strong>{o.phone}</strong> to confirm it shortly.</p>
            {!props.ctx.customer && <p class="mt-3 text-sm text-ink/70"><a href="/account/login" class="font-medium text-brand underline">Create an account</a> with this number to track orders and earn reward points.</p>}
          </div>
        )}
        <OrderSummary order={o} items={props.items} name={props.ctx.settings.store.name} />
        <div class="mt-8 flex flex-wrap gap-3"><a href="/shop" class="btn-dark">Continue shopping</a>{props.ctx.customer ? <a href="/account" class="btn-line">My orders</a> : <a href="/track" class="btn-line">Track another order</a>}</div>
      </section>
      {props.justPlaced && <script>{raw('try{localStorage.removeItem("sutoloka_cart")}catch(e){}')}</script>}
    </Layout>
  );
}

export function TrackPage(props: { ctx: Ctx; error?: string; values?: { order?: string; phone?: string } }) {
  return (
    <Layout ctx={props.ctx} title="Track your order">
      <section class="wrap max-w-lg py-14">
        <h1 class="text-3xl">Track your order</h1>
        <p class="mt-2 text-muted">Enter your order number and the mobile number used for the order.</p>
        <form method="get" action="/track" class="mt-8 space-y-5">
          <div><label class="label" for="order">Order number</label><input class="field uppercase" id="order" name="order" placeholder="SL2611170123" value={props.values?.order || ''} required /></div>
          <div><label class="label" for="phone">Mobile number</label><input class="field" id="phone" name="phone" type="tel" placeholder="01XXXXXXXXX" value={props.values?.phone || ''} required /></div>
          {props.error && <p class="rounded-lg bg-red-50 p-3 text-[15px] text-red-700" role="alert">{props.error}</p>}
          <button class="btn-dark w-full">Track order</button>
        </form>
      </section>
    </Layout>
  );
}

// ---------- Account ----------
export function LoginPage(props: { ctx: Ctx; next: string }) {
  return (
    <Layout ctx={props.ctx} title="Sign in" noindex>
      <section class="wrap max-w-md py-14">
        <h1 class="text-3xl">Sign in or create an account</h1>
        <p class="mt-2 text-muted">We'll send a 6-digit code to your mobile. No password needed.</p>
        <form data-login class="mt-8 space-y-5" data-next={props.next}>
          <div data-step="phone">
            <label class="label" for="lphone">Mobile number</label>
            <input class="field" id="lphone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01XXXXXXXXX" required />
          </div>
          <div data-step="code" class="hidden space-y-5">
            <div>
              <label class="label" for="lcode">Enter the code sent to <span data-sent-to></span></label>
              <input class="field text-center text-2xl tracking-[0.5em]" id="lcode" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength={6} placeholder="••••••" />
            </div>
            <div><label class="label" for="lname">Your name (for new accounts)</label><input class="field" id="lname" name="name" autocomplete="name" /></div>
            <button type="button" data-resend class="text-sm font-medium underline">Send a new code</button>
          </div>
          <p data-login-msg class="hidden rounded-lg p-3 text-[15px]" role="alert"></p>
          <button class="btn-dark w-full" data-login-btn>Send code</button>
        </form>
        <ul class="mt-10 space-y-2 text-[15px] text-ink/75">
          <li>✓ Track all your orders in one place</li>
          <li>✓ Save addresses for faster checkout</li>
          {props.ctx.settings.rewards.enabled && <li>✓ Earn {props.ctx.settings.rewards.earn_per_100} point for every ৳100 you spend</li>}
          <li>✓ Sync your wishlist across devices</li>
        </ul>
      </section>
    </Layout>
  );
}

export function AccountPage(props: { ctx: Ctx; orders: any[]; addresses: any[]; ledger: any[] }) {
  const cu = props.ctx.customer!;
  const r = props.ctx.settings.rewards;
  return (
    <Layout ctx={props.ctx} title="My account" noindex>
      <section class="wrap py-10">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div><p class="text-muted">Welcome back</p><h1 class="text-3xl">{cu.name}</h1><p class="text-muted">{cu.phone}</p></div>
          <form method="post" action="/account/logout"><button class="btn-line py-2">Sign out</button></form>
        </div>
        <div class="mt-8 grid gap-4 sm:grid-cols-3">
          <div class="rounded-2xl bg-cream p-5"><p class="text-sm text-muted">Orders</p><p class="mt-1 text-3xl font-semibold">{props.orders.length}</p></div>
          {r.enabled && <div class="rounded-2xl bg-brand-soft p-5"><p class="text-sm text-brand-dark">Reward points</p><p class="mt-1 text-3xl font-semibold text-brand-dark">{cu.points}</p><p class="text-sm text-brand-dark/80">Worth {taka(cu.points * (r.point_value || 1))} at checkout</p></div>}
          <a href="/wishlist" class="rounded-2xl bg-cream p-5 hover:bg-line"><p class="text-sm text-muted">Wishlist</p><p class="mt-1 text-3xl font-semibold" data-wish-total>—</p></a>
        </div>

        <div class="mt-12 grid gap-12 lg:grid-cols-[1fr_380px]">
          <div>
            <h2 class="text-xl">My orders</h2>
            {props.orders.length === 0 && <p class="mt-4 text-muted">No orders yet. <a href="/shop" class="font-medium text-brand underline">Start shopping</a></p>}
            <div class="mt-4 divide-y divide-line rounded-2xl border border-line">
              {props.orders.map((o) => (
                <div class="flex flex-wrap items-center gap-4 p-4">
                  <div class="flex -space-x-3">{(o.images || []).slice(0, 3).map((im: string) => <img src={sized(im, 100, 133)} alt="" class="h-14 w-11 rounded-md border-2 border-white object-cover" />)}</div>
                  <div class="min-w-0 flex-1">
                    <a href={`/account/orders/${o.order_no}`} class="font-semibold hover:underline">{o.order_no}</a>
                    <p class="text-sm text-muted">{new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {o.items} items · {taka(o.total)}</p>
                  </div>
                  <span class={`rounded-full px-3 py-1 text-xs font-semibold ${o.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : o.status === 'cancelled' || o.status === 'returned' ? 'bg-red-50 text-red-700' : 'bg-cream'}`}>{STATUS_LABEL[o.status as OrderStatus]}</span>
                  <button type="button" data-reorder={o.order_no} class="btn-line py-2 text-sm">Buy again</button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 class="text-xl">Saved addresses</h2>
            <div class="mt-4 space-y-3">
              {props.addresses.map((a) => (
                <div class="rounded-xl border border-line p-4 text-[15px]">
                  <div class="flex items-start justify-between gap-3">
                    <p><strong>{a.label}</strong>{a.is_default ? <span class="ml-2 rounded bg-cream px-1.5 py-0.5 text-xs">Default</span> : null}<span class="block text-sm text-muted">{a.name} · {a.phone}<br />{a.address}{a.area ? `, ${a.area}` : ''}, {a.district}</span></p>
                    <button type="button" data-del-address={a.id} class="text-sm text-muted underline hover:text-red-700">Remove</button>
                  </div>
                </div>
              ))}
              {props.addresses.length === 0 && <p class="text-muted">Addresses you use at checkout can be saved here.</p>}
            </div>
            {r.enabled && props.ledger.length > 0 && (
              <>
                <h2 class="mt-10 text-xl">Points history</h2>
                <ul class="mt-4 divide-y divide-line text-[15px]">
                  {props.ledger.map((l) => <li class="flex justify-between py-2.5"><span class="capitalize">{l.reason}<span class="block text-xs text-muted">{new Date(l.created_at).toLocaleDateString('en-GB')}</span></span><span class={l.change > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{l.change > 0 ? '+' : ''}{l.change}</span></li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function AccountOrderPage(props: { ctx: Ctx; order: any; items: any[] }) {
  return (
    <Layout ctx={props.ctx} title={`Order ${props.order.order_no}`} noindex>
      <section class="wrap max-w-5xl py-10">
        <a href="/account" class="text-sm font-medium text-muted hover:text-ink">← My account</a>
        <div class="mt-4"><OrderSummary order={props.order} items={props.items} name={props.ctx.settings.store.name} /></div>
        <div class="mt-8 flex gap-3"><button type="button" data-reorder={props.order.order_no} class="btn-dark">Buy again</button><a href="/shop" class="btn-line">Continue shopping</a></div>
      </section>
    </Layout>
  );
}

export function WishlistPage(props: { ctx: Ctx }) {
  return (
    <Layout ctx={props.ctx} title="Wishlist" noindex>
      <section class="wrap py-10">
        <h1 class="text-3xl">Wishlist</h1>
        <p class="mt-1 text-muted">{props.ctx.customer ? 'Saved to your account.' : <>Saved on this device. <a class="font-medium text-brand underline" href="/account/login?next=/wishlist">Sign in</a> to keep it across devices.</>}</p>
        <div data-wishlist class="mt-8"><p class="text-muted">Loading…</p></div>
      </section>
    </Layout>
  );
}

export function StaticPage(props: { ctx: Ctx; title: string; body: string }) {
  return (
    <Layout ctx={props.ctx} title={props.title}>
      <section class="wrap max-w-5xl py-12">
        <Breadcrumbs items={[['Home', '/'], [props.title]]} />
        <h1 class="mt-3 text-3xl sm:text-4xl">{props.title}</h1>
        <div class="prose-page mt-6">{raw(props.body)}</div>
      </section>
    </Layout>
  );
}

export function NotFound(props: { ctx: Ctx }) {
  return (
    <Layout ctx={props.ctx} title="Page not found" noindex>
      <section class="wrap py-24 text-center">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-brand">404</p>
        <h1 class="mt-3 text-3xl sm:text-4xl">We couldn't find that page</h1>
        <p class="mt-3 text-muted">It may have moved or sold out.</p>
        <a href="/shop" class="btn-dark mt-8">Browse the shop</a>
      </section>
    </Layout>
  );
}
