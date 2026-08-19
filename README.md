# DaisySMS Portal

A customer-facing portal built on three revenue streams: renting DaisySMS verification
numbers, browsing/buying numbers by country+service through DaisySim, and selling
bulk-uploaded account credentials (Instagram, Twitch, VPN, etc.) from a wallet-funded
marketplace. Built with Next.js (App Router) and Supabase (Postgres + Auth).

## What's included

- **Login / signup** — Supabase email+password auth.
- **Light/dark mode** — toggle in the top bar; remembers your choice.
- **Sidebar navigation** — Dashboard, Numbers, All Countries, Marketplace, Logs, Top
  up for customers; Overview, Categories, Product Templates, Bulk Upload, Customers,
  Top-ups, Announcements, Roles, Settings for admins.
- **Customer dashboard** — wallet balance and recent rentals at a glance.
- **Numbers** (`/dashboard/purchase`) — rent a DaisySMS number by service shortcode,
  poll for the code in real time, mark done or cancel & refund.
- **All Countries** (`/dashboard/countries`) — the DaisySim-backed flow: pick a
  country, then a service, then a live price tier, buy, and poll for the code. Two
  independent Numbers providers, each with its own admin on/off toggle.
- **Marketplace** (`/dashboard/marketplace`) — browse products by category, buy with
  wallet balance, and get the account credentials delivered immediately from the
  admin's uploaded stock.
- **Logs** (`/dashboard/logs`) — full history: number rentals from both providers,
  marketplace orders (credentials revealed on demand), and wallet activity.
