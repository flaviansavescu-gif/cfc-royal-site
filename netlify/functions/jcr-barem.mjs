// jcr-barem.mjs — baremul (evaluarea de referință) a lectorului. ASCUNS până la deblocare.
// Lector: salveaza | citeste | deblocheaza.  Cursant: citeste-cursant (doar după deblocare).
// Întărire: autentificarea se face ÎNAINTE de a atinge sesiunea.
import { json, taie, acum, cereLector, candidatDinId, poateAdministraSesiunea, store, citesteParticipanti, esteParticipant, audit, scrieInIndex, baremDeblocat, candidatDinCod} from "./_jcr/lib.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";

function curataBarem(inp, baza) {
  const b = baza || {};
  const defecte = Array.isArray(inp.defecte) ? inp.defecte.slice(0, 60).map((d) => ({
    cod: taie(d.cod, 40), gravitate: taie(d.gravitate, 20), explicatie: taie(d.explicatie, 800), referinta: taie(d.referinta, 200),
  })).filter((d) => d.cod) : (b.defecte || []);
  const observatii = Array.isArray(inp.observatii) ? inp.observatii.slice(0, 60).map((o) => ({
    criteriuId: taie(o.criteriuId, 40), eticheta: taie(o.eticheta, 120), text: taie(o.text, 1500), referinta: taie(o.referinta, 200), pondere: Number.isFinite(+o.pondere) ? +o.pondere : 1,
  })).filter((o) => o.criteriuId || o.eticheta) : (b.observatii || []);
  const clasament = Array.isArray(inp.clasament) ? inp.clasament.slice(0, 12).map((x) => taie(x, 40)).filter(Boolean) : (b.clasament || []);
  return {
    ...b, observatii, defecte, clasament,
    calificativ: taie(inp.calificativ ?? b.calificativ, 40),
    explicatii: taie(inp.explicatii ?? b.explicatii, 4000),
    actualizat: acum(), creat: b.creat || acum(),
  };
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20);
  const id = taie(body.id, 40);
  if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
  if (!id) return json({ eroare: "Lipsește sesiunea." }, 400);
  const st = store();

  // ——— Cursant: citește baremul DOAR după deblocare și doar dacă e participant ———
  if (actiune === "citeste-cursant") {
    const cand = await candidatDinCod(body.cid);
    if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);
    const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
    if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);
    const part = await citesteParticipanti(id);
    if (!esteParticipant(part, cand.id)) return json({ eroare: "Nu ești alocat acestei sesiuni." }, 403);
    if (!baremDeblocat(s)) return json({ eroare: "Baremul nu este încă deblocat." }, 403);
    const b = await st.get("reference/" + id, { type: "json" }).catch(() => null);
    return json({ barem: b || null });
  }

  // ——— Lector/Admin (autentificare înainte de sesiune) ———
  let actor;
  try { actor = cereLector(body.cod); } catch (e) { return json({ eroare: e.eroare }, e.status); }
  const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
  if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);
  if (!poateAdministraSesiunea(actor, s)) return json({ eroare: "Nu ai drept asupra acestei sesiuni." }, 403);

  if (actiune === "citeste") {
    const b = await st.get("reference/" + id, { type: "json" }).catch(() => null);
    return json({ barem: b || null });
  }

  if (actiune === "salveaza") {
    const existent = await st.get("reference/" + id, { type: "json" }).catch(() => null);
    const b = curataBarem(body.barem || {}, existent);
    await st.setJSON("reference/" + id, b);
    await audit(id, actor, "modifica-barem", id);
    return json({ ok: true, barem: b });
  }

  if (actiune === "deblocheaza") {
    s.vizibilitate = { ...(s.vizibilitate || {}), baremManual: true };
    s.actualizat = acum();
    await st.setJSON("session/" + id, s);
    await scrieInIndex(s);
    await audit(id, actor, "deblocare-barem", id);
    return json({ ok: true, baremDeblocat: baremDeblocat(s) });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
