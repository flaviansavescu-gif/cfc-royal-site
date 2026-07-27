// registru-dmf.mjs — Declarația de Montă și Fătare: depunere, dosar, verificare.
//
// Reproduce actul pe hârtie (4 pagini: statistica cuibului, cei doi părinți, blocurile
// de pui), cu trei deosebiri asumate:
//
//   1. UN SINGUR formular în loc de patru. Pe hârtie există variante pentru 1–2, 3–6,
//      7–10 și 10–14 pui, fiindcă rândurile sunt tipărite. Aici rândurile se adaugă
//      câte e nevoie, deci varianta nu se mai alege — și nu se mai poate greși.
//   2. MICROCIPUL PĂRINȚILOR e obligatoriu, deși actul tipărit nu-l cere. Identifică
//      reproducătorii fără echivoc; la pui rămâne opțional, fiindcă la vârsta declarării
//      de multe ori nu sunt încă cipați (actul prevede „Tatuaj sau Microcip").
//   3. NUMĂRUL DE ÎNREGISTRARE se dă pe loc, la depunere. Pe hârtie îl scria asociația
//      la primire; aici e dovada crescătorului că a depus în termen, deci trebuie să
//      plece odată cu confirmarea. Numărul WDF de cuib îl completează registratura.
//
// TERMENUL de 90 de zile de la fătare NU blochează depunerea. Peste termen dosarul se
// marchează „peste termen" și decide registratura. A bloca ar lăsa crescătorul întârziat
// fără nicio cale de a-și declara cuibul — exact invers față de scopul registrului.
//
// Stocare (store „registru"):
//   ciorna/<id>              -> { membruId, creat }        cât timp se încarcă fișierele
//   dmf/<id>                 -> declarația completă
//   dmf-membru/<mId>/<id>    -> rezumat, pentru lista membrului fără citirea tuturor
//   dmf-fisier/<id>/<fel>    -> fișierul încărcat (binar + metadate)
//   contor/dmf-<an>          -> { ultim }
//   serie/<serie>            -> marcaj de unicitate a numărului
//
// POST { cod, actiune:"ciorna-noua" }                                    (membru)
// POST { cod, actiune:"fisier", ciornaId, fel, nume, tip, continut }     (membru)
// POST { cod, actiune:"depune", ciornaId, … }                            (membru, cotizație la zi)
// POST { cod, actiune:"mele" }                                           (membru)
// POST { cod, actiune:"dosare" | "dosar" }                               (registratură/admin)
// POST { cod, actiune:"vezi-fisier", id, fel }        -> binar           (proprietar / registratură)
import { getStore } from "@netlify/blobs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { membruDinCod, registratorDinCod } from "./registru-acces.mjs";

const store = () => getStore("registru");

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;
const eData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const azi = () => new Date().toISOString().slice(0, 10);
const zileIntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Cele patru piese ale dosarului. Fără toate, declarația nu se poate depune. */
export const FELURI = {
  "pedigree-mascul": "Pedigree-ul masculului",
  "pedigree-femela": "Pedigree-ul femelei",
  "drept-monta": "Dovada dreptului de montă al femelei",
  "plata": "Dovada plății",
};

export const TERMEN_ZILE = 90;
const MAX_FISIER = 5 * 1024 * 1024;          // 5 MB per piesă, după decodare
const TIPURI_OK = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_PUI = 24;

/** Microcip ISO (15 cifre) sau cip vechi de 10. Spațiile și liniuțele se ignoră. */
export function microcipValid(v) {
  const c = String(v || "").replace(/[\s-]/g, "");
  return /^\d{15}$/.test(c) || /^\d{10}$/.test(c);
}

const idNou = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

/**
 * Număr de înregistrare unic: CFCR-DMF-<an>-<0001>.
 * Contorul singur n-ar ajunge — două depuneri simultane l-ar citi la fel. Marcajul
 * `serie/<serie>` e scris înainte de a returna numărul, deci coliziunea se vede și
 * se trece la următorul, în loc să iasă două declarații cu același număr.
 */
