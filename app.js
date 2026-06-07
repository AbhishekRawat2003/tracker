import { state, initAuth, save, logout, uid, today } from "./firebase.js";

// ── Subjects data ────────────────────────────────────────────
export const SUBJECTS = [
  { id: "maths",    name: "Engineering Mathematics",      marks: "13-15", color: "#4ade80",
    topics: ["Linear Algebra","Calculus","Probability & Statistics","Discrete Mathematics","Graph Theory"] },
  { id: "digital",  name: "Digital Logic",                marks: "8-10",  color: "#60a5fa",
    topics: ["Boolean Algebra","Logic Gates","Combinational Circuits","Sequential Circuits","Number Systems"] },
  { id: "coa",      name: "Computer Organization & Arch", marks: "8-10",  color: "#fb923c",
    topics: ["Machine Instructions","ALU & Datapath","Pipelining","Memory Hierarchy","I/O Systems"] },
  { id: "dsa",      name: "Programming & Data Structures",marks: "12-15", color: "#4ade80",
    topics: ["C Programming","Arrays & Strings","Linked Lists","Stacks & Queues","Trees","Graphs","Hashing"] },
  { id: "algo",     name: "Algorithms",                   marks: "10-12", color: "#a78bfa",
    topics: ["Time & Space Complexity","Sorting Algorithms","Graph Algorithms","Dynamic Programming","Greedy","Divide & Conquer","NP Completeness"] },
  { id: "toc",      name: "Theory of Computation",        marks: "10-12", color: "#f87171",
    topics: ["Finite Automata","Regular Expressions","Context-Free Grammars","Pushdown Automata","Turing Machines","Decidability"] },
  { id: "compiler", name: "Compiler Design",              marks: "6-8",   color: "#fb923c",
    topics: ["Lexical Analysis","Parsing (LL/LR)","Syntax-Directed Translation","Intermediate Code","Code Optimization"] },
  { id: "os",       name: "Operating Systems",            marks: "10-12", color: "#60a5fa",
    topics: ["Process Management","CPU Scheduling","Synchronization","Deadlocks","Memory Management","File Systems"] },
  { id: "dbms",     name: "DBMS",                         marks: "10-12", color: "#4ade80",
    topics: ["Relational Model","SQL","Normalization","Transactions","Indexing","Relational Algebra"] },
  { id: "networks", name: "Computer Networks",            marks: "10-12", color: "#a78bfa",
    topics: ["OSI & TCP/IP","Data Link Layer","Network Layer","Transport Layer","Application Layer","Network Security"] },
  { id: "aptitude", name: "General Aptitude",             marks: "15",    color: "#fbbf24",
    topics: ["Verbal Ability","Numerical Ability","Logical Reasoning"] },
];

const SUBJECT_COLOR = Object.fromEntries(SUBJECTS.map(s => [s.name, s.color]));
const subjectColor  = name => SUBJECT_COLOR[name] ?? "#6ee7b7";

// ── UI state ─────────────────────────────────────────────────
let currentTab    = "dashboard";
let currentFilter = "all";
let currentPeriod = "week";
let selectedMood  = "🙂";
let editingLogId  = null;

// ── Boot ─────────────────────────────────────────────────────
initAuth(() => {
  renderAll();
  // Expose SUBJECTS for goals.html (loaded in same origin)
  window.SUBJECTS = SUBJECTS.map(s => s.name);
});

// ── Helpers ──────────────────────────────────────────────────
function isChecked(sid, tid) { return !!(state.checked[sid]?.[tid]); }

function subjectProgress(s) {
  const done = s.topics.filter((_, i) => isChecked(s.id, i)).length;
  return { done, total: s.topics.length, pct: Math.round(done / s.topics.length * 100) };
}

function totalStats() {
  let totalTopics = 0, doneTopic = 0, totalHrs = 0;
  SUBJECTS.forEach(s => { const p = subjectProgress(s); totalTopics += p.total; doneTopic += p.done; });
  state.logs.forEach(l => totalHrs += (l.hrs || 0));
  const subjectsDone = SUBJECTS.filter(s => subjectProgress(s).pct === 100).length;
  return { totalTopics, doneTopic, totalHrs, subjectsDone };
}

function calcStreak() {
  if (!state.logs.length) return 0;
  const dates = [...new Set(state.logs.map(l => l.date))].sort().reverse();
  let streak = 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  for (const dateStr of dates) {
    if (dateStr === d.toISOString().split("T")[0]) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function calcMaxStreak() {
  if (!state.logs.length) return 0;
  const dates = [...new Set(state.logs.map(l => l.date))].sort();
  let max = 0, cur = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) { cur = 1; }
    else {
      const prev = new Date(dates[i - 1]); prev.setDate(prev.getDate() + 1);
      cur = prev.toISOString().split("T")[0] === dates[i] ? cur + 1 : 1;
    }
    max = Math.max(max, cur);
  }
  return max;
}

function weeksHours() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      dateStr,
      label: ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()],
      hrs:   state.logs.filter(l => l.date === dateStr).reduce((s, l) => s + (l.hrs || 0), 0),
      isToday: i === 0,
    });
  }
  return days;
}

