// _paa/lib.mjs — infrastructură comună pentru Photo Anatomy Annotator:
// autentificare (RBAC pe cod), store Blobs „paa", audit, validare.
import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "node:crypto";

export const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
export const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
export const acum = () => new Date().toISOString();
export const idNou = (p) => (p || "s-") + randomUUID().slice(0, 12);

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";
export const LECTORI = [
  { slug: "flavian-savescu", nume: "Flavian-Sergiu Savescu", hash: "71a012c1d53cdf7fc5b94202c736827245baa8cc3d629e674e8a6074266c8c14" },
  { slug: "mihail-cosmin-neagu", nume: "Mihail Cosmin Neagu", hash: "21048e2893df687a5195519e5d665440c99a6060e11044fb2509b886ca0cc8b9" },
  { slug: "georgeta-mihaela-chivu", nume: "Georgeta Mihaela Chivu", hash: "ddd1b278ddf55141d8f2bca8857160b38cc64024e3f5b4368cbebee329442817" },
  { slug: "mihail-sorin-iacob", nume: "Mihail Sorin Iacob", hash: "d3c043092f13a97d4d83dd0df96be08162ec7e26ea7241dc1da685c8d89e1b18" },
  { slug: "andreea-daniela-popescu", nume: "Andreea-Daniela Popescu", hash: "3a7948f0609b92e2a9a46075b909600eec39244f36bc2477c32f9bbc1484f697" },
  { slug: "alexandru-paul-ciolac", nume: "Alexandru Paul Ciolac", hash: "eb393a27cbaf6fd51833e060e8a421912f17b1b12ea8c499e2084305397cc1d7" },
];

export const store = () => getStore("paa");
export const storeCursuri = () => getStore("cursuri");

/** {rol:'admin'} | {rol:'lector',slug,nume} | null */
export function actorDinCod(cod) {
  const h = sha256(cod || "");
  if (h === ADMIN_HASH) return { rol: "admin", hash: h };
  const l = LECTORI.find((x) => x.hash === h);
  if (l) return { rol: "lector", slug: l.slug, nume: l.nume, hash: h };
  return null;
}
export function cereLector(cod) {
  const a = actorDinCod(cod);
  if (!a) throw { status: 401, eroare: "Necesită cod de lector sau administrator." };
  return a;
}
export function cereAdmin(cod) {
  if (sha256(cod || "") !== ADMIN_HASH) throw { status: 401, eroare: "Cod de administrator incorect." };
  return { rol: "admin" };
}

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
