// paa-instalare.mjs — coduri de INSTALARE pentru Photo Anatomy Annotator (separate de
// Breed Explorer). Instalarea ca aplicație (PWA) e permisă doar cu un cod generat de admin.
// Store „paa": install-cod/<sha256(cod)> -> { cod, eticheta, creat }
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
function codNou() { let c = "PAA-"; for (let i = 0; i < 5; i++) c += ALFABET[Math.floor(Math.random() * ALFABET.length)]; return c; }

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20) || "verifica";
  const store = getStore("paa");

  if (actiune === "verifica") {
    const cod = taie(body.cod, 40);
    if (!cod) return json({ eroare: "Cod lipsă." }, 400);
    const rec = await store.get("install-cod/" + sha256(cod), { type: "json" }).catch(() => null);
    if (!rec) return json({ eroare: "Cod de instalare incorect." }, 401);
    return json({ ok: true });
  }

  if (!esteAdmin(body.cod)) return json({ eroare: "Cod de administrator incorect." }, 401);

  if (actiune === "lista") {
    const lista = [];
    try {
      const { blobs } = await store.list({ prefix: "install-cod/" });
      for (const b of blobs) { const r = await store.get(b.key, { type: "json" }); if (r) lista.push({ cod: r.cod, eticheta: r.eticheta || "", creat: r.creat, id: b.key.slice("install-cod/".length) }); }
    } catch (err) { console.error(err); }
    lista.sort((a, b) => String(b.creat || "").localeCompare(String(a.creat || "")));
    return json(lista);
  }
  if (actiune === "genereaza") {
    let cod, id, exista = true, i = 0;
    while (exista && i < 12) { cod = codNou(); id = sha256(cod); exista = !!(await store.get("install-cod/" + id, { type: "json" })); i++; }
    if (exista) return json({ eroare: "Nu am putut genera un cod unic." }, 500);
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
