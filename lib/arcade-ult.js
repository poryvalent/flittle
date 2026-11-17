import { drawMascot, drawText } from './arcade-art.js';
import { pixelRing, fragments, impact, streak, comet, shield, wing } from './arcade-ult-fx.js';

const clamp = t => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const ease = t => 1 - Math.pow(1 - t, 3);
const step = (t, a, b) => clamp((t - a) / (b - a));
const random = i => { const n = Math.sin(i * 127.1 + 71.7) * 43758.5453; return n - Math.floor(n); };
const INK = '#08090b';
const TIMING = {
  shooter: { charge: .78, strike: 1.42, assemble: 1.75, duration: 2.9 },
  dodge: { charge: .58, strike: 1.22, assemble: 1.65, duration: 2.8 },
  breakout: { charge: .42, strike: 1.43, assemble: 1.62, duration: 2.65 },
  flappy: { charge: .44, strike: 1.15, assemble: 1.42, duration: 2.5 },
  runner: { charge: .42, strike: 1.12, assemble: 1.38, duration: 2.45 }
};

// These are the last moves of the actual round, not another game simulation.
// Immutable world coordinates are mapped to the viewport on every paint.
export function createGameFinisher(kind, state = {}, snapshot = null) {
  if (!TIMING[kind]) return null;
  state ||= {};
  const timing = TIMING[kind];
  // Clear past every viewport edge before the mascot transfer begins.
  const clearAt = timing.assemble - .22;
  const chainEnd = timing.strike - .24;
  const worldW = state.width || state.viewport?.width || 480;
  const worldH = state.height || state.viewport?.height || 400;
  const unit = state.unit || 1;
  const actor = kind === 'breakout' ? state.ball : state.player;
  const origin = { x: (actor?.x ?? worldW * .5) / worldW, y: (actor?.y ?? worldH * .72) / worldH };
  const actorSize = kind === 'breakout' ? (actor?.radius || 9.5 * unit) * 2 : actor?.size || (kind === 'shooter' ? 30 * unit : 34 * unit);
  const obstacles = (kind === 'shooter' ? state.enemies : kind === 'breakout' ? state.bricks : state.obstacles) || [];
  const objects = obstacles.map((object, i) => ({
    x: (object.x + (kind === 'shooter' ? 0 : (object.width || 0) / 2)) / worldW,
    y: (kind === 'runner' ? (state.floorY || worldH * .8) - object.height / 2 : kind === 'flappy' ? object.center : object.y + (kind === 'shooter' ? 0 : (object.height || 0) / 2)) / worldH,
    width: (object.width || 24 * unit) / worldW,
    height: (object.height || 18 * unit) / worldH,
    gap: (object.gap || 110 * unit) / worldH,
    color: object.color || (i % 2 ? '#c9ff73' : '#8de6e5'),
    id: i
  })).filter(object => Number.isFinite(object.x) && Number.isFinite(object.y));
  const pickups = (state.stars || []).map(star => ({ x: star.x / worldW, y: star.y / worldH, size: (star.size || 12 * unit) / worldW }));
  const floor = (state.floorY || state.bounds?.bottom || worldH * .8) / worldH;
  const route = [{ ...origin }];
  if (kind === 'breakout') {
    const rows = new Map();
    for (const object of objects) {
      const key = Math.round(object.y * worldH);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(object);
    }
    [...rows.values()].sort((a, b) => b[0].y - a[0].y).forEach((row, i) => {
      row.sort((a, b) => i % 2 ? b.x - a.x : a.x - b.x);
      route.push(...row);
    });
    if (route.length === 1) route.push({ x: .15, y: .25 }, { x: .85, y: .25 }, { x: .5, y: .35 });
  }
  let totalDistance = 0;
  for (let i = 1; i < route.length; i++) {
    totalDistance += Math.hypot((route[i].x - route[i - 1].x) * worldW, (route[i].y - route[i - 1].y) * worldH);
    route[i].distance = totalDistance;
  }
  route[0].distance = 0;

  function farCorner(x, y, w, h) {
    return Math.hypot(Math.max(Math.abs(x), Math.abs(w - x)), Math.max(Math.abs(y), Math.abs(h - y)));
  }
  function frame(w, h) {
    return { x: origin.x * w, y: origin.y * h, size: actorSize * w / worldW, floorY: floor * h };
  }
  function charge(ctx, f, t, color, label) {
    const p = step(t, 0, timing.charge);
    const radius = Math.max(34, f.size * .9);
    pixelRing(ctx, f.x, f.y, radius * (1.35 - p * .55), color, .25 + p * .4, 2, 1, -p * .4, 32);
    pixelRing(ctx, f.x, f.y, radius * (.55 + p * .16), '#eafaff', p * .5, 2, 1, p * .5, 16);
    for (let i = 0; i < 18; i++) {
      const q = (p * 1.4 + random(i) * .85) % 1;
      const angle = i * Math.PI * 2 / 18 + p * .65;
      const distance = radius * (2.8 - q * 2.6);
      ctx.globalAlpha = Math.sin(q * Math.PI) * p * .8;
      ctx.fillStyle = i % 3 ? color : '#effaff';
      ctx.fillRect(f.x + Math.cos(angle) * distance, f.y + Math.sin(angle) * distance, 3 + q * 3, 3 + q * 3);
    }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.globalAlpha = smooth(step(t, .1, .3));
    drawText(ctx, label, f.x, Math.max(20, f.y - radius * 1.8), { size: Math.min(10, Math.max(7, f.size * .16)), color });
    ctx.restore();
  }
  function ballPosition(t) {
    const distance = step(t, timing.charge, chainEnd) * totalDistance;
    let index = 1;
    while (index < route.length - 1 && route[index].distance < distance) index++;
    const a = route[index - 1], b = route[index];
    const p = clamp((distance - a.distance) / Math.max(1, b.distance - a.distance));
    let x = lerp(a.x, b.x, p), y = lerp(a.y, b.y, p);
    if (t > chainEnd) {
      const leave = smooth(step(t, chainEnd, clearAt));
      const side = Math.sign(b.x - a.x) || 1;
      const outside = side > 0 ? 1 + actorSize / worldW * 7 : -actorSize / worldW * 7;
      x = lerp(b.x, outside, leave); y = lerp(b.y, b.y - .18, leave);
    }
    return { x, y, distance, index };
  }
  function scene(ctx, w, h, t) {
    if (!snapshot?.width || !snapshot?.height) return;
    ctx.save();
    // Keep the round fully visible until its own attack physically consumes it.
    // No common opacity fade can conceal an incomplete screen wipe.
    ctx.drawImage(snapshot, 0, 0, w, h);
    ctx.restore();
  }

  function eraseBreakoutRect(ctx, x, y, w, h, viewportHeight, t) {
    // Restore the game's sky behind hit bricks until the final chain blast arrives.
    const alpha = snapshot?.width && snapshot?.height ? 1 : 0;
    const band = viewportHeight * .74;
    const fill = (top, bottom, color) => {
      if (bottom <= top) return;
      const rgb = color.map((channel, i) => Math.round(lerp([8, 9, 11][i], channel, alpha)));
      ctx.fillStyle = `rgb(${rgb.join(',')})`;
      ctx.fillRect(x, top, w, bottom - top);
    };
    fill(y, Math.min(y + h, band), [8, 11, 22]);
    fill(Math.max(y, band), y + h, [14, 20, 36]);
  }

  function shooter(ctx, w, h, t, f) {
    const p = step(t, timing.charge, timing.strike);
    const chargeP = step(t, 0, timing.charge);
    const muzzle = { x: f.x, y: f.y - f.size * .6 };
    if (t < timing.charge) {
      ctx.fillStyle = 'rgba(8,9,11,.16)'; ctx.fillRect(0, 0, w, h);
      charge(ctx, { ...f, y: muzzle.y }, t, '#bda8ff', 'SINGULARITY CANNON');
      // Three counter-rotating lenses close around the ship's actual gun position.
      for (let lens = 0; lens < 3; lens++) {
        const r = f.size * (1.5 - chargeP * .8 + lens * .27);
        pixelRing(ctx, muzzle.x, muzzle.y, r, lens % 2 ? '#8de6e5' : '#bda8ff',
          .25 + chargeP * .5, 3, .42 + lens * .19, (lens % 2 ? -1 : 1) * t * 2, 24);
      }
      const core = f.size * (.08 + chargeP * .22);
      ctx.fillStyle = '#7961b0'; ctx.fillRect(muzzle.x - core, muzzle.y - core, core * 2, core * 2);
      ctx.fillStyle = '#c8fff2'; ctx.fillRect(muzzle.x - core * .4, muzzle.y - core * .4, core * .8, core * .8);
      for (const side of [-1, 1]) {
        const spread = f.size * (1.8 - chargeP);
        streak(ctx, f.x + side * spread, f.y + f.size * .4, muzzle.x + side * core, muzzle.y,
          '#bda8ff', 2, chargeP * .45);
      }
    }
    if (t >= timing.charge) {
      const growth = ease(step(t, timing.charge, timing.charge + .18));
      const fade = 1 - smooth(step(t, timing.strike + .01, timing.assemble + .19));
      const beamHalf = w * (.055 + p * .50) * growth;
      const blast = ease(step(t, timing.charge + .24, clearAt));
      const reach = farCorner(f.x, f.y, w, h) + Math.max(f.size * 2, Math.min(w, h) * .08);
      const radius = blast * reach;
      // The wave consumes the captured game exactly where the attack has arrived.
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(f.x, f.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(f.x - f.size * .3, muzzle.y);
      ctx.lineTo(f.x - beamHalf, -20); ctx.lineTo(f.x + beamHalf, -20);
      ctx.lineTo(f.x + f.size * .3, muzzle.y); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalAlpha = fade;
      const rows = Math.min(42, Math.max(14, Math.ceil(muzzle.y / 22)));
      for (let row = 0; row < rows; row++) {
        const along = row / rows, y = muzzle.y * (1 - along);
        const height = Math.ceil(muzzle.y / rows) + 1;
        const half = lerp(f.size * .34, beamHalf, along);
        // Broad stepped violet armor, cyan energy, and a segmented pale core.
        ctx.fillStyle = row % 3 ? '#36265f' : '#493575';
        ctx.fillRect(Math.round(f.x - half), Math.round(y - height), Math.round(half * 2), height);
        const inner = half * (.54 + Math.sin(along * 16 - t * 4) * .035);
        ctx.fillStyle = row % 4 ? '#6cb9d8' : '#8bdfe7';
        ctx.fillRect(Math.round(f.x - inner), Math.round(y - height), Math.round(inner * 2), height);
        const core = Math.max(3, inner * .22);
        ctx.fillStyle = row % 5 ? '#d5fff4' : '#9ef4df';
        ctx.fillRect(Math.round(f.x - core), Math.round(y - height + 2), Math.round(core * 2), Math.max(2, height - 5));
        if (row % 3 === 0) {
          ctx.fillStyle = '#d6c4ff';
          const rail = Math.max(3, f.size * .12);
          ctx.fillRect(f.x - half - rail, y - height, rail, height * .55);
          ctx.fillRect(f.x + half, y - height, rail, height * .55);
        }
      }
      for (let rail = 0; rail < 2; rail++) {
        const side = rail ? 1 : -1;
        for (let part = 0; part < 9; part++) {
          const along = part / 9, next = (part + 1) / 9;
          const a = lerp(f.size * .4, beamHalf * .72, along);
          const b = lerp(f.size * .4, beamHalf * .72, next);
          streak(ctx, f.x + side * a, muzzle.y * (1 - along),
            f.x + side * (b + (part % 2 ? -1 : 1) * f.size * .2), muzzle.y * (1 - next), '#a7fff0', 3, .62);
        }
      }
      pixelRing(ctx, muzzle.x, muzzle.y, f.size * (.65 + p * .4), '#c8fff0', .9, 4, .42, t, 24);
      ctx.restore();
      pixelRing(ctx, f.x, f.y, radius, '#a4f1ea', (1 - blast) * .75, 4, 1, 0, 64);
      pixelRing(ctx, f.x, f.y, radius * .90, '#bda8ff', (1 - blast) * .42, 3, 1, .1, 56);
      impact(ctx, muzzle.x, muzzle.y, t - timing.charge, '#bda8ff', f.size * 2.8);
      for (const object of objects) {
        const distance = Math.hypot(object.x * w - f.x, object.y * h - f.y);
        const waveStart = timing.charge + .24;
        const waveHit = waveStart + (1 - Math.cbrt(1 - clamp(distance / reach))) * (clearAt - waveStart);
        let lower = timing.charge, upper = timing.strike;
        for (let i = 0; i < 8; i++) {
          const when = (lower + upper) / 2;
          const reach = w * (.055 + step(when, timing.charge, timing.strike) * .50) * ease(step(when, timing.charge, timing.charge + .18));
          const along = clamp((muzzle.y - object.y * h) / Math.max(1, muzzle.y));
          if (object.y * h <= muzzle.y && Math.abs(object.x * w - f.x) <= lerp(f.size * .3, reach, along)) upper = when;
          else lower = when;
        }
        const hit = Math.min(waveHit, upper >= timing.strike - .004 ? Infinity : upper);
        const age = t - hit;
        fragments(ctx, object.x * w, object.y * h, age, object.color, object.id, Math.min(w, h) * .17, 11);
        impact(ctx, object.x * w, object.y * h, age, '#e3ccff', Math.max(25, object.width * w * 1.4));
      }
    }
    ctx.save(); ctx.globalAlpha = 1 - smooth(step(t, timing.assemble - .07, timing.assemble + .27));
    const recoil = Math.sin(step(t, timing.charge, timing.charge + .24) * Math.PI) * f.size * .18;
    const launch = smooth(step(t, timing.strike - .12, clearAt));
    const launchY = lerp(f.y + recoil, -f.size * 4, launch);
    if (launch > 0) comet(ctx, f.x, launchY + f.size * .3, -Math.PI / 2, f.size * .7, f.size * 2.5, ['#4a3a70', '#8de6e5', '#d8fff4'], .7);
    drawMascot(ctx, f.x, launchY, f.size, { thruster: true, frame: t * 3 });
    ctx.restore();
  }

  function dodge(ctx, w, h, t, f) {
    const chargeP = step(t, 0, timing.charge);
    const impactAt = timing.charge + .17;
    const drop = step(t, timing.charge, impactAt);
    const lift = t < timing.charge ? Math.sin(chargeP * Math.PI / 2) * f.size * 1.65
      : (1 - drop * drop) * f.size * 1.65;
    const launch = smooth(step(t, timing.strike - .12, clearAt));
    const heroY = lerp(f.y - lift, -f.size * 2, launch);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * .72, 0, Math.PI * 2); ctx.fill();
    if (t < impactAt) {
      if (t < timing.charge) charge(ctx, { ...f, y: heroY }, t, '#c9ff73', 'STARFALL SHIELD');
      shield(ctx, f.x, heroY, f.size, chargeP, t, '#c9ff73');
      // The launch shadow stretches into a landing target on the actual floor.
      pixelRing(ctx, f.x, f.floorY, f.size * (1.2 + chargeP * .8), '#a2e8ca', .55, 3, .16, 0, 24);
      if (drop > 0) {
        for (let i = 1; i <= 4; i++) {
          ctx.save(); ctx.globalAlpha = (1 - i / 5) * drop * .3;
          drawMascot(ctx, f.x, heroY - i * f.size * .35, f.size); ctx.restore();
        }
        streak(ctx, f.x, heroY - f.size * .9, f.x, f.floorY, '#d8ff9e', 5, drop * .45);
      }
    }
    if (t >= impactAt) {
      const age = t - impactAt, wave = ease(step(t, impactAt, clearAt));
      const reach = farCorner(f.x, f.floorY, w, h) + Math.max(f.size * 2, Math.min(w, h) * .08);
      const radius = wave * reach;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(f.x, f.floorY, radius, 0, Math.PI * 2); ctx.fill();
      pixelRing(ctx, f.x, f.floorY, radius, '#c9ff73', (1 - wave) * .8, 4, 1, 0, 64);
      pixelRing(ctx, f.x, f.floorY, radius * 1.35, '#d9ffb8', (1 - wave) * .85, 4, .16, 0, 64);
      pixelRing(ctx, f.x, f.floorY + 4, radius * .88, '#78dfce', (1 - wave) * .55, 3, .3, .1, 48);
      // Two ground fissures travel outwards; pixel slabs kick up behind their fronts.
      for (const side of [-1, 1]) {
        const reach = radius * 1.2;
        for (let i = 0; i < 11; i++) {
          const x = f.x + side * reach * i / 11;
          const nextX = f.x + side * reach * (i + 1) / 11;
          const y = f.floorY + (i % 2 ? 4 : -2);
          streak(ctx, x, y, nextX, f.floorY + (i % 2 ? -2 : 4), '#c9ff73', 3, (1 - wave) * .7);
          const height = Math.sin(Math.PI * clamp(age * 2.1 - i * .045)) * f.size * (.5 + random(i) * .7);
          ctx.save(); ctx.globalAlpha = (1 - wave) * .7; ctx.fillStyle = i % 2 ? '#8dd3ba' : '#b5de74';
          ctx.fillRect(Math.round(x), Math.round(f.floorY - height), 5 + i % 3 * 2, Math.max(2, height * .48)); ctx.restore();
        }
      }
      fragments(ctx, f.x, f.floorY, age, '#c9ff73', 93, f.size * 5, 18, true);
      impact(ctx, f.x, f.floorY - 4, age, '#ecffbe', f.size * 3);
      for (const object of objects) {
        const distance = Math.hypot(object.x * w - f.x, object.y * h - f.floorY);
        const hit = impactAt + (1 - Math.cbrt(1 - clamp(distance / reach))) * (clearAt - impactAt);
        if (t >= hit) {
          ctx.fillStyle = INK; ctx.fillRect((object.x - object.width * .6) * w, (object.y - object.height * .6) * h, object.width * w * 1.2, object.height * h * 1.2);
          fragments(ctx, object.x * w, object.y * h, t - hit, object.color, object.id, Math.min(w, h) * .17, 10);
          impact(ctx, object.x * w, object.y * h, t - hit, '#d8ff9f', Math.max(20, object.width * w));
        }
      }
      const collect = smooth(step(t, impactAt + .13, timing.assemble + .16));
      const list = pickups.length ? pickups : Array.from({ length: 8 }, (_, i) => ({ x: .1 + i * .11, y: .18 + random(i) * .25, size: .018 }));
      list.slice(0, 24).forEach((star, i) => {
        const angle = i / Math.max(1, list.length) * Math.PI * 2 + t * .4;
        const x = lerp(star.x * w, f.x + Math.cos(angle) * f.size * .9, collect);
        const y = lerp(star.y * h, heroY + Math.sin(angle) * f.size * .9, collect) - Math.sin(collect * Math.PI) * f.size * 1.4;
        const size = Math.max(4, Math.min(12, star.size * w)) * (1 - collect * .35);
        ctx.save(); ctx.globalAlpha = 1 - smooth(step(t, timing.assemble + .02, timing.assemble + .3));
        ctx.fillStyle = '#ffe7a0'; ctx.fillRect(x - size * .18, y - size * .5, size * .36, size);
        ctx.fillRect(x - size * .5, y - size * .18, size, size * .36); ctx.restore();
      });
      shield(ctx, f.x, heroY, f.size * (.95 + Math.sin(age * 3) * .03), .9, t, '#c9ff73');
    }
    ctx.save(); ctx.globalAlpha = 1 - smooth(step(t, timing.assemble - .03, timing.assemble + .25));
    const squash = t >= impactAt ? Math.sin(step(t, impactAt, impactAt + .2) * Math.PI) * .15 : 0;
    ctx.translate(f.x, heroY); ctx.scale(1 + squash, 1 - squash);
    drawMascot(ctx, 0, 0, f.size, { frame: t }); ctx.restore();
  }

  function breakout(ctx, w, h, t, f) {
    const point = ballPosition(t);
    if (t < timing.charge) {
      charge(ctx, f, t, '#ffbf91', 'CHAIN REACTION');
      const target = route[1];
      pixelRing(ctx, target.x * w, target.y * h, Math.max(15, f.size), '#ffbf91',
        step(t, .12, timing.charge) * .6, 2, .5, -t, 16);
      comet(ctx, f.x, f.y + f.size * .2, -Math.PI / 2, f.size * .9,
        f.size * (.4 + step(t, 0, timing.charge) * 1.5), ['#c25842', '#ffad70', '#fff2bd'], .55);
    }
    if (t >= timing.charge) {
      eraseBreakoutRect(ctx, f.x - f.size * .7, f.y - f.size * .7, f.size * 1.4, f.size * 1.4, h, t);
      let hits = 0;
      for (let i = 1; i < route.length; i++) {
        const object = route[i];
        if (object.distance > point.distance) break;
        const hit = timing.charge + object.distance / Math.max(1, totalDistance) * (chainEnd - timing.charge);
        const age = t - hit;
        if (object.id !== undefined) {
          hits++;
          eraseBreakoutRect(ctx, (object.x - object.width / 2) * w - 2, (object.y - object.height / 2) * h - 2, object.width * w + 4, object.height * h + 4, h, t);
          // Work expires after each short-lived impact, even in a full brick field.
          if (age < .5) fragments(ctx, object.x * w, object.y * h, age, object.color, object.id, f.size * 3, 6);
          if (age < .24) impact(ctx, object.x * w, object.y * h, age, '#ffce8d', f.size * 1.4);
        }
        if (age < .15 && i >= point.index - 5) {
          const before = route[i - 1], alpha = (1 - age / .15) * .6;
          streak(ctx, before.x * w, before.y * h, object.x * w, object.y * h, '#e66d54', 7, alpha);
          streak(ctx, before.x * w, before.y * h, object.x * w, object.y * h, '#ffe29f', 2, alpha);
        }
      }
      // The last brick overloads into an expanding four-way chain blast. Its
      // diamond passes all four corners, consuming the paddle, floor and sky too.
      if (t >= chainEnd) {
        const last = route[route.length - 1];
        const cx = last.x * w, cy = last.y * h;
        const reach = Math.max(Math.abs(cx), Math.abs(w - cx)) + Math.max(Math.abs(cy), Math.abs(h - cy)) + f.size * 4;
        const spread = ease(step(t, chainEnd, clearAt));
        const radius = reach * spread;
        const points = [[cx, cy - radius], [cx + radius, cy], [cx, cy + radius], [cx - radius, cy]];
        ctx.fillStyle = INK; ctx.beginPath();
        points.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.closePath(); ctx.fill();
        for (let i = 0; i < 4; i++) {
          const a = points[i], b = points[(i + 1) % 4];
          streak(ctx, a[0], a[1], b[0], b[1], '#ffad70', 6, (1 - spread) * .85);
          streak(ctx, lerp(cx, a[0], .94), lerp(cy, a[1], .94), lerp(cx, b[0], .94), lerp(cy, b[1], .94), '#ffe6a4', 3, (1 - spread) * .7);
        }
        impact(ctx, cx, cy, t - chainEnd, '#ffcb8c', f.size * 3);
      }
      for (let i = 8; i >= 1; i--) {
        const trail = ballPosition(Math.max(timing.charge, t - i * .012));
        ctx.save(); ctx.globalAlpha = (1 - i / 9) * .35 * (1 - step(t, timing.strike, timing.assemble + .1));
        ctx.fillStyle = i % 2 ? '#ffbd79' : '#ef7754';
        const size = f.size * (1 - i / 10);
        ctx.fillRect(trail.x * w - size / 2, trail.y * h - size / 2, size, size); ctx.restore();
      }
      const previous = ballPosition(Math.max(timing.charge, t - .025));
      const direction = Math.atan2((point.y - previous.y) * h, (point.x - previous.x) * w);
      comet(ctx, point.x * w, point.y * h, direction, f.size * 1.5, f.size * 4.2,
        ['#c95f48', '#ffba72', '#fff1b7'], 1 - step(t, timing.strike + .04, timing.assemble + .22));
      if (hits > 0 && t < timing.strike + .07) drawText(ctx, 'CHAIN ' + hits, point.x * w,
        Math.max(18, point.y * h - f.size * 1.8), { size: 8, color: '#ffe1a5' });
    }
    const settled = step(t, timing.strike, timing.assemble + .1);
    ctx.save(); ctx.globalAlpha = 1 - smooth(step(t, timing.assemble - .04, timing.assemble + .25));
    pixelRing(ctx, point.x * w, point.y * h, f.size * (.85 + settled * 2.2), '#ffcf8e', .72 * (1 - settled * .5), 3, 1, t, 24);
    drawMascot(ctx, point.x * w, point.y * h, f.size * 1.2, { rotation: t < timing.strike ? t * 6 : timing.strike * 6 });
    ctx.restore();
  }

  const flightEnd = Math.max(1 + actorSize / worldW * 7.5, origin.x + .35);
  const flightRoute = [{ ...origin }, ...objects.filter(object => kind === 'flappy' && object.x > origin.x + .025 && object.x <= 1 + object.width / 2).sort((a, b) => a.x - b.x)];
  flightRoute.push({ x: flightEnd, y: clamp(flightRoute[flightRoute.length - 1].y - .04) });
  function flightPosition(t) {
    const x = lerp(origin.x, flightEnd, smooth(step(t, timing.charge, clearAt)));
    let i = 1;
    while (i < flightRoute.length - 1 && flightRoute[i].x < x) i++;
    const a = flightRoute[i - 1], b = flightRoute[i];
    return { x, y: lerp(a.y, b.y, smooth(clamp((x - a.x) / Math.max(.001, b.x - a.x)))) };
  }
  function sweepHit(progress) {
    // Invert the smooth dash once per obstacle; fixed iterations stay bounded.
    let low = 0, high = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (low + high) / 2;
      if (smooth(mid) < progress) low = mid; else high = mid;
    }
    return lerp(timing.charge, clearAt, (low + high) / 2);
  }
  function flight(ctx, w, h, t, f) {
    const chargeP = step(t, 0, timing.charge), point = flightPosition(t);
    const x = point.x * w, y = point.y * h;
    const previous = flightPosition(Math.max(timing.charge, t - .018));
    const angle = Math.atan2((point.y - previous.y) * h, Math.max(.1, (point.x - previous.x) * w));
    const fade = 1 - smooth(step(t, timing.assemble - .04, timing.assemble + .25));
    if (t < timing.charge) {
      charge(ctx, f, t, '#8de6e5', 'SKYBREAK');
      // The bird opens two luminous pixel wings before committing to its gate line.
      wing(ctx, f.x, f.y, f.size * 1.7, -1, chargeP, '#85d5e6', .8);
      wing(ctx, f.x, f.y, f.size * 1.7, 1, chargeP, '#b8b5ff', .8);
      pixelRing(ctx, f.x + f.size * .3, f.y, f.size * (1.15 - chargeP * .3), '#bceff0', chargeP * .65, 3, 1.25, -t, 24);
    } else {
      const moving = 1 - step(t, timing.strike, timing.assemble + .12);
      ctx.fillStyle = INK; ctx.fillRect(0, 0, x + f.size * .65, h);
      // A curved comet follows real gap centers instead of a generic straight dash.
      for (let i = 3; i >= 1; i--) {
        const trail = flightPosition(Math.max(timing.charge, t - i * .055));
        ctx.save(); ctx.globalAlpha = (1 - i / 4) * .25 * moving;
        wing(ctx, trail.x * w, trail.y * h, f.size * 1.8, -1, 1, '#8de6e5');
        wing(ctx, trail.x * w, trail.y * h, f.size * 1.8, 1, 1, '#b8b5ff');
        drawMascot(ctx, trail.x * w, trail.y * h, f.size, { rotation: angle * .25 }); ctx.restore();
      }
      comet(ctx, x, y, angle, f.size * 1.65, f.size * (3 + moving * 2.5), ['#3e6b9d', '#8de6e5', '#e4fff6'], fade * .9);
      for (let i = 0; i < 18; i++) {
        const age = (t - timing.charge) * 1.2 + random(i);
        const q = age % 1, side = i % 2 ? 1 : -1;
        const featherX = x - q * f.size * 5;
        const featherY = y + side * (f.size * .6 + Math.sin(q * Math.PI) * f.size * 1.1);
        ctx.save(); ctx.globalAlpha = (1 - q) * moving * .7; ctx.fillStyle = i % 3 ? '#a3eaf0' : '#c9b8ff';
        ctx.fillRect(Math.round(featherX), Math.round(featherY), 9, 3);
        ctx.fillRect(Math.round(featherX - 4), Math.round(featherY + side * 3), 7, 3); ctx.restore();
      }
      for (const object of objects) {
        if (object.x <= origin.x || object.x > flightEnd) continue;
        const progress = clamp((object.x - origin.x) / (flightEnd - origin.x));
        const hit = sweepHit(progress);
        const age = t - hit;
        if (age < 0 || age > .65) continue;
        // Each actual gate breaks at both lips as the wing dash passes its gap.
        for (const side of [-1, 1]) {
          const edgeY = (object.y + side * object.gap * .5) * h;
          fragments(ctx, object.x * w, edgeY, age, side < 0 ? '#a3f2e0' : '#b8b5ff', object.id * 7 + side, f.size * 3, 8);
          impact(ctx, object.x * w, edgeY, age, '#d0fff2', f.size * 1.2);
        }
        pixelRing(ctx, object.x * w, object.y * h, f.size * (1 + age * 2), '#b6ffef', (1 - age / .65) * .6, 3, 1.4, 0, 24);
      }
      pixelRing(ctx, x + f.size * .2, y, f.size * (.82 + step(t, timing.strike, timing.assemble) * .6), '#9ce9ef', fade * .65, 3, 1.25, t, 24);
    }
    ctx.save(); ctx.globalAlpha = fade;
    if (t >= timing.charge) {
      wing(ctx, x, y, f.size * 1.8, -1, .95, '#8de6e5');
      wing(ctx, x, y, f.size * 1.8, 1, .95, '#b8b5ff');
    }
    drawMascot(ctx, x, y, f.size, { rotation: Math.max(-.3, Math.min(.3, angle * .3)), frame: t * 3 });
    ctx.restore();
  }

  function runner(ctx, w, h, t, f) {
    const chargeP = step(t, 0, timing.charge), runP = smooth(step(t, timing.charge, clearAt));
    const endX = Math.max(w + f.size * 7.5, f.x + w * .35), x = lerp(f.x, endX, runP);
    const groundY = f.floorY - f.size * .48;
    const y = lerp(f.y, groundY, step(t, timing.charge, timing.charge + .10));
    const moving = 1 - smooth(step(t, timing.strike, timing.assemble + .12));
    const fade = 1 - smooth(step(t, timing.assemble - .02, timing.assemble + .25));
    if (t < timing.charge) {
      charge(ctx, f, t, '#c9ff73', 'HYPERDRIVE');
      pixelRing(ctx, f.x, f.floorY, f.size * (1.9 - chargeP * .8), '#c9ff73', chargeP * .8, 4, .19, 0, 32);
      for (let i = 0; i < 4; i++) {
        const lead = f.x + f.size * (1.2 + i * .5 - chargeP * .3);
        streak(ctx, lead - 5, f.floorY - 14, lead + 3, f.floorY - 8, '#d7ffaf', 3, chargeP * (1 - i / 5));
        streak(ctx, lead + 3, f.floorY - 8, lead - 5, f.floorY - 2, '#d7ffaf', 3, chargeP * (1 - i / 5));
      }
    } else {
      const front = x + f.size * 1.25;
      const wakeStart = Math.max(0, x - f.size * 5.5);
      const wakeWidth = front - wakeStart;
      ctx.fillStyle = INK; ctx.fillRect(0, 0, front, h);
      // The low speed wake travels with the runner and follows it past the edge.
      ctx.save(); ctx.globalAlpha = fade;
      ctx.fillStyle = '#33533f'; ctx.fillRect(wakeStart, f.floorY - 1, wakeWidth, 11);
      ctx.fillStyle = '#c9ff73'; ctx.fillRect(wakeStart, f.floorY - 1, wakeWidth, 3);
      ctx.fillStyle = '#7bd6b0'; ctx.fillRect(wakeStart, f.floorY + 8, wakeWidth, 2);
      for (let i = 0; i < 22; i++) {
        const q = (i / 22 + t * .3) % 1, laneX = wakeStart + q * wakeWidth;
        ctx.fillStyle = i % 3 ? '#7cc89c' : '#e1ffaf';
        ctx.fillRect(Math.round(laneX), f.floorY + 14 + i % 3 * 6, 9 + i % 4 * 4, 2);
      }
      for (let i = 0; i < 9; i++) {
        const height = f.size * (1 - i / 10) * (1.05 + Math.sin(i * .6) * .22) * moving;
        const crestX = front - i * f.size * .13;
        ctx.fillStyle = i % 3 ? '#a8dd74' : '#e6ffb6';
        ctx.fillRect(Math.round(crestX), Math.round(f.floorY - height), Math.max(3, f.size * .10), Math.max(2, height));
      }
      ctx.restore();
      for (let i = 6; i >= 1; i--) {
        const trailP = smooth(step(t - i * .028, timing.charge, clearAt));
        const trailX = lerp(f.x, endX, trailP);
        ctx.save(); ctx.globalAlpha = (1 - i / 7) * .28 * moving;
        drawMascot(ctx, trailX, groundY, f.size, { rotation: .22, frame: t * 12 + i }); ctx.restore();
        ctx.save(); ctx.globalAlpha = (1 - i / 7) * .6 * moving; ctx.fillStyle = i % 2 ? '#c9ff73' : '#84dfbc';
        ctx.fillRect(trailX - f.size * .6, f.floorY - 5 + i % 2 * 2, f.size * .55, 3); ctx.restore();
      }
      for (const object of objects) {
        if (object.x * w < f.x - f.size || object.x * w > endX + f.size * 1.25) continue;
        const progress = clamp((object.x * w - f.size * 1.25 - f.x) / Math.max(1, endX - f.x));
        const hit = sweepHit(progress);
        const age = t - hit;
        fragments(ctx, object.x * w, object.y * h, age, object.color, object.id, f.size * 3.5, 10, true);
        impact(ctx, object.x * w, f.floorY - object.height * h * .45, age, '#dfffac', f.size * 1.8);
      }
      const skid = step(t, timing.strike - .06, timing.assemble + .1);
      pixelRing(ctx, x, f.floorY, f.size * (.9 + skid * 2), '#c9ff73', fade * .65, 3, .18, 0, 32);
      fragments(ctx, x - f.size * .4, f.floorY - 3, t - timing.strike + .04, '#c9ff73', 78, f.size * 2, 9, true);
    }
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y);
    const crouch = t < timing.charge ? Math.sin(chargeP * Math.PI * .8) * .13 : 0;
    ctx.scale(1 + crouch * .5, 1 - crouch);
    drawMascot(ctx, 0, 0, f.size, { rotation: t < timing.charge ? chargeP * .15 : .22 * moving, frame: t * 12 });
    ctx.restore();
  }

  return {
    ...timing,
    beat(t) { return t < timing.charge ? 'charge' : t < timing.strike ? 'strike' : 'aftermath'; },
    origin: (w, h) => frame(w, h),
    draw(ctx, w, h, t) {
      if (t >= timing.assemble + .36) return;
      const f = frame(w, h);
      ctx.save(); scene(ctx, w, h, t);
      if (kind === 'shooter') shooter(ctx, w, h, t, f);
      else if (kind === 'dodge') dodge(ctx, w, h, t, f);
      else if (kind === 'breakout') breakout(ctx, w, h, t, f);
      else if (kind === 'flappy') flight(ctx, w, h, t, f);
      else runner(ctx, w, h, t, f);
      ctx.restore();
    },
    destroy() { snapshot = null; }
  };
}
