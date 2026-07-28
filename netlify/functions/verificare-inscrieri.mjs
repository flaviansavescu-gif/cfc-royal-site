// =========================================================================
// verificare-inscrieri.mjs — verificarea documentară a înscrierilor, de către Registratură,
// ÎNAINTE ca ele să intre în managerul de expoziții.
//
// DE CE aici și nu în manager: managerul nu are cartea de origini. El nu poate spune dacă
// un număr de pedigree există cu adevărat, dacă microcipul se potrivește sau dacă omul e
// într-adevăr membru. Registratura poate — toate acestea sunt la ea. Iar înscrierile stau
// oricum câteva zile în coada de pe site înainte de import: exact fereastra în care se pot
// verifica, fără să atingă nimeni managerul.
//
// CE VEDE registratorul: datele exemplarului și datele de contact ale proprietarului, ca
// să-l poată suna când ceva nu se potrivește. NU vede nimic din zona banilor — nici taxa,
// nici dovada plății, nici reducerea de student. Dovada plății e poza unui transfer, cu
// datele de cont ale omului pe ea; n-are nicio treabă cu verificarea unui pedigree.
// Filtrarea se face AICI, pe server: ce nu pleacă nu poate fi văzut.
//
// VERIFICAREA NU BLOCHEAZĂ NIMIC. Dacă registratura n-a apucat să se uite, importul merge
// mai departe și fișa rămâne doar nemarcată. Altfel, o zi aglomerată a președintelui ar
// putea opri o expoziție.
//
// POST { cod, dispozitiv, actiune:"expozitii" }                 -> expozițiile cu înscrieri
// POST { cod, dispozitiv, actiune:"inscrieri", showId }         -> înscrierile, filtrate
// POST { cod, dispozitiv, actiune:"marcheaza", cheie, stare, nota?, membruConfirmat? }
// =========================================================================
import { getStore } from "@netlify/blobs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { registratorDinCod } from "./registru-acces.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";

// Înscrierile stau în magazia expozițiilor; cheile de dispozitiv, în cea a registrului.
// Nu le amesteca: o căutare de jeton în magazia greșită a ținut deja pe cineva afară.
const expo = () => getStore({ name: "expozitii", consistency: "strong" });
const registru = () => getStore({ name: "registru", consistency: "strong" });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

export const STARI = ["verificat", "lamurit"];
export const LIMITA_NOTA = 300;

/**
 * Ce pleacă spre browserul registratorului. Lista albă, nu neagră: dacă mâine apare un
 * câmp nou în înscriere, el NU ajunge aici din greșeală.
 */
export function pentruRegistratura(i, cheie) {
  return {
    cheie,
    creat: i.creat || null,
    importat: i.importat === true,
    caine: {
      nume: i.numeCaine || "",
      rasa: i.rasaNumeRo || "",
      sex: i.sex || "",
      dataNasterii: i.dataNasterii || "",
      pedigree: i.pedigree || null,
      pedigreeTipicitate: i.pedigreeTipicitate === true,
      microcip: i.microcip || null,
      crescator: i.crescator || null,
      culoareRoba: i.culoareRoba || null,
      tata: i.tata || null,
      mama: i.mama || null,
      clasa: i.clasa || "",
    },
    proprietar: {
      nume: i.numeProprietar || "",
      email: i.email || "",
      telefon: i.telefon || null,
      tara: i.tara || null,
    },
    // Din declarațiile de la taxă pleacă DOAR calitatea de membru — singura pe care
    // registratura o poate confirma, având lista de membri. Studentul se dovedește cu
    // carnetul, la secretariat; suma și dovada plății nu ies de aici niciodată.
    declaraMembru: !!(i.declaratii && i.declaratii.membru),
    verificare: i.verificare || null,
  };
}

