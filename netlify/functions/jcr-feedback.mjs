// jcr-feedback.mjs — feedback individual și colectiv, publicabil de lector.
// Lector: salveaza | citeste.  Cursant: citeste-cursant (doar ce e publicat).
import { json, taie, acum, cereLector, candidatDinId, poateAdministraSesiunea, store, citesteParticipanti, esteParticipant, audit, candidatDinCod} from "./_jcr/lib.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20);
  const id = taie(body.id, 40);
  if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
  if (!id) return json({ eroare: "Lipsește sesiunea." }, 400);
  const st = store();

  if (actiune === "citeste-cursant") {
    const cand = await candidatDinCod(body.cid);
    if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);
    const part = await citesteParticipanti(id);
    if (!esteParticipant(part, cand.id)) return json({ eroare: "Nu ești alocat acestei sesiuni." }, 403);
    const ind = await st.get("feedback/" + id + "/" + cand.id, { type: "json" }).catch(() => null);
    const grup = await st.get("feedback/" + id + "/_group", { type: "json" }).catch(() => null);
    return json({
      individual: ind && ind.publicat ? { text: ind.text, actualizat: ind.actualizat } : null,
      grup: grup && grup.publicat ? { text: grup.text, actualizat: grup.actualizat } : null,
    });
  }

  let actor;
  try { actor = cereLector(body.cod); } catch (e) { return json({ eroare: e.eroare }, e.status); }
  const s = await st.get("session/" + id, { type: "json" }).catch(() => null);
  if (!s) return json({ eroare: "Sesiune inexistentă." }, 404);
  if (!poateAdministraSesiunea(actor, s)) return json({ eroare: "Nu ai drept asupra acestei sesiuni." }, 403);

  if (actiune === "salveaza") {
    const tip = taie(body.tip, 20) === "grup" ? "grup" : "individual";
    const key = tip === "grup" ? "feedback/" + id + "/_group" : "feedback/" + id + "/" + taie(body.candidatId, 80);
    if (tip === "individual" && !taie(body.candidatId, 80)) return json({ eroare: "Lipsește candidatul." }, 400);
    const fb = { text: taie(body.text, 6000), publicat: !!body.publicat, actualizat: acum(), autor: actor.slug || "admin" };
    await st.setJSON(key, fb);
    await audit(id, actor, "feedback-" + tip + (fb.publicat ? "-publicat" : "-salvat"), body.candidatId || "grup");
    return json({ ok: true, feedback: fb });
  }

  if (actiune === "citeste") {
    const grup = await st.get("feedback/" + id + "/_group", { type: "json" }).catch(() => null);
    const individual = {};
    try {
      const { blobs } = await st.list({ prefix: "feedback/" + id + "/" });
      for (const b of blobs) {
        const cid = b.key.slice(("feedback/" + id + "/").length);
        if (cid === "_group") continue;
        individual[cid] = await st.get(b.key, { type: "json" });
      }
    } catch (err) { console.error(err); }
    return json({ grup: grup || null, individual });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
