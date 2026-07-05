/* =====================================================================
   TP.Remote — SCHELET pentru telecomanda de pe telefon (extensie viitoare)
   ---------------------------------------------------------------------
   NU este implementat acum — există doar ca punct de extindere clar.

   Ideea de arhitectură (pentru mai târziu):
     - Un canal (WebSocket sau WebRTC DataChannel) primește comenzi de pe
       telefon: play / pause / speed+ / speed- / seek / restart.
     - Toate comenzile se traduc în apeluri către API-ul public al
       prompterului (TP.Prompter.play(), .nudgeSpeed(), .seekLines() etc.),
       exact aceleași metode folosite de tastatură. Astfel telecomanda nu
       are nevoie să știe nimic despre interiorul prompterului.

   Ca să activezi mai târziu, implementează `connect()` și rutează mesajele
   prin `handleCommand()`.
   ===================================================================== */
window.TP = window.TP || {};

TP.Remote = (function () {
  "use strict";

  var channel = null;
  var enabled = false;

  /** Mapează o comandă abstractă la acțiunea corespunzătoare din prompter. */
  function handleCommand(cmd) {
    if (!TP.Prompter.isOpen()) return;
    switch (cmd && cmd.type) {
      case "play":      TP.Prompter.play(); break;
      case "pause":     TP.Prompter.pause(); break;
      case "toggle":    TP.Prompter.toggle(); break;
      case "speed":     TP.Prompter.setSpeed(cmd.value); break;
      case "speedDelta":TP.Prompter.nudgeSpeed(cmd.value); break;
      case "seekLines": TP.Prompter.seekLines(cmd.value); break;
      case "restart":   TP.Prompter.restart(); break;
      default: /* comandă necunoscută — ignorată */ break;
    }
  }

  /** Punct de intrare pentru viitoarea conexiune (WebSocket/WebRTC). */
  function connect(/* opts */) {
    console.info("[Remote] Neimplementat încă. Aici s-ar deschide canalul de telecomandă.");
    // Exemplu de structură viitoare:
    // channel = new WebSocket(opts.url);
    // channel.onmessage = function (ev) { handleCommand(JSON.parse(ev.data)); };
    // enabled = true;
  }

  function disconnect() {
    if (channel) { try { channel.close(); } catch (e) {} channel = null; }
    enabled = false;
  }

  return {
    connect: connect,
    disconnect: disconnect,
    handleCommand: handleCommand, // expus pentru testare/hook-uri viitoare
    isEnabled: function () { return enabled; },
  };
})();
