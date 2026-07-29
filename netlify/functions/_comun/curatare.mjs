// _comun/curatare.mjs — ștergerea COMPLETĂ a urmelor unui candidat.
//
// Problema reparată: ștergerea unui candidat atingea doar store-ul „cursuri"
// (fișa + progresul). Rămâneau în urmă răspunsurile din Sala de analiză, cele de
// la exercițiile de anatomie, sesiunile și imaginile lui, apartenența la exerciții
// și profilul de interese — un candidat șters continua să apară în platformă.
//
// Aici se șterg, într-un singur loc, toate cheile legate de un candidat. Când apare
// un modul nou care ține date per candidat, se adaugă în lista de mai jos.
import { getStore } from "@netlify/blobs";
import { scoate } from "../_interese/logica.mjs";

/** Șterge o cheie fără să oprească restul curățării dacă eșuează. */
async function sterge(store, cheie, raport) {
  try { await store.delete(cheie); raport.sterse.push(cheie); }
  catch (err) { console.error("Nu am putut șterge " + cheie + ":", err); raport.esuate.push(cheie); }
}

/** Scoate candidatul din listele de participanți (JCR și PAA). */
async function scoateDinParticipanti(store, prefix, cid, raport) {
  let blobs = [];
  try { ({ blobs } = await store.list({ prefix })); }
  catch (err) { console.error("Listare " + prefix + " eșuată:", err); return; }
  for (const b of blobs) {
    try {
      const p = await store.get(b.key, { type: "json" });
      if (!p || !Array.isArray(p.candidateIds) || !p.candidateIds.includes(cid)) continue;
      p.candidateIds = p.candidateIds.filter((x) => x !== cid);
      await store.setJSON(b.key, p);
      raport.actualizate.push(b.key);
    } catch (err) { console.error("Actualizare " + b.key + " eșuată:", err); raport.esuate.push(b.key); }
  }
}

/** Șterge toate cheile dintr-un prefix care conțin „/<cid>" la final. */
async function stergeDupaSufix(store, prefix, cid, raport) {
  let blobs = [];
  try { ({ blobs } = await store.list({ prefix })); }
  catch (err) { console.error("Listare " + prefix + " eșuată:", err); return; }
  for (const b of blobs) if (b.key.endsWith("/" + cid)) await sterge(store, b.key, raport);
}

/**
 * Șterge tot ce ține de un candidat, din toate modulele.
 * `cid` = identificatorul candidatului (sha256 al codului personal).
 * Întoarce un raport cu ce s-a șters — util în audit și la depanare.
 */
export async function stergeUrmeleCandidatului(cid) {
  const raport = { cid, sterse: [], actualizate: [], esuate: [] };
  if (!cid) return raport;

  // ——— Sala de analiză (JCR) ———
  const jcr = getStore("jcr");
  await stergeDupaSufix(jcr, "response/", cid, raport);   // response/<sesiune>/<cid>
  await stergeDupaSufix(jcr, "feedback/", cid, raport);   // feedback/<sesiune>/<cid>
  await scoateDinParticipanti(jcr, "participants/", cid, raport);

  // ——— Exerciții de anatomie + sesiuni proprii (PAA) ———
  const paa = getStore("paa");
  await stergeDupaSufix(paa, "ex-raspuns/", cid, raport); // ex-raspuns/<exercitiu>/<cid>
  await scoateDinParticipanti(paa, "ex-participanti/", cid, raport);

  // Sesiunile lui de adnotare (indexate pe candidat) + imaginile lor.
  try {
    const idx = (await paa.get("session-index/" + cid, { type: "json" })) || [];
    for (const s of idx) if (s && s.id) await sterge(paa, "session/" + s.id, raport);
  } catch (err) { console.error("Citire session-index eșuată:", err); }
  await sterge(paa, "session-index/" + cid, raport);

  // Imaginile încărcate de el (proprietarul e în image-meta).
  try {
    const { blobs } = await paa.list({ prefix: "image-meta/" });
    for (const b of blobs) {
      try {
        const meta = await paa.get(b.key, { type: "json" });
        if (!meta || meta.userId !== cid) continue;
        const imgId = b.key.slice("image-meta/".length);
        await sterge(paa, "image/" + imgId, raport);
        await sterge(paa, b.key, raport);
      } catch (err) { console.error("Curățare imagine " + b.key + " eșuată:", err); }
    }
  } catch (err) { console.error("Listare image-meta eșuată:", err); }

  // ——— Interese pe rase ———
  const interese = getStore("interese");
  await sterge(interese, "profil/" + cid, raport);
  await sterge(interese, "alocare/" + cid, raport);
  // Listele Panoului și ale lectorilor se servesc dintr-un index — îl actualizăm și pe el,
  // altfel candidatul șters ar mai apărea acolo până la prima auto-vindecare.
  try {
    const index = (await interese.get("profil-index", { type: "json" })) || [];
    const fara = scoate(index, cid);
    if (fara.length !== index.length) {
      await interese.setJSON("profil-index", fara);
      raport.actualizate.push("profil-index");
    }
  } catch (err) { console.error("Actualizare profil-index eșuată:", err); }

  return raport;
}

