// =========================================================================
// citire-ascendenta.mjs — socoteala din spatele citirii certificatelor, scoasă afară ca
// să poată fi pusă la încercare fără să cheme nimeni nimic în afară.
//
// Aici stau cele două lucruri care se pot strica în tăcere:
//
//   1. MUTAREA GENERAȚIEI. Certificatul tatălui vorbește despre strămoșii TATĂLUI. Față
//      de puiul care se înregistrează, fiecare poziție de acolo urcă cu o generație:
//      „T" de pe certificatul tatălui e „TT" pentru pui. Greșită, ascendența intră
//      întreagă, plauzibilă și decalată cu un rând — adică imposibil de prins la o
//      privire, fiindcă toate numele sunt nume adevărate de câini adevărați.
//
//   2. COMPARAȚIA CU DECLARAȚIA. Ce a scris crescătorul de mână, față de ce scrie pe act.
//      Nu ca să corectăm automat — ca să se uite omul acolo.
//
// Ambele sunt pură socoteală: intră niște valori, ies niște valori. De aceea stau aici și
// nu în funcție, unde ar fi trebuit chemat un API ca să le poți proba.
// =========================================================================

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

/**
 * Ce i se cere citirii. Stă aici, nu în funcție, ca proba pe cuibul 26 să încerce EXACT
 * instrucțiunile care rulează pe server. O probă care își face propria copie a promptului
 * dovedește ceva despre copie.
 */
export const INSTRUCTIUNI = `Ești la registratura unui registru genealogic canin. Ai în față UN certificat de origine (pedigree) tipărit, fotografiat sau scanat.

Transcrii ce vezi. Nu completezi, nu îndrepți, nu deduci.

Reguli care nu se calcă:
- Scrie numele și numerele EXACT cum sunt tipărite: aceleași litere mari/mici, aceleași spații, aceleași semne. Nu „normaliza" nimic.
- O poziție necompletată, sau scrisă „UNKNOWN", „N/A", „-", „S/N", „fără pedigree", înseamnă necunoscută: lasă câmpurile goale, nu o inventa.
- Numele au adesea două părți: numele propriu-zis și afixul canisei (adesea în paranteză sau după o prepoziție străină). Scrie-le pe amândouă, în ordinea de pe act.
- Dacă un caracter poate fi citit în două feluri (0 sau O, 1 sau 7, 5 sau 6, B sau 8), pune sigur=false și scrie în „nelamurire" care sunt variantele. NU alege una la noroc.
- Un număr de pedigree citit greșit intră într-un act oficial și se moștenește apoi de toți descendenții câinelui. Când nu ești sigur, spui că nu ești sigur. Asta e ajutorul care se cere aici, nu o cifră care arată bine.

Cum se numesc pozițiile: codul e drumul de la câinele de pe ACEST certificat în sus, „T" = tată, „M" = mamă. Deci „T" e tatăl lui, „TM" e mama tatălui lui, „TMT" e tatăl mamei tatălui lui. Prima generație de pe certificat (părinții) are coduri de o literă, a doua generație de două litere, și așa mai departe.

Întoarce doar pozițiile pe care le vezi tipărite în document.`;

/**
 * Ce trebuie să scoată citirea, spus ca SCHEMĂ, nu ca rugăminte în text.
 *
 * Cu `output_config.format`, răspunsul e obligat să aibă forma asta. Altfel ar trebui să
 * despicăm text liber și să ghicim ce a vrut să spună — exact felul de cod care merge la
 * nouăsprezece dosare și cade la al douăzecilea, fără să se știe de ce.
 *
 * @param coduri  cele 30 de coduri valabile, ca lista de valori îngăduite la „cod"
 */
export function schemaCitirii(coduri) {
  const pozitie = {
    type: "object",
    properties: {
      cod: { type: "string", enum: coduri, description: "Poziția, ca drum de la câinele de pe ACEST certificat în sus." },
      nume: { type: "string", description: "Numele câinelui exact cum e tipărit. Gol dacă poziția e necunoscută." },
      // Ghilimelele românești «…» nu sunt un moft aici: un „…" într-un șir JS închide șirul.
      nr: { type: "string", description: "Numărul/seria de pedigree exact cum e tipărit (ex. «RKF 4091390»). Gol dacă nu e trecut." },
      titluri: { type: "string", description: "Titlurile și testele medicale, dacă sunt tipărite. Gol altfel." },
      sigur: { type: "boolean", description: "false dacă scrisul e neclar, tăiat, acoperit sau se poate confunda." },
      nelamurire: { type: "string", description: "Ce anume nu e limpede și care sunt variantele. Gol când sigur=true." },
    },
    required: ["cod", "nume", "nr", "titluri", "sigur", "nelamurire"],
    additionalProperties: false,
  };
  return {
    type: "object",
    properties: {
      esteCertificat: { type: "boolean", description: "false dacă documentul nu e un certificat de origine." },
      caine: {
        type: "object",
        description: "Câinele de pe capul certificatului — adică părintele însuși.",
        properties: {
          nume: { type: "string" },
          nr: { type: "string", description: "Numărul acestui certificat (CERTIFIED NO., Nr. înregistrare sau echivalent)." },
          microcip: { type: "string", description: "Microcipul sau tatuajul, doar cifrele tipărite." },
          rasa: { type: "string" },
        },
        required: ["nume", "nr", "microcip", "rasa"],
        additionalProperties: false,
      },
      pozitii: { type: "array", items: pozitie },
    },
    required: ["esteCertificat", "caine", "pozitii"],
    additionalProperties: false,
  };
}

