


import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

// ── Firebase config ──────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyBJp8hsmhOztAB-Fn1nYBq0PP0oeaePV-4",
    authDomain: "gate-cs-tracker-bd113.firebaseapp.com",
    databaseURL: "https://gate-cs-tracker-bd113-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gate-cs-tracker-bd113",
    storageBucket: "gate-cs-tracker-bd113.firebasestorage.app",
    messagingSenderId: "562293146283",
    appId: "1:562293146283:web:a984708c26df8342faadee",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        currentUser = user;
        state.userId = user.displayName || user.email.split("@")[0];
        listenFirebase();
    }
});

// ── Subjects data ────────────────────────────────────────────
const SUBJECTS = [
    {
        id: "maths", name: "Engineering Mathematics", marks: "13-15", color: "#4ade80",
        topics: ["Linear Algebra", "Calculus", "Probability & Statistics", "Discrete Mathematics", "Graph Theory"]
    },
    {
        id: "digital", name: "Digital Logic", marks: "8-10", color: "#60a5fa",
        topics: ["Boolean Algebra", "Logic Gates", "Combinational Circuits", "Sequential Circuits", "Number Systems"]
    },
    {
        id: "coa", name: "Computer Organization & Arch", marks: "8-10", color: "#fb923c",
        topics: ["Machine Instructions", "ALU & Datapath", "Pipelining", "Memory Hierarchy", "I/O Systems"]
    },
    {
        id: "dsa", name: "Programming & Data Structures", marks: "12-15", color: "#4ade80",
        topics: ["C Programming", "Arrays & Strings", "Linked Lists", "Stacks & Queues", "Trees", "Graphs", "Hashing"]
    },
    {
        id: "algo", name: "Algorithms", marks: "10-12", color: "#a78bfa",
        topics: ["Time & Space Complexity", "Sorting Algorithms", "Graph Algorithms", "Dynamic Programming", "Greedy", "Divide & Conquer", "NP Completeness"]
    },
    {
        id: "toc", name: "Theory of Computation", marks: "10-12", color: "#f87171",
        topics: ["Finite Automata", "Regular Expressions", "Context-Free Grammars", "Pushdown Automata", "Turing Machines", "Decidability"]
    },
    {
        id: "compiler", name: "Compiler Design", marks: "6-8", color: "#fb923c",
        topics: ["Lexical Analysis", "Parsing (LL/LR)", "Syntax-Directed Translation", "Intermediate Code", "Code Optimization"]
    },
    {
        id: "os", name: "Operating Systems", marks: "10-12", color: "#60a5fa",
        topics: ["Process Management", "CPU Scheduling", "Synchronization", "Deadlocks", "Memory Management", "File Systems"]
    },
    {
        id: "dbms", name: "DBMS", marks: "10-12", color: "#4ade80",
        topics: ["Relational Model", "SQL", "Normalization", "Transactions", "Indexing", "Relational Algebra"]
    },
    {
        id: "networks", name: "Computer Networks", marks: "10-12", color: "#a78bfa",
        topics: ["OSI & TCP/IP", "Data Link Layer", "Network Layer", "Transport Layer", "Application Layer", "Network Security"]
    },
    {
        id: "aptitude", name: "General Aptitude", marks: "15", color: "#fbbf24",
        topics: ["Verbal Ability", "Numerical Ability", "Logical Reasoning"]
    },
];

const SUBJECT_COLORS = {};
SUBJECTS.forEach(s => SUBJECT_COLORS[s.name] = s.color);
function subjectColor(name) { return SUBJECT_COLORS[name] || "#6ee7b7"; }

// ── Default state ────────────────────────────────────────────
let state = {
    userId: "devil",
    examDate: "2026-02-01",
    dailyTarget: 6,
    checked: {},
    logs: [],
    goals: [],
};

let editingLogId = null;
let selectedMood = "🙂";
let currentFilter = "all";
let currentTab_ = "dashboard";
let currentPeriod = "week";

// ── Firebase sync ────────────────────────────────────────────
function getUserId() {
    return currentUser?.uid || "devil";
}

function listenFirebase() {
    const userRef = ref(db, "users/" + getUserId());
    onValue(userRef, (snap) => {
        const data = snap.val();
        if (data) {
            state = { ...state, ...data };
            if (!Array.isArray(state.logs)) state.logs = [];
            if (!Array.isArray(state.goals)) state.goals = [];
            if (!state.checked) state.checked = {};
        }
        renderAll();
    });
}

async function save() {
    await set(ref(db, "users/" + getUserId()), state);
}

