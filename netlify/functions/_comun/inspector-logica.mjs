// _comun/inspector-logica.mjs — judecata PURĂ a Inspectorului săptămânal (15.09.2026).
//
// Paznicii de azi răspund la „ușa răspunde?". Inspectorul răspunde la „circuitul merge și
// datele sunt consistente?": înscrieri uitate în coadă, DMF fără confirmarea masculului,
// teste de sănătate neverificate, sesiuni de examen nedefinite, arbitri certificați
// nepublicați, copii vechi, DNS-ul poștei. Aici stă doar judecata, fără magazie și fără
// rețea, ca să poată fi probată; citirea o face inspector.mjs.
//
// Fiecare verificare întoarce { nume, nivel: "critic" | "important", ok, detaliu }.
// „critic" = oprirea lui e urgență (lista confirmată de Flavian pe 15.09.2026);
// „important" = intră în raportul săptămânal, nu sună în cursul săptămânii.

const ZI = 86400000;
export const ZILE_COPIE = 8;          // copiile sunt săptămânale; peste 8 zile, ceva a tăcut
export const ZILE_NEMARCATA = 3;      // o înscriere nemarcată de registratură peste 3 zile
export const ZILE_NEIMPORTATA = 5;    // o înscriere neimportată în Manager peste 5 zile
export const ZILE_DMF_NECONFIRMATA = 14;
export const ZILE_TEST_NEVERIFICAT = 14;
export const ZILE_SESIUNE_INAINTE = 120; // fără sesiune de examen în următoarele 4 luni → amintim
export const ZILE_AJUN = 3;           // expoziție în ≤ 3 zile → „pornește Managerul, rulează ajunul"
export const PRAG_CREDITE = 100;      // sub 100 de e-mailuri rămase în ziua respectivă

const zile = (deLa, acum) => Math.floor((acum - Date.parse(deLa || "")) / ZI);
const v = (nume, nivel, ok, detaliu) => ({ nume, nivel, ok, detaliu });

/** DNS-ul poștei: SPF cu Brevo, DKIM brevo1/brevo2, DMARC. `txt` = liste de șiruri; `cname` = { brevo1, brevo2 }. */
export function judecaDns({ spf = [], dmarc = [], cname = {} }) {
  const spfOk = spf.some((t) => /include:spf\.brevo\.com/i.test(t));
  const dkimOk = /dkim\.brevo\.com/i.test(cname.brevo1 || "") && /dkim\.brevo\.com/i.test(cname.brevo2 || "");
  const dmarcOk = dmarc.some((t) => /^v=DMARC1/i.test(t));
  const lipsa = [!spfOk && "SPF fără include:spf.brevo.com", !dkimOk && "DKIM brevo1/brevo2 lipsă", !dmarcOk && "DMARC lipsă"].filter(Boolean);
  return v("DNS-ul poștei (SPF, DKIM, DMARC)", "critic", lipsa.length === 0, lipsa.length ? lipsa.join("; ") : "SPF, DKIM și DMARC la locul lor");
}

/**
 * Creditele Brevo rămase azi, din `posta-sanatate` (monitor-flux verifică VALABILITATEA cheii
 * și alarmează el; aici doar cota — pe care nimeni n-o urmărea; e comună site + Manager).
 */
export function judecaCredite(posta) {
  const m = /credite rămase: (\d+)/.exec((posta && posta.detaliu) || "");
  if (!m) return v("Creditele Brevo (cota zilnică)", "critic", true, "necunoscute (monitor-flux nu le-a raportat încă)");
  const credite = Number(m[1]);
  return v("Creditele Brevo (cota zilnică)", "critic", credite >= PRAG_CREDITE, `${credite} rămase azi` + (credite < PRAG_CREDITE ? ` — sub pragul de ${PRAG_CREDITE}; o seară de numere + catalog poate depăși cota` : ""));
}

/**
 * Copiile MAGAZIILOR din ramura de backup: fișiere `copii/<nume>-AAAA-LL-ZZ.zip.enc`. Copia
 * REGISTRULUI e păzită de monitor-flux (nu o repetăm); aici celelalte magazii (cursuri,
 * expoziții, acces, interese…), pe care nu le urmărea nimeni.
 */
