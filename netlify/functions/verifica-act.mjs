// verifica-act.mjs — verifică autenticitatea unui certificat CFC-Royal după codul din QR.
//
// Certificatul e „auto-verificabil": codul conține datele + o semnătură HMAC făcută de
// managerul de expoziții cu secretul partajat (EXPO_SYNC_SECRET). Aici recalculăm
// semnătura; dacă se potrivește, certificatul e autentic.
//
// Semnătura singură nu e însă suficientă: delegatul WDF poate INVALIDA un act deja
// emis, iar hârtia rămâne în mâna expozantului cu semnătura ei validă. De aceea
// verificăm seria și într-o listă de revocare, publicată de manager.
//
// GET  /.netlify/functions/verifica-act?c=<payload>.<semnatura>
//   -> { valid:true,  act:{ serie, titlu, caine, rasa, expozitie, data } }
//   -> { valid:false, motiv:"...", anulat?:true }
// POST { secret, actiune:"revocari", serii:["003/01.11.2026", ...] }
//   -> managerul publică lista completă a actelor anulate (o înlocuiește pe cea veche)
import crypto from "node:crypto";
import { secretEgal } from "./_comun/secret.mjs";
import { getStore } from "@netlify/blobs";
import { felActului, etichetaCod, textStare, notaValid, motivAnulare } from "./_comun/verificare-text.mjs";
import { json } from "./_comun/raspuns.mjs";

// FĂRĂ valoare de rezervă, deliberat.
//
// Aici s-a aflat până acum `|| "cfcr-verificare-dev"`. Un secret de rezervă scris în cod
// pare inofensiv — până în ziua în care variabila lipsește din mediu (deploy nou, ștearsă
// din greșeală, altă previzualizare). Atunci semnăturile se calculează cu o valoare pe
// care o cunoaște oricine vede codul, iar oricine poate fabrica un cod QR care se
// validează drept „certificat autentic". Adică exact minciuna împotriva căreia există
// verificarea.
//
// Mai bine o verificare care spune cinstit că nu poate funcționa decât una care minte.
// Puntea (secretul care lasă managerul să scrie pe site) și SEMNĂTURA ACTELOR au acum
// chei DIFERITE. Cu o singură cheie, o scurgere a punții însemna și fabricarea de
// certificate „autentice"; despărțite, o scurgere n-o mai atinge pe cealaltă.
// Trecere lină: cât timp VERIFICARE_SECRET nu e pusă, se folosește vechea cheie, deci
// codurile deja tipărite se verifică mai departe. Managerul face exact la fel.
// .trim(), ca în Manager: o variabilă lipită cu un spațiu la coadă ar despărți în
// tăcere semnarea de verificare.
const SECRET = String(process.env.EXPO_SYNC_SECRET || "").trim();                 // puntea
const SECRET_ACTE = String(process.env.VERIFICARE_SECRET || "").trim() || SECRET; // semnătura actelor
const CHEIE = "lista";

/**
 * Lista actelor anulate, publicată de manager.
 *
 * FAIL-CLOSED. Până azi, orice eroare la citire întorcea o listă GOALĂ — adică „niciun
 * act nu e anulat". Consecința: un sughiț al magaziei transforma un certificat RETRAS
 * într-unul confirmat public drept autentic, exact în clipa în care cineva îl verifică.
 * Tăcerea unei magazii nu are voie să repună în vigoare un act pe care delegatul WDF l-a
 * anulat.
 *
 * De acum deosebim trei stări: lista citită (`serii`), lista care nu s-a publicat
 * niciodată (`serii: []`, e în regulă — nu s-a anulat nimic încă) și EROAREA (`null`),
 * la care verificarea răspunde cinstit că nu poate confirma acum.
 *
 * @returns {Promise<string[]|null>} seriile anulate, sau `null` dacă lista nu s-a putut citi
 */
async function citesteRevocari(store) {
  try {
    // Două liste, două stăpâniri: „lista" e a Managerului (o ÎNLOCUIEȘTE integral la
    // fiecare publicare), „lista-scoala" e a actelor Școlii (scrisă de acte-scoala.mjs).
    // Ținute pe aceeași cheie, prima publicare din Manager ștergea revocările Școlii.
    const [v, scoala] = await Promise.all([
      store.get(CHEIE, { type: "json" }),
      store.get("lista-scoala", { type: "json" }),
    ]);
    return [
      ...(Array.isArray(v?.serii) ? v.serii : []),
      ...(Array.isArray(scoala?.serii) ? scoala.serii : []),
    ];
  } catch (err) {
    console.error("Lista actelor anulate NU s-a putut citi:", err);
    return null;
  }
}

