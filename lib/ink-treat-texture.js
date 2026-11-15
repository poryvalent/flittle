import { createTreatSprites } from './hover-treat-art.js';

let texture;
const size = 512;
const tau = Math.PI * 2;

// A seamless sheet of marbled frosting and tiny sweet illustrations.
// Only the hero's watery logo intersection reveals this pre-rendered texture.
export function createTreatTexture() {
  if (texture) return texture;
  texture = document.createElement('canvas');
  texture.width = texture.height = size;
  const ctx = texture.getContext('2d');
  if (!ctx) return texture;

  ctx.fillStyle = '#ffedcd';
  ctx.fillRect(0, 0, size, size);
  const palette = ['#f6c5dc', '#dfcef3', '#c4e9df', '#ffebbf', '#c6e5f3', '#f9d1d6'];
  const wave = (x, band) => {
    const phase = (band % palette.length) * .83;
    return band * size / palette.length + 23 * Math.sin(x * tau / size + phase)
      + 10 * Math.sin(x * tau * 2 / size - phase * .7);
  };
  // Every boundary is periodic in x; the last band joins the first in y.
  for (let wrap = -1; wrap <= 1; wrap++) {
    for (let band = 0; band < palette.length; band++) {
      const offset = wrap * size;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 4) {
        const y = wave(x, band) + offset;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let x = size; x >= 0; x -= 4) ctx.lineTo(x, wave(x, band + 1) + offset);
      ctx.closePath(); ctx.fillStyle = palette[band]; ctx.fill();
      // Narrow cream ribbons make the colored bands feel like folded icing.
      ctx.beginPath();
      for (let x = 0; x <= size; x += 4) {
        const y = wave(x, band) + offset + 8 + 3 * Math.sin(x * tau / size);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#fff7e5'; ctx.lineWidth = 4; ctx.globalAlpha = .58; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  const sprites = createTreatSprites();
  const stamp = (name, x, y, width, rotation = 0) => {
    // Repeat edge-crossing artwork so WebGL REPEAT never exposes a seam.
    for (let row = -1; row <= 1; row++) for (let col = -1; col <= 1; col++) {
      ctx.save(); ctx.translate(x + col * size, y + row * size); ctx.rotate(rotation);
      ctx.drawImage(sprites[name], -width / 2, -width / 2, width, width); ctx.restore();
    }
  };
  [
    [38, 47, 82, -.18], [208, 91, 76, .16], [384, 27, 84, -.1],
    [114, 218, 79, .12], [303, 242, 84, -.16], [480, 184, 76, .18],
    [46, 405, 80, -.13], [234, 418, 77, .16], [417, 416, 84, -.08],
  ].forEach(([x, y, width, angle], i) => stamp(i % 2 ? 'cupcakeBlue' : 'cupcakePink', x, y, width, angle));
  [
    ['heart', 120, 96, 38, -.2], ['star', 301, 50, 43, .2],
    ['star', 461, 96, 35, -.14], ['heart', 30, 237, 40, .2],
    ['heart', 210, 182, 36, -.15], ['star', 393, 252, 41, .3],
    ['star', 146, 351, 43, -.1], ['heart', 314, 365, 40, .15],
    ['heart', 501, 329, 35, -.3], ['star', 326, 491, 36, -.2],
    ['heart', 134, 492, 34, .22],
  ].forEach(args => stamp(...args));

  // Fixed sugar flecks add texture without introducing per-frame work or noise.
  const flecks = ['#b39acb', '#e78da6', '#87bfb5', '#f1c278', '#fffaf1'];
  for (let i = 0; i < 48; i++) {
    const x = (i * 137 + 62) % size;
    const y = (i * 83 + 131) % size;
    const angle = i * 2.399;
    for (let row = -1; row <= 1; row++) for (let col = -1; col <= 1; col++) {
      ctx.save(); ctx.translate(x + col * size, y + row * size); ctx.rotate(angle);
      ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0);
      ctx.lineCap = 'round'; ctx.lineWidth = i % 4 === 0 ? 3 : 2.2;
      ctx.strokeStyle = flecks[i % flecks.length]; ctx.stroke(); ctx.restore();
    }
  }
  return texture;
}
