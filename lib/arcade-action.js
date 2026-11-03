// Action games use the arcade host's clock, canvas, input, and mascot renderer.
// Coordinates are in the host's 480 x 320 playfield; nothing owns a local RAF.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const frameTime = dt => clamp(Number(dt) || 0, 0, .05);
const circleRect = (x, y, radius, rect) => {
  const dx = x - clamp(x, rect.x, rect.x + rect.width);
  const dy = y - clamp(y, rect.y, rect.y + rect.height);
  return dx * dx + dy * dy <= radius * radius;
};
const PALETTE = ['#c9ff73', '#78e6da', '#81cfff', '#baa0ff', '#dfafff'];

function scenery(api) {
  const width = api.width || 480, height = api.height || 320;
  const random = api.random || Math.random;
  const stars = Array.from({ length: 48 }, () => ({
    x: random() * width, y: random() * height, size: random() > .87 ? 2 : 1,
    phase: random() * Math.PI * 2
  }));
  const particles = [];
  function background(ctx, time, drift = 0) {
    ctx.fillStyle = '#080b16'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0e1424'; ctx.fillRect(0, height * .74, width, height * .26);
    for (const star of stars) {
      ctx.globalAlpha = .25 + (Math.sin(time * 1.4 + star.phase) + 1) * .2;
      ctx.fillStyle = star.size > 1 ? '#b8d7ff' : '#6c829f';
      ctx.fillRect(Math.round(star.x), Math.round((star.y + time * drift) % height), star.size, star.size);
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
  return { width, height, random, background, burst, update, draw, clear: () => { particles.length = 0; } };
}

function panel(api, ctx, width, height, title, subtitle, color = '#c9ff73') {
  ctx.fillStyle = 'rgba(5,8,17,.88)'; ctx.fillRect(width * .1, height * .43, width * .8, 64);
  ctx.fillStyle = color; ctx.fillRect(width * .1, height * .43, 3, 64);
  api.drawText(ctx, title, width / 2, height * .43 + 17, { size: 12, color });
  api.drawText(ctx, subtitle, width / 2, height * .43 + 42, { size: 7, color: '#b4c3d7' });
}

export function createBreakoutGame(api) {
  const fx = scenery(api), { width: W, height: H, random } = fx;
  const levels = 2;
  const paddle = { x: W / 2, y: H - 29, width: 88, height: 9, vx: 0 };
  const ball = { x: W / 2, y: paddle.y - 12, vx: 0, vy: 0, radius: 7 };
  const keys = { left: false, right: false, primary: false };
  let bricks = [], trail = [], phase = 'created', score = 0, lives = 3, level = 1;
  let time = 0, transition = 0, pointerDown = false, pointerTarget = null;
  let completed = false, started = false, destroyed = false, rally = 0;

  const speed = () => Math.min(290, 205 + (level - 1) * 24 + rally * 1.5);
  function progress(message) { api.progress({ score, lives, message }); }
  function attachBall() {
    ball.x = paddle.x; ball.y = paddle.y - ball.radius - 2;
    ball.vx = ball.vy = 0; trail.length = 0;
  }
  function buildLevel() {
    const columns = 8, rows = level + 3, gap = 4, margin = 24;
    const brickWidth = (W - margin * 2 - gap * (columns - 1)) / columns;
    bricks = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const hp = level === 2 && row === 0 ? 2 : 1;
      bricks.push({ id: row * columns + col, x: margin + col * (brickWidth + gap), y: 32 + row * 17,
        width: brickWidth, height: 12, hp, maxHp: hp, color: PALETTE[row % PALETTE.length] });
    }
    rally = 0; paddle.width = 88; attachBall();
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
    paddle.x = W / 2; paddle.vx = 0; fx.clear(); buildLevel();
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
    fx.burst(clamp(ball.x, 10, W - 10), H - 6, '#fb7f9d', 14);
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
    if (ball.x < ball.radius + 3) { ball.x = ball.radius + 3; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - ball.radius - 3) { ball.x = W - ball.radius - 3; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < ball.radius + 3) { ball.y = ball.radius + 3; ball.vy = Math.abs(ball.vy); }
    if (ball.y - ball.radius > H) { loseBall(); return; }
    const paddleBox = { x: paddle.x - paddle.width / 2, y: paddle.y, width: paddle.width, height: paddle.height };
    if (ball.vy > 0 && previousY + ball.radius <= paddle.y + 2 && circleRect(ball.x, ball.y, ball.radius, paddleBox)) {
      const offset = clamp((ball.x - paddle.x) / (paddle.width / 2), -.95, .95);
      const angle = offset * 1.02;
      ball.x = clamp(ball.x, paddleBox.x - ball.radius + 1, paddleBox.x + paddle.width + ball.radius - 1);
      ball.y = paddle.y - ball.radius - .1;
      ball.vx = Math.sin(angle) * speed() + paddle.vx * .1;
      if (Math.abs(ball.vx) < 28) ball.vx = (ball.vx < 0 ? -1 : 1) * 28;
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
    if (direction) { pointerTarget = null; paddle.x += direction * 340 * dt; }
    else if (pointerTarget !== null) paddle.x += clamp(pointerTarget - paddle.x, -650 * dt, 650 * dt);
    paddle.x = clamp(paddle.x, paddle.width / 2 + 5, W - paddle.width / 2 - 5);
    paddle.vx = dt ? (paddle.x - oldX) / dt : 0;
    if (phase === 'ready' || phase === 'serve') { attachBall(); return; }
    if (phase === 'level-clear') {
      transition -= dt;
      if (transition <= 0) { level++; buildLevel(); phase = 'serve'; progress('Next constellation. Space or tap to launch.'); }
      return;
    }
    if (phase !== 'playing') return;
    const steps = Math.max(1, Math.ceil(dt / .006));
    for (let i = 0; i < steps && phase === 'playing'; i++) physics(dt / steps);
    if (phase === 'playing') {
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 6) trail.shift();
    }
  }
  function draw(ctx) {
    fx.background(ctx, time);
    ctx.fillStyle = '#27344c'; ctx.fillRect(1, 0, 2, H); ctx.fillRect(W - 3, 0, 2, H);
    api.drawText(ctx, `CONSTELLATION ${level}/${levels}`, W / 2, 12, { size: 7, color: '#8295b2' });
    for (const brick of bricks) if (brick.hp > 0) {
      ctx.fillStyle = brick.color; ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(brick.x, brick.y, brick.width, 2);
      ctx.fillStyle = 'rgba(0,0,0,.23)'; ctx.fillRect(brick.x, brick.y + brick.height - 2, brick.width, 2);
      if (brick.hp > 1) {
        ctx.fillStyle = '#18223c'; ctx.fillRect(brick.x + brick.width / 2 - 3, brick.y + 4, 6, 4);
      }
    }
    for (let i = 0; i < trail.length; i++) {
      ctx.globalAlpha = i / trail.length * .3; ctx.fillStyle = '#81cfff';
      ctx.fillRect(trail[i].x - 2, trail[i].y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#638ac1'; ctx.fillRect(paddle.x - paddle.width / 2 - 2, paddle.y + 3, paddle.width + 4, paddle.height);
    ctx.fillStyle = '#b9e7ff'; ctx.fillRect(paddle.x - paddle.width / 2, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = '#ecfaff'; ctx.fillRect(paddle.x - paddle.width / 2 + 4, paddle.y, paddle.width - 8, 2);
    ctx.fillStyle = '#394e75';
    for (const side of [-1, 1]) ctx.fillRect(paddle.x + side * (paddle.width / 2 - 8) - 2, paddle.y + 3, 4, 3);
    if (phase !== 'level-clear' && phase !== 'lost') api.drawMascot(ctx, ball.x, ball.y, 19, { rotation: phase === 'playing' ? time * 2.4 : 0, frame: time * 4 });
    fx.draw(ctx);
    if (phase === 'ready') panel(api, ctx, W, H, 'BRICK BREAK', 'ARROWS OR POINTER  /  SPACE OR TAP TO LAUNCH');
    else if (phase === 'serve') panel(api, ctx, W, H, 'READY FOR ANOTHER RALLY?', 'SPACE OR TAP TO LAUNCH', '#81cfff');
    else if (phase === 'level-clear') panel(api, ctx, W, H, 'CONSTELLATION CLEARED', 'A FRESH SKY IS ON THE WAY');
  }
  function input(action, pressed) {
    if (!started || destroyed || completed) return;
    const down = Boolean(pressed);
    if (action === 'primary') { if (down && !keys.primary) launch(); keys.primary = down; }
    else if (action === 'left' || action === 'right') { keys[action] = down; if (down) pointerTarget = null; }
  }
  function pointer(x, y, pressed) {
    if (!started || destroyed || completed) return;
    if (Number.isFinite(x)) pointerTarget = clamp(x, paddle.width / 2 + 5, W - paddle.width / 2 - 5);
    const down = Boolean(pressed);
    if (down && !pointerDown) launch();
    pointerDown = down;
  }
  function state() {
    return { name: 'breakout', phase, score, lives, level, levels, completed, destroyed,
      paddle: { ...paddle }, ball: { ...ball, attached: phase === 'ready' || phase === 'serve' },
      bricks: bricks.filter(b => b.hp > 0).map(b => ({ ...b })), remaining: bricks.filter(b => b.hp > 0).length };
  }
  function destroy() {
    destroyed = true; phase = 'destroyed'; keys.left = keys.right = keys.primary = false;
    pointerDown = false; pointerTarget = null; trail.length = 0; fx.clear();
  }
  return { start, update, draw, input, pointer, state, destroy };
}

const ENEMY_PIXELS = [
  ['00100100', '00011000', '00111100', '01111110', '11011011', '10000001'],
  ['00111100', '01111110', '11011011', '11111111', '00100100', '01000010'],
  ['01000010', '00111100', '01111110', '11011011', '11111111', '00100100']
];

export function createShooterGame(api) {
  const fx = scenery(api), { width: W, height: H, random } = fx;
  const waves = 3, keys = { left: false, right: false, up: false, down: false, primary: false };
  const player = { x: W / 2, y: H - 33, radius: 8, invulnerable: 0 };
  let phase = 'created', score = 0, lives = 3, wave = 1, time = 0;
  let enemies = [], bullets = [], enemyBullets = [], formation = { offset: 0, direction: 1, descent: 0 };
  let fireCooldown = 0, enemyCooldown = 1, transition = 0, pointerDown = false, pointerTarget = null;
  let started = false, destroyed = false, completed = false, nextBullet = 0;

  function progress(message) { api.progress({ score, lives, message }); }
  function buildWave() {
    const columns = wave === 1 ? 6 : 7, rows = wave === 3 ? 3 : 2, gap = 43;
    const left = (W - (columns - 1) * gap) / 2;
    enemies = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      enemies.push({ id: row * columns + col, column: col, row,
        baseX: left + col * gap, baseY: 39 + row * 28, x: left + col * gap, y: 39 + row * 28,
        width: 24, height: 18, hp: wave === 3 && row === 0 ? 2 : 1,
        color: PALETTE[(row + wave) % PALETTE.length], hit: 0 });
    }
    formation = { offset: 0, direction: wave % 2 ? 1 : -1, descent: 0 };
    bullets.length = enemyBullets.length = 0; enemyCooldown = 1.1; fireCooldown = 0;
    player.invulnerable = Math.max(player.invulnerable, .6);
    progress(`Wave ${wave} / ${waves}`);
  }
  function start() {
    if (destroyed) return;
    started = true; completed = false; phase = 'ready'; score = 0; lives = 3; wave = 1; time = 0;
    nextBullet = 0; pointerDown = false; pointerTarget = null;
    for (const key of Object.keys(keys)) keys[key] = false;
    player.x = W / 2; player.y = H - 33; player.invulnerable = 0;
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
    enemyBullets = enemyBullets.filter(b => Math.hypot(b.x - player.x, b.y - player.y) > 64);
    progress(`Shield recharging. ${lives} lives left.`);
  }
  function firePlayer() {
    if (fireCooldown > 0 || phase !== 'playing') return;
    bullets.push({ id: nextBullet++, x: player.x, y: player.y - 15, vx: 0, vy: -310, radius: 2 });
    fireCooldown = .17;
  }
  function fireEnemy() {
    if (enemyBullets.length >= 12 || !enemies.length) return;
    const front = new Map();
    for (const enemy of enemies) if (!front.has(enemy.column) || front.get(enemy.column).y < enemy.y) front.set(enemy.column, enemy);
    const candidates = [...front.values()], enemy = candidates[Math.floor(random() * candidates.length)];
    enemyBullets.push({ id: nextBullet++, x: enemy.x, y: enemy.y + enemy.height / 2 + 3,
      vx: clamp((player.x - enemy.x) * .16, -34, 34), vy: 88 + wave * 12, radius: 3 });
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
      player.x += dx * 180 * dt; player.y += dy * 180 * dt;
    } else if (pointerTarget) {
      const x = pointerTarget.x - player.x, y = pointerTarget.y - player.y, distance = Math.hypot(x, y);
      const step = Math.min(distance, 310 * dt);
      if (distance > .01) { player.x += x / distance * step; player.y += y / distance * step; }
    }
    player.x = clamp(player.x, 18, W - 18); player.y = clamp(player.y, H * .55, H - 20);
  }
  function moveEnemies(dt) {
    formation.offset += formation.direction * (23 + wave * 7) * dt;
    const minBase = Math.min(...enemies.map(e => e.baseX)), maxBase = Math.max(...enemies.map(e => e.baseX));
    if (minBase + formation.offset < 20) {
      formation.offset = 20 - minBase; formation.direction = 1; formation.descent += 6;
    } else if (maxBase + formation.offset > W - 20) {
      formation.offset = W - 20 - maxBase; formation.direction = -1; formation.descent += 6;
    }
    formation.descent = Math.min(formation.descent, H * .49 - Math.max(...enemies.map(e => e.baseY)));
    for (const enemy of enemies) {
      enemy.x = enemy.baseX + formation.offset;
      enemy.y = enemy.baseY + formation.descent + Math.sin(time * 2 + enemy.column * .45) * 2;
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
      if (bullet.y < -10) { bullets.splice(i, 1); continue; }
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
      if (bullet.y > H + 10 || bullet.x < -10 || bullet.x > W + 10) { enemyBullets.splice(i, 1); continue; }
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
    const pattern = ENEMY_PIXELS[(enemy.row + wave - 1) % ENEMY_PIXELS.length], pixel = 3;
    ctx.fillStyle = enemy.hit > 0 ? '#ffffff' : enemy.color;
    for (let row = 0; row < pattern.length; row++) for (let col = 0; col < pattern[row].length; col++) {
      if (pattern[row][col] !== '1') continue;
      const wiggle = row === pattern.length - 1 && Math.floor(time * 3) % 2 ? (col < 4 ? -1 : 1) : 0;
      ctx.fillRect(Math.round(enemy.x - 12 + col * pixel + wiggle), Math.round(enemy.y - 9 + row * pixel), pixel, pixel);
    }
    if (enemy.hp > 1) { ctx.fillStyle = '#fff6bd'; ctx.fillRect(enemy.x - 2, enemy.y - 13, 4, 2); }
  }
  function draw(ctx) {
    fx.background(ctx, time, phase === 'ready' ? 0 : 12);
    api.drawText(ctx, `SECTOR ${wave}/${waves}`, W / 2, 12, { size: 7, color: '#8295b2' });
    for (const enemy of enemies) drawEnemy(ctx, enemy);
    for (const bullet of bullets) {
      ctx.fillStyle = '#81cfff'; ctx.fillRect(bullet.x - 2, bullet.y - 5, 4, 10);
      ctx.fillStyle = '#eefaff'; ctx.fillRect(bullet.x - 1, bullet.y - 6, 2, 6);
    }
    for (const bullet of enemyBullets) {
      ctx.fillStyle = '#ff8199'; ctx.fillRect(bullet.x - 2, bullet.y - 4, 4, 8);
      ctx.fillStyle = '#ffcfab'; ctx.fillRect(bullet.x - 1, bullet.y - 1, 2, 4);
    }
    const visible = player.invulnerable <= 0 || Math.floor(time * 12) % 2 === 0;
    if (visible && phase !== 'lost') api.drawMascot(ctx, player.x, player.y, 30, {
      thruster: phase === 'playing' || phase === 'wave-clear', frame: time * 8,
      rotation: (Number(keys.right) - Number(keys.left)) * .13
    });
    if (player.invulnerable > 0 && phase !== 'ready' && phase !== 'lost') {
      ctx.strokeStyle = 'rgba(129,207,255,.55)'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(player.x - 18), Math.round(player.y - 16), 36, 32);
    }
    fx.draw(ctx);
    if (phase === 'ready') panel(api, ctx, W, H, 'COSMIC FLITTLE', 'ARROWS TO FLY  /  HOLD SPACE OR TOUCH TO FIRE', '#81cfff');
    else if (phase === 'wave-clear') panel(api, ctx, W, H, 'SECTOR CLEARED', 'INCOMING SIGNAL FROM THE NEXT SECTOR', '#dfafff');
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
    if (down && Number.isFinite(x) && Number.isFinite(y)) pointerTarget = { x: clamp(x, 18, W - 18), y: clamp(y, H * .55, H - 20) };
    if (down && !pointerDown) { launch(); firePlayer(); }
    pointerDown = down;
    if (!down) pointerTarget = null;
  }
  function state() {
    return { name: 'shooter', phase, score, lives, wave, waves, completed, destroyed,
      player: { ...player }, enemies: enemies.map(e => ({ ...e })), bullets: bullets.map(b => ({ ...b })),
      enemyBullets: enemyBullets.map(b => ({ ...b })), formation: { ...formation },
      firing: keys.primary || pointerDown, cooldown: fireCooldown };
  }
  function destroy() {
    destroyed = true; phase = 'destroyed';
    for (const key of Object.keys(keys)) keys[key] = false;
    pointerDown = false; pointerTarget = null; bullets.length = enemyBullets.length = 0; fx.clear();
  }
  return { start, update, draw, input, pointer, state, destroy };
}
