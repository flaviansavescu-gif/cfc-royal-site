// _comun/dovada-plata.mjs — CÂND se poate șterge dovada plății din cloud.
//
// Dovada e o dată personală, deci nu stă în cloud mai mult decât trebuie. Dar „trebuie"
// înseamnă DOUĂ lucruri, nu unul (lecția din 02.09.2026, cazurile LISA și A-ROSA):
//   1. Managerul a importat-o (are copia lui, lângă înscriere);
//   2. REGISTRATURA a încheiat verificarea documentară („verificat" pe fișă).
// Înainte se ștergea doar pe (1): dacă adminul importa repede, registratura rămânea cu un
// buton mort — dovada plecase înainte să apuce s-o confrunte cu extrasul. Acum ordinea
// operațiilor nu mai contează: dovada stă exact cât are registratura nevoie de ea și
// dispare imediat ce ambele condiții sunt împlinite. „De lămurit" sau nemarcat = rămâne.
//
// O dovadă poate fi comună unui LOT de câini — se șterge abia când TOȚI o încheie.

/** `coada/<show>/<sufix>` -> `verificare/<show>/<sufix>` (oglindește cheia fișei). */
export const cheiaMarcajului = (cheieCoada) =>
  "verificare/" + String(cheieCoada || "").slice("coada/".length);

/**
 * Șterge dovezile din `dovadaKeys` care și-au încheiat treaba: fiecare fișă din coadă
 * care le folosește e `importat: true` ȘI are marcajul registraturii `stare: "verificat"`.
 * FAIL-SAFE: la ORICE eroare de citire nu se șterge nimic — mai bine o dovadă rămasă
 * decât una pierdută înainte de vreme.
 * @returns numărul de dovezi șterse
 */
export async function stergeDovezileIncheiate(store, showId, dovadaKeys) {
  // Doar dovezile expoziției CERUTE: chemarea poate veni cu chei din mai multe expoziții
  // (marcarea în lot), iar noi listăm coada unei singure expoziții — o dovadă din alta
  // n-ar fi găsită de nicio fișă și s-ar șterge nemeritat. Cheia poartă showId în ea.
  const candidate = new Set(
    [...(dovadaKeys || [])].filter((k) => typeof k === "string" && k.startsWith("dovada/" + showId + "/")),
  );
  if (!candidate.size || !showId) return 0;

  const deTinut = new Set();
  try {
    const { blobs } = await store.list({ prefix: "coada/" + showId + "/" });
    for (const b of blobs) {
      const i = await store.get(b.key, { type: "json" });
      // O fișă listată dar necitibilă (decalaj de consistență) NU e o fișă absentă:
      // nu știm ce dovadă ține, deci ținem TOT ce e în joc. Direcția sigură.
      if (!i) { for (const dk of candidate) deTinut.add(dk); continue; }
      if (!i.dovadaKey || !candidate.has(i.dovadaKey)) continue;
      if (i.importat !== true) { deTinut.add(i.dovadaKey); continue; }
      const v = await store.get(cheiaMarcajului(b.key), { type: "json" });
      if (!v || v.stare !== "verificat") deTinut.add(i.dovadaKey);
    }
  } catch (err) {
    console.error("Curățenia dovezilor: citire eșuată — nu șterg nimic:", err?.message || err);
    return 0;
  }

  let sterse = 0;
  for (const dk of candidate) {
    if (deTinut.has(dk)) continue;
    await store.delete(dk).catch(() => {});
    sterse++;
  }
  return sterse;
}
