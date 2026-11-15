// A procedural night drive. No video downloads or per-frame video texture uploads.
export const neonFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTrail, uText;
uniform float uTime;
uniform vec2 uRes;
uniform vec4 uCatBounds;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float beam(float distance, float width) {
  float d = abs(distance) / max(width, 0.0001);
  return exp(-d * d) + 0.22 * exp(-d * 0.24);
}
float trailAt(vec2 uv) { return texture2D(uTrail, vec2(uv.x, 1.0 - uv.y)).r; }

vec3 nightDrive(vec2 uv, float time) {
  vec2 p = (uv - vec2(0.5, 0.57)) * vec2(uRes.x / uRes.y, 1.0);
  float radius = length(p);
  vec3 cyan = vec3(0.025, 0.72, 1.0);
  vec3 pink = vec3(1.0, 0.025, 0.36);
  vec3 amber = vec3(1.0, 0.29, 0.025);
  vec3 col = vec3(0.004, 0.008, 0.026);
  col += vec3(0.05, 0.015, 0.14) * exp(-radius * 4.0);

  // Small crisp stars, with different depths rather than a noisy cloud texture.
  for (int layer = 0; layer < 2; layer++) {
    float layerF = float(layer);
    vec2 starUV = p * (67.0 + layerF * 38.0) + vec2(time * 0.035, layerF * 21.3);
    vec2 id = floor(starUV), cell = fract(starUV);
    float seed = hash(id + layerF);
    vec2 center = vec2(hash(id + 9.1), hash(id + 25.7)) * 0.7 + 0.15;
    float star = exp(-length(cell - center) * 42.0) * step(0.955, seed);
    col += mix(vec3(0.35, 0.53, 1.0), vec3(0.85, 0.96, 1.0), seed) * star * 2.6;
  }

  // Fine outward streaks give the sky the reference's feeling of travelling through light.
  float angle = atan(p.y, p.x) / 6.2831853 + 0.5;
  float sector = floor(angle * 114.0);
  float seed = hash(vec2(sector, 7.0));
  float ray = beam((fract(angle * 114.0) - 0.5) * radius, 0.0024);
  float flight = fract(log(radius + 0.035) * 0.45 - time * 0.18 + seed * 5.0);
  float streak = smoothstep(0.32, 0.49, flight) * (1.0 - smoothstep(0.51, 0.76, flight));
  vec3 rayColor = mix(cyan, pink, step(0.56, seed));
  rayColor = mix(rayColor, amber, step(0.86, seed));
  col += rayColor * ray * streak * smoothstep(0.035, 0.30, radius) * (0.20 + seed * 0.45);

  // Curving, individually defined light fibres cross the sky and the road.
  // Their narrow bright cores keep the reference's colour without a smoky fill.
  float turn = atan(p.y, p.x) + sin(log(radius + 0.08) * 2.0 - time * 0.18) * 0.16;
  for (int fibre = 0; fibre < 5; fibre++) {
    float i = float(fibre);
    float direction = -0.58 + (i - 2.0) * 0.038;
    float curve = sin(radius * 5.5 - time * 0.30 + i * 0.8) * 0.018;
    float d = sin(turn - direction + curve) * radius;
    vec3 fibreColor = mix(cyan, pink, mod(i, 2.0));
    fibreColor = mix(fibreColor, amber, step(3.5, i));
    float travellingLight = 0.65 + 0.35 * sin(radius * 18.0 - time * 1.2 + i);
    col += fibreColor * beam(d, 0.0014 + radius * 0.0013) * travellingLight * 1.25;
    col += fibreColor * exp(-abs(d) / 0.016) * 0.075;
  }

  float depth = -p.y;
  if (depth > 0.0) {
    float z = 0.34 / max(depth, 0.012);
    float x = p.x * z;
    float distanceFade = smoothstep(0.015, 0.15, depth);
    float bend = sin(z * 0.13 + time * 0.10) * 0.13;
    x += bend;

    // Perspective road tiles flow toward the viewer, with brighter rails beside them.
    float gridX = abs(fract(x * 1.7 + 0.5) - 0.5) / 1.7;
    float gridZ = abs(fract(z * 1.5 + time * 0.90) - 0.5) / 1.5;
    float grid = beam(gridX, z * 0.0012) * 0.32;
    grid += beam(gridZ, z * z * 0.0010) * 0.30;
    col += mix(vec3(0.23, 0.035, 0.70), cyan, 0.2) * grid * distanceFade;

    for (int rail = 0; rail < 6; rail++) {
      float i = float(rail);
      float side = mod(i, 2.0) * 2.0 - 1.0;
      float lane = side * (0.10 + floor(i * 0.5) * 0.23);
      float wave = sin(z * 0.48 + i * 1.8 - time * 0.30) * (0.025 + i * 0.006);
      float railDistance = (x - lane - wave) / z;
      vec3 railColor = mix(cyan, pink, mod(i, 2.0));
      railColor = mix(railColor, amber, step(3.5, i));
      float pulse = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(z * 2.1 + time * 2.2 + i), 5.0);
      col += railColor * beam(railDistance, 0.0020 + depth * 0.003) * pulse * 1.9 * distanceFade;
      col += railColor * exp(-abs(railDistance) * 65.0) * 0.10 * distanceFade;
    }
    // Short white/cyan lane markers make the forward motion immediately readable.
    float dash = smoothstep(0.45, 0.50, fract(z * 0.8 + time * 0.48));
    col += vec3(0.46, 0.87, 1.0) * beam(x / z, 0.0013) * dash * distanceFade * 0.8;
  }
  col += vec3(0.19, 0.24, 0.55) * exp(-radius * 75.0) * 0.7;
  return 1.0 - exp(-col * 1.25);
}

