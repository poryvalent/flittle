// Fixed-step arcade models. The shared arcade owns the canvas and input listeners.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomBetween = (random, min, max) => min + clamp(random(), 0, .999999) * (max - min);
function playBounds(width, height, bounds, floorInset) {
  const top = clamp(bounds?.top ?? 0, 0, height - 48);
  const left = clamp(bounds?.left ?? 0, 0, width - 48);
  return {
    left, top,
    right: clamp(bounds?.right ?? width, left + 48, width),
    bottom: clamp(bounds?.bottom ?? height - floorInset, top + 48, height)
  };
}
const pixel = (ctx, color, x, y, width, height) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
};
const stars = Array.from({ length: 38 }, (_, i) => ({
  x: ((i * 137 + 43) % 479) / 480,
  y: ((i * 71 + 19) % 193) / 320,
  bright: i % 7 === 0
}));

function drawSky(ctx, width, height, distance, time, desert = false) {
  pixel(ctx, desert ? '#101525' : '#0b1222', 0, 0, width, height);
  pixel(ctx, desert ? '#171b2b' : '#111d2d', 0, height * .47, width, height * .53);
  pixel(ctx, desert ? '#222236' : '#172b38', 0, height * .67, width, height * .33);
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const x = (star.x * width - distance * .025 % width + width) % width;
    const bright = star.bright && Math.sin(time * 2 + i) > -.2;
    pixel(ctx, bright ? '#d7eecc' : '#63748d', x, star.y * height, bright ? 2 : 1, bright ? 2 : 1);
    if (bright) pixel(ctx, '#55647b', x - 1, star.y * height + 1, 4, 1);
  }
  const moonX = width * .79, moonY = height * .17;
  pixel(ctx, '#364359', moonX - 3, moonY + 5, 32, 22);
  pixel(ctx, '#bfcab1', moonX, moonY + 3, 26, 26);
  pixel(ctx, '#e0e6bb', moonX + 4, moonY, 18, 32);
  pixel(ctx, '#99a79e', moonX + 16, moonY + 7, 7, 6);
  pixel(ctx, '#99a79e', moonX + 5, moonY + 20, 5, 4);
}

function drawCity(ctx, width, floor, distance) {
  const step = 44;
  for (let layer = 0; layer < 2; layer++) {
    const shift = distance * (layer ? .17 : .07);
    const offset = shift % step;
    const start = Math.floor(shift / step);
    for (let i = -1; i < Math.ceil(width / step) + 2; i++) {
      const id = i + start, x = i * step - offset;
      const tower = 30 + ((id * 29 + 2371) % 6 + 6) % 6 * 12;
      const y = floor - tower - (layer ? 0 : 19);
      pixel(ctx, layer ? '#203447' : '#18283b', x, y, 36, floor - y);
      pixel(ctx, layer ? '#2c4353' : '#213247', x + 4, y - 4, 26, 4);
      if (id % 3 === 0) pixel(ctx, '#3c5362', x + 17, y - 13, 2, 9);
      if (layer) {
        for (let row = 0; row < Math.floor(tower / 12) - 1; row++) {
          for (let column = 0; column < 3; column++) {
            if ((id + row * 3 + column * 7) % 4 === 0) continue;
            pixel(ctx, (id + row) % 3 === 0 ? '#677c66' : '#3e6874', x + 5 + column * 10, y + 9 + row * 12, 4, 4);
          }
        }
      }
    }
  }
}

function drawGround(ctx, width, height, floor, distance, desert = false) {
  pixel(ctx, desert ? '#91c6a0' : '#8ed4bc', 0, floor, width, 3);
  pixel(ctx, desert ? '#4e705f' : '#436966', 0, floor + 3, width, 5);
  pixel(ctx, '#1a2a31', 0, floor + 8, width, height - floor - 8);
  const offset = distance % 32;
  for (let i = -1; i < width / 32 + 1; i++) {
    const x = i * 32 - offset;
    pixel(ctx, '#304549', x, floor + 13, 17, 2);
    pixel(ctx, '#263a40', x + 16, floor + 22, 8, 2);
  }
}

