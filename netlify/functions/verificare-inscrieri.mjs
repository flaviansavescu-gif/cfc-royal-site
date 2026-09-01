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
// „de lămurit") și plata („plata confirmată"). Una poate exista fără cealaltă — un dosar
// poate avea actele în regulă și banii neintrați, sau invers.
//
// UNDE STĂ MARCAJUL: în blob PROPRIU, `verificare/<showId>/<sufix>`, nu în interiorul
// înscrierii. Altfel doi scriitori — registratura, care pune marcajul, și managerul, care
// pune semnul „importat" — ar rescrie aceeași fișă și s-ar putea pierde unul pe altul.
// Cheia oglindește exact sufixul înscrierii din coadă, deci împerecherea e directă.
//
// VERIFICAREA NU BLOCHEAZĂ NIMIC. Dacă registratura n-a apucat să se uite, importul merge
// mai departe și fișa rămâne doar nemarcată. Altfel, o zi aglomerată a președintelui ar
// putea opri o expoziție.
//
// POST { cod, dispozitiv, actiune:"expozitii" }                 -> expozițiile cu înscrieri
// POST { cod, dispozitiv, actiune:"inscrieri", showId }         -> înscrierile, filtrate
// POST { cod, dispozitiv, actiune:"marcheaza", cheie, stare?, nota?, membruConfirmat?,
//                                              plataConfirmata?, sterge? }
// POST { cod, dispozitiv, actiune:"dovada", cheie }             -> dovada plății (base64)
// POST { cod, dispozitiv, actiune:"audit", showId }             -> cine ce a verificat
// =========================================================================
import { getStore } from "@netlify/blobs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { registratorDinCod } from "./registru-acces.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeaza, jurnalizeazaObligatoriu, ipCerere } from "./_comun/registru-jurnal.mjs";
import { json } from "./_comun/raspuns.mjs";
import { stergeDovezileIncheiate } from "./_comun/dovada-plata.mjs";

// Înscrierile stau în magazia expozițiilor; cheile de dispozitiv, în cea a registrului.
// Nu le amesteca: o căutare de jeton în magazia greșită a ținut deja pe cineva afară.
const expo = () => getStore({ name: "expozitii", consistency: "strong" });
const registru = () => getStore({ name: "registru", consistency: "strong" });

const taie = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

export const STARI = ["verificat", "lamurit"];
export const LIMITA_NOTA = 300;

/** Tipurile acceptate ca dovadă — aceleași ca la încărcare. Verificate ȘI la ieșire:
 *  metadatele unei magazii nu sunt o sursă de încredere pentru browser. */
export const TIPURI_DOVADA = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** `coada/<show>/<sufix>` -> `verificare/<show>/<sufix>`. Cheia marcajului oglindește
 *  exact înscrierea, deci nu e nevoie de niciun index ca să le împerechem. */
export function cheiaMarcajului(cheieCoada) {
  return "verificare/" + String(cheieCoada || "").slice("coada/".length);
}

/**
 * Ce pleacă spre browserul registratorului. Lista albă, nu neagră: dacă mâine apare un
 * câmp nou în înscriere, el NU ajunge aici din greșeală.
 */
export function pentruRegistratura(i, cheie, verificare) {
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
    verificare: verificare || null,
  };
}

/** Rezumatul unei expoziții pentru lista din capul paginii. */
export function rezumat(marcaje) {
  let verificate = 0, lamurit = 0, plati = 0, total = 0;
  for (const v of marcaje) {
    total++;
    if (!v) continue;
    if (v.stare === "verificat") verificate++;
    else if (v.stare === "lamurit") lamurit++;
    if (v.plataConfirmata === true) plati++;
  }
  return {
    total, verificate, lamurit,
    neatinse: total - verificate - lamurit,
    platiConfirmate: plati,
  };
}

/** Câte fișe stau, ACUM, în spatele fiecărui registrator. */
export function peRegistrator(marcaje) {
  const m = new Map();
  for (const v of marcaje) {
    if (!v || !v.cine) continue;
    const r = m.get(v.cine) || { cine: v.cine, verificate: 0, lamurit: 0, plati: 0 };
    if (v.stare === "verificat") r.verificate++;
    else if (v.stare === "lamurit") r.lamurit++;
    if (v.plataConfirmata === true) r.plati++;
    m.set(v.cine, r);
  }
  return [...m.values()].sort((a, b) => a.cine.localeCompare(b.cine, "ro"));
}

