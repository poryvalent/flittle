// One pool of worlds, with no day/night categories. Only the two visible/reveal
// scenes are kept prepared; films stay on their original hosts.
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
const film = name => CDN + name + '.mp4';
const videoClocks = new WeakMap();

// A frame callback keeps off-DOM video decoding at its real presentation rate.
// Polling playback-quality counters alone can batch updates and skip visible frames.
export function heroVideoFrame(video) {
  return videoClocks.get(video)?.version ?? video.currentTime;
}

export const HERO_WORLDS = Object.freeze([
  { id: 'village', kind: 0, label: 'Sunlit village', material: 0 },
  { id: 'wonder', kind: 3, label: 'Through the looking glass', material: 4,
    layers: 'wonder' },
  { id: 'galaxy', kind: 1, label: 'Neon galaxy', material: 1 },
  { id: 'web3', kind: 2, label: 'Event horizon', material: 2,
    video: film('hf_20260217_030345_246c0224-10a4-422c-b324-070b7c0eceda'), shade: .5 },
  { id: 'moxly', kind: 2, label: 'Rose nebula', material: 5,
    video: 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/62d1c4b6-faa9-4164-b790-8780c7cd6db9.mp4',
    loopFade: 1, shade: .06 },
  { id: 'sellix', kind: 2, label: 'Violet orbit', material: 6,
    video: film('hf_20260912_104036_bd6924f6-3c8e-417e-8465-6d03c8c2e9e6'), loopFade: .9, shade: .06 },
]);

function pick(items) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return items[Math.floor(values[0] / 4294967296 * items.length)];
}
export function chooseHeroWorlds() {
  // A named scene is a shareable preview, not a separate rendering path.
  const requested = new URLSearchParams(location.search).get('scene');
  const explicit = HERO_WORLDS.find(scene => scene.id === requested);
  let previous = '';
  try { previous = sessionStorage.getItem('flittle-last-world') || ''; } catch { /* Storage may be blocked. */ }
  const initial = explicit || pick(HERO_WORLDS.filter(scene => scene.id !== previous));
  try { sessionStorage.setItem('flittle-last-world', initial.id); } catch { /* The choice still works without storage. */ }
  // A shuffled deck visits all remaining scenes before repeating any of them.
  let remaining = HERO_WORLDS.filter(scene => scene.id !== initial.id);
  function next(current = initial) {
    if (!remaining.length) remaining = HERO_WORLDS.filter(scene => scene.id !== current.id);
    const selected = pick(remaining);
    remaining = remaining.filter(scene => scene.id !== selected.id);
    return selected;
  }
  const reveal = next(initial);
  return { initial, reveal, next };
}

let wonderArtwork;
export async function prepareHeroArtwork(scene, { signal } = {}) {
  if (scene.layers !== 'wonder') return null;
  if (wonderArtwork) return wonderArtwork;
  const names = ['world.jpg', 'portal.png', 'curtain-left.png', 'curtain-right.png', 'clouds.png'];
  const images = names.map(name => {
    const image = new Image();
    const ready = readyMedia(image, 'load', signal).then(() => image.decode());
    image.src = new URL(`../assets/worlds/wonder/${name}`, import.meta.url).href;
    return { image, ready };
  });
  await Promise.all(images.map(item => item.ready));
  signal?.throwIfAborted();
  const [world, portal, left, right, clouds] = images.map(item => item.image);
  // Compose the opened portal once. The renderer gives this foreground gentle
  // pointer parallax; there is no second canvas animation loop or scroll trap.
  const foreground = document.createElement('canvas');
  foreground.width = 1920; foreground.height = 1080;
  const ctx = foreground.getContext('2d'), w = foreground.width, h = foreground.height;
  const scale = 2.3;
  ctx.drawImage(portal, w * (1 - scale) / 2, h * (1 - scale) / 2, w * scale, h * scale);
  ctx.drawImage(left, -w * .64, 0, w, h);
  ctx.drawImage(right, w * .64, 0, w, h);
  ctx.globalAlpha = .6;
  ctx.drawImage(clouds, 0, h * .82, w, w * clouds.height / clouds.width);
  wonderArtwork = { world, foreground, aspect: w / h, poster() {
    const poster = document.createElement('canvas'); poster.width = w; poster.height = h;
    const pctx = poster.getContext('2d');
    pctx.drawImage(world, 0, 0, w, h); pctx.drawImage(foreground, 0, 0);
    return poster.toDataURL('image/jpeg', .88);
  } };
  return wonderArtwork;
}

