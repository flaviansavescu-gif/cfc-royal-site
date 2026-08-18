// _comun/porti-crestere.mjs — porțile de creștere la depunerea DMF (Art. 22 din
// Regulamentul de creștere și sănătate, Hot. 181/13-08-2026).
//
// Regulamentul cere ca registratura să verifice, la primirea declarației: vârstele
// părinților la montă, odihna femelei, cezarienele, rudenia părinților. Până acum
// verificarea se făcea cu ochiul; de aici încolo o face și programul, la depunere,
// ca dosarul care nu poate trece să fie oprit CU MOTIVUL SCRIS (Art. 22 alin. 2),
// nu după săptămâni, la validare.
//
// Modulul e PUR — primește datele deja culese (declarația, fătările anterioare ale
// femelei, ascendențele părinților, starea profilului ADN) și întoarce:
//   opriri  -> încalcă regulamentul, dosarul se respinge; fiecare poartă articolul
//   semnale -> nu opresc depunerea, dar rămân scrise pe dosar pentru registratură
//              (avizul veterinar la femela de 8–9 ani, ADN-ul masculului tânăr,
//               motivul de selecție la rudele de gradul II)
//
// APLICAREA ÎN TIMP (Art. 27): porțile judecă DOAR montele făcute după intrarea în
// vigoare. Un cuib dintr-o montă mai veche se înregistrează după regulile de atunci —
// nimeni nu e prins retroactiv de o regulă care nu exista la data montei.
//
// Poarta de rudenie se bizuie pe CE E ÎN REGISTRU: dacă părinții nu au fișă la noi
// (câini din alte registre), programul nu are de unde ști rudenia — atunci tace, iar
// verificarea rămâne a registraturii, ca până acum. Porțile ajută; nu înlocuiesc omul.

/** Ziua intrării în vigoare a Regulamentului de creștere și sănătate (Art. 29). */
export const START_PORTI = "2026-08-13";

// Pragurile din regulament. Proba automată scripts/regulament-sanatate.test.mjs ține
// textul publicat lipit de nomenclatorul testelor; perechea de aici e verificată de
// netlify/functions/_comun/porti-crestere.test.mjs pe aceleași valori.
export const PRAG = {
  FEMELA_MIN_LUNI: 18,       // Art. 6 (1)
  FEMELA_MAX_LUNI: 96,       // Art. 6 (2) — 8 ani
  FEMELA_EXCEPTIE_LUNI: 108, // Art. 6 (3) — o montă între 8 și 9 ani, cu aviz veterinar
  MASCUL_MIN_LUNI: 12,       // Art. 7 (1)
  MASCUL_ADN_LUNI: 15,       // Art. 7 (2) — sub 15 luni cere profil ADN depus
  ODIHNA_LUNI: 10,           // Art. 8 (1)
  MAX_CUIBURI: 3,            // Art. 8 (2) — în 24 de luni
  FEREASTRA_CUIBURI_LUNI: 24,
  MAX_CEZARIENE: 2,          // Art. 9 (1)
};

/**
 * Luni calendaristice ÎMPLINITE între două date ISO (AAAA-LL-ZZ), a <= b.
 * „Împlinite" ca la vârstă: de la 15 ianuarie la 14 martie e o lună, nu două.
 */
export function luniIntre(a, b) {
  const [ay, am, az] = String(a).split("-").map(Number);
  const [by, bm, bz] = String(b).split("-").map(Number);
  if (![ay, am, az, by, bm, bz].every(Number.isFinite)) return null;
  let luni = (by - ay) * 12 + (bm - am);
  if (bz < az) luni--;
  return luni;
}

/**
 * Numărul de pedigree, adus la o formă comparabilă: MAJUSCULE, fără spații și liniuțe.
 * Sub 4 semne nu se compară deloc — un rest ca „RO" sau „12" ar lega câini străini.
 */
export function nrComparabil(nr) {
  const n = String(nr == null ? "" : nr).toUpperCase().replace(/[\s\-./]/g, "");
  return n.length >= 4 ? n : "";
}

