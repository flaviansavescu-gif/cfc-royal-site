// monitor-flux.mjs — verificarea automată a fluxului critic al registrului.
//
// DE CE EXISTĂ. Dacă o funcție cade, azi nu află nimeni. Registrul poate sta stricat
// un weekend întreg, iar primul care observă e un crescător care nu-și poate depune
// declarația în ziua 89 din 90. Un sistem despre care spui public că e verificabil
// trebuie să se verifice și pe el însuși.
//
// CE VERIFICĂ (fluxul pe care se sprijină totul):
//   1. verificarea unui certificat  — funcția registrului + magazia, calea publică
//   2. fișa publică a câinelui      — cealaltă cale publică, cu alt cod
//   3. poarta declarațiilor (DMF)   — funcția răspunde și refuză corect
//   4. pagina de verificare         — site-ul static se servește
//   5. prospețimea copiei           — copia săptămânală chiar s-a făcut
//
// CE NU FACE. Nu depune declarații de probă: ar murdări registrul real cu dosare
// inventate și ar consuma numere de înregistrare, care nu se recuperează. Verifică
// poarta, nu trece prin ea. Și nu trimite cod în cereri — altfel ar fi numărată ca
// încercare greșită de `cuLimitareCod` și, după destule rulări, s-ar autobloca.
//
// Variabile de mediu:
//   ALERTE_EMAIL         — unde pleacă alerta (implicit contact@cfc-royal.ro)
//   BREVO_API_KEY        — pentru trimitere (fără ea, alerta rămâne doar în jurnal)
//   BACKUP_GITHUB_TOKEN  — opțional, pentru verificarea prospețimii copiei
//   SITE_PUBLIC          — implicit https://cfc-royal.ro
import { getStore } from "@netlify/blobs";
import { decide, deCandText } from "./_comun/monitor.mjs";

const SITE = process.env.SITE_PUBLIC || "https://cfc-royal.ro";
const CATRE = process.env.ALERTE_EMAIL || "contact@cfc-royal.ro";
const REPO = process.env.BACKUP_GITHUB_REPO || "flaviansavescu-gif/cfc-royal-site";
const RAMURA = process.env.BACKUP_GITHUB_RAMURA || "backup-registru";

/** Copia e săptămânală; peste opt zile fără una, ceva s-a stricat în tăcere. */
const ZILE_COPIE = 8;
/** O verificare care nu răspunde în atât înseamnă oricum că omul a plecat din pagină. */
const RABDARE_MS = 8000;

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/** O cerere cu răbdare mărginită; orice eșec devine un rezultat, nu o excepție. */
async function cere(url, optiuni = {}) {
  const stop = AbortSignal.timeout(RABDARE_MS);
  try {
    const r = await fetch(url, { ...optiuni, signal: stop });
    const text = await r.text().catch(() => "");
    return { status: r.status, text };
  } catch (err) {
    return { status: 0, text: "", eroare: err.name === "TimeoutError" ? "nu a răspuns în 8 secunde" : err.message };
  }
}

const post = (functie, corp) =>
  cere(`${SITE}/.netlify/functions/${functie}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corp),
  });

/**
 * Verificările. Fiecare întoarce { nume, ok, detaliu }.
 * `asteptat` e starea corectă — inclusiv una de refuz: o poartă care NU refuză e
 * la fel de stricată ca una care nu răspunde.
 */
async function ruleaza() {
  const v = [];

  // 1. Verificarea publică a unui certificat. O serie inventată trebuie să dea 404:
  //    dovedește că funcția rulează ȘI că a putut citi din magazie ca să constate lipsa.
  {
    const r = await post("registru-pedigree", { actiune: "verifica", serie: "CFCR-P-0000-MONITOR" });
    v.push({
      nume: "Verificarea certificatelor",
      ok: r.status === 404,
      detaliu: r.eroare || `a răspuns ${r.status}, se aștepta 404 (serie inexistentă)`,
    });
  }

  // 2. Fișa publică a câinelui — cerere fără referință: 400.
  {
    const r = await post("registru-pedigree", { actiune: "caine" });
    v.push({
      nume: "Fișa publică a câinelui",
      ok: r.status === 400,
      detaliu: r.eroare || `a răspuns ${r.status}, se aștepta 400`,
    });
  }

  // 3. Poarta declarațiilor. FĂRĂ cod în cerere: așa nu se numără ca încercare greșită.
  {
    const r = await post("registru-dmf", { actiune: "dosare" });
    v.push({
      nume: "Poarta declarațiilor (DMF)",
      ok: r.status === 401,
      detaliu: r.eroare || `a răspuns ${r.status}, se aștepta 401 (fără cod)`,
    });
  }

  // 4. Site-ul static: pagina pe care o deschide cine scanează un cod QR.
  {
    const r = await cere(`${SITE}/verifica-pedigree/`);
    v.push({
      nume: "Pagina de verificare",
      ok: r.status === 200 && r.text.includes("Verificarea certificatului"),
      detaliu: r.eroare || (r.status === 200 ? "pagina s-a servit, dar nu conține textul așteptat" : `a răspuns ${r.status}`),
    });
  }

  // 5. Prospețimea copiei de siguranță. Fără jeton, sărim — nu raportăm fals.
  if (process.env.BACKUP_GITHUB_TOKEN) {
    const r = await cere(`https://api.github.com/repos/${REPO}/contents/copii?ref=${RAMURA}`, {
      headers: {
        Authorization: "Bearer " + process.env.BACKUP_GITHUB_TOKEN,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    let ok = false, detaliu = r.eroare || `GitHub a răspuns ${r.status}`;
    if (r.status === 200) {
      try {
        const nume = JSON.parse(r.text)
          .map((x) => String(x.name || ""))
          .filter((n) => /^registru-\d{4}-\d{2}-\d{2}\.zip\.enc$/.test(n))
          .sort();
        const ultima = nume[nume.length - 1];
        if (!ultima) {
          detaliu = "nu există nicio copie în ramura de siguranță";
        } else {
          const zile = Math.floor((Date.now() - Date.parse(ultima.slice(9, 19))) / 86400000);
          ok = zile <= ZILE_COPIE;
          detaliu = ok ? `ultima copie: ${ultima.slice(9, 19)} (acum ${zile} zile)`
                       : `ultima copie e din ${ultima.slice(9, 19)} — acum ${zile} zile, peste pragul de ${ZILE_COPIE}`;
        }
      } catch (err) { detaliu = "răspuns GitHub neinteligibil: " + err.message; }
    }
    v.push({ nume: "Copia de siguranță", ok, detaliu });
  }

  return v;
}

