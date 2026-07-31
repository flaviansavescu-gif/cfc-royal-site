// arhiva-certificate.test.mjs — completarea numerelor lipsă din certificatele emise.
//
// Situația reală: la cuibul 26 (Poodle Toy, 6 pui), formularul are numărul WDF doar la
// primii doi pui; la ceilalți patru scrie ‹WDF.› și atât, fiindcă numerele s-au atribuit
// după ce s-a salvat formularul. Numerele lor sunt tipărite pe certificatele din dosar.
//
// Un număr pus greșit aici înseamnă un act atribuit altui câine. Probele de mai jos
// verifică tocmai cazurile în care s-ar putea întâmpla asta.
//
// Rulează: node scripts/arhiva-certificate.test.mjs
import { serieDinNume, completeazaDinCertificate } from "./arhiva-certificate.mjs";

let rau = 0;
const t = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};
const egal = (nume, dat, asteptat) => t(nume, dat === asteptat, JSON.stringify(dat) + " ≠ " + JSON.stringify(asteptat));

console.log("— seria din numele fișierului —");
egal("cratimă pe disc, punct în registru", serieDinNume("WDF-RO150195L25 - Milo.pdf"), "WDF.RO150195L25");
egal("forma cu punct", serieDinNume("WDF.RO150200L25 - Chloe.pdf"), "WDF.RO150200L25");
egal("fișier fără serie", serieDinNume("FCI Standard Caniche.pdf"), "");

// Certificatele, așa cum le citește modulul din dosarul „Pedigree Pui".
const CERT = [
  { serie: "WDF.RO150195L25", nume: "MILO", fisier: "WDF-RO150195L25 - Milo.pdf" },
  { serie: "WDF.RO150197L25", nume: "LUKIE", fisier: "WDF-RO150197L25 - Lukie.pdf" },
];

console.log("\n— completarea normală —");
{
  const pui = [
    { nume: "CĂȚELUȘUL POTRIVIT - MILO", wdf: "WDF.RO150195L25" },
    { nume: "CĂȚELUȘUL POTRIVIT - LUKIE", wdf: "" },
  ];
  const { completate, erori } = completeazaDinCertificate(pui, CERT);
  egal("puiul fără număr îl primește", pui[1].wdf, "WDF.RO150197L25");
  egal("puiul care avea număr rămâne neatins", pui[0].wdf, "WDF.RO150195L25");
  egal("se raportează o singură completare", completate.length, 1);
  t("fără erori", erori.length === 0, erori.join(" · "));
}

console.log("\n— formularul și certificatul se contrazic —");
{
  const pui = [
    { nume: "CĂȚELUȘUL POTRIVIT - MILO", wdf: "WDF.RO150199L25" },  // alt număr!
    { nume: "CĂȚELUȘUL POTRIVIT - LUKIE", wdf: "" },
  ];
  const { erori } = completeazaDinCertificate(pui, CERT);
  t("neconcordanța oprește cuibul", erori.some((e) => /formularul spune WDF\.RO150199L25/.test(e)), erori.join(" · "));
}

console.log("\n— două certificate pentru același nume —");
{
  const pui = [{ nume: "CĂȚELUȘUL POTRIVIT - MILO", wdf: "" }];
  const dublu = [
    { serie: "WDF.RO150195L25", nume: "MILO", fisier: "a.pdf" },
    { serie: "WDF.RO150196L25", nume: "MILO", fisier: "b.pdf" },
  ];
  const { erori } = completeazaDinCertificate(pui, dublu);
  t("ambiguitatea nu se rezolvă prin ghicit", erori.some((e) => /nu aleg eu/.test(e)), erori.join(" · "));
  egal("puiul rămâne fără număr", pui[0].wdf, "");
}

console.log("\n— pui fără certificat —");
{
  const pui = [{ nume: "CĂȚELUȘUL POTRIVIT - STITCH", wdf: "" }];
  const { erori } = completeazaDinCertificate(pui, [CERT[0]]);
  t("puiul fără certificat e semnalat", erori.some((e) => /n-am g[ăa]sit certificatul/.test(e)), erori.join(" · "));
}

console.log("\n— certificat fără pui —");
{
  // Un certificat pe care nu-l revendică nimeni înseamnă că un pui lipsește din formular.
  const pui = [{ nume: "CĂȚELUȘUL POTRIVIT - MILO", wdf: "WDF.RO150195L25" }];
  const { erori } = completeazaDinCertificate(pui, CERT);
  t("certificatul orfan e semnalat", erori.some((e) => /WDF\.RO150197L25.*nu se potrive/.test(e)), erori.join(" · "));
}

console.log("\n— diacriticele nu strică potrivirea —");
{
  const pui = [{ nume: "CĂȚELUȘUL POTRIVIT - LUKIE", wdf: "" }];
  const { erori } = completeazaDinCertificate(pui, [{ serie: "WDF.RO150197L25", nume: "LUKIE", fisier: "x.pdf" }]);
  egal("s-a completat", pui[0].wdf, "WDF.RO150197L25");
  t("fără erori", erori.length === 0, erori.join(" · "));
}

console.log(rau ? `\n  ${rau} probe căzute\n` : "\n  Toate probele au trecut.\n");
process.exit(rau ? 1 : 0);
