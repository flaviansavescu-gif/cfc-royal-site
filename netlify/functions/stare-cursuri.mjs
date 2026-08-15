// stare-cursuri.mjs — starea „online/ascuns" a modulelor platformei de cursuri
// și TERMENELE testelor (până când se poate susține fiecare test + penalizarea
// ferestrei de reactivare).
// GET  -> starea tuturor modulelor + termenele, sub cheia rezervată `_termene`
//         (public: paginile candidaților le citesc la deschidere).
// POST -> comută un modul sau setează un termen (DOAR cu codul de administrator;
//         codul se verifică prin SHA-256 aici, pe server).
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { curataPenalizarea } from "./_comun/termen-test.mjs";

// LIMITARE (adăugată la auditul de securitate). Ca la rezultate-cursuri: poarta de scriere
// verifică un cod scurt de administrator și fără limitare era o ghicitoare nelimitată.
// `cuLimitareCod` numără doar cererile cu `cod` (deci lasă GET-ul public neatins) și
// blochează enumerarea pe IP.
export default cuLimitareCod(async (req) => {
  // Magazia se deschide în fiecare ramură, DUPĂ ce ramura și-a verificat dreptul.
  // Pe calea publică (GET) e imediat; pe cea de scriere, abia după poarta de cod.
  if (req.method === "GET") {
    const store = getStore("cursuri");
    const stare = (await store.get("stare-module", { type: "json" })) || {};
    // Termenele merg sub o cheie rezervată, cu underscore: cheile modulelor sunt slug-uri
    // (`modul-3`), deci `_termene` nu se poate ciocni cu niciun modul.
    const termene = (await store.get("termene-module", { type: "json" }).catch(() => null)) || {};
    return Response.json({ ...stare, _termene: termene }, { headers: { "Cache-Control": "no-store" } });
  }

  if (req.method === "POST") {
    let date;
    try {
      date = await req.json();
    } catch {
      return Response.json({ eroare: "Cerere invalidă." }, { status: 400 });
    }
    const { id, online, cod, dispozitiv } = date || {};
    if (!esteAdmin(cod)) return Response.json({ eroare: "Cod de administrator incorect." }, { status: 401 });
    // A doua cheie: codul singur nu mai deschide administrarea Școlii.
    if (!(await dispozitivCunoscut(getStore("cursuri"), String(dispozitiv || "").trim(), "admin")))
      return Response.json(
        { eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." },
        { status: 403 },
      );
    if (!id || typeof id !== "string") return Response.json({ eroare: "Lipsește modulul." }, { status: 400 });

    const store = getStore("cursuri");

    // ——— Termenul unui test (setare / reactivare / ștergere) ———
    // `pana` gol = testul rămâne (sau redevine) deschis fără termen și fără penalizare.
    // Fiecare fereastră veche se păstrează în istoric: se poate proba oricând cu ce
    // termen și ce penalizare a fost deschisă o perioadă de susținere.
    if (date.actiune === "termen") {
      const termene = (await store.get("termene-module", { type: "json" }).catch(() => null)) || {};
      const vechi = termene[id];
      const fereastraVeche = vechi && vechi.pana
        ? [{ pana: vechi.pana, penalizare: vechi.penalizare || 0, setatLa: vechi.setatLa }]
        : [];
      const istoric = [...((vechi && vechi.istoric) || []), ...fereastraVeche].slice(-20);

      const panaBrut = String(date.pana || "").trim();
      if (!panaBrut) {
        termene[id] = { pana: null, penalizare: 0, setatLa: new Date().toISOString(), istoric };
      } else {
        const pana = Date.parse(panaBrut);
        if (!Number.isFinite(pana)) return Response.json({ eroare: "Termenul nu e o dată validă." }, { status: 400 });
        termene[id] = {
          pana: new Date(pana).toISOString(),
          penalizare: curataPenalizarea(date.penalizare),
          setatLa: new Date().toISOString(),
          istoric,
        };
      }
      await store.setJSON("termene-module", termene);
      return Response.json({ ok: true, termene });
    }

    const stare = (await store.get("stare-module", { type: "json" })) || {};
    stare[id] = !!online;
    await store.setJSON("stare-module", stare);
    return Response.json({ ok: true, stare });
  }

  return Response.json({ eroare: "Metodă nepermisă." }, { status: 405 });
});