/**
 * Rudenia dintre părinți, CÂT SE POATE VEDEA din registru.
 *
 * Identitatea se compară prin numărul de pedigree (nrComparabil); numele nu se
 * folosește — se repetă între canise. Ascendențele sunt cele din fișele registrului
 * (poziții T, M, TT…, fiecare { nume, nr }); pot lipsi cu totul.
 *
 * @returns {null | { grad: 1|2, descriere: string }}
 */
export function rudenieParinti({ masculNr, femelaNr, ascMascul, ascFemela }) {
  const m = nrComparabil(masculNr);
  const f = nrComparabil(femelaNr);
  const poz = (asc, cod) => nrComparabil(asc?.[cod]?.nr);

  // Gradul întâi (Art. 11) — împerecheri oprite.
  if (m && poz(ascFemela, "T") === m) return { grad: 1, descriere: "masculul este tatăl femelei" };
  if (f && poz(ascMascul, "M") === f) return { grad: 1, descriere: "femela este mama masculului" };
  const tM = poz(ascMascul, "T"), mM = poz(ascMascul, "M");
  const tF = poz(ascFemela, "T"), mF = poz(ascFemela, "M");
  if (tM && mM && tM === tF && mM === mF)
    return { grad: 1, descriere: "frate și soră cu ambii părinți comuni" };

  // Gradul al doilea (Art. 12) — îngăduite, cu motivul de selecție scris în declarație.
  if ((tM && tM === tF) || (mM && mM === mF)) {
    return { grad: 2, descriere: "frați cu un singur părinte comun" };
  }
  const buniciFemela = ["TT", "TM", "MT", "MM"].map((c) => poz(ascFemela, c));
  if (m && buniciFemela.includes(m)) return { grad: 2, descriere: "masculul este bunicul femelei" };
  const buniciMascul = ["TT", "TM", "MT", "MM"].map((c) => poz(ascMascul, c));
  if (f && buniciMascul.includes(f)) return { grad: 2, descriere: "femela este bunica masculului" };

  return null;
}

/**
 * Porțile de creștere. Primește tot ce s-a cules; nu citește nimic singură.
 *
 * @param {object} p
 * @param {string}  p.dataMontei / p.dataFatarii    din declarație
 * @param {object}  p.mascul / p.femela             { dataNasterii, pedigree }
 * @param {boolean|null} p.fatareCezariana          declarat de crescător (Art. 9 alin. 2)
 * @param {string}  p.motivSelectie                 completat doar la rude de gradul II
 * @param {Array}   p.fatariAnterioare              fătările NEREspinse ale femelei:
 *                                                  [{ serie, dataFatarii, cezariana }]
 * @param {object|null} p.ascMascul / p.ascFemela   ascendențele din fișele registrului
 * @param {boolean} p.adnMasculVerificat            profil ADN verificat la sănătate
 * @returns {{ opriri: Array<{articol, motiv}>, semnale: Array<{articol, motiv}> }}
 */
