// Builds db/seed.sql: an original demo catalogue for "Sutoloka" using free Pexels studio photos.
// Usage: node scripts/build-demo-seed.mjs
// Everything here is demo data — replace products, photos and texts from the admin panel.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const photos = JSON.parse(await readFile(new URL('data/demo-photos.json', root), 'utf8'));

// Deterministic random so the seed is stable between runs
let seed = 20261117;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const round10 = (n) => Math.round(n / 10) * 10 - 10; // ৳1,490 style prices

const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// Photos are full Pexels URLs; resize via their w/h params
const img = (url, w = 900, h = 1200) => { const u = new URL(url); u.searchParams.set('w', String(w)); u.searchParams.set('h', String(h)); return u.toString(); };

const CATS = [
  { id: 1, name: 'Women', slug: 'women', sort: 1 },
  { id: 2, name: 'Men', slug: 'men', sort: 2 },
  { id: 3, name: 'Kids', slug: 'kids', sort: 3 },
  { id: 4, name: 'Accessories', slug: 'accessories', sort: 4 },
  { id: 11, parent: 1, name: 'Sarees', slug: 'sarees', photos: 'saree', sizes: ['Free Size'], price: [1890, 9800],
    names: ['Jamdani', 'Tangail Cotton', 'Katan Silk', 'Muslin', 'Half-Silk', 'Georgette', 'Block Print', 'Monipuri', 'Rajshahi Silk'], suffix: 'Saree',
    desc: 'Six yards of comfort with a soft drape and a ready-to-stitch blouse piece. Hand-finished edges and colour-fast dye.', fabric: ['Cotton', 'Half-silk', 'Silk', 'Muslin'] },
  { id: 12, parent: 1, name: 'Salwar Kameez', slug: 'salwar-kameez', photos: 'salwar-kameez', sizes: ['S', 'M', 'L', 'XL'], price: [1650, 4950],
    names: ['Embroidered', 'Festive', 'Printed Lawn', 'Chikankari', 'Karchupi', 'Everyday Cotton'], suffix: 'Three-Piece',
    desc: 'Unstitched-feel comfort in a ready-to-wear three-piece: kameez, salwar and dupatta. Breathable fabric for Bangladeshi weather.', fabric: ['Cotton', 'Lawn', 'Georgette', 'Linen'] },
  { id: 13, parent: 1, name: 'Kurtis', slug: 'kurtis', photos: 'kurti', sizes: ['S', 'M', 'L', 'XL', 'XXL'], price: [890, 2450],
    names: ['A-Line', 'Straight Cut', 'Floral', 'Block Print', 'Angrakha', 'Tie-Neck', 'Embroidered Yoke', 'Tiered'], suffix: 'Kurti',
    desc: 'An easy everyday kurti with a relaxed fit, side slits and a soft finish. Pairs with palazzo, jeans or leggings.', fabric: ['Cotton', 'Viscose', 'Linen blend', 'Rayon'] },
  { id: 21, parent: 2, name: 'Panjabi', slug: 'panjabi', photos: 'panjabi', sizes: ['38', '40', '42', '44', '46'], price: [1490, 4290],
    names: ['Classic Cotton', 'Eid Special', 'Embroidered Collar', 'Linen Blend', 'Slim Fit', 'Jacquard'], suffix: 'Panjabi',
    desc: 'A tailored panjabi with neat placket detailing and breathable fabric — made for Jummah, Eid and family occasions.', fabric: ['Cotton', 'Linen blend', 'Jacquard', 'Silk blend'] },
  { id: 22, parent: 2, name: 'Shirts', slug: 'shirts', photos: 'shirts', sizes: ['M', 'L', 'XL', 'XXL'], price: [990, 2190],
    names: ['Oxford', 'Striped', 'Checked', 'Linen', 'Formal', 'Casual Denim'], suffix: 'Shirt',
    desc: 'A smart regular-fit shirt with a crisp collar and easy-iron finish. Office ready, weekend friendly.', fabric: ['Cotton', 'Oxford cotton', 'Linen', 'Denim'] },
  { id: 23, parent: 2, name: 'Polo & T-Shirts', slug: 'polo-t-shirts', photos: 'polo-tshirts', sizes: ['M', 'L', 'XL', 'XXL'], price: [590, 1290],
    names: ['Pique Polo', 'Essential Crew', 'Striped Polo', 'Heavyweight Tee', 'Oversized Tee'], suffix: '',
    desc: 'Soft combed-cotton knit that holds its shape wash after wash. A wardrobe staple.', fabric: ['100% cotton', 'Pique cotton', 'Cotton jersey'] },
  { id: 24, parent: 2, name: 'Pants', slug: 'pants', photos: 'pants', sizes: ['30', '32', '34', '36'], price: [1190, 2290],
    names: ['Stretch Chino', 'Slim Jeans', 'Gabardine', 'Relaxed Trouser'], suffix: '',
    desc: 'Comfortable stretch with a clean, modern fit. Belt loops, deep pockets and durable stitching.', fabric: ['Cotton twill', 'Denim', 'Gabardine'] },
  { id: 31, parent: 3, name: 'Girls', slug: 'girls', photos: 'girls', sizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'], price: [650, 1890],
    names: ['Party Frock', 'Cotton Dress', 'Polka Dot Dress', 'Twirl Dress', 'Festive Frock'], suffix: '',
    desc: 'Soft, skin-friendly fabric with easy closures — made for play days and celebrations.', fabric: ['Cotton', 'Cotton blend'] },
  { id: 32, parent: 3, name: 'Boys', slug: 'boys', photos: 'boys', sizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'], price: [590, 1590],
    names: ['Check Shirt', 'Mini Panjabi', 'Casual Set', 'Smart Shirt', 'Graphic Tee'], suffix: '',
    desc: 'Durable, breathable kidswear with room to move. Easy to wash, easy to wear.', fabric: ['Cotton', 'Cotton jersey'] },
  { id: 41, parent: 4, name: 'Bags', slug: 'bags', photos: 'bags', sizes: ['One Size'], price: [990, 3490], crop: 'center',
    names: ['Leather Satchel', 'Crossbody Bag', 'Tote Bag', 'Mini Handbag', 'Top-Handle Bag'], suffix: '',
    desc: 'A structured bag with quality hardware and a roomy interior. Fits your phone, wallet and daily essentials.', fabric: ['PU leather', 'Faux leather'] },
];

