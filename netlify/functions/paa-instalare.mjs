// paa-instalare.mjs — coduri de INSTALARE pentru Photo Anatomy Annotator (separate de
// Breed Explorer). Instalarea ca aplicație (PWA) e permisă doar cu un cod generat de admin.
// Store „paa": install-cod/<sha256(cod)> -> { cod, eticheta, creat }
import { getStore } from "@netlify/blobs";
import { createHash, randomInt } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { json } from "./_comun/raspuns.mjs";
const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/**
 * Lungimea partii aleatoare a codului de instalare.
 *
 * Erau 5 caractere din 31 = 28,6 milioane de variante. Suna mult, dar nu e: limitarea de
 * incercari e pe ADRESA IP, iar cine roteste adrese (un bot, o retea mobila) macina
 * spatiul asta intr-un timp masurabil. Cu 8 caractere sunt 852 de miliarde — aceeasi
 * socoteala ca la codurile de candidat, unde e scrisa pe larg in `_comun/limitare.mjs`.
 *
 * Codurile deja emise, mai scurte, raman valabile: cautarea se face pe amprenta, nu pe
 * lungime. Se inlocuiesc singure pe masura ce se genereaza altele.
 */
const LUNGIME_COD = 8;
const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

function codNou() { let c = "PAA-"; for (let i = 0; i < LUNGIME_COD; i++) c += ALFABET[randomInt(0, ALFABET.length)]; return c; }

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
  // A doua cheie: codul singur nu mai deschide administrarea Școlii.
  // Jetoanele de dispozitiv stau în magazia PLATFORMEI („cursuri"), nu în cea a acestei
  // funcții — vezi explicația din breed-instalare.mjs.
  if (!(await dispozitivCunoscut(getStore("cursuri"), String(body.dispozitiv || "").trim(), "admin")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." }, 403, { antete: { "x-refuz-drept": "1" } });

  if (actiune === "lista") {
    const lista = [];
    try {
      const { blobs } = await store.list({ prefix: "install-cod/" });
      for (const b of blobs) { const r = await store.get(b.key, { type: "json" }); if (r) lista.push({ cod: r.cod || null, eticheta: r.eticheta || "", creat: r.creat, id: b.key.slice("install-cod/".length) }); }
    } catch (err) { console.error(err); }
    lista.sort((a, b) => String(b.creat || "").localeCompare(String(a.creat || "")));
    return json(lista);
  }
  if (actiune === "genereaza") {
    let cod, id, exista = true, i = 0;
    while (exista && i < 12) { cod = codNou(); id = sha256(cod); exista = !!(await store.get("install-cod/" + id, { type: "json" })); i++; }
    if (exista) return json({ eroare: "Nu am putut genera un cod unic." }, 500);
    const rec = { eticheta: taie(body.eticheta, 120), creat: new Date().toISOString() };
    await store.setJSON("install-cod/" + id, rec);
    // Codul pleaca ACUM, o singura data. In magazie ramane doar amprenta lui (cheia).
    return json({ ok: true, cod: { ...rec, cod, id } });
  }
  if (actiune === "revoca") {
    const id = taie(body.id, 80);
    if (!id) return json({ eroare: "Lipsește codul." }, 400);
    try { await store.delete("install-cod/" + id); } catch (err) { console.error(err); }
    return json({ ok: true });
  }
  return json({ eroare: "Acțiune necunoscută." }, 400);
});
