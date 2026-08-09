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
import { randomInt } from "node:crypto";
import { actorDinCod, sha256 } from "./_comun/roluri.mjs";
import { poateFace, jurnalDoarAleMele, motivRefuz, ANTET_REFUZ_DREPT } from "./_comun/drepturi-registru.mjs";
import { cuLimitareCod, ipClient } from "./_comun/limitare.mjs";
import {
  jurnalizeaza, jurnalizeazaObligatoriu, ipCerere, citesteJurnal, actorExtern, FAPTE,
} from "./_comun/registru-jurnal.mjs";
import {
  dispozitivCunoscut, deschideIntrarea, confirmaIntrarea,
  opritDinMediu, OTP_MINUTE, DISPOZITIV_ZILE,
} from "./_comun/al-doilea-factor.mjs";
import { trimite, pagina, escapeHtml, ADRESA_ASOCIATIEI, postaConfigurata } from "./_comun/posta.mjs";


/**
 * CITIRE TARE, dinadins.
 *
 * Magazia răspunde, în mod obișnuit, cu o copie care poate fi veche de câteva zeci de
 * secunde. Pentru date obișnuite e un compromis bun; aici, nu. Două motive:
 *
 *   • ACCESUL. Un cod revocat citit dintr-o copie veche ar continua să deschidă
 *     registrul. O revocare care nu revocă imediat nu e o revocare.
 *   • ADEVĂRUL DIN PANOU. Administratorul completează o adresă de e-mail, lista se
 *     reîncarcă și îi arată tot starea veche — pare că sistemul i-a ignorat comanda.
 *     Exact asta s-a întâmplat la prima completare de adresă.
 *
 * Costă câteva zeci de milisecunde pe cerere. Merită.
 */
const store = () => getStore({ name: "registru", consistency: "strong" });

