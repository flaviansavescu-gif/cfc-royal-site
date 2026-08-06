// jcr-raport.mjs — Faza 2: istoricul cursantului + raport/export CSV al sesiunii (lector).
// Cursant: istoric (cid).  Lector: csv (cod, id).
import { json, taie, cereLector, candidatDinId, poateAdministraSesiunea, store, storeCursuri, citesteIndex, citesteParticipanti, esteParticipant, baremDeblocat, candidatDinCod} from "./_jcr/lib.mjs";
import { comparaRaspuns } from "./_jcr/compare.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

const csvCelula = (v) => { const s = String(v == null ? "" : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20);
  const st = store();

  // ——— Cursant: istoricul propriu (sesiuni închise + barem deblocat) ———
  if (actiune === "istoric") {
    const cand = await candidatDinCod(body.cid);
    if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);
    const idx = await citesteIndex();
    const out = [];
    for (const r of idx) {
      if (r.status !== "closed") continue;
      const s = await st.get("session/" + r.id, { type: "json" }).catch(() => null);
      if (!s || !baremDeblocat(s)) continue;
      const part = await citesteParticipanti(r.id);
      if (!esteParticipant(part, cand.id)) continue;
      const resp = await st.get("response/" + r.id + "/" + cand.id, { type: "json" }).catch(() => null);
      const ref = await st.get("reference/" + r.id, { type: "json" }).catch(() => null);
      if (!resp || !ref) continue;
      const cmp = comparaRaspuns(resp, ref);
      out.push({
        id: r.id, titlu: s.titlu, rasa: s.rasa || "", termen: s.termen || "", inchisLa: s.inchisLa || "",
        calificativStudent: resp.calificativ || "—", calificativReferinta: ref.calificativ || "—",
        acordCalificativ: cmp.calificativ.status, distantaCalificativ: cmp.calificativ.distanta,
        defecteAcord: cmp.defecte.sumar.acord, defecteOmise: cmp.defecte.sumar.omise,
        spearman: cmp.clasament.spearman, observatiiAcoperite: cmp.observatii.sumar.acoperite, observatiiTotal: cmp.observatii.sumar.total,
      });
    }
    out.sort((a, b) => String(b.inchisLa || b.termen).localeCompare(String(a.inchisLa || a.termen)));
    // tendință simplă: câte au calificativ în acord
    const nAcord = out.filter((x) => x.acordCalificativ === "acord").length;
    return json({ nume: cand.nume, sesiuni: out, tendinta: { total: out.length, calificativAcord: nAcord } });
  }

  // ——— Lector: export CSV al rezultatelor sesiunii ———
  if (actiune === "csv") {
    const id = taie(body.id, 40);
    if (!id) return json({ eroare: "Lipsește sesiunea." }, 400);
    let actor;
    try { actor = cereLector(body.cod); } catch (e) { return json({ eroare: e.eroare }, e.status); }
    const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
    if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);
    if (!poateAdministraSesiunea(actor, s)) return json({ eroare: "Nu ai drept asupra acestei sesiuni." }, 403);
    const ref = await st.get("reference/" + id, { type: "json" }).catch(() => null);
    if (!ref) return json({ eroare: "Completează întâi baremul." }, 409);
    const part = await citesteParticipanti(id);

    const anteturi = ["Candidat", "Status", "Calificativ", "Calificativ referință", "Acord calificativ", "Distanță", "Defecte acord", "Defecte omise", "Defecte suplimentare", "Spearman", "Kendall", "Acord clasament", "Obs. acoperite", "Obs. total"];
    const randuri = [anteturi.map(csvCelula).join(",")];
    try {
      const { blobs } = await st.list({ prefix: "response/" + id + "/" });
      for (const b of blobs) {
        const cid = b.key.slice(("response/" + id + "/").length);
        const resp = await st.get(b.key, { type: "json" });
        if (!resp) continue;
        const c = await storeCursuri().get("candidat/" + cid, { type: "json" }).catch(() => null);
        const cmp = comparaRaspuns(resp, ref);
        randuri.push([
          (c && c.nume) || cid, resp.status, resp.calificativ || "", ref.calificativ || "",
          cmp.calificativ.status, cmp.calificativ.distanta == null ? "" : cmp.calificativ.distanta,
          cmp.defecte.sumar.acord, cmp.defecte.sumar.omise, cmp.defecte.sumar.suplimentare,
          cmp.clasament.spearman == null ? "" : cmp.clasament.spearman, cmp.clasament.kendall == null ? "" : cmp.clasament.kendall,
          cmp.clasament.status, cmp.observatii.sumar.acoperite, cmp.observatii.sumar.total,
        ].map(csvCelula).join(","));
      }
    } catch (err) { console.error(err); }
    const csv = "﻿" + randuri.join("\n"); // BOM pentru Excel + diacritice
    const filename = "jcr-" + (s.titlu || id).toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + ".csv";
    return json({ csv, filename });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
