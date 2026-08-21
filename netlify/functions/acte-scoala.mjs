// acte-scoala.mjs — actele Școlii de Arbitraj: diploma de absolvire și legitimația de arbitru.
//
// Ambele sunt „auto-verificabile", ca certificatele expozițiilor: actul poartă un cod QR
// cu datele + semnătura HMAC (aceeași cheie ca verifica-act.mjs), iar oricine îl scanează
// ajunge pe cfc-royal.ro/verifica/ și vede verdictul. Nu se poate fabrica o diplomă fără
// cheia din mediul Netlify.
//
// Regulile de emitere sunt cele ale Școlii:
//   diploma      -> DOAR cu examenul final promovat (absolvirea programului);
//   legitimatie  -> DOAR cu cel puțin o grupă WDF autorizată (arbitru certificat).
//
// Ce s-a semnat o dată RĂMÂNE: pachetul semnat se păstrează la emitere, iar tipărirea îl
// refolosește neschimbat — aceeași serie, același QR, oricâte exemplare. Reemiterea (de
// ex. legitimația după extinderea grupelor) primește o serie NOUĂ; exemplarul vechi rămâne
// cu semnătura lui validă, de aceea reemiterea se face doar când e cazul, iar la nevoie
// seria veche se poate trece în lista actelor anulate.
//
// Stocare (store "cursuri"):
//   acte-scoala/contor          -> { diploma: n, legitimatie: n }
//   act-scoala/<cid>/<fel>      -> { serie, fel, nume, data, grupe?, pachet, semnatura, la }
//
// POST { cod, dispozitiv, actiune:"emite", candidatId, fel, reemite? } (admin) -> { ok, serie }
// POST { cod, dispozitiv, actiune:"situatie" }                         (admin) -> { acte: {cid: {fel: {serie, la}}} }
// POST { cod, dispozitiv, actiune:"act", candidatId, fel }             (admin) -> { act, qr, adresaVerificare }
// POST { id,              actiune:"act", fel }                     (candidat) -> idem, doar actul LUI
import { getStore } from "@netlify/blobs";
import { createHash, createHmac } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { json } from "./_comun/raspuns.mjs";

// Aceeași pereche de chei ca în verifica-act.mjs, cu aceeași trecere lină și FĂRĂ valoare
// de rezervă: fără cheie nu se emite nimic (o diplomă semnată cu o cheie din cod ar fi
// falsificabilă de oricine citește depozitul).
const SECRET_ACTE = process.env.VERIFICARE_SECRET || process.env.EXPO_SYNC_SECRET || "";

const FELURI = ["diploma", "legitimatie"];
const PREFIX_SERIE = { diploma: "DIP", legitimatie: "LEG" };
const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

/** Semnează un pachet exact ca managerul: HMAC-SHA256, primele 24 de hex-caractere. */
function semneaza(pachet) {
  return createHmac("sha256", SECRET_ACTE).update(pachet).digest("hex").slice(0, 24);
}

/** Următorul număr de serie, cu lacăt optimist pe contor (emiterea e rară, dar corectă). */
async function serieNoua(store, fel) {
  for (let i = 0; i < 4; i++) {
    const cu = await store.getWithMetadata("acte-scoala/contor", { type: "json" }).catch(() => null);
    const contor = cu?.data && typeof cu.data === "object" ? cu.data : {};
    const n = (Number(contor[fel]) || 0) + 1;
    const scris = await store.setJSON("acte-scoala/contor", { ...contor, [fel]: n },
      cu ? { onlyIfMatch: cu.etag } : { onlyIfNew: true });
    if (scris?.modified !== false)
      return `${PREFIX_SERIE[fel]}-${new Date().getFullYear()}-${String(n).padStart(3, "0")}`;
  }
  throw new Error("Contorul actelor e disputat — reîncearcă.");
}