// ── Helpers ──────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function today() { return new Date().toISOString().split("T")[0]; }
function isChecked(sid, tid) { return !!(state.checked[sid] && state.checked[sid][tid]); }

function subjectProgress(s) {
    const done = s.topics.filter((_, i) => isChecked(s.id, i)).length;
    return { done, total: s.topics.length, pct: Math.round(done / s.topics.length * 100) };
}

function totalStats() {
    let totalTopics = 0, doneTopic = 0, totalHrs = 0;
    SUBJECTS.forEach(s => {
        const p = subjectProgress(s);
        totalTopics += p.total;
        doneTopic += p.done;
    });
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
        const cur = d.toISOString().split("T")[0];
        if (dateStr === cur) { streak++; d.setDate(d.getDate() - 1); }
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
        const label = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()];
        const hrs = state.logs.filter(l => l.date === dateStr).reduce((s, l) => s + (l.hrs || 0), 0);
        days.push({ dateStr, label, hrs, isToday: i === 0 });
    }
    return days;
}

function daysUntilExam() {
    if (!state.examDate) return null;
    const exam = new Date(state.examDate);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((exam - now) / 86400000);
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
    // Analytics renders on-demand when tab is active
    if (currentTab_ === "analytics") renderAnalytics();
}

// ── Greeting ─────────────────────────────────────────────────
function updateGreeting() {
    const h = new Date().getHours();
    const greet = h < 12 ? "Good morning 👋" : h < 17 ? "Good afternoon 👋" : "Good evening 👋";
    const streak = calcStreak();
    document.getElementById("greetingText").textContent = greet;
    document.getElementById("greetingUser").textContent =
        streak > 1 ? `${streak} day streak! Keep going 🔥` : "Let's get some study done today";
    const name = (state.userId || "devil")[0].toUpperCase();
    document.getElementById("userAvatar").textContent = name;
    document.getElementById("topbarAvatar").textContent = name;
    document.getElementById("userName").textContent = state.userId || "devil";
}