/** Cine cere: registratură sau administrator. Nimeni altcineva. */
async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin", nume: "Administrator" };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", nume: r.nume || "Registratură" };
  return null;
}

/** Înscrierile unei expoziții, fiecare cu marcajul ei (dacă are). */
async function inscrieriDin(showId) {
  const s = expo();
  const rezultat = [];
  const { blobs } = await s.list({ prefix: "coada/" + showId + "/" });
  for (const b of blobs) {
    const i = await s.get(b.key, { type: "json" }).catch(() => null);
    if (!i) continue;
    const v = await s.get(cheiaMarcajului(b.key), { type: "json" }).catch(() => null);
    rezultat.push({ cheie: b.key, i, v });
  }
  rezultat.sort((a, b) => String(a.i.creat || "").localeCompare(String(b.i.creat || "")));
  return rezultat;
}

/** Doar marcajele, fără fișele înscrierilor — pentru rezumate și audit. */
async function marcajeDin(showId) {
  const s = expo();
  const { blobs } = await s.list({ prefix: "coada/" + showId + "/" });
  const marcaje = [];
  for (const b of blobs) {
    marcaje.push(await s.get(cheiaMarcajului(b.key), { type: "json" }).catch(() => null));
  }
  return marcaje;
}

/**
 * Auditul unei expoziții: cine, când și ce a hotărât.
 *
 * Marcajul de pe fișă spune doar starea de ACUM. Aici stă și cum s-a ajuns la ea, inclusiv
 * când cineva s-a răzgândit. Faptele se scriu sub `audit/<showId>/`, deci se citesc exact
 * cele ale expoziției cerute — nu tot jurnalul asociației, filtrat pe urmă.
 */
