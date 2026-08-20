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
import { recomandareDin } from "./_comun/teste-sanatate.mjs";
import { obtineIndexCachedat } from "./_comun/index-cachedat.mjs";
import { CHEIE_INDEX_PUBLIC } from "./_comun/index-public.mjs";

const normCip = (v) => String(v || "").replace(/[\s-]/g, "");

// Microcipurile câinilor care au ACUM recomandarea de calitate CFC-Royal — cel puțin un
// test favorabil verificat și niciun test nefavorabil. Se calculează o singură dată la
// reconstruirea indexului, ca fișele de câine să nu ceară fiecare câte o interogare.
// Întoarcem doar apartenența (un Set de microcipuri), NU rezultatele — pe fișă câinele
// poartă un steag „recomandat", fără să scoatem la iveală microcipul în indexul răsfoibil.
async function microcipuriRecomandate(s) {
  const set = new Set();
  try {
    const { blobs } = await s.list({ prefix: "sanatate/" });
    for (const b of blobs) {
      const dosar = await s.get(b.key, { type: "json" }).catch(() => null);
      if (!dosar?.microcip) continue;
      const verificate = (dosar.teste || []).filter((t) => t.stare === "verificat");
      if (recomandareDin(verificate).acordata) set.add(normCip(dosar.microcip));
    }
  } catch (err) { console.error("Index public (recomandări) eșuat:", err); }
  return set;
}

const store = () => getStore({ name: "registru", consistency: "strong" });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });

// TTL-ul e acum doar PLASĂ DE SIGURANȚĂ: scrierile care schimbă registrul șterg indexul
// pe loc (invalideazaIndexPublic, chemată din pedigree/import/sănătate/canise), deci
// datele proaspete apar imediat, nu la expirarea ceasului. Reconstrucția scumpă (scanarea
// întregului registru) nu se mai plătește decât după o schimbare reală — sau, rar, aici.
const TTL_MS = 30 * 60e3;
const CHEIE_INDEX = CHEIE_INDEX_PUBLIC;

async function construieste(s) {
  const recomandati = await microcipuriRecomandate(s);

  // Câinii cu certificat (fără proprietar — el rămâne mascat, ca pe fișă).
  const caini = [];
  try {
    const { blobs } = await s.list({ prefix: "pedigree/" });
    for (const b of blobs) {
      const c = await s.get(b.key, { type: "json" }).catch(() => null);
      if (!c || !c.caine) continue;
      const afix = c.crescator?.afix || "";
      caini.push({
        serie: c.serie,
        nume: c.caine.nume || "",
        rasa: c.caine.rasa || "",
        sex: c.caine.sex || "",
        afix,
        afixNorm: afix ? normalizeazaAfix(afix) : "",
        numarWDF: c.numarWDF || "",
        an: String(c.caine.dataNasterii || c.emis || "").slice(0, 4),
        anulat: !!c.anulat,
        // Steag, nu date medicale: câinele are recomandarea de calitate CFC-Royal.
        recomandat: !c.anulat && recomandati.has(normCip(c.caine.microcip)),
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
    canise.push({ afix, afixNorm: n, nrAfix: nrAfix || "" });
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
  const idx = await obtineIndexCachedat(s, { cheie: CHEIE_INDEX, ttlMs: TTL_MS, construieste });
  return json(idx);
};
