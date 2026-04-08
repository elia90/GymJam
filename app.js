/* =====================================================
   CALISTHENICS COACH — app.js
   ===================================================== */

// ── State ──────────────────────────────────────────
let state = {
  screen: "home",
  workoutIndex: null,
  exerciseIndex: null,
  currentSet: 1,
  completedSets: [],
  exercisesDone: new Set(),
  restTimer: null,
  restRemaining: 0,
  restTotal: 0,
  workoutStartTime: null,
  levelUps: [],
};

let currentUser = null;

// ── Helpers ────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);

function currentWorkout() { return WORKOUTS[state.workoutIndex]; }
function currentExercise() {
  const w = currentWorkout();
  return w ? w.exercises[state.exerciseIndex] : null;
}

function getLevel(ex) {
  return getExerciseProgress(ex.id, ex.defaultLevel).level;
}
function getLevelData(ex) {
  return ex.levels[getLevel(ex)];
}

// ── Navigation ─────────────────────────────────────
function goTo(screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById("screen-" + screen);
  if (el) el.classList.add("active");
  state.screen = screen;
}

// ── AUTH ───────────────────────────────────────────
async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: "https://gymjam90.netlify.app" },
  });
  if (error) alert("שגיאה בהתחברות: " + error.message);
}

async function signOut() {
  await db.auth.signOut();
}

function renderUserInfo(user) {
  const el = $("#user-info");
  if (!el) return;
  const name = user.user_metadata?.full_name || user.email || "משתמש";
  const avatar = user.user_metadata?.avatar_url;
  el.innerHTML = avatar
    ? `<img src="${avatar}" class="user-avatar" alt="${name}" /><span class="user-name">${name}</span>`
    : `<span class="user-name">${name}</span>`;
}

// ── HOME SCREEN ────────────────────────────────────
async function renderHome() {
  await loadTotalWorkouts();
  const total = getTotalWorkouts();
  $("#home-workouts-count").textContent = total > 0
    ? `${total} אימון${total === 1 ? "" : "ים"} הושלמו`
    : "בוא נתחיל!";

  const container = $("#workout-cards");
  container.innerHTML = "";

  WORKOUTS.forEach((w, i) => {
    const colorClass = ["push", "pull", "legs"][i];
    const card = document.createElement("div");
    card.className = `workout-card ${colorClass}`;
    card.innerHTML = `
      <div class="workout-card-emoji">${w.emoji}</div>
      <div class="workout-card-info">
        <div class="workout-card-name">${w.name}</div>
        <div class="workout-card-desc">${w.description}</div>
        <div class="workout-card-meta">
          <span class="badge badge-default">${w.exercises.length} תרגילים</span>
          <span class="badge badge-accent">~${Math.round(w.exercises.length * 5)} דקות</span>
        </div>
      </div>
      <div class="workout-card-arrow">‹</div>
    `;
    card.addEventListener("click", () => startWorkout(i));
    container.appendChild(card);
  });
}

// ── START WORKOUT ──────────────────────────────────
async function startWorkout(index) {
  state.workoutIndex = index;
  state.exercisesDone = new Set();
  state.workoutStartTime = Date.now();
  state.levelUps = [];

  // Load progress from Supabase into cache
  await loadProgressForWorkout(currentWorkout());

  renderWorkoutScreen();
  goTo("workout");
}

// ── WORKOUT SCREEN ─────────────────────────────────
function renderWorkoutScreen() {
  const w = currentWorkout();
  const colorClass = ["push", "pull", "legs"][state.workoutIndex];

  $("#workout-emoji").textContent = w.emoji;
  $("#workout-title").textContent = w.name;
  $("#workout-desc").textContent  = w.description;

  const colorMap = { push: "var(--push)", pull: "var(--pull)", legs: "var(--legs)" };
  $("#workout-progress-fill").style.background = colorMap[colorClass] || "var(--accent)";

  updateWorkoutProgress();
  renderExerciseList();
}

function updateWorkoutProgress() {
  const w = currentWorkout();
  const done  = state.exercisesDone.size;
  const total = w.exercises.length;
  $("#workout-progress-fill").style.width = (total ? (done / total) * 100 : 0) + "%";
  $("#workout-progress-label").textContent = `${done} / ${total} תרגילים הושלמו`;
  if (done === total && total > 0) setTimeout(showDoneScreen, 600);
}

