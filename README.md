# flittle

The flittle website: one page, plain HTML, CSS and ES modules, no build step.

```bash
npx serve .        # then open the printed URL
```

Any static server works. The cover's interactive scene is generated locally with WebGL and requires no background video downloads or video codecs. Browsers without WebGL keep the complete static wordmark and illustrated cover.

## What is on the page

1. **Entrance, arcade and cover** (`index.html`, `intro.css`, `lib/intro.js`, `lib/intro-invitation.js`, `lib/intro-title.js`, `lib/intro-field.js`, `lib/arcade-runtime.js`, `lib/arcade-art.js`, `lib/arcade-dodge.js`, `lib/arcade-flight.js`, `lib/arcade-action.js`): Neon blocks animate on black while the whole website prepares: cover, decoded images, fonts, sculpture, project textures and GPU effects. The initial progress indicator follows completed tasks; failed essential loads offer Retry Loading. The pixel “Begin your journey” invitation accepts a click or tap anywhere, or Enter/Space. Its actual title pixels glow and gently spring away from the pointer without disappearing. A simple click hint follows the pointer with a fading pixel trail; touch screens show a fixed tap hint. A quiet pixel field responds across the entire invitation, including empty space, then settles when the pointer rests. The invitation shrinks into a brief tile curtain and opens a five-game arcade built with local Canvas 2D. The invitation and games only become available after the cover and heavy website assets are ready.

   | Game | Controls |
   | --- | --- |
   | Star Dodge | Left/right or A/D moves the mascot; drag to move on touch; Space/Shift starts then shield-dashes. Dodge falling blocks and collect stars through five waves. |
   | Flittle Flight | Space, Up, click or tap flaps the mascot through the gaps. |
   | Brick Break | Left/right or A/D moves the paddle; mouse or drag aims it; Space or tap launches the mascot ball. |
   | Cosmic Flittle | Arrows/WASD fly; hold Space to fire; drag and hold to move and fire on touch screens. |
   | Little Runner | Space, Up, click or tap jumps over obstacles. |

   Side arrows, the five selector dots, or Q/E switch games. The opening invitation has no website bypass. A large Enter Website button appears once the arcade opens and stays available during every game and on results; Escape also exits after beginning. Each result keeps this button alongside the score, Play Again and game navigation. Star Dodge has three lives, telegraphed block rows with safe corridors, collectible stars and a rechargeable shield dash.

   Every game exits through `lib/arcade-exit.js` and `lib/arcade-ult.js` with a final power move using the actual game frame and mascot position. Cosmic Flittle charges an ultimate beam and clears the screen with a shockwave, then reveals the prepared homepage directly. Star Dodge uses a shield slam, Flight a pipe-clearing dash, Brick Break a final ricochet, and Runner a hyperdash. There is no second loading screen after the final attack. Real preparation milestones in `lib/site-readiness.js` gate the initial blocks screen instead. Reduced motion skips the attack and curtain.

   First entry opens the colour cover at the top and clears restored section anchors. The fixed Arcade button reopens the last selected game later; leaving that session restores the previous page position and keyboard focus. One game runs at a time: switching, replaying and exiting destroy the old engine, cancel animation frames, remove canvas listeners and release held input. Hidden tabs pause updates; the website's costly scenes pause behind the arcade. Every game fills the viewport, with uniform pixel scaling and safe gameplay bounds around the overlaid controls. Resizing preserves the current round, score and lives.

   The entrance is a labelled modal with keyboard focus contained inside it, labelled game and touch controls, live game/score announcements, an accessible loading progress bar and visible focus indicators. The background is inert while it is open; the hidden arcade cannot intercept input after exit. A failed game still offers direct entry to the prepared website. Readiness timeouts report failure and never declare unfinished graphics ready; retry reloads cleanly without creating duplicate renderers.

   The cover uses `lib/preload.js`, `hero.css`, `lib/boot.js`, `lib/ink.js` and `lib/hero-neon.js`. Its mascot is embedded in the HTML, and the wordmark refreshes before entry, after font changes and on container resize. The letters rest in charcoal and the mascot shows its native colors against the supplied pastel paper texture (`assets/hero-pastel-paper.png`), with soft color swirls, tiny stars, confetti speckles and playful illustrations. The local background image preloads during the entrance and repeats at a bounded size so its details remain small on desktop and phones. The pointer's liquid trail reveals a procedural starfield and endless perspective neon highway. The lettering uses distinct cyan and icy chrome with circuit details, while the mascot keeps its facial features and a clear silhouette outline. These treatments linger and fade with the same water mask. The GPU scene is prepared through the existing cover readiness gate; it requires no media request. Background doodles gently drift and jiggle using staggered CSS transforms; they pause offscreen, behind the arcade, and in hidden tabs. Reduced motion keeps the doodles still and uses a static liquid reveal. Touch works too. `assets/mascot.svg` also supplies the mascot logo in project details.

2. **Story** (`style.css`, `tokens.css`, `lib/cloud.js`, `cursor.js`, `liquid.js`, `scroll.js`, `frame.js`, `reveal.js`, `veil.js`, `tone.js`): the point-cloud bust that follows the pointer, the pinned zoom-out with the flying widgets, then the Services and Approach screens. The bust and dashboard share a short scroll glide that bridges discrete wheel notches without changing native page scrolling. Panel entries ease in and out; pointer motion retains its springs. Moving widgets use solid surfaces and gain a fixed glass treatment once settled; their transforms and opacity update independently. Layout measurements are cached and render resolution is bounded; render loops pause behind the entrance and after leaving the scene. Reduced motion, navigation jumps and layout changes snap the visual scroll position to its destination.
3. **Work** (`lib/orbit.js`, `lib/hold.js`, `lib/focus.js`, `lib/projects.js`): the bust bursts into dust and its surviving points become the stars of the orbit, a sphere with the project cards around it (the projects repeat around the ring until it is full). For a mouse or trackpad, the page freezes on this section: the wheel spins the orbit and drag turns it. Phones retain vertical page scrolling and horizontal orbit dragging. Hover reads a project, and a click brings it into focus: the card flies out to hang in front of the camera under fog and grain while its story decodes in, terminal style, with the links as "[name] ↗". Close, Escape or the backdrop send it back. The two arrows in the pill at the bottom leave the section; on phones the pill stays above browser chrome and the safe area, with a visible Connect with us label.
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
