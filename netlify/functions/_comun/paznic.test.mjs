// paznic.test.mjs — regulile paznicului de intruziune.
//
// Toata valoarea acestui paznic sta in CALIBRARE. Un paznic care suna des ajunge ignorat
// in cateva saptamani, si atunci nu mai apara nimic; unul care tace la un atac adevarat
// n-a folosit niciodata la nimic. De aceea judecata e o functie PURA — se poate proba
// aici, cu cazuri scrise de mana, fara magazie, fara retea si fara sa astepti un atac.
//
// Cazurile de mai jos sunt exact cele din discutia cu utilizatorul (18.08.2026): ce
// TREBUIE sa sune si, la fel de important, ce NU are voie sa sune.
//
// Fara ghilimele romanesti in titluri (regula casei).
//
// Ruleaza: node netlify/functions/_comun/paznic.test.mjs
import {
  judeca, meritaSunat, usaDinUrl, numeFunctie, feliaUsii, cheieOra, feliiRecente,
  despicaCheie, cheieFapt, eLuni, oraLocala,
  USI_PENTRU_SEMNAL, REFUZURI_URMA_PENTRU_SEMNAL, REFUZURI_PENTRU_ALARMA,
  URME_PENTRU_ALARMA, RABDARE_ALARMA_ORE, ORE_VEGHE, RETENTIE_ZILE,
} from "./paznic.mjs";

let rau = 0;
const t = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

/** Ajutor: construieste faptele asa cum le-ar strange paznicul. */
const fapte = ({ refuzuri = 0, urme = 0, peUsa = {}, peUrma = {} } = {}) => ({
  refuzuri, urme, peUsa, peUrma,
});
/** Un vizitator: cate incercari si la cate usi. */
const viz = (n, ...usi) => ({ n, usi: new Set(usi) });

console.log("\n1. Ce NU are voie sa sune (calibrarea contra oboselii de alarma)\n");

t("magazie goala = liniste", judeca(fapte()).stare === "liniste");

t(
  "un om care greseste de 3 ori la o singura usa",
  judeca(fapte({ refuzuri: 3, urme: 1, peUsa: { "scoala-de-arbitraj": 3 }, peUrma: { a: viz(3, "scoala-de-arbitraj") } })).stare === "liniste",
);

t(
  "acelasi om, doua usi (a incurcat spatiile) — inca nu e semnal",
  judeca(fapte({ refuzuri: 5, urme: 1, peUrma: { a: viz(5, "registratura", "scoala-de-arbitraj") } })).stare === "liniste",
);

{
  // Ziua expozitiei: zeci de telefoane, fiecare cu o greseala sau doua, pe aceeasi usa.
  const peUrma = {};
  for (let i = 0; i < 60; i++) peUrma["tel" + i] = viz(2, "scoala-de-arbitraj");
  const v = judeca(fapte({ refuzuri: 120, urme: 60, peUsa: { "scoala-de-arbitraj": 120 }, peUrma }));
  t("ziua expozitiei: 60 de telefoane cu cate 2 greseli", v.stare === "liniste", v.stare + " / " + v.motiv);
}

{
  // Un birou intreg pe aceeasi adresa IP: multe incercari, DAR o singura urma.
  // Nu e alarma: alarma cere SI adrese multe (rotire), altfel e doar cineva incapatanat,
  // pe care zidul il opreste oricum.
  const v = judeca(fapte({ refuzuri: 400, urme: 1, peUsa: { registratura: 400 }, peUrma: { birou: viz(400, "registratura") } }));
  t("400 de incercari de la o SINGURA adresa nu e alarma", v.stare !== "alarma", v.stare);
  t("…dar e semnal (o urma prea insistenta)", v.stare === "semnal", v.stare);
}

console.log("\n2. Ce TREBUIE sa sune\n");

{
  const v = judeca(fapte({
    refuzuri: 13, urme: 1,
    peUrma: { cautator: viz(13, "scoala-de-arbitraj", "registratura", "instalarea-exploratorului") },
  }));
  t("aceeasi urma la 3 usi fara legatura = SEMNAL", v.stare === "semnal", v.stare);
  t("semnalul spune la cate usi", /3 uși/.test(v.motiv), v.motiv);
}

t(
  "o singura urma, dar peste pragul de insistenta = SEMNAL",
  judeca(fapte({ refuzuri: 30, urme: 1, peUrma: { x: viz(REFUZURI_URMA_PENTRU_SEMNAL, "registratura") } })).stare === "semnal",
);

{
  // Valul din machetă: 1847 de incercari, 213 adrese, mai ales la registratura.
  const peUrma = {};
  for (let i = 0; i < 213; i++) peUrma["r" + i] = viz(9, "registratura");
  const v = judeca(fapte({
    refuzuri: 1847, urme: 213,
    peUsa: { registratura: 1700, "scoala-de-arbitraj": 147 },
    peUrma,
  }));
  t("val sustinut de la adrese rotite = ALARMA", v.stare === "alarma", v.stare);
  t("alarma numeste usa cea mai lovita", v.usa === "registratura", v.usa);
  t("alarma spune cifrele in motiv", /1847/.test(v.motiv) && /213/.test(v.motiv), v.motiv);
}

t(
  "chiar la prag, alarma se declanseaza",
  judeca(fapte({
    refuzuri: REFUZURI_PENTRU_ALARMA, urme: URME_PENTRU_ALARMA,
    peUsa: { registratura: REFUZURI_PENTRU_ALARMA },
    peUrma: Object.fromEntries(Array.from({ length: URME_PENTRU_ALARMA }, (_, i) => ["u" + i, viz(15, "registratura")])),
  })).stare === "alarma",
);

