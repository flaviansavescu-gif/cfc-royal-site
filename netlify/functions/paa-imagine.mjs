// paa-imagine.mjs — imaginile sesiunilor: upload validat + servire gated.
// Stocare BINARĂ privată în Blobs (nu base64 în „DB"): image/<id> = bytes,
// image-meta/<id> = { userId, contentType, w, h, marime, creat }.
// Cursant: incarca | serveste (proprietar).  Lector: serveste (review).
import { json, taie, acum, idNou, candidatDinId, actorDinCod, store, candidatDinCod, MESAJ_ETICA} from "./_paa/lib.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

const TIPURI = { "image/jpeg": 1, "image/png": 1, "image/webp": 1 };
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  return { contentType: m[1], buf: Buffer.from(m[2], "base64") };
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20);
  const st = store();

  if (actiune === "incarca") {
    const cand = await candidatDinCod(body.cid);
    if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);
    if (cand.faraCodEtic) return json({ eroare: MESAJ_ETICA, trebuieAsumat: true }, 403);
    const p = parseDataUrl(body.dataUrl);
    if (!p || !TIPURI[p.contentType]) return json({ eroare: "Format acceptat: JPEG, PNG sau WebP." }, 400);
    if (p.buf.length > MAX_BYTES) return json({ eroare: "Imaginea depășește 6 MB. Redu dimensiunea." }, 413);
    const id = idNou("img-");
    await st.set("image/" + id, p.buf, { metadata: { contentType: p.contentType } });
    await st.setJSON("image-meta/" + id, {
      userId: cand.id, contentType: p.contentType,
      w: Math.max(0, Math.min(20000, parseInt(body.w, 10) || 0)),
      h: Math.max(0, Math.min(20000, parseInt(body.h, 10) || 0)),
      marime: p.buf.length, creat: acum(),
    });
    return json({ ok: true, imageId: id });
  }

  if (actiune === "serveste") {
    const imageId = taie(body.imageId, 60);
    const meta = await st.get("image-meta/" + imageId, { type: "json" }).catch(() => null);
    if (!meta) return json({ eroare: "Imagine inexistentă." }, 404);
    // acces: proprietarul (cid) SAU un lector/admin (cod)
    let permis = false;
    if (body.cid) { const c = await candidatDinCod(body.cid); permis = !!c && !c.faraCodEtic && c.id === meta.userId; }
    else if (body.cod) { permis = !!actorDinCod(body.cod); }
    if (!permis) return json({ eroare: "Acces refuzat la imagine." }, 403);
    const bytes = await st.get("image/" + imageId, { type: "arrayBuffer" }).catch(() => null);
    if (!bytes) return json({ eroare: "Imagine inexistentă." }, 404);
    return new Response(bytes, { status: 200, headers: { "Content-Type": meta.contentType || "application/octet-stream", "Cache-Control": "private, no-store" } });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