export default async (req) => {
  // Fără secret nu se poate verifica nimic — și NU inventăm un răspuns. Un „certificat
  // neconfirmat" ar arunca vina pe hârtia omului; 503 spune adevărul: serviciul e
  // indisponibil, nu actul e fals.
  if (!SECRET_ACTE) {
    console.error("VERIFICAREA ACTELOR E OPRITĂ: lipsesc și VERIFICARE_SECRET, și EXPO_SYNC_SECRET din mediu.");
    return json({
      eroare: "Verificarea certificatelor este momentan indisponibilă. Scrie la contact@cfc-royal.ro.",
    }, 503);
  }

  const store = getStore("acte-revocate");

  // ——— Managerul publică lista actelor anulate (protejat cu secret) ———
  if (req.method === "POST") {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return json({ eroare: "Corp invalid." }, 400);
    }
    if (!secretEgal(body.secret, SECRET)) return json({ eroare: "Secret invalid." }, 401);
    if (body.actiune !== "revocari") return json({ eroare: "Acțiune necunoscută." }, 400);

    const serii = Array.isArray(body.serii) ? body.serii.filter((s) => typeof s === "string") : [];
    await store.setJSON(CHEIE, { serii, actualizatLa: new Date().toISOString() });
    return json({ ok: true, numar: serii.length });
  }

  // ——— Verificarea publică a unui certificat ———
  const c = new URL(req.url).searchParams.get("c") || "";
  const [payload, sig] = c.split(".");
  if (!payload || !sig) return json({ valid: false, motiv: "Cod de verificare incomplet." });

  const asteptat = crypto.createHmac("sha256", SECRET_ACTE).update(payload).digest("hex").slice(0, 24);
  let okSig = false;
  try {
    okSig = sig.length === asteptat.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(asteptat));
  } catch { okSig = false; }
  if (!okSig) return json({ valid: false, motiv: "Semnătură invalidă — acest cod nu poate fi confirmat ca autentic." });

  let p;
  try { p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { return json({ valid: false, motiv: "Cod de verificare corupt." }); }

  // „fel" deosebește un certificat numerotat de un rezultat împărtășit. Codurile vechi
  // n-au câmpul și rămân certificate — ce e deja tipărit nu-și schimbă înțelesul.
  //
  // Pentru rezultate, „s" e codul prin care ele POT FI ANULATE (REZ/expoziție/nr. catalog).
  // Verificarea de mai jos e aceeași pentru amândouă felurile, tocmai fiindcă amândouă au
  // acum un nume propriu.
  const fel = felActului(p);
  const act = {
    fel,
    etichetaCod: etichetaCod(fel),
    serie: p.s || "",
    catalog: p.c || "",
    titlu: p.t || "", caine: p.n || "", rasa: p.r || "", expozitie: p.e || "", data: p.d || "",
    // Actele Școlii de Arbitraj (diplomă, legitimație) poartă un OM, nu un câine.
    titular: p.h || "",
    grupe: p.g || "",
  };

  // Semnătura e bună, dar actul poate fi între timp invalidat de delegatul WDF.
  const revocate = await citesteRevocari(store);
  if (revocate === null) {
    // Nu știm dacă actul e anulat. Un „valid" spus acum ar putea confirma un act retras,
    // deci nu-l spunem — la fel cum nu inventăm un răspuns când lipsește secretul.
    return json({
      valid: false,
      nedeterminat: true,
      stareText: "Nu putem confirma acum",
      motiv:
        "Registrul actelor anulate nu răspunde în acest moment, iar fără el nu putem spune " +
        "dacă actul mai e în vigoare. Semnătura codului este corectă. Încearcă din nou peste " +
        "câteva minute; dacă situația se repetă, scrie la contact@cfc-royal.ro.",
      act,
    }, 503);
  }
  if (act.serie && revocate.includes(act.serie)) {
    return json({
      valid: false,
      anulat: true,
      stareText: textStare(fel, "anulat"),
      motiv: motivAnulare(fel, act.serie),
      act,
    });
  }

  return json({ valid: true, act, stareText: textStare(fel, "valid"), nota: notaValid(fel) });
};