export function portiCrestere(p) {
  const opriri = [], semnale = [];
  const opreste = (articol, motiv) => opriri.push({ articol, motiv });
  const semnal = (articol, motiv) => semnale.push({ articol, motiv });

  // Art. 27 — montele dinaintea regulamentului nu se judecă. Comparația de șiruri e
  // sigură pe date ISO. O dată lipsă sau strâmbă nu trece de valideazaDeclaratia.
  if (!p.dataMontei || p.dataMontei < START_PORTI) return { opriri, semnale };

  // ——— Art. 6: vârsta femelei la data montei ———
  const vF = luniIntre(p.femela?.dataNasterii, p.dataMontei);
  if (vF !== null) {
    if (vF < PRAG.FEMELA_MIN_LUNI)
      opreste("Art. 6 alin. (1)", `la data montei femela avea ${vF} luni — sub pragul de 18 luni`);
    else if (vF >= PRAG.FEMELA_EXCEPTIE_LUNI)
      opreste("Art. 6 alin. (2)", "la data montei femela împlinise 9 ani — peste vârsta îngăduită, inclusiv prin excepție");
    else if (vF >= PRAG.FEMELA_MAX_LUNI)
      semnal("Art. 6 alin. (3)", "femela avea între 8 și 9 ani la montă — excepția cere avizul scris al medicului veterinar, comunicat registraturii ÎNAINTE de montă; cereți-l la dosar");
  }

  // ——— Art. 7: vârsta masculului la data montei ———
  const vM = luniIntre(p.mascul?.dataNasterii, p.dataMontei);
  if (vM !== null) {
    if (vM < PRAG.MASCUL_MIN_LUNI)
      opreste("Art. 7 alin. (1)", `la data montei masculul avea ${vM} luni — sub pragul de 12 luni`);
    else if (vM < PRAG.MASCUL_ADN_LUNI && !p.adnMasculVerificat)
      semnal("Art. 7 alin. (2)", "mascul sub 15 luni la montă, fără profil ADN verificat în registrul de sănătate — nu validați dosarul înainte de depunerea profilului");
  }

  // ——— Art. 8: odihna femelei ———
  const anterioare = Array.isArray(p.fatariAnterioare) ? p.fatariAnterioare : [];
  for (const f of anterioare) {
    if (!f?.dataFatarii || f.dataFatarii > p.dataFatarii) continue; // doar cele dinainte
    const odihna = luniIntre(f.dataFatarii, p.dataFatarii);
    if (odihna === 0 && f.dataFatarii === p.dataFatarii) {
      opreste("Art. 8", `femela are deja dosarul ${f.serie} cu fătare la aceeași dată — cuibul pare declarat de două ori`);
    } else if (odihna !== null && odihna < PRAG.ODIHNA_LUNI) {
      opreste("Art. 8 alin. (1)", `de la fătarea precedentă (dosar ${f.serie}, ${f.dataFatarii}) au trecut ${odihna} luni — sub odihna de 10 luni`);
    }
  }
  const inFereastra = anterioare.filter((f) => {
    if (!f?.dataFatarii || f.dataFatarii >= p.dataFatarii) return false;
    const luni = luniIntre(f.dataFatarii, p.dataFatarii);
    return luni !== null && luni < PRAG.FEREASTRA_CUIBURI_LUNI;
  });
  if (inFereastra.length >= PRAG.MAX_CUIBURI)
    opreste("Art. 8 alin. (2)", `femela are deja ${inFereastra.length} cuiburi în ultimele 24 de luni — al patrulea nu se poate înregistra`);

  // ——— Art. 9: cezarienele ———
  const cezariene = anterioare.filter((f) => f?.cezariana === true).length;
  if (cezariene >= PRAG.MAX_CEZARIENE)
    opreste("Art. 9 alin. (1)", `femela are deja ${cezariene} fătări prin operație cezariană — nu mai poate fi folosită la reproducție`);
  else if (p.fatareCezariana === true && cezariene === PRAG.MAX_CEZARIENE - 1)
    semnal("Art. 9 alin. (1)", "cu fătarea declarată acum, femela ajunge la a doua cezariană — de aici înainte iese din reproducție");

  // ——— Art. 11 și Art. 12: rudenia părinților ———
  const r = rudenieParinti({
    masculNr: p.mascul?.pedigree, femelaNr: p.femela?.pedigree,
    ascMascul: p.ascMascul, ascFemela: p.ascFemela,
  });
  if (r?.grad === 1) {
    opreste("Art. 11", `părinții sunt rude de gradul întâi (${r.descriere}) — împerecherea este oprită, iar puii nu primesc certificate`);
  } else if (r?.grad === 2) {
    const motiv = String(p.motivSelectie || "").trim();
    if (motiv.length < 10)
      opreste("Art. 12", `părinții sunt rude de gradul al doilea (${r.descriere}) — scrieți în declarație motivul de selecție, altfel cuibul nu se poate înregistra`);
    else
      semnal("Art. 12", `rude de gradul al doilea (${r.descriere}); motivul de selecție e consemnat la dosar și NU se publică`);
  }

  return { opriri, semnale };
}

/** Mesajul de respingere: motivele, cu articolul lor, pe limba omului (Art. 22 alin. 2). */
export function mesajOpriri(opriri) {
  const randuri = opriri.map((o) => `${o.motiv} (${o.articol} din Regulamentul de creștere și sănătate)`);
  return "Declarația nu se poate depune: " + randuri.join("; ") +
    ". Dacă socotiți că e o greșeală, cereți reexaminarea la Consiliul Director (Art. 22 alin. 3).";
}
