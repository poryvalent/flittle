import * as THREE from "three";

/**
 * Fuses the scan's points into one continuous relief surface: the "real" man
 * the points settle into. The scan was taken from the front, so depth is
 * single-valued over (x, y): bin the points into a grid, keep a front-leaning
 * depth per cell, close small scan gaps from the neighbours, smooth the skin
 * lightly, and triangulate the filled cells. Normals come from the mesh.
 */
export function buildRelief(home: Float32Array, box: THREE.Box3, cells = 200): THREE.BufferGeometry {
  const n = home.length / 3;
  const sx = box.max.x - box.min.x, sy = box.max.y - box.min.y;
  const cell = Math.max(sx, sy) / cells;
  const W = Math.ceil(sx / cell) + 1, H = Math.ceil(sy / cell) + 1;
  const sum = new Float32Array(W * H);
  const top = new Float32Array(W * H).fill(-Infinity);
  const cnt = new Uint16Array(W * H);
  for (let i = 0; i < n; i++) {
    const gx = Math.min(W - 1, Math.floor((home[i * 3] - box.min.x) / cell));
    const gy = Math.min(H - 1, Math.floor((box.max.y - home[i * 3 + 1]) / cell));
    const k = gy * W + gx, z = home[i * 3 + 2];
    sum[k] += z;
    cnt[k]++;
    if (z > top[k]) top[k] = z;
  }
  const z = new Float32Array(W * H);
  let filled = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) {
    if (cnt[k]) {
      z[k] = 0.4 * (sum[k] / cnt[k]) + 0.6 * top[k];
      filled[k] = 1;
    }
  }

  // Close holes: a cell with three or more filled neighbours takes their mean.
  // Three passes seal scan gaps without growing the silhouette noticeably.
  for (let pass = 0; pass < 3; pass++) {
    const next = filled.slice();
    const nz = z.slice();
    for (let gy = 1; gy < H - 1; gy++) {
      for (let gx = 1; gx < W - 1; gx++) {
        const k = gy * W + gx;
        if (filled[k]) continue;
        let s = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const j = k + dy * W + dx;
            if (filled[j]) { s += z[j]; c++; }
          }
        }
        if (c >= 3) { nz[k] = s / c; next[k] = 1; }
      }
    }
    filled = next;
    z.set(nz);
  }

  // Two light smoothing passes take the scan noise out of the skin.
  for (let pass = 0; pass < 2; pass++) {
    const nz = z.slice();
    for (let gy = 1; gy < H - 1; gy++) {
      for (let gx = 1; gx < W - 1; gx++) {
        const k = gy * W + gx;
        if (!filled[k]) continue;
        let s = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const j = k + dy * W + dx;
            if (filled[j]) { s += z[j]; c++; }
          }
        }
        nz[k] = s / c;
      }
    }
    z.set(nz);
  }

  const index = new Int32Array(W * H).fill(-1);
  const pos: number[] = [];
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      const k = gy * W + gx;
      if (!filled[k]) continue;
      index[k] = pos.length / 3;
      pos.push(box.min.x + (gx + 0.5) * cell, box.max.y - (gy + 0.5) * cell, z[k]);
    }
  }
  const tri: number[] = [];
  for (let gy = 0; gy < H - 1; gy++) {
    for (let gx = 0; gx < W - 1; gx++) {
      const k = gy * W + gx;
      const a = index[k], b = index[k + 1], c = index[k + W], d = index[k + W + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      tri.push(a, c, b, b, c, d); // counter-clockwise seen from the camera (+z)
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(tri);
  geo.computeVertexNormals();
  return geo;
}
