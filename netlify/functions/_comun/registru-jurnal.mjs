// _comun/registru-jurnal.mjs — jurnalul de audit al Registrului genealogic.
//
// Un registru genealogic care nu-și poate apăra propriile înregistrări nu e un registru,
// e o listă. Când cineva contestă o ascendență, o anulare de certificat sau dispariția
// unui dosar, trebuie să existe un răspuns scris: cine, ce, când.
//
// TREI ALEGERI DE FOND:
//
//  1. O INTRARE = UN BLOB. Tentația e un singur fișier cu un vector de intrări, dar două
//     cereri simultane l-ar citi în aceeași stare și a doua ar suprascrie prima — exact
//     intrarea pe care ai vrea s-o ai. Cheile poartă luna, ca listarea să nu ceară tot
//     istoricul: jurnal/2026-07/2026-07-27T18:04:11.204Z-a1b2c3
//
//  2. CODURILE NU SE SCRIU NICIODATĂ. Jurnalul se citește de administrator și intră în
//     arhiva descărcabilă; un cod de acces ajuns acolo ar transforma proba în breșă.
//     Se scrie rolul și numele pe care sistemul îl știe deja (membru, registrator), nu
//     cheia cu care a intrat.
//
//  3. ȘTERGEREA NU SE POATE FACE FĂRĂ URMĂ. Pentru faptele distructive folosește
//     `jurnalizeazaObligatoriu`: dacă intrarea nu se poate scrie, fapta nu se execută.
//     Pentru restul, `jurnalizeaza` nu blochează niciodată acțiunea deja reușită.
//
// Stocare (store „registru"): jurnal/<AAAA-LL>/<ISO>-<aleator>

import { trimite, pagina, escapeHtml, ADRESA_ASOCIATIEI } from "./posta.mjs";

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

/** Faptele consemnate, cu eticheta lor lizibilă. Lista e închisă: ce nu e aici nu se scrie. */
export const FAPTE = {
  // Declarații de montă și fătare
  "dmf-depus": "Declarație depusă",
  "dmf-respins": "Dosar respins",
  "dmf-sters": "Dosar șters",
  "confirmare-trimisa": "Cerere de confirmare retrimisă",
  "confirmare-adresa": "Adresa masculului corectată",
  "confirmare-raspuns": "Răspunsul proprietarului masculului",
  "confirmare-alternativa": "Confirmare acceptată pe dovadă alternativă",
  // Verificarea înscrierilor în expoziții (acte + plată), făcută de registratură
  "inscriere-verificata": "Înscriere în expoziție verificată",
  // Înregistrarea caniselor: cererea membrului și hotărârea registraturii. Faptele
  // trebuie trecute aici ÎNAINTE de prima folosire — jurnalul refuză fapte necunoscute,
  // iar refuzul lui oprește chiar operația (urma se scrie înaintea faptei).
  "canisa-cerere": "Cerere de înregistrare a canisei depusă",
  "canisa-aprobata": "Canisă înregistrată (afix rezervat)",
  "canisa-respinsa": "Cerere de canisă respinsă",
  // Certificate și ascendență
  "certificat-emis": "Certificat de origine emis",
  "certificat-anulat": "Certificat ANULAT",
  "certificat-restabilit": "Anulare revocată (certificat repus în vigoare)",
  "ascendenta-modificata": "Ascendență modificată",
  "numar-wdf": "Număr WDF de cuib înregistrat",
  "numar-wdf-caine": "Număr WDF individual înregistrat",
  // Aducerea în registru a cuiburilor emise pe hârtie, înaintea registrului digital.
  // Fapta trebuie să existe aici: la primul import, jurnalul a refuzat-o ca „necunoscută",
  // iar 17 certificate au intrat fără urmă. Un act apărut în registru fără să se știe
  // cine l-a pus și din ce dosar de hârtie provine nu se poate apăra la o contestație.
  "import-istoric": "Cuib adus din arhiva de hârtie",
  // Îndreptarea textului ascendenței la actele aduse din arhiva de hârtie. Cititorul de
  // formulare lipea codul WDF în numele părintelui și lua „- N/A" drept număr de pedigree.
  // Fapta se consemnează separat de emitere: cine se uită peste un act trebuie să vadă
  // că textul lui a fost atins după eliberare, când, și de la ce la ce.
  "corectie-ascendenta": "Ascendență îndreptată (act din arhiva de hârtie)",
  // Citirea automată a pedigree-urilor părinților. Se consemnează fiindcă atinge un
  // dosar, costă bani și trimite două documente în afara casei. Urma amănunțită
  // (`citire/urma/<id>`) se rescrie la fiecare citire; jurnalul e cel care păstrează
  // câte au fost și de către cine.
  "citire-documente": "Pedigree-urile părinților citite automat",
  // Dosarul de sănătate al câinelui (Faza 1): rezultatul depus de membru și hotărârea
  // registraturii. Datele ajung public pe fișa câinelui doar după verificare, deci fapta
  // se vede în jurnal — cine a depus, cine a verificat/respins și când.
  "sanatate-depus": "Rezultat de sănătate depus",
  "sanatate-verificat": "Rezultat de sănătate verificat",
  "sanatate-respins": "Rezultat de sănătate respins",
  // Anunțurile de cuiburi disponibile. Anunțul e legat de un DMF real al crescătorului și
  // ajunge public DOAR după aprobarea registraturii — deci fapta se vede în jurnal: cine a
  // cerut publicarea, cine a aprobat/respins și pentru ce cuib.
  "anunt-cuib-depus": "Anunț de cuib depus spre publicare",
  "anunt-cuib-aprobat": "Anunț de cuib publicat",
  "anunt-cuib-respins": "Anunț de cuib respins",
  "anunt-cuib-retras": "Anunț de cuib retras de crescător",
  // Acces
  "cod-generat": "Cod de acces generat",
  "cod-trimis": "Cod de acces trimis pe e-mail",
  "cod-sters": "Acces revocat",
  "cotizatie-actualizata": "Cotizație actualizată",
  "cerere-acces": "Solicitare de acces la registru",
  "cerere-stearsa": "Cerere de acces ștearsă",
  // Administrare
  "arhiva-descarcata": "Arhiva registrului descărcată",
  // Extrasele oficiale — ca extrasul de cont de la bancă: cine, când și ce interval a
  // cerut. Datele pleacă din registru pe hârtie, deci fapta se vede în jurnal.
  "extras-carte": "Extras din Cartea de Origine generat",
  "extras-afixe": "Extras din Registrul afixelor generat",
  "magazie-curatata": "Curățenie în magazie",
  "intrare-noua": "Dispozitiv nou recunoscut (al doilea factor)",
};

