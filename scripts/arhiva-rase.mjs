// potriveste-rasa.mjs — leagă rasa scrisă în formular de nomenclatorul WDF.
//
// DE CE NU „CEL MAI APROPIAT NUME". Am probat potrivirea aproximativă: a dat
// „Ciobănesc German" pentru un cuib de Ciobănesc Belgian Malinois. Într-un registru
// genealogic asta nu e o greșeală de scriere, e o origine falsă, moștenită de toți
// descendenții. Deci: se potrivește EXACT, iar ce nu se potrivește exact se oprește și
// se arată omului. Singura îngăduință e la greșelile de tastare evidente (o literă),
// și numai când rezultatul e neîndoielnic.
//
// CHEIA e că formularul are DOUĂ câmpuri: rasa și varietatea. Nomenclatorul le ține
// adesea împreună („Ciobănesc Belgian Malinois", „American Bully Pocket"), iar uneori
// varietatea E numele din nomenclator („German Spitz" + „Pomeranian" -> „Pomeranian").

export const norm = (s) => String(s || "").toLowerCase()
  .replace(/[ăâ]/g, "a").replace(/î/g, "i").replace(/[șş]/g, "s").replace(/[țţ]/g, "t")
  .replace(/\((?:ro|en)\)/g, " ")
  .replace(/[^a-z0-9]+/g, " ").trim();

function distanta(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const gol = (v) => !v || /^[-–_\s]*$/.test(String(v));

/**
 * @returns {{rasa, cum:"exact"|"tastare", prin:string} | {eroare:string, apropiate:string[]}}
 */
export function potriveste(rasaBruta, varietateBruta, rase) {
  const r = String(rasaBruta || "").trim();
  const v = gol(varietateBruta) ? "" : String(varietateBruta).trim();

  // Formularul scrie uneori „GERMAN SPITZ / (RO) SPITZ GERMAN" — fiecare parte e candidat.
  const partiRasa = r.split("/").map((x) => x.trim()).filter(Boolean);

  // ORDINEA CONTEAZĂ: de la specific la general.
  //
  //   1. rasă + varietate  — „Ciobănesc Belgian" + „Malinois"
  //   2. varietate singură — „Volkodav", „Pomeranian": registratura a scris-o TOCMAI ca
  //      să restrângă, iar în nomenclator sunt rase de sine stătătoare;
  //   3. rasă singură      — numele general, când varietatea nu spune o rasă.
  //
  // Ordinea inversă (rasa înaintea varietății) părea firească și era greșită: la cuibul
  // 19 se potriveau amândouă — „Ciobănesc de Asia Centrală" ȘI „Volkodav" — iar cuibul
  // ar fi intrat în registru sub rasa generală, pierzând tocmai precizarea pentru care
  // există câmpul de varietate.
  const candidati = [];
  for (const p of partiRasa) if (v) candidati.push({ text: p + " " + v, prin: "rasă + varietate" });
  if (v) candidati.push({ text: v, prin: "varietate" });
  for (const p of partiRasa) candidati.push({ text: p, prin: "rasă" });

  // 1) Potrivire EXACTĂ, în ordinea de mai sus (cea mai specifică întâi).
  for (const c of candidati) {
    const t = norm(c.text);
    if (!t) continue;
    const gasit = rase.find((x) => norm(x.ro) === t || norm(x.en) === t);
    if (gasit) return { rasa: gasit, cum: "exact", prin: c.prin };
  }

  // 2) O singură literă greșită, și numai dacă UN SINGUR nume e la distanța aceea:
  //    dacă două rase sunt la fel de aproape, alegerea ar fi pe ghicite.
  for (const c of candidati) {
    const t = norm(c.text);
    if (t.length < 6) continue;                 // numele scurte se confundă prea ușor
    const la1 = [];
    for (const x of rase) {
      for (const nume of [norm(x.ro), norm(x.en)]) {
        if (distanta(t, nume) === 1 && !la1.some((y) => y.ro === x.ro)) la1.push(x);
      }
    }
    if (la1.length === 1) return { rasa: la1[0], cum: "tastare", prin: c.prin };
    if (la1.length > 1) break;                  // ambiguu: mai bine oprim
  }

  // 3) Nu ghicim. Arătăm cele mai apropiate, ca omul să aleagă.
  const scoruri = rase.map((x) => ({
    x, d: Math.min(distanta(norm(r + " " + v), norm(x.ro)), distanta(norm(r + " " + v), norm(x.en))),
  })).sort((a, b) => a.d - b.d).slice(0, 5);
  return {
    eroare: `„${r}${v ? " / " + v : ""}" nu se potrivește cu nicio rasă din nomenclator`,
    apropiate: scoruri.map((s) => s.x.ro),
  };
}
