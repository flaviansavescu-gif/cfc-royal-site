// =========================================================================
// registru-import.mjs — aduce în registru cuiburile emise pe HÂRTIE, înainte de
// registrul digital.
//
// DE CE O CALE SEPARATĂ. Fluxul obișnuit e: crescătorul depune declarația, registratura
// verifică, atribuie numărul WDF și emite certificatele. Pentru cele 77 de cuiburi vechi
// niciunul dintre pași nu se mai poate juca: actele SUNT emise, sunt tipărite, sunt în
// mâna oamenilor. A le trece prin fluxul normal ar însemna să le dăm serii noi — adică
// exact ce nu trebuie: numere pe site care nu se regăsesc pe hârtia din mână.
//
// IDENTITATEA E CEA DE PE HÂRTIE. Pe certificatul tipărit, „CERTIFIED NO." e chiar
// numărul WDF (WDF.RO150050L25). Aceea devine seria din registru. Cine caută numărul
// scris pe actul lui îl găsește din prima.
//
// FĂRĂ COD QR, ȘI SE SPUNE. Certificatele vechi n-au cod QR — nu exista. Fișa lor
// poartă `istoric: true`, iar verificarea o spune pe față. Nu ne prefacem că un act din
// 2025 a fost emis de un sistem care n-a apucat să existe.
//
// NU SUPRASCRIE NIMIC. Dacă seria există deja în registru, exemplarul e SĂRIT și
// raportat ca atare. Importul se poate relua de câte ori e nevoie — după o întrerupere,
// după o corectură într-un formular — fără să facă dubluri și fără să rescrie un act.
//
//   POST { secret, cuib: {...} }  ->  { ok, scrise, sarite, erori }
//
// Datele vin gata citite și verificate de `scripts/importa-arhiva.mjs`, care rulează pe
// laptop: acolo stau formularele, acolo se leagă rasele de nomenclator, iar ce nu se
// potrivește exact se oprește ÎNAINTE de a ajunge aici.
// =========================================================================
import { getStore } from "@netlify/blobs";
import { tipCertificat } from "./registru-pedigree.mjs";
import { jurnalizeazaObligatoriu } from "./_comun/registru-jurnal.mjs";