/**
 * Faptele care nu trebuie doar consemnate, ci ANUNȚATE.
 *
 * Jurnalul e o probă: îl citești când te-ai apucat deja să cauți ceva. Faptele de aici
 * sunt cele despre care vrei să afli chiar dacă nu cauți nimic — pentru că, dacă nu
 * le-ai făcut tu, e prea târziu să le afli peste o lună. Restul rămân în jurnal, unde
 * le e locul: o alertă la fiecare declarație depusă ar face alertele invizibile.
 */
export const FAPTE_DE_ANUNTAT = new Set([
  "cerere-acces",          // un om așteaptă un răspuns — dacă nu-l vezi, nu-l primește
  "arhiva-descarcata",     // tot registrul, cu scanuri de acte, pe un calculator din afară
  "dmf-sters",             // un dosar dispare
  "certificat-anulat",     // un act eliberat își pierde valabilitatea
  "certificat-restabilit",
  "cod-generat",           // cineva nou capătă acces
  "cod-sters",             // cuiva i se ia accesul
  "intrare-noua",          // s-a recunoscut un dispozitiv nou pentru un rol greu
]);

/** Numele sub care apare autorul faptei. Niciodată codul cu care a intrat. */
export function actorJurnal(eu) {
  if (!eu) return { rol: "necunoscut", nume: "necunoscut" };
  if (eu.rol === "admin") return { rol: "admin", nume: "Administrator" };
  if (eu.rol === "registratura") {
    return { rol: "registratura", nume: taie(eu.registrator?.nume, 120) || "registratură", id: taie(eu.registrator?.id, 40) };
  }
  if (eu.rol === "membru") {
    return { rol: "membru", nume: taie(eu.membru?.nume, 120) || "membru", id: taie(eu.membru?.id, 40) };
  }
  return { rol: taie(eu.rol, 24) || "necunoscut", nume: taie(eu.nume, 120) || "necunoscut" };
}

/** Actorul din afara sistemului: proprietarul masculului, venit pe link. */
export function actorExtern(nume) {
  return { rol: "extern", nume: taie(nume, 120) || "proprietar mascul" };
}

