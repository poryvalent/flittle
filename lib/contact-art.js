// The original Doodle Crew artwork, adapted to the site's native ES modules.
// Keep the scene as SVG so it stays crisp and needs no images or dependencies.
const DRAWINGS = {
  yeti: `
<ellipse class="connect-shadow" cx="0" cy="2" rx="54" ry="5" />
<path d="M-40 -92 C-62 -92 -70 -76 -68 -56 L-66 -30 C-64 -18 -54 -16 -44 -20 Z" />
<path d="M-40 -92 C-62 -92 -70 -76 -68 -56 L-66 -30 C-64 -18 -54 -16 -44 -20 Z" fill="url(#contact-hatch)" stroke="none" />
<path class="n" d="M-67 -64 C-58 -59 -50 -59 -43 -64" />
<path d="M-30 -104 C-40 -112 -44 -124 -40 -138 C-32 -129 -22 -122 -13 -114 Z" />
<path d="M18 -114 C26 -124 36 -130 47 -133 C45 -120 41 -110 32 -101 Z" />
<path class="n" d="M-38 -124 L-28 -119 M39 -125 L33 -116" />
<path d="M-44 -2 C-54 -28 -54 -66 -42 -90 C-32 -110 -14 -118 2 -118 C22 -118 40 -108 48 -88 C58 -64 58 -28 48 -2 C30 4 -26 4 -44 -2 Z" />
<path d="M40 -96 C54 -66 54 -30 46 -4 C40 -2 34 -1 30 0 C40 -30 42 -64 33 -101 Z" fill="url(#contact-hatch)" stroke="none" />
<path class="n" d="M-7 -117 C-5 -126 1 -128 3 -120 C5 -127 11 -126 11 -116" />
<path class="n thin" d="M-14 -24 l-3 4 M8 -40 l3 4 M14 -46 l3 3 M20 -30 l3 3" />
<path class="n" d="M-48 -62 C-22 -50 10 -32 49 -26 M-50 -52 C-24 -40 8 -22 49 -16" />
<rect x="-12" y="-46" width="15" height="13" rx="2.5" transform="rotate(26 -4.5 -39.5)" />
<path d="M-46 -60 C-62 -50 -63 -29 -51 -19 C-45 -15 -38 -19 -40 -28 C-43 -36 -40 -46 -36 -52" />
<path d="M46 -58 C61 -46 61 -26 51 -18 C45 -14 38 -18 40 -26 C43 -34 41 -44 37 -50" />
<path d="M-37 -2 C-41 -14 -23 -19 -16 -7 C-14 0 -26 4 -37 -2 Z" />
<path d="M37 -2 C41 -14 23 -19 16 -7 C14 0 26 4 37 -2 Z" />
<path class="n thin" d="M-30 -4 l1 -4 M-24 -3 l1 -4 M30 -4 l-1 -4 M24 -3 l-1 -4" />
<path class="n" d="M-23 -98 L-9 -96 M6 -98 L20 -100" />
<path class="n" d="M-12 -70 C-6 -64 6 -64 12 -71" />
<path d="M3 -66.5 L5.5 -60 L8 -67.5 Z" />
  `,
  bird: `
<path class="n" d="M-5 0 L-5 -7 M-9 0 L-1 0 M5 0 L5 -7 M1 0 L9 0" />
<path d="M-17 -16 C-26 -18 -31 -14 -33 -9 C-26 -10 -20 -8 -15 -10 Z" />
<path d="M-18 -14 C-20 -30 -10 -40 2 -40 C16 -40 22 -28 20 -16 C18 -6 8 -4 0 -4 C-10 -4 -17 -8 -18 -14 Z" />
<path d="M-11 -25 C-3 -26 1 -18 -3 -13 C-9 -12 -15 -17 -11 -25 Z" fill="url(#contact-hatch)" />
<path class="o" d="M19 -30 L29 -27 L19 -23 Z" />
<path class="a" d="M-3 -38 L4 -59 L12 -37 Z" />
<path class="n thin" d="M-1 -44 L10 -46 M1 -51 L8 -52" />
<circle cx="4" cy="-60" r="2.8" />
  `,
  kid: `
<path d="M-15 -6 L-3 -6 C-3 8 -5 20 -6 30 L-15 30 C-15 18 -16 6 -15 -6 Z" />
<path d="M3 -6 L15 -6 C17 6 19 16 22 27 L12 30 C10 18 6 6 3 -6 Z" />
<path d="M3 -6 L15 -6 C17 6 19 16 22 27 L12 30 C10 18 6 6 3 -6 Z" fill="url(#contact-hatch)" stroke="none" />
<path class="k" d="M-17 30 C-20 34 -20 40 -14 41 L-2 41 C2 40 0 34 -5 30 Z" />
<path class="k" d="M11 29 C8 34 10 40 16 40 L26 38 C29 36 27 30 22 27 Z" />
<path d="M-20 -4 C-22 -20 -18 -38 -10 -44 L10 -44 C18 -38 22 -20 20 -4 Z" />
<path class="n thick" d="M-19.5 -14 L19.5 -14 M-18.5 -26 L18.5 -26 M-14 -36 L14 -36" />
<path class="n" d="M-18 -36 C-28 -28 -30 -14 -26 -5" />
<circle cx="-26" cy="-3" r="4" />
<path class="n" d="M18 -36 C27 -30 30 -18 28 -7" />
<circle cx="28" cy="-4" r="4" />
<circle cx="-17" cy="-58" r="4" />
<circle cx="17" cy="-58" r="4" />
<circle cx="0" cy="-60" r="17" />
<path class="n thin" d="M-11 -52 l2 -2 M-8 -52 l2 -2 M8 -52 l2 -2 M11 -52 l2 -2" />
<path class="n" d="M-5 -50 C-2 -47 2 -47 5 -50" />
<path d="M-15 -70 C-14 -87 14 -87 15 -70 Z" />
<path d="M-27 -68 C-16 -75 16 -75 27 -68 C18 -63 -18 -63 -27 -68 Z" />
<path class="n thick" d="M-14.5 -74 C-6 -77 6 -77 14.5 -74" />
  `,
  cat: `
<ellipse class="connect-shadow" cx="4" cy="2" rx="32" ry="4" />
<g class="connect-tail">
  <path d="M18 -4 C42 -4 52 -24 46 -44 C44 -51 36 -53 34 -46 C40 -30 34 -16 16 -14 Z" />
  <path class="n thin" d="M40 -16 l5 4 M45 -30 l6 1 M43 -42 l6 -3" />
</g>
<path d="M-22 0 C-28 -18 -24 -42 -14 -52 L14 -52 C24 -42 28 -18 22 0 C10 3 -10 3 -22 0 Z" />
<path d="M14 -46 C24 -36 26 -16 22 0 C18 1 14 2 12 2 C16 -14 16 -32 10 -46 Z" fill="url(#contact-hatch)" stroke="none" />
<path class="n" d="M-8 -30 L-9 -1 M8 -30 L9 -1" />
<path d="M-16 1 C-16 -5 -3 -5 -3 1 Z M3 1 C3 -5 16 -5 16 1 Z" />
<path class="a" d="M-18 -55 C-6 -49 6 -49 18 -55 L17 -46 C6 -40 -6 -40 -17 -46 Z" />
<path class="a" d="M9 -45 L18 -32 L6 -37 Z" />
<path d="M-22 -86 L-25 -107 L-7 -96 Z" />
<path d="M8 -96 L23 -108 L22 -86 Z" />
<path class="n thin" d="M-20 -92 L-21 -101 M18 -101 L18 -92" />
<path d="M-26 -70 C-28 -88 -16 -98 0 -98 C16 -98 28 -88 26 -70 C24 -56 12 -50 0 -50 C-12 -50 -24 -56 -26 -70 Z" />
<path class="n thin" d="M-4 -97 L-3 -90 M3 -97 L3 -91" />
<path class="n" d="M-26 -80 C-14 -83 4 -87 25 -93" />
<ellipse class="k" cx="-10" cy="-76" rx="7.5" ry="6.5" />
<path class="k" d="M-2.5 -68 L2.5 -68 L0 -64.5 Z" />
<path class="n" d="M0 -64.5 C-1 -60.5 -5 -60.5 -6 -62.5 M0 -64.5 C1 -60.5 5 -60.5 6 -62.5" />
<path class="n thin" d="M-15 -66 L-29 -68 M-15 -63 L-28 -59 M15 -66 L29 -68 M15 -63 L28 -59" />
  `,
};

