// stare-cursuri.mjs — starea „online/ascuns" a modulelor platformei de cursuri.
// GET  -> starea tuturor modulelor (public: paginile candidaților o citesc la deschidere).
// POST -> comută un modul (DOAR cu codul de administrator; codul se verifică prin SHA-256
//         aici, pe server — amprenta de mai jos nu poate fi folosită pentru a comuta).
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";

export default async (req) => {
  const store = getStore("cursuri");

  if (req.method === "GET") {
    const stare = (await store.get("stare-module", { type: "json" })) || {};
    return Response.json(stare, { headers: { "Cache-Control": "no-store" } });
  }

  if (req.method === "POST") {
    let date;
    try {
      date = await req.json();
    } catch {
      return Response.json({ eroare: "Cerere invalidă." }, { status: 400 });
    }
    const { id, online, cod } = date || {};
    const hash = createHash("sha256").update(String(cod || "")).digest("hex");
    if (hash !== ADMIN_HASH) return Response.json({ eroare: "Cod de administrator incorect." }, { status: 401 });
    if (!id || typeof id !== "string") return Response.json({ eroare: "Lipsește modulul." }, { status: 400 });

    const stare = (await store.get("stare-module", { type: "json" })) || {};
    stare[id] = !!online;
    await store.setJSON("stare-module", stare);
    return Response.json({ ok: true, stare });
  }

  return Response.json({ eroare: "Metodă nepermisă." }, { status: 405 });
};