function daysUntilExam() {
  if (!state.examDate) return null;
  const diff = Math.ceil((new Date(state.examDate) - new Date().setHours(0,0,0,0)) / 86400000);
  return diff > 0 ? diff : 0;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

// ── Render all ───────────────────────────────────────────────
function renderAll() {
  updateGreeting();
  renderStats();
  renderDashboard();
  renderSubjects();
  renderLog();
  renderGoals();
  updateCountdown();
  populateSelects();
  syncSettings();
  if (currentTab === "analytics") renderAnalytics();
}

// ── Greeting ─────────────────────────────────────────────────
function updateGreeting() {
  const h      = new Date().getHours();
  const greet  = h < 12 ? "Good morning 👋" : h < 17 ? "Good afternoon 👋" : "Good evening 👋";
  const streak = calcStreak();
  document.getElementById("greetingText").textContent = greet;
  document.getElementById("greetingUser").textContent =
    streak > 1 ? `${streak} day streak! Keep going 🔥` : "Let's get some study done today";
  const name = (state.userId || "?")[0].toUpperCase();
  document.getElementById("userAvatar").textContent    = name;
  document.getElementById("topbarAvatar").textContent  = name;
  document.getElementById("userName").textContent      = state.userId || "User";
}

// ── Stats cards ──────────────────────────────────────────────
function renderStats() {
  const { doneTopic, totalTopics, totalHrs, subjectsDone } = totalStats();
  const streak   = calcStreak();
  const todayHrs = state.logs.filter(l => l.date === today()).reduce((s, l) => s + (l.hrs || 0), 0);
  document.getElementById("statsRow").innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">📚</div>
      <div class="stat-label">Topics done</div>
      <div class="stat-val">${doneTopic} <span>/ ${totalTopics}</span></div>
      <div class="stat-trend">${Math.round(doneTopic / totalTopics * 100)}% complete</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⏱</div>
      <div class="stat-label">Total hours</div>
      <div class="stat-val">${totalHrs.toFixed(1)} <span>hrs</span></div>
      <div class="stat-trend">Today: ${todayHrs.toFixed(1)} hrs</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🎯</div>
      <div class="stat-label">Subjects done</div>
      <div class="stat-val">${subjectsDone} <span>/ ${SUBJECTS.length}</span></div>
      <div class="stat-trend">${SUBJECTS.length - subjectsDone} remaining</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🔥</div>
      <div class="stat-label">Study streak</div>
      <div class="stat-val">${streak} <span>days</span></div>
      <div class="stat-trend">${streak > 0 ? "Keep it up!" : "Start today!"}</div>
    </div>`;
}

// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  const { doneTopic, totalTopics } = totalStats();
  const pct = totalTopics ? Math.round(doneTopic / totalTopics * 100) : 0;

  const ring = document.getElementById("bigRingCircle");
  if (ring) ring.style.strokeDashoffset = 314 - (pct / 100) * 314;
  const rp = document.getElementById("ringPct");
  if (rp) rp.textContent = pct + "%";

  // Subject mini-bars
  const sb = document.getElementById("subjectBars");
  if (sb) {
    sb.innerHTML = SUBJECTS.map(s => {
      const { pct: p } = subjectProgress(s);
      return `<div class="sb-row">
        <span class="sb-name">${s.name.split(" ").slice(0,2).join(" ")}</span>
        <div class="sb-track"><div class="sb-fill" style="width:${p}%;background:${s.color}"></div></div>
        <span class="sb-pct">${p}%</span>
      </div>`;
    }).join("");
  }

  // Recent activity
  const ra = document.getElementById("recentActivity");
  if (ra) {
    const recent = [...state.logs].reverse().slice(0, 5);
    ra.innerHTML = recent.length
      ? recent.map(l => `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <span class="activity-text">${l.subject}${l.note ? " · " + l.note : ""}</span>
          <span class="activity-meta">${l.hrs}h · ${l.date}</span>
        </div>`).join("")
      : `<div class="activity-empty">No sessions yet — add your first log!</div>`;
  }

  // Weekly bar chart
  const wc = document.getElementById("weekChart");
  if (wc) {
    const days   = weeksHours();
    const maxHrs = Math.max(...days.map(d => d.hrs), state.dailyTarget || 6, 1);
    wc.innerHTML = days.map(d => {
      const h = Math.round((d.hrs / maxHrs) * 64);
      return `<div class="wc-col">
        <div class="wc-val">${d.hrs > 0 ? d.hrs.toFixed(1) : ""}</div>
        <div class="wc-bar-wrap">
          <div class="wc-bar ${d.isToday ? "today" : ""}" style="height:${h}px"></div>
        </div>
        <div class="wc-label">${d.label}</div>
      </div>`;
    }).join("");
  }

  // Quick-log subject select (populate once)
  const ql = document.getElementById("qlSubject");
  if (ql && ql.options.length === 0) {
    SUBJECTS.forEach(s => { const o = document.createElement("option"); o.value = o.textContent = s.name; ql.appendChild(o); });
  }
}

// ── Subjects ─────────────────────────────────────────────────
function renderSubjects() {
  const grid = document.getElementById("subjectsGrid");
  if (!grid) return;

  const filters = {
    all:        () => true,
    pending:    s => subjectProgress(s).pct === 0,
    inprogress: s => { const p = subjectProgress(s).pct; return p > 0 && p < 100; },
    done:       s => subjectProgress(s).pct === 100,
  };
  const list = SUBJECTS.filter(filters[currentFilter] || (() => true));

  grid.innerHTML = list.map(s => {
    const { done, total, pct } = subjectProgress(s);
    const topicsHtml = s.topics.map((t, i) => {
      const chk = isChecked(s.id, i);
      return `<div class="topic-row ${chk ? "done" : ""}" onclick="toggleTopic('${s.id}',${i})">
        <div class="checkbox ${chk ? "checked" : ""}">${chk ? '<span class="checkmark">✓</span>' : ""}</div>
        <span>${t}</span>
      </div>`;
    }).join("");
    return `<div class="subject-card" id="sc-${s.id}">
      <div class="subject-card-header" onclick="toggleExpand('${s.id}')">
        <div class="subject-left">
          <div class="subject-dot" style="background:${s.color}"></div>
          <div class="subject-info">
            <div class="subject-name">${s.name}</div>
            <div class="subject-meta">${s.marks} marks · ${done}/${total} topics</div>
          </div>
        </div>
        <div class="subject-right">
          <span class="subject-pct" style="color:${s.color}">${pct}%</span>
          <span class="expand-icon" id="ei-${s.id}">⌄</span>
        </div>
      </div>
      <div class="subj-prog-bar"><div class="subj-prog-fill" style="width:${pct}%;background:${s.color}"></div></div>
      <div class="subject-topics" id="st-${s.id}">
        <div class="topics-grid">${topicsHtml}</div>
      </div>
    </div>`;
  }).join("");
}

// ── Study Log ────────────────────────────────────────────────
function renderLog() {
  const list = document.getElementById("logList");
  if (!list) return;

  const search  = (document.getElementById("logSearch")?.value || "").toLowerCase();
  const filterS = document.getElementById("logFilterSubject")?.value || "";
  const filterM = document.getElementById("logFilterMonth")?.value || "";

  let logs = [...state.logs].reverse();
  if (search)  logs = logs.filter(l => (l.subject + l.note).toLowerCase().includes(search));
  if (filterS) logs = logs.filter(l => l.subject === filterS);
  if (filterM) logs = logs.filter(l => l.date.startsWith(filterM));

  const totalH   = state.logs.reduce((s, l) => s + (l.hrs || 0), 0);
  const sessions = state.logs.length;
  const avgH     = sessions > 0 ? (totalH / sessions).toFixed(1) : 0;

  const lsr = document.getElementById("logStatsRow");
  if (lsr) lsr.innerHTML = `
    <div class="stat-card"><div class="stat-label">Total sessions</div><div class="stat-val">${sessions}</div></div>
    <div class="stat-card"><div class="stat-label">Total hours</div><div class="stat-val">${totalH.toFixed(1)} <span>hrs</span></div></div>
    <div class="stat-card"><div class="stat-label">Avg per session</div><div class="stat-val">${avgH} <span>hrs</span></div></div>`;

  if (!logs.length) {
    list.innerHTML = `<div class="log-empty">No sessions found. Add your first session!</div>`;
    return;
  }
  list.innerHTML = `<div class="log-list">${logs.map(l => `
    <div class="log-entry">
      <span class="log-mood">${l.mood || "🙂"}</span>
      <div class="log-body">
        <div class="log-title-row">
          <span class="log-subj-badge">${l.subject}</span>
          <span class="log-date-text">${l.date}</span>
        </div>
        ${l.note ? `<div class="log-note-text">${l.note}</div>` : ""}
      </div>
      <span class="log-hrs-badge">${l.hrs}h</span>
      <div class="log-actions">
        <button class="icon-btn" onclick="editLog('${l.id}')" title="Edit">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn" onclick="deleteLog('${l.id}')" title="Delete">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`).join("")}</div>`;
}

// ── Goals (legacy simple list on index.html) ─────────────────
function renderGoals() {
  const el = document.getElementById("goalsList");
  if (!el) return;
  if (!state.goals.length) {
    el.innerHTML = `<div class="log-empty">No goals yet. Add your first goal!</div>`;
    return;
  }
  const sorted = [...state.goals].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.dueDate || "z") < (b.dueDate || "z") ? -1 : 1;
  });
  el.innerHTML = `<div class="goals-list">${sorted.map(g => {
    const overdue = g.dueDate && g.dueDate < today() && !g.done;
    return `<div class="goal-card">
      <div class="goal-check ${g.done ? "done" : ""}" onclick="toggleGoal('${g.id}')"></div>
      <div class="goal-body">
        <div class="goal-title-text ${g.done ? "done" : ""}">${g.title}</div>
        <div class="goal-due ${overdue ? "goal-overdue" : ""}">
          ${g.subject ? g.subject + " · " : ""}${g.dueDate || "No due date"}${overdue ? " (overdue)" : ""}
        </div>
      </div>
      <div class="goal-actions">
        <button class="icon-btn" onclick="deleteGoal('${g.id}')">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join("")}</div>`;
}

// ── Countdown ────────────────────────────────────────────────
function updateCountdown() {
  const days = daysUntilExam();
  const el   = document.getElementById("countdownDays");
  if (el) el.textContent = days !== null ? days : "--";
}

// ── Populate selects ─────────────────────────────────────────
function populateSelects() {
  ["modalSubject","logFilterSubject","goalSubject"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = id === "logFilterSubject" ? '<option value="">All subjects</option>' : "";
    SUBJECTS.forEach(s => { const o = document.createElement("option"); o.value = o.textContent = s.name; el.appendChild(o); });
  });
}

// ── Settings sync ────────────────────────────────────────────
function syncSettings() {
  const set_ = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set_("settingUserId",      state.userId      || "");
  set_("settingExamDate",    state.examDate    || "");
  set_("settingDailyTarget", state.dailyTarget || 6);
}

// ── Tab navigation ────────────────────────────────────────────
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("page-" + tab)?.classList.add("active");
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");
  document.getElementById("sidebar").classList.remove("open");
  document.querySelector(".sidebar-overlay")?.classList.remove("show");
  if (tab === "analytics") renderAnalytics();
}

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  sb.classList.toggle("open");
  let ov = document.querySelector(".sidebar-overlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.className = "sidebar-overlay";
    ov.onclick = () => { sb.classList.remove("open"); ov.classList.remove("show"); };
    document.body.appendChild(ov);
  }
  ov.classList.toggle("show");
}

// ── Topic checkbox ────────────────────────────────────────────
async function toggleTopic(sid, tid) {
  if (!state.checked[sid]) state.checked[sid] = {};
  state.checked[sid][tid] = !state.checked[sid][tid];
  await save();
}

function toggleExpand(sid) {
  document.getElementById("st-" + sid)?.classList.toggle("open");
  document.getElementById("ei-" + sid)?.classList.toggle("open");
}

function filterSubjects(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderSubjects();
}

// ── Log CRUD ──────────────────────────────────────────────────
function openLogModal(logId) {
  editingLogId = logId || null;
  const modal  = document.getElementById("logModal");

  if (logId) {
    const l = state.logs.find(x => x.id === logId);
    if (!l) return;
    document.getElementById("modalDate").value    = l.date;
    document.getElementById("modalSubject").value = l.subject;
    document.getElementById("modalHrs").value     = l.hrs;
    document.getElementById("modalNote").value    = l.note || "";
    selectedMood = l.mood || "🙂";
    document.getElementById("logModalTitle").textContent = "Edit session";
    document.getElementById("logModalBtn").textContent   = "Save changes";
  } else {
    document.getElementById("modalDate").value    = today();
    document.getElementById("modalSubject").value = "";
    document.getElementById("modalHrs").value     = 2;
    document.getElementById("modalNote").value    = "";
    selectedMood = "🙂";
    document.getElementById("logModalTitle").textContent = "Add study session";
    document.getElementById("logModalBtn").textContent   = "Add session";
  }
  document.querySelectorAll(".mood-btn").forEach(b => b.classList.toggle("active", b.dataset.mood === selectedMood));
  modal.classList.add("open");
}

async function saveLogEntry() {
  const date    = document.getElementById("modalDate").value;
  const subject = document.getElementById("modalSubject").value;
  const hrs     = parseFloat(document.getElementById("modalHrs").value);
  const note    = document.getElementById("modalNote").value.trim();

  if (!date || !subject || isNaN(hrs) || hrs <= 0) { toast("Please fill all required fields"); return; }

  if (editingLogId) {
    const idx = state.logs.findIndex(l => l.id === editingLogId);
    if (idx !== -1) state.logs[idx] = { ...state.logs[idx], date, subject, hrs, note, mood: selectedMood };
    toast("Session updated ✓");
  } else {
    state.logs.push({ id: uid(), date, subject, hrs, note, mood: selectedMood });
    toast("Session added ✓");
  }
  closeModal("logModal");
  await save();
}

async function deleteLog(id) {
  if (!confirm("Delete this session?")) return;
  state.logs = state.logs.filter(l => l.id !== id);
  toast("Session deleted");
  await save();
}

const editLog = id => openLogModal(id);

async function quickLog() {
  const subject = document.getElementById("qlSubject")?.value;
  const hrs     = parseFloat(document.getElementById("qlHrs")?.value);
  const note    = document.getElementById("qlNote")?.value.trim() || "";
  if (!subject || isNaN(hrs) || hrs <= 0) { toast("Fill subject & hours"); return; }
  state.logs.push({ id: uid(), date: today(), subject, hrs, note, mood: "🙂" });
  document.getElementById("qlNote").value = "";
  document.getElementById("qlHrs").value  = 1;
  toast("Logged! 🔥");
  await save();
}

// ── Goals CRUD (simple, index.html) ─────────────────────────
function openGoalModal() {
  ["goalTitle","goalDate"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  document.getElementById("goalSubject").value = "";
  document.getElementById("goalModal").classList.add("open");
}

async function saveGoal() {
  const title   = document.getElementById("goalTitle").value.trim();
  const dueDate = document.getElementById("goalDate").value;
  const subject = document.getElementById("goalSubject").value;
  if (!title) { toast("Enter goal title"); return; }
  state.goals.push({ id: uid(), title, dueDate, subject, done: false });
  toast("Goal added ✓");
  closeModal("goalModal");
  await save();
}

async function toggleGoal(id) {
  const g = state.goals.find(x => x.id === id);
  if (g) { g.done = !g.done; await save(); }
}

async function deleteGoal(id) {
  if (!confirm("Delete this goal?")) return;
  state.goals = state.goals.filter(g => g.id !== id);
  toast("Goal deleted");
  await save();
}

// ── Mood picker ───────────────────────────────────────────────
function setMood(btn) {
  selectedMood = btn.dataset.mood;
  document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }

// ── Settings ─────────────────────────────────────────────────
async function saveSettings() {
  state.userId      = document.getElementById("settingUserId").value.trim()          || "User";
  state.examDate    = document.getElementById("settingExamDate").value;
  state.dailyTarget = parseFloat(document.getElementById("settingDailyTarget").value) || 6;
  await save();
  updateGreeting();
  updateCountdown();
  toast("Settings saved ✓");
}

function exportData() {
  const a = document.createElement("a");
  a.href     = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type:"application/json" }));
  a.download = "gate-tracker-backup.json";
  a.click();
  toast("Exported!");
}