/** Pregătește răspunsul de tipărire: actul + QR-ul generat pe server (ca la pedigree). */
async function raspunsAct(inreg) {
  const adresaVerificare = "https://cfc-royal.ro/verifica/?c=" + inreg.pachet + "." + inreg.semnatura;
  let qr = null;
  try {
    const { default: QRCode } = await import("qrcode");
    qr = await QRCode.toDataURL(adresaVerificare, { margin: 0, width: 320, errorCorrectionLevel: "M" });
  } catch (err) { console.error("Generarea codului QR a eșuat:", err); }
  return json({
    act: { fel: inreg.fel, serie: inreg.serie, nume: inreg.nume, data: inreg.data, grupe: inreg.grupe || [], la: inreg.la },
    qr, adresaVerificare,
  });
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 24);
  const fel = taie(body.fel, 20);

  const store = getStore("cursuri");

  // ——— Candidatul (sau arbitrul absolvent) își tipărește PROPRIILE acte, cu codul lui ———
  if (actiune === "act" && body.id != null) {
    const cod = taie(body.id, 128);
    const cid = cod ? sha256(cod) : "";
    const cand = cid ? await store.get("candidat/" + cid, { type: "json" }).catch(() => null) : null;
    if (!cand) return json({ eroare: "Cod necunoscut." }, 401);
    if (!FELURI.includes(fel)) return json({ eroare: "Fel de act necunoscut." }, 400);
    const inreg = await store.get("act-scoala/" + cid + "/" + fel, { type: "json" }).catch(() => null);
    if (!inreg) return json({ eroare: "Actul nu a fost emis încă. Emiterea o face secretariatul Școlii." }, 404);
    return raspunsAct(inreg);
  }

  // ——— De aici încolo, doar administratorul, cu a doua cheie ———
  if (!esteAdmin(body.cod))
    return json({ eroare: "Cod de administrator incorect." }, 401);
  if (!(await dispozitivCunoscut(store, taie(body.dispozitiv, 80), "admin")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." }, 403);

  if (actiune === "situatie") {
    const acte = {};
    try {
      const { blobs } = await store.list({ prefix: "act-scoala/" });
      for (const b of blobs) {
        const parti = b.key.slice("act-scoala/".length).split("/");
        if (parti.length !== 2 || !FELURI.includes(parti[1])) continue;
        const a = await store.get(b.key, { type: "json" }).catch(() => null);
        if (!a) continue;
        (acte[parti[0]] ||= {})[parti[1]] = { serie: a.serie, la: a.la };
      }
    } catch (err) { console.error("Situația actelor a eșuat:", err); }
    return json({ acte });
  }

  const cid = taie(body.candidatId, 128);
  if (!cid || !FELURI.includes(fel)) return json({ eroare: "Candidat sau fel de act invalid." }, 400);
  const cand = await store.get("candidat/" + cid, { type: "json" }).catch(() => null);
  if (!cand) return json({ eroare: "Candidat inexistent." }, 404);

  if (actiune === "act") {
    const inreg = await store.get("act-scoala/" + cid + "/" + fel, { type: "json" }).catch(() => null);
    if (!inreg) return json({ eroare: "Actul nu a fost emis încă." }, 404);
    return raspunsAct(inreg);
  }

  if (actiune === "emite") {
    if (!SECRET_ACTE) {
      console.error("EMITEREA ACTELOR E OPRITĂ: lipsesc și VERIFICARE_SECRET, și EXPO_SYNC_SECRET din mediu.");
      return json({ eroare: "Emiterea e momentan indisponibilă (cheia de semnătură lipsește din mediu)." }, 503);
    }

    // Ce s-a emis rămâne emis: aceeași serie la fiecare apăsare, fără dubluri.
    const existent = await store.get("act-scoala/" + cid + "/" + fel, { type: "json" }).catch(() => null);
    if (existent && !body.reemite) return json({ ok: true, serie: existent.serie, dejaEmis: true });

    // Porțile de fond — actul afirmă un fapt, deci faptul trebuie să existe.
    let grupe = [];
    if (fel === "diploma") {
      const ex = await store.get("examen/" + cid, { type: "json" }).catch(() => null);
      if (!ex?.promovat)
        return json({ eroare: "Diploma se emite doar cu examenul final PROMOVAT." }, 409);
    } else {
      const aut = await store.get("autorizare/" + cid, { type: "json" }).catch(() => null);
      grupe = (Array.isArray(aut?.grupe) ? aut.grupe : []).filter((g) => g >= 1 && g <= 10).sort((a, b) => a - b);
      if (!grupe.length)
        return json({ eroare: "Legitimația se emite doar cu cel puțin o grupă WDF autorizată." }, 409);
    }

    const serie = await serieNoua(store, fel);
    const data = new Date().toISOString().slice(0, 10);
    const nume = taie(cand.nume, 140);
    const titlu = fel === "diploma"
      ? "Diplomă de absolvire — Școala de Arbitraj"
      : "Legitimație de arbitru";
    const pachetJson = { k: fel, s: serie, h: nume, t: titlu, d: data };
    if (fel === "legitimatie") pachetJson.g = grupe.join(", ");
    const pachet = Buffer.from(JSON.stringify(pachetJson), "utf8").toString("base64url");
    const inreg = {
      serie, fel, nume, data, grupe,
      pachet, semnatura: semneaza(pachet),
      la: new Date().toISOString(),
      ...(existent ? { inlocuieste: existent.serie } : {}),
    };
    await store.setJSON("act-scoala/" + cid + "/" + fel, inreg);
    return json({ ok: true, serie });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
