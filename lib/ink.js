// The flittle opening cover. Draws the gooey ink reveal: a trail mask painted by the pointer, a
// WebGL quad that shows the ink video, the white letters and the colour cat inside the blobs, with
// boiling noise edges, a ghost rim, droplets and a velocity glitch on the wordmark. The loop runs
// only while the cover is on screen; the two background videos pause when it is not.
export function initInkHero({ onProgress = () => {} } = {}) {
  const hero       = document.getElementById('hero');
  const wordBase   = document.getElementById('wordBase');
  const wordSpan   = document.getElementById('wordSpan');
  const textSpans  = Array.from(wordSpan.querySelectorAll('.t'));
  const catBase    = document.getElementById('catBase');
  const baselineEl = document.getElementById('baseline');
  const canvas     = document.getElementById('reveal');
  const cursorEl   = document.getElementById('cursor');
  const vids       = [document.getElementById('bgVideo'), document.getElementById('bgVideo2')];

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
        The DOM copy is desaturated with a CSS filter for the black
        & white resting page; the full-colour copy is painted inside
        the ink blobs. Its size and position come from the logo,
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

  const trail = document.createElement('canvas');
  let tr = trail.getContext('2d');

  const textCanvas = document.createElement('canvas');
  const tctx = textCanvas.getContext('2d');

  function stamp(x, y, r, a) {
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

  // white letters + colour cat, drawn glyph by glyph so it sits exactly over the DOM wordmark
  function drawText() {
    textCanvas.width = canvas.width; textCanvas.height = canvas.height;
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tctx.clearRect(0, 0, W, H);
    const cs = getComputedStyle(wordBase);
    tctx.font = `${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
    tctx.fillStyle = '#fff';
    tctx.textBaseline = 'alphabetic';
    if ('fontKerning' in tctx) tctx.fontKerning = 'none';
    const heroRect = hero.getBoundingClientRect();
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
    if (catReady) tctx.drawImage(catImg, (cr.left - heroRect.left) / scaleX, (cr.top - heroRect.top) / scaleY, cr.width / scaleX, cr.height / scaleY);
    if (gl) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texText); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas); }
  }

  /* ============================================================
     3. WebGL
     ============================================================ */
  let gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  let prog, uni = {}, texTrail, texVideo, texText, texVideoNext;

  const VS = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;
  const FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTrail, uVideo, uVideoNext, uText;
uniform float uMix, uTime, uHasVideo;
uniform vec2 uRes, uVideoRes, uTextOff;

vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float trailAt(vec2 uv){ return texture2D(uTrail, vec2(uv.x, 1.0 - uv.y)).r; }
vec2 coverUv(vec2 uv){
  float sr = uRes.x / uRes.y;
  float vr = uVideoRes.x / uVideoRes.y;
  vec2 s = sr > vr ? vec2(1.0, vr / sr) : vec2(sr / vr, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main(){
  vec2 uv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.25;
  vec2 n  = vec2(snoise(uv*asp*3.2 + vec2(t, -t)), snoise(uv*asp*3.2 + vec2(-t, t) + 17.0));
  vec2 n2 = vec2(snoise(uv*asp*9.0 + t*2.0),       snoise(uv*asp*9.0 - t*2.0 + 5.0));
  vec2 wuv = uv + n*0.03 + n2*0.006;                       // boiling organic edge

  float v = trailAt(wuv);
  float mask = smoothstep(0.42, 0.445, v);
  float vg = trailAt(wuv + vec2(-0.008, 0.010));
  float rim = smoothstep(0.33, 0.35, vg) * (1.0 - mask);  // offset ghost halo

  float e = 1.5 / uRes.x;
  vec2 grad = vec2(
    trailAt(wuv + vec2(e*4.0, 0.0)) - trailAt(wuv - vec2(e*4.0, 0.0)),
    trailAt(wuv + vec2(0.0, e*4.0)) - trailAt(wuv - vec2(0.0, e*4.0)));
  vec2 vuv = coverUv(uv + grad*0.06);                       // liquid refraction at the edges
  vuv.y = 1.0 - vuv.y;

  vec3 vid = mix(texture2D(uVideo, vuv).rgb, texture2D(uVideoNext, vuv).rgb, uMix);
  vec3 fb = mix(vec3(0.10, 0.25, 1.0), vec3(1.0, 0.15, 0.6), smoothstep(0.1, 0.6, uv.x + n.x*0.2));
  fb = mix(fb, vec3(1.0, 0.55, 0.1), smoothstep(0.55, 0.95, uv.x + n.y*0.2));
  vid = mix(fb, vid, uHasVideo);
  vid = pow(vid, vec3(0.92)) * 1.06;

  vec2 tuv = vec2(uv.x, 1.0 - uv.y);
  vec4 tx  = texture2D(uText, tuv - uTextOff);
  vec4 tx2 = texture2D(uText, tuv - uTextOff*2.2);
  vid = mix(vid, tx2.rgb, tx2.a * 0.35);                    // faint glitch ghost
  vid = mix(vid, tx.rgb,  tx.a);                            // white letters + colour cat

  vec3 rimCol = vec3(0.86, 0.86, 0.90);
  float alpha = mask + rim*0.55;
  vec3 color = vid*mask + rimCol*rim*0.55;
  gl_FragColor = vec4(color, alpha);
}`;

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
      ['uTrail', 'uVideo', 'uVideoNext', 'uMix', 'uRes', 'uVideoRes', 'uTime', 'uHasVideo', 'uText', 'uTextOff']
        .forEach(n => { uni[n] = gl.getUniformLocation(prog, n); });
      texTrail = makeTex(0); texVideo = makeTex(1); texText = makeTex(2); texVideoNext = makeTex(3);
      gl.uniform1i(uni.uTrail, 0); gl.uniform1i(uni.uVideo, 1); gl.uniform1i(uni.uText, 2); gl.uniform1i(uni.uVideoNext, 3);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
    } catch {
      // Unsupported shader hardware still gets the complete static wordmark.
      gl = null;
    }
  }
  if (!gl) {
    canvas.style.display = 'none';
  }

  /* ============================================================
     4. Resize
     ============================================================ */
  function resize() {
    const width = hero.clientWidth, height = hero.clientHeight;
    // Keep the last valid layout if a host temporarily hides the cover.
    if (width <= 0 || height <= 0) return;
    W = width; H = height;
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);

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

    fitWord();
  }

  /* ============================================================
     5. Pointer / touch / custom cursor
     ============================================================ */
  const pointer = { x: 0, y: 0, px: 0, py: 0, active: false };
  function setPointer(cx, cy) {
    const r = hero.getBoundingClientRect();
    const x = (cx - r.left) * W / r.width, y = (cy - r.top) * H / r.height;
    if (!pointer.active) { pointer.active = true; pointer.px = x; pointer.py = y; }  // no jump line
    pointer.x = x; pointer.y = y;
    wake();
  }
  hero.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') setPointer(e.clientX, e.clientY); });
  hero.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') cursorEl.classList.add('on'); });
  hero.addEventListener('pointerleave', () => { pointer.active = false; cursorEl.classList.remove('on'); });
  hero.addEventListener('touchstart', e => { const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchmove',  e => { const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchend',   () => { pointer.active = false; }, { passive: true });
  hero.addEventListener('touchcancel',() => { pointer.active = false; }, { passive: true });

  let playedOnGesture = false;
  hero.addEventListener('pointerdown', e => {
    if (!playedOnGesture) { playedOnGesture = true; tryPlay(vids[cur]); }
    if (e.pointerType !== 'touch') setPointer(e.clientX, e.clientY);
  });

  window.addEventListener('pointermove', e => { cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; }, { passive: true });
  hero.querySelectorAll('.pill, .nav a').forEach(el => {
    el.addEventListener('pointerenter', () => cursorEl.classList.add('big'));
    el.addEventListener('pointerleave', () => cursorEl.classList.remove('big'));
  });

  /* ============================================================
     6. Seamless video loop (two players, 1.4 s cross-fade)
     ============================================================ */
  const FADE = 1.4;
  let cur = 0, mix = 0, hasVideo = 0, vidW = 16, vidH = 9;
  function tryPlay(v) {
    if (document.documentElement.classList.contains('is-loading') || document.hidden) return;
    const p = v.play(); if (p && p.catch) p.catch(() => {});
  }
  vids.forEach(v => {
    v.addEventListener('playing', () => { hasVideo = 1; if (v.videoWidth) { vidW = v.videoWidth; vidH = v.videoHeight; } });
  });
  function updateVideo() {
    const A = vids[cur], B = vids[1 - cur];
    const d = A.duration;
    if (!hasVideo || !d || !isFinite(d)) return;
    if (A.currentTime >= d - FADE || A.ended) {
      if (B.paused) { B.currentTime = 0; tryPlay(B); }
      mix = Math.min(1, (A.currentTime - (d - FADE)) / FADE);
      if (A.ended) mix = 1;
    }
    if (A.ended || mix >= 1) { A.pause(); cur = 1 - cur; mix = 0; }
  }
  function uploadVideo(unit, tex, v) {
    if (v.readyState < 2) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v); }
    catch (err) { hasVideo = 0; }
  }
  tryPlay(vids[0]);

  /* ============================================================
     7. Frame loop (runs only while the cover is on screen)
     ============================================================ */
  const drops = [];
  let last = performance.now(), start = last, phase = 0, vx = 0, vy = 0, offX = 0, offY = 0;
  let onScreen = true, running = false;

  function frame(now) {
    if (!onScreen || document.hidden || document.documentElement.classList.contains('is-loading')) { running = false; return; }
    const dt = Math.min(48, now - last) / 16.667;
    last = now;

    // fade the mask
    tr.globalCompositeOperation = 'source-over';
    tr.fillStyle = `rgba(0,0,0,${0.022 * dt})`;
    tr.fillRect(0, 0, trail.width, trail.height);
    tr.globalCompositeOperation = 'lighter';
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

    // glitch offset of the white wordmark
    offX += (vx * 0.35 - offX) * 0.12;
    offY += (vy * 0.12 - offY) * 0.12;

    render(now);
    requestAnimationFrame(frame);
  }

  // Also used by readiness and intro exit, so resolving ready means the newly
  // sized text texture has actually been submitted to the renderer.
  function render(now) {
    updateVideo();
    if (gl) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texTrail);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trail);
      if (hasVideo) {
        uploadVideo(1, texVideo, vids[cur]);
        if (mix > 0) uploadVideo(3, texVideoNext, vids[1 - cur]);
      }
      gl.uniform1f(uni.uMix, mix);
      gl.uniform2f(uni.uRes, canvas.width, canvas.height);
      gl.uniform2f(uni.uVideoRes, hasVideo ? vidW : 16, hasVideo ? vidH : 9);
      gl.uniform1f(uni.uTime, (now - start) / 1000);
      gl.uniform1f(uni.uHasVideo, hasVideo);
      gl.uniform2f(uni.uTextOff, offX / W, offY / H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  function refresh() {
    resize();
    render(performance.now());
  }

  function wake() {
    if (running || !onScreen || document.hidden || document.documentElement.classList.contains('is-loading')) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // The cover scrolls away: stop the loop and the videos until it comes back.
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) { if (hasVideo) tryPlay(vids[cur]); wake(); }
    else { vids.forEach(v => v.pause()); pointer.active = false; }
  }, { threshold: 0 }).observe(hero);
  document.addEventListener('flittle:loaded', () => { if (onScreen) { tryPlay(vids[cur]); wake(); } }, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) vids.forEach(v => v.pause());
    else if (onScreen) { tryPlay(vids[cur]); wake(); }
  });

  /* ============================================================
     8. Boot
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
  const ready = Promise.all([mascotReady, fontReady]).then(() => new Promise(resolve => {
    requestAnimationFrame(() => {
      refresh();
      // The second frame allows the fully measured DOM wordmark to be painted.
      requestAnimationFrame(() => {
        onProgress('layout');
        resolve();
      });
    });
  }));
  wake();
  // read-only state for debugging / automated checks
  window.__flittle = { state: () => ({ hasVideo, mix, cur, W, H, DPR, drops: drops.length, active: pointer.active, webgl: !!gl, onScreen, running }) };
  return { ready, refresh };
}
