// registru-public.mjs — registrul PUBLIC căutabil (cartea de origini, răsfoibilă).
//
// DE CE. Fișa publică a câinelui (/caine/) răspunde doar la o căutare EXACTĂ (serie, număr
// WDF sau microcip). O carte de origini adevărată se poate și RĂSFOI: oricine vede ce câini
// și ce canise are clubul — transparența pe care o așteaptă un registru serios.
//
// Ce dă (public, fără cod): un index compact cu toți câinii cu certificat și toate afixele.
// Datele sunt CELE DEJA publice pe fișă — nume, rasă, sex, afixul crescătorului, numărul WDF.
// Proprietarul NU apare (e mascat peste tot, ca pe fișă).
//
// Indexul e CACHEDAT (`registru-public/index`) și se reconstruiește singur când e învechit
// (TTL), ca să nu scaneze tot registrul la fiecare vizitator.
import { getStore } from "@netlify/blobs";
import { AFIXE_OFICIALE } from "./_comun/afixe-oficiale.mjs";
import { normalizeazaAfix, PREFIX_CANISE } from "./_comun/canise.mjs";

const store = () => getStore({ name: "registru", consistency: "strong" });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });

const TTL_MS = 5 * 60e3;        // reîmprospătarea indexului, cel mult o dată la 5 minute
const CHEIE_INDEX = "registru-public/index";

async function construieste(s) {
  // Câinii cu certificat (fără proprietar — el rămâne mascat, ca pe fișă).
  const caini = [];
  try {
    const { blobs } = await s.list({ prefix: "pedigree/" });
    for (const b of blobs) {
      const c = await s.get(b.key, { type: "json" }).catch(() => null);
      if (!c || !c.caine) continue;
      caini.push({
        serie: c.serie,
        nume: c.caine.nume || "",
        rasa: c.caine.rasa || "",
        sex: c.caine.sex || "",
        afix: c.crescator?.afix || "",
        numarWDF: c.numarWDF || "",
        an: String(c.caine.dataNasterii || c.emis || "").slice(0, 4),
        anulat: !!c.anulat,
      });
    }
  } catch (err) { console.error("Index public (câini) eșuat:", err); }
  caini.sort((a, b) => String(a.nume).localeCompare(String(b.nume), "ro"));

  // Afixele: evidența oficială (AFX…) + caniselele înregistrate online. Fără date de membru.
  const canise = [];
  const vazut = new Set();
  const adauga = (afix, nrAfix) => {
    const n = normalizeazaAfix(afix);
    if (!afix || vazut.has(n)) return;
    vazut.add(n);
    canise.push({ afix, nrAfix: nrAfix || "" });
  };
  for (const a of AFIXE_OFICIALE) adauga(a.afix, a.nrAfix);
  try {
    const { blobs } = await s.list({ prefix: PREFIX_CANISE });
    for (const b of blobs) {
      const k = await s.get(b.key, { type: "json" }).catch(() => null);
      if (k?.afix) adauga(k.afix, k.nrAfix);
    }
  } catch (err) { console.error("Index public (canise) eșuat:", err); }
  canise.sort((a, b) => String(a.afix).localeCompare(String(b.afix), "ro"));

  return { generat: new Date().toISOString(), caini, canise };
}

export default async () => {
  const s = store();
  let idx = await s.get(CHEIE_INDEX, { type: "json" }).catch(() => null);
  const proaspat = idx && (Date.now() - Date.parse(idx.generat || 0)) <= TTL_MS;
  if (!proaspat) {
    idx = await construieste(s);
    await s.setJSON(CHEIE_INDEX, idx).catch(() => {});
  }
  return json(idx);
};
