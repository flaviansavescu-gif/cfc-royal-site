// _comun/limitare.mjs — limitarea încercărilor de autentificare (anti-forță brută).
//
// Codurile platformei sunt scurte prin natura lor (se dictează la telefon), deci
// singura apărare reală împotriva enumerării este limitarea încercărilor.
// Contorul stă în Blobs, pe adresa IP a clientului, cu fereastră glisantă.
import { getStore } from "@netlify/blobs";
import { ANTET_REFUZ_DREPT } from "./drepturi-registru.mjs";
import { createHash } from "node:crypto";
import { consemneaza, usaDinUrl } from "./paznic.mjs";

const store = () => getStore("acces");

// Pragurile sunt DELIBERAT generoase. Contorul e pe adresă IP, iar o adresă e
// împărțită de tot biroul, toată casa sau toți abonații unui operator mobil —
// un prag mic îi blochează pe toți din cauza greșelilor unuia singur.
//
// Aritmetica arată că nu pierdem nimic: un cod de candidat are 8 caractere din
// 31 posibile = 852 de miliarde de variante. Cu 20 de încercări la 5 minute
// (~5.760 pe zi) epuizarea lor ar dura peste 400.000 de ani. Limitarea trebuie
// doar să facă enumerarea imposibilă, nu să pedepsească omul care greșește codul.
export const MAX_ESECURI = 20;         // încercări greșite permise…
export const FEREASTRA_MS = 10 * 60e3; // …în zece minute
export const BLOCARE_MS = 5 * 60e3;    // cât ține blocarea după depășire

