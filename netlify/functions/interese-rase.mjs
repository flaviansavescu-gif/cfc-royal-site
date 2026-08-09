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
import { json, taie, acum, candidatDinId, audit, candidatDinCod} from "./_paa/lib.mjs";
// Rolurile, lectorii ȘI competențele lor pe grupe vin din SURSA UNICĂ.
import { actorDinCod, LECTORI, lectoriCuGrupe } from "./_comun/roluri.mjs";
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
// Logica pură (sanitizare, lărgime, sugestii, agregare) — testată separat.
import {
  MIN_GRUPE, curataGrupe, curataRase, grupeEfective, poateTrimite,
  sugestii, incarcareLectori, agregare, randIndex, pune,
} from "./_interese/logica.mjs";

const store = () => getStore("interese");
const storeCursuri = () => getStore("cursuri");

async function citeste(key) { try { return await store().get(key, { type: "json" }); } catch { return null; } }
async function deficitCurent() { const d = await citeste("deficit"); return Array.isArray(d) ? d : []; }

// ————— INDEX —————
// Înainte, fiecare deschidere a Panoului sau a unui spațiu de lector făcea 3 citiri
// Blobs PER CANDIDAT (profil + verificarea existenței + repartizare). La 200 de
// candidați însemna 600 de citiri. Acum listele se servesc dintr-un singur index.
async function citesteIndexProfiluri() {
  try { return (await store().get("profil-index", { type: "json" })) || []; } catch { return []; }
}
async function scrieIndexProfiluri(l) {
  try { await store().setJSON("profil-index", l); } catch (err) { console.error("Scriere index interese eșuată:", err); }
}

/** Identificatorii candidaților care mai există (o singură listare, nu una per candidat). */
async function candidatiVii() {
  const set = new Set();
  try {
    const { blobs } = await storeCursuri().list({ prefix: "candidat/" });
    for (const b of blobs) set.add(b.key.slice("candidat/".length));
  } catch (err) { console.error("Listare candidați eșuată:", err); return null; }
  return set;
}

/**
 * Profilurile pentru liste, din index. Curăță din mers rândurile candidaților
 * care nu mai există (auto-vindecare, ca ștergerea unui candidat să nu lase urme).
 * Dacă registrul nu se poate citi, întoarcem indexul neatins — nu ștergem pe orbecăite.
 */
async function toateProfilurile() {
  const index = await citesteIndexProfiluri();
  const vii = await candidatiVii();
  if (!vii || vii.size === 0) return index;

  const valide = index.filter((p) => p && p.cid && vii.has(p.cid));
  if (valide.length !== index.length) {
    const st = store();
    for (const p of index) {
      if (p && p.cid && !vii.has(p.cid)) {
        await st.delete("profil/" + p.cid).catch(() => {});
        await st.delete("alocare/" + p.cid).catch(() => {});
      }
    }
    await scrieIndexProfiluri(valide);
  }
  return valide;
}

