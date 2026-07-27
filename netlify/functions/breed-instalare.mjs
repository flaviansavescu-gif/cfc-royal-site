// breed-instalare.mjs — coduri de INSTALARE pentru CFCR Breed Standards Explorer.
// Instalarea ca aplicație (PWA) e permisă doar cu un cod generat de administrator,
// DIFERIT de codul de acces în platformă. Store „breed" (Netlify Blobs):
//   install-cod/<sha256(cod)> -> { cod, eticheta, creat }
//
// POST { actiune:"verifica", cod }                 -> { ok:true } | 401   (public; app-ul verifică la instalare)
// POST { actiune:"lista", cod:ADMIN }              -> [ { cod, eticheta, creat, id } ]
// POST { actiune:"genereaza", cod:ADMIN, eticheta }-> { ok, cod:{ cod, eticheta, creat, id } }
// POST { actiune:"revoca", cod:ADMIN, id }         -> { ok }
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // fără caractere ambigue

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

function codNou() {
  let c = "BSE-";
  for (let i = 0; i < 5; i++) c += ALFABET[Math.floor(Math.random() * ALFABET.length)];
  return c;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20) || "verifica";
  const store = getStore("breed");

  // —— Public: verifică un cod de instalare (folosit de aplicație) ——
  if (actiune === "verifica") {
    const cod = taie(body.cod, 40);
    if (!cod) return json({ eroare: "Cod lipsă." }, 400);
    const rec = await store.get("install-cod/" + sha256(cod), { type: "json" }).catch(() => null);
    if (!rec) return json({ eroare: "Cod de instalare incorect." }, 401);
    return json({ ok: true });
  }

  // —— Restul: doar administrator ——
  if (!esteAdmin(body.cod)) return json({ eroare: "Cod de administrator incorect." }, 401);

  if (actiune === "lista") {
    const lista = [];
    try {
      const { blobs } = await store.list({ prefix: "install-cod/" });
      for (const b of blobs) {
        const r = await store.get(b.key, { type: "json" });
        if (r) lista.push({ cod: r.cod, eticheta: r.eticheta || "", creat: r.creat, id: b.key.slice("install-cod/".length) });
      }
    } catch (err) { console.error("Listare coduri instalare eșuată:", err); }
    lista.sort((a, b) => String(b.creat || "").localeCompare(String(a.creat || "")));
    return json(lista);
  }

  if (actiune === "genereaza") {
    let cod, id, exista = true, i = 0;
    while (exista && i < 12) { cod = codNou(); id = sha256(cod); exista = !!(await store.get("install-cod/" + id, { type: "json" })); i++; }
    if (exista) return json({ eroare: "Nu am putut genera un cod unic. Reîncearcă." }, 500);
    const rec = { cod, eticheta: taie(body.eticheta, 120), creat: new Date().toISOString() };
    await store.setJSON("install-cod/" + id, rec);
    return json({ ok: true, cod: { ...rec, id } });
  }

  if (actiune === "revoca") {
    const id = taie(body.id, 80);
    if (!id) return json({ eroare: "Lipsește codul." }, 400);
    try { await store.delete("install-cod/" + id); } catch (err) { console.error(err); }
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
