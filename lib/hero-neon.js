// Any two worlds share the same lightweight reveal renderer.
export const neonFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTrail, uText;
uniform sampler2D uWorld0A, uWorld0B, uWorld0Overlay;
uniform sampler2D uWorld1A, uWorld1B, uWorld1Overlay;
uniform float uTime, uBlend, uCaptureMascot, uHideMascot;
uniform float uWorld0Kind, uWorld0Aspect, uWorld0Focus, uWorld0Mix, uWorld0Shade, uWorld0Material;
uniform float uWorld1Kind, uWorld1Aspect, uWorld1Focus, uWorld1Mix, uWorld1Shade, uWorld1Material;
uniform vec2 uWorld0Layers, uWorld1Layers, uRes, uPointer;
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

vec3 sunnyVillage(vec2 uv, float time, sampler2D landscape, float imageAspect, float focus) {
  // Match object-fit: cover in the decoded HTML fallback, including on phones.
  float aspect = uRes.x / uRes.y;
  vec2 crop = vec2(min(1.0, aspect / imageAspect), min(1.0, imageAspect / aspect));
  vec2 source = (vec2(uv.x, 1.0 - uv.y) - 0.5) * crop * 0.985 + 0.5;
  source.x += (focus - 0.5) * (1.0 - crop.x);
  vec3 original = texture2D(landscape, source).rgb;
  float green = smoothstep(0.005, 0.10, original.g - original.r)
              * smoothstep(0.02, 0.13, original.g - original.b);
  float foreground = smoothstep(0.50, 0.95, source.y);
  float canopy = (1.0 - smoothstep(0.20, 0.42, source.y))
               * (1.0 - smoothstep(0.28, 0.58, source.x));
  float leaves = green * max(foreground, canopy);
  // Breeze moves leaves and grass by a few pixels. Buildings stay anchored.
  source.x += sin(source.y * 35.0 + time * 1.3) * 0.0017 * leaves;
  source.y += sin(source.x * 41.0 + time * 0.9) * 0.0008 * leaves;
  // Small cloud drift deforms only the pale sky; it never pans the whole village.
  float sky = (1.0 - smoothstep(0.32, 0.47, source.y)) * (1.0 - green);
  float cloud = smoothstep(0.66, 0.9, min(original.r, original.g));
  source.x += sin(time * 0.16 + source.y * 8.0) * 0.003 * sky * cloud;
  vec3 color = texture2D(landscape, source).rgb;
  // Sun catches the stream, with ripples confined to its blue lower-right water.
  float water = smoothstep(0.60, 0.77, source.x) * smoothstep(0.64, 0.80, source.y)
              * smoothstep(0.025, 0.11, original.b - original.r);
  float ripple = sin(source.y * 330.0 + source.x * 58.0 - time * 2.2)
               * sin(source.y * 195.0 - source.x * 80.0 + time * 1.4);
  color += vec3(0.035, 0.046, 0.048) * ripple * water;
  color *= 1.0 + 0.012 * sin(source.x * 10.0 - time * 0.25) * green;
  return clamp(color, 0.0, 1.0);
}

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

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}

// Restore the original luminous cyan finish for the galaxy alone.
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
    // The mascot shares the cyan palette, but has a deeper, clean enamel body.
    // Local lighting keeps it separate from the pale, patterned lettering.
    vec2 local = (uv - uCatBounds.xy) / max(uCatBounds.zw - uCatBounds.xy, vec2(.001));
    float blueBody = smoothstep(.035, .11, tx.b - tx.r);
    float darkDetail = 1.0 - smoothstep(.22, .45, max(tx.r, max(tx.g, tx.b)));
    float redDetail = smoothstep(.25, .60, tx.r - tx.g);
    float light = exp(-dot((local - vec2(.32, .28)) * vec2(1.7, 1.1), (local - vec2(.32, .28)) * vec2(1.7, 1.1)) * 2.4);
    vec3 enamel = mix(vec3(.025, .29, .53), vec3(.12, .68, .88), light);
    enamel += vec3(.035, .055, .06) * sheen;
    float innerEar = blueBody * smoothstep(.80, .88, tx.r);
    enamel = mix(enamel, vec3(.56, .91, .99), innerEar * .82);
    vec3 detail = mix(vec3(1.0, .79, .25), vec3(1.0, .16, .35), redDetail);
    detail = mix(detail, vec3(.025, .075, .14), darkDetail);
    if (tx.r > .85 && tx.g > .88 && tx.b > .9 && blueBody < .5) detail = vec3(1.0, .99, .94);
    metal = mix(detail, enamel, blueBody);
  }
  return mix(metal, vec3(0.86, 1.0, 1.0), edge * 0.94);
}

