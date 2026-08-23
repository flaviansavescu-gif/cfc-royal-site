// paa-standarde.mjs — standarde de rasă VERSIONATE pentru Photo Anatomy Annotator.
// Public: lista | detalii (necesare app-ului pentru a calcula statutul).
// Admin: salveaza | sterge | seed-demo  (cu audit).
// NU inventăm limite WDF: datele demo sunt marcate explicit `demo:true`.
import { json, taie, acum, cereAdmin, store, audit } from "./_paa/lib.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";

const SEVERITATI = ["informativ", "minor", "major"];

/** Rasa + versiunea sunt segmente de cheie de blob venite din client (chiar public la
 *  `detalii`): fără gardian, un `..` ar traversa în magazia PAA la alte chei. */
const cheieStandardValida = (rasa, versiune) => segmentCheieValid(rasa) && segmentCheieValid(versiune);

function curataMetric(m, i) {
  const numOrNull = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
  return {
    metrica: taie(m.metrica, 60) || "metrica_" + (i + 1),
    unitate: taie(m.unitate, 20) || "%",
    min: numOrNull(m.min), max: numOrNull(m.max), tinta: numOrNull(m.tinta),
    severitate: SEVERITATI.includes(taie(m.severitate, 20)) ? taie(m.severitate, 20) : "informativ",
    explicatie: taie(m.explicatie, 1000),
  };
}

async function citesteIndex() { try { return (await store().get("std-index", { type: "json" })) || []; } catch { return []; } }
async function scrieIndex(std) {
  const idx = await citesteIndex();
  const rand = { rasa: std.rasa, versiune: std.versiune, status: std.status, demo: !!std.demo, sursa: std.sursa || "", dataVigoare: std.dataVigoare || "" };
  const i = idx.findIndex((x) => x.rasa === std.rasa && x.versiune === std.versiune);
  if (i >= 0) idx[i] = rand; else idx.push(rand);
  await store().setJSON("std-index", idx);
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20) || "lista";
  const st = store();

  // ——— Public (citire pentru calcul) ———
  if (actiune === "lista") return json({ standarde: await citesteIndex() });
  if (actiune === "detalii") {
    const rasa = taie(body.rasa, 120), versiune = taie(body.versiune, 40);
    if (!cheieStandardValida(rasa, versiune)) return json({ eroare: "Referință invalidă." }, 400);
    const s = await st.get("std/" + rasa + "/" + versiune, { type: "json" }).catch(() => null);
    if (!s) return json({ eroare: "Standard inexistent." }, 404);
    return json({ standard: s });
  }

  // ——— Admin ———
  let actor;
  try { actor = cereAdmin(body.cod); } catch (e) { return json({ eroare: e.eroare }, e.status); }

  if (actiune === "salveaza") {
    const rasa = taie(body.rasa, 120), versiune = taie(body.versiune, 40);
    if (!rasa || !versiune) return json({ eroare: "Rasa și versiunea sunt obligatorii." }, 400);
    if (!cheieStandardValida(rasa, versiune)) return json({ eroare: "Referință invalidă." }, 400);
    const std = {
      rasa, versiune, sursa: taie(body.sursa, 300), dataVigoare: taie(body.dataVigoare, 40),
      status: taie(body.status, 20) || "draft", demo: !!body.demo,
      metrics: (Array.isArray(body.metrics) ? body.metrics : []).slice(0, 40).map(curataMetric),
      actualizat: acum(),
    };
    await st.setJSON("std/" + rasa + "/" + versiune, std);
    await scrieIndex(std);
    await audit("standard-salvat", actor, rasa + " " + versiune);
    return json({ ok: true, standard: std });
  }

  if (actiune === "sterge") {
    const rasa = taie(body.rasa, 120), versiune = taie(body.versiune, 40);
    if (!cheieStandardValida(rasa, versiune)) return json({ eroare: "Referință invalidă." }, 400);
    try { await st.delete("std/" + rasa + "/" + versiune); } catch (err) { console.error(err); }
    const idx = (await citesteIndex()).filter((x) => !(x.rasa === rasa && x.versiune === versiune));
    await st.setJSON("std-index", idx);
    await audit("standard-sters", actor, rasa + " " + versiune);
    return json({ ok: true });
  }

  if (actiune === "seed-demo") {
    const rasa = "DEMO — Ciobănesc de talie medie", versiune = "demo-1";
    const cheie = "std/" + rasa + "/" + versiune;
    const exist = await st.get(cheie, { type: "json" }).catch(() => null);
    if (exist) return json({ ok: true, existent: true });
    const std = {
      rasa, versiune, sursa: "Date DEMONSTRATIVE — NU standard WDF oficial", dataVigoare: acum().slice(0, 10),
      status: "demo", demo: true,
      metrics: [
        { metrica: "indice_corporal", unitate: "%", min: 100, max: 112, tinta: 106, severitate: "minor", explicatie: "Lungimea corpului raportată la înălțimea la greabăn (demo)." },
        { metrica: "adancime_torace", unitate: "%", min: 48, max: 55, tinta: 50, severitate: "minor", explicatie: "Adâncimea toracelui ca procent din înălțimea la greabăn (demo)." },
        { metrica: "segment_membru_anterior", unitate: "%", min: 50, max: 58, tinta: 54, severitate: "informativ", explicatie: "Segmentul membrului anterior raportat la greabăn (demo)." },
        { metrica: "raport_craniu_bot", unitate: "raport", min: 1.0, max: 1.3, tinta: 1.15, severitate: "informativ", explicatie: "Raportul craniu/bot (demo)." },
      ],
      actualizat: acum(),
    };
    await st.setJSON(cheie, std);
    await scrieIndex(std);
    await audit("standard-seed-demo", actor, rasa);
    return json({ ok: true, standard: std });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
