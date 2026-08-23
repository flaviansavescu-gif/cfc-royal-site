// jcr-resurse.mjs — resurse didactice (imagini) pentru o sesiune.
// Lector: upload | sterge.  Participant sau lector: imagine (servire gated, fără URL public).
// Stocare privată în store „jcr": media/<sessionId>/<mediaId> = { contentType, alt, b64 }.
import { json, taie, acum, cereLector, candidatDinId, actorDinCod, poateAdministraSesiunea, store, citesteParticipanti, esteParticipant, audit, scrieInIndex, candidatDinCod} from "./_jcr/lib.mjs";
import { randomUUID } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";

const TIPURI = { "image/jpeg": 1, "image/png": 1, "image/webp": 1 };
const MAX_B64 = 2_800_000; // ~2 MB imagine

function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  return { contentType: m[1], b64: m[2] };
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20);
  const id = taie(body.id, 40);
  if (!id || !segmentCheieValid(id)) return json({ eroare: "Lipsește sesiunea." }, 400);
  const st = store();
  const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
  if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);

  // ——— Servirea imaginii: participant (cid) SAU lector/admin (cod) ———
  if (actiune === "imagine") {
    const mediaId = taie(body.mediaId, 60);
    if (!segmentCheieValid(mediaId)) return json({ eroare: "Referință invalidă." }, 400);
    let permis = false;
    if (body.cid) {
      const cand = await candidatDinCod(body.cid);
      const part = await citesteParticipanti(id);
      permis = !!cand && !cand.faraCodEtic && esteParticipant(part, cand.id) && ["published", "closed"].includes(s.status);
    } else if (body.cod) {
      permis = poateAdministraSesiunea(actorDinCod(body.cod), s);
    }
    if (!permis) return json({ eroare: "Acces refuzat la resursă." }, 403);
    const media = await st.get("media/" + id + "/" + mediaId, { type: "json" }).catch(() => null);
    if (!media) return json({ eroare: "Imagine inexistentă." }, 404);
    return json({ dataUrl: "data:" + media.contentType + ";base64," + media.b64, alt: media.alt || "" });
  }

  // ——— Lector/Admin ———
  let actor;
  try { actor = cereLector(body.cod); } catch (e) { return json({ eroare: e.eroare }, e.status); }
  if (!poateAdministraSesiunea(actor, s)) return json({ eroare: "Nu ai drept asupra acestei sesiuni." }, 403);

  if (actiune === "upload") {
    if (s.status !== "draft") return json({ eroare: "Adaugă imagini doar cât sesiunea e în lucru (schiță)." }, 409);
    const p = parseDataUrl(body.dataUrl);
    if (!p || !TIPURI[p.contentType]) return json({ eroare: "Format acceptat: JPEG, PNG sau WebP." }, 400);
    if (p.b64.length > MAX_B64) return json({ eroare: "Imaginea depășește ~2 MB. Redu dimensiunea." }, 413);
    const mediaId = "m-" + randomUUID().slice(0, 10);
    await st.setJSON("media/" + id + "/" + mediaId, { contentType: p.contentType, alt: taie(body.alt, 300), b64: p.b64, creat: acum() });
    s.imagini = [...(s.imagini || []), { mediaId, alt: taie(body.alt, 300) }].slice(0, 12);
    s.actualizat = acum();
    await st.setJSON("session/" + id, s);
    await scrieInIndex(s);
    await audit(id, actor, "upload-imagine", mediaId);
    return json({ ok: true, imagini: s.imagini });
  }

  if (actiune === "sterge") {
    const mediaId = taie(body.mediaId, 60);
    if (!segmentCheieValid(mediaId)) return json({ eroare: "Referință invalidă." }, 400);
    try { await st.delete("media/" + id + "/" + mediaId); } catch (err) { console.error(err); }
    s.imagini = (s.imagini || []).filter((x) => x.mediaId !== mediaId);
    s.actualizat = acum();
    await st.setJSON("session/" + id, s);
    await scrieInIndex(s);
    await audit(id, actor, "sterge-imagine", mediaId);
    return json({ ok: true, imagini: s.imagini });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
