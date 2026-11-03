import { PROJECTS } from './projects.js';

function bounded(promise, ms = 8000) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    Promise.resolve(promise).catch(() => {}).finally(() => { clearTimeout(timer); resolve(); });
  });
}

// Decode the actual page imagery while the visitor plays, not on the first scroll.
const images = [...document.querySelectorAll('.os img')];
for (const source of new Set(PROJECTS.map(project => project.image))) {
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
  images.push(image);
}
const decoded = images.map(image => bounded(image.decode ? image.decode() : Promise.resolve()));
const fonts = document.fonts ? bounded(document.fonts.ready) : Promise.resolve();
const video = document.getElementById('bgVideo');
const videoReady = !video || video.readyState >= 2 ? Promise.resolve() : new Promise(resolve => {
  const done = () => {
    clearTimeout(timer);
    video.removeEventListener('loadeddata', done);
    video.removeEventListener('error', done);
    resolve();
  };
  const timer = setTimeout(done, 3500);
  video.addEventListener('loadeddata', done, { once: true });
  video.addEventListener('error', done, { once: true });
  video.preload = 'auto';
});

export const siteAssetsReady = Promise.allSettled([...decoded, fonts, videoReady]);
