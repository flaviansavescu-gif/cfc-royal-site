// jcr-sesiuni.mjs — sesiuni de evaluare (Judge Comparison Room).
// Lector/Admin: lista|creaza|salveaza|detalii|publica|inchide|arhiveaza|participanti|candidati|raspunsuri
// Cursant (cod individual): alocate|detalii-cursant
import {
  json, taie, acum, idNou, actorDinCod, candidatDinId, cereLector, poateAdministraSesiunea,
  store, storeCursuri, citesteIndex, scrieInIndex, audit, citesteParticipanti, esteParticipant, baremDeblocat, candidatDinCod,} from "./_jcr/lib.mjs";
import { marcheazaUrma } from "./_comun/urma.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

function curataSesiune(inp, baza) {
  const s = baza || {};
  const criterii = Array.isArray(inp.criterii) ? inp.criterii.slice(0, 40).map((c, i) => ({
    id: taie(c.id, 40) || "c" + (i + 1), eticheta: taie(c.eticheta, 120), zona: taie(c.zona, 60),
  })).filter((c) => c.eticheta) : (s.criterii || []);
  return {
    ...s,
    titlu: taie(inp.titlu ?? s.titlu, 160),
    descriere: taie(inp.descriere ?? s.descriere, 4000),
    modulSlug: taie(inp.modulSlug ?? s.modulSlug, 40),
    grupa: taie(inp.grupa ?? s.grupa, 80),
    rasa: taie(inp.rasa ?? s.rasa, 120),
    nivel: taie(inp.nivel ?? s.nivel, 40),
    obiective: taie(inp.obiective ?? s.obiective, 2000),
    wdfStandard: inp.wdfStandard ? {
      rasa: taie(inp.wdfStandard.rasa, 120), versiune: taie(inp.wdfStandard.versiune, 40),
      sursa: taie(inp.wdfStandard.sursa, 300), data: taie(inp.wdfStandard.data, 40),
      status: taie(inp.wdfStandard.status, 20) || "current",
    } : (s.wdfStandard || null),
    exemplare: Array.isArray(inp.exemplare) ? inp.exemplare.slice(0, 12).map((e, i) => ({ id: taie(e.id, 40) || "e" + (i + 1), eticheta: taie(e.eticheta, 80) })) : (s.exemplare || []),
    termen: taie(inp.termen ?? s.termen, 40),
    timpLimitaMin: Number.isFinite(+inp.timpLimitaMin) ? Math.max(0, Math.min(600, +inp.timpLimitaMin)) : (s.timpLimitaMin || 0),
    criterii,
    vizibilitate: {
      deblocareBarem: taie(inp.vizibilitate?.deblocareBarem ?? s.vizibilitate?.deblocareBarem, 20) || "la-inchidere",
      baremManual: !!(inp.vizibilitate?.baremManual ?? s.vizibilitate?.baremManual),
      numeDeblocate: !!(inp.vizibilitate?.numeDeblocate ?? s.vizibilitate?.numeDeblocate),
    },
  };
}

