// pornire-programata-background.mjs — plasa de rezervă a programatorului Netlify.
//
// DE CE. 02.09.2026, 17:00–21:06: programatorul Netlify a încetat să mai pornească
// `monitor-flux` (*/15) și `paznic-veghe` (*/30). Codul era bun, magazia scria, funcțiile
// existau în deploy — „Run now” din Netlify le rula cap-coadă. Doar declanșarea automată
// tăcea, ore în șir, fără incident anunțat. Cu inimile moarte, monitorizarea site-ului și
// veghea de intruziune stăteau — cu trei zile înainte de CACIB Iași.
//
// CE FACE. Paznicul din GitHub Actions (`paznic.yml`, la 10 minute) cheamă această funcție
// la fiecare rulare, iar ea pornește cele două funcții programate. Dacă programatorul
// Netlify merge, rulează amândoi — dublura e inofensivă (handlerele sunt idempotente:
// alertele pleacă doar la schimbare de stare, raportul o dată pe zi). Dacă programatorul
// tace, inimile bat oricum, din Actions.
//
// FĂRĂ CHEIE, ca `paznic-extern` — regula casei: paznicul din Actions nu ține secrete. Ce
// poate face un străin care o cheamă? Să pornească monitorizarea. Ca să nu poată nici măcar
// asta la nesfârșit (consum de invocări), există un PRAG GLOBAL în magazie: o singură pornire
// la 5 minute, oricine ar cere. Deci abuzul maxim = exact ce face și paznicul.
//
// `-background`: funcțiile HTTP au 10 secunde; monitor-flux face mai multe verificări în
// rețea și se poate apropia de prag. Fundalul răspunde 202 pe loc și are 15 minute.
import { getStore } from "@netlify/blobs";
import monitorFlux from "./monitor-flux.mjs";
import paznicVeghe from "./paznic-veghe.mjs";

export const CHEIE_ULTIMA_PORNIRE = "pornire-programata/ultima";
export const PRAG_PORNIRE_MS = 5 * 60 * 1000;

/** Rulează handlerul, consemnând rezultatul — un eșec al unuia nu-l oprește pe celălalt. */
async function ruleaza(nume, handler) {
  const t0 = Date.now();
  try {
    await handler();
    console.log(`pornire-programata: ${nume} a rulat (${Date.now() - t0} ms)`);
    return true;
  } catch (err) {
    console.error(`pornire-programata: ${nume} a căzut:`, err?.message || err);
    return false;
  }
}

export default async () => {
  const store = getStore("acces");
  const acum = Date.now();

  // Pragul global: o pornire la 5 minute. Dacă magazia nu poate fi citită, pornim oricum —
  // rezerva nu are voie să tacă exact când magazia e capricioasă (fail-open, jurnalizat).
  try {
    const ultima = await store.get(CHEIE_ULTIMA_PORNIRE, { type: "json" });
    const la = ultima?.la ? Date.parse(ultima.la) : 0;
    if (la && acum - la < PRAG_PORNIRE_MS) {
      console.log(`pornire-programata: sărit — ultima pornire acum ${Math.round((acum - la) / 1000)} s`);
      return new Response(null, { status: 202 });
    }
  } catch (err) {
    console.error("pornire-programata: pragul nu s-a putut citi, pornesc oricum:", err?.message || err);
  }
  try {
    await store.setJSON(CHEIE_ULTIMA_PORNIRE, { la: new Date(acum).toISOString() });
  } catch (err) {
    console.error("pornire-programata: urma pornirii nu s-a putut scrie:", err?.message || err);
  }

  await ruleaza("monitor-flux", monitorFlux);
  await ruleaza("paznic-veghe", paznicVeghe);
  return new Response(null, { status: 202 });
};
