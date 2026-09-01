// =========================================================================
// repetitie.mjs — unealta repetiției generale dinaintea unei expoziții.
//
// DE CE. Lanțul înscriere → verificare la registratură → import → catalog → ring →
// rezultate → diplome n-a trecut niciodată printr-o expoziție adevărată. Fiecare bucată
// e probată separat; lanțul întreg, cu oameni și cu grabă, niciodată. Un audit pe hârtie
// a ratat deja trei defecte de ring pe care le-a găsit folosirea.
//
// CE FACE. Seamănă înscrieri realiste prin FORMULARUL PUBLIC — aceeași cale prin care
// vine un om de pe internet, cu aceleași validări, aceeași taxă recalculată pe server și
// aceeași limită de trimiteri. Nu scrie în magazie pe scurtătură: o probă care ocolește
// drumul adevărat nu dovedește drumul adevărat.
//
// Înscrierile nu sunt la întâmplare. Fiecare e acolo pentru un motiv scris în dreptul ei:
// al doilea câine al aceluiași proprietar (taxa trebuie să scadă singură), membru și
// nemembru, student, tipicitate, veteran — și patru care TREBUIE respinse.
//
// FOLOSIRE
//   node scripts/repetitie.mjs stare     <showId>
//   node scripts/repetitie.mjs porneste  <showId>      — marchează expoziția ca repetiție
//   node scripts/repetitie.mjs seamana   <showId> [n]  — trimite înscrierile
//   node scripts/repetitie.mjs curata    <showId>      — șterge TOT ce ține de repetiție
//
// SECRETUL nu se scrie nicăieri și nu se afișează niciodată: se ia din `.env`-ul
// managerului de pe același calculator, sau din variabila EXPO_SYNC_SECRET.
// =========================================================================
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RADACINA = fileURLToPath(new URL("..", import.meta.url));
const SITE = process.env.SITE_REPETITIE || "https://cfc-royal.ro";
const API = SITE + "/.netlify/functions/inscriere-expo";

// ——— secretul managerului, luat de unde stă deja ———
function secretul() {
  if (process.env.EXPO_SYNC_SECRET) return process.env.EXPO_SYNC_SECRET;
  const locuri = [
    join(RADACINA, "..", "..", "..", "cfcr-expo-manager", ".env"),
    join(RADACINA, "..", "cfcr-expo-manager", ".env"),
    join(RADACINA, ".env"),
  ];
  for (const cale of locuri) {
    if (!existsSync(cale)) continue;
    const linie = readFileSync(cale, "utf8").split(/\r?\n/).find((l) => l.startsWith("EXPO_SYNC_SECRET="));
    if (linie) return linie.slice("EXPO_SYNC_SECRET=".length).trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const cere = async (corp) => {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corp),
  });
  const text = await r.text();
  let d; try { d = JSON.parse(text); } catch { d = { brut: text.slice(0, 200) }; }
  return { stare: r.status, d };
};

/**
 * Dovada de plată, făcută pe loc. Scrie pe ea ce e, cu litere mari: registratorul o
 * deschide în timpul repetiției și trebuie să vadă dintr-o privire că nu se uită la
 * un ordin de plată adevărat.
 */
async function dovadaDeProba(nume, suma) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520">
    <rect width="900" height="520" fill="#fff8e6"/>
    <rect x="14" y="14" width="872" height="492" fill="none" stroke="#9a6b00" stroke-width="6" stroke-dasharray="18 12"/>
    <text x="450" y="150" font-family="sans-serif" font-size="54" font-weight="bold" fill="#8c1d2f" text-anchor="middle">DOVADA DE PROBA</text>
    <text x="450" y="215" font-family="sans-serif" font-size="34" fill="#4a3600" text-anchor="middle">REPETITIE TEHNICA — nu este o plata reala</text>
    <text x="450" y="310" font-family="sans-serif" font-size="30" fill="#1a1a1a" text-anchor="middle">Platitor: ${nume}</text>
    <text x="450" y="360" font-family="sans-serif" font-size="30" fill="#1a1a1a" text-anchor="middle">Suma declarata: ${suma} lei</text>
    <text x="450" y="440" font-family="sans-serif" font-size="24" fill="#667066" text-anchor="middle">Asociatia Club Federal Chinologic - Royal</text>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png({ quality: 80 }).toBuffer();
  return { base64: png.toString("base64"), tip: "image/png", nume: "dovada-proba.png" };
}