// Matte, natural surfaces: fine grain, soft mineral variation and clear colors.
// The other worlds keep their quiet natural finishes.
vec3 sceneMaterial(vec2 uv, vec4 tx, float inCat, float edge, float style) {
  if (style > .5 && style < 1.5) return techMaterial(uv, tx, inCat, edge, uTime);
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
  float grain = noise(p * 460.0) - .5;
  float mineral = noise(p * 35.0) - .5;
  float blueBody = smoothstep(.035, .11, tx.b - tx.r);
  float darkDetail = 1.0 - smoothstep(.22, .45, max(tx.r, max(tx.g, tx.b)));
  float redDetail = smoothstep(.25, .60, tx.r - tx.g);
  vec3 color, body, bodyShade, ears, accent, eyes, ink;
  float textureStrength = .022;
  if (style < .5) {
    // Grass letters, a sky-blue character and warm flower-colored accents.
    color = vec3(.24, .38, .15);
    body = vec3(.28, .76, .91); bodyShade = vec3(.10, .43, .63);
    ears = vec3(1.0, .89, .63); accent = vec3(1.0, .32, .39);
    eyes = vec3(1.0, .79, .27); ink = vec3(.06, .16, .20);
    grain = noise(p * vec2(700.0, 190.0)) - .5;
    textureStrength = .07;
  } else if (style < 2.5) {
    // Silver letters frame a cobalt mascot instead of another gray surface.
    color = vec3(.84, .87, .86);
    body = vec3(.24, .59, .94); bodyShade = vec3(.07, .24, .53);
    ears = vec3(.68, .93, 1.0); accent = vec3(1.0, .30, .42);
    eyes = vec3(1.0, .80, .29); ink = vec3(.035, .075, .17);
    textureStrength = .04;
  } else if (style < 3.5) {
    color = vec3(.91, .86, .78);
    body = vec3(.23, .78, .72); bodyShade = vec3(.04, .35, .39);
    ears = vec3(1.0, .86, .65); accent = vec3(1.0, .46, .37);
    eyes = vec3(1.0, .80, .31); ink = vec3(.035, .15, .18);
  } else if (style < 4.5) {
    color = vec3(.38, .25, .48);
    body = vec3(.36, .77, .96); bodyShade = vec3(.15, .40, .69);
    ears = vec3(1.0, .82, .75); accent = vec3(1.0, .31, .49);
    eyes = vec3(1.0, .80, .31); ink = vec3(.12, .12, .26);
  } else if (style < 5.5) {
    // Teal gives the rose scene a complementary focal point.
    color = vec3(.95, .74, .76);
    body = vec3(.19, .79, .79); bodyShade = vec3(.035, .34, .43);
    ears = vec3(1.0, .88, .70); accent = vec3(1.0, .33, .52);
    eyes = vec3(1.0, .80, .30); ink = vec3(.035, .13, .20);
  } else {
    color = vec3(.78, .73, .93);
    body = vec3(.34, .68, .97); bodyShade = vec3(.10, .29, .65);
    ears = vec3(.62, 1.0, .88); accent = vec3(1.0, .44, .38);
    eyes = vec3(1.0, .82, .35); ink = vec3(.08, .09, .23);
    textureStrength = .04;
  }
  vec3 surface = color;
  // Moon stone uses shallow, irregular pits rather than decorative outlines.
  float lunar = (style > 1.5 && style < 2.5) || style > 5.5 ? 1.0 : 0.0;
  surface += grain * textureStrength + mineral * (.012 + lunar * .035);
  surface -= pow(noise(p * 90.0), 7.0) * lunar * .055;
  surface *= .98 + .035 * (1.0 - uv.y);
  if (inCat > .5) {
    // Give the character its own lighting and full-color details. The letter
    // texture stays outside the mascot so it never washes those colors out.
    vec2 local = (uv - uCatBounds.xy) / max(uCatBounds.zw - uCatBounds.xy, vec2(.001));
    vec2 lightOffset = (local - vec2(.34, .28)) * vec2(1.55, 1.0);
    float light = exp(-dot(lightOffset, lightOffset) * 2.1);
    surface = mix(bodyShade, body, .18 + .82 * light) + grain * .012;
    float innerEar = blueBody * smoothstep(.80, .88, tx.r);
    surface = mix(surface, ears, innerEar);
    vec3 detail = mix(eyes, accent, redDetail);
    detail = mix(detail, ink, darkDetail);
    if (tx.r > .85 && tx.g > .88 && tx.b > .9 && blueBody < .5) detail = vec3(1.0, .98, .94);
    surface = mix(detail, surface, blueBody);
  }
  return mix(surface, surface * .78, edge * .4);
}

