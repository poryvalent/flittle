// Natural surfaces use cached material maps or the world's existing film.
// No extra media player or texture unit is needed for the moving atmosphere.
export const naturalMaterialGLSL = `
vec3 meadowSurface(vec2 p, float mascot, float time, sampler2D materialMap) {
  vec2 q = (p - digitalCenter()) * digitalScale();
  // Every tuft stays rooted: this is a bounded local bend, never a scrolling
  // lawn. Fixed variation makes neighboring patches catch the breeze differently.
  float flexibility = .28 + .72 * noise(q * vec2(22.0, 37.0) + 4.0);
  float wind = sin(q.y * 9.0 + q.x * 4.0 - time * 1.12);
  float flutter = sin(q.y * 43.0 - q.x * 9.0 + time * 2.3);
  vec2 breeze = vec2(wind * .014 + flutter * .0035, wind * .002) * flexibility;
  vec3 grass = texture2D(materialMap, fract(q * 1.18 + breeze + .5)).rgb;
  // Slow pools of warm light follow the wind across the painted blades. The
  // texture remains crisp and its dark stems keep the meadow's original depth.
  float sunlight = .5 + .5 * sin(q.x * 5.0 - q.y * 4.0 - time * .70
    + sin(q.y * 7.0 + time * .34) * .5);
  grass *= .88 + sunlight * .22;
  grass += vec3(.040, .032, .004) * sunlight * smoothstep(.12, .48, grass.g);
  // Sunlit moss on the character; the letters use the deeper lawn underneath.
  grass *= mix(.83, 1.18, mascot);
  grass += vec3(.035, .055, .005) * mascot;
  return clamp(grass, 0.0, 1.0);
}

vec3 cloudSurface(vec2 p, float mascot, float time, sampler2D materialMap) {
  vec2 q = (p - digitalCenter()) * digitalScale();
  // Real puffy cloud volumes from the scene drift in two very gentle layers.
  // Rounded lighting is baked into the cached cloud map, so mobile only needs
  // two lookups rather than per-pixel volumetric noise or a second video.
  vec2 billow = vec2(sin(q.y * 4.0 + time * .27) * .007,
    sin(q.x * 3.0 - time * .21) * .004);
  vec3 cloud = texture2D(materialMap, fract(q * .86 + vec2(time * .010, time * .0016)
    + billow + .28)).rgb;
  vec3 veil = texture2D(materialMap, fract(q * 1.39 + vec2(time * .016, -time * .002)
    - billow * .4 + .61)).rgb;
  vec3 surface = mix(cloud, veil, .17);
  // Pearl-pink light on the letters; the same cloud volumes in a richer
  // lavender on the character, retaining its own depth and readable face.
  surface = mix(surface, vec3(.98, .88, .97), .14 * (1.0 - mascot));
  surface *= mix(vec3(1.05, 1.03, 1.04), vec3(.98, .90, 1.02), mascot);
  float pearl = smoothstep(.62, .88, cloud.r) * (.75 + .25 * sin(q.x * 2.4 - time * .24));
  surface += vec3(.035, .020, .027) * pearl;
  return clamp(surface, 0.0, 1.0);
}

vec3 rosePlanetSurface(vec2 p, float mascot, float time, sampler2D filmA, sampler2D filmB, float filmMix) {
  vec2 q = (p - digitalCenter()) * digitalScale();
  // Unwrap the moving atmosphere just inside the upper planet's rim. This is
  // the exact scene footage, not a tiled noise approximation or cracked stone.
  // The polar crop avoids its black centre, white limb and the space outside.
  float angle = 1.5707963 + q.x * .49 + .045 * sin(time * .23 + q.y * 3.0);
  float radius = .74 + q.y * .43 + .012 * sin(time * .27 + q.x * 2.0);
  vec2 source = vec2(.5, -.069) + vec2(cos(angle) * .462, sin(angle) * .694) * radius;
  vec3 clouds = mix(texture2D(filmA, source).rgb, texture2D(filmB, source).rgb,
    smoothstep(0.0, 1.0, filmMix));
  vec3 surface = pow(max(clouds, vec3(0.0)), vec3(.96));
  surface = 1.0 - exp(-surface * (1.40 + mascot * .22));
  surface += vec3(.025, .002, .012);

  // The new planet-shaped atmosphere follows the actual wordmark contour.
  // Its softer inner glow gives the moving clouds depth without a second mesh.
  vec2 uv = p / vec2(uRes.x / uRes.y, 1.0);
  vec2 reach = vec2(.019 / digitalScale()) / vec2(uRes.x / uRes.y, 1.0);
  vec4 nearby = vec4(texture2D(uText, uv + vec2(reach.x, 0.0)).a,
    texture2D(uText, uv - vec2(reach.x, 0.0)).a,
    texture2D(uText, uv + vec2(0.0, reach.y)).a,
    texture2D(uText, uv - vec2(0.0, reach.y)).a);
  float atmosphere = 1.0 - min(min(nearby.x, nearby.y), min(nearby.z, nearby.w));
  float light = .58 + .19 * (nearby.y - nearby.x) + .23 * (nearby.z - nearby.w);
  surface += vec3(.58, .12, .26) * atmosphere * light;
  return clamp(surface, 0.0, 1.0);
}
`;
