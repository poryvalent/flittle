import { createIntroGame } from './intro-game.js';
import { createArcadeGame } from './arcade-runtime.js';
import { drawMascot } from './arcade-art.js';

const GAMES = [
  { id: 'tetris', title: 'LETTER DROP', instruction: 'Seven letters. Make them land.', controls: [['← → / A D', 'move'], ['↑ / W', 'rotate'], ['↓ / S', 'fall faster'], ['SHIFT / SPACE', 'drop']], buttons: [['left','←','Move left'],['rotate','↻','Rotate letter'],['right','→','Move right'],['primary','DROP ↓','Drop letter']] },
  { id: 'flappy', title: 'FLITTLE FLIGHT', instruction: 'Small wings. Big possibilities. Tap to stay in the air.', controls: [['SPACE / ↑', 'flap'], ['CLICK / TAP', 'flap']], buttons: [['primary','FLAP ↑','Flap wings']] },
  { id: 'breakout', title: 'BRICK BREAK', instruction: 'Catch the mascot. Clear every brick. Three lives.', controls: [['← → / A D', 'move paddle'], ['MOUSE / DRAG', 'aim paddle'], ['SPACE / TAP', 'launch']], buttons: [['left','←','Move paddle left'],['right','→','Move paddle right'],['primary','LAUNCH ↑','Launch ball']] },
  { id: 'shooter', title: 'COSMIC FLITTLE', instruction: 'A little mascot. An entire galaxy to save.', controls: [['ARROWS / WASD', 'fly'], ['HOLD SPACE', 'fire'], ['DRAG / HOLD', 'fly and fire']], buttons: [['left','←','Fly left'],['right','→','Fly right'],['primary','FIRE ✦','Fire lasers']] },
  { id: 'runner', title: 'LITTLE RUNNER', instruction: 'Keep going. Jump the crystals. Find your rhythm.', controls: [['SPACE / ↑', 'jump'], ['CLICK / TAP', 'jump']], buttons: [['primary','JUMP ↑','Jump obstacle']] }
];
const overlay = document.querySelector('[data-loader]');
const controller = window.__flittleLoader;

