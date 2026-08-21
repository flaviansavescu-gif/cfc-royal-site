// stare-ecosistem.mjs — tabloul de stare al administratorului: tot ce contează,
// dintr-o privire, plus comutatorul de urgență al scrierilor publice.
//
// DE CE. Sănătatea sistemului venea pe bucăți: alertele monitorului pe e-mail, raportul
// paznicului lunea, inimile ca JSON gol pe ecran, copiile în jurnalele Netlify. Aici se
// adună tot — și, partea „adaptivă": COZILE care așteaptă decizia omului (dosare DMF,
// cereri de canisă, înscrieri neimportate, cereri GDPR).
//
// Doar pentru administrator (cod + a doua cheie), ca restul panourilor grele.
//
// POST { cod, dispozitiv }                                -> starea întreagă
// POST { cod, dispozitiv, actiune:"poarta-inchide", motiv } -> închide scrierile publice
// POST { cod, dispozitiv, actiune:"poarta-deschide" }       -> le redeschide
import { getStore } from "@netlify/blobs";
import { esteAdmin } from "./_comun/roluri.mjs";
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { judecaInimile, citesteInimile, INIMI } from "./_comun/inima.mjs";
import { starePoarta, CHEIE_POARTA } from "./_comun/poarta-scrieri.mjs";
import { jurnalizeazaObligatoriu, ipCerere } from "./_comun/registru-jurnal.mjs";
import { PREFIX_CERERI } from "./_comun/canise.mjs";
import { json } from "./_comun/raspuns.mjs";

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

/** Numără elementele unui prefix care trec de o judecată, citind fiecare blob. */
async function numara(s, prefix, judeca) {
  try {
    const { blobs } = await s.list({ prefix });
    let n = 0;
    for (const b of blobs) {
      const x = await s.get(b.key, { type: "json" }).catch(() => null);
      if (x && judeca(x)) n++;
    }
    return n;
  } catch (err) {
    console.error(`Numărătoarea „${prefix}" a eșuat:`, err?.message || err);
    return null; // null = „nu s-a putut număra", deosebit de 0 = „nimic în așteptare"
  }
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  if (!esteAdmin(taie(body.cod, 60))) return json({ eroare: "Cod de administrator incorect." }, 401);
  const registru = getStore({ name: "registru", consistency: "strong" });
  if (!(await dispozitivCunoscut(registru, taie(body.dispozitiv, 80), "admin")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);

  const acces = getStore("acces");
  const actiune = taie(body.actiune, 24);

  // ——— Comutatorul de urgență ———
  if (actiune === "poarta-inchide" || actiune === "poarta-deschide") {
    const inchide = actiune === "poarta-inchide";
    const motiv = taie(body.motiv, 200);
    // Urma se scrie ÎNTÂI, ca peste tot: o închidere a registrului fără urmă în jurnal
    // nu se poate apăra. Dacă jurnalul cade, comutatorul rămâne cum era.
    try {
      await jurnalizeazaObligatoriu(registru, {
        fapta: inchide ? "poarta-inchisa" : "poarta-deschisa",
        actor: "administrator",
        obiect: "scrierile publice",
        detalii: inchide ? (motiv || "fără motiv scris") : "redeschise",
        ip: ipCerere(req),
      });
    } catch (err) {
      console.error("Jurnalul comutatorului a eșuat — starea rămâne neschimbată:", err);
      return json({ eroare: "Nu am putut consemna fapta în jurnal, deci nu am schimbat nimic. Reîncearcă." }, 503);
    }
    if (inchide) {
      await acces.setJSON(CHEIE_POARTA, { inchis: true, motiv, de: new Date().toISOString() });
    } else {
      await acces.delete(CHEIE_POARTA).catch(() => {});
    }
    return json({ ok: true, poarta: await starePoarta() });
  }

  // ——— Starea întreagă ———
  const [batai, posta, monitor, poarta] = await Promise.all([
    citesteInimile(),
    acces.get("posta-sanatate", { type: "json" }).catch(() => null),
    registru.get("monitor/stare", { type: "json" }).catch(() => null),
    starePoarta(),
  ]);

  // Cozile care așteaptă un OM. Numărătorile citesc fiecare dosar — la mărimea de azi
  // a registrului e ieftin; dacă va crește mult, se mută pe contoare scrise la depunere.
  const expozitii = getStore("expozitii");
  const [dmfDeLucru, cereriCanise, dsarDeschise, neimportate, sanatateNeverif, transferuriDeOperat, adeziuniDeLucru, cotizatiiDeConfirmat, omologariDeLucru, comenziDeLucru] = await Promise.all([
    numara(registru, "dmf/", (d) => d.stare !== "emis" && d.stare !== "respins"),
    numara(registru, PREFIX_CERERI, (c) => c.stare !== "aprobata" && c.stare !== "respinsa"),
    numara(registru, "dsar/", (c) => c.stare !== "rezolvata" && c.stare !== "refuzata"),
    numara(expozitii, "coada/", (i) => !i.importat),
    // Indexul cozii de sănătate e chiar o coadă: fiecare intrare = un test de verificat.
    numara(registru, "sanatate-neverif/", () => true),
    numara(registru, "transfer-dosar/", (t) => t.stare === "confirmat"),
    numara(registru, "adeziune/", (a) => a.stare !== "admisa" && a.stare !== "respinsa"),
    numara(registru, "cotizatie-plata/", (p) => p.stare === "declarata"),
    numara(registru, "omologare/", (o) => o.stare === "noua"),
    numara(registru, "comanda/", (c) => c.stare === "depusa"),
  ]);

  return json({
    inimi: { ...judecaInimile(batai), batai, reguli: INIMI },
    posta: posta || { ok: true, detaliu: "încă neverificată (prima rulare a monitorului urmează)" },
    monitor: monitor
      ? { stare: monitor.stare, la: monitor.la || null, verificari: (monitor.verificari || []).map((x) => ({ nume: x.nume, ok: x.ok, detaliu: x.detaliu })) }
      : null,
    cozi: {
      dmfDeLucru,           // dosare DMF depuse, neemise și nerespinse
      sanatateNeverif,      // teste de sănătate în coada registraturii
      cereriCanise,         // cereri de afix nehotărâte
      dsarDeschise,         // cereri GDPR deschise (termen legal de 30 de zile!)
      inscrieriNeimportate: neimportate, // în coada expozițiilor, neaduse încă în Manager
      transferuriDeOperat,  // transferuri confirmate de noul proprietar, așteaptă registratura
      adeziuniDeLucru,      // cereri de membru nehotărâte (drumul Art. 15)
      cotizatiiDeConfirmat, // plăți de cotizație declarate, neconfirmate
      omologariDeLucru,     // cereri de omologare de titluri, nejudecate
      comenziDeLucru,       // comenzi de servicii depuse, neonorate
    },
    poarta,
  });
});
