// paznic-extern.mjs — check-in-ul paznicului de disponibilitate din GitHub Actions.
//
// DE CE. GitHub Actions veghează Netlify + inimile funcțiilor programate, dar deasupra LUI
// nu era nimeni: dacă workflow-ul `paznic.yml` e dezactivat (GitHub oprește cron-urile pe
// depozite inactive), șters sau mutat de pe ramura implicită, toată monitorizarea se stingea
// ÎN TĂCERE. Aici paznicii se veghează RECIPROC: paznicul din GitHub își bate o urmă la
// fiecare rulare (GET aici), iar `monitor-flux` (Netlify Scheduler, e-mail prin Brevo — canal
// INDEPENDENT de GitHub) sună dacă urma se învechește peste prag.
//
// PUBLIC ȘI FĂRĂ CHEI, ca să nu rupem regula „paznicul din Actions nu ține secrete": singurul
// care ar câștiga falsificând prospețimea e cineva care DEJA controlează depozitul (ca să-și
// ascundă că a oprit paznicul) — adică a câștigat deja. Scrierea e un singur timestamp, deci
// nici ca pârghie de umplere a magaziei nu folosește.
import { getStore } from "@netlify/blobs";
import { json } from "./_comun/raspuns.mjs";

/** Cheia urmei, în magazia „acces". Citită de monitor-flux. */
export const CHEIE_PAZNIC_EXTERN = "paznic-extern";

export default async () => {
  try {
    await getStore("acces").setJSON(CHEIE_PAZNIC_EXTERN, { la: new Date().toISOString() });
  } catch (err) {
    console.error("Check-in paznic extern eșuat:", err?.message || err);
    return json({ ok: false }, 500);
  }
  return json({ ok: true });
};