const aleator = () => Math.random().toString(36).slice(2, 8);

function construieste({ fapta, actor, obiect, detalii, ip }) {
  const la = new Date().toISOString();
  return {
    cheie: `jurnal/${la.slice(0, 7)}/${la}-${aleator()}`,
    intrare: {
      la,
      fapta: taie(fapta, 40),
      eticheta: FAPTE[fapta] || taie(fapta, 40),
      actor: actor || { rol: "necunoscut", nume: "necunoscut" },
      obiect: taie(obiect, 120),      // seria dosarului / certificatului / numele vizat
      detalii: taie(detalii, 400),
      ip: taie(ip, 60),
    },
  };
}

/**
 * Trimite alerta pentru o faptă gravă. Nu așteptăm rezultatul acolo unde e chemată:
 * consemnarea a reușit deja, iar poșta e o treabă separată.
 */
async function anunta(intrare, catre) {
  // O solicitare de acces nu e o faptă gravă: e un om care așteaptă un răspuns.
  // Tonul (și culoarea) trebuie să spună asta, altfel avertismentele roșii se
  // amestecă și nu mai atrag atenția niciunul.
  const cerere = intrare.fapta === "cerere-acces";
  const titlu = cerere ? "Cineva cere acces la registru" : "Faptă gravă în registru";
  const culoare = cerere ? "#1F4D3A" : "#8c1d2f";
  const incheiere = cerere
    ? `<p style="font-size:12px;color:#888">Verifică întâi calitatea de membru și cotizația. ` +
      `Codul se generează din <strong>spațiul Registraturii</strong>, la „Cereri de acces" ` +
      `(cfc-royal.ro/registru/registratura/) — de către registratorul desemnat.</p>`
    : `<p style="font-size:12px;color:#888">Primești acest mesaj fiindcă e una dintre faptele grave ` +
      `ale registrului. <strong>Dacă nu ai făcut-o tu, schimbă imediat codurile de acces</strong> ` +
      `și verifică jurnalul din panoul de administrare.</p>`;

  const corp =
    `<p style="font-size:15px"><strong>${escapeHtml(intrare.eticheta)}</strong>` +
    (intrare.obiect ? ` — <code>${escapeHtml(intrare.obiect)}</code>` : "") + `</p>` +
    `<table style="border-collapse:collapse;font-size:14px;margin:14px 0">` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Cine</td>` +
    `<td><strong>${escapeHtml(intrare.actor?.nume || "necunoscut")}</strong> ` +
    `<span style="color:#666">(${escapeHtml(intrare.actor?.rol || "")})</span></td></tr>` +
    `<tr><td style="padding:3px 14px 3px 0;color:#666">Când</td><td>${escapeHtml(intrare.la)}</td></tr>` +
    (intrare.ip ? `<tr><td style="padding:3px 14px 3px 0;color:#666">De la</td><td>${escapeHtml(intrare.ip)}</td></tr>` : "") +
    (intrare.detalii ? `<tr><td style="padding:3px 14px 3px 0;color:#666;vertical-align:top">Detalii</td><td>${escapeHtml(intrare.detalii)}</td></tr>` : "") +
    `</table>` +
    `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
    incheiere;

  // Alerta trebuie să ajungă la cine POATE rezolva. Cererile de acces se lucrează la
  // registratură, deci acolo pleacă — altfel omul care primește vestea n-are ce face cu
  // ea, iar cel care ar avea, n-o află. Adresa asociației rămâne rezerva.
  const destinatari = (Array.isArray(catre) ? catre : [catre]).filter(Boolean);
  return trimite({
    catre: destinatari.length ? destinatari.join(",") : ADRESA_ASOCIATIEI,
    subiect: `[CFC-Royal] ${intrare.eticheta}${intrare.obiect ? " — " + intrare.obiect : ""}`,
    html: pagina(titlu, culoare, corp),
  });
}

/**
 * Consemnează o faptă. NU aruncă niciodată: acțiunea a reușit deja, iar o eroare de
 * scriere a jurnalului nu are voie s-o transforme într-un eșec pentru om.
 * Întoarce true dacă intrarea a fost scrisă.
 */
