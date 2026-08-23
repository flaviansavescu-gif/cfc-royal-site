// =========================================================================
// registratura-citeste.mjs — poarta citirii pedigree-urilor. PORNEȘTE și SPUNE STAREA.
//
// DE CE E ÎMPĂRȚITĂ ÎN DOUĂ. Prima versiune citea documentele chiar aici și întorcea
// răspunsul. Măsurat pe cuibul 26: 36 de secunde pentru două documente. Funcțiile
// obișnuite ale Netlify se opresc la 10 secunde (26 pe planurile plătite), așa că
// butonul ar fi dat eroare de rețea — dar cererea către API mergea mai departe, deci
// banii se cheltuiau. Și, fiindcă socoteala zilei se scria la sfârșit, nici plafonul nu
// se mai incrementa: cheltuiala devenea invizibilă exact când nimic nu funcționa.
//
// Acum: aici se verifică dreptul și plafonul, se însemnează „în lucru" și se cheamă
// funcția de fundal (aceea are 15 minute). Pagina întreabă din când în când de stare.
//
//   POST { cod, dispozitiv, id, actiune: "porneste" }  -> { pornit: true }
//   POST { cod, dispozitiv, id, actiune: "stare" }     -> { stare, ...rezultatul }
// =========================================================================
import { getStore } from "@netlify/blobs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import {
  PLAFON_ZI, cheiaZilei, cheiaStarii, cheiaJetonului, jetonNou, amprenta, ABANDONAT_MS,
} from "./_comun/citire-documente.mjs";

