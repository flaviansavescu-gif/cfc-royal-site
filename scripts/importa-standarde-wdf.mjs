// importa-standarde-wdf.mjs — standardele WDF (.docx) -> baza aplicației Breed Explorer.
//
// DE CE EXISTĂ. Aplicația „Explorator de standarde CFC-Royal" a pornit cu 32 de fișe scrise
// de mână. Asociația are însă standardele oficiale ale celor peste 330 de rase, pe grupe,
// în documente Word. Transcrierea lor de mână ar fi durat luni și ar fi introdus greșeli;
// scriptul le citește, le taie pe secțiuni și le așază în schema aplicației.
//
// CE NU FACE. Nu inventează și nu „îmbunătățește" nimic: textul fiecărei rubrici e cel
// din standard, tăiat la rubrica lui. Notele pedagogice (confuzii frecvente, repere de
// arbitraj) NU se generează — ele rămân munca lectorilor și se completează în aplicație.
// De aceea fișele importate poartă `source_verification_status: "imported"`: se vede din
// date care fișă vine din document și care a fost lucrată de om.
//
// FIȘELE EXISTENTE NU SE PIERD. Cele scrise de mână (rasele românești, cu notele lor de
// arbitraj) sunt păstrate întregi; pentru ele importul completează doar rubricile goale.
//
// Rulare:
//   node scripts/importa-standarde-wdf.mjs "<calea către folderul cu grupele>"
//   node scripts/importa-standarde-wdf.mjs --raport    (doar numără, nu scrie nimic)
import fs from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { fileURLToPath } from "node:url";

const RADACINA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// Datele NU mai stau în `public/` (ar fi descărcabile de oricine): trec prin funcția
// `breed-date`, care le dă doar cu un cod valid de platformă. Aici e fișierul pe care
// funcția îl leagă în pachetul ei.
const TINTA_JSON = path.join(RADACINA, "netlify", "functions", "_breed", "breeds.json");

// ——— Citirea unui .docx ———————————————————————————————————————————————

/** Textul unui .docx, cu un rând pe paragraf. */
function textDinDocx(cale) {
  const arhiva = unzipSync(new Uint8Array(fs.readFileSync(cale)));
  const doc = arhiva["word/document.xml"];
  if (!doc) throw new Error("document.xml lipsește din " + cale);
  let xml = strFromU8(doc);
  // Fiecare paragraf devine un rând; tabulările devin spații.
  xml = xml.replace(/<w:tab[^>]*\/>/g, " ").replace(/<\/w:p>/g, "\n");
  const brut = xml.replace(/<[^>]+>/g, "");
  return brut
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&")
    .replace(/ /g, " ")
    .split("\n").map((r) => r.replace(/[ \t]+/g, " ").trim()).join("\n");
}

// ——— Tăierea pe secțiuni ——————————————————————————————————————————————

/**
 * Etichetele standardului, cu variantele lor de scriere. Documentele vin din surse
 * diferite și scriu aceeași rubrică în mai multe feluri („GAIT / MOVEMENT", „GAIT/MOVEMENT",
 * „GAIT"); fără normalizare, rubrica ar rămâne goală tocmai la rasele scrise altfel.
 */
/**
 * Clasifică o etichetă (deja MAJUSCULE, spații normalizate) la o rubrică — sau null.
 *
 * DE CE UN CLASIFICATOR, nu o listă fixă de tipare. Documentele vin din surse și ani
 * diferiți și scriu aceeași rubrică în zeci de feluri, cu tot cu greșeli de tastare:
 * „SIZE, WEIGHT AND MEASUREMENTS", „SIZES", „SIZEAND WEIGHT", „COATS AND VARIETIES",
 * „DISQUALYFING FAULTS", „DIQUALIFYING FAULTS", „TEMPERAMENT / BEHAVIOUR" (inversat),
 * „BEHAVIOUR AND CHARACTER". O listă de tipare exacte le rata pe toate — iar rubrica
 * mărimii, cea mai importantă pentru un arbitru, rămânea goală la zeci de rase. Aici
 * clasificăm pe cuvinte-cheie tolerante, ca varianta scrisă altfel să nimerească totuși.
 *
 * ORDINEA CONTEAZĂ: defectele întâi (ca „IMPORTANT FAULTS" să nu ajungă la „PROPORTIONS"
 * din cauza cuvântului), apoi rubricile precise, la urmă cele prinse pe cuvânt-cheie.
 */