function renderExerciseList() {
  const w = currentWorkout();
  const container = $("#exercise-list");
  container.innerHTML = "";

  w.exercises.forEach((ex, i) => {
    const done     = state.exercisesDone.has(i);
    const lvlData  = getLevelData(ex);
    const lvlIdx   = getLevel(ex);
    const isMax    = lvlIdx === ex.levels.length - 1;
    const { completions } = getExerciseProgress(ex.id, ex.defaultLevel);
    const readyUp  = isReadyToLevelUp(ex.id, ex.defaultLevel, ex.levels.length - 1);

    const item = document.createElement("div");
    item.className = "exercise-item" + (done ? " done" : "");
    item.innerHTML = `
      <div class="exercise-num">${done ? "✓" : i + 1}</div>
      <div class="exercise-details">
        <div class="exercise-name">${ex.name}</div>
        <div class="exercise-meta">${lvlData.sets} סטים × ${lvlData.reps} · מנוחה ${ex.rest}s</div>
        <div class="exercise-level-row">
          <span class="level-badge${isMax ? " level-badge-max" : ""}">${lvlData.label}</span>
          ${readyUp
            ? `<span class="level-up-hint">⬆ מוכן לשדרוג</span>`
            : `<span class="level-dots">${renderLevelDots(lvlIdx, ex.levels.length, completions)}</span>`
          }
        </div>
      </div>
      <div class="exercise-arrow">‹</div>
    `;
    item.addEventListener("click", () => openExercise(i));
    container.appendChild(item);
  });
}

function renderLevelDots(lvlIdx, totalLevels, completions) {
  const pips = Array.from({ length: SESSIONS_TO_LEVEL_UP }, (_, i) =>
    `<span class="progress-pip${i < completions ? " filled" : ""}"></span>`
  ).join("");
  return `<span class="progress-pips">${pips}</span><span class="level-count">רמה ${lvlIdx + 1}/${totalLevels}</span>`;
}

// ── OPEN EXERCISE ──────────────────────────────────
function openExercise(index) {
  state.exerciseIndex = index;
  const lvlData = getLevelData(currentExercise());
  state.currentSet   = 1;
  state.completedSets = new Array(lvlData.sets).fill(false);
  stopRestTimer();
  renderActiveScreen();
  goTo("active");
}

// ── ACTIVE EXERCISE SCREEN ─────────────────────────
function renderActiveScreen() {
  const ex      = currentExercise();
  const lvlData = getLevelData(ex);
  const lvlIdx  = getLevel(ex);

  $("#active-ex-name").textContent    = ex.name;
  $("#active-muscles").textContent    = ex.muscles;
  $("#active-tip-text").textContent   = ex.tips;
  $("#active-reps").textContent       = lvlData.reps;
  $("#active-reps-label").textContent = isNaN(lvlData.reps) ? "" : "חזרות";
  $("#active-level-badge").textContent = lvlData.label;
  $("#active-level-num").textContent   = `רמה ${lvlIdx + 1} מתוך ${ex.levels.length}`;
  $("#level-down-btn").disabled = lvlIdx === 0;
  $("#level-up-btn").disabled   = lvlIdx === ex.levels.length - 1;

  renderInstructions(ex);
  closeInstructions();
  renderSetDots();
  hideRestTimer();
  updateDoneButton();
}

// ── MANUAL LEVEL ADJUSTMENT ────────────────────────
function adjustLevel(direction) {
  const ex      = currentExercise();
  const current = getExerciseProgress(ex.id, ex.defaultLevel);
  const newLevel = current.level + direction;
  if (newLevel < 0 || newLevel >= ex.levels.length) return;

  setExerciseLevel(ex.id, newLevel);

  const lvlData = ex.levels[newLevel];
  state.completedSets = new Array(lvlData.sets).fill(false);
  state.currentSet = 1;
  stopRestTimer();
  hideRestTimer();
  renderActiveScreen();
}