async function trimiteAlerta(alerta, stare) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("ALERTĂ NETRIMISĂ (lipsește BREVO_API_KEY):", alerta.tip, alerta.subiect);
    return false;
  }
  const revenire = alerta.tip === "revenire";
  const cazute = stare.verificari.filter((x) => !x.ok);
  const bune = stare.verificari.filter((x) => x.ok);

  const rand = (x) =>
    `<tr><td style="padding:4px 12px 4px 0">${x.ok ? "✓" : "✕"}</td>` +
    `<td style="padding:4px 12px 4px 0"><strong>${esc(x.nume)}</strong></td>` +
    `<td style="color:#666">${esc(x.detaliu)}</td></tr>`;

  const titlu = revenire
    ? "✓ Registrul funcționează din nou"
    : (alerta.tip === "reamintire" ? "⚠ ÎNCĂ nu funcționează" : "⚠ Ceva nu funcționează în registru");

  const html =
    `<h2 style="margin:0 0 4px;color:${revenire ? "#1F7A4D" : "#8c1d2f"}">${titlu}</h2>` +
    `<p style="color:#666;margin:0 0 18px">Monitorizarea automată a Registrului genealogic — CFC-Royal</p>` +
    (revenire
      ? `<p>Toate verificările trec. Problema a ținut ${esc(deCandText(stare.de))}.</p>`
      : `<p><strong>${esc(alerta.subiect)}</strong>${cazute.length ? "" : "."} ` +
        `Starea ține ${esc(deCandText(stare.de))}.</p>`) +
    `<table style="border-collapse:collapse;font-size:14px;margin:16px 0">` +
    cazute.map(rand).join("") + bune.map(rand).join("") +
    `</table>` +
    `<p style="font-size:13px;color:#666">Verificat la ${esc(stare.la)}.<br>` +
    `Raportul complet e în panoul de administrare, la „Starea sistemului".</p>` +
    (revenire ? "" :
      `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
      `<p style="font-size:12px;color:#888">Primești o singură alertă la începutul unei probleme și una la ` +
      `revenire. Dacă problema ține, revine o reamintire la fiecare 6 ore — nu la fiecare verificare.</p>`);

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Monitorizare CFC-Royal", email: "newsletter@cfc-royal.ro" },
        to: [{ email: CATRE }],
        subject: `[CFC-Royal] ${revenire ? "Rezolvat" : "PROBLEMĂ"} — ${alerta.subiect}`,
        htmlContent: html,
      }),
    });
    if (!res.ok) { console.error("Brevo (alertă):", res.status, await res.text()); return false; }
    return true;
  } catch (err) { console.error("Trimiterea alertei a eșuat:", err); return false; }
}

export default async () => {
  const verificari = await ruleaza();
  const store = getStore("registru");

  let veche = null;
  try { veche = await store.get("monitor/stare", { type: "json" }); }
  catch (err) { console.error("Citirea stării de monitorizare a eșuat:", err); }

  const { stare, alerta } = decide(veche, verificari, Date.now());

  if (alerta) {
    const trimis = await trimiteAlerta(alerta, stare);
    stare.ultimaAlertaTrimisa = trimis;
    // Dacă e-mailul n-a plecat, NU marcăm alerta ca dată: la rularea următoare se
    // reîncearcă, în loc să tacem șase ore pentru o problemă neanunțată.
    if (!trimis && alerta.tip !== "revenire") stare.ultimaAlerta = veche?.ultimaAlerta || null;
  }

  try { await store.setJSON("monitor/stare", stare); }
  catch (err) { console.error("Scrierea stării de monitorizare a eșuat:", err); }

  const cazute = verificari.filter((x) => !x.ok);
  if (cazute.length) {
    console.error("MONITOR: " + cazute.map((x) => `${x.nume} — ${x.detaliu}`).join(" | "));
  } else {
    console.log(`MONITOR: toate cele ${verificari.length} verificări trec.`);
  }

  return json({ ok: !cazute.length, stare: stare.stare, verificari, alerta: alerta?.tip || null });
};

// La fiecare 15 minute. Mai des n-ar ajuta: o cădere se rezolvă oricum în minute-ore,
// iar fiecare rulare e o invocare consumată degeaba când totul merge.
export const config = { schedule: "*/15 * * * *" };
