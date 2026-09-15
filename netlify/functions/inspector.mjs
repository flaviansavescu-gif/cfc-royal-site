// inspector.mjs — Inspectorul săptămânal al mecanismelor esențiale (15.09.2026).
//
// DE CE. Paznicii existenți (disponibilitate, monitor-flux, intruziune) spun dacă ușile
// răspund — și rămân singurii care verifică paginile, inimile, cheia poștei și copia
// registrului: Inspectorul NU repetă nimic din ce fac ei (decizia lui Flavian, 15.09.2026). Nimeni nu se uita dacă circuitele merg și dacă datele sunt consistente: o
// înscriere uitată în coadă, un DMF fără confirmarea masculului, un test de sănătate
// neverificat, o sesiune de examen nedefinită, un arbitru certificat nepublicat, o copie
// veche, un DNS al poștei schimbat. Inspectorul le citește o dată pe zi și scrie pe e-mail:
// lunea raportul complet, în restul zilelor doar când o verificare CRITICĂ se schimbă sau
// când o expoziție e în ajun (atunci amintește: pornește Managerul, rulează ajunul).
//
// CE NU FACE. Nu schimbă nimic: nu depune, nu marchează, nu importă. Doar citește și
// povestește. Judecata e în _comun/inspector-logica.mjs (pură, probată).
//
// Variabile de mediu: ALERTE_EMAIL (implicit adresa președintelui, din posta.mjs),
// BREVO_API_KEY, BACKUP_GITHUB_TOKEN + BACKUP_GITHUB_REPO/RAMURA (ca la monitor-flux).
import { getStore } from "@netlify/blobs";
import dns from "node:dns/promises";
import { trimite, ADRESA_ASOCIATIEI } from "./_comun/posta.mjs";
import { bateInima } from "./_comun/inima.mjs";
import {
  judecaDns, judecaCredite, judecaCopii, judecaInscrieri, judecaExpozitii, expozitiiInAjun,
  judecaDmf, judecaTeste, judecaSesiuni, judecaCertificari,
  esteLuni, estePrimaLuniALunii, trebuieTrimis, compuneRaport,
} from "./_comun/inspector-logica.mjs";

const DOMENIU = "cfc-royal.ro";
const REPO = process.env.BACKUP_GITHUB_REPO || "flaviansavescu-gif/cfc-royal-site";
const RAMURA = process.env.BACKUP_GITHUB_RAMURA || "backup-registru";

async function cere(url, optiuni = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...optiuni, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}
const linisteste = async (p, alt) => { try { return await p; } catch { return alt; } };

