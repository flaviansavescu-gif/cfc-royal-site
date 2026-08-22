// jcr-raspuns.mjs — răspunsul individual al cursantului (schiță / trimitere).
// Cursant: schita | trimite | a-mea.  Răspunsul NU e vizibil altor cursanți.
import { json, taie, acum, candidatDinId, store, citesteParticipanti, esteParticipant, audit, candidatDinCod, MESAJ_ETICA} from "./_jcr/lib.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

const FORM_VERSION = 1;

function curataRaspuns(inp, baza) {
  const r = baza || {};
  const defecte = Array.isArray(inp.defecte) ? inp.defecte.slice(0, 60).map((d) => ({
    cod: taie(d.cod, 40), gravitate: taie(d.gravitate, 20), zona: taie(d.zona, 60),
  })).filter((d) => d.cod) : (r.defecte || []);
  const observatii = Array.isArray(inp.observatii) ? inp.observatii.slice(0, 60).map((o) => ({
    criteriuId: taie(o.criteriuId, 40), text: taie(o.text, 1200),
  })).filter((o) => o.criteriuId || o.text) : (r.observatii || []);
  const clasament = Array.isArray(inp.clasament) ? inp.clasament.slice(0, 12).map((x) => taie(x, 40)).filter(Boolean) : (r.clasament || []);
  return {
    ...r,
    observatiiGenerale: taie(inp.observatiiGenerale ?? r.observatiiGenerale, 4000),
    calitati: taie(inp.calitati ?? r.calitati, 3000),
    defecte, observatii, clasament,
    calificativ: taie(inp.calificativ ?? r.calificativ, 40),
    justificare: taie(inp.justificare ?? r.justificare, 4000),
    timpLucratSec: Number.isFinite(+inp.timpLucratSec) ? Math.max(0, Math.min(86400, +inp.timpLucratSec)) : (r.timpLucratSec || 0),
    formVersion: FORM_VERSION,
  };
}

// Zidul anti-ghicire, ca la toate celelalte funcții care primesc un cod. Era singura
// funcție din Judge Comparison Room fără el — și tocmai ea răspunde 401 la un `cid`
// greșit, deci era o ghicitoare de coduri nelimitată. Celelalte șase îl aveau; asta
// scăpase, iar o apărare care are o singură ușă deschisă nu e o apărare.
export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20);
  const id = taie(body.id, 40);

  const cand = await candidatDinCod(body.cid);
  if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);
  if (cand.faraCodEtic) return json({ eroare: MESAJ_ETICA, trebuieAsumat: true }, 403);
  if (!id) return json({ eroare: "Lipsește sesiunea." }, 400);

  const st = store();
  const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
  if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);
  const part = await citesteParticipanti(id);
  if (!esteParticipant(part, cand.id)) return json({ eroare: "Nu ești alocat acestei sesiuni." }, 403);

  const key = "response/" + id + "/" + cand.id;

  if (actiune === "a-mea") {
    const r = await st.get(key, { type: "json" }).catch(() => null);
    return json({ raspuns: r || null });
  }

  if (actiune === "schita" || actiune === "trimite") {
    if (s.status !== "published") return json({ eroare: "Sesiunea nu mai primește răspunsuri." }, 403);
    const existent = await st.get(key, { type: "json" }).catch(() => null);
    if (existent && existent.status === "submitted" && actiune === "schita")
      return json({ eroare: "Răspunsul a fost deja trimis." }, 409);
    const r = curataRaspuns(body.raspuns || {}, existent || { creat: acum() });
    if (actiune === "trimite") {
      r.status = "submitted";
      r.trimisLa = acum();
    } else {
      r.status = "draft";
    }
    r.actualizat = acum();
    await st.setJSON(key, r);
    await audit(id, { rol: "cursant", id: cand.id }, actiune === "trimite" ? "trimite-raspuns" : "salveaza-schita", cand.id);
    return json({ ok: true, raspuns: r });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
