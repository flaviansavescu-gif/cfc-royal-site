// cereri-date.mjs — cererile persoanelor vizate (GDPR / DSAR).
//
// DE CE. GDPR dă oricui dreptul să ceară accesul la datele lui, rectificarea, ștergerea,
// restricționarea, portabilitatea, opoziția sau retragerea consimțământului — și obligă
// operatorul să răspundă în 30 de zile. Până acum, calea era un simplu „scrie-ne la e-mail".
// Aici cererea se DEPUNE, primește un termen și intră într-un registru pe care registratura
// îl vede și îl închide — cu motiv, când refuză (ex. „cartea de origini nu se șterge").
//
// IMPORTANT: formularul NU execută nimic singur. Nu șterge, nu exportă, nu deconspiră date.
// Doar consemnează o cerere pe care un OM o tratează, după ce verifică identitatea celui care
// o face. Un formular care ar șterge automat la cerere ar fi el însuși o breșă.
//
// Stocare (store „registru", citire tare):
//   dsar/<id> -> cererea + istoricul stărilor
//
// POST {      actiune:"depune", tip, nume, email, descriere, website? }  -> { ok, id }   (public)
// POST { cod, dispozitiv, actiune:"lista" }                              -> { cereri }   (registratură/admin)
// POST { cod, dispozitiv, actiune:"stare", id, stare, motiv? }           -> { ok }        (registratură/admin)
import { getStore } from "@netlify/blobs";
import { actorDinCod, sha256 } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { membruDinCod, registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeaza, jurnalizeazaObligatoriu, actorJurnal, actorExtern, ipCerere } from "./_comun/registru-jurnal.mjs";
import { eRobot, limiteazaTrimiterile } from "./_comun/formular-public.mjs";
import { trimite, pagina, escapeHtml, ADRESA_ASOCIATIEI } from "./_comun/posta.mjs";

const store = () => getStore({ name: "registru", consistency: "strong" });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
// Interzice și semnele care ar putea sparge un atribut HTML la afișare (' " < > &),
// nu doar spațiul și @ — apărare în adâncime peste escaparea din pagini.
const EMAIL_RE = /^[^@\s'"<>&]+@[^@\s.'"<>&]+\.[^@\s'"<>&]+$/;
const idNou = () => Date.now() + "-" + Math.random().toString(36).slice(2, 8);

const ZILE_TERMEN = 30;               // GDPR: răspuns în cel mult o lună
const MAX_PE_ORA = 5;                 // un om cinstit nu depune cinci cereri într-o oră
const MAX_EMAIL_PE_ZI = 3;            // cel mult 3 confirmări către ACEEAȘI adresă pe zi
const FEREASTRA_EMAIL_MS = 24 * 3600e3;

const cheia = (id) => "dsar/" + id;

/**
 * Poate pleca o confirmare către această adresă acum?
 *
 * Limitarea pe IP oprește un atacator de pe un IP; asta oprește „bombardarea" unei victime
 * prin rotirea IP-urilor — confirmarea către o adresă anume nu pleacă de mai mult de câteva
 * ori pe zi. Cererea în sine se înregistrează oricum; se frânează doar e-mailul.
 */
async function poateTrimiteCatre(s, email) {
  const cheieE = "dsar-email/" + sha256(String(email).toLowerCase());
  const acum = Date.now();
  try {
    const rec = await s.get(cheieE, { type: "json" }).catch(() => null);
    if (rec && (acum - (rec.since || 0)) < FEREASTRA_EMAIL_MS) {
      if ((rec.n || 0) >= MAX_EMAIL_PE_ZI) return false;
      await s.setJSON(cheieE, { n: (rec.n || 0) + 1, since: rec.since });
      return true;
    }
    await s.setJSON(cheieE, { n: 1, since: acum });
    return true;
  } catch { return true; }   // dacă magazia cade, nu blocăm confirmarea din greșeală
}

// Drepturile pe care le poate exercita o persoană vizată. Cheia intră în date; eticheta se afișează.
export const TIPURI = {
  acces: "Acces la date",
  rectificare: "Rectificarea datelor",
  stergere: "Ștergerea datelor",
  restrictionare: "Restricționarea prelucrării",
  portabilitate: "Portabilitatea datelor",
  opozitie: "Opoziție la prelucrare",
  "retragere-consimtamant": "Retragerea consimțământului",
};
export const tipValid = (t) => Object.prototype.hasOwnProperty.call(TIPURI, t);

// Stările pe care le poate da registratura unei cereri (fapta din jurnal e legată de fiecare).
export const STARI = { "in-lucru": "dsar-in-lucru", rezolvata: "dsar-rezolvata", refuzata: "dsar-refuzata" };

