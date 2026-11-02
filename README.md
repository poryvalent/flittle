# flittle

The flittle website: one page, plain HTML, CSS and ES modules, no build step.

```bash
npx serve .        # then open the printed URL
```

Any static server works. Open it in Chrome, Edge or Safari: the cover's two background videos are HEVC, which Firefox does not decode (the cover falls back to its gradient there).

## What is on the page

1. **Cover** (`index.html` → `.ink-hero`, `hero.css`, `lib/ink.js`): the flittle wordmark with the mascot cat, grey at rest; moving the pointer reveals the colour and the video through ink blobs.
2. **Story** (`style.css`, `tokens.css`, `lib/cloud.js`, `cursor.js`, `liquid.js`, `scroll.js`, `frame.js`, `reveal.js`, `veil.js`, `tone.js`): the point-cloud bust that follows the pointer, the pinned zoom-out with the flying widgets, then the Services and Approach screens.
3. **Work** (`lib/orbit.js`, `lib/hold.js`, `lib/projects.js`): the bust bursts into dust and its surviving points become the stars of the orbit, a sphere with the project cards around it. The page freezes on this section: the wheel spins the orbit, drag turns it, hover reads a project, click opens it, and the two arrows in the pill at the bottom leave it.
4. **Contact** (`lib/contact.js`): "Let's work together"; clicking it brings in the booking button.

## Things to fill in

- `lib/projects.js`: the real projects. Each entry takes `title`, `client`, `year`, `url` and `image`. The 24 entries there now are placeholders with stock photos.
- `lib/contact.js`: `EMAIL` and `BOOK_URL` at the top. The email is a placeholder; while `BOOK_URL` is empty the button writes an email instead.

## Deploying

The repo deploys on Vercel as plain static files. `vercel.json` sets the framework to "Other" (`framework: null`), which overrides the project's old Next.js preset, so there is no install or build step and the repo root is served as is. Vercel only deploys commits whose author is a member of the Vercel account that owns the project; a commit from anyone else shows up on GitHub as "Deployment was blocked" and the owner has to redeploy it or add that person to the team.

## Notes

- Sizes are design pixels (`--u` in `tokens.css`), so the layout keeps its proportions at any width; the phone layout kicks in under 768 px.
- The bust model is three.js's `Zaghetto.pcd`, loaded from the three.js repository; the fonts come from Google Fonts and jsDelivr; three.js comes from jsDelivr through the import map in `index.html`.
- `favicon.svg`, `favicon-32.png` and `apple-touch-icon.png` are the mascot cat from the wordmark.
- `window.__flittle.state()` and `window.__kin` are exposed for automated checks only.