// ── Stats cards ──────────────────────────────────────────────
function renderStats() {
    const { doneTopic, totalTopics, totalHrs, subjectsDone } = totalStats();
    const streak = calcStreak();
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
    </div>
  `;
}

// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
    const { doneTopic, totalTopics } = totalStats();
    const pct = totalTopics ? Math.round(doneTopic / totalTopics * 100) : 0;
    const circumference = 314;
    const offset = circumference - (pct / 100) * circumference;
    const ring = document.getElementById("bigRingCircle");
    if (ring) ring.style.strokeDashoffset = offset;
    const rp = document.getElementById("ringPct");
    if (rp) rp.textContent = pct + "%";

    const sb = document.getElementById("subjectBars");
    if (sb) {
        sb.innerHTML = SUBJECTS.map(s => {
            const { pct: p } = subjectProgress(s);
            return `<div class="sb-row">
        <span class="sb-name">${s.name.split(" ").slice(0, 2).join(" ")}</span>
        <div class="sb-track"><div class="sb-fill" style="width:${p}%;background:${s.color}"></div></div>
        <span class="sb-pct">${p}%</span>
      </div>`;
        }).join("");
    }

    const ra = document.getElementById("recentActivity");
    if (ra) {
        const recent = [...state.logs].reverse().slice(0, 5);
        if (recent.length === 0) {
            ra.innerHTML = `<div class="activity-empty">No sessions yet — add your first log!</div>`;
        } else {
            ra.innerHTML = recent.map(l => `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <span class="activity-text">${l.subject} ${l.note ? "· " + l.note : ""}</span>
          <span class="activity-meta">${l.hrs}h · ${l.date}</span>
        </div>`).join("");
        }
    }

    const wc = document.getElementById("weekChart");
    if (wc) {
        const days = weeksHours();
        const maxHrs = Math.max(...days.map(d => d.hrs), state.dailyTarget || 6, 1);
        wc.innerHTML = days.map(d => {
            const h = Math.round((d.hrs / maxHrs) * 64);
            return `<div class="wc-col">
        <div class="wc-val">${d.hrs > 0 ? d.hrs.toFixed(1) : ""}</div>
        <div class="wc-bar-wrap"><div class="wc-bar ${d.isToday ? "today" : ""}" style="height:${h}px"></div></div>
        <div class="wc-label">${d.label}</div>
      </div>`;
        }).join("");
    }

    const ql = document.getElementById("qlSubject");
    if (ql && ql.options.length === 0) {
        SUBJECTS.forEach(s => {
            const o = document.createElement("option");
            o.value = o.textContent = s.name;
            ql.appendChild(o);
        });
    }
}

// ── Subjects ─────────────────────────────────────────────────
function renderSubjects() {
    const grid = document.getElementById("subjectsGrid");
    if (!grid) return;
    let list = SUBJECTS;
    if (currentFilter === "pending") list = SUBJECTS.filter(s => subjectProgress(s).pct === 0);
    if (currentFilter === "inprogress") list = SUBJECTS.filter(s => { const p = subjectProgress(s).pct; return p > 0 && p < 100; });
    if (currentFilter === "done") list = SUBJECTS.filter(s => subjectProgress(s).pct === 100);

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
    const search = (document.getElementById("logSearch")?.value || "").toLowerCase();
    const filterS = document.getElementById("logFilterSubject")?.value || "";
    const filterM = document.getElementById("logFilterMonth")?.value || "";

    let logs = [...state.logs].reverse();
    if (search) logs = logs.filter(l => (l.subject + l.note).toLowerCase().includes(search));
    if (filterS) logs = logs.filter(l => l.subject === filterS);
    if (filterM) logs = logs.filter(l => l.date.startsWith(filterM));

    const totalH = state.logs.reduce((s, l) => s + (l.hrs || 0), 0);
    const sessions = state.logs.length;
    const avgH = sessions > 0 ? (totalH / sessions).toFixed(1) : 0;
    const lsr = document.getElementById("logStatsRow");
    if (lsr) lsr.innerHTML = `
    <div class="stat-card"><div class="stat-label">Total sessions</div><div class="stat-val">${sessions}</div></div>
    <div class="stat-card"><div class="stat-label">Total hours</div><div class="stat-val">${totalH.toFixed(1)} <span>hrs</span></div></div>
    <div class="stat-card"><div class="stat-label">Avg per session</div><div class="stat-val">${avgH} <span>hrs</span></div></div>
  `;

    if (logs.length === 0) {
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

// ── Goals ────────────────────────────────────────────────────
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
    const el = document.getElementById("countdownDays");
    if (el) el.textContent = days !== null ? days : "--";
}

// ── Populate selects ─────────────────────────────────────────
function populateSelects() {
    ["modalSubject", "logFilterSubject", "goalSubject"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const isFilter = id === "logFilterSubject";
        el.innerHTML = isFilter ? '<option value="">All subjects</option>' : "";
        SUBJECTS.forEach(s => {
            const o = document.createElement("option");
            o.value = s.name; o.textContent = s.name;
            el.appendChild(o);
        });
    });
}

// ── Settings sync ────────────────────────────────────────────
function syncSettings() {
    const ui = document.getElementById("settingUserId");
    const ed = document.getElementById("settingExamDate");
    const dt = document.getElementById("settingDailyTarget");
    if (ui) ui.value = state.userId || "devil";
    if (ed) ed.value = state.examDate || "";
    if (dt) dt.value = state.dailyTarget || 6;
}

// ── Tab navigation ────────────────────────────────────────────
function setTab(tab) {
    currentTab_ = tab;
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.getElementById("page-" + tab)?.classList.add("active");
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");
    document.getElementById("sidebar").classList.remove("open");
    document.querySelector(".sidebar-overlay")?.classList.remove("show");

    // Render analytics when switching to it
    if (tab === "analytics") renderAnalytics();
}

// ── Sidebar toggle (mobile) ──────────────────────────────────
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

// ── Toggle topic checkbox ────────────────────────────────────
async function toggleTopic(sid, tid) {
    if (!state.checked[sid]) state.checked[sid] = {};
    state.checked[sid][tid] = !state.checked[sid][tid];
    await save();
}

// ── Expand/collapse subject card ─────────────────────────────
function toggleExpand(sid) {
    const body = document.getElementById("st-" + sid);
    const icon = document.getElementById("ei-" + sid);
    if (!body) return;
    body.classList.toggle("open");
    icon?.classList.toggle("open");
}

// ── Filter subjects ──────────────────────────────────────────
function filterSubjects(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderSubjects();
}

// ── Log CRUD ─────────────────────────────────────────────────
function openLogModal(logId) {
    editingLogId = logId || null;
    const modal = document.getElementById("logModal");
    const title = document.getElementById("logModalTitle");
    const btn = document.getElementById("logModalBtn");

    if (logId) {
        const l = state.logs.find(x => x.id === logId);
        if (!l) return;
        document.getElementById("modalDate").value = l.date;
        document.getElementById("modalSubject").value = l.subject;
        document.getElementById("modalHrs").value = l.hrs;
        document.getElementById("modalNote").value = l.note || "";
        selectedMood = l.mood || "🙂";
        title.textContent = "Edit session";
        btn.textContent = "Save changes";
    } else {
        document.getElementById("modalDate").value = today();
        document.getElementById("modalSubject").value = "";
        document.getElementById("modalHrs").value = 2;
        document.getElementById("modalNote").value = "";
        selectedMood = "🙂";
        title.textContent = "Add study session";
        btn.textContent = "Add session";
    }

    document.querySelectorAll(".mood-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.mood === selectedMood);
    });
    modal.classList.add("open");
}

async function saveLogEntry() {
    const date = document.getElementById("modalDate").value;
    const subject = document.getElementById("modalSubject").value;
    const hrs = parseFloat(document.getElementById("modalHrs").value);
    const note = document.getElementById("modalNote").value.trim();

    if (!date || !subject || isNaN(hrs) || hrs <= 0) {
        toast("Please fill all required fields");
        return;
    }

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
    renderLog();
    renderDashboard();
    renderStats();
}

function editLog(id) { openLogModal(id); }

// ── Quick log (dashboard) ────────────────────────────────────
async function quickLog() {
    const subject = document.getElementById("qlSubject")?.value;
    const hrs = parseFloat(document.getElementById("qlHrs")?.value);
    const note = document.getElementById("qlNote")?.value.trim() || "";
    if (!subject || isNaN(hrs) || hrs <= 0) { toast("Fill subject & hours"); return; }
    state.logs.push({ id: uid(), date: today(), subject, hrs, note, mood: "🙂" });
    document.getElementById("qlNote").value = "";
    document.getElementById("qlHrs").value = 1;
    toast("Logged! 🔥");
    await save();
}

// ── Goals CRUD ────────────────────────────────────────────────
function openGoalModal() {
    document.getElementById("goalTitle").value = "";
    document.getElementById("goalDate").value = "";
    document.getElementById("goalSubject").value = "";
    document.getElementById("goalModal").classList.add("open");
}

async function saveGoal() {
    const title = document.getElementById("goalTitle").value.trim();
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
    renderGoals();
}

// ── Mood picker ───────────────────────────────────────────────
function setMood(btn) {
    selectedMood = btn.dataset.mood;
    document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
}

// ── Modal close ───────────────────────────────────────────────
function closeModal(id) {
    document.getElementById(id)?.classList.remove("open");
}

// ── Settings ─────────────────────────────────────────────────
async function saveSettings() {
    const userId = document.getElementById("settingUserId").value.trim() || "devil";
    const examDate = document.getElementById("settingExamDate").value;
    const dailyTarget = parseFloat(document.getElementById("settingDailyTarget").value) || 6;
    const oldId = state.userId;
    state.userId = userId;
    state.examDate = examDate;
    state.dailyTarget = dailyTarget;

    if (oldId !== userId) {
        await set(ref(db, "users/" + userId), state);
        listenFirebase();
    } else {
        await save();
    }

    document.getElementById("userName").textContent = userId;
    document.getElementById("userAvatar").textContent = userId[0].toUpperCase();
    document.getElementById("topbarAvatar").textContent = userId[0].toUpperCase();
    updateCountdown();
    toast("Settings saved ✓");
}

function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
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

async function logout() {
    if (!confirm("Logout?")) return;
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (err) {
        toast("Error logging out");
    }
}

// ════════════════════════════════════════════════════════════
// ── ANALYTICS ───────────────────────────────────────────────
// ════════════════════════════════════════════════════════════

function setPeriod(p, btn) {
    currentPeriod = p;
    document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderAnalytics();
}

function getFilteredLogs() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const logs = state.logs;
    if (currentPeriod === "week") {
        const start = new Date(now); start.setDate(start.getDate() - 6);
        return logs.filter(l => new Date(l.date) >= start);
    }
    if (currentPeriod === "month") {
        const ym = now.toISOString().slice(0, 7);
        return logs.filter(l => l.date.startsWith(ym));
    }
    if (currentPeriod === "3month") {
        const start = new Date(now); start.setMonth(start.getMonth() - 3);
        return logs.filter(l => new Date(l.date) >= start);
    }
    return logs;
}

function getPrevPeriodLogs() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const logs = state.logs;
    if (currentPeriod === "week") {
        const end = new Date(now); end.setDate(end.getDate() - 7);
        const start = new Date(end); start.setDate(start.getDate() - 6);
        return logs.filter(l => { const d = new Date(l.date); return d >= start && d <= end; });
    }
    if (currentPeriod === "month") {
        const m = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const ym = m.toISOString().slice(0, 7);
        return logs.filter(l => l.date.startsWith(ym));
    }
    return [];
}

function renderAnalytics() {
    const logs = getFilteredLogs();
    const allLogs = state.logs;
    const content = document.getElementById("analyticsContent");
    if (!content) return;

    const totalHrs = logs.reduce((s, l) => s + (l.hrs || 0), 0);
    const uniqueDays = [...new Set(logs.map(l => l.date))].length;
    const avgDaily = uniqueDays ? (totalHrs / uniqueDays) : 0;
    const sessions = logs.length;

    const prevLogs = getPrevPeriodLogs();
    const prevHrs = prevLogs.reduce((s, l) => s + (l.hrs || 0), 0);
    const hrsDiff = prevHrs ? (((totalHrs - prevHrs) / prevHrs) * 100).toFixed(0) : null;

    const subjectMap = {};
    logs.forEach(l => {
        if (!l.subject) return;
        subjectMap[l.subject] = (subjectMap[l.subject] || 0) + (l.hrs || 0);
    });
    const subjectArr = Object.entries(subjectMap)
        .map(([name, hrs]) => ({ name, hrs }))
        .sort((a, b) => b.hrs - a.hrs);

    const most = subjectArr[0];
    const least = subjectArr[subjectArr.length - 1];
    const streak = calcStreak();
    const maxStreak = calcMaxStreak();

    content.innerHTML = `
    <div class="kpi-row">
      <div class="kpi-card" style="--kpi-color:#6ee7b7">
        <div class="kpi-icon">⏱</div>
        <div class="kpi-label">Total hours</div>
        <div class="kpi-val">${totalHrs.toFixed(1)} <span>hrs</span></div>
        <div class="kpi-trend ${hrsDiff > 0 ? 'trend-up' : hrsDiff < 0 ? 'trend-down' : ''}">
          ${hrsDiff !== null ? (hrsDiff > 0 ? '↑' : '↓') + Math.abs(hrsDiff) + '% vs prev period' : 'All time'}
        </div>
      </div>
      <div class="kpi-card" style="--kpi-color:#60a5fa">
        <div class="kpi-icon">📅</div>
        <div class="kpi-label">Study days</div>
        <div class="kpi-val">${uniqueDays} <span>days</span></div>
        <div class="kpi-trend">${sessions} sessions total</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#a78bfa">
        <div class="kpi-icon">📈</div>
        <div class="kpi-label">Daily avg</div>
        <div class="kpi-val">${avgDaily.toFixed(1)} <span>hrs</span></div>
        <div class="kpi-trend">Target: ${state.dailyTarget || 6} hrs</div>
      </div>
      <div class="kpi-card" style="--kpi-color:#fbbf24">
        <div class="kpi-icon">🔥</div>
        <div class="kpi-label">Current streak</div>
        <div class="kpi-val">${streak} <span>days</span></div>
        <div class="kpi-trend">Best: ${maxStreak} days</div>
      </div>
    </div>
 
    <div class="analytics-grid">
      <div class="a-card">
        <div class="card-title">Daily hours – ${periodLabel()}</div>
        ${renderDailyBars(logs)}
      </div>
      <div class="a-card">
        <div class="card-title">Subject hours ranking</div>
        ${renderSubjectRanking(subjectArr)}
      </div>
    </div>
 
    <div class="analytics-grid full">
      <div class="a-card wide">
        <div class="card-title">Study heatmap – Last 6 months</div>
        ${renderHeatmap(allLogs)}
      </div>
    </div>
 
    <div class="analytics-grid" style="grid-template-columns:1fr 1fr 1fr;">
      <div class="a-card">
        <div class="card-title">Time distribution</div>
        ${renderDonut(subjectArr, totalHrs)}
      </div>
      <div class="a-card">
        <div class="card-title">Mood analysis</div>
        ${renderMoodChart(logs)}
      </div>
      <div class="a-card">
        <div class="card-title">Monthly comparison</div>
        ${renderMonthlyComparison(allLogs)}
      </div>
    </div>
 
    <div class="analytics-grid">
      <div class="a-card">
        <div class="card-title">Insights</div>
        ${renderInsights(most, least, avgDaily, totalHrs, logs)}
      </div>
      <div class="a-card">
        <div class="card-title">Streak details</div>
        ${renderStreakDetails(allLogs, streak, maxStreak)}
      </div>
    </div>
  `;

    attachTooltips();
}

function periodLabel() {
    const map = { week: "This Week", month: "This Month", "3month": "Last 3 Months", all: "All Time" };
    return map[currentPeriod];
}

function renderDailyBars(logs) {
    const days = getDaysArray();
    const dateMap = {};
    logs.forEach(l => { dateMap[l.date] = (dateMap[l.date] || 0) + (l.hrs || 0); });
    const max = Math.max(...days.map(d => dateMap[d.date] || 0), state.dailyTarget || 6, 1);
    const todayStr = new Date().toISOString().split("T")[0];

    const cols = days.map(d => {
        const hrs = (currentPeriod === "3month" || currentPeriod === "all") ? (d.hrs || 0) : (dateMap[d.date] || 0);
        const h = Math.round((hrs / max) * 100);
        const isToday = d.date === todayStr;
        return `<div class="bc-col">
      <div class="bc-val">${hrs > 0 ? hrs.toFixed(1) : ''}</div>
      <div class="bc-bar-wrap">
        <div class="bc-bar ${isToday ? 'today' : ''}"
          style="height:${h}px;background:${hrs >= (state.dailyTarget || 6) ? 'var(--accent)' : 'var(--accent2)'}"
          data-tip="${d.label}: ${hrs.toFixed(1)}h${isToday ? ' (today)' : ''}"></div>
      </div>
      <div class="bc-label">${d.label}</div>
    </div>`;
    }).join("");
    return `<div class="bar-chart">${cols}</div>`;
}

function getDaysArray() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const days = [];
    if (currentPeriod === "week") {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now); d.setDate(d.getDate() - i);
            days.push({ date: d.toISOString().split("T")[0], label: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()] });
        }
    } else if (currentPeriod === "month") {
        const year = now.getFullYear(), month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            days.push({ date: d.toISOString().split("T")[0], label: i % 5 === 1 ? String(i) : '' });
        }
    } else {
        return getWeeklyBuckets();
    }
    return days;
}

function getWeeklyBuckets() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const weeks = currentPeriod === "3month" ? 13 : Math.min(52, Math.ceil(state.logs.length / 7) + 4);
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
        const end = new Date(now); end.setDate(end.getDate() - i * 7);
        const start = new Date(end); start.setDate(start.getDate() - 6);
        const weekLogs = state.logs.filter(l => {
            const d = new Date(l.date); return d >= start && d <= end;
        });
        const hrs = weekLogs.reduce((s, l) => s + (l.hrs || 0), 0);
        buckets.push({ date: end.toISOString().split("T")[0], label: `W${weeks - i}`, hrs });
    }
    return buckets;
}

function renderSubjectRanking(arr) {
    if (!arr.length) return `<div style="color:var(--text2);font-size:13px">No data yet.</div>`;
    const maxHrs = arr[0].hrs;
    const rows = arr.slice(0, 8).map((s, i) => {
        const pct = maxHrs ? (s.hrs / maxHrs * 100).toFixed(0) : 0;
        const color = subjectColor(s.name);
        const short = s.name.split(" ").slice(0, 3).join(" ");
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
        return `<div class="rank-row">
      <span class="rank-num">${medal || ('#' + (i + 1))}</span>
      <span class="rank-name" title="${s.name}">${short}</span>
      <div class="rank-track"><div class="rank-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="rank-hrs">${s.hrs.toFixed(1)}h</span>
    </div>`;
    }).join("");
    return `<div class="rank-list">${rows}</div>`;
}

function renderHeatmap(logs) {
    const dateMap = {};
    logs.forEach(l => { dateMap[l.date] = (dateMap[l.date] || 0) + (l.hrs || 0); });
    const maxH = Math.max(...Object.values(dateMap), 1);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const cells = [];
    const startD = new Date(now); startD.setDate(startD.getDate() - 180);
    while (startD.getDay() !== 0) startD.setDate(startD.getDate() - 1);

    const monthLabels = []; let lastMonth = -1; let col = 0;
    const d = new Date(startD);
    while (d <= now) {
        const dateStr =
            d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, '0') + "-" +
            String(d.getDate()).padStart(2, '0');
        const hrs = dateMap[dateStr] || 0;
        const level = hrs === 0 ? 0 : hrs < maxH * 0.25 ? 1 : hrs < maxH * 0.5 ? 2 : hrs < maxH * 0.75 ? 3 : 4;
        if (d.getMonth() !== lastMonth) {
            monthLabels.push({ col, label: d.toLocaleString('default', { month: 'short' }) });
            lastMonth = d.getMonth();
        }
        cells.push({ dateStr, hrs, level, dow: d.getDay() });
        if (d.getDay() === 6) col++;
        d.setDate(d.getDate() + 1);
    }

    const monthHtml = monthLabels.map((m, i) => {
        const nextCol = monthLabels[i + 1]?.col ?? col + 1;
        const width = (nextCol - m.col) * 17;
        return `<span class="hm-month-label" style="width:${width}px;display:inline-block">${m.label}</span>`;
    }).join("");

    const dayLabels = ['', 'Mo', '', 'We', '', 'Fr', ''].map(dl =>
        `<div class="hm-day-label">${dl}</div>`).join("");

    const gridCells = cells.map(c =>
        `<div class="hm-cell" data-level="${c.level}"
      data-tip="${c.dateStr}: ${c.hrs.toFixed(1)}h"></div>`).join("");

    return `
    <div style="display:flex;flex-direction:column;gap:4px;">
      <div style="margin-left:28px;"><div class="heatmap-months">${monthHtml}</div></div>
      <div class="heatmap-flex">
        <div class="heatmap-days" style="margin-top:1px">${dayLabels}</div>
        <div class="heatmap-wrap"><div class="heatmap-grid">${gridCells}</div></div>
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        <div class="hm-leg-cell" style="background:var(--border)"></div>
        <div class="hm-leg-cell" style="background:rgba(110,231,183,0.2)"></div>
        <div class="hm-leg-cell" style="background:rgba(110,231,183,0.45)"></div>
        <div class="hm-leg-cell" style="background:rgba(110,231,183,0.7)"></div>
        <div class="hm-leg-cell" style="background:rgba(110,231,183,1)"></div>
        <span>More</span>
      </div>
    </div>`;
}

function renderDonut(arr, total) {
    if (!arr.length || !total) return `<div style="color:var(--text2);font-size:13px">No data.</div>`;
    const top = arr.slice(0, 6);
    const r = 45, cx = 60, cy = 60, circumference = 2 * Math.PI * r;
    let offset = 0;
    const colors = ["#6ee7b7", "#60a5fa", "#a78bfa", "#fb923c", "#f87171", "#fbbf24"];

    const slices = top.map((s, i) => {
        const pct = s.hrs / total;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const rotate = (offset / total) * 360 - 90;
        offset += s.hrs;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${colors[i % colors.length]}" stroke-width="18"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      transform="rotate(${rotate.toFixed(2)} ${cx} ${cy})"
      data-tip="${s.name}: ${s.hrs.toFixed(1)}h (${(pct * 100).toFixed(0)}%)"/>`;
    }).join("");

    const legend = top.map((s, i) => {
        const short = s.name.split(" ").slice(0, 2).join(" ");
        return `<div class="dl-row">
      <div class="dl-dot" style="background:${colors[i % colors.length]}"></div>
      <span class="dl-name" title="${s.name}">${short}</span>
      <span class="dl-pct">${(s.hrs / total * 100).toFixed(0)}%</span>
    </div>`;
    }).join("");

    return `<div class="donut-wrap">
    <svg class="donut-svg" viewBox="0 0 120 120">${slices}
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="var(--text)" font-size="10" font-family="Space Mono">${total.toFixed(0)}h</text>
    </svg>
    <div class="donut-legend">${legend}</div>
  </div>`;
}

