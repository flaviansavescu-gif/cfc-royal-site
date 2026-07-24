// login-cursuri.mjs — verifică un cod INDIVIDUAL de candidat (server-side).
// POST { cod } -> { rol:"candidat", nume, id }  dacă există un candidat cu acest cod.
// Codurile de administrator și de lector NU trec pe aici — ele se verifică direct
// în pagina de intrare (client-side, ca până acum). Aici doar codurile personale.
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

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

  const cod = String(body.cod || "").trim();
  if (!cod) return json({ eroare: "Cod lipsă." }, 400);

  const id = sha256(cod);
  const store = getStore("cursuri");
  let cand = null;
  try {
    cand = await store.get("candidat/" + id, { type: "json" });
  } catch (err) {
    console.error("Căutare candidat eșuată:", err);
  }
  if (!cand) return json({ eroare: "Cod incorect." }, 404);

  // Marcăm prima și ultima intrare a candidatului în platformă (evidența înscrierilor
  // pentru administrator). Nu blocăm autentificarea dacă scrierea eșuează.
  try {
    const acum = new Date().toISOString();
    if (!cand.prima_logare) cand.prima_logare = acum;
    cand.ultima_logare = acum;
    await store.setJSON("candidat/" + id, cand);
  } catch (err) {
    console.error("Nu am putut marca intrarea candidatului:", err);
  }

  return json({ rol: "candidat", nume: cand.nume, id });
};