async function confirmReset() {
  if (!confirm("Reset ALL data? This cannot be undone.")) return;
  state.checked = {}; state.logs = []; state.goals = [];
  await save();
  toast("Data reset");
}

// ═══════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════
function setPeriod(p, btn) {
  currentPeriod = p;
  document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderAnalytics();
}

function getFilteredLogs() {
  const now = new Date(); now.setHours(0,0,0,0);
  if (currentPeriod === "week") {
    const start = new Date(now); start.setDate(start.getDate() - 6);
    return state.logs.filter(l => new Date(l.date) >= start);
  }
  if (currentPeriod === "month") {
    const ym = now.toISOString().slice(0, 7);
    return state.logs.filter(l => l.date.startsWith(ym));
  }
  if (currentPeriod === "3month") {
    const start = new Date(now); start.setMonth(start.getMonth() - 3);
    return state.logs.filter(l => new Date(l.date) >= start);
  }
  return state.logs;
}

function getPrevPeriodLogs() {
  const now = new Date(); now.setHours(0,0,0,0);
  if (currentPeriod === "week") {
    const end = new Date(now); end.setDate(end.getDate() - 7);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    return state.logs.filter(l => { const d = new Date(l.date); return d >= start && d <= end; });
  }
  if (currentPeriod === "month") {
    const ym = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
    return state.logs.filter(l => l.date.startsWith(ym));
  }
  return [];
}

