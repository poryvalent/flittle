import { createArcadeGame } from './arcade-runtime.js';
import { drawMascot } from './arcade-art.js';
import { initInvitation } from './intro-invitation.js';
import { siteReadiness } from './site-readiness.js';

const GAMES = [
  { id: 'dodge', title: 'STAR DODGE', instruction: 'Dodge the blocks. Catch the stars. Five waves to shine.', controls: [['← → / A D', 'move'], ['DRAG', 'move'], ['SPACE / SHIFT', 'shield dash']], buttons: [['left','←','Move left'],['primary','DASH ✦','Shield dash'],['right','→','Move right']] },
  { id: 'flappy', title: 'FLITTLE FLIGHT', instruction: 'Small wings. Big possibilities. Tap to stay in the air.', controls: [['SPACE / ↑', 'flap'], ['CLICK / TAP', 'flap']], buttons: [['primary','FLAP ↑','Flap wings']] },
  { id: 'breakout', title: 'BRICK BREAK', instruction: 'Catch the mascot. Clear every brick. Three lives.', controls: [['← → / A D', 'move paddle'], ['MOUSE / DRAG', 'aim paddle'], ['SPACE / TAP', 'launch']], buttons: [['left','←','Move paddle left'],['right','→','Move paddle right'],['primary','LAUNCH ↑','Launch ball']] },
  { id: 'shooter', title: 'COSMIC FLITTLE', instruction: 'A little mascot. An entire galaxy to save.', controls: [['ARROWS / WASD', 'fly'], ['HOLD SPACE', 'fire'], ['DRAG / HOLD', 'fly and fire']], buttons: [['left','←','Fly left'],['right','→','Fly right'],['primary','FIRE ✦','Fire lasers']] },
  { id: 'runner', title: 'LITTLE RUNNER', instruction: 'Keep going. Jump the crystals. Find your rhythm.', controls: [['SPACE / ↑', 'jump'], ['CLICK / TAP', 'jump']], buttons: [['primary','JUMP ↑','Jump obstacle']] }
];
const overlay = document.querySelector('[data-loader]');
const controller = window.__flittleLoader;

// Prepare the final effect in parallel, but never let a decorative exit module
// prevent the invitation or playable games from initializing.
const exitEffectReady = import('./arcade-exit.js?v=mascot-handoff-1').catch(error => {
  console.warn('The arcade exit effect could not prepare.', error);
  return null;
});