export async function jurnalizeaza(store, date) {
  try {
    if (!FAPTE[date?.fapta]) {
      console.error("Faptă necunoscută în jurnal:", date?.fapta);
      return false;
    }
    const { cheie, intrare } = construieste(date);
    await store.setJSON(cheie, intrare);
    if (FAPTE_DE_ANUNTAT.has(intrare.fapta)) await anunta(intrare, date?.anuntaLa);
    return true;
  } catch (err) {
    console.error("Scrierea în jurnal a eșuat:", err);
    return false;
  }
}

/**
 * Consemnează o faptă DISTRUCTIVĂ, înainte de a o executa. Aruncă dacă nu poate scrie —
 * apelantul trebuie să renunțe la ștergere. Un dosar care dispare fără urmă e mai rău
 * decât un dosar care rămâne.
 */
export async function jurnalizeazaObligatoriu(store, date) {
  if (!FAPTE[date?.fapta]) throw new Error("Faptă necunoscută: " + date?.fapta);
  const { cheie, intrare } = construieste(date);
  await store.setJSON(cheie, intrare);
  // Anunțul vine DUPĂ ce urma e scrisă, și nu poate anula fapta: dacă poșta cade,
  // ștergerea tot are voie să se facă — proba, care contează, există deja.
  if (FAPTE_DE_ANUNTAT.has(intrare.fapta)) {
    try { await anunta(intrare, date?.anuntaLa); } catch (err) { console.error("Alerta n-a plecat:", err); }
  }
  return intrare;
}

/** Adresa de unde a venit cererea, pentru intrările care o justifică. */
export function ipCerere(req) {
  try {
    return req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
  } catch {
    return "";
  }
}

/** Lunile pe care le acoperă jurnalul, cele mai noi întâi (AAAA-LL). */
export function luniDinChei(chei) {
  const luni = new Set();
  for (const k of chei) {
    const m = String(k).match(/^jurnal\/(\d{4}-\d{2})\//);
    if (m) luni.add(m[1]);
  }
  return [...luni].sort().reverse();
}

/** Filtrarea intrărilor: după faptă și după text liber (actor, obiect, detalii). */
export function filtreaza(intrari, { fapta, cauta, actor } = {}) {
  const q = String(cauta || "").trim().toLowerCase();
  // `actor` e o potrivire EXACTĂ pe numele autorului, nu o căutare de text: un
  // registrator pe nume „Paul" n-are ce căuta în faptele altcuiva doar fiindcă un
  // câine sau un coleg poartă același nume undeva în text.
  const a = String(actor || "").trim();
  return intrari.filter((x) => {
    if (fapta && x.fapta !== fapta) return false;
    if (a && String(x.actor?.nume || "") !== a) return false;
    if (!q) return true;
    return [x.eticheta, x.actor?.nume, x.actor?.rol, x.obiect, x.detalii]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });
}

/**
 * Citește jurnalul unei luni (implicit luna curentă), cel mai nou întâi.
 * Se citește pe luni tocmai ca să nu ajungem, peste ani, să încărcăm tot registrul
 * ca să vedem ce s-a întâmplat ieri.
 */
export async function citesteJurnal(store, { luna, fapta, cauta, actor, limita = 200 } = {}) {
  const acum = new Date().toISOString().slice(0, 7);
  const cerut = /^\d{4}-\d{2}$/.test(String(luna || "")) ? luna : acum;

  let toate = [];
  let luniDisponibile = [];
  try {
    const { blobs } = await store.list({ prefix: "jurnal/" });
    luniDisponibile = luniDinChei(blobs.map((b) => b.key));
    const aleLunii = blobs.filter((b) => b.key.startsWith(`jurnal/${cerut}/`));
    // Cheile încep cu marca de timp, deci sortarea lor descrescătoare e chiar ordinea
    // cronologică inversă — nu e nevoie să citim tot ca să putem tăia lista.
    aleLunii.sort((a, b) => b.key.localeCompare(a.key));
    const felii = aleLunii.slice(0, Math.max(1, Math.min(limita, 1000)));
    for (const b of felii) {
      const x = await store.get(b.key, { type: "json" }).catch(() => null);
      if (x) toate.push(x);
    }
  } catch (err) {
    console.error("Citirea jurnalului a eșuat:", err);
  }

  if (!luniDisponibile.includes(cerut)) luniDisponibile = [cerut, ...luniDisponibile];
  return { luna: cerut, luni: luniDisponibile, intrari: filtreaza(toate, { fapta, cauta, actor }) };
}
