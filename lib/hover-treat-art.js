// Tiny, reusable sweet illustrations, pre-rendered once for the hero ink texture.
let sprites;
const ink = '#54434d';
const wrapper = 'M29 68 L39 103 Q64 113 89 103 L99 68 Z';
const frosting = 'M27 72 C16 68 20 53 32 50 C27 39 36 29 48 32 C47 23 59 24 65 16 C67 25 81 25 84 34 C97 31 105 41 101 51 C114 56 111 69 101 73 C86 80 76 72 65 77 C52 72 43 80 27 72 Z';

function sticker(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.lineJoin = ctx.lineCap = 'round';
    draw(ctx);
  }
  return canvas;
}

function shape(ctx, data, color, edge = true) {
  const path = new Path2D(data);
  if (edge) { ctx.strokeStyle = '#fffaf5'; ctx.lineWidth = 10; ctx.stroke(path); }
  ctx.fillStyle = color; ctx.fill(path);
  ctx.strokeStyle = ink; ctx.lineWidth = 2.7; ctx.stroke(path);
}

function line(ctx, data, color = ink, width = 2.5) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(new Path2D(data));
}

function dot(ctx, x, y, radius, color) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}

function cupcake(blue) {
  return sticker(ctx => {
    // Lay down the shared white silhouette before adding interior details.
    ctx.strokeStyle = '#fffaf5'; ctx.lineWidth = 10;
    ctx.stroke(new Path2D(wrapper)); ctx.stroke(new Path2D(frosting));
    shape(ctx, wrapper, blue ? '#e4d1f5' : '#c9ece0', false);
    line(ctx, 'M40 75 L46 102 M52 77 L55 106 M77 77 L74 106 M88 75 L82 102', blue ? '#b49bcf' : '#93c9ba', 2);
    const icing = ctx.createLinearGradient(0, 24, 0, 78);
    icing.addColorStop(0, blue ? '#e1f4ff' : '#ffe6ee');
    icing.addColorStop(1, blue ? '#aadcf4' : '#f6b7d0');
    shape(ctx, frosting, icing, false);
    line(ctx, 'M34 50 Q49 56 65 48 M51 34 Q66 40 80 34 M28 65 Q46 72 56 64 M76 58 Q90 62 99 54', blue ? '#81bdd8' : '#d78cae', 2.3);
    line(ctx, 'M41 42 L46 40 M79 46 L83 49 M63 63 L68 62', '#fffaf5', 3.3);
    line(ctx, 'M34 60 L38 62', '#f6d37e', 3.2);
    line(ctx, 'M88 66 L92 64', blue ? '#f3a5bf' : '#b9a3d7', 3.2);
    // A pair of rosy cheeks and a small smile on the pleated paper cup.
    dot(ctx, 49, 90, 4, '#f0a6b5'); dot(ctx, 79, 90, 4, '#f0a6b5');
    dot(ctx, 55, 86, 2.5, ink); dot(ctx, 73, 86, 2.5, ink);
    line(ctx, 'M60 92 Q64 97 68 92', ink, 2.3);
    shape(ctx, 'M67 25 C57 29 55 16 61 13 C66 9 76 13 74 20 Q73 27 67 25 Z', '#ed7e9a');
    line(ctx, 'M66 14 Q64 8 71 6', '#789c77', 2.7);
    dot(ctx, 62.5, 17, 1.8, '#fff4eb');
  });
}

export function createTreatSprites() {
  if (sprites) return sprites;
  const cupcakePink = cupcake(false);
  sprites = {
    cupcake: cupcakePink,
    cupcakePink,
    cupcakeBlue: cupcake(true),
    heart: sticker(ctx => {
      shape(ctx, 'M64 104 C49 91 22 73 22 48 C22 25 49 20 64 40 C79 20 106 25 106 48 C106 73 79 91 64 104 Z', '#f6b3cb');
      line(ctx, 'M32 47 Q33 34 46 34', '#fff1f4', 5);
      dot(ctx, 51, 61, 2.8, ink); dot(ctx, 77, 61, 2.8, ink);
      dot(ctx, 43, 70, 4, '#e994b5'); dot(ctx, 85, 70, 4, '#e994b5');
      line(ctx, 'M59 70 Q64 76 69 70');
    }),
    star: sticker(ctx => {
      shape(ctx, 'M64 18 Q67 17 70 24 L80 45 L104 48 Q112 49 106 56 L88 73 L92 98 Q93 106 86 102 L64 90 L42 102 Q35 106 36 98 L40 73 L22 56 Q16 49 24 48 L48 45 L58 24 Q61 17 64 18 Z', '#f8dda0');
      line(ctx, 'M54 47 L62 30', '#fff7d9', 4);
      dot(ctx, 53, 64, 2.6, ink); dot(ctx, 75, 64, 2.6, ink);
      line(ctx, 'M60 73 Q64 77 68 73', ink, 2.2);
      dot(ctx, 46, 72, 3.4, '#efb7a2'); dot(ctx, 82, 72, 3.4, '#efb7a2');
    }),
    sprinkle: sticker(ctx => {
      shape(ctx, 'M31 64 L74 34 Q83 28 89 37 Q95 46 87 52 L44 82 Q35 88 29 79 Q24 70 31 64 Z', '#ccb8ef');
      line(ctx, 'M39 67 L77 41', '#eee5ff', 4);
    }),
  };
  return sprites;
}
