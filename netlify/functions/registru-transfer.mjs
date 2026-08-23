// registru-transfer.mjs — transferul de proprietate al unui câine.
//
// GOLUL PE CARE ÎL ASTUPĂ. Certificatul se emite pe crescător „iar transferul se
// operează ulterior" — dar până azi nu exista NICIO cale de a-l opera, nici măcar
// pentru registratură. Când crescătorul vindea un pui, evidența publică rămânea să
// mintă liniștit.
//
// CIRCUITUL (tiparul confirmării de montă — jetonul pe e-mail ține locul semnăturii):
//   1. VÂNZĂTORUL (crescătorul, din spațiul lui) inițiază: seria + datele noului
//      proprietar. Poate iniția DOAR pentru câinii cuiburilor lui (regula dosarAlMeu).
//   2. NOUL PROPRIETAR primește un link pe e-mail și CONFIRMĂ (sau refuză) — el nu are
//      cod și nici nu trebuie să aibă: poate să nu fie membru.
//   3. REGISTRATURA operează transferul pe certificat; vechiul proprietar rămâne în
//      istoricul certificatului. Ambele părți primesc vestea.
//
// Stocare (store „registru", citire tare):
//   transfer-dosar/<id>          -> cererea, cu starea ei (sursa de adevăr)
//   transfer/<sha256(jeton)>     -> invitația (doar amprenta jetonului; unică folosință)
//   transfer-serie/<serie>       -> lacăt: un singur transfer în curs per câine (onlyIfNew)
//
// POST { cod, actiune:"initiaza", serie, nou:{nume,email,adresa,localitate,judet,tara} } (membru)
// POST {      actiune:"vezi", jeton }                                                    PUBLIC
// POST {      actiune:"raspuns", jeton, raspuns:"confirm"|"refuz", nume, motiv? }        PUBLIC
// POST { cod, actiune:"ale-mele" }                                                       (membru)
// POST { cod, actiune:"anuleaza", id }                                                   (membru, cât e în așteptare)
// POST { cod, dispozitiv, actiune:"de-operat" }                                          (registratură/admin)
// POST { cod, dispozitiv, actiune:"opereaza", id }                                       (registratură/admin)
import { getStore } from "@netlify/blobs";
import { randomBytes, createHash } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { membruDinCod, registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeaza, jurnalizeazaObligatoriu, actorJurnal, actorExtern, ipCerere } from "./_comun/registru-jurnal.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import { trimite, escapeHtml } from "./_comun/posta.mjs";
import { refuzaDacaInchis } from "./_comun/poarta-scrieri.mjs";
import { json } from "./_comun/raspuns.mjs";

const store = () => getStore({ name: "registru", consistency: "strong" });
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const jetonNou = () => randomBytes(32).toString("hex");
const idNou = () => randomBytes(12).toString("hex");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Invitația e valabilă 30 de zile — un transfer nu e o urgență, dar nici o eternitate. */
const VALABILITATE_ZILE = 30;

async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  return null;
}

