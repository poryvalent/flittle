// A small, finite survival game. The arcade host owns its clock, canvas, and
// listeners; this model keeps every playable object inside the shared UI bounds.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const remap = (value, fromLow, fromHigh, toLow, toHigh) =>
  toLow + clamp((value - fromLow) / Math.max(1, fromHigh - fromLow), 0, 1) * (toHigh - toLow);
const COLORS = ['#81cfff', '#baa0ff', '#ff9fbd', '#78e6da', '#ffbd81'];
const pixel = (ctx, color, x, y, width, height) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
};
function layout(width = 480, height = 320, bounds) {
  const W = Math.max(120, Number(width) || 480), H = Math.max(120, Number(height) || 320);
  const left = clamp(Number(bounds?.left) || 0, 0, W - 80);
  const top = clamp(Number(bounds?.top) || 0, 0, H - 80);
  const right = clamp(Number(bounds?.right) || W, left + 80, W);
  const bottom = clamp(Number(bounds?.bottom) || H, top + 80, H);
  const area = { left, right, top, bottom, width: right - left, height: bottom - top };
  return { W, H, area, unit: clamp(Math.min(area.width / 340, area.height / 180), .65, 1.2) };
}
function circleRect(player, block) {
  const dx = player.x - clamp(player.x, block.x, block.x + block.width);
  const dy = player.y - clamp(player.y, block.y, block.y + block.height);
  return dx * dx + dy * dy < player.radius * player.radius;
}

