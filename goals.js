// ── goals.js ─────────────────────────────────────────────────
// Goals · To-Dos · Milestones · Habits · Pomodoro · Daily Practice
import { state, initAuth, save, uid, today } from "./firebase.js";

// ── Constants ─────────────────────────────────────────────────
const POMO_KEY = "gate_pomo_sessions";

const DEFAULT_MILESTONES = [
  { id:"ms1", title:"Complete 1st subject fully",  desc:"Finish all topics + revision for one subject",           emoji:"📗", dueDate:"2026-04-01", done:false },
  { id:"ms2", title:"Attempt first full mock test", desc:"Take a 3-hour GATE mock, score doesn't matter",          emoji:"📝", dueDate:"2026-06-01", done:false },
  { id:"ms3", title:"Finish all theory topics",     desc:"Cover all 11 subjects at least once",                    emoji:"📚", dueDate:"2026-10-01", done:false },
  { id:"ms4", title:"PYQ revision complete",        desc:"Solve 10 years of GATE CS PYQs",                        emoji:"🔁", dueDate:"2026-12-01", done:false },
  { id:"ms5", title:"Mock score ≥ 600 marks",       desc:"Hit 600+ in at least 2 consecutive mocks",              emoji:"🏆", dueDate:"2027-01-15", done:false },
  { id:"ms6", title:"GATE 2027 Exam Day",           desc:"Give your best!",                                       emoji:"🎯", dueDate:"2027-02-07", done:false },
];

const DEFAULT_HABITS = [
  { id:"h1", name:"Solve 5 PYQs",         emoji:"📝", freq:"daily"    },
  { id:"h2", name:"30-min revision",       emoji:"🔁", freq:"daily"    },
  { id:"h3", name:"Study ≥ 6 hours",       emoji:"⏱",  freq:"daily"    },
  { id:"h4", name:"No social media AM",    emoji:"📵", freq:"weekdays" },
];

// ── UI state ─────────────────────────────────────────────────
let currentTab       = "goals";
let goalFilter       = "all";
let editingGoalId    = null;
let editingTodoId    = null;
let editingTrackerId = null;
let selectedColor    = "#6ee7b7";

// Pomodoro
let pomoMode        = "work";
let pomoRunning     = false;
let pomoTimer       = null;
let pomoSecondsLeft = 25 * 60;
let pomoSessionNum  = 1;
let pomoSettings    = { work:25, short:5, long:15, cycle:4 };
let pomoSessions    = [];

// ── Boot ─────────────────────────────────────────────────────
initAuth(onStateReady);

function onStateReady(s) {
  // Load pomo from localStorage (not Firebase — device-local)
  try { pomoSessions = JSON.parse(localStorage.getItem(POMO_KEY) || "[]"); } catch {}

  // Seed defaults on first load
  if (!state.milestones.length)  { state.milestones = DEFAULT_MILESTONES; save(); }
  if (!state.habitDefs.length) {
    state.habitDefs = DEFAULT_HABITS;
    DEFAULT_HABITS.forEach(h => { if (!state.habits[h.id]) state.habits[h.id] = {}; });
    save();
  }

  populateSelects();
  renderAll();
}

// ── Helpers ──────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }

function populateSelects() {
  const subjects = window.SUBJECTS || [];
  ["gSubject","tSubject","quickTodoSubject","todoFilterSubject"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const placeholder = (id === "todoFilterSubject" || id === "quickTodoSubject") ? "No subject" : "General";
    el.innerHTML = `<option value="">${placeholder}</option>`;
    subjects.forEach(s => { const o = document.createElement("option"); o.value = o.textContent = s; el.appendChild(o); });
  });
}

// ── Tab ───────────────────────────────────────────────────────
function switchTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("panel-" + tab).classList.add("active");
  btn.classList.add("active");
  renderAll();
}

function handleAddBtn() {
  const actions = { goals:openGoalModal, todos:openTodoModal, milestones:openMsModal, habits:openHabitModal, pomodoro:togglePomodoro };
  actions[currentTab]?.();
}

function renderAll() {
  renderGoals();
  renderTodos();
  renderMilestones();
  renderHabits();
  renderPomodoro();
  renderPractice();
  updateBadges();
}

