# Hero hover reference textures

These are the user's original uploaded PNGs, copied without re-encoding, cropping, or image generation.

- `cosmic-flow.png` (736 × 1308): the flowing cosmic light reference, used beneath the pointer trail.
- `neon-vault.png` (474 × 474): the mirrored triangular cyan/magenta corridor reference, used inside the lettering and mascot.

`lib/ink.js` decodes and uploads them once before cover readiness. `lib/hero-neon.js` applies the motion, silhouette masks and highlights at render time. The paper background, original logo colours and doodles remain visible outside the trail.
