// =========================================================================
// registru-corectie.mjs — îndreaptă TEXTUL ascendenței la actele aduse din arhiva de
// hârtie, fără să atingă altceva.
//
// DE CE EXISTĂ. Cititorul de formulare avea trei scăpări, găsite abia când am comparat
// ce scoate el cu ce scrie pe certificatele tipărite: codul nostru WDF, scris de om pe
// același rând cu numele părintelui, intra ÎN nume („DEEA / WDF.RO150194R22"); un „- N/A"
// era luat drept număr de pedigree; iar „NU EXISTA INFO IN PEDIGREE" ajungea ca nume de
// strămoș. 98 din cele 123 de certificate ale Arhivei 1 au intrat așa.
//
// CE NU FACE. Nu emite, nu anulează, nu renumerotează, nu atinge seria, microcipul,
// câinele, crescătorul, proprietarul sau data emiterii. Un act eliberat rămâne același
// act; i se îndreaptă doar scrisul dintr-un câmp.
//
// CHINGA CARE CONTEAZĂ. Tipul certificatului (A/B/C) și numărul de poziții cunoscute se
// recalculează din ascendența nouă și trebuie să iasă IDENTICE cu cele înghețate în act.
// Dacă diferă măcar la un exemplar, tot cuibul se refuză și nu se scrie nimic. Motivul e
// simplu: tipul e clasa actului. O corectură de text n-are voie să promoveze sau să
// retrogradeze un certificat aflat în mâna unui om — aia ar fi o reemitere, și se face
// altfel, cu act nou și cu urmă.
//
// NUMAI ACTELE ISTORICE. Se atinge doar ce poartă `istoric: true`. Certificatele emise
// prin fluxul normal au trecut prin ochii registraturii; textul lor nu se rescrie de la
// distanță, oricât de bine ar fi intenția.
//
//   POST { secret, cuib: {...}, proba?: true }  ->  { ok, schimbate, neatinse, refuzate }
//
// `cuib` e exact încărcătura pe care o construiește `scripts/importa-arhiva.mjs` — același
// formular, citit cu cititorul reparat. Cu `proba: true` nu se scrie nimic: se spune doar
// ce s-ar schimba, câmp cu câmp.
// =========================================================================
import { getStore } from "@netlify/blobs";
import { secretEgal } from "./_comun/secret.mjs";
import { tipCertificat } from "./registru-pedigree.mjs";
import { idDosar, verificaCuib } from "./registru-import.mjs";
import { jurnalizeazaObligatoriu } from "./_comun/registru-jurnal.mjs";