const COLORS = ['Maroon', 'Olive', 'Navy', 'Mustard', 'Peach', 'Teal', 'Off-White', 'Black', 'Rose', 'Sky Blue', 'Bottle Green', 'Beige', 'Lavender', 'Rust'];
const REVIEWERS = ['Nusrat J.', 'Farhana A.', 'Tahmid R.', 'Sadia I.', 'Rakib H.', 'Mehjabin K.', 'Arif M.', 'Shirin S.', 'Tanvir A.', 'Lamia R.', 'Fahim C.', 'Rumana P.', 'Sabbir H.', 'Ishrat Z.', 'Mahin T.'];
const REVIEW_TEXT = [
  [5, 'Excellent quality', 'Fabric quality is better than expected and the colour is exactly like the photo. Delivery inside Dhaka took one day.'],
  [5, 'Very comfortable', 'Wore it the whole day without any discomfort. Stitching is neat. Will order again.'],
  [4, 'Good product', 'Nice fit and finishing. Colour is slightly lighter in real life but still beautiful.'],
  [5, 'Perfect for Eid', 'Got lots of compliments. Packaging was also very nice.'],
  [4, 'Value for money', 'Good quality for this price. Size chart was accurate.'],
  [5, 'অসাধারণ', 'কাপড়ের মান খুব ভালো, ছবির সাথে হুবহু মিল আছে। ধন্যবাদ।'],
  [3, 'Okay', 'Product is fine but delivery took 4 days outside Dhaka.'],
  [5, 'Loved it', 'Second time buying from Sutoloka. Consistent quality every time.'],
  [4, 'Nice', 'Soft fabric, fits well. Exchange process was easy when I needed a bigger size.'],
];

