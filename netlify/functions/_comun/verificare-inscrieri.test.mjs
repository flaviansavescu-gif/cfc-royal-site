import { pentruRegistratura, rezumat, peRegistrator, STARI } from "../verificare-inscrieri.mjs";

let rau = 0;
const e = (nume, bun, detaliu) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (bun || detaliu == null ? "" : " -> " + JSON.stringify(detaliu)));
};

// O înscriere așa cum stă ea în coadă, cu tot cu ce NU trebuie să vadă registratura.
const INSCRIERE = {
  numeCaine: "Ares von Hohenstein", rasaNumeRo: "Ciobănesc German", sex: "M",
  dataNasterii: "2024-03-11", pedigree: "CFCR-P-2024-0123", pedigreeTipicitate: false,
  microcip: "642090000123456", crescator: "Canisa Test", culoareRoba: "negru-focat",
  tata: "Bruno", mama: "Elsa", clasa: "deschisa",
  numeProprietar: "Ion Popescu", email: "ion@example.ro", telefon: "0740123456",
  adresa: "Str. Exemplu 5, Reșița", tara: "România",
  creat: "2026-07-01T10:00:00.000Z", importat: false,
  // —— zona pe care registratura NU are voie s-o vadă ——
  taxa: 120, amPlatit: true,
  dovadaKey: "dovada/SHOW/abc", dovadaTip: "image/jpeg", dovadaNume: "transfer.jpg",
  declaratii: { membru: true, student: true, primulDeclarat: false, caineNr: 2 },
  taxaObservatie: "A declarat primul câine, dar este al 2-lea",
};

console.log("— ce vede registratorul —");
const v = pentruRegistratura(INSCRIERE, "coada/SHOW/abc");
e("numele câinelui", v.caine.nume === "Ares von Hohenstein");
e("numărul de pedigree", v.caine.pedigree === "CFCR-P-2024-0123");
e("microcipul", v.caine.microcip === "642090000123456");
e("clasa", v.caine.clasa === "deschisa");
e("numele proprietarului", v.proprietar.nume === "Ion Popescu");
e("telefonul, ca să poată suna", v.proprietar.telefon === "0740123456");
e("e-mailul", v.proprietar.email === "ion@example.ro");
e("declarația de membru, singura pe care o poate confirma", v.declaraMembru === true);
e("cheia, ca să poată marca", v.cheie === "coada/SHOW/abc");

console.log("— ce NU pleacă niciodată spre browserul lui —");
const text = JSON.stringify(v);
const interzise = [
  ["cheia interna a dovezii din magazie", "dovada/SHOW/abc"],
];
for (const [nume, bucata] of interzise) {
  e("nu conține " + nume, !text.includes(bucata), text.length > 400 ? "(prea lung)" : text);
}
e("cheile magaziei nu pleacă niciodată spre browser", !("dovadaKey" in v) && !("dovadaTip" in v));

console.log("— dosarul plății, pentru confirmarea din extrasul de cont —");
e("suma", v.plata.taxa === 120);
e("a declarat că a plătit", v.plata.aDeclaratPlata === true);
e("are dovadă atașată", v.plata.areDovada === true);
e("numele fișierului, ca să știe ce deschide", v.plata.dovadaNume === "transfer.jpg");
e("declarația de membru explică suma", v.plata.membru === true);
e("declarația de student explică suma", v.plata.student === true);
e("al câtelea câine e", v.plata.caineNr === 2);
e("observația despre taxă", String(v.plata.observatie).includes("al 2-lea"));
e("adresa, pentru documente", v.proprietar.adresa === "Str. Exemplu 5, Reșița");

console.log("— marcajul —");
e("stările sunt doar cele două", STARI.length === 2 && STARI.includes("verificat") && STARI.includes("lamurit"));
e("marcajul existent se vede", pentruRegistratura({ ...INSCRIERE, verificare: { stare: "verificat" } }, "k").verificare.stare === "verificat");
e("fără marcaj -> null", v.verificare === null);

console.log("— rezumatul unei expoziții —");
const r = rezumat([
  { verificare: { stare: "verificat" } },
  { verificare: { stare: "verificat" } },
  { verificare: { stare: "lamurit" } },
  {},
  { verificare: null },
]);
e("total", r.total === 5, r);
e("verificate", r.verificate === 2, r);
e("de lămurit", r.lamurit === 1, r);
e("neatinse", r.neatinse === 2, r);
e("expoziție goală", JSON.stringify(rezumat([])) ===
  JSON.stringify({ total: 0, verificate: 0, lamurit: 0, neatinse: 0, platiConfirmate: 0 }));
e("plățile confirmate se numără separat de acte",
  rezumat([{ verificare: { stare: "lamurit", plataConfirmata: true } }, { verificare: { stare: "verificat" } }]).platiConfirmate === 1);

console.log("— auditul: cine ce ține în spate acum —");
{
  const r = peRegistrator([
    { verificare: { stare: "verificat", cine: "Ion", plataConfirmata: true } },
    { verificare: { stare: "verificat", cine: "Ion" } },
    { verificare: { stare: "lamurit", cine: "Maria" } },
    { verificare: null },
    { verificare: { stare: "verificat" } },   // fara nume: nu se poate atribui
  ]);
  e("doi registratori", r.length === 2, r);
  e("Ion: 2 verificate, o plată", r[0].cine === "Ion" && r[0].verificate === 2 && r[0].plati === 1, r);
  e("Maria: una de lămurit", r[1].cine === "Maria" && r[1].lamurit === 1, r);
  e("listă goală", peRegistrator([]).length === 0);
}

console.log(rau ? rau + " căzute" : "toate trecute");
process.exit(rau ? 1 : 0);
