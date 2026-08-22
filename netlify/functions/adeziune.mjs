// adeziune.mjs — cererea de adeziune ca membru, depusă pe site-ul propriu.
//
// GOLUL PE CARE ÎL ASTUPĂ. Până azi, „Devino membru" trimitea la un formular Google
// și la dovada plății pe WhatsApp — datele personale ale candidaților la calitatea de
// membru treceau printr-un serviciu străin, nepotrivit cu cadrul GDPR al Asociației.
//
// CE FACE și CE NU FACE. Aici se DEPUNE cererea și se ține coada ei. Hotărârea rămâne
// cea din Regulamentul intern Art. 15: Secretariatul verifică (15 zile), Consiliul
// Director avizează (art. 19 din Statut), Adunarea Generală hotărăște. Stările cererii
// oglindesc exact acest drum; nimic nu se decide automat.
//
// Stocare (store „registru"):
//   adeziune/<id>        -> cererea, cu starea ei
//   adeziune-dovada/<id> -> dovada plății taxei de înscriere (opțională la depunere)
//
// POST { actiune:"depune", nume, email, telefon, localitate, judet, mesaj?, student?,
//        acordGdpr:true, amCititActele:true, dovada?, dovadaTip? }          PUBLIC
// POST { cod, dispozitiv, actiune:"lista" }                                 (registratură/admin)
// POST { cod, dispozitiv, actiune:"stare", id, stare, motiv? }              (registratură/admin)
// POST { cod, dispozitiv, actiune:"dovada", id }                            (registratură/admin)
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeaza, actorExtern, ipCerere } from "./_comun/registru-jurnal.mjs";
import { eRobot, limiteazaTrimiterile, minuteText, amprentaIp } from "./_comun/formular-public.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import { trimite, escapeHtml } from "./_comun/posta.mjs";
import { refuzaDacaInchis } from "./_comun/poarta-scrieri.mjs";
import { json } from "./_comun/raspuns.mjs";

const store = () => getStore({ name: "registru", consistency: "strong" });
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const idNou = () => randomBytes(12).toString("hex");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Textul acordului — o singură sursă, cu versiune: la o reclamație trebuie să putem
 *  arăta nu doar CĂ omul a bifat, ci CE a bifat (ca la buletin). */
export const TEXT_ACORD_ADEZIUNE =
  "Sunt de acord ca datele mele din această cerere să fie prelucrate de Asociația Club " +
  "Federal Chinologic – Royal în scopul soluționării cererii de adeziune și, în caz de " +
  "admitere, al ținerii Registrului membrilor, potrivit politicii de confidențialitate.";
export const VERSIUNE_ACORD_ADEZIUNE = "2026-08-20";

const MAX_DOVADA = 4 * 1024 * 1024;   // ca la înscrierea la expoziții
const TIPURI_DOVADA = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const STARI = ["noua", "verificata", "avizata", "admisa", "respinsa"];

