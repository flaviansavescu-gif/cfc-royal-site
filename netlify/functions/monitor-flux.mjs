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
//   ALERTE_EMAIL         — unde pleacă alerta (implicit adresa președintelui, din _comun/posta.mjs)
//   BREVO_API_KEY        — pentru trimitere (fără ea, alerta rămâne doar în jurnal)
//   BACKUP_GITHUB_TOKEN  — opțional, pentru verificarea prospețimii copiei
//   SITE_PUBLIC          — implicit https://cfc-royal.ro
import { getStore } from "@netlify/blobs";
import { decide, deCandText } from "./_comun/monitor.mjs";
import { operational, opritDinMediu } from "./_comun/al-doilea-factor.mjs";
import { trimite, escapeHtml } from "./_comun/posta.mjs";
import { CHEIE_PAZNIC_EXTERN } from "./paznic-extern.mjs";

const SITE = process.env.SITE_PUBLIC || "https://cfc-royal.ro";
const CATRE = process.env.ALERTE_EMAIL || "flavian.savescu@gmail.com";
const REPO = process.env.BACKUP_GITHUB_REPO || "flaviansavescu-gif/cfc-royal-site";
const RAMURA = process.env.BACKUP_GITHUB_RAMURA || "backup-registru";

/** Copia e săptămânală; peste opt zile fără una, ceva s-a stricat în tăcere. */
const ZILE_COPIE = 8;
/** O verificare care nu răspunde în atât înseamnă oricum că omul a plecat din pagină. */
const RABDARE_MS = 8000;

import { json } from "./_comun/raspuns.mjs";

// Escapare completă (toate cele 5 caractere), din helperul-standard `posta.mjs` — nu un
// esc local parțial, ca să nu devină o capcană dacă vreo valoare ajunge într-un atribut.
const esc = escapeHtml;

/**
 * Prospețimea check-in-ului paznicului din GitHub Actions (reciprocitatea paznicilor).
 * Funcție PURĂ, ca să poată fi probată. Nebătut niciodată (null) = OK: nu alarmăm la
 * bootstrap, până când paznicul din GitHub atinge urma prima dată (aceeași regulă ca la
 * inimi).
 *
 * PRAGUL, calibrat pe REALITATE (27.08.2026): cron-ul e programat la 10 minute, dar GitHub
 * rulează workflow-urile programate când poate — pauzele MĂSURATE în istoricul rulărilor:
 * de regulă 30–60 min, cu vârfuri de 112, 121, 175 și 306 minute, toate cu rulări reușite.
 * Pragul vechi (60) transforma fiecare astfel de pauză în alarmă + „funcționează din nou"
 * — oboseală de alarmă, lecția din 17.08. Scopul acestui paznic e să prindă un workflow
 * MORT (dezactivat/șters = tăcere pentru totdeauna), nu să cronometreze GitHub: 12 ore
 * prind orice moarte reală în aceeași zi și nu sună niciodată la întârzieri.
 */
