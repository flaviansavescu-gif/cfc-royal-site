// registru-acces.mjs — cine intră în Registrul genealogic și cu ce drepturi.
//
// Două roluri, generate din panou (fără redeploy, revocabile oricând):
//
//   • MEMBRU (cod „MBR-…") — depune Declarația de Montă și Fătare și solicită Certificate
//     Pedigree. Dreptul NU ține de existența unei canise: îl are orice membru, cu condiția
//     ca **cotizația să fie la zi**. Afixul e opțional — cine are canisă îl primește pe
//     Certificat, cine nu are crește totuși un cuib și are dreptul la documente de origine.
//
//   • REGISTRATURĂ (cod „REG-…") — verifică dosarele, extrage ascendența pe patru generații,
//     atribuie numărul de cuib WDF și pregătește emiterea Certificatelor Tip A și B.
//
// DE CE CODURI, nu formular anonim: din DMF se nasc Certificate Pedigree. Actul însuși
// prevede verificări în teritoriu, acțiune în instanță și suspendarea celor care declară
// fals — deci fiecare declarație trebuie legată de o persoană anume, membră, cu cotizația
// achitată la data depunerii.
//
// Codul proprietarului MASCULULUI nu se cere niciodată: masculul poate aparține altei
// asociații sau unei canise din străinătate. Semnătura lui vine prin link unic pe e-mail
// (faza următoare) — altfel s-ar bloca exact montele externe, cele mai valoroase.
//
// Stocare (store „registru" — genealogia e alt domeniu decât Școala):
//   membru/<sha256(cod)>      -> { nume, afix?, nrAfix?, email, cotizatiePana, cod, creat, … }
//   registrator/<sha256(cod)> -> { nume, email, cod, creat, … }
//
// POST { cod, actiune:"intrare" }                                  -> { rol, …, dest }
// POST { cod, actiune:"membri" | "membru-adauga" | "membru-cotizatie" | "membru-sterge" }  (admin)
// POST { cod, actiune:"registratori" | "registrator-adauga" | "registrator-sterge" }       (admin)
import { getStore } from "@netlify/blobs";
import { actorDinCod, sha256 } from "./_comun/roluri.mjs";
import { cuLimitareCod, ipClient } from "./_comun/limitare.mjs";

const store = () => getStore("registru");

