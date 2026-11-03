// Pixel-letter physics: a fixed board keeps every played cell stable on resize.
const WORD = 'FLITTLE';
const COLUMNS = 45;
const SHAPES = {
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111']
};
const COLORS = ['#c9ff73', '#78e6da', '#81cfff', '#baa0ff', '#dfafff', '#8ce9cb', '#c9ff73'];
const ROTATIONS = Object.fromEntries(Object.entries(SHAPES).map(([letter, rows]) => {
  let cells = [], width = 5, height = 7;
  rows.forEach((row, y) => [...row].forEach((value, x) => { if (value === '1') cells.push({ x, y }); }));
  const rotations = [];
  for (let turn = 0; turn < 4; turn++) {
    rotations.push({ cells, width, height });
    cells = cells.map(({ x, y }) => ({ x: height - 1 - y, y: x }));
    [width, height] = [height, width];
  }
  return [letter, rotations];
}));
const cellKey = (x, y) => x + ':' + y;

export function createIntroGame(canvas, {
  onProgress = () => {},
  onComplete = () => {},
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
} = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('The letter game needs a Canvas 2D context.');
  let width = 1, height = 1, cell = 1, originX = 0, originY = 0;
  let phase = 'idle', index = 0, score = 0, current = null;
  let frame = 0, last = 0, elapsed = 0, slowDrop = false, destroyed = false;
  let finishingInstantly = false;
  let completeAt = 0, completionBonus = 0, lastTrail = 0, dropStreak = null;
  let exitPromise = null, resolveExit = null, exitElapsed = 0, exitTotal = 0;
  const exitBodies = [];
  const settled = [], occupied = new Set(), particles = [], trails = [], rings = [];

  const slotX = slot => 2 + slot * 6;
  const shape = (letter = WORD[index], rotation = current?.rotation || 0) => ROTATIONS[letter][rotation];
  function progress() {
    onProgress({ index, letter: WORD[index] || '', score, total: WORD.length, locked: settled.length, phase });
  }
  function wake() {
    if (!destroyed && !document.hidden && !frame && phase !== 'idle' && phase !== 'exited') frame = requestAnimationFrame(tick);
  }
  function canPlace(x, y, rotation, letter = WORD[index]) {
    return shape(letter, rotation).cells.every(offset => {
      const px = x + offset.x, py = y + offset.y;
      return px >= 0 && px < COLUMNS && py < 0 && !occupied.has(cellKey(px, py));
    });
  }
  function landingY(x = current.x, y = current.y, rotation = current.rotation) {
    while (canPlace(x, y + 1, rotation)) y++;
    return y;
  }
  function spawn() {
    const highest = settled.reduce((value, block) => Math.min(value, ...block.cells.map(point => point.y)), 0);
    const startY = Math.min(-Math.ceil(originY / cell) - 8, highest - 10);
    current = {
      x: slotX(index), y: startY, rotation: 0, fallProgress: 0,
      fallSpeed: Math.max(8, (-7 - startY) / 2.05),
      born: elapsed, moves: 0, rotations: 0, hardDropped: false, settle: 0
    };
    trails.length = 0;
    phase = 'falling';
    progress();
  }
  function start() {
    if (destroyed || phase !== 'idle') return;
    spawn();
    last = 0;
    wake();
  }
  function move(direction) {
    if (destroyed || phase !== 'falling' || !current) return;
    const sign = direction === 'left' ? -1 : direction === 'right' ? 1 : Math.sign(Number(direction));
    if (!sign) return;
    const x = current.x + sign;
    if (!canPlace(x, current.y, current.rotation)) return;
    if (current.fallProgress > .001 && !canPlace(x, current.y + 1, current.rotation)) return;
    current.x = x;
    current.moves++;
    wake();
  }
  function rotate() {
    if (destroyed || phase !== 'falling' || !current) return;
    const next = (current.rotation + 1) % 4;
    const before = shape(), after = shape(WORD[index], next);
    const baseX = current.x + (before.width - after.width) / 2;
    const baseY = current.y + (before.height - after.height) / 2;
    // Keep the rotation's center, then try small wall/floor kicks. No landing snap.
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [0, -2]]) {
      const x = baseX + dx, y = baseY + dy;
      if (!canPlace(x, y, next)) continue;
      if (current.fallProgress > .001 && !canPlace(x, y + 1, next)) continue;
      current.x = x;
      current.y = y;
      current.rotation = next;
      current.rotations++;
      trails.length = 0;
      wake();
      return;
    }
  }
  function softDrop(active) {
    slowDrop = Boolean(active);
    wake();
  }
  function beginLanding() {
    if (phase !== 'falling' || !current) return;
    current.fallProgress = 0;
    current.settle = 0;
    phase = 'settling';
    trails.length = 0;
    impact();
  }
  function hardDrop() {
    if (destroyed || phase !== 'falling' || !current) return;
    const targetY = landingY();
    const form = shape();
    if (!reducedMotion) {
      dropStreak = { x: current.x, fromY: current.y, toY: targetY + form.height, width: form.width, life: .16, color: COLORS[index] };
    }
    current.hardDropped = true;
    current.y = targetY;
    beginLanding();
    wake();
  }
  function finishInstantly() {
    if (destroyed || phase === 'complete' || phase === 'exiting' || phase === 'exited' || finishingInstantly) return false;
    finishingInstantly = true;
    cancelAnimationFrame(frame);
    frame = 0;
    slowDrop = false;
    particles.length = trails.length = rings.length = 0;
    dropStreak = null;
    try {
      if (phase === 'idle') spawn();
      // Reuse the same collision and scoring path as a played hard drop. The
      // current placement is retained; subsequent spawns use their own slots.
      while (!destroyed && current && settled.length < WORD.length) {
        current.y = landingY();
        current.fallProgress = 0;
        current.hardDropped = true;
        commitPlacement();
      }
      if (!destroyed) {
        // Consumer callbacks may release held controls and request a frame.
        cancelAnimationFrame(frame);
        frame = 0;
        render();
        if (!reducedMotion) wake();
      }
      return phase === 'complete';
    } finally {
      finishingInstantly = false;
    }
  }
  function impact() {
    if (reducedMotion) return;
    const form = shape(), x = current.x + form.width / 2, y = current.y + form.height;
    rings.push({ x, y, age: 0, color: COLORS[index] });
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: x + (Math.random() - .5) * form.width, y: y - Math.random() * 2,
        vx: (Math.random() - .5) * 9, vy: -2.5 - Math.random() * 5,
        size: .1 + Math.random() * .13, life: .45 + Math.random() * .35, color: COLORS[index]
      });
    }
    if (particles.length > 80) particles.splice(0, particles.length - 80);
  }
  function finishExit(completed) {
    if (!resolveExit) return;
    const resolve = resolveExit;
    resolveExit = null;
    if (completed) phase = 'exited';
    cancelAnimationFrame(frame);
    frame = 0;
    resolve(completed);
  }
  function playExit() {
    if (exitPromise) return exitPromise;
    if (destroyed || phase !== 'complete') return Promise.resolve(false);
    exitPromise = new Promise(resolve => { resolveExit = resolve; });
    phase = 'exiting';
    exitElapsed = 0;
    slowDrop = false;
    particles.length = trails.length = rings.length = 0;
    dropStreak = null;
    cancelAnimationFrame(frame);
    frame = 0;
    const gap = Math.max(.5, cell * .075);
    for (const block of settled) {
      for (const point of block.cells) {
        // Centers and sizes exactly match the bevel tiles in the settled word.
        const x = originX + (point.x + .5) * cell;
        const y = originY + (point.y + .5) * cell;
        exitBodies.push({
          letterIndex: block.index, cellX: point.x, cellY: point.y,
          x, y, size: cell - gap * 2, angle: 0,
          vx: (Math.random() - .5) * Math.min(width * .12, 110) + (x / width - .5) * 18,
          vy: -height * (.01 + Math.random() * .02),
          spin: (Math.random() - .5) * 5,
          delay: Math.random() * .1, color: COLORS[block.index],
          landed: false, sleeping: false, supported: false, floorContact: false,
          floorContacts: 0, tileContacts: 0, rest: 0
        });
      }
    }
    exitTotal = exitBodies.length;
    if (reducedMotion || !exitTotal) {
      settleExitBodies();
      finishExit(true);
      render();
    } else {
      render();
      last = 0;
      wake();
    }
    return exitPromise;
  }
  const bodyExtent = body => body.size / 2 * (Math.abs(Math.cos(body.angle)) + Math.abs(Math.sin(body.angle)));
  const flatAngle = body => Math.round(body.angle / (Math.PI / 2)) * (Math.PI / 2);
  function floorContact(body) {
    const extent = bodyExtent(body);
    if (body.x < extent) { body.x = extent; body.vx = Math.abs(body.vx) * .2; }
    if (body.x > width - extent) { body.x = width - extent; body.vx = -Math.abs(body.vx) * .2; }
    if (body.y + extent < originY - .05) return;
    body.y = originY - extent;
    if (body.vy > 0) body.vy = body.vy > 65 ? -body.vy * .19 : 0;
    body.vx *= .82;
    body.spin *= .58;
    body.landed = body.supported = body.floorContact = true;
    body.floorContacts++;
  }
  function solveTileContacts() {
    const pitch = Math.max(2, ...exitBodies.map(body => body.size * 1.5));
    const buckets = new Map();
    for (let i = 0; i < exitBodies.length; i++) {
      const body = exitBodies[i], key = Math.floor(body.x / pitch) + ':' + Math.floor(body.y / pitch);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
    for (let i = 0; i < exitBodies.length; i++) {
      const a = exitBodies[i], bx = Math.floor(a.x / pitch), by = Math.floor(a.y / pitch);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        for (const j of buckets.get((bx + ox) + ':' + (by + oy)) || []) {
          if (j <= i) continue;
          const b = exitBodies[j];
          let invA = !a.sleeping && exitElapsed >= a.delay ? 1 : 0;
          let invB = !b.sleeping && exitElapsed >= b.delay ? 1 : 0;
          if (!invA && !invB) continue;
          const extent = bodyExtent(a) + bodyExtent(b);
          const dx = b.x - a.x, dy = b.y - a.y;
          const overlapX = extent - Math.abs(dx), overlapY = extent - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const vertical = overlapY < overlapX;
          const nx = vertical ? 0 : (dx >= 0 ? 1 : -1);
          const ny = vertical ? (dy >= 0 ? 1 : -1) : 0;
          // Grounded tiles support the ones above them instead of being pushed
          // repeatedly into the floor by the full weight of a tall pile.
          if (vertical) {
            if (ny > 0 && b.supported) invB = 0;
            if (ny < 0 && a.supported) invA = 0;
          }
          if (!invA && !invB) continue;
          const correction = (vertical ? overlapY : overlapX) + .015;
          const inverseMass = invA + invB;
          a.x -= nx * correction * invA / inverseMass; a.y -= ny * correction * invA / inverseMass;
          b.x += nx * correction * invB / inverseMass; b.y += ny * correction * invB / inverseMass;
          const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (closing < 0) {
            const impulse = -closing * 1.12 / inverseMass;
            a.vx -= nx * impulse * invA; a.vy -= ny * impulse * invA;
            b.vx += nx * impulse * invB; b.vy += ny * impulse * invB;
          }
          a.tileContacts++; b.tileContacts++;
          if (vertical) {
            const upper = ny > 0 ? a : b;
            const lower = ny > 0 ? b : a;
            if (lower.landed) upper.landed = true;
            if (lower.supported) upper.supported = true;
            a.vx *= .94; b.vx *= .94;
            a.spin *= .8; b.spin *= .8;
          }
        }
      }
    }
  }
  function settleExitBodies() {
    // Reduced motion gets a supported static pile without a tumbling sequence.
    // Normal motion keeps the actual positions produced by the contact solver.
    const placed = [];
    for (const body of [...exitBodies].sort((a, b) => b.y - a.y)) {
      const half = body.size / 2;
      body.angle = flatAngle(body);
      body.x = Math.max(half, Math.min(width - half, body.x));
      body.y = originY - half;
      for (const support of placed) {
        if (Math.abs(body.x - support.x) < half + support.size / 2 + .1) {
          body.y = Math.min(body.y, support.y - support.size / 2 - half - .02);
        }
      }
      body.vx = body.vy = body.spin = 0;
      body.sleeping = body.landed = body.supported = true;
      body.floorContact = Math.abs(body.y + half - originY) < .1;
      if (body.floorContact) body.floorContacts++;
      placed.push(body);
    }
  }
  function updateExit(dt) {
    const steps = Math.max(1, Math.ceil(dt * 120)), step = dt / steps;
    const gravity = Math.max(1000, height * 2.2);
    for (let substep = 0; substep < steps; substep++) {
      exitElapsed += step;
      for (const body of exitBodies) {
        if (body.sleeping || exitElapsed < body.delay) continue;
        const wasSupported = body.supported;
        body.supported = body.floorContact = false;
        body.vy += gravity * step;
        body.x += body.vx * step; body.y += body.vy * step;
        body.angle += body.spin * step;
        if (wasSupported || exitElapsed > 1.2 && body.landed) {
          body.vx *= Math.exp(-step * 10);
          body.spin *= Math.exp(-step * 16);
          body.angle += (flatAngle(body) - body.angle) * (1 - Math.exp(-step * 16));
        }
        floorContact(body);
      }
      for (let iteration = 0; iteration < 4; iteration++) {
        solveTileContacts();
        for (const body of exitBodies) if (!body.sleeping && exitElapsed >= body.delay) floorContact(body);
      }
      for (const body of exitBodies) {
        if (body.sleeping) continue;
        const quiet = body.supported && Math.hypot(body.vx, body.vy) < 12 && Math.abs(body.spin) < .15 && Math.abs(flatAngle(body) - body.angle) < .04;
        body.rest = quiet ? body.rest + step : 0;
        if (body.rest > .14 && exitElapsed > .45) {
          const bottom = body.y + bodyExtent(body);
          body.angle = flatAngle(body);
          body.y = Math.min(originY, bottom) - body.size / 2;
          body.vx = body.vy = body.spin = 0;
          body.sleeping = true;
        }
      }
    }
    const asleep = exitBodies.every(body => body.sleeping);
    if ((exitElapsed >= 1.3 && asleep) || exitElapsed >= 2.55) {
      if (!asleep) {
        // Bound the transition without rearranging the pile. Resolve only local
        // contact residuals, then retain these actual resting positions.
        for (let iteration = 0; iteration < 6; iteration++) {
          solveTileContacts();
          for (const body of exitBodies) floorContact(body);
        }
        for (const body of exitBodies) {
          body.vx = body.vy = body.spin = 0;
          body.sleeping = true;
        }
      }
      finishExit(true);
    }
  }
  function commitPlacement() {
    const cells = shape().cells.map(offset => ({ x: current.x + offset.x, y: current.y + offset.y }));
    for (const point of cells) occupied.add(cellKey(point.x, point.y));
    settled.push({ index, letter: WORD[index], x: current.x, y: current.y, rotation: current.rotation, cells, landedAt: elapsed });
    const speedBonus = Math.max(0, 180 - Math.round((elapsed - current.born) * 45));
    // Reward play and fast drops; off-center placements are equally valid.
    score += 180 + cells.length * 4 + Math.min(current.moves, 12) * 5 + Math.min(current.rotations, 4) * 15 + speedBonus + (current.hardDropped ? 80 : 0);
    current = null;
    fitBoard();
    if (settled.length === WORD.length) {
      phase = 'complete';
      completeAt = elapsed;
      completionBonus = 400 + Math.floor(Math.random() * 1200);
      score += completionBonus;
      progress();
      onComplete({ score });
    } else {
      index++;
      spawn();
    }
  }
  function update(dt) {
    if (phase === 'exiting') { updateExit(dt); return; }
    if (phase === 'exited') return;
    elapsed += dt;
    if (dropStreak) {
      dropStreak.life -= dt;
      if (dropStreak.life <= 0) dropStreak = null;
    }
    if (phase === 'falling' && current) {
      current.fallProgress += current.fallSpeed * (slowDrop ? 5.5 : 1) * dt;
      // Test each crossed row, even during soft drop or a slow frame.
      while (phase === 'falling' && current.fallProgress >= 1) {
        if (!canPlace(current.x, current.y + 1, current.rotation)) { beginLanding(); break; }
        current.y++;
        current.fallProgress--;
      }
      if (phase === 'falling' && !canPlace(current.x, current.y + 1, current.rotation)) beginLanding();
      if (phase === 'falling' && !reducedMotion && elapsed - lastTrail > .055) {
        trails.push({ x: current.x, y: current.y + current.fallProgress, rotation: current.rotation, life: .22 });
        if (trails.length > 5) trails.shift();
        lastTrail = elapsed;
      }
    } else if (phase === 'settling' && current) {
      // This is an impact hold only: the played position and rotation never move.
      current.settle += dt;
      if (current.settle >= (reducedMotion ? .08 : .16)) commitPlacement();
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 16 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].age += dt;
      if (rings[i].age > .5) rings.splice(i, 1);
    }
    for (let i = trails.length - 1; i >= 0; i--) {
      trails[i].life -= dt;
      if (trails[i].life <= 0) trails.splice(i, 1);
    }
  }
  function pixelLetter(letter, x, y, rotation, color, { alpha = 1, glow = 0, ghost = false, flat = false } = {}) {
    ctx.save();
    ctx.translate(originX + x * cell, originY + y * cell);
    ctx.globalAlpha = alpha;
    const gap = Math.max(.5, cell * .075), size = cell - gap * 2;
    if (ghost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(.7, cell * .035);
      ctx.setLineDash([Math.max(1.2, cell * .15), Math.max(1, cell * .12)]);
    }
    for (const point of shape(letter, rotation).cells) {
      const px = point.x * cell + gap, py = point.y * cell + gap;
      if (ghost) { ctx.strokeRect(px, py, size, size); continue; }
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = glow;
      ctx.fillRect(px, py, size, size); ctx.shadowBlur = 0;
      if (!flat) {
        const bevel = Math.max(.6, cell * .105);
        ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fillRect(px, py, size, bevel);
        ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(px, py + bevel, bevel, size - bevel);
        ctx.fillStyle = 'rgba(0,0,0,.24)';
        ctx.fillRect(px, py + size - bevel, size, bevel);
        ctx.fillRect(px + size - bevel, py + bevel, bevel, size - bevel * 2);
      }
    }
    ctx.restore();
  }
  function renderFloor() {
    // The same solid ground remains under the word and its loose tiles.
    ctx.fillStyle = '#0b0e0e';
    ctx.fillRect(0, originY, width, height - originY);
    ctx.fillStyle = '#1a211b';
    ctx.fillRect(0, originY, width, Math.max(4, Math.min(8, cell * .4)));
    ctx.fillStyle = 'rgba(201,255,115,.34)';
    ctx.fillRect(0, originY, width, 1);
    ctx.fillStyle = 'rgba(201,255,115,.045)';
    ctx.fillRect(0, originY + 8, width, 12);
  }
  function render() {
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, width, height);
    if (phase === 'idle') return;
    if (phase === 'exiting' || phase === 'exited') {
      renderFloor();
      for (const body of exitBodies) {
        ctx.save();
        ctx.translate(body.x, body.y);
        ctx.rotate(body.angle);
        const size = body.size, half = size / 2, bevel = Math.max(.6, size * .12);
        ctx.fillStyle = body.color; ctx.shadowColor = body.color;
        ctx.shadowBlur = Math.max(2, 9 - exitElapsed * 5);
        ctx.fillRect(-half, -half, size, size);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fillRect(-half, -half, size, bevel);
        ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-half, -half + bevel, bevel, size - bevel);
        ctx.fillStyle = 'rgba(0,0,0,.24)';
        ctx.fillRect(-half, half - bevel, size, bevel);
        ctx.fillRect(half - bevel, -half + bevel, bevel, size - bevel * 2);
        ctx.restore();
      }
      return;
    }
    const complete = phase === 'complete';
    ctx.strokeStyle = complete ? 'rgba(170,210,190,.025)' : 'rgba(170,210,190,.055)';
    ctx.lineWidth = .6; ctx.beginPath();
    for (let x = originX % cell; x < width; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, originY); }
    for (let y = originY % cell; y < originY; y += cell) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    renderFloor();
    if (dropStreak) {
      ctx.save(); ctx.globalAlpha = dropStreak.life / .16 * .2; ctx.fillStyle = dropStreak.color;
      const top = Math.max(0, originY + dropStreak.fromY * cell), bottom = originY + dropStreak.toY * cell;
      for (let column = 0; column < dropStreak.width; column++) {
        ctx.fillRect(originX + (dropStreak.x + column + .35) * cell, top, cell * .3, Math.max(0, bottom - top));
      }
      ctx.restore();
    }
    if (current && phase === 'falling') {
      pixelLetter(WORD[index], current.x, landingY(), current.rotation, COLORS[index], { alpha: .25, ghost: true });
      for (const trail of trails) pixelLetter(WORD[index], trail.x, trail.y, trail.rotation, COLORS[index], { alpha: Math.max(0, trail.life) * .26, flat: true });
    }
    for (const block of settled) {
      const impactGlow = Math.max(0, 1 - (elapsed - block.landedAt) * 3);
      const bloom = complete ? (reducedMotion ? 8 : 9 + Math.sin((elapsed - completeAt) * 2.8 + block.index * .2) * 3) : 1 + impactGlow * 10;
      pixelLetter(block.letter, block.x, block.y, block.rotation, COLORS[block.index], { glow: bloom });
    }
    if (current) pixelLetter(WORD[index], current.x, current.y + current.fallProgress, current.rotation, COLORS[index], { glow: reducedMotion ? 2 : phase === 'settling' ? 12 : 7 });
    for (const ring of rings) {
      ctx.save(); ctx.globalAlpha = (1 - ring.age / .5) * .35; ctx.strokeStyle = ring.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(originX + ring.x * cell, originY + ring.y * cell, (2 + ring.age * 12) * cell, (.15 + ring.age) * cell, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color;
      ctx.fillRect(originX + p.x * cell, originY + p.y * cell, p.size * cell, p.size * cell);
    }
    ctx.globalAlpha = 1;
  }
  function tick(now) {
    frame = 0;
    if (destroyed || document.hidden || !canvas.isConnected) return;
    const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60;
    last = now; update(dt); render();
    if (phase !== 'exited' && (phase !== 'complete' || !reducedMotion || particles.length || rings.length)) wake();
  }
  function fitBoard() {
    const highest = settled.reduce((value, block) => Math.min(value, ...block.cells.map(point => point.y)), -7);
    originY = height * .66;
    const stackFit = Math.max(1, originY - Math.min(120, height * .18)) / Math.max(10, -highest + 3);
    cell = Math.max(2, Math.min(24, (width - 30) / COLUMNS, height / 30, stackFit));
    originX = (width - COLUMNS * cell) / 2;
  }
  function resize() {
    if (destroyed) return;
    const previousWidth = width, previousHeight = height, previousFloor = originY;
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width || innerWidth); height = Math.max(1, box.height || innerHeight);
    fitBoard();
    if (phase === 'exiting' || phase === 'exited') {
      const scale = Math.min(width / previousWidth, height / previousHeight);
      for (const body of exitBodies) {
        // Scale around the floor with one factor so resting contacts survive
        // aspect-ratio changes without repacking or stretching the pile.
        body.x = width / 2 + (body.x - previousWidth / 2) * scale;
        body.y = originY + (body.y - previousFloor) * scale;
        body.vx *= scale; body.vy *= scale; body.size *= scale;
      }
    }
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Only the camera changes. Every occupied logical cell stays exactly put.
    trails.length = 0; dropStreak = null;
    render(); wake();
  }
  function visibilityChanged() {
    last = 0;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; slowDrop = false; }
    else wake();
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas);
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', visibilityChanged);
  resize();
  return {
    start, move, rotate, softDrop, hardDrop, finishInstantly, playExit,
    state() {
      return {
        phase, index, letter: WORD[index] || '', score, total: WORD.length, locked: settled.length,
        bonus: completionBonus, running: Boolean(frame), reducedMotion,
        board: { columns: COLUMNS, floor: 0, cellSize: cell, originX, originY },
        exit: exitPromise ? {
          progress: exitTotal ? exitBodies.filter(body => body.sleeping).length / exitTotal : 1,
          elapsed: exitElapsed, total: exitTotal, floorY: originY,
          remaining: exitBodies.filter(body => !body.sleeping).length,
          landed: exitBodies.filter(body => body.landed).length,
          sleeping: exitBodies.filter(body => body.sleeping).length,
          bodies: exitBodies.map(body => ({
            letterIndex: body.letterIndex, cellX: body.cellX, cellY: body.cellY,
            x: body.x, y: body.y, size: body.size, extent: bodyExtent(body), rotation: body.angle,
            vx: body.vx, vy: body.vy, delay: body.delay, landed: body.landed,
            sleeping: body.sleeping, supported: body.supported, floorContact: body.floorContact,
            floorContacts: body.floorContacts, tileContacts: body.tileContacts
          }))
        } : null,
        piece: current ? { x: current.x, y: current.y, targetX: current.x, rotation: current.rotation, fallProgress: current.fallProgress, ghostY: landingY() } : null,
        settled: settled.map(block => ({ index: block.index, letter: block.letter, x: block.x, y: block.y, rotation: block.rotation, cells: block.cells.map(point => ({ ...point })) }))
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(frame); frame = 0; phase = 'destroyed';
      exitBodies.length = 0;
      finishExit(false);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibilityChanged);
      particles.length = trails.length = rings.length = 0; dropStreak = null; current = null;
    }
  };
}
