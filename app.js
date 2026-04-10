/* =====================================================
   CALISTHENICS COACH — app.js
   ===================================================== */

const ADMIN_EMAIL = "elia666@gmail.com";

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

let currentUser          = null;
let workoutTimerInterval = null;
let warmupState = {
  workoutIndex:    null,
  exerciseIndex:   0,
  countdownTimer:  null,
  remaining:       0,
};

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
    options: { redirectTo: "https://gymjam.pages.dev" },
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

  // Show admin button only for admin user
  const adminBtn = $("#admin-btn");
  if (adminBtn) adminBtn.style.display = user.email === ADMIN_EMAIL ? "flex" : "none";
}

// ── DAILY TIP ──────────────────────────────────────
const DAILY_TIPS = [
  { icon: "💧", text: "שתה לפחות 2 ליטר מים היום — התייבשות מפחיתה כוח ב-10%." },
  { icon: "😴", text: "שינה של 7-9 שעות היא הסטרואיד החינמי הכי טוב שיש — השרירים גדלים בשינה." },
  { icon: "🥩", text: "שאף ל-1.6-2 גרם חלבון לק\"ג משקל גוף ביום לבניית שריר." },
  { icon: "🔥", text: "חימום מפחית פציעות ב-50% ומשפר ביצועים — אל תדלג עליו." },
  { icon: "📈", text: "עקרון העומס ההדרגתי: כל שבוע לנסות להוסיף חזרה אחת או להקשות מעט." },
  { icon: "🧘", text: "לחץ גבוה מעלה קורטיזול שמפרק שריר — 5 נשימות עמוקות לפני אימון עוזרות." },
  { icon: "⏱️", text: "מנוחה של 90-120 שניות בין סטים אופטימלית לבניית כוח וגודל." },
  { icon: "🍌", text: "ארוחה קלה 1-2 שעות לפני אימון — פחמימות + חלבון = אנרגיה ושמירה על שריר." },
  { icon: "🎯", text: "כיווץ מודע: חשוב על השריר שאתה עובד בזמן התרגיל — זה מגביר פעילות שרירית." },
  { icon: "🛁", text: "מקלחת קרה אחרי אימון מפחיתה דלקת ומאיצה התאוששות." },
  { icon: "📅", text: "עקביות עוקפת עצימות — 3 אימונים בשבוע לאורך שנה עדיפים על חודש אינטנסיבי." },
  { icon: "🦵", text: "אל תזניח רגליים — 70% ממסת השריר בגוף נמצאת מהמותניים למטה." },
  { icon: "🤸", text: "מתיחות אחרי אימון מפחיתות כאבי DOMS ומשפרות טווח תנועה לאימון הבא." },
  { icon: "🧂", text: "אלקטרוליטים חשובים: הוסף קורט מלח למים בימי אימון אינטנסיביים." },
  { icon: "💪", text: "Progressive overload: הגוף מסתגל מהר — שנה גירוי כל 4-6 שבועות." },
  { icon: "🍳", text: "ביצים הן אחד ממקורות החלבון הזולים והמלאים — 6 גרם חלבון לביצה." },
  { icon: "🧠", text: "Visualization עובד: תאר לעצמך את התרגיל לפני שאתה עושה אותו." },
  { icon: "⚡", text: "קפאין 30-60 דקות לפני אימון משפר ביצועים בממוצע 11%." },
  { icon: "🌅", text: "אימון בוקר מגביר מטבוליזם לאורך כל היום ומשפר מצב רוח." },
  { icon: "🔄", text: "מנוחה אקטיבית (הליכה, מתיחות) ביום חופש עדיפה על מנוחה מוחלטת." },
  { icon: "📊", text: "עקוב אחר ההתקדמות שלך — מה שנמדד משתפר." },
  { icon: "🎵", text: "מוזיקה עם טמפו מהיר (130-140 BPM) מגבירה ביצועים ב-15%." },
];

function renderDailyTip() {
  const el = $("#daily-tip-card");
  if (!el) return;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const tip = DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
  el.innerHTML = `
    <div class="daily-tip-icon">${tip.icon}</div>
    <div class="daily-tip-text"><strong>טיפ יומי</strong><br>${tip.text}</div>
  `;
}

// ── AFTER LOGIN ────────────────────────────────────
async function afterLogin() {
  const profile = await loadUserProfile();
  if (!profile || !profile.onboarding_completed) {
    goTo("onboarding");
  } else {
    await loadChallengeProgress();
    renderChallengeMap();
    goTo("challenge");
  }
}

// ── ONBOARDING ─────────────────────────────────────
const _onboardingSelections = { level: null, goal: null, age: null, gender: null };

function selectOpt(group, value) {
  _onboardingSelections[group] = value;

  const container = document.getElementById(`opt-${group}`);
  container.querySelectorAll(".onboarding-opt").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.value === value);
  });

  const allSelected = _onboardingSelections.level && _onboardingSelections.goal &&
                      _onboardingSelections.age   && _onboardingSelections.gender;
  document.getElementById("onboarding-submit").disabled = !allSelected;
}

