// paa-sesiuni.mjs — sesiuni de adnotare (Photo Anatomy Annotator).
// Candidat, lector SAU admin (cid): lista | creaza | salveaza | detalii | sterge — fiecare
// pe sesiunile LUI. (Review lector — a vedea sesiunile altui candidat — rămâne Faza 2.)
import { json, taie, acum, idNou, store, cineDinCod } from "./_paa/lib.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

async function citesteIndex(userId) { try { return (await store().get("session-index/" + userId, { type: "json" })) || []; } catch { return []; } }
async function scrieIndex(userId, s) {
  const idx = await citesteIndex(userId);
  const rand = { id: s.id, titlu: s.titlu, rasa: s.rasa || "", creat: s.creat, actualizat: s.actualizat || acum() };
  const i = idx.findIndex((x) => x.id === s.id);
  if (i >= 0) idx[i] = rand; else idx.push(rand);
  await store().setJSON("session-index/" + userId, idx);
}

function curataSesiune(inp, baza, userId) {
  const s = baza || {};
  const arr = (a, n, map) => (Array.isArray(a) ? a.slice(0, n).map(map) : (s._raw && s._raw[n]) || []);
  return {
    id: s.id, userId,
    titlu: taie(inp.titlu ?? s.titlu, 160) || "Sesiune de adnotare",
    curs: taie(inp.curs ?? s.curs, 60),
    rasa: taie(inp.rasa ?? s.rasa, 120),
    stdRasa: taie(inp.stdRasa ?? s.stdRasa, 120),
    stdVersiune: taie(inp.stdVersiune ?? s.stdVersiune, 40),
    imageId: taie(inp.imageId ?? s.imageId, 60),
    aspect: Number.isFinite(+inp.aspect) ? +inp.aspect : (s.aspect || 1),
    calibrare: inp.calibrare && typeof inp.calibrare === "object" ? {
      mod: taie(inp.calibrare.mod, 20) || "relativ",
      greabanCm: Number.isFinite(+inp.calibrare.greabanCm) ? +inp.calibrare.greabanCm : null,
      referintaCm: Number.isFinite(+inp.calibrare.referintaCm) ? +inp.calibrare.referintaCm : null,
    } : (s.calibrare || { mod: "relativ" }),
    // straturi / adnotări / măsurători: stocate ca atare (structuri din editor), cu capace
    layers: Array.isArray(inp.layers) ? inp.layers.slice(0, 50) : (s.layers || []),
    annotations: Array.isArray(inp.annotations) ? inp.annotations.slice(0, 2000) : (s.annotations || []),
    measurements: Array.isArray(inp.measurements) ? inp.measurements.slice(0, 200) : (s.measurements || []),
    creat: s.creat || acum(),
    actualizat: acum(),
  };
}

// Poartă limitată: `cid` e o acreditare care se poate ghici (inclusiv codul de admin,
// prin cineDinCod) — fără limitare, funcția era un oracol de ghicire nelimitat.
export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20) || "lista";
  const cine = await cineDinCod(body.cid);
  if (!cine) return json({ eroare: "Cod invalid sau neautentificat în platformă." }, 401);
  const st = store();

  if (actiune === "lista") {
    const idx = await citesteIndex(cine.id);
    idx.sort((a, b) => String(b.actualizat || b.creat).localeCompare(String(a.actualizat || a.creat)));
    return json({ sesiuni: idx });
  }

  if (actiune === "creaza") {
    const id = idNou("s-");
    const s = curataSesiune(body.sesiune || body, { id, creat: acum() }, cine.id);
    await st.setJSON("session/" + id, s);
    await scrieIndex(cine.id, s);
    return json({ ok: true, sesiune: s });
  }

  const id = taie(body.id, 40);
  if (!id) return json({ eroare: "Lipsește sesiunea." }, 400);
  const existent = await st.get("session/" + id, { type: "json" }).catch(() => null);
  if (!existent) return json({ eroare: "Sesiune inexistentă." }, 404);
  if (existent.userId !== cine.id) return json({ eroare: "Nu îți aparține această sesiune." }, 403);

  if (actiune === "detalii") return json({ sesiune: existent });

  if (actiune === "salveaza") {
    const s = curataSesiune(body.sesiune || body, existent, cine.id);
    s.id = id;
    await st.setJSON("session/" + id, s);
    await scrieIndex(cine.id, s);
    return json({ ok: true, sesiune: s });
  }

  if (actiune === "sterge") {
    try { await st.delete("session/" + id); } catch (err) { console.error(err); }
    const idx = (await citesteIndex(cine.id)).filter((x) => x.id !== id);
    await st.setJSON("session-index/" + cine.id, idx);
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