export function judecaCopii(numeFisiere, acum = Date.now()) {
  const ultima = {};
  for (const f of numeFisiere || []) {
    const m = /^(.+)-(\d{4}-\d{2}-\d{2})\.zip\.enc$/.exec(f);
    if (!m || m[1] === "registru") continue;
    if (!ultima[m[1]] || ultima[m[1]] < m[2]) ultima[m[1]] = m[2];
  }
  const nume = Object.keys(ultima).sort();
  if (!nume.length) return v("Copiile magaziilor (fără registru)", "critic", false, "nicio copie de magazie găsită în ramura de backup");
  const vechi = nume.filter((n) => zile(ultima[n], acum) > ZILE_COPIE);
  return v("Copiile magaziilor (fără registru)", "critic", vechi.length === 0,
    vechi.length ? "vechi: " + vechi.map((n) => `${n} (${ultima[n]})`).join(", ") : nume.map((n) => `${n} ${ultima[n]}`).join(" · "));
}

/**
 * Înscrierile din cozile de pe site: nemarcate de registratură peste ZILE_NEMARCATA zile,
 * neimportate în Manager peste ZILE_NEIMPORTATA. `coada` = [{showId, cheie, creat, importat}],
 * `marcaje` = set de chei marcate.
 */
export function judecaInscrieri(coada, marcaje, acum = Date.now()) {
  const nemarcate = [], neimportate = [];
  for (const i of coada || []) {
    const varsta = zile(i.creat, acum);
    if (!marcaje.has(i.cheie) && varsta > ZILE_NEMARCATA) nemarcate.push(i);
    if (!i.importat && varsta > ZILE_NEIMPORTATA) neimportate.push(i);
  }
  const ok = nemarcate.length === 0 && neimportate.length === 0;
  const parti = [];
  if (nemarcate.length) parti.push(`${nemarcate.length} nemarcate de registratură de peste ${ZILE_NEMARCATA} zile`);
  if (neimportate.length) parti.push(`${neimportate.length} neimportate în Manager de peste ${ZILE_NEIMPORTATA} zile`);
  return v("Înscrierile din coadă (registratură → import)", "important", ok, ok ? `${(coada || []).length} în cozi, toate la zi` : parti.join("; "));
}

/** Expozițiile publicate: termen trecut dar deschisă, fără arbitri anunțați, fără tarif, fără rase. */
export function judecaExpozitii(configuri, acum = Date.now()) {
  const probleme = [];
  for (const c of configuri || []) {
    if (!c || !c.deschis || c.repetitie) continue;
    const termen = Date.parse(c.termen || "");
    const data = Date.parse(c.data || "");
    const p = [];
    if (Number.isFinite(data) && data + ZI < acum) p.push("data a trecut, dar e încă publicată");
    if (!Array.isArray(c.rase) || !c.rase.length) p.push("fără rase");
    if (!c.tarif && !c.taxe) p.push("fără tarif");
    if (!Array.isArray(c.arbitri) || !c.arbitri.length) p.push("fără arbitri anunțați");
    if (!c.organizator || !c.organizator.iban) p.push("fără cont de plată");
    if (p.length) probleme.push(`${c.nume}: ${p.join(", ")}`);
    void termen;
  }
  return v("Expozițiile publicate pe site", "important", probleme.length === 0, probleme.length ? probleme.join(" | ") : `${(configuri || []).filter((c) => c && c.deschis).length} publicate, toate complete`);
}

/** Expozițiile care încep în cel mult ZILE_AJUN zile: pentru ele se pornește Managerul și se rulează ajunul. */
export function expozitiiInAjun(configuri, acum = Date.now()) {
  return (configuri || []).filter((c) => {
    if (!c || c.repetitie) return false;
    const data = Date.parse(c.data || "");
    if (!Number.isFinite(data)) return false;
    const inZile = (data - acum) / ZI;
    return inZile >= -0.5 && inZile <= ZILE_AJUN;
  });
}

