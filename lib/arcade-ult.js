import { drawMascot, drawText } from './arcade-art.js';

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

  function frame(w, h) {
    return { x: origin.x * w, y: origin.y * h, size: actorSize * w / worldW, floorY: floor * h };
  }
  function ring(ctx, x, y, radius, color, alpha, line = 2, squash = 1) {
    if (radius <= 0 || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = line;
    ctx.beginPath(); ctx.ellipse(x, y, radius, radius * squash, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function sparks(ctx, x, y, age, color, seed, spread = 90) {
    if (age < 0 || age > .65) return;
    const p = age / .65;
    ctx.save(); ctx.globalAlpha *= 1 - p; ctx.fillStyle = color;
    for (let j = 0; j < 7; j++) {
      const angle = random(seed * 13 + j) * Math.PI * 2;
      const distance = ease(p) * spread * (.4 + random(seed + j * 11) * .6);
      const size = Math.max(2, 6 * (1 - p));
      ctx.save(); ctx.translate(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance + p * p * 14);
      ctx.rotate(angle + p * 3); ctx.fillRect(-size / 2, -size / 2, size, size); ctx.restore();
    }
    ctx.restore();
  }
  function charge(ctx, f, t, color, label) {
    const p = step(t, 0, timing.charge);
    const radius = Math.max(34, f.size * .9);
    ring(ctx, f.x, f.y, radius * (1.35 - p * .55), color, .25 + p * .4, 2);
    ring(ctx, f.x, f.y, radius * (.55 + p * .16), '#eafaff', p * .5, 1);
    for (let i = 0; i < 24; i++) {
      const q = (p * 1.4 + random(i) * .85) % 1;
      const angle = i * Math.PI * 2 / 24 + p * .65;
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
    const distance = step(t, timing.charge, timing.strike) * totalDistance;
    let index = 1;
    while (index < route.length - 1 && route[index].distance < distance) index++;
    const a = route[index - 1], b = route[index];
    const p = clamp((distance - a.distance) / Math.max(1, b.distance - a.distance));
    return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), distance };
  }
  function scene(ctx, w, h, t) {
    if (!snapshot?.width || !snapshot?.height) return;
    ctx.save();
    ctx.globalAlpha = 1 - smooth(step(t, timing.strike + .05, timing.assemble + .06));
    ctx.drawImage(snapshot, 0, 0, w, h);
    ctx.restore();
  }

  function eraseBreakoutRect(ctx, x, y, w, h, viewportHeight, t) {
    // Restore the game's two sky bands, including their fade into the loader.
    // A solid INK patch is visibly darker than the still-visible game frame.
    const alpha = snapshot?.width && snapshot?.height ? 1 - smooth(step(t, timing.strike + .05, timing.assemble + .06)) : 0;
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
    if (t < timing.charge) {
      ctx.fillStyle = `rgba(8,9,11,${chargeP * .22})`; ctx.fillRect(0, 0, w, h);
      charge(ctx, f, t, '#bda8ff', 'ULTIMATE CHARGING');
    }
    if (t >= timing.charge) {
      const growth = ease(step(t, timing.charge, timing.charge + .18));
      const fade = 1 - smooth(step(t, 1.28, 1.62));
      const beamHalf = w * (.055 + p * .50) * growth;
      // The black silhouette first removes the struck part of the actual frame.
      const cone = () => {
        ctx.beginPath(); ctx.moveTo(f.x - f.size * .26, f.y - f.size * .15);
        ctx.lineTo(f.x - beamHalf, -20); ctx.lineTo(f.x + beamHalf, -20);
        ctx.lineTo(f.x + f.size * .26, f.y - f.size * .15); ctx.closePath();
      };
      ctx.fillStyle = INK; cone(); ctx.fill();
      const blast = ease(step(t, 1.06, timing.assemble));
      const radius = blast * Math.hypot(w, h) * 1.05;
      ctx.beginPath(); ctx.arc(f.x, f.y, radius, 0, Math.PI * 2); ctx.fill();
      // A single sustained bloom, never repeated whole-screen flashes.
      ctx.save(); ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(160,124,255,.22)'; cone(); ctx.fill();
      ctx.fillStyle = 'rgba(141,230,229,.52)';
      ctx.beginPath(); ctx.moveTo(f.x - f.size * .14, f.y - f.size * .25);
      ctx.lineTo(f.x - beamHalf * .48, -20); ctx.lineTo(f.x + beamHalf * .48, -20);
      ctx.lineTo(f.x + f.size * .14, f.y - f.size * .25); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e6fff2'; ctx.fillRect(f.x - Math.max(2, f.size * .045), 0, Math.max(4, f.size * .09), Math.max(0, f.y - f.size * .25));
      ctx.restore();
      ring(ctx, f.x, f.y, radius, '#a4f1ea', (1 - blast) * .68, 3);
      ring(ctx, f.x, f.y, radius * .91, '#bda8ff', (1 - blast) * .32, 1);
      for (const object of objects) {
        const distance = Math.hypot(object.x * w - f.x, object.y * h - f.y);
        const waveHit = 1.06 + (1 - Math.cbrt(1 - clamp(distance / (Math.hypot(w, h) * 1.05)))) * (timing.assemble - 1.06);
        let lower = timing.charge, upper = timing.strike;
        for (let i = 0; i < 8; i++) {
          const when = (lower + upper) / 2;
          const reach = w * (.055 + step(when, timing.charge, timing.strike) * .50) * ease(step(when, timing.charge, timing.charge + .18));
          const along = clamp((f.y - object.y * h) / Math.max(1, f.y));
          const half = lerp(f.size * .26, reach, along);
          if (object.y * h <= f.y && Math.abs(object.x * w - f.x) <= half) upper = when;
          else lower = when;
        }
        const hit = Math.min(waveHit, upper >= timing.strike - .004 ? Infinity : upper);
        if (t >= hit) {
          // The cone and expanding wave already erase the struck snapshot.
          // Only light/debris belongs above the beam, never opaque sprite masks.
          sparks(ctx, object.x * w, object.y * h, t - hit, object.color, object.id, Math.min(w, h) * .14);
          ring(ctx, object.x * w, object.y * h, Math.max(0, t - hit) * 85, object.color, Math.max(0, 1 - (t - hit) * 3) * .65);
        }
      }
    }
    const leave = smooth(step(t, 1.5, timing.assemble + .28));
    ctx.save(); ctx.globalAlpha = 1 - leave;
    drawMascot(ctx, f.x, f.y + Math.sin(p * Math.PI) * f.size * .1, f.size * (1 + Math.sin(chargeP * Math.PI) * .05), { thruster: true, frame: t * 3 });
    ctx.restore();
  }

  function dodge(ctx, w, h, t, f) {
    const slam = step(t, timing.charge, timing.charge + .16);
    const lift = t < timing.charge ? Math.sin(step(t, 0, timing.charge) * Math.PI / 2) * f.size * .45 : (1 - ease(slam)) * f.size * .45;
    // Remove the frozen sprite before drawing its jump and landing pose.
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * .7, 0, Math.PI * 2); ctx.fill();
    if (t < timing.charge) charge(ctx, { ...f, y: f.y - lift }, t, '#c9ff73', 'SHIELD OVERDRIVE');
    const impact = timing.charge + .12;
    const wave = ease(step(t, impact, timing.assemble));
    const radius = wave * Math.hypot(w, h);
    if (t > impact) {
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(f.x, f.floorY, radius, 0, Math.PI * 2); ctx.fill();
      ring(ctx, f.x, f.floorY, radius, '#c9ff73', (1 - wave) * .7, 3);
      ring(ctx, f.x, f.floorY, radius * .92, '#8de6e5', (1 - wave) * .3, 1);
      ring(ctx, f.x, f.floorY, radius * 1.4, '#e4ffba', (1 - wave) * .6, 2, .16);
      for (const object of objects) {
        const distance = Math.hypot(object.x * w - f.x, object.y * h - f.floorY);
        const hit = impact + (1 - Math.cbrt(1 - clamp(distance / Math.hypot(w, h)))) * (timing.assemble - impact);
        if (t >= hit) {
          ctx.fillStyle = INK; ctx.fillRect((object.x - object.width * .6) * w, (object.y - object.height * .6) * h, object.width * w * 1.2, object.height * h * 1.2);
          sparks(ctx, object.x * w, object.y * h, t - hit, object.color, object.id, Math.min(w, h) * .16);
        }
      }
      const collect = smooth(step(t, 1.1, timing.assemble + .35));
      const list = pickups.length ? pickups : Array.from({ length: 9 }, (_, i) => ({ x: .1 + i * .1, y: .18 + random(i) * .25, size: .018 }));
      list.forEach((star, i) => {
        const x = lerp(star.x * w, w * (.22 + i / Math.max(1, list.length - 1) * .56), collect);
        const y = lerp(star.y * h, h * .5, collect) - Math.sin(collect * Math.PI) * 48;
        const size = Math.max(4, Math.min(14, star.size * w)) * (1 - collect * .4);
        ctx.save(); ctx.globalAlpha = 1 - smooth(step(t, timing.assemble + .1, timing.assemble + .35));
        ctx.fillStyle = '#ffe7a0'; ctx.fillRect(x - size * .18, y - size * .5, size * .36, size);
        ctx.fillRect(x - size * .5, y - size * .18, size, size * .36); ctx.restore();
      });
    }
    ctx.save(); ctx.globalAlpha = 1 - smooth(step(t, 1.4, timing.assemble + .25));
    drawMascot(ctx, f.x, f.y - lift + Math.sin(slam * Math.PI) * f.size * .1, f.size, { frame: t });
    ctx.restore();
  }

  function breakout(ctx, w, h, t, f) {
    if (t < timing.charge) charge(ctx, f, t, '#ffbf91', 'ONE SHOT. EVERY BRICK.');
    const point = ballPosition(t);
    if (t >= timing.charge) {
      eraseBreakoutRect(ctx, f.x - f.size * .7, f.y - f.size * .7, f.size * 1.4, f.size * 1.4, h, t);
      for (const object of route.slice(1)) {
        if (object.id === undefined || object.distance > point.distance) continue;
        const hit = timing.charge + object.distance / totalDistance * (timing.strike - timing.charge);
        eraseBreakoutRect(ctx, (object.x - object.width / 2) * w - 2, (object.y - object.height / 2) * h - 2, object.width * w + 4, object.height * h + 4, h, t);
        sparks(ctx, object.x * w, object.y * h, t - hit, object.color, object.id, 46);
      }
      for (let i = 7; i >= 1; i--) {
        const trail = ballPosition(Math.max(timing.charge, t - i * .015));
        ctx.globalAlpha = (1 - i / 8) * .45; ctx.fillStyle = '#ffddab';
        ctx.fillRect(trail.x * w - 4, trail.y * h - 4, 8, 8);
      }
      ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.globalAlpha = 1 - smooth(step(t, timing.strike, timing.assemble + .1));
    ring(ctx, point.x * w, point.y * h, f.size * .74, '#ffe4af', .6, 2);
    drawMascot(ctx, point.x * w, point.y * h, f.size * 1.15, { rotation: t * 5 }); ctx.restore();
  }

  function dash(ctx, w, h, t, f) {
    const runner = kind === 'runner';
    const chargeP = step(t, 0, timing.charge);
    if (t < timing.charge) charge(ctx, f, t, runner ? '#c9ff73' : '#8de6e5', runner ? 'HYPERDASH READY' : 'SKYBREAK READY');
    const p = ease(step(t, timing.charge, timing.strike));
    const x = lerp(f.x, w + f.size, p);
    const y = f.y - Math.sin(p * Math.PI) * (runner ? f.size * .9 : Math.min(h * .12, 65));
    if (t >= timing.charge) {
      // The wake consumes the current scenery and every gate it passes.
      const wipe = lerp(0, x, step(t, timing.charge, timing.charge + .1));
      ctx.fillStyle = INK; ctx.fillRect(0, 0, wipe, h);
      for (let i = 0; i < 28; i++) {
        const sy = (random(i + 9) * h);
        const length = 14 + random(i + 61) * w * .15;
        ctx.globalAlpha = (1 - p) * (.15 + random(i) * .3); ctx.fillStyle = i % 3 ? '#8de6e5' : '#c9ff73';
        ctx.fillRect(x - random(i + 111) * w * .7, sy, length, i % 4 ? 1 : 3);
      }
      ctx.globalAlpha = 1;
      for (const object of objects) {
        const crossed = clamp((object.x * w - f.x) / Math.max(1, w + f.size - f.x));
        const hit = timing.charge + (1 - Math.cbrt(1 - crossed)) * (timing.strike - timing.charge);
        if (t >= hit) sparks(ctx, object.x * w, runner ? f.floorY - object.height * h / 2 : object.y * h, t - hit, object.color, object.id, runner ? 85 : 110);
      }
      for (let i = 4; i >= 1; i--) {
        ctx.save(); ctx.globalAlpha = (1 - p) * (1 - i / 5) * .24;
        drawMascot(ctx, x - i * f.size * .48, y + i * 2, f.size, { rotation: runner ? -.15 : .2 }); ctx.restore();
      }
      ring(ctx, x, y, f.size * .7, runner ? '#c9ff73' : '#8de6e5', (1 - p) * .75, 2, 1.3);
      if (runner) { ctx.fillStyle = '#9fd082'; ctx.globalAlpha = (1 - p) * .7; ctx.fillRect(0, f.floorY, Math.min(w, x), 2); ctx.globalAlpha = 1; }
    }
    const lean = t < timing.charge ? chargeP * .2 : runner ? -.18 : .15;
    drawMascot(ctx, x, y, f.size, { rotation: lean, frame: t * 8 });
  }

  return {
    ...timing,
    beat(t) { return t < timing.charge ? 'charge' : t < timing.strike ? 'strike' : t < timing.assemble ? 'aftermath' : t < timing.duration ? 'forming' : 'waiting'; },
    origin: (w, h) => frame(w, h),
    draw(ctx, w, h, t) {
      if (t >= timing.assemble + .36) return;
      const f = frame(w, h);
      ctx.save(); scene(ctx, w, h, t);
      if (kind === 'shooter') shooter(ctx, w, h, t, f);
      else if (kind === 'dodge') dodge(ctx, w, h, t, f);
      else if (kind === 'breakout') breakout(ctx, w, h, t, f);
      else dash(ctx, w, h, t, f);
      ctx.restore();
    },
    destroy() { snapshot = null; }
  };
}
