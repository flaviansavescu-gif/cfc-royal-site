// autorizare-cursuri.mjs — autorizarea arbitrilor pe grupe WDF (1–10).
// Store "cursuri" (Netlify Blobs):
//   autorizare/<candidatId> -> { grupe: [1,3,4,...], data }
//
// POST { id, actiune:"eu" }                      -> { grupe }               (candidatul își vede autorizarea)
// POST { cod, actiune:"admin" }                  -> { autorizari:{cid:[...]} } (adminul vede tot)
// POST { cod, actiune:"salveaza", candidatId, grupe } -> { ok, grupe }
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";
const GRUPE_VALIDE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

// Curăță lista de grupe: doar numere 1–10, unice, sortate.
function grupeCurate(arr) {
  if (!Array.isArray(arr)) return [];
  const set = new Set();
  for (const x of arr) {
    const n = Number(x);
    if (GRUPE_VALIDE.includes(n)) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const store = getStore("cursuri");
  const actiune = body.actiune || "eu";

  // ——— Candidatul își vede propria autorizare ———
  if (actiune === "eu") {
    const id = taie(body.id, 128);
    let grupe = [];
    if (id) {
      try {
        const a = await store.get("autorizare/" + id, { type: "json" });
        if (a) grupe = grupeCurate(a.grupe);
      } catch {}
    }
    return json({ grupe });
  }

  // ——— De aici, doar administratorul ———
  if (sha256(body.cod || "") !== ADMIN_HASH)
    return json({ eroare: "Cod de administrator incorect." }, 401);

  if (actiune === "admin") {
    const autorizari = {};
    try {
      const { blobs } = await store.list({ prefix: "autorizare/" });
      for (const b of blobs) {
        const cid = b.key.slice("autorizare/".length);
        const a = await store.get(b.key, { type: "json" });
        if (a) autorizari[cid] = grupeCurate(a.grupe);
      }
    } catch (err) { console.error("Listare autorizări eșuată:", err); }
    return json({ autorizari });
  }

  if (actiune === "salveaza") {
    const cid = taie(body.candidatId, 128);
    if (!cid) return json({ eroare: "Lipsește candidatul." }, 400);
    const exista = await store.get("candidat/" + cid, { type: "json" }).catch(() => null);
    if (!exista) return json({ eroare: "Candidat inexistent." }, 404);
    const grupe = grupeCurate(body.grupe);
    await store.setJSON("autorizare/" + cid, { grupe, data: new Date().toISOString() });
    return json({ ok: true, grupe });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
};
