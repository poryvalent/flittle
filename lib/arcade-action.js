// Action games use the arcade host's clock, canvas, input, and mascot renderer.
// The whole canvas is scenery; the host supplies safe gameplay edges around UI.
// Nothing owns a local RAF or stretches an actor when the viewport changes.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const frameTime = dt => clamp(Number(dt) || 0, 0, .05);
const circleRect = (x, y, radius, rect) => {
  const dx = x - clamp(x, rect.x, rect.x + rect.width);
  const dy = y - clamp(y, rect.y, rect.y + rect.height);
  return dx * dx + dy * dy <= radius * radius;
};
const PALETTE = ['#c9ff73', '#78e6da', '#81cfff', '#baa0ff', '#dfafff'];

function layout(width = 480, height = 320, bounds) {
  const W = Math.max(120, Number(width) || 480), H = Math.max(120, Number(height) || 320);
  const left = clamp(Number(bounds?.left) || 0, 0, W - 80);
  const top = clamp(Number(bounds?.top) || 0, 0, H - 80);
  const right = clamp(Number(bounds?.right) || W, left + 80, W);
  const bottom = clamp(Number(bounds?.bottom) || H, top + 80, H);
  const area = { left, right, top, bottom, width: right - left, height: bottom - top };
  return { W, H, area, unit: clamp(Math.min(area.width / 420, area.height / 210), .38, 1.3) };
}
const remap = (value, fromLow, fromHigh, toLow, toHigh) =>
  toLow + clamp((value - fromLow) / Math.max(1, fromHigh - fromLow), 0, 1) * (toHigh - toLow);

function scenery(api) {
  let width = api.width || 480, height = api.height || 320;
  const random = api.random || Math.random;
  const stars = Array.from({ length: 48 }, () => ({
    x: random(), y: random(), size: random() > .87 ? 2 : 1,
    phase: random() * Math.PI * 2
  }));
  const particles = [];
  function background(ctx, time, drift = 0) {
    ctx.fillStyle = '#080b16'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0e1424'; ctx.fillRect(0, height * .74, width, height * .26);
    for (const star of stars) {
      ctx.globalAlpha = .25 + (Math.sin(time * 1.4 + star.phase) + 1) * .2;
      ctx.fillStyle = star.size > 1 ? '#b8d7ff' : '#6c829f';
      ctx.fillRect(Math.round(star.x * width), Math.round((star.y * height + time * drift) % height), star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }
  function burst(x, y, color, count = 9) {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2, speed = 22 + random() * 80;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .3 + random() * .3, color });
    }
    if (particles.length > 150) particles.splice(0, particles.length - 150);
  }
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function draw(ctx) {
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  function resize(nextWidth, nextHeight) {
    for (const p of particles) { p.x *= nextWidth / width; p.y *= nextHeight / height; }
    width = nextWidth; height = nextHeight;
  }
  return { random, background, burst, update, draw, resize, clear: () => { particles.length = 0; } };
}

function panel(api, ctx, area, unit, title, subtitle, color = '#c9ff73') {
  const width = area.width * .88, height = 64 * unit;
  const x = (area.left + area.right - width) / 2, y = area.top + area.height * .48 - height / 2;
  ctx.fillStyle = 'rgba(5,8,17,.88)'; ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color; ctx.fillRect(x, y, 3 * unit, height);
  api.drawText(ctx, title, (area.left + area.right) / 2, y + 17 * unit, { size: 12 * unit, color });
  api.drawText(ctx, subtitle, (area.left + area.right) / 2, y + 42 * unit, { size: Math.min(7 * unit, width / (subtitle.length * .65)), color: '#b4c3d7' });
}