function renderMoodChart(logs) {
    const moods = ["😴", "😐", "🙂", "😊", "🔥"];
    const colors = ["#60a5fa", "#94a3b8", "#6ee7b7", "#4ade80", "#f97316"];
    const counts = {};
    moods.forEach(m => counts[m] = 0);
    logs.forEach(l => { if (l.mood && counts[l.mood] !== undefined) counts[l.mood]++; });
    const max = Math.max(...Object.values(counts), 1);

    const cols = moods.map((m, i) => {
        const h = Math.round((counts[m] / max) * 80);
        return `<div class="mood-col">
      <div style="flex:1;display:flex;align-items:flex-end">
        <div class="mood-bar" style="height:${h}px;background:${colors[i]};width:100%;border-radius:4px 4px 0 0"
          data-tip="${m}: ${counts[m]} sessions"></div>
      </div>
      <div class="mood-emoji">${m}</div>
      <div class="mood-count">${counts[m]}</div>
    </div>`;
    }).join("");

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const best = moods.reduce((a, b) => counts[a] >= counts[b] ? a : b);
    return `<div class="mood-chart">${cols}</div>
    <div style="margin-top:12px;font-size:12px;color:var(--text2)">
      Most common: <span style="color:var(--text)">${best} (${total ? ((counts[best] / total) * 100).toFixed(0) : 0}%)</span>
    </div>`;
}