function clasificaEticheta(n) {
  n = n.replace(/\s+/g, " ").trim();
  if (!n) return null;
  // „LIMBS" e doar containerul din care ies FOREQUARTERS și HINDQUARTERS; unele documente
  // le lipesc: „LIMBS FOREQUARTERS: …". Fără asta, textul membrelor din față rămânea prins
  // în coadă (TAIL) — s-a văzut la Kelpie.
  n = n.replace(/^LIMBS\s+(?=FORE|HIND)/, "");

  // — Defecte (cele mai pline de greșeli de scriere) —
  if (/FAULT/.test(n)) {
    if (/D[IY]S?QUAL|ELIMINAT/.test(n)) return "DISQUALIFYING";     // DISQUALIFYING, DIQUALIFYING, DYSQUAL…, ELIMINATING
    if (/SEVER|SERIOUS|IMPORTANT|GRAVE|MAJOR/.test(n)) return "SERIOUS";
    return "FAULTS";                                                 // FAULTS, MINOR/SLIGHT FAULTS → defecte generale
  }
  // — Rubrici precise (potrivire pe rând întreg) —
  if (/^(?:COUNTRY OF )?ORIGIN(?: ?\/ ?PATRONAGE)?$/.test(n)) return "ORIGIN";
  if (/^COUNTRY OF DEVELOPMENT$/.test(n)) return "DEZVOLTARE";
  if (/^PATRONAGE$/.test(n)) return "PATRONAGE";
  if (/^DATE OF PUBLICATION/.test(n)) return "DATE";
  if (/^UTILI[SZ]ATION$/.test(n)) return "UTILIZATION";
  if (/^CLASSIFICATION/.test(n)) return "CLASSIFICATION";
  if (/^BRIEF HISTORICAL/.test(n)) return "HISTORY";
  if (/^GENERAL APPEARANCE$/.test(n)) return "GENERAL";
  if (/IMPORT.{0,3}ANT\b.*(?:PROP?ORTION|PORPORTION)/.test(n)) return "PROPORTIONS";   // + IMORTANT, PORPORTIONS
  // — Temperament: BEHAVIOUR/CHARACTER/TEMPERAMENT, în orice ordine —
  if (/BEHAVIOU?R|TEMPERAMENT|^CHARACTER$/.test(n) && !/APPEARANCE/.test(n)) return "TEMPERAMENT";
  if (/^HEAD$/.test(n)) return "HEAD";
  if (/^CRANIAL REGION$/.test(n)) return "CRANIAL";
  if (/^FACIAL REGION$/.test(n)) return "FACIAL";
  if (/^EYES?$/.test(n)) return "EYES";
  if (/^EARS?$/.test(n)) return "EARS";   // „EAR" la singular (Pumi) e tot rubrica urechilor
  if (/^NECK$/.test(n)) return "NECK";
  if (/^BODY$/.test(n)) return "BODY";
  if (/^TAIL$/.test(n)) return "TAIL";
  if (/^LIMBS$/.test(n)) return "LIMBS";
  if (/^FOREQUARTERS$/.test(n)) return "FOREQUARTERS";
  if (/^HINDQUARTERS$/.test(n)) return "HINDQUARTERS";
  if (/^FEET$/.test(n)) return "FEET";
  if (/^SKIN$/.test(n)) return "SKIN";
  if (/^N\.?B\.?$/.test(n)) return "NB";
  if (/^TRANSLATION/.test(n)) return "TRANSLATION";
  // — Prinse pe cuvânt-cheie (toate variantele și greșelile) —
  if (/\b(?:GAIT|MOVEMEN)/.test(n)) return "MOVEMENT";              // GAIT, GAIT/MOVEMENT, MOVEMENT, GAIT/MOVEMEN
  if (/^COAT|^COATS\b|^HAIR(?: TEXTURE)?$/.test(n)) return "COAT";   // COAT, COATS AND VARIETIES, HAIR
  if (/^COLOU?RS?$/.test(n)) return "COLOUR";
  if (/\b(?:SIZE|WEIGHT|HEIGHT|MEASUREMENT)/.test(n)) return "SIZE"; // SIZE, SIZES, SIZE AND WEIGHT, HEIGHT AT WITHERS…
  return null;
}

/**
 * Etichetele scrise în clar, pentru spargerea paragrafelor lipite.
 *
 * DE CE. O parte din documente au tot standardul într-un SINGUR paragraf: „…ORIGIN:
 * Australia. DATE OF PUBLICATION…: 08.10.2012. UTILIZATION: Sheepdog.-CLASSIFICATION:…".
 * Tăierea pe început de rând nu vede acolo nicio rubrică, iar rasa iese aproape goală —
 * așa s-a întâmplat cu Kelpie și Ciobănescul German. Înaintea tăierii, fiecare etichetă
 * găsită oriunde în text primește un rând al ei.
 */
/**
 * Găsește orice etichetă „CUVINTE MARI:" din interiorul unui rând și o pune pe rândul
 * ei. Nu ține o listă de etichete cunoscute — o taie pe ORICE grup de cuvinte cu
 * majuscule urmat de „:", apoi lasă clasificatorul să hotărască la tăierea în secțiuni.
 * Așa prinde și variantele pe care nu le-am prevăzut, fără să le enumerăm pe toate.
 */