/** Adresele registratorilor, pentru anunțul din jurnal (ca la cererile de acces). */
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

  // ——— PUBLIC: noul proprietar, cu jetonul din link ———
  if (actiune === "vezi" || actiune === "raspuns") {
    const jeton = taie(body.jeton, 100);
    if (!jeton) return json({ eroare: "Link incomplet." }, 400);
    const cheie = "transfer/" + sha256(jeton);
    const inv = await s.get(cheie, { type: "json" }).catch(() => null);
    if (!inv) return json({ eroare: "Link invalid sau deja folosit." }, 404);
    if (inv.expira && inv.expira < new Date().toISOString())
      return json({ eroare: "Linkul a expirat. Cereți vânzătorului să reia transferul." }, 410);
    const dosar = await s.get("transfer-dosar/" + inv.id, { type: "json" }).catch(() => null);
    if (!dosar || dosar.stare !== "asteapta-confirmare")
      return json({ eroare: "Transferul nu mai este în așteptare." }, 410);

    if (actiune === "vezi") {
      // Doar ce trebuie ca omul să recunoască transferul: câinele și propriile lui date.
      // Microcipul întreg NU pleacă pe jeton: pagina nu-l afișează, iar un cip întreg
      // permite revendicarea câinelui în bazele veterinare (regula fișei publice).
      return json({
        transfer: {
          caine: { nume: dosar.caine?.nume || "", rasa: dosar.caine?.rasa || "" }, serie: dosar.serie,
          vanzator: dosar.vanzator.nume,
          nou: { nume: dosar.nou.nume, localitate: dosar.nou.localitate, judet: dosar.nou.judet, tara: dosar.nou.tara },
        },
      });
    }

    const raspuns = taie(body.raspuns, 10);
    if (raspuns !== "confirm" && raspuns !== "refuz") return json({ eroare: "Alegeți o variantă." }, 400);
    const nume = taie(body.nume, 120);
    if (nume.length < 3) return json({ eroare: "Scrieți numele dumneavoastră." }, 400);
    const motiv = taie(body.motiv, 600);
    if (raspuns === "refuz" && motiv.length < 5)
      return json({ eroare: "Scrieți pe scurt de ce nu confirmați." }, 400);

    const urma = {
      stare: raspuns === "confirm" ? "confirmat" : "refuzat",
      nume, motiv, la: new Date().toISOString(), ip: ipCerere(req),
    };
    await s.setJSON("transfer-dosar/" + inv.id, { ...dosar, stare: urma.stare, raspuns: urma });
    await s.delete(cheie).catch(() => {});   // unică folosință
    if (urma.stare === "refuzat") await s.delete("transfer-serie/" + dosar.serie).catch(() => {});
    // Vestea pleacă la registratori (fapta e în FAPTE_DE_ANUNTAT).
    await jurnalizeaza(s, {
      anuntaLa: await adreseleRegistraturii(s),
      fapta: "transfer-raspuns",
      actor: actorExtern(nume),
      obiect: dosar.serie,
      detalii: (urma.stare === "confirmat"
        ? `A confirmat dobândirea câinelui ${dosar.caine?.nume || ""} — transferul așteaptă operarea registraturii`
        : `NU a confirmat transferul${motiv ? " — " + motiv : ""}`) + ` (${dosar.nou.email})`,
      ip: urma.ip,
    });
    return json({ ok: true, stare: urma.stare });
  }

  // ——— De aici încolo: cu cod ———
  const eu = await cine(taie(body.cod, 60));
  if (!eu) return json({ eroare: "Cod incorect." }, 401);

  // ——— MEMBRUL: inițiază transferul ———
  if (actiune === "initiaza") {
    { const oprit = await refuzaDacaInchis(json); if (oprit) return oprit; }
    if (eu.rol !== "membru") return json({ eroare: "Transferul se inițiază din spațiul de crescător." }, 403);
    const serie = taie(body.serie, 40).toUpperCase();
    if (!segmentCheieValid(serie)) return json({ eroare: "Referință invalidă." }, 400);

    const cert = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (!cert) return json({ eroare: "Nu există niciun certificat cu această serie." }, 404);
    if (cert.anulat) return json({ eroare: "Certificatul este anulat — transferul nu se poate opera." }, 409);
    // Regula dosarAlMeu: doar câinii cuiburilor crescătorului.
    const d = await s.get("dmf/" + cert.dmfId, { type: "json" }).catch(() => null);
    if (!d || d.membruId !== eu.membru.id)
      return json({ eroare: "Poți iniția transferul doar pentru câinii cuiburilor tale." }, 403);

    const nou = {
      nume: taie(body.nou?.nume, 120),
      email: taie(body.nou?.email, 200).toLowerCase(),
      adresa: taie(body.nou?.adresa, 200),
      localitate: taie(body.nou?.localitate, 120),
      judet: taie(body.nou?.judet, 60),
      tara: taie(body.nou?.tara, 60) || "România",
    };
    if (nou.nume.length < 3) return json({ eroare: "Scrie numele noului proprietar." }, 400);
    if (!EMAIL_RE.test(nou.email)) return json({ eroare: "Scrie o adresă de e-mail validă a noului proprietar." }, 400);
    if (!nou.localitate) return json({ eroare: "Scrie localitatea noului proprietar." }, 400);

    // Un singur transfer în curs per câine — lacăt atomic, ca la serii.
    const id = idNou();
    let lacat = await s.setJSON("transfer-serie/" + serie, { id, creat: new Date().toISOString() }, { onlyIfNew: true });
    if (lacat?.modified === false) {
      // Lacătul poate fi ORFAN (o cădere între lacăt și dosar) sau al unui dosar deja
      // închis. Un lacăt fără transfer viu nu apără nimic — se preia, nu blochează seria.
      const vechi = await s.get("transfer-serie/" + serie, { type: "json" }).catch(() => null);
      const dosarVechi = vechi?.id ? await s.get("transfer-dosar/" + vechi.id, { type: "json" }).catch(() => null) : null;
      const viu = dosarVechi && ["asteapta-confirmare", "confirmat"].includes(dosarVechi.stare);
      if (viu)
        return json({ eroare: "Există deja un transfer în curs pentru acest câine. Anulează-l întâi din lista ta." }, 409);
      await s.setJSON("transfer-serie/" + serie, { id, creat: new Date().toISOString() });
      lacat = { modified: true };
    }

    const jeton = jetonNou();
    const expira = new Date(Date.now() + VALABILITATE_ZILE * 86400e3).toISOString();
    const dosarT = {
      id, serie,
      caine: { nume: cert.caine?.nume || "", rasa: cert.caine?.rasa || "", microcip: cert.caine?.microcip || "" },
      vanzator: { membruId: eu.membru.id, nume: eu.membru.nume },
      proprietarVechi: cert.proprietar || null,
      // Crescătorul poate iniția și pentru un câine VÂNDUT deja (dosarul cuibului e al
      // lui) — dar atunci registratura trebuie să VADĂ că pe act figurează altcineva.
      initiatDeCrescator: !!(cert.proprietar?.nume &&
        cert.proprietar.nume.trim().toLowerCase() !== String(eu.membru.nume || "").trim().toLowerCase()),
      nou,
      stare: "asteapta-confirmare",
      creat: new Date().toISOString(),
      expira,
    };
    await s.setJSON("transfer-dosar/" + id, dosarT);
    await s.setJSON("transfer/" + sha256(jeton), { id, expira });

    const link = "https://cfc-royal.ro/confirmare-transfer/?t=" + jeton;
    const trimis = await trimite({
      catre: nou.email,
      subiect: `[CFC-Royal] Confirmarea dobândirii câinelui ${dosarT.caine.nume || serie} · Confirmation of ownership transfer`,
      html:
        `<h2 style="margin:0 0 12px;color:#1F4D3A">Confirmarea transferului de proprietate</h2>` +
        `<p><strong>${escapeHtml(dosarT.vanzator.nume)}</strong> a cerut trecerea câinelui ` +
        `<strong>${escapeHtml(dosarT.caine.nume || "—")}</strong> (${escapeHtml(dosarT.caine.rasa || "")}, certificat ` +
        `<span style="font-family:monospace">${escapeHtml(serie)}</span>) pe numele dumneavoastră, în Registrul genealogic CFC-Royal.</p>` +
        `<p><a href="${link}" style="display:inline-block;background:#1F4D3A;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none">Vezi și confirmă transferul</a></p>` +
        `<p style="font-size:12px;color:#888;word-break:break-all">${escapeHtml(link)}</p>` +
        `<p style="color:#555;font-size:14px" lang="en">${escapeHtml(dosarT.vanzator.nume)} has requested the transfer of the dog ` +
        `${escapeHtml(dosarT.caine.nume || "—")} (certificate ${escapeHtml(serie)}) into your name in the CFC-Royal stud book. ` +
        `Open the link above to review and confirm.</p>` +
        `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
        `<p style="color:#888;font-size:12px">Dacă nu cunoașteți acest transfer, deschideți linkul și alegeți „Nu confirm" — sesizarea ajunge la registratură.<br>` +
        `Linkul este valabil ${VALABILITATE_ZILE} de zile.</p>`,
    });
    if (!trimis) {
      // Fără e-mail, invitația e moartă: dăm totul înapoi, cinstit.
      await s.delete("transfer/" + sha256(jeton)).catch(() => {});
      await s.delete("transfer-dosar/" + id).catch(() => {});
      await s.delete("transfer-serie/" + serie).catch(() => {});
      return json({ eroare: "Invitația nu a putut fi trimisă pe e-mail. Verifică adresa și încearcă din nou." }, 502);
    }
    await jurnalizeaza(s, {
      fapta: "transfer-initiat",
      actor: actorJurnal(eu),
      obiect: serie,
      detalii: `${dosarT.caine.nume || ""} → ${nou.nume} (${nou.localitate}${nou.judet ? ", " + nou.judet : ""}); invitație la ${nou.email}`,
      ip: ipCerere(req),
    });
    return json({ ok: true, id, expira });
  }

  // ——— MEMBRUL: transferurile mele ———
  if (actiune === "ale-mele") {
    if (eu.rol !== "membru") return json({ eroare: "Doar membrii au transferuri." }, 403);
    const ale = [];
    try {
      const { blobs } = await s.list({ prefix: "transfer-dosar/" });
      for (const b of blobs) {
        const t = await s.get(b.key, { type: "json" }).catch(() => null);
        if (t && t.vanzator?.membruId === eu.membru.id)
          ale.push({ id: t.id, serie: t.serie, caine: t.caine?.nume, nou: t.nou?.nume, stare: t.stare, creat: t.creat, motivRefuz: t.raspuns?.motiv || null });
      }
    } catch (err) { console.error(err); }
    ale.sort((a, b) => String(b.creat).localeCompare(String(a.creat)));
    return json({ transferuri: ale });
  }

  // ——— MEMBRUL: anulează un transfer încă neconfirmat ———
  if (actiune === "anuleaza") {
    if (eu.rol !== "membru") return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const t = await s.get("transfer-dosar/" + id, { type: "json" }).catch(() => null);
    if (!t || t.vanzator?.membruId !== eu.membru.id) return json({ eroare: "Transfer inexistent." }, 404);
    if (t.stare !== "asteapta-confirmare")
      return json({ eroare: "Se pot anula doar transferurile aflate în așteptarea confirmării." }, 409);
    await s.setJSON("transfer-dosar/" + id, { ...t, stare: "anulat", anulat: new Date().toISOString() });
    await s.delete("transfer-serie/" + t.serie).catch(() => {});
    // Invitația rămasă moare la folosire: dosarul nu mai e în așteptare.
    await jurnalizeaza(s, {
      fapta: "transfer-anulat", actor: actorJurnal(eu), obiect: t.serie,
      detalii: `${t.caine?.nume || ""} — anulat înainte de confirmare`, ip: ipCerere(req),
    });
    return json({ ok: true });
  }

  // ——— REGISTRATURA / ADMIN: a doua cheie, apoi cozile și operarea ———
  if (!["registratura", "admin"].includes(eu.rol)) return json({ eroare: "Nepermis." }, 403);
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403, { antete: { "x-refuz-drept": "1" } });
  }

  if (actiune === "de-operat") {
    const lista = [];
    try {
      const { blobs } = await s.list({ prefix: "transfer-dosar/" });
      for (const b of blobs) {
        const t = await s.get(b.key, { type: "json" }).catch(() => null);
        if (t && (t.stare === "confirmat" || t.stare === "refuzat"))
          lista.push({ id: t.id, serie: t.serie, caine: t.caine, vanzator: t.vanzator?.nume, nou: t.nou,
            stare: t.stare, raspuns: t.raspuns, creat: t.creat,
            initiatDeCrescator: !!t.initiatDeCrescator, proprietarVechi: t.proprietarVechi?.nume || null });
      }
    } catch (err) { console.error(err); }
    lista.sort((a, b) => String(a.creat).localeCompare(String(b.creat)));
    return json({ transferuri: lista });
  }

  if (actiune === "opereaza") {
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const t = await s.get("transfer-dosar/" + id, { type: "json" }).catch(() => null);
    if (!t) return json({ eroare: "Transfer inexistent." }, 404);
    if (t.stare !== "confirmat")
      return json({ eroare: "Se operează doar transferurile CONFIRMATE de noul proprietar." }, 409);
    const cert = await s.get("pedigree/" + t.serie, { type: "json" }).catch(() => null);
    if (!cert) return json({ eroare: "Certificatul nu mai există." }, 404);
    // Certificatul poate fi anulat ÎNTRE confirmare și operare — pe un act anulat nu se scrie.
    if (cert.anulat) return json({ eroare: "Certificatul a fost între timp ANULAT — transferul nu se poate opera." }, 409);

    // URMA ÎNTÂI, ca peste tot: o schimbare de proprietar fără urmă nu se poate apăra.
    try {
      await jurnalizeazaObligatoriu(s, {
        fapta: "transfer-operat",
        actor: actorJurnal(eu),
        obiect: t.serie,
        detalii: `${t.caine?.nume || ""}: ${cert.proprietar?.nume || "—"} → ${t.nou.nume} ` +
          `(confirmat de noul proprietar la ${String(t.raspuns?.la || "").slice(0, 10)})`,
        ip: ipCerere(req),
      });
    } catch (err) {
      console.error("Jurnalul transferului a eșuat — certificatul rămâne neschimbat:", err);
      return json({ eroare: "Nu am putut consemna fapta în jurnal, deci nu am schimbat nimic. Reîncearcă." }, 503);
    }

    // Vechiul proprietar rămâne în istoricul certificatului; e-mailul NU intră pe act.
    // IDEMPOTENT: dacă o operare căzută la mijloc se reia, certificatul poartă DEJA noul
    // proprietar — a-l împinge atunci în istoric ar minți („fost" = actualul). Se împinge
    // doar proprietarul care chiar se schimbă.
    const istoric = Array.isArray(cert.istoricProprietari) ? cert.istoricProprietari : [];
    const dejaScris = String(cert.proprietar?.nume || "").trim().toLowerCase() === t.nou.nume.trim().toLowerCase();
    if (!dejaScris && cert.proprietar) istoric.push({ ...cert.proprietar, panaLa: new Date().toISOString() });
    const { email: _f, ...proprietarNou } = t.nou;
    await s.setJSON("pedigree/" + t.serie, { ...cert, proprietar: proprietarNou, istoricProprietari: istoric });
    await s.setJSON("transfer-dosar/" + id, { ...t, stare: "operat", operat: { la: new Date().toISOString(), deCatre: eu.rol === "admin" ? "administrator" : eu.registrator?.nume || "registratură" } });
    await s.delete("transfer-serie/" + t.serie).catch(() => {});

    // Vestea, ambelor părți. Un e-mail căzut nu anulează operarea.
    const numeCaine = t.caine?.nume || t.serie;
    await trimite({
      catre: t.nou.email,
      subiect: `[CFC-Royal] ${t.serie} — transferul a fost operat`,
      html: `<h2 style="margin:0 0 12px;color:#1F4D3A">Transfer operat</h2>` +
        `<p>Câinele <strong>${escapeHtml(numeCaine)}</strong> (certificat <span style="font-family:monospace">${escapeHtml(t.serie)}</span>) ` +
        `figurează de acum pe numele dumneavoastră în Registrul genealogic CFC-Royal. ` +
        `Fișa lui publică: <a href="https://cfc-royal.ro/caine/?r=${encodeURIComponent(t.serie)}">cfc-royal.ro/caine/</a></p>`,
    });
    const vanzatorEmail = (await s.get("membru/" + t.vanzator?.membruId, { type: "json" }).catch(() => null))?.email;
    if (vanzatorEmail) {
      await trimite({
        catre: vanzatorEmail,
        subiect: `[CFC-Royal] ${t.serie} — transferul a fost operat`,
        html: `<p>Transferul câinelui <strong>${escapeHtml(numeCaine)}</strong> către ${escapeHtml(t.nou.nume)} a fost operat de registratură. Evidența e la zi.</p>`,
      });
    }
    return json({ ok: true });
  }

  // ——— REGISTRATURA / ADMIN: clasează un dosar cu răspuns care NU se mai operează ———
  // Cele două fundături de până acum: refuzul rămânea veșnic în coadă (fără buton de
  // închidere), iar un transfer CONFIRMAT căruia i-a picat vânzarea nu avea nicio ieșire
  // în afară de operare — cu lacătul pe serie blocat pe vecie. Clasarea e ieșirea:
  // dosarul rămâne (e probă), coada scapă de el, seria se eliberează.
  if (actiune === "claseaza") {
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const t = await s.get("transfer-dosar/" + id, { type: "json" }).catch(() => null);
    if (!t) return json({ eroare: "Transfer inexistent." }, 404);
    if (!["confirmat", "refuzat"].includes(t.stare))
      return json({ eroare: "Se clasează doar dosarele cu răspuns (confirmate sau refuzate)." }, 409);
    const motiv = taie(body.motiv, 400);
    // Clasarea unui transfer CONFIRMAT contrazice o confirmare dată — cere motiv scris.
    if (t.stare === "confirmat" && motiv.length < 5)
      return json({ eroare: "Clasarea unui transfer confirmat cere motivul (rămâne în jurnal și pleacă părților)." }, 400);

    await jurnalizeaza(s, {
      fapta: "transfer-clasat", actor: actorJurnal(eu), obiect: t.serie,
      detalii: `${t.caine?.nume || ""} (${t.stare})` + (motiv ? ` — ${motiv}` : " — luat la cunoștință"),
      ip: ipCerere(req),
    });
    await s.setJSON("transfer-dosar/" + id, { ...t, stare: "clasat", stareaVeche: t.stare, motivClasare: motiv || null, clasat: new Date().toISOString() });
    await s.delete("transfer-serie/" + t.serie).catch(() => {});

    // La clasarea unei CONFIRMĂRI, ambele părți află — altfel cumpărătorul așteaptă un act.
    if (t.stare === "confirmat") {
      const vanzatorEmail = (await s.get("membru/" + t.vanzator?.membruId, { type: "json" }).catch(() => null))?.email;
      for (const adresa of [t.nou?.email, vanzatorEmail].filter(Boolean)) {
        await trimite({
          catre: adresa,
          subiect: `[CFC-Royal] ${t.serie} — transferul a fost clasat`,
          html: `<p>Transferul câinelui <strong>${escapeHtml(t.caine?.nume || t.serie)}</strong> a fost clasat de registratură ` +
            `și nu se va opera. Motivul:</p>` +
            `<p style="padding:10px 14px;background:#f9efef;border-left:4px solid #8c1d2f">${escapeHtml(motiv)}</p>` +
            `<p>Dacă situația se schimbă, transferul se poate iniția din nou oricând.</p>`,
        });
      }
    }
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