/** DMF cu confirmarea masculului în așteptare de peste ZILE_DMF_NECONFIRMATA zile. */
export function judecaDmf(declaratii, acum = Date.now()) {
  const vechi = (declaratii || []).filter((d) => d && d.confirmare && d.confirmare.stare === "asteptare" && zile(d.confirmare.trimisLa || d.creat, acum) > ZILE_DMF_NECONFIRMATA);
  return v("DMF fără confirmarea masculului", "important", vechi.length === 0,
    vechi.length ? `${vechi.length} în așteptare de peste ${ZILE_DMF_NECONFIRMATA} zile: ${vechi.slice(0, 5).map((d) => d.id || "?").join(", ")}` : "nicio confirmare restantă");
}

/** Teste de sănătate depuse și neverificate de registratură de peste ZILE_TEST_NEVERIFICAT zile. */
export function judecaTeste(dosare, acum = Date.now()) {
  let restante = 0;
  const cipuri = [];
  for (const [cip, dosar] of Object.entries(dosare || {})) {
    for (const t of (dosar && dosar.teste) || []) {
      if (t.stare !== "verificat" && t.stare !== "respins" && zile(t.depusLa, acum) > ZILE_TEST_NEVERIFICAT) { restante++; if (!cipuri.includes(cip)) cipuri.push(cip); }
    }
  }
  return v("Teste de sănătate neverificate", "important", restante === 0,
    restante ? `${restante} teste de peste ${ZILE_TEST_NEVERIFICAT} zile, la ${cipuri.length} câini` : "niciun test restant");
}

/** Sesiunile de examen: fără sesiune viitoare în următoarele ZILE_SESIUNE_INAINTE zile, examenul e indisponibil. */
export function judecaSesiuni(sesiuni, acum = Date.now()) {
  const azi = new Date(acum).toISOString().slice(0, 10);
  const viitoare = (sesiuni || []).filter((s) => s && String(s.sfarsit || s.start || "") >= azi);
  const inFereastra = viitoare.filter((s) => (Date.parse(s.start) - acum) / ZI <= ZILE_SESIUNE_INAINTE);
  return v("Sesiunile de examen ale Școlii", "important", inFereastra.length > 0,
    inFereastra.length ? `următoarea: ${inFereastra[0].nume || ""} ${inFereastra[0].start}–${inFereastra[0].sfarsit}` : `nicio sesiune definită în următoarele ${ZILE_SESIUNE_INAINTE} zile — fără sesiune, examenul e indisponibil`);
}

/** Arbitri certificați (au grupe) dar nemarcați „public” — nu apar în registrul public. */
export function judecaCertificari(autorizari) {
  const nepublicati = Object.entries(autorizari || {}).filter(([, a]) => a && Array.isArray(a.grupe) && a.grupe.length && !a.public);
  return v("Arbitri certificați nepublicați", "important", nepublicati.length === 0,
    nepublicati.length ? `${nepublicati.length} certificați cu grupe, dar nemarcați „public”` : "toți certificații sunt publici");
}



