# Sutoloka-E-Commerce

Sutoloka (সুতোলোকা) — a Bangladesh-ready fashion store with its own admin panel, running entirely on Cloudflare.

| Part | What it is | Runs on |
|---|---|---|
| **Store** (`store/`) | Customer website: catalogue, filters, search, wishlist, reviews, cart, COD checkout, SMS-code accounts, reward points, order tracking | Cloudflare Worker (Hono, server-rendered HTML + Tailwind) |
| **Admin** (`admin/`, opens at **/admin**) | Staff dashboard: orders, courier booking, products & stock, flash sales, coupons, customers, reviews, follow-ups, reports, settings, staff roles | Same Worker as the store: API at `/admin/api`, React app built into `store/public/admin` |
| **Database** | Products, orders, customers, settings | Cloudflare D1 (`sutoloka-db`) |
| **Images** | Uploaded product / banner / review photos | Cloudflare R2 (`sutoloka-media`), served at `/media/...` by the store |
| `shared/` | Pricing, delivery zones, 64 districts, order creation, SMS — used by both | |

Fonts: Poppins (+ Hind Siliguri for Bangla). Money is whole Taka. Times are shown in Bangladesh time.

## Run it on your computer

```bash
npm install
npm run db:reset        # creates the local database with the demo catalogue
npm run dev             # store: http://localhost:8787   admin: http://localhost:8787/admin
```

Local secrets live in `store/.dev.vars` (not committed). With `DEV_MODE=1`, the
customer login code is shown on screen instead of being sent by SMS.

## Put it online (Cloudflare)

```bash
npx wrangler login      # opens your browser to connect your Cloudflare account
npm run deploy          # creates database + image storage, loads demo data, deploys both sites
```

The script prints your address (`*.workers.dev`). Open `<address>/admin` first and create the owner account.
Run `npm run deploy` again after any code change — your data is never overwritten.

### Use your own domain

1. Add the domain to your Cloudflare account (DNS managed by Cloudflare).
2. Edit `deploy.config.json` and add, for example:
   ```json
   "storeDomain": "yourbrand.com"
   ```
   The admin is then at `https://yourbrand.com/admin`.
3. Run `npm run deploy` again. Cloudflare creates the DNS records and HTTPS certificates.

Recommended: protect the `/admin` path with **Cloudflare Access** (Zero Trust → Access → Applications) so only your
staff emails can even see the login page, and use a strong owner password.

## After launch — in the admin panel

- **Settings → Store**: hotline, email, Facebook/Instagram, WhatsApp number.
- **Settings → Delivery**: inside/outside Dhaka charges and the free-delivery threshold.
- **Settings → Courier** (owner): Steadfast / Pathao / RedX API keys. Test each once with a real parcel.
- **Settings → SMS** (owner): BulkSMSBD or any gateway with a send URL. Needed for customer login codes and
  back-in-stock messages. Without it, customers can still order as guests.
- **Products**: the demo products use free Unsplash photos. Archive them and add your own.
- **Staff & roles**: owner (everything), manager (catalogue, reports, settings), staff (orders and customers).

## Useful commands

| Command | Does |
|---|---|
| `npm run seed:demo` | Rebuilds `db/seed.sql` (demo catalogue) |
| `npm run db:reset` | Wipes and reloads the **local** database |
| `npm run typecheck` | Checks all TypeScript |
| `npm run build` | Builds store CSS and the admin app |

## Not included yet

- Online payments (bKash, Nagad, SSLCommerz) — checkout is cash on delivery; advance payments can be recorded on an order.
- Courier integrations were written from the couriers' API documentation and need a test with real merchant keys.
