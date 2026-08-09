// progres-cursuri.mjs — progresul PERSONAL al unui candidat (per cod individual).
// POST { id: <codul candidatului> } -> { "modul-1": { procent, promovat, data }, ... }
// M1: câmpul `id` poartă acum CODUL candidatului, nu insigna (care ajungea la lectori).
// Serverul calculează insigna: id_intern = sha256(cod). Cheia rămâne progres/<insignă>/<modul>
// (scrisă de test-modul.mjs). Aici le adunăm într-un singur obiect pentru tablou.
import { getStore } from "@netlify/blobs";
import { sha256 } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

// Codul candidatului (câmpul `id`) se poate ghici — limităm, ca „{}" vs progres real să
// nu fie un oracol de validare a codurilor.
export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  const cod = String(body.id || "").trim();
  const id = cod ? sha256(cod) : "";
  if (!id) return json({});

  const out = {};
  try {
    const store = getStore("cursuri");
    const prefix = "progres/" + id + "/";
    const { blobs } = await store.list({ prefix });
    for (const b of blobs) {
      const r = await store.get(b.key, { type: "json" });
      if (r) out[b.key.slice(prefix.length)] = r;
    }
  } catch (err) {
    console.error("Citire progres eșuată:", err);
  }
  return json(out);
});
