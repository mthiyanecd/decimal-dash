// sync.js … Study Dash shared sync layer (Treasure Vault)
// Loaded by each app (Decimal Dash, Shape Dash, Explorer Dash) and by the Hub.
// Firestore + anonymous auth, card-free. This file is public by design.
// One shared copy at the repo root … no per-app duplication.
//
// Roles by URL path:
//   /  -> Decimal Dash (dd1) | /paper2/ -> Shape Dash (ddp2)
//   /history-p2/ -> Explorer Dash (histp2) | /hub/ -> Hub
//
// App pages: push state (pngs stripped), push compressed handwriting images,
//   and show a "From Dad" banner of assigned tasks.
// Hub: subscribes to state, assignments, vault, catalogue and redemptions;
//   writes assignments, awards Keys, manages catalogue, records redemptions.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZyXAK90DEvnCBcnt18imcO6nPD9Uq9UU",
  authDomain: "zimmy-study-hub.firebaseapp.com",
  projectId: "zimmy-study-hub",
  storageBucket: "zimmy-study-hub.firebasestorage.app",
  messagingSenderId: "914579278320",
  appId: "1:914579278320:web:382042138cf96f94cab535"
};

const FAMILY = "zimmy";
const PUSH_MS = 4000;
const KEYS = ["dd1", "ddp2", "histp2"];

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
const ready = signInAnonymously(auth).catch(e => console.warn("[sync] auth failed", e));

// ---- Role ----
const path = location.pathname;
const APP_MAP = [
  { re: /\/paper2\//,     key: "ddp2",   app: "ShapeDashP2" },
  { re: /\/history-p2\//, key: "histp2", app: "ExplorerDashH2" }
];
const isHub = /\/hub\//.test(path);
let role, myKey, myApp;
if (isHub) { role = "hub"; }
else { const m = APP_MAP.find(a => a.re.test(path)); if (m) { role = "app"; myKey = m.key; myApp = m.app; } else { role = "app"; myKey = "dd1"; myApp = "DecimalDash"; } }

// ---- Refs ----
const stateDoc = k => doc(db, "families", FAMILY, "state", k);
const asnCol   = collection(db, "families", FAMILY, "assignments");
const asnDoc   = id => doc(db, "families", FAMILY, "assignments", id);
const vaultDoc = doc(db, "families", FAMILY, "vault");
const catCol   = collection(db, "families", FAMILY, "catalogue");
const catDoc   = id => doc(db, "families", FAMILY, "catalogue", id);
const redCol   = collection(db, "families", FAMILY, "redemptions");
const redDoc   = id => doc(db, "families", FAMILY, "redemptions", id);
const imgDoc   = (k, ts) => doc(db, "families", FAMILY, "images", k + "_" + ts);

// ---- Helpers ----
const LOG_CAP = 400; // max log entries uploaded … keeps each state doc well under Firestore's 1 MiB/doc limit
function stripPngs(s) {
  try {
    const o = JSON.parse(JSON.stringify(s));
    if (Array.isArray(o.log)) {
      o.log.forEach(e => { if (e && e.png) { e.hasPng = true; delete e.png; } });
      /* Precompute stats from the FULL local log, then cap the uploaded log.
         The hub uses stats for summaries, so capping never skews them. */
      const st = { attempts: o.log.length, correct: 0, sessions: {} };
      o.log.forEach(e => {
        if (!e) return;
        if (e.correct) st.correct++;
        if (e.session != null) {
          const q = st.sessions[e.session] || (st.sessions[e.session] = { marks: 0, maxMarks: 0 });
          q.marks += e.marks || 0; q.maxMarks += e.maxMarks || 0;
        }
      });
      o.stats = st;
      if (o.log.length > LOG_CAP) o.log = o.log.slice(-LOG_CAP);
    }
    if (o.cur && o.cur.png) delete o.cur.png;
    return o;
  } catch (_) { return null; }
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// Downscale a handwriting JPEG data URL before syncing.
function compress(dataUrl, maxW = 800, q = 0.6) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / (img.width || maxW));
      const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      try { res({ jpeg: c.toDataURL("image/jpeg", q), w, h }); } catch (_) { res(null); }
    };
    img.onerror = () => res(null);
    img.src = dataUrl;
  });
}

