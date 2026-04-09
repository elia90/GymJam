/* =====================================================
   storage.js — Progress persistence via Supabase
   Uses an in-memory cache so reads during a workout
   stay synchronous; writes go to Supabase async.
   ===================================================== */

const SESSIONS_TO_LEVEL_UP = 3;

let _userId        = null;
let _cache         = {};   // { exerciseId: { level, completions } }
let _totalWorkouts = 0;
let _userProfile   = null;

// ── Auth ───────────────────────────────────────────
function setCurrentUser(userId) {
  _userId = userId;
  if (!userId) { _cache = {}; _totalWorkouts = 0; _userProfile = null; }
}

// ── Load progress for a full workout at once ───────
async function loadProgressForWorkout(workout) {
  if (!_userId) return;
  const ids = workout.exercises.map(e => e.id);

  const { data } = await db
    .from("exercise_progress")
    .select("exercise_id, level, completions")
    .eq("user_id", _userId)
    .in("exercise_id", ids);

  workout.exercises.forEach(ex => {
    const row = data?.find(d => d.exercise_id === ex.id);
    const startLevel =
      _userProfile?.fitness_level === "beginner"  ? 1 :
      _userProfile?.fitness_level === "advanced"  ? Math.min(ex.defaultLevel + 1, ex.levels.length - 1) :
      ex.defaultLevel;
    _cache[ex.id] = row
      ? { level: row.level, completions: row.completions }
      : { level: startLevel, completions: 0 };
  });
}

// ── Load total workouts count ──────────────────────
async function loadTotalWorkouts() {
  if (!_userId) return 0;
  const { count } = await db
    .from("workout_history")
    .select("*", { count: "exact", head: true })
    .eq("user_id", _userId);
  _totalWorkouts = count || 0;
  return _totalWorkouts;
}

function getTotalWorkouts() {
  return _totalWorkouts;
}

// ── Synchronous cache reads ────────────────────────
function getExerciseProgress(exerciseId, defaultLevel) {
  return _cache[exerciseId] ?? { level: defaultLevel, completions: 0 };
}

function isReadyToLevelUp(exerciseId, defaultLevel, maxLevelIndex) {
  const p = getExerciseProgress(exerciseId, defaultLevel);
  return p.completions >= SESSIONS_TO_LEVEL_UP && p.level < maxLevelIndex;
}

// ── Writes (update cache + persist async) ──────────
function recordExerciseCompletion(exerciseId, defaultLevel) {
  const p = { ...getExerciseProgress(exerciseId, defaultLevel) };
  p.completions = (p.completions || 0) + 1;
  _cache[exerciseId] = p;
  _upsertProgress(exerciseId, p);
  return p;
}

function applyLevelUp(exerciseId, defaultLevel) {
  const p = { ...getExerciseProgress(exerciseId, defaultLevel) };
  p.level = (p.level ?? defaultLevel) + 1;
  p.completions = 0;
  _cache[exerciseId] = p;
  _upsertProgress(exerciseId, p);
  return p;
}

function setExerciseLevel(exerciseId, newLevel) {
  const p = { ...getExerciseProgress(exerciseId, newLevel), level: newLevel, completions: 0 };
  _cache[exerciseId] = p;
  _upsertProgress(exerciseId, p);
}

async function logWorkout(workoutId, completedExerciseIds, durationMinutes, startedAt) {
  if (!_userId) return;
  await db.from("workout_history").insert({
    user_id:          _userId,
    workout_id:       workoutId,
    exercises:        completedExerciseIds,
    duration_minutes: durationMinutes || null,
    started_at:       startedAt || null,
  });
  _totalWorkouts++;
}

async function loadHistory() {
  if (!_userId) return [];
  const { data } = await db
    .from("workout_history")
    .select("*")
    .eq("user_id", _userId)
    .order("completed_at", { ascending: false })
    .limit(50);
  return data || [];
}

// ── Personal Records ───────────────────────────────
async function savePersonalRecord(exerciseId, level) {
  if (!_userId) return;
  await db.from("personal_records").upsert({
    user_id:     _userId,
    exercise_id: exerciseId,
    level,
    achieved_at: new Date().toISOString(),
  }, { onConflict: "user_id,exercise_id,level", ignoreDuplicates: true });
}

async function loadPersonalRecords() {
  if (!_userId) return [];
  const { data } = await db
    .from("personal_records")
    .select("*")
    .eq("user_id", _userId)
    .order("achieved_at", { ascending: false });
  return data || [];
}

// ── User Profile / Onboarding ─────────────────────
async function loadUserProfile() {
  if (!_userId) return null;
  const { data } = await db.from("user_profile").select("*").eq("user_id", _userId).single();
  _userProfile = data || null;
  return _userProfile;
}

async function saveUserProfile(profile) {
  if (!_userId) return;
  const row = { user_id: _userId, ...profile, onboarding_completed: true };
  await db.from("user_profile").upsert(row, { onConflict: "user_id" });
  _userProfile = row;
}

function getUserProfile() {
  return _userProfile;
}

// ── Internal ───────────────────────────────────────
async function _upsertProgress(exerciseId, p) {
  if (!_userId) return;
  await db.from("exercise_progress").upsert({
    user_id:      _userId,
    exercise_id:  exerciseId,
    level:        p.level,
    completions:  p.completions,
    updated_at:   new Date().toISOString(),
  }, { onConflict: "user_id,exercise_id" });
}
