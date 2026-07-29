/* =====================================================================
   TP.Prompter — motorul de derulare
   ---------------------------------------------------------------------
   Principii tehnice:
     - Derularea folosește `transform: translateY(-offset)` actualizat într-o
       buclă `requestAnimationFrame` (NU scrollTop, NU setInterval), pentru
       fluiditate perfectă la orice viteză.
     - Viteza e exprimată intuitiv în CUVINTE/MINUT. O convertim în pixeli/secundă
       raportând înălțimea totală a conținutului la numărul de cuvinte, deci
       ritmul rămâne corect indiferent de dimensiunea fontului.
     - Starea (poziție, viteză, script activ) se salvează în sesiune, ca să
       supraviețuiască intrării/ieșirii din fullscreen și reîncărcării paginii.

   Arhitectură pregătită pentru extensii (vezi remote.js / voice.js):
   toate acțiunile trec prin metodele publice (play/pause/setSpeed/seekTo...),
   astfel încât o telecomandă sau urmărirea vocală să le poată apela identic.
   ===================================================================== */
window.TP = window.TP || {};

TP.Prompter = (function () {
  "use strict";

  var els = {};
  var state = {
    open: false,
    playing: false,
    counting: false,
    offset: 0,        // px derulați din vârf
    maxOffset: 0,     // limita inferioară de derulare
    viewport: 0,      // înălțimea zonei vizibile
    guideY: 0,        // poziția liniei de ghidaj în px
    pxPerWord: 1,     // câți px ocupă (în medie) un cuvânt pe verticală
    words: 1,
    scriptId: null,
    raf: 0,
    lastTs: null,
    hideTimer: 0,
  };

  var LINE_JUMP = 3; // câte rânduri sar săgețile stânga/dreapta

  function $(id) { return document.getElementById(id); }

  function init() {
    els = {
      screen: $("screen-prompter"),
      mirror: $("prompter-mirror"),
      track: $("prompter-track"),
      progress: $("progress-bar"),
      controls: $("prompter-controls"),
      countdown: $("countdown"),
      countdownNum: $("countdown-num"),
      shortcuts: $("shortcuts"),
      speed: $("ctl-speed"),
      speedVal: $("ctl-speed-val"),
      play: $("ctl-play"),
      mirrorBtn: $("ctl-mirror"),
    };

    bindControls();
    bindKeyboard();
    bindPointer();

    // Reacționăm la schimbări de setări (font, coloană, ghidaj) recalculând geometria
    TP.Settings.onChange(function () {
      if (state.open) {
        // păstrăm poziția relativă în text
        var frac = state.maxOffset ? state.offset / state.maxOffset : 0;
        measure();
        seekToOffset(frac * state.maxOffset, false);
        syncSpeedUI();
      }
    });
  }

  /* =================== DESCHIDERE / ÎNCHIDERE =================== */

  function open(script) {
    if (!script) { TP.toast("Nu există niciun script de rulat"); return; }
    var settings = TP.Settings.get();

    // Randăm textul în track
    TP.Markdown.renderInto(els.track, script.text);
    state.words = Math.max(1, TP.Markdown.countWords(script.text));
    state.scriptId = script.id;

    // Comutăm ecranele
    els.screen.hidden = false;
    els.screen.classList.remove("controls-hidden");
    state.open = true;

    // Legăm click-to-jump pe blocurile randate
    attachJumpHandlers();

    // Geometria trebuie măsurată după ce layout-ul s-a așezat
    requestAnimationFrame(function () {
      measure();

      // Reluăm poziția/viteza din sesiune dacă e același script
      var session = TP.Storage.getSession();
      if (session && session.scriptId === script.id && typeof session.offset === "number") {
        seekToOffset(session.offset, false);
      } else {
        seekToOffset(0, false);
      }
      syncSpeedUI();
      persist();

      startLoop();
      showControls();
    });
  }

  function close() {
    pause();
    stopLoop();
    exitFullscreen();
    state.open = false;
    els.screen.hidden = true;
    els.shortcuts.hidden = true;
    persist();
  }

  /* =================== MĂSURAREA GEOMETRIEI =================== */

  function measure() {
    var settings = TP.Settings.get();
    state.viewport = els.screen.clientHeight || window.innerHeight;
    state.guideY = state.viewport * (settings.guide / 100);

    // Padding sus/jos pe track: primul rând poate începe fix pe ghidaj,
    // iar ultimul rând poate urca până pe ghidaj.
    els.track.style.paddingTop = state.guideY + "px";
    els.track.style.paddingBottom = (state.viewport - state.guideY) + "px";

    var contentHeight = els.track.scrollHeight - state.viewport; // = înălțimea reală a textului
    state.maxOffset = Math.max(0, contentHeight);
    state.pxPerWord = contentHeight / state.words;

    applyTransform();
    updateProgress();
  }

  /* =================== BUCLA rAF =================== */

  function startLoop() {
    if (state.raf) return;
    state.lastTs = null;
    state.raf = requestAnimationFrame(frame);
  }
  function stopLoop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  function frame(ts) {
    if (state.lastTs == null) state.lastTs = ts;
    var dt = (ts - state.lastTs) / 1000; // secunde
    state.lastTs = ts;

    if (state.playing) {
      state.offset += pxPerSec() * dt;
      if (state.offset >= state.maxOffset) {
        state.offset = state.maxOffset;
        pause();
        TP.toast("Sfârșitul scriptului");
      }
      applyTransform();
      updateProgress();
      persistThrottled(ts);
    }
    state.raf = requestAnimationFrame(frame);
  }

  /** Viteza în pixeli/secundă, derivată din cuvinte/minut. */
  function pxPerSec() {
    var wpm = TP.Settings.get().speed;
    return (wpm / 60) * state.pxPerWord;
  }

  function applyTransform() {
    els.track.style.transform = "translateY(" + (-state.offset) + "px)";
  }

  function updateProgress() {
    var pct = state.maxOffset ? (state.offset / state.maxOffset) * 100 : 0;
    els.progress.style.width = pct.toFixed(2) + "%";
  }

  /* =================== ACȚIUNI PUBLICE (folosite și de extensii) =================== */

  function play() {
    if (state.playing || !state.open) return;
    var settings = TP.Settings.get();
    if (settings.countdown) {
      runCountdown(3, function () { startScroll(); });
    } else {
      startScroll();
    }
  }

  function startScroll() {
    state.playing = true;
    state.lastTs = null;
    setPlayLabel();
    scheduleControlsHide();
  }

  function pause() {
    state.playing = false;
    cancelCountdown();
    setPlayLabel();
    showControls();
    persist();
  }

  function toggle() { state.playing ? pause() : play(); }

  /** Ajustează viteza (cuv/min) cu un delta și o reflectă în UI. */
  function nudgeSpeed(delta) {
    var s = TP.Settings.get();
    var v = Math.max(40, Math.min(320, s.speed + delta));
    TP.Settings.set({ speed: v });
    syncSpeedUI();
    flashControls();
  }

  function setSpeed(v) {
    v = Math.max(40, Math.min(320, Math.round(v)));
    TP.Settings.set({ speed: v });
    syncSpeedUI();
  }

  /** Sare la un offset absolut (px), opțional cu clamp. */
  function seekToOffset(px, persistNow) {
    state.offset = Math.max(0, Math.min(state.maxOffset, px));
    applyTransform();
    updateProgress();
    if (persistNow !== false) persist();
  }

  /** Sare relativ cu un număr de rânduri (folosit de săgețile stânga/dreapta). */
  function seekLines(n) {
    var s = TP.Settings.get();
    var lineHeightPx = s.fontSize * s.lineHeight;
    seekToOffset(state.offset + n * lineHeightPx);
    flashControls();
  }

  function restart() { seekToOffset(0); flashControls(); }

  function toggleMirror() {
    var m = !TP.Settings.get().mirror;
    TP.Settings.set({ mirror: m });
    els.mirrorBtn.classList.toggle("is-active", m);
    flashControls();
  }

  /* =================== NUMĂRĂTOARE INVERSĂ =================== */

  var countdownTimer = 0;
  function runCountdown(from, done) {
    cancelCountdown();
    state.counting = true;
    els.countdown.hidden = false;
    var n = from;

    function tick() {
      if (n <= 0) {
        els.countdown.hidden = true;
        state.counting = false;
        countdownTimer = 0;
        done();
        return;
      }
      els.countdownNum.textContent = n;
      // repornim animația CSS
      els.countdownNum.style.animation = "none";
      void els.countdownNum.offsetWidth;
      els.countdownNum.style.animation = "";
      n--;
      countdownTimer = setTimeout(tick, 800);
    }
    tick();
  }
  function cancelCountdown() {
    if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = 0; }
    state.counting = false;
    els.countdown.hidden = true;
  }

  /* =================== FULLSCREEN =================== */

  function toggleFullscreen() {
    var d = document;
    if (!d.fullscreenElement) {
      (els.screen.requestFullscreen || els.screen.webkitRequestFullscreen || function () {}).call(els.screen);
    } else {
      exitFullscreen();
    }
  }
  function exitFullscreen() {
    if (document.fullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    }
  }

  /* =================== UI: butoane, taste, pointer =================== */

  function bindControls() {
    els.play.addEventListener("click", toggle);
    $("ctl-exit").addEventListener("click", close);
    $("ctl-restart").addEventListener("click", restart);
    els.mirrorBtn.addEventListener("click", toggleMirror);
    $("ctl-fullscreen").addEventListener("click", toggleFullscreen);
    $("ctl-help").addEventListener("click", toggleShortcuts);
    $("shortcuts-close").addEventListener("click", function () { els.shortcuts.hidden = true; });

    els.speed.addEventListener("input", function () { setSpeed(parseInt(els.speed.value, 10)); });

    // Recalculăm geometria la resize și la schimbarea stării de fullscreen
    window.addEventListener("resize", function () { if (state.open) preserveAndMeasure(); });
    document.addEventListener("fullscreenchange", function () { if (state.open) preserveAndMeasure(); });
  }

  function preserveAndMeasure() {
    var frac = state.maxOffset ? state.offset / state.maxOffset : 0;
    measure();
    seekToOffset(frac * state.maxOffset, false);
  }

  function bindKeyboard() {
    document.addEventListener("keydown", function (e) {
      if (!state.open) return;

      // Ajutorul „?” se deschide/închide oricând
      if (e.key === "?") { e.preventDefault(); toggleShortcuts(); return; }
      // Dacă overlay-ul de ajutor e deschis, Esc îl închide întâi
      if (!els.shortcuts.hidden && e.key === "Escape") { els.shortcuts.hidden = true; return; }

      switch (e.key) {
        case " ": case "Spacebar":
          e.preventDefault();
          if (state.counting) { cancelCountdown(); startScroll(); } // Spațiu în timpul numărătorii = pornire imediată
          else toggle();
          break;
        case "ArrowUp":   e.preventDefault(); nudgeSpeed(+5); break;
        case "ArrowDown": e.preventDefault(); nudgeSpeed(-5); break;
        case "ArrowLeft": e.preventDefault(); seekLines(-LINE_JUMP); break;
        case "ArrowRight":e.preventDefault(); seekLines(+LINE_JUMP); break;
        case "Home":      e.preventDefault(); restart(); break;
        case "f": case "F": e.preventDefault(); toggleFullscreen(); break;
        case "m": case "M": e.preventDefault(); toggleMirror(); break;
        case "Escape":    e.preventDefault(); close(); break;
      }
    });
  }

  function bindPointer() {
    // Orice mișcare arată controalele; se ascund din nou după inactivitate
    ["mousemove", "touchstart"].forEach(function (ev) {
      els.screen.addEventListener(ev, showControls, { passive: true });
    });
  }

  /** Atașează salt-la-click pe fiecare bloc de text randat. */
  function attachJumpHandlers() {
    els.track.addEventListener("click", function (e) {
      var block = e.target.closest(".tp-block");
      if (!block) return;
      // offset relativ la începutul conținutului (paddingTop = guideY)
      var target = block.offsetTop - state.guideY;
      seekToOffset(target);
      flashControls();
    });
  }

  /* =================== HELPERE UI =================== */

  function setPlayLabel() {
    els.play.textContent = state.playing ? "⏸ Pauză" : "▶ Start";
    els.play.classList.toggle("is-active", state.playing);
  }

  function syncSpeedUI() {
    var v = TP.Settings.get().speed;
    els.speed.value = v;
    els.speedVal.textContent = v;
    els.mirrorBtn.classList.toggle("is-active", !!TP.Settings.get().mirror);
  }

  function toggleShortcuts() { els.shortcuts.hidden = !els.shortcuts.hidden; }

  function showControls() {
    els.screen.classList.remove("controls-hidden");
    scheduleControlsHide();
  }
  function scheduleControlsHide() {
    clearTimeout(state.hideTimer);
    if (!state.playing) return; // ascundem doar în timpul derulării
    state.hideTimer = setTimeout(function () {
      els.screen.classList.add("controls-hidden");
    }, 3000);
  }
  function flashControls() { showControls(); }

  /* =================== PERSISTENȚĂ SESIUNE =================== */

  var lastPersist = 0;
  function persist() {
    TP.Storage.saveSession(Object.assign(TP.Storage.getSession(), {
      scriptId: state.scriptId,
      offset: state.offset,
      speed: TP.Settings.get().speed,
    }));
  }
  function persistThrottled(ts) {
    if (ts - lastPersist > 800) { lastPersist = ts; persist(); }
  }

  /* =================== API PUBLIC =================== */

  return {
    init: init,
    open: open,
    close: close,
    // acțiuni expuse pentru telecomandă / urmărire vocală
    play: play,
    pause: pause,
    toggle: toggle,
    setSpeed: setSpeed,
    nudgeSpeed: nudgeSpeed,
    seekToOffset: seekToOffset,
    seekLines: seekLines,
    restart: restart,
    isOpen: function () { return state.open; },
    getState: function () { return state; },
  };
})();