// vederea pt. cursant: fără barem, fără răspunsurile altora, fără lista de participanți
function sesiunePtCursant(s) {
  return {
    id: s.id, titlu: s.titlu, descriere: s.descriere, rasa: s.rasa, nivel: s.nivel, grupa: s.grupa,
    obiective: s.obiective, criterii: s.criterii, exemplare: s.exemplare, imagini: s.imagini || [],
    wdfStandard: s.wdfStandard, termen: s.termen, timpLimitaMin: s.timpLimitaMin, status: s.status,
    baremDeblocat: baremDeblocat(s),
  };
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 30) || "lista";
  const st = store();

  // ————— Acțiuni de CURSANT (cod individual) —————
  if (actiune === "alocate" || actiune === "detalii-cursant") {
    const cand = await candidatDinCod(body.cid);
    if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);

    if (actiune === "alocate") {
      const idx = await citesteIndex();
      const out = [];
      for (const r of idx) {
        if (!["published", "closed"].includes(r.status)) continue;
        const part = await citesteParticipanti(r.id);
        if (!esteParticipant(part, cand.id)) continue;
        const raspuns = await st.get("response/" + r.id + "/" + cand.id, { type: "json" }).catch(() => null);
        out.push({
          id: r.id, titlu: r.titlu, rasa: r.rasa, grupa: r.grupa, nivel: r.nivel, termen: r.termen, status: r.status,
          raspunsStatus: raspuns ? raspuns.status : "neinceput",
          baremDeblocat: r.status === "closed", // aproximare din index; detaliul confirmă
        });
      }
      out.sort((a, b) => String(b.termen || "").localeCompare(String(a.termen || "")));
      return json({ nume: cand.nume, sesiuni: out });
    }

    // detalii-cursant
    const id = taie(body.id, 40);
    const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
    if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);
    const part = await citesteParticipanti(id);
    if (!esteParticipant(part, cand.id)) return json({ eroare: "Nu ești alocat acestei sesiuni." }, 403);
    if (!["published", "closed"].includes(s.status)) return json({ eroare: "Sesiunea nu este disponibilă." }, 403);
    const raspuns = await st.get("response/" + id + "/" + cand.id, { type: "json" }).catch(() => null);
    return json({ sesiune: sesiunePtCursant(s), raspuns: raspuns || null });
  }

  // ————— Acțiuni de LECTOR / ADMIN —————
  let actor;
  try { actor = cereLector(body.cod); } catch (e) { return json({ eroare: e.eroare }, e.status); }

  if (actiune === "lista") {
    // Spațiu comun: toți lectorii (și adminul) văd toate sesiunile.
    const idx = await citesteIndex();
    idx.sort((a, b) => String(b.actualizat || b.creat || "").localeCompare(String(a.actualizat || a.creat || "")));
    return json({ sesiuni: idx });
  }

  if (actiune === "candidati") {
    // roster pt. selecția explicită a participanților (fără coduri)
    const out = [];
    try {
      const { blobs } = await storeCursuri().list({ prefix: "candidat/" });
      for (const b of blobs) {
        const c = await storeCursuri().get(b.key, { type: "json" });
        if (c) out.push({ id: b.key.slice("candidat/".length), nume: c.nume });
      }
    } catch (err) { console.error(err); }
    out.sort((a, b) => (a.nume || "").localeCompare(b.nume || "", "ro"));
    return json({ candidati: out });
  }

  if (actiune === "creaza") {
    const id = idNou();
    const s = curataSesiune(body.sesiune || body, {
      id, status: "draft", imagini: [], creat: acum(),
      lectorSlug: actor.rol === "lector" ? actor.slug : taie(body.lectorSlug, 60),
      lectorNume: actor.rol === "lector" ? actor.nume : taie(body.lectorNume, 120) || "Administrator",
    });
    if (!s.titlu) return json({ eroare: "Titlul sesiunii este obligatoriu." }, 400);
    s.actualizat = acum();
    marcheazaUrma(s, actor, "creare");
    await st.setJSON("session/" + id, s);
    await scrieInIndex(s);
    await audit(id, actor, "creare-sesiune", id);
    return json({ ok: true, sesiune: s });
  }

  // acțiuni care necesită o sesiune existentă + drept de administrare
  const id = taie(body.id, 40);
  if (!id) return json({ eroare: "Lipsește id-ul sesiunii." }, 400);
  const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
  if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);
  if (!poateAdministraSesiunea(actor, s)) return json({ eroare: "Nu ai drept asupra acestei sesiuni." }, 403);

  if (actiune === "detalii") {
    const part = await citesteParticipanti(id);
    return json({ sesiune: s, participanti: part.candidateIds || [], baremDeblocat: baremDeblocat(s) });
  }

  if (actiune === "salveaza") {
    const upd = curataSesiune(body.sesiune || body, s);
    upd.actualizat = acum();
    marcheazaUrma(upd, actor, "modificare");
    await st.setJSON("session/" + id, upd);
    await scrieInIndex(upd);
    await audit(id, actor, "salveaza-sesiune", id);
    return json({ ok: true, sesiune: upd });
  }

  if (actiune === "participanti") {
    const ids = Array.isArray(body.candidateIds) ? [...new Set(body.candidateIds.map((x) => taie(x, 80)).filter(Boolean))].slice(0, 500) : [];
    await st.setJSON("participants/" + id, { candidateIds: ids, actualizat: acum() });
    await audit(id, actor, "seteaza-participanti", ids.length + " candidați");
    return json({ ok: true, participanti: ids });
  }

  if (["publica", "inchide", "arhiveaza"].includes(actiune)) {
    const tinta = actiune === "publica" ? "published" : actiune === "inchide" ? "closed" : "archived";
    if (actiune === "publica") {
      if (!(s.imagini || []).length) return json({ eroare: "Adaugă cel puțin o imagine înainte de publicare." }, 400);
      if (!(s.criterii || []).length) return json({ eroare: "Definește rubrica (criteriile) înainte de publicare." }, 400);
      const part = await citesteParticipanti(id);
      if (!(part.candidateIds || []).length) return json({ eroare: "Selectează cel puțin un candidat participant." }, 400);
    }
    s.status = tinta;
    s.actualizat = acum();
    marcheazaUrma(s, actor, actiune);
    if (actiune === "inchide") s.inchisLa = acum();
    await st.setJSON("session/" + id, s);
    await scrieInIndex(s);
    await audit(id, actor, actiune + "-sesiune", tinta);
    return json({ ok: true, status: tinta, baremDeblocat: baremDeblocat(s) });
  }

  if (actiune === "raspunsuri") {
    // toate răspunsurile trimise (pentru comparația de grup / vederea lectorului)
    const part = await citesteParticipanti(id);
    const numeById = {};
    try {
      for (const cid of part.candidateIds || []) {
        const c = await storeCursuri().get("candidat/" + cid, { type: "json" }).catch(() => null);
        if (c) numeById[cid] = c.nume;
      }
    } catch (err) { console.error(err); }
    const out = [];
    try {
      const { blobs } = await st.list({ prefix: "response/" + id + "/" });
      for (const b of blobs) {
        const r = await st.get(b.key, { type: "json" });
        if (r) out.push({ ...r, candidatId: b.key.slice(("response/" + id + "/").length), candidatNume: numeById[b.key.slice(("response/" + id + "/").length)] || "—" });
      }
    } catch (err) { console.error(err); }
    return json({ raspunsuri: out });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
