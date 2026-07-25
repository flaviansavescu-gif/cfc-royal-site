// _comun/urma.mjs — cine a modificat ultima dată o sesiune / un exercițiu.
//
// Sala de analiză și Exercițiile de anatomie sunt spații COMUNE: orice lector poate
// administra materialul oricui (decizie asumată — Colegiul lucrează împreună).
// Lipsea însă urma vizibilă: nu se vedea cine a închis sau a modificat ceva.
// Auditul se scria, dar nu-l citea nimeni din interfață.
//
// Aici punem, pe obiectul însuși, cine a făcut ultima modificare — ca să apară în listă.

/** Numele lizibil al actorului (lector sau administrator). */
export function numeActor(actor) {
  if (!actor) return "necunoscut";
  if (actor.rol === "admin") return "Administrator";
  return actor.nume || actor.slug || "lector";
}

/**
 * Marchează obiectul cu autorul ultimei modificări. Modifică obiectul primit
 * și îl întoarce, ca să poată fi înlănțuit.
 */
export function marcheazaUrma(obj, actor, actiune) {
  if (!obj) return obj;
  obj.actualizatDe = numeActor(actor);
  obj.actualizatDeSlug = (actor && actor.slug) || (actor && actor.rol === "admin" ? "admin" : "");
  obj.ultimaActiune = String(actiune || "").slice(0, 40);
  return obj;
}

/** Câmpurile de urmă, pentru rândurile din index (listele scurte). */
export function urmaPtIndex(obj) {
  return {
    creatDe: obj.lectorNume || "",
    actualizatDe: obj.actualizatDe || "",
    ultimaActiune: obj.ultimaActiune || "",
  };
}
