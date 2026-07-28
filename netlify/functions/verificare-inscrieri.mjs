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
// CE VEDE registratorul: dosarul întreg al înscrierii — actele exemplarului, datele de
// contact ale proprietarului, suma, declarațiile care o explică și dovada plății. Motivul:
// registratorii asociației au și extrasul de cont, deci confirmarea plății e o verificare
// pe care doar ei o pot face. Filtrarea rămâne o listă ALBĂ, aici pe server: se dă ce cere
// treaba, nici mai mult (cheile interne ale magaziei nu pleacă niciodată), nici mai puțin.
//
// DOUĂ MARCAJE DISTINCTE, fiindcă sunt două verificări diferite: actele („verificat" /
// „de lămurit") și plata („plata confirmată"). Altfel n-ai ști ce anume s-a controlat.
//
// VERIFICAREA NU BLOCHEAZĂ NIMIC. Dacă registratura n-a apucat să se uite, importul merge
// mai departe și fișa rămâne doar nemarcată. Altfel, o zi aglomerată a președintelui ar
// putea opri o expoziție.
//
// POST { cod, dispozitiv, actiune:"expozitii" }                 -> expozițiile cu înscrieri
// POST { cod, dispozitiv, actiune:"inscrieri", showId }         -> înscrierile, filtrate
// POST { cod, dispozitiv, actiune:"marcheaza", cheie, stare, nota?, membruConfirmat?, plataConfirmata? }
// POST { cod, dispozitiv, actiune:"dovada", cheie }             -> dovada plății (base64)
// POST { cod, dispozitiv, actiune:"audit", showId }             -> cine ce a verificat
// =========================================================================
import { getStore } from "@netlify/blobs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { registratorDinCod } from "./registru-acces.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeaza, ipCerere, FAPTE } from "./_comun/registru-jurnal.mjs";

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
      adresa: i.adresa || null,
      tara: i.tara || null,
    },
    // Zona plății: suma, ce a declarat omul (ca să se vadă DE CE e suma aceea) și dacă
    // a atașat dovada. Fișierul se cere separat, cu acțiunea „dovada" — nu-l cărăm în
    // fiecare listare.
    plata: {
      taxa: Number(i.taxa) || 0,
      aDeclaratPlata: i.amPlatit === true,
      areDovada: !!i.dovadaKey,
      dovadaNume: i.dovadaNume || null,
      membru: !!(i.declaratii && i.declaratii.membru),
      student: !!(i.declaratii && i.declaratii.student),
      caineNr: (i.declaratii && Number(i.declaratii.caineNr)) || null,
      observatie: i.taxaObservatie || null,
    },
    declaraMembru: !!(i.declaratii && i.declaratii.membru),
    verificare: i.verificare || null,
  };
}

/** Rezumatul unei expoziții pentru lista din capul paginii. */
export function rezumat(inscrieri) {
  let verificate = 0, lamurit = 0, plati = 0;
  for (const i of inscrieri) {
    const v = i.verificare;
    if (v && v.stare === "verificat") verificate++;
    else if (v && v.stare === "lamurit") lamurit++;
    if (v && v.plataConfirmata === true) plati++;
  }
  return {
    total: inscrieri.length, verificate, lamurit,
    neatinse: inscrieri.length - verificate - lamurit,
    platiConfirmate: plati,
  };
}

/** Cine cere: registratură sau administrator. Nimeni altcineva. */
async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin", nume: "Administrator" };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", nume: r.nume || "Registratură" };
  return null;
}

/**
 * Auditul unei expoziții: cine, când și ce a hotărât.
 *
 * Marcajul de pe fișă spune doar starea de ACUM. Jurnalul spune și cum s-a ajuns la ea —
 * inclusiv când cineva s-a răzgândit. Pentru doi registratori care lucrează la aceeași
 * listă, a doua parte contează la fel de mult ca prima.
 *
 * Citim direct cheile jurnalului: o expoziție se întinde peste una-două luni, iar
 * cititorul obișnuit lucrează pe o singură lună.
 */
async function auditDin(showId) {
  const s = registru();
  const acte = [];
  try {
    const { blobs } = await s.list({ prefix: "jurnal/" });
    blobs.sort((a, b) => b.key.localeCompare(a.key));   // cheia începe cu marca de timp
    for (const b of blobs.slice(0, 1000)) {
      const x = await s.get(b.key, { type: "json" }).catch(() => null);
      if (!x || x.fapta !== "inscriere-verificata") continue;
      if (!String(x.detalii || "").startsWith(showId)) continue;
      acte.push({
        la: x.la,
        cine: (x.actor && x.actor.nume) || "—",
        obiect: x.obiect || "",
        // Primul câmp din detalii e id-ul expoziției; el nu-l interesează pe cititor.
        ce: String(x.detalii || "").split(" · ").slice(1).join(" · "),
      });
    }
  } catch (err) {
    console.error("Citirea auditului a eșuat:", err);
  }
  return acte;
}

