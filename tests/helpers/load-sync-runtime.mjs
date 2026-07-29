// load-sync-runtime.mjs — execute the REAL production sync.js inside a Node VM
// with Firebase / AI Logic / localStorage / DOM stubbed, so contract tests
// exercise the shipped code rather than a copied model.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

// A tiny in-memory Firestore. Docs keyed by "a/b/c/d" path string.
export function makeFirestore() {
  const store = new Map();               // path -> data
  const docListeners = new Map();        // path -> {next,err}
  const colListeners = new Map();        // path -> {next,err}
  const writes = [];                     // audit log of writes
  function docSnap(path) { return { exists: () => store.has(path), data: () => store.get(path), id: path.split("/").pop() }; }
  function colSnap(path) {
    const docs = [...store.entries()].filter(([p]) => p.startsWith(path + "/") && p.slice(path.length + 1).indexOf("/") === -1)
      .map(([p, d]) => ({ id: p.split("/").pop(), data: () => d }));
    return { docs };
  }
  const api = {
    store, writes,
    fail: false, failCode: "unavailable", denySetOverwrite: false,
    _maybeFail() { if (this.fail) throw Object.assign(new Error("write failed"), { code: this.failCode }); },
    getFirestore: () => ({}),
    doc: (_db, ...segs) => ({ __t: "doc", path: segs.join("/") }),
    collection: (_db, ...segs) => ({ __t: "collection", path: segs.join("/") }),
    query: (ref, ...constraints) => Object.assign({}, ref, { constraints }),
    where: (...args) => ({ __c: "where", args }),
    orderBy: (...args) => ({ __c: "orderBy", args }),
    limit: (...args) => ({ __c: "limit", args }),
    serverTimestamp: () => ({ __sentinel: "serverTimestamp" }),
    async getDoc(ref) { return docSnap(ref.path); },
    async setDoc(ref, data) {
      api._maybeFail();
      if (api.denySetOverwrite && store.has(ref.path)) throw Object.assign(new Error("immutable document"), { code: "permission-denied" });
      writes.push({ op: "set", path: ref.path, data }); store.set(ref.path, JSON.parse(JSON.stringify(data, (k, v) => v && v.__sentinel ? Date.now() : v))); return;
    },
    async updateDoc(ref, patch) { writes.push({ op: "update", path: ref.path, patch }); store.set(ref.path, Object.assign({}, store.get(ref.path), patch)); return; },
    async deleteDoc(ref) { writes.push({ op: "delete", path: ref.path }); store.delete(ref.path); return; },
    async addDoc(ref, data) { const id = "auto_" + Math.random().toString(36).slice(2); const path = ref.path + "/" + id; writes.push({ op: "add", path, data }); store.set(path, data); return { id }; },
    onSnapshot(ref, next, err) {
      const m = ref.__t === "doc" ? docListeners : colListeners;
      m.set(ref.path, { next, err, ref });
      return () => m.delete(ref.path);
    },
    async runTransaction(_db, fn) {
      const tx = {
        async get(ref) { return docSnap(ref.path); },
        set(ref, data) { writes.push({ op: "tx-set", path: ref.path, data }); store.set(ref.path, JSON.parse(JSON.stringify(data, (k, v) => v && v.__sentinel ? Date.now() : v))); },
        update(ref, patch) { writes.push({ op: "tx-update", path: ref.path, patch }); store.set(ref.path, Object.assign({}, store.get(ref.path), patch)); }
      };
      return fn(tx);
    },
    // harness controls to drive listeners
    emitDoc(path, data) { store[data === null ? "delete" : "set"](path, data); const l = docListeners.get(path); if (l) l.next(docSnap(path)); },
    emitError(path, e) { const l = docListeners.get(path) || colListeners.get(path); if (l && l.err) l.err(e); },
    docListeners, colListeners
  };
  return api;
}

