// =========================================================================
// registratura-citeste.mjs — citește pedigree-urile părinților dintr-un dosar DMF și
// PROPUNE ascendența celor 30 de poziții.
//
// CITIREA PROPUNE, OMUL HOTĂRĂȘTE. Funcția asta nu scrie NIMIC în ascendența dosarului.
// Întoarce valori propuse, fiecare cu marcaj de siguranță și cu documentul din care a
// fost citită. Registratura le vede lângă ce a declarat crescătorul, corectează ce
// trebuie, și abia apăsarea ei salvează — prin `ascendenta-salveaza`, care exista deja.
//
// DE CE. Registratura copiază cu mâna, de pe două certificate, 30 de poziții × 3 câmpuri.
// E muncă multă și, mai rău, e muncă în care greșeala nu se vede: un „RKF 4091390" scris
// „RKF 4091930" arată la fel de credibil ca originalul, intră într-un act oficial și se
// moștenește apoi la toți descendenții.
//
// NU PORNEȘTE SINGURĂ. Se apasă, pe un dosar anume. Nu există nicăieri cod care să umble
// singur prin dosare — nici noaptea, nici „ca să fie gata dimineața".
//
// CE PLEACĂ ÎN AFARĂ. Cele două certificate de origine ale părinților, atât. Nu dovada
// plății, nu confirmarea montei, nu datele cumpărătorilor. Un act de origine e, prin
// natura lui, un document care circulă; celelalte piese ale dosarului nu sunt.
//
//   POST { cod, dispozitiv, id }  ->  { propuneri, nepotriviri, jetoane, cost }
// =========================================================================
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";
import { actorDinCod } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { mutaSubRadacina, nepotrivirile, INSTRUCTIUNI, schemaCitirii } from "./_comun/citire-ascendenta.mjs";
import { pozitiiAscendenta } from "./registru-pedigree.mjs";

