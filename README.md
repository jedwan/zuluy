# zuluy

A timezone guessing puzzle. The page shows a time; you guess the city. Five tries, distance + direction hints after each. Unlimited puzzles per session — each completed game stacks as a card below.

Plan: `~/.claude/plans/all-five-let-s-do-breezy-waffle.md`.

## Run locally

Requires Node 20+ and pnpm.

```
pnpm install
pnpm dev          # localhost:4321
```

## Build

```
pnpm build        # outputs to dist/
pnpm preview      # serve dist/ locally
```

The build is fully static. Drop `dist/` on any static host.

## Test

```
pnpm test
```

Vitest. Covers timezone resolution, diacritic-insensitive search, haversine + bearing, puzzle picker, share grid composition, stats persistence.

## Verify the cities dataset

```
pnpm verify:cities
```

Runs nine checks against `public/cities.json` — count, capital completeness, timezone coverage, hemisphere balance, `utcOffsetMinutes` integrity against `Intl`, recognitionScore histogram + override consistency, sample local-time spot-checks. Useful after refreshing the dataset.

## Rebuilding the cities catalogue

`public/cities.json` is sourced by exporting Tier-1 + population≥1M + a Zuluy-additions allowlist from the eSalah MySQL database. Requires the eSalah project running locally (`C:\Claude\Projects\esalah\`) with MySQL up.

```
cd ../esalah
pnpm tsx scripts/export-zuluy-cities.ts
```

The script reads two files from this repo:
- `data/recognition-overrides.json` — editorial recognitionScore overrides
- `data/zuluy-additions.json` — culturally iconic cities below the 1M threshold

Output: `public/cities.json` (deterministic — re-runs produce byte-identical files).

## Deploy

Any static host works. Examples:

- **Cloudflare Pages**: connect the repo; build command `pnpm build`; output dir `dist`.
- **Vercel**: `vercel deploy --prod` from project root.
- **Netlify**: drag-drop `dist/` or git-connect.
- **Static server**: `dist/` is self-contained.

Attribution: city data from [GeoNames](https://www.geonames.org/) (CC BY 4.0).