// Alfabet fără caractere confundabile (O/0, I/1) — codurile se dictează la telefon.
const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function codNou(prefix) {
  let c = prefix;
  for (let i = 0; i < 8; i++) c += ALFABET[randomInt(0, ALFABET.length)];
  return c;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/**
 * Adresa, arătată pe jumătate: „co•••••@cfc-royal.ro".
 * Cine intră trebuie să știe UNDE să caute codul, fără ca pagina să dea adresa întreagă
 * cuiva care abia a ghicit un cod de acces.
 */
function mascheaza(email) {
  const [nume, gazda] = String(email || "").split("@");
  if (!gazda) return "adresa asociației";
  const vizibil = nume.slice(0, 2);
  return vizibil + "•".repeat(Math.max(3, nume.length - 2)) + "@" + gazda;
}
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
      // Bucățile unei încărcări întrerupte la mijloc. Fără pasul ăsta, cine începe să urce
      // un scan de 8 MB și închide pagina lasă în magazie trei bucăți pe care nu le mai
      // caută nimeni — și care intră, cuminți, în fiecare copie de siguranță.
      try {
        const { blobs: parti } = await s.list({ prefix: "dmf-parte/" + id + "/" });
        for (const p of parti) { await s.delete(p.key); rezultat.fisiereSterse++; }
      } catch { /* nicio bucată — cazul obișnuit */ }
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

    // ANUNȚUL. Solicitarea stătea cuminte în panou și nimeni n-o vedea până când
    // administratorul se întâmpla să deschidă pagina. De partea cealaltă a ei e un om
    // care așteaptă un răspuns — și care nu are cum să insiste, fiindcă nici măcar nu
    // știe dacă a ajuns. O cerere pe care n-o vede nimeni e o cerere refuzată în tăcere.
    // Retrimiterile aceleiași adrese NU redeschid un anunț: prima dată e o veste, a
    // cincea e zgomot.
    if (!veche) {
      // Vestea pleacă la registratorii care o pot rezolva, nu doar la administrator.
      // Dacă niciunul n-are adresă în fișă, rămâne adresa asociației.
      let anuntaLa = [];
      try {
        const { blobs } = await s.list({ prefix: "registrator/" });
        for (const b of blobs) {
          const r = await s.get(b.key, { type: "json" }).catch(() => null);
          if (r && r.email) anuntaLa.push(r.email);
        }
      } catch (err) {
        console.error("Nu am putut afla cui să anunț cererea:", err);
      }
      await jurnalizeaza(s, {
        anuntaLa,
        fapta: "cerere-acces",
        actor: actorExtern(nume),
        obiect: nume,
        detalii: [email, telefon, taie(body.mesaj, 300)].filter(Boolean).join(" · "),
        ip: ipCerere(req),
      });
    }
    return json({ ok: true });
  }

  const cod = taie(body.cod, 60);
  const dispozitiv = taie(body.dispozitiv, 80);

  /**
   * Trimite codul de șase cifre și deschide intrarea în așteptare.
   * Dacă poșta nu e configurată deloc, mecanismul nu e operațional — lăsăm omul să
   * intre, dar spunem răspicat că a doua cheie lipsește. Dacă poșta E configurată și
   * totuși nu pleacă, refuzăm: e o defecțiune trecătoare, nu un motiv de a renunța
   * la apărare.
   */
  async function ceruIntrarea(rol, cine, email) {
    if (!postaConfigurata()) {
      console.error("AL DOILEA FACTOR NU E OPERAȚIONAL: lipsește BREVO_API_KEY.");
      return { ocolit: true };
    }
    const { id, otp } = await deschideIntrarea(store(), { rol, cine, email });
    const catre = email || ADRESA_ASOCIATIEI;
    const trimis = await trimite({
      catre,
      subiect: `[CFC-Royal] Cod de intrare în registru: ${otp}`,
      html: pagina("Cod de intrare", "#1F4D3A",
        `<p style="font-size:15px">Cineva intră în registru ca <strong>${escapeHtml(rol === "admin" ? "administrator" : "registratură")}</strong>` +
        (cine ? ` (${escapeHtml(cine)})` : "") + `, de pe un dispozitiv nerecunoscut.</p>` +
        `<p style="font-size:32px;letter-spacing:0.18em;font-weight:700;color:#1F4D3A;margin:18px 0">${escapeHtml(otp)}</p>` +
        `<p style="font-size:14px;color:#666">Codul e valabil ${OTP_MINUTE} minute. După confirmare, ` +
        `dispozitivul rămâne recunoscut ${DISPOZITIV_ZILE} de zile.</p>` +
        `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
        `<p style="font-size:12px;color:#888"><strong>Dacă nu ai cerut tu această intrare, cineva ` +
        `îți cunoaște codul de acces.</strong> Nu da codul mai departe și schimbă-l imediat.</p>`),
    });
    if (!trimis) {
      return { eroare: "Nu am putut trimite codul pe e-mail. Reîncearcă peste un minut." };
    }
    return { intrareId: id, catre };
  }

  // —— Intrarea (membru, registratură sau administrator) ——
  //
  // Rolurile grele trec prin a doua cheie: cod BUN + dispozitiv recunoscut. Codul se
  // dictează la telefon și se scrie pe hârtie; singur, nu mai e de ajuns pentru dosarele
  // și actele întregii asociații.
  if (actiune === "intrare") {
    if (!cod) return json({ eroare: "Scrie codul primit." }, 400);

    // Administratorul intră peste tot, fără să fie trecut în registru.
    if (actorDinCod(cod)?.rol === "admin") {
      if (await dispozitivCunoscut(store(), dispozitiv, "admin"))
        return json({ rol: "admin", dest: "/registru/admin/" });
      const r = await ceruIntrarea("admin", "administrator", ADRESA_ASOCIATIEI);
      if (r.ocolit) return json({ rol: "admin", dest: "/registru/admin/", alDoileaFactorLipsa: true });
      if (r.eroare) return json({ eroare: r.eroare }, 503);
      return json({ pas: "cod-email", intrareId: r.intrareId, catre: mascheaza(r.catre), rol: "admin" });
    }

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
      const emailLui = taie(r.email, 200);

      // A DOUA CHEIE SE CERE DOAR UNDE POATE FI LIVRATĂ OMULUI POTRIVIT.
      //
      // Prima versiune trimitea codul la adresa asociației când registratorul n-avea
      // e-mail în fișă. Pe hârtie suna a prudență („cineva de acolo îl dictează"); în
      // realitate, omul vedea pe ecran că i s-a trimis un cod la adresa altcuiva și
      // rămânea blocat, așteptând ceva ce nu putea primi. Un al doilea factor pe care
      // nu-l poți primi nu e o apărare, e o ușă zidită.
      //
      // Aceeași regulă ca la lectori: fără adresă proprie în fișă, intri doar cu codul.
      // Lipsa e VIZIBILĂ în panoul de administrare, ca să poată fi îndreptată.
      if (!emailLui || await dispozitivCunoscut(store(), dispozitiv, "registratura")) {
        await marcheazaIntrarea("registrator/" + r.id, r);
        return json({
          rol: "registratura", id: r.id, nume: r.nume, dest: "/registru/registratura/",
          // Ce poate face se spune de la intrare, ca pagina să nu ghicească și să nu
          // trebuiască să întrebe printr-o cerere respinsă. Poarta rămâne pe server.
          poateDaAcces: r.poateDaAcces === true,
          alDoileaFactorLipsa: !emailLui,
        });
      }

      const c = await ceruIntrarea("registratura", r.nume, emailLui);
      if (c.ocolit) {
        await marcheazaIntrarea("registrator/" + r.id, r);
        // Și pe calea ocolită dreptul pleacă odată cu intrarea: era singura cale care
        // îl uita, iar registratorul desemnat rămânea, în pagină, fără el.
        return json({
          rol: "registratura", id: r.id, nume: r.nume, dest: "/registru/registratura/",
          poateDaAcces: r.poateDaAcces === true, alDoileaFactorLipsa: true,
        });
      }
      if (c.eroare) return json({ eroare: c.eroare }, 503);
      return json({ pas: "cod-email", intrareId: c.intrareId, catre: mascheaza(c.catre), rol: "registratura" });
    }

    return json({ eroare: "Cod incorect." }, 401);
  }

  // —— Confirmarea codului primit pe e-mail ——
  // Nu cere codul de acces: cine a ajuns aici l-a dat deja, iar intrarea în așteptare e
  // legată de el. Cere doar cele șase cifre, care au ajuns pe altă cale decât browserul.
  if (actiune === "intrare-confirma") {
    const rez = await confirmaIntrarea(store(), taie(body.intrareId, 64), taie(body.otp, 10));
    if (rez.eroare) return json({ eroare: rez.eroare }, 401);

    await jurnalizeaza(store(), {
      fapta: "intrare-noua",
      actor: { rol: rez.rol, nume: rez.cine || (rez.rol === "admin" ? "Administrator" : "registratură") },
      obiect: rez.rol === "admin" ? "administrator" : rez.cine,
      detalii: `Dispozitiv nou recunoscut pentru ${DISPOZITIV_ZILE} de zile`,
      ip: ipCerere(req),
    });

    if (rez.rol === "admin") return json({ ok: true, rol: "admin", dispozitiv: rez.jeton, dest: "/registru/admin/" });
    const r = await registratorDinCod(cod);
    if (r) await marcheazaIntrarea("registrator/" + r.id, r);
    return json({
      ok: true, rol: "registratura", dispozitiv: rez.jeton,
      id: r?.id || null, nume: r?.nume || rez.cine, dest: "/registru/registratura/",
      // Și pe calea cu a doua cheie: altfel registratorul care intră de pe un dispozitiv
      // nou ar rămâne, în pagină, fără dreptul pe care serverul i-l recunoaște.
      poateDaAcces: r?.poateDaAcces === true,
    });
  }

  // —— Restul e administrare ——
  //
  // Poarta cere AMÂNDOUĂ cheile. O apărare pusă doar la pagina de intrare ar fi teatru:
  // cine are codul cheamă funcția direct și n-a văzut niciodată pagina.
  //
  // Nu mai e „doar administratorul": munca de secretariat — cererile de acces, codurile
  // de membru, cotizația — s-a mutat la registratură, care are datele pe care se sprijină.
  // Cine ce poate face stă în _comun/drepturi-registru.mjs, ca tabel citibil dintr-o
  // privire; aici doar îl consultăm.
  let eu = null;
  if (actorDinCod(cod)?.rol === "admin") {
    eu = { rol: "admin", nume: "Administrator" };
  } else {
    const r = await registratorDinCod(cod);
    if (r) {
      eu = {
        rol: "registratura",
        nume: r.nume || "Registratură",
        id: r.id,
        // Dreptul de a da acces e al unui singur registrator, pus de administrator pe
        // fișa lui. Ceilalți lucrează dosarele, dar nu deschid uși.
        poateDaAcces: r.poateDaAcces === true,
      };
    }
  }
  if (!eu) return json({ eroare: "Nu ai drept de administrare a accesului la registru." }, 401);
  if (!(await dispozitivCunoscut(store(), dispozitiv, eu.rol)))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);
  if (!poateFace(actiune, eu)) {
    return new Response(JSON.stringify({ eroare: motivRefuz(actiune, eu) }), {
      status: 403,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        [ANTET_REFUZ_DREPT]: "1",
      },
    });
  }

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
    // Dreptul curent pleacă odată cu lista: altfel bifa pusă azi de administrator
    // s-ar vedea abia după ce registratorul iese și intră din nou în registru.
    return json(actiune === "membri"
      ? { membri: lista, poateDaAcces: eu.rol === "admin" || eu.poateDaAcces === true }
      : { registratori: lista });
  }

  /**
   * Închide solicitarea venită de la aceeași adresă, dacă există.
   *
   * Generarea codului ESTE răspunsul la solicitare — a le ține separate înseamnă că
   * administratorul face lucrul de două ori și că lista de așteptare minte: arată
   * oameni care au primit deja ce au cerut. Legătura se face pe adresa de e-mail,
   * fiindcă tot pe ea e construit și identificatorul cererii.
   *
   * Dacă adresa din formular diferă de cea din solicitare (o corectură de tastare, de
   * pildă), cererea rămâne — nu avem cum să ghicim că e vorba de același om, iar o
   * ștergere greșită ar face să dispară o cerere neonorată.
   */
  async function inchideSolicitarea(email) {
    try {
      const idCerere = sha256(email).slice(0, 16);
      const c = await store().get("cerere/" + idCerere, { type: "json" });
      if (!c) return null;
      await store().delete("cerere/" + idCerere);
      return c.nume || email;
    } catch (err) {
      // Codul s-a generat deja; o solicitare rămasă în listă e o supărare, nu o pagubă.
      console.error("Închiderea solicitării a eșuat:", err);
      return null;
    }
  }

  /**
   * Trimite un cod proaspăt generat, pe e-mail, LA ALEGEREA administratorului.
   *
   * Nu se face automat la generare: transmiterea personală rămâne varianta implicită,
   * fiindcă un cod ajuns în cutia poștală rămâne acolo, în clar, pentru totdeauna.
   * Butonul e pentru cazurile în care e mai comod — iar de azi un cod furat din e-mail
   * nu mai e singur de ajuns pentru rolurile grele, fiindcă există a doua cheie.
   *
   * DOUĂ REGULI STRICTE, altfel acțiunea ar deveni „trimite orice text oriunde":
   *   1. Codul trebuie să existe cu adevărat în registru. Se caută după amprenta lui;
   *      dacă nu e al nimănui, nu plecă nimic.
   *   2. Destinatarul NU vine din cerere, ci din fișa găsită. Adresa scrisă de client
   *      nici măcar nu se citește.
   */
  if (actiune === "trimite-cod") {
    const codNou = taie(body.codNou, 60);
    if (!codNou) return json({ eroare: "Lipsește codul." }, 400);

    const m = await membruDinCod(codNou);
    const r = m ? null : await registratorDinCod(codNou);
    const cine = m || r;
    if (!cine) return json({ eroare: "Codul nu aparține niciunei fișe din registru." }, 404);

    const catre = taie(cine.email, 200);
    if (!catre) {
      return json({ eroare: "Persoana nu are e-mail în fișă — completează-l întâi." }, 400);
    }

    const eMembru = !!m;
    const corp =
      `<p style="font-size:15px">Bună ziua, <strong>${escapeHtml(cine.nume)}</strong>!</p>` +
      `<p style="font-size:15px">Ați primit acces la Registrul genealogic al Asociației ` +
      `Club Federal Chinologic – Royal.</p>` +
      `<table style="border-collapse:collapse;font-size:15px;margin:18px 0">` +
      `<tr><td style="padding:4px 14px 4px 0;color:#666">Adresa</td>` +
      `<td><a href="https://cfc-royal.ro/registru/">cfc-royal.ro/registru/</a></td></tr>` +
      `<tr><td style="padding:4px 14px 4px 0;color:#666">Codul dumneavoastră</td>` +
      `<td style="font-family:monospace;font-size:19px;font-weight:700;letter-spacing:0.06em;` +
      `color:#1F4D3A">${escapeHtml(codNou)}</td></tr>` +
      `</table>` +
      (eMembru
        ? `<p style="font-size:15px">Cu el depuneți <strong>Declarația de Montă și Fătare</strong> ` +
          `direct din cont, primiți numărul de înregistrare pe loc, urmăriți stadiul dosarului ` +
          `și solicitați Certificatele de Origine pentru pui.</p>` +
          (cine.cotizatiePana
            ? `<p style="font-size:14px;color:#666">Depunerea declarațiilor este posibilă cât timp ` +
              `cotizația este la zi — la dumneavoastră, până la ` +
              `<strong>${escapeHtml(cine.cotizatiePana)}</strong>.</p>`
            : "")
        : `<p style="font-size:15px">La prima intrare de pe un calculator sau telefon nou veți primi ` +
          `pe e-mail un cod de șase cifre, de confirmare. Îl scrieți și gata — dispozitivul rămâne ` +
          `recunoscut 30 de zile.</p>` +
          `<p style="font-size:15px">Cu acest acces verificați dosarele depuse, completați ascendența, ` +
          `atribuiți numărul de cuib WDF și pregătiți emiterea certificatelor.</p>`) +
      `<hr style="margin:22px 0;border:none;border-top:1px solid #ddd">` +
      `<p style="font-size:13px;color:#666"><strong>Codul este personal.</strong> Vă rugăm să nu îl ` +
      `transmiteți mai departe — cu el se lucrează în registru în numele dumneavoastră.</p>` +
      `<p style="font-size:13px;color:#666">Nu poate fi recuperat dacă se pierde: nu se păstrează ` +
      `nicăieri în sistem. Dacă se întâmplă, scrieți-ne și generăm altul.</p>`;

    const trimis = await trimite({
      catre,
      subiect: "Accesul dumneavoastră la Registrul genealogic CFC-Royal",
      html: pagina("Acces la Registrul genealogic", "#1F4D3A", corp),
    });
    if (!trimis) return json({ eroare: "Nu am putut trimite e-mailul. Reîncearcă peste un minut." }, 503);

    await jurnalizeaza(store(), {
      fapta: "cod-trimis",
      actor: { rol: eu.rol, nume: eu.nume },
      obiect: cine.nume,
      detalii: `Cod de ${eMembru ? "membru" : "registratură"} trimis la ${catre}`,
      ip: ipCerere(req),
    });
    return json({ ok: true, catre: mascheaza(catre) });
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
    const inchisa = await inchideSolicitarea(email);
    // Codul NU se scrie în jurnal — doar faptul că s-a generat unul, și pentru cine.
    await jurnalizeaza(store(), {
      fapta: "cod-generat",
      actor: { rol: eu.rol, nume: eu.nume },
      obiect: nume,
      detalii: `Acces de membru pentru ${email}` + (afix ? `, afix ${afix}` : "") +
        `, cotizație până la ${cotizatiePana}` +
        (inchisa ? ` — închide solicitarea lui ${inchisa}` : ""),
      ip: ipCerere(req),
    });
    return json({
      ok: true, solicitareInchisa: !!inchisa,
      membru: { ...membru, cod: nou.cod, id: nou.id, cotizatieLaZi: cotizatieLaZi(cotizatiePana) },
    });
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
    await jurnalizeaza(store(), {
      fapta: "cotizatie-actualizata",
      actor: { rol: eu.rol, nume: eu.nume },
      obiect: x.nume,
      detalii: `Cotizație până la ${cotizatiePana}` + (x.cotizatiePana ? ` (era ${x.cotizatiePana})` : ""),
      ip: ipCerere(req),
    });
    return json({ ok: true, cotizatiePana, cotizatieLaZi: cotizatieLaZi(cotizatiePana) });
  }

  // Completarea adresei unui registrator deja existent — PORNEȘTE a doua cheie pentru
  // el, fără să-i schimbe codul. Fără asta, singura cale ar fi fost ștergerea și
  // regenerarea codului, adică exact operațiunea care l-a blocat prima dată.
  if (actiune === "registrator-email") {
    const id = taie(body.id, 128);
    const email = taie(body.email, 200).toLowerCase();
    if (!id) return json({ eroare: "Lipsește persoana." }, 400);
    if (!EMAIL_RE.test(email)) return json({ eroare: "Scrie o adresă de e-mail validă." }, 400);
    const x = await store().get("registrator/" + id, { type: "json" }).catch(() => null);
    if (!x) return json({ eroare: "Registrator inexistent." }, 404);
    await store().setJSON("registrator/" + id, { ...x, email });
    await jurnalizeaza(store(), {
      fapta: "cod-generat",
      actor: { rol: eu.rol, nume: eu.nume },
      obiect: x.nume,
      detalii: `Adresă de e-mail completată (${email}) — al doilea factor pornit pentru registratură`,
      ip: ipCerere(req),
    });
    return json({ ok: true, email });
  }

  // Dreptul unui registrator de a genera coduri de membru. Se pune și se ia DOAR de
  // administrator — de aceea nu e în lista acțiunilor registraturii.
  if (actiune === "registrator-acces") {
    const id = taie(body.id, 80);
    const cheie = "registrator/" + id;
    const r = await store().get(cheie, { type: "json" });
    if (!r) return json({ eroare: "Registratorul nu există." }, 404);
    const poate = body.poateDaAcces === true;
    await store().setJSON(cheie, { ...r, poateDaAcces: poate });
    await jurnalizeaza(store(), {
      fapta: poate ? "cod-generat" : "cod-sters",
      actor: { rol: eu.rol, nume: eu.nume },
      obiect: r.nume,
      detalii: poate
        ? "I s-a dat dreptul de a genera coduri de acces pentru membri"
        : "I s-a retras dreptul de a genera coduri de acces pentru membri",
      ip: ipCerere(req),
    });
    return json({ ok: true, poateDaAcces: poate });
  }

  if (actiune === "registrator-adauga") {
    const nume = taie(body.nume, 120);
    const email = taie(body.email, 200).toLowerCase();
    if (nume.length < 3) return json({ eroare: "Scrie numele persoanei." }, 400);
    // E-mailul e OBLIGATORIU de acum: acolo pleacă codul de șase cifre al celui de-al
    // doilea factor. Fără el, persoana ar intra doar cu codul — ceea ce se poate, dar
    // trebuie să fie o excepție moștenită, nu o alegere făcută din neatenție la un
    // câmp marcat „opțional".
    if (!EMAIL_RE.test(email))
      return json({ eroare: "Scrie adresa de e-mail: acolo pleacă codul de confirmare la fiecare intrare de pe un dispozitiv nou." }, 400);

    const nou = await codUnic("REG-", "registrator/");
    if (!nou) return json({ eroare: "Nu am putut genera un cod unic. Reîncearcă." }, 500);
    const registrator = { nume, email, creat: new Date().toISOString() };   // fără cod, ca la membri
    await store().setJSON("registrator/" + nou.id, registrator);
    const inchisa = await inchideSolicitarea(email);
    await jurnalizeaza(store(), {
      fapta: "cod-generat",
      actor: { rol: eu.rol, nume: eu.nume },
      obiect: nume,
      detalii: `Acces de REGISTRATURĂ pentru ${email}` +
        (inchisa ? ` — închide solicitarea lui ${inchisa}` : ""),
      ip: ipCerere(req),
    });
    return json({ ok: true, solicitareInchisa: !!inchisa, registrator: { ...registrator, cod: nou.cod, id: nou.id } });
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
    const x = await store().get("cerere/" + id, { type: "json" }).catch(() => null);
    try {
      await jurnalizeazaObligatoriu(store(), {
        fapta: "cerere-stearsa",
        actor: { rol: eu.rol, nume: eu.nume },
        obiect: x?.nume || id,
        detalii: x ? `Solicitare de acces (${x.email || "fără e-mail"}${x.telefon ? ", " + x.telefon : ""})` : "Solicitare inexistentă la ștergere",
        ip: ipCerere(req),
      });
    } catch (err) {
      console.error("Jurnalul nu a putut fi scris; ștergerea a fost oprită:", err);
      return json({ eroare: "Nu am putut consemna ștergerea în jurnal, deci nu am șters nimic." }, 503);
    }
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
    const raport = await curataMagazia();
    await jurnalizeaza(store(), {
      fapta: "magazie-curatata",
      actor: { rol: eu.rol, nume: eu.nume },
      obiect: "magazia registrului",
      detalii: `Coduri rămase curățate: ${raport.coduriSterse ?? 0}; ciorne șterse: ${raport.ciorneSterse ?? 0}; ` +
        `fișiere șterse: ${raport.fisiereSterse ?? 0}; ciorne prea recente: ${(raport.ciornePreaRecente || []).length}`,
      ip: ipCerere(req),
    });
    return json({ ok: true, ...raport });
  }

  // —— Jurnalul de audit ——
  // Se citește pe luni: peste ani, „ce s-a întâmplat ieri" nu trebuie să însemne
  // încărcarea întregului istoric al registrului.
  if (actiune === "jurnal") {
    // Registratura își vede faptele ei, nu tot registrul. Filtrul e pe AUTOR, exact,
    // și se pune aici — nu poate fi înlocuit din cerere.
    const doarAleMele = jurnalDoarAleMele(eu);
    return json({
      ...(await citesteJurnal(store(), {
        luna: taie(body.luna, 7),
        fapta: taie(body.fapta, 40),
        cauta: taie(body.cauta, 80),
        actor: doarAleMele ? eu.nume : null,
        limita: Number(body.limita) || 200,
      })),
      doarAleMele,
    });
  }

  if (actiune === "jurnal-fapte") return json({ fapte: FAPTE });

  // —— Starea sistemului ——
  // Raportul lăsat de funcția programată `monitor-flux`. Se citește, nu se rulează
  // de aici: verificarea are ritmul ei, iar panoul doar arată ce a găsit.
  if (actiune === "monitor") {
    const stare = await store().get("monitor/stare", { type: "json" }).catch(() => null);
    return json({ monitor: stare || null });
  }

  if (actiune === "membru-sterge" || actiune === "registrator-sterge") {
    const id = taie(body.id, 128);
    if (!id) return json({ eroare: "Lipsește înregistrarea." }, 400);
    const prefix = actiune === "membru-sterge" ? "membru/" : "registrator/";
    const x = await store().get(prefix + id, { type: "json" }).catch(() => null);
    // Revocarea unui acces se consemnează ÎNAINTE. Dacă jurnalul nu poate fi scris,
    // nu revocăm: altfel nu s-ar mai ști cine avea acces și de când nu mai are.
    try {
      await jurnalizeazaObligatoriu(store(), {
        fapta: "cod-sters",
        actor: { rol: eu.rol, nume: eu.nume },
        obiect: x?.nume || id,
        detalii: (actiune === "membru-sterge" ? "Acces de membru revocat" : "Acces de registratură revocat") +
          (x?.email ? ` (${x.email})` : ""),
        ip: ipCerere(req),
      });
    } catch (err) {
      console.error("Jurnalul nu a putut fi scris; revocarea a fost oprită:", err);
      return json({ eroare: "Nu am putut consemna revocarea în jurnal, deci nu am șters nimic." }, 503);
    }
    try { await store().delete(prefix + id); } catch (err) { console.error(err); }
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
