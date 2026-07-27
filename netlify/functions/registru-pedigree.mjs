// registru-pedigree.mjs — ascendența cuibului și Certificatele de Origine (Pedigree).
//
// Continuă acolo unde se oprește declarația: dosarul verificat primește numărul de cuib
// WDF, i se completează ascendența pe patru generații, iar din el se emit certificatele
// individuale — câte unul pentru fiecare pui.
//
// CELE 30 DE POZIȚII. Ascendența unui câine pe patru generații înseamnă 2 părinți +
// 4 bunici + 8 străbunici + 16 stră-străbunici. Fiecare poziție are un cod format din
// litere „T" (tată) și „M" (mamă), citit de la câine în sus: „TM" e mama tatălui,
// „MTT" e tatăl tatălui mamei. Codul spune drumul, deci nu se poate încurca.
//
// TIPUL CERTIFICATULUI NU SE ALEGE, SE CALCULEAZĂ. Tip A dacă toate cele 30 de poziții
// au detalii de înregistrare (număr de pedigree), Tip B dacă lipsește oricare, pe oricare
// linie. Lăsat la alegerea omului, tipul ar deveni o chestiune de indulgență; calculat
// din date, e o constatare.
//
// Stocare (store „registru"):
//   dmf/<id>                    -> primește `numarWDF`, `ascendenta`, `stare`
//   pedigree/<serie>            -> certificatul emis (cu ascendența înghețată în el)
//   pedigree-cuib/<dmfId>/<i>   -> seria certificatului puiului i, pentru listare
//   pedigree-caine/<microcip>   -> seria, pentru căutarea după microcip
//   contor/pedigree-<an>        -> { ultim }
//   contor/wdf                  -> { ultim }   (pornește de la 76: primul cuib emis ia 77)
//
// POST { cod, actiune:"ascendenta", id }                       (registratură/admin)
// POST { cod, actiune:"ascendenta-salveaza", id, ascendenta }  (registratură/admin)
// POST { cod, actiune:"numar-wdf", id }                        (registratură/admin)
// POST { cod, actiune:"emite", id, pui:[{ index, proprietar }] } (registratură/admin)
// POST { cod, actiune:"certificat", serie }                    (registratură/admin/crescător)
// POST { actiune:"verifica", serie }                           PUBLIC — date minime
import { getStore } from "@netlify/blobs";
import QRCode from "qrcode";
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

/** Primul cuib emis prin registrul digital ia numărul 77 — pe hârtie s-a ajuns la 76. */
export const WDF_ULTIMUL_PE_HARTIE = 76;

/**
 * Codurile celor 30 de poziții, în ordinea în care se citesc pe certificat:
 * întâi linia tatălui, apoi a mamei, de la părinți spre stră-străbunici.
 */
export function pozitiiAscendenta() {
  const out = [];
  for (let gen = 1; gen <= 4; gen++) {
    const n = Math.pow(2, gen);
    for (let i = 0; i < n; i++) {
      // Bitul cel mai semnificativ e cel mai apropiat de câine: 0 = tată, 1 = mamă.
      let cod = "";
      for (let b = gen - 1; b >= 0; b--) cod += ((i >> b) & 1) ? "M" : "T";
      out.push({ cod, generatie: gen });
    }
  }
  return out;
}

/**
 * Eticheta în română a unei poziții: „mama tatălui", „tatăl tatălui mamei"…
 *
 * Codul se citește de la câine în sus, deci ULTIMA literă e persoana descrisă, iar
 * cele dinaintea ei sunt posesorii, în ordine inversă: „TM" = mama (M) tatălui (T).
 * Construită invers, eticheta ar spune exact pe dos — iar registratura ar transcrie
 * ascendența încrucișată, fără să aibă cum să-și dea seama.
 */
export function etichetaPozitie(cod) {
  const l = [...cod];
  let s = l[l.length - 1] === "T" ? "tatăl" : "mama";
  for (let i = l.length - 2; i >= 0; i--) s += " " + (l[i] === "T" ? "tatălui" : "mamei");
  return s;
}

/**
 * Tipul certificatului, calculat din ascendență.
 * Tip A cere detalii de înregistrare la TOATE cele 30 de poziții.
 */
export function tipCertificat(ascendenta) {
  const lipsa = [];
  for (const { cod } of pozitiiAscendenta()) {
    const p = ascendenta?.[cod];
    if (!p || !taie(p.nume, 120) || !taie(p.nr, 60)) lipsa.push(cod);
  }
  return { tip: lipsa.length ? "B" : "A", lipsa };
}

/** Cine cere. */
async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  return null;
}

const potVerifica = (eu) => eu.rol === "registratura" || eu.rol === "admin";