function renderAnalytics() {
  const logs    = getFilteredLogs();
  const content = document.getElementById("analyticsContent");
  if (!content) return;

  const totalHrs  = logs.reduce((s, l) => s + (l.hrs || 0), 0);
  const uniqueDays = [...new Set(logs.map(l => l.date))].length;
  const avgDaily  = uniqueDays ? totalHrs / uniqueDays : 0;
  const prevHrs   = getPrevPeriodLogs().reduce((s, l) => s + (l.hrs || 0), 0);
  const hrsDiff   = prevHrs ? (((totalHrs - prevHrs) / prevHrs) * 100).toFixed(0) : null;

  const subjectMap = {};
  logs.forEach(l => { subjectMap[l.subject] = (subjectMap[l.subject] || 0) + (l.hrs || 0); });
  const subjectArr = Object.entries(subjectMap).map(([name, hrs]) => ({ name, hrs })).sort((a,b) => b.hrs - a.hrs);
  const [most, least] = [subjectArr[0], subjectArr[subjectArr.length - 1]];

  const streak    = calcStreak();
  const maxStreak = calcMaxStreak();
  const periodLabel = { week:"This Week", month:"This Month", "3month":"Last 3 Months", all:"All Time" }[currentPeriod];

  content.innerHTML = `
    <div class="kpi-row">
      <div class="kpi-card" style="--kpi-color:#6ee7b7">
        <div class="kpi-icon">⏱</div>
        <div class="kpi-label">Total hours</div>
        <div class="kpi-val">${totalHrs.toFixed(1)} <span>hrs</span></div>
        <div class="kpi-trend ${hrsDiff > 0 ? "trend-up" : hrsDiff < 0 ? "trend-down" : ""}">
          ${hrsDiff !== null ? (hrsDiff > 0 ? "↑" : "↓") + Math.abs(hrsDiff) + "% vs prev period" : "All time"}
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color:#60a5fa">
        <div class="kpi-icon">📅</div><div class="kpi-label">Study days</div>
        <div class="kpi-val">${uniqueDays} <span>days</span></div>
        <div class="kpi-trend">${logs.length} sessions total</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#a78bfa">
        <div class="kpi-icon">📈</div><div class="kpi-label">Daily avg</div>
        <div class="kpi-val">${avgDaily.toFixed(1)} <span>hrs</span></div>
        <div class="kpi-trend">Target: ${state.dailyTarget || 6} hrs</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#fbbf24">
        <div class="kpi-icon">🔥</div><div class="kpi-label">Current streak</div>
        <div class="kpi-val">${streak} <span>days</span></div>
        <div class="kpi-trend">Best: ${maxStreak} days</div>
      </div>
    </div>

    <div class="analytics-grid">
      <div class="a-card"><div class="card-title">Daily hours – ${periodLabel}</div>${renderDailyBars(logs)}</div>
      <div class="a-card"><div class="card-title">Subject hours ranking</div>${renderSubjectRanking(subjectArr)}</div>
    </div>
    <div class="analytics-grid">
      <div class="a-card wide"><div class="card-title">Study heatmap – Last 6 months</div>${renderHeatmap(state.logs)}</div>
    </div>
    <div class="analytics-grid" style="grid-template-columns:1fr 1fr 1fr">
      <div class="a-card"><div class="card-title">Time distribution</div>${renderDonut(subjectArr, totalHrs)}</div>
      <div class="a-card"><div class="card-title">Mood analysis</div>${renderMoodChart(logs)}</div>
      <div class="a-card"><div class="card-title">Monthly comparison</div>${renderMonthlyComparison(state.logs)}</div>
    </div>
    <div class="analytics-grid">
      <div class="a-card"><div class="card-title">Insights</div>${renderInsights(most, least, avgDaily, logs)}</div>
      <div class="a-card"><div class="card-title">Streak details</div>${renderStreakDetails(state.logs, streak, maxStreak)}</div>
    </div>`;

  attachTooltips();
}

