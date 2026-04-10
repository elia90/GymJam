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

// ── Challenge Progress ─────────────────────────────
let _challengeCompleted = new Set();

async function loadChallengeProgress() {
  if (!_userId) return;
  const { data } = await db.from("challenge_progress").select("day_number").eq("user_id", _userId);
  _challengeCompleted = new Set((data || []).map(r => r.day_number));
}

function getChallengeCompleted() { return _challengeCompleted; }

const XP_LEVELS = [0, 200, 500, 1000, 2000, Infinity];
const LEVEL_NAMES = ["", "מתחיל", "לוחם", "גיבור", "אלוף", "אגדה"];
const BOSS_DAYS = new Set([7, 14, 21, 28, 35, 42, 49, 50]);

async function completeChallengDay(dayNumber) {
  if (!_userId) return;
  _challengeCompleted.add(dayNumber);
  await db.from("challenge_progress").upsert(
    { user_id: _userId, day_number: dayNumber },
    { onConflict: "user_id,day_number" }
  );

  // XP
  const isBoss  = BOSS_DAYS.has(dayNumber);
  const baseXP  = isBoss ? 100 : 50;
  const profile = _userProfile || {};
  const today   = new Date().toISOString().slice(0, 10);
  const lastDate = profile.last_completed_date;

  // Streak logic
  let streak = profile.streak || 0;
  if (lastDate) {
    const diff = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
    if (diff <= 2) streak++;
    else streak = 1;
  } else {
    streak = 1;
  }

  // Streak bonus every 7 days
  const streakBonus = (streak % 7 === 0) ? 10 : 0;
  const earnedXP = baseXP + streakBonus;
  const newXP = (profile.xp || 0) + earnedXP;

  // Level
  let newLevel = 1;
  for (let i = XP_LEVELS.length - 2; i >= 0; i--) {
    if (newXP >= XP_LEVELS[i]) { newLevel = i + 1; break; }
  }

  const updates = { xp: newXP, level: newLevel, streak, last_completed_date: today };
  await db.from("user_profile").update(updates).eq("user_id", _userId);
  _userProfile = { ..._userProfile, ...updates };

  return { earnedXP, streakBonus, newXP, newLevel, streak, leveledUp: newLevel > (profile.level || 1) };
}

async function loadLeaderboard() {
  const { data } = await db.rpc("get_leaderboard");
  return data || [];
}

function getXPForLevel(level) { return XP_LEVELS[level - 1] || 0; }
function getXPForNextLevel(level) { return XP_LEVELS[level] || XP_LEVELS[XP_LEVELS.length - 2]; }
function getLevelName(level) { return LEVEL_NAMES[level] || "אגדה"; }

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
