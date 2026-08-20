// _comun/index-cachedat.mjs — index public cachedat, cu lacăt de reconstrucție.
//
// DE CE. Registrul public și „Cuiburi disponibile" servesc un index cachedat care se
// reconstruiește când e mai vechi de un TTL. Fără grijă, la trecerea TTL-ului mai mulți
// vizitatori sosiți în aceeași clipă reconstruiesc TOȚI indexul deodată (scanând toate
// blob-urile) — „turma tunătoare". Aici, un singur cerere ia un LACĂT și reconstruiește;
// ceilalți, cât timp există o copie (fie și învechită), o primesc pe aceea imediat.
//
// Lacătul are viață scurtă (se stinge singur), ca o reconstrucție care crapă la mijloc să
// nu blocheze pe veci reîmprospătarea.

const LACAT_MS = 30e3;

async function iaLacatul(s, cheieLacat) {
  const cur = await s.getWithMetadata(cheieLacat, { type: "json" }).catch(() => null);
  const acum = Date.now();
  if (cur?.data && (acum - (cur.data.la || 0)) < LACAT_MS) return false;   // lacăt încă viu
  // Fie nu există, fie a expirat: încearcă să-l iei CONDIȚIONAT, ca doi să nu-l ia deodată.
  const optiuni = cur?.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
  const w = await s.setJSON(cheieLacat, { la: acum }, optiuni).catch(() => ({ modified: false }));
  return w?.modified !== false;
}

/**
 * Întoarce indexul cachedat, reconstruindu-l cel mult o dată pe TTL și cel mult de un
 * singur apel deodată. `construieste()` trebuie să întoarcă un obiect cu câmpul `generat`
 * (dată ISO). Dacă indexul e învechit dar altcineva îl reconstruiește chiar acum, se
 * servește copia veche (stale-while-revalidate); la rece (fără nicio copie) se reconstruiește.
 */
export async function obtineIndexCachedat(s, { cheie, ttlMs, construieste }) {
  const cur = await s.getWithMetadata(cheie, { type: "json" }).catch(() => null);
  const idx = cur?.data || null;
  if (idx && Date.now() - Date.parse(idx.generat || 0) <= ttlMs) return idx;

  const cheieLacat = cheie + "-lacat";
  const amLacatul = await iaLacatul(s, cheieLacat);
  if (!amLacatul && idx) return idx;   // altcineva reconstruiește; dă copia veche, nu mai scana

  const nou = await construieste(s);
  // Scriere CONDIȚIONATĂ pe starea citită la intrare. Fără condiție, o publicare care
  // ȘTERGE indexul (ca ediția nouă să apară imediat) putea fi suprascrisă de o
  // reconstrucție pornită cu o clipă înainte — iar indexul vechi, fără ediția proaspătă,
  // trăia până la TTL. Dacă între timp cheia a fost ștearsă sau rescrisă, ștergerea
  // câștigă: nu persistăm, doar servim acestei cereri ce am construit.
  const conditie = cur?.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
  await s.setJSON(cheie, nou, conditie).catch(() => {});
  if (amLacatul) await s.delete(cheieLacat).catch(() => {});
  return nou;
}
