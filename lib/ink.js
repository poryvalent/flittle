// Any selected world opens into another randomly selected world on hover.
// The logo and mascot wear a separate, readable material for each scene.
// Rendering pauses behind the arcade, offscreen and in hidden tabs.
import { neonFragmentShader } from './hero-neon.js';
import { createGrassTexture } from './hero-grass.js';
import { createCloudTexture } from './hero-cloud-texture.js';
import { chooseHeroWorlds, prepareHeroArtwork, prepareHeroFilm, heroVideoFrame, HERO_WORLDS } from './hero-worlds.js';

export function initInkHero({ onProgress = () => {} } = {}) {
  const hero       = document.getElementById('hero');
  const wordBase   = document.getElementById('wordBase');
  const wordSpan   = document.getElementById('wordSpan');
  const textSpans  = Array.from(wordSpan.querySelectorAll('.t'));
  const catBase    = document.getElementById('catBase');
  const baselineEl = document.getElementById('baseline');
  const canvas     = document.getElementById('reveal');
  const cursorEl   = document.getElementById('cursor');
  const cycleButton = hero.querySelector('[data-hero-cycle]');
  const sceneStatus = hero.querySelector('[data-hero-status]');
  const villageImage = hero.querySelector('[data-village-image]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const rotation = chooseHeroWorlds();
  const slots = [rotation.initial, rotation.reveal].map(scene => ({ scene, film: null, aspect: 16 / 9, lastMix: -1, ready: false }));
  const failures = ['', ''];
  let activeSlot = 0;
  let sceneRequest = null, sceneError = '';
  let onScreen = true, running = false, animationFrame = 0;
  let themeValue = 0, wipe = null, wipeFrame = 0;
  function reflectTheme() {
    const scene = slots[activeSlot].scene;
    hero.dataset.world = scene.id;
    document.documentElement.dataset.heroWorld = scene.id;
    hero.querySelectorAll('.hero-world-poster').forEach(poster => {
      poster.dataset.active = String(Number(poster.dataset.slot) === activeSlot);
    });
    if (sceneStatus && !sceneRequest) sceneStatus.textContent = sceneError || `${scene.label} theme`;
    cycleButton?.setAttribute('aria-label', `Change theme. Current theme: ${scene.label}`);
  }
  reflectTheme();

  function settleWithin(promise, timeoutMs) {
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      };
      const timeout = setTimeout(finish, timeoutMs);
      Promise.resolve(promise).then(finish, finish);
    });
  }

  /* ============================================================
     1. The cat that stands in for the "tt" of flittle.
        It is the cat cut out of the logo artwork, traced into flat
        vector shapes in the shared mascot SVG so it stays crisp.
        Both the DOM and ink copies retain the original SVG colours.
        Its size and position come from the logo,
        measured against the height of the letter "l".
     ============================================================ */
  const CAT_URL = new URL('../assets/mascot.svg', import.meta.url).href;
  const CAT_IMG_W = 354, CAT_IMG_H = 361;
  const CAT_H_REL     = 361 / 319;   // cat box height / "l" height
  const CAT_BELOW_REL = 7 / 319;     // cat box bottom below the baseline
  const CAT_GAP_L_REL = 24 / 319;    // gap from the "i" stem to the cat box
  const CAT_GAP_R_REL = 26 / 319;    // gap from the cat box to the "l"
  const catImg = new Image();
  let catReady = false;
  // Reserve the mascot's proportions even if its image request fails.
  catBase.width = CAT_IMG_W;
  catBase.height = CAT_IMG_H;
  // Keep an inline source supplied by the initial HTML available without a request.
  const mascotSource = catBase.getAttribute('src') || CAT_URL;
  catBase.src = mascotSource;
  catImg.src = mascotSource;
  function decodeMascot(img) {
    if (typeof img.decode === 'function') {
      return img.decode().then(() => true, () => img.naturalWidth > 0);
    }
    if (img.complete) return Promise.resolve(img.naturalWidth > 0);
    return new Promise(resolve => {
      const finish = () => {
        img.removeEventListener('load', finish);
        img.removeEventListener('error', finish);
        resolve(img.naturalWidth > 0);
      };
      img.addEventListener('load', finish);
      img.addEventListener('error', finish);
    });
  }
  const mascotAttempt = Promise.all([decodeMascot(catBase), decodeMascot(catImg)])
    .then(([domReady, canvasReady]) => {
      catReady = canvasReady;
      catBase.style.visibility = domReady ? '' : 'hidden';
      drawText();
    });
  // A late decode still redraws above, but it cannot trap the opening screen.
  const mascotReady = settleWithin(mascotAttempt, 4500).then(() => onProgress('mascot'));

  // size the inline cat from the live font metrics (called while the wordmark is at 100px)
  function sizeCat() {
    const cs = getComputedStyle(wordBase);
    tctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    const ml = tctx.measureText('l'), mi = tctx.measureText('i');
    const lH = (ml.actualBoundingBoxAscent || 73) + Math.max(0, ml.actualBoundingBoxDescent || 0);
    const h = CAT_H_REL * lH, w = h * CAT_IMG_W / CAT_IMG_H;
    const rbI = mi.width - mi.actualBoundingBoxRight;   // right side bearing of "i"
    const lbL = -ml.actualBoundingBoxLeft;              // left side bearing of "l"
    catBase.style.height = (h / 100) + 'em';
    catBase.style.width = (w / 100) + 'em';
    catBase.style.verticalAlign = (-(CAT_BELOW_REL * lH) / 100) + 'em';
    catBase.style.marginLeft = ((CAT_GAP_L_REL * lH - rbI) / 100) + 'em';
    catBase.style.marginRight = ((CAT_GAP_R_REL * lH - lbL) / 100) + 'em';
  }

  /* ============================================================
     2. Sizes, trail mask, wordmark texture
     ============================================================ */
  const TRAIL_SCALE = 0.25;
  let W = 1, H = 1, DPR = 1;
  let pixelBudget = 2000000, slowFrames = 0, renderDirty = true, trailDirty = true, trailUntil = 0;
  let nextFrameAt = 0, framesDrawn = 0, lastMaterialTick = -1;

  const trail = document.createElement('canvas');
  let tr = trail.getContext('2d');

  const textCanvas = document.createElement('canvas');
  const tctx = textCanvas.getContext('2d');
  const catBounds = new Float32Array(4);

  function stamp(x, y, r, a) {
    trailDirty = true;
    trailUntil = performance.now() + 4500;
    const sx = x * TRAIL_SCALE, sy = y * TRAIL_SCALE, sr = Math.max(1, r * TRAIL_SCALE);
    const g = tr.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g.addColorStop(0,   `rgba(255,255,255,${a})`);
    g.addColorStop(0.5, `rgba(255,255,255,${a * 0.75})`);
    g.addColorStop(1,   'rgba(255,255,255,0)');
    tr.fillStyle = g;
    tr.beginPath(); tr.arc(sx, sy, sr, 0, Math.PI * 2); tr.fill();
  }

  // Measure layout pixels, not the transformed rectangle: an entrance scale must
  // not be multiplied into the next font size. Short viewports also need a cap.
  function fitWord() {
    if (W <= 0 || H <= 0) return;
    const previousSize = wordBase.style.fontSize;
    wordBase.style.fontSize = '100px';
    sizeCat();
    const measured = getComputedStyle(wordSpan);
    const width = parseFloat(measured.width), height = parseFloat(measured.height);
    if (!(width > 0 && height > 0)) {
      wordBase.style.fontSize = previousSize;
      return;
    }
    wordBase.style.fontSize = (100 * Math.min(W * 0.9 / width, H * 0.72 / height)) + 'px';
    drawText();
  }

  // Charcoal letters + colour cat, precisely aligned with the DOM wordmark.
  function drawText() {
    renderDirty = true;
    const heroRect = hero.getBoundingClientRect();
    if (!(heroRect.width > 0 && heroRect.height > 0)) return;
    textCanvas.width = canvas.width; textCanvas.height = canvas.height;
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tctx.clearRect(0, 0, W, H);
    const cs = getComputedStyle(wordBase);
    tctx.font = `${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
    tctx.fillStyle = cs.color || '#24282c';
    tctx.textBaseline = 'alphabetic';
    if ('fontKerning' in tctx) tctx.fontKerning = 'none';
    const scaleX = heroRect.width / W || 1, scaleY = heroRect.height / H || 1;
    const baseY = (baselineEl.getBoundingClientRect().bottom - heroRect.top) / scaleY;
    const ls = parseFloat(cs.letterSpacing) || 0;
    for (const sp of textSpans) {
      let x = (sp.getBoundingClientRect().left - heroRect.left) / scaleX;
      for (const ch of sp.textContent) {
        tctx.fillText(ch, x, baseY);
        x += tctx.measureText(ch).width + ls;
      }
    }
    const cr = catBase.getBoundingClientRect();
    catBounds.set([(cr.left - heroRect.left) / heroRect.width, (cr.top - heroRect.top) / heroRect.height,
      (cr.right - heroRect.left) / heroRect.width, (cr.bottom - heroRect.top) / heroRect.height]);
    if (catReady) tctx.drawImage(catImg, (cr.left - heroRect.left) / scaleX, (cr.top - heroRect.top) / scaleY, cr.width / scaleX, cr.height / scaleY);
    if (gl) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texText); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas); }
  }

  /* ============================================================
     3. WebGL
     ============================================================ */
  let gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  let prog, uni = {}, texTrail, texText;
  const textures = [];
  let villageFocus = 0.5;

  const VS = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;
  const FS = neonFragmentShader;

  function makeTex(unit) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  }

  if (gl) {
    try {
      const compile = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uTrail', 'uRes', 'uTime', 'uText', 'uCatBounds', 'uBlend', 'uPointer', 'uCaptureMascot', 'uHideMascot',
        'uWipeCenter', 'uWipeRadius', 'uWipeActive',
        ...[0, 1].flatMap(i => ['A', 'B', 'Overlay', 'Kind', 'Aspect', 'Focus', 'Mix', 'Shade', 'Material', 'Layers'].map(key => `uWorld${i}${key}`))]
        .forEach(n => { uni[n] = gl.getUniformLocation(prog, n); });
      texTrail = makeTex(0); texText = makeTex(1);
      gl.uniform1i(uni.uTrail, 0); gl.uniform1i(uni.uText, 1);
      for (let i = 0; i < 2; i++) {
        const unit = 2 + i * 3;
        textures[i] = { a: makeTex(unit), b: makeTex(unit + 1), overlay: makeTex(unit + 2) };
        gl.uniform1i(uni[`uWorld${i}A`], unit);
        gl.uniform1i(uni[`uWorld${i}B`], unit + 1);
        gl.uniform1i(uni[`uWorld${i}Overlay`], unit + 2);
      }
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
    } catch (error) {
      console.warn('The interactive cover is unavailable; using static artwork.', error);
      // Unsupported shader hardware still gets the complete static wordmark.
      gl = null;
    }
  }
  if (!gl) {
    canvas.style.display = 'none';
    hero.classList.add('is-ink-static');
  }

  const filmUploads = new Map();
  function uploadFilm(texture, unit, source) {
    if (!gl || !source) return false;
    // Update at actual video presentation cadence, not a batched quality counter.
    const time = source instanceof HTMLVideoElement ? heroVideoFrame(source) : -1;
    const previous = filmUploads.get(texture);
    if (previous?.source === source && previous.time === time) return false;
    const width = source.videoWidth || source.naturalWidth || source.width;
    const height = source.videoHeight || source.naturalHeight || source.height;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
    if (previous?.width === width && previous.height === height) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    filmUploads.set(texture, { source, time, width, height });
    return true;
  }
  async function prepareScene(scene, { signal } = {}) {
    signal?.throwIfAborted();
    if (scene.kind === 0) {
      if (!villageImage || !await decodeMascot(villageImage)) throw new Error('The village landscape could not load.');
      signal?.throwIfAborted();
      return { scene, image: villageImage, aspect: villageImage.naturalWidth / villageImage.naturalHeight };
    }
    if (scene.kind === 3) {
      const artwork = await prepareHeroArtwork(scene, { signal });
      signal?.throwIfAborted();
      return { scene, artwork, aspect: artwork.aspect };
    }
    const film = await prepareHeroFilm(scene, { signal });
    return { scene, film };
  }

  async function installScene(index, prepared, signal) {
    const { scene, film = null, artwork, image } = prepared;
    let poster = null;
    if (!gl) {
      // Encode a video poster only when there is no live renderer.
      poster = new Image(); poster.className = 'hero-world-poster';
      poster.alt = ''; poster.setAttribute('aria-hidden', 'true');
      poster.dataset.slot = index;
      poster.src = film ? film.poster() : artwork ? artwork.poster() : image ? image.src
        : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><defs><radialGradient id="g"><stop stop-color="#35215a"/><stop offset="1" stop-color="#070e23"/></radialGradient><pattern id="s" width="97" height="113" patternUnits="userSpaceOnUse"><circle cx="18" cy="34" r="1" fill="#d8f7ff"/><circle cx="73" cy="87" r=".6" fill="#9aafff"/></pattern></defs><path fill="url(#g)" d="M0 0h1440v900H0z"/><path fill="url(#s)" d="M0 0h1440v900H0z"/></svg>');
      await poster.decode();
    }
    signal?.throwIfAborted();
    slots[index].film?.dispose();
    if (gl) {
      const { a, b, overlay } = textures[index], unit = 2 + index * 3;
      filmUploads.delete(a); filmUploads.delete(b); filmUploads.delete(overlay);
      if (film) {
        const frame = film.update();
        uploadFilm(a, unit, frame.a); uploadFilm(b, unit + 1, frame.b); uploadFilm(overlay, unit + 2, frame.overlay);
      } else if (artwork) {
        uploadFilm(a, unit, artwork.world); uploadFilm(b, unit + 1, artwork.foreground);
      } else if (image) uploadFilm(a, unit, image);
      // These scenes have no city overlay: reuse that sampler for a cached
      // material map instead of adding textures or per-frame CPU painting.
      if (scene.material === 0) uploadFilm(overlay, unit + 2, createGrassTexture());
      else if (scene.material === 4) uploadFilm(overlay, unit + 2, createCloudTexture(artwork.world));
    }
    hero.querySelector(`.hero-world-poster[data-slot="${index}"]`)?.remove();
    if (poster) hero.prepend(poster);
    slots[index] = { scene, film, aspect: prepared.aspect || 16 / 9, lastMix: -1, ready: true };
    renderDirty = true;
    reflectTheme();
  }

  // Decode both selected scenes during the initial blocks loader. Remote media
  // failure switches to a local world rather than trapping the opening screen.
  const scenesReady = Promise.all(slots.map(async (slot, index) => {
    let prepared;
    try {
      prepared = await prepareScene(slot.scene);
      await installScene(index, prepared);
    } catch (error) {
      prepared?.film?.dispose();
      failures[index] = error.message;
      const fallback = HERO_WORLDS.find(scene => scene.id === 'galaxy');
      await installScene(index, await prepareScene(fallback));
      console.warn('The scene is unavailable; using the local galaxy.', error);
    }
    onProgress(index === 0 ? 'village' : 'world');
  })).then(async () => {
    // Two unavailable remote films must not leave the cover revealing itself.
    if (slots[0].scene.id === slots[1].scene.id) {
      const fallback = HERO_WORLDS.find(scene => scene.id === (slots[0].scene.id === 'galaxy' ? 'village' : 'galaxy'));
      await installScene(1, await prepareScene(fallback));
    }
  });

  /* ============================================================
     4. Resize
     ============================================================ */
  function resize() {
    const width = hero.clientWidth, height = hero.clientHeight;
    // Keep the last valid layout if a host temporarily hides the cover.
    if (width <= 0 || height <= 0) return;
    W = width; H = height;
    villageFocus = villageImage ? parseFloat(getComputedStyle(villageImage).objectPosition) / 100 : 0.5;
    // Bound fragment work on high-DPI/large screens instead of shading millions
    // of extra pixels that add little detail to a background film.
    DPR = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(pixelBudget / (W * H)));
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    renderDirty = true; trailDirty = true;

    // keep the existing blobs across a resize
    const nw = Math.max(2, Math.ceil(W * TRAIL_SCALE)), nh = Math.max(2, Math.ceil(H * TRAIL_SCALE));
    const old = document.createElement('canvas');
    old.width = trail.width; old.height = trail.height;
    if (trail.width > 0 && trail.height > 0) old.getContext('2d').drawImage(trail, 0, 0);
    trail.width = nw; trail.height = nh;
    tr = trail.getContext('2d');
    tr.globalCompositeOperation = 'source-over';
    tr.fillStyle = '#000'; tr.fillRect(0, 0, nw, nh);
    if (old.width > 0 && old.height > 0) tr.drawImage(old, 0, 0, nw, nh);
    tr.globalCompositeOperation = 'lighter';
    if (gl) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texTrail);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trail);
    }

    fitWord();
  }

  /* ============================================================
     5. Pointer / touch / custom cursor
     ============================================================ */
  const pointer = { x: 0, y: 0, px: 0, py: 0, active: false };
  let parallaxX = 0, parallaxY = 0;
  let press = null;
  function otherControl(target) {
    const control = target.closest('button, a, input, select, textarea');
    return control && control !== cycleButton;
  }
  function clearTrail() {
    tr.globalCompositeOperation = 'source-over';
    tr.fillStyle = '#000'; tr.fillRect(0, 0, trail.width, trail.height);
    tr.globalCompositeOperation = 'lighter';
    trailDirty = true; renderDirty = true; trailUntil = 0;
  }
  function setPointer(cx, cy) {
    if (sceneRequest || wipe) return;
    if (!gl || !onScreen || document.hidden || document.documentElement.classList.contains('is-loading')) return;
    const r = hero.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = (cx - r.left) * W / r.width, y = (cy - r.top) * H / r.height;
    const entering = !pointer.active;
    if (entering) { pointer.active = true; pointer.px = x; pointer.py = y; }  // no jump line
    pointer.x = x; pointer.y = y;
    if (reducedMotion.matches) {
      // A direct, still reveal without travel or a trailing loop.
      clearTrail(); stamp(x, y, Math.min(W, H) * .13, 1);
      render(performance.now());
      return;
    }
    wake();
  }
  function endPointer() {
    pointer.active = false;
    if (reducedMotion.matches) { clearTrail(); render(performance.now()); }
  }
  hero.addEventListener('pointermove', e => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) press.dragged = true;
    if (otherControl(e.target)) { endPointer(); cursorEl.classList.remove('on'); return; }
    if (e.pointerType !== 'touch' && !document.documentElement.classList.contains('is-loading')) {
      cursorEl.classList.add('on');
      setPointer(e.clientX, e.clientY);
    }
  });
  hero.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch' && !document.documentElement.classList.contains('is-loading')) cursorEl.classList.add('on'); });
  hero.addEventListener('pointerleave', () => { endPointer(); cursorEl.classList.remove('on'); });
  hero.addEventListener('touchstart', e => { if (otherControl(e.target)) return; const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchmove',  e => { if (otherControl(e.target)) return; const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchend',   endPointer, { passive: true });
  hero.addEventListener('touchcancel',endPointer, { passive: true });

  hero.addEventListener('pointerdown', e => {
    if (otherControl(e.target)) return;
    press = { x: e.clientX, y: e.clientY, scroll: window.scrollY, dragged: !e.isPrimary };
    if (e.pointerType !== 'touch') setPointer(e.clientX, e.clientY);
  });
  hero.addEventListener('pointercancel', () => { if (press) press.dragged = true; });
  document.addEventListener('pointerdown', () => hero.classList.remove('has-theme-keyboard-focus'), { passive: true });
  document.addEventListener('keydown', e => {
    if (['Tab', 'Enter', ' '].includes(e.key)) hero.classList.add('has-theme-keyboard-focus');
  });

  window.addEventListener('pointermove', e => {
    if (!onScreen || document.hidden || document.documentElement.classList.contains('is-loading')) return;
    cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  }, { passive: true });
  /* ============================================================
     6. Frame loop (runs only while the cover is on screen)
     ============================================================ */
  const drops = [];
  let last = performance.now(), start = last, phase = 0, vx = 0, vy = 0;

  function frame(now) {
    animationFrame = 0;
    if (!gl || reducedMotion.matches || !onScreen || document.hidden || document.documentElement.classList.contains('is-loading')) { running = false; return; }
    // The short wipe owns its frame submission; don't render the same frame twice.
    if (wipe) { animationFrame = requestAnimationFrame(frame); return; }
    // Keep 120/144Hz displays from doubling the cost of background effects.
    if (now < nextFrameAt - .5) { animationFrame = requestAnimationFrame(frame); return; }
    nextFrameAt = Math.max(nextFrameAt + 1000 / 60, now);
    const interval = now - last;
    const dt = Math.min(48, now - last) / 16.667;
    last = now;
    if (!sceneRequest) slowFrames = interval > 23 && interval < 100 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
    if (slowFrames > 45 && pixelBudget > 850000) {
      pixelBudget = Math.max(850000, Math.round(pixelBudget * .72));
      slowFrames = 0; resize();
    }

    // fade the mask
    if (trailUntil > now || pointer.active) {
      tr.globalCompositeOperation = 'source-over';
      tr.fillStyle = `rgba(0,0,0,${0.022 * dt})`;
      tr.fillRect(0, 0, trail.width, trail.height);
      tr.globalCompositeOperation = 'lighter'; trailDirty = true;
    } else if (trailUntil) clearTrail();
    phase += 0.03 * dt;

    const base = Math.min(W, H) * 0.075;
    if (pointer.active) {
      const dx = pointer.x - pointer.px, dy = pointer.y - pointer.py;
      const dist = Math.hypot(dx, dy);
      vx += (dx - vx) * 0.25; vy += (dy - vy) * 0.25;
      const speed = Math.hypot(vx, vy);
      const rad = base + Math.min(speed, 60) * 1.6 + Math.sin(phase * 2.3) * base * 0.15;
      if (dist >= 0.5) {
        const steps = Math.max(1, Math.ceil(dist / (rad * 0.25)));
        for (let i = 1; i <= steps; i++) { const k = i / steps; stamp(pointer.px + dx * k, pointer.py + dy * k, rad, 0.22); }
      } else {
        stamp(pointer.x, pointer.y, base * 1.1, 0.06);   // resting cursor keeps its blob alive
      }
      if (speed > 8 && Math.random() < 0.12 * dt) {
        const ang = Math.atan2(vy, vx) + Math.PI + (Math.random() - 0.5) * 2.2;
        const sp = 1 + Math.random() * 2;
        drops.push({ x: pointer.x + Math.cos(ang) * rad * 1.3, y: pointer.y + Math.sin(ang) * rad * 1.3,
                     vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: base * (0.18 + Math.random() * 0.25), life: 1 });
      }
      pointer.px = pointer.x; pointer.py = pointer.y;
    } else {
      vx *= 0.9; vy *= 0.9;
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.96; d.vy *= 0.96; d.life -= 0.012 * dt;
      if (d.life <= 0) { drops.splice(i, 1); continue; }
      stamp(d.x, d.y, d.r, 0.35 * Math.max(0, d.life));
    }

    render(now, false);
    animationFrame = requestAnimationFrame(frame);
  }

  // Also used by readiness and intro exit, so resolving ready means the newly
  // sized text texture has actually been submitted to the renderer.
  function render(now, force = true) {
    const mix = themeValue = activeSlot;
    const pointerX = pointer.active && !reducedMotion.matches ? pointer.x / W - .5 : 0;
    const pointerY = pointer.active && !reducedMotion.matches ? pointer.y / H - .5 : 0;
    parallaxX += (pointerX - parallaxX) * .07; parallaxY += (pointerY - parallaxY) * .07;
    const canPlay = !!gl && onScreen && !document.hidden && !reducedMotion.matches && !document.documentElement.classList.contains('is-loading');
    const revealing = !!wipe || trailUntil > now || pointer.active;
    const visible = [mix < .999 || revealing, mix > .001 || revealing];
    let filmChanged = false;
    slots.forEach((slot, index) => {
      slot.film?.setPlaying(canPlay && visible[index]);
      const frame = slot.film?.update();
      if (!gl) return;
      const name = `uWorld${index}`;
      if (frame && visible[index]) {
        const { a, b, overlay } = textures[index], unit = 2 + index * 3;
        const aChanged = uploadFilm(a, unit, frame.a), bChanged = uploadFilm(b, unit + 1, frame.b);
        uploadFilm(overlay, unit + 2, frame.overlay);
        filmChanged = filmChanged || aChanged || bChanged || frame.mix !== slot.lastMix;
        slot.lastMix = frame.mix;
        slot.aspect = frame.a.videoWidth / frame.a.videoHeight;
      }
      gl.uniform1f(uni[name + 'Kind'], slot.scene.kind);
      gl.uniform1f(uni[name + 'Aspect'], slot.aspect);
      gl.uniform1f(uni[name + 'Focus'], slot.scene.kind === 0 ? villageFocus : slot.scene.focus ?? .5);
      gl.uniform1f(uni[name + 'Mix'], frame?.mix || 0);
      gl.uniform2f(uni[name + 'Layers'], frame?.overlay ? frame.overlayA : 0, frame?.overlay ? frame.overlayB : 0);
      gl.uniform1f(uni[name + 'Shade'], slot.scene.shade || 0);
      gl.uniform1f(uni[name + 'Material'], slot.scene.material);
    });
    if (gl) {
      // The cloud world has no movie frame to invalidate its drifting material.
      // Give its material a 30 fps clock; film surfaces follow decoded frames.
      const materialTick = Math.floor(now / (1000 / 30));
      const materialChanged = canPlay && materialTick !== lastMaterialTick
        && slots.some((slot, index) => visible[index] && slot.scene.kind === 3);
      const animating = canPlay && (revealing || (mix > .001 && mix < .999)
        || slots.some((slot, index) => visible[index] && slot.scene.kind < 2)
        || Math.abs(parallaxX - pointerX) + Math.abs(parallaxY - pointerY) > .001);
      if (!force && !renderDirty && !trailDirty && !filmChanged && !materialChanged && !animating) return;
      if (trailDirty) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texTrail);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, trail);
        trailDirty = false;
      }
      gl.uniform2f(uni.uRes, canvas.width, canvas.height);
      gl.uniform1f(uni.uTime, reducedMotion.matches ? 0 : (now - start) / 1000);
      gl.uniform1f(uni.uBlend, mix);
      gl.uniform1f(uni.uWipeActive, wipe ? 1 : 0);
      gl.uniform2f(uni.uWipeCenter, wipe?.x || 0, wipe?.y || 0);
      gl.uniform1f(uni.uWipeRadius, wipe?.radius || 0);
      gl.uniform2f(uni.uPointer, reducedMotion.matches ? 0 : parallaxX, reducedMotion.matches ? 0 : parallaxY);
      gl.uniform1f(uni.uHideMascot, document.documentElement.classList.contains('has-arcade-handoff') ? 1 : 0);
      gl.uniform4fv(uni.uCatBounds, catBounds);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      renderDirty = false; lastMaterialTick = materialTick; framesDrawn++;
    }
  }

  function refresh() {
    resize();
    render(performance.now());
  }

  // The arcade resolves into the exact current material, not a blue mascot
  // that would flash into stone/wood/chrome one frame after the handoff.
  function captureMascot() {
    if (!gl || !catReady) return catBase;
    render(performance.now());
    gl.uniform1f(uni.uCaptureMascot, 1);
    gl.uniform1f(uni.uBlend, activeSlot);
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 6);
    const x = Math.max(0, Math.floor(catBounds[0] * canvas.width));
    const y = Math.max(0, Math.floor((1 - catBounds[3]) * canvas.height));
    const width = Math.min(canvas.width - x, Math.ceil((catBounds[2] - catBounds[0]) * canvas.width));
    const height = Math.min(canvas.height - y, Math.ceil((catBounds[3] - catBounds[1]) * canvas.height));
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const output = document.createElement('canvas'); output.width = width; output.height = height;
    const ctx = output.getContext('2d'), data = ctx.createImageData(width, height);
    for (let row = 0; row < height; row++) data.data.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), (height - row - 1) * width * 4);
    // WebGL returns premultiplied colors; ImageData expects straight alpha.
    for (let i = 0; i < data.data.length; i += 4) if (data.data[i + 3] > 0 && data.data[i + 3] < 255) {
      const scale = 255 / data.data[i + 3];
      data.data[i] *= scale; data.data[i + 1] *= scale; data.data[i + 2] *= scale;
    }
    ctx.putImageData(data, 0, 0);
    gl.uniform1f(uni.uCaptureMascot, 0); render(performance.now());
    return output;
  }

  function switchSlot(index) {
    activeSlot = index;
    try { sessionStorage.setItem('flittle-last-world', slots[index].scene.id); } catch { /* Optional history. */ }
    reflectTheme();
    pointer.active = false;
    clearTrail(); drops.length = 0; vx = vy = 0;
    render(performance.now());
    wake();
  }

  function finishSceneRequest(request) {
    if (sceneRequest !== request) return;
    sceneRequest = null;
    cycleButton.setAttribute('aria-disabled', String(!!wipe)); cycleButton.removeAttribute('aria-busy');
    reflectTheme();
  }
  async function prepareNextScene() {
    if (sceneRequest || wipe) return;
    const current = slots[activeSlot].scene;
    const next = rotation.next(current), destination = 1 - activeSlot;
    const request = new AbortController(); sceneRequest = request; sceneError = '';
    cycleButton.setAttribute('aria-disabled', 'true'); cycleButton.setAttribute('aria-busy', 'true');
    sceneStatus.textContent = `Preparing ${next.label}.`;
    pointer.active = false;
    clearTrail(); drops.length = 0; vx = vy = 0;
    let prepared = null;
    try {
      // Prepare the next preview immediately after each change, not on the click.
      if (slots[destination].scene.id !== next.id) {
        prepared = await prepareScene(next, { signal: request.signal });
        request.signal.throwIfAborted();
        await installScene(destination, prepared, request.signal);
        prepared = null;
      }
      request.signal.throwIfAborted();
      failures[destination] = '';
    } catch (error) {
      prepared?.film?.dispose();
      if (error.name !== 'AbortError') {
        failures[destination] = error.message;
        // A failed movie must not make click-to-change unresponsive.
        const fallback = HERO_WORLDS.find(scene => scene.id === (current.id === 'galaxy' ? 'village' : 'galaxy'));
        try {
          prepared = await prepareScene(fallback, { signal: request.signal });
          await installScene(destination, prepared, request.signal);
        } catch (fallbackError) {
          if (fallbackError.name !== 'AbortError') sceneError = 'The next theme is unavailable. Please try again.';
        }
      }
    } finally { finishSceneRequest(request); }
  }

  function finishWipe() {
    if (!wipe) return;
    const destination = wipe.destination;
    cancelAnimationFrame(wipeFrame); wipeFrame = 0;
    wipe = null;
    hero.classList.remove('is-theme-changing');
    hero.classList.add('has-theme-changed');
    hero.querySelectorAll('.hero-world-poster').forEach(poster => {
      poster.style.removeProperty('display'); poster.style.removeProperty('clip-path'); poster.style.removeProperty('z-index');
    });
    switchSlot(destination);
    void prepareNextScene();
  }

  function animateWipe(now) {
    if (!wipe) return;
    if (document.hidden || !onScreen || reducedMotion.matches) { finishWipe(); return; }
    const progress = Math.min(1, (now - wipe.started) / 500);
    // Fast response at the cursor, then a soft landing beyond the farthest corner.
    const eased = 1 - Math.pow(1 - progress, 2);
    const maximum = Math.hypot(Math.max(wipe.x, 1 - wipe.x), Math.max(wipe.y, 1 - wipe.y) * H / W) + 6 / W;
    wipe.radius = wipe.initial + (maximum - wipe.initial) * eased;
    wipe.progress = progress;
    if (gl) render(now);
    else {
      const poster = hero.querySelector(`.hero-world-poster[data-slot="${wipe.destination}"]`);
      if (poster) {
        poster.style.display = 'block'; poster.style.zIndex = '1';
        poster.style.clipPath = `circle(${wipe.radius * W}px at ${wipe.x * 100}% ${wipe.y * 100}%)`;
      }
    }
    if (progress >= 1) finishWipe();
    else wipeFrame = requestAnimationFrame(animateWipe);
  }

  cycleButton?.addEventListener('click', e => {
    if (sceneRequest || wipe || document.documentElement.classList.contains('is-loading')) return;
    // Dragging the preview or swiping to scroll is not a theme selection.
    if (e.detail && press && (press.dragged || Math.abs(window.scrollY - press.scroll) > 8)) { press = null; return; }
    const rect = hero.getBoundingClientRect();
    const x = e.detail ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : .5;
    const y = e.detail ? Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) : .5;
    press = null;
    if (slots[1 - activeSlot].scene.id === slots[activeSlot].scene.id) { void prepareNextScene(); return; }
    wipe = { x, y, destination: 1 - activeSlot, started: performance.now(), progress: 0,
      initial: e.detail && e.pointerType !== 'touch' ? Math.min(W, H) * .065 / W : 0, radius: 0 };
    cycleButton.setAttribute('aria-disabled', 'true');
    hero.classList.add('is-theme-changing');
    pointer.active = false; clearTrail(); drops.length = 0; vx = vy = 0;
    if (reducedMotion.matches) finishWipe();
    else animateWipe(performance.now());
  });

  function wake() {
    if (running || !gl || reducedMotion.matches || !onScreen || document.hidden || document.documentElement.classList.contains('is-loading')) return;
    running = true;
    last = performance.now();
    nextFrameAt = last; slowFrames = 0;
    animationFrame = requestAnimationFrame(frame);
  }

  function pause() {
    slots.forEach(slot => slot.film?.setPlaying(false));
    cancelAnimationFrame(animationFrame); animationFrame = 0; running = false;
    pointer.active = false;
    cursorEl.classList.remove('on');
    if (reducedMotion.matches) { clearTrail(); render(performance.now()); }
  }

  // The cover scrolls away: stop its rendering until it comes back.
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) wake();
    else pause();
  }, { threshold: 0 }).observe(hero);
  document.addEventListener('flittle:loaded', () => { if (onScreen) wake(); });
  document.addEventListener('flittle:arcade', () => {
    if (wipe) finishWipe();
    if (sceneRequest) { const request = sceneRequest; request.abort(); finishSceneRequest(request); }
    pause();
  });
  document.addEventListener('flittle:handoff', () => render(performance.now()));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (wipe) finishWipe(); pause(); }
    else if (onScreen) wake();
  });
  reducedMotion.addEventListener('change', () => {
    if (wipe) finishWipe();
    pause(); clearTrail(); drops.length = 0;
    vx = vy = 0;
    render(performance.now());
    if (!reducedMotion.matches && onScreen) wake();
  });

  /* ============================================================
     7. Boot
     ============================================================ */
  refresh();
  window.addEventListener('resize', refresh);
  document.addEventListener('flittle:enter', refresh);
  // Includes a hidden/revealed host and container resizes with no window event.
  new ResizeObserver(refresh).observe(hero);
  let fontAttempt = Promise.resolve();
  if (document.fonts && typeof document.fonts.load === 'function') {
    fontAttempt = Promise.resolve().then(() => document.fonts.load('600 100px Fredoka'));
    fontAttempt.then(refresh, () => {});
    // The nonblocking stylesheet can arrive after load() returned no faces.
    // Listen to later font arrivals without waiting for unrelated page fonts.
    document.fonts.addEventListener('loadingdone', refresh);
  }
  const fontReady = settleWithin(fontAttempt, 4500).then(() => onProgress('font'));
  const ready = Promise.all([mascotReady, fontReady, scenesReady]).then(() => new Promise(resolve => {
    requestAnimationFrame(() => {
      refresh();
      // The second frame allows the fully measured DOM wordmark to be painted.
      requestAnimationFrame(() => {
        onProgress('layout');
        if (cycleButton) cycleButton.disabled = false;
        resolve();
      });
    });
  }));
  wake();
  // read-only state for debugging / automated checks
  window.__flittle = { captureMascot, state: () => ({ effect: 'cinematic-worlds', scene: slots[activeSlot].scene.id,
    revealScene: slots[1 - activeSlot].scene.id, slots: slots.map(slot => ({ scene: slot.scene.id, ready: slot.ready, film: slot.film?.state() || null })),
    failures: [...failures], changingScene: !!sceneRequest || !!wipe, preparingScene: !!sceneRequest,
    wipe: wipe ? { x: wipe.x, y: wipe.y, radius: wipe.radius, progress: wipe.progress } : null, sceneError, pixelBudget, framesDrawn,
    activeSlot, blend: themeValue, W, H, DPR, drops: drops.length, active: pointer.active, webgl: !!gl, onScreen, running, reducedMotion: reducedMotion.matches }) };
  return { ready, refresh };
}
