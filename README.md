# Embroidery Tracker

Phone app for tracking how long each order has been at the embroidery vendor.

**Flow:** To drop off → At embroidery → Pick up → To ship → Shipped.
Everyone on the team sees the same live list (it refreshes every few seconds).

## Install on a phone

Open the app's web address in Chrome (Android) or Safari (iPhone), then:

- **Android / Chrome:** menu (⋮) → **Install app** (or **Add to Home screen**).
- **iPhone / Safari:** Share → **Add to Home Screen**.

The first time it opens, enter the **team code** and pick your role. The camera button scans the
barcode on the picking slip.

## How it's built

- `index.html`, `manifest.webmanifest`, `sw.js`, icons: the app (plain HTML/JS, hosted on GitHub Pages).
- `config.js`: the address of the server that holds the shared order list.
- `worker/`: the server, a small Cloudflare Worker + D1 database. It checks a **team code** on every request.
  The code is stored as a Worker secret named `TEAM_CODE` and is not in this repository.
  - `worker/schema.sql`: the one table it uses.
  - `worker/test.mjs`: tests (`node worker/test.mjs`, Node 22+).

## Deploying the server yourself

1. `wrangler d1 create embroidery-tracker`, then put the id in `worker/wrangler.toml`.
2. `wrangler d1 execute embroidery-tracker --remote --file worker/schema.sql`
3. `cd worker && wrangler deploy`
4. `wrangler secret put TEAM_CODE`
5. Put the Worker's address in `config.js`.
