/* Photo Anatomy Annotator — editor canvas (client-side).
   Coordonate normalizate 0..1 relative la imagine; distanțe corectate cu aspect.
   Estimări 2D — instrument didactic, nu evaluare oficială. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); };
  var API = "/.netlify/functions/";

  // —— math (identic cu _paa/masuratori.mjs) ——
  function distanta(a, b, asp) { if (!a || !b) return NaN; var dx = (a.x - b.x) * (asp || 1), dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function unghiABC(a, b, c, asp) { asp = asp || 1; var ux = (a.x - b.x) * asp, uy = a.y - b.y, vx = (c.x - b.x) * asp, vy = c.y - b.y; var mu = Math.hypot(ux, uy), mv = Math.hypot(vx, vy); if (!mu || !mv) return NaN; var cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (mu * mv))); return Math.acos(cos) * 180 / Math.PI; }
  function procent(v, r) { return (!r || isNaN(r) || isNaN(v)) ? NaN : 100 * v / r; }
  function raport(x, y) { return (!y || isNaN(y) || isNaN(x)) ? NaN : x / y; }
  function rot(v, n) { n = n == null ? 1 : n; return isNaN(v) ? null : Math.round(v * Math.pow(10, n)) / Math.pow(10, n); }
  function statusInterval(v, m) {
    if (isNaN(v)) return { status: "neconcludent", motiv: "Valoare indisponibilă sau reper lipsă." };
    m = m || {}; var min = m.min == null ? null : +m.min, max = m.max == null ? null : +m.max;
    if ((min == null || isNaN(min)) && (max == null || isNaN(max))) return { status: "informativ", motiv: "Metrică fără interval — informativ." };
    if ((min != null && v < min) || (max != null && v > max)) return { status: "neconform", motiv: "Valoarea " + rot(v) + " în afara intervalului." };
    return { status: "conform", motiv: "Valoarea " + rot(v) + " se încadrează în interval." };
  }

  var REPERE = [
    { id: "greaban", nume: "Greabăn" }, { id: "crupa", nume: "Crupă" }, { id: "stern", nume: "Stern" },
    { id: "umar", nume: "Umăr" }, { id: "cot", nume: "Cot" }, { id: "carp", nume: "Carp" },
    { id: "sold", nume: "Șold" }, { id: "genunchi", nume: "Genunchi" }, { id: "jaret", nume: "Jaret" }, { id: "baza_cozii", nume: "Baza cozii" },
  ];
  var MASURATORI = [
    { rol: "inaltime_greaban", nume: "Înălțime la greabăn" }, { rol: "lungime_corp", nume: "Lungime corp" },
    { rol: "adancime_torace", nume: "Adâncime torace" }, { rol: "segment_membru_anterior", nume: "Segment membru anterior" },
    { rol: "lungime_craniu", nume: "Lungime craniu" }, { rol: "lungime_bot", nume: "Lungime bot" },
  ];
  var METRICI_DEF = [
    { key: "indice_corporal", nume: "Indice corporal", formula: "100 × lungime corp / înălțime greabăn", unit: "%" },
    { key: "adancime_torace", nume: "Adâncime torace", formula: "100 × adâncime torace / înălțime greabăn", unit: "%" },
    { key: "segment_membru_anterior", nume: "Segment membru anterior", formula: "100 × segment / înălțime greabăn", unit: "%" },
    { key: "raport_craniu_bot", nume: "Raport craniu-bot", formula: "lungime craniu / lungime bot", unit: "" },
  ];
  var URMATOR = { indice_corporal: "adâncimea toracelui", adancime_torace: "segmentul membrului anterior", segment_membru_anterior: "raportul craniu-bot", raport_craniu_bot: "verificarea unghiurilor (umăr, jaret)" };

  // —— state ——
  var S = {
    img: null, imgW: 0, imgH: 0, imageId: null, aspect: 1,
    view: { scale: 1, tx: 0, ty: 0 },
    layers: [{ id: "l1", nume: "Strat 1", vizibil: true, blocat: false }],
    stratSel: "l1",
    annots: [], sel: null,
    measurements: {}, // rol -> {a,b}
    calibrare: { mod: "relativ", greabanCm: null, referintaCm: null },
    tool: "select", reperActiv: null, masActiv: null,
    temp: null, drag: null, pan: null, spaceDown: false,
    undo: [], redo: [], sesiuneId: null, titlu: "Sesiune de adnotare", rasa: "",
    standard: null,
  };
  var cid = null; try { cid = (JSON.parse(localStorage.getItem("cfcrCandidat") || "null") || {}).id || null; } catch (e) {}
  var exId = new URLSearchParams(location.search).get("ex");

  var canvas = $("pa-canvas"), ctx = canvas.getContext("2d"), stage = document.querySelector(".pa-stage");

  function toast(msg, err) { var t = $("pa-toast"); t.textContent = msg; t.className = "pa-toast" + (err ? " is-err" : ""); t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3000); }

  // —— coordonate ——
  function toCanvas(n) { return { x: n.x * S.imgW * S.view.scale + S.view.tx, y: n.y * S.imgH * S.view.scale + S.view.ty }; }
  function toNorm(cx, cy) { return { x: (cx - S.view.tx) / (S.view.scale * S.imgW), y: (cy - S.view.ty) / (S.view.scale * S.imgH) }; }
  function evPos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function syncSize() {
    var w = stage.clientWidth || 1, h = stage.clientHeight || 1, dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function resize() { syncSize(); render(); }
  function incadreaza() {
    if (!S.img) return;
    syncSize();
    var w = stage.clientWidth, h = stage.clientHeight;
    S.view.scale = Math.min(w / S.imgW, h / S.imgH) * 0.96;
    S.view.tx = (w - S.imgW * S.view.scale) / 2; S.view.ty = (h - S.imgH * S.view.scale) / 2;
    render();
  }

  // —— randare ——
  function render() {
    var w = stage.clientWidth, h = stage.clientHeight;
    ctx.clearRect(0, 0, w, h);
    if (!S.img) return;
    ctx.drawImage(S.img, S.view.tx, S.view.ty, S.imgW * S.view.scale, S.imgH * S.view.scale);
    // măsurători (linii cyan)
    Object.keys(S.measurements).forEach(function (rol) { var m = S.measurements[rol]; if (m && m.a && m.b) drawLine(m.a, m.b, "#0d6efd", 2, etichetaMas(rol)); });
    // adnotări (pe straturi vizibile)
    S.annots.forEach(function (an) {
      var lay = layer(an.layerId); if (lay && !lay.vizibil) return;
      drawAnnot(an, an.id === S.sel);
    });
    // temp (desen în curs)
    if (S.temp) drawTemp();
    $("zoomVal").textContent = Math.round(S.view.scale / baseScale() * 100) + "%";
  }
  function baseScale() { return Math.min(stage.clientWidth / S.imgW, stage.clientHeight / S.imgH) * 0.96 || 1; }
  function drawPoint(n, color, r) { var p = toCanvas(n); ctx.beginPath(); ctx.arc(p.x, p.y, r || 5, 0, 7); ctx.fillStyle = color || "#c0392b"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "#fff"; ctx.stroke(); }
  function drawLine(a, b, color, wdt, txt) { var p = toCanvas(a), q = toCanvas(b); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = color; ctx.lineWidth = wdt || 2; ctx.stroke(); drawPoint(a, color, 3); drawPoint(b, color, 3); if (txt) label((p.x + q.x) / 2, (p.y + q.y) / 2, txt, color); }
  function label(x, y, txt, color) { ctx.font = "12px system-ui,sans-serif"; var tw = ctx.measureText(txt).width; ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(x - tw / 2 - 3, y - 16, tw + 6, 15); ctx.fillStyle = color || "#23241f"; ctx.textAlign = "center"; ctx.fillText(txt, x, y - 5); ctx.textAlign = "start"; }
  function drawAnnot(an, selv) {
    var col = selv ? "#1F4D3A" : "#c0392b";
    if (an.type === "point") { drawPoint(an.points[0], col, 6); if (an.eticheta) { var p = toCanvas(an.points[0]); label(p.x, p.y - 6, an.eticheta, "#1F4D3A"); } }
    else if (an.type === "line") { drawLine(an.points[0], an.points[1], col, 2, an.eticheta); }
    else if (an.type === "polyline") { for (var i = 0; i < an.points.length - 1; i++) drawLine(an.points[i], an.points[i + 1], col, 2); an.points.forEach(function (pt) { drawPoint(pt, col, 3); }); }
    else if (an.type === "angle") { drawLine(an.points[0], an.points[1], col, 2); drawLine(an.points[1], an.points[2], col, 2); var deg = unghiABC(an.points[0], an.points[1], an.points[2], S.aspect); var v = toCanvas(an.points[1]); label(v.x, v.y - 8, (isNaN(deg) ? "—" : rot(deg) + "°"), "#8a6d1f"); }
    else if (an.type === "label") { var lp = toCanvas(an.points[0]); label(lp.x, lp.y, an.eticheta || "text", "#1F4D3A"); drawPoint(an.points[0], col, 3); }
  }
  function drawTemp() {
    var t = S.temp;
    if (t.type === "line" && t.points[0] && t.cur) drawLine(t.points[0], t.cur, "#8a6d1f", 1.5);
    if (t.type === "angle") { for (var i = 0; i < t.points.length - 1; i++) drawLine(t.points[i], t.points[i + 1], "#8a6d1f", 1.5); if (t.points.length && t.cur) drawLine(t.points[t.points.length - 1], t.cur, "#8a6d1f", 1.5); t.points.forEach(function (p) { drawPoint(p, "#8a6d1f", 4); }); }
    if (t.type === "polyline") { for (var j = 0; j < t.points.length - 1; j++) drawLine(t.points[j], t.points[j + 1], "#8a6d1f", 1.5); if (t.points.length && t.cur) drawLine(t.points[t.points.length - 1], t.cur, "#8a6d1f", 1.5); t.points.forEach(function (p) { drawPoint(p, "#8a6d1f", 4); }); }
    if (t.type === "mas" && t.points[0] && t.cur) drawLine(t.points[0], t.cur, "#0d6efd", 1.5);
  }
  function etichetaMas(rol) { var d = S.measurements[rol]; var v = d && d.a && d.b ? distanta(d.a, d.b, S.aspect) : NaN; var def = MASURATORI.filter(function (m) { return m.rol === rol; })[0]; return (def ? def.nume : rol) + (isNaN(v) ? "" : " " + rot(v, 3)); }

  function layer(id) { for (var i = 0; i < S.layers.length; i++) if (S.layers[i].id === id) return S.layers[i]; return null; }

  // —— undo/redo ——
  function snapshot() { S.undo.push(JSON.stringify({ annots: S.annots, layers: S.layers, measurements: S.measurements })); if (S.undo.length > 60) S.undo.shift(); S.redo = []; updUndo(); }
  function restore(str) { var o = JSON.parse(str); S.annots = o.annots; S.layers = o.layers; S.measurements = o.measurements; if (!layer(S.stratSel)) S.stratSel = S.layers[0] && S.layers[0].id; }
  function undo() { if (!S.undo.length) return; S.redo.push(JSON.stringify({ annots: S.annots, layers: S.layers, measurements: S.measurements })); restore(S.undo.pop()); S.sel = null; renderAll(); }
  function redo() { if (!S.redo.length) return; S.undo.push(JSON.stringify({ annots: S.annots, layers: S.layers, measurements: S.measurements })); restore(S.redo.pop()); S.sel = null; renderAll(); }
  function updUndo() { $("btnUndo").disabled = !S.undo.length; $("btnRedo").disabled = !S.redo.length; }

  function renderAll() { render(); renderLayers(); renderMasuratori(); renderRezultate(); updUndo(); }

  // —— interacțiuni ——
  function hitAnnot(nc) {
    // returnează {an, idx} pentru punctul cel mai apropiat sub cursor
    var best = null, bd = 12 / (S.view.scale * S.imgW); // toleranță în unități norm x
    for (var i = S.annots.length - 1; i >= 0; i--) { var an = S.annots[i]; var lay = layer(an.layerId); if (lay && (!lay.vizibil || lay.blocat)) continue; for (var j = 0; j < an.points.length; j++) { var p = an.points[j]; var dx = (p.x - nc.x) * S.aspect, dy = p.y - nc.y; var d = Math.sqrt(dx * dx + dy * dy); if (d < bd * S.aspect) { best = { an: an, idx: j, d: d }; } } }
    return best;
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (!S.img) return; canvas.setPointerCapture(e.pointerId); var pos = evPos(e), n = toNorm(pos.x, pos.y);
    if (S.tool === "pan" || S.spaceDown || e.button === 1) { S.pan = { x: pos.x, y: pos.y, tx: S.view.tx, ty: S.view.ty }; return; }
    if (S.masActiv) { tempMas(n); return; }
    if (S.tool === "select") { var h = hitAnnot(n); if (h) { S.sel = h.an.id; S.drag = { an: h.an, idx: h.idx }; } else S.sel = null; renderAll(); return; }
    if (S.tool === "point") { addAnnot({ type: "point", points: [clamp(n)], eticheta: S.reperActiv ? reperNume(S.reperActiv) : "", reper: S.reperActiv || null }); if (S.reperActiv) { S.reperActiv = null; renderRepere(); } return; }
    if (S.tool === "label") { var txt = prompt("Text etichetă:"); if (txt) addAnnot({ type: "label", points: [clamp(n)], eticheta: txt }); return; }
    if (S.tool === "line") { if (!S.temp) { S.temp = { type: "line", points: [clamp(n)] }; } else { addAnnot({ type: "line", points: [S.temp.points[0], clamp(n)] }); S.temp = null; } render(); return; }
    if (S.tool === "angle") { if (!S.temp) S.temp = { type: "angle", points: [] }; S.temp.points.push(clamp(n)); if (S.temp.points.length === 3) { addAnnot({ type: "angle", points: S.temp.points }); S.temp = null; } render(); return; }
    if (S.tool === "polyline") { if (!S.temp) S.temp = { type: "polyline", points: [] }; S.temp.points.push(clamp(n)); render(); return; }
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!S.img) return; var pos = evPos(e), n = toNorm(pos.x, pos.y);
    if (S.pan) { S.view.tx = S.pan.tx + (pos.x - S.pan.x); S.view.ty = S.pan.ty + (pos.y - S.pan.y); render(); return; }
    if (S.drag) { S.drag.an.points[S.drag.idx] = clamp(n); renderAll(); return; }
    if (S.temp) { S.temp.cur = clamp(n); render(); }
  });
  canvas.addEventListener("pointerup", function (e) { if (S.pan) S.pan = null; if (S.drag) { S.drag = null; snapshot(); } });
  canvas.addEventListener("dblclick", function () { if (S.temp && S.temp.type === "polyline" && S.temp.points.length >= 2) { addAnnot({ type: "polyline", points: S.temp.points.slice() }); S.temp = null; render(); } });
  canvas.addEventListener("wheel", function (e) { if (!S.img) return; e.preventDefault(); var pos = evPos(e), f = e.deltaY < 0 ? 1.12 : 1 / 1.12; var nx = (pos.x - S.view.tx) / S.view.scale, ny = (pos.y - S.view.ty) / S.view.scale; S.view.scale *= f; S.view.tx = pos.x - nx * S.view.scale; S.view.ty = pos.y - ny * S.view.scale; render(); }, { passive: false });

  function clamp(n) { return { x: Math.max(0, Math.min(1, n.x)), y: Math.max(0, Math.min(1, n.y)) }; }
  function reperNume(id) { for (var i = 0; i < REPERE.length; i++) if (REPERE[i].id === id) return REPERE[i].nume; return id; }
  function addAnnot(a) { a.id = "a" + Date.now() + Math.floor(Math.random() * 999); a.layerId = S.stratSel; snapshot(); S.annots.push(a); S.sel = a.id; renderAll(); }
  function tempMas(n) { if (!S.temp || S.temp.type !== "mas") { S.temp = { type: "mas", points: [clamp(n)] }; } else { snapshot(); S.measurements[S.masActiv] = { a: S.temp.points[0], b: clamp(n) }; S.temp = null; S.masActiv = null; renderAll(); } render(); }

  // —— straturi ——
  function renderLayers() {
    var box = $("pa-layers"); box.innerHTML = "";
    S.layers.forEach(function (l) {
      var li = document.createElement("li"); li.className = "pa-layer" + (l.id === S.stratSel ? " is-sel" : "");
      var nume = document.createElement("input"); nume.className = "pa-layer__nume"; nume.value = l.nume; nume.addEventListener("change", function () { l.nume = nume.value; });
      nume.addEventListener("focus", function () { S.stratSel = l.id; renderLayers(); });
      var vis = document.createElement("button"); vis.className = "pa-layer__ic" + (l.vizibil ? " is-on" : ""); vis.type = "button"; vis.textContent = l.vizibil ? "👁" : "🚫"; vis.title = "Vizibil"; vis.setAttribute("aria-label", "Comută vizibilitatea"); vis.addEventListener("click", function () { l.vizibil = !l.vizibil; renderAll(); });
      var lock = document.createElement("button"); lock.className = "pa-layer__ic" + (l.blocat ? " is-on" : ""); lock.type = "button"; lock.textContent = l.blocat ? "🔒" : "🔓"; lock.title = "Blocat"; lock.setAttribute("aria-label", "Comută blocarea"); lock.addEventListener("click", function () { l.blocat = !l.blocat; renderLayers(); });
      var del = document.createElement("button"); del.className = "pa-layer__ic"; del.type = "button"; del.textContent = "✕"; del.title = "Șterge stratul"; del.setAttribute("aria-label", "Șterge stratul"); del.addEventListener("click", function () { if (S.layers.length < 2) return toast("Trebuie cel puțin un strat.", true); snapshot(); S.annots = S.annots.filter(function (a) { return a.layerId !== l.id; }); S.layers = S.layers.filter(function (x) { return x.id !== l.id; }); if (S.stratSel === l.id) S.stratSel = S.layers[0].id; renderAll(); });
      li.appendChild(vis); li.appendChild(lock); li.appendChild(nume); li.appendChild(del); box.appendChild(li);
    });
  }
  $("btnStrat").addEventListener("click", function () { snapshot(); var id = "l" + Date.now(); S.layers.push({ id: id, nume: "Strat " + (S.layers.length + 1), vizibil: true, blocat: false }); S.stratSel = id; renderLayers(); });

  // —— repere ——
  function renderRepere() {
    var box = $("pa-repere"); box.innerHTML = "";
    REPERE.forEach(function (r) {
      var plasat = S.annots.some(function (a) { return a.reper === r.id; });
      var b = document.createElement("button"); b.type = "button"; b.className = "pa-reper" + (plasat ? " is-plasat" : "") + (S.reperActiv === r.id ? " is-activ" : ""); b.textContent = (plasat ? "✓ " : "") + r.nume;
      b.addEventListener("click", function () { S.tool = "point"; setTool("point"); S.reperActiv = r.id; renderRepere(); });
      box.appendChild(b);
    });
  }

  // —— măsurători & metrici ——
  function distRol(rol) { var m = S.measurements[rol]; return m && m.a && m.b ? distanta(m.a, m.b, S.aspect) : NaN; }
  function renderMasuratori() {
    var box = $("pa-masuratori"); box.innerHTML = "";
    MASURATORI.forEach(function (m) {
      var v = distRol(m.rol), setat = !isNaN(v);
      var row = document.createElement("div"); row.className = "pa-mas" + (setat ? " is-set" : "");
      row.innerHTML = "<span>" + esc(m.nume) + "</span>";
      var right = document.createElement("span"); right.style.display = "flex"; right.style.gap = ".4rem"; right.style.alignItems = "center";
      var val = document.createElement("span"); val.className = "pa-mas__val"; val.textContent = setat ? rot(v, 3) : "—";
      var b = document.createElement("button"); b.className = "pa-btn pa-btn--sm"; b.type = "button"; b.textContent = setat ? "Reface" : "Setează";
      b.addEventListener("click", function () { S.masActiv = m.rol; S.temp = null; setTool("select"); toast("Trage o linie pe imagine pentru „" + m.nume + "”."); });
      right.appendChild(val); right.appendChild(b); row.appendChild(right); box.appendChild(row);
    });
  }
  function metrici() {
    var d = { lungime_corp: distRol("lungime_corp"), inaltime_greaban: distRol("inaltime_greaban"), adancime_torace: distRol("adancime_torace"), segment_membru_anterior: distRol("segment_membru_anterior"), lungime_craniu: distRol("lungime_craniu"), lungime_bot: distRol("lungime_bot") };
    return { indice_corporal: procent(d.lungime_corp, d.inaltime_greaban), adancime_torace: procent(d.adancime_torace, d.inaltime_greaban), segment_membru_anterior: procent(d.segment_membru_anterior, d.inaltime_greaban), raport_craniu_bot: raport(d.lungime_craniu, d.lungime_bot) };
  }
  function metricStd(key) { if (!S.standard || !S.standard.metrics) return null; for (var i = 0; i < S.standard.metrics.length; i++) if (S.standard.metrics[i].metrica === key) return S.standard.metrics[i]; return null; }
  function badge(st) { var c = st === "conform" ? "b-ok" : st === "neconform" ? "b-bad" : st === "neconcludent" ? "b-nc" : "b-info"; return '<span class="pa-badge ' + c + '">' + st + "</span>"; }
  function renderRezultate() {
    var info = $("pa-std-info");
    if (S.standard) info.innerHTML = "Standard: <strong>" + esc(S.standard.rasa) + "</strong> · v" + esc(S.standard.versiune) + (S.standard.demo ? ' · <span style="color:var(--warn)">DATE DEMONSTRATIVE</span>' : "") + "<br>" + esc(S.standard.sursa || "");
    else info.textContent = "Niciun standard încărcat (rezultatele apar când există un standard).";
    var m = metrici(), box = $("pa-rezultate"), ex = $("pa-explicatii"); box.innerHTML = ""; ex.innerHTML = "";
    METRICI_DEF.forEach(function (def) {
      var val = m[def.key], std = metricStd(def.key), st = statusInterval(val, std || {});
      var row = document.createElement("div"); row.className = "pa-rez";
      row.innerHTML = '<div class="pa-rez__top"><strong>' + esc(def.nume) + "</strong>" + badge(st.status) + "</div><div class='pa-mas__val'>" + (isNaN(val) ? "—" : rot(val, 2) + (def.unit)) + (std && std.min != null ? " · interval " + std.min + (std.max != null ? "–" + std.max : "") : "") + "</div>";
      box.appendChild(row);
      var e = document.createElement("div"); e.className = "pa-expl";
      e.innerHTML = "<strong>" + esc(def.nume) + "</strong> — <code>" + esc(def.formula) + "</code> = " + (isNaN(val) ? "reper incomplet" : rot(val, 2) + esc(def.unit)) + ". " + esc(st.motiv) + " Următorul reper: " + esc(URMATOR[def.key] || "—") + ".";
      ex.appendChild(e);
    });
  }

  // —— unelte UI ——
  function setTool(t) { S.tool = t; S.temp = null; if (t !== "point") S.reperActiv = null; document.querySelectorAll(".pa-tool").forEach(function (b) { var on = b.dataset.tool === t; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }); canvas.style.cursor = t === "pan" ? "grab" : "crosshair"; renderRepere(); }
  document.querySelectorAll(".pa-tool").forEach(function (b) { b.addEventListener("click", function () { setTool(b.dataset.tool); }); });
  $("btnUndo").addEventListener("click", undo); $("btnRedo").addEventListener("click", redo);
  $("zoomIn").addEventListener("click", function () { S.view.scale *= 1.15; render(); });
  $("zoomOut").addEventListener("click", function () { S.view.scale /= 1.15; render(); });
  $("zoomFit").addEventListener("click", incadreaza);
  $("pa-calib-mod").addEventListener("change", function (e) { S.calibrare.mod = e.target.value; $("pa-calib-greaban").hidden = e.target.value !== "greaban"; });
  $("pa-greaban-cm").addEventListener("change", function (e) { S.calibrare.greabanCm = +e.target.value || null; });

  document.addEventListener("keydown", function (e) {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ""))) return;
    if (e.key === " ") { S.spaceDown = true; canvas.style.cursor = "grab"; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); }
    if (e.key === "Escape") { S.temp = null; S.masActiv = null; render(); }
    if (e.key === "Enter" && S.temp && S.temp.type === "polyline" && S.temp.points.length >= 2) { addAnnot({ type: "polyline", points: S.temp.points.slice() }); S.temp = null; render(); }
    var map = { v: "select", p: "point", l: "line", a: "angle" }; if (map[e.key]) setTool(map[e.key]);
    if ((e.key === "Delete" || e.key === "Backspace") && S.sel) { snapshot(); S.annots = S.annots.filter(function (a) { return a.id !== S.sel; }); S.sel = null; renderAll(); }
  });
  document.addEventListener("keyup", function (e) { if (e.key === " ") { S.spaceDown = false; canvas.style.cursor = S.tool === "pan" ? "grab" : "crosshair"; } });

  // —— încărcare imagine ——
  function incarcaFisier(f) {
    var err = $("pa-emptyerr"); err.hidden = true;
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { err.textContent = "Format acceptat: JPEG, PNG sau WebP."; err.hidden = false; return; }
    if (f.size > 6 * 1024 * 1024) { err.textContent = "Fișierul depășește 6 MB. Redu dimensiunea."; err.hidden = false; return; }
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        if (img.width < 200 || img.height < 150) { err.textContent = "Fotografie prea mică pentru adnotare."; err.hidden = false; return; }
        if (img.width / img.height < 0.9) toast("Atenție: fotografia nu pare un profil lateral (prea îngustă).");
        S.img = img; S.imgW = img.width; S.imgH = img.height; S.aspect = img.width / img.height; S.dataUrl = rd.result;
        $("pa-empty").style.display = "none"; ["btnSalveaza", "btnExportPng", "btnExportJson"].forEach(function (id) { $(id).disabled = false; });
        incadreaza(); renderAll();
        if (cid) uploadImagine(rd.result, img.width, img.height);
      };
      img.onerror = function () { err.textContent = "Nu am putut încărca imaginea."; err.hidden = false; };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  }
  $("pa-file").addEventListener("change", function (e) { incarcaFisier(e.target.files[0]); });
  function uploadImagine(dataUrl, w, h) { fetch(API + "paa-imagine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actiune: "incarca", cid: cid, dataUrl: dataUrl, w: w, h: h }) }).then(function (r) { return r.json(); }).then(function (d) { if (d.imageId) { S.imageId = d.imageId; } }).catch(function () {}); }

  // —— standard demo ——
  function incarcaStandard() {
    fetch(API + "paa-standarde", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actiune: "detalii", rasa: "DEMO — Ciobănesc de talie medie", versiune: "demo-1" }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.standard) { S.standard = d.standard; renderRezultate(); } }).catch(function () {});
  }

  // —— salvare / sesiuni / export ——
  function serializeaza() { return { titlu: S.titlu, rasa: S.rasa, imageId: S.imageId, aspect: S.aspect, calibrare: S.calibrare, layers: S.layers, annotations: S.annots, measurements: S.measurements, stdRasa: S.standard ? S.standard.rasa : "", stdVersiune: S.standard ? S.standard.versiune : "" }; }
  $("btnSalveaza").addEventListener("click", function () {
    if (S.exercitiu) { trimiteRezolvare(false); return; }
    if (!cid) return toast("Intră în platformă (cursuri) ca să salvezi sesiuni.", true);
    var payload = { actiune: S.sesiuneId ? "salveaza" : "creaza", cid: cid, id: S.sesiuneId, sesiune: serializeaza() };
    fetch(API + "paa-sesiuni", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); }).then(function (d) { if (d.sesiune) { S.sesiuneId = d.sesiune.id; toast("Sesiune salvată."); } else toast(d.eroare || "Eroare la salvare.", true); }).catch(function () { toast("Nu am putut salva (online?).", true); });
  });
  $("btnExportJson").addEventListener("click", function () { var blob = new Blob([JSON.stringify(serializeaza(), null, 2)], { type: "application/json" }); dl(blob, "adnotare.json"); });
  $("btnExportPng").addEventListener("click", function () { canvas.toBlob(function (b) { dl(b, "adnotare.png"); }); });
  function dl(blob, nume) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nume; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); }
  $("btnSesiuni").addEventListener("click", function () {
    if (S.exercitiu) { if (!S.exSubmitted && confirm("Trimiți rezolvarea? După trimitere nu mai poate fi modificată.")) trimiteRezolvare(true); return; }
    if (!cid) return toast("Intră în platformă (cursuri) pentru sesiuni.", true);
    fetch(API + "paa-sesiuni", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actiune: "lista", cid: cid }) }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.sesiuni || !d.sesiuni.length) return toast("Nicio sesiune salvată.");
      var nume = d.sesiuni.map(function (s, i) { return (i + 1) + ". " + s.titlu + (s.rasa ? " (" + s.rasa + ")" : ""); }).join("\n");
      var alegere = prompt("Sesiunile tale — scrie numărul pentru a deschide:\n\n" + nume);
      var idx = parseInt(alegere, 10) - 1; if (isNaN(idx) || !d.sesiuni[idx]) return;
      deschideSesiune(d.sesiuni[idx].id);
    }).catch(function () { toast("Nu am putut încărca sesiunile.", true); });
  });
  function deschideSesiune(id) {
    fetch(API + "paa-sesiuni", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actiune: "detalii", cid: cid, id: id }) }).then(function (r) { return r.json(); }).then(function (d) {
      var s = d.sesiune; if (!s) return;
      S.sesiuneId = s.id; S.titlu = s.titlu; S.rasa = s.rasa; S.imageId = s.imageId; S.aspect = s.aspect || 1;
      S.calibrare = s.calibrare || { mod: "relativ" }; S.layers = s.layers && s.layers.length ? s.layers : S.layers;
      S.annots = s.annotations || []; S.measurements = s.measurements || {}; S.stratSel = S.layers[0].id; S.undo = []; S.redo = [];
      if (s.imageId) restaureazaImagine(s.imageId); else renderAll();
      toast("Sesiune încărcată.");
    });
  }
  function restaureazaImagine(imageId) {
    fetch(API + "paa-imagine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actiune: "serveste", cid: cid, imageId: imageId }) }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
      if (!b) { renderAll(); return; }
      var url = URL.createObjectURL(b); var img = new Image(); img.onload = function () { S.img = img; S.imgW = img.width; S.imgH = img.height; S.aspect = img.width / img.height; $("pa-empty").style.display = "none"; ["btnSalveaza", "btnExportPng", "btnExportJson"].forEach(function (id) { $(id).disabled = false; }); incadreaza(); renderAll(); URL.revokeObjectURL(url); }; img.src = url;
    }).catch(function () { renderAll(); });
  }

  // —— PWA install gated cu cod PAA ——
  var UNLOCK = "paaInstalareDeblocata";
  function deblocat() { try { return localStorage.getItem(UNLOCK) === "1"; } catch (e) { return false; } }
  function injManifest() { if (document.querySelector('link[rel="manifest"]')) return; var l = document.createElement("link"); l.rel = "manifest"; l.setAttribute("href", "manifest.webmanifest"); document.head.appendChild(l); }
  var deferred = null;
  function registerPWA() {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(function () {});
    if (deblocat()) injManifest();
    window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; });
    window.addEventListener("appinstalled", function () { deferred = null; $("btnInstall").hidden = true; toast("Aplicație instalată."); });
    var standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    if ((location.protocol === "https:" || location.hostname === "localhost") && !standalone) $("btnInstall").hidden = false;
  }
  function declanseaza() { if (deferred) { deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; }); } else toast("Instalare deblocată. Folosește meniul browserului → „Instalează aplicația”."); }
  $("btnInstall").addEventListener("click", function () {
    if (deblocat()) return declanseaza();
    var cod = prompt("Instalarea necesită un cod de instalare (de la CFC-Royal). Introdu codul:");
    if (!cod) return;
    fetch(API + "paa-instalare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actiune: "verifica", cod: String(cod).trim() }) }).then(function (r) { if (!r.ok) return toast("Cod de instalare incorect.", true); try { localStorage.setItem(UNLOCK, "1"); } catch (e) {} injManifest(); toast("Cod acceptat — se pregătește instalarea…"); setTimeout(declanseaza, 1000); }).catch(function () { toast("Nu am putut verifica codul (online?).", true); });
  });

  // —— mod EXERCIȚIU (deschis cu ?ex=<id>): fotografia lectorului, candidatul o adnotează și o trimite ——
  function apiEx(payload) { return fetch(API + "paa-exercitii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); }
  function bannerEx(html) { var b = document.querySelector(".pa-warn"); if (b) b.innerHTML = html; }
  function initExercitiu() {
    if (!cid) { bannerEx("<strong>Exercițiu</strong> — intră întâi în platformă (cursuri) cu codul tău de candidat, apoi redeschide linkul exercițiului."); return; }
    apiEx({ actiune: "detalii-cursant", cid: cid, id: exId }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.exercitiu) { toast(d.eroare || "Exercițiu indisponibil.", true); return; }
      S.exercitiu = d.exercitiu; S.aspect = d.exercitiu.aspect || 1; S.rasa = d.exercitiu.rasa || "";
      bannerEx("<strong>Exercițiu: " + esc(d.exercitiu.titlu) + "</strong> — adnotează fotografia și trimite rezolvarea. Estimări 2D, nu evaluare oficială.");
      $("btnSalveaza").textContent = "Salvează schița"; $("btnSalveaza").disabled = false;
      $("btnSesiuni").textContent = "Trimite rezolvarea";
      if (d.raspuns) { S.annots = d.raspuns.annotations || []; S.measurements = d.raspuns.measurements || {}; if (d.raspuns.calibrare) S.calibrare = d.raspuns.calibrare; }
      $("pa-empty").innerHTML = "<p>Se încarcă fotografia exercițiului…</p>";
      incarcaImagineExercitiu();
      if (d.raspuns && d.raspuns.status === "submitted") lockExercitiu(d.raspuns);
    }).catch(function () { toast("Nu am putut încărca exercițiul.", true); });
  }
  function incarcaImagineExercitiu() {
    apiEx({ actiune: "imagine", cid: cid, id: exId }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (blob) {
      if (!blob) { $("pa-empty").innerHTML = "<p>Fotografia nu a putut fi încărcată.</p>"; return; }
      var url = URL.createObjectURL(blob); var img = new Image();
      img.onload = function () { S.img = img; S.imgW = img.width; S.imgH = img.height; S.aspect = img.width / img.height; $("pa-empty").style.display = "none"; ["btnExportPng", "btnExportJson"].forEach(function (id) { $(id).disabled = false; }); incadreaza(); renderAll(); URL.revokeObjectURL(url); };
      img.src = url;
    }).catch(function () { $("pa-empty").innerHTML = "<p>Fotografia nu a putut fi încărcată.</p>"; });
  }
  function trimiteRezolvare(final) {
    if (!cid || S.exSubmitted) return;
    apiEx({ actiune: final ? "raspuns-trimite" : "raspuns-schita", cid: cid, id: exId, annotations: S.annots, measurements: S.measurements, calibrare: S.calibrare }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.raspuns) { toast(final ? "Rezolvare trimisă lectorului." : "Schiță salvată."); if (final) lockExercitiu(d.raspuns); } else toast(d.eroare || "Eroare.", true);
    }).catch(function () { toast("Nu am putut trimite (online?).", true); });
  }
  function lockExercitiu(r) {
    S.exSubmitted = true; $("btnSesiuni").disabled = true; $("btnSalveaza").disabled = true;
    bannerEx("<strong>Rezolvare trimisă." + (r.calificativ ? " Calificativ: " + esc(r.calificativ) + "." : " În așteptarea verificării.") + "</strong>" + (r.feedback ? " Feedback lector: " + esc(r.feedback) : ""));
  }

  // —— init ——
  function init() {
    $("pa-auth").textContent = cid ? "Conectat ca și candidat" : "Neconectat — salvarea necesită autentificare în platformă";
    renderRepere(); renderLayers(); renderMasuratori(); renderRezultate();
    window.addEventListener("resize", resize);
    if (window.ResizeObserver) { var ro = new ResizeObserver(function () { resize(); }); ro.observe(stage); }
    requestAnimationFrame(function () { resize(); requestAnimationFrame(resize); });
    incarcaStandard(); registerPWA();
    if (exId) initExercitiu();
  }
  init();
})();
