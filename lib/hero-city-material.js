// A small skyline is built into the mark itself: solid tower faces, setbacks,
// recessed office windows, and slow rain/reflections. Uses no texture samplers.
export const cityMaterialGLSL = `
vec4 harborTowerLayer(vec2 q, float mascot, float time, float density, float offset, float depth) {
  float px = digitalPixel();
  float x = q.x * density + offset;
  float tower = floor(x), localX = fract(x);
  float seed = hash(vec2(tower, offset + 13.7));
  float variation = hash(vec2(tower + 37.0, offset));
  float edgeAA = min(.16, px * density * 1.1);
  float inset = .045 + variation * .025;
  float widthMask = smoothstep(inset, inset + edgeAA, localX)
                  * (1.0 - smoothstep(1.0 - inset - edgeAA, 1.0 - inset, localX));

  // Tops are architectural setbacks, not jagged noise. Some taller towers run
  // through the letter tops; the shorter neighbours expose a second skyline.
  float roof = mix(-.67, -.14, seed) + (1.0 - depth) * -.06;
  float shoulder = abs(localX - .5);
  float setback = step(.22 + variation * .045, shoulder) * .045
                + step(.35 + variation * .025, shoulder) * .048;
  float roofY = roof + setback;
  float silhouette = widthMask * smoothstep(roofY - px, roofY + px, q.y);
  float roofCap = 1.0 - smoothstep(.004, .010 + px, abs(q.y - roofY));
  float rightFace = smoothstep(.69 - edgeAA, .69 + edgeAA, localX);

  // Moonlit slate / mauve glass on the letters, deeper petrol glass on the
  // mascot. Both carry the same champagne and ice-blue office lights.
  vec3 frontDark = mix(vec3(.145, .155, .205), vec3(.055, .135, .165), mascot);
  vec3 frontLight = mix(vec3(.35, .33, .39), vec3(.19, .33, .35), mascot);
  vec3 facade = mix(frontDark, frontLight, .23 + variation * .58);
  facade *= mix(.70, 1.0, depth);
  facade *= mix(1.0, .61 + variation * .15, rightFace);
  // A slim, differently lit side face makes each column read as a tower.
  facade += vec3(.065, .050, .035) * rightFace * (.35 + seed * .65);
  float corner = 1.0 - smoothstep(.004, .012 + edgeAA, abs(localX - .69));
  facade += mix(vec3(.16, .15, .17), vec3(.12, .20, .21), mascot) * corner * .36;

  float columns = 3.0 + step(.53, variation);
  float floorPitch = .026 + seed * .008;
  vec2 offices = vec2((localX - inset) * columns / (1.0 - inset * 2.0), (q.y - roof) / floorPitch);
  vec2 officeId = floor(offices), cell = fract(offices);
  vec2 paneAA = vec2(px * density * columns, px / floorPitch) * 1.1;
  paneAA = clamp(paneAA, vec2(.015), vec2(.24));
  float pane = smoothstep(.16, .16 + paneAA.x, cell.x)
             * (1.0 - smoothstep(.82 - paneAA.x, .82, cell.x))
             * smoothstep(.22, .22 + paneAA.y, cell.y)
             * (1.0 - smoothstep(.72 - paneAA.y, .72, cell.y));
  float detailResolved = 1.0 - smoothstep(.38, .90, px / floorPitch);
  float windowSeed = hash(officeId + vec2(tower * 7.13, offset * 11.7));
  // A few offices change gently over tens of seconds. Their occupancy is
  // spatially seeded, so there is no blinking grid or synchronous pulse.
  float officeLife = .065 * sin(time * .13 + windowSeed * 21.0 + tower * 1.31);
  float occupied = smoothstep(.60, .76, windowSeed + officeLife);
  vec3 light = mix(vec3(1.0, .70, .39), vec3(.49, .73, .82), step(.49, hash(vec2(tower, 71.4))));
  light = mix(light, vec3(.92, .86, .70), step(.90, windowSeed));
  facade = mix(facade, facade * .70, pane * .44 * detailResolved);
  facade += light * pane * occupied * (.40 + depth * .19) * detailResolved
           * mix(1.0, .66, rightFace);

  // Floor slabs and wider mechanical floors break up the regular windows.
  float floorLine = 1.0 - smoothstep(.035, .085 + paneAA.y * .45, min(cell.y, 1.0 - cell.y));
  float serviceFloor = 1.0 - step(.72, mod(officeId.y + floor(seed * 6.0), 9.0));
  facade *= 1.0 - floorLine * .12 * detailResolved;
  facade *= 1.0 - serviceFloor * .14 * detailResolved;
  facade += vec3(.23, .22, .23) * roofCap * .38;

  // A slow passing reflection slides over each rigid facade. The building and
  // all of its floors stay anchored; only reflected light moves.
  float reflectedX = .5 + .38 * sin(time * .21 + tower * 1.7);
  float reflection = exp(-abs(localX - reflectedX) * 16.0);
  float reflectionHeight = .55 + .45 * sin(q.y * 3.3 + seed * 6.0);
  facade += mix(vec3(.10, .12, .16), vec3(.08, .17, .18), mascot)
           * reflection * reflectionHeight * depth;
  return vec4(facade, silhouette);
}

vec3 harborSurface(vec2 p, float mascot, float time) {
  vec2 q = (p - digitalCenter()) * digitalScale();
  float px = digitalPixel();
  // Keep the complete logo opaque, including the narrow sky above rooftops.
  vec3 surface = mix(vec3(.115, .12, .175), vec3(.055, .115, .15), mascot);
  surface += vec3(.035, .025, .055) * (.5 + .5 * sin(q.y * 3.5));
  vec4 distant = harborTowerLayer(q + vec2(.0, .035), mascot, time, 5.2, 3.17, .42);
  surface = mix(surface, distant.rgb, distant.a);
  // Around 28 main tower columns span the desktop word, with the same relative
  // architectural scale on mobile. Rear towers only show between setbacks.
  vec4 towers = harborTowerLayer(q, mascot, time, 8.8, .37, 1.0);
  surface = mix(surface, towers.rgb, towers.a);

  // Sparse silver rain tails fall downward across the glass. Their wrap occurs
  // beyond the mark, so no drop teleports through the middle of a letter.
  float rainColumn = floor(q.x * 74.0);
  float rainSeed = hash(vec2(rainColumn, 91.4));
  float rainX = (fract(q.x * 74.0) - (.18 + rainSeed * .64)) / 74.0;
  float head = fract(time * (.052 + rainSeed * .025) + rainSeed * 7.0) * 1.65 - .78;
  float behindHead = head - q.y;
  float tail = smoothstep(-px, px * 1.8, behindHead)
             * (1.0 - smoothstep(.015, .15, behindHead));
  float rain = digitalThinLine(rainX, .00065, px * .85) * tail * step(.91, rainSeed);
  surface += vec3(.30, .41, .45) * rain * .28;
  return clamp(surface, 0.0, 1.0);
}
`;