/** Citirile — fiecare cu plasă: o magazie care sughiță dă „necunoscut", nu o alarmă falsă. */
async function citeste() {
  const acum = Date.now();
  const expozitii = getStore("expozitii");
  const registru = getStore("registru");
  const cursuri = getStore("cursuri");
  const acces = getStore("acces");

  // DNS
  const spf = (await linisteste(dns.resolveTxt(DOMENIU), [])).map((t) => t.join(""));
  const dmarc = (await linisteste(dns.resolveTxt("_dmarc." + DOMENIU), [])).map((t) => t.join(""));
  const cname = {
    brevo1: (await linisteste(dns.resolveCname("brevo1._domainkey." + DOMENIU), [])).join(","),
    brevo2: (await linisteste(dns.resolveCname("brevo2._domainkey." + DOMENIU), [])).join(","),
  };

  // Poșta (scrisă de monitor-flux)
  const posta = await linisteste(acces.get("posta-sanatate", { type: "json" }), null);

  // Copiile din ramura de backup (registru + magazii), prin GitHub API
  let copii = null;
  if (process.env.BACKUP_GITHUB_TOKEN) {
    const r = await linisteste(cere(`https://api.github.com/repos/${REPO}/contents/copii?ref=${RAMURA}`, {
      headers: { Authorization: "Bearer " + process.env.BACKUP_GITHUB_TOKEN, Accept: "application/vnd.github+json", "User-Agent": "cfc-royal-inspector" },
    }), null);
    if (r && r.ok) { const j = await linisteste(r.json(), []); copii = Array.isArray(j) ? j.map((x) => x.name) : []; }
  }

  // Cozile de înscrieri + configurațiile expozițiilor + marcajele registraturii
  const configuri = [];
  const coada = [];
  const marcaje = new Set();
  const lc = await linisteste(expozitii.list({ prefix: "config/" }), { blobs: [] });
  for (const b of lc.blobs || []) {
    const c = await linisteste(expozitii.get(b.key, { type: "json" }), null);
    if (c) configuri.push(c);
  }
  const lq = await linisteste(expozitii.list({ prefix: "coada/" }), { blobs: [] });
  for (const b of lq.blobs || []) {
    const i = await linisteste(expozitii.get(b.key, { type: "json" }), null);
    if (i) coada.push({ showId: i.showId, cheie: b.key, creat: i.creat || i.trimisLa || "", importat: !!i.importat });
  }
  const lm = await linisteste(expozitii.list({ prefix: "verificare/" }), { blobs: [] });
  for (const b of lm.blobs || []) marcaje.add(b.key.replace(/^verificare\//, "coada/"));

  // DMF (doar câmpurile de stare)
  const declaratii = [];
  const ld = await linisteste(registru.list({ prefix: "dmf/" }), { blobs: [] });
  for (const b of ld.blobs || []) {
    const d = await linisteste(registru.get(b.key, { type: "json" }), null);
    if (d) declaratii.push({ id: b.key.slice(4), creat: d.creat, confirmare: d.confirmare || null });
  }

  // Teste de sănătate
  const dosare = {};
  const ls = await linisteste(registru.list({ prefix: "sanatate/" }), { blobs: [] });
  for (const b of ls.blobs || []) {
    const d = await linisteste(registru.get(b.key, { type: "json" }), null);
    if (d) dosare[b.key.slice("sanatate/".length)] = { teste: (d.teste || []).map((t) => ({ stare: t.stare, depusLa: t.depusLa })) };
  }

  // Sesiuni de examen + autorizări
  const sesiuni = [];
  const lsx = await linisteste(cursuri.list({ prefix: "sesiune-examen/" }), { blobs: [] });
  for (const b of lsx.blobs || []) { const s = await linisteste(cursuri.get(b.key, { type: "json" }), null); if (s) sesiuni.push(s); }
  const autorizari = {};
  const la = await linisteste(cursuri.list({ prefix: "autorizare/" }), { blobs: [] });
  for (const b of la.blobs || []) { const a = await linisteste(cursuri.get(b.key, { type: "json" }), null); if (a) autorizari[b.key] = { grupe: a.grupe, public: !!a.public }; }

  return { acum, spf, dmarc, cname, posta, copii, configuri, coada, marcaje, declaratii, dosare, sesiuni, autorizari };
}

export default async () => {
  await bateInima("inspector");
  const d = await citeste();
  const verificari = [
    judecaDns({ spf: d.spf, dmarc: d.dmarc, cname: d.cname }),
    judecaCredite(d.posta),
    d.copii ? judecaCopii(d.copii, d.acum) : { nume: "Copiile magaziilor (fără registru)", nivel: "critic", ok: true, detaliu: "neverificate aici (fără BACKUP_GITHUB_TOKEN)" },
    judecaExpozitii(d.configuri, d.acum),
    judecaInscrieri(d.coada, d.marcaje, d.acum),
    judecaDmf(d.declaratii, d.acum),
    judecaTeste(d.dosare, d.acum),
    judecaSesiuni(d.sesiuni, d.acum),
    judecaCertificari(d.autorizari),
  ];
  const luni = esteLuni(d.acum);
  const primaLuni = estePrimaLuniALunii(d.acum);
  const ajun = expozitiiInAjun(d.configuri, d.acum);

  const acces = getStore("acces");
  const ultima = await linisteste(acces.get("inspector/ultima", { type: "json" }), null);
  const ajunNoi = ajun.filter((c) => !(ultima && Array.isArray(ultima.ajunAmintit) && ultima.ajunAmintit.includes(c.showId)));
  const decizie = trebuieTrimis({ luni, verificari, ultimaTrimitere: ultima, ajunNoi });

  const la = new Date(d.acum).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" });
  const raport = compuneRaport({ verificari, ajun, luni, primaLuni, la });
  console.log("INSPECTOR\n" + raport.text + "\n→ " + decizie.motiv);

  // Raportul ultimei rulări rămâne în magazie, pentru panoul „Starea sistemului".
  await linisteste(acces.setJSON("inspector/raport", { la: new Date(d.acum).toISOString(), verificari, ajun: ajun.map((c) => ({ showId: c.showId, nume: c.nume, data: c.data })), trimis: decizie.trimite, motiv: decizie.motiv }), null);

  if (decizie.trimite) {
    const plecat = await trimite({
      catre: ADRESA_ASOCIATIEI,
      subiect: raport.subiect,
      html: raport.html,
      expeditor: { name: "Inspectorul CFC-Royal", email: "newsletter@cfc-royal.ro" },
    });
    // Starea „ultimei trimiteri" se scrie DOAR dacă poșta a plecat — altfel mâine reîncercăm.
    if (plecat) {
      await linisteste(acces.setJSON("inspector/ultima", {
        la: new Date(d.acum).toISOString(),
        criticePicate: verificari.filter((x) => x.nivel === "critic" && !x.ok).map((x) => x.nume),
        ajunAmintit: [...new Set([...(ultima && ultima.ajunAmintit || []), ...ajun.map((c) => c.showId)])].slice(-20),
      }), null);
    }
  }
  return new Response(JSON.stringify({ ok: verificari.every((x) => x.ok), trimis: decizie.trimite, motiv: decizie.motiv }), { headers: { "Content-Type": "application/json" } });
};

export const config = { schedule: "0 5 * * *" }; // 05:00 UTC = 07:00/08:00 la București