async function submitOnboarding() {
  const btn = document.getElementById("onboarding-submit");
  btn.disabled = true;
  btn.textContent = "שומר...";

  await saveUserProfile({
    fitness_level: _onboardingSelections.level,
    goal:          _onboardingSelections.goal,
    age_range:     _onboardingSelections.age,
    gender:        _onboardingSelections.gender,
  });

  await loadChallengeProgress();
  renderChallengeMap();
  goTo("challenge");
}

// ── HOME SCREEN ────────────────────────────────────
async function renderHome() {
  await loadTotalWorkouts();
  const total = getTotalWorkouts();
  $("#home-workouts-count").textContent = total > 0
    ? `${total} אימון${total === 1 ? "" : "ים"} הושלמו`
    : "בוא נתחיל!";

  renderDailyTip();

  const tipOrder = $("#tip-order");
  if (tipOrder) {
    const days = getUserProfile()?.days_per_week || 3;
    tipOrder.textContent = days <= 2
      ? "הסדר המומלץ: A ← B ← מנוחה ← A ← B..."
      : days >= 4
      ? "הסדר המומלץ: A ← B ← C ← A ← מנוחה..."
      : "הסדר המומלץ: A ← B ← C ← מנוחה ← A...";
  }

  const container = $("#workout-cards");
  container.innerHTML = "";

  const daysPerWeek = getUserProfile()?.days_per_week || 3;
  const visibleCount = Math.min(daysPerWeek, WORKOUTS.length);

  // Update section title based on days
  const sectionTitle = document.querySelector(".section-title");
  if (sectionTitle) {
    sectionTitle.textContent = visibleCount === 2
      ? "תוכנית 2 ימים בשבוע"
      : visibleCount >= 4
      ? "תוכנית 4+ ימים בשבוע"
      : "תוכנית 3 ימים בשבוע";
  }

  // Muscle → workout mapping
  const muscleMap = {
    push: ["chest", "shoulders", "triceps"],
    pull: ["back", "biceps"],
    legs: ["legs", "glutes", "abs"],
  };
  const targetMuscles = getUserProfile()?.target_muscles || [];

  WORKOUTS.slice(0, visibleCount).forEach((w, i) => {
    const colorClass = ["push", "pull", "legs"][i];
    const letters = ["A", "B", "C"];
    const maxEx = getMaxExercises();
    const exCount = Math.min(w.exercises.length, maxEx);
    const isRecommended = targetMuscles.length > 0 &&
      muscleMap[colorClass]?.some(m => targetMuscles.includes(m));
    const card = document.createElement("div");
    card.className = `workout-card ${colorClass}`;
    card.innerHTML = `
      <div class="workout-card-letter ${colorClass}">${letters[i]}</div>
      <div class="workout-card-info">
        <div class="workout-card-name">${w.name}${isRecommended ? ' <span class="recommended-badge">מומלץ ⭐</span>' : ""}</div>
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
// ── WARMUP ─────────────────────────────────────────
function openWarmup(workoutIndex) {
  warmupState.workoutIndex  = workoutIndex;
  warmupState.exerciseIndex = 0;
  clearWarmupTimer();

  const w       = WORKOUTS[workoutIndex];
  const warmup  = WARMUPS[w.id];

  $("#warmup-header-title").textContent = warmup.title;
  $("#warmup-intro").style.display      = "";
  $("#warmup-active").style.display     = "none";
  $("#warmup-done").style.display       = "none";

  // Preview list
  const preview = $("#warmup-preview");
  preview.innerHTML = "";
  warmup.exercises.forEach((ex, i) => {
    const div = document.createElement("div");
    div.className = "warmup-preview-item";
    div.innerHTML = `<span class="warmup-preview-num">${i + 1}</span><span>${ex.name}</span><span class="warmup-preview-dur">${ex.duration}s</span>`;
    preview.appendChild(div);
  });

  goTo("warmup");
}

function beginWarmup() {
  $("#warmup-intro").style.display  = "none";
  $("#warmup-active").style.display = "";
  showWarmupExercise();
}

function showWarmupExercise() {
  const w      = WORKOUTS[warmupState.workoutIndex];
  const warmup = WARMUPS[w.id];
  const ex     = warmup.exercises[warmupState.exerciseIndex];
  const total  = warmup.exercises.length;
  const idx    = warmupState.exerciseIndex;

  $("#warmup-step-label").textContent = `תרגיל ${idx + 1} מתוך ${total}`;
  $("#warmup-progress-fill").style.width = `${((idx) / total) * 100}%`;
  $("#warmup-ex-name").textContent    = ex.name;
  $("#warmup-instruction").textContent = ex.instruction;
  $("#warmup-next-btn").textContent   = idx < total - 1 ? "הבא ›" : "סיום חימום ✓";

  // Video link
  const vid = $("#warmup-video-link");
  vid.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.videoSearch)}`;

  startWarmupCountdown(ex.duration);
}

function startWarmupCountdown(seconds) {
  clearWarmupTimer();
  warmupState.remaining = seconds;
  updateWarmupRing(seconds, seconds);

  warmupState.countdownTimer = setInterval(() => {
    warmupState.remaining--;
    updateWarmupRing(warmupState.remaining, seconds);
    if (warmupState.remaining <= 0) {
      clearWarmupTimer();
      nextWarmupExercise();
    }
  }, 1000);
}

function updateWarmupRing(remaining, total) {
  $("#warmup-countdown").textContent = remaining;
  const circumference = 2 * Math.PI * 52; // r=52
  const fill = $("#warmup-ring-fill");
  const offset = circumference * (1 - remaining / total);
  fill.style.strokeDashoffset = offset;
}

function nextWarmupExercise() {
  const w      = WORKOUTS[warmupState.workoutIndex];
  const warmup = WARMUPS[w.id];
  clearWarmupTimer();

  warmupState.exerciseIndex++;
  if (warmupState.exerciseIndex >= warmup.exercises.length) {
    // Done
    $("#warmup-active").style.display = "none";
    $("#warmup-done").style.display   = "";
    $("#warmup-progress-fill").style.width = "100%";
  } else {
    showWarmupExercise();
  }
}

function finishWarmup() {
  clearWarmupTimer();
  doStartWorkout(warmupState.workoutIndex);
}

function skipWarmup() {
  clearWarmupTimer();
  doStartWorkout(warmupState.workoutIndex);
}

function backFromWarmup() {
  clearWarmupTimer();
  warmupState.workoutIndex = null;
  backToHome();
}

function clearWarmupTimer() {
  if (warmupState.countdownTimer) {
    clearInterval(warmupState.countdownTimer);
    warmupState.countdownTimer = null;
  }
}

async function startWorkout(index) {
  openWarmup(index);
}

function getMaxExercises() {
  const duration = getUserProfile()?.workout_duration || 45;
  if (duration <= 30) return 4;
  if (duration <= 45) return 6;
  if (duration <= 60) return 8;
  return Infinity;
}

async function doStartWorkout(index) {
  state.workoutIndex = index;
  state.exercisesDone = new Set();
  state.workoutStartTime = Date.now();
  state.levelUps = [];

  // Load progress from Supabase into cache
  await loadProgressForWorkout(currentWorkout());

  renderWorkoutScreen();
  startWorkoutTimer();
  goTo("workout");
}

// ── WORKOUT TIMER ──────────────────────────────────
function startWorkoutTimer() {
  if (workoutTimerInterval) clearInterval(workoutTimerInterval);
  updateWorkoutTimer();
  workoutTimerInterval = setInterval(updateWorkoutTimer, 1000);
}

function updateWorkoutTimer() {
  const el = $("#workout-timer");
  if (!el || !state.workoutStartTime) return;
  const elapsed = Math.floor((Date.now() - state.workoutStartTime) / 1000);
  const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  el.textContent = `${m}:${s}`;
}

function stopWorkoutTimer() {
  if (workoutTimerInterval) { clearInterval(workoutTimerInterval); workoutTimerInterval = null; }
}

function formatTime(date) {
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
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
  const total = Math.min(w.exercises.length, getMaxExercises());
  $("#workout-progress-fill").style.width = (total ? (done / total) * 100 : 0) + "%";
  $("#workout-progress-label").textContent = `${done} / ${total} תרגילים הושלמו`;
  if (done === total && total > 0) setTimeout(showDoneScreen, 600);
}

function renderExerciseList() {
  const w = currentWorkout();
  const container = $("#exercise-list");
  container.innerHTML = "";
  const maxEx = getMaxExercises();

  w.exercises.slice(0, maxEx).forEach((ex, i) => {
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
      const newLabel = ex.levels[newP.level].label;
      state.levelUps.push({ exerciseId: ex.id, exerciseName: ex.name, oldLabel, newLabel, newLevel: newP.level });
      savePersonalRecord(ex.id, newP.level);
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
    startRestTimer(getAdjustedRest(ex.rest));
    state.currentSet = (nextUndone >= 0 ? nextUndone : anyUndone) + 1;
  }
}

// ── REST TIMER ─────────────────────────────────────
function getAdjustedRest(baseSeconds) {
  const goal = getUserProfile()?.goal;
  if (goal === "tone") return Math.round(baseSeconds * 0.7);  // חיטוב — מנוחה קצרה יותר
  if (goal === "mass") return Math.round(baseSeconds * 1.2);  // מסה — מנוחה ארוכה יותר
  return baseSeconds;
}

function startRestTimer(seconds) {
  stopRestTimer();
  state.restTotal = state.restRemaining = seconds;
  showRestTimer(seconds, seconds);
  state.restTimer = setInterval(() => {
    state.restRemaining--;
    showRestTimer(state.restRemaining, state.restTotal);
    if (state.restRemaining <= 0) { stopRestTimer(); hideRestTimer(); renderSetDots(); updateDoneButton(); notifyRestDone(); }
  }, 1000);
}

function notifyRestDone() {
  // Vibration (mobile)
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  // Short beep via Web Audio API
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
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
  const endTime  = new Date();
  const startTime = new Date(state.workoutStartTime);
  const duration = Math.round((endTime - startTime) / 60000) || 1;
  logWorkout(w.id, [...state.exercisesDone].map(i => w.exercises[i].id), duration, startTime.toISOString());

  stopWorkoutTimer();

  $("#done-workout-name").textContent    = w.name;
  $("#done-exercises-count").textContent = w.exercises.length;
  $("#done-duration").textContent        = duration;
  $("#done-start-time").textContent      = formatTime(startTime);
  $("#done-end-time").textContent        = formatTime(endTime);

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
  renderShareButtons(w.name, w.exercises.length, duration);
  goTo("done");
  if (state.levelUps.length) setTimeout(showPRCelebration, 600);
}

function renderShareButtons(workoutName, exerciseCount, duration) {
  const el = $("#share-row");
  if (!el) return;

  const text = `סיימתי ${workoutName} ב-GymJam! 💪\n${exerciseCount} תרגילים · ${duration} דקות`;
  const url  = "https://gymjam.pages.dev";
  const encodedText = encodeURIComponent(`${text}\n${url}`);

  // Native share (mobile)
  if (navigator.share) {
    el.innerHTML = `<button class="share-btn" onclick="nativeShare()">שתף אימון ↗</button>`;
    el._shareData = { title: "GymJam", text, url };
  } else {
    // Fallback: WhatsApp + Telegram
    el.innerHTML = `
      <a class="share-btn whatsapp" href="https://wa.me/?text=${encodedText}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="share-btn telegram" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}" target="_blank" rel="noopener">Telegram</a>
    `;
  }
}

function nativeShare() {
  const el = $("#share-row");
  if (el?._shareData) navigator.share(el._shareData).catch(() => {});
}

function showPRCelebration() {
  const modal = $("#pr-modal");
  const list  = $("#pr-modal-list");
  list.innerHTML = "";
  state.levelUps.forEach(({ exerciseName, newLabel }) => {
    const div = document.createElement("div");
    div.className = "pr-modal-item";
    div.innerHTML = `<span class="pr-modal-ex">${exerciseName}</span><span class="pr-modal-level">${newLabel}</span>`;
    list.appendChild(div);
  });
  modal.classList.add("visible");
}

function closePRModal() {
  $("#pr-modal")?.classList.remove("visible");
}

// ── PR SCREEN ──────────────────────────────────────
async function openPRs() {
  goTo("prs");
  const list = $("#pr-list");
  list.innerHTML = `<div class="history-loading">טוען...</div>`;

  const records = await loadPersonalRecords();

  if (!records.length) {
    list.innerHTML = `<div class="history-empty">עוד אין שיאים אישיים<br>סיים 3 אימונים בתרגיל כלשהו 🏆</div>`;
    return;
  }

  list.innerHTML = "";

  // Group by exercise, show highest level per exercise first
  const byExercise = {};
  records.forEach(r => {
    if (!byExercise[r.exercise_id] || r.level > byExercise[r.exercise_id].level) {
      byExercise[r.exercise_id] = r;
    }
  });

  // Find exercise data
  const allExercises = WORKOUTS.flatMap(w => w.exercises);

  Object.values(byExercise)
    .sort((a, b) => new Date(b.achieved_at) - new Date(a.achieved_at))
    .forEach(record => {
      const ex = allExercises.find(e => e.id === record.exercise_id);
      if (!ex) return;
      const levelLabel = ex.levels[record.level]?.label || `רמה ${record.level + 1}`;
      const isMax = record.level === ex.levels.length - 1;
      const date  = new Date(record.achieved_at);

      const card = document.createElement("div");
      card.className = "pr-card";
      card.innerHTML = `
        <div class="pr-card-trophy">${isMax ? "🥇" : "🏆"}</div>
        <div class="pr-card-info">
          <div class="pr-card-name">${ex.name}</div>
          <div class="pr-card-level">${levelLabel}${isMax ? " — רמה מקסימלית!" : ""}</div>
          <div class="pr-card-date">${formatDate(date)}</div>
        </div>
      `;
      list.appendChild(card);
    });
}

// ── CHALLENGE MAP ─────────────────────────────────
let _currentChallengeDay = null;

async function openChallenge() {
  goTo("challenge");
  await loadChallengeProgress();
  renderChallengeMap();
}

function renderChallengeMap() {
  renderChallengeXP();
  const adminBtn = $("#admin-btn");
  if (adminBtn && currentUser) adminBtn.style.display = currentUser.email === ADMIN_EMAIL ? "flex" : "none";
  const completed = getChallengeCompleted();
  const total = CHALLENGE_DAYS.length;
  const doneCount = completed.size;

  // Header
  $("#challenge-progress-fill").style.width = (doneCount / total * 100) + "%";
  $("#challenge-progress-label").textContent = `${doneCount} / ${total}`;

  let streak = 0;
  for (let i = doneCount; i >= 1; i--) {
    if (completed.has(i)) streak++;
    else break;
  }
  $("#challenge-streak").textContent = streak >= 2 ? `🔥 ${streak} ימים רצופים` : "";

  const map = $("#challenge-map");
  map.innerHTML = "";

  const containerW = Math.min(window.innerWidth - 32, 480);
  const V_SPACING  = 100;
  const NODE_R     = 28;
  const TOTAL_H    = total * V_SPACING + 80;

  // Winding x positions (fraction of containerW), groups of 5
  const xPatterns = [
    [0.12, 0.30, 0.50, 0.70, 0.88],
    [0.88, 0.70, 0.50, 0.30, 0.12],
  ];

  // day 1 at top → index 0 has lowest y
  const positions = CHALLENGE_DAYS.map((day, i) => ({
    x: Math.round(containerW * xPatterns[Math.floor(i / 5) % 2][i % 5]),
    y: 40 + i * V_SPACING,
    day,
  }));

  map.style.cssText = `position:relative;height:${TOTAL_H}px;width:${containerW}px;margin:0 auto`;

  // ── SVG path ───────────────────────────────────────
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", containerW);
  svg.setAttribute("height", TOTAL_H);
  svg.style.cssText = "position:absolute;top:0;left:0;pointer-events:none";

  const buildPath = pts => pts.map((p, i) => {
    const cy = p.y + NODE_R;
    if (i === 0) return `M ${p.x} ${cy}`;
    const prev = pts[i - 1];
    const midY = (prev.y + NODE_R + cy) / 2;
    return `C ${prev.x} ${midY} ${p.x} ${midY} ${p.x} ${cy}`;
  }).join(" ");

  const addPath = (d, color, w) => {
    const el = document.createElementNS(NS, "path");
    el.setAttribute("d", d);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", color);
    el.setAttribute("stroke-width", w);
    el.setAttribute("stroke-linecap", "round");
    svg.appendChild(el);
  };

  addPath(buildPath(positions), "#dde2ea", 6);
  if (doneCount > 0) addPath(buildPath(positions.slice(0, doneCount)), "var(--accent)", 6);
  map.appendChild(svg);

  // ── Week labels ────────────────────────────────────
  const weekNames = ["","שבוע 1","שבוע 2","שבוע 3","שבוע 4","שבוע 5","שבוע 6","שבוע 7 🏆"];
  let lastWeek = 0;
  positions.forEach(pos => {
    const w = pos.day.week;
    if (w !== lastWeek) {
      lastWeek = w;
      const lbl = document.createElement("div");
      lbl.className = "challenge-week-float";
      lbl.textContent = weekNames[w] || `שבוע ${w}`;
      lbl.style.cssText = `position:absolute;top:${pos.y - 26}px;left:0;right:0;text-align:center;pointer-events:none`;
      map.appendChild(lbl);
    }
  });

  // ── Nodes ──────────────────────────────────────────
  positions.forEach(pos => {
    const day    = pos.day;
    const isDone = completed.has(day.day);
    const isNext = day.day === doneCount + 1;
    const isLocked = day.day > doneCount + 1;

    const wrap = document.createElement("div");
    wrap.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:3px;width:68px`;

    const cardColors = {
      push: "#e8d5f5", pull: "#d5e8f5", legs: "#d5f5e3",
      abs: "#fdf3d5", arms: "#fde8d5", core: "#f5d5d5",
      default: "#e4e8ee"
    };
    const muscleKey = day.muscles.includes("גב") ? "pull"
      : day.muscles.includes("רגל") || day.muscles.includes("ישבן") ? "legs"
      : day.muscles.includes("בטן") || day.muscles.includes("ליבה") ? "abs"
      : day.muscles.includes("יד") || day.muscles.includes("ביצפס") || day.muscles.includes("טריצפס") ? "arms"
      : day.muscles.includes("חזה") || day.muscles.includes("כתפיים") ? "push"
      : "default";
    const bgColor = cardColors[muscleKey];

    const isBoss = BOSS_DAYS.has(day.day);
    const btn = document.createElement("button");
    btn.className = "challenge-node" + (isDone ? " done" : isNext ? " next" : isLocked ? " locked" : "") + (isBoss ? " boss" : "");
    btn.style.background = isBoss && !isLocked ? "#fff3cd" : bgColor;

    if (isLocked) {
      btn.innerHTML = `
        <span class="node-emoji-bg">${day.emoji}</span>
        <div class="node-lock-overlay">🔒</div>
        <span class="node-num-abs">${day.day}</span>
      `;
    } else if (isDone) {
      btn.innerHTML = `
        <span class="node-emoji-bg">${day.emoji}</span>
        <div class="node-done-overlay">✓</div>
        <span class="node-num-abs">${day.day}</span>
      `;
    } else {
      btn.innerHTML = `
        <span class="node-emoji-bg">${day.emoji}</span>
        <span class="node-num-abs">${day.day}</span>
      `;
    }

    if (!isLocked) btn.onclick = () => openChallengeDay(day.day);
    wrap.appendChild(btn);

    if (!isLocked) {
      const lbl = document.createElement("div");
      lbl.className = "challenge-node-name";
      lbl.textContent = day.name;
      wrap.appendChild(lbl);
    }

    map.appendChild(wrap);
  });

  // Scroll to top so day 1 is visible
  requestAnimationFrame(() => {
    const screen = $("#screen-challenge");
    if (screen) screen.scrollTop = 0;
  });
}

let _challengeRestTimer = null;
let _challengeCurrentSet = 1;

function openChallengeDay(dayNumber) {
  const day = CHALLENGE_DAYS.find(d => d.day === dayNumber);
  if (!day) return;
  _currentChallengeDay = dayNumber;
  _challengeCurrentSet = 1;
  stopChallengeRest();

  const completed = getChallengeCompleted();
  const isDone = completed.has(dayNumber);

  $("#challenge-day-title").textContent = `יום ${dayNumber}`;
  $("#challenge-day-emoji").textContent = day.emoji;
  $("#challenge-day-name").textContent = day.name;
  $("#challenge-day-muscles").textContent = `שרירים: ${day.muscles}`;
  $("#challenge-day-details").innerHTML = `
    <div class="cday-detail"><span>סטים</span><strong>${day.sets}</strong></div>
    <div class="cday-detail"><span>חזרות</span><strong>${day.reps}</strong></div>
    <div class="cday-detail"><span>מנוחה</span><strong>${day.rest}s</strong></div>
  `;

  const videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(day.videoSearch)}`;
  $("#challenge-video-link").href = videoUrl;

  if (isDone) {
    $("#cday-set-tracker").style.display = "none";
    $("#cday-set-btn").style.display = "none";
    $("#challenge-complete-btn").style.display = "none";
    $("#challenge-done-label").style.display = "block";
  } else {
    $("#cday-set-tracker").style.display = "flex";
    $("#cday-set-btn").style.display = "block";
    $("#challenge-complete-btn").style.display = "none";
    $("#challenge-done-label").style.display = "none";
    renderChallengeSetDots(day);
  }

  goTo("challenge-day");
}

function renderChallengeSetDots(day) {
  const dots = $("#cday-set-dots");
  if (!dots) return;
  dots.innerHTML = "";
  for (let i = 1; i <= day.sets; i++) {
    const d = document.createElement("div");
    d.className = "set-dot" + (i < _challengeCurrentSet ? " done" : i === _challengeCurrentSet ? " active" : "");
    dots.appendChild(d);
  }
}

function doneChallengeSet() {
  const day = CHALLENGE_DAYS.find(d => d.day === _currentChallengeDay);
  if (!day) return;

  if (_challengeCurrentSet >= day.sets) {
    // All sets done
    stopChallengeRest();
    $("#cday-rest").style.display = "none";
    $("#cday-set-btn").style.display = "none";
    $("#cday-set-tracker").style.display = "none";
    $("#challenge-complete-btn").style.display = "block";
    return;
  }

  _challengeCurrentSet++;
  renderChallengeSetDots(day);
  startChallengeRest(day.rest);
}

function startChallengeRest(seconds) {
  stopChallengeRest();
  let remaining = seconds;
  const restEl  = $("#cday-rest");
  const countEl = $("#cday-rest-count");
  const fillEl  = $("#cday-rest-fill");
  const setBtn  = $("#cday-set-btn");

  restEl.style.display = "block";
  setBtn.disabled = true;
  setBtn.style.opacity = "0.4";

  const update = () => {
    countEl.textContent = remaining + "s";
    fillEl.style.width = (remaining / seconds * 100) + "%";
  };
  update();

  _challengeRestTimer = setInterval(() => {
    remaining--;
    update();
    if (remaining <= 0) {
      stopChallengeRest();
      restEl.style.display = "none";
      setBtn.disabled = false;
      setBtn.style.opacity = "1";
      notifyRestDone();
    }
  }, 1000);
}

function stopChallengeRest() {
  if (_challengeRestTimer) { clearInterval(_challengeRestTimer); _challengeRestTimer = null; }
}

function skipChallengeRest() {
  stopChallengeRest();
  $("#cday-rest").style.display = "none";
  const setBtn = $("#cday-set-btn");
  setBtn.disabled = false;
  setBtn.style.opacity = "1";
}

async function completeChallengeDay() {
  if (!_currentChallengeDay) return;
  const result = await completeChallengDay(_currentChallengeDay);

  $("#challenge-complete-btn").style.display = "none";
  $("#challenge-done-label").style.display = "block";

  if (result) showXPModal(result, _currentChallengeDay);
  else {
    setTimeout(() => { renderChallengeMap(); goTo("challenge"); }, 1200);
  }
}

function showXPModal(result, dayNumber) {
  const isBoss = BOSS_DAYS.has(dayNumber);
  const modal  = $("#xp-modal");
  const level   = result.newLevel;

  $("#xp-modal-emoji").textContent = isBoss ? "👑" : result.leveledUp ? "🎉" : "⭐";
  $("#xp-modal-title").textContent = `+${result.earnedXP} XP!`;

  let sub = `סה"כ: ${result.newXP} XP · רמה ${level} — ${getLevelName(level)}`;
  if (result.streakBonus) sub += `\n🔥 בונוס streak: +${result.streakBonus} XP`;
  if (result.leveledUp) sub += `\n⬆ עלית לרמה ${level}!`;
  if (isBoss) sub = `👑 Boss Fight הושלם!\n` + sub;
  $("#xp-modal-sub").textContent = sub;

  modal.style.display = "flex";
}

function closeXPModal() {
  $("#xp-modal").style.display = "none";
  renderChallengeMap();
  renderChallengeXP();
  goTo("challenge");
}

function renderChallengeXP() {
  const profile = getUserProfile();
  if (!profile) return;
  const xp    = profile.xp    || 0;
  const level = profile.level || 1;
  const xpCur = getXPForLevel(level);
  const xpNxt = getXPForNextLevel(level);
  const pct   = xpNxt === Infinity ? 100 : Math.round((xp - xpCur) / (xpNxt - xpCur) * 100);

  const badge = $("#challenge-level-badge");
  const fill  = $("#challenge-xp-fill");
  const label = $("#challenge-xp-label");
  if (badge) badge.textContent = `רמה ${level} — ${getLevelName(level)}`;
  if (fill)  fill.style.width = pct + "%";
  if (label) label.textContent = `${xp} XP`;
}

async function openLeaderboard() {
  goTo("leaderboard");
  const list = $("#leaderboard-list");
  list.innerHTML = `<div class="history-loading">טוען...</div>`;
  const data = await loadLeaderboard();
  const myId = currentUser?.id;

  list.innerHTML = "";
  data.forEach((row, i) => {
    const medals = ["🥇","🥈","🥉"];
    const el = document.createElement("div");
    el.className = "leaderboard-row" + (row.user_id === myId ? " me" : "");
    el.innerHTML = `
      <span class="lb-rank">${medals[i] || `#${i+1}`}</span>
      <div class="lb-info">
        <div class="lb-name">${row.display_name}</div>
        <div class="lb-meta">רמה ${row.level} · ${row.days_completed} ימים · 🔥${row.streak}</div>
      </div>
      <span class="lb-xp">${row.xp} XP</span>
    `;
    list.appendChild(el);
  });
}

// ── ADMIN SCREEN ──────────────────────────────────
async function openAdmin() {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return;
  goTo("admin");
  const body = $("#admin-body");
  body.innerHTML = `<div class="history-loading">טוען נתונים...</div>`;

  const { data, error } = await db.rpc("get_admin_stats");
  if (error || !data) {
    body.innerHTML = `<div class="history-empty">שגיאה בטעינת נתונים</div>`;
    return;
  }

  const activityBars = buildAdminChart(data.daily_activity || []);

  const levelNames = ["","מתחיל","לוחם","גיבור","אלוף","אגדה"];
  const goalNames  = { mass:"מסה", tone:"חיטוב", both:"שניהם" };
  const levelMap   = { beginner:"מתחיל", intermediate:"בינוני", advanced:"מתקדם" };
  const genderMap  = { male:"זכר", female:"נקבה", other:"אחר" };

  const usersHTML = (data.users_detail || []).map(u => {
    const joined    = u.joined_at    ? new Date(u.joined_at).toLocaleDateString("he-IL")    : "—";
    const lastLogin = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("he-IL") : "—";
    const lastWorkout = u.last_workout  ? new Date(u.last_workout).toLocaleDateString("he-IL")    : "—";
    const onboarded = u.onboarding_completed ? "✅" : "❌";

    return `
      <div class="admin-user-card">
        <div class="admin-user-header">
          <div class="admin-user-name">${u.display_name}</div>
          <div class="admin-user-email">${u.email}</div>
        </div>
        <div class="admin-user-grid">
          <div class="admin-user-stat"><span>הצטרף</span><strong>${joined}</strong></div>
          <div class="admin-user-stat"><span>כניסה אחרונה</span><strong>${lastLogin}</strong></div>
          <div class="admin-user-stat"><span>שאלון</span><strong>${onboarded}</strong></div>
          <div class="admin-user-stat"><span>רמת כושר</span><strong>${levelMap[u.fitness_level] || "—"}</strong></div>
          <div class="admin-user-stat"><span>מטרה</span><strong>${goalNames[u.goal] || "—"}</strong></div>
          <div class="admin-user-stat"><span>גיל</span><strong>${u.age_range || "—"}</strong></div>
          <div class="admin-user-stat"><span>מגדר</span><strong>${genderMap[u.gender] || "—"}</strong></div>
          <div class="admin-user-stat"><span>XP</span><strong>${u.xp ?? 0}</strong></div>
          <div class="admin-user-stat"><span>רמה</span><strong>${levelNames[u.level ?? 1] || "מתחיל"}</strong></div>
          <div class="admin-user-stat"><span>Streak</span><strong>🔥${u.streak ?? 0}</strong></div>
          <div class="admin-user-stat"><span>ימי אתגר</span><strong>${u.challenge_days ?? 0} / 50</strong></div>
          <div class="admin-user-stat"><span>אימון אחרון</span><strong>${lastWorkout}</strong></div>
        </div>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    <div class="admin-stats-grid">
      <div class="admin-stat-card">
        <div class="admin-stat-num">${data.total_users}</div>
        <div class="admin-stat-label">משתמשים</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-num">${data.total_workouts}</div>
        <div class="admin-stat-label">אימונים סה"כ</div>
      </div>
      <div class="admin-stat-card accent">
        <div class="admin-stat-num">${data.workouts_this_week}</div>
        <div class="admin-stat-label">השבוע</div>
      </div>
    </div>

    <div class="admin-section">
      <div class="admin-section-title">פעילות 14 ימים אחרונים</div>
      ${activityBars}
    </div>

    <div class="admin-section">
      <div class="admin-section-title">משתמשים (${data.total_users})</div>
      ${usersHTML || '<div class="history-empty">אין נתונים</div>'}
    </div>
  `;
}

function buildAdminChart(dailyData) {
  if (!dailyData.length) return '<div class="history-empty">אין נתונים</div>';
  const sorted = [...dailyData].sort((a, b) => a.date.localeCompare(b.date));
  const max = Math.max(...sorted.map(d => d.count), 1);
  const BAR_W = 16, GAP = 6, H = 60, LABEL_H = 18;
  const totalW = sorted.length * (BAR_W + GAP) - GAP;

  const bars = sorted.map((d, i) => {
    const barH = Math.max(Math.round((d.count / max) * H), 4);
    const x = i * (BAR_W + GAP);
    const y = H - barH;
    const day = d.date.slice(5); // MM-DD
    return `
      <rect x="${x}" y="${y}" width="${BAR_W}" height="${barH}" rx="3" fill="var(--accent)" opacity="0.8"/>
      <text x="${x + BAR_W/2}" y="${H + LABEL_H - 4}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${day}</text>
      ${d.count > 0 ? `<text x="${x + BAR_W/2}" y="${y - 3}" text-anchor="middle" font-size="9" fill="var(--accent)" font-weight="600">${d.count}</text>` : ""}
    `;
  }).join("");

  return `<div class="admin-chart">
    <svg viewBox="0 0 ${totalW} ${H + LABEL_H}" style="width:100%;overflow:visible">${bars}</svg>
  </div>`;
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

  renderActivityChart(entries);

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
    const startStr = entry.started_at ? formatTime(new Date(entry.started_at)) : null;
    const endStr   = formatTime(date);
    const timeRange = startStr ? `${startStr} – ${endStr}` : endStr;

    const wIdx = WORKOUTS.indexOf(workout);
    const wLetter = ["A","B","C"][wIdx] || "?";
    const wColor  = ["push","pull","legs"][wIdx] || "push";
    card.innerHTML = `
      <div class="workout-card-letter ${wColor} sm">${wLetter}</div>
      <div class="history-card-info">
        <div class="history-card-name">${workout.name}</div>
        <div class="history-card-meta">${formatDate(date)} · ${entry.exercises?.length || 0} תרגילים${entry.duration_minutes ? ` · ${entry.duration_minutes} דק׳` : ""}</div>
        <div class="history-card-time">🕐 ${timeRange}</div>
      </div>
    `;
    list.appendChild(card);
  });
}

function renderActivityChart(entries) {
  const wrap = $("#history-chart-wrap");
  const container = $("#history-chart");
  if (!wrap || !container) return;

  // Build 8-week buckets (index 0 = oldest, 7 = current)
  const NUM_WEEKS = 8;
  const now = new Date();
  const buckets = Array.from({ length: NUM_WEEKS }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (NUM_WEEKS - 1 - i) * 7);
    return { label: getShortWeekLabel(d, i === NUM_WEEKS - 1), count: 0 };
  });

  entries.forEach(e => {
    const d = new Date(e.completed_at);
    const weeksAgo = Math.floor((now - d) / (7 * 24 * 60 * 60 * 1000));
    const idx = NUM_WEEKS - 1 - weeksAgo;
    if (idx >= 0 && idx < NUM_WEEKS) buckets[idx].count++;
  });

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const BAR_W = 28, GAP = 10, H = 90, LABEL_H = 20;
  const totalW = NUM_WEEKS * (BAR_W + GAP) - GAP;

  const bars = buckets.map((b, i) => {
    const barH = b.count > 0 ? Math.max(Math.round((b.count / maxCount) * H), 8) : 4;
    const x = i * (BAR_W + GAP);
    const y = H - barH;
    const isCurrentWeek = i === NUM_WEEKS - 1;
    const fill = isCurrentWeek ? "var(--accent)" : "var(--surface2)";
    const textFill = isCurrentWeek ? "var(--accent)" : "var(--text-muted)";
    const countLabel = b.count > 0
      ? `<text x="${x + BAR_W / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="${textFill}" font-weight="600">${b.count}</text>`
      : "";
    return `
      <rect x="${x}" y="${y}" width="${BAR_W}" height="${barH}" rx="5" fill="${fill}" />
      ${countLabel}
      <text x="${x + BAR_W / 2}" y="${H + LABEL_H - 4}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${b.label}</text>
    `;
  }).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${totalW} ${H + LABEL_H}" xmlns="http://www.w3.org/2000/svg"
         style="width:100%;max-width:${totalW * 1.2}px;overflow:visible">
      ${bars}
    </svg>
  `;
  wrap.style.display = "block";
}

function getShortWeekLabel(date, isCurrent) {
  if (isCurrent) return "השבוע";
  const months = ["ינו","פבר","מרץ","אפר","מאי","יוני","יולי","אוג","ספט","אוק","נוב","דצמ"];
  return `${date.getDate()}/${months[date.getMonth()]}`;
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
  stopWorkoutTimer();
  await renderHome();
  goTo("home");
}

function backToWorkout() {
  stopRestTimer();
  goTo("workout");
}

// ── INIT ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("done-set-btn")?.addEventListener("click", doneSet);
  document.getElementById("skip-rest-btn")?.addEventListener("click", skipRest);

  // Check session immediately on load — no waiting for event
  const { data: { session: initSession } } = await db.auth.getSession();
  if (initSession?.user) {
    currentUser = initSession.user;
    setCurrentUser(currentUser.id);
    renderUserInfo(currentUser);
    await afterLogin();
  } else {
    goTo("login");
  }

  // Listen for future auth changes (sign in / sign out)
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === "INITIAL_SESSION") return; // already handled above
    if (session?.user) {
      currentUser = session.user;
      setCurrentUser(currentUser.id);
      renderUserInfo(currentUser);
      await afterLogin();
    } else {
      currentUser = null;
      setCurrentUser(null);
      goTo("login");
    }
  });
});
