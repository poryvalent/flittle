# flittle

The flittle website: one page, plain HTML, CSS and ES modules, no build step.

```bash
npx serve .        # then open the printed URL
```

Any static server works. Open it in Chrome, Edge or Safari: the cover's two background videos are HEVC, which Firefox does not decode (the cover falls back to its gradient there).

## What is on the page

1. **Entrance and cover** (`index.html`, `intro.css`, `lib/intro.js`, `lib/intro-game.js`, `lib/preload.js`, `hero.css`, `lib/boot.js`, `lib/ink.js`): animated neon blocks appear while the site's images, fonts, model, project textures and GPU effects prepare. Once ready, a pixel “Begin your journey” button opens the falling-letter game directly. Arrow keys or WASD steer and rotate seven pixel letters; Shift or Space drops them, with touch buttons on phones. Letters spawn above their matching FLITTLE positions, but every move, rotation and stack stays where the player lands it on the visible floor. The finished arrangement glows and reveals a score with a random completion bonus. Skip Game instantly drops the remaining letters while preserving played placements. Enter and Skip release the letters into loose, spinning blocks that bounce and settle on the floor before the homepage appears; reduced motion bypasses the tumble. Entry always resets to the colour cover at the top, clearing restored section anchors and scroll positions. Bounded watchdogs keep entry available if dependencies fail. The game uses local Canvas 2D, preserves placements on resize and disposes its renderer and controls on exit. The hero mascot is embedded in the HTML, and the wordmark refreshes before entry, after font changes and on container resize. Moving the pointer reveals colour and video through ink blobs. `assets/mascot.svg` also supplies the mascot logo in project details.
2. **Story** (`style.css`, `tokens.css`, `lib/cloud.js`, `cursor.js`, `liquid.js`, `scroll.js`, `frame.js`, `reveal.js`, `veil.js`, `tone.js`): the point-cloud bust that follows the pointer, the pinned zoom-out with the flying widgets, then the Services and Approach screens. The dashboard uses a shorter scroll sequence, responsive springs, cached layout measurements and bounded render resolution; its render loops pause behind the entrance and after leaving the scene.
3. **Work** (`lib/orbit.js`, `lib/hold.js`, `lib/focus.js`, `lib/projects.js`): the bust bursts into dust and its surviving points become the stars of the orbit, a sphere with the project cards around it (the projects repeat around the ring until it is full). The page freezes on this section: the wheel spins the orbit, drag turns it, hover reads a project, and a click brings the project into focus: the card flies out to hang in front of the camera under fog and grain while its story decodes in, terminal style, with the links as "[name] ↗". Close, Escape or the backdrop send it back. The two arrows in the pill at the bottom leave the section.
4. **Contact** (`contact.css`, `lib/contact.js`, `lib/contact-art.js`): a simplified Doodle Crew sign-off with the FLITTLE wordmark, interactive hand-drawn characters, and one direct email link. Each letter has its own hover, tap and keyboard animation, independent of its entrance. The crew follows the pointer and responds to clicks or Enter/Space; reduced motion is respected.

## Things to fill in

- `lib/projects.js`: the projects. Each entry takes `title`, `kicker`, `summary`, `body` (paragraphs), `tags`, `links` and `image` (a screenshot in `assets/work/`). Edit the words there; they are the focus column's copy.
- `index.html`: the contact link marked `data-mail`. Update both its `mailto:` URL and visible address when the real inbox is confirmed; `hello@flittle.com` remains the existing placeholder.

## Deploying

The repo deploys on Vercel as plain static files. `vercel.json` sets the framework to "Other" (`framework: null`), which overrides the project's old Next.js preset, so there is no install or build step and the repo root is served as is. Vercel only deploys commits whose author is a member of the Vercel account that owns the project; a commit from anyone else shows up on GitHub as "Deployment was blocked" and the owner has to redeploy it or add that person to the team.

## Notes

- Sizes are design pixels (`--u` in `tokens.css`), so the layout keeps its proportions at any width; the phone layout kicks in under 768 px.
- The bust model is three.js's `Zaghetto.pcd`, served locally from `assets/scene/zaghetto.pcd` along with the dashboard's widget images; the fonts come from Google Fonts and jsDelivr; three.js comes from jsDelivr through the import map in `index.html`.
- `favicon.svg`, `favicon-32.png` and `apple-touch-icon.png` are the mascot cat from the wordmark.
- `window.__flittle.state()`, `window.__kin` and the read-only `window.__flittleIntro.state()` are exposed for automated checks only.