function getDaysArray() {
  const now = new Date(); now.setHours(0,0,0,0);
  if (currentPeriod === "week") {
    return Array.from({length:7}, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i));
      return { date: d.toISOString().split("T")[0], label: ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()] };
    });
  }
  if (currentPeriod === "month") {
    const y = now.getFullYear(), m = now.getMonth();
    return Array.from({length: new Date(y, m+1, 0).getDate()}, (_, i) => {
      const d = new Date(y, m, i+1);
      return { date: d.toISOString().split("T")[0], label: (i+1) % 5 === 1 ? String(i+1) : "" };
    });
  }
  return getWeeklyBuckets();
}

function getWeeklyBuckets() {
  const now = new Date(); now.setHours(0,0,0,0);
  const weeks = currentPeriod === "3month" ? 13 : Math.min(52, Math.ceil(state.logs.length / 7) + 4);
  return Array.from({length:weeks}, (_, i) => {
    const end   = new Date(now); end.setDate(end.getDate() - (weeks-1-i) * 7);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const hrs   = state.logs.filter(l => { const d = new Date(l.date); return d >= start && d <= end; })
                            .reduce((s,l) => s + (l.hrs||0), 0);
    return { date: end.toISOString().split("T")[0], label: `W${i+1}`, hrs };
  });
}