// ——— datele de probă ———
// Adrese pe `example.com` — domeniu rezervat prin RFC 2606 tocmai pentru asta. Nicio
// confirmare nu poate ajunge din greșeală la o adresă adevărată.
const P = [
  { nume: "Ana-Maria Ionescu", email: "ana.ionescu@example.com", telefon: "0721000101", adresa: "Str. Zorilor 12, Reșița, Caraș-Severin", membru: true },
  { nume: "Radu Constantinescu", email: "radu.constantinescu@example.com", telefon: "0722000102", adresa: "Bd. Republicii 45, Timișoara, Timiș", membru: false },
  { nume: "Elena Marcu", email: "elena.marcu@example.com", telefon: "0723000103", adresa: "Str. Morii 8, Caransebeș, Caraș-Severin", membru: true },
  { nume: "Victor Pop", email: "victor.pop@example.com", telefon: "0724000104", adresa: "Str. Libertății 3, Arad, Arad", membru: false },
  { nume: "Ioana Dobre", email: "ioana.dobre@example.com", telefon: "0725000105", adresa: "Str. Câmpului 21, Deva, Hunedoara", membru: false },
];

/** Data nașterii care dă vârsta cerută de o clasă, socotită înapoi de la ziua expoziției. */
function nasterePentru(luni, dataShow) {
  const d = new Date(dataShow);
  d.setMonth(d.getMonth() - luni);
  d.setDate(d.getDate() - 5); // câteva zile în plus, ca să nu cadă pe muchia intervalului
  return d.toISOString().slice(0, 10);
}

function scenariul(dataShow, rase) {
  const r = (i) => rase[i % rase.length];
  return [
    { deCe: "membru, primul câine — taxa cea mai mică", asteptat: "primită",
      prop: P[0], primul: true, caine: { nume: "Aris de Semenic", rasa: r(0), sex: "M", luni: 30, clasa: "deschisa" } },

    { deCe: "AL DOILEA câine al ACELUIAȘI proprietar — taxa trebuie să scadă singură", asteptat: "primită, cu taxa redusă",
      prop: P[0], primul: false, caine: { nume: "Bella de Semenic", rasa: r(0), sex: "F", luni: 20, clasa: "intermediara" } },

    { deCe: "nemembru — taxa cea mai mare", asteptat: "primită",
      prop: P[1], primul: true, caine: { nume: "Cezar", rasa: r(1), sex: "M", luni: 40, clasa: "deschisa" } },

    { deCe: "junior cu pedigree de tipicitate — de aici pornește semnul „!\" din ring", asteptat: "primită",
      prop: P[2], primul: true, caine: { nume: "Dara", rasa: r(2), sex: "F", luni: 14, clasa: "young", tipicitate: true } },

    { deCe: "student — reducerea de student", asteptat: "primită, cu reducere",
      prop: P[3], primul: true, student: true, caine: { nume: "Elix", rasa: r(3), sex: "M", luni: 26, clasa: "deschisa" } },

    { deCe: "veteran", asteptat: "primită",
      prop: P[4], primul: true, caine: { nume: "Fram", rasa: r(4), sex: "M", luni: 126, clasa: "veterani" } },

    { deCe: "baby", asteptat: "primită",
      prop: P[2], primul: false, caine: { nume: "Gigi", rasa: r(5), sex: "M", luni: 4, clasa: "baby" } },

    { deCe: "campion", asteptat: "primită",
      prop: P[1], primul: false, caine: { nume: "Hera", rasa: r(6), sex: "F", luni: 48, clasa: "champion" } },

    // —— cele care TREBUIE respinse. Dacă vreuna trece, e un defect, nu o scăpare. ——
    { deCe: "CLASĂ GREȘITĂ: câine de 4 luni înscris la „deschisă\"", asteptat: "RESPINSĂ", cade: true,
      prop: P[4], primul: false, caine: { nume: "Ivo", rasa: r(7), sex: "M", luni: 4, clasa: "deschisa" } },

    { deCe: "FĂRĂ MICROCIP — regula WDF de identificare", asteptat: "RESPINSĂ", cade: true, faraMicrocip: true,
      prop: P[3], primul: false, caine: { nume: "Jana", rasa: r(8), sex: "F", luni: 22, clasa: "intermediara" } },

    { deCe: "FĂRĂ DOVADA PLĂȚII", asteptat: "RESPINSĂ", cade: true, faraDovada: true,
      prop: P[1], primul: false, caine: { nume: "Kai", rasa: r(9), sex: "M", luni: 28, clasa: "deschisa" } },

    { deCe: "DUBLURĂ: același câine, a doua oară", asteptat: "RESPINSĂ ca dublură", cade: true,
      prop: P[0], primul: false, caine: { nume: "Aris de Semenic", rasa: r(0), sex: "M", luni: 30, clasa: "deschisa" } },
  ].map((x) => ({ ...x, caine: { ...x.caine, dataNasterii: nasterePentru(x.caine.luni, dataShow) } }));
}

