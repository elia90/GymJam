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
  exercisesDone: new Set(),   // indices of fully completed exercises
  restTimer: null,
  restRemaining: 0,
  restTotal: 0,
  workoutStartTime: null,
  // level-up tracking for current session
  levelUps: [],               // { exerciseName, oldLabel, newLabel }
};

// ── Helpers ────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);

function currentWorkout() { return WORKOUTS[state.workoutIndex]; }
function currentExercise() {
  const w = currentWorkout();
  return w ? w.exercises[state.exerciseIndex] : null;
}

// Returns the active level index for an exercise (from storage or default)
function getLevel(ex) {
  return getExerciseProgress(ex.id, ex.defaultLevel).level;
}

// Returns the level data object { label, sets, reps } for current level
function getLevelData(ex) {
  const lvl = getLevel(ex);
  return ex.levels[lvl];
}

// ── Navigation ─────────────────────────────────────
function goTo(screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById("screen-" + screen);
  if (el) el.classList.add("active");
  state.screen = screen;
}

// ── HOME SCREEN ────────────────────────────────────
function renderHome() {
  const container = $("#workout-cards");
  container.innerHTML = "";
  const total = getTotalWorkouts();
  $("#home-workouts-count").textContent = total > 0
    ? `${total} אימון${total === 1 ? "" : "ים"} הושלמו`
    : "בוא נתחיל!";

  WORKOUTS.forEach((w, i) => {
    const colorClass = ["push", "pull", "legs"][i];
    const exCount = w.exercises.length;

    const card = document.createElement("div");
    card.className = `workout-card ${colorClass}`;
    card.innerHTML = `
      <div class="workout-card-emoji">${w.emoji}</div>
      <div class="workout-card-info">
        <div class="workout-card-name">${w.name}</div>
        <div class="workout-card-desc">${w.description}</div>
        <div class="workout-card-meta">
          <span class="badge badge-default">${exCount} תרגילים</span>
          <span class="badge badge-accent">~${Math.round(exCount * 5)} דקות</span>
        </div>
      </div>
      <div class="workout-card-arrow">‹</div>
    `;
    card.addEventListener("click", () => startWorkout(i));
    container.appendChild(card);
  });
}

// ── START WORKOUT ──────────────────────────────────
function startWorkout(index) {
  state.workoutIndex = index;
  state.exercisesDone = new Set();
  state.workoutStartTime = Date.now();
  state.levelUps = [];

  renderWorkoutScreen();
  goTo("workout");
}

// ── WORKOUT SCREEN ─────────────────────────────────
function renderWorkoutScreen() {
  const w = currentWorkout();
  const colorClass = ["push", "pull", "legs"][state.workoutIndex];

  $("#workout-emoji").textContent = w.emoji;
  $("#workout-title").textContent = w.name;
  $("#workout-desc").textContent = w.description;

  const colorMap = { push: "var(--push)", pull: "var(--pull)", legs: "var(--legs)" };
  $("#workout-progress-fill").style.background = colorMap[colorClass] || "var(--accent)";

  updateWorkoutProgress();
  renderExerciseList();
}

function updateWorkoutProgress() {
  const w = currentWorkout();
  const done = state.exercisesDone.size;
  const total = w.exercises.length;
  const pct = total ? (done / total) * 100 : 0;

  $("#workout-progress-fill").style.width = pct + "%";
  $("#workout-progress-label").textContent = `${done} / ${total} תרגילים הושלמו`;

  if (done === total && total > 0) {
    setTimeout(showDoneScreen, 600);
  }
}