function drawPrompt(ctx, api, title, instruction, y, width = api.width || 480) {
  pixel(ctx, '#101c2b', width / 2 - 121, y - 19, 242, 55);
  pixel(ctx, '#537c75', width / 2 - 121, y - 19, 242, 2);
  api.drawText(ctx, title, width / 2, y - 3, { size: 10, color: '#d6ff9b' });
  api.drawText(ctx, instruction, width / 2, y + 17, { size: 6, color: '#b3c8ca' });
}

function circleRect(x, y, radius, left, top, width, height) {
  const dx = x - clamp(x, left, left + width), dy = y - clamp(y, top, top + height);
  return dx * dx + dy * dy < radius * radius;
}

export function createFlappyGame(api) {
  let width = api.width || 480, height = api.height || 320;
  let bounds = playBounds(width, height, api.bounds, 28), floor = bounds.bottom;
  const random = api.random || Math.random;
  const bird = { x: bounds.left + (bounds.right - bounds.left) * .25, y: bounds.top + (floor - bounds.top) * .46, vy: 0, radius: 10 };
  const pipes = [], held = new Set();
  let phase = 'ready', score = 0, elapsed = 0, distance = 0, speed = 114, ended = false, destroyed = false, cause = '', resizeGrace = 0;

  function fitPipe(pipe) {
    pipe.gap = Math.min(pipe.naturalGap, Math.max(32, floor - bounds.top - 28));
    const margin = Math.min(24, (floor - bounds.top - pipe.gap) / 2);
    pipe.center = clamp(pipe.center, bounds.top + pipe.gap / 2 + margin, floor - pipe.gap / 2 - margin);
  }
  function makePipe(x, previousCenter = bird.y) {
    const pipe = {
      x, width: 44, naturalGap: Math.max(94, 112 - score * .8),
      center: previousCenter + randomBetween(random, -58, 58), passed: false
    };
    // Portrait worlds may be tall, but consecutive gates remain reachable.
    fitPipe(pipe);
    return pipe;
  }
  function resize(layout) {
    if (destroyed) return;
    const oldBounds = bounds, oldX = bird.x;
    const relativeY = (bird.y - oldBounds.top) / (floor - oldBounds.top);
    width = layout.width || width; height = layout.height || height;
    bounds = playBounds(width, height, layout.bounds, 28); floor = bounds.bottom;
    bird.x = bounds.left + (bounds.right - bounds.left) * .25;
    bird.y = clamp(bounds.top + relativeY * (floor - bounds.top), bounds.top + bird.radius + 4, floor - bird.radius - 4);
    for (const pipe of pipes) {
      // Keep time-to-arrival and gate spacing stable instead of squeezing the
      // existing course into an abruptly narrower portrait viewport.
      pipe.x += bird.x - oldX;
      pipe.center = bounds.top + (pipe.center - oldBounds.top) / (oldBounds.bottom - oldBounds.top) * (floor - bounds.top);
      fitPipe(pipe);
      // A gate that was being crossed must not close on the player on rotate.
      if (pipe.x - 3 < bird.x + bird.radius && pipe.x + pipe.width + 3 > bird.x - bird.radius) {
        bird.y = clamp(bird.y, pipe.center - pipe.gap / 2 + bird.radius + 3, pipe.center + pipe.gap / 2 - bird.radius - 3);
      }
    }
    held.clear();
    resizeGrace = phase === 'playing' ? .4 : 0;
  }
  function start() {
    if (destroyed) return;
    phase = 'ready'; score = elapsed = distance = resizeGrace = 0; speed = 114; ended = false; cause = '';
    bird.y = bounds.top + (floor - bounds.top) * .46; bird.vy = 0;
    held.clear(); pipes.length = 0;
    pipes.push(makePipe(width + 60));
    api.progress({ score, message: 'Tap or press Space to fly' });
  }
  function finish(reason) {
    if (ended || destroyed) return;
    ended = true; phase = 'gameover'; cause = reason;
    api.progress({ score, message: 'Flight complete' });
    api.complete({ score, title: 'Flight complete' });
  }
  function flap() {
    if (destroyed || phase === 'gameover') return;
    if (phase === 'ready') {
      phase = 'playing';
      api.progress({ score, message: 'Keep flying through the gates' });
    }
    bird.vy = -208;
  }
  function input(action, pressed) {
    if (action !== 'primary' && action !== 'up' && action !== 'pointer') return;
    if (!pressed) { held.delete(action); return; }
    if (held.has(action)) return;
    held.add(action); flap();
  }
  function update(dt) {
    if (destroyed || phase !== 'playing') return;
    const delta = clamp(Number(dt) || 0, 0, .1), count = Math.max(1, Math.ceil(delta * 120)), step = delta / count;
    for (let i = 0; i < count && phase === 'playing'; i++) {
      elapsed += step;
      resizeGrace = Math.max(0, resizeGrace - step);
      speed = Math.min(158, 114 + score * 2.4);
      distance += speed * step;
      bird.vy += 610 * step;
      bird.y += bird.vy * step;
      if (bird.y - bird.radius < bounds.top) {
        bird.y = bounds.top + bird.radius; bird.vy = Math.max(0, bird.vy);
        if (!resizeGrace) { finish('ceiling'); break; }
      }
      if (bird.y + bird.radius > floor) {
        bird.y = floor - bird.radius; bird.vy = Math.min(0, bird.vy);
        if (!resizeGrace) { finish('ground'); break; }
      }
      for (const pipe of pipes) {
        pipe.x -= speed * step;
        const top = pipe.center - pipe.gap / 2, bottom = pipe.center + pipe.gap / 2;
        // The small body hitbox ignores the mascot's ears and glowing outline.
        if (!resizeGrace && (circleRect(bird.x, bird.y, bird.radius, pipe.x - 3, bounds.top, pipe.width + 6, top - bounds.top) ||
            circleRect(bird.x, bird.y, bird.radius, pipe.x - 3, bottom, pipe.width + 6, floor - bottom))) {
          finish('gate'); break;
        }
        if (!pipe.passed && pipe.x + pipe.width + 3 < bird.x - bird.radius) {
          pipe.passed = true; score++;
          api.progress({ score, message: score === 1 ? 'First gate cleared!' : 'Keep the rhythm' });
        }
      }
      if (phase !== 'playing') break;
      while (pipes.length && pipes[0].x + pipes[0].width < -12) pipes.shift();
      const last = pipes[pipes.length - 1];
      if (!last || last.x < width + 65) pipes.push(makePipe(last ? last.x + randomBetween(random, 184, 208) : width + 60, last?.center ?? bird.y));
    }
  }
  function drawPipe(ctx, pipe) {
    const top = Math.round(pipe.center - pipe.gap / 2), bottom = Math.round(pipe.center + pipe.gap / 2), x = pipe.x;
    for (const [y, length] of [[bounds.top, top - bounds.top], [bottom, floor - bottom]]) {
      pixel(ctx, '#112d35', x, y, pipe.width, length);
      pixel(ctx, '#2f736f', x + 3, y, pipe.width - 6, length);
      pixel(ctx, '#6dc8b0', x + 4, y, 4, length);
      pixel(ctx, '#1c4b50', x + pipe.width - 9, y, 6, length);
      for (let mark = y + 22; mark < y + length - 12; mark += 27) {
        pixel(ctx, '#3b8f80', x + 13, mark, 17, 2);
        pixel(ctx, '#204d54', x + 14, mark + 4, 13, 8);
      }
    }
    for (const y of [top - 12, bottom]) {
      pixel(ctx, '#112d35', x - 5, y - 2, pipe.width + 10, 16);
      pixel(ctx, '#b7ed82', x - 3, y, pipe.width + 6, 11);
      pixel(ctx, '#e0ffb2', x - 3, y, pipe.width + 6, 3);
      pixel(ctx, '#669d6e', x - 3, y + 8, pipe.width + 6, 3);
      pixel(ctx, '#477963', x + pipe.width - 6, y + 3, 8, 5);
    }
  }
  function draw(ctx) {
    if (destroyed) return;
    ctx.save();
    drawSky(ctx, width, height, distance, elapsed);
    drawCity(ctx, width, floor, distance);
    for (const pipe of pipes) drawPipe(ctx, pipe);
    drawGround(ctx, width, height, floor, distance);
    if (phase === 'playing') {
      for (let i = 0; i < 4; i++) {
        const tailX = bird.x - 24 - i * 8;
        pixel(ctx, i % 2 ? '#5e8a85' : '#9ec3a1', tailX, bird.y + 3 + Math.sin(elapsed * 12 + i) * 3, 3 - i * .45, 2);
      }
    }
    api.drawMascot(ctx, bird.x, bird.y, 34, { rotation: clamp(bird.vy / 570, -.4, .65), frame: Math.floor(elapsed * 12), facing: 1 });
    if (phase === 'ready') drawPrompt(ctx, api, 'FLITTLE FLIGHT', 'TAP / SPACE TO FLAP', Math.min(bounds.top + (floor - bounds.top) * .22, bird.y - 58), width);
    ctx.restore();
  }
  return {
    start, update, draw, input, resize,
    pointer(x, y, pressed) { input('pointer', pressed); },
    state() { return { phase, score, elapsed, distance, speed, cause, resizeGrace, width, height, bounds: { ...bounds }, floorY: floor, player: { ...bird }, obstacles: pipes.map(pipe => ({ ...pipe })) }; },
    destroy() { destroyed = true; phase = 'destroyed'; held.clear(); pipes.length = 0; }
  };
}

