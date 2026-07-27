// anunturi-cursuri.mjs — anunțurile platformei de cursuri (Școala de Arbitraj).
// GET (public) -> lista anunțurilor, cele mai noi primele (candidații le văd pe tablou).
// POST { cod, text }      -> publică un anunț (doar cu codul de administrator).
// POST { cod, delete:key } -> șterge un anunț.
// Fiecare anunț pe cheia lui (anunt/<ts>-<rand>) — fără curse, ștergere simplă.
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });

export default cuLimitareCod(async (req) => {
  const store = getStore("cursuri");

  if (req.method === "GET") {
    const anunturi = [];
    try {
      const { blobs } = await store.list({ prefix: "anunt/" });
      for (const b of blobs) {
        const a = await store.get(b.key, { type: "json" });
        if (a) anunturi.push({ ...a, key: b.key });
      }
    } catch (err) {
      console.error("Citire anunțuri eșuată:", err);
    }
    anunturi.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    return json(anunturi, 200, { "Cache-Control": "no-store" });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ eroare: "Cerere invalidă." }, 400);
    }
    if (!esteAdmin(body.cod)) return json({ eroare: "Cod de administrator incorect." }, 401);

    if (body.delete) {
      try {
        await store.delete(String(body.delete));
      } catch (err) {
        return json({ eroare: "Nu am putut șterge anunțul." }, 500);
      }
      return json({ ok: true });
    }

    const text = (body.text || "").trim();
    if (!text) return json({ eroare: "Anunțul este gol." }, 400);
    const key = "anunt/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    await store.setJSON(key, { text: text.slice(0, 1000), data: new Date().toISOString() });
    return json({ ok: true });
  }

  return json({ eroare: "Metodă nepermisă." }, 405);
});
