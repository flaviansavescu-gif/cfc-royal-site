/* =====================================================================
   TP.Voice — SCHELET pentru urmărirea vocală (extensie viitoare)
   ---------------------------------------------------------------------
   NU este implementat acum — există doar ca punct de extindere clar.

   Ideea de arhitectură (pentru mai târziu):
     - Web Speech API (SpeechRecognition) transcrie live ce spune prezentatorul.
     - Un algoritm de aliniere compară cuvintele recunoscute cu textul
       scriptului și estimează unde a ajuns vorbitorul.
     - În loc de derulare cu viteză fixă, prompterul ar sincroniza poziția
       apelând `TP.Prompter.seekToOffset(...)` sau ajustând viteza fin, tot
       prin API-ul public existent.

   Ca să activezi mai târziu: pornește recunoașterea în `start()`, calculează
   poziția probabilă și cheam-o pe `TP.Prompter.seekToOffset()`.
   ===================================================================== */
window.TP = window.TP || {};

TP.Voice = (function () {
  "use strict";

  var recognition = null;
  var active = false;

  /** Există suport în browser pentru Web Speech API? (folosit de UI mai târziu) */
  function isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function start(/* opts */) {
    console.info("[Voice] Neimplementat încă. Aici ar porni urmărirea vocală.");
    // Exemplu de structură viitoare:
    // var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    // recognition = new Rec();
    // recognition.lang = "ro-RO";
    // recognition.continuous = true;
    // recognition.interimResults = true;
    // recognition.onresult = onResult; // -> aliniere -> TP.Prompter.seekToOffset(...)
    // recognition.start();
    // active = true;
  }

  function stop() {
    if (recognition) { try { recognition.stop(); } catch (e) {} recognition = null; }
    active = false;
  }

  return {
    isSupported: isSupported,
    start: start,
    stop: stop,
    isActive: function () { return active; },
  };
})();
