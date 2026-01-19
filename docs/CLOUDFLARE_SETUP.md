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
   - Create a local file called `listings.json` with this content:
     `{ "generated_at": 0, "listings": [] }`
   - Upload it to the bucket path `snapshots/listings.json`.
7. In R2, open **CORS** settings and allow your Pages domain (example: `https://your-project.pages.dev`).

## Step 3 - Create the D1 database
1. In Cloudflare Dashboard, click **D1**.
2. Click **Create database**.
3. Name it `bike-marketplace-linkoping`.
4. Open the new database and click **Console**.
5. Open `db/schema.sql` from your project folder and copy its contents.
6. Paste the SQL into the D1 Console and run it.

## Step 4 - Create a Turnstile widget
1. In Cloudflare Dashboard, click **Turnstile**.
2. Click **Add site**.
3. Name it `bike-marketplace-linkoping`.
4. Add your domain (you can add the Cloudflare Pages domain now and your custom domain later).
5. Save it and copy the **Site Key** and **Secret Key**.

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
   - `PUBLIC_R2_BASE_URL` = your R2 public URL (example: `https://<bucket>.r2.dev`)
   - `TURNSTILE_SECRET_KEY` = your Turnstile secret key
   - `TOKEN_HASH_SALT` = a long random string (use a password manager)
   - `IP_HASH_SALT` = a long random string (different from the token salt)
   - `ADMIN_EMAILS` = your email from Cloudflare Access (optional, but recommended)

## Step 8 - Update frontend config
1. Open `assets/config.js`.
2. Set:
   - `turnstileSiteKey` to your Turnstile **Site Key**
   - `listingsUrl` to `${PUBLIC_R2_BASE_URL}/snapshots/listings.json`
3. Save and push the change to GitHub.

## Step 9 - Protect /admin with Cloudflare Access
1. In Cloudflare Dashboard, click **Zero Trust** (you may need to enable it once).
2. Go to **Access** -> **Applications** -> **Add an application**.
3. Choose **Self-hosted**.
4. Add your Pages domain and set the path to `/admin`.
5. Create an access policy so only you can log in.

## Step 10 - Test the site
1. Open your Pages URL on a phone and on a computer.
2. Create a test listing.
3. Check that images and listings appear.
4. Open the dashboard using the seller token.

If anything fails, double-check the environment variables and bindings in Steps 6 and 7.