// ── INSTRUCTIONS PANEL ──────────────────────────────
function renderInstructions(ex) {
  const stepsEl = $("#instructions-steps");
  stepsEl.innerHTML = `<div class="instructions-steps-title">שלבי ביצוע</div>`;
  (ex.steps || []).forEach((step, i) => {
    const div = document.createElement("div");
    div.className = "step-item";
    div.innerHTML = `<div class="step-num">${i + 1}</div><div class="step-text">${step}</div>`;
    stepsEl.appendChild(div);
  });

  const mistakesEl = $("#instructions-mistakes");
  if (ex.commonMistakes?.length) {
    mistakesEl.style.display = "";
    mistakesEl.innerHTML = `<div class="instructions-mistakes-title">טעויות נפוצות</div>`;
    ex.commonMistakes.forEach(m => {
      const div = document.createElement("div");
      div.className = "mistake-item";
      div.textContent = m;
      mistakesEl.appendChild(div);
    });
  } else {
    mistakesEl.style.display = "none";
  }

  const videoLink = $("#instructions-video-link");
  if (ex.videoSearch) {
    videoLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.videoSearch)}`;
    videoLink.style.display = "";
  } else {
    videoLink.style.display = "none";
  }
}

function toggleInstructions() {
  const panel  = $("#instructions-panel");
  const toggle = $("#instructions-toggle");
  const isOpen = panel.classList.contains("open");
  panel.classList.toggle("open", !isOpen);
  toggle.classList.toggle("open", !isOpen);
}

function closeInstructions() {
  $("#instructions-panel")?.classList.remove("open");
  $("#instructions-toggle")?.classList.remove("open");
}

// ── SET TRACKER ────────────────────────────────────
function renderSetDots() {
  const lvlData   = getLevelData(currentExercise());
  const container = $("#set-dots");
  container.innerHTML = "";

  for (let i = 0; i < lvlData.sets; i++) {
    const dot = document.createElement("div");
    dot.className = "set-dot" +
      (i + 1 === state.currentSet && !state.completedSets[i] ? " active" : "") +
      (state.completedSets[i] ? " done" : "");
    dot.textContent = i + 1;
    dot.addEventListener("click", () => {
      if (!state.completedSets[i]) { state.currentSet = i + 1; renderSetDots(); }
    });
    container.appendChild(dot);
  }
}

function updateDoneButton() {
  const ex      = currentExercise();
  const lvlData = getLevelData(ex);
  const allDone = state.completedSets.every(Boolean);
  const btn = $("#done-set-btn");

  if (allDone) {
    btn.textContent = "סיימתי את התרגיל ✓";
  } else {
    const setIdx = state.currentSet - 1;
    if (state.completedSets[setIdx]) {
      const next = state.completedSets.findIndex(d => !d);
      state.currentSet = next >= 0 ? next + 1 : state.currentSet;
    }
    btn.textContent = `סיימתי סט ${state.currentSet} מתוך ${lvlData.sets}`;
  }
  btn.disabled = false;
}

// ── DONE SET ───────────────────────────────────────
function doneSet() {
  const ex      = currentExercise();
  const allDone = state.completedSets.every(Boolean);

  if (allDone) {
    const progress = recordExerciseCompletion(ex.id, ex.defaultLevel);
    const maxLvl   = ex.levels.length - 1;
    if (progress.completions >= SESSIONS_TO_LEVEL_UP && progress.level < maxLvl) {
      const oldLabel = ex.levels[progress.level].label;
      const newP     = applyLevelUp(ex.id, ex.defaultLevel);
      state.levelUps.push({ exerciseName: ex.name, oldLabel, newLabel: ex.levels[newP.level].label });
    }
    state.exercisesDone.add(state.exerciseIndex);
    stopRestTimer();
    updateWorkoutProgress();
    renderExerciseList();
    goTo("workout");
    return;
  }

  const setIdx  = state.currentSet - 1;
  state.completedSets[setIdx] = true;
  const nextUndone = state.completedSets.findIndex((d, i) => !d && i > setIdx);
  const anyUndone  = state.completedSets.findIndex(d => !d);

  renderSetDots();
  updateDoneButton();
  if (anyUndone >= 0) {
    startRestTimer(ex.rest);
    state.currentSet = (nextUndone >= 0 ? nextUndone : anyUndone) + 1;
  }
}

// ── REST TIMER ─────────────────────────────────────
function startRestTimer(seconds) {
  stopRestTimer();
  state.restTotal = state.restRemaining = seconds;
  showRestTimer(seconds, seconds);
  state.restTimer = setInterval(() => {
    state.restRemaining--;
    showRestTimer(state.restRemaining, state.restTotal);
    if (state.restRemaining <= 0) { stopRestTimer(); hideRestTimer(); renderSetDots(); updateDoneButton(); }
  }, 1000);
}

function stopRestTimer() {
  if (state.restTimer) { clearInterval(state.restTimer); state.restTimer = null; }
}

function showRestTimer(remaining, total) {
  $("#rest-timer").classList.add("visible");
  $("#rest-count").textContent = remaining + "s";
  $("#rest-fill").style.width  = (total > 0 ? (remaining / total) * 100 : 0) + "%";
}

function hideRestTimer() {
  $("#rest-timer")?.classList.remove("visible");
}

function skipRest() {
  stopRestTimer();
  hideRestTimer();
  renderSetDots();
  updateDoneButton();
}

// ── DONE SCREEN ────────────────────────────────────
function showDoneScreen() {
  const w = currentWorkout();
  const duration = Math.round((Date.now() - state.workoutStartTime) / 60000) || 1;
  logWorkout(w.id, [...state.exercisesDone].map(i => w.exercises[i].id), duration);

  $("#done-workout-name").textContent     = w.name;
  $("#done-exercises-count").textContent  = w.exercises.length;
  $("#done-duration").textContent         = Math.round((Date.now() - state.workoutStartTime) / 60000) || "< 1";

  const container = $("#levelup-container");
  if (!state.levelUps.length) {
    container.style.display = "none";
  } else {
    container.style.display = "";
    const list = $("#levelup-list");
    list.innerHTML = "";
    state.levelUps.forEach(({ exerciseName, oldLabel, newLabel }) => {
      const item = document.createElement("div");
      item.className = "levelup-item";
      item.innerHTML = `<span class="levelup-name">${exerciseName}</span>
        <span class="levelup-arrow">${oldLabel} → <strong>${newLabel}</strong></span>`;
      list.appendChild(item);
    });
  }
  goTo("done");
}

// ── HISTORY SCREEN ────────────────────────────────
async function openHistory() {
  goTo("history");
  const list = $("#history-list");
  list.innerHTML = `<div class="history-loading">טוען...</div>`;

  const entries = await loadHistory();

  if (!entries.length) {
    list.innerHTML = `<div class="history-empty">עוד אין אימונים מוקלטים<br>סיים את האימון הראשון שלך 💪</div>`;
    return;
  }

  // Weekly stats
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek = entries.filter(e => new Date(e.completed_at) >= weekStart).length;
  $("#history-week-count").textContent = `${thisWeek} אימון${thisWeek === 1 ? "" : "ים"} השבוע`;
  $("#history-total-count").textContent = `${entries.length} סה"כ`;

  // Build list grouped by week
  list.innerHTML = "";
  let lastWeekLabel = null;

  entries.forEach(entry => {
    const date     = new Date(entry.completed_at);
    const weekLabel = getWeekLabel(date);
    const workout  = WORKOUTS.find(w => w.id === entry.workout_id);
    if (!workout) return;

    if (weekLabel !== lastWeekLabel) {
      const sep = document.createElement("div");
      sep.className = "history-week-sep";
      sep.textContent = weekLabel;
      list.appendChild(sep);
      lastWeekLabel = weekLabel;
    }

    const card = document.createElement("div");
    card.className = "history-card";
    card.innerHTML = `
      <div class="history-card-emoji">${workout.emoji}</div>
      <div class="history-card-info">
        <div class="history-card-name">${workout.name}</div>
        <div class="history-card-meta">${formatDate(date)} · ${entry.exercises?.length || 0} תרגילים${entry.duration_minutes ? ` · ${entry.duration_minutes} דק׳` : ""}</div>
      </div>
    `;
    list.appendChild(card);
  });
}

function getWeekLabel(date) {
  const now   = new Date();
  const day   = 24 * 60 * 60 * 1000;
  const diff  = Math.floor((now - date) / day);
  if (diff < 7)  return "השבוע";
  if (diff < 14) return "שבוע שעבר";
  const week = Math.ceil(diff / 7);
  return `לפני ${week} שבועות`;
}

function formatDate(date) {
  const now  = new Date();
  const diff = Math.floor((now - date) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "היום";
  if (diff === 1) return "אתמול";
  if (diff < 7)  return `לפני ${diff} ימים`;
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

// ── BACK BUTTONS ───────────────────────────────────
async function backToHome() {
  stopRestTimer();
  await renderHome();
  goTo("home");
}

function backToWorkout() {
  stopRestTimer();
  goTo("workout");
}

// ── INIT ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("done-set-btn")?.addEventListener("click", doneSet);
  document.getElementById("skip-rest-btn")?.addEventListener("click", skipRest);

  // Auth state listener — drives the whole app
  db.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      currentUser = session.user;
      setCurrentUser(currentUser.id);
      renderUserInfo(currentUser);
      await renderHome();
      goTo("home");
    } else {
      currentUser = null;
      setCurrentUser(null);
      goTo("login");
    }
  });
});