const out = ['-- Generated by scripts/build-demo-seed.mjs — demo data for Sutoloka', 'PRAGMA foreign_keys = OFF;'];
for (const c of CATS) {
  out.push(`INSERT INTO categories (id,parent_id,name,slug,description,image,sort,featured,status) VALUES (${[
    c.id, c.parent ?? null, c.name, c.slug, c.parent ? `Shop ${c.name.toLowerCase()} at Sutoloka.` : `${c.name}'s collection`,
    c.photos ? img(photos.categories[c.photos][0], 600, 750) : null, c.sort ?? 0, c.parent ? 1 : 0, 'active',
  ].map(q).join(',')});`);
}

let pid = 1000, vid = 5000, rid = 1;
const now = Date.parse('2026-11-17T06:00:00Z');
const productIds = [];
const usedSlugs = new Set();
for (const c of CATS.filter((x) => x.photos)) {
  const list = photos.categories[c.photos];
  list.forEach((photo, i) => {
    pid++;
    const color = pick(COLORS);
    const label = c.names[i % c.names.length];
    let name = [label, c.suffix].filter(Boolean).join(' ');
    if (c.id === 11 || c.id === 12 || c.id === 21) name = `${color} ${name}`;
    let slug = slugify(name);
    if (usedSlugs.has(slug)) slug = `${slug}-${pid}`;
    usedSlugs.add(slug);
    const regular = round10(between(c.price[0], c.price[1]));
    const onSale = rnd() < 0.3;
    const sale = onSale ? round10(regular * (1 - between(10, 30) / 100)) : regular;
    const gallery = [img(photo, 900, 1200)]; // one clean photo per product (no mixed models)
    const created = new Date(now - between(0, 60) * 86400000 - between(0, 86400) * 1000).toISOString();
    const fabric = pick(c.fabric);
    const desc = `${c.desc}\n\nFabric: ${fabric}. Care: gentle wash, dry in shade, warm iron.`;
    const outOfStock = rnd() < 0.07;
    const colors = rnd() < 0.3 ? [color, pick(COLORS.filter((x) => x !== color))] : [color];
    const variants = [];
    colors.forEach((col, ci) => c.sizes.forEach((size) => {
      vid++;
      const stock = outOfStock ? 0 : rnd() < 0.12 ? 0 : between(1, 25);
      variants.push({ id: vid, sku: `SL-${pid}-${ci + 1}${c.sizes.indexOf(size) + 1}`, color: col, size, price: regular, sale, stock, images: gallery });
    }));
    const total = variants.reduce((s, v) => s + v.stock, 0);
    const sold = between(3, 420);
    const tags = [fabric.toLowerCase(), onSale ? 'sale' : '', (Date.now() - Date.parse(created)) < 14 * 86400000 ? 'new' : ''].filter(Boolean).join(',');
    out.push(`INSERT INTO products (id,name,slug,category_id,description,thumbnail,featured,status,min_price,max_price,total_stock,sold_count,tags,created_at,updated_at) VALUES (${[
      pid, name, slug, c.id, desc, gallery[0], rnd() < 0.2 ? 1 : 0, 'active', sale, sale, total, sold, tags, created, created,
    ].map(q).join(',')});`);
    variants.forEach((v, k) => out.push(`INSERT INTO variants (id,product_id,sku,color,size,price,sale_price,stock,images,status,sort) VALUES (${[
      v.id, pid, v.sku, v.color, v.size, v.price, v.sale, v.stock, JSON.stringify(v.images), 'active', k,
    ].map(q).join(',')});`));
    // Sample approved reviews
    const nReviews = between(0, 6);
    let sum = 0;
    for (let r = 0; r < nReviews; r++) {
      const [rating, title, body] = pick(REVIEW_TEXT);
      sum += rating;
      const fit = pick(['true', 'true', 'true', 'small', 'large']);
      out.push(`INSERT INTO reviews (id,product_id,name,rating,title,body,size_bought,fit,verified,status,created_at) VALUES (${[
        rid++, pid, pick(REVIEWERS), rating, title, body, pick(c.sizes), fit, rnd() < 0.75 ? 1 : 0, 'approved', new Date(Date.parse(created) + between(3, 20) * 86400000).toISOString(),
      ].map(q).join(',')});`);
    }
    if (nReviews) out.push(`UPDATE products SET rating_avg = ${(sum / nReviews).toFixed(2)}, rating_count = ${nReviews} WHERE id = ${pid};`);
    productIds.push({ id: pid, cat: c.id, onSale });
  });
}

// One running flash sale (ends three days after the seed date) on 8 non-sale products
const flashEnds = new Date(Date.now() + 3 * 86400000).toISOString();
out.push(`INSERT INTO flash_sales (id,title,percent,starts_at,ends_at,status) VALUES (1,'Weekend Flash Sale',20,${q(new Date(Date.now() - 86400000).toISOString())},${q(flashEnds)},'active');`);
productIds.filter((p) => !p.onSale).filter((_, i) => i % 9 === 0).slice(0, 8).forEach((p) => out.push(`INSERT INTO flash_sale_items VALUES (1, ${p.id});`));

// Starter coupons
out.push(`INSERT INTO coupons (code,type,value,min_order,max_discount,status) VALUES ('WELCOME100','fixed',100,1500,NULL,'active');`);
out.push(`INSERT INTO coupons (code,type,value,min_order,max_discount,status) VALUES ('SUTO10','percent',10,2000,500,'active');`);
out.push(`INSERT INTO coupons (code,type,value,min_order,max_discount,status) VALUES ('FREESHIP','free_delivery',0,1500,NULL,'active');`);

const hero = (url) => img(url, 900, 1100);
const settings = {
  store: { name: 'Sutoloka', name_bn: 'সুতোলোকা', tagline: 'Woven for the whole family — সুতোয় বোনা প্রতিদিনের সাজ।', phone: '', phone2: '', email: '', address: 'Dhaka, Bangladesh', facebook: '', instagram: '', whatsapp: '' },
  delivery: { inside_dhaka: 70, sub_dhaka: 100, outside_dhaka: 130, free_over: 3000, inside_days: '1–2 days', outside_days: '2–4 days' },
  offers: { enabled: true, tiers: [{ min_qty: 2, percent: 5 }, { min_qty: 3, percent: 10 }] },
  rewards: { enabled: true, earn_per_100: 1, point_value: 1, max_redeem_percent: 20, min_redeem: 50 },
  sms: { provider: 'none', api_key: '', sender_id: '', url_template: '' },
  courier: { default: 'steadfast', steadfast: { api_key: '', secret_key: '' }, pathao: { client_id: '', client_secret: '', username: '', password: '', store_id: '', sandbox: false }, redx: { token: '', sandbox: false } },
  home: {
    hero: [
      { image: hero(photos.heroes.women), title: 'Festive colours, everyday comfort', subtitle: 'New sarees, three-pieces and kurtis — crafted in Bangladesh.', link: '/category/women', button: 'Shop Women', align: 'left' },
      { image: hero(photos.heroes.men), title: 'The Panjabi Edit', subtitle: 'Tailored panjabis and shirts for every occasion.', link: '/category/men', button: 'Shop Men', align: 'left' },
      { image: hero(photos.heroes.family), title: 'Dress the whole family', subtitle: 'Matching moments for Eid, weddings and weekends.', link: '/shop', button: 'Shop all', align: 'left' },
    ],
    featured_categories: [11, 12, 13, 21, 22, 23, 31, 32, 41],
  },
  announcement: { text: 'Free delivery on orders over ৳3,000 · Cash on delivery all over Bangladesh · 7-day easy exchange', enabled: true },
};
for (const [k, v] of Object.entries(settings)) out.push(`INSERT INTO settings (key,value) VALUES (${q(k)},${q(JSON.stringify(v))});`);

const PAGES = {
  about: ['About Sutoloka', `<p><strong>Sutoloka (সুতোলোকা)</strong> means “the world of thread”. We are a Bangladeshi fashion label for the whole family, designing comfortable, colourful clothing that fits the way we live — from everyday kurtis and polos to festive sarees and panjabis.</p><h3>What we stand for</h3><ul><li>Fabrics chosen for our climate: breathable, soft and easy to care for.</li><li>Fair prices with clear sizing, so you get the right fit the first time.</li><li>Cash on delivery across all 64 districts and a simple 7-day exchange.</li></ul><p>Thank you for choosing Sutoloka.</p>`],
  'shipping-policy': ['Shipping & Delivery', `<h3>Delivery charges</h3><ul><li>Inside Dhaka city: ৳70 (1–2 days)</li><li>Dhaka sub-areas (Savar, Keraniganj, Gazipur, Narayanganj): ৳100 (2–3 days)</li><li>Outside Dhaka: ৳130 (2–4 days)</li><li>Free delivery on orders over ৳3,000.</li></ul><p>We call to confirm every order before shipping. You pay in cash when the parcel arrives.</p>`],
  'return-and-exchange': ['Return & Exchange', `<p>Not the right size or colour? You can exchange within <strong>7 days</strong> of delivery.</p><ul><li>Items must be unused, unwashed and have tags attached.</li><li>Message us with your order number and a photo of the item.</li><li>Inside Dhaka we can pick up from your door; outside Dhaka please send it by courier.</li><li>If an item arrives damaged or wrong, we replace it free of charge.</li></ul><p>Refunds for unavailable exchanges are sent by bKash or Nagad within 3 working days.</p>`],
  'privacy-policy': ['Privacy Policy', `<p>We collect only what we need to deliver your order: your name, phone number, address and order details.</p><ul><li>We never sell or share your information with third parties, except the courier that delivers your parcel.</li><li>Your phone number is used for order updates and, if you sign in, for one-time login codes.</li><li>You can ask us to delete your account and data at any time.</li></ul>`],
  'terms-and-conditions': ['Terms & Conditions', `<ul><li>Prices are in Bangladeshi Taka (৳) and include VAT where applicable.</li><li>Colours may vary slightly due to screen settings and photography lighting.</li><li>We may cancel orders that cannot be confirmed by phone, or that show signs of misuse.</li><li>Coupons and offers cannot be combined unless stated.</li><li>Reward points have no cash value and expire 12 months after they are earned.</li></ul>`],
};
for (const [slug, [title, body]] of Object.entries(PAGES)) out.push(`INSERT INTO pages (slug,title,body) VALUES (${q(slug)},${q(title)},${q(body)});`);

out.push('PRAGMA foreign_keys = ON;');
await writeFile(new URL('db/seed.sql', root), out.join('\n') + '\n');
console.log(`seed.sql: ${CATS.length} categories, ${productIds.length} products, ${vid - 5000} variants, ${rid - 1} reviews`);