const json = (b, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const store = () => getStore("registru");

/** Identificatorul dosarului, derivat din numărul cuibului: reluarea nu face dubluri. */
export function idDosar(numarCuib) {
  return "ist-" + String(numarCuib || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Ce trebuie neapărat să vină, ca să nu scriem un act ciung. */
export function verificaCuib(c) {
  const rele = [];
  if (!taie(c?.numarCuib, 60)) rele.push("numărul cuibului");
  if (!taie(c?.rasa, 120)) rele.push("rasa");
  if (!taie(c?.dataFatarii, 10)) rele.push("data fătării");
  if (!Array.isArray(c?.pui) || !c.pui.length) rele.push("puii");
  (c?.pui || []).forEach((p, i) => {
    if (!taie(p?.nume, 120)) rele.push(`puiul ${i + 1}: numele`);
    if (!/^[MF]$/.test(taie(p?.sex, 1))) rele.push(`puiul ${i + 1}: sexul`);
    // Seria E numărul de pe hârtie. Fără el n-avem sub ce nume să-l înscriem.
    if (!taie(p?.wdf, 40)) rele.push(`puiul ${i + 1}: numărul de pe certificat`);
  });
  return rele;
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Folosește POST." }, 405);
  const body = await req.json().catch(() => null);
  if (!body || !process.env.EXPO_SYNC_SECRET || body.secret !== process.env.EXPO_SYNC_SECRET) {
    return json({ eroare: "Neautorizat" }, 401);
  }

  const c = body.cuib;
  const rele = verificaCuib(c);
  if (rele.length) return json({ eroare: "Date lipsă: " + rele.join(", ") }, 400);

  const s = store();
  const id = idDosar(c.numarCuib);
  const acum = new Date().toISOString();

  // Ascendența, cu părinții pe pozițiile T și M. Din declarație — deci tipicitatea
  // (Tip C) e exclusă, oricât de puțin s-ar ști despre bunici.
  const asc = c.ascendenta && typeof c.ascendenta === "object" ? c.ascendenta : {};
  const t = tipCertificat(asc, { dinDeclaratie: true });

  const dosar = {
    id,
    serie: taie(c.numarCuib, 60),
    rasa: taie(c.rasa, 120),
    varietate: taie(c.varietate, 80),
    dataMontei: taie(c.dataMontei, 10),
    dataFatarii: taie(c.dataFatarii, 10),
    numarWDF: taie(c.numarCuib, 60),
    afix: taie(c.afix, 120),
    nrAfix: taie(c.nrAfix, 40),
    membruNume: taie(c.crescator, 120),
    membruId: null,                       // crescătorii vechi nu au fișă în registru
    mascul: c.mascul || null,
    femela: c.femela || null,
    ascendenta: asc,
    pui: c.pui,
    stare: "emis",
    istoric: true,
    sursa: taie(c.sursa, 200),            // din ce dosar de hârtie provine
    importatLa: acum,
  };

  const scrise = [];
  const sarite = [];
  const erori = [];

  // URMA SE SCRIE ÎNTÂI, ca peste tot în registru. La primul import am scris-o la sfârșit
  // și jurnalul a refuzat fapta ca necunoscută: 17 certificate intraseră deja, fără urmă.
  // Un act apărut în registru fără să se știe cine l-a pus și din ce dosar de hârtie
  // provine nu se poate apăra la o contestație. Dacă jurnalul cade, nu se scrie nimic.
  try {
    await jurnalizeazaObligatoriu(s, {
      fapta: "import-istoric",
      actor: "registratură (import)",
      obiect: dosar.serie,
      detalii: `Cuib ${dosar.serie} — ${dosar.rasa}, crescător ${dosar.membruNume || "—"}: ` +
        `${c.pui.length} exemplare, Tip ${t.tip}, ${30 - t.lipsa.length}/30 poziții cunoscute` +
        (dosar.sursa ? ` · sursa: ${dosar.sursa}` : ""),
      ip: "local",
    });
  } catch (err) {
    console.error("Jurnalul nu a putut fi scris; nu s-a importat nimic:", err);
    return json({ eroare: "Nu am putut consemna fapta în jurnal, deci nu am scris nimic. " + err.message }, 503);
  }

  try {
    await s.setJSON("dmf/" + id, dosar);
  } catch (err) {
    return json({ eroare: "Nu am putut scrie dosarul: " + err.message }, 500);
  }

  for (let i = 0; i < c.pui.length; i++) {
    const p = c.pui[i];
    const serie = taie(p.wdf, 40).toUpperCase();
    try {
      // Nu suprascriem niciodată un act existent. Reluarea importului e inofensivă.
      const existent = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
      if (existent) { sarite.push({ serie, nume: p.nume, motiv: "există deja" }); continue; }

      const microcip = taie(p.microcip, 30).replace(/[\s-]/g, "");
      const cert = {
        serie,
        tip: t.tip,
        lipsaAscendenta: t.lipsa,
        dmfId: id,
        dmfSerie: dosar.serie,
        numarWDF: dosar.numarWDF,
        numarWDFCaine: serie,             // pe hârtie, numărul certificatului E numărul WDF
        puiIndex: i,
        caine: {
          nume: taie(p.nume, 120),
          rasa: dosar.rasa,
          varietate: taie(p.varietate, 60) || dosar.varietate,
          sex: taie(p.sex, 1).toUpperCase(),
          dataNasterii: dosar.dataFatarii,
          culoare: taie(p.culoare, 60),
          tipPar: taie(p.tipPar, 60),
          microcip,
        },
        crescator: { nume: dosar.membruNume, afix: dosar.afix, nrAfix: dosar.nrAfix },
        proprietar: {
          nume: taie(p.proprietar, 120) || dosar.membruNume,
          adresa: "", localitate: taie(p.adresa, 120), judet: "", tara: "România",
        },
        ascendenta: asc,
        emis: taie(c.dataEmiterii, 30) || dosar.dataFatarii,
        emisDe: "registratură — import din arhiva de hârtie",
        // Actul e anterior registrului digital: n-are cod QR și nu se poate pretinde că are.
        istoric: true,
        faraQR: true,
        importatLa: acum,
        anulat: false,
      };

      await s.setJSON("pedigree/" + serie, cert);
      await s.setJSON("pedigree-cuib/" + id + "/" + i, { serie, nume: cert.caine.nume, tip: t.tip });
      if (microcip) await s.setJSON("pedigree-caine/" + microcip, { serie });
      await s.setJSON("pedigree-wdf/" + serie, { serie });
      scrise.push({ serie, nume: cert.caine.nume, tip: t.tip });
    } catch (err) {
      erori.push({ serie, nume: p?.nume, eroare: err.message });
    }
  }

  return json({
    ok: erori.length === 0,
    cuib: dosar.serie, id, tip: t.tip,
    cunoscute: 30 - t.lipsa.length,
    scrise, sarite, erori,
  }, erori.length ? 500 : 200);
};