function renderMonthlyComparison(logs) {
    const now = new Date();
    const months = [];
    for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = d.toISOString().slice(0, 7);
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const hrs = logs.filter(l => l.date.startsWith(ym)).reduce((s, l) => s + (l.hrs || 0), 0);
        months.push({ label, hrs, isCurrent: i === 0 });
    }
    const max = Math.max(...months.map(m => m.hrs), 1);
    const rows = months.map(m => `<div class="mc-row">
    <span class="mc-label">${m.label}</span>
    <div class="mc-bar-wrap"><div class="mc-bar ${m.isCurrent ? 'current' : ''}" style="width:${(m.hrs / max * 100).toFixed(0)}%"></div></div>
    <span class="mc-hrs">${m.hrs.toFixed(0)}h</span>
  </div>`).join("");
    return `<div class="month-compare">${rows}</div>`;
}

function renderInsights(most, least, avgDaily, totalHrs, logs) {
    const target = state.dailyTarget || 6;
    const onTarget = logs.filter(l => l.hrs >= target).length;
    const tips = [];
    if (most) tips.push(`📚 Most studied: <strong>${most.name.split(" ").slice(0, 3).join(" ")}</strong> (${most.hrs.toFixed(1)}h)`);
    if (least && least !== most) tips.push(`⚠️ Needs attention: <strong>${least.name.split(" ").slice(0, 3).join(" ")}</strong> (${least.hrs.toFixed(1)}h)`);
    tips.push(`🎯 Target hit: <strong>${onTarget}/${logs.filter(l => l.hrs > 0).length} days</strong>`);
    if (avgDaily < target) {
        tips.push(`📉 You're ${(target - avgDaily).toFixed(1)}h/day below your ${target}h target`);
    } else {
        tips.push(`✅ You're exceeding your ${target}h daily target!`);
    }
    if (!logs.length) return `<div style="color:var(--text2);font-size:13px">Log some sessions to see insights!</div>`;
    return tips.map(t => `<div style="padding:10px 12px;background:var(--surface2);border-radius:8px;font-size:13px;margin-bottom:8px">${t}</div>`).join("");
}