export function createDodgeGame(api) {
  let { W, H, area, unit } = layout(api.width, api.height, api.bounds);
  const random = () => clamp((api.random || Math.random)(), 0, .999999);
  const waves = 5, waveDuration = 8, duration = waves * waveDuration;
  const keys = { left: false, right: false, primary: false };
  const player = { x: 0, y: 0, radius: 0, size: 0, facing: 1, invulnerable: 0, dashRemaining: 0, dashCooldown: 0 };
  const obstacles = [], stars = [], particles = [], trail = [];
  const sky = Array.from({ length: 45 }, (_, i) => ({ x: ((i * 137 + 43) % 479) / 480, y: ((i * 71 + 19) % 317) / 320, bright: i % 7 === 0 }));
  let phase = 'created', score = 0, lives = 3, wave = 1, elapsed = 0, clock = 0;
  let spawnIn = .8, gapCenter = .5, collected = 0, dodged = 0, combo = 0, nextId = 0;
  let started = false, destroyed = false, completed = false, pointerDown = false, pointerTarget = null;
  let dashDirection = 1, trailIn = 0, reportedSecond = -1, resizeGrace = 0;

  function sizePlayer() {
    player.size = 34 * unit; player.radius = 9 * unit;
    player.y = area.bottom - player.size / 2 - 4 * unit;
    player.x = clamp(player.x, area.left + player.size / 2, area.right - player.size / 2);
  }
  function progress(message) {
    api.progress({ score, lives, wave, waves, collected, elapsed, duration, message });
  }
  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2, speed = (22 + random() * 75) * unit;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 12 * unit, life: .25 + random() * .3, color });
    }
    if (particles.length > 90) particles.splice(0, particles.length - 90);
  }
  function start() {
    if (destroyed) return;
    started = true; completed = false; phase = 'ready'; score = 0; lives = 3; wave = 1; elapsed = clock = 0;
    spawnIn = .8; gapCenter = .5; collected = dodged = combo = nextId = 0; reportedSecond = -1; resizeGrace = 0;
    player.x = (area.left + area.right) / 2; player.facing = 1;
    player.invulnerable = player.dashRemaining = player.dashCooldown = 0; sizePlayer();
    for (const key of Object.keys(keys)) keys[key] = false;
    pointerDown = false; pointerTarget = null;
    obstacles.length = stars.length = particles.length = trail.length = 0;
    progress('Move to begin. Catch stars and dodge the falling blocks.');
  }
  function launch() {
    if (phase !== 'ready' || destroyed || completed) return false;
    phase = 'playing'; player.invulnerable = .5;
    gapCenter = (player.x - area.left) / area.width;
    progress('Wave 1 / 5. Follow the clear lanes and collect gold stars.');
    return true;
  }
  function dash() {
    if (launch() || phase !== 'playing' || player.dashCooldown > 0) return;
    dashDirection = Number(keys.right) - Number(keys.left) || (pointerTarget !== null && Math.sign(pointerTarget - player.x)) || player.facing;
    player.facing = dashDirection; player.dashRemaining = .22; player.dashCooldown = 2.4;
    player.invulnerable = Math.max(player.invulnerable, .35); trailIn = 0;
    burst(player.x, player.y, '#81cfff', 8);
  }
  function finish(won) {
    if (completed || destroyed) return;
    completed = true; phase = won ? 'won' : 'lost';
    if (won) score += lives * 250;
    progress(won ? 'All five waves cleared. A stellar little escape!' : 'A brave little dodge. Try for another star run.');
    api.complete({ score, title: won ? 'STAR SURVIVOR' : 'NICE LITTLE DODGE' });
  }
  function spawnRow() {
    const lanes = area.width < 260 * unit ? 5 : 7;
    const clear = wave < 3 ? 3 : 2, laneWidth = area.width / lanes;
    const previous = Math.round(gapCenter * lanes - clear / 2);
    // Adjacent rows move their open corridor by at most one lane. Its width is
    // always at least two lanes, with ample travel time between falling rows.
    const gap = clamp(previous + Math.floor(random() * 3) - 1, 0, lanes - clear);
    gapCenter = (gap + clear / 2) / lanes;
    const size = Math.min(32 * unit, laneWidth * .68), warningDuration = .7;
    const fallDuration = 2.65 - wave * .16;
    for (let lane = 0; lane < lanes; lane++) {
      if ((lane >= gap && lane < gap + clear) || random() < .12) continue;
      obstacles.push({ id: nextId++, x: area.left + (lane + .5) * laneWidth - size / 2,
        y: area.top + 27 * unit, width: size, height: size, color: COLORS[(lane + wave) % COLORS.length],
        warning: warningDuration, warningDuration, fall: 0, fallDuration });
    }
    // Stars share a safe corridor with the gaps; collecting one never demands
    // crossing a block in the same row.
    const lane = gap + Math.floor(random() * clear);
    stars.push({ id: nextId++, x: area.left + (lane + .5) * laneWidth, y: area.top + 27 * unit + size / 2,
      radius: 7 * unit, size: 15 * unit, warning: warningDuration, warningDuration,
      fall: 0, fallDuration, spin: random() * Math.PI * 2 });
  }
  function movePlayer(dt) {
    let direction = Number(keys.right) - Number(keys.left);
    if (player.dashRemaining > 0) {
      direction = dashDirection; player.x += direction * 510 * unit * dt;
      trailIn -= dt;
      if (trailIn <= 0) { trail.push({ x: player.x, y: player.y, life: .16, facing: player.facing }); trailIn = .035; }
    } else if (direction) {
      pointerTarget = null; player.x += direction * 220 * unit * dt;
    } else if (pointerTarget !== null) {
      const distance = pointerTarget - player.x;
      direction = Math.sign(distance); player.x += direction * Math.min(Math.abs(distance), 360 * unit * dt);
    }
    if (direction) player.facing = direction;
    player.x = clamp(player.x, area.left + player.size / 2, area.right - player.size / 2);
  }
  function damage(block) {
    if (player.invulnerable > 0 || resizeGrace > 0) return;
    lives--; combo = 0; player.invulnerable = 1.5;
    burst(player.x, player.y, '#ff9fbd', 18);
    burst(block.x + block.width / 2, block.y + block.height / 2, block.color, 8);
    if (!lives) finish(false);
    else progress(`${lives} shields left. Space dashes through danger.`);
  }
  function advanceFalling(entity, dt, isStar) {
    if (entity.warning > 0) { entity.warning = Math.max(0, entity.warning - dt); return; }
    entity.fall += dt / entity.fallDuration;
    const start = area.top + 27 * unit;
    entity.y = start + entity.fall * (area.bottom - start + 30 * unit) + (isStar ? 16 * unit : 0);
  }
  function step(dt) {
    elapsed = Math.min(duration, elapsed + dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dashRemaining = Math.max(0, player.dashRemaining - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    resizeGrace = Math.max(0, resizeGrace - dt);
    movePlayer(dt);
    const nextWave = Math.min(waves, 1 + Math.floor(elapsed / waveDuration));
    if (nextWave !== wave) { wave = nextWave; score += 100; progress(`Wave ${wave} / ${waves}. Keep your stars shining.`); }
    spawnIn -= dt;
    if (spawnIn <= 0) { spawnRow(); spawnIn += 1.5 - wave * .09; }
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const block = obstacles[i]; advanceFalling(block, dt, false);
      if (block.warning > 0) continue;
      if (circleRect(player, block)) {
        if (player.invulnerable <= 0 && resizeGrace <= 0) { obstacles.splice(i, 1); damage(block); }
        else if (player.dashRemaining > 0) { obstacles.splice(i, 1); burst(block.x + block.width / 2, block.y, block.color, 9); }
        if (completed) return;
      } else if (block.y > area.bottom) {
        obstacles.splice(i, 1); dodged++; score += 5;
        burst(block.x + block.width / 2, area.bottom, block.color, 3);
      }
    }
    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i]; advanceFalling(star, dt, true);
      if (star.warning > 0) continue;
      if (Math.hypot(star.x - player.x, star.y - player.y) < star.radius + player.radius + 3 * unit) {
        stars.splice(i, 1); collected++; combo = Math.min(5, combo + 1); score += 75 + combo * 25;
        burst(star.x, star.y, '#ffe28b', 14); progress(combo > 1 ? `Star chain x${combo}! Keep glowing.` : 'A little star for your collection.');
      } else if (star.y - star.radius > area.bottom) { stars.splice(i, 1); combo = 0; }
    }
    if (elapsed >= duration) { finish(true); return; }
    const second = Math.floor(elapsed);
    if (second !== reportedSecond) { reportedSecond = second; progress(`Wave ${wave} / ${waves}  ·  ${Math.ceil(duration - elapsed)}s to go`); }
  }
  function update(delta) {
    if (!started || destroyed || completed) return;
    const dt = clamp(Number(delta) || 0, 0, .08); clock += dt;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 75 * unit * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = trail.length - 1; i >= 0; i--) { trail[i].life -= dt; if (trail[i].life <= 0) trail.splice(i, 1); }
    if (phase !== 'playing') return;
    const count = Math.max(1, Math.ceil(dt * 120));
    for (let i = 0; i < count && !completed; i++) step(dt / count);
  }
  function drawStar(ctx, star) {
    const size = star.size, x = star.x, y = star.y, blink = Math.sin(clock * 7 + star.spin) > 0;
    pixel(ctx, '#ad713f', x - size * .2, y - size * .48, size * .4, size);
    pixel(ctx, '#ffe28b', x - size * .15, y - size * .48, size * .3, size);
    pixel(ctx, '#ffe28b', x - size * .48, y - size * .15, size, size * .3);
    pixel(ctx, blink ? '#fff9cf' : '#ffedaa', x - size * .22, y - size * .22, size * .44, size * .44);
  }
  function drawBackground(ctx) {
    pixel(ctx, '#0b1021', 0, 0, W, H);
    pixel(ctx, '#151a32', 0, H * .4, W, H * .6);
    pixel(ctx, '#24203d', 0, H * .66, W, H * .34);
    for (const star of sky) pixel(ctx, star.bright ? '#9db1cf' : '#40526f', star.x * W, star.y * H, star.bright ? 2 : 1, 1);
    const moonX = W * .82, moonY = area.top + area.height * .16;
    pixel(ctx, '#424967', moonX - 4, moonY + 5, 35, 21);
    pixel(ctx, '#a8bbcc', moonX, moonY + 2, 27, 27);
    pixel(ctx, '#d7e5ce', moonX + 4, moonY - 1, 19, 33);
    pixel(ctx, '#8496ad', moonX + 16, moonY + 6, 7, 6);
    for (let i = -1; i < W / 39 + 1; i++) {
      const height = (30 + ((i * 17 + 311) % 5) * 13) * unit, x = i * 39;
      pixel(ctx, i % 2 ? '#25364c' : '#1c2b44', x, area.bottom - height, 32, height);
      pixel(ctx, '#36435d', x + 4, area.bottom - height - 3, 24, 3);
      for (let j = 10; j < height - 8; j += 15) pixel(ctx, '#53777b', x + 9, area.bottom - j, 4, 4);
    }
    pixel(ctx, '#8acbb6', 0, area.bottom, W, 3 * unit);
    pixel(ctx, '#37555c', 0, area.bottom + 3 * unit, W, 5 * unit);
    pixel(ctx, '#152333', 0, area.bottom + 8 * unit, W, H - area.bottom);
    for (let i = 0; i < W; i += 28 * unit) {
      pixel(ctx, '#29394b', i, area.bottom + 15 * unit, 15 * unit, 2 * unit);
      pixel(ctx, '#233345', i + 14 * unit, area.bottom + 29 * unit, 7 * unit, 2 * unit);
    }
  }
  function draw(ctx) {
    if (destroyed) return;
    ctx.save(); drawBackground(ctx);
    for (const block of obstacles) {
      if (block.warning > 0) {
        ctx.globalAlpha = .12 + .12 * Math.sin(clock * 15) ** 2;
        pixel(ctx, block.color, block.x, area.top + 25 * unit, block.width, area.height - 25 * unit);
        ctx.globalAlpha = .75;
        pixel(ctx, block.color, block.x + block.width / 2 - 4 * unit, area.top + 27 * unit, 8 * unit, 3 * unit);
        pixel(ctx, block.color, block.x + block.width / 2 - 2 * unit, area.top + 30 * unit, 4 * unit, 3 * unit);
        ctx.globalAlpha = 1; continue;
      }
      pixel(ctx, '#111529', block.x - 2 * unit, block.y - 2 * unit, block.width + 4 * unit, block.height + 4 * unit);
      pixel(ctx, block.color, block.x, block.y, block.width, block.height);
      pixel(ctx, '#dce8ff', block.x + 2 * unit, block.y + 2 * unit, block.width - 4 * unit, 2 * unit);
      pixel(ctx, '#38435d', block.x + 3 * unit, block.y + block.height - 5 * unit, block.width - 6 * unit, 3 * unit);
      pixel(ctx, '#37425b', block.x + block.width * .3, block.y + block.height * .4, 3 * unit, 4 * unit);
      pixel(ctx, '#37425b', block.x + block.width * .66, block.y + block.height * .4, 3 * unit, 4 * unit);
    }
    for (const star of stars) {
      if (star.warning > 0) continue;
      ctx.globalAlpha = .2; pixel(ctx, '#ffe28b', star.x - 2 * unit, star.y - 20 * unit, 4 * unit, 15 * unit); ctx.globalAlpha = 1;
      drawStar(ctx, star);
    }
    for (const ghost of trail) {
      ctx.globalAlpha = ghost.life * 2; api.drawMascot(ctx, ghost.x, ghost.y, player.size, { facing: ghost.facing });
    }
    ctx.globalAlpha = 1;
    pixel(ctx, '#090e1c', player.x - player.size * .45, area.bottom - 3 * unit, player.size * .9, 3 * unit);
    if (player.invulnerable > 0 && phase === 'playing') {
      ctx.strokeStyle = player.dashRemaining > 0 ? '#e4f9ff' : '#81cfff'; ctx.lineWidth = unit;
      ctx.strokeRect(Math.round(player.x - player.size * .61), Math.round(player.y - player.size * .55), player.size * 1.22, player.size * 1.1);
    }
    ctx.globalAlpha = player.invulnerable > 0 && Math.floor(clock * 14) % 2 ? .72 : 1;
    api.drawMascot(ctx, player.x, player.y - (phase === 'ready' ? Math.sin(clock * 3) * 2 * unit : 0), player.size,
      { facing: player.facing, rotation: player.dashRemaining > 0 ? player.facing * .16 : 0, frame: clock * 8 });
    ctx.globalAlpha = 1;
    for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 3); pixel(ctx, p.color, p.x, p.y, 2 * unit, 2 * unit); }
    ctx.globalAlpha = 1;
    api.drawText(ctx, `WAVE ${wave}/${waves}`, (area.left + area.right) / 2, area.top + 5 * unit, { size: 7 * unit, color: '#c9d5ed' });
    api.drawText(ctx, `${lives} SHIELDS`, area.left + 3 * unit, area.top + 5 * unit, { size: 6 * unit, color: '#81cfff', align: 'left' });
    api.drawText(ctx, player.dashCooldown > 0 ? `DASH ${player.dashCooldown.toFixed(1)}` : 'DASH READY', area.right - 3 * unit, area.top + 5 * unit,
      { size: 6 * unit, color: player.dashCooldown > 0 ? '#7b8ba5' : '#c9ff73', align: 'right' });
    pixel(ctx, '#2b354b', area.left, area.top + 17 * unit, area.width, 2 * unit);
    if (elapsed > 0) pixel(ctx, COLORS[wave - 1], area.left, area.top + 17 * unit, area.width * elapsed / duration, 2 * unit);
    if (phase === 'ready') {
      const width = area.width * .9, height = 70 * unit, x = (area.left + area.right - width) / 2;
      const y = area.top + area.height * .43 - height / 2;
      pixel(ctx, '#10182b', x, y, width, height); pixel(ctx, '#ffe28b', x, y, 3 * unit, height);
      api.drawText(ctx, 'STAR DODGE', W / 2, y + 13 * unit, { size: 13 * unit, color: '#ffe28b' });
      api.drawText(ctx, 'CATCH STARS. DODGE BLOCKS.', W / 2, y + 36 * unit, { size: Math.min(7 * unit, width / 25), color: '#c2d3df' });
      api.drawText(ctx, 'MOVE OR DRAG / SPACE TO DASH', W / 2, y + 52 * unit, { size: Math.min(6 * unit, width / 28), color: '#81cfff' });
    }
    ctx.restore();
  }
  function input(action, pressed) {
    if (!started || destroyed || completed || !(action in keys)) return;
    const down = Boolean(pressed), wasDown = keys[action]; keys[action] = down;
    if (down && action === 'primary' && !wasDown) dash();
    else if (down && action !== 'primary') { pointerTarget = null; launch(); }
  }
  function pointer(x, y, pressed) {
    if (!started || destroyed || completed) return;
    pointerDown = Boolean(pressed);
    if (pointerDown && Number.isFinite(x)) {
      pointerTarget = clamp(x, area.left + player.size / 2, area.right - player.size / 2); launch();
    } else pointerTarget = null;
  }
  function resize(next) {
    if (destroyed) return;
    const previous = area, oldUnit = unit;
    ({ W, H, area, unit } = layout(next.width, next.height, next.bounds));
    player.x = remap(player.x, previous.left, previous.right, area.left, area.right); sizePlayer();
    if (pointerTarget !== null) pointerTarget = remap(pointerTarget, previous.left, previous.right, area.left, area.right);
    for (const block of obstacles) {
      const center = remap(block.x + block.width / 2, previous.left, previous.right, area.left, area.right);
      block.width *= unit / oldUnit; block.height *= unit / oldUnit;
      block.x = clamp(center - block.width / 2, area.left, area.right - block.width);
      block.y = area.top + 27 * unit + block.fall * (area.height + 3 * unit);
    }
    for (const star of stars) {
      star.x = remap(star.x, previous.left, previous.right, area.left, area.right); star.radius = 7 * unit; star.size = 15 * unit;
      star.y = area.top + 43 * unit + star.fall * (area.height + 3 * unit);
    }
    particles.length = trail.length = 0;
    resizeGrace = phase === 'playing' ? .7 : 0;
  }
  function state() {
    return { name: 'dodge', phase, score, lives, wave, waves, elapsed, duration, collected, dodged, combo, completed, destroyed,
      width: W, height: H, bounds: { ...area }, floorY: area.bottom, unit, resizeGrace, player: { ...player },
      obstacles: obstacles.map(block => ({ ...block })), stars: stars.map(star => ({ ...star })),
      particles: particles.length, pointerDown, controls: { ...keys } };
  }
  function destroy() {
    destroyed = true; phase = 'destroyed'; pointerDown = false; pointerTarget = null;
    for (const key of Object.keys(keys)) keys[key] = false;
    obstacles.length = stars.length = particles.length = trail.length = 0;
  }
  sizePlayer();
  return { start, update, draw, input, pointer, state, resize, destroy };
}
