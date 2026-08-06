// rezultate-cursuri.mjs — registrul rezultatelor testelor (Școala de Arbitraj).
// POST { cod } -> lista completă a rezultatelor, DOAR cu codul de administrator
// (verificat prin SHA-256 pe server; amprenta de mai jos nu deschide nimic).
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

// LIMITARE (adăugată la auditul de securitate). Poarta verifică `esteAdmin(cod)` cu un cod
// scurt; fără limitare, era o „ghicitoare" nelimitată a codului de administrator (și un
// oracol: 401 la cod greșit, 403 la cod bun fără dispozitiv). `cuLimitareCod` numără
// eșecurile pe IP și blochează enumerarea — exact apărarea pe care restul porților o aveau.
export default cuLimitareCod(async (req) => {
  if (req.method !== "POST")
    return new Response(JSON.stringify({ eroare: "Metodă nepermisă." }), { status: 405 });

  let cod = "";
  let reset = false;
  let dispozitiv = "";
  try {
    const b = await req.json();
    cod = b.cod || "";
    reset = b.reset === true;
    dispozitiv = String(b.dispozitiv || "").trim();
  } catch {}
  if (!esteAdmin(cod))
    return new Response(JSON.stringify({ eroare: "Cod de administrator incorect." }), { status: 401 });
  // A doua cheie: codul singur nu mai deschide administrarea Școlii. Aici se poate goli
  // TOT registrul de rezultate al Școlii — dacă e o cerere care merită două chei, e asta.
  if (!(await dispozitivCunoscut(getStore("cursuri"), dispozitiv, "admin")))
    return new Response(
      JSON.stringify({ eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." }),
      { status: 403, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );

  const store = getStore("cursuri");

  // Golirea registrului (început de serie / curățare) — șterge toate rezultatele.
  if (reset) {
    let sterse = 0;
    try {
      const { blobs } = await store.list({ prefix: "rezultat/" });
      for (const b of blobs) { await store.delete(b.key); sterse++; }
      await store.delete("rezultate"); // vechea listă unică, dacă mai există
    } catch (err) {
      console.error("Golire registru eșuată:", err);
    }
    return new Response(JSON.stringify({ ok: true, sterse }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  // Fiecare rezultat e salvat pe cheia lui (rezultat/<ts>-<rand>) — le adunăm pe toate.
  const rezultate = [];
  try {
    const { blobs } = await store.list({ prefix: "rezultat/" });
    for (const b of blobs) {
      const r = await store.get(b.key, { type: "json" });
      if (r) rezultate.push(r);
    }
  } catch (err) {
    console.error("Citire registru eșuată:", err);
  }
  // cele mai recente primele
  rezultate.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  return new Response(JSON.stringify({ rezultate }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
});