if (overlay && controller) {
  let game = null, selected = 0, transitionTimer = 0;
  let switching = false;
  let departure = null;
  const heldPointers = new Map();
  const heldControlKeys = new Map();
  const controlPulses = new Set();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const live = overlay.querySelector('[data-game-live]');
  const progress = overlay.querySelector('[data-game-progress]');
  const touch = overlay.querySelector('.intro-game__touch');
  const canvas = overlay.querySelector('[data-game-canvas]');
  const next = overlay.querySelector('[data-enter-site]');
  const initialLoading = overlay.querySelector('[data-intro-loading]');
  const initialPercent = overlay.querySelector('[data-initial-percent]');
  const initialProgress = overlay.querySelector('[data-initial-progress]');
  const initialMessage = overlay.querySelector('[data-initial-message]');
  const retryLoading = overlay.querySelector('[data-initial-retry]');
  const active = () => game && !controller.released && !controller.requested && !switching;
  const playing = () => active() && !controller.complete;

  initInvitation(overlay, controller);
  retryLoading.addEventListener('click', () => siteReadiness.retry());
  function updateInitialLoading(state = siteReadiness.getState()) {
    if (controller.started || controller.released) return;
    const progress = state.progress * .95 + (controller.coverReady ? .05 : 0);
    const percent = Math.floor(progress * 100);
    const label = state.failed ? 'Something couldn’t finish loading. Please try again.'
      : state.ready && !controller.coverReady ? 'Finishing the colour cover' : state.label;
    initialLoading.style.setProperty('--site-progress', progress);
    initialPercent.textContent = `${percent}%`;
    initialProgress.setAttribute('aria-valuenow', percent);
    initialProgress.setAttribute('aria-valuetext', `${percent} percent. ${label}`);
    if (initialMessage.textContent !== label) initialMessage.textContent = label;
    retryLoading.hidden = !state.failed;
    initialLoading.classList.toggle('has-load-error', state.failed);
  }
  const unsubscribeInitial = siteReadiness.subscribe(updateInitialLoading);
  document.addEventListener('flittle:cover-ready', updateInitialLoadingFromCover);
  function updateInitialLoadingFromCover() { updateInitialLoading(); }
  document.addEventListener('flittle:begin', () => {
    unsubscribeInitial();
    document.removeEventListener('flittle:cover-ready', updateInitialLoadingFromCover);
  }, { once: true });
  function clearDeparture() {
    departure?.destroy(); departure = null;
    overlay.classList.remove('has-exit-fallback');
  }

  const mascot = document.querySelector('[data-arcade-mascot]');
  const mascotContext = mascot?.getContext('2d');
  if (mascotContext) drawMascot(mascotContext, 16, 16, 32);
  const curtain = overlay.querySelector('[data-transition-pixels]');
  for (let i = 0; i < 32; i++) {
    const tile = document.createElement('i');
    const x = i % 8 - 3.5, y = Math.floor(i / 8) - 1.5;
    tile.style.setProperty('--i', i);
    tile.style.setProperty('--tile-x', x);
    tile.style.setProperty('--tile-y', y);
    tile.style.setProperty('--tile-delay', `${Math.hypot(x, y) * 25}ms`);
    curtain.append(tile);
  }

  function input(action, pressed) {
    if (!playing()) return;
    game.input(action, pressed);
  }
  function stopHold() {
    for (const hold of heldPointers.values()) { clearTimeout(hold.delay); clearInterval(hold.repeat); }
    heldPointers.clear();
    heldControlKeys.clear();
    for (const timer of controlPulses) clearTimeout(timer);
    controlPulses.clear();
    game?.releaseControls?.();
    for (const action of ['left','right','up','down','primary']) game?.input?.(action, false);
  }
  function clearTimers() { clearTimeout(transitionTimer); stopHold(); }
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
      game = createArcadeGame(canvas, {
        kind: item.id, reducedMotion: reducedMotion.matches,
        onProgress(value) {
          progress.textContent = `SCORE ${String(value.score || 0).padStart(4, '0')}${value.lives !== undefined ? `  ·  ${value.lives} LIVES` : ''}`;
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
    clearDeparture();
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
    stopHold();
    // Exit from the actual frame the visitor played, with their mascot and obstacles.
    // The fully prepared website is revealed as soon as the final attack ends.
    controller.started = true;
    controller.finishGame(game?.state().score || 0, false);
    controller.requestEntry();
  }
  controller.playExit = async () => {
    clearTimers();
    const gameState = game?.state() || null;
    let snapshot = null;
    try {
      if (game && canvas.width && canvas.height) {
        snapshot = document.createElement('canvas');
        snapshot.width = canvas.width; snapshot.height = canvas.height;
        snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
      }
    } catch { snapshot = null; }
    game?.destroy(); game = null;
    overlay.dataset.introPhase = 'exiting';
    overlay.focus({ preventScroll: true });
    live.textContent = GAMES[selected].id === 'shooter' ? 'Ultimate attack charging. Clearing the galaxy and entering Flittle.' : 'One final power move. Entering Flittle.';
    try {
      const effect = await new Promise(resolve => {
        const timer = setTimeout(() => resolve(null), 1200);
        exitEffectReady.then(value => { clearTimeout(timer); resolve(value); });
      });
      if (!effect) throw new Error('The arcade exit effect is unavailable.');
      if (controller.released) return false;
      const { createArcadeExit } = effect;
      departure = createArcadeExit(canvas, {
        kind: GAMES[selected].id, snapshot, gameState, reducedMotion: reducedMotion.matches
      });
    } catch (error) {
      console.warn('The final attack is unavailable. Entering the prepared website.', error);
      overlay.classList.add('has-exit-fallback');
      departure = {
        finish: () => Promise.resolve(true), destroy() {}
      };
    }
    return departure.finish();
  };
  controller.revealSite = () => departure?.reveal?.();
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
      if (!event.repeat) input(action, true);
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
      if (['left','right'].includes(action)) {
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
    clearTimers(); clearDeparture(); game?.destroy(); game = null; switching = false;
  });
  window.__flittleIntro = {
    state: () => ({ destroyed: !game, active: !controller.released, selected, gameId: GAMES[selected].id, games: GAMES.map(({ id, title }) => ({ id, title })), ...(game?.state() || { phase: overlay.dataset.introPhase }), exit: departure?.state?.() || null })
  };
  if (controller.started && !controller.released && !controller.requested) launch();
}