/** E luni? (raportul complet) — în fusul României. */
export function esteLuni(acum = Date.now()) {
  const ro = new Date(new Date(acum).toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
  return ro.getDay() === 1;
}
/** Prima luni a lunii? (reamintirea repetiției generale lunare) */
export function estePrimaLuniALunii(acum = Date.now()) {
  const ro = new Date(new Date(acum).toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
  return ro.getDay() === 1 && ro.getDate() <= 7;
}

/**
 * Trebuie trimis e-mail azi? Luni: raportul complet, mereu. În alte zile: doar dacă mulțimea
 * verificărilor CRITICE picate s-a schimbat față de ultima trimitere (nu bâzâim zilnic cu
 * aceeași veste), sau dacă e o expoziție în ajun neanunțată încă.
 */
export function trebuieTrimis({ luni, verificari, ultimaTrimitere, ajunNoi }) {
  if (luni) return { trimite: true, motiv: "raportul de luni" };
  const criticePicate = (verificari || []).filter((x) => x.nivel === "critic" && !x.ok).map((x) => x.nume).sort();
  const vechi = ((ultimaTrimitere && ultimaTrimitere.criticePicate) || []).slice().sort();
  if (criticePicate.length && JSON.stringify(criticePicate) !== JSON.stringify(vechi)) return { trimite: true, motiv: "verificări critice picate: " + criticePicate.join(", ") };
  if (!criticePicate.length && vechi.length) return { trimite: true, motiv: "criticele s-au rezolvat" };
  if (ajunNoi && ajunNoi.length) return { trimite: true, motiv: "expoziție în ajun: " + ajunNoi.map((c) => c.nume).join(", ") };
  return { trimite: false, motiv: "nimic nou" };
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Raportul, ca HTML pentru e-mail și ca text pentru jurnal. */
export function compuneRaport({ verificari, ajun, luni, primaLuni, la }) {
  const critice = verificari.filter((x) => x.nivel === "critic");
  const importante = verificari.filter((x) => x.nivel !== "critic");
  const picate = verificari.filter((x) => !x.ok);
  const titlu = picate.length ? `${picate.length} de rezolvat` : "totul în regulă";
  const rand = (x) => `<li style="margin:4px 0">${x.ok ? "✅" : (x.nivel === "critic" ? "🔴" : "🟠")} <b>${esc(x.nume)}</b> — ${esc(x.detaliu)}</li>`;
  let html = `<h2 style="margin:0 0 6px;color:#1F4D3A">Inspectorul CFC-Royal — ${esc(titlu)}</h2>` +
    `<p style="color:#666;margin:0 0 14px">${luni ? "Raportul săptămânal" : "Alertă"} · ${esc(la)}</p>`;
  if (ajun && ajun.length) {
    html += `<div style="border:1px solid #e0b96b;background:#fff8e6;padding:10px 12px;border-radius:6px;margin:0 0 14px">` +
      `<b>⏰ Expoziție în ajun: ${esc(ajun.map((c) => `${c.nume} (${String(c.data).slice(0, 10)})`).join("; "))}</b><br>` +
      `Pornește Managerul de expoziții pe laptop și rulează <code>Ajunul expoziției</code> (scurtătura de pe desktop sau <code>npm run ajun</code>): ` +
      `verifică coada de înscrieri, validările fără e-mail, ringurile, catalogul, coada de e-mail și copia din cloud, apoi îți trimite raportul pe e-mail.</div>`;
  }
  if (primaLuni) {
    html += `<div style="border:1px solid #b9d3b9;background:#eef4ee;padding:10px 12px;border-radius:6px;margin:0 0 14px">` +
      `<b>🎬 Prima luni a lunii: repetiția generală.</b> Pornește Managerul și rulează <code>npm run ajun -- --repetitie</code>: ` +
      `depune o înscriere de probă pe expoziția de repetiție, urmărește-o prin confirmare, verificare, import, validare și numere.</div>`;
  }
  html += `<h3 style="margin:14px 0 4px;color:#8c1d2f">Critice</h3><ul style="padding-left:18px;margin:0">${critice.map(rand).join("")}</ul>`;
  html += `<h3 style="margin:14px 0 4px;color:#8a5a00">Importante</h3><ul style="padding-left:18px;margin:0">${importante.map(rand).join("")}</ul>`;
  html += `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd"><p style="font-size:12px;color:#888">` +
    `Inspectorul rulează zilnic la 07:00 și verifică DOAR ce nu verifică paznicii de la minut (paginile, inimile, cheia poștei și copia registrului rămân la ei). ` +
    `Lunea trimite raportul complet; în alte zile scrie doar când o verificare critică se schimbă sau când o expoziție e în ajun.</p>`;
  const text = verificari.map((x) => `${x.ok ? "OK " : (x.nivel === "critic" ? "CRITIC " : "ATENȚIE ")}${x.nume}: ${x.detaliu}`).join("\n");
  return { subiect: `[CFC-Royal] Inspector — ${titlu}`, html, text };
}