function updateBadges() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("badge-goals",      state.richGoals.filter(g => !g.done).length);
  set("badge-todos",      state.todos.filter(t => !t.done).length);
  set("badge-milestones", state.milestones.length);
  set("badge-habits",     state.habitDefs.length);
  set("badge-practice",   state.trackerDefs.length);
}

// ══════════════════════════════════════════
// GOALS
// ══════════════════════════════════════════
function setGoalFilter(f, btn) {
  goalFilter = f;
  document.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderGoals();
}

function openGoalModal(id) {
  editingGoalId = id || null;
  document.getElementById("goalModalTitle").textContent = id ? "Edit Goal" : "Add Goal";
  const g = id ? state.richGoals.find(x => x.id === id) : null;
  document.getElementById("gTitle").value    = g?.title    ?? "";
  document.getElementById("gDesc").value     = g?.desc     ?? "";
  document.getElementById("gSubject").value  = g?.subject  ?? "";
  document.getElementById("gPriority").value = g?.priority ?? "mid";
  document.getElementById("gDate").value     = g?.dueDate  ?? "";
  document.getElementById("gProgress").value = g?.progress ?? 0;
  openModal("goalModal");
}

async function saveGoal() {
  const title = document.getElementById("gTitle").value.trim();
  if (!title) { toast("Please enter a goal title"); return; }
  const data = {
    title, desc: document.getElementById("gDesc").value.trim(),
    subject:  document.getElementById("gSubject").value,
    priority: document.getElementById("gPriority").value,
    dueDate:  document.getElementById("gDate").value,
    progress: parseInt(document.getElementById("gProgress").value) || 0,
  };
  if (editingGoalId) {
    const idx = state.richGoals.findIndex(g => g.id === editingGoalId);
    if (idx !== -1) state.richGoals[idx] = { ...state.richGoals[idx], ...data };
    toast("Goal updated ✓");
  } else {
    state.richGoals.push({ id:uid(), done:false, createdAt:today(), ...data });
    toast("Goal added ✓");
  }
  await save(); closeModal("goalModal"); renderGoals(); updateBadges();
}

async function toggleGoalDone(id) {
  const g = state.richGoals.find(x => x.id === id);
  if (g) { g.done = !g.done; if (g.done) g.progress = 100; await save(); renderGoals(); updateBadges(); }
}

async function deleteGoal(id) {
  if (!confirm("Delete this goal?")) return;
  state.richGoals = state.richGoals.filter(g => g.id !== id);
  await save(); renderGoals(); updateBadges(); toast("Goal deleted");
}

function renderGoals() {
  const search = (document.getElementById("goalSearch")?.value || "").toLowerCase();
  let goals = [...state.richGoals];
  if (search)              goals = goals.filter(g => (g.title + (g.desc||"")).toLowerCase().includes(search));
  if (goalFilter==="active")  goals = goals.filter(g => !g.done);
  if (goalFilter==="done")    goals = goals.filter(g => g.done);
  if (goalFilter==="overdue") goals = goals.filter(g => g.dueDate && g.dueDate < today() && !g.done);
  goals.sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return ({high:0,mid:1,low:2}[a.priority]||1) - ({high:0,mid:1,low:2}[b.priority]||1);
  });

  const total   = state.richGoals.length;
  const done    = state.richGoals.filter(g => g.done).length;
  const overdue = state.richGoals.filter(g => g.dueDate && g.dueDate < today() && !g.done).length;
  const avgProg = total ? Math.round(state.richGoals.reduce((s,g) => s+(g.progress||0),0)/total) : 0;

  document.getElementById("goalStats").innerHTML = statPills([
    ["Total goals", total], ["Completed", `${done} <span>/ ${total}</span>`],
    [`Overdue${overdue ? ` style="color:var(--danger)"` : ""}`, overdue],
    ["Avg progress", `${avgProg}<span>%</span>`],
  ]);

  const el = document.getElementById("goalsList");
  if (!goals.length) { el.innerHTML = emptyState("🎯","No goals here","Add your first goal to get started!"); return; }

  const prioColor = { high:"var(--danger)", mid:"var(--warn)", low:"var(--accent)" };
  const prioLabel = { high:"High", mid:"Medium", low:"Low" };
  const prioTag   = { high:"tag-priority-high", mid:"tag-priority-mid", low:"tag-priority-low" };

  el.innerHTML = goals.map(g => {
    const od  = g.dueDate && g.dueDate < today() && !g.done;
    const pct = g.progress || 0;
    return `<div class="goal-card ${g.done ? "done" : ""}">
      <div class="goal-card-left">
        <div class="goal-check ${g.done?"done":""}" onclick="toggleGoalDone('${g.id}')"></div>
        <div class="goal-info">
          <div class="goal-title-text ${g.done?"done":""}">${g.title}</div>
          ${g.desc ? `<div style="font-size:12px;color:var(--text2);margin-bottom:4px">${g.desc}</div>` : ""}
          <div class="goal-meta">
            <span class="tag ${prioTag[g.priority||"mid"]}">${prioLabel[g.priority||"mid"]}</span>
            ${g.subject ? `<span class="tag tag-subject">${g.subject.split(" ").slice(0,2).join(" ")}</span>` : ""}
            ${g.dueDate ? `<span ${od?'style="color:var(--danger)"':""}>📅 ${g.dueDate}${od?" (overdue)":""}</span>` : ""}
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width:${pct}%;background:${prioColor[g.priority||"mid"]}"></div>
          </div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px">${pct}% complete</div>
        </div>
      </div>
      <div class="goal-actions">
        <button class="icon-btn" onclick="openGoalModal('${g.id}')">${editIcon()}</button>
        <button class="icon-btn danger" onclick="deleteGoal('${g.id}')">${deleteIcon()}</button>
      </div>
    </div>`;
  }).join("");
}