function renderDailyBars(logs) {
  const days   = getDaysArray();
  const dateMap = {};
  logs.forEach(l => { dateMap[l.date] = (dateMap[l.date] || 0) + (l.hrs||0); });
  const max     = Math.max(...days.map(d => (currentPeriod==="3month"||currentPeriod==="all") ? (d.hrs||0) : (dateMap[d.date]||0)), state.dailyTarget||6, 1);
  const todayStr= new Date().toISOString().split("T")[0];

  const cols = days.map(d => {
    const hrs = (currentPeriod==="3month"||currentPeriod==="all") ? (d.hrs||0) : (dateMap[d.date]||0);
    const h   = Math.round((hrs / max) * 100);
    const isT = d.date === todayStr;
    return `<div class="bc-col">
      <div class="bc-val">${hrs > 0 ? hrs.toFixed(1) : ""}</div>
      <div class="bc-bar-wrap">
        <div class="bc-bar ${isT ? "today" : ""}"
          style="height:${h}px;background:${hrs >= (state.dailyTarget||6) ? "var(--accent)" : "var(--accent2)"}"
          data-tip="${d.label}: ${hrs.toFixed(1)}h${isT ? " (today)" : ""}"></div>
      </div>
      <div class="bc-label">${d.label}</div>
    </div>`;
  }).join("");
  return `<div class="bar-chart">${cols}</div>`;
}

function renderSubjectRanking(arr) {
  if (!arr.length) return `<div style="color:var(--text2);font-size:13px">No data yet.</div>`;
  const maxHrs = arr[0].hrs;
  return `<div class="rank-list">${arr.slice(0,8).map((s, i) => {
    const medal = ["🥇","🥈","🥉"][i] || "";
    return `<div class="rank-row">
      <span class="rank-num">${medal || "#"+(i+1)}</span>
      <span class="rank-name" title="${s.name}">${s.name.split(" ").slice(0,3).join(" ")}</span>
      <div class="rank-track"><div class="rank-fill" style="width:${(s.hrs/maxHrs*100).toFixed(0)}%;background:${subjectColor(s.name)}"></div></div>
      <span class="rank-hrs">${s.hrs.toFixed(1)}h</span>
    </div>`;
  }).join("")}</div>`;
}