const json = (b, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const store = () => getStore({ name: "registru", consistency: "strong" });
const azi = () => new Date().toISOString().slice(0, 10);

const MODEL = "claude-opus-5";
const PRET = { intrare: 5 / 1_000_000, iesire: 25 / 1_000_000 };   // USD per jeton

/**
 * Plafon de cheltuială pe zi. Un dosar costă câțiva cenți, deci plafonul nu stă în calea
 * lucrului obișnuit — stă în calea greșelii: un buton apăsat în buclă, sau un cod de
 * registratură ajuns unde nu trebuie. Prima oprire trebuie să fie una omenească, nu o
 * factură la sfârșit de lună.
 */
const PLAFON_ZI = Number(process.env.CITIRE_PLAFON_ZI || 5);       // USD

/** Doar actele de origine ale părinților pleacă la citit. */
const DE_CITIT = [
  { fel: "pedigree-mascul", cine: "TATĂL", radacina: "T", declaratie: "mascul" },
  { fel: "pedigree-femela", cine: "MAMA", radacina: "M", declaratie: "femela" },
];

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  // —— Poarta: rol, apoi al doilea factor, la fel ca la emiterea actelor ——
  const cod = taie(body.cod, 60);
  let eu = null;
  if (actorDinCod(cod)?.rol === "admin") eu = { rol: "admin", cine: "administrator" };
  else {
    const r = await registratorDinCod(cod);
    if (r) eu = { rol: "registratura", cine: r.nume || r.id || "registratură" };
  }
  if (!eu) return json({ eroare: "Nepermis." }, 403);

  const s = store();
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ eroare: "Citirea documentelor nu e pornită pe server (lipsește cheia de API)." }, 503);
  }

  const id = taie(body.id, 40);
  const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
  if (!d) return json({ eroare: "Dosar inexistent." }, 404);

  // —— Plafonul zilei, verificat ÎNAINTE de a cheltui ——
  const cheieZi = "citire/zi/" + azi();
  const zi = (await s.get(cheieZi, { type: "json" }).catch(() => null)) || { cereri: 0, jIn: 0, jOut: 0, usd: 0 };
  if (zi.usd >= PLAFON_ZI) {
    return json({
      eroare: `S-a atins plafonul de citire pe ziua de azi (${PLAFON_ZI} $). ` +
        `Astăzi s-au citit ${zi.cereri} dosare. Dacă e nevoie de mai mult, se ridică plafonul din Netlify (CITIRE_PLAFON_ZI).`,
    }, 429);
  }

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
      console.error("registratura-citeste:", fel, err?.message || err);
      continue;
    }

    jIn += r.usage?.input_tokens ?? 0;
    jOut += r.usage?.output_tokens ?? 0;

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
        titluri: "",
        sigur: true,
        nelamurire: "",
        din: cine,
      };
    }

    // —— Comparația cu ce a declarat crescătorul ——
    // Nu corectăm nimic automat: doar arătăm unde nu se potrivesc. Comparația asta a prins,
    // la cuibul 26, patru numere lipsă și trei greșeli de transcriere pe care nu le văzuse
    // nimeni — tocmai fiindcă fiecare, luată separat, arăta corect.
    nepotriviri.push(...nepotrivirile({
      declarat: d[declaratie] || {},
      citit: scos.caine || {},
      rasaDosar: d.rasa,
      eticheta: cine.toLowerCase(),
    }));

    citite.push({ fel, cine, stare: "citit", pozitii: mutate.luate, nesigure: mutate.nesigure });
  }

  const cost = jIn * PRET.intrare + jOut * PRET.iesire;
  const nesigure = Object.values(propuneri).filter((p) => !p.sigur).length;

  // —— Urma: cât s-a cheltuit azi și ce s-a propus la acest dosar ——
  // Se scrie ÎN AFARA dosarului, într-o cheie a ei. Dosarul rămâne neatins: dacă mâine
  // cineva se întreabă de unde a apărut o poziție, urma spune ce a propus citirea, iar
  // dosarul spune ce a salvat omul — două lucruri care trebuie să rămână deosebite.
  try {
    await s.setJSON(cheieZi, {
      cereri: (zi.cereri || 0) + 1,
      jIn: (zi.jIn || 0) + jIn,
      jOut: (zi.jOut || 0) + jOut,
      usd: Number(((zi.usd || 0) + cost).toFixed(6)),
    });
    await s.setJSON("citire/urma/" + id, {
      cand: new Date().toISOString(),
      deCatre: eu.cine, rol: eu.rol,
      serie: d.serie || null,
      model: MODEL,
      citite, propuneri, nepotriviri,
      jetoane: { intrare: jIn, iesire: jOut },
      usd: Number(cost.toFixed(6)),
    });
  } catch (err) {
    // Urma e pentru raport, nu pentru act. Dacă nu se scrie, citirea rămâne bună — dar se
    // vede în jurnalul serverului că socoteala zilei a rămas în urmă.
    console.error("registratura-citeste: urma nu s-a scris:", err?.message || err);
  }

  const citit = citite.filter((c) => c.stare === "citit").length;
  return json({
    ok: true,
    id,
    citite,
    propuneri,
    cunoscute: Object.keys(propuneri).length,
    din: coduri.length,
    nesigure,
    nepotriviri,
    jetoane: { intrare: jIn, iesire: jOut },
    cost: { usd: Number(cost.toFixed(6)), explicatie: `~${(cost * 100).toFixed(2)} cenți pentru acest dosar` },
    mesaj: citit === 0
      ? "Niciun certificat n-a putut fi citit. Vezi lista de mai sus pentru motiv."
      : `Citite ${citit} din 2 certificate. ${Object.keys(propuneri).length} din 30 de poziții propuse` +
        (nesigure ? `, dintre care ${nesigure} nesigure.` : "."),
    // Spus pe față, ca nimeni să nu creadă că s-a salvat ceva.
    atentie: "Nimic nu s-a scris în ascendența dosarului. Astea sunt propuneri: verifică-le și salvează tu.",
  });
});
