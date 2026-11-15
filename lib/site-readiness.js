// Local-only readiness state: it can report a failed remote module graph even
// when main.js never executes. Progress advances only when real work finishes.
const definitions = [
  ['modules', .10, 'Starting the website'],
  ['images', .18, 'Preparing website images'],
  ['fonts', .08, 'Preparing typography'],
  ['video', .08, 'Preparing the colour cover'],
  ['model', .24, 'Building the sculpture'],
  ['effects', .18, 'Preparing interactive effects'],
  ['orbit', .14, 'Preparing the project galaxy'],
];
const tasks = new Map(definitions.map(([id, weight, label]) => [id, { id, weight, label, status: 'pending', error: '', warning: '' }]));
const listeners = new Set();
let moduleTimer = 0;

function getState() {
  const stages = [...tasks.values()];
  const failed = stages.find(task => task.status === 'failed');
  const ready = stages.every(task => task.status === 'done');
  const next = stages.find(task => task.status === 'running') || stages.find(task => task.status === 'pending');
  const warnings = stages.filter(task => task.warning).map(task => task.warning);
  return {
    progress: ready ? 1 : Math.min(.999, stages.reduce((sum, task) => sum + (task.status === 'done' ? task.weight : 0), 0)),
    ready, failed: Boolean(failed),
    label: failed ? failed.label : ready ? 'Website ready' : next?.label || 'Preparing the website',
    ...(failed ? { error: failed.error } : {}),
    degraded: warnings.length > 0, warnings,
    stages: stages.map(({ id, status, label }) => ({ id, status, label })),
  };
}

function notify() {
  const state = getState();
  for (const listener of listeners) {
    try { listener(state); } catch (error) { console.error('Website readiness subscriber failed.', error); }
  }
}

export const siteReadiness = Object.freeze({
  getState,
  subscribe(listener) {
    listeners.add(listener);
    listener(getState());
    return () => listeners.delete(listener);
  },
  retry() {
    if (!getState().failed) return false;
    // A reload also retries failed ES-module imports and disposes any partially
    // initialized WebGL scenes; reinvoking initializers would duplicate them.
    window.location.reload();
    return true;
  },
});
window.__flittleReadiness = siteReadiness;

export function completeSiteTask(id, result) {
  const task = tasks.get(id);
  if (!task || task.status === 'failed' || task.status === 'done') return;
  task.status = 'done';
  task.warning = result?.fallback || '';
  if (id === 'modules') clearTimeout(moduleTimer);
  notify();
}

export function failSiteTask(id, error) {
  const task = tasks.get(id);
  if (!task || task.status === 'done' || task.status === 'failed') return;
  task.status = 'failed';
  task.error = error instanceof Error ? error.message : String(error || 'This part of the website could not load.');
  if (id === 'modules') clearTimeout(moduleTimer);
  notify();
}

export function trackSiteTask(id, work, { timeout = 30000 } = {}) {
  const task = tasks.get(id);
  if (!task) throw new Error(`Unknown website readiness task: ${id}`);
  if (task.status !== 'failed') task.status = 'running';
  notify();
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(true, new Error(`${task.label} took too long. Please retry loading the website.`)), timeout);
    function finish(failed, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (failed) { failSiteTask(id, value); reject(value); }
      else { completeSiteTask(id, value); resolve(value); }
    }
    Promise.resolve().then(() => typeof work === 'function' ? work() : work).then(value => finish(false, value), error => finish(true, error));
  });
}

// A timeout is a failure with a retry action, never permission to show an
// unprepared site. Asset and GPU tasks have their own deadlines once started.
moduleTimer = setTimeout(() => failSiteTask('modules', new Error('The website modules could not load. Check your connection and retry.')), 30000);
