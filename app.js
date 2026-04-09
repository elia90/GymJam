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

// ── HOME SCREEN ────────────────────────────────────
async function renderHome() {
  await loadTotalWorkouts();
  const total = getTotalWorkouts();
  $("#home-workouts-count").textContent = total > 0
    ? `${total} אימון${total === 1 ? "" : "ים"} הושלמו`
    : "בוא נתחיל!";

  renderDailyTip();

  const container = $("#workout-cards");
  container.innerHTML = "";

  WORKOUTS.forEach((w, i) => {
    const colorClass = ["push", "pull", "legs"][i];
    const letters = ["A", "B", "C"];
    const card = document.createElement("div");
    card.className = `workout-card ${colorClass}`;
    card.innerHTML = `
      <div class="workout-card-letter ${colorClass}">${letters[i]}</div>
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
    await renderHome();
    goTo("home");
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
      await renderHome();
      goTo("home");
    } else {
      currentUser = null;
      setCurrentUser(null);
      goTo("login");
    }
  });
});