async function auditDin(showId) {
  const s = expo();
  const acte = [];
  try {
    const { blobs } = await s.list({ prefix: "audit/" + showId + "/" });
    blobs.sort((a, b) => b.key.localeCompare(a.key));   // cheia începe cu marca de timp
    for (const b of blobs.slice(0, 400)) {
      const x = await s.get(b.key, { type: "json" }).catch(() => null);
      if (x) acte.push(x);
    }
  } catch (err) {
    console.error("Citirea auditului a eșuat:", err);
  }
  return acte;
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
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403, { antete: { "x-refuz-drept": "1" } });
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
        // Și o expoziție FĂRĂ înscrieri se arată: registratura trebuie să vadă că
        // expoziția există și că pur și simplu n-a intrat încă nimic — altfel, după
        // o curățenie sau înaintea primei înscrieri, meniul ar fi gol și ar părea
        // stricat. Numărătorile ies pe zero de la sine.
        const marcaje = await marcajeDin(c.showId);
        expozitii.push({
          showId: c.showId, nume: c.nume, data: c.data, locatie: c.locatie || "",
          termen: c.termen || null, ...rezumat(marcaje),
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
      return json({ inscrieri: brute.map((x) => pentruRegistratura(x.i, x.cheie, x.v)) });
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
    const i = await s.get(cheie, { type: "json" }).catch(() => null);
    if (!i) return json({ eroare: "Înscrierea nu mai există." }, 404);

    const cheieV = cheiaMarcajului(cheie);
    const vechi = (await s.get(cheieV, { type: "json" }).catch(() => null)) || {};

    // „Șterge marcajul" înseamnă TOT marcajul — și actele, și plata. Un buton care lasă
    // ceva în urmă e un buton care minte.
    const sterge = body.sterge === true;

    const plata = typeof body.plataConfirmata === "boolean"
      ? body.plataConfirmata
      : (typeof vechi.plataConfirmata === "boolean" ? vechi.plataConfirmata : null);

    // Marcajul există dacă s-a hotărât ceva despre acte SAU despre plată. Cele două sunt
    // independente: se poate confirma plata fără a atinge actele, iar atunci `stare`
    // rămâne null — un marcaj perfect valid, pe care managerul trebuie să-l primească.
    const stareFinala = stare || vechi.stare || null;
    const verificare = (!sterge && (stareFinala || plata !== null))
      ? {
          stare: stareFinala,
          nota: body.nota !== undefined ? (taie(body.nota, LIMITA_NOTA) || null) : (vechi.nota ?? null),
          // `null` = nu s-a pronunțat; true/false = a confirmat sau a infirmat.
          membruConfirmat: typeof body.membruConfirmat === "boolean"
            ? body.membruConfirmat
            : (typeof vechi.membruConfirmat === "boolean" ? vechi.membruConfirmat : null),
          plataConfirmata: plata,
          cine: eu.nume,
          cand: new Date().toISOString(),
        }
      : null;

    // Urma faptei se scrie ÎNAINTE de a atinge marcajul. Ștergerea marcajului e
    // DISTRUCTIVĂ (poate șterge un „plată confirmată"): la ea, dacă jurnalul nu se poate
    // scrie, nu ștergem nimic (503). La scrierea unui marcaj (aditivă) rămâne nefatal.
    const la = new Date().toISOString();
    const ce = [
      verificare
        ? (verificare.stare === "verificat" ? "acte verificate"
          : verificare.stare === "lamurit" ? "acte de lămurit" : "actele neatinse")
        : "marcaj șters",
      verificare && verificare.membruConfirmat === true ? "membru confirmat" : "",
      verificare && verificare.membruConfirmat === false ? "NU e membru" : "",
      verificare && verificare.plataConfirmata === true ? "plată confirmată" : "",
      verificare && verificare.plataConfirmata === false ? "plata nu se regăsește" : "",
      verificare && verificare.nota ? verificare.nota : "",
    ].filter(Boolean).join(" · ");
    const obiect = (i.numeCaine || "exemplar") + (i.rasaNumeRo ? " · " + i.rasaNumeRo : "");
    const showId = cheie.split("/")[1] || "";

    const intrareJurnal = {
      fapta: "inscriere-verificata",
      actor: { rol: eu.rol, nume: eu.nume },
      obiect,
      detalii: showId + " · " + ce,
      ip: ipCerere(req),
    };
    if (!verificare) {
      // Ștergere: urma întâi, altfel un „plată confirmată" ar dispărea fără martor.
      try {
        await jurnalizeazaObligatoriu(registru(), intrareJurnal);
      } catch (err) {
        console.error("Jurnalul ștergerii marcajului a eșuat — nu am șters nimic:", err);
        return json({ eroare: "Nu am putut consemna fapta în jurnal, deci nu am șters marcajul. Reîncearcă." }, 503);
      }
    }

    // Marcajul are blobul lui: scrierea asta nu atinge fișa înscrierii, deci nu se poate
    // ciocni cu managerul, care pune pe ea semnul „importat".
    if (verificare) await s.setJSON(cheieV, verificare);
    else await s.delete(cheieV).catch(() => {});

    // Al doilea declanșator al curățeniei de dovezi (primul e importul): registratura
    // tocmai a încheiat verificarea unei fișe DEJA importate — dacă toți câinii care
    // împart dovada au încheiat-o și ei, dovada nu mai are ce căuta în cloud. Nefatal.
    if (verificare && verificare.stare === "verificat" && i.importat === true && i.dovadaKey) {
      try {
        await stergeDovezileIncheiate(s, showId, [i.dovadaKey]);
      } catch (err) {
        console.error("Curățenia dovezii după verificare a eșuat:", err);
      }
    }

    // Auditul expoziției (citire rapidă) + jurnalul pentru marcajul aditiv (nefatal).
    try {
      await s.setJSON("audit/" + showId + "/" + la + "-" + Math.random().toString(36).slice(2, 8),
        { la, cine: eu.nume, obiect, ce });
    } catch (err) {
      console.error("Fapta nu s-a putut scrie în auditul expoziției:", err);
    }
    if (verificare) await jurnalizeaza(registru(), intrareJurnal);

    return json({ ok: true, verificare });
  }

  // —— Auditul expoziției ——
  if (actiune === "audit") {
    const showId = taie(body.showId, 60);
    if (!showId) return json({ eroare: "Expoziție lipsă." }, 400);
    const marcaje = await marcajeDin(showId);
    return json({
      acte: await auditDin(showId),
      registratori: peRegistrator(marcaje),
      ...rezumat(marcaje),
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
    // Tipul se verifică ȘI la ieșire. La încărcare e restrâns, dar browserul n-are voie
    // să se încreadă în metadatele unei magazii: ce nu e imagine sau PDF nu se deschide.
    const tip = (r.metadata && r.metadata.tip) || "";
    if (!TIPURI_DOVADA.has(tip)) {
      return json({ eroare: "Dovada are un tip de fișier neacceptat și nu se poate deschide." }, 415);
    }
    return json({
      base64: Buffer.from(r.data).toString("base64"),
      tip,
      nume: (r.metadata && r.metadata.nume) || "dovada",
    });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
