// registru-cotizatie.mjs — plata cotizației, declarată de membru și confirmată de registratură.
//
// Până azi, cotizația se plătea „scriind secretariatului": omul făcea transferul, apoi
// cineva îi muta data de mână în fișă. De acum drumul e cel al casei — „plată declarată
// + dovadă": membrul declară plata din spațiul lui (cu dovada atașată), cererea intră în
// coada registraturii, iar confirmarea prelungește termenul AUTOMAT, cu urmă în jurnal.
//
// Regula termenului (tarife.ts, grupa „membru"): cotizația acoperă 12 luni. Confirmarea
// prelungește cu 12 luni de la scadența curentă dacă ea e în viitor (plata înainte de
// termen nu pierde nimic), altfel de la zi. Registratura poate scrie și o dată anume.
//
// Stocare (store "registru"):
//   cotizatie-plata/<id>  -> { membruId, nume, email, nota, stare, la, ... }
//   cotizatie-dovada/<id> -> { continut (base64), tip }
//
// POST { cod, actiune:"declara", dovada?, dovadaTip?, nota? }   (membru)
// POST { cod, actiune:"a-mea" }                                 (membru)  -> ultima declarație
// POST { cod, dispozitiv, actiune:"de-confirmat" }              (registratură/admin)
// POST { cod, dispozitiv, actiune:"dovada", id }                (registratură/admin)
// POST { cod, dispozitiv, actiune:"confirma", id, panaLa? }     (registratură/admin)
// POST { cod, dispozitiv, actiune:"respinge", id, motiv }       (registratură/admin)
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { membruDinCod, registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeaza, jurnalizeazaObligatoriu, actorJurnal, ipCerere } from "./_comun/registru-jurnal.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import { trimite, escapeHtml } from "./_comun/posta.mjs";
import { refuzaDacaInchis } from "./_comun/poarta-scrieri.mjs";
import { json } from "./_comun/raspuns.mjs";

const store = () => getStore({ name: "registru", consistency: "strong" });
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const idNou = () => randomBytes(12).toString("hex");
const MAX_DOVADA = 4 * 1024 * 1024;
const TIPURI_DOVADA = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const eData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

