/* =====================================================================
   TP (app) — inițializare și legături între module
   ---------------------------------------------------------------------
   Rulează după ce toate modulele s-au încărcat. Pornește setările,
   biblioteca și prompterul, apoi conectează butoanele de nivel înalt.
   ===================================================================== */
window.TP = window.TP || {};

/** Notificare scurtă (toast) — folosită de toate modulele. */
TP.toast = (function () {
  var el, timer;
  return function (msg) {
    el = el || document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(function () { el.hidden = true; }, 2200);
  };
})();

(function boot() {
  "use strict";

  function start() {
    // 1) Setările trebuie încărcate primele (aplică temă/font pe document)
    TP.Settings.load();
    TP.Settings.bindPanel();

    // 2) Biblioteca de scripturi + editorul
    TP.Library.init();

    // 3) Motorul de prompter
    TP.Prompter.init();

    // 4) Butoanele de nivel înalt din editor
    document.getElementById("btn-start-prompter").addEventListener("click", function () {
      var script = TP.Library.getActive();
      TP.Prompter.open(script);
    });

    // Scurtătură globală în editor: „S” deschide setările
    document.addEventListener("keydown", function (e) {
      if (TP.Prompter.isOpen()) return;                 // în prompter tastele au alt rol
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return; // nu bruiem tastarea
      if (e.key === "s" || e.key === "S") { e.preventDefault(); TP.Settings._openPanel(); }
    });

    // Împiedicăm derularea accidentală a paginii cu Spațiu în afara câmpurilor
    window.addEventListener("keydown", function (e) {
      if (e.key === " " && e.target === document.body) e.preventDefault();
    });

    console.info("[Teleprompter] Gata. Extensii pregătite: TP.Remote, TP.Voice (neactivate).");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