// ——— comenzile ———
const [, , comanda, showId, arg] = process.argv;

if (!comanda || !showId) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8")
    .split("\n").filter((l) => l.startsWith("//")).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(1);
}

async function expoDeRepetitie() {
  const r = await fetch(API + "?repetitie=1");
  const { expozitii } = await r.json();
  return (expozitii || []).find((e) => e.showId === showId);
}

if (comanda === "stare") {
  const e = await expoDeRepetitie();
  if (!e) {
    console.log(`Expoziția „${showId}" nu e publicată online sau înscrierile sunt închise.`);
    console.log("Publică-o din manager: Expoziții → " + showId + " → Publică online.");
    process.exit(1);
  }
  const publica = await (await fetch(API)).json();
  const seVede = (publica.expozitii || []).some((x) => x.showId === showId);
  console.log(`Expoziția: ${e.nume}`);
  console.log(`Data: ${e.data} · termen: ${e.termen} · rase publicate: ${(e.rase || []).length}`);
  console.log(`Marcată ca repetiție: ${e.repetitie ? "DA" : "NU"}`);
  console.log(`Se vede în formularul public: ${seVede ? "DA — nu e bine pentru o repetiție" : "nu"}`);
  console.log(`Grilă de tarif publicată: ${e.tarif ? "DA" : "NU — atunci taxa iese 0 și dovada plății nu se cere"}`);
  process.exit(0);
}

const secret = secretul();
if ((comanda === "porneste" || comanda === "curata") && !secret) {
  console.error("Nu găsesc EXPO_SYNC_SECRET — nici în mediu, nici în .env-ul managerului.");
  console.error("Pune-l în variabila de mediu EXPO_SYNC_SECRET și rulează din nou.");
  process.exit(1);
}

if (comanda === "porneste") {
  const { stare, d } = await cere({ secret, actiune: "repetitie", showId, pornit: true });
  if (stare !== 200) { console.error("Nu s-a putut marca:", d.eroare || d); process.exit(1); }
  console.log(`Expoziția „${showId}" e marcată ca REPETIȚIE.`);
  console.log("Din clipa asta nu mai apare nici în formularul public, nici în calendar.");
  console.log(`Formularul de repetiție: ${SITE}/ro/inscriere-expozitie/?repetitie=1`);
  process.exit(0);
}

if (comanda === "curata") {
  const { stare, d } = await cere({ secret, actiune: "repetitie-sterge", showId });
  if (stare === 403) {
    console.error("REFUZAT: " + d.eroare);
    console.error("Asta e paza care apără expozițiile adevărate. Nu o ocoli.");
    process.exit(1);
  }
  if (stare !== 200) { console.error("Curățenia a eșuat:", d.eroare || d); process.exit(1); }
  const s = d.sterse;
  console.log("Repetiția a fost ștearsă din magazie:");
  console.log(`  ${s.coada} înscrieri · ${s.dovezi} dovezi · ${s.verificari} verificări · ` +
    `${s.audit} fapte de audit · ${s.proprietari} contoare · configurația`);
  console.log("\nÎn managerul local expoziția rămâne — șterge-o de acolo separat.");
  process.exit(0);
}

