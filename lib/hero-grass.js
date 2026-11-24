// A painted meadow material, not a per-frame particle effect. The canvas is
// generated once, shared by every village slot, and uploaded to WebGL once.
// All marks wrap across the tile edge so texture sampling never exposes seams.
let grassTexture;

export function createGrassTexture() {
  if (grassTexture) return grassTexture;

  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('The meadow material needs a 2D canvas.');

  // Fixed seed: resizing, scene rotation, and mascot capture share the same
  // blades rather than visibly changing the material underneath the wordmark.
  let seed = 0x51f1171e;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const between = (low, high) => low + random() * (high - low);
  const colour = (hue, saturation, lightness) =>
    `hsl(${hue} ${saturation}% ${lightness}%)`;

  function wrap(x, y, radius, draw) {
    const xs = [x], ys = [y];
    if (x < radius) xs.push(x + size);
    if (x > size - radius) xs.push(x - size);
    if (y < radius) ys.push(y + size);
    if (y > size - radius) ys.push(y - size);
    for (const yy of ys) for (const xx of xs) draw(xx, yy);
  }

  ctx.fillStyle = '#365e29';
  ctx.fillRect(0, 0, size, size);

  // Broad irregular changes in the undergrowth keep the lawn from reading as
  // flat green noise. These soft glades sit behind the crisp painted blades.
  for (let i = 0; i < 85; i++) {
    const x = between(0, size), y = between(0, size);
    const radius = between(35, 140);
    const light = i % 3 !== 0;
    wrap(x, y, radius, (xx, yy) => {
      const gradient = ctx.createRadialGradient(xx, yy, 0, xx, yy, radius);
      gradient.addColorStop(0, light ? 'rgba(160,167,52,.38)' : 'rgba(8,36,23,.52)');
      gradient.addColorStop(1, light ? 'rgba(160,167,52,0)' : 'rgba(8,36,23,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(xx - radius, yy - radius, radius * 2, radius * 2);
    });
  }

  function blade(x, y, height, width, lean, hue, saturation, lightness, highlight) {
    const radius = height + Math.abs(lean) + width;
    wrap(x, y, radius, (xx, yy) => {
      const tipX = xx + lean, tipY = yy - height;
      const middleX = xx + lean * .23;
      ctx.beginPath();
      ctx.moveTo(xx - width * .5, yy);
      ctx.quadraticCurveTo(middleX - width * .72, yy - height * .58, tipX, tipY);
      ctx.quadraticCurveTo(middleX + width * .72, yy - height * .42, xx + width * .5, yy);
      ctx.closePath();
      ctx.fillStyle = colour(hue, saturation, lightness);
      ctx.fill();

      // A lit folded face gives each tapered leaf an actual three-dimensional
      // shape. The fine dark/light edge is botanical, not a uniform line grid.
      if (highlight) {
        ctx.beginPath();
        ctx.moveTo(xx - width * .45, yy);
        ctx.quadraticCurveTo(middleX - width * .69, yy - height * .58, tipX, tipY);
        ctx.quadraticCurveTo(middleX - width * .08, yy - height * .46, xx, yy);
        ctx.closePath();
        ctx.fillStyle = colour(hue - 7, saturation + 5, lightness + 12);
        ctx.fill();
      }
    });
  }

  // Low, dark bent leaves fill the gaps; their larger forms are still visible
  // beneath the bright upright tufts, just like the foreground of the village.
  for (let i = 0; i < 2100; i++) {
    blade(between(0, size), between(0, size), between(13, 43), between(3, 8),
      between(-31, 31), between(80, 115), between(32, 51), between(16, 31), i % 3 === 0);
  }

  // Paint each meadow tuft back-to-front. Variation in width, bend, height and
  // sunlit faces makes recognisable grass rather than a uniform furry surface.
  const tufts = Array.from({ length: 470 }, () => ({
    x: between(0, size), y: between(0, size),
    height: between(25, 63), hue: between(76, 104), lightness: between(29, 44),
  })).sort((a, b) => a.y - b.y);
  for (const tuft of tufts) {
    const count = 7 + Math.floor(random() * 7);
    for (let j = 0; j < count; j++) {
      const spread = (j / (count - 1) - .5) * 2;
      blade((tuft.x + between(-13, 13) + size) % size,
        (tuft.y + between(-5, 5) + size) % size,
        tuft.height * between(.6, 1.3), between(3.5, 10),
        spread * between(14, 35) + between(-8, 14),
        tuft.hue + between(-6, 6), between(43, 63),
        tuft.lightness + between(-7, 7), j % 3 !== 0);
    }
  }

  // Occasional small clover patches break up the blade silhouettes without
  // turning the lettering into an all-over floral print.
  for (let i = 0; i < 42; i++) {
    const x = between(0, size), y = between(0, size), radius = between(5, 10);
    const rotation = between(0, Math.PI * 2);
    const hue = between(94, 123), lightness = between(29, 42);
    wrap(x, y, radius * 3, (xx, yy) => {
      for (let leaf = 0; leaf < 3; leaf++) {
        const angle = rotation + leaf * Math.PI * 2 / 3;
        const lx = xx + Math.cos(angle) * radius * .7;
        const ly = yy + Math.sin(angle) * radius * .7;
        ctx.beginPath();
        ctx.ellipse(lx + 1, ly + 2, radius, radius * .7, angle, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(12,40,18,.45)';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(lx, ly, radius, radius * .7, angle, 0, Math.PI * 2);
        ctx.fillStyle = colour(hue, 44, lightness);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(lx + Math.cos(angle) * radius * .7, ly + Math.sin(angle) * radius * .7);
        ctx.strokeStyle = colour(hue - 9, 47, lightness + 14);
        ctx.lineWidth = .85;
        ctx.stroke();
      }
    });
  }

  // A handful of cream daisies and tiny buttercups echo the sunlit meadow.
  // Their small size leaves the grass itself as the dominant material.
  for (let i = 0; i < 19; i++) {
    const x = between(0, size), y = between(0, size);
    const radius = between(4, 7), yellow = i % 3 === 0;
    const petals = yellow ? 5 : 7;
    const rotation = between(0, Math.PI * 2);
    wrap(x, y, radius * 2, (xx, yy) => {
      ctx.beginPath();
      ctx.ellipse(xx + 2, yy + 3, radius * 1.2, radius * .8, -.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(22,48,19,.45)';
      ctx.fill();
      for (let petal = 0; petal < petals; petal++) {
        const angle = rotation + petal * Math.PI * 2 / petals;
        ctx.beginPath();
        ctx.ellipse(xx + Math.cos(angle) * radius * .59,
          yy + Math.sin(angle) * radius * .48,
          radius * .58, radius * .28, angle, 0, Math.PI * 2);
        ctx.fillStyle = yellow ? '#f3ce4b' : petal % 2 ? '#fff2ce' : '#f9f7df';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(xx, yy, radius * .3, 0, Math.PI * 2);
      ctx.fillStyle = yellow ? '#bd7b17' : '#e7b52a';
      ctx.fill();
    });
  }

  grassTexture = canvas;
  return grassTexture;
}
