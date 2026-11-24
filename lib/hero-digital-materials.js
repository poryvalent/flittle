// Opaque, scene-specific lettering surfaces. These use the shared shader's
// hash/noise helpers and no extra textures; the caller restores the mascot face.
export const digitalMaterialGLSL = `
float digitalScale() {
  // Keep the material detail proportional to the mark, including on phones.
  return 1.0 / max(uCatBounds.w - uCatBounds.y, .12);
}

float digitalPixel() {
  return digitalScale() / max(uRes.y, 1.0);
}

vec2 digitalCenter() {
  return (uCatBounds.xy + uCatBounds.zw) * .5 * vec2(uRes.x / uRes.y, 1.0);
}

float digitalThinLine(float distance, float width, float aa) {
  return 1.0 - smoothstep(width, width + aa, abs(distance));
}

vec3 eventHorizonSurface(vec2 p, float mascot, float time,
  sampler2D filmA, sampler2D filmB, float filmMix) {
  vec2 q = (p - digitalCenter()) * digitalScale();
  // Unwrap the real accretion footage from its bright inner limb out into the
  // darker, finely stretched outer gas. The angular coordinate is constructed
  // from the mark, never atan(), so there is no branch seam across the letters.
  // Decreasing angle as x grows keeps the source oriented left-to-right.
  // The shared video alone drives the motion, in the background's direction.
  float angle = 1.5707963 - q.x * .42;
  float radius = .325 + q.y * .21;
  vec2 source = vec2(.5, -.05)
              + vec2(cos(angle) * .85, sin(angle)) * radius;
  vec3 gas = mix(texture2D(filmA, source).rgb, texture2D(filmB, source).rgb,
    smoothstep(0.0, 1.0, filmMix));

  // Transfer the footage's real turbulent filament contrast into red-black
  // heat. Most of the surface stays wine/obsidian; only rare hot fibres reach
  // vermilion. There are no procedural bands, clean lines or cracked cells.
  float light = dot(gas, vec3(.2126, .7152, .0722));
  vec3 surface = mix(vec3(.018, .002, .007), vec3(.24, .009, .033),
    smoothstep(.014, .25, light));
  surface = mix(surface, vec3(.62, .022, .047), smoothstep(.16, .55, light) * .82);
  float faceDistance = length((q - vec2(0.0, -.035)) / vec2(.48, .23));
  float faceClearance = mix(1.0, .78 + .22 * smoothstep(.80, 1.24, faceDistance), mascot);
  float hot = smoothstep(.48, .82, light) * faceClearance;
  surface = mix(surface, vec3(.95, .15, .025), hot * .68);
  surface = mix(surface, vec3(1.0, .43, .08), smoothstep(.82, .98, light) * .36 * faceClearance);
  surface *= 1.0 + mascot * .14;
  surface += vec3(.008, .001, .003) * mascot;
  return clamp(surface, 0.0, 1.0);
}

vec3 violetMeshSurface(vec2 p, float mascot, float time) {
  vec2 q = (p - digitalCenter()) * digitalScale();
  // Polished violet planetary glass: the depth stays almost black while broad,
  // curved studio reflections roll slowly over its surface. No matte facet fill.
  float drift = sin(time * .19) * .035;
  float curve = q.y + .24 - q.x * q.x * .075
              + sin(q.x * 1.8 + time * .13) * .052 - drift;
  float broadReflection = exp(-curve * curve * 31.0);
  float specular = exp(-curve * curve * 235.0);
  float lowerCurve = q.y - .31 + sin(q.x * 1.3 - time * .16) * .048;
  float bounce = exp(-lowerCurve * lowerCurve * 36.0);
  vec3 surface = mix(vec3(.012, .008, .035), vec3(.028, .016, .078), mascot);
  surface += mix(vec3(.065, .035, .16), vec3(.11, .055, .24), mascot)
           * broadReflection;
  surface += mix(vec3(.28, .21, .46), vec3(.36, .25, .58), mascot)
           * specular * (.78 + .12 * sin(q.x * 2.0 + time * .23));
  surface += vec3(.045, .022, .11) * bounce;
  float depth = .5 + .5 * sin(q.y * 2.5 - q.x * .8 - time * .11);
  surface += vec3(.014, .008, .033) * depth;

  // A few fine structural seams echo the planet beneath the glass. They never
  // fill the mark with bright grid cells, colored facets or a dense dot field.
  vec2 bent = q + vec2(sin(q.y * 2.6 + time * .14),
                       sin(q.x * 2.0 - time * .11)) * .035;
  float density = mix(5.2, 4.7, mascot);
  vec2 mesh = bent * density;
  vec2 id = floor(mesh), cell = fract(mesh);
  float seed = hash(id + 22.3);
  float diagonalCell = mix(cell.x, 1.0 - cell.x, step(.5, seed));
  float diagonal = abs(diagonalCell - cell.y) * .7071;
  float edgeDistance = min(min(cell.x, 1.0 - cell.x), min(cell.y, 1.0 - cell.y));
  float wireDistance = min(edgeDistance, diagonal);
  float aa = digitalPixel() * density * 1.15;
  float wire = digitalThinLine(wireDistance, .0035, aa);
  float visibleSeam = smoothstep(.38, .73, seed);
  float current = .65 + .35 * pow(.5 + .5 * sin(bent.x * 6.0 + bent.y * 4.0 - time * .55), 3.0);
  surface += vec3(.34, .23, .55) * wire * visibleSeam * current * .065;
  vec2 corner = min(cell, 1.0 - cell);
  float node = 1.0 - smoothstep(.008, .026 + aa, length(corner));
  vec2 nodeId = floor(mesh + .5);
  float nodeDensity = step(.88, hash(nodeId + 87.0));
  float shimmer = .72 + .28 * sin(time * .47 + nodeId.x * .71 + nodeId.y * .93);
  surface += vec3(.57, .44, .81) * node * nodeDensity * shimmer * .13;

  // A restrained inner bevel follows the real glyph silhouette, like the
  // planet's lavender atmosphere. The caller supplies the thin outer rim.
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  vec2 uv = p / aspect;
  vec2 reach = vec2(.011 / digitalScale()) / aspect;
  vec4 nearby = vec4(texture2D(uText, uv + vec2(reach.x, 0.0)).a,
    texture2D(uText, uv - vec2(reach.x, 0.0)).a,
    texture2D(uText, uv + vec2(0.0, reach.y)).a,
    texture2D(uText, uv - vec2(0.0, reach.y)).a);
  float bevel = 1.0 - min(min(nearby.x, nearby.y), min(nearby.z, nearby.w));
  float rimLight = .38 + .19 * (nearby.y - nearby.x) + .29 * (nearby.z - nearby.w);
  surface += vec3(.38, .24, .65) * bevel * rimLight;
  return clamp(surface, 0.0, 1.0);
}
`;
