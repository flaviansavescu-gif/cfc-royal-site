/* =====================================================================
   TP.Library — biblioteca de scripturi (CRUD) + editorul
   ---------------------------------------------------------------------
   Gestionează lista de scripturi salvate în localStorage: creare, salvare,
   redenumire (prin câmpul de nume), ștergere, selecție, import .txt/.md,
   plus statisticile de cuvinte și timp estimat de citire.
   ===================================================================== */
window.TP = window.TP || {};

TP.Library = (function () {
  "use strict";

  var scripts = [];        // [{ id, name, text, updated }]
  var activeId = null;
  var els = {};

  function $(id) { return document.getElementById(id); }

  function init() {
    els = {
      list: $("script-list"),
      name: $("script-name"),
      text: $("script-text"),
      words: $("stat-words"),
      time: $("stat-time"),
      estimate: $("estimate-wpm"),
    };

    scripts = TP.Storage.getScripts();

    // Dacă nu există niciun script, punem unul demonstrativ de pornire.
    if (!scripts.length) {
      scripts.push(demoScript());
      TP.Storage.saveScripts(scripts);
    }

    // Reia scriptul activ din sesiune, altfel primul.
    var session = TP.Storage.getSession();
    activeId = (session && session.activeId && findById(session.activeId)) ? session.activeId : scripts[0].id;

    bindEvents();
    renderList();
    loadIntoEditor(activeId);

    // Câmpul de viteză pentru estimare
    els.estimate.value = TP.Settings.get().estimateWpm;
    els.estimate.addEventListener("input", function () {
      var wpm = Math.max(60, Math.min(300, parseInt(els.estimate.value, 10) || 130));
      TP.Settings.set({ estimateWpm: wpm });
      updateStats();
    });
  }

  function bindEvents() {
    $("btn-new-script").addEventListener("click", createNew);
    $("btn-save-script").addEventListener("click", function () { saveCurrent(true); });
    $("btn-delete-script").addEventListener("click", deleteCurrent);

    // Statistici live la tastare
    els.text.addEventListener("input", updateStats);

    // Numele: la schimbare, salvăm (redenumire)
    els.name.addEventListener("change", function () { saveCurrent(false); });

    // Import fișier .txt / .md
    $("file-import").addEventListener("change", handleImport);
  }

  /* ------------------------- Operații CRUD ------------------------- */

  function findById(id) { return scripts.find(function (s) { return s.id === id; }); }

  function createNew() {
    var s = { id: TP.Storage.uid(), name: "Script nou", text: "", updated: nowStamp() };
    scripts.unshift(s);
    TP.Storage.saveScripts(scripts);
    activeId = s.id;
    renderList();
    loadIntoEditor(s.id);
    els.name.focus();
    els.name.select();
  }

  /** Salvează scriptul din editor. `explicit` = apăsare pe „Salvează”. */
  function saveCurrent(explicit) {
    var s = findById(activeId);
    if (!s) return;
    s.name = (els.name.value.trim() || "Fără titlu");
    s.text = els.text.value;
    s.updated = nowStamp();
    TP.Storage.saveScripts(scripts);
    renderList();
    if (explicit) TP.toast("Script salvat");
  }

  function deleteCurrent() {
    var s = findById(activeId);
    if (!s) return;
    if (!confirm('Ștergi scriptul „' + s.name + '"?')) return;
    scripts = scripts.filter(function (x) { return x.id !== activeId; });
    if (!scripts.length) scripts.push(demoScript());
    TP.Storage.saveScripts(scripts);
    activeId = scripts[0].id;
    renderList();
    loadIntoEditor(activeId);
    TP.toast("Script șters");
  }

  function handleImport(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var s = {
        id: TP.Storage.uid(),
        name: file.name.replace(/\.(txt|md)$/i, ""),
        text: String(reader.result || ""),
        updated: nowStamp(),
      };
      scripts.unshift(s);
      TP.Storage.saveScripts(scripts);
      activeId = s.id;
      renderList();
      loadIntoEditor(s.id);
      TP.toast("Fișier importat");
    };
    reader.readAsText(file, "utf-8");
    e.target.value = ""; // permite re-importul aceluiași fișier
  }

  /* ------------------------- Randare UI ------------------------- */

  function renderList() {
    els.list.textContent = "";
    scripts.forEach(function (s) {
      var li = document.createElement("li");
      li.className = "script-list__item" + (s.id === activeId ? " is-active" : "");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", s.id === activeId ? "true" : "false");

      var name = document.createElement("div");
      name.className = "script-list__name";
      name.textContent = s.name;

      var meta = document.createElement("div");
      meta.className = "script-list__meta";
      meta.textContent = TP.Markdown.countWords(s.text) + " cuvinte";

      li.appendChild(name);
      li.appendChild(meta);
      li.addEventListener("click", function () {
        if (s.id === activeId) return;
        // Salvăm ce e în editor înainte de a comuta
        saveCurrent(false);
        activeId = s.id;
        renderList();
        loadIntoEditor(s.id);
      });
      els.list.appendChild(li);
    });
  }

  function loadIntoEditor(id) {
    var s = findById(id);
    if (!s) return;
    els.name.value = s.name;
    els.text.value = s.text;
    TP.Storage.saveSession(Object.assign(TP.Storage.getSession(), { activeId: id }));
    updateStats();
  }

  /** Recalculează cuvinte + timp estimat de citit. */
  function updateStats() {
    var words = TP.Markdown.countWords(els.text.value);
    var wpm = TP.Settings.get().estimateWpm || 130;
    var minutes = words / wpm;
    els.words.textContent = words + (words === 1 ? " cuvânt" : " cuvinte");
    els.time.textContent = "~" + formatMinutes(minutes) + " de citit";
  }

  function formatMinutes(min) {
    if (min < 1) return Math.max(1, Math.round(min * 60)) + " sec";
    var m = Math.floor(min);
    var s = Math.round((min - m) * 60);
    return s ? (m + " min " + s + " sec") : (m + " min");
  }

  /* ------------------------- Utilitare ------------------------- */

  function nowStamp() {
    try { return new Date().toISOString(); } catch (e) { return ""; }
  }

  function demoScript() {
    return {
      id: TP.Storage.uid(),
      name: "Exemplu — Bun venit",
      text:
        "## Bun venit la curs\n\n" +
        "Acesta este un **teleprompter** pentru predarea cursurilor online. " +
        "Lipește-ți textul în editor sau importă un fișier .txt ori .md.\n\n" +
        "## Cum controlezi derularea\n\n" +
        "Apasă **Spațiu** pentru play sau pauză. Folosește **săgețile sus și jos** " +
        "ca să reglezi viteza chiar în timp ce vorbești.\n\n" +
        "Poți da **click pe orice paragraf** ca să sari direct la el. " +
        "Apasă tasta **?** în modul prompter pentru toate scurtăturile.\n\n" +
        "## Mult succes la predare!",
      updated: nowStamp(),
    };
  }

  /* ------------------------- API public ------------------------- */

  return {
    init: init,
    /** Scriptul activ curent (salvează întâi ce e în editor). */
    getActive: function () {
      saveCurrent(false);
      return findById(activeId);
    },
    getActiveId: function () { return activeId; },
    /** Adaugă un script nou (folosit de platformă la „Încarcă un curs”). */
    addScript: function (name, text) {
      var s = { id: TP.Storage.uid(), name: name || "Curs", text: text || "", updated: nowStamp() };
      scripts.unshift(s);
      TP.Storage.saveScripts(scripts);
      activeId = s.id;
      renderList();
      loadIntoEditor(s.id);
      return s.id;
    },
  };
})();
