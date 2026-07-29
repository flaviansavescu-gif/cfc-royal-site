// =========================================================================
// verifica-posta.mjs — starea autentificării e-mailului asociației (SPF, DKIM, DMARC).
//
// DE CE. Sistemul trimite lucruri care trebuie să ajungă: coduri de acces, confirmări de
// înscriere, diplome, buletinul Școlii. Dacă domeniul nu-și dovedește mesajele, ele intră
// în „promoții" sau în spam, iar omul te sună supărat că n-a primit nimic. Semnele că
// merge stau în DNS și se schimbă în tăcere — de aceea se verifică, nu se presupun.
//
// Nu e legat de build: e o unealtă de rulat când schimbi ceva la DNS sau la furnizorul
// de e-mail, și o dată pe an, la revizuire.
//
// Rulează: node scripts/verifica-posta.mjs [domeniu]
// =========================================================================
import { Resolver } from "node:dns/promises";

const domeniu = process.argv[2] || "cfc-royal.ro";
const resolver = new Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

const bifa = (bun) => (bun === true ? "  ok  " : bun === false ? "  RAU " : "  ?   ");
let probleme = 0;
const spune = (bun, text, amanunt) => {
  if (bun === false) probleme++;
  console.log(bifa(bun) + text + (amanunt ? "\n        " + amanunt : ""));
};

const txt = async (nume) => {
  try { return (await resolver.resolveTxt(nume)).map((b) => b.join("")); }
  catch { return []; }
};
const cname = async (nume) => {
  try { return await resolver.resolveCname(nume); } catch { return []; }
};

console.log(`Verific autentificarea e-mailului pentru „${domeniu}".\n`);

// ——— SPF: cine are voie să trimită în numele domeniului ———
console.log("SPF — cine poate trimite în numele domeniului");
const inregistrariTxt = await txt(domeniu);
const spf = inregistrariTxt.filter((t) => t.toLowerCase().startsWith("v=spf1"));
if (spf.length === 0) {
  spune(false, "nu există înregistrare SPF");
} else if (spf.length > 1) {
  spune(false, `${spf.length} înregistrări SPF — e una prea mult, se anulează între ele`);
} else {
  spune(true, "o singură înregistrare SPF, cum trebuie", spf[0]);
  const are = (bucata) => spf[0].includes(bucata);
  spune(are("zohomail"), "cuprinde Zoho (e-mailul oamenilor)");
  spune(are("brevo") || are("sendinblue"), "cuprinde Brevo (mesajele trimise de sistem)",
    are("brevo") || are("sendinblue") ? null
      : "de adăugat: include:spf.brevo.com — altfel mesajele automate se sprijină doar pe DKIM");
  const sfarsit = spf[0].match(/([~\-+?])all\s*$/);
  spune(!!sfarsit, "se termină cu o regulă pentru restul lumii",
    sfarsit ? (sfarsit[1] === "-" ? "„-all\" — strict, cel mai bine" : "„" + sfarsit[1] + "all\" — moale, acceptabil") : null);
}

// ——— DKIM: semnătura care dovedește mesajul ———
console.log("\nDKIM — semnătura care dovedește că mesajul e al nostru");
const selectori = [
  ["brevo1", "Brevo"], ["brevo2", "Brevo"],
  ["zmail", "Zoho"], ["zoho", "Zoho"], ["default", "oarecare"], ["mail", "oarecare"],
];
const gasiti = [];
for (const [s, cine] of selectori) {
  const c = await cname(`${s}._domainkey.${domeniu}`);
  const t = await txt(`${s}._domainkey.${domeniu}`);
  if (c.length || t.length) gasiti.push({ s, cine, tinta: c[0] || "(TXT)" });
}
if (!gasiti.length) {
  spune(false, "n-am găsit niciun selector DKIM cunoscut");
} else {
  for (const g of gasiti) spune(true, `DKIM „${g.s}" (${g.cine})`, g.tinta);
}
spune(gasiti.some((g) => g.cine === "Brevo"), "Brevo semnează mesajele sistemului");

// ——— DMARC: ce să facă lumea cu mesajele care nu se dovedesc ———
console.log("\nDMARC — ce se întâmplă cu un mesaj care nu se dovedește");
const dmarc = (await txt("_dmarc." + domeniu)).filter((t) => t.toLowerCase().startsWith("v=dmarc1"));
if (!dmarc.length) {
  spune(false, "nu există DMARC — oricine poate trimite în numele domeniului fără urmări");
} else {
  spune(true, "DMARC există", dmarc[0]);
  const politica = (dmarc[0].match(/p\s*=\s*(none|quarantine|reject)/i) || [])[1]?.toLowerCase();
  if (politica === "none") {
    spune(false, "politica e „none\" — se raportează, dar nu se oprește nimic",
      "după o lună de rapoarte curate, urcă la p=quarantine");
  } else {
    spune(true, `politica e „${politica}" — mesajele nedovedite chiar sunt oprite`);
  }
  spune(/rua\s*=/.test(dmarc[0]), "rapoartele se trimit undeva (rua)",
    /rua\s*=/.test(dmarc[0]) ? null : "fără rua nu afli niciodată cine îți folosește domeniul");
}

console.log("");
if (probleme) {
  console.log(`${probleme} lucruri de îndreptat. Nimic nu e stricat — dar nici totul nu e strâns.`);
  process.exit(0); // e o unealtă de diagnostic, nu o poartă de build
}
console.log("Totul e la locul lui.");
