import { PROJECTS } from './projects.js';
import { trackSiteTask } from './site-readiness.js';

function imageReady(image) {
  if (typeof image.decode === 'function') return image.decode();
  if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject(new Error(`An image could not load: ${image.currentSrc || image.src}`));
  return new Promise((resolve, reject) => {
    const cleanup = () => { image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error(`An image could not load: ${image.currentSrc || image.src}`)); };
    image.addEventListener('load', loaded, { once: true });
    image.addEventListener('error', failed, { once: true });
  });
}

// Decode the same sources used by the dashboard and portfolio. A missing image
// is a retryable failure, rather than a timer silently declaring it prepared.
const images = [...document.querySelectorAll('.os img')];
for (const source of new Set(PROJECTS.map(project => project.image))) {
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
  images.push(image);
}
const decoded = trackSiteTask('images', () => Promise.all(images.map(imageReady)));

function fontStylesReady() {
  const link = document.getElementById('site-fonts');
  if (link?.dataset.fontLoad === 'failed') return Promise.resolve(false);
  if (!link || link.media === 'all') return Promise.resolve(true);
  return new Promise(resolve => {
    const cleanup = () => { link.removeEventListener('load', loaded); link.removeEventListener('error', failed); };
    const loaded = () => { cleanup(); resolve(true); };
    const failed = () => { cleanup(); resolve(false); };
    link.addEventListener('load', loaded, { once: true });
    link.addEventListener('error', failed, { once: true });
  });
}
const fonts = trackSiteTask('fonts', async () => {
  // document.fonts.ready alone may resolve before the nonblocking stylesheet
  // arrives, so wait for that stylesheet and request the actual faces first.
  if (!await fontStylesReady() || !document.fonts) return { fallback: 'System fonts are in use because web fonts are unavailable.' };
  const results = await Promise.allSettled([
    document.fonts.load('600 100px Fredoka'),
    document.fonts.load('400 14px "Inter Tight"'),
    document.fonts.load('400 14px "JetBrains Mono"'),
    document.fonts.ready,
  ]);
  if (results.some(result => result.status === 'rejected')) return { fallback: 'Some web fonts are unavailable; readable system fonts are in use.' };
});

export const siteAssetsReady = Promise.all([decoded, fonts]);
// boot.js starts this work before main's remote module graph has loaded.
// main still observes the rejection, but a blocked module is not an unhandled
// promise rejection while the local readiness UI is already reporting it.
siteAssetsReady.catch(() => {});