const json = (b, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

// CITIRE TARE, ca la emitere. Aici se face citește–modifică–scrie peste acte eliberate:
// actul se citește, i se schimbă un câmp, iar restul se scrie înapoi așa cum a fost citit.
// Cu citire obișnuită, magazia poate servi o copie veche de câteva zeci de secunde — iar
// atunci „restul așa cum a fost citit" înseamnă starea de acum un minut, și orice
// schimbare făcută între timp de altcineva ar fi ștearsă fără ca cineva să afle.
// S-a și văzut: prima verificare de după corecție a raportat că nu s-a scris nimic,
// fiindcă citea copia dinainte.
const store = () => getStore({ name: "registru", consistency: "strong" });

/** Ce anume s-a schimbat între două ascendențe, spus pe câmpuri. */
function diferente(vechi, nou) {
  const out = [];
  for (const cod of [...new Set([...Object.keys(vechi || {}), ...Object.keys(nou || {})])].sort()) {
    const a = (vechi || {})[cod] || {}, b = (nou || {})[cod] || {};
    if ((a.nume || "") !== (b.nume || "")) out.push(`${cod} nume: „${a.nume || "—"}” → „${b.nume || "—"}”`);
    if ((a.nr || "") !== (b.nr || "")) out.push(`${cod} nr: „${a.nr || "—"}” → „${b.nr || "—"}”`);
    if ((a.titluri || "") !== (b.titluri || "")) out.push(`${cod} titluri: „${a.titluri || "—"}” → „${b.titluri || "—"}”`);
  }
  return out;
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Folosește POST." }, 405);
  const body = await req.json().catch(() => null);
  if (!body || !secretEgal(body.secret, process.env.EXPO_SYNC_SECRET)) {
    return json({ eroare: "Neautorizat" }, 401);
  }

  const c = body.cuib;
  const PROBA = body.proba === true;
  const rele = verificaCuib(c);
  if (rele.length) return json({ eroare: "Date lipsă: " + rele.join(", ") }, 400);

  const s = store();
  const id = idDosar(c.numarCuib);
  const asc = c.ascendenta && typeof c.ascendenta === "object" ? c.ascendenta : {};
  const t = tipCertificat(asc, { dinDeclaratie: true });

  const dosar = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
  if (!dosar) return json({ eroare: `Nu există dosarul ${id} în registru. Corecția se face pe acte existente.` }, 404);
  if (!dosar.istoric) return json({ eroare: `Dosarul ${id} nu vine din arhiva de hârtie. Nu-l ating.` }, 409);

  // ---- Se verifică TOT înainte de a scrie ceva. ----
  const planificate = [];
  const refuzate = [];
  const neatinse = [];

  for (let i = 0; i < c.pui.length; i++) {
    const serie = taie(c.pui[i].wdf, 40).toUpperCase();
    const cert = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (!cert) { refuzate.push({ serie, de_ce: "nu există în registru" }); continue; }
    if (!cert.istoric) { refuzate.push({ serie, de_ce: "nu e act din arhiva de hârtie" }); continue; }

    // Clasa actului nu are voie să se schimbe dintr-o corectură de text.
    const lipsaVeche = Array.isArray(cert.lipsaAscendenta) ? cert.lipsaAscendenta.length : null;
    if (cert.tip !== t.tip || (lipsaVeche !== null && lipsaVeche !== t.lipsa.length)) {
      refuzate.push({
        serie,
        de_ce: `s-ar schimba clasa actului: Tip ${cert.tip} ${lipsaVeche === null ? "?" : 30 - lipsaVeche}/30 ` +
          `→ Tip ${t.tip} ${30 - t.lipsa.length}/30`,
      });
      continue;
    }

    const dif = diferente(cert.ascendenta, asc);
    if (!dif.length) { neatinse.push({ serie, nume: cert.caine?.nume }); continue; }
    planificate.push({ serie, nume: cert.caine?.nume, cert, diferente: dif });
  }

  // Un singur exemplar refuzat oprește tot cuibul: actele unui cuib împart aceeași
  // ascendență, iar jumătate corectată și jumătate nu e mai rău decât niciuna corectată.
  if (refuzate.length) {
    return json({ ok: false, cuib: dosar.serie, id, eroare: "Nu s-a scris nimic — vezi refuzate.", refuzate, planificate: planificate.length }, 409);
  }

  const difDosar = diferente(dosar.ascendenta, asc);
  if (PROBA) {
    return json({
      ok: true, proba: true, cuib: dosar.serie, id, tip: t.tip, cunoscute: 30 - t.lipsa.length,
      dosar: difDosar, schimbate: planificate.map((p) => ({ serie: p.serie, nume: p.nume, diferente: p.diferente })),
      neatinse,
    });
  }

  if (!planificate.length && !difDosar.length) {
    return json({
      ok: true, cuib: dosar.serie, id, tip: t.tip, cunoscute: 30 - t.lipsa.length,
      schimbate: [], neatinse, mesaj: "Totul era deja corect.",
    });
  }

  // ---- Urma se scrie ÎNAINTE de acte, ca peste tot în registru. ----
  try {
    await jurnalizeazaObligatoriu(s, {
      fapta: "corectie-ascendenta",
      actor: "registratură (corecție arhivă)",
      obiect: dosar.serie,
      detalii: `Cuib ${dosar.serie}: text îndreptat la ${planificate.length} certificate ` +
        `(Tip ${t.tip}, ${30 - t.lipsa.length}/30 — neschimbat). ` +
        (difDosar.length ? `Dosar: ${difDosar.join(" · ")}. ` : "") +
        planificate.map((p) => `${p.serie}: ${p.diferente.join(" · ")}`).join(" | "),
      ip: "local",
    });
  } catch (err) {
    console.error("Jurnalul nu a putut fi scris; nu s-a corectat nimic:", err);
    console.error("registru-corectie jurnal:", err); return json({ eroare: "Nu am putut consemna fapta în jurnal, deci nu am schimbat nimic. Încearcă din nou." }, 503);
  }

  const schimbate = [];
  const erori = [];

  try {
    await s.setJSON("dmf/" + id, {
      ...dosar,
      ascendenta: asc,
      mascul: c.mascul || dosar.mascul,
      femela: c.femela || dosar.femela,
      corectatLa: new Date().toISOString(),
    });
  } catch (err) {
    console.error("registru-corectie scriere:", err); return json({ eroare: "Nu am putut scrie dosarul. Încearcă din nou." }, 500);
  }

  for (const p of planificate) {
    try {
      // Se înlocuiește DOAR ascendența. Restul actului rămâne bit cu bit ce era.
      await s.setJSON("pedigree/" + p.serie, {
        ...p.cert,
        ascendenta: asc,
        lipsaAscendenta: t.lipsa,
        corectatLa: new Date().toISOString(),
      });
      schimbate.push({ serie: p.serie, nume: p.nume, campuri: p.diferente.length });
    } catch (err) {
      erori.push({ serie: p.serie, eroare: err.message });
    }
  }

  return json({
    ok: erori.length === 0,
    cuib: dosar.serie, id, tip: t.tip, cunoscute: 30 - t.lipsa.length,
    dosar: difDosar.length, schimbate, neatinse, erori,
  }, erori.length ? 500 : 200);
};
