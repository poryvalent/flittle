// Analytical ribbons and an electric orb: no textures, video, or simulation buffers.
// The parent shader supplies hash(), beam(), uRes, and the bottom-left uPointer.
export const plasmaGLSL = `
float plasmaGaussian(float distance, float width) {
  float d = distance / width;
  return exp(-d * d);
}

vec3 plasmaPalette(float phase) {
  float h = fract(phase);
  vec3 color = mix(vec3(0.015, 0.70, 1.0), vec3(1.0, 0.015, 0.48), smoothstep(0.0, 0.42, h));
  color = mix(color, vec3(1.0, 0.29, 0.025), smoothstep(0.42, 0.70, h));
  return mix(color, vec3(0.015, 0.70, 1.0), smoothstep(0.70, 1.0, h));
}

vec3 plasmaField(vec2 uv, float time) {
  vec2 aspect = uRes / min(uRes.x, uRes.y);
  vec2 world = (uv - 0.5) * aspect;
  vec2 q = (uv - uPointer) * aspect * 10.0;
  float radius = length(q);
  float angle = atan(q.y, q.x + 0.00001);
  vec3 color = vec3(0.003, 0.006, 0.022);

  // Crisp stars stay fixed in the world while the energy drifts through them.
  vec2 starUV = world * 92.0 + vec2(time * 0.025, 0.0);
  vec2 starID = floor(starUV);
  vec2 starCell = fract(starUV);
  float starSeed = hash(starID);
  vec2 starCenter = vec2(hash(starID + 11.7), hash(starID + 43.1)) * 0.70 + 0.15;
  vec2 starDelta = starCell - starCenter;
  float star = exp(-dot(starDelta, starDelta) * 1150.0) * step(0.91, starSeed);
  color += mix(vec3(0.22, 0.48, 1.0), vec3(0.86, 0.94, 1.0), starSeed) * star * 1.7;

  // Continuous colored streams also fill older sections of the pointer trail.
  // Broad ribbons have crisp, wavering cores rather than a diffuse fog fill.
  vec2 river = mat2(0.86, -0.51, 0.51, 0.86) * world;
  float bend = river.y + sin(river.x * 7.0 - time * 0.22) * 0.105
              + sin(river.x * 19.0 + time * 0.16) * 0.025;
  float lane = floor(bend * 9.0 + 0.5);
  float riverDistance = (fract(bend * 9.0 + 0.5) - 0.5) / 9.0;
  vec3 riverColor = plasmaPalette(lane * 0.327 + river.x * 0.14 - time * 0.015);
  float ribbon = plasmaGaussian(riverDistance, 0.012);
  float fibre = riverDistance + sin(river.x * 54.0 + lane * 2.1 - time * 0.4) * 0.003;
  color += riverColor * ribbon * 0.80;
  color += riverColor * beam(fibre, 0.0011) * 1.30;
  color += mix(riverColor, vec3(0.84, 0.96, 1.0), 0.42)
         * beam(fibre - 0.0045, 0.0006) * 0.62;

  // Eight twisting discharges connect a small core to the surrounding glassy rim.
  // Distances are in orb space, keeping each aperture richly detailed on phones too.
  float envelope = smoothstep(0.055, 0.16, radius) * exp(-max(radius - 0.92, 0.0) * 2.4);
  for (int arc = 0; arc < 8; arc++) {
    float i = float(arc);
    float direction = i * 0.785398 + time * 0.045;
    float twist = sin(radius * 4.8 - time * 0.46 + i * 1.41) * 0.36
                + sin(radius * 13.0 + time * 0.23 + i * 2.7) * 0.095;
    float signedDistance = sin(angle - direction - twist) * radius;
    float forward = smoothstep(-0.12, 0.22, cos(angle - direction - twist));
    float width = 0.012 + radius * 0.009;
    float core = plasmaGaussian(signedDistance, width);
    float halo = plasmaGaussian(signedDistance, width * 4.5);
    float split = signedDistance + sin(radius * 23.0 - time * 0.34 + i) * 0.035;
    float filament = plasmaGaussian(split, width * 0.38);
    float surge = 0.77 + 0.23 * sin(radius * 11.0 - time * 1.15 + i * 2.3);
    vec3 hue = plasmaPalette(i * 0.273 + radius * 0.12 + time * 0.012);
    float energy = envelope * forward * surge;
    color += hue * (core * 2.1 + halo * 0.46) * energy;
    color += mix(hue, vec3(0.80, 0.96, 1.0), 0.46) * filament * energy * 1.05;
  }

  // A thin irregular shell and tiny hot nucleus read as a plasma ball, not a white disk.
  float shellRadius = 0.70 + sin(angle * 6.0 + time * 0.30) * 0.015;
  float shell = abs(radius - shellRadius);
  vec3 shellColor = plasmaPalette(angle / 6.2831853 + time * 0.025);
  color += shellColor * beam(shell, 0.011) * 0.80;
  color += shellColor * exp(-shell * 16.0) * 0.14;
  color += vec3(0.07, 0.025, 0.22) * exp(-radius * radius * 1.8);
  color += vec3(0.36, 0.78, 1.0) * beam(radius - 0.073, 0.013) * 0.75;
  color += vec3(0.70, 0.92, 1.0) * exp(-radius * 38.0) * 0.85;
  return 1.0 - exp(-color * 1.05);
}
`;
