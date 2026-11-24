import { digitalMaterialGLSL } from './hero-digital-materials.js';
import { naturalMaterialGLSL } from './hero-natural-materials.js';
import { cityMaterialGLSL } from './hero-city-material.js';

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

${digitalMaterialGLSL}
${cityMaterialGLSL}
${naturalMaterialGLSL}

// The galaxy keeps its luminous cyan circuitry on both the word and character.
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
  float signal = pow(.5 + .5 * sin(time * 1.7 - id.x * .43 - id.y * .71 - (cell.x + cell.y) * 3.0), 12.0);
  metal += vec3(.24, .58, .52) * circuit * signal * .55;
  metal = mix(metal, vec3(0.85, 1.0, 0.72), node * step(0.68, hash(id)) * (0.55 + 0.25 * sin(time + hash(id) * 6.28)));
  if (inCat > 0.5) {
    // Deeper, lit cyan panels retain the same tiny tracks as the lettering.
    // Facial details are restored after the material, never stamped with tracks.
    vec2 local = (uv - uCatBounds.xy) / max(uCatBounds.zw - uCatBounds.xy, vec2(.001));
    float blueBody = smoothstep(.035, .11, tx.b - tx.r);
    float darkDetail = 1.0 - smoothstep(.22, .45, max(tx.r, max(tx.g, tx.b)));
    float redDetail = smoothstep(.25, .60, tx.r - tx.g);
    float light = exp(-dot((local - vec2(.32, .28)) * vec2(1.7, 1.1), (local - vec2(.32, .28)) * vec2(1.7, 1.1)) * 2.4);
    vec3 enamel = mix(vec3(.025, .29, .53), vec3(.12, .68, .88), light);
    enamel += vec3(.035, .055, .06) * sheen;
    enamel = mix(enamel, metal, .32);
    enamel *= 1.0 - circuit * .23;
    float innerEar = blueBody * smoothstep(.80, .88, tx.r);
    enamel = mix(enamel, vec3(.56, .91, .99), innerEar * .82);
    vec3 detail = mix(vec3(1.0, .79, .25), vec3(1.0, .16, .35), redDetail);
    detail = mix(detail, vec3(.025, .075, .14), darkDetail);
    if (tx.r > .85 && tx.g > .88 && tx.b > .9 && blueBody < .5) detail = vec3(1.0, .99, .94);
    metal = mix(detail, enamel, blueBody);
  }
  return mix(metal, vec3(0.86, 1.0, 1.0), edge * 0.94);
}

// Each world owns a real surface vocabulary, shared across text and mascot.
// The source SVG is used only to preserve the character's face and silhouette.
vec3 sceneMaterial(vec2 uv, vec4 tx, float inCat, float edge, float style, sampler2D materialMap,
  sampler2D filmA, sampler2D filmB, float filmMix) {
  if (style > .5 && style < 1.5) return techMaterial(uv, tx, inCat, edge, uTime);
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
  vec3 surface, ears, nose, boots, eyes, ink, rim;
  float rimStrength = .55;
  if (style < .5) {
    surface = meadowSurface(p, inCat, uTime, materialMap);
    ears = vec3(.92, .79, .36); nose = vec3(.96, .54, .45);
    boots = vec3(.32, .16, .075); eyes = vec3(1.0, .83, .38);
    ink = vec3(.08, .13, .025); rim = surface * .64; rimStrength = .45;
  } else if (style < 2.5) {
    surface = eventHorizonSurface(p, inCat, uTime, filmA, filmB, filmMix);
    ears = vec3(.36, .045, .085); nose = vec3(.98, .25, .17);
    boots = vec3(.10, .012, .025); eyes = vec3(1.0, .75, .53);
    ink = vec3(.025, .004, .012);
    float lowerRim = smoothstep(.30, .95, (uv.y - uCatBounds.y) / max(uCatBounds.w - uCatBounds.y, .001));
    rim = surface * .40 + mix(vec3(.29, .035, .045), vec3(.41, .060, .070), lowerRim);
    rimStrength = .58;
  } else if (style < 3.5) {
    surface = harborSurface(p, inCat, uTime);
    ears = vec3(.64, .65, .72); nose = vec3(.94, .73, .45);
    boots = vec3(.24, .21, .23); eyes = vec3(1.0, .89, .65);
    ink = vec3(.025, .04, .075); rim = vec3(.67, .65, .76); rimStrength = .40;
  } else if (style < 4.5) {
    surface = cloudSurface(p, inCat, uTime, materialMap);
    ears = vec3(.96, .83, .95); nose = vec3(.94, .68, .79);
    boots = vec3(.46, .32, .64); eyes = vec3(1.0, .90, .77);
    ink = vec3(.16, .085, .26);
    // A lavender contact edge separates the cloud mark from the matching sky.
    rim = surface * .57 + vec3(.09, .065, .15); rimStrength = .65;
  } else if (style < 5.5) {
    surface = rosePlanetSurface(p, inCat, uTime, filmA, filmB, filmMix);
    ears = vec3(.68, .24, .42); nose = vec3(.98, .64, .75);
    boots = vec3(.22, .025, .09); eyes = vec3(1.0, .86, .90);
    float limb = smoothstep(.18, .94, (uv.y - uCatBounds.y) / max(uCatBounds.w - uCatBounds.y, .001));
    ink = vec3(.075, .005, .035); rim = mix(vec3(.66, .17, .35), vec3(1.0, .80, .88), limb);
    rimStrength = .62 + limb * .24;
  } else {
    surface = violetMeshSurface(p, inCat, uTime);
    ears = vec3(.45, .36, .69); nose = vec3(.72, .76, .96);
    boots = vec3(.10, .055, .23); eyes = vec3(.80, .90, 1.0);
    ink = vec3(.035, .015, .085); rim = vec3(.58, .48, .86); rimStrength = .46;
  }
  if (inCat > .5) {
    float body = smoothstep(.035, .11, tx.b - tx.r);
    float dark = 1.0 - smoothstep(.22, .45, max(tx.r, max(tx.g, tx.b)));
    float accent = smoothstep(.25, .60, tx.r - tx.g);
    float localY = (uv.y - uCatBounds.y) / max(uCatBounds.w - uCatBounds.y, .001);
    // Mixed blue/red antialias pixels at the boot seam are still boot pixels,
    // not pale eye fill. Keep that transition continuous with the body material.
    accent = max(accent, step(.60, localY));
    float innerEar = body * smoothstep(.80, .88, tx.r);
    // Keep the moving surface visible through the softer ear and foot inlays.
    float earInlay = style > 1.5 && style < 2.5 ? .24
      : style > 5.5 ? .30 : style > 3.5 && style < 4.5 ? .24
      : style > 2.5 && style < 3.5 ? .38 : style > 4.5 && style < 5.5 ? .44 : .72;
    surface = mix(surface, mix(surface, ears, earInlay), innerEar);
    float accentSurface = style > 1.5 && style < 2.5 ? .70
      : style > 5.5 ? .64 : style > 3.5 && style < 4.5 ? .68
      : style > 2.5 && style < 3.5 ? .50 : .26;
    vec3 accentColor = mix(nose, mix(boots, surface, accentSurface), step(.60, localY));
    vec3 face = mix(eyes, accentColor, accent);
    face = mix(face, ink, dark);
    if (tx.r > .85 && tx.g > .88 && tx.b > .9 && body < .5) face = vec3(1.0, .99, .95);
    surface = mix(face, surface, body);
  }
  return mix(surface, rim, edge * rimStrength);
}

