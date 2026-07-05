/* =====================================================================
   TP.Storage — strat subțire peste localStorage
   ---------------------------------------------------------------------
   Toate datele aplicației trăiesc local, în browser:
     - lista de scripturi (tp.scripts)
     - setările de text (tp.settings)
     - starea sesiunii: script activ, poziție, viteză (tp.session)

   Modul izolat, ca să putem înlocui ușor backendul mai târziu
   (ex. sincronizare cu telefonul) fără să atingem restul aplicației.
   ===================================================================== */
window.TP = window.TP || {};

TP.Storage = (function () {
  "use strict";

  var KEYS = {
    scripts: "tp.scripts",
    settings: "tp.settings",
    session: "tp.session",
  };

  /** Citește și parsează în siguranță o cheie JSON; întoarce `fallback` la eroare. */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn("[Storage] Nu am putut citi", key, e);
      return fallback;
    }
  }

  /** Scrie o valoare ca JSON. Întoarce true/false după succes. */
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("[Storage] Nu am putut scrie", key, e);
      return false;
    }
  }

  return {
    // --- Scripturi -----------------------------------------------------
    getScripts: function () { return read(KEYS.scripts, []); },
    saveScripts: function (list) { return write(KEYS.scripts, list); },

    // --- Setări --------------------------------------------------------
    getSettings: function () { return read(KEYS.settings, null); },
    saveSettings: function (obj) { return write(KEYS.settings, obj); },

    // --- Sesiune (poziție/viteză/script activ) -------------------------
    getSession: function () { return read(KEYS.session, {}); },
    saveSession: function (obj) { return write(KEYS.session, obj); },

    // --- Utilitare -----------------------------------------------------
    /** ID scurt, suficient de unic pentru chei locale (nu criptografic). */
    uid: function () {
      return "s_" + Math.floor(performance.now() * 1000).toString(36) +
             "_" + (this._n = (this._n || 0) + 1).toString(36);
    },
  };
})();
