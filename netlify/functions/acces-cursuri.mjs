// acces-cursuri.mjs — POARTA DE INTRARE a platformei, verificată pe SERVER.
//
// Înainte, codurile de administrator și de lector se verificau în browser, iar
// amprentele lor (SHA-256) ajungeau în HTML-ul public — cine le lua putea sparge
// un cod scurt offline, fără limită de încercări. Acum:
//   • amprentele stau doar pe server (_comun/roluri.mjs);
//   • fiecare încercare trece pe aici și e limitată pe adresă (_comun/limitare.mjs);
//   • pagina primește înapoi doar ROLUL (care nu e secret) și destinația.
//
// POST { cod } -> { rol, slug?, nume?, id?, dest }   |  401 cod greșit  |  429 prea multe încercări
import { getStore } from "@netlify/blobs";
import { sha256, rolLaIntrare } from "./_comun/roluri.mjs";
import { ipClient, verificaLimita, inregistreazaEsec, resetLimita } from "./_comun/limitare.mjs";
import {
  dispozitivCunoscut, deschideIntrarea, confirmaIntrarea, OTP_MINUTE, DISPOZITIV_ZILE,
} from "./_comun/al-doilea-factor.mjs";
import { trimite, pagina, escapeHtml, ADRESA_ASOCIATIEI, postaConfigurata } from "./_comun/posta.mjs";
import { consemneaza } from "./_comun/paznic.mjs";
import { json } from "./_comun/raspuns.mjs";

/** Adresa, arătată pe jumătate — cine intră trebuie să știe unde să caute codul. */
function mascheaza(email) {
  const [nume, gazda] = String(email || "").split("@");
  if (!gazda) return "adresa asociației";
  return nume.slice(0, 2) + "•".repeat(Math.max(3, nume.length - 2)) + "@" + gazda;
}

/**
 * Trimite codul de șase cifre pentru un rol greu al Școlii.
 * @returns {{ocolit:true}|{eroare:string}|{intrareId:string,catre:string}}
 */