// ---- APP: push state ----
let lastPushed = "", pushing = false;
async function pushIfChanged() {
  if (pushing) return;
  const raw = localStorage.getItem(myKey);
  if (!raw || raw === lastPushed) return;
  let s; try { s = JSON.parse(raw); } catch (_) { return; }
  const payload = stripPngs(s); if (!payload) return;
  payload.updated = Date.now(); payload.app = myApp;
  pushing = true;
  try { await ready; await setDoc(stateDoc(myKey), payload); lastPushed = raw; }
  catch (e) { console.warn("[sync] push failed", e); }
  finally { pushing = false; }
}

// ---- APP: push handwriting images (card-free) ----
let pushingImg = false;
async function pushImages() {
  if (pushingImg) return; pushingImg = true;
  try {
    const raw = localStorage.getItem(myKey); if (!raw) return;
    let s; try { s = JSON.parse(raw); } catch (_) { return; }
    const mk = "sdImgPushed_" + myKey;
    let pushed;
    try { const arr = JSON.parse(localStorage.getItem(mk) || "[]"); pushed = new Set(Array.isArray(arr) ? arr : []); }
    catch (_) { pushed = new Set(); }
    // Scan only the newest 500 image-bearing entries, matching the marker cap,
    // so old images are never evicted-then-re-uploaded in a loop (audit H-03).
    const recent = (Array.isArray(s.log) ? s.log : []).filter(e => e && e.png && e.ts).slice(-500);
    for (const e of recent) {
      if (!pushed.has(e.ts)) {
        const c = await compress(e.png); if (!c) continue;
        try {
          await ready;
          await setDoc(imgDoc(myKey, e.ts), { jpeg: c.jpeg, w: c.w, h: c.h, ts: e.ts, key: myKey, type: e.type || "", skill: e.skill || "", session: e.session != null ? e.session : null });
          pushed.add(e.ts);
        } catch (err) { console.warn("[sync] image push failed", err); }
      }
    }
    localStorage.setItem(mk, JSON.stringify([...pushed].slice(-500)));
  } finally { pushingImg = false; }
}

// ---- Live caches ----
const hubState = { dd1: null, ddp2: null, histp2: null };
const stateSubs = [];
let assignments = []; const asnSubs = [];
let vault = null; const vaultSubs = [];
let catalogue = []; const catSubs = [];
let redemptions = []; const redSubs = [];
const fire = (subs, val) => subs.forEach(fn => { try { fn(val); } catch (_) {} });

function subState(k) { onSnapshot(stateDoc(k), snap => { hubState[k] = snap.exists() ? snap.data() : null; fire(stateSubs, hubState); }, err => console.warn("[sync] state", k, err)); }
function subAssign() { onSnapshot(asnCol, snap => { assignments = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); fire(asnSubs, assignments); renderAppBanner(); }, err => console.warn("[sync] assign", err)); }
function subVault() { onSnapshot(vaultDoc, snap => { vault = snap.exists() ? snap.data() : null; fire(vaultSubs, vault); }, err => console.warn("[sync] vault", err)); }
function subCat() { onSnapshot(catCol, snap => { catalogue = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); fire(catSubs, catalogue); }, err => console.warn("[sync] catalogue", err)); }
function subRed() { onSnapshot(redCol, snap => { redemptions = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); fire(redSubs, redemptions); }, err => console.warn("[sync] redemptions", err)); }

