// _paa/lib.mjs — infrastructură comună pentru Photo Anatomy Annotator:
// autentificare (RBAC pe cod), store Blobs „paa", audit, validare.
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
// Rolurile și amprentele codurilor vin din SURSA UNICĂ (_comun/roluri.mjs).
// Nu le mai duplica aici — o singură listă de lectori pentru toată platforma.
import { sha256, ADMIN_HASH, LECTORI, actorDinCod } from "../_comun/roluri.mjs";

export { sha256, ADMIN_HASH, LECTORI, actorDinCod };
export const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
export const acum = () => new Date().toISOString();
export const idNou = (p) => (p || "s-") + randomUUID().slice(0, 12);

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export const store = () => getStore("paa");
export const storeCursuri = () => getStore("cursuri");

export function cereLector(cod) {
  const a = actorDinCod(cod);
  if (!a) throw { status: 401, eroare: "Necesită cod de lector sau administrator." };
  return a;
}
export function cereAdmin(cod) {
  if (sha256(cod || "") !== ADMIN_HASH) throw { status: 401, eroare: "Cod de administrator incorect." };
  return { rol: "admin" };
}
/** Spațiu comun: orice lector (sau admin) poate administra exercițiile. */
export function poateAdministra(actor) { return !!actor && (actor.rol === "admin" || actor.rol === "lector"); }

/** Candidat prin ID (bearer stocat în browser la login, ca la progres-cursuri). */
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