import { json as raspunsJson } from "./_comun/raspuns.mjs";
// Lizibil: răspunsurile acestei unelte se citesc de OM (panou de administrare,
// depanare), nu de cod — restul politicii (charset, no-store) vine din locul comun.
const json = (b, s = 200) => raspunsJson(b, s, { lizibil: true });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const store = () => getStore({ name: "registru", consistency: "strong" });

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  // —— Poarta: rol, apoi al doilea factor, ca la emiterea actelor ——
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
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403, { antete: { "x-refuz-drept": "1" } });
  }

  const id = taie(body.id, 40);
  const actiune = taie(body.actiune, 16) || "porneste";

  /**
   * Socoteala zilei, trimisă odată cu starea.
   *
   * Contorul exista în magazie, dar nu-l vedea nimeni — deci plafonul era o frână despre
   * care aflai abia când te izbeai de ea. Cheltuiala trebuie să fie la vedere înainte, nu
   * după.
   */
  const socoteala = async () => {
    const zi = (await s.get(cheiaZilei(), { type: "json" }).catch(() => null)) || { cereri: 0, usd: 0 };
    return {
      dosare: zi.cereri || 0,
      usd: Number((zi.usd || 0).toFixed(4)),
      plafon: PLAFON_ZI,
      procent: Math.min(100, Math.round(((zi.usd || 0) / PLAFON_ZI) * 100)),
    };
  };

  // —— Starea unei citiri pornite ——
  if (actiune === "stare") {
    const st = await s.get(cheiaStarii(id), { type: "json" }).catch(() => null);
    if (!st) return json({ stare: "nepornit", azi: await socoteala() });
    if (st.stare === "gata" || st.stare === "cazut") return json({ ...st, azi: await socoteala() });
    // O citire rămasă „în lucru" de prea mult timp e moartă, nu în curs. Fără regula
    // asta, o funcție căzută ar bloca dosarul pentru totdeauna, iar registratorul n-ar
    // avea niciun mijloc să reia — decât să ceară cuiva să șteargă o cheie din magazie.
    if (st.stare === "in-lucru" && Date.now() - Date.parse(st.pornitLa || 0) > ABANDONAT_MS) {
      return json({ stare: "abandonat", pornitLa: st.pornitLa,
        mesaj: "Citirea pornită mai devreme nu s-a mai terminat. Poți încerca din nou." });
    }
    return json(st);
  }

  if (actiune !== "porneste") return json({ eroare: "Acțiune necunoscută." }, 400);

  // —— Pornirea ——
  const d = await s.get("dmf/" + id, { type: "json" }).catch(() => null);
  if (!d) return json({ eroare: "Dosar inexistent." }, 404);

  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ eroare: "Citirea documentelor nu e pornită pe server (lipsește cheia de API)." }, 503);
  }

  // Nu pornim două citiri deodată pe același dosar: a doua ar plăti încă o dată pentru
  // exact același răspuns.
  const veche = await s.get(cheiaStarii(id), { type: "json" }).catch(() => null);
  if (veche?.stare === "in-lucru" && Date.now() - Date.parse(veche.pornitLa || 0) <= ABANDONAT_MS) {
    return json({ pornit: false, stare: "in-lucru", pornitLa: veche.pornitLa,
      mesaj: "O citire e deja în lucru pe acest dosar. Așteapt-o." });
  }

  // Plafonul zilei, verificat ÎNAINTE de a cheltui.
  const zi = (await s.get(cheiaZilei(), { type: "json" }).catch(() => null)) || { cereri: 0, usd: 0 };
  if ((zi.usd || 0) >= PLAFON_ZI) {
    return json({
      eroare: `S-a atins plafonul de citire pe ziua de azi (${PLAFON_ZI} $). ` +
        `Astăzi s-au citit ${zi.cereri || 0} dosare. Dacă e nevoie de mai mult, se ridică plafonul din Netlify (CITIRE_PLAFON_ZI).`,
    }, 429);
  }

  // Cheie de o singură folosință pentru funcția de fundal. Ea e o adresă publică, iar
  // codul registratorului n-are ce căuta trecut mai departe de-a lungul lanțului: cu cât
  // circulă prin mai multe locuri, cu atât are mai multe feluri de a scăpa. Amprenta
  // rămâne în magazie, jetonul pleacă o dată și se stinge la prima folosire.
  const jeton = jetonNou();
  await s.setJSON(cheiaJetonului(id), { amprenta: amprenta(jeton), creat: new Date().toISOString() });

  await s.setJSON(cheiaStarii(id), {
    stare: "in-lucru",
    pornitLa: new Date().toISOString(),
    deCatre: eu.cine,
    rol: eu.rol,
  });

  // Funcția de fundal răspunde 202 pe loc, deci așteptarea de aici e scurtă.
  //
  // Adresa vine din mediul site-ului, nu din cerere: originea din `req.url` e antetul
  // Host, adică un rând scris de cel care trimite. Cine l-ar strâmba ar face ca jetonul
  // să plece spre serverul lui. URL e pus de Netlify la fiecare publicare; cererea rămâne
  // doar ca ultimă scăpare, pentru rulatul local, unde URL lipsește.
  const origine = process.env.URL || new URL(req.url).origin;
  const adresa = origine + "/.netlify/functions/registratura-citeste-background";
  try {
    const r = await fetch(adresa, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, jeton, deCatre: eu.cine, rol: eu.rol }),
    });
    if (r.status !== 202 && !r.ok) throw new Error("fundalul a răspuns " + r.status);
  } catch (err) {
    // Dacă n-a pornit, ștergem însemnarea: altfel dosarul ar arăta „în lucru" cinci
    // minute, pentru o citire care n-a început niciodată.
    await s.delete(cheiaStarii(id)).catch(() => {});
    await s.delete(cheiaJetonului(id)).catch(() => {});
    console.error("registratura-citeste: pornirea a eșuat:", err?.message || err);
    return json({ eroare: "Nu am putut porni citirea: " + (err?.message || String(err)) }, 502);
  }

  return json({
    pornit: true,
    stare: "in-lucru",
    mesaj: "Citirea a pornit. Durează în jur de o jumătate de minut pentru două documente.",
  });
});
