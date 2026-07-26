// cod-etic.mjs — asumarea Codului Etic la intrarea în Școala de Arbitraj.
//
// Fiecare candidat, arbitru și lector confirmă, o singură dată, că a citit și își asumă
// Codul Etic al CFC-Royal. Confirmarea se înregistrează cu numele, rolul și data — devine
// actul pe care se sprijină procedura disciplinară („a fost înștiințat și și-a asumat").
//
// Confirmarea e legată de VERSIUNEA codului: dacă textul se schimbă, se ridică `VERSIUNE`
// aici, iar toți sunt rugați să reconfirme — vechile asumări rămân în evidență.
//
// Stocare (store „cursuri"): cod-etic/<versiune>/<id> -> { nume, rol, data }
//
// POST { cid|cod, actiune:"stare" }  -> { versiune, asumat, data?, nume, rol }
// POST { cid|cod, actiune:"asuma" }  -> { ok, data }
// POST { cod, actiune:"situatie" }   -> { versiune, membri:[...] }   (doar admin)
import { getStore } from "@netlify/blobs";
import { rolLaIntrare, actorDinCod, sha256, LECTORI } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

/** Versiunea Codului Etic asumată acum. Se ridică DOAR când se schimbă textul. */
export const VERSIUNE = "2026-07";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/** Cine confirmă? Candidat (cod individual), arbitru, lector — nu codul comun, nu adminul. */
async function membrul(body, store) {
  const cid = String(body.cid || "").trim();
  if (cid) {
    try {
      const c = await store.get("candidat/" + cid, { type: "json" });
      if (c) return { id: cid, nume: String(c.nume || "").trim() || "Candidat", rol: "candidat" };
    } catch (err) { console.error("Căutare candidat eșuată:", err); }
  }
  const cod = String(body.cod || "").trim();
  if (cod) {
    const fix = rolLaIntrare(cod);
    if (fix?.rol === "lector") return { id: sha256(cod), nume: fix.nume, rol: "lector" };
    if (fix) return null; // adminul și codul comun nu au dosar personal de asumare
    try {
      const a = await store.get("arbitru/" + sha256(cod), { type: "json" });
      if (a) return { id: sha256(cod), nume: String(a.nume || "").trim() || "Arbitru", rol: "arbitru" };
    } catch (err) { console.error("Căutare arbitru eșuată:", err); }
  }
  return null;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = String(body.actiune || "stare");
  // Store-ul se creează abia după porți.

  if (actiune === "situatie") {
    if (actorDinCod(String(body.cod || ""))?.rol !== "admin")
      return json({ eroare: "Doar administratorul vede situația." }, 401);
    const store = getStore("cursuri");

    const asumari = {};
    try {
      const { blobs } = await store.list({ prefix: `cod-etic/${VERSIUNE}/` });
      for (const b of blobs) {
        const a = await store.get(b.key, { type: "json" });
        if (a) asumari[b.key.slice(`cod-etic/${VERSIUNE}/`.length)] = a;
      }
    } catch (err) { console.error(err); }

    // Toți cei care TREBUIE să asume: candidați + arbitri + lectori.
    const membri = [];
    for (const l of LECTORI) {
      const a = asumari[l.hash];
      membri.push({ nume: l.nume, rol: "lector", asumat: !!a, data: a?.data ?? null });
    }
    for (const [prefix, rol] of [["arbitru/", "arbitru"], ["candidat/", "candidat"]]) {
      try {
        const { blobs } = await store.list({ prefix });
        for (const b of blobs) {
          const x = await store.get(b.key, { type: "json" });
          if (!x) continue;
          const id = b.key.slice(prefix.length);
          const a = asumari[id];
          membri.push({ nume: x.nume, rol, asumat: !!a, data: a?.data ?? null });
        }
      } catch (err) { console.error(err); }
    }
    membri.sort((a, b) => Number(a.asumat) - Number(b.asumat) || a.nume.localeCompare(b.nume, "ro"));
    return json({ versiune: VERSIUNE, membri });
  }

  // Fără nicio acreditare nu atingem stocarea — răspundem „anonim" din prima.
  const areAcreditare = String(body.cid || "").trim() || String(body.cod || "").trim();
  if (!areAcreditare) return json({ versiune: VERSIUNE, asumat: true, anonim: true });

  const store = getStore("cursuri");
  const cine = await membrul(body, store);
  // Fără identitate personală (cod comun, admin) nu cerem și nu înregistrăm asumarea:
  // răspundem „asumat", ca poarta din pagini să nu blocheze pe nimeni degeaba.
  if (!cine) return json({ versiune: VERSIUNE, asumat: true, anonim: true });

  const cheie = `cod-etic/${VERSIUNE}/${cine.id}`;

  if (actiune === "stare") {
    const a = await store.get(cheie, { type: "json" }).catch(() => null);
    return json({ versiune: VERSIUNE, asumat: !!a, data: a?.data ?? null, nume: cine.nume, rol: cine.rol });
  }

  if (actiune === "asuma") {
    const existent = await store.get(cheie, { type: "json" }).catch(() => null);
    if (existent) return json({ ok: true, data: existent.data }); // idempotent
    const data = new Date().toISOString();
    await store.setJSON(cheie, { nume: cine.nume, rol: cine.rol, data });
    return json({ ok: true, data });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
