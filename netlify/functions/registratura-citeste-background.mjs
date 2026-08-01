// =========================================================================
// registratura-citeste-background.mjs — citește cele două pedigree-uri ale părinților.
//
// Numele terminat în `-background` nu e un moft: așa recunoaște Netlify o funcție de
// fundal. Ea răspunde 202 pe loc și are 15 minute la dispoziție, în loc de 10 secunde.
// Măsurat pe cuibul 26: 36 de secunde pentru două documente — adică de trei ori peste
// ce încape într-o funcție obișnuită.
//
// NU E O ADRESĂ PUBLICĂ ÎN FAPT, DEȘI E ÎN DREPT. Oricine poate trimite aici o cerere,
// deci funcția își cere singură dovada: un jeton de o singură folosință, scris de poartă
// în magazie cu câteva clipe înainte. Fără el, nu se citește nimic — altfel ar fi un
// buton de cheltuit banii asociației, deschis către internet.
//
// CE PLEACĂ ÎN AFARĂ. Cele două certificate de origine ale părinților, atât. Nu dovada
// plății, nu confirmarea montei, nu datele cumpărătorilor.
//
// CITIREA PROPUNE, OMUL HOTĂRĂȘTE. Nu se scrie NIMIC în ascendența dosarului. Rezultatul
// intră în `citire/stare/<id>`, de unde îl ia pagina; salvarea rămâne apăsarea omului.
// =========================================================================
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";
import { jurnalizeaza } from "./_comun/registru-jurnal.mjs";
import {
  MODEL, PLAFON_ZI, cheiaZilei, cheiaStarii, cheiaJetonului, cheiaUrmei,
  amprenta, egal, costul, inCenti,
} from "./_comun/citire-documente.mjs";
import {
  INSTRUCTIUNI, schemaCitirii, mutaSubRadacina, nepotrivirile,
} from "./_comun/citire-ascendenta.mjs";
import { pozitiiAscendenta } from "./registru-pedigree.mjs";

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const store = () => getStore({ name: "registru", consistency: "strong" });

/** Doar actele de origine ale părinților pleacă la citit. */
const DE_CITIT = [
  { fel: "pedigree-mascul", cine: "TATĂL", radacina: "T", declaratie: "mascul" },
  { fel: "pedigree-femela", cine: "MAMA", radacina: "M", declaratie: "femela" },
];

