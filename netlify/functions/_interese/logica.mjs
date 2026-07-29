// _interese/logica.mjs — logica PURĂ a profilului de interese pe rase.
//
// Extrasă din funcție ca să poată fi testată fără Blobs și fără rețea:
// sanitizarea alegerilor candidatului, regula de lărgime, sugestia de lector
// și agregarea cererii. Vezi testele din logica.test.mjs.

export const MIN_GRUPE = 2;
export const MAX_RASE = 80;

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

/** Grupele valide (1–10), fără duplicate, sortate crescător. */
export function curataGrupe(v) {
  const out = [];
  if (Array.isArray(v)) {
    for (const x of v) {
      const n = parseInt(x, 10);
      if (n >= 1 && n <= 10 && out.indexOf(n) < 0) out.push(n);
    }
  }
  return out.sort((a, b) => a - b);
}

/** Rasele valide, fără duplicate, cel mult MAX_RASE. */
export function curataRase(v) {
  const out = [], vaz = new Set();
  if (Array.isArray(v)) {
    for (const x of v) {
      const ro = taie(x && x.ro, 120);
      const g = parseInt(x && x.g, 10);
      if (!ro || !(g >= 1 && g <= 10)) continue;
      const k = g + "|" + ro;
      if (vaz.has(k)) continue;
      vaz.add(k);
      out.push({ ro, g });
      if (out.length >= MAX_RASE) break;
    }
  }
  return out;
}

/**
 * Grupele EFECTIVE = grupele bifate ∪ grupele raselor alese.
 * O rasă aleasă înseamnă interes pentru grupa ei — asta e pârghia de lărgime:
 * cine alege rase din grupe diferite îndeplinește pragul fără să bifeze grupele.
 */
export function grupeEfective(grupe, rase) {
  const s = new Set(curataGrupe(grupe));
  for (const r of (rase || [])) if (r && r.g >= 1 && r.g <= 10) s.add(r.g);
  return Array.from(s).sort((a, b) => a - b);
}

/** Profilul poate fi trimis? (pragul de lărgime) */
export function poateTrimite(grupeEfectiveLista, minGrupe = MIN_GRUPE) {
  return (grupeEfectiveLista || []).length >= minGrupe;
}

/**
 * Sugestia de lector: întâi suprapunerea de grupe (descrescător), apoi
 * încărcarea (crescător — echilibrăm repartizarea între lectori), apoi numele.
 * `lectori` = [{slug, nume, grupe:[…], allBreed}], `incarcare` = {slug: nrCandidați}.
 */
export function sugestii(lectori, grupeCand, incarcare) {
  const setG = new Set(grupeCand || []);
  const inc = incarcare || {};
  return (lectori || [])
    .map((l) => ({
      slug: l.slug, nume: l.nume, allBreed: !!l.allBreed,
      overlap: (l.grupe || []).filter((g) => setG.has(g)).length,
      incarcare: inc[l.slug] || 0,
    }))
    .sort((a, b) => b.overlap - a.overlap || a.incarcare - b.incarcare || a.nume.localeCompare(b.nume, "ro"));
}

/** Câți candidați are fiecare lector repartizați. */
export function incarcareLectori(profiluri) {
  const inc = {};
  for (const p of (profiluri || [])) {
    const slug = p && p.alocare && p.alocare.lectorSlug;
    if (slug) inc[slug] = (inc[slug] || 0) + 1;
  }
  return inc;
}

/** Cererea agregată, pentru prioritatea standardelor din Breed Explorer. */
export function agregare(profiluri) {
  const cerereGrupe = {}, cerereRase = {};
  for (const p of (profiluri || [])) {
    for (const g of (p.grupe || [])) cerereGrupe[g] = (cerereGrupe[g] || 0) + 1;
    for (const r of (p.rase || [])) {
      const k = r.g + "|" + r.ro;
      cerereRase[k] = (cerereRase[k] || 0) + 1;
    }
  }
  return { cerereGrupe, cerereRase };
}

/** Rândul scurt din index (ce e nevoie pentru Panou și pentru spațiul lectorului). */
export function randIndex(profil, alocare) {
  return {
    cid: profil.cid,
    nume: profil.nume || "",
    grupe: profil.grupe || [],
    rase: profil.rase || [],
    nota: profil.nota || "",
    alocare: alocare || null,
    actualizat: profil.actualizat || "",
  };
}

/** Inserează sau înlocuiește un rând în index, păstrându-l sortat (cel mai recent primul). */
export function pune(index, rand) {
  const l = (index || []).filter((x) => x && x.cid !== rand.cid);
  l.push(rand);
  l.sort((a, b) => String(b.actualizat || "").localeCompare(String(a.actualizat || "")));
  return l;
}

/** Scoate un candidat din index. */
export function scoate(index, cid) {
  return (index || []).filter((x) => x && x.cid !== cid);
}