// ══════════════════════════════════════════
// TODOS
// ══════════════════════════════════════════
function openTodoModal(id) {
  editingTodoId = id || null;
  document.getElementById("todoModalTitle").textContent = id ? "Edit To-Do" : "Add To-Do";
  const t = id ? state.todos.find(x => x.id === id) : null;
  document.getElementById("tText").value     = t?.text     ?? "";
  document.getElementById("tSubject").value  = t?.subject  ?? "";
  document.getElementById("tPriority").value = t?.priority ?? "mid";
  document.getElementById("tDue").value      = t?.due      ?? "";
  document.getElementById("tNote").value     = t?.note     ?? "";
  openModal("todoModal");
}

async function saveTodo() {
  const text = document.getElementById("tText").value.trim();
  if (!text) { toast("Please enter a task"); return; }
  const data = {
    text, subject: document.getElementById("tSubject").value,
    priority: document.getElementById("tPriority").value,
    due: document.getElementById("tDue").value,
    note: document.getElementById("tNote").value.trim(),
  };
  if (editingTodoId) {
    const idx = state.todos.findIndex(t => t.id === editingTodoId);
    if (idx !== -1) state.todos[idx] = { ...state.todos[idx], ...data };
    toast("To-do updated ✓");
  } else {
    state.todos.push({ id:uid(), done:false, createdAt:today(), ...data });
    toast("To-do added ✓");
  }
  await save(); closeModal("todoModal"); renderTodos(); updateBadges();
}

async function quickAddTodo() {
  const text = document.getElementById("quickTodoInput").value.trim();
  if (!text) return;
  state.todos.push({
    id:uid(), done:false, createdAt:today(), text,
    priority: document.getElementById("quickTodoPriority").value,
    subject:  document.getElementById("quickTodoSubject").value,
    due:"", note:"",
  });
  document.getElementById("quickTodoInput").value = "";
  await save(); renderTodos(); updateBadges(); toast("Added ✓");
}

async function toggleTodoDone(id) {
  const t = state.todos.find(x => x.id === id);
  if (t) { t.done = !t.done; await save(); renderTodos(); updateBadges(); }
}

async function deleteTodo(id) {
  state.todos = state.todos.filter(t => t.id !== id);
  await save(); renderTodos(); updateBadges(); toast("Deleted");
}

