# طاير | TAIR - Egyptian Sneaker & Streetwear Marketplace

Marketplace demo (buy + sell) for sneakers and streetwear in Egypt. Arabic-first RTL with English toggle, dark/light themes, virtual try-on in the browser, cash-on-delivery checkout, seller dashboard, order tracking, and 30 features mapped from competitor research.

**Live:** https://tair-store.pages.dev

## Stack

- Vanilla HTML/CSS/JS single-page app (no framework, no build step)
- Cloudflare Pages (static) + Pages Functions + D1 (backend phase)
- Generated product imagery (AI), converted to WebP
- PWA: manifest + service worker

## Features (30)

See the live "ليه طاير؟" page (`#/features`) for the full numbered list with the competitor weakness each feature answers.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

```bash
npx wrangler pages deploy . --project-name tair-store --branch main
```

## Honest limits

- Demo project: products, prices, and orders are fictional.
- Payment is cash-on-delivery only; the card option is a labeled demo.
- Virtual try-on is an approximate 2D overlay processed in-browser (photos never leave the device), not a real size measurement.