/** Identificatorii candidaților care există cu adevărat în registru. */
async function candidatiExistenti() {
  const set = new Set();
  try {
    const { blobs } = await getStore("cursuri").list({ prefix: "candidat/" });
    for (const b of blobs) set.add(b.key.slice("candidat/".length));
  } catch (err) { console.error("Listare candidați eșuată:", err); }
  return set;
}

/**
 * Curățare RETROACTIVĂ: găsește datele rămase de la candidați care nu mai există
 * (șterși înainte ca ștergerea să curețe și celelalte module) și le înlătură.
 *
 * Măsură de siguranță: dacă registrul de candidați pare gol, nu ștergem nimic —
 * altfel o eroare de citire ar rade toate datele platformei.
 */
export async function curataOrfanii() {
  const vii = await candidatiExistenti();
  const raport = { candidatiVii: vii.size, orfani: [], sterse: [], actualizate: [], esuate: [], oprit: false };
  if (vii.size === 0) {
    raport.oprit = true; // registrul nu s-a putut citi — nu riscăm
    return raport;
  }

  // Adunăm identificatorii care apar în module dar nu mai există în registru.
  const suspecti = new Set();
  const dinSufix = async (store, prefix) => {
    try {
      const { blobs } = await store.list({ prefix });
      for (const b of blobs) {
        const parti = b.key.slice(prefix.length).split("/");
        const cid = parti[parti.length - 1];
        if (cid && !vii.has(cid)) suspecti.add(cid);
      }
    } catch (err) { console.error("Listare " + prefix + " eșuată:", err); }
  };

  const jcr = getStore("jcr"), paa = getStore("paa"), interese = getStore("interese");
  await dinSufix(jcr, "response/");
  await dinSufix(jcr, "feedback/");
  await dinSufix(paa, "ex-raspuns/");
  await dinSufix(paa, "session-index/");
  await dinSufix(interese, "profil/");
  await dinSufix(interese, "alocare/");

  // Participanții pot conține identificatori dispăruți chiar dacă nu au lăsat răspunsuri.
  for (const [store, prefix] of [[jcr, "participants/"], [paa, "ex-participanti/"]]) {
    try {
      const { blobs } = await store.list({ prefix });
      for (const b of blobs) {
        const p = await store.get(b.key, { type: "json" });
        for (const cid of (p && p.candidateIds) || []) if (!vii.has(cid)) suspecti.add(cid);
      }
    } catch (err) { console.error("Listare " + prefix + " eșuată:", err); }
  }

  for (const cid of suspecti) {
    raport.orfani.push(cid);
    const r = await stergeUrmeleCandidatului(cid);
    raport.sterse.push(...r.sterse);
    raport.actualizate.push(...r.actualizate);
    raport.esuate.push(...r.esuate);
  }
  return raport;
}
