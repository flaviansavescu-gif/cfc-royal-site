// omologare.mjs — cererea de omologare a titlurilor de campion (Hot. 167, Art. 39).
//
// Butonul „cere omologarea" de pe Drumul spre Campion duce de-acum undeva: proprietarul
// depune cererea AICI (public, fără cod — proprietarul poate să nu fie membru), iar
// registratura o vede în coada ei, verifică certificatele în Manager și OPEREAZĂ
// omologarea acolo (Art. 39: titlurile se calculează doar în Manager). Pe site, titlul
// omologat apare la următoarea publicare a palmaresului. Omologarea e gratuită (Hot. 167).
//
// Cererea se primește și când registrul de campionate NU arată încă toate condițiile:
// calea externă a Campionului Internațional și Reproducătorul se dovedesc cu ACTE la
// registratură — sistemul doar spune cinstit ce vede, hotărârea e a omului.
//
// Stocare (store "registru"): omologare/<id> -> { serie, microcip, caine, titlu, ... }
//
// POST { actiune:"cere", cautat, titlu, nume, email, website? }        PUBLIC
// POST { cod, dispozitiv, actiune:"de-lucru" }                         (registratură/admin)
// POST { cod, dispozitiv, actiune:"opereaza", id }                     (registratură/admin)
// POST { cod, dispozitiv, actiune:"respinge", id, motiv }              (registratură/admin)
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeaza, jurnalizeazaObligatoriu, actorJurnal, actorExtern, ipCerere } from "./_comun/registru-jurnal.mjs";
import { eRobot, limiteazaTrimiterile, minuteText } from "./_comun/formular-public.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import { trimite, escapeHtml } from "./_comun/posta.mjs";
import { refuzaDacaInchis } from "./_comun/poarta-scrieri.mjs";
import { json } from "./_comun/raspuns.mjs";

const store = () => getStore({ name: "registru", consistency: "strong" });
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const idNou = () => randomBytes(12).toString("hex");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Titlurile din Hot. 167 — aceleași coduri ca în motorul Managerului și pe pagină. */
const TITLURI = {
  junior_champion: "Campion Junior",
  campion_national: "Campion Național",
  campion_international: "Campion Internațional",
  grand_champion: "Mare Campion (Grand Champion)",
  multi_champion: "Multi Campion",
  reproducer: "Campion Reproducător",
  world_champion: "Campion Mondial",
};