/** Adresa clientului, așa cum o pune Netlify în fața funcției. */
export function ipClient(req) {
  const h = req.headers;
  const ip =
    h.get("x-nf-client-connection-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "necunoscut";
  // Nu stocăm IP-ul în clar — doar o amprentă, suficientă pentru numărare.
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Verifică dacă adresa mai are dreptul să încerce.
 * Întoarce { permis:true } sau { permis:false, dupaSecunde }.
 */
export async function verificaLimita(cheie) {
  try {
    const r = await store().get("limita/" + cheie, { type: "json" });
    if (!r) return { permis: true };
    const acum = Date.now();
    if (!r.blocatPana || r.blocatPana <= acum) return { permis: true };

    // Nimeni nu așteaptă mai mult decât prevede politica ACTUALĂ. Dacă pragurile se
    // relaxează, o blocare înregistrată sub regulile vechi se scurtează efectiv —
    // rescriem termenul, nu doar mesajul. Se întâmplă o singură dată per blocare.
    if (r.blocatPana - acum > BLOCARE_MS) {
      r.blocatPana = acum + BLOCARE_MS;
      try { await store().setJSON("limita/" + cheie, r); } catch (e) { /* mesajul rămâne corect oricum */ }
    }
    return { permis: false, dupaSecunde: Math.ceil((r.blocatPana - acum) / 1000) };
  } catch (err) {
    // Dacă store-ul nu răspunde, NU blocăm autentificarea legitimă.
    console.error("Citire limită eșuată:", err);
    return { permis: true };
  }
}

/**
 * Înregistrează o încercare greșită; blochează adresa la depășirea pragului.
 * Întoarce câte încercări au mai rămas (sau -1 dacă nu s-a putut număra) —
 * folosit în răspuns, ca utilizatorul să știe unde se află, și ca semnal de
 * diagnostic: dacă numărul nu scade, înseamnă că scrierea în Blobs nu reușește.
 */
export async function inregistreazaEsec(cheie) {
  try {
    const acum = Date.now();
    const r = (await store().get("limita/" + cheie, { type: "json" })) || { n: 0, de: acum };
    // Fereastră glisantă: dacă a trecut fereastra de la prima încercare, o luăm de la capăt.
    if (!r.de || acum - r.de > FEREASTRA_MS) { r.n = 0; r.de = acum; r.blocatPana = 0; }
    r.n = (r.n || 0) + 1;
    let ramase = MAX_ESECURI - r.n;
    if (r.n >= MAX_ESECURI) { r.blocatPana = acum + BLOCARE_MS; r.n = 0; r.de = acum; ramase = 0; }
    await store().setJSON("limita/" + cheie, r);
    return ramase;
  } catch (err) { console.error("Scriere limită eșuată:", err); return -1; }
}

/** Autentificare reușită — ștergem contorul adresei. */
export async function resetLimita(cheie) {
  try { await store().delete("limita/" + cheie); } catch (err) { console.error(err); }
}

/**
 * Îmbracă o funcție care primește un COD în cerere, ca să nu poată fi folosită drept
 * „ghicitoare" nelimitată de coduri.
 *
 * Poarta de intrare (`acces-cursuri`) era limitată, dar restul funcțiilor primesc și
 * ele coduri de administrator, de lector sau de arbitru și le verificau fără nicio
 * limită — deci ocoleau apărarea. Ambalajul acesta o extinde peste tot, dintr-un
 * singur loc, fără să atingă logica fiecărei funcții.
 *
 * Cum decide dacă a fost o încercare greșită: după STAREA răspunsului. 401/403
 * înseamnă acreditare respinsă (o numărăm), un răspuns reușit înseamnă cod bun
 * (ștergem contorul). Funcția nu trebuie să știe nimic despre limitare.
 *
 * Cererile fără `cod` trec neatinse: un `cid` este deja o amprentă de 64 de
 * caractere — nu se ghicește, deci nu are ce limita.
 *
 * Dacă limitarea însăși dă eroare, cererea trece: apărarea nu are voie să devină
 * ea însăși cauza unei căderi.
 */
export function cuLimitareCod(handler) {
  return async (req, context) => {
    let areCod = false;
    try {
      if (req.method === "POST") {
        const b = await req.clone().json();
        // Codul de acces circulă în `cod`, dar după refactorul „M1" candidatul îl trimite
        // în `cid`, iar unele funcții îl primesc ca `id`. Toate trei sunt acreditări care
        // se pot ghici — deci toate trebuie limitate, altfel poarta e liberă pe acele căi.
        areCod = !!(String(b?.cod || "").trim() || String(b?.cid || "").trim() || String(b?.id || "").trim());
      }
    } catch {
      // CORPUL NU E JSON. Până azi însemna „fără cod, treci nelimitat" — și era o portiță
      // reală: `breed-instalare` acceptă și corpuri de FORMULAR, deci un cod trimis așa
      // trecea complet NENUMĂRAT (ghicire nelimitată, inclusiv a codului de admin).
      // De acum e invers: dacă nu putem citi corpul, presupunem că poartă un cod și
      // limităm. Fail-closed, ca peste tot în casă.
      areCod = req.method === "POST";
    }
    if (!areCod) return handler(req, context);

    let cheie = null;
    try {
      cheie = ipClient(req);
      const lim = await verificaLimita(cheie);
      if (!lim.permis) {
        return new Response(
          JSON.stringify({ eroare: "Prea multe încercări. Reîncearcă peste " + Math.ceil(lim.dupaSecunde / 60) + " minute." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store",
              "Retry-After": String(lim.dupaSecunde),
            },
          },
        );
      }
    } catch (err) {
      console.error("Limitare (verificare) eșuată:", err);
      cheie = null;
    }

    const raspuns = await handler(req, context);

    if (cheie) {
      try {
        // Refuzul de DREPT nu e o încercare de spargere: omul e cine spune că e, doar
        // n-are voie la acea acțiune. Numărat, l-ar duce la blocare pentru un clic greșit.
        const refuzDeDrept = raspuns.headers.get(ANTET_REFUZ_DREPT) === "1";
        if (!refuzDeDrept && (raspuns.status === 401 || raspuns.status === 403)) {
          await inregistreazaEsec(cheie);
          // …și paznicul de intruziune ține minte. Contorul de mai sus e o STARE (se
          // resetează, se șterge); paznicul are nevoie de memorie, ca să poată vedea
          // tiparul peste ore și peste uși. Aici e singurul loc din casă prin care trec
          // TOATE refuzurile de acreditare — deci singurul loc unde merită pus.
          const usa = usaDinUrl(req.url);
          if (usa) await consemneaza(store(), { usa, amprenta: cheie });
        }
        // NU mai resetăm contorul la orice 200. Era o portiță: funcții ca `progres-cursuri`
        // sau acțiunile „eu" răspund 200 și pentru un cod INEXISTENT, deci 19 ghiciri
        // urmate de o cerere fără valoare ștergeau contorul — la nesfârșit. Resetarea
        // rămâne treaba funcțiilor care chiar au DOVEDIT o acreditare: ele cheamă explicit
        // `resetLimita` (acces-cursuri, breed-date). Aici doar numărăm eșecurile.
      } catch (err) { console.error("Limitare (numărare) eșuată:", err); }
    }
    return raspuns;
  };
}