async function serieNoua(an) {
  const s = store();
  for (let i = 0; i < 30; i++) {
    const c = await s.get("contor/dmf-" + an, { type: "json" }).catch(() => null);
    const urm = (c?.ultim || 0) + 1;
    const serie = `CFCR-DMF-${an}-${String(urm).padStart(4, "0")}`;
    const ocupat = await s.get("serie/" + serie, { type: "json" }).catch(() => null);
    // Contorul se avansează în ambele cazuri: dacă numărul e luat, nu-l mai încercăm.
    await s.setJSON("contor/dmf-" + an, { ultim: urm });
    if (ocupat) continue;
    await s.setJSON("serie/" + serie, { rezervat: new Date().toISOString() });
    return serie;
  }
  return null;
}

/** Cine cere: membru, registratură sau administrator. */
async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  return null;
}

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Confirmarea către crescător. Eșecul ei nu anulează depunerea deja înregistrată. */
async function trimiteConfirmarea(membru, d) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) { console.error("BREVO_API_KEY lipsește — confirmarea DMF nu a plecat."); return false; }
  const html =
    `<h2 style="margin:0 0 12px;color:#1F4D3A">Declarație de Montă și Fătare înregistrată</h2>` +
    `<p style="font-size:18px;margin:0 0 4px"><strong>${esc(d.serie)}</strong></p>` +
    `<p style="color:#666;margin:0 0 18px">Depusă la ${esc(d.creat.slice(0, 10))}. Păstrează acest număr: el dovedește depunerea în termen.</p>` +
    `<table style="border-collapse:collapse;font-size:14px">` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Rasa</td><td><strong>${esc(d.rasa)}</strong></td></tr>` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Fătare</td><td>${esc(d.dataFatarii)}</td></tr>` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Pui declarați</td><td>${d.pui.length}</td></tr>` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Mamă</td><td>${esc(d.femela.nume)}</td></tr>` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Tată</td><td>${esc(d.mascul.nume)}</td></tr>` +
    `</table>` +
    (d.pesteTermen
      ? `<p style="margin:18px 0 0;padding:10px 14px;background:#f9efef;border:1px solid #8c1d2f;color:#8c1d2f;font-size:14px">` +
        `Depunerea a depășit termenul de ${TERMEN_ZILE} de zile de la fătare. Dosarul a fost înregistrat, ` +
        `dar registratura va decide dacă poate fi soluționat.</p>`
      : "") +
    `<p style="margin:18px 0 0;font-size:14px">Urmează confirmarea proprietarului masculului și verificarea dosarului de către registratură. ` +
    `Stadiul îl vezi oricând în <a href="https://cfc-royal.ro/crescatori/">spațiul tău</a>.</p>` +
    `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
    `<p style="color:#888;font-size:12px">Registrul genealogic — Asociația Club Federal Chinologic Royal · membru World Dog Federation</p>`;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Registrul genealogic CFC-Royal", email: "newsletter@cfc-royal.ro" },
        to: [{ email: membru.email }],
        subject: `[Registru] ${d.serie} — declarație înregistrată`,
        htmlContent: html,
      }),
    });
    if (!res.ok) { console.error("Brevo:", res.status, await res.text()); return false; }
    return true;
  } catch (err) { console.error("Confirmarea DMF a eșuat:", err); return false; }
}

/**
 * Validează corpul declarației. Întoarce { d } sau { eroare }.
 * Exportată ca să poată fi verificată în teste fără Blobs — aici stau regulile care
 * decid dacă un cuib intră sau nu în cartea de origini.
 */