- **Top-up page** — customer submits a manual top-up request (amount + reference);
  admin approves it. Automatic payment gateway is a placeholder for later (the
  approve step is one isolated code path, so it's a single swap).
- **Wallet** — every user gets one automatically on signup; balance stored in cents.
- **Pop-up messages** — admin publishes an announcement, shown as a dismissible modal
  to every signed-in user.
- **Admin — Categories** (`/admin/categories`) — create/edit/delete categories that
  group product templates (matches the "Add New Category" flow you sketched).
- **Admin — Product Templates** (`/admin/product-templates`) — create sellable
  products (name, category, price in ₦, description).
- **Admin — Bulk Upload** (`/admin/bulk-upload`) — pick a product template, upload a
  CSV of account credentials; each row becomes one unit of stock. When a customer
  buys that product, they're atomically handed one row and it's marked sold.
- **Admin — overview, customers, top-ups, roles, announcements** — as before, now
  gated to admins only (see below).

## What changed from the previous version

- **Removed the staff portal.** `/admin/*` now requires the `admin` role only — there
  is no `staff` role anymore (removed from the DB enum's usage and the UI). If you
  need a limited-permissions role again later, it's straightforward to reintroduce.
- **Sidebar replaces the old top-nav links.** The top bar is now just brand + theme
  toggle + account menu.

## Currency: ₦ primary, USD for both Numbers providers (admin-controlled)

The wallet, top-ups, and the marketplace are all priced in **₦ (Naira)** —
`wallets.balance_cents` is one NGN-denominated number throughout the app.

Both DaisySMS and DaisySim price numbers in **USD**, so that's converted at the door.
`/admin/settings` has two independent toggles — **Enable Numbers** (DaisySMS) and
**Enable All Countries** (DaisySim) — plus one shared **USD → NGN exchange rate**.
When a customer buys through either provider, the server takes that provider's USD
price, applies `MARKUP_PERCENT`, converts through the exchange rate, and charges the
result in ₦ from the same wallet used everywhere else. Turn a toggle off and that
page tells customers it's unavailable, without touching the other provider or
anything else.

This lives in `app_settings` (a singleton settings row — see
`supabase/003_settings.sql` and `supabase/004_daisysim.sql`), read via
`src/lib/settings.ts`, and applied in `/api/daisysms/rent` and
`/api/daisysim/purchase`. There's no separate USD balance anywhere; it's purely a
conversion step for those two features. `/admin/settings` also shows each provider's
live platform balance (your DaisySMS/DaisySim account balance, in USD) so you can see
at a glance when it's time to top up your own provider accounts.

### Why DaisySim purchases re-fetch the price server-side

DaisySim's `/cancel` only works **2 minutes after purchase**, and never once a code
has arrived — so unlike the DaisySMS flow (which can immediately release a number
back to the provider if something doesn't add up), there's no safety net after the
fact. To avoid ever buying a number the customer's wallet can't actually cover,
`/api/daisysim/purchase` ignores any price the client sends and re-fetches
`/prices` itself immediately before calling `/purchase`, checking affordability
against that fresh, authoritative number.

## Stack

- Next.js 14 (App Router, TypeScript, Server Actions + Route Handlers)
- Supabase (Postgres, Auth, Row Level Security)
- Tailwind CSS (class-based dark mode)
- No Stripe/payment gateway wired up yet — top-ups are manually approved by admin

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run these **in order**: `supabase/schema.sql`,
   `supabase/002_marketplace.sql`, `supabase/003_settings.sql`,
   `supabase/004_daisysim.sql`. Together they create every table, the
   `handle_new_user` trigger (auto-creates a profile + wallet on signup), the
   stock/purchase triggers and RPC function, the ₦/USD settings row (with the two
   provider toggles), the `rentals.provider`/`country` columns, and all Row Level
   Security policies.
3. In Authentication settings, you can leave email confirmation on or off — either
   works with this app (see `src/app/signup/actions.ts`, which handles both cases).
4. Copy your Project URL, anon key, and service role key from Project Settings → API.

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server-only, never exposed to the browser
DAISYSMS_API_KEY=...               # from https://daisysms.io/dashboard/profile
DAISYSIM_API_KEY=...               # from your DaisySim dashboard's Profile page
MARKUP_PERCENT=20                  # % added on top of each provider's price when charging customers
```

**`SUPABASE_SERVICE_ROLE_KEY`, `DAISYSMS_API_KEY`, and `DAISYSIM_API_KEY` are
secrets.** They're only read in server-only code (`src/lib/supabase/admin.ts`,
`src/lib/daisysms.ts`, `src/lib/daisysim.ts`, and API routes) and are never sent to
the browser. Don't prefix them with `NEXT_PUBLIC_`.

## 3. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, sign up, then promote yourself to admin directly in
Supabase's SQL editor (there's no UI for the very first admin, since admin promotion
requires an existing admin):

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

After that, use `/admin/roles` in the app to promote other accounts.

## How the money/roles model works

- **Roles**: `customer` (default on signup) or `admin`. Stored in `profiles.role`.
  Enforced both by Postgres RLS policies and by `src/app/admin/layout.tsx`, which
  gates the entire `/admin/*` section (each page also re-checks, for defense in
  depth).
- **Wallets**: one row per user, balance in integer cents (`wallets.balance_cents`).
  Regular users can only *read* their wallet — all balance changes happen through
  server-side Route Handlers using the Supabase **service role** key (or the
  `purchase_product` Postgres function for marketplace buys), after independently
  verifying who's calling. A malicious client can't hit the Supabase REST API
  directly to credit their own wallet.
- **Ledger**: `wallet_transactions` is an append-only audit trail of every balance
  change (`topup`, `purchase`, `refund`, `adjustment`), linked back to the rental,
  top-up request, or marketplace order that caused it.
- **Number purchases (DaisySMS)**: `/api/daisysms/rent` calculates the customer's
  affordable price cap from their wallet balance, calls DaisySMS's `getNumber` with
  that as `max_price`, then charges `price × (1 + MARKUP_PERCENT/100)` converted to
  ₦. If the charge would exceed the balance (a race condition edge case), the number
  is released back to DaisySMS immediately.
- **Number purchases (DaisySim)**: `/api/daisysim/purchase` re-fetches `/prices`
  itself (see "Why DaisySim purchases re-fetch the price" above), checks
  affordability against that fresh price, then calls `/purchase` and charges based on
  the `amount_charged` DaisySim actually reports. Status polling
  (`/api/daisysim/status`) and cancellation (`/api/daisysim/cancel`) map DaisySim's
  `Waiting`/`Completed`/`Cancelled` states onto the same `rentals.status` values used
  by DaisySMS, so the Logs page shows both providers uniformly.
- **Marketplace purchases**: `/api/marketplace/purchase` calls the `purchase_product`
  Postgres function (see `supabase/002_marketplace.sql`), which in one atomic
  transaction: locks the wallet row, claims one `available` stock row with
  `FOR UPDATE SKIP LOCKED` (so two simultaneous buyers can never get the same
  account), marks it `sold`, debits the wallet, and records the order. The
  credentials are returned once at purchase time and can be re-fetched later
  (owner-only) via `/api/marketplace/order-credentials`.
- **Bulk upload**: `/api/admin/stock/upload` parses the CSV server-side
  (`src/lib/csv.ts`, a small dependency-free parser), validates each row (`password`
  required; `email` or `username` required), and bulk-inserts valid rows as
  `product_stock_items`. Invalid rows are skipped and reported back with reasons.
- **Top-ups**: currently manual only — a customer submits a request, an admin
  approves it via `/api/admin/topup/approve`, which credits the wallet. To add a real
  payment gateway later, keep the `topup_requests` → approve → credit-wallet shape,
  but auto-approve+credit from your payment webhook instead of requiring a human.

## Project layout

```
src/
├── middleware.ts              # refreshes the Supabase session, gates /dashboard /admin
├── lib/
│   ├── supabase/client.ts     # browser Supabase client (anon key)
│   ├── supabase/server.ts     # server Supabase client (anon key + session cookie)
│   ├── supabase/admin.ts      # SERVER-ONLY service-role client
│   ├── daisysms.ts            # SERVER-ONLY DaisySMS API wrapper
│   ├── daisysim.ts            # SERVER-ONLY DaisySim API wrapper
│   ├── settings.ts            # SERVER-ONLY reads the app_settings singleton row
│   ├── csv.ts                 # SERVER-ONLY dependency-free CSV parser
│   ├── auth.ts                # requireUser() / requireRole() helpers
│   └── types.ts
├── components/
│   ├── Navbar.tsx / ThemeToggle.tsx / Sidebar.tsx / PopupAnnouncement.tsx
│   ├── TopupQueue.tsx / RoleManager.tsx / AnnouncementManager.tsx / SettingsForm.tsx
│   ├── AdjustBalanceForm.tsx  # admin-only manual wallet adjustment
│   ├── CustomerDetail.tsx     # shared "page for each customer" view
│   ├── CategoryManager.tsx / ProductTemplateManager.tsx / BulkUploadForm.tsx
│   └── MarketplaceBrowser.tsx / OrderRevealButton.tsx
└── app/
    ├── login/ signup/
    ├── dashboard/
    │   ├── purchase/          # Numbers (DaisySMS)
    │   ├── countries/         # All Countries (DaisySim) -- country/service/tier wizard
    │   ├── marketplace/ logs/ topup/
    │   └── layout.tsx         # adds the sidebar
    ├── admin/                 # layout gates on admin role + adds the sidebar; + settings/
    └── api/
        ├── daisysms/          # rent / status / done / cancel
        ├── daisysim/          # services / prices / purchase / status / cancel
        ├── webhooks/daisysim/ # receives DaisySim's code.received push
        ├── marketplace/       # purchase / order-credentials
        └── admin/             # role, topup approve/reject, wallet adjust, settings,
                                # categories, product-templates, stock/upload
```

## CSV format for bulk upload

Required: `password`, and at least one of `email` / `username`.
Optional: `email_password`, `two_fa` (or `two_fa_code`), `recovery_email`,
`recovery_email_password`.

```csv
email,username,password,two_fa,recovery_email
user1@example.com,,Passw0rd!,123456,backup1@example.com
,cooluser2,AnotherPass!,,
```

## DaisySim webhook (optional, speeds up code delivery)

The All Countries flow works purely by polling `/api/daisysim/status` every 5
seconds, so the webhook is optional. If you want codes to land faster and with less
polling load, set your webhook URL in the DaisySim dashboard (Settings → Webhook URL)
to:

```
https://<your-domain>/api/webhooks/daisysim
```

That route (`src/app/api/webhooks/daisysim/route.ts`) updates the matching rental as
soon as DaisySim pushes a code, so the next poll (or the next page load) picks it up
immediately. DaisySim's docs don't describe a signing secret for these webhooks, so
this endpoint can't cryptographically verify the sender — it mitigates that by only
ever updating a rental that already exists, belongs to DaisySim, and is still
`waiting`. See the comment at the top of that file for the full reasoning; ask
DaisySim support if they support a shared-secret header if you want stronger
guarantees.

## Notes / next steps

- **Payment gateway**: top-ups are manual-only for now, as requested. Swap in Stripe
  Checkout, a crypto processor, etc. by adding a webhook route that calls the same
  wallet-credit logic used in `/api/admin/topup/approve`.
- **Service catalog for Numbers**: the purchase page currently takes a free-text
  service shortcode (matching DaisySMS's own docs, which link to their Services
  page). If you want a dropdown of services with live prices instead, wire up
  `daisysms.getPrices()`/`getPricesVerification()` (already implemented) into a
  catalog page.
- **Production**: run `npm run build && npm run start`, or deploy to Vercel/any Node
  host. Set the same environment variables there.
