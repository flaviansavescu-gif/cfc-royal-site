// stare-cursuri.mjs — starea „online/ascuns" a modulelor platformei de cursuri.
// GET  -> starea tuturor modulelor (public: paginile candidaților o citesc la deschidere).
// POST -> comută un modul (DOAR cu codul de administrator; codul se verifică prin SHA-256
//         aici, pe server — amprenta de mai jos nu poate fi folosită pentru a comuta).
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";

export default async (req) => {
  // Magazia se deschide în fiecare ramură, DUPĂ ce ramura și-a verificat dreptul.
  // Pe calea publică (GET) e imediat; pe cea de scriere, abia după poarta de cod.
  if (req.method === "GET") {
    const stare = (await getStore("cursuri").get("stare-module", { type: "json" })) || {};
    return Response.json(stare, { headers: { "Cache-Control": "no-store" } });
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
    const stare = (await store.get("stare-module", { type: "json" })) || {};
    stare[id] = !!online;
    await store.setJSON("stare-module", stare);
    return Response.json({ ok: true, stare });
  }

  return Response.json({ eroare: "Metodă nepermisă." }, { status: 405 });
};