function renderTodos() {
  const search = (document.getElementById("todoSearch")?.value || "").toLowerCase();
  const fp     = document.getElementById("todoFilterPriority")?.value || "";
  const fs     = document.getElementById("todoFilterSubject")?.value  || "";
  let todos    = [...state.todos];
  if (search) todos = todos.filter(t => (t.text+(t.note||"")).toLowerCase().includes(search));
  if (fp) todos = todos.filter(t => t.priority === fp);
  if (fs) todos = todos.filter(t => t.subject === fs);

  const total   = state.todos.length;
  const done    = state.todos.filter(t => t.done).length;
  const due     = state.todos.filter(t => t.due === today()).length;
  const overdue = state.todos.filter(t => t.due && t.due < today() && !t.done).length;

  document.getElementById("todoStats").innerHTML = statPills([
    ["Total tasks", total], ["Done", `${done} <span>/ ${total}</span>`],
    ["Due today", due],
    [`Overdue${overdue ? ` style="color:var(--danger)"` : ""}`, overdue],
  ]);

  const poOrder = { high:0, mid:1, low:2 };
  const pending  = todos.filter(t=>!t.done).sort((a,b) => (poOrder[a.priority]||1)-(poOrder[b.priority]||1));
  const doneList = todos.filter(t=> t.done).reverse();

  const dotClass = { high:"dot-high", mid:"dot-mid", low:"dot-low" };
  const renderItem = t => {
    const od = t.due && t.due < today() && !t.done;
    return `<div class="todo-item ${t.done?"done":""}">
      <div class="todo-check ${t.done?"done":""}" onclick="toggleTodoDone('${t.id}')"></div>
      <div class="todo-priority-dot ${dotClass[t.priority||"mid"]}"></div>
      <div style="flex:1;min-width:0">
        <div class="todo-text ${t.done?"done":""}">${t.text}</div>
        ${(t.subject||t.due||t.note) ? `<div style="font-size:11px;color:var(--text2);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap">
          ${t.subject ? `<span>${t.subject.split(" ").slice(0,2).join(" ")}</span>` : ""}
          ${t.due ? `<span ${od?'style="color:var(--danger)"':""}>${od?"⚠️ ":""}${t.due}</span>` : ""}
          ${t.note ? `<span>${t.note.slice(0,40)}${t.note.length>40?"…":""}</span>` : ""}
        </div>` : ""}
      </div>
      <div class="todo-actions">
        <button class="icon-btn" onclick="openTodoModal('${t.id}')">${editIcon()}</button>
        <button class="icon-btn danger" onclick="deleteTodo('${t.id}')">${deleteIcon()}</button>
      </div>
    </div>`;
  };

  const container = document.getElementById("todoContainer");
  if (!todos.length) { container.innerHTML = emptyState("✅","All clear!","No tasks found."); return; }
  container.innerHTML = `
    ${pending.length  ? `<div><div class="todo-section-title">Pending <span class="todo-section-count">${pending.length}</span></div><div class="todo-list">${pending.map(renderItem).join("")}</div></div>` : ""}
    ${doneList.length ? `<div><div class="todo-section-title">Completed <span class="todo-section-count">${doneList.length}</span></div><div class="todo-list">${doneList.map(renderItem).join("")}</div></div>` : ""}`;
}

// ══════════════════════════════════════════
// MILESTONES
// ══════════════════════════════════════════
function openMsModal() { openModal("msModal"); }

async function saveMilestone() {
  const title   = document.getElementById("msTitle").value.trim();
  const dueDate = document.getElementById("msDate").value;
  if (!title || !dueDate) { toast("Title and date are required"); return; }
  state.milestones.push({
    id:uid(), done:false, title, dueDate,
    desc:  document.getElementById("msDesc").value.trim(),
    emoji: document.getElementById("msEmoji").value.trim() || "🏁",
  });
  await save(); closeModal("msModal"); renderMilestones(); updateBadges(); toast("Milestone added ✓");
}

async function toggleMsDone(id) {
  const ms = state.milestones.find(x => x.id === id);
  if (ms) { ms.done = !ms.done; await save(); renderMilestones(); }
}

async function deleteMilestone(id) {
  state.milestones = state.milestones.filter(m => m.id !== id);
  await save(); renderMilestones(); updateBadges(); toast("Milestone removed");
}

