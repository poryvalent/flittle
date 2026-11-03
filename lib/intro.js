import { createIntroGame } from './intro-game.js';

const overlay = document.querySelector('[data-loader]');
const controller = window.__flittleLoader;
if (overlay && controller && !controller.released) {
  let game = null;
  let starting = false;
  let destroyed = false;
  let holdTimer = 0;
  let repeatTimer = 0;
  let skipTimer = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = overlay.querySelector('[data-game-live]');
  const progress = overlay.querySelector('[data-game-progress]');
  const playing = () => game && !controller.complete && !controller.released;

  function stopHold() {
    clearTimeout(holdTimer);
    clearInterval(repeatTimer);
    game?.softDrop(false);
  }

  function start() {
    if (game || starting || destroyed || controller.complete) return;
    starting = true;
    try {
      overlay.dataset.introPhase = 'playing';
      game = createIntroGame(overlay.querySelector('[data-game-canvas]'), {
        reducedMotion,
        onProgress({ index, letter, total }) {
          progress.replaceChildren(document.createTextNode(`${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')} `));
          const glyph = document.createElement('span');
          glyph.textContent = letter;
          progress.append(glyph);
          live.textContent = `Letter ${letter}, ${index + 1} of ${total}. Arrow keys or A and D to move. Shift to drop.`;
        },
        onComplete({ score }) {
          stopHold();
          controller.finishGame(score, false);
          live.textContent = `All seven letters landed. Final score ${score}. Continue to enter the website.`;
        }
      });
      controller.gameAttached = true;
      clearTimeout(controller.gameWatchdog);
      game.start();
    } catch (error) {
      console.warn('The entrance game is unavailable.', error);
      controller.finishGame(0, true);
    }
  }

  function skipGame() {
    if (!playing()) return;
    stopHold();
    game.finishInstantly();
    // Show the finished arrangement, then use the same readiness gate as Enter.
    skipTimer = setTimeout(() => controller.requestEntry(), reducedMotion ? 0 : 350);
  }

  controller.playExit = () => {
    stopHold();
    overlay.dataset.introPhase = 'exiting';
    live.textContent = 'Entering Flittle.';
    return game?.playExit();
  };

  function keydown(event) {
    if (!playing() || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === ' ' && event.target instanceof Element && event.target.closest('button')) return;
    if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', 'shift', ' '].includes(key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (key === 'arrowleft' || key === 'a') game.move(-1);
    else if (key === 'arrowright' || key === 'd') game.move(1);
    else if (key === 'arrowdown' || key === 's') game.softDrop(true);
    else if ((key === 'arrowup' || key === 'w') && !event.repeat) game.rotate();
    else if ((key === 'shift' || key === ' ') && !event.repeat) game.hardDrop();
  }
  function keyup(event) {
    if (['arrowdown', 's'].includes(event.key.toLowerCase())) game?.softDrop(false);
  }
  function action(name) {
    if (!playing()) return;
    if (name === 'left') game.move(-1);
    if (name === 'right') game.move(1);
    if (name === 'rotate') game.rotate();
    if (name === 'drop') game.hardDrop();
  }
  function touchDown(event) {
    const button = event.target.closest('[data-game-action]');
    if (!button || !playing()) return;
    event.preventDefault();
    stopHold();
    action(button.dataset.gameAction);
    button.setPointerCapture?.(event.pointerId);
    if (['left', 'right'].includes(button.dataset.gameAction)) {
      holdTimer = setTimeout(() => { repeatTimer = setInterval(() => action(button.dataset.gameAction), 110); }, 240);
    }
  }
  function touchClick(event) {
    // Keyboard activation of the native touch buttons remains available.
    const button = event.target.closest('[data-game-action]');
    if (button && event.detail === 0) action(button.dataset.gameAction);
  }
  const touch = overlay.querySelector('.intro-game__touch');
  const skip = overlay.querySelector('[data-skip-game]');
  skip.addEventListener('click', skipGame);
  document.addEventListener('flittle:begin', start);
  window.addEventListener('keydown', keydown, true);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', stopHold);
  document.addEventListener('visibilitychange', stopHold);
  touch.addEventListener('pointerdown', touchDown);
  touch.addEventListener('click', touchClick);
  window.addEventListener('pointerup', stopHold);
  window.addEventListener('pointercancel', stopHold);
  document.addEventListener('flittle:loaded', () => {
    destroyed = true;
    clearTimeout(skipTimer);
    controller.playExit = null;
    stopHold();
    game?.destroy();
    document.removeEventListener('flittle:begin', start);
    window.removeEventListener('keydown', keydown, true);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', stopHold);
    document.removeEventListener('visibilitychange', stopHold);
    touch.removeEventListener('pointerdown', touchDown);
    touch.removeEventListener('click', touchClick);
    skip.removeEventListener('click', skipGame);
    window.removeEventListener('pointerup', stopHold);
    window.removeEventListener('pointercancel', stopHold);
  }, { once: true });
  // Read-only state for checking input, progress, and renderer cleanup.
  window.__flittleIntro = { state: () => ({ destroyed, ...(game?.state() || { phase: overlay.dataset.introPhase }) }) };
  if (controller.started) start();
}