// Eticheta poate fi urmată de „:" sau, în listele de defecte, direct de o bulină „•".
// Doar MAJUSCULE: etichetele title-case („Colour:", „Height:") din paragrafele lipite se
// recuperează în altă parte (sub-rubrici + plasa de mărime). Prinderea lor aici, global,
// muta din greșeală rubrici bune și golea culoarea la mai multe rase.
const RE_SPARGE = /(?:^|[.\-–—]\s?|\s)([A-Z][A-Z /&,()'.-]{2,55}?)\s*(:|(?=[•·]))/g;

function spargeEtichetele(text) {
  return text.split("\n").map((rand) =>
    rand.replace(RE_SPARGE, (intreg, eticheta, terminator) => {
      // Doar dacă e o rubrică recunoscută: altfel am rupe fraze care conțin din
      // întâmplare majuscule urmate de „:" (nume proprii, prescurtări).
      return clasificaEticheta(eticheta.replace(/\s+/g, " ").trim().toUpperCase())
        ? "\n" + eticheta.trim() + ":" + (terminator === ":" ? "" : " ")
        : intreg;
    })).join("\n");
}

/**
 * Recunoaște eticheta de la începutul unui rând: „EYES:", „HEAD Long, …", „Limbs".
 *
 * O parte din documente NU scriu rubricile cu majuscule („General appearance", „Coat",
 * „Size/weight" — așa e redactat, de pildă, standardul Ciobănescului German). Căutarea
 * doar după majuscule lăsa astfel de rase aproape goale, deși documentul e întreg; de
 * aceea potrivirea se face pe forma normalizată, indiferent de cum sunt scrise literele.
 */
function etichetaLa(rand) {
  const potriveste = (brut, rest) => {
    const brutN = brut.replace(/\s+/g, " ").trim();
    const cheie = clasificaEticheta(brutN.toUpperCase());
    if (!cheie) return null;
    // Etichetele prinse pe cuvânt-cheie (SIZE, MOVEMENT, COAT, COLOUR) se acceptă și cu
    // literă mică: unele standarde scriu „Height:" sau „Size/weight" ca titlu de secțiune
    // (Porcelaine, Ciobănescul German), iar restricția de majuscule pierdea tocmai
    // mărimea. Sub-rubricile scrise mic („Weight:" din interiorul SIZE) mapează la aceeași
    // cheie de secțiune, deci reîncep secțiunea fără să piardă text.
    return { cheie, rest: (rest || "").trim() };
  };
  // Lungimea maximă a unei etichete: „DATE OF PUBLICATION OF THE OFFICIAL VALID
  // STANDARD" are 49 de semne. Cu pragul pus la 45, tocmai data standardului rămânea
  // necitită — la 305 din 313 de rase.
  // 1. Rând care e DOAR eticheta: „Limbs", „COAT", „Size/weight".
  const singur = /^([A-Za-z][A-Za-z .,\/&-]{1,60})$/.exec(rand.trim());
  if (singur) { const r = potriveste(singur[1], ""); if (r) return r; }
  // 2. Etichetă urmată de „:" — forma obișnuită.
  const cuDoua = /^([A-Za-z][A-Za-z0-9 .,\/&()'-]{1,60}?)\s*:\s*(.*)$/.exec(rand);
  if (cuDoua) { const r = potriveste(cuDoua[1], cuDoua[2]); if (r) return r; }
  // 3. Etichetă cu majuscule, urmată direct de text: „HEAD Long, moderate width."
  const lipit = /^([A-Z][A-Z ]{2,60}?)\s+([A-Z][a-z].*)$/.exec(rand);
  if (lipit) { const r = potriveste(lipit[1], lipit[2]); if (r) return r; }
  // 3b. Etichetă cu majuscule urmată direct de o listă cu buline, FĂRĂ „:" — chiar așa e
  // scris „DISQUALIFYING FAULTS • Aggressive…" în multe standarde. Fără asta, defectele
  // eliminatorii rămâneau prinse în rubrica generală (minor), iar quizul le clasa greșit.
  const bulina = /^([A-Z][A-Z ]{2,60}?)\s+([•·].*)$/.exec(rand);
  if (bulina) { const r = potriveste(bulina[1], bulina[2]); if (r) return r; }
  // 4. Etichetă scrisă cu literă mică, urmată direct de text: „General appearance The …"
  const mic = /^([A-Z][a-z]+(?: [a-z]+){0,3})\s+([A-Z].*)$/.exec(rand);
  if (mic) { const r = potriveste(mic[1], mic[2]); if (r) return r; }
  return null;
}

/** Taie textul standardului în secțiuni, după etichete. */
function sectiuni(textBrut) {
  const text = spargeEtichetele(textBrut);
  const out = {};
  let curenta = null, adunat = [];
  const inchide = () => {
    if (curenta) out[curenta] = (out[curenta] ? out[curenta] + " " : "") + adunat.join(" ").trim();
    adunat = [];
  };
  for (const rand of text.split("\n")) {
    if (!rand) continue;
    const e = etichetaLa(rand);
    if (e) { inchide(); curenta = e.cheie; if (e.rest) adunat.push(e.rest); }
    else if (curenta) adunat.push(rand);
  }
  inchide();
  for (const k of Object.keys(out)) out[k] = out[k].replace(/\s+/g, " ").trim();
  return out;
}

/**
 * Sub-rubricile dintr-o secțiune: „Skull: Flat. Stop: Slight." -> { skull, stop }.
 * Se caută doar numele cunoscute — altfel orice cuvânt urmat de „:" ar tăia fraza.
 */
const SUBRUBRICI = [
  "Skull", "Stop", "Nose", "Muzzle", "Nasal bridge", "Lips", "Jaws", "Jaws / Teeth", "Jaws/Teeth",
  "Teeth", "Cheeks", "Eyes", "Ears", "Neck", "Topline", "Withers", "Back", "Loin", "Croup", "Rump",
  "Chest", "Ribcage", "Underline", "Underline and belly", "Belly", "Tail", "General appearance",
  "Shoulder", "Shoulders", "Upper arm", "Elbow", "Elbows", "Forearm", "Carpus", "Metacarpus",
  "Metacarpus (Pastern)", "Pastern", "Forefeet", "Front feet", "Feet", "Thigh", "Upper thigh",
  "Lower thigh", "Thigh and lower thigh", "Stifle", "Stifle (Knee)", "Knee", "Hock", "Hock joint",
  "Metatarsus", "Metatarsus (Rear pastern)", "Rear pastern", "Hind feet", "Hindfeet",
  // „Hair" și „Colour" SUNT sub-rubrici ale robei; „Coat" și „Size" NU — ele sunt rubrici
  // de sine stătătoare. Ca sub-rubrici, „Coat:" rupea „Curly Coat:"/„Corded Coat:" ale
  // lui Caniche, iar blana ajungea un singur cuvânt, „Curly", pierzând cei 20 cm ai
  // șnururilor. „Height at the withers"/„Height"/„Weight" rămân, ca reperele de mărime.
  "Hair", "Colour", "Color", "Height at the withers", "Height", "Weight",
];
const RE_SUB = new RegExp(
  "(?:^|\\s)(" + SUBRUBRICI.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\s*:\\s*",
  "g");

function subrubrici(text) {
  if (!text) return {};
  const out = {};
  const bucati = [];
  let m, ultim = null, poz = 0;
  RE_SUB.lastIndex = 0;
  while ((m = RE_SUB.exec(text))) {
    if (ultim) bucati.push([ultim, text.slice(poz, m.index).trim()]);
    ultim = m[1];
    poz = RE_SUB.lastIndex;
  }
  if (ultim) bucati.push([ultim, text.slice(poz).trim()]);
  for (const [nume, val] of bucati) {
    const cheie = nume.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
    if (val) out[cheie] = (out[cheie] ? out[cheie] + " " : "") + val;
  }
  return out;
}

// ——— Ajutoare de curățare ————————————————————————————————————————————

const curata = (s) => String(s || "").replace(/\s+/g, " ").trim();

/**
 * Rubricile de PROZĂ (aspect general, proporții, rezumat) nu conțin niciodată liste cu
 * buline: o bulină acolo înseamnă că textul a înghițit lista de defecte a rubricii
 * următoare. Tăiem la prima bulină. La Hovawart, „aspect general" se termina cu patru
 * defecte eliminatorii prezentate ca descriere.
 */
const faraLista = (s) => curata(s).split(/\s*[•·]\s*/)[0].trim();

/**
 * Frazele-șablon care apar la finalul aproape fiecărui standard și NU sunt defecte ale
 * rasei: regula generală de apreciere și nota despre reproducție. Lăsate în listă, ele
 * poluau defectele — iar quizul ajungea să întrebe „cum se clasifică «orice abatere de
 * la punctele de mai sus»?" și să numească regula generală drept „defect minor". Un
 * candidat ar fi învățat un neadevăr.
 */
const SABLOANE_DEFECT = [
  /^any departure from the (?:foregoing|above)/i,
  /should be considered a fault/i,
  /in exact proportion to its degree/i,
  /^male animals should have two/i,
  /fully descended into the scrotum/i,
  /only functionally and clinically healthy/i,
  /breed typical conformation should be used for breeding/i,
  /the (?:latest|above) (?:amendments|mentioned)/i,
  /^n\.?b\.?[:.]?$/i,
  /^the faults? (?:and eliminating faults? )?are the same/i,
];
const eSablon = (x) => SABLOANE_DEFECT.some((re) => re.test(x));

/** Sparge o listă de defecte în puncte, fără frazele-șablon și fără fragmente fără sens. */
function puncte(text) {
  if (!text) return [];
  let t = curata(text);
  // Dacă lista folosește buline („•"), despărțim DOAR pe ele. Cratima dintr-un punct e
  // adesea un calificativ, nu un separator: „Undershot - very exaggerated…" e UN defect,
  // nu două. Împărțit pe cratimă, „Undershot" rămânea singur și spunea că orice prognatism
  // e eliminatoriu — când standardul descalifică doar pe cel foarte exagerat.
  const areBuline = /[•·]/.test(t);
  const bucati = areBuline
    ? t.split(/\s*[•·]\s*/).map(curata).filter(Boolean)
    : t.split(/\s*(?:^|\s)[-–—]\s+/).map(curata).filter(Boolean);
  const lista = bucati.length > 1 ? bucati : t.split(/(?<=\.)\s+(?=[A-Z])/).map(curata).filter(Boolean);
  return lista
    .map((x) => curata(x).replace(/\.$/, ""))
    .filter((x) => x.length >= 5)
    .filter((x) => !eSablon(x))
    // Scurgeri de sub-rubrică („Coat:") sau cioburi de listă („1 cm)"): ce se termină
    // cu „:" ori nu începe cu literă nu e un defect de sine stătător. Defectele reale
    // dintr-un cuvânt („Overshot", „Undershot") rămân — au literă la început și fără „:".
    .filter((x) => /^[A-Za-z]/.test(x) && !/:$/.test(x));
}

/** Prima frază a unui text — pentru rezumate scurte. */
const primaFraza = (t) => {
  const s = curata(t);
  const m = /^(.{20,240}?\.)(?:\s|$)/.exec(s);
  return m ? m[1] : (s.length > 240 ? s.slice(0, 237) + "…" : s);
};

/**
 * Tipul robei, ghicit din descrierea părului — folosit doar la filtrele aplicației.
 *
 * ATENȚIE la paranteze: scris „\bwire|rough\b", `\b` se lipește doar de primul cuvânt,
 * iar „rough" se potrivea în interiorul lui „through" — Rottweilerul ieșea „sârmos".
 */
function tipRoba(coat) {
  const t = (coat || "").toLowerCase();
  // Ghicitul se uită la ÎNCEPUTUL descrierii: acolo se spune ce fel de roabă are rasa.
  // Mai încolo apar și robele nedorite („Hairless dogs are not tolerated" la Chihuahua),
  // iar căutarea în tot textul lua tocmai negația drept răspuns.
  const cap = t.slice(0, 220);
  const nuENegat = (cuvant) =>
    new RegExp("\\b" + cuvant + "\\b(?![^.]{0,60}\\bnot\\b)(?<!\\bnot\\b[^.]{0,60})").test(cap);

  if (nuENegat("hairless") || nuENegat("naked")) return "hairless";
  // Doar termenii compuși, fără echivoc: „harsh" singur descrie textura oricărei robe
  // duble („particularly harsh and close fitting" — Ciobănescul German), nu una sârmoasă.
  if (/\b(wire[- ]?haired|wirehair\w*|wiry|broken[- ]?coat\w*|rough[- ]?coat\w*)\b/.test(t)) return "wire";
  if (/\b(curly|curled|corded|cords)\b/.test(cap)) return "curly";
  if (/\b(long[- ]?haired|longhair\w*)\b/.test(cap) || /\blong\b/.test(cap)) return "long";
  if (/\b(short[- ]?haired|shorthair\w*|smooth[- ]?haired|short|smooth)\b/.test(cap)) return "short";
  return "medium";
}

/**
 * Rostul rasei, ghicit din utilizare/grupă — tot pentru filtre.
 *
 * „Companion" se dă ULTIMUL. Standardele scriu adesea „Companion, service and working
 * dog" (Rottweiler); luat în ordinea greșită, cuvântul „companion" transforma câinii de
 * pază și de lucru în câini de companie, iar filtrul devenea nefolositor.
 */
function tipFunctional(utilizare, grupaNr) {
  const t = (utilizare || "").toLowerCase();
  if (/\b(guard\w*|protection|watchdog|defence|defense)\b/.test(t)) return "guard";
  if (/\b(herd\w*|sheepdog|cattle\w*|drover\w*|shepherd)\b/.test(t)) return "herding";
  if (/\b(point\w*|retriev\w*|flush\w*|gundog|hunt\w*|scent\w*|track\w*|quarry|vermin|earth)\b/.test(t)) return "hunting";
  if (/\b(coursing|sighthound|racing)\b/.test(t)) return "sighthound";
  if (/\b(sled|draught|draft|service|working|utility|rescue|police)\b/.test(t)) return "working";
  if (/\b(compan\w*|toy|lapdog|pet)\b/.test(t)) return "companion";
  const dinGrupa = { 1: "herding", 2: "guard", 3: "hunting", 4: "guard", 5: "working",
    6: "hunting", 7: "hunting", 8: "hunting", 9: "companion", 10: "sighthound" };
  return dinGrupa[grupaNr] || "companion";
}

/**
 * Formele canonice ale țărilor. O aceeași țară scrisă în trei feluri („Great Britain",
 * „Great-Britain", „United Kingdom", „England") îl păcălea pe quiz să ofere două
 * răspunsuri corecte la aceeași întrebare și să marcheze greșit alegerea bună. Aducem
 * fiecare la o singură formă, ca filtrul și examenul să vadă o singură țară.
 */
const TARI_CANONICE = [
  [/^(great[ -]?britain|united kingdom|england|scotland|wales|u\.?k\.?)\b/i, "Great Britain"],
  [/^(u\.?s\.?a\.?|united states\b.*|usa)\b/i, "U.S.A."],
  [/^(the )?netherlands\b/i, "Netherlands"],
  [/^(germany|deutschland)\b/i, "Germany"],
  [/^(france)\b/i, "France"],
  [/czechoslovak|czech republic/i, "Czech Republic"],
  [/^(russia|russian federation|u\.?s\.?s\.?r\.?)\b/i, "Russia"],
  [/^(belgium)\b/i, "Belgium"],
  [/^(switzerland|swiss)\b/i, "Switzerland"],
];

/** Țara de origine, curățată de tot ce s-a lipit după ea și adusă la o formă canonică. */
function taraDin(text) {
  let t = curata(text);
  if (!t) return "";
  // Taie tot ce vine după prima etichetă rămasă lipită („… STANDARD SUPPLIED BY …",
  // „… DATE OF PUBLICATION …") sau după prima frază lungă — țara e mereu la început.
  t = t.replace(/\s+(?:STANDARD|DATE OF|PATRONAGE|CLASSIFICATION|Standard Supplied|Kennel Union).*$/i, "");
  const m = /^([^.;:]{2,40})(?:[.;:]|$)/.exec(t);
  let tara = (m ? m[1] : t.slice(0, 40)).trim().replace(/[,\s]+$/, "");
  // O „țară" prea lungă sau plină de cuvinte descriptive nu e o țară („Northern borders
  // of Mali and Niger; the slopes…") — păstrăm doar primul segment scurt.
  if (tara.split(" ").length > 5) tara = tara.split(/[,;]/)[0].trim();
  for (const [re, canonic] of TARI_CANONICE) if (re.test(tara)) return canonic;
  return tara;
}

/**
 * Numele grupelor — citite din `src/data/grupe-wdf.ts`, SURSA UNICĂ a sistemului.
 *
 * DE CE NU SUNT SCRISE AICI. Aceleași grupe stau la temelia autorizării arbitrilor din
 * Școala de Arbitraj. Scrise a doua oară în scriptul ăsta, cele două liste ar fi început
 * să se depărteze una de alta la prima corectură — iar filtrul aplicației ar fi arătat
 * „Grupa 2" de două ori, cu nume aproape la fel. (Chiar așa s-a și întâmplat la prima
 * rulare: fișele vechi scriau „– Molossoids", cele noi „, Molossoids".)
 */
function numeleGrupelor() {
  const sursa = fs.readFileSync(path.join(RADACINA, "src", "data", "grupe-wdf.ts"), "utf8");
  const out = {};
  for (const m of sursa.matchAll(/\{\s*nr:\s*(\d+)[^}]*?en:\s*"([^"]+)"/g)) {
    out[Number(m[1])] = "Group " + m[1] + " " + m[2];
  }
  if (Object.keys(out).length !== 10)
    throw new Error("Nu am putut citi cele 10 grupe din src/data/grupe-wdf.ts");
  return out;
}
const NUME_GRUPE = numeleGrupelor();

/** Numărul grupei dintr-un nume scris oricum („Group 2 …", „Grupa 02 …"). */
const nrGrupei = (nume) => parseInt((/Group\w*\s*(\d+)/i.exec(String(nume || "")) || [])[1], 10) || null;

// ——— O rasă ————————————————————————————————————————————————————————

export function raseDinDocument(text, grupaNr, numeFisier) {
  const s = sectiuni(text);
  // Numele: primul rând netvid de dinaintea primei etichete; la nevoie, numele fișierului.
  let nume = "";
  for (const rand of spargeEtichetele(text).split("\n")) {
    const r = curata(rand);
    if (!r) continue;
    if (etichetaLa(r)) break;
    nume = r; break;
  }
  if (!nume || nume.length > 90) nume = path.basename(numeFisier, ".docx");
  nume = nume.replace(/\s*\(.*fci.*\)\s*/i, "").trim();

  const cranial = subrubrici(s.CRANIAL);
  const facial = subrubrici(s.FACIAL);
  const corp = subrubrici(s.BODY);
  const fata = subrubrici(s.FOREQUARTERS);
  const spate = subrubrici(s.HINDQUARTERS);
  const roba = subrubrici(s.COAT);

  const laba = [fata.forefeet || fata.front_feet || fata.feet, spate.hind_feet || spate.hindfeet || spate.feet]
    .filter(Boolean).join(" ") || curata(s.FEET);
  const par = roba.hair || (Object.keys(roba).length ? "" : curata(s.COAT));
  const culoare = roba.colour || roba.color || curata(s.COLOUR);

  const anatomie = {
    head: curata(s.HEAD),
    skull: cranial.skull || "",
    stop: cranial.stop || "",
    muzzle: [facial.muzzle, facial.nose && "Nose: " + facial.nose, facial.lips && "Lips: " + facial.lips]
      .filter(Boolean).join(" "),
    jaws_teeth: facial.jaws_teeth || facial.jaws || facial.teeth || "",
    eyes: curata(s.EYES) || facial.eyes || "",
    ears: curata(s.EARS) || "",
    neck: curata(s.NECK) || "",
    topline: corp.topline || corp.back || "",
    body: curata(s.BODY),
    chest: corp.chest || corp.ribcage || "",
    tail: curata(s.TAIL),
    forequarters: curata(s.FOREQUARTERS),
    hindquarters: curata(s.HINDQUARTERS),
    feet: curata(laba),
    movement: curata(s.MOVEMENT),
    coat: curata(par) || curata(s.COAT),
    color: curata(culoare),
    // Plasă pentru mărime: dacă nu există secțiune SIZE, dar înălțimea a fost prinsă ca
    // sub-rubrică „Height:" în altă parte (roba), o folosim — altfel Porcelaine rămânea
    // fără înălțime, singura rasă din tot fișierul.
    size: curata(s.SIZE) || curata(roba.height || roba.height_at_the_withers || ""),
    skin: curata(s.SKIN),
  };

  // Defectele: rubrica generală, cele grave și cele eliminatorii, fiecare la locul ei.
  const faults = {
    minor: puncte(s.FAULTS),
    serious: puncte(s.SERIOUS),
    disqualifying: puncte(s.DISQUALIFYING),
  };

  return {
    breed_name: nume,
    alternate_names: [],
    group: NUME_GRUPE[grupaNr] || "",
    country_of_origin: taraDin(s.ORIGIN),
    wdf_status: "recognized",
    coat_type: tipRoba(anatomie.coat),
    functional_type: tipFunctional(s.UTILIZATION, grupaNr),
    source_standard_title: "WDF breed standard — " + nume,
    source_standard_url: "",
    // „last_updated" e data la care fișa NOASTRĂ a fost adusă la zi — nu data
    // standardului. Cele două nu se confundă: standardul poate fi din 2010, iar fișa
    // din registrul nostru de azi. Data standardului stă la rubrica ei, mai jos.
    last_updated: new Date().toISOString().slice(0, 10),
    identity: {
      official_name: nume,
      owner_country: taraDin(s.ORIGIN),
      historical_function: curata(s.UTILIZATION),
      general_impression: faraLista(s.GENERAL),
      important_proportions: faraLista(s.PROPORTIONS),
      sexual_dimorphism: "",
      ideal_type_summary: primaFraza(faraLista(s.GENERAL) || s.HISTORY || ""),
      historical_summary: curata(s.HISTORY),
      // Din clasificare scoatem prefixul „Group N <denumire>." — el poartă o denumire de
      // grupă în stil FCI care ar contrazice grupa WDF deja afișată pe fișă. Rămâne doar
      // secțiunea și mențiunea probei de lucru, care sunt utile și nu se bat cap în cap.
      classification: curata(s.CLASSIFICATION).replace(/^Group\s*\d+\b[^.]*\.\s*/i, ""),
      standard_published: curata(s.DATE).replace(/^.*?:\s*/, "").replace(/\.$/, ""),
      country_of_development: curata(s.DEZVOLTARE).replace(/\.$/, ""),
    },
    anatomy: anatomie,
    temperament: {
      behavior: curata(s.TEMPERAMENT),
      ring_attitude: "",
      expression: "",
      temperament_notes: curata(s.NB),
    },
    faults,
    pedagogy: { frequent_confusions: [], key_markers: [], judge_notes: [], teaching_notes: [], similar_breeds: [] },
    judge_checklist: { first_impression: [], static_exam: [], movement_exam: [], final_attention_points: [] },
    references: [{
      type: "official_standard",
      title: "WDF breed standard (document received from the association)",
      url: "",
      accessed_on: new Date().toISOString().slice(0, 10),
    }],
    internal_notes: "",
    difficulty_level: "",
    exam_relevance: "",
    teaching_priority: "",
    revision_status: "imported",
    source_verification_status: "imported",
    thematic_tags: [taraDin(s.ORIGIN)].filter(Boolean),
    study_track_tags: [NUME_GRUPE[grupaNr] || ""].filter(Boolean),
    recurring_judge_observations: [],
    version: 1,
    revision_history: [],
  };
}

/** Câte rubrici esențiale s-au umplut — măsura calității unei conversii. */
export function acoperire(r) {
  const cerute = [
    r.identity.general_impression, r.anatomy.head, r.anatomy.eyes, r.anatomy.ears,
    r.anatomy.neck, r.anatomy.body, r.anatomy.tail, r.anatomy.forequarters,
    r.anatomy.hindquarters, r.anatomy.movement, r.anatomy.coat, r.anatomy.color,
    r.anatomy.size, r.temperament.behavior, r.country_of_origin,
  ];
  return cerute.filter((x) => x && x.length > 2).length / cerute.length;
}

// ——— Rularea ————————————————————————————————————————————————————————

function citesteToate(radacinaGrupe) {
  const rase = [];
  const probleme = [];
  const dosare = fs.readdirSync(radacinaGrupe).filter((d) =>
    fs.statSync(path.join(radacinaGrupe, d)).isDirectory()).sort();
  for (const dosar of dosare) {
    const nrGrupa = parseInt((/Grupa\s*(\d+)/i.exec(dosar) || [])[1], 10);
    if (!nrGrupa) { probleme.push("Dosar fără număr de grupă: " + dosar); continue; }
    for (const f of fs.readdirSync(path.join(radacinaGrupe, dosar)).sort()) {
      if (!f.toLowerCase().endsWith(".docx") || f.startsWith("~$")) continue;
      const cale = path.join(radacinaGrupe, dosar, f);
      try {
        const r = raseDinDocument(textDinDocx(cale), nrGrupa, f);
        r._acoperire = acoperire(r);
        r._fisier = dosar + "/" + f;
        rase.push(r);
      } catch (err) {
        probleme.push(dosar + "/" + f + ": " + err.message);
      }
    }
  }
  return { rase, probleme };
}

if (process.argv[1] && process.argv[1].endsWith("importa-standarde-wdf.mjs")) {
  const argumente = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const doarRaport = process.argv.includes("--raport");
  const sursa = argumente[0] || path.join(RADACINA, "..", "WDF - Rase pe grupe");
  if (!fs.existsSync(sursa)) {
    console.error("Nu găsesc folderul cu standarde: " + sursa);
    process.exit(1);
  }
  const { rase, probleme } = citesteToate(sursa);
  const slabe = rase.filter((r) => r._acoperire < 0.6);
  console.log(`Citite: ${rase.length} rase din ${sursa}`);
  console.log(`Acoperire medie: ${(rase.reduce((s, r) => s + r._acoperire, 0) / rase.length * 100).toFixed(1)}%`);
  console.log(`Sub 60% completate: ${slabe.length}`);
  for (const r of slabe.slice(0, 25)) console.log(`   ${(r._acoperire * 100).toFixed(0)}%  ${r._fisier}  (${r.breed_name})`);
  if (probleme.length) { console.log("PROBLEME:"); for (const p of probleme) console.log("   " + p); }
  if (doarRaport) process.exit(0);

  // —— Fuziunea cu fișele existente ——
  const vechi = JSON.parse(fs.readFileSync(TINTA_JSON, "utf8"));
  const cheie = (n) => String(n || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const dupaNume = new Map();
  for (const b of vechi.breeds) {
    dupaNume.set(cheie(b.breed_name), b);
    for (const alt of b.alternate_names || []) dupaNume.set(cheie(alt), b);
  }

  let adaugate = 0, completate = 0;
  const finale = [...vechi.breeds];
  for (const nou of rase) {
    delete nou._acoperire; delete nou._fisier;
    const existent = dupaNume.get(cheie(nou.breed_name));
    if (existent) {
      // Fișa scrisă de om rămâne stăpână: se completează DOAR rubricile ei goale.
      for (const sectiune of ["identity", "anatomy", "temperament"]) {
        for (const [k, v] of Object.entries(nou[sectiune] || {})) {
          if (v && !curata(existent[sectiune]?.[k])) {
            existent[sectiune] = existent[sectiune] || {};
            existent[sectiune][k] = v;
          }
        }
      }
      for (const k of ["minor", "serious", "disqualifying"]) {
        if (!(existent.faults?.[k] || []).length && nou.faults[k].length) {
          existent.faults = existent.faults || {};
          existent.faults[k] = nou.faults[k];
        }
      }
      completate++;
      continue;
    }
    finale.push(nou);
    adaugate++;
  }

  // Numele grupelor se aduc TOATE la forma canonică — și cele vechi. Altfel filtrul
  // aplicației arată aceeași grupă de două ori, cu două scrieri, și fiecare listă e
  // incompletă.
  let grupeIndreptate = 0;
  for (const b of finale) {
    const nr = nrGrupei(b.group);
    if (nr && NUME_GRUPE[nr] && b.group !== NUME_GRUPE[nr]) { b.group = NUME_GRUPE[nr]; grupeIndreptate++; }
    b.study_track_tags = (b.study_track_tags || []).map((t) => {
      const n = nrGrupei(t);
      return n && NUME_GRUPE[n] ? NUME_GRUPE[n] : t;
    });
  }

  // Numerotarea: fișele noi primesc id-uri în continuarea celor existente.
  let ultim = 0;
  for (const b of finale) {
    const m = /^breed-(\d+)$/.exec(b.id || "");
    if (m) ultim = Math.max(ultim, parseInt(m[1], 10));
  }
  for (const b of finale) if (!b.id) b.id = "breed-" + String(++ultim).padStart(3, "0");

  finale.sort((a, b) => {
    const g = (x) => parseInt((/Group (\d+)/.exec(x.group || "") || [])[1] || 99, 10);
    return g(a) - g(b) || String(a.breed_name).localeCompare(String(b.breed_name), "en");
  });

  const iesire = {
    schema_version: "1.1",
    meta: {
      app: "Explorator de standarde CFC-Royal",
      framework: "World Dog Federation (WDF)",
      dataset_type: "official breed standards (imported) + CFCR teaching notes",
      disclaimer:
        "Breed descriptions are imported from the breed standard documents held by " +
        "Asociația Club Federal Chinologic – Royal. Records marked as \"imported\" reproduce the " +
        "section text of those documents and have not yet been reviewed by a lecturer; teaching " +
        "notes and judge checklists are written separately by CFCR lecturers. Always verify " +
        "against the official source standard before using in examination or judging contexts.",
      generated_on: new Date().toISOString().slice(0, 10),
      breed_count: finale.length,
    },
    breeds: finale,
    lessons: vechi.lessons || [],
  };

  fs.mkdirSync(path.dirname(TINTA_JSON), { recursive: true });
  fs.writeFileSync(TINTA_JSON, JSON.stringify(iesire, null, 2));
  console.log(`\nScris: ${finale.length} rase (${adaugate} noi, ${completate} completate în fișele existente,` +
    ` ${grupeIndreptate} nume de grupă aduse la forma canonică)`);
  console.log(`  ${TINTA_JSON} — ${(fs.statSync(TINTA_JSON).size / 1048576).toFixed(2)} MB`);
}