/** Rezumatul unei expoziții pentru lista din capul paginii. */
export function rezumat(inscrieri) {
  let verificate = 0, lamurit = 0;
  for (const i of inscrieri) {
    const s = i.verificare && i.verificare.stare;
    if (s === "verificat") verificate++;
    else if (s === "lamurit") lamurit++;
  }
  return { total: inscrieri.length, verificate, lamurit, neatinse: inscrieri.length - verificate - lamurit };
}

/** Cine cere: registratură sau administrator. Nimeni altcineva. */
async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin", nume: "Administrator" };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", nume: r.nume || "Registratură" };
  return null;
}

async function inscrieriDin(showId) {
  const s = expo();
  const rezultat = [];
  const { blobs } = await s.list({ prefix: "coada/" + showId + "/" });
  for (const b of blobs) {
    const i = await s.get(b.key, { type: "json" }).catch(() => null);
    if (i) rezultat.push({ cheie: b.key, i });
  }
  rezultat.sort((a, b) => String(a.i.creat || "").localeCompare(String(b.i.creat || "")));
  return rezultat;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  const eu = await cine(taie(body.cod, 60));
  if (!eu) return json({ eroare: "Cod incorect." }, 401);

  // A doua cheie, ca peste tot unde rolul e greu.
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(registru(), taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);
  }

  const actiune = taie(body.actiune, 40);

  // —— Expozițiile care au înscrieri de verificat ——
  if (actiune === "expozitii") {
    const s = expo();
    const expozitii = [];
    try {
      const { blobs } = await s.list({ prefix: "config/" });
      for (const b of blobs) {
        const c = await s.get(b.key, { type: "json" }).catch(() => null);
        if (!c || !c.showId) continue;
        const lista = (await inscrieriDin(c.showId)).map((x) => x.i);
        if (!lista.length) continue;
        expozitii.push({
          showId: c.showId, nume: c.nume, data: c.data, locatie: c.locatie || "",
          termen: c.termen || null, ...rezumat(lista),
        });
      }
    } catch (err) {
      console.error("Listarea expozițiilor a eșuat:", err);
      return json({ eroare: "Nu am putut citi expozițiile." }, 500);
    }
    expozitii.sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
    return json({ expozitii });
  }

  // —— Înscrierile unei expoziții ——
  if (actiune === "inscrieri") {
    const showId = taie(body.showId, 60);
    if (!showId) return json({ eroare: "Expoziție lipsă." }, 400);
    try {
      const brute = await inscrieriDin(showId);
      return json({ inscrieri: brute.map((x) => pentruRegistratura(x.i, x.cheie)) });
    } catch (err) {
      console.error("Citirea înscrierilor a eșuat:", err);
      return json({ eroare: "Nu am putut citi înscrierile." }, 500);
    }
  }

  // —— Marcarea unei înscrieri ——
  if (actiune === "marcheaza") {
    const cheie = taie(body.cheie, 200);
    if (!cheie.startsWith("coada/")) return json({ eroare: "Cheie invalidă." }, 400);
    const stare = taie(body.stare, 20);
    if (stare && !STARI.includes(stare)) return json({ eroare: "Stare necunoscută." }, 400);

    const s = expo();
    // Recitim chiar înainte de scriere: între timp managerul poate fi marcat înscrierea
    // ca importată, iar noi n-avem voie să pierdem acel semn.
    const i = await s.get(cheie, { type: "json" }).catch(() => null);
    if (!i) return json({ eroare: "Înscrierea nu mai există." }, 404);

    const verificare = stare
      ? {
          stare,
          nota: taie(body.nota, LIMITA_NOTA) || null,
          // `null` = nu s-a pronunțat; true/false = a confirmat sau a infirmat.
          membruConfirmat: typeof body.membruConfirmat === "boolean" ? body.membruConfirmat : null,
          cine: eu.nume,
          cand: new Date().toISOString(),
        }
      : null;   // stare goală = se șterge marcajul

    await s.setJSON(cheie, { ...i, verificare });
    return json({ ok: true, verificare });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