/**
 * Mută pozițiile citite de pe certificatul unui părinte în sistemul de coduri al PUIULUI.
 *
 * @param radacina  „T" pentru certificatul tatălui, „M" pentru al mamei
 * @param pozitii   ce a scos citirea, cu coduri relative la câinele de pe certificat
 * @param coduri    cele 30 de coduri valabile ale puiului (`pozitiiAscendenta()`)
 * @param cine      eticheta documentului, ca să se știe de unde vine fiecare propunere
 * @returns { propuneri, luate, nesigure }
 */
export function mutaSubRadacina(radacina, pozitii, coduri, cine = "") {
  const propuneri = {};
  let luate = 0, nesigure = 0;
  for (const p of Array.isArray(pozitii) ? pozitii : []) {
    // Din cod rămân doar T și M: orice altceva ar fi o poziție pe care n-o putem așeza.
    const drum = taie(p?.cod, 8).toUpperCase().replace(/[^TM]/g, "");
    if (!drum) continue;
    const c = radacina + drum;
    // Generația a 4-a de pe certificatul părintelui e a 5-a pentru pui: nu ne trebuie,
    // și mai ales nu are unde să încapă.
    if (!coduri.includes(c)) continue;
    const nume = taie(p?.nume, 120);
    if (!nume) continue;                      // poziție necunoscută pe certificat
    if (p?.sigur === false) nesigure++;
    luate++;
    propuneri[c] = {
      nume,
      nr: taie(p?.nr, 60),
      titluri: taie(p?.titluri, 120),         // atât păstrează și salvarea; mai mult s-ar pierde tăcut
      sigur: p?.sigur !== false,
      nelamurire: taie(p?.nelamurire, 200),
      din: cine,
    };
  }
  return { propuneri, luate, nesigure };
}

/**
 * Aceeași valoare, scrisă altfel?
 *
 * Se aruncă tot ce e semn de punctuație și se compară literele și cifrele. „WDF.RO 150194
 * R22" și „WDF.RO150194R22" sunt același număr.
 *
 * PARANTEZELE ȘI VIRGULELE au fost adăugate după proba pe cuibul 26, unde din 12
 * „nepotriviri" zece erau doar felul în care se scrie afixul canisei: formularul nostru îl
 * pune în paranteză — „OLIVER (Stone FCI)" — iar certificatul polonez îl scrie fără —
 * „OLIVER Stone (FCI)". Același câine, aceeași canisă, altă convenție tipografică.
 *
 * Nu e o subtilitate. Zece avertismente false pe un dosar înseamnă că al unsprezecelea, cel
 * adevărat, trece nevăzut — registratura a învățat deja că avertismentele nu spun nimic.
 * Iar cele trei adevărate de la cuibul 26 (ADEKAIDA/ADELAIDA, TAINSTVENNYA/TAINSTVENNAYA,
 * 4396006/4396008) trec în continuare, fiindcă acolo diferă literele, nu semnele.
 */
export const laFel = (a, b) => {
  const n = (x) => taie(x, 200).toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
  return n(a) === n(b);
};

/**
 * Unde nu se potrivește declarația crescătorului cu actul de origine.
 *
 * Se compară doar câmpurile completate în AMÂNDOUĂ: un câmp gol înseamnă „nu știu", nu
 * „altceva". O nepotrivire scoasă din gol e zgomot, iar zgomotul se ignoră — inclusiv
 * atunci când, o dată la o sută de dosare, ar fi fost adevărat.
 */
export function nepotrivirile({ declarat = {}, citit = {}, rasaDosar = "", eticheta = "părintelui" }) {
  const out = [];
  const cf = (camp, a, b, nota) => {
    if (a && b && !laFel(a, b)) out.push({ camp, declaratie: String(a), document: String(b), ...(nota ? { nota } : {}) });
  };
  cf(`numele ${eticheta}`, declarat.nume, citit.nume);
  cf(`seria de pedigree a ${eticheta}`, declarat.pedigree, citit.nr);
  cf(`microcipul ${eticheta}`, declarat.microcip, citit.microcip);
  // Rasa de pe un act străin e scrisă în limba lui: certificatul polonez al tatălui din
  // cuibul 26 spune „Pudel toy" acolo unde noi scriem „Poodle". Nu scoatem rândul —
  // un dosar de Poodle cu certificat de Pomeranian e tocmai ce trebuie prins — dar se
  // spune pe față de ce poate să difere, ca să nu fie citit drept greșeală.
  cf(`rasa (de pe certificatul ${eticheta})`, rasaDosar, citit.rasa,
    "Certificatele străine scriu rasa în limba lor; verifică dacă e altă rasă sau doar alt cuvânt.");
  return out;
}