const CREW = [
  { kind: 'yeti', name: 'Bruno the yeti', says: 'Big ideas? We are all ears.', x: 120, y: 350, scale: 1.2, box: [-72, -140, 134, 148], eyes: [[-15, -86, 8, 3.6, 3.6], [13, -88, 8, 3.6, 3.6]] },
  { kind: 'bird', name: 'Pip the bird', says: 'A little hello goes a long way.', x: 246, y: 168, scale: 1.35, box: [-35, -64, 67, 68], eyes: [[3, -30, 4.6, 2.3, 2], [12, -31, 4.6, 2.3, 2]] },
  { kind: 'kid', name: 'Juno', says: 'Let us make something good.', x: 710, y: 168, scale: 1.28, box: [-32, -88, 64, 132], eyes: [[-6, -58, 0, 2.5, 1.8], [6.5, -58, 0, 2.5, 1.8]] },
  { kind: 'cat', name: 'Patch the cat', says: 'You had me at hello.', x: 1070, y: 350, scale: 1.24, box: [-32, -112, 86, 118], eyes: [[10, -76, 6, 2.8, 2.6]] },
];

function drawEye([x, y, radius, pupil, max]) {
  return `<g class="connect-eye">
    ${radius ? `<circle cx="${x}" cy="${y}" r="${radius}" />` : ''}
    <g data-pupil="" data-eye-x="${x}" data-eye-y="${y}" data-eye-max="${max}">
      <circle class="k" cx="${x}" cy="${y}" r="${pupil}" stroke="none" />
      <circle class="connect-glint" cx="${x + pupil * 0.35}" cy="${y - pupil * 0.4}" r="${pupil * 0.32}" />
    </g>
  </g>`;
}

