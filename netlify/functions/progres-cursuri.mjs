// progres-cursuri.mjs — progresul PERSONAL al unui candidat (per cod individual).
// POST { id } -> { "modul-1": { procent, promovat, data }, ... }  (obiect gol dacă nu există)
// `id` = sha256(codul candidatului). Progresul se scrie de către test-modul.mjs la
// fiecare test promovat/susținut (se păstrează cel mai bun rezultat per modul).
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

  let p = null;
  try {
    p = await getStore("cursuri").get("progres/" + id, { type: "json" });
  } catch (err) {
    console.error("Citire progres eșuată:", err);
  }
  return json(p || {});
};