function renderStreakDetails(logs, streak, maxStreak) {
    const uniqueDates = [...new Set(logs.map(l => l.date))];
    const totalDays = uniqueDates.length;
    const totalHrs = logs.reduce((s, l) => s + (l.hrs || 0), 0);
    return `<div class="streak-info">
    <div class="si-item"><div class="si-val">${streak}</div><div class="si-label">Current 🔥</div></div>
    <div class="si-item"><div class="si-val">${maxStreak}</div><div class="si-label">Best ever</div></div>
    <div class="si-item"><div class="si-val">${totalDays}</div><div class="si-label">Total days</div></div>
  </div>
  <div style="font-size:13px;color:var(--text2);line-height:1.8">
    ${streak === 0 ? '<span style="color:var(--danger)">⚠️ Study today to start a streak!</span>' : '<span style="color:var(--accent)">Keep going! Don\'t break the chain.</span>'}
    <br>Avg per study day: <strong>${totalDays ? (totalHrs / totalDays).toFixed(1) : 0}h</strong>
    <br>Most active month: <strong>${getMostActiveMonth(logs)}</strong>
  </div>`;
}

function getMostActiveMonth(logs) {
    if (!logs.length) return "—";
    const m = {};
    logs.forEach(l => {
        const ym = l.date.slice(0, 7);
        m[ym] = (m[ym] || 0) + (l.hrs || 0);
    });
    const best = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    if (!best) return "—";
    const d = new Date(best[0] + "-01");
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function attachTooltips() {
    const tip = document.getElementById("tooltip");
    if (!tip) return;
    document.querySelectorAll("[data-tip]").forEach(el => {
        el.addEventListener("mousemove", e => {
            tip.textContent = el.dataset.tip;
            tip.classList.add("show");
            tip.style.left = (e.clientX + 12) + "px";
            tip.style.top = (e.clientY - 30) + "px";
        });
        el.addEventListener("mouseleave", () => tip.classList.remove("show"));
    });
}

// ── Window exports ────────────────────────────────────────────
window.setTab = setTab;
window.toggleSidebar = toggleSidebar;
window.toggleTopic = toggleTopic;
window.toggleExpand = toggleExpand;
window.filterSubjects = filterSubjects;
window.openLogModal = openLogModal;
window.saveLogEntry = saveLogEntry;
window.deleteLog = deleteLog;
window.editLog = editLog;
window.quickLog = quickLog;
window.openGoalModal = openGoalModal;
window.saveGoal = saveGoal;
window.toggleGoal = toggleGoal;
window.deleteGoal = deleteGoal;
window.setMood = setMood;
window.closeModal = closeModal;
window.saveSettings = saveSettings;
window.exportData = exportData;
window.confirmReset = confirmReset;
window.renderLog = renderLog;
window.logout = logout;
window.setPeriod = setPeriod;