export default async (req) => {
  if (req.method !== "POST") return new Response("", { status: 405 });
  let body;
  try { body = await req.json(); } catch { return new Response("", { status: 400 }); }

  const id = taie(body.id, 40);
  const s = store();

  // —— Jetonul de o singură folosință ——
  const inreg = await s.get(cheiaJetonului(id), { type: "json" }).catch(() => null);
  if (!inreg || !egal(inreg.amprenta, amprenta(taie(body.jeton, 80)))) {
    console.error("registratura-citeste-background: jeton nepotrivit pentru", id);
    return new Response("", { status: 403 });
  }
  // Se stinge imediat: o a doua cerere cu același jeton nu mai are ce face.
  await s.delete(cheiaJetonului(id)).catch(() => {});

  const deCatre = taie(body.deCatre, 80) || "registratură";
  const rol = taie(body.rol, 20) || "registratura";

  const gata = async (x) => {
    await s.setJSON(cheiaStarii(id), { id, ...x, terminatLa: new Date().toISOString(), deCatre, rol });
  };

  const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
  if (!d) { await gata({ stare: "cazut", eroare: "Dosar inexistent." }); return new Response("", { status: 200 }); }

  const coduri = pozitiiAscendenta().map((p) => p.cod);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const propuneri = {};
  const citite = [];
  const nepotriviri = [];
  let jIn = 0, jOut = 0;

  for (const { fel, cine, radacina, declaratie } of DE_CITIT) {
    const f = await s.getWithMetadata("dmf-fisier/" + id + "/" + fel, { type: "arrayBuffer" }).catch(() => null);
    if (!f) { citite.push({ fel, cine, stare: "lipsește de la dosar" }); continue; }

    const tip = f.metadata?.tip || "";
    const b64 = Buffer.from(f.data).toString("base64");

    // Imaginile merg ca imagine, PDF-urile ca document: blocul trebuie să fie cel potrivit
    // felului de fișier, altfel cererea e respinsă din start.
    const document = tip === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: tip || "image/jpeg", data: b64 } };

    let r;
    try {
      r = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: INSTRUCTIUNI,
        // Un act scanat merită privit de două ori; aici graba costă mai mult decât
        // jetoanele economisite.
        thinking: { type: "adaptive" },
        output_config: {
          effort: "high",
          format: { type: "json_schema", schema: schemaCitirii(coduri) },
        },
        messages: [{
          role: "user",
          content: [
            document,
            { type: "text", text: `Acesta e certificatul de origine al ${cine} din cuibul care se înregistrează. Transcrie-l.` },
          ],
        }],
      });
    } catch (err) {
      citite.push({ fel, cine, stare: "citirea a căzut: " + (err?.message || String(err)) });
      console.error("registratura-citeste-background:", fel, err?.message || err);
      continue;
    }

    const aIn = r.usage?.input_tokens ?? 0, aOut = r.usage?.output_tokens ?? 0;
    jIn += aIn; jOut += aOut;

    // SOCOTEALA SE ȚINE DUPĂ FIECARE DOCUMENT, nu la sfârșit. Banii s-au cheltuit deja;
    // dacă funcția cade la al doilea document, cheltuiala primului trebuie să rămână
    // numărată. Altfel plafonul apără cel mai prost exact în ziua în care merge prost.
    await adunaLaZi(s, costul(aIn, aOut), 1).catch((e) =>
      console.error("registratura-citeste-background: socoteala zilei:", e?.message || e));

    let scos;
    try { scos = JSON.parse((r.content || []).find((b) => b.type === "text")?.text || "{}"); }
    catch { citite.push({ fel, cine, stare: "răspuns ilizibil" }); continue; }

    if (!scos.esteCertificat) {
      citite.push({ fel, cine, stare: "documentul nu pare un certificat de origine" });
      continue;
    }

    // Mutarea generației (vezi `_comun/citire-ascendenta.mjs`, unde e și probată).
    const mutate = mutaSubRadacina(radacina, scos.pozitii, coduri, cine);
    Object.assign(propuneri, mutate.propuneri);

    // Părintele însuși, de pe capul certificatului lui.
    if (taie(scos.caine?.nume, 120)) {
      propuneri[radacina] = {
        nume: taie(scos.caine.nume, 120),
        nr: taie(scos.caine.nr, 60),
        titluri: "", sigur: true, nelamurire: "", din: cine,
      };
    }

    // —— Comparația cu ce a declarat crescătorul ——
    // Nu corectăm nimic automat: doar arătăm unde nu se potrivesc. Comparația asta a prins,
    // la cuibul 26, trei greșeli de transcriere pe care nu le văzuse nimeni — tocmai
    // fiindcă fiecare, luată separat, arăta corect.
    nepotriviri.push(...nepotrivirile({
      declarat: d[declaratie] || {},
      citit: scos.caine || {},
      rasaDosar: d.rasa,
      eticheta: cine.toLowerCase(),
    }));

    citite.push({ fel, cine, stare: "citit", pozitii: mutate.luate, nesigure: mutate.nesigure });
  }

  const cost = costul(jIn, jOut);
  const nesigure = Object.values(propuneri).filter((p) => !p.sigur).length;
  const citit = citite.filter((c) => c.stare === "citit").length;

  // —— Urma, pentru raportul de folosire ——
  // În afara dosarului, într-o cheie a ei: dacă mâine cineva se întreabă de unde a apărut
  // o poziție, urma spune ce a PROPUS citirea, iar dosarul spune ce a SALVAT omul. Două
  // lucruri care trebuie să rămână deosebite.
  await s.setJSON(cheiaUrmei(id), {
    cand: new Date().toISOString(), deCatre, rol,
    serie: d.serie || null, model: MODEL,
    citite, propuneri, nepotriviri,
    jetoane: { intrare: jIn, iesire: jOut }, usd: Number(cost.toFixed(6)),
  }).catch((e) => console.error("urma nu s-a scris:", e?.message || e));

  // —— Jurnalul de audit ——
  // Citirea atinge un dosar, costă bani și pleacă în afara casei. Emiterea și corecția se
  // consemnează de mult; asta nu se consemna deloc, iar urma de mai sus se rescrie la
  // fiecare citire — deci nu se putea afla câte au fost, nici de către cine.
  await jurnalizeaza(s, {
    fapta: "citire-documente",
    actor: deCatre + (rol === "admin" ? " (administrator)" : ""),
    obiect: d.serie || id,
    detalii: `${citit}/2 certificate citite · ${Object.keys(propuneri).length}/30 poziții propuse` +
      (nesigure ? `, ${nesigure} nesigure` : "") +
      (nepotriviri.length ? ` · ${nepotriviri.length} nepotriviri cu declarația` : "") +
      ` · ${inCenti(cost)}`,
    ip: "fundal",
  }).catch((e) => console.error("jurnalul nu s-a scris:", e?.message || e));

  await gata({
    stare: "gata",
    citite, propuneri, nepotriviri, nesigure,
    cunoscute: Object.keys(propuneri).length,
    din: coduri.length,
    jetoane: { intrare: jIn, iesire: jOut },
    cost: { usd: Number(cost.toFixed(6)), explicatie: inCenti(cost) + " pentru acest dosar" },
    mesaj: citit === 0
      ? "Niciun certificat n-a putut fi citit. Vezi lista de mai sus pentru motiv."
      : `Citite ${citit} din 2 certificate. ${Object.keys(propuneri).length} din 30 de poziții propuse` +
        (nesigure ? `, dintre care ${nesigure} nesigure.` : "."),
    atentie: "Nimic nu s-a scris în ascendența dosarului. Astea sunt propuneri: verifică-le și salvează tu.",
  });

  return new Response("", { status: 200 });
};

/**
 * Adună la socoteala zilei.
 *
 * Citește–adună–scrie, deci două citiri pornite în aceeași secundă pot pierde una din
 * adunări. Nu merită un mecanism mai greu: plafonul e o frână împotriva greșelii, nu o
 * casă de marcat. O apăsare pierdută din socoteală înseamnă zece cenți nenumărați, nu o
 * poartă deschisă — iar citirile se pornesc de om, una câte una, nu în valuri.
 */
async function adunaLaZi(s, usd, cereri) {
  const cheie = cheiaZilei();
  const zi = (await s.get(cheie, { type: "json" }).catch(() => null)) || { cereri: 0, usd: 0, plafon: PLAFON_ZI };
  await s.setJSON(cheie, {
    cereri: (zi.cereri || 0) + cereri,
    usd: Number(((zi.usd || 0) + usd).toFixed(6)),
    plafon: PLAFON_ZI,
    ultima: new Date().toISOString(),
  });
}
