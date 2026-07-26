// formare-arbitri.mjs — formarea continuă anuală a arbitrilor autorizați.
//
// O dată pe an, arbitrii (inclusiv lectorii) parcurg modulul de actualizare și susțin
// mini-testul. Promovarea se înregistrează per arbitru și an — evidența Colegiului.
// Cheia de corectare stă DOAR aici; întrebările (fără răspunsuri) sunt în cursuri.ts.
//
// Stocare (store „cursuri"): formare/<an>/<sha256(cod)> -> { nume, rol, procent, promovat, data }
//
// POST { cod, actiune:"stare" }                 -> { an, promovat, procent?, data? }
// POST { cod, actiune:"trimite", raspunsuri }   -> { corecte, total, procent, promovat }
// POST { cod, actiune:"situatie" }              -> { an, arbitri:[...] }   (doar admin)
import { getStore } from "@netlify/blobs";
import { rolLaIntrare, actorDinCod, sha256, LECTORI } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

const AN = 2026;
const PRAG = 70;
// Cheia testului „Actualizarea anuală 2026" — indexul opțiunii corecte per întrebare.
const CHEIE = [1, 2, 0, 1, 0, 2, 0, 1, 0, 2];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/** Cine susține formarea? Arbitru din registru sau lector (lectorii sunt și ei arbitri). */
async function arbitrul(cod, store) {
  const c = String(cod || "").trim();
  if (!c) return null;
  const fix = rolLaIntrare(c);
  if (fix?.rol === "lector") return { id: sha256(c), nume: fix.nume, rol: "lector" };
  if (fix) return null; // admin/cod comun nu au dosar de formare
  try {
    const a = await store.get("arbitru/" + sha256(c), { type: "json" });
    if (a) return { id: sha256(c), nume: String(a.nume || "").trim() || "Arbitru", rol: "arbitru" };
  } catch (err) {
    console.error("Căutare arbitru eșuată:", err);
  }
  return null;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = String(body.actiune || "");
  // Store-ul se creează abia după porți: cine nu trece nu atinge stocarea (și funcția
  // rămâne testabilă local, fără mediu Netlify).

  if (actiune === "situatie") {
    if (actorDinCod(String(body.cod || ""))?.rol !== "admin")
      return json({ eroare: "Doar administratorul vede situația." }, 401);
    const store = getStore("cursuri");
    // Toți cei care AR TREBUI să facă formarea: lectorii (din roluri) + arbitrii din registru.
    const dosare = {};
    try {
      const { blobs } = await store.list({ prefix: `formare/${AN}/` });
      for (const b of blobs) {
        const d = await store.get(b.key, { type: "json" });
        if (d) dosare[b.key.slice(`formare/${AN}/`.length)] = d;
      }
    } catch (err) { console.error(err); }
    const arbitri = [];
    for (const l of LECTORI) {
      const d = dosare[l.hash] || null;
      arbitri.push({ nume: l.nume, rol: "lector", promovat: !!d?.promovat, procent: d?.procent ?? null, data: d?.data ?? null });
    }
    try {
      const { blobs } = await store.list({ prefix: "arbitru/" });
      for (const b of blobs) {
        const a = await store.get(b.key, { type: "json" });
        if (!a) continue;
        const id = b.key.slice("arbitru/".length);
        const d = dosare[id] || null;
        arbitri.push({ nume: a.nume, rol: "arbitru", promovat: !!d?.promovat, procent: d?.procent ?? null, data: d?.data ?? null });
      }
    } catch (err) { console.error(err); }
    arbitri.sort((a, b) => a.nume.localeCompare(b.nume, "ro"));
    return json({ an: AN, arbitri });
  }

  // Codurile fixe (lector) se verifică fără store; registrul arbitrilor cere store —
  // dar numai pentru coduri care nu sunt respinse din prima (goale/comune/admin).
  const codBrut = String(body.cod || "").trim();
  if (!codBrut) return json({ eroare: "Formarea continuă este pentru arbitrii autorizați (cod de arbitru sau de lector)." }, 403);
  const fixRapid = rolLaIntrare(codBrut);
  if (fixRapid && fixRapid.rol !== "lector")
    return json({ eroare: "Formarea continuă este pentru arbitrii autorizați (cod de arbitru sau de lector)." }, 403);

  const store = getStore("cursuri");
  const cine = await arbitrul(codBrut, store);
  if (!cine) return json({ eroare: "Formarea continuă este pentru arbitrii autorizați (cod de arbitru sau de lector)." }, 403);
  const cheie = `formare/${AN}/${cine.id}`;

  if (actiune === "stare") {
    const d = await store.get(cheie, { type: "json" }).catch(() => null);
    return json({ an: AN, nume: cine.nume, promovat: !!d?.promovat, procent: d?.procent ?? null, data: d?.data ?? null });
  }

  if (actiune === "trimite") {
    const raspunsuri = body.raspunsuri;
    if (!Array.isArray(raspunsuri) || raspunsuri.length !== CHEIE.length)
      return json({ eroare: "Răspunde la toate întrebările." }, 400);

    let corecte = 0;
    const gresite = [];
    CHEIE.forEach((c, i) => {
      if (Number(raspunsuri[i]) === c) corecte++;
      else gresite.push(i + 1);
    });
    const procent = Math.round((corecte / CHEIE.length) * 100);
    const promovat = procent >= PRAG;

    // Se reține cel mai bun rezultat al anului; promovarea nu se pierde la o reluare slabă.
    const vechi = await store.get(cheie, { type: "json" }).catch(() => null);
    if (!vechi || procent > (vechi.procent ?? 0) || (promovat && !vechi.promovat)) {
      await store.setJSON(cheie, {
        nume: cine.nume,
        rol: cine.rol,
        procent,
        promovat: promovat || !!vechi?.promovat,
        data: new Date().toISOString().slice(0, 10),
      });
    }

    return json({ corecte, total: CHEIE.length, procent, promovat, prag: PRAG, gresite });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
