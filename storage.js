/* =====================================================
   storage.js — Progress persistence (localStorage)
   ===================================================== */

const STORAGE_KEY = "cali_progress";
const SESSIONS_TO_LEVEL_UP = 3; // completions at same level before suggesting upgrade

// ── Internal ──────────────────────────────────────
function _load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function _save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Exercise level ─────────────────────────────────
// Returns { level, completions } for an exercise
function getExerciseProgress(exerciseId, defaultLevel) {
  const d = _load();
  return d.exercises?.[exerciseId] ?? { level: defaultLevel, completions: 0 };
}

// Call when user finishes all sets of an exercise
function recordExerciseCompletion(exerciseId, defaultLevel) {
  const d = _load();
  if (!d.exercises) d.exercises = {};
  const p = d.exercises[exerciseId] ?? { level: defaultLevel, completions: 0 };
  p.completions = (p.completions || 0) + 1;
  d.exercises[exerciseId] = p;
  _save(d);
  return p;
}

// Returns true when the exercise has enough completions to level up
function isReadyToLevelUp(exerciseId, defaultLevel, maxLevelIndex) {
  const p = getExerciseProgress(exerciseId, defaultLevel);
  return p.completions >= SESSIONS_TO_LEVEL_UP && p.level < maxLevelIndex;
}

// Promotes exercise to next level and resets completions counter
function applyLevelUp(exerciseId, defaultLevel) {
  const d = _load();
  if (!d.exercises) d.exercises = {};
  const p = d.exercises[exerciseId] ?? { level: defaultLevel, completions: 0 };
  p.level = (p.level ?? defaultLevel) + 1;
  p.completions = 0;
  d.exercises[exerciseId] = p;
  _save(d);
  return p;
}

// ── Workout history ────────────────────────────────
function logWorkout(workoutId, completedExerciseIds) {
  const d = _load();
  if (!d.history) d.history = [];
  d.history.push({
    date: new Date().toISOString(),
    workoutId,
    exercises: completedExerciseIds,
  });
  _save(d);
}

function getTotalWorkouts() {
  return (_load().history || []).length;
}

function getWorkoutHistory() {
  return _load().history || [];
}
