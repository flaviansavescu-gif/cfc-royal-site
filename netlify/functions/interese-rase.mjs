// interese-rase.mjs — profilul de interese pe rase al candidaților Școlii de Arbitraj.
// Scop: orientarea fiecărui candidat către un lector potrivit și încurajarea lărgimii
// (asociația are nevoie de arbitri cu competențe extinse), plus prioritizarea standardelor
// de adăugat în Breed Explorer.
//
// Roluri:
//  • Candidatul (body.cid) — își vede și își salvează profilul (grupe + rase). Minim 2 grupe.
//  • Administratorul (cod de admin) — vede toți candidații, setează deficitul de arbitri pe
//    grupe, repartizează un lector principal fiecărui candidat (sugestie automată după
//    suprapunerea de grupe, la egalitate după încărcare).
//  • Lectorul (cod de lector) — își vede candidații repartizați lui.
//
// Store „interese": profil/<cid>, alocare/<cid>, deficit.
import { getStore } from "@netlify/blobs";
import { json, taie, acum, candidatDinId, audit } from "./_paa/lib.mjs";
// Rolurile, lectorii ȘI competențele lor pe grupe vin din SURSA UNICĂ.
import { actorDinCod, LECTORI, lectoriCuGrupe } from "./_comun/roluri.mjs";

const store = () => getStore("interese");
const MIN_GRUPE = 2;
const MAX_RASE = 80;

// —— sanitizare intrări candidat ——
function curataGrupe(v) {
  const out = [];
  if (Array.isArray(v)) for (const x of v) { const n = parseInt(x, 10); if (n >= 1 && n <= 10 && out.indexOf(n) < 0) out.push(n); }
  return out.sort((a, b) => a - b);
}
function curataRase(v) {
  const out = [], vaz = new Set();
  if (Array.isArray(v)) for (const x of v) {
    const ro = taie(x && x.ro, 120); const g = parseInt(x && x.g, 10);
    if (!ro || !(g >= 1 && g <= 10)) continue;
    const k = g + "|" + ro; if (vaz.has(k)) continue; vaz.add(k);
    out.push({ ro, g }); if (out.length >= MAX_RASE) break;
  }
  return out;
}
// Grupele efective = grupele bifate ∪ grupele raselor alese (o rasă implică interes pentru grupa ei).
function grupeEfective(grupe, rase) {
  const s = new Set(grupe);
  for (const r of rase) s.add(r.g);
  return Array.from(s).sort((a, b) => a - b);
}

async function citeste(key) { try { return await store().get(key, { type: "json" }); } catch { return null; } }
async function deficitCurent() { const d = await citeste("deficit"); return Array.isArray(d) ? d : []; }

async function toateProfilurile() {
  const st = store();
  let listata; try { listata = await st.list({ prefix: "profil/" }); } catch { listata = { blobs: [] }; }
  const out = [];
  for (const b of (listata.blobs || [])) {
    const p = await st.get(b.key, { type: "json" }).catch(() => null);
    if (!p || !p.cid) continue;
    // Auto-curățare: dacă acel candidat a fost șters din platformă, îi eliminăm profilul și
    // repartizarea rămase orfane (store „cursuri" e sursa de adevăr pentru existența candidatului).
    const inca = await candidatDinId(p.cid);
    if (!inca) {
      await st.delete("profil/" + p.cid).catch(() => {});
      await st.delete("alocare/" + p.cid).catch(() => {});
      continue;
    }
    const al = await st.get("alocare/" + p.cid, { type: "json" }).catch(() => null);
    out.push({ ...p, alocare: al || null });
  }
  out.sort((a, b) => String(b.actualizat || "").localeCompare(String(a.actualizat || "")));
  return out;
}