export const PRAG_PAZNIC_EXTERN_MIN = 12 * 60;
export function paznicExternViu(inreg, acum = Date.now(), pragMin = PRAG_PAZNIC_EXTERN_MIN) {
  const la = Date.parse(inreg?.la || "");
  if (!Number.isFinite(la))
    return { ok: true, detaliu: "încă niciun check-in de la paznicul din GitHub Actions (se confirmă la prima lui rulare)" };
  const min = Math.floor((acum - la) / 60000);
  return {
    ok: min <= pragMin,
    detaliu: min <= pragMin
      ? `paznicul din GitHub Actions a raportat acum ${min} min`
      : `paznicul din GitHub Actions n-a mai raportat de ${min} min (prag ${pragMin}) — workflow-ul poate fi dezactivat sau șters. Verifică fila Actions din depozit.`,
  };
}

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

  // 5. Sănătatea poștei (Brevo). Toate alarmele pleacă prin ea: dacă cheia a expirat
  //    sau creditul s-a terminat, exact canalul care trebuia să anunțe e cel mort — și
  //    ar muri în tăcere. Verificăm contul (o citire, nu o trimitere); rezultatul se
  //    scrie și în `posta-sanatate` (magazia „acces"), de unde fereastra publică
  //    `stare-inimi` îl dă paznicului din GitHub Actions — canalul INDEPENDENT care
  //    poate suna chiar și când Brevo nu mai poate.
  {
    let ok = false, detaliu = "";
    if (!process.env.BREVO_API_KEY) {
      detaliu = "BREVO_API_KEY lipsește din mediu — niciun e-mail nu poate pleca";
    } else {
      const r = await cere("https://api.brevo.com/v3/account", {
        headers: { "api-key": process.env.BREVO_API_KEY, Accept: "application/json" },
      });
      if (r.status === 200) {
        ok = true;
        detaliu = "cheia e validă";
        try {
          const cont = JSON.parse(r.text);
          const credite = (cont.plan || []).map((p) => p.credits).find((c) => Number.isFinite(c));
          if (Number.isFinite(credite)) {
            detaliu += ` · credite rămase: ${credite}`;
            if (credite <= 0) { ok = false; detaliu += " — EPUIZATE, e-mailurile nu mai pleacă"; }
          }
        } catch { /* forma răspunsului nu e garantată; cheia validă rămâne vestea bună */ }
      } else {
        detaliu = r.eroare || `Brevo a răspuns ${r.status} — cheia e respinsă sau contul are o problemă`;
      }
    }
    v.push({ nume: "Poșta (Brevo)", ok, detaliu });
    try {
      await getStore("acces").setJSON("posta-sanatate", { ok, detaliu, verificatLa: new Date().toISOString() });
    } catch (err) { console.error("Starea poștei nu s-a putut scrie:", err); }
  }

  // 5b. Al doilea factor. E legat de poștă (OTP-ul pleacă pe e-mail): dacă poșta cade,
  //     `operational()` devine fals și dispozitivul NU mai e cerut — codul singur redevine
  //     suficient pentru registratură/admin, TĂCUT. Dezactivarea DELIBERATĂ
  //     (`FARA_AL_DOILEA_FACTOR=1`) e o decizie umană cu acces Netlify, deci OK; ocolirea
  //     din cauza poștei căzute e o AVARIE care nu trebuie să treacă neobservată.
  {
    const activ = operational();
    const deliberat = opritDinMediu();
    v.push({
      nume: "Al doilea factor",
      ok: activ || deliberat,
      detaliu: activ ? "activ (dispozitivul e cerut la registratură și admin)"
        : deliberat ? "dezactivat deliberat din mediu (FARA_AL_DOILEA_FACTOR=1)"
        : "OCOLIT — poșta e neoperațională, deci codul singur deschide registratura/adminul. Repară poșta sau pune un dispozitiv de rezervă.",
    });
  }

  // 6. Prospețimea copiei de siguranță. Fără jeton, sărim — nu raportăm fals.
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

  // 7. Paznicul paznicilor, invers: monitorul de pe Netlify veghează paznicul din GitHub
  //    Actions. Reciprocitate — GitHub veghează Netlify+inimile, iar aici Netlify veghează
  //    GitHub. Dacă `paznic.yml` tace (dezactivat/șters), urma `paznic-extern` se învechește
  //    și ACEST canal (Netlify + Brevo, independent de GitHub) sună. Așa, niciun paznic nu
  //    mai poate muri în tăcere.
  {
    const inreg = await getStore("acces").get(CHEIE_PAZNIC_EXTERN, { type: "json" }).catch(() => null);
    const r = paznicExternViu(inreg);
    v.push({ nume: "Paznicul extern (GitHub Actions)", ok: r.ok, detaliu: r.detaliu });
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

  return trimite({
    catre: CATRE,
    subiect: `[CFC-Royal] ${revenire ? "Rezolvat" : "PROBLEMĂ"} — ${alerta.subiect}`,
    html,
    expeditor: { name: "Monitorizare CFC-Royal", email: "newsletter@cfc-royal.ro" },
  });
}

import { bateInima } from "./_comun/inima.mjs";
export default async () => {
  await bateInima("monitor-flux"); // paznicul paznicilor: tăcerea peste prag sună alarma din GitHub Actions
  let verificari = await ruleaza();
  const store = getStore("registru");

  let veche = null;
  try { veche = await store.get("monitor/stare", { type: "json" }); }
  catch (err) { console.error("Citirea stării de monitorizare a eșuat:", err); }

  // A DOUA PĂRERE înainte de alarmă. Pe 17.08 un singur sughiț al GitHub-ului (404
  // trecător la listarea copiilor) a sunat alarma, deși totul era sănătos — la rularea
  // următoare trecuse de la sine. O alarmă falsă obosește exact urechea care trebuie să
  // rămână atentă. Fără pauze de așteptare (funcția are 10 secunde): PRIMA cădere dintr-o
  // stare sănătoasă se notează doar ca „suspectă" și nu alarmează; dacă și rularea
  // următoare (peste 15 minute) cade, căderea e reală și alarma pleacă. O cădere deja
  // anunțată (stare „cazut") trece nefiltrată, ca reamintirile și revenirea să curgă normal.
  const cadeAcum = verificari.some((x) => !x.ok);
  let suspecta = false;
  if (cadeAcum && !veche?.suspecta && veche?.stare !== "cazut") {
    suspecta = true;
    console.warn("MONITOR: prima cădere — se reconfirmă la rularea următoare înainte de alarmă.");
    verificari = verificari.map((x) =>
      x.ok ? x : { ...x, ok: true, detaliu: x.detaliu + " (prima cădere — se reconfirmă la următoarea rulare)" });
  }

  const { stare, alerta } = decide(veche, verificari, Date.now());
  stare.suspecta = suspecta;

  if (alerta) {
    // Istoricul alertelor, pe luni — hrana raportului lunar. Starea curentă se
    // suprascrie mereu; fără însemnarea asta, „câte alerte au fost și cât au ținut"
    // nu s-ar mai putea spune după o lună. `de` = de când ține starea, deci la
    // „revenire" diferența la − de e chiar durata avariei.
    try {
      const la = new Date().toISOString();
      await store.setJSON(`monitor-alerte/${la.slice(0, 7)}/${la}`, {
        tip: alerta.tip, subiect: alerta.subiect || "", la, de: stare.de || null,
      });
    } catch (err) { console.error("Istoricul alertelor nu s-a putut scrie:", err); }
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