/** Serie unică, cu același mecanism ca la declarații: marcaj înainte de returnare. */
async function serieNoua(an) {
  const s = store();
  for (let i = 0; i < 30; i++) {
    const c = await s.get("contor/pedigree-" + an, { type: "json" }).catch(() => null);
    const urm = (c?.ultim || 0) + 1;
    const serie = `CFCR-P-${an}-${String(urm).padStart(4, "0")}`;
    const ocupat = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
    await s.setJSON("contor/pedigree-" + an, { ultim: urm });
    if (!ocupat) return serie;
  }
  return null;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 24);

  // —— Verificarea publică a unui certificat (ținta codului QR) ——
  // Fără cod: oricine ține certificatul în mână trebuie să poată afla dacă e real.
  // Se arată doar identitatea câinelui și tipul certificatului — numele și adresele
  // proprietarului nu au ce căuta la o adresă publică.
  if (actiune === "verifica") {
    const serie = taie(body.serie, 40).toUpperCase();
    if (!serie) return json({ eroare: "Scrie seria certificatului." }, 400);
    const c = await store().get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Nu există niciun certificat cu această serie." }, 404);
    return json({
      certificat: {
        serie: c.serie, tip: c.tip, emis: c.emis,
        caine: {
          nume: c.caine.nume, rasa: c.caine.rasa, varietate: c.caine.varietate,
          sex: c.caine.sex, dataNasterii: c.caine.dataNasterii,
          culoare: c.caine.culoare, microcip: c.caine.microcip,
        },
        numarWDF: c.numarWDF, afixCrescator: c.crescator?.afix || null,
        anulat: !!c.anulat,
      },
    });
  }

  const cod = taie(body.cod, 60);
  const eu = await cine(cod);
  if (!eu) return json({ eroare: "Cod incorect." }, 401);
  const s = store();

  // —— Dosarul pregătit pentru ascendență ——
  if (actiune === "ascendenta") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const d = await s.get("dmf/" + taie(body.id, 40), { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    // Părinții se completează singuri din declarație: sunt deja acolo, cu pedigree și
    // microcip, iar recopiatul lor cu mâna e doar o ocazie de greșeală.
    const asc = Object.assign({}, d.ascendenta || {});
    if (!asc.T) asc.T = { nume: d.mascul.nume, nr: d.mascul.pedigree, titluri: "" };
    if (!asc.M) asc.M = { nume: d.femela.nume, nr: d.femela.pedigree, titluri: "" };
    return json({
      dosar: {
        id: d.id, serie: d.serie, rasa: d.rasa, varietate: d.varietate || "",
        dataFatarii: d.dataFatarii, numarWDF: d.numarWDF || null,
        pui: d.pui, afix: d.afix, nrAfix: d.nrAfix,
        membruNume: d.membruNume, confirmare: d.confirmare?.stare || "asteptare",
      },
      ascendenta: asc,
      pozitii: pozitiiAscendenta().map((p) => ({ ...p, eticheta: etichetaPozitie(p.cod) })),
      tip: tipCertificat(asc),
    });
  }

  if (actiune === "ascendenta-salveaza") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);

    const primit = body.ascendenta || {};
    const asc = {};
    for (const { cod } of pozitiiAscendenta()) {
      const p = primit[cod] || {};
      const nume = taie(p.nume, 120);
      if (!nume) continue;                       // pozițiile goale nu se păstrează
      asc[cod] = { nume, nr: taie(p.nr, 60), titluri: taie(p.titluri, 120) };
    }
    const t = tipCertificat(asc);
    await s.setJSON("dmf/" + id, { ...d, ascendenta: asc, stare: "verificat" });
    return json({ ok: true, tip: t.tip, lipsa: t.lipsa, completate: Object.keys(asc).length });
  }

  // —— Numărul de cuib WDF ——
  // Se dă o singură dată și nu se mai schimbă: e cheia sub care cuibul intră în baza
  // World Dog Federation.
  if (actiune === "numar-wdf") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    if (d.numarWDF) return json({ ok: true, numarWDF: d.numarWDF, deja: true });

    const c = await s.get("contor/wdf", { type: "json" }).catch(() => null);
    const urm = Math.max(c?.ultim || 0, WDF_ULTIMUL_PE_HARTIE) + 1;
    const numarWDF = "WDF-" + String(urm).padStart(4, "0");
    await s.setJSON("contor/wdf", { ultim: urm });
    await s.setJSON("dmf/" + id, { ...d, numarWDF });
    return json({ ok: true, numarWDF });
  }

  // —— Emiterea certificatelor ——
  if (actiune === "emite") {
    if (!potVerifica(eu)) return json({ eroare: "Nepermis." }, 403);
    const id = taie(body.id, 40);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    if (!d.numarWDF) return json({ eroare: "Atribuie întâi numărul de cuib WDF." }, 400);
    if (!d.ascendenta || !d.ascendenta.T || !d.ascendenta.M)
      return json({ eroare: "Completează întâi ascendența (cel puțin părinții)." }, 400);

    const t = tipCertificat(d.ascendenta);
    const an = new Date().getFullYear();
    const cerute = Array.isArray(body.pui) ? body.pui : [];
    if (!cerute.length) return json({ eroare: "Alege cel puțin un pui." }, 400);

    const emise = [];
    for (const cerere of cerute) {
      const i = Number(cerere?.index);
      const pui = d.pui?.[i];
      if (!pui) continue;
      // Un pui nu primește două certificate: dacă există deja, îl returnăm pe acela.
      const existent = await s.get("pedigree-cuib/" + id + "/" + i, { type: "json" }).catch(() => null);
      if (existent?.serie) { emise.push({ index: i, serie: existent.serie, deja: true }); continue; }

      const serie = await serieNoua(an);
      if (!serie) return json({ eroare: "Nu am putut aloca o serie. Reîncearcă." }, 500);
      const microcip = taie(pui.identificare, 30);
      const cert = {
        serie, tip: t.tip, lipsaAscendenta: t.lipsa,
        dmfId: id, dmfSerie: d.serie, numarWDF: d.numarWDF, puiIndex: i,
        caine: {
          nume: pui.nume, rasa: d.rasa, varietate: pui.varietate || d.varietate || "",
          sex: pui.sex, dataNasterii: d.dataFatarii,
          culoare: pui.culoare || "", tipPar: pui.tipPar || "", microcip,
        },
        crescator: {
          nume: d.membruNume, afix: d.afix || "", nrAfix: d.nrAfix || "",
        },
        // Proprietarul poate lipsi la emitere (pui nevândut): certificatul se emite pe
        // crescător, iar transferul se operează ulterior.
        proprietar: {
          nume: taie(cerere?.proprietar?.nume, 120) || taie(pui.cumparator?.nume, 120) || d.membruNume,
          adresa: taie(cerere?.proprietar?.adresa, 200) || taie(pui.cumparator?.adresa, 200),
          localitate: taie(cerere?.proprietar?.localitate, 120) || taie(pui.cumparator?.localitate, 120),
          judet: taie(cerere?.proprietar?.judet, 60) || taie(pui.cumparator?.judet, 60),
          tara: taie(cerere?.proprietar?.tara, 60) || taie(pui.cumparator?.tara, 60) || "România",
        },
        // Ascendența se ÎNGHEAȚĂ în certificat. Dacă dosarul se corectează mai târziu,
        // certificatul deja emis rămâne ce a fost tipărit și înmânat omului.
        ascendenta: d.ascendenta,
        emis: new Date().toISOString(),
        emisDe: eu.rol === "admin" ? "administrator" : (eu.registrator?.nume || "registratură"),
        anulat: false,
      };
      await s.setJSON("pedigree/" + serie, cert);
      await s.setJSON("pedigree-cuib/" + id + "/" + i, { serie, nume: pui.nume, tip: t.tip });
      if (microcip) await s.setJSON("pedigree-caine/" + microcip, { serie });
      emise.push({ index: i, serie, tip: t.tip });
    }
    await s.setJSON("dmf/" + id, { ...(await s.get("dmf/" + id, { type: "json" })), stare: "emis" });
    return json({ ok: true, tip: t.tip, lipsa: t.lipsa, emise });
  }

  // —— Certificatul complet (pentru tipărire) ——
  if (actiune === "certificat") {
    const serie = taie(body.serie, 40).toUpperCase();
    const c = await s.get("pedigree/" + serie, { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Certificat inexistent." }, 404);
    if (!potVerifica(eu)) {
      // Crescătorul își vede propriile certificate, nimic altceva.
      const d = await s.get("dmf/" + c.dmfId, { type: "json" }).catch(() => null);
      const alMeu = eu.rol === "membru" && d && d.membruId === eu.membru.id;
      if (!alMeu) return json({ eroare: "Nepermis." }, 403);
    }
    // Codul QR se face pe server: pagina de tipărire rămâne fără dependențe, iar
    // imaginea e gata înainte ca omul să apese Ctrl+P.
    const adresaVerificare = "https://cfc-royal.ro/verifica-pedigree/?s=" + encodeURIComponent(serie);
    let qr = null;
    try {
      qr = await QRCode.toDataURL(adresaVerificare, { margin: 0, width: 320, errorCorrectionLevel: "M" });
    } catch (err) { console.error("Generarea codului QR a eșuat:", err); }

    return json({
      certificat: c,
      pozitii: pozitiiAscendenta().map((p) => ({ ...p, eticheta: etichetaPozitie(p.cod) })),
      qr, adresaVerificare,
    });
  }

  // —— Certificatele unui cuib ——
  if (actiune === "certificate-cuib") {
    const id = taie(body.id, 40);
    const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
    if (!d) return json({ eroare: "Dosar inexistent." }, 404);
    if (!potVerifica(eu)) {
      const alMeu = eu.rol === "membru" && d.membruId === eu.membru.id;
      if (!alMeu) return json({ eroare: "Nepermis." }, 403);
    }
    const lista = [];
    try {
      const { blobs } = await s.list({ prefix: "pedigree-cuib/" + id + "/" });
      for (const b of blobs) {
        const x = await s.get(b.key, { type: "json" });
        if (x) lista.push({ ...x, index: Number(b.key.split("/").pop()) });
      }
    } catch (err) { console.error("Listare certificate eșuată:", err); }
    lista.sort((a, b) => a.index - b.index);
    return json({ certificate: lista, numarWDF: d.numarWDF || null });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