vec3 techMaterial(vec2 uv, vec4 tx, float inCat, float edge, float time) {
  vec2 pixels = uv * vec2(uRes.x / uRes.y, 1.0) * 55.0;
  vec2 id = floor(pixels), cell = fract(pixels);
  if (hash(id) > 0.5) cell = cell.yx;
  if (hash(id + 12.7) > 0.5) cell.x = 1.0 - cell.x;
  // Tiny right-angle tracks and contact points sit inside an opaque luminous surface.
  float horizontal = (1.0 - smoothstep(0.025, 0.055, abs(cell.y - 0.5)))
                   * step(0.16, cell.x) * step(cell.x, 0.76);
  float vertical = (1.0 - smoothstep(0.025, 0.055, abs(cell.x - 0.76)))
                 * step(0.20, cell.y) * step(cell.y, 0.50);
  float node = 1.0 - smoothstep(0.045, 0.085, length(cell - vec2(0.16, 0.5)));
  float circuit = max(horizontal, vertical) * step(0.30, hash(id + 4.5));
  float sheen = pow(0.5 + 0.5 * sin(uv.y * 23.0 + uv.x * 6.0 - time * 0.7), 4.0);
  vec3 metal = mix(vec3(0.12, 0.78, 0.92), vec3(0.80, 1.0, 1.0), sheen);
  metal = mix(metal, vec3(0.025, 0.34, 0.48), circuit * 0.32);
  metal = mix(metal, vec3(0.85, 1.0, 0.72), node * step(0.68, hash(id)) * (0.55 + 0.25 * sin(time + hash(id) * 6.28)));
  if (inCat > 0.5) {
    float blueBody = smoothstep(0.04, 0.20, tx.b - tx.r);
    metal = mix(tx.rgb, mix(metal, vec3(0.52, 0.86, 1.0), 0.28), blueBody);
  }
  return mix(metal, vec3(0.86, 1.0, 1.0), edge * 0.94);
}

void main() {
  vec2 uv = vUv;
  // A smooth energy aperture follows the existing pointer trail, without boiling smoke.
  vec2 drift = vec2(sin(uv.y * 24.0 + uTime * 0.6), cos(uv.x * 21.0 - uTime * 0.5)) * 0.002;
  float trail = trailAt(uv + drift);
  float mask = smoothstep(0.37, 0.43, trail);
  if (mask < 0.001) { gl_FragColor = vec4(0.0); return; }

  vec3 scene = nightDrive(uv, uTime);
  vec2 tuv = vec2(uv.x, 1.0 - uv.y);
  vec4 tx = texture2D(uText, tuv);
  vec2 px = vec2(2.7) / uRes;
  vec4 neighbours = vec4(texture2D(uText, tuv + vec2(px.x, 0.0)).a,
                         texture2D(uText, tuv - vec2(px.x, 0.0)).a,
                         texture2D(uText, tuv + vec2(0.0, px.y)).a,
                         texture2D(uText, tuv - vec2(0.0, px.y)).a);
  float inside = min(min(neighbours.x, neighbours.y), min(neighbours.z, neighbours.w));
  float outside = max(max(neighbours.x, neighbours.y), max(neighbours.z, neighbours.w));
  scene += vec3(0.035, 0.32, 0.40) * outside * (1.0 - tx.a);
  if (tx.a > 0.001) {
    float inCat = step(uCatBounds.x, tuv.x) * step(tuv.x, uCatBounds.z)
                * step(uCatBounds.y, tuv.y) * step(tuv.y, uCatBounds.w);
    float edge = 1.0 - smoothstep(0.15, 0.9, inside);
    scene = mix(scene, techMaterial(tuv, tx, inCat, edge, uTime), tx.a);
  }
  float rim = (1.0 - smoothstep(0.43, 0.49, trail)) * (1.0 - tx.a);
  scene += vec3(0.06, 0.40, 0.55) * rim * 0.23;
  gl_FragColor = vec4(scene * mask, mask);
}
`;