if (comanda === "seamana") {
  const e = await expoDeRepetitie();
  if (!e) { console.error(`Expoziția „${showId}" nu e publicată sau înscrierile sunt închise.`); process.exit(1); }
  if (!e.repetitie) {
    console.error("OPRIT: expoziția NU e marcată ca repetiție.");
    console.error("Nu semăn date născocite într-o expoziție adevărată. Rulează întâi:");
    console.error(`  node scripts/repetitie.mjs porneste ${showId}`);
    process.exit(1);
  }
  if (!(e.rase || []).length) { console.error("Expoziția n-are nicio rasă publicată."); process.exit(1); }

  const toate = scenariul(e.data, e.rase);
  const lista = arg ? toate.slice(0, Number(arg)) : toate;
  console.log(`Trimit ${lista.length} înscrieri către „${e.nume}" (${e.data}).\n`);

  let bune = 0, cazuteBine = 0, neasteptate = 0;
  for (const [i, x] of lista.entries()) {
    const dovada = x.faraDovada ? null : await dovadaDeProba(x.prop.nume, "—");
    const corp = {
      showId,
      numeCaine: x.caine.nume,
      rasaId: x.caine.rasa.id,
      sex: x.caine.sex,
      dataNasterii: x.caine.dataNasterii,
      clasa: x.caine.clasa,
      pedigree: x.caine.tipicitate ? "" : "CFCR-DMF-2026-" + String(1000 + i),
      pedigreeTipicitate: x.caine.tipicitate ? "1" : "",
      microcip: x.faraMicrocip ? "" : "9420000000" + String(100 + i),
      crescator: "Canisă de probă",
      culoareRoba: "negru cu focuri",
      numeProprietar: x.prop.nume,
      email: x.prop.email,
      telefon: x.prop.telefon,
      adresa: x.prop.adresa,
      esteMembru: x.prop.membru ? "1" : "",
      esteStudent: x.student ? "1" : "",
      primulCaine: x.primul ? "1" : "0",
      amPlatit: "1",
      ...(dovada ? { dovadaBase64: dovada.base64, dovadaTip: dovada.tip, dovadaNume: dovada.nume } : {}),
      gdpr: "1",
      // Asumările cerute de server la nivelul formularului. Când s-a adăugat norma de
      // participare, scriptul n-a urmat-o: TOATE fișele seed primeau 400, iar cazurile
      // care trebuie respinse ieșeau „ok" din motivul greșit — verde fals, exact la
      // unealta care există ca să prindă probleme. Proba din `repetitie.test.mjs` ține
      // de-acum lista asta lipită de validările serverului.
      normeParticipare: "1",
    };
    const { stare, d } = await cere(corp);
    const aTrecut = stare === 200 && !d.eroare;
    const cumTrebuie = x.cade ? !aTrecut : aTrecut;
    if (cumTrebuie) { if (x.cade) cazuteBine++; else bune++; } else neasteptate++;

    console.log(`${cumTrebuie ? "  ok  " : "  ??  "}${x.caine.nume} — ${x.deCe}`);
    console.log(`        așteptat: ${x.asteptat} · primit: ${aTrecut ? "primită" : "respinsă — " + (d.eroare || stare)}`);

    // Limita publică e de 12 trimiteri pe oră de la o adresă IP. E acolo dinadins; nu o
    // ocolim, doar nu o îmbrâncim.
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n${bune} primite, ${cazuteBine} respinse cum trebuie, ${neasteptate} altfel decât se aștepta.`);
  if (neasteptate) {
    console.log("Uită-te la cele cu „??\": ori regula s-a schimbat, ori scenariul e vechi.");
    console.log("Oricare ar fi, se lămurește ACUM, nu în ziua expoziției.");
  }
  console.log(`\nUrmătorul pas: registratura verifică la ${SITE}/registru/registratura/inscrieri/`);
  process.exit(neasteptate ? 1 : 0);
}

console.error("Comandă necunoscută: " + comanda);
process.exit(1);
