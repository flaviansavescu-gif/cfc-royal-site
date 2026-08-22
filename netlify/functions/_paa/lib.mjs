// _paa/lib.mjs — infrastructură comună pentru Photo Anatomy Annotator:
// autentificare (RBAC pe cod), store Blobs „paa", audit, validare.
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
// Rolurile și amprentele codurilor vin din SURSA UNICĂ (_comun/roluri.mjs).
// Nu le mai duplica aici — o singură listă de lectori pentru toată platforma.
import { sha256, ADMIN_HASH, LECTORI, actorDinCod, esteAdmin } from "../_comun/roluri.mjs";

export { sha256, ADMIN_HASH, LECTORI, actorDinCod, esteAdmin };
export const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
export const acum = () => new Date().toISOString();
export const idNou = (p) => (p || "s-") + randomUUID().slice(0, 12);

// Răspunsul JSON vine din locul comun; re-exportat aici ca handler-ele PAA să-l ia
// împreună cu restul uneltelor, dintr-un singur import.
export { json } from "../_comun/raspuns.mjs";

export const store = () => getStore("paa");
export const storeCursuri = () => getStore("cursuri");

export function cereLector(cod) {
  const a = actorDinCod(cod);
  if (!a) throw { status: 401, eroare: "Necesită cod de lector sau administrator." };
  return a;
}
export function cereAdmin(cod) {
  // `esteAdmin` face comparația în TIMP CONSTANT (sursă unică); `sha256(...) !== ADMIN_HASH`
  // era o comparație care se oprea la prima diferență — inconsecvent cu restul platformei.
  if (!esteAdmin(cod)) throw { status: 401, eroare: "Cod de administrator incorect." };
  return { rol: "admin" };
}
/** Spațiu comun: orice lector (sau admin) poate administra exercițiile. */
export function poateAdministra(actor) { return !!actor && (actor.rol === "admin" || actor.rol === "lector"); }

/**
 * Candidatul care DOVEDEȘTE codul (M1): primește codul, calculează insigna (id=sha256),
 * verifică registrul. Preferat lui `candidatDinId` pentru autentificare — un lector care
 * ar vedea insigna altui candidat în listele lui nu poate întoarce sha256 ca să afle codul.
 */
export async function candidatDinCod(cod) {
  const c = taie(cod, 64);
  if (!c) return null;
  const id = sha256(c);
  try {
    const cand = await storeCursuri().get("candidat/" + id, { type: "json" });
    if (cand) return { id, nume: cand.nume, faraCodEtic: await faraCodEtic(id) };
  } catch (err) { console.error("Verificare candidat (cod) eșuată:", err); }
  return null;
}

// ——— Poarta etică (pasul doi, 23.08.2026): și exercițiile de anatomie sunt formare ———
import { VERSIUNE as VERSIUNE_ETICA } from "../cod-etic.mjs";
export const MESAJ_ETICA = `Accesul cere asumarea Codului Etic (versiunea ${VERSIUNE_ETICA}). ` +
  "Intră în platformă la /cursuri/cod-etic/ și confirmă — durează un minut.";
/** Fail-open pe avarie: un sughiț de magazie nu închide adnotatorul. */
async function faraCodEtic(id) {
  try {
    const a = await storeCursuri().get(`cod-etic/${VERSIUNE_ETICA}/${id}`, { type: "json" });
    return !a;
  } catch (err) {
    console.error("Poarta etică (PAA) nu a putut citi asumarea — trece:", err?.message || err);
    return false;
  }
}

/**
 * Cine dovedește codul: candidat, lector sau administrator.
 *
 * Adnotatorul nu mai e doar pentru candidați — un lector sau administratorul își pot salva
 * PROPRIILE sesiuni. Fiecare identitate primește un `id` din spații care nu se pot ciocni:
 * candidatul păstrează `id`-ul lui istoric (sha256 al codului), ca sesiunile deja salvate să
 * rămână ale lui; lectorul e `lector:<slug>`; administratorul e `admin`.
 * NU e „review de lector" (a vedea sesiunile altui candidat) — asta rămâne Faza 2.
 */
export async function cineDinCod(cod) {
  const cand = await candidatDinCod(cod);
  if (cand) return { id: cand.id, rol: "candidat", nume: cand.nume, faraCodEtic: cand.faraCodEtic };
  const a = actorDinCod(cod);
  if (a?.rol === "admin") return { id: "admin", rol: "admin", nume: "Administrator" };
  if (a?.rol === "lector")
    return { id: "lector:" + (a.slug || sha256(cod).slice(0, 16)), rol: "lector", nume: a.nume || a.slug || "lector",
      // Lectorii intră sub aceeași poartă (hotărârea 2a); evidența lor e pe slug.
      faraCodEtic: a.slug ? await faraCodEtic(a.slug) : false };
  return null;
}

/** Candidat prin ID (bearer). Rămâne DOAR pentru rezolvarea internă a insignelor stocate
 *  (nume din liste), NU pentru autentificare — autentificarea trece prin candidatDinCod. */
export async function candidatDinId(cid) {
  const id = taie(cid, 80);
  if (!id) return null;
  try {
    const c = await storeCursuri().get("candidat/" + id, { type: "json" });
    if (c) return { id, nume: c.nume };
  } catch (err) { console.error("Verificare candidat (id) eșuată:", err); }
  return null;
}

export async function audit(actiune, actor, tinta) {
  try {
    await store().setJSON("audit/std/" + acum() + "-" + Math.random().toString(36).slice(2, 8), {
      ts: acum(), actiune, tinta: tinta || null, actorRol: actor ? actor.rol : "necunoscut", actorId: actor ? (actor.slug || actor.id || "") : "",
    });
  } catch (err) { console.error("Audit eșuat:", err); }
}