t(
  "cu o urma sub prag, NU se declanseaza",
  judeca(fapte({
    refuzuri: REFUZURI_PENTRU_ALARMA, urme: URME_PENTRU_ALARMA - 1,
    peUsa: { registratura: REFUZURI_PENTRU_ALARMA },
    peUrma: Object.fromEntries(Array.from({ length: URME_PENTRU_ALARMA - 1 }, (_, i) => ["u" + i, viz(15, "registratura")])),
  })).stare !== "alarma",
);

t("alarma bate semnalul (se cerne prima)", (() => {
  const peUrma = { multi: viz(500, "a", "b", "c") };
  for (let i = 0; i < 25; i++) peUrma["r" + i] = viz(20, "registratura");
  return judeca(fapte({ refuzuri: 900, urme: 26, peUsa: { registratura: 900 }, peUrma })).stare === "alarma";
})());

console.log("\n3. Tacerea de dupa alarma (lectia din 17.08: alarma falsa oboseste urechea)\n");

const acum = new Date("2026-08-23T05:15:00.000Z");
const inainteCu = (ore) => new Date(acum.getTime() - ore * 3600e3).toISOString();
const alarma = { stare: "alarma", usa: "registratura", motiv: "…" };

t("liniste nu suna niciodata", !meritaSunat({ stare: "liniste" }, null, acum));
t("prima alarma suna", meritaSunat(alarma, null, acum));
t("aceeasi alarma, o ora mai tarziu, TACE",
  !meritaSunat(alarma, { stare: "alarma", usa: "registratura", la: inainteCu(1) }, acum));
t(`aceeasi alarma, dupa ${RABDARE_ALARMA_ORE}h, suna din nou`,
  meritaSunat(alarma, { stare: "alarma", usa: "registratura", la: inainteCu(RABDARE_ALARMA_ORE + 1) }, acum));
t("alta usa = alta poveste, suna",
  meritaSunat(alarma, { stare: "alarma", usa: "scoala-de-arbitraj", la: inainteCu(1) }, acum));
t("semnalul care devine alarma suna, chiar imediat",
  meritaSunat(alarma, { stare: "semnal", usa: "registratura", la: inainteCu(0.2) }, acum));
t("stare veche cu data stricata: suna (mai bine o data in plus)",
  meritaSunat(alarma, { stare: "alarma", usa: "registratura", la: "candva" }, acum));

console.log("\n4. Usile si cheile\n");

t("numele functiei se citeste din adresa",
  numeFunctie("https://cfc-royal.ro/.netlify/functions/registru-dmf") === "registru-dmf");
t("usa are nume omenesc", usaDinUrl("https://x/.netlify/functions/registru-dmf") === "Declarațiile de montă");
t("o functie care nu e usa cu cod nu se consemneaza",
  usaDinUrl("https://x/.netlify/functions/registru-public") === null);
t("o adresa care nu e functie nu se consemneaza", usaDinUrl("https://cfc-royal.ro/ro/") === null);

t("felia usii pierde diacriticele", feliaUsii("Declarațiile de montă") === "declaratiile-de-monta");
t("felia usii nu poate sparge cheia", !feliaUsii("a/b/c").includes("/"));
t("usa goala are totusi un nume", feliaUsii("") === "necunoscuta");

t("ora se scrie sortabil", cheieOra(new Date("2026-08-18T14:05:00Z")) === "2026-08-18-14");
t("feliile recente sunt in ordine, cea de acum intai", (() => {
  const f = feliiRecente(3, new Date("2026-08-18T14:05:00Z"));
  return f.length === 3 && f[0] === "2026-08-18-14" && f[2] === "2026-08-18-12";
})());

{
  const c = cheieFapt("2026-08-18-14", "Registratura", "abc123");
  const d = despicaCheie(c);
  t("cheia se despica inapoi exact", d && d.ora === "2026-08-18-14" && d.usa === "registratura" && d.amprenta === "abc123");
  t("o cheie straina nu se despica", despicaCheie("altceva/x/y/z") === null);
  t("o cheie scurta nu se despica", despicaCheie("paznic/2026-08-18-14") === null);
}

console.log("\n5. Ceasul (raportul pleaca luni la 8 dimineata, ora Romaniei)\n");

// 18 august 2026 e marti; 24 august e luni. Vara Romania e UTC+3.
t("luni la 08:00 ora Romaniei = 05:00 UTC", (() => {
  const d = new Date("2026-08-24T05:00:00.000Z");
  return eLuni(d) && oraLocala(d) === 8;
})());
t("marti nu e luni", !eLuni(new Date("2026-08-18T05:00:00.000Z")));
t("iarna, aceeasi ora locala cade la alt UTC", (() => {
  const d = new Date("2026-01-05T06:00:00.000Z"); // 5 ianuarie 2026 e luni, UTC+2
  return eLuni(d) && oraLocala(d) === 8;
})());

console.log("\n6. Pragurile raman cele hotarate\n");

t("veghea se uita 3 ore inapoi", ORE_VEGHE === 3);
t("semnalul cere 3 usi", USI_PENTRU_SEMNAL === 3);
t("memoria tine 30 de zile (cat spune politica)", RETENTIE_ZILE === 30);

console.log(rau ? `\n${rau} probe cazute\n` : "\nToate probele au trecut\n");
process.exit(rau ? 1 : 0);