/** Termenul de răspuns, ca dată ISO: momentul depunerii + 30 de zile. */
export function termenDin(creatISO, zile = ZILE_TERMEN) {
  const t = Date.parse(creatISO);
  return new Date((Number.isFinite(t) ? t : Date.now()) + zile * 86400e3).toISOString();
}

/**
 * Validează cererea publică (fără a atinge magazia). Întoarce {eroare} sau {ok, câmpuri curățate}.
 * Nu verifică identitatea — asta o face omul, la tratarea cererii.
 */
export function valideazaCerere(body) {
  const tip = taie(body.tip, 40);
  if (!tipValid(tip)) return { eroare: "Alege ce drept vrei să exerciți." };
  const nume = taie(body.nume, 120);
  if (nume.length < 2) return { eroare: "Scrie-ți numele, ca să știm cu cine vorbim." };
  const email = taie(body.email, 160);
  if (!EMAIL_RE.test(email)) return { eroare: "Scrie o adresă de e-mail validă — pe ea îți răspundem." };
  const descriere = taie(body.descriere, 2000);
  if (descriere.length < 5) return { eroare: "Spune pe scurt ce anume ceri." };
  return { ok: true, tip, nume, email, descriere };
}

async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  return null;
}

const rezumat = (c) => ({
  id: c.id, tip: c.tip, tipEticheta: TIPURI[c.tip] || c.tip, nume: c.nume, email: c.email,
  descriere: c.descriere, stare: c.stare, creat: c.creat, termen: c.termen,
  istoric: c.istoric || [], motiv: c.motivRefuz || null,
});

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = taie(body.actiune, 24);
  const s = store();

  // —— Public: depunerea unei cereri. Fără cod. ——
  if (actiune === "depune") {
    // Capcană pentru roboți: câmp ascuns completat = prefacem că a mers, dar nu scriem nimic.
    if (eRobot(body)) return json({ ok: true, id: "—" });
    const lim = await limiteazaTrimiterile(s, "dsar-ip", req, { max: MAX_PE_ORA, fereastraMs: 3600e3 });
    if (!lim.permis)
      return json({ eroare: `Ai trimis deja ${MAX_PE_ORA} cereri în ultima oră. Încearcă din nou mai târziu.` }, 429);

    const v = valideazaCerere(body);
    if (v.eroare) return json({ eroare: v.eroare }, 400);

    const id = idNou();
    const creat = new Date().toISOString();
    const cerere = {
      id, creat, termen: termenDin(creat),
      tip: v.tip, nume: v.nume, email: v.email, descriere: v.descriere,
      ip: ipCerere(req), stare: "noua",
      istoric: [{ stare: "noua", la: creat }],
    };
    await s.setJSON(cheia(id), cerere);

    // Alertă către asociație (pornește termenul de 30 de zile) — prin jurnal, ca la cererea de acces.
    await jurnalizeaza(s, {
      fapta: "dsar-primita", actor: actorExtern(v.nume), obiect: TIPURI[v.tip],
      detalii: `${v.nume} <${v.email}> — termen ${cerere.termen.slice(0, 10)}`, ip: cerere.ip,
    });

    // Confirmare către solicitant (dacă e configurată poșta). Eșecul nu strică depunerea.
    const corp =
      `<p>Am primit cererea ta privind datele personale: <strong>${escapeHtml(TIPURI[v.tip])}</strong>.</p>` +
      `<p>Îți răspundem în cel mult <strong>30 de zile</strong>, la această adresă. S-ar putea să-ți cerem ` +
      `o dovadă a identității înainte de a acționa — ca să nu dăm datele tale altcuiva.</p>` +
      `<p style="color:#666;font-size:13px">Dacă nu tu ai făcut această cerere, ignoră mesajul.</p>`;
    // Așteptat, nu „fire-and-forget": pe Netlify funcția poate îngheța după răspuns, iar un
    // e-mail rămas în aer n-ar mai pleca. `trimite` nu aruncă niciodată, deci await-ul e sigur.
    // Limită pe adresa-destinație: nu bombardăm o victimă prin rotirea IP-urilor.
    if (await poateTrimiteCatre(s, v.email)) {
      await trimite({ catre: v.email, subiect: "[CFC-Royal] Am primit cererea ta privind datele personale",
        html: pagina("Cerere înregistrată", "#1F4D3A", corp) }).catch(() => {});
    }

    return json({ ok: true, id });
  }

  // —— De aici încolo, orice acțiune cere cod + al doilea factor (rol greu). ——
  const eu = await cine(taie(body.cod, 60));
  if (!eu) return json({ eroare: "Cod incorect." }, 401);
  if (eu.rol !== "registratura" && eu.rol !== "admin")
    return json({ eroare: "Doar registratura tratează cererile privind datele." }, 403);
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol)))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);

  // —— Registrul cererilor. ——
  if (actiune === "lista") {
    // Retenție (GDPR, limitarea stocării): o cerere REZOLVATĂ sau REFUZATĂ se păstrează
    // 3 ani de la închidere — proba modului de soluționare, aliniată termenului general
    // de prescripție — apoi se șterge de la sine la prima deschidere a registrului.
    // Cererile încă deschise nu se șterg NICIODATĂ automat. Ștergerea lasă urmă în jurnal.
    const RETENTIE_MS = 3 * 365 * 24 * 3600e3;
    // Momentul închiderii se ia DIN ISTORIC. Dacă istoricul nu-l conține (date vechi,
    // istoric trunchiat), NU ștergem: mai bine păstrăm o cerere în plus decât să
    // aruncăm proba unei soluționări proaspete pe baza datei de depunere.
    const inchisaLa = (c) => {
      const ist = Array.isArray(c.istoric) ? c.istoric : [];
      const ultima = [...ist].reverse().find((i) => i.stare === "rezolvata" || i.stare === "refuzata");
      const t = Date.parse(ultima?.la ?? "");
      return Number.isFinite(t) ? t : null;
    };
    const cereri = [];
    try {
      const { blobs } = await s.list({ prefix: "dsar/" });
      for (const b of blobs) {
        const c = await s.get(b.key, { type: "json" }).catch(() => null);
        if (!c) continue;
        // O cerere cu probleme (jurnal, ștergere) NU trebuie să oprească listarea:
        // registrul are termene legale de 30 de zile, iar o listă trunchiată în tăcere
        // ar ascunde tocmai cererile deschise. De aceea fiecare pas are plasa lui.
        try {
          const inchisa = c.stare === "rezolvata" || c.stare === "refuzata";
          const inchisLa = inchisa ? inchisaLa(c) : null;
          if (inchisLa !== null && Date.now() - inchisLa > RETENTIE_MS) {
            // Întâi ștergem, apoi consemnăm — ca jurnalul să nu declare o ștergere
            // care n-a avut loc. Dacă ștergerea eșuează, cererea rămâne în listă.
            await s.delete(b.key);
            await jurnalizeazaObligatoriu(s, {
              fapta: "dsar-stearsa-retentie", actor: actorJurnal(eu),
              obiect: TIPURI[c.tip] || c.tip,
              detalii: `cerere din ${c.creat}, închisă ${new Date(inchisLa).toISOString().slice(0, 10)} — ștearsă automat la termenul de 3 ani`,
              ip: ipCerere(req),
            });
            continue;
          }
        } catch (err) {
          console.error("Retenție DSAR eșuată pentru", b.key, err);
        }
        cereri.push(rezumat(c));
      }
    } catch (err) { console.error("Listare cereri GDPR eșuată:", err); }
    // Cele mai noi întâi; cele nerezolvate, oricum, se văd după termenul care se apropie.
    cereri.sort((a, b) => String(b.creat).localeCompare(String(a.creat)));
    return json({ cereri });
  }

  // —— Schimbarea stării unei cereri (în lucru / rezolvată / refuzată-cu-motiv). ——
  if (actiune === "stare") {
    const id = taie(body.id, 60);
    const stare = taie(body.stare, 20);
    if (!STARI[stare]) return json({ eroare: "Stare necunoscută." }, 400);
    const c = await s.get(cheia(id), { type: "json" }).catch(() => null);
    if (!c) return json({ eroare: "Cerere inexistentă." }, 404);

    const motiv = taie(body.motiv, 800);
    if (stare === "refuzata" && motiv.length < 5)
      return json({ eroare: "Un refuz cere un motiv — persoana are dreptul să-l afle." }, 400);

    const acum = new Date().toISOString();
    await jurnalizeazaObligatoriu(s, {
      fapta: STARI[stare], actor: actorJurnal(eu), obiect: TIPURI[c.tip] || c.tip,
      detalii: `${c.nume} <${c.email}>` + (motiv ? ` — ${motiv}` : ""), ip: ipCerere(req),
    });

    c.stare = stare;
    if (stare === "refuzata") c.motivRefuz = motiv;
    c.istoric = c.istoric || [];
    c.istoric.push({ stare, motiv: motiv || undefined, la: acum, deCatre: actorJurnal(eu) });
    await s.setJSON(cheia(id), c);
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