/** Noul termen: +12 luni de la scadența viitoare sau de la zi — ce e mai târziu. */
export function termenNou(cotizatiePana, azi = new Date()) {
  const scadenta = Date.parse(String(cotizatiePana || ""));
  const baza = Number.isFinite(scadenta) && scadenta > azi.getTime() ? new Date(scadenta) : new Date(azi);
  const t = new Date(baza);
  t.setFullYear(t.getFullYear() + 1);
  return t.toISOString().slice(0, 10);
}

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

  // ——— MEMBRUL: declară plata ———
  if (actiune === "declara") {
    { const oprit = await refuzaDacaInchis(json); if (oprit) return oprit; }
    if (eu.rol !== "membru") return json({ eroare: "Plata cotizației se declară din spațiul de crescător." }, 403);

    let areDovada = false;
    if (body.dovada) {
      const tip = taie(body.dovadaTip, 60);
      if (!TIPURI_DOVADA.includes(tip)) return json({ eroare: "Dovada poate fi JPG, PNG, WebP sau PDF." }, 400);
      if (String(body.dovada).length > MAX_DOVADA * 1.4)
        return json({ eroare: "Dovada depășește 4 MB." }, 400);
      areDovada = true;
    }

    // O singură declarație în așteptare per membru — LACĂT atomic (onlyIfNew), nu doar
    // listare: două taburi apăsate deodată treceau amândouă de listare, iar registratura
    // confirma amândouă = +24 de luni pentru o singură plată. Lacătul se ridică la judecată.
    const id = idNou();
    const lacat = await s.setJSON("cotizatie-in-curs/" + eu.membru.id, { id, la: new Date().toISOString() }, { onlyIfNew: true });
    if (lacat?.modified === false)
      return json({ eroare: "Ai deja o plată declarată în așteptare — registratura o confirmă în cel mai scurt timp." }, 409);

    const inreg = {
      id, membruId: eu.membru.id,
      nume: eu.membru.nume, email: eu.membru.email || "",
      cotizatiePanaLaDeclarare: eu.membru.cotizatiePana || null,
      nota: taie(body.nota, 300),
      areDovada, stare: "declarata", la: new Date().toISOString(),
    };
    // Dovada se scrie ÎNTÂI: altfel o scriere căzută lăsa cererea „cu dovadă" și dovada 404.
    if (areDovada) await s.setJSON("cotizatie-dovada/" + id, { continut: String(body.dovada), tip: taie(body.dovadaTip, 60) });
    await s.setJSON("cotizatie-plata/" + id, inreg);

    await jurnalizeaza(s, {
      anuntaLa: await adreseleRegistraturii(s),
      fapta: "cotizatie-declarata",
      actor: actorJurnal(eu),
      obiect: eu.membru.nume,
      detalii: `Plată declarată${areDovada ? ", cu dovadă atașată" : ", FĂRĂ dovadă"}` +
        (inreg.nota ? ` — „${inreg.nota}"` : "") +
        `; termenul curent: ${inreg.cotizatiePanaLaDeclarare || "—"}`,
      ip: ipCerere(req),
    });
    if (inreg.email) {
      await trimite({
        catre: inreg.email,
        subiect: "[CFC-Royal] Plata cotizației a fost declarată",
        html: `<p>Bună, ${escapeHtml(inreg.nume)},</p>` +
          `<p>Am primit declarația ta de plată a cotizației${areDovada ? ", cu dovada atașată" : ""}. ` +
          `Registratura o confirmă în cel mai scurt timp, iar noul termen îți vine tot pe e-mail.</p>`,
      });
    }
    return json({ ok: true, id });
  }

  // ——— MEMBRUL: starea ultimei declarații ———
  if (actiune === "a-mea") {
    if (eu.rol !== "membru") return json({ eroare: "Nepermis." }, 403);
    let ultima = null;
    try {
      const { blobs } = await s.list({ prefix: "cotizatie-plata/" });
      for (const b of blobs) {
        const p = await s.get(b.key, { type: "json" }).catch(() => null);
        if (p && p.membruId === eu.membru.id && (!ultima || String(p.la).localeCompare(String(ultima.la)) > 0))
          ultima = { id: p.id, stare: p.stare, la: p.la, motiv: p.motiv || null, panaLaNoua: p.panaLaNoua || null };
      }
    } catch (err) { console.error(err); }
    return json({ ultima });
  }

  // ——— REGISTRATURA / ADMIN: a doua cheie, apoi coada ———
  if (!["registratura", "admin"].includes(eu.rol)) return json({ eroare: "Nepermis." }, 403);
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);
  }

  if (actiune === "de-confirmat") {
    const lista = [];
    try {
      const { blobs } = await s.list({ prefix: "cotizatie-plata/" });
      for (const b of blobs) {
        const p = await s.get(b.key, { type: "json" }).catch(() => null);
        if (p && p.stare === "declarata")
          lista.push({ id: p.id, nume: p.nume, email: p.email, nota: p.nota, areDovada: p.areDovada,
            cotizatiePana: p.cotizatiePanaLaDeclarare, la: p.la });
      }
    } catch (err) { console.error(err); }
    lista.sort((a, b) => String(a.la).localeCompare(String(b.la)));
    return json({ plati: lista });
  }

  const id = taie(body.id, 40);
  if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);

  if (actiune === "dovada") {
    const d = await s.get("cotizatie-dovada/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Nu există dovadă atașată." }, 404);
    return json({ dovada: d.continut, tip: d.tip });
  }

  const cuEtag = await s.getWithMetadata("cotizatie-plata/" + id, { type: "json" }).catch(() => null);
  const p = cuEtag?.data || null;
  if (!p) return json({ eroare: "Declarație inexistentă." }, 404);
  if (p.stare !== "declarata") return json({ eroare: "Declarația a fost deja judecată." }, 409);

  if (actiune === "confirma") {
    const membru = await s.get("membru/" + p.membruId, { type: "json" }).catch(() => null);
    if (!membru) return json({ eroare: "Membrul nu mai există în registru." }, 404);
    const ceruta = taie(body.panaLa, 10);
    if (ceruta && !eData(ceruta)) return json({ eroare: "Data are forma AAAA-LL-ZZ." }, 400);
    // O dată din trecut „expiră" membrul pe loc — aproape sigur o greșeală de tastare.
    if (ceruta && Date.parse(ceruta) <= Date.now())
      return json({ eroare: "Data scrisă e în trecut — noul termen trebuie să fie o zi viitoare." }, 400);
    const panaLaNoua = ceruta || termenNou(membru.cotizatiePana);

    // URMA ÎNTÂI: o prelungire de termen fără urmă nu se poate apăra.
    try {
      await jurnalizeazaObligatoriu(s, {
        fapta: "cotizatie-confirmata",
        actor: actorJurnal(eu),
        obiect: p.nume,
        detalii: `${membru.cotizatiePana || "—"} → ${panaLaNoua}` + (ceruta ? " (dată scrisă de registratură)" : " (+12 luni)"),
        ip: ipCerere(req),
      });
    } catch (err) {
      console.error("Jurnalul cotizației a eșuat — fișa rămâne neschimbată:", err);
      return json({ eroare: "Nu am putut consemna fapta în jurnal, deci nu am schimbat nimic. Reîncearcă." }, 503);
    }
    // ÎNTÂI declarația, CONDIȚIONAT (etag): două confirmări simultane citeau amândouă
    // „declarata" și prelungeau de două ori. Cine pierde cursa se oprește aici, fără
    // să atingă fișa membrului.
    const scris = await s.setJSON("cotizatie-plata/" + id,
      { ...p, stare: "confirmata", panaLaNoua, judecataLa: new Date().toISOString() },
      { onlyIfMatch: cuEtag.etag });
    if (scris?.modified === false)
      return json({ eroare: "Declarația a fost judecată între timp de altcineva." }, 409);
    await s.setJSON("membru/" + p.membruId, { ...membru, cotizatiePana: panaLaNoua });
    await s.delete("cotizatie-in-curs/" + p.membruId).catch(() => {});
    if (p.email) {
      await trimite({
        catre: p.email,
        subiect: "[CFC-Royal] Cotizația confirmată — valabilă până la " + panaLaNoua,
        html: `<p>Bună, ${escapeHtml(p.nume)},</p>` +
          `<p>Plata cotizației a fost confirmată de registratură. Calitatea ta de membru e acum ` +
          `valabilă până la <strong>${escapeHtml(panaLaNoua)}</strong>. Mulțumim!</p>`,
      });
    }
    return json({ ok: true, panaLaNoua });
  }

  if (actiune === "respinge") {
    const motiv = taie(body.motiv, 400);
    if (motiv.length < 5) return json({ eroare: "Scrie motivul respingerii — omul îl va primi pe e-mail." }, 400);
    await jurnalizeaza(s, {
      fapta: "cotizatie-plata-respinsa",
      actor: actorJurnal(eu),
      obiect: p.nume,
      detalii: motiv,
      ip: ipCerere(req),
    });
    const scris = await s.setJSON("cotizatie-plata/" + id,
      { ...p, stare: "respinsa", motiv, judecataLa: new Date().toISOString() },
      { onlyIfMatch: cuEtag.etag });
    if (scris?.modified === false)
      return json({ eroare: "Declarația a fost judecată între timp de altcineva." }, 409);
    await s.delete("cotizatie-in-curs/" + p.membruId).catch(() => {});
    if (p.email) {
      await trimite({
        catre: p.email,
        subiect: "[CFC-Royal] Declarația de plată a cotizației",
        html: `<p>Bună, ${escapeHtml(p.nume)},</p>` +
          `<p>Declarația ta de plată nu a putut fi confirmată. Motivul:</p>` +
          `<p style="padding:10px 14px;background:#f9efef;border-left:4px solid #8c1d2f">${escapeHtml(motiv)}</p>` +
          `<p>Poți declara din nou plata, cu dovada potrivită, din spațiul tău de crescător.</p>`,
      });
    }
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