export function createBreakoutGame(api) {
  const fx = scenery(api), { random } = fx;
  let { W, H, area, unit } = layout(api.width, api.height, api.bounds);
  const levels = 2;
  const paddle = { x: W / 2, y: H - 29, width: 88, height: 9, vx: 0 };
  const ball = { x: W / 2, y: paddle.y - 12, vx: 0, vy: 0, radius: 7 };
  const keys = { left: false, right: false, primary: false };
  let bricks = [], trail = [], phase = 'created', score = 0, lives = 3, level = 1;
  let time = 0, transition = 0, pointerDown = false, pointerTarget = null;
  let completed = false, started = false, destroyed = false, rally = 0;
  let resizeGrace = 0;

  const speed = () => Math.min(290, 205 + (level - 1) * 24 + rally * 1.5) * clamp(area.height / 280, .6, 1.65);
  function placeBricks() {
    const columns = 8, gap = 4 * unit, margin = 15 * unit;
    const width = (area.width - margin * 2 - gap * (columns - 1)) / columns;
    const step = Math.min(19 * unit, area.height * .048);
    for (const brick of bricks) Object.assign(brick, {
      x: area.left + margin + (brick.id % columns) * (width + gap),
      y: area.top + 25 * unit + Math.floor(brick.id / columns) * step,
      width, height: Math.min(12 * unit, step * .75)
    });
  }
  function sizeActors() {
    paddle.width = Math.min(88 * unit, area.width * .28); paddle.height = 9 * unit;
    paddle.y = area.bottom - 23 * unit; ball.radius = 9.5 * unit;
  }
  function progress(message) { api.progress({ score, lives, message }); }
  function attachBall() {
    ball.x = paddle.x; ball.y = paddle.y - ball.radius - 2;
    ball.vx = ball.vy = 0; trail.length = 0;
  }
  function buildLevel() {
    const columns = 8, rows = level + 3;
    bricks = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const hp = level === 2 && row === 0 ? 2 : 1;
      bricks.push({ id: row * columns + col, hp, maxHp: hp, color: PALETTE[row % PALETTE.length] });
    }
    rally = 0; sizeActors(); placeBricks(); attachBall();
  }
  function finish(won) {
    if (completed || destroyed) return;
    completed = true; phase = won ? 'won' : 'lost';
    ball.vx = ball.vy = 0;
    if (won) score += lives * 250;
    progress(won ? 'Both constellations cleared!' : 'A good rally. Try another round.');
    api.complete({ score, title: won ? 'CONSTELLATIONS CLEARED' : 'RALLY COMPLETE' });
  }
  function start() {
    if (destroyed) return;
    started = true; completed = false; phase = 'ready'; score = 0; lives = 3; level = 1;
    time = transition = rally = 0; pointerDown = false; pointerTarget = null;
    keys.left = keys.right = keys.primary = false;
    paddle.x = (area.left + area.right) / 2; paddle.vx = 0; resizeGrace = 0; fx.clear(); buildLevel();
    progress('Move with arrows / A D. Space or tap to launch.');
  }
  function launch() {
    if (!started || destroyed || completed || !['ready', 'serve'].includes(phase)) return;
    const angle = (random() > .5 ? 1 : -1) * (.25 + random() * .25);
    ball.vx = Math.sin(angle) * speed(); ball.vy = -Math.cos(angle) * speed();
    phase = 'playing'; progress(`Constellation ${level} / ${levels}`);
  }
  function loseBall() {
    lives--; rally = 0;
    fx.burst(clamp(ball.x, area.left + 10 * unit, area.right - 10 * unit), area.bottom - 6 * unit, '#fb7f9d', 14);
    if (!lives) { finish(false); return; }
    phase = 'serve'; attachBall(); progress('Ball saved for you. Space or tap to relaunch.');
  }
  function nextLevel() {
    if (level === levels) { finish(true); return; }
    score += 150; phase = 'level-clear'; transition = .95;
    ball.vx = ball.vy = 0; trail.length = 0;
    progress('Constellation cleared!');
  }
  function bounceBrick(brick, previousX, previousY) {
    if (previousY + ball.radius <= brick.y + .5) {
      ball.y = brick.y - ball.radius - .1; ball.vy = -Math.abs(ball.vy);
    } else if (previousY - ball.radius >= brick.y + brick.height - .5) {
      ball.y = brick.y + brick.height + ball.radius + .1; ball.vy = Math.abs(ball.vy);
    } else if (previousX + ball.radius <= brick.x + .5) {
      ball.x = brick.x - ball.radius - .1; ball.vx = -Math.abs(ball.vx);
    } else if (previousX - ball.radius >= brick.x + brick.width - .5) {
      ball.x = brick.x + brick.width + ball.radius + .1; ball.vx = Math.abs(ball.vx);
    } else {
      const cx = brick.x + brick.width / 2, cy = brick.y + brick.height / 2;
      const dx = (ball.x - cx) / (brick.width / 2 + ball.radius);
      const dy = (ball.y - cy) / (brick.height / 2 + ball.radius);
      if (Math.abs(dx) > Math.abs(dy)) {
        ball.x = dx < 0 ? brick.x - ball.radius - .1 : brick.x + brick.width + ball.radius + .1;
        ball.vx = (dx < 0 ? -1 : 1) * Math.abs(ball.vx);
      } else {
        ball.y = dy < 0 ? brick.y - ball.radius - .1 : brick.y + brick.height + ball.radius + .1;
        ball.vy = (dy < 0 ? -1 : 1) * Math.abs(ball.vy);
      }
    }
    brick.hp--; rally++; score += brick.hp ? 5 : 15 * level;
    fx.burst(ball.x, ball.y, brick.color, brick.hp ? 4 : 8);
    const magnitude = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx *= speed() / magnitude; ball.vy *= speed() / magnitude;
    progress(`Constellation ${level} / ${levels}`);
    if (bricks.every(b => b.hp <= 0)) nextLevel();
  }
  function physics(dt) {
    const previousX = ball.x, previousY = ball.y;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x < area.left + ball.radius) { ball.x = area.left + ball.radius; ball.vx = Math.abs(ball.vx); }
    if (ball.x > area.right - ball.radius) { ball.x = area.right - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < area.top + ball.radius) { ball.y = area.top + ball.radius; ball.vy = Math.abs(ball.vy); }
    if (ball.y + ball.radius > area.bottom) { loseBall(); return; }
    const paddleBox = { x: paddle.x - paddle.width / 2, y: paddle.y, width: paddle.width, height: paddle.height };
    if (ball.vy > 0 && previousY + ball.radius <= paddle.y + 2 && circleRect(ball.x, ball.y, ball.radius, paddleBox)) {
      const offset = clamp((ball.x - paddle.x) / (paddle.width / 2), -.95, .95);
      const angle = offset * 1.02;
      ball.x = clamp(ball.x, paddleBox.x - ball.radius + 1, paddleBox.x + paddle.width + ball.radius - 1);
      ball.y = paddle.y - ball.radius - .1;
      ball.vx = Math.sin(angle) * speed() + paddle.vx * .1;
      if (Math.abs(ball.vx) < 28 * unit) ball.vx = (ball.vx < 0 ? -1 : 1) * 28 * unit;
      ball.vx = clamp(ball.vx, -speed() * .88, speed() * .88);
      ball.vy = -Math.sqrt(speed() ** 2 - ball.vx ** 2);
      fx.burst(ball.x, paddle.y, '#81cfff', 4);
    }
    for (const brick of bricks) {
      if (brick.hp > 0 && circleRect(ball.x, ball.y, ball.radius, brick)) {
        bounceBrick(brick, previousX, previousY); break;
      }
    }
  }
  function update(elapsed) {
    if (!started || destroyed) return;
    const dt = frameTime(elapsed); time += dt; fx.update(dt);
    if (completed) return;
    const oldX = paddle.x, direction = Number(keys.right) - Number(keys.left);
    if (direction) { pointerTarget = null; paddle.x += direction * 340 * unit * dt; }
    else if (pointerTarget !== null) paddle.x += clamp(pointerTarget - paddle.x, -650 * unit * dt, 650 * unit * dt);
    paddle.x = clamp(paddle.x, area.left + paddle.width / 2 + 5 * unit, area.right - paddle.width / 2 - 5 * unit);
    paddle.vx = dt ? (paddle.x - oldX) / dt : 0;
    if (phase === 'ready' || phase === 'serve') { attachBall(); return; }
    if (phase === 'level-clear') {
      transition -= dt;
      if (transition <= 0) { level++; buildLevel(); phase = 'serve'; progress('Next constellation. Space or tap to launch.'); }
      return;
    }
    if (phase !== 'playing') return;
    if (resizeGrace > 0) { resizeGrace -= dt; return; }
    const steps = Math.max(1, Math.ceil(dt / .006));
    for (let i = 0; i < steps && phase === 'playing'; i++) physics(dt / steps);
    if (phase === 'playing') {
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 6) trail.shift();
    }
  }
  function draw(ctx) {
    fx.background(ctx, time);
    api.drawText(ctx, `CONSTELLATION ${level}/${levels}`, (area.left + area.right) / 2, area.top + 8 * unit, { size: 7 * unit, color: '#8295b2' });
    for (const brick of bricks) if (brick.hp > 0) {
      ctx.fillStyle = brick.color; ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(brick.x, brick.y, brick.width, 2 * unit);
      ctx.fillStyle = 'rgba(0,0,0,.23)'; ctx.fillRect(brick.x, brick.y + brick.height - 2 * unit, brick.width, 2 * unit);
      if (brick.hp > 1) {
        ctx.fillStyle = '#18223c'; ctx.fillRect(brick.x + brick.width / 2 - 3 * unit, brick.y + 4 * unit, 6 * unit, 4 * unit);
      }
    }
    for (let i = 0; i < trail.length; i++) {
      ctx.globalAlpha = i / trail.length * .3; ctx.fillStyle = '#81cfff';
      ctx.fillRect(trail[i].x - 2, trail[i].y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#638ac1'; ctx.fillRect(paddle.x - paddle.width / 2 - 2 * unit, paddle.y + 3 * unit, paddle.width + 4 * unit, paddle.height);
    ctx.fillStyle = '#b9e7ff'; ctx.fillRect(paddle.x - paddle.width / 2, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = '#ecfaff'; ctx.fillRect(paddle.x - paddle.width / 2 + 4 * unit, paddle.y, paddle.width - 8 * unit, 2 * unit);
    ctx.fillStyle = '#394e75';
    for (const side of [-1, 1]) ctx.fillRect(paddle.x + side * (paddle.width / 2 - 8 * unit) - 2 * unit, paddle.y + 3 * unit, 4 * unit, 3 * unit);
    if (phase !== 'level-clear' && phase !== 'lost') api.drawMascot(ctx, ball.x, ball.y, 19 * unit, { rotation: phase === 'playing' ? time * 2.4 : 0, frame: time * 4 });
    fx.draw(ctx);
    if (phase === 'ready') panel(api, ctx, area, unit, 'BRICK BREAK', 'ARROWS OR POINTER  /  SPACE OR TAP TO LAUNCH');
    else if (phase === 'serve') panel(api, ctx, area, unit, 'READY FOR ANOTHER RALLY?', 'SPACE OR TAP TO LAUNCH', '#81cfff');
    else if (phase === 'level-clear') panel(api, ctx, area, unit, 'CONSTELLATION CLEARED', 'A FRESH SKY IS ON THE WAY');
  }
  function input(action, pressed) {
    if (!started || destroyed || completed) return;
    const down = Boolean(pressed);
    if (action === 'primary') { if (down && !keys.primary) launch(); keys.primary = down; }
    else if (action === 'left' || action === 'right') { keys[action] = down; if (down) pointerTarget = null; }
  }
  function pointer(x, y, pressed) {
    if (!started || destroyed || completed) return;
    if (Number.isFinite(x)) pointerTarget = clamp(x, area.left + paddle.width / 2 + 5 * unit, area.right - paddle.width / 2 - 5 * unit);
    const down = Boolean(pressed);
    if (down && !pointerDown) launch();
    pointerDown = down;
  }
  function state() {
    return { name: 'breakout', phase, score, lives, level, levels, completed, destroyed,
      width: W, height: H, bounds: { ...area }, unit,
      paddle: { ...paddle }, ball: { ...ball, attached: phase === 'ready' || phase === 'serve' },
      bricks: bricks.filter(b => b.hp > 0).map(b => ({ ...b })), remaining: bricks.filter(b => b.hp > 0).length };
  }
  function resize(next) {
    if (destroyed) return;
    const previous = area, oldSpeed = speed();
    ({ W, H, area, unit } = layout(next.width, next.height, next.bounds));
    fx.resize(W, H); sizeActors(); placeBricks();
    paddle.x = clamp(remap(paddle.x, previous.left, previous.right, area.left, area.right), area.left + paddle.width / 2 + 5 * unit, area.right - paddle.width / 2 - 5 * unit);
    paddle.vx = 0;
    if (pointerTarget !== null) pointerTarget = remap(pointerTarget, previous.left, previous.right, area.left, area.right);
    ball.x = clamp(remap(ball.x, previous.left, previous.right, area.left, area.right), area.left + ball.radius, area.right - ball.radius);
    ball.y = clamp(remap(ball.y, previous.top, previous.bottom, area.top, area.bottom), area.top + ball.radius, paddle.y - ball.radius - 2);
    ball.vx *= speed() / oldSpeed; ball.vy *= speed() / oldSpeed;
    if (bricks.some(brick => brick.hp > 0 && circleRect(ball.x, ball.y, ball.radius, brick))) {
      ball.y = Math.max(...bricks.filter(brick => brick.hp > 0).map(brick => brick.y + brick.height)) + ball.radius + 2;
    }
    if (phase === 'ready' || phase === 'serve') attachBall();
    trail.length = 0; resizeGrace = .28;
  }
  function destroy() {
    destroyed = true; phase = 'destroyed'; keys.left = keys.right = keys.primary = false;
    pointerDown = false; pointerTarget = null; trail.length = 0; fx.clear();
  }
  return { start, update, draw, input, pointer, state, resize, destroy };
}

const ENEMY_PIXELS = [
  ['00100100', '00011000', '00111100', '01111110', '11011011', '10000001'],
  ['00111100', '01111110', '11011011', '11111111', '00100100', '01000010'],
  ['01000010', '00111100', '01111110', '11011011', '11111111', '00100100']
];

export function createShooterGame(api) {
  const fx = scenery(api), { random } = fx;
  let { W, H, area, unit } = layout(api.width, api.height, api.bounds);
  const waves = 3, keys = { left: false, right: false, up: false, down: false, primary: false };
  const player = { x: W / 2, y: H - 33, radius: 8, invulnerable: 0 };
  let phase = 'created', score = 0, lives = 3, wave = 1, time = 0;
  let enemies = [], bullets = [], enemyBullets = [], formation = { offset: 0, direction: 1, descent: 0 };
  let fireCooldown = 0, enemyCooldown = 1, transition = 0, pointerDown = false, pointerTarget = null;
  let started = false, destroyed = false, completed = false, nextBullet = 0;

  function progress(message) { api.progress({ score, lives, message }); }
  const travel = () => clamp(area.height / 280, .65, 1.65);
  const playerLimits = () => ({ left: area.left + 18 * unit, right: area.right - 18 * unit,
    top: area.top + area.height * .57, bottom: area.bottom - 20 * unit });
  function placeFormation() {
    const columns = wave === 1 ? 6 : 7, rows = wave === 3 ? 3 : 2;
    const gap = area.width * .68 / (columns - 1);
    const step = Math.min(36 * unit, area.height * .13);
    const left = (area.left + area.right - (columns - 1) * gap) / 2;
    for (const enemy of enemies) Object.assign(enemy, {
      baseX: left + enemy.column * gap, baseY: area.top + 27 * unit + enemy.row * step,
      width: 24 * unit, height: 18 * unit
    });
    // Keep the formation well above the player's flying band, even in landscape.
    const lastRow = area.top + 27 * unit + (rows - 1) * step;
    formation.descent = clamp(formation.descent, 0, Math.max(0, area.top + area.height * .45 - lastRow));
    if (enemies.length) formation.offset = clamp(formation.offset,
      area.left + 20 * unit - Math.min(...enemies.map(e => e.baseX)),
      area.right - 20 * unit - Math.max(...enemies.map(e => e.baseX)));
    for (const enemy of enemies) { enemy.x = enemy.baseX + formation.offset; enemy.y = enemy.baseY + formation.descent; }
  }
  function buildWave() {
    const columns = wave === 1 ? 6 : 7, rows = wave === 3 ? 3 : 2;
    enemies = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      enemies.push({ id: row * columns + col, column: col, row,
        hp: wave === 3 && row === 0 ? 2 : 1,
        color: PALETTE[(row + wave) % PALETTE.length], hit: 0 });
    }
    formation = { offset: 0, direction: wave % 2 ? 1 : -1, descent: 0 };
    placeFormation();
    bullets.length = enemyBullets.length = 0; enemyCooldown = 1.1; fireCooldown = 0;
    player.invulnerable = Math.max(player.invulnerable, .6);
    progress(`Wave ${wave} / ${waves}`);
  }
  function start() {
    if (destroyed) return;
    started = true; completed = false; phase = 'ready'; score = 0; lives = 3; wave = 1; time = 0;
    nextBullet = 0; pointerDown = false; pointerTarget = null;
    for (const key of Object.keys(keys)) keys[key] = false;
    player.x = (area.left + area.right) / 2; player.y = area.bottom - 28 * unit;
    player.radius = 8 * unit; player.invulnerable = 0;
    fx.clear(); buildWave(); progress('Arrows / WASD to fly. Hold Space or touch to fire.');
  }
  function launch() {
    if (!started || destroyed || completed || phase !== 'ready') return;
    phase = 'playing'; player.invulnerable = 1;
    progress(`Wave ${wave} / ${waves}`);
  }
  function finish(won) {
    if (completed || destroyed) return;
    completed = true; phase = won ? 'won' : 'lost';
    if (won) score += lives * 300;
    progress(won ? 'The Flittle galaxy is safe!' : 'A brave flight. Launch again soon.');
    api.complete({ score, title: won ? 'GALAXY SAVED' : 'FLIGHT COMPLETE' });
  }
  function damagePlayer() {
    if (phase !== 'playing' || player.invulnerable > 0) return;
    lives--; fx.burst(player.x, player.y, '#ff9bb4', 20);
    if (!lives) { finish(false); return; }
    player.invulnerable = 1.7;
    enemyBullets = enemyBullets.filter(b => Math.hypot(b.x - player.x, b.y - player.y) > 64 * unit);
    progress(`Shield recharging. ${lives} lives left.`);
  }
  function firePlayer() {
    if (fireCooldown > 0 || phase !== 'playing') return;
    bullets.push({ id: nextBullet++, x: player.x, y: player.y - 15 * unit, vx: 0, vy: -310 * travel(), radius: 2 * unit });
    fireCooldown = .17;
  }
  function fireEnemy() {
    if (enemyBullets.length >= 12 || !enemies.length) return;
    const front = new Map();
    for (const enemy of enemies) if (!front.has(enemy.column) || front.get(enemy.column).y < enemy.y) front.set(enemy.column, enemy);
    const candidates = [...front.values()], enemy = candidates[Math.floor(random() * candidates.length)];
    enemyBullets.push({ id: nextBullet++, x: enemy.x, y: enemy.y + enemy.height / 2 + 3 * unit,
      vx: clamp((player.x - enemy.x) * .16, -34 * unit, 34 * unit), vy: (88 + wave * 12) * travel(), radius: 3 * unit });
  }
  function clearWave() {
    score += wave * 150;
    bullets.length = enemyBullets.length = 0;
    if (wave === waves) { finish(true); return; }
    phase = 'wave-clear'; transition = .9; progress('Wave cleared! Keep your engines warm.');
  }
  function movePlayer(dt) {
    let dx = Number(keys.right) - Number(keys.left), dy = Number(keys.down) - Number(keys.up);
    if (dx || dy) {
      pointerTarget = null;
      const length = Math.hypot(dx, dy); dx /= length; dy /= length;
      player.x += dx * 180 * unit * dt; player.y += dy * 180 * unit * dt;
    } else if (pointerTarget) {
      const x = pointerTarget.x - player.x, y = pointerTarget.y - player.y, distance = Math.hypot(x, y);
      const step = Math.min(distance, 310 * unit * dt);
      if (distance > .01) { player.x += x / distance * step; player.y += y / distance * step; }
    }
    const limits = playerLimits();
    player.x = clamp(player.x, limits.left, limits.right); player.y = clamp(player.y, limits.top, limits.bottom);
  }
  function moveEnemies(dt) {
    formation.offset += formation.direction * (23 + wave * 7) * unit * dt;
    const minBase = Math.min(...enemies.map(e => e.baseX)), maxBase = Math.max(...enemies.map(e => e.baseX));
    if (minBase + formation.offset < area.left + 20 * unit) {
      formation.offset = area.left + 20 * unit - minBase; formation.direction = 1; formation.descent += 6 * unit;
    } else if (maxBase + formation.offset > area.right - 20 * unit) {
      formation.offset = area.right - 20 * unit - maxBase; formation.direction = -1; formation.descent += 6 * unit;
    }
    formation.descent = Math.min(formation.descent, Math.max(0, area.top + area.height * .45 - Math.max(...enemies.map(e => e.baseY))));
    for (const enemy of enemies) {
      enemy.x = enemy.baseX + formation.offset;
      enemy.y = enemy.baseY + formation.descent + Math.sin(time * 2 + enemy.column * .45) * 2 * unit;
      enemy.hit = Math.max(0, enemy.hit - dt);
    }
  }
  function update(elapsed) {
    if (!started || destroyed) return;
    const dt = frameTime(elapsed); time += dt; fx.update(dt);
    if (completed || phase === 'ready') return;
    movePlayer(dt); player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (phase === 'wave-clear') {
      transition -= dt;
      if (transition <= 0) { wave++; buildWave(); phase = 'playing'; }
      return;
    }
    fireCooldown = Math.max(0, fireCooldown - dt);
    if (keys.primary || pointerDown) firePlayer();
    moveEnemies(dt);
    enemyCooldown -= dt;
    if (enemyCooldown <= 0) { fireEnemy(); enemyCooldown = .98 - wave * .12 + random() * .28; }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i]; bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
      if (bullet.y - 6 * unit < area.top) { bullets.splice(i, 1); continue; }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (!circleRect(bullet.x, bullet.y, bullet.radius, { x: enemy.x - enemy.width / 2, y: enemy.y - enemy.height / 2, width: enemy.width, height: enemy.height })) continue;
        bullets.splice(i, 1); enemy.hp--; enemy.hit = .12; score += 5;
        if (enemy.hp <= 0) {
          fx.burst(enemy.x, enemy.y, enemy.color, 10); enemies.splice(j, 1); score += 35 + wave * 5;
        }
        progress(`Wave ${wave} / ${waves}`); break;
      }
    }
    if (!enemies.length) { clearWave(); return; }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i]; bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
      if (bullet.y + 5 * unit > area.bottom || bullet.x - 2 * unit < area.left || bullet.x + 2 * unit > area.right) { enemyBullets.splice(i, 1); continue; }
      if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < player.radius + bullet.radius) {
        enemyBullets.splice(i, 1); damagePlayer();
        // A hit can clear nearby projectiles, invalidating the current indices.
        if (phase !== 'playing' || player.invulnerable > 1) break;
      }
    }
    for (const enemy of enemies) {
      if (circleRect(player.x, player.y, player.radius, { x: enemy.x - enemy.width / 2, y: enemy.y - enemy.height / 2, width: enemy.width, height: enemy.height })) {
        damagePlayer(); break;
      }
    }
  }
  function drawEnemy(ctx, enemy) {
    const pattern = ENEMY_PIXELS[(enemy.row + wave - 1) % ENEMY_PIXELS.length], pixel = 3 * unit;
    ctx.fillStyle = enemy.hit > 0 ? '#ffffff' : enemy.color;
    for (let row = 0; row < pattern.length; row++) for (let col = 0; col < pattern[row].length; col++) {
      if (pattern[row][col] !== '1') continue;
      const wiggle = row === pattern.length - 1 && Math.floor(time * 3) % 2 ? (col < 4 ? -unit : unit) : 0;
      ctx.fillRect(Math.round(enemy.x - 12 * unit + col * pixel + wiggle), Math.round(enemy.y - 9 * unit + row * pixel), pixel, pixel);
    }
    if (enemy.hp > 1) { ctx.fillStyle = '#fff6bd'; ctx.fillRect(enemy.x - 2 * unit, enemy.y - 13 * unit, 4 * unit, 2 * unit); }
  }
  function draw(ctx) {
    fx.background(ctx, time, phase === 'ready' ? 0 : 12);
    api.drawText(ctx, `SECTOR ${wave}/${waves}`, (area.left + area.right) / 2, area.top + 8 * unit, { size: 7 * unit, color: '#8295b2' });
    for (const enemy of enemies) drawEnemy(ctx, enemy);
    for (const bullet of bullets) {
      ctx.fillStyle = '#81cfff'; ctx.fillRect(bullet.x - 2 * unit, bullet.y - 5 * unit, 4 * unit, 10 * unit);
      ctx.fillStyle = '#eefaff'; ctx.fillRect(bullet.x - unit, bullet.y - 6 * unit, 2 * unit, 6 * unit);
    }
    for (const bullet of enemyBullets) {
      ctx.fillStyle = '#ff8199'; ctx.fillRect(bullet.x - 2 * unit, bullet.y - 4 * unit, 4 * unit, 8 * unit);
      ctx.fillStyle = '#ffcfab'; ctx.fillRect(bullet.x - unit, bullet.y - unit, 2 * unit, 4 * unit);
    }
    const visible = player.invulnerable <= 0 || Math.floor(time * 12) % 2 === 0;
    if (visible && phase !== 'lost') api.drawMascot(ctx, player.x, player.y, 30 * unit, {
      thruster: phase === 'playing' || phase === 'wave-clear', frame: time * 8,
      rotation: (Number(keys.right) - Number(keys.left)) * .13
    });
    if (player.invulnerable > 0 && phase !== 'ready' && phase !== 'lost') {
      ctx.strokeStyle = 'rgba(129,207,255,.55)'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(player.x - 18 * unit), Math.round(player.y - 16 * unit), 36 * unit, 32 * unit);
    }
    fx.draw(ctx);
    if (phase === 'ready') panel(api, ctx, area, unit, 'COSMIC FLITTLE', 'ARROWS TO FLY  /  HOLD SPACE OR TOUCH TO FIRE', '#81cfff');
    else if (phase === 'wave-clear') panel(api, ctx, area, unit, 'SECTOR CLEARED', 'INCOMING SIGNAL FROM THE NEXT SECTOR', '#dfafff');
  }
  function input(action, pressed) {
    if (!started || destroyed || completed || !(action in keys)) return;
    keys[action] = Boolean(pressed);
    if (pressed && action === 'primary') { launch(); firePlayer(); }
    if (pressed && action !== 'primary') pointerTarget = null;
  }
  function pointer(x, y, pressed) {
    if (!started || destroyed || completed) return;
    const down = Boolean(pressed);
    const limits = playerLimits();
    if (down && Number.isFinite(x) && Number.isFinite(y)) pointerTarget = { x: clamp(x, limits.left, limits.right), y: clamp(y, limits.top, limits.bottom) };
    if (down && !pointerDown) { launch(); firePlayer(); }
    pointerDown = down;
    if (!down) pointerTarget = null;
  }
  function state() {
    return { name: 'shooter', phase, score, lives, wave, waves, completed, destroyed,
      width: W, height: H, bounds: { ...area }, unit,
      player: { ...player }, enemies: enemies.map(e => ({ ...e })), bullets: bullets.map(b => ({ ...b })),
      enemyBullets: enemyBullets.map(b => ({ ...b })), formation: { ...formation },
      firing: keys.primary || pointerDown, cooldown: fireCooldown };
  }
  function resize(next) {
    if (destroyed) return;
    const previous = area, oldUnit = unit, oldTravel = travel();
    ({ W, H, area, unit } = layout(next.width, next.height, next.bounds));
    fx.resize(W, H);
    player.radius = 8 * unit;
    const limits = playerLimits();
    player.x = clamp(remap(player.x, previous.left, previous.right, area.left, area.right), limits.left, limits.right);
    player.y = clamp(remap(player.y, previous.top, previous.bottom, area.top, area.bottom), limits.top, limits.bottom);
    if (pointerTarget) pointerTarget = {
      x: clamp(remap(pointerTarget.x, previous.left, previous.right, area.left, area.right), limits.left, limits.right),
      y: clamp(remap(pointerTarget.y, previous.top, previous.bottom, area.top, area.bottom), limits.top, limits.bottom)
    };
    formation.offset *= area.width / previous.width;
    formation.descent *= area.height / previous.height;
    placeFormation();
    for (const projectile of [...bullets, ...enemyBullets]) {
      projectile.x = clamp(remap(projectile.x, previous.left, previous.right, area.left, area.right), area.left + 3 * unit, area.right - 3 * unit);
      projectile.y = clamp(remap(projectile.y, previous.top, previous.bottom, area.top, area.bottom), area.top + 6 * unit, area.bottom - 6 * unit);
      projectile.radius *= unit / oldUnit; projectile.vx *= unit / oldUnit; projectile.vy *= travel() / oldTravel;
    }
    // The viewport may put an already-flying bullet closer to the mascot. Keep
    // entities and score, but allow the player time to orient after the change.
    player.invulnerable = Math.max(player.invulnerable, .85);
  }
  function destroy() {
    destroyed = true; phase = 'destroyed';
    for (const key of Object.keys(keys)) keys[key] = false;
    pointerDown = false; pointerTarget = null; bullets.length = enemyBullets.length = 0; fx.clear();
  }
  return { start, update, draw, input, pointer, state, resize, destroy };
}