/** Găsește certificatul după serie, microcip sau număr WDF — aceleași trei uși ca la fișă. */
async function gasesteCertificatul(s, cautat) {
  let cert = await s.get("pedigree/" + cautat, { type: "json" }).catch(() => null);
  if (!cert) {
    const dupaCaine = await s.get("pedigree-caine/" + cautat.replace(/[\s-]/g, ""), { type: "json" }).catch(() => null);
    if (dupaCaine?.serie) cert = await s.get("pedigree/" + dupaCaine.serie, { type: "json" }).catch(() => null);
  }
  if (!cert) {
    const dupaWdf = await s.get("pedigree-wdf/" + cautat, { type: "json" }).catch(() => null);
    if (dupaWdf?.serie) cert = await s.get("pedigree/" + dupaWdf.serie, { type: "json" }).catch(() => null);
  }
  return cert;
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

  // ——— PUBLIC: cererea proprietarului ———
  if (actiune === "cere") {
    { const oprit = await refuzaDacaInchis(json); if (oprit) return oprit; }
    if (eRobot(body)) return json({ ok: true, id: "—" });   // succes prefăcut, ca peste tot
    const lim = await limiteazaTrimiterile(s, "omologare-ip", req, { max: 5, fereastraMs: 3600e3 });
    if (!lim.permis)
      return json({ eroare: `Ai trimis deja mai multe cereri în ultima oră. Mai încearcă peste ${minuteText(lim.dupaSecunde)}.` }, 429);

    const cautat = taie(body.cautat, 60).toUpperCase();
    if (!cautat || !segmentCheieValid(cautat)) return json({ eroare: "Scrie seria, numărul WDF sau microcipul câinelui." }, 400);
    const titlu = taie(body.titlu, 40);
    if (!TITLURI[titlu]) return json({ eroare: "Alege titlul cerut." }, 400);
    const nume = taie(body.nume, 120);
    if (nume.length < 3) return json({ eroare: "Scrie numele tău complet." }, 400);
    const email = taie(body.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return json({ eroare: "Scrie o adresă de e-mail validă." }, 400);

    const cert = await gasesteCertificatul(s, cautat);
    if (!cert) return json({ eroare: "Niciun câine cu această referință în registrul CFC-Royal." }, 404);
    if (cert.anulat) return json({ eroare: "Certificatul acestui câine este anulat." }, 409);
    const microcip = String(cert.caine?.microcip || "").replace(/[\s-]/g, "");

    // Ce vede registrul de campionate: îndeplinit / omologat deja. Doar informativ —
    // calea externă și Reproducătorul se judecă pe acte, de către registratură.
    let indeplinitInRegistru = null, dejaOmologat = false, detaliuRegistru = "";
    try {
      const t = await getStore("expozitii").get("titluri/" + microcip, { type: "json" });
      const c = (t?.campionate || []).find((x) => x.cod === titlu);
      if (c) {
        indeplinitInRegistru = !!c.indeplinit;
        dejaOmologat = !!(c.omologari && c.omologari.length);
        detaliuRegistru = String(c.detaliu || "").slice(0, 300);
      }
    } catch (err) { console.error("Citirea registrului de campionate a eșuat:", err); }
    if (dejaOmologat)
      return json({ eroare: `Titlul „${TITLURI[titlu]}" e deja omologat pentru acest câine.` }, 409);

    // O singură cerere în așteptare per câine + titlu. Câinele se recunoaște pe cip;
    // la actele vechi fără cip, pe serie — altfel „" === „" bloca un câine DIFERIT.
    const serieCerta = cert.serie || cautat;
    try {
      const { blobs } = await s.list({ prefix: "omologare/" });
      for (const b of blobs) {
        const o = await s.get(b.key, { type: "json" }).catch(() => null);
        const acelasiCaine = o && (microcip ? o.microcip === microcip : o.serie === serieCerta);
        if (acelasiCaine && o.titlu === titlu && o.stare === "noua")
          return json({ eroare: "Există deja o cerere în lucru pentru acest titlu — registratura o judecă în cel mai scurt timp." }, 409);
      }
    } catch (err) { console.error(err); }

    const id = idNou();
    const inreg = {
      id, serie: cert.serie || cautat, microcip,
      caine: { nume: cert.caine?.nume || "", rasa: cert.caine?.rasa || "" },
      titlu, etichetaTitlu: TITLURI[titlu],
      indeplinitInRegistru, detaliuRegistru,
      solicitant: { nume, email },
      stare: "noua", la: new Date().toISOString(),
    };
    await s.setJSON("omologare/" + id, inreg);

    await jurnalizeaza(s, {
      anuntaLa: await adreseleRegistraturii(s),
      fapta: "omologare-ceruta",
      actor: actorExtern(nume),
      obiect: inreg.serie,
      detalii: `${inreg.caine.nume}: ${TITLURI[titlu]}` +
        (indeplinitInRegistru === true ? " (condiții ÎNDEPLINITE în registru)" :
         indeplinitInRegistru === false ? " (condițiile NU apar îndeplinite — posibil cale externă/pe acte)" :
         " (fără date în registrul de campionate)") +
        ` — solicitant ${email}`,
      ip: ipCerere(req),
    });
    await trimite({
      catre: email,
      subiect: `[CFC-Royal] Cererea de omologare — ${inreg.caine.nume || inreg.serie}`,
      html: `<p>Bună, ${escapeHtml(nume)},</p>` +
        `<p>Am primit cererea de omologare a titlului <strong>${escapeHtml(TITLURI[titlu])}</strong> pentru ` +
        `<strong>${escapeHtml(inreg.caine.nume || inreg.serie)}</strong>. Registratura verifică certificatele în ` +
        `registrul oficial de campionate și îți scrie cu hotărârea. Omologarea este gratuită.</p>` +
        `<p style="color:#888;font-size:12px">Titlul omologat apare pe fișa publică a câinelui la următoarea publicare a palmaresului.</p>`,
    });
    return json({ ok: true, id });
  }

  // ——— REGISTRATURA / ADMIN ———
  const eu = actorDinCod(taie(body.cod, 60))?.rol === "admin"
    ? { rol: "admin" }
    : await registratorDinCod(taie(body.cod, 60)).then((r) => (r ? { rol: "registratura", registrator: r } : null));
  if (!eu) return json({ eroare: "Cod incorect." }, 401);
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403, { antete: { "x-refuz-drept": "1" } });
  }

  if (actiune === "de-lucru") {
    const lista = [];
    try {
      const { blobs } = await s.list({ prefix: "omologare/" });
      for (const b of blobs) {
        const o = await s.get(b.key, { type: "json" }).catch(() => null);
        if (o && o.stare === "noua") lista.push(o);
      }
    } catch (err) { console.error(err); }
    lista.sort((a, b) => String(a.la).localeCompare(String(b.la)));
    return json({ cereri: lista });
  }

  const id = taie(body.id, 40);
  if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
  const o = await s.get("omologare/" + id, { type: "json" }).catch(() => null);
  if (!o) return json({ eroare: "Cerere inexistentă." }, 404);
  if (o.stare !== "noua") return json({ eroare: "Cererea a fost deja judecată." }, 409);

  if (actiune === "opereaza") {
    // URMA ÎNTÂI: titlul omologat sprijină palmaresul public — fără urmă, nu-l operăm.
    try {
      await jurnalizeazaObligatoriu(s, {
      fapta: "omologare-operata",
      actor: actorJurnal(eu),
      obiect: o.serie,
      detalii: `${o.caine?.nume || ""}: ${o.etichetaTitlu} — omologat în Manager; apare pe fișă la următoarea publicare a palmaresului`,
      ip: ipCerere(req),
      });
    } catch (err) {
      console.error("Jurnalul omologării a eșuat — cererea rămâne neschimbată:", err);
      return json({ eroare: "Nu am putut consemna fapta în jurnal, deci nu am schimbat nimic. Reîncearcă." }, 503);
    }
    await s.setJSON("omologare/" + id, { ...o, stare: "operata", judecataLa: new Date().toISOString() });
    await trimite({
      catre: o.solicitant?.email,
      subiect: `[CFC-Royal] Titlul a fost omologat — ${o.caine?.nume || o.serie}`,
      html: `<p>Bună, ${escapeHtml(o.solicitant?.nume || "")},</p>` +
        `<p>Titlul <strong>${escapeHtml(o.etichetaTitlu)}</strong> pentru <strong>${escapeHtml(o.caine?.nume || o.serie)}</strong> ` +
        `a fost <strong>omologat</strong>. Felicitări! El apare pe fișa publică a câinelui ` +
        `(<a href="https://cfc-royal.ro/caine/?r=${encodeURIComponent(o.serie)}">cfc-royal.ro/caine/</a>) ` +
        `la următoarea publicare a palmaresului de către club.</p>`,
    });
    return json({ ok: true });
  }

  if (actiune === "respinge") {
    const motiv = taie(body.motiv, 400);
    if (motiv.length < 5) return json({ eroare: "Scrie motivul respingerii — omul îl va primi pe e-mail." }, 400);
    await jurnalizeaza(s, {
      fapta: "omologare-respinsa",
      actor: actorJurnal(eu),
      obiect: o.serie,
      detalii: `${o.etichetaTitlu} — ${motiv}`,
      ip: ipCerere(req),
    });
    await s.setJSON("omologare/" + id, { ...o, stare: "respinsa", motiv, judecataLa: new Date().toISOString() });
    await trimite({
      catre: o.solicitant?.email,
      subiect: `[CFC-Royal] Cererea de omologare — ${o.caine?.nume || o.serie}`,
      html: `<p>Bună, ${escapeHtml(o.solicitant?.nume || "")},</p>` +
        `<p>Cererea de omologare a titlului <strong>${escapeHtml(o.etichetaTitlu)}</strong> nu a putut fi aprobată. Motivul:</p>` +
        `<p style="padding:10px 14px;background:#f9efef;border-left:4px solid #8c1d2f">${escapeHtml(motiv)}</p>` +
        `<p>Dacă între timp condițiile se împlinesc (sau ai actele doveditoare), poți depune o nouă cerere oricând.</p>`,
    });
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