function drawCrew(member, index) {
  const [left, top, width, height] = member.box;
  return `<g data-crew="${index}" data-crew-kind="${member.kind}" transform="translate(${member.x} ${member.y}) scale(${member.scale})">
    <g class="connect-character" style="--i:${index}">
      <g class="connect-hit" role="button" tabindex="0" aria-label="Say hello to ${member.name}" data-crew-button="" data-says="${member.says}">
        <rect class="connect-hit-area" x="${left - 5}" y="${top - 5}" width="${width + 10}" height="${height + 10}" rx="9" fill="transparent" stroke="none" />
        <g class="connect-hop">
          <g class="connect-art" aria-hidden="true" fill="var(--connect-paper, #f8f5ee)" stroke="var(--connect-ink, #222523)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${DRAWINGS[member.kind]}
            ${member.eyes.map(drawEye).join('')}
          </g>
        </g>
      </g>
    </g>
  </g>`;
}

function drawLetter([letter, x, width, motion, label], index) {
  const glyph = `<text x="${x}" y="350" textLength="${width}" lengthAdjust="spacingAndGlyphs">${letter}</text>`;
  return `<g class="connect-letter" data-letter="${index}" data-motion="${motion}" style="--i:${index}" role="button" tabindex="0" aria-label="${letter}: ${label}">
    <rect class="connect-letter-target" x="${x - 6}" y="154" width="${width + 12}" height="208" rx="8" />
    <g class="connect-letter-enter" aria-hidden="true">
      <g class="connect-letter-motion">
        <g class="connect-letter-echo connect-letter-echo--warm">${glyph}</g>
        <g class="connect-letter-echo connect-letter-echo--cool">${glyph}</g>
        <g class="connect-letter-ink" filter="url(#contact-ink)">${glyph}</g>
      </g>
      <g class="connect-letter-flair" transform="translate(${x + width / 2} 350)">
        <g class="connect-letter-burst">
          <path d="M-34 5 l-14 -9 M-18 10 l-7 12 M18 10 l7 12 M34 5 l14 -9" />
        </g>
        <g class="connect-letter-speed">
          <path d="M-17 -8 v25 M0 -2 v35 M17 -8 v25" />
        </g>
        <g class="connect-letter-orbit">
          <path d="M0 -104 l3 8 9 1-7 6 2 9-7-5-7 5 2-9-7-6 9-1Z" />
        </g>
      </g>
    </g>
  </g>`;
}