if (overlay && controller) {
  let game = null, selected = 0, transitionTimer = 0, skipTimer = 0;
  let switching = false;
  const heldPointers = new Map();
  const heldControlKeys = new Map();
  const controlPulses = new Set();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const live = overlay.querySelector('[data-game-live]');
  const progress = overlay.querySelector('[data-game-progress]');
  const touch = overlay.querySelector('.intro-game__touch');
  const canvas = overlay.querySelector('[data-game-canvas]');
  const next = overlay.querySelector('[data-enter-site]');
  const active = () => game && !controller.released && !controller.requested && !switching;
  const playing = () => active() && !controller.complete;

  const mascot = document.querySelector('[data-arcade-mascot]');
  if (mascot) drawMascot(mascot.getContext('2d'), 16, 16, 32);
  const curtain = overlay.querySelector('[data-transition-pixels]');
  for (let i = 0; i < 32; i++) {
    const tile = document.createElement('i'); tile.style.setProperty('--i', i); curtain.append(tile);
  }

  function input(action, pressed) {
    if (!playing()) return;
    if (GAMES[selected].id !== 'tetris') { game.input(action, pressed); return; }
    if (action === 'down') game.softDrop(pressed);
    if (!pressed) return;
    if (action === 'left') game.move(-1);
    if (action === 'right') game.move(1);
    if (action === 'rotate' || action === 'up') game.rotate();
    if (action === 'primary') game.hardDrop();
  }
  function stopHold() {
    for (const hold of heldPointers.values()) { clearTimeout(hold.delay); clearInterval(hold.repeat); }
    heldPointers.clear();
    heldControlKeys.clear();
    for (const timer of controlPulses) clearTimeout(timer);
    controlPulses.clear();
    game?.softDrop?.(false);
    game?.releaseControls?.();
    for (const action of ['left','right','up','down','primary']) game?.input?.(action, false);
  }
  function clearTimers() { clearTimeout(transitionTimer); clearTimeout(skipTimer); stopHold(); }
  function chrome() {
    const item = GAMES[selected];
    overlay.dataset.arcadeGame = item.id;
    overlay.querySelector('[data-arcade-title]').textContent = item.title;
    overlay.querySelector('[data-arcade-index]').textContent = `${String(selected + 1).padStart(2, '0')} / 05`;
    overlay.querySelector('.intro-game__instruction').textContent = item.instruction;
    overlay.querySelector('.intro-game__complete').textContent = 'ROUND COMPLETE';
    overlay.querySelector('[data-game-fallback]').hidden = true;
    overlay.querySelector('[data-final-score]').textContent = '0';
    overlay.querySelector('[data-game-entry-status]').textContent = '';
    overlay.querySelector('[data-skip-game]').innerHTML = 'ENTER WEBSITE <span aria-hidden="true">&rarr;</span>';
    next.querySelector('span').textContent = controller.returning ? 'BACK TO WEBSITE' : 'ENTER FLITTLE';
    const legend = overlay.querySelector('.intro-game__legend');
    legend.replaceChildren();
    const heading = document.createElement('span'); heading.className = 'intro-game__legend-title'; heading.textContent = 'MAKE YOUR MOVE'; legend.append(heading);
    for (const [keys, description] of [...item.controls, ['Q / E', 'switch game']]) {
      const row = document.createElement('span'), key = document.createElement('kbd'), desc = document.createElement('em');
      key.textContent = keys; desc.textContent = description; row.append(key, desc); legend.append(row);
    }
    touch.replaceChildren();
    for (const [action, label, accessibleLabel] of item.buttons) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.gameAction = action; button.textContent = label; button.setAttribute('aria-label', accessibleLabel); touch.append(button);
    }
    overlay.querySelectorAll('[data-select-game]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.selectGame) === selected)));
    for (const [selector, delta] of [['[data-arcade-prev]', -1], ['[data-arcade-next]', 1]]) {
      const button = overlay.querySelector(selector), title = GAMES[(selected + delta + GAMES.length) % GAMES.length].title;
      button.setAttribute('aria-label', `${delta < 0 ? 'Previous' : 'Next'} game: ${title}`);
      button.querySelector('.arcade-nav__label').textContent = title;
    }
  }
  function mountGame() {
    if (controller.released || controller.requested) return;
    stopHold(); game?.destroy(); game = null;
    switching = false;
    controller.complete = false;
    controller.exitComplete = controller.entering = false;
    next.disabled = false;
    controller.updateLoading();
    overlay.classList.remove('game-unavailable');
    overlay.dataset.introPhase = 'playing';
    chrome();
    try {
      const item = GAMES[selected];
      game = (item.id === 'tetris' ? createIntroGame : createArcadeGame)(canvas, {
        kind: item.id, reducedMotion: reducedMotion.matches,
        onProgress(value) {
          if (item.id === 'tetris') {
            progress.textContent = `${String(Math.min(value.index + 1, 7)).padStart(2, '0')} / 07  ${value.letter}`;
            live.textContent = `Letter ${value.letter || 'complete'}. ${Math.min(value.index + 1, 7)} of seven.`;
          } else {
            progress.textContent = `SCORE ${String(value.score || 0).padStart(4, '0')}${value.lives !== undefined ? `  ·  ${value.lives} LIVES` : ''}`;
          }
        },
        onComplete({ score, title }) {
          stopHold();
          controller.finishGame(score, false);
          overlay.querySelector('.intro-game__complete').textContent = title || 'ROUND COMPLETE';
          live.textContent = `${item.title}. Score ${score}. Play again, choose another game, or enter the website.`;
        }
      });
      controller.gameAttached = true;
      clearTimeout(controller.gameWatchdog);
      game.start();
      overlay.focus({ preventScroll: true });
      live.textContent = `${item.title}. ${item.instruction} ${item.controls.map(([keys, description]) => `${keys} to ${description}`).join('. ')}.`;
    } catch (error) {
      console.warn('This arcade game is unavailable.', error);
      game?.destroy(); game = null;
      controller.finishGame(0, true);
    }
  }
  function launch(replay = false) {
    if (controller.released || controller.requested) return;
    clearTimers();
    game?.destroy(); game = null;
    switching = true;
    controller.complete = false;
    next.disabled = false;
    overlay.querySelector('[data-begin]').hidden = replay;
    overlay.dataset.introPhase = 'launching';
    transitionTimer = setTimeout(mountGame, reducedMotion.matches ? 0 : replay ? 920 : 950);
  }
  function choose(index) {
    if (controller.released || controller.requested || switching || !controller.started) return;
    clearTimers();
    game?.destroy(); game = null;
    selected = (index + GAMES.length) % GAMES.length;
    switching = true;
    overlay.dataset.introPhase = 'switching';
    transitionTimer = setTimeout(mountGame, reducedMotion.matches ? 0 : 180);
  }
  function enterWebsite() {
    if (!controller.ready || controller.released || controller.requested) return;
    clearTimers();
    switching = false;
    if (controller.complete) { controller.requestEntry(); return; }
    if (!game) {
      controller.started = true;
      controller.finishGame(0, false);
      controller.requestEntry();
      return;
    }
    stopHold();
    game.finishInstantly();
    skipTimer = setTimeout(() => controller.requestEntry(), reducedMotion.matches || GAMES[selected].id !== 'tetris' ? 0 : 350);
  }
  controller.playExit = () => {
    clearTimers();
    overlay.dataset.introPhase = 'exiting';
    live.textContent = 'Entering Flittle.';
    return game?.playExit();
  };
  function keyAction(key) {
    if (key === 'arrowleft' || key === 'a') return 'left';
    if (key === 'arrowright' || key === 'd') return 'right';
    if (key === 'arrowdown' || key === 's') return 'down';
    if (key === 'arrowup' || key === 'w') return ['flappy','runner'].includes(GAMES[selected].id) ? 'primary' : 'up';
    if (key === ' ' || key === 'shift') return 'primary';
  }
  function keydown(event) {
    if (controller.released) return;
    if (event.key === 'Tab') {
      const buttons = [...overlay.querySelectorAll('button:not(:disabled)')].filter(button => button.getClientRects().length);
      if (!buttons.length) { event.preventDefault(); overlay.focus(); return; }
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!buttons.includes(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'escape' && controller.ready && controller.started) { event.preventDefault(); event.stopImmediatePropagation(); enterWebsite(); return; }
    const control = event.target instanceof Element && event.target.closest('[data-game-action]');
    if (control && [' ', 'enter'].includes(key) && playing()) {
      event.preventDefault(); event.stopImmediatePropagation();
      const action = control.dataset.gameAction;
      heldControlKeys.set(key, action);
      if (!event.repeat || GAMES[selected].id === 'tetris' && ['left','right'].includes(action)) input(action, true);
      return;
    }
    if (['q','e'].includes(key) && active() && !event.repeat) { event.preventDefault(); choose(selected + (key === 'q' ? -1 : 1)); return; }
    if (!playing() || key === ' ' && event.target instanceof Element && event.target.closest('button')) return;
    const action = keyAction(key);
    if (!action) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat && !['left','right','down'].includes(action)) return;
    input(action, true);
  }
  function keyup(event) {
    const key = event.key.toLowerCase();
    if (heldControlKeys.has(key)) {
      event.preventDefault(); input(heldControlKeys.get(key), false); heldControlKeys.delete(key); return;
    }
    const action = keyAction(key); if (action) input(action, false);
  }
  function pointerDown(event) {
    const button = event.target.closest('[data-game-action]');
    if (!button || !playing()) return;
    event.preventDefault();
    const action = button.dataset.gameAction;
    const hold = { action, delay: 0, repeat: 0 };
    heldPointers.set(event.pointerId, hold);
    button.setPointerCapture?.(event.pointerId);
    input(action, true);
    if (GAMES[selected].id === 'tetris' && ['left','right'].includes(action)) {
      hold.delay = setTimeout(() => { hold.repeat = setInterval(() => input(action, true), 100); }, 220);
    }
  }
  function pointerUp(event) {
    const hold = heldPointers.get(event.pointerId);
    if (!hold) return;
    clearTimeout(hold.delay); clearInterval(hold.repeat);
    heldPointers.delete(event.pointerId);
    if (![...heldPointers.values()].some(other => other.action === hold.action)) input(hold.action, false);
  }
  touch.addEventListener('pointerdown', pointerDown);
  touch.addEventListener('click', event => {
    const button = event.target.closest('[data-game-action]');
    if (button && event.detail === 0 && playing()) {
      const action = button.dataset.gameAction, targetGame = game;
      input(action, true);
      // Assistive activation may send only click, without keydown/keyup. Give
      // continuous movement at least one simulation step before releasing it.
      if (GAMES[selected].id !== 'tetris' && ['left','right'].includes(action)) {
        const timer = setTimeout(() => { targetGame.input(action, false); controlPulses.delete(timer); }, 120);
        controlPulses.add(timer);
      } else input(action, false);
    }
  });
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);
  window.addEventListener('keydown', keydown, true);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', stopHold);
  document.addEventListener('visibilitychange', stopHold);
  controller.skipGame = enterWebsite;
  overlay.querySelector('[data-arcade-prev]').addEventListener('click', () => choose(selected - 1));
  overlay.querySelector('[data-arcade-next]').addEventListener('click', () => choose(selected + 1));
  overlay.querySelector('[data-arcade-retry]').addEventListener('click', () => choose(selected));
  overlay.querySelectorAll('[data-select-game]').forEach(button => button.addEventListener('click', () => choose(Number(button.dataset.selectGame))));
  document.querySelector('[data-open-arcade]').addEventListener('click', () => controller.openArcade());
  document.addEventListener('flittle:begin', () => launch());
  document.addEventListener('flittle:replay', () => launch(true));
  document.addEventListener('flittle:loaded', () => {
    clearTimers(); game?.destroy(); game = null; switching = false;
  });
  window.__flittleIntro = {
    state: () => ({ destroyed: !game, active: !controller.released, selected, gameId: GAMES[selected].id, games: GAMES.map(({ id, title }) => ({ id, title })), ...(game?.state() || { phase: overlay.dataset.introPhase }) })
  };
  if (controller.started && !controller.released && !controller.requested) launch();
}
