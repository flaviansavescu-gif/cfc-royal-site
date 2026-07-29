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
import { getStore } from "@netlify/blobs";
import { felActului, etichetaCod, textStare, notaValid, motivAnulare } from "./_comun/verificare-text.mjs";

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
const SECRET = process.env.EXPO_SYNC_SECRET || "";
const CHEIE = "lista";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/** Lista actelor anulate, publicată de manager. Dacă lipsește, verificarea merge mai departe. */
async function citesteRevocari(store) {
  try {
    const v = await store.get(CHEIE, { type: "json" });
    return Array.isArray(v?.serii) ? v.serii : [];
  } catch {
    return [];
  }
}

export default async (req) => {
  // Fără secret nu se poate verifica nimic — și NU inventăm un răspuns. Un „certificat
  // neconfirmat" ar arunca vina pe hârtia omului; 503 spune adevărul: serviciul e
  // indisponibil, nu actul e fals.
  if (!SECRET) {
    console.error("VERIFICAREA ACTELOR E OPRITĂ: lipsește EXPO_SYNC_SECRET din mediu.");
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
    if (!SECRET || body.secret !== SECRET) return json({ eroare: "Secret invalid." }, 401);
    if (body.actiune !== "revocari") return json({ eroare: "Acțiune necunoscută." }, 400);

    const serii = Array.isArray(body.serii) ? body.serii.filter((s) => typeof s === "string") : [];
    await store.setJSON(CHEIE, { serii, actualizatLa: new Date().toISOString() });
    return json({ ok: true, numar: serii.length });
  }

  // ——— Verificarea publică a unui certificat ———
  const c = new URL(req.url).searchParams.get("c") || "";
  const [payload, sig] = c.split(".");
  if (!payload || !sig) return json({ valid: false, motiv: "Cod de verificare incomplet." });

  const asteptat = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 24);
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
  };

  // Semnătura e bună, dar actul poate fi între timp invalidat de delegatul WDF.
  const revocate = await citesteRevocari(store);
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
