// progres-cursuri.mjs — progresul PERSONAL al unui candidat (per cod individual).
// POST { id } -> { "modul-1": { procent, promovat, data }, ... }  (obiect gol dacă nu există)
// `id` = sha256(codul candidatului). Fiecare modul stă pe cheia lui: progres/<id>/<modul>
// (scrisă de test-modul.mjs). Aici le adunăm într-un singur obiect pentru tablou.
import { getStore } from "@netlify/blobs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  const id = String(body.id || "");
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
};