function renderMilestones() {
  const milestones = [...state.milestones].sort((a,b) => (a.dueDate||"z") < (b.dueDate||"z") ? -1 : 1);
  const done       = milestones.filter(m => m.done).length;
  const next       = milestones.filter(m => !m.done && m.dueDate >= today()).sort((a,b) => a.dueDate < b.dueDate ? -1:1)[0];

  document.getElementById("msStats").innerHTML = statPills([
    ["Total milestones", milestones.length],
    ["Achieved", `${done} <span>/ ${milestones.length}</span>`],
    ["Next milestone", `<span style="font-size:14px">${next ? next.dueDate : "—"}</span>`],
  ]);

  const el = document.getElementById("milestoneList");
  if (!milestones.length) { el.innerHTML = emptyState("🏁","No milestones yet","Add key checkpoints in your journey!"); return; }

  const nowStr     = today();
  const firstActive = milestones.find(m => !m.done)?.id;
  el.innerHTML = milestones.map(m => {
    const active  = !m.done && m.id === firstActive;
    const overdue = !m.done && m.dueDate < nowStr;
    return `<div class="milestone-item ${m.done?"done":""} ${active?"active-ms":""}">
      <div class="milestone-dot"><span class="ms-emoji">${m.emoji||"🏁"}</span></div>
      <div class="milestone-body">
        <div class="milestone-title">${m.title}</div>
        ${m.desc ? `<div class="milestone-desc">${m.desc}</div>` : ""}
        <div class="milestone-footer">
          <span class="milestone-date" ${overdue?'style="color:var(--danger)"':""}>📅 ${m.dueDate}${overdue?" · overdue":""}</span>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="milestone-check-btn" onclick="toggleMsDone('${m.id}')">${m.done?"✓ Done":"Mark done"}</button>
            <button class="icon-btn danger" onclick="deleteMilestone('${m.id}')">${deleteIcon()}</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join("");
}

// ══════════════════════════════════════════
// HABITS
// ══════════════════════════════════════════
function openHabitModal() { openModal("habitModal"); }

async function saveHabit() {
  const name = document.getElementById("hName").value.trim();
  if (!name) { toast("Enter habit name"); return; }
  const h = { id:uid(), name, emoji: document.getElementById("hEmoji").value.trim()||"✅", freq: document.getElementById("hFreq").value };
  state.habitDefs.push(h);
  if (!state.habits[h.id]) state.habits[h.id] = {};
  await save(); closeModal("habitModal"); renderHabits(); updateBadges(); toast("Habit added ✓");
}

async function toggleHabitDay(hid, dateStr) {
  if (!state.habits[hid]) state.habits[hid] = {};
  state.habits[hid][dateStr] = !state.habits[hid][dateStr];
  await save(); renderHabits();
}

async function deleteHabit(hid) {
  state.habitDefs = state.habitDefs.filter(h => h.id !== hid);
  delete state.habits[hid];
  await save(); renderHabits(); updateBadges(); toast("Habit removed");
}

function habitStreak(hid) {
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const ds = d.toISOString().split("T")[0];
    if (state.habits[hid]?.[ds]) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}

function renderHabits() {
  const defs      = state.habitDefs;
  const todayDone = defs.filter(h => state.habits[h.id]?.[today()]).length;

  document.getElementById("habitStats").innerHTML = statPills([
    ["Total habits", defs.length],
    ["Done today", `${todayDone} <span>/ ${defs.length}</span>`],
    ["Completion rate", `${defs.length ? Math.round(todayDone/defs.length*100) : 0}<span>%</span>`],
  ]);

  const el = document.getElementById("habitsList");
  if (!defs.length) { el.innerHTML = emptyState("🔁","No habits yet","Build consistency with daily habits!"); return; }

  const now  = new Date(); now.setHours(0,0,0,0);
  const days = Array.from({length:7}, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6-i));
    return { date: d.toISOString().split("T")[0], label: ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()], isToday: i===6 };
  });

  el.innerHTML = defs.map(h => {
    const streak  = habitStreak(h.id);
    const dayDots = days.map(d => `
      <div class="habit-day">
        <div class="habit-day-label">${d.label}</div>
        <div class="habit-day-dot ${state.habits[h.id]?.[d.date]?"done":""}"
          onclick="toggleHabitDay('${h.id}','${d.date}')"></div>
      </div>`).join("");
    return `<div class="habit-card">
      <div class="habit-top">
        <div class="habit-left">
          <span class="habit-icon">${h.emoji}</span>
          <div><div class="habit-name">${h.name}</div><div class="habit-freq">${h.freq}</div></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="habit-streak-badge">🔥 ${streak} day streak</div>
          <button class="icon-btn danger" onclick="deleteHabit('${h.id}')">${deleteIcon()}</button>
        </div>
      </div>
      <div class="habit-week">${dayDots}</div>
    </div>`;
  }).join("");
}

// ══════════════════════════════════════════
// POMODORO
// ══════════════════════════════════════════
function setPomoMode(mode, btn) {
  if (pomoRunning) return;
  pomoMode = mode;
  document.querySelectorAll(".pomo-mode-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  resetPomodoro();
}

function updatePomoSettings() {
  pomoSettings.work  = parseInt(document.getElementById("pomoWorkMin").value)         || 25;
  pomoSettings.short = parseInt(document.getElementById("pomoShortMin").value)        || 5;
  pomoSettings.long  = parseInt(document.getElementById("pomoLongMin").value)         || 15;
  pomoSettings.cycle = parseInt(document.getElementById("pomoSessionsPerCycle").value)|| 4;
  if (!pomoRunning) resetPomodoro();
}

function getModeSeconds() {
  return ({ work: pomoSettings.work, short: pomoSettings.short, long: pomoSettings.long }[pomoMode] || 25) * 60;
}

function togglePomodoro() {
  if (pomoRunning) {
    clearInterval(pomoTimer);
    pomoRunning = false;
    document.getElementById("pomoBtnStart").textContent = "Resume";
  } else {
    pomoRunning = true;
    document.getElementById("pomoBtnStart").textContent = "Pause";
    pomoTimer = setInterval(() => {
      pomoSecondsLeft--;
      updatePomoDisplay();
      if (pomoSecondsLeft <= 0) {
        clearInterval(pomoTimer);
        pomoRunning = false;
        if (pomoMode === "work") {
          pomoSessions.push({ date:today(), time:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}), mins:pomoSettings.work });
          localStorage.setItem(POMO_KEY, JSON.stringify(pomoSessions));
          renderPomoHistory();
          pomoSessionNum = (pomoSessionNum % pomoSettings.cycle) + 1;
        }
        document.title = "✅ Time's up! – GATE Tracker";
        setTimeout(() => document.title = "Goals & Productivity – GATE Tracker", 3000);
        document.getElementById("pomoBtnStart").textContent = "Start";
        pomoSecondsLeft = getModeSeconds();
        updatePomoDisplay();
      }
    }, 1000);
  }
}

function resetPomodoro() {
  clearInterval(pomoTimer);
  pomoRunning     = false;
  pomoSecondsLeft = getModeSeconds();
  document.getElementById("pomoBtnStart").textContent = "Start";
  updatePomoDisplay();
}

function updatePomoDisplay() {
  const m    = Math.floor(pomoSecondsLeft / 60).toString().padStart(2,"0");
  const s    = (pomoSecondsLeft % 60).toString().padStart(2,"0");
  document.getElementById("pomoDisplay").textContent = `${m}:${s}`;
  document.title = `${m}:${s} – GATE Tracker`;

  const circ   = 2 * Math.PI * 80;
  const offset = circ * (pomoSecondsLeft / getModeSeconds());
  const ring   = document.getElementById("pomoRingCircle");
  if (ring) {
    ring.style.strokeDashoffset = circ - offset;
    ring.style.stroke = pomoMode==="work" ? "var(--accent)" : pomoMode==="short" ? "var(--accent2)" : "var(--accent3)";
  }

  document.getElementById("pomoSessionLabel").textContent = {work:"Focus session",short:"Short break",long:"Long break"}[pomoMode];
  document.getElementById("pomoCount").textContent = `Session ${pomoSessionNum} of ${pomoSettings.cycle}`;

  const dots = document.getElementById("pomoDots");
  if (dots) dots.innerHTML = Array.from({length:pomoSettings.cycle}, (_,i) =>
    `<div class="pomo-dot ${i < pomoSessionNum-1 ? "done":""}"></div>`).join("");
}

function renderPomoHistory() {
  const todaySess = pomoSessions.filter(s => s.date === today());
  const el        = document.getElementById("pomoHistory");
  if (!el) return;
  el.innerHTML = todaySess.length
    ? todaySess.map((s,i) => `<div class="pomo-history-item">
        <span class="pomo-history-subject">Focus session #${i+1}</span>
        <span class="pomo-history-meta">${s.time}</span>
        <span class="pomo-history-badge">${s.mins} min</span>
      </div>`).join("")
    : `<div style="color:var(--text2);font-size:13px;text-align:center;padding:20px">No sessions yet today</div>`;
}

function renderPomodoro() {
  const todaySess = pomoSessions.filter(s => s.date === today());
  const todayMins = todaySess.reduce((a,s) => a+(s.mins||0), 0);
  document.getElementById("pomoStats").innerHTML = statPills([
    ["Today's sessions", todaySess.length],
    ["Today's focus time", `${todayMins}<span>min</span>`],
    ["Total sessions", pomoSessions.length],
  ]);
  updatePomoDisplay();
  renderPomoHistory();
}

// ══════════════════════════════════════════
// DAILY PRACTICE TRACKER
// ══════════════════════════════════════════
function openTrackerModal(id) {
  editingTrackerId = id || null;
  document.getElementById("trackerModalTitle").textContent = id ? "Edit Tracker" : "Add Practice Tracker";
  const tr = id ? state.trackerDefs.find(t => t.id === id) : null;
  document.getElementById("trName").value  = tr?.name  ?? "";
  document.getElementById("trEmoji").value = tr?.emoji ?? "";
  document.getElementById("trGoal").value  = tr?.goal  ?? 5;
  document.getElementById("trUnit").value  = tr?.unit  ?? "questions";
  selectedColor = tr?.color ?? "#6ee7b7";
  document.querySelectorAll(".color-opt").forEach(el => el.classList.toggle("selected", el.dataset.color === selectedColor));
  openModal("trackerModal");
}

function selectColor(el) {
  selectedColor = el.dataset.color;
  document.querySelectorAll(".color-opt").forEach(e => e.classList.remove("selected"));
  el.classList.add("selected");
}

async function saveTracker() {
  const name = document.getElementById("trName").value.trim();
  if (!name) { toast("Enter a tracker name"); return; }
  const data = {
    name, emoji: document.getElementById("trEmoji").value.trim()||"📊",
    goal:  parseInt(document.getElementById("trGoal").value) || 5,
    unit:  document.getElementById("trUnit").value.trim() || "questions",
    color: selectedColor,
  };
  if (editingTrackerId) {
    const idx = state.trackerDefs.findIndex(t => t.id === editingTrackerId);
    if (idx !== -1) state.trackerDefs[idx] = { ...state.trackerDefs[idx], ...data };
    toast("Tracker updated ✓");
  } else {
    const t = { id:uid(), ...data };
    state.trackerDefs.push(t);
    if (!state.trackerLog[t.id]) state.trackerLog[t.id] = {};
    toast("Tracker added ✓");
  }
  await save(); closeModal("trackerModal"); renderPractice(); updateBadges();
}

async function deleteTracker(id) {
  if (!confirm("Delete this tracker?")) return;
  state.trackerDefs = state.trackerDefs.filter(t => t.id !== id);
  delete state.trackerLog[id];
  await save(); renderPractice(); updateBadges(); toast("Tracker deleted");
}

async function changeCount(id, delta) {
  const ds = today();
  if (!state.trackerLog[id]) state.trackerLog[id] = {};
  state.trackerLog[id][ds] = Math.max(0, (state.trackerLog[id][ds]||0) + delta);
  await save(); renderPractice();
}

function trackerWeek(id) {
  const now = new Date(); now.setHours(0,0,0,0);
  return Array.from({length:7}, (_,i) => {
    const d  = new Date(now); d.setDate(d.getDate() - (6-i));
    const ds = d.toISOString().split("T")[0];
    return { ds, label: ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()], count: state.trackerLog[id]?.[ds]||0, isToday:i===6 };
  });
}

function trackerStreak(id) {
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const ds = d.toISOString().split("T")[0];
    if ((state.trackerLog[id]?.[ds]||0) > 0) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}

const trackerTotal = id => Object.values(state.trackerLog[id]||{}).reduce((a,b)=>a+b, 0);
const trackerBest  = id => { const v = Object.values(state.trackerLog[id]||{}); return v.length ? Math.max(...v) : 0; };

function renderPractice() {
  const defs     = state.trackerDefs;
  const todayStr = today();
  const goalHit  = defs.filter(t => (state.trackerLog[t.id]?.[todayStr]||0) >= t.goal).length;
  const todayTotal = defs.reduce((s,t) => s+(state.trackerLog[t.id]?.[todayStr]||0), 0);

  document.getElementById("practiceStats").innerHTML = statPills([
    ["Trackers", defs.length],
    ["Today total", todayTotal],
    ["Goals hit today", `${goalHit} <span>/ ${defs.length}</span>`],
    ["All-time solved", defs.reduce((s,t) => s+trackerTotal(t.id), 0)],
  ]);

  const grid = document.getElementById("practiceGrid");
  if (!defs.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${emptyState("📊","No trackers yet","Add DSA, OOP, System Design or any custom tracker!")}</div>`; return; }

  grid.innerHTML = defs.map(tr => {
    const count   = state.trackerLog[tr.id]?.[todayStr] || 0;
    const pct     = Math.min(100, Math.round(count / tr.goal * 100));
    const streak  = trackerStreak(tr.id);
    const total   = trackerTotal(tr.id);
    const best    = trackerBest(tr.id);
    const week    = trackerWeek(tr.id);
    const weekMax = Math.max(...week.map(d=>d.count), tr.goal, 1);
    const hit     = count >= tr.goal;

    const bars = week.map(d => {
      const h = Math.max(2, Math.round((d.count/weekMax)*44));
      return `<div class="dpt-bar-col">
        <div class="dpt-bar-val">${d.count||""}</div>
        <div class="dpt-bar" style="height:${h}px;background:${d.isToday ? tr.color : tr.color+"55"}"></div>
        <div class="dpt-bar-day" style="${d.isToday?"color:"+tr.color+";font-weight:700":""}">${d.label}</div>
      </div>`;
    }).join("");

    return `<div class="dpt-card" style="--card-color:${tr.color}">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${tr.color};border-radius:var(--radius) var(--radius) 0 0;opacity:${hit?1:.4}"></div>
      <div class="dpt-card-actions">
        <button class="icon-btn" onclick="openTrackerModal('${tr.id}')">${editIcon()}</button>
        <button class="icon-btn danger" onclick="deleteTracker('${tr.id}')">${deleteIcon()}</button>
      </div>
      <div class="dpt-card-top">
        <div class="dpt-card-left">
          <span class="dpt-icon">${tr.emoji}</span>
          <div><div class="dpt-name">${tr.name}</div><div class="dpt-daily-goal">Goal: ${tr.goal} ${tr.unit}/day</div></div>
        </div>
        ${hit ? `<span style="font-size:18px">✅</span>` : ""}
      </div>
      <div class="dpt-counter-row">
        <button class="dpt-counter-btn minus" onclick="changeCount('${tr.id}',-1)">−</button>
        <div class="dpt-count-display">
          <div class="dpt-count-num" style="color:${hit?tr.color:"var(--text)"}">${count}</div>
          <div class="dpt-count-label">${tr.unit} today</div>
        </div>
        <button class="dpt-counter-btn" onclick="changeCount('${tr.id}',1)">+</button>
      </div>
      <div class="dpt-goal-progress">
        <div class="dpt-prog-track"><div class="dpt-prog-fill" style="width:${pct}%;background:${tr.color}"></div></div>
        <div class="dpt-prog-label"><span>${pct}% of daily goal</span><span>${count} / ${tr.goal}</span></div>
      </div>
      <div class="dpt-week-bars">${bars}</div>
      <div class="dpt-stats-row">
        <div class="dpt-stat"><div class="dpt-stat-val" style="color:${tr.color}">${streak}</div><div class="dpt-stat-label">🔥 streak</div></div>
        <div class="dpt-stat"><div class="dpt-stat-val">${total}</div><div class="dpt-stat-label">total</div></div>
        <div class="dpt-stat"><div class="dpt-stat-val">${best}</div><div class="dpt-stat-label">best day</div></div>
      </div>
    </div>`;
  }).join("");
}

// ── Shared render helpers ─────────────────────────────────────
function statPills(items) {
  return items.map(([label, val]) => `
    <div class="stat-pill">
      <div class="stat-pill-label">${label}</div>
      <div class="stat-pill-val">${val}</div>
    </div>`).join("");
}

function emptyState(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${title}</strong><br>${sub}</div>`;
}

function editIcon() {
  return `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}

function deleteIcon() {
  return `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`;
}

// ── Window exports ────────────────────────────────────────────
Object.assign(window, {
  switchTab, handleAddBtn,
  setGoalFilter, openGoalModal, saveGoal, toggleGoalDone, deleteGoal, renderGoals,
  openTodoModal, saveTodo, quickAddTodo, toggleTodoDone, deleteTodo, renderTodos,
  openMsModal, saveMilestone, toggleMsDone, deleteMilestone,
  openHabitModal, saveHabit, toggleHabitDay, deleteHabit,
  setPomoMode, updatePomoSettings, togglePomodoro, resetPomodoro,
  openTrackerModal, selectColor, saveTracker, deleteTracker, changeCount,
  closeModal,
});