export function createContactScene() {
  // The static hit area never moves. Entrance, hover motion and ink filtering
  // each have their own wrapper, so interacting cannot restart the entrance.
  const letters = [
    ['F', 60, 144, 'spring', 'spring jump'],
    ['L', 218, 142, 'pendulum', 'pendulum swing'],
    ['I', 374, 70, 'jelly', 'jelly stretch'],
    ['T', 458, 160, 'twirl', 'star spin'],
    ['T', 632, 160, 'rocket', 'rocket launch'],
    ['L', 806, 142, 'glitch', 'glitch shuffle'],
    ['E', 962, 150, 'pop', 'elastic pop'],
  ];
  return `<svg class="connect-scene" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 460" role="group" aria-label="The Flittle doodle crew">
    <defs>
      <pattern id="contact-hatch" width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
        <line x1="0" y1="0" x2="0" y2="4.6" stroke="var(--connect-ink, #222523)" stroke-width="1.25" />
      </pattern>
      <filter id="contact-ink" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" result="edge" />
        <feDisplacementMap in="SourceGraphic" in2="edge" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.32" numOctaves="2" seed="4" result="streak" />
        <feColorMatrix in="streak" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -16 5.6" result="streakA" />
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="9" result="speck" />
        <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -24 7.0" result="speckA" />
        <feComposite in="streakA" in2="speckA" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="holes" />
        <feComposite in="rough" in2="holes" operator="out" />
      </filter>
    </defs>
    <g>
      <path class="connect-ground" aria-hidden="true" pathLength="1" d="M45 354 C155 352 264 356 375 354 S596 352 711 354 S932 356 1156 353" fill="none" stroke="var(--connect-ink, #222523)" stroke-width="2.1" stroke-linecap="round" />
      <g class="connect-ground-details" aria-hidden="true" fill="none" stroke="var(--connect-ink, #222523)" stroke-width="1.5" stroke-linecap="round">
        <path d="M54 354 l-4 -8 M58 354 l2 -10 M62 354 l5 -5 M905 355 l-3 -7 M910 355 l3 -9" />
        <path d="M373 363 C377 359 383 360 386 364 Z M981 361 C985 357 989 358 991 361 Z" />
      </g>
      <g class="connect-wordmark" role="group" aria-label="Play with the FLITTLE letters" fill="var(--connect-ink, #222523)" font-family="Inter Tight, Arial Black, Arial, sans-serif" font-size="250" font-weight="900">
        ${letters.map(drawLetter).join('')}
      </g>
      <g class="connect-doodles" aria-hidden="true" fill="var(--connect-paper, #f8f5ee)" stroke="var(--connect-ink, #222523)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <g class="connect-doodle-position" transform="translate(387 104) rotate(-12)">
          <g class="connect-doodle" style="--i:0">
          <path fill="var(--connect-accent, #ed8464)" d="M0 -13 L3.6 -4.4 L13 -4 L5.8 2.2 L8.2 12 L0 6.6 L-8.2 12 L-5.8 2.2 L-13 -4 L-3.6 -4.4 Z" />
          </g>
        </g>
        <g class="connect-doodle-position" transform="translate(545 138) scale(.7)">
          <g class="connect-doodle" style="--i:1">
          <path d="M0 -13 C1 -4 4 -1 13 0 C4 1 1 4 0 13 C-1 4 -4 1 -13 0 C-4 -1 -1 -4 0 -13 Z" />
          </g>
        </g>
        <g class="connect-doodle-position" transform="translate(927 90) rotate(-12) scale(1.25)">
          <g class="connect-doodle" style="--i:2">
          <path d="M-13 -1 L13 -10 L4 12 L0 3 Z" /><path fill="none" d="M0 3 L13 -10 M0 3 L-2 9 L2 5" />
          </g>
        </g>
        <g class="connect-doodle-position" transform="translate(1137 211) scale(.65)">
          <g class="connect-doodle" style="--i:3">
          <path fill="var(--connect-accent, #ed8464)" d="M0 -13 C1 -4 4 -1 13 0 C4 1 1 4 0 13 C-1 4 -4 1 -13 0 C-4 -1 -1 -4 0 -13 Z" />
          </g>
        </g>
      </g>
    </g>
    ${CREW.map(drawCrew).join('')}
  </svg>`;
}
