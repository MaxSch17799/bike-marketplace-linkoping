# Cloudflare setup guide (simple steps)

This guide is written for someone who is not very technical. Follow the steps slowly and you will be fine.

## Step 1 - Create a Cloudflare account
1. Go to https://dash.cloudflare.com and create an account.
2. Verify your email address.

## Step 2 - Create the R2 bucket (stores images and listings.json)
1. In Cloudflare Dashboard, click **R2** in the left menu.
2. Click **Create bucket**.
3. Name it `bike-marketplace-linkoping` (or any name you want).
4. Enable **Public Access** for the bucket (needed for images and `listings.json`).
5. Copy the public URL. It looks like `https://<bucket>.r2.dev` or your custom domain.
6. Create a tiny starter file so the site can load even before any listing exists:
   - A starter file already exists in your project at `snapshots/listings.json`.
   - In the R2 bucket, click **Create folder** and name it `snapshots`.
   - Open the `snapshots` folder and upload the local `snapshots/listings.json` file.
7. In R2, open **CORS** settings and add:
   - **Allowed origins:** your Pages domain (example: `https://your-project.pages.dev`)
   - **Allowed methods:** `GET`, `HEAD`
   - **Allowed headers:** `*`

## Step 3 - Create the D1 database
1. In Cloudflare Dashboard, click **D1**.
2. Click **Create database**.
3. Name it `bike-marketplace-linkoping`.
4. Open the new database and click **Console**.
5. Open `db/schema.sql` from your project folder and copy its contents.
6. Paste the SQL into the D1 Console and run it.

### If you already created the database earlier
Run these extra commands in the D1 Console:

```
ALTER TABLE listings ADD COLUMN image_sizes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE listings ADD COLUMN description TEXT;
ALTER TABLE listings ADD COLUMN delivery_possible INTEGER NOT NULL DEFAULT 0;
ALTER TABLE listings ADD COLUMN delivery_price_sek INTEGER;
ALTER TABLE listings ADD COLUMN currency_mode TEXT NOT NULL DEFAULT 'sek_only';
ALTER TABLE listings ADD COLUMN payment_methods_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE listings ADD COLUMN public_phone_methods_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE buyer_contacts ADD COLUMN buyer_phone_methods_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS usage_monthly (
  period_key TEXT PRIMARY KEY,
  period_start INTEGER NOT NULL,
  class_a_ops INTEGER NOT NULL DEFAULT 0,
  class_b_ops INTEGER NOT NULL DEFAULT 0,
  api_requests INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_monthly_start ON usage_monthly(period_start);
```

If the `ALTER TABLE` line fails, it means the column already exists and you can ignore the error.

## Step 4 - Create a Turnstile widget
1. In Cloudflare Dashboard, use the top search bar and type **Turnstile**.
2. Click **Turnstile** in the results. (If you do not see it, try `https://dash.cloudflare.com/?to=turnstile`.)
3. If you still cannot see it, look under **Security** -> **Turnstile** in the left menu.
4. Click **Add site**.
5. Name it `bike-marketplace-linkoping`.
6. Add your domain (you can add the Cloudflare Pages domain now and your custom domain later).
7. Save it and copy the **Site Key** and **Secret Key**.

## Step 5 - Create a Cloudflare Pages project
1. In Cloudflare Dashboard, click **Pages**.
2. Click **Create a project**.
3. Choose **Connect to Git** and select your GitHub repo:
   `MaxSch17799/bike-marketplace-linkoping`.
4. For **Framework preset**, choose **None**.
5. For **Build command**, leave it empty.
6. For **Build output directory**, set it to `.` (a single dot).
7. Click **Save and Deploy**.

## Step 6 - Bind D1 and R2 to Pages Functions
1. In your Pages project, click **Settings**.
2. Go to **Functions**.
3. Under **D1 database bindings**, add:
   - **Variable name:** `DB`
   - **D1 database:** select your database
4. Under **R2 bucket bindings**, add:
   - **Variable name:** `PUBLIC_BUCKET`
   - **R2 bucket:** select your bucket

## Step 7 - Add environment variables
1. In your Pages project, click **Settings** -> **Environment variables**.
2. Add these variables (production):
   - `PUBLIC_R2_BASE_URL` = your R2 public URL (yours is `https://pub-1b1634891ffc417b84c11bd3eb2b1143.r2.dev`)
   - `TURNSTILE_SECRET_KEY` = your Turnstile secret key
   - `TOKEN_HASH_SALT` = a long random string (use a password manager)
   - `IP_HASH_SALT` = a long random string (different from the token salt)
   - `ADMIN_EMAILS` = your email from Cloudflare Access (optional, but recommended)
3. If you see the message about variables being managed by `wrangler.toml`, that is normal:
   - **Plain vars** like `PUBLIC_R2_BASE_URL` and `ADMIN_EMAILS` must be set in `wrangler.toml` and pushed to GitHub.
   - **Secrets** can still be set in the dashboard. Use **Add variable** and choose **Secret** for:
     `TURNSTILE_SECRET_KEY`, `TOKEN_HASH_SALT`, `IP_HASH_SALT`.
   - If you cannot add a secret because it already exists, remove it from `wrangler.toml` (do not put secrets in Git).

## Step 8 - Update frontend config
1. Open `assets/config.js`.
2. Set:
   - `turnstileSiteKey` to your Turnstile **Site Key**
   - `listingsUrl` to `${PUBLIC_R2_BASE_URL}/snapshots/listings.json`
   - It is already set to your current R2 URL. Update it only if you change the bucket domain.
3. Save and push the change to GitHub.

### If Turnstile stops working after changes
1. Cloudflare Dashboard -> **Turnstile** -> open your widget.
2. Under **Allowed hostnames**, add your Pages domain, for example:
   `bike-marketplace-linkoping.pages.dev`
3. Confirm the **Site Key** in `assets/config.js` matches that widget.
4. In Pages -> **Settings** -> **Environment variables** -> **Secrets**,
   ensure `TURNSTILE_SECRET_KEY` matches the same widget.
5. Save and wait 1-2 minutes, then hard refresh the site.

## Step 9 - Protect /admin with Cloudflare Access
1. In Cloudflare Dashboard, click **Zero Trust** (you may need to enable it once).
2. Go to **Access** -> **Applications** -> **Add an application**.
3. Choose **Self-hosted**.
4. Add your Pages domain and set the path to `/admin`.
5. Add a second public hostname for the same domain with path `/api/admin*` so the API calls are protected too.
6. Create an access policy so only you can log in.

## Step 10 - Test the site
1. Open your Pages URL on a phone and on a computer.
2. Create a test listing.
3. Check that images and listings appear.
4. Open the dashboard using the seller token.

If anything fails, double-check the environment variables and bindings in Steps 6 and 7.
