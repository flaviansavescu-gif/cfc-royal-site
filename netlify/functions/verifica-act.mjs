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

const SECRET = process.env.EXPO_SYNC_SECRET || "cfcr-verificare-dev";
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
  if (!okSig) return json({ valid: false, motiv: "Semnătură invalidă — acest certificat nu poate fi confirmat ca autentic." });

  let p;
  try { p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { return json({ valid: false, motiv: "Cod de verificare corupt." }); }

  const act = { serie: p.s || "", titlu: p.t || "", caine: p.n || "", rasa: p.r || "", expozitie: p.e || "", data: p.d || "" };

  // Semnătura e bună, dar actul poate fi între timp invalidat de delegatul WDF.
  const revocate = await citesteRevocari(store);
  if (act.serie && revocate.includes(act.serie)) {
    return json({
      valid: false,
      anulat: true,
      motiv: `Actul ${act.serie} a fost ANULAT de delegatul World Dog Federation. Certificatul nu mai este valabil.`,
      act,
    });
  }

  return json({ valid: true, act });
};
