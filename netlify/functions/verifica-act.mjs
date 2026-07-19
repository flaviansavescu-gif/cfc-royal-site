// verifica-act.mjs — verifică autenticitatea unui certificat CFC-Royal după codul din QR.
// Certificatul e „auto-verificabil": codul conține datele + o semnătură HMAC făcută de
// managerul de expoziții cu secretul partajat (EXPO_SYNC_SECRET). Aici recalculăm
// semnătura; dacă se potrivește, certificatul e autentic. Fără bază de date.
//
// GET /.netlify/functions/verifica-act?c=<payload>.<semnatura>
//   -> { valid:true, act:{ serie, titlu, caine, rasa, expozitie, data } }
//   -> { valid:false, motiv:"..." }
import crypto from "node:crypto";

const SECRET = process.env.EXPO_SYNC_SECRET || "cfcr-verificare-dev";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export default async (req) => {
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

  return json({
    valid: true,
    act: { serie: p.s || "", titlu: p.t || "", caine: p.n || "", rasa: p.r || "", expozitie: p.e || "", data: p.d || "" },
  });
};
