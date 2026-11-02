// The flittle opening cover. Draws the gooey ink reveal: a trail mask painted by the pointer, a
// WebGL quad that shows the ink video, the white letters and the colour cat inside the blobs, with
// boiling noise edges, a ghost rim, droplets and a velocity glitch on the wordmark. The loop runs
// only while the cover is on screen; the two background videos pause when it is not.
export function initInkHero() {
  const hero       = document.getElementById('hero');
  const wordBase   = document.getElementById('wordBase');
  const wordSpan   = document.getElementById('wordSpan');
  const textSpans  = Array.from(wordSpan.querySelectorAll('.t'));
  const catBase    = document.getElementById('catBase');
  const baselineEl = document.getElementById('baseline');
  const canvas     = document.getElementById('reveal');
  const cursorEl   = document.getElementById('cursor');
  const vids       = [document.getElementById('bgVideo'), document.getElementById('bgVideo2')];

  /* ============================================================
     1. The cat that stands in for the "tt" of flittle.
        It is the cat cut out of the logo artwork, traced into flat
        vector shapes (embedded below as an SVG) so it stays crisp.
        The DOM copy is desaturated with a CSS filter for the black
        & white resting page; the full-colour copy is painted inside
        the ink blobs. Its size and position come from the logo,
        measured against the height of the letter "l".
     ============================================================ */
  const CAT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 354 361" width="354" height="361"><path fill="#fcd87b" d="M263.5 3.4C261.67 3.46 260.83 3.61 259.5 3.96C258.17 4.32 257.17 4.45 255.5 5.53C253.83 6.62 251.08 8.84 249.47 10.5C247.85 12.16 247.84 11.83 245.82 15.5C243.8 19.17 239.17 28.67 237.33 32.5C235.5 36.33 236.17 34.67 234.82 38.5C233.48 42.33 230.55 51 229.25 55.5C227.94 60 227.62 61.67 227 65.5C226.38 69.33 225.83 75 225.54 78.5C225.26 82 225.46 85.03 225.28 86.5C225.11 87.97 229.13 87.95 224.5 87.31C219.87 86.66 205.83 83.49 197.5 82.62C189.17 81.75 180.83 82.1 174.5 82.08C168.17 82.07 164.17 82.19 159.5 82.53C154.83 82.87 151.55 83.31 146.5 84.14C141.45 84.97 132.22 87.11 129.17 87.5C126.13 87.89 128.73 89.33 128.23 86.5C127.74 83.67 127.14 75.83 126.19 70.5C125.24 65.17 124.6 61.17 122.54 54.5C120.47 47.83 116.44 36.83 113.8 30.5C111.15 24.17 108.49 19.83 106.69 16.5C104.88 13.17 104.5 12.18 102.97 10.5C101.44 8.82 99.24 7.46 97.5 6.4C95.76 5.33 94.33 4.59 92.5 4.11C90.67 3.63 88.67 3.49 86.5 3.51C84.33 3.54 82 3.8 79.5 4.24C77 4.69 75.33 4.8 71.5 6.17C67.67 7.53 60.76 10.38 56.5 12.43C52.24 14.49 48.74 16.7 45.91 18.5C43.08 20.3 41.9 21.28 39.5 23.2C37.1 25.13 34.17 27.48 31.5 30.03C28.83 32.58 25.44 35.75 23.46 38.5C21.48 41.25 20.39 44.5 19.63 46.5C18.86 48.5 18.96 49 18.87 50.5C18.77 52 18.29 53.03 19.06 55.5C19.84 57.97 22.38 62.97 23.5 65.31C24.62 67.64 23.1 65.73 25.77 69.5C28.43 73.27 35.21 82.57 39.5 87.92C43.79 93.27 47.63 97.48 51.5 101.58C55.37 105.68 60.89 110.51 62.7 112.5C64.52 114.49 64.6 112.53 62.4 113.5C60.2 114.47 53.65 116.6 49.5 118.34C45.35 120.08 42.5 121.27 37.5 123.93C32.5 126.59 23.46 131.88 19.5 134.31C15.54 136.74 15.81 136.8 13.74 138.5C11.68 140.2 8.57 143 7.11 144.5C5.66 146 5.71 146 5.03 147.5C4.36 149 3.39 151.5 3.08 153.5C2.77 155.5 2.69 157.5 3.17 159.5C3.65 161.5 4.93 163.83 5.95 165.5C6.96 167.17 6.49 167.24 9.25 169.5C12.01 171.76 19.12 176.81 22.5 179.06C25.88 181.32 26.67 181.59 29.5 183.04C32.33 184.49 36.17 186.3 39.5 187.75C42.83 189.2 46 190.57 49.5 191.75C53 192.94 58.42 194.06 60.5 194.85C62.58 195.64 62.27 190.73 61.95 196.5C61.63 202.27 59.75 221.33 58.58 229.5C57.41 237.67 56.5 240.17 54.92 245.5C53.34 250.83 51.18 256.99 49.1 261.5C47.03 266.01 44.26 269.9 42.5 272.57C40.74 275.24 40.73 275.34 38.57 277.5C36.4 279.66 31.69 283.71 29.5 285.55C27.31 287.38 26.23 287.7 25.4 288.5C24.57 289.3 25.65 289.79 24.5 290.38C23.35 290.97 20.17 291.35 18.5 292.05C16.83 292.75 15.57 293.5 14.5 294.58C13.43 295.65 12.6 296.85 12.08 298.5C11.57 300.15 11.22 302.5 11.4 304.5C11.58 306.5 12.37 308.83 13.17 310.5C13.97 312.17 11.83 311.33 16.19 314.5C20.54 317.67 34.08 325.4 39.3 329.5C44.52 333.6 45.13 336.71 47.5 339.12C49.87 341.52 51.5 342.48 53.5 343.92C55.5 345.36 56.67 346.25 59.5 347.75C62.33 349.25 67.17 351.61 70.5 352.93C73.83 354.25 77 355.03 79.5 355.68C82 356.33 82.5 356.47 85.5 356.82C88.5 357.18 93.33 357.86 97.5 357.82C101.67 357.77 107.5 356.9 110.5 356.55C113.5 356.2 113.17 356.31 115.5 355.72C117.83 355.12 121.33 354.27 124.5 352.98C127.67 351.69 131.17 350.01 134.5 347.98C137.83 345.96 141.71 343.22 144.5 340.81C147.29 338.4 149.5 335.72 151.22 333.5C152.93 331.28 153.99 329.17 154.78 327.5C155.57 325.83 155.7 324.83 155.95 323.5C156.2 322.17 156.27 321 156.26 319.5C156.26 318 156.27 317 155.91 314.5C155.55 312 154.58 308.83 154.1 304.5C153.61 300.17 153.17 298.17 153 288.5C152.84 278.83 152.85 258.33 153.12 246.5C153.38 234.67 154.22 222.62 154.62 217.5C155.02 212.38 154.02 215.94 155.5 215.76C156.98 215.57 161.5 216.14 163.5 216.4C165.5 216.65 165.5 217.08 167.5 217.3C169.5 217.52 173 217.68 175.5 217.72C178 217.76 179.17 217.86 182.5 217.54C185.83 217.21 192.83 216.05 195.5 215.78C198.17 215.5 197.92 215.76 198.5 215.88C199.08 216 198.6 211.06 198.99 216.5C199.37 221.94 200.44 237.5 200.81 248.5C201.18 259.5 201.2 274.33 201.2 282.5C201.21 290.67 201.09 293.17 200.84 297.5C200.59 301.83 200.14 305.33 199.7 308.5C199.25 311.67 198.44 314.33 198.18 316.5C197.93 318.67 197.89 319.5 198.19 321.5C198.49 323.5 199.15 326.5 199.96 328.5C200.78 330.5 201.33 331.33 203.1 333.5C204.86 335.67 207.51 338.91 210.58 341.5C213.64 344.09 217.51 346.82 221.5 349.01C225.49 351.21 230.5 353.36 234.5 354.69C238.5 356.02 242.5 356.48 245.5 356.98C248.5 357.47 250 357.56 252.5 357.68C255 357.8 257.83 357.81 260.5 357.69C263.17 357.57 265.33 357.46 268.5 356.96C271.67 356.45 276 355.7 279.5 354.67C283 353.64 286.17 352.42 289.5 350.78C292.83 349.14 296.82 346.69 299.5 344.81C302.18 342.93 303.41 341.72 305.6 339.5C307.8 337.28 310.85 333.42 312.67 331.5C314.49 329.58 312.86 330.47 316.5 327.98C320.14 325.49 330.97 318.96 334.5 316.55C338.03 314.13 336.79 314.51 337.68 313.5C338.58 312.49 339.29 311.5 339.87 310.5C340.45 309.5 340.84 308.67 341.15 307.5C341.46 306.33 341.68 304.67 341.73 303.5C341.78 302.33 341.78 301.83 341.45 300.5C341.12 299.17 340.34 296.67 339.77 295.5C339.2 294.33 338.75 294.09 338.04 293.5C337.32 292.91 337.18 292.46 335.5 291.96C333.82 291.46 329.18 290.91 327.94 290.5C326.7 290.09 328.3 289.99 328.06 289.5C327.82 289.01 328.59 289.48 326.5 287.54C324.41 285.61 318.69 281.25 315.5 277.91C312.31 274.57 309.68 271.08 307.35 267.5C305.02 263.92 303.14 260.25 301.5 256.42C299.86 252.58 298.51 248.24 297.51 244.5C296.51 240.76 296.52 241.81 295.5 233.97C294.48 226.14 292.02 203.91 291.42 197.5C290.81 191.09 291.69 195.91 291.87 195.5C292.05 195.09 288.89 196.36 292.5 195.06C296.11 193.77 307.83 189.97 313.5 187.72C319.17 185.46 322.67 183.58 326.5 181.55C330.33 179.51 333.26 177.67 336.47 175.5C339.68 173.33 343.78 170.17 345.73 168.5C347.69 166.83 347.32 167 348.17 165.5C349.02 164 350.39 161.5 350.82 159.5C351.25 157.5 351.06 155.33 350.75 153.5C350.44 151.67 349.92 150.17 348.95 148.5C347.98 146.83 346.96 145.5 344.94 143.5C342.92 141.5 340.26 139 336.84 136.5C333.42 134 328.82 131.08 324.43 128.5C320.04 125.92 315.72 123.38 310.5 121.04C305.28 118.71 296.33 115.76 293.11 114.5C289.89 113.24 291.53 113.83 291.18 113.5C290.82 113.17 290.82 113 291.01 112.5C291.2 112 291.72 111.13 292.3 110.5C292.89 109.87 290.36 113.24 294.5 108.74C298.64 104.24 311.63 90.04 317.15 83.5C322.67 76.96 325.09 73.17 327.62 69.5C330.15 65.83 331.18 63.83 332.34 61.5C333.49 59.17 334.19 57.33 334.56 55.5C334.93 53.67 334.69 52 334.58 50.5C334.46 49 334.3 47.83 333.86 46.5C333.43 45.17 332.76 43.83 331.98 42.5C331.19 41.17 330.58 40.26 329.16 38.5C327.75 36.74 326.61 34.86 323.5 31.93C320.39 29.01 313.33 23.25 310.5 20.96C307.67 18.67 309.67 19.98 306.5 18.2C303.33 16.41 296.17 12.39 291.5 10.25C286.83 8.11 282 6.46 278.5 5.36C275 4.26 273 3.97 270.5 3.65C268 3.32 265.33 3.35 263.5 3.4Z"/><path fill="#fef2de" d="M75.5 25.21C74.83 25.38 74.5 25.83 73.5 26C72.5 26.17 71 25.85 69.5 26.21C68 26.58 67.57 26.5 64.5 28.21C61.43 29.93 54.35 34.12 51.1 36.5C47.85 38.88 46.65 40.67 45 42.5C43.35 44.33 42.05 46 41.21 47.5C40.38 49 40.17 50.33 40 51.5C39.83 52.67 39.68 53 40.21 54.5C40.75 56 42.08 58.67 43.21 60.5C44.35 62.33 45.12 63.42 47 65.5C48.88 67.58 52.25 70.95 54.5 73C56.75 75.05 57.5 75.65 60.5 77.79C63.5 79.92 69.17 83.79 72.5 85.79C75.83 87.79 78.33 88.92 80.5 89.79C82.67 90.65 83.5 90.83 85.5 91C87.5 91.17 90.97 91.04 92.5 90.79C94.03 90.54 93.95 90.21 94.67 89.5C95.38 88.79 96.23 87.5 96.79 86.5C97.34 85.5 97.8 86 98 83.5C98.2 81 98.17 74 98 71.5C97.83 69 97.17 69.67 97 68.5C96.83 67.33 97.3 66.17 97 64.5C96.7 62.83 95.58 60.17 95.21 58.5C94.85 56.83 95.19 56.17 94.79 54.5C94.38 52.83 94.05 51.67 92.79 48.5C91.52 45.33 88.21 38.17 87.21 35.5C86.21 32.83 87.36 33.83 86.79 32.5C86.21 31.17 84.5 28.55 83.79 27.5C83.07 26.45 83.55 26.63 82.5 26.21C81.45 25.8 78.67 25.17 77.5 25C76.33 24.83 76.17 25.05 75.5 25.21ZM273.5 25.21C272.17 25.55 270.67 26.19 269.5 27C268.33 27.81 267.21 29.18 266.5 30.1C265.79 31.02 265.5 31.6 265.21 32.5C264.93 33.4 265.12 34.67 264.79 35.5C264.45 36.33 263.88 35.83 263.21 37.5C262.55 39.17 261.45 43.67 260.79 45.5C260.12 47.33 259.55 47.5 259.21 48.5C258.88 49.5 259.12 50.5 258.79 51.5C258.45 52.5 257.55 53.33 257.21 54.5C256.88 55.67 257.15 56.83 256.79 58.5C256.42 60.17 255.3 62.83 255 64.5C254.7 66.17 255.17 67.33 255 68.5C254.83 69.67 254.17 69.83 254 71.5C253.83 73.17 253.83 76.83 254 78.5C254.17 80.17 254.8 80.33 255 81.5C255.2 82.67 254.7 84.17 255.21 85.5C255.73 86.83 257.05 88.58 258.1 89.5C259.15 90.42 260.1 90.75 261.5 91C262.9 91.25 264.5 91.37 266.5 91C268.5 90.63 272 89.42 273.5 88.79C275 88.15 274.83 87.55 275.5 87.21C276.17 86.88 276.33 87.36 277.5 86.79C278.67 86.21 280.67 84.97 282.5 83.79C284.33 82.6 287.33 80.58 288.5 79.67C289.67 78.76 288.5 79.11 289.5 78.33C290.5 77.56 291.58 77.64 294.5 75C297.42 72.36 304.29 65.42 307 62.5C309.71 59.58 309.95 59 310.79 57.5C311.62 56 311.8 54.67 312 53.5C312.2 52.33 312.2 51.67 312 50.5C311.8 49.33 311.62 48 310.79 46.5C309.95 45 308.48 43.17 307 41.5C305.52 39.83 305.32 38.88 301.9 36.5C298.48 34.12 290.57 29.13 286.5 27.21C282.43 25.3 279.67 25.33 277.5 25C275.33 24.67 274.83 24.88 273.5 25.21Z"/><path fill="#9578c9" d="M166.5 103.21C162.67 103.38 165.5 103.83 164.5 104C163.5 104.17 162 103.83 160.5 104.21C159 104.6 156.42 105.79 155.5 106.33C154.58 106.88 155.05 106.81 155 107.5C154.95 108.19 154.85 109.33 155.21 110.5C155.58 111.67 154.79 110.83 157.21 114.5C159.64 118.17 166.9 128.1 169.79 132.5C172.67 136.9 173.38 139.32 174.5 140.9C175.62 142.48 175.5 141.87 176.5 142C177.5 142.13 178.38 144.08 180.5 141.67C182.62 139.25 186.17 132.03 189.21 127.5C192.26 122.97 196.86 117.33 198.79 114.5C200.71 111.67 200.47 111.83 200.79 110.5C201.1 109.17 201.05 107.38 200.67 106.5C200.29 105.62 199.69 105.63 198.5 105.21C197.31 104.8 194.83 104.2 193.5 104C192.17 103.8 191.5 104.17 190.5 104C189.5 103.83 191.5 103.13 187.5 103C183.5 102.87 170.33 103.05 166.5 103.21ZM21.5 291.21C20.33 291.42 19.05 291.17 17.5 292.21C15.95 293.26 13.3 295.62 12.21 297.5C11.13 299.38 11 301.67 11 303.5C11 305.33 11.55 306.83 12.21 308.5C12.88 310.17 13.62 311.95 15 313.5C16.38 315.05 19.08 316.83 20.5 317.79C21.92 318.74 20.6 317.43 23.5 319.21C26.4 321 33.57 324.87 37.9 328.5C42.23 332.13 45.9 337.79 49.5 341C53.1 344.21 56.5 345.99 59.5 347.79C62.5 349.58 64.17 350.45 67.5 351.79C70.83 353.12 77 355.08 79.5 355.79C82 356.49 81.5 355.8 82.5 356C83.5 356.2 84.33 356.83 85.5 357C86.67 357.17 88.33 356.83 89.5 357C90.67 357.17 90.67 357.83 92.5 358C94.33 358.17 98.67 358.17 100.5 358C102.33 357.83 102 357.17 103.5 357C105 356.83 108 357.17 109.5 357C111 356.83 111.5 356.2 112.5 356C113.5 355.8 113 356.49 115.5 355.79C118 355.08 124.5 352.95 127.5 351.79C130.5 350.62 130.67 350.58 133.5 348.79C136.33 346.99 141.92 343.05 144.5 341C147.08 338.95 147.62 338.08 149 336.5C150.38 334.92 151.65 333.5 152.79 331.5C153.92 329.5 155.25 327.33 155.79 324.5C156.32 321.67 156.13 316.67 156 314.5C155.87 312.33 155.22 312.83 155 311.5C154.78 310.17 154.92 307.42 154.67 306.5C154.42 305.58 154.36 306.08 153.5 306C152.64 305.92 151.5 305.63 149.5 306C147.5 306.37 143.5 307.51 141.5 308.21C139.5 308.92 140.33 308.12 137.5 310.21C134.67 312.31 127.17 318.69 124.5 320.79C121.83 322.88 123.17 321.95 121.5 322.79C119.83 323.62 117 324.92 114.5 325.79C112 326.65 111.33 327.67 106.5 328C101.67 328.33 89.67 328.08 85.5 327.79C81.33 327.49 82.67 326.55 81.5 326.21C80.33 325.88 80.33 326.52 78.5 325.79C76.67 325.05 72.4 322.83 70.5 321.79C68.6 320.74 68.33 320.38 67.1 319.5C65.87 318.62 64.12 317.5 63.1 316.5C62.08 315.5 63.6 316.25 61 313.5C58.4 310.75 50.75 302.88 47.5 300C44.25 297.12 43.17 297.18 41.5 296.21C39.83 295.25 39.17 294.88 37.5 294.21C35.83 293.55 33.17 292.58 31.5 292.21C29.83 291.85 28.67 292.2 27.5 292C26.33 291.8 25.5 291.13 24.5 291C23.5 290.87 22.67 291.01 21.5 291.21ZM328.5 291.21C327.5 291.38 327.67 291.83 326.5 292C325.33 292.17 322.83 291.92 321.5 292.21C320.17 292.51 319.5 293.45 318.5 293.79C317.5 294.12 316.67 293.81 315.5 294.21C314.33 294.62 313.33 295.08 311.5 296.21C309.67 297.35 306.75 299.12 304.5 301C302.25 302.88 299.33 306.06 298 307.5C296.67 308.94 297.08 309.08 296.5 309.67C295.92 310.25 296.33 309.31 294.5 311C292.67 312.69 288.5 317.49 285.5 319.79C282.5 322.08 279.83 323.42 276.5 324.79C273.17 326.15 270.5 327.46 265.5 328C260.5 328.54 250.83 328.37 246.5 328C242.17 327.63 242.33 326.99 239.5 325.79C236.67 324.58 233.17 323.21 229.5 320.79C225.83 318.36 220.5 313.31 217.5 311.21C214.5 309.12 213.5 309.05 211.5 308.21C209.5 307.38 207.17 306.58 205.5 306.21C203.83 305.85 202.33 305.98 201.5 306C200.67 306.02 200.75 306.08 200.5 306.33C200.25 306.58 200.42 305.81 200 307.5C199.58 309.19 198.33 314.17 198 316.5C197.67 318.83 197.8 319.83 198 321.5C198.2 323.17 198.51 324.67 199.21 326.5C199.92 328.33 200.67 330.25 202.21 332.5C203.76 334.75 205.95 337.62 208.5 340C211.05 342.38 213.67 344.49 217.5 346.79C221.33 349.08 227.83 352.25 231.5 353.79C235.17 355.32 237.83 355.63 239.5 356C241.17 356.37 240.67 355.83 241.5 356C242.33 356.17 243.17 356.83 244.5 357C245.83 357.17 248.17 356.83 249.5 357C250.83 357.17 250.67 357.83 252.5 358C254.33 358.17 258.67 358.17 260.5 358C262.33 357.83 262 357.17 263.5 357C265 356.83 266.83 357.37 269.5 357C272.17 356.63 276.5 355.65 279.5 354.79C282.5 353.92 284.83 352.95 287.5 351.79C290.17 350.62 292.5 349.75 295.5 347.79C298.5 345.82 303.25 342.05 305.5 340C307.75 337.95 307.07 337.58 309 335.5C310.93 333.42 314.18 329.88 317.1 327.5C320.02 325.12 323.6 323 326.5 321.21C329.4 319.43 332.5 318.17 334.5 316.79C336.5 315.4 337.45 314.28 338.5 312.9C339.55 311.52 340.2 309.9 340.79 308.5C341.37 307.1 342 306.33 342 304.5C342 302.67 341.2 299.07 340.79 297.5C340.37 295.93 340.21 295.98 339.5 295.1C338.79 294.22 337.67 292.9 336.5 292.21C335.33 291.53 333.83 291.17 332.5 291C331.17 290.83 329.5 291.05 328.5 291.21Z"/><path fill="#2d373c" d="M104.5 100.21C103.33 100.53 102.92 101.55 102.5 102.1C102.08 102.65 102.08 100.6 102 103.5C101.92 106.4 102.08 116.54 102 119.5C101.92 122.46 101.75 121 101.5 121.25C101.25 121.5 102.5 122.84 100.5 121C98.5 119.16 91.83 112.01 89.5 110.21C87.17 108.42 87.38 109.83 86.5 110.21C85.62 110.6 84.6 111.45 84.21 112.5C83.83 113.55 82.79 114 84.21 116.5C85.64 119 91.36 125.5 92.79 127.5C94.21 129.5 93.05 128 92.79 128.5C92.52 129 91.98 129.17 91.21 130.5C90.45 131.83 89.08 134.17 88.21 136.5C87.35 138.83 86.37 140.17 86 144.5C85.63 148.83 85.63 158.33 86 162.5C86.37 166.67 87.51 167.67 88.21 169.5C88.92 171.33 89.17 171.92 90.21 173.5C91.26 175.08 92.79 177.45 94.5 179C96.21 180.55 99 182.12 100.5 182.79C102 183.45 102.5 182.8 103.5 183C104.5 183.2 105.33 183.83 106.5 184C107.67 184.17 108.67 184.37 110.5 184C112.33 183.63 115.93 182.37 117.5 181.79C119.07 181.2 118.65 181.55 119.9 180.5C121.15 179.45 123.69 177 125 175.5C126.31 174 126.99 173 127.79 171.5C128.58 170 129.25 168.17 129.79 166.5C130.32 164.83 130.8 162.67 131 161.5C131.2 160.33 130.83 160.33 131 159.5C131.17 158.67 131.83 158 132 156.5C132.17 155 132.17 152 132 150.5C131.83 149 131.2 148.83 131 147.5C130.8 146.17 131.15 144.33 130.79 142.5C130.42 140.67 129.62 138.5 128.79 136.5C127.95 134.5 127.27 132.5 125.79 130.5C124.3 128.5 121.61 125.88 119.9 124.5C118.19 123.12 116.57 122.67 115.5 122.21C114.43 121.76 114.05 122.07 113.5 121.79C112.95 121.5 112.5 123.71 112.21 120.5C111.93 117.29 112.24 105.88 111.79 102.5C111.33 99.12 110.71 100.6 109.5 100.21C108.29 99.83 105.67 99.9 104.5 100.21ZM246.5 100.21C245.33 100.53 244.92 101.55 244.5 102.1C244.08 102.65 244.12 100.43 244 103.5C243.88 106.57 244.04 117.45 243.79 120.5C243.54 123.55 243.05 121.5 242.5 121.79C241.95 122.07 241.5 121.81 240.5 122.21C239.5 122.62 237.75 123.33 236.5 124.21C235.25 125.1 234.05 126.29 233 127.5C231.95 128.71 231.18 129.83 230.21 131.5C229.25 133.17 227.92 135.83 227.21 137.5C226.51 139.17 226.2 140.17 226 141.5C225.8 142.83 226.17 144.33 226 145.5C225.83 146.67 225.17 146.33 225 148.5C224.83 150.67 224.8 156 225 158.5C225.2 161 225.51 161.33 226.21 163.5C226.92 165.67 228.25 169.5 229.21 171.5C230.18 173.5 230.69 174 232 175.5C233.31 177 235.52 179.29 237.1 180.5C238.68 181.71 239.93 182.2 241.5 182.79C243.07 183.37 245 183.8 246.5 184C248 184.2 249 184.2 250.5 184C252 183.8 253.83 183.45 255.5 182.79C257.17 182.12 258.79 181.38 260.5 180C262.21 178.62 264.24 176.92 265.79 174.5C267.33 172.08 268.92 167.83 269.79 165.5C270.65 163.17 270.8 163.67 271 160.5C271.2 157.33 271.17 149.33 271 146.5C270.83 143.67 270.2 144.5 270 143.5C269.8 142.5 270.15 141.83 269.79 140.5C269.42 139.17 268.88 137.5 267.79 135.5C266.69 133.5 263.98 129.83 263.21 128.5C262.45 127.17 261.95 129.17 263.21 127.5C264.48 125.83 269.19 120.5 270.79 118.5C272.38 116.5 272.42 116.33 272.79 115.5C273.15 114.67 273.05 114.07 273 113.5C272.95 112.93 272.92 112.65 272.5 112.1C272.08 111.55 271.5 110.53 270.5 110.21C269.5 109.9 268.42 109 266.5 110.21C264.58 111.43 260.67 115.7 259 117.5C257.33 119.3 257.08 120.29 256.5 121C255.92 121.71 255.83 121.67 255.5 121.79C255.17 121.9 254.75 121.88 254.5 121.67C254.25 121.45 254.12 123.69 254 120.5C253.88 117.31 254.2 105.88 253.79 102.5C253.37 99.12 252.71 100.6 251.5 100.21C250.29 99.83 247.67 99.9 246.5 100.21Z"/><path fill="#89dcd5" d="M105.5 131.21C104.43 131.46 103.93 131.85 103.1 132.5C102.27 133.15 101.48 133.6 100.5 135.1C99.52 136.6 97.96 139.6 97.21 141.5C96.46 143.4 96.2 143.33 96 146.5C95.8 149.67 95.8 157.5 96 160.5C96.2 163.5 96.55 163 97.21 164.5C97.88 166 98.95 168.12 100 169.5C101.05 170.88 102.08 172.04 103.5 172.79C104.92 173.54 107 174 108.5 174C110 174 110.95 173.87 112.5 172.79C114.05 171.7 116.57 169.21 117.79 167.5C119 165.79 119.42 164.17 119.79 162.5C120.15 160.83 119.8 159 120 157.5C120.2 156 121 154.67 121 153.5C121 152.33 120.25 152.5 120 150.5C119.75 148.5 119.67 142.5 119.5 141.5C119.33 140.5 119.67 143.75 119 144.5C118.33 145.25 116.32 145.83 115.5 146C114.68 146.17 114.81 146.08 114.1 145.5C113.39 144.92 111.86 143.5 111.21 142.5C110.57 141.5 110.21 140.67 110.21 139.5C110.21 138.33 110.79 136.5 111.21 135.5C111.64 134.5 112.54 134 112.79 133.5C113.03 133 113.21 132.92 112.67 132.5C112.12 132.08 110.69 131.21 109.5 131C108.31 130.79 106.57 130.96 105.5 131.21ZM245.5 131.21C244.17 131.55 243.5 132.19 242.5 133C241.5 133.81 240.21 135.18 239.5 136.1C238.79 137.02 238.8 136.77 238.21 138.5C237.63 140.23 236.37 143.17 236 146.5C235.63 149.83 235.63 155.17 236 158.5C236.37 161.83 237.38 164.5 238.21 166.5C239.05 168.5 239.62 169.29 241 170.5C242.38 171.71 245.08 173.2 246.5 173.79C247.92 174.37 248 174.48 249.5 174C251 173.52 253.79 172.65 255.5 170.9C257.21 169.15 259.04 165.23 259.79 163.5C260.54 161.77 259.8 161.5 260 160.5C260.2 159.5 260.83 159.33 261 157.5C261.17 155.67 261.17 151.33 261 149.5C260.83 147.67 260.25 147.83 260 146.5C259.75 145.17 259.67 141.83 259.5 141.5C259.33 141.17 259.67 143.75 259 144.5C258.33 145.25 256.42 145.79 255.5 146C254.58 146.21 254 145.95 253.5 145.79C253 145.62 253.05 145.71 252.5 145C251.95 144.29 250.6 142.92 250.21 141.5C249.83 140.08 249.61 137.83 250.21 136.5C250.82 135.17 253.35 134.17 253.83 133.5C254.31 132.83 253.66 132.92 253.1 132.5C252.54 132.08 251.77 131.21 250.5 131C249.23 130.79 246.83 130.88 245.5 131.21Z"/><path fill="#fafcfd" d="M113.5 133.5C112.45 133.23 111.76 134.5 111.21 135.5C110.67 136.5 110.17 138.27 110.21 139.5C110.26 140.73 110.85 141.9 111.5 142.9C112.15 143.9 113.43 144.98 114.1 145.5C114.77 146.02 114.74 146.17 115.5 146C116.26 145.83 118.08 145.42 118.67 144.5C119.25 143.58 119.19 141.73 119 140.5C118.81 139.27 118.42 138.27 117.5 137.1C116.58 135.93 114.55 133.77 113.5 133.5ZM252.5 134.21C251.79 134.6 250.6 135.29 250.21 136.5C249.83 137.71 250 140.27 250.21 141.5C250.43 142.73 250.95 143.19 251.5 143.9C252.05 144.61 252.67 145.47 253.5 145.79C254.33 146.1 255.67 145.97 256.5 145.79C257.33 145.6 258.08 145.05 258.5 144.67C258.92 144.29 258.95 144.53 259 143.5C259.05 142.47 259.2 139.86 258.79 138.5C258.37 137.14 257.21 136.05 256.5 135.33C255.79 134.62 255.17 134.4 254.5 134.21C253.83 134.03 253.21 133.83 252.5 134.21Z"/></svg>';
  const CAT_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CAT_SVG);
  const CAT_IMG_W = 354, CAT_IMG_H = 361;
  const CAT_H_REL     = 361 / 319;   // cat box height / "l" height
  const CAT_BELOW_REL = 7 / 319;     // cat box bottom below the baseline
  const CAT_GAP_L_REL = 24 / 319;    // gap from the "i" stem to the cat box
  const CAT_GAP_R_REL = 26 / 319;    // gap from the cat box to the "l"
  catBase.src = CAT_URL;
  const catImg = new Image();
  let catReady = false;
  catImg.src = CAT_URL;
  catImg.decode().then(() => { catReady = true; drawText(); }).catch(() => {});

  // size the inline cat from the live font metrics (called while the wordmark is at 100px)
  function sizeCat() {
    const cs = getComputedStyle(wordBase);
    tctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    const ml = tctx.measureText('l'), mi = tctx.measureText('i');
    const lH = (ml.actualBoundingBoxAscent || 73) + Math.max(0, ml.actualBoundingBoxDescent || 0);
    const h = CAT_H_REL * lH, w = h * CAT_IMG_W / CAT_IMG_H;
    const rbI = mi.width - mi.actualBoundingBoxRight;   // right side bearing of "i"
    const lbL = -ml.actualBoundingBoxLeft;              // left side bearing of "l"
    catBase.style.height = (h / 100) + 'em';
    catBase.style.width = (w / 100) + 'em';
    catBase.style.verticalAlign = (-(CAT_BELOW_REL * lH) / 100) + 'em';
    catBase.style.marginLeft = ((CAT_GAP_L_REL * lH - rbI) / 100) + 'em';
    catBase.style.marginRight = ((CAT_GAP_R_REL * lH - lbL) / 100) + 'em';
  }

  /* ============================================================
     2. Sizes, trail mask, wordmark texture
     ============================================================ */
  const TRAIL_SCALE = 0.25;
  let W = 1, H = 1, DPR = 1;

  const trail = document.createElement('canvas');
  let tr = trail.getContext('2d');

  const textCanvas = document.createElement('canvas');
  const tctx = textCanvas.getContext('2d');

  function stamp(x, y, r, a) {
    const sx = x * TRAIL_SCALE, sy = y * TRAIL_SCALE, sr = Math.max(1, r * TRAIL_SCALE);
    const g = tr.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g.addColorStop(0,   `rgba(255,255,255,${a})`);
    g.addColorStop(0.5, `rgba(255,255,255,${a * 0.75})`);
    g.addColorStop(1,   'rgba(255,255,255,0)');
    tr.fillStyle = g;
    tr.beginPath(); tr.arc(sx, sy, sr, 0, Math.PI * 2); tr.fill();
  }

  // fit the wordmark to 90% of the cover width
  function fitWord() {
    wordBase.style.fontSize = '100px';
    sizeCat();
    const w = wordSpan.getBoundingClientRect().width || 1;
    wordBase.style.fontSize = (100 * (W * 0.9) / w) + 'px';
    drawText();
  }

  // white letters + colour cat, drawn glyph by glyph so it sits exactly over the DOM wordmark
  function drawText() {
    textCanvas.width = canvas.width; textCanvas.height = canvas.height;
    tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tctx.clearRect(0, 0, W, H);
    const cs = getComputedStyle(wordBase);
    tctx.font = `${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
    tctx.fillStyle = '#fff';
    tctx.textBaseline = 'alphabetic';
    if ('fontKerning' in tctx) tctx.fontKerning = 'none';
    const heroRect = hero.getBoundingClientRect();
    const baseY = baselineEl.getBoundingClientRect().bottom - heroRect.top;
    const ls = parseFloat(cs.letterSpacing) || 0;
    for (const sp of textSpans) {
      let x = sp.getBoundingClientRect().left - heroRect.left;
      for (const ch of sp.textContent) {
        tctx.fillText(ch, x, baseY);
        x += tctx.measureText(ch).width + ls;
      }
    }
    const cr = catBase.getBoundingClientRect();
    if (catReady) tctx.drawImage(catImg, cr.left - heroRect.left, cr.top - heroRect.top, cr.width, cr.height);
    if (gl) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texText); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas); }
  }

  /* ============================================================
     3. WebGL
     ============================================================ */
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  let prog, uni = {}, texTrail, texVideo, texText, texVideoNext;

  const VS = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;
  const FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTrail, uVideo, uVideoNext, uText;
uniform float uMix, uTime, uHasVideo;
uniform vec2 uRes, uVideoRes, uTextOff;

vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float trailAt(vec2 uv){ return texture2D(uTrail, vec2(uv.x, 1.0 - uv.y)).r; }
vec2 coverUv(vec2 uv){
  float sr = uRes.x / uRes.y;
  float vr = uVideoRes.x / uVideoRes.y;
  vec2 s = sr > vr ? vec2(1.0, vr / sr) : vec2(sr / vr, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main(){
  vec2 uv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.25;
  vec2 n  = vec2(snoise(uv*asp*3.2 + vec2(t, -t)), snoise(uv*asp*3.2 + vec2(-t, t) + 17.0));
  vec2 n2 = vec2(snoise(uv*asp*9.0 + t*2.0),       snoise(uv*asp*9.0 - t*2.0 + 5.0));
  vec2 wuv = uv + n*0.03 + n2*0.006;                       // boiling organic edge

  float v = trailAt(wuv);
  float mask = smoothstep(0.42, 0.445, v);
  float vg = trailAt(wuv + vec2(-0.008, 0.010));
  float rim = smoothstep(0.33, 0.35, vg) * (1.0 - mask);  // offset ghost halo

  float e = 1.5 / uRes.x;
  vec2 grad = vec2(
    trailAt(wuv + vec2(e*4.0, 0.0)) - trailAt(wuv - vec2(e*4.0, 0.0)),
    trailAt(wuv + vec2(0.0, e*4.0)) - trailAt(wuv - vec2(0.0, e*4.0)));
  vec2 vuv = coverUv(uv + grad*0.06);                       // liquid refraction at the edges
  vuv.y = 1.0 - vuv.y;

  vec3 vid = mix(texture2D(uVideo, vuv).rgb, texture2D(uVideoNext, vuv).rgb, uMix);
  vec3 fb = mix(vec3(0.10, 0.25, 1.0), vec3(1.0, 0.15, 0.6), smoothstep(0.1, 0.6, uv.x + n.x*0.2));
  fb = mix(fb, vec3(1.0, 0.55, 0.1), smoothstep(0.55, 0.95, uv.x + n.y*0.2));
  vid = mix(fb, vid, uHasVideo);
  vid = pow(vid, vec3(0.92)) * 1.06;

  vec2 tuv = vec2(uv.x, 1.0 - uv.y);
  vec4 tx  = texture2D(uText, tuv - uTextOff);
  vec4 tx2 = texture2D(uText, tuv - uTextOff*2.2);
  vid = mix(vid, tx2.rgb, tx2.a * 0.35);                    // faint glitch ghost
  vid = mix(vid, tx.rgb,  tx.a);                            // white letters + colour cat

  vec3 rimCol = vec3(0.86, 0.86, 0.90);
  float alpha = mask + rim*0.55;
  vec3 color = vid*mask + rimCol*rim*0.55;
  gl_FragColor = vec4(color, alpha);
}`;

  function makeTex(unit) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  }

  if (gl) {
    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uTrail', 'uVideo', 'uVideoNext', 'uMix', 'uRes', 'uVideoRes', 'uTime', 'uHasVideo', 'uText', 'uTextOff']
      .forEach(n => { uni[n] = gl.getUniformLocation(prog, n); });
    texTrail = makeTex(0); texVideo = makeTex(1); texText = makeTex(2); texVideoNext = makeTex(3);
    gl.uniform1i(uni.uTrail, 0); gl.uniform1i(uni.uVideo, 1); gl.uniform1i(uni.uText, 2); gl.uniform1i(uni.uVideoNext, 3);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
  } else {
    canvas.style.display = 'none';
  }

  /* ============================================================
     4. Resize
     ============================================================ */
  function resize() {
    W = hero.clientWidth; H = hero.clientHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);

    // keep the existing blobs across a resize
    const nw = Math.max(2, Math.ceil(W * TRAIL_SCALE)), nh = Math.max(2, Math.ceil(H * TRAIL_SCALE));
    const old = document.createElement('canvas');
    old.width = trail.width; old.height = trail.height;
    if (trail.width > 0 && trail.height > 0) old.getContext('2d').drawImage(trail, 0, 0);
    trail.width = nw; trail.height = nh;
    tr = trail.getContext('2d');
    tr.globalCompositeOperation = 'source-over';
    tr.fillStyle = '#000'; tr.fillRect(0, 0, nw, nh);
    if (old.width > 0 && old.height > 0) tr.drawImage(old, 0, 0, nw, nh);
    tr.globalCompositeOperation = 'lighter';

    fitWord();
  }

  /* ============================================================
     5. Pointer / touch / custom cursor
     ============================================================ */
  const pointer = { x: 0, y: 0, px: 0, py: 0, active: false };
  function setPointer(cx, cy) {
    const r = hero.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    if (!pointer.active) { pointer.active = true; pointer.px = x; pointer.py = y; }  // no jump line
    pointer.x = x; pointer.y = y;
    wake();
  }
  hero.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') setPointer(e.clientX, e.clientY); });
  hero.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') cursorEl.classList.add('on'); });
  hero.addEventListener('pointerleave', () => { pointer.active = false; cursorEl.classList.remove('on'); });
  hero.addEventListener('touchstart', e => { const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchmove',  e => { const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchend',   () => { pointer.active = false; }, { passive: true });
  hero.addEventListener('touchcancel',() => { pointer.active = false; }, { passive: true });

  let playedOnGesture = false;
  hero.addEventListener('pointerdown', e => {
    if (!playedOnGesture) { playedOnGesture = true; tryPlay(vids[cur]); }
    if (e.pointerType !== 'touch') setPointer(e.clientX, e.clientY);
  });

  window.addEventListener('pointermove', e => { cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; }, { passive: true });
  hero.querySelectorAll('.pill, .nav a').forEach(el => {
    el.addEventListener('pointerenter', () => cursorEl.classList.add('big'));
    el.addEventListener('pointerleave', () => cursorEl.classList.remove('big'));
  });

  /* ============================================================
     6. Seamless video loop (two players, 1.4 s cross-fade)
     ============================================================ */
  const FADE = 1.4;
  let cur = 0, mix = 0, hasVideo = 0, vidW = 16, vidH = 9;
  function tryPlay(v) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
  vids.forEach(v => {
    v.addEventListener('playing', () => { hasVideo = 1; if (v.videoWidth) { vidW = v.videoWidth; vidH = v.videoHeight; } });
  });
  function updateVideo() {
    const A = vids[cur], B = vids[1 - cur];
    const d = A.duration;
    if (!hasVideo || !d || !isFinite(d)) return;
    if (A.currentTime >= d - FADE || A.ended) {
      if (B.paused) { B.currentTime = 0; tryPlay(B); }
      mix = Math.min(1, (A.currentTime - (d - FADE)) / FADE);
      if (A.ended) mix = 1;
    }
    if (A.ended || mix >= 1) { A.pause(); cur = 1 - cur; mix = 0; }
  }
  function uploadVideo(unit, tex, v) {
    if (v.readyState < 2) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v); }
    catch (err) { hasVideo = 0; }
  }
  tryPlay(vids[0]);

  /* ============================================================
     7. Frame loop (runs only while the cover is on screen)
     ============================================================ */
  const drops = [];
  let last = performance.now(), start = last, phase = 0, vx = 0, vy = 0, offX = 0, offY = 0;
  let onScreen = true, running = false;

  function frame(now) {
    if (!onScreen) { running = false; return; }
    const dt = Math.min(48, now - last) / 16.667;
    last = now;

    // fade the mask
    tr.globalCompositeOperation = 'source-over';
    tr.fillStyle = `rgba(0,0,0,${0.022 * dt})`;
    tr.fillRect(0, 0, trail.width, trail.height);
    tr.globalCompositeOperation = 'lighter';
    phase += 0.03 * dt;

    const base = Math.min(W, H) * 0.075;
    if (pointer.active) {
      const dx = pointer.x - pointer.px, dy = pointer.y - pointer.py;
      const dist = Math.hypot(dx, dy);
      vx += (dx - vx) * 0.25; vy += (dy - vy) * 0.25;
      const speed = Math.hypot(vx, vy);
      const rad = base + Math.min(speed, 60) * 1.6 + Math.sin(phase * 2.3) * base * 0.15;
      if (dist >= 0.5) {
        const steps = Math.max(1, Math.ceil(dist / (rad * 0.25)));
        for (let i = 1; i <= steps; i++) { const k = i / steps; stamp(pointer.px + dx * k, pointer.py + dy * k, rad, 0.22); }
      } else {
        stamp(pointer.x, pointer.y, base * 1.1, 0.06);   // resting cursor keeps its blob alive
      }
      if (speed > 8 && Math.random() < 0.12 * dt) {
        const ang = Math.atan2(vy, vx) + Math.PI + (Math.random() - 0.5) * 2.2;
        const sp = 1 + Math.random() * 2;
        drops.push({ x: pointer.x + Math.cos(ang) * rad * 1.3, y: pointer.y + Math.sin(ang) * rad * 1.3,
                     vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: base * (0.18 + Math.random() * 0.25), life: 1 });
      }
      pointer.px = pointer.x; pointer.py = pointer.y;
    } else {
      vx *= 0.9; vy *= 0.9;
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.96; d.vy *= 0.96; d.life -= 0.012 * dt;
      if (d.life <= 0) { drops.splice(i, 1); continue; }
      stamp(d.x, d.y, d.r, 0.35 * Math.max(0, d.life));
    }

    // glitch offset of the white wordmark
    offX += (vx * 0.35 - offX) * 0.12;
    offY += (vy * 0.12 - offY) * 0.12;

    updateVideo();

    if (gl) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texTrail);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trail);
      if (hasVideo) {
        uploadVideo(1, texVideo, vids[cur]);
        if (mix > 0) uploadVideo(3, texVideoNext, vids[1 - cur]);
      }
      gl.uniform1f(uni.uMix, mix);
      gl.uniform2f(uni.uRes, canvas.width, canvas.height);
      gl.uniform2f(uni.uVideoRes, hasVideo ? vidW : 16, hasVideo ? vidH : 9);
      gl.uniform1f(uni.uTime, (now - start) / 1000);
      gl.uniform1f(uni.uHasVideo, hasVideo);
      gl.uniform2f(uni.uTextOff, offX / W, offY / H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    requestAnimationFrame(frame);
  }

  function wake() {
    if (running || !onScreen) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // The cover scrolls away: stop the loop and the videos until it comes back.
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) { if (hasVideo) tryPlay(vids[cur]); wake(); }
    else { vids.forEach(v => v.pause()); pointer.active = false; }
  }, { threshold: 0 }).observe(hero);

  /* ============================================================
     8. Boot
     ============================================================ */
  resize();
  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) {
    document.fonts.load('600 100px Fredoka').catch(() => {}).then(() => document.fonts.ready).then(resize);
  }
  wake();
  // read-only state for debugging / automated checks
  window.__flittle = { state: () => ({ hasVideo, mix, cur, W, H, DPR, drops: drops.length, active: pointer.active, webgl: !!gl, onScreen, running }) };
}