/** Adresele registratorilor, pentru anunțul din jurnal. */
async function adreseleRegistraturii(s) {
  const adrese = [];
  try {
    const { blobs } = await s.list({ prefix: "registrator/" });
    for (const b of blobs) {
      const r = await s.get(b.key, { type: "json" }).catch(() => null);
      if (r?.email) adrese.push(r.email);
    }
  } catch (err) { console.error(err); }
  return adrese;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 24);

  // ——— PUBLIC: depunerea cererii ———
  if (actiune === "depune") {
    { const oprit = await refuzaDacaInchis(json); if (oprit) return oprit; }
    if (eRobot(body)) return json({ ok: true, id: "—" });   // succes prefăcut, ca la expo

    const s = store();
    const lim = await limiteazaTrimiterile(s, "adeziune-ip", req, { max: 3, fereastraMs: 3600e3 });
    if (!lim.permis)
      return json({ eroare: `Ai trimis deja mai multe cereri în ultima oră. Mai încearcă peste ${minuteText(lim.dupaSecunde)}.` }, 429);

    const c = {
      nume: taie(body.nume, 120),
      email: taie(body.email, 200).toLowerCase(),
      telefon: taie(body.telefon, 40),
      localitate: taie(body.localitate, 120),
      judet: taie(body.judet, 60),
      mesaj: taie(body.mesaj, 600),
      student: !!body.student,
    };
    if (c.nume.length < 3) return json({ eroare: "Scrie numele complet." }, 400);
    if (!EMAIL_RE.test(c.email)) return json({ eroare: "Scrie o adresă de e-mail validă." }, 400);
    if (c.telefon.length < 6) return json({ eroare: "Scrie un număr de telefon." }, 400);
    if (!c.localitate) return json({ eroare: "Scrie localitatea." }, 400);
    if (body.acordGdpr !== true)
      return json({ eroare: "Cererea nu se poate depune fără acordul de prelucrare a datelor." }, 400);
    if (body.amCititActele !== true)
      return json({ eroare: "Confirmă că ai citit Statutul și Codul Etic." }, 400);

    // Dovada plății taxei de înscriere — opțională la depunere (se poate trimite și după).
    let areDovada = false;
    if (body.dovada) {
      const tip = taie(body.dovadaTip, 60);
      if (!TIPURI_DOVADA.includes(tip)) return json({ eroare: "Dovada poate fi JPG, PNG, WebP sau PDF." }, 400);
      if (String(body.dovada).length > MAX_DOVADA * 1.4)
        return json({ eroare: "Dovada depășește 4 MB." }, 400);
      areDovada = true;
    }

    const id = idNou();
    const cerere = {
      id, ...c,
      stare: "noua",
      creat: new Date().toISOString(),
      areDovada,
      acord: { text: TEXT_ACORD_ADEZIUNE, versiune: VERSIUNE_ACORD_ADEZIUNE, la: new Date().toISOString(), ipAmprenta: amprentaIp(req) },
      istoric: [{ stare: "noua", la: new Date().toISOString() }],
    };
    // Dovada se scrie ÎNTÂI: altfel o scriere căzută lăsa cererea „cu dovadă" și dovada 404.
    if (areDovada) await s.setJSON("adeziune-dovada/" + id, { continut: String(body.dovada), tip: taie(body.dovadaTip, 60) });
    await s.setJSON("adeziune/" + id, cerere);

    // Vestea pleacă la registratori (fapta e în FAPTE_DE_ANUNTAT).
    await jurnalizeaza(s, {
      anuntaLa: await adreseleRegistraturii(s),
      fapta: "adeziune-depusa",
      actor: actorExtern(c.nume),
      obiect: c.nume,
      detalii: [c.email, c.telefon, c.localitate + (c.judet ? ", " + c.judet : ""),
        areDovada ? "cu dovada plății" : "fără dovadă încă", c.student ? "student" : ""].filter(Boolean).join(" · "),
      ip: ipCerere(req),
    });

    await trimite({
      catre: c.email,
      subiect: "[CFC-Royal] Cererea ta de adeziune a fost primită",
      html:
        `<h2 style="margin:0 0 12px;color:#1F4D3A">Cererea de adeziune a fost primită</h2>` +
        `<p>Bună${c.nume ? ", " + escapeHtml(c.nume.split(" ")[0]) : ""},</p>` +
        `<p>Cererea ta de a deveni membru al Asociației Club Federal Chinologic – Royal a fost înregistrată. Drumul ei, potrivit Statutului:</p>` +
        `<ol><li>Secretariatul verifică cererea (cel mult 15 zile);</li>` +
        `<li>Consiliul Director dă avizul;</li>` +
        `<li>Adunarea Generală hotărăște primirea.</li></ol>` +
        (areDovada ? "" : `<p><strong>De reținut:</strong> taxa de înscriere se achită prin transfer bancar; ne poți trimite dovada la contact@cfc-royal.ro, dacă nu ai atașat-o.</p>`) +
        `<p>Îți vom scrie la fiecare pas. Bine ai venit pe drum!</p>` +
        `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
        `<p style="color:#888;font-size:12px">Asociația Club Federal Chinologic – Royal · cfc-royal.ro · membru World Dog Federation</p>`,
    });

    return json({ ok: true, id });
  }

  // ——— REGISTRATURA / ADMIN ———
  const cod = taie(body.cod, 60);
  const eAdmin = actorDinCod(cod)?.rol === "admin";
  const registrator = eAdmin ? null : await registratorDinCod(cod);
  if (!eAdmin && !registrator) return json({ eroare: "Cod incorect." }, 401);
  const s = store();
  if (!(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eAdmin ? "admin" : "registratura")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);

  if (actiune === "lista") {
    const cereri = [];
    try {
      const { blobs } = await s.list({ prefix: "adeziune/" });
      for (const b of blobs) {
        const c = await s.get(b.key, { type: "json" }).catch(() => null);
        if (c) cereri.push({ id: c.id, nume: c.nume, email: c.email, telefon: c.telefon,
          localitate: c.localitate, judet: c.judet, mesaj: c.mesaj, student: c.student,
          stare: c.stare, creat: c.creat, areDovada: c.areDovada, motiv: c.motiv || null });
      }
    } catch (err) { console.error(err); }
    // Cele nehotărâte primele, apoi cronologic.
    const rang = (st) => (st === "admisa" || st === "respinsa" ? 1 : 0);
    cereri.sort((a, b) => rang(a.stare) - rang(b.stare) || String(a.creat).localeCompare(String(b.creat)));
    return json({ cereri });
  }

  if (actiune === "stare") {
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const stare = taie(body.stare, 20);
    if (!STARI.includes(stare) || stare === "noua") return json({ eroare: "Stare necunoscută." }, 400);
    const c = await s.get("adeziune/" + id, { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Cerere inexistentă." }, 404);
    // Drumul statutar nu curge înapoi și nu sare peste secretariat (Art. 15). Fără hartă,
    // un dublu-clic trimitea două e-mailuri de bun venit, iar un apel direct putea împinge
    // o cerere ADMISĂ înapoi în „verificată".
    const TRANZITII = {
      noua: ["verificata"],
      verificata: ["avizata", "admisa", "respinsa"],
      avizata: ["admisa", "respinsa"],
      admisa: [], respinsa: [],
    };
    if (!(TRANZITII[c.stare] || []).includes(stare))
      return json({ eroare: `Din starea „${c.stare}" nu se poate trece în „${stare}".` }, 409);
    const motiv = taie(body.motiv, 400);
    if (stare === "respinsa" && motiv.length < 5)
      return json({ eroare: "Scrie motivul respingerii — omul îl va primi pe e-mail." }, 400);
    const istoric = Array.isArray(c.istoric) ? c.istoric : [];
    istoric.push({ stare, la: new Date().toISOString(), motiv: motiv || undefined });
    // Motivul unei respingeri vechi nu rămâne lipit de o cerere re-judecată.
    await s.setJSON("adeziune/" + id, { ...c, stare, motiv: stare === "respinsa" ? motiv : null, istoric });

    // Primirea unui membru e act statutar — hotărârea lasă urmă, ca la toate suratele ei.
    await jurnalizeaza(s, {
      fapta: "adeziune-hotarare",
      actor: { rol: eAdmin ? "admin" : "registratura", nume: eAdmin ? "Administrator" : registrator?.nume || "registratură" },
      obiect: c.nume,
      detalii: `${c.stare} → ${stare}` + (motiv ? ` — ${motiv}` : ""),
      ip: ipCerere(req),
    });

    if (stare === "respinsa") {
      await trimite({
        catre: c.email,
        subiect: "[CFC-Royal] Cererea ta de adeziune",
        html: `<p>Bună, ${escapeHtml(c.nume)},</p><p>Cererea ta de adeziune nu a putut fi aprobată. Motivul:</p>` +
          `<p style="padding:10px 14px;background:#f9efef;border-left:4px solid #8c1d2f">${escapeHtml(motiv)}</p>` +
          `<p>Poți depune o nouă cerere oricând situația se schimbă. Cu bine!</p>`,
      });
    }
    if (stare === "admisa") {
      await trimite({
        catre: c.email,
        subiect: "[CFC-Royal] Bine ai venit — cererea ta a fost admisă",
        html: `<p>Bună, ${escapeHtml(c.nume)},</p><p>Cererea ta de adeziune a fost <strong>admisă</strong>. ` +
          `Urmează să primești, separat, codul tău de membru pentru Registrul genealogic. Bine ai venit în asociație!</p>`,
      });
    }
    return json({ ok: true, stare });
  }

  if (actiune === "dovada") {
    const id = taie(body.id, 40);
    if (!segmentCheieValid(id)) return json({ eroare: "Referință invalidă." }, 400);
    const d = await s.get("adeziune-dovada/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Nu există dovadă atașată." }, 404);
    return json({ dovada: d.continut, tip: d.tip });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