// Alfabet fără caractere confundabile (O/0, I/1) — codurile se dictează la telefon.
const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function codNou(prefix) {
  let c = prefix;
  for (let i = 0; i < 8; i++) c += ALFABET[Math.floor(Math.random() * ALFABET.length)];
  return c;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;
const eData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Cotizația e la zi dacă data de valabilitate nu a trecut. Ziua scadenței e inclusă. */
export function cotizatieLaZi(pana) {
  if (!pana) return false;
  return String(pana) >= new Date().toISOString().slice(0, 10);
}

/**
 * Membrul din cod, cu starea cotizației.
 * Folosit și de funcția de depunere a declarațiilor: cotizația neachitată oprește
 * depunerea, nu doar intrarea — altfel s-ar strecura declarații de la membri restanți.
 */
export async function membruDinCod(cod) {
  const c = taie(cod, 60);
  if (!c) return null;
  try {
    const x = await store().get("membru/" + sha256(c), { type: "json" });
    if (!x) return null;
    return { ...x, id: sha256(c), cotizatieLaZi: cotizatieLaZi(x.cotizatiePana) };
  } catch (err) {
    console.error("Căutare membru eșuată:", err);
    return null;
  }
}

/** Registratorul din cod — verifică dosarele și pregătește emiterea. */
export async function registratorDinCod(cod) {
  const c = taie(cod, 60);
  if (!c) return null;
  try {
    const x = await store().get("registrator/" + sha256(c), { type: "json" });
    return x ? { ...x, id: sha256(c) } : null;
  } catch (err) {
    console.error("Căutare registrator eșuată:", err);
    return null;
  }
}

/** Marchează intrarea, fără să blocheze autentificarea dacă scrierea eșuează. */
async function marcheazaIntrarea(cheie, brut) {
  try {
    const acum = new Date().toISOString();
    const x = { ...brut };
    delete x.id;
    delete x.cotizatieLaZi;
    // Codul NU se păstrează în fișă (vezi `fisaFaraCod`). Ștergerea de aici curăță și
    // fișele vechi, scrise înainte de regula asta: la prima intrare a omului, dispare.
    delete x.cod;
    if (!x.prima_logare) x.prima_logare = acum;
    x.ultima_logare = acum;
    await store().setJSON(cheie, x);
  } catch (err) { console.error("Marcarea intrării a eșuat:", err); }
}

/** O ciornă mai veche de atât e considerată abandonată. */
export const CIORNA_ABANDONATA_MS = 7 * 24 * 3600e3;

/**
 * Curăță magazia de două feluri de rămășițe:
 *   • coduri de acces rămase în fișe scrise înainte de regula de azi;
 *   • ciorne de DMF începute și nedepuse, cu fișierele lor.
 *
 * Exportată fiindcă o cheamă și copia săptămânală: o curățenie care depinde de cine
 * își aduce aminte să apese un buton nu se face niciodată. Raportează și ce a GĂSIT
 * dar n-a atins — „n-am găsit nimic" și „am găsit, dar e prea recentă" sunt lucruri
 * diferite, iar omul trebuie să știe care dintre ele e.
 */
export async function curataMagazia() {
  const s = store();
  const rezultat = {
    coduriSterse: 0, ciorneSterse: 0, fisiereSterse: 0,
    ciornePreaRecente: [], erori: [],
  };
  const FELURI = ["pedigree-mascul", "pedigree-femela", "drept-monta", "plata", "confirmare-alternativa"];

  for (const prefix of ["membru/", "registrator/"]) {
    try {
      const { blobs } = await s.list({ prefix });
      for (const b of blobs) {
        const x = await s.get(b.key, { type: "json" });
        if (!x || !x.cod) continue;
        const { cod: _sters, ...fara } = x;
        await s.setJSON(b.key, fara);
        rezultat.coduriSterse++;
      }
    } catch (err) { rezultat.erori.push(prefix + ": " + err.message); }
  }

  try {
    const { blobs } = await s.list({ prefix: "ciorna/" });
    for (const b of blobs) {
      const c = await s.get(b.key, { type: "json" });
      if (!c) continue;
      const varsta = Date.now() - Date.parse(c.creat || 0);
      if (varsta < CIORNA_ABANDONATA_MS) {
        // Prea recentă: cineva poate chiar acum completează formularul.
        rezultat.ciornePreaRecente.push({
          zile: Math.floor(varsta / 86400e3),
          de: new Date(Date.parse(c.creat) + CIORNA_ABANDONATA_MS).toISOString().slice(0, 10),
        });
        continue;
      }
      const id = b.key.slice("ciorna/".length);
      for (const fel of FELURI) {
        try {
          const are = await s.getMetadata("dmf-fisier/" + id + "/" + fel);
          if (are) { await s.delete("dmf-fisier/" + id + "/" + fel); rezultat.fisiereSterse++; }
        } catch { /* piesa nu există — normal */ }
      }
      await s.delete(b.key);
      rezultat.ciorneSterse++;
    }
  } catch (err) { rezultat.erori.push("ciorne: " + err.message); }

  return rezultat;
}

/** Cod unic cu prefixul dat. */
async function codUnic(prefix, prefixCheie) {
  for (let i = 0; i < 5; i++) {
    const c = codNou(prefix);
    const id = sha256(c);
    const exista = await store().get(prefixCheie + id, { type: "json" }).catch(() => null);
    if (!exista) return { cod: c, id };
  }
  return null;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = taie(body.actiune, 24);

  // —— Solicitarea de acces: SINGURA acțiune fără cod ——
  //
  // Cine n-are cod trebuie să poată cere unul fără să caute o adresă de e-mail pe site.
  // Se cer doar e-mailul și telefonul: atât îi trebuie secretariatului ca să sune sau să
  // scrie, iar mai mult ar fi date personale strânse degeaba, înainte să existe vreo
  // hotărâre. Codul NU se dă automat — calitatea de membru și cotizația se verifică de om.
  if (actiune === "cerere") {
    const nume = taie(body.nume, 120);
    const email = taie(body.email, 200).toLowerCase();
    const telefon = taie(body.telefon, 40);
    // Câmp-capcană: umplut înseamnă robot. Oamenii nu văd câmpul, deci nu-l completează.
    if (taie(body.website, 100)) return json({ ok: true });   // tăcere, ca robotul să nu învețe
    if (nume.length < 3) return json({ eroare: "Scrie numele și prenumele." }, 400);
    if (!EMAIL_RE.test(email)) return json({ eroare: "Scrie o adresă de e-mail validă." }, 400);
    if (telefon.replace(/\D/g, "").length < 9)
      return json({ eroare: "Scrie un număr de telefon valid." }, 400);

    const s = store();
    // Formularul e public, deci trebuie o limită: fără ea, cineva ar putea umple panoul
    // administratorului cu mii de cereri într-un minut.
    let cheieIp = null;
    try {
      cheieIp = "cerere-ip/" + sha256(ipClient(req));
      const c = await s.get(cheieIp, { type: "json" });
      const acum = Date.now();
      if (c && acum - c.de < 3600e3 && c.n >= 3)
        return json({ eroare: "Ai trimis deja mai multe solicitări. Așteaptă o oră sau scrie la contact@cfc-royal.ro." }, 429);
      await s.setJSON(cheieIp, (c && acum - c.de < 3600e3) ? { n: c.n + 1, de: c.de } : { n: 1, de: acum });
    } catch (err) { console.error("Limitarea cererilor a eșuat:", err); }

    const id = sha256(email).slice(0, 16);   // aceeași adresă = aceeași cerere, nu douăzeci
    const veche = await s.get("cerere/" + id, { type: "json" }).catch(() => null);
    await s.setJSON("cerere/" + id, {
      id, nume, email, telefon,
      mesaj: taie(body.mesaj, 500),
      creat: veche?.creat || new Date().toISOString(),
      actualizat: new Date().toISOString(),
      trimiteri: (veche?.trimiteri || 0) + 1,
    });
    return json({ ok: true });
  }

  const cod = taie(body.cod, 60);

  // —— Intrarea (membru, registratură sau administrator) ——
  if (actiune === "intrare") {
    if (!cod) return json({ eroare: "Scrie codul primit." }, 400);

    // Administratorul intră peste tot, fără să fie trecut în registru.
    if (actorDinCod(cod)?.rol === "admin")
      return json({ rol: "admin", dest: "/registru/admin/" });

    const m = await membruDinCod(cod);
    if (m) {
      await marcheazaIntrarea("membru/" + m.id, m);
      // Cotizația restantă NU blochează intrarea — omul trebuie să-și poată vedea
      // situația și dosarele. Blochează doar depunerea unei declarații noi.
      return json({
        rol: "membru", id: m.id, nume: m.nume, afix: m.afix || null, nrAfix: m.nrAfix || null,
        cotizatiePana: m.cotizatiePana || null, cotizatieLaZi: m.cotizatieLaZi,
        dest: "/crescatori/",
      });
    }

    const r = await registratorDinCod(cod);
    if (r) {
      await marcheazaIntrarea("registrator/" + r.id, r);
      return json({ rol: "registratura", id: r.id, nume: r.nume, dest: "/registru/registratura/" });
    }

    return json({ eroare: "Cod incorect." }, 401);
  }

  // —— Restul e administrare ——
  if (actorDinCod(cod)?.rol !== "admin")
    return json({ eroare: "Doar administratorul poate administra accesul la registru." }, 401);

  if (actiune === "membri" || actiune === "registratori") {
    const prefix = actiune === "membri" ? "membru/" : "registrator/";
    const lista = [];
    try {
      const { blobs } = await store().list({ prefix });
      for (const b of blobs) {
        const x = await store().get(b.key, { type: "json" });
        if (!x) continue;
        const rand = { ...x, id: b.key.slice(prefix.length) };
        if (prefix === "membru/") rand.cotizatieLaZi = cotizatieLaZi(x.cotizatiePana);
        lista.push(rand);
      }
    } catch (err) { console.error("Listare eșuată:", err); }
    lista.sort((a, b) => String(a.nume || "").localeCompare(String(b.nume || ""), "ro"));
    return json(actiune === "membri" ? { membri: lista } : { registratori: lista });
  }

  if (actiune === "membru-adauga") {
    const nume = taie(body.nume, 120);
    const email = taie(body.email, 200).toLowerCase();
    const afix = taie(body.afix, 120);            // opțional — nu orice membru are canisă
    const nrAfix = taie(body.nrAfix, 40);
    const cotizatiePana = taie(body.cotizatiePana, 10);
    if (nume.length < 3) return json({ eroare: "Scrie numele membrului." }, 400);
    // E-mailul e obligatoriu: pe el pleacă numărul de înregistrare al declarației.
    if (!EMAIL_RE.test(email)) return json({ eroare: "Scrie o adresă de e-mail validă." }, 400);
    if (!eData(cotizatiePana))
      return json({ eroare: "Scrie data până la care cotizația e achitată (AAAA-LL-ZZ)." }, 400);

    const nou = await codUnic("MBR-", "membru/");
    if (!nou) return json({ eroare: "Nu am putut genera un cod unic. Reîncearcă." }, 500);
    // Fișa NU conține codul — cheia e amprenta lui, și atât. Codul pleacă o singură dată,
    // în răspunsul ăsta, către administratorul care l-a cerut. Dacă se pierde, se
    // generează altul; nu se poate scoate înapoi din registru, și nici din copiile de
    // siguranță. Altfel amprenta n-ar apăra nimic: cine ajunge la stocare ar avea codul.
    const membru = { nume, afix, nrAfix, email, cotizatiePana, creat: new Date().toISOString() };
    await store().setJSON("membru/" + nou.id, membru);
    return json({ ok: true, membru: { ...membru, cod: nou.cod, id: nou.id, cotizatieLaZi: cotizatieLaZi(cotizatiePana) } });
  }

  // Reînnoirea cotizației — anual, fără să se schimbe codul. Altfel oamenii ar primi
  // cod nou în fiecare an, ceea ce n-are niciun rost.
  if (actiune === "membru-cotizatie") {
    const id = taie(body.id, 128);
    const cotizatiePana = taie(body.cotizatiePana, 10);
    if (!id) return json({ eroare: "Lipsește membrul." }, 400);
    if (!eData(cotizatiePana)) return json({ eroare: "Data trebuie scrisă ca AAAA-LL-ZZ." }, 400);
    const x = await store().get("membru/" + id, { type: "json" }).catch(() => null);
    if (!x) return json({ eroare: "Membru inexistent." }, 404);
    await store().setJSON("membru/" + id, { ...x, cotizatiePana });
    return json({ ok: true, cotizatiePana, cotizatieLaZi: cotizatieLaZi(cotizatiePana) });
  }

  if (actiune === "registrator-adauga") {
    const nume = taie(body.nume, 120);
    const email = taie(body.email, 200).toLowerCase();
    if (nume.length < 3) return json({ eroare: "Scrie numele persoanei." }, 400);
    if (email && !EMAIL_RE.test(email)) return json({ eroare: "Adresa de e-mail nu este validă." }, 400);

    const nou = await codUnic("REG-", "registrator/");
    if (!nou) return json({ eroare: "Nu am putut genera un cod unic. Reîncearcă." }, 500);
    const registrator = { nume, email, creat: new Date().toISOString() };   // fără cod, ca la membri
    await store().setJSON("registrator/" + nou.id, registrator);
    return json({ ok: true, registrator: { ...registrator, cod: nou.cod, id: nou.id } });
  }

  // —— Solicitările de acces, pentru administrator ——
  if (actiune === "cereri") {
    const lista = [];
    try {
      const { blobs } = await store().list({ prefix: "cerere/" });
      for (const b of blobs) {
        const x = await store().get(b.key, { type: "json" });
        if (x) lista.push(x);
      }
    } catch (err) { console.error("Listare cereri eșuată:", err); }
    lista.sort((a, b) => String(b.actualizat).localeCompare(String(a.actualizat)));
    return json({ cereri: lista });
  }

  if (actiune === "cerere-sterge") {
    const id = taie(body.id, 40);
    if (!id) return json({ eroare: "Lipsește solicitarea." }, 400);
    try { await store().delete("cerere/" + id); } catch (err) { console.error(err); }
    return json({ ok: true });
  }

  // —— Curățenie: coduri rămase în fișe și ciorne abandonate ——
  //
  // Amândouă au ieșit la iveală când am deschis prima arhivă de siguranță:
  //   • fișele scrise înainte de regula de acum păstrau codul în clar — cine ajungea la
  //     arhivă avea o intrare funcțională;
  //   • formularul DMF început și nedus până la capăt lasă ciorna și cele patru fișiere
  //     încărcate, la nesfârșit: scanuri de acte agățate de niciun dosar.
  if (actiune === "curatenie") {
    return json({ ok: true, ...(await curataMagazia()) });
  }

  if (actiune === "membru-sterge" || actiune === "registrator-sterge") {
    const id = taie(body.id, 128);
    if (!id) return json({ eroare: "Lipsește înregistrarea." }, 400);
    const prefix = actiune === "membru-sterge" ? "membru/" : "registrator/";
    try { await store().delete(prefix + id); } catch (err) { console.error(err); }
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
