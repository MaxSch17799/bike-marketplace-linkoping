# Bike Marketplace Linkoping

Static frontend + Cloudflare Pages Functions backend for a simple bike marketplace. No logins, just seller tokens.

## Structure

- `index.html` - single page app (client-side routing)
- `assets/` - CSS, JS, config, placeholder image
- `functions/` - Cloudflare Pages Functions (API endpoints)
- `db/schema.sql` - D1 schema
- `docs/CLOUDFLARE_SETUP.md` - step-by-step Cloudflare setup

## Quick setup

1. Edit `assets/config.js` with your Turnstile site key and `listingsUrl`.
2. Follow the deployment guide in `docs/CLOUDFLARE_SETUP.md`.

## Environment variables (Cloudflare Pages)

- `PUBLIC_R2_BASE_URL` - public base URL for your R2 bucket (images + snapshots)
- `TURNSTILE_SECRET_KEY` - Turnstile secret key
- `TOKEN_HASH_SALT` - long random string for seller token hashing
- `IP_HASH_SALT` - long random string for IP hashing
- `ADMIN_EMAILS` - comma-separated list of admin emails (Cloudflare Access)

## Local development (optional)

If you want to test locally:

1. Install `wrangler` with `npm install -g wrangler`.
2. Fill `wrangler.toml` with your D1 and R2 details.
3. Run `wrangler pages dev .` from the repo root.
