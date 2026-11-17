// Sutoloka storefront — vanilla JS: cart, wishlist, quick view, search suggestions, product options,
// reviews, login with SMS code, checkout, countdowns, slider and recently viewed.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const S = window.__STORE__ || {};
  const taka = (n) => '৳' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;
  const cleanPhone = (p) => String(p || '').replace(/[\s-]/g, '');

  async function api(url, body, method) {
    const opts = body instanceof FormData ? { method: 'POST', body } : body !== undefined ? { method: method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { method: method || 'GET' };
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { data });
    return data;
  }

  let toastTimer;
  function toast(msg) {
    const el = $('[data-toast]'); if (!el) return;
    el.textContent = msg; el.classList.remove('opacity-0', 'translate-y-4');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('opacity-0', 'translate-y-4'), 2400);
  }

  // ---------- panels ----------
  let lastFocus;
  function open(name) {
    const p = $(`[data-panel="${name}"]`); if (!p) return;
    lastFocus = document.activeElement;
    p.classList.remove('hidden'); if (['sizechart', 'quick', 'review'].includes(name)) p.classList.add('flex');
    document.body.style.overflow = 'hidden';
    if (name === 'cart') renderDrawer();
    setTimeout(() => (p.querySelector('input,button,select,a') || p).focus?.(), 50);
  }
  function closeAll() {
    $$('[data-panel]').forEach((p) => p.classList.add('hidden'));
    document.body.style.overflow = '';
    lastFocus?.focus?.();
  }
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); open(o.dataset.open); }
    if (e.target.closest('[data-close]')) closeAll();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

  // ---------- cart ----------
  const CART = 'sutoloka_cart';
  const readCart = () => { const v = store.get(CART, []); return Array.isArray(v) ? v : []; };
  const writeCart = (items) => { store.set(CART, items); renderCount(); };
  const addToCart = (variantId, qty) => {
    const items = readCart();
    const ex = items.find((i) => i.variantId === variantId);
    if (ex) ex.qty = Math.min(20, ex.qty + qty); else items.push({ variantId, qty });
    writeCart(items);
  };
  const setQty = (variantId, qty) => writeCart(readCart().map((i) => (i.variantId === variantId ? { ...i, qty } : i)).filter((i) => i.qty > 0));
  function renderCount() {
    const n = readCart().reduce((s, i) => s + i.qty, 0);
    $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.classList.toggle('hidden', !n); el.classList.toggle('flex', !!n); });
  }

  // Free delivery + bundle offer progress
  function progressHtml(subtotal, qty) {
    const parts = [];
    if (S.freeOver) {
      const left = S.freeOver - subtotal;
      const pct = Math.min(100, (subtotal / S.freeOver) * 100);
      parts.push(`<div><p class="text-sm">${left > 0 ? `Add <strong>${taka(left)}</strong> more for <strong>free delivery</strong>` : '🎉 You have unlocked <strong>free delivery</strong>'}</p><div class="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-emerald-600 transition-all" style="width:${pct}%"></div></div></div>`);
    }
    const tiers = (S.offers || []).slice().sort((a, b) => a.min_qty - b.min_qty);
    const next = tiers.find((t) => qty < t.min_qty);
    const got = tiers.filter((t) => qty >= t.min_qty).pop();
    if (next) parts.push(`<p class="text-sm text-brand-dark">Add ${next.min_qty - qty} more item${next.min_qty - qty > 1 ? 's' : ''} to get <strong>${next.percent}% off</strong>${got ? ` (now ${got.percent}% off)` : ''}</p>`);
    else if (got) parts.push(`<p class="text-sm text-brand-dark">🎁 Bundle offer: <strong>${got.percent}% off</strong> applied at checkout</p>`);
    return parts.join('<div class="h-3"></div>');
  }

  const lineHtml = (l, big) => `
    <div class="flex gap-4 py-4" data-line="${l.variantId}">
      <a href="/product/${esc(l.slug)}" class="shrink-0"><img src="${esc(l.image || '')}" alt="" class="${big ? 'h-28 w-[84px]' : 'h-24 w-[72px]'} rounded-lg bg-cream object-cover"></a>
      <div class="min-w-0 flex-1">
        <a href="/product/${esc(l.slug)}" class="line-clamp-2 font-medium leading-snug hover:underline">${esc(l.name)}</a>
        <p class="mt-0.5 text-sm text-muted">${esc([l.color, l.size].filter(Boolean).join(' · '))}${l.flash ? ' · <span class="font-medium text-sale">Flash price</span>' : ''}</p>
        ${l.available ? '' : `<p class="mt-1 text-sm font-medium text-red-700">${l.stock > 0 ? `Only ${l.stock} left` : 'Sold out'}</p>`}
        <div class="mt-2 flex items-center gap-3">
          <div class="flex h-9 items-center rounded-lg border border-line">
            <button class="h-full px-3" data-dec="${l.variantId}" aria-label="Decrease">−</button>
            <span class="w-7 text-center text-sm">${l.qty}</span>
            <button class="h-full px-3" data-inc="${l.variantId}" aria-label="Increase">+</button>
          </div>
          <button class="text-sm text-muted underline-offset-4 hover:text-ink hover:underline" data-remove="${l.variantId}">Remove</button>
        </div>
      </div>
      <p class="font-semibold">${taka(l.total)}</p>
    </div>`;

  async function priced() {
    const items = readCart();
    if (!items.length) return { lines: [], subtotal: 0, qty: 0 };
    const res = await api('/api/cart', { items });
    const known = new Set(res.lines.map((l) => l.variantId));
    if (items.some((i) => !known.has(i.variantId))) writeCart(items.filter((i) => known.has(i.variantId)));
    return res;
  }
  const empty = `<div class="py-16 text-center"><p class="text-lg font-medium">Your cart is empty</p><a href="/shop" class="btn-dark mt-6">Start shopping</a></div>`;

  async function renderDrawer() {
    const box = $('[data-cart-lines]'); if (!box) return;
    box.innerHTML = '<p class="py-10 text-center text-muted">Loading…</p>';
    const { lines, subtotal, qty } = await priced();
    box.innerHTML = lines.length ? `<div class="divide-y divide-line">${lines.map((l) => lineHtml(l)).join('')}</div>` : empty;
    $$('[data-cart-subtotal]').forEach((el) => (el.textContent = taka(subtotal)));
    const pg = $('[data-panel="cart"] [data-progress]'); if (pg) { pg.innerHTML = lines.length ? progressHtml(subtotal, qty) : ''; pg.classList.toggle('hidden', !lines.length || !pg.innerHTML); }
  }
  async function renderCartPage() {
    const box = $('[data-cart-page]'); if (!box) return;
    const { lines, subtotal, qty } = await priced();
    box.innerHTML = lines.length ? lines.map((l) => lineHtml(l, true)).join('') : empty;
    $$('[data-cart-subtotal]').forEach((el) => (el.textContent = taka(subtotal)));
    const pg = box.parentElement.querySelector('[data-progress]'); if (pg) pg.innerHTML = lines.length ? `<div class="rounded-xl bg-cream p-4">${progressHtml(subtotal, qty)}</div>` : '';
    const link = $('[data-checkout-link]'); if (link) { link.classList.toggle('pointer-events-none', !lines.length); link.classList.toggle('opacity-50', !lines.length); }
  }
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-inc],[data-dec],[data-remove]'); if (!t) return;
    const id = Number(t.dataset.inc || t.dataset.dec || t.dataset.remove);
    const cur = readCart().find((i) => i.variantId === id); if (!cur) return;
    setQty(id, t.dataset.remove ? 0 : Math.min(20, cur.qty + (t.dataset.inc ? 1 : -1)));
    await Promise.all([renderDrawer(), renderCartPage(), renderSummary()]);
  });

  // ---------- wishlist ----------
  const WISH = 'sutoloka_wish';
  let wish = new Set(store.get(WISH, []));
  function paintWish() {
    $$('[data-wish]').forEach((b) => b.setAttribute('aria-pressed', String(wish.has(Number(b.dataset.wish)))));
    $$('[data-wish-count]').forEach((el) => { el.textContent = wish.size; el.classList.toggle('hidden', !wish.size); el.classList.toggle('flex', !!wish.size); });
    $$('[data-wish-total]').forEach((el) => (el.textContent = wish.size));
  }
  async function syncWish() {
    if (!S.loggedIn) return;
    try { const r = await api('/api/wishlist'); wish = new Set([...r.ids]); store.set(WISH, [...wish]); paintWish(); } catch {}
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-wish]'); if (!b) return;
    e.preventDefault();
    const id = Number(b.dataset.wish);
    const on = !wish.has(id);
    on ? wish.add(id) : wish.delete(id);
    store.set(WISH, [...wish]); paintWish();
    toast(on ? 'Saved to wishlist' : 'Removed from wishlist');
    if (S.loggedIn) api('/api/wishlist', { productId: id, on }).catch(() => {});
    if ($('[data-wishlist]') && !on) renderWishlistPage();
  });
  async function renderWishlistPage() {
    const box = $('[data-wishlist]'); if (!box) return;
    if (!wish.size) { box.innerHTML = '<div class="rounded-2xl bg-cream py-16 text-center"><p class="text-lg font-medium">Your wishlist is empty</p><p class="mt-1 text-muted">Tap the heart on any product to save it here.</p><a href="/shop" class="btn-dark mt-6">Discover products</a></div>'; return; }
    const html = await (await fetch(`/fragments/cards?ids=${[...wish].slice(0, 24).join(',')}`)).text();
    box.innerHTML = html || '<p class="text-muted">These products are no longer available.</p>';
    paintWish();
  }

  // ---------- recently viewed ----------
  const RECENT = 'sutoloka_recent';
  async function renderRecent(excludeId) {
    const wrap = $('[data-recent-wrap]'); if (!wrap) return;
    const ids = store.get(RECENT, []).filter((id) => id !== excludeId).slice(0, 8);
    if (!ids.length) return;
    const html = await (await fetch(`/fragments/cards?ids=${ids.join(',')}`)).text();
    if (!html) return;
    $('[data-recent]', wrap).innerHTML = html;
    wrap.classList.remove('hidden');
    paintWish();
  }

  // ---------- search suggestions ----------
  $$('[data-suggest-form]').forEach((form) => {
    const input = $('[data-suggest-input]', form), box = $('[data-suggest-box]', form);
    let timer, seq = 0;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { box.classList.add('hidden'); return; }
      timer = setTimeout(async () => {
        const my = ++seq;
        const r = await api(`/api/suggest?q=${encodeURIComponent(q)}`).catch(() => null);
        if (!r || my !== seq) return;
        if (!r.products.length && !r.categories.length) { box.innerHTML = `<p class="p-4 text-[15px] text-muted">No matches for “${esc(q)}”</p>`; box.classList.remove('hidden'); return; }
        box.innerHTML = r.categories.map((c) => `<a href="/category/${esc(c.slug)}" class="block px-4 py-2.5 text-[15px] hover:bg-cream">in <strong>${esc(c.name)}</strong></a>`).join('') +
          r.products.map((p) => `<a href="/product/${esc(p.slug)}" class="flex items-center gap-3 px-4 py-2 hover:bg-cream"><img src="${esc(p.thumbnail)}" alt="" class="h-12 w-9 rounded object-cover"><span class="flex-1 text-[15px]">${esc(p.name)}</span><span class="text-sm font-semibold">${taka(p.min_price)}</span></a>`).join('') +
          `<button class="block w-full border-t border-line px-4 py-2.5 text-left text-[15px] font-medium hover:bg-cream">See all results for “${esc(q)}”</button>`;
        box.classList.remove('hidden');
      }, 180);
    });
    document.addEventListener('click', (e) => { if (!form.contains(e.target)) box.classList.add('hidden'); });
  });

  // ---------- product options (product page + quick view) ----------
  function bindOptions(root, P, opts = {}) {
    const form = root;
    const state = { color: $('[data-color][aria-pressed="true"]', root)?.dataset.color || '', size: $('[data-size][aria-pressed="true"]', root)?.dataset.size || '' };
    const find = () => P.variants.find((v) => (!state.color || v.color === state.color) && (!state.size || v.size === state.size));
    function update() {
      const v = find();
      $$('[data-size]', root).forEach((b) => {
        const m = P.variants.find((x) => x.size === b.dataset.size && (!state.color || x.color === state.color));
        b.dataset.out = String(!m || m.stock <= 0);
        b.setAttribute('aria-pressed', String(b.dataset.size === state.size));
      });
      $$('[data-color]', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === state.color)));
      const cl = $('[data-color-label]', root); if (cl) cl.textContent = state.color;
      const sl = $('[data-size-label]', root); if (sl) sl.textContent = state.size || 'Select a size';
      const stock = $('[data-stock]', root);
      const ok = v && v.stock > 0;
      if (v) {
        const sale = v.sale_price, reg = v.price;
        const pr = $('[data-price]', root.closest('[data-quick-product]') || document);
        if (pr) pr.innerHTML = `<span class="flex flex-wrap items-baseline gap-x-2"><span class="${reg > sale ? 'text-sale' : ''}">${taka(sale)}</span>${reg > sale ? `<span class="text-[0.85em] font-normal text-muted line-through">${taka(reg)}</span><span class="rounded bg-sale/10 px-1.5 py-0.5 text-xs font-semibold text-sale">-${Math.round(((reg - sale) / reg) * 100)}%</span>` : ''}</span>`;
        const sku = $('[data-sku]'); if (sku && opts.page) sku.textContent = v.sku;
        stock.textContent = ok ? (v.stock <= 5 ? `Hurry — only ${v.stock} left` : 'In stock, ready to ship') : 'Sold out in this option';
        stock.className = `text-[15px] font-medium ${ok ? (v.stock <= 5 ? 'text-sale' : 'text-emerald-700') : 'text-red-700'}`;
      } else {
        stock.textContent = 'This combination is not available'; stock.className = 'text-[15px] font-medium text-red-700';
      }
      $$('[data-add],[data-buynow]', root).forEach((b) => (b.disabled = !ok));
      if (opts.page) { $('[data-buy-row]')?.classList.toggle('hidden', !!v && !ok); $('[data-notify]')?.classList.toggle('hidden', !v || ok); }
      return v;
    }
    form.addEventListener('click', (e) => {
      const c = e.target.closest('[data-color]');
      if (c) {
        state.color = c.dataset.color;
        if (!P.variants.some((v) => v.color === state.color && v.size === state.size && v.stock > 0)) {
          state.size = (P.variants.find((v) => v.color === state.color && v.stock > 0) || P.variants.find((v) => v.color === state.color) || {}).size || state.size;
        }
        const v = update(); if (v?.images?.[0] && opts.onImage) opts.onImage(v.images[0]);
      }
      const s = e.target.closest('[data-size]'); if (s) { state.size = s.dataset.size; update(); }
      const q = e.target.closest('[data-qty]');
      if (q) { const inp = $('[data-qty-input]', root); inp.value = Math.max(1, Math.min(20, (Number(inp.value) || 1) + Number(q.dataset.qty))); }
    });
    const addCurrent = () => {
      const v = update(); if (!v || v.stock <= 0) return false;
      const qty = Math.max(1, Math.min(20, Number($('[data-qty-input]', root)?.value) || 1));
      const inCart = (readCart().find((i) => i.variantId === v.id) || {}).qty || 0;
      if (inCart + qty > v.stock) { toast(`Only ${v.stock} available`); return false; }
      addToCart(v.id, qty); return true;
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); if (addCurrent()) { toast('Added to cart'); closeAll(); open('cart'); } });
    $('[data-buynow]', root)?.addEventListener('click', () => { if (addCurrent()) location.href = '/checkout'; });
    update();
    return { current: find };
  }

  const P = window.__PRODUCT__;
  if (P) {
    const gal = $('[data-gallery]');
    const counter = $('[data-gallery-count]');
    const showIndex = (i) => { gal.scrollTo({ left: gal.clientWidth * i, behavior: 'smooth' }); };
    const paintThumbs = (i) => { $$('[data-thumb]').forEach((b) => { const on = Number(b.dataset.thumb) === i; b.classList.toggle('border-ink', on); b.classList.toggle('border-transparent', !on); }); if (counter) counter.textContent = `${i + 1} / ${P.gallery.length}`; };
    gal?.addEventListener('scroll', () => paintThumbs(Math.round(gal.scrollLeft / gal.clientWidth)), { passive: true });
    $$('[data-thumb]').forEach((b) => b.addEventListener('click', () => showIndex(Number(b.dataset.thumb))));
    const opts = bindOptions($('[data-buy]'), P, { page: true, onImage: (src) => { const i = P.gallery.indexOf(src); if (i >= 0) showIndex(i); } });
    $('[data-notify-btn]')?.addEventListener('click', async () => {
      const v = opts.current(); const inp = $('[name=notify_phone]');
      if (!PHONE_RE.test(cleanPhone(inp.value))) { toast('Enter a valid mobile number'); inp.focus(); return; }
      try { await api('/api/stock-alert', { variantId: v.id, phone: inp.value }); toast("We'll SMS you when it's back"); inp.value = ''; } catch (err) { toast(err.message); }
    });
    // recently viewed
    const recent = store.get(RECENT, []).filter((id) => id !== P.id); recent.unshift(P.id); store.set(RECENT, recent.slice(0, 12));
    renderRecent(P.id);
    // reviews
    const rf = $('[data-review-form]');
    rf?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!rf.querySelector('[name=rating]')) return;
      const msg = $('[data-review-msg]');
      const btn = rf.querySelector('button:not([type=button])'); btn.disabled = true;
      try {
        const files = rf.querySelector('[name=photos]').files;
        if (files.length > 3) throw new Error('You can add up to 3 photos.');
        const r = await api('/api/reviews', new FormData(rf));
        msg.textContent = r.message; msg.className = 'rounded-lg bg-emerald-50 p-3 text-[15px] text-emerald-800';
        rf.reset(); if (r.status === 'approved') setTimeout(() => location.reload(), 1200);
      } catch (err) { msg.textContent = err.message; msg.className = 'rounded-lg bg-red-50 p-3 text-[15px] text-red-700'; }
      btn.disabled = false;
    });
  } else {
    renderRecent();
  }

  // copy link
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Link copied'); } catch { toast(b.dataset.copy); }
  });

  // ---------- quick view ----------
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-quick]'); if (!b) return;
    e.preventDefault();
    const body = $('[data-quick-body]'); if (!body) return;
    body.innerHTML = '<p class="p-16 text-center text-muted">Loading…</p>';
    open('quick');
    const html = await (await fetch(`/fragments/quick/${encodeURIComponent(b.dataset.quick)}`)).text();
    body.innerHTML = html;
    const root = $('[data-quick-product]', body);
    if (root) bindOptions($('[data-buy-quick]', body), JSON.parse(root.dataset.quickProduct));
  });

  // ---------- hero slider ----------
  $$('[data-slider]').forEach((sl) => {
    const track = $('[data-track]', sl), dots = $$('[data-dot]', sl);
    if (dots.length < 2) return;
    let i = 0, timer;
    const go = (n) => { i = (n + dots.length) % dots.length; track.scrollTo({ left: track.clientWidth * i, behavior: 'smooth' }); };
    const paint = () => dots.forEach((d, k) => { d.setAttribute('aria-current', String(k === i)); d.classList.toggle('w-8', k === i); d.classList.toggle('w-2', k !== i); });
    track.addEventListener('scroll', () => { i = Math.round(track.scrollLeft / track.clientWidth); paint(); }, { passive: true });
    dots.forEach((d) => d.addEventListener('click', () => { go(Number(d.dataset.dot)); restart(); }));
    const restart = () => { clearInterval(timer); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => go(i + 1), 6000); };
    sl.addEventListener('mouseenter', () => clearInterval(timer)); sl.addEventListener('mouseleave', restart);
    restart();
  });

  // ---------- countdowns ----------
  const cds = $$('[data-countdown]');
  if (cds.length) {
    const tick = () => cds.forEach((el) => {
      let s = Math.max(0, Math.floor((Date.parse(el.dataset.countdown) - Date.now()) / 1000));
      const parts = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
      $$('[data-unit]', el).forEach((u) => (u.textContent = String(parts[u.dataset.unit]).padStart(2, '0') + u.dataset.unit));
    });
    tick(); setInterval(tick, 1000);
  }

  // ---------- login with SMS code ----------
  const lf = $('[data-login]');
  if (lf) {
    let step = 'phone';
    const msg = $('[data-login-msg]'), btn = $('[data-login-btn]');
    const say = (t, ok) => { msg.textContent = t; msg.className = `rounded-lg p-3 text-[15px] ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`; msg.classList.toggle('hidden', !t); };
    const send = async () => {
      const phone = lf.phone.value;
      if (!PHONE_RE.test(cleanPhone(phone))) { say('Enter a valid mobile number (01XXXXXXXXX).'); lf.phone.focus(); return; }
      btn.disabled = true;
      try {
        const r = await api('/api/auth/otp', { phone });
        step = 'code';
        $('[data-step=code]').classList.remove('hidden'); $('[data-sent-to]').textContent = r.phone;
        lf.phone.readOnly = true; btn.textContent = 'Verify & continue';
        say(r.devCode ? `Development mode: your code is ${r.devCode}` : 'Code sent. It expires in 5 minutes.', true);
        lf.code.focus();
      } catch (err) { say(err.message); }
      btn.disabled = false;
    };
    lf.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (step === 'phone') return send();
      btn.disabled = true;
      try {
        await api('/api/auth/verify', { phone: lf.phone.value, code: lf.code.value.trim(), name: lf.name.value, wishlist: [...wish] });
        location.href = lf.dataset.next || '/account';
      } catch (err) { say(err.message); btn.disabled = false; }
    });
    $('[data-resend]')?.addEventListener('click', send);
  }

  // ---------- account actions ----------
  document.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-reorder]');
    if (r) {
      try {
        const res = await api(`/api/reorder/${encodeURIComponent(r.dataset.reorder)}`);
        res.items.forEach((i) => addToCart(i.variantId, i.qty));
        toast(res.items.length ? `Added ${res.items.length} item(s) to cart${res.skipped ? `, ${res.skipped} unavailable` : ''}` : 'These items are no longer available');
        if (res.items.length) open('cart');
      } catch (err) { toast(err.message); }
    }
    const d = e.target.closest('[data-del-address]');
    if (d && confirm('Remove this address?')) {
      try { await api(`/api/addresses/${d.dataset.delAddress}`, undefined, 'DELETE'); d.closest('.rounded-xl').remove(); } catch (err) { toast(err.message); }
    }
  });

  // newsletter
  $('[data-newsletter]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!PHONE_RE.test(cleanPhone(f.phone.value))) { toast('Enter a valid mobile number'); return; }
    try { await api('/api/subscribe', { phone: f.phone.value }); f.reset(); toast("You're on the list for offers!"); } catch (err) { toast(err.message); }
  });

  // ---------- checkout ----------
  const co = $('[data-checkout]');
  async function renderSummary() {
    if (!co) return;
    const items = readCart();
    const box = $('[data-summary-lines]');
    if (!items.length) { box.innerHTML = '<p class="text-muted">Your cart is empty. <a class="underline" href="/shop">Shop now</a></p>'; $('[data-place]').disabled = true; }
    const district = co.district.value;
    $('[data-zone-box]').classList.toggle('hidden', district !== 'Dhaka');
    const zone = (co.querySelector('input[name=zone]:checked') || {}).value;
    const usePoints = !!co.use_points?.checked;
    const q = await api('/api/quote', { items, district, zone, coupon: co.coupon.value.trim() || undefined, usePoints }).catch(() => null);
    if (!q) return;
    if (q.lines.length) {
      box.innerHTML = q.lines.map((l) => `
        <div class="flex gap-3">
          <div class="relative shrink-0"><img src="${esc(l.image || '')}" alt="" class="h-16 w-12 rounded-md bg-white object-cover"><span class="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] text-white">${l.qty}</span></div>
          <div class="min-w-0 flex-1 text-sm"><p class="line-clamp-2 font-medium">${esc(l.name)}</p><p class="text-muted">${esc([l.color, l.size].filter(Boolean).join(' · '))}</p>${l.available ? '' : '<p class="font-medium text-red-700">Not available in this quantity</p>'}</div>
          <p class="text-sm font-medium">${taka(l.total)}</p>
        </div>`).join('');
    }
    const qty = q.lines.filter((l) => l.available).reduce((s, l) => s + l.qty, 0);
    const pg = co.querySelector('[data-progress]'); if (pg) pg.innerHTML = q.lines.length ? progressHtml(q.subtotal, qty) : '';
    $('[data-q="subtotal"]').textContent = taka(q.subtotal);
    $('[data-q="total"]').textContent = taka(q.total);
    $('[data-q="deliveryFee"]').textContent = district ? (q.deliveryFee ? taka(q.deliveryFee) : 'Free') : 'Select district';
    const row = (k, v, label) => { const r = $(`[data-row="${k}"]`); r.classList.toggle('hidden', !v); r.classList.toggle('flex', !!v); $(`[data-q="${k === 'offer' ? 'offerDiscount' : k === 'coupon' ? 'couponDiscount' : 'pointsDiscount'}"]`).textContent = '−' + taka(v); if (label) $('[data-offer-label]').textContent = label; };
    row('offer', q.offerDiscount, `Bundle offer (${q.offerPercent}% off)`); row('coupon', q.couponDiscount); row('points', q.pointsDiscount);
    const msg = $('[data-coupon-msg]');
    if (co.coupon.value.trim()) { msg.textContent = q.couponError || `Coupon ${q.coupon} applied`; msg.className = `mt-2 text-sm ${q.couponError ? 'text-red-700' : 'text-emerald-700'}`; } else msg.textContent = '';
    const pb = $('[data-points-box]');
    if (pb && q.rewards) {
      const canUse = q.pointsAvailable >= (q.rewards.min_redeem || 0);
      pb.classList.toggle('hidden', !q.pointsAvailable); pb.classList.toggle('flex', !!q.pointsAvailable);
      co.use_points.disabled = !canUse;
      $('[data-points-label]').innerHTML = canUse
        ? `Use my reward points (${q.pointsAvailable} available${q.pointsUsed ? ` — using ${q.pointsUsed}, saves ${taka(q.pointsDiscount)}` : ''})`
        : `You have ${q.pointsAvailable} points. Redeem from ${q.rewards.min_redeem} points.`;
    }
    $('[data-place]').disabled = !q.lines.length || q.lines.some((l) => !l.available);
  }
  if (co) {
    if (!S.loggedIn) { try { const saved = store.get('sutoloka_customer', {}); for (const k of ['name', 'phone', 'district', 'area', 'address', 'email']) if (saved[k] && co[k] && !co[k].value) co[k].value = saved[k]; } catch {} }
    co.addEventListener('change', (e) => {
      if (e.target.name === 'saved_address') {
        const a = e.target.dataset.address ? JSON.parse(e.target.dataset.address) : null;
        for (const k of ['name', 'phone', 'district', 'area', 'address']) co[k].value = a ? a[k] || '' : (k === 'name' || k === 'phone' ? co[k].value : '');
        if (a) { const z = co.querySelector(`input[name=zone][value="${a.zone}"]`); if (z) z.checked = true; }
        if (co.save_address) co.save_address.checked = !a;
        renderSummary();
      }
      if (['district', 'zone', 'use_points'].includes(e.target.name)) renderSummary();
    });
    // Abandoned-cart capture once a valid phone is entered
    co.phone.addEventListener('blur', () => { if (PHONE_RE.test(cleanPhone(co.phone.value)) && readCart().length) api('/api/draft', { phone: co.phone.value, name: co.name.value, district: co.district.value, items: readCart() }).catch(() => {}); });
    $('[data-apply-coupon]').addEventListener('click', renderSummary);
    co.coupon.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); renderSummary(); } });
    co.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('[data-error]'); err.classList.add('hidden');
      $$('.field', co).forEach((f) => f.classList.remove('border-red-500'));
      const data = Object.fromEntries(new FormData(co));
      const fail = (msg, field) => { err.textContent = msg; err.classList.remove('hidden'); if (field && co[field]) { co[field].classList.add('border-red-500'); co[field].focus(); } };
      if (!data.name || data.name.trim().length < 2) return fail('Please enter your full name.', 'name');
      if (!PHONE_RE.test(cleanPhone(data.phone))) return fail('Please enter a valid mobile number (01XXXXXXXXX).', 'phone');
      if (!data.district) return fail('Please choose your district.', 'district');
      if (!data.address || data.address.trim().length < 8) return fail('Please enter your full delivery address.', 'address');
      const btn = $('[data-place]'); btn.disabled = true; btn.textContent = 'Placing order…';
      try {
        const res = await api('/api/orders', { ...data, items: readCart(), usePoints: !!co.use_points?.checked, save_address: !!co.save_address?.checked && data.saved_address !== undefined ? data.saved_address === 'new' || !data.saved_address : !!co.save_address?.checked });
        store.set('sutoloka_customer', { name: data.name, phone: data.phone, district: data.district, area: data.area, address: data.address, email: data.email });
        writeCart([]);
        location.href = `/order/${res.orderNo}?phone=${encodeURIComponent(res.phone)}&new=1`;
      } catch (ex) {
        fail(ex.message, ex.data && ex.data.field);
        btn.disabled = false; btn.textContent = 'Place order';
        renderSummary();
      }
    });
    renderSummary();
  }

  renderCount();
  paintWish();
  syncWish().then(renderWishlistPage);
  if (!S.loggedIn) renderWishlistPage();
  renderCartPage();
})();