vec3 materialGlow(float style) {
  if (style < .5) return vec3(0.0);
  if (style < 1.5) return vec3(.035, .32, .40);
  if (style < 2.5) return vec3(.24, .018, .034);
  if (style < 3.5) return vec3(.19, .13, .23);
  if (style < 4.5) return vec3(.11, .09, .15);
  if (style < 5.5) return vec3(.43, .07, .21);
  return vec3(.10, .055, .20);
}

vec3 gradeBlackHole(vec3 color, float material) {
  if (material < 1.5 || material > 2.5) return color;
  // Warm the existing accretion footage without tinting space's black floor.
  // Grade after the video crossfade so its forward-playing loop stays seamless.
  float light = dot(color, vec3(.2126, .7152, .0722));
  vec3 ember = mix(vec3(1.15, .13, .22), vec3(1.28, .45, .31), smoothstep(.12, .48, light));
  return mix(color, light * ember, .90);
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
    if (mask < .999 || uCaptureMascot > .5) word0 = sceneMaterial(tuv, tx, inCat, edge, uWorld0Material, uWorld0Overlay, uWorld0A, uWorld0B, uWorld0Mix);
    if (mask > .001 || uCaptureMascot > .5) word1 = sceneMaterial(tuv, tx, inCat, edge, uWorld1Material, uWorld1Overlay, uWorld1A, uWorld1B, uWorld1Mix);
  }
  if (uCaptureMascot > 0.5) {
    float alpha = tx.a * inCat;
    gl_FragColor = vec4(mix(word0, word1, uBlend) * alpha, alpha); return;
  }
  float wordAlpha = tx.a * (1.0 - inCat * uHideMascot);
  vec3 world0 = vec3(0.0), world1 = vec3(0.0);
  if (mask < 0.999) {
    world0 = worldColor(uv, uWorld0Kind, uWorld0A, uWorld0B, uWorld0Overlay, uWorld0Aspect, uWorld0Focus, uWorld0Mix, uWorld0Shade, uWorld0Layers);
    world0 = gradeBlackHole(world0, uWorld0Material);
    float neon = step(.5, uWorld0Material) * (1.0 - step(1.5, uWorld0Material));
    world0 *= 1.0 - outside * (1.0 - tx.a) * .28 * (1.0 - neon);
    world0 += materialGlow(uWorld0Material) * outside * (1.0 - tx.a) * (1.0 + inCat * .45);
    world0 = mix(world0, word0, wordAlpha);
  }
  if (mask > 0.001) {
    world1 = worldColor(uv, uWorld1Kind, uWorld1A, uWorld1B, uWorld1Overlay, uWorld1Aspect, uWorld1Focus, uWorld1Mix, uWorld1Shade, uWorld1Layers);
    world1 = gradeBlackHole(world1, uWorld1Material);
    float neon = step(.5, uWorld1Material) * (1.0 - step(1.5, uWorld1Material));
    world1 *= 1.0 - outside * (1.0 - tx.a) * .32 * (1.0 - neon);
    world1 += materialGlow(uWorld1Material) * outside * (1.0 - tx.a) * (1.0 + inCat * .45);
    world1 = mix(world1, word1, wordAlpha);
  }
  float rim = smoothstep(0.31, 0.37, trail) * (1.0 - smoothstep(0.43, 0.49, trail)) * (1.0 - tx.a);
  world1 += vec3(0.06, 0.40, 0.55) * rim * 0.23;
  gl_FragColor = vec4(mix(world0, world1, mask), 1.0);
}
`;