function renderHeatmap(logs) {
  const dateMap = {};
  logs.forEach(l => { dateMap[l.date] = (dateMap[l.date]||0) + (l.hrs||0); });
  const maxH = Math.max(...Object.values(dateMap), 1);
  const now  = new Date(); now.setHours(0,0,0,0);
  const cells = [], monthLabels = [];
  let lastMonth = -1, col = 0;
  const d = new Date(now); d.setDate(d.getDate() - 180);
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1);
  while (d <= now) {
    const ds = d.toISOString().split("T")[0];
    const hrs = dateMap[ds] || 0;
    const level = hrs === 0 ? 0 : hrs < maxH*.25 ? 1 : hrs < maxH*.5 ? 2 : hrs < maxH*.75 ? 3 : 4;
    if (d.getMonth() !== lastMonth) { monthLabels.push({ col, label: d.toLocaleString("default",{month:"short"}) }); lastMonth = d.getMonth(); }
    cells.push({ ds, hrs, level });
    if (d.getDay() === 6) col++;
    d.setDate(d.getDate() + 1);
  }
  const monthHtml = monthLabels.map((m, i) => {
    const w = ((monthLabels[i+1]?.col ?? col+1) - m.col) * 17;
    return `<span class="hm-month-label" style="width:${w}px;display:inline-block">${m.label}</span>`;
  }).join("");
  const dayLabels = ["","Mo","","We","","Fr",""].map(l => `<div class="hm-day-label">${l}</div>`).join("");
  const gridCells = cells.map(c => `<div class="hm-cell" data-level="${c.level}" data-tip="${c.ds}: ${c.hrs.toFixed(1)}h"></div>`).join("");
  return `
    <div style="display:flex;flex-direction:column;gap:4px">
      <div style="margin-left:28px"><div class="heatmap-months">${monthHtml}</div></div>
      <div class="heatmap-flex">
        <div class="heatmap-days">${dayLabels}</div>
        <div class="heatmap-wrap"><div class="heatmap-grid">${gridCells}</div></div>
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        ${[0,.2,.45,.7,1].map(o => `<div class="hm-leg-cell" style="background:rgba(110,231,183,${o||0});${o===0?"background:var(--border)":""}"></div>`).join("")}
        <span>More</span>
      </div>
    </div>`;
}