/** Câte fișe stau, ACUM, în spatele fiecărui registrator. */
export function peRegistrator(inscrieri) {
  const m = new Map();
  for (const i of inscrieri) {
    const v = i.verificare;
    if (!v || !v.cine) continue;
    const r = m.get(v.cine) || { cine: v.cine, verificate: 0, lamurit: 0, plati: 0 };
    if (v.stare === "verificat") r.verificate++;
    else if (v.stare === "lamurit") r.lamurit++;
    if (v.plataConfirmata === true) r.plati++;
    m.set(v.cine, r);
  }
  return [...m.values()].sort((a, b) => a.cine.localeCompare(b.cine, "ro"));
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

    // Plata se marchează separat de acte: sunt două verificări diferite, iar una poate
    // exista fără cealaltă. Ce nu se trimite acum rămâne cum era.
    const vechi = i.verificare || {};
    const plata = typeof body.plataConfirmata === "boolean"
      ? body.plataConfirmata
      : (typeof vechi.plataConfirmata === "boolean" ? vechi.plataConfirmata : null);

    const verificare = (stare || plata !== null)
      ? {
          stare: stare || vechi.stare || null,
          nota: body.nota !== undefined ? (taie(body.nota, LIMITA_NOTA) || null) : (vechi.nota ?? null),
          // `null` = nu s-a pronunțat; true/false = a confirmat sau a infirmat.
          membruConfirmat: typeof body.membruConfirmat === "boolean"
            ? body.membruConfirmat
            : (typeof vechi.membruConfirmat === "boolean" ? vechi.membruConfirmat : null),
          plataConfirmata: plata,
          cine: eu.nume,
          cand: new Date().toISOString(),
        }
      : null;   // nimic de reținut = marcajul se șterge

    await s.setJSON(cheie, { ...i, verificare });

    // Urma faptei, în jurnalul registrului: cine, când, la ce exemplar și ce a hotărât.
    // Din ea se face auditul din spațiul registraturii — marcajul de pe fișă spune doar
    // starea de acum, jurnalul spune și cum s-a ajuns la ea.
    await jurnalizeaza(registru(), {
      fapta: "inscriere-verificata",
      actor: { rol: eu.rol, nume: eu.nume },
      obiect: (i.numeCaine || "exemplar") + " · " + (i.rasaNumeRo || ""),
      detalii: [
        cheie.split("/")[1] || "",
        verificare ? (verificare.stare === "verificat" ? "acte verificate"
          : verificare.stare === "lamurit" ? "acte de lămurit" : "acte neatinse") : "marcaj șters",
        verificare && verificare.membruConfirmat === true ? "membru confirmat" : "",
        verificare && verificare.membruConfirmat === false ? "NU e membru" : "",
        verificare && verificare.plataConfirmata === true ? "plată confirmată" : "",
        verificare && verificare.plataConfirmata === false ? "plată neconfirmată" : "",
        verificare && verificare.nota ? verificare.nota : "",
      ].filter(Boolean).join(" · "),
      ip: ipCerere(req),
    });
    return json({ ok: true, verificare });
  }

  // —— Auditul expoziției ——
  if (actiune === "audit") {
    const showId = taie(body.showId, 60);
    if (!showId) return json({ eroare: "Expoziție lipsă." }, 400);
    const brute = (await inscrieriDin(showId)).map((x) => x.i);
    return json({
      acte: await auditDin(showId),
      registratori: peRegistrator(brute),
      ...rezumat(brute),
    });
  }

  // —— Dovada plății, cerută bucată cu bucată ——
  // Nu o cărăm în fiecare listare: sunt poze de telefon. Se cere doar când registratorul
  // chiar o deschide. După ce managerul importă înscrierea, copia din cloud se șterge —
  // de aceea răspunsul spune limpede când fișierul nu mai există.
  if (actiune === "dovada") {
    const cheie = taie(body.cheie, 200);
    if (!cheie.startsWith("coada/")) return json({ eroare: "Cheie invalidă." }, 400);
    const s = expo();
    const i = await s.get(cheie, { type: "json" }).catch(() => null);
    if (!i) return json({ eroare: "Înscrierea nu mai există." }, 404);
    if (!i.dovadaKey) return json({ eroare: "Nu s-a atașat nicio dovadă a plății." }, 404);
    const r = await s.getWithMetadata(i.dovadaKey, { type: "arrayBuffer" }).catch(() => null);
    if (!r || !r.data) {
      return json({ eroare: "Dovada a fost deja preluată în manager și ștearsă din cloud." }, 404);
    }
    return json({
      base64: Buffer.from(r.data).toString("base64"),
      tip: (r.metadata && r.metadata.tip) || "application/octet-stream",
      nume: (r.metadata && r.metadata.nume) || "dovada",
    });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
