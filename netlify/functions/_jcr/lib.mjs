// _jcr/lib.mjs — infrastructură comună pentru funcțiile Judge Comparison Room:
// autentificare (RBAC pe cod), acces la store-ul Blobs „jcr", audit, validare.
import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "node:crypto";

export const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
export const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
export const acum = () => new Date().toISOString();

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

// Coduri de rol (SHA-256). Aceleași ca în src/data/cursuri.ts (gating client) — aici sunt
// autoritatea server-side. Dacă se schimbă un cod, se actualizează în ambele locuri.
export const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";
export const LECTORI = [
  { slug: "flavian-savescu", nume: "Flavian-Sergiu Savescu", hash: "71a012c1d53cdf7fc5b94202c736827245baa8cc3d629e674e8a6074266c8c14" },
  { slug: "mihail-cosmin-neagu", nume: "Mihail Cosmin Neagu", hash: "21048e2893df687a5195519e5d665440c99a6060e11044fb2509b886ca0cc8b9" },
  { slug: "georgeta-mihaela-chivu", nume: "Georgeta Mihaela Chivu", hash: "ddd1b278ddf55141d8f2bca8857160b38cc64024e3f5b4368cbebee329442817" },
  { slug: "mihail-sorin-iacob", nume: "Mihail Sorin Iacob", hash: "d3c043092f13a97d4d83dd0df96be08162ec7e26ea7241dc1da685c8d89e1b18" },
  { slug: "andreea-daniela-popescu", nume: "Andreea-Daniela Popescu", hash: "3a7948f0609b92e2a9a46075b909600eec39244f36bc2477c32f9bbc1484f697" },
  { slug: "alexandru-paul-ciolac", nume: "Alexandru Paul Ciolac", hash: "eb393a27cbaf6fd51833e060e8a421912f17b1b12ea8c499e2084305397cc1d7" },
];

/** Baremul e vizibil cursantului? La închiderea sesiunii (dacă așa e configurat) sau la
 *  deblocarea manuală de către lector. */
export const baremDeblocat = (s) =>
  !!s && ((s.status === "closed" && (s.vizibilitate?.deblocareBarem || "la-inchidere") === "la-inchidere") || s.vizibilitate?.baremManual === true);

export const store = () => getStore("jcr");
export const storeCursuri = () => getStore("cursuri"); // pt. verificarea candidaților (registrul existent)

/** Determină rolul din cod. Întoarce {rol:'admin'} | {rol:'lector',slug,nume} | null. */
export function actorDinCod(cod) {
  const h = sha256(cod || "");
  if (h === ADMIN_HASH) return { rol: "admin", hash: h };
  const l = LECTORI.find((x) => x.hash === h);
  if (l) return { rol: "lector", slug: l.slug, nume: l.nume, hash: h };
  return null;
}

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

/** Poate acest actor administra sesiunea? Adminul da; lectorul doar dacă e proprietar. */
export function poateAdministraSesiunea(actor, sesiune) {
  if (!actor) return false;
  if (actor.rol === "admin") return true;
  return actor.rol === "lector" && sesiune && sesiune.lectorSlug === actor.slug;
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