async function ceruIntrarea(store, rol, cine, email) {
  if (!postaConfigurata()) {
    console.error("AL DOILEA FACTOR (Școala) NU E OPERAȚIONAL: lipsește BREVO_API_KEY.");
    return { ocolit: true };
  }
  const { id, otp } = await deschideIntrarea(store, { rol, cine, email });
  const trimis = await trimite({
    catre: email,
    subiect: `[CFC-Royal] Cod de intrare în platformă: ${otp}`,
    html: pagina("Cod de intrare", "#1F4D3A",
      `<p style="font-size:15px">Cineva intră în platforma Școlii de Arbitraj ca ` +
      `<strong>${escapeHtml(rol === "admin" ? "administrator" : "lector")}</strong>` +
      (cine ? ` (${escapeHtml(cine)})` : "") + `, de pe un dispozitiv nerecunoscut.</p>` +
      `<p style="font-size:32px;letter-spacing:0.18em;font-weight:700;color:#1F4D3A;margin:18px 0">${escapeHtml(otp)}</p>` +
      `<p style="font-size:14px;color:#666">Codul e valabil ${OTP_MINUTE} minute. După confirmare, ` +
      `dispozitivul rămâne recunoscut ${DISPOZITIV_ZILE} de zile.</p>` +
      `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
      `<p style="font-size:12px;color:#888"><strong>Dacă nu ai cerut tu această intrare, cineva ` +
      `îți cunoaște codul.</strong> Schimbă-l cât mai repede.</p>`),
  });
  if (!trimis) return { eroare: "Nu am putut trimite codul pe e-mail. Reîncearcă peste un minut." };
  return { intrareId: id, catre: mascheaza(email) };
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const cod = String(body.cod || "").trim();
  if (!cod) return json({ eroare: "Cod lipsă." }, 400);

  // —— Limitare: aceeași adresă nu poate încerca la nesfârșit ——
  const cheie = ipClient(req);
  const lim = await verificaLimita(cheie);
  if (!lim.permis)
    return json({ eroare: "Prea multe încercări. Reîncearcă peste " + Math.ceil(lim.dupaSecunde / 60) + " minute." }, 429);

  // —— 0) Confirmarea codului primit pe e-mail ——
  // ÎNAINTE de recunoașterea codului: cererea de confirmare poartă și codul de acces,
  // deci altfel ar intra în ramura de mai jos și n-ar ajunge niciodată aici.
  if (String(body.actiune || "") === "intrare-confirma") {
    const rez = await confirmaIntrarea(
      getStore("cursuri"),
      String(body.intrareId || "").slice(0, 64),
      String(body.otp || "").slice(0, 10),
    );
    if (rez.eroare) return json({ eroare: rez.eroare }, 401);
    const l = rez.rol === "lector" ? (rolLaIntrare(cod) || {}) : {};
    return json({
      ok: true, rol: rez.rol, dispozitiv: rez.jeton, nume: rez.cine, slug: l.slug || "",
      dest: rez.rol === "admin" ? "/cursuri/admin/" : "/cursuri/lector/" + (l.slug || "") + "/",
    });
  }

  // —— 1) Coduri fixe: administrator, lector, cod comun de candidați ——
  const fix = rolLaIntrare(cod);
  if (fix) {
    await resetLimita(cheie);
    const dispozitiv = String(body.dispozitiv || "").trim();

    // A doua cheie, pentru rolurile care administrează. Codul comun de candidați NU
    // trece pe aici: e dat tuturor cursanților, nu deschide nimic administrativ, iar
    // un cod pe e-mail la fiecare intrare ar face studiul imposibil.
    if (fix.rol === "admin" || fix.rol === "lector") {
      const store = getStore("cursuri");
      if (!(await dispozitivCunoscut(store, dispozitiv, fix.rol))) {
        // Lectorul fără adresă scrisă în registru intră mai departe doar cu codul: n-are
        // rost să ne prefacem că-l apărăm trimițând codul lui altcuiva.
        const email = fix.rol === "admin" ? ADRESA_ASOCIATIEI : (fix.email || "");
        if (email) {
          const r = await ceruIntrarea(store, fix.rol, fix.nume || "administrator", email);
          if (r.eroare) return json({ eroare: r.eroare }, 503);
          if (!r.ocolit) {
            return json({
              pas: "cod-email", intrareId: r.intrareId, catre: r.catre, rol: fix.rol,
              dest: fix.rol === "admin" ? "/cursuri/admin/" : "/cursuri/lector/" + fix.slug + "/",
              slug: fix.slug || "", nume: fix.nume || "",
            });
          }
        }
      }
    }

    if (fix.rol === "admin") return json({ rol: "admin", dest: "/cursuri/admin/" });
    if (fix.rol === "lector") return json({ rol: "lector", slug: fix.slug, nume: fix.nume, dest: "/cursuri/lector/" + fix.slug + "/" });
    return json({ rol: "acces", dest: "/cursuri/module/" });
  }

  // —— 2) Cod individual de candidat (registrul din store-ul „cursuri") ——
  const id = sha256(cod);
  let cand = null;
  try { cand = await getStore("cursuri").get("candidat/" + id, { type: "json" }); }
  catch (err) { console.error("Căutare candidat eșuată:", err); }

  if (cand) {
    await resetLimita(cheie);
    // Evidența intrărilor (prima / ultima), fără a bloca autentificarea la eroare.
    try {
      const acum = new Date().toISOString();
      if (!cand.prima_logare) cand.prima_logare = acum;
      cand.ultima_logare = acum;
      delete cand.cod;   // curăță fișele vechi, scrise când codul se păstra
      await getStore("cursuri").setJSON("candidat/" + id, cand);
    } catch (err) { console.error("Nu am putut marca intrarea candidatului:", err); }
    return json({ rol: "candidat", id, nume: cand.nume, dest: "/cursuri/module/" });
  }

  // —— 3) Cod de ARBITRU (membru al Colegiului care nu e lector): acces de studiu,
  //       fără teste. Registrul e administrat din panou (arbitri-cursuri).
  let arb = null;
  try { arb = await getStore("cursuri").get("arbitru/" + id, { type: "json" }); }
  catch (err) { console.error("Căutare arbitru eșuată:", err); }

  if (arb) {
    await resetLimita(cheie);
    try {
      const acum = new Date().toISOString();
      if (!arb.prima_logare) arb.prima_logare = acum;
      arb.ultima_logare = acum;
      delete arb.cod;
      await getStore("cursuri").setJSON("arbitru/" + id, arb);
    } catch (err) { console.error("Nu am putut marca intrarea arbitrului:", err); }
    return json({ rol: "arbitru", nume: arb.nume, dest: "/cursuri/arbitru/" });
  }

  const ramase = await inregistreazaEsec(cheie);
  // SEC-004: hrănim paznicul central de intruziune — poarta Școlii nu trece prin
  // `cuLimitareCod`, deci era singura ușă ale cărei refuzuri nu ajungeau în tiparul urmărit
  // de paznic. Consemnăm DOAR refuzul de acreditare (cod invalid), cu amprenta IP-ului (nu
  // IP-ul în clar) — fără cod, fără e-mail, fără date personale. Un acces valid iese mai sus
  // și nu ajunge aici, deci nu e raportat ca atac. Eșecul consemnării nu blochează intrarea.
  try { await consemneaza(getStore("acces"), { usa: "acces-cursuri", amprenta: cheie }); } catch { /* paznicul nu oprește poarta */ }
  return json({ eroare: "Cod incorect.", incercariRamase: ramase }, 401);
};
