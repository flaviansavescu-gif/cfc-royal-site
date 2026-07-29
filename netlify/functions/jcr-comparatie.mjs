// jcr-comparatie.mjs — comparații explicabile față de barem.
// Cursant: a-mea (după deblocare).  Lector: individuala | grup (anonimizat implicit).
// Întărire: autentificarea se face ÎNAINTE de a atinge sesiunea.
import { json, taie, cereLector, candidatDinId, poateAdministraSesiunea, store, storeCursuri, citesteParticipanti, esteParticipant, baremDeblocat } from "./_jcr/lib.mjs";
import { comparaRaspuns, comparaDefecte, spearman } from "./_jcr/compare.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20);
  const id = taie(body.id, 40);
  if (!id) return json({ eroare: "Lipsește sesiunea." }, 400);
  const st = store();

  // ——— Cursant: comparația propriului răspuns ———
  if (actiune === "a-mea") {
    const cand = await candidatDinId(body.cid);
    if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);
    const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
    if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);
    const part = await citesteParticipanti(id);
    if (!esteParticipant(part, cand.id)) return json({ eroare: "Nu ești alocat acestei sesiuni." }, 403);
    if (!baremDeblocat(s)) return json({ eroare: "Comparația devine disponibilă după deblocarea baremului." }, 403);
    const referinta = await st.get("reference/" + id, { type: "json" }).catch(() => null);
    if (!referinta) return json({ eroare: "Baremul nu a fost încă completat de lector." }, 409);
    const r = await st.get("response/" + id + "/" + cand.id, { type: "json" }).catch(() => null);
    if (!r) return json({ eroare: "Nu ai un răspuns trimis la această sesiune." }, 404);
    return json({ comparatie: comparaRaspuns(r, referinta), calificativReferinta: referinta.calificativ, exemplare: s.exemplare || [] });
  }

  // ——— Lector/Admin (autentificare înainte de sesiune) ———
  let actor;
  try { actor = cereLector(body.cod); } catch (e) { return json({ eroare: e.eroare }, e.status); }
  const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
  if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);
  if (!poateAdministraSesiunea(actor, s)) return json({ eroare: "Nu ai drept asupra acestei sesiuni." }, 403);
  const referinta = await st.get("reference/" + id, { type: "json" }).catch(() => null);
  if (!referinta) return json({ eroare: "Completează întâi baremul." }, 409);

  const raspunsuri = [];
  try {
    const { blobs } = await st.list({ prefix: "response/" + id + "/" });
    for (const b of blobs) {
      const r = await st.get(b.key, { type: "json" });
      if (r && r.status === "submitted") raspunsuri.push({ candidatId: b.key.slice(("response/" + id + "/").length), r });
    }
  } catch (err) { console.error(err); }

  if (actiune === "individuala") {
    const candidatId = taie(body.candidatId, 80);
    const found = raspunsuri.find((x) => x.candidatId === candidatId);
    if (!found) return json({ eroare: "Răspuns inexistent." }, 404);
    return json({ comparatie: comparaRaspuns(found.r, referinta), exemplare: s.exemplare || [] });
  }

  if (actiune === "grup") {
    const numeDeblocate = s.vizibilitate?.numeDeblocate === true || body.deblocheazaNume === true;
    let numeById = {};
    if (numeDeblocate) {
      for (const x of raspunsuri) {
        const c = await storeCursuri().get("candidat/" + x.candidatId, { type: "json" }).catch(() => null);
        if (c) numeById[x.candidatId] = c.nume;
      }
    }
    const distributieCalificativ = {}, omiseCount = {}, spearmanValori = [];
    const perCursant = raspunsuri.map((x, i) => {
      const cmp = comparaRaspuns(x.r, referinta);
      const k = x.r.calificativ || "—";
      distributieCalificativ[k] = (distributieCalificativ[k] || 0) + 1;
      comparaDefecte(x.r.defecte, referinta.defecte).detalii.filter((d) => d.status === "omis").forEach((d) => { omiseCount[d.cod] = (omiseCount[d.cod] || 0) + 1; });
      const rho = spearman(x.r.clasament, referinta.clasament);
      if (rho !== null) spearmanValori.push(rho);
      return {
        eticheta: numeDeblocate ? (numeById[x.candidatId] || "—") : "Cursant " + (i + 1),
        calificativ: x.r.calificativ || "—", acordCalificativ: cmp.calificativ.status, acordClasament: cmp.clasament.status,
        spearman: cmp.clasament.spearman, defecteAcord: cmp.defecte.sumar.acord, defecteOmise: cmp.defecte.sumar.omise,
      };
    });
    const defecteFrecventOmise = Object.entries(omiseCount).map(([cod, n]) => ({ cod, n })).sort((a, b) => b.n - a.n);
    const spearmanMediu = spearmanValori.length ? Number((spearmanValori.reduce((a, b) => a + b, 0) / spearmanValori.length).toFixed(3)) : null;
    return json({ total: raspunsuri.length, numeDeblocate, distributieCalificativ, defecteFrecventOmise, spearmanMediu, perCursant, exemplare: s.exemplare || [] });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
