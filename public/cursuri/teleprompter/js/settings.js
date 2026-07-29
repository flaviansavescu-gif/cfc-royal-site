/* =====================================================================
   TP.Settings — modelul de setări + panoul de configurare
   ---------------------------------------------------------------------
   Toate preferințele de text (font, temă, ghidaj, oglindă etc.) trăiesc
   aici. Se salvează în localStorage și se aplică pe document prin
   variabile CSS + atributul data-theme. Prompterul citește aceleași
   variabile, deci schimbările se reflectă instant.
   ===================================================================== */
window.TP = window.TP || {};

TP.Settings = (function () {
  "use strict";

  var DEFAULTS = {
    fontSize: 64,          // px  (24–120)
    fontFamily: "var(--f-sans)",
    lineHeight: 1.5,       // (1.1–2.4)
    column: 80,            // % din lățime (40–100)
    guide: 40,             // % poziția liniei de ghidaj (15–75)
    align: "left",         // left | center
    theme: "dark",         // dark | navy | light | hc
    countdown: true,       // numărătoare inversă la pornire
    mirror: false,         // oglindire orizontală
    speed: 130,            // cuv/min — viteza de derulare (partajată cu prompterul)
    estimateWpm: 130,      // cuv/min — viteza pentru estimarea timpului de citit
  };

  var state = Object.assign({}, DEFAULTS);
  var listeners = [];

  /** Aplică setările pe document (variabile CSS + tema + oglindă). */
  function apply() {
    var root = document.documentElement.style;
    root.setProperty("--text-size", state.fontSize + "px");
    root.setProperty("--text-family", state.fontFamily);
    root.setProperty("--text-line", String(state.lineHeight));
    root.setProperty("--text-column", state.column + "%");
    root.setProperty("--text-align", state.align);
    root.setProperty("--guide-pos", state.guide + "%");
    document.body.setAttribute("data-theme", state.theme);

    var prompter = document.getElementById("screen-prompter");
    if (prompter) prompter.classList.toggle("is-mirrored", !!state.mirror);

    listeners.forEach(function (fn) { fn(state); });
  }

  /** Încarcă din localStorage peste valorile implicite. */
  function load() {
    var saved = TP.Storage.getSettings();
    if (saved && typeof saved === "object") {
      Object.keys(DEFAULTS).forEach(function (k) {
        if (saved[k] !== undefined) state[k] = saved[k];
      });
    }
    apply();
    return state;
  }

  function save() { TP.Storage.saveSettings(state); }

  /** Setează una sau mai multe chei, aplică și salvează. */
  function set(patch) {
    Object.assign(state, patch);
    apply();
    save();
  }

  function get() { return state; }

  /** Abonare la schimbări (folosit de UI ca să reflecte valorile). */
  function onChange(fn) { listeners.push(fn); }

  function reset() {
    state = Object.assign({}, DEFAULTS);
    apply();
    save();
  }

  /* ---------------- Legarea panoului de setări din DOM ---------------- */
  function bindPanel() {
    var $ = function (id) { return document.getElementById(id); };

    var panel = $("settings-panel");
    var openBtn = $("btn-open-settings");

    function openPanel() { panel.hidden = false; syncInputs(); }
    function closePanel() { panel.hidden = true; }

    openBtn.addEventListener("click", openPanel);
    panel.querySelectorAll("[data-close-settings]").forEach(function (el) {
      el.addEventListener("click", closePanel);
    });

    // Sliders / selecturi simple -> map câmp: [id, cheie, parser, label, format]
    var sliders = [
      ["set-font-size", "fontSize", parseInt, "val-font-size", function (v) { return v; }],
      ["set-line-height", "lineHeight", parseFloat, "val-line-height", function (v) { return v.toFixed(2); }],
      ["set-column", "column", parseInt, "val-column", function (v) { return v; }],
      ["set-guide", "guide", parseInt, "val-guide", function (v) { return v; }],
    ];
    sliders.forEach(function (cfg) {
      var input = $(cfg[0]);
      input.addEventListener("input", function () {
        var v = cfg[2](input.value);
        var patch = {}; patch[cfg[1]] = v;
        set(patch);
        $(cfg[3]).textContent = cfg[4](v);
      });
    });

    $("set-font-family").addEventListener("change", function (e) {
      set({ fontFamily: e.target.value });
    });

    // Aliniere (segmented)
    panel.querySelectorAll("[data-align]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        set({ align: btn.getAttribute("data-align") });
        syncInputs();
      });
    });

    // Teme
    panel.querySelectorAll("[data-theme-name]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        set({ theme: btn.getAttribute("data-theme-name") });
        syncInputs();
      });
    });

    // Comutatoare
    $("set-countdown").addEventListener("change", function (e) { set({ countdown: e.target.checked }); });
    $("set-mirror").addEventListener("change", function (e) { set({ mirror: e.target.checked }); });

    $("settings-reset").addEventListener("click", function () {
      reset(); syncInputs();
      TP.toast && TP.toast("Setările au fost resetate");
    });

    // Reflectă starea curentă în controale
    function syncInputs() {
      $("set-font-size").value = state.fontSize;   $("val-font-size").textContent = state.fontSize;
      $("set-line-height").value = state.lineHeight; $("val-line-height").textContent = state.lineHeight.toFixed(2);
      $("set-column").value = state.column;        $("val-column").textContent = state.column;
      $("set-guide").value = state.guide;          $("val-guide").textContent = state.guide;
      $("set-font-family").value = state.fontFamily;
      $("set-countdown").checked = state.countdown;
      $("set-mirror").checked = state.mirror;
      panel.querySelectorAll("[data-align]").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-align") === state.align);
      });
      panel.querySelectorAll("[data-theme-name]").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-theme-name") === state.theme);
      });
    }

    TP.Settings._openPanel = openPanel;
    TP.Settings._syncInputs = syncInputs;
  }

  return {
    DEFAULTS: DEFAULTS,
    load: load, save: save, set: set, get: get, reset: reset,
    onChange: onChange, bindPanel: bindPanel,
  };
})();
