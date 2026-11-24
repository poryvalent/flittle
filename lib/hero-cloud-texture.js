// The Dreamy material uses the actual lavender cloud bank in the scene artwork.
// It is cropped and made repeatable once, then shared by the lettering and cat.
// Pass the already decoded prepareHeroArtwork(...).world image: no extra image,
// network request, media player, animation canvas, or texture unit is created.
let cloudTexture;

export function createCloudTexture(worldImage) {
  if (cloudTexture) return cloudTexture;
  const width = worldImage?.naturalWidth || worldImage?.width;
  const height = worldImage?.naturalHeight || worldImage?.height;
  if (!width || !height) throw new Error('The cloud material needs decoded Wonder artwork.');

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error('The cloud material needs a 2D canvas.');
  // This close view contains only rounded cloud volumes: no mountains, portal,
  // flat horizon, or crystal foreground. The scene supplies the lighting too.
  ctx.drawImage(worldImage,
    width * .55, height * .30, width * .23, height * .39,
    0, 0, size, size);

  const source = ctx.getImageData(0, 0, size, size);
  const output = ctx.createImageData(size, size);
  const pixels = source.data, result = output.data;
  const blendBand = size * .13;
  const edgeBlend = Array.from({ length: size }, (_, position) => {
    const t = Math.min(1, Math.min(position, size - 1 - position) / blendBand);
    return .5 * (1 - t * t * (3 - 2 * t));
  });
  // Blend only the outer strips with their opposite edge. Unlike a mirrored
  // four-quadrant tile, this keeps the central cloud shapes asymmetrical and
  // detailed. Corresponding border pixels become identical for clean repeats.
  for (let y = 0; y < size; y++) {
    const otherY = size - 1 - y;
    const wy = edgeBlend[y];
    for (let x = 0; x < size; x++) {
      const otherX = size - 1 - x;
      const wx = edgeBlend[x];
      const a = (y * size + x) * 4;
      const b = (y * size + otherX) * 4;
      const c = (otherY * size + x) * 4;
      const d = (otherY * size + otherX) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const front = pixels[a + channel] * (1 - wx) + pixels[b + channel] * wx;
        const back = pixels[c + channel] * (1 - wx) + pixels[d + channel] * wx;
        result[a + channel] = Math.round(front * (1 - wy) + back * wy);
      }
      result[a + 3] = 255;
    }
  }
  ctx.putImageData(output, 0, 0);
  cloudTexture = canvas;
  return cloudTexture;
}