export function createRunnerGame(api) {
  let width = api.width || 480, height = api.height || 320;
  let bounds = playBounds(width, height, api.bounds, 48), floor = bounds.bottom;
  const random = api.random || Math.random;
  const player = { x: bounds.left + (bounds.right - bounds.left) * .19, y: floor - 16, vy: 0, onGround: true };
  const obstacles = [], held = new Set(), dust = [];
  let phase = 'ready', score = 0, elapsed = 0, distance = 0, speed = 180, passed = 0;
  let spawnIn = .9, jumpBuffer = 0, dustIn = 0, ended = false, destroyed = false, resizeGrace = 0;

  function resize(layout) {
    if (destroyed) return;
    const oldX = player.x, oldFloor = floor;
    width = layout.width || width; height = layout.height || height;
    bounds = playBounds(width, height, layout.bounds, 48); floor = bounds.bottom;
    player.x = bounds.left + (bounds.right - bounds.left) * .19;
    // Keep jump height and velocity in physical game units across orientation.
    player.y += floor - oldFloor;
    if (player.y < bounds.top + 18) { player.y = bounds.top + 18; player.vy = Math.max(0, player.vy); }
    for (const obstacle of obstacles) obstacle.x += player.x - oldX;
    dust.length = 0; held.clear();
    resizeGrace = phase === 'playing' ? .4 : 0;
  }

  function start() {
    if (destroyed) return;
    phase = 'ready'; score = elapsed = distance = passed = 0; speed = 180;
    spawnIn = .9; jumpBuffer = dustIn = resizeGrace = 0; ended = false;
    player.y = floor - 16; player.vy = 0; player.onGround = true;
    obstacles.length = dust.length = 0; held.clear();
    api.progress({ score, message: 'Tap or press Space to jump' });
  }
  function finish() {
    if (ended || destroyed) return;
    ended = true; phase = 'gameover';
    api.progress({ score, message: 'Run complete' });
    api.complete({ score, title: 'Run complete' });
  }
  function jump() {
    if (destroyed || phase === 'gameover') return;
    if (phase === 'ready') {
      phase = 'playing';
      api.progress({ score, message: 'Jump the crystals and cacti' });
    }
    jumpBuffer = .12;
    if (player.onGround) {
      player.vy = -375; player.onGround = false; jumpBuffer = 0;
    }
  }
  function input(action, pressed) {
    if (action !== 'primary' && action !== 'up' && action !== 'pointer') return;
    if (!pressed) { held.delete(action); return; }
    if (held.has(action)) return;
    held.add(action); jump();
  }
  function spawnObstacle() {
    const cactus = random() > .45;
    const previous = obstacles[obstacles.length - 1];
    const x = Math.max(width + 24, previous ? previous.x + previous.width + speed * 1.14 : 0);
    const obstacle = { x, width: cactus ? 25 : 31, height: randomBetween(random, 25, 41), kind: cactus ? 'cactus' : 'crystal', passed: false };
    obstacles.push(obstacle);
    // More than one full jump between obstacles, even at maximum speed.
    spawnIn = randomBetween(random, 1.14, 1.65);
  }
  function update(dt) {
    if (destroyed || phase !== 'playing') return;
    const delta = clamp(Number(dt) || 0, 0, .1), count = Math.max(1, Math.ceil(delta * 120)), step = delta / count;
    for (let i = 0; i < count && phase === 'playing'; i++) {
      elapsed += step; speed = Math.min(315, 180 + elapsed * 2.25); distance += speed * step;
      resizeGrace = Math.max(0, resizeGrace - step);
      jumpBuffer = Math.max(0, jumpBuffer - step);
      if (!player.onGround) {
        player.vy += 1120 * step; player.y += player.vy * step;
        if (player.y >= floor - 16) {
          player.y = floor - 16; player.vy = 0; player.onGround = true;
          if (jumpBuffer > 0) { player.vy = -375; player.onGround = false; jumpBuffer = 0; }
        }
      }
      spawnIn -= step;
      if (spawnIn <= 0) spawnObstacle();
      for (const obstacle of obstacles) {
        obstacle.x -= speed * step;
        // Narrow, inset hitboxes keep ears and decorative spikes forgiving.
        if (!resizeGrace && player.x + 10 > obstacle.x + 4 && player.x - 10 < obstacle.x + obstacle.width - 4 &&
            player.y + 13 > floor - obstacle.height + 3 && player.y - 12 < floor) {
          finish(); break;
        }
        if (!obstacle.passed && obstacle.x + obstacle.width < player.x - 10) { obstacle.passed = true; passed++; }
      }
      if (phase !== 'playing') break;
      while (obstacles.length && obstacles[0].x + obstacles[0].width < -10) obstacles.shift();
      const nextScore = Math.floor(distance / 12) + passed * 25;
      if (nextScore !== score) { score = nextScore; api.progress({ score, message: passed ? 'Keep your paws moving' : 'Watch the horizon' }); }
      dustIn -= step;
      if (player.onGround && dustIn <= 0) {
        dust.push({ x: player.x - 14, y: floor - 3, life: .32 }); dustIn = .085;
      }
      for (let p = dust.length - 1; p >= 0; p--) {
        dust[p].x -= speed * .62 * step; dust[p].y -= 9 * step; dust[p].life -= step;
        if (dust[p].life <= 0) dust.splice(p, 1);
      }
    }
  }
  function drawDesert(ctx) {
    drawSky(ctx, width, height, distance, elapsed, true);
    for (let layer = 0; layer < 2; layer++) {
      const span = 155, shift = distance * (layer ? .16 : .065), offset = shift % span;
      for (let i = -1; i < width / span + 2; i++) {
        const x = i * span - offset, bottom = floor - (layer ? 0 : 21), color = layer ? '#2d3c45' : '#273141';
        pixel(ctx, color, x, bottom - 20, 150, 30);
        pixel(ctx, color, x + 17, bottom - 35, 112, 22);
        pixel(ctx, color, x + 34, bottom - 50, 78, 18);
        pixel(ctx, color, x + 51, bottom - 62, 43, 18);
        if (layer) pixel(ctx, '#3e4d51', x + 51, bottom - 62, 43, 3);
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = ((i * 113 + 29 - distance * .38) % (width + 50) + width + 50) % (width + 50) - 25;
      pixel(ctx, '#6e8b82', x, floor - 12 - i % 2 * 5, 11, 3);
      pixel(ctx, '#4a6a64', x - 3, floor - 9 - i % 2 * 5, 17, 3);
    }
  }
  function drawObstacle(ctx, obstacle) {
    const x = obstacle.x, y = floor - obstacle.height, h = obstacle.height;
    if (obstacle.kind === 'cactus') {
      pixel(ctx, '#2a5448', x + 8, y - 2, 10, h + 2);
      pixel(ctx, '#9fd082', x + 9, y, 8, h);
      pixel(ctx, '#d6eaa0', x + 10, y + 2, 2, h - 3);
      pixel(ctx, '#739d6b', x, y + h * .35, 7, h * .32);
      pixel(ctx, '#9fd082', x, y + h * .26, 4, h * .38);
      pixel(ctx, '#739d6b', x + 17, y + h * .55, 8, 5);
      pixel(ctx, '#b3d790', x + 21, y + h * .26, 4, h * .42);
      for (let p = 0; p < 3; p++) pixel(ctx, '#456e54', x + 14, y + 7 + p * 8, 2, 2);
    } else {
      pixel(ctx, '#263b58', x + 1, floor - 12, 29, 12);
      pixel(ctx, '#8cbff1', x + 9, y + 7, 13, h - 7);
      pixel(ctx, '#b6e5ef', x + 13, y, 5, 10);
      pixel(ctx, '#d5f5e9', x + 12, y + 7, 4, h - 10);
      pixel(ctx, '#577bcb', x + 18, y + 9, 5, h - 9);
      pixel(ctx, '#ae9bdf', x, y + h * .55, 9, h * .45);
      pixel(ctx, '#d4c3fc', x + 3, y + h * .42, 4, h * .2);
      pixel(ctx, '#729ddc', x + 24, y + h * .62, 7, h * .38);
    }
  }
  function draw(ctx) {
    if (destroyed) return;
    ctx.save();
    drawDesert(ctx);
    drawGround(ctx, width, height, floor, distance, true);
    for (const obstacle of obstacles) drawObstacle(ctx, obstacle);
    for (const particle of dust) pixel(ctx, particle.life > .16 ? '#a4b7a1' : '#586e69', particle.x, particle.y, 3, 2);
    const shadowWidth = clamp(22 - (floor - 16 - player.y) * .17, 9, 22);
    pixel(ctx, '#12262a', player.x - shadowWidth / 2, floor - 2, shadowWidth, 2);
    const bob = player.onGround && phase === 'playing' ? Math.sin(elapsed * 32) * 1.2 : 0;
    api.drawMascot(ctx, player.x, player.y + bob, 36, { facing: 1, frame: Math.floor(elapsed * 15), rotation: player.onGround ? 0 : clamp(player.vy / 1700, -.16, .2) });
    if (phase === 'ready') drawPrompt(ctx, api, 'LITTLE RUNNER', 'TAP / SPACE TO JUMP', bounds.top + (floor - bounds.top) * .32, width);
    ctx.restore();
  }
  return {
    start, update, draw, input, resize,
    pointer(x, y, pressed) { input('pointer', pressed); },
    state() { return { phase, score, elapsed, distance, speed, passed, resizeGrace, width, height, bounds: { ...bounds }, floorY: floor, player: { ...player }, obstacles: obstacles.map(obstacle => ({ ...obstacle })), nextSpawn: spawnIn }; },
    destroy() { destroyed = true; phase = 'destroyed'; held.clear(); obstacles.length = dust.length = 0; }
  };
}
