// _jcr/lib.mjs — infrastructură comună pentru funcțiile Judge Comparison Room:
// autentificare (RBAC pe cod), acces la store-ul Blobs „jcr", audit, validare.
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
// Rolurile și amprentele codurilor vin din SURSA UNICĂ (_comun/roluri.mjs).
import { sha256, ADMIN_HASH, LECTORI, actorDinCod } from "../_comun/roluri.mjs";

export { sha256, ADMIN_HASH, LECTORI, actorDinCod };
export const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
export const acum = () => new Date().toISOString();

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/** Baremul e vizibil cursantului? La închiderea sesiunii (dacă așa e configurat) sau la
 *  deblocarea manuală de către lector. */
export const baremDeblocat = (s) =>
  !!s && ((s.status === "closed" && (s.vizibilitate?.deblocareBarem || "la-inchidere") === "la-inchidere") || s.vizibilitate?.baremManual === true);

export const store = () => getStore("jcr");
export const storeCursuri = () => getStore("cursuri"); // pt. verificarea candidaților (registrul existent)

/** Verifică un cod INDIVIDUAL de candidat față de registrul existent (store „cursuri"). */
export async function candidatDinCod(cod) {
  const c = taie(cod, 64);
  if (!c) return null;
  const id = sha256(c);
  try {
    const cand = await storeCursuri().get("candidat/" + id, { type: "json" });
    if (cand) return { id, nume: cand.nume };
  } catch (err) { console.error("Verificare candidat eșuată:", err); }
  return null;
}

/** Verifică un candidat prin ID-ul lui (bearer stocat în browser la login, ca la
 *  progres-cursuri). Întoarce {id, nume} dacă există în registru. */
export async function candidatDinId(cid) {
  const id = taie(cid, 80);
  if (!id) return null;
  try {
    const cand = await storeCursuri().get("candidat/" + id, { type: "json" });
    if (cand) return { id, nume: cand.nume };
  } catch (err) { console.error("Verificare candidat (id) eșuată:", err); }
  return null;
}

/** Gardă: cere rol admin sau lector. Întoarce actor sau aruncă {status,eroare}. */
export function cereLector(cod) {
  const a = actorDinCod(cod);
  if (!a || (a.rol !== "admin" && a.rol !== "lector")) throw { status: 401, eroare: "Necesită cod de lector sau administrator." };
  return a;
}

/** Poate acest actor administra sesiunea? Colegiul de arbitri lucrează ca spațiu comun:
 *  orice lector (și administratorul) poate crea și administra sesiuni. */
export function poateAdministraSesiunea(actor, _sesiune) {
  return !!actor && (actor.rol === "admin" || actor.rol === "lector");
}

// ————— ID-uri —————
export const idNou = () => "s-" + randomUUID().slice(0, 12);

// ————— Index de sesiuni (pentru listare/filtrare rapidă) —————
export async function citesteIndex() {
  try { return (await store().get("session-index", { type: "json" })) || []; }
  catch { return []; }
}
export async function scrieInIndex(sesiune) {
  const idx = await citesteIndex();
  const rand = {
    id: sesiune.id, titlu: sesiune.titlu, status: sesiune.status,
    rasa: sesiune.rasa || "", grupa: sesiune.grupa || "", nivel: sesiune.nivel || "",
    lectorSlug: sesiune.lectorSlug || "", lectorNume: sesiune.lectorNume || "",
    termen: sesiune.termen || "", creat: sesiune.creat, actualizat: sesiune.actualizat || acum(),
    actualizatDe: sesiune.actualizatDe || "", ultimaActiune: sesiune.ultimaActiune || "",
  };
  const i = idx.findIndex((x) => x.id === sesiune.id);
  if (i >= 0) idx[i] = rand; else idx.push(rand);
  await store().setJSON("session-index", idx);
}
export async function scoateDinIndex(id) {
  const idx = (await citesteIndex()).filter((x) => x.id !== id);
  await store().setJSON("session-index", idx);
}

// ————— Audit —————
export async function audit(sessionId, actor, actiune, tinta) {
  try {
    const key = "audit/" + (sessionId || "_") + "/" + acum() + "-" + Math.random().toString(36).slice(2, 8);
    await store().setJSON(key, {
      ts: acum(), actiune, tinta: tinta || null,
      actorRol: actor ? actor.rol : "necunoscut",
      actorId: actor ? (actor.slug || actor.id || actor.hash || "") : "",
    });
  } catch (err) { console.error("Audit eșuat:", err); }
}

// ————— Participanți —————
export async function citesteParticipanti(sessionId) {
  try { return (await store().get("participants/" + sessionId, { type: "json" })) || { candidateIds: [] }; }
  catch { return { candidateIds: [] }; }
}
export function esteParticipant(participanti, candidatId) {
  return !!participanti && Array.isArray(participanti.candidateIds) && participanti.candidateIds.includes(candidatId);
}