vec3 worldColor(vec2 uv, float kind, sampler2D sourceA, sampler2D sourceB, sampler2D overlay,
  float imageAspect, float focus, float blend, float shade, vec2 layers) {
  if (kind < .5) return sunnyVillage(uv, uTime, sourceA, imageAspect, focus);
  if (kind < 1.5) return nightDrive(uv, uTime);
  float aspect = uRes.x / uRes.y;
  vec2 crop = vec2(min(1.0, aspect / imageAspect), min(1.0, imageAspect / aspect));
  vec2 source = (vec2(uv.x, 1.0 - uv.y) - .5) * crop + .5;
  source.x += (focus - .5) * (1.0 - crop.x);
  if (kind > 2.5) {
    source = (source - .5) * .98 + .5;
    vec3 world = texture2D(sourceA, source + uPointer * .004).rgb;
    vec4 foreground = texture2D(sourceB, source + uPointer * .012);
    return mix(world, foreground.rgb, foreground.a);
  }
  vec3 a = texture2D(sourceA, source).rgb;
  vec3 b = texture2D(sourceB, source).rgb;
  if (max(layers.x, layers.y) > .0) {
    vec4 city = texture2D(overlay, source);
    a = mix(a, city.rgb, city.a * layers.x);
    b = mix(b, city.rgb, city.a * layers.y);
  }
  return mix(a, b, smoothstep(0.0, 1.0, blend)) * (1.0 - shade);
}

void main() {
  vec2 uv = vUv;
  // A smooth energy aperture follows the existing pointer trail, without boiling smoke.
  vec2 drift = vec2(sin(uv.y * 24.0 + uTime * 0.6), cos(uv.x * 21.0 - uTime * 0.5)) * 0.002;
  float trail = trailAt(uv + drift);
  float aperture = smoothstep(0.37, 0.43, trail);
  float mask = mix(aperture, 1.0 - aperture, uBlend);
  vec2 tuv = vec2(uv.x, 1.0 - uv.y);
  vec4 tx = texture2D(uText, tuv);
  vec2 px = vec2(2.7) / uRes;
  vec4 neighbours = vec4(texture2D(uText, tuv + vec2(px.x, 0.0)).a,
                         texture2D(uText, tuv - vec2(px.x, 0.0)).a,
                         texture2D(uText, tuv + vec2(0.0, px.y)).a,
                         texture2D(uText, tuv - vec2(0.0, px.y)).a);
  float inside = min(min(neighbours.x, neighbours.y), min(neighbours.z, neighbours.w));
  float outside = max(max(neighbours.x, neighbours.y), max(neighbours.z, neighbours.w));
  float inCat = step(uCatBounds.x, tuv.x) * step(tuv.x, uCatBounds.z)
                * step(uCatBounds.y, tuv.y) * step(tuv.y, uCatBounds.w);
  float edge = 1.0 - smoothstep(0.15, 0.9, inside);
  vec3 word0 = vec3(0.0), word1 = vec3(0.0);
  if (tx.a > 0.001) {
    // The hidden material used to run for every letter pixel on every frame.
    // Only the reveal boundary (or a handoff capture) needs both surfaces.
    if (mask < .999 || uCaptureMascot > .5) word0 = sceneMaterial(tuv, tx, inCat, edge, uWorld0Material);
    if (mask > .001 || uCaptureMascot > .5) word1 = sceneMaterial(tuv, tx, inCat, edge, uWorld1Material);
  }
  if (uCaptureMascot > 0.5) {
    float alpha = tx.a * inCat;
    gl_FragColor = vec4(mix(word0, word1, uBlend) * alpha, alpha); return;
  }
  float wordAlpha = tx.a * (1.0 - inCat * uHideMascot);
  vec3 world0 = vec3(0.0), world1 = vec3(0.0);
  if (mask < 0.999) {
    world0 = worldColor(uv, uWorld0Kind, uWorld0A, uWorld0B, uWorld0Overlay, uWorld0Aspect, uWorld0Focus, uWorld0Mix, uWorld0Shade, uWorld0Layers);
    float neon = step(.5, uWorld0Material) * (1.0 - step(1.5, uWorld0Material));
    world0 *= 1.0 - outside * (1.0 - tx.a) * .28 * (1.0 - neon);
    world0 += vec3(.035, .32, .40) * outside * (1.0 - tx.a) * neon * (1.0 + inCat * .45);
    world0 = mix(world0, word0, wordAlpha);
  }
  if (mask > 0.001) {
    world1 = worldColor(uv, uWorld1Kind, uWorld1A, uWorld1B, uWorld1Overlay, uWorld1Aspect, uWorld1Focus, uWorld1Mix, uWorld1Shade, uWorld1Layers);
    float neon = step(.5, uWorld1Material) * (1.0 - step(1.5, uWorld1Material));
    world1 *= 1.0 - outside * (1.0 - tx.a) * .32 * (1.0 - neon);
    world1 += vec3(.035, .32, .40) * outside * (1.0 - tx.a) * neon * (1.0 + inCat * .45);
    world1 = mix(world1, word1, wordAlpha);
  }
  float rim = smoothstep(0.31, 0.37, trail) * (1.0 - smoothstep(0.43, 0.49, trail)) * (1.0 - tx.a);
  world1 += vec3(0.06, 0.40, 0.55) * rim * 0.23;
  gl_FragColor = vec4(mix(world0, world1, mask), 1.0);
}
`;