// Load and run the real sync.js. Returns { sync, fs, ctx, localStorage }.
export async function loadSync(opts = {}) {
  const pathname = opts.pathname || "/";
  const href = opts.href || ("https://example.test" + pathname);
  const authFail = !!opts.authFail;
  const src = readFileSync(join(ROOT, "sync.js"), "utf8").replace(/^import[\s\S]*?;$/gm, "");

  const fs = makeFirestore();
  const fixtureUser = opts.authUser || { uid: "anon", isAnonymous: true };
  if (opts.enrolled !== false && fixtureUser.isAnonymous !== false) {
    fs.store.set("families/zimmy/members/" + String(fixtureUser.uid || "anon"), {
      familyId: "zimmy", role: "learner", active: true,
      appKeys: Array.isArray(opts.appKeys) ? opts.appKeys : ["dd1", "ddp2", "histp2"], createdByUid: "parent",
      createdAt: 1, updatedAt: 1
    });
  }
  for (const [path, data] of Object.entries(opts.initialDocs || {})) {
    fs.store.set(path, JSON.parse(JSON.stringify(data)));
  }
  const localStore = new Map(Object.entries(opts.localStorage || {}));
  const localStorage = {
    getItem: k => (localStore.has(k) ? localStore.get(k) : null),
    setItem: (k, v) => localStore.set(k, String(v)),
    removeItem: k => localStore.delete(k),
    _map: localStore
  };
  const listeners = {};
  const authCalls = { anonymous: 0, persistence: 0, tokenResults: [], emailLinks: [], completeLinks: [], signOut: 0 };
  const auth = {
    currentUser: opts.authUser || null,
    async authStateReady() {}
  };
  const windowObj = {
    StudyDashConfig: opts.StudyDashConfig || null,
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    dispatch: (t, ev) => (listeners[t] || []).forEach(fn => fn(ev || {}))
  };
  const documentObj = {
    createElement: () => ({ style: {}, getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,AAAA", appendChild() {}, querySelectorAll: () => [], setAttribute() {}, getAttribute() {} }),
    addEventListener() {}, body: { appendChild() {} }, hidden: false
  };

  const stubs = {
    initializeApp: () => ({}),
    initializeAppCheck: () => ({}),
    ReCaptchaEnterpriseProvider: class {},
    getAuth: () => auth,
    browserLocalPersistence: { type: "LOCAL" },
    async setPersistence() { authCalls.persistence++; },
    async signInAnonymously() {
      authCalls.anonymous++;
      if (authFail) throw Object.assign(new Error("auth"), { code: "auth/failed" });
      auth.currentUser = { uid: "anon", email: null, emailVerified: false, isAnonymous: true };
      return { user: auth.currentUser };
    },
    async sendSignInLinkToEmail(_auth, email, settings) {
      authCalls.emailLinks.push({ email, settings });
    },
    isSignInWithEmailLink: () => !!opts.emailLink,
    async signInWithEmailLink(_auth, email, link) {
      authCalls.completeLinks.push({ email, link });
      auth.currentUser = opts.emailLinkUser || { uid: "parent", email, emailVerified: true, isAnonymous: false };
      return { user: auth.currentUser };
    },
    async signOut() { authCalls.signOut++; auth.currentUser = null; },
    async getIdTokenResult(user, forceRefresh) {
      authCalls.tokenResults.push({ uid: user && user.uid, forceRefresh: !!forceRefresh });
      return { claims: Object.assign({}, opts.authClaims || {}) };
    },
    getAI: () => ({}),
    GoogleAIBackend: class {},
    getGenerativeModel: () => ({ async generateContent() { return { response: { text: () => "{}" } }; } }),
    Schema: { object: () => ({}), string: () => ({}), number: () => ({}), array: () => ({}), enumString: () => ({}), boolean: () => ({}) }
  };

  const sandbox = Object.assign({
    window: windowObj,
    document: documentObj,
    localStorage,
    location: { pathname, href },
    history: { replaceState() {} },
    navigator: { onLine: true },
    console,
    crypto: webcrypto,
    TextEncoder,
    Image: class { set src(_v) { setTimeout(() => this.onerror && this.onerror(), 0); } },
    setInterval: () => 0,
    setTimeout,
    clearTimeout,
    Date, Math, JSON, Promise, Object, Array, Number, String, Boolean, RegExp, Error, Set, Map, URL, parseInt, parseFloat, isNaN, isFinite
  }, stubs, fs);
  windowObj.window = windowObj;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(src, ctx, { filename: "sync.js" });
  // allow the auth promise + kickoff microtasks to settle
  await new Promise(r => setTimeout(r, 5));
  return { sync: windowObj.StudyDashSync, fs, ctx, localStorage, window: windowObj, document: documentObj, auth, authCalls };
}

export function readSource(rel) { return readFileSync(join(ROOT, rel), "utf8"); }
