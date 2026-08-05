/* ============================================================
   CFCR Breed Standards Explorer — app.js
   Vanilla JS. No framework. No build step.
   Framework: World Dog Federation (WDF).

   Architecture
   ------------
   - DATA layer: load / normalize / validate breed records
   - STATE: single `state` object (current view, dataset, filters, session prefs)
   - RENDER: one render function per view (dashboard, list, profile, compare, admin)
   - HELPERS: search, filter, sort, compare-diff, import/export, form serialize, print

   Persistence
   -----------
   Only convenience state is stored in localStorage (favorites, recently viewed,
   UI prefs). The canonical dataset is the imported/exported JSON file. If
   localStorage is unavailable the app still works (in-memory only).
   ============================================================ */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     Constants
     --------------------------------------------------------- */
  const WDF_GROUPS = [
    "Group 1 Shepherd Dogs and Cattle Dogs",
    "Group 2 Pinscher and Schnauzer Type Dogs – Molossoids and Swiss Cattle Dogs",
    "Group 3 Terrier Type Dogs",
    "Group 4 Bull Type Dogs",
    "Group 5 Dogs of the Primitive Type",
    "Group 6 Scenthounds and Related Breeds",
    "Group 7 Pointing Dogs",
    "Group 8 Retrievers, Flushing and Water Dogs",
    "Group 9 Companion and Toy Dogs",
    "Group 10 Sighthounds",
  ];

  const WDF_STATUSES = ["recognized", "provisional", "observation", "not_recognized"];
  const COAT_TYPES = ["short", "long", "wire", "other"];
  const FUNCTIONAL_TYPES = ["herding", "guard", "hunting", "companion", "bull type", "primitive", "other"];

  // V2 extended classification / study metadata (all optional).
  const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"];
  const EXAM_RELEVANCE = ["low", "medium", "high"];
  const TEACHING_PRIORITY = ["low", "normal", "high"];
  const REVISION_STATUS = ["draft", "in_review", "verified", "needs_update"];
  const SOURCE_VERIFICATION = ["unverified", "verified", "conflicting"];

  const ANATOMY_FIELDS = [
    ["head", "Head"], ["skull", "Skull"], ["stop", "Stop"], ["muzzle", "Muzzle"],
    ["jaws_teeth", "Jaws & Teeth"], ["eyes", "Eyes"], ["ears", "Ears"], ["neck", "Neck"],
    ["topline", "Topline"], ["body", "Body"], ["chest", "Chest"], ["tail", "Tail"],
    ["forequarters", "Forequarters"], ["hindquarters", "Hindquarters"], ["feet", "Feet"],
    ["movement", "Movement"], ["coat", "Coat"], ["color", "Colour"],
    // Size and skin come from the imported standards; without them the height/weight
    // limits — the one thing a judge measures — would sit in the data but never show.
    ["size", "Size & Weight"], ["skin", "Skin"],
  ];

  const PROFILE_TABS = [
    { id: "identity", label: "Identity" },
    { id: "general", label: "General Profile" },
    { id: "anatomy", label: "Anatomy / Structure" },
    { id: "temperament", label: "Temperament" },
    { id: "faults", label: "Faults" },
    { id: "pedagogy", label: "Pedagogical Notes" },
    { id: "checklist", label: "Judge Checklist" },
    { id: "references", label: "References" },
    { id: "audit", label: "Version & Audit" },
  ];

  const STORAGE_KEYS = {
    favorites: "cfcr.favorites",
    recent: "cfcr.recent",
    prefs: "cfcr.prefs",
    quizHistory: "cfcr.quizHistory",
    savedSearches: "cfcr.savedSearches",
    recentSearches: "cfcr.recentSearches",
    lessonProgress: "cfcr.lessonProgress",
  };

  const MAX_RECENT = 10;

  /* ---------------------------------------------------------
     Safe localStorage wrapper (degrades gracefully)
     --------------------------------------------------------- */
  const store = {
    ok: (function () {
      try {
        const k = "__cfcr_test__";
        window.localStorage.setItem(k, "1");
        window.localStorage.removeItem(k);
        return true;
      } catch (e) { return false; }
    })(),
    get(key, fallback) {
      if (!this.ok) return fallback;
      try {
        const raw = window.localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      if (!this.ok) return;
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore quota */ }
    },
  };

  /* ---------------------------------------------------------
     Application state (single source of truth)
     --------------------------------------------------------- */
  const state = {
    meta: {},
    breeds: [],
    lessons: [],
    view: "dashboard",
    currentBreedId: null,
    currentLessonId: null,
    editingLesson: null,
    lessonProgress: store.get(STORAGE_KEYS.lessonProgress, {}),
    profileTab: "identity",
    search: "",
    list: {
      sort: "alpha",
      preset: "",
      filters: { group: "", country: "", status: "", coat: "", func: "", hasPedagogy: "", difficulty: "", track: "" },
    },
    savedSearches: store.get(STORAGE_KEYS.savedSearches, []),
    recentSearches: store.get(STORAGE_KEYS.recentSearches, []),
    compare: { a: "", b: "", c: "", teaching: false },
    favorites: store.get(STORAGE_KEYS.favorites, []),
    recent: store.get(STORAGE_KEYS.recent, []),
    prefs: store.get(STORAGE_KEYS.prefs, {}),
    editing: null, // working copy of a breed while in the editor
    quiz: {
      config: { scope: "all", group: "", focus: "mixed", count: 10, timed: false },
      session: null,   // active quiz: { questions, index, answers, mode, startedAt, secondsPerQ }
      history: store.get(STORAGE_KEYS.quizHistory, []),
      flash: null,     // active flashcards: { pool, index, flipped }
    },
  };

  /* ---------------------------------------------------------
     Small DOM / utility helpers
     --------------------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k]);
      }
    }
    (Array.isArray(children) ? children : children != null ? [children] : []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function statusLabel(s) {
    return { recognized: "Recognized", provisional: "Provisional", observation: "Observation", not_recognized: "Not recognized" }[s] || s || "—";
  }
  function verifLabel(s) {
    return {
      verified: "✓ Source verified",
      unverified: "Source unverified",
      conflicting: "⚠ Source conflicting",
      // „imported" = text extras din documentul standardului, ÎNCĂ NErevizuit de un lector.
      imported: "⚠ Imported — not yet reviewed",
    }[s] || s || "—";
  }
  function groupShort(g) {
    const m = /^(Group \d+)/.exec(g || "");
    return m ? m[1] : (g || "—");
  }
  function fmtList(arr) { return Array.isArray(arr) ? arr.filter(Boolean).join(", ") : (arr || ""); }
  function isNonEmptyText(v) { return typeof v === "string" && v.trim().length > 0; }

  let toastTimer;
  function toast(msg, kind) {
    const wrap = $("#toastWrap");
    const t = el("div", { class: "toast" + (kind ? " " + kind : ""), role: "status", text: msg });
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 3200);
  }

  /* ---------------------------------------------------------
     DATA layer
     --------------------------------------------------------- */
  function emptyBreed() {
    return {
      id: "",
      breed_name: "",
      alternate_names: [],
      group: "",
      country_of_origin: "",
      wdf_status: "recognized",
      coat_type: "short",
      functional_type: "companion",
      source_standard_url: "",
      source_standard_title: "",
      last_updated: "",
      identity: {
        official_name: "", owner_country: "", historical_function: "",
        general_impression: "", important_proportions: "", sexual_dimorphism: "", ideal_type_summary: "",
        // Filled by the standards import; empty on hand-written records.
        classification: "", historical_summary: "",
        standard_published: "", country_of_development: "",
      },
      anatomy: ANATOMY_FIELDS.reduce((o, [k]) => ((o[k] = ""), o), {}),
      temperament: { behavior: "", ring_attitude: "", expression: "", temperament_notes: "" },
      faults: { minor: [], serious: [], disqualifying: [] },
      pedagogy: { frequent_confusions: [], key_markers: [], judge_notes: [], teaching_notes: [], similar_breeds: [] },
      judge_checklist: { first_impression: [], static_exam: [], movement_exam: [], final_attention_points: [] },
      references: [],
      internal_notes: "",
      // V2 extended classification / study metadata (all optional)
      difficulty_level: "",
      exam_relevance: "",
      teaching_priority: "",
      revision_status: "",
      source_verification_status: "",
      thematic_tags: [],
      study_track_tags: [],
      recurring_judge_observations: [],
      // V2 versioning & audit
      version: 1,
      revision_history: [], // [{ version, date, ts, note, snapshot }]
    };
  }

  // Ensure a raw record has every expected field (defensive against partial imports).
  function normalizeBreed(raw) {
    const base = emptyBreed();
    const b = Object.assign(base, raw || {});
    // Fiecare sub-obiect se construiește pe o COPIE a valorilor implicite. Scris ca
    // `Object.assign(base.identity, raw.identity)`, un import parțial (fișă fără toate
    // cheile) golea valorile implicite prin referință, iar câmpurile lipsă rămâneau
    // `undefined` — apoi predicatele care le citeau aruncau eroare și goleau pagina.
    b.identity = Object.assign({}, base.identity, raw && raw.identity);
    b.anatomy = Object.assign({}, base.anatomy, raw && raw.anatomy);
    b.temperament = Object.assign({}, base.temperament, raw && raw.temperament);
    b.faults = Object.assign({}, base.faults, raw && raw.faults);
    b.pedagogy = Object.assign({}, base.pedagogy, raw && raw.pedagogy);
    b.judge_checklist = Object.assign({}, base.judge_checklist, raw && raw.judge_checklist);
    ["alternate_names", "thematic_tags", "study_track_tags", "recurring_judge_observations"].forEach((k) => { if (!Array.isArray(b[k])) b[k] = b[k] ? [b[k]] : []; });
    ["minor", "serious", "disqualifying"].forEach((k) => { if (!Array.isArray(b.faults[k])) b.faults[k] = []; });
    Object.keys(b.pedagogy).forEach((k) => { if (!Array.isArray(b.pedagogy[k])) b.pedagogy[k] = []; });
    Object.keys(b.judge_checklist).forEach((k) => { if (!Array.isArray(b.judge_checklist[k])) b.judge_checklist[k] = []; });
    if (!Array.isArray(b.references)) b.references = [];
    if (!Array.isArray(b.revision_history)) b.revision_history = [];
    if (typeof b.version !== "number" || b.version < 1) b.version = 1;
    if (!b.id) b.id = genId();
    if (!b.identity.official_name) b.identity.official_name = b.breed_name;
    return b;
  }

  function genId() {
    const nums = state.breeds
      .map((b) => /breed-(\d+)/.exec(b.id || ""))
      .filter(Boolean)
      .map((m) => parseInt(m[1], 10));
    const next = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    return "breed-" + String(next).padStart(3, "0");
  }

  function emptyLesson() {
    return {
      id: "", title: "", module: "", summary: "", body: "",
      learning_objectives: [], recommended_reading: [],
      linked_breeds: [], linked_groups: [],
      quiz_focus: "mixed", last_updated: "",
    };
  }
  function normalizeLesson(raw) {
    const l = Object.assign(emptyLesson(), raw || {});
    ["learning_objectives", "recommended_reading", "linked_breeds", "linked_groups"].forEach((k) => {
      if (!Array.isArray(l[k])) l[k] = l[k] ? [l[k]] : [];
    });
    if (!l.id) l.id = genLessonId();
    return l;
  }
  function genLessonId() {
    const nums = state.lessons.map((l) => /lesson-(\d+)/.exec(l.id || "")).filter(Boolean).map((m) => parseInt(m[1], 10));
    const next = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    return "lesson-" + String(next).padStart(3, "0");
  }
  function getLesson(id) { return state.lessons.find((l) => l.id === id) || null; }

  // Parse a dataset (array of breeds OR { meta, breeds:[] }) WITHOUT mutating state.
  function parseDataset(data) {
    let breeds, meta = {};
    if (Array.isArray(data)) {
      breeds = data;
    } else if (data && Array.isArray(data.breeds)) {
      breeds = data.breeds;
      meta = data.meta || {};
    } else {
      throw new Error("Unrecognized JSON shape. Expected an array of breeds or an object with a 'breeds' array.");
    }
    if (!breeds.length) throw new Error("The file contains no breeds.");
    const lessons = (data && Array.isArray(data.lessons)) ? data.lessons : [];
    return { meta: meta, breeds: breeds.map(normalizeBreed), lessons: lessons };
  }

  // Initial load / full replace.
  function ingestDataset(data) {
    const parsed = parseDataset(data);
    state.meta = parsed.meta;
    state.breeds = parsed.breeds;
    state.lessons = (parsed.lessons || []).map(normalizeLesson);
  }

  // Merge an incoming set into the current database.
  // Match by id first, then by breed name (case-insensitive). Returns counts.
  function mergeDataset(parsed) {
    let added = 0, updated = 0;
    parsed.breeds.forEach((incoming) => {
      let idx = state.breeds.findIndex((b) => b.id && incoming.id && b.id === incoming.id);
      if (idx < 0) idx = state.breeds.findIndex((b) => b.breed_name.toLowerCase() === incoming.breed_name.toLowerCase());
      if (idx >= 0) {
        // Preserve the existing id so favorites/recent references stay valid.
        incoming.id = state.breeds[idx].id;
        state.breeds[idx] = incoming;
        updated++;
      } else {
        if (!incoming.id || state.breeds.some((b) => b.id === incoming.id)) incoming.id = genId();
        state.breeds.push(incoming);
        added++;
      }
    });
    // Merge lessons too (match by id, then title).
    let lAdded = 0, lUpdated = 0;
    (parsed.lessons || []).map(normalizeLesson).forEach((incoming) => {
      let idx = state.lessons.findIndex((l) => l.id && incoming.id && l.id === incoming.id);
      if (idx < 0) idx = state.lessons.findIndex((l) => l.title && incoming.title && l.title.toLowerCase() === incoming.title.toLowerCase());
      if (idx >= 0) { incoming.id = state.lessons[idx].id; state.lessons[idx] = incoming; lUpdated++; }
      else { if (!incoming.id || state.lessons.some((l) => l.id === incoming.id)) incoming.id = genLessonId(); state.lessons.push(incoming); lAdded++; }
    });
    if (parsed.meta && Object.keys(parsed.meta).length) state.meta = Object.assign({}, state.meta, parsed.meta);
    return { added: added, updated: updated, lAdded: lAdded, lUpdated: lUpdated };
  }

  function buildExport() {
    return {
      schema_version: "1.0",
      meta: Object.assign(
        { app: "CFCR Breed Standards Explorer", framework: "World Dog Federation (WDF)" },
        state.meta,
        { exported_on: todayISO(), breed_count: state.breeds.length, lesson_count: state.lessons.length }
      ),
      breeds: state.breeds,
      lessons: state.lessons,
    };
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function getBreed(id) { return state.breeds.find((b) => b.id === id) || null; }

  /* ---------------------------------------------------------
     Validation (required fields for admin)
     --------------------------------------------------------- */
  function validateBreed(b) {
    const errors = {};
    if (!isNonEmptyText(b.breed_name)) errors.breed_name = "Breed name is required.";
    if (!isNonEmptyText(b.group)) errors.group = "WDF group is required.";
    if (!isNonEmptyText(b.country_of_origin)) errors.country_of_origin = "Country of origin is required.";
    if (!WDF_STATUSES.includes(b.wdf_status)) errors.wdf_status = "Select a valid WDF status.";
    if (b.source_standard_url && !/^https?:\/\//i.test(b.source_standard_url)) errors.source_standard_url = "URL must start with http:// or https://";
    return errors;
  }

  /* ---------------------------------------------------------
     SEARCH / FILTER / SORT helpers
     --------------------------------------------------------- */
  function breedSearchBlob(b) {
    const parts = [
      b.breed_name, fmtList(b.alternate_names), b.group, b.country_of_origin,
      b.functional_type, b.coat_type,
      Object.values(b.anatomy || {}).join(" "),
      Object.values(b.temperament || {}).join(" "),
      (b.faults.minor || []).join(" "), (b.faults.serious || []).join(" "), (b.faults.disqualifying || []).join(" "),
      Object.values(b.pedagogy || {}).map((v) => (Array.isArray(v) ? v.join(" ") : v)).join(" "),
      Object.values(b.identity || {}).join(" "),
    ];
    return parts.join(" · ").toLowerCase();
  }

  function hasPedagogy(b) {
    return Object.values(b.pedagogy || {}).some((v) => Array.isArray(v) && v.length > 0);
  }

  // Optional V2 metadata (present only if imported); heuristics degrade gracefully.
  function isExamRelevant(b) {
    if (b.exam_relevance === true) return true;
    return /^(high|yes|exam|true|1)$/i.test(String(b.exam_relevance || ""));
  }
  function isDifficult(b) {
    return /(high|difficult|hard|advanced)/i.test(String(b.difficulty_level || ""));
  }
  function sourceIncomplete(b) {
    return !isNonEmptyText(b.source_standard_url) || !(Array.isArray(b.references) && b.references.length > 0);
  }
  function isConfusable(b) {
    return (b.pedagogy.frequent_confusions.length > 0) || (b.pedagogy.similar_breeds.length > 0);
  }

  // Preset filters — research shortcuts for study and QA of the database.
  const LIST_PRESETS = [
    { key: "exam", label: "Exam-relevant", predicate: isExamRelevant, hint: "Marked exam_relevance in the data" },
    { key: "difficult", label: "Difficult breeds", predicate: isDifficult, hint: "Marked difficulty_level high" },
    { key: "confused", label: "Often confused", predicate: isConfusable, hint: "Has frequent confusions or similar breeds" },
    { key: "missing_pedagogy", label: "Missing pedagogy", predicate: (b) => !hasPedagogy(b), hint: "No pedagogical notes recorded" },
    { key: "incomplete_source", label: "Incomplete source", predicate: sourceIncomplete, hint: "Missing source URL or references" },
    { key: "has_dq", label: "Has disqualifying faults", predicate: (b) => b.faults.disqualifying.length > 0, hint: "At least one disqualifying fault" },
  ];
  function presetByKey(k) { return LIST_PRESETS.find((p) => p.key === k) || null; }

  function uniqueStudyTracks() {
    const set = new Set();
    state.breeds.forEach((b) => (b.study_track_tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }

  function applySearchFilterSort() {
    const q = state.search.trim().toLowerCase();
    const f = state.list.filters;
    const preset = presetByKey(state.list.preset);
    let rows = state.breeds.filter((b) => {
      if (q && !breedSearchBlob(b).includes(q)) return false;
      if (preset && !preset.predicate(b)) return false;
      if (f.group && b.group !== f.group) return false;
      if (f.country && b.country_of_origin !== f.country) return false;
      if (f.status && b.wdf_status !== f.status) return false;
      if (f.coat && b.coat_type !== f.coat) return false;
      if (f.func && b.functional_type !== f.func) return false;
      if (f.hasPedagogy === "yes" && !hasPedagogy(b)) return false;
      if (f.hasPedagogy === "no" && hasPedagogy(b)) return false;
      if (f.difficulty && b.difficulty_level !== f.difficulty) return false;
      if (f.track && !(b.study_track_tags || []).includes(f.track)) return false;
      return true;
    });
    const cmp = {
      alpha: (a, b) => a.breed_name.localeCompare(b.breed_name),
      group: (a, b) => (groupNumber(a.group) - groupNumber(b.group)) || a.breed_name.localeCompare(b.breed_name),
      country: (a, b) => (a.country_of_origin || "").localeCompare(b.country_of_origin || "") || a.breed_name.localeCompare(b.breed_name),
      updated: (a, b) => (b.last_updated || "").localeCompare(a.last_updated || ""),
    }[state.list.sort] || ((a, b) => 0);
    return rows.slice().sort(cmp);
  }

  function groupNumber(g) {
    const m = /^Group\s+(\d+)/.exec(g || "");
    return m ? parseInt(m[1], 10) : 999;
  }

  function uniqueValues(key) {
    const set = new Set();
    state.breeds.forEach((b) => { if (b[key]) set.add(b[key]); });
    const arr = Array.from(set);
    // Groups sort by their WDF number (natural order), not alphabetically.
    if (key === "group") return arr.sort((a, b) => groupNumber(a) - groupNumber(b) || a.localeCompare(b));
    return arr.sort((a, b) => a.localeCompare(b));
  }

  // Opțiunile unui select din editor: lista fixă + toate valorile chiar prezente în date
  // + valoarea curentă a fișei. Fără valoarea curentă în listă, browserul selecta prima
  // opțiune, iar salvarea o scria peste cea adevărată — un Ogar salvat după o corectură
  // de virgulă ajungea în Grupa 1, iar „imported" dispărea. Astfel salvarea nu mai mută
  // pe nimeni fără voie.
  function optiuniCu(constante, dataKey, current, labelFn) {
    const set = new Set(constante);
    state.breeds.forEach((b) => { if (b[dataKey]) set.add(b[dataKey]); });
    if (current) set.add(current);
    const arr = Array.from(set);
    if (dataKey === "group") arr.sort((a, b) => groupNumber(a) - groupNumber(b) || a.localeCompare(b));
    return arr.map((v) => [v, labelFn ? labelFn(v) : v]);
  }

  /* ---------------------------------------------------------
     Favorites / recently viewed
     --------------------------------------------------------- */
  function isFav(id) { return state.favorites.includes(id); }
  function toggleFav(id) {
    const i = state.favorites.indexOf(id);
    if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(id);
    store.set(STORAGE_KEYS.favorites, state.favorites);
  }
  function pushRecent(id) {
    state.recent = [id].concat(state.recent.filter((x) => x !== id)).slice(0, MAX_RECENT);
    store.set(STORAGE_KEYS.recent, state.recent);
  }

  /* ---------------------------------------------------------
     Routing
     --------------------------------------------------------- */
  // Pagina de Admin / Edit este accesibilă DOAR local (pe calculatorul redactorului) —
  // decizie CFC-Royal: online, pe cfc-royal.ro, aplicația e doar de consultare, iar
  // editarea raselor se face din copia locală. Fără server, aceasta e granița practică.
  var ADMIN_ENABLED = (function () {
    try {
      var h = location.hostname;
      return location.protocol === "file:" || h === "localhost" || h === "127.0.0.1" ||
             h === "::1" || h === "" || /\.local$/.test(h);
    } catch (e) { return false; }
  })();

  function navigate(view, opts) {
    opts = opts || {};
    if ((view === "admin" || view === "editor") && !ADMIN_ENABLED) view = "dashboard";
    state.view = view;
    if (view === "profile" && opts.id) {
      state.currentBreedId = opts.id;
      state.profileTab = opts.tab || "identity";
      pushRecent(opts.id);
    }
    if (view === "compare") {
      if (opts.a) state.compare.a = opts.a;
      if (opts.b) state.compare.b = opts.b;
    }
    if (view === "lesson" && opts.lessonId) state.currentLessonId = opts.lessonId;
    document.body.classList.remove("nav-open");
    render();
    $(".main").scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------
     RENDER — top-level
     --------------------------------------------------------- */
  function render() {
    renderSidebar();
    const main = $("#main");
    main.innerHTML = "";
    const shell = $("#appShell");
    const wantUtility = state.view === "profile";
    shell.classList.toggle("with-utility", wantUtility);
    $("#utility").hidden = !wantUtility;

    let node;
    switch (state.view) {
      case "dashboard": node = renderDashboard(); break;
      case "list": node = renderList(); break;
      case "profile": node = renderProfile(); break;
      case "compare": node = renderCompare(); break;
      case "quiz": node = renderQuiz(); break;
      case "curriculum": node = renderCurriculum(); break;
      case "lesson": node = renderLesson(); break;
      case "lessonEditor": node = renderLessonEditor(); break;
      case "admin": node = renderAdminList(); break;
      case "editor": node = renderEditor(); break;
      default: node = renderDashboard();
    }
    main.appendChild(node);
    if (wantUtility) renderUtility();
  }

  function renderSidebar() {
    const nav = $("#sidebarNav");
    nav.innerHTML = "";
    const items = [
      { group: "Explore" },
      { id: "dashboard", icon: "◧", label: "Dashboard" },
      { id: "list", icon: "☰", label: "Breed List", count: state.breeds.length },
      { id: "compare", icon: "⇄", label: "Compare Breeds" },
      { group: "Learn" },
      { id: "quiz", icon: "◎", label: "Quiz & Exam" },
      { id: "curriculum", icon: "▤", label: "Curriculum", count: state.lessons.length },
    ];
    // Admin / Edit apare doar când aplicația rulează local (vezi ADMIN_ENABLED).
    if (ADMIN_ENABLED) items.push({ group: "Manage" }, { id: "admin", icon: "✎", label: "Admin / Edit" });
    items.forEach((it) => {
      if (it.group) { nav.appendChild(el("div", { class: "nav-group-label", text: it.group })); return; }
      const active = state.view === it.id || (it.id === "admin" && state.view === "editor") || (it.id === "curriculum" && (state.view === "lesson" || state.view === "lessonEditor"));
      const btn = el("button", {
        class: "nav-btn" + (active ? " active" : ""),
        onclick: () => { if (it.id === "quiz") { state.quiz.session = null; state.quiz.flash = null; } navigate(it.id); },
      }, [
        el("span", { class: "nav-icon", text: it.icon }),
        el("span", { text: it.label }),
        it.count != null ? el("span", { class: "nav-count", text: String(it.count) }) : null,
      ]);
      nav.appendChild(btn);
    });
  }

  /* ---------------------------------------------------------
     RENDER — Dashboard
     --------------------------------------------------------- */
  function renderDashboard() {
    const groupsRepresented = new Set(state.breeds.map((b) => b.group).filter(Boolean)).size;
    const wrap = el("div", { class: "view" });

    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [
        el("h1", { text: "Dashboard" }),
        el("p", { class: "lede", text: "A structured WDF-oriented breed-standards workspace for judging preparation, teaching, and quick professional consultation." }),
      ]),
    ]));

    if (state.meta && state.meta.disclaimer) {
      // Data generării, la vedere: un arbitru cu aplicația instalată trebuie să știe cât
      // de veche e baza pe care o consultă offline, la expoziție.
      const dataSet = state.meta.generated_on || state.meta.exported_on;
      const prospetime = dataSet ? " <em>Dataset date: " + esc(dataSet) + " · " + state.breeds.length + " breeds.</em>" : "";
      wrap.appendChild(el("div", { class: "dataset-note", html: "<strong>Dataset notice:</strong> " + esc(state.meta.disclaimer) + prospetime }));
    }

    // Stats
    const stats = el("div", { class: "grid grid-stats" }, [
      statCard(state.breeds.length, "Total breeds"),
      statCard(groupsRepresented, "WDF groups represented"),
      statCard(state.favorites.length, "Favorites"),
      statCard(state.recent.length, "Recently viewed"),
    ]);
    wrap.appendChild(stats);

    // Quick filter chips by group
    const groups = uniqueValues("group");
    const chipRow = el("div", { class: "chip-row", style: "margin:16px 0" });
    groups.forEach((g) => {
      chipRow.appendChild(el("button", {
        class: "chip", onclick: () => { resetFilters(); state.list.filters.group = g; navigate("list"); },
      }, groupShort(g) + " · " + state.breeds.filter((b) => b.group === g).length));
    });
    if (groups.length) {
      wrap.appendChild(el("div", { class: "panel card" }, [
        el("div", { class: "panel-title" }, [el("h2", { text: "Quick filter by group" })]),
        chipRow,
      ]));
    }

    // Two-column: recent + favorites
    const cols = el("div", { class: "grid grid-2", style: "margin-top:16px" });
    cols.appendChild(recentPanel());
    cols.appendChild(favoritesPanel());
    wrap.appendChild(cols);

    // Intro panel
    wrap.appendChild(el("div", { class: "panel card intro-panel", style: "margin-top:16px" }, [
      el("h2", { text: "About this tool" }),
      el("p", { text: "CFCR Breed Standards Explorer is a professional reference and teaching instrument built around the World Dog Federation (WDF) framework. It separates official standard data, faults, pedagogical notes, and private internal notes so that judges and candidates can study, compare, and prepare with clarity." }),
      el("p", { html: "The canonical dataset is a JSON file you can <strong>import</strong> and <strong>export</strong> at any time. Favorites, recently viewed breeds, and UI preferences are kept in your browser for convenience only." }),
    ]));

    return wrap;
  }

  function statCard(value, label) {
    return el("div", { class: "card stat-card" }, [
      el("div", { class: "stat-value", text: String(value) }),
      el("div", { class: "stat-label", text: label }),
    ]);
  }

  function recentPanel() {
    const panel = el("div", { class: "panel card" }, [
      el("div", { class: "panel-title" }, [el("h3", { text: "Recently viewed" })]),
    ]);
    const ids = state.recent.map(getBreed).filter(Boolean);
    if (!ids.length) {
      panel.appendChild(emptyState("🕒", "No breeds viewed yet. Open a breed profile to see it here."));
    } else {
      const ul = el("ul", { class: "mini-list" });
      ids.forEach((b) => ul.appendChild(miniListItem(b)));
      panel.appendChild(ul);
    }
    return panel;
  }

  function favoritesPanel() {
    const panel = el("div", { class: "panel card" }, [
      el("div", { class: "panel-title" }, [el("h3", { text: "Favorites" })]),
    ]);
    const favs = state.favorites.map(getBreed).filter(Boolean);
    if (!favs.length) {
      panel.appendChild(emptyState("★", "No favorites yet. Mark breeds with the star to pin them here."));
    } else {
      const ul = el("ul", { class: "mini-list" });
      favs.forEach((b) => ul.appendChild(miniListItem(b)));
      panel.appendChild(ul);
    }
    return panel;
  }

  function miniListItem(b) {
    return el("li", {}, el("button", { onclick: () => navigate("profile", { id: b.id }) }, [
      el("span", { class: "mini-name", text: b.breed_name }),
      el("span", { class: "mini-meta", text: groupShort(b.group) + " · " + (b.country_of_origin || "—") }),
    ]));
  }

  function emptyState(icon, msg) {
    return el("div", { class: "empty-state" }, [
      el("div", { class: "empty-icon", text: icon }),
      el("p", { text: msg }),
    ]);
  }

  /* ---------------------------------------------------------
     RENDER — Breed list
     --------------------------------------------------------- */
  function savedSearchBar() {
    const hasSaved = state.savedSearches.length > 0;
    const hasRecent = state.recentSearches.length > 0;
    if (!hasSaved && !hasRecent) return null;
    const bar = el("div", { class: "saved-bar" });
    if (hasSaved) {
      const row = el("div", { class: "saved-row" }, [el("span", { class: "saved-label", text: "Saved:" })]);
      state.savedSearches.forEach((s) => {
        row.appendChild(el("span", { class: "saved-chip" }, [
          el("button", { class: "saved-chip-apply", title: "Apply saved search", onclick: () => applySavedSearch(s) }, s.name),
          el("button", { class: "saved-chip-del", title: "Delete", "aria-label": "Delete saved search " + s.name, onclick: () => deleteSavedSearch(s.name) }, "×"),
        ]));
      });
      bar.appendChild(row);
    }
    if (hasRecent) {
      const row = el("div", { class: "saved-row" }, [el("span", { class: "saved-label", text: "Recent:" })]);
      state.recentSearches.forEach((q) => {
        row.appendChild(el("button", { class: "chip", onclick: () => { state.search = q; syncGlobalSearchInput(); render(); } }, "🔍 " + q));
      });
      bar.appendChild(row);
    }
    return bar;
  }

  function activeFilterSummary() {
    const f = state.list.filters;
    const chips = [];
    const add = (label, onRemove) => chips.push(el("span", { class: "summary-chip" }, [
      el("span", { text: label }),
      el("button", { class: "summary-x", "aria-label": "Remove " + label, onclick: onRemove }, "×"),
    ]));
    if (state.search.trim()) add('Search: "' + state.search.trim() + '"', () => { state.search = ""; syncGlobalSearchInput(); render(); });
    const preset = presetByKey(state.list.preset);
    if (preset) add("Preset: " + preset.label, () => { state.list.preset = ""; render(); });
    const fmap = [
      ["group", "Group", (v) => groupShort(v)],
      ["country", "Country", (v) => v],
      ["status", "Status", (v) => statusLabel(v)],
      ["coat", "Coat", (v) => cap(v)],
      ["func", "Type", (v) => cap(v)],
      ["hasPedagogy", "Pedagogy", (v) => (v === "yes" ? "Has notes" : "No notes")],
      ["difficulty", "Difficulty", (v) => cap(v)],
      ["track", "Track", (v) => v],
    ];
    fmap.forEach(([key, label, fmt]) => {
      if (f[key]) add(label + ": " + fmt(f[key]), () => { f[key] = ""; render(); });
    });
    if (!chips.length) return null;
    const wrap = el("div", { class: "summary-bar" }, [el("span", { class: "saved-label", text: "Active:" })].concat(chips));
    wrap.appendChild(el("button", { class: "btn btn-sm btn-ghost", onclick: () => { resetFilters(); state.search = ""; syncGlobalSearchInput(); render(); } }, "Clear all"));
    return wrap;
  }

  function renderList() {
    const wrap = el("div", { class: "view" });
    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [el("h1", { text: "Breed List" }), el("p", { class: "lede", text: "Search, filter, and sort the WDF standards database." })]),
      ADMIN_ENABLED ? el("button", { class: "btn btn-primary", onclick: startNewBreed }, [el("span", { text: "＋ Add breed" })]) : null,
    ]));

    // Toolbar (sort + save + reset)
    const activeN = activeFilterCount();
    const toolbar = el("div", { class: "toolbar" }, [
      el("div", { class: "field" }, [
        el("label", { for: "sortSel", text: "Sort" }),
        selectControl("sortSel", [
          ["alpha", "Alphabetic"], ["group", "Group"], ["country", "Country"], ["updated", "Recently updated"],
        ], state.list.sort, (v) => { state.list.sort = v; render(); }),
      ]),
      el("button", { class: "btn btn-sm", onclick: saveCurrentSearch, disabled: activeN ? null : "" }, "☆ Save search"),
      el("button", { class: "btn btn-sm btn-ghost", onclick: () => { resetFilters(); state.search = ""; syncGlobalSearchInput(); render(); }, disabled: activeN ? null : "" },
        "Reset" + (activeN ? " (" + activeN + ")" : "")),
    ]);
    wrap.appendChild(toolbar);

    // Preset filters (research shortcuts)
    const presetRow = el("div", { class: "chip-row", style: "margin-bottom:12px" });
    LIST_PRESETS.forEach((p) => {
      const count = state.breeds.filter(p.predicate).length;
      const on = state.list.preset === p.key;
      presetRow.appendChild(el("button", {
        class: "chip" + (on ? " active" : ""), title: p.hint,
        onclick: () => { state.list.preset = on ? "" : p.key; render(); },
      }, p.label + " · " + count));
    });
    wrap.appendChild(presetRow);

    // Saved & recent searches
    const savedBar = savedSearchBar();
    if (savedBar) wrap.appendChild(savedBar);

    // Filters
    const f = state.list.filters;
    const filters = el("div", { class: "filters" }, [
      filterSelect("Group", uniqueValues("group").map((g) => [g, groupShort(g) + " — " + g.replace(/^Group \d+ /, "")]), f.group, (v) => { f.group = v; render(); }),
      filterSelect("Country", uniqueValues("country_of_origin").map((c) => [c, c]), f.country, (v) => { f.country = v; render(); }),
      // Filtrele se construiesc din valorile CHIAR PREZENTE în date, nu dintr-o listă fixă
      // scrisă în cod. Cu lista fixă, 71 de rase cu blană medie/creață/fără păr și 13 de
      // lucru/ogar rămâneau invizibile: filtrul nu le pomenea, deci nu puteau fi găsite.
      filterSelect("WDF status", uniqueValues("wdf_status").map((s) => [s, statusLabel(s)]), f.status, (v) => { f.status = v; render(); }),
      filterSelect("Coat type", uniqueValues("coat_type").map((c) => [c, cap(c)]), f.coat, (v) => { f.coat = v; render(); }),
      filterSelect("Functional type", uniqueValues("functional_type").map((c) => [c, cap(c)]), f.func, (v) => { f.func = v; render(); }),
      filterSelect("Pedagogical notes", [["yes", "Has notes"], ["no", "No notes"]], f.hasPedagogy, (v) => { f.hasPedagogy = v; render(); }),
      filterSelect("Difficulty", DIFFICULTY_LEVELS.map((d) => [d, cap(d)]), f.difficulty, (v) => { f.difficulty = v; render(); }),
    ].concat(uniqueStudyTracks().length ? [filterSelect("Study track", uniqueStudyTracks().map((t) => [t, t]), f.track, (v) => { f.track = v; render(); })] : []));
    wrap.appendChild(filters);

    // Active filter summary (removable chips)
    const summary = activeFilterSummary();
    if (summary) wrap.appendChild(summary);

    const rows = applySearchFilterSort();
    wrap.appendChild(el("div", { class: "result-count", text: rows.length + " of " + state.breeds.length + " breeds" + (state.search ? ' matching "' + state.search + '"' : "") }));

    if (!rows.length) {
      wrap.appendChild(emptyState("🔍", "No breeds match your search and filters. Try clearing some filters."));
      return wrap;
    }

    const table = el("table", { class: "breed-table" }, [
      el("thead", {}, el("tr", {}, [
        el("th", { text: "" }),
        el("th", { text: "Breed" }),
        el("th", { text: "Group" }),
        el("th", { text: "Country" }),
        el("th", { text: "Status" }),
        el("th", { text: "Coat / Type" }),
        el("th", { text: "Updated" }),
      ])),
    ]);
    const tbody = el("tbody");
    rows.forEach((b) => {
      const star = el("button", {
        class: "fav-star" + (isFav(b.id) ? " is-fav" : ""),
        title: isFav(b.id) ? "Remove from favorites" : "Add to favorites",
        "aria-label": isFav(b.id) ? "Remove from favorites" : "Add to favorites",
        onclick: (e) => { e.stopPropagation(); toggleFav(b.id); render(); },
      }, isFav(b.id) ? "★" : "☆");
      const tr = el("tr", { tabindex: "0", role: "button", "aria-label": "Open " + b.breed_name,
        onclick: () => navigate("profile", { id: b.id }),
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("profile", { id: b.id }); } },
      }, [
        td(star, ""),
        td([el("span", { class: "breed-name-cell", text: b.breed_name }), b.alternate_names.length ? el("div", { class: "alt-names", text: fmtList(b.alternate_names) }) : null], "Breed", "breed-name-cell"),
        td(el("span", { class: "badge badge-group", text: groupShort(b.group) }), "Group"),
        td(b.country_of_origin || "—", "Country"),
        td(el("span", { class: "badge badge-status " + b.wdf_status, text: statusLabel(b.wdf_status) }), "Status"),
        td(cap(b.coat_type) + " · " + cap(b.functional_type), "Coat / Type"),
        td(b.last_updated || "—", "Updated"),
      ]);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function td(content, label, extraClass) {
    const cell = el("td", { "data-label": label, class: extraClass || "" });
    (Array.isArray(content) ? content : [content]).forEach((c) => {
      if (c == null) return;
      cell.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return cell;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—"; }

  function filterSelect(label, options, value, onChange) {
    const id = "flt-" + label.replace(/\W+/g, "-").toLowerCase();
    const sel = selectControl(id, [["", "All"]].concat(options), value, onChange);
    return el("div", { class: "field" }, [el("label", { for: id, text: label }), sel]);
  }

  function selectControl(id, options, value, onChange) {
    const sel = el("select", { id: id, onchange: (e) => onChange(e.target.value) });
    options.forEach(([v, label]) => {
      const o = el("option", { value: v, text: label });
      if (v === value) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  /* ---------------------------------------------------------
     RENDER — Breed profile
     --------------------------------------------------------- */
  function renderProfile() {
    const b = getBreed(state.currentBreedId);
    const wrap = el("div", { class: "view" });
    if (!b) { wrap.appendChild(emptyState("∅", "Breed not found.")); return wrap; }

    // Print header (visible only in print)
    wrap.appendChild(el("div", { class: "print-header" }, [
      el("strong", { text: "CFCR Breed Standards Explorer — " }),
      el("span", { text: b.breed_name + " · " + b.group }),
    ]));

    const head = el("div", { class: "profile-head" }, [
      el("div", { class: "profile-title" }, [
        el("h1", { text: b.breed_name }),
        b.alternate_names.length ? el("div", { class: "profile-alt", text: "Also known as: " + fmtList(b.alternate_names) }) : null,
        el("div", { class: "profile-badges" }, [
          el("span", { class: "badge badge-group", text: b.group }),
          el("span", { class: "badge badge-status " + b.wdf_status, text: statusLabel(b.wdf_status) }),
          el("span", { class: "badge badge-coat", text: cap(b.coat_type) + " coat" }),
          el("span", { class: "badge badge-func", text: cap(b.functional_type) }),
          hasPedagogy(b) ? el("span", { class: "badge badge-ped", text: "Pedagogical notes" }) : null,
          b.difficulty_level ? el("span", { class: "badge badge-diff " + b.difficulty_level, text: "Difficulty: " + cap(b.difficulty_level) }) : null,
          b.exam_relevance ? el("span", { class: "badge badge-exam " + b.exam_relevance, text: "Exam: " + cap(b.exam_relevance) }) : null,
          b.source_verification_status ? el("span", { class: "badge badge-verif " + b.source_verification_status, text: verifLabel(b.source_verification_status) }) : null,
          el("span", { class: "badge", title: "Version — see the Version & Audit tab", text: "v" + (b.version || 1) + (b.revision_history && b.revision_history.length ? " · " + b.revision_history.length + " rev" : "") }),
        ]),
      ]),
      el("div", { class: "profile-actions" }, [
        el("button", { class: "btn btn-sm" + (isFav(b.id) ? " btn-primary" : ""), onclick: () => { toggleFav(b.id); render(); } }, (isFav(b.id) ? "★ " : "☆ ") + "Favorite"),
        el("button", { class: "btn btn-sm", onclick: () => navigate("compare", { a: b.id }) }, "⇄ Compare"),
        ADMIN_ENABLED ? el("button", { class: "btn btn-sm", onclick: () => startEditBreed(b.id) }, "✎ Edit") : null,
        el("button", { class: "btn btn-sm", onclick: () => printProfile() }, "⎙ Print"),
        el("button", { class: "btn btn-sm", onclick: () => exportProfileWord(b) }, "⬇ Word"),
        el("button", { class: "btn btn-sm", onclick: () => exportWord(slugify(b.breed_name) + "-revision.doc", b.breed_name + " — revision sheet", wordDocRevisionSheet(b)) }, "⬇ Revision sheet"),
      ]),
    ]);
    wrap.appendChild(head);

    // Avertisment la vedere, chiar unde citește candidatul: fișa importată e text brut din
    // documentul standardului, încă nerevizuit de lector. Nota generală de pe tabloul de
    // bord nu se vede aici — de aceea o repetăm în profilul rasei.
    if (b.source_verification_status === "imported") {
      wrap.appendChild(el("div", { class: "imported-note" }, [
        el("strong", { text: "⚠ Imported standard — not yet reviewed. " }),
        el("span", { text: "This text was extracted automatically from the source breed-standard document. " +
          "Teaching notes and the judge checklist are added separately by lecturers. Always verify against the official source standard." }),
      ]));
    }

    // Tabs
    const tabs = el("div", { class: "tabs", role: "tablist" });
    PROFILE_TABS.forEach((t) => {
      tabs.appendChild(el("button", {
        class: "tab" + (state.profileTab === t.id ? " active" : ""),
        role: "tab", "aria-selected": String(state.profileTab === t.id),
        onclick: () => { state.profileTab = t.id; render(); },
      }, t.label));
    });
    wrap.appendChild(tabs);

    const panel = el("div", { class: "tab-panel", role: "tabpanel" });
    panel.appendChild(renderProfileTab(b, state.profileTab));
    wrap.appendChild(panel);
    return wrap;
  }

  function renderProfileTab(b, tab) {
    switch (tab) {
      case "identity": return identityBlock(b);
      case "general": return generalBlock(b);
      case "anatomy": return anatomyBlock(b);
      case "temperament": return temperamentBlock(b);
      case "faults": return faultsBlock(b);
      case "pedagogy": return pedagogyBlock(b);
      case "checklist": return checklistBlock(b);
      case "references": return referencesBlock(b);
      case "audit": return auditBlock(b);
      default: return identityBlock(b);
    }
  }

  function dl(pairs) {
    const grid = el("dl", { class: "dl-grid" });
    pairs.forEach(([k, v]) => {
      if (v == null || v === "") v = "—";
      grid.appendChild(el("dt", { text: k }));
      const dd = el("dd");
      if (v instanceof Node) dd.appendChild(v); else dd.textContent = v;
      grid.appendChild(dd);
    });
    return grid;
  }

  function officialSection(title, node) {
    return el("div", { class: "callout official section-block" }, [
      el("div", { class: "callout-title", text: "▣ " + title + " · Official standard data" }),
      node,
    ]);
  }

  function identityBlock(b) {
    const link = b.source_standard_url
      ? el("a", { href: b.source_standard_url, target: "_blank", rel: "noopener", text: b.source_standard_title || b.source_standard_url })
      : (b.source_standard_title || "—");
    const wrap = el("div");
    wrap.appendChild(officialSection("Identity", dl([
      ["Official name", b.identity.official_name || b.breed_name],
      ["Alternate names", fmtList(b.alternate_names) || "—"],
      ["Internal ID", b.id],
      ["WDF group", b.group],
      ["Country of origin / owner", b.country_of_origin + (b.identity.owner_country && b.identity.owner_country !== b.country_of_origin ? " · " + b.identity.owner_country : "")],
      ["WDF recognition status", statusLabel(b.wdf_status)],
      ["Source standard title", b.source_standard_title || "—"],
      ["Source standard URL", link],
      ["Last updated", b.last_updated || "—"],
    ])));
    const ext = extendedClassificationBlock(b);
    if (ext) wrap.appendChild(ext);
    return wrap;
  }

  // V2 classification & study metadata — shown only when any value is present.
  function extendedClassificationBlock(b) {
    const hasScalar = b.difficulty_level || b.exam_relevance || b.teaching_priority || b.revision_status || b.source_verification_status;
    const hasArrays = (b.study_track_tags && b.study_track_tags.length) || (b.thematic_tags && b.thematic_tags.length) || (b.recurring_judge_observations && b.recurring_judge_observations.length);
    if (!hasScalar && !hasArrays) return null;
    const box = el("div", { class: "callout pedagogy section-block" });
    box.appendChild(el("div", { class: "callout-title", text: "❖ Classification & study metadata" }));
    if (hasScalar) {
      box.appendChild(dl([
        ["Difficulty level", b.difficulty_level ? cap(b.difficulty_level) : "—"],
        ["Exam relevance", b.exam_relevance ? cap(b.exam_relevance) : "—"],
        ["Teaching priority", b.teaching_priority ? cap(b.teaching_priority) : "—"],
        ["Revision status", b.revision_status ? cap(b.revision_status.replace(/_/g, " ")) : "—"],
        ["Source verification", b.source_verification_status ? verifLabel(b.source_verification_status) : "—"],
      ]));
    }
    if (b.study_track_tags && b.study_track_tags.length) {
      box.appendChild(el("div", { style: "margin-top:8px" }, [el("h4", { style: "margin:6px 0 4px", text: "Study tracks" }),
        el("div", { class: "tag-list" }, b.study_track_tags.map((t) => el("span", { class: "tag", text: t })))]));
    }
    if (b.thematic_tags && b.thematic_tags.length) {
      box.appendChild(el("div", { style: "margin-top:8px" }, [el("h4", { style: "margin:6px 0 4px", text: "Thematic tags" }),
        el("div", { class: "tag-list" }, b.thematic_tags.map((t) => el("span", { class: "tag", text: t })))]));
    }
    if (b.recurring_judge_observations && b.recurring_judge_observations.length) {
      box.appendChild(pedList("Recurring judge observations", b.recurring_judge_observations));
    }
    return box;
  }

  function generalBlock(b) {
    const id = b.identity;
    return officialSection("General Profile", dl([
      ["Classification", id.classification],
      ["Standard published", id.standard_published],
      ["Country of development", id.country_of_development],
      ["Historical function", id.historical_function],
      ["Brief historical summary", id.historical_summary],
      ["General impression", id.general_impression],
      ["Important proportions", id.important_proportions],
      ["Sexual dimorphism", id.sexual_dimorphism],
      ["Ideal type summary", id.ideal_type_summary],
    ]));
  }

  function anatomyBlock(b) {
    const wrap = el("div", { class: "section-block" });
    const details = el("details", { class: "collapsible", open: "" }, [
      el("summary", { text: "Anatomy & Structure · Official standard data" }),
      el("div", { class: "collapsible-body" }, dl(ANATOMY_FIELDS.map(([k, label]) => [label, b.anatomy[k]]))),
    ]);
    wrap.appendChild(details);
    return wrap;
  }

  function temperamentBlock(b) {
    const t = b.temperament;
    return officialSection("Temperament / Expression", dl([
      ["Behavior", t.behavior],
      ["Ring attitude", t.ring_attitude],
      ["Expression", t.expression],
      ["Temperament notes", t.temperament_notes],
    ]));
  }

  function faultsBlock(b) {
    const wrap = el("div", { class: "callout fault section-block" });
    wrap.appendChild(el("div", { class: "callout-title", text: "⚠ Faults" }));
    wrap.appendChild(faultTier("Minor faults", b.faults.minor, "tier-minor", "Minor"));
    wrap.appendChild(faultTier("Serious faults", b.faults.serious, "tier-serious", "Serious"));
    wrap.appendChild(faultTier("Disqualifying faults", b.faults.disqualifying, "tier-dq", "Disqualifying"));
    return wrap;
  }
  function faultTier(title, items, cls, tag) {
    const box = el("div", { class: "fault-tier " + cls });
    box.appendChild(el("h4", {}, [el("span", { text: title }), el("span", { class: "tier-tag", text: tag })]));
    if (items && items.length) {
      const ul = el("ul");
      items.forEach((i) => ul.appendChild(el("li", { text: i })));
      box.appendChild(ul);
    } else {
      box.appendChild(el("p", { class: "lede", text: "None recorded." }));
    }
    return box;
  }

  function pedagogyBlock(b) {
    const p = b.pedagogy;
    const wrap = el("div");
    wrap.appendChild(el("div", { class: "callout pedagogy section-block" }, [
      el("div", { class: "callout-title", text: "✎ Pedagogical notes · Teaching layer (not official standard text)" }),
      pedList("Frequent confusions", p.frequent_confusions),
      pedList("Key recognition markers", p.key_markers),
      pedList("Judge notes", p.judge_notes),
      pedList("Teaching notes", p.teaching_notes),
      similarBreeds(p.similar_breeds),
    ]));
    if (isNonEmptyText(b.internal_notes)) {
      wrap.appendChild(el("div", { class: "callout private section-block no-print" }, [
        el("div", { class: "callout-title", text: "🔒 Internal / private notes" }),
        el("p", { text: b.internal_notes }),
      ]));
    }
    return wrap;
  }
  function pedList(title, items) {
    const box = el("div", { style: "margin-bottom:12px" });
    box.appendChild(el("h4", { style: "margin:6px 0 4px", text: title }));
    if (items && items.length) {
      const ul = el("ul");
      items.forEach((i) => ul.appendChild(el("li", { text: i })));
      box.appendChild(ul);
    } else box.appendChild(el("p", { class: "lede", text: "None recorded." }));
    return box;
  }
  function similarBreeds(names) {
    const box = el("div", { style: "margin-bottom:4px" });
    box.appendChild(el("h4", { style: "margin:6px 0 4px", text: "Similar breeds" }));
    if (!names || !names.length) { box.appendChild(el("p", { class: "lede", text: "None recorded." })); return box; }
    const list = el("div", { class: "tag-list" });
    names.forEach((n) => {
      const match = state.breeds.find((b) => b.breed_name.toLowerCase() === String(n).toLowerCase());
      if (match) list.appendChild(el("button", { class: "tag", style: "cursor:pointer", onclick: () => navigate("profile", { id: match.id }) }, n + " ↗"));
      else list.appendChild(el("span", { class: "tag", text: n }));
    });
    box.appendChild(list);
    return box;
  }

  function checklistBlock(b) {
    const c = b.judge_checklist;
    const wrap = el("div", { class: "callout official section-block" });
    wrap.appendChild(el("div", { class: "callout-title", text: "☑ Judge checklist" }));
    [["First impression", c.first_impression], ["Static examination", c.static_exam], ["Movement examination", c.movement_exam], ["Final attention points", c.final_attention_points]]
      .forEach(([title, items]) => wrap.appendChild(pedList(title, items)));
    return wrap;
  }

  function referencesBlock(b) {
    const wrap = el("div", { class: "section-block" });
    wrap.appendChild(officialSection("References", (function () {
      const inner = el("div");
      if (b.references && b.references.length) {
        b.references.forEach((r) => {
          const link = r.url ? el("a", { href: r.url, target: "_blank", rel: "noopener", text: r.url }) : "—";
          inner.appendChild(dl([
            ["Type", (r.type || "reference").replace(/_/g, " ")],
            ["Title", r.title || "—"],
            ["URL", link],
            ["Accessed on", r.accessed_on || "—"],
          ]));
          inner.appendChild(el("hr", { style: "border:0;border-top:1px solid var(--c-line);margin:10px 0" }));
        });
      } else {
        inner.appendChild(dl([
          ["Official source", b.source_standard_title || "—"],
          ["Source URL", b.source_standard_url ? el("a", { href: b.source_standard_url, target: "_blank", rel: "noopener", text: b.source_standard_url }) : "—"],
        ]));
      }
      return inner;
    })()));
    if (isNonEmptyText(b.internal_notes)) {
      wrap.appendChild(el("div", { class: "callout private section-block no-print" }, [
        el("div", { class: "callout-title", text: "🔒 Internal source notes" }),
        el("p", { text: b.internal_notes }),
      ]));
    }
    return wrap;
  }

  // Flatten a breed into a label→string map for auditing / diffing.
  function flattenBreed(b) {
    const o = {};
    o["Breed name"] = b.breed_name;
    o["Alternate names"] = fmtList(b.alternate_names);
    o["Group"] = b.group;
    o["Country of origin"] = b.country_of_origin;
    o["WDF status"] = statusLabel(b.wdf_status);
    o["Coat type"] = b.coat_type;
    o["Functional type"] = b.functional_type;
    o["Source standard title"] = b.source_standard_title;
    o["Source standard URL"] = b.source_standard_url;
    Object.keys(b.identity).forEach((k) => { o["Identity · " + k.replace(/_/g, " ")] = b.identity[k]; });
    ANATOMY_FIELDS.forEach(([k, label]) => { o["Anatomy · " + label] = b.anatomy[k]; });
    Object.keys(b.temperament).forEach((k) => { o["Temperament · " + k.replace(/_/g, " ")] = b.temperament[k]; });
    o["Faults · minor"] = fmtList(b.faults.minor);
    o["Faults · serious"] = fmtList(b.faults.serious);
    o["Faults · disqualifying"] = fmtList(b.faults.disqualifying);
    Object.keys(b.pedagogy).forEach((k) => { o["Pedagogy · " + k.replace(/_/g, " ")] = fmtList(b.pedagogy[k]); });
    o["Difficulty level"] = b.difficulty_level;
    o["Exam relevance"] = b.exam_relevance;
    o["Teaching priority"] = b.teaching_priority;
    o["Revision status"] = b.revision_status;
    o["Source verification"] = b.source_verification_status;
    o["Study track tags"] = fmtList(b.study_track_tags);
    o["Thematic tags"] = fmtList(b.thematic_tags);
    o["Recurring judge observations"] = fmtList(b.recurring_judge_observations);
    o["Internal notes"] = b.internal_notes;
    return o;
  }

  // Return [field, oldValue, newValue] for every field that changed.
  function diffBreeds(oldB, curB) {
    const a = flattenBreed(oldB), c = flattenBreed(curB);
    const keys = Object.keys(a);
    Object.keys(c).forEach((k) => { if (keys.indexOf(k) < 0) keys.push(k); });
    const diffs = [];
    keys.forEach((k) => {
      const va = String(a[k] == null ? "" : a[k]);
      const vc = String(c[k] == null ? "" : c[k]);
      if (compareDiffers(va, vc)) diffs.push([k, va || "—", vc || "—"]);
    });
    return diffs;
  }

  function auditBlock(b) {
    const wrap = el("div");
    // Current version summary
    wrap.appendChild(el("div", { class: "callout official section-block" }, [
      el("div", { class: "callout-title", text: "⌗ Version & audit" }),
      dl([
        ["Current version", "v" + (b.version || 1)],
        ["Last revised", b.last_updated || "—"],
        ["Revision status", b.revision_status ? cap(b.revision_status.replace(/_/g, " ")) : "—"],
        ["Source verification", b.source_verification_status ? verifLabel(b.source_verification_status) : "—"],
        ["Source standard URL", b.source_standard_url ? el("a", { href: b.source_standard_url, target: "_blank", rel: "noopener", text: b.source_standard_url }) : "—"],
      ]),
    ]));

    // Change log
    const log = el("div", { class: "section-block" });
    log.appendChild(el("h3", { text: "Change log" }));
    const hist = (b.revision_history || []).slice().reverse(); // newest first
    if (!hist.length) {
      log.appendChild(el("p", { class: "lede", text: "No prior versions recorded yet. From now on, each saved edit stores a snapshot here so you can review and compare what changed." }));
    } else {
      hist.forEach((entry) => {
        const diffs = entry.snapshot ? diffBreeds(entry.snapshot, b) : [];
        const details = el("details", { class: "collapsible" });
        details.appendChild(el("summary", {}, [
          el("span", { text: "v" + entry.version + " → v" + (b.version || 1) + "  ·  " + (entry.date || "unknown date") }),
          entry.note ? el("span", { class: "muted", style: "margin-left:8px", text: "“" + entry.note + "”" }) : null,
        ]));
        const body = el("div", { class: "collapsible-body" });
        if (!diffs.length) {
          body.appendChild(el("p", { class: "lede", text: "No field differences versus the current version." }));
        } else {
          body.appendChild(el("p", { class: "muted", text: "Comparing this snapshot (v" + entry.version + ") with the current version (v" + (b.version || 1) + "): " + diffs.length + " field(s) changed." }));
          const table = el("table", { class: "compare-table audit-diff" }, [
            el("thead", {}, el("tr", {}, [el("th", { text: "Field" }), el("th", { text: "v" + entry.version + " (then)" }), el("th", { text: "current" })])),
          ]);
          const tb = el("tbody");
          diffs.forEach(([field, oldV, newV]) => {
            tb.appendChild(el("tr", { class: "diff" }, [
              el("td", { class: "row-label", text: field }),
              el("td", { text: oldV }),
              el("td", { text: newV }),
            ]));
          });
          table.appendChild(tb);
          body.appendChild(table);
        }
        details.appendChild(body);
        log.appendChild(details);
      });
    }
    wrap.appendChild(log);
    return wrap;
  }

  /* ---------------------------------------------------------
     RENDER — Utility panel (profile only)
     --------------------------------------------------------- */
  function renderUtility() {
    const u = $("#utility");
    u.innerHTML = "";
    const b = getBreed(state.currentBreedId);
    if (!b) return;
    u.appendChild(el("h3", { text: "Judge checklist" }));
    const c = b.judge_checklist;
    const all = [].concat(
      c.first_impression.map((x) => ["First impression", x]),
      c.static_exam.map((x) => ["Static", x]),
      c.movement_exam.map((x) => ["Movement", x]),
      c.final_attention_points.map((x) => ["Final", x])
    );
    if (all.length) {
      const ul = el("ul", { class: "checklist" });
      all.forEach(([grp, txt], i) => {
        const cbId = "chk-" + i;
        ul.appendChild(el("li", {}, [
          el("input", { type: "checkbox", id: cbId }),
          el("label", { for: cbId, html: "<strong style='font-size:.72rem;color:var(--c-ink-faint)'>" + esc(grp) + "</strong><br>" + esc(txt) }),
        ]));
      });
      u.appendChild(el("div", { class: "utility-section" }, ul));
    } else {
      u.appendChild(emptyState("☑", "No checklist items recorded."));
    }

    u.appendChild(el("div", { class: "utility-section" }, [
      el("h3", { text: "Key markers" }),
      b.pedagogy.key_markers.length
        ? el("div", { class: "tag-list" }, b.pedagogy.key_markers.map((m) => el("span", { class: "tag", text: m })))
        : el("p", { class: "lede", text: "None recorded." }),
    ]));

    u.appendChild(el("div", { class: "utility-section" }, [
      el("h3", { text: "Actions" }),
      el("div", { style: "display:flex;flex-direction:column;gap:8px" }, [
        el("button", { class: "btn btn-sm", onclick: () => printProfile() }, "⎙ Print this profile"),
        el("button", { class: "btn btn-sm", onclick: () => navigate("compare", { a: b.id }) }, "⇄ Use in comparison"),
        ADMIN_ENABLED ? el("button", { class: "btn btn-sm", onclick: () => startEditBreed(b.id) }, "✎ Edit this breed") : null,
      ]),
    ]));
  }

  /* ---------------------------------------------------------
     RENDER — Compare
     --------------------------------------------------------- */
  const COMPARE_SECTIONS = [
    { title: "Identity", rows: [
      ["Group", (b) => b.group],
      ["Country of origin", (b) => b.country_of_origin],
      ["WDF status", (b) => statusLabel(b.wdf_status)],
      ["Alternate names", (b) => fmtList(b.alternate_names)],
    ]},
    { title: "General type", rows: [
      ["Historical function", (b) => b.identity.historical_function],
      ["General impression", (b) => b.identity.general_impression],
      ["Ideal type summary", (b) => b.identity.ideal_type_summary],
    ]},
    { title: "Size & proportions", rows: [
      // Înălțimea la greabăn e SINGURUL lucru pe care un arbitru chiar îl măsoară —
      // lipsea din comparație. O comparație fără mărime nu e un instrument de arbitraj.
      ["Size & weight", (b) => b.anatomy.size],
      ["Important proportions", (b) => b.identity.important_proportions],
      ["Sexual dimorphism", (b) => b.identity.sexual_dimorphism],
    ]},
    { title: "Head & expression", rows: [
      ["Head", (b) => b.anatomy.head],
      ["Muzzle", (b) => b.anatomy.muzzle],
      ["Eyes", (b) => b.anatomy.eyes],
      ["Ears", (b) => b.anatomy.ears],
      ["Expression", (b) => b.temperament.expression],
    ]},
    { title: "Body & skin", rows: [
      ["Body", (b) => b.anatomy.body],
      ["Topline", (b) => b.anatomy.topline],
      ["Skin", (b) => b.anatomy.skin],
    ]},
    { title: "Movement", rows: [ ["Movement", (b) => b.anatomy.movement] ]},
    { title: "Coat & colour", rows: [
      ["Coat", (b) => b.anatomy.coat],
      ["Colour", (b) => b.anatomy.color],
      ["Coat type", (b) => cap(b.coat_type)],
    ]},
    { title: "Faults", rows: [
      ["Minor faults", (b) => fmtList(b.faults.minor)],
      ["Serious faults", (b) => fmtList(b.faults.serious)],
      ["Disqualifying faults", (b) => fmtList(b.faults.disqualifying)],
    ]},
    { title: "Pedagogical notes", rows: [
      ["Frequent confusions", (b) => fmtList(b.pedagogy.frequent_confusions)],
      ["Key markers", (b) => fmtList(b.pedagogy.key_markers)],
    ]},
  ];

  function renderCompare() {
    const wrap = el("div", { class: "view" });
    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [el("h1", { text: "Compare Breeds" }), el("p", { class: "lede", text: "Compare 2 or 3 breeds in a section-based matrix. Differing rows are highlighted. Teaching mode surfaces likely confusions and what to observe first." })]),
    ]));

    const options = state.breeds.slice().sort((a, b) => a.breed_name.localeCompare(b.breed_name)).map((b) => [b.id, b.breed_name]);
    const picker = el("div", { class: "compare-picker compare-picker-3" }, [
      el("div", { class: "field" }, [el("label", { for: "cmpA", text: "Breed A" }),
        selectControl("cmpA", [["", "— Select —"]].concat(options), state.compare.a, (v) => { state.compare.a = v; render(); })]),
      el("div", { class: "field" }, [el("label", { for: "cmpB", text: "Breed B" }),
        selectControl("cmpB", [["", "— Select —"]].concat(options), state.compare.b, (v) => { state.compare.b = v; render(); })]),
      el("div", { class: "field" }, [el("label", { for: "cmpC", text: "Breed C (optional)" }),
        selectControl("cmpC", [["", "— None —"]].concat(options), state.compare.c, (v) => { state.compare.c = v; render(); })]),
    ]);
    wrap.appendChild(picker);

    // Resolve the selected breeds (distinct, in order), dropping empties/duplicates.
    const rawIds = [state.compare.a, state.compare.b, state.compare.c];
    const seen = {};
    const breeds = [];
    rawIds.forEach((id) => { const br = getBreed(id); if (br && !seen[br.id]) { seen[br.id] = 1; breeds.push(br); } });

    if (breeds.length < 2) {
      wrap.appendChild(emptyState("⇄", "Select at least two different breeds to build a comparison. Add a third for a matrix view."));
      return wrap;
    }

    const names = breeds.map((b) => b.breed_name);
    const fileBase = "comparison-" + breeds.map((b) => slugify(b.breed_name)).join("-vs-");

    wrap.appendChild(el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px" }, [
      el("button", { class: "btn btn-sm" + (state.compare.teaching ? " btn-primary" : ""), onclick: () => { state.compare.teaching = !state.compare.teaching; render(); } }, "🎓 Teaching mode"),
      el("button", { class: "btn btn-sm", onclick: () => printComparison() }, "⎙ Print"),
      el("button", { class: "btn btn-sm", onclick: () => exportWord(fileBase + ".doc", names.join(" vs "), wordDocComparison(breeds, state.compare.teaching)) }, "⬇ Word"),
      breeds.length === 2 ? el("button", { class: "btn btn-sm btn-ghost", onclick: () => { const t = state.compare.a; state.compare.a = state.compare.b; state.compare.b = t; render(); } }, "⇄ Swap") : null,
      state.compare.c ? el("button", { class: "btn btn-sm btn-ghost", onclick: () => { state.compare.c = ""; render(); } }, "✕ Remove C") : null,
    ]));

    wrap.appendChild(el("div", { class: "print-header" }, [
      el("strong", { text: "CFCR Breed Standards Explorer — Comparison: " }), el("span", { text: names.join(" vs ") }),
    ]));

    if (state.compare.teaching) wrap.appendChild(teachingCompareSection(breeds));

    const colspan = String(breeds.length + 1);
    const table = el("table", { class: "compare-table" });
    table.appendChild(el("thead", {}, el("tr", {}, [el("th", { text: "Field" })].concat(breeds.map((b) => el("th", { text: b.breed_name }))))));
    const tbody = el("tbody");
    COMPARE_SECTIONS.forEach((sec) => {
      tbody.appendChild(el("tr", { class: "section-row" }, el("td", { colspan: colspan, text: sec.title })));
      sec.rows.forEach(([label, fn]) => {
        const vals = breeds.map((b) => (fn(b) || "").toString().trim());
        const differ = compareDiffersMulti(vals);
        tbody.appendChild(el("tr", { class: differ ? "diff" : "" },
          [el("td", { class: "row-label", text: label })].concat(vals.map((v) => el("td", { text: v || "—" })))));
      });
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.appendChild(el("div", { class: "diff-legend" }, [el("span", { class: "swatch" }), el("span", { text: "Highlighted rows indicate a meaningful difference between the breeds." })]));
    return wrap;
  }

  // Compare-diff logic: normalize whitespace/case; treat empties as equal-if-both-empty.
  function compareDiffers(a, b) {
    const na = a.toLowerCase().replace(/\s+/g, " ").trim();
    const nb = b.toLowerCase().replace(/\s+/g, " ").trim();
    if (!na && !nb) return false;
    return na !== nb;
  }
  // A row differs if its normalized values are not all identical
  // (all-empty counts as equal; empty vs non-empty counts as a difference).
  function compareDiffersMulti(values) {
    const distinct = {};
    values.forEach((v) => { distinct[v.toLowerCase().replace(/\s+/g, " ").trim()] = 1; });
    return Object.keys(distinct).length > 1;
  }

  // Does breed X reference breed Y as similar / a frequent confusion?
  function referencesBreed(x, y) {
    const hay = (x.pedagogy.similar_breeds || []).concat(x.pedagogy.frequent_confusions || []).join(" · ").toLowerCase();
    return hay.indexOf(y.breed_name.toLowerCase()) >= 0;
  }

  function teachingCompareSection(breeds) {
    const box = el("div", { class: "callout pedagogy section-block" });
    box.appendChild(el("div", { class: "callout-title", text: "🎓 Teaching compare — likely confusions & what to observe first" }));

    // Pairwise confusion notes
    const pairs = [];
    for (let i = 0; i < breeds.length; i++) for (let j = i + 1; j < breeds.length; j++) pairs.push([breeds[i], breeds[j]]);
    const confusionWrap = el("div", { style: "margin-bottom:10px" }, [el("h4", { style: "margin:4px 0", text: "Likely confusions" })]);
    let anyConfusion = false;
    pairs.forEach(([x, y]) => {
      const linked = referencesBreed(x, y) || referencesBreed(y, x);
      if (linked) {
        anyConfusion = true;
        confusionWrap.appendChild(el("p", { style: "margin:4px 0" }, [
          el("strong", { text: x.breed_name + " ↔ " + y.breed_name + ": " }),
          el("span", { text: "commonly confused. Separate them by their key markers below." }),
        ]));
      }
    });
    if (!anyConfusion) confusionWrap.appendChild(el("p", { class: "lede", text: "No breeds in this set are recorded as commonly confused with each other." }));
    box.appendChild(confusionWrap);

    // What to observe first — key markers per breed
    const obs = el("div", {}, [el("h4", { style: "margin:8px 0 4px", text: "What to observe first" })]);
    const grid = el("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px" });
    breeds.forEach((b) => {
      const markers = b.pedagogy.key_markers.length ? b.pedagogy.key_markers : ["(no key markers recorded)"];
      grid.appendChild(el("div", { class: "card", style: "padding:10px 12px" }, [
        el("strong", { text: b.breed_name }),
        el("ul", { style: "margin:6px 0 0;padding-left:18px" }, markers.map((m) => el("li", { text: m }))),
      ]));
    });
    obs.appendChild(grid);
    box.appendChild(obs);
    return box;
  }

  /* ---------------------------------------------------------
     QUIZ & EXAM ENGINE
     Questions are generated automatically from the breed dataset,
     so every standard you add to the database immediately becomes
     usable study material — no manual question authoring needed.
     --------------------------------------------------------- */

  // -- small random helpers (app runtime; deterministic quality not required) --
  function rand(n) { return Math.floor(Math.random() * n); }
  function sampleOne(arr) { return arr[rand(arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pickDistinct(arr, n, excludeFn) {
    const pool = shuffle(arr.filter((x) => !excludeFn || !excludeFn(x)));
    return pool.slice(0, n);
  }

  function quizPool() {
    const c = state.quiz.config;
    if (c.scope === "favorites") return state.breeds.filter((b) => isFav(b.id));
    if (c.scope === "group" && c.group) return state.breeds.filter((b) => b.group === c.group);
    if (c.scope === "custom" && Array.isArray(c.customBreedIds)) return state.breeds.filter((b) => c.customBreedIds.indexOf(b.id) >= 0);
    return state.breeds.slice();
  }

  // Each generator returns a question object or null if data is insufficient.
  // Question: { type, prompt, context, options:[{text}], answer:idx, explanation, tag }
  const QUESTION_GENERATORS = {
    identify_by_description(pool) {
      // Descrierea nu are voie să conțină chiar numele rasei — altfel răspunsul e cadou.
      // Un sfert dintre descrieri încep cu „The Australian Shepherd is…", deci le sărim.
      const numeInDesc = (b, d) => {
        const t = (d || "").toLowerCase();
        return [b.breed_name].concat(b.alternate_names || [])
          .some((nume) => nume && nume.length > 3 && t.indexOf(nume.toLowerCase()) >= 0);
      };
      const descrierea = (b) => {
        for (const d of [b.identity.ideal_type_summary, b.identity.general_impression])
          if (isNonEmptyText(d) && !numeInDesc(b, d)) return d;
        return "";
      };
      const cands = pool.filter((b) => descrierea(b));
      if (cands.length < 2) return null;
      const b = sampleOne(cands);
      const desc = descrierea(b);
      const distract = pickDistinct(pool, 3, (x) => x.id === b.id);
      if (distract.length < 1) return null;
      const opts = shuffle([b].concat(distract).map((x) => ({ text: x.breed_name, id: x.id })));
      return {
        type: "single", tag: "Identification",
        prompt: "Which breed does this description best match?",
        context: "“" + desc + "”",
        options: opts, answer: opts.findIndex((o) => o.id === b.id),
        explanation: b.breed_name + " — " + groupShort(b.group) + ", " + (b.country_of_origin || "—") + ".",
      };
    },
    group_of_breed(pool) {
      const groups = uniqueValues("group");
      if (groups.length < 2) return null;
      const b = sampleOne(pool);
      const distract = pickDistinct(groups, 3, (g) => g === b.group);
      const opts = shuffle([b.group].concat(distract).map((g) => ({ text: groupShort(g) + " — " + g.replace(/^Group \d+ /, ""), val: g })));
      return {
        type: "single", tag: "Groups",
        prompt: "To which WDF group does the " + b.breed_name + " belong?",
        options: opts, answer: opts.findIndex((o) => o.val === b.group),
        explanation: b.breed_name + " is classified in " + b.group + ".",
      };
    },
    country_of_breed(pool) {
      const countries = uniqueValues("country_of_origin");
      if (countries.length < 2) return null;
      const b = sampleOne(pool.filter((x) => isNonEmptyText(x.country_of_origin)));
      if (!b) return null;
      // Distractorii NU au voie să fie aceeași țară scrisă altfel („Great Britain" vs.
      // „England" vs. „United Kingdom"): altfel întrebarea ar avea două răspunsuri
      // corecte, iar candidatul care alege bine ar fi informat că a greșit.
      const canonTara = (c) => canonicalCountry(c);
      const distract = pickDistinct(countries, 3, (c) => canonTara(c) === canonTara(b.country_of_origin));
      const opts = shuffle([b.country_of_origin].concat(distract).map((c) => ({ text: c })));
      return {
        type: "single", tag: "Origin",
        prompt: "What is the country of origin of the " + b.breed_name + "?",
        options: opts, answer: opts.findIndex((o) => o.text === b.country_of_origin),
        explanation: b.breed_name + " originates from " + b.country_of_origin + ".",
      };
    },
    fault_category(pool) {
      const withFaults = pool.filter((b) => (b.faults.minor.length + b.faults.serious.length + b.faults.disqualifying.length) > 0);
      if (!withFaults.length) return null;
      const b = sampleOne(withFaults);
      // Un text care apare în DOUĂ niveluri pentru aceeași rasă (ex. „Undershot" și la
      // grave, și la eliminatorii) nu are un răspuns unic — l-am scoate, altfel întrebarea
      // ar marca greșit o alegere corectă. Numărăm în ce niveluri apare fiecare text.
      const niveluri = {};
      const adaugaNivel = (f, t) => { const k = f.toLowerCase().trim(); (niveluri[k] = niveluri[k] || new Set()).add(t); };
      b.faults.minor.forEach((f) => adaugaNivel(f, "Minor fault"));
      b.faults.serious.forEach((f) => adaugaNivel(f, "Serious fault"));
      b.faults.disqualifying.forEach((f) => adaugaNivel(f, "Disqualifying fault"));
      const tiers = [];
      b.faults.minor.forEach((f) => { if (niveluri[f.toLowerCase().trim()].size === 1) tiers.push([f, "Minor fault"]); });
      b.faults.serious.forEach((f) => { if (niveluri[f.toLowerCase().trim()].size === 1) tiers.push([f, "Serious fault"]); });
      b.faults.disqualifying.forEach((f) => { if (niveluri[f.toLowerCase().trim()].size === 1) tiers.push([f, "Disqualifying fault"]); });
      if (!tiers.length) return null;
      const [fault, tier] = sampleOne(tiers);
      const opts = ["Minor fault", "Serious fault", "Disqualifying fault"].map((t) => ({ text: t }));
      return {
        type: "single", tag: "Faults",
        prompt: "For the " + b.breed_name + ", how is the following classified?",
        context: "“" + fault + "”",
        options: opts, answer: opts.findIndex((o) => o.text === tier),
        explanation: "For the " + b.breed_name + " this is a " + tier.toLowerCase() + ".",
      };
    },
    key_marker(pool) {
      const withMarkers = pool.filter((b) => b.pedagogy.key_markers.length > 0);
      if (withMarkers.length < 1) return null;
      const b = sampleOne(withMarkers);
      const correct = sampleOne(b.pedagogy.key_markers);
      const others = [];
      state.breeds.forEach((x) => { if (x.id !== b.id) x.pedagogy.key_markers.forEach((m) => others.push(m)); });
      const distract = pickDistinct(others, 3, (m) => b.pedagogy.key_markers.indexOf(m) >= 0);
      if (distract.length < 2) return null;
      const opts = shuffle([correct].concat(distract).map((m) => ({ text: m })));
      return {
        type: "single", tag: "Recognition",
        prompt: "Which is a key recognition marker for the " + b.breed_name + "?",
        options: opts, answer: opts.findIndex((o) => o.text === correct),
        explanation: "A key marker for the " + b.breed_name + ": " + correct + ".",
      };
    },
    confusion(pool) {
      const withSim = pool.filter((b) => b.pedagogy.similar_breeds.some((n) => state.breeds.find((x) => x.breed_name.toLowerCase() === String(n).toLowerCase())));
      if (!withSim.length) return null;
      const b = sampleOne(withSim);
      const simInDb = b.pedagogy.similar_breeds.map((n) => state.breeds.find((x) => x.breed_name.toLowerCase() === String(n).toLowerCase())).filter(Boolean);
      const correct = sampleOne(simInDb);
      const distract = pickDistinct(state.breeds, 3, (x) => x.id === b.id || simInDb.some((s) => s.id === x.id));
      if (distract.length < 2) return null;
      const opts = shuffle([correct].concat(distract).map((x) => ({ text: x.breed_name, id: x.id })));
      return {
        type: "single", tag: "Confusions",
        prompt: "Which breed is the " + b.breed_name + " most often confused with?",
        options: opts, answer: opts.findIndex((o) => o.id === correct.id),
        explanation: "The " + b.breed_name + " is commonly confused with the " + correct.breed_name + ".",
      };
    },
    true_false_group(pool) {
      const groups = uniqueValues("group");
      if (groups.length < 2) return null;
      const b = sampleOne(pool);
      const askTrue = rand(2) === 0;
      const shownGroup = askTrue ? b.group : sampleOne(groups.filter((g) => g !== b.group));
      const opts = [{ text: "True" }, { text: "False" }];
      const correctIsTrue = shownGroup === b.group;
      return {
        type: "single", tag: "Groups",
        prompt: "True or False: the " + b.breed_name + " belongs to " + groupShort(shownGroup) + " (" + shownGroup.replace(/^Group \d+ /, "") + ").",
        options: opts, answer: correctIsTrue ? 0 : 1,
        explanation: "The " + b.breed_name + " belongs to " + b.group + ".",
      };
    },
  };

  const FOCUS_TYPES = {
    mixed: ["identify_by_description", "group_of_breed", "country_of_breed", "fault_category", "key_marker", "confusion", "true_false_group"],
    identification: ["identify_by_description", "key_marker", "confusion"],
    faults: ["fault_category"],
    groups: ["group_of_breed", "country_of_breed", "true_false_group"],
  };

  function buildQuiz() {
    const c = state.quiz.config;
    const pool = quizPool();
    if (pool.length < 2) return { error: "You need at least 2 breeds in the selected scope to build a quiz." };
    const types = FOCUS_TYPES[c.focus] || FOCUS_TYPES.mixed;
    const questions = [];
    const seen = new Set();
    let attempts = 0;
    const maxAttempts = c.count * 40 + 60;
    while (questions.length < c.count && attempts < maxAttempts) {
      attempts++;
      const type = sampleOne(types);
      const q = QUESTION_GENERATORS[type](pool);
      if (!q) continue;
      const key = q.prompt + "|" + (q.context || "");
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push(q);
    }
    if (!questions.length) return { error: "Not enough data in this scope to generate questions. Add more breed detail (descriptions, faults, markers) or widen the scope." };
    return { questions };
  }

  function startQuiz(mode) {
    const built = buildQuiz();
    if (built.error) { toast(built.error, "err"); return; }
    state.quiz.session = {
      mode: mode || "quiz",
      questions: built.questions,
      index: 0,
      answers: new Array(built.questions.length).fill(null),
      startedAt: Date.now(),
      secondsPerQ: state.quiz.config.timed ? 30 : 0,
      finished: false,
    };
    navigate("quiz");
    if (state.quiz.session.secondsPerQ) startQuestionTimer();
  }

  let quizTimerId = null;
  let quizTimeLeft = 0;
  function startQuestionTimer() {
    stopQuizTimer();
    quizTimeLeft = state.quiz.session.secondsPerQ;
    updateTimerLabel();
    quizTimerId = setInterval(() => {
      quizTimeLeft--;
      updateTimerLabel();
      if (quizTimeLeft <= 0) {
        stopQuizTimer();
        // Auto-lock with no answer if unanswered, then advance.
        const s = state.quiz.session;
        if (s.answers[s.index] == null) s.answers[s.index] = -1;
        render();
      }
    }, 1000);
  }
  function stopQuizTimer() { if (quizTimerId) { clearInterval(quizTimerId); quizTimerId = null; } }
  function updateTimerLabel() {
    const lbl = $("#quizTimer");
    if (lbl) lbl.textContent = "⏱ " + Math.max(0, quizTimeLeft) + "s";
  }

  function answerQuiz(optIdx) {
    const s = state.quiz.session;
    if (s.answers[s.index] != null) return; // already answered
    s.answers[s.index] = optIdx;
    stopQuizTimer();
    render();
  }
  function nextQuestion() {
    const s = state.quiz.session;
    if (s.index < s.questions.length - 1) {
      s.index++;
      render();
      if (s.secondsPerQ) startQuestionTimer();
    } else {
      finishQuiz();
    }
  }
  function finishQuiz() {
    const s = state.quiz.session;
    stopQuizTimer();
    s.finished = true;
    const score = s.answers.reduce((acc, a, i) => acc + (a === s.questions[i].answer ? 1 : 0), 0);
    const record = {
      date: todayISO(),
      ts: Date.now(),
      mode: s.mode,
      scope: state.quiz.config.scope + (state.quiz.config.scope === "group" ? " (" + groupShort(state.quiz.config.group) + ")" : ""),
      focus: state.quiz.config.focus,
      total: s.questions.length,
      score: score,
      timed: !!s.secondsPerQ,
    };
    state.quiz.history = [record].concat(state.quiz.history).slice(0, 50);
    store.set(STORAGE_KEYS.quizHistory, state.quiz.history);
    render();
  }

  function renderQuiz() {
    const s = state.quiz.session;
    if (state.quiz.flash) return renderFlashcards();
    if (s && !s.finished) return renderQuizRunner();
    if (s && s.finished) return renderQuizResults();
    return renderQuizHome();
  }

  function renderQuizHome() {
    const wrap = el("div", { class: "view" });
    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [
        el("h1", { text: "Quiz & Exam" }),
        el("p", { class: "lede", text: "Self-assessment generated automatically from the breed database. Every standard you add becomes new quiz material." }),
      ]),
    ]));

    if (state.breeds.length < 2) {
      wrap.appendChild(emptyState("◎", "Add at least 2 breeds to the database to start a quiz."));
      return wrap;
    }

    const c = state.quiz.config;
    const setup = el("div", { class: "panel card" }, [
      el("div", { class: "panel-title" }, [el("h2", { text: "Set up a quiz" })]),
      el("div", { class: "filters", style: "margin-bottom:14px" }, [
        labeledSelect("Scope", "quizScope", [["all", "All breeds"], ["group", "By group"], ["favorites", "Favorites only"]], c.scope, (v) => { c.scope = v; render(); }),
        c.scope === "group"
          ? labeledSelect("Group", "quizGroup", uniqueValues("group").map((g) => [g, groupShort(g)]), c.group || (uniqueValues("group")[0] || ""), (v) => { c.group = v; })
          : null,
        labeledSelect("Focus", "quizFocus", [["mixed", "Mixed"], ["identification", "Identification"], ["faults", "Faults"], ["groups", "Groups & origin"]], c.focus, (v) => { c.focus = v; }),
        labeledSelect("Questions", "quizCount", [["5", "5"], ["10", "10"], ["15", "15"], ["20", "20"]], String(c.count), (v) => { c.count = parseInt(v, 10); }),
        labeledSelect("Timer", "quizTimed", [["no", "Off"], ["yes", "30s / question"]], c.timed ? "yes" : "no", (v) => { c.timed = v === "yes"; }),
      ]),
      el("div", { style: "display:flex;gap:10px;flex-wrap:wrap" }, [
        el("button", { class: "btn btn-primary", onclick: () => startQuiz("quiz") }, "▶ Start quiz"),
        el("button", { class: "btn", onclick: () => { state.quiz.config.count = 20; state.quiz.config.focus = "mixed"; state.quiz.config.timed = true; startQuiz("exam"); } }, "🎓 Exam mode (20, timed)"),
        el("button", { class: "btn", onclick: startFlashcards }, "🃏 Flashcards"),
        el("button", { class: "btn", onclick: exportPrintableExam, title: "Generate a printable exam from the current settings and export it to Word" }, "📄 Printable exam (Word)"),
      ]),
    ]);
    wrap.appendChild(setup);

    // History
    const hist = el("div", { class: "panel card", style: "margin-top:16px" }, [
      el("div", { class: "panel-title" }, [
        el("h3", { text: "Session history" }),
        state.quiz.history.length ? el("button", { class: "btn btn-sm btn-ghost", onclick: clearQuizHistory }, "Clear history") : null,
      ]),
    ]);
    if (!state.quiz.history.length) {
      hist.appendChild(emptyState("📊", "No quiz sessions yet. Your scores will appear here."));
    } else {
      const table = el("table", { class: "admin-table" }, [
        el("thead", {}, el("tr", {}, [
          el("th", { text: "Date" }), el("th", { text: "Mode" }), el("th", { text: "Scope" }),
          el("th", { text: "Focus" }), el("th", { text: "Score" }),
        ])),
      ]);
      const tb = el("tbody");
      state.quiz.history.forEach((h) => {
        const pct = Math.round((h.score / h.total) * 100);
        tb.appendChild(el("tr", {}, [
          el("td", { text: h.date }),
          el("td", { text: cap(h.mode) + (h.timed ? " · timed" : "") }),
          el("td", { text: cap(h.scope) }),
          el("td", { text: cap(h.focus) }),
          el("td", {}, el("strong", { text: h.score + " / " + h.total + " (" + pct + "%)" })),
        ]));
      });
      table.appendChild(tb);
      hist.appendChild(table);
    }
    wrap.appendChild(hist);
    return wrap;
  }

  function labeledSelect(label, id, options, value, onChange) {
    return el("div", { class: "field" }, [el("label", { for: id, text: label }), selectControl(id, options, value, onChange)]);
  }

  function renderQuizRunner() {
    const s = state.quiz.session;
    const q = s.questions[s.index];
    const answered = s.answers[s.index] != null;
    const wrap = el("div", { class: "view" });

    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [
        el("h1", { text: (s.mode === "exam" ? "Exam" : "Quiz") + " · Question " + (s.index + 1) + " of " + s.questions.length }),
      ]),
      el("div", { style: "display:flex;gap:10px;align-items:center" }, [
        s.secondsPerQ && !answered ? el("span", { id: "quizTimer", class: "badge badge-status provisional", text: "⏱ " + s.secondsPerQ + "s" }) : null,
        el("button", { class: "btn btn-sm btn-ghost", onclick: quitQuiz }, "Quit"),
      ]),
    ]));

    // progress bar
    const pct = Math.round((s.index / s.questions.length) * 100);
    wrap.appendChild(el("div", { class: "quiz-progress" }, el("div", { class: "quiz-progress-bar", style: "width:" + pct + "%" })));

    const card = el("div", { class: "panel card quiz-card" });
    card.appendChild(el("span", { class: "badge badge-ped", text: q.tag }));
    card.appendChild(el("h2", { class: "quiz-prompt", text: q.prompt }));
    if (q.context) card.appendChild(el("blockquote", { class: "quiz-context", text: q.context }));

    const opts = el("div", { class: "quiz-options" });
    q.options.forEach((o, i) => {
      let cls = "quiz-option";
      if (answered) {
        if (i === q.answer) cls += " correct";
        else if (i === s.answers[s.index]) cls += " wrong";
        else cls += " dim";
      }
      opts.appendChild(el("button", {
        class: cls, disabled: answered ? "" : null,
        onclick: () => answerQuiz(i),
      }, [
        el("span", { class: "quiz-opt-letter", text: String.fromCharCode(65 + i) }),
        el("span", { text: o.text }),
        answered && i === q.answer ? el("span", { class: "quiz-opt-mark", text: "✓" }) : null,
        answered && i === s.answers[s.index] && i !== q.answer ? el("span", { class: "quiz-opt-mark", text: "✗" }) : null,
      ]));
    });
    card.appendChild(opts);

    if (answered) {
      const correct = s.answers[s.index] === q.answer;
      const timedOut = s.answers[s.index] === -1;
      card.appendChild(el("div", { class: "quiz-explain " + (correct ? "ok" : "no") }, [
        el("strong", { text: timedOut ? "⏱ Time out. " : (correct ? "✓ Correct. " : "✗ Not quite. ") }),
        el("span", { text: q.explanation }),
      ]));
      card.appendChild(el("button", { class: "btn btn-primary", style: "margin-top:14px", onclick: nextQuestion },
        s.index < s.questions.length - 1 ? "Next question →" : "See results →"));
    }

    wrap.appendChild(card);
    return wrap;
  }

  function renderQuizResults() {
    const s = state.quiz.session;
    const score = s.answers.reduce((acc, a, i) => acc + (a === s.questions[i].answer ? 1 : 0), 0);
    const pct = Math.round((score / s.questions.length) * 100);
    const wrap = el("div", { class: "view" });
    wrap.appendChild(el("div", { class: "page-head" }, [el("div", {}, [el("h1", { text: "Results" })])]));

    const verdict = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Keep practising" : "Needs review";
    wrap.appendChild(el("div", { class: "panel card quiz-score-card" }, [
      el("div", { class: "quiz-score-big", text: score + " / " + s.questions.length }),
      el("div", { class: "quiz-score-pct", text: pct + "% · " + verdict }),
      el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;justify-content:center" }, [
        el("button", { class: "btn btn-primary", onclick: () => startQuiz(s.mode) }, "↻ New quiz (same settings)"),
        el("button", { class: "btn", onclick: () => { state.quiz.session = null; navigate("quiz"); } }, "⚙ Change settings"),
        el("button", { class: "btn", onclick: () => exportQuizWord(s) }, "⬇ Export (Word)"),
      ]),
    ]));

    const wrong = s.questions.map((q, i) => ({ q, i })).filter(({ q, i }) => s.answers[i] !== q.answer);
    wrap.appendChild(el("h2", { text: "Review" + (wrong.length ? " · " + wrong.length + " to revisit" : " · all correct 🎉") }));

    s.questions.forEach((q, i) => {
      const yourIdx = s.answers[i];
      const correct = yourIdx === q.answer;
      const item = el("div", { class: "quiz-review-item " + (correct ? "ok" : "no") });
      item.appendChild(el("div", { class: "quiz-review-head" }, [
        el("span", { class: "badge badge-ped", text: q.tag }),
        el("strong", { text: (correct ? "✓ " : "✗ ") + q.prompt }),
      ]));
      if (q.context) item.appendChild(el("blockquote", { class: "quiz-context", text: q.context }));
      item.appendChild(el("div", { class: "quiz-review-ans" }, [
        el("div", {}, [el("span", { class: "muted", text: "Your answer: " }), el("span", { text: yourIdx === -1 || yourIdx == null ? "(no answer)" : q.options[yourIdx].text })]),
        !correct ? el("div", {}, [el("span", { class: "muted", text: "Correct: " }), el("strong", { text: q.options[q.answer].text })]) : null,
        el("div", { class: "muted", text: q.explanation }),
      ]));
      wrap.appendChild(item);
    });
    return wrap;
  }

  function quitQuiz() {
    stopQuizTimer();
    openModal({
      title: "Quit quiz", body: "Your progress in this quiz will be discarded. History is only saved for completed quizzes.",
      confirmLabel: "Quit", danger: true,
      onConfirm: () => { state.quiz.session = null; navigate("quiz"); },
    });
  }
  function clearQuizHistory() {
    openModal({
      title: "Clear history", body: "Remove all saved quiz results from this browser?",
      confirmLabel: "Clear", danger: true,
      onConfirm: () => { state.quiz.history = []; store.set(STORAGE_KEYS.quizHistory, []); render(); toast("History cleared.", "ok"); },
    });
  }

  // -- Flashcards --
  function startFlashcards() {
    const pool = quizPool();
    if (pool.length < 1) { toast("No breeds in the selected scope.", "err"); return; }
    state.quiz.flash = { pool: shuffle(pool), index: 0, flipped: false };
    navigate("quiz");
  }
  function renderFlashcards() {
    const f = state.quiz.flash;
    const b = f.pool[f.index];
    const wrap = el("div", { class: "view" });
    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [el("h1", { text: "Flashcards · " + (f.index + 1) + " of " + f.pool.length })]),
      el("button", { class: "btn btn-sm btn-ghost", onclick: () => { state.quiz.flash = null; navigate("quiz"); } }, "Close"),
    ]));

    const card = el("div", { class: "flashcard", role: "button", tabindex: "0",
      onclick: () => { f.flipped = !f.flipped; render(); },
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f.flipped = !f.flipped; render(); } },
    });
    if (!f.flipped) {
      card.appendChild(el("div", { class: "flash-face" }, [
        el("div", { class: "flash-hint", text: "Breed" }),
        el("h2", { class: "flash-name", text: b.breed_name }),
        el("div", { class: "flash-tap", text: "Tap to reveal key markers ▸" }),
      ]));
    } else {
      const markers = b.pedagogy.key_markers.length ? b.pedagogy.key_markers : ["(no key markers recorded)"];
      card.appendChild(el("div", { class: "flash-face" }, [
        el("div", { class: "flash-hint", text: b.breed_name }),
        el("div", { class: "tag-list", style: "justify-content:center;margin:8px 0" }, [
          el("span", { class: "badge badge-group", text: groupShort(b.group) }),
          el("span", { class: "badge badge-coat", text: b.country_of_origin || "—" }),
        ]),
        el("ul", { style: "text-align:left;max-width:440px;margin:10px auto" }, markers.map((m) => el("li", { text: m }))),
        b.identity.ideal_type_summary ? el("p", { class: "muted", style: "max-width:460px;margin:6px auto", text: b.identity.ideal_type_summary }) : null,
      ]));
    }
    wrap.appendChild(card);

    wrap.appendChild(el("div", { style: "display:flex;gap:10px;justify-content:center;margin-top:16px" }, [
      el("button", { class: "btn", onclick: () => { f.index = (f.index - 1 + f.pool.length) % f.pool.length; f.flipped = false; render(); } }, "← Prev"),
      el("button", { class: "btn", onclick: () => { f.flipped = !f.flipped; render(); } }, "Flip"),
      el("button", { class: "btn", onclick: () => { f.index = (f.index + 1) % f.pool.length; f.flipped = false; render(); } }, "Next →"),
      el("button", { class: "btn btn-ghost", onclick: () => { state.quiz.flash.pool = shuffle(f.pool); f.index = 0; f.flipped = false; render(); } }, "🔀 Shuffle"),
    ]));
    return wrap;
  }

  /* ---------------------------------------------------------
     CURRICULUM & LESSONS
     Lessons link to breeds and WDF groups, carry objectives and
     reading, generate tests from their linked breeds, track progress,
     and export to Word (lesson, course pack, revision pack).
     --------------------------------------------------------- */

  function lessonProgress(id) { return state.lessonProgress[id] || "not_started"; }
  function setLessonProgress(id, status) {
    if (status === "not_started") delete state.lessonProgress[id];
    else state.lessonProgress[id] = status;
    store.set(STORAGE_KEYS.lessonProgress, state.lessonProgress);
  }
  function progressLabel(s) { return { not_started: "Not started", in_progress: "In progress", done: "Completed" }[s] || s; }

  // Effective breed set for a lesson: explicit linked breeds ∪ breeds in linked groups.
  function lessonBreedIds(lesson) {
    const ids = new Set(lesson.linked_breeds || []);
    (lesson.linked_groups || []).forEach((g) => state.breeds.filter((b) => b.group === g).forEach((b) => ids.add(b.id)));
    return Array.from(ids).filter((id) => getBreed(id));
  }

  function renderCurriculum() {
    const wrap = el("div", { class: "view" });
    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [el("h1", { text: "Curriculum" }), el("p", { class: "lede", text: "Lessons organised into modules, linked to breeds and WDF groups, with objectives, tests, and Word course packs." })]),
      el("button", { class: "btn btn-primary", onclick: startNewLesson }, "＋ Add lesson"),
    ]));

    if (!state.lessons.length) {
      wrap.appendChild(emptyState("▤", "No lessons yet. Create your first lesson, or import a dataset that includes lessons."));
      return wrap;
    }

    // Progress summary
    const done = state.lessons.filter((l) => lessonProgress(l.id) === "done").length;
    const inProg = state.lessons.filter((l) => lessonProgress(l.id) === "in_progress").length;
    wrap.appendChild(el("div", { class: "grid grid-stats", style: "margin-bottom:16px" }, [
      statCard(state.lessons.length, "Lessons"),
      statCard(new Set(state.lessons.map((l) => l.module).filter(Boolean)).size || "—", "Modules"),
      statCard(done, "Completed"),
      statCard(inProg, "In progress"),
    ]));

    // Group lessons by module
    const modules = {};
    state.lessons.forEach((l) => { const m = l.module || "Unassigned"; (modules[m] = modules[m] || []).push(l); });
    Object.keys(modules).sort().forEach((m) => {
      const lessons = modules[m];
      const panel = el("div", { class: "panel card", style: "margin-bottom:16px" });
      panel.appendChild(el("div", { class: "panel-title" }, [
        el("h2", { text: m }),
        el("div", { style: "display:flex;gap:8px" }, [
          el("button", { class: "btn btn-sm", title: "Export all lessons in this module + linked breed summaries", onclick: () => exportCoursePack(m) }, "⬇ Course pack"),
          el("button", { class: "btn btn-sm", title: "Export revision sheets for all breeds in this module", onclick: () => exportRevisionPack(m) }, "⬇ Revision pack"),
        ]),
      ]));
      const ul = el("div", { class: "lesson-list" });
      lessons.forEach((l) => ul.appendChild(lessonRow(l)));
      panel.appendChild(ul);
      wrap.appendChild(panel);
    });
    return wrap;
  }

  function lessonRow(l) {
    const status = lessonProgress(l.id);
    const breedCount = lessonBreedIds(l).length;
    return el("div", { class: "lesson-row" }, [
      el("button", { class: "lesson-row-main", onclick: () => navigate("lesson", { lessonId: l.id }) }, [
        el("div", { class: "lesson-row-title" }, [
          el("span", { text: l.title || "(untitled lesson)" }),
          el("span", { class: "badge badge-progress " + status, text: progressLabel(status) }),
        ]),
        el("div", { class: "lesson-row-meta", text:
          (l.learning_objectives.length ? l.learning_objectives.length + " objectives · " : "") +
          breedCount + " breeds" + (l.linked_groups.length ? " · " + l.linked_groups.length + " groups" : "") }),
      ]),
      el("div", { class: "lesson-row-actions" }, [
        breedCount >= 2 ? el("button", { class: "btn btn-sm", onclick: () => startLessonTest(l) }, "◎ Test") : null,
        el("button", { class: "btn btn-sm", onclick: () => startEditLesson(l.id) }, "✎ Edit"),
      ]),
    ]);
  }

  function renderLesson() {
    const l = getLesson(state.currentLessonId);
    const wrap = el("div", { class: "view" });
    if (!l) { wrap.appendChild(emptyState("∅", "Lesson not found.")); return wrap; }
    const breeds = lessonBreedIds(l).map(getBreed).filter(Boolean);
    const status = lessonProgress(l.id);

    wrap.appendChild(el("div", { class: "print-header" }, [el("strong", { text: "CFCR Curriculum — " }), el("span", { text: l.title })]));

    wrap.appendChild(el("div", { class: "profile-head" }, [
      el("div", { class: "profile-title" }, [
        l.module ? el("div", { class: "brand-sub", style: "margin-bottom:4px", text: l.module }) : null,
        el("h1", { text: l.title || "(untitled lesson)" }),
        el("div", { class: "profile-badges" }, [
          el("span", { class: "badge badge-progress " + status, text: progressLabel(status) }),
          el("span", { class: "badge badge-group", text: breeds.length + " breeds" }),
        ]),
      ]),
      el("div", { class: "profile-actions" }, [
        breeds.length >= 2 ? el("button", { class: "btn btn-sm btn-primary", onclick: () => startLessonTest(l) }, "◎ Take test") : null,
        el("button", { class: "btn btn-sm", onclick: () => cycleLessonProgress(l.id) }, "◔ " + progressLabel(status)),
        el("button", { class: "btn btn-sm", onclick: () => startEditLesson(l.id) }, "✎ Edit"),
        el("button", { class: "btn btn-sm", onclick: () => exportLessonWord(l) }, "⬇ Word"),
        el("button", { class: "btn btn-sm btn-danger", onclick: () => confirmDeleteLesson(l.id) }, "Delete"),
      ]),
    ]));

    if (isNonEmptyText(l.summary)) wrap.appendChild(el("p", { class: "lede", text: l.summary }));

    if (l.learning_objectives.length) {
      wrap.appendChild(el("div", { class: "callout official section-block" }, [
        el("div", { class: "callout-title", text: "◎ Learning objectives" }),
        el("ul", {}, l.learning_objectives.map((o) => el("li", { text: o }))),
      ]));
    }

    if (isNonEmptyText(l.body)) {
      wrap.appendChild(el("div", { class: "section-block" }, [
        el("h2", { text: "Lesson notes" }),
        el("div", { class: "lesson-body" }, paragraphs(l.body)),
      ]));
    }

    // Linked breeds
    const linked = el("div", { class: "section-block" }, [el("h2", { text: "Breeds in this lesson" })]);
    if (!breeds.length) linked.appendChild(el("p", { class: "lede", text: "No breeds linked yet. Edit the lesson to link breeds or groups." }));
    else {
      const grid = el("div", { class: "chip-row" });
      breeds.forEach((b) => grid.appendChild(el("button", { class: "chip", onclick: () => navigate("profile", { id: b.id }) }, b.breed_name + " · " + groupShort(b.group) + " ↗")));
      linked.appendChild(grid);
    }
    wrap.appendChild(linked);

    if (l.recommended_reading.length) {
      wrap.appendChild(el("div", { class: "callout pedagogy section-block" }, [
        el("div", { class: "callout-title", text: "❖ Recommended reading" }),
        el("ul", {}, l.recommended_reading.map((r) => el("li", { text: r }))),
      ]));
    }
    return wrap;
  }

  function paragraphs(text) {
    return String(text).split(/\n{2,}/).map((p) => el("p", { text: p.trim() })).filter((p) => p.textContent);
  }

  function cycleLessonProgress(id) {
    const order = ["not_started", "in_progress", "done"];
    const next = order[(order.indexOf(lessonProgress(id)) + 1) % order.length];
    setLessonProgress(id, next);
    render();
    toast("Marked as " + progressLabel(next) + ".", "ok");
  }

  function startLessonTest(l) {
    const ids = lessonBreedIds(l);
    if (ids.length < 2) { toast("Link at least 2 breeds to this lesson to generate a test.", "err"); return; }
    state.quiz.config.scope = "custom";
    state.quiz.config.customBreedIds = ids;
    state.quiz.config.focus = l.quiz_focus || "mixed";
    state.quiz.config.count = Math.min(10, Math.max(5, ids.length));
    state.quiz.session = null;
    startQuiz("quiz");
  }

  // -- Lesson editor --
  function startNewLesson() {
    const l = normalizeLesson(emptyLesson());
    l.id = genLessonId();
    l.last_updated = todayISO();
    state.editingLesson = { lesson: l, isNew: true, errors: {} };
    navigate("lessonEditor");
  }
  function startEditLesson(id) {
    const src = getLesson(id);
    if (!src) return;
    state.editingLesson = { lesson: JSON.parse(JSON.stringify(src)), isNew: false, errors: {} };
    navigate("lessonEditor");
  }

  function renderLessonEditor() {
    const ed = state.editingLesson;
    const l = ed.lesson;
    const wrap = el("div", { class: "view" });
    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [el("h1", { text: ed.isNew ? "Add Lesson" : "Edit lesson" }), el("p", { class: "lede", text: "Link breeds and groups; the test is generated from them. Multi-value fields accept one item per line." })]),
    ]));

    const form = el("form", { id: "lessonForm", onsubmit: (e) => { e.preventDefault(); saveLesson(); } });

    form.appendChild(fieldset("Lesson", [
      lessonTextField("title", "Title *", l.title, ed.errors.title),
      lessonTextField("module", "Module (grouping)", l.module),
      lessonTextareaField("summary", "Summary", l.summary, 2),
      lessonSelectField("quiz_focus", "Default test focus", [["mixed", "Mixed"], ["identification", "Identification"], ["faults", "Faults"], ["groups", "Groups & origin"]], l.quiz_focus),
      lessonTextareaField("learning_objectives", "Learning objectives (one per line)", (l.learning_objectives || []).join("\n"), 3),
      lessonTextareaField("body", "Lesson notes (blank line = new paragraph)", l.body, 6),
      lessonTextareaField("recommended_reading", "Recommended reading (one per line)", (l.recommended_reading || []).join("\n"), 3),
    ]));

    // Linked breeds (checkbox list)
    const breedBox = el("div", { class: "link-picker" });
    state.breeds.slice().sort((a, b) => a.breed_name.localeCompare(b.breed_name)).forEach((b) => {
      const id = "lb-" + b.id;
      breedBox.appendChild(el("label", { class: "link-item", for: id }, [
        el("input", { type: "checkbox", id: id, value: b.id, checked: l.linked_breeds.indexOf(b.id) >= 0 ? "" : null, "data-linkbreed": "1" }),
        el("span", { text: b.breed_name + " · " + groupShort(b.group) }),
      ]));
    });
    const groupBox = el("div", { class: "link-picker" });
    uniqueValues("group").forEach((g) => {
      const id = "lg-" + g.replace(/\W+/g, "-");
      groupBox.appendChild(el("label", { class: "link-item", for: id }, [
        el("input", { type: "checkbox", id: id, value: g, checked: l.linked_groups.indexOf(g) >= 0 ? "" : null, "data-linkgroup": "1" }),
        el("span", { text: groupShort(g) + " — " + g.replace(/^Group \d+ /, "") }),
      ]));
    });
    const fs = el("fieldset", { class: "form-section" }, [
      el("legend", { text: "Linked breeds & groups" }),
      el("p", { class: "hint", style: "margin:0 0 8px", text: "The lesson's test draws from the linked breeds plus all breeds in any linked group." }),
      el("div", { class: "form-grid" }, [
        el("div", { class: "form-field full" }, [el("label", { text: "Breeds" }), breedBox]),
        el("div", { class: "form-field full" }, [el("label", { text: "Groups" }), groupBox]),
      ]),
    ]);
    form.appendChild(fs);

    form.appendChild(el("div", { class: "form-actions" }, [
      el("button", { type: "submit", class: "btn btn-primary" }, ed.isNew ? "Add lesson" : "Save changes"),
      el("button", { type: "button", class: "btn", onclick: () => { state.editingLesson = null; navigate(ed.isNew ? "curriculum" : "lesson", { lessonId: l.id }); } }, "Cancel"),
      ed.isNew ? null : el("button", { type: "button", class: "btn btn-danger", onclick: () => confirmDeleteLesson(l.id) }, "Delete lesson"),
    ]));

    wrap.appendChild(form);
    return wrap;
  }
  function lessonTextField(name, label, value, error) {
    const id = "lf-" + name;
    return el("div", { class: "form-field full" + (error ? " invalid" : "") }, [
      el("label", { for: id, text: label }), el("input", { id: id, name: name, type: "text", value: value || "" }),
      error ? el("span", { class: "field-error", text: error }) : null,
    ]);
  }
  function lessonTextareaField(name, label, value, rows) {
    const id = "lf-" + name;
    return el("div", { class: "form-field full" }, [el("label", { for: id, text: label }), el("textarea", { id: id, name: name, rows: String(rows || 3) }, value || "")]);
  }
  function lessonSelectField(name, label, options, value) {
    const id = "lf-" + name;
    const sel = el("select", { id: id, name: name });
    options.forEach(([v, t]) => { const o = el("option", { value: v, text: t }); if (v === value) o.selected = true; sel.appendChild(o); });
    return el("div", { class: "form-field" }, [el("label", { for: id, text: label }), sel]);
  }

  function saveLesson() {
    const form = $("#lessonForm");
    const l = JSON.parse(JSON.stringify(state.editingLesson.lesson));
    const linesOf = (v) => v.split("\n").map((s) => s.trim()).filter(Boolean);
    l.title = $("#lf-title", form).value.trim();
    l.module = $("#lf-module", form).value.trim();
    l.summary = $("#lf-summary", form).value.trim();
    l.quiz_focus = $("#lf-quiz_focus", form).value;
    l.learning_objectives = linesOf($("#lf-learning_objectives", form).value);
    l.body = $("#lf-body", form).value.trim();
    l.recommended_reading = linesOf($("#lf-recommended_reading", form).value);
    l.linked_breeds = $$('input[data-linkbreed]:checked', form).map((c) => c.value);
    l.linked_groups = $$('input[data-linkgroup]:checked', form).map((c) => c.value);
    l.last_updated = todayISO();

    if (!l.title) {
      state.editingLesson.lesson = l;
      state.editingLesson.errors = { title: "Title is required." };
      render();
      const f = $(".form-field.invalid input"); if (f) f.focus();
      toast("Lesson title is required.", "err");
      return;
    }
    const idx = state.lessons.findIndex((x) => x.id === l.id);
    if (idx >= 0) state.lessons[idx] = normalizeLesson(l);
    else state.lessons.push(normalizeLesson(l));
    const wasNew = state.editingLesson.isNew;
    state.editingLesson = null;
    navigate("lesson", { lessonId: l.id });
    toast(wasNew ? "Lesson added." : "Lesson saved.", "ok");
  }

  function confirmDeleteLesson(id) {
    const l = getLesson(id);
    if (!l) return;
    openModal({
      title: "Delete lesson", body: 'Remove "' + (l.title || "this lesson") + '" from the current session? Export JSON first to keep a copy.',
      confirmLabel: "Delete", danger: true,
      onConfirm: () => {
        state.lessons = state.lessons.filter((x) => x.id !== id);
        delete state.lessonProgress[id]; store.set(STORAGE_KEYS.lessonProgress, state.lessonProgress);
        state.editingLesson = null; state.currentLessonId = null;
        navigate("curriculum");
        toast("Lesson deleted.", "ok");
      },
    });
  }

  // -- Lesson / curriculum Word exports --
  function wordDocLesson(l) {
    const breeds = lessonBreedIds(l).map(getBreed).filter(Boolean);
    let s = "<h1>" + esc(l.title) + "</h1>";
    if (l.module) s += '<p class="sub">Module: ' + esc(l.module) + "</p>";
    if (isNonEmptyText(l.summary)) s += "<p>" + esc(l.summary) + "</p>";
    if (l.learning_objectives.length) s += wList("Learning objectives", l.learning_objectives);
    if (isNonEmptyText(l.body)) { s += "<h2>Lesson notes</h2>"; String(l.body).split(/\n{2,}/).forEach((p) => { if (p.trim()) s += "<p>" + esc(p.trim()) + "</p>"; }); }
    s += "<h2>Breeds in this lesson</h2>";
    if (!breeds.length) s += "<p>—</p>";
    else { s += "<ul>"; breeds.forEach((b) => { s += "<li><strong>" + esc(b.breed_name) + "</strong> — " + esc(groupShort(b.group)) + ", " + esc(b.country_of_origin || "—") + (b.identity.ideal_type_summary ? ": " + esc(b.identity.ideal_type_summary) : "") + "</li>"; }); s += "</ul>"; }
    if (l.recommended_reading.length) s += wList("Recommended reading", l.recommended_reading);
    s += '<p class="disc">Generated by CFCR Breed Standards Explorer (WDF framework) on ' + todayISO() + ".</p>";
    return s;
  }
  function exportLessonWord(l) { exportWord(slugify(l.title) + "-lesson.doc", l.title + " — lesson", wordDocLesson(l)); }

  function exportCoursePack(moduleName) {
    const lessons = state.lessons.filter((l) => (l.module || "Unassigned") === moduleName);
    if (!lessons.length) { toast("No lessons in this module.", "err"); return; }
    let s = "<h1>Course pack — " + esc(moduleName) + "</h1>";
    s += '<p class="sub">' + lessons.length + " lesson(s) · " + todayISO() + "</p>";
    lessons.forEach((l, i) => { s += (i ? '<div style="page-break-before:always;"></div>' : "") + wordDocLesson(l); });
    exportWord(slugify(moduleName) + "-course-pack.doc", moduleName + " — course pack", s);
  }
  function exportRevisionPack(moduleName) {
    const lessons = state.lessons.filter((l) => (l.module || "Unassigned") === moduleName);
    const ids = new Set();
    lessons.forEach((l) => lessonBreedIds(l).forEach((id) => ids.add(id)));
    const breeds = Array.from(ids).map(getBreed).filter(Boolean);
    if (!breeds.length) { toast("No breeds linked in this module.", "err"); return; }
    let s = "<h1>Revision pack — " + esc(moduleName) + "</h1>";
    s += '<p class="sub">' + breeds.length + " breed(s) · " + todayISO() + "</p>";
    breeds.forEach((b, i) => { s += (i ? '<div style="page-break-before:always;"></div>' : "") + wordDocRevisionSheet(b); });
    exportWord(slugify(moduleName) + "-revision-pack.doc", moduleName + " — revision pack", s);
  }

  /* ---------------------------------------------------------
     RENDER — Admin list
     --------------------------------------------------------- */
  function renderAdminList() {
    const wrap = el("div", { class: "view" });
    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [el("h1", { text: "Admin / Edit Mode" }), el("p", { class: "lede", text: "Add, edit, or delete breed records. Changes are held in memory for this session — export JSON to persist them." })]),
      el("button", { class: "btn btn-primary", onclick: startNewBreed }, "＋ Add new breed"),
    ]));

    wrap.appendChild(el("div", { class: "dataset-note no-print", html: "<strong>Session persistence:</strong> edits live in memory only. Use <em>Export JSON</em> (top bar) to save your canonical file, and <em>Import JSON</em> to load it back later." }));

    if (!state.breeds.length) {
      wrap.appendChild(emptyState("✎", "No breeds yet. Add one or import a JSON dataset."));
      return wrap;
    }

    const table = el("table", { class: "admin-table" }, [
      el("thead", {}, el("tr", {}, [
        el("th", { text: "Breed" }), el("th", { text: "Group" }), el("th", { text: "Status" }),
        el("th", { text: "Ver." }), el("th", { text: "Updated" }), el("th", { text: "Actions" }),
      ])),
    ]);
    const tbody = el("tbody");
    state.breeds.slice().sort((a, b) => a.breed_name.localeCompare(b.breed_name)).forEach((b) => {
      tbody.appendChild(el("tr", {}, [
        el("td", {}, [el("strong", { text: b.breed_name }), b.alternate_names.length ? el("div", { class: "alt-names", text: fmtList(b.alternate_names) }) : null]),
        el("td", {}, el("span", { class: "badge badge-group", text: groupShort(b.group) })),
        el("td", {}, el("span", { class: "badge badge-status " + b.wdf_status, text: statusLabel(b.wdf_status) })),
        el("td", { text: "v" + (b.version || 1) }),
        el("td", { text: b.last_updated || "—" }),
        el("td", {}, el("div", { class: "admin-actions" }, [
          el("button", { class: "btn btn-sm", onclick: () => navigate("profile", { id: b.id }) }, "View"),
          el("button", { class: "btn btn-sm", onclick: () => startEditBreed(b.id) }, "Edit"),
          el("button", { class: "btn btn-sm", onclick: () => duplicateBreed(b.id) }, "Duplicate"),
          el("button", { class: "btn btn-sm btn-danger", onclick: () => confirmDelete(b.id) }, "Delete"),
        ])),
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  /* ---------------------------------------------------------
     RENDER — Editor (add / edit breed)
     --------------------------------------------------------- */
  function startNewBreed() {
    const b = emptyBreed();
    b.id = genId();
    b.last_updated = todayISO();
    state.editing = { breed: b, isNew: true, errors: {} };
    navigate("editor");
  }
  function startEditBreed(id) {
    const src = getBreed(id);
    if (!src) return;
    state.editing = { breed: JSON.parse(JSON.stringify(src)), isNew: false, errors: {} };
    navigate("editor");
  }
  function duplicateBreed(id) {
    const src = getBreed(id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = genId();
    copy.breed_name = src.breed_name + " (copy)";
    copy.last_updated = todayISO();
    copy.version = 1;            // a duplicate starts its own version history
    copy.revision_history = [];
    state.editing = { breed: copy, isNew: true, errors: {} };
    navigate("editor");
    toast("Editing a duplicate. Save to add it.", "ok");
  }

  function renderEditor() {
    const ed = state.editing;
    const b = ed.breed;
    const errs = ed.errors;
    const wrap = el("div", { class: "view" });
    wrap.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [
        el("h1", { text: ed.isNew ? "Add New Breed" : "Edit: " + (b.breed_name || "Breed") }),
        el("p", { class: "lede", text: "Fields marked * are required. Multi-value fields accept one item per line." }),
      ]),
    ]));

    const form = el("form", { id: "breedForm", novalidate: "", onsubmit: (e) => { e.preventDefault(); saveEditor(); } });

    // --- Identity & classification
    form.appendChild(fieldset("Identity & classification", [
      textField("breed_name", "Breed name *", b.breed_name, errs.breed_name),
      textField("identity.official_name", "Official name", b.identity.official_name),
      textareaField("alternate_names", "Alternate names (one per line)", (b.alternate_names || []).join("\n"), null, 2),
      selectField("group", "WDF group *", optiuniCu(WDF_GROUPS, "group", b.group), b.group, errs.group, true),
      textField("country_of_origin", "Country of origin *", b.country_of_origin, errs.country_of_origin),
      textField("identity.owner_country", "Owner country", b.identity.owner_country),
      selectField("wdf_status", "WDF status *", optiuniCu(WDF_STATUSES, "wdf_status", b.wdf_status, statusLabel), b.wdf_status, errs.wdf_status),
      selectField("coat_type", "Coat type", optiuniCu(COAT_TYPES, "coat_type", b.coat_type, cap), b.coat_type),
      selectField("functional_type", "Functional type", optiuniCu(FUNCTIONAL_TYPES, "functional_type", b.functional_type, cap), b.functional_type),
      textField("source_standard_title", "Source standard title", b.source_standard_title),
      textField("source_standard_url", "Source standard URL", b.source_standard_url, errs.source_standard_url, "url"),
      textField("last_updated", "Last updated", b.last_updated, null, "date"),
    ]));

    // --- General profile
    form.appendChild(fieldset("General profile", [
      textField("identity.classification", "Classification (section, working trial)", b.identity.classification),
      textField("identity.standard_published", "Standard published (source date)", b.identity.standard_published),
      textField("identity.country_of_development", "Country of development", b.identity.country_of_development),
      textareaField("identity.historical_function", "Historical function", b.identity.historical_function),
      textareaField("identity.general_impression", "General impression", b.identity.general_impression),
      textareaField("identity.historical_summary", "Brief historical summary", b.identity.historical_summary),
      textareaField("identity.important_proportions", "Important proportions", b.identity.important_proportions),
      textareaField("identity.sexual_dimorphism", "Sexual dimorphism", b.identity.sexual_dimorphism),
      textareaField("identity.ideal_type_summary", "Ideal type summary", b.identity.ideal_type_summary),
    ]));

    // --- Anatomy
    form.appendChild(fieldset("Anatomy / structure", ANATOMY_FIELDS.map(([k, label]) => textareaField("anatomy." + k, label, b.anatomy[k], null, 2))));

    // --- Temperament
    form.appendChild(fieldset("Temperament / expression", [
      textareaField("temperament.behavior", "Behavior", b.temperament.behavior),
      textareaField("temperament.ring_attitude", "Ring attitude", b.temperament.ring_attitude),
      textareaField("temperament.expression", "Expression", b.temperament.expression),
      textareaField("temperament.temperament_notes", "Temperament notes", b.temperament.temperament_notes),
    ]));

    // --- Faults
    form.appendChild(fieldset("Faults (one per line)", [
      textareaField("faults.minor", "Minor faults", (b.faults.minor || []).join("\n")),
      textareaField("faults.serious", "Serious faults", (b.faults.serious || []).join("\n")),
      textareaField("faults.disqualifying", "Disqualifying faults", (b.faults.disqualifying || []).join("\n")),
    ]));

    // --- Pedagogy
    form.appendChild(fieldset("Pedagogical notes (one per line)", [
      textareaField("pedagogy.frequent_confusions", "Frequent confusions", (b.pedagogy.frequent_confusions || []).join("\n")),
      textareaField("pedagogy.key_markers", "Key recognition markers", (b.pedagogy.key_markers || []).join("\n")),
      textareaField("pedagogy.judge_notes", "Judge notes", (b.pedagogy.judge_notes || []).join("\n")),
      textareaField("pedagogy.teaching_notes", "Teaching notes", (b.pedagogy.teaching_notes || []).join("\n")),
      textareaField("pedagogy.similar_breeds", "Similar breeds", (b.pedagogy.similar_breeds || []).join("\n")),
    ]));

    // --- Judge checklist
    form.appendChild(fieldset("Judge checklist (one per line)", [
      textareaField("judge_checklist.first_impression", "First impression", (b.judge_checklist.first_impression || []).join("\n")),
      textareaField("judge_checklist.static_exam", "Static examination", (b.judge_checklist.static_exam || []).join("\n")),
      textareaField("judge_checklist.movement_exam", "Movement examination", (b.judge_checklist.movement_exam || []).join("\n")),
      textareaField("judge_checklist.final_attention_points", "Final attention points", (b.judge_checklist.final_attention_points || []).join("\n")),
    ]));

    // --- V2 classification & study metadata
    form.appendChild(fieldset("Classification & study metadata (V2)", [
      selectField("difficulty_level", "Difficulty level", [["", "—"]].concat(optiuniCu(DIFFICULTY_LEVELS, "difficulty_level", b.difficulty_level, cap)), b.difficulty_level),
      selectField("exam_relevance", "Exam relevance", [["", "—"]].concat(optiuniCu(EXAM_RELEVANCE, "exam_relevance", b.exam_relevance, cap)), b.exam_relevance),
      selectField("teaching_priority", "Teaching priority", [["", "—"]].concat(optiuniCu(TEACHING_PRIORITY, "teaching_priority", b.teaching_priority, cap)), b.teaching_priority),
      selectField("revision_status", "Revision status", [["", "—"]].concat(optiuniCu(REVISION_STATUS, "revision_status", b.revision_status, (v) => cap(v.replace(/_/g, " ")))), b.revision_status),
      // „imported" TREBUIE să rămână în listă: e semnul că textul e brut, nerevizuit de
      // lector. Fără el, o simplă deschidere-și-salvare ștergea marcajul la 313 fișe.
      selectField("source_verification_status", "Source verification", [["", "—"]].concat(optiuniCu(SOURCE_VERIFICATION, "source_verification_status", b.source_verification_status, cap)), b.source_verification_status),
      textareaField("study_track_tags", "Study track tags (one per line, e.g. bull type, primitive type)", (b.study_track_tags || []).join("\n"), null, 2),
      textareaField("thematic_tags", "Thematic tags (one per line)", (b.thematic_tags || []).join("\n"), null, 2),
      textareaField("recurring_judge_observations", "Recurring judge observations (one per line)", (b.recurring_judge_observations || []).join("\n")),
    ]));

    // --- Internal notes
    form.appendChild(fieldset("Internal / private notes", [
      textareaField("internal_notes", "Internal notes (never shown as official data)", b.internal_notes),
    ]));

    // --- Revision note (edit only) — recorded in the change log, not stored as a breed field
    if (!ed.isNew) {
      const noteField = el("div", { class: "form-field full" }, [
        el("label", { for: "revisionNote", text: "Revision note (optional — recorded in the change log for this save)" }),
        el("input", { type: "text", id: "revisionNote", placeholder: "e.g. Corrected muzzle proportion; verified against source" }),
      ]);
      const fs = el("fieldset", { class: "form-section" }, [
        el("legend", { text: "Versioning" }),
        el("p", { class: "hint", style: "margin:0 0 8px", text: "Saving an edit increments the version (currently v" + (b.version || 1) + ") and stores a snapshot you can compare later in the Version & Audit tab." }),
        el("div", { class: "form-grid" }, noteField),
      ]);
      form.appendChild(fs);
    }

    form.appendChild(el("div", { class: "form-actions" }, [
      el("button", { type: "submit", class: "btn btn-primary" }, ed.isNew ? "Add breed" : "Save changes"),
      el("button", { type: "button", class: "btn", onclick: () => { state.editing = null; navigate(ed.isNew ? "admin" : "profile", { id: b.id }); } }, "Cancel"),
      ed.isNew ? null : el("button", { type: "button", class: "btn btn-danger", onclick: () => confirmDelete(b.id) }, "Delete breed"),
    ]));

    wrap.appendChild(form);
    return wrap;
  }

  function fieldset(legend, fields) {
    const fs = el("fieldset", { class: "form-section" }, [el("legend", { text: legend })]);
    const grid = el("div", { class: "form-grid" });
    fields.forEach((f) => { if (f) grid.appendChild(f); });
    fs.appendChild(grid);
    return fs;
  }
  function textField(name, label, value, error, type) {
    const id = "f-" + name.replace(/\W+/g, "-");
    return el("div", { class: "form-field" + (error ? " invalid" : "") }, [
      el("label", { for: id, text: label }),
      el("input", { id: id, name: name, type: type || "text", value: value || "" }),
      error ? el("span", { class: "field-error", text: error }) : null,
    ]);
  }
  function textareaField(name, label, value, error, rows) {
    const id = "f-" + name.replace(/\W+/g, "-");
    return el("div", { class: "form-field full" + (error ? " invalid" : "") }, [
      el("label", { for: id, text: label }),
      el("textarea", { id: id, name: name, rows: String(rows || 3) }, value || ""),
      error ? el("span", { class: "field-error", text: error }) : null,
    ]);
  }
  function selectField(name, label, options, value, error) {
    const id = "f-" + name.replace(/\W+/g, "-");
    const sel = el("select", { id: id, name: name });
    options.forEach(([v, l]) => { const o = el("option", { value: v, text: l }); if (v === value) o.selected = true; sel.appendChild(o); });
    return el("div", { class: "form-field" + (error ? " invalid" : "") }, [
      el("label", { for: id, text: label }), sel,
      error ? el("span", { class: "field-error", text: error }) : null,
    ]);
  }

  // Serialize the editor form back into a breed object.
  function serializeEditor() {
    const form = $("#breedForm");
    const base = JSON.parse(JSON.stringify(state.editing.breed));
    const linesOf = (v) => v.split("\n").map((s) => s.trim()).filter(Boolean);
    const arrayFields = new Set([
      "faults.minor", "faults.serious", "faults.disqualifying",
      "pedagogy.frequent_confusions", "pedagogy.key_markers", "pedagogy.judge_notes", "pedagogy.teaching_notes", "pedagogy.similar_breeds",
      "judge_checklist.first_impression", "judge_checklist.static_exam", "judge_checklist.movement_exam", "judge_checklist.final_attention_points",
    ]);
    $$("input, select, textarea", form).forEach((ctrl) => {
      const name = ctrl.name;
      if (!name) return;
      let val = ctrl.value;
      if (name === "alternate_names" || name === "thematic_tags" || name === "study_track_tags" || name === "recurring_judge_observations") { setPath(base, name, linesOf(val)); return; }
      if (arrayFields.has(name)) { setPath(base, name, linesOf(val)); return; }
      setPath(base, name, val);
    });
    if (!base.identity.official_name) base.identity.official_name = base.breed_name;
    return base;
  }
  function setPath(obj, path, value) {
    const parts = path.split(".");
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null || typeof o[parts[i]] !== "object") o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = value;
  }

  function saveEditor() {
    const b = serializeEditor();
    const errors = validateBreed(b);
    if (Object.keys(errors).length) {
      state.editing.breed = b;
      state.editing.errors = errors;
      render();
      const first = $(".form-field.invalid input, .form-field.invalid select, .form-field.invalid textarea");
      if (first) first.focus();
      toast("Please fix the highlighted required fields.", "err");
      return;
    }
    const noteInput = $("#revisionNote");
    const revisionNote = noteInput ? noteInput.value.trim() : "";
    const idx = state.breeds.findIndex((x) => x.id === b.id);
    const wasNew = state.editing.isNew;
    if (idx >= 0) {
      // Existing breed → version it and snapshot the previous state for audit.
      const old = state.breeds[idx];
      const priorVersion = old.version || 1;
      const snapshot = JSON.parse(JSON.stringify(old));
      delete snapshot.revision_history; // avoid nesting whole histories inside snapshots
      b.version = priorVersion + 1;
      b.last_updated = todayISO();
      b.revision_history = (Array.isArray(old.revision_history) ? old.revision_history.slice() : []).concat([{
        version: priorVersion,
        date: old.last_updated || "",
        ts: Date.now(),
        note: revisionNote,
        snapshot: snapshot,
      }]);
      state.breeds[idx] = normalizeBreed(b);
    } else {
      b.version = 1;
      b.revision_history = [];
      state.breeds.push(normalizeBreed(b));
    }
    state.editing = null;
    navigate("profile", { id: b.id, tab: wasNew ? "identity" : "audit" });
    toast(wasNew ? "Breed added (v1)." : "Saved as v" + b.version + ".", "ok");
  }

  /* ---------------------------------------------------------
     Delete with confirmation (modal)
     --------------------------------------------------------- */
  function confirmDelete(id) {
    const b = getBreed(id);
    if (!b) return;
    openModal({
      title: "Delete breed",
      body: 'This will remove "' + b.breed_name + '" from the current session. Export your JSON first if you want to keep a copy. This cannot be undone in-session.',
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        state.breeds = state.breeds.filter((x) => x.id !== id);
        state.favorites = state.favorites.filter((x) => x !== id);
        state.recent = state.recent.filter((x) => x !== id);
        store.set(STORAGE_KEYS.favorites, state.favorites);
        store.set(STORAGE_KEYS.recent, state.recent);
        if (state.currentBreedId === id) state.currentBreedId = null;
        state.editing = null;
        navigate("admin");
        toast("Breed deleted.", "ok");
      },
    });
  }

  // opts: { title, body, confirmLabel, danger, onConfirm }
  //   OR  { title, body, actions:[{ label, kind, onClick }] } for multiple choices.
  function openModal(opts) {
    closeModal();
    const backdrop = el("div", { class: "modal-backdrop", id: "modalBackdrop",
      onclick: (e) => { if (e.target.id === "modalBackdrop") closeModal(); } });
    let inputNode = null;
    if (opts.input) {
      inputNode = el("input", { type: "text", id: "modalInput", placeholder: opts.input.placeholder || "", style: "width:100%;margin-top:6px",
        "aria-label": opts.input.label || "Input" });
    }
    const submit = () => {
      const val = inputNode ? inputNode.value : undefined;
      closeModal();
      if (opts.onConfirmInput) opts.onConfirmInput(val);
      else if (opts.onConfirm) opts.onConfirm();
    };
    let actionNodes;
    if (opts.actions) {
      actionNodes = [el("button", { class: "btn", onclick: closeModal }, "Cancel")].concat(
        opts.actions.map((a) => el("button", { class: "btn " + (a.kind || "btn-primary"), onclick: () => { closeModal(); a.onClick && a.onClick(); } }, a.label))
      );
    } else {
      actionNodes = [
        el("button", { class: "btn", onclick: closeModal }, "Cancel"),
        el("button", { class: "btn " + (opts.danger ? "btn-danger" : "btn-primary"), onclick: submit }, opts.confirmLabel || "Confirm"),
      ];
    }
    const modal = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": opts.title }, [
      el("h3", { text: opts.title }),
      el("p", { text: opts.body }),
      inputNode ? el("div", { class: "form-field" }, [opts.input.label ? el("label", { for: "modalInput", text: opts.input.label }) : null, inputNode]) : null,
      el("div", { class: "modal-actions" }, actionNodes),
    ]);
    if (inputNode) inputNode.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.body.classList.add("is-modal-open");
    if (inputNode) inputNode.focus(); else modal.querySelector("button:last-child").focus();
    document.addEventListener("keydown", escClose);
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() {
    const m = $("#modalBackdrop");
    if (m) m.remove();
    document.body.classList.remove("is-modal-open");
    document.removeEventListener("keydown", escClose);
  }

  /* ---------------------------------------------------------
     JSON import / export
     --------------------------------------------------------- */
  function exportJSON() {
    const data = buildExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: "cfcr-breeds-" + todayISO() + ".json" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("Exported " + state.breeds.length + " breeds to JSON.", "ok");
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = parseDataset(JSON.parse(reader.result));
      } catch (err) {
        toast("Import failed: " + err.message, "err");
        return;
      }
      // First import into an empty database → just load it.
      if (!state.breeds.length) { applyImport(parsed, "replace"); return; }
      // Otherwise let the user choose how to bring the standards in.
      openModal({
        title: "Import " + parsed.breeds.length + " breed" + (parsed.breeds.length === 1 ? "" : "s"),
        body: "You have " + state.breeds.length + " breeds already. Merge adds new standards and updates matching ones (by id or name), keeping the rest. Replace discards the current database.",
        actions: [
          { label: "Merge (add / update)", kind: "btn-primary", onClick: () => applyImport(parsed, "merge") },
          { label: "Replace everything", kind: "btn-danger", onClick: () => applyImport(parsed, "replace") },
        ],
      });
    };
    reader.onerror = () => toast("Could not read the file.", "err");
    reader.readAsText(file);
  }

  function applyImport(parsed, mode) {
    if (mode === "merge") {
      const counts = mergeDataset(parsed);
      state.favorites = state.favorites.filter((id) => getBreed(id));
      state.recent = state.recent.filter((id) => getBreed(id));
      state.currentBreedId = null; state.editing = null;
      navigate("list");
      const lessonMsg = (counts.lAdded || counts.lUpdated) ? "  ·  lessons: " + counts.lAdded + " added, " + counts.lUpdated + " updated" : "";
      toast("Merged: " + counts.added + " added, " + counts.updated + " updated. Total " + state.breeds.length + " breeds." + lessonMsg, "ok");
    } else {
      state.meta = parsed.meta;
      state.breeds = parsed.breeds;
      // Lecțiile fac parte din setul înlocuit: fără linia asta, un import „Replace" cu
      // curriculum nou schimba rasele, dar lecțiile vechi rămâneau, iar cele noi se
      // pierdeau în tăcere.
      state.lessons = (parsed.lessons || []).map(normalizeLesson);
      state.favorites = state.favorites.filter((id) => getBreed(id));
      state.recent = state.recent.filter((id) => getBreed(id));
      state.currentBreedId = null; state.editing = null;
      navigate("dashboard");
      toast("Replaced database with " + state.breeds.length + " breeds.", "ok");
    }
  }

  /**
   * Forma canonică a unei țări, pentru quiz și pentru a nu oferi două răspunsuri corecte.
   * „Great Britain", „England", „United Kingdom" → aceeași țară.
   */
  function canonicalCountry(c) {
    const t = String(c || "").toLowerCase().replace(/[.\-]/g, " ").replace(/\s+/g, " ").trim();
    if (/\b(great britain|united kingdom|england|scotland|wales|uk)\b/.test(t)) return "gb";
    if (/\b(usa|u s a|united states)\b/.test(t)) return "us";
    if (/\bnetherlands\b/.test(t)) return "nl";
    if (/\b(germany|deutschland)\b/.test(t)) return "de";
    if (/czechoslovak|czech republic/.test(t)) return "cz";
    if (/\b(russia|russian federation|ussr)\b/.test(t)) return "ru";
    return t;
  }

  /* ---------------------------------------------------------
     Word / document export (HTML → .doc, opens natively in Word)
     No libraries; fully offline. Word reads HTML-based .doc files.
     --------------------------------------------------------- */
  function slugify(s) {
    return String(s || "doc").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "doc";
  }

  function wordWrapper(title, body) {
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>' + esc(title) + "</title>" +
      "<style>" +
      "body{font-family:Georgia,'Times New Roman',serif;font-size:11pt;color:#1e2320;line-height:1.4;}" +
      "h1{font-size:20pt;color:#1f463b;margin:0 0 4pt;}" +
      "h2{font-size:13pt;color:#2f5d50;border-bottom:1px solid #b9c9bf;padding-bottom:2pt;margin:14pt 0 6pt;}" +
      "h3{font-size:11pt;color:#3a473f;margin:8pt 0 2pt;}" +
      ".sub{color:#4a524d;font-size:10pt;margin:0 0 8pt;}" +
      "table{border-collapse:collapse;width:100%;margin:4pt 0;}" +
      "td,th{border:1px solid #cfd6cf;padding:4pt 6pt;vertical-align:top;text-align:left;}" +
      "td.k{width:32%;font-weight:bold;background:#f0f4f1;color:#3a473f;}" +
      "th{background:#e7efe9;color:#1f463b;}" +
      "ul{margin:2pt 0 6pt 18pt;padding:0;} li{margin:1pt 0;}" +
      ".dq{color:#8a2f2a;} .warnbox{background:#f6efe2;border:1px solid #e3d6bb;padding:6pt 8pt;color:#6a4a12;font-size:9pt;}" +
      ".disc{margin-top:16pt;font-size:8.5pt;color:#6a6f68;border-top:1px solid #cfd6cf;padding-top:6pt;}" +
      "</style></head><body>" + body + "</body></html>";
  }

  function exportWord(filename, title, body) {
    const blob = new Blob(["﻿" + wordWrapper(title, body)], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("Word document exported.", "ok");
  }

  // -- small HTML builders for Word docs --
  function wKV(pairs) {
    return '<table>' + pairs.map(function (p) {
      return '<tr><td class="k">' + esc(p[0]) + "</td><td>" + esc(p[1] == null || p[1] === "" ? "—" : p[1]) + "</td></tr>";
    }).join("") + "</table>";
  }
  function wList(title, items, cls) {
    const c = cls ? ' class="' + cls + '"' : "";
    if (!items || !items.length) return "<h3" + c + ">" + esc(title) + "</h3><p>—</p>";
    return "<h3" + c + ">" + esc(title) + "</h3><ul" + c + ">" + items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>";
  }
  function wDisclaimer(b) {
    const src = b && b.source_standard_url ? " Source: " + esc(b.source_standard_url) + "." : "";
    return '<p class="disc">Generated by CFCR Breed Standards Explorer — World Dog Federation (WDF) framework, on ' + todayISO() + ". " +
      "Descriptive content may be a structured or edited dataset and is not a verbatim official standard; verify against the official source before examination or judging use." + src + "</p>";
  }

  function wordDocProfile(b, includePrivate) {
    let s = "<h1>" + esc(b.breed_name) + "</h1>";
    s += '<p class="sub">' + esc(b.group) + " · " + esc(b.country_of_origin) + " · " + esc(statusLabel(b.wdf_status)) + " · v" + (b.version || 1) + "</p>";
    if (b.alternate_names.length) s += '<p class="sub">Also known as: ' + esc(fmtList(b.alternate_names)) + "</p>";

    s += "<h2>Identity</h2>" + wKV([
      ["Official name", b.identity.official_name || b.breed_name],
      ["Internal ID", b.id], ["WDF group", b.group],
      ["Country of origin / owner", b.country_of_origin + (b.identity.owner_country && b.identity.owner_country !== b.country_of_origin ? " · " + b.identity.owner_country : "")],
      ["WDF recognition status", statusLabel(b.wdf_status)],
      ["Coat / functional type", cap(b.coat_type) + " · " + cap(b.functional_type)],
      ["Source standard", b.source_standard_title || "—"],
      ["Source URL", b.source_standard_url || "—"],
      ["Version / last revised", "v" + (b.version || 1) + " · " + (b.last_updated || "—")],
    ]);

    s += "<h2>General profile</h2>" + wKV([
      ["Historical function", b.identity.historical_function],
      ["General impression", b.identity.general_impression],
      ["Important proportions", b.identity.important_proportions],
      ["Sexual dimorphism", b.identity.sexual_dimorphism],
      ["Ideal type summary", b.identity.ideal_type_summary],
    ]);

    s += "<h2>Anatomy / structure</h2>" + wKV(ANATOMY_FIELDS.map(function (f) { return [f[1], b.anatomy[f[0]]]; }));

    s += "<h2>Temperament</h2>" + wKV([
      ["Behavior", b.temperament.behavior], ["Ring attitude", b.temperament.ring_attitude],
      ["Expression", b.temperament.expression], ["Temperament notes", b.temperament.temperament_notes],
    ]);

    s += "<h2>Faults</h2>" + wList("Minor faults", b.faults.minor) + wList("Serious faults", b.faults.serious) + wList("Disqualifying faults", b.faults.disqualifying, "dq");

    s += "<h2>Pedagogical notes</h2>" +
      wList("Frequent confusions", b.pedagogy.frequent_confusions) +
      wList("Key recognition markers", b.pedagogy.key_markers) +
      wList("Judge notes", b.pedagogy.judge_notes) +
      wList("Teaching notes", b.pedagogy.teaching_notes) +
      wList("Similar breeds", b.pedagogy.similar_breeds);

    s += "<h2>Judge checklist</h2>" +
      wList("First impression", b.judge_checklist.first_impression) +
      wList("Static examination", b.judge_checklist.static_exam) +
      wList("Movement examination", b.judge_checklist.movement_exam) +
      wList("Final attention points", b.judge_checklist.final_attention_points);

    const hasExt = b.difficulty_level || b.exam_relevance || b.revision_status || (b.study_track_tags && b.study_track_tags.length);
    if (hasExt) {
      s += "<h2>Classification & study metadata</h2>" + wKV([
        ["Difficulty level", b.difficulty_level ? cap(b.difficulty_level) : "—"],
        ["Exam relevance", b.exam_relevance ? cap(b.exam_relevance) : "—"],
        ["Teaching priority", b.teaching_priority ? cap(b.teaching_priority) : "—"],
        ["Revision status", b.revision_status ? cap(b.revision_status.replace(/_/g, " ")) : "—"],
        ["Source verification", b.source_verification_status ? verifLabel(b.source_verification_status).replace(/[✓⚠]\s?/g, "") : "—"],
        ["Study tracks", fmtList(b.study_track_tags)],
        ["Thematic tags", fmtList(b.thematic_tags)],
      ]);
      if (b.recurring_judge_observations && b.recurring_judge_observations.length) s += wList("Recurring judge observations", b.recurring_judge_observations);
    }

    if (b.references && b.references.length) {
      s += "<h2>References</h2>";
      b.references.forEach(function (r) {
        s += wKV([["Type", (r.type || "reference").replace(/_/g, " ")], ["Title", r.title || "—"], ["URL", r.url || "—"], ["Accessed on", r.accessed_on || "—"]]);
      });
    }

    if (includePrivate && isNonEmptyText(b.internal_notes)) {
      s += "<h2>Internal / private notes</h2>" + '<div class="warnbox">Internal — not for distribution</div><p>' + esc(b.internal_notes) + "</p>";
    }
    s += wDisclaimer(b);
    return s;
  }

  function exportProfileWord(b) {
    openModal({
      title: "Export breed profile to Word",
      body: "Choose whether to include internal / private notes. Student-safe omits them.",
      actions: [
        { label: "Student-safe (no private notes)", kind: "btn-primary", onClick: function () { exportWord(slugify(b.breed_name) + "-profile.doc", b.breed_name + " — WDF profile", wordDocProfile(b, false)); } },
        { label: "Full (with internal notes)", kind: "btn", onClick: function () { exportWord(slugify(b.breed_name) + "-profile-full.doc", b.breed_name + " — WDF profile (full)", wordDocProfile(b, true)); } },
      ],
    });
  }

  function wordDocRevisionSheet(b) {
    let s = "<h1>Revision sheet — " + esc(b.breed_name) + "</h1>";
    s += '<p class="sub">' + esc(b.group) + " · " + esc(b.country_of_origin) + " · " + esc(statusLabel(b.wdf_status)) + "</p>";
    if (isNonEmptyText(b.identity.ideal_type_summary)) s += "<h2>Ideal type</h2><p>" + esc(b.identity.ideal_type_summary) + "</p>";
    s += "<h2>Key recognition</h2>" + wList("Key markers", b.pedagogy.key_markers) + wList("Frequent confusions", b.pedagogy.frequent_confusions) + wList("Similar breeds", b.pedagogy.similar_breeds);
    s += "<h2>Faults at a glance</h2>" + wList("Serious", b.faults.serious) + wList("Disqualifying", b.faults.disqualifying, "dq");
    s += "<h2>Judge checklist</h2>" +
      wList("First impression", b.judge_checklist.first_impression) +
      wList("Static", b.judge_checklist.static_exam) +
      wList("Movement", b.judge_checklist.movement_exam) +
      wList("Final points", b.judge_checklist.final_attention_points);
    s += wDisclaimer(b);
    return s;
  }

  function wordDocComparison(breeds, teaching) {
    // Backward-compatible: accept (a, b) too.
    if (!Array.isArray(breeds)) breeds = [breeds, teaching], teaching = false;
    const n = breeds.length;
    const colspan = n + 1;
    let s = "<h1>Breed comparison</h1>";
    s += '<p class="sub">' + breeds.map(function (b) { return esc(b.breed_name); }).join("  vs  ") + " · " + todayISO() + "</p>";

    if (teaching) {
      s += "<h2>Teaching notes</h2>";
      const pairs = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([breeds[i], breeds[j]]);
      let conf = "";
      pairs.forEach(function (p) { if (referencesBreed(p[0], p[1]) || referencesBreed(p[1], p[0])) conf += "<li><strong>" + esc(p[0].breed_name) + " ↔ " + esc(p[1].breed_name) + ":</strong> commonly confused.</li>"; });
      s += "<h3>Likely confusions</h3>" + (conf ? "<ul>" + conf + "</ul>" : "<p>None recorded within this set.</p>");
      s += "<h3>What to observe first</h3>";
      breeds.forEach(function (b) { s += "<p><strong>" + esc(b.breed_name) + "</strong></p>" + (b.pedagogy.key_markers.length ? "<ul>" + b.pedagogy.key_markers.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>" : "<p>—</p>"); });
    }

    s += "<h2>Comparison matrix</h2>";
    s += "<table><thead><tr><th>Field</th>" + breeds.map(function (b) { return "<th>" + esc(b.breed_name) + "</th>"; }).join("") + "</tr></thead><tbody>";
    COMPARE_SECTIONS.forEach(function (sec) {
      s += '<tr><td colspan="' + colspan + '" style="background:#2f5d50;color:#fff;font-weight:bold;">' + esc(sec.title) + "</td></tr>";
      sec.rows.forEach(function (row) {
        const vals = breeds.map(function (b) { return (row[1](b) || "").toString().trim(); });
        const diff = compareDiffersMulti(vals);
        const style = diff ? ' style="background:#fbf3e6;"' : "";
        s += '<tr><td class="k">' + esc(row[0]) + "</td>" + vals.map(function (v) { return "<td" + style + ">" + esc(v || "—") + "</td>"; }).join("") + "</tr>";
      });
    });
    s += "</tbody></table>";
    s += '<p class="sub">Highlighted cells indicate a meaningful difference between the breeds.</p>';
    s += wDisclaimer(breeds[0]);
    return s;
  }

  function wordDocQuiz(session, withAnswers) {
    const qs = session.questions;
    let s = "<h1>" + (session.mode === "exam" ? "Exam" : "Quiz") + " — WDF breed standards</h1>";
    s += '<p class="sub">' + qs.length + " questions · generated " + todayISO() + (session.secondsPerQ ? " · " + session.secondsPerQ + "s per question" : "") + "</p>";
    qs.forEach(function (q, i) {
      s += "<p><strong>" + (i + 1) + ". " + esc(q.prompt) + "</strong>";
      s += ' <span style="color:#6a6f68;font-size:9pt;">[' + esc(q.tag) + "]</span></p>";
      if (q.context) s += '<p style="margin-left:14pt;font-style:italic;">' + esc(q.context) + "</p>";
      s += '<ul style="list-style:none;margin-left:14pt;">';
      q.options.forEach(function (o, j) { s += "<li>" + String.fromCharCode(65 + j) + ". " + esc(o.text) + "</li>"; });
      s += "</ul>";
    });
    if (withAnswers) {
      s += '<h2 style="page-break-before:always;">Answer key</h2><table><thead><tr><th>Q</th><th>Answer</th><th>Explanation</th></tr></thead><tbody>';
      qs.forEach(function (q, i) {
        s += "<tr><td>" + (i + 1) + "</td><td>" + String.fromCharCode(65 + q.answer) + ". " + esc(q.options[q.answer].text) + "</td><td>" + esc(q.explanation || "") + "</td></tr>";
      });
      s += "</tbody></table>";
    }
    s += '<p class="disc">Generated by CFCR Breed Standards Explorer (WDF framework) on ' + todayISO() + ".</p>";
    return s;
  }

  function exportQuizWord(session) {
    openModal({
      title: "Export " + (session.mode === "exam" ? "exam" : "quiz") + " to Word",
      body: "Teacher version includes the answer key; student handout omits it.",
      actions: [
        { label: "Student handout (no answers)", kind: "btn-primary", onClick: function () { exportWord(slugify(session.mode) + "-" + todayISO() + ".doc", "WDF " + session.mode, wordDocQuiz(session, false)); } },
        { label: "Teacher version (with answer key)", kind: "btn", onClick: function () { exportWord(slugify(session.mode) + "-key-" + todayISO() + ".doc", "WDF " + session.mode + " (key)", wordDocQuiz(session, true)); } },
      ],
    });
  }

  // Build a quiz from current settings and export it directly (printable exam), no interactive run.
  function exportPrintableExam() {
    const built = buildQuiz();
    if (built.error) { toast(built.error, "err"); return; }
    exportQuizWord({ mode: "exam", questions: built.questions, secondsPerQ: state.quiz.config.timed ? 30 : 0 });
  }

  /* ---------------------------------------------------------
     Print preparation
     --------------------------------------------------------- */
  function printProfile() {
    // Expand all tabs for a complete printed profile.
    const b = getBreed(state.currentBreedId);
    if (!b) return;
    const holder = $(".tab-panel");
    if (holder) {
      holder.innerHTML = "";
      PROFILE_TABS.forEach((t) => {
        holder.appendChild(el("h2", { text: t.label }));
        holder.appendChild(renderProfileTab(b, t.id));
      });
    }
    window.print();
    // Restore single-tab view after printing.
    setTimeout(render, 400);
  }
  function printComparison() { window.print(); }

  /* ---------------------------------------------------------
     Global search wiring
     --------------------------------------------------------- */
  function syncGlobalSearchInput() {
    const inp = $("#globalSearch");
    if (inp) inp.value = state.search;
  }
  let searchDebounce;
  function onGlobalSearch(val) {
    state.search = val;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      recordRecentSearch(val);
      if (state.view !== "list") { navigate("list"); }
      else render();
    }, 300);
  }

  function recordRecentSearch(val) {
    const q = (val || "").trim();
    if (q.length < 2) return;
    state.recentSearches = [q].concat(state.recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase())).slice(0, 8);
    store.set(STORAGE_KEYS.recentSearches, state.recentSearches);
  }

  function resetFilters() {
    state.list.filters = { group: "", country: "", status: "", coat: "", func: "", hasPedagogy: "", difficulty: "", track: "" };
    state.list.preset = "";
  }

  function activeFilterCount() {
    const f = state.list.filters;
    let n = Object.values(f).filter(Boolean).length;
    if (state.list.preset) n++;
    if (state.search.trim()) n++;
    return n;
  }

  /* ---------------------------------------------------------
     Saved searches (research shortcuts persisted locally)
     --------------------------------------------------------- */
  function saveCurrentSearch() {
    if (!activeFilterCount()) { toast("Nothing to save — set a search, filter, or preset first.", "err"); return; }
    openModal({
      title: "Save this search",
      body: "Name this combination of search term, filters, sort, and preset so you can reapply it later.",
      input: { label: "Name", placeholder: "e.g. Group 1 – needs pedagogy" },
      confirmLabel: "Save",
      onConfirmInput: (name) => {
        name = (name || "").trim();
        if (!name) { toast("Please enter a name.", "err"); return; }
        const entry = {
          name: name,
          search: state.search,
          filters: Object.assign({}, state.list.filters),
          sort: state.list.sort,
          preset: state.list.preset,
        };
        state.savedSearches = [entry].concat(state.savedSearches.filter((s) => s.name !== name)).slice(0, 30);
        store.set(STORAGE_KEYS.savedSearches, state.savedSearches);
        render();
        toast('Saved search “' + name + '”.', "ok");
      },
    });
  }
  function applySavedSearch(entry) {
    state.search = entry.search || "";
    state.list.filters = Object.assign({ group: "", country: "", status: "", coat: "", func: "", hasPedagogy: "", difficulty: "", track: "" }, entry.filters || {});
    state.list.sort = entry.sort || "alpha";
    state.list.preset = entry.preset || "";
    syncGlobalSearchInput();
    navigate("list");
  }
  function deleteSavedSearch(name) {
    state.savedSearches = state.savedSearches.filter((s) => s.name !== name);
    store.set(STORAGE_KEYS.savedSearches, state.savedSearches);
    render();
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function wireChrome() {
    // Global search
    const gs = $("#globalSearch");
    gs.addEventListener("input", (e) => onGlobalSearch(e.target.value));
    gs.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (state.view !== "list") navigate("list"); } });

    // Header buttons
    $("#btnImport").addEventListener("click", () => $("#fileInput").click());
    $("#fileInput").addEventListener("change", (e) => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; });
    $("#btnExport").addEventListener("click", exportJSON);
    $("#btnAdd").addEventListener("click", startNewBreed);
    $("#mobileNavToggle").addEventListener("click", () => document.body.classList.toggle("nav-open"));

    // Pe versiunea publicată (fără admin) ascundem butoanele de editare din antet:
    // adăugarea și importul nu au sens dacă editorul e blocat. Export/Install rămân.
    if (!ADMIN_ENABLED) {
      var _add = $("#btnAdd"); if (_add) _add.style.display = "none";
      var _imp = $("#btnImport"); if (_imp) _imp.style.display = "none";
    }

    // Keyboard shortcut: "/" focuses search
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault(); gs.focus();
      }
    });

    // Install (PWA) button
    $("#btnInstall").addEventListener("click", promptInstall);
  }

  /* ---------------------------------------------------------
     PWA — service worker + install prompt
     Only active over https:// or http://localhost. On file://
     service workers are not permitted, so this is a no-op and
     the app keeps running via the embedded seed fallback.
     --------------------------------------------------------- */
  let deferredInstallPrompt = null;
  // Păstrăm CODUL, nu un simplu „deblocat=1". Un semnalizator nu poate fi retras:
  // odată pus, rămânea valabil chiar dacă administratorul revoca codul. Cu codul
  // salvat îl putem re-verifica la fiecare pornire, deci revocarea are efect real.
  var INSTALL_COD_KEY = "bseCodInstalare";
  var INSTALL_UNLOCK_KEY = "bseInstalareDeblocata"; // cheia veche (doar pentru curățare)

  function codInstalareSalvat() {
    try { return localStorage.getItem(INSTALL_COD_KEY) || ""; } catch (e) { return ""; }
  }
  function instalareDeblocata() { return !!codInstalareSalvat(); }

  function uitaCodInstalare() {
    try { localStorage.removeItem(INSTALL_COD_KEY); localStorage.removeItem(INSTALL_UNLOCK_KEY); } catch (e) {}
  }

  // Fără <link rel="manifest"> browserul NU oferă instalarea PWA. Îl injectăm doar
  // după ce codul de instalare a fost validat (deblocare per dispozitiv).
  function injecteazaManifest() {
    if (document.querySelector('link[rel="manifest"]')) return;
    var l = document.createElement("link");
    l.rel = "manifest";
    l.setAttribute("href", "manifest.webmanifest");
    document.head.appendChild(l);
  }
  function scoateManifest() {
    var l = document.querySelector('link[rel="manifest"]');
    if (l) l.parentNode.removeChild(l);
  }

  // Re-verifică la pornire codul salvat. Dacă a fost revocat, dispare posibilitatea
  // de a instala pe acest dispozitiv. Dacă suntem offline, NU schimbăm nimic —
  // altfel o simplă pană de rețea ar bloca un utilizator legitim.
  function reverificaInstalarea() {
    var cod = codInstalareSalvat();
    if (!cod) return;
    fetch("/.netlify/functions/breed-instalare", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actiune: "verifica", cod: cod }),
    }).then(function (res) {
      if (res.status === 401) { // cod revocat de administrator
        uitaCodInstalare();
        scoateManifest();
        var b = $("#btnInstall");
        if (b) b.hidden = false; // rămâne butonul, dar va cere din nou un cod
      }
    }).catch(function () { /* offline — păstrăm starea */ });
  }

  function registerPWA() {
    const okProtocol = location.protocol === "https:" ||
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if ("serviceWorker" in navigator && okProtocol) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline mode still works */ });
    }
    if (instalareDeblocata()) { injecteazaManifest(); reverificaInstalarea(); }

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
    });
    window.addEventListener("appinstalled", function () {
      deferredInstallPrompt = null;
      const btn = $("#btnInstall");
      if (btn) btn.hidden = true;
      toast("Aplicație instalată. O poți deschide de pe dispozitivul tău.", "ok");
    });

    var standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    var btn = $("#btnInstall");
    if (btn && okProtocol && !standalone) btn.hidden = false;
  }

  function declanseazaInstalare() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(function () {
        deferredInstallPrompt = null;
        const btn = $("#btnInstall");
        if (btn) btn.hidden = true;
      });
    } else {
      toast("Instalare deblocată. Dacă fereastra nu apare, folosește meniul browserului → „Instalează aplicația”.");
    }
  }

  function promptInstall() {
    if (instalareDeblocata()) { declanseazaInstalare(); return; }
    var cod = window.prompt("Instalarea aplicației necesită un cod de instalare (primit de la CFC-Royal). Introdu codul:");
    if (!cod) return;
    fetch("/.netlify/functions/breed-instalare", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actiune: "verifica", cod: String(cod).trim() }),
    }).then(function (res) {
      if (!res.ok) { toast("Cod de instalare incorect.", "warn"); return; }
      // Salvăm CODUL, ca să-l putem re-verifica la fiecare pornire (revocarea are efect).
      try { localStorage.setItem(INSTALL_COD_KEY, String(cod).trim()); localStorage.removeItem(INSTALL_UNLOCK_KEY); } catch (e) {}
      injecteazaManifest();
      toast("Cod acceptat — se pregătește instalarea…", "ok");
      setTimeout(declanseazaInstalare, 1000);
    }).catch(function () { toast("Nu am putut verifica codul (ești online?).", "warn"); });
  }

  // Optional deep-link on load: #list / #compare / #dashboard / #admin
  function initialRouteFromHash() {
    const h = (location.hash || "").replace("#", "");
    if (["list", "compare", "dashboard", "quiz"].includes(h) || (h === "admin" && ADMIN_ENABLED)) state.view = h;
  }

  // Load the offline mirror on demand. It is a full copy of breeds.json, so it is
  // fetched only when the normal load fails — otherwise every visit would download
  // the dataset twice.
  function loadSeedScript() {
    if (window.__CFCR_SEED__) return Promise.resolve(true);
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "data/seed-data.js";
      s.onload = () => resolve(!!window.__CFCR_SEED__);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  function loadInitialData() {
    // Try to fetch the canonical JSON file. When opened via file:// this often
    // fails (browsers block local fetch); fall back to the embedded seed script.
    return fetch("data/breeds.json", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((data) => { ingestDataset(data); return "file"; })
      .catch(() => loadSeedScript().then((ok) => {
        if (ok) { ingestDataset(window.__CFCR_SEED__); return "embedded"; }
        throw new Error("No dataset available.");
      }));
  }

  function boot() {
    wireChrome();
    registerPWA();
    initialRouteFromHash();
    loadInitialData()
      .then((src) => {
        render();
        if (src === "embedded") {
          // Non-blocking notice: fetch was unavailable, embedded seed used.
          setTimeout(() => toast("Loaded embedded seed data (offline mode). Import/Export JSON works normally.", "ok"), 300);
        }
      })
      .catch((err) => {
        state.breeds = [];
        render();
        toast("Could not load any dataset: " + err.message, "err");
      });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
