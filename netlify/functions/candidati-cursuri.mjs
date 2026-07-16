// candidati-cursuri.mjs — registrul candidaților (coduri individuale de acces).
// Totul necesită codul de administrator. Fiecare candidat pe cheia lui:
//   candidat/<sha256(cod)> -> { nume, cod, creat }
// Progresul candidatului stă separat, pe progres/<sha256(cod)> (vezi test-modul.mjs).
//
// POST { cod, actiune:"lista" }          -> [ { nume, cod, id, creat } ]  (adminul vede codurile ca să le distribuie)
// POST { cod, actiune:"adauga", nume }   -> { ok, candidat:{ nume, cod, id, creat } }  (generează un cod unic)
// POST { cod, actiune:"sterge", id }     -> { ok }  (șterge candidatul și progresul lui)
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";
// Alfabet fără caractere ambigue (0/O, 1/I/L) — codurile se dictează ușor la telefon.
const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

function codNou() {
  let c = "ARB-";
  for (let i = 0; i < 4; i++) c += ALFABET[Math.floor(Math.random() * ALFABET.length)];
  return c;
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  if (sha256(body.cod || "") !== ADMIN_HASH)
    return json({ eroare: "Cod de administrator incorect." }, 401);

  const store = getStore("cursuri");
  const actiune = body.actiune || "lista";

  if (actiune === "lista") {
    const lista = [];
    try {
      const { blobs } = await store.list({ prefix: "candidat/" });
      for (const b of blobs) {
        const c = await store.get(b.key, { type: "json" });
        if (c) lista.push({ nume: c.nume, cod: c.cod, creat: c.creat, id: b.key.slice("candidat/".length) });
      }
    } catch (err) {
      console.error("Listare candidați eșuată:", err);
    }
    lista.sort((a, b) => (a.nume || "").localeCompare(b.nume || "", "ro"));
    return json(lista);
  }

  if (actiune === "adauga") {
    const nume = (body.nume || "").trim();
    if (nume.length < 3) return json({ eroare: "Scrie numele complet al candidatului." }, 400);

    // Generăm un cod unic (verificăm că nu există deja).
    let cod, id, exista = true, incercari = 0;
    while (exista && incercari < 12) {
      cod = codNou();
      id = sha256(cod);
      exista = !!(await store.get("candidat/" + id, { type: "json" }));
      incercari++;
    }
    if (exista) return json({ eroare: "Nu am putut genera un cod unic. Reîncearcă." }, 500);

    const creat = new Date().toISOString();
    const candidat = { nume: nume.slice(0, 120), cod, creat };
    await store.setJSON("candidat/" + id, candidat);
    return json({ ok: true, candidat: { ...candidat, id } });
  }

  if (actiune === "sterge") {
    const id = String(body.id || "");
    if (!id) return json({ eroare: "Lipsește candidatul." }, 400);
    try { await store.delete("candidat/" + id); } catch (err) { console.error(err); }
    try { await store.delete("progres/" + id); } catch (err) { console.error(err); }
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
};
