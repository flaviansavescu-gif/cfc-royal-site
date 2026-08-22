// comenzi.mjs — comenzile pentru serviciile tarifate ale asociației.
//
// Serviciile din tarife.ts aveau preț, dar n-aveau ghișeu: Carnetul de Palmares,
// Starter Pack-ul, PrioriPost-ul, urgența de pedigree, corectarea — toate se cereau
// „pe e-mail". De-acum membrul comandă din spațiul lui, cu dovada plății atașată
// (plata declarată, ca peste tot), iar registratura onorează sau respinge cu motiv.
//
// SUMELE NU STAU AICI (regula sursei unice — tarife.ts). Serviciul se identifică prin
// id-ul lui de tarif; pagina arată prețul din tarife.ts, iar registratura verifică
// dovada față de lista oficială. Eticheta de mai jos e doar pentru e-mailuri și jurnal.
//
// Stocare (store "registru"):
//   comanda/<id>        -> { membruId, nume, email, serviciu, detalii, stare, la, ... }
//   comanda-dovada/<id> -> { continut (base64), tip }
//
// POST { cod, actiune:"comanda", serviciu, detalii?, dovada?, dovadaTip? }  (membru)
// POST { cod, actiune:"ale-mele" }                                          (membru)
// POST { cod, dispozitiv, actiune:"de-lucru" }                    (registratură/admin)
// POST { cod, dispozitiv, actiune:"dovada", id }                  (registratură/admin)
// POST { cod, dispozitiv, actiune:"finalizeaza", id, nota? }      (registratură/admin)
// POST { cod, dispozitiv, actiune:"respinge", id, motiv }         (registratură/admin)
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { membruDinCod, registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeaza, actorJurnal, ipCerere } from "./_comun/registru-jurnal.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import { trimite, escapeHtml } from "./_comun/posta.mjs";
import { refuzaDacaInchis } from "./_comun/poarta-scrieri.mjs";
import { json } from "./_comun/raspuns.mjs";

const store = () => getStore({ name: "registru", consistency: "strong" });
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const idNou = () => randomBytes(12).toString("hex");
const MAX_DOVADA = 4 * 1024 * 1024;
const TIPURI_DOVADA = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Serviciile care se pot comanda — id-urile DIN tarife.ts (proba de tarife veghează). */
export const SERVICII = {
  "carnet-palmares": "Carnet de Palmares",
  "carnet-starter-pack": "Starter Pack crescător (carnete pentru tot cuibul)",
  "prioripost": "PrioriPost — expediere prioritară a actelor",
  "pedigree-urgenta": "Eliberare pedigree în regim de urgență",
  "corectare-pedigree": "Corectarea unui pedigree (din vina solicitantului)",
};

async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  return null;
}

