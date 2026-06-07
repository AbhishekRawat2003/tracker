// ── firebase.js ──────────────────────────────────────────────
// Shared Firebase initialisation + state sync.
// Import this in both app.js and goals.js.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getDatabase, ref, set, onValue,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
import {
  getAuth, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBJp8hsmhOztAB-Fn1nYBq0PP0oeaePV-4",
  authDomain:        "gate-cs-tracker-bd113.firebaseapp.com",
  databaseURL:       "https://gate-cs-tracker-bd113-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "gate-cs-tracker-bd113",
  storageBucket:     "gate-cs-tracker-bd113.firebasestorage.app",
  messagingSenderId: "562293146283",
  appId:             "1:562293146283:web:a984708c26df8342faadee",
};

// Initialise once (guard against double-import in dev)
const app  = initializeApp(FIREBASE_CONFIG);
const db   = getDatabase(app);
const auth = getAuth(app);

// ── Default state shape ──────────────────────────────────────
export const DEFAULT_STATE = {
  userId:      "",
  examDate:    "",
  dailyTarget: 6,

  // Dashboard / subjects / log
  checked: {},
  logs:    [],
  goals:   [],        // legacy simple goals (index.html)

  // Goals page
  richGoals:   [],
  todos:       [],
  milestones:  [],
  habitDefs:   [],
  habits:      {},    // { habitId: { "YYYY-MM-DD": true } }
  trackerDefs: [],
  trackerLog:  {},    // { trackerId: { "YYYY-MM-DD": count } }

  pomoSessions: [],
};

// Live mutable state — modules mutate this object directly.
export let state = { ...DEFAULT_STATE };

let _uid      = "anon";
let _onChange = null;   // callback registered by the consuming module

// ── Auth + realtime listener ─────────────────────────────────
export function initAuth(onReady) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    _uid = user.uid;
    state.userId = user.displayName || user.email.split("@")[0];

    const userRef = ref(db, "users/" + _uid);
    onValue(userRef, (snap) => {
      const data = snap.val();
      if (data) {
        // Merge — preserve defaults for missing keys
        Object.assign(state, DEFAULT_STATE, data);
        // Array guards
        if (!Array.isArray(state.logs))        state.logs        = [];
        if (!Array.isArray(state.goals))       state.goals       = [];
        if (!Array.isArray(state.richGoals))   state.richGoals   = [];
        if (!Array.isArray(state.todos))       state.todos       = [];
        if (!Array.isArray(state.milestones))  state.milestones  = [];
        if (!Array.isArray(state.habitDefs))   state.habitDefs   = [];
        if (!Array.isArray(state.trackerDefs)) state.trackerDefs = [];
        if (!Array.isArray(state.pomoSessions))state.pomoSessions= [];
        if (!state.checked)    state.checked    = {};
        if (!state.habits)     state.habits     = {};
        if (!state.trackerLog) state.trackerLog = {};
      }
      onReady?.(state);
    });
  });
}

// ── Persist ──────────────────────────────────────────────────
export async function save() {
  await set(ref(db, "users/" + _uid), state);
}

// ── Logout ───────────────────────────────────────────────────
export async function logout() {
  if (!confirm("Logout?")) return;
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch {
    alert("Error logging out");
  }
}

// ── Tiny helpers ─────────────────────────────────────────────
export const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
export const today = () => new Date().toISOString().split("T")[0];