// ---- Public API ----
window.StudyDashSync = {
  role,
  onState(fn) { stateSubs.push(fn); fn(hubState); },
  getState() { return hubState; },
  readLocal() { const o = {}; for (const k of KEYS) { try { const j = localStorage.getItem(k); o[k] = j ? JSON.parse(j) : null; } catch (_) { o[k] = null; } } return o; },

  onAssignments(fn) { asnSubs.push(fn); fn(assignments); },
  getAssignments() { return assignments; },
  async addAssignment(a) { await ready; return addDoc(asnCol, Object.assign({ status: "todo", createdBy: "parent", created: Date.now() }, a)); },
  async setAssignment(id, patch) { await ready; return updateDoc(asnDoc(id), patch); },
  async removeAssignment(id) { await ready; return deleteDoc(asnDoc(id)); },

  onVault(fn) { vaultSubs.push(fn); fn(vault); },
  getVault() { return vault; },
  async awardKeys(label, keys) { await ready; const cur = vault || {}; const log = (cur.log || []).concat([{ label, keys: Number(keys), ts: Date.now() }]); return setDoc(vaultDoc, { examKeys: (cur.examKeys || 0) + Number(keys), log, updated: Date.now() }, { merge: true }); },
  async updateVault(patch) { await ready; return setDoc(vaultDoc, Object.assign({ updated: Date.now() }, patch), { merge: true }); },

  onCatalogue(fn) { catSubs.push(fn); fn(catalogue); },
  getCatalogue() { return catalogue; },
  async addCatalogueItem(item) { await ready; return addDoc(catCol, Object.assign({ created: Date.now() }, item)); },
  async removeCatalogueItem(id) { await ready; return deleteDoc(catDoc(id)); },

  onRedemptions(fn) { redSubs.push(fn); fn(redemptions); },
  getRedemptions() { return redemptions; },
  async addRedemption(r) { await ready; return addDoc(redCol, Object.assign({ status: "pending", ts: Date.now() }, r)); },
  async setRedemption(id, patch) { await ready; return updateDoc(redDoc(id), patch); },

  async getImage(key, ts) { await ready; try { const snap = await getDoc(imgDoc(key, ts)); return snap.exists() ? snap.data() : null; } catch (_) { return null; } }
};

// ---- App "From Dad" banner ----
let bannerEl = null;
function renderAppBanner() {
  if (role !== "app") return;
  const mine = assignments.filter(a => a.appKey === myKey && a.status !== "done");
  if (!bannerEl) { bannerEl = document.createElement("div"); bannerEl.id = "sdSyncBanner"; bannerEl.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;font-family:-apple-system,sans-serif;"; document.body.appendChild(bannerEl); }
  if (!mine.length) { bannerEl.style.display = "none"; return; }
  bannerEl.style.display = "block";
  bannerEl.innerHTML = mine.map(a =>
    '<div style="background:#54389f;color:#fff;border-radius:14px;padding:10px 12px;margin-top:6px;box-shadow:0 4px 14px rgba(80,60,160,.35);display:flex;align-items:center;gap:10px;font-size:14px">' +
      '<span style="font-size:18px">📌</span><div style="flex:1"><b>From Dad:</b> ' + esc(a.note || a.taskType || "A task") +
      (a.dueTime || a.dueDate ? ' <span style="opacity:.85">· ' + esc([a.dueDate, a.dueTime].filter(Boolean).join(" ")) + '</span>' : '') +
      (a.minutes ? ' <span style="opacity:.85">· ' + esc(a.minutes) + ' min</span>' : '') + '</div>' +
      '<button data-done="' + a.id + '" style="border:none;background:#12b5a5;color:#fff;border-radius:999px;padding:7px 12px;font-weight:700">Done</button></div>'
  ).join("");
  bannerEl.querySelectorAll("[data-done]").forEach(btn => { btn.onclick = () => window.StudyDashSync.setAssignment(btn.getAttribute("data-done"), { status: "done", doneTs: Date.now() }); });
}

// ---- Kick off ----
if (role === "app") {
  ready.then(() => { pushIfChanged(); pushImages(); subAssign(); });
  setInterval(() => { pushIfChanged(); pushImages(); }, PUSH_MS);
  window.addEventListener("beforeunload", pushIfChanged);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { pushIfChanged(); pushImages(); } });
} else {
  ready.then(() => { KEYS.forEach(subState); subAssign(); subVault(); subCat(); subRed(); });
}
