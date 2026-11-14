# Trove site

Static marketing and download site, built with Astro. Zero JavaScript ships to the browser.

## Run

```
cd site
npm install
npm run dev        # http://localhost:4321/trove/
npm run build      # writes dist/
npm run check:budget
```

`npm run dev` and `npm run build` first run `scripts/sync.mjs`, which copies from the app: the design tokens (`src/styles/tokens.css`), Inter and Bricolage Grotesque, and the 3D icons the site shows. Those copies are generated and git-ignored; never edit them.

## What is read at build time

- `release-notes/*.md` of the app: the changelog page.
- The GitHub API (latest release and star count): the download page and the proof line. Set `GITHUB_TOKEN` to avoid rate limits. If the API fails, the page falls back to a link to the releases.

## Screenshots

`src/assets/shots/*-light.png` come from the app's browser preview, at 2x:

```
npx vite --config vite.preview.config.ts        # in the repo root, port 1421
SCALE=2 preview/shoot.sh site/src/assets/shots light overview transactions flow cards
```

Astro turns them into AVIF and WebP at build time. They are committed, so the site does not need the preview to build.

## Deploy

`.github/workflows/site.yml` publishes `dist/` to GitHub Pages at `https://lucasinstra.github.io/trove/`. One-time setup in the repository: Settings, Pages, Source: GitHub Actions.

With a domain of its own, set `SITE_URL` and `SITE_BASE=/` in the build step and update `public/robots.txt`.

## Languages

`/` is Portuguese and `/en/` is English, both from `src/i18n/pt.ts` and `en.ts` (the English file is typed against the Portuguese one, so a missing key fails the build). The changelog shows the release notes as written, in English.