export function valideazaDeclaratia(body, membru) {
  const rasa = taie(body.rasa, 80);
  if (rasa.length < 2) return { eroare: "Scrie rasa." };
  const varietate = taie(body.varietate, 80);

  const dataMontei = taie(body.dataMontei, 10);
  const dataFatarii = taie(body.dataFatarii, 10);
  if (!eData(dataMontei)) return { eroare: "Data montei trebuie scrisă ca AAAA-LL-ZZ." };
  if (!eData(dataFatarii)) return { eroare: "Data fătării trebuie scrisă ca AAAA-LL-ZZ." };
  if (dataMontei > dataFatarii) return { eroare: "Data montei nu poate fi după data fătării." };
  if (dataFatarii > azi()) return { eroare: "Data fătării nu poate fi în viitor." };

  const nr = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 30 ? n : null; };
  const nascutiM = nr(body.nascutiM), nascutiF = nr(body.nascutiF);
  const ramasiM = nr(body.ramasiM), ramasiF = nr(body.ramasiF);
  if (nascutiM === null || nascutiF === null || ramasiM === null || ramasiF === null)
    return { eroare: "Statistica cuibului acceptă numere întregi între 0 și 30." };
  if (nascutiM + nascutiF === 0) return { eroare: "Cuibul nu poate avea zero pui născuți." };
  if (ramasiM > nascutiM || ramasiF > nascutiF)
    return { eroare: "Nu poți avea mai mulți pui rămași pentru creștere decât născuți." };

  const parinte = (p, eticheta, cerEmail) => {
    const nume = taie(p?.nume, 120);
    if (nume.length < 2) return { eroare: `Scrie numele ${eticheta}.` };
    const pedigree = taie(p?.pedigree, 60);
    if (pedigree.length < 2) return { eroare: `Scrie numărul/seria certificatului de pedigree ${eticheta}.` };
    const microcip = taie(p?.microcip, 30).replace(/[\s-]/g, "");
    if (!microcipValid(microcip))
      return { eroare: `Microcipul ${eticheta} trebuie să aibă 15 cifre (ISO) sau 10 cifre.` };
    const dataNasterii = taie(p?.dataNasterii, 10);
    if (!eData(dataNasterii)) return { eroare: `Data nașterii ${eticheta} trebuie scrisă ca AAAA-LL-ZZ.` };
    if (dataNasterii >= dataFatarii) return { eroare: `Data nașterii ${eticheta} este ulterioară fătării.` };
    const proprietar = taie(p?.proprietar, 120);
    if (proprietar.length < 2) return { eroare: `Scrie proprietarul ${eticheta}.` };
    const email = taie(p?.email, 200).toLowerCase();
    if (cerEmail && !EMAIL_RE.test(email))
      return { eroare: "E-mailul proprietarului masculului e obligatoriu: pe el pleacă cererea de confirmare a montei." };
    if (!cerEmail && email && !EMAIL_RE.test(email)) return { eroare: `Adresa de e-mail ${eticheta} nu este validă.` };
    return {
      p: {
        nume, pedigree, microcip, dataNasterii, proprietar, email,
        palmares: taie(p?.palmares, 400),
        membruAsociatiei: taie(p?.membruAsociatiei, 120),
        adresa: taie(p?.adresa, 200),
        telefon: taie(p?.telefon, 40),
      },
    };
  };

  // E-mailul proprietarului masculului e cerut: pe el pleacă linkul de confirmare a
  // montei (faza următoare), inclusiv pentru masculi din alte asociații sau străinătate.
  const m = parinte(body.mascul, "masculului", true);
  if (m.eroare) return m;
  const f = parinte(body.femela, "femelei", false);
  if (f.eroare) return f;

  const brut = Array.isArray(body.pui) ? body.pui.slice(0, MAX_PUI) : [];
  if (brut.length !== ramasiM + ramasiF)
    return { eroare: `Ai completat ${brut.length} pui, dar statistica arată ${ramasiM + ramasiF} rămași pentru creștere.` };
  const pui = [];
  for (let i = 0; i < brut.length; i++) {
    const x = brut[i];
    const nume = taie(x?.nume, 100);
    if (nume.length < 2) return { eroare: `Scrie numele puiului ${i + 1}.` };
    const sex = taie(x?.sex, 1).toUpperCase();
    if (sex !== "M" && sex !== "F") return { eroare: `Alege sexul puiului ${i + 1}.` };
    const cump = x?.cumparator || {};
    const emailCump = taie(cump.email, 200).toLowerCase();
    if (emailCump && !EMAIL_RE.test(emailCump))
      return { eroare: `Adresa de e-mail a cumpărătorului puiului ${i + 1} nu este validă.` };
    pui.push({
      nume, sex,
      culoare: taie(x?.culoare, 60),
      varietate: taie(x?.varietate, 60),
      tipPar: taie(x?.tipPar, 60),
      // La vârsta declarării puii sunt rareori cipați — actul cere „Tatuaj sau Microcip",
      // deci câmpul rămâne liber până la aplicare.
      identificare: taie(x?.identificare, 30),
      cumparator: {
        nume: taie(cump.nume, 120), adresa: taie(cump.adresa, 200),
        localitate: taie(cump.localitate, 120), judet: taie(cump.judet, 60),
        tara: taie(cump.tara, 60), codPostal: taie(cump.codPostal, 20),
        telefon: taie(cump.telefon, 40), email: emailCump,
      },
    });
  }
  const nM = pui.filter((p) => p.sex === "M").length;
  if (nM !== ramasiM || pui.length - nM !== ramasiF)
    return { eroare: `Rândurile de pui (${nM} masculi, ${pui.length - nM} femele) nu se potrivesc cu statistica (${ramasiM} / ${ramasiF}).` };
  // Actul cere ordinea: întâi masculii, apoi femelele. O impunem noi, ca omul să nu
  // fie respins pentru ordinea rândurilor.
  pui.sort((a, b) => (a.sex === b.sex ? 0 : a.sex === "M" ? -1 : 1));

  const c = body.consimtaminte || {};
  if (!c.adn || !c.predare60 || !c.gdpr)
    return { eroare: "Toate cele trei declarații pe propria răspundere trebuie bifate." };

  const zile = zileIntre(dataFatarii, azi());
  return {
    d: {
      rasa, varietate, dataMontei, dataFatarii,
      nascutiM, nascutiF, ramasiM, ramasiF,
      mascul: m.p, femela: f.p, pui,
      consimtaminte: { adn: true, predare60: true, gdpr: true },
      afix: membru.afix || "", nrAfix: membru.nrAfix || "",
      zileDeLaFatare: zile,
      pesteTermen: zile > TERMEN_ZILE,
    },
  };
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = taie(body.actiune, 24);
  const cod = taie(body.cod, 60);
  const eu = await cine(cod);
  if (!eu) return json({ eroare: "Cod incorect." }, 401);

  const s = store();

  // —— Ciornă: deschide dosarul, ca fișierele să se încarce unul câte unul ——
  // Patru fotografii de telefon într-o singură cerere depășesc limita de mărime și
  // depunerea ar eșua exact la omul cu poze mari. Fiecare piesă merge separat.
  if (actiune === "ciorna-noua") {
    if (eu.rol !== "membru") return json({ eroare: "Doar membrii depun declarații." }, 403);
    if (!eu.membru.cotizatieLaZi)
      return json({ eroare: "Cotizația a expirat. Reînnoiește-o pentru a putea depune declarații." }, 403);
    const id = idNou();
    await s.setJSON("ciorna/" + id, { membruId: eu.membru.id, creat: new Date().toISOString() });
    return json({ ok: true, ciornaId: id });
  }

  if (actiune === "fisier") {
    if (eu.rol !== "membru") return json({ eroare: "Doar membrii încarcă piese la dosar." }, 403);
    const ciornaId = taie(body.ciornaId, 40);
    const fel = taie(body.fel, 32);
    if (!FELURI[fel]) return json({ eroare: "Piesă necunoscută." }, 400);
    const ciorna = await s.get("ciorna/" + ciornaId, { type: "json" }).catch(() => null);
    if (!ciorna || ciorna.membruId !== eu.membru.id) return json({ eroare: "Dosar inexistent." }, 404);

    const tip = taie(body.tip, 60);
    if (!TIPURI_OK.includes(tip)) return json({ eroare: "Acceptăm doar JPEG, PNG, WEBP sau PDF." }, 400);
    let date;
    try { date = Buffer.from(String(body.continut || ""), "base64"); }
    catch { return json({ eroare: "Fișier ilizibil." }, 400); }
    if (!date.length) return json({ eroare: "Fișier gol." }, 400);
    if (date.length > MAX_FISIER) return json({ eroare: "Fișierul depășește 5 MB." }, 400);

    await s.set("dmf-fisier/" + ciornaId + "/" + fel, date, {
      metadata: { nume: taie(body.nume, 160), tip, marime: date.length },
    });
    return json({ ok: true, fel, marime: date.length });
  }

  if (actiune === "depune") {
    if (eu.rol !== "membru") return json({ eroare: "Doar membrii depun declarații." }, 403);
    // Cotizația se verifică ACUM, nu la deschiderea ciornei: între timp putea expira.
    if (!eu.membru.cotizatieLaZi)
      return json({ eroare: "Cotizația a expirat. Reînnoiește-o pentru a putea depune declarații." }, 403);

    const ciornaId = taie(body.ciornaId, 40);
    const ciorna = await s.get("ciorna/" + ciornaId, { type: "json" }).catch(() => null);
    if (!ciorna || ciorna.membruId !== eu.membru.id) return json({ eroare: "Dosar inexistent." }, 404);

    const v = valideazaDeclaratia(body, eu.membru);
    if (v.eroare) return json({ eroare: v.eroare }, 400);

    // Toate cele patru piese trebuie să existe. Verificarea se face la depunere, nu la
    // încărcare: altfel un dosar incomplet ar primi număr de înregistrare.
    const lipsa = [];
    for (const fel of Object.keys(FELURI)) {
      const f = await s.getMetadata("dmf-fisier/" + ciornaId + "/" + fel).catch(() => null);
      if (!f) lipsa.push(FELURI[fel]);
    }
    if (lipsa.length) return json({ eroare: "Lipsesc de la dosar: " + lipsa.join(", ") + "." }, 400);

    const an = new Date().getFullYear();
    const serie = await serieNoua(an);
    if (!serie) return json({ eroare: "Nu am putut aloca un număr de înregistrare. Reîncearcă." }, 500);

    const d = {
      ...v.d,
      id: ciornaId, serie,
      numarWDF: null,                       // îl completează registratura la înregistrarea cuibului
      stare: "depus",
      membruId: eu.membru.id,
      membruNume: eu.membru.nume,
      membruEmail: eu.membru.email,
      creat: new Date().toISOString(),
    };
    await s.setJSON("dmf/" + ciornaId, d);
    await s.setJSON("dmf-membru/" + eu.membru.id + "/" + ciornaId, {
      id: ciornaId, serie, rasa: d.rasa, dataFatarii: d.dataFatarii,
      pui: d.pui.length, stare: d.stare, pesteTermen: d.pesteTermen, creat: d.creat,
    });
    await s.delete("ciorna/" + ciornaId).catch(() => {});

    const emailTrimis = await trimiteConfirmarea(eu.membru, d);
    return json({ ok: true, serie, id: ciornaId, pesteTermen: d.pesteTermen, emailTrimis });
  }

  if (actiune === "mele") {
    if (eu.rol !== "membru") return json({ eroare: "Nepermis." }, 403);
    const lista = [];
    try {
      const { blobs } = await s.list({ prefix: "dmf-membru/" + eu.membru.id + "/" });
      for (const b of blobs) {
        const x = await s.get(b.key, { type: "json" });
        if (x) lista.push(x);
      }
    } catch (err) { console.error("Listare declarații eșuată:", err); }
    lista.sort((a, b) => String(b.creat).localeCompare(String(a.creat)));
    return json({ declaratii: lista });
  }

  // —— Registratura și administratorul ——
  if (actiune === "dosare") {
    if (eu.rol !== "registratura" && eu.rol !== "admin") return json({ eroare: "Nepermis." }, 403);
    const lista = [];
    try {
      const { blobs } = await s.list({ prefix: "dmf/" });
      for (const b of blobs) {
        const x = await s.get(b.key, { type: "json" });
        if (!x) continue;
        lista.push({
          id: x.id, serie: x.serie, numarWDF: x.numarWDF || null, rasa: x.rasa,
          dataFatarii: x.dataFatarii, pui: (x.pui || []).length, stare: x.stare,
          pesteTermen: x.pesteTermen, membruNume: x.membruNume, creat: x.creat,
        });
      }
    } catch (err) { console.error("Listare dosare eșuată:", err); }
    lista.sort((a, b) => String(b.creat).localeCompare(String(a.creat)));
    return json({ dosare: lista });
  }

  if (actiune === "dosar") {
    const id = taie(body.id, 40);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    const alMeu = eu.rol === "membru" && d.membruId === eu.membru.id;
    if (!alMeu && eu.rol !== "registratura" && eu.rol !== "admin") return json({ eroare: "Nepermis." }, 403);
    return json({ dosar: d });
  }

  // Fișierele nu stau public: ies doar prin funcție, pentru proprietarul dosarului
  // sau pentru registratură. Pedigree-urile și dovada plății sunt date personale.
  if (actiune === "vezi-fisier") {
    const id = taie(body.id, 40);
    const fel = taie(body.fel, 32);
    if (!FELURI[fel]) return json({ eroare: "Piesă necunoscută." }, 400);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    const alMeu = eu.rol === "membru" && d.membruId === eu.membru.id;
    if (!alMeu && eu.rol !== "registratura" && eu.rol !== "admin") return json({ eroare: "Nepermis." }, 403);
    const f = await s.getWithMetadata("dmf-fisier/" + id + "/" + fel, { type: "arrayBuffer" }).catch(() => null);
    if (!f) return json({ eroare: "Piesa lipsește de la dosar." }, 404);
    return new Response(f.data, {
      headers: {
        "Content-Type": f.metadata?.tip || "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline",
      },
    });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
