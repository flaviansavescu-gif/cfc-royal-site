/* =====================================================================
   TP.Markdown — parser minimal, exact cât cere prompterul
   ---------------------------------------------------------------------
   Suportă intenționat DOAR:
     - `## Titlu`  -> <h2 class="tp-section"> (culoare accent)
     - `**bold**`  -> <strong>
     - paragrafe   -> separate prin rânduri goale, păstrate
   Orice altceva rămâne text simplu. Nu folosim innerHTML pe input brut:
   escapăm întâi HTML-ul, apoi injectăm doar marcajele noastre controlate.
   ===================================================================== */
window.TP = window.TP || {};

TP.Markdown = (function () {
  "use strict";

  /** Escapează caracterele HTML periculoase din textul utilizatorului. */
  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /** Transformă **bold** în <strong>bold</strong> (după escaping). */
  function inline(s) {
    return escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  /**
   * Împarte textul în blocuri (titluri și paragrafe).
   * Întoarce un array de obiecte { type: "section"|"para", html }.
   * Folosit atât pentru randare cât și pentru numărarea cuvintelor.
   */
  function parseBlocks(text) {
    var lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
    var blocks = [];
    var buffer = [];

    function flushParagraph() {
      if (!buffer.length) return;
      var joined = buffer.join(" ").trim();
      if (joined) blocks.push({ type: "para", html: inline(joined) });
      buffer = [];
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();

      if (trimmed === "") {
        // Rând gol = separator de paragraf
        flushParagraph();
        continue;
      }
      // Titlu de secțiune: `## ...` (acceptăm și `#`)
      var h = trimmed.match(/^#{1,6}\s+(.*)$/);
      if (h) {
        flushParagraph();
        blocks.push({ type: "section", html: inline(h[1]) });
        continue;
      }
      buffer.push(trimmed);
    }
    flushParagraph();
    return blocks;
  }

  /**
   * Randează blocurile în elemente DOM și le adaugă în `container`.
   * Fiecare bloc devine <p> sau <h2>, ca țintă pentru click-to-jump.
   */
  function renderInto(container, text) {
    container.textContent = "";
    var blocks = parseBlocks(text);
    if (!blocks.length) {
      var empty = document.createElement("p");
      empty.textContent = "(Script gol)";
      container.appendChild(empty);
      return;
    }
    blocks.forEach(function (b) {
      var el = document.createElement(b.type === "section" ? "h2" : "p");
      if (b.type === "section") el.className = "tp-section";
      el.className += (el.className ? " " : "") + "tp-block";
      el.innerHTML = b.html; // sigur: conținutul e escapat, doar <strong> injectat
      container.appendChild(el);
    });
  }

  /** Numără cuvintele din text (ignoră marcajele markdown). */
  function countWords(text) {
    var plain = String(text || "")
      .replace(/[#*]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain) return 0;
    return plain.split(" ").length;
  }

  return {
    parseBlocks: parseBlocks,
    renderInto: renderInto,
    countWords: countWords,
    escapeHtml: escapeHtml,
  };
})();
