# Performance check (local, 14 Oct 2026)

Measured on a production build (`npm run build && npm start`) in a 4-core cloud container, with PostgreSQL on the same machine. Real numbers on Vercel + Neon will differ (network latency to the database, cold starts), so repeat the Lighthouse check on the live domain after launch.

## Lighthouse (mobile, simulated slow 4G, mid-range phone)

| Page | Performance | Accessibility | Best practices | SEO | First paint | Largest paint | Blocking time | Layout shift | Page weight |
|---|---|---|---|---|---|---|---|---|---|
| Home `/ht` | 97 | 100 | 100 | 100 | 0.9 s | 2.1 s | 180 ms | 0 | 214 KB |
| Store `/ht/store` | 98 | 98 → fixed | 100 | 100 | 0.9 s | 2.0 s | 100 ms | 0 | 203 KB |
| Product `/ht/products/free-fire-diamonds` | 97 | 100 | 100 | 100 | 1.0 s | 2.6 s | 90 ms | 0 | 208 KB |

The two store accessibility notes (heading order, logo link name) were fixed after the run.

## Load test (autocannon, 50 simultaneous users for 15 s per page)

| Page | Requests / second | Median | 99th percentile | Errors |
|---|---|---|---|---|
| Home | ~30 | 1.5 s | 2.2 s | 0 |
| Store | ~30 | 1.5 s | 6.0 s | 0 |
| Product | ~40 | 1.2 s | 1.4 s | 0 |
| `/api/health` | ~600 | 82 ms | 126 ms | 0 |

What this means:
- **One server copy** renders about 30–40 store pages per second. That is roughly 2.5 million page views a day.
- Under 50 simultaneous users, each one waits about 1.5 s, and nothing fails.
- **On Vercel**, extra copies start automatically when traffic grows, so the limit above applies per copy, not to the whole site.
- The limit is page rendering on the CPU, not the database. Settings, footer pages and the session lookup are already cached per request.
- If traffic ever needs it, the next step is caching whole public pages (store, product) for a minute.

## How to repeat

```bash
npx lighthouse https://YOUR-DOMAIN/ht --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo --view
npx autocannon -c 50 -d 15 https://YOUR-DOMAIN/ht    # only against your own site, ideally a preview deployment
```
