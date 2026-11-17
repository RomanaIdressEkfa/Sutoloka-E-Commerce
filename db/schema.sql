-- Sutoloka store schema (Cloudflare D1 / SQLite)
-- Money is stored in whole Taka (INTEGER). Timestamps are ISO-8601 UTC text.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id           INTEGER PRIMARY KEY,
  parent_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  image        TEXT,
  size_chart   TEXT,
  sort         INTEGER NOT NULL DEFAULT 0,
  featured     INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description  TEXT NOT NULL DEFAULT '',
  thumbnail    TEXT,
  featured     INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  seo_title    TEXT,
  min_price    INTEGER NOT NULL DEFAULT 0,   -- denormalised from variants for fast listing/sorting
  max_price    INTEGER NOT NULL DEFAULT 0,
  total_stock  INTEGER NOT NULL DEFAULT 0,
  sold_count   INTEGER NOT NULL DEFAULT 0,
  rating_avg   REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  tags         TEXT NOT NULL DEFAULT '',     -- comma separated (e.g. "eid,cotton,new")
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);

-- Extra categories a product is listed under (e.g. a sub-category)
CREATE TABLE IF NOT EXISTS product_categories (
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_product_categories_cat ON product_categories(category_id);

CREATE TABLE IF NOT EXISTS variants (
  id           INTEGER PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku          TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '',
  size         TEXT NOT NULL DEFAULT '',
  option       TEXT NOT NULL DEFAULT '',     -- third attribute (e.g. "Type")
  price        INTEGER NOT NULL,             -- regular price (৳)
  sale_price   INTEGER NOT NULL,             -- selling price (৳), <= price
  stock        INTEGER NOT NULL DEFAULT 0,
  images       TEXT NOT NULL DEFAULT '[]',   -- JSON array of image paths/URLs
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON variants(sku);

CREATE TABLE IF NOT EXISTS stock_movements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id   INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  change       INTEGER NOT NULL,
  reason       TEXT NOT NULL,                -- order, cancel, return, adjust, restock, import
  ref          TEXT,
  user_id      INTEGER,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_stock_mv_variant ON stock_movements(variant_id, created_at);

CREATE TABLE IF NOT EXISTS customers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL UNIQUE,         -- normalised 01XXXXXXXXX
  email        TEXT,
  address      TEXT,
  district     TEXT,
  notes        TEXT,
  blocked      INTEGER NOT NULL DEFAULT 0,
  points       INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no       TEXT NOT NULL UNIQUE,
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT,
  address        TEXT NOT NULL,
  district       TEXT NOT NULL,
  area           TEXT,
  zone           TEXT NOT NULL CHECK (zone IN ('inside_dhaka','sub_dhaka','outside_dhaka')),
  note           TEXT,
  subtotal       INTEGER NOT NULL,
  delivery_fee   INTEGER NOT NULL,
  discount       INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL,
  advance_paid   INTEGER NOT NULL DEFAULT 0,
  coupon_code    TEXT,
  offer_discount INTEGER NOT NULL DEFAULT 0,   -- bundle / quantity offer
  points_used    INTEGER NOT NULL DEFAULT 0,
  points_earned  INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','returned')),
  courier        TEXT,                       -- steadfast | pathao | redx | other
  consignment_id TEXT,
  tracking_code  TEXT,
  courier_status TEXT,
  source         TEXT NOT NULL DEFAULT 'web', -- web | phone | facebook | admin
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id   INTEGER REFERENCES variants(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  sku          TEXT,
  color        TEXT,
  size         TEXT,
  image        TEXT,
  price        INTEGER NOT NULL,
  qty          INTEGER NOT NULL CHECK (qty > 0),
  total        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE TABLE IF NOT EXISTS order_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,                -- status | note | courier | payment | edit
  message      TEXT NOT NULL,
  user_id      INTEGER,
  user_name    TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);

CREATE TABLE IF NOT EXISTS coupons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  type         TEXT NOT NULL CHECK (type IN ('percent','fixed','free_delivery')),
  value        INTEGER NOT NULL DEFAULT 0,
  min_order    INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,
  starts_at    TEXT,
  ends_at      TEXT,
  usage_limit  INTEGER,
  used         INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,               -- pbkdf2$iterations$salt$hash
  role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','manager','staff')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS pages (
  slug         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL                 -- JSON
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL,
  ip           TEXT,
  ok           INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(email, created_at);

-- ---------- Storefront features ----------
CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id  INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  order_id     INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title        TEXT,
  body         TEXT NOT NULL DEFAULT '',
  photos       TEXT NOT NULL DEFAULT '[]',
  size_bought  TEXT,
  fit          TEXT CHECK (fit IN ('small','true','large') OR fit IS NULL),
  verified     INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','hidden')),
  reply        TEXT,
  helpful      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status);

CREATE TABLE IF NOT EXISTS customer_otps (
  phone        TEXT PRIMARY KEY,
  code_hash    TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  sent_count   INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS addresses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT 'Home',
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  district     TEXT NOT NULL,
  area         TEXT,
  zone         TEXT NOT NULL DEFAULT 'outside_dhaka',
  address      TEXT NOT NULL,
  is_default   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id);

CREATE TABLE IF NOT EXISTS points_ledger (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  change       INTEGER NOT NULL,
  reason       TEXT NOT NULL,                -- earned | redeemed | refund | reversed | adjust
  order_id     INTEGER,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_points_customer ON points_ledger(customer_id);

CREATE TABLE IF NOT EXISTS wishlists (
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS flash_sales (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  percent      INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90),
  starts_at    TEXT NOT NULL,
  ends_at      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS flash_sale_items (
  flash_sale_id INTEGER NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (flash_sale_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_flash_items_product ON flash_sale_items(product_id);

CREATE TABLE IF NOT EXISTS stock_alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id   INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  phone        TEXT NOT NULL,
  notified_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (variant_id, phone)
);

CREATE TABLE IF NOT EXISTS checkout_drafts (
  phone        TEXT PRIMARY KEY,
  name         TEXT,
  district     TEXT,
  items        TEXT NOT NULL DEFAULT '[]',
  subtotal     INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','contacted','converted','dismissed')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