async function adreseleRegistraturii(s) {
  const adrese = [];
  try {
    const { blobs } = await s.list({ prefix: "registrator/" });
    for (const b of blobs) {
      const r = await s.get(b.key, { type: "json" }).catch(() => null);
      if (r?.email) adrese.push(r.email);
    }
  } catch (err) { console.error("Adresele registraturii nu s-au putut citi:", err); }
  return adrese;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 24);
  const s = store();

  const eu = await cine(taie(body.cod, 60));
  if (!eu) return json({ eroare: "Cod incorect." }, 401);

  // ——— MEMBRUL: depune o comandă ———
  if (actiune === "comanda") {
    { const oprit = await refuzaDacaInchis(json); if (oprit) return oprit; }
    if (eu.rol !== "membru") return json({ eroare: "Comenzile se depun din spațiul de crescător." }, 403);
    const serviciu = taie(body.serviciu, 40);
    if (!SERVICII[serviciu]) return json({ eroare: "Alege serviciul dorit." }, 400);
    const detalii = taie(body.detalii, 500);

    let areDovada = false;
    if (body.dovada) {
      const tip = taie(body.dovadaTip, 60);
      if (!TIPURI_DOVADA.includes(tip)) return json({ eroare: "Dovada poate fi JPG, PNG, WebP sau PDF." }, 400);
      if (String(body.dovada).length > MAX_DOVADA * 1.4)
        return json({ eroare: "Dovada depășește 4 MB." }, 400);
      areDovada = true;
    }

    const id = idNou();
    const inreg = {
      id, membruId: eu.membru.id, nume: eu.membru.nume, email: eu.membru.email || "",
      serviciu, eticheta: SERVICII[serviciu], detalii, areDovada,
      stare: "depusa", la: new Date().toISOString(),
    };
    // Dovada se scrie ÎNTÂI: altfel o scriere căzută lăsa comanda „cu dovadă" și dovada 404.
    if (areDovada) await s.setJSON("comanda-dovada/" + id, { continut: String(body.dovada), tip: taie(body.dovadaTip, 60) });
    await s.setJSON("comanda/" + id, inreg);

    await jurnalizeaza(s, {
      anuntaLa: await adreseleRegistraturii(s),
      fapta: "comanda-depusa",
      actor: actorJurnal(eu),
      obiect: SERVICII[serviciu],
      detalii: (detalii ? `„${detalii}" — ` : "") + (areDovada ? "cu dovadă de plată" : "FĂRĂ dovadă de plată"),
      ip: ipCerere(req),
    });
    if (inreg.email) {
      await trimite({
        catre: inreg.email,
        subiect: "[CFC-Royal] Comanda a fost primită — " + SERVICII[serviciu],
        html: `<p>Bună, ${escapeHtml(inreg.nume)},</p>` +
          `<p>Am primit comanda ta: <strong>${escapeHtml(SERVICII[serviciu])}</strong>` +
          (detalii ? ` (${escapeHtml(detalii)})` : "") + `. Registratura o preia și îți scrie când e gata.</p>` +
          (areDovada ? "" : `<p style="color:#8c1d2f">Nu ai atașat dovada plății — o poți trimite pe contact@cfc-royal.ro, altfel comanda nu poate fi onorată.</p>`),
      });
    }
    return json({ ok: true, id });
  }

  // ——— MEMBRUL: comenzile lui ———
  if (actiune === "ale-mele") {
    if (eu.rol !== "membru") return json({ eroare: "Nepermis." }, 403);
    const ale = [];
    try {
      const { blobs } = await s.list({ prefix: "comanda/" });
      for (const b of blobs) {
        const c = await s.get(b.key, { type: "json" }).catch(() => null);
        if (c && c.membruId === eu.membru.id)
          ale.push({ id: c.id, eticheta: c.eticheta, detalii: c.detalii, stare: c.stare, la: c.la, motiv: c.motiv || null, nota: c.nota || null });
      }
    } catch (err) { console.error(err); }
    ale.sort((a, b) => String(b.la).localeCompare(String(a.la)));
    return json({ comenzi: ale });
  }

  // ——— REGISTRATURA / ADMIN ———
  if (!["registratura", "admin"].includes(eu.rol)) return json({ eroare: "Nepermis." }, 403);
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);
  }

  if (actiune === "de-lucru") {
    const lista = [];
    try {
      const { blobs } = await s.list({ prefix: "comanda/" });
      for (const b of blobs) {
        const c = await s.get(b.key, { type: "json" }).catch(() => null);
        if (c && c.stare === "depusa") lista.push(c);
      }
    } catch (err) { console.error(err); }
    lista.sort((a, b) => String(a.la).localeCompare(String(b.la)));
    return json({ comenzi: lista });
  }

  const id = taie(body.id, 40);
  if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);

  if (actiune === "dovada") {
    const d = await s.get("comanda-dovada/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Nu există dovadă atașată." }, 404);
    return json({ dovada: d.continut, tip: d.tip });
  }

  const c = await s.get("comanda/" + id, { type: "json" }).catch(() => null);
  if (!c) return json({ eroare: "Comandă inexistentă." }, 404);
  if (c.stare !== "depusa") return json({ eroare: "Comanda a fost deja judecată." }, 409);

  if (actiune === "finalizeaza") {
    const nota = taie(body.nota, 300);
    await jurnalizeaza(s, {
      fapta: "comanda-finalizata",
      actor: actorJurnal(eu),
      obiect: c.eticheta,
      detalii: `pentru ${c.nume}` + (nota ? ` — ${nota}` : ""),
      ip: ipCerere(req),
    });
    await s.setJSON("comanda/" + id, { ...c, stare: "finalizata", nota, judecataLa: new Date().toISOString() });
    if (c.email) {
      await trimite({
        catre: c.email,
        subiect: "[CFC-Royal] Comanda e gata — " + c.eticheta,
        html: `<p>Bună, ${escapeHtml(c.nume)},</p>` +
          `<p>Comanda ta — <strong>${escapeHtml(c.eticheta)}</strong> — a fost onorată.` +
          (nota ? ` ${escapeHtml(nota)}` : "") + `</p><p>Mulțumim!</p>`,
      });
    }
    return json({ ok: true });
  }

  if (actiune === "respinge") {
    const motiv = taie(body.motiv, 400);
    if (motiv.length < 5) return json({ eroare: "Scrie motivul respingerii — omul îl va primi pe e-mail." }, 400);
    await jurnalizeaza(s, {
      fapta: "comanda-respinsa",
      actor: actorJurnal(eu),
      obiect: c.eticheta,
      detalii: `pentru ${c.nume} — ${motiv}`,
      ip: ipCerere(req),
    });
    await s.setJSON("comanda/" + id, { ...c, stare: "respinsa", motiv, judecataLa: new Date().toISOString() });
    if (c.email) {
      await trimite({
        catre: c.email,
        subiect: "[CFC-Royal] Comanda ta — " + c.eticheta,
        html: `<p>Bună, ${escapeHtml(c.nume)},</p>` +
          `<p>Comanda <strong>${escapeHtml(c.eticheta)}</strong> nu a putut fi onorată. Motivul:</p>` +
          `<p style="padding:10px 14px;background:#f9efef;border-left:4px solid #8c1d2f">${escapeHtml(motiv)}</p>` +
          `<p>O poți depune din nou după lămurirea situației.</p>`,
      });
    }
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
