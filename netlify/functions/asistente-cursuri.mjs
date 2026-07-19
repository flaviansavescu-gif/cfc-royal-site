// asistente-cursuri.mjs — stagiul practic: cele 5 asistențe de ring ale candidaților.
// Store "cursuri" (Netlify Blobs):
//   asistente/expozitii            -> [ { nr:1..5, nume, data, locatie, arbitru } ]  (arbitru = cel care coordonează ringul în ziua respectivă)
//   asistente/numire/<candidatId>  -> { "1": stare, ..., "5": stare }  (stare: "" | "numit" | "prezent" | "absent")
//
// GET (public)                                  -> { expozitii }               (candidații văd programul)
// POST { id, actiune:"eu" }                     -> { expozitii, numiri }        (candidatul își vede propriile numiri)
// POST { cod, actiune:"admin" }                 -> { expozitii, numiri:{...} }  (adminul vede tot)
// POST { cod, actiune:"salveaza-expozitii", expozitii } -> { ok, expozitii }
// POST { cod, actiune:"salveaza-numire", candidatId, numiri } -> { ok }
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";
const NR_ASISTENTE = 5;
const STARI = ["", "numit", "prezent", "absent"];

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

// Structura implicită: 5 expoziții nenumite.
function expozitiiGoale() {
  return Array.from({ length: NR_ASISTENTE }, (_, i) => ({
    nr: i + 1, nume: "", data: "", locatie: "", arbitru: "",
  }));
}

async function citesteExpozitii(store) {
  let e = null;
  try { e = await store.get("asistente/expozitii", { type: "json" }); } catch {}
  const goale = expozitiiGoale();
  if (!Array.isArray(e)) return goale;
  // Normalizăm exact la 5 sloturi, indexate după nr.
  return goale.map((g) => {
    const gasit = e.find((x) => x && Number(x.nr) === g.nr);
    return gasit
      ? { nr: g.nr, nume: taie(gasit.nume, 140), data: taie(gasit.data, 40), locatie: taie(gasit.locatie, 140), arbitru: taie(gasit.arbitru, 140) }
      : g;
  });
}

function numiriCurate(obj) {
  const out = {};
  for (let i = 1; i <= NR_ASISTENTE; i++) {
    const v = obj && obj[i] != null ? String(obj[i]) : "";
    out[i] = STARI.includes(v) ? v : "";
  }
  return out;
}

export default async (req) => {
  const store = getStore("cursuri");

  // GET public — doar programul celor 5 expoziții.
  if (req.method === "GET") {
    return json({ expozitii: await citesteExpozitii(store) });
  }

  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = body.actiune || "eu";

  // ——— Candidatul își vede propriile numiri (identificat prin id = sha256(cod)) ———
  if (actiune === "eu") {
    const id = taie(body.id, 128);
    const expozitii = await citesteExpozitii(store);
    let numiri = numiriCurate({});
    if (id) {
      try {
        const n = await store.get("asistente/numire/" + id, { type: "json" });
        if (n) numiri = numiriCurate(n);
      } catch {}
    }
    return json({ expozitii, numiri });
  }

  // ——— De aici încolo, doar administratorul ———
  if (sha256(body.cod || "") !== ADMIN_HASH)
    return json({ eroare: "Cod de administrator incorect." }, 401);

  if (actiune === "admin") {
    const expozitii = await citesteExpozitii(store);
    const numiri = {};
    try {
      const { blobs } = await store.list({ prefix: "asistente/numire/" });
      for (const b of blobs) {
        const cid = b.key.slice("asistente/numire/".length);
        const n = await store.get(b.key, { type: "json" });
        if (n) numiri[cid] = numiriCurate(n);
      }
    } catch (err) { console.error("Listare numiri eșuată:", err); }
    return json({ expozitii, numiri });
  }

  if (actiune === "salveaza-expozitii") {
    const primite = Array.isArray(body.expozitii) ? body.expozitii : [];
    const expozitii = expozitiiGoale().map((g) => {
      const x = primite.find((p) => p && Number(p.nr) === g.nr) || {};
      return { nr: g.nr, nume: taie(x.nume, 140), data: taie(x.data, 40), locatie: taie(x.locatie, 140), arbitru: taie(x.arbitru, 140) };
    });
    await store.setJSON("asistente/expozitii", expozitii);
    return json({ ok: true, expozitii });
  }

  if (actiune === "salveaza-numire") {
    const cid = taie(body.candidatId, 128);
    if (!cid) return json({ eroare: "Lipsește candidatul." }, 400);
    // Confirmăm că respectivul candidat există (evită chei orfane).
    const exista = await store.get("candidat/" + cid, { type: "json" }).catch(() => null);
    if (!exista) return json({ eroare: "Candidat inexistent." }, 404);
    await store.setJSON("asistente/numire/" + cid, numiriCurate(body.numiri || {}));
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
};