function renderExerciseList() {
  const w = currentWorkout();
  const container = $("#exercise-list");
  container.innerHTML = "";

  w.exercises.forEach((ex, i) => {
    const done = state.exercisesDone.has(i);
    const lvlData = getLevelData(ex);
    const lvlIdx  = getLevel(ex);
    const isMax   = lvlIdx === ex.levels.length - 1;
    const { completions } = getExerciseProgress(ex.id, ex.defaultLevel);
    const readyUp = isReadyToLevelUp(ex.id, ex.defaultLevel, ex.levels.length - 1);

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

function renderLevelDots(currentLvl, totalLevels, completions) {
  // Show progress pips: filled = completed sessions at this level, max = SESSIONS_TO_LEVEL_UP
  const pips = Array.from({ length: SESSIONS_TO_LEVEL_UP }, (_, i) =>
    `<span class="progress-pip${i < completions ? " filled" : ""}"></span>`
  ).join("");
  return `<span class="progress-pips">${pips}</span><span class="level-count">רמה ${currentLvl + 1}/${totalLevels}</span>`;
}

// ── OPEN EXERCISE ──────────────────────────────────
function openExercise(index) {
  state.exerciseIndex = index;
  const ex = currentExercise();
  const lvlData = getLevelData(ex);

  state.currentSet = 1;
  state.completedSets = new Array(lvlData.sets).fill(false);

  stopRestTimer();
  renderActiveScreen();
  goTo("active");
}

// ── ACTIVE EXERCISE SCREEN ─────────────────────────
function renderActiveScreen() {
  const ex = currentExercise();
  const lvlData = getLevelData(ex);
  const lvlIdx  = getLevel(ex);

  $("#active-ex-name").textContent = ex.name;
  $("#active-muscles").textContent = ex.muscles;
  $("#active-tip-text").textContent = ex.tips;
  $("#active-reps").textContent = lvlData.reps;
  $("#active-reps-label").textContent = isNaN(lvlData.reps) ? "" : "חזרות";
  $("#active-level-badge").textContent = lvlData.label;
  $("#active-level-num").textContent = `רמה ${lvlIdx + 1} מתוך ${ex.levels.length}`;
  $("#level-down-btn").disabled = lvlIdx === 0;
  $("#level-up-btn").disabled   = lvlIdx === ex.levels.length - 1;

  renderInstructions(ex);
  closeInstructions();
  renderSetDots();
  hideRestTimer();
  updateDoneButton();
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
  if (ex.commonMistakes && ex.commonMistakes.length) {
    mistakesEl.style.display = "";
    mistakesEl.innerHTML = `<div class="instructions-mistakes-title">טעויות נפוצות</div>`;
    ex.commonMistakes.forEach((m) => {
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
    const query = encodeURIComponent(ex.videoSearch);
    videoLink.href = `https://www.youtube.com/results?search_query=${query}`;
    videoLink.style.display = "";
  } else {
    videoLink.style.display = "none";
  }
}

function toggleInstructions() {
  const panel  = $("#instructions-panel");
  const toggle = $("#instructions-toggle");
  const isOpen = panel.classList.contains("open");
  if (isOpen) {
    panel.classList.remove("open");
    toggle.classList.remove("open");
  } else {
    panel.classList.add("open");
    toggle.classList.add("open");
  }
}

function closeInstructions() {
  $("#instructions-panel")?.classList.remove("open");
  $("#instructions-toggle")?.classList.remove("open");
}

// ── SET TRACKER ────────────────────────────────────
function renderSetDots() {
  const ex = currentExercise();
  const lvlData = getLevelData(ex);
  const container = $("#set-dots");
  container.innerHTML = "";

  for (let i = 0; i < lvlData.sets; i++) {
    const dot = document.createElement("div");
    const isCurrent = i + 1 === state.currentSet && !state.completedSets[i];
    const isDone    = state.completedSets[i];

    dot.className = "set-dot" +
      (isCurrent ? " active" : "") +
      (isDone    ? " done"   : "");
    dot.textContent = i + 1;
    dot.addEventListener("click", () => {
      if (!isDone) {
        state.currentSet = i + 1;
        renderSetDots();
      }
    });
    container.appendChild(dot);
  }
}

function updateDoneButton() {
  const ex = currentExercise();
  const lvlData = getLevelData(ex);
  const allDone = state.completedSets.every(Boolean);
  const btn = $("#done-set-btn");

  if (allDone) {
    btn.textContent = "סיימתי את התרגיל ✓";
    btn.disabled = false;
  } else {
    const setIdx = state.currentSet - 1;
    if (state.completedSets[setIdx]) {
      const next = state.completedSets.findIndex((d) => !d);
      state.currentSet = next >= 0 ? next + 1 : state.currentSet;
    }
    btn.textContent = `סיימתי סט ${state.currentSet} מתוך ${lvlData.sets}`;
    btn.disabled = false;
  }
}

// ── DONE SET ───────────────────────────────────────
function doneSet() {
  const ex = currentExercise();
  const allDone = state.completedSets.every(Boolean);

  if (allDone) {
    // Record completion for progression tracking
    const progress = recordExerciseCompletion(ex.id, ex.defaultLevel);
    const maxLvl = ex.levels.length - 1;

    // Check if this completion triggers a level-up
    if (progress.completions >= SESSIONS_TO_LEVEL_UP && progress.level < maxLvl) {
      const oldLabel = ex.levels[progress.level].label;
      const newProgress = applyLevelUp(ex.id, ex.defaultLevel);
      const newLabel = ex.levels[newProgress.level].label;
      state.levelUps.push({ exerciseName: ex.name, oldLabel, newLabel });
    }

    state.exercisesDone.add(state.exerciseIndex);
    stopRestTimer();
    updateWorkoutProgress();
    renderExerciseList();
    goTo("workout");
    return;
  }

  const setIdx = state.currentSet - 1;
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
  state.restTotal     = seconds;
  state.restRemaining = seconds;
  showRestTimer(seconds, seconds);

  state.restTimer = setInterval(() => {
    state.restRemaining--;
    showRestTimer(state.restRemaining, state.restTotal);
    if (state.restRemaining <= 0) {
      stopRestTimer();
      hideRestTimer();
      renderSetDots();
      updateDoneButton();
    }
  }, 1000);
}

function stopRestTimer() {
  if (state.restTimer) { clearInterval(state.restTimer); state.restTimer = null; }
}

function showRestTimer(remaining, total) {
  const el = $("#rest-timer");
  el.classList.add("visible");
  $("#rest-count").textContent = remaining + "s";
  const pct = total > 0 ? (remaining / total) * 100 : 0;
  $("#rest-fill").style.width = pct + "%";
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
  const elapsed = Math.round((Date.now() - state.workoutStartTime) / 60000);

  // Log to history
  logWorkout(w.id, [...state.exercisesDone].map(i => w.exercises[i].id));

  $("#done-workout-name").textContent = w.name;
  $("#done-exercises-count").textContent = w.exercises.length;
  $("#done-duration").textContent = elapsed || "< 1";

  renderLevelUps();
  goTo("done");
}

function renderLevelUps() {
  const container = $("#levelup-container");
  if (!state.levelUps.length) {
    container.style.display = "none";
    return;
  }
  container.style.display = "";
  const list = container.querySelector("#levelup-list");
  list.innerHTML = "";
  state.levelUps.forEach(({ exerciseName, oldLabel, newLabel }) => {
    const item = document.createElement("div");
    item.className = "levelup-item";
    item.innerHTML = `
      <span class="levelup-name">${exerciseName}</span>
      <span class="levelup-arrow">${oldLabel} → <strong>${newLabel}</strong></span>
    `;
    list.appendChild(item);
  });
}

// ── MANUAL LEVEL ADJUSTMENT ────────────────────────
function adjustLevel(direction) {
  const ex = currentExercise();
  const current = getExerciseProgress(ex.id, ex.defaultLevel);
  const newLevel = current.level + direction;

  if (newLevel < 0 || newLevel >= ex.levels.length) return;

  // Save new level, reset completions counter
  const d = JSON.parse(localStorage.getItem("cali_progress") || "{}");
  if (!d.exercises) d.exercises = {};
  d.exercises[ex.id] = { level: newLevel, completions: 0 };
  localStorage.setItem("cali_progress", JSON.stringify(d));

  // Reset sets for new level
  const lvlData = ex.levels[newLevel];
  state.completedSets = new Array(lvlData.sets).fill(false);
  state.currentSet = 1;
  stopRestTimer();
  hideRestTimer();

  renderActiveScreen();
}

// ── BACK BUTTONS ───────────────────────────────────
function backToHome() {
  stopRestTimer();
  renderHome();
  goTo("home");
}

function backToWorkout() {
  stopRestTimer();
  goTo("workout");
}

// ── INIT ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  goTo("home");

  document.getElementById("done-set-btn")?.addEventListener("click", doneSet);
  document.getElementById("skip-rest-btn")?.addEventListener("click", skipRest);
});
