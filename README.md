# Flittle website

Next.js (App Router) · TypeScript · Tailwind v4 · shadcn/ui · lucide-react.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Pages

| Route | What it is | Main files |
| --- | --- | --- |
| `/` | Ink-reveal hero with the logo as the wordmark, then the main story (point-cloud bust of a person, pinned zoom-out with flying widgets, scroll panels), then the "Let's work together" ending | `src/components/ink-hero.tsx`, `main-story.tsx`, `bust-stage.tsx`, `ui/lets-work-section.tsx` |
| `/work` | A splash, then the eye film (`public/media/eye-intro.mp4`, 2x) dives into the pupil and lands on the archive: a Fibonacci sphere of project covers around a centred headline, drag to rotate, 16vh of scroll to dolly in, a flat grid, a lightbox that flies out of its card, and the page's own header, full-screen menu and cursor | `src/components/work-archive.tsx`, `work-intro.tsx`, `work-chrome.tsx`, `work.css`, `src/lib/projects.ts`, `src/lib/covers.ts` |

The archive's covers are generated SVGs (`src/lib/covers.ts`) drawn from each project record; set `image` on a project to use a real screenshot instead. `public/cat.png` is the cat cut out of the logo for the studio card. The old CSS-drawn eye video stand-ins `public/media/eye.mp4` and the eye poster's original are no longer used by `/work` (the cleaned copy is `eye-intro.mp4`; `eye-poster.jpg` is still the poster frame).

The logo is `public/logo.png`. `public/logo-mark.png` and `logo-white.png` are cut-outs of its wordmark (the opening page draws them, and the white one shows inside the ink). The bust is the `Zaghetto.pcd` point cloud from three.js's examples, kept in `public/models/`.

## Deploying

The site is a plain Next.js app with static routes, so Vercel needs no configuration. Two ways to ship it:

**From this folder (quickest)**

```bash
npx vercel login          # once; opens the browser
npx vercel --prod --yes   # builds on Vercel and prints the live URL
```

**From GitHub (auto-deploys on every push)**

1. Push this repo to GitHub.
2. In Vercel: Add New → Project → import the repo. The Next.js preset is detected; leave the defaults.
3. Every push to `main` deploys production; other branches get preview URLs.

No environment variables are needed. The Google fonts are fetched at build time by `next/font`.

## Placeholders to replace before launch

- **Portfolio**: all 21 projects in `src/lib/projects.ts` are marked samples with generated artwork.
- **Booking link and email**: `BOOKING_URL` and `EMAIL` at the top of `src/components/ui/lets-work-section.tsx`, plus the address in both menus (`src/components/site-chrome.tsx`, `src/components/work-chrome.tsx`).
- **Demo figures**: the widgets and panels in `main-story.tsx` show illustrative data and are labelled as samples. Swap them for real numbers or remove them.
- **Copy**: services are limited to software development. Check the wording in `main-story.tsx` and the "Taking on new projects" status in the ending.
- **Logo**: a vector (SVG) version would be sharper than the PNG.