function readyMedia(media, event, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('The background film took too long to prepare.')), 14000);
    const loaded = () => finish();
    const failed = () => finish(new Error('The background film could not load.'));
    const aborted = () => finish(new DOMException('Scene change cancelled.', 'AbortError'));
    function finish(error) {
      clearTimeout(timer); media.removeEventListener(event, loaded); media.removeEventListener('error', failed);
      signal?.removeEventListener('abort', aborted);
      error ? reject(error) : resolve(media);
    }
    media.addEventListener(event, loaded, { once: true });
    media.addEventListener('error', failed, { once: true });
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) aborted();
  });
}

export async function prepareHeroFilm(scene, { signal } = {}) {
  if (!scene.video) return null;
  const videos = [];
  function makeVideo(url) {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous'; video.muted = true; video.defaultMuted = true;
    video.playsInline = true; video.preload = 'auto'; video.loop = false;
    video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    if (video.requestVideoFrameCallback) {
      const clock = { version: 0, callback: 0 };
      const tick = () => {
        clock.version++;
        clock.callback = video.requestVideoFrameCallback(tick);
      };
      clock.callback = video.requestVideoFrameCallback(tick);
      videoClocks.set(video, clock);
    }
    const ready = readyMedia(video, 'canplaythrough', signal).then(() => { video.pause(); return video; });
    video.src = url; video.load(); videos.push(video);
    return { video, ready };
  }
  const first = makeVideo(scene.video), second = makeVideo(scene.video);
  const intro = scene.intro ? makeVideo(scene.intro) : null;
  const overlay = scene.overlay ? new Image() : null;
  let overlayReady = Promise.resolve();
  if (overlay) {
    overlay.crossOrigin = 'anonymous';
    overlayReady = readyMedia(overlay, 'load', signal).then(() => overlay.decode());
    overlay.src = scene.overlay;
  }
  function dispose() {
    for (const video of videos) {
      const clock = videoClocks.get(video);
      if (clock) { video.cancelVideoFrameCallback(clock.callback); videoClocks.delete(video); }
      video.pause(); video.removeAttribute('src'); video.load();
    }
    if (overlay) overlay.src = '';
  }
  try {
    await Promise.all([first.ready, second.ready, intro?.ready, overlayReady]);
    signal?.throwIfAborted();
  } catch (error) { dispose(); throw error; }

  let active = 0, entering = Boolean(intro), crossing = false, playing = false, blocked = false;
  let blend = 0;
  const loop = [first.video, second.video];
  const play = video => {
    if (!video || !playing || blocked || !video.paused) return;
    video.play()?.catch(error => {
      // A quick scroll/arcade return can pause a pending play promise. That is
      // ordinary lifecycle cancellation, not an autoplay permission failure.
      if (error.name === 'AbortError') return;
      blocked = true; videos.forEach(item => item.pause());
    });
  };
  function sources() {
    return entering
      ? { a: intro.video, b: loop[active], overlayA: 0, overlayB: 1 }
      : { a: loop[active], b: loop[1 - active], overlayA: 1, overlayB: 1 };
  }
  function setPlaying(value) {
    if (value === playing) return;
    playing = value;
    if (!value) videos.forEach(video => video.pause());
    else { const { a, b } = sources(); play(a); if (crossing) play(b); }
  }
  function update() {
    const { a, b } = sources();
    const end = entering ? a.duration : Math.min(a.duration, scene.loopEnd || a.duration);
    const fade = Math.min(scene.loopFade || .72, end * .45), remaining = end - a.currentTime;
    if (playing && !blocked && remaining <= fade && !crossing) {
      crossing = true; b.currentTime = 0; play(b);
    }
    blend = crossing ? Math.min(1, Math.max(0, (fade - remaining) / fade)) : 0;
    if (crossing && (remaining <= .035 || a.ended)) {
      a.pause(); a.currentTime = 0;
      if (entering) entering = false; else active = 1 - active;
      crossing = false; blend = 0;
    }
    return { ...sources(), mix: blend, overlay };
  }
  return {
    scene, update, setPlaying, dispose,
    state: () => ({ ready: true, playing: playing && !blocked, phase: entering ? 'arrival' : 'loop',
      blocked, blend, times: videos.map(video => Number(video.currentTime.toFixed(2))),
      presentedFrames: videos.map(video => videoClocks.get(video)?.version ?? null),
      activeVideos: videos.filter(video => !video.paused).length }),
    poster() {
      const source = intro?.video || first.video;
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = Math.round(1280 * source.videoHeight / source.videoWidth);
      const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      if (!intro && overlay) ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(0,0,0,${scene.shade || 0})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', .85);
    },
  };
}
