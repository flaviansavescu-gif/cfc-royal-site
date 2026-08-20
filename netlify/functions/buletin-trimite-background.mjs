// =========================================================================
// buletin-trimite-background.mjs — trimiterea Buletinului Școlii, în FUNDAL.
//
// Numele terminat în `-background` nu e un moft: așa recunoaște Netlify o funcție de
// fundal — răspunde 202 pe loc și are 15 minute la dispoziție, în loc de 10 secunde.
// Trimiterea sincronă ar fi fost retezată pe la ~120–150 de abonați: o parte primeau
// buletinul, o parte nu, fără nicio eroare vizibilă.
//
// NU E O ADRESĂ PUBLICĂ ÎN FAPT, DEȘI E ÎN DREPT (același tipar ca la
// registratura-citeste-background): funcția își cere singură dovada — un jeton de o
// singură folosință, scris de poarta de administrare cu câteva clipe înainte. Fără el,
// nu pleacă nimic: altfel ar fi un buton de trimis e-mailuri în masă, deschis pe internet.
//
// REZULTATUL nu se pierde: se scrie în `buletin-trimitere/<key>` (câți au primit, câți
// au eșuat, când s-a terminat), de unde panoul de administrare îl arată la cerere.
// =========================================================================
import { getStore } from "@netlify/blobs";
import { trimite } from "./_comun/posta.mjs";
import { cheieDezabonare, jetonDezabonare } from "./_comun/buletin-acord.mjs";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Cât trăiește jetonul de pornire: pornirea vine imediat după scriere, nu peste ore. */
const VALABILITATE_JETON_MS = 10 * 60e3;

export default async (req) => {
  if (req.method !== "POST") return new Response("", { status: 405 });
  let body;
  try { body = await req.json(); } catch { return new Response("", { status: 400 }); }

  const jeton = String(body.jeton || "");
  if (!/^[0-9a-f]{32}$/.test(jeton)) return new Response("", { status: 403 });

  const store = getStore("cursuri");
  const comanda = await store.get("buletin-fundal/" + jeton, { type: "json" }).catch(() => null);
  // O SINGURĂ folosință: jetonul se șterge înainte de orice trimitere, ca o a doua
  // cerere cu același jeton să nu retrimită buletinul întregii liste.
  await store.delete("buletin-fundal/" + jeton).catch(() => {});
  if (!comanda?.key || !comanda?.titlu) return new Response("", { status: 403 });
  if (Date.now() - Date.parse(comanda.creat || 0) > VALABILITATE_JETON_MS) {
    console.error("Jeton de trimitere expirat pentru", comanda.key);
    return new Response("", { status: 403 });
  }

  const { key, titlu, text } = comanda;
  const pornit = new Date().toISOString();

  // Abonații, fiecare cu jetonul lui de dezabonare (linkul din subsol e personal).
  let abonati = [];
  try {
    const { blobs } = await store.list({ prefix: "abonat/" });
    for (const b of blobs) {
      const a = await store.get(b.key, { type: "json" }).catch(() => null);
      if (!a?.email) continue;
      abonati.push({ email: a.email, jeton: await jetonDezabonare(store, b.key, a) });
    }
  } catch (err) { console.error("Lista abonaților nu s-a putut citi:", err); }

  const corp =
    `<h2 style="margin:0 0 12px;color:#1F4D3A">${esc(titlu)}</h2>` +
    `<div style="white-space:pre-line;line-height:1.55">${esc(text)}</div>` +
    `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">`;
  const htmlPentru = (j) =>
    corp +
    `<p style="color:#888;font-size:12px">Buletinul Școlii de Arbitraj — CFC-Royal · ` +
    `arhiva completă: <a href="https://cfc-royal.ro/cursuri/buletin/">cfc-royal.ro/cursuri/buletin/</a></p>` +
    (j
      ? `<p style="color:#888;font-size:12px">Nu mai vrei buletinul? ` +
        `<a href="https://cfc-royal.ro/.netlify/functions/buletin-dezabonare?j=${j}">Dezabonează-mă</a>` +
        ` — un singur clic, fără cod și fără formular.</p>`
      : `<p style="color:#888;font-size:12px">Dezabonarea: din pagina buletinului, cu codul tău.</p>`);

  // În LOTURI paralele — nu pentru plafonul de timp (aici avem 15 minute), ci ca lista
  // mare să plece în minute, nu în sfert de oră.
  let trimise = 0, esuate = 0;
  const LOT = 8;
  async function trimiteUnul({ email, jeton: j }) {
    const ok = await trimite({
      catre: email,
      subiect: "[Școala de Arbitraj] " + titlu,
      html: htmlPentru(j),
      expeditor: { name: "Școala de Arbitraj CFC-Royal", email: "newsletter@cfc-royal.ro" },
    });
    if (ok) trimise++; else esuate++;
  }
  for (let i = 0; i < abonati.length; i += LOT) {
    await Promise.all(abonati.slice(i, i + LOT).map(trimiteUnul));
  }

  await store.setJSON("buletin-trimitere/" + key.replace(/^buletin\//, ""), {
    key, abonati: abonati.length, trimise, esuate, pornit, terminat: new Date().toISOString(),
  }).catch((err) => console.error("Rezultatul trimiterii nu s-a putut scrie:", err));

  console.log(`Buletin ${key}: ${trimise} trimise, ${esuate} eșuate, din ${abonati.length} abonați.`);
  return new Response("", { status: 200 });
};