/** Reconstruiește indexul din chei (recuperare, dacă indexul lipsește sau a rămas în urmă). */
async function reconstruiesteIndex() {
  const st = store();
  let listata; try { listata = await st.list({ prefix: "profil/" }); } catch { return []; }
  const out = [];
  for (const b of (listata.blobs || [])) {
    const p = await st.get(b.key, { type: "json" }).catch(() => null);
    if (!p || !p.cid) continue;
    const al = await st.get("alocare/" + p.cid, { type: "json" }).catch(() => null);
    out.push(randIndex(p, al));
  }
  out.sort((a, b) => String(b.actualizat || "").localeCompare(String(a.actualizat || "")));
  await scrieIndexProfiluri(out);
  return out;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body; try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 30) || "meniu";
  const st = store();

  // ————————————————— CANDIDAT —————————————————
  if (body.cid) {
    const cand = await candidatDinCod(body.cid);
    if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);

    if (actiune === "meniu") {
      const p = await citeste("profil/" + cand.id);
      return json({ nume: cand.nume, minGrupe: MIN_GRUPE, deficit: await deficitCurent(), profil: p || null });
    }
    if (actiune === "salveaza") {
      const rase = curataRase(body.rase);
      const grupe = grupeEfective(curataGrupe(body.grupe), rase);
      if (!poateTrimite(grupe))
        return json({ eroare: "Alege cel puțin " + MIN_GRUPE + " grupe (o rasă aleasă contează și ca interes pentru grupa ei)." }, 400);
      const vechi = await citeste("profil/" + cand.id);
      const p = {
        cid: cand.id, nume: cand.nume, grupe, rase,
        nota: taie(body.nota, 600),
        creat: (vechi && vechi.creat) || acum(), actualizat: acum(),
      };
      await st.setJSON("profil/" + cand.id, p);
      // Indexul ține listele Panoului și ale lectorilor — îl actualizăm odată cu profilul.
      const alocare = await citeste("alocare/" + cand.id);
      await scrieIndexProfiluri(pune(await citesteIndexProfiluri(), randIndex(p, alocare)));
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
    let toate = await toateProfilurile();
    if (!toate.length) toate = await reconstruiesteIndex();
    const grupe = GRUPE_LABEL;
    if (esteAdmin) return json({ rol: "admin", candidati: toate, grupe });
    const aiMei = toate.filter((p) => p.alocare && p.alocare.lectorSlug === actor.slug);
    return json({ rol: "lector", slug: actor.slug, nume: actor.nume, candidati: aiMei, grupe });
  }

  // —— restul e doar pentru admin ——
  if (!esteAdmin) return json({ eroare: "Necesită cod de administrator." }, 403);
  // A doua cheie: codul de admin singur nu poate realoca toți candidații.
  if (!(await dispozitivCunoscut(storeCursuri(), String(body.dispozitiv || "").trim(), "admin")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." }, 403);

  if (actiune === "toate") {
    let toate = await toateProfilurile();
    if (!toate.length) toate = await reconstruiesteIndex(); // index lipsă sau rămas în urmă
    const incarcare = incarcareLectori(toate);
    const { cerereGrupe, cerereRase } = agregare(toate);
    const lectori = lectoriCuGrupe();
    const candidati = toate.map((p) => ({ ...p, sugestii: sugestii(lectori, p.grupe || [], incarcare).slice(0, 3) }));
    return json({
      candidati, deficit: await deficitCurent(), lectori, incarcare,
      cerereGrupe, cerereRase, grupe: GRUPE_LABEL,
    });
  }
  if (actiune === "aloca") {
    const cid = taie(body.cid2 || body.tinta, 80);
    if (!cid) return json({ eroare: "Candidat lipsă." }, 400);
    const slug = taie(body.lectorSlug, 60);
    async function actualizeazaAlocareaInIndex(al) {
      const index = await citesteIndexProfiluri();
      const rand = index.find((x) => x && x.cid === cid);
      if (!rand) return;
      rand.alocare = al;
      await scrieIndexProfiluri(index);
    }
    if (!slug) {
      await st.delete("alocare/" + cid);
      await actualizeazaAlocareaInIndex(null);
      await audit("interese-aloca-sterge", actor, cid);
      return json({ ok: true, alocare: null });
    }
    const l = LECTORI.find((x) => x.slug === slug);
    if (!l) return json({ eroare: "Lector inexistent." }, 400);
    const al = { lectorSlug: l.slug, lectorNume: l.nume, ts: acum(), de: actor.rol };
    await st.setJSON("alocare/" + cid, al);
    await actualizeazaAlocareaInIndex(al);
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
});

// Etichete scurte de grupă (RO), pentru afișare în spațiile lectorilor/adminului fără a importa nomenclatorul.
const GRUPE_LABEL = {
  1: "Grupa 1 — Ciobănești și de cireadă", 2: "Grupa 2 — Pinscher/Schnauzer, Molosoizi",
  3: "Grupa 3 — Terrieri", 4: "Grupa 4 — Bull", 5: "Grupa 5 — Primitivi",
  6: "Grupa 6 — Copoi", 7: "Grupa 7 — Pointeri", 8: "Grupa 8 — Retrieveri/apă",
  9: "Grupa 9 — Companie/agrement", 10: "Grupa 10 — Ogari",
};