// Sugestie de lector: sortează după suprapunerea de grupe (desc), apoi după încărcare (asc), apoi nume.
function sugestii(grupeCand, incarcare) {
  const setG = new Set(grupeCand);
  return lectoriCuGrupe()
    .map((l) => ({ slug: l.slug, nume: l.nume, allBreed: l.allBreed, overlap: l.grupe.filter((g) => setG.has(g)).length, incarcare: incarcare[l.slug] || 0 }))
    .sort((a, b) => b.overlap - a.overlap || a.incarcare - b.incarcare || a.nume.localeCompare(b.nume, "ro"));
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body; try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 30) || "meniu";
  const st = store();

  // ————————————————— CANDIDAT —————————————————
  if (body.cid) {
    const cand = await candidatDinId(body.cid);
    if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);

    if (actiune === "meniu") {
      const p = await citeste("profil/" + cand.id);
      return json({ nume: cand.nume, minGrupe: MIN_GRUPE, deficit: await deficitCurent(), profil: p || null });
    }
    if (actiune === "salveaza") {
      const rase = curataRase(body.rase);
      const grupe = grupeEfective(curataGrupe(body.grupe), rase);
      if (grupe.length < MIN_GRUPE)
        return json({ eroare: "Alege cel puțin " + MIN_GRUPE + " grupe (o rasă aleasă contează și ca interes pentru grupa ei)." }, 400);
      const p = {
        cid: cand.id, nume: cand.nume, grupe, rase,
        nota: taie(body.nota, 600),
        creat: (await citeste("profil/" + cand.id))?.creat || acum(), actualizat: acum(),
      };
      await st.setJSON("profil/" + cand.id, p);
      await audit("interese-salveaza", { rol: "candidat", id: cand.id }, cand.id);
      return json({ ok: true, profil: p });
    }
    return json({ eroare: "Acțiune necunoscută." }, 400);
  }

  // ————————————————— LECTOR / ADMIN —————————————————
  const actor = actorDinCod(body.cod);
  if (!actor) return json({ eroare: "Necesită cod de lector sau administrator." }, 401);
  const esteAdmin = actor.rol === "admin";

  if (actiune === "candidatii-mei") {
    // Lectorul își vede candidații repartizați; adminul, dacă apelează, îi vede pe toți grupați.
    const toate = await toateProfilurile();
    const grupe = GRUPE_LABEL;
    if (esteAdmin) return json({ rol: "admin", candidati: toate, grupe });
    const aiMei = toate.filter((p) => p.alocare && p.alocare.lectorSlug === actor.slug);
    return json({ rol: "lector", slug: actor.slug, nume: actor.nume, candidati: aiMei, grupe });
  }

  // —— restul e doar pentru admin ——
  if (!esteAdmin) return json({ eroare: "Necesită cod de administrator." }, 403);

  if (actiune === "toate") {
    const toate = await toateProfilurile();
    const incarcare = {};
    for (const p of toate) if (p.alocare && p.alocare.lectorSlug) incarcare[p.alocare.lectorSlug] = (incarcare[p.alocare.lectorSlug] || 0) + 1;
    const cerereGrupe = {}, cerereRase = {};
    for (const p of toate) {
      for (const g of (p.grupe || [])) cerereGrupe[g] = (cerereGrupe[g] || 0) + 1;
      for (const r of (p.rase || [])) { const k = r.g + "|" + r.ro; cerereRase[k] = (cerereRase[k] || 0) + 1; }
    }
    const candidati = toate.map((p) => ({ ...p, sugestii: sugestii(p.grupe || [], incarcare).slice(0, 3) }));
    return json({
      candidati, deficit: await deficitCurent(), lectori: lectoriCuGrupe(), incarcare,
      cerereGrupe, cerereRase, grupe: GRUPE_LABEL,
    });
  }
  if (actiune === "aloca") {
    const cid = taie(body.cid2 || body.tinta, 80);
    if (!cid) return json({ eroare: "Candidat lipsă." }, 400);
    const slug = taie(body.lectorSlug, 60);
    if (!slug) { await st.delete("alocare/" + cid); await audit("interese-aloca-sterge", actor, cid); return json({ ok: true, alocare: null }); }
    const l = LECTORI.find((x) => x.slug === slug);
    if (!l) return json({ eroare: "Lector inexistent." }, 400);
    const al = { lectorSlug: l.slug, lectorNume: l.nume, ts: acum(), de: actor.rol };
    await st.setJSON("alocare/" + cid, al);
    await audit("interese-aloca", actor, cid + "→" + slug);
    return json({ ok: true, alocare: al });
  }
  if (actiune === "deficit") {
    const grupe = curataGrupe(body.grupe);
    await st.setJSON("deficit", grupe);
    await audit("interese-deficit", actor, grupe.join(","));
    return json({ ok: true, deficit: grupe });
  }
  return json({ eroare: "Acțiune necunoscută." }, 400);
};

// Etichete scurte de grupă (RO), pentru afișare în spațiile lectorilor/adminului fără a importa nomenclatorul.
const GRUPE_LABEL = {
  1: "Grupa 1 — Ciobănești și de cireadă", 2: "Grupa 2 — Pinscher/Schnauzer, Molosoizi",
  3: "Grupa 3 — Terrieri", 4: "Grupa 4 — Bull", 5: "Grupa 5 — Primitivi",
  6: "Grupa 6 — Copoi", 7: "Grupa 7 — Pointeri", 8: "Grupa 8 — Retrieveri/apă",
  9: "Grupa 9 — Companie/agrement", 10: "Grupa 10 — Ogari",
};