function renderDonut(arr, total) {
  if (!arr.length || !total) return `<div style="color:var(--text2);font-size:13px">No data.</div>`;
  const top = arr.slice(0, 6);
  const r = 45, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  const colors = ["#6ee7b7","#60a5fa","#a78bfa","#fb923c","#f87171","#fbbf24"];
  let offset = 0;
  const slices = top.map((s, i) => {
    const dash = s.hrs / total * circ;
    const rot  = (offset / total) * 360 - 90;
    offset += s.hrs;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i%6]}" stroke-width="18"
      stroke-dasharray="${dash.toFixed(2)} ${(circ-dash).toFixed(2)}"
      transform="rotate(${rot.toFixed(2)} ${cx} ${cy})"
      data-tip="${s.name}: ${s.hrs.toFixed(1)}h (${(s.hrs/total*100).toFixed(0)}%)"/>`;
  }).join("");
  const legend = top.map((s,i) => `
    <div class="dl-row">
      <div class="dl-dot" style="background:${colors[i%6]}"></div>
      <span class="dl-name" title="${s.name}">${s.name.split(" ").slice(0,2).join(" ")}</span>
      <span class="dl-pct">${(s.hrs/total*100).toFixed(0)}%</span>
    </div>`).join("");
  return `<div class="donut-wrap">
    <svg class="donut-svg" viewBox="0 0 120 120">${slices}
      <text x="${cx}" y="${cy+4}" text-anchor="middle" fill="var(--text)" font-size="10" font-family="Space Mono">${total.toFixed(0)}h</text>
    </svg>
    <div class="donut-legend">${legend}</div>
  </div>`;
}

function renderMoodChart(logs) {
  const moods  = ["😴","😐","🙂","😊","🔥"];
  const colors = ["#60a5fa","#94a3b8","#6ee7b7","#4ade80","#f97316"];
  const counts = Object.fromEntries(moods.map(m => [m, 0]));
  logs.forEach(l => { if (l.mood && counts[l.mood] !== undefined) counts[l.mood]++; });
  const max  = Math.max(...Object.values(counts), 1);
  const best = moods.reduce((a, b) => counts[a] >= counts[b] ? a : b);
  const total = Object.values(counts).reduce((a,b) => a+b, 0);
  const cols  = moods.map((m, i) => `
    <div class="mood-col">
      <div style="flex:1;display:flex;align-items:flex-end">
        <div class="mood-bar" style="height:${Math.round(counts[m]/max*80)}px;background:${colors[i]};width:100%;border-radius:4px 4px 0 0" data-tip="${m}: ${counts[m]} sessions"></div>
      </div>
      <div class="mood-emoji">${m}</div>
      <div class="mood-count">${counts[m]}</div>
    </div>`).join("");
  return `<div class="mood-chart">${cols}</div>
    <div style="margin-top:12px;font-size:12px;color:var(--text2)">
      Most common: <span style="color:var(--text)">${best} (${total ? (counts[best]/total*100).toFixed(0) : 0}%)</span>
    </div>`;
}

function renderMonthlyComparison(logs) {
  const now    = new Date();
  const months = Array.from({length:5}, (_, i) => {
    const d  = new Date(now.getFullYear(), now.getMonth() - (4-i), 1);
    const ym = d.toISOString().slice(0,7);
    return { label: d.toLocaleString("default",{month:"short",year:"2-digit"}), isCurrent: i===4,
             hrs: logs.filter(l => l.date.startsWith(ym)).reduce((s,l) => s+(l.hrs||0), 0) };
  });
  const max = Math.max(...months.map(m => m.hrs), 1);
  return `<div class="month-compare">${months.map(m => `
    <div class="mc-row">
      <span class="mc-label">${m.label}</span>
      <div class="mc-bar-wrap"><div class="mc-bar ${m.isCurrent ? "current" : ""}" style="width:${(m.hrs/max*100).toFixed(0)}%"></div></div>
      <span class="mc-hrs">${m.hrs.toFixed(0)}h</span>
    </div>`).join("")}</div>`;
}

function renderInsights(most, least, avgDaily, logs) {
  if (!logs.length) return `<div style="color:var(--text2);font-size:13px">Log some sessions to see insights!</div>`;
  const target  = state.dailyTarget || 6;
  const onTarget = logs.filter(l => l.hrs >= target).length;
  const tips = [
    most                      && `📚 Most studied: <strong>${most.name.split(" ").slice(0,3).join(" ")}</strong> (${most.hrs.toFixed(1)}h)`,
    (least && least !== most) && `⚠️ Needs attention: <strong>${least.name.split(" ").slice(0,3).join(" ")}</strong> (${least.hrs.toFixed(1)}h)`,
    `🎯 Target hit: <strong>${onTarget}/${logs.filter(l=>l.hrs>0).length} days</strong>`,
    avgDaily < target ? `📉 You're ${(target-avgDaily).toFixed(1)}h/day below your ${target}h target`
                      : `✅ You're exceeding your ${target}h daily target!`,
  ].filter(Boolean);
  return tips.map(t => `<div style="padding:10px 12px;background:var(--bg3);border-radius:8px;font-size:13px;margin-bottom:8px">${t}</div>`).join("");
}

function renderStreakDetails(logs, streak, maxStreak) {
  const uniqueDates = [...new Set(logs.map(l => l.date))];
  const totalHrs    = logs.reduce((s, l) => s + (l.hrs||0), 0);
  const mostActive  = getMostActiveMonth(logs);
  return `<div class="streak-info">
    <div class="si-item"><div class="si-val">${streak}</div><div class="si-label">Current 🔥</div></div>
    <div class="si-item"><div class="si-val">${maxStreak}</div><div class="si-label">Best ever</div></div>
    <div class="si-item"><div class="si-val">${uniqueDates.length}</div><div class="si-label">Total days</div></div>
  </div>
  <div style="font-size:13px;color:var(--text2);line-height:1.8">
    ${streak === 0 ? '<span style="color:var(--danger)">⚠️ Study today to start a streak!</span>' : '<span style="color:var(--accent)">Keep going! Don\'t break the chain.</span>'}
    <br>Avg per study day: <strong>${uniqueDates.length ? (totalHrs/uniqueDates.length).toFixed(1) : 0}h</strong>
    <br>Most active month: <strong>${mostActive}</strong>
  </div>`;
}

function getMostActiveMonth(logs) {
  if (!logs.length) return "—";
  const m = {};
  logs.forEach(l => { m[l.date.slice(0,7)] = (m[l.date.slice(0,7)]||0) + (l.hrs||0); });
  const best = Object.entries(m).sort((a,b) => b[1]-a[1])[0];
  return best ? new Date(best[0]+"-01").toLocaleString("default",{month:"long",year:"numeric"}) : "—";
}

function attachTooltips() {
  const tip = document.getElementById("tooltip");
  if (!tip) return;
  document.querySelectorAll("[data-tip]").forEach(el => {
    el.addEventListener("mousemove", e => { tip.textContent = el.dataset.tip; tip.classList.add("show"); tip.style.cssText += `;left:${e.clientX+12}px;top:${e.clientY-30}px`; });
    el.addEventListener("mouseleave", () => tip.classList.remove("show"));
  });
}

// ── Window exports ────────────────────────────────────────────
Object.assign(window, {
  setTab, toggleSidebar, toggleTopic, toggleExpand, filterSubjects,
  openLogModal, saveLogEntry, deleteLog, editLog, quickLog,
  openGoalModal, saveGoal, toggleGoal, deleteGoal,
  setMood, closeModal, saveSettings, exportData, confirmReset,
  renderLog, logout, setPeriod,
});