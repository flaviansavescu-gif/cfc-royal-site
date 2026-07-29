/* =====================================================================
   TP.Platform — legătura cu platforma de cursuri CFC-Royal
   ---------------------------------------------------------------------
   Butonul „Încarcă un curs din platformă" citește programa lectorilor
   (cursuri.json, generat de site din datele platformei) și adaugă
   cursul ales în biblioteca teleprompterului, gata de susținere.
   Funcționează doar când aplicația rulează pe platformă (nu pe file://).
   ===================================================================== */
window.TP = window.TP || {};

TP.Platform = (function () {
  "use strict";

  var URL_PROGRAMA = "cursuri.json"; // relativ la /cursuri/teleprompter/

  function $(id) { return document.getElementById(id); }

  function init() {
    var btn = $("btn-platform-course");
    if (!btn) return;
    btn.addEventListener("click", deschide);
    $("platform-dialog-close").addEventListener("click", inchide);
    $("platform-dialog").addEventListener("click", function (e) {
      if (e.target === this) inchide(); // click pe fundal închide
    });
  }

  function deschide() {
    var dlg = $("platform-dialog");
    var list = $("platform-dialog-list");
    dlg.hidden = false;
    list.textContent = "Se încarcă programa…";

    fetch(URL_PROGRAMA)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { randeaza(data.lectori || []); })
      .catch(function () {
        list.textContent = "Programa nu este disponibilă aici. Deschide teleprompterul din platforma de cursuri (cfc-royal.ro/cursuri/).";
      });
  }

  function inchide() { $("platform-dialog").hidden = true; }

  function randeaza(lectori) {
    var list = $("platform-dialog-list");
    list.textContent = "";
    if (!lectori.length) {
      list.textContent = "Niciun curs publicat încă în programă.";
      return;
    }
    lectori.forEach(function (l) {
      var grup = document.createElement("div");
      grup.className = "platform-dialog__group";

      var titlu = document.createElement("h3");
      titlu.textContent = l.lector;
      grup.appendChild(titlu);

      l.cursuri.forEach(function (c) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "platform-dialog__item";
        item.textContent = c.titlu;
        item.addEventListener("click", function () { incarca(c, item); });
        grup.appendChild(item);
      });

      list.appendChild(grup);
    });
  }

  function incarca(curs, item) {
    item.disabled = true;
    item.textContent = curs.titlu + " — se încarcă…";
    fetch(curs.url)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        TP.Library.addScript(curs.titlu, text);
        inchide();
        TP.toast('Cursul „' + curs.titlu + '” a fost adăugat în bibliotecă');
      })
      .catch(function () {
        item.disabled = false;
        item.textContent = curs.titlu;
        TP.toast("Nu am putut încărca acest curs. Încearcă din nou.");
      });
  }

  return { init: init };
})();
