// asistente-cursuri.mjs — stagiul practic: cele 5 asistențe de ring ale candidaților.
// Store "cursuri" (Netlify Blobs):
//   asistente/expozitii            -> [ { nr:1..5, nume, data, locatie, arbitru } ]  (arbitru = cel care coordonează ringul în ziua respectivă)
//   asistente/numire/<candidatId>  -> { "1": stare, ..., "5": stare }  (stare: "" | "numit" | "prezent" | "absent")
//   asistente/evaluare/<candidatId>-> { "1": {calificativ, observatii, arbitru, expozitie, evaluatLa}, ... }
//
// GET (public)                                  -> { expozitii }               (candidații văd programul)
// POST { id, actiune:"eu" }                     -> { expozitii, numiri, evaluari } (candidatul își vede numirile ȘI evaluările — decizie 21.07.2026: evaluarea e vizibilă candidatului)
// POST { cod, actiune:"admin" }                 -> { expozitii, numiri, evaluari } (adminul vede tot)
// POST { cod, actiune:"salveaza-expozitii", expozitii } -> { ok, expozitii }
// POST { cod, actiune:"salveaza-numire", candidatId, numiri } -> { ok }
//
// Puntea cu CFCR Expo Manager (secret comun EXPO_SYNC_SECRET) — ziua expoziției se
// întâmplă în manager, dosarul candidatului rămâne AICI:
// POST { secret, actiune:"manager-stare" }      -> { expozitii, candidati, numiri, evaluari }
// POST { secret, actiune:"manager-prezenta", candidatId, nr, stare } -> { ok }
// POST { secret, actiune:"manager-evaluare", candidatId, nr, evaluare } -> { ok }
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";
const NR_ASISTENTE = 5;
const STARI = ["", "numit", "prezent", "absent"];
// Scara evaluării prestației (decizie 21.07.2026) + observațiile text ale arbitrului.
const CALIFICATIVE = ["foarte_bine", "bine", "satisfacator", "nesatisfacator"];

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

/** Evaluările unui candidat, normalizate pe cele 5 sloturi (null unde nu există). */
function evaluariCurate(obj) {
  const out = {};
  for (let i = 1; i <= NR_ASISTENTE; i++) {
    const e = obj && obj[i];
    out[i] =
      e && CALIFICATIVE.includes(e.calificativ)
        ? {
            calificativ: e.calificativ,
            observatii: taie(e.observatii, 2000),
            arbitru: taie(e.arbitru, 140),
            expozitie: taie(e.expozitie, 160),
            evaluatLa: taie(e.evaluatLa, 40),
          }
        : null;
  }
  return out;
}

async function citesteEvaluari(store, candidatId) {
  const e = await store.get("asistente/evaluare/" + candidatId, { type: "json" }).catch(() => null);
  return evaluariCurate(e || {});
}

async function toateEvaluarile(store) {
  const evaluari = {};
  try {
    const { blobs } = await store.list({ prefix: "asistente/evaluare/" });
    for (const b of blobs) {
      const cid = b.key.slice("asistente/evaluare/".length);
      const e = await store.get(b.key, { type: "json" }).catch(() => null);
      if (e) evaluari[cid] = evaluariCurate(e);
    }
  } catch (err) {
    console.error("Listare evaluări eșuată:", err);
  }
  return evaluari;
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

  // ——— Candidatul își vede propriile numiri ȘI evaluări (id = sha256(cod)) ———
  if (actiune === "eu") {
    const id = taie(body.id, 128);
    const expozitii = await citesteExpozitii(store);
    let numiri = numiriCurate({});
    let evaluari = evaluariCurate({});
    if (id) {
      try {
        const n = await store.get("asistente/numire/" + id, { type: "json" });
        if (n) numiri = numiriCurate(n);
      } catch {}
      evaluari = await citesteEvaluari(store, id);
    }
    return json({ expozitii, numiri, evaluari });
  }

  // ——— Puntea cu Expo Manager (secretul comun al expozițiilor) ———
  // Ziua expoziției trăiește în manager: acolo se confirmă prezența reală și acolo
  // arbitrul de bază evaluează prestația. Dosarul candidatului rămâne aici.
  if (String(actiune).startsWith("manager-")) {
    if (!process.env.EXPO_SYNC_SECRET || body.secret !== process.env.EXPO_SYNC_SECRET) {
      return json({ eroare: "Neautorizat." }, 401);
    }

    if (actiune === "manager-stare") {
      const candidati = [];
      try {
        const { blobs } = await store.list({ prefix: "candidat/" });
        for (const b of blobs) {
          const c = await store.get(b.key, { type: "json" }).catch(() => null);
          if (c) candidati.push({ id: b.key.slice("candidat/".length), nume: taie(c.nume, 140) });
        }
      } catch (err) {
        console.error("Listare candidați eșuată:", err);
      }
      candidati.sort((a, b) => a.nume.localeCompare(b.nume, "ro"));
      const numiri = {};
      try {
        const { blobs } = await store.list({ prefix: "asistente/numire/" });
        for (const b of blobs) {
          const n = await store.get(b.key, { type: "json" }).catch(() => null);
          if (n) numiri[b.key.slice("asistente/numire/".length)] = numiriCurate(n);
        }
      } catch (err) {
        console.error("Listare numiri eșuată:", err);
      }
      return json({ expozitii: await citesteExpozitii(store), candidati, numiri, evaluari: await toateEvaluarile(store) });
    }

    const cid = taie(body.candidatId, 128);
    const nr = Number(body.nr);
    if (!cid || !(nr >= 1 && nr <= NR_ASISTENTE)) return json({ eroare: "Candidat sau slot invalid." }, 400);
    const exista = await store.get("candidat/" + cid, { type: "json" }).catch(() => null);
    if (!exista) return json({ eroare: "Candidat inexistent." }, 404);

    if (actiune === "manager-prezenta") {
      const stare = String(body.stare || "");
      // Managerul confirmă doar realitatea din ring: prezent/absent (sau înapoi la numit).
      if (!["numit", "prezent", "absent"].includes(stare)) return json({ eroare: "Stare invalidă." }, 400);
      const n = numiriCurate((await store.get("asistente/numire/" + cid, { type: "json" }).catch(() => null)) || {});
      n[nr] = stare;
      await store.setJSON("asistente/numire/" + cid, n);
      return json({ ok: true });
    }

    if (actiune === "manager-evaluare") {
      const ev = body.evaluare || {};
      if (!CALIFICATIVE.includes(ev.calificativ)) return json({ eroare: "Calificativ invalid." }, 400);
      const toate = evaluariCurate((await store.get("asistente/evaluare/" + cid, { type: "json" }).catch(() => null)) || {});
      toate[nr] = {
        calificativ: ev.calificativ,
        observatii: taie(ev.observatii, 2000),
        arbitru: taie(ev.arbitru, 140),
        expozitie: taie(ev.expozitie, 160),
        evaluatLa: new Date().toISOString(),
      };
      await store.setJSON("asistente/evaluare/" + cid, toate);
      return json({ ok: true });
    }

    return json({ eroare: "Acțiune necunoscută." }, 400);
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
    return json({ expozitii, numiri, evaluari: await toateEvaluarile(store) });
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
