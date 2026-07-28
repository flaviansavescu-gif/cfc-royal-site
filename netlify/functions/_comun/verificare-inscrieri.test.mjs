import { pentruRegistratura, rezumat, STARI } from "../verificare-inscrieri.mjs";

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
  ["taxa", "120"],
  ["dovada plății (cheia)", "dovada/SHOW/abc"],
  ["numele fișierului cu dovada", "transfer.jpg"],
  ["adresa proprietarului", "Str. Exemplu 5"],
  ["observația despre taxă", "al 2-lea"],
];
for (const [nume, bucata] of interzise) {
  e("nu conține " + nume, !text.includes(bucata), text.length > 400 ? "(prea lung)" : text);
}
e("nu conține declarația de student", v.declaratii === undefined && !("student" in v));
e("nu conține bifa de plată", !("amPlatit" in v) && !("taxa" in v));

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
e("expoziție goală", JSON.stringify(rezumat([])) === JSON.stringify({ total: 0, verificate: 0, lamurit: 0, neatinse: 0 }));

console.log(rau ? rau + " căzute" : "toate trecute");
process.exit(rau ? 1 : 0